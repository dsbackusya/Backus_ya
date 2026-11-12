-- Dashboard · Personal por turno: demanda real por día de la semana y hora (pedidos, líneas = ítems distintos e unidades)
-- para dimensionar picking. Solo resúmenes (security definer, igual que dashboard_salidas_analisis).
-- dow: 1 = lunes … 7 = domingo. 'dias' = cuántas fechas con operación hubo de cada día de la semana en el rango,
-- para poder sacar promedios por día. 'p80' = pedidos del día superados solo en el 20 % de los días (día exigente).
create or replace function public.dashboard_personal(p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  hoy date := (now() at time zone 'America/Lima')::date;
  d1 date := least(coalesce(p_hasta, (now() at time zone 'America/Lima')::date), (now() at time zone 'America/Lima')::date);
  d0 date;
  r jsonb;
begin
  d0 := coalesce(p_desde, d1 - 83);
  if d0 > d1 then d0 := d1; end if;
  if d1 - d0 > 399 then d0 := d1 - 399; end if;

  with base as (
    select sede_id, fecha, extract(hour from hora)::int as h,
           count(distinct nro_pedido)::int as p,
           count(*)::int as l,
           coalesce(sum(unidad), 0)::int as u
    from public.salidas
    where fecha between d0 and d1 and hora is not null
    group by sede_id, fecha, extract(hour from hora)::int
  ),
  celdas as (
    select sede_id, extract(isodow from fecha)::int as dow, h,
           sum(p)::int as p, sum(l)::int as l, sum(u)::int as u
    from base group by sede_id, extract(isodow from fecha)::int, h
  ),
  tot_dia as (
    select sede_id, fecha, extract(isodow from fecha)::int as dow, sum(p)::int as p from base group by sede_id, fecha
  ),
  dias as (
    select sede_id, dow, count(*)::int as n,
           round((percentile_cont(0.8) within group (order by p))::numeric, 1) as p80
    from tot_dia group by sede_id, dow
  )
  select jsonb_build_object(
    'desde', d0, 'hasta', d1,
    'celdas', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'dow', dow, 'h', h, 'p', p, 'l', l, 'u', u)) from celdas), '[]'),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('sede_id', sede_id, 'dow', dow, 'n', n, 'p80', p80)) from dias), '[]')
  ) into r;
  return r;
end;
$function$;

revoke all on function public.dashboard_personal(date, date) from public, anon;
grant execute on function public.dashboard_personal(date, date) to authenticated;
