-- Se retira la funcion de ajuste de inventario por archivo; su consulta de apoyo ya no se usa.
drop function if exists public.stock_a_fecha(smallint, date);
