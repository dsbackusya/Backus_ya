-- Dashboard: alertas por sede y estado de las órdenes de compra en una sola llamada.
-- security invoker: respeta RLS (un admin/invitado ve todas las sedes; una tienda, solo la suya).
create or replace function public.dashboard_resumen()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with h as (select (now() at time zone 'America/Lima')::date as hoy),
  -- v_stock se calcula una sola vez (es lo más caro): solo los SKUs en cero o negativos
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
                       from public.sedes s
                       where public.puede_ver(s.id)), '[]'),
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
$$;

grant execute on function public.dashboard_resumen() to authenticated;
revoke execute on function public.dashboard_resumen() from public, anon;
