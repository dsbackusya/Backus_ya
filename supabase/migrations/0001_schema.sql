-- Tada · esquema inicial (multi-sede). Aplicado en Supabase.
-- Convenciones: SKU siempre texto; fechas en hora Lima (date + time); todo lo transaccional lleva sede_id.

-- ============================================================
-- SEDES Y PERFILES
-- ============================================================
create table public.sedes (
  id      smallint generated always as identity primary key,
  codigo  text not null unique,
  nombre  text not null,
  nombre_entrega text unique,
  activa  boolean not null default true
);

-- Un perfil por usuario de Supabase Auth.
-- store    -> una sede, lectura y escritura
-- admin    -> todas las sedes, lectura y escritura
-- invitado -> todas las sedes, solo lectura
create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usuario text not null unique,
  rol     text not null check (rol in ('store','admin','invitado')),
  sede_id smallint references public.sedes(id),
  check ((rol = 'store') = (sede_id is not null))
);

create function public.mi_rol() returns text
language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where user_id = (select auth.uid())
$$;

create function public.puede_ver(p_sede smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.user_id = (select auth.uid())
      and (p.rol in ('admin','invitado') or p.sede_id = p_sede)
  )
$$;

create function public.puede_escribir(p_sede smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.user_id = (select auth.uid())
      and (p.rol = 'admin' or (p.rol = 'store' and p.sede_id = p_sede))
  )
$$;

revoke execute on function public.mi_rol(), public.puede_ver(smallint), public.puede_escribir(smallint) from public, anon;
grant  execute on function public.mi_rol(), public.puede_ver(smallint), public.puede_escribir(smallint) to authenticated;

-- ============================================================
-- CATÁLOGOS GLOBALES (iguales en las 3 sedes)
-- ============================================================
-- MAESTRO (A:D): catálogo de SKUs con código SAP y precio
create table public.maestro_sku (
  sku         text primary key,
  descripcion text not null,
  cod_sap     text,
  precio      numeric(12,2)
);

-- MCONTEO: EAN -> SKU para el escaneo de conteo
create table public.mconteo (
  id            bigint generated always as identity primary key,
  ean           text not null,
  sku           text not null,
  sap           text,
  producto      text,
  multiplicador numeric(10,2) not null default 1
);
create index mconteo_ean_idx on public.mconteo (ean);
create index mconteo_sku_idx on public.mconteo (sku);

-- MBEES: descripción del producto en TaDa -> SKU y unidades por pack
create table public.mbees (
  descripcion text primary key,
  sku         text,
  factor      integer not null default 1
);

-- MENVASES (A:B): descripción del producto en TaDa -> tipo de envase
create table public.envases_producto (
  descripcion text primary key,
  tipo        text not null check (tipo in ('Retornable','Venta'))
);

-- MENVASES (D:H) / MTAMAÑO: SKU -> tamaño y códigos de envase lleno/vacío
create table public.envases_sku (
  sku           text primary key,
  descripcion   text,
  tamano        integer,
  llena         text,
  vacio_envases text
);

-- ============================================================
-- PRODUCTOS POR SEDE (hoja STOCK, columnas A-D, M y TOP)
-- ============================================================
create table public.sede_productos (
  sede_id     smallint not null references public.sedes(id),
  sku         text not null,
  descripcion text not null,
  marca       text,
  categoria   text,
  packs       integer,
  top         text,
  primary key (sede_id, sku)
);

-- ============================================================
-- TRANSACCIONALES
-- ============================================================
-- SALIDAS: una fila por producto de cada pedido (o salida manual)
create table public.salidas (
  id              bigint generated always as identity primary key,
  sede_id         smallint not null references public.sedes(id),
  fecha           date not null,
  hora            time,
  sku             text not null,
  nro_pedido      text,
  descripcion     text,
  pack            integer,
  unidad          integer,
  motorizado      text,
  revision        text check (revision is null or revision = 'Entregado'),
  estado_override text,
  origen          text not null default 'manual' check (origen in ('manual','extension','migracion')),
  created_at      timestamptz not null default now()
);
create index salidas_sede_fecha_idx  on public.salidas (sede_id, fecha);
create index salidas_sede_pedido_idx on public.salidas (sede_id, nro_pedido);
create index salidas_sede_sku_idx    on public.salidas (sede_id, sku);

-- PD CANCELADOS: filas movidas desde SALIDAS al cancelar, con motivo
create table public.cancelados (
  id            bigint generated always as identity primary key,
  sede_id       smallint not null references public.sedes(id),
  fecha         date,
  hora          time,
  sku           text,
  nro_pedido    text not null,
  descripcion   text,
  pack          integer,
  unidad        integer,
  marca         text,
  motorizado    text,
  envases       text,
  estado        text,
  revision      text,
  motivo        text,
  cancelado_at  timestamptz not null default now(),
  cancelado_por text
);
create index cancelados_sede_pedido_idx on public.cancelados (sede_id, nro_pedido);
create index cancelados_sede_fecha_idx  on public.cancelados (sede_id, fecha);

-- ENTRADAS
create table public.entradas (
  id            bigint generated always as identity primary key,
  sede_id       smallint not null references public.sedes(id),
  factura       text,
  fecha         date not null,
  sku           text not null,
  descripcion   text,
  unidades      integer not null,
  f_vencimiento text,
  proveedor     text,
  oc            text,
  dynamics      text,
  responsable   text,
  created_at    timestamptz not null default now()
);
create index entradas_sede_sku_idx on public.entradas (sede_id, sku);
create index entradas_sede_oc_idx  on public.entradas (sede_id, oc);

-- M-T: mermas, ajustes, traslados, notas de crédito, cruces
create table public.mt (
  id            bigint generated always as identity primary key,
  sede_id       smallint not null references public.sedes(id),
  fecha         date not null,
  sku           text not null,
  descripcion   text,
  cantidad      integer not null,
  tipo          text not null,
  motivo        text,
  observaciones text,
  nro_factura   text,
  fecha_retiro  date,
  costo         numeric(12,2),
  created_at    timestamptz not null default now()
);
create index mt_sede_sku_idx on public.mt (sede_id, sku);

create function public.mt_set_costo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.costo is null then
    select coalesce(m.precio, 0) * new.cantidad into new.costo
    from public.maestro_sku m where m.sku = new.sku;
  end if;
  return new;
end $$;
create trigger mt_costo before insert on public.mt
  for each row execute function public.mt_set_costo();
revoke execute on function public.mt_set_costo() from public, anon, authenticated;

-- CONTEO: cada escaneo es un INSERT independiente; uid (generado en el cliente) evita duplicados al reintentar
create table public.conteos (
  id         bigint generated always as identity primary key,
  sede_id    smallint not null references public.sedes(id),
  uid        text,
  fecha      date not null,
  hora       time,
  ean        text,
  sku        text not null,
  producto   text,
  packs      integer not null default 0,
  und_packs  integer not null default 0,
  unds       integer not null default 0,
  total      integer not null default 0,
  ubicacion  text,
  created_by text,
  created_at timestamptz not null default now()
);
create unique index conteos_sede_uid_uq on public.conteos (sede_id, uid);
create index conteos_sede_fecha_idx on public.conteos (sede_id, fecha);
create index conteos_sede_sku_idx   on public.conteos (sede_id, sku);

-- ============================================================
-- VISTAS (reemplazan las fórmulas de las hojas). security_invoker = respetan RLS.
-- ============================================================
create view public.v_salidas with (security_invoker = true) as
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
left join public.envases_producto ep on ep.descripcion = s.descripcion
left join public.envases_sku es on es.sku = s.sku;

create view public.v_mt with (security_invoker = true) as
select m.*,
       case when m.nro_factura is null or m.nro_factura = '' then 'Pendiente' else 'Retirado' end as estado
from public.mt m;

create view public.v_stock with (security_invoker = true) as
select t.*,
       case when coalesce(t.packs, 0) > 0 then round(t.stock_actual::numeric / t.packs, 2) end as stock_pack,
       round(coalesce(t.precio, 0) * t.stock_actual, 2) as costo
from (
  select sp.sede_id, sp.sku, sp.descripcion, sp.marca, sp.categoria, sp.top, sp.packs,
         m.precio,
         coalesce(e.u, 0) as entradas,
         coalesce(s.u, 0) as salidas,
         coalesce(x.u, 0) as mt,
         coalesce(e.u, 0) - coalesce(s.u, 0) - coalesce(x.u, 0) as stock_actual
  from public.sede_productos sp
  left join public.maestro_sku m on m.sku = sp.sku
  left join (select sede_id, sku, sum(unidades) u from public.entradas group by 1, 2) e
         on e.sede_id = sp.sede_id and e.sku = sp.sku
  left join (select sede_id, sku, sum(unidad) u from public.salidas group by 1, 2) s
         on s.sede_id = sp.sede_id and s.sku = sp.sku
  left join (select sede_id, sku, sum(cantidad) u from public.mt group by 1, 2) x
         on x.sede_id = sp.sede_id and x.sku = sp.sku
) t;

-- ============================================================
-- SEGURIDAD: RLS en todo; sin acceso para anon
-- ============================================================
alter table public.sedes            enable row level security;
alter table public.perfiles         enable row level security;
alter table public.maestro_sku      enable row level security;
alter table public.mconteo          enable row level security;
alter table public.mbees            enable row level security;
alter table public.envases_producto enable row level security;
alter table public.envases_sku      enable row level security;
alter table public.sede_productos   enable row level security;
alter table public.salidas          enable row level security;
alter table public.cancelados       enable row level security;
alter table public.entradas         enable row level security;
alter table public.mt               enable row level security;
alter table public.conteos          enable row level security;

-- sedes y perfiles
create policy sedes_select on public.sedes for select to authenticated using (true);
create policy sedes_admin  on public.sedes for all    to authenticated
  using ((select public.mi_rol()) = 'admin') with check ((select public.mi_rol()) = 'admin');
create policy perfiles_select on public.perfiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.mi_rol()) = 'admin');

-- catálogos: lectura para todos, escritura solo admin
do $$
declare t text;
begin
  foreach t in array array['maestro_sku','mconteo','mbees','envases_producto','envases_sku'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.mi_rol()) = ''admin'') with check ((select public.mi_rol()) = ''admin'')', t || '_admin', t);
  end loop;
end $$;

-- tablas por sede
do $$
declare t text;
begin
  foreach t in array array['sede_productos','salidas','cancelados','entradas','mt','conteos'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.puede_ver(sede_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.puede_escribir(sede_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.puede_escribir(sede_id)) with check (public.puede_escribir(sede_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.puede_escribir(sede_id))', t || '_delete', t);
  end loop;
end $$;

-- permisos de tabla (las tablas no se exponen automáticamente)
grant usage on schema public to authenticated;
grant select on public.sedes, public.perfiles, public.maestro_sku, public.mconteo, public.mbees,
               public.envases_producto, public.envases_sku to authenticated;
grant insert, update, delete on public.sedes, public.maestro_sku, public.mconteo, public.mbees,
               public.envases_producto, public.envases_sku to authenticated;
grant select, insert, update, delete on public.sede_productos, public.salidas, public.cancelados,
               public.entradas, public.mt, public.conteos to authenticated;
grant select on public.v_salidas, public.v_mt, public.v_stock to authenticated;
