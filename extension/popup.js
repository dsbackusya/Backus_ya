// ============================================================
//  TaDa Order Scraper — Popup Script
// ============================================================

async function cargarEstado() {
  const { historial = [], cola = [] } = await chrome.storage.local.get(['historial', 'cola']);

  document.getElementById('totalEnviados').textContent = historial.filter(p => p.enviado).length;
  document.getElementById('totalCola').textContent     = cola.length;

  const badge = document.getElementById('estadoBadge');
  if (cola.length > 0) {
    badge.textContent = cola.length + ' pendientes';
    badge.className   = 'badge error';
  } else {
    badge.textContent = 'Activo';
    badge.className   = 'badge';
  }

  const lista   = document.getElementById('listaUltimos');
  const ultimos = historial.slice(0, 5);
  lista.innerHTML = ultimos.length === 0
    ? '<div class="empty">Sin pedidos registrados aún</div>'
    : ultimos.map(p => `
        <div class="pedido-item">
          <div>
            <div class="pedido-id">№ ${p.numeroPedido}</div>
            <div style="color:#888; font-size:11px">${p.cliente} · ${p.productos?.length || 0} prod.</div>
          </div>
          <div class="pedido-total">${p.total}</div>
        </div>
      `).join('');
}

// ── Banner de captura ──────────────────────────────────────
const banner   = document.getElementById('bannerCaptura');
const spinner  = document.getElementById('bannerSpinner');
const iconEl   = document.getElementById('bannerIcon');
const textoEl  = document.getElementById('bannerTexto');
const numeroEl = document.getElementById('bannerNumero');

const CONFIG_BANNER = {
  idle:       null,
  capturando: { clase: 'capturando', spinner: true, icon: '',   texto: 'Capturando pedido...' },
  enviado:    { clase: 'enviado',    spinner: false, icon: '✅', texto: 'Enviado a Tada' },
  error:      { clase: 'error',      spinner: false, icon: '❌', texto: 'Error al enviar' },
};

function actualizarBanner(captura) {
  if (!captura || captura.estado === 'idle') {
    banner.className = '';
    banner.style.display = 'none';
    return;
  }
  const cfg = CONFIG_BANNER[captura.estado];
  if (!cfg) return;

  banner.className       = cfg.clase;
  banner.style.display   = 'flex';
  spinner.style.display  = cfg.spinner ? 'block' : 'none';
  iconEl.style.display   = cfg.icon    ? 'inline' : 'none';
  iconEl.textContent     = cfg.icon;
  textoEl.textContent    = cfg.texto;
  numeroEl.textContent   = captura.numeroPedido ? `№ ${captura.numeroPedido}` : '';
}

async function checkCaptura() {
  const { captura } = await chrome.storage.local.get(['captura']);
  actualizarBanner(captura || { estado: 'idle' });
}

// Polling cada 800ms mientras el popup esté abierto
checkCaptura();
const intervalo = setInterval(checkCaptura, 800);
window.addEventListener('unload', () => clearInterval(intervalo));

// ── Botones ────────────────────────────────────────────────
document.getElementById('btnReintentar').addEventListener('click', async () => {
  chrome.runtime.sendMessage({ tipo: 'reintentar_cola' });
  setTimeout(cargarEstado, 1500);
});

document.getElementById('btnLimpiar').addEventListener('click', async () => {
  await chrome.storage.local.set({ historial: [], cola: [] });
  // ── Sesión ─────────────────────────────────────────────────
async function mostrarVista() {
  const { sesion, sede } = await chrome.storage.local.get(['sesion', 'sede']);
  document.getElementById('vistaLogin').style.display     = sesion ? 'none' : 'block';
  document.getElementById('vistaPrincipal').style.display = sesion ? 'block' : 'none';
  if (sesion) {
    document.getElementById('sedeNombre').textContent  = sede || '';
    document.getElementById('sedeUsuario').textContent = sesion.usuario;
    cargarEstado();
  }
}

async function entrar() {
  const usuario  = document.getElementById('inUsuario').value;
  const password = document.getElementById('inPassword').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('btnLogin');
  if (!usuario.trim() || !password) { errEl.textContent = 'Ingresa usuario y contraseña'; return; }
  btn.disabled = true; errEl.textContent = '';
  chrome.runtime.sendMessage({ tipo: 'login', usuario, password }, (r) => {
    btn.disabled = false;
    if (chrome.runtime.lastError || !r?.ok) {
      errEl.textContent = r?.error || 'No se pudo conectar';
      return;
    }
    document.getElementById('inPassword').value = '';
    mostrarVista();
  });
}

document.getElementById('btnLogin').addEventListener('click', entrar);
document.getElementById('inPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
document.getElementById('btnLogout').addEventListener('click', () => {
  chrome.runtime.sendMessage({ tipo: 'logout' }, mostrarVista);
});

mostrarVista();
});

// ── Sesión ─────────────────────────────────────────────────
async function mostrarVista() {
  const { sesion, sede } = await chrome.storage.local.get(['sesion', 'sede']);
  document.getElementById('vistaLogin').style.display     = sesion ? 'none' : 'block';
  document.getElementById('vistaPrincipal').style.display = sesion ? 'block' : 'none';
  if (sesion) {
    document.getElementById('sedeNombre').textContent  = sede || '';
    document.getElementById('sedeUsuario').textContent = sesion.usuario;
    cargarEstado();
  }
}

async function entrar() {
  const usuario  = document.getElementById('inUsuario').value;
  const password = document.getElementById('inPassword').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('btnLogin');
  if (!usuario.trim() || !password) { errEl.textContent = 'Ingresa usuario y contraseña'; return; }
  btn.disabled = true; errEl.textContent = '';
  chrome.runtime.sendMessage({ tipo: 'login', usuario, password }, (r) => {
    btn.disabled = false;
    if (chrome.runtime.lastError || !r?.ok) {
      errEl.textContent = r?.error || 'No se pudo conectar';
      return;
    }
    document.getElementById('inPassword').value = '';
    mostrarVista();
  });
}

document.getElementById('btnLogin').addEventListener('click', entrar);
document.getElementById('inPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
document.getElementById('btnLogout').addEventListener('click', () => {
  chrome.runtime.sendMessage({ tipo: 'logout' }, mostrarVista);
});

mostrarVista();