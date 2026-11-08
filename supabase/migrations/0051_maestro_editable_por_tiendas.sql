-- El Maestro (precio por unidad y código SAP) pasa a poder actualizarlo el administrador Y las tiendas.
-- Borrar filas del Maestro sigue siendo solo del administrador.
-- Recalcular el costo de las mermas ya registradas sigue siendo solo del administrador: una tienda solo puede modificar
-- las mermas de su propia sede y el recálculo quedaría a medias.
drop policy maestro_sku_admin_ins on public.maestro_sku;
drop policy maestro_sku_admin_upd on public.maestro_sku;
create policy maestro_sku_escribir_ins on public.maestro_sku for insert to authenticated
  with check ((select public.mi_rol()) in ('admin', 'store'));
create policy maestro_sku_escribir_upd on public.maestro_sku for update to authenticated
  using      ((select public.mi_rol()) in ('admin', 'store'))
  with check ((select public.mi_rol()) in ('admin', 'store'));

create or replace function public.maestro_aplicar(p_filas jsonb, p_recalcular boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rol      text := public.mi_rol();
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
  if v_rol is distinct from 'admin' and v_rol is distinct from 'store' then
    raise exception 'Tu usuario no puede actualizar el Maestro';
  end if;
  if p_recalcular and v_rol is distinct from 'admin' then
    raise exception 'Solo el administrador puede recalcular el costo de las mermas';
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
