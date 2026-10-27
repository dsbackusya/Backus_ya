-- Quita permisos que nadie usa y que Supabase concede por defecto a anon y authenticated:
-- TRUNCATE, REFERENCES y TRIGGER sobre las tablas de public (RLS no controla TRUNCATE).
-- anon además no necesita nada: la app siempre entra con sesión.
-- Lo que usa la app (SELECT, INSERT, UPDATE, DELETE de authenticated, filtrado por RLS) no cambia.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- Las tablas que se creen más adelante tampoco los reciben.
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
