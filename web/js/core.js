/* Núcleo: íconos, sesión, login, menú lateral, navegación y arranque de pantallas — parte de la antigua app.js; se carga en este orden desde index.html */
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
var _LD_NOM={dashboard:'dashboard',stock:'stock',entradas:'entradas',salidas:'salidas',mt:'mermas y traslados',cancelados:'cancelados',maestro:'maestro',mconteo:'maestro de conteo',conteo:'conteo',envases:'envases',documentos:'documentos',validacion:'validación'};
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
  PAGE_LOADED={dashboard:false,stock:false,entradas:false,salidas:false,mt:false,cancelados:false,maestro:false,mconteo:false,conteo:false,envases:false,documentos:false,validacion:false,oc:false};
  clearSession();
  document.getElementById('s-app').classList.remove('active');
  document.getElementById('s-login').classList.add('active');
  document.getElementById('inp-p').value='';
  document.getElementById('l-err').textContent='';
  toggleMobileMenu(false);
}

/* ── SIDEBAR TOGGLE ── */
var LS_KEY='ds-inv:'; // prefijo único — evita colisiones entre proyectos GAS en script.google.com
/* subtítulo del encabezado: sede y fecha de hoy */
function _pgSub(){
  var el=document.getElementById('pg-sub'); if(!el) return;
  var sede=(document.getElementById('sb-sede')||{}).textContent||'';
  var f=new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Lima'});
  sede=String(sede).replace(/^DS\s+/i,'');
  el.textContent=(sede&&sede!=='—'?sede+' · ':'')+f.charAt(0).toUpperCase()+f.slice(1);
}
function toggleSidebar(){
  var sb=document.getElementById('sidebar');
  sb.classList.toggle('collapsed');
  try{localStorage.setItem(LS_KEY+'sb_collapsed',sb.classList.contains('collapsed')?'1':'0');}catch(e){}
}
(function(){
  try{
    // en computadora el menú arranca como barra de iconos (se puede abrir y se recuerda)
    var pref=localStorage.getItem(LS_KEY+'sb_collapsed');
    if(localStorage.getItem(LS_KEY+'sb_v2')===null){      // una sola vez: el nuevo diseño arranca con la barra de iconos
      localStorage.setItem(LS_KEY+'sb_v2','1');
      if(window.innerWidth>=1100){ pref='1'; localStorage.setItem(LS_KEY+'sb_collapsed','1'); }
    }
    if(pref==='1'||(pref===null&&window.innerWidth>=1100)){
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
  _pgSub();
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
var PAGE_TITLES={'dashboard':'Dashboard','stock':'Stock Actual','entradas':'Entradas','salidas':'Salidas','mt':'Mermas & Traslados','cancelados':'Pedidos Cancelados','maestro':'Maestro de Productos (Bees)','mconteo':'Maestro de Conteo','conteo':'Conteo de Inventario','envases':'Control de Envases','documentos':'Documentos de despacho','validacion':'Validación de Inventario'};
var PAGE_LOADED={dashboard:false,stock:false,entradas:false,salidas:false,mt:false,cancelados:false,maestro:false,mconteo:false,conteo:false,envases:false,documentos:false,validacion:false,oc:false};


var CURRENT_PAGE = '';

function navTo(name,btn){
  CURRENT_PAGE = name;
  ['dashboard','stock','entradas','salidas','mt','cancelados','maestro','mconteo','conteo','envases','documentos','validacion'].forEach(function(n){
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
  _pgSub();
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
    el.innerHTML=btnPedido+btnRefresh; // Exportar vive en el panel de filtros de Salidas
  } else if(name==='entradas'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirEntrada()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Registrar entrada</span></button>'+btnRefresh; // Exportar vive en el panel de filtros
  } else if(name==='mt'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirNuevoMT()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Registrar M-T</span></button>'+btnExport+btnRefresh;
  } else if(name==='cancelados'){
    el.innerHTML=btnRefresh; // Exportar vive en el panel de filtros
  } else if(name==='maestro'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirMaestroForm(null)"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Agregar al maestro</span></button>'+btnExport+btnRefresh;
  } else if(name==='mconteo'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirMConteoForm(null)"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Agregar producto</span></button>'+btnExport+btnRefresh;
  } else if(name==='conteo'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="abrirConteo()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Registrar conteo</span></button>'+btnExport+
      '<button class="btn btn-ghost btn-sm tb-btn-icon" title="Actualizar" onclick="reloadConteoForce()">'+icoRefresh+'<span class="tb-btn-label"> Actualizar</span></button>';
  } else if(name==='envases'){
    el.innerHTML='<button class="btn btn-primary btn-sm" onclick="envContar()"><span class="tb-btn-plus">+</span><span class="tb-btn-label"> Contar</span></button>'+btnExport+btnRefresh;
  } else if(name==='documentos'){
    el.innerHTML=btnRefresh;
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
  if(name==='documentos') loadDocumentos();
  if(name==='validacion') initValidacion();
}
