-- Analisis de M-T: agrega "evolucion" -- por cada SKU que alguna vez tuvo MERMA, el saldo pendiente
-- acumulado (costo) al cierre de cada mes desde el primer registro hasta el mes actual. Reconstruye el
-- historial usando fecha_retiro (fecha real del retiro) para saber si, al cierre de un mes dado, la fila
-- ya estaba retirada o seguia pendiente. Es la fuente de una tabla tipo Excel: filas = producto, columnas = mes.
create or replace function public.get_mt_analisis(p_sede smallint default null) returns jsonb
language sql stable set search_path = '' as $$
with b as (
  select m.sede_id, s.nombre as sede, m.fecha, coalesce(m.costo, 0) as costo, m.cantidad,
         coalesce(m.nro_factura, '') <> '' as ret, m.fecha_retiro,
         (now() at time zone 'America/Lima')::date - m.fecha as dias,
         lower(coalesce(m.motivo, '')) as mot, m.sku, m.descripcion,
         coalesce(nullif(trim(sp.categoria), ''), 'Sin categoría') as categoria,
         coalesce(nullif(trim(sp.marca), ''), 'Sin marca') as marca
  from public.mt m
  join public.sedes s on s.id = m.sede_id
  left join public.sede_productos sp on sp.sede_id = m.sede_id and sp.sku = m.sku
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
  from b group by sku order by sum(costo) desc limit 8
),
cat as (
  select categoria, round(sum(costo), 2) as costo, count(*) as n, sum(cantidad) as und
  from b group by categoria order by sum(costo) desc limit 8
),
marca as (
  select marca, round(sum(costo), 2) as costo, count(*) as n
  from b group by marca order by sum(costo) desc limit 8
),
detalle as (
  -- solo lo pendiente de retirar (sin nro_factura): arbol "Merma por retirar", todas las fechas
  select sku, max(descripcion) as descripcion, max(categoria) as categoria, max(marca) as marca,
         round(sum(costo), 2) as costo, sum(cantidad) as und
  from b where not ret group by sku
),
evo_meses as (
  select to_char(d, 'YYYY-MM') as mes, (d + interval '1 month - 1 day')::date as fin, row_number() over (order by d) as i
  from generate_series(date_trunc('month', (select min(fecha) from b)), date_trunc('month', (now() at time zone 'America/Lima')::date), interval '1 month') d
),
evo_skus as (select sku, max(descripcion) as descripcion, round(sum(costo), 2) as gen from b group by sku),
evo_serie as (
  select sk.sku, sk.descripcion, sk.gen,
    jsonb_agg(
      coalesce((select round(sum(b.costo), 2) from b where b.sku = sk.sku and b.fecha <= me.fin and (not b.ret or b.fecha_retiro > me.fin)), 0)
      order by me.i
    ) as valores
  from evo_skus sk cross join evo_meses me
  group by sk.sku, sk.descripcion, sk.gen
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
  'productos', coalesce((select jsonb_agg(jsonb_build_object('sku', sku, 'desc', descripcion, 'costo', costo, 'n', n) order by costo desc) from prod), '[]'::jsonb),
  'categorias', coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'costo', costo, 'n', n, 'und', und) order by costo desc) from cat), '[]'::jsonb),
  'marcas', coalesce((select jsonb_agg(jsonb_build_object('marca', marca, 'costo', costo, 'n', n) order by costo desc) from marca), '[]'::jsonb),
  'detalle', coalesce((select jsonb_agg(jsonb_build_object('sku', sku, 'desc', descripcion, 'categoria', categoria, 'marca', marca, 'costo', costo, 'und', und) order by costo desc) from detalle), '[]'::jsonb),
  'evolucion', jsonb_build_object(
    'meses', coalesce((select jsonb_agg(mes order by i) from evo_meses), '[]'::jsonb),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('sku', sku, 'desc', descripcion, 'gen', gen, 'v', valores) order by gen desc) from evo_serie), '[]'::jsonb)
  )
);
$$;
revoke execute on function public.get_mt_analisis(smallint) from public, anon;
grant execute on function public.get_mt_analisis(smallint) to authenticated;
