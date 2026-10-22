-- Traslado: cada producto puede llevar packs y unidades sueltas a la vez.
-- La linea trae und (packs si med = 'pack', unidades si med = 'und'), su (unidades sueltas, opcional) y fac (unidades por pack).
create or replace function public.unidades_traslado(l jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce((l->>'und')::int, 0) * case when l->>'med' = 'pack' then greatest(coalesce((l->>'fac')::int, 1), 1) else 1 end
         + coalesce((l->>'su')::int, 0)
$$;
revoke execute on function public.unidades_traslado(jsonb) from public, anon;
grant  execute on function public.unidades_traslado(jsonb) to authenticated;

create or replace function public.guardar_documento(p_sede smallint, p_tipo text, p_datos jsonb, p_usuario text, p_movs jsonb default '[]'::jsonb)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id    bigint;
  v_fecha date := (p_datos->>'fecha')::date;
  v_ref   text := coalesce(nullif(btrim(p_datos->>'reparto'), ''), '');
  m       jsonb;
  l       jsonb;
begin
  if p_tipo not in ('marcaje', 'nc', 'traslado') then
    raise exception 'Tipo de documento inválido';
  end if;
  if v_fecha is null then
    raise exception 'Fecha inválida';
  end if;

  insert into public.documentos (sede_id, tipo, fecha, reparto, transporte, placa, hora_inicio, hora_fin,
                                 nro_factura, destino, observaciones, lineas, created_by)
  values (p_sede, p_tipo, v_fecha, nullif(btrim(p_datos->>'reparto'), ''), nullif(btrim(p_datos->>'transporte'), ''),
          nullif(btrim(p_datos->>'placa'), ''), nullif(p_datos->>'horaInicio', ''), nullif(p_datos->>'horaFin', ''),
          nullif(btrim(p_datos->>'nroFactura'), ''), nullif(btrim(p_datos->>'destino'), ''),
          nullif(btrim(p_datos->>'observaciones'), ''), coalesce(p_datos->'lineas', '[]'::jsonb), p_usuario)
  returning id into v_id;

  if p_tipo = 'marcaje' then
    for m in select * from jsonb_array_elements(coalesce(p_movs, '[]'::jsonb)) loop
      insert into public.envases_mov (sede_id, fecha, tipo, tamano, estado, packs, unidades, nota, created_by, documento_id)
      values (p_sede, v_fecha, m->>'tipo', (m->>'tamano')::int, m->>'estado',
              coalesce((m->>'packs')::int, 0), coalesce((m->>'unidades')::int, 0),
              'Marcaje' || case when v_ref <> '' then ' · ' || v_ref else '' end, p_usuario, v_id);
    end loop;
  elsif p_tipo = 'nc' then
    for l in select * from jsonb_array_elements(coalesce(p_datos->'lineas', '[]'::jsonb)) loop
      if coalesce((l->>'und')::int, 0) > 0 then
        insert into public.mt (sede_id, fecha, sku, descripcion, cantidad, tipo, motivo, observaciones, documento_id)
        values (p_sede, v_fecha, l->>'sku', l->>'desc', (l->>'und')::int, 'NC',
                nullif(btrim(p_datos->>'nroFactura'), ''),
                'Orden de NC' || case when v_ref <> '' then ' · Reparto ' || v_ref else '' end, v_id);
      end if;
    end loop;
  else
    for l in select * from jsonb_array_elements(coalesce(p_datos->'lineas', '[]'::jsonb)) loop
      if public.unidades_traslado(l) > 0 then
        insert into public.mt (sede_id, fecha, sku, descripcion, cantidad, tipo, motivo, observaciones, documento_id)
        values (p_sede, v_fecha, l->>'sku', l->>'desc',
                public.unidades_traslado(l),
                'TRASLADO', 'Cargo de despacho',
                concat_ws(' · ', 'Destino: ' || coalesce(nullif(btrim(p_datos->>'destino'), ''), '—'),
                          nullif('Placa ' || coalesce(btrim(p_datos->>'placa'), ''), 'Placa '),
                          nullif(btrim(p_datos->>'observaciones'), '')), v_id);
      end if;
    end loop;
  end if;

  return v_id;
end $$;

create or replace function public.actualizar_documento(p_id bigint, p_datos jsonb, p_usuario text, p_movs jsonb default '[]'::jsonb)
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
  if d.tipo in ('nc', 'traslado') and exists (select 1 from public.mt where documento_id = p_id and coalesce(nro_factura, '') <> '') then
    raise exception 'Este documento ya tiene productos retirados en M-T; edítalo desde M-T';
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
  elsif exists (select 1 from public.mt where documento_id = p_id) then
    -- traslado con filas de M-T: se rehacen (los anteriores a este cambio no tienen y se dejan como están)
    delete from public.mt where documento_id = p_id;
    for l in select * from jsonb_array_elements(coalesce(p_datos->'lineas', '[]'::jsonb)) loop
      if public.unidades_traslado(l) > 0 then
        insert into public.mt (sede_id, fecha, sku, descripcion, cantidad, tipo, motivo, observaciones, documento_id)
        values (d.sede_id, v_fecha, l->>'sku', l->>'desc',
                public.unidades_traslado(l),
                'TRASLADO', 'Cargo de despacho',
                concat_ws(' · ', 'Destino: ' || coalesce(nullif(btrim(p_datos->>'destino'), ''), '—'),
                          nullif('Placa ' || coalesce(btrim(p_datos->>'placa'), ''), 'Placa '),
                          nullif(btrim(p_datos->>'observaciones'), '')), p_id);
      end if;
    end loop;
  end if;
end $$;

create or replace function public.eliminar_documento(p_id bigint)
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
  if d.tipo in ('nc', 'traslado') then
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
