-- Las funciones que cruzan todas las sedes solo las puede usar un admin o un invitado (solo lectura); una tienda ve solo su sede.
create or replace function public.stock_pack_todas_sedes()
returns table(sede_id smallint, sku text, descripcion text, marca text, categoria text, stock_pack numeric, sap text)
language sql
stable
security definer
set search_path to ''
as $$
  with sap_conteo as (
    select c.sku, string_agg(distinct btrim(c.sap), ' / ' order by btrim(c.sap)) as sap
      from public.mconteo c
     where btrim(coalesce(c.sap, '')) ~ '^[0-9]+$' and btrim(c.sap) <> c.sku
     group by c.sku
  )
  select v.sede_id, v.sku, v.descripcion, v.marca, v.categoria, v.stock_pack,
         coalesce(case when btrim(coalesce(m.cod_sap, '')) ~ '^[0-9]+$' then btrim(m.cod_sap) end, sc.sap) as sap
    from public.v_stock v
    left join public.maestro_sku m on m.sku = v.sku
    left join sap_conteo sc on sc.sku = v.sku
   where (select public.mi_rol()) in ('admin', 'invitado')
   order by v.sku, v.sede_id
$$;

create or replace function public.recepciones_por_sede(p_fecha date default null)
returns table(sede_id smallint, nombre text, recepciones integer, ocs text[])
language sql
stable
security definer
set search_path to ''
as $$
  select s.id, s.nombre,
         count(distinct e.oc)::integer,
         coalesce(array_agg(distinct e.oc order by e.oc) filter (where e.oc is not null), '{}')
  from public.sedes s
  left join public.entradas e
         on e.sede_id = s.id
        and e.fecha = coalesce(p_fecha, (now() at time zone 'America/Lima')::date)
        and coalesce(e.oc, '') <> ''
  where (select public.mi_rol()) in ('admin', 'invitado')
  group by s.id, s.nombre
  order by s.nombre
$$;

-- Validar recepción cambia datos: un invitado (solo lectura) no debe poder hacerlo.
create or replace function public.validar_recepcion_oc()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_n integer;
begin
  if coalesce((select public.mi_rol()), '') not in ('admin', 'store') then
    raise exception 'No autorizado';
  end if;
  update public.ordenes_compra o
     set estado_recepcion = 'Recibido'
   where o.estado_recepcion = 'Pendiente'
     and exists (select 1 from public.entradas e where e.oc = o.oc);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Índices para las llaves foráneas que no tenían (borrar un documento y buscar sus movimientos).
create index if not exists envases_mov_documento_idx on public.envases_mov (documento_id);
create index if not exists mt_documento_idx on public.mt (documento_id);

-- oc_insert_tienda ya cubre a admin y store: la política de admin era repetida.
drop policy if exists oc_admin_ins on public.ordenes_compra;
