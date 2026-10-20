-- Documentos de despacho (Marcaje, Orden de NC y Traslado): historial por tienda y su efecto en Envases y M-T.
-- Cada tienda ve y escribe solo lo suyo (mismas reglas que M-T y Envases).
create table public.documentos (
  id            bigint generated always as identity primary key,
  sede_id       smallint not null references public.sedes(id),
  tipo          text not null check (tipo in ('marcaje', 'nc', 'traslado')),
  fecha         date not null,
  reparto       text,
  transporte    text,
  placa         text,
  hora_inicio   text,
  hora_fin      text,
  nro_factura   text,
  destino       text,
  observaciones text,
  lineas        jsonb not null default '[]'::jsonb,
  created_by    text,
  created_at    timestamptz not null default now()
);
create index documentos_sede_idx on public.documentos (sede_id, id desc);
create index documentos_sede_tipo_idx on public.documentos (sede_id, tipo, fecha desc);

alter table public.documentos enable row level security;
create policy documentos_select on public.documentos for select to authenticated using (public.puede_ver(sede_id));
create policy documentos_insert on public.documentos for insert to authenticated with check (public.puede_escribir(sede_id));
create policy documentos_update on public.documentos for update to authenticated
  using (public.puede_escribir(sede_id)) with check (public.puede_escribir(sede_id));
create policy documentos_delete on public.documentos for delete to authenticated using (public.puede_escribir(sede_id));
grant select, insert, update, delete on public.documentos to authenticated;
grant select, insert, update, delete on public.documentos to service_role;

-- Los movimientos de Envases creados desde un Marcaje quedan enlazados (al borrar el documento se borran).
alter table public.envases_mov add column documento_id bigint references public.documentos(id) on delete cascade;
-- Las filas de M-T creadas desde una NC quedan enlazadas (si se borra el documento, la fila de M-T se conserva).
alter table public.mt add column documento_id bigint references public.documentos(id) on delete set null;

-- Guarda el documento y, en la misma operación:
--   marcaje: los movimientos de Envases que se envían en p_movs (entrada llena / devolución vacía)
--   nc:      una fila de M-T por producto, tipo NC, pendiente, con la factura en Motivo
-- security invoker: las políticas RLS de cada tabla siguen aplicando.
create function public.guardar_documento(p_sede smallint, p_tipo text, p_datos jsonb, p_usuario text, p_movs jsonb default '[]'::jsonb)
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
  end if;

  return v_id;
end $$;

revoke execute on function public.guardar_documento(smallint, text, jsonb, text, jsonb) from public, anon;
grant  execute on function public.guardar_documento(smallint, text, jsonb, text, jsonb) to authenticated;
