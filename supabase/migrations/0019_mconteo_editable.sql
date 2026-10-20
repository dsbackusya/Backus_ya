-- MCONTEO (EAN -> SKU y multiplicador del conteo) editable por la sede dueña de la fila,
-- igual que MBEES. Antes solo el admin escribía en esta tabla.
drop policy mconteo_admin_ins on public.mconteo;
drop policy mconteo_admin_upd on public.mconteo;
drop policy mconteo_admin_del on public.mconteo;
create policy mconteo_insert on public.mconteo for insert to authenticated with check (public.puede_escribir(sede_id));
create policy mconteo_update on public.mconteo for update to authenticated
  using (public.puede_escribir(sede_id)) with check (public.puede_escribir(sede_id));
create policy mconteo_delete on public.mconteo for delete to authenticated using (public.puede_escribir(sede_id));
