-- ingestar_pedido: un nombre de producto que existe completo en el maestro (MBEES) no se divide por " + ".

create or replace function public.ingestar_pedido(p_sede smallint, p_datos jsonb) returns jsonb
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

    -- Si el nombre completo del producto está en el maestro (p. ej. un pack con "+" en su nombre),
    -- se registra como una sola fila; si no, se separa por " + " como antes.
    for v_nombre in
      select btrim(x) from unnest(
        case when exists (select 1 from public.mbees m
                           where m.sede_id = p_sede and m.descripcion = btrim(coalesce(v_prod->>'nombre', '')))
             then array[btrim(v_prod->>'nombre')]
             else string_to_array(coalesce(v_prod->>'nombre', ''), ' + ')
        end) x
      where btrim(x) <> ''
    loop
      v_sku := null; v_factor := null;
      select m.sku, m.factor into v_sku, v_factor
        from public.mbees m where m.sede_id = p_sede and m.descripcion = v_nombre;
      v_sku := coalesce(nullif(btrim(coalesce(v_prod->>'sku', '')), ''), nullif(btrim(coalesce(v_sku, '')), ''), 'SIN SKU');
      v_factor := coalesce(v_factor, 1);

      insert into public.salidas (sede_id, fecha, hora, sku, nro_pedido, descripcion, pack, unidad, origen)
      values (p_sede, v_fecha, v_hora, v_sku, v_nro, v_nombre, v_pack, v_factor * v_pack, 'extension');
      v_n := v_n + 1;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'filas', v_n);
end $$;
