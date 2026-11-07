/* M-T · pestaña "Revisión": estado físico (buen estado / mal estado) de las mermas pendientes de retiro.
   Por cada SKU, lo pendiente (mermas sin factura de retiro) se reparte en buen estado + mal estado.
   Reemplaza el Excel de revisión: se captura aquí y las listas de buen/mal estado se exportan a Excel. */
var _MTR={ sede:'', sedeNombre:'', sedes:[], rows:[], ed:{}, vista:'rev', q:'', n:0, cargado:false };

function _mtrInjectCss(){
  if(document.getElementById('mtr-css')) return;
  var st=document.createElement('style'); st.id='mtr-css';
  st.textContent=
    '.mtr-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}'+
    '@media(max-width:720px){.mtr-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}'+
    '.mtr-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}'+
    '.mtr-bar .sal2-srch{flex:1;min-width:200px}'+
    '.mtr-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px;max-height:70vh}'+
    '.mtr-t{display:grid;grid-template-columns:minmax(220px,1fr) 90px 120px 120px 170px 150px;min-width:820px;align-items:center}'+
    '.mtr-t.lst{grid-template-columns:130px minmax(220px,1fr) 120px;min-width:0}'+
    '.mtr-t>div{padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text);min-width:0}'+
    '.mtr-t>.h{position:sticky;top:0;z-index:2;background:var(--surface2);font:600 10.5px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--text3)}'+
    '.mtr-t .r{text-align:right;font-variant-numeric:tabular-nums}'+
    '.mtr-t .c{text-align:center}'+
    '.mtr-p b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.mtr-p span{font:500 11px var(--font-mono);color:var(--text3)}'+
    '.mtr-in{width:84px;background:var(--surface);border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:7px 8px;font:600 13px Inter,sans-serif;text-align:right}'+
    '.mtr-in:focus{outline:none;border-color:var(--accent)}'+
    '.mtr-in:disabled{opacity:.6}'+
    '.mtr-atajo{display:flex;gap:6px;justify-content:center}'+
    '.mtr-atajo button{background:transparent;border:1px solid var(--border2);color:var(--text2);border-radius:99px;padding:3px 10px;font-size:11px;cursor:pointer}'+
    '.mtr-atajo button:hover{background:rgba(255,255,255,.08)}'+
    '.mtr-tot{font-weight:700}'+
    '.mtr-nota{font-size:12px;color:var(--text3);margin:10px 2px}';
  document.head.appendChild(st);
}

function mtRevSede(id){ _MTR.sede=id; _MTR.ed={}; mtRevCargar(); }
function mtRevCargar(){
  var host=document.getElementById('mt-rev'); if(!host) return;
  _mtrInjectCss();
  var n=++_MTR.n;
  if(!_MTR.cargado) host.innerHTML='<div class="loading ld"><div class="ld-ring"></div><div class="ld-txt">Cargando mermas pendientes<span class="ld-dots"></span></div></div>';
  google.script.run
    .withSuccessHandler(function(r){
      if(n!==_MTR.n) return;
      if(_handleExpired(r,'mt-rev')) return;
      if(!r||!r.ok){ errBox('mt-rev',r?r.error:'Error desconocido','mt'); return; }
      _MTR.sede=r.sede; _MTR.sedeNombre=r.sedeNombre; _MTR.sedes=r.sedes||[]; _MTR.rows=r.data||[]; _MTR.cargado=true;
      mtRevPintar();
    })
    .withFailureHandler(function(e){ if(n===_MTR.n) errBox('mt-rev',e.message,'mt'); })
    .getMTRevision(S.token,_MTR.sede||null);
}

/* Valores vigentes de un SKU: lo editado en pantalla o, si no hay, lo guardado */
function _mtrEf(r){
  var e=_MTR.ed[r.sku];
  if(e) return { b:e.b, m:e.m, edit:true };
  if(r.revisado) return { b:r.buen, m:r.mal, edit:false };
  return { b:null, m:null, edit:false };
}
/* sin = sin revisar · ok = suma lo pendiente · exc/falta = lo editado no suma · cambio = lo guardado ya no suma (cambió el pendiente) */
function _mtrEstado(r){
  var e=_mtrEf(r); if(e.b===null||e.m===null) return 'sin';
  var s=e.b+e.m; if(s===r.pend) return 'ok';
  if(e.edit) return s>r.pend?'exc':'falta';
  return 'cambio';
}
function _mtrBadge(r){
  var st=_mtrEstado(r), e=_mtrEf(r);
  if(st==='ok') return '<span class="mt2-bd ok">Listo</span>';
  if(st==='sin') return '<span class="mt2-bd n">Sin revisar</span>';
  if(st==='exc') return '<span class="mt2-bd w">Sobran '+fmt(e.b+e.m-r.pend)+'</span>';
  if(st==='falta') return '<span class="mt2-bd w">Faltan '+fmt(r.pend-e.b-e.m)+'</span>';
  return '<span class="mt2-bd w" title="El pendiente cambió desde la última revisión">Cambió (era '+fmt(r.pendRev)+')</span>';
}

function _mtrTotales(){
  var t={ pend:0, buen:0, mal:0, falta:0 };
  _MTR.rows.forEach(function(r){
    t.pend+=r.pend;
    if(_mtrEstado(r)==='ok'){ var e=_mtrEf(r); t.buen+=e.b; t.mal+=e.m; } else t.falta++;
  });
  return t;
}
function _mtrKpis(){
  var t=_mtrTotales(), el=document.getElementById('mtr-kpis'); if(!el) return;
  var card=function(k,v,s,c){ return '<div class="sal2-card"><div class="sal2-k">'+k+'</div><div class="sal2-v"'+(c?' style="color:'+c+'"':'')+'>'+v+'<small>und.</small></div><div class="sal2-n">'+s+'</div></div>'; };
  el.innerHTML=card('Pendiente de retiro',fmt(t.pend),_MTR.rows.length+' productos')+
    card('Buen estado',fmt(t.buen),'ya revisado','var(--ok)')+
    card('Mal estado',fmt(t.mal),'ya revisado','var(--danger)')+
    '<div class="sal2-card"><div class="sal2-k">Por revisar</div><div class="sal2-v">'+t.falta+'<small>SKU</small></div><div class="sal2-n">sin revisar, incompletos o que cambiaron</div></div>';
}

function mtRevVista(v){ _MTR.vista=v; mtRevPintar(); }
function mtRevBuscar(v){ _MTR.q=v||''; _mtrTabla(); }

function mtRevPintar(){
  var host=document.getElementById('mt-rev'); if(!host) return;
  _mtrInjectCss();
  var chips='';
  if(S&&S.rol!=='store'&&_MTR.sedes.length>1)
    chips='<div class="mta-chips">'+_MTR.sedes.map(function(x){ return '<button class="'+(String(_MTR.sede)===String(x.id)?'on':'')+'" onclick="mtRevSede('+x.id+')">'+esc(x.nombre)+'</button>'; }).join('')+'</div>';
  var ico='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var seg=function(k,t){ return '<button class="'+(_MTR.vista===k?'on':'')+'" onclick="mtRevVista(\''+k+'\')">'+t+'</button>'; };
  var barra='<div class="mtr-bar"><div class="sal2-seg">'+seg('rev','Revisar')+seg('buen','Buen estado')+seg('mal','Mal estado')+'</div>';
  if(_MTR.vista==='rev')
    barra+='<div class="sal2-srch">'+icoBuscar+'<input id="mtr-busq" placeholder="Buscar SKU o producto…" value="'+esc(_MTR.q)+'" oninput="mtRevBuscar(this.value)"/></div>'+
      '<button id="mtr-guardar" class="sal2-exp" onclick="mtRevGuardar()"'+(S&&S.rol==='invitado'?' disabled':'')+'>Guardar revisión</button>';
  else
    barra+='<span style="flex:1"></span><button class="sal2-exp" onclick="exportMtRevision()">'+ico+'Exportar Excel</button>';
  barra+='</div>';
  host.innerHTML=chips+'<div class="mtr-kpis" id="mtr-kpis"></div>'+barra+'<div id="mtr-tabla"></div>';
  _mtrKpis(); _mtrTabla();
}

function _mtrTabla(){
  var host=document.getElementById('mtr-tabla'); if(!host) return;
  if(!_MTR.rows.length){ host.innerHTML='<div class="mta-vacio">No hay mermas pendientes de retiro en esta sede.</div>'; return; }
  if(_MTR.vista!=='rev'){ host.innerHTML=_mtrLista(_MTR.vista); return; }
  var q=_MTR.q.toLowerCase().trim(), ro=S&&S.rol==='invitado';
  var h='<div class="mtr-wrap"><div class="mtr-t"><div class="h">Producto</div><div class="h r">Pendiente</div><div class="h r">Buen estado</div><div class="h r">Mal estado</div><div class="h c">Atajos</div><div class="h c">Estado</div>';
  var hay=0;
  _MTR.rows.forEach(function(r,i){
    if(q&&(r.sku+' '+r.desc).toLowerCase().indexOf(q)<0) return;
    hay++;
    var e=_mtrEf(r);
    h+='<div class="mtr-p"><b title="'+esc(r.desc)+'">'+esc(r.desc||r.sku)+'</b><span>'+esc(r.sku)+'</span></div>'+
      '<div class="r"><b>'+fmt(r.pend)+'</b></div>'+
      '<div class="r"><input class="mtr-in" type="number" min="0" inputmode="numeric" id="mtr-b-'+i+'" value="'+(e.b===null?'':e.b)+'" oninput="mtRevEd('+i+',\'b\',this.value)"'+(ro?' disabled':'')+'/></div>'+
      '<div class="r"><input class="mtr-in" type="number" min="0" inputmode="numeric" id="mtr-m-'+i+'" value="'+(e.m===null?'':e.m)+'" oninput="mtRevEd('+i+',\'m\',this.value)"'+(ro?' disabled':'')+'/></div>'+
      '<div class="mtr-atajo"><button onclick="mtRevTodo('+i+',\'b\')"'+(ro?' disabled':'')+'>Todo OK</button><button onclick="mtRevTodo('+i+',\'m\')"'+(ro?' disabled':'')+'>Todo mal</button></div>'+
      '<div class="c" id="mtr-e-'+i+'">'+_mtrBadge(r)+'</div>';
  });
  h+='</div></div>';
  host.innerHTML=hay?h:'<div class="mta-vacio">Sin resultados.</div>';
}

/* Al escribir un lado, el otro se completa solo (buen + mal = pendiente) */
function mtRevEd(i,campo,v){
  var r=_MTR.rows[i]; if(!r) return;
  var n=(v===''||v===null)?null:Math.max(0,parseInt(v,10)||0);
  var otro=n===null?null:r.pend-n;
  if(otro!==null&&otro<0) otro=0;
  _MTR.ed[r.sku]=campo==='b'?{ b:n, m:otro }:{ b:otro, m:n };
  var e=_MTR.ed[r.sku];
  var ib=document.getElementById('mtr-b-'+i), im=document.getElementById('mtr-m-'+i);
  if(campo==='b'&&im) im.value=e.m===null?'':e.m;
  if(campo==='m'&&ib) ib.value=e.b===null?'':e.b;
  _mtrFilaActualizar(i);
}
function mtRevTodo(i,lado){
  var r=_MTR.rows[i]; if(!r) return;
  _MTR.ed[r.sku]=lado==='b'?{ b:r.pend, m:0 }:{ b:0, m:r.pend };
  var e=_MTR.ed[r.sku], ib=document.getElementById('mtr-b-'+i), im=document.getElementById('mtr-m-'+i);
  if(ib) ib.value=e.b; if(im) im.value=e.m;
  _mtrFilaActualizar(i);
}
function _mtrFilaActualizar(i){
  var r=_MTR.rows[i], el=document.getElementById('mtr-e-'+i);
  if(el) el.innerHTML=_mtrBadge(r);
  _mtrKpis();
}

function mtRevGuardar(){
  var envio=[], malas=0;
  _MTR.rows.forEach(function(r){
    var e=_MTR.ed[r.sku]; if(!e) return;
    if(_mtrEstado(r)!=='ok'){ malas++; return; }
    if(r.revisado&&r.buen===e.b&&r.mal===e.m&&r.pendRev===r.pend) return;
    envio.push({ sku:r.sku, desc:r.desc, buen:e.b, mal:e.m });
  });
  if(malas){ showToast(malas+(malas===1?' producto no suma':' productos no suman')+' lo pendiente: corrígelos antes de guardar','err'); return; }
  if(!envio.length){ showToast('No hay cambios que guardar','err'); return; }
  var btn=document.getElementById('mtr-guardar'), orig=btn?btn.innerHTML:'';
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
  google.script.run
    .withSuccessHandler(function(r){
      if(btn){ btn.disabled=false; btn.innerHTML=orig; }
      if(_handleExpired(r,'mt-rev')) return;
      if(!r||!r.ok){ showToast(r?r.error:'Error al guardar','err'); return; }
      showToast('Revisión guardada ('+r.guardados+' productos)','ok');
      _MTR.ed={}; mtRevCargar();
      _FORCE_REFRESH['mt']=true;   // la lista de Registros muestra el estado: se vuelve a pedir la próxima vez
    })
    .withFailureHandler(function(e){ if(btn){ btn.disabled=false; btn.innerHTML=orig; } showToast(e.message,'err'); })
    .guardarMTRevision(S.token,_MTR.sede||null,envio);
}

/* Listas de lo ya guardado: una de buen estado y otra de mal estado */
function _mtrFilas(cual){
  var out=[];
  _MTR.rows.forEach(function(r){
    if(!r.revisado) return;
    var c=cual==='buen'?r.buen:r.mal;
    if(c>0) out.push({ sku:r.sku, desc:r.desc, c:c, cambio:r.pendRev!==r.pend });
  });
  return out;
}
function _mtrLista(cual){
  var f=_mtrFilas(cual), tot=f.reduce(function(s,x){return s+x.c;},0), cambios=f.filter(function(x){return x.cambio;}).length;
  if(!f.length) return '<div class="mta-vacio">Todavía no hay productos guardados en '+(cual==='buen'?'buen':'mal')+' estado.</div>';
  var h='<div class="mtr-wrap"><div class="mtr-t lst"><div class="h">SKU</div><div class="h">Descripción</div><div class="h r">Cantidad</div>';
  f.forEach(function(x){ h+='<div>'+esc(x.sku)+'</div><div>'+esc(x.desc)+(x.cambio?' <span class="mt2-bd w">Cambió el pendiente</span>':'')+'</div><div class="r">'+fmt(x.c)+'</div>'; });
  h+='<div></div><div class="mtr-tot">TOTAL · '+f.length+' productos</div><div class="r mtr-tot">'+fmt(tot)+'</div></div></div>';
  if(cambios) h+='<div class="mtr-nota">'+cambios+(cambios===1?' producto cambió':' productos cambiaron')+' su pendiente después de revisarse. Vuelve a revisarlos en la pestaña Revisar.</div>';
  return h;
}

function exportMtRevision(){
  var hoja=function(nombre,cual){
    var rows=_mtrFilas(cual), tot=rows.reduce(function(s,x){return s+x.c;},0);
    if(rows.length) rows.push({ sku:'', desc:'TOTAL', c:tot });
    return { nombre:nombre, headers:['SKU','Descripción','Cantidad'], rows:rows, colWidths:[{wch:12},{wch:70},{wch:12}],
      mapFn:function(r){ return [r.sku?Number(r.sku)||r.sku:'',r.desc,r.c]; } };
  };
  var hojas=[hoja('Buen estado','buen'),hoja('Mal estado','mal')];
  if(!hojas[0].rows.length&&!hojas[1].rows.length){ showToast('Aún no hay revisiones guardadas para exportar','err'); return; }
  _exportMultiHoja(hojas,'mt_revision_'+String(_MTR.sedeNombre||'sede').toLowerCase().replace(/[^a-z0-9]+/g,'_'));
}
