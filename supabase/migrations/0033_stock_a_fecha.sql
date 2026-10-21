-- Stock de cada producto de una sede al cierre de una fecha (entradas - salidas - M-T con fecha <= p_fecha),
-- junto al stock actual. Sirve para ajustar el inventario de un dia pasado sin tocar lo que se movio despues.
-- Corre con los permisos de quien llama (RLS de entradas/salidas/mt/sede_productos).
create or replace function public.stock_a_fecha(p_sede smallint, p_fecha date)
returns table (sku text, descripcion text, stock_fecha bigint, stock_actual bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select sp.sku,
         sp.descripcion,
         (coalesce(e.f, 0) - coalesce(s.f, 0) - coalesce(m.f, 0))::bigint as stock_fecha,
         (coalesce(e.t, 0) - coalesce(s.t, 0) - coalesce(m.t, 0))::bigint as stock_actual
    from public.sede_productos sp
    left join (select x.sku, sum(x.unidades) filter (where x.fecha <= p_fecha) f, sum(x.unidades) t
                 from public.entradas x where x.sede_id = p_sede group by x.sku) e on e.sku = sp.sku
    left join (select x.sku, sum(x.unidad) filter (where x.fecha <= p_fecha) f, sum(x.unidad) t
                 from public.salidas x where x.sede_id = p_sede group by x.sku) s on s.sku = sp.sku
    left join (select x.sku, sum(x.cantidad) filter (where x.fecha <= p_fecha) f, sum(x.cantidad) t
                 from public.mt x where x.sede_id = p_sede group by x.sku) m on m.sku = sp.sku
   where sp.sede_id = p_sede
   order by sp.sku;
$$;

revoke execute on function public.stock_a_fecha(smallint, date) from public, anon;
grant  execute on function public.stock_a_fecha(smallint, date) to authenticated;
