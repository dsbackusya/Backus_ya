/* Utilidades y escáner de cámara — parte de la antigua app.js; se carga en este orden desde index.html */
/* ── UTILS ── */
function esc(v){
  if(v===null||v===undefined)return '';
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmt(v){return(v===null||v===undefined)?'-':Number(v).toLocaleString('es-PE');}

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

// Un solo contexto de audio para toda la sesión: crear uno por escaneo congela la pantalla un instante y se acumula
var _beepCtx = null;
function _scanBeepCtx(){
  var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  if (!_beepCtx || _beepCtx.state === 'closed') _beepCtx = new AC();
  if (_beepCtx.state === 'suspended') { try { _beepCtx.resume(); } catch(e){} }
  return _beepCtx;
}
function _scanBeepWarm(){ try { _scanBeepCtx(); } catch(e){} }
function _scanBeep(){
  try { if (navigator.vibrate) navigator.vibrate(80); } catch(e){}
  try {
    var ac = _scanBeepCtx(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = 1500; g.gain.value = 0.08;
    o.connect(g); g.connect(ac.destination);
    o.onended = function(){ try { o.disconnect(); g.disconnect(); } catch(e){} };
    o.start(); o.stop(ac.currentTime + 0.11);
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
    '<div style="color:#fff;padding:12px 16px;font:600 15px Inter,sans-serif;display:flex;justify-content:space-between;align-items:center;gap:8px">'+
      '<span style="flex:1">'+esc(title||'Escanea el código')+'</span>'+
      '<button type="button" id="scan-nativo-luz" style="display:none;background:#333;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:600">'+ICO('bolt',16,'s')+'</button>'+
      '<button type="button" id="scan-nativo-x" style="background:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:600">Cerrar</button>'+
    '</div>'+
    '<div style="position:relative;flex:1;min-height:0">'+
      '<video id="scan-nativo-v" playsinline muted autoplay style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>'+
      '<div style="position:absolute;left:50%;top:50%;width:78%;max-width:420px;height:34%;transform:translate(-50%,-50%);border:3px solid #B9AEFF;border-radius:14px;box-shadow:0 0 0 9999px rgba(0,0,0,.45);pointer-events:none"></div>'+
      '<div id="scan-nativo-msg" style="position:absolute;left:0;right:0;bottom:14px;text-align:center;color:#fff;font:500 13px Inter,sans-serif;padding:0 16px">Apunta al código de barras</div>'+
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
          luz.onclick = function(){ on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(function(){}); luz.style.background = on ? '#B9AEFF' : '#333'; };
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

// Respaldo para navegadores sin BarcodeDetector (iPhone/Safari, Firefox): librería ZXing.
// Rendimiento: antes se decodificaba el fotograma COMPLETO (hasta 1280×720) cada 120 ms en el hilo principal, lo que
// congelaba la pantalla. Ahora solo se lee la zona del marco, reducida a ≤640 px, con un canvas reutilizado y un ritmo
// que se adapta (nunca ocupa más de ~1/3 del tiempo). El modo "TRY_HARDER" se usa solo 1 de cada 4 intentos.
var _ZX_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
var _ZX_PRECARGA = null, _ZX_FALLO = false;
// Descarga el lector una sola vez; si falla, el siguiente intento vuelve a pedirlo (antes quedaba un <script> muerto para siempre)
function _scanCargarZXing(alCargar, alFallar){
  if (window.ZXing) { alCargar(); return; }
  if (!_ZX_PRECARGA || _ZX_FALLO) {
    _ZX_FALLO = false;
    if (_ZX_PRECARGA) _ZX_PRECARGA.remove();
    _ZX_PRECARGA = document.createElement('script');
    _ZX_PRECARGA.src = _ZX_URL; _ZX_PRECARGA.async = true;
    _ZX_PRECARGA.addEventListener('error', function(){ _ZX_FALLO = true; });
    document.head.appendChild(_ZX_PRECARGA);
  }
  if (alCargar) _ZX_PRECARGA.addEventListener('load', alCargar);
  if (alFallar) _ZX_PRECARGA.addEventListener('error', alFallar);
}
function _scanPrecargarZXing(){
  if ('BarcodeDetector' in window || window.ZXing || (_ZX_PRECARGA && !_ZX_FALLO)) return;
  _scanCargarZXing(null, null);
}
// Zona del video que está dentro del marco (video con object-fit: cover), un poco ampliada; null = fotograma completo
function _cntRegionMarco(video){
  try {
    var aim = document.querySelector('#fs-conteo .cnt-aim');
    var vw = video.videoWidth, vh = video.videoHeight;
    if (!aim || !vw || !vh) return null;
    var vr = video.getBoundingClientRect(), ar = aim.getBoundingClientRect();
    if (!vr.width || !vr.height || !ar.width) return null;
    var sc = Math.max(vr.width / vw, vr.height / vh);
    var ox = (vw * sc - vr.width) / 2, oy = (vh * sc - vr.height) / 2;
    var cx = (ar.left + ar.width / 2 - vr.left + ox) / sc, cy = (ar.top + ar.height / 2 - vr.top + oy) / sc;
    var w = Math.min(vw, ar.width * 1.25 / sc), h = Math.min(vh, ar.height * 1.7 / sc);
    var x = Math.max(0, Math.min(vw - w, cx - w / 2)), y = Math.max(0, Math.min(vh - h, cy - h / 2));
    return { x: x, y: y, w: w, h: h };
  } catch(e) { return null; }
}
function _scannerZXing(video, entregar, msg, est){
  est = est || _scanNat;
  function lanzar(){
    if (!est.activo) return;
    function hints(duro){
      var h = new Map();
      h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E,
        ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39, ZXing.BarcodeFormat.QR_CODE ]);
      if (duro) h.set(ZXing.DecodeHintType.TRY_HARDER, true);
      return h;
    }
    var rapido = new ZXing.MultiFormatReader(); rapido.setHints(hints(false));
    var duro = new ZXing.MultiFormatReader();   duro.setHints(hints(true));
    var cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    var n = 0, espera = 110;
    est.zx = { reset: function(){ clearTimeout(this.t); this.parar = true; } };
    (function paso(){
      var z = est.zx;
      if (!est.activo || !z || z.parar) return;
      var t0 = performance.now();
      if (video.readyState >= 2 && video.videoWidth) {
        var rg = (est === _cntCam ? _cntRegionMarco(video) : null) || { x: 0, y: 0, w: video.videoWidth, h: video.videoHeight };
        var esc = Math.min(1, 640 / rg.w), cw = Math.max(16, Math.round(rg.w * esc)), ch = Math.max(16, Math.round(rg.h * esc));
        if (cv.width !== cw) cv.width = cw;      // solo se cambia el tamaño si hace falta (cambiarlo vacía el canvas)
        if (cv.height !== ch) cv.height = ch;
        cx.drawImage(video, rg.x, rg.y, rg.w, rg.h, 0, 0, cw, ch);
        try {
          var bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(cv)));
          var res = ((++n % 4) === 0 ? duro : rapido).decode(bmp);
          if (res) { entregar(res.getText()); return; }
        } catch(e) { /* no se encontró código en este fotograma */ }
      }
      espera = Math.max(110, (performance.now() - t0) * 3);
      z.t = setTimeout(paso, espera);
    })();
  }
  _scanCargarZXing(lanzar, function(){ msg.textContent = 'No se pudo cargar el lector. Escribe el código abajo.'; });
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
// html = contenido de la capa sobre el visor; null = ocultarla y mostrar el visor.
// tono ('ok' | 'bad' | 'warn') pinta el marco de lectura (verde / rojo / ámbar).
function _cntCamNegro(html, tono){
  var off = document.getElementById('cnt-cam-off'); if (!off) return;
  var vivo = !html;
  off.style.display = vivo ? 'none' : 'flex';
  if (!vivo) off.innerHTML = html;
  var cam = document.getElementById('cnt-cam');
  if (cam) {
    cam.classList.toggle('off', !vivo);
    cam.classList.remove('st-ok', 'st-bad', 'st-warn');
    if (!vivo && tono) cam.classList.add('st-' + tono);
  }
  var live = document.getElementById('cnt-live'); if (live) live.textContent = vivo ? '' : off.textContent;   // lector de pantalla: anuncia el estado de la cámara
  var l = document.getElementById('cnt-cam-line'); if (l) l.style.display = vivo ? '' : 'none';
  var m = document.getElementById('cnt-cam-msg');  if (m) m.style.display = vivo ? '' : 'none';
}
// El marco de lectura cambia de estado: icono dentro del marco y, debajo, título, texto y enlace. Tocar vuelve a escanear.
var _CNT_ICO = {
  ok:   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  bad:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  cam:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M9.5 5h5l1.5 2H19a2 2 0 0 1 2 2v7.5M7 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12"/><path d="M10.2 10.2a3 3 0 0 0 3.6 3.6"/></svg>'
};
function _cntOff(ico, titulo, sub, enlace){
  return '<div class="cnt-off-ic">' + _CNT_ICO[ico] + '</div>' +
    '<div class="cnt-off-cap"><div class="cnt-off-t">' + esc(titulo) + '</div>' +
    (sub ? '<div class="cnt-off-sub">' + esc(sub) + '</div>' : '') +
    (enlace ? '<span class="cnt-off-b">' + esc(enlace) + '</span>' : '') + '</div>';
}
function _cntCamPausar(codigo){
  _cntCamDetener();
  _cntCamNegro(_cntOff('ok', 'Código leído', (codigo ? codigo + ' · ' : '') + 'Buscando el producto…'), 'ok');
}
function _cntCamNoEncontrado(){
  if (_cntCam.activo) return; // el código se escribió a mano con la cámara encendida: no se toca el visor
  _cntCamNegro(_cntOff('bad', 'Código no encontrado', 'Revisa el código o búscalo por nombre', 'Escanear otro'), 'bad');
}
function _cntCamSinCamara(texto){
  _cntCamDetener();
  _cntCamNegro(_cntOff('cam', 'Cámara no disponible', texto, 'Reintentar'), 'warn');
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
    _cntCamSinCamara('Ábrela por https o instalada. Mientras, escribe el código.');
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
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } },
    audio: false
  })
    .then(function(stream){
      _cntCam.iniciando = false;
      var f2 = document.getElementById('fs-conteo');
      if (!_cntCamAbierta() || !f2 || f2.classList.contains('cnt-det')) { stream.getTracks().forEach(function(t){ t.stop(); }); return; }
      _cntCam.stream = stream; _cntCam.activo = true; _cntCam.error = false;
      video.srcObject = stream;
      msg.textContent = 'Centra el código de barras en el marco';

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
            var ultimo = 0, espera = 90;
            (function tick(t){
              if (!_cntCam.activo) return;
              if (t - ultimo < espera || video.readyState < 2) { _cntCam.raf = requestAnimationFrame(tick); return; }
              ultimo = t;
              var t0 = performance.now();
              detector.detect(video).then(function(r){
                espera = Math.max(90, (performance.now() - t0) * 2.5); // si la lectura tarda, se espacia (no satura el celular)
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
        n === 'NotAllowedError'  ? 'Permiso denegado. Actívalo en los ajustes o escribe el código.'
      : n === 'NotFoundError'    ? 'Este equipo no tiene cámara. Escribe el código.'
      : n === 'NotReadableError' ? 'Está en uso por otra aplicación. Escribe el código.'
      :                            'No se pudo abrir. Escribe el código.');
    });
}

// Estado de la pantalla de conteo: con producto detectado se pausa la cámara y aparece la entrada de packs;
// sin producto la cámara está encendida y se ve el historial. Se llama cada vez que cambia el producto.
function _cntVista(){
  var fs = document.getElementById('fs-conteo'); if (!fs) return;
  var card = document.getElementById('cnt-producto-card');
  var det = !!(card && card.style.display === 'block');
  var yaDet = fs.classList.contains('cnt-det');
  fs.classList.toggle('cnt-det', det);
  if (det && !yaDet && typeof _cntKpReset === 'function') _cntKpReset(); // el teclado propio empieza en Packs
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
  if(skuEl){ skuEl.value = resolved.sku; skuEl.dispatchEvent(new CustomEvent('acpick')); }

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
  var totalUnd = 0, skusU = new Set();
  DATA.conteo.forEach(function(x) { totalUnd += x.total; skusU.add(x.sku); });
  // Actualizar stat cards si están visibles (la página de conteo está activa)
  var sReg = document.querySelector('#conteo-root .stat-val');
  if (!sReg) return; // página no está renderizada aún
  var cards = document.querySelectorAll('#conteo-root .stat-val');
  if (cards[0]) cards[0].textContent = DATA.conteo.length;
  if (cards[1]) cards[1].textContent = skusU.size;
  if (cards[2]) cards[2].textContent = fmt(totalUnd);
}
