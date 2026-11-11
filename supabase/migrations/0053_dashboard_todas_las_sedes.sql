-- El Dashboard muestra las tres sedes a cualquier cuenta (tienda, invitado o administrador).
-- Las dos funciones pasan a security definer y ya no filtran por puede_ver: solo devuelven resumenes
-- (conteos, totales y listas de OC); el detalle de cada sede sigue protegido por las reglas de cada tabla.
-- Probado con la cuenta ds.san.miguel (tienda): ve las 3 sedes en el Dashboard y solo la suya al leer las tablas directamente.

create or replace function public.dashboard_resumen()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with h as (select (now() at time zone 'America/Lima')::date as hoy),
  vs as materialized (
    select v.sede_id, v.sku, v.stock_actual from public.v_stock v where v.stock_actual <= 0
  ),
  neg as (
    select v.sede_id, count(*)::int as n,
           (array_agg(v.sku order by v.stock_actual))[1:3] as ejemplos
    from vs v
    where v.stock_actual < 0
    group by v.sede_id
  ),
  demanda as (
    select s.sede_id, s.sku
    from public.salidas s, h
    where s.fecha >= h.hoy - 7
    group by s.sede_id, s.sku
  ),
  sin_stock as (
    select v.sede_id, count(*)::int as n
    from vs v
    join demanda d on d.sede_id = v.sede_id and d.sku = v.sku
    group by v.sede_id
  ),
  dup as (
    select s.sede_id, count(distinct s.nro_pedido)::int as n
    from public.salidas s
    where coalesce(s.nro_pedido, '') <> ''
      and exists (select 1 from public.cancelados c
                  where c.sede_id = s.sede_id and c.nro_pedido = s.nro_pedido)
    group by s.sede_id
  ),
  conteo_hoy as (
    select distinct c.sede_id from public.conteos c, h where c.fecha = h.hoy
  )
  select jsonb_build_object(
    'hoy', (select hoy from h),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre) order by s.nombre)
                       from public.sedes s), '[]'),
    'stock_negativo', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'n', n, 'ejemplos', ejemplos)) from neg), '[]'),
    'sin_stock_con_demanda', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'n', n)) from sin_stock), '[]'),
    'pedidos_duplicados', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'n', n)) from dup), '[]'),
    'con_conteo_hoy', coalesce((select jsonb_agg(sede_id) from conteo_hoy), '[]'),
    'oc', coalesce((
      select jsonb_agg(jsonb_build_object(
               'oc', o.oc, 'proveedor', o.proveedor, 'sede_id', o.sede_id, 'estado', o.estado_recepcion,
               'fecha', o.fecha_recepcion) order by o.fecha_recepcion nulls last, o.oc)
      from public.ordenes_compra o, h
      where o.estado_recepcion = 'Pendiente'
         or (o.estado_recepcion = 'Recibido' and o.fecha_recepcion >= h.hoy - 7)
    ), '[]')
  )
$function$;

create or replace function public.dashboard_salidas()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with hh as (select (now() at time zone 'America/Lima')::date as hoy),
  sal as (
    select v.sede_id, v.fecha, v.hora, v.sku, v.descripcion, v.nro_pedido, v.unidad, v.motorizado, v.estado
    from public.v_salidas v, hh
    where v.fecha >= hh.hoy - 6
  ),
  dias as (
    select sede_id, fecha, count(distinct nro_pedido)::int as p, coalesce(sum(unidad), 0)::int as u
    from sal group by sede_id, fecha
  ),
  horas as (
    select sede_id, extract(hour from hora)::int as h, count(distinct nro_pedido)::int as p, coalesce(sum(unidad), 0)::int as u
    from sal where hora is not null group by sede_id, extract(hour from hora)::int
  ),
  tops as (
    select max(descripcion) as d, sku, sum(unidad)::int as u, count(distinct nro_pedido)::int as p
    from sal group by sku order by sum(unidad) desc limit 8
  ),
  retorn as (
    select sede_id,
           count(distinct nro_pedido) filter (where estado in ('Pendiente', 'Entregado'))::int as total,
           count(distinct nro_pedido) filter (where estado = 'Pendiente')::int as pend
    from sal, hh where fecha = hh.hoy group by sede_id
  ),
  canc as (
    select c.sede_id, c.fecha, count(distinct c.nro_pedido)::int as p, coalesce(sum(c.unidad), 0)::int as u
    from public.cancelados c, hh
    where c.fecha >= hh.hoy - 6
    group by c.sede_id, c.fecha
  ),
  motivos as (
    select coalesce(nullif(trim(c.motivo), ''), 'Sin motivo') as m, count(distinct c.nro_pedido)::int as p
    from public.cancelados c, hh
    where c.fecha >= hh.hoy - 6
    group by 1 order by 2 desc limit 5
  ),
  sinmoto as (
    select sede_id, count(distinct nro_pedido)::int as total,
           count(distinct nro_pedido) filter (where nullif(trim(coalesce(motorizado, '')), '') is null)::int as sin
    from sal group by sede_id
  )
  select jsonb_build_object(
    'hoy', (select hoy from hh),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'fecha', fecha, 'p', p, 'u', u)) from dias), '[]'),
    'horas', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'h', h, 'p', p, 'u', u)) from horas), '[]'),
    'top', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'sku', sku, 'u', u, 'p', p) order by u desc) from tops), '[]'),
    'retornables', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'total', total, 'pend', pend)) from retorn), '[]'),
    'canc', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'fecha', fecha, 'p', p, 'u', u)) from canc), '[]'),
    'motivos', coalesce((select jsonb_agg(jsonb_build_object('m', m, 'p', p) order by p desc) from motivos), '[]'),
    'sin_motorizado', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'total', total, 'sin', sin)) from sinmoto), '[]')
  )
$function$;

revoke all on function public.dashboard_resumen() from public, anon;
revoke all on function public.dashboard_salidas() from public, anon;
grant execute on function public.dashboard_resumen() to authenticated;
grant execute on function public.dashboard_salidas() to authenticated;
