-- Eliminar una fila de Salidas SOLO si es un duplicado (otra fila con el mismo pedido, SKU, pack y unidades).
-- Siempre queda al menos una: el bloqueo por pedido evita que dos personas borren las dos a la vez.
-- No pasa por Cancelados. Corre con los permisos de quien llama (RLS de salidas: puede_escribir).
create or replace function public.eliminar_salida_duplicada(p_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r   record;
  v_otras integer;
  v_n integer;
begin
  select s.sede_id, btrim(coalesce(s.nro_pedido, '')) as nro, s.sku, s.pack, s.unidad
    into r
    from public.salidas s
   where s.id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'stale', true, 'error', 'Esta fila ya no existe en Salidas.');
  end if;
  if r.nro = '' then
    return jsonb_build_object('ok', false, 'error', 'La fila no tiene número de pedido: solo se eliminan duplicados de un mismo pedido.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(r.sede_id::text || ':' || r.nro, 0));

  select count(*) into v_otras
    from public.salidas s
   where s.sede_id = r.sede_id
     and btrim(coalesce(s.nro_pedido, '')) = r.nro
     and s.sku = r.sku
     and s.pack is not distinct from r.pack
     and s.unidad is not distinct from r.unidad
     and s.id <> p_id;
  if v_otras = 0 then
    return jsonb_build_object('ok', false, 'error',
      'No es un duplicado: es la única fila con ese pedido, SKU y cantidad, y no se puede eliminar.');
  end if;

  delete from public.salidas where id = p_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'error', 'No se eliminó nada (sin permiso o ya no existe).');
  end if;
  return jsonb_build_object('ok', true, 'eliminados', v_n, 'quedan', v_otras, 'nroPedido', r.nro);
end $$;

revoke execute on function public.eliminar_salida_duplicada(bigint) from public, anon;
grant  execute on function public.eliminar_salida_duplicada(bigint) to authenticated;
