# Dirección de diseño de Tada

App interna de inventario para operarios de bodega, usada sobre todo en celular. Tema oscuro fijo (se usa en bodegas con poca luz y con una mano).

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2 (el splash sube a ENERGY 3 / MOTION 3 por pedido del dueño)

## Decisiones y su razón
- **Violeta `#7B61EF` como único acento.** Es el color de la marca en la app. Fondo negro/gris casi negro para dar contraste a la cámara y a los números.
- **Inter para todo.** Se descarga con la app (sin pedir nada a Google), se lee bien a 12-15 px y sus números tabulares alinean las cifras de las tablas.
- **Pantalla Conteo: cámara arriba, entrada de cantidades abajo con teclado propio.** Evita que el teclado del sistema tape el producto y permite contar con una mano.
- **Marco de lectura con color de estado** (verde leído, rojo no encontrado, ámbar sin cámara). Es el único brillo de la pantalla y comunica el estado del lector.
- **Splash con vidrio líquido sobre negro liso.** Pedido del dueño: identidad de marca en la apertura. Dura 2,4 s y se ve en cada carga. No respeta "reducir movimiento" por decisión expresa del dueño.
- **Sin zoom bloqueado, controles táctiles de 44 px mínimo, foco visible con teclado.**

## Reglas de contenido
- Sin cifras, testimonios ni afirmaciones inventadas. Los valores vacíos se muestran con un guion corto (`-`), nunca con raya larga.
- El logo `web/img/logo-dinet.png` se extrajo de un video de referencia. Pendiente reemplazarlo por el archivo oficial.
