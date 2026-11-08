-- Actualización en bloque del Maestro de productos (código SAP y precio por unidad), todo o nada.
-- La usa la pantalla "Maestro · Precios y SAP" (solo administrador): edición de una celda, panel de detalle e importación desde Excel.
--
-- p_filas: [{ "sku": "...", "desc": "...", "sap": "4000123" | null, "precio": 3.85 | null }, ...]
--   * una clave ausente = no se toca ese dato; una clave con null = se borra ese dato
--   * "desc" solo se usa al crear un SKU nuevo (o para corregir la descripción cuando viene con texto)
-- p_recalcular: si es true, el costo de las mermas (M-T) de los SKU cuyo precio se envió pasa a ser precio × cantidad.
--               Por defecto no se toca: cada merma conserva el precio que tenía el día que se registró.
-- Es security invoker: las políticas de maestro_sku y mt siguen mandando (solo escribe el administrador).
create function public.maestro_aplicar(p_filas jsonb, p_recalcular boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r          jsonb;
  v_sku      text;
  v_sap      text;
  v_precio   numeric;
  v_desc     text;
  v_ins      integer := 0;
  v_upd      integer := 0;
  v_mt       integer := 0;
  v_skus     text[]  := '{}';
begin
  if public.mi_rol() is distinct from 'admin' then
    raise exception 'Solo el administrador puede actualizar el Maestro';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Formato inválido: se esperaba una lista de filas';
  end if;

  for r in select * from jsonb_array_elements(p_filas) loop
    v_sku := btrim(coalesce(r->>'sku', ''));
    if v_sku = '' or v_sku !~ '^[A-Za-z0-9._-]+$' then
      raise exception 'SKU inválido: "%"', v_sku;
    end if;

    v_sap := null; v_precio := null; v_desc := null;
    if r ? 'sap' then
      v_sap := nullif(btrim(coalesce(r->>'sap', '')), '');
      if v_sap is not null and v_sap !~ '^[0-9]{4,10}$' then
        raise exception 'SKU %: el código SAP debe tener solo números (4 a 10 dígitos)', v_sku;
      end if;
    end if;
    if r ? 'precio' then
      if r->>'precio' is not null and btrim(r->>'precio') <> '' then
        v_precio := round((r->>'precio')::numeric, 2);
        if v_precio < 0 then
          raise exception 'SKU %: el precio no puede ser negativo', v_sku;
        end if;
      end if;
    end if;
    if r ? 'desc' then v_desc := nullif(btrim(coalesce(r->>'desc', '')), ''); end if;

    if exists (select 1 from public.maestro_sku m where m.sku = v_sku) then
      update public.maestro_sku m
         set cod_sap     = case when r ? 'sap'    then v_sap    else m.cod_sap end,
             precio      = case when r ? 'precio' then v_precio else m.precio  end,
             descripcion = coalesce(v_desc, m.descripcion)
       where m.sku = v_sku;
      v_upd := v_upd + 1;
    else
      if v_desc is null then
        raise exception 'SKU %: falta la descripción para crearlo en el Maestro', v_sku;
      end if;
      insert into public.maestro_sku (sku, descripcion, cod_sap, precio) values (v_sku, v_desc, v_sap, v_precio);
      v_ins := v_ins + 1;
    end if;

    if r ? 'precio' then v_skus := v_skus || v_sku; end if;
  end loop;

  if p_recalcular and coalesce(array_length(v_skus, 1), 0) > 0 then
    update public.mt t
       set costo = m.precio * t.cantidad
      from public.maestro_sku m
     where m.sku = t.sku and m.precio is not null and t.sku = any (v_skus);
    get diagnostics v_mt = row_count;
  end if;

  return jsonb_build_object('insertados', v_ins, 'actualizados', v_upd, 'mermas', v_mt);
end $$;

revoke execute on function public.maestro_aplicar(jsonb, boolean) from public, anon;
grant  execute on function public.maestro_aplicar(jsonb, boolean) to authenticated;
