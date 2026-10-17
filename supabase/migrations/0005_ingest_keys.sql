-- Clave por sede para la extensión de Chrome (se guarda solo el hash SHA-256 del secreto).
create table public.ingest_keys (
  sede_id    smallint primary key references public.sedes(id) on delete cascade,
  key_hash   text not null,
  created_at timestamptz not null default now()
);
alter table public.ingest_keys enable row level security;
revoke all on public.ingest_keys from anon, authenticated;
grant select, insert, update, delete on public.ingest_keys to service_role;
