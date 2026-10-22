/* ══════════════════════════════════════════════════════════════
   ENVASES — control semanal por tienda
   · Conteo por sector (Palet, Cámara) más el PFN, que se mantiene todos los días hasta que se edita.
   · Movimientos del día: ENT y Venta en las botellas llenas, DEV en las vacías (Marcaje suma solo).
   · Motorizados: lo que deben y lo que devuelven; lo que deben cuenta como parte del conteo de vacías.
   El conteo de un día se hace al empezar el día y se compara con los movimientos de los días anteriores;
   el primer conteo de la semana (el lunes) es el inicial.
   ══════════════════════════════════════════════════════════════ */
var ENV_FILAS = [
  { k:'caja', tam:630,  sku:'3500192', n:'CJPL620/650',  t:'Caja plástica',          fam:'C6', g:'6xx · 630 / 650 ML' },
  { k:'vac',  tam:630,  sku:'3500323', n:'BOTVER630CV',  t:'Botella 630 · vacía',    fam:'B6' },
  { k:'lle',  tam:630,  sku:'2821',    n:'BOTVER630CV',  t:'Botella 630 · llena',    fam:'B6' },
  { k:'caja', tam:310,  sku:'3500240', n:'CJPL330',      t:'Caja plástica',          fam:'C3', g:'3xx · 305 / 310 ML' },
  { k:'vac',  tam:310,  sku:'3502226', n:'BOTAMB305R',   t:'Botella 305 · vacía',    fam:'B3' },
  { k:'lle',  tam:310,  sku:'15421',   n:'BOTAMB305R',   t:'Botella 305 · llena',    fam:'B3' },
  { k:'caja', tam:1000, sku:'3500193', n:'CJPL1100',     t:'Caja plástica',          fam:'C6', g:'1 LITRO · 1000 ML' },
  { k:'vac',  tam:1000, sku:'3500381', n:'BOTVER1000CV', t:'Botella litro · vacía',  fam:'B6' },
  { k:'lle',  tam:1000, sku:'14663',   n:'BOTVER1000CV', t:'Botella litro · llena',  fam:'B6' }
];
var ENV_MULT = { 630:12, 1000:12, 310:24 };
var ENV_FAM = { C6:{ n:'Cajas 6xx / litro', g:'caja' }, B6:{ n:'Botellas 6xx / litro', g:'bot630_1000' }, C3:{ n:'Cajas 3xx', g:'caja' }, B3:{ n:'Botellas 3xx', g:'bot310' } };
var ENV_PRECIO0 = { caja:3.8, bot630_1000:0.6, bot310:0.5 };
var ENV_SECS = ['Palet','Cámara','PFN'];
var ENV_TAMN = { 630:'Botella 630', 310:'Botella 305', 1000:'Botella litro', '630c':'Caja 620/650', '310c':'Caja 330', '1000c':'Caja 1100' };
function _evMk(x){ return x.tamano+(x.caja?'c':''); }
function _evMkP(v){ return { tamano:parseInt(v,10), caja:/c$/.test(v) }; }
var ENV_DN = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
var ENV_DL = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
var ENV_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];

var ENV = { d:null, m:null, lunes:'', sel:0, vista:'ctl', met:'val', mf:'pen', mAb:{}, mHist:{}, mForm:null, ses:null, busy:false };

/* ── utilidades ── */
function _evHoy(){ return (ENV.d&&ENV.d.hoy) || new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'}); }
function _evSumar(iso,n){ var d=new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function _evLunes(iso){ var w=new Date(iso+'T12:00:00Z').getUTCDay(); return _evSumar(iso,-((w+6)%7)); }
function _evF(iso){ return iso ? iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4) : ''; }
function _evNum(v){
  var s=String(v==null?'':v).trim(); if(!s) return null;
  if(/^[0-9+\s]+$/.test(s)) return s.split('+').reduce(function(a,x){ return a+(parseInt(x,10)||0); },0);
  var n=parseInt(s,10); return isNaN(n)||n<0?0:n;
}
function _evMoney(n){ return (n<0?'−':'')+'S/ '+Math.abs(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _evPrecio(g){ var p=ENV.d&&ENV.d.precios&&ENV.d.precios[g]; return (p===undefined||p===null)?ENV_PRECIO0[g]:p; }
function _evSec(u){ u=String(u||'').trim().toLowerCase(); return u==='pfn'?'PFN':(u==='cámara'||u==='camara')?'Cámara':'Palet'; }
function _evSg(n){ return n>0?'+'+n:String(n); }
function _evCls(n){ return n<0?'ev-neg':n>0?'ev-pos':'ev-zero'; }
function _evFilaIdx(tam,k){ for(var i=0;i<ENV_FILAS.length;i++){ if(ENV_FILAS[i].tam===tam&&ENV_FILAS[i].k===k) return i; } return -1; }
function _evCeros(){ return ENV_FILAS.map(function(){ return 0; }); }

/* ── carga ── */
function loadEnvases(){
  if(!S||!S.token){ errBox('envases-root','Sin sesión activa. Recarga la página.','envases'); PAGE_LOADING['envases']=false; return; }
  if(!ENV.lunes) ENV.lunes=_evLunes(new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'}));
  var t=(REQ_TOKEN.envases=(REQ_TOKEN.envases||0)+1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t!==REQ_TOKEN.envases) return;
      PAGE_LOADING['envases']=false;
      envRecibir(r);
    })
    .withFailureHandler(function(e){
      if(t!==REQ_TOKEN.envases) return;
      PAGE_LOADING['envases']=false; errBox('envases-root',e.message,'envases');
    })
    .getEnvSemana(S.token,ENV.lunes);
}
function envRecibir(r){
  if(_handleExpired(r,'envases-root')) return;
  if(!r||!r.ok){ errBox('envases-root',r&&r.error?r.error:'Error al cargar Envases','envases'); return; }
  var primera=!ENV.d; ENV.d=r; _evCalc();
  if(primera||ENV._reselDia){
    // día seleccionado: hoy si está en la semana; si no, el último con conteo; si no, el lunes
    var hi=ENV.m.days.indexOf(r.hoy); ENV.sel=hi>=0?hi:Math.max(0,ENV.m.last); ENV._reselDia=false;
  }
  _evRender();
}
function _evRecargar(){ var t=(REQ_TOKEN.envases=(REQ_TOKEN.envases||0)+1); google.script.run
  .withSuccessHandler(function(r){ if(t===REQ_TOKEN.envases&&r&&r.ok){ ENV.d=r; _evCalc(); _evRender(); } })
  .withFailureHandler(function(e){ showToast(e.message,'err'); }).getEnvSemana(S.token,ENV.lunes); }
function envSemana(n){ ENV.lunes=_evSumar(ENV.lunes,7*n); ENV._reselDia=true; ENV.ses=null; PAGE_LOADING['envases']=true;
  document.getElementById('envases-root').innerHTML=LD('Cargando la semana'); loadEnvases(); }

/* ── cálculo de la semana ── */
function _evCalc(){
  var d=ENV.d, days=[], i, k;
  for(k=0;k<7;k++) days.push(_evSumar(d.desde,k));
  var C=days.map(function(){ return { pal:_evCeros(), cam:_evCeros(), has:false }; });
  var snaps={};
  function sumar(l,dest){
    var bot=l.packs*ENV_MULT[l.tamano]+l.unidades, caj=l.packs+l.solas, bi, ci;
    if(bot){ bi=_evFilaIdx(l.tamano,l.estado==='llena'?'lle':'vac'); if(bi>=0) dest[bi]+=bot; }
    if(caj){ ci=_evFilaIdx(l.tamano,'caja'); if(ci>=0) dest[ci]+=caj; }
  }
  d.conteo.concat(d.pfnPrev).forEach(function(l){
    var sec=_evSec(l.ubicacion);
    if(sec==='PFN'){ if(!snaps[l.fecha]) snaps[l.fecha]=_evCeros(); sumar(l,snaps[l.fecha]); return; }
    var di=days.indexOf(l.fecha); if(di<0) return;
    C[di].has=true; sumar(l,sec==='Cámara'?C[di].cam:C[di].pal);
  });
  var sd=Object.keys(snaps).sort();
  var pfn=days.map(function(dia){ var f=null; sd.forEach(function(x){ if(x<=dia) f=x; }); return f?snaps[f].slice():_evCeros(); });
  // lo que los motorizados deben al cierre de cada día (botellas vacías y cajas): cuenta como parte del conteo
  var PEND=days.map(function(dia){
    var bal={}, o=ENV_FILAS.map(function(){ return 0; });
    d.moto.forEach(function(x){ if(x.fecha>dia) return; var k=x.motorizado.toLowerCase()+'|'+x.tamano+'|'+(x.caja?1:0); bal[k]=(bal[k]||0)+(x.tipo==='debe'?x.cantidad:-x.cantidad); });
    d.moto.forEach(function(x){ var k=x.motorizado.toLowerCase()+'|'+x.tamano+'|'+(x.caja?1:0); if(bal[k]===undefined) return; var j=_evFilaIdx(x.tamano,x.caja?'caja':'vac'); if(j>=0&&bal[k]>0) o[j]+=bal[k]; delete bal[k]; });
    return o;
  });
  var tot=days.map(function(dia,di){ return C[di].has ? ENV_FILAS.map(function(r,j){ return C[di].pal[j]+C[di].cam[j]+pfn[di][j]+PEND[di][j]; }) : null; });  // total = Palet + Cámara + PFN + lo que deben los motorizados (igual que el Excel)
  var M=days.map(function(){ return ENV_FILAS.map(function(){ return { ent:0,entD:0,dev:0,devD:0,ven:0,venD:0 }; }); });
  d.mov.forEach(function(m){
    var di=days.indexOf(m.fecha); if(di<0||!ENV_MULT[m.tamano]) return;
    var bot=m.packs*ENV_MULT[m.tamano]+m.unidades, j, f=m.doc?'D':'';
    if(m.tipo==='entrada'&&m.estado==='llena'){ j=_evFilaIdx(m.tamano,'lle'); if(j>=0) M[di][j]['ent'+f]+=bot; }
    else if(m.tipo==='devolucion'&&m.estado==='vacia'){ j=_evFilaIdx(m.tamano,'vac'); if(j>=0) M[di][j]['dev'+f]+=bot; }
    else if(m.tipo==='venta'&&m.estado==='vacia'){ j=_evFilaIdx(m.tamano,'caja'); if(j>=0) M[di][j]['ven'+f]+=m.packs; }
    else if(m.tipo==='venta'){ j=_evFilaIdx(m.tamano,'lle'); if(j>=0) M[di][j]['ven'+f]+=bot; }
    // las cajas que vienen en un Marcaje (packs) entran o salen junto con las botellas
    if(m.packs&&(m.tipo==='entrada'||m.tipo==='devolucion')){ j=_evFilaIdx(m.tamano,'caja'); if(j>=0) M[di][j][(m.tipo==='entrada'?'ent':'dev')+f]+=m.packs; }
  });
  var b=-1, last=-1;
  C.forEach(function(c,di){ if(c.has){ if(b<0) b=di; last=di; } });
  ENV.m={ days:days, C:C, pfn:pfn, tot:tot, M:M, PEND:PEND, b:b, last:last };
}
function _evMovDia(di,j){ var m=ENV.m.M[di][j]; return m.ent+m.entD-m.dev-m.devD-m.ven-m.venD; }
function _evEsp(di,j){
  var m=ENV.m; if(m.b<0||di<=m.b) return null;
  var s=m.tot[m.b][j]; for(var k=m.b;k<di;k++) s+=_evMovDia(k,j); return s;
}
function _evDif(di,j){ var t=ENV.m.tot[di]; if(!t||t[j]==null) return null; var e=_evEsp(di,j); return e==null?null:t[j]-e; }
function _evDifs(di){ var o={C6:0,B6:0,C3:0,B3:0}; ENV_FILAS.forEach(function(r,j){ var x=_evDif(di,j); if(x!=null) o[r.fam]+=x; }); return o; }
function _evTotDif(o){ var u=0,v=0; Object.keys(ENV_FAM).forEach(function(f){ u+=o[f]; v+=o[f]*_evPrecio(ENV_FAM[f].g); }); return {u:u,v:v}; }

/* ── pantalla ── */
function _evRender(){
  var root=document.getElementById('envases-root'); if(!root||!ENV.d) return;
  var m=ENV.m, a=m.days[0], z=m.days[6];
  var deudores=_evMotoLista().filter(function(x){ return x.debe>0; }).length;
  var sem='Semana del '+parseInt(a.slice(8),10)+(a.slice(5,7)!==z.slice(5,7)?' de '+ENV_MES[parseInt(a.slice(5,7),10)-1]:'')+' al '+parseInt(z.slice(8),10)+' de '+ENV_MES[parseInt(z.slice(5,7),10)-1];
  root.innerHTML=
    '<div class="ev-wrap">'+
      '<div class="ev-top"><div class="ev-vtabs"><button class="ev-vtab'+(ENV.vista==='ctl'?' on':'')+'" onclick="envVista(\'ctl\')">Control semanal</button>'+
        '<button class="ev-vtab'+(ENV.vista==='mot'?' on':'')+'" onclick="envVista(\'mot\')">Motorizados'+(deudores?' <b>'+deudores+'</b>':'')+'</button>'+
        '<button class="ev-vtab'+(ENV.vista==='pfn'?' on':'')+'" onclick="envVista(\'pfn\')">PFN</button></div>'+
        '<span class="ev-sp"></span><button class="btn btn-ghost btn-sm" onclick="envPrecios()">Precios</button></div>'+
      (ENV.vista==='ctl'
        ? '<div class="ev-wk"><button class="ev-nav" title="Semana anterior" onclick="envSemana(-1)">'+'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>'+'</button><b>'+sem+'</b>'+
          '<button class="ev-nav" title="Semana siguiente" onclick="envSemana(1)">'+'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>'+'</button></div>'+
          '<div class="ev-days" id="ev-days"></div>'+
          '<div class="ev-leg"><span><i></i>el día tiene conteo</span><span>El conteo de un día se hace al empezar el día y se compara con los movimientos de los días anteriores. El primer conteo de la semana es el inicial.</span></div>'+
          '<div class="evm2" id="ev-merge"></div>'+
          '<div class="ev-card"><div class="ev-k" style="margin-bottom:10px" id="ev-dk"></div><table class="ev-df"><thead><tr><th>Cierre</th><th class="r">Und.</th><th>Estado</th><th class="r">Precio</th></tr></thead><tbody id="ev-df"></tbody><tfoot><tr><td colspan="3">Total</td><td class="r" id="ev-dt"></td></tr></tfoot></table></div>'+
          '<div class="ev-card"><div class="ev-h"><span class="t">Movimientos y conteo</span><span class="s" id="ev-hd"></span><span class="ev-sp"></span><button class="btn btn-primary" id="ev-bc" onclick="envContar()"></button></div>'+
            '<div class="ev-t" id="ev-t"></div>'+
            '<div class="ev-ft">Conteo = Palet + Cámara + PFN + lo que deben los motorizados (columnas PFN y Moto). Esperado = conteo inicial + entradas − devoluciones − ventas, de los días anteriores. Diferencia = conteo del día − esperado. Dentro de una familia, las diferencias de llenas y vacías se compensan. ENT y DEV de Marcaje se suman solos (aparecen como + debajo del número).</div></div>'
        : ENV.vista==='pfn' ? '<div id="ev-pfn"></div>' : '<div id="ev-mot"></div>')+
    '</div>';
  if(ENV.vista==='ctl'){ _evDias(); _evTabla(); _evResumen(); }
  else if(ENV.vista==='pfn') _evPfnPinta();
  else _evMotPinta();
}
function envVista(v){ ENV.vista=v; _evRender(); }
function envSel(i){ ENV.sel=i; _evDias(); _evTabla(); _evResumen(); }
function envMet(x){ ENV.met=x; _evMerge(); }

function _evDias(){
  var m=ENV.m, el=document.getElementById('ev-days'); if(!el) return;
  el.innerHTML=m.days.map(function(dia,i){
    return '<div class="ev-d'+(i===ENV.sel?' on':'')+(dia===_evHoy()?' hoy':'')+'" onclick="envSel('+i+')">'+(m.C[i].has?'<i></i>':'')+ENV_DN[i]+'<b>'+parseInt(dia.slice(8),10)+'</b>'+(i===m.b?'<small>inicial</small>':'')+'</div>';
  }).join('');
  var s=ENV.sel; document.getElementById('ev-hd').textContent=ENV_DL[s].charAt(0).toUpperCase()+ENV_DL[s].slice(1)+' '+parseInt(m.days[s].slice(8),10)+' de '+ENV_MES[parseInt(m.days[s].slice(5,7),10)-1]+(s===m.b?' · conteo inicial':'');
  document.getElementById('ev-bc').textContent=m.C[s].has?'Editar conteo del día':'Contar este día';
}

function _evTabla(){
  var m=ENV.m, s=ENV.sel, h='<div class="ev-th"><span>Envase</span><span>Inicial</span><span>ENT</span><span>DEV</span><span>Venta</span><span>Moto</span><span>PFN</span><span>Esperado</span><span>Conteo</span><span>Diferencia</span></div>';
  ENV_FILAS.forEach(function(r,j){
    if(r.g) h+='<div class="ev-gp">'+r.g+'</div>';
    var ini=m.b>=0&&m.tot[m.b]?m.tot[m.b][j]:null, esp=_evEsp(s,j), c=m.tot[s]?m.tot[s][j]:null, d=_evDif(s,j), mm=m.M[s][j], mr=m.PEND[s][j], pf=m.pfn[s]?m.pfn[s][j]:0;
    var tipo=r.k==='caja'?'<em class="c">solo se cuenta</em>':r.k==='lle'?'<em class="l">llena</em>':'<em class="v">vacía</em>';
    var inp=function(k,ok,doc){
      return ok?'<input class="inp ev-in" inputmode="numeric" value="'+(mm[k]||'')+'" placeholder="0" oninput="envMovIn('+j+',\''+k+'\',this)" onchange="envMovGuardar('+j+',\''+k+'\',this)">'+(doc?'<small class="ev-doc" title="Viene de un Marcaje">+'+doc+'</small>':''):'<div class="ev-na"></div>';
    };
    h+='<div class="ev-r" data-j="'+j+'">'+
      '<div class="ev-n1"><b>'+r.t+' '+tipo+'</b><small>'+r.sku+' · '+r.n+'</small></div>'+
      '<div class="ev-c mut q" data-l="Inicial">'+(ini==null?'—':ini)+'</div>'+
      '<div class="q'+(r.k==='vac'?' na':(mm.ent+mm.entD?'':' na'))+'" data-l="ENT">'+(r.k!=='vac'&&mm.ent+mm.entD?'<div class="ev-c">+'+(mm.ent+mm.entD)+'</div>':'<div class="ev-na"></div>')+'</div>'+
      '<div class="q'+(r.k==='lle'?' na':(mm.dev+mm.devD?'':' na'))+'" data-l="DEV">'+(r.k!=='lle'&&mm.dev+mm.devD?'<div class="ev-c">+'+(mm.dev+mm.devD)+'</div>':'<div class="ev-na"></div>')+'</div>'+
      '<div class="q'+(r.k==='vac'?' na':'')+'" data-l="Venta">'+inp('ven',r.k!=='vac',mm.venD)+'</div>'+
      '<div class="ev-c q'+(r.k==='lle'?' na':'')+'" data-l="Moto" title="Botellas y cajas que los motorizados deben: ya están sumadas al conteo">'+(r.k!=='lle'?(mr?mr:'—'):'')+'</div>'+
      '<div class="ev-c mut q" data-l="PFN" title="PFN del último conteo (se mantiene hasta que se edite)">'+(pf?pf:'—')+'</div>'+
      '<div class="ev-c q" data-l="Esperado">'+(esp==null?'—':esp)+'</div>'+
      '<div class="ev-c q" data-l="Conteo"><b>'+(c==null?'—':c)+'</b></div>'+
      '<div class="q" data-l="Dif."><div class="ev-s '+(d==null?'':_evCls(d))+'">'+(d==null?'—':_evSg(d))+'</div></div>'+
    '</div>';
  });
  document.getElementById('ev-t').innerHTML=h;
}
function envMovIn(j,k,el){ /* vista previa al escribir; se guarda al terminar (change) */
  var v=_evNum(el.value)||0, mm=ENV.m.M[ENV.sel][j]; mm[k]=v; _evRefrescar();
}
function envMovGuardar(j,k,el){
  var v=_evNum(el.value)||0, r=ENV_FILAS[j], di=ENV.sel, fecha=ENV.m.days[di];
  var tipo=k==='ent'?'entrada':k==='dev'?'devolucion':'venta', estado=(k==='dev'||(k==='ven'&&r.k==='caja'))?'vacia':'llena';
  ENV.m.M[di][j][k]=v;
  google.script.run.withSuccessHandler(function(res){
    if(!res||!res.ok){ showToast((res&&res.error)||'No se pudo guardar','err'); _evRecargar(); return; }
    ENV.d.mov=ENV.d.mov.filter(function(x){ return !(x.fecha===fecha&&x.tipo===tipo&&x.tamano===r.tam&&x.estado===estado&&!x.doc); });
    if(v>0) ENV.d.mov.push({ fecha:fecha, tipo:tipo, tamano:r.tam, estado:estado, packs:r.k==='caja'?v:0, unidades:r.k==='caja'?0:v, doc:0 });
    _evCalc(); _evRefrescar();
  }).withFailureHandler(function(e){ showToast(e.message,'err'); _evRecargar(); }).setEnvMov(S.token,{ fecha:fecha, tipo:tipo, tamano:r.tam, estado:estado, unidades:v });
}
/* actualiza lo calculado sin redibujar las celdas de entrada (no se pierde el foco) */
function _evRefrescar(){
  var s=ENV.sel;
  document.querySelectorAll('.ev-r').forEach(function(row){
    var j=+row.dataset.j, esp=_evEsp(s,j), d=_evDif(s,j), e=row.querySelector('[data-l="Esperado"]'), x=row.querySelector('.ev-s');
    e.textContent=esp==null?'—':esp; x.textContent=d==null?'—':_evSg(d); x.className='ev-s '+(d==null?'':_evCls(d));
  });
  _evDias(); _evResumen();
}

function _evResumen(){
  var m=ENV.m, s=ENV.sel, cont=m.b>=0&&s>m.b&&m.C[s].has, o=cont?_evDifs(s):{C6:0,B6:0,C3:0,B3:0}, td=_evTotDif(o), h='';
  Object.keys(ENV_FAM).forEach(function(f){
    var u=o[f], v=u*_evPrecio(ENV_FAM[f].g);
    h+='<tr><td>'+ENV_FAM[f].n+'</td><td class="r">'+(cont?u:'—')+'</td><td>'+(cont?'<span class="ev-bd '+(u<0?'f':u>0?'s':'c')+'">'+(u<0?'Faltante':u>0?'Sobrante':'Cuadra')+'</span>':'<span class="ev-bd c" style="opacity:.5">—</span>')+'</td><td class="r '+(v<0?'ev-neg':v>0?'ev-pos':'')+'">'+(!cont||v===0?'—':_evMoney(v))+'</td></tr>';
  });
  document.getElementById('ev-df').innerHTML=h;
  var nom=ENV_DL[s]+' '+parseInt(m.days[s].slice(8),10);
  document.getElementById('ev-dk').textContent=s===m.b||!cont?'Diferencia por familia':'Diferencia por familia · '+nom;
  var dt=document.getElementById('ev-dt'); dt.textContent=cont?_evMoney(td.v):'—'; dt.className='r '+(!cont?'':td.v<0?'ev-neg':td.v>0?'ev-pos':'ev-zero');
  _evMerge();
}

/* tarjeta única: resultado del día elegido (izquierda) + faltantes y sobrantes de la semana (derecha) */
var ENV_FCOL = { C6:'#F0A3AA', B6:'#E3A53A', C3:'#8FDCEB', B3:'#9480E8' };
function _evSumFilas(di,k){ // contado y esperado de un tipo de fila ('caja' | 'vac' | 'lle') en el día
  var c=0, e=0, hay=false; ENV_FILAS.forEach(function(r,j){ if(r.k!==k) return; var t=ENV.m.tot[di]; if(t&&t[j]!=null) c+=t[j]; var x=_evEsp(di,j); if(x!=null){ e+=x; hay=true; } });
  return { c:c, e:hay?e:null };
}
function _evMerge(){
  var m=ENV.m, el=document.getElementById('ev-merge'); if(!el) return;
  var val=ENV.met==='val', s=ENV.sel, f=0, sob=0, mx=1, H=70;
  var dias=m.days.map(function(d,i){
    if(m.b<0||i<=m.b||!m.C[i].has) return null;
    var o=_evDifs(i), v={}; Object.keys(ENV_FAM).forEach(function(k){ v[k]=val?o[k]*_evPrecio(ENV_FAM[k].g):o[k]; });
    var up=0, dn=0; Object.keys(v).forEach(function(k){ if(v[k]>0) up+=v[k]; else dn+=-v[k]; });
    mx=Math.max(mx,up,dn); return { o:o, v:v, tot:up-dn, up:up, dn:dn };
  });
  // Cada día se compara con el conteo inicial de la semana, así que la diferencia de un día ya incluye la de los anteriores:
  // el acumulado de la semana es el del último día contado (no la suma de los días).
  var ultimo=-1; dias.forEach(function(x,i){ if(x) ultimo=i; });
  if(ultimo>=0){ f=dias[ultimo].dn; sob=dias[ultimo].up; }
  var fm=function(n){ return val?_evMoney(n):(n>0?'+':'')+n; }, net=sob-f;
  var acum=ultimo>=0?'Acumulado al conteo del '+ENV_DL[ultimo]+' '+parseInt(m.days[ultimo].slice(8),10):'';
  // panel izquierdo: resultado del día
  var d=dias[s], c, v, st, seg, sub=['',''], ct='';
  if(s===m.b){ c='#80799A'; v='Inicial'; st='Punto de partida'; seg=['','','','']; sub=['Es el conteo base de la semana',''];
    ct=''; }
  else if(!d){ c='#80799A'; v='Sin conteo'; st='Pendiente'; seg=['','','','']; sub=[m.b<0?'Primero cuenta el primer día de la semana':'Toca «Contar este día»','']; }
  else {
    var t=_evTotDif(_evDifs(s)), nf=0, ns=0; Object.keys(ENV_FAM).forEach(function(k){ if(d.o[k]<0) nf++; else if(d.o[k]>0) ns++; });
    c=t.v<0?'#F0A3AA':t.v>0?'#8FDCEB':(nf||ns)?'#E3A53A':'#7ADBB3';
    v=(t.v===0&&!nf&&!ns)?'Cuadra':_evMoney(t.v);
    st=nf&&ns?'Faltante y sobrante':nf?'Faltante':ns?'Sobrante':'Todo en orden';
    seg=Object.keys(ENV_FAM).map(function(k){ return d.o[k]<0?'f':d.o[k]>0?'s':'c'; });
    sub=[nf&&ns?nf+' con faltante · '+ns+' con sobrante':nf?nf+' de 4 familias con faltante':ns?ns+' de 4 con sobrante':'Las 4 familias cuadran',(4-nf-ns)+' cuadran'];
    ct=[['Cajas plásticas','caja'],['Botellas vacías','vac'],['Botellas llenas','lle']].map(function(x){ var q=_evSumFilas(s,x[1]);
      return '<div><span>'+x[0]+'</span><span><b>'+q.c.toLocaleString('es-PE')+'</b>'+(q.e!=null?'<em>esperado '+q.e.toLocaleString('es-PE')+'</em>':'')+'</span></div>'; }).join('');
  }
  var nom=ENV_DL[s]+' '+parseInt(m.days[s].slice(8),10);
  var L='<div class="evm2-l" style="--c:'+c+'"><div class="ev-k">Resultado del conteo · '+nom+'</div><div class="evm2-v">'+v+'</div><span class="evm2-st"><i></i>'+st+'</span>'+
    '<div class="evm2-sg">'+seg.map(function(x){ return '<span class="'+x+'"></span>'; }).join('')+'</div><div class="evm2-sb"><b>'+sub[0]+'</b><span>'+sub[1]+'</span></div>'+
    (ct?'<div class="evm2-ct">'+ct+'</div>':'')+'</div>';
  // panel derecho: semana
  var cols=m.days.map(function(dia,i){
    var x=dias[i], pl, vv='';
    if(i===m.b) pl='<div class="evm2-no">punto de partida</div>';
    else if(!x) pl='<div class="evm2-no">sin conteo</div>';
    else {
      var up='', dn='';
      Object.keys(ENV_FAM).forEach(function(k){ var y=x.v[k]; if(!y) return; var hh=Math.max(4,Math.abs(y)/mx*H);
        var sg='<div class="evm2-sg2" style="height:'+hh+'px;background:'+ENV_FCOL[k]+'" title="'+ENV_FAM[k].n+'"></div>'; if(y>0) up+=sg; else dn+=sg; });
      pl='<div class="evm2-pl"><div class="up">'+up+'</div><div class="z"></div><div class="dn">'+(up||dn?dn:'<div class="ok"></div>')+'</div></div>';
      vv='<div class="evm2-dv '+_evCls(x.tot)+'">'+(x.tot===0?'Cuadra':fm(x.tot))+'</div>';
    }
    return '<div class="evm2-d'+(i===s?' on':'')+'" onclick="envSel('+i+')">'+(vv||'<div class="evm2-dv"></div>')+pl+'<div class="evm2-dl">'+ENV_DN[i]+'<b>'+parseInt(dia.slice(8),10)+'</b></div></div>';
  }).join('');
  var R='<div class="evm2-r"><div class="evm2-rh"><h3>Faltantes y sobrantes de la semana</h3><span class="ev-sp"></span>'+
    '<div class="ev-seg"><button class="'+(val?'on':'')+'" onclick="envMet(\'val\')">S/</button><button class="'+(!val?'on':'')+'" onclick="envMet(\'und\')">Unidades</button></div></div>'+
    '<div class="evm2-wk"><span>Faltante<b class="ev-neg">'+(val?_evMoney(-f):(f?'−'+f:'0'))+'</b></span><span>Sobrante<b class="ev-pos">'+(val?_evMoney(sob):'+'+sob)+'</b></span><span>Neto<b class="'+_evCls(net)+'">'+fm(net)+'</b></span></div>'+
    (acum?'<div style="font-size:11px;color:var(--text3);margin:-4px 0 8px">'+acum+': cada día se compara con el conteo inicial, por eso no se suman los días.</div>':'')+'<div class="evm2-cols">'+cols+'</div>'+
    '<div class="evm2-lg">'+Object.keys(ENV_FAM).map(function(k){ return '<span><i style="background:'+ENV_FCOL[k]+'"></i>'+ENV_FAM[k].n+'</span>'; }).join('')+'<span><i style="background:#7ADBB3"></i>Cuadra</span></div></div>';
  el.innerHTML=L+R;
}

/* ══ Pantalla de conteo: cada línea se guarda al agregarla; el historial y el resumen aparecen al cerrar el conteo ══ */
var ENV_UBIS_BASE = [['Palet','Palet'],['Cámara','Cámara de frío']]; // [valor guardado, nombre que se ve]; las demás son de cada sede
var ENV_CAJA = { 630:'620/650 (3500192)', 310:'330 (3500240)', 1000:'1100 (3500193)' };
function _evNLin(l){ var n=ENV_MULT[l.tamano]; return { cajas:l.packs+l.solas, bot:l.packs*n+l.unidades }; }
function _evFechaPfn(lineas,hasta){ var f=''; lineas.forEach(function(l){ if(_evSec(l.ubicacion)==='PFN'&&l.fecha<=hasta&&l.fecha>f) f=l.fecha; }); return f; }
function _evUbiEtq(u){ var k=String(u||'').trim().toLowerCase(); if(k==='cámara'||k==='camara') return 'Cámara de frío'; return String(u||'Palet').trim()||'Palet'; }
function _evUbiLista(){
  var o=ENV_UBIS_BASE.slice();
  ((ENV.d&&ENV.d.ubicaciones)||[]).forEach(function(n){ if(!o.some(function(x){ return x[0].toLowerCase()===String(n).toLowerCase(); })) o.push([n,n]); });
  return o;
}
function _evcLineas(){ var s=ENV.ses; return ENV.d.conteo.filter(function(l){ return l.fecha===s.fecha&&_evSec(l.ubicacion)!=='PFN'; }); }
function envContar(){
  if(!ENV.d||!ENV.m){ showToast('Espera a que cargue la semana','err'); return; }
  if(ENV.vista!=='ctl'){ ENV.vista='ctl'; _evRender(); }
  var di=ENV.sel;
  ENV.ses={ di:di, fecha:ENV.m.days[di], cerrado:false, addUbi:false, guardando:false, edit:null,
    f:{ estado:'llena', tam:null, ubi:'Palet', solas:'', packs:'', und:'' } };
  _evcMontar(); _evcPinta();
}
function _evcMontar(){
  var el=document.getElementById('evc');
  if(!el){ el=document.createElement('div'); el.id='evc'; el.className='evc'; document.body.appendChild(el); }
  el.innerHTML=
    '<div class="evc-top"><button class="btn btn-ghost btn-sm" onclick="envCerrarConteo()">‹ Volver</button><h2 id="evc-t"></h2><span class="sp"></span>'+
      '<span class="pill-g" id="evc-n"></span><button class="btn btn-primary btn-sm" id="evc-cerrar" onclick="envCierre()">Cerrar conteo</button></div>'+
    '<div class="evc-body mq" id="evc-cuerpo"></div>';
  el.className='evc on'; document.body.classList.add('evc-abierto');
}
function envCerrarConteo(){
  var el=document.getElementById('evc'); if(el) el.className='evc'; document.body.classList.remove('evc-abierto'); ENV.ses=null;
  if(ENV.d&&ENV.m) _evRender();
}
function envCierre(){ ENV.ses.cerrado=true; _evcPinta(); window.scrollTo(0,0); var b=document.getElementById('evc-cuerpo'); if(b) b.scrollTop=0; }
function envSeguir(){ ENV.ses.cerrado=false; _evcPinta(); }
function envF(campo,v){ var f=ENV.ses.f; f[campo]=(campo==='tam')?Number(v):v; _evcPinta(); }
function _evcEtq(f){ return _evUbiEtq(f.ubi)+' · '+(f.estado==='llena'?'Llenas':'Vacías')+' · '+(f.tam?ENV_TAMN[f.tam]:'elige el envase'); }
function envFIn(campo,el){ ENV.ses.f[campo]=el.value; _evcForm(); }
function _evcForm(){
  var f=ENV.ses.f, n=ENV_MULT[f.tam]||0, packs=_evNum(f.packs)||0, solas=_evNum(f.solas)||0, und=_evNum(f.und)||0;
  var c=document.getElementById('evcf-c'), b=document.getElementById('evcf-b'); if(!c||!b) return;
  c.innerHTML=packs+' + '+solas+' = <b>'+(packs+solas)+'</b> cajas';
  b.innerHTML=packs+' × '+(n||'—')+' = '+(packs*n)+' + '+und+' = <b>'+(packs*n+und)+'</b> botellas';
  var a=document.getElementById('evcf-auto'); if(a) a.textContent=packs;
}
function envAgregar(){
  var s=ENV.ses, f=s.f, packs=_evNum(f.packs)||0, solas=_evNum(f.solas)||0, und=_evNum(f.und)||0;
  if(s.guardando) return;
  if(!f.tam){ showToast('Elige el envase antes de agregar','err'); return; }
  if(packs+solas+und===0){ showToast('Ingresa al menos una cantidad','err'); return; }
  if(s.edit){ _evcGuardarEdicion(); return; }
  var ya=_evcLineas().filter(function(l){ return l.estado===f.estado&&l.tamano===f.tam&&_evUbiEtq(l.ubicacion)===_evUbiEtq(f.ubi); });
  var hacer=function(){
    var etq=_evcEtq(f), dato={ fecha:s.fecha, estado:f.estado, tamano:f.tam, ubicacion:f.ubi, packs:packs, solas:solas, unidades:und };
    s.guardando=true; var btn=document.getElementById('evcf-add'); if(btn){ btn.disabled=true; btn.textContent='Guardando…'; }
    google.script.run.withSuccessHandler(function(r){
      s.guardando=false;
      if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo guardar la línea','err'); _evcPinta(); return; }
      ENV.d.conteo.push(r.fila); _evCalc();
      s.f.tam=null; s.f.packs=''; s.f.solas=''; s.f.und=''; s.ult=etq+' — '+_evNLin(r.fila).bot+' botellas, '+_evNLin(r.fila).cajas+' cajas';
      showToast('Guardado: '+etq,'ok'); _evcPinta();
    }).withFailureHandler(function(e){ s.guardando=false; showToast(e.message,'err'); _evcPinta(); }).agregarEnvConteoLinea(S.token,dato);
  };
  if(ya.length){
    var q=ya.map(function(l){ return _evNLin(l).bot+' botellas'; }).join(' y ');
    _confirmDialog('¿Mismo envase otra vez?','Ya guardaste '+ENV_TAMN[f.tam]+' '+(f.estado==='llena'?'llena':'vacía')+' en '+_evUbiEtq(f.ubi)+' ('+q+'). Si esta línea es de otro envase, cámbialo antes de agregar. ¿Guardarla igual?',hacer,'Guardar igual');
  } else hacer();
}
/* editar una línea ya guardada: sus datos pasan al formulario y se guardan con "Guardar cambios" */
function envEditarLinea(id){
  var l=ENV.d.conteo.filter(function(x){ return x.id===id; })[0]; if(!l||!ENV.ses) return;
  var s=ENV.ses; s.cerrado=false; s.edit=id; s.ult='';
  s.f={ estado:l.estado, tam:l.tamano, ubi:l.ubicacion, solas:l.solas?String(l.solas):'', packs:l.packs?String(l.packs):'', und:l.unidades?String(l.unidades):'' };
  _evcPinta(); var c=document.getElementById('evc-cuerpo'); if(c) c.scrollTop=0; window.scrollTo(0,0);
}
function envCancelarEdicion(){
  var s=ENV.ses; if(!s) return; s.edit=null; s.f={ estado:'llena', tam:null, ubi:'Palet', solas:'', packs:'', und:'' }; _evcPinta();
}
function _evcGuardarEdicion(){
  var s=ENV.ses, f=s.f, id=s.edit;
  s.guardando=true; var btn=document.getElementById('evcf-add'); if(btn){ btn.disabled=true; btn.textContent='Guardando…'; }
  google.script.run.withSuccessHandler(function(r){
    s.guardando=false;
    if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo guardar el cambio','err'); _evcPinta(); return; }
    ENV.d.conteo=ENV.d.conteo.map(function(x){ return x.id===id?r.fila:x; }); _evCalc();
    var etq=_evcEtq(f); s.edit=null; s.f={ estado:'llena', tam:null, ubi:'Palet', solas:'', packs:'', und:'' };
    s.ult='Editaste: '+etq+' — '+_evNLin(r.fila).bot+' botellas, '+_evNLin(r.fila).cajas+' cajas';
    showToast('Línea actualizada: '+etq,'ok'); _evcPinta();
  }).withFailureHandler(function(e){ s.guardando=false; showToast(e.message,'err'); _evcPinta(); })
    .editarEnvConteoLinea(S.token,id,{ estado:f.estado, tamano:f.tam, ubicacion:f.ubi, packs:_evNum(f.packs)||0, solas:_evNum(f.solas)||0, unidades:_evNum(f.und)||0 });
}
function _evcQuitar(id,fin){
  google.script.run.withSuccessHandler(function(r){
    if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo quitar la línea','err'); return; }
    ENV.d.conteo=ENV.d.conteo.filter(function(x){ return x.id!==id; }); _evCalc(); fin();
  }).withFailureHandler(function(e){ showToast(e.message,'err'); }).quitarEnvConteoLinea(S.token,id);
}
function envDeshacer(){
  var ls=_evcLineas(); if(!ls.length) return; var l=ls[ls.length-1];
  _evcQuitar(l.id,function(){ ENV.ses.ult=''; showToast('Quitaste la última línea','ok'); _evcPinta(); });
}
function envQuitarLinea(id){
  _confirmDialog('Quitar línea','Se borra esta línea del conteo de '+ENV_DL[ENV.ses.di]+'. Cambia el total del día.',function(){ _evcQuitar(id,function(){ if(ENV.ses.edit===id) ENV.ses.edit=null; showToast('Línea quitada','ok'); _evcPinta(); }); },'Quitar');
}
function envOtraUbi(){ ENV.ses.addUbi=!ENV.ses.addUbi; _evcPinta(); var i=document.getElementById('evcf-nueva'); if(i) i.focus(); }
function envGuardarUbi(){
  var i=document.getElementById('evcf-nueva'), v=(i&&i.value||'').trim(); if(!v){ if(i) i.focus(); return; }
  google.script.run.withSuccessHandler(function(r){
    if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo guardar la ubicación','err'); return; }
    ENV.d.ubicaciones=ENV.d.ubicaciones||[]; if(ENV.d.ubicaciones.indexOf(r.nombre)<0) ENV.d.ubicaciones.push(r.nombre);
    ENV.ses.f.ubi=r.nombre; ENV.ses.addUbi=false; showToast('Ubicación guardada para esta sede: '+r.nombre,'ok'); _evcPinta();
  }).withFailureHandler(function(e){ showToast(e.message,'err'); }).guardarEnvUbicacion(S.token,v);
}
function _evcSeg(opts,sel,fn,extra){ return '<div class="ev-seg evcf-seg">'+opts.map(function(o){ return '<button class="'+(String(o[0])===String(sel)?'on':'')+'" onclick="'+fn+'(\''+String(o[0]).replace(/'/g,"\\'")+'\')">'+o[1]+'</button>'; }).join('')+(extra||'')+'</div>'; }
function envFE(v){ envF('estado',v); } function envFT(v){ envF('tam',v); } function envFU(v){ envF('ubi',v); }
function _evcPinta(){
  var s=ENV.ses, m=ENV.m; if(!s) return;
  var ls=_evcLineas(), nl=ls.length;
  document.getElementById('evc-t').textContent=(s.cerrado?'Conteo cerrado · ':'Conteo del ')+ENV_DL[s.di]+' '+parseInt(s.fecha.slice(8),10)+(s.di===m.b?' · inicial':'');
  document.getElementById('evc-n').textContent=nl+(nl===1?' línea guardada':' líneas guardadas');
  document.getElementById('evc-cerrar').style.display=s.cerrado?'none':'';
  if(s.cerrado){ _evcCierre(ls); return; }
  var f=s.f, n=ENV_MULT[f.tam]||0, ubis=_evUbiLista();
  var ultima=ls.length?ls[ls.length-1]:null;
  var lista=nl?'<div class="evc-card" style="padding:14px 16px;margin-bottom:12px"><h3 style="margin:0 0 4px;font:600 14px \'DM Sans\'">Líneas de este conteo</h3><div class="evcf-h" style="margin:0 0 6px">Toca ✎ para cambiar una línea o ✕ para quitarla.</div>'+
    ls.map(function(l){ var x=_evNLin(l);
      return '<div class="hist-li'+(s.edit===l.id?' ed':'')+'"><span class="sc '+(l.estado==='llena'?'ll':'va')+'">'+(l.estado==='llena'?'Llena':'Vacía')+'</span><span>'+ENV_TAMN[l.tamano]+' · '+esc(_evUbiEtq(l.ubicacion))+'</span><span class="q">'+x.bot+' bot · '+x.cajas+' cajas</span>'+
        '<button title="Editar" onclick="envEditarLinea('+l.id+')">✎</button><button title="Quitar" onclick="envQuitarLinea('+l.id+')">✕</button></div>'; }).join('')+'</div>':'';
  document.getElementById('evc-cuerpo').innerHTML=lista+
   '<div class="evc-card evcf'+(s.edit?' editando':'')+'"><div class="evcf-k">'+(s.edit?'Editar línea del conteo':'Agregar al conteo')+'</div>'+
    '<div class="sel-aviso'+(f.tam?'':' w')+'">'+(s.edit?'Vas a cambiar la línea por: ':'Vas a agregar: ')+'<b>'+_evcEtq(f)+'</b></div>'+
    '<label class="evcf-l">Ubicación</label>'+_evcSeg(ubis.map(function(u){ return [u[0],u[1]]; }),f.ubi,'envFU','<button class="mas" onclick="envOtraUbi()" title="Solo para esta sede">+ Otra</button>')+
    (s.addUbi?'<div class="nueva-ubi"><input class="inp" id="evcf-nueva" maxlength="30" placeholder="Ej: Pasillo, Mezanine" onkeydown="if(event.key===\'Enter\')envGuardarUbi()"><button class="btn btn-primary btn-sm" onclick="envGuardarUbi()">Guardar ubicación</button></div><div class="ubi-nota">Solo aparecerá en esta sede.</div>':'')+
    '<label class="evcf-l">Estado</label>'+_evcSeg([['llena','Llenas'],['vacia','Vacías']],f.estado,'envFE')+
    '<label class="evcf-l">Envase</label>'+_evcSeg([[630,'Botella 630'],[310,'Botella 305'],[1000,'Botella 1000']],f.tam,'envFT')+
    '<div class="evcf-h">'+(f.tam?'Multiplica ×'+n+' · caja plástica asociada: '+ENV_CAJA[f.tam]:'Elige el envase de esta línea.')+'</div>'+
    '<div class="evcf-box"><div class="evcf-bt"><b>1 · Botellas</b><span>× '+(n||'—')+' automático</span></div><div class="evcf-g">'+
      '<div><label>Packs (cajas completas)</label><input class="inp" inputmode="numeric" placeholder="0" value="'+esc(f.packs)+'" oninput="envFIn(\'packs\',this)"></div>'+
      '<div><label>Unidades sueltas</label><input class="inp" inputmode="numeric" placeholder="0" value="'+esc(f.und)+'" oninput="envFIn(\'und\',this)"></div></div>'+
      '<div class="evcf-eq" id="evcf-b"></div></div>'+
    '<div class="evcf-box"><div class="evcf-bt"><b>2 · Cajas plásticas</b><span>'+(f.tam?ENV_CAJA[f.tam].split(' ')[0]:'—')+'</span></div><div class="evcf-g">'+
      '<div><label>Con botellas</label><div class="evcf-auto"><em>AUTO</em><b id="evcf-auto">'+(_evNum(f.packs)||0)+'</b></div></div>'+
      '<div><label>Solas (sin botellas)</label><input class="inp" inputmode="numeric" placeholder="0" value="'+esc(f.solas)+'" oninput="envFIn(\'solas\',this)"></div></div>'+
      '<div class="evcf-eq" id="evcf-c"></div></div>'+
    '<div class="evcf-h">Los packs de botellas ya cuentan como "cajas con botellas": solo se escriben una vez.</div>'+
    '<button class="btn btn-primary evcf-add" id="evcf-add" onclick="envAgregar()">✓ '+(s.edit?'Guardar cambios: ':'Agregar y guardar: ')+_evcEtq(f)+'</button>'+(s.edit?'<button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="envCancelarEdicion()">Cancelar edición</button>':'')+
    '<div class="lista-ult">'+(s.ult?'Último guardado: <b>'+esc(s.ult)+'</b> · <a href="#" onclick="envDeshacer();return false">Deshacer</a>':(ultima?'<a href="#" onclick="envDeshacer();return false">Deshacer última línea</a>':'Cada línea se guarda al instante; no hace falta guardar al final.'))+'</div>'+
   '</div>';
  _evcForm();
}
// Diferencias grandes por familia: sirven para notar un envase mal elegido (se muestran al cerrar).
function _evcSospechas(){
  var s=ENV.ses, m=ENV.m, fam={}, out=[];
  ENV_FILAS.forEach(function(r,j){
    var esp=_evEsp(s.di,j), c=m.tot[s.di]?m.tot[s.di][j]:null; if(esp==null||c==null) return;
    var f=fam[r.fam]||(fam[r.fam]={ c:0, e:0 }); f.c+=c; f.e+=esp;
  });
  Object.keys(fam).forEach(function(k){
    var f=fam[k], dif=f.c-f.e, tol=ENV_FAM[k].g==='caja'?15:Math.max(100,Math.abs(f.e)*0.05);
    if(Math.abs(dif)>tol) out.push(ENV_FAM[k].n+': contaste '+f.c.toLocaleString('es-PE')+' y se esperaban '+f.e.toLocaleString('es-PE')+' ('+(dif>0?'+':'')+dif.toLocaleString('es-PE')+')');
  });
  return out;
}
function _evcCierre(ls){
  var s=ENV.ses, m=ENV.m, sos=_evcSospechas();
  var hist=ls.length
    ? ls.slice().reverse().map(function(l){ var x=_evNLin(l);
        return '<div class="hist-li"><span class="sc '+(l.estado==='llena'?'ll':'va')+'">'+(l.estado==='llena'?'Llena':'Vacía')+'</span><span>'+ENV_TAMN[l.tamano]+' · '+esc(_evUbiEtq(l.ubicacion))+'</span><span class="q">'+x.bot+' bot · '+x.cajas+' cajas</span><button title="Editar" onclick="envEditarLinea('+l.id+')">✎</button><button title="Quitar" onclick="envQuitarLinea('+l.id+')">✕</button></div>'; }).join('')
    : '<div class="evc-le">Aún no hay líneas en este conteo.</div>';
  var tot=m.tot[s.di], filas=[630,310,1000].map(function(t){
    var c=ENV_FILAS.map(function(r,j){ return r.tam===t?[r.k,tot?tot[j]:0]:null; }).filter(Boolean), o={}; c.forEach(function(x){ o[x[0]]=x[1]; });
    return '<div class="resumen-fila"><span>'+ENV_TAMN[t]+'</span><span>'+(o.caja||0)+'</span><span>'+(o.vac||0)+'</span><span>'+(o.lle||0)+'</span></div>'; }).join('');
  document.getElementById('evc-cuerpo').innerHTML=
   (sos.length?'<div class="sel-aviso w" style="display:block;margin-bottom:12px"><b>Revisa tu conteo.</b> Estas familias se alejan mucho de lo esperado; puede ser un envase mal elegido en alguna línea:<br>• '+sos.map(esc).join('<br>• ')+'</div>':'')+
   '<div class="evc-card" style="padding:14px 16px;margin-bottom:14px"><h3 style="margin:0 0 4px;font:600 14px \'DM Sans\'">Historial del conteo</h3><div class="evcf-h" style="margin:0 0 8px">Cada línea ya está guardada. Puedes editar o quitar una si te equivocaste.</div>'+hist+'</div>'+
   '<div class="evc-card" style="padding:14px 16px;margin-bottom:14px"><h3 style="margin:0 0 4px;font:600 14px \'DM Sans\'">Lo que verá el Control</h3><div class="evcf-h" style="margin:0 0 8px">Conteo total del día: lo contado + PFN + lo que deben los motorizados.</div>'+
     '<div class="resumen-fila h"><span>Envase</span><span>Caja plástica</span><span>Vacías</span><span>Llenas</span></div>'+filas+'</div>'+
   '<div style="display:flex;gap:10px"><button class="btn btn-ghost" style="flex:1" onclick="envSeguir()">‹ Seguir contando</button><button class="btn btn-primary" style="flex:1" onclick="envCerrarConteo()">Terminar</button></div>';
}

/* ══ Motorizados ══ */
function _evMotoLista(){
  var mapa={}, orden=[];
  ((ENV.d&&ENV.d.moto)||[]).forEach(function(x){
    var k=x.motorizado.toLowerCase(); if(!mapa[k]){ mapa[k]={ n:x.motorizado, led:[], bal:{}, debe:0 }; orden.push(k); }
    mapa[k].led.push(x); mapa[k].bal[_evMk(x)]=(mapa[k].bal[_evMk(x)]||0)+(x.tipo==='debe'?x.cantidad:-x.cantidad);
  });
  return orden.map(function(k){ var o=mapa[k]; Object.keys(o.bal).forEach(function(t){ if(o.bal[t]>0) o.debe+=o.bal[t]; }); return o; });
}
function _evK(n){ return n.replace(/[^A-Za-z0-9]/g,'_'); }
function envMF(f){ ENV.mf=f; _evMotPinta(); }
function _evMotPinta(){
  var el=document.getElementById('ev-mot'); if(!el) return;
  var lista=_evMotoLista(), deben=0, conSaldo=0, devSem=0, dias=ENV.m.days;
  lista.forEach(function(m){ Object.keys(m.bal).forEach(function(t){ if(m.bal[t]>0&&!/c$/.test(t)) deben+=m.bal[t]; }); if(m.debe>0) conSaldo++; m.led.forEach(function(e){ if(e.tipo==='dev'&&dias.indexOf(e.fecha)>=0) devSem+=e.cantidad; }); });
  var f='';
  if(ENV.mForm){
    f='<div class="evm-form"><span class="t">Nuevo pendiente: el motorizado queda debiendo botellas vacías</span><div class="evm-f">'+
      '<div><label>Motorizado</label><input class="inp" id="evm-n" list="evm-nl" placeholder="Escribe o elige un nombre" autocomplete="off"><datalist id="evm-nl">'+lista.map(function(m){ return '<option value="'+esc(m.n)+'">'; }).join('')+'</datalist></div>'+
      '<div><label>Envase</label><select id="evm-t"><option value="630">Botella 630</option><option value="310">Botella 305</option><option value="1000">Botella litro</option><option value="630c">Caja 620/650</option><option value="310c">Caja 330</option><option value="1000c">Caja 1100</option></select></div>'+
      '<div><label>Cantidad</label><input class="inp" id="evm-q" inputmode="numeric" placeholder="0"></div>'+
      '<div><label>Fecha</label><input class="inp" id="evm-d" type="date" value="'+esc(ENV.mForm.fecha)+'"></div>'+
      '<div><label>Nota (opcional)</label><input class="inp" id="evm-o" placeholder="Ej: pedido 4821"></div></div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn btn-ghost" onclick="ENV.mForm=null;_evMotPinta()">Cancelar</button><button class="btn btn-primary" onclick="envMotoNuevo()">Guardar pendiente</button></div></div>';
  }
  var vis=lista.slice().sort(function(a,b){ return b.debe-a.debe; }).filter(function(m){ return ENV.mf==='todos'||m.debe>0; });
  el.innerHTML=
    '<div class="evm-kp"><div class="ev-card"><div class="ev-k">Botellas que deben</div><div class="ev-v" style="font-size:28px">'+deben+'</div><div class="ev-n">entre todos los motorizados</div></div>'+
      '<div class="ev-card"><div class="ev-k">Motorizados con saldo</div><div class="ev-v" style="font-size:28px">'+conSaldo+'</div><div class="ev-n">de '+lista.length+' registrados</div></div>'+
      '<div class="ev-card"><div class="ev-k">Devuelto esta semana</div><div class="ev-v ev-pos" style="font-size:28px">'+devSem+'</div><div class="ev-n">ya pasaron al almacén</div></div></div>'+
    '<p class="evm-note">Cuando se vende producto retornable, el motorizado queda debiendo las botellas vacías. Aquí anotas cuántas debe y, cuando las trae, registras la devolución (puede ser parcial). Lo que deben <b>cuenta como parte del conteo de vacías</b> mientras no lo traigan; cuando lo devuelven pasa a estar físicamente en el almacén y el total no cambia.</p>'+
    '<div class="evm-bar"><button class="btn btn-primary" onclick="ENV.mForm={fecha:\''+_evHoy()+'\'};_evMotPinta();var n=document.getElementById(\'evm-n\');if(n)n.focus()">+ Nuevo pendiente</button><span class="ev-sp"></span>'+
      '<div class="ev-seg"><button class="'+(ENV.mf==='pen'?'on':'')+'" onclick="envMF(\'pen\')">Con saldo</button><button class="'+(ENV.mf==='todos'?'on':'')+'" onclick="envMF(\'todos\')">Todos</button></div></div>'+
    f+
    (vis.length?vis.map(function(m){
      var deb=Object.keys(m.bal).filter(function(t){ return m.bal[t]>0; }), ab=ENV.mAb[m.n], kk=_evK(m.n), panel='';
      var chips=deb.length?deb.map(function(t){ return '<span>'+ENV_TAMN[t]+' · '+m.bal[t]+'</span>'; }).join(''):'<span class="ok">Al día</span>';
      if(ab){
        var opts=(ab==='dev'?deb:['630','310','1000','630c','310c','1000c']).map(function(t){ return '<option value="'+t+'">'+ENV_TAMN[t]+(ab==='dev'?' (debe '+m.bal[t]+')':'')+'</option>'; }).join('');
        panel='<div class="evm-pn"><div class="r"><div><label>Envase</label><select id="evp-t-'+kk+'" onchange="envMotoSel(\''+esc(m.n).replace(/'/g,"\\'")+'\',this.value)">'+opts+'</select></div>'+
          '<div><label>'+(ab==='dev'?'Cantidad que devolvió':'Cantidad que debe')+'</label><input class="inp" id="evp-q-'+kk+'" inputmode="numeric" value="'+(ab==='dev'&&deb.length?m.bal[deb[0]]:'')+'" placeholder="0"></div>'+
          '<div><label>Fecha</label><input class="inp" id="evp-d-'+kk+'" type="date" value="'+esc(_evHoy())+'"></div><div></div>'+
          '<button class="btn btn-primary" onclick="envMotoMov(\''+esc(m.n).replace(/'/g,"\\'")+'\')">'+(ab==='dev'?'Registrar devolución':'Agregar')+'</button>'+
          '<div class="hint">'+(ab==='dev'?'Por defecto aparece todo lo que debe; cámbialo si devolvió solo una parte (el resto queda pendiente).':'Suma a lo que ya debe.')+'</div></div></div>';
      }
      var hist=ENV.mHist[m.n]?'<div class="evm-hist">'+m.led.slice().reverse().map(function(e){
        return '<div class="evm-l"><span class="d">'+_evF(e.fecha)+'</span><span>'+ENV_TAMN[_evMk(e)]+(e.nota?' · '+esc(e.nota):'')+'</span><span class="q '+(e.tipo==='debe'?'d1':'d2')+'">'+(e.tipo==='debe'?'debe +':'devolvió −')+e.cantidad+'</span><button title="Quitar" onclick="envMotoQuitar('+e.id+')">✕</button></div>'; }).join('')+'</div>':'';
      var nq=esc(m.n).replace(/'/g,"\\'");
      return '<div class="evm-c"><div class="evm-h"><div class="evm-av">'+esc(m.n.split(' ').map(function(x){ return x[0]; }).slice(0,2).join('').toUpperCase())+'</div><div class="evm-n"><b>'+esc(m.n)+'</b><small>'+m.led.length+' movimientos</small></div><div class="evm-bal">'+chips+'</div></div>'+
        '<div class="evm-act"><button class="btn btn-primary" '+(deb.length?'':'disabled style="opacity:.4"')+' onclick="envMotoPanel(\''+nq+'\',\'dev\')">Devolvió botellas</button>'+
        '<button class="btn btn-ghost" onclick="envMotoPanel(\''+nq+'\',\'debe\')">+ Debe más</button>'+
        '<button class="btn btn-ghost" onclick="ENV.mHist[\''+nq+'\']=!ENV.mHist[\''+nq+'\'];_evMotPinta()">'+(ENV.mHist[m.n]?'Ocultar historial':'Ver historial')+'</button>'+
        '<button class="btn btn-ghost" onclick="envMotoRenPanel(\''+nq+'\')">Cambiar nombre</button></div>'+
        (ENV.mRen&&ENV.mRen[m.n]?'<div class="evm-pn"><div class="r"><div><label>Nuevo nombre</label><input class="inp" id="evr-'+kk+'" value="'+esc(m.n)+'" autocomplete="off"></div><div></div><button class="btn btn-primary" onclick="envMotoRenombrar(\''+nq+'\')">Guardar nombre</button><div class="hint">Cambia el nombre en todos sus movimientos. Si escribes el nombre de otro motorizado, se juntan sus saldos.</div></div></div>':'')+
        panel+hist+'</div>';
    }).join(''):'<div class="evm-empty">'+(lista.length?'Nadie debe botellas. Todos los motorizados están al día.':'Aún no hay motorizados. Agrega el primero con "+ Nuevo pendiente".')+'</div>');
}
function envMotoRenPanel(n){ ENV.mRen=ENV.mRen||{}; ENV.mRen[n]=!ENV.mRen[n]; _evMotPinta(); }
function envMotoRenombrar(n){
  var nuevo=document.getElementById('evr-'+_evK(n)).value.trim(); if(!nuevo){ document.getElementById('evr-'+_evK(n)).focus(); return; }
  var ex=_evMotoLista().filter(function(x){ return x.n.toLowerCase()===nuevo.toLowerCase()&&x.n!==n; })[0]; if(ex) nuevo=ex.n;
  google.script.run.withSuccessHandler(function(r){
    if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo cambiar el nombre','err'); return; }
    ENV.d.moto.forEach(function(x){ if(x.motorizado===n) x.motorizado=nuevo; }); ENV.mRen[n]=false; _evCalc(); _evRender(); showToast('Nombre cambiado','ok');
  }).withFailureHandler(function(e){ showToast(e.message,'err'); }).renombrarEnvMoto(S.token,n,nuevo);
}
function envMotoPanel(n,tp){ ENV.mAb[n]=ENV.mAb[n]===tp?'':tp; _evMotPinta(); }
function envMotoSel(n,t){
  var m=_evMotoLista().filter(function(x){ return x.n===n; })[0], q=document.getElementById('evp-q-'+_evK(n)); if(m&&q&&ENV.mAb[n]==='dev') q.value=m.bal[t]||'';
}
function _evMotoGuardar(d,fin){
  google.script.run.withSuccessHandler(function(r){
    if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo guardar','err'); return; }
    ENV.d.moto.push(r.fila); _evCalc(); fin(); showToast('Guardado','ok');
  }).withFailureHandler(function(e){ showToast(e.message,'err'); }).guardarEnvMoto(S.token,d);
}
function envMotoNuevo(){
  var n=document.getElementById('evm-n').value.trim(), q=_evNum(document.getElementById('evm-q').value);
  if(!n){ document.getElementById('evm-n').focus(); return; } if(!q){ document.getElementById('evm-q').focus(); return; }
  var ex=_evMotoLista().filter(function(x){ return x.n.toLowerCase()===n.toLowerCase(); })[0]; if(ex) n=ex.n;
  _evMotoGuardar({ fecha:document.getElementById('evm-d').value, motorizado:n, tamano:_evMkP(document.getElementById('evm-t').value).tamano, caja:_evMkP(document.getElementById('evm-t').value).caja, tipo:'debe', cantidad:q, nota:document.getElementById('evm-o').value },
    function(){ ENV.mForm=null; ENV.mAb[n]=''; _evRender(); });
}
function envMotoMov(n){
  var kk=_evK(n), q=_evNum(document.getElementById('evp-q-'+kk).value); if(!q){ document.getElementById('evp-q-'+kk).focus(); return; }
  var tp=ENV.mAb[n]==='dev'?'dev':'debe';
  _evMotoGuardar({ fecha:document.getElementById('evp-d-'+kk).value, motorizado:n, tamano:_evMkP(document.getElementById('evp-t-'+kk).value).tamano, caja:_evMkP(document.getElementById('evp-t-'+kk).value).caja, tipo:tp, cantidad:q },
    function(){ ENV.mAb[n]=''; _evRender(); });
}
function envMotoQuitar(id){
  _confirmDialog('Quitar movimiento','Se quitará esta línea del historial del motorizado y cambiará su saldo.',function(){
    google.script.run.withSuccessHandler(function(r){
      if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo quitar','err'); return; }
      ENV.d.moto=ENV.d.moto.filter(function(x){ return x.id!==id; }); _evCalc(); _evRender(); showToast('Quitado','ok');
    }).withFailureHandler(function(e){ showToast(e.message,'err'); }).eliminarEnvMoto(S.token,id);
  },'Quitar');
}

/* ══ Precios ══ */
function envPrecios(){
  var R=[['caja','Caja plástica (620/650, 330, 1100)','S/ por caja'],['bot630_1000','Botella 630 y 1000 ml','S/ por botella'],['bot310','Botella 305 / 310 ml','S/ por botella']];
  var el=document.getElementById('ev-pr');
  if(!el){ el=document.createElement('div'); el.id='ev-pr'; el.className='evp'; document.body.appendChild(el); }
  el.innerHTML='<div class="evp-box"><div class="evp-h"><b>Precio por unidad</b><span>valoriza las diferencias</span></div>'+
    R.map(function(r){ return '<div class="evp-r"><div><b>'+r[1]+'</b><small>'+r[2]+'</small></div><input class="inp" id="evp-'+r[0]+'" type="number" step="0.01" min="0" value="'+_evPrecio(r[0])+'"></div>'; }).join('')+
    '<div class="evp-f"><button class="btn btn-ghost" onclick="envPrCerrar()">Cancelar</button><button class="btn btn-primary" onclick="envPrGuardar()">Guardar precios</button></div></div>';
  el.className='evp on';
}
function envPrCerrar(){ var el=document.getElementById('ev-pr'); if(el) el.className='evp'; }
function envPrGuardar(){
  var pr={}, ok=true;
  ['caja','bot630_1000','bot310'].forEach(function(g){ var v=Number(String(document.getElementById('evp-'+g).value).replace(',','.')); if(isNaN(v)||v<0) ok=false; pr[g]=v; });
  if(!ok){ showToast('Revisa los precios','err'); return; }
  google.script.run.withSuccessHandler(function(r){ if(!r.ok){ showToast(r.error,'err'); return; } showToast('Precios guardados','ok'); envPrCerrar(); _evRecargar(); })
    .withFailureHandler(function(e){ showToast(e.message,'err'); }).guardarEnvasePrecios(S.token,pr);
}

/* ══ Exportar la semana ══ */
function exportEnvases(){
  if(!ENV.d||!ENV.m){ showToast('No hay datos para exportar','err'); return; }
  var m=ENV.m, h=['Sku','Descripción','Inicial'];
  m.days.forEach(function(d,i){ var p=ENV_DN[i]+' '+parseInt(d.slice(8),10); ['ENT','DEV','Venta','Moto','Conteo','Dif.'].forEach(function(x){ h.push(p+' '+x); }); });
  _exportXLSX(h,ENV_FILAS.map(function(r,j){ return j; }),function(j){
    var r=ENV_FILAS[j], out=[r.sku,r.t+' ('+r.n+')', m.b>=0&&m.tot[m.b]?m.tot[m.b][j]:''];
    m.days.forEach(function(d,i){
      var mm=m.M[i][j], c=m.tot[i]?m.tot[i][j]:null, x=_evDif(i,j);
      out.push(r.k==='vac'?'':mm.ent+mm.entD||'', r.k==='lle'?'':mm.dev+mm.devD||'', r.k==='vac'?'':mm.ven+mm.venD||'', r.k==='lle'?'':m.PEND[i][j]||'', c==null?'':c, x==null?'':x);
    });
    return out;
  },'Envases semana','control_envases_'+m.days[0]);
}

/* ── PFN: pestaña aparte. Lo que se guarda vale desde esa fecha y se mantiene hasta el próximo cambio; el total se ve en la columna PFN de Movimientos y conteo ── */
function _evPfnPinta(){
  var el=document.getElementById('ev-pfn'); if(!el) return;
  var m=ENV.m, s=ENV.sel, dia=m.days[s], todas=ENV.d.conteo.concat(ENV.d.pfnPrev), desde=_evFechaPfn(todas,dia), fecha=ENV.pfnFecha||dia;
  var cur=m.pfn[s]||_evCeros(), tot=0, h='';
  ENV_FILAS.forEach(function(r,j){
    tot+=cur[j]||0;
    if(r.g) h+='<div class="ev-gp" style="grid-column:1/-1">'+r.g+'</div>';
    h+='<div class="ev-n1"><b>'+r.t+'</b><small>'+r.sku+' · '+r.n+'</small></div>'+
       '<div class="ev-c mut" style="text-align:center">'+(cur[j]||'—')+'</div>'+
       '<input class="inp ev-in" id="evp-'+j+'" inputmode="numeric" placeholder="0" value="'+(cur[j]||'')+'">';
  });
  el.innerHTML=
    '<div class="ev-card"><div class="ev-h"><span class="t">PFN</span><span class="s">'+(desde?'Vigente desde el '+_evF(desde):'Aún no hay PFN registrado')+' · total '+tot+'</span></div>'+
    '<p class="evm-note">El PFN que guardes vale desde la fecha que elijas y se mantiene todos los días siguientes hasta que lo vuelvas a editar. Se suma al conteo de cada día (Palet + Cámara + PFN + lo que deben los motorizados); lo ves en la columna PFN de Movimientos y conteo. En las cajas va la cantidad de cajas; en las botellas, la cantidad de botellas.</p>'+
    '<div style="display:grid;grid-template-columns:minmax(150px,1.5fr) 80px 110px;gap:6px 12px;align-items:center;max-width:520px">'+
      '<span class="ev-k">Envase</span><span class="ev-k" style="text-align:center">Vigente</span><span class="ev-k" style="text-align:center">Nuevo PFN</span>'+h+'</div>'+
    '<div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:14px;flex-wrap:wrap"><label class="ev-k">Aplica desde</label>'+
      '<input class="inp" id="evp-f" type="date" value="'+esc(fecha)+'" style="width:auto"><button class="btn btn-primary" onclick="envPfnGuardar()">Guardar PFN</button></div></div>';
}
function envPfnGuardar(){
  var f=document.getElementById('evp-f').value; if(!f){ showToast('Elige la fecha desde la que aplica','err'); return; }
  var por={};
  ENV_FILAS.forEach(function(r,j){
    var v=_evNum(document.getElementById('evp-'+j).value)||0, est=r.k==='vac'?'vacia':'llena', k=r.tam+'|'+est;
    var o=por[k]||(por[k]={ estado:est, tamano:r.tam, solas:0, unidades:0 });
    if(r.k==='caja') o.solas+=v; else o.unidades+=v;
  });
  var lineas=Object.keys(por).map(function(k){ return por[k]; });
  google.script.run.withSuccessHandler(function(res){
    if(!res||!res.ok){ showToast((res&&res.error)||'No se pudo guardar el PFN','err'); return; }
    ENV.pfnFecha=f; showToast('PFN guardado desde el '+_evF(f)); _evRecargar();
  }).withFailureHandler(function(e){ showToast(e.message,'err'); }).guardarEnvPfn(S.token,{ fecha:f, lineas:lineas });
}
