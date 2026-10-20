-- Descarga "Stock actual" del Dashboard: stock en packs de las tres sedes en columnas.
-- Una tienda solo ve su sede por RLS, así que esta función (security definer) devuelve ÚNICAMENTE
-- el stock en packs por sede y SKU (sin costos, precios ni movimientos) a cualquier cuenta con perfil.
create or replace function public.stock_pack_todas_sedes()
returns table (sede_id smallint, sku text, descripcion text, marca text, categoria text, stock_pack numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select v.sede_id, v.sku, v.descripcion, v.marca, v.categoria, v.stock_pack
    from public.v_stock v
   where exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()))
   order by v.sku, v.sede_id
$$;

revoke execute on function public.stock_pack_todas_sedes() from public, anon;
grant  execute on function public.stock_pack_todas_sedes() to authenticated;
