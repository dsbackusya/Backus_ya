-- Control de envases por tienda (todo manual): conteos por línea, movimientos, pendientes de motorizados y precios.
-- Cada tienda ve y escribe solo lo suyo (mismas reglas de acceso que M-T).

-- Conteo del día, en líneas (como un inventario). Botellas = packs x multiplicador (12/24) + unidades;
-- cajas plásticas = packs (cajas con botellas) + cajas_solas. El multiplicador se aplica en la app.
create table public.envases_conteo (
  id          bigint generated always as identity primary key,
  sede_id     smallint not null references public.sedes(id),
  fecha       date not null,
  estado      text not null check (estado in ('llena', 'vacia')),
  tamano      integer not null check (tamano in (310, 630, 1000)),
  ubicacion   text not null default 'Palet',
  packs       integer not null default 0 check (packs >= 0),
  cajas_solas integer not null default 0 check (cajas_solas >= 0),
  unidades    integer not null default 0 check (unidades >= 0),
  created_by  text,
  created_at  timestamptz not null default now()
);
create index envases_conteo_sede_fecha_idx on public.envases_conteo (sede_id, fecha);

-- Movimientos manuales: entrada (Backus entrega), devolucion (a Backus), venta (sale llena, vuelve vacía), baja (rotura).
create table public.envases_mov (
  id         bigint generated always as identity primary key,
  sede_id    smallint not null references public.sedes(id),
  fecha      date not null,
  tipo       text not null check (tipo in ('entrada', 'devolucion', 'venta', 'baja')),
  tamano     integer not null check (tamano in (310, 630, 1000)),
  estado     text not null default 'llena' check (estado in ('llena', 'vacia')),
  packs      integer not null default 0 check (packs >= 0),
  unidades   integer not null default 0 check (unidades >= 0),
  nota       text,
  created_by text,
  created_at timestamptz not null default now()
);
create index envases_mov_sede_fecha_idx on public.envases_mov (sede_id, fecha);

-- Botellas vacías que un motorizado debe entregar.
create table public.envases_pend (
  id            bigint generated always as identity primary key,
  sede_id       smallint not null references public.sedes(id),
  fecha         date not null,
  motorizado    text not null,
  tamano        integer not null check (tamano in (310, 630, 1000)),
  cantidad      integer not null check (cantidad > 0),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'entregado')),
  fecha_entrega date,
  nota          text,
  created_by    text,
  created_at    timestamptz not null default now()
);
create index envases_pend_sede_idx on public.envases_pend (sede_id, estado);

-- Precio por unidad que valoriza las diferencias (editable por tienda).
create table public.envases_precio (
  sede_id smallint not null references public.sedes(id),
  grupo   text not null check (grupo in ('caja', 'bot630_1000', 'bot310')),
  precio  numeric(8,2) not null check (precio >= 0),
  primary key (sede_id, grupo)
);

alter table public.envases_conteo enable row level security;
alter table public.envases_mov    enable row level security;
alter table public.envases_pend   enable row level security;
alter table public.envases_precio enable row level security;

do $$
declare t text;
begin
  foreach t in array array['envases_conteo', 'envases_mov', 'envases_pend', 'envases_precio'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.puede_ver(sede_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.puede_escribir(sede_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.puede_escribir(sede_id)) with check (public.puede_escribir(sede_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.puede_escribir(sede_id))', t || '_delete', t);
  end loop;
end $$;

grant select, insert, update, delete on public.envases_conteo, public.envases_mov, public.envases_pend, public.envases_precio to authenticated;
grant select, insert, update, delete on public.envases_conteo, public.envases_mov, public.envases_pend, public.envases_precio to service_role;
