-- El costo de un registro de M-T solo se calculaba al insertar: al editar la cantidad o el SKU quedaba el costo viejo.
-- Ahora se recalcula con el precio del maestro cuando cambia el SKU o la cantidad (igual que al insertar).
create function public.mt_recalcular_costo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select m.precio * new.cantidad into new.costo
  from public.maestro_sku m where m.sku = new.sku and m.precio is not null;
  if not found then new.costo := null; end if;
  return new;
end $$;
create trigger mt_costo_upd before update on public.mt
  for each row when (old.sku is distinct from new.sku or old.cantidad is distinct from new.cantidad)
  execute function public.mt_recalcular_costo();
revoke execute on function public.mt_recalcular_costo() from public, anon, authenticated;
