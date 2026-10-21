-- Validación: los productos "sin contar" muestran el stock real a la fecha validada
-- (entradas, salidas y M-T anteriores a esa fecha), no el stock de hoy.
-- Antes un SKU con 0 al validar el 19/10 aparecía "sin contar" con 36 porque la entrada llegó el 20/10.
create or replace function public.get_validacion(p_sede smallint, p_fecha date)
returns jsonb
language sql
stable
set search_path = ''
as $$
with
ayer as (select p_fecha - 1 as d),
cont as (
  select c.sku,
         sum(c.total) filter (where c.fecha = (select d from ayer)) as c_ant,
         sum(c.total) filter (where c.fecha = p_fecha)              as c_act,
         (array_agg(c.producto order by c.id) filter (where c.producto is not null and c.producto <> ''))[1] as producto
  from public.conteos c
  where c.sede_id = p_sede and c.fecha in (p_fecha, (select d from ayer)) and c.sku <> ''
  group by c.sku
),
sal as (
  select sku, sum(unidad) as acum,
         sum(unidad) filter (where fecha = (select d from ayer)) as vis
  from public.salidas where sede_id = p_sede and fecha < p_fecha group by sku
),
sal_det as (
  select sku, jsonb_agg(jsonb_build_object('nroPedido', coalesce(nro_pedido,''), 'desc', coalesce(descripcion,''),
         'pack', coalesce(pack,0), 'unidad', coalesce(unidad,0), 'motorizado', coalesce(motorizado,'')) order by id) as det
  from public.salidas where sede_id = p_sede and fecha = (select d from ayer) group by sku
),
ent as (
  select sku, sum(unidades) as acum,
         sum(unidades) filter (where fecha = (select d from ayer)) as vis
  from public.entradas where sede_id = p_sede and fecha < p_fecha group by sku
),
ent_det as (
  select sku, jsonb_agg(jsonb_build_object('factura', coalesce(factura,''), 'proveedor', coalesce(proveedor,''),
         'unidades', unidades, 'responsable', coalesce(responsable,'')) order by id) as det
  from public.entradas where sede_id = p_sede and fecha = (select d from ayer) group by sku
),
mtt as (
  select sku, sum(cantidad) as acum,
         sum(cantidad) filter (where fecha = (select d from ayer)) as vis
  from public.mt where sede_id = p_sede and fecha < p_fecha group by sku
),
mt_det as (
  select sku, jsonb_agg(jsonb_build_object('tipo', coalesce(tipo,''), 'motivo', coalesce(motivo,''),
         'cant', cantidad, 'obs', coalesce(observaciones,'')) order by id) as det
  from public.mt where sede_id = p_sede and fecha = (select d from ayer) group by sku
),
contados as (
  select c.sku,
         coalesce(c.producto, sp.descripcion, '') as desc_,
         coalesce(sp.marca,'') as marca, coalesce(sp.categoria,'') as categoria, upper(coalesce(sp.top,'')) as top,
         c.c_ant, c.c_act,
         coalesce(sa.vis,0) as sal_vis, coalesce(mm.vis,0) as mt_vis, coalesce(en.vis,0) as ent_vis,
         coalesce(sd.det,'[]'::jsonb) as sal_det, coalesce(md.det,'[]'::jsonb) as mt_det, coalesce(ed.det,'[]'::jsonb) as ent_det,
         coalesce(en.acum,0) - coalesce(sa.acum,0) - coalesce(mm.acum,0) as esperado
  from cont c
  left join public.sede_productos sp on sp.sede_id = p_sede and sp.sku = c.sku
  left join sal sa on sa.sku = c.sku
  left join ent en on en.sku = c.sku
  left join mtt mm on mm.sku = c.sku
  left join sal_det sd on sd.sku = c.sku
  left join ent_det ed on ed.sku = c.sku
  left join mt_det md on md.sku = c.sku
),
items_contados as (
  select abs(coalesce(c.c_act - c.esperado, 0)) as orden, c.sku,
    jsonb_build_object(
      'sku', c.sku, 'desc', c.desc_, 'marca', c.marca, 'categoria', c.categoria, 'top', c.top,
      'sinContar', false, 'cAnterior', c.c_ant, 'salidas', c.sal_vis, 'mt', c.mt_vis, 'entradas', c.ent_vis,
      'salidasDet', c.sal_det, 'mtDet', c.mt_det, 'entradasDet', c.ent_det,
      'cActual', c.c_act, 'real', c.esperado,
      'diff', case when c.c_act is not null then c.c_act - c.esperado end,
      'cuadra', coalesce(c.c_act - c.esperado = 0, false)) as j
  from contados c
),
items_sin as (
  select 0::numeric as orden, v.sku,
    jsonb_build_object('sku', v.sku, 'desc', v.descripcion, 'marca', coalesce(v.marca,''),
      'categoria', coalesce(v.categoria,''), 'top', upper(v.top), 'sinContar', true,
      'cAnterior', null, 'salidas', null, 'mt', null, 'entradas', null, 'cActual', null,
      'real', coalesce(en.acum,0) - coalesce(sa.acum,0) - coalesce(mm.acum,0), 'diff', null, 'cuadra', false) as j
  from public.v_stock v
  left join sal sa on sa.sku = v.sku
  left join ent en on en.sku = v.sku
  left join mtt mm on mm.sku = v.sku
  where v.sede_id = p_sede and upper(coalesce(v.top,'')) = 'DIARIO'
    and not exists (select 1 from cont c where c.sku = v.sku)
)
select coalesce(jsonb_agg(j order by grupo, orden desc, sku), '[]'::jsonb)
from (
  select 0 as grupo, orden, sku, j from items_contados
  union all
  select 1, orden, sku, j from items_sin
) t
$$;
