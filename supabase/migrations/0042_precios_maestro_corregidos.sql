-- Precios del maestro según el archivo oficial: 3 correcciones, 4 precios que faltaban y el SKU 10000246 (no estaba en el maestro).
update public.maestro_sku m
   set precio = v.p
  from (values ('10000092', 2.66), ('10000239', 3.53), ('13000158', 5.52),
               ('10000199', 5.30), ('10000242', 5.30), ('10000245', 3.39), ('10000247', 4.40)) as v(sku, p)
 where m.sku = v.sku;

insert into public.maestro_sku (sku, descripcion, precio)
values ('10000246', 'CERVEZA PILSEN FRESH 305 ML BOTELLA NO RETORNABLE PACK X6', 3.20)
on conflict (sku) do update set precio = excluded.precio;

-- El costo de cada merma se guarda al registrarla: se recalcula solo para los SKUs cuyo precio cambió.
update public.mt t
   set costo = m.precio * t.cantidad
  from public.maestro_sku m
 where m.sku = t.sku
   and t.sku in ('10000092', '10000239', '13000158');
