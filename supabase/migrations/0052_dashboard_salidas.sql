-- Dashboard: salidas de los últimos 7 días por sede, día y hora, retornables por confirmar y cancelados.
-- Es una lectura (security invoker): cada cuenta solo ve las sedes que puede ver (puede_ver).
create or replace function public.dashboard_salidas()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  with hh as (select (now() at time zone 'America/Lima')::date as hoy),
  vis as (select s.id from public.sedes s where public.puede_ver(s.id)),
  sal as (
    select v.sede_id, v.fecha, v.hora, v.sku, v.descripcion, v.nro_pedido, v.unidad, v.motorizado, v.estado
    from public.v_salidas v, hh
    where v.fecha >= hh.hoy - 6 and v.sede_id in (select id from vis)
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
    where c.fecha >= hh.hoy - 6 and c.sede_id in (select id from vis)
    group by c.sede_id, c.fecha
  ),
  motivos as (
    select coalesce(nullif(trim(c.motivo), ''), 'Sin motivo') as m, count(distinct c.nro_pedido)::int as p
    from public.cancelados c, hh
    where c.fecha >= hh.hoy - 6 and c.sede_id in (select id from vis)
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

revoke all on function public.dashboard_salidas() from public, anon;
grant execute on function public.dashboard_salidas() to authenticated;
