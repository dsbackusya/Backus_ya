-- Órdenes de compra (hoja externa OC_SHEET_ID) y lista de SKUs de Conteo Victor.

create table public.ordenes_compra (
  oc                   text primary key,
  cuenta_proveedor     text,
  cuenta_facturacion   text,
  proveedor            text,
  tipo_compra          text,
  estado_aprobacion    text,
  estado_orden         text,
  divisa               text,
  fecha_recepcion      date,
  modo_entrega         text,
  condiciones_entrega  text,
  acuerdo_compra       text,
  entrega_directa      text,
  subcontrato_proyecto text,
  nombre_entrega       text,
  sede_id              smallint references public.sedes(id),
  estado_recepcion     text not null default 'Pendiente'
                       check (estado_recepcion in ('Pendiente','Recibido','Cancelada'))
);
create index ordenes_compra_sede_idx on public.ordenes_compra (sede_id);

create function public.oc_set_sede() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.sede_id is null and new.nombre_entrega is not null then
    select s.id into new.sede_id from public.sedes s where s.nombre_entrega = new.nombre_entrega;
  end if;
  return new;
end $$;
create trigger oc_sede before insert or update of nombre_entrega on public.ordenes_compra
  for each row execute function public.oc_set_sede();
revoke execute on function public.oc_set_sede() from public, anon, authenticated;

-- Equivale a validarRecepcionOC: las OC Pendiente que aparecen en ENTRADAS de cualquier sede pasan a Recibido.
create function public.validar_recepcion_oc() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if (select public.mi_rol()) is null then
    raise exception 'No autorizado';
  end if;
  update public.ordenes_compra o
     set estado_recepcion = 'Recibido'
   where o.estado_recepcion = 'Pendiente'
     and exists (select 1 from public.entradas e where e.oc = o.oc);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Equivale a getRecepcionesPorTienda: OC distintas recibidas por sede en una fecha.
create function public.recepciones_por_sede(p_fecha date default null)
returns table (sede_id smallint, nombre text, recepciones integer, ocs text[])
language sql stable security definer set search_path = '' as $$
  select s.id, s.nombre,
         count(distinct e.oc)::integer,
         coalesce(array_agg(distinct e.oc order by e.oc) filter (where e.oc is not null), '{}')
  from public.sedes s
  left join public.entradas e
         on e.sede_id = s.id
        and e.fecha = coalesce(p_fecha, (now() at time zone 'America/Lima')::date)
        and coalesce(e.oc, '') <> ''
  where (select public.mi_rol()) is not null
  group by s.id, s.nombre
  order by s.nombre
$$;

create table public.skus_victor (
  sku text primary key
);

alter table public.ordenes_compra enable row level security;
alter table public.skus_victor    enable row level security;

create policy oc_select on public.ordenes_compra for select to authenticated using (true);
create policy oc_admin  on public.ordenes_compra for all to authenticated
  using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');
create policy victor_admin on public.skus_victor for all to authenticated
  using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');

grant select, insert, update, delete on public.ordenes_compra, public.skus_victor to authenticated;

revoke execute on function public.validar_recepcion_oc(), public.recepciones_por_sede(date) from public, anon;
grant  execute on function public.validar_recepcion_oc(), public.recepciones_por_sede(date) to authenticated;
