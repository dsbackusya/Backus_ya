-- Las órdenes de compra se pueden cargar desde cualquier cuenta que escribe (admin y tienda).
-- El invitado sigue siendo solo lectura. Modificar o borrar una OC sigue siendo solo del admin.
create policy oc_insert_tienda on public.ordenes_compra
  for insert to authenticated
  with check ((select public.mi_rol()) in ('admin', 'store'));
