/* Service worker de Tada: hace la app instalable y acelera la carga.
   - Librerías con versión fija (vendor/): primero la copia guardada, sin ir a la red.
   - Archivos propios: red primero, con copia de respaldo si no hay internet.
   - Supabase (datos, login, tiempo real) nunca se guarda: siempre va a la red.
   Al cambiar la lista de archivos, sube el número de CACHE. */
const CACHE = 'tada-v15';
const BASE = ['./', 'index.html', 'app.css', 'js/core.js', 'js/stock.js', 'js/salidas.js', 'js/entradas.js', 'js/mt.js', 'js/comun.js', 'js/cancelados.js', 'js/maestro.js', 'js/mconteo.js', 'js/scanner.js', 'js/conteo.js', 'js/shell.js', 'js/validacion.js', 'js/oc.js', 'js/editar-sku.js', 'js/arranque.js', 'envases.js', 'documentos.js', 'api.js', 'config.js', 'manifest.webmanifest',
  'vendor/supabase.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function guardar(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('.supabase.co')) return; // datos: siempre en vivo
  const propio = url.origin === self.location.origin;
  const libreria = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (!propio && !libreria) return;

  // Librerías con versión fija: no cambian, se sirven desde la copia guardada.
  if (propio && url.pathname.includes('/vendor/')) {
    e.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((res) => guardar(req, res)))
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => guardar(req, res))
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
