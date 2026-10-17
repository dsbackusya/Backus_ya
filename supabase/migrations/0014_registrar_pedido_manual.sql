-- Registrar un pedido a mano desde el panel de Salidas (cuando la extensión no lo capturó).
-- SECURITY INVOKER: se aplican las políticas RLS del usuario (solo puede escribir en su sede).
-- Mismas reglas que ingestar_pedido: no se repite un pedido ya registrado ni uno cancelado,
-- pero aquí se avisa con un error en vez de ignorarlo en silencio.
--   p_lineas: [{ "sku": "...", "descripcion": "...", "pack": 1, "unidad": 6 }, ...]

create or replace function public.registrar_pedido_manual(
  p_sede smallint, p_nro_pedido text, p_fecha date, p_motorizado text, p_lineas jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_nro   text := btrim(coalesce(p_nro_pedido, ''));
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Lima')::date);
  v_hora  time := date_trunc('second', (now() at time zone 'America/Lima'))::time;
  v_lin   jsonb;
  v_sku   text;
  v_pack  integer;
  v_und   integer;
  v_n     integer := 0;
begin
  if v_nro = '' then
    return jsonb_build_object('ok', false, 'error', 'Escribe el número de pedido');
  end if;
  if v_fecha > v_hoy then
    return jsonb_build_object('ok', false, 'error', 'La fecha no puede ser futura');
  end if;
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Agrega al menos un producto');
  end if;
  if not public.puede_escribir(p_sede) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permiso para registrar en esta sede');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_sede::text || ':' || v_nro, 0));

  if exists (select 1 from public.salidas where sede_id = p_sede and nro_pedido = v_nro) then
    return jsonb_build_object('ok', false, 'duplicado', true, 'error', 'El pedido ' || v_nro || ' ya está registrado en Salidas');
  end if;
  if exists (select 1 from public.cancelados where sede_id = p_sede and nro_pedido = v_nro) then
    return jsonb_build_object('ok', false, 'cancelado', true, 'error', 'El pedido ' || v_nro || ' figura como cancelado');
  end if;

  for v_lin in select * from jsonb_array_elements(p_lineas) loop
    v_sku := btrim(coalesce(v_lin->>'sku', ''));
    if v_sku = '' then
      return jsonb_build_object('ok', false, 'error', 'Todos los productos necesitan SKU');
    end if;
    if btrim(coalesce(v_lin->>'pack', '')) !~ '^\d+$' or btrim(coalesce(v_lin->>'unidad', '')) !~ '^\d+$' then
      return jsonb_build_object('ok', false, 'error', 'Pack y unidades deben ser números enteros (SKU ' || v_sku || ')');
    end if;
    v_pack := btrim(v_lin->>'pack')::integer;
    v_und  := btrim(v_lin->>'unidad')::integer;
    if v_pack < 1 or v_und < 1 then
      return jsonb_build_object('ok', false, 'error', 'Pack y unidades deben ser mayores a 0 (SKU ' || v_sku || ')');
    end if;

    insert into public.salidas (sede_id, fecha, hora, sku, nro_pedido, descripcion, pack, unidad, motorizado, origen)
    values (p_sede, v_fecha, v_hora, v_sku, v_nro, btrim(coalesce(v_lin->>'descripcion', '')), v_pack, v_und,
            nullif(btrim(coalesce(p_motorizado, '')), ''), 'manual');
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'filas', v_n);
end $$;

revoke all on function public.registrar_pedido_manual(smallint, text, date, text, jsonb) from public, anon;
grant execute on function public.registrar_pedido_manual(smallint, text, date, text, jsonb) to authenticated;
