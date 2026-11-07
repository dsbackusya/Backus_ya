-- Revision del estado fisico de las mermas pendientes de retiro.
-- Por cada sede y SKU se guarda cuantas unidades de la merma pendiente estan en buen estado y cuantas en mal estado.
-- buen_estado + mal_estado debe sumar lo pendiente al guardar (pendiente_al_revisar), asi se detecta si despues
-- se registro o retiro mas merma de ese SKU. Mismas reglas de acceso que M-T: cada tienda ve y escribe solo lo suyo.
create table public.mt_revision_estado (
  sede_id             smallint not null references public.sedes(id),
  sku                 text not null,
  descripcion         text,
  buen_estado         integer not null default 0 check (buen_estado >= 0),
  mal_estado          integer not null default 0 check (mal_estado >= 0),
  pendiente_al_revisar integer not null,
  revisado_por        text,
  revisado_at         timestamptz not null default now(),
  primary key (sede_id, sku),
  check (buen_estado + mal_estado = pendiente_al_revisar)
);

alter table public.mt_revision_estado enable row level security;

create policy mt_revision_estado_select on public.mt_revision_estado for select to authenticated using (public.puede_ver(sede_id));
create policy mt_revision_estado_insert on public.mt_revision_estado for insert to authenticated with check (public.puede_escribir(sede_id));
create policy mt_revision_estado_update on public.mt_revision_estado for update to authenticated using (public.puede_escribir(sede_id)) with check (public.puede_escribir(sede_id));
create policy mt_revision_estado_delete on public.mt_revision_estado for delete to authenticated using (public.puede_escribir(sede_id));

grant select, insert, update, delete on public.mt_revision_estado to authenticated;
grant select, insert, update, delete on public.mt_revision_estado to service_role;
