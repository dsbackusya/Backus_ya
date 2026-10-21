-- La venta de cajas plásticas se guarda como venta con estado 'vacia' y las cajas en packs.
create or replace function public.set_envase_mov(p_sede smallint, p_fecha date, p_tipo text, p_tamano integer, p_estado text, p_unidades integer, p_usuario text)
returns void
language plpgsql
set search_path = ''
as $$
declare v_caja boolean := (p_tipo = 'venta' and p_estado = 'vacia');
begin
  if p_tipo not in ('entrada', 'devolucion', 'venta') then
    raise exception 'Tipo de movimiento inválido';
  end if;
  delete from public.envases_mov
   where sede_id = p_sede and fecha = p_fecha and tipo = p_tipo and tamano = p_tamano and estado = p_estado and documento_id is null;
  if coalesce(p_unidades, 0) > 0 then
    insert into public.envases_mov (sede_id, fecha, tipo, tamano, estado, packs, unidades, nota, created_by)
    values (p_sede, p_fecha, p_tipo, p_tamano, p_estado, case when v_caja then p_unidades else 0 end, case when v_caja then 0 else p_unidades end, 'Manual', p_usuario);
  end if;
end $$;
