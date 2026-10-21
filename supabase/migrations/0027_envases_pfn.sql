-- Guarda el PFN de una fecha sin tocar el resto del conteo de ese día.
-- Reemplaza solo las líneas con ubicación PFN de esa fecha; el PFN se mantiene en los días siguientes hasta el próximo cambio.
create function public.guardar_envases_pfn(p_sede smallint, p_fecha date, p_lineas jsonb, p_usuario text)
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
  delete from public.envases_conteo where sede_id = p_sede and fecha = p_fecha and lower(ubicacion) = 'pfn';
  for l in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    insert into public.envases_conteo (sede_id, fecha, estado, tamano, ubicacion, packs, cajas_solas, unidades, created_by)
    values (p_sede, p_fecha, l->>'estado', (l->>'tamano')::int, 'PFN',
            coalesce((l->>'packs')::int, 0), coalesce((l->>'solas')::int, 0), coalesce((l->>'unidades')::int, 0), p_usuario);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.guardar_envases_pfn(smallint, date, jsonb, text) from public, anon;
grant  execute on function public.guardar_envases_pfn(smallint, date, jsonb, text) to authenticated;
