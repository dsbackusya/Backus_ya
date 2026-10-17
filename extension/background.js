// ============================================================
//  TaDa Order Scraper — Background Service Worker (Supabase)
// ============================================================
importScripts('config.js'); // define TADA_CONFIG = { URL, KEY } (datos públicos)

const BASE     = TADA_CONFIG.URL.replace(/\/$/, '');
const ENDPOINT = BASE + '/functions/v1/ingest-pedido';

// ── Sesión (login por usuario; la sede la determina el perfil en el servidor) ──
function usuarioAEmail(u) {
  const s = u.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return s.replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') + '@tada.local';
}

async function guardarSesion(j, usuario) {
  const sesion = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + (j.expires_in || 3600) * 1000,
    usuario,
  };
  await chrome.storage.local.set({ sesion });
  return sesion;
}

async function login(usuario, password) {
  const r = await fetch(BASE + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: TADA_CONFIG.KEY },
    body: JSON.stringify({ email: usuarioAEmail(usuario), password }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 400 ? 'Usuario o contraseña incorrectos' : (j.msg || 'Error de conexión'));
  const rp = await fetch(BASE + '/rest/v1/perfiles?select=usuario,rol,sede_id,sedes(codigo,nombre)', {
    headers: { apikey: TADA_CONFIG.KEY, Authorization: 'Bearer ' + j.access_token },
  });
  const perfil = (await rp.json().catch(() => []))[0];
  if (!perfil || perfil.rol !== 'store' || !perfil.sedes) {
    throw new Error('Este usuario no tiene una sede asignada. Usa el usuario de la sede (ej. DS SAN MIGUEL).');
  }
  const sesion = await guardarSesion(j, perfil.usuario);
  await chrome.storage.local.set({ sede: perfil.sedes.nombre });
  return { usuario: sesion.usuario, sede: perfil.sedes.nombre };
}

async function logout() {
  await chrome.storage.local.remove(['sesion', 'sede']);
}

// Devuelve un access_token vigente (renovándolo si hace falta) o lanza 'SIN_SESION'.
async function tokenValido() {
  const { sesion } = await chrome.storage.local.get(['sesion']);
  if (!sesion) throw new Error('SIN_SESION');
  if (sesion.expires_at - Date.now() > 60_000) return sesion.access_token;
  const r = await fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: TADA_CONFIG.KEY },
    body: JSON.stringify({ refresh_token: sesion.refresh_token }),
  });
  if (r.status === 400 || r.status === 401) { await logout(); throw new Error('SIN_SESION'); }
  if (!r.ok) throw new Error('No se pudo renovar la sesión (red)');
  const s = await guardarSesion(await r.json(), sesion.usuario);
  return s.access_token;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.tipo === 'pedido_nuevo') {
    const datos = message.datos;
    chrome.storage.local.get(['sesion']).then(({ sesion }) => {
      enviar(datos)
        .then(() => guardarEnHistorial(datos))
        .catch(() => guardarEnCola(datos));
      sendResponse({ ok: true, sinSesion: !sesion });
    });
    return true;
  }

  if (message.tipo === 'actualizar_motorizado') {
    const { numeroPedido, motorizado } = message;
    enviar({ accion: 'actualizar_motorizado', numeroPedido, motorizado })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.tipo === 'login') {
    login(message.usuario, message.password)
      .then((r) => { procesarCola(); sendResponse({ ok: true, ...r }); })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (message.tipo === 'logout') {
    logout().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.tipo === 'reintentar_cola') {
    procesarCola().then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('reintentar-cola', { periodInMinutes: 1 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('reintentar-cola', { periodInMinutes: 1 }));
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'reintentar-cola') procesarCola(); });

async function enviar(payload) {
  const token = await tokenValido();
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || 'Respuesta inválida');
  return json;
}

async function guardarEnHistorial(datos) {
  const result    = await chrome.storage.local.get(['historial']);
  const historial = result.historial || [];
  historial.unshift({ ...datos, enviado: true });
  await chrome.storage.local.set({ historial: historial.slice(0, 100) });
}

async function guardarEnCola(datos) {
  const result = await chrome.storage.local.get(['cola']);
  const cola   = result.cola || [];
  cola.push({ ...datos, enviado: false, intentos: 1 });
  await chrome.storage.local.set({ cola });
}

let procesandoCola = false;

async function procesarCola() {
  if (procesandoCola) return;
  procesandoCola = true;
  try {
    const { cola = [] } = await chrome.storage.local.get(['cola']);
    const pendientes = [];
    for (const item of cola) {
      const { enviado, intentos, ...datos } = item;
      try {
        await enviar(datos);
        await guardarEnHistorial(datos);
      } catch (e) {
        pendientes.push({ ...item, intentos: (intentos || 1) + 1 });
      }
    }
    await chrome.storage.local.set({ cola: pendientes });
  } finally {
    procesandoCola = false;
  }
}
