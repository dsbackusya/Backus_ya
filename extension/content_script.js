// ============================================================
//  TaDa Order Scraper — Content Script v4.6
//  TRIGGER: evento nativo hxOpen + fallbacks adaptativos
//  MOTORIZADO: MutationObserver instantáneo (sin polling)
//  - Capa 1: eventos de apertura conocidos (hxOpen, etc.)
//  - Capa 2: MutationObserver directo en el popup
//  - Capa 3: polling de emergencia
//  - Selectores con múltiples fallbacks por campo
//  - Cliente/dirección opcionales
//  - Motorizado capturado en milisegundos via MO
// ============================================================

// ── TOAST ──────────────────────────────────────────────────
(function inyectarEstilosToast() {
  const style = document.createElement('style');
  style.textContent = `
    #tada-toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      min-width: 220px; max-width: 320px;
      opacity: 0; transform: translateY(12px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: none;
    }
    #tada-toast.visible    { opacity: 1; transform: translateY(0); }
    #tada-toast.capturando { background: #1a1a2e; color: #fff; }
    #tada-toast.enviado    { background: #1b5e20; color: #fff; }
    #tada-toast.error      { background: #b71c1c; color: #fff; }
    #tada-toast.motorizado { background: #0d47a1; color: #fff; }
    #tada-toast-spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
      border-radius: 50%; animation: tada-spin 0.7s linear infinite; flex-shrink: 0;
    }
    @keyframes tada-spin { to { transform: rotate(360deg); } }
    #tada-toast-icon  { font-size: 16px; flex-shrink: 0; }
    #tada-toast-body  { display: flex; flex-direction: column; gap: 2px; }
    #tada-toast-titulo { font-weight: 600; }
    #tada-toast-sub   { font-size: 11px; opacity: 0.8; }
  `;
  document.head.appendChild(style);
})();

function crearToast() {
  const el = document.createElement('div');
  el.id = 'tada-toast';
  el.innerHTML = `
    <div id="tada-toast-spinner"></div>
    <div id="tada-toast-icon" style="display:none"></div>
    <div id="tada-toast-body">
      <div id="tada-toast-titulo"></div>
      <div id="tada-toast-sub"></div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

let toastEl    = null;
let toastTimer = null;

function mostrarToast(tipo, titulo, sub, duracion = 0) {
  if (!toastEl) toastEl = crearToast();
  const spinner  = toastEl.querySelector('#tada-toast-spinner');
  const icon     = toastEl.querySelector('#tada-toast-icon');
  const tituloEl = toastEl.querySelector('#tada-toast-titulo');
  const subEl    = toastEl.querySelector('#tada-toast-sub');
  const ICONOS   = { capturando: '', enviado: '✅', error: '❌', motorizado: '🏍️' };

  toastEl.className     = tipo;
  spinner.style.display = tipo === 'capturando' ? 'block' : 'none';
  icon.style.display    = tipo !== 'capturando' ? 'inline' : 'none';
  icon.textContent      = ICONOS[tipo] || '';
  tituloEl.textContent  = titulo;
  subEl.textContent     = sub || '';

  requestAnimationFrame(() => { toastEl.classList.add('visible'); });
  clearTimeout(toastTimer);
  if (duracion > 0) toastTimer = setTimeout(() => ocultarToast(), duracion);
}

function ocultarToast() {
  if (!toastEl) return;
  toastEl.classList.remove('visible');
}

// ── SONIDO DE ALERTA ───────────────────────────────────────
const SONIDO_URL = 'https://cdn.pixabay.com/audio/2025/06/06/audio_033375aac8.mp3';
let audioCtx = null;

function reproducirAlerta() {
  try {
    fetch(SONIDO_URL)
      .then(r => r.arrayBuffer())
      .then(buffer => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.decodeAudioData(buffer, decoded => {
          const source = audioCtx.createBufferSource();
          source.buffer = decoded;
          source.connect(audioCtx.destination);
          source.start(0);
        });
      })
      .catch(() => {});
  } catch (e) {}
}

// ── HELPERS ────────────────────────────────────────────────
function getHexaText(el) {
  if (!el) return '';
  const sr = el.shadowRoot;
  if (!sr) return el.textContent ? el.textContent.trim() : '';
  const t = sr.querySelector('[part="text"]') ||
            sr.querySelector('[data-testid="hexa-v2-text"]') ||
            sr.firstElementChild;
  return t ? t.textContent.trim() : '';
}

function getHexaTagText(el) {
  if (!el) return '';
  // Shadow DOM primero — tiene el texto completo sin truncar
  const sr = el.shadowRoot;
  if (sr) {
    const t = sr.querySelector('span.text') || sr.querySelector('[part="text"]');
    if (t && t.textContent.trim()) return t.textContent.trim();
  }
  // Fallback: atributo text (puede venir truncado con "...")
  if (el.getAttribute('text')) return el.getAttribute('text');
  return el.textContent ? el.textContent.trim() : '';
}

function normalizarNumeroPedido(str) {
  if (!str) return '';
  return str.replace(/^N[oº°]\s*/i, '').trim();
}

// Intenta múltiples selectores en orden, devuelve el primer match
function queryFallback(root, ...selectores) {
  for (const sel of selectores) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch (e) { /* selector inválido, ignorar */ }
  }
  return null;
}

// Busca un label en allTexts y devuelve el valor que lo sigue
function getValorDespuesDeLabel(allTexts, label) {
  const idx = allTexts.findIndex(el => getHexaText(el) === label);
  if (idx < 0) return null;
  const next = allTexts[idx].nextElementSibling;
  if (next) return getHexaText(next);
  return allTexts[idx + 1] ? getHexaText(allTexts[idx + 1]) : null;
}

// ── SCRAPER MODAL adaptativo ────────────────────────────────
function extraerDatosModal(popup) {
  const allTexts = Array.from(popup.querySelectorAll('hexa-v2-text'));

  // ── Número de pedido ──────────────────────────────────────
  // Semántico: busca el label "Pedido" — muy estable
  const pedidoIdx    = allTexts.findIndex(el => getHexaText(el) === 'Pedido');
  const numeroPedido = pedidoIdx >= 0 ? getHexaText(allTexts[pedidoIdx + 1]) : null;

  // ── Estado ────────────────────────────────────────────────
  const estadoTag = queryFallback(popup,
    'hexa-v2-tag.card-info-tag',
    'hexa-v2-tag[class*="green"]',
    'hexa-v2-tag[accent-color="green"]',
    'hexa-v2-tag[data-color="green"]'
  );
  const estado = estadoTag ? getHexaTagText(estadoTag) : null;

  // ── Motorizado en modal ───────────────────────────────────
  const motorizadoTag = queryFallback(popup,
    'hexa-v2-tag.card-footer-in-transit-modal',
    'hexa-v2-tag[class*="in-transit-modal"]',
    'hexa-v2-tag[class*="in-transit"][class*="modal"]',
    'hexa-v2-tag[icon="driver"]',
    'hexa-v2-tag[data-color="black"]'
  );
  const motorizado = motorizadoTag ? getHexaTagText(motorizadoTag) : null;

  // ── Tiempo estimado ───────────────────────────────────────
  const tiempoTag = queryFallback(popup,
    'hexa-v2-tag[class*="green"]:not(.card-info-tag)',
    'hexa-v2-tag[accent-color="green"]:not([class*="card-info"])'
  ) || estadoTag;
  const tiempo = tiempoTag ? getHexaTagText(tiempoTag) : null;

  // ── Cliente (opcional) ────────────────────────────────────
  const clienteEl = queryFallback(popup,
    '[class*="order-flow-modal-header-container-title"] hexa-v2-text',
    '[class*="header-container-title"] hexa-v2-text',
    '[class*="modal-header"] [class*="title"] hexa-v2-text'
  ) || allTexts.find(el => el.closest('[class*="title"]'));
  const cliente = clienteEl ? getHexaText(clienteEl) : null;

  // ── Dirección (opcional) ──────────────────────────────────
  const headerArea = queryFallback(popup,
    '[class*="order-flow-modal-header-container"]:not([class*="info"]):not([class*="title"])',
    '[class*="modal-header-container"]:not([class*="info"]):not([class*="title"])',
    '[class*="modal-header"]'
  );
  const LABELS_CONOCIDOS = new Set([
    'Pedido', 'Subtotal', 'Envío', 'Total',
    'Método de pago', 'Cupón', 'Calificación'
  ]);
  const dirEl = headerArea
    ? Array.from(headerArea.querySelectorAll('hexa-v2-text')).find(el => {
        const txt = getHexaText(el);
        return txt.length > 5
          && !LABELS_CONOCIDOS.has(txt)
          && !el.closest('[class*="title"]')
          && !el.closest('[class*="info"]');
      })
    : null;
  const direccion = dirEl ? getHexaText(dirEl) : null;

  // ── Totales (100% semánticos) ─────────────────────────────
  const subtotal   = getValorDespuesDeLabel(allTexts, 'Subtotal');
  const envio      = getValorDespuesDeLabel(allTexts, 'Envío');
  const cupon      = getValorDespuesDeLabel(allTexts, 'Cupón');
  const total      = getValorDespuesDeLabel(allTexts, 'Total');
  const metodoPago = getValorDespuesDeLabel(allTexts, 'Método de pago');

  // ── Productos ─────────────────────────────────────────────
  const productContainerSel = [
    '[class*="order-details-products-container"]',
    '[class*="product-container"]',
    '[class*="products-container"]'
  ].join(', ');

  const productos = Array.from(popup.querySelectorAll(productContainerSel)).map(container => {
    const nombreEl = queryFallback(container,
      '[class*="order-details-product-description"] hexa-v2-text',
      '[class*="product-description"] hexa-v2-text',
      '[class*="product-name"] hexa-v2-text',
      '[class*="description"] hexa-v2-text'
    );
    const nombre = nombreEl ? getHexaText(nombreEl) : '';

    const cantidadTag = queryFallback(container,
      'hexa-v2-tag[class*="blue"]',
      'hexa-v2-tag[accent-color="blue"]',
      'hexa-v2-tag[data-color="blue"]'
    );
    const cantidad = cantidadTag
      ? getHexaTagText(cantidadTag).replace(/Cantidad:\s*/i, '')
      : '';

    const precioOrigEl = queryFallback(container,
      '[class*="original-price-text"]',
      '[class*="original-price"] hexa-v2-text',
      '[class*="precio-original"] hexa-v2-text'
    );
    const precioOriginal = precioOrigEl ? getHexaText(precioOrigEl) : null;

    const priceContainer = queryFallback(container,
      '.order-details-product-price',
      '[class*="product-price"]:not([class*="original"])'
    );
    const priceEl = priceContainer ? priceContainer.querySelector('hexa-v2-text') : null;
    const precio  = priceEl ? getHexaText(priceEl) : '';

    const retornableEl = queryFallback(container,
      '[class*="product-returnable"] hexa-v2-text',
      '[class*="returnable"] hexa-v2-text'
    );
    const retornable = retornableEl ? getHexaText(retornableEl) : null;

    return {
      nombre,
      cantidad,
      ...(precioOriginal ? { precioOriginal } : {}),
      precio,
      ...(retornable ? { retornable } : {})
    };
  }).filter(p => p.nombre && p.cantidad);

  return {
    numeroPedido,
    estado,
    motorizado,
    tiempo,
    ...(cliente   ? { cliente }   : {}),
    ...(direccion ? { direccion } : {}),
    metodoPago,
    subtotal,
    envio,
    ...(cupon ? { cupon } : {}),
    total,
    productos,
    timestamp: new Date().toISOString()
  };
}

// ── MOTORIZADO: buscar en columnas activas ──────────────────
function buscarMotorizadoEnColumnas(numeroPedido) {
  const codigoBuscado = normalizarNumeroPedido(numeroPedido);
  const columns       = document.querySelectorAll('hexa-container.orders-column');

  for (const col of columns) {
    let esEnvioProceso = false;
    for (const h of col.querySelectorAll('hexa-v2-text')) {
      if (getHexaText(h).toLowerCase().includes('envío en proceso')) {
        esEnvioProceso = true;
        break;
      }
    }
    if (!esEnvioProceso) continue;

    const cardSelector = 'hexa-container.last-orders-card-template, hexa-container.order-card-template';
    for (const card of col.querySelectorAll(cardSelector)) {
      const numEl      = card.querySelector('hexa-v2-text.card-info-text');
      const codigoCard = normalizarNumeroPedido(getHexaText(numEl));
      if (codigoCard === codigoBuscado) {
        const motEl = card.querySelector('hexa-v2-tag.card-footer-in-transit');
        return motEl ? getHexaTagText(motEl) : null;
      }
    }
  }
  return null;
}

// ── MOTORIZADO: enviar actualización ───────────────────────
function enviarMotorizado(numeroPedido, motorizado) {
  chrome.runtime.sendMessage(
    { tipo: 'actualizar_motorizado', numeroPedido, motorizado },
    (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.ok) {
        mostrarToast('motorizado', '¡Motorizado registrado!', `${numeroPedido} → ${motorizado}`, 4000);
      }
    }
  );
}

// ── MOTORIZADO: captura instantánea via MutationObserver ───
// El tag card-footer-in-transit se AGREGA al DOM cuando se asigna motorizado
// El MO lo detecta en milisegundos, sin polling de 60s
function esperarMotorizado(numeroPedido, timeoutMs = 600000) { // 10 min máximo

  // Verificar si ya está disponible ahora mismo
  const yaDisponible = buscarMotorizadoEnColumnas(numeroPedido);
  if (yaDisponible) {
    enviarMotorizado(numeroPedido, yaDisponible);
    return;
  }

  let mo        = null;
  let timeoutId = null;

  function verificarCards(mutations) {
    // Solo actuar si hubo nodos añadidos
    const huboCambio = mutations.some(m => m.addedNodes.length > 0);
    if (!huboCambio) return;

    const motorizado = buscarMotorizadoEnColumnas(numeroPedido);
    if (motorizado) {
      mo?.disconnect();
      clearTimeout(timeoutId);
      enviarMotorizado(numeroPedido, motorizado);
    }
  }

  // Observar el área de columnas activas del tablero
  const areaObservada = queryFallback(document,
    '[class*="dtc-layout-content-area"]',
    '[class*="orders-board"]',
    'main'
  ) || document.body;

  mo = new MutationObserver(verificarCards);
  mo.observe(areaObservada, { childList: true, subtree: true });

  // Timeout de seguridad: desconectar tras 10 minutos
  timeoutId = setTimeout(() => {
    mo?.disconnect();
  }, timeoutMs);
}

// ── PROCESAMIENTO AL ABRIR UN PEDIDO ──────────────────────
let ultimoPedidoProcesado = null;
let enviando              = false;

function procesarPedido(popup) {
  const datos = extraerDatosModal(popup);

  if (!datos || !datos.numeroPedido)                    return;
  if (!datos.productos || datos.productos.length === 0) return;
  if (datos.numeroPedido === ultimoPedidoProcesado)      return;
  if (enviando)                                          return;

  enviando = true;
  mostrarToast('capturando', 'Capturando pedido...', `Nº ${datos.numeroPedido}`);

  chrome.runtime.sendMessage({ tipo: 'pedido_nuevo', datos }, (response) => {
    enviando = false;
    if (chrome.runtime.lastError) {
      mostrarToast('error', 'Error al enviar', chrome.runtime.lastError.message, 5000);
      return;
    }
    if (response?.ok) {
      ultimoPedidoProcesado = datos.numeroPedido;
      reproducirAlerta();
      mostrarToast('enviado', '¡Pedido registrado!', `Nº ${datos.numeroPedido} → Tada`, 4000);

      // Si el motorizado no vino en el modal, esperarlo via MO (instantáneo)
      if (!datos.motorizado) {
        esperarMotorizado(datos.numeroPedido);
      }
    }
  });
}

// ── NOMBRES DE EVENTOS A INTENTAR (en orden de preferencia) ──
// Si hxOpen cambia de nombre, agregar el nuevo aquí
const EVENTOS_APERTURA = ['hxOpen', 'hxShow', 'open', 'show', 'hxVisible', 'hxReady'];

// ── REGISTRAR TODOS LOS MECANISMOS EN UN POPUP ────────────
function registrarPopup(popup) {
  if (popup._tadaRegistrado) return;
  popup._tadaRegistrado = true;

  let yaEjecutado = false;

  function disparar() {
    if (yaEjecutado) return;
    if (!popup.querySelector('[class*="order-flow"]')) return;
    yaEjecutado = true;
    procesarPedido(popup);
  }

  // ── Capa 1: eventos de apertura conocidos ──────────────
  EVENTOS_APERTURA.forEach(evento => {
    popup.addEventListener(evento, () => disparar());
  });

  // ── Capa 2: MutationObserver en el popup mismo ─────────
  // Si ningún evento funciona, detectar cuando el contenido se hidrata
  const moPopup = new MutationObserver(() => {
    if (yaEjecutado) {
      moPopup.disconnect();
      return;
    }
    const allTexts      = Array.from(popup.querySelectorAll('hexa-v2-text'));
    const tienePedido   = allTexts.some(el => getHexaText(el) === 'Pedido');
    const tieneProducto = !!popup.querySelector('[class*="product-description"], [class*="products-container"]');

    if (tienePedido && tieneProducto) {
      moPopup.disconnect();
      disparar();
    }
  });
  moPopup.observe(popup, { childList: true, subtree: true, characterData: true });

  // ── Capa 3: polling de emergencia (último recurso) ─────
  // Si ni eventos ni MO funcionan, verificar cada 200ms por 3 segundos
  let pollCount = 0;
  const poll = setInterval(() => {
    pollCount++;
    if (yaEjecutado || pollCount > 15) {
      clearInterval(poll);
      return;
    }
    const allTexts      = Array.from(popup.querySelectorAll('hexa-v2-text'));
    const tienePedido   = allTexts.some(el => getHexaText(el) === 'Pedido');
    const tieneProducto = !!popup.querySelector('[class*="product-description"], [class*="products-container"]');

    if (tienePedido && tieneProducto) {
      clearInterval(poll);
      disparar();
    }
  }, 200);
}

// ── OBSERVER: detecta cuando se agrega un hexa-v2-popup ───
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'HEXA-V2-POPUP') {
        registrarPopup(node);
        return;
      }
      if (node.querySelectorAll) {
        node.querySelectorAll('hexa-v2-popup').forEach(registrarPopup);
      }
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });

// Registrar cualquier popup que ya exista al cargar el script
document.querySelectorAll('hexa-v2-popup').forEach(registrarPopup);