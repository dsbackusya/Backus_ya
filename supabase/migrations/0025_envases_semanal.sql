-- Envases: control semanal (conteo por sector con PFN que se mantiene, movimientos del día y motorizados con devoluciones).

-- Libro de motorizados: cada fila suma lo que el motorizado debe ('debe') o lo que devolvió ('dev'); el saldo es la diferencia.
create table public.envases_moto (
  id         bigint generated always as identity primary key,
  sede_id    smallint not null references public.sedes(id),
  fecha      date not null,
  motorizado text not null,
  tamano     integer not null check (tamano in (310, 630, 1000)),
  tipo       text not null check (tipo in ('debe', 'dev')),
  cantidad   integer not null check (cantidad > 0),
  nota       text,
  created_by text,
  created_at timestamptz not null default now()
);
create index envases_moto_sede_idx on public.envases_moto (sede_id, motorizado);
create index envases_moto_fecha_idx on public.envases_moto (sede_id, fecha);

alter table public.envases_moto enable row level security;
create policy envases_moto_select on public.envases_moto for select to authenticated using (public.puede_ver(sede_id));
create policy envases_moto_insert on public.envases_moto for insert to authenticated with check (public.puede_escribir(sede_id));
create policy envases_moto_update on public.envases_moto for update to authenticated
  using (public.puede_escribir(sede_id)) with check (public.puede_escribir(sede_id));
create policy envases_moto_delete on public.envases_moto for delete to authenticated using (public.puede_escribir(sede_id));
grant select, insert, update, delete on public.envases_moto to authenticated;
grant select, insert, update, delete on public.envases_moto to service_role;

-- Reemplaza todo el conteo de un día (líneas por sector: Palet, Cámara y, si cambió, PFN).
-- p_lineas: [{estado, tamano, ubicacion, packs, solas, unidades}]
create function public.guardar_envases_conteo(p_sede smallint, p_fecha date, p_lineas jsonb, p_usuario text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  l jsonb;
  n integer := 0;
begin
  if p_fecha is null then
    raise exception 'Fecha inválida';
  end if;
  delete from public.envases_conteo where sede_id = p_sede and fecha = p_fecha;
  for l in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    insert into public.envases_conteo (sede_id, fecha, estado, tamano, ubicacion, packs, cajas_solas, unidades, created_by)
    values (p_sede, p_fecha, l->>'estado', (l->>'tamano')::int, coalesce(nullif(l->>'ubicacion', ''), 'Palet'),
            coalesce((l->>'packs')::int, 0), coalesce((l->>'solas')::int, 0), coalesce((l->>'unidades')::int, 0), p_usuario);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Fija la cantidad manual de un movimiento del día (entrada, devolución o venta) de un tamaño.
-- Los movimientos que vienen de un Marcaje (documento_id) no se tocan.
create function public.set_envase_mov(p_sede smallint, p_fecha date, p_tipo text, p_tamano integer, p_estado text, p_unidades integer, p_usuario text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_tipo not in ('entrada', 'devolucion', 'venta') then
    raise exception 'Tipo de movimiento inválido';
  end if;
  delete from public.envases_mov
   where sede_id = p_sede and fecha = p_fecha and tipo = p_tipo and tamano = p_tamano and estado = p_estado and documento_id is null;
  if coalesce(p_unidades, 0) > 0 then
    insert into public.envases_mov (sede_id, fecha, tipo, tamano, estado, packs, unidades, nota, created_by)
    values (p_sede, p_fecha, p_tipo, p_tamano, p_estado, 0, p_unidades, 'Manual', p_usuario);
  end if;
end $$;

revoke execute on function public.guardar_envases_conteo(smallint, date, jsonb, text) from public, anon;
grant  execute on function public.guardar_envases_conteo(smallint, date, jsonb, text) to authenticated;
revoke execute on function public.set_envase_mov(smallint, date, text, integer, text, integer, text) from public, anon;
grant  execute on function public.set_envase_mov(smallint, date, text, integer, text, integer, text) to authenticated;
