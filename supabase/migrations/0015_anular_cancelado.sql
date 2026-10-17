-- Anular una cancelación hecha por error: el pedido vuelve de CANCELADOS a SALIDAS.
-- Es la operación inversa de cancelar_pedido. SECURITY INVOKER: rige el RLS del usuario.
-- Al volver a Salidas el pedido deja de estar bloqueado y la extensión puede registrarlo de nuevo si hace falta.
--   - Si el pedido ya tiene filas en Salidas (p. ej. se volvió a registrar) no se restaura, para no duplicar.
--   - Se conservan fecha, hora, SKU, cantidades, motorizado y revisión originales.
--   - No se guardaron el origen ni la marca "ajuste manual": las filas vuelven con origen 'manual'.

create or replace function public.anular_cancelado(p_sede smallint, p_nro_pedido text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_nro text := btrim(coalesce(p_nro_pedido, ''));
  v_n   integer;
begin
  if v_nro = '' then
    return jsonb_build_object('ok', false, 'error', 'Pedido inválido');
  end if;
  if not public.puede_escribir(p_sede) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permiso para esta sede');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_sede::text || ':' || v_nro, 0));

  if exists (select 1 from public.salidas where sede_id = p_sede and nro_pedido = v_nro) then
    return jsonb_build_object('ok', false, 'error',
      'El pedido ' || v_nro || ' ya tiene filas en Salidas; no se puede restaurar sin duplicarlo');
  end if;

  with movidas as (
    delete from public.cancelados c
     where c.sede_id = p_sede and c.nro_pedido = v_nro
    returning c.*
  )
  insert into public.salidas (sede_id, fecha, hora, sku, nro_pedido, descripcion, pack, unidad, motorizado, revision, origen)
  select m.sede_id,
         coalesce(m.fecha, (m.cancelado_at at time zone 'America/Lima')::date),
         m.hora,
         coalesce(nullif(btrim(m.sku), ''), 'SIN SKU'),
         m.nro_pedido, m.descripcion, m.pack, m.unidad, m.motorizado,
         case when m.revision = 'Entregado' then 'Entregado' else null end,
         'manual'
  from movidas m
  order by m.id;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'error', 'No se encontró el pedido ' || v_nro || ' en Cancelados');
  end if;
  return jsonb_build_object('ok', true, 'filas', v_n, 'nroPedido', v_nro);
end $$;

revoke all on function public.anular_cancelado(smallint, text) from public, anon;
grant execute on function public.anular_cancelado(smallint, text) to authenticated;
