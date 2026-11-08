/* Maestro · Precios y SAP — catálogo global maestro_sku (solo administrador).
   Tabla con edición en la celda, panel de detalle con impacto en el valor del stock e importación desde Excel (asistente de 2 pasos). */
var PR={data:[],nuevos:[],sedes:[],idx:{},filtro:'todos',q:'',pag:0,editando:null,undo:null,det:null,tq:null};
var PR_PS=50;                       // filas por página
var _prPuede=function(){ return !!S&&(S.rol==='admin'||S.rol==='store'); };   // administrador y tiendas editan; el invitado solo mira
var _prAdmin=function(){ return !!S&&S.rol==='admin'; };                    // recalcular mermas de todas las sedes: solo administrador
var _PR_CHK='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
var _prEl=function(id){ return document.getElementById(id); };
var _prM2=function(n){ return Number(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); };
var _prSapOk=function(s){ return /^[0-9]{4,10}$/.test(String(s||'')); };
var _prTieneP=function(r){ return r.precio!==null&&r.precio>0; };
var _prStk=function(r){ return r.stock.reduce(function(a,b){return a+b;},0); };

/* ── carga ── */
function loadPrecios(){
  if(!S||!S.token){ errBox('precios-root','Sin sesión activa. Recarga la página.','precios'); PAGE_LOADING['precios']=false; return; }
  var t=(REQ_TOKEN.precios=(REQ_TOKEN.precios||0)+1);
  google.script.run
    .withSuccessHandler(function(r){ if(t!==REQ_TOKEN.precios) return; PAGE_LOADING['precios']=false; renderPrecios(r); })
    .withFailureHandler(function(e){ if(t!==REQ_TOKEN.precios) return; PAGE_LOADING['precios']=false; errBox('precios-root',e.message,'precios'); })
    .getMaestroPrecios(S.token);
}
function _prIndexar(){
  PR.idx={};
  PR.data.forEach(function(r){ PR.idx[r.sku]=r; });
  PR.nuevos.forEach(function(r){ PR.idx[r.sku]=r; });
}
function renderPrecios(r){
  if(_handleExpired(r,'precios-root')) return;
  if(!r||!r.ok){ errBox('precios-root',r&&r.error?r.error:'Error al cargar el Maestro','precios'); return; }
  PR.data=r.data; PR.nuevos=r.sinMaestro; PR.sedes=r.sedes; PR.editando=null; PR.pag=0;
  _prIndexar();
  _prEl('precios-root').innerHTML=
    '<div class="pr-intro">Catálogo global compartido por todas las tiendas. Los precios valorizan el Stock y las mermas.'+(S.rol==='store'?' <b>Lo que cambies aquí cambia para todas las tiendas.</b>':'')+'</div>'+
    '<div class="pr-kp" id="pr-kp"></div><div id="pr-alerta"></div>'+
    '<div class="pr-tb"><div class="pr-sr"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
      '<input id="pr-q" placeholder="Buscar por SKU, descripción o SAP…" autocomplete="off" oninput="prBuscar(this.value)"></div>'+
      '<div class="pr-chips" id="pr-chips"></div>'+
      (_prPuede()?'<div class="pr-hintk"><span class="kbd">Clic</span> en un precio o SAP para editarlo · <span class="kbd">Enter</span> guarda y baja</div>':'')+'</div>'+
    '<div class="pr-tw" id="pr-tw"></div>';
  prPintar();
}

/* ── conteos y estado ── */
function _prEstado(r){
  if(r.nuevo) return ['n','Falta en el Maestro'];
  var sp=!_prTieneP(r), ss=!r.sap, sm=!!r.sap&&!_prSapOk(r.sap);
  if(sp&&(ss||sm)) return ['e',sm?'Sin precio · SAP inválido':'Sin precio ni SAP'];
  if(sp) return ['w','Sin precio'];
  if(sm) return ['w','SAP inválido'];
  if(ss) return ['w','Sin SAP'];
  return ['ok','Completo'];
}
function _prCuentas(){
  var c={total:PR.data.length,conP:0,conS:0,sapMal:0};
  PR.data.forEach(function(r){ if(_prTieneP(r)) c.conP++; if(_prSapOk(r.sap)) c.conS++; else if(r.sap) c.sapMal++; });
  return c;
}
function _prLista(){
  var q=PR.q.trim().toLowerCase();
  var base=PR.filtro==='nuevos'?PR.nuevos:PR.data;
  return base.filter(function(r){
    if(PR.filtro==='sinprecio'&&_prTieneP(r)) return false;
    if(PR.filtro==='sinsap'&&_prSapOk(r.sap)) return false;
    if(q&&(r.sku+' '+r.desc+' '+r.sap).toLowerCase().indexOf(q)<0) return false;
    return true;
  });
}

/* ── pantalla ── */
function prPintar(){
  if(!_prEl('pr-kp')) return;
  PR.editando=null;
  _prKpis();
  prTabla();
}
// Indicadores, aviso y filtros (no tocan la tabla: así no se pierde una celda en edición)
function _prKpis(){
  if(!_prEl('pr-kp')) return;
  var c=_prCuentas(), nN=PR.nuevos.length;
  var pP=c.total?Math.round(c.conP/c.total*100):0, pS=c.total?Math.round(c.conS/c.total*100):0;
  _prEl('pr-kp').innerHTML=
    '<button type="button" class="pr-k'+(PR.filtro==='todos'?' on':'')+'" onclick="prFiltro(\'todos\')"><small>Productos en el Maestro</small><b class="num">'+fmt(c.total)+'</b><div class="s">catálogo global</div></button>'+
    '<button type="button" class="pr-k w'+(PR.filtro==='sinprecio'?' on':'')+'" onclick="prFiltro(\'sinprecio\')"><small>Con precio</small><b class="num">'+pP+'%</b><div class="s">'+fmt(c.conP)+' de '+fmt(c.total)+' · faltan '+fmt(c.total-c.conP)+'</div><div class="bar"><i style="width:'+pP+'%"></i></div></button>'+
    '<button type="button" class="pr-k w'+(PR.filtro==='sinsap'?' on':'')+'" onclick="prFiltro(\'sinsap\')"><small>Con código SAP</small><b class="num">'+pS+'%</b><div class="s">'+fmt(c.conS)+' de '+fmt(c.total)+' · faltan '+fmt(c.total-c.conS)+(c.sapMal?' ('+c.sapMal+' inválidos)':'')+'</div><div class="bar"><i style="width:'+pS+'%"></i></div></button>'+
    '<button type="button" class="pr-k '+(nN?'e':'')+(PR.filtro==='nuevos'?' on':'')+'" onclick="prFiltro(\'nuevos\')"><small>En tiendas pero sin Maestro</small><b class="num">'+nN+'</b><div class="s">'+(nN?'no tienen precio ni SAP':'todo está en el Maestro')+'</div></button>';
  _prEl('pr-alerta').innerHTML=(nN&&PR.filtro!=='nuevos')?'<div class="pr-alert"><span>⚠</span><div><b>'+nN+(nN===1?' producto de '+(S.rol==='store'?'tu tienda no está':'tus tiendas no está'):' productos de '+(S.rol==='store'?'tu tienda no están':'tus tiendas no están'))+' en el Maestro</b> y por eso su costo sale en S/ 0.00.</div><button type="button" onclick="prFiltro(\'nuevos\')">Completarlos</button></div>':'';
  var chips=[['todos','Todos',c.total],['sinprecio','Sin precio',c.total-c.conP],['sinsap','Sin SAP',c.total-c.conS],['nuevos','Sin Maestro',nN]].map(function(x){
    return '<button type="button" class="pr-chip'+(PR.filtro===x[0]?' on':'')+'" onclick="prFiltro(\''+x[0]+'\')">'+x[1]+' <b>'+fmt(x[2])+'</b></button>'; }).join('');
  _prEl('pr-chips').innerHTML=chips;
}
function prFiltro(k){ PR.filtro=k; PR.pag=0; prPintar(); }
function prBuscar(v){ PR.q=v; PR.pag=0; clearTimeout(PR.tq); PR.tq=setTimeout(prTabla,120); }
function prPag(d){ PR.pag+=d; prTabla(); var t=_prEl('pr-tw'); if(t) t.scrollIntoView({block:'nearest'}); }

function _prCelda(r,campo){
  var val=null;
  if(campo==='precio') val=_prTieneP(r)?'S/ '+_prM2(r.precio):null;
  else val=r.sap||null;
  var mal=campo==='sap'&&r.sap&&!_prSapOk(r.sap);
  if(!_prPuede()) return '<span class="pr-cell sol'+(mal?' mal':'')+'">'+(val===null?'—':esc(val))+'</span>';
  return '<span class="pr-cell'+(val===null?' vac':'')+(mal?' mal':'')+'" data-s="'+esc(r.sku)+'" data-c="'+campo+'" onclick="prEditar(this)"'+(mal?' title="Código SAP inválido: debe tener solo números"':'')+'>'+
    (val===null?'agregar '+(campo==='precio'?'precio':'SAP'):esc(val))+'<span class="pen">✎</span></span>';
}
function _prFilaHTML(r){
  var e=_prEstado(r), tot=_prStk(r), val=_prTieneP(r)?tot*r.precio:null;
  var dots=PR.sedes.map(function(s,k){ return '<i class="'+(r.stock[k]>0?'on':'')+'" title="'+esc(s.nombre)+': '+fmt(r.stock[k])+' u."></i>'; }).join('');
  return '<div class="pr-tr'+(r.nuevo?' nuevo':'')+'" id="pr-r-'+esc(r.sku)+'"><span class="sku">'+esc(r.sku)+'</span>'+
    '<div class="dsc" onclick="prDetalle(this.dataset.s)" data-s="'+esc(r.sku)+'" title="Ver detalle">'+esc(r.desc)+'<span class="dots">'+dots+'</span><small>Stock total: '+fmt(tot)+' u.</small></div>'+
    '<div class="r">'+_prCelda(r,'sap')+'</div><div class="r">'+_prCelda(r,'precio')+'</div>'+
    '<div class="r val">'+(val===null?'—':'S/ '+_prM2(val))+'</div><div class="r"><span class="pr-pill '+e[0]+'">'+e[1]+'</span></div></div>';
}
// Actualiza solo una fila (si no es la que se está editando) y los indicadores
function _prRefrescar(r,flash){
  _prKpis();
  if(PR.editando){
    var row=_prEl('pr-r-'+r.sku);
    if(row&&!row.contains(PR.editando)){ var t=document.createElement('div'); t.innerHTML=_prFilaHTML(r); var n=t.firstChild; row.replaceWith(n); if(flash) n.classList.add('flash'); }
    return;
  }
  prTabla();
  if(flash){ var f=_prEl('pr-r-'+r.sku); if(f) f.classList.add('flash'); }
}
function prTabla(){
  var el=_prEl('pr-tw'); if(!el) return;
  PR.editando=null;
  var L=_prLista(), n=L.length, pags=Math.max(1,Math.ceil(n/PR_PS));
  if(PR.pag>=pags) PR.pag=pags-1; if(PR.pag<0) PR.pag=0;
  var ini=PR.pag*PR_PS, vis=L.slice(ini,ini+PR_PS);
  var rows=vis.map(_prFilaHTML).join('');
  el.innerHTML='<div class="pr-th"><span>SKU</span><span>Descripción</span><span class="r">Código SAP</span><span class="r">Precio / unidad</span><span class="r">Valor en stock</span><span class="r">Estado</span></div>'+
    (rows||'<div class="pr-vacio">Nada coincide con la búsqueda o el filtro.</div>')+
    '<div class="pr-pg"><span>'+(n?'Mostrando '+fmt(ini+1)+'–'+fmt(ini+vis.length)+' de '+fmt(n):'0 resultados')+'</span><div>'+
      '<button type="button" class="btn btn-ghost btn-sm" '+(PR.pag<=0?'disabled':'')+' onclick="prPag(-1)">← Anterior</button>'+
      '<button type="button" class="btn btn-ghost btn-sm" '+(PR.pag>=pags-1?'disabled':'')+' onclick="prPag(1)">Siguiente →</button></div></div>';
}

/* ── edición en la celda: Enter guarda y baja a la misma columna de la fila siguiente ── */
function prEditar(span){
  if(PR.editando) return;
  var r=PR.idx[span.dataset.s], c=span.dataset.c; if(!r) return;
  var inp=document.createElement('input');
  inp.className='pr-ed'; inp.inputMode=c==='precio'?'decimal':'numeric'; inp.autocomplete='off';
  inp.value=c==='precio'?(_prTieneP(r)?String(r.precio):''):(r.sap||'');
  inp.placeholder=c==='precio'?'0.00':'Ej: 4000123';
  span.replaceWith(inp); inp.focus(); inp.select(); PR.editando=inp;
  inp.addEventListener('input',function(){
    inp.classList.remove('bad');
    var v=inp.value.replace(c==='precio'?/[^0-9.]/g:/\D/g,'');
    if(c==='precio'){ var i=v.indexOf('.'); if(i>-1) v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,''); }
    if(v!==inp.value) inp.value=v;
  });
  inp.addEventListener('keydown',function(e){
    if(e.key==='Escape'){ e.preventDefault(); _prCerrarCelda(inp,r,c); }
    if(e.key==='Enter'||e.key==='Tab'){
      e.preventDefault();
      var sig=_prSiguiente(r.sku);                       // se calcula antes de guardar: al guardar la fila puede salir del filtro
      if(_prGuardarCelda(inp,r,c)!==false&&sig) _prIrA(sig,c);
    }
  });
  inp.addEventListener('blur',function(){ setTimeout(function(){ if(PR.editando===inp&&document.activeElement!==inp) _prGuardarCelda(inp,r,c); },120); });
}
function _prCerrarCelda(inp,r,c){
  PR.editando=null;
  var tmp=document.createElement('span'); inp.replaceWith(tmp); tmp.outerHTML=_prCelda(r,c);
}
function _prSiguiente(sku){
  var L=_prLista(), i=L.map(function(x){return x.sku;}).indexOf(sku);
  var ini=PR.pag*PR_PS; var vis=L.slice(ini,ini+PR_PS), j=vis.map(function(x){return x.sku;}).indexOf(sku);
  return (j>=0&&vis[j+1])?vis[j+1].sku:null;
}
function _prIrA(sku,c){
  var sel=document.querySelectorAll('.pr-cell[data-c="'+c+'"]'), cell=null;
  for(var i=0;i<sel.length;i++){ if(sel[i].dataset.s===sku){ cell=sel[i]; break; } }
  if(cell){ cell.scrollIntoView({block:'nearest'}); prEditar(cell); }
}
function _prGuardarCelda(inp,r,c){
  var v=inp.value.trim(), nuevo, ok=true;
  if(c==='precio'){ if(v===''){ nuevo=null; } else { var n=parseFloat(v); if(!isFinite(n)||n<0) ok=false; else nuevo=Math.round(n*100)/100; } }
  else { if(v===''){ nuevo=''; } else if(!_prSapOk(v)) ok=false; else nuevo=v; }
  if(!ok){ inp.classList.add('bad'); showToast(c==='precio'?'El precio no es válido':'El código SAP debe tener solo números (4 a 10 dígitos)','err'); return false; }
  var antes=r[c], igual=String(antes===null||antes===undefined?'':antes)===String(nuevo===null?'':nuevo);
  if(igual||(c==='precio'&&!_prTieneP(r)&&nuevo===null)){ _prCerrarCelda(inp,r,c); return true; }
  PR.editando=null;
  var eraNuevo=!!r.nuevo;
  r[c]=nuevo;                                             // se muestra al instante; si el servidor falla se revierte
  var fila={sku:r.sku}; fila[c]=(nuevo===''||nuevo===null)?null:nuevo; if(eraNuevo) fila.desc=r.desc;
  _prCerrarCelda(inp,r,c);
  google.script.run
    .withSuccessHandler(function(res){
      if(!res||!res.ok){ r[c]=antes; showToast((res&&res.error)||'No se pudo guardar','err'); _prRefrescar(r,false); return; }
      if(eraNuevo){ r.nuevo=false; PR.nuevos=PR.nuevos.filter(function(x){return x!==r;}); PR.data.push(r); PR.data.sort(function(a,b){ return a.sku<b.sku?-1:(a.sku>b.sku?1:0); }); }
      PR.undo={sku:r.sku,c:c,antes:antes};
      _prToast((eraNuevo?'Agregado al Maestro: '+r.sku:'Guardado · '+(c==='precio'?'precio':'SAP')+' de '+r.sku),true);
      _prRefrescar(r,true);
    })
    .withFailureHandler(function(e){ r[c]=antes; showToast(e.message,'err'); _prRefrescar(r,false); })
    .guardarMaestroPrecios(S.token,[fila],false);
  return true;
}
function prDeshacer(){
  var u=PR.undo; if(!u) return; var r=PR.idx[u.sku]; if(!r) return;
  PR.undo=null; _prToast('Deshaciendo…',false);
  var fila={sku:u.sku}; fila[u.c]=(u.antes===''||u.antes===null||u.antes===undefined)?null:u.antes;
  google.script.run
    .withSuccessHandler(function(res){ if(!res||!res.ok){ showToast((res&&res.error)||'No se pudo deshacer','err'); return; } r[u.c]=u.antes; _prToast('Cambio deshecho',false); _prRefrescar(r,true); })
    .withFailureHandler(function(e){ showToast(e.message,'err'); })
    .guardarMaestroPrecios(S.token,[fila],false);
}
function _prToast(t,undo){
  var el=_prEl('pr-toast'); if(!el) return;
  el.innerHTML='<div class="pr-toast"><span class="ic">✓</span><span>'+esc(t)+'</span>'+(undo?'<button type="button" onclick="prDeshacer()">Deshacer</button>':'')+'<i class="tb2"></i></div>';
  clearTimeout(_prToast.t); _prToast.t=setTimeout(function(){ el.innerHTML=''; },8000);
}

/* ── panel de detalle ── */
function prDetalle(sku){
  var r=PR.idx[sku]; if(!r) return;
  PR.det={r:r,sap:r.sap,precio:_prTieneP(r)?String(r.precio):'',desc:r.desc,recalc:false,mermas:null,nuevo:false};
  var tot=_prStk(r);
  _prEl('pr-layer').innerHTML='<div class="pr-scrim" onclick="prCerrarLayer()"></div><aside class="pr-drw" role="dialog" aria-label="Detalle del producto">'+
    '<div class="hd"><div class="eb">'+esc(r.sku)+(r.nuevo?' · falta en el Maestro':'')+'</div><h3>'+esc(r.desc)+'</h3></div><div class="bd" id="pr-dbd"></div>'+
    '<div class="ft"><button type="button" class="btn btn-ghost" onclick="prCerrarLayer()">'+(_prPuede()?'Cancelar':'Cerrar')+'</button>'+(_prPuede()?'<button type="button" class="btn btn-primary" id="pr-dsv" onclick="prGuardarDetalle()">Guardar</button>':'')+'</div></aside>';
  _prDetalleHTML();
  if(_prAdmin()) google.script.run.withSuccessHandler(function(res){ if(PR.det&&PR.det.r===r&&res&&res.ok){ PR.det.mermas=res.n; _prDetalleMermas(); } }).withFailureHandler(function(){}).contarMermasSKU(S.token,r.sku);
}
function prCerrarLayer(){ var l=_prEl('pr-layer'); if(l) l.innerHTML=''; PR.det=null; }
function _prDetalleHTML(){
  var D=PR.det, r=D.r;
  _prEl('pr-dbd').innerHTML=
    (_prPuede()&&S.rol==='store'?'<div class="sk-hint mut" style="margin:0 0 14px">Este cambio se aplica a todas las tiendas.</div>':'')+
    '<div class="pr-g2"><div class="sk-f"><label><span>Código SAP</span><em>4 a 10 dígitos</em></label><input class="sk-in" id="pd-sap" value="'+esc(D.sap)+'" inputmode="numeric" maxlength="10" autocomplete="off"'+(_prPuede()?'':' disabled')+'></div>'+
    '<div class="sk-f"><label><span>Precio por unidad</span><em>S/</em></label><div class="sk-pre"><span class="pfx">S/</span><input class="sk-in" id="pd-precio" value="'+esc(D.precio)+'" inputmode="decimal" placeholder="0.00" autocomplete="off"'+(_prPuede()?'':' disabled')+'></div></div></div>'+
    '<div class="sk-f"><label><span>Descripción</span></label><input class="sk-in" id="pd-desc" value="'+esc(D.desc)+'" maxlength="120" autocomplete="off"'+(_prPuede()?'':' disabled')+'></div>'+
    '<div class="pr-imp" id="pd-imp"></div>'+
    '<div class="pr-usos"><div><span>Tienda</span><span>Stock</span><span>Valor</span></div>'+PR.sedes.map(function(s,k){
      var v=_prTieneP(r)?'S/ '+_prM2(r.stock[k]*r.precio):'—';
      return '<div><span>'+esc(s.nombre)+'</span><b class="num">'+fmt(r.stock[k])+' u.</b><b class="num">'+v+'</b></div>'; }).join('')+'</div>'+
    (_prAdmin()?'<label class="pr-keep"><input type="checkbox" id="pd-rc" onchange="PR.det.recalc=this.checked"><span>Recalcular el costo de las mermas ya registradas de este SKU<small id="pd-mn">Cada merma guardó el precio del día en que se registró. Déjalo desmarcado si es un cambio de precio real; márcalo solo si corriges un error.</small></span></label>':'');
  if(!_prPuede()){ _prImpacto(); return; }
  ['pd-sap','pd-precio','pd-desc'].forEach(function(id){
    _prEl(id).addEventListener('input',function(){
      var e=_prEl(id);
      if(id==='pd-sap'){ e.value=e.value.replace(/\D/g,''); D.sap=e.value; }
      if(id==='pd-precio'){ var v=e.value.replace(/[^0-9.]/g,''), i=v.indexOf('.'); if(i>-1) v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,''); e.value=v; D.precio=v; }
      if(id==='pd-desc') D.desc=e.value;
      _prImpacto();
    });
  });
  _prImpacto(); _prDetalleMermas();
}
function _prDetalleMermas(){
  var D=PR.det; if(!D) return; var el=_prEl('pd-mn'); if(!el||D.mermas===null) return;
  el.textContent=D.mermas+(D.mermas===1?' merma guardó':' mermas guardaron')+' el precio del día en que se registró. Déjalo desmarcado si es un cambio de precio real; márcalo solo si corriges un error.';
}
function _prImpacto(){
  var D=PR.det, r=D.r, tot=_prStk(r), a=(_prTieneP(r)?r.precio:0)*tot, p=parseFloat(D.precio)||0, b=p*tot, d=Math.round((b-a)*100)/100;
  _prEl('pd-imp').innerHTML='<small>Impacto en el valor del stock ('+(_prAdmin()?'todas las tiendas':(S.rol==='store'?'tu tienda':'las tiendas'))+')</small><div class="row"><span class="num">S/ '+_prM2(a)+'</span><span>→</span><b class="num">S/ '+_prM2(b)+'</b>'+
    (d!==0?'<span class="d '+(d>0?'up':'dn')+' num">'+(d>0?'+':'')+'S/ '+_prM2(d)+'</span>':'<span class="mut">sin cambio</span>')+'</div>';
  var mal=(D.sap&&!_prSapOk(D.sap))||(D.precio&&!(parseFloat(D.precio)>=0))||!D.desc.trim()||(D.nuevo&&!D.sku);
  var sv=_prEl('pr-dsv'); if(sv) sv.disabled=!!mal;
}
function prGuardarDetalle(){
  var D=PR.det; if(!D) return; var r=D.r, btn=_prEl('pr-dsv');
  var fila={sku:r.sku,sap:D.sap===''?null:D.sap,precio:D.precio===''?null:Math.round(parseFloat(D.precio)*100)/100,desc:D.desc.trim()};
  btn.disabled=true; btn.textContent='Guardando...';
  var eraNuevo=!!r.nuevo, recalc=!!D.recalc;
  google.script.run
    .withSuccessHandler(function(res){
      if(!res||!res.ok){ btn.disabled=false; btn.textContent='Guardar'; showToast((res&&res.error)||'No se pudo guardar','err'); return; }
      r.sap=D.sap; r.precio=fila.precio; r.desc=fila.desc;
      if(eraNuevo){ r.nuevo=false; PR.nuevos=PR.nuevos.filter(function(x){return x!==r;}); PR.data.push(r); PR.data.sort(function(a,b){ return a.sku<b.sku?-1:(a.sku>b.sku?1:0); }); }
      prCerrarLayer(); prPintar();
      _prToast('Guardado · '+r.sku+(recalc?' · costo de '+res.mermas+' mermas recalculado':''),false);
      var row=_prEl('pr-r-'+r.sku); if(row) row.classList.add('flash');
    })
    .withFailureHandler(function(e){ btn.disabled=false; btn.textContent='Guardar'; showToast(e.message,'err'); })
    .guardarMaestroPrecios(S.token,[fila],recalc);
}
function prNuevo(){
  if(!_prPuede()) return;
  PR.det={r:{sku:'',desc:'',sap:'',precio:null,stock:PR.sedes.map(function(){return 0;}),nuevo:true},sap:'',precio:'',desc:'',recalc:false,mermas:null,nuevo:true};
  _prEl('pr-layer').innerHTML='<div class="pr-scrim" onclick="prCerrarLayer()"></div><aside class="pr-drw" role="dialog" aria-label="Agregar al Maestro"><div class="hd"><div class="eb">Nuevo producto</div><h3>Agregar al Maestro</h3></div>'+
    '<div class="bd"><div class="sk-f"><label><span>Código Lovis / SKU <b style="color:var(--danger)">*</b></span></label><input class="sk-in" id="pn-sku" placeholder="Ej: 10000250" autocomplete="off" spellcheck="false"><div id="pn-h"></div></div>'+
    '<div class="sk-f"><label><span>Descripción <b style="color:var(--danger)">*</b></span></label><input class="sk-in" id="pn-desc" placeholder="Nombre completo del producto" maxlength="120" autocomplete="off"></div>'+
    '<div class="pr-g2"><div class="sk-f"><label><span>Código SAP</span><em>opcional</em></label><input class="sk-in" id="pn-sap" inputmode="numeric" maxlength="10" placeholder="4000123" autocomplete="off"></div>'+
    '<div class="sk-f"><label><span>Precio por unidad</span><em>opcional</em></label><div class="sk-pre"><span class="pfx">S/</span><input class="sk-in" id="pn-precio" inputmode="decimal" placeholder="0.00" autocomplete="off"></div></div></div>'+
    '<div class="pr-imp"><small>Se guarda en el Maestro</small><div class="row"><span>Lo verán todas las tiendas y valorizará su Stock.</span></div></div></div>'+
    '<div class="ft"><button type="button" class="btn btn-ghost" onclick="prCerrarLayer()">Cancelar</button><button type="button" class="btn btn-primary" id="pn-sv" disabled onclick="prGuardarNuevo()">Agregar</button></div></aside>';
  var g=function(id){ return _prEl(id); };
  function val(){
    var sku=g('pn-sku').value.trim(), h=g('pn-h'), ex=sku?PR.idx[sku]:null, bad=false;
    if(sku&&!/^[A-Za-z0-9._-]+$/.test(sku)){ h.innerHTML='<div class="sk-hint err">Usa solo letras, números, guiones o puntos.</div>'; bad=true; }
    else if(ex&&!ex.nuevo){ h.innerHTML='<div class="sk-hint err">Ya está en el Maestro: '+esc(ex.desc)+' <button type="button" onclick="prDetalle(\''+esc(sku)+'\')">Abrir</button></div>'; bad=true; }
    else if(ex&&ex.nuevo){ h.innerHTML='<div class="sk-hint ok">Está en tus tiendas y falta en el Maestro: completa su precio y SAP.</div>'; if(!g('pn-desc').value) g('pn-desc').value=ex.desc; }
    else h.innerHTML='';
    var sap=g('pn-sap').value, pr=g('pn-precio').value;
    if(!sku||!g('pn-desc').value.trim()||bad||(sap&&!_prSapOk(sap))||(pr&&!(parseFloat(pr)>=0))) bad=true;
    g('pn-sv').disabled=bad;
  }
  g('pn-sku').addEventListener('input',val); g('pn-desc').addEventListener('input',val);
  g('pn-sap').addEventListener('input',function(){ var e=g('pn-sap'); e.value=e.value.replace(/\D/g,''); val(); });
  g('pn-precio').addEventListener('input',function(){ var e=g('pn-precio'); var v=e.value.replace(/[^0-9.]/g,''), i=v.indexOf('.'); if(i>-1) v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,''); e.value=v; val(); });
  setTimeout(function(){ g('pn-sku').focus(); },250);
}
function prGuardarNuevo(){
  var g=function(id){ return _prEl(id).value.trim(); }, btn=_prEl('pn-sv');
  var fila={sku:g('pn-sku'),desc:g('pn-desc'),sap:g('pn-sap')||null,precio:g('pn-precio')===''?null:Math.round(parseFloat(g('pn-precio'))*100)/100};
  btn.disabled=true; btn.textContent='Guardando...';
  google.script.run
    .withSuccessHandler(function(res){
      if(!res||!res.ok){ btn.disabled=false; btn.textContent='Agregar'; showToast((res&&res.error)||'No se pudo guardar','err'); return; }
      var ex=PR.idx[fila.sku], r=ex||{sku:fila.sku,stock:PR.sedes.map(function(){return 0;}),enTiendas:PR.sedes.map(function(){return false;})};
      r.desc=fila.desc; r.sap=fila.sap||''; r.precio=fila.precio; r.nuevo=false;
      PR.nuevos=PR.nuevos.filter(function(x){return x!==r;});
      if(PR.data.indexOf(r)<0) PR.data.push(r);
      PR.data.sort(function(a,b){ return a.sku<b.sku?-1:(a.sku>b.sku?1:0); }); _prIndexar();
      prCerrarLayer(); prPintar(); _prToast('Agregado al Maestro: '+fila.sku,false);
    })
    .withFailureHandler(function(e){ btn.disabled=false; btn.textContent='Agregar'; showToast(e.message,'err'); })
    .guardarMaestroPrecios(S.token,[fila],false);
}

/* ── exportar ── */
function prExportar(respaldo){
  if(!PR.data.length){ showToast('No hay datos para exportar','err'); return; }
  var todo=PR.data.concat(PR.nuevos);
  var rows=todo.map(function(r){ var tot=_prStk(r);
    return {'SKU':r.sku,'Descripción':r.desc,'Código SAP':r.sap,'Precio':_prTieneP(r)?r.precio:'','Stock total':tot,'Valor en stock':_prTieneP(r)?Math.round(tot*r.precio*100)/100:'','En el Maestro':r.nuevo?'No':'Sí'}; });
  var ws=XLSX.utils.json_to_sheet(rows); ws['!cols']=[{wch:14},{wch:48},{wch:14},{wch:10},{wch:12},{wch:14},{wch:14}];
  var wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Maestro');
  XLSX.writeFile(wb,(respaldo?'maestro_respaldo_':'maestro_precios_')+_hoyISO()+'.xlsx');
  showToast(respaldo?'Respaldo del Maestro descargado':'Maestro exportado a Excel','ok');
}

/* ══════════════════════════════════════
   IMPORTAR DESDE EXCEL — asistente de 2 pasos (1 Archivo · 2 Revisar y aplicar)
══════════════════════════════════════ */
var PI={cols:{},paso:1,dir:1,leyendo:false,leido:false,fin:false,archivo:'',filas:[],ignoradas:0,items:[],iguales:0,tab:'precio',rc:false,backup:false,run:0,aplicando:false,resumen:null};
var PI_NOM=['Archivo','Revisar y aplicar'];
var _piTM=null;
function prAbrirImportar(){
  if(!_prPuede()) return;
  if(!PR.data.length&&!PR.nuevos.length){ showToast('Espera a que cargue el Maestro','err'); return; }
  PI.run++; clearTimeout(_piTM);
  PI.paso=1; PI.dir=1; PI.leyendo=false; PI.leido=false; PI.fin=false; PI.archivo=''; PI.filas=[]; PI.items=[]; PI.rc=false; PI.backup=false; PI.aplicando=false; PI.tab='precio';
  _prEl('pi-err').textContent='';
  piRender(false);
  openFS('fs-precios');
}
function piRender(anim){
  var p=_prEl('pi-pane'); if(anim){ p.classList.remove('in-fwd','in-back'); void p.offsetWidth; p.classList.add(PI.dir>0?'in-fwd':'in-back'); }
  p.dataset.paso=PI.fin?3:PI.paso;
  // riel
  var rail=_prEl('pi-rail');
  if(!rail.dataset.built){
    rail.dataset.built='1';
    rail.innerHTML='<h4>Asistente · 2 pasos</h4>'+PI_NOM.map(function(n,i){ var k=i+1;
      return '<button type="button" class="wz-stp" id="pi-stp-'+k+'" disabled><span class="wz-dot" id="pi-dot-'+k+'">'+k+'</span><span class="wz-ln"><i></i></span><span class="wz-tx"><strong>'+n+'</strong><small id="pi-sm-'+k+'"></small></span></button>'; }).join('');
  }
  for(var k=1;k<=2;k++){
    var hecho=PI.fin||k<PI.paso, on=!PI.fin&&k===PI.paso, b=_prEl('pi-stp-'+k);
    b.classList.toggle('on',on); b.classList.toggle('done',hecho);
    var d=_prEl('pi-dot-'+k); if((d.dataset.d==='1')!==hecho){ d.dataset.d=hecho?'1':'0'; d.innerHTML=hecho?_PR_CHK:k; }
  }
  _prEl('pi-sm-1').textContent=PI.leido?(PI.archivo+' · '+fmt(PI.filas.length)+' filas'):'Sube tu Excel de precios';
  _prEl('pi-sm-2').textContent=PI.paso>=2?(_piTot().n+' cambios seleccionados'):'Mira qué va a cambiar';
  _prEl('pi-ph').classList.toggle('hidden',PI.fin);
  _prEl('pi-pb').classList.toggle('hidden',PI.fin); _prEl('pi-s3').classList.toggle('hidden',!PI.fin);
  if(PI.fin){ _piExito(); _prEl('pi-footer').classList.add('hidden'); return; }
  _prEl('pi-footer').classList.remove('hidden');
  if(PI.paso===1) _piPaso1(); else _piPaso2();
}
function piCerrar(){ PI.run++; clearTimeout(_piTM); closeFS('fs-precios'); }

/* paso 1: archivo */
function _piPaso1(){
  _prEl('pi-eb').textContent='Paso 1 de 2'; _prEl('pi-t').textContent='Sube tu archivo de precios';
  _prEl('pi-s').textContent='Excel con las columnas SKU, Código SAP y Precio. Detectamos las columnas solas; las celdas vacías no borran nada.';
  _prEl('pi-footer').innerHTML='<span class="sk-hints"></span><button type="button" class="btn btn-ghost" onclick="piCerrar()">Cancelar</button>';
  var b=_prEl('pi-pb');
  if(PI.leyendo) return;
  if(PI.leido){
    var n=PI.items.filter(function(i){return i.tipo!=='error';}).length, e=PI.items.filter(function(i){return i.tipo==='error';}).length;
    b.innerHTML='<div class="wz-fl"><div class="wz-fi xl">XLS</div><div class="wz-flm"><div class="wz-fn">'+esc(PI.archivo)+'</div><div class="wz-fs">'+fmt(PI.filas.length)+' filas leídas</div></div><button type="button" class="btn btn-ghost btn-sm" onclick="piCambiar()">Cambiar</button></div>'+
      '<div class="wz-found"><span>✓ Columna SKU</span>'+(PI.cols.sap?'<span>✓ Columna Código SAP</span>':'')+(PI.cols.precio?'<span>✓ Columna Precio</span>':'')+'</div>'+
      '<div class="pi-strip"><div><small>Van a cambiar</small><div class="v num">'+fmt(n)+'</div></div><div><small>Sin cambios</small><div class="v2 num">'+fmt(PI.iguales)+'</div></div><div><small>Con errores</small><div class="v2 num'+(e?' er':'')+'">'+fmt(e)+'</div></div></div>'+
      '<div class="wz-cta1"><button type="button" class="btn btn-primary wz-big" id="pi-cta" onclick="piRevisar()"'+(n?'':' disabled')+'>Revisar los cambios →</button><span class="wz-kbd">Enter</span></div>'+
      (n?'':'<div class="sk-hint mut" style="margin-top:12px">El archivo no trae cambios respecto al Maestro actual.</div>');
    setTimeout(function(){ var c=_prEl('pi-cta'); if(c&&!c.disabled) c.focus({preventScroll:true}); },120);
    return;
  }
  b.innerHTML='<div class="en2-drop" id="pi-drop" onclick="_prEl(\'pi-file\').click()" ondragover="event.preventDefault();this.classList.add(\'over\')" ondragleave="this.classList.remove(\'over\')" ondrop="this.classList.remove(\'over\');piSoltar(event)">'+
    '<div class="wz-upic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>'+
    '<b>Arrastra el Excel aquí</b><small>o haz clic para elegirlo · .xlsx o .xls</small>'+
    '<input type="file" id="pi-file" accept=".xlsx,.xls" style="display:none" onchange="piArchivo(this.files[0])"/></div>'+
    '<div style="margin-top:14px;text-align:center"><button type="button" class="btn btn-ghost btn-sm" onclick="prExportar(false)">Descargar plantilla con el Maestro actual</button></div>';
}
function piSoltar(ev){ ev.preventDefault(); var f=ev.dataTransfer.files[0]; if(f) piArchivo(f); }
function piCambiar(){ PI.leido=false; PI.filas=[]; PI.items=[]; piRender(false); }
function _piNorm(s){ return String(s==null?'':s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
function piArchivo(file){
  if(!file) return;
  var err=_prEl('pi-err'); err.textContent='';
  if(!/\.xlsx?$/i.test(file.name)){ err.textContent='Solo se aceptan archivos .xlsx o .xls'; return; }
  var run=++PI.run;
  PI.archivo=file.name; PI.leyendo=true; PI.leido=false;
  _piStage(file.name);
  var rd=new FileReader();
  rd.onerror=function(){ _piFallo(run,'No se pudo leer el archivo'); };
  rd.onload=function(e){
    if(run!==PI.run) return;
    try{
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
      var r=_piParsear(rows);
      if(r.error){ _piFallo(run,r.error); return; }
      PI.filas=r.filas; PI.ignoradas=r.ignoradas; PI.cols=r.cols;
      _piComparar();
      _piAnimar(run);
    }catch(ex){ _piFallo(run,'No se pudo leer el archivo: '+ex.message); }
  };
  rd.readAsArrayBuffer(file);
}
function _piFallo(run,msg){
  if(run!==PI.run) return;
  PI.run++; PI.leyendo=false; PI.leido=false; clearTimeout(_piTM);
  _prEl('pi-err').textContent=msg; piRender(false);
}
// Busca la fila de encabezados y las columnas SKU / SAP / Precio / Descripción
function _piParsear(rows){
  var h=-1, c={sku:-1,sap:-1,precio:-1,desc:-1};
  for(var i=0;i<Math.min(rows.length,20)&&h<0;i++){
    var cols=(rows[i]||[]).map(_piNorm), t={sku:-1,sap:-1,precio:-1,desc:-1};
    cols.forEach(function(x,j){
      if(t.sku<0&&/^(sku|lovis|codigo lovis|cod\.? lovis|codigo( de articulo)?|material|cod sku|codigo sku)$/.test(x)) t.sku=j;
      else if(t.sap<0&&/sap/.test(x)) t.sap=j;
      else if(t.precio<0&&/(precio|costo)/.test(x)) t.precio=j;
      else if(t.desc<0&&/^(descripcion|producto|nombre|detalle)/.test(x)) t.desc=j;
    });
    if(t.sku>=0&&(t.sap>=0||t.precio>=0)){ h=i; c=t; }
  }
  if(h<0) return {error:'No encontré las columnas. La primera fila debe tener "SKU" y al menos "Código SAP" o "Precio". Puedes descargar la plantilla con el Maestro actual.'};
  var filas=[], vistos={}, ignoradas=0;
  for(var k=h+1;k<rows.length;k++){
    var row=rows[k]||[], rawSku=row[c.sku];
    if(rawSku===''||rawSku===null||rawSku===undefined) { if(row.some(function(x){return x!=='';})) ignoradas++; continue; }
    var sku=typeof rawSku==='number'?String(Math.round(rawSku)):String(rawSku).trim();
    var f={fila:k+1,sku:sku,desc:c.desc>=0?String(row[c.desc]||'').trim():'',hasSap:false,hasPrecio:false,sap:'',precio:null,err:''};
    if(c.sap>=0){ var rs=row[c.sap]; var s=typeof rs==='number'?String(Math.round(rs)):String(rs===undefined?'':rs).trim(); if(s!==''){ f.hasSap=true; f.sap=s; } }
    if(c.precio>=0){ var rp=row[c.precio]; if(rp!==''&&rp!==null&&rp!==undefined){ var n=typeof rp==='number'?rp:parseFloat(String(rp).replace(/[^0-9.,-]/g,'').replace(',','.')); f.hasPrecio=true; f.precio=n; } }
    if(!f.hasSap&&!f.hasPrecio){ ignoradas++; continue; }
    if(!/^[A-Za-z0-9._-]+$/.test(sku)) f.err='El SKU "'+sku+'" tiene caracteres no válidos';
    else if(vistos[sku]) f.err='SKU repetido en el archivo (también en la fila '+vistos[sku]+')';
    else if(f.hasSap&&!_prSapOk(f.sap)) f.err='Código SAP inválido: "'+f.sap+'" (solo números, 4 a 10 dígitos)';
    else if(f.hasPrecio&&(!isFinite(f.precio)||f.precio<0)) f.err='Precio inválido';
    if(!vistos[sku]) vistos[sku]=k+1;
    if(f.hasPrecio&&isFinite(f.precio)) f.precio=Math.round(f.precio*100)/100;
    filas.push(f);
  }
  if(!filas.length) return {error:'El archivo no trae filas con SAP o precio para actualizar.'};
  return {filas:filas,ignoradas:ignoradas,cols:{sap:c.sap>=0,precio:c.precio>=0,desc:c.desc>=0}};
}
// Compara con el Maestro actual y arma la lista de cambios
function _piComparar(){
  var items=[], iguales=0;
  PI.filas.forEach(function(f){
    if(f.err){ items.push({sku:f.sku,desc:f.desc,tipo:'error',err:f.err,inc:false}); return; }
    var cur=PR.idx[f.sku];
    var base={sku:f.sku,desc:cur?cur.desc:f.desc,hasSap:f.hasSap,hasPrecio:f.hasPrecio,sapD:f.sap,pD:f.precio,sapA:cur&&!cur.nuevo?cur.sap:'',pA:cur&&!cur.nuevo&&_prTieneP(cur)?cur.precio:null,inc:true};
    if(!cur||cur.nuevo){
      if(!base.desc){ items.push({sku:f.sku,desc:'',tipo:'error',err:'Producto nuevo sin descripción: agrega la columna "Descripción" al archivo',inc:false}); return; }
      base.tipo='nuevo'; items.push(base); return;
    }
    var pC=f.hasPrecio&&String(base.pA===null?'':base.pA)!==String(f.precio);
    var sC=f.hasSap&&base.sapA!==f.sap;
    if(pC){ base.tipo='precio'; base.sapC=sC; items.push(base); }
    else if(sC){ base.tipo='sap'; items.push(base); }
    else iguales++;
  });
  PI.items=items; PI.iguales=iguales;
  PI.tab=['precio','sap','nuevo','error'].filter(function(t){ return items.some(function(i){return i.tipo===t;}); })[0]||'precio';
}
// Lectura animada: se muestran las primeras filas y el contador sube hasta el total
function _piStage(nombre){
  _prEl('pi-eb').textContent='Paso 1 de 2'; _prEl('pi-t').textContent='Sube tu archivo de precios'; _prEl('pi-s').textContent='Leyendo y comparando con el Maestro actual…';
  _prEl('pi-footer').innerHTML='<span class="sk-hints"></span><button type="button" class="btn btn-ghost" onclick="piCancelarLectura()">Cancelar</button>';
  var n=esc(nombre);
  _prEl('pi-pb').innerHTML='<div class="wz-rstage" id="pi-rst"><div class="wz-rhead"><div><div class="wz-rt1">Leyendo '+n+'</div><div class="wz-big num"><span id="pi-cnt">0</span><small>filas leídas</small></div></div>'+
    '<div class="wz-pw"><div class="wz-pbar"><i id="pi-pgb"></i></div><div class="wz-rmsg">Detectando columnas y comparando con el Maestro…</div></div></div>'+
    '<div class="wz-docbox"><div class="wz-beam" id="pi-beam"></div><div class="wz-dh"><span class="wz-nm"><i class="xl">XLS</i>'+n+'</span><span class="wz-pg">Hoja 1</span></div>'+
    '<div class="wz-paper xl" id="pi-paper"><div class="wz-ph1"><b>Hoja1</b><span>&nbsp;</span></div><div id="pi-dl"></div></div></div></div>';
}
function piCancelarLectura(){ PI.run++; PI.leyendo=false; PI.leido=false; clearTimeout(_piTM); piRender(false); }
function _piAnimar(run){
  var total=PI.filas.length, muestra=PI.filas.slice(0,14), i=0, rd=_wzReducido();
  var dl=_prEl('pi-dl'), paper=_prEl('pi-paper');
  if(typeof countTo==='function'){ var c=_prEl('pi-cnt'); if(c){ c.dataset.v=0; countTo(c,total,_numFmt0,rd?10:1400); } }
  var pb=_prEl('pi-pgb'); if(pb) pb.style.width='100%';
  (function paso(){
    if(run!==PI.run) return;
    if(i<muestra.length&&!rd){
      var f=muestra[i++];
      dl.insertAdjacentHTML('beforeend','<div class="wz-dl"><span>'+f.fila+'</span><span>'+esc(f.sku)+'</span><span class="d">'+esc(f.desc||'')+'</span><span class="q">'+(f.hasSap?esc(f.sap):'')+'</span><span class="m">'+(f.hasPrecio&&isFinite(f.precio)?_prM2(f.precio):'')+'</span></div>');
      paper.scrollTop=paper.scrollHeight; _piTM=setTimeout(paso,70); return;
    }
    var bm=_prEl('pi-beam'); if(bm) bm.remove();
    var box=document.querySelector('#pi-rst .wz-docbox');
    if(box) box.insertAdjacentHTML('beforeend','<div class="wz-stamp"><div class="wz-sc"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div><b>'+fmt(total)+' filas listas para comparar</b></div>');
    _piTM=setTimeout(function(){
      if(run!==PI.run) return;
      var st=_prEl('pi-rst'); if(st) st.classList.add('out');
      _piTM=setTimeout(function(){ if(run!==PI.run) return; PI.leyendo=false; PI.leido=true; piRender(true); },rd?0:480);
    },rd?200:1000);
  })();
}

/* paso 2: revisar */
function _piTot(){
  var inc=PI.items.filter(function(i){return i.inc&&i.tipo!=='error';}), a=0, b=0;
  inc.forEach(function(i){
    if(!i.hasPrecio) return;
    var cur=PR.idx[i.sku], stk=cur?_prStk(cur):0;
    a+=(i.pA||0)*stk; b+=i.pD*stk;
  });
  return {n:inc.length,a:a,b:b,d:b-a};
}
function piRevisar(){ if(!PI.leido||!PI.items.some(function(i){return i.tipo!=='error';})) return; PI.dir=1; PI.paso=2; piRender(true); }
function piTab(t){ PI.tab=t; _piPaso2Cuerpo(); }
function piMarcar(i,v){ PI.items[i].inc=v; _piPaso2Cuerpo(); }
function _piPaso2(){
  _prEl('pi-eb').textContent='Paso 2 de 2'; _prEl('pi-t').textContent='Revisa los cambios';
  _prEl('pi-s').textContent='Desmarca lo que no quieras aplicar. Los saltos de precio de 25% o más se marcan con ⚠.'+(S.rol==='store'?' Los cambios se aplican a todas las tiendas.':'');
  _piPaso2Cuerpo();
}
function _piPaso2Cuerpo(){
  var T=_piTot(), cnt={precio:0,sap:0,nuevo:0,error:0}; PI.items.forEach(function(i){ cnt[i.tipo]++; });
  var tabs=[['precio','Cambios de precio'],['sap','Cambios de SAP'],['nuevo','Productos nuevos'],['error','Con errores']].map(function(t){
    return '<button type="button" class="pr-chip'+(PI.tab===t[0]?' on':'')+'" onclick="piTab(\''+t[0]+'\')">'+t[1]+' <b>'+fmt(cnt[t[0]])+'</b></button>'; }).join('');
  var rows=PI.items.map(function(it,idx){ return it.tipo===PI.tab?_piFila(it,idx):''; }).join('')||'<div class="pr-vacio">No hay filas en esta categoría.</div>';
  _prEl('pi-pb').innerHTML='<div class="pi-strip"><div><small>Se actualizarán</small><div class="v num">'+fmt(T.n)+' <span class="u">productos</span></div></div>'+
    '<div><small>Valor del stock ('+(_prAdmin()?'todas las tiendas':(S.rol==='store'?'tu tienda':'las tiendas'))+')</small><div class="v2 num">S/ '+_prM2(T.a)+' → S/ '+_prM2(T.b)+' <span class="d '+(T.d>0?'up':'dn')+'">'+(T.d>0?'+':'')+'S/ '+_prM2(T.d)+'</span></div></div>'+
    '<div><small>No se aplicarán</small><div class="v2 num'+(cnt.error?' er':'')+'">'+fmt(cnt.error)+' con errores</div></div></div>'+
    '<div class="pr-tabs">'+tabs+'</div><div class="pi-ct"><div class="pi-ch"><span></span><span>SKU</span><span>Descripción</span><span>Código SAP</span><span>Precio / unidad</span><span class="r">Δ</span></div>'+rows+'</div>';
  _prEl('pi-footer').innerHTML='<button type="button" class="btn btn-ghost" onclick="piAtras()">← Cambiar archivo</button>'+
    '<button type="button" class="btn btn-ghost" onclick="prExportar(true);PI.backup=true;_piPaso2Cuerpo()">'+(PI.backup?'✓ Respaldo descargado':'Descargar respaldo del Maestro')+'</button><span class="sk-hints"></span>'+
    (_prAdmin()?'<label class="sk-keep"><input type="checkbox" '+(PI.rc?'checked':'')+' onchange="PI.rc=this.checked"> Recalcular costo de mermas ya registradas</label>':'')+
    '<button type="button" class="btn btn-primary" id="pi-ap" '+(T.n&&!PI.aplicando?'':'disabled')+' onclick="piAplicar()">'+(PI.aplicando?'Aplicando...':'Aplicar '+fmt(T.n)+' cambios')+'</button>';
}
function _piFila(it,idx){
  if(it.tipo==='error') return '<div class="pi-cr err"><span></span><span class="sku">'+esc(it.sku)+'</span><span class="dd">'+esc(it.desc||'')+'</span><span class="errt">⚠ '+esc(it.err)+' · no se aplicará</span></div>';
  var pct=(it.pA&&it.hasPrecio)?Math.round((it.pD-it.pA)/it.pA*1000)/10:null, alto=pct!==null&&Math.abs(pct)>=25;
  var sapC=it.hasSap&&it.sapA!==it.sapD, pC=it.hasPrecio&&it.pA!==it.pD;
  var sapH=!it.hasSap?'<span class="mut">—</span>':(sapC?(it.sapA?'<span class="a">'+esc(it.sapA)+'</span><span class="ar">→</span><span class="n">'+esc(it.sapD)+'</span>':'<span class="nuev">+ '+esc(it.sapD)+'</span>'):'<span class="mut">'+esc(it.sapD)+'</span>');
  var preH=!it.hasPrecio?'<span class="mut">—</span>':(pC?(it.pA!==null?'<span class="a">'+_prM2(it.pA)+'</span><span class="ar">→</span><span class="n">'+_prM2(it.pD)+'</span>':'<span class="nuev">+ '+_prM2(it.pD)+'</span>'):'<span class="mut">'+_prM2(it.pD)+'</span>');
  return '<div class="pi-cr'+(it.inc?'':' off')+'"><input type="checkbox" class="pv-ck" '+(it.inc?'checked':'')+' onchange="piMarcar('+idx+',this.checked)" aria-label="Incluir"><span class="sku">'+esc(it.sku)+'</span><span class="dd" title="'+esc(it.desc)+'">'+esc(it.desc)+'</span>'+
    '<span class="ba">'+sapH+'</span><span class="ba">'+preH+'</span><span class="pc'+(pct===null?'':(pct>0?' up':' dn'))+(alto?' alto':'')+'">'+(pct===null?'':(alto?'⚠ ':'')+(pct>0?'+':'')+pct+'%')+'</span></div>';
}
function piAtras(){ PI.dir=-1; PI.paso=1; PI.leido=true; piRender(true); }
function piAplicar(){
  if(PI.aplicando) return;
  var inc=PI.items.filter(function(i){return i.inc&&i.tipo!=='error';});
  if(!inc.length) return;
  var filas=inc.map(function(i){
    var f={sku:i.sku};
    if(i.hasPrecio) f.precio=i.pD;
    if(i.hasSap&&(i.tipo==='nuevo'||i.sapA!==i.sapD)) f.sap=i.sapD;
    if(i.tipo==='nuevo') f.desc=i.desc;
    return f;
  });
  PI.aplicando=true; _piPaso2Cuerpo(); _prEl('pi-err').textContent='';
  var antesTot=_piTot(), conteo={precio:0,sap:0,nuevo:0}; inc.forEach(function(i){ conteo[i.tipo]++; });
  google.script.run
    .withSuccessHandler(function(r){
      PI.aplicando=false;
      if(!r||!r.ok){ _prEl('pi-err').textContent=(r&&r.error)||'No se pudo aplicar'; _piPaso2Cuerpo(); return; }
      PI.resumen={conteo:conteo,tot:antesTot,mermas:r.mermas,rc:PI.rc};
      PI.fin=true; PI.dir=1; piRender(true);
      reloadPage('precios');
    })
    .withFailureHandler(function(e){ PI.aplicando=false; _prEl('pi-err').textContent=e.message; _piPaso2Cuerpo(); })
    .guardarMaestroPrecios(S.token,filas,_prAdmin()&&PI.rc);
}
function _piExito(){
  var R=PI.resumen||{conteo:{precio:0,sap:0,nuevo:0},tot:{a:0,b:0},mermas:0};
  _prEl('pi-s3').innerHTML='<div class="wz-okc"><svg viewBox="0 0 100 100"><circle class="halo" cx="50" cy="50" r="46"/><circle class="c1" cx="50" cy="50" r="46"/><path class="c2" d="M30 52l14 14 27-30"/></svg>'+
    '<h2>Maestro actualizado</h2><p>Los cambios ya valorizan el Stock de las tiendas.</p>'+
    '<div class="pi-st"><span>'+fmt(R.conteo.precio)+' precios</span><span>'+fmt(R.conteo.sap)+' códigos SAP</span><span>'+fmt(R.conteo.nuevo)+' productos nuevos</span></div>'+
    '<p class="num">Valor del stock: S/ '+_prM2(R.tot.a)+' → S/ '+_prM2(R.tot.b)+'</p>'+(R.rc?'<p class="num">Costo recalculado en '+fmt(R.mermas)+' mermas</p>':'')+
    '<div class="acts"><button type="button" class="btn btn-primary" onclick="piCerrar()">Ver el Maestro</button></div></div>';
}

// Atajos: Esc cierra y Enter continúa
document.addEventListener('keydown',function(e){
  var fs=document.getElementById('fs-precios');
  if(fs&&fs.classList.contains('open')){
    if(e.key==='Escape'){ piCerrar(); return; }
    if(e.key==='Enter'&&PI.paso===1&&PI.leido&&!PI.fin&&document.activeElement.tagName!=='BUTTON'){ var c=_prEl('pi-cta'); if(c&&!c.disabled){ e.preventDefault(); c.click(); } }
    return;
  }
  if(e.key==='Escape'&&_prEl('pr-layer')&&_prEl('pr-layer').firstChild&&CURRENT_PAGE==='precios') prCerrarLayer();
});
