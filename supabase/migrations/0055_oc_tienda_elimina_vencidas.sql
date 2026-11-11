-- Las cuentas de tienda pueden eliminar las órdenes de compra VENCIDAS de su propia sede
-- (pendientes cuya fecha de recepción ya pasó). El administrador conserva la regla oc_admin_del para cualquier OC.
-- Probado: San Miguel no puede borrar las de Chorrillos; Chorrillos sí puede borrar las suyas vencidas y no las recibidas.
create policy oc_store_del_vencidas on public.ordenes_compra
  for delete to authenticated
  using (
    (select public.mi_rol()) = 'store'
    and public.puede_ver(sede_id)
    and estado_recepcion = 'Pendiente'
    and fecha_recepcion < (now() at time zone 'America/Lima')::date
  );
