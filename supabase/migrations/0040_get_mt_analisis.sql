-- Pestaña Análisis de M-T: solo mermas (tipo MERMA). "Retirado" = tiene número de factura.
-- SECURITY INVOKER: respeta RLS (cada usuario solo ve su sede). p_sede null = todas las que pueda ver.
create function public.get_mt_analisis(p_sede smallint default null) returns jsonb
language sql stable set search_path = '' as $$
with b as (
  select m.sede_id, s.nombre as sede, m.fecha, coalesce(m.costo, 0) as costo,
         coalesce(m.nro_factura, '') <> '' as ret,
         (now() at time zone 'America/Lima')::date - m.fecha as dias,
         lower(coalesce(m.motivo, '')) as mot, m.sku, m.descripcion
  from public.mt m
  join public.sedes s on s.id = m.sede_id
  where upper(trim(m.tipo)) = 'MERMA' and (p_sede is null or m.sede_id = p_sede)
),
meses as (
  select to_char(date_trunc('month', fecha), 'YYYY-MM') as mes, round(sum(costo), 2) as gen,
         round(coalesce(sum(costo) filter (where ret), 0), 2) as ret
  from b group by 1
),
sedes as (
  select sede_id as id, sede as nombre, round(sum(costo), 2) as gen,
         round(coalesce(sum(costo) filter (where ret), 0), 2) as ret
  from b group by sede_id, sede
),
mot as (
  select case
           when mot ~ '(^|[^a-z])fv([^a-z]|$)' or mot like '%venc%' then 'Vencimiento'
           when mot like '%inv%' then 'Inventario merma'
           when mot like '%pfn%' then 'PFN'
           when mot ~ 'dañ|roto|rota|rotur|ruptur|explo|agujero|hueco|chanc|deterior|mal estado|siniestro|accidente|calidad|desfigur' then 'Daño o rotura'
           when mot ~ 'vac|falt|incomplet|imcomplet|llego|llegó' then 'Faltante o vacío'
           else 'Otros' end as motivo,
         costo
  from b
),
prod as (
  select sku, max(descripcion) as descripcion, round(sum(costo), 2) as costo, count(*) as n
  from b group by sku order by sum(costo) desc limit 5
)
select jsonb_build_object(
  'gen',  coalesce((select round(sum(costo), 2) from b), 0),
  'ret',  coalesce((select round(sum(costo) filter (where ret), 2) from b), 0),
  'edad', jsonb_build_object(
            'd30',  coalesce((select round(sum(costo), 2) from b where not ret and dias <= 30), 0),
            'd60',  coalesce((select round(sum(costo), 2) from b where not ret and dias > 30 and dias <= 60), 0),
            'd60m', coalesce((select round(sum(costo), 2) from b where not ret and dias > 60), 0)),
  'meses', coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'gen', gen, 'ret', ret) order by mes) from meses), '[]'::jsonb),
  'sedes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'gen', gen, 'ret', ret) order by nombre) from sedes), '[]'::jsonb),
  'motivos', coalesce((select jsonb_agg(jsonb_build_object('motivo', motivo, 'costo', c) order by c desc)
              from (select motivo, round(sum(costo), 2) as c from mot group by motivo) q), '[]'::jsonb),
  'productos', coalesce((select jsonb_agg(jsonb_build_object('sku', sku, 'desc', descripcion, 'costo', costo, 'n', n) order by costo desc) from prod), '[]'::jsonb)
);
$$;
revoke execute on function public.get_mt_analisis(smallint) from public, anon;
grant execute on function public.get_mt_analisis(smallint) to authenticated;
