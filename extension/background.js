// ============================================================
//  TaDa Order Scraper — Background Service Worker (Supabase)
// ============================================================
importScripts('config.js'); // define TADA_CONFIG = { URL, KEY } (generado por tools/empaquetar_extension.py)

const ENDPOINT = TADA_CONFIG.URL.replace(/\/$/, '') + '/functions/v1/ingest-pedido';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.tipo === 'pedido_nuevo') {
    const datos = message.datos;
    enviar(datos)
      .then(() => guardarEnHistorial(datos))
      .catch(() => guardarEnCola(datos));
    sendResponse({ ok: true });
    return false;
  }

  if (message.tipo === 'actualizar_motorizado') {
    const { numeroPedido, motorizado } = message;
    enviar({ accion: 'actualizar_motorizado', numeroPedido, motorizado })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
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
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ingest-key': TADA_CONFIG.KEY },
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
