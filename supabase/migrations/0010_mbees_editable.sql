-- MBEES (descripción del pedido -> SKU y unidades por pack) editable por la sede,
-- y función para propagar el maestro a las salidas ya registradas.

-- Antes solo el admin escribía en MBEES; ahora también la sede dueña de la fila.
drop policy mbees_admin on public.mbees;
create policy mbees_insert on public.mbees for insert to authenticated with check (public.puede_escribir(sede_id));
create policy mbees_update on public.mbees for update to authenticated
  using (public.puede_escribir(sede_id)) with check (public.puede_escribir(sede_id));
create policy mbees_delete on public.mbees for delete to authenticated using (public.puede_escribir(sede_id));

-- Aplica MBEES a las salidas de la sede:
--   * filas "SIN SKU" (cualquier fecha): se les pone el SKU y unidad = pack * factor
--   * filas con otro SKU/cantidad (desde p_desde): solo si p_incluir_con_sku
-- p_descripcion = null recorre todo el maestro. p_ejecutar = false solo cuenta.
create or replace function public.aplicar_maestro(
  p_sede smallint,
  p_descripcion text default null,
  p_incluir_con_sku boolean default false,
  p_desde date default null,
  p_ejecutar boolean default false
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_desde date := coalesce(p_desde, (now() at time zone 'America/Lima')::date);
  v_sin   integer;
  v_dist  integer;
  v_act   integer := 0;
  v_n     integer;
begin
  if not public.puede_escribir(p_sede) then
    return jsonb_build_object('ok', false, 'error', 'Sin permiso para esta sede');
  end if;

  select count(*) into v_sin
    from public.salidas s
    join public.mbees m on m.sede_id = s.sede_id and m.descripcion = s.descripcion
   where s.sede_id = p_sede
     and (p_descripcion is null or s.descripcion = p_descripcion)
     and btrim(coalesce(m.sku, '')) <> ''
     and s.sku in ('SIN SKU', '');

  select count(*) into v_dist
    from public.salidas s
    join public.mbees m on m.sede_id = s.sede_id and m.descripcion = s.descripcion
   where s.sede_id = p_sede
     and (p_descripcion is null or s.descripcion = p_descripcion)
     and btrim(coalesce(m.sku, '')) <> ''
     and s.sku not in ('SIN SKU', '')
     and s.fecha >= v_desde
     and (s.sku <> btrim(m.sku) or (s.pack is not null and s.unidad is distinct from s.pack * m.factor));

  if p_ejecutar then
    update public.salidas s
       set sku = btrim(m.sku),
           unidad = case when s.pack is null then s.unidad else s.pack * m.factor end
      from public.mbees m
     where m.sede_id = s.sede_id and m.descripcion = s.descripcion
       and s.sede_id = p_sede
       and (p_descripcion is null or s.descripcion = p_descripcion)
       and btrim(coalesce(m.sku, '')) <> ''
       and s.sku in ('SIN SKU', '');
    get diagnostics v_n = row_count;
    v_act := v_act + v_n;

    if p_incluir_con_sku then
      update public.salidas s
         set sku = btrim(m.sku),
             unidad = case when s.pack is null then s.unidad else s.pack * m.factor end
        from public.mbees m
       where m.sede_id = s.sede_id and m.descripcion = s.descripcion
         and s.sede_id = p_sede
         and (p_descripcion is null or s.descripcion = p_descripcion)
         and btrim(coalesce(m.sku, '')) <> ''
         and s.sku not in ('SIN SKU', '')
         and s.fecha >= v_desde
         and (s.sku <> btrim(m.sku) or (s.pack is not null and s.unidad is distinct from s.pack * m.factor));
      get diagnostics v_n = row_count;
      v_act := v_act + v_n;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'sin_sku', v_sin, 'distintas', v_dist, 'actualizadas', v_act);
end $$;

revoke execute on function public.aplicar_maestro(smallint, text, boolean, date, boolean) from public, anon;
grant  execute on function public.aplicar_maestro(smallint, text, boolean, date, boolean) to authenticated;
