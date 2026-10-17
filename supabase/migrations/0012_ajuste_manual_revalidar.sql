-- Filas de salidas editadas a mano (SKU espejo o cantidades): la revalidación con el maestro no las toca.
alter table public.salidas add column ajuste_manual boolean not null default false;

-- aplicar_maestro: igual que antes, pero
--   * ignora las filas con ajuste_manual al corregir "SKU/cantidad distinta"
--   * devuelve cuántas filas distintas hay en las ventanas hoy / 7 días / 30 días / todo
create or replace function public.aplicar_maestro(
  p_sede smallint,
  p_descripcion text default null,
  p_incluir_con_sku boolean default false,
  p_desde date default null,
  p_ejecutar boolean default false
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_desde date := coalesce(p_desde, v_hoy);
  v_sin   integer;
  v_dist  integer; v_hoyn integer; v_7 integer; v_30 integer; v_todo integer;
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

  select count(*) filter (where s.fecha >= v_desde),
         count(*) filter (where s.fecha >= v_hoy),
         count(*) filter (where s.fecha >= v_hoy - 6),
         count(*) filter (where s.fecha >= v_hoy - 29),
         count(*)
    into v_dist, v_hoyn, v_7, v_30, v_todo
    from public.salidas s
    join public.mbees m on m.sede_id = s.sede_id and m.descripcion = s.descripcion
   where s.sede_id = p_sede
     and (p_descripcion is null or s.descripcion = p_descripcion)
     and btrim(coalesce(m.sku, '')) <> ''
     and s.sku not in ('SIN SKU', '')
     and not s.ajuste_manual
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
         and not s.ajuste_manual
         and s.fecha >= v_desde
         and (s.sku <> btrim(m.sku) or (s.pack is not null and s.unidad is distinct from s.pack * m.factor));
      get diagnostics v_n = row_count;
      v_act := v_act + v_n;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'sin_sku', v_sin, 'distintas', v_dist, 'actualizadas', v_act,
                            'd_hoy', v_hoyn, 'd_7', v_7, 'd_30', v_30, 'd_todo', v_todo);
end $$;
