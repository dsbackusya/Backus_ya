/* Splash de arranque (DINET / TADA). Se queda hasta que la app esté lista:
   - sin sesión: cuando aparece el login
   - con sesión: cuando la primera pantalla terminó de cargar sus datos
   Dura al menos MIN ms (para que se vea la animación) y, si pasan MAX ms sin estar lista, ofrece Reintentar / Seguir esperando. */
(function(){
  var sp=document.getElementById('tsplash'); if(!sp) return;
  var MIN=1500, MAX=9000;
  var t0=Date.now(), terminado=false, esperando=false, timer=null;
  var ttl=document.getElementById('ts-ttl'), sr=document.getElementById('ts-sr');

  function setP(p){ ttl.style.setProperty('--p',(p*100)+'%'); }

  // el título entra cuando la fuente está lista (o a los 900 ms, para no esperar de más)
  function entrar(){ sp.classList.add('go'); }
  if(document.fonts&&document.fonts.load){
    var yaEntro=false, ir=function(){ if(!yaEntro){ yaEntro=true; entrar(); } };
    document.fonts.load('1em Anton').then(ir,ir);
    setTimeout(ir,900);
  } else entrar();

  // ¿la app ya puede mostrarse?
  function lista(){
    var lg=document.getElementById('s-login'), app=document.getElementById('s-app');
    if(lg&&lg.classList.contains('active')) return true;
    if(app&&app.classList.contains('active')){
      var pg=app.querySelector('.page.active');
      return !!pg&&!pg.querySelector('.loading,.sk-block');
    }
    return false;
  }

  function terminar(){
    if(terminado) return; terminado=true; clearInterval(timer);
    setP(1);
    if(sr) sr.textContent='Aplicación lista.';
    sp.classList.remove('failed'); sp.classList.add('ready');
    setTimeout(function(){ sp.classList.add('out'); },900);
    setTimeout(function(){ if(sp.parentNode) sp.parentNode.removeChild(sp); },2200);
  }
  function fallar(){
    sp.classList.add('failed');
    if(sr) sr.textContent='No pudimos cargar la aplicación.';
  }

  timer=setInterval(function(){
    var el=Date.now()-t0, ok=lista();
    if(ok&&el>=MIN){ terminar(); return; }
    if(el>=MAX&&!ok&&!esperando&&!sp.classList.contains('failed')){ fallar(); return; }
    if(!sp.classList.contains('failed')) setP(Math.min(.93,1-Math.exp(-el/2400)));
  },80);

  var rb=document.getElementById('ts-retry'), wb=document.getElementById('ts-wait');
  if(rb) rb.onclick=function(){ location.reload(); };
  if(wb) wb.onclick=function(){ esperando=true; sp.classList.remove('failed'); if(sr) sr.textContent='Dinet TaDa. Cargando la aplicación.'; };
})();
