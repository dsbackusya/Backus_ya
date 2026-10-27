/* Splash de arranque (DINET / TADA): la reja de la tienda sube, se ve la bodega y aparecen las letras y la mascota.
   Se queda hasta que la app esté lista:
   - sin sesión: cuando aparece el login
   - con sesión: cuando la primera pantalla terminó de cargar sus datos
   La primera vez de cada sesión dura al menos MIN ms (para que se vea la animación completa); las siguientes entran directo.
   Si pasan MAX ms sin estar lista, ofrece Reintentar / Seguir esperando. */
(function(){
  var sp=document.getElementById('tsplash'); if(!sp) return;
  var vista=false; try{ vista=sessionStorage.getItem('ts_vista')==='1'; }catch(e){}
  var reducido=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  var rep=vista||reducido;
  var MIN=rep?1300:4800, MAX=9000;
  var t0=Date.now(), terminado=false, esperando=false, timer=null;
  var sr=document.getElementById('ts-sr');
  if(rep) sp.classList.add('rep');

  // mascota (dibujo en SVG); el pelaje se arma con círculos alrededor del contorno
  var mc=document.getElementById('ts-mascot');
  if(mc){
    mc.innerHTML='<svg viewBox="0 0 220 280" aria-hidden="true"> <defs> <linearGradient id="tsmf" gradientUnits="userSpaceOnUse" x1="60" y1="30" x2="150" y2="230"><stop offset="0" stop-color="#3FD9EC"/><stop offset=".55" stop-color="#22D3C0"/><stop offset="1" stop-color="#14C99A"/></linearGradient> <linearGradient id="tsmh" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#27D4B8"/><stop offset="1" stop-color="#E3F27C"/></linearGradient> <linearGradient id="tsml" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#18C99C"/><stop offset="1" stop-color="#0FB88E"/></linearGradient> </defs> <ellipse class="tsm-sh" cx="110" cy="264" rx="62" ry="9" fill="rgba(10,6,28,.55)"/> <g class="tsm-all"> <g fill="url(#tsml)"><rect x="68" y="196" width="40" height="58" rx="16"/><rect x="116" y="196" width="40" height="58" rx="16"/> <ellipse cx="80" cy="254" rx="27" ry="11"/><ellipse cx="146" cy="254" rx="29" ry="11"/></g> <g fill="#26385E"><rect x="68" y="206" width="40" height="34" rx="12"/><rect x="116" y="206" width="40" height="34" rx="12"/></g> <g id="tsfur" fill="url(#tsmf)"><ellipse cx="110" cy="122" rx="80" ry="88"/></g> <g id="tsuni"> <path d="M56 142 Q110 128 164 142 L170 206 Q110 222 50 206 Z" fill="#1F2F55"/> <path d="M56 142 Q110 128 164 142 L166 170 Q110 160 54 170 Z" fill="#E4ECF8"/> <path d="M54 170 Q110 160 166 170 L167 181 Q110 171 53 181 Z" fill="#F28C28"/> <path d="M110 134 L110 214" stroke="#E4ECF8" stroke-width="2" opacity=".7"/> <path d="M92 134 Q110 148 128 134" fill="#1F2F55" stroke="#1F2F55" stroke-width="6" stroke-linejoin="round"/> <circle cx="132" cy="154" r="5" fill="#fff" opacity=".9"/><circle cx="132" cy="154" r="2.4" fill="#F28C28"/> </g> <g class="tsm-head"> <path d="M50 52 Q36 14 68 6 Q72 30 82 46 Z" fill="url(#tsmh)"/><path d="M170 52 Q184 14 152 6 Q148 30 138 46 Z" fill="url(#tsmh)"/> <path d="M44 66 L18 80 L46 90 Z" fill="#0E9AA0"/><path d="M176 66 L202 80 L174 90 Z" fill="#0E9AA0"/> <g id="tsfur2" fill="url(#tsmf)"></g> <ellipse cx="110" cy="96" rx="58" ry="46" fill="#fff"/> <g fill="#fff" id="tsbangs"></g> <g class="tsm-eye"><ellipse cx="86" cy="94" rx="7.5" ry="9.5" fill="#15101f"/><circle cx="88.5" cy="90.5" r="2.4" fill="#fff"/></g> <g class="tsm-eye"><ellipse cx="134" cy="94" rx="7.5" ry="9.5" fill="#15101f"/><circle cx="136.5" cy="90.5" r="2.4" fill="#fff"/></g> <path d="M92 112 Q110 142 128 112 Z" fill="#3a0f2e"/><path d="M99 123 Q110 134 121 123 Q110 118 99 123 Z" fill="#FF8DB3"/><rect x="100" y="112" width="20" height="5" rx="2" fill="#fff"/> <path d="M62 68 Q110 8 158 68 Q110 58 62 68 Z" fill="#1F2F55"/> <path d="M118 64 Q158 56 174 70 Q148 76 116 70 Z" fill="#162240"/> <path d="M86 52 Q110 38 134 52" fill="none" stroke="#F28C28" stroke-width="3" stroke-linecap="round" opacity=".95"/> <circle cx="110" cy="44" r="8" fill="#fff"/><circle cx="110" cy="44" r="3.4" fill="#F28C28"/> </g> <path d="M62 134 Q70 152 88 162" stroke="#1F2F55" stroke-width="22" stroke-linecap="round" fill="none"/><path d="M56 128 L68 139" stroke="#E4ECF8" stroke-width="10" stroke-linecap="round"/><circle cx="90" cy="163" r="8.5" fill="url(#tsml)"/> <g transform="rotate(-18 92 160)"><rect x="84" y="150" width="14" height="20" rx="4" fill="#12202a"/><rect x="87" y="154" width="8" height="10" rx="2.5" fill="#B8F26B"/></g> <g class="tsm-tab"> <path d="M154 134 Q162 148 158 162" stroke="#1F2F55" stroke-width="22" stroke-linecap="round" fill="none"/><path d="M160 130 L152 138" stroke="#E4ECF8" stroke-width="10" stroke-linecap="round"/> <rect x="146" y="124" width="48" height="68" rx="9" fill="#1E6B3B" transform="rotate(8 170 158)"/> <rect x="152" y="132" width="36" height="52" rx="6" fill="#134D2A" transform="rotate(8 170 158)"/> <g fill="#B8F26B" transform="rotate(8 170 158)"><circle cx="190" cy="146" r="3.5"/><circle cx="190" cy="158" r="3.5"/><circle cx="190" cy="170" r="3.5"/></g> </g> </g></svg>';
    var f=document.getElementById('tsfur'), h='', a, r, x, q='';
    for(a=0;a<360;a+=11){ r=a*Math.PI/180; h+='<circle cx="'+(110+Math.cos(r)*79).toFixed(1)+'" cy="'+(122+Math.sin(r)*87).toFixed(1)+'" r="11"/>'; }
    f.insertAdjacentHTML('beforeend',h);
    for(x=62;x<=158;x+=12) q+='<circle cx="'+x+'" cy="'+(56+Math.abs(x-110)*.12).toFixed(1)+'" r="9.5"/>';
    document.getElementById('tsbangs').innerHTML=q;
  }

  // la animación arranca cuando la fuente está lista (o a los 900 ms, para no esperar de más)
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
    try{ sessionStorage.setItem('ts_vista','1'); }catch(e){}
    if(sr) sr.textContent='Aplicación lista.';
    sp.classList.remove('failed'); sp.classList.add('ready');
    setTimeout(function(){ sp.classList.add('out'); },300);
    setTimeout(function(){ if(sp.parentNode) sp.parentNode.removeChild(sp); },1300);
  }
  function fallar(){
    sp.classList.add('failed');
    if(sr) sr.textContent='No pudimos cargar la aplicación.';
  }

  timer=setInterval(function(){
    var el=Date.now()-t0, ok=lista();
    if(ok&&el>=MIN){ terminar(); return; }
    if(el>=MAX&&!ok&&!esperando&&!sp.classList.contains('failed')) fallar();
  },120);

  var rb=document.getElementById('ts-retry'), wb=document.getElementById('ts-wait');
  if(rb) rb.onclick=function(){ location.reload(); };
  if(wb) wb.onclick=function(){ esperando=true; sp.classList.remove('failed'); if(sr) sr.textContent='Dinet TaDa. Cargando la aplicación.'; };
})();
