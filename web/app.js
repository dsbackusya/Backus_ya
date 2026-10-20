/* ── ÍCONOS SVG (reemplazan a los emoji): ICO('warn',14) · modo 's' sin margen, 'l' margen a la izquierda ── */
var _ICO_P={
  warn:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  refresh:'<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  undo:'<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  swap:'<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  right:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  left:'<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  wifioff:'<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  reloj:'<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  bolt:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  caja:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  botella:'<path d="M10 2h4v4l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3z"/>',
  info:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
};
function ICO(n,sz,modo){
  sz=sz||14;
  return '<svg class="ico-s'+(modo?' '+modo:'')+'" width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(_ICO_P[n]||'')+'</svg>';
}

/* ── SESSION KEEP-ALIVE: ping cada 30 min, redirige a login si expiró ── */
var _sessionPingInterval=null;
function _startSessionPing(){
  if(_sessionPingInterval)clearInterval(_sessionPingInterval);
  _sessionPingInterval=setInterval(function(){
    if(!S.token)return;
    google.script.run
      .withSuccessHandler(function(r){
        if(!r||!r.ok){
          clearInterval(_sessionPingInterval);
          clearSession();
          showToast('Tu sesión expiró. Vuelve a ingresar.','err');
          setTimeout(function(){
            document.getElementById('s-app').classList.remove('active');
            document.getElementById('s-login').classList.add('active');
            document.getElementById('inp-p').value='';
            toggleMobileMenu(false);
          },2000);
        }
      })
      .withFailureHandler(function(){/* timeout de red — ignorar, reintentar en el próximo ciclo */})
      .pingSession(S.token);
  },30*60*1000); // cada 30 minutos
}

/* ── DEBOUNCE — evita recalcular tabla en cada keystroke ── */
function _debounce(fn, ms) {
  var t;
  return function() { clearTimeout(t); t = setTimeout(fn, ms); };
}

/* ── PROMISE WRAPPER para google.script.run ──
   Permite async/await + try/catch unificados.
   Uso: var r = await gscript('getStock', S.token, false);
   Si el handler de éxito recibe r==null (timeout silencioso de GAS),
   la promesa resuelve con null — el caller debe validar. */
function gscript(fnName) {
  var args = Array.prototype.slice.call(arguments, 1);
  return new Promise(function(resolve, reject) {
    var runner = google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(reject);
    if (typeof runner[fnName] !== 'function') {
      reject(new Error('gscript: función no existe: ' + fnName));
      return;
    }
    runner[fnName].apply(runner, args);
  });
}

/* ── DEBUG LOG — silenciable en producción ──
   En mobile WebViews los console.log frenan; en producción dejar DEBUG=false.
   Para activar en runtime desde la consola: window.DS_DEBUG = true; */
window.DS_DEBUG = window.DS_DEBUG || false;
function dbg() {
  if (!window.DS_DEBUG) return;
  if (window.console && console.log) console.log.apply(console, arguments);
}

/* ── MODAL CONFIRMACIÓN GENÉRICO — reemplaza confirm() nativo bloqueante ──
   Uso: _confirmDialog('Título', 'Mensaje', function(){ ... acción confirmada ... });
   Funciona en mobile WebView donde confirm() puede no mostrarse. */
var _confirmCallback = null;
function _confirmDialog(title, msg, onOk, okLabel) {
  document.getElementById('modal-confirm-title').textContent = title || '¿Confirmar acción?';
  document.getElementById('modal-confirm-msg').textContent   = msg   || '';
  document.getElementById('modal-confirm-ok').textContent    = okLabel || 'Confirmar';
  _confirmCallback = onOk;
  document.getElementById('modal-confirm').style.display = 'flex';
}
function _confirmOk() {
  document.getElementById('modal-confirm').style.display = 'none';
  if (typeof _confirmCallback === 'function') { var cb = _confirmCallback; _confirmCallback = null; cb(); }
}
function _confirmCancel() {
  document.getElementById('modal-confirm').style.display = 'none';
  _confirmCallback = null;
}

// Modal con lista desplegable
var _selectCallback = null;
function _selectDialog(title, label, opciones, valorActual, onOk) {
  document.getElementById('modal-input-title').textContent = title || 'Seleccionar';
  document.getElementById('modal-input-label').textContent = label || '';
  var inp = document.getElementById('modal-input-field');
  // Reemplazar input por select temporalmente
  var sel = document.getElementById('modal-input-select');
  if (!sel) {
    sel = document.createElement('select');
    sel.id = 'modal-input-select';
    sel.className = 'inp filter-select';
    sel.style.width = '100%';
    inp.parentNode.insertBefore(sel, inp);
  }
  inp.style.display = 'none';
  sel.style.display = '';
  sel.innerHTML = opciones.map(function(o){
    return '<option value="'+esc(o)+'"'+(o===valorActual?' selected':'')+'>'+esc(o)+'</option>';
  }).join('');
  _selectCallback = onOk;
  document.getElementById('modal-input').style.display = 'flex';
  setTimeout(function(){ sel.focus(); }, 80);
}
function _selectOk() {
  var sel = document.getElementById('modal-input-select');
  var val = sel ? sel.value : '';
  // Restaurar input
  sel.style.display = 'none';
  document.getElementById('modal-input-field').style.display = '';
  document.getElementById('modal-input').style.display = 'none';
  if (typeof _selectCallback === 'function') { var cb = _selectCallback; _selectCallback = null; cb(val); }
}
function _selectCancel() {
  var sel = document.getElementById('modal-input-select');
  if (sel) sel.style.display = 'none';
  document.getElementById('modal-input-field').style.display = '';
  document.getElementById('modal-input').style.display = 'none';
  _selectCallback = null;
}
// Despachadores unificados para el modal de input — el HTML usa estos
function _modalInputOk()     { if (_selectCallback) _selectOk();    }
function _modalInputCancel() { if (_selectCallback) _selectCancel(); }
// Declaradas aquí; se inicializan al final del bloque <script>,
// después de que todas las funciones _filterXxx están definidas.
var filterStock, filterSalidas, filterEntradas, filterMT, filterCancelados, filterConteo;

var S={token:null,usuario:null,rol:null,sheetId:null};
var DATA={stock:[],salidas:[],entradas:[],mt:[],conteo:[],cancelados:[],oc:[]};
var _conteoBuffer = [];
var CACHE_CONTEO_KEY = 'ds_conteo_historial_v1';
var _cnt = {ean:'',sku:'',sap:'',producto:'',multiplicador:1,_stock:null};
var EDIT_ROW=null;
var _STOCK_ESTADO_FILTRO = ''; // '', 'con', 'sin', 'neg'


/* ── LOADER — anillo lavanda + texto (único para todas las pantallas) ── */
var _LD_NOM={dashboard:'dashboard',stock:'stock',entradas:'entradas',salidas:'salidas',mt:'mermas y traslados',cancelados:'cancelados',maestro:'maestro',mconteo:'maestro de conteo',conteo:'conteo',envases:'envases',validacion:'validación'};
function LD(txt){
  return '<div class="loading ld"><div class="ld-ring"></div><div class="ld-txt">'+esc(txt)+'<span class="ld-dots"></span></div></div>';
}

function LDm(txt){
  return '<div class="ld-mini"><span class="ld-ring"></span>'+esc(txt)+'<span class="ld-dots"></span></div>';
}

/* ── SESSION STORAGE ──
   localStorage: la sesión sobrevive al cerrar la app o el navegador (celular/PWA) y solo termina
   con "Cerrar sesión" o si el servidor la invalida. Clave versionada (_v2). */
var _SESSION_KEY = 'ds_session_v2';

function saveSession(data){
  try{localStorage.setItem(_SESSION_KEY, JSON.stringify(data));}catch(e){}
}
function loadSession(){
  try{
    var ss = localStorage.getItem(_SESSION_KEY);
    if(ss) return JSON.parse(ss);
  }catch(e){}
  return null;
}
function clearSession(){
  try{localStorage.removeItem(_SESSION_KEY);}catch(e){}
  // Limpiar claves legacy de versiones anteriores
  try{sessionStorage.removeItem(_SESSION_KEY);}catch(e){}
  try{sessionStorage.removeItem('ds_session');}catch(e){}
  try{localStorage.removeItem('ds_session');}catch(e){}
}

/* ── SESIÓN EXPIRADA — helper centralizado ──
   Retorna true si r indica expiración y ya lanzó el redirect.
   Llamar al inicio de cada render: if(_handleExpired(r,'root-id')) return; */
function _handleExpired(r, rootId){
  // Solo actuar si el servidor devuelve explícitamente expired:true
  // Un r===null puede ser un error de GAS/timeout, no necesariamente sesión expirada
  if(r && r.expired === true && !r.ok){
    clearSession();
    if(rootId) errBox(rootId, 'Sesión expirada. Redirigiendo al login...');
    showToast('Sesión expirada. Vuelve a ingresar.','err-crit');
    setTimeout(function(){doLogout();}, 1800);
    return true;
  }
  return false;
}

/* ── LOGIN ── */
function doLogin(){
  var u=document.getElementById('inp-u').value.trim();
  var p=document.getElementById('inp-p').value;
  var err=document.getElementById('l-err');
  var btn=document.getElementById('btn-login');
  if(!u||!p){err.textContent='Completa todos los campos';return;}
  err.textContent='';btn.disabled=true;btn.textContent='Verificando...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Ingresar';
      if(!r.ok){err.textContent=r.error;return;}
      S={token:r.token,usuario:r.usuario,rol:r.rol,sheetId:r.sheetId};
      saveSession(S);
      showLoadingAndInit();
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Ingresar';err.textContent='Error: '+e.message;})
    .login(u,p);
}
document.getElementById('inp-p').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});

function doLogout(){
  google.script.run.cerrarSesion(S.token);
  if(_sessionPingInterval){clearInterval(_sessionPingInterval);_sessionPingInterval=null;}
  if(window.TadaRealtime) TadaRealtime.detener();
  S={};DATA={stock:[],salidas:[],entradas:[],mt:[],conteo:[],cancelados:[],oc:[]};window.sal_rango=null;window.ent_rango=null;window.cnt_rango=null;window.mt_rango=null;window.canc_rango=null;
  PAGE_LOADED={dashboard:false,stock:false,entradas:false,salidas:false,mt:false,cancelados:false,maestro:false,mconteo:false,conteo:false,envases:false,validacion:false,oc:false};
  clearSession();
  document.getElementById('s-app').classList.remove('active');
  document.getElementById('s-login').classList.add('active');
  document.getElementById('inp-p').value='';
  document.getElementById('l-err').textContent='';
  toggleMobileMenu(false);
}

/* ── SIDEBAR TOGGLE ── */
var LS_KEY='ds-inv:'; // prefijo único — evita colisiones entre proyectos GAS en script.google.com
function toggleSidebar(){
  var sb=document.getElementById('sidebar');
  sb.classList.toggle('collapsed');
  try{localStorage.setItem(LS_KEY+'sb_collapsed',sb.classList.contains('collapsed')?'1':'0');}catch(e){}
}
(function(){
  try{
    if(localStorage.getItem(LS_KEY+'sb_collapsed')==='1'){
      var sb=document.getElementById('sidebar');
      if(sb){sb.classList.add('collapsed');}
    }
  }catch(e){}
})();

/* ── Menú lateral: nombre e iniciales de la sede de la sesión ── */
function _sedeBonita(n){
  n=String(n||'').trim();
  if(!n||n!==n.toUpperCase()) return n;
  return n.split(/\s+/).map(function(w){ return w.length<=2?w:w.charAt(0)+w.slice(1).toLowerCase(); }).join(' ');
}
function _sedeIniciales(n){
  var p=String(n||'').trim().split(/\s+/).filter(Boolean);
  if(p.length>1&&p[0].toUpperCase()==='DS') p.shift();
  if(!p.length) return '—';
  return (p.length===1?p[0].slice(0,2):p[0].charAt(0)+p[1].charAt(0)).toUpperCase();
}

/* ── Contador de "Por confirmar" (hoy) junto a Salidas ── */
var _sbSalTimer=null, _sbSalReq=0;
function _sbSalidasRefrescar(){
  clearTimeout(_sbSalTimer);
  _sbSalTimer=setTimeout(function(){
    if(!S||!S.token) return;
    var t=++_sbSalReq;
    google.script.run
      .withSuccessHandler(function(r){
        if(t!==_sbSalReq||!r||!r.ok) return;
        var n=(r.data||[]).filter(function(x){return _salEstadoLinea(x)==='pen';}).length;
        var b=document.getElementById('sb-badge-salidas');
        if(!b) return;
        b.textContent=n>99?'99+':n;
        b.style.display=n>0?'':'none';
        var it=document.getElementById('nav-salidas'); if(it) it.classList.toggle('con-badge',n>0);
      })
      .withFailureHandler(function(){})
      .getSalidas(S.token,true,null);
  },1200);
}
setInterval(function(){ if(document.visibilityState==='visible') _sbSalidasRefrescar(); },300000);

/* ── INIT ── */
function initApp(){
  document.getElementById('s-login').classList.remove('active');
  document.getElementById('s-app').classList.add('active');
  var sede=_sedeBonita(S.usuario||'—');
  document.getElementById('sb-sede').textContent=sede;
  document.getElementById('sb-user-name').textContent=sede;
  var mk=document.getElementById('sb-logomark'); if(mk) mk.textContent=_sedeIniciales(sede);
  var av=document.getElementById('sb-avatar');
  if(av)av.textContent=sede.charAt(0).toUpperCase();
  _sbSalidasRefrescar();
  _startSessionPing();
  _salVivoIniciar();
  _backIniciar();
  var esAdmin=S.rol==='admin'||S.rol==='invitado';
  document.querySelectorAll('.sb-store-only').forEach(function(el){ el.style.display=esAdmin?'none':''; });
  document.querySelectorAll('.sb-admin-only').forEach(function(el){ el.style.display=esAdmin?'':'none'; });
  if(esAdmin){ navTo('dashboard',document.getElementById('nav-dashboard')); }
  else { navTo('stock',document.getElementById('nav-stock')); }
}

/* ── AUTO-RESTORE SESSION ON LOAD ── */

/* NAV state — declarado ANTES del auto-restore para evitar undefined si GAS responde rápido */
var PAGE_TITLES={'dashboard':'Dashboard','stock':'Stock Actual','entradas':'Entradas','salidas':'Salidas','mt':'Mermas & Traslados','cancelados':'Pedidos Cancelados','maestro':'Maestro de Productos (Bees)','mconteo':'Maestro de Conteo','conteo':'Conteo de Inventario','envases':'Control de Envases','validacion':'Validación de Inventario'};
var PAGE_LOADED={dashboard:false,stock:false,entradas:false,salidas:false,mt:false,cancelados:false,maestro:false,mconteo:false,conteo:false,envases:false,validacion:false,oc:false};

(function(){
  var saved=loadSession();
  // El loader screen fue removido del DOM; backToLogin solo muestra login directamente.
  function backToLogin(){
    var lg=document.getElementById('s-login');
    if(lg){lg.classList.add('active');}
  }
  if(!saved||!saved.token){backToLogin();return;}
  // Verificar que el token sigue válido en el servidor
  google.script.run
    .withSuccessHandler(function(r){
      if(!r||r.expired||!r.ok){
        clearSession();
        backToLogin();
        return;
      }
      S=saved;
      showLoadingAndInit(true);
    })
    .withFailureHandler(function(){
      // Sin red al abrir la app: se conserva la sesión (los conteos pendientes siguen en cola)
      S=saved;
      showLoadingAndInit(true);
    })
    .pingSession(saved.token);
})();

var CURRENT_PAGE = '';

function navTo(name,btn){
  CURRENT_PAGE = name;
  ['dashboard','stock','entradas','salidas','mt','cancelados','maestro','mconteo','conteo','envases','validacion'].forEach(function(n){
    document.getElementById('p-'+n).classList.remove('active');
    document.getElementById('nav-'+n).classList.remove('active');
  });
  document.getElementById('p-'+name).classList.add('active');
  if(btn)btn.classList.add('active');
  // Maestro es un grupo: se abre y se resalta cuando se entra a Conteo o Bees
  var enMaestro=(name==='maestro'||name==='mconteo');
  var grp=document.getElementById('sb-grp-maestro');
  if(grp){
    grp.classList.toggle('has-active',enMaestro);
    if(enMaestro) _setSbGrp(true);
  }
  document.getElementById('pg-title').textContent=PAGE_TITLES[name]||name;
  renderTopbarActions(name);
  if(name==='cancelados'){PAGE_LOADED[name]=false;} // siempre fresco al entrar
  if(name==='validacion' && PAGE_LOADED[name]) _valFechaHoy();
  if(!PAGE_LOADED[name]){PAGE_LOADED[name]=true;loadPage(name);}
  // Sync bottom nav + cerrar mobile menu si está abierto
  syncBottomNav(name);
  var sb=document.getElementById('sidebar');
  if(sb && sb.classList.contains('mobile-open') && window.innerWidth<=900){
    toggleMobileMenu(false);
  }
}

function renderTopbarActions(name){
  var el=document.getElementById('topbar-actions');
  // SVGs para iconos
  var icoExport='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var icoRefresh='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  // En mobile solo mostramos icono, en desktop texto completo
  var btnExport='<button id="btn-export-'+name+'" class="btn btn-ghost btn-sm tb-btn-icon" title="Exportar" onclick="export'+_cap(name)+'()">'+icoExport+'<span class="tb-btn-label"> Exportar</span></button>';
  var btnRefresh='<button class="btn btn-ghost btn-sm tb-btn-icon" title="Actualizar" onclick="reloadPage(\''+name+'\')">'+icoRefresh+'<span class="tb-btn-label"> Actualizar</span></button>';

  if(name==='dashboard'){
    var esAdm=S&&S.rol!=='invitado'; // cargar y validar OC: cualquier cuenta que escribe (el invitado es solo lectura)
    el.innerHTML=(esAdm?'<button class="btn btn-primary btn-sm" onclick="abrirImportarOC()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Cargar OC</span></button>'+
      '<button class="btn btn-ghost btn-sm" id="btn-oc-validar" onclick="validarRecepcionOC()" style="border-color:var(--accent);color:var(--accent)">'+icoRefresh+'<span class="tb-btn-label"> Validar OC</span></button>':'')+
      '<button class="btn btn-ghost btn-sm tb-btn-icon" title="Exportar órdenes de compra" onclick="exportOC()">'+icoExport+'<span class="tb-btn-label"> Exportar OC</span></button>'+btnRefresh;
  } else if(name==='stock'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirSKUForm(null)"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Nuevo SKU</span></button>'+btnExport+btnRefresh;
  } else if(name==='salidas'){
    var btnPedido=(S&&S.rol==='store')?'<button class="btn btn-primary btn-sm" onclick="abrirPedidoManual()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Agregar pedido</span></button>':'';
    el.innerHTML=btnPedido+btnExport+btnRefresh;
  } else if(name==='entradas'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirEntrada()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Registrar entrada</span></button>'+btnExport+btnRefresh;
  } else if(name==='mt'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirNuevoMT()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Registrar M-T</span></button>'+btnExport+btnRefresh;
  } else if(name==='cancelados'){
    el.innerHTML=btnExport+btnRefresh;
  } else if(name==='maestro'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirMaestroForm(null)"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Agregar al maestro</span></button>'+btnExport+btnRefresh;
  } else if(name==='mconteo'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirMConteoForm(null)"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Agregar producto</span></button>'+btnExport+btnRefresh;
  } else if(name==='conteo'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirConteo()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Registrar conteo</span></button>'+btnExport+
      '<button class="btn btn-ghost btn-sm tb-btn-icon" title="Actualizar" onclick="reloadConteoForce()">'+icoRefresh+'<span class="tb-btn-label"> Actualizar</span></button>';
  } else if(name==='envases'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="envAbrirConteo()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Registrar conteo</span></button>'+btnExport+btnRefresh;
  } else if(name==='validacion'){
    el.innerHTML='<button class="btn btn-ghost btn-sm tb-btn-icon" title="Actualizar" onclick="correrValidacion(true)">'+icoRefresh+'<span class="tb-btn-label"> Actualizar</span></button>'+
      '<button class="btn btn-ghost btn-sm tb-btn-icon" title="Exportar Excel" onclick="exportValidacion()">'+icoExport+'<span class="tb-btn-label"> Exportar Excel</span></button>';
  } else { el.innerHTML=''; }
}
// Capitaliza nombres de página para construir el handler "export<Page>()".
// Casos especiales para siglas que deben ir en mayúsculas completas (ej: MT, no Mt).
var _EXPORT_NAME_MAP = { mt:'MT', oc:'OC' };
function _cap(s){
  if(!s) return '';
  if(_EXPORT_NAME_MAP[s]) return _EXPORT_NAME_MAP[s];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

var PAGE_LOADING={}; // flag anti-doble-disparo por página
var _FORCE_REFRESH={}; // se activa en reloadPage — le indica a loadXxx que ignore el caché del servidor
// REQ_TOKEN: contador por página. Si el usuario navega rápido (salidas a entradas),
// la respuesta vieja de salidas llega tarde y no debe pisar el render de entradas.
// Cada loadXxx incrementa su contador; el handler descarta si ya no coincide.
var REQ_TOKEN={};

function reloadPage(name){
  dbg('[RELOAD] reloadPage("'+name+'") — PAGE_LOADING='+PAGE_LOADING[name]+' PAGE_LOADED='+PAGE_LOADED[name]+' token='+(S&&S.token?'OK':'NULL'));
  if(PAGE_LOADING[name]) { console.warn('[RELOAD] BLOQUEADO — ya hay carga en curso'); return; }
  PAGE_LOADING[name]=true;
  PAGE_LOADED[name]=false;
  _FORCE_REFRESH[name]=true; // forzar bypass de caché en el servidor
  if(DATA[name] !== undefined) DATA[name]=[]; // limpiar datos stale
  // Al recargar conteo, invalidar caché local de MCONTEO — el SS puede haber cambiado
  if(name === 'conteo' || name === 'mconteo'){ _MCONTEO_LOCAL=null; _MCONTEO_PENDING=[]; _MCONTEO_EAN_IDX={}; _MCONTEO_SKU_IDX={}; }
  var skRoot=document.getElementById(name+'-root');
  if(name==='cancelados'){
    skRoot.innerHTML=skeletonCancelados();
  } else {
    skRoot.innerHTML=LD('Actualizando '+(_LD_NOM[name]||name));
  }
  loadPage(name);
}

function loadPage(name){
  dbg('[LOAD] loadPage("'+name+'") — token='+(S&&S.token?'OK':'NULL')+' online='+_isOnline());
  PAGE_LOADED[name]=true; // marcar aquí: evita doble-disparo si el usuario navega rápido
  // Si estamos offline, mostrar mensaje amigable en lugar de lanzar llamadas que fallarán
  if(!_isOnline() && name !== 'validacion'){
    PAGE_LOADING[name]=false;
    var rootEl=document.getElementById(name+'-root');
    if(rootEl){
      // Conteo es la única página usable offline — no mostrar error, dejar lo que hay
      if(name==='conteo' && DATA.conteo && DATA.conteo.length>0){
        renderConteo({ok:true, data:DATA.conteo});
        return;
      }
      rootEl.innerHTML=
        '<div class="empty" style="gap:14px">'+
          '<div class="ico">'+ICO('wifioff',34,'s')+'</div>'+
          '<div style="font-size:14px;font-weight:600;color:var(--text2)">Sin conexión</div>'+
          '<div style="font-size:13px;color:var(--text3);text-align:center;max-width:280px">'+
            'Esta sección requiere internet. Tus conteos en curso están guardados localmente.'+
          '</div>'+
          '<button class="btn btn-ghost btn-sm" onclick="reloadPage(\''+name+'\')">'+ICO('refresh',14)+'Reintentar</button>'+
        '</div>';
    }
    return;
  }
  // PAGE_LOADING se limpia al terminar (éxito o error) vía los handlers de cada loadXxx
  if(name==='dashboard')  loadDashboard();
  if(name==='stock')      loadStock();
  if(name==='salidas')    loadSalidas();
  if(name==='entradas')   loadEntradas();
  if(name==='mt')         loadMT();
  if(name==='cancelados') loadCancelados();
  if(name==='maestro')    loadMaestro();
  if(name==='mconteo')    loadMconteo();
  if(name==='conteo')     loadConteo();
  if(name==='envases')    loadEnvases();
  if(name==='validacion') initValidacion();
}

/* ══════════════════════════════════════
   STOCK
══════════════════════════════════════ */
/* ══════════════════════════════════════
   DASHBOARD — admin / invitado
══════════════════════════════════════ */
var DASH={d:null,m:null,sede:'',hl:'',ts:null,q:'',est:'',rec:null};

function loadDashboard(){
  if(!S||!S.token){errBox('dashboard-root','Sin sesión activa.','dashboard');PAGE_LOADING['dashboard']=false;return;}
  _FORCE_REFRESH['dashboard']=false;
  var t = (REQ_TOKEN.dashboard = (REQ_TOKEN.dashboard||0) + 1);
  var res={dash:null,oc:null}, falta=2;
  var listo=function(){
    if(--falta>0||t!==REQ_TOKEN.dashboard) return;
    PAGE_LOADING['dashboard']=false;
    DATA.oc=(res.oc&&res.oc.ok)?res.oc.data:[];
    renderDashboard(res.dash);
  };
  google.script.run
    .withSuccessHandler(function(r){ res.dash=r; listo(); })
    .withFailureHandler(function(e){ res.dash={ok:false,error:e.message}; listo(); })
    .getDashboard(S.token);
  google.script.run
    .withSuccessHandler(function(r){ res.oc=r; listo(); })
    .withFailureHandler(function(){ res.oc=null; listo(); })
    .getOrdenesCompra(S.token);
}

function _dashDias(fechaISO, hoyISO){
  if(!fechaISO) return null;
  return Math.round((Date.parse(fechaISO+'T00:00:00Z')-Date.parse(hoyISO+'T00:00:00Z'))/86400000);
}
function _dashFecha(iso){ var p=String(iso||'').split('-'); return p.length===3?p[2]+'/'+p[1]:''; }

// Convierte lo que devuelve la base en OC por columna y alertas por sede
function _dashModelo(d){
  var nom={}; (d.sedes||[]).forEach(function(s){ nom[s.id]=s.nombre; });
  var sedeN=function(id){ return nom[id]||'Sin sede'; };
  var ocs=(d.oc||[]).map(function(o){
    var dias=_dashDias(o.fecha,d.hoy), col, txt;
    if(o.estado==='Recibido'){ col='r'; txt=dias===null?'Recibida':(dias===0?'Hoy':dias===-1?'Ayer':'Hace '+(-dias)+' d'); }
    else if(dias===null){ col='p'; txt='Sin fecha'; }
    else if(dias<0){ col='v'; txt='Vencida '+(-dias)+(dias===-1?' día':' d'); }
    else if(dias===0){ col='h'; txt='Hoy'; }
    else { col='p'; txt=dias===1?'Mañana':'En '+dias+' d'; }
    return {oc:o.oc,pv:o.proveedor||'—',sedeId:o.sede_id,sede:sedeN(o.sede_id),col:col,txt:txt,fecha:o.fecha,dias:dias};
  });
  var al=[];
  (d.stock_negativo||[]).forEach(function(x){
    al.push({sede:sedeN(x.sede_id),sev:'rd',t:x.n+(x.n===1?' SKU con stock negativo':' SKUs con stock negativo'),
      d:'Salidas mayores a lo ingresado'+((x.ejemplos&&x.ejemplos.length)?'. Ej.: '+x.ejemplos.join(', '):''),ir:'Ver stock',go:'stock:neg'});
  });
  ocs.forEach(function(o){
    if(o.col==='v') al.push({sede:o.sede,sev:'rd',t:o.oc+' vencida hace '+(-o.dias)+(o.dias===-1?' día':' días'),
      d:'Esperada el '+_dashFecha(o.fecha)+' · '+o.pv,ir:'Ver OC',go:'oc',key:o.oc});
    if(o.col==='h') al.push({sede:o.sede,sev:'am',t:o.oc+' llega hoy',d:o.pv+' · falta registrar la entrada',ir:'Ver OC',go:'oc',key:o.oc});
  });
  (d.pedidos_duplicados||[]).forEach(function(x){
    al.push({sede:sedeN(x.sede_id),sev:'am',t:x.n+(x.n===1?' pedido está':' pedidos están')+' en Salidas y en Cancelados',
      d:'Posible duplicado: confirma cuál es el vigente',ir:'Revisar',go:'cancelados'});
  });
  (d.sin_stock_con_demanda||[]).forEach(function(x){
    al.push({sede:sedeN(x.sede_id),sev:'am',t:x.n+(x.n===1?' SKU sin stock con salidas':' SKUs sin stock con salidas')+' esta semana',
      d:'Había demanda en los últimos 7 días y hoy está en cero o negativo',ir:'Ver stock',go:'stock:sin'});
  });
  var con={}; (d.con_conteo_hoy||[]).forEach(function(id){ con[id]=true; });
  (d.sedes||[]).forEach(function(s){
    if(!con[s.id]) al.push({sede:s.nombre,sev:'bl',t:'Sin conteo registrado hoy',d:'La validación de hoy quedará vacía hasta que cuenten',ir:'Ir a Conteo',go:'conteo'});
  });
  var ord={rd:0,am:1,bl:2};
  al.sort(function(a,b){ return ord[a.sev]-ord[b.sev]; });
  return {ocs:ocs,alertas:al,sedes:(d.sedes||[]).map(function(s){return s.nombre;})};
}

function renderDashboard(r){
  if(_handleExpired(r,'dashboard-root')) return;
  if(!r||!r.ok){errBox('dashboard-root',r?r.error:'Error desconocido','dashboard');return;}
  DASH.d=r.data; DASH.m=_dashModelo(r.data); DASH.ts=new Date(); DASH.hl='';
  if(DASH.sede && DASH.m.sedes.indexOf(DASH.sede)<0) DASH.sede='';
  dashDibujar();
}

function dashDibujar(){
  var root=document.getElementById('dashboard-root'); if(!root||!DASH.m) return;
  var m=DASH.m, sede=DASH.sede;
  var fs=function(x){ return !sede||x.sede===sede; };
  var al=m.alertas.filter(fs), ocs=m.ocs.filter(fs);
  var crit=al.filter(function(x){return x.sev==='rd';}).length, avis=al.filter(function(x){return x.sev==='am';}).length;
  var abiertas=ocs.filter(function(x){return x.col!=='r';});
  var venc=ocs.filter(function(x){return x.col==='v';}).length, hoyN=ocs.filter(function(x){return x.col==='h';}).length;
  var recib=ocs.filter(function(x){return x.col==='r';}).length;
  var fechaTxt=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',weekday:'long',day:'numeric',month:'long'}).format(new Date(DASH.d.hoy+'T12:00:00Z'));
  fechaTxt=fechaTxt.replace(',','');
  fechaTxt=fechaTxt.charAt(0).toUpperCase()+fechaTxt.slice(1);
  var hora=DASH.ts?DASH.ts.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}):'';

  var seg='';
  if(m.sedes.length>1){
    seg='<div class="dash-seg">'+[''].concat(m.sedes).map(function(s){
      return '<button class="'+(s===sede?'on':'')+'" onclick="dashSede(this.dataset.s)" data-s="'+esc(s)+'">'+(s||'Todas')+'</button>';
    }).join('')+'</div>';
  }

  var hero=
    '<div class="dash-hero">'+
      '<div class="dash-hc big"><div class="dash-k">Hoy requiere atención</div>'+
        '<div class="dash-v">'+al.length+' <span class="dash-v-s">'+(al.length===1?'cosa':'cosas')+'</span></div>'+
        '<div class="dash-msg">'+(al.length?((crit?crit+(crit===1?' crítica':' críticas'):'Nada crítico')+(avis?' y '+avis+(avis===1?' aviso':' avisos'):'')+'. Empieza por lo rojo.'):'Todo en orden.')+'</div></div>'+
      '<div class="dash-hc"><div class="dash-k">OC pendientes</div><div class="dash-v">'+abiertas.length+'</div><div class="dash-n">'+hoyN+(hoyN===1?' llega hoy':' llegan hoy')+'</div></div>'+
      '<div class="dash-hc"><div class="dash-k">OC vencidas</div><div class="dash-v" style="color:'+(venc?'var(--danger)':'var(--text)')+'">'+venc+'</div><div class="dash-n">sin recibir tras su fecha</div></div>'+
      '<div class="dash-hc"><div class="dash-k">Recibidas (7 días)</div><div class="dash-v" style="color:var(--ok)">'+recib+'</div><div class="dash-n">por fecha de recepción</div></div>'+
    '</div>';

  var cols=[['v','Vencidas','p-rd'],['h','Llegan hoy','p-am'],['p','Próximas','p-ac'],['r','Recibidas','p-ok']];
  var kan='<div class="dash-kan">'+cols.map(function(c){
    var l=ocs.filter(function(x){return x.col===c[0];});
    if(c[0]==='r') l=l.slice().reverse();
    return '<div class="dash-col"><div class="dash-colh">'+c[1]+'<span class="c">'+l.length+'</span></div>'+
      (l.length?l.map(function(x){
        return '<div class="dash-oc" data-oc="'+esc(x.oc)+'" onclick="dashResaltar(this.dataset.oc)">'+
          '<div class="n">'+esc(x.oc)+'</div><div class="p">'+esc(x.pv)+'</div>'+
          '<div class="f"><span>'+esc(x.sede)+'</span><span class="dash-pill '+c[2]+'">'+esc(x.txt)+'</span></div></div>';
      }).join(''):'<div class="dash-empty">Sin órdenes</div>')+'</div>';
  }).join('')+'</div>';

  var sedesMostrar=m.sedes.filter(function(s){return !sede||s===sede;});
  if(m.alertas.some(function(x){return x.sede==='Sin sede';})&&!sede) sedesMostrar=sedesMostrar.concat(['Sin sede']);
  var tarjetas='<div class="dash-sedes">'+sedesMostrar.map(function(s){
    var a=m.alertas.filter(function(x){return x.sede===s;}), nOC=m.ocs.filter(function(x){return x.sede===s&&x.col!=='r';}).length;
    var rojas=a.filter(function(x){return x.sev==='rd';}).length;
    var filas=a.length?a.map(function(x){
      var sel=DASH.hl&&x.key===DASH.hl;
      return '<div class="dash-li'+(sel?' hl':'')+'"><span class="dd '+x.sev+'"></span><div class="t">'+esc(x.t)+'<small>'+esc(x.d)+'</small></div>'+
        '<button data-go="'+esc(x.go)+'" data-key="'+esc(x.key||'')+'" onclick="dashIr(this.dataset.go,this.dataset.key)">'+esc(x.ir)+'</button></div>';
    }).join(''):'<div class="dash-okline"><i></i> Todo en orden</div>';
    return '<div class="dash-sd"><div class="dash-sdh"><div class="dash-sdn">'+esc(s)+'</div></div>'+
      '<div class="dash-sdsub">'+a.length+(a.length===1?' alerta · ':' alertas · ')+nOC+(nOC===1?' OC abierta':' OC abiertas')+'</div>'+
      '<div class="dash-mini"><div><b style="color:'+(rojas?'var(--danger)':'var(--text)')+'">'+rojas+'</b><span>críticas</span></div><div><b>'+nOC+'</b><span>OC abiertas</span></div></div>'+
      filas+'</div>';
  }).join('')+'</div>';

  var icoDl='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var dl=function(id,txt,fn){ return '<button class="dash-dl" id="'+id+'" onclick="'+fn+'">'+icoDl+' '+txt+'</button>'; };

  root.innerHTML=
    '<div class="dash-top"><div><div class="dash-h1">Dashboard</div><div class="dash-sub">'+esc(fechaTxt)+(hora?' · actualizado '+hora:'')+'</div></div>'+seg+'</div>'+
    hero+
    '<div class="dash-sec"><span>Órdenes de compra · estado de recepción</span><a onclick="dashVerOC(\'\')">Ver todas las OC '+ICO('right',13,'l')+'</a></div>'+kan+
    '<div class="dash-sec"><span>Qué atender por sede</span></div>'+tarjetas+
    '<div class="dash-sec"><span>Recepciones por tienda</span>'+
      '<span class="dash-sec-r"><input type="date" class="filter-inp" id="oc-recep-fecha" onchange="loadRecepcionesPorTienda(this.value)"/></span></div>'+
      '<div class="stats" id="oc-recep-grid"></div>'+
    '<div class="dash-sec" id="dash-oclist"><span>Todas las órdenes de compra</span><span class="result-count" id="oc-count"></span></div>'+
    '<div class="filters" style="flex-wrap:wrap;gap:8px;align-items:center">'+
      '<input class="filter-inp" id="oc-busq" placeholder="Buscar OC, proveedor, entrega..." style="width:260px" value="'+esc(DASH.q||'')+'" oninput="DASH.q=this.value;filterOC()"/>'+
      '<select class="filter-select" id="oc-estado-filtro" onchange="DASH.est=this.value;filterOC()">'+
        '<option value="">Todos los estados</option>'+
        '<option value="Pendiente"'+(DASH.est==='Pendiente'?' selected':'')+'>Pendiente</option>'+
        '<option value="Recibido"'+(DASH.est==='Recibido'?' selected':'')+'>Recibido</option>'+
        '<option value="Cancelada"'+(DASH.est==='Cancelada'?' selected':'')+'>Cancelada</option>'+
      '</select>'+
    '</div>'+
    '<div class="table-wrap"><table><thead><tr><th>Fecha recepción</th><th>Orden de compra</th><th>Proveedor</th><th>Nombre de entrega</th><th class="c">Estado</th></tr></thead><tbody id="oc-tbody"></tbody></table></div>'+
    '<div class="dash-sec"><span>Descargas</span></div>'+
    '<div class="dash-dls">'+dl('btn-dl-stock','Stock actual','dashExportStock()')+dl('btn-dl-salidas','Salidas','dashExportModulo(\'salidas\',\'btn-dl-salidas\')')+
      dl('btn-dl-entradas','Entradas','dashExportModulo(\'entradas\',\'btn-dl-entradas\')')+dl('btn-dl-mt','Mermas y traslados','dashExportModulo(\'mt\',\'btn-dl-mt\')')+'</div>';
  dashPostDibujo();
}

function dashPostDibujo(){
  filterOC();
  if(DASH.rec) renderRecepcionesPorTienda(DASH.rec); else loadRecepcionesPorTienda('');
}
function dashSede(s){ DASH.sede=s||''; DASH.hl=''; dashDibujar(); }
function dashResaltar(oc){ DASH.hl=(DASH.hl===oc?'':oc); dashDibujar(); }

// Lleva a la pantalla donde se resuelve la alerta (y aplica el filtro de stock cuando corresponde)
function dashVerOC(oc){
  DASH.q=oc||''; DASH.est='';
  dashDibujar();
  var el=document.getElementById('dash-oclist'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}
function dashIr(dest,key){
  if(dest==='oc'){ dashVerOC(key); return; }
  var p=String(dest).split(':'), pag=p[0], filtro=p[1]||'';
  navTo(pag,document.getElementById('nav-'+pag));
  if(pag==='stock'&&filtro){
    var n=0, iv=setInterval(function(){
      n++;
      if(document.getElementById('sbtn-'+filtro)){ clearInterval(iv); setStockFiltroEstado(filtro); }
      else if(n>40) clearInterval(iv);
    },150);
  }
}

function dashExportStock(){
  var btn=document.getElementById('btn-dl-stock'), orig=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.textContent='Preparando…';}
  google.script.run
    .withSuccessHandler(function(r){
      if(btn){btn.disabled=false;btn.innerHTML=orig;}
      if(!r||!r.ok){showToast(r?r.error:'Error al exportar','err');return;}
      _dashExportStockExcel(r.data||[]);
    })
    .withFailureHandler(function(e){ if(btn){btn.disabled=false;btn.innerHTML=orig;} showToast(e.message,'err'); })
    .getStockPackTodasSedes(S.token);
}
function _dashExportStockExcel(data){
  data=data||[];
  if(!data.length){showToast('Sin datos','err');return;}
  var sedes=[...new Set(data.map(function(x){return x.sede;}).filter(Boolean))].sort();
  if(!sedes.length){showToast('Sin datos multi-sede','err');return;}
  var skuMap={};
  data.forEach(function(r){
    if(!r.sku) return;
    if(!skuMap[r.sku]) skuMap[r.sku]={sku:r.sku,desc:'',marca:'',cat:'',sedes:{}};
    if(!skuMap[r.sku].desc&&r.desc) skuMap[r.sku].desc=r.desc;
    if(!skuMap[r.sku].marca&&r.marca) skuMap[r.sku].marca=r.marca;
    if(!skuMap[r.sku].cat&&r.categoria) skuMap[r.sku].cat=r.categoria;
    if(r.sede) skuMap[r.sku].sedes[r.sede]=(skuMap[r.sku].sedes[r.sede]||0)+(Number(r.stockPack)||0);
  });
  var headers=['SKU / Lovis','Descripción','Marca','Categoría'];
  sedes.forEach(function(s){headers.push(s+' · Stock pack');});
  headers.push('TOTAL Stock pack');
  var ws_data=[headers];
  Object.values(skuMap).sort(function(a,b){return a.sku.localeCompare(b.sku);}).forEach(function(item){
    var fila=[item.sku,item.desc,item.marca,item.cat];var total=0;
    sedes.forEach(function(s){var v=Math.round(item.sedes[s]||0);fila.push(v);total+=v;});
    fila.push(total);ws_data.push(fila);
  });
  var wb=XLSX.utils.book_new();var ws=XLSX.utils.aoa_to_sheet(ws_data);
  var colW=[{wch:14},{wch:40},{wch:16},{wch:18}];
  sedes.forEach(function(){colW.push({wch:16});});colW.push({wch:14});
  ws['!cols']=colW;XLSX.utils.book_append_sheet(wb,ws,'Stock por sede');
  XLSX.writeFile(wb,'stock_pivot_'+_hoyISO()+'.xlsx');
  showToast('Pivot Stock exportado ('+Object.keys(skuMap).length+' SKUs · '+sedes.length+' sedes)','ok');
}

function dashExportModulo(modulo,btnId){
  var HDR_MAP={
    salidas:{hdr:['Fecha','Hora','SKU','Nro. Pedido','Descripción','Pack','Unidad','Marca','Motorizado','Envases','Estado','Revisión','Tamaño'],
      cw:[{wch:12},{wch:8},{wch:14},{wch:14},{wch:36},{wch:8},{wch:8},{wch:14},{wch:16},{wch:10},{wch:12},{wch:12},{wch:10}],
      fn:function(r){return[r.fecha,r.hora,r.sku,r.nroPedido,r.desc,r.pack,r.unidad,r.marca||'',r.motorizado||'',r.envases||'',r.estado||'',r.revision||'',r.tamano||''];}},
    entradas:{hdr:['Fecha','Factura','SKU','Descripción','Unidades','F. Vencimiento','Proveedor','OC','Dynamics','Responsable'],
      cw:[{wch:12},{wch:16},{wch:14},{wch:36},{wch:10},{wch:14},{wch:20},{wch:14},{wch:12},{wch:16}],
      fn:function(r){return[r.fecha,r.factura,r.sku,r.desc,r.unidades,r.fVenc||'',r.proveedor,r.oc,r.dynamics,r.responsable];}},
    mt:{hdr:['Fecha','SKU','Descripción','Cantidad','Tipo','Motivo','Observaciones','Estado','Nro de factura','Fecha del retiro'],
      cw:[{wch:12},{wch:14},{wch:36},{wch:10},{wch:10},{wch:20},{wch:24},{wch:12},{wch:16},{wch:14}],
      fn:function(r){return[r.fecha,r.sku,r.desc,r.cant,r.tipo,r.motivo||'',r.obs||'',r.estado||'',r.nroFactura||'',r.fechaRetiro||''];}}
  };
  var cfg=HDR_MAP[modulo];if(!cfg){showToast('Módulo no soportado','err');return;}
  _exportConSpinner(btnId,modulo,function(sedes){
    _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:cfg.hdr,rows:s.data,colWidths:cfg.cw,mapFn:cfg.fn};}),modulo+'_sedes');
  });
}

function loadStock(){
  if(!S||!S.token){errBox('stock-root','Sin sesión activa. Recarga la página.');return;}
  var force=!!_FORCE_REFRESH['stock']; _FORCE_REFRESH['stock']=false;
  var t = (REQ_TOKEN.stock = (REQ_TOKEN.stock||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.stock) return; // response stale, descartar
      PAGE_LOADING['stock']=false; renderStock(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.stock) return;
      PAGE_LOADING['stock']=false; errBox('stock-root',e.message,'stock');
    })
    .getStock(S.token, force);
}

function renderStock(r){
  if(_handleExpired(r,'stock-root')) return;
  if(!r||!r.ok){errBox('stock-root',r?r.error:'Error desconocido');return;}
  DATA.stock=r.data;
  _STOCK_ESTADO_FILTRO=''; // resetear filtro de estado al recibir datos frescos
  var rows=r.data;
  var conStock=rows.filter(function(x){return x.stock>0;}).length;
  var sinStock=rows.filter(function(x){return x.stock===0;}).length;
  var negativos=rows.filter(function(x){return x.stock<0;}).length;
  var totalUnd=rows.reduce(function(a,x){return a+(x.stock>0?x.stock:0);},0);
  var costoTotal=rows.reduce(function(a,x){return a+(x.costo||0);},0);
  DATA._stockMax=rows.reduce(function(m,x){return Math.max(m,Math.abs(x.stock)||0);},0)||1;

  var cats=[...new Set(rows.map(function(x){return x.categoria;}).filter(Boolean))].sort();
  var marcas=[...new Set(rows.map(function(x){return x.marca;}).filter(Boolean))].sort();
  var catOpts=cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
  var marOpts=marcas.map(function(m){return '<option value="'+esc(m)+'">'+esc(m)+'</option>';}).join('');

  var tot=rows.length||1;
  var pc=function(n){return (n/tot*100).toFixed(2);};
  var costoK=costoTotal>=1000?(costoTotal/1000).toFixed(1)+'K':fmt(Math.round(costoTotal));
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var seg=function(id,val,txt,n){return '<button class="stk-sb'+(val===''?' active':'')+'" id="'+id+'" onclick="setStockFiltroEstado(\''+val+'\')">'+txt+'<span>'+n+'</span></button>';};
  var leg=function(val,color,n,txt){return '<span onclick="setStockFiltroEstado(\''+val+'\')"><em style="background:'+color+'"></em><b>'+n+'</b> '+txt+'</span>';};

  document.getElementById('stock-root').innerHTML=
    '<div class="stk-sum">'+
      '<div class="stk-card"><div class="stk-k">Salud del inventario</div>'+
        '<div class="stk-v">'+fmt(rows.length)+'<small>SKUs</small></div>'+
        '<div class="stk-dist"><i style="width:'+pc(conStock)+'%;background:var(--ok)"></i><i style="width:'+pc(sinStock)+'%;background:var(--text4)"></i><i style="width:'+pc(negativos)+'%;background:var(--danger)"></i></div>'+
        '<div class="stk-leg">'+leg('con','var(--ok)',conStock,'Con stock')+leg('sin','var(--text4)',sinStock,'Sin stock')+leg('neg','var(--danger)',negativos,'Negativos')+'</div></div>'+
      '<div class="stk-card"><div class="stk-k">Unidades en stock</div><div class="stk-v">'+fmt(totalUnd)+'<small>und.</small></div><div class="stk-n">Solo stock positivo</div></div>'+
      '<div class="stk-card"><div class="stk-k">Costo total</div><div class="stk-v">S/ '+costoK+'</div><div class="stk-n">S/ '+fmt(Math.round(costoTotal*10)/10)+' en inventario</div></div>'+
    '</div>'+
    '<div class="stk-fl">'+
      '<div class="stk-srch">'+icoBuscar+'<input id="stock-busq" placeholder="Buscar SKU o producto…" oninput="filterStock()"/></div>'+
      '<select class="stk-sel" id="stock-cat" onchange="filterStock()"><option value="">Todas las categorías</option>'+catOpts+'</select>'+
      '<select class="stk-sel" id="stock-mar" onchange="filterStock()"><option value="">Todas las marcas</option>'+marOpts+'</select>'+
      '<div class="stk-seg">'+seg('sbtn-todos','','Todos',rows.length)+seg('sbtn-con','con','Con stock',conStock)+seg('sbtn-sin','sin','Sin stock',sinStock)+seg('sbtn-neg','neg','Negativos',negativos)+'</div>'+
      '<span class="stk-cnt" id="stock-count"></span>'+
    '</div>'+
    '<div class="stk-tw"><table class="stk-t">'+
      '<thead><tr><th>Producto</th><th class="r">Movimientos</th><th class="r">Stock</th><th class="r">Pack</th><th class="r">Costo</th><th>Estado</th><th></th></tr></thead>'+
      '<tbody id="stock-tbody"></tbody>'+
    '</table></div>'+
    '<div class="stk-cards" id="stock-cards"></div>';

  if(!document.getElementById('stk-dr')){
    var dr=document.createElement('div'); dr.id='stk-dr';
    dr.innerHTML='<button class="x" onclick="stkCerrar()" aria-label="Cerrar">×</button><div id="stk-drc"></div>';
    document.body.appendChild(dr);
  }
  stkCerrar();
  filterStock();
}

function setStockFiltroEstado(val){
  _STOCK_ESTADO_FILTRO = val;
  ['todos','con','sin','neg'].forEach(function(k){
    var btn = document.getElementById('sbtn-'+k);
    if(btn) btn.classList.toggle('active', (val==='' ? k==='todos' : k===val));
  });
  filterStock();
}

function _filterStock(){
  var q=(document.getElementById('stock-busq')||{}).value||'';
  var cat=(document.getElementById('stock-cat')||{}).value||'';
  var mar=(document.getElementById('stock-mar')||{}).value||'';
  q=q.toLowerCase();
  var filtered=DATA.stock.filter(function(r){
    if(!(!q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1)) return false;
    if(!(!cat||r.categoria===cat)) return false;
    if(!(!mar||r.marca===mar)) return false;
    if(_STOCK_ESTADO_FILTRO==='con') return r.stock>0;
    if(_STOCK_ESTADO_FILTRO==='sin') return r.stock===0;
    if(_STOCK_ESTADO_FILTRO==='neg') return r.stock<0;
    return true;
  });
  var el=document.getElementById('stock-count');
  if(el)el.textContent=filtered.length+' productos';
  var mx=DATA._stockMax||1;
  var lab={ok:'Con stock',no:'Sin stock',ng:'Negativo'}, col={ok:'var(--ok)',no:'var(--text4)',ng:'var(--danger)'};
  var tbody=filtered.map(function(r){
    var e=r.stock>0?'ok':(r.stock<0?'ng':'no');
    return '<tr onclick="stkAbrir('+r._row+')">'+
      '<td><div class="stk-pn">'+esc(r.desc)+'</div><div class="stk-ps"><span class="sk">'+esc(r.sku)+'</span>'+
        (r.marca?'<i class="dot"></i><span>'+esc(r.marca)+'</span>':'')+(r.categoria?'<i class="dot"></i><span>'+esc(r.categoria)+'</span>':'')+'</div></td>'+
      '<td class="r"><div class="stk-mv"><span class="e" title="Entradas">+'+fmt(r.entradas)+'</span><span class="s" title="Salidas">−'+fmt(r.salidas)+'</span>'+(r.mt?'<span class="m" title="Mermas y traslados">M-T '+fmt(r.mt)+'</span>':'')+'</div></td>'+
      '<td class="r"><div class="stk-stk"><div class="stk-bar"><i style="width:'+Math.min(100,Math.abs(r.stock)/mx*100)+'%;background:'+col[e]+'"></i></div><b'+(e==='ng'?' style="color:var(--danger)"':'')+'>'+fmt(r.stock)+'</b></div></td>'+
      '<td class="r">'+Math.round(r.stockPack)+'</td>'+
      '<td class="r">'+(r.costo?'S/ '+fmt(r.costo):'—')+'</td>'+
      '<td><span class="stk-pill '+e+'">'+lab[e]+'</span></td>'+
      '<td class="r"><button class="stk-ed" onclick="event.stopPropagation();abrirSKUForm('+r._row+')">Editar</button></td>'+
    '</tr>';
  }).join('');
  var t=document.getElementById('stock-tbody');
  if(t)t.innerHTML=tbody||'<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">Sin resultados</td></tr>';
  var cards=filtered.map(function(r){
    var e=r.stock>0?'ok':(r.stock<0?'ng':'no');
    return '<div class="stk-cd" onclick="stkAbrir('+r._row+')"><div style="min-width:0"><div class="stk-pn">'+esc(r.desc)+'</div>'+
      '<div class="stk-ps"><span class="sk">'+esc(r.sku)+'</span>'+(r.marca?'<i class="dot"></i><span>'+esc(r.marca)+'</span>':'')+'</div>'+
      '<div style="margin-top:8px"><span class="stk-pill '+e+'">'+lab[e]+'</span></div></div>'+
      '<div class="stk-rt"><b'+(e==='ng'?' style="color:var(--danger)"':'')+'>'+fmt(r.stock)+'</b><span>und.</span></div></div>';
  }).join('');
  var c=document.getElementById('stock-cards');
  if(c)c.innerHTML=cards||'<div style="text-align:center;color:var(--text3);padding:40px">Sin resultados</div>';
}

// Panel lateral con el detalle de un producto
function stkAbrir(row){
  var r=(DATA.stock||[]).filter(function(x){return x._row===row;})[0]; if(!r) return;
  var e=r.stock>0?'ok':(r.stock<0?'ng':'no');
  var c=document.getElementById('stk-drc'); if(!c) return;
  c.innerHTML=
    '<div class="stk-ps" style="margin:0 0 6px"><span class="sk">'+esc(r.sku)+'</span></div>'+
    '<h3>'+esc(r.desc)+'</h3>'+
    '<div class="stk-ps">'+(r.marca?'<span>'+esc(r.marca)+'</span>':'')+(r.marca&&r.categoria?'<i class="dot"></i>':'')+(r.categoria?'<span>'+esc(r.categoria)+'</span>':'')+'</div>'+
    '<div class="stk-g2"><div><span class="stk-k">Stock</span><b'+(e==='ng'?' style="color:var(--danger)"':'')+'>'+fmt(r.stock)+'</b></div><div><span class="stk-k">Pack</span><b>'+Math.round(r.stockPack)+'</b></div></div>'+
    '<div class="stk-rowm"><span>Entradas</span><b style="color:var(--ok)">+'+fmt(r.entradas)+'</b></div>'+
    '<div class="stk-rowm"><span>Salidas</span><b>−'+fmt(r.salidas)+'</b></div>'+
    '<div class="stk-rowm"><span>Mermas y traslados</span><b>'+fmt(r.mt)+'</b></div>'+
    '<div class="stk-rowm"><span>Costo en inventario</span><b>'+(r.costo?'S/ '+fmt(r.costo):'—')+'</b></div>'+
    (e==='ng'?'<div class="stk-warn">Salieron más unidades de las que entraron. Revisa las entradas o haz un conteo.</div>':'')+
    '<div style="margin-top:18px"><button class="btn btn-primary" style="width:100%" onclick="stkCerrar();abrirSKUForm('+r._row+')">Editar SKU</button></div>';
  document.getElementById('stk-dr').classList.add('on');
}
function stkCerrar(){ var d=document.getElementById('stk-dr'); if(d) d.classList.remove('on'); }

function exportStock(){
  var rows=_getFilteredRows('stock');
  if(!rows.length){showToast('No hay datos para exportar','err');return;}
  if(!S||S.rol==='store'){
    var data=rows.map(function(r){return{'SKU / Lovis':r.sku,'Descripción':r.desc,'Marca':r.marca,'Categoría':r.categoria,'Entradas':r.entradas,'Salidas':r.salidas,'M-T':r.mt,'Stock actual':r.stock,'Stock Pack':Math.round(r.stockPack),'Costo':r.costo||0};});
    var ws=XLSX.utils.json_to_sheet(data);ws['!cols']=[{wch:14},{wch:40},{wch:16},{wch:18},{wch:10},{wch:10},{wch:8},{wch:13},{wch:12},{wch:12}];
    var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Stock');XLSX.writeFile(wb,'stock_'+_hoyISO()+'.xlsx');showToast('Exportado correctamente','ok');return;
  }
  // admin/invitado: pivot SKU x sedes (mismo que dashExportStock)
  dashExportStock();
}

var SKU_EDIT_ROW=null;
var SKU_SHEET_ID=null; // para admin: sheetId de la tienda del SKU
var SKU_CACHE=[];      // productos conocidos al abrir el formulario: avisa códigos repetidos y sugiere marcas/categorías

function _skuMostrar(modo){ // 'form' | 'ok'
  var f=modo==='form';
  document.getElementById('sku-form').style.display=f?'':'none';
  document.getElementById('sku-prev').style.display=f?'':'none';
  document.getElementById('sku-foot').style.display=f?'':'none';
  document.getElementById('sku-ok').style.display=f?'none':'';
}
function _skuTextos(esEdicion){
  document.getElementById('fs-sku-title').textContent=esEdicion?'Editar SKU':'Nuevo SKU';
  document.getElementById('sku-h1').textContent=esEdicion?'Editar SKU':'Nuevo SKU';
  document.getElementById('sku-sub').textContent=esEdicion?'Cambia los datos de identificación del producto.':'Agrega un producto a tu Stock. Se crea con stock en cero.';
  document.getElementById('sku-nota-edit').style.display=esEdicion?'flex':'none';
  document.getElementById('sku-pnote').textContent=esEdicion?'El stock y los movimientos de este producto no cambian.':'El producto se crea con stock en cero. Para ingresar unidades registra una Entrada o haz un Conteo.';
  document.getElementById('btn-sku-save').textContent=esEdicion?'Guardar cambios':'Guardar SKU';
  document.getElementById('btn-sku-otro').style.display=esEdicion?'none':'';
}

function abrirSKUForm(rowNum){
  SKU_EDIT_ROW=rowNum;
  SKU_SHEET_ID=null;
  var esEdicion=rowNum!==null;
  SKU_CACHE=(DATA.stock||[]).map(function(r){return {sku:String(r.sku||''),desc:r.desc||'',marca:r.marca||'',categoria:r.categoria||'',_row:r._row,sede:r.sede||''};});
  document.getElementById('sku-err').textContent='';
  _skuMostrar('form');
  _skuTextos(esEdicion);

  // Selector de sede para admin en modo nuevo
  var sedeWrap=document.getElementById('sku-sede-wrap');
  if(sedeWrap){
    if(S.rol==='admin' && !esEdicion){
      var tiendas=[...new Set((DATA.stock||[]).map(function(r){return r.sede;}).filter(Boolean))].sort();
      var opts=tiendas.map(function(t){return '<option value="'+esc(t)+'">'+esc(t)+'</option>';}).join('');
      document.getElementById('sku-sede').innerHTML='<option value="">Selecciona tienda...</option>'+opts;
      sedeWrap.style.display='';
    } else {
      sedeWrap.style.display='none';
    }
  }

  if(esEdicion){
    var row=(DATA.stock||[]).find(function(r){return r._row===rowNum;});
    if(!row)return;
    SKU_SHEET_ID=row.sheetId||null;
    document.getElementById('sku-lovis').value=row.sku;
    document.getElementById('sku-desc').value=row.desc;
    document.getElementById('sku-marca').value=row.marca;
    document.getElementById('sku-categoria').value=row.categoria;
  } else {
    document.getElementById('sku-lovis').value='';
    document.getElementById('sku-desc').value='';
    document.getElementById('sku-marca').value='';
    document.getElementById('sku-categoria').value='';
  }
  skuEv();
  openFS('fs-sku');
  setTimeout(function(){document.getElementById('sku-lovis').focus();},120);
}

// Atajos en PC: Esc cierra y Ctrl+Enter guarda
document.addEventListener('keydown',function(e){
  var fs=document.getElementById('fs-sku');
  if(!fs||!fs.classList.contains('open')) return;
  if(e.key==='Escape'){ closeFS('fs-sku'); return; }
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){
    var b=document.getElementById('btn-sku-save');
    if(b&&!b.disabled&&document.getElementById('sku-foot').style.display!=='none'){ e.preventDefault(); b.click(); }
  }
});

// Sugerencias de marca/categoría a partir de lo ya cargado
function _skuChips(elId,campo,inpId){
  var v=(document.getElementById(inpId).value||'').trim().toLowerCase(), vistos={}, lista=[];
  SKU_CACHE.forEach(function(r){ var x=r[campo]; if(x&&!vistos[x]){vistos[x]=true;lista.push(x);} });
  lista.sort();
  var sug=lista.filter(function(x){return !v||x.toLowerCase().indexOf(v)>-1;}).slice(0,6);
  document.getElementById(elId).innerHTML=sug.map(function(x){
    return '<button type="button" class="'+(x.toLowerCase()===v?'on':'')+'" data-i="'+inpId+'" data-v="'+esc(x)+'" onclick="skuElegir(this)">'+esc(x)+'</button>';
  }).join('');
}
function skuElegir(b){ document.getElementById(b.dataset.i).value=b.dataset.v; skuEv(); }

// Valida en vivo: código repetido, formato, vista previa y estado de los botones
function skuEv(){
  var sku=(document.getElementById('sku-lovis').value||'').trim();
  var d=(document.getElementById('sku-desc').value||'').trim();
  var ma=(document.getElementById('sku-marca').value||'').trim();
  var ca=(document.getElementById('sku-categoria').value||'').trim();
  var esEd=SKU_EDIT_ROW!==null;
  document.getElementById('sku-dcount').textContent=document.getElementById('sku-desc').value.length+' / 120';

  var sedeSel=(document.getElementById('sku-sede')||{}).value||'';
  var ex=null;
  if(sku){
    ex=SKU_CACHE.filter(function(r){
      return r.sku.toLowerCase()===sku.toLowerCase() && r._row!==SKU_EDIT_ROW && (!sedeSel||!r.sede||r.sede===sedeSel);
    })[0]||null;
  }
  var formatoMal=sku&&!/^[A-Za-z0-9\-_.]+$/.test(sku);
  var inp=document.getElementById('sku-lovis');
  inp.className='sku-in mono'+((ex||formatoMal)?' bad':(sku?' good':''));
  var h=document.getElementById('sku-lovis-h');
  if(ex){
    h.innerHTML='<div class="sku-dup"><b>Este SKU ya existe en tu Stock</b><br>'+esc(ex.desc)+(ex.marca?' · '+esc(ex.marca):'')+
      (ex._row>0?'<br><button type="button" onclick="abrirSKUForm('+ex._row+')">Editar ese producto</button>':'')+'</div>';
  } else if(formatoMal){
    h.innerHTML='<div class="sku-hint err">Usa solo letras, números, guiones o puntos.</div>';
  } else if(sku&&!esEd){
    h.innerHTML='<div class="sku-hint ok">'+ICO('check',13)+'Código disponible</div>';
  } else { h.innerHTML=''; }

  _skuChips('sku-chips-m','marca','sku-marca');
  _skuChips('sku-chips-c','categoria','sku-categoria');

  // Vista previa: la fila tal como se verá en Stock (al editar, con los números reales del producto)
  var pn=document.getElementById('sku-pvn'); pn.textContent=d||'Descripción del producto'; pn.className='sku-pn'+(d?'':' empty');
  document.getElementById('sku-pvs').textContent=sku||'SKU';
  document.getElementById('sku-pvm').textContent=ma||'Sin marca';
  document.getElementById('sku-pvc').textContent=ca||'Sin categoría';
  var fila=esEd?(DATA.stock||[]).filter(function(r){return r._row===SKU_EDIT_ROW;})[0]:null;
  var st=fila?fila.stock:0, e=st>0?'ok':(st<0?'ng':'no');
  document.getElementById('sku-pvmov').innerHTML=fila?('<span style="color:var(--ok)">+'+fmt(fila.entradas)+'</span> &nbsp;−'+fmt(fila.salidas)):'+0 &nbsp;−0';
  var stk=document.getElementById('sku-pvstk'); stk.textContent=fmt(st); stk.style.color=e==='ng'?'var(--danger)':'';
  document.getElementById('sku-pvpack').textContent=fila?Math.round(fila.stockPack):'0';
  document.getElementById('sku-pvcost').textContent=(fila&&fila.costo)?'S/ '+fmt(fila.costo):'—';
  var pe=document.getElementById('sku-pvest'); pe.textContent=e==='ok'?'Con stock':(e==='ng'?'Negativo':'Sin stock'); pe.className='sku-pill '+e;

  var sinSede=S.rol==='admin'&&!esEd&&!sedeSel;
  var malo=!sku||!d||!!ex||formatoMal||sinSede;
  document.getElementById('btn-sku-save').disabled=malo;
  document.getElementById('btn-sku-otro').disabled=malo;
  var msg=document.getElementById('sku-msg');
  msg.textContent=ex?'Ese código ya existe: edítalo en lugar de crearlo':(sinSede?'Selecciona la tienda destino':(malo?'Completa el código y la descripción para guardar':'Todo listo para guardar'));
  msg.style.color=ex?'var(--warn)':(malo?'var(--text3)':'var(--ok)');
  var stt=document.getElementById('sku-stat');
  stt.className='sku-stat '+(ex?'no':(malo?'':'ok'));
  document.getElementById('sku-stat-t').textContent=ex?'Código repetido':(malo?'Faltan datos':'Listo para guardar');
}

function skuOtro(){
  SKU_EDIT_ROW=null; SKU_SHEET_ID=null;
  _skuMostrar('form');
  _skuTextos(false);
  ['sku-lovis','sku-desc','sku-marca','sku-categoria'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('sku-err').textContent='';
  skuEv();
  setTimeout(function(){document.getElementById('sku-lovis').focus();},60);
}

// otro=true: guarda y deja el formulario vacío para cargar el siguiente
function guardarSKU(otro){
  var lovis=(document.getElementById('sku-lovis').value||'').trim();
  var desc =(document.getElementById('sku-desc').value ||'').trim();
  var err  = document.getElementById('sku-err');
  if(!lovis){err.textContent='El código Lovis es obligatorio';return;}
  if(!desc) {err.textContent='La descripción es obligatoria';return;}

  // Admin creando nuevo: necesita seleccionar tienda
  var sheetId=SKU_SHEET_ID;
  if(S.rol==='admin' && SKU_EDIT_ROW===null){
    var sedeEl=document.getElementById('sku-sede');
    var sedeName=sedeEl?sedeEl.value:'';
    if(!sedeName){err.textContent='Selecciona la tienda destino';return;}
    var match=DATA.stock.find(function(r){return r.sede===sedeName;});
    sheetId=match?match.sheetId:null;
    if(!sheetId){err.textContent='No se encontró el ID de la tienda';return;}
  }

  var fila={
    sku:       lovis,
    desc:      desc,
    marca:     (document.getElementById('sku-marca').value||'').trim(),
    categoria: (document.getElementById('sku-categoria').value||'').trim(),
    sheetId:   sheetId
  };
  err.textContent='';
  var btn=document.getElementById('btn-sku-save'), btn2=document.getElementById('btn-sku-otro');
  var esEd=SKU_EDIT_ROW!==null;
  var etiqueta=esEd?'Guardar cambios':'Guardar SKU';
  var libera=function(){ btn.textContent=etiqueta; btn.disabled=false; btn2.disabled=false; };
  btn.disabled=true; btn2.disabled=true; btn.textContent='Guardando...';
  if(esEd){
    google.script.run
      .withSuccessHandler(function(r){
        libera();
        if(!r.ok){err.textContent=r.error;return;}
        showToast('SKU actualizado correctamente','ok');
        closeFS('fs-sku');
        reloadPage('stock');
      })
      .withFailureHandler(function(e){libera();err.textContent=e.message;})
      .editarSKU(S.token,SKU_EDIT_ROW,fila);
  } else {
    google.script.run
      .withSuccessHandler(function(r){
        libera();
        if(!r.ok){err.textContent=r.error;return;}
        // El código recién creado cuenta como repetido si se vuelve a escribir sin cerrar el formulario
        SKU_CACHE.push({sku:lovis,desc:desc,marca:fila.marca,categoria:fila.categoria,_row:-1,sede:(document.getElementById('sku-sede')||{}).value||''});
        reloadPage('stock');
        if(otro){
          showToast('SKU '+lovis+' creado','ok');
          ['sku-lovis','sku-desc','sku-marca','sku-categoria'].forEach(function(id){document.getElementById(id).value='';});
          skuEv();
          document.getElementById('sku-lovis').focus();
        } else {
          _skuMostrar('ok');
        }
      })
      .withFailureHandler(function(e){libera();err.textContent=e.message;})
      .registrarSKU(S.token,fila);
  }
}

/* ══════════════════════════════════════
   SALIDAS
══════════════════════════════════════ */
/* ── Salidas en vivo (Supabase Realtime): las filas aparecen solas, sin avisos ── */
var _salFlash = {};
function _salVivoIniciar(){
  if(!window.TadaRealtime) return;
  TadaRealtime.salidas(function(){ return window.sal_rango||null; }, _salVivoCambio, _salVivoResync);
}
function _salVivoCambio(c){
  _sbSalidasRefrescar();
  if(!S||!S.token||!document.getElementById('salidas-tbody')) return; // pantalla no abierta: se cargará fresca al entrar
  var porId={}; (DATA.salidas||[]).forEach(function(r){ porId[r._row]=r; });
  var hubo=c.upserts.length>0;
  c.borrados.forEach(function(id){ if(porId[id]){ delete porId[id]; hubo=true; } });
  if(!hubo) return; // p. ej. borrados de otra sede o de filas que no están cargadas
  c.upserts.forEach(function(r){ if(!porId[r._row]) _salFlash[r._row]=true; porId[r._row]=r; });
  DATA.salidas=Object.keys(porId).map(function(k){return porId[k];}).sort(function(a,b){return a._row-b._row;});
  filterSalidas();
  setTimeout(function(){ _salFlash={}; filterSalidas(); }, 3500);
}
// Tras recuperar la conexión, vuelve a leer el rango visible sin tocar la pantalla
function _salVivoResync(){
  _sbSalidasRefrescar();
  if(!S||!S.token||!document.getElementById('salidas-tbody')) return;
  google.script.run.withSuccessHandler(function(r){
    if(r&&r.ok&&document.getElementById('salidas-tbody')){ DATA.salidas=r.data; filterSalidas(); }
  }).getSalidas(S.token, true, window.sal_rango||null);
}

// Al volver a la app (celular que estuvo en segundo plano / pantalla apagada) la conexión en vivo puede haberse
// dormido: se vuelve a conectar y se relee el rango visible para no perder pedidos que llegaron mientras tanto.
var _salVisUlt = 0;
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState!=='visible'||!S||!S.token||!window.TadaRealtime) return;
  if(!document.getElementById('s-app').classList.contains('active')) return;
  var ahora = Date.now();
  if(ahora-_salVisUlt<5000) return;
  _salVisUlt = ahora;
  if(!TadaRealtime.vivo()) _salVivoIniciar();
  _salVivoResync();
});

function loadSalidas(){
  if(!S||!S.token){errBox('salidas-root','Sin sesión activa. Recarga la página.','salidas');PAGE_LOADING['salidas']=false;return;}
  var force=!!_FORCE_REFRESH['salidas']; _FORCE_REFRESH['salidas']=false;
  var t = (REQ_TOKEN.salidas = (REQ_TOKEN.salidas||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.salidas) return;
      PAGE_LOADING['salidas']=false; renderSalidas(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.salidas) return;
      PAGE_LOADING['salidas']=false; errBox('salidas-root',e.message,'salidas');
    })
    .getSalidas(S.token, force, window.sal_rango||null);
}

function renderSalidas(r){
  if(_handleExpired(r,'salidas-root')) return;
  if(!r||!r.ok){errBox('salidas-root',r?r.error:'Error desconocido');return;}
  DATA.salidas=r.data;
  _SAL_EST='';
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  document.getElementById('salidas-root').innerHTML=
    '<div class="sal2-sum">'+
      '<div class="sal2-card sal2-ped"><div class="sal2-pl"><div class="sal2-k">Pedidos</div><div class="sal2-v" id="sal-stat-total">0</div></div>'+
        '<div class="sal2-pr" id="sal-ultimo"></div></div>'+
      '<div class="sal2-card"><div class="sal2-k">Unidades salidas</div><div class="sal2-v"><span id="sal-stat-und">0</span><small>und.</small></div><div class="sal2-n" id="sal-prod"></div></div>'+
      '<div class="sal2-card"><div class="sal2-k">Envases</div><div class="sal2-env" id="sal-env"></div></div>'+
    '</div>'+
    '<div class="sal2-fl">'+
      '<div class="sal2-srch">'+icoBuscar+'<input id="sal-busq" placeholder="Buscar pedido, SKU, producto o motorizado…" oninput="filterSalidas()"/></div>'+
      _fechaFiltroHTML('sal','filterSalidas','salRangoCambio')+
      '<div class="sal2-seg" id="sal-est"></div>'+
      '<span class="sal2-cnt" id="sal-count"></span>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr>'+
        '<th>Fecha</th><th class="col-hide-mobile">Hora</th><th>Nro. Pedido</th><th class="col-hide-mobile">SKU</th><th>Descripción</th>'+
        '<th class="col-hide-mobile">Marca</th><th class="r col-hide-mobile">Pack</th><th class="r">Und.</th>'+
        '<th class="c col-hide-mobile">Motor.</th><th class="r col-hide-mobile">Envases</th>'+
        '<th class="c col-hide-mobile">Estado</th><th class="c col-hide-mobile">Revisión</th>'+
        '<th class="c col-hide-mobile" style="min-width:110px;width:110px"></th>'+
      '</tr></thead>'+
      '<tbody id="salidas-tbody"></tbody>'+
    '</table></div>';

  // Estado inicial: activar filtro "Hoy" por defecto
  _initFiltroFecha('sal','filterSalidas',{page:'salidas'});
  filterSalidas();
}

function _salTiempoRelativo(fecha, hora){
  try {
    if(!fecha||!hora) return '';
    var partesFecha=fecha.split('/'); // dd/mm/yyyy
    if(partesFecha.length<3) return '';
    var iso=partesFecha[2]+'-'+partesFecha[1]+'-'+partesFecha[0]+'T'+hora+':00';
    var ts=new Date(iso).getTime();
    if(isNaN(ts)) return '';
    var diff=Math.floor((Date.now()-ts)/60000);
    if(diff<1) return 'ahora mismo';
    if(diff<60) return 'hace '+diff+' min';
    if(diff<1440) return 'hace '+Math.floor(diff/60)+' h';
    return 'hace '+Math.floor(diff/1440)+' d';
  } catch(e){ return ''; }
}

function _salMenuContextual(row){
  var cancelado=row.cancelado||row.estado==='cancelado'||row.estado==='CANCELADO';
  if(cancelado) return '';
  return '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;color:var(--accent);white-space:nowrap" '+
    'onclick="abrirEditarSkuFila('+row._row+')">'+ICO('edit',12)+'SKU</button> '+
    '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 10px;color:var(--danger);border-color:var(--danger);white-space:nowrap" '+
    'data-row="'+row._row+'" data-nro="'+esc(row.nroPedido)+'" '+
    'onclick="abrirModalCancelarBtn(this)">'+ICO('x',12)+'Cancelar</button>';
}

function _salEstadoBadge(r){
  var cancelado=r.cancelado||r.estado==='cancelado'||r.estado==='CANCELADO';
  if(cancelado) return '—';
  var e=String(r.estado||'').trim();
  var eL=e.toLowerCase();
  if(eL==='entregado') return '<span style="background:var(--teal-bg,#d1fae5);color:var(--teal,#065f46);font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600">'+e+'</span>';
  if(e) return '<span style="background:var(--warn-bg,#fef3c7);color:var(--warn,#92400e);font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600">'+e+'</span>';
  return '<span style="color:var(--text3);font-size:12px">—</span>';
}

function _salRevisionCell(r){
  var cancelado=r.cancelado||r.estado==='cancelado'||r.estado==='CANCELADO';
  if(cancelado) return '—';
  var rev=String(r.revision||'').trim();
  var est=String(r.estado||'').trim();
  if(rev.toLowerCase()==='entregado') return '<span style="color:var(--teal,#065f46);font-size:16px;font-weight:600">'+ICO('check',16,'s')+'</span>';
  // Mostrar botón si estado tiene cualquier valor y revision está vacío
  // No comparar texto exacto — la fórmula puede devolver cualquier variante
  if(!est) return '<span style="color:var(--text3);font-size:12px">—</span>';
  return '<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px;border-radius:5px;white-space:nowrap" '+
    'onclick="confirmarRecepcion('+r._row+',this)">Confirmar recepción</button>';
}

function confirmarRecepcion(rowNum, btn){
  btn.disabled=true;
  btn.textContent='...';
  google.script.run
    .withSuccessHandler(function(res){
      if(res&&res.ok){
        // Actualizar la fila localmente sin recargar toda la tabla
        var td=btn.closest('tr');
        if(td){
          var cells=td.querySelectorAll('td');
          // col Estado = penúltima - 2, col Revisión = penúltima - 1
          var nCols=cells.length;
          if(nCols>=3){
            cells[nCols-3].innerHTML='<span style="background:var(--teal-bg,#d1fae5);color:var(--teal,#065f46);font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600">Entregado</span>';
            cells[nCols-2].innerHTML='<span style="color:var(--teal,#065f46);font-size:16px;font-weight:600">'+ICO('check',16,'s')+'</span>';
          }
        }
      } else {
        btn.disabled=false;
        btn.textContent='Confirmar recepción';
        showToast('Error: '+(res&&res.error?res.error:'Error desconocido'),'err');
      }
    })
    .withFailureHandler(function(e){
      btn.disabled=false;
      btn.textContent='Confirmar recepción';
      showToast('Error de red: '+e.message,'err');
    })
    .marcarEntregado(S.token,rowNum);
}

// ── Resumen de Envases (Retornables y Venta por tamaño) ──
// Tamaños canónicos que siempre se muestran (en orden)
var SAL_TAMANOS = ['310','630','1000'];
var _SAL_EST=''; // filtro de estado: '', 'pen' (por confirmar), 'ent' (entregado), 'cx' (cancelado)

// Estado de una línea de salida (coincide con el botón "Confirmar recepción")
function _salEstadoLinea(r){
  if(r.cancelado||String(r.estado||'').toLowerCase()==='cancelado') return 'cx';
  var est=String(r.estado||'').trim(), rev=String(r.revision||'').trim().toLowerCase();
  if(rev==='entregado') return 'ent';
  if(est) return 'pen';
  return 'sin';
}

// Líneas que cumplen búsqueda y fecha (antes del filtro de estado)
function _salBase(){
  var q = ((document.getElementById('sal-busq')||{}).value||'').toLowerCase();
  var rows = DATA.salidas.filter(function(r) {
    return !q||(r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||
      r.nroPedido.toLowerCase().indexOf(q)>-1||String(r.motorizado||'').toLowerCase().indexOf(q)>-1);
  });
  return _applyFiltroFecha('sal', rows).sort(function(a,b){return b._row-a._row;});
}

function _salEnvasesHTML(rows){
  var ret={}, ven={};
  rows.forEach(function(r){
    var env=String(r.envases||'').trim().toLowerCase(), tam=String(r.tamano||'').trim(), und=r.unidad||0;
    if(!tam) return;
    if(env==='retornable') ret[tam]=(ret[tam]||0)+und;
    else if(env==='venta') ven[tam]=(ven[tam]||0)+und;
  });
  var bloque=function(titulo,color,o){
    var tot=0; SAL_TAMANOS.forEach(function(t){tot+=o[t]||0;});
    return '<div><div class="sal2-envh"><b>'+fmt(tot)+'</b><span><em style="background:'+color+'"></em>'+titulo+'</span></div>'+
      SAL_TAMANOS.map(function(t){
        var v=o[t]||0, pct=tot>0?Math.round(v/tot*100):0;
        return '<div class="sal2-sz"'+(v?'':' style="opacity:.35"')+'><span>'+t+' ml</span><div class="sal2-bar"><i style="width:'+pct+'%;background:'+color+'"></i></div><b>'+fmt(v)+'</b></div>';
      }).join('')+'</div>';
  };
  return bloque('Retornables','var(--ok)',ret)+bloque('Venta','var(--warn)',ven);
}

function _filterSalidas(){
  var base = _salBase();
  var c={pen:0,ent:0,cx:0}, vivas=[];
  base.forEach(function(r){ var e=_salEstadoLinea(r); if(c[e]!==undefined) c[e]++; if(e!=='cx') vivas.push(r); });

  var seg=function(k,txt,n){return '<button class="'+(_SAL_EST===k?'on':'')+'" onclick="salSetEstado(\''+k+'\')">'+txt+'<span>'+n+'</span></button>';};
  document.getElementById('sal-est').innerHTML=seg('','Todos',base.length)+seg('pen','Por confirmar',c.pen)+seg('ent','Entregados',c.ent)+(c.cx?seg('cx','Cancelados',c.cx):'');

  var filtered = _getFilteredRows('salidas');

  // Resumen (sin contar líneas canceladas)
  var stats = vivas.reduce(function(acc, r){
    acc.totalUnd += r.unidad;
    if(r.nroPedido && r.nroPedido.trim() !== ''){
      acc.pedidos.add(r.nroPedido);
      if(r._row > acc.ultimoRow){ acc.ultimoRow = r._row; acc.ultimoPedido = r.nroPedido; acc.ultimoFecha=r.fecha; acc.ultimoHora=r.hora; }
    }
    return acc;
  }, {totalUnd:0, pedidos: new Set(), ultimoRow:-1, ultimoPedido:'', ultimoFecha:'', ultimoHora:''});
  var el;
  if(el=document.getElementById('sal-stat-total')) el.textContent=fmt(stats.pedidos.size);
  if(el=document.getElementById('sal-stat-und'))   el.textContent=fmt(stats.totalUnd);
  if(el=document.getElementById('sal-prod'))       el.textContent=fmt(vivas.length)+(vivas.length===1?' línea de producto':' líneas de producto');
  if(el=document.getElementById('sal-ultimo')){
    var rel=_salTiempoRelativo(stats.ultimoFecha, stats.ultimoHora);
    el.innerHTML=stats.ultimoPedido?'<div class="sal2-k sal2-k4">Último pedido</div><span class="sal-ped sal2-pc">'+esc(stats.ultimoPedido)+'</span>'+
      (rel?'<span class="sal2-ago">'+ICO('reloj',13)+rel+'</span>':''):'<div class="sal2-k sal2-k4">Último pedido</div><span class="sal2-ago">Sin pedidos en este período</span>';
  }
  if(el=document.getElementById('sal-env')) el.innerHTML=_salEnvasesHTML(vivas);

  if(el=document.getElementById('sal-count')) el.textContent = filtered.length + ' registros';

  var tbody = filtered.map(function(r){
    var cancelado=r.cancelado||r.estado==='cancelado'||r.estado==='CANCELADO';
    var trStyle=cancelado?'opacity:0.45;':'';
    var descCell=cancelado
      ? '<td class="td-desc" title="'+esc(r.desc)+'"><span style="text-decoration:line-through">'+esc(r.desc)+'</span> <span style="background:var(--danger-bg,#fee2e2);color:var(--danger,#dc2626);font-size:10px;padding:1px 6px;border-radius:4px;font-weight:600;vertical-align:middle">cancelado</span></td>'
      : '<td class="td-desc" title="'+esc(r.desc)+'">'+esc(r.desc)+'</td>';
    return '<tr'+(_salFlash[r._row]?' class="flash-new"':'')+' style="'+trStyle+'">'+
      '<td class="mono" style="font-size:12px">'+esc(r.fecha)+'</td>'+
      '<td class="mono col-hide-mobile" style="font-size:12px;color:var(--text3)">'+esc(r.hora)+'</td>'+
      '<td class="pedido-link">'+(r.nroPedido?'<span class="sal-ped">'+esc(r.nroPedido)+'</span>':'<span style="color:var(--text4)">—</span>')+'</td>'+
      '<td class="mono col-hide-mobile">'+esc(r.sku)+'</td>'+
      descCell+
      '<td class="col-hide-mobile" style="font-size:12px">'+(r.marca?'<span class="brand-pill">'+esc(r.marca)+'</span>':'<span style="color:var(--text4)">—</span>')+'</td>'+
      '<td class="r col-hide-mobile">'+fmt(r.pack)+'</td>'+
      '<td class="r" style="font-weight:600">'+fmt(r.unidad)+'</td>'+
      '<td class="c col-hide-mobile" style="font-size:11px;color:var(--text3);white-space:nowrap">'+esc(r.motorizado||'—')+'</td>'+
      '<td class="r col-hide-mobile" style="font-size:12px">'+esc(r.envases||'—')+'</td>'+
      '<td class="c col-hide-mobile">'+_salEstadoBadge(r)+'</td>'+
      '<td class="c col-hide-mobile" style="white-space:nowrap">'+_salRevisionCell(r)+'</td>'+
      '<td class="c col-hide-mobile" style="white-space:nowrap;width:110px;padding-right:16px">'+_salMenuContextual(r)+'</td>'+
    '</tr>';
  }).join('');
  var t = document.getElementById('salidas-tbody');
  if(t) t.innerHTML = tbody || '<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:40px">Sin registros</td></tr>';
}

function salSetEstado(k){ _SAL_EST=(_SAL_EST===k?'':k); _filterSalidas(); }

// Exportar salidas filtradas a Excel
function exportSalidas(){
  if(S&&S.rol!=='store'){
    var HDR=['Fecha','Hora','SKU','Nro. Pedido','Descripción','Pack','Unidad','Marca','Motorizado','Envases','Estado','Revisión','Tamaño'];
    var CW=[{wch:12},{wch:8},{wch:14},{wch:14},{wch:36},{wch:8},{wch:8},{wch:14},{wch:16},{wch:10},{wch:12},{wch:12},{wch:10}];
    _exportConSpinner('btn-export-salidas','salidas',function(sedes){
      _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:HDR,rows:s.data,colWidths:CW,
        mapFn:function(r){return[r.fecha,r.hora,r.sku,r.nroPedido,r.desc,r.pack,r.unidad,r.marca||'',r.motorizado||'',r.envases||'',r.estado||'',r.revision||'',r.tamano||''];}};}),'salidas_sedes');
    });return;
  }
  var rows=_getFilteredRows('salidas');
  if(!rows.length){showToast('No hay datos para exportar','err');return;}
  var ws_data=[['Fecha','Hora','SKU','Nro. Pedido','Descripción','Pack','Unidad','Marca','Motorizado','Envases','Estado','Revisión','Tamaño']];
  rows.forEach(function(r){ws_data.push([r.fecha,r.hora,r.sku,r.nroPedido,r.desc,r.pack,r.unidad,r.marca||'',r.motorizado||'',r.envases||'',r.estado||'',r.revision||'',r.tamano||'']);});
  var wb=XLSX.utils.book_new();var ws=XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols']=[{wch:12},{wch:8},{wch:14},{wch:14},{wch:36},{wch:8},{wch:8},{wch:14},{wch:16},{wch:10},{wch:12},{wch:12},{wch:10}];
  XLSX.utils.book_append_sheet(wb,ws,'Salidas');XLSX.writeFile(wb,'salidas_'+_hoyISO()+'.xlsx');
  showToast('Excel descargado ('+rows.length+' registros)','ok');
}

function openSalidaForm(){
  EDIT_ROW=null;
  clearForm(['sal-sku','sal-ean','sal-desc','sal-nropedido','sal-pack','sal-unidad','sal-marca','sal-motorizado']);
  document.getElementById('fs-salida-title').textContent='Registrar Salida';
  document.getElementById('btn-sal-save').textContent='Guardar salida';
  document.getElementById('sal-err').textContent='';
  openFS('fs-salida');
}

function guardarSalida(){
  var sku=document.getElementById('sal-sku').value.trim();
  var pack=document.getElementById('sal-pack').value;
  var und=document.getElementById('sal-unidad').value;
  var err=document.getElementById('sal-err');
  if(!sku||!pack||!und){err.textContent='SKU, Pack y Unidades son obligatorios';return;}
  var fila={sku:sku,desc:document.getElementById('sal-desc').value,
    nroPedido:document.getElementById('sal-nropedido').value,
    pack:Number(pack),unidad:Number(und),
    marca:document.getElementById('sal-marca').value,
    motorizado:document.getElementById('sal-motorizado').value};
  err.textContent='';
  var btn=document.getElementById('btn-sal-save');
  var btnLabel=EDIT_ROW?'Guardar cambios':'Guardar salida';
  btn.disabled=true;btn.textContent='Guardando...';

  if(EDIT_ROW){
    // EDITAR — actualizar fila existente en DATA local
    var editRow=EDIT_ROW;
    google.script.run
      .withSuccessHandler(function(r){
        btn.disabled=false;btn.textContent=btnLabel;
        if(!r.ok){err.textContent=r.error;return;}
        // Actualizar DATA.salidas localmente sin recargar
        var idx=DATA.salidas.findIndex(function(x){return x._row===editRow;});
        if(idx>-1) DATA.salidas[idx]=Object.assign(DATA.salidas[idx],fila);
        closeFS('fs-salida');
        filterSalidas();
        showToast('Salida actualizada','ok');
      })
      .withFailureHandler(function(e){btn.disabled=false;btn.textContent=btnLabel;err.textContent=e.message;})
      .editarSalida(S.token,EDIT_ROW,fila);
  } else {
    // NUEVO — el backend devuelve la fila insertada con su _row real
    google.script.run
      .withSuccessHandler(function(r){
        btn.disabled=false;btn.textContent=btnLabel;
        if(!r.ok){err.textContent=r.error;return;}
        // Insertar en DATA.salidas localmente sin recargar desde API
        if(r.inserted) DATA.salidas.push(r.inserted);
        closeFS('fs-salida');
        filterSalidas();
        showToast('Salida registrada','ok');
        // Marcar stock como stale (sin recarga forzada — se actualizará al navegar)
        PAGE_LOADED['stock']=false;
      })
      .withFailureHandler(function(e){btn.disabled=false;btn.textContent=btnLabel;err.textContent=e.message;})
      .registrarSalida(S.token,fila);
  }
}

/* ── AGREGAR PEDIDO A MANO (varias líneas, con buscador en maestro y Stock) ── */
var PED={n:0,lineas:{},res:{},timers:{}};

function abrirPedidoManual(){
  PED={n:0,lineas:{},res:{},timers:{}};
  document.getElementById('ped-nro').value='';
  var f=document.getElementById('ped-fecha'); f.value=_hoyISO(); f.max=_hoyISO();
  document.getElementById('ped-moto').value='';
  document.getElementById('ped-lineas').innerHTML='';
  document.getElementById('ped-err').textContent='';
  var b=document.getElementById('btn-ped-save'); b.disabled=false; b.textContent='Guardar pedido';
  pedAgregarLinea();
  openFS('fs-pedido');
}

function pedAgregarLinea(){
  var id=++PED.n;
  PED.lineas[id]={sku:'',desc:'',factor:1,pack:1,und:'',undManual:false};
  var d=document.createElement('div');
  d.id='pl-'+id;
  d.style.cssText='border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px';
  d.innerHTML=
    '<div style="display:flex;gap:8px;align-items:flex-start">'+
      '<div class="autocomplete-wrap" style="flex:1">'+
        '<input class="inp" id="pl-q-'+id+'" placeholder="Busca por descripción o SKU..." autocomplete="off" oninput="pedBuscar('+id+')"/>'+
        '<div class="ac-list" id="pl-ac-'+id+'"></div>'+
      '</div>'+
      '<button class="btn btn-ghost btn-sm" title="Quitar producto" onclick="pedQuitarLinea('+id+')">'+ICO('x',14,'s')+'</button>'+
    '</div>'+
    '<div id="pl-sel-'+id+'" style="font-size:12px;color:var(--text3)">Elige un producto de la lista</div>'+
    '<div style="display:flex;gap:10px">'+
      '<div style="flex:1"><div class="form-label">Pack <span class="req">*</span></div><input class="inp" id="pl-pack-'+id+'" type="number" min="1" step="1" value="1" oninput="pedCambioPack('+id+')"/></div>'+
      '<div style="flex:1"><div class="form-label">Unidades <span class="req">*</span></div><input class="inp" id="pl-und-'+id+'" type="number" readonly tabindex="-1" placeholder="Se calcula solo" style="opacity:.8;cursor:default"/></div>'+
    '</div>';
  document.getElementById('ped-lineas').appendChild(d);
}

function pedQuitarLinea(id){
  var d=document.getElementById('pl-'+id); if(d) d.remove();
  delete PED.lineas[id];
  if(!Object.keys(PED.lineas).length) pedAgregarLinea();
}

function pedBuscar(id){
  var l=PED.lineas[id]; if(!l) return;
  // Si vuelve a escribir, la selección anterior ya no vale
  l.sku=''; l.desc='';
  document.getElementById('pl-und-'+id).value='';
  document.getElementById('pl-sel-'+id).textContent='Elige un producto de la lista';
  clearTimeout(PED.timers[id]);
  var q=document.getElementById('pl-q-'+id).value.trim();
  var list=document.getElementById('pl-ac-'+id);
  if(q.length<2){list.classList.remove('open');return;}
  PED.timers[id]=setTimeout(function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!PED.lineas[id]||!r||!r.ok)return;
        if(!r.results.length){list.innerHTML='<div class="ac-item"><div class="ac-desc">Sin resultados</div></div>';list.classList.add('open');return;}
        PED.res[id]=r.results;
        list.innerHTML=r.results.map(function(x,i){
          return '<div class="ac-item" onclick="pedElegir('+id+','+i+')">'+
            '<div class="ac-sku">'+esc(x.sku)+(x.fuente==='maestro'?' · '+fmt(x.factor)+' und. por pack':' · Stock')+'</div>'+
            '<div class="ac-desc">'+esc(x.desc)+'</div>'+
          '</div>';
        }).join('');
        list.classList.add('open');
      })
      .withFailureHandler(function(){list.classList.remove('open');})
      .buscarProductoPedido(S.token,q);
  },300);
}

function pedElegir(id,i){
  var x=(PED.res[id]||[])[i], l=PED.lineas[id]; if(!x||!l) return;
  l.sku=x.sku; l.desc=x.desc; l.factor=x.factor||1;
  document.getElementById('pl-q-'+id).value=x.desc||x.sku;
  document.getElementById('pl-ac-'+id).classList.remove('open');
  document.getElementById('pl-sel-'+id).textContent='SKU '+x.sku+(x.fuente==='maestro'
    ? ' · '+fmt(x.factor)+' und. por pack (maestro)'
    : ' · producto del Stock, no está en el maestro: se cuenta 1 unidad por pack');
  pedCambioPack(id);
}

function pedCambioPack(id){
  var l=PED.lineas[id]; if(!l) return;
  var p=parseInt(document.getElementById('pl-pack-'+id).value,10);
  document.getElementById('pl-und-'+id).value=(p>0&&l.sku)?p*l.factor:'';
}

function guardarPedidoManual(){
  var err=document.getElementById('ped-err');
  var nro=document.getElementById('ped-nro').value.trim().toUpperCase();
  if(!nro){err.textContent='Escribe el número de pedido';return;}
  var lineas=[], ids=Object.keys(PED.lineas);
  for(var k=0;k<ids.length;k++){
    var id=ids[k], l=PED.lineas[id];
    var pack=Number(document.getElementById('pl-pack-'+id).value);
    var und=Number(document.getElementById('pl-und-'+id).value);
    if(!l.sku){err.textContent='Producto '+(k+1)+': elige un producto de la lista';return;}
    if(!(pack>=1)||pack!==Math.floor(pack)){err.textContent='Producto '+(k+1)+': el pack debe ser un número entero mayor a 0';return;}
    if(!(und>=1)||und!==Math.floor(und)){err.textContent='Producto '+(k+1)+': las unidades deben ser un número entero mayor a 0';return;}
    lineas.push({sku:l.sku,desc:l.desc,pack:pack,unidad:und});
  }
  err.textContent='';
  var btn=document.getElementById('btn-ped-save');
  btn.disabled=true; btn.textContent='Guardando...';
  var fecha=document.getElementById('ped-fecha').value;
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false; btn.textContent='Guardar pedido';
      if(!r||!r.ok){err.textContent=(r&&r.error)||'No se pudo guardar el pedido';return;}
      closeFS('fs-pedido');
      showToast('Pedido '+nro+' registrado ('+r.filas+' producto'+(r.filas===1?'':'s')+')','ok');
      PAGE_LOADED['stock']=false;
      reloadPage('salidas');
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Guardar pedido';err.textContent=e.message;})
    .registrarPedidoManual(S.token,{nroPedido:nro,fecha:fecha,motorizado:document.getElementById('ped-moto').value.trim(),lineas:lineas});
}

var CANCEL_ROW=null;
var CANCEL_NRO=null;

// Wrapper seguro para botones generados dinámicamente — lee data-row y data-nro
// en lugar de recibir nroPedido como parámetro inline en onclick (evita XSS)
function abrirModalCancelarBtn(btn){
  var rowNum    = parseInt(btn.getAttribute('data-row'), 10);
  var nroPedido = btn.getAttribute('data-nro') || '';
  abrirModalCancelar(rowNum, nroPedido);
}

function abrirModalCancelar(rowNum, nroPedido){
  var fila = DATA.salidas.find(function(r){return r._row===rowNum;});
  if(!fila){showToast('Recarga la página — los datos están desactualizados.','err');return;}

  CANCEL_ROW = rowNum;
  CANCEL_NRO = nroPedido;

  var tieneNro = nroPedido && nroPedido.trim()!=='';
  var itemsDelPedido = tieneNro
    ? DATA.salidas.filter(function(r){return r.nroPedido===nroPedido;})
    : [fila];

  document.getElementById('modal-cancelar-info').innerHTML =
    tieneNro
      ? 'Pedido <strong>'+esc(nroPedido)+'</strong> — '+itemsDelPedido.length+' ítem(s) serán cancelados'
      : 'Registro sin Nro. de Pedido — se cancelará este ítem';

  // Preview tabla
  var previewHTML = '<table style="width:100%;border-collapse:collapse">'+
    '<thead><tr style="background:var(--surface2);font-weight:600">'+
      '<th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">SKU</th>'+
      '<th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">Descripción</th>'+
      '<th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Und.</th>'+
    '</tr></thead><tbody>';
  itemsDelPedido.forEach(function(r){
    previewHTML += '<tr>'+
      '<td style="padding:6px 10px;font-family:var(--font-mono);font-size:11px;border-bottom:1px solid var(--border)">'+esc(r.sku)+'</td>'+
      '<td style="padding:6px 10px;font-size:12px;border-bottom:1px solid var(--border)">'+esc(r.desc)+'</td>'+
      '<td style="padding:6px 10px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">'+fmt(r.unidad)+'</td>'+
    '</tr>';
  });
  previewHTML += '</tbody></table>';
  document.getElementById('modal-cancelar-preview').innerHTML = previewHTML;

  var btnLabel = itemsDelPedido.length > 1
    ? 'Cancelar pedido completo ('+itemsDelPedido.length+' ítems)'
    : 'Cancelar este registro';
  document.getElementById('btn-cancel-confirmar').textContent = btnLabel;

  // Resetear motivo cada vez que se abre el modal
  document.getElementById('modal-cancelar-motivo').value='';
  var motivoOtro = document.getElementById('modal-cancelar-motivo-otro');
  motivoOtro.value='';
  motivoOtro.style.display='none';

  document.getElementById('modal-cancelar').style.display = 'flex';
}

function onCambioMotivoCancelar(){
  var sel = document.getElementById('modal-cancelar-motivo');
  var otro = document.getElementById('modal-cancelar-motivo-otro');
  otro.style.display = (sel.value==='__otro__') ? 'block' : 'none';
  if(sel.value!=='__otro__') otro.value='';
}

function closeModalCancelar(){
  document.getElementById('modal-cancelar').style.display='none';
  // Resetear estado del botón — puede quedar disabled si la llamada anterior falló
  var btn = document.getElementById('btn-cancel-confirmar');
  if (btn) btn.disabled = false;
  CANCEL_ROW=null; CANCEL_NRO=null;
}

function confirmarCancelar(){
  if(!CANCEL_ROW) return;
  var selMotivo = document.getElementById('modal-cancelar-motivo');
  var otroMotivo = document.getElementById('modal-cancelar-motivo-otro');
  var motivo = (selMotivo.value==='__otro__') ? otroMotivo.value.trim() : selMotivo.value;
  if(!motivo){
    showToast('Selecciona o escribe el motivo de la cancelación.','err');
    return;
  }
  var rowNum = CANCEL_ROW;
  var nroPed = CANCEL_NRO;
  var btn = document.getElementById('btn-cancel-confirmar');
  if(btn) btn.disabled=true;
  closeModalCancelar();
  google.script.run
    .withSuccessHandler(function(r){
      if(btn) btn.disabled=false;
      if(!r.ok){
        if(r.stale){
          // El pedido ya no existe en la hoja — probablemente ya fue cancelado
          showToast('Este pedido ya no está en Salidas. Actualizando...','warn');
          setTimeout(function(){reloadPage('salidas');}, 1200);
        } else {
          showToast(r.error,'err');
        }
        return;
      }
      // Quitar del DATA local las filas canceladas (por nroPedido o solo la fila)
      var nro = r.nroPedido;
      if(nro){
        DATA.salidas = DATA.salidas.filter(function(x){return x.nroPedido!==nro;});
      } else {
        DATA.salidas = DATA.salidas.filter(function(x){return x._row!==rowNum;});
      }
      filterSalidas(); // re-renderizar tabla sin llamar al servidor
      showToast('Pedido cancelado ('+r.cancelados+' fila'+(r.cancelados>1?'s':'')+') a PD CANCELADOS','ok');
      // Forzar recarga inmediata de cancelados y marcar stock como stale
      PAGE_LOADED['stock']=false;
      reloadPage('cancelados');
    })
    .withFailureHandler(function(e){
      if(btn) btn.disabled=false;
      showToast(e.message,'err');
    })
    .cancelarSalida(S.token, rowNum, 'pedido', nroPed, motivo);
}

/* ══════════════════════════════════════
   ENTRADAS
══════════════════════════════════════ */
function loadEntradas(){
  dbg('[ENTRADAS] loadEntradas() — token='+(S&&S.token?S.token.slice(0,8)+'...':'NULL')+' force='+!!_FORCE_REFRESH['entradas']);
  if(!S||!S.token){errBox('entradas-root','Sin sesión activa. Recarga la página.','entradas');PAGE_LOADING['entradas']=false;return;}
  var force=!!_FORCE_REFRESH['entradas']; _FORCE_REFRESH['entradas']=false;
  var t = (REQ_TOKEN.entradas = (REQ_TOKEN.entradas||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.entradas) return; // response stale, descartar
      dbg('[ENTRADAS] respuesta servidor:', JSON.stringify(r).slice(0,200));
      if(r===null||r===undefined){
        // GAS retornó null — puede ser timeout o error de serialización al forzar refresco
        // Reintentar una vez sin force (leerá del caché si existe)
        console.warn('[ENTRADAS] respuesta null, reintentando sin force...');
        google.script.run
          .withSuccessHandler(function(r2){
            if(t !== REQ_TOKEN.entradas) return;
            PAGE_LOADING['entradas']=false;
            if(!r2){errBox('entradas-root','Error del servidor al cargar entradas. Recarga la página.','entradas');return;}
            renderEntradas(r2);
          })
          .withFailureHandler(function(e2){
            if(t !== REQ_TOKEN.entradas) return;
            PAGE_LOADING['entradas']=false;PAGE_LOADED['entradas']=false;errBox('entradas-root',e2.message,'entradas');
          })
          .getEntradas(S.token, false, window.ent_rango||null);
        return;
      }
      PAGE_LOADING['entradas']=false;renderEntradas(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.entradas) return;
      console.error('[ENTRADAS] failure handler:', e.message);
      PAGE_LOADING['entradas']=false;PAGE_LOADED['entradas']=false;errBox('entradas-root',e.message,'entradas');
    })
    .getEntradas(S.token, force, window.ent_rango||null);
}


/* ── FILTRO FECHA COMPARTIDO — Entradas, M-T, Cancelados ── */
function _hoyISO(){
  var h=new Date();
  return h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0')+'-'+String(h.getDate()).padStart(2,'0');
}
function _genUID(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
function _hoyDMY(){
  var h=new Date();
  return String(h.getDate()).padStart(2,'0')+'/'+String(h.getMonth()+1).padStart(2,'0')+'/'+h.getFullYear();
}
function _parseDataDMY(str){
  if(!str)return null;
  var p=str.split('/');
  return p.length===3?new Date(p[2],p[1]-1,p[0]):null;
}
function _parseISO(str){
  if(!str)return null;
  var p=str.split('-');
  return p.length===3?new Date(p[0],p[1]-1,p[2]):null;
}
// Devuelve el bloque HTML de filtros de fecha reutilizable por prefijo
// prefix ej: 'ent', 'mt', 'canc' — fnFilter: nombre de la función JS de filtro
function _fechaFiltroHTML(prefix, fnFilter, rangoFn){
  var evt = rangoFn ? 'onchange="'+rangoFn+'()"' : 'oninput="'+fnFilter+'()"';
  return '<button id="'+prefix+'-btn-hoy" class="fh-btn on" onclick="'+prefix+'ToggleHoy()">'+
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'+
      'Hoy</button>'+
    '<div id="'+prefix+'-rango-wrap" class="fh-rng" style="display:none">'+
      '<input type="date" id="'+prefix+'-fecha-desde" class="fh-in" '+evt+'/>'+
      ICO('right',14,'s')+
      '<input type="date" id="'+prefix+'-fecha-hasta" class="fh-in" '+evt+'/>'+
      '<button class="fh-x" onclick="'+prefix+'LimpiarFechas()" title="Volver a Hoy" aria-label="Volver a Hoy">×</button>'+
    '</div>';
}
// Inicializa el estado "Hoy activo" y las funciones toggle/limpiar para un prefijo
function _initFiltroFecha(prefix, fnFilter, opts){
  var pagina = opts && opts.page;
  window[prefix+'_filtroHoy']=true;
  // Rango remoto: la pantalla solo tiene cargado lo que cubre window[prefix+'_rango'] (null = solo hoy)
  var recargarSiHabiaRango=function(){
    if(pagina && window[prefix+'_rango']){ window[prefix+'_rango']=null; reloadPage(pagina); return true; }
    return false;
  };
  window[prefix+'RangoCambio']=function(){
    var d=(document.getElementById(prefix+'-fecha-desde')||{}).value||'';
    var h=(document.getElementById(prefix+'-fecha-hasta')||{}).value||'';
    if(!d&&!h){ if(!recargarSiHabiaRango()) window[fnFilter](); return; }
    var hoy=_hoyISO();
    var desde=d||h, hasta=h||(d>hoy?d:hoy);
    if(desde>hasta){ var t=desde; desde=hasta; hasta=t; }
    window[prefix+'_rango']={desde:desde,hasta:hasta};
    reloadPage(pagina);
  };
  window[prefix+'ToggleHoy']=function(){
    window[prefix+'_filtroHoy']=!window[prefix+'_filtroHoy'];
    var btn=document.getElementById(prefix+'-btn-hoy');
    var wrap=document.getElementById(prefix+'-rango-wrap');
    if(window[prefix+'_filtroHoy']){
      // Hoy activo: morado, ocultar rango, limpiar fechas
      if(btn)btn.classList.add('on');
      if(wrap)wrap.style.display='none';
      var d=document.getElementById(prefix+'-fecha-desde');
      var h=document.getElementById(prefix+'-fecha-hasta');
      if(d)d.value=''; if(h)h.value='';
      if(recargarSiHabiaRango()) return;
    } else {
      // Rango activo: ghost, mostrar rango
      if(btn)btn.classList.remove('on');
      if(wrap)wrap.style.display='flex';
    }
    window[fnFilter]();
  };
  window[prefix+'LimpiarFechas']=function(){
    // X = volver a Hoy
    window[prefix+'_filtroHoy']=true;
    var btn=document.getElementById(prefix+'-btn-hoy');
    var wrap=document.getElementById(prefix+'-rango-wrap');
    if(btn)btn.classList.add('on');
    if(wrap)wrap.style.display='none';
    var d=document.getElementById(prefix+'-fecha-desde');
    var h=document.getElementById(prefix+'-fecha-hasta');
    if(d)d.value=''; if(h)h.value='';
    if(recargarSiHabiaRango()) return;
    window[fnFilter]();
  };
  // Tras recargar con un rango elegido, restaurar el estado visual del filtro
  var rg=window[prefix+'_rango'];
  if(pagina && rg){
    window[prefix+'_filtroHoy']=false;
    var b0=document.getElementById(prefix+'-btn-hoy'), w0=document.getElementById(prefix+'-rango-wrap');
    if(b0)b0.classList.remove('on');
    if(w0)w0.style.display='flex';
    var d0=document.getElementById(prefix+'-fecha-desde'), h0=document.getElementById(prefix+'-fecha-hasta');
    if(d0)d0.value=rg.desde; if(h0)h0.value=rg.hasta;
  }
}
// Aplica filtro de fecha a un array de filas (que tienen campo .fecha en dd/MM/yyyy)
function _applyFiltroFecha(prefix, rows){
  if(window[prefix+'_filtroHoy']) return rows.filter(function(r){return r.fecha===_hoyDMY();});
  var desdeISO=(document.getElementById(prefix+'-fecha-desde')||{}).value||'';
  var hastaISO=(document.getElementById(prefix+'-fecha-hasta')||{}).value||'';
  var desde=_parseISO(desdeISO); var hasta=_parseISO(hastaISO);
  if(!desde&&!hasta) return rows;
  return rows.filter(function(r){
    var d=_parseDataDMY(r.fecha);
    if(!d)return false;
    if(desde&&d<desde)return false;
    if(hasta&&d>hasta)return false;
    return true;
  });
}
// Exporta a Excel con SheetJS
function _exportXLSX(headers, rows, mapFn, sheetName, fileName){
  if(!rows.length){showToast('No hay datos para exportar','err');return;}
  var ws_data=[headers];
  rows.forEach(function(r){ws_data.push(mapFn(r));});
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  XLSX.writeFile(wb,fileName+'_'+_hoyISO()+'.xlsx');
  showToast('Excel descargado ('+rows.length+' registros)','ok');
}
function _sheetName(n){ return String(n||'Sede').replace(/[:\\\\/\?\*\[\]]/g,'').substring(0,31); }
function _exportMultiHoja(sedesData,fileName){
  if(!sedesData||!sedesData.length){showToast('Sin datos para exportar','err');return;}
  var wb=XLSX.utils.book_new(); var totalRows=0;
  sedesData.forEach(function(sede){
    if(!sede.rows||!sede.rows.length) return;
    var ws_data=[sede.headers];
    sede.rows.forEach(function(r){ ws_data.push(sede.mapFn(r)); });
    var ws=XLSX.utils.aoa_to_sheet(ws_data);
    if(sede.colWidths) ws['!cols']=sede.colWidths;
    XLSX.utils.book_append_sheet(wb,ws,_sheetName(sede.nombre));
    totalRows+=sede.rows.length;
  });
  if(!wb.SheetNames||!wb.SheetNames.length){showToast('Sin datos para exportar','err');return;}
  XLSX.writeFile(wb,fileName+'_'+_hoyISO()+'.xlsx');
  showToast('Excel descargado ('+totalRows+' registros en '+wb.SheetNames.length+' sede(s))','ok');
}
function _exportConSpinner(btnId,modulo,callback){
  var btn=document.getElementById(btnId), orig=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.textContent='Exportando...';}
  google.script.run
    .withSuccessHandler(function(r){
      if(btn){btn.disabled=false;btn.innerHTML=orig;}
      if(!r||!r.ok){showToast(r?r.error:'Error al exportar','err');return;}
      callback(r.sedes);
    })
    .withFailureHandler(function(e){
      if(btn){btn.disabled=false;btn.innerHTML=orig;}
      showToast(e.message,'err');
    })
    .getExportMultiSede(S.token,modulo);
}

var _ENT_EST='';      // filtro de estado Dynamics: '', 'pen', 'par', 'reg'
var _ENT_ABIERTOS={}; // recepciones desplegadas (se conservan al filtrar)
var _ENT_GRUPOS=[];

function renderEntradas(r){
  dbg('[ENTRADAS] renderEntradas() — r.ok='+( r&&r.ok)+' r.error='+(r&&r.error)+' data.length='+(r&&r.data&&r.data.length));
  if(_handleExpired(r,'entradas-root')) return;
  if(!r||!r.ok){PAGE_LOADED['entradas']=false;errBox('entradas-root',r?r.error:'Error desconocido','entradas');return;}
  DATA.entradas=r.data;
  _ENT_EST=''; _ENT_ABIERTOS={};
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  document.getElementById('entradas-root').innerHTML=
    '<div class="ent-sum" id="ent-sum"></div>'+
    '<div class="ent-fl">'+
      '<div class="ent-srch">'+icoBuscar+'<input id="ent-busq" placeholder="Buscar factura, OC, proveedor o producto…" oninput="filterEntradas()"/></div>'+
      _fechaFiltroHTML('ent','filterEntradas','entRangoCambio')+
      '<div class="ent-seg" id="ent-est"></div>'+
      '<span class="ent-cnt" id="ent-count"></span>'+
    '</div>'+
    '<div class="ent-tw">'+
      '<div class="ent-hd"><span></span><span>Fecha</span><span>Factura · Proveedor</span><span>Orden de compra</span><span class="r">Productos</span><span class="r">Unidades</span><span>Dynamics</span><span>Responsable</span><span></span></div>'+
      '<div id="ent-rows"></div>'+
    '</div>'+
    '<div class="ent-lst" id="ent-lst"></div>';
  _initFiltroFecha('ent','filterEntradas',{page:'entradas'});
  filterEntradas();
}

// Estado de Dynamics de una línea: reg (Registrado), car (Cargado), pen (Pendiente), sin (vacío o "--")
function _entDyn(v){
  v=String(v||'').trim().toLowerCase();
  if(v==='registrado') return 'reg';
  if(v==='cargado') return 'car';
  if(v==='pendiente') return 'pen';
  return 'sin';
}
function _entPillLinea(v){
  var k=_entDyn(v);
  if(k==='reg') return '<span class="ent-pill ok">Registrado</span>';
  if(k==='car') return '<span class="ent-pill pa">Cargado</span>';
  if(k==='pen') return '<span class="ent-pill wa">Pendiente</span>';
  return '<span class="ent-pill no">Sin estado</span>';
}
// Estado de una recepción completa: pen / par / reg
function _entEstadoGrupo(g){
  var reg=g.items.filter(function(i){return _entDyn(i.dynamics)==='reg';}).length;
  var pen=g.items.filter(function(i){var k=_entDyn(i.dynamics);return k==='pen'||k==='sin';}).length;
  g.nReg=reg;
  if(reg===g.items.length) return 'reg';
  if(pen===g.items.length) return 'pen';
  return 'par';
}
function _entPillGrupo(g){
  if(g.est==='reg') return '<span class="ent-pill ok">Registrado</span>';
  if(g.est==='pen') return '<span class="ent-pill wa">Pendiente</span>';
  var todoCargado=g.items.every(function(i){return _entDyn(i.dynamics)==='car';});
  return '<span class="ent-pill pa">'+(todoCargado?'Cargado':'Parcial '+g.nReg+'/'+g.items.length)+'</span>';
}

function _filterEntradas(){
  var q=((document.getElementById('ent-busq')||{}).value||'').toLowerCase();
  var rows=DATA.entradas.filter(function(r){
    return !q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||r.factura.toLowerCase().indexOf(q)>-1||
      (r.oc||'').toLowerCase().indexOf(q)>-1||(r.proveedor||'').toLowerCase().indexOf(q)>-1;
  });
  rows=_applyFiltroFecha('ent',rows);
  rows.sort(function(a,b){return b._row-a._row;});

  // Una fila por recepción: misma fecha, factura, proveedor y OC
  var mapa={}, grupos=[];
  rows.forEach(function(r){
    var k=[r.fecha,r.factura,r.proveedor,r.oc].join('|');
    if(!mapa[k]){ mapa[k]={key:k,fecha:r.fecha,factura:r.factura,proveedor:r.proveedor,oc:r.oc,responsable:r.responsable,items:[],und:0}; grupos.push(mapa[k]); }
    mapa[k].items.push(r); mapa[k].und+=r.unidades;
  });
  grupos.forEach(function(g){ g.est=_entEstadoGrupo(g); });
  var c={pen:0,par:0,reg:0}; grupos.forEach(function(g){c[g.est]++;});
  var totalUnd=grupos.reduce(function(a,g){return a+g.und;},0);

  // Resumen
  var t=grupos.length||1, pc=function(n){return (n/t*100).toFixed(2);};
  var leg=function(k,color,n,txt){return '<span onclick="entSetEstado(\''+k+'\')"><em style="background:'+color+'"></em><b>'+n+'</b> '+txt+'</span>';};
  document.getElementById('ent-sum').innerHTML=
    '<div class="ent-card"><div class="ent-k">Recepciones</div><div class="ent-v">'+fmt(grupos.length)+'</div><div class="ent-n">'+fmt(rows.length)+(rows.length===1?' producto recibido':' productos recibidos')+'</div></div>'+
    '<div class="ent-card"><div class="ent-k">Unidades recibidas</div><div class="ent-v">'+fmt(totalUnd)+'<small>und.</small></div><div class="ent-n">En el período seleccionado</div></div>'+
    '<div class="ent-card"><div class="ent-k">Registro en Dynamics</div>'+
      '<div class="ent-dist"><i style="width:'+pc(c.reg)+'%;background:var(--ok)"></i><i style="width:'+pc(c.par)+'%;background:var(--accent)"></i><i style="width:'+pc(c.pen)+'%;background:var(--warn)"></i></div>'+
      '<div class="ent-leg">'+leg('pen','var(--warn)',c.pen,'Pendientes')+leg('par','var(--accent)',c.par,'Parciales')+leg('reg','var(--ok)',c.reg,'Registradas')+'</div></div>';

  var seg=function(k,txt,n){return '<button class="'+(_ENT_EST===k?'on':'')+'" onclick="entSetEstado(\''+k+'\')">'+txt+'<span>'+n+'</span></button>';};
  document.getElementById('ent-est').innerHTML=seg('','Todas',grupos.length)+seg('pen','Pendientes',c.pen)+seg('par','Parciales',c.par)+seg('reg','Registradas',c.reg);

  var vis=_ENT_EST?grupos.filter(function(g){return g.est===_ENT_EST;}):grupos;
  _ENT_GRUPOS=vis;
  window._ENT_ROWS={}; rows.forEach(function(r){window._ENT_ROWS[r._row]=r;});
  var el=document.getElementById('ent-count');
  if(el)el.textContent=vis.length+(vis.length===1?' recepción':' recepciones');

  var chev='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  var lapiz=function(row,tit){return '<button class="ent-edb" title="'+tit+'" onclick="event.stopPropagation();editarDynamicsRowSafe('+row+')">'+ICO('edit',13,'s')+'</button>';};
  var lineas=function(g,i){
    if(!_ENT_ABIERTOS[g.key]) return '';
    return '<div class="ent-its on">'+g.items.map(function(x){
      return '<div class="ent-it"><span class="mono">'+esc(x.sku)+'</span><span class="d">'+esc(x.desc)+'</span><span class="r"><b>'+fmt(x.unidades)+'</b></span><span>'+_entPillLinea(x.dynamics)+'</span>'+
        '<span class="r">'+(g.oc?'':lapiz(x._row,'Cambiar estado de Dynamics'))+'</span></div>';
    }).join('')+'</div>';
  };
  document.getElementById('ent-rows').innerHTML=vis.map(function(g,i){
    var o=!!_ENT_ABIERTOS[g.key];
    return '<div class="ent-g"><div class="ent-rc'+(o?' open':'')+'" onclick="entTg('+i+')"><span class="ent-chev">'+chev+'</span>'+
      '<span class="mono">'+esc(g.fecha)+'</span>'+
      '<div><div class="ent-fa mono">'+esc(g.factura||'—')+'</div><div class="ent-sb">'+esc(g.proveedor||'')+'</div></div>'+
      '<span>'+(g.oc?'<span class="ent-oc">'+esc(g.oc)+'</span>':'<span class="ent-sin">Sin OC</span>')+'</span>'+
      '<span class="r">'+g.items.length+'</span><span class="r"><b>'+fmt(g.und)+'</b></span>'+
      '<span>'+_entPillGrupo(g)+'</span><span class="ent-resp">'+esc(g.responsable||'')+'</span>'+
      '<span class="r">'+(g.oc?lapiz(g.items[0]._row,'Cambiar el estado de Dynamics de toda la OC'):'')+'</span></div>'+lineas(g,i)+'</div>';
  }).join('')||'<div class="ent-vacio">Sin registros</div>';
  document.getElementById('ent-lst').innerHTML=vis.map(function(g,i){
    return '<div class="ent-cd"><div class="ent-h" onclick="entTg('+i+')"><div style="min-width:0"><div class="ent-fa mono">'+esc(g.factura||'—')+'</div>'+
      '<div class="ent-sb">'+esc(g.proveedor||'')+' · '+esc(g.fecha)+'</div>'+
      '<div class="ent-tags">'+_entPillGrupo(g)+(g.oc?'<span class="ent-oc">'+esc(g.oc)+'</span>':'')+(g.oc?lapiz(g.items[0]._row,'Cambiar el estado de Dynamics de toda la OC'):'')+'</div></div>'+
      '<div class="ent-u"><b>'+fmt(g.und)+'</b><span>'+g.items.length+' prod.</span></div></div>'+lineas(g,i)+'</div>';
  }).join('')||'<div class="ent-vacio">Sin registros</div>';
}

function entTg(i){ var g=_ENT_GRUPOS[i]; if(!g) return; _ENT_ABIERTOS[g.key]=!_ENT_ABIERTOS[g.key]; _filterEntradas(); }
function entSetEstado(k){ _ENT_EST=(_ENT_EST===k?'':k); _filterEntradas(); }

// Wrapper seguro — lee valor actual desde el índice en lugar de recibirlo por interpolación de string
function editarDynamicsRowSafe(rowNum){
  var r = (window._ENT_ROWS||{})[rowNum];
  editarDynamicsRow(rowNum, r ? (r.dynamics||'') : '');
}

function exportEntradas(){
  if(S&&S.rol!=='store'){
    var HDR=['Fecha','Factura','SKU','Descripción','Unidades','F. Vencimiento','Proveedor','OC','Dynamics','Responsable'];
    var CW=[{wch:12},{wch:16},{wch:14},{wch:36},{wch:10},{wch:14},{wch:20},{wch:14},{wch:12},{wch:16}];
    _exportConSpinner('btn-export-entradas','entradas',function(sedes){
      _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:HDR,rows:s.data,colWidths:CW,
        mapFn:function(r){return[r.fecha,r.factura,r.sku,r.desc,r.unidades,r.fVenc||'',r.proveedor,r.oc,r.dynamics,r.responsable];}};}),'entradas_sedes');
    });return;
  }
  var rows=_getFilteredRows('entradas');
  _exportXLSX(['Fecha','Factura','SKU','Descripción','Unidades','F. Vencimiento','Proveedor','OC','Dynamics','Responsable'],
    rows,function(r){return[r.fecha,r.factura,r.sku,r.desc,r.unidades,r.fVenc||'',r.proveedor,r.oc,r.dynamics,r.responsable];},'Entradas','entradas');
}

function editarDynamicsRow(rowNum, valorActual){
  // Obtener la OC de la fila para mostrarla en el título
  var item = DATA.entradas.find(function(x){ return x._row === rowNum; });
  var oc   = item ? (item.oc || '—') : '—';
  _selectDialog(
    'Editar Dynamics · OC: ' + oc,
    'Dynamics',
    ['Registrado','Pendiente'],
    valorActual || '',
    function(nuevoValor){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){ showToast(r.error,'err'); return; }
          // Actualizar DATA local: todas las filas con la misma OC
          DATA.entradas.forEach(function(x){
            if((x.oc||'') === (item ? item.oc : '')) x.dynamics = nuevoValor;
          });
          filterEntradas();
          showToast('Dynamics actualizado en ' + r.actualizados + ' fila(s) de OC: ' + r.oc, 'ok');
        })
        .withFailureHandler(function(e){ showToast(e.message,'err'); })
        .editarDynamicsEntrada(S.token, rowNum, nuevoValor);
    }
  );
}

/* ── ENTRADA: un solo formulario, dos formas de cargar los productos ── */
var ENTRADA_TAB='manual';
var ARCH_ROWS=[];   // filas parseadas del archivo
var ARCH_TOT=null;  // totales de la OC leídos del PDF: {sub, imp, total}
var ENT_ROW_COUNT=0;
var ENT_OCS=[];     // OC pendientes de recibir (sugerencias)

function switchEntradaTab(tab){
  ENTRADA_TAB=tab;
  document.getElementById('tab-content-manual').classList.toggle('hidden', tab!=='manual');
  document.getElementById('tab-content-archivo').classList.toggle('hidden', tab!=='archivo');
  document.getElementById('ent-m-manual').classList.toggle('on', tab==='manual');
  document.getElementById('ent-m-archivo').classList.toggle('on', tab==='archivo');
  document.getElementById('btn-ent-save').textContent=tab==='manual'?'Guardar entrada':'Importar desde archivo';
  entResumen();
}

function entDyn(b){
  document.getElementById('ent-dynamics').value=b.dataset.v;
  document.querySelectorAll('#ent-dy button').forEach(function(x){x.classList.toggle('on',x===b);});
}

// Resumen del pie y estado del botón Guardar
function entResumen(){
  var fac=(document.getElementById('ent-factura').value||'').trim();
  var n=0,u=0;
  if(ENTRADA_TAB==='manual'){
    document.querySelectorAll('#ent-rows-wrap [id^="ent-row-"]').forEach(function(row){
      var id=row.id.replace('ent-row-','');
      var sku=((document.getElementById('er-sku-'+id)||{}).value||'').trim();
      var und=Number((document.getElementById('er-und-'+id)||{}).value||0);
      if(sku&&und>0){ n++; u+=und; }
    });
  } else {
    ARCH_ROWS.forEach(function(r){ if(r.incluir){ n++; u+=Number(r.cant)||0; } });
  }
  var ok=!!fac&&n>0;
  var btn=document.getElementById('btn-ent-save');
  if(btn&&btn.textContent.indexOf('...')<0) btn.disabled=!ok;
  var msg=document.getElementById('ent-msg');
  if(msg){
    msg.innerHTML=ok?'<b>'+n+'</b> '+(n===1?'producto':'productos')+' · <b>'+fmt(u)+'</b> unidades':(!fac?'Escribe la factura para continuar':(ENTRADA_TAB==='manual'?'Agrega al menos un producto':'Carga un archivo y marca los productos'));
    msg.style.color=ok?'':'var(--text3)';
  }
  var st=document.getElementById('ent-stat');
  if(st){ st.className='en2-stat'+(ok?' ok':''); document.getElementById('ent-stat-t').textContent=ok?'Listo para guardar':'Faltan datos'; }
}

function abrirEntrada(){
  switchEntradaTab('manual');
  ['ent-factura','ent-proveedor','ent-oc','ent-fvenc'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('ent-responsable').value=(S&&S.usuario)||'';
  document.getElementById('ent-dynamics').value='Pendiente';
  document.querySelectorAll('#ent-dy button').forEach(function(x){x.classList.toggle('on',x.dataset.v==='Pendiente');});
  document.getElementById('ent-rows-wrap').innerHTML='';
  ENT_ROW_COUNT=0;
  document.getElementById('ent-err').textContent='';
  addEntradaRow();
  clearFile();
  document.getElementById('arch-err').textContent='';
  entCargarOCs();
  entResumen();
  openFS('fs-entrada');
  setTimeout(function(){document.getElementById('ent-factura').focus();},120);
}

// OC pendientes de recibir de esta tienda: al elegir una se llenan OC y proveedor
function entCargarOCs(){
  ENT_OCS=[];
  document.getElementById('ent-ocs').innerHTML='';
  google.script.run
    .withSuccessHandler(function(r){
      if(!r||!r.ok) return;
      ENT_OCS=(r.data||[]).filter(function(o){
        return (o.estado||'Pendiente')==='Pendiente' && (!S||S.rol!=='store'||String(o.sedeId)===String(S.sheetId));
      }).slice(0,6);
      entPintarOCs();
    })
    .withFailureHandler(function(){})
    .getOrdenesCompra(S.token);
}
function entPintarOCs(){
  var el=document.getElementById('ent-ocs'); if(!el) return;
  el.innerHTML=ENT_OCS.length?'<small>Pendientes:</small>'+ENT_OCS.map(function(o,i){
    return '<button type="button" onclick="entAplicarOC('+i+')">'+esc(o.oc)+'</button>';
  }).join(''):'';
}
function entAplicarOC(i){
  var o=typeof i==='number'?ENT_OCS[i]:ENT_OCS.filter(function(x){return x.oc===i;})[0];
  if(!o) return;
  document.getElementById('ent-oc').value=o.oc;
  var pv=document.getElementById('ent-proveedor');
  if(pv&&!pv.value.trim()) pv.value=o.proveedor||'';
  entResumen();
}

/* ── MANUAL: filas de producto ── */
function addEntradaRow(){
  ENT_ROW_COUNT++;
  var id=ENT_ROW_COUNT;
  var wrap=document.getElementById('ent-rows-wrap');
  var div=document.createElement('div');
  div.id='ent-row-'+id;
  div.className='en2-ln';
  div.innerHTML=
    '<span class="en2-n"></span>'+
    '<div class="en2-sk autocomplete-wrap">'+
      '<input class="en2-in mono" id="er-sku-'+id+'" placeholder="SKU o nombre…" autocomplete="off"/>'+
      '<button type="button" class="en2-cam" title="Escanear" aria-label="Escanear" tabindex="-1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>'+
      '<div class="ac-list" id="ac-er-'+id+'"></div>'+
    '</div>'+
    '<input class="en2-in en2-d" id="er-desc-'+id+'" placeholder="Se completa solo" readonly/>'+
    '<input class="en2-in en2-u" id="er-und-'+id+'" type="number" min="0" inputmode="numeric" placeholder="0"/>'+
    '<button type="button" class="en2-del" title="Quitar" aria-label="Quitar producto">×</button>';
  wrap.appendChild(div);
  var sku=document.getElementById('er-sku-'+id), und=document.getElementById('er-und-'+id);
  sku.addEventListener('input',function(){ acSearch('er-sku-'+id,'er-desc-'+id,'','ac-er-'+id); entResumen(); });
  sku.addEventListener('acpick',function(){ entResumen(); und.focus(); });
  und.addEventListener('input',entResumen);
  und.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); addEntradaRow(); } });
  div.querySelector('.en2-cam').addEventListener('click',function(){ openScanner('er-sku-'+id,'er-desc-'+id,''); });
  div.querySelector('.en2-del').addEventListener('click',function(){ removeEntradaRow(id); });
  entNumerar();
  entResumen();
  sku.focus();
}

function entNumerar(){
  document.querySelectorAll('#ent-rows-wrap .en2-n').forEach(function(n,i){ n.textContent=i+1; });
}

function removeEntradaRow(id){
  var el=document.getElementById('ent-row-'+id);
  if(el)el.remove();
  if(!document.querySelector('#ent-rows-wrap [id^="ent-row-"]')) addEntradaRow();
  entNumerar();
  entResumen();
}

// Atajos: Esc cierra y Ctrl+Enter guarda
document.addEventListener('keydown',function(e){
  var fs=document.getElementById('fs-entrada');
  if(!fs||!fs.classList.contains('open')) return;
  if(e.key==='Escape'){ closeFS('fs-entrada'); return; }
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){
    var b=document.getElementById('btn-ent-save');
    if(b&&!b.disabled){ e.preventDefault(); b.click(); }
  }
});

/* ── ARCHIVO: parse Excel en el browser con SheetJS ── */
function handleDrop(event){
  event.preventDefault();
  document.getElementById('drop-zone').style.borderColor='var(--border2)';
  var file=event.dataTransfer.files[0];
  if(file)handleFileSelect(file);
}

function handleFileSelect(file){
  if(!file)return;
  var err=document.getElementById('arch-err');
  err.textContent='';
  _archEstado('');
  if(/\.pdf$/i.test(file.name) || file.type==='application/pdf'){ leerPDFdeOC(file); return; }
  if(!file.name.match(/\.xlsx?$/i)){err.textContent='Solo se aceptan archivos .xlsx, .xls o .pdf';return;}

  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=new Uint8Array(e.target.result);
      var wb=XLSX.read(data,{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});

      // Detectar fila de headers (buscar "Código de artículo" o similar)
      var dataStart=1; // por defecto saltar fila 0 (headers)
      ARCH_ROWS=[]; ARCH_TOT=null;

      // Si el Excel trae una columna de monto (por su encabezado), se muestra el total a importar
      var montoCol=-1;
      (rows[0]||[]).forEach(function(h,ci){
        var n=String(h||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
        if(montoCol<0 && ['monto','monto neto','importe','importe neto','importe de linea','valor neto'].indexOf(n)>-1) montoCol=ci;
      });

      rows.slice(dataStart).forEach(function(row,i){
        var sku=String(row[2]||'').trim();
        var desc=String(row[4]||'').trim();
        var cant=Number(row[6]||0);
        if(!sku||sku===''||sku.toLowerCase()==='código de artículo')return;
        var fila={idx:i+1,sku:sku,desc:desc,cant:cant,incluir:true};
        if(montoCol>-1){
          var mv=row[montoCol];
          var mn=typeof mv==='number'?mv:Number(String(mv||'').replace(/[^\d.,-]/g,'').replace(/,/g,''));
          if(isFinite(mn)&&String(mv||'')!=='') fila.monto=Math.round(mn*100)/100;
        }
        ARCH_ROWS.push(fila);
      });

      if(!ARCH_ROWS.length){err.textContent='No se encontraron productos en el archivo';return;}
      renderPreview();
    }catch(ex){err.textContent='Error leyendo archivo: '+ex.message;}
  };
  reader.readAsArrayBuffer(file);
}

function _soles(n){
  return 'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// Monto de la OC: baja al desmarcar productos. Solo aparece si el archivo trae montos (el PDF de la OC los trae).
function _archTotal(){ _archTotalInner(); entResumen(); }
function _archTotalInner(){
  var el=document.getElementById('arch-total'); if(!el) return;
  var th=document.getElementById('arch-th-monto');
  var conMonto=ARCH_ROWS.some(function(r){return typeof r.monto==='number';});
  if(th) th.style.display=conMonto?'':'none';
  if(!conMonto){ el.style.display='none'; el.innerHTML=''; return; }
  var todo=0, sel=0, nSel=0;
  ARCH_ROWS.forEach(function(r){
    if(typeof r.monto!=='number') return;
    todo+=r.monto;
    if(r.incluir){ sel+=r.monto; nSel++; }
  });
  todo=Math.round(todo*100)/100; sel=Math.round(sel*100)/100;
  var quita=Math.round((todo-sel)*100)/100;
  var t=ARCH_TOT||{};
  var html='<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r2);padding:14px 16px">'+
    '<div><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3)">Monto a importar (sin impuestos)</div>'+
      '<div style="font-size:26px;font-weight:700;letter-spacing:-.02em;color:var(--text)">'+_soles(sel)+'</div>'+
      '<div style="font-size:12px;color:var(--text2)">'+nSel+' de '+ARCH_ROWS.length+' productos'+(quita>0.004?' · <span style="color:var(--warn)">− '+_soles(quita)+' sin incluir</span>':'')+'</div></div>';
  if(t.total && t.sub){
    var exacto=Math.abs(sel-t.sub)<0.005;
    var est=exacto? t.total : Math.round(sel*(t.total/t.sub)*100)/100;
    html+='<div style="text-align:right"><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3)">Total con impuestos'+(exacto?'':' (aprox.)')+'</div>'+
      '<div style="font-size:18px;font-weight:600;color:var(--text)">'+(exacto?'':'≈ ')+_soles(est)+'</div>'+
      '<div style="font-size:12px;color:var(--text2)">OC completa: '+_soles(t.total)+'</div></div>';
  }
  html+='</div>';
  if(t.sub && Math.abs(todo-t.sub)>0.05){
    html+='<div style="font-size:12px;color:var(--warn);margin-top:6px">'+ICO('warn',13)+'La suma de las líneas ('+_soles(todo)+') no coincide con el subtotal del PDF ('+_soles(t.sub)+'). Puede que algún monto se leyó mal: revisa la columna Monto.</div>';
  }
  el.innerHTML=html; el.style.display='block';
}

function renderPreview(){
  document.getElementById('arch-preview-title').textContent=
    'Vista previa — '+ARCH_ROWS.length+' producto(s) encontrados';
  var conMonto=ARCH_ROWS.some(function(r){return typeof r.monto==='number';});
  var tbody=ARCH_ROWS.map(function(r){
    // Las filas leídas de un PDF se pueden corregir aquí (SKU y cantidad); las de Excel se muestran tal cual
    var skuCell=r.editable
      ? '<input class="inp" value="'+esc(r.sku)+'" onchange="editArch('+r.idx+',\'sku\',this.value)" style="width:98px;padding:4px 6px;font-size:13px;font-family:var(--font-mono)"/>'
      : esc(r.sku);
    var cantCell=r.editable
      ? '<input class="inp" type="number" min="0" value="'+esc(r.cant)+'" onchange="editArch('+r.idx+',\'cant\',this.value)" style="width:68px;padding:4px 6px;font-size:13px;text-align:right;font-weight:600"/>'
      : fmt(r.cant);
    return '<tr id="prev-row-'+r.idx+'">'+
      '<td class="mono" style="font-size:11px;color:var(--text3)">'+r.idx+'</td>'+
      '<td class="mono">'+skuCell+'</td>'+
      '<td class="td-desc"'+(r.editable?' style="max-width:130px"':'')+'>'+esc(r.desc)+(r.aviso?'<div style="font-size:11px;color:var(--warn);white-space:normal">'+esc(r.aviso)+'</div>':'')+'</td>'+
      '<td class="r" style="font-weight:600">'+cantCell+'</td>'+
      (conMonto?'<td class="r mono" style="font-size:12px;color:var(--text2);white-space:nowrap">'+(typeof r.monto==='number'?_soles(r.monto).replace('S/ ',''):'—')+'</td>':'')+
      '<td class="c"><input type="checkbox" '+(r.incluir?'checked':'')+ 
        ' onchange="toggleArch('+r.idx+',this.checked)" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer"/></td>'+
    '</tr>';
  }).join('');
  document.getElementById('arch-preview-tbody').innerHTML=tbody;
  document.getElementById('arch-preview').classList.remove('hidden');
  _archTotal();
}

function toggleArch(idx,val){
  var row=ARCH_ROWS.find(function(r){return r.idx===idx;});
  if(row)row.incluir=val;
  _archTotal();
}

/* ── LEER LA OC DESDE UN PDF ──
   Los PDF de la OC son imágenes (sin texto), así que se leen con OCR en el propio navegador
   (pdf.js dibuja cada página y Tesseract la lee). Todo se descarga solo la primera vez que se usa.
   El resultado va a la misma vista previa que el Excel, donde se puede corregir antes de importar. */
function _archEstado(txt){
  var el=document.getElementById('arch-ocr-estado'); if(!el) return;
  el.style.display=txt?'block':'none';
  el.textContent=txt||'';
}
function _ocrScript(src){
  return new Promise(function(ok,ko){
    var s=document.createElement('script'); s.src=src;
    s.onload=ok; s.onerror=function(){ ko(new Error('No se pudo cargar '+src)); };
    document.head.appendChild(s);
  });
}
var _ocrLibs=null;
function _ocrCargarLibs(){
  if(!_ocrLibs){
    _ocrLibs=Promise.all([_ocrScript('vendor/pdfjs/pdf.min.js'),_ocrScript('vendor/ocr/tesseract.min.js')]).then(function(){
      pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';
    });
  }
  return _ocrLibs.catch(function(e){ _ocrLibs=null; throw e; });
}

// Convierte el texto leído por OCR (todas las páginas) en { oc, items:[{linea,sku,desc,cant,aviso}] }
function _parsearOCTexto(paginas){
  var oc='';
  var items=[], ultimaLinea=0;
  var reItem=/^[\s|~_.\-]*(\d{1,3})\s+(\d{6,10})\s+(.*?)\s*(\d{2}\/\d{2}\/\d{4})\s+(\d[\d.]*,\d{2}|\d+)\s+[A-Za-z]{2,4}\b(.*)$/;
  // Los montos siempre llevan 2 decimales; el OCR a veces pierde la coma ("3.14815"), así que se toman los dígitos y se divide entre 100
  function monto(tok){ var d=String(tok||'').replace(/\D/g,''); return d? Number(d)/100 : null; }
  function ultimoNumero(txt){
    var t=String(txt||'').split(/\s+/).filter(function(x){ return /^\d[\d.,]*$/.test(x); });
    return t.length? t[t.length-1] : '';
  }
  var totales=null;
  var reItemFlojo=/^[\s|~_.\-]*(\d{1,3})\s+(\d{6,10})\s+(.*)$/;
  var reFinTabla=/Monto del|subtotal|^\s*Moneda|Impuesto/i;
  function limpiar(s){ return String(s||'').replace(/[~_|]+/g,' ').replace(/\s+/g,' ').trim(); }
  paginas.forEach(function(texto){
    var lineas=String(texto||'').split(/\r?\n/);
    if(!oc){
      var m=String(texto).match(/[O0]C-\d{5,}(?:-\d+)?/);
      if(m) oc=m[0].replace(/^0C/,'OC');
    }
    var dentro=false, actual=null;
    // Totales de la OC (última página): "PEN subtotal descuento cargos impuesto redondeo total"
    lineas.forEach(function(l){
      if(/^\s*PEN\b/.test(l)){
        var nums=l.split(/\s+/).filter(function(x){ return /^\d[\d.,]*$/.test(x); }).map(monto);
        if(nums.length>=2) totales={sub:nums[0], imp:nums.length>=4?nums[3]:null, total:nums[nums.length-1]};
      }
    });
    lineas.forEach(function(l){
      if(!dentro){ if(/de\s+l[ií]nea/i.test(l)) dentro=true; return; }
      if(reFinTabla.test(l)){ dentro=false; actual=null; return; }
      var m=l.match(reItem);
      if(m){
        var cant=Number(String(m[5]).replace(/\./g,'').replace(',','.'));
        actual={linea:Number(m[1]),sku:m[2],desc:limpiar(m[3]),cant:cant,aviso:'',monto:monto(ultimoNumero(m[6]))};
        items.push(actual); ultimaLinea=Math.max(ultimaLinea,actual.linea); return;
      }
      var f=l.match(reItemFlojo);
      if(f){
        // Línea con código pero sin cantidad legible: se muestra para corregirla a mano
        actual={linea:Number(f[1]),sku:f[2],desc:limpiar(f[3]),cant:0,aviso:'No se pudo leer la cantidad: escríbela'};
        items.push(actual); ultimaLinea=Math.max(ultimaLinea,actual.linea); return;
      }
      // Continuación de la descripción (la descripción ocupa varias líneas en el PDF)
      var t=limpiar(l);
      if(actual && t) actual.desc=(actual.desc+' '+t).trim();
    });
  });
  // Si faltan números de línea (1..N seguidos), alguna fila no se leyó
  var vistas={}; items.forEach(function(it){ vistas[it.linea]=true; });
  var faltan=[];
  for(var n=1;n<=ultimaLinea;n++){ if(!vistas[n]) faltan.push(n); }
  return {oc:oc.replace(/(OC-\d+)-\d+$/,'$1'), items:items, faltan:faltan, totales:totales};
}

async function leerPDFdeOC(file){
  var err=document.getElementById('arch-err');
  var worker=null;
  try{
    _archEstado('Preparando el lector de PDF… (la primera vez descarga unos 7 MB)');
    await _ocrCargarLibs();
    var buf=await file.arrayBuffer();
    var pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
    var base=new URL('vendor/ocr/',location.href).href;
    worker=await Tesseract.createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,gzip:true});
    var paginas=[];
    for(var i=1;i<=pdf.numPages;i++){
      _archEstado('Leyendo el PDF… página '+i+' de '+pdf.numPages);
      var pg=await pdf.getPage(i);
      var vp=pg.getViewport({scale:2.5});
      var cv=document.createElement('canvas'); cv.width=vp.width; cv.height=vp.height;
      await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      var res=await worker.recognize(cv);
      paginas.push(res.data.text||'');
    }
    await worker.terminate(); worker=null;

    var r=_parsearOCTexto(paginas);
    if(!r.items.length){
      _archEstado('');
      err.textContent='No se encontraron productos en el PDF. Si es otro formato, usa el Excel o la carga manual.';
      return;
    }
    ARCH_ROWS=r.items.map(function(it,i){
      return {idx:i+1,sku:it.sku,desc:it.desc,cant:it.cant,incluir:it.cant>0,editable:true,aviso:it.aviso,descOCR:it.desc,monto:it.monto};
    });
    ARCH_TOT=r.totales||{sub:null,imp:null,total:null};
    var ocEl=document.getElementById('ent-oc');
    if(r.oc && ocEl && !ocEl.value.trim()){ ocEl.value=r.oc; entAplicarOC(r.oc); }

    // Verificar cada SKU contra el Stock de la sede y usar su descripción oficial
    _archEstado('Comprobando los SKU con tu Stock…');
    google.script.run
      .withSuccessHandler(function(s){
        var mapa=(s&&s.ok&&s.data)||{};
        ARCH_ROWS.forEach(function(row){ _archAplicarStock(row,mapa); });
        _archEstado('PDF leído'+(r.oc?' · '+r.oc:'')+' · revisa la vista previa antes de importar'+
          (r.faltan.length?' · Atención: no se leyeron las líneas: '+r.faltan.join(', '):''));
        renderPreview();
      })
      .withFailureHandler(function(){
        _archEstado('PDF leído · no se pudo comprobar el Stock, revisa los SKU a mano');
        renderPreview();
      })
      .skusEnStock(S.token, ARCH_ROWS.map(function(x){return x.sku;}));
  }catch(ex){
    if(worker){ try{ await worker.terminate(); }catch(e){} }
    _archEstado('');
    err.textContent='No se pudo leer el PDF: '+(ex&&ex.message?ex.message:ex)+'. Usa el Excel o la carga manual.';
  }
}

function _archAplicarStock(row,mapa){
  var d=mapa[String(row.sku).trim()];
  if(d){
    row.desc=d; row.aviso=row.cant>0?'':row.aviso; row.noStock=false;
    if(row.cant>0) row.incluir=true;
  } else {
    row.desc=row.descOCR||row.desc; row.noStock=true;
    row.aviso='No está en el Stock de tu sede: corrige el SKU, o marca ¿Incluir? si es un producto nuevo';
    row.incluir=false;
  }
}

function editArch(idx,campo,valor){
  var row=ARCH_ROWS.find(function(r){return r.idx===idx;}); if(!row) return;
  if(campo==='cant'){
    var n=Math.floor(Number(valor)); row.cant=(n>=0)?n:0;
    if(row.cant>0 && !row.noStock) row.incluir=true;
    if(row.cant>0 && row.aviso && /cantidad/i.test(row.aviso)) row.aviso='';
    renderPreview(); return;
  }
  row.sku=String(valor||'').trim();
  google.script.run
    .withSuccessHandler(function(s){ _archAplicarStock(row,(s&&s.ok&&s.data)||{}); renderPreview(); })
    .withFailureHandler(function(){ renderPreview(); })
    .skusEnStock(S.token,[row.sku]);
}

function clearFile(){
  ARCH_ROWS=[]; ARCH_TOT=null;
  _archEstado('');
  document.getElementById('arch-file-inp').value='';
  document.getElementById('arch-preview').classList.add('hidden');
  document.getElementById('arch-err').textContent='';
  if(typeof entResumen==='function') entResumen();
}

/* ── GUARDAR (manual o archivo) ── */
function guardarEntrada(){
  if(ENTRADA_TAB==='archivo'){
    guardarEntradaArchivo();
  } else {
    guardarEntradaManual();
  }
}

function guardarEntradaManual(){
  var fac=document.getElementById('ent-factura').value.trim();
  var err=document.getElementById('ent-err');
  if(!fac){err.textContent='La factura/referencia es obligatoria';return;}

  // Recopilar todas las filas de producto
  var filas=[];
  var rows=document.getElementById('ent-rows-wrap').querySelectorAll('[id^="ent-row-"]');
  var valido=true;
  rows.forEach(function(row){
    var id=row.id.replace('ent-row-','');
    var sku=(document.getElementById('er-sku-'+id)||{}).value||'';
    var und=(document.getElementById('er-und-'+id)||{}).value||'';
    sku=sku.trim();
    if(!sku||!und){valido=false;return;}
    filas.push({
      sku:sku,
      desc:(document.getElementById('er-desc-'+id)||{}).value||'',
      unidades:Number(und)
    });
  });

  if(!filas.length){err.textContent='Agrega al menos un producto';return;}
  if(!valido){err.textContent='Completa SKU y Unidades en todos los productos';return;}

  var comun={
    factura:fac,
    proveedor:document.getElementById('ent-proveedor').value,
    oc:document.getElementById('ent-oc').value,
    fVenc:document.getElementById('ent-fvenc').value,
    dynamics:document.getElementById('ent-dynamics').value,
    responsable:document.getElementById('ent-responsable').value
  };

  err.textContent='';
  var btn=document.getElementById('btn-ent-save');
  btn.disabled=true;btn.textContent='Guardando...';

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Guardar entrada';
      if(!r.ok){err.textContent=r.error;return;}
      showToast('Entrada registrada ('+filas.length+' SKU'+(filas.length>1?'s':'')+')','ok');
      closeFS('fs-entrada');
      reloadPage('entradas');
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Guardar entrada';err.textContent=e.message;})
    .registrarEntradasMultiple(S.token, filas, comun);
}

function guardarEntradaArchivo(){
  var fac=document.getElementById('ent-factura').value.trim();
  var err=document.getElementById('arch-err');
  if(!fac){err.textContent='La factura/referencia es obligatoria';return;}
  var seleccionados=ARCH_ROWS.filter(function(r){return r.incluir;});
  if(!seleccionados.length){err.textContent='Selecciona al menos un producto';return;}

  var filas=seleccionados.map(function(r){return{sku:r.sku,desc:r.desc,unidades:r.cant};});
  var comun={
    factura:fac,
    proveedor:document.getElementById('ent-proveedor').value,
    oc:document.getElementById('ent-oc').value,
    fVenc:document.getElementById('ent-fvenc').value,
    dynamics:document.getElementById('ent-dynamics').value,
    responsable:document.getElementById('ent-responsable').value
  };

  err.textContent='';
  var btn=document.getElementById('btn-ent-save');
  btn.disabled=true;btn.textContent='Importando...';

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Importar desde archivo';
      if(!r.ok){err.textContent=r.error;return;}
      showToast('Importados '+filas.length+' SKU'+(filas.length>1?'s':'')+' correctamente','ok');
      clearFile();
      closeFS('fs-entrada');
      reloadPage('entradas');
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Importar desde archivo';err.textContent=e.message;})
    .registrarEntradasMultiple(S.token, filas, comun);
}

/* ══════════════════════════════════════
   M-T
══════════════════════════════════════ */
function loadMT(){
  if(!S||!S.token){errBox('mt-root','Sin sesión activa. Recarga la página.','mt');PAGE_LOADING['mt']=false;return;}
  var force=!!_FORCE_REFRESH['mt']; _FORCE_REFRESH['mt']=false;
  var t = (REQ_TOKEN.mt = (REQ_TOKEN.mt||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.mt) return;
      PAGE_LOADING['mt']=false; renderMT(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.mt) return;
      PAGE_LOADING['mt']=false; errBox('mt-root',e.message,'mt');
    })
    .getMT(S.token, force, window.mt_rango||null);
}

/* ── M-T: tipos normalizados, KPI globales del período y filas agrupadas por día ── */
var _MT_TIPO='', _MT_EST='';
function _mtTipo(r){
  var u=String(r.tipo||'').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(u==='MERMA') return 'MERMA';
  if(u==='TRASLADO') return 'TRASLADO';
  if(u==='NC'||u.indexOf('NOTA DE CRED')===0) return 'NC';
  return 'OTROS';
}
function _mtPend(r){ return String(r.estado||'').trim().toLowerCase()!=='retirado'; }
function _mtMoney(n){ return 'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _mtSum(a,k){ return a.reduce(function(s,x){return s+(Number(x[k])||0);},0); }
function _mtFechaKey(f){ var p=String(f||'').split('/'); return p.length===3?p[2]+p[1]+p[0]:''; }
function _mtBase(){ return _applyFiltroFecha('mt', DATA.mt||[]); }

function _mtFiltrados(){
  var q=((document.getElementById('mt-busq')||{}).value||'').toLowerCase().trim();
  var rows=_mtBase().filter(function(r){
    if(_MT_TIPO && _mtTipo(r)!==_MT_TIPO) return false;
    if(_MT_EST){
      var t=_mtTipo(r); if(t!=='MERMA'&&t!=='NC') return false;
      if(_MT_EST==='pen'?!_mtPend(r):_mtPend(r)) return false;
    }
    return !q||[r.sku,r.desc,r.motivo,r.obs,r.nroFactura].some(function(v){return String(v||'').toLowerCase().indexOf(q)>-1;});
  });
  rows.sort(function(a,b){ var ka=_mtFechaKey(a.fecha), kb=_mtFechaKey(b.fecha); return ka===kb?b._row-a._row:(ka<kb?1:-1); });
  return rows;
}

function _mtBadgeTipo(t,raw){
  if(t==='MERMA') return '<span class="mt2-bd m">MERMA</span>';
  if(t==='TRASLADO') return '<span class="mt2-bd t">TRASLADO</span>';
  if(t==='NC') return '<span class="mt2-bd nc">NC</span>';
  return '<span class="mt2-bd n">'+esc(raw||'SIN TIPO')+'</span>';
}
function _mtBadgeEstado(r,t){
  if(t!=='MERMA'&&t!=='NC') return '<span class="mt2-bd n">—</span>';
  return _mtPend(r)?'<span class="mt2-bd w">Pendiente</span>':'<span class="mt2-bd ok">Retirado</span>';
}

function _mtDiaLabel(f){
  var p=String(f||'').split('/'); if(p.length!==3) return f||'Sin fecha';
  var d=new Date(+p[2],+p[1]-1,+p[0]), h=new Date(); h.setHours(0,0,0,0);
  var dif=Math.round((h-d)/86400000);
  var pre=dif===0?'Hoy':dif===1?'Ayer':d.toLocaleDateString('es-PE',{weekday:'long'});
  return pre.charAt(0).toUpperCase()+pre.slice(1)+' · '+f;
}

function _mtMoneyCard(titulo,arr){
  var pen=arr.filter(_mtPend), ret=arr.filter(function(r){return !_mtPend(r);});
  var tot=_mtSum(arr,'costo'), cp=_mtSum(pen,'costo'), pp=tot>0?Math.round(cp/tot*100):0;
  return '<div class="sal2-card mt2-money"><div class="mt2-mh"><div><div class="sal2-k">'+titulo+'</div><div class="sal2-v">'+_mtMoney(tot)+'</div></div>'+
      '<span class="mt2-meta">'+arr.length+(arr.length===1?' registro':' registros')+' · '+fmt(_mtSum(arr,'cant'))+' und.</span></div>'+
    '<div class="mt2-bar">'+(tot>0?'<i style="width:'+pp+'%;background:var(--warn)"></i><i style="width:'+(100-pp)+'%;background:var(--ok)"></i>':'')+'</div>'+
    '<div class="mt2-lg"><div><span><em style="background:var(--warn)"></em>Pendiente</span><b>'+_mtMoney(cp)+'<small>'+fmt(_mtSum(pen,'cant'))+' und.</small></b></div>'+
      '<div><span><em style="background:var(--ok)"></em>Retirado</span><b>'+_mtMoney(_mtSum(ret,'costo'))+'<small>'+fmt(_mtSum(ret,'cant'))+' und.</small></b></div></div></div>';
}
function _mtNcCard(nc){
  var pen=nc.filter(_mtPend);
  return '<div class="sal2-card mt2-money"><div class="sal2-k"><em class="mt2-dot"></em>Notas de crédito pendientes</div><div class="sal2-v">'+_mtMoney(_mtSum(pen,'costo'))+'</div>'+
    '<div class="mt2-lg" style="margin-top:14px"><div><span>Pendientes</span><b>'+pen.length+'<small>NC</small></b></div><div><span>Unidades</span><b>'+fmt(_mtSum(pen,'cant'))+'<small>und.</small></b></div></div>'+
    '<div class="sal2-n" style="color:var(--text4)">Las NC retiradas no suman al costo</div></div>';
}

function renderMT(r){
  if(_handleExpired(r,'mt-root')) return;
  if(!r||!r.ok){errBox('mt-root',r?r.error:'Error desconocido','mt');return;}
  DATA.mt=r.data;
  _MT_TIPO=''; _MT_EST='';
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  document.getElementById('mt-root').innerHTML=
    '<div class="mt2-note">'+ICO('info',13)+'Resumen del período · no cambia con el filtro de tipo ni la búsqueda</div>'+
    '<div class="sal2-sum mt2-sum" id="mt-kpis"></div>'+
    '<div class="sal2-fl">'+
      '<div class="sal2-srch">'+icoBuscar+'<input id="mt-busq" placeholder="Buscar SKU, producto o motivo…" oninput="filterMT()"/></div>'+
      _fechaFiltroHTML('mt','filterMT','mtRangoCambio')+
      '<div class="sal2-seg" id="mt-tipo-seg"></div>'+
      '<div class="sal2-seg" id="mt-est-seg"></div>'+
      '<span class="sal2-cnt" id="mt-count"></span>'+
    '</div>'+
    '<div class="mt2-tw" id="mt-list"></div>';
  _initFiltroFecha('mt','filterMT',{page:'mt'});
  filterMT();
}
function mtSetTipo(k){ _MT_TIPO=(_MT_TIPO===k?'':k); _filterMT(); }
function mtSetEst(k){ _MT_EST=(_MT_EST===k?'':k); _filterMT(); }

function _filterMT(){
  var base=_mtBase();
  var mer=base.filter(function(r){return _mtTipo(r)==='MERMA';});
  var tra=base.filter(function(r){return _mtTipo(r)==='TRASLADO';});
  var nc =base.filter(function(r){return _mtTipo(r)==='NC';});
  var oth=base.filter(function(r){return _mtTipo(r)==='OTROS';});

  var el=document.getElementById('mt-kpis');
  if(el) el.innerHTML=_mtMoneyCard('Costo de merma',mer)+_mtNcCard(nc)+
    '<div class="sal2-card"><div class="sal2-k">Traslados</div><div class="sal2-v">'+fmt(_mtSum(tra,'cant'))+'<small>und.</small></div><div class="sal2-n">'+tra.length+(tra.length===1?' movimiento':' movimientos')+'</div></div>'+
    '<div class="sal2-card"><div class="sal2-k">Registros</div><div class="sal2-v">'+base.length+'<small>mov.</small></div><div class="sal2-n">'+mer.length+' mermas · '+nc.length+' NC · '+tra.length+' trasl.'+(oth.length?' · '+oth.length+' otros':'')+'</div></div>';

  var sg=function(k,txt,n){return '<button class="'+(_MT_TIPO===k?'on':'')+'" onclick="mtSetTipo(\''+k+'\')">'+txt+'<span>'+n+'</span></button>';};
  var sgt=document.getElementById('mt-tipo-seg');
  if(sgt) sgt.innerHTML='<button class="'+(_MT_TIPO===''?'on':'')+'" onclick="mtSetTipo(\'\')">Todos<span>'+base.length+'</span></button>'+
    sg('MERMA','Mermas',mer.length)+sg('TRASLADO','Traslados',tra.length)+sg('NC','NC',nc.length)+((oth.length||_MT_TIPO==='OTROS')?sg('OTROS','Otros',oth.length):'');
  var se=document.getElementById('mt-est-seg');
  if(se) se.innerHTML='<button class="'+(_MT_EST===''?'on':'')+'" onclick="mtSetEst(\'\')">Cualquier estado</button>'+
    '<button class="'+(_MT_EST==='pen'?'on':'')+'" onclick="mtSetEst(\'pen\')">Pendiente</button>'+
    '<button class="'+(_MT_EST==='ret'?'on':'')+'" onclick="mtSetEst(\'ret\')">Retirado</button>';

  var rows=_mtFiltrados();
  var cnt=document.getElementById('mt-count'); if(cnt) cnt.textContent=rows.length+' registros';

  window._MT_ROWS={};
  var html='', grupo=null, gAcum=[];
  var cierra=function(){ if(grupo!==null) html=html.replace('<!--g'+grupo+'-->','<em>'+gAcum.length+' mov. · '+fmt(_mtSum(gAcum,'cant'))+' und.</em>'); };
  rows.forEach(function(r){
    window._MT_ROWS[r._row]=r;
    var t=_mtTipo(r), k=r.fecha||'';
    if(k!==grupo){ cierra(); grupo=k; gAcum=[]; html+='<div class="mt2-grp">'+esc(_mtDiaLabel(k))+'<!--g'+k+'--></div>'; }
    gAcum.push(r);
    var sc=t==='MERMA'?'var(--danger)':t==='NC'?'#5CC8E0':t==='TRASLADO'?'var(--accent)':'var(--text4)';
    html+='<div class="mt2-tr mt2-row" style="--sc:'+sc+'">'+
      '<div class="mt2-p"><b title="'+esc(r.desc)+'">'+esc(r.desc)+'</b><span>'+esc(r.sku)+'</span></div>'+
      '<div class="mt2-t">'+_mtBadgeTipo(t,r.tipo)+'</div>'+
      '<div class="mt2-q">'+fmt(r.cant)+'<small> und.</small></div>'+
      '<div class="mt2-c">'+(r.costo?_mtMoney(r.costo):'—')+'</div>'+
      '<div class="mt2-m"><b>'+esc(r.motivo||'—')+'</b>'+(r.obs?'<span>'+esc(r.obs)+'</span>':'')+'</div>'+
      '<div class="mt2-e">'+_mtBadgeEstado(r,t)+'</div>'+
      '<div class="mt2-f'+((r.nroFactura||r.fechaRetiro)?'':' mt2-vacio')+'"><b>'+esc(r.nroFactura||'—')+'</b>'+(r.fechaRetiro?'<span>Retiro '+esc(r.fechaRetiro)+'</span>':'')+'</div>'+
      '<div class="mt2-a"><button class="mt2-ib" title="Editar" onclick="editarMTRow('+r._row+')">'+ICO('edit',14,'s')+'</button>'+
        '<button class="mt2-ib d" title="Eliminar" onclick="eliminarMTRow('+r._row+')">'+ICO('trash',14,'s')+'</button></div>'+
    '</div>';
  });
  cierra();
  var lst=document.getElementById('mt-list');
  if(lst) lst.innerHTML=rows.length?
    '<div class="mt2-tr mt2-h"><div>Producto</div><div class="c">Tipo</div><div class="r">Cant.</div><div class="r">Costo</div><div>Motivo</div><div class="c">Estado</div><div>Factura / NC</div><div></div></div>'+html
    :'<div class="mt2-vacio-t">Sin registros</div>';
}

function exportMT(){
  if(S&&S.rol!=='store'){
    var HDR=['Fecha','SKU','Descripción','Cantidad','Costo','Tipo','Motivo','Observaciones','Estado','Nro de factura','Fecha del retiro'];
    var CW=[{wch:12},{wch:14},{wch:36},{wch:10},{wch:12},{wch:10},{wch:20},{wch:24},{wch:12},{wch:16},{wch:14}];
    _exportConSpinner('btn-export-mt','mt',function(sedes){
      _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:HDR,rows:s.data,colWidths:CW,
        mapFn:function(r){return[r.fecha,r.sku,r.desc,r.cant,r.costo||0,r.tipo,r.motivo||'',r.obs||'',r.estado||'',r.nroFactura||'',r.fechaRetiro||''];}};}),'mt_sedes');
    });return;
  }
  var rows=_getFilteredRows('mt');
  _exportXLSX(['Fecha','SKU','Descripción','Cantidad','Costo','Tipo','Motivo','Observaciones','Estado','Nro de factura','Fecha del retiro'],
    rows,function(r){return[r.fecha,r.sku,r.desc,r.cant,r.costo||0,r.tipo,r.motivo||'',r.obs||'',r.estado||'',r.nroFactura||'',r.fechaRetiro||''];},'M-T','mermas_traslados');
}

function abrirNuevoMT(){
  document.getElementById('mt-row').value='';
  document.getElementById('mt-tipo').value='';
  document.getElementById('mt-sku').value='';
  document.getElementById('mt-desc').value='';
  document.getElementById('mt-cant').value='';
  document.getElementById('mt-motivo').value='';
  document.getElementById('mt-obs').value='';
  document.getElementById('mt-nro-factura').value='';
  document.getElementById('mt-fecha-retiro').value='';
  document.getElementById('mt-err').textContent='';
  document.getElementById('fs-mt-title').textContent='Registrar M-T';
  var btn=document.getElementById('btn-mt-save');
  if(btn) btn.textContent='Guardar movimiento';
  openFS('fs-mt');
}

function guardarMT(){
  var rowNum = document.getElementById('mt-row').value;
  var tipo   = document.getElementById('mt-tipo').value;
  var sku    = document.getElementById('mt-sku').value.trim();
  var cant   = document.getElementById('mt-cant').value;
  var err    = document.getElementById('mt-err');
  if(!tipo||!sku||!cant){err.textContent='Tipo, SKU y Cantidad son obligatorios';return;}
  var fila   = {tipo:tipo,sku:sku,desc:document.getElementById('mt-desc').value,
    cant:Number(cant),motivo:document.getElementById('mt-motivo').value,
    obs:document.getElementById('mt-obs').value,
    nroFactura:document.getElementById('mt-nro-factura').value.trim(),
    fechaRetiro:document.getElementById('mt-fecha-retiro').value};
  err.textContent='';
  var btn = document.getElementById('btn-mt-save');
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
  var onOk = function(r){
    if(btn){ btn.disabled=false; btn.textContent=rowNum?'Guardar cambios':'Guardar movimiento'; }
    onSaved(r,'fs-mt','mt',null,'');
    // reset form a modo nuevo
    document.getElementById('mt-row').value='';
    document.getElementById('fs-mt-title').textContent='Registrar M-T';
    if(btn) btn.textContent='Guardar movimiento';
  };
  var onErr = function(e){
    if(btn){ btn.disabled=false; btn.textContent=rowNum?'Guardar cambios':'Guardar movimiento'; }
    err.textContent=e.message;
  };
  if(rowNum){
    google.script.run.withSuccessHandler(onOk).withFailureHandler(onErr).editarMT(S.token,Number(rowNum),fila);
  } else {
    google.script.run.withSuccessHandler(onOk).withFailureHandler(onErr).registrarMT(S.token,fila);
  }
}

function editarMTRow(rowNum){
  var r=(window._MT_ROWS||{})[rowNum];
  if(!r){showToast('Error: no se encontró el registro','err');return;}
  document.getElementById('mt-row').value   = rowNum;
  document.getElementById('mt-tipo').value  = r.tipo||'';
  document.getElementById('mt-sku').value   = r.sku||'';
  document.getElementById('mt-desc').value  = r.desc||'';
  document.getElementById('mt-cant').value  = r.cant||0;
  document.getElementById('mt-motivo').value= r.motivo||'';
  document.getElementById('mt-obs').value   = r.obs||'';
  document.getElementById('mt-nro-factura').value = r.nroFactura||'';
  var frVal='';
  if(r.fechaRetiro){var parts=r.fechaRetiro.split('/');if(parts.length===3) frVal=parts[2]+'-'+parts[1]+'-'+parts[0];}
  document.getElementById('mt-fecha-retiro').value=frVal;
  document.getElementById('mt-err').textContent='';
  document.getElementById('fs-mt-title').textContent='Editar M-T';
  var btn=document.getElementById('btn-mt-save');
  if(btn) btn.textContent='Guardar cambios';
  openFS('fs-mt');
}

function eliminarMTRow(rowNum){
  _confirmDialog('Eliminar registro','Se eliminará este movimiento. Esta acción no se puede deshacer.',function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!r.ok){showToast(r.error,'err');return;}
        showToast('Eliminado','ok');
        reloadPage('mt');
      })
      .withFailureHandler(function(e){showToast(e.message,'err');})
      .eliminarMT(S.token,rowNum);
  },'Eliminar');
}

/* ── HELPER FILTRADO COMPARTIDO — usado por _filterXxx y exportXxx ──
   Evita duplicar la misma lógica de filtro en cada función de exportación. */
function _getFilteredRows(name) {
  if (name === 'stock') {
    var q   = ((document.getElementById('stock-busq')||{}).value||'').toLowerCase();
    var cat = ((document.getElementById('stock-cat') ||{}).value||'');
    var mar = ((document.getElementById('stock-mar') ||{}).value||'');
    return DATA.stock.filter(function(r) {
      return (!q  || r.sku.toLowerCase().indexOf(q)>-1 || r.desc.toLowerCase().indexOf(q)>-1) &&
             (!cat || r.categoria===cat) && (!mar || r.marca===mar);
    });
  }
  if (name === 'salidas') {
    var base = _salBase();
    return _SAL_EST ? base.filter(function(r){return _salEstadoLinea(r)===_SAL_EST;}) : base;
  }
  if (name === 'entradas') {
    var q = ((document.getElementById('ent-busq')||{}).value||'').toLowerCase();
    var rows = DATA.entradas.filter(function(r){
      return !q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||r.factura.toLowerCase().indexOf(q)>-1;
    });
    return _applyFiltroFecha('ent', rows).sort(function(a,b){return b._row-a._row;});
  }
  if (name === 'mt') {
    return _mtFiltrados();
  }
  if (name === 'cancelados') {
    var q = ((document.getElementById('canc-busq')||{}).value||'').toLowerCase();
    var rows = (DATA.cancelados||[]).filter(function(r){
      return !q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||r.nroPedido.toLowerCase().indexOf(q)>-1;
    });
    return _applyFiltroFecha('canc', rows).sort(function(a,b){return b._row-a._row;});
  }
  if (name === 'conteo') {
    var q = ((document.getElementById('cnt-busq')||{}).value||'').toLowerCase();
    var rows = (DATA.conteo||[]).filter(function(r){
      return !q||r.sku.toLowerCase().indexOf(q)>-1||r.producto.toLowerCase().indexOf(q)>-1||r.ean.toLowerCase().indexOf(q)>-1;
    });
    return _applyFiltroFecha('cnt', rows);
  }
  return [];
}

/* ══════════════════════════════════════
   AUTOCOMPLETE + EAN
══════════════════════════════════════ */
var acTimers={}; // mapa por listId — evita que filas distintas cancelen sus timers entre sí
// Cache de resultados por listId — evita pasar JSON por onclick
// Máx 20 entradas para evitar crecimiento ilimitado en sesiones largas
var AC_CACHE={};
var _AC_CACHE_KEYS=[];
var _AC_CACHE_MAX=20;
function _acCacheSet(listId, results){
  if(!AC_CACHE[listId]) _AC_CACHE_KEYS.push(listId);
  AC_CACHE[listId]=results;
  if(_AC_CACHE_KEYS.length>_AC_CACHE_MAX){
    var oldest=_AC_CACHE_KEYS.shift();
    delete AC_CACHE[oldest];
  }
}

// acSearch — búsqueda de SKU con autocomplete reutilizable.
// onSelectFn (opcional): string con nombre de función JS para el onclick de cada ítem.
//   Si se omite, usa acSelect con los parámetros skuId/descId/marcaId/listId.
function acSearch(skuId,descId,marcaId,listId,onSelectFn){
  clearTimeout(acTimers[listId]);
  var q=document.getElementById(skuId).value.trim();
  if(q.length<2){document.getElementById(listId).classList.remove('open');return;}
  acTimers[listId]=setTimeout(function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!r.ok)return;
        var list=document.getElementById(listId);
        if(!r.results.length){list.classList.remove('open');return;}
        AC_CACHE[listId]=r.results; // mantener para acSelect con índice numérico
        _acCacheSet(listId, r.results);
        list.innerHTML=r.results.map(function(x,i){
          var clickHandler = onSelectFn
            ? onSelectFn+'('+i+')'
            : 'acSelect(\''+skuId+'\',\''+descId+'\','+(marcaId?'\''+marcaId+'\'':'null')+',\''+listId+'\','+i+')';
          return '<div class="ac-item" onclick="'+clickHandler+'">'+
            '<div class="ac-sku">'+esc(x.sku)+'</div>'+
            '<div class="ac-desc">'+esc(x.desc)+'</div>'+
          '</div>';
        }).join('');
        list.classList.add('open');
      })
      .withFailureHandler(function(){ document.getElementById(listId).classList.remove('open'); })
      .buscarSKU(S.token,q);
  },300);
}

function acSelect(skuId,descId,marcaId,listId,idx){
  var item=(AC_CACHE[listId]||[])[Number(idx)];
  if(!item)return;
  document.getElementById(skuId).value=item.sku;
  document.getElementById(skuId).dispatchEvent(new CustomEvent('acpick'));
  var descEl=document.getElementById(descId);
  if(descEl){
    var wasReadOnly=descEl.readOnly;
    descEl.readOnly=false;
    descEl.value=item.desc;
    descEl.readOnly=wasReadOnly;
  }
  if(marcaId&&document.getElementById(marcaId))document.getElementById(marcaId).value=item.marca||'';
  document.getElementById(listId).classList.remove('open');
}


function eanFill(eanId,skuId,descId,marcaId){
  var ean=document.getElementById(eanId).value.trim();
  if(!ean)return;
  // Resolver localmente si el catálogo ya está en memoria — evita llamada al servidor
  if(_MCONTEO_LOCAL && _MCONTEO_EAN_IDX){
    var normEan = /[eE]/.test(ean) ? Math.round(Number(ean)).toString() : ean.replace(/\.0+$/,'');
    var found = _MCONTEO_EAN_IDX[normEan];
    if(found){
      document.getElementById(skuId).value=found.sku;
      document.getElementById(descId).value=found.producto||'';
      if(marcaId&&document.getElementById(marcaId))document.getElementById(marcaId).value='';
      document.getElementById(eanId).value='';
      return;
    }
  }
  // Fallback al servidor si no hay catálogo local o no se encontró
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.ok){showToast('EAN no encontrado','err');return;}
      document.getElementById(skuId).value=r.sku;
      document.getElementById(descId).value=r.producto||r.desc||'';
      if(marcaId&&document.getElementById(marcaId))document.getElementById(marcaId).value=r.marca||'';
      document.getElementById(eanId).value='';
    })
    .withFailureHandler(function(e){showToast(e.message,'err');})
    .buscarEAN(S.token,ean);
}

/* ── FULL-SCREEN FORM HELPERS ── */
function openFS(id){
  var el=document.getElementById(id);
  el.style.display='flex';
  setTimeout(function(){el.classList.add('open');},10);
}
function closeFS(id){
  if(id==='fs-conteo') _cntCamDetener();
  var el=document.getElementById(id);
  el.classList.remove('open');
  setTimeout(function(){el.style.display='none';},200);
}

// onSaved: cierra el form y marca páginas relacionadas como stale.
// NO recarga inmediatamente desde la API — la recarga ocurre la próxima vez
// que el usuario navegue a esa sección o pulse "Actualizar".
// Excepción: si el caller ya actualizó DATA local (salidas, conteo),
// puede pasar localUpdate=true para saltar incluso el PAGE_LOADED=false.
function onSaved(r, fsId, page, btn, btnLabel, localUpdate){
  if(btn){btn.disabled=false;btn.textContent=btnLabel;}
  if(!r.ok){showToast(r.error,'err');return;}
  showToast('Guardado correctamente','ok');
  closeFS(fsId);
  if(!localUpdate){
    // Marcar la página como stale — se recargará al navegar a ella
    PAGE_LOADED[page]=false;
    // Marcar stock como stale también
    PAGE_LOADED['stock']=false;
  }
}

function clearForm(ids){
  ids.forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.value='';
  });
}

/* ══════════════════════════════════════
   CANCELADOS
══════════════════════════════════════ */
function skeletonCancelados(){
  var cols=[48,40,90,200,90,36,36]; // anchos aprox por columna
  var rows='';
  for(var i=0;i<8;i++){
    var w=80+Math.floor(Math.sin(i*1.7)*18); // variación sutil de ancho
    rows+='<div class="sk-table-row">'+
      cols.map(function(c,ci){
        var pct=ci===3?100:Math.min(100,Math.round(c*(0.7+Math.random()*0.5)));
        return '<div class="sk-block sk-shimmer" style="width:'+pct+'px;flex:'+(ci===3?'1':'0 0 '+c+'px')+'"></div>';
      }).join('')+
    '</div>';
  }
  return '<div class="sk-stats">'+
    ['','',''].map(function(){
      return '<div class="sk-stat-card">'+
        '<div class="sk-block sk-shimmer" style="width:70px;height:11px"></div>'+
        '<div class="sk-block sk-shimmer" style="width:50px;height:28px"></div>'+
      '</div>';
    }).join('')+
  '</div>'+
  '<div class="sk-filters">'+
    '<div class="sk-block sk-shimmer" style="width:240px;height:32px;border-radius:8px"></div>'+
    '<div class="sk-block sk-shimmer" style="width:110px;height:32px;border-radius:8px"></div>'+
    '<div class="sk-block sk-shimmer" style="width:110px;height:32px;border-radius:8px"></div>'+
  '</div>'+
  '<div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;padding:0 16px">'+rows+'</div>';
}

function loadCancelados(){
  if(!S||!S.token){errBox('cancelados-root','Sin sesión activa. Recarga la página.','cancelados');PAGE_LOADING['cancelados']=false;return;}
  document.getElementById('cancelados-root').innerHTML=skeletonCancelados();
  var force=!!_FORCE_REFRESH['cancelados']; _FORCE_REFRESH['cancelados']=false;
  var t = (REQ_TOKEN.cancelados = (REQ_TOKEN.cancelados||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.cancelados) return;
      PAGE_LOADING['cancelados']=false;
      if(r===null||r===undefined){
        // GAS retornó null — problema de serialización, reintentar una vez
        google.script.run
          .withSuccessHandler(function(r2){
            if(t !== REQ_TOKEN.cancelados) return;
            if(!r2){errBox('cancelados-root','Error del servidor al cargar cancelados. Recarga la página.','cancelados');return;}
            renderCancelados(r2);
          })
          .withFailureHandler(function(e2){
            if(t !== REQ_TOKEN.cancelados) return;
            errBox('cancelados-root',e2.message,'cancelados');
          })
          .getCancelados(S.token, true, window.canc_rango||null);
        return;
      }
      renderCancelados(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.cancelados) return;
      PAGE_LOADING['cancelados']=false;errBox('cancelados-root',e.message,'cancelados');
    })
    .getCancelados(S.token, force, window.canc_rango||null);
}

function renderCancelados(r){
  if(_handleExpired(r,'cancelados-root')) return;
  if(!r||!r.ok){errBox('cancelados-root',r&&r.error?r.error:'Error al cargar cancelados — revisa la hoja "PD CANCELADOS" en el spreadsheet','cancelados');return;}
  DATA.cancelados=r.data;
  var total=r.data.reduce(function(a,x){return a+(Number(x.unidad)||0);},0);
  var pedidos=[...new Set(r.data.map(function(x){return x.nroPedido;}).filter(Boolean))].length;
  // Aviso si se están mostrando solo los últimos N registros
  var avisoTotal = r.total && r.total > r.data.length
    ? '<div style="background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:var(--r);padding:8px 14px;font-size:12px;color:var(--warn);margin-bottom:16px;font-family:var(--font-mono)">'+
        ICO('warn',13)+'Mostrando los últimos '+r.data.length+' de '+r.total+' registros totales. Usa el filtro de fecha para buscar registros anteriores.'+
      '</div>'
    : '';
  document.getElementById('cancelados-root').innerHTML=
    avisoTotal+
    '<div class="stats">'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div><div class="stat-label">Total ítems</div><div class="stat-val-row"><div class="stat-val" id="canc-stat-items">'+r.data.length+'</div><span class="stat-unit-pill">ítems</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-label">Pedidos únicos</div><div class="stat-val-row"><div class="stat-val" id="canc-stat-pedidos" style="color:var(--warn)">'+pedidos+'</div><span class="stat-unit-pill">pedidos</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><line x1="3.27" y1="6.96" x2="12" y2="12.01"/><line x1="20.73" y1="6.96" x2="12" y2="12.01"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-label">Unidades canceladas</div><div class="stat-val-row"><div class="stat-val" id="canc-stat-und" style="color:var(--danger)">'+fmt(total)+'</div><span class="stat-unit-pill">und.</span></div></div>'+
    '</div>'+
    '<div class="filters" style="flex-wrap:wrap;gap:8px;align-items:center">'+
      '<input class="filter-inp" id="canc-busq" placeholder="Buscar SKU, pedido, descripción..." style="width:240px" oninput="filterCancelados()"/>'+
      _fechaFiltroHTML('canc','filterCancelados','cancRangoCambio')+
      '<span class="result-count" id="canc-count"></span>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr>'+
        '<th>Fecha</th><th>Hora</th><th>SKU</th><th>Nro. Pedido</th><th>Descripción</th>'+
        '<th class="r">Pack</th><th class="r">Und.</th><th>Marca</th>'+
        '<th class="c">Motor.</th><th class="r">Envases</th>'+
        '<th class="c">Estado</th><th class="c">Revisión</th><th>Motivo</th>'+
        (S&&S.rol==='store'?'<th class="c"></th>':'')+
      '</tr></thead>'+
      '<tbody id="cancelados-tbody"></tbody>'+
    '</table></div>';
  _initFiltroFecha('canc','filterCancelados',{page:'cancelados'});
  filterCancelados();
}

function _filterCancelados(){
  var q=((document.getElementById('canc-busq')||{}).value||'').toLowerCase();
  var rows=(DATA.cancelados||[]).filter(function(r){
    return !q||
      (r.sku||'').toLowerCase().indexOf(q)>-1||
      (r.desc||'').toLowerCase().indexOf(q)>-1||
      (r.nroPedido||'').toLowerCase().indexOf(q)>-1||
      (r.marca||'').toLowerCase().indexOf(q)>-1;
  });
  rows=_applyFiltroFecha('canc',rows);
  rows.sort(function(a,b){return b._row-a._row;});
  var totalUnd=rows.reduce(function(a,x){return a+(Number(x.unidad)||0);},0);
  var pedUnicos=new Set(rows.map(function(x){return x.nroPedido;}).filter(Boolean)).size;
  var si=document.getElementById('canc-stat-items');   if(si)si.textContent=rows.length;
  var sp=document.getElementById('canc-stat-pedidos'); if(sp)sp.textContent=pedUnicos;
  var su=document.getElementById('canc-stat-und');     if(su)su.textContent=fmt(totalUnd);
  var el=document.getElementById('canc-count');
  if(el)el.textContent=rows.length+' registros';
  var tbody=rows.map(function(r){
    return '<tr>'+
      '<td class="mono" style="font-size:12px">'+esc(r.fecha)+'</td>'+
      '<td class="mono" style="font-size:12px;color:var(--text3)">'+esc(r.hora)+'</td>'+
      '<td class="mono">'+esc(r.sku)+'</td>'+
      '<td class="mono pedido-link" style="font-size:11.5px;color:var(--danger)">'+esc(r.nroPedido||'—')+'</td>'+
      '<td class="td-desc" title="'+esc(r.desc)+'">'+esc(r.desc)+'</td>'+
      '<td class="r">'+fmt(r.pack)+'</td>'+
      '<td class="r" style="font-weight:700;color:var(--danger)">'+fmt(r.unidad)+'</td>'+
      '<td style="font-size:12px">'+(r.marca?'<span class="brand-pill">'+esc(r.marca)+'</span>':'<span style="color:var(--text4)">—</span>')+'</td>'+
      '<td class="c" style="font-size:12px;color:var(--text3)">'+esc(r.motorizado||'—')+'</td>'+
      '<td class="r" style="font-size:12px">'+esc(r.envases||'—')+'</td>'+
      '<td class="c"><span style="background:var(--danger-bg);color:var(--danger);font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600">'+esc(r.estado||'Cancelado')+'</span></td>'+
      '<td class="c" style="font-size:12px;color:var(--text3)">'+esc(r.revision||'—')+'</td>'+
      '<td style="font-size:12px" title="'+esc(r.motivo)+'">'+esc(r.motivo||'—')+'</td>'+
      (S&&S.rol==='store'&&r.nroPedido?'<td class="c" style="white-space:nowrap"><button class="btn btn-ghost btn-sm" title="Devolver este pedido a Salidas" data-nro="'+esc(r.nroPedido)+'" onclick="anularCancAbrir(this.dataset.nro)">'+ICO('undo',12)+'Anular</button></td>':(S&&S.rol==='store'?'<td></td>':''))+
    '</tr>';
  }).join('');
  var t=document.getElementById('cancelados-tbody');
  if(t)t.innerHTML=tbody||'<tr><td colspan="14" style="text-align:center;color:var(--text3);padding:40px">Sin cancelados</td></tr>';
}

/* ── Anular una cancelación (el pedido vuelve a Salidas) ── */
var _ANUL_NRO=null;
function anularCancAbrir(nro){
  var filas=(DATA.cancelados||[]).filter(function(r){return r.nroPedido===nro;});
  if(!filas.length){showToast('Recarga la página — los datos están desactualizados.','err');return;}
  _ANUL_NRO=nro;
  var und=filas.reduce(function(a,x){return a+(Number(x.unidad)||0);},0);
  document.getElementById('modal-anular-canc-info').innerHTML=
    'El pedido <b class="mono">'+esc(nro)+'</b> ('+filas.length+' producto'+(filas.length===1?'':'s')+', '+fmt(und)+' und.) volverá a <b>Salidas</b> con su fecha y hora originales, y dejará de estar cancelado. '+
    (filas[0].motivo?'Motivo con que se canceló: <i>'+esc(filas[0].motivo)+'</i>.':'');
  document.getElementById('modal-anular-canc-preview').innerHTML=
    '<table style="width:100%"><tbody>'+filas.map(function(x){
      return '<tr><td class="mono" style="padding:6px 10px">'+esc(x.sku)+'</td><td style="padding:6px 10px">'+esc(x.desc)+'</td><td class="r" style="padding:6px 10px">'+fmt(x.unidad)+' und.</td></tr>';
    }).join('')+'</tbody></table>';
  document.getElementById('modal-anular-canc-err').textContent='';
  var b=document.getElementById('btn-anular-canc'); b.disabled=false; b.textContent='Devolver a Salidas';
  document.getElementById('modal-anular-canc').style.display='flex';
}
function anularCancCerrar(){ document.getElementById('modal-anular-canc').style.display='none'; _ANUL_NRO=null; }
function anularCancConfirmar(){
  var nro=_ANUL_NRO; if(!nro) return;
  var b=document.getElementById('btn-anular-canc'), err=document.getElementById('modal-anular-canc-err');
  b.disabled=true; b.textContent='Restaurando...'; err.textContent='';
  google.script.run
    .withSuccessHandler(function(r){
      if(!r||!r.ok){b.disabled=false;b.textContent='Devolver a Salidas';err.textContent=(r&&r.error)||'No se pudo anular la cancelación';return;}
      anularCancCerrar();
      showToast('Pedido '+nro+' devuelto a Salidas ('+r.filas+' producto'+(r.filas===1?'':'s')+')','ok');
      PAGE_LOADED['salidas']=false; PAGE_LOADED['stock']=false;
      reloadPage('cancelados');
    })
    .withFailureHandler(function(e){b.disabled=false;b.textContent='Devolver a Salidas';err.textContent=e.message;})
    .anularCancelado(S.token,nro);
}

function exportCancelados(){
  var rows = _getFilteredRows('cancelados');
  _exportXLSX(
    ['Fecha','Hora','SKU','Nro. Pedido','Descripción','Pack','Und.','Marca','Motorizado','Envases','Estado','Revisión','Motivo'],
    rows,
    function(r){return[r.fecha,r.hora,r.sku,r.nroPedido,r.desc,r.pack,r.unidad,r.marca||'',r.motorizado||'',r.envases||'',r.estado||'',r.revision||'',r.motivo||''];},
    'Cancelados','cancelados'
  );
}

/* ══════════════════════════════════════
   MAESTRO — descripción del pedido -> SKU y unidades por pack
   (si un producto no está aquí, la salida entra como "SIN SKU")
══════════════════════════════════════ */
var MAESTRO={data:[],prod:{},lista:[],sinSku:[],vista:[]};
var _MAE_EDIT=null;   // descripción original de la fila que se edita (null = nueva)
var _MAE_AP=null;     // estado del diálogo "Actualizar salidas"

function loadMaestro(){
  if(!S||!S.token){errBox('maestro-root','Sin sesión activa. Recarga la página.','maestro');PAGE_LOADING['maestro']=false;return;}
  var t=(REQ_TOKEN.maestro=(REQ_TOKEN.maestro||0)+1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t!==REQ_TOKEN.maestro) return;
      PAGE_LOADING['maestro']=false;
      renderMaestro(r);
    })
    .withFailureHandler(function(e){
      if(t!==REQ_TOKEN.maestro) return;
      PAGE_LOADING['maestro']=false;errBox('maestro-root',e.message,'maestro');
    })
    .getMaestroMBEES(S.token);
}

function renderMaestro(r){
  if(_handleExpired(r,'maestro-root')) return;
  if(!r||!r.ok){errBox('maestro-root',r&&r.error?r.error:'Error al cargar el maestro','maestro');return;}
  MAESTRO.data=r.data;
  DATA.maestro=r.data;
  MAESTRO.prod={};
  (r.productos||[]).forEach(function(p){ MAESTRO.prod[p.sku]=p.desc; });
  MAESTRO.lista=(r.productos||[]).map(function(p){ return {sku:p.sku,desc:p.desc,n:_maeNorm(p.sku+' '+p.desc)}; });
  MAESTRO.sinSku=(r.sinSku||[]).sort(function(a,b){return b.filas-a.filas;});

  var enMaestro={};
  MAESTRO.data.forEach(function(m){ enMaestro[m.descripcion]=true; });
  var filasSin=MAESTRO.sinSku.reduce(function(a,x){return a+x.filas;},0);
  var fueraStock=MAESTRO.data.filter(function(m){return m.sku && !MAESTRO.prod[m.sku];}).length;
  var ico='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  var panel='';
  if(MAESTRO.sinSku.length){
    panel='<div style="background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:var(--r);padding:12px 14px;margin-bottom:16px">'+
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">'+
        '<div style="font-size:13px;font-weight:700;color:var(--warn)">'+ICO('warn',14)+filasSin+' salida'+(filasSin===1?'':'s')+' SIN SKU ('+MAESTRO.sinSku.length+' producto'+(MAESTRO.sinSku.length===1?'':'s')+' distinto'+(MAESTRO.sinSku.length===1?'':'s')+')</div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:6px">'+
      MAESTRO.sinSku.map(function(x,i){
        var ya=enMaestro[x.descripcion];
        return '<div style="display:flex;align-items:center;gap:10px;font-size:12.5px">'+
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(x.descripcion)+'">'+esc(x.descripcion)+'</span>'+
          '<span class="mono" style="color:var(--text3)">'+x.filas+' fila'+(x.filas===1?'':'s')+' · '+fmt(x.packs)+' pack</span>'+
          (ya
            ? '<button class="btn btn-ghost btn-sm" onclick="maestroAplicarSinSku('+i+')">Ya está en el maestro: aplicar</button>'
            : '<button class="btn btn-primary btn-sm" onclick="maestroAsignar('+i+')">Asignar SKU</button>')+
        '</div>';
      }).join('')+
      '</div>'+
    '</div>';
  }

  document.getElementById('maestro-root').innerHTML=
    panel+
    '<div class="stats">'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">Productos en el maestro</div><div class="stat-val-row"><div class="stat-val" id="mae-stat-total">'+MAESTRO.data.length+'</div><span class="stat-unit-pill">filas</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">Salidas SIN SKU</div><div class="stat-val-row"><div class="stat-val" style="color:'+(filasSin?'var(--warn)':'var(--ok,inherit)')+'">'+filasSin+'</div><span class="stat-unit-pill">filas</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">SKU que no están en Stock</div><div class="stat-val-row"><div class="stat-val" style="color:'+(fueraStock?'var(--warn)':'inherit')+'">'+fueraStock+'</div><span class="stat-unit-pill">filas</span></div></div>'+
    '</div>'+
    '<div class="filters" style="flex-wrap:wrap;gap:8px;align-items:center">'+
      '<input class="filter-inp" id="mae-busq" placeholder="Buscar descripción o SKU..." style="width:280px" oninput="filterMaestro()"/>'+
      '<span class="result-count" id="mae-count"></span>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr><th>Descripción del pedido</th><th>SKU</th><th>Producto del SKU (Stock)</th><th class="r">Und. por pack</th><th class="c">Acciones</th></tr></thead>'+
      '<tbody id="maestro-tbody"></tbody>'+
    '</table></div>';
  filterMaestro();
}

function filterMaestro(){
  var q=((document.getElementById('mae-busq')||{}).value||'').toLowerCase().trim();
  var rows=MAESTRO.data.filter(function(m){
    return !q||m.descripcion.toLowerCase().indexOf(q)>-1||m.sku.toLowerCase().indexOf(q)>-1;
  });
  var MAX=500, total=rows.length;
  if(rows.length>MAX) rows=rows.slice(0,MAX);
  MAESTRO.vista=rows;
  var el=document.getElementById('mae-count');
  if(el) el.textContent=total>MAX ? ('Mostrando '+MAX+' de '+total+' — usa el buscador') : (total+' registros');
  var html=rows.map(function(m,i){
    var nombre=MAESTRO.prod[m.sku];
    var celdaProd=nombre
      ? '<span title="'+esc(nombre)+'">'+esc(nombre)+'</span>'
      : '<span style="color:var(--warn)" title="Este SKU no existe en el Stock de la sede">'+ICO('warn',12)+'SKU no está en Stock</span>';
    return '<tr>'+
      '<td class="td-desc" title="'+esc(m.descripcion)+'">'+esc(m.descripcion)+'</td>'+
      '<td class="mono" style="font-weight:600">'+esc(m.sku||'—')+'</td>'+
      '<td class="td-desc" style="font-size:12px;color:var(--text3)">'+celdaProd+'</td>'+
      '<td class="r">'+fmt(m.factor)+'</td>'+
      '<td class="c" style="white-space:nowrap">'+
        '<button class="btn btn-ghost btn-sm" onclick="abrirMaestroForm('+i+')">Editar</button> '+
        '<button class="btn btn-ghost btn-sm" title="Revisar las salidas de este producto contra el maestro" onclick="maestroRevalidar('+i+')">Revalidar</button> '+
        '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="eliminarMaestro('+i+')">Eliminar</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  var t=document.getElementById('maestro-tbody');
  if(t) t.innerHTML=html||'<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:40px">Sin resultados</td></tr>';
}

/* idx = posición en la vista filtrada; null = nuevo; prefill = descripción sugerida para un nuevo */
function abrirMaestroForm(idx,prefill){
  var m=(idx===null||idx===undefined)?null:MAESTRO.vista[idx];
  _MAE_EDIT=m?m.descripcion:null;
  document.getElementById('fs-maestro-title').textContent=m?'Editar maestro':'Agregar al maestro';
  document.getElementById('mae-desc').value=m?m.descripcion:(prefill||'');
  document.getElementById('mae-sku').value=m?m.sku:'';
  document.getElementById('mae-factor').value=m?m.factor:1;
  document.getElementById('mae-err').textContent='';
  document.getElementById('mae-buscar').value='';
  document.getElementById('ac-mae').classList.remove('open');
  maestroSkuCambio();
  maestroSugerir(m?'':(prefill||''));
  openFS('fs-maestro');
  setTimeout(function(){document.getElementById(m?'mae-sku':(prefill?'mae-buscar':'mae-desc')).focus();},120);
}
function maestroAsignar(i){ abrirMaestroForm(null,MAESTRO.sinSku[i].descripcion); }

function _maeNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }

/* Búsqueda por lo que escribe el usuario: todas las palabras deben estar en el SKU o nombre */
function maestroBuscar(){
  var list=document.getElementById('ac-mae');
  var q=_maeNorm(document.getElementById('mae-buscar').value).split(/[^a-z0-9]+/).filter(Boolean);
  if(!q.length){list.classList.remove('open');return;}
  var res=MAESTRO.lista.filter(function(p){return q.every(function(t){return p.n.indexOf(t)>-1;});}).slice(0,30);
  if(!res.length){
    list.innerHTML='<div class="ac-item" style="color:var(--text3);cursor:default">Sin resultados en el Stock de la sede</div>';
  } else {
    list.innerHTML=res.map(function(p){
      return '<div class="ac-item" data-sku="'+esc(p.sku)+'" onclick="maestroElegir(this.dataset.sku)"><div class="ac-sku">'+esc(p.sku)+'</div><div class="ac-desc">'+esc(p.desc)+'</div></div>';
    }).join('');
  }
  list.classList.add('open');
}

/* Sugerencias automáticas: productos del Stock que comparten palabras con la descripción del pedido */
function maestroSugerir(desc){
  var box=document.getElementById('mae-sugs');
  var stop={und:1,con:1,sin:1,del:1,los:1,las:1,pack:1};
  var toks=_maeNorm(desc).split(/[^a-z0-9]+/).filter(function(t){return t.length>=2&&!stop[t];});
  toks=toks.filter(function(t,i){return toks.indexOf(t)===i;});
  if(!toks.length){box.innerHTML='';return;}
  var min=toks.length>=3?2:1;
  var res=MAESTRO.lista.map(function(p){
    var sc=0; toks.forEach(function(t){ if(p.n.indexOf(t)>-1) sc++; });
    return {p:p,sc:sc};
  }).filter(function(x){return x.sc>=min;}).sort(function(a,b){return b.sc-a.sc;}).slice(0,6);
  if(!res.length){box.innerHTML='<div style="font-size:12px;color:var(--text3)">No hay sugerencias: busca el producto arriba por nombre o SKU.</div>';return;}
  box.innerHTML='<div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Sugerencias del Stock (clic para elegir)</div>'+
    res.map(function(x){
      return '<div class="ac-item" style="border:1px solid var(--border);border-radius:8px;margin-bottom:4px" data-sku="'+esc(x.p.sku)+'" onclick="maestroElegir(this.dataset.sku)"><div class="ac-sku">'+esc(x.p.sku)+'</div><div class="ac-desc">'+esc(x.p.desc)+'</div></div>';
    }).join('');
}

function maestroElegir(sku){
  document.getElementById('mae-sku').value=sku;
  document.getElementById('ac-mae').classList.remove('open');
  document.getElementById('mae-buscar').value='';
  document.getElementById('mae-sugs').innerHTML='';
  maestroSkuCambio();
  document.getElementById('mae-factor').focus();
  document.getElementById('mae-factor').select();
}

function maestroSkuCambio(){
  var sku=(document.getElementById('mae-sku').value||'').trim();
  var el=document.getElementById('mae-sku-info');
  var fi=document.getElementById('mae-factor-info');
  var otros=MAESTRO.data.filter(function(m){return sku&&m.sku===sku;}).map(function(m){return m.factor;});
  otros=otros.filter(function(f,i){return otros.indexOf(f)===i;});
  fi.textContent=otros.length?('En el maestro, este SKU también se usa con: '+otros.join(', ')+' und. por pack'):'';
  if(!sku){el.innerHTML='';return;}
  var n=MAESTRO.prod[sku];
  el.innerHTML=n
    ? '<span style="color:var(--text3)">'+ICO('right',12)+''+esc(n)+'</span>'
    : '<span style="color:var(--warn)">'+ICO('warn',13)+'Este SKU no está en el Stock de la sede. Puedes guardarlo, pero la salida no aparecerá en Stock hasta crearlo con "Nuevo SKU".</span>';
}

function guardarMaestro(){
  var desc=(document.getElementById('mae-desc').value||'').trim();
  var sku =(document.getElementById('mae-sku').value ||'').trim();
  var fac =parseInt(document.getElementById('mae-factor').value,10);
  var err =document.getElementById('mae-err');
  if(!desc){err.textContent='La descripción es obligatoria';return;}
  if(!sku){err.textContent='El SKU es obligatorio';return;}
  if(!(fac>=1)){err.textContent='Las unidades por pack deben ser 1 o más';return;}
  err.textContent='';
  var btn=document.getElementById('btn-mae-save');
  btn.disabled=true;btn.textContent='Guardando...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Guardar';
      if(!r.ok){err.textContent=r.error;return;}
      closeFS('fs-maestro');
      showToast('Maestro actualizado','ok');
      loadMaestro();
      _maePreguntarAplicar(desc,{sku:sku,factor:fac});
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Guardar';err.textContent=e.message;})
    .guardarMBEES(S.token,{descripcionOriginal:_MAE_EDIT,descripcion:desc,sku:sku,factor:fac});
}

function eliminarMaestro(i){
  var m=MAESTRO.vista[i]; if(!m) return;
  _confirmDialog('Eliminar del maestro',
    '"'+m.descripcion+'" se quitará del maestro. Las salidas ya registradas no cambian; los próximos pedidos con esta descripción entrarán como SIN SKU.',
    function(){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){showToast(r.error||'No se pudo eliminar','err');return;}
          showToast('Eliminado del maestro','ok');
          loadMaestro();
        })
        .withFailureHandler(function(e){showToast(e.message,'err');})
        .eliminarMBEES(S.token,m.descripcion);
    },'Eliminar');
}

/* ── Actualizar salidas ya registradas con lo que dice el maestro ── */
function maestroAplicarSinSku(i){ _maePreguntarAplicar(MAESTRO.sinSku[i].descripcion,null,true); }
function maestroRevalidar(i){ var m=MAESTRO.vista[i]; if(m) _maePreguntarAplicar(m.descripcion,null,true); }

function _maeHoyISO(){
  var d=new Date(), p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  return p;
}
function _maeSumarDias(iso,n){
  var d=new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10);
}
/* Ventanas de fechas para revalidar salidas que ya tienen SKU pero no coinciden con el maestro */
var _MAE_VENTANAS=[
  {k:'hoy', etq:'Solo hoy',          dias:0,    c:'d_hoy'},
  {k:'7',   etq:'Últimos 7 días',    dias:6,    c:'d_7'},
  {k:'30',  etq:'Últimos 30 días',   dias:29,   c:'d_30'},
  {k:'todo',etq:'Todo el historial', dias:null, c:'d_todo'}
];
function _maeVentana(k){ return _MAE_VENTANAS.filter(function(x){return x.k===k;})[0]||null; }

/* forzar = abrir el diálogo aunque no haya nada pendiente (botón "Revalidar") */
function _maePreguntarAplicar(desc,valores,forzar){
  _MAE_AP={desc:desc,ventana:'ninguna',sin:0,w:{},m:valores||null};
  _maeContar(function(){
    var a=_MAE_AP;
    if(desc!==null && !forzar && !a.sin && !a.w.d_30) return; // nada relevante: no molestar
    // Preselección: la ventana más corta que cubra todo lo que no coincide en los últimos 30 días
    if(a.w.d_30>0){
      var v=_MAE_VENTANAS.filter(function(x){return x.k!=='todo' && a.w[x.c]===a.w.d_30;})[0];
      if(v) a.ventana=v.k;
    }
    _maeDibujarAplicar();
    document.getElementById('modal-aplicar').style.display='flex';
  });
}
function _maeContar(cb){
  var a=_MAE_AP;
  google.script.run
    .withSuccessHandler(function(r){
      if(!r||!r.ok){showToast((r&&r.error)||'No se pudo revisar las salidas','err');return;}
      a.sin=r.sin_sku; a.w={d_hoy:r.d_hoy,d_7:r.d_7,d_30:r.d_30,d_todo:r.d_todo};
      if(cb) cb();
    })
    .withFailureHandler(function(e){showToast(e.message,'err');})
    .aplicarMaestro(S.token,{descripcion:a.desc,incluirConSku:false,ejecutar:false});
}
function _maeCambioVentana(k){ _MAE_AP.ventana=k; _maeDibujarAplicar(); }
function _maeDibujarAplicar(){
  var a=_MAE_AP, v=_maeVentana(a.ventana);
  var nDist=v?a.w[v.c]:0, k=a.sin+nDist;
  var m=a.m||(a.desc?MAESTRO.data.filter(function(x){return x.descripcion===a.desc;})[0]:null);
  var html='';
  if(a.desc) html+='<div style="font-size:12.5px;color:var(--text2)"><b>'+esc(a.desc)+'</b>'+(m?'<br><span class="mono">SKU '+esc(m.sku)+' · '+fmt(m.factor)+' und. por pack</span>':'')+'</div>';
  else html+='<div style="font-size:12.5px;color:var(--text2)">Se revisarán todas las salidas con el maestro actual.</div>';
  if(a.sin){
    html+='<div style="font-size:13px">Hay <b>'+a.sin+'</b> salida'+(a.sin===1?'':'s')+' que quedó'+(a.sin===1?'':'ron')+' <b>SIN SKU</b>'+(a.desc?' con esta descripción':'')+' (de cualquier fecha). Se les pondrá el SKU del maestro y las unidades se calcularán (packs × unidades por pack).</div>';
  } else if(!a.w.d_todo){
    html+='<div style="font-size:13px">Todo está al día: las salidas coinciden con el maestro.</div>';
  } else {
    html+='<div style="font-size:13px">No hay salidas SIN SKU para actualizar.</div>';
  }
  if(a.w.d_todo>0){
    html+='<div style="border-top:1px solid var(--border);padding-top:10px;font-size:12.5px;color:var(--text2)">'+
      '<b>Revalidar:</b> hay salidas que ya tienen SKU pero con un SKU o unas unidades <b>distintas a las del maestro</b> (packs × unidades por pack). Elige hasta qué fecha corregirlas:'+
      '<select class="inp" id="mae-ap-vent" onchange="_maeCambioVentana(this.value)" style="margin-top:8px;width:100%">'+
        '<option value="ninguna"'+(a.ventana==='ninguna'?' selected':'')+'>No corregir</option>'+
        _MAE_VENTANAS.map(function(x){
          return '<option value="'+x.k+'"'+(a.ventana===x.k?' selected':'')+'>'+x.etq+' ('+a.w[x.c]+' salida'+(a.w[x.c]===1?'':'s')+')</option>';
        }).join('')+
      '</select>'+
      '<div style="font-size:11.5px;color:var(--text3);margin-top:6px">Las filas que editaste a mano con el botón "SKU" no se modifican.</div>'+
    '</div>';
  }
  document.getElementById('modal-aplicar-body').innerHTML=html;
  var ok=document.getElementById('modal-aplicar-ok');
  ok.disabled=!k;
  ok.textContent=k?('Actualizar '+k+' salida'+(k===1?'':'s')):'Nada que actualizar';
}
function _maeAplicarCancelar(){ document.getElementById('modal-aplicar').style.display='none'; _MAE_AP=null; }
function _maeAplicarOk(){
  var a=_MAE_AP; if(!a) return;
  var v=_maeVentana(a.ventana);
  var desde=v?(v.dias===null?'1900-01-01':_maeSumarDias(_maeHoyISO(),-v.dias)):null;
  var ok=document.getElementById('modal-aplicar-ok');
  ok.disabled=true; ok.textContent='Actualizando...';
  google.script.run
    .withSuccessHandler(function(r){
      _maeAplicarCancelar();
      if(!r||!r.ok){showToast((r&&r.error)||'No se pudo actualizar','err');return;}
      showToast(r.actualizadas+' salida'+(r.actualizadas===1?'':'s')+' actualizada'+(r.actualizadas===1?'':'s'),'ok');
      PAGE_LOADED['salidas']=false; PAGE_LOADED['stock']=false;
      loadMaestro();
    })
    .withFailureHandler(function(e){_maeAplicarCancelar();showToast(e.message,'err');})
    .aplicarMaestro(S.token,{descripcion:a.desc,incluirConSku:!!v,desde:desde,ejecutar:true});
}

function exportMaestro(){
  _exportXLSX(
    ['Descripción','SKU','Producto del SKU','Und. por pack'],
    MAESTRO.data,
    function(m){return[m.descripcion,m.sku,MAESTRO.prod[m.sku]||'',m.factor];},
    'Maestro','maestro'
  );
}

/* ══════════════════════════════════════
   MAESTRO DE CONTEO (MCONTEO): EAN -> SKU, producto y multiplicador
══════════════════════════════════════ */
var MCONTEO={data:[],vista:[]};
var _MC_EDIT=null;   // id de la fila que se edita (null = nueva)
var _MC_AL_GUARDAR=null; // qué hacer al guardar (p. ej. volver a resolver el código en Conteo)

function _setSbGrp(abrir){
  var grp=document.getElementById('sb-grp-maestro'); if(!grp) return;
  grp.classList.toggle('open',!!abrir);
  var hd=document.getElementById('nav-maestro-grp'); if(hd) hd.setAttribute('aria-expanded',abrir?'true':'false');
}
function toggleSbGrp(){
  var grp=document.getElementById('sb-grp-maestro'); if(!grp) return;
  _setSbGrp(!grp.classList.contains('open'));
}

function loadMconteo(){
  if(!S||!S.token){errBox('mconteo-root','Sin sesión activa. Recarga la página.','mconteo');PAGE_LOADING['mconteo']=false;return;}
  var t=(REQ_TOKEN.mconteo=(REQ_TOKEN.mconteo||0)+1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t!==REQ_TOKEN.mconteo) return;
      PAGE_LOADING['mconteo']=false;
      renderMconteo(r);
    })
    .withFailureHandler(function(e){
      if(t!==REQ_TOKEN.mconteo) return;
      PAGE_LOADING['mconteo']=false;errBox('mconteo-root',e.message,'mconteo');
    })
    .getMConteo(S.token);
}

function renderMconteo(r){
  if(_handleExpired(r,'mconteo-root')) return;
  if(!r||!r.ok){errBox('mconteo-root',r&&r.error?r.error:'Error al cargar el maestro de conteo','mconteo');return;}
  MCONTEO.data=r.data;
  DATA.mconteo=r.data;
  var ico='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12"/></svg>';
  var skus={}; MCONTEO.data.forEach(function(m){ skus[m.sku]=true; });
  var nSku=Object.keys(skus).length;
  var sinProd=MCONTEO.data.filter(function(m){return !m.producto;}).length;
  document.getElementById('mconteo-root').innerHTML=
    '<div class="stats">'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">Códigos EAN</div><div class="stat-val-row"><div class="stat-val">'+fmt(MCONTEO.data.length)+'</div><span class="stat-unit-pill">filas</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">SKU distintos</div><div class="stat-val-row"><div class="stat-val">'+fmt(nSku)+'</div><span class="stat-unit-pill">sku</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">Sin nombre de producto</div><div class="stat-val-row"><div class="stat-val" style="color:'+(sinProd?'var(--warn)':'inherit')+'">'+fmt(sinProd)+'</div><span class="stat-unit-pill">filas</span></div></div>'+
    '</div>'+
    '<div class="filters" style="flex-wrap:wrap;gap:8px;align-items:center">'+
      '<input class="filter-inp" id="mc-busq" placeholder="Buscar EAN, SKU, SAP o producto..." style="width:300px" oninput="filterMconteo()"/>'+
      '<span class="result-count" id="mc-count"></span>'+
    '</div>'+
    '<div class="table-wrap"><table style="min-width:0">'+
      '<thead><tr><th>EAN</th><th>SKU</th><th class="col-hide-mobile">SAP</th><th>Producto</th><th class="r">Multiplicador</th><th class="c">Acciones</th></tr></thead>'+
      '<tbody id="mconteo-tbody"></tbody>'+
    '</table></div>';
  filterMconteo();
}

function filterMconteo(){
  var q=((document.getElementById('mc-busq')||{}).value||'').toLowerCase().trim();
  var rows=MCONTEO.data.filter(function(m){
    return !q||m.ean.toLowerCase().indexOf(q)>-1||m.sku.toLowerCase().indexOf(q)>-1||
      m.sap.toLowerCase().indexOf(q)>-1||m.producto.toLowerCase().indexOf(q)>-1;
  });
  var MAX=500, total=rows.length;
  if(rows.length>MAX) rows=rows.slice(0,MAX);
  MCONTEO.vista=rows;
  var el=document.getElementById('mc-count');
  if(el) el.textContent=total>MAX ? ('Mostrando '+MAX+' de '+total+' — usa el buscador') : (total+' registros');
  var html=rows.map(function(m,i){
    return '<tr style="cursor:pointer" title="Tocar para editar" onclick="abrirMConteoForm('+i+')">'+
      '<td class="mono" style="font-weight:600">'+esc(m.ean)+'</td>'+
      '<td class="mono">'+esc(m.sku||'—')+'</td>'+
      '<td class="mono col-hide-mobile" style="color:var(--text3)">'+esc(m.sap||'—')+'</td>'+
      '<td class="td-desc" title="'+esc(m.producto)+'">'+(m.producto?esc(m.producto):'<span style="color:var(--text3)">—</span>')+'</td>'+
      '<td class="r">'+fmt(m.multiplicador)+'</td>'+
      '<td class="c" style="white-space:nowrap">'+
        '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();abrirMConteoForm('+i+')">Editar</button> '+
        '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="event.stopPropagation();eliminarMConteoFila('+i+')">Eliminar</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  var t=document.getElementById('mconteo-tbody');
  if(t) t.innerHTML=html||'<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:40px">Sin resultados</td></tr>';
}

/* idx = posición en la vista filtrada; null = nuevo */
function abrirMConteoForm(idx,eanPrefill,alGuardar){
  var m=(idx===null||idx===undefined)?null:MCONTEO.vista[idx];
  _MC_EDIT=m?m.id:null;
  _MC_AL_GUARDAR=alGuardar||null;
  document.getElementById('mc-buscar').value='';
  document.getElementById('mc-stock-sel').innerHTML='';
  document.getElementById('ac-mc').classList.remove('open');
  document.getElementById('fs-mconteo-title').textContent=m?'Editar maestro de conteo':'Agregar al maestro de conteo';
  document.getElementById('mc-ean').value=m?m.ean:(eanPrefill||'');
  document.getElementById('mc-sku').value=m?m.sku:'';
  document.getElementById('mc-producto').value=m?m.producto:'';
  document.getElementById('mc-sap').value=m?m.sap:'';
  document.getElementById('mc-mult').value=m?m.multiplicador:1;
  document.getElementById('mc-err').textContent='';
  mconteoEanCambio();
  mconteoSkuCambio();
  openFS('fs-mconteo');
  setTimeout(function(){document.getElementById(m||eanPrefill?'mc-buscar':'mc-ean').focus();},120);
}

/* Elegir un producto del Stock: completa SKU y nombre; si el SKU ya tiene otro EAN, copia también SAP y multiplicador */
function mconteoElegirStock(idx){
  var item=(AC_CACHE['ac-mc']||[])[idx];
  if(!item) return;
  document.getElementById('ac-mc').classList.remove('open');
  document.getElementById('mc-buscar').value='';
  document.getElementById('mc-sku').value=item.sku;
  document.getElementById('mc-producto').value=item.desc;
  document.getElementById('mc-stock-sel').innerHTML='<span style="color:var(--text3)">'+ICO('right',12)+esc(item.sku)+' · '+esc(item.desc)+'</span>';
  mconteoSkuCambio();
  var otro=MCONTEO.data.filter(function(m){return m.id!==_MC_EDIT&&m.sku.toLowerCase()===String(item.sku).toLowerCase();})[0];
  if(otro){ document.getElementById('mc-sap').value=otro.sap; document.getElementById('mc-mult').value=otro.multiplicador; }
  var e=document.getElementById('mc-ean');
  var sig=document.getElementById(e.value?'mc-mult':'mc-ean'); sig.focus(); if(sig.select) sig.select();
}

/* Desde Conteo: un código que no está en el maestro se asocia a un producto del Stock y se vuelve a resolver */
function cntAsociarEAN(){
  var ean=(document.getElementById('cnt-ean').value||'').trim();
  ean=/[eE]/.test(ean)?String(Math.round(Number(ean))):ean.replace(/\.0+$/,'');
  if(!MCONTEO.data.length && _MCONTEO_LOCAL) MCONTEO.data=_MCONTEO_LOCAL; // para copiar datos de un SKU que ya tiene otro EAN
  abrirMConteoForm(null,ean,function(){
    var inp=document.getElementById('cnt-ean'); if(inp) inp.value=ean;
    _cargarMConteo(function(){ resolverEAN(); },true);
  });
}

/* Avisa si el EAN escrito o escaneado ya existe en el maestro */
function mconteoEanCambio(){
  var inp=document.getElementById('mc-ean');
  var v=(inp.value||'').replace(/\s+/g,'');
  if(v!==inp.value) inp.value=v;
  var el=document.getElementById('mc-ean-info');
  var otro=v&&MCONTEO.data.filter(function(m){return m.id!==_MC_EDIT&&m.ean===v;})[0];
  el.innerHTML=otro
    ? '<span style="color:var(--warn)">'+ICO('warn',12)+'Este EAN ya está en el maestro: '+esc(otro.producto||otro.sku)+' (SKU '+esc(otro.sku)+')</span>'
    : '';
}

/* Si el SKU ya está en el maestro con otro EAN, ofrece su nombre y multiplicador */
function mconteoSkuCambio(){
  var sku=(document.getElementById('mc-sku').value||'').trim().toLowerCase();
  var el=document.getElementById('mc-sku-info');
  if(!sku){el.innerHTML='';return;}
  var otro=MCONTEO.data.filter(function(m){return m.id!==_MC_EDIT&&m.sku.toLowerCase()===sku;})[0];
  el.innerHTML=otro
    ? '<span style="color:var(--text3)">'+ICO('right',12)+'Ya está con otro EAN: '+esc(otro.producto||otro.sku)+' · x'+fmt(otro.multiplicador)+
      ' <a href="#" onclick="mconteoCopiarSku();return false" style="color:var(--accent);font-weight:600">Usar estos datos</a></span>'
    : '';
}
function mconteoCopiarSku(){
  var sku=(document.getElementById('mc-sku').value||'').trim().toLowerCase();
  var otro=MCONTEO.data.filter(function(m){return m.id!==_MC_EDIT&&m.sku.toLowerCase()===sku;})[0];
  if(!otro) return;
  document.getElementById('mc-producto').value=otro.producto;
  document.getElementById('mc-sap').value=otro.sap;
  document.getElementById('mc-mult').value=otro.multiplicador;
}

function guardarMConteoForm(){
  var ean =(document.getElementById('mc-ean').value ||'').trim();
  var sku =(document.getElementById('mc-sku').value ||'').trim();
  var prod=(document.getElementById('mc-producto').value||'').trim();
  var sap =(document.getElementById('mc-sap').value ||'').trim();
  var mult=Number(document.getElementById('mc-mult').value);
  var err =document.getElementById('mc-err');
  if(!ean){err.textContent='El EAN es obligatorio';return;}
  if(!sku){err.textContent='El SKU es obligatorio';return;}
  if(!(mult>0)){err.textContent='El multiplicador debe ser mayor a 0';return;}
  err.textContent='';
  var btn=document.getElementById('btn-mc-save');
  btn.disabled=true;btn.textContent='Guardando...';
  var eraNuevo=(_MC_EDIT===null);
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Guardar';
      if(!r.ok){err.textContent=r.error;return;}
      closeFS('fs-mconteo');
      showToast('Maestro de conteo actualizado','ok');
      _mconteoInvalidarConteo();
      loadMconteo();
      if(_MC_AL_GUARDAR){ var f=_MC_AL_GUARDAR; _MC_AL_GUARDAR=null; f(); return; }
      // el producto nuevo queda a la vista: se filtra por su EAN
      if(eraNuevo) setTimeout(function(){ var b=document.getElementById('mc-busq'); if(b){b.value=ean;filterMconteo();} },400);
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Guardar';err.textContent=e.message;})
    .guardarMConteo(S.token,{id:_MC_EDIT,ean:ean,sku:sku,producto:prod,sap:sap,multiplicador:mult});
}

function eliminarMConteoFila(i){
  var m=MCONTEO.vista[i]; if(!m) return;
  _confirmDialog('Eliminar del maestro de conteo',
    'El EAN '+m.ean+(m.producto?' ('+m.producto+')':'')+' se quitará del maestro. Al escanearlo en Conteo ya no se reconocerá. Los conteos registrados no cambian.',
    function(){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){showToast(r.error||'No se pudo eliminar','err');return;}
          showToast('Eliminado del maestro de conteo','ok');
          _mconteoInvalidarConteo();
          loadMconteo();
        })
        .withFailureHandler(function(e){showToast(e.message,'err');})
        .eliminarMConteo(S.token,m.id);
    },'Eliminar');
}

// La pantalla de Conteo guarda una copia del maestro; hay que descartarla para que tome los cambios.
function _mconteoInvalidarConteo(){
  _MCONTEO_LOCAL=null; _MCONTEO_PENDING=[]; _MCONTEO_EAN_IDX={}; _MCONTEO_SKU_IDX={};
  try{ localStorage.removeItem('ds_mconteo_cache_v1'); }catch(e){}
}

function exportMconteo(){
  _exportXLSX(
    ['EAN','DYNAMICS','SAP','PRODUCTO','MULTIPLICADOR'],
    MCONTEO.data,
    function(m){return[m.ean,m.sku,m.sap,m.producto,m.multiplicador];},
    'MCONTEO','maestro_conteo'
  );
}

/* ── UTILS ── */
function esc(v){
  if(v===null||v===undefined)return '';
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmt(v){return(v===null||v===undefined)?'—':Number(v).toLocaleString('es-PE');}

// errBox: muestra error en el contenedor de una página.
// Si se pasa 'pageName', agrega botón "Reintentar" que llama a reloadPage(pageName).
function errBox(id, msg, pageName){
  var el=document.getElementById(id);
  if(!el){console.error('errBox: elemento #'+id+' no encontrado. Mensaje: '+msg);return;}
  // Resetear flag para que reloadPage no quede bloqueado
  if(pageName) PAGE_LOADING[pageName]=false;
  var retryBtn = pageName
    ? '<button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="reloadPage(\''+pageName+'\')">'+ICO('refresh',14)+'Reintentar</button>'
    : '';
  el.innerHTML='<div class="err-box" style="text-align:center">'+
    '<div>'+ICO('warn',14)+'Error: '+esc(msg)+'</div>'+retryBtn+
  '</div>';
}

/* Cerrar autocomplete al click fuera */
document.addEventListener('click',function(e){
  document.querySelectorAll('.ac-list').forEach(function(l){
    if(!l.parentElement.contains(e.target))l.classList.remove('open');
  });
});

/* ── SCANNER CAMARA ── */
/* ══════════════════════════════════════
   SCANNER — delega al parent (Netlify PWA) via postMessage
   GAS no puede acceder a getUserMedia en iframe cross-origin.
   El parent (index.html de Netlify) tiene los permisos de cámara
   y devuelve el resultado via window.parent.postMessage.
   Si no hay parent (acceso directo), abre scanner.html como popup.
══════════════════════════════════════ */

var _scannerTarget = {skuId:null, descId:null, marcaId:null, conteoMode:false};

function openScanner(skuId, descId, marcaId){
  _scannerTarget = {skuId:skuId, descId:descId, marcaId:marcaId, conteoMode:false};
  _abrirPopupScanner(skuId || 'scan', 'Escanea el código SKU / EAN');
}
// En la pantalla de conteo la cámara va dentro del propio panel (ver _cntCamIniciar)
function openScannerConteo(){ _cntCamIniciar(); }

function _abrirPopupScanner(targetId, title) {
  // window.top = Netlify (el único que tiene permisos de cámara)
  // El Warden de Google retransmite mensajes de window.top al GAS,
  // por eso window.top.postMessage llega aquí y e.source queda como
  // la referencia válida que el Warden acepta de vuelta.
  if (window.top && window.top !== window) {
    window.top.postMessage(
      { type: 'OPEN_SCANNER', targetId: targetId, title: title || 'Escanea el código' },
      '*'
    );
  } else {
    _scannerNativo(targetId, title);
  }
}

/* Escáner propio (la app ya no vive dentro de un iframe): BarcodeDetector con respaldo ZXing */
var _scanNat = { stream: null, raf: 0, zx: null, activo: false };
var _SCAN_FORMATOS = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code'];

function _scannerNativoCerrar(){
  _scanNat.activo = false;
  if (_scanNat.raf) cancelAnimationFrame(_scanNat.raf);
  if (_scanNat.zx) { try { _scanNat.zx.reset(); } catch(e){} _scanNat.zx = null; }
  if (_scanNat.stream) { _scanNat.stream.getTracks().forEach(function(t){ t.stop(); }); _scanNat.stream = null; }
  var ov = document.getElementById('scan-nativo'); if (ov) ov.remove();
}

function _scanBeep(){
  try { if (navigator.vibrate) navigator.vibrate(80); } catch(e){}
  try {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    var ac = new AC(), o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = 1500; g.gain.value = 0.08;
    o.connect(g); g.connect(ac.destination); o.start();
    setTimeout(function(){ o.stop(); ac.close(); }, 110);
  } catch(e){}
}

function _scannerNativo(targetId, title){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('La cámara solo funciona con la app abierta por https (o instalada)', 'err'); return;
  }
  _scannerNativoCerrar();
  var ov = document.createElement('div');
  ov.id = 'scan-nativo';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;';
  ov.innerHTML =
    '<div style="color:#fff;padding:12px 16px;font:600 15px DM Sans,sans-serif;display:flex;justify-content:space-between;align-items:center;gap:8px">'+
      '<span style="flex:1">'+esc(title||'Escanea el código')+'</span>'+
      '<button type="button" id="scan-nativo-luz" style="display:none;background:#333;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:600">'+ICO('bolt',16,'s')+'</button>'+
      '<button type="button" id="scan-nativo-x" style="background:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:600">Cerrar</button>'+
    '</div>'+
    '<div style="position:relative;flex:1;min-height:0">'+
      '<video id="scan-nativo-v" playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>'+
      '<div style="position:absolute;left:50%;top:50%;width:78%;max-width:420px;height:34%;transform:translate(-50%,-50%);border:3px solid #C0B3F5;border-radius:14px;box-shadow:0 0 0 9999px rgba(0,0,0,.45);pointer-events:none"></div>'+
      '<div id="scan-nativo-msg" style="position:absolute;left:0;right:0;bottom:14px;text-align:center;color:#fff;font:500 13px DM Sans,sans-serif;padding:0 16px">Apunta al código de barras</div>'+
    '</div>'+
    '<form id="scan-nativo-form" style="display:flex;gap:8px;padding:10px 12px;background:#111">'+
      '<input id="scan-nativo-man" inputmode="numeric" autocomplete="off" placeholder="…o escribe el código y pulsa Enter" style="flex:1;padding:10px;border-radius:8px;border:0;font-size:15px"/>'+
      '<button type="submit" style="background:#B7A8F3;color:#1A1230;border:0;border-radius:8px;padding:10px 16px;font-weight:600">OK</button>'+
    '</form>';
  document.body.appendChild(ov);
  document.getElementById('scan-nativo-x').onclick = _scannerNativoCerrar;
  var video = document.getElementById('scan-nativo-v');
  var msg = document.getElementById('scan-nativo-msg');
  _scanNat.activo = true;

  function entregar(code){
    if (!_scanNat.activo) return;
    code = String(code||'').trim();
    if (!code) return;
    _scanBeep();
    _scannerNativoCerrar();
    _applyScanResult(code, targetId);
  }
  document.getElementById('scan-nativo-form').onsubmit = function(ev){
    ev.preventDefault(); entregar(document.getElementById('scan-nativo-man').value);
  };

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  })
    .then(function(stream){
      if (!_scanNat.activo) { stream.getTracks().forEach(function(t){ t.stop(); }); return; }
      _scanNat.stream = stream;
      video.srcObject = stream;

      // Enfoque continuo y linterna (si el teléfono los permite)
      var track = stream.getVideoTracks()[0];
      try {
        var caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function(){});
        if (caps.torch) {
          var luz = document.getElementById('scan-nativo-luz'), on = false;
          luz.style.display = '';
          luz.onclick = function(){ on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(function(){}); luz.style.background = on ? '#C0B3F5' : '#333'; };
        }
      } catch(e){}

      return video.play().then(function(){
        var conBD = 'BarcodeDetector' in window;
        var iniciarDetector = conBD && BarcodeDetector.getSupportedFormats
          ? BarcodeDetector.getSupportedFormats().then(function(f){ return _SCAN_FORMATOS.filter(function(x){ return f.indexOf(x) >= 0; }); })
          : Promise.resolve(conBD ? _SCAN_FORMATOS : []);
        return iniciarDetector.then(function(formatos){
          if (conBD && formatos.length) {
            var det = new BarcodeDetector({ formats: formatos });
            var ultimo = 0;
            (function tick(t){
              if (!_scanNat.activo) return;
              if (t - ultimo < 90 || video.readyState < 2) { _scanNat.raf = requestAnimationFrame(tick); return; }
              ultimo = t;
              det.detect(video).then(function(r){
                if (r && r.length) entregar(r[0].rawValue); else _scanNat.raf = requestAnimationFrame(tick);
              }).catch(function(){ _scanNat.raf = requestAnimationFrame(tick); });
            })(0);
          } else {
            _scannerZXing(video, entregar, msg);
          }
        });
      });
    })
    .catch(function(err){
      var n = err && err.name;
      var texto = n === 'NotAllowedError' ? 'Permiso de cámara denegado. Actívalo en los ajustes del navegador o de la app.'
                : n === 'NotFoundError'   ? 'Este equipo no tiene cámara.'
                : n === 'NotReadableError'? 'La cámara está en uso por otra aplicación.'
                : 'No se pudo abrir la cámara.';
      msg.textContent = texto + ' Puedes escribir el código abajo.';
      msg.style.background = 'rgba(180,30,30,.85)'; msg.style.padding = '10px 16px';
      var man = document.getElementById('scan-nativo-man'); if (man) man.focus();
    });
}

// Respaldo para navegadores sin BarcodeDetector (iPhone/Safari, Firefox): librería ZXing
function _scannerZXing(video, entregar, msg, est){
  est = est || _scanNat;
  function lanzar(){
    if (!est.activo) return;
    var hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E,
      ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39, ZXing.BarcodeFormat.QR_CODE ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    // Bucle propio: se toma un fotograma del video, se pasa a canvas y se decodifica con ZXing
    var reader = new ZXing.MultiFormatReader();
    reader.setHints(hints);
    var cv = document.createElement('canvas'), cx = cv.getContext('2d');
    est.zx = { reset: function(){ clearTimeout(this.t); this.parar = true; } };
    (function paso(){
      var z = est.zx;
      if (!est.activo || !z || z.parar) return;
      if (video.readyState >= 2 && video.videoWidth) {
        cv.width = video.videoWidth; cv.height = video.videoHeight;
        cx.drawImage(video, 0, 0);
        try {
          var bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(cv)));
          var res = reader.decode(bmp);
          if (res) { entregar(res.getText()); return; }
        } catch(e) { /* no se encontró código en este fotograma */ }
      }
      z.t = setTimeout(paso, 120);
    })();
  }
  if (window.ZXing) { lanzar(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  s.onload = lanzar;
  s.onerror = function(){ msg.textContent = 'No se pudo cargar el lector. Escribe el código abajo.'; };
  document.head.appendChild(s);
}

/* ── CÁMARA INTEGRADA EN LA PANTALLA DE CONTEO ──
   Escanea dentro del propio panel. Al detectar un código el panel se pone negro (cámara apagada, sigue ahí)
   y aparecen packs/sueltas con el botón de guardar; al guardar o cancelar la cámara se enciende de nuevo. */
var _cntCam = { stream:null, raf:0, zx:null, activo:false, iniciando:false, track:null, torch:false, error:false };

function _cntCamAbierta(){
  var fs = document.getElementById('fs-conteo');
  return !!(fs && fs.classList.contains('open'));
}
function _cntCamDetener(){
  _cntCam.activo = false; _cntCam.iniciando = false;
  if (_cntCam.raf) cancelAnimationFrame(_cntCam.raf);
  _cntCam.raf = 0;
  if (_cntCam.zx) { try { _cntCam.zx.reset(); } catch(e){} _cntCam.zx = null; }
  if (_cntCam.stream) { _cntCam.stream.getTracks().forEach(function(t){ t.stop(); }); _cntCam.stream = null; }
  _cntCam.track = null; _cntCam.torch = false;
  var v = document.getElementById('cnt-cam-v'); if (v) { try { v.srcObject = null; } catch(e){} }
  var f = document.getElementById('cnt-flash'); if (f) { f.style.display = 'none'; f.classList.remove('on'); }
}
// html = contenido de la capa negra; null = ocultarla y mostrar el visor
function _cntCamNegro(html){
  var off = document.getElementById('cnt-cam-off'); if (!off) return;
  var vivo = !html;
  off.style.display = vivo ? 'none' : 'flex';
  if (!vivo) off.innerHTML = html;
  var l = document.getElementById('cnt-cam-line'); if (l) l.style.display = vivo ? '' : 'none';
  var m = document.getElementById('cnt-cam-msg');  if (m) m.style.display = vivo ? '' : 'none';
}
function _cntCamPausar(codigo){
  _cntCamDetener();
  _cntCamNegro((codigo ? '<div class="cnt-off-code">'+esc(codigo)+'</div>' : '') + '<div class="cnt-off-sub">Cámara en pausa</div>');
}
function _cntCamNoEncontrado(){
  if (_cntCam.activo) return; // el código se escribió a mano con la cámara encendida: no se toca el visor
  _cntCamNegro('<div style="font-size:15px;color:#FF8A8A">Código no encontrado</div><div class="cnt-off-sub">Toca para escanear otra vez</div>');
}
function _cntCamSinCamara(texto){
  _cntCamDetener();
  _cntCamNegro('<div style="font-size:13px;color:#E4DEFF">'+esc(texto)+'</div><div class="cnt-off-sub">Toca para reintentar</div>');
  var e = document.getElementById('cnt-ean'); if (e && _cntCamAbierta()) e.focus();
}
// Toque sobre el panel negro: si no hay producto detectado, vuelve a escanear
function cntCamToque(){
  var fs = document.getElementById('fs-conteo');
  if (fs && fs.classList.contains('cnt-det')) return;
  _cntCam.error = false;
  var e = document.getElementById('cnt-ean'); if (e) e.value = '';
  var s = document.getElementById('cnt-ean-status'); if (s) s.textContent = '';
  var mw = document.getElementById('cnt-manual-wrap'); if (mw) mw.style.display = 'none';
  _cntCamNegro(null);
  _cntCamIniciar();
}
function cntFlash(){
  var t = _cntCam.track; if (!t) return;
  _cntCam.torch = !_cntCam.torch;
  t.applyConstraints({ advanced: [{ torch: _cntCam.torch }] }).catch(function(){});
  var f = document.getElementById('cnt-flash'); if (f) f.classList.toggle('on', _cntCam.torch);
}

function _cntCamIniciar(){
  if (_cntCam.activo || _cntCam.iniciando) return;
  var fs = document.getElementById('fs-conteo');
  if (!fs || !fs.classList.contains('open') || fs.classList.contains('cnt-det')) return;
  var video = document.getElementById('cnt-cam-v'), msg = document.getElementById('cnt-cam-msg');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    _cntCam.error = true;
    _cntCamSinCamara('La cámara solo funciona con la app abierta por https (o instalada). Escribe el código arriba.');
    return;
  }
  _cntCamNegro(null);
  msg.textContent = 'Iniciando cámara…';
  _cntCam.iniciando = true;

  function entregar(code){
    if (!_cntCam.activo) return;
    code = String(code || '').trim();
    if (!code) return;
    _scanBeep();
    _cntCamPausar(code);
    var eanEl = document.getElementById('cnt-ean'); if (eanEl) eanEl.value = code;
    resolverEAN();
  }

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  })
    .then(function(stream){
      _cntCam.iniciando = false;
      var f2 = document.getElementById('fs-conteo');
      if (!_cntCamAbierta() || !f2 || f2.classList.contains('cnt-det')) { stream.getTracks().forEach(function(t){ t.stop(); }); return; }
      _cntCam.stream = stream; _cntCam.activo = true; _cntCam.error = false;
      video.srcObject = stream;
      msg.textContent = 'Apunta al código de barras';

      var track = stream.getVideoTracks()[0];
      _cntCam.track = track;
      try {
        var caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function(){});
        var fl = document.getElementById('cnt-flash');
        if (fl) { fl.style.display = caps.torch ? 'flex' : 'none'; fl.classList.remove('on'); }
      } catch(e){}

      return video.play().then(function(){
        var conBD = 'BarcodeDetector' in window;
        var iniciarDetector = conBD && BarcodeDetector.getSupportedFormats
          ? BarcodeDetector.getSupportedFormats().then(function(f){ return _SCAN_FORMATOS.filter(function(x){ return f.indexOf(x) >= 0; }); })
          : Promise.resolve(conBD ? _SCAN_FORMATOS : []);
        return iniciarDetector.then(function(formatos){
          if (!_cntCam.activo) return;
          if (conBD && formatos.length) {
            var detector = new BarcodeDetector({ formats: formatos });
            var ultimo = 0;
            (function tick(t){
              if (!_cntCam.activo) return;
              if (t - ultimo < 90 || video.readyState < 2) { _cntCam.raf = requestAnimationFrame(tick); return; }
              ultimo = t;
              detector.detect(video).then(function(r){
                if (r && r.length) entregar(r[0].rawValue); else _cntCam.raf = requestAnimationFrame(tick);
              }).catch(function(){ _cntCam.raf = requestAnimationFrame(tick); });
            })(0);
          } else {
            _scannerZXing(video, entregar, msg, _cntCam);
          }
        });
      });
    })
    .catch(function(err){
      _cntCam.iniciando = false; _cntCam.error = true;
      var n = err && err.name;
      _cntCamSinCamara(
        n === 'NotAllowedError'  ? 'Permiso de cámara denegado. Actívalo en los ajustes del navegador o de la app, o escribe el código arriba.'
      : n === 'NotFoundError'    ? 'Este equipo no tiene cámara. Escribe el código arriba.'
      : n === 'NotReadableError' ? 'La cámara está en uso por otra aplicación. Escribe el código arriba.'
      :                            'No se pudo abrir la cámara. Escribe el código arriba.');
    });
}

// Estado de la pantalla de conteo: con producto detectado se pausa la cámara y aparece la entrada de packs;
// sin producto la cámara está encendida y se ve el historial. Se llama cada vez que cambia el producto.
function _cntVista(){
  var fs = document.getElementById('fs-conteo'); if (!fs) return;
  var card = document.getElementById('cnt-producto-card');
  var det = !!(card && card.style.display === 'block');
  fs.classList.toggle('cnt-det', det);
  if (det) {
    _cntCamPausar((typeof _cnt !== 'undefined' && _cnt && (_cnt.ean || _cnt.sku)) || '');
  } else if (_cntCamAbierta() && !_cntCam.activo && !_cntCam.iniciando && !_cntCam.error) {
    _cntCamIniciar();
  }
}
document.addEventListener('visibilitychange', function(){
  if (!_cntCamAbierta()) return;
  if (document.visibilityState === 'hidden') _cntCamDetener(); else _cntVista();
});

// Listener global permanente — recibe resultado desde Netlify
// Netlify responde via e.source guardado del mensaje OPEN_SCANNER,
// que el Warden acepta porque proviene de window.top (mismo flujo que funcionaba)
window.addEventListener('message', function(event) {
  var d = event.data;
  if (!d || typeof d !== 'object') return;
  if (d.type !== 'SCAN_RESULT' && d.type !== 'SCAN_CANCEL') return;
  if (!d._fromNetlify) return;
  if (d.type === 'SCAN_RESULT') _applyScanResult(String(d.code||'').trim(), d.targetId);
  // Si el usuario cancela el scanner sin escanear, limpiar filtroMode
  if (d.type === 'SCAN_CANCEL' && _scannerTarget.filtroMode) _scannerTarget.filtroMode = false;
});


function _applyScanResult(code, targetId){
  showToast('Escaneado: ' + code, 'ok');

  // ── MAESTRO DE CONTEO: el código va al campo EAN del formulario ────────
  if(targetId === 'mc-ean'){
    var mcEl = document.getElementById('mc-ean');
    if(mcEl){ mcEl.value = code; mconteoEanCambio(); var sk=document.getElementById('mc-sku'); if(sk) sk.focus(); }
    return;
  }

  // ── MODO CONTEO: código va al campo EAN y dispara resolución ──────────
  if(targetId === 'cnt-ean' || _scannerTarget.conteoMode){
    var eanEl = document.getElementById('cnt-ean');
    if(eanEl){
      eanEl.value = code;
      eanEl.dispatchEvent(new Event('input', { bubbles: true }));
      if(typeof resolverEAN === 'function') resolverEAN();
    }
    return;
  }

  // ── MODO FILTRO CONTEO: llenar buscador y filtrar ───────────────────
  if(_scannerTarget.filtroMode){
    var busqEl=document.getElementById('cnt-busq');
    if(busqEl){ busqEl.value=code; if(typeof filterConteo==='function') filterConteo(); }
    _scannerTarget.filtroMode=false;
    return;
  }

  // ── MODO SKU (salidas, MT, entradas): resolver automáticamente ────────
  // El código escaneado puede ser EAN o SKU — probar ambos índices en caché.
  // Si no está en caché, llamar al servidor. El usuario no necesita hacer nada.
  var skuId   = targetId || _scannerTarget.skuId;
  var descId  = _scannerTarget.descId;
  var marcaId = _scannerTarget.marcaId;

  // Caso especial: campo EAN del form Cod EAN — solo poner valor y verificar duplicado
  if(skuId === 'ean-ean'){
    var eanEl = document.getElementById('ean-ean');
    if(eanEl){ eanEl.value = code; onCodEanInput(); }
    return;
  }

  // 1. Intentar resolución local desde caché MCONTEO (O(1) — instantáneo)
  var resolved = _resolverCodigoLocal(code);

  if(resolved){
    _llenarCamposSKU(skuId, descId, marcaId, resolved);
    return;
  }

  // 2. Fallback servidor — puede ser SKU directo del maestro STOCK
  // Primero poner el código en el campo SKU y disparar el autocomplete
  var skuEl = document.getElementById(skuId);
  if(skuEl){
    skuEl.value = code;
    skuEl.dispatchEvent(new Event('input', { bubbles: true }));
    // El autocomplete (acSearch) se dispara via oninput — no hace falta más
  }
}

// Busca un código (EAN o SKU) en los índices locales de MCONTEO
// Retorna { sku, desc, marca } o null si no está en caché
function _resolverCodigoLocal(code){
  if(!code) return null;
  var norm = /[eE]/.test(code) ? Math.round(Number(code)).toString() : code.replace(/\.0+$/,'');

  // Buscar por EAN
  if(_MCONTEO_EAN_IDX && _MCONTEO_EAN_IDX[norm]){
    var r = _MCONTEO_EAN_IDX[norm];
    return { sku: r.sku, desc: r.producto || '', marca: '' };
  }
  // Buscar por SKU exacto
  if(_MCONTEO_SKU_IDX && _MCONTEO_SKU_IDX[norm.toLowerCase()]){
    var r2 = _MCONTEO_SKU_IDX[norm.toLowerCase()];
    return { sku: r2.sku, desc: r2.producto || '', marca: '' };
  }
  // Buscar en DATA.stock si ya está cargado (maestro de la tienda)
  if(DATA.stock && DATA.stock.length){
    var normLow = norm.toLowerCase();
    for(var i=0; i<DATA.stock.length; i++){
      var item = DATA.stock[i];
      if(String(item.sku||'').toLowerCase() === normLow){
        return { sku: item.sku, desc: item.desc || '', marca: item.marca || '' };
      }
    }
  }
  return null;
}

// Rellena los campos SKU/desc/marca después de resolver
function _llenarCamposSKU(skuId, descId, marcaId, resolved){
  var skuEl = document.getElementById(skuId);
  if(skuEl){ skuEl.value = resolved.sku; }

  if(descId){
    var descEl = document.getElementById(descId);
    if(descEl){
      var wasRO = descEl.readOnly; descEl.readOnly = false;
      descEl.value = resolved.desc;
      descEl.readOnly = wasRO;
    }
  }
  if(marcaId){
    var marcaEl = document.getElementById(marcaId);
    if(marcaEl) marcaEl.value = resolved.marca || '';
  }
  // Cerrar cualquier lista de autocomplete abierta
  document.querySelectorAll('.ac-list.open').forEach(function(el){ el.classList.remove('open'); });
}
function _updateConteoStats() {
  if (!DATA.conteo) return;
  var totalUnd = DATA.conteo.reduce(function(a, x) { return a + x.total; }, 0);
  var skusU = [];
  DATA.conteo.forEach(function(x) { if (skusU.indexOf(x.sku) < 0) skusU.push(x.sku); });
  // Actualizar stat cards si están visibles (la página de conteo está activa)
  var sReg = document.querySelector('#conteo-root .stat-val');
  if (!sReg) return; // página no está renderizada aún
  var cards = document.querySelectorAll('#conteo-root .stat-val');
  if (cards[0]) cards[0].textContent = DATA.conteo.length;
  if (cards[1]) cards[1].textContent = skusU.length;
  if (cards[2]) cards[2].textContent = fmt(totalUnd);
}

/* ── CONTEO ── */
// Catálogo MCONTEO cargado en memoria al abrir el formulario.
// Se resuelven EAN y SKU localmente — cero llamadas al servidor por escaneo.
var _MCONTEO_LOCAL   = null;  // null = no cargado aún
var _MCONTEO_PENDING = [];    // queue de callbacks esperando la carga — reemplaza setInterval polling

function _cargarMConteo(cb, force) {
  // Ya cargado y no es recarga forzada: ejecutar callback inmediatamente
  if (_MCONTEO_LOCAL && !force) { if (cb) cb(); return; }
  // Carga en curso (no forzada): encolar callback
  if (!force && _MCONTEO_PENDING !== null) {
    if (cb) _MCONTEO_PENDING.push(cb);
    if (_MCONTEO_PENDING.length > 1) return; // ya hay una petición en vuelo
  }
  // Limpiar localStorage para no servir datos viejos offline
  if (force) try { localStorage.removeItem('ds_mconteo_cache_v1'); } catch(e) {}
  // Iniciar carga (force=true invalida el caché del servidor también)
  google.script.run
    .withSuccessHandler(function(r) {
      if (r && r.ok) {
        _MCONTEO_LOCAL = r.data;
        _MCONTEO_EAN_IDX = {};
        _MCONTEO_SKU_IDX = {};
        r.data.forEach(function(item) {
          _MCONTEO_EAN_IDX[item.ean] = item;
          _MCONTEO_SKU_IDX[item.sku.toLowerCase()] = item;
        });
        // Persistir en localStorage para uso offline
        try { localStorage.setItem('ds_mconteo_cache_v1', JSON.stringify(r.data)); } catch(e) {}
      }
      // Drenar la queue — notificar a todos los callers que estaban esperando
      var pending = _MCONTEO_PENDING.slice();
      _MCONTEO_PENDING = [];
      pending.forEach(function(fn) { try { fn(); } catch(e) {} });
      if (force && cb) { try { cb(); } catch(e) {} }
    })
    .withFailureHandler(function() {
      // En caso de fallo también drenar la queue para no dejar callers colgados
      var pending = _MCONTEO_PENDING.slice();
      _MCONTEO_PENDING = [];
      pending.forEach(function(fn) { try { fn(); } catch(e) {} });
      if (force && cb) { try { cb(); } catch(e) {} }
    })
    .getMConteo(S.token, !!force);
}

// Índices de búsqueda O(1) — populados junto con _MCONTEO_LOCAL
var _MCONTEO_EAN_IDX = {};
var _MCONTEO_SKU_IDX = {};

function loadConteo(){
  if(!S||!S.token){errBox('conteo-root','Sin sesión activa. Recarga la página.','conteo');PAGE_LOADING['conteo']=false;return;}
  var force=!!_FORCE_REFRESH['conteo']; _FORCE_REFRESH['conteo']=false;
  var t = (REQ_TOKEN.conteo = (REQ_TOKEN.conteo||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.conteo) return;
      PAGE_LOADING['conteo']=false;
      if(!r){errBox('conteo-root','Error al conectar con el servidor. Reintenta.','conteo');return;}
      renderConteo(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.conteo) return;
      PAGE_LOADING['conteo']=false;errBox('conteo-root',e.message,'conteo');
    })
    .getConteo(S.token, 7, force, window.cnt_rango||null); // por defecto solo hoy
}

function renderConteo(r){
  if(_handleExpired(r,'conteo-root')) return;
  if(!r||!r.ok){errBox('conteo-root',r?r.error:'Respuesta inválida del servidor');return;}
  DATA.conteo=r.data;
  var totalUnd=r.data.reduce(function(a,x){return a+x.total;},0);
  var skusU=[];
  r.data.forEach(function(x){if(skusU.indexOf(x.sku)<0)skusU.push(x.sku);});

  document.getElementById('conteo-root').innerHTML=
    '<div class="stats">'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg></div><div class="stat-label">Registros</div><div class="stat-val-row"><div class="stat-val" id="cnt-stat-total">'+r.data.length+'</div><span class="stat-unit-pill">filas</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-label">SKUs únicos</div><div class="stat-val-row"><div class="stat-val" id="cnt-stat-skus" style="color:var(--blue)">'+skusU.length+'</div><span class="stat-unit-pill">SKUs</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="stat-label">Unidades contadas</div><div class="stat-val-row"><div class="stat-val" id="cnt-stat-und" style="color:var(--ok)">'+fmt(totalUnd)+'</div><span class="stat-unit-pill">und.</span></div></div>'+
    '</div>'+
    '<div class="filters" style="flex-wrap:wrap;gap:8px;align-items:center">'+
      '<div style="display:flex;gap:6px;align-items:center">'+
        '<input class="filter-inp" id="cnt-busq" placeholder="Buscar SKU, EAN, producto..." style="width:220px" oninput="filterConteo()"/>'+
        '<button class="cam-btn" title="Escanear" onclick="openScannerConteoFiltro()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5a2 2 0 0 1 2-2h1v2H5v1H3V5z"/><path d="M19 5a2 2 0 0 0-2-2h-1v2h2v1h2V5z"/><path d="M3 19a2 2 0 0 0 2 2h1v-2H5v-1H3v1z"/><path d="M19 19a2 2 0 0 1-2 2h-1v-2h2v-1h2v1z"/><line x1="7" y1="12" x2="7" y2="12.01"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="13" y1="9" x2="13" y2="15"/><line x1="16" y1="9" x2="16" y2="15"/><line x1="7" y1="9" x2="7" y2="11"/></svg></button>'+
        '<button class="btn btn-danger btn-sm" id="btn-eliminar-ean-dia" style="display:none;white-space:nowrap" onclick="eliminarEANDia()">'+ICO('x',13)+'Eliminar EAN del día</button>'+
      '</div>'+
      _fechaFiltroHTML('cnt','filterConteo','cntRangoCambio')+
      '<span class="result-count" id="cnt-count"></span>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr>'+
        '<th>Fecha</th><th class="col-hide-mobile">Hora</th><th class="col-hide-mobile">EAN</th><th>SKU/Lovis</th><th>Producto</th>'+
        '<th class="r col-hide-mobile">PACKS</th><th class="r col-hide-mobile">x Mult.</th>'+
        '<th class="r col-hide-mobile">UND PACKS</th><th class="r col-hide-mobile">UNDS</th><th class="r">TOTAL</th><th class="c">Editar</th><th class="c">-</th>'+
      '</tr></thead>'+
      '<tbody id="conteo-tbody"></tbody>'+
    '</table></div>';
  _initFiltroFecha('cnt','filterConteo',{page:'conteo'});
  filterConteo();
}

function _filterConteo(){
  var q=((document.getElementById('cnt-busq')||{}).value||'').toLowerCase();
  var filtered=(DATA.conteo||[]).filter(function(r){
    return !q||r.sku.toLowerCase().indexOf(q)>-1||
           r.producto.toLowerCase().indexOf(q)>-1||
           r.ean.toLowerCase().indexOf(q)>-1;
  });
  filtered=_applyFiltroFecha('cnt',filtered);

  // Actualizar stat cards con los datos filtrados
  var totalUnd=filtered.reduce(function(a,x){return a+x.total;},0);
  var skusU=[];
  filtered.forEach(function(x){if(skusU.indexOf(x.sku)<0)skusU.push(x.sku);});
  var st=document.getElementById('cnt-stat-total'); if(st)st.textContent=filtered.length;
  var ss=document.getElementById('cnt-stat-skus');  if(ss)ss.textContent=skusU.length;
  var su=document.getElementById('cnt-stat-und');   if(su)su.textContent=fmt(totalUnd);

  var el=document.getElementById('cnt-count');
  if(el)el.textContent=filtered.length+' registros';

  // Mostrar/ocultar botón "Eliminar EAN del día" según si hay búsqueda activa
  var qTrim=((document.getElementById('cnt-busq')||{}).value||'').trim();
  var btnElimEAN=document.getElementById('btn-eliminar-ean-dia');
  if(btnElimEAN) btnElimEAN.style.display=qTrim?'inline-flex':'none';

  // Agrupar filas por SKU — badge de N conteos + total acumulado visible
  function _calcRow(r){
    var p=r.packs||0, u=r.und||r.total||0, m=1;
    if(p>0){ m=Math.round(u/p)||1; }
    else if(u>0){
      var sn=String(r.sku||'').toLowerCase();
      if(_MCONTEO_SKU_IDX&&_MCONTEO_SKU_IDX[sn]){m=Number(_MCONTEO_SKU_IDX[sn].multiplicador)||1;p=Math.round(u/m);}
      else{m=1;p=u;}
    }
    return {packsReal:p,undReal:u,mult:m};
  }
  var grupos = new Map(); // Map preserva orden de inserción + lookups O(1) sin colisiones de prototype
  // Índice global para evitar interpolación de strings en onclick
  window._CNT_ROWS = {};
  filtered.forEach(function(r){
    var c=_calcRow(r), key=r.sku||r.ean;
    if(!grupos.has(key)){
      grupos.set(key, {sku:r.sku,ean:r.ean,producto:r.producto,mult:c.mult,filas:[],totalUnd:0,totalPacks:0,totalUnds:0});
    }
    var g = grupos.get(key);
    g.filas.push({r:r,packsReal:c.packsReal,undReal:c.undReal,mult:c.mult});
    g.totalUnd+=c.undReal; g.totalPacks+=c.packsReal; g.totalUnds+=Number(r.unds||0);
    // Snapshot por fila para que editarConteoRowSafe lea desde aquí
    window._CNT_ROWS[r._row] = {r:r, packsReal:c.packsReal, mult:c.mult};
  });
  var tbodyParts = [];
  grupos.forEach(function(g, key){
    var n=g.filas.length, html='';
    var gid='cg-'+key.replace(/[^a-zA-Z0-9]/g,'_');
    var badge=n>1?'<span style="background:var(--accent);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px">'+n+'×</span>':'';
    var chevron=n>1?'<span id="chv-'+gid+'" style="margin-left:auto;font-size:11px;color:var(--text3);transition:transform .2s">'+ICO('right',12,'s')+'</span>':'';
    var cursor=n>1?'cursor:pointer;user-select:none;':''; 
    html+='<tr style="background:var(--surface2);border-top:2px solid var(--border2);'+cursor+'" '+(n>1?'onclick="_toggleGrupoConteo(\''+gid+'\')"':'')+'>' +
      '<td colspan="4" style="padding:8px 12px">'+
        '<div style="display:flex;align-items:center;gap:6px">'+badge+
          '<span class="mono" style="font-weight:700;font-size:13px;margin-left:'+(n>1?'6':'0')+'px">'+esc(g.sku)+'</span>'+
          '<span style="color:var(--text3);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(g.producto)+'</span>'+
          chevron+
        '</div>'+
      '</td>'+
      '<td class="r col-hide-mobile" style="font-weight:700;color:var(--accent)">'+fmt(g.totalPacks)+'</td>'+
      '<td class="r col-hide-mobile" style="color:var(--text3);font-size:11px">x'+g.mult+'</td>'+
      '<td class="r col-hide-mobile" style="font-weight:700">'+fmt(g.totalUnd)+'</td>'+
      '<td class="r col-hide-mobile" style="font-weight:700;color:var(--text2)">'+fmt(g.totalUnds||0)+'</td>'+
      '<td class="r" style="font-weight:700;font-size:15px;color:var(--ok)">'+fmt(g.totalUnd+(g.totalUnds||0))+'</td>'+
      '<td class="c" colspan="2"></td>'+
    '</tr>';
    // Filas individuales — ocultas por defecto si hay más de 1
    var display=n>1?'display:none':'display:table-row';
    g.filas.forEach(function(item){
      var r=item.r;
      html+='<tr class="cg-rows-'+gid+'" style="'+display+'">'+
        '<td class="mono" style="font-size:11px;color:var(--text3);padding-left:28px">'+esc(r.fecha)+'</td>'+
        '<td class="mono col-hide-mobile" style="font-size:11px;color:var(--text3)">'+esc(r.hora||'')+'</td>'+
        '<td class="mono col-hide-mobile" style="font-size:10px;color:var(--text3)">'+esc(r.ean)+'</td>'+
        '<td class="mono" style="color:var(--text3);font-size:12px">'+esc(r.sku)+'</td>'+
        '<td class="td-desc" style="color:var(--text3);font-size:12px">'+esc(r.producto)+'</td>'+
        '<td class="r col-hide-mobile" style="font-size:15px;font-weight:600">'+fmt(item.packsReal)+'</td>'+
        '<td class="r col-hide-mobile" style="color:var(--text3)">x'+item.mult+'</td>'+
        '<td class="r col-hide-mobile">'+fmt(item.undReal)+'</td>'+
        '<td class="r col-hide-mobile" style="color:var(--text2)">'+fmt(r.unds||0)+'</td>'+
        '<td class="r" style="color:var(--ok)">'+fmt(r.total)+'</td>'+
        '<td class="c"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editarConteoRowSafe('+r._row+')">Editar</button></td>'+
        '<td class="c"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();eliminarConteoRow('+r._row+')">'+ICO('x',14,'s')+'</button></td>'+
      '</tr>';
    });
    tbodyParts.push(html);
  });
  var tbody = tbodyParts.join('');
  var t=document.getElementById('conteo-tbody');
  if(t)t.innerHTML=tbody||'<tr><td colspan="12" style="text-align:center;color:var(--text3);padding:40px">Sin registros</td></tr>';
}

// Wrapper seguro — evita interpolar strings dentro del onclick (los SKUs con comillas rompían el handler)
function editarConteoRowSafe(rowNum){
  var snap = (window._CNT_ROWS||{})[rowNum];
  if(!snap){ showToast('Recarga la página — datos desactualizados.','err'); return; }
  var r = snap.r;
  editarConteoRow(rowNum, snap.packsReal, r.unds||0, r.sku||'', r.ean||'', r.producto||'', snap.mult);
}

function _toggleGrupoConteo(gid){
  var rows=document.querySelectorAll('.cg-rows-'+gid);
  var chv=document.getElementById('chv-'+gid);
  if(!rows.length) return;
  var abierto=rows[0].style.display!=='none';
  rows.forEach(function(tr){ tr.style.display=abierto?'none':'table-row'; });
  if(chv) chv.style.transform=abierto?'':'rotate(90deg)';
}

function eliminarConteoRow(rowNum){
  _confirmDialog('Eliminar registro', 'Se eliminará esta fila del conteo. Esta acción no se puede deshacer.', function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!r.ok){showToast(r.error,'err');return;}
        showToast('Eliminado','ok');
        reloadPage('conteo');
      })
      .withFailureHandler(function(e){showToast(e.message,'err');})
      .eliminarConteo(S.token,rowNum);
  }, 'Eliminar');
}

// ── EDITAR FILA DE CONTEO ──
var _CNT_EDIT_ROW = null;
function editarConteoRow(rowNum, packs, unds, sku, ean, producto, mult){
  _CNT_EDIT_ROW = rowNum;
  // Cargar datos en el form de conteo y abrirlo
  openFS('fs-conteo');
  // Esperar a que el form esté visible, luego poblar
  setTimeout(function(){
    // Reset parcial — no llamar limpiarFormConteo() porque resetea cnt-packs
    clearTimeout(_eanTimer);
    document.getElementById('cnt-ean').value='';
    document.getElementById('cnt-err').textContent='';
    document.getElementById('cnt-ean-status').textContent='';
    document.getElementById('cnt-producto-card').style.display='none';
    document.getElementById('cnt-manual-wrap').style.display='none';
    document.getElementById('cnt-total-display').textContent='0';
    _cnt = {ean:ean, sku:sku, sap:'', producto:producto, multiplicador:mult, _stock:null, _editRow:rowNum};
    // Cargar stock desde DATA.stock o MCONTEO
    if(DATA && DATA.stock && DATA.stock.length){
      var skuNorm=String(sku).trim().toLowerCase();
      for(var i=0;i<DATA.stock.length;i++){
        if(String(DATA.stock[i].sku||'').trim().toLowerCase()===skuNorm){
          _cnt._stock=Number(DATA.stock[i].stock||0); break;
        }
      }
    }
    document.getElementById('cnt-sku').value=sku;
    document.getElementById('cnt-producto-h').value=producto;
    document.getElementById('cnt-producto-nombre').textContent=producto;
    document.getElementById('cnt-sku-display').textContent=sku;
    var multUnd=document.getElementById('cnt-mult-und');if(multUnd)multUnd.textContent=mult;
    // NO setear cnt-ean via .value directo — dispararía autoResolverEAN y borraría packs
    // El ean ya está en _cnt.ean; lo ponemos sin disparar eventos
    var eanEl=document.getElementById('cnt-ean');
    if(eanEl){ eanEl.value=ean; }
    document.getElementById('cnt-mult').value=mult;
    document.getElementById('cnt-producto-card').style.display='block';
    // Cambiar título del botón guardar para indicar edición
    var btn=document.getElementById('btn-guardar-siguiente');
    if(btn){ btn.innerHTML=ICO('check',14)+'Guardar cambios'; }
    // Setear packs en último lugar y disparar calcTotal — evita que limpiarFormConteo lo pise
    var packsEl=document.getElementById('cnt-packs');
    if(packsEl){ packsEl.value=Number(packs)||0; }
    var sueltasEl=document.getElementById('cnt-und-sueltas');
    if(sueltasEl){ sueltasEl.value=Number(unds)||0; }
    calcTotalConteo();
    _cntVista();
    if(packsEl){ packsEl.focus(); packsEl.select(); }
  }, 150);
}

// ── ELIMINAR TODOS LOS REGISTROS DE UN EAN/SKU/TÉRMINO DEL DÍA ──
function eliminarEANDia(){
  var q=((document.getElementById('cnt-busq')||{}).value||'').trim();
  if(!q){ showToast('Escribe un EAN, SKU o nombre en el buscador primero','warn'); return; }
  var hoy=new Date();
  var hoyStr=String(hoy.getDate()).padStart(2,'0')+'/'+String(hoy.getMonth()+1).padStart(2,'0')+'/'+hoy.getFullYear();
  var matches=(DATA.conteo||[]).filter(function(r){
    var qL=q.toLowerCase();
    return r.fecha===hoyStr && (
      r.sku.toLowerCase().indexOf(qL)>-1 ||
      r.ean.toLowerCase().indexOf(qL)>-1 ||
      r.producto.toLowerCase().indexOf(qL)>-1
    );
  });
  if(!matches.length){ showToast('No hay registros de HOY que coincidan con "'+q+'" — verificá el filtro de fecha','warn'); return; }
  var totalUndElim=matches.reduce(function(a,r){return a+(Number(r.total)||Number(r.und)||0);},0);
  _confirmDialog(
    'Eliminar '+matches.length+' registro(s) de hoy',
    '"'+q+'" · '+matches.length+' conteo(s) · '+totalUndElim+' und. en total | Fecha: '+hoyStr+' | Esta acción no se puede deshacer.',
    function(){
      var rows=matches.map(function(r){return r._row;});
      // Una sola llamada batch en vez de N requests
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){ showToast('Error: '+r.error,'err'); return; }
          showToast('Eliminados '+r.eliminados+' registros','ok');
          reloadConteoForce();
        })
        .withFailureHandler(function(e){
          showToast('Error: '+e.message,'err');
          reloadConteoForce();
        })
        .eliminarConteoMultiple(S.token, rows);
    },
    'Eliminar '+matches.length+' registro(s)'
  );
}

// ── ACTUALIZAR CONTEO FORZANDO REFRESCO DE CACHÉ EN SERVIDOR ──
function exportConteo(){
  if(S&&S.rol!=='store'){
    var HDR=['Fecha','Hora','EAN','SKU / Lovis','Producto','Packs','UND Packs','UNDS','Total','Ubicación'];
    var CW=[{wch:12},{wch:8},{wch:16},{wch:14},{wch:40},{wch:8},{wch:10},{wch:8},{wch:10},{wch:16}];
    _exportConSpinner('btn-export-conteo','conteo',function(sedes){
      _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:HDR,rows:s.data,colWidths:CW,
        mapFn:function(r){return[r.fecha,r.hora||'',r.ean,r.sku,r.producto,r.packs||0,r.und||0,r.unds||0,r.total,r.ubicacion||''];}};}),'conteo_sedes');
    });return;
  }
  var rows = DATA.conteo || [];
  var q=((document.getElementById('cnt-busq')||{}).value||'').toLowerCase();
  rows = rows.filter(function(r){
    return !q || r.sku.toLowerCase().indexOf(q)>-1 ||
           r.producto.toLowerCase().indexOf(q)>-1 || r.ean.toLowerCase().indexOf(q)>-1;
  });
  rows = _applyFiltroFecha('cnt', rows);
  if(!rows.length){ showToast('No hay datos para exportar','err'); return; }
  var data = rows.map(function(r){
    var packsReal = r.packs || 0;
    var undReal   = r.und || r.total || 0;
    var mult = 1;
    if(packsReal > 0){ mult = Math.round(undReal/packsReal)||1; }
    else if(undReal > 0 && _MCONTEO_SKU_IDX){
      var sn = String(r.sku||'').toLowerCase();
      if(_MCONTEO_SKU_IDX[sn]){ mult=Number(_MCONTEO_SKU_IDX[sn].multiplicador)||1; packsReal=Math.round(undReal/mult); }
      else { packsReal=undReal; }
    }
    return {'Fecha':r.fecha,'Hora':r.hora||'','EAN':r.ean,'SKU / Lovis':r.sku,'Producto':r.producto,
      'Packs':packsReal,'Multiplicador':mult,'UND Packs':undReal,'UNDS':r.unds||0,'Total':r.total,'Ubicación':r.ubicacion||''};
  });
  var ws = XLSX.utils.json_to_sheet(data);
  ws['!cols']=[{wch:12},{wch:8},{wch:16},{wch:14},{wch:40},{wch:8},{wch:13},{wch:10},{wch:8},{wch:10},{wch:16}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conteo');
  XLSX.writeFile(wb, 'conteo_'+_hoyISO()+'.xlsx');
  showToast('Exportado '+rows.length+' registros','ok');
}

function _cerrarFormConteo(){
  var packs = Number((document.getElementById('cnt-packs')||{}).value||0);
  var tieneDatos = packs > 0 || (_cnt && _cnt.sku);
  if(tieneDatos && _conteoBuffer.length === 0){
    // Solo pedir confirmación si no hay nada guardado aún en el buffer
    _confirmDialog(
      '¿Salir sin guardar?',
      'Tenés datos sin guardar en el formulario. Si salís ahora se perderán.',
      function(){ limpiarFormConteo(); closeFS('fs-conteo'); },
      'Salir sin guardar'
    );
    return;
  }
  if(tieneDatos && _conteoBuffer.length > 0){
    _confirmDialog(
      '¿Cerrar el formulario?',
      'El formulario se cerrará. Los '+_conteoBuffer.length+' registro(s) del historial ya están guardados.',
      function(){ limpiarFormConteo(); closeFS('fs-conteo'); },
      'Cerrar'
    );
    return;
  }
  limpiarFormConteo();
  closeFS('fs-conteo');
}

function reloadConteoForce(){
  // Limpiar caché local
  _MCONTEO_LOCAL=null; _MCONTEO_PENDING=[]; _MCONTEO_EAN_IDX={}; _MCONTEO_SKU_IDX={};
  DATA.conteo=[];
  PAGE_LOADED['conteo']=false;
  PAGE_LOADING['conteo']=true;
  _FORCE_REFRESH['conteo']=true; // bypass caché del servidor
  var root=document.getElementById('conteo-root');
  if(root) root.innerHTML=LD('Actualizando conteo');
  loadConteo();
}

// ── SCANNER PARA EL FILTRO DE CONTEO ──
function openScannerConteoFiltro(){
  _scannerTarget = {skuId:'cnt-busq', descId:null, marcaId:null, conteoMode:false, filtroMode:true};
  _abrirPopupScanner('cnt-busq', 'Escanea el EAN o SKU a buscar');
}

function limpiarFormConteo(){
  clearTimeout(_eanTimer);
  _cnt={ean:'',sku:'',sap:'',producto:'',multiplicador:1,_stock:null,_editRow:null};
  _CNT_EDIT_ROW = null;
  ['cnt-ean','cnt-packs','cnt-und-sueltas','cnt-sku','cnt-sap','cnt-mult','cnt-producto-h'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('cnt-err').textContent='';
  document.getElementById('cnt-ean-status').textContent='';
  document.getElementById('cnt-producto-card').style.display='none';
  document.getElementById('cnt-manual-wrap').style.display='none';
  document.getElementById('cnt-total-display').textContent='0';
  _cntListo(0);
  _cntVista();
}

var _eanTimer = null;
function autoResolverEAN(){
  clearTimeout(_eanTimer);
  var ean = document.getElementById('cnt-ean').value.trim();
  if(!ean || ean.length < 8) return;
  _eanTimer = setTimeout(function(){
    if(!_cnt.sku) resolverEAN();
  }, 120);
}

function resolverEAN(){
  clearTimeout(_eanTimer);
  var ean = document.getElementById('cnt-ean').value.trim();
  if (!ean) return;
  var st = document.getElementById('cnt-ean-status');

  // Normalizar EAN (notación científica o .0)
  var normEAN = /[eE]/.test(ean) ? Math.round(Number(ean)).toString() : ean.replace(/\.0+$/, '');

  function _buscarLocal() {
    var found = _MCONTEO_EAN_IDX[normEAN];
    if (!found) {
      st.textContent = 'No encontrado: EAN ' + normEAN + ' no está en MCONTEO';
      st.style.color = 'var(--danger)';
      document.getElementById('cnt-manual-wrap').style.display = 'block';
      _cntCamNoEncontrado();
      return;
    }
    st.textContent = '';
    setProductoConteo(found.ean, found.sku, found.sap || '', found.producto, found.multiplicador, found.stock);
    document.getElementById('cnt-packs').focus();
  }

  if (_MCONTEO_LOCAL) {
    // Resolución instantánea desde caché local — sin llamada al servidor
    _buscarLocal();
  } else {
    st.style.color = 'var(--text3)'; st.textContent = 'Cargando catálogo...';
    _cargarMConteo(function() {
      if (_MCONTEO_LOCAL) { _buscarLocal(); }
      else {
        // Fallback al servidor si la carga falló
        st.textContent = 'Buscando en servidor...';
        google.script.run
          .withSuccessHandler(function(r) {
            if (!r.ok) { st.textContent = 'No encontrado: ' + r.error; st.style.color = 'var(--danger)'; document.getElementById('cnt-manual-wrap').style.display = 'block'; _cntCamNoEncontrado(); return; }
            st.textContent = '';
            setProductoConteo(r.ean, r.sku, r.sap || '', r.producto, r.multiplicador, r.stock);
            document.getElementById('cnt-packs').focus();
          })
          .withFailureHandler(function(e) { st.textContent = 'Error: ' + e.message; st.style.color = 'var(--danger)'; })
          .buscarEAN(S.token, ean);
      }
    });
  }
}

function setProductoConteo(ean,sku,sap,producto,multiplicador,stock){
  var mult=Number(multiplicador)||1;
  var stockVal=(stock!==undefined&&stock!==null&&stock!=='') ? Number(stock) : null;
  // Fallback: si MCONTEO no trajo stock (cache vieja de GAS), buscar en DATA.stock ya cargado
  if(stockVal===null && sku && DATA && DATA.stock && DATA.stock.length){
    var skuNorm=String(sku).trim().toLowerCase();
    for(var _si=0;_si<DATA.stock.length;_si++){
      if(String(DATA.stock[_si].sku||'').trim().toLowerCase()===skuNorm){
        stockVal=Number(DATA.stock[_si].stock||0);
        break;
      }
    }
  }
  var editRowPrev = _cnt._editRow || null; // preservar antes de reasignar
  _cnt={ean:ean,sku:sku,sap:sap,producto:producto,multiplicador:mult,_stock:stockVal,_editRow:editRowPrev};
  document.getElementById('cnt-sku').value=sku;
  document.getElementById('cnt-sap').value=sap;
  document.getElementById('cnt-mult').value=mult;
  document.getElementById('cnt-producto-h').value=producto;
  document.getElementById('cnt-producto-nombre').textContent=producto;
  document.getElementById('cnt-sku-display').textContent=sku;
  var multUnd=document.getElementById('cnt-mult-und');if(multUnd)multUnd.textContent=mult;
  document.getElementById('cnt-producto-card').style.display='block';
  document.getElementById('cnt-manual-wrap').style.display='none';
  // Resetear packs solo si NO es una edición en curso
  if(!_cnt._editRow){ document.getElementById('cnt-packs').value=''; }
  calcTotalConteo();
  _cntVista();
}

function limpiarProductoConteo(){
  _cnt={ean:'',sku:'',sap:'',producto:'',multiplicador:1,_stock:null};
  ['cnt-ean','cnt-sku','cnt-sap','cnt-mult','cnt-producto-h'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('cnt-producto-card').style.display='none';
  document.getElementById('cnt-ean-status').textContent='';
  document.getElementById('cnt-packs').value='';
  document.getElementById('cnt-und-sueltas').value='';
  document.getElementById('cnt-total-display').textContent='0';
  _cntListo(0);
  var bar=document.getElementById('cnt-progress-bar');
  if(bar){bar.style.width='0%';}
  var label=document.getElementById('cnt-progress-label');
  if(label){label.textContent='— / — und.';}
  var hint=document.getElementById('cnt-progress-hint');
  if(hint){hint.textContent='';}
  _cntVista();
}

// Wrapper delgado — delega en acSearch con handler de selección propio (acSelectConteo)
function acSearchConteo(){
  var inp=document.getElementById('cnt-sku-manual');
  if(!inp)return;
  // Reutiliza acSearch: listId='ac-cnt', onSelectFn='acSelectConteo'
  acSearch('cnt-sku-manual', null, null, 'ac-cnt', 'acSelectConteo');
}

function acSelectConteo(idx){
  var item=(AC_CACHE['ac-cnt']||[])[idx];
  if(!item)return;
  document.getElementById('ac-cnt').classList.remove('open');
  var st=document.getElementById('cnt-ean-status');

  function _resolverLocal() {
    var found = _MCONTEO_SKU_IDX[item.sku.toLowerCase()];
    if (found) {
      st.textContent = '';
      setProductoConteo(found.ean, found.sku, found.sap || '', found.producto, found.multiplicador, found.stock);
    } else {
      setProductoConteo('', item.sku, '', item.desc, 1, null);
      st.textContent = 'Multiplicador no encontrado en MCONTEO, usando x1';
      st.style.color = 'var(--warn)';
    }
  }

  if (_MCONTEO_LOCAL) {
    _resolverLocal();
  } else {
    st.style.color = 'var(--text3)'; st.textContent = 'Buscando multiplicador...';
    _cargarMConteo(function() {
      if (_MCONTEO_LOCAL) { _resolverLocal(); }
      else {
        // Fallback al servidor
        google.script.run
          .withSuccessHandler(function(r) {
            st.textContent = '';
            if (r.ok) { setProductoConteo(r.ean, r.sku, r.sap || '', r.producto, r.multiplicador, r.stock); }
            else { setProductoConteo('', item.sku, '', item.desc, 1, null); st.textContent = 'Multiplicador no encontrado, usando x1'; st.style.color = 'var(--warn)'; }
          })
          .withFailureHandler(function() { st.textContent = ''; setProductoConteo('', item.sku, '', item.desc, 1, null); })
          .buscarSKUConteo(S.token, item.sku);
      }
    });
  }
}

// El botón de guardar se pone de color cuando hay producto y cantidad
function _cntListo(total){
  var b=document.getElementById('btn-guardar-siguiente');
  if(b) b.classList.toggle('listo', !!(_cnt&&_cnt.sku)&&total>0);
  var t=document.getElementById('cnt-total-display');
  if(t) t.style.color=total>0?'#C9BEF7':'';
}

function calcTotalConteo(){
  var packs=Number(document.getElementById('cnt-packs').value||0);
  var sueltas=Number(document.getElementById('cnt-und-sueltas').value||0);
  var mult=_cnt.multiplicador||1;
  var total=packs*mult+sueltas;
  document.getElementById('cnt-total-display').textContent=total;
  _cntListo(total);

  // Progress bar vs stock — sumar conteos previos del mismo SKU en el buffer
  var stock=_cnt._stock;
  var bar=document.getElementById('cnt-progress-bar');
  var label=document.getElementById('cnt-progress-label');
  var hint=document.getElementById('cnt-progress-hint');
  if(bar&&label&&hint){
    if(stock==null||stock===undefined||stock===''){
      label.textContent='— / — und.';
      bar.style.width='0%';
      bar.style.background='var(--text4)';
      hint.textContent='';
    } else {
      var stockNum=Number(stock)||0;
      // Sumar conteos previos del mismo SKU: buffer local + registros del servidor de hoy
      var prevUnd=0;
      var skuNorm=String(_cnt.sku||'').trim();
      // 1. Buffer local (mismo dispositivo, aún no guardados)
      if(skuNorm && _conteoBuffer && _conteoBuffer.length){
        _conteoBuffer.forEach(function(b){
          if(String(b.sku||'').trim()===skuNorm) prevUnd+=Number(b.total||b.und||0);
        });
      }
      // 2. DATA.conteo del servidor — registros ya guardados hoy (cualquier dispositivo)
      if(skuNorm && DATA && DATA.conteo && DATA.conteo.length){
        var hoy=new Date();
        var hoyStr=String(hoy.getDate()).padStart(2,'0')+'/'+String(hoy.getMonth()+1).padStart(2,'0')+'/'+hoy.getFullYear();
        var editRowNum=_cnt._editRow||null;
        DATA.conteo.forEach(function(c){
          if(String(c.sku||'').trim()===skuNorm && String(c.fecha||'').trim()===hoyStr){
            // Excluir la fila que se está editando para no duplicar su conteo
            if(editRowNum && c._row===editRowNum) return;
            // Evitar doble conteo si este registro ya está reflejado en el buffer local
            var yaEnBuffer=_conteoBuffer.some(function(b){ return b._row && b._row===c._row; });
            if(!yaEnBuffer) prevUnd+=Number(c.total||c.und||0);
          }
        });
      }
      var totalAcum=prevUnd+total;
      var labelPrev=prevUnd>0?' (+'+prevUnd+' prev)':'';
      label.textContent=totalAcum+' / '+stockNum+' und.'+labelPrev;
      var pct=stockNum>0?Math.min(Math.round(totalAcum/stockNum*100),100):100;
      bar.style.width=pct+'%';
      if(pct>=100){
        bar.style.background='var(--ok)';
        hint.style.color='var(--ok)';
        hint.innerHTML=ICO('check',13)+'Stock cubierto'+(totalAcum>stockNum?' (+'+( totalAcum-stockNum)+' extra)':'');
      } else if(pct>=60){
        bar.style.background='var(--warn)';
        hint.style.color='var(--warn)';
        hint.textContent='Faltan '+(stockNum-totalAcum)+' und. para cubrir stock';
      } else {
        bar.style.background='var(--danger)';
        hint.style.color='var(--danger)';
        hint.textContent='Faltan '+(stockNum-totalAcum)+' und. para cubrir stock';
      }
    }
  }
}
// Buffer local de conteo y persistencia
// (declarado aquí abajo — las funciones de conteo lo usan después de carga)

function saveConteoBuffer() {
  // FIX: aplicar cutoff de 24h también al guardar (no solo al cargar) y
  // proteger contra QuotaExceededError de iOS (límite ~5MB de localStorage).
  // Si falla, advertir al usuario para que sincronice antes de seguir.
  var cutoff = Date.now() - 24 * 60 * 60 * 1000;
  _conteoBuffer = (_conteoBuffer || []).filter(function(it){ return !it._ts || it._ts > cutoff; });
  try {
    localStorage.setItem(CACHE_CONTEO_KEY, JSON.stringify(_conteoBuffer));
  } catch(e) {
    // QuotaExceededError, SecurityError (Safari incognito), etc.
    console.error('[saveConteoBuffer] localStorage falló:', e.message);
    showToast('No se pudo guardar localmente. Sincroniza pronto.', 'err');
  }
  renderConteoHistory();
  _actualizarBannerPendientes(); // sincronizar badge del banner offline
}

function loadConteoBuffer() {
  try {
    var stored = localStorage.getItem(CACHE_CONTEO_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      var cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 horas
      _conteoBuffer = parsed.filter(function(item) {
        // Compatibilidad: ítems sin timestamp se conservan una vez más
        return !item._ts || item._ts > cutoff;
      });
      // Si se limpió alguno, persistir el estado actualizado
      if (_conteoBuffer.length !== parsed.length) {
        try { localStorage.setItem(CACHE_CONTEO_KEY, JSON.stringify(_conteoBuffer)); } catch(e) {}
      }
    } else {
      _conteoBuffer = [];
    }
  } catch(e) { _conteoBuffer = []; }
  renderConteoHistory();
}

function clearConteoBuffer() {
  _conteoBuffer = [];
  localStorage.removeItem(CACHE_CONTEO_KEY);
  renderConteoHistory();
}

var _renderConteoHistoryTimer = null;
function renderConteoHistory() {
  // Diferir el render para evitar re-pintados en cascada cuando se acumulan varios pushes
  clearTimeout(_renderConteoHistoryTimer);
  _renderConteoHistoryTimer = setTimeout(_renderConteoHistoryNow, 50);
}
function _renderConteoHistoryNow() {
  var container = document.getElementById('cnt-history-container');
  var list = document.getElementById('cnt-history-list');
  var badge = document.getElementById('cnt-history-badge');
  
  // Sincronizar el badge mini (si aún lo usaras)
  _actualizarContadorBuffer();

  // Historial reciente de ESTE equipo (últimas 24 h), del más nuevo al más antiguo.
  // Los conteos que aún no llegaron al servidor (sin _row) se marcan y permiten editar o quitar.
  var items = _conteoBuffer || [];
  if (items.length === 0) {
    container.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  badge.textContent = items.length;

  var html = '';
  for (var i = items.length - 1; i >= 0; i--) {
    var item = items[i];
    var packs = Number(item.packs) || 0, sueltas = Number(item.sueltas) || 0;
    var desc = (packs ? packs + (packs === 1 ? ' pack' : ' packs') : '') +
               (packs && sueltas ? ' + ' : '') +
               (sueltas ? sueltas + (sueltas === 1 ? ' suelta' : ' sueltas') : '');
    var hora = item._ts ? new Date(item._ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    var pend = !item._row;
    html += '<div class="cnt-h">' +
      '<div class="cnt-h-main">' +
        '<div class="cnt-h-n" title="' + esc(item.producto) + '">' + esc(item.producto) + '</div>' +
        '<div class="cnt-h-s">' + esc(hora) + (hora && desc ? ' · ' : '') + esc(desc) + (pend ? ' · <span class="pend">Sin enviar</span>' : '') + '</div>' +
      '</div>' +
      (pend ? '<div class="cnt-h-b"><button onclick="editBufferItem(' + i + ')">Editar</button><button onclick="deleteBufferItem(' + i + ')" aria-label="Quitar">'+ICO('x',14,'s')+'</button></div>' : '') +
      '<div class="cnt-h-t">' + (Number(item.total) || 0) + '<small>und.</small></div>' +
    '</div>';
  }
  list.innerHTML = html;
}

function editBufferItem(idx) {
  var item = _conteoBuffer[idx];
  if (!item) return;

  // 1. Quitarlo del historial (para que lo vuelvan a agregar modificado)
  _conteoBuffer.splice(idx, 1);
  saveConteoBuffer();

  // 2. Cargarlo en el formulario activo — guardar _editRow para que el servidor sobreescriba esa fila
  _cnt._editRow = item._row || null;
  setProductoConteo(item.ean, item.sku, item.sap, item.producto, item.multiplicador);
  document.getElementById('cnt-packs').value = item.packs;
  document.getElementById('cnt-und-sueltas').value = item.sueltas || '';
  calcTotalConteo();

  // 3. Subir el scroll hasta arriba
  document.querySelector('#fs-conteo .fs-body').scrollTop = 0;
  showToast('Cargado para editar. Al terminar presiona Siguiente.', 'info');
}


function abrirConteo(){
  // Recuperar lo guardado en caché para no perder si se recargó la app
  loadConteoBuffer();
  limpiarFormConteo();
  openFS('fs-conteo');
  // Siempre recargar MCONTEO al abrir — garantiza códigos actualizados
  _MCONTEO_LOCAL=null; _MCONTEO_PENDING=[]; _MCONTEO_EAN_IDX={}; _MCONTEO_SKU_IDX={};
  var st = document.getElementById('cnt-ean-status');
  if (st) { st.style.color = 'var(--text3)'; st.textContent = 'Cargando catálogo de productos...'; }
  _cntCam.error = false;
  _cntCamNegro(null);
  // La cámara arranca de inmediato (no espera al catálogo); el catálogo solo hace falta al detectar un código
  setTimeout(_cntVista, 60);
  _cargarMConteo(function() {
    var st2 = document.getElementById('cnt-ean-status');
    if (st2 && st2.textContent === 'Cargando catálogo de productos...') st2.textContent = '';
  }, true);
}

function _actualizarContadorBuffer(){
  var badge = document.getElementById('cnt-buffer-badge');
  if(!badge) return;
  if(_conteoBuffer.length === 0){
    badge.style.display='none';
  } else {
    badge.style.display='inline-block';
    badge.textContent = _conteoBuffer.length + ' en cola';
  }
}



// Agrega o reemplaza (por _row) una fila de conteo en la tabla local: editar no debe duplicar el registro
function _conteoUpsertLocal(row){
  if(!DATA.conteo) DATA.conteo=[];
  var i=-1;
  if(row && row._row!=null){
    for(var k=0;k<DATA.conteo.length;k++){ if(DATA.conteo[k]._row===row._row){ i=k; break; } }
  }
  if(i>=0) DATA.conteo[i]=row; else DATA.conteo.push(row);
}

function guardarYContinuar(){
  var sku=_cnt.sku;
  var packs=Number(document.getElementById('cnt-packs').value||0);
  var sueltas=Number(document.getElementById('cnt-und-sueltas').value||0);
  var mult=_cnt.multiplicador||1;
  var und=packs*mult+sueltas;
  var err=document.getElementById('cnt-err');

  if(!sku){err.textContent='Escanea un EAN o busca el SKU';document.getElementById('cnt-ean').focus();return;}
  if(packs<=0&&sueltas<=0){err.textContent='Ingresa packs o unidades sueltas';document.getElementById('cnt-packs').focus();return;}

  err.textContent='';

  var btn = document.getElementById('btn-guardar-siguiente');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  var fila = {ean:_cnt.ean||'',sku:sku,sap:_cnt.sap||'',producto:_cnt.producto||'',
      packs:packs,und:und,sueltas:sueltas,multiplicador:mult,total:und,ubicacion:'',
      _editRow:_cnt._editRow||null,
      _uid: _cnt._editRow ? '' : _genUID()};
  _cnt._editRow = null; // limpiar para el siguiente escaneo

  // Enviar inmediatamente al servidor
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled = false;
      btn.textContent = 'Guardar y escanear siguiente';
      if(!r.ok){
        if(r.retryable){
          // Falla transitoria (ej. otro usuario contando a la vez) — no se pierde el
          // dato: se encola como pendiente y se reintenta solo en unos segundos.
          showToast(r.error+' Se reintentará automáticamente.','warn');
          _conteoBuffer.push(Object.assign({}, fila, { _ts: Date.now() }));
          saveConteoBuffer();
          _actualizarBannerPendientes();
          _CNT_EDIT_ROW = null;
          var btnR=document.getElementById('btn-guardar-siguiente');
          if(btnR) btnR.textContent='Guardar y escanear siguiente';
          limpiarFormConteo();
          setTimeout(_intentarSyncOffline, 3000);
          setTimeout(function() { openScannerConteo(); }, 400);
        } else {
          showToast(r.error,'err');
        }
        return;
      }

      // Agregar al historial — sin deduplicar por SKU (cada escaneo es un registro independiente)
      // Si fue una edición, la fila ya existe en el historial: se reemplaza, no se agrega otra
      var itemHistorial = Object.assign({}, fila, { _ts: Date.now(), _row: r.inserted[0]._row });
      _conteoBuffer = _conteoBuffer.filter(function(b){ return !(b._row && b._row === itemHistorial._row); });
      _conteoBuffer.push(itemHistorial);
      saveConteoBuffer();

      showToast('Guardado: ' + packs + ' packs de ' + sku, 'ok');
      _CNT_EDIT_ROW = null;
      var btn2=document.getElementById('btn-guardar-siguiente');
      if(btn2) btn2.textContent='Guardar y escanear siguiente';

      // Agregar a tabla principal local — sin deduplicar
      _conteoUpsertLocal(r.inserted[0]);
      if(typeof filterConteo==='function') filterConteo();
      _updateConteoStats();

      // Preparar para el siguiente
      limpiarFormConteo();
      setTimeout(function() { openScannerConteo(); }, 400);
    })
    .withFailureHandler(function(e){
      // Fallback offline si el internet falla justo al guardar
      btn.disabled = false;
      btn.textContent = 'Guardar y escanear siguiente';
      showToast('Sin red. Guardado en historial, se sincronizará luego.', 'warn');
      _CNT_EDIT_ROW = null;
      var btn2=document.getElementById('btn-guardar-siguiente');
      if(btn2) btn2.textContent='Guardar y escanear siguiente';
      
      _conteoBuffer.push(Object.assign({}, fila, { _ts: Date.now() }));
      saveConteoBuffer();
      _actualizarBannerPendientes();
      
      limpiarFormConteo();
      setTimeout(function() { openScannerConteo(); }, 400);
    })
    .registrarConteo(S.token, [fila]);
}

// Actualización opcional: Hacer que la "X" del historial elimine directo del servidor
function deleteBufferItem(idx) {
  var item = _conteoBuffer[idx];
  if (!item) return;

  _confirmDialog('Eliminar registro', '¿Eliminar este conteo definitivamente?', function(){
    if (item._row) {
      google.script.run
        .withSuccessHandler(function(r){
           if(r.ok) {
             _conteoBuffer.splice(idx, 1);
             saveConteoBuffer();
             reloadPage('conteo');
             showToast('Eliminado', 'ok');
           } else {
             showToast('Error al eliminar: '+(r.error||'Error desconocido'),'err');
           }
        })
        .withFailureHandler(function(e){ showToast('Error de red: '+e.message,'err'); })
        .eliminarConteo(S.token, item._row);
    } else {
      _conteoBuffer.splice(idx, 1);
      saveConteoBuffer();
      _actualizarBannerPendientes();
    }
  }, 'Eliminar');
}

// Inicializar debounced filters aquí — todas las funciones _filterXxx ya están definidas
filterStock      = _debounce(_filterStock,      150);
filterSalidas    = _debounce(_filterSalidas,    150);
filterEntradas   = _debounce(_filterEntradas,   150);
filterMT         = _debounce(_filterMT,         150);
filterCancelados = _debounce(_filterCancelados, 150);
filterConteo     = _debounce(_filterConteo,     150);

/* ══════════════════════════════════════════════════════════════
   BACKUS+ · FACELIFT CONTROLLERS
   Loading, Tweaks, Command Palette, Mobile, Shortcuts, Sync
   ══════════════════════════════════════════════════════════════ */

/* ── LOADING SCREEN ── */
function showLoadingAndInit(restored){
  var login=document.getElementById('s-login');
  login.classList.remove('active');
  if(S && S.token){
    initApp();
  } else {
    clearSession();
    document.getElementById('s-login').classList.add('active');
  }
}

/* ── TOAST — definición única. tipos: 'ok'(3s) | 'warn'(5s) | 'err'(6s) | 'info'(3s) | 'err-crit'(manual) ── */
window.showToast = function(msg, type) {
  var t = document.getElementById('toast');
  var ico = {ok:ICO('check',15,'s'), err:ICO('x',15,'s'), warn:ICO('warn',15,'s'), info:ICO('info',15,'s'), 'err-crit':ICO('x',15,'s')}[type || 'info'] || ICO('info',15,'s');
  var cssType = type === 'err-crit' ? 'err' : (type || 'info');
  t.className = 'toast t-' + cssType;
  clearTimeout(t._timer);
  if (type === 'err-crit') {
    // Crítico: sin auto-dismiss, con botón de cierre manual
    t.innerHTML = '<span class="tico">' + ico + '</span><span>' + (msg || '') + '</span>' +
      ' <span onclick="this.parentElement.classList.remove(\'show\')" style="cursor:pointer;margin-left:8px;font-weight:700">'+ICO('x',13,'s')+'</span>';
  } else {
    var durations = {ok: 3000, warn: 5000, err: 6000, info: 3000};
    t.innerHTML = '<span class="tico">' + ico + '</span><span>' + (msg || '') + '</span>';
    t._timer = setTimeout(function() { t.classList.remove('show'); }, durations[type] || 3000);
  }
  t.classList.add('show');
};

/* ── PASSWORD TOGGLE ── */
function togglePwd(){
  var inp=document.getElementById('inp-p');
  var eye=document.getElementById('pwd-eye');
  if(inp.type==='password'){
    inp.type='text';
    eye.innerHTML='<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    inp.type='password';
    eye.innerHTML='<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

/* ── MOBILE MENU ── */
function toggleMobileMenu(force){
  var sb=document.getElementById('sidebar');
  var bd=document.getElementById('sb-backdrop');
  var open = typeof force==='boolean' ? force : !sb.classList.contains('mobile-open');
  sb.classList.toggle('mobile-open', open);
  bd.classList.toggle('show', open);
}
/* ── BOTÓN "ATRÁS" DEL CELULAR ──
   Sin esto, "atrás" sacaba al usuario de la app. Ahora: primero cierra lo que esté abierto
   (modal, formulario como Conteo, menú), luego vuelve a la pantalla inicial y solo sale con
   un segundo "atrás" seguido. */
var _backArmado = false, _backSalir = false, _backAviso = false;
function _backInicio(){ return (S.rol==='admin'||S.rol==='invitado') ? 'dashboard' : 'stock'; }
function _backArmar(){
  try{ history.pushState({tada:'app'}, '', location.href); }catch(e){}
}
function _backCapa(){
  var mods = Array.prototype.filter.call(document.querySelectorAll('[id^="modal-"]'), function(el){
    return el.style.position==='fixed' && el.style.display && el.style.display!=='none';
  });
  if(mods.length){
    mods.sort(function(a,b){ return (parseInt(b.style.zIndex,10)||0)-(parseInt(a.style.zIndex,10)||0); });
    return {tipo:'modal', el:mods[0]};
  }
  var dr = document.getElementById('stk-dr');
  if(dr && dr.classList.contains('on')) return {tipo:'stk'};
  var fs = document.querySelectorAll('.fscreen.open');
  if(fs.length) return {tipo:'fs', el:fs[fs.length-1]};
  var sb = document.getElementById('sidebar');
  if(sb && sb.classList.contains('mobile-open')) return {tipo:'menu'};
  return null;
}
function _backCerrarModal(el){
  var f = {'modal-confirm':'_confirmCancel','modal-input':'_modalInputCancel','modal-cancelar':'closeModalCancelar',
    'modal-anular-canc':'anularCancCerrar','modal-mov':'cerrarModalMov','modal-reemplazar-sku':'cerrarModalRSKU',
    'modal-editar-sku-fila':'cerrarModalESKU'}[el.id];
  if(f && typeof window[f]==='function') window[f]();
  if(el.style.display!=='none') el.style.display='none';
}
function _backPop(){
  if(_backSalir || !document.getElementById('s-app').classList.contains('active')){ return; }
  var capa = _backCapa();
  if(capa){
    if(capa.tipo==='modal') _backCerrarModal(capa.el);
    else if(capa.tipo==='stk') stkCerrar();
    else if(capa.tipo==='fs') closeFS(capa.el.id);
    else toggleMobileMenu(false);
    _backArmar(); return;
  }
  var home = _backInicio();
  if(CURRENT_PAGE && CURRENT_PAGE!==home){
    navTo(home, document.getElementById('nav-'+home));
    _backArmar(); return;
  }
  if(!_backAviso){
    _backAviso = true;
    showToast('Presiona atrás otra vez para salir','info');
    setTimeout(function(){ _backAviso=false; }, 2200);
    _backArmar(); return;
  }
  _backSalir = true;
  history.back();
}
function _backIniciar(){
  if(_backArmado) return;
  _backArmado = true;
  // Se arma con el primer toque: el navegador ignora las entradas de historial creadas sin interacción
  var armar = function(){
    document.removeEventListener('pointerdown', armar, true);
    document.removeEventListener('keydown', armar, true);
    try{ history.replaceState({tada:'base'}, '', location.href); }catch(e){}
    _backArmar();
    window.addEventListener('popstate', _backPop);
  };
  document.addEventListener('pointerdown', armar, true);
  document.addEventListener('keydown', armar, true);
}
function navToMobile(name){
  toggleMobileMenu(false);
  var btn=document.getElementById('nav-'+name);
  if(btn && typeof navTo==='function') navTo(name, btn);
  syncBottomNav(name);
}
function syncBottomNav(name){
  document.querySelectorAll('.bn-item').forEach(function(el){
    el.classList.toggle('active', el.dataset.nav===name);
  });
}

/* ── SYNC INDICATOR ── */
/* ══════════════════════════════════════
   MOTOR OFFLINE
   - _isOnline()         : estado real de conexión
   - _setOnlineState()   : actualiza UI (banner, sidebar dot)
   - _intentarSyncOffline(): envía buffer pendiente cuando vuelve la red
══════════════════════════════════════ */

var _onlineState = navigator.onLine !== false; // estado inicial

function _isOnline() {
  return navigator.onLine !== false;
}

function _setOnlineState(online) {
  _onlineState = online;
  var banner = document.getElementById('offline-banner');

  // Sidebar sync dot
  setSyncStatus(online);

  if (!online) {
    if (banner) banner.classList.add('show');
    _actualizarBannerPendientes();
  } else {
    if (banner) banner.classList.remove('show');
    // Al volver online: delegar en _intentarSyncOffline que ya valida buffer, sesión y conexión
    if (_conteoBuffer && _conteoBuffer.length > 0) {
      showToast('Conexión restaurada — sincronizando conteos pendientes...', 'ok');
      setTimeout(_intentarSyncOffline, 1200);
    } else {
      showToast('Conexión restaurada', 'ok');
    }
  }
}

function _actualizarBannerPendientes() {
  var pending = document.getElementById('ob-pending');
  var syncBtn = document.getElementById('ob-sync-btn');
  if (!pending || !syncBtn) return;
  var n = _conteoBuffer ? _conteoBuffer.length : 0;
  if (n > 0) {
    pending.textContent = n + ' en cola';
    pending.style.display = 'inline';
    syncBtn.style.display  = 'inline';
  } else {
    pending.style.display = 'none';
    syncBtn.style.display = 'none';
  }
}

var _syncInFlight = false;
function _intentarSyncOffline() {
  if (_syncInFlight) return; // evita disparos duplicados (reintento periódico + reconexión + botón manual)
  if (!_isOnline()) {
    showToast('Aún sin conexión. Los datos siguen guardados.', 'warn');
    return;
  }
  if (!_conteoBuffer || _conteoBuffer.length === 0) {
    showToast('No hay conteos pendientes por sincronizar.', 'info');
    return;
  }
  if (!S || !S.token) {
    showToast('Sesión no activa. Recarga la página.', 'err');
    return;
  }
  var btn = document.getElementById('ob-sync-btn');
  if (btn) { btn.textContent = 'Sincronizando...'; btn.disabled = true; }

  var batch = _conteoBuffer.filter(function(item){ return !item._row; });
  if(batch.length === 0){
    clearConteoBuffer();
    if(btn){ btn.textContent='Sincronizar ahora'; btn.disabled=false; }
    showToast('No hay conteos pendientes por sincronizar.','info');
    return;
  }
  _syncInFlight = true;
  google.script.run
    .withSuccessHandler(function(r) {
      _syncInFlight = false;
      if (btn) { btn.textContent = 'Sincronizar ahora'; btn.disabled = false; }
      if (!r || !r.ok) {
        showToast('Error al sincronizar: ' + (r ? r.error : 'sin respuesta'), 'err');
        return;
      }
      clearConteoBuffer();
      _actualizarBannerPendientes();
      showToast(r.registrados + ' conteo(s) sincronizado(s) correctamente', 'ok');
      // Actualizar tabla de conteo si está visible
      if (r.inserted && r.inserted.length) {
        if (!DATA.conteo) DATA.conteo = [];
        r.inserted.forEach(function(row) { _conteoUpsertLocal(row); });
        if (typeof filterConteo === 'function') filterConteo();
        _updateConteoStats();
      }
      // Marcar conteo como stale para que recargue al navegar
      PAGE_LOADED['conteo'] = false;
    })
    .withFailureHandler(function(e) {
      _syncInFlight = false;
      if (btn) { btn.textContent = 'Sincronizar ahora'; btn.disabled = false; }
      showToast('Error de red: ' + e.message, 'err');
    })
    .registrarConteo(S.token, batch);
}

function setSyncStatus(ok){
  var el=document.getElementById('sb-sync');
  var lb=document.getElementById('sb-sync-label');
  if(!el)return;
  if(ok){
    el.classList.remove('offline');
    lb.textContent='Sincronizado';
  } else {
    el.classList.add('offline');
    lb.textContent='Sin conexión';
  }
}

window.addEventListener('online',  function() { _setOnlineState(true);  });
window.addEventListener('offline', function() { _setOnlineState(false); });
setTimeout(function() { _setOnlineState(navigator.onLine !== false); }, 500);
// Reintento periódico silencioso de conteos pendientes (ej. quedaron en cola por
// contención de otro usuario contando a la vez) — evita depender de que alguien
// note el aviso y sincronice manualmente.
setInterval(function(){
  if(_isOnline() && S && S.token && _conteoBuffer && _conteoBuffer.some(function(it){return !it._row;})){
    _intentarSyncOffline();
  }
}, 20000);
// Refrescar la página activa si el usuario vuelve al tab después de >5 minutos
// (coincide con el TTL mínimo de caché de datos)
var _lastVisible = Date.now();
var _STALE_MS    = 5 * 60 * 1000; // 5 minutos

document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'hidden'){
    _lastVisible = Date.now();
    dbg('[VIS] tab oculto');
    return;
  }
  // Tab visible de nuevo
  var away = Date.now() - _lastVisible;
  dbg('[VIS] tab visible — ausente='+Math.round(away/1000)+'s STALE_MS='+_STALE_MS+' token='+(S&&S.token?'OK':'NULL')+' CURRENT_PAGE='+CURRENT_PAGE);
  if(away < _STALE_MS) { dbg('[VIS] tiempo fuera insuficiente, no recargar'); return; }
  if(!S || !S.token) { dbg('[VIS] sin sesión, no recargar'); return; }
  // Recargar la sección activa silenciosamente
  var activePage = document.querySelector('[id^="p-"].active');
  if(!activePage) { dbg('[VIS] no hay página activa'); return; }
  var name = activePage.id.replace('p-','');
  dbg('[VIS] recargar página:', name, '— PAGE_LOADING='+PAGE_LOADING[name]);
  if(name && !PAGE_LOADING[name]){
    reloadPage(name);
  }
});

/* ── MOBILE UX IMPROVEMENTS ── */
(function(){
  // Haptic feedback en botones táctiles (iOS 13+, Android Chrome)
  function vibrate(ms){try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}}

  // Botones con feedback
  document.addEventListener('click', function(e){
    var btn=e.target.closest('.btn, .bn-item, .sb-item');
    if(btn) vibrate(8);
  });

  // Prevenir doble-tap zoom SOLO en bottom nav usando CSS touch-action
  // NO usar preventDefault en touchend porque bloquea el scroll nativo

  // Fix iOS: blur input al submit para cerrar teclado
  document.addEventListener('keydown', function(e){
    if(e.key==='Enter'){
      var active=document.activeElement;
      if(active && (active.tagName==='INPUT'||active.tagName==='SELECT')){
        if(active.type!=='textarea') active.blur();
      }
    }
  });

  // Cerrar drawer al girar pantalla
  window.addEventListener('orientationchange', function(){
    setTimeout(function(){
      if(window.innerWidth > 900) toggleMobileMenu(false);
    }, 300);
  });

  // Permitir scroll natural y gestos en mobile (sin bloquear pull-to-refresh)
})();

/* ── KEYBOARD SHORTCUTS ── */
var _gChord=null, _gTimer=null;
document.addEventListener('keydown', function(e){
  var typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName || '');
  if(typing)return;
  if(_gChord){
    var map={s:'stock',e:'entradas',a:'salidas',m:'mt',c:'conteo'};
    var t=map[(e.key||'').toLowerCase()];
    if(t){
      e.preventDefault();
      var btn=document.getElementById('nav-'+t);
      if(btn && typeof navTo==='function') navTo(t, btn);
    }
    _gChord=null; clearTimeout(_gTimer);
    return;
  }
  if(e.key==='g'||e.key==='G'){
    _gChord=true;
    _gTimer=setTimeout(function(){_gChord=null;}, 800);
    return;
  }
  if(e.key==='n'||e.key==='N'){
    var app=document.getElementById('s-app');
    if(app && app.classList.contains('active') && typeof openSalidaForm==='function') openSalidaForm();
  }
});

/* ══════════════════════════════════════
   VALIDACIÓN DE INVENTARIO
══════════════════════════════════════ */
var VAL_DATA=[];     // resultado actual del servidor
var VAL_FECHA='';    // fecha seleccionada 'YYYY-MM-DD'
var VAL_TAB='sku';   // 'sku' | 'categoria'
var VAL_FILTRO='';   // '' | 'ok' | 'diff'
var VAL_SEARCH='';   // búsqueda por SKU / descripción
var VAL_MARCA='';    // filtro por marca
var VAL_MAESTRO={};  // mapa lovis a precio para costo desvíos
var VAL_TREE_SEL={cat:null,marca:null}; // selección activa del árbol de descomposición

// Fecha de hoy en Lima (YYYY-MM-DD), sin depender de la zona horaria del teléfono
function _hoyLima(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
var VAL_FECHA_MANUAL=false; // true si el usuario eligió otra fecha a mano
function initValidacion(){
  // Fecha por defecto: hoy. Después se puede cambiar, pero al volver a entrar aparece la actual.
  VAL_FECHA=_hoyLima(); VAL_FECHA_MANUAL=false;
  renderValidacionShell();
}
// Al volver a la pantalla (o si la app quedó abierta de un día para otro) la fecha vuelve a hoy, salvo que se haya elegido otra
function _valFechaHoy(){
  if(VAL_FECHA_MANUAL) return;
  var hoy=_hoyLima(), el=document.getElementById('val-fecha');
  if(el && VAL_FECHA!==hoy){ VAL_FECHA=hoy; el.value=hoy; }
}

function renderValidacionShell(){
  var root=document.getElementById('validacion-root');
  root.innerHTML=
    '<div>'+
    // Selector de fecha + botón Validar
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:20px;flex-wrap:wrap">'+
      '<div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Fecha de conteo</div>'+
      '<input type="date" id="val-fecha" class="inp" style="width:160px" value="'+VAL_FECHA+'"/>'+
      '<button class="btn btn-primary btn-sm" onclick="correrValidacion()">Validar</button>'+
      '<span id="val-status" style="font-size:12px;color:var(--text3);font-family:var(--font-mono)"></span>'+
    '</div>'+
    // Tabs
    '<div style="display:flex;gap:2px;margin-bottom:16px;border-bottom:2px solid var(--border)">'+
      '<button id="val-tab-sku" onclick="setValTab(\'sku\')" style="padding:8px 16px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;color:var(--p500);border-bottom:2px solid var(--p500);margin-bottom:-2px">Por SKU</button>'+
      '<button id="val-tab-cat" onclick="setValTab(\'categoria\')" style="padding:8px 16px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;color:var(--text3);border-bottom:2px solid transparent;margin-bottom:-2px">Por Categoría</button>'+
    '</div>'+
    // Barra de búsqueda + filtro por Marca (solo visible en tab SKU)
    '<div id="val-search-row" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">'+
      '<div style="position:relative;flex:1;min-width:180px;max-width:340px">'+
        '<svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text4)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
        '<input class="inp" id="val-search" type="search" placeholder="Buscar SKU o descripción…" style="padding-left:32px;font-size:13px" oninput="setValSearch(this.value)"/>'+
      '</div>'+
      '<select class="inp" id="val-marca-sel" style="min-width:150px;max-width:200px;font-size:13px" onchange="setValMarca(this.value)">'+
        '<option value="">Todas las marcas</option>'+
      '</select>'+
    '</div>'+
    // Filtro rápido (solo visible en tab SKU)
    '<div id="val-filtros" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">'+
      '<button class="btn btn-ghost btn-sm active" id="vf-all"  onclick="setValFiltro(\'\')">Todos</button>'+
      '<button class="btn btn-ghost btn-sm"         id="vf-diff" onclick="setValFiltro(\'diff\')" style="color:var(--danger);border-color:var(--danger-border)">Solo desvíos</button>'+
      '<button class="btn btn-ghost btn-sm"         id="vf-ok"   onclick="setValFiltro(\'ok\')" style="color:var(--ok);border-color:var(--ok-border)">Solo cuadran</button>'+
      '<button class="btn btn-ghost btn-sm"         id="vf-nc"   onclick="setValFiltro(\'nc\')" style="color:var(--warn);border-color:var(--warn-border)">Sin contar</button>'+
      '<button class="btn btn-ghost btn-sm"         id="vf-ns"   onclick="setValFiltro(\'nostock\')" style="color:var(--text3);border-color:var(--border)">Sin stock</button>'+
    '</div>'+
    '<div id="val-body"></div>'+
    '</div>';
  document.getElementById('val-fecha').addEventListener('change',function(e){VAL_FECHA=e.target.value;VAL_FECHA_MANUAL=(VAL_FECHA!==_hoyLima());});
  VAL_SEARCH=''; VAL_MARCA='';
  renderValBody();
}

function correrValidacion(force){
  var fecha=document.getElementById('val-fecha').value;
  if(!fecha){showToast('Selecciona una fecha','err');return;}
  VAL_FECHA=fecha;
  var st=document.getElementById('val-status');
  st.textContent='Calculando...';
  document.getElementById('val-body').innerHTML=LD('Cruzando datos');
  // Cargar maestro (precios) y validación en paralelo
  var _maestroOk=false, _valOk=false, _maestroData=null, _valData=null;
  function _tryRender(){
    if(!_maestroOk || !_valOk) return;
    st.textContent='';
    if(_maestroData && _maestroData.ok){
      VAL_MAESTRO={};
      (_maestroData.data||[]).forEach(function(m){ VAL_MAESTRO[m.lovis]=m.precio||0; });
    }
    if(!_valData || !_valData.ok){
      document.getElementById('val-body').innerHTML='<div class="err-box">'+esc((_valData||{}).error||'Error desconocido')+'</div>';
      return;
    }
    VAL_DATA=_valData.data;
    _poblarMarcas();
    renderValBody();
  }
  google.script.run
    .withSuccessHandler(function(r){ _maestroData=r; _maestroOk=true; _tryRender(); })
    .withFailureHandler(function(){ _maestroOk=true; _tryRender(); })
    .getMaestroCompleto(S.token, false);
  google.script.run
    .withSuccessHandler(function(r){ _valData=r; _valOk=true; _tryRender(); })
    .withFailureHandler(function(e){ st.textContent=''; showToast(e.message,'err'); })
    .getValidacion(S.token, VAL_FECHA, force===true);
}

function setValTab(tab){
  VAL_TAB=tab;
  document.getElementById('val-tab-sku').style.color=tab==='sku'?'var(--p500)':'var(--text3)';
  document.getElementById('val-tab-sku').style.borderBottomColor=tab==='sku'?'var(--p500)':'transparent';
  document.getElementById('val-tab-cat').style.color=tab==='categoria'?'var(--p500)':'var(--text3)';
  document.getElementById('val-tab-cat').style.borderBottomColor=tab==='categoria'?'var(--p500)':'transparent';
  var showSku=tab==='sku';
  document.getElementById('val-filtros').style.display=showSku?'flex':'none';
  document.getElementById('val-search-row').style.display=showSku?'flex':'none';
  renderValBody();
}

function setValFiltro(f){
  VAL_FILTRO=f;
  ['all','diff','ok','nc','ns'].forEach(function(id){
    var btn=document.getElementById('vf-'+id);
    if(btn) btn.classList.toggle('active', (f===''&&id==='all')||(f===id)||(f==='nostock'&&id==='ns'));
  });
  renderValBody();
}

function setValSearch(v){
  VAL_SEARCH=(v||'').trim().toLowerCase();
  renderValBody();
}

function setValMarca(v){
  VAL_MARCA=v||'';
  renderValBody();
}

function _poblarMarcas(){
  var sel=document.getElementById('val-marca-sel');
  if(!sel)return;
  // Extraer marcas únicas no vacías
  var marcas=[...new Set(VAL_DATA.map(function(r){return (r.marca||'').trim();}).filter(Boolean))].sort();
  var prev=sel.value;
  sel.innerHTML='<option value="">Todas las marcas</option>';
  marcas.forEach(function(m){
    var o=document.createElement('option');
    o.value=m; o.textContent=m;
    sel.appendChild(o);
  });
  // Restaurar selección previa si aún existe
  if(prev && marcas.indexOf(prev)!==-1) sel.value=prev;
  else { VAL_MARCA=''; }
}

function renderValBody(){
  var body=document.getElementById('val-body');
  if(!body)return;
  if(!VAL_DATA.length){
    body.innerHTML='<div style="padding:60px;text-align:center;color:var(--text3);font-size:13px">Selecciona una fecha y presiona <strong>Validar</strong></div>';
    return;
  }
  if(VAL_TAB==='sku') renderValSKU(body);
  else                renderValCat(body);
}

function renderValSKU(body){
  var rows=VAL_DATA;
  if(VAL_FILTRO==='diff')    rows=rows.filter(function(r){return !r.sinContar && r.diff!==0 && r.diff!==null;});
  if(VAL_FILTRO==='ok')      rows=rows.filter(function(r){return !r.sinContar && r.diff===0;});
  if(VAL_FILTRO==='nc')      rows=rows.filter(function(r){return r.sinContar && !(r.real!==null && r.real===0);});
  if(VAL_FILTRO==='nostock') rows=rows.filter(function(r){return r.real!==null && r.real===0;});
  if(VAL_MARCA)   rows=rows.filter(function(r){return (r.marca||'').trim()===VAL_MARCA;});
  if(VAL_SEARCH)  rows=rows.filter(function(r){
    return (r.sku||'').toLowerCase().indexOf(VAL_SEARCH)!==-1 ||
           (r.desc||'').toLowerCase().indexOf(VAL_SEARCH)!==-1;
  });

  var cuadran   = VAL_DATA.filter(function(r){return !r.sinContar && r.diff===0;}).length;
  var desvios   = VAL_DATA.filter(function(r){return !r.sinContar && r.diff!==0 && r.diff!==null;}).length;
  var sinContar = VAL_DATA.filter(function(r){return r.sinContar && !(r.real!==null && r.real===0);}).length;
  var sinStock  = VAL_DATA.filter(function(r){return r.real!==null && r.real===0;}).length;

  // Calcular costo total de desvíos
  var costoTotal = VAL_DATA.filter(function(r){return !r.sinContar && r.diff!==0 && r.diff!==null;})
    .reduce(function(acc,r){ return acc + (r.diff||0)*(VAL_MAESTRO[r.sku]||0); }, 0);
  var skusSinPrecio = VAL_DATA.filter(function(r){
    return !r.sinContar && r.diff!==0 && r.diff!==null && !Object.prototype.hasOwnProperty.call(VAL_MAESTRO,r.sku);
  }).length;
  var costoFmt = (function(v){
    var abs=Math.abs(v), sign=v<0?'-':'';
    if(abs>=1000000) return sign+'S/ '+(abs/1000000).toFixed(1)+'M';
    if(abs>=1000)    return sign+'S/ '+(abs/1000).toFixed(1)+'K';
    return sign+'S/ '+abs.toFixed(2);
  })(costoTotal);
  var costoExacto = (costoTotal<0?'-':'')+'S/ '+Math.abs(costoTotal).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});

  var kpiCardStyle = 'display:flex;flex-direction:column;justify-content:center;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r2);padding:14px 20px;min-height:72px;min-width:110px;';
  var html=
    '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:stretch">'+
      // Cuadran
      '<div style="'+kpiCardStyle+'border-color:var(--ok-border);background:var(--ok-bg)">'+
        '<div style="font-size:24px;font-weight:700;color:var(--ok);line-height:1">'+cuadran+'</div>'+
        '<div style="font-size:12px;color:var(--ok);margin-top:4px">cuadran</div>'+
      '</div>'+
      // Con desvío
      '<div style="'+kpiCardStyle+'border-color:var(--danger-border);background:var(--danger-bg)">'+
        '<div style="font-size:24px;font-weight:700;color:var(--danger);line-height:1">'+desvios+'</div>'+
        '<div style="font-size:12px;color:var(--danger);margin-top:4px">con desvío</div>'+
      '</div>'+
      // Sin contar (condicional)
      (sinContar?
        '<div style="'+kpiCardStyle+'border-color:var(--warn-border);background:var(--warn-bg)">'+
          '<div style="font-size:24px;font-weight:700;color:var(--warn);line-height:1">'+sinContar+'</div>'+
          '<div style="font-size:12px;color:var(--warn);margin-top:4px">sin contar</div>'+
        '</div>'
      :'')+
      // Sin stock
      '<div style="'+kpiCardStyle+'" onclick="setValFiltro(\'nostock\')" style="cursor:pointer">'+
        '<div style="font-size:24px;font-weight:700;color:var(--text2);line-height:1">'+sinStock+'</div>'+
        '<div style="font-size:12px;color:var(--text3);margin-top:4px">sin stock</div>'+
      '</div>'+
      // Contados
      '<div style="'+kpiCardStyle+'">'+
        '<div style="font-size:24px;font-weight:700;color:var(--text);line-height:1">'+(VAL_DATA.length-sinContar)+'</div>'+
        '<div style="font-size:12px;color:var(--text3);margin-top:4px">contados</div>'+
      '</div>'+
      // KPI Costo Total Desvío — más ancho, mismo alto
      '<div style="'+kpiCardStyle+'border-color:var(--border2);min-width:220px;flex:1;max-width:320px">'+
        '<div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Costo Total Desvío</div>'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<div style="width:32px;height:32px;background:var(--p600);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'+
          '</div>'+
          '<div>'+
            '<div style="font-size:26px;font-weight:800;letter-spacing:-.5px;color:var(--text);line-height:1">'+costoFmt+
              '<span style="margin-left:6px;font-size:10px;font-weight:600;color:var(--text3);background:var(--surface3,var(--border));padding:2px 7px;border-radius:20px;vertical-align:middle">pen</span>'+
            '</div>'+
            '<div style="font-size:11px;color:var(--text3);margin-top:3px">'+costoExacto+' total</div>'+
            (skusSinPrecio>0
              ? '<div style="font-size:10px;color:var(--warn);margin-top:4px" title="Estos SKUs no aparecen en la hoja MAESTRO (Cod_Lovis) o no tienen columna Precio — su costo se muestra como S/ 0.00 pero no está calculado">'+ICO('warn',12)+skusSinPrecio+' SKU sin precio en MAESTRO</div>'
              : '')+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="table-wrap" style="overflow-x:auto"><table style="min-width:780px"><thead><tr>'+
      '<th style="min-width:100px">SKU</th><th style="min-width:180px">Descripción</th><th class="c" style="min-width:100px">Categoría</th>'+
      '<th class="r" style="min-width:90px" title="Conteo del día anterior">C. Anterior</th>'+
      '<th class="r" style="min-width:80px">− Salidas</th>'+
      '<th class="r" style="min-width:70px">− M-T</th>'+
      '<th class="r" style="min-width:90px">+ Entradas</th>'+
      '<th class="r" style="min-width:90px" title="Conteo real del día seleccionado">C. Actual</th>'+
      '<th class="r" style="min-width:90px">Stock Real</th>'+
      '<th class="r" style="min-width:90px">Diferencia</th>'+
      '<th class="r" style="min-width:90px">Costo Dif.</th>'+
      '<th class="c" style="min-width:110px">Estado</th>'+
      '<th class="c" style="min-width:80px"></th>'+
    '</tr></thead><tbody>';

  if(!rows.length){
    html+='<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:32px">Sin resultados con ese filtro</td></tr>';
  } else {
    rows.forEach(function(r){
      var estado, bc, diffTxt, rowStyle='';
      if(r.sinContar){
        estado=ICO('bolt',12)+'Sin contar'; bc='badge-warn'; diffTxt='—';
        rowStyle=' style="background:var(--warn-bg)"';
      } else if(r.diff===null){
        estado='Sin conteo ant.'; bc='badge-neutral'; diffTxt='—';
      } else if(r.diff===0){
        estado=ICO('check',12)+'Cuadra'; bc='badge-ok'; diffTxt='0';
      } else {
        estado=ICO('warn',12)+'Desvío'; bc='badge-danger';
        diffTxt=(r.diff>0?'+':'')+fmt(r.diff);
      }
      var btnAccion = r.sinContar
        ? '<button class="btn btn-ghost btn-sm val-ir-contar" style="font-size:11px;color:var(--warn);border-color:var(--warn-border)">Ir a contar</button>'
        : (r.diff!==0 && r.diff!==null
            ? '<button class="btn btn-ghost btn-sm val-recontar" data-sku="'+esc(r.sku)+'" style="font-size:11px;color:var(--danger);border-color:var(--danger-border)">Recontar</button>'
            : '');
      html+='<tr'+rowStyle+'>'+
        '<td class="mono">'+esc(r.sku)+'</td>'+
        '<td class="td-desc" title="'+esc(r.desc)+'">'+esc(r.desc)+'</td>'+
        '<td class="muted" style="font-size:11px">'+esc(r.categoria)+'</td>'+
        '<td class="r">'+(r.cAnterior!==null?fmt(r.cAnterior):'—')+'</td>'+
        (r.salidas>0
          ? '<td class="r val-mov-cell" data-tipo="sal" data-sku="'+esc(r.sku)+'" style="color:var(--danger);cursor:pointer;text-decoration:underline dotted">'+fmt(r.salidas)+'</td>'
          : '<td class="r" style="color:var(--danger)">'+(r.salidas!==null?fmt(r.salidas):'—')+'</td>')+
        (r.mt>0
          ? '<td class="r val-mov-cell" data-tipo="mt" data-sku="'+esc(r.sku)+'" style="color:var(--warn);cursor:pointer;text-decoration:underline dotted">'+fmt(r.mt)+'</td>'
          : '<td class="r" style="color:var(--warn)">'+(r.mt!==null?fmt(r.mt):'—')+'</td>')+
        (r.entradas>0
          ? '<td class="r val-mov-cell" data-tipo="ent" data-sku="'+esc(r.sku)+'" style="color:var(--ok);cursor:pointer;text-decoration:underline dotted">'+fmt(r.entradas)+'</td>'
          : '<td class="r" style="color:var(--ok)">'+(r.entradas!==null?fmt(r.entradas):'—')+'</td>')+
        '<td class="r" style="font-weight:700">'+(r.cActual!==null?fmt(r.cActual):'—')+'</td>'+
        '<td class="r" style="color:var(--text2)">'+(r.real!==null?fmt(r.real):'—')+'</td>'+
        '<td class="r" style="font-weight:700;color:'+(r.sinContar?'var(--warn)':r.diff===0?'var(--ok)':r.diff!==null?'var(--danger)':'var(--text3)')+'">'+diffTxt+'</td>'+
        (function(){
          if(r.diff && r.diff!==0 && r.diff!==null && !r.sinContar){
            var tieneMaestro=Object.prototype.hasOwnProperty.call(VAL_MAESTRO,r.sku);
            var precio=VAL_MAESTRO[r.sku]||0;
            var costo=r.diff*precio;
            var costoStr='S/ '+costo.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
            if(!tieneMaestro){
              return '<td class="r" style="font-weight:600;color:var(--warn)" title="SKU no encontrado en la hoja MAESTRO (Cod_Lovis) — costo no calculado">'+ICO('warn',12)+costoStr+'</td>';
            }
            return '<td class="r" style="font-weight:600;color:'+(costo<0?'var(--danger)':'var(--ok)')+'">'+costoStr+'</td>';
          }
          return '<td class="r" style="color:var(--text4)">—</td>';
        })()+
        '<td class="c"><span class="badge '+bc+'">'+estado+'</span></td>'+
        '<td class="c">'+btnAccion+'</td>'+
      '</tr>';
    });
  }
  html+='</tbody></table></div>';
  body.innerHTML=html;

  // Event delegation — evita onclick inline con datos de usuario (XSS)
  body.addEventListener('click', function(e) {
    var cell = e.target.closest('.val-mov-cell');
    if (cell) { abrirModalMov(cell.dataset.tipo, cell.dataset.sku); return; }
    var btn = e.target.closest('.val-recontar');
    if (btn) { recontar(btn.dataset.sku); return; }
    if (e.target.closest('.val-ir-contar')) { navTo('conteo', document.getElementById('nav-conteo')); }
  });
}

/* ── Vista Árbol de Descomposición (Por Categoría) — única vista ── */
function renderValCat(body){
  _vcInjectCss();
  body.innerHTML='<div id="vc-kpi-row" class="vc-kpi-row"></div><div id="vc-tree-root"></div><div id="vc-stats" class="vc-stats"></div>';
  renderValKpis(true);
  renderValTree(document.getElementById('vc-tree-root'),true);
  renderValStats();
}

/* CSS de KPIs + árbol estilo referencia (gradientes sólidos) — inyectado una sola vez */
function _vcInjectCss(){
  if(document.getElementById('vc-css')) return;
  var st=document.createElement('style'); st.id='vc-css';
  st.textContent=
    /* Gradientes derivados de las variables del sistema (se adaptan al tema) */
    '.vc-g-blue{background:linear-gradient(135deg,color-mix(in srgb,var(--blue),#fff 28%),color-mix(in srgb,var(--blue),#000 12%));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--blue) 50%,transparent)}'+
    '.vc-g-pink{background:linear-gradient(135deg,color-mix(in srgb,var(--danger),#fff 22%),color-mix(in srgb,var(--danger),#000 22%));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--danger) 45%,transparent)}'+
    '.vc-g-verde{background:linear-gradient(135deg,color-mix(in srgb,var(--ok),#fff 20%),color-mix(in srgb,var(--ok),#000 25%));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--ok) 45%,transparent)}'+
    '.vc-g-purple{background:linear-gradient(135deg,var(--p400),var(--p600));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--p500) 50%,transparent)}'+
    '.vc-g-violet{background:linear-gradient(135deg,var(--p500),color-mix(in srgb,var(--p600),#000 20%));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--p600) 55%,transparent)}'+
    /* KPI cards — estilo del proyecto (card oscura + icono tintado) */
    '.vc-kpi-row{display:flex;gap:14px;overflow-x:auto;padding:6px 2px 18px;margin-bottom:14px;border-bottom:1px solid var(--border)}'+
    '.vc-kpi{min-width:212px;max-width:212px;flex:0 0 auto;padding:13px 15px 12px;border:1px solid var(--border);border-radius:14px;background:var(--surface);cursor:pointer;transition:transform .2s,border-color .2s,background .2s,opacity .2s;animation:vcIn .38s ease both;animation-delay:calc(var(--i)*55ms)}'+
    '.vc-kpi:hover{transform:translateY(-3px);border-color:var(--p500)}'+
    '.vc-kpi-act{border-color:var(--p500);background:var(--surface2)}'+
    '.vc-kpi.vc-dim{opacity:.4}'+
    '.vc-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}'+
    '.vc-kpi-ico{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center}'+
    '.vc-kpi-ico svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'+
    '.vc-ico-blue{background:var(--blue-bg);color:var(--blue)}'+
    '.vc-ico-falt{background:var(--danger-bg);color:var(--danger)}'+
    '.vc-ico-sobr{background:var(--ok-bg);color:var(--ok)}'+
    '.vc-ico-gris{background:var(--surface2);color:var(--text3)}'+
    '.vc-kpi-badge{flex:0 0 auto;font-size:10px;font-weight:600;color:var(--text3);background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:2px 9px;font-variant-numeric:tabular-nums}'+
    '.vc-kpi-name{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:4px}'+
    '.vc-kpi-val{font-size:21px;font-weight:800;line-height:1.05;letter-spacing:-.01em;color:var(--text);font-variant-numeric:tabular-nums}'+
    '.vc-kpi-und{font-size:11px;color:var(--text3);margin-top:3px;font-variant-numeric:tabular-nums}'+
    '.vc-kpi-bar{display:flex;height:5px;border-radius:3px;overflow:hidden;background:var(--border);margin:10px 0 7px;transform-origin:left;animation:vcBar .5s ease both;animation-delay:calc(var(--i)*55ms + .12s)}'+
    '.vc-kpi-bar>span{height:100%}'+
    '.vc-kpi-split{display:flex;justify-content:space-between;font-size:10.5px;font-weight:600;font-variant-numeric:tabular-nums}'+
    /* Nodos del árbol — más grandes y con aire, como la referencia */
    '.vc-node{border-radius:14px;padding:14px 17px 13px;color:#fff;position:relative;border:1px solid rgba(255,255,255,.14);transition:transform .2s cubic-bezier(.2,.8,.3,1.2),opacity .2s,box-shadow .2s;animation:vcIn .35s ease both;animation-delay:calc(var(--i)*50ms)}'+
    '.vc-node::after{content:"";position:absolute;inset:0;border-radius:14px;pointer-events:none;background:linear-gradient(178deg,rgba(255,255,255,.18),rgba(255,255,255,0) 46%)}'+
    '.vc-tn-cat:hover,.vc-tn-marca:hover{transform:translateY(-3px)}'+
    '.vc-sel{box-shadow:0 18px 44px -8px rgba(0,0,0,.75)!important;transform:scale(1.03)}'+
    '.vc-dim{opacity:.3}'+
    '.vc-tn-big{padding:20px 18px 17px!important;min-height:128px;display:flex;flex-direction:column;justify-content:flex-end}'+
    '.vc-tn-big .vc-n-ico{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.24);display:flex;align-items:center;justify-content:center;margin-bottom:auto}'+
    '.vc-tn-big .vc-n-ico svg{width:16px;height:16px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'+
    '.vc-tn-big .vc-n-name{font-size:14px;margin-top:12px;white-space:normal}'+
    '.vc-tn-big .vc-n-val{font-size:17px}'+
    '.vc-n-name{font-size:12px;font-weight:600;opacity:.95;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.vc-n-val{font-size:16px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}'+
    '.vc-n-und{display:block;font-size:10px;opacity:.75;font-weight:600;margin-top:3px;letter-spacing:.02em}'+
    /* Conectores */
    '#vc-tree-svg path.vc-lnk{animation:vcLnkIn .5s ease backwards;animation-delay:calc(var(--j)*45ms)}'+
    '@keyframes vcLnkIn{from{opacity:0}}'+
    /* Stats footer */
    '.vc-stats{display:flex;gap:clamp(30px,8vw,110px);justify-content:center;align-items:flex-start;padding:24px 0 8px}'+
    '.vc-stat{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;animation:vcIn .4s ease both;animation-delay:calc(var(--i)*90ms + .25s)}'+
    '.vc-stat-circ{width:38px;height:38px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text3)}'+
    '.vc-stat-circ svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'+
    '.vc-stat-lbl{font-size:9px;font-weight:600;letter-spacing:.18em;color:var(--text3);text-transform:uppercase}'+
    '.vc-stat-num{font-size:23px;font-weight:800;color:var(--text);letter-spacing:-.01em;font-variant-numeric:tabular-nums}'+
    /* Animaciones base */
    '@keyframes vcIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}'+
    '@keyframes vcBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}'+
    '.vc-noanim .vc-node,.vc-noanim .vc-kpi,.vc-noanim .vc-kpi-bar,.vc-noanim .vc-stat{animation:none!important}'+
    '@media (prefers-reduced-motion:reduce){.vc-kpi,.vc-node,.vc-kpi-bar,.vc-stat,#vc-tree-svg path.vc-lnk{animation:none!important}.vc-kpi,.vc-node{transition:none}}';
  document.head.appendChild(st);
}

/* Fila de KPI cards: Global + una por categoría con desvío */
function renderValKpis(anim){
  var row=document.getElementById('vc-kpi-row'); if(!row) return;
  var D=_vcTreeData();
  if(!D.n){ row.innerHTML=''; row.style.display='none'; return; }
  row.style.display='';
  row.classList.toggle('vc-noanim',!anim);
  var ICO_CUBE='<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>';
  var card=function(key,name,o,cont,active,idx){
    var kind=key==='__all__'?'blue':(o.val<0?'falt':(o.val>0?'sobr':'gris'));
    var totAbs=Math.abs(o.falt)+Math.abs(o.sobr);
    var pF=totAbs>0?Math.round(Math.abs(o.falt)/totAbs*100):0;
    var dim=VAL_TREE_SEL.cat&&!active&&key!=='__all__'?' vc-dim':'';
    return '<div class="vc-kpi'+(active&&key!=='__all__'?' vc-kpi-act':'')+dim+'" data-key="'+esc(key)+'" style="--i:'+idx+'">'+
      '<div class="vc-kpi-top">'+
        '<div class="vc-kpi-ico vc-ico-'+kind+'"><svg viewBox="0 0 24 24">'+ICO_CUBE+'</svg></div>'+
        '<span class="vc-kpi-badge" title="SKUs con desvío / SKUs contados">'+o.nDesv+'/'+cont+' SKU</span>'+
      '</div>'+
      '<div class="vc-kpi-name" title="'+esc(name)+'">'+esc(name)+'</div>'+
      '<div class="vc-kpi-val">'+_vcMoney(o.val)+'</div>'+
      '<div class="vc-kpi-und">'+(o.und>0?'+':'')+fmt(o.und)+' und netas</div>'+
      '<div class="vc-kpi-bar">'+
        '<span style="width:'+pF+'%;background:var(--danger)"></span>'+
        '<span style="flex:1;background:var(--ok)"></span>'+
      '</div>'+
      '<div class="vc-kpi-split">'+
        '<span style="color:var(--danger)">'+_vcMoney(o.falt)+' falt</span>'+
        '<span style="color:var(--ok)">'+(o.sobr>0?'+':'')+_vcMoney(o.sobr)+' sobr</span>'+
      '</div>'+
    '</div>';
  };
  var catArr=Object.values(D.cats).sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});
  var html=card('__all__','Global',{val:D.total,und:D.totalUnd,falt:D.falt,sobr:D.sobr,nDesv:D.n},D.contTotal,!VAL_TREE_SEL.cat,0);
  catArr.forEach(function(c,i){
    html+=card(c.name,c.name,c,D.contados[c.name]||c.nDesv,c.name===VAL_TREE_SEL.cat,i+1);
  });
  row.innerHTML=html;
  row.onclick=function(e){
    var el=e.target.closest('.vc-kpi'); if(!el) return;
    var k=el.getAttribute('data-key');
    VAL_TREE_SEL=(k==='__all__'||VAL_TREE_SEL.cat===k)?{cat:null,marca:null}:{cat:k,marca:null};
    renderValKpis(false);
    renderValTree(document.getElementById('vc-tree-root'),false);
  };
}

/* Stats footer estilo referencia: SKUs contados · Con desvío · Costo neto */
function renderValStats(){
  var el=document.getElementById('vc-stats'); if(!el) return;
  var D=_vcTreeData();
  if(!D.n){ el.innerHTML=''; return; }
  var stat=function(ico,lbl,num,i){
    return '<div class="vc-stat" style="--i:'+i+'">'+
      '<div class="vc-stat-circ"><svg viewBox="0 0 24 24">'+ico+'</svg></div>'+
      '<div class="vc-stat-lbl">'+lbl+'</div>'+
      '<div class="vc-stat-num">'+num+'</div>'+
    '</div>';
  };
  el.innerHTML=
    stat('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>','SKUs contados',fmt(D.contTotal),0)+
    stat('<path d="M12 3v18M5 10l7-7 7 7"/>','Con desvío',fmt(D.n),1)+
    stat('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>','Costo neto',_vcMoney(D.total),2);
}

// Dataset del árbol: SOLO SKUs con diferencia ≠ 0 (positiva o negativa)
function _vcTreeData(){
  var rows=VAL_DATA.filter(function(r){
    return !r.sinContar && r.diff!==null && r.diff!==undefined && (Number(r.diff)||0)!==0;
  });
  // SKUs contados (incluye los que cuadran) por categoría — denominador de los KPIs
  var contados={}, contTotal=0;
  VAL_DATA.forEach(function(r){
    if(!r.sinContar && r.diff!==null && r.diff!==undefined){
      var c0=r.categoria||'Sin categoría';
      contados[c0]=(contados[c0]||0)+1; contTotal++;
    }
  });
  var cats={}, total=0, totalUnd=0, falt=0, sobr=0;
  rows.forEach(function(r){
    var dif=Number(r.diff)||0;
    var costo=dif*(Number(VAL_MAESTRO[r.sku])||0);
    var c=r.categoria||'Sin categoría', m=r.marca||'Sin marca';
    if(!cats[c]) cats[c]={name:c,val:0,und:0,falt:0,sobr:0,nDesv:0,marcas:{}};
    var C=cats[c];
    if(!C.marcas[m]) C.marcas[m]={name:m,val:0,und:0,skus:[]};
    C.val+=costo; C.und+=dif; C.nDesv++; C.marcas[m].val+=costo; C.marcas[m].und+=dif;
    if(costo<0){ C.falt+=costo; falt+=costo; } else { C.sobr+=costo; sobr+=costo; }
    total+=costo; totalUnd+=dif;
    C.marcas[m].skus.push({name:r.desc||r.sku,sku:r.sku,val:costo,und:dif});
  });
  return {total:total,totalUnd:totalUnd,falt:falt,sobr:sobr,cats:cats,n:rows.length,contados:contados,contTotal:contTotal};
}

function _vcMoney(v){
  return (v<0?'-':'')+'S/ '+Math.abs(v).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function _vcTreeNode(cls,key,name,val,und,kind,active,dim,clickable,idx){
  return '<div class="vc-node vc-g-'+kind+' '+cls+(active?' vc-sel':'')+(dim?' vc-dim':'')+'" data-key="'+esc(key)+'" data-val="'+Math.abs(val)+'" data-sign="'+(val<0?'neg':(val>0?'pos':'zero'))+'" style="--i:'+(idx||0)+';'+(clickable?'cursor:pointer':'')+'">'+
    '<div class="vc-n-name" title="'+esc(name)+'">'+esc(name)+'</div>'+
    '<div class="vc-n-val">'+_vcMoney(val)+'</div>'+
    '<span class="vc-n-und">'+(und>0?'+':'')+fmt(und)+' unidades</span>'+
  '</div>';
}

function renderValTree(root,anim){
  var D=_vcTreeData();
  if(!D.n){
    root.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px">Sin desvíos — todos los SKUs contados cuadran '+ICO('check',14,'l')+'</div>';
    return;
  }
  var noanim=anim?'':' vc-noanim';
  var colStyle='display:flex;flex-direction:column;gap:22px;min-width:248px;max-width:248px;max-height:560px;overflow-y:auto;padding:8px;';
  var hdr=function(t,n){
    return '<div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);padding:0 4px 6px;border-bottom:2px solid var(--border);margin-bottom:4px">'+t+
      (n!=null?' <span style="color:var(--p500)">'+n+'</span>':'')+'</div>';
  };

  var catArr=Object.values(D.cats).sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});

  // Total (card azul, como la referencia)
  var html='<div id="vc-tree-cols" class="'+noanim+'" style="position:relative;display:flex;gap:84px;overflow-x:auto;padding:10px 4px">'+
    '<svg id="vc-tree-svg" style="position:absolute;inset:0;pointer-events:none"></svg>'+
    '<div style="'+colStyle+'align-self:center;max-height:none;overflow:visible">'+hdr('Total desvíos',D.n+' SKU')+
      '<div id="vc-tn-total">'+
        '<div class="vc-node vc-g-blue vc-tn-big" style="--i:0">'+
          '<div class="vc-n-ico"><svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/></svg></div>'+
          '<div class="vc-n-name">Total Faltantes y Sobrantes</div>'+
          '<div class="vc-n-val">'+_vcMoney(D.total)+'</div>'+
          '<span class="vc-n-und">'+(D.totalUnd>0?'+':'')+fmt(D.totalUnd)+' unidades netas</span>'+
        '</div>'+
      '</div>'+
    '</div>';

  // Categorías (rosa)
  html+='<div class="vc-tree-col" style="'+colStyle+'">'+hdr('Categoría',catArr.length);
  catArr.forEach(function(c,ci){
    var isSel=c.name===VAL_TREE_SEL.cat;
    html+=_vcTreeNode('vc-tn-cat',c.name,c.name,c.val,c.und,'purple',isSel,VAL_TREE_SEL.cat&&!isSel,true,ci);
  });
  html+='</div>';

  // Marcas (violeta) — solo si hay categoría seleccionada
  var selCat=VAL_TREE_SEL.cat?D.cats[VAL_TREE_SEL.cat]:null;
  if(selCat){
    var marcaArr=Object.values(selCat.marcas).sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});
    html+='<div class="vc-tree-col" style="'+colStyle+'">'+hdr('Marca',marcaArr.length);
    marcaArr.forEach(function(m,mi){
      var isSel=m.name===VAL_TREE_SEL.marca;
      var mk=m.val<0?'pink':(m.val>0?'verde':'purple');
      html+=_vcTreeNode('vc-tn-marca',m.name,m.name,m.val,m.und,mk,isSel,VAL_TREE_SEL.marca&&!isSel,true,mi);
    });
    html+='</div>';
  }

  // SKUs (violeta profundo) — solo si hay marca seleccionada
  var selM=selCat&&VAL_TREE_SEL.marca?selCat.marcas[VAL_TREE_SEL.marca]:null;
  if(selM){
    var skuArr=selM.skus.slice().sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});
    html+='<div class="vc-tree-col" style="'+colStyle+'min-width:288px;max-width:288px">'+hdr('SKU',skuArr.length);
    skuArr.forEach(function(s,si){
      var sk=s.val<0?'pink':(s.val>0?'verde':'violet');
      html+=_vcTreeNode('vc-tn-sku',s.sku,s.name,s.val,s.und,sk,false,false,false,si);
    });
    html+='</div>';
  }

  html+='</div>'+
    '<div style="font-size:11px;color:var(--text3);margin-top:8px;padding:0 4px">Mostrando solo SKUs con diferencia ≠ 0 · Haz clic en una categoría o marca para desglosar</div>';

  root.innerHTML=html;

  // Delegación de clicks (evita inline onclick con nombres con comillas)
  var cols=document.getElementById('vc-tree-cols');
  cols.onclick=function(e){
    var cat=e.target.closest('.vc-tn-cat');
    if(cat){
      var k=cat.getAttribute('data-key');
      VAL_TREE_SEL = (VAL_TREE_SEL.cat===k) ? {cat:null,marca:null} : {cat:k,marca:null};
      renderValKpis(false); renderValTree(root,false); return;
    }
    var m=e.target.closest('.vc-tn-marca');
    if(m){
      var km=m.getAttribute('data-key');
      VAL_TREE_SEL.marca = (VAL_TREE_SEL.marca===km) ? null : km;
      renderValTree(root,false); return;
    }
  };
  // Redibujar conectores al hacer scroll dentro de las columnas (sin re-animar)
  cols.addEventListener('scroll',function(){requestAnimationFrame(function(){vcTreeDrawLinks(false);});},true);
  requestAnimationFrame(function(){vcTreeDrawLinks(!!anim);});
}

function vcTreeDrawLinks(animate){
  var rootEl=document.getElementById('vc-tree-cols');
  var svg=document.getElementById('vc-tree-svg');
  if(!rootEl||!svg)return;
  var W=rootEl.scrollWidth,H=rootEl.scrollHeight;
  svg.setAttribute('width',W); svg.setAttribute('height',H);
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
  svg.style.width=W+'px'; svg.style.height=H+'px';
  var rb=rootEl.getBoundingClientRect();
  // Colores de sistema: origen fijo por columna, destino según signo del nodo
  var SIGN_COL={neg:'var(--danger)',pos:'var(--ok)',zero:'var(--p500)'};
  var defs='<defs>', paths='', nLnk=0, GID=0;
  // Cinta rellena de (x1,y1) a (x2,y2) con grosor t y gradiente c1 a c2 propio
  var ribbon=function(x1,y1,x2,y2,t,c1,c2,op){
    var mx=(x1+x2)/2,h=t/2,id='vcrg'+(GID++);
    defs+='<linearGradient id="'+id+'" x1="'+x1+'" y1="0" x2="'+x2+'" y2="0" gradientUnits="userSpaceOnUse">'+
      '<stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>';
    var d='M'+x1+' '+(y1-h)+
      ' C'+mx+' '+(y1-h)+' '+mx+' '+(y2-h)+' '+x2+' '+(y2-h)+
      ' L'+x2+' '+(y2+h)+
      ' C'+mx+' '+(y2+h)+' '+mx+' '+(y1+h)+' '+x1+' '+(y1+h)+' Z';
    paths+='<path '+(animate?'class="vc-lnk" style="--j:'+(nLnk++)+';mix-blend-mode:screen" ':'style="mix-blend-mode:screen" ')+
      'd="'+d+'" fill="url(#'+id+')" opacity="'+op+'"/>';
  };
  // Dibuja un grupo origen a destinos con salidas APILADAS a lo alto del nodo origen
  // (estilo Sankey: cada cinta ocupa su propia franja, ordenadas por la posición del destino)
  var group=function(srcEl,els,srcCol,opFn,destCol){
    if(!srcEl||!els.length) return;
    var sb=srcEl.getBoundingClientRect();
    var sx=sb.right-rb.left+rootEl.scrollLeft;
    var sTop=sb.top-rb.top+rootEl.scrollTop;
    var list=els.map(function(el){
      var b=el.getBoundingClientRect();
      return {el:el,
        x:b.left-rb.left+rootEl.scrollLeft,
        y:b.top+b.height/2-rb.top+rootEl.scrollTop,
        v:parseFloat(el.getAttribute('data-val'))||0};
    }).sort(function(a,b){return a.y-b.y;});
    var maxV=list.reduce(function(m,o){return Math.max(m,o.v);},0);
    var ths=list.map(function(o){return maxV>0?10+Math.sqrt(o.v/maxV)*22:12;});
    var sum=ths.reduce(function(a,b){return a+b;},0);
    var pad=5, avail=Math.max(sb.height-pad*2,10);
    var k=sum>avail?avail/sum:1;                 // comprime si no caben en el alto del nodo
    var off=sTop+pad+(avail-sum*k)/2;            // centra el bloque de cintas verticalmente
    list.forEach(function(o,i){
      var t=Math.max(ths[i]*k,3);
      var c2=destCol||SIGN_COL[o.el.getAttribute('data-sign')]||SIGN_COL.zero;
      ribbon(sx,off+t/2,o.x,o.y,t,srcCol,c2,opFn(o.el));
      off+=t;
    });
  };
  var esc2=function(s){return (window.CSS&&CSS.escape)?CSS.escape(s):s.replace(/"/g,'\\"');};
  var tot=document.getElementById('vc-tn-total');
  var totCard=tot?tot.firstElementChild:null;
  var catEls=Array.prototype.slice.call(document.querySelectorAll('.vc-tn-cat'));
  group(totCard,catEls,'var(--blue)',function(el){
    var isSel=el.getAttribute('data-key')===VAL_TREE_SEL.cat;
    return !VAL_TREE_SEL.cat?'.72':(isSel?'.9':'.12');
  },'var(--p500)');
  if(VAL_TREE_SEL.cat){
    var selCat=document.querySelector('.vc-tn-cat[data-key="'+esc2(VAL_TREE_SEL.cat)+'"]');
    var mEls=Array.prototype.slice.call(document.querySelectorAll('.vc-tn-marca'));
    group(selCat,mEls,'var(--p500)',function(el){
      var isSel=el.getAttribute('data-key')===VAL_TREE_SEL.marca;
      return !VAL_TREE_SEL.marca?'.72':(isSel?'.9':'.12');
    });
  }
  if(VAL_TREE_SEL.marca){
    var selM=document.querySelector('.vc-tn-marca[data-key="'+esc2(VAL_TREE_SEL.marca)+'"]');
    var sEls=Array.prototype.slice.call(document.querySelectorAll('.vc-tn-sku'));
    if(selM){
      var srcCol=SIGN_COL[selM.getAttribute('data-sign')]||SIGN_COL.zero;
      group(selM,sEls,srcCol,function(){return '.85';});
    }
  }
  svg.innerHTML=defs+'</defs>'+paths;
}

function recontar(sku){
  if(!VAL_FECHA){showToast('No hay fecha de validación activa','err');return;}
  _confirmDialog(
    'Eliminar conteo para recontar',
    'Se eliminará el conteo de ' + sku + ' del ' + VAL_FECHA + '. Podrás recontar desde la sección Conteo.',
    function(){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){showToast(r.error,'err');return;}
          showToast('Conteo eliminado ('+r.eliminados+' fila'+(r.eliminados>1?'s':'')+') — ve a Conteo para recontar','ok');
          // Quitar de VAL_DATA localmente y re-renderizar
          VAL_DATA=VAL_DATA.filter(function(d){return d.sku!==sku;});
          renderValBody();
        })
        .withFailureHandler(function(e){showToast(e.message,'err');})
        .eliminarConteoPorSKU(S.token, sku, VAL_FECHA);
    },
    'Eliminar conteo'
  );
}

function exportValidacion(){
  if(!VAL_DATA.length){showToast('Primero ejecuta una validación','err');return;}
  // Hoja 1: Por SKU
  var dataSKU=VAL_DATA.map(function(r){
    var costoDif='';
    if(r.diff && r.diff!==0 && r.diff!==null && !r.sinContar){
      var precio=VAL_MAESTRO[r.sku]||0;
      costoDif=r.diff*precio;
    }
    return{
      'SKU':r.sku,'Descripción':r.desc,'Categoría':r.categoria,
      'C. Anterior':r.cAnterior!==null?r.cAnterior:'',
      'Salidas (día)':r.salidas!==null?r.salidas:'',
      'M-T (día)':r.mt!==null?r.mt:'',
      'Entradas (día)':r.entradas!==null?r.entradas:'',
      'C. Actual':r.cActual!==null?r.cActual:'',
      'Stock Real':r.real!==null?r.real:'',
      'Diferencia':r.diff!==null?r.diff:'',
      'Costo Dif.':costoDif,
      'Estado':r.sinContar?'Sin contar':r.diff===0?'Cuadra':r.diff!==null?'Desvío':'Sin conteo ant.'
    };
  });
  // Hoja 2: Por Categoría
  var cats={};
  VAL_DATA.forEach(function(r){
    var c=r.categoria||'Sin categoría';
    if(!cats[c])cats[c]={Categoría:c,'SKUs contados':0,'Cuadran':0,'Con desvío':0,'Und. desvío total':0};
    cats[c]['SKUs contados']++;
    if(!r.sinContar && r.diff===0)cats[c]['Cuadran']++;
    else if(r.diff!==null){cats[c]['Con desvío']++;cats[c]['Und. desvío total']+=Math.abs(r.diff);}
  });
  var dataCat=Object.values(cats).sort(function(a,b){return b['Con desvío']-a['Con desvío'];});

  var wsSKU=XLSX.utils.json_to_sheet(dataSKU);
  wsSKU['!cols']=[{wch:14},{wch:38},{wch:16},{wch:9},{wch:12},{wch:13},{wch:14},{wch:11},{wch:11},{wch:10}];
  var wsCat=XLSX.utils.json_to_sheet(dataCat);
  wsCat['!cols']=[{wch:20},{wch:14},{wch:10},{wch:12},{wch:18}];

  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,wsSKU,'Por SKU');
  XLSX.utils.book_append_sheet(wb,wsCat,'Por Categoría');
  XLSX.writeFile(wb,'validacion_'+VAL_FECHA+'.xlsx');
  showToast('Exportado correctamente','ok');
}

/* ── MODAL DETALLE MOVIMIENTOS ── */
function abrirModalMov(tipo, sku){
  var row=VAL_DATA.find(function(r){return r.sku===sku;});
  if(!row) return;
  var modal=document.getElementById('modal-mov');
  var title=document.getElementById('modal-mov-title');
  var sub=document.getElementById('modal-mov-sub');
  var body=document.getElementById('modal-mov-body');

  // Los movimientos son del día anterior al seleccionado
  var d=new Date(VAL_FECHA+'T00:00:00'); d.setDate(d.getDate()-1);
  var dStr=d.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});

  var html='';
  if(tipo==='sal'){
    title.textContent='Salidas — '+sku;
    sub.textContent=row.desc+' · '+dStr;
    var items=row.salidasDet||[];
    if(!items.length){ html='<div style="color:var(--text3);font-size:13px;padding:20px 0">Sin salidas ese día</div>'; }
    else {
      html='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="border-bottom:1px solid var(--border)">'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Nro. Pedido</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Descripción</th>'+
          '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Pack</th>'+
          '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Und.</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Motorizado</th>'+
        '</tr></thead><tbody>';
      items.forEach(function(s,i){
        var bg=i%2===0?'':'background:var(--surface2)';
        html+='<tr style="'+bg+'">'+
          '<td style="padding:7px 8px;font-family:var(--font-mono);font-size:11px;color:var(--p600)">'+esc(s.nroPedido||'—')+'</td>'+
          '<td style="padding:7px 8px;color:var(--text2)">'+esc(s.desc)+'</td>'+
          '<td style="padding:7px 8px;text-align:right">'+fmt(s.pack)+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--danger)">'+fmt(s.unidad)+'</td>'+
          '<td style="padding:7px 8px;color:var(--text3);font-size:11px">'+esc(s.motorizado||'—')+'</td>'+
        '</tr>';
      });
      var total=items.reduce(function(a,s){return a+s.unidad;},0);
      html+='<tr style="border-top:2px solid var(--border);font-weight:700">'+
        '<td colspan="3" style="padding:8px;font-size:11px;color:var(--text3)">TOTAL</td>'+
        '<td style="padding:8px;text-align:right;color:var(--danger)">'+fmt(total)+'</td>'+
        '<td></td></tr></tbody></table>';
    }
  } else if(tipo==='mt'){
    title.textContent='Mermas / Traslados — '+sku;
    sub.textContent=row.desc+' · '+dStr;
    var items=row.mtDet||[];
    if(!items.length){ html='<div style="color:var(--text3);font-size:13px;padding:20px 0">Sin M-T ese día</div>'; }
    else {
      html='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="border-bottom:1px solid var(--border)">'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Tipo</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Motivo</th>'+
          '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Cantidad</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Obs.</th>'+
        '</tr></thead><tbody>';
      items.forEach(function(m,i){
        var bg=i%2===0?'':'background:var(--surface2)';
        var bc=m.tipo==='MERMA'?'var(--danger)':'var(--blue)';
        html+='<tr style="'+bg+'">'+
          '<td style="padding:7px 8px"><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;border:1px solid '+bc+';color:'+bc+'">'+esc(m.tipo)+'</span></td>'+
          '<td style="padding:7px 8px;color:var(--text2)">'+esc(m.motivo||'—')+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--warn)">'+fmt(m.cant)+'</td>'+
          '<td style="padding:7px 8px;color:var(--text3);font-size:11px">'+esc(m.obs||'—')+'</td>'+
        '</tr>';
      });
      var total=items.reduce(function(a,m){return a+m.cant;},0);
      html+='<tr style="border-top:2px solid var(--border);font-weight:700">'+
        '<td colspan="2" style="padding:8px;font-size:11px;color:var(--text3)">TOTAL</td>'+
        '<td style="padding:8px;text-align:right;color:var(--warn)">'+fmt(total)+'</td>'+
        '<td></td></tr></tbody></table>';
    }
  } else if(tipo==='ent'){
    title.textContent='Entradas — '+sku;
    sub.textContent=row.desc+' · '+dStr;
    var items=row.entradasDet||[];
    if(!items.length){ html='<div style="color:var(--text3);font-size:13px;padding:20px 0">Sin entradas ese día</div>'; }
    else {
      html='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="border-bottom:1px solid var(--border)">'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Factura</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Proveedor</th>'+
          '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Unidades</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Responsable</th>'+
        '</tr></thead><tbody>';
      items.forEach(function(e,i){
        var bg=i%2===0?'':'background:var(--surface2)';
        html+='<tr style="'+bg+'">'+
          '<td style="padding:7px 8px;font-family:var(--font-mono);font-size:11px;color:var(--p600)">'+esc(e.factura||'—')+'</td>'+
          '<td style="padding:7px 8px;color:var(--text2)">'+esc(e.proveedor||'—')+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--ok)">'+fmt(e.unidades)+'</td>'+
          '<td style="padding:7px 8px;color:var(--text3);font-size:11px">'+esc(e.responsable||'—')+'</td>'+
        '</tr>';
      });
      var total=items.reduce(function(a,e){return a+e.unidades;},0);
      html+='<tr style="border-top:2px solid var(--border);font-weight:700">'+
        '<td colspan="2" style="padding:8px;font-size:11px;color:var(--text3)">TOTAL</td>'+
        '<td style="padding:8px;text-align:right;color:var(--ok)">'+fmt(total)+'</td>'+
        '<td></td></tr></tbody></table>';
    }
  }
  body.innerHTML=html;
  modal.style.display='flex';
}

function cerrarModalMov(){
  document.getElementById('modal-mov').style.display='none';
}

/* ══════════════════════════════════════
   ÓRDENES DE COMPRA — hoja externa compartida
══════════════════════════════════════ */
var OC_ROWS_PARSED = []; // filas del Excel ya parseadas, pendientes de importar

function _ocBadge(estado){
  var e=(estado||'Pendiente').trim();
  var cls=e==='Recibido'?'badge-ok':'badge-warn';
  return '<span class="badge '+cls+'">'+esc(e)+'</span>';
}

function _dashSedeDeOC(r){
  var s=((DASH.d&&DASH.d.sedes)||[]).filter(function(x){return x.id===r.sedeId;})[0];
  return s?s.nombre:'';
}
function filterOC(){
  var q=((document.getElementById('oc-busq')||{}).value||'').toLowerCase();
  var estadoF=((document.getElementById('oc-estado-filtro')||{}).value||'');
  var rows=(DATA.oc||[]).filter(function(r){
    var okQ=!q||
      (r.oc||'').toLowerCase().indexOf(q)>-1||
      (r.proveedor||'').toLowerCase().indexOf(q)>-1||
      (r.entrega||'').toLowerCase().indexOf(q)>-1;
    var okE=!estadoF||(r.estado||'Pendiente')===estadoF;
    var okS=!DASH.sede||_dashSedeDeOC(r)===DASH.sede;
    return okQ&&okE&&okS;
  });
  rows.sort(function(a,b){return (b._row||0)-(a._row||0);});
  var el=document.getElementById('oc-count');
  if(el)el.textContent=rows.length+' registros';
  var tbody=rows.map(function(r){
    return '<tr class="oc-row" data-oc="'+esc(r.oc)+'" style="cursor:pointer">'+
      '<td class="mono" style="font-size:12px">'+esc(r.fechaRecepcion||'—')+'</td>'+
      '<td class="mono">'+esc(r.oc)+'</td>'+
      '<td class="td-desc" title="'+esc(r.proveedor)+'">'+esc(r.proveedor)+'</td>'+
      '<td class="td-desc" title="'+esc(r.entrega)+'">'+esc(r.entrega||'—')+'</td>'+
      '<td class="c">'+_ocBadge(r.estado)+'</td>'+
    '</tr>';
  }).join('');
  var t=document.getElementById('oc-tbody');
  if(t){
    t.innerHTML=tbody||'<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:40px">Sin órdenes de compra registradas</td></tr>';
    t.querySelectorAll('.oc-row').forEach(function(tr){
      tr.addEventListener('click', function(){ abrirDetalleEntradaOCGlobal(tr.dataset.oc); });
    });
  }
}

function _isoToDDMMYYYY(iso){
  if(!iso) return '';
  var p=iso.split('-');
  if(p.length!==3) return '';
  return p[2]+'/'+p[1]+'/'+p[0];
}

function loadRecepcionesPorTienda(fechaISO){
  var grid=document.getElementById('oc-recep-grid');
  if(grid) grid.innerHTML=LD('Cargando');
  google.script.run
    .withSuccessHandler(function(r){DASH.rec=r;renderRecepcionesPorTienda(r);})
    .withFailureHandler(function(e){
      var g=document.getElementById('oc-recep-grid');
      if(g) g.innerHTML='<div style="color:var(--danger);font-size:12px;padding:8px 0">'+esc(e.message)+'</div>';
    })
    .getRecepcionesPorTienda(S.token, _isoToDDMMYYYY(fechaISO));
}

function renderRecepcionesPorTienda(r){
  var grid=document.getElementById('oc-recep-grid');
  if(!grid) return;
  if(!r||!r.ok){grid.innerHTML='<div style="color:var(--danger);font-size:12px;padding:8px 0">'+esc((r&&r.error)||'Error al cargar recepciones')+'</div>';return;}

  // Sincroniza el input de fecha con la fecha realmente consultada (por defecto: hoy en Lima)
  var inp=document.getElementById('oc-recep-fecha');
  if(inp && r.fecha){
    var p=r.fecha.split('/'); // dd/mm/yyyy
    if(p.length===3) inp.value=p[2]+'-'+p[1]+'-'+p[0];
  }

  var tiendas=(r.data||[]).filter(function(st){return !DASH.sede||st.nombre===DASH.sede;});
  if(!tiendas.length){
    grid.innerHTML='<div class="stat-card"><div class="stat-label">Sin tiendas registradas</div></div>';
    return;
  }
  grid.innerHTML=tiendas.map(function(st){
    var ocsHtml = (st.ocs&&st.ocs.length)
      ? '<div class="oc-chip-list" data-tienda="'+esc(st.nombre)+'" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">'+
          st.ocs.map(function(oc){
            return '<span class="badge badge-accent oc-chip" data-oc="'+esc(oc)+'" style="cursor:pointer">'+esc(oc)+'</span>';
          }).join('')+
        '</div>'
      : '<div style="margin-top:12px;font-size:11px;color:var(--text4)">Sin OC recibidas</div>';
    return '<div class="stat-card"><div class="stat-label">'+esc(st.nombre)+'</div>'+
      '<div class="stat-val-row"><div class="stat-val">'+st.recepciones+'</div><span class="stat-unit-pill">OC recibidas</span></div>'+
      ocsHtml+
    '</div>';
  }).join('');
  grid.querySelectorAll('.oc-chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      var tienda=chip.closest('.oc-chip-list').dataset.tienda;
      abrirDetalleEntradaOC(tienda, chip.dataset.oc);
    });
  });
}

function abrirDetalleEntradaOC(tienda, oc){
  document.getElementById('detalle-oc-title').textContent='OC '+oc;
  document.getElementById('detalle-oc-subtitle').textContent=tienda+' · cargando...';
  document.getElementById('detalle-oc-body').innerHTML=LD('Cargando detalle');
  document.getElementById('btn-detalle-oc-export').style.display='none';
  document.getElementById('modal-detalle-oc').style.display='flex';
  google.script.run
    .withSuccessHandler(function(r){renderDetalleOC(r);})
    .withFailureHandler(function(e){
      document.getElementById('detalle-oc-body').innerHTML='<div style="padding:24px;color:var(--danger);font-size:12px">'+esc(e.message)+'</div>';
    })
    .getDetalleEntradaOC(S.token, tienda, oc);
}

// Igual que abrirDetalleEntradaOC pero sin saber de antemano la tienda —
// busca en todas (usado al hacer click en una fila de la tabla principal de OC).
function abrirDetalleEntradaOCGlobal(oc){
  document.getElementById('detalle-oc-title').textContent='OC '+oc;
  document.getElementById('detalle-oc-subtitle').textContent='Buscando en todas las tiendas...';
  document.getElementById('detalle-oc-body').innerHTML=LD('Cargando detalle');
  document.getElementById('btn-detalle-oc-export').style.display='none';
  document.getElementById('modal-detalle-oc').style.display='flex';
  google.script.run
    .withSuccessHandler(function(r){renderDetalleOC(r);})
    .withFailureHandler(function(e){
      document.getElementById('detalle-oc-body').innerHTML='<div style="padding:24px;color:var(--danger);font-size:12px">'+esc(e.message)+'</div>';
    })
    .getDetalleEntradaOCGlobal(S.token, oc);
}

var DETALLE_OC_DATA=[];    // último detalle cargado en el modal — usado para exportar
var DETALLE_OC_CURRENT=''; // OC actualmente mostrada — usada para el nombre del archivo exportado

function renderDetalleOC(r){
  var body=document.getElementById('detalle-oc-body');
  var btnExp=document.getElementById('btn-detalle-oc-export');
  DETALLE_OC_DATA=[];
  DETALLE_OC_CURRENT=(r&&r.oc)||'';
  if(!r||!r.ok){
    body.innerHTML='<div style="padding:24px;color:var(--danger);font-size:12px">'+esc((r&&r.error)||'Error al cargar detalle')+'</div>';
    btnExp.style.display='none';
    return;
  }
  if(!r.data||!r.data.length){
    body.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px">Sin ítems registrados en ENTRADAS para esta OC</div>';
    document.getElementById('detalle-oc-subtitle').textContent='Sin ítems registrados';
    btnExp.style.display='none';
    return;
  }
  DETALLE_OC_DATA=r.data;
  var totalUnd=r.data.reduce(function(a,x){return a+(Number(x.unidades)||0);},0);
  var tiendas=r.data.reduce(function(acc,x){ if(x.tienda&&acc.indexOf(x.tienda)===-1)acc.push(x.tienda); return acc; },[]);
  var tiendaTxt=tiendas.length===1?tiendas[0]:(tiendas.length+' tienda'+(tiendas.length===1?'':'s'));
  document.getElementById('detalle-oc-subtitle').textContent=tiendaTxt+' · '+r.data.length+' ítem(s) · '+fmt(totalUnd)+' und.';
  var rows=r.data.map(function(it){
    return '<tr>'+
      '<td class="td-desc" style="font-size:11px;color:var(--text3)">'+esc(it.tienda||'—')+'</td>'+
      '<td class="mono">'+esc(it.sku)+'</td>'+
      '<td class="td-desc" title="'+esc(it.desc)+'">'+esc(it.desc)+'</td>'+
      '<td class="r" style="font-weight:600">'+fmt(it.unidades)+'</td>'+
      '<td class="mono" style="font-size:11px;color:var(--text3)">'+esc(it.fecha||'—')+'</td>'+
      '<td class="mono" style="font-size:11px;color:var(--text3)">'+esc(it.factura||'—')+'</td>'+
    '</tr>';
  }).join('');
  body.innerHTML='<div class="table-wrap"><table><thead><tr><th>Tienda</th><th>SKU</th><th>Descripción</th><th class="r">Und.</th><th>Fecha</th><th>Factura</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  btnExp.style.display='';
}

function exportarDetalleOC(){
  if(!DETALLE_OC_DATA.length){showToast('Sin datos para exportar','err');return;}
  _exportXLSX(
    ['Tienda','SKU','Descripción','Unidades','Fecha','Factura'],
    DETALLE_OC_DATA,
    function(it){return[it.tienda||'',it.sku,it.desc,it.unidades,it.fecha||'',it.factura||''];},
    'Detalle OC',
    'detalle_'+(DETALLE_OC_CURRENT||'oc').replace(/[^a-zA-Z0-9\-]/g,'_')
  );
}

function cerrarDetalleOC(){
  document.getElementById('modal-detalle-oc').style.display='none';
}

function exportOC(){
  var rows=DATA.oc||[];
  if(!rows.length){showToast('Sin datos para exportar','err');return;}
  _exportXLSX(
    ['Fecha de recepción solicitada','Orden de compra','Nombre del proveedor','Nombre de entrega','Estado de recepcion'],
    rows,
    function(r){return[r.fechaRecepcion||'',r.oc,r.proveedor,r.entrega||'',r.estado||'Pendiente'];},
    'OC',
    'ordenes_compra'
  );
}

/* ── Importar OC desde Excel ── */
function abrirImportarOC(){
  clearOCFile();
  document.getElementById('oc-import-err').textContent='';
  openFS('fs-oc-import');
}

function handleOCDrop(event){
  event.preventDefault();
  document.getElementById('oc-drop-zone').style.borderColor='var(--border2)';
  var file=event.dataTransfer.files[0];
  if(file)handleOCFileSelect(file);
}

function _ocFechaToStr(v){
  if(v instanceof Date && !isNaN(v)){
    var d=('0'+v.getDate()).slice(-2), m=('0'+(v.getMonth()+1)).slice(-2), y=v.getFullYear();
    return d+'/'+m+'/'+y;
  }
  if(typeof v==='number' && v>20000 && v<80000){
    var epoch=new Date(Math.round((v-25569)*86400*1000));
    var d2=('0'+epoch.getUTCDate()).slice(-2), m2=('0'+(epoch.getUTCMonth()+1)).slice(-2), y2=epoch.getUTCFullYear();
    return d2+'/'+m2+'/'+y2;
  }
  return String(v||'').trim();
}

// Mapa: campo interno: posibles encabezados normalizados (sin tildes, minúsculas) que puede traer el Excel.
// Permite aceptar formatos con columnas en distinto orden, de menos columnas, o con nombres levemente distintos.
var OC_FIELD_HEADERS = {
  oc:                  ['orden de compra'],
  cuentaProveedor:     ['cuenta de proveedor'],
  cuentaFacturacion:   ['cuenta de facturacion'],
  proveedor:           ['nombre del proveedor'],
  tipoCompra:          ['tipo de compra'],
  estadoAprobacion:    ['estado de aprobacion'],
  estadoOrden:         ['estado de orden de compra'],
  divisa:              ['divisa'],
  fechaRecepcion:      ['fecha de recepcion solicitada'],
  modoEntrega:         ['modo de entrega'],
  condicionesEntrega:  ['condiciones de entrega'],
  acuerdoCompra:       ['acuerdo de compra'],
  entregaDirecta:      ['entrega directa'],
  subcontratoProyecto: ['numero del subcontrato del proyecto'],
  nombreEntrega:       ['nombre de entrega'],
  almacen:             ['almacen']
};

function _normHeader(s){
  return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function handleOCFileSelect(file){
  if(!file)return;
  var err=document.getElementById('oc-import-err');
  err.textContent='';
  if(!file.name.match(/\.xlsx?$/i)){err.textContent='Solo se aceptan archivos .xlsx o .xls';return;}

  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=new Uint8Array(e.target.result);
      var wb=XLSX.read(data,{type:'array',cellDates:true});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(!rows.length){err.textContent='El archivo está vacío';return;}

      // Ubicar cada campo por nombre de columna, sin importar orden ni si faltan columnas
      var headerRow=rows[0]||[];
      var headerIdx={};
      headerRow.forEach(function(h,i){ headerIdx[_normHeader(h)]=i; });
      var idx={};
      Object.keys(OC_FIELD_HEADERS).forEach(function(field){
        var candidatos=OC_FIELD_HEADERS[field];
        idx[field]=-1;
        for(var i=0;i<candidatos.length;i++){
          if(headerIdx.hasOwnProperty(candidatos[i])){ idx[field]=headerIdx[candidatos[i]]; break; }
        }
      });
      if(idx.oc===-1){ err.textContent='No se encontró la columna "Orden de compra" en el archivo'; return; }

      var getCell=function(row,field){
        return idx[field]>-1 ? row[idx[field]] : '';
      };

      OC_ROWS_PARSED=[];
      rows.slice(1).forEach(function(row){
        var oc=String(getCell(row,'oc')||'').trim();
        if(!oc||_normHeader(oc)==='orden de compra')return;
        OC_ROWS_PARSED.push({
          oc: oc,
          cuentaProveedor:     String(getCell(row,'cuentaProveedor')||'').trim(),
          cuentaFacturacion:   String(getCell(row,'cuentaFacturacion')||'').trim(),
          proveedor:           String(getCell(row,'proveedor')||'').trim(),
          tipoCompra:          String(getCell(row,'tipoCompra')||'').trim(),
          estadoAprobacion:    String(getCell(row,'estadoAprobacion')||'').trim(),
          estadoOrden:         String(getCell(row,'estadoOrden')||'').trim(),
          divisa:              String(getCell(row,'divisa')||'').trim(),
          fechaRecepcion:      _ocFechaToStr(getCell(row,'fechaRecepcion')),
          modoEntrega:         String(getCell(row,'modoEntrega')||'').trim(),
          condicionesEntrega:  String(getCell(row,'condicionesEntrega')||'').trim(),
          acuerdoCompra:       String(getCell(row,'acuerdoCompra')||'').trim(),
          entregaDirecta:      String(getCell(row,'entregaDirecta')||'').trim(),
          subcontratoProyecto: String(getCell(row,'subcontratoProyecto')||'').trim(),
          nombreEntrega:       String(getCell(row,'nombreEntrega')||'').trim(),
          almacen:             String(getCell(row,'almacen')||'').trim()
        });
      });

      if(!OC_ROWS_PARSED.length){err.textContent='No se encontraron órdenes de compra en el archivo';return;}
      renderOCPreview();
    }catch(ex){err.textContent='Error leyendo archivo: '+ex.message;}
  };
  reader.readAsArrayBuffer(file);
}

function renderOCPreview(){
  document.getElementById('oc-preview-title').textContent=
    'Vista previa — '+OC_ROWS_PARSED.length+' orden(es) encontradas';
  var tbody=OC_ROWS_PARSED.map(function(r,i){
    return '<tr>'+
      '<td class="mono" style="font-size:11px;color:var(--text3)">'+(i+1)+'</td>'+
      '<td class="mono">'+esc(r.oc)+'</td>'+
      '<td class="td-desc">'+esc(r.proveedor)+'</td>'+
      '<td class="mono" style="font-size:12px">'+esc(r.fechaRecepcion||'—')+'</td>'+
      '<td class="td-desc">'+esc(r.nombreEntrega||'—')+'</td>'+
      '<td class="c">'+_ocBadge('Pendiente')+'</td>'+
    '</tr>';
  }).join('');
  document.getElementById('oc-preview-tbody').innerHTML=tbody;
  document.getElementById('oc-preview').classList.remove('hidden');
  document.getElementById('btn-oc-import-confirm').disabled=false;
}

function clearOCFile(){
  OC_ROWS_PARSED=[];
  document.getElementById('oc-file-inp').value='';
  document.getElementById('oc-preview').classList.add('hidden');
  document.getElementById('btn-oc-import-confirm').disabled=true;
}

function confirmarImportarOC(){
  if(!OC_ROWS_PARSED.length)return;
  var btn=document.getElementById('btn-oc-import-confirm');
  var err=document.getElementById('oc-import-err');
  err.textContent='';
  btn.disabled=true;btn.textContent='Importando...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Importar';
      if(!r||!r.ok){err.textContent=(r&&r.error)||'Error al importar';return;}
      closeFS('fs-oc-import');
      showToast(r.agregadas+' OC nuevas cargadas'+(r.omitidas?', '+r.omitidas+' omitidas (ya existían)':''),'ok');
      reloadPage('dashboard');
    })
    .withFailureHandler(function(e){
      btn.disabled=false;btn.textContent='Importar';
      err.textContent=e.message;
    })
    .importarOC(S.token, OC_ROWS_PARSED);
}

/* ── Validar recepción: cruza ENTRADAS de todas las tiendas contra el maestro OC ── */
function validarRecepcionOC(){
  var btn=document.getElementById('btn-oc-validar');
  if(btn){btn.disabled=true;}
  showToast('Validando recepción contra ENTRADAS de todas las tiendas...','info');
  google.script.run
    .withSuccessHandler(function(r){
      if(btn){btn.disabled=false;}
      if(!r||!r.ok){showToast((r&&r.error)||'Error al validar','err');return;}
      showToast(r.actualizadas+' OC actualizadas a "Recibido"','ok');
      reloadPage('dashboard');
    })
    .withFailureHandler(function(e){
      if(btn){btn.disabled=false;}
      showToast(e.message,'err');
    })
    .validarRecepcionOC(S.token);
}

/* ── Catálogo MAESTRO en memoria (Validación + Reemplazar SKU) ── */
var _MAESTRO_LOCAL = null; // caché en memoria del catálogo MAESTRO propio de la tienda

function _cargarMaestro(cb){
  if(_MAESTRO_LOCAL){ if(cb) cb(); return; }
  google.script.run
    .withSuccessHandler(function(r){
      if(r&&r.ok){ _MAESTRO_LOCAL=r.data; }
      if(cb) cb();
    })
    .withFailureHandler(function(){ if(cb) cb(); })
    .getMaestroCompleto(S.token);
}

/* ══════════════════════════════════════
   REEMPLAZAR SKU — SALIDAS
══════════════════════════════════════ */
var _rskuOrigenSKU='', _rskuDestSKU='', _rskuDestDesc='';
var _eskuRow=null, _eskuNuevoSKU='', _eskuNuevaDesc='';

// ── Modal Reemplazar masivo ──
function abrirReemplazarSKU(){
  _rskuOrigenSKU=''; _rskuDestSKU=''; _rskuDestDesc='';
  ['rsku-origen','rsku-destino'].forEach(function(id){ document.getElementById(id).value=''; });
  ['rsku-origen-sel','rsku-destino-sel','rsku-preview','rsku-sel-panel','rsku-confirm-btn'].forEach(function(id){
    document.getElementById(id).style.display='none';
  });
  document.getElementById('rsku-preview-btn').style.display='';
  document.getElementById('rsku-err').textContent='';
  var m=document.getElementById('modal-reemplazar-sku');
  m.style.display='flex';
  // Cargar MAESTRO y cuando esté listo re-disparar búsqueda si hay texto
  if(!_MAESTRO_LOCAL){
    _cargarMaestro(function(){
      ['origen','destino'].forEach(function(t){
        var inp=document.getElementById('rsku-'+t);
        if(inp&&inp.value.trim()) buscarRSKU(t);
      });
    });
  }
  setTimeout(function(){ document.getElementById('rsku-origen').focus(); },200);
}

function cerrarModalRSKU(){
  document.getElementById('modal-reemplazar-sku').style.display='none';
}

function buscarRSKU(tipo){
  var inputId='rsku-'+tipo;
  var resId='rsku-'+tipo+'-results';
  var q=(document.getElementById(inputId).value||'').trim().toLowerCase();
  var res=document.getElementById(resId);
  if(!q){ res.style.display='none'; return; }

  function doSearch(){
    var skuSet={};
    (DATA.salidas||[]).forEach(function(r){
      if(!skuSet[r.sku]) skuSet[r.sku]={sku:r.sku, desc:r.desc};
    });
    var matches=Object.values(skuSet).filter(function(p){
      return p.sku.toLowerCase().includes(q)||p.desc.toLowerCase().includes(q);
    });
    if(_MAESTRO_LOCAL){
      dbg('[RSKU] MAESTRO cargado, items:', _MAESTRO_LOCAL.length, '| query:', q);
      var sample=_MAESTRO_LOCAL.find(function(p){ return p.lovis&&p.lovis.includes('10000235'); });
      dbg('[RSKU] muestra 10000235:', sample);
      _MAESTRO_LOCAL.filter(function(p){
        return !skuSet[p.lovis]&&(p.lovis.toLowerCase().includes(q)||p.desc.toLowerCase().includes(q));
      }).forEach(function(p){ matches.push({sku:p.lovis,desc:p.desc}); });
    } else {
      dbg('[RSKU] MAESTRO no cargado aún');
    }
    matches=matches.slice(0,25);
    if(!matches.length){
      res.innerHTML='<div style="padding:10px;font-size:12px;color:var(--text3)">Sin resultados para "'+esc(q)+'"</div>';
      res.style.display='block'; return;
    }
    res.innerHTML=matches.map(function(p,i){
      return '<div class="bees-opt" id="rsku-opt-'+tipo+'-'+i+'" style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px">'
        +'<span style="font-family:monospace;font-size:11px;background:var(--surface2);padding:1px 5px;border-radius:3px;margin-right:6px">'+esc(p.sku)+'</span>'
        +esc(p.desc)+'</div>';
    }).join('');
    res.querySelectorAll('.bees-opt').forEach(function(el,i){
      el.addEventListener('click',function(){ seleccionarRSKU(tipo, matches[i]); });
    });
    res.style.display='block';
  }

  if(_MAESTRO_LOCAL){ doSearch(); }
  else {
    res.innerHTML=LDm('Cargando catálogo');
    res.style.display='block';
    _cargarMaestro(doSearch);
  }
}

function seleccionarRSKU(tipo, p){
  document.getElementById('rsku-'+tipo).value=p.desc||p.sku;
  document.getElementById('rsku-'+tipo+'-results').style.display='none';
  document.getElementById('rsku-'+tipo+'-val').textContent=p.sku;
  var descEl=document.getElementById('rsku-'+tipo+'-desc');
  if(descEl) descEl.textContent=p.desc||'—';
  document.getElementById('rsku-'+tipo+'-sel').style.display='block';
  if(tipo==='origen') _rskuOrigenSKU=p.sku;
  else { _rskuDestSKU=p.sku; _rskuDestDesc=p.desc; }
  // Resetear preview al cambiar selección
  document.getElementById('rsku-preview').style.display='none';
  document.getElementById('rsku-confirm-btn').style.display='none';
  document.getElementById('rsku-preview-btn').style.display='';
}

var _rskuAfectados=[]; // cache de filas afectadas para el panel

function previewReemplazarSKU(){
  var err=document.getElementById('rsku-err');

  // Aceptar SKU escrito manualmente si no se seleccionó del dropdown
  if(!_rskuOrigenSKU){
    var origenInput=(document.getElementById('rsku-origen').value||'').trim();
    var matchOrigen=(DATA.salidas||[]).find(function(r){ return r.sku===origenInput; });
    if(matchOrigen){ _rskuOrigenSKU=matchOrigen.sku; }
    else { err.textContent='Seleccioná el SKU origen del listado'; return; }
  }
  if(!_rskuDestSKU){
    var destInput=(document.getElementById('rsku-destino').value||'').trim();
    if(!destInput){ err.textContent='Ingresá o seleccioná el SKU nuevo'; return; }
    var matchDest=null;
    if(_MAESTRO_LOCAL) matchDest=_MAESTRO_LOCAL.find(function(p){ return p.lovis===destInput; });
    if(!matchDest) matchDest=(DATA.salidas||[]).map(function(r){ return {lovis:r.sku,desc:r.desc}; }).find(function(p){ return p.lovis===destInput; });
    if(matchDest){ _rskuDestSKU=matchDest.lovis; _rskuDestDesc=matchDest.desc||destInput; }
    else { _rskuDestSKU=destInput; _rskuDestDesc=destInput; }
  }

  if(_rskuOrigenSKU===_rskuDestSKU){ err.textContent='El SKU origen y destino son iguales'; return; }
  err.textContent='';

  _rskuAfectados=(DATA.salidas||[]).filter(function(r){ return r.sku===_rskuOrigenSKU; });
  var prev=document.getElementById('rsku-preview');
  var panel=document.getElementById('rsku-sel-panel');

  if(!_rskuAfectados.length){
    prev.innerHTML='<span style="color:var(--text3)">No hay registros con SKU <strong>'+esc(_rskuOrigenSKU)+'</strong> en las salidas cargadas.</span>';
    prev.style.display='block';
    panel.style.display='none';
    document.getElementById('rsku-confirm-btn').style.display='none';
    return;
  }

  prev.style.display='none';
  panel.style.display='flex';
  document.getElementById('rsku-preview-btn').style.display='none';

  // Construir lista de filas con checkbox
  var list=document.getElementById('rsku-sel-list');
  list.innerHTML='';
  _rskuAfectados.forEach(function(r,i){
    var und=Number(r.unidad)||0;
    var nro=r.nroPedido||'—';
    var fecha=r.fecha||'';
    var row=document.createElement('label');
    row.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;';
    row.innerHTML=
      '<input type="checkbox" data-row="'+r._row+'" data-und="'+und+'" checked '+
        'onchange="rskuUpdateSel()" '+
        'style="width:14px;height:14px;flex-shrink:0;cursor:pointer;accent-color:var(--accent)"/>'+
      '<span style="flex:1;min-width:0">'+
        '<span style="font-weight:600;color:var(--text)">'+esc(nro)+'</span>'+
        '<span style="color:var(--text3);font-size:11px;margin-left:6px">'+esc(fecha)+'</span>'+
      '</span>'+
      '<span style="color:var(--accent);font-weight:700;white-space:nowrap;font-size:12px">'+und+' und</span>';
    list.appendChild(row);
  });

  // Marcar "seleccionar todos" como checked
  var selAll=document.getElementById('rsku-sel-all');
  selAll.checked=true;
  selAll.indeterminate=false;

  rskuUpdateSel();
}

function rskuToggleAll(checked){
  document.querySelectorAll('#rsku-sel-list input[type=checkbox]').forEach(function(cb){ cb.checked=checked; });
  rskuUpdateSel();
}

function rskuUpdateSel(){
  var cbs=document.querySelectorAll('#rsku-sel-list input[type=checkbox]');
  var checkedCbs=Array.prototype.filter.call(cbs,function(cb){ return cb.checked; });
  var totalUnd=checkedCbs.reduce(function(acc,cb){ return acc+(Number(cb.dataset.und)||0); },0);
  document.getElementById('rsku-sel-count').textContent=checkedCbs.length;
  document.getElementById('rsku-sel-units').textContent=totalUnd;
  // Estado del "seleccionar todos"
  var selAll=document.getElementById('rsku-sel-all');
  if(checkedCbs.length===0){ selAll.checked=false; selAll.indeterminate=false; }
  else if(checkedCbs.length===cbs.length){ selAll.checked=true; selAll.indeterminate=false; }
  else { selAll.checked=false; selAll.indeterminate=true; }
  // Mostrar/ocultar botón confirmar
  document.getElementById('rsku-confirm-btn').style.display=checkedCbs.length>0?'':'none';
}

function confirmarReemplazarSKU(){
  // Obtener las _row seleccionadas
  var cbs=document.querySelectorAll('#rsku-sel-list input[type=checkbox]:checked');
  var rowsSeleccionadas=Array.prototype.map.call(cbs,function(cb){ return Number(cb.dataset.row); });
  if(!rowsSeleccionadas.length){ document.getElementById('rsku-err').textContent='Seleccioná al menos un pedido'; return; }

  var btn=document.getElementById('rsku-confirm-btn');
  btn.disabled=true; btn.textContent='Reemplazando...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false; btn.textContent='Reemplazar seleccionados';
      if(!r||!r.ok){ document.getElementById('rsku-err').textContent=r?r.error:'Error al reemplazar'; return; }
      cerrarModalRSKU();
      showToast('SKU reemplazado en '+r.count+' registro'+(r.count!==1?'s':''),'ok');
      PAGE_LOADED['salidas']=false; reloadPage('salidas');
    })
    .withFailureHandler(function(e){
      btn.disabled=false; btn.textContent='Reemplazar seleccionados';
      document.getElementById('rsku-err').textContent=e.message;
    })
    .reemplazarSKUEnFilas(S.token, rowsSeleccionadas, _rskuDestSKU, _rskuDestDesc);
}

// ── Modal Editar SKU por fila ──
function abrirEditarSkuFila(rowNum){
  var row=(DATA.salidas||[]).find(function(r){ return r._row===rowNum; });
  if(!row) return;
  _eskuRow=row; _eskuNuevoSKU=''; _eskuNuevaDesc='';
  document.getElementById('esku-info').textContent='Fila '+rowNum+' · SKU actual: '+row.sku+' — '+row.desc;
  document.getElementById('esku-busq').value='';
  document.getElementById('esku-busq-results').style.display='none';
  document.getElementById('esku-sel-card').style.display='none';
  document.getElementById('esku-pack').value=row.pack;
  document.getElementById('esku-und').value=row.unidad;
  document.getElementById('esku-err').textContent='';
  document.getElementById('esku-save-btn').disabled=false;
  document.getElementById('esku-save-btn').textContent='Guardar';
  document.getElementById('modal-editar-sku-fila').style.display='flex';
  if(!_MAESTRO_LOCAL){
    _cargarMaestro(function(){
      var inp=document.getElementById('esku-busq');
      if(inp&&inp.value.trim()) buscarESKU();
    });
  }
  setTimeout(function(){ document.getElementById('esku-busq').focus(); },200);
}

// Al cambiar el pack, las unidades siguen la proporción original (p. ej. 24 und. por pack)
function _eskuPackCambio(){
  var r=_eskuRow; if(!r) return;
  var pk=parseInt(document.getElementById('esku-pack').value,10);
  if(isNaN(pk)||!(r.pack>0)) return;
  document.getElementById('esku-und').value=Math.round(pk*(r.unidad/r.pack));
}

function cerrarModalESKU(){
  document.getElementById('modal-editar-sku-fila').style.display='none';
}

function buscarESKU(){
  var q=(document.getElementById('esku-busq').value||'').trim().toLowerCase();
  var res=document.getElementById('esku-busq-results');
  if(!q){ res.style.display='none'; return; }

  function doSearch(){
    var skuSet={};
    (DATA.salidas||[]).forEach(function(r){ if(!skuSet[r.sku]) skuSet[r.sku]={sku:r.sku,desc:r.desc}; });
    var matches=Object.values(skuSet).filter(function(p){
      return p.sku.toLowerCase().includes(q)||p.desc.toLowerCase().includes(q);
    });
    if(_MAESTRO_LOCAL){
      _MAESTRO_LOCAL.filter(function(p){
        return !skuSet[p.lovis]&&(p.lovis.toLowerCase().includes(q)||p.desc.toLowerCase().includes(q));
      }).forEach(function(p){ matches.push({sku:p.lovis,desc:p.desc}); });
    }
    matches=matches.slice(0,25);
    if(!matches.length){
      res.innerHTML='<div style="padding:10px;font-size:12px;color:var(--text3)">Sin resultados</div>';
      res.style.display='block'; return;
    }
    res.innerHTML=matches.map(function(p,i){
      return '<div class="bees-opt" id="esku-opt-'+i+'" style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px">'
        +'<span style="font-family:monospace;font-size:11px;background:var(--surface2);padding:1px 5px;border-radius:3px;margin-right:6px">'+esc(p.sku)+'</span>'
        +esc(p.desc)+'</div>';
    }).join('');
    res.querySelectorAll('.bees-opt').forEach(function(el,i){
      el.addEventListener('click',function(){ seleccionarESKU(matches[i]); });
    });
    res.style.display='block';
  }

  if(_MAESTRO_LOCAL){ doSearch(); }
  else {
    res.innerHTML=LDm('Cargando catálogo');
    res.style.display='block';
    _cargarMaestro(doSearch);
  }
}

function seleccionarESKU(p){
  _eskuNuevoSKU=p.sku; _eskuNuevaDesc=p.desc;
  document.getElementById('esku-busq').value=p.desc||p.sku;
  document.getElementById('esku-busq-results').style.display='none';
  document.getElementById('esku-sel-desc').textContent=p.desc;
  document.getElementById('esku-sel-sku').textContent=p.sku;
  document.getElementById('esku-sel-card').style.display='block';
}

function guardarEditarSkuFila(){
  var err=document.getElementById('esku-err');
  // Aceptar SKU escrito manualmente si no se seleccionó del dropdown
  if(!_eskuNuevoSKU){
    var input=(document.getElementById('esku-busq').value||'').trim();
    if(input){
      var match=null;
      if(_MAESTRO_LOCAL) match=_MAESTRO_LOCAL.find(function(p){ return p.lovis===input; });
      if(!match) match=(DATA.salidas||[]).map(function(r){ return {lovis:r.sku,desc:r.desc}; }).find(function(p){ return p.lovis===input; });
      if(match){ _eskuNuevoSKU=match.lovis; _eskuNuevaDesc=match.desc||input; }
      else { _eskuNuevoSKU=input; _eskuNuevaDesc=input; }
    }
  }
  var packTxt=document.getElementById('esku-pack').value, undTxt=document.getElementById('esku-und').value;
  var cambiaSku=!!_eskuNuevoSKU && _eskuNuevoSKU!==_eskuRow.sku;
  var cambiaCant=String(packTxt)!==String(_eskuRow.pack) || String(undTxt)!==String(_eskuRow.unidad);
  if(!cambiaSku && !cambiaCant){ err.textContent='No hiciste ningún cambio'; return; }
  err.textContent='';
  var btn=document.getElementById('esku-save-btn');
  btn.disabled=true; btn.textContent='Guardando...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false; btn.textContent='Guardar';
      if(!r||!r.ok){ err.textContent=r?r.error:'Error al guardar'; return; }
      cerrarModalESKU();
      showToast('Fila actualizada','ok');
      PAGE_LOADED['salidas']=false; PAGE_LOADED['stock']=false; reloadPage('salidas');
    })
    .withFailureHandler(function(e){
      btn.disabled=false; btn.textContent='Guardar';
      err.textContent=e.message;
    })
    .editarSKUFila(S.token, _eskuRow._row, cambiaSku?_eskuNuevoSKU:'', _eskuNuevaDesc, packTxt, undTxt);
}



