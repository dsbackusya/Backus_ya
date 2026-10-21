-- Ubicaciones extra del conteo de envases, por sede (Palet y Cámara de frío son fijas en la app).
create table public.envases_ubicacion (
  id         bigint generated always as identity primary key,
  sede_id    smallint not null references public.sedes(id),
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 30),
  created_by text,
  created_at timestamptz not null default now()
);
create unique index envases_ubicacion_sede_nombre_idx on public.envases_ubicacion (sede_id, lower(btrim(nombre)));

alter table public.envases_ubicacion enable row level security;
create policy envases_ubicacion_select on public.envases_ubicacion for select to authenticated using (public.puede_ver(sede_id));
create policy envases_ubicacion_insert on public.envases_ubicacion for insert to authenticated with check (public.puede_escribir(sede_id));
create policy envases_ubicacion_update on public.envases_ubicacion for update to authenticated using (public.puede_escribir(sede_id)) with check (public.puede_escribir(sede_id));
create policy envases_ubicacion_delete on public.envases_ubicacion for delete to authenticated using (public.puede_escribir(sede_id));
grant select, insert, update, delete on public.envases_ubicacion to authenticated;
grant select, insert, update, delete on public.envases_ubicacion to service_role;
