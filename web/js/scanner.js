/* Utilidades y escáner de cámara — parte de la antigua app.js; se carga en este orden desde index.html */
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
