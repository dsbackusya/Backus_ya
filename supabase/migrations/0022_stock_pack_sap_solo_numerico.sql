-- Descarga "Stock actual": el SAP solo puede ser un código numérico.
-- El maestro traía textos sueltos en Cod_SAP ("(en blanco)", nombres de producto) que salían en el Excel.
-- Del maestro de conteo solo se toma un SAP distinto del SKU (cuando es igual es un relleno, no un código SAP).
create or replace function public.stock_pack_todas_sedes()
returns table (sede_id smallint, sku text, descripcion text, marca text, categoria text, stock_pack numeric, sap text)
language sql
stable
security definer
set search_path = ''
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
   where exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()))
   order by v.sku, v.sede_id
$$;
