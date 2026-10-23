-- Cajas sueltas (solo plástico, sin botellas) en las entregas y devoluciones del Marcaje.
-- packs = cajas con botellas, unidades = botellas sueltas, cajas = cajas plásticas sueltas.
alter table public.envases_mov add column if not exists cajas integer not null default 0 check (cajas >= 0);

-- guardar_documento y actualizar_documento: el movimiento de Envases guarda también las cajas sueltas.
do $$
declare
  d text;
  r record;
begin
  for r in
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in ('guardar_documento', 'actualizar_documento')
  loop
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'packs, unidades, nota, created_by, documento_id)', 'packs, unidades, cajas, nota, created_by, documento_id)');
    d := replace(d, 'coalesce((m->>''unidades'')::int, 0),', 'coalesce((m->>''unidades'')::int, 0), coalesce((m->>''cajas'')::int, 0),');
    if position('m->>''cajas''' in d) = 0 then
      raise exception 'No se pudo actualizar la función %', r.oid::regproc;
    end if;
    execute d;
  end loop;
end $$;
