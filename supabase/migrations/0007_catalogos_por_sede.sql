-- Los catálogos MBEES, MCONTEO y MENVASES difieren entre sedes: pasan a ser por sede.
-- MAESTRO (precios) sigue global.
alter table public.mbees            add column sede_id smallint references public.sedes(id);
alter table public.mconteo          add column sede_id smallint references public.sedes(id);
alter table public.envases_producto add column sede_id smallint references public.sedes(id);
alter table public.envases_sku      add column sede_id smallint references public.sedes(id);

update public.mbees            set sede_id = (select id from public.sedes where codigo = 'SM');
update public.mconteo          set sede_id = (select id from public.sedes where codigo = 'SM');
update public.envases_producto set sede_id = (select id from public.sedes where codigo = 'SM');
update public.envases_sku      set sede_id = (select id from public.sedes where codigo = 'SM');

alter table public.mbees            alter column sede_id set not null;
alter table public.mconteo          alter column sede_id set not null;
alter table public.envases_producto alter column sede_id set not null;
alter table public.envases_sku      alter column sede_id set not null;

alter table public.mbees            drop constraint mbees_pkey,            add primary key (sede_id, descripcion);
alter table public.envases_producto drop constraint envases_producto_pkey, add primary key (sede_id, descripcion);
alter table public.envases_sku      drop constraint envases_sku_pkey,      add primary key (sede_id, sku);

drop index public.mconteo_ean_idx;
drop index public.mconteo_sku_idx;
create index mconteo_sede_ean_idx on public.mconteo (sede_id, ean);
create index mconteo_sede_sku_idx on public.mconteo (sede_id, sku);

do $$
declare t text;
begin
  foreach t in array array['mbees','mconteo','envases_producto','envases_sku'] loop
    execute format('drop policy %I on public.%I', t || '_select', t);
    execute format('drop policy %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.puede_ver(sede_id))', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.mi_rol()) = ''admin'') with check ((select public.mi_rol()) = ''admin'')', t || '_admin', t);
  end loop;
end $$;

create or replace view public.v_salidas with (security_invoker = true) as
select s.*,
       sp.marca,
       ep.tipo   as envases,
       es.tamano as tamano,
       coalesce(
         s.estado_override,
         case when ep.tipo = 'Retornable'
              then case when s.revision = 'Entregado' then 'Entregado' else 'Pendiente' end
              else '' end
       ) as estado
from public.salidas s
left join public.sede_productos sp on sp.sede_id = s.sede_id and sp.sku = s.sku
left join public.envases_producto ep on ep.sede_id = s.sede_id and ep.descripcion = s.descripcion
left join public.envases_sku es on es.sede_id = s.sede_id and es.sku = s.sku;

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

    for v_nombre in
      select btrim(x) from unnest(string_to_array(coalesce(v_prod->>'nombre', ''), ' + ')) x
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

create or replace function public.cancelar_pedido(p_sede smallint, p_nro_pedido text, p_motivo text) returns jsonb
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
  left join public.envases_producto ep on ep.sede_id = m.sede_id and ep.descripcion = m.descripcion;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'stale', true,
      'error', 'No se encontraron filas para el pedido "' || v_nro || '". Es posible que ya haya sido cancelado.');
  end if;
  return jsonb_build_object('ok', true, 'cancelados', v_n, 'nroPedido', v_nro);
end $$;
