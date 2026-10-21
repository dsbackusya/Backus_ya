/* Restaura la sesión al abrir la app. Se carga al final, cuando ya existen todas las pantallas */
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

/* Aviso de versión nueva: al volver a la app se comparan las huellas (ETag / fecha) de los archivos propios
   con las que tenían al abrirla; si cambiaron, se ofrece actualizar sin pedir Ctrl+Shift+R. */
(function(){
  var archivos=[].slice.call(document.querySelectorAll('script[src],link[rel="stylesheet"][href]'))
    .map(function(e){ return e.getAttribute('src')||e.getAttribute('href'); })
    .filter(function(u){ return u && !/^https?:|^\/\//.test(u); });
  archivos.push('sw.js');
  var base=null, ultimo=0, avisado=false;
  function huella(){
    return Promise.all(archivos.map(function(u){
      return fetch(u,{method:'HEAD',cache:'no-store'}).then(function(r){
        return r.ok?(r.headers.get('etag')||r.headers.get('last-modified')||r.headers.get('content-length')||''):'';
      }).catch(function(){ return ''; });
    })).then(function(h){ return h.join('|'); });
  }
  function aviso(){
    if(avisado) return; avisado=true;
    var d=document.createElement('div');
    d.id='aviso-version';
    d.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:12px;background:var(--surface2,#222);color:var(--text,#fff);border:1px solid var(--border2,#444);box-shadow:0 8px 28px rgba(0,0,0,.35);font-size:13px;max-width:calc(100vw - 24px)';
    d.innerHTML='<span>Hay una versión nueva de Tada</span><button class="btn btn-primary btn-sm" type="button">Actualizar</button><button class="btn btn-ghost btn-sm" type="button" aria-label="Cerrar">Después</button>';
    var b=d.querySelectorAll('button');
    b[0].onclick=function(){ location.reload(); };
    b[1].onclick=function(){ d.remove(); setTimeout(function(){ avisado=false; },30*60*1000); };
    document.body.appendChild(d);
  }
  function revisar(){
    if(avisado||document.hidden||Date.now()-ultimo<5*60*1000) return;
    ultimo=Date.now();
    huella().then(function(h){
      if(!h.replace(/\|/g,'')) return;          // el servidor no da huellas: no se puede comparar
      if(base===null){ base=h; return; }
      if(h!==base) aviso();
    });
  }
  setTimeout(revisar,4000);
  document.addEventListener('visibilitychange',revisar);
  window.addEventListener('focus',revisar);
  setInterval(revisar,10*60*1000);
})();
