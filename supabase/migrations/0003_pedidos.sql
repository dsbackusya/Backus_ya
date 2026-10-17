-- Ingesta de pedidos desde la extensión de Chrome, motorizado y cancelación.

-- Reemplaza el Apps Script receptor (doGet/doPost). Solo la invoca la Edge Function con service_role.
create function public.ingestar_pedido(p_sede smallint, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_nro    text := btrim(coalesce(p_datos->>'numeroPedido', ''));
  v_ts     timestamptz := coalesce(nullif(p_datos->>'timestamp', '')::timestamptz, now());
  v_fecha  date := (v_ts at time zone 'America/Lima')::date;
  v_hora   time := date_trunc('minute', (v_ts at time zone 'America/Lima'))::time;
  v_prod   jsonb;
  v_nombre text;
  v_sku    text;
  v_factor integer;
  v_pack   integer;
  v_n      integer := 0;
begin
  if v_nro = '' then
    return jsonb_build_object('ok', false, 'error', 'numeroPedido vacío');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_sede::text || ':' || v_nro, 0));

  if exists (select 1 from public.salidas where sede_id = p_sede and nro_pedido = v_nro) then
    return jsonb_build_object('ok', true, 'duplicado', true, 'msg', 'Pedido ya registrado');
  end if;
  if exists (select 1 from public.cancelados where sede_id = p_sede and nro_pedido = v_nro) then
    return jsonb_build_object('ok', true, 'cancelado', true, 'msg', 'Pedido cancelado, no se registró');
  end if;

  for v_prod in select * from jsonb_array_elements(coalesce(p_datos->'productos', '[]'::jsonb)) loop
    v_pack := case when btrim(coalesce(v_prod->>'cantidad', '')) ~ '^\d+$'
                   then btrim(v_prod->>'cantidad')::integer else 1 end;

    for v_nombre in
      select btrim(x) from unnest(string_to_array(coalesce(v_prod->>'nombre', ''), ' + ')) x
      where btrim(x) <> ''
    loop
      select m.sku, m.factor into v_sku, v_factor from public.mbees m where m.descripcion = v_nombre;
      v_sku := coalesce(nullif(btrim(coalesce(v_prod->>'sku', '')), ''), nullif(btrim(coalesce(v_sku, '')), ''), 'SIN SKU');
      v_factor := coalesce(v_factor, 1);

      insert into public.salidas (sede_id, fecha, hora, sku, nro_pedido, descripcion, pack, unidad, origen)
      values (p_sede, v_fecha, v_hora, v_sku, v_nro, v_nombre, v_pack, v_factor * v_pack, 'extension');
      v_n := v_n + 1;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'filas', v_n);
end $$;

-- Equivale a la acción actualizar_motorizado del script receptor.
create function public.actualizar_motorizado(p_sede smallint, p_nro_pedido text, p_motorizado text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  update public.salidas
     set motorizado = btrim(p_motorizado)
   where sede_id = p_sede and nro_pedido = btrim(p_nro_pedido);
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'actualizado', v_n > 0);
end $$;

revoke execute on function public.ingestar_pedido(smallint, jsonb),
                           public.actualizar_motorizado(smallint, text, text)
  from public, anon, authenticated;
grant  execute on function public.ingestar_pedido(smallint, jsonb),
                           public.actualizar_motorizado(smallint, text, text)
  to service_role;

-- Equivale a cancelarSalida: mueve todas las filas del pedido a cancelados con su motivo.
-- SECURITY INVOKER: las políticas RLS del usuario aplican (solo cancela en su sede).
create function public.cancelar_pedido(p_sede smallint, p_nro_pedido text, p_motivo text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_nro  text := btrim(coalesce(p_nro_pedido, ''));
  v_user text;
  v_n    integer;
begin
  if btrim(coalesce(p_motivo, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'El motivo es obligatorio');
  end if;
  if v_nro = '' then
    return jsonb_build_object('ok', false, 'error', 'Pedido inválido');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_sede::text || ':' || v_nro, 0));
  select usuario into v_user from public.perfiles where user_id = (select auth.uid());

  with movidas as (
    delete from public.salidas s
     where s.sede_id = p_sede and s.nro_pedido = v_nro
    returning s.*
  )
  insert into public.cancelados
    (sede_id, fecha, hora, sku, nro_pedido, descripcion, pack, unidad, marca, motorizado,
     envases, estado, revision, motivo, cancelado_por)
  select m.sede_id, m.fecha, m.hora, m.sku, m.nro_pedido, m.descripcion, m.pack, m.unidad,
         sp.marca, m.motorizado, ep.tipo,
         coalesce(m.estado_override,
                  case when ep.tipo = 'Retornable'
                       then case when m.revision = 'Entregado' then 'Entregado' else 'Pendiente' end
                       else '' end),
         m.revision, btrim(p_motivo), v_user
  from movidas m
  left join public.sede_productos sp on sp.sede_id = m.sede_id and sp.sku = m.sku
  left join public.envases_producto ep on ep.descripcion = m.descripcion;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'stale', true,
      'error', 'No se encontraron filas para el pedido "' || v_nro || '". Es posible que ya haya sido cancelado.');
  end if;
  return jsonb_build_object('ok', true, 'cancelados', v_n, 'nroPedido', v_nro);
end $$;

revoke execute on function public.cancelar_pedido(smallint, text, text) from public, anon;
grant  execute on function public.cancelar_pedido(smallint, text, text) to authenticated;
