-- El motivo "Cancelo por consumir" pasa a llamarse "Cancelado por el consumidor"
-- (incluye la variante mal escrita "Cancelo por consumidor") para que el Dashboard los agrupe juntos.
update public.cancelados
   set motivo = 'Cancelado por el consumidor'
 where motivo in ('Cancelo por consumir','Cancelo por consumidor');
