/* Cascarón de la app: cargando, avisos, menú móvil, botón atrás, modo sin conexión, atajos — parte de la antigua app.js; se carga en este orden desde index.html */
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

/* ── LOGIN: mensajes, contraseña, aviso de Bloq Mayús y usuario recordado ── */
var _LG_ICO_ERR='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>';
var _LG_ICO_INFO='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>';
function loginMsg(tipo,texto,campo){
  var p=document.getElementById('l-msgp'), m=document.getElementById('l-msg'); if(!p||!m) return;
  p.innerHTML=(tipo==='err'?_LG_ICO_ERR:_LG_ICO_INFO)+'<span></span>';
  p.lastChild.textContent=texto;
  m.className='lg-msg on '+tipo;
  ['wu','wp'].forEach(function(w){ var e=document.getElementById(w); if(e) e.classList.remove('bad'); });
  if(campo){ var c=document.getElementById(campo); if(c) c.classList.add('bad'); }
}
function loginLimpia(){
  var m=document.getElementById('l-msg'); if(m) m.className='lg-msg';
  ['wu','wp'].forEach(function(w){ var e=document.getElementById(w); if(e) e.classList.remove('bad'); });
}
function loginCargando(on){
  var b=document.getElementById('btn-login'); if(!b) return;
  b.disabled=on; b.classList.toggle('load',on); b.setAttribute('aria-label',on?'Verificando':'Ingresar');
}
function loginAyuda(){ loginMsg('info','Entra con el usuario de tu sede, por ejemplo DS SAN MIGUEL. Si no lo recuerdas, consúltalo con tu administrador.'); }
function loginOlvide(){ loginMsg('info','Pide a tu administrador que restablezca tu contraseña. Ten a mano el nombre de tu sede.'); }
function togglePwd(){
  var inp=document.getElementById('inp-p'), eye=document.getElementById('pwd-eye'), btn=document.getElementById('pwd-toggle');
  var ver=inp.type==='password';
  inp.type=ver?'text':'password';
  btn.setAttribute('aria-pressed',ver); btn.setAttribute('aria-label',ver?'Ocultar contraseña':'Mostrar contraseña');
  eye.innerHTML=ver
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}
// Solo se recuerda el usuario (nunca la contraseña) en este equipo
function loginRecordar(u){
  try{ if(document.getElementById('inp-rec').checked) localStorage.setItem('tada-login-user',u); else localStorage.removeItem('tada-login-user'); }catch(e){}
}
(function loginIniciar(){
  var f=function(o){ return new Intl.DateTimeFormat('es-PE',Object.assign({timeZone:'America/Lima'},o)).format(new Date()); };
  var cap=function(t){ return t.charAt(0).toUpperCase()+t.slice(1); };
  var mes=document.getElementById('lg-mes'), anio=document.getElementById('lg-anio'), dia=document.getElementById('lg-dia');
  if(mes) mes.textContent=cap(f({month:'short'}).replace('.',''));
  if(anio) anio.textContent=f({year:'numeric'});
  if(dia) dia.innerHTML=cap(f({weekday:'long'}))+' '+f({day:'2-digit'})+'<br>'+cap(f({month:'long'}))+'<br>Ta·Da';
  var p=document.getElementById('inp-p'), u=document.getElementById('inp-u'); if(!p||!u) return;
  ['keydown','keyup'].forEach(function(ev){ p.addEventListener(ev,function(e){ var c=document.getElementById('l-caps'); if(c&&e.getModifierState) c.classList.toggle('on',e.getModifierState('CapsLock')); }); });
  p.addEventListener('blur',function(){ var c=document.getElementById('l-caps'); if(c) c.classList.remove('on'); });
  try{ var g=localStorage.getItem('tada-login-user'); if(g){ u.value=g; } }catch(e){}
  if(document.getElementById('s-login').classList.contains('active')) (u.value?p:u).focus();
})();

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
    'modal-anular-canc':'anularCancCerrar','modal-mov':'cerrarModalMov',
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
      showToast('Conexión restaurada, sincronizando conteos pendientes...', 'ok');
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
