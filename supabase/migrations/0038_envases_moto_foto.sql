-- Envases: el conteo guarda una "foto" de lo que deben los motorizados al empezar el conteo del día.
-- Antes ese dato se recalculaba siempre con todo el libro de motorizados, así que entregar envases,
-- corregir, borrar o cambiar de nombre a un motorizado cambiaba también los conteos de días ya hechos.
-- La foto se guarda como líneas del conteo con ubicación 'Moto' (igual que el PFN usa 'PFN'):
--   botellas vacías que deben  -> unidades        (estado 'vacia')
--   cajas plásticas que deben  -> cajas_solas
-- Cada día tiene además una línea en ceros que marca "este día ya tiene su foto", aunque nadie deba nada.

-- Crea la foto del día con lo que se debe hasta ese momento (movimientos con fecha hasta p_fecha).
-- Si el día ya tiene foto no hace nada. Devuelve cuántas líneas creó (0 = ya existía).
create function public.fijar_envases_moto(p_sede smallint, p_fecha date, p_usuario text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer := 0;
begin
  if p_fecha is null then
    raise exception 'Fecha inválida';
  end if;
  if exists (select 1 from public.envases_conteo where sede_id = p_sede and fecha = p_fecha and lower(ubicacion) = 'moto') then
    return 0;
  end if;
  insert into public.envases_conteo (sede_id, fecha, estado, tamano, ubicacion, packs, cajas_solas, unidades, created_by)
  values (p_sede, p_fecha, 'vacia', 630, 'Moto', 0, 0, 0, p_usuario);
  n := 1;
  insert into public.envases_conteo (sede_id, fecha, estado, tamano, ubicacion, packs, cajas_solas, unidades, created_by)
  select p_sede, p_fecha, 'vacia', s.tamano, 'Moto', 0,
         case when s.caja then s.cant else 0 end, case when s.caja then 0 else s.cant end, p_usuario
  from (
    select q.tamano, q.caja, sum(q.saldo)::int as cant
    from (
      select lower(m.motorizado) as mz, m.tamano, m.caja,
             sum(case when m.tipo = 'debe' then m.cantidad else -m.cantidad end) as saldo
      from public.envases_moto m
      where m.sede_id = p_sede and m.fecha <= p_fecha
      group by lower(m.motorizado), m.tamano, m.caja
      having sum(case when m.tipo = 'debe' then m.cantidad else -m.cantidad end) > 0
    ) q
    group by q.tamano, q.caja
  ) s;
  n := n + coalesce((select count(*) from public.envases_conteo where sede_id = p_sede and fecha = p_fecha and lower(ubicacion) = 'moto' and (unidades > 0 or cajas_solas > 0)), 0)::int;
  return n;
end $$;

revoke execute on function public.fijar_envases_moto(smallint, date, text) from public, anon;
grant  execute on function public.fijar_envases_moto(smallint, date, text) to authenticated;

-- Fotos para los conteos que ya existen, para que dejen de moverse con los cambios de motorizados.
-- Días anteriores a hoy: lo que se ve actualmente (movimientos con fecha hasta ese día).
-- Hoy: solo lo registrado antes de que se guardara la primera línea del conteo (las entregas de la tarde no entran).
do $$
declare
  r record;
  hoy date := (now() at time zone 'America/Lima')::date;
begin
  for r in
    select c.sede_id, c.fecha, min(c.created_at) as primera
    from public.envases_conteo c
    where lower(c.ubicacion) not in ('pfn', 'moto')
    group by c.sede_id, c.fecha
    having not exists (
      select 1 from public.envases_conteo x
      where x.sede_id = c.sede_id and x.fecha = c.fecha and lower(x.ubicacion) = 'moto'
    )
  loop
    insert into public.envases_conteo (sede_id, fecha, estado, tamano, ubicacion, packs, cajas_solas, unidades, created_by)
    values (r.sede_id, r.fecha, 'vacia', 630, 'Moto', 0, 0, 0, 'foto inicial');

    insert into public.envases_conteo (sede_id, fecha, estado, tamano, ubicacion, packs, cajas_solas, unidades, created_by)
    select r.sede_id, r.fecha, 'vacia', s.tamano, 'Moto', 0,
           case when s.caja then s.cant else 0 end, case when s.caja then 0 else s.cant end, 'foto inicial'
    from (
      select q.tamano, q.caja, sum(q.saldo)::int as cant
      from (
        select lower(m.motorizado) as mz, m.tamano, m.caja,
               sum(case when m.tipo = 'debe' then m.cantidad else -m.cantidad end) as saldo
        from public.envases_moto m
        where m.sede_id = r.sede_id
          and (m.fecha < r.fecha or (m.fecha = r.fecha and (r.fecha < hoy or m.created_at <= r.primera)))
        group by lower(m.motorizado), m.tamano, m.caja
        having sum(case when m.tipo = 'debe' then m.cantidad else -m.cantidad end) > 0
      ) q
      group by q.tamano, q.caja
    ) s;
  end loop;
end $$;
