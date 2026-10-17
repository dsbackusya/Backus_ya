-- Rendimiento: índice faltante, índice sin uso y políticas duplicadas.

-- 1) La clave foránea perfiles.sede_id no tenía índice.
create index if not exists perfiles_sede_idx on public.perfiles (sede_id);

-- 2) ordenes_compra_sede_idx: se había eliminado por "sin uso", pero cubre la clave foránea
--    ordenes_compra.sede_id, así que se vuelve a crear (el asesor de Supabase lo pide).
drop index if exists public.ordenes_compra_sede_idx;
create index if not exists ordenes_compra_sede_idx on public.ordenes_compra (sede_id);

-- 3) Políticas duplicadas: cada tabla tenía "<tabla>_admin" (FOR ALL) y "<tabla>_select" (FOR SELECT),
--    así que en cada lectura Postgres evaluaba las dos. El administrador ya puede leer todo con
--    "<tabla>_select" (puede_ver devuelve true para admin; en las demás la condición es true),
--    por lo que la política de admin solo necesita cubrir escritura.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('envases_producto', 'envases_producto_admin'),
      ('envases_sku',      'envases_sku_admin'),
      ('maestro_sku',      'maestro_sku_admin'),
      ('mconteo',          'mconteo_admin'),
      ('ordenes_compra',   'oc_admin'),
      ('sedes',            'sedes_admin')
    ) as v(tabla, politica)
  loop
    execute format('drop policy if exists %I on public.%I', t.politica, t.tabla);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.mi_rol()) = ''admin'')',
      t.politica || '_ins', t.tabla);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.mi_rol()) = ''admin'') with check ((select public.mi_rol()) = ''admin'')',
      t.politica || '_upd', t.tabla);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.mi_rol()) = ''admin'')',
      t.politica || '_del', t.tabla);
  end loop;
end $$;
