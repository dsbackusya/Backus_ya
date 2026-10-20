-- Descarga "Stock actual" del Dashboard: se agrega el código SAP.
-- Primero el Cod_SAP del maestro (un código por SKU); si falta, el SAP del maestro de conteo
-- (si un SKU tiene varios SAP allí, salen todos separados por " / ").
drop function if exists public.stock_pack_todas_sedes();

create function public.stock_pack_todas_sedes()
returns table (sede_id smallint, sku text, descripcion text, marca text, categoria text, stock_pack numeric, sap text)
language sql
stable
security definer
set search_path = ''
as $$
  with sap_conteo as (
    select c.sku, string_agg(distinct btrim(c.sap), ' / ' order by btrim(c.sap)) as sap
      from public.mconteo c
     where btrim(coalesce(c.sap, '')) <> ''
     group by c.sku
  )
  select v.sede_id, v.sku, v.descripcion, v.marca, v.categoria, v.stock_pack,
         coalesce(nullif(btrim(m.cod_sap), ''), sc.sap) as sap
    from public.v_stock v
    left join public.maestro_sku m on m.sku = v.sku
    left join sap_conteo sc on sc.sku = v.sku
   where exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()))
   order by v.sku, v.sede_id
$$;

revoke execute on function public.stock_pack_todas_sedes() from public, anon;
grant  execute on function public.stock_pack_todas_sedes() to authenticated;
