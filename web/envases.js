/* ══════════════════════════════════════════════════════════════
   ENVASES — control semanal por tienda
   · Conteo por sector (Palet, Cámara) y PFN, que se mantiene todos los días hasta que se edita.
   · Movimientos del día: ENT y Venta en las botellas llenas, DEV en las vacías (Marcaje suma solo).
   · Motorizados: lo que deben y lo que devuelven; cada devolución suma a las vacías esperadas.
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
var ENV_TAMN = { 630:'Botella 630', 310:'Botella 305', 1000:'Botella litro' };
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
  var tot=days.map(function(dia,di){ return C[di].has ? ENV_FILAS.map(function(r,j){ return C[di].pal[j]+C[di].cam[j]+pfn[di][j]; }) : null; });
  var M=days.map(function(){ return ENV_FILAS.map(function(){ return { ent:0,entD:0,dev:0,devD:0,ven:0,venD:0 }; }); });
  d.mov.forEach(function(m){
    var di=days.indexOf(m.fecha); if(di<0||!ENV_MULT[m.tamano]) return;
    var bot=m.packs*ENV_MULT[m.tamano]+m.unidades, j, f=m.doc?'D':'';
    if(m.tipo==='entrada'&&m.estado==='llena'){ j=_evFilaIdx(m.tamano,'lle'); if(j>=0) M[di][j]['ent'+f]+=bot; }
    else if(m.tipo==='devolucion'&&m.estado==='vacia'){ j=_evFilaIdx(m.tamano,'vac'); if(j>=0) M[di][j]['dev'+f]+=bot; }
    else if(m.tipo==='venta'){ j=_evFilaIdx(m.tamano,'lle'); if(j>=0) M[di][j]['ven'+f]+=bot; }
  });
  var MR=days.map(function(){ return {630:0,310:0,1000:0}; });
  d.moto.forEach(function(x){ var di=days.indexOf(x.fecha); if(di>=0&&x.tipo==='dev') MR[di][x.tamano]+=x.cantidad; });
  var b=-1, last=-1;
  C.forEach(function(c,di){ if(c.has){ if(b<0) b=di; last=di; } });
  ENV.m={ days:days, C:C, pfn:pfn, tot:tot, M:M, MR:MR, b:b, last:last };
}
function _evMovDia(di,j){ var m=ENV.m.M[di][j]; return m.ent+m.entD-m.dev-m.devD-m.ven-m.venD+(ENV_FILAS[j].k==='vac'?ENV.m.MR[di][ENV_FILAS[j].tam]:0); }
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
        '<button class="ev-vtab'+(ENV.vista==='mot'?' on':'')+'" onclick="envVista(\'mot\')">Motorizados'+(deudores?' <b>'+deudores+'</b>':'')+'</button></div>'+
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
            '<div class="ev-ft">Esperado = conteo inicial + entradas − devoluciones − ventas + botellas que devolvieron los motorizados, de los días anteriores. Diferencia = conteo del día − esperado. Dentro de una familia, las diferencias de llenas y vacías se compensan. Las cajas plásticas solo se cuentan. ENT y DEV de Marcaje se suman solos (aparecen como + debajo del número).</div></div>'
        : '<div id="ev-mot"></div>')+
    '</div>';
  if(ENV.vista==='ctl'){ _evDias(); _evTabla(); _evResumen(); }
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
  var m=ENV.m, s=ENV.sel, h='<div class="ev-th"><span>Envase</span><span>Inicial</span><span>ENT</span><span>DEV</span><span>Venta</span><span>Moto</span><span>Esperado</span><span>Conteo</span><span>Diferencia</span></div>';
  ENV_FILAS.forEach(function(r,j){
    if(r.g) h+='<div class="ev-gp">'+r.g+'</div>';
    var ini=m.b>=0&&m.tot[m.b]?m.tot[m.b][j]:null, esp=_evEsp(s,j), c=m.tot[s]?m.tot[s][j]:null, d=_evDif(s,j), mm=m.M[s][j], mr=r.k==='vac'?m.MR[s][r.tam]:0;
    var tipo=r.k==='caja'?'<em class="c">solo se cuenta</em>':r.k==='lle'?'<em class="l">llena</em>':'<em class="v">vacía</em>';
    var inp=function(k,ok,doc){
      return ok?'<input class="inp ev-in" inputmode="numeric" value="'+(mm[k]||'')+'" placeholder="0" oninput="envMovIn('+j+',\''+k+'\',this)" onchange="envMovGuardar('+j+',\''+k+'\',this)">'+(doc?'<small class="ev-doc" title="Viene de un Marcaje">+'+doc+'</small>':''):'<div class="ev-na"></div>';
    };
    h+='<div class="ev-r" data-j="'+j+'">'+
      '<div class="ev-n1"><b>'+r.t+' '+tipo+'</b><small>'+r.sku+' · '+r.n+'</small></div>'+
      '<div class="ev-c mut q" data-l="Inicial">'+(ini==null?'—':ini)+'</div>'+
      '<div class="q'+(r.k==='lle'?'':' na')+'" data-l="ENT">'+inp('ent',r.k==='lle',mm.entD)+'</div>'+
      '<div class="q'+(r.k==='vac'?'':' na')+'" data-l="DEV">'+inp('dev',r.k==='vac',mm.devD)+'</div>'+
      '<div class="q'+(r.k==='lle'?'':' na')+'" data-l="Venta">'+inp('ven',r.k==='lle',mm.venD)+'</div>'+
      '<div class="ev-c q'+(r.k==='vac'?'':' na')+'" data-l="Moto" title="Botellas que devolvieron los motorizados">'+(r.k==='vac'?(mr?'+'+mr:'—'):'')+'</div>'+
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
  var tipo=k==='ent'?'entrada':k==='dev'?'devolucion':'venta', estado=k==='dev'?'vacia':'llena';
  ENV.m.M[di][j][k]=v;
  google.script.run.withSuccessHandler(function(res){
    if(!res||!res.ok){ showToast((res&&res.error)||'No se pudo guardar','err'); _evRecargar(); return; }
    ENV.d.mov=ENV.d.mov.filter(function(x){ return !(x.fecha===fecha&&x.tipo===tipo&&x.tamano===r.tam&&x.estado===estado&&!x.doc); });
    if(v>0) ENV.d.mov.push({ fecha:fecha, tipo:tipo, tamano:r.tam, estado:estado, packs:0, unidades:v, doc:0 });
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
    f+=dn; sob+=up; mx=Math.max(mx,up,dn); return { o:o, v:v, tot:up-dn };
  });
  var fm=function(n){ return val?_evMoney(n):(n>0?'+':'')+n; }, net=sob-f;
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
    '<div class="evm2-cols">'+cols+'</div>'+
    '<div class="evm2-lg">'+Object.keys(ENV_FAM).map(function(k){ return '<span><i style="background:'+ENV_FCOL[k]+'"></i>'+ENV_FAM[k].n+'</span>'; }).join('')+'<span><i style="background:#7ADBB3"></i>Cuadra</span></div></div>';
  el.innerHTML=L+R;
}

/* ══ Pantalla de conteo: formulario "Agregar al conteo" (estado, envase, ubicación, cajas y botellas) ══ */
var ENV_UBIS = ['Palet','Cámara','Z3','Pendientes','PFN'];
var ENV_CAJA = { 630:'620/650 (3500192)', 310:'330 (3500240)', 1000:'1100 (3500193)' };
function _evNLin(l){ var n=ENV_MULT[l.tamano]; return { cajas:l.packs+l.solas, bot:l.packs*n+l.unidades }; }
function _evFechaPfn(lineas,hasta){ var f=''; lineas.forEach(function(l){ if(_evSec(l.ubicacion)==='PFN'&&l.fecha<=hasta&&l.fecha>f) f=l.fecha; }); return f; }
function envContar(){
  if(!ENV.d||!ENV.m){ showToast('Espera a que cargue la semana','err'); return; }
  if(ENV.vista!=='ctl'){ ENV.vista='ctl'; _evRender(); }
  var di=ENV.sel, fecha=ENV.m.days[di], todas=ENV.d.conteo.concat(ENV.d.pfnPrev);
  var ses={ di:di, fecha:fecha, lineas:[], pfnDirty:false, pfnHoy:false,
    f:{ estado:'vacia', tam:630, ubi:'Palet', solas:'', packs:'', und:'' } };
  var propias=ENV.d.conteo.filter(function(l){ return l.fecha===fecha; });
  propias.forEach(function(l){ if(_evSec(l.ubicacion)==='PFN') ses.pfnHoy=true; ses.lineas.push({ estado:l.estado, tamano:l.tamano, ubi:_evUbi(l.ubicacion), packs:l.packs, solas:l.solas, unidades:l.unidades, h:'—', carry:false }); });
  if(!ses.pfnHoy){ // PFN de días anteriores: se muestra y se mantiene
    var fp=_evFechaPfn(todas.filter(function(l){ return l.fecha<fecha; }),fecha);
    todas.filter(function(l){ return l.fecha===fp&&_evSec(l.ubicacion)==='PFN'; }).forEach(function(l){ ses.lineas.push({ estado:l.estado, tamano:l.tamano, ubi:'PFN', packs:l.packs, solas:l.solas, unidades:l.unidades, h:'—', carry:true }); });
  }
  ENV.ses=ses; _evcMontar(); _evcPinta();
}
function _evUbi(u){ u=String(u||'').trim(); var k=u.toLowerCase(); if(k==='cámara'||k==='camara') return 'Cámara'; if(k==='z3') return 'Z3'; if(k==='pendientes') return 'Pendientes'; if(k==='pfn') return 'PFN'; return 'Palet'; }
function _evcMontar(){
  var el=document.getElementById('evc');
  if(!el){ el=document.createElement('div'); el.id='evc'; el.className='evc'; document.body.appendChild(el); }
  el.innerHTML=
    '<div class="evc-top"><button class="btn btn-ghost btn-sm" onclick="envCerrarConteo()">‹ Volver</button><h2 id="evc-t"></h2><span class="ev-sp"></span></div>'+
    '<div class="evc-body evcf-body"><div class="evc-card evcf" id="evcf"></div>'+
      '<div class="evcf-r"><div class="evc-card evc-l"><h3>Conteo del día</h3><div class="s" id="evc-ls"></div><div id="evc-ll"></div></div>'+
      '<div class="evc-card evcf-sum"><h3>Lo que verá el Control</h3><div id="evc-sum"></div></div></div></div>'+
    '<div class="evc-ft"><span class="t">Botellas contadas<b id="evc-n">0</b></span><span class="ev-sp"></span>'+
      '<button class="btn btn-ghost" onclick="envCerrarConteo()">Cancelar</button><button class="btn btn-primary" id="evc-gb" onclick="envGuardarConteo()">Guardar conteo</button></div>';
  el.className='evc on'; document.body.classList.add('evc-abierto');
}
function envCerrarConteo(){ var el=document.getElementById('evc'); if(el) el.className='evc'; document.body.classList.remove('evc-abierto'); ENV.ses=null; }
function envF(campo,v){ var f=ENV.ses.f; f[campo]=(campo==='tam')?Number(v):v; _evcPinta(); }
function envFIn(campo,el){ ENV.ses.f[campo]=el.value; _evcForm(); }
function _evcForm(){
  var f=ENV.ses.f, n=ENV_MULT[f.tam], packs=_evNum(f.packs)||0, solas=_evNum(f.solas)||0, und=_evNum(f.und)||0;
  var c=document.getElementById('evcf-c'), b=document.getElementById('evcf-b'); if(!c||!b) return;
  c.innerHTML=packs+' + '+solas+' = <b>'+(packs+solas)+'</b> cajas';
  b.innerHTML=packs+' × '+n+' = '+(packs*n)+' + '+und+' = <b>'+(packs*n+und)+'</b> botellas';
  var a=document.getElementById('evcf-auto'); if(a) a.textContent=packs;
}
function envAgregar(){
  var s=ENV.ses, f=s.f, packs=_evNum(f.packs)||0, solas=_evNum(f.solas)||0, und=_evNum(f.und)||0;
  if(packs+solas+und===0){ showToast('Ingresa al menos una cantidad','err'); return; }
  var d=new Date(); s.lineas.push({ estado:f.estado, tamano:f.tam, ubi:f.ubi, packs:packs, solas:solas, unidades:und, h:('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2), carry:false });
  if(f.ubi==='PFN') s.pfnDirty=true;
  f.packs=''; f.solas=''; f.und=''; _evcPinta();
}
function envQuitar(k){ var s=ENV.ses, l=s.lineas[k]; if(l.ubi==='PFN') s.pfnDirty=true; s.lineas.splice(k,1); _evcPinta(); }
function _evcSeg(opts,sel,fn){ return '<div class="ev-seg evcf-seg">'+opts.map(function(o){ return '<button class="'+(String(o[0])===String(sel)?'on':'')+'" onclick="'+fn+'(\''+o[0]+'\')">'+o[1]+'</button>'; }).join('')+'</div>'; }
function _evcPinta(){
  var s=ENV.ses, m=ENV.m; if(!s) return; var f=s.f;
  document.getElementById('evc-t').textContent='Conteo del '+ENV_DL[s.di]+' '+parseInt(s.fecha.slice(8),10)+(s.di===m.b?' · inicial':'');
  var n=ENV_MULT[f.tam];
  document.getElementById('evcf').innerHTML=
    '<div class="evcf-k">Agregar al conteo</div>'+
    '<label class="evcf-l">Estado</label>'+_evcSeg([['llena','Llenas'],['vacia','Vacías']],f.estado,'envFE')+
    '<label class="evcf-l">Envase</label>'+_evcSeg([[630,'Botella 630'],[310,'Botella 305'],[1000,'Botella 1000']],f.tam,'envFT')+
    '<div class="evcf-h">Multiplica ×'+n+' · caja plástica asociada: '+ENV_CAJA[f.tam]+'</div>'+
    '<label class="evcf-l">Ubicación</label>'+_evcSeg(ENV_UBIS.map(function(u){ return [u,u]; }),f.ubi,'envFU')+
    (f.ubi==='PFN'?'<div class="evcf-h">El PFN se mantiene: se suma al conteo de todos los días siguientes hasta que lo cambies.</div>':'')+
    '<div class="evcf-box"><div class="evcf-bt"><b>Cajas plásticas</b><span>'+ENV_CAJA[f.tam].split(' ')[0]+'</span></div><div class="evcf-g">'+
      '<div><label>Con botellas</label><div class="evcf-auto"><em>AUTO</em><b id="evcf-auto">'+(_evNum(f.packs)||0)+'</b></div></div>'+
      '<div><label>Solas (sin botellas)</label><input class="inp" inputmode="numeric" placeholder="0" value="'+esc(f.solas)+'" oninput="envFIn(\'solas\',this)"></div></div>'+
      '<div class="evcf-eq" id="evcf-c"></div></div>'+
    '<div class="evcf-box"><div class="evcf-bt"><b>Botellas</b><span>× '+n+' automático</span></div><div class="evcf-g">'+
      '<div><label>Packs (cajas completas)</label><input class="inp" inputmode="numeric" placeholder="0" value="'+esc(f.packs)+'" oninput="envFIn(\'packs\',this)"></div>'+
      '<div><label>Unidades sueltas</label><input class="inp" inputmode="numeric" placeholder="0" value="'+esc(f.und)+'" oninput="envFIn(\'und\',this)"></div></div>'+
      '<div class="evcf-eq" id="evcf-b"></div></div>'+
    '<div class="evcf-h">Los packs de botellas ya cuentan como "cajas con botellas": solo se escriben una vez.</div>'+
    '<button class="btn btn-primary evcf-add" onclick="envAgregar()">✓ Agregar al conteo</button>';
  _evcForm();
  // lista de líneas
  var L=s.lineas.length?s.lineas.map(function(l,k){ return k; }).reverse().map(function(k){
    var l=s.lineas[k], x=_evNLin(l);
    return '<div class="evc-li evcf-li"><span class="sc '+(l.estado==='llena'?'ll':'va')+'">'+(l.estado==='llena'?'Llena':'Vacía')+'</span><span class="e">'+ENV_TAMN[l.tamano]+' · '+l.ubi+(l.carry?' <small>de días anteriores</small>':'')+'</span>'+
      '<span class="q">'+x.cajas+' cajas · '+x.bot+' bot.</span><button title="Quitar" onclick="envQuitar('+k+')">✕</button></div>'; }).join('')
    :'<div class="evc-le">Aún no agregaste nada.<br>Llena el formulario y toca "Agregar al conteo".</div>';
  document.getElementById('evc-ll').innerHTML=L;
  document.getElementById('evc-ls').textContent=s.lineas.length+(s.lineas.length===1?' línea':' líneas');
  // resumen por envase
  var tot={}; [630,310,1000].forEach(function(t){ tot[t]={ caja:0, vac:0, lle:0 }; });
  s.lineas.forEach(function(l){ var x=_evNLin(l); tot[l.tamano].caja+=x.cajas; tot[l.tamano][l.estado==='llena'?'lle':'vac']+=x.bot; });
  var nb=0; var h='<div class="evcf-rt h"><span>Envase</span><span>Caja plástica</span><span>Vacías</span><span>Llenas</span></div>';
  [630,310,1000].forEach(function(t){ nb+=tot[t].vac+tot[t].lle; h+='<div class="evcf-rt"><span>'+ENV_TAMN[t]+'</span><span>'+tot[t].caja+'</span><span>'+tot[t].vac+'</span><span>'+tot[t].lle+'</span></div>'; });
  document.getElementById('evc-sum').innerHTML=h; document.getElementById('evc-n').textContent=nb.toLocaleString('es-PE');
}
function envFE(v){ envF('estado',v); } function envFT(v){ envF('tam',v); } function envFU(v){ envF('ubi',v); }
function envGuardarConteo(){
  var s=ENV.ses; if(!s||ENV.busy) return;
  var escribirPfn=s.pfnDirty||s.pfnHoy, lineas=[];
  s.lineas.forEach(function(l){
    if(l.ubi==='PFN'&&!escribirPfn) return;
    lineas.push({ estado:l.estado, tamano:l.tamano, ubicacion:l.ubi, packs:l.packs, solas:l.solas, unidades:l.unidades });
  });
  var btn=document.getElementById('evc-gb'); ENV.busy=true; btn.disabled=true; btn.textContent='Guardando…';
  google.script.run.withSuccessHandler(function(r){
    ENV.busy=false; btn.disabled=false; btn.textContent='Guardar conteo';
    if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo guardar el conteo','err'); return; }
    showToast('Conteo guardado','ok'); envCerrarConteo(); _evRecargar();
  }).withFailureHandler(function(e){ ENV.busy=false; btn.disabled=false; btn.textContent='Guardar conteo'; showToast(e.message,'err'); })
    .guardarEnvConteo(S.token,{ fecha:s.fecha, lineas:lineas });
}

/* ══ Motorizados ══ */
function _evMotoLista(){
  var mapa={}, orden=[];
  ((ENV.d&&ENV.d.moto)||[]).forEach(function(x){
    var k=x.motorizado.toLowerCase(); if(!mapa[k]){ mapa[k]={ n:x.motorizado, led:[], bal:{}, debe:0 }; orden.push(k); }
    mapa[k].led.push(x); mapa[k].bal[x.tamano]=(mapa[k].bal[x.tamano]||0)+(x.tipo==='debe'?x.cantidad:-x.cantidad);
  });
  return orden.map(function(k){ var o=mapa[k]; Object.keys(o.bal).forEach(function(t){ if(o.bal[t]>0) o.debe+=o.bal[t]; }); return o; });
}
function _evK(n){ return n.replace(/[^A-Za-z0-9]/g,'_'); }
function envMF(f){ ENV.mf=f; _evMotPinta(); }
function _evMotPinta(){
  var el=document.getElementById('ev-mot'); if(!el) return;
  var lista=_evMotoLista(), deben=0, conSaldo=0, devSem=0, dias=ENV.m.days;
  lista.forEach(function(m){ deben+=m.debe; if(m.debe>0) conSaldo++; m.led.forEach(function(e){ if(e.tipo==='dev'&&dias.indexOf(e.fecha)>=0) devSem+=e.cantidad; }); });
  var f='';
  if(ENV.mForm){
    f='<div class="evm-form"><span class="t">Nuevo pendiente: el motorizado queda debiendo botellas vacías</span><div class="evm-f">'+
      '<div><label>Motorizado</label><input class="inp" id="evm-n" list="evm-nl" placeholder="Escribe o elige un nombre" autocomplete="off"><datalist id="evm-nl">'+lista.map(function(m){ return '<option value="'+esc(m.n)+'">'; }).join('')+'</datalist></div>'+
      '<div><label>Envase</label><select id="evm-t"><option value="630">Botella 630</option><option value="310">Botella 305</option><option value="1000">Botella litro</option></select></div>'+
      '<div><label>Cantidad</label><input class="inp" id="evm-q" inputmode="numeric" placeholder="0"></div>'+
      '<div><label>Fecha</label><input class="inp" id="evm-d" type="date" value="'+esc(ENV.mForm.fecha)+'"></div>'+
      '<div><label>Nota (opcional)</label><input class="inp" id="evm-o" placeholder="Ej: pedido 4821"></div></div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn btn-ghost" onclick="ENV.mForm=null;_evMotPinta()">Cancelar</button><button class="btn btn-primary" onclick="envMotoNuevo()">Guardar pendiente</button></div></div>';
  }
  var vis=lista.slice().sort(function(a,b){ return b.debe-a.debe; }).filter(function(m){ return ENV.mf==='todos'||m.debe>0; });
  el.innerHTML=
    '<div class="evm-kp"><div class="ev-card"><div class="ev-k">Botellas que deben</div><div class="ev-v" style="font-size:28px">'+deben+'</div><div class="ev-n">entre todos los motorizados</div></div>'+
      '<div class="ev-card"><div class="ev-k">Motorizados con saldo</div><div class="ev-v" style="font-size:28px">'+conSaldo+'</div><div class="ev-n">de '+lista.length+' registrados</div></div>'+
      '<div class="ev-card"><div class="ev-k">Devuelto esta semana</div><div class="ev-v ev-pos" style="font-size:28px">'+devSem+'</div><div class="ev-n">suma a las vacías esperadas</div></div></div>'+
    '<p class="evm-note">Cuando se vende producto retornable, el motorizado queda debiendo las botellas vacías. Aquí anotas cuántas debe y, cuando las trae, registras la devolución (puede ser parcial). Cada devolución <b>suma a las vacías esperadas</b> del día que registres, y por eso el faltante baja.</p>'+
    '<div class="evm-bar"><button class="btn btn-primary" onclick="ENV.mForm={fecha:\''+_evHoy()+'\'};_evMotPinta();var n=document.getElementById(\'evm-n\');if(n)n.focus()">+ Nuevo pendiente</button><span class="ev-sp"></span>'+
      '<div class="ev-seg"><button class="'+(ENV.mf==='pen'?'on':'')+'" onclick="envMF(\'pen\')">Con saldo</button><button class="'+(ENV.mf==='todos'?'on':'')+'" onclick="envMF(\'todos\')">Todos</button></div></div>'+
    f+
    (vis.length?vis.map(function(m){
      var deb=Object.keys(m.bal).filter(function(t){ return m.bal[t]>0; }), ab=ENV.mAb[m.n], kk=_evK(m.n), panel='';
      var chips=deb.length?deb.map(function(t){ return '<span>'+ENV_TAMN[t]+' · '+m.bal[t]+'</span>'; }).join(''):'<span class="ok">Al día</span>';
      if(ab){
        var opts=(ab==='dev'?deb:['630','310','1000']).map(function(t){ return '<option value="'+t+'">'+ENV_TAMN[t]+(ab==='dev'?' (debe '+m.bal[t]+')':'')+'</option>'; }).join('');
        panel='<div class="evm-pn"><div class="r"><div><label>Envase</label><select id="evp-t-'+kk+'" onchange="envMotoSel(\''+esc(m.n).replace(/'/g,"\\'")+'\',this.value)">'+opts+'</select></div>'+
          '<div><label>'+(ab==='dev'?'Cantidad que devolvió':'Cantidad que debe')+'</label><input class="inp" id="evp-q-'+kk+'" inputmode="numeric" value="'+(ab==='dev'&&deb.length?m.bal[deb[0]]:'')+'" placeholder="0"></div>'+
          '<div><label>Fecha</label><input class="inp" id="evp-d-'+kk+'" type="date" value="'+esc(_evHoy())+'"></div><div></div>'+
          '<button class="btn btn-primary" onclick="envMotoMov(\''+esc(m.n).replace(/'/g,"\\'")+'\')">'+(ab==='dev'?'Registrar devolución':'Agregar')+'</button>'+
          '<div class="hint">'+(ab==='dev'?'Por defecto aparece todo lo que debe; cámbialo si devolvió solo una parte (el resto queda pendiente).':'Suma a lo que ya debe.')+'</div></div></div>';
      }
      var hist=ENV.mHist[m.n]?'<div class="evm-hist">'+m.led.slice().reverse().map(function(e){
        return '<div class="evm-l"><span class="d">'+_evF(e.fecha)+'</span><span>'+ENV_TAMN[e.tamano]+(e.nota?' · '+esc(e.nota):'')+'</span><span class="q '+(e.tipo==='debe'?'d1':'d2')+'">'+(e.tipo==='debe'?'debe +':'devolvió −')+e.cantidad+'</span><button title="Quitar" onclick="envMotoQuitar('+e.id+')">✕</button></div>'; }).join('')+'</div>':'';
      var nq=esc(m.n).replace(/'/g,"\\'");
      return '<div class="evm-c"><div class="evm-h"><div class="evm-av">'+esc(m.n.split(' ').map(function(x){ return x[0]; }).slice(0,2).join('').toUpperCase())+'</div><div class="evm-n"><b>'+esc(m.n)+'</b><small>'+m.led.length+' movimientos</small></div><div class="evm-bal">'+chips+'</div></div>'+
        '<div class="evm-act"><button class="btn btn-primary" '+(deb.length?'':'disabled style="opacity:.4"')+' onclick="envMotoPanel(\''+nq+'\',\'dev\')">Devolvió botellas</button>'+
        '<button class="btn btn-ghost" onclick="envMotoPanel(\''+nq+'\',\'debe\')">+ Debe más</button>'+
        '<button class="btn btn-ghost" onclick="ENV.mHist[\''+nq+'\']=!ENV.mHist[\''+nq+'\'];_evMotPinta()">'+(ENV.mHist[m.n]?'Ocultar historial':'Ver historial')+'</button></div>'+panel+hist+'</div>';
    }).join(''):'<div class="evm-empty">'+(lista.length?'Nadie debe botellas. Todos los motorizados están al día.':'Aún no hay motorizados. Agrega el primero con "+ Nuevo pendiente".')+'</div>');
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
  _evMotoGuardar({ fecha:document.getElementById('evm-d').value, motorizado:n, tamano:+document.getElementById('evm-t').value, tipo:'debe', cantidad:q, nota:document.getElementById('evm-o').value },
    function(){ ENV.mForm=null; ENV.mAb[n]=''; _evRender(); });
}
function envMotoMov(n){
  var kk=_evK(n), q=_evNum(document.getElementById('evp-q-'+kk).value); if(!q){ document.getElementById('evp-q-'+kk).focus(); return; }
  var tp=ENV.mAb[n]==='dev'?'dev':'debe';
  _evMotoGuardar({ fecha:document.getElementById('evp-d-'+kk).value, motorizado:n, tamano:+document.getElementById('evp-t-'+kk).value, tipo:tp, cantidad:q },
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
      out.push(r.k==='lle'?mm.ent+mm.entD:'', r.k==='vac'?mm.dev+mm.devD:'', r.k==='lle'?mm.ven+mm.venD:'', r.k==='vac'?m.MR[i][r.tam]||'':'', c==null?'':c, x==null?'':x);
    });
    return out;
  },'Envases semana','control_envases_'+m.days[0]);
}
