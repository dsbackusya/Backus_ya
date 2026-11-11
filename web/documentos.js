/* ══════════════════════════════════════════════════════════════
   DOCUMENTOS DE DESPACHO — Marcaje (conciliación de envases), Orden de NC y Traslado.
   Se llenan a mano, se guardan en el historial y se imprimen para firma.
   Marcaje alimenta Envases (entrada / devolución) y la NC alimenta M-T (pendiente, factura en Motivo).
   ══════════════════════════════════════════════════════════════ */

/* Envases del Marcaje, en el orden del formato impreso. cz = color del texto en el papel;
   main = botella que se completa sola al escribir las cajas (cajas × botellas por caja). */
var DCX_GR0 = [
  { g:'6xx · 630 / 650 ML', tam:630, mult:12, rows:[
    { sku:3500192, code:'CJPL620/650',   ref:'Caja 6xx',              cz:'b', caja:1 },
    { sku:3500323, code:'BOTVER630CV',   ref:'Botella Pilsen 6xx',    cz:'g', main:1 },
    { sku:3500179, code:'BOTAMB650CV',   ref:'Botellas Cristal',      cz:'' },
    { sku:3500178, code:'BOTINKA620CV',  ref:'Botellas Cusqueña',     cz:'p' } ] },
  { g:'1 LITRO · 1000 ML', tam:1000, mult:12, rows:[
    { sku:3500193, code:'CJPL1100',      ref:'Caja 1 litro',          cz:'b', caja:1 },
    { sku:3500381, code:'BOTVER1000CV',  ref:'Botella litro',         cz:'',  main:1 } ] },
  { g:'3xx · 305 / 310 ML', tam:310, mult:24, rows:[
    { sku:3500240, code:'CJPL330',       ref:'Caja 3xx',              cz:'b', caja:1 },
    { sku:3502226, code:'BOTAMB305R',    ref:'Botella 305',           cz:'',  main:1 },
    { sku:3501495, code:'BOTVRDPC310R',  ref:'Botellas Pilsen 3xx',   cz:'g' },
    { sku:3501491, code:'BOTAMCUS310R',  ref:'Botellas Cusqueña 3xx', cz:'p' } ] },
  /* Barriles: se cuentan por unidad; no pasan al módulo Envases ni se valorizan (sin precio por ahora). */
  { g:'BARRILES · 50 L / 30 L', tam:0, mult:1, barril:1, rows:[
    { sku:3500323, code:'Barril de 50Lt', ref:'Barriles de 50 L', cz:'' },
    { sku:3500054, code:'Barril de 30Lt', ref:'Barriles de 30 L', cz:'' } ] }
];
/* Documentos guardados antes con otro SKU de barril (sin SKU, o 10000201 / 10000160): al verlos o editarlos se pasan al SKU actual. */
var DCX_BARRIL_ANT = { 'BARRIL 50 L':50, 'PILSEN CALLAO 50LT BARRIL':50, 'BARRIL 30 L':30, 'CUSQUEÑA 30LT DORADA BARRIL':30 };
function _dcLinea(l){ var k=DCX_BARRIL_ANT[l.code]; return !k ? l : Object.assign({},l,k===50?{ sku:3500323, code:'Barril de 50Lt' }:{ sku:3500054, code:'Barril de 30Lt' }); }
var DCX_PRECIO0 ={ caja:3.8, bot630_1000:0.6, bot310:0.5 };
var DCX_TIT = { marcaje:'Conciliación de envases', nc:'Orden para nota de crédito', traslado:'Cargo de despacho' };
var DCX_DESTINOS = ['TADA EVENTOS','ATE','CHORRILLOS','SAN MIGUEL'];
// Destinos escritos antes con "OTRO" (se recuerdan en este equipo)
function _dcDestinosGuardados(){
  try{ return JSON.parse(localStorage.getItem('tada-dc-destinos')||'[]')||[]; }catch(e){ return []; }
}
function _dcOpcionesDestino(){
  var l=DCX_DESTINOS.slice();
  _dcDestinosGuardados().forEach(function(x){ if(l.indexOf(x)<0) l.push(x); });
  if(DCX.tr.destino&&DCX.tr.destino!=='OTRO'&&l.indexOf(DCX.tr.destino)<0) l.unshift(DCX.tr.destino);
  l.push('OTRO');
  return l;
}
function dcDestinoCambio(v){
  DCX.tr.destino=v;
  var o=document.getElementById('dc-dest-otro-f'); if(o){ o.style.display=v==='OTRO'?'':'none'; if(v==='OTRO'){ var i=document.getElementById('dc-dest-otro'); if(i) i.focus(); } }
}

var DCX = {
  d:null, tab:'mar', busy:false,
  h:{ reparto:'', transporte:'', placa:'', fecha:'' },
  hi:'', hf:'', env:true, gr:null,
  nc:{ fac:'', lineas:[] },
  tr:{ destino:'TADA EVENTOS', obs:'', lineas:[] },
  res:{ nc:[], tr:[] }, tm:{},
  hist:[], filtro:'', q:'', edit:null, tot:0, hay:false, nDif:0, primDif:'', nuevoId:null, draftMsg:false
};

/* ── utilidades ── */
function _dcNum(v){
  var s=String(v==null?'':v).trim(); if(!s) return 0;
  if(/^[0-9+\s]+$/.test(s)) return s.split('+').reduce(function(a,x){ return a+(parseInt(x,10)||0); },0);
  return parseInt(s,10)||0;
}
function _dcF(iso){ return iso ? String(iso).slice(8,10)+'/'+String(iso).slice(5,7)+'/'+String(iso).slice(0,4) : ''; }
function _dcMoney(n){ return 'S/ '+Number(n||0).toFixed(2); }
function _dcHms(v){ v=String(v||''); return v.length===5 ? v+':00' : v; }
function _dcSede(){ return String((DCX.d&&DCX.d.sede)||'').toUpperCase(); }
function _dcGrNuevo(){
  return DCX_GR0.map(function(g){ return { g:g.g, tam:g.tam, mult:g.mult, barril:g.barril, rows:g.rows.map(function(r){
    return { sku:r.sku, code:r.code, ref:r.ref, cz:r.cz, caja:r.caja, main:r.main, ei:0, di:0, ck:0 }; }) }; });
}
/* Como en el Excel: se escribe en CAJAS (Entrega y Devolución) y las botellas se pasan a unidades (× botellas por caja).
   Las filas se escriben a mano: la caja con todas las cajas y la botella con las cajas que llevan botellas (la diferencia son cajas sin botellas). */
function _dcEnt(g,r){ return r.caja ? (r.ei||0) : (r.ei||0)*g.mult; }
function _dcDev(g,r){ return r.caja ? (r.di||0) : (r.di||0)*g.mult; }
function _dcPrecio(g,r){
  var p=(DCX.d&&DCX.d.precios)||{};
  var v=r.caja ? p.caja : (g.tam===310 ? p.bot310 : p.bot630_1000);
  if(v==null||isNaN(v)) v=r.caja ? DCX_PRECIO0.caja : (g.tam===310 ? DCX_PRECIO0.bot310 : DCX_PRECIO0.bot630_1000);
  return v;
}

/* ── carga ── */
function loadDocumentos(){
  if(!S||!S.token){ errBox('documentos-root','Sin sesión activa. Recarga la página.','documentos'); PAGE_LOADING['documentos']=false; return; }
  var t=(REQ_TOKEN.documentos=(REQ_TOKEN.documentos||0)+1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t!==REQ_TOKEN.documentos) return;
      PAGE_LOADING['documentos']=false;
      if(_handleExpired(r,'documentos-root')) return;
      if(!r||!r.ok){ errBox('documentos-root',r&&r.error?r.error:'Error al cargar los documentos','documentos'); return; }
      DCX.d=r; DCX.hist=r.docs||[];
      if(!DCX.h.fecha) DCX.h.fecha=r.hoy;
      if(!DCX.gr){ DCX.gr=_dcGrNuevo(); DCX.draftMsg=_dcRestaura(); }
      renderDocumentos();
    })
    .withFailureHandler(function(e){
      if(t!==REQ_TOKEN.documentos) return;
      PAGE_LOADING['documentos']=false; errBox('documentos-root',e.message,'documentos');
    })
    .getDocumentos(S.token);
}

/* ── pantalla ── */
var DCX_TABS = [['mar','Marcaje'],['nc','Orden de NC'],['tr','Traslado'],['his','Historial']];
var DCX_ICO_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
var DCX_ICO_BUSCAR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

function renderDocumentos(foco){
  var root=document.getElementById('documentos-root'); if(!root||!DCX.d) return;
  // Mismo patrón que Salidas, Entradas y Conteo: tres tarjetas de resumen + panel violeta con tabla hundida
  root.innerHTML=
    '<div class="sal2-sum">'+
      '<div class="sal2-card sal2-ped"><div class="sal2-pl"><div class="sal2-k">Guardados</div><div class="sal2-v" id="dc-s-tot">0</div></div>'+
        '<div class="sal2-pr"><div class="dx-tipos" id="dc-s-tipos"></div></div></div>'+
      '<div class="sal2-card"><div class="sal2-k" id="dc-s-k"></div><div class="sal2-v dx-v" id="dc-s-v">0</div><div class="sal2-n" id="dc-s-n"></div></div>'+
      '<div class="sal2-card"><div class="sal2-k">Último documento</div><div class="sal2-v dx-ult" id="dc-s-ult">-</div><div class="sal2-n" id="dc-s-ultn"></div></div>'+
    '</div>'+
    '<div class="sal2-pnl">'+
      '<div class="sal2-fl"><div class="sal2-seg" id="dc-seg" role="group" aria-label="Tipo de documento"><span class="dx-pill" id="dc-pill" aria-hidden="true"></span>'+DCX_TABS.map(function(t){
        return '<button data-t="'+t[0]+'" class="'+(DCX.tab===t[0]?'on':'')+'" aria-pressed="'+(DCX.tab===t[0])+'" onclick="dcTab(\''+t[0]+'\')">'+t[1]+(t[0]==='his'?' <span>'+DCX.hist.length+'</span>':'')+'</button>';
      }).join('')+'</div></div>'+
      '<div id="dc-avisos">'+_dcAvisos()+'</div>'+
      '<div class="dx-body"><div class="dx-pane" id="dc-body"></div></div>'+
    '</div>';
  dcPill(false);
  requestAnimationFrame(function(){ dcPill(false); });   // otra vez cuando ya cargó la tipografía
  _dcCuerpo(foco);
}
/* El fondo blanco de la pestaña activa se desliza hasta la nueva (solo transform: no toca el layout) */
function dcPill(anim){
  var seg=document.getElementById('dc-seg'), p=document.getElementById('dc-pill'), b=seg&&seg.querySelector('button.on'); if(!p||!b) return;
  p.style.transition=anim?'':'none';
  p.style.height=b.offsetHeight+'px'; p.style.width='100px';
  p.style.transform='translate('+b.offsetLeft+'px,'+b.offsetTop+'px) scale('+(b.offsetWidth/100)+',1)';
  if(!anim){ void p.offsetWidth; p.style.transition=''; }
}
window.addEventListener('resize',function(){ dcPill(false); });
function dcTab(t){
  if(DCX.edit && DCX.edit.tab!==t) dcCancelarEdicion(true);
  if(DCX.tab===t) return;
  DCX.tab=t;
  var seg=document.getElementById('dc-seg'), body=document.getElementById('dc-body');
  if(!seg||!body){ renderDocumentos(); return; }
  [].forEach.call(seg.querySelectorAll('button'),function(b){ var on=b.dataset.t===t; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on); });
  dcPill(true);
  var av=document.getElementById('dc-avisos'); if(av) av.innerHTML=_dcAvisos();
  body.classList.remove('dx-pane'); void body.offsetWidth; body.classList.add('dx-pane');
  _dcCuerpo();
}
function _dcAvisos(){
  var h='';
  if(DCX.draftMsg && DCX.tab!=='his' && !DCX.edit) h+='<div class="dx-edit dr on"><span>Borrador recuperado de tu último avance en este equipo.</span><button class="btn btn-ghost btn-sm" onclick="dcDescartarBorrador()">Descartar</button></div>';
  return h+_dcBannerEdit();
}
function _dcFino(){ return !(window.matchMedia && matchMedia('(pointer:coarse)').matches); }

/* campo de la cabecera: etiqueta, entrada y, si es obligatorio, su mensaje de error debajo */
function _dcInp(l,id,v,on,o){
  o=o||{};
  return '<div class="dx-f'+(o.cls?' '+o.cls:'')+'"'+(o.fid?' id="'+o.fid+'"':'')+(o.hide?' style="display:none"':'')+'><label for="'+id+'">'+l+'</label>'+
    '<input class="inp" id="'+id+'" type="'+(o.t||'text')+'" value="'+esc(v)+'"'+(o.ph?' placeholder="'+o.ph+'"':'')+(o.up?' style="text-transform:uppercase"':'')+(o.max?' maxlength="'+o.max+'"':'')+
      (o.dis?' disabled':' oninput="'+on+';dcLimpiaErr(this);dcBorr()"')+(o.err?' aria-describedby="'+id+'-er"':'')+'>'+
    (o.err?'<small class="dx-er" id="'+id+'-er" role="alert">'+o.err+'</small>':'')+'</div>';
}
function dcLimpiaErr(el){ var f=el.closest('.dx-f'); if(f) f.classList.remove('bad'); el.removeAttribute('aria-invalid'); }
function dcMal(id){
  var i=document.getElementById(id); if(!i) return;
  var f=i.closest('.dx-f'); if(f) f.classList.add('bad');
  i.setAttribute('aria-invalid','true'); i.focus();
}
/* Enter baja a la celda de abajo de la misma columna: se llena con el teclado, sin ratón */
function dcEnter(e,el){
  if(e.key!=='Enter') return;
  e.preventDefault();
  var all=[].slice.call(document.querySelectorAll('#dc-body input.n[data-k="'+el.dataset.k+'"]')), n=all[all.indexOf(el)+1];
  if(n){ n.focus(); n.select(); }
}

function _dcCuerpo(foco){
  var b=document.getElementById('dc-body'); if(!b) return;
  if(DCX.tab==='mar') b.innerHTML=_dcMarcajeHtml();
  else if(DCX.tab==='nc') b.innerHTML=_dcListaHtml('nc');
  else if(DCX.tab==='tr') b.innerHTML=_dcListaHtml('tr');
  else b.innerHTML=_dcHistHtml();
  if(DCX.tab==='mar') dcCalcM();
  if(DCX.tab==='nc'||DCX.tab==='tr') dcDibujaL(DCX.tab);
  if(DCX.tab==='his') dcHistFiltrar();
  dcResumen();
  // Marcaje: el cursor cae en la primera cantidad vacía (no en el celular: abriría el teclado sin que lo pidan)
  if(DCX.tab==='mar' && foco!==false && _dcFino()){
    var v=[].slice.call(b.querySelectorAll('input.n')).filter(function(i){ return !i.value; })[0];
    if(v) v.focus({preventScroll:true});
  }
}

/* resumen de arriba: guardados por tipo, una cifra que depende de la pestaña y el último documento */
function dcResumen(){
  var $=function(i){ return document.getElementById(i); }; if(!$('dc-s-tot')) return;
  var H=DCX.hist||[], c={ marcaje:0, nc:0, traslado:0 };
  H.forEach(function(d){ if(c[d.tipo]!=null) c[d.tipo]++; });
  $('dc-s-tot').textContent=H.length;
  $('dc-s-tipos').innerHTML=[['marcaje','Marcajes'],['nc','NC'],['traslado','Traslados']].map(function(k){ return '<div><b>'+c[k[0]]+'</b><small>'+k[1]+'</small></div>'; }).join('');
  var k=$('dc-s-k'), v=$('dc-s-v'), n=$('dc-s-n');
  if(DCX.tab==='mar'){
    var t=DCX.tot||0, hay=!!DCX.hay;
    k.textContent='Diferencia valorizada'; v.textContent=_dcMoney(t); v.className='sal2-v dx-v'+(!hay?'':t===0?' zero':' neg');
    if(!hay) n.textContent='Escribe las cantidades para calcularla';
    else if(!DCX.nDif) n.textContent='Entrega y devolución cuadran';
    else n.innerHTML='<button class="dx-lk" onclick="dcIrDif()">'+DCX.nDif+(DCX.nDif===1?' envase con diferencia':' envases con diferencia')+' · Ver</button>';
  } else if(DCX.tab==='his'){
    var hoy=H.filter(function(d){ return d.fecha===DCX.d.hoy; }).length;
    k.textContent='Documentos de hoy'; v.textContent=hoy; v.className='sal2-v dx-v'; n.textContent=hoy===1?'guardado con la fecha de hoy':'guardados con la fecha de hoy';
  } else {
    var L=DCX.tab==='nc'?DCX.nc.lineas:DCX.tr.lineas;
    var u=L.reduce(function(a,x){ return a+(DCX.tab==='nc'?(x.und||0):_dcTotUnd(x)); },0);
    k.textContent=DCX.tab==='nc'?'Unidades a reclamar':'Unidades a trasladar'; v.textContent=u.toLocaleString('es-PE'); v.className='sal2-v dx-v';
    n.textContent=L.length+(L.length===1?' producto':' productos');
  }
  var ul=H[0];
  $('dc-s-ult').textContent=ul?(DCX_NOM[ul.tipo]||'Documento')+' N.º '+ul.id:'-';
  $('dc-s-ultn').textContent=ul?_dcF(ul.fecha)+(ul.usuario?' · '+ul.usuario:''):'';
}
/* atajo del resumen: lleva a la primera fila con diferencia y pone el cursor en su Entrega */
function dcIrDif(){
  var tr=document.getElementById('dm-r'+DCX.primDif); if(!tr) return;
  tr.scrollIntoView({block:'center'});
  var i=tr.querySelector('input'); if(i){ i.focus({preventScroll:true}); i.select(); }
}
var DCX_NOM = { marcaje:'Marcaje', nc:'NC', traslado:'Traslado' };

/* ── Marcaje ── */
function _dcMarcajeHtml(){
  var h='', ia=function(gi,ri,r,k,v,lb){
    return '<td class="c"><input class="inp n" inputmode="numeric" placeholder="0" value="'+(v||'')+'" data-g="'+gi+'" data-r="'+ri+'" data-k="'+k+'" aria-label="'+lb+' de '+esc(r.ref)+'" oninput="dcMIn(this)" onfocus="this.select()" onkeydown="dcEnter(event,this)"></td>';
  };
  DCX.gr.forEach(function(g,gi){
    h+='<tr class="dx-grp"><td colspan="7">'+esc(g.g)+'</td></tr>';
    g.rows.forEach(function(r,ri){
      var id=gi+'_'+ri;
      h+='<tr id="dm-r'+id+'"><td class="dx-n"><b>'+esc(r.ref)+(r.caja?'<span class="dx-x">× '+g.mult+'</span>':'')+'</b><small>'+(r.sku?r.sku+' · ':'')+esc(r.code)+(r.caja||g.barril?'':' · en cajas')+'</small><small class="dx-mv" id="dm-m'+id+'"></small></td>'+
        ia(gi,ri,r,'ei',r.ei,'Entrega')+ia(gi,ri,r,'di',r.di,'Devolución')+
        '<td class="c col-hide-mobile dx-m" id="dm-e'+id+'">-</td><td class="c col-hide-mobile dx-m" id="dm-v'+id+'">-</td>'+
        '<td class="dx-d" id="dm-d'+id+'">0</td><td class="r col-hide-mobile dx-m" id="dm-c'+id+'">-</td></tr>';
    });
  });
  return '<div class="dx-cab">'+
      _dcInp('Reparto','dc-f-rep',DCX.h.reparto,'DCX.h.reparto=this.value')+
      _dcInp('Transporte','dc-f-tra',DCX.h.transporte,'DCX.h.transporte=this.value')+
      _dcInp('Placa','dc-f-placa',DCX.h.placa,'DCX.h.placa=this.value.toUpperCase()',{up:1})+
      _dcInp('Fecha','dc-f-fecha',DCX.h.fecha,'DCX.h.fecha=this.value',{t:'date'})+
    '</div>'+
    '<div class="dx-cab c3" style="margin-bottom:6px">'+
      _dcInp('Hora inicio','dc-f-hi',DCX.hi,'DCX.hi=this.value',{t:'time'})+
      _dcInp('Hora fin','dc-f-hf',DCX.hf,'DCX.hf=this.value',{t:'time'})+
    '</div>'+
    '<div class="table-wrap"><table><thead><tr><th>Envase</th><th class="c">Entrega</th><th class="c">Devolución</th><th class="c col-hide-mobile">ENT</th><th class="c col-hide-mobile">DEV</th><th class="c">Dif.</th><th class="r col-hide-mobile">Costo</th></tr></thead><tbody>'+h+'</tbody></table></div>'+
    '<div id="dc-cv-w"><div class="dx-sub" style="margin-top:20px">Convertidor · cajas llenas</div><div class="dx-cv" id="dm-conv"></div></div>'+
    _dcBarra('marcaje');
}
function dcMIn(el){
  DCX.gr[el.dataset.g].rows[el.dataset.r][el.dataset.k]=_dcNum(el.value);
  dcCalcM(); dcBorr();
}
/* Diferencia: cualquier diferencia va en rojo; si entrega y devolución cuadran y hay datos, en verde; sin datos, en gris */
function dcCalcM(){
  var tot=0, hay=false, nDif=0, prim='', num=function(n){ return n?n.toLocaleString('es-PE'):'-'; };
  DCX.gr.forEach(function(g,gi){ g.rows.forEach(function(r,ri){
    var e=_dcEnt(g,r), v=_dcDev(g,r), d=e-v, c=g.barril?0:Math.abs(d)*_dcPrecio(g,r); tot+=c;
    if(r.ei||r.di) hay=true;
    var id=gi+'_'+ri, ee=document.getElementById('dm-e'+id), ve=document.getElementById('dm-v'+id), de=document.getElementById('dm-d'+id), ce=document.getElementById('dm-c'+id);
    if(!de||!ce) return;
    if(ee) ee.textContent=num(e); if(ve) ve.textContent=num(v);
    de.textContent=d>0?'+'+d:d; de.className='dx-d'+(d!==0?' neg':(r.ei||r.di)?' zero':'');
    ce.textContent=(d===0||g.barril)?'-':_dcMoney(c);
    if(d!==0){ nDif++; if(!prim) prim=id; }
    var tr=document.getElementById('dm-r'+id), mv=document.getElementById('dm-m'+id);
    if(tr) tr.classList.toggle('dx-fl',!!(r.ei||r.di));           // fila con cantidades: barra violeta a la izquierda
    if(mv) mv.textContent=(e||v)?'ENT '+num(e)+' · DEV '+num(v)+(d===0||g.barril?'':' · '+_dcMoney(c)):'';   // en el celular las columnas ENT, DEV y Costo se ocultan
  }); });
  DCX.tot=tot; DCX.hay=hay; DCX.nDif=nDif; DCX.primDif=prim;
  var te=document.getElementById('dc-bar-tot');
  if(te){ te.textContent=_dcMoney(tot); te.className='dx-v'+(!hay?'':tot===0?' zero':' neg'); }
  var h='';
  DCX.gr.forEach(function(g){
    if(g.barril) return;
    var be=0,bd=0,ce=0,cd=0;
    g.rows.forEach(function(r){ if(r.caja){ ce=r.ei||0; cd=r.di||0; } else { be+=r.ei||0; bd+=r.di||0; } });
    if(!be&&!bd&&!ce&&!cd) return;
    var est=function(b,c){ return b===c?'<span class="ok">'+b+' cajas ✓</span>':'<span class="'+(c>b?'warn':'bad')+'">botellas en '+b+' · cajas '+c+(c>b?' (+'+(c-b)+' sin botellas)':' (faltan '+(b-c)+')')+'</span>'; };
    h+='<div class="dx-cvi"><b>'+g.g.split(' · ')[0]+'</b>Entrega: '+est(be,ce)+'<br>Devolución: '+est(bd,cd)+'</div>';
  });
  var cv=document.getElementById('dm-conv'), cw=document.getElementById('dc-cv-w');
  if(cv) cv.innerHTML=h;
  if(cw) cw.style.display=h?'':'none';   // el convertidor solo aparece cuando hay cantidades
  dcResumen();
}
/* Movimientos de Envases: packs = cajas con botellas, unidades = botellas sueltas (cascos), cajas = cajas sin botellas.
   ENT = entrada llena, DEV = devolución vacía. */
function _dcMovs(){
  var out=[];
  DCX.gr.forEach(function(g){
    if(g.barril) return;
    ['ent','dev'].forEach(function(k){
      var packs=0, und=0, caja=0;
      g.rows.forEach(function(r){
        if(r.caja) caja=k==='ent'?(r.ei||0):(r.di||0);
        else packs+=k==='ent'?(r.ei||0):(r.di||0);
      });
      var solas=Math.max(0,caja-packs);
      if(packs||und||solas) out.push({ tipo:k==='ent'?'entrada':'devolucion', tamano:g.tam, estado:k==='ent'?'llena':'vacia', packs:packs, unidades:und, cajas:solas });
    });
  });
  return out;
}

/* ── NC y Traslado: buscador de productos + cantidades ── */
function _dcListaHtml(w){
  var nc=w==='nc', cab;
  if(nc){
    cab='<div class="dx-cab">'+
      _dcInp('Reparto','dc-f-rep',DCX.h.reparto,'DCX.h.reparto=this.value')+
      _dcInp('Transporte','dc-f-tra',DCX.h.transporte,'DCX.h.transporte=this.value')+
      _dcInp('Placa','dc-f-placa',DCX.h.placa,'DCX.h.placa=this.value.toUpperCase()',{up:1})+
      _dcInp('Fecha','dc-f-fecha',DCX.h.fecha,'DCX.h.fecha=this.value',{t:'date'})+
      _dcInp('Nro. de factura *','dc-f-fac',DCX.nc.fac,'DCX.nc.fac=this.value',{cls:'w2',ph:'Ej: F001-000123',err:'Escribe el nro. de factura'})+
    '</div>';
  } else {
    cab='<div class="dx-cab">'+
      _dcInp('Origen','dc-f-origen',_dcSede(),'',{dis:1})+
      '<div class="dx-f"><label for="dc-f-dest">Destino</label><select id="dc-f-dest" onchange="dcDestinoCambio(this.value);dcBorr()">'+_dcOpcionesDestino().map(function(d){ return '<option'+(d===DCX.tr.destino?' selected':'')+'>'+esc(d)+'</option>'; }).join('')+'</select></div>'+
      _dcInp('Placa *','dc-f-placa',DCX.h.placa,'DCX.h.placa=this.value.toUpperCase()',{up:1,ph:'Ej: BMN-760',err:'Escribe la placa del vehículo'})+
      _dcInp('Fecha','dc-f-fecha',DCX.h.fecha,'DCX.h.fecha=this.value',{t:'date'})+
      _dcInp('Escribe el destino *','dc-dest-otro',DCX.tr.otro||'','DCX.tr.otro=this.value.toUpperCase()',{fid:'dc-dest-otro-f',hide:DCX.tr.destino!=='OTRO',up:1,ph:'Ej: TIENDA LINCE',max:60,err:'Escribe el destino'})+
      _dcInp('Observaciones','dc-f-obs',DCX.tr.obs,'DCX.tr.obs=this.value',{cls:'full',ph:'Opcional'})+
    '</div>';
  }
  return cab+'<div class="dx-sub">'+(nc?'Productos que no dejaron':'Productos')+'</div>'+
    '<div class="dx-sr"><input class="inp" id="dc-q-'+w+'" placeholder="Buscar producto: pilsen, guaraná, 10000092…" aria-label="Buscar producto" autocomplete="off" oninput="dcBuscar(\''+w+'\')" onblur="setTimeout(function(){dcCerrarAc(\''+w+'\')},180)"><div class="dx-ac" id="dc-ac-'+w+'"></div></div>'+
    '<div class="table-wrap"><table><thead><tr><th>Producto</th><th class="c">'+(nc?'Und':'Cantidad')+'</th>'+(nc?'':'<th class="c">Und sueltas</th>')+'<th class="r" style="width:56px"></th></tr></thead><tbody id="dc-ln-'+w+'"></tbody></table></div>'+
    _dcBarra(nc?'nc':'traslado');
}
function _dcL(w){ return w==='nc'?DCX.nc.lineas:DCX.tr.lineas; }
function dcBuscar(w){
  clearTimeout(DCX.tm[w]);
  var q=(document.getElementById('dc-q-'+w)||{}).value||'';
  if(q.trim().length<2){ dcCerrarAc(w); return; }
  DCX.tm[w]=setTimeout(function(){
    google.script.run
      .withSuccessHandler(function(r){
        var inp=document.getElementById('dc-q-'+w); if(!inp||inp.value!==q) return;
        var ac=document.getElementById('dc-ac-'+w); if(!ac) return;
        DCX.res[w]=(r&&r.ok)?r.results:[];
        ac.innerHTML=DCX.res[w].length
          ? DCX.res[w].map(function(c,i){ return '<div class="dx-ai" onmousedown="dcAgregar(\''+w+'\','+i+')"><b>'+esc(c.desc)+'</b><small>SKU '+esc(c.sku)+(c.sap?' · SAP '+esc(c.sap):' · sin SAP')+'</small></div>'; }).join('')
          : '<div class="dx-ai" style="cursor:default;color:var(--text3)">Sin resultados</div>';
        ac.classList.add('on');
      })
      .withFailureHandler(function(){ dcCerrarAc(w); })
      .buscarProductoDoc(S.token,q);
  },260);
}
function dcCerrarAc(w){ var ac=document.getElementById('dc-ac-'+w); if(ac) ac.classList.remove('on'); }
function dcAgregar(w,i){
  var c=(DCX.res[w]||[])[i]; if(!c) return;
  var L=_dcL(w), idx=-1;
  L.forEach(function(x,k){ if(x.sku===c.sku) idx=k; });
  var nuevo=idx<0;
  if(nuevo){ L.push({ sku:c.sku, sap:c.sap, desc:c.desc, und:0, fac:c.fac||1, su:0, med:(c.fac||1)>1?'pack':'und' }); idx=L.length-1; }
  var q=document.getElementById('dc-q-'+w); if(q) q.value='';
  dcCerrarAc(w); dcDibujaL(w,nuevo?idx:-1); dcBorr();
  var el=document.querySelector('#dc-ln-'+w+' tr[data-i="'+idx+'"] input');
  if(el){ el.focus(); el.select(); }
}
function dcDibujaL(w,nuevo){
  var L=_dcL(w), el=document.getElementById('dc-ln-'+w); if(!el) return;
  var tr=w==='tr';
  el.innerHTML=L.length ? L.map(function(x,i){
    var conPack=tr&&(x.fac||1)>1, d=esc(x.desc);
    return '<tr class="dx-ln'+(i===nuevo?' nw':'')+'" data-i="'+i+'"><td class="dx-n"><b>'+d+'</b><small>SKU '+esc(x.sku)+(x.sap?' · SAP '+esc(x.sap):' · sin SAP')+'</small>'+
        (conPack?'<div class="dx-eq" id="dc-eq-'+i+'">'+_dcEq(x)+'</div>':'')+'</td>'+
      '<td class="c"><input class="inp n" inputmode="numeric" data-k="und" value="'+(x.und||'')+'" placeholder="'+(tr?(conPack?'Packs':'Und'):'0')+'" aria-label="'+(conPack?'Packs':'Unidades')+' de '+d+'" oninput="dcUnd(\''+w+'\','+i+',this.value)" onfocus="this.select()" onkeydown="dcEnter(event,this)"></td>'+
      (tr?(conPack?'<td class="c"><input class="inp n" inputmode="numeric" data-k="su" value="'+(x.su||'')+'" placeholder="0" aria-label="Unidades sueltas de '+d+'" oninput="dcSu('+i+',this.value)" onfocus="this.select()" onkeydown="dcEnter(event,this)"></td>':'<td class="c dx-m">-</td>'):'')+
      '<td class="r"><button class="dx-rm" aria-label="Quitar '+d+'" onclick="dcQuitar(\''+w+'\','+i+')">'+DCX_ICO_X+'</button></td></tr>';
  }).join('') : '<tr><td colspan="'+(tr?4:3)+'" class="dx-vacio">Aún no hay productos.<br>Búscalos arriba para agregarlos.</td></tr>';
  dcResumen();
}
// Total en unidades de una línea de traslado con pack: packs × unidades por pack + sueltas
function _dcTotUnd(x){ return (x.med==='pack'?(x.und||0)*(x.fac||1):(x.und||0))+(x.su||0); }
function _dcEq(x){ return 'Pack de '+x.fac+(_dcTotUnd(x)>0?' · total '+fmt(_dcTotUnd(x))+' und':''); }
// Cantidad como se imprime en el cargo: "2 packs + 3 und (15 und)"; los documentos antiguos solo traen el número
function _dcCantTxt(x){
  if(!x.und&&!x.su) return '';
  if(x.med==='und') return x.und+' und';
  if(x.med==='pack'){
    var p=x.und?x.und+(x.und===1?' pack':' packs'):'', s=x.su?x.su+' und':'';
    return (p&&s?p+' + '+s:p||s)+(p&&(x.fac||1)>1?' ('+_dcTotUnd(x)+' und)':'');
  }
  return String(x.und);
}
function dcSu(i,v){ var x=DCX.tr.lineas[i]; if(!x) return; x.su=_dcNum(v); var eq=document.getElementById('dc-eq-'+i); if(eq) eq.textContent=_dcEq(x); dcResumen(); dcBorr(); }
function dcUnd(w,i,v){ var x=_dcL(w)[i]; if(!x) return; x.und=_dcNum(v); var eq=document.getElementById('dc-eq-'+i); if(eq&&w==='tr') eq.textContent=_dcEq(x); dcResumen(); dcBorr(); }
function dcQuitar(w,i){ _dcL(w).splice(i,1); dcDibujaL(w); dcBorr(); }

/* ── borrador: lo escrito se guarda en este equipo y se recupera al volver (3 días, misma sede) ── */
var DCX_BORR_K='tada-dc-borrador', _dcBorrT=null;
function dcBorr(){
  if(DCX.edit||!DCX.d) return;   // al editar un documento guardado no se toca el borrador
  clearTimeout(_dcBorrT); _dcBorrT=setTimeout(_dcGuardaBorr,300);
}
function _dcHayMar(){ return DCX.gr&&(DCX.hi||DCX.hf||DCX.gr.some(function(g){ return g.rows.some(function(r){ return r.ei||r.di; }); })); }
function _dcHayNc(){ return DCX.nc.lineas.length>0||!!String(DCX.nc.fac||'').trim(); }
function _dcHayTr(){ return DCX.tr.lineas.length>0||!!String(DCX.tr.obs||'').trim()||!!String(DCX.tr.otro||'').trim(); }
function _dcGuardaBorr(){
  try{
    var o={ t:Date.now(), sede:_dcSede(), h:{ reparto:DCX.h.reparto, transporte:DCX.h.transporte, placa:DCX.h.placa } };
    if(_dcHayMar()) o.mar={ g:DCX.gr.map(function(g){ return g.rows.map(function(r){ return [r.ei||0,r.di||0]; }); }), hi:DCX.hi, hf:DCX.hf, env:DCX.env };
    if(_dcHayNc()) o.nc={ fac:DCX.nc.fac, lineas:DCX.nc.lineas };
    if(_dcHayTr()) o.tr={ destino:DCX.tr.destino, otro:DCX.tr.otro||'', obs:DCX.tr.obs, lineas:DCX.tr.lineas };
    if(!o.mar&&!o.nc&&!o.tr) localStorage.removeItem(DCX_BORR_K); else localStorage.setItem(DCX_BORR_K,JSON.stringify(o));
  }catch(e){}
}
function _dcRestaura(){
  try{
    var o=JSON.parse(localStorage.getItem(DCX_BORR_K)||'null');
    if(!o) return false;
    if(Date.now()-o.t>3*86400000||o.sede!==_dcSede()){ localStorage.removeItem(DCX_BORR_K); return false; }
    var hay=false;
    if(o.mar&&DCX.gr){
      o.mar.g.forEach(function(g,i){ g.forEach(function(p,j){ var r=DCX.gr[i]&&DCX.gr[i].rows[j]; if(r){ r.ei=p[0]||0; r.di=p[1]||0; } }); });
      DCX.hi=o.mar.hi||''; DCX.hf=o.mar.hf||''; DCX.env=o.mar.env!==false; hay=true;
    }
    if(o.nc){ DCX.nc={ fac:o.nc.fac||'', lineas:o.nc.lineas||[] }; hay=true; }
    if(o.tr){ DCX.tr={ destino:o.tr.destino||'TADA EVENTOS', otro:o.tr.otro||'', obs:o.tr.obs||'', lineas:o.tr.lineas||[] }; hay=true; }
    if(hay&&o.h){ DCX.h.reparto=o.h.reparto||''; DCX.h.transporte=o.h.transporte||''; DCX.h.placa=o.h.placa||''; }
    return hay;
  }catch(e){ return false; }
}
function dcDescartarBorrador(){
  try{ localStorage.removeItem(DCX_BORR_K); }catch(e){}
  _dcReset('marcaje'); _dcReset('nc'); _dcReset('traslado');
  DCX.draftMsg=false; renderDocumentos();
}

/* ── guardar ── */
function dcGuardar(tipo,imprimir){
  if(DCX.busy) return;
  var d={ tipo:tipo, fecha:DCX.h.fecha, placa:DCX.h.placa, reparto:'', transporte:'', horaInicio:'', horaFin:'', nroFactura:'', destino:'', observaciones:'', lineas:[], movs:[] };
  if(tipo==='marcaje'){
    var hay=false;
    DCX.gr.forEach(function(g){ g.rows.forEach(function(r){
      if(r.ei||r.di) hay=true;
      d.lineas.push({ sku:r.sku, code:r.code, ref:r.ref, cz:r.cz, ent:_dcEnt(g,r), dev:_dcDev(g,r), ei:r.ei||0, di:r.di||0 });
    }); });
    if(!hay){ showToast('Escribe al menos una cantidad en Entrega o Devolución','err'); var pi=document.querySelector('#dc-body input.n'); if(pi) pi.focus(); return; }
    d.reparto=DCX.h.reparto; d.transporte=DCX.h.transporte; d.horaInicio=DCX.hi; d.horaFin=DCX.hf;
    d.movs=DCX.env?_dcMovs():[];
  } else if(tipo==='nc'){
    if(!String(DCX.nc.fac||'').trim()){ dcMal('dc-f-fac'); return; }
    d.lineas=DCX.nc.lineas.filter(function(x){ return x.und>0; }).map(function(x){ return { sku:x.sku, sap:x.sap, desc:x.desc, und:x.und }; });
    if(!d.lineas.length){ showToast('Agrega al menos un producto con unidades','err'); return; }
    d.reparto=DCX.h.reparto; d.transporte=DCX.h.transporte; d.nroFactura=String(DCX.nc.fac).trim();
  } else {
    if(!String(DCX.h.placa||'').trim()){
      dcMal('dc-f-placa');
      return;
    }
    d.lineas=DCX.tr.lineas.filter(function(x){ return x.und>0||x.su>0; }).map(function(x){ return { sku:x.sku, sap:x.sap, desc:x.desc, und:x.und||0, su:x.su||0, med:x.med||'und', fac:x.fac||1 }; });
    if(!d.lineas.length){ showToast('Agrega al menos un producto con cantidad','err'); return; }
    d.destino=DCX.tr.destino; d.observaciones=DCX.tr.obs;
    if(d.destino==='OTRO'){
      d.destino=String(DCX.tr.otro||'').trim().toUpperCase();
      if(!d.destino){ dcMal('dc-dest-otro'); return; }
    }
  }
  DCX.busy=true; _dcBusy(true,imprimir);
  var editando=DCX.edit&&DCX.edit.tipo===tipo ? DCX.edit : null;
  var llamada=google.script.run
    .withSuccessHandler(function(r){
      DCX.busy=false;
      if(!r||!r.ok){ _dcBusy(false); showToast((r&&r.error)||'No se pudo guardar','err'); return; }
      DCX.nuevoId=editando?editando.id:r.id;
      var doc;
      if(editando){
        doc=DCX.hist.filter(function(x){ return x.id===editando.id; })[0];
        if(doc){
          doc.fecha=d.fecha; doc.reparto=d.reparto; doc.transporte=d.transporte; doc.placa=d.placa; doc.horaInicio=d.horaInicio; doc.horaFin=d.horaFin;
          doc.nroFactura=d.nroFactura; doc.destino=d.destino; doc.observaciones=d.observaciones; doc.lineas=d.lineas;
        }
        if(tipo==='marcaje') DCX.d.conEnv[editando.id]=d.movs.length>0;
        DCX.edit=null;
      } else {
        doc={ id:r.id, tipo:tipo, fecha:d.fecha, reparto:d.reparto, transporte:d.transporte, placa:d.placa, horaInicio:d.horaInicio, horaFin:d.horaFin,
          nroFactura:d.nroFactura, destino:d.destino, observaciones:d.observaciones, lineas:d.lineas, usuario:(S&&S.usuario)||'', creado:new Date().toISOString() };
        DCX.hist.unshift(doc);
        if(tipo==='marcaje'&&d.movs.length) DCX.d.conEnv[r.id]=true;
      }
      showToast(editando ? 'Documento actualizado'
        : tipo==='marcaje'?'Marcaje guardado'+(DCX.env&&d.movs.length?' y registrado en Envases':''):tipo==='nc'?'NC guardada y agregada a M-T como pendiente':'Traslado guardado y descontado del stock (queda en M-T como pendiente)','ok');
      if(tipo==='marcaje') PAGE_LOADED['envases']=false;
      if(tipo==='nc'||tipo==='traslado'){ PAGE_LOADED['mt']=false; PAGE_LOADED['stock']=false; }
      if(tipo==='traslado') _dcRecordarDestino();
      _dcReset(tipo);
      if(editando){ DCX.h={ reparto:'', transporte:'', placa:'', fecha:DCX.d.hoy }; DCX.tab='his'; DCX.draftMsg=_dcRestaura(); }
      else { DCX.draftMsg=false; _dcGuardaBorr(); }   // lo guardado sale del borrador
      renderDocumentos();
      if(imprimir&&doc) dcVer(doc);
    })
    .withFailureHandler(function(e){ DCX.busy=false; _dcBusy(false); showToast(e.message,'err'); });
  if(editando) llamada.actualizarDocumento(S.token,editando.id,d); else llamada.guardarDocumento(S.token,d);
}
/* mientras guarda: los botones se bloquean y el que se pulsó dice «Guardando…» */
function _dcBusy(on,imp){
  [].forEach.call(document.querySelectorAll('.dx-bar .btn'),function(b,i){
    if(on){ b.dataset.t=b.textContent; b.disabled=true; if(i===(imp?1:0)) b.textContent='Guardando…'; }
    else { b.disabled=false; if(b.dataset.t) b.textContent=b.dataset.t; }
  });
}
/* limpia el formulario del tipo (Reparto, Transporte y Placa se conservan al crear: sirven para la NC del mismo reparto) */
function _dcReset(tipo){
  if(tipo==='marcaje'){ DCX.gr=_dcGrNuevo(); DCX.hi=''; DCX.hf=''; DCX.env=true; }
  if(tipo==='nc') DCX.nc={ fac:'', lineas:[] };
  if(tipo==='traslado'){ DCX.tr.otro=''; DCX.tr.lineas=[]; DCX.tr.obs=''; }
}
/* tras guardar un traslado con "OTRO": el destino escrito queda en la lista y como destino elegido */
function _dcRecordarDestino(){
  var nd=DCX.tr.destino==='OTRO'?String(DCX.tr.otro||'').trim().toUpperCase():'';
  if(!nd) return;
  if(DCX_DESTINOS.indexOf(nd)<0&&_dcDestinosGuardados().indexOf(nd)<0){
    try{ var gl=_dcDestinosGuardados(); gl.push(nd); localStorage.setItem('tada-dc-destinos',JSON.stringify(gl.slice(-8))); }catch(e){}
  }
  DCX.tr.destino=nd;
}

/* ── editar un documento del historial ── */
function _dcBannerEdit(){
  var e=DCX.edit; if(!e||e.tab!==DCX.tab) return '';
  return '<div class="dx-edit on"><span>Editando <b>'+esc(DCX_TIT[e.tipo])+'</b> N.º '+e.id+' · '+_dcF(e.fecha)+'. Los cambios reemplazan lo guardado'+
    (e.tipo==='marcaje'?' y lo registrado en Envases':e.tipo==='nc'?' y las filas de M-T':e.tipo==='traslado'?' y las filas de M-T, si las tiene':'')+'.</span>'+
    '<button class="btn btn-ghost btn-sm" onclick="dcCancelarEdicion()">Cancelar edición</button></div>';
}
/* barra fija abajo: en Marcaje lleva la diferencia valorizada y la casilla de Envases */
function _dcBarra(tipo){
  var ed=DCX.edit&&DCX.edit.tipo===tipo, nc=tipo==='nc';
  return '<div class="dx-bar">'+(tipo==='marcaje'
      ? '<div class="tot"><small>Diferencia valorizada</small><b id="dc-bar-tot">S/ 0.00</b></div>'+
        '<label class="dx-sw"><input type="checkbox"'+(DCX.env?' checked':'')+' onchange="DCX.env=this.checked;dcBorr()">Registrar también en Envases</label>'
      : '')+'<span class="sp"></span>'+
    '<button class="btn btn-ghost" onclick="dcGuardar(\''+tipo+'\',false)">'+(ed?'Guardar cambios':nc?'Guardar en M-T como NC pendiente':'Guardar')+'</button>'+
    '<button class="btn btn-primary" onclick="dcGuardar(\''+tipo+'\',true)">'+(ed?'Guardar cambios e imprimir':'Guardar e imprimir')+'</button></div>';
}
function dcEditar(id){
  var d=DCX.hist.filter(function(x){ return x.id===id; })[0]; if(!d) return;
  var tab=d.tipo==='marcaje'?'mar':d.tipo==='nc'?'nc':'tr';
  DCX.edit={ id:d.id, tipo:d.tipo, tab:tab, fecha:d.fecha };
  DCX.h={ reparto:d.reparto, transporte:d.transporte, placa:d.placa, fecha:d.fecha };
  if(d.tipo==='marcaje'){
    DCX.gr=_dcGrNuevo();
    d.lineas.forEach(function(l){ l=_dcLinea(l); DCX.gr.forEach(function(g){ g.rows.forEach(function(r){
      if(r.sku!==l.sku||r.code!==l.code||l.suelta||l.sueltaB) return;
      if(l.ei!==undefined){ r.ei=l.ei||0; r.di=(l.di||0)+(r.caja?(l.ck||0):0); }       // guardado con el formato nuevo (los cascos de cajas pasan a la devolución)
      else if(r.caja){ r.ei=l.ent||0; r.di=l.dev||0; }                                // documentos anteriores: se pasan a cajas
      else { r.ei=Math.floor((l.ent||0)/g.mult); r.di=Math.floor((l.dev||0)/g.mult); }
    }); }); });
    DCX.hi=d.horaInicio; DCX.hf=d.horaFin; DCX.env=!!(DCX.d.conEnv&&DCX.d.conEnv[d.id]);
  } else if(d.tipo==='nc'){
    DCX.nc={ fac:d.nroFactura, lineas:d.lineas.map(function(l){ return { sku:l.sku, sap:l.sap, desc:l.desc, und:l.und }; }) };
  } else {
    DCX.tr={ destino:d.destino||'TADA EVENTOS', obs:d.observaciones, lineas:d.lineas.map(function(l){
      var f=l.fac||1;
      // lineas guardadas con la medida 'und' de un producto con pack: pasan a unidades sueltas
      if(l.med==='und'&&f>1) return { sku:l.sku, sap:l.sap, desc:l.desc, und:0, su:l.und, med:'pack', fac:f };
      return { sku:l.sku, sap:l.sap, desc:l.desc, und:l.und, su:l.su||0, med:l.med||'und', fac:f };
    }) };
  }
  DCX.tab=tab; renderDocumentos();
  var c=document.getElementById('documentos-root'); if(c&&c.scrollIntoView) c.scrollIntoView({block:'start'});
}
function dcCancelarEdicion(silencioso){
  var e=DCX.edit; if(!e) return;
  DCX.edit=null; _dcReset(e.tipo==='traslado'?'traslado':e.tipo);
  DCX.h={ reparto:'', transporte:'', placa:'', fecha:DCX.d.hoy };
  DCX.draftMsg=_dcRestaura();   // vuelve lo que estaba escrito antes de editar
  if(!silencioso){ DCX.tab='his'; renderDocumentos(); }
}
function dcEliminar(id){
  var d=DCX.hist.filter(function(x){ return x.id===id; })[0]; if(!d) return;
  var efecto=d.tipo==='marcaje'?' También se quitan los movimientos que registró en Envases.'
    :d.tipo==='nc'?' También se quitan sus filas pendientes de M-T (las ya retiradas se conservan).'
    :d.tipo==='traslado'?' Si descontó stock, se devuelve: se quitan sus filas pendientes de M-T (las ya retiradas se conservan).':'';
  _confirmDialog('Eliminar documento','Se eliminará el '+DCX_TIT[d.tipo].toLowerCase()+' del '+_dcF(d.fecha)+(d.reparto?' (reparto '+d.reparto+')':d.nroFactura?' (factura '+d.nroFactura+')':'')+'.'+efecto,
    function(){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo eliminar','err'); return; }
          DCX.hist=DCX.hist.filter(function(x){ return x.id!==id; });
          if(DCX.edit&&DCX.edit.id===id) DCX.edit=null;
          if(d.tipo==='marcaje') PAGE_LOADED['envases']=false;
          if(d.tipo==='nc'||d.tipo==='traslado'){ PAGE_LOADED['mt']=false; PAGE_LOADED['stock']=false; }
          showToast('Documento eliminado'+(r.conservadas?' · '+r.conservadas+' fila(s) de M-T ya retiradas se conservaron':''),'ok');
          renderDocumentos();
        })
        .withFailureHandler(function(e){ showToast(e.message,'err'); })
        .eliminarDocumento(S.token,id);
    },'Eliminar');
}

/* ── historial ── */
function _dcHistHtml(){
  var chips=[['','Todos'],['marcaje','Marcaje'],['nc','NC'],['traslado','Traslado']];
  return '<div class="sal2-fl dx-hf"><div class="sal2-seg" role="group" aria-label="Filtrar por tipo">'+chips.map(function(c){ return '<button class="'+(DCX.filtro===c[0]?'on':'')+'" aria-pressed="'+(DCX.filtro===c[0])+'" onclick="dcHistTipo(\''+c[0]+'\')">'+c[1]+'</button>'; }).join('')+'</div>'+
    '<div class="sal2-srch">'+DCX_ICO_BUSCAR+'<input id="dc-hq" value="'+esc(DCX.q)+'" placeholder="Buscar reparto, factura, destino o producto…" aria-label="Buscar documentos" autocomplete="off" oninput="DCX.q=this.value;dcHistFiltrar()"></div>'+
    '<span class="sal2-cnt" id="dc-hcount"></span></div>'+
    '<div class="table-wrap"><table><thead><tr><th>Documento</th><th class="col-hide-mobile">Fecha</th><th class="col-hide-mobile">Estado</th><th class="r" style="width:240px"></th></tr></thead><tbody id="dc-hlist"></tbody></table></div>';
}
function dcHistTipo(t){ DCX.filtro=t; _dcCuerpo(false); }
function dcHistFiltrar(){
  var q=String(DCX.q||'').toLowerCase().trim(), el=document.getElementById('dc-hlist'); if(!el) return;
  var rows=DCX.hist.filter(function(d){
    if(DCX.filtro&&d.tipo!==DCX.filtro) return false;
    if(!q) return true;
    var txt=[d.reparto,d.nroFactura,d.destino,d.placa,d.transporte].concat((d.lineas||[]).map(function(l){ return (l.desc||'')+' '+(l.sku||'')+' '+(l.code||''); })).join(' ').toLowerCase();
    return txt.indexOf(q)>-1;
  });
  if(DCX.nuevoId&&rows.some(function(d){ return d.id===DCX.nuevoId; })){ var nid=DCX.nuevoId; setTimeout(function(){ if(DCX.nuevoId===nid) DCX.nuevoId=null; },3500); }   // la fila nueva se resalta solo unos segundos
  var ct=document.getElementById('dc-hcount'); if(ct) ct.textContent=rows.length+(rows.length===1?' documento':' documentos');
  var bd={ marcaje:'m', nc:'n', traslado:'t' };
  el.innerHTML=rows.length ? rows.map(function(d){
    var n=(d.lineas||[]).length, pr=n+(n===1?' producto':' productos');
    var det=d.tipo==='marcaje' ? ('Reparto '+(d.reparto||'-')+(d.placa?' · '+d.placa:''))
          : d.tipo==='nc' ? ('Factura '+(d.nroFactura||'-')+' · '+pr)
          : ('Destino '+(d.destino||'-')+' · '+pr);
    var est=d.tipo==='marcaje' ? (DCX.d.conEnv&&DCX.d.conEnv[d.id]?'En Envases':'Solo el documento') : 'En M-T';
    return '<tr class="dx-h'+(d.id===DCX.nuevoId?' nw':'')+'" data-id="'+d.id+'" tabindex="0" role="button" aria-label="Ver '+esc(DCX_NOM[d.tipo])+' N.º '+d.id+'" onclick="dcVerId('+d.id+')">'+
      '<td><span class="dx-bd '+bd[d.tipo]+'">'+esc(DCX_NOM[d.tipo])+'</span><div class="dx-n" style="margin-top:6px"><b>'+esc(det)+'</b><small>N.º '+d.id+'<span class="dx-mf"> · '+_dcF(d.fecha)+'</span>'+(d.usuario?' · '+esc(d.usuario):'')+'</small></div></td>'+
      '<td class="col-hide-mobile dx-m">'+_dcF(d.fecha)+'</td><td class="col-hide-mobile dx-es">'+est+'</td>'+
      '<td class="r"><div class="dx-a"><button class="dx-b" onclick="event.stopPropagation();dcVerId('+d.id+')">Ver / Imprimir</button>'+
        '<button class="dx-b" onclick="event.stopPropagation();dcEditar('+d.id+')">Editar</button>'+
        '<button class="dx-b del" aria-label="Eliminar el documento N.º '+d.id+'" onclick="event.stopPropagation();dcEliminar('+d.id+')">✕</button></div></td></tr>';
  }).join('') : '<tr><td colspan="4" class="dx-vacio">Sin documentos guardados'+(DCX.filtro||q?' con ese filtro':'')+'.</td></tr>';
}
// Teclado en el historial: Enter o Espacio abren el documento; Escape cierra la vista de impresión
document.addEventListener('keydown',function(e){
  var t=e.target;
  if((e.key==='Enter'||e.key===' ')&&t&&t.classList&&t.classList.contains('dx-h')){ e.preventDefault(); t.click(); return; }
  if(e.key==='Escape'){ var pv=document.getElementById('dc-pv'); if(pv&&pv.classList.contains('on')) dcCerrarPv(); }
});
function dcVerId(id){ var d=DCX.hist.filter(function(x){ return x.id===id; })[0]; if(d) dcVer(d); }

/* ── papel e impresión ── */
function _dcFirmas(a,b){ return '<div class="dp-sig"><div><b>'+a+'</b>NOMBRE:<br>DNI:</div><div><b>'+b+'</b>NOMBRE:<br>DNI:</div></div>'; }
function _dcCab(d){
  return '<div class="dp-hd"><div><span>Reparto.</span><b>'+esc(d.reparto)+'</b></div><div><span>Fecha</span><b>'+_dcF(d.fecha)+'</b></div>'+
    '<div><span>Transporte</span><b>'+esc(d.transporte)+'</b></div><div><span>Placa</span><b>'+esc(d.placa)+'</b></div>'+
    (d.tipo==='nc'?'<div><span>Factura</span><b>'+esc(d.nroFactura)+'</b></div>':'')+'</div>';
}
function _dcPapel(d){
  var sede=_dcSede(), t, i, x;
  if(d.tipo==='marcaje'){
    var mh=function(l1,v1,l2,v2){ return '<div class="dpm-h"><div class="l"><span>'+l1+'</span><b>'+esc(v1)+'</b></div><div class="rr"><span>'+l2+'</span><b>'+esc(v2)+'</b></div></div>'; };
    t='<h2>CONCILIACIÓN DE ENVASES - '+esc(sede)+'</h2>'+
      mh('Reparto:',d.reparto,'Fecha:',_dcF(d.fecha))+mh('Transporte:',d.transporte,'Placa:',d.placa)+mh('Hora Inicio:',_dcHms(d.horaInicio),'Hora Fin:',_dcHms(d.horaFin))+
      '<table><tr><th>Sku</th><th>Descripcion</th><th>ENT</th><th>DEV</th><th>DIFF</th></tr>';
    (d.lineas||[]).forEach(function(r){
      r=_dcLinea(r);
      var c=r.cz?' cz-'+r.cz:'';
      t+='<tr><td class="'+c+'">'+r.sku+'</td><td class="'+c+'">'+esc(r.code)+'</td><td class="c">'+(r.ent||0)+'</td><td class="c">'+(r.dev||0)+'</td><td class="c">'+((r.ent||0)-(r.dev||0))+'</td></tr>';
    });
    return t+'</table><div class="dpm-sig"><div><b>TRASPORTE</b><i>NOMBRE</i><u>DNI</u></div><div><b>TIENDA</b><i>NOMBRE</i><u>DNI</u></div></div>';
  }
  if(d.tipo==='nc'){
    t='<h2>ORDEN PARA NOTA DE CRÉDITO - '+esc(sede)+'</h2>'+_dcCab(d)+'<p class="dp-note">Se deja constancia que no dejaron los siguientes productos:</p>'+
      '<table><tr><th style="width:15%">Sku</th><th style="width:15%">SAP</th><th>Descripción</th><th style="width:11%">Und</th></tr>';
    for(i=0;i<Math.max(7,d.lineas.length);i++){ x=d.lineas[i];
      t+=x?'<tr><td class="c">'+esc(x.sku)+'</td><td class="c">'+esc(x.sap)+'</td><td>'+esc(x.desc)+'</td><td class="c">'+(x.und||'')+'</td></tr>':'<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>'; }
    return t+'</table>'+_dcFirmas('TRANSPORTE','TIENDA');
  }
  t='<h2>CARGO DESPACHO - '+esc(sede)+'</h2><div class="dp-hd"><div><span>Placa:</span><b>'+esc(d.placa)+'</b></div><div><span>Fecha</span><b>'+_dcF(d.fecha)+'</b></div></div>'+
    '<table><tr><th>FECHA</th><th>SKU</th><th>SAP</th><th>DESCRIPCIÓN</th><th>PACK/U</th><th>ORIGEN</th><th>DESTINO</th></tr>';
  for(i=0;i<Math.max(8,d.lineas.length);i++){ x=d.lineas[i];
    t+=x?'<tr><td class="c">'+_dcF(d.fecha)+'</td><td class="c">'+esc(x.sku)+'</td><td class="c">'+esc(x.sap)+'</td><td>'+esc(x.desc)+'</td><td class="c">'+_dcCantTxt(x)+'</td><td class="c">'+esc(sede)+'</td><td class="c">'+esc(d.destino)+'</td></tr>'
        :'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'; }
  return t+'</table><p class="dp-note"><b>Observaciones:</b> '+esc(d.observaciones)+'</p>'+_dcFirmas('DS '+esc(sede),'PROVEEDOR');
}
function dcVer(d){
  var pv=document.getElementById('dc-pv');
  if(!pv){
    pv=document.createElement('div'); pv.id='dc-pv'; pv.className='dv';
    pv.innerHTML='<div class="dv-top"><b id="dc-pv-t"></b><span class="sp"></span><button class="btn btn-ghost" onclick="dcCerrarPv()">Cerrar</button><button class="btn btn-primary" onclick="window.print()">Imprimir</button></div>'+
      '<div class="dv-body"><div class="dp" id="dc-paper"></div></div>';
    document.body.appendChild(pv);
  }
  var p=document.getElementById('dc-paper');
  p.className='dp'+(d.tipo==='marcaje'?' mar':'');
  p.innerHTML=_dcPapel(d);
  document.getElementById('dc-pv-t').textContent=DCX_TIT[d.tipo]||'Documento';
  pv.classList.add('on'); document.body.classList.add('doc-printing'); document.documentElement.classList.add('doc-printing');
}
function dcCerrarPv(){
  var pv=document.getElementById('dc-pv'); if(pv) pv.classList.remove('on');
  document.body.classList.remove('doc-printing'); document.documentElement.classList.remove('doc-printing');
}
