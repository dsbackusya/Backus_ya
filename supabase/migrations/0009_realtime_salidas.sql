-- Salidas en vivo: los cambios de la tabla se emiten por Supabase Realtime (respetando RLS por sede).
alter publication supabase_realtime add table public.salidas;
