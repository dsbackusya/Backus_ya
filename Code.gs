// ============================================================
// CONFIG
// ============================================================
const MASTER_SHEET_ID = '1hsQBgCwgcm5rAPuVVdMnsw35X9DfC9T95mg76LCVkb4';
const SHEET_USUARIOS  = 'USUARIOS';
const TZ = 'America/Lima'; // ← zona horaria fija del negocio
const DEBUG_MODE      = false; // true solo para diagnóstico — genera logs en Apps Script > Ejecuciones

// ============================================================
// ENTRY POINT
// ============================================================
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Dark Store · Inventario')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

// ============================================================
// HASH / AUTH
// ============================================================
function sha256(text) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}
function generateSalt() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({length:32}, () => c[Math.floor(Math.random()*c.length)]).join('');
}
function hashPassword(pw, salt) { return sha256(pw + salt); }

// Rate limiting: máx 5 intentos fallidos por usuario en 15 minutos
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECS  = 15 * 60; // 15 minutos

function login(usuario, password) {
  try {
    const cache    = CacheService.getScriptCache();
    const userKey  = 'login_fail_' + sha256(String(usuario).trim().toLowerCase());
    const failsStr = cache.get(userKey);
    const fails    = failsStr ? parseInt(failsStr) : 0;
    if (fails >= LOGIN_MAX_ATTEMPTS) {
      return { ok:false, error:'Cuenta bloqueada temporalmente. Intenta en 15 minutos.' };
    }

    const data = _getUsuarios(); // usa caché interna
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[0]).trim().toLowerCase() !== String(usuario).trim().toLowerCase()) continue;
      const hash  = String(row[1]).trim();
      const salt  = String(row[2]).trim();
      const sid   = String(row[3]).trim();
      const rol   = String(row[4]).trim();
      if (hashPassword(password, salt) !== hash) {
        // Incrementar contador de fallos
        cache.put(userKey, String(fails + 1), LOGIN_WINDOW_SECS);
        const restantes = LOGIN_MAX_ATTEMPTS - (fails + 1);
        return { ok:false, error: restantes > 0
          ? 'Contraseña incorrecta. ' + restantes + ' intento(s) restante(s).'
          : 'Cuenta bloqueada temporalmente. Intenta en 15 minutos.' };
      }
      // Login exitoso: limpiar contador de fallos
      cache.remove(userKey);
      const token   = sha256(usuario + salt + Date.now() + generateSalt());
      // createdAt: tiempo absoluto del login. _session lo usa para forzar
      // re-auth tras 24h aunque el TTL deslizante esté vivo (defense in depth).
      const payload = JSON.stringify({ usuario, rol, sheetId: sid, token, createdAt: Date.now() });
      cache.put('sess_' + token, payload, SESSION_HOURS * 3600);
      return { ok:true, token, usuario, rol, sheetId: sid };
    }
    // Usuario no existe: incrementar fallos igualmente (evitar enumeración)
    cache.put(userKey, String(fails + 1), LOGIN_WINDOW_SECS);
    return { ok:false, error:'Usuario o contraseña incorrectos' };
  } catch(e) { return { ok:false, error: e.message }; }
}

// Caché de la tabla USUARIOS — evita leer Sheets en cada login (TTL 60s)
function _getUsuarios() {
  const cache = CacheService.getScriptCache();
  const key   = 'usuarios_master';
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  const data = _openSS(MASTER_SHEET_ID)
    .getSheetByName(SHEET_USUARIOS).getDataRange().getValues();
  cache.put(key, JSON.stringify(data), 300); // 5 minutos — alineado con all_stores
  return data;
}

function cerrarSesion(token) {
  try {
    const cache = CacheService.getScriptCache();
    // Leer la sesión directamente sin renovar TTL (evitar _session que hace cache.put)
    const raw = cache.get('sess_' + token);
    const sesion = raw ? JSON.parse(raw) : null;
    if (sesion && sesion.sheetId) {
      const sid = sesion.sheetId;
      cache.removeAll([
        'sess_'        + token,
        'stock_'       + sid,
        'maestro_'     + sid,
        'validacion_'  + sid,
        'mconteo_'     + sid,
        'conteo_'      + sid,
        'salidas_'     + sid,
        'entradas_'    + sid,
        'mt_'          + sid,
        'cancelados_'  + sid,
        'all_stores',
      ]);
    } else {
      cache.remove('sess_' + token);
    }
  } catch(e) {}
  return { ok:true };
}

const SESSION_HOURS = 6; // CacheService GAS tiene TTL máx de 6 horas
const SESSION_ABSOLUTE_MAX_MS = 24 * 3600 * 1000; // forzar re-auth pasadas 24h reales

// Renueva el TTL de la sesión en cada llamada autenticada.
// Esto mantiene activa la sesión mientras el usuario esté operando,
// sin necesidad de re-login salvo inactividad real de 6 horas.
// FIX: rechaza tokens con createdAt > 24h para que un token robado no viva
// indefinidamente vía pings periódicos del frontend.
function _session(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const p     = cache.get('sess_' + token);
  if (!p) return null;
  const s = JSON.parse(p);
  // Sesiones viejas (sin createdAt) las tratamos como válidas para no romper
  // a usuarios actuales; las nuevas siempre lo traen.
  if (s.createdAt && (Date.now() - s.createdAt > SESSION_ABSOLUTE_MAX_MS)) {
    cache.remove('sess_' + token);
    return null;
  }
  // Renovar TTL en cada uso — ventana deslizante de SESSION_HOURS
  cache.put('sess_' + token, p, SESSION_HOURS * 3600);
  return s;
}

function _guard(token, fn) {
  const s = _session(token);
  if (!s) return { ok:false, error:'Sesión expirada', expired:true };
  return fn(s);
}

// ============================================================
// SHEETS — LECTURA NATIVA
// ============================================================

// Caché de instancias SS por ejecución — SOLO para lectura.
// Las funciones de escritura deben llamar SpreadsheetApp.openById() directamente
// para garantizar que getLastRow() y getDataRange() reflejen el estado actual.
const _ssCache = {};
function _openSS(id) {
  if (!_ssCache[id]) _ssCache[id] = SpreadsheetApp.openById(id);
  return _ssCache[id];
}

// Lectura nativa via SpreadsheetApp — NO consume cuota de Sheets API v4.
// sheets: array de nombres de hoja, ej: ['STOCK', 'SALIDAS']
// Devuelve array de arrays de filas, una entrada por hoja.
function _batchNative(spreadsheetId, sheets) {
  const ss = _openSS(spreadsheetId);
  return sheets.map(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return []; // < 2: sin datos (solo cabecera o vacía)
    return sheet.getDataRange().getValues();
  });
}

function _parse(rows) {
  if (!rows || rows.length < 2) return [];
  const h = rows[0].map(x => String(x).trim());
  return rows.slice(1).filter(r => r.some(c => c !== '')).map(row =>
    Object.fromEntries(h.map((k, i) => [k, row[i] !== undefined ? row[i] : '']))
  );
}

// Convierte valores numéricos/notación científica a string limpio
// Usado en MCONTEO y CONTEO para normalizar EAN/SKU
function _toStr(v) {
  if (!v && v !== 0) return '';
  if (typeof v === 'number') return Math.round(v).toString();
  const s = String(v).trim();
  if (/[eE]/.test(s)) return Math.round(Number(s)).toString();
  return s.replace(/\.0+$/, '');
}

// Convierte a número tolerando coma decimal (formato peruano, ej. "1,5" → 1.5).
// Un Number() directo sobre "1,5" da NaN, y NaN contamina cualquier suma
// posterior (NaN + n = NaN) — este helper evita ese problema en todo el sistema.
// Usar SIEMPRE en vez de Number(r['Campo']||0) para columnas numéricas de Sheets.
function _num(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = Number(String(v).trim().replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Logging centralizado — visible en Apps Script > Ejecuciones
function _logError(fn, e, context) {
  console.error('[' + fn + '] ' + e.message + (context ? ' | ctx: ' + JSON.stringify(context) : ''));
}

// Devuelve las claves de caché de validación para hoy y ayer de un sheetId dado.
// Se usan para invalidar proactivamente al escribir salidas, entradas o M-T.
// FIX: no cacheamos hoy/ayer porque un trigger largo puede cruzar medianoche
// y dejar el cache obsoleto. Recalcular cuesta microsegundos.
function _validacionKeys(sid) {
  const tz    = TZ;
  const hoy   = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const ayerD = new Date(); ayerD.setDate(ayerD.getDate() - 1);
  const ayer  = Utilities.formatDate(ayerD, tz, 'yyyy-MM-dd');
  return [
    'validacion_' + sid + '_' + hoy,
    'validacion_' + sid + '_' + ayer
  ];
}

// Invalida una clave chunked (formato __n + __0..__n-1).
// Centraliza el patrón repetido en _invalidarCacheSalidas/_invalidarCacheMConteo
// y los inlines de save/delete de MBees y MConteo.
function _invalidarCacheChunked(key) {
  try {
    const cache = CacheService.getScriptCache();
    const nStr  = cache.get(key + '__n');
    if (nStr) {
      const n = parseInt(nStr);
      cache.removeAll([key + '__n'].concat(Array.from({length:n}, (_,i) => key+'__'+i)));
    }
    // formato antiguo directo (compatibilidad)
    cache.remove(key);
  } catch(_) {}
}

// Helper centralizado para invalidar caché tras cualquier escritura.
// extras: array opcional de claves adicionales (ej. ['cancelados_xxx'])
// FIX: también invalida _ssCache[sid] para evitar leer una instancia stale.
function _invalidarCacheEscritura(sid, extras) {
  delete _ssCache[sid]; // instancia GAS-side stale tras escritura
  const keys = ['stock_' + sid].concat(extras || []).concat(_validacionKeys(sid));
  CacheService.getScriptCache().removeAll(keys);
}

// ============================================================
// CACHÉ CHUNKED — evita error "Argumento demasiado grande"
// CacheService limita a 100 KB por entrada; aquí dividimos en
// chunks de 90 KB y los guardamos con claves indexadas.
// Límite: putAll acepta máx 249 claves → máx ~22 MB por entrada.
// ============================================================
const _CACHE_CHUNK_SIZE = 90000; // 90 KB por chunk
const _CACHE_MAX_CHUNKS = 248;   // 248 datos + 1 clave __n = 249 total

function _cacheSet(key, data, ttl) {
  try {
    const json   = JSON.stringify(data);
    const chunks = Math.ceil(json.length / _CACHE_CHUNK_SIZE);
    if (chunks > _CACHE_MAX_CHUNKS) {
      // Dato demasiado grande: loguear y no cachear (mejor que fallar silencioso)
      console.warn('[_cacheSet] ' + key + ' excede límite de chunks (' + chunks + '/' + _CACHE_MAX_CHUNKS + '). No se cacheará.');
      return;
    }
    const cache  = CacheService.getScriptCache();
    const pairs  = { [key + '__n']: String(chunks) };
    for (let i = 0; i < chunks; i++) {
      pairs[key + '__' + i] = json.substring(i * _CACHE_CHUNK_SIZE, (i + 1) * _CACHE_CHUNK_SIZE);
    }
    cache.putAll(pairs, ttl);
  } catch(e) {
    console.warn('[_cacheSet] Error guardando ' + key + ': ' + e.message);
  }
}

function _cacheGet(key) {
  try {
    const cache  = CacheService.getScriptCache();
    const nStr   = cache.get(key + '__n');
    if (!nStr) return null;
    const chunks = parseInt(nStr);
    const keys   = Array.from({length: chunks}, (_, i) => key + '__' + i);
    const parts  = cache.getAll(keys);
    // Verificar que todos los chunks llegaron — si falta alguno, el caché está corrupto
    const missing = keys.filter(k => !parts[k]);
    if (missing.length > 0) {
      console.warn('[_cacheGet] Chunks faltantes para ' + key + ': ' + missing.join(', ') + '. Invalidando caché.');
      // Limpiar los chunks restantes para no dejar basura
      const allKeys = [key + '__n'].concat(keys);
      try { cache.removeAll(allKeys); } catch(_) {}
      return null;
    }
    const json = keys.map(k => parts[k]).join('');
    try { return JSON.parse(json); } catch(e) {
      console.warn('[_cacheGet] JSON inválido para ' + key + ': ' + e.message);
      return null;
    }
  } catch(e) {
    console.warn('[_cacheGet] Error leyendo ' + key + ': ' + e.message);
    return null;
  }
}

function _getAllStores() {
  const cacheKey = 'all_stores';
  const cached   = _cacheGet(cacheKey); // chunked — soporta listas grandes de tiendas
  if (cached) return cached;

  const data   = _getUsuarios();
  const stores = data.slice(1)
    .filter(r => String(r[4]).trim() === 'store' && String(r[3]).trim() !== '*')
    .map(r => ({ nombre: String(r[0]).trim(), sheetId: String(r[3]).trim() }));

  _cacheSet(cacheKey, stores, 300); // 5 minutos — mismo TTL que _getUsuarios
  return stores;
}

// ============================================================
// ÓRDENES DE COMPRA — hoja externa compartida (visible a todos)
// Spreadsheet independiente al de cada tienda. Estructura fija:
// A:Orden de compra B:Cta proveedor C:Cta facturación D:Nombre proveedor
// E:Tipo compra F:Estado aprobación G:Estado OC H:Divisa
// I:Fecha recepción solicitada J:Modo entrega K:Condiciones entrega
// L:Acuerdo compra M:Entrega directa N:Subcontrato proyecto
// O:Nombre de entrega P:Estado de recepcion (col 16, agregada por nosotros)
// ============================================================
const OC_SHEET_ID    = '1pURvnNShRwO7a-ZTCbpzG6CVi9dizQGs7VS31tWhl5E';
const OC_HOJA_NOMBRE = 'ORDEN DE COMPRA';

// Lee el maestro de OC — visible para cualquier rol autenticado.
function getOrdenesCompra(token, forceRefresh) {
  return _guard(token, s => {
    try {
      const cacheKey = 'oc_maestro';
      if (forceRefresh) {
        _invalidarCacheChunked(cacheKey);
      } else {
        const cached = _cacheGet(cacheKey);
        if (cached) return { ok: true, data: cached };
      }
      const [rows] = _batchNative(OC_SHEET_ID, [OC_HOJA_NOMBRE]);
      const data = _parse(rows).map((r, i) => ({
        _row:           i + 2,
        oc:             String(r['Orden de compra'] || '').trim(),
        proveedor:      String(r['Nombre del proveedor'] || '').trim(),
        fechaRecepcion: _fmtFecha(r['Fecha de recepción solicitada']),
        entrega:        String(r['Nombre de entrega'] || '').trim(),
        estado:         String(r['Estado de recepcion'] || '').trim() || 'Pendiente'
      })).filter(r => r.oc);
      _cacheSet(cacheKey, data, 120);
      const fromCache = _cacheGet(cacheKey);
      return { ok: true, data: fromCache || data };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}

// Importa OC nuevas desde el Excel parseado en frontend.
// Omite las que ya existen (columna 1) y fuerza Estado de recepcion = "Pendiente".
function importarOC(token, filas) {
  return _guard(token, s => {
    if (!_acquireSheetLock(OC_SHEET_ID)) {
      return { ok: false, error: 'Otro usuario está escribiendo en la hoja de OC. Reintenta en unos segundos.' };
    }
    try {
      const ss   = SpreadsheetApp.openById(OC_SHEET_ID);
      const hoja = ss.getSheetByName(OC_HOJA_NOMBRE);
      if (!hoja) return { ok: false, error: 'Hoja "' + OC_HOJA_NOMBRE + '" no encontrada.' };

      const existentes = new Set(
        hoja.getLastRow() > 1
          ? hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues().map(r => String(r[0] || '').trim()).filter(Boolean)
          : []
      );

      const nuevas = [];
      let omitidas = 0;
      (filas || []).forEach(f => {
        const oc = String(f.oc || '').trim();
        if (!oc || existentes.has(oc)) { omitidas++; return; }
        existentes.add(oc);
        nuevas.push([
          oc,
          f.cuentaProveedor      || '',
          f.cuentaFacturacion    || '',
          f.proveedor            || '',
          f.tipoCompra           || '',
          f.estadoAprobacion     || '',
          f.estadoOrden          || '',
          f.divisa               || '',
          f.fechaRecepcion       || '',
          f.modoEntrega          || '',
          f.condicionesEntrega   || '',
          f.acuerdoCompra        || '',
          f.entregaDirecta       || '',
          f.subcontratoProyecto  || '',
          f.nombreEntrega        || '',
          'Pendiente'
        ]);
      });

      if (nuevas.length) {
        hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, 16).setValues(nuevas);
      }
      _invalidarCacheChunked('oc_maestro');
      return { ok: true, agregadas: nuevas.length, omitidas };
    } catch(e) {
      _logError('importarOC', e, {});
      return { ok: false, error: e.message };
    } finally { _releaseSheetLock(OC_SHEET_ID); }
  });
}

// Cruza la columna OC (col H) de ENTRADAS de TODAS las tiendas contra el
// maestro de OC. Las OC "Pendiente" que aparezcan en algún ENTRADAS pasan
// a "Recibido". Reusa el patrón paralelo de fetchAll de getStock (admin).
function validarRecepcionOC(token) {
  return _guard(token, s => {
    try {
      const stores = _getAllStores();
      if (!stores.length) return { ok: false, error: 'No hay tiendas registradas.' };

      const oauthToken = ScriptApp.getOAuthToken();
      const fetches = stores.map(st => ({
        url: 'https://sheets.googleapis.com/v4/spreadsheets/' + st.sheetId +
          '/values/ENTRADAS!H2:H?majorDimension=COLUMNS&valueRenderOption=FORMATTED_VALUE',
        headers: { Authorization: 'Bearer ' + oauthToken },
        muteHttpExceptions: true
      }));
      const results = UrlFetchApp.fetchAll(fetches);

      const ocsRecibidas = new Set();
      results.forEach((res, i) => {
        try {
          const j = JSON.parse(res.getContentText());
          if (j.error) { console.warn('[validarRecepcionOC] ' + stores[i].nombre + ': ' + j.error.message); return; }
          const col = (j.values && j.values[0]) || [];
          col.forEach(v => { const oc = String(v || '').trim(); if (oc) ocsRecibidas.add(oc); });
        } catch(e) { console.warn('[validarRecepcionOC] parse ' + stores[i].nombre + ': ' + e.message); }
      });

      if (!_acquireSheetLock(OC_SHEET_ID)) {
        return { ok: false, error: 'Otro usuario está actualizando la hoja de OC. Reintenta en unos segundos.' };
      }
      try {
        const ss   = SpreadsheetApp.openById(OC_SHEET_ID);
        const hoja = ss.getSheetByName(OC_HOJA_NOMBRE);
        if (!hoja) return { ok: false, error: 'Hoja "' + OC_HOJA_NOMBRE + '" no encontrada.' };
        if (hoja.getLastRow() < 2) return { ok: true, actualizadas: 0 };

        const rows = hoja.getRange(2, 1, hoja.getLastRow() - 1, 16).getValues();
        let actualizadas = 0;
        const nuevaColEstado = rows.map(r => {
          const oc     = String(r[0]  || '').trim();
          const estado = String(r[15] || '').trim() || 'Pendiente';
          if (estado === 'Pendiente' && oc && ocsRecibidas.has(oc)) { actualizadas++; return ['Recibido']; }
          return [estado];
        });
        if (actualizadas > 0) {
          hoja.getRange(2, 16, nuevaColEstado.length, 1).setValues(nuevaColEstado);
        }
        _invalidarCacheChunked('oc_maestro');
        return { ok: true, actualizadas };
      } finally { _releaseSheetLock(OC_SHEET_ID); }
    } catch(e) {
      _logError('validarRecepcionOC', e, {});
      return { ok: false, error: e.message };
    }
  });
}

// Cuenta cuántas OC distintas se recibieron por tienda en una fecha dada
// (columna Fecha de ENTRADAS). fecha en formato dd/MM/yyyy; vacío = hoy.
function getRecepcionesPorTienda(token, fecha) {
  return _guard(token, s => {
    try {
      const targetFecha = fecha ? _fmtFecha(fecha) : Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy');
      const stores = _getAllStores();
      if (!stores.length) return { ok: true, data: [], fecha: targetFecha };

      const oauthToken = ScriptApp.getOAuthToken();
      const fetches = stores.map(st => ({
        url: 'https://sheets.googleapis.com/v4/spreadsheets/' + st.sheetId +
          '/values/ENTRADAS!B2:H?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE',
        headers: { Authorization: 'Bearer ' + oauthToken },
        muteHttpExceptions: true
      }));
      const results = UrlFetchApp.fetchAll(fetches);

      const data = stores.map((st, i) => {
        let ocsArr = [];
        try {
          const j = JSON.parse(results[i].getContentText());
          if (j.error) {
            console.warn('[getRecepcionesPorTienda] ' + st.nombre + ': ' + j.error.message);
          } else {
            const rows   = j.values || [];
            const ocsHoy = new Set();
            rows.forEach(r => {
              const fechaFila = _fmtFecha(r[0]);
              const oc        = String(r[6] || '').trim(); // col H (OC) — B=0..H=6
              if (fechaFila === targetFecha && oc) ocsHoy.add(oc);
            });
            ocsArr = Array.from(ocsHoy).sort();
          }
        } catch(e) { console.warn('[getRecepcionesPorTienda] parse ' + st.nombre + ': ' + e.message); }
        return { nombre: st.nombre, recepciones: ocsArr.length, ocs: ocsArr };
      });

      return { ok: true, data, fecha: targetFecha };
    } catch(e) {
      _logError('getRecepcionesPorTienda', e, {});
      return { ok: false, error: e.message };
    }
  });
}

// Devuelve los ítems de ENTRADAS de una tienda específica para una OC puntual.
// La tienda se resuelve por nombre server-side (vía _getAllStores) — el frontend
// nunca envía un sheetId directo, evita exponer/aceptar IDs arbitrarios.
function getDetalleEntradaOC(token, tiendaNombre, oc) {
  return _guard(token, s => {
    try {
      const stores = _getAllStores();
      const store  = stores.find(st => st.nombre === tiendaNombre);
      if (!store) return { ok: false, error: 'Tienda no encontrada: ' + tiendaNombre };

      const ocNorm = String(oc || '').trim();
      const [rows] = _batchNative(store.sheetId, ['ENTRADAS']);
      const data = _parse(rows)
        .filter(r => String(r['OC'] || '').trim() === ocNorm)
        .map(r => ({
          tienda:      tiendaNombre,
          fecha:       _fmtFecha(r['Fecha']),
          sku:         String(r['Codigo Lovis'] || '').trim(),
          desc:        String(r['Descripción'] || '').trim(),
          unidades:    _num(r['Unidades']),
          factura:     r['Facturas']     || '',
          proveedor:   r['Proveedor']    || '',
          dynamics:    r['Dynamics']     || '',
          responsable: r['Responsable']  || ''
        }));
      return { ok: true, data, tienda: tiendaNombre, oc: ocNorm };
    } catch(e) {
      _logError('getDetalleEntradaOC', e, { tiendaNombre, oc });
      return { ok: false, error: e.message };
    }
  });
}

// Igual que getDetalleEntradaOC pero busca en TODAS las tiendas en paralelo
// (para cuando no se sabe de antemano qué tienda recibió la OC — ej. al hacer
// click en una fila de la tabla principal del dashboard de OC).
function getDetalleEntradaOCGlobal(token, oc) {
  return _guard(token, s => {
    try {
      const ocNorm = String(oc || '').trim();
      const stores = _getAllStores();
      if (!stores.length) return { ok: true, data: [], oc: ocNorm };

      const oauthToken = ScriptApp.getOAuthToken();
      const fetches = stores.map(st => ({
        url: 'https://sheets.googleapis.com/v4/spreadsheets/' + st.sheetId +
          '/values/ENTRADAS!A2:H?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE',
        headers: { Authorization: 'Bearer ' + oauthToken },
        muteHttpExceptions: true
      }));
      const results = UrlFetchApp.fetchAll(fetches);

      const data = [];
      stores.forEach((st, i) => {
        try {
          const j = JSON.parse(results[i].getContentText());
          if (j.error) { console.warn('[getDetalleEntradaOCGlobal] ' + st.nombre + ': ' + j.error.message); return; }
          const rows = j.values || [];
          rows.forEach(r => {
            // A=Facturas B=Fecha C=Codigo Lovis D=Descripción E=Unidades F=F.Vencimiento G=Proveedor H=OC
            const ocFila = String(r[7] || '').trim();
            if (ocFila !== ocNorm) return;
            data.push({
              tienda:    st.nombre,
              factura:   r[0] || '',
              fecha:     _fmtFecha(r[1]),
              sku:       String(r[2] || '').trim(),
              desc:      String(r[3] || '').trim(),
              unidades:  _num(r[4]),
              proveedor: r[6] || ''
            });
          });
        } catch(e) { console.warn('[getDetalleEntradaOCGlobal] parse ' + st.nombre + ': ' + e.message); }
      });

      return { ok: true, data, oc: ocNorm };
    } catch(e) {
      _logError('getDetalleEntradaOCGlobal', e, { oc });
      return { ok: false, error: e.message };
    }
  });
}

// Catálogo MAESTRO (propio de cada tienda, hoja "MAESTRO": Cod_Lovis | Descripción | Cod_SAP | Precio).
// Usado por Validación (costo de desvíos) y por el buscador de Reemplazar SKU masivo.
// NO confundir con el maestro de OC (hoja externa OC_SHEET_ID) — son fuentes distintas.
function getMaestroCompleto(token, forceRefresh) {
  return _guard(token, s => {
    try {
      const cacheKey = 'maestro_completo_' + s.sheetId;
      if (forceRefresh) {
        _invalidarCacheChunked(cacheKey);
      } else {
        const cached = _cacheGet(cacheKey);
        if (cached) return { ok: true, data: cached };
      }
      const [rows] = _batchNative(s.sheetId, ['MAESTRO']);
      const data = _parse(rows).map(r => {
        const lovis = _toStr(r['Cod_Lovis'] || r['COD_LOVIS'] || r['Cod Lovis'] || r['LOVIS'] || '');
        const desc = String(
          r['Descripción'] || r['Descripcion'] || r['DESCRIPCION'] ||
          r['descripción'] || r['descripcion'] || r['Desc'] || r['DESC'] || ''
        ).trim();
        const sap    = _toStr(r['Cod_SAP'] || r['COD_SAP'] || r['Cod SAP'] || r['SAP'] || '');
        const precio = Number(String(r['Precio'] || r['PRECIO'] || r['precio'] || '0').replace(',', '.')) || 0;
        return { lovis, desc, sap, precio };
      }).filter(r => r.lovis); // solo filtrar por lovis, desc puede ser vacío
      _cacheSet(cacheKey, data, 3600);
      const fromCache = _cacheGet(cacheKey);
      return { ok: true, data: fromCache || data };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}

// ============================================================
// CONTEO VICTOR — lista de SKUs desde hoja externa (solo admin)
// Spreadsheet independiente, hoja "Victor", columna Lovis/SKU.
// ============================================================
const VICTOR_SHEET_ID    = '1ZrWq8QzWKS2zaXjQDsFuK4aPOYCN5fkb3wSDl62Hj7o';
const VICTOR_HOJA_NOMBRE = 'Victor';

function getSkusVictor(token, forceRefresh) {
  return _guard(token, s => {
    if (s.rol !== 'admin') return { ok: false, error: 'No autorizado' };
    try {
      const cacheKey = 'victor_skus';
      if (forceRefresh) {
        _invalidarCacheChunked(cacheKey);
      } else {
        const cached = _cacheGet(cacheKey);
        if (cached) return { ok: true, skus: cached };
      }
      const [rows] = _batchNative(VICTOR_SHEET_ID, [VICTOR_HOJA_NOMBRE]);
      // Columna 1 (índice 0) por posición — se salta la cabecera (fila 1)
      const skus = (rows || []).slice(1)
        .map(r => _toStr(r[0]))
        .filter(Boolean);
      _cacheSet(cacheKey, skus, 300);
      return { ok: true, skus };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}

// ============================================================
// STOCK — leer con filtros, caché 60s
// ============================================================
function getStock(token, forceRefresh) {
  return _guard(token, s => {
    try {
      const sid      = s.rol === 'admin' ? null : s.sheetId;
      const cacheKey = 'stock_' + (sid || 'admin');
      if (forceRefresh) {
        CacheService.getScriptCache().remove(cacheKey + '__n');
        // Limpiar también los chunks huérfanos para no desperdiciar espacio en CacheService
        const chunkKeys = Array.from({length: _CACHE_MAX_CHUNKS}, (_, i) => cacheKey + '__' + i);
        try { CacheService.getScriptCache().removeAll([cacheKey + '__n', ...chunkKeys]); } catch(_) {}
      } else {
        const cached = _cacheGet(cacheKey);
        if (cached) return { ok:true, data: cached, usuario: s.usuario, rol: s.rol };
      }

      const parseStore = (rows) => _parse(rows).map((r, i) => ({
          _row:      i + 2,
          sku:       String(r['Lovis'] || '').trim(),
          desc:      String(r['DESCRIPCION'] || r['Descripcion'] || '').trim(),
          marca:     String(r['Marca'] || '').trim(),
          categoria: String(r['Categoria'] || '').trim(),
          entradas:  Number(r['Entradas'] || 0),
          salidas:   Number(r['Salidas']  || 0),
          mt:        Number(r['M - T']    || 0),
          stock:     _num(r['Stock actual UND']),
          stockPack: _num(r['Stock pack']),
          costo:     Number(String(r['Costo'] || '0').replace(',', '.')) || 0,
          fVenc:     r['F. Venc'] || '',
          diasVenc:  r['Dias por Vencer'] || ''
        }));

      let data;
      if (s.rol === 'admin') {
        const stores = _getAllStores();
        // fetchAll paralelo para admin multi-tienda — O(1) HTTP, sin cuota REST
        // Usa SpreadsheetApp internamente a través de _batchNative por tienda,
        // pero en paralelo vía UrlFetchApp para el endpoint interno de GAS.
        // Fallback: si hay 1 sola tienda, lectura directa.
        if (stores.length === 0) {
          data = [];
        } else if (stores.length === 1) {
          const [rows] = _batchNative(stores[0].sheetId, ['STOCK']);
          data = parseStore(rows).map(r => ({ ...r, sede: stores[0].nombre, sheetId: stores[0].sheetId }));
        } else {
          // Paralelo nativo: abrir cada SS en paralelo con fetchAll sobre la API interna
          const oauthToken = ScriptApp.getOAuthToken();
          const fetches = stores.map(st => ({
            url: 'https://sheets.googleapis.com/v4/spreadsheets/' + st.sheetId +
              '/values/STOCK' +
              '?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE',
            headers: { Authorization: 'Bearer ' + oauthToken },
            muteHttpExceptions: true
          }));
          const results = UrlFetchApp.fetchAll(fetches);
          data = stores.flatMap((st, i) => {
            const j = JSON.parse(results[i].getContentText());
            if (j.error) { console.warn('[getStock admin] ' + st.nombre + ': ' + j.error.message); return []; }
            const rows = j.values || [];
            return parseStore(rows).map(r => ({ ...r, sede: st.nombre, sheetId: st.sheetId }));
          });
        }
      } else {
        const [rows] = _batchNative(sid, ['STOCK']);
        data = parseStore(rows);
      }

      _cacheSet(cacheKey, data, 300); // 5 min — reducir llamadas a Sheets API
      return { ok:true, data, usuario: s.usuario, rol: s.rol };
    } catch(e) { return { ok:false, error: e.message }; }
  });
}

// ============================================================
// HELPER — formatear fecha seguro desde Sheets API v4
// Sheets v4 devuelve fechas como strings "MM/DD/YYYY" o "YYYY-MM-DD"
// o como número serial de Excel — hay que normalizar todo.
// ============================================================
// Normaliza fecha raw → string 'dd/MM/yyyy' (para comparar con Utilities.formatDate)
// Usado en getValidacion y eliminarConteoPorSKU.
// Optimización: usa JS puro en lugar de Utilities.formatDate — evita llamadas GAS API en loops masivos.
function _normFecha(raw, tz) {
  // Siempre usar Utilities.formatDate con TZ explícita — getDate() es UTC y desfasa 1 día
  return _fmtFechaConTZ(raw, tz || TZ);
}

// _fmtFechaConTZ: versión canónica con tz opcional.
// Pasar tz en loops para evitar llamadas repetidas a TZ.
// _fmtFecha es un alias de conveniencia para llamadas puntuales.
function _fmtFechaConTZ(raw, tz) {
  if (!raw) return '';
  const zone = tz || TZ;

  // Caso 1: número serial de Sheets (días desde 30/12/1899)
  if (typeof raw === 'number') {
    const date = new Date((raw - 25569) * 86400 * 1000);
    return Utilities.formatDate(date, zone, 'dd/MM/yyyy');
  }

  // Caso 2: objeto Date nativo de GAS
  if (raw instanceof Date) {
    return Utilities.formatDate(raw, zone, 'dd/MM/yyyy');
  }

  const str = String(raw).trim();
  if (!str) return '';

  // Caso 3: string en formato d/MM/yyyy o dd/MM/yyyy (peruano) — parsear manualmente
  // CRÍTICO: new Date('1/05/2026') en JS lee como MM/DD/YYYY → enero 5, incorrecto
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const d2 = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
    return Utilities.formatDate(d2, zone, 'dd/MM/yyyy');
  }

  // Caso 4: otros formatos — intentar parseo genérico (ISO, etc.)
  const d = new Date(str);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, zone, 'dd/MM/yyyy');

  return str; // no parseable — devolver tal cual
}
function _fmtFecha(raw) { return _fmtFechaConTZ(raw, null); }


function _fmtHora(raw) {
  if (!raw) return '';
  // Caso 1: objeto Date (Sheets devuelve horas como Date con base 30/12/1899)
  if (raw instanceof Date) {
    const h = raw.getHours().toString().padStart(2,'0');
    const m = raw.getMinutes().toString().padStart(2,'0');
    return h + ':' + m;
  }
  const str = String(raw).trim();
  // Caso 2: fraccion decimal de dia (ej: 0.604 = 14:30)
  if (!isNaN(Number(str)) && Number(str) >= 0 && Number(str) < 1) {
    const secs = Math.round(Number(str) * 86400);
    const h = Math.floor(secs / 3600).toString().padStart(2,'0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2,'0');
    return h + ':' + m;
  }
  // Caso 3: cualquier string — extraer patron HH:MM con regex
  const match = str.match(/(\d{1,2}:\d{2})/);
  if (match) return match[1].padStart(5, '0');
  return str.substring(0, 5);
}


// ============================================================
// SALIDAS — leer / registrar / editar / eliminar
// ============================================================
function getSalidas(token, forceRefresh) {
  return _guard(token, s => {
    try {
      const cacheKey = 'salidas_' + s.sheetId;
      if (!forceRefresh) {
        const cached = _cacheGet(cacheKey);
        // Si el caché es versión vieja (sin hoyStr), descartarlo
        if (cached && cached.__hoyStr) return { ok:true, data: cached.__data, hoyStr: cached.__hoyStr };
        // cached existe pero es viejo — lo ignoramos y releemos
      }

      // openById directo — NO usar _openSS (cachea instancia y no ve filas nuevas del día)
      const hoja   = SpreadsheetApp.openById(s.sheetId).getSheetByName('SALIDAS');
      const maxRow = hoja.getLastRow(); // getLastRow refleja filas reales escritas hoy
      if (maxRow < 2) return { ok:true, data:[] };
      const tz     = TZ;
      const values  = hoja.getRange(2, 1, maxRow - 1, 13).getValues();
      // getDisplayValues para cols con fórmula: Hora(B), Envases(J), Estado(K)
      const display = hoja.getRange(2, 1, maxRow - 1, 13).getDisplayValues();
      const data   = values.map((r, i) => {
        const dispHora    = (display[i][1]  || '').trim(); // col B
        const horaMatch   = dispHora.match(/(\d{1,2}:\d{2})/);
        const dispEnvases = String(display[i][9]  || '').trim(); // col J
        const dispEstado  = String(display[i][10] || '').trim(); // col K — fórmula
        const dispRevision= String(display[i][11] || '').trim(); // col L
        const dispTamano  = String(display[i][12] || '').trim(); // col M — TAMAÑO
        return {
          _row:      i + 2,
          fecha:     _fmtFechaConTZ(r[0], tz),
          hora:      horaMatch ? horaMatch[1].padStart(5, '0') : _fmtHora(r[1]),
          sku:       String(r[2] || '').trim(),
          nroPedido: String(r[3] || '').trim(),
          desc:      String(r[4] || '').trim(),
          pack:      Number(r[5] || 0),
          unidad:    Number(r[6] || 0),
          marca:     String(r[7] || '').trim(),
          motorizado:String(r[8] || '').trim(),
          envases:   dispEnvases,
          estado:    dispEstado,   // Pendiente / Entregado — lo calcula la fórmula
          revision:  dispRevision, // vacío o 'Entregado' — solo esto escribe el backend
          tamano:    dispTamano    // 310 / 630 / 1000 — col M TAMAÑO
        };
      }).filter(r => r.sku); // ignorar filas vacías (incluyendo las del "hueco")

      const hoyStr = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy');

      _cacheSet(cacheKey, { __data: data, __hoyStr: hoyStr }, 60);
      return { ok:true, data, hoyStr };
    } catch(e) { return { ok:false, error: e.message }; }
  });
}

function registrarSalida(token, fila) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId)) {
      return { ok: false, error: 'Otro usuario está escribiendo en esta hoja. Reintenta en unos segundos.' };
    }
    try {
      const pack   = parseInt(fila.pack,   10);
      const unidad = parseInt(fila.unidad, 10);
      const sku    = String(fila.sku || '').trim();
      if (!sku)                 return { ok: false, error: 'SKU es obligatorio' };
      if (isNaN(pack)   || pack   < 0) return { ok: false, error: 'Pack inválido' };
      if (isNaN(unidad) || unidad < 0) return { ok: false, error: 'Unidades inválidas' };
      const hoja  = SpreadsheetApp.openById(s.sheetId).getSheetByName('SALIDAS');
      const fecha = new Date();
      const hora  = Utilities.formatDate(fecha, TZ, 'HH:mm:ss');
      const lastRow = hoja.getLastRow(); // leer dentro del lock — evita race condition
      hoja.getRange(lastRow + 1, 1, 1, 10).setValues([[
        fecha, hora, sku, fila.nroPedido || '', fila.desc,
        pack, unidad, fila.marca || '', fila.motorizado || '', fila.envases || ''
      ]]);
      const newRow = lastRow + 1;
      _invalidarCacheEscritura(s.sheetId, ['salidas_' + s.sheetId]);
      return { ok:true, inserted: {
        _row:      newRow,
        fecha:     _fmtFecha(fecha),
        hora:      hora,
        sku:       sku,
        nroPedido: String(fila.nroPedido || '').trim(),
        desc:      String(fila.desc      || '').trim(),
        pack,
        unidad,
        marca:     String(fila.marca     || '').trim(),
        motorizado:String(fila.motorizado|| '').trim(),
        envases:   fila.envases !== undefined ? fila.envases : ''
      }};
    } catch(e) {
      _logError('registrarSalida', e, {sku: fila.sku});
      return { ok:false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId);
    }
  });
}

function editarSalida(token, rowNum, fila) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId)) {
      return { ok: false, error: 'Otro usuario está escribiendo en esta hoja. Reintenta en unos segundos.' };
    }
    try {
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('SALIDAS');
      hoja.getRange(rowNum, 3, 1, 8).setValues([[
        fila.sku, fila.nroPedido || '', fila.desc,
        fila.pack, fila.unidad, fila.marca || '', fila.motorizado || '', fila.envases || ''
      ]]);
      _invalidarCacheEscritura(s.sheetId, ['salidas_' + s.sheetId]);
      return { ok:true };
    } catch(e) {
      _logError('editarSalida', e, {rowNum, sku: fila.sku});
      return { ok:false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId);
    }
  });
}

// Cancela un pedido completo buscando por nroPedido directamente en la hoja.
// Ya no depende de rowNum para encontrar las filas — solo lo usa como hint
// para obtener el nroPedido si expectedNroPedido no viene.
// Esto elimina el error "stale" causado por _row desactualizado en caché.
// Marca una fila de SALIDAS como entregada escribiendo 'Entregado' en col REVISION (L).
// ESTADO (col K) es fórmula — Sheets lo recalcula solo. El backend NUNCA toca col K.
function marcarEntregado(token, rowNum) {
  return _guard(token, s => {
    try {
      if (!rowNum || rowNum < 2) return { ok: false, error: 'Fila inválida' };
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('SALIDAS');
      if (!hoja) throw new Error('Hoja SALIDAS no encontrada');
      // Verificar que la fila no esté ya confirmada
      const actual = hoja.getRange(rowNum, 12).getValue();
      if (String(actual).trim() === 'Entregado') return { ok: true, yaConfirmado: true };
      // Escribir solo en col 12 (REVISION) — col 11 (ESTADO) la maneja la fórmula
      hoja.getRange(rowNum, 12).setValue('Entregado');
      _invalidarCacheEscritura(s.sheetId, ['salidas_' + s.sheetId]);
      return { ok: true };
    } catch(e) {
      _logError('marcarEntregado', e, { rowNum });
      return { ok: false, error: e.message };
    }
  });
}

function cancelarSalida(token, rowNum, modo, expectedNroPedido, motivo) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId)) {
      return { ok: false, error: 'Otro usuario está modificando esta hoja. Reintenta en unos segundos.' };
    }
    try {
      const ss          = SpreadsheetApp.openById(s.sheetId);
      const hSalidas    = ss.getSheetByName('SALIDAS');
      const hCancelados = ss.getSheetByName('PD CANCELADOS');
      if (!hCancelados) throw new Error('Hoja PD CANCELADOS no encontrada');

      // Asegurar encabezado de la columna MOTIVO (col 13) en PD CANCELADOS
      const MOTIVO_COL = 13;
      if (String(hCancelados.getRange(1, MOTIVO_COL).getValue()).trim() !== 'MOTIVO') {
        hCancelados.getRange(1, MOTIVO_COL).setValue('MOTIVO');
      }
      const motivoFinal = String(motivo || '').trim();

      const last = hSalidas.getLastRow();
      if (last < 2) return { ok: false, error: 'No hay salidas registradas.' };
      
      const NCOLS = 12;
      const values = hSalidas.getRange(2, 1, last - 1, NCOLS).getValues();

      let nroACancelar = String(expectedNroPedido || '').trim();
      if (!nroACancelar && rowNum >= 2) {
        const hint = values[rowNum - 2];
        if (hint) nroACancelar = String(hint[3] || '').trim();
      }

      const toCancelIndexes = [];
      if (nroACancelar) {
        values.forEach((r, i) => {
          if (String(r[3] || '').trim() === nroACancelar) toCancelIndexes.push(i);
        });
      } else {
        if (rowNum >= 2 && values[rowNum - 2]) toCancelIndexes.push(rowNum - 2);
      }

      if (!toCancelIndexes.length) {
        return { ok: false, error: 'No se encontraron filas para el pedido "' + (nroACancelar || rowNum) + '". Es posible que ya haya sido cancelado.', stale: true };
      }

      const displayCanc = hSalidas.getRange(2, 1, last - 1, NCOLS).getDisplayValues();
      const cancelRows = toCancelIndexes.map(i => {
        const d = displayCanc[i];
        const v = values[i];
        return [v[0], v[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[10], d[11], motivoFinal];
      });
      const lastCanc = hCancelados.getLastRow();
      hCancelados.getRange(lastCanc + 1, 1, cancelRows.length, 13).setValues(cancelRows);

      const rowsToDelete = toCancelIndexes.map(i => i + 2);
      
      rowsToDelete.sort((a, b) => b - a);

      rowsToDelete.forEach(row => {
        hSalidas.deleteRow(row);
      });

      _invalidarCacheEscritura(s.sheetId, ['salidas_' + s.sheetId, 'cancelados_' + s.sheetId]);
      return { ok: true, cancelados: toCancelIndexes.length, nroPedido: nroACancelar };
    } catch(e) {
      _logError('cancelarSalida', e, {rowNum, modo});
      return { ok: false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId);
    }
  });
}

// ============================================================
// CANCELADOS — solo lectura
// ============================================================
function getCancelados(token, forceRefresh) {
  return _guard(token, s => {
    try {
      const ss   = SpreadsheetApp.openById(s.sheetId);
      const hoja = ss.getSheetByName('PD CANCELADOS');
      if (!hoja) {
        return { ok:false, error:'Hoja PD CANCELADOS no encontrada' };
      }
      const lastRow = hoja.getLastRow();
      if (lastRow < 2) return { ok:true, data:[], total:0 };

      const MAX_ROWS = 500;
      const startRow = Math.max(2, lastRow - MAX_ROWS + 1);
      const numRows  = lastRow - startRow + 1;
      const numCols  = hoja.getLastColumn();
      const header   = hoja.getRange(1, 1, 1, numCols).getValues()[0];
      const body     = hoja.getRange(startRow, 1, numRows, numCols).getValues();

      // Construir data como array de primitivos puros — sin fechas GAS, sin objetos
      var data = [];
      for (var i = 0; i < body.length; i++) {
        var row = body[i];
        var rowObj = {};
        for (var j = 0; j < header.length; j++) {
          rowObj[header[j]] = (row[j] === null || row[j] === undefined) ? '' : row[j];
        }
        data.push({
          _row:       startRow + i,
          fecha:      _fmtFecha(rowObj['Fecha']),
          hora:       _fmtHora(rowObj['Hora']),
          sku:        String(rowObj['SKU'] || '').trim(),
          nroPedido:  String(rowObj['NRO PEDIDO'] || '').trim(),
          desc:       String(rowObj['DESCRIPCION'] || '').trim(),
          pack:       Number(rowObj['PACK']  || 0),
          unidad:     Number(rowObj['UNIDAD']|| 0),
          marca:      String(rowObj['MARCA']      || '').trim(),
          motorizado: String(rowObj['MOTORIZADO'] || '').trim(),
          envases:    (rowObj['ENVASES'] !== '' && rowObj['ENVASES'] != null) ? Number(rowObj['ENVASES']) : '',
          estado:     String(rowObj['ESTADO']  || '').trim(),
          revision:   String(rowObj['REVISION']|| '').trim(),
          motivo:     String(rowObj['MOTIVO']  || '').trim()
        });
      }

      // Serializar y deserializar para garantizar que es JSON puro
      var safeData = JSON.parse(JSON.stringify(data));
      return { ok:true, data:safeData, total: lastRow - 1 };
    } catch(e) {
      _logError('getCancelados', e);
      return { ok:false, error: String(e.message) };
    }
  });
}

// ============================================================
// ENTRADAS — leer / registrar
// ============================================================
function getEntradas(token, forceRefresh) {
  return _guard(token, s => {
    try {
      const cacheKey = 'entradas_' + s.sheetId;
      // Con forceRefresh: invalidar caché y reconstruirlo, luego leer DESDE el caché.
      // Esto evita retornar el payload directamente (límite ~10MB de google.script.run)
      // ya que _cacheGet ensambla los chunks sin ese límite.
      if (forceRefresh) {
        const [rows] = _batchNative(s.sheetId, ['ENTRADAS']);
        const data = _parse(rows).map((r, i) => ({
          _row:      i + 2,
          factura:   r['Facturas']       || '',
          fecha:     _fmtFecha(r['Fecha']),
          sku:       String(r['Codigo Lovis'] || '').trim(),
          desc:      String(r['Descripción'] || '').trim(),
          unidades:  Number(r['Unidades'] || 0),
          fVenc:     r['F. Vencimiento'] || '',
          proveedor: r['Proveedor']      || '',
          oc:        r['OC']             || '',
          dynamics:  r['Dynamics']       || '',
          responsable: r['Responsable']  || ''
        }));
        _cacheSet(cacheKey, data, 300); // reconstruir caché
        // Leer desde el caché recién construido — evita el límite de payload de GAS
        const fromCache = _cacheGet(cacheKey);
        return { ok:true, data: fromCache || data };
      }
      const cached = _cacheGet(cacheKey);
      if (cached) return { ok:true, data: cached };
      // Primera carga sin caché
      const [rows] = _batchNative(s.sheetId, ['ENTRADAS']);
      const data   = _parse(rows).map((r, i) => ({
        _row:      i + 2,
        factura:   r['Facturas']       || '',
        fecha:     _fmtFecha(r['Fecha']),
        sku:       String(r['Codigo Lovis'] || '').trim(),
        desc:      String(r['Descripción'] || '').trim(),
        unidades:  Number(r['Unidades'] || 0),
        fVenc:     r['F. Vencimiento'] || '',
        proveedor: r['Proveedor']      || '',
        oc:        r['OC']             || '',
        dynamics:  r['Dynamics']       || '',
        responsable: r['Responsable']  || ''
      }));
      _cacheSet(cacheKey, data, 300);
      const fromCache2 = _cacheGet(cacheKey);
      return { ok:true, data: fromCache2 || data };
    } catch(e) { return { ok:false, error: e.message }; }
  });
}

// Registra múltiples SKUs con datos comunes (factura, proveedor, OC, etc.)
// filas: [{sku, desc, unidades}]
// comun: {factura, proveedor, oc, fVenc, dynamics, responsable}
function registrarEntradasMultiple(token, filas, comun) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId)) {
      return { ok: false, error: 'Otro usuario está escribiendo en esta hoja. Reintenta en unos segundos.' };
    }
    try {
      const ss   = SpreadsheetApp.openById(s.sheetId);
      const hoja = ss.getSheetByName('ENTRADAS');
      const fecha = new Date();
      // Validar y normalizar filas antes de escribir
      const rowsValidadas = [];
      for (let i = 0; i < filas.length; i++) {
        const f   = filas[i];
        const sku = String(f.sku || '').trim();
        const und = parseInt(f.unidades, 10);
        if (!sku)               return { ok: false, error: 'SKU vacío en fila ' + (i + 1) };
        if (isNaN(und) || und < 0) return { ok: false, error: 'Unidades inválidas en fila ' + (i + 1) };
        rowsValidadas.push([
          comun.factura    || '',
          fecha,
          sku,
          f.desc           || '',
          und,
          comun.fVenc      || '',
          comun.proveedor  || '',
          comun.oc         || '',
          comun.dynamics   || '',
          comun.responsable|| ''
        ]);
      }
      // Releer lastRow dentro del lock para evitar race condition (aplica a 1 o N filas)
      const lastRow = hoja.getLastRow();
      hoja.getRange(lastRow + 1, 1, rowsValidadas.length, rowsValidadas[0].length).setValues(rowsValidadas);
      _invalidarCacheEscritura(s.sheetId, ['entradas_' + s.sheetId]);
      return { ok:true, registrados: rowsValidadas.length };
    } catch(e) {
      _logError('registrarEntradasMultiple', e, {factura: comun.factura});
      return { ok:false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId);
    }
  });
}

// Edita la columna Dynamics (col I = 9) en TODAS las filas que compartan la misma OC
function editarDynamicsEntrada(token, rowNum, dynamics) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId)) {
      return { ok: false, error: 'Otro usuario está escribiendo en esta hoja. Reintenta en unos segundos.' };
    }
    try {
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('ENTRADAS');
      if (!hoja) return { ok: false, error: 'Hoja ENTRADAS no encontrada' };
      const lastRow = hoja.getLastRow();
      if (lastRow < 2) return { ok: true, actualizados: 0 };

      // Leer col H (OC=8) y col I (Dynamics=9) de todas las filas
      const ocCol  = hoja.getRange(2, 8, lastRow - 1, 1).getValues(); // col H
      const dynCol = hoja.getRange(2, 9, lastRow - 1, 1).getValues(); // col I (actual)
      // Obtener la OC de la fila de referencia
      const ocRef  = String(ocCol[rowNum - 2][0] || '').trim();
      const nuevoVal = String(dynamics || '').trim();

      // FIX: batch write — escribir toda la col I de una sola vez en lugar de N llamadas
      let actualizados = 0;
      const nuevaColI = ocCol.map(function(r, i){
        if (String(r[0] || '').trim() === ocRef) { actualizados++; return [nuevoVal]; }
        return dynCol[i];
      });
      if (actualizados > 0) {
        hoja.getRange(2, 9, lastRow - 1, 1).setValues(nuevaColI);
      }

      _invalidarCacheEscritura(s.sheetId, ['entradas_' + s.sheetId]);
      return { ok: true, actualizados: actualizados, oc: ocRef };
    } catch(e) {
      _logError('editarDynamicsEntrada', e, { rowNum });
      return { ok: false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId);
    }
  });
}

// ============================================================
// M-T — leer / registrar (merma o traslado)
// ============================================================
function getMT(token, forceRefresh) {
  return _guard(token, s => {
    try {
      const cacheKey = 'mt_' + s.sheetId;
      if (!forceRefresh) {
        const cached = _cacheGet(cacheKey);
        if (cached) return { ok:true, data: cached };
      }
      const [rows] = _batchNative(s.sheetId, ['M-T']);
      const data   = _parse(rows).map((r, i) => ({
        _row:        i + 2,
        fecha:       _fmtFecha(r['FECHA']),
        sku:         String(r['LOVIS'] || '').trim(),
        desc:        String(r['DESCRIPCION'] || '').trim(),
        cant:        Number(r['CANTIDAD (unidades)'] || 0),
        tipo:        r['M / T']  || '',
        motivo:      r['MOTIVO'] || '',
        obs:         r['Observaciones'] || '',
        estado:      String(r['Estado'] || '').trim(),
        nroFactura:  String(r['Nro de factura'] || '').trim(),
        fechaRetiro: _fmtFecha(r['Fecha del retiro']),
        costo:       Number(String(r['COSTO'] || '0').replace(',', '.')) || 0
      }));
      _cacheSet(cacheKey, data, 300);
      // Retornar desde caché para evitar límite de payload de google.script.run
      const fromCache = _cacheGet(cacheKey);
      return { ok:true, data: fromCache || data };
    } catch(e) { return { ok:false, error: e.message }; }
  });
}

function registrarMT(token, fila) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId)) {
      return { ok: false, error: 'Otro usuario está escribiendo en esta hoja. Reintenta en unos segundos.' };
    }
    try {
      const cant = parseInt(fila.cant, 10);
      const sku  = String(fila.sku || '').trim();
      const tipo = String(fila.tipo || '').trim();
      if (!sku)                    return { ok: false, error: 'SKU es obligatorio' };
      if (!tipo)                   return { ok: false, error: 'Tipo es obligatorio' };
      if (isNaN(cant) || cant < 0) return { ok: false, error: 'Cantidad inválida' };
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('M-T');
      const lastRow = hoja.getLastRow();
      // Col 8 (Estado) tiene fórmula — se deja vacía al insertar; cols 9 y 10 vacías por defecto
      hoja.getRange(lastRow + 1, 1, 1, 7).setValues([[new Date(), sku, fila.desc, cant, tipo, fila.motivo || '', fila.obs || '']]);
      _invalidarCacheEscritura(s.sheetId, ['mt_' + s.sheetId]);
      return { ok:true };
    } catch(e) {
      _logError('registrarMT', e, {sku: fila.sku});
      return { ok:false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId);
    }
  });
}

function editarMT(token, rowNum, fila) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId)) {
      return { ok: false, error: 'Otro usuario está escribiendo en esta hoja. Reintenta en unos segundos.' };
    }
    try {
      const cant = parseInt(fila.cant, 10);
      const sku  = String(fila.sku || '').trim();
      const tipo = String(fila.tipo || '').trim();
      if (!sku)                    return { ok: false, error: 'SKU es obligatorio' };
      if (!tipo)                   return { ok: false, error: 'Tipo es obligatorio' };
      if (isNaN(cant) || cant < 0) return { ok: false, error: 'Cantidad inválida' };
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('M-T');
      if (!hoja) return { ok: false, error: 'Hoja M-T no encontrada' };
      const row = Number(rowNum);
      // Preservar la fecha original del registro — leer col 1 antes de escribir
      const fechaOriginal = hoja.getRange(row, 1).getValue();
      hoja.getRange(row, 1, 1, 7).setValues([[
        fechaOriginal, sku, fila.desc || '', cant, tipo, fila.motivo || '', fila.obs || ''
      ]]);
      // Col 9 (Nro de factura)
      hoja.getRange(row, 9).setValue(fila.nroFactura || '');
      // Col 10 (Fecha del retiro) — parsear yyyy-MM-dd o dd/MM/yyyy
      const fechaRetiroRaw = fila.fechaRetiro || '';
      if (fechaRetiroRaw) {
        const isoMatch = fechaRetiroRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const dmyMatch = fechaRetiroRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (isoMatch) {
          hoja.getRange(row, 10).setValue(new Date(Number(isoMatch[1]), Number(isoMatch[2])-1, Number(isoMatch[3])));
        } else if (dmyMatch) {
          hoja.getRange(row, 10).setValue(new Date(Number(dmyMatch[3]), Number(dmyMatch[2])-1, Number(dmyMatch[1])));
        } else {
          hoja.getRange(row, 10).setValue(fechaRetiroRaw);
        }
      } else {
        hoja.getRange(row, 10).setValue('');
      }
      _invalidarCacheEscritura(s.sheetId, ['mt_' + s.sheetId]);
      return { ok: true };
    } catch(e) {
      _logError('editarMT', e, { rowNum, sku: fila.sku });
      return { ok: false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId);
    }
  });
}

function eliminarMT(token, rowNum) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId)) {
      return { ok: false, error: 'Otro usuario está escribiendo en esta hoja. Reintenta en unos segundos.' };
    }
    try {
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('M-T');
      if (!hoja) return { ok: false, error: 'Hoja M-T no encontrada' };
      hoja.deleteRow(Number(rowNum));
      _invalidarCacheEscritura(s.sheetId, ['mt_' + s.sheetId]);
      return { ok: true };
    } catch(e) {
      _logError('eliminarMT', e, { rowNum });
      return { ok: false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId);
    }
  });
}

// ============================================================
// STOCK — registrar / editar SKU (solo columnas sin fórmula: A-D)
// Las columnas E-K (Entradas, Salidas, M-T, Stock, F.Venc, etc.)
// tienen fórmulas — no se tocan.
// ============================================================
function registrarSKU(token, fila) {
  return _guard(token, s => {
    const sid = fila.sheetId || s.sheetId; // admin puede pasar sheetId de la tienda destino
    if (!_acquireSheetLock(sid)) {
      return { ok: false, error: 'Otro usuario está escribiendo. Reintenta.' };
    }
    try {
      const hoja = SpreadsheetApp.openById(sid).getSheetByName('STOCK');
      if (!hoja) throw new Error('Hoja STOCK no encontrada');
      const sku = String(fila.sku || '').trim();
      if (!sku) return { ok: false, error: 'SKU obligatorio' };

      // Anti-duplicado: leer col A (Lovis) y bloquear si ya existe
      const lastRow = hoja.getLastRow();
      if (lastRow >= 2) {
        const existentes = hoja.getRange(2, 1, lastRow - 1, 1).getValues();
        const yaExiste = existentes.some(r => String(r[0]).trim() === sku);
        if (yaExiste) return { ok: false, error: 'El SKU "' + sku + '" ya existe en STOCK.' };
      }

      // Solo A-D: Lovis | DESCRIPCION | Marca | Categoria
      // setValues es más rápido y predecible que appendRow (no recalcula fórmulas completas)
      hoja.getRange(lastRow + 1, 1, 1, 4).setValues([[
        sku,
        String(fila.desc || '').trim(),
        String(fila.marca|| '').trim(),
        String(fila.categoria || '').trim()
      ]]);
      _invalidarCacheEscritura(sid, ['maestro_' + sid, 'stock_admin']);
      return { ok: true };
    } catch(e) { _logError('registrarSKU', e, {sku: fila.sku}); return { ok: false, error: e.message }; }
    finally { _releaseSheetLock(sid); }
  });
}

function editarSKU(token, rowNum, fila) {
  return _guard(token, s => {
    const sid = fila.sheetId || s.sheetId;
    if (!_acquireSheetLock(sid)) {
      return { ok: false, error: 'Otro usuario está escribiendo. Reintenta.' };
    }
    try {
      const hoja = SpreadsheetApp.openById(sid).getSheetByName('STOCK');
      if (!hoja) throw new Error('Hoja STOCK no encontrada');
      // setValues solo en A-D (columnas 1-4) — las fórmulas de E en adelante no se tocan
      hoja.getRange(rowNum, 1, 1, 4).setValues([[
        String(fila.sku  || '').trim(),
        String(fila.desc || '').trim(),
        String(fila.marca|| '').trim(),
        String(fila.categoria || '').trim()
      ]]);
      _invalidarCacheEscritura(sid, ['maestro_' + sid, 'stock_admin']);
      return { ok: true };
    } catch(e) { _logError('editarSKU', e, {rowNum, sku: fila.sku}); return { ok: false, error: e.message }; }
    finally { _releaseSheetLock(sid); }
  });
}

// ============================================================
// BUSCAR SKU (para autocompletar en formularios)
// ============================================================
function buscarSKU(token, query) {
  return _guard(token, s => {
    try {
      const cacheKey = 'maestro_' + s.sheetId;
      let   maestro;
      const cached = _cacheGet(cacheKey);
      if (cached) {
        maestro = cached;
      } else {
        const [rows] = _batchNative(s.sheetId, ['STOCK']);
        maestro = _parse(rows).map(r => ({
          sku:  String(r['Lovis'] || '').trim(),
          desc: String(r['DESCRIPCION'] || r['Descripcion'] || '').trim(),
          marca: String(r['Marca'] || '').trim()
        })).filter(r => r.sku);
        _cacheSet(cacheKey, maestro, 3600);
      }
      const q = query.toLowerCase();
      return {
        ok:true,
        results: maestro.filter(r =>
          r.sku.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
        ).slice(0, 10)
      };
    } catch(e) { return { ok:false, error: e.message }; }
  });
}

// ============================================================
// CONTEO
// ============================================================

// Helper interno: obtiene/cachea el maestro MCONTEO del sheetId.
// Retorna { data, byEan, bySku } — Maps para búsqueda O(1) en lugar de .find() O(n).
function _getMConteo(sheetId) {
  const cacheKey = 'mconteo_' + sheetId;
  const cached   = _cacheGet(cacheKey);
  if (cached) {
    const byEan = new Map(cached.map(r => [r.ean, r]));
    const bySku = new Map(cached.map(r => [r.sku.toLowerCase(), r]));
    return { data: cached, byEan, bySku };
  }
  // Solo leemos MCONTEO; el stock se cruza en frontend desde DATA.stock (siempre fresco)
  const [rowsMC] = _batchNative(sheetId, ['MCONTEO']);

  const data = _parse(rowsMC).map(r => ({
    ean:           _toStr(r['EAN']),
    sku:           _toStr(r['DYNAMICS']),
    sap:           _toStr(r['SAP']),
    producto:      String(r['PRODUCTO'] || '').trim(),
    multiplicador: Number(r['MULTIPLICADOR'] || 1)
  })).filter(r => r.ean && r.sku);

  _cacheSet(cacheKey, data, 3600);
  const byEan = new Map(data.map(r => [r.ean, r]));
  const bySku = new Map(data.map(r => [r.sku.toLowerCase(), r]));
  return { data, byEan, bySku };
}

// Devuelve el catálogo MCONTEO completo al frontend para resolución local.
// El frontend lo cachea en memoria — elimina una llamada al servidor por cada escaneo.
function getMConteo(token, forceRefresh) {
  return _guard(token, s => {
    try {
      if (forceRefresh) {
        // Invalidar caché del servidor antes de releer
        _invalidarCacheChunked('mconteo_' + s.sheetId);
      }
      const result = _getMConteo(s.sheetId);
      // Retornar desde caché reconstruido para evitar límite de payload de GAS
      const fromCache = _cacheGet('mconteo_' + s.sheetId);
      return { ok: true, data: fromCache || result.data };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}

function buscarEAN(token, ean) {
  return _guard(token, s => {
    try {
      const rawQ  = String(ean).trim();
      const normQ = /[eE]/.test(rawQ) ? Math.round(Number(rawQ)).toString() : rawQ.replace(/\.0+$/, '');
      const found = _getMConteo(s.sheetId).byEan.get(normQ); // O(1)
      if (!found) return { ok: false, error: 'EAN ' + normQ + ' no encontrado en MCONTEO' };
      return { ok: true, ean: found.ean, sku: found.sku, sap: found.sap, producto: found.producto, multiplicador: found.multiplicador, stock: found.stock };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}

// Busca en MCONTEO por SKU (para autocompletar conteo cuando no hay EAN)
function buscarSKUConteo(token, sku) {
  return _guard(token, s => {
    try {
      const skuNorm = String(sku).trim().toLowerCase();
      const found   = _getMConteo(s.sheetId).bySku.get(skuNorm); // O(1)
      if (!found) return { ok: false, error: 'SKU ' + sku + ' no encontrado en MCONTEO' };
      return { ok: true, ean: found.ean, sku: found.sku, sap: found.sap, producto: found.producto, multiplicador: found.multiplicador, stock: found.stock };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}


function getConteo(token, diasAtras, forceRefresh) {
  return _guard(token, s => {
    try {
      const dias      = Number(diasAtras) || 7; // por defecto últimos 7 días
      const cacheKey  = 'conteo_' + s.sheetId + '_d' + dias;
      if (!forceRefresh) {
        const cached = _cacheGet(cacheKey);
        if (cached) return { ok: true, data: cached };
      }

      const [rows] = _batchNative(s.sheetId, ['CONTEO']);
      const tz     = TZ;

      // Corte: solo filas dentro de la ventana de días
      const corte = new Date();
      corte.setDate(corte.getDate() - dias);
      corte.setHours(0, 0, 0, 0);

      const data = _parse(rows)
        .map((r, i) => {
          const fechaNorm = _normFecha(r['Fecha'], tz);
          // Reconstruir Date desde el string normalizado dd/MM/yyyy para comparar con corte
          const partes = fechaNorm.split('/');
          const fechaD = partes.length === 3
            ? new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]))
            : new Date(NaN);
          return {
            _row:     i + 2,
            _fechaD:  fechaD,
            fecha:    fechaNorm,
            hora:     String(r['Hora'] || '').trim(),
            ean:      _toStr(r['EAN']),
            sku:      _toStr(r['SKU']),
            producto: String(r['PRODUCTO'] || '').trim(),
            packs:    Number(r['PACKS'] || r['PAKCS'] || 0),
            und:      Number(r['UND PACKS'] || r['UND'] || 0),
            unds:     Number(r['UNDS'] || 0),
            total:    Number(r['TOTAL'] || 0),
            ubicacion:String(r['UBICACION'] || '').trim()
          };
        })
        .filter(r => r._fechaD >= corte)
        .map(r => { delete r._fechaD; return r; }); // limpiar campo temporal

      _cacheSet(cacheKey, data, 60);
      return { ok: true, data };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}

// ============================================================
// MUTEX LÓGICO POR SHEET — serializa escrituras concurrentes de
// cualquier usuario sobre el mismo sheetId.
// getScriptLock garantiza exclusión mutua entre todos los usuarios.
// CacheService actúa como semáforo por sheetId: tiendas distintas
// no se bloquean entre sí fuera de la sección crítica del CAS.
// ============================================================
// scope permite aislar el candado por área (ej. 'CONTEO') para que operaciones
// no relacionadas (SALIDAS, ENTRADAS, M-T, OC...) no compitan entre sí por el
// mismo mutex. Sin scope, se mantiene el comportamiento previo (un candado por hoja).
function _acquireSheetLock(sheetId, scope) {
  const cache = CacheService.getScriptCache();
  const key   = 'lock_sheet_' + sheetId + (scope ? '_' + scope : '');
  const limit = Date.now() + 20000; // máx 20s de espera total — cubre ráfagas de varios usuarios simultáneos
  const gl    = LockService.getScriptLock();
  while (Date.now() < limit) {
    try {
      gl.waitLock(2000);
    } catch(e) {
      Utilities.sleep(150);
      continue;
    }
    if (!cache.get(key)) {
      cache.put(key, '1', 15); // TTL 15s: se libera solo si el proceso muere
      gl.releaseLock();
      return true;
    }
    gl.releaseLock();
    Utilities.sleep(150);
  }
  return false; // timeout — no se pudo adquirir
}

function _releaseSheetLock(sheetId, scope) {
  CacheService.getScriptCache().remove('lock_sheet_' + sheetId + (scope ? '_' + scope : ''));
}

function registrarConteo(token, filas) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId, 'CONTEO')) {
      return { ok: false, error: 'Otro usuario está guardando un conteo. Reintenta en unos segundos.', retryable: true };
    }
    try {
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('CONTEO');
      if (!hoja) throw new Error('Hoja CONTEO no encontrada');

      const tz       = TZ;
      const fechaObj = new Date();
      const fechaStr = _fmtFechaConTZ(fechaObj, tz);
      const horaStr  = _fmtHora(fechaObj);

      // Leer hoja una sola vez — mapear rowNum → índice para ediciones O(1)
      const values   = hoja.getDataRange().getValues();
      // Índice fila real → contenido (para validar _editRow pertenece a la hoja)
      const rowByNum = {};
      for (let i = 1; i < values.length; i++) rowByNum[i + 1] = values[i];

      // FIX: índice UID → rowNum existente para anti-duplicado O(1).
      // Antes hacía values.some+findIndex por cada fila → O(N²) sobre hojas grandes.
      const uidIdx = new Map();
      for (let i = 1; i < values.length; i++) {
        const u = String(values[i][10] || '').trim();
        if (u) uidIdx.set(u, i + 1); // 1-based sheet row
      }

      const inserted   = [];
      const editRows   = []; // {rowNum, rowData} — ediciones a sobreescribir
      const appendRows = []; // rowData[] — nuevas filas a appendear en batch

      filas.forEach(f => {
        const packs   = Number(f.packs || 0);
        const mult    = Number(f.multiplicador || 1);
        const und     = packs * mult;
        const sueltas = Number(f.sueltas || 0);
        const total   = und + sueltas;
        const sku     = String(f.sku || '').trim();
        const uid     = String(f._uid || '').trim();
        // Estructura: Fecha|Hora|EAN|SKU|PRODUCTO|PACKS|UND PACKS|UNDS|TOTAL|UBICACION|_UID
        const rowData = [fechaStr, horaStr, f.ean || '', sku, f.producto || '', packs, und, sueltas, total, '', uid];

        if (f._editRow && rowByNum[f._editRow]) {
          editRows.push({ rowNum: f._editRow, rowData });
          inserted.push({
            _row: f._editRow, fecha: fechaStr, hora: horaStr, ean: rowData[2], sku: rowData[3],
            producto: rowData[4], packs: rowData[5], und: rowData[6], unds: rowData[7], total: rowData[8], ubicacion: '', _uid: uid
          });
        } else {
          // Anti-duplicado: si ya existe un registro con este _uid, skip (O(1))
          if (uid && uidIdx.has(uid)) {
            inserted.push({
              _row: uidIdx.get(uid), fecha: fechaStr, hora: horaStr, ean: f.ean || '', sku,
              producto: f.producto || '', packs, und, unds: sueltas, total, ubicacion: '', _uid: uid, _duplicado: true
            });
            return;
          }
          appendRows.push(rowData);
        }
      });

      // Ediciones individualmente
      editRows.forEach(({ rowNum, rowData }) => {
        hoja.getRange(rowNum, 1, 1, 11).setValues([rowData]);
      });

      // Nuevas filas en batch
      if (appendRows.length > 0) {
        const lr = hoja.getLastRow() + 1;
        hoja.getRange(lr, 1, appendRows.length, 11).setValues(appendRows);
        appendRows.forEach((rowData, i) => {
          inserted.push({
            _row: lr + i, fecha: fechaStr, hora: horaStr, ean: rowData[2], sku: rowData[3],
            producto: rowData[4], packs: rowData[5], und: rowData[6], unds: rowData[7], total: rowData[8], ubicacion: '', _uid: rowData[10]
          });
        });
      }

      _invalidarCacheEscritura(s.sheetId, ['conteo_' + s.sheetId]);
      return { ok: true, registrados: filas.length, inserted };
    } catch(e) {
      _logError('registrarConteo', e, {filas: filas.length});
      return { ok: false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId, 'CONTEO');
    }
  });
}

function eliminarConteo(token, rowNum) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId, 'CONTEO')) {
      return { ok: false, error: 'Otro usuario está guardando un conteo. Reintenta en unos segundos.', retryable: true };
    }
    try {
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('CONTEO');
      if (!hoja) throw new Error('Hoja CONTEO no encontrada');
      hoja.deleteRow(rowNum);
      _invalidarCacheEscritura(s.sheetId, ['conteo_' + s.sheetId]);
      return { ok: true };
    } catch(e) {
      _logError('eliminarConteo', e, {rowNum});
      return { ok: false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId, 'CONTEO');
    }
  });
}

// Elimina múltiples filas en una sola llamada — evita N requests desde frontend
function eliminarConteoMultiple(token, rowNums) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId, 'CONTEO')) {
      return { ok: false, error: 'Otro usuario está guardando un conteo. Reintenta en unos segundos.', retryable: true };
    }
    try {
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('CONTEO');
      if (!hoja) throw new Error('Hoja CONTEO no encontrada');
      if (!rowNums || !rowNums.length) return { ok: true, eliminados: 0 };

      // Batch rewrite: leer hoja, filtrar filas a eliminar, reescribir sin ellas
      const values     = hoja.getDataRange().getValues();
      const toDeleteSet = new Set(rowNums.map(Number));
      // i es 0-based, fila real = i+1; fila 1 = header → nunca eliminar
      const kept = values.filter((_, i) => !toDeleteSet.has(i + 1));

      if (kept.length > 0) {
        hoja.getRange(1, 1, kept.length, kept[0].length).setValues(kept);
      }
      const totalRows = hoja.getLastRow();
      if (totalRows > kept.length) {
        hoja.deleteRows(kept.length + 1, totalRows - kept.length);
      }
      _invalidarCacheEscritura(s.sheetId, ['conteo_' + s.sheetId]);
      return { ok: true, eliminados: rowNums.length };
    } catch(e) {
      _logError('eliminarConteoMultiple', e, { rowNums });
      return { ok: false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId, 'CONTEO');
    }
  });
}

// ============================================================
// CREAR USUARIO — correr manualmente desde editor GAS
// ============================================================
function crearUsuario() {
  // ── EDITA SOLO ESTE BLOQUE ──────────────────────────────
  const USUARIO  = 'DS NUEVA SEDE';
  const PASSWORD = 'Password123';
  const SHEET_ID = '1abc...xyz';      // usa * para admin/invitado
  const ROL      = 'store';           // 'store' | 'admin' | 'invitado'
  // ────────────────────────────────────────────────────────
  if (SHEET_ID === '1abc...xyz' || PASSWORD === 'Password123')
    throw new Error('⚠️ Actualiza USUARIO, PASSWORD y SHEET_ID antes de ejecutar crearUsuario()');
  if (PASSWORD.length < 10)
    throw new Error('⚠️ PASSWORD debe tener mínimo 10 caracteres');
  if (['store','admin','invitado'].indexOf(ROL.trim()) === -1)
    throw new Error('ROL inválido. Usa: store | admin | invitado');
  const sheetIdFinal = SHEET_ID.trim();
  if (ROL.trim() !== 'store' && sheetIdFinal !== '*')
    throw new Error('Para rol "'+ROL+'" el SHEET_ID debe ser exactamente: *');
  const hoja = SpreadsheetApp.openById(MASTER_SHEET_ID).getSheetByName(SHEET_USUARIOS);
  if (!hoja) throw new Error('Hoja USUARIOS no encontrada en el master sheet.');
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim().toLowerCase() === USUARIO.trim().toLowerCase())
      throw new Error('El usuario "'+USUARIO+'" ya existe en la fila '+(i+1)+'.');
  }
  const salt = generateSalt();
  const hash = hashPassword(PASSWORD, salt);
  // setValues más predecible que appendRow (no recalcula fórmulas)
  const lastRow = hoja.getLastRow();
  hoja.getRange(lastRow + 1, 1, 1, 5).setValues([[USUARIO.trim(), hash, salt, sheetIdFinal, ROL.trim()]]);
  CacheService.getScriptCache().removeAll(['usuarios_master', 'all_stores']);
  _invalidarCacheChunked('all_stores'); // por si el cache chunked tiene chunks viejos
  Logger.log('✅ Usuario creado: ' + USUARIO.trim());
  Logger.log('   Rol     : ' + ROL.trim());
  Logger.log('   Sheet ID: ' + sheetIdFinal);
  Logger.log('⚠️  Guarda la contraseña — no se puede recuperar del hash.');
}

function diagnosticarUsuarios() {
  try {
    Logger.log('=== DIAGNÓSTICO USUARIOS ===');
    Logger.log('MASTER_SHEET_ID: ' + MASTER_SHEET_ID);
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    Logger.log('✅ Master sheet: ' + ss.getName());
    const hoja = ss.getSheetByName(SHEET_USUARIOS);
    if (!hoja) { Logger.log('❌ Hoja USUARIOS no encontrada'); return; }
    const datos = hoja.getDataRange().getValues();
    Logger.log('Filas: ' + datos.length + ' | Cabecera: ' + JSON.stringify(datos[0]));
    for (let i = 1; i < datos.length; i++)
      Logger.log('Fila '+(i+1)+': usuario="'+datos[i][0]+'" | sheetId="'+datos[i][3]+'" | rol="'+datos[i][4]+'"');
    Logger.log('=== FIN ===');
  } catch(e) { Logger.log('❌ '+e.message+'\n'+e.stack); }
}

// ============================================================
// PING SESSION — verifica si el token sigue vivo y renueva TTL
// Lo llama el frontend al recargar la página y cada 30 min
// ============================================================
function pingSession(token) {
  const s = _session(token); // _session renueva el TTL internamente
  if (!s) return { ok: false, expired: true };
  return { ok: true, usuario: s.usuario, rol: s.rol };
}

// ============================================================
// VALIDACIÓN DE INVENTARIO
// Cruza CONTEO de fecha D con SALIDAS y ENTRADAS posteriores a D
// contra el STOCK real de la hoja.
// fechaStr: 'YYYY-MM-DD'
// ============================================================
function getValidacion(token, fechaStr, forceRefresh) {
  return _guard(token, s => {
    try {
      const cacheKey = 'validacion_' + s.sheetId + '_' + fechaStr;
      if (!forceRefresh) {
        const cached = _cacheGet(cacheKey);
        if (cached) return { ok: true, data: cached };
      }

      // Partir el string YYYY-MM-DD manualmente evita ambigüedades de zona horaria
      // (new Date('YYYY-MM-DD') es UTC, lo que desfasa 1 día en TZ negativos como Lima)
      const parts  = fechaStr.split('-');
      const yy = Number(parts[0]), mm = Number(parts[1]) - 1, dd = Number(parts[2]);
      const fechaHoy  = new Date(yy, mm, dd);
      const fechaAyer = new Date(yy, mm, dd - 1); // JS resuelve correctamente el cruce de mes/año

      // Formatear con TZ explícita para consistencia con _normFecha
      const strHoy  = Utilities.formatDate(fechaHoy,  TZ, 'dd/MM/yyyy');
      const strAyer = Utilities.formatDate(fechaAyer, TZ, 'dd/MM/yyyy');

      const tz = TZ; // solo necesario para el log diagnóstico
      // 5 lecturas nativas — sin cuota de Sheets API v4
      const [rConteo, rSalidas, rEntradas, rStock, rMT] = _batchNative(s.sheetId, [
        'CONTEO', 'SALIDAS', 'ENTRADAS', 'STOCK', 'M-T'
      ]);

      // ── MODELO DE VALIDACIÓN ─────────────────────────────────────────────────
      // stockEsperado(D) = entradas(hasta D-1) - salidas(hasta D-1) - mt(hasta D-1)
      // Para validar el día 10 primera hora: acumular todo hasta el día 9 inclusive.
      // El stock de la hoja no se usa — se calcula desde los movimientos reales.
      // ─────────────────────────────────────────────────────────────────────────

      // Helper: convierte cualquier valor de fecha a timestamp de medianoche
      const _rawToMidnightTs = (raw) => {
        if (!raw) return NaN;
        let d;
        if (raw instanceof Date) {
          d = raw;
        } else if (typeof raw === 'number') {
          d = new Date((raw - 25569) * 86400 * 1000);
        } else {
          const str = String(raw).trim();
          const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (dmy) d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
          else d = new Date(str);
        }
        if (isNaN(d.getTime())) return NaN;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      };

      const fechaHoyTs = fechaHoy.getTime(); // timestamp medianoche del día D seleccionado

      // CONTEO: solo filas de hoy (D) o ayer (D-1)
      const rConteoF = (() => {
        if (!rConteo || rConteo.length < 2) return rConteo || [];
        return [rConteo[0]].concat(rConteo.slice(1).filter(r => {
          const f = _normFecha(r[0], tz);
          return f === strHoy || f === strAyer;
        }));
      })();

      // Salidas/Entradas/MT: todos los registros HASTA D-1 inclusive (ts < fechaHoyTs)
      const _prefilterHastaAyer = (rows, fechaColIdx) => {
        if (!rows || rows.length < 2) return rows || [];
        return [rows[0]].concat(rows.slice(1).filter(r => {
          const ts = _rawToMidnightTs(r[fechaColIdx]);
          return !isNaN(ts) && ts < fechaHoyTs;
        }));
      };

      const rSalidasF  = _prefilterHastaAyer(rSalidas,  0); // col A = Fecha
      const rEntradasF = _prefilterHastaAyer(rEntradas, 1); // col B = Fecha (col A = Facturas)
      const rMTF       = _prefilterHastaAyer(rMT,       0); // col A = FECHA

      // Parsear CONTEO:
      //   cAnteriorMap = conteo del día ANTERIOR (ayer)
      //   cActualMap   = conteo del día seleccionado (hoy)
      const cAnteriorMap = {}, cActualMap = {};
      _parse(rConteoF).forEach(r => {
        const fecha = _normFecha(r['Fecha'], tz);
        const sku   = _toStr(r['SKU']);
        if (!sku) return;
        const total = _num(r['TOTAL']);
        const prod  = String(r['PRODUCTO'] || '').trim();
        if (fecha === strAyer) {
          if (!cAnteriorMap[sku]) cAnteriorMap[sku] = { und: 0, producto: prod };
          cAnteriorMap[sku].und += total;
        }
        if (fecha === strHoy) {
          if (!cActualMap[sku]) cActualMap[sku] = { und: 0, producto: prod };
          cActualMap[sku].und += total;
        }
      });

      // salidasMap/mtMap/entradasMap  → acumulado hasta D-1, usado para stockEsperado
      // salidasAyer/mtAyer/entradasAyer → solo D-1, mostrado en columnas de la tabla y detalles
      const salidasMap = {}, salidasAyer = {}, salidasDet = {};
      _parse(rSalidasF).forEach(r => {
        const sku = String(r['SKU'] || '').trim();
        if (!sku) return;
        salidasMap[sku] = (salidasMap[sku] || 0) + _num(r['UNIDAD']);
        if (_normFecha(r['Fecha'], tz) === strAyer) {
          salidasAyer[sku] = (salidasAyer[sku] || 0) + _num(r['UNIDAD']);
          if (!salidasDet[sku]) salidasDet[sku] = [];
          salidasDet[sku].push({
            nroPedido: String(r['NRO PEDIDO'] || '').trim(),
            desc:      String(r['DESCRIPCION'] || '').trim(),
            pack:      _num(r['PACK']),
            unidad:    _num(r['UNIDAD']),
            motorizado:String(r['MOTORIZADO'] || '').trim()
          });
        }
      });

      const mtMap = {}, mtAyer = {}, mtDet = {};
      _parse(rMTF).forEach(r => {
        const sku = String(r['LOVIS'] || '').trim();
        if (!sku) return;
        mtMap[sku] = (mtMap[sku] || 0) + _num(r['CANTIDAD (unidades)']);
        if (_normFecha(r['FECHA'], tz) === strAyer) {
          mtAyer[sku] = (mtAyer[sku] || 0) + _num(r['CANTIDAD (unidades)']);
          if (!mtDet[sku]) mtDet[sku] = [];
          mtDet[sku].push({
            tipo:   String(r['M / T']  || '').trim(),
            motivo: String(r['MOTIVO'] || '').trim(),
            cant:   _num(r['CANTIDAD (unidades)']),
            obs:    String(r['Observaciones'] || '').trim()
          });
        }
      });

      const entradasMap = {}, entradasAyer = {}, entradasDet = {};
      _parse(rEntradasF).forEach(r => {
        const sku = String(r['Codigo Lovis'] || '').trim();
        if (!sku) return;
        entradasMap[sku] = (entradasMap[sku] || 0) + _num(r['Unidades']);
        if (_normFecha(r['Fecha'], tz) === strAyer) {
          entradasAyer[sku] = (entradasAyer[sku] || 0) + _num(r['Unidades']);
          if (!entradasDet[sku]) entradasDet[sku] = [];
          entradasDet[sku].push({
            factura:    String(r['Facturas']    || '').trim(),
            proveedor:  String(r['Proveedor']   || '').trim(),
            unidades:   _num(r['Unidades']),
            responsable:String(r['Responsable'] || '').trim()
          });
        }
      });

      // STOCK — mapa sku → desc, marca, categoria, top
      // El campo stock de la hoja YA NO se usa como "real" para el diff.
      // Solo se usa para SKUs sin contar (sinContar) y para metadatos.
      const stockMap = {};
      _parse(rStock).forEach(r => {
        const sku = String(r['Lovis'] || '').trim();
        if (!sku) return;
        stockMap[sku] = {
          stock:     _num(r['Stock actual UND']), // se mantiene para referencia, no para diff
          desc:      String(r['DESCRIPCION'] || r['Descripcion'] || '').trim(),
          marca:     String(r['Marca'] || '').trim(),
          categoria: String(r['Categoria'] || '').trim(),
          top:       String(r['TOP'] || '').trim().toUpperCase()
        };
      });

      // Universo de SKUs: todos los que tienen conteo hoy O ayer
      const todosSkus = new Set([...Object.keys(cAnteriorMap), ...Object.keys(cActualMap)]);

      // Log diagnóstico — solo en DEBUG_MODE
      if (DEBUG_MODE) console.log('[getValidacion] conteo HOY=' + strHoy + ' | movimientos desde D=' + strHoy +
        ' | cAnterior=' + Object.keys(cAnteriorMap).length +
        ' | cActual=' + Object.keys(cActualMap).length +
        ' | salidas(desde D)=' + Object.keys(salidasMap).length +
        ' | mt(desde D)=' + Object.keys(mtMap).length +
        ' | entradas(desde D)=' + Object.keys(entradasMap).length);

      // Cruzar
      // stockEsperado(D) = entradas(hasta D-1) - salidas(hasta D-1) - mt(hasta D-1)
      // diff = cActual(D) - stockEsperado(D)
      // cAnterior es solo referencial — no entra en el cálculo.
      const contados = [...todosSkus].map(sku => {
        const cAnt    = cAnteriorMap[sku] ? cAnteriorMap[sku].und : null;
        const cAct    = cActualMap[sku]   ? cActualMap[sku].und   : null;
        const salidas = salidasMap[sku]   || 0;
        const mt      = mtMap[sku]        || 0;
        const entradas= entradasMap[sku]  || 0;
        const st      = stockMap[sku]     || {};
        const prod    = (cAnteriorMap[sku]||cActualMap[sku]||{}).producto || st.desc || '';

        // stockEsperado usa acumulado completo hasta D-1 (para diff correcto)
        const stockEsperado = entradas - salidas - mt;

        // Columnas visibles: solo movimientos de D-1
        const salidasVis  = salidasAyer[sku]  || 0;
        const mtVis       = mtAyer[sku]        || 0;
        const entradasVis = entradasAyer[sku]  || 0;

        const diff = cAct !== null ? cAct - stockEsperado : null;

        return {
          sku,
          desc:      prod,
          marca:     st.marca     || '',
          categoria: st.categoria || '',
          top:       st.top       || '',
          sinContar: false,
          cAnterior: cAnt,
          salidas:  salidasVis,   // D-1 — para mostrar en tabla
          mt:       mtVis,        // D-1 — para mostrar en tabla
          entradas: entradasVis,  // D-1 — para mostrar en tabla
          salidasDet:  salidasDet[sku]  || [],
          mtDet:       mtDet[sku]       || [],
          entradasDet: entradasDet[sku] || [],
          cActual:   cAct,
          real:      stockEsperado,  // acumulado hasta D-1
          diff,
          cuadra: diff === 0
        };
      }).sort((a, b) => Math.abs(b.diff||0) - Math.abs(a.diff||0));

      // SKUs DIARIO sin contar ni ayer ni hoy
      const skuContados = todosSkus;
      const sinContar = Object.entries(stockMap)
        .filter(([sku, st]) => st.top === 'DIARIO' && !skuContados.has(sku))
        .map(([sku, st]) => ({
          sku, desc: st.desc, marca: st.marca,
          categoria: st.categoria, top: st.top,
          sinContar: true,
          cAnterior: null, salidas: null, mt: null, entradas: null,
          cActual: null, real: st.stock, diff: null, cuadra: false
        }));

      const data = [...contados, ...sinContar];

      _cacheSet(cacheKey, data, 60);
      return { ok: true, data };
    } catch(e) { _logError('getValidacion', e, {fechaStr}); return { ok: false, error: e.message }; }
  });
}

function eliminarConteoPorSKU(token, sku, fechaStr) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId, 'CONTEO')) {
      return { ok: false, error: 'Otro usuario está guardando un conteo. Reintenta en unos segundos.', retryable: true };
    }
    try {
      // Construir fecha con JS puro — evita offset de zona horaria de 'T00:00:00'
      const dateParts  = fechaStr.split('-');
      const fechaRefDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
      // FIX: usar Utilities.formatDate con TZ para consistencia con _normFecha (línea de abajo)
      const fechaRefStr  = Utilities.formatDate(fechaRefDate, TZ, 'dd/MM/yyyy');

      const hoja    = SpreadsheetApp.openById(s.sheetId).getSheetByName('CONTEO');
      if (!hoja) throw new Error('Hoja CONTEO no encontrada');
      // Leer dentro del lock para que los índices de fila sean estables
      const values  = hoja.getDataRange().getValues();
      // Identificar filas a eliminar.
      // Estructura CONTEO: A=Fecha | B=Hora | C=EAN | D=SKU | E=PRODUCTO | ...
      const toDelete = [];
      for (let i = 1; i < values.length; i++) {
        const rowSku   = _toStr(values[i][3]); // col D = SKU (NO col C — esa es EAN)
        const rowFecha = _normFecha(values[i][0], TZ); // col A = Fecha — TZ explícita
        if (rowSku === String(sku).trim() && rowFecha === fechaRefStr) {
          toDelete.push(i + 1); // 1-based sheet row
        }
      }
      if (!toDelete.length) return { ok: false, error: 'No se encontraron registros para ese SKU y fecha' };

      // Batch rewrite — reconstruir sin filas eliminadas y borrar sobrante al final
      const toDeleteSet = new Set(toDelete);
      const kept = values.filter((_, i) => !toDeleteSet.has(i + 1)); // i+1 = 1-based row
      // Sobreescribir con las filas conservadas
      if (kept.length > 0) {
        hoja.getRange(1, 1, kept.length, kept[0].length).setValues(kept);
      }
      // Eliminar las filas sobrantes al final (las que quedaron de la escritura anterior)
      const totalRows = hoja.getLastRow();
      if (totalRows > kept.length) {
        hoja.deleteRows(kept.length + 1, totalRows - kept.length);
      }
      CacheService.getScriptCache().removeAll([
        'conteo_' + s.sheetId,
        'validacion_' + s.sheetId + '_' + fechaStr
      ]);
      return { ok: true, eliminados: toDelete.length };
    } catch(e) {
      _logError('eliminarConteoPorSKU', e, {sku, fechaStr});
      return { ok: false, error: e.message };
    } finally {
      _releaseSheetLock(s.sheetId, 'CONTEO');
    }
  });
}

// ============================================================
// UTILIDAD — ejecutar manualmente desde el editor si hay caché corrupta
// ============================================================
function limpiarCacheConteo() { // limpia TODO el caché — salidas, entradas, conteo, stock, etc.
  const data = _openSS(MASTER_SHEET_ID)
    .getSheetByName(SHEET_USUARIOS).getDataRange().getValues();
  const keys = [];
  data.slice(1).forEach(r => {
    const sid = String(r[3]).trim();
    if (sid && sid !== '*') {
      keys.push('conteo_'    + sid);
      keys.push('stock_'     + sid);
      keys.push('mconteo_'   + sid);
      keys.push('maestro_'   + sid);
      keys.push('salidas_'   + sid);
      keys.push('entradas_'  + sid);
      keys.push('mt_'        + sid);
      keys.push('cancelados_'+ sid);
      // Incluir claves de validación de hoy y ayer (dinámicas por fecha)
      _validacionKeys(sid).forEach(k => keys.push(k));
    }
  });
  keys.push('stock_admin', 'all_stores', 'usuarios_master');
  CacheService.getScriptCache().removeAll(keys);
  Logger.log('Caché limpiada: ' + keys.join(', '));
}


function limpiarCacheSalidas() {
  const data = SpreadsheetApp.openById(MASTER_SHEET_ID)
    .getSheetByName(SHEET_USUARIOS).getDataRange().getValues();
  const keys = [];
  data.slice(1).forEach(r => {
    const sid = String(r[3]).trim();
    if (sid && sid !== '*') keys.push('salidas_' + sid);
  });
  CacheService.getScriptCache().removeAll(keys);
  Logger.log('Cache salidas limpiada: ' + keys.join(', '));
}

/* ══════════════════════════════════════
   EDITAR SKU — SALIDAS
   SKU=col C (3), Descripción=col E (5)
══════════════════════════════════════ */

// Edita el SKU y descripción de una sola fila
function editarSKUFila(token, rowNum, nuevoSKU, nuevaDesc) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId))
      return { ok:false, error:'Otro usuario está escribiendo. Reintenta.' };
    try {
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('SALIDAS');
      if (!hoja) return { ok:false, error:'Hoja SALIDAS no encontrada.' };
      const row = Number(rowNum);
      hoja.getRange(row, 3).setValue(nuevoSKU);   // col C — solo SKU, descripción se mantiene
      // Invalidar caché salidas
      _invalidarCacheSalidas(s.sheetId);
      return { ok:true };
    } catch(e) {
      _logError('editarSKUFila', e, {rowNum, nuevoSKU});
      return { ok:false, error:e.message };
    }
    finally { _releaseSheetLock(s.sheetId); }
  });
}

// Reemplaza TODOS los registros con skuOrigen por skuDestino en SALIDAS
function reemplazarSKUMasivo(token, skuOrigen, skuDestino, descDestino) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId))
      return { ok:false, error:'Otro usuario está escribiendo. Reintenta.' };
    try {
      const hoja   = SpreadsheetApp.openById(s.sheetId).getSheetByName('SALIDAS');
      if (!hoja) return { ok:false, error:'Hoja SALIDAS no encontrada.' };
      const maxRow = hoja.getLastRow();
      if (maxRow < 2) return { ok:true, count:0 };
      const skuCol  = hoja.getRange(2, 3, maxRow - 1, 1).getValues(); // col C
      // FIX: batch — escribir toda la columna C de una sola vez en lugar de N llamadas individuales
      const skuOriT = String(skuOrigen).trim();
      const skuDestT = String(skuDestino).trim();
      let count = 0;
      const nuevaCol = skuCol.map(function(r){
        if (String(r[0]).trim() === skuOriT) { count++; return [skuDestT]; }
        return r;
      });
      if (count > 0) {
        hoja.getRange(2, 3, maxRow - 1, 1).setValues(nuevaCol);
        _invalidarCacheSalidas(s.sheetId);
      }
      return { ok:true, count:count };
    } catch(e) {
      _logError('reemplazarSKUMasivo', e, {skuOrigen, skuDestino});
      return { ok:false, error:e.message };
    }
    finally { _releaseSheetLock(s.sheetId); }
  });
}

// Reemplaza SKU solo en las filas (_row = número de fila en hoja) indicadas por el usuario
function reemplazarSKUEnFilas(token, rowNumbers, skuDestino, descDestino) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId))
      return { ok:false, error:'Otro usuario está escribiendo. Reintenta.' };
    try {
      const hoja = SpreadsheetApp.openById(s.sheetId).getSheetByName('SALIDAS');
      if (!hoja) return { ok:false, error:'Hoja SALIDAS no encontrada.' };
      if (!rowNumbers || !rowNumbers.length) return { ok:true, count:0 };
      const skuDestT  = String(skuDestino).trim();
      const rowSet    = new Set(rowNumbers.map(Number));
      const maxRow    = hoja.getLastRow();
      if (maxRow < 2) return { ok:true, count:0 };
      // Leer columna C (SKU) completa
      const skuCol = hoja.getRange(2, 3, maxRow - 1, 1).getValues();
      let count = 0;
      const nuevaCol = skuCol.map(function(r, i) {
        const fila = i + 2; // fila real en hoja (base 1, +1 por encabezado)
        if (rowSet.has(fila)) { count++; return [skuDestT]; }
        return r;
      });
      if (count > 0) {
        hoja.getRange(2, 3, maxRow - 1, 1).setValues(nuevaCol);
        _invalidarCacheSalidas(s.sheetId);
      }
      return { ok:true, count:count };
    } catch(e) {
      _logError('reemplazarSKUEnFilas', e, {rowNumbers, skuDestino});
      return { ok:false, error:e.message };
    }
    finally { _releaseSheetLock(s.sheetId); }
  });
}

function _invalidarCacheSalidas(sheetId) {
  _invalidarCacheChunked('salidas_' + sheetId);
}

// Reemplaza SKU="SIN SKU" en filas que coincidan por descripción exacta
function reemplazarSKUPorDescripcion(token, descOrigen, nuevoSKU) {
  return _guard(token, s => {
    if (!_acquireSheetLock(s.sheetId))
      return { ok:false, error:'Otro usuario está escribiendo. Reintenta.' };
    try {
      const hoja   = SpreadsheetApp.openById(s.sheetId).getSheetByName('SALIDAS');
      if (!hoja) return { ok:false, error:'Hoja SALIDAS no encontrada.' };
      const maxRow = hoja.getLastRow();
      if (maxRow < 2) return { ok:true, count:0 };
      // Leer SKU (col C) y Descripción (col E) juntos
      const vals = hoja.getRange(2, 3, maxRow - 1, 3).getValues(); // cols C,D,E
      // FIX: batch — escribir col C completa en una sola llamada
      const descOriT = String(descOrigen).trim();
      const skuNuevoT = String(nuevoSKU).trim();
      let count = 0;
      const nuevaColC = vals.map(function(r){
        const sku  = String(r[0] || '').trim().toUpperCase();
        const desc = String(r[2] || '').trim();
        if (sku === 'SIN SKU' && desc === descOriT) { count++; return [skuNuevoT]; }
        return [r[0]];
      });
      if (count > 0) {
        hoja.getRange(2, 3, maxRow - 1, 1).setValues(nuevaColC);
        _invalidarCacheSalidas(s.sheetId);
      }
      return { ok:true, count:count };
    } catch(e) {
      _logError('reemplazarSKUPorDescripcion', e, {descOrigen, nuevoSKU});
      return { ok:false, error:e.message };
    }
    finally { _releaseSheetLock(s.sheetId); }
  });
}

// ============================================================
// EXPORT MULTI-SEDE — historial completo de todas las sedes
// modulo: 'salidas' | 'entradas' | 'mt' | 'conteo'
// ============================================================
function getExportMultiSede(token, modulo) {
  return _guard(token, s => {
    try {
      if (s.rol === 'store') return { ok: false, error: 'Sin permiso para exportar multi-sede.' };
      const stores = _getAllStores();
      if (!stores.length) return { ok: true, sedes: [] };
      const hojaMap = { salidas:'SALIDAS', entradas:'ENTRADAS', mt:'M-T', conteo:'CONTEO' };
      const hojaNombre = hojaMap[modulo];
      if (!hojaNombre) return { ok: false, error: 'Módulo no soportado: ' + modulo };
      const oauthToken = ScriptApp.getOAuthToken();
      const fetches = stores.map(st => ({
        url: 'https://sheets.googleapis.com/v4/spreadsheets/' + st.sheetId +
          '/values/' + encodeURIComponent(hojaNombre) +
          '?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE',
        headers: { Authorization: 'Bearer ' + oauthToken },
        muteHttpExceptions: true
      }));
      const results = UrlFetchApp.fetchAll(fetches);
      const tz = TZ;
      const sedes = stores.map((st, i) => {
        try {
          const j = JSON.parse(results[i].getContentText());
          if (j.error) return { nombre: st.nombre, data: [] };
          const rows = j.values || [];
          if (rows.length < 2) return { nombre: st.nombre, data: [] };
          let data = [];
          if (modulo === 'salidas') {
            data = rows.slice(1).map(r => ({
              fecha: _fmtFechaConTZ(r[0],tz), hora: String(r[1]||'').trim(),
              sku: String(r[2]||'').trim(), nroPedido: String(r[3]||'').trim(),
              desc: String(r[4]||'').trim(), pack: r[5]||0, unidad: r[6]||0,
              marca: String(r[7]||'').trim(), motorizado: String(r[8]||'').trim(),
              envases: String(r[9]||'').trim(), estado: String(r[10]||'').trim(),
              revision: String(r[11]||'').trim(), tamano: String(r[12]||'').trim()
            })).filter(r => r.sku);
          } else if (modulo === 'entradas') {
            data = rows.slice(1).map(r => ({
              factura: String(r[0]||'').trim(), fecha: _fmtFechaConTZ(r[1],tz),
              sku: String(r[2]||'').trim(), desc: String(r[3]||'').trim(),
              unidades: r[4]||0, fVenc: String(r[5]||'').trim(),
              proveedor: String(r[6]||'').trim(), oc: String(r[7]||'').trim(),
              dynamics: String(r[8]||'').trim(), responsable: String(r[9]||'').trim()
            })).filter(r => r.sku);
          } else if (modulo === 'mt') {
            data = rows.slice(1).map(r => ({
              fecha: _fmtFechaConTZ(r[0],tz), sku: String(r[1]||'').trim(),
              desc: String(r[2]||'').trim(), cant: r[3]||0,
              tipo: String(r[4]||'').trim(), motivo: String(r[5]||'').trim(),
              obs: String(r[6]||'').trim(), estado: String(r[7]||'').trim(),
              nroFactura: String(r[8]||'').trim(), fechaRetiro: _fmtFechaConTZ(r[9],tz)
            })).filter(r => r.sku);
          } else if (modulo === 'conteo') {
            data = rows.slice(1).map(r => ({
              fecha: _fmtFechaConTZ(r[0],tz), hora: String(r[1]||'').trim(),
              ean: _toStr(r[2]), sku: _toStr(r[3]),
              producto: String(r[4]||'').trim(), packs: r[5]||0,
              und: r[6]||0, unds: r[7]||0, total: r[8]||0,
              ubicacion: String(r[9]||'').trim()
            })).filter(r => r.sku);
          }
          return { nombre: st.nombre, data };
        } catch(e) { return { nombre: st.nombre, data: [] }; }
      });
      return { ok: true, sedes };
    } catch(e) { return { ok: false, error: e.message }; }
  });
}