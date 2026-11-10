/* Splash de arranque (Dinet): una lente de vidrio nace como círculo, se vuelve baldosa, refracta el logo con dispersión
   cromática sobre fondo negro y se disuelve dejando el logo con un relieve suave (2.4 s). Va en WebGL puro.
   Se queda hasta que la app esté lista:
   - sin sesión: cuando aparece el login
   - con sesión: cuando la primera pantalla terminó de cargar sus datos
   La animación completa se ve en cada carga y recarga.
   Si pasan MAX ms sin estar lista, ofrece Reintentar / Seguir esperando.
   Rendimiento: al terminar la animación se dibuja el último cuadro y se deja de dibujar (la barra de carga es CSS);
   al quitar el splash se libera el contexto de WebGL. Sin WebGL (o con error) se muestra el logo plano. */
(function(){
  var sp=document.getElementById('tsplash'); if(!sp) return;
  var DUR=2.4, MIN=2800, MAX=9000;
  var t0=Date.now(), terminado=false, esperando=false, timer=null, animFin=false, gl=null, raf=0, parar=false;
  var sr=document.getElementById('ts-sr');
  var canvas=document.getElementById('ts-gl');

  function marcarListo(){ animFin=true; sp.classList.add('listo'); }
  function sinGL(){ parar=true; sp.classList.add('nogl'); marcarListo(); }

  /* ───────── WebGL ───────── */
  function iniciarGL(){
    if(!canvas) return sinGL();
    try{ gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl'); }catch(e){ gl=null; }
    if(!gl) return sinGL();

    var VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var FS=[
    'precision highp float;',
    'uniform vec2 uRes;uniform float uT;uniform float uAsp;',
    'uniform sampler2D uLogo;uniform sampler2D uSuave;',
    'float ease(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}',
    'vec2 luv(vec2 lp){return vec2(lp.x/uAsp+.5,.5-lp.y);}',
    'float inLogo(vec2 uv){return step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);}',
    'float A(vec2 lp){vec2 u=luv(lp);return texture2D(uLogo,u).a*inLogo(u);}',
    'float H(vec2 lp){vec2 u=luv(lp);return texture2D(uSuave,u).a*inLogo(u);}',
    // fondo: negro liso
    'vec3 fondo(vec2 p){return vec3(0.);}',
    'void main(){',
    '  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    '  vec2 uLuz=vec2(-.55,.7);',
    '  float LS=min(.27,.82*uRes.x/uRes.y/uAsp);',
    '  vec2 lp0=p/LS;',
    '  float t=uT;',
    '  float pop=ease((t-.07)/.10);',
    '  float morph=ease((t-.16)/.55);',
    '  float grow=ease((t-.18)/.62);',
    '  float dis=ease((t-.92)/.40);',
    '  float Rr=mix(.19,.285,grow)*pop*mix(1.,.8,dis);',
    '  float Rmax=min(Rr,.46*uRes.x/uRes.y);',
    '  float M=mix(2.25,1.45,grow);M=mix(M,1.,dis);',
    '  float K=mix(1.,.55,morph)*(1.-dis);',
    '  float nn=mix(2.,4.6,morph);',
    '  vec2 c=vec2(-.03,.026)*dis;',
    '  vec2 q=(p-c)/max(Rmax,1e-4);',
    '  float r=pow(pow(abs(q.x),nn)+pow(abs(q.y),nn),1./nn);',
    '  float aa=1.5/(uRes.y*max(Rmax,1e-3));',
    '  float inside=(1.-smoothstep(1.-aa,1.+aa,r))*step(.001,Rmax);',
    '  float rr=min(r,.999);',
    '  vec2 dir=q/max(length(q),1e-4);',
    '  float mag=pow(rr,3.4)*1.25+smoothstep(.82,1.,rr)*1.0;',
    '  vec2 fc=mix(vec2(-.02,.21),vec2(0.),ease((t-.25)/.75));',
    '  vec2 base=fc+lp0/M;',
    '  vec2 off=-dir*mag*K*.5;',
    '  vec2 so=-dir*mag*K*.028;',
    '  vec3 bgR=vec3(fondo(p+so*1.00).r,fondo(p+so*1.07).g,fondo(p+so*1.17).b);',
    '  vec3 g=vec3(A(base+off*1.00),A(base+off*1.07),A(base+off*1.17));',
    '  vec3 glass=mix(bgR,vec3(1.),g);',
    '  float lt=clamp(dot(dir,normalize(uLuz))*.5+.5,0.,1.);',
    '  float bevel=smoothstep(.80,1.,rr)*inside;',
    '  vec3 bcol=mix(vec3(.30,.46,.70),vec3(.86,.94,1.),lt)*bevel*.55*(1.-dis);',
    '  float lin=(1.-smoothstep(0.,.018,abs(r-.975)))*inside*.85*(1.-dis);',
    '  glass=glass*(1.-.45*smoothstep(.72,1.,rr)*(1.-dis))+bcol+vec3(.8,.9,1.)*lin*(.35+.65*lt);',
    '  float gloss=smoothstep(.55,1.,dot(normalize(q+vec2(.0001)),-normalize(uLuz)))*smoothstep(.55,.95,rr)*(1.-smoothstep(.95,1.,rr))*.5*(1.-dis);',
    '  glass+=vec3(1.)*gloss;',
    // logo plano con relieve (aparece cuando el vidrio se disuelve)
    '  float a0=A(lp0);',
    '  float e=.012;',
    '  float gx=H(lp0+vec2(e*uAsp,0.))-H(lp0-vec2(e*uAsp,0.));',
    '  float gy=H(lp0+vec2(0.,e))-H(lp0-vec2(0.,e));',
    '  vec2 L=normalize(uLuz);',
    '  float sh=(-gx*L.x+gy*L.y);',
    '  float relief=clamp(sh*.86*1.9,-.5,.5);',
    '  float edge=clamp(length(vec2(gx,gy))*.86*2.6,0.,1.);',
    '  vec3 inkc=clamp(vec3(1.)+vec3(relief*.5+edge*.10-.07),0.,1.);',
    '  float reveal=ease((t-.88)/.42);',
    '  vec3 F=mix(fondo(p),inkc,a0*reveal);',
    '  gl_FragColor=vec4(mix(F,glass,inside),1.);',
    '}'].join('\n');

    function sh(t,s){ var o=gl.createShader(t); gl.shaderSource(o,s); gl.compileShader(o); return gl.getShaderParameter(o,gl.COMPILE_STATUS)?o:null; }
    var vs=sh(gl.VERTEX_SHADER,VS), fs=sh(gl.FRAGMENT_SHADER,FS); if(!vs||!fs) return sinGL();
    var pr=gl.createProgram(); gl.attachShader(pr,vs); gl.attachShader(pr,fs); gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)) return sinGL();
    gl.useProgram(pr);
    var buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    var loc=gl.getAttribLocation(pr,'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    var U={}; ['uRes','uT','uAsp','uLogo','uSuave'].forEach(function(n){ U[n]=gl.getUniformLocation(pr,n); });

    function textura(unidad,fuente){
      var tx=gl.createTexture(); gl.activeTexture(gl.TEXTURE0+unidad); gl.bindTexture(gl.TEXTURE_2D,tx);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,fuente);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    // versión suavizada del logo (altura del relieve): se reduce y se vuelve a ampliar
    function suave(img){
      var w=img.naturalWidth,h=img.naturalHeight, a=document.createElement('canvas'); a.width=Math.round(w/5); a.height=Math.round(h/5);
      var ax=a.getContext('2d'); ax.imageSmoothingQuality='high'; ax.drawImage(img,0,0,a.width,a.height);
      var b=document.createElement('canvas'); b.width=w; b.height=h; var bx=b.getContext('2d'); bx.imageSmoothingQuality='high'; bx.drawImage(a,0,0,w,h);
      return b;
    }

    var asp=1.174;
    function ajustar(){
      var dpr=Math.min(window.devicePixelRatio||1,1.5), movil=Math.min(innerWidth,innerHeight)<700;
      var esc=dpr*(movil?.8:1);
      canvas.width=Math.max(2,Math.round(innerWidth*esc)); canvas.height=Math.max(2,Math.round(innerHeight*esc));
      gl.viewport(0,0,canvas.width,canvas.height);
    }
    function dibujar(t){
      if(!gl||gl.isContextLost()) return;
      gl.uniform2f(U.uRes,canvas.width,canvas.height); gl.uniform1f(U.uT,t); gl.uniform1f(U.uAsp,asp);
      gl.uniform1i(U.uLogo,0); gl.uniform1i(U.uSuave,1);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
    var tAct=0, ini=0;
    function cuadro(now){
      raf=0; if(parar||terminado||document.hidden) return;
      tAct=Math.min(DUR,(now-ini)/1000);
      dibujar(tAct);
      if(tAct<DUR){ raf=requestAnimationFrame(cuadro); }
      else marcarListo();                              // último cuadro dibujado: ya no se vuelve a dibujar
    }
    function arrancar(){
      ajustar();
      ini=performance.now(); raf=requestAnimationFrame(cuadro);
    }
    addEventListener('resize',function(){ if(!gl||terminado) return; ajustar(); dibujar(tAct); });
    document.addEventListener('visibilitychange',function(){ if(!document.hidden&&tAct<DUR&&!raf&&!terminado&&!parar){ ini=performance.now()-tAct*1000; raf=requestAnimationFrame(cuadro); } });
    canvas.addEventListener('webglcontextlost',function(e){ e.preventDefault(); sinGL(); });

    var img=new Image();
    img.onload=function(){
      try{ asp=img.naturalWidth/img.naturalHeight; textura(0,img); textura(1,suave(img)); arrancar(); }
      catch(e){ sinGL(); }
    };
    img.onerror=sinGL;
    img.src='img/logo-dinet.png';
  }
  iniciarGL();

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

  function liberar(){
    parar=true; if(raf) cancelAnimationFrame(raf);
    try{ var x=gl&&gl.getExtension('WEBGL_lose_context'); if(x) x.loseContext(); }catch(e){}
    gl=null;
  }
  function terminar(){
    if(terminado) return; terminado=true; clearInterval(timer);
    if(sr) sr.textContent='Aplicación lista.';
    sp.classList.remove('failed'); sp.classList.add('ready');
    setTimeout(function(){ sp.classList.add('out'); },200);
    setTimeout(function(){ liberar(); if(sp.parentNode) sp.parentNode.removeChild(sp); },1000);
  }
  function fallar(){
    sp.classList.add('failed');
    if(sr) sr.textContent='No pudimos cargar la aplicación.';
  }

  timer=setInterval(function(){
    var el=Date.now()-t0, ok=lista();
    if(ok&&animFin&&el>=MIN){ terminar(); return; }
    if(el>=MAX&&!ok&&!esperando&&!sp.classList.contains('failed')) fallar();
  },120);

  var rb=document.getElementById('ts-retry'), wb=document.getElementById('ts-wait');
  if(rb) rb.onclick=function(){ location.reload(); };
  if(wb) wb.onclick=function(){ esperando=true; sp.classList.remove('failed'); if(sr) sr.textContent='Dinet. Cargando la aplicación.'; };
})();
