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
          '<div class="ev-res"><div class="ev-card"><div class="ev-k" id="ev-rk"></div><div class="ev-v" id="ev-rt"></div><div class="ev-n" id="ev-rn"></div></div>'+
            '<div class="ev-card"><div class="ev-k" style="margin-bottom:10px" id="ev-dk"></div><table class="ev-df"><thead><tr><th>Cierre</th><th class="r">Und.</th><th>Estado</th><th class="r">Precio</th></tr></thead><tbody id="ev-df"></tbody><tfoot><tr><td colspan="3">Total</td><td class="r" id="ev-dt"></td></tr></tfoot></table></div></div>'+
          '<div class="ev-card"><div class="ev-gh"><span class="t">Faltantes y sobrantes de la semana</span><span class="s">diferencia de cada conteo contra lo esperado</span><span class="ev-sp"></span>'+
            '<div class="ev-seg"><button id="ev-mv" class="'+(ENV.met==='val'?'on':'')+'" onclick="envMet(\'val\')">S/</button><button id="ev-mu" class="'+(ENV.met==='und'?'on':'')+'" onclick="envMet(\'und\')">Unidades</button></div></div>'+
            '<div class="ev-ch" id="ev-ch"></div></div>'+
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
function envMet(x){ ENV.met=x; document.getElementById('ev-mv').className=x==='val'?'on':''; document.getElementById('ev-mu').className=x==='und'?'on':''; _evGrafico(); }

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
  var nom=ENV_DL[s]+' '+parseInt(m.days[s].slice(8),10), ini=s===m.b, k;
  document.getElementById('ev-rk').textContent=ini?'Conteo inicial':'Resultado del conteo del '+nom;
  document.getElementById('ev-dk').textContent=ini||!cont?'Diferencia por familia':'Diferencia por familia · '+nom;
  var dt=document.getElementById('ev-dt'); dt.textContent=cont?_evMoney(td.v):'—'; dt.className='r '+(!cont?'':td.v<0?'ev-neg':td.v>0?'ev-pos':'ev-zero');
  var rt=document.getElementById('ev-rt');
  rt.textContent=ini?'Inicial':cont?_evMoney(td.v):'Sin conteo'; rt.className='ev-v '+(ini||!cont?'':td.v===0?'ev-zero':td.v<0?'ev-neg':'ev-pos');
  var fal=Object.keys(o).filter(function(f){ return o[f]<0; }).length;
  document.getElementById('ev-rn').textContent=ini?'Es el punto de partida de la semana':!cont?(m.C[s].has?'Aún no hay un conteo inicial antes de este día':'Toca "Contar este día"'):td.v===0&&td.u===0?'Todo cuadra':fal+(fal===1?' familia con faltante':' familias con faltante');
  _evGrafico();
}

/* gráfico de barras: un valor por día con conteo (el inicial no tiene diferencia) */
function _evGrafico(){
  var m=ENV.m, el=document.getElementById('ev-ch'); if(!el) return;
  var pts=m.days.map(function(d,i){
    if(m.b<0||i<=m.b||!m.C[i].has) return { i:i, v:null };
    var t=_evTotDif(_evDifs(i)); return { i:i, v:ENV.met==='val'?t.v:t.u };
  });
  var W=700,H=210,pl=44,pr=10,pt=14,pb=34,iw=W-pl-pr,ih=H-pt-pb;
  var vals=pts.filter(function(p){ return p.v!=null; }).map(function(p){ return p.v; });
  var mx=Math.max.apply(null,vals.concat([ENV.met==='val'?5:10])), mn=Math.min.apply(null,vals.concat([ENV.met==='val'?-5:-10]));
  var pad=(mx-mn)*0.12; mx+=pad; mn-=pad;
  var y=function(v){ return pt+ih*(mx-v)/(mx-mn); };
  var step=iw/7, bw=Math.min(46,step*0.55), s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">';
  [mx,0,mn].forEach(function(t){ s+='<line class="gl" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(t)+'" y2="'+y(t)+'"/><text x="'+(pl-6)+'" y="'+(y(t)+4)+'" text-anchor="end">'+(t<0?'−':'')+Math.abs(Math.round(t))+'</text>'; });
  s+='<line class="ax" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(0)+'" y2="'+y(0)+'"/>';
  pts.forEach(function(p){
    var cx=pl+step*p.i+step/2, lab=ENV_DN[p.i]+' '+parseInt(m.days[p.i].slice(8),10);
    if(p.v!=null){
      var col=p.v<0?'#F0A3AA':p.v>0?'#8FDCEB':'#7ADBB3', top=Math.min(y(p.v),y(0)), hh=Math.max(Math.abs(y(p.v)-y(0)),p.v===0?3:0);
      s+='<rect class="bar" x="'+(cx-bw/2)+'" y="'+(p.v===0?y(0)-1.5:top)+'" width="'+bw+'" height="'+hh+'" rx="5" fill="'+col+'" onmousemove="envTip(event,'+p.i+')" onmouseleave="document.getElementById(\'ev-tip\').style.display=\'none\'" onclick="envSel('+p.i+')"/>';
      s+='<text x="'+cx+'" y="'+(p.v<0?y(p.v)+14:y(p.v)-6)+'" text-anchor="middle" style="fill:'+col+';font-weight:600">'+(ENV.met==='val'?_evMoney(p.v).replace('S/ ',''):(p.v>0?'+':'')+p.v)+'</text>';
    } else if(p.i===m.b){
      s+='<text x="'+cx+'" y="'+(y(0)-8)+'" text-anchor="middle" style="font-size:10px">inicial</text>';
    }
    s+='<text x="'+cx+'" y="'+(H-12)+'" text-anchor="middle" '+(p.i===ENV.sel?'style="fill:var(--accent2);font-weight:700"':'')+'>'+lab+'</text>';
  });
  el.innerHTML=s+'</svg><div class="ev-tip" id="ev-tip"></div>';
}
function envTip(e,i){
  var o=_evDifs(i), t=document.getElementById('ev-tip'), h='<b>'+ENV_DL[i]+' '+parseInt(ENV.m.days[i].slice(8),10)+'</b>', tot=0;
  Object.keys(ENV_FAM).forEach(function(f){ var v=o[f]*_evPrecio(ENV_FAM[f].g); tot+=v; h+='<div><span>'+ENV_FAM[f].n+'</span><span class="'+_evCls(o[f])+'">'+(o[f]>0?'+':'')+o[f]+' · '+(v===0?'—':_evMoney(v))+'</span></div>'; });
  h+='<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px"><b style="margin:0">Total</b><b style="margin:0">'+_evMoney(tot)+'</b></div>';
  t.innerHTML=h; t.style.display='block';
  var r=document.getElementById('ev-ch').getBoundingClientRect(); t.style.left=Math.min(e.clientX-r.left+12,r.width-170)+'px'; t.style.top=Math.max(e.clientY-r.top-20,0)+'px';
}

/* ══ Pantalla de conteo: Palet, Cámara y PFN ══ */
function envContar(){
  if(!ENV.d||!ENV.m){ showToast('Espera a que cargue la semana','err'); return; }
  if(ENV.vista!=='ctl'){ ENV.vista='ctl'; _evRender(); }
  var m=ENV.m, di=ENV.sel, fecha=m.days[di];
  var ses={ di:di, fecha:fecha, sec:'Palet', ver:false, ent:[], pfn:m.pfn[di].slice(), pfn0:m.pfn[di].slice(), pfnToco:false, pfnHoy:false };
  ENV.d.conteo.filter(function(l){ return l.fecha===fecha; }).forEach(function(l){
    var sec=_evSec(l.ubicacion);
    if(sec==='PFN'){ ses.pfnHoy=true; return; }
    var bot=l.packs*ENV_MULT[l.tamano]+l.unidades, caj=l.packs+l.solas, bi, ci;
    if(bot){ bi=_evFilaIdx(l.tamano,l.estado==='llena'?'lle':'vac'); if(bi>=0) ses.ent.push({ i:bi, sec:sec, q:bot, h:'—' }); }
    if(caj){ ci=_evFilaIdx(l.tamano,'caja'); if(ci>=0) ses.ent.push({ i:ci, sec:sec, q:caj, h:'—' }); }
  });
  ENV.ses=ses; _evcMontar(); _evcPinta();
}
function _evcMontar(){
  var el=document.getElementById('evc');
  if(!el){ el=document.createElement('div'); el.id='evc'; el.className='evc'; document.body.appendChild(el); }
  el.innerHTML=
    '<div class="evc-top"><button class="btn btn-ghost btn-sm" onclick="envCerrarConteo()">‹ Volver</button><h2 id="evc-t"></h2><span class="ev-sp"></span>'+
      '<label class="evc-sw"><input type="checkbox" id="evc-ver" onchange="ENV.ses.ver=this.checked;_evcPinta()">Ver lo esperado</label></div>'+
    '<div class="evc-sec" id="evc-sec"></div><div class="evc-hint" id="evc-hint"></div>'+
    '<div class="evc-body"><div class="evc-card" id="evc-env"></div><div class="evc-card evc-l"><h3 id="evc-lt">Registro del conteo</h3><div class="s" id="evc-ls"></div><div id="evc-ll"></div></div></div>'+
    '<div class="evc-ft"><span class="t">Piezas contadas<b id="evc-n">0</b></span><span class="ev-sp"></span>'+
      '<button class="btn btn-ghost" onclick="envCerrarConteo()">Cancelar</button><button class="btn btn-primary" id="evc-gb" onclick="envGuardarConteo()">Guardar conteo</button></div>';
  el.className='evc on'; document.body.classList.add('evc-abierto');
}
function envCerrarConteo(){ var el=document.getElementById('evc'); if(el) el.className='evc'; document.body.classList.remove('evc-abierto'); ENV.ses=null; }
function _evcTotal(j){ var s=ENV.ses, t=s.pfn[j]||0; s.ent.forEach(function(e){ if(e.i===j) t+=e.q; }); return t; }
function _evcTotales(){
  var s=ENV.ses, n=0;
  ENV_FILAS.forEach(function(r,j){
    var t=_evcTotal(j); n+=t;
    var el=document.getElementById('evc-tot'+j); if(el) el.textContent=(t||s.ent.some(function(e){return e.i===j;})||s.pfn[j])?t:'—';
  });
  document.getElementById('evc-n').textContent=n.toLocaleString('es-PE');
}
function envSector(n){ ENV.ses.sec=n; _evcPinta(); }
function envAgregar(j){
  var s=ENV.ses, inp=document.getElementById('evc-q'+j), q=_evNum(inp.value); if(!q){ inp.focus(); return; }
  var d=new Date(); s.ent.push({ i:j, sec:s.sec, q:q, h:('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2) });
  _evcPinta(); var n=document.getElementById('evc-q'+j); if(n) n.focus();
}
function envQuitar(k){ ENV.ses.ent.splice(k,1); _evcPinta(); }
function envPfnIn(j,el){ var s=ENV.ses; s.pfn[j]=_evNum(el.value)||0; s.pfnToco=true; _evcTotales(); }
function _evcPinta(){
  var s=ENV.ses, m=ENV.m; if(!s) return;
  var sum={}; ENV_SECS.forEach(function(x){ sum[x]=0; });
  s.ent.forEach(function(e){ sum[e.sec]+=e.q; }); sum.PFN=s.pfn.reduce(function(a,b){ return a+b; },0);
  var dia=ENV_DL[s.di]+' '+parseInt(s.fecha.slice(8),10);
  document.getElementById('evc-t').textContent='Conteo del '+dia+(s.di===m.b?' · inicial':'');
  document.getElementById('evc-ver').checked=s.ver;
  document.getElementById('evc-sec').innerHTML='<span class="l">Contando en</span>'+ENV_SECS.map(function(n){
    return '<button class="evc-chip'+(n===s.sec?' on':'')+'" onclick="envSector(\''+n+'\')">'+n+(sum[n]?'<b>'+sum[n].toLocaleString('es-PE')+'</b>':'')+'</button>'; }).join('');
  var pfn=s.sec==='PFN';
  document.getElementById('evc-hint').innerHTML=pfn
    ? '<b>PFN</b> se mantiene: lo que anotes aquí se suma al conteo de <b>todos los días</b> siguientes hasta que lo cambies. Si baja, edítalo y el nuevo valor rige desde este día.'
    : 'Escribe la cantidad de <b>'+s.sec+'</b> y toca <b>Agregar</b>. Cuentas otro sector y vuelves a agregar: el sistema suma todo, junto con el PFN.';
  var h='';
  ENV_FILAS.forEach(function(r,j){
    if(r.g) h+='<div class="evc-g">'+r.g+'</div>';
    var t=_evcTotal(j), esp=_evEsp(s.di,j), d=t-(esp==null?0:esp);
    var tipo=r.k==='caja'?'<em class="c">solo se cuenta</em>':r.k==='lle'?'<em class="l">llena</em>':'<em class="v">vacía</em>';
    var br={}; s.ent.forEach(function(e){ if(e.i===j) br[e.sec]=(br[e.sec]||0)+e.q; }); if(s.pfn[j]) br.PFN=s.pfn[j];
    var has=s.ent.some(function(e){ return e.i===j; })||s.pfn[j];
    h+='<div class="evc-r"><div class="n"><b>'+r.t+' '+tipo+'</b><small>'+r.sku+' · '+r.n+'</small>'+
      (Object.keys(br).length?'<div class="br">'+Object.keys(br).map(function(k){ return '<span>'+k+' '+br[k]+'</span>'; }).join('')+'</div>':'')+'</div>'+
      '<div class="tot"><b id="evc-tot'+j+'">'+(has?t:'—')+'</b><small>total</small>'+(s.ver&&esp!=null&&has?'<span class="ex '+_evCls(d)+'">esp. '+esp+' · '+_evSg(d)+'</span>':'')+'</div>'+
      (pfn
        ? '<div class="add"><input class="inp" inputmode="numeric" value="'+(s.pfn[j]||'')+'" placeholder="PFN" oninput="envPfnIn('+j+',this)"></div>'
        : '<div class="add"><input class="inp" id="evc-q'+j+'" inputmode="numeric" placeholder="+ '+s.sec+'" onkeydown="if(event.key===\'Enter\'){envAgregar('+j+')}"><button onclick="envAgregar('+j+')">Agregar</button></div>')+'</div>';
  });
  document.getElementById('evc-env').innerHTML=h;
  var L='';
  if(pfn){
    document.getElementById('evc-lt').textContent='PFN que se mantiene';
    var vigente=ENV_FILAS.map(function(r,j){ return s.pfn[j]?'<div class="evc-li"><span class="h"></span><span class="sc">PFN</span><span class="e">'+r.t+'</span><span class="q">'+s.pfn[j]+'</span><span></span></div>':''; }).join('');
    document.getElementById('evc-ls').textContent=s.pfn0.some(function(x){ return x; })&&!s.pfnToco?'Valores que vienen de días anteriores':'Valores que regirán desde este día';
    L=vigente||'<div class="evc-le">Aún no hay PFN registrado.<br>Escribe lo que corresponda en cada envase.</div>';
  } else {
    document.getElementById('evc-lt').textContent='Registro del conteo';
    document.getElementById('evc-ls').textContent=s.ent.length+(s.ent.length===1?' anotación':' anotaciones');
    L=s.ent.length?s.ent.map(function(e,k){ return k; }).reverse().map(function(k){ var e=s.ent[k];
      return '<div class="evc-li"><span class="h">'+e.h+'</span><span class="sc">'+e.sec+'</span><span class="e">'+ENV_FILAS[e.i].t+'</span><span class="q">+'+e.q+'</span><button title="Quitar" onclick="envQuitar('+k+')">✕</button></div>'; }).join('')
      :'<div class="evc-le">Aún no anotaste nada.<br>Empieza por cualquier envase.</div>';
  }
  document.getElementById('evc-ll').innerHTML=L;
  _evcTotales();
}
function envGuardarConteo(){
  var s=ENV.ses; if(!s||ENV.busy) return;
  var lineas=[];
  s.ent.forEach(function(e){
    var r=ENV_FILAS[e.i];
    lineas.push(r.k==='caja' ? { estado:'vacia', tamano:r.tam, ubicacion:e.sec, packs:0, solas:e.q, unidades:0 }
                             : { estado:r.k==='lle'?'llena':'vacia', tamano:r.tam, ubicacion:e.sec, packs:0, solas:0, unidades:e.q });
  });
  // el PFN solo se escribe si lo tocaste hoy o ya había un PFN guardado en este día; si no, se sigue arrastrando el anterior
  if(s.pfnToco||s.pfnHoy){
    ENV_FILAS.forEach(function(r,j){ if(!s.pfn[j]) return;
      lineas.push(r.k==='caja' ? { estado:'vacia', tamano:r.tam, ubicacion:'PFN', packs:0, solas:s.pfn[j], unidades:0 }
                               : { estado:r.k==='lle'?'llena':'vacia', tamano:r.tam, ubicacion:'PFN', packs:0, solas:0, unidades:s.pfn[j] }); });
  }
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
