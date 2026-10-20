-- Documentos de despacho: editar y eliminar desde el historial, manteniendo Envases y M-T coherentes.

-- Actualiza un documento y rehace su efecto:
--   marcaje: reemplaza los movimientos de Envases enlazados por los de p_movs
--   nc:      reemplaza las filas de M-T enlazadas (no se puede si alguna ya fue retirada)
-- security invoker: las políticas RLS siguen aplicando.
create function public.actualizar_documento(p_id bigint, p_datos jsonb, p_usuario text, p_movs jsonb default '[]'::jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  d       public.documentos;
  v_fecha date := (p_datos->>'fecha')::date;
  v_ref   text := coalesce(nullif(btrim(p_datos->>'reparto'), ''), '');
  v_n     integer;
  m       jsonb;
  l       jsonb;
begin
  select * into d from public.documentos where id = p_id;
  if not found then
    raise exception 'Documento no encontrado';
  end if;
  if v_fecha is null then
    raise exception 'Fecha inválida';
  end if;
  if d.tipo = 'nc' and exists (select 1 from public.mt where documento_id = p_id and coalesce(nro_factura, '') <> '') then
    raise exception 'Esta NC ya tiene productos retirados en M-T; edítala desde M-T';
  end if;

  update public.documentos set
    fecha = v_fecha,
    reparto = nullif(btrim(p_datos->>'reparto'), ''),
    transporte = nullif(btrim(p_datos->>'transporte'), ''),
    placa = nullif(btrim(p_datos->>'placa'), ''),
    hora_inicio = nullif(p_datos->>'horaInicio', ''),
    hora_fin = nullif(p_datos->>'horaFin', ''),
    nro_factura = nullif(btrim(p_datos->>'nroFactura'), ''),
    destino = nullif(btrim(p_datos->>'destino'), ''),
    observaciones = nullif(btrim(p_datos->>'observaciones'), ''),
    lineas = coalesce(p_datos->'lineas', '[]'::jsonb)
  where id = p_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Sin permiso para editar este documento';
  end if;

  if d.tipo = 'marcaje' then
    delete from public.envases_mov where documento_id = p_id;
    for m in select * from jsonb_array_elements(coalesce(p_movs, '[]'::jsonb)) loop
      insert into public.envases_mov (sede_id, fecha, tipo, tamano, estado, packs, unidades, nota, created_by, documento_id)
      values (d.sede_id, v_fecha, m->>'tipo', (m->>'tamano')::int, m->>'estado',
              coalesce((m->>'packs')::int, 0), coalesce((m->>'unidades')::int, 0),
              'Marcaje' || case when v_ref <> '' then ' · ' || v_ref else '' end, p_usuario, p_id);
    end loop;
  elsif d.tipo = 'nc' then
    delete from public.mt where documento_id = p_id;
    for l in select * from jsonb_array_elements(coalesce(p_datos->'lineas', '[]'::jsonb)) loop
      if coalesce((l->>'und')::int, 0) > 0 then
        insert into public.mt (sede_id, fecha, sku, descripcion, cantidad, tipo, motivo, observaciones, documento_id)
        values (d.sede_id, v_fecha, l->>'sku', l->>'desc', (l->>'und')::int, 'NC',
                nullif(btrim(p_datos->>'nroFactura'), ''),
                'Orden de NC' || case when v_ref <> '' then ' · Reparto ' || v_ref else '' end, p_id);
      end if;
    end loop;
  end if;
end $$;

-- Elimina un documento: sus movimientos de Envases se borran con él (cascade) y las filas de M-T de una NC
-- se borran mientras sigan pendientes (las ya retiradas se conservan). Devuelve cuántas filas de M-T se conservaron.
create function public.eliminar_documento(p_id bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  d      public.documentos;
  v_kept integer;
  v_n    integer;
begin
  select * into d from public.documentos where id = p_id;
  if not found then
    raise exception 'Documento no encontrado';
  end if;
  if d.tipo = 'nc' then
    delete from public.mt where documento_id = p_id and coalesce(nro_factura, '') = '';
  end if;
  select count(*) into v_kept from public.mt where documento_id = p_id;
  delete from public.documentos where id = p_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Sin permiso para eliminar este documento';
  end if;
  return jsonb_build_object('mt_conservadas', v_kept);
end $$;

revoke execute on function public.actualizar_documento(bigint, jsonb, text, jsonb) from public, anon;
grant  execute on function public.actualizar_documento(bigint, jsonb, text, jsonb) to authenticated;
revoke execute on function public.eliminar_documento(bigint) from public, anon;
grant  execute on function public.eliminar_documento(bigint) to authenticated;
