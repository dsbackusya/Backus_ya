-- Dashboard · Salidas · análisis: pedidos y unidades por sede, día, hora y mes para el rango elegido
-- (y el periodo anterior de la misma duración). Solo devuelve resúmenes de todas las sedes (security definer,
-- como dashboard_salidas); el detalle de cada sede sigue protegido por las reglas de cada tabla.
-- Probado con ds.san.miguel (tienda): 26/10 al 31/10 = 1,082 pedidos, igual que el reporte de Bees.
create or replace function public.dashboard_salidas_analisis(p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  hoy date := (now() at time zone 'America/Lima')::date;
  d1 date;
  d0 date;
  n int;
  r jsonb;
begin
  d1 := least(coalesce(p_hasta, hoy), hoy);
  d0 := coalesce(p_desde, d1 - 6);
  if d0 > d1 then d0 := d1; end if;
  if d1 - d0 > 399 then d0 := d1 - 399; end if;   -- tope de 400 días
  n := d1 - d0 + 1;

  with dia_all as (
    select sede_id, fecha, count(distinct nro_pedido)::int as p, coalesce(sum(unidad), 0)::int as u
    from public.salidas group by sede_id, fecha
  ),
  hrs as (
    select sede_id, extract(hour from hora)::int as h,
           count(distinct (fecha, nro_pedido))::int as p, coalesce(sum(unidad), 0)::int as u
    from public.salidas
    where fecha between d0 and d1 and hora is not null
    group by sede_id, extract(hour from hora)::int
  ),
  tops as (
    select max(descripcion) as d, sku, sum(unidad)::int as u, count(distinct (fecha, nro_pedido))::int as p
    from public.salidas where fecha between d0 and d1
    group by sku order by sum(unidad) desc limit 8
  ),
  canc as (
    select sede_id, count(distinct (fecha, nro_pedido))::int as p
    from public.cancelados where fecha between d0 and d1 group by sede_id
  ),
  motivos as (
    select coalesce(nullif(trim(motivo), ''), 'Sin motivo') as m, count(distinct (fecha, nro_pedido))::int as p
    from public.cancelados where fecha between d0 and d1
    group by 1 order by 2 desc limit 5
  ),
  sinmoto as (
    select sede_id, count(distinct (fecha, nro_pedido))::int as total,
           count(distinct (fecha, nro_pedido)) filter (where nullif(trim(coalesce(motorizado, '')), '') is null)::int as sin
    from public.salidas where fecha between d0 and d1 group by sede_id
  )
  select jsonb_build_object(
    'hoy', hoy, 'desde', d0, 'hasta', d1,
    'primera', (select min(fecha) from public.salidas),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'fecha', fecha, 'p', p, 'u', u))
                      from dia_all where fecha between d0 - n and d1), '[]'),
    'meses', coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'sede_id', sede_id, 'p', p, 'u', u) order by mes)
                       from (select to_char(fecha, 'YYYY-MM') as mes, sede_id, sum(p)::int as p, sum(u)::int as u
                             from dia_all group by 1, 2) m), '[]'),
    'horas', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'h', h, 'p', p, 'u', u)) from hrs), '[]'),
    'top', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'sku', sku, 'u', u, 'p', p) order by u desc) from tops), '[]'),
    'canc', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'p', p)) from canc), '[]'),
    'motivos', coalesce((select jsonb_agg(jsonb_build_object('m', m, 'p', p) order by p desc) from motivos), '[]'),
    'sin_motorizado', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'total', total, 'sin', sin)) from sinmoto), '[]')
  ) into r;
  return r;
end;
$function$;

revoke all on function public.dashboard_salidas_analisis(date, date) from public, anon;
grant execute on function public.dashboard_salidas_analisis(date, date) to authenticated;
