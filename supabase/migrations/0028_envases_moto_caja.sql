-- Motorizados: además de botellas, pueden deber cajas plásticas (caja = true; tamano indica la familia de caja).
alter table public.envases_moto add column caja boolean not null default false;
