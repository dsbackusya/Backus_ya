-- Normaliza categoria/marca en sede_productos: varias filas tenian el mismo valor escrito distinto
-- (mayusculas/minusculas o con/sin tilde, ej. "Guarana" / "GUARANA" / "Guaraná"), lo que partia el
-- desglose de M-T Analisis (y de cualquier otra pantalla que agrupe por categoria/marca) en filas repetidas.
update public.sede_productos set categoria = 'CERVEZAS'    where categoria = 'Cervezas';
update public.sede_productos set categoria = 'ENERGIZANTE' where categoria = 'Energizante';

update public.sede_productos set marca = 'Coca Cola'     where marca = 'COCA COLA';
update public.sede_productos set marca = 'Cristal'       where marca = 'CRISTAL';
update public.sede_productos set marca = 'Guaraná'       where marca in ('Guarana', 'GUARANA');
update public.sede_productos set marca = 'Jack'          where marca = 'jack';
update public.sede_productos set marca = 'Lays'          where marca in ('lays', 'LAYS');
update public.sede_productos set marca = 'Mike''s'       where marca = 'Mike''S';
update public.sede_productos set marca = 'Monster'       where marca = 'MONSTER';
update public.sede_productos set marca = 'Pancho Fierro' where marca = 'PANCHO FIERRO';
-- "Pisco Portón" / "Pisco PORTÓN" / "Porton" -- la mayoria de filas ya usaba el nombre corto, solo le faltaba la tilde
update public.sede_productos set marca = 'Portón'        where marca in ('Pisco Portón', 'Pisco PORTÓN', 'Porton');
update public.sede_productos set marca = 'RELX'          where marca = 'Relx';
update public.sede_productos set marca = 'Russkaya'      where marca in ('RussKaya', 'RUSSKAYA');
update public.sede_productos set marca = 'Zacapa'        where marca = 'ZACAPA';
