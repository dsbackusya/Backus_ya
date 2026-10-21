/* Pantalla Mermas y Traslados — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   M-T
══════════════════════════════════════ */
function loadMT(){
  if(!S||!S.token){errBox('mt-root','Sin sesión activa. Recarga la página.','mt');PAGE_LOADING['mt']=false;return;}
  var force=!!_FORCE_REFRESH['mt']; _FORCE_REFRESH['mt']=false;
  var t = (REQ_TOKEN.mt = (REQ_TOKEN.mt||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.mt) return;
      PAGE_LOADING['mt']=false; renderMT(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.mt) return;
      PAGE_LOADING['mt']=false; errBox('mt-root',e.message,'mt');
    })
    .getMT(S.token, force, window.mt_rango||null);
}

/* ── M-T: tipos normalizados, KPI globales del período y filas agrupadas por día ── */
var _MT_TIPO='', _MT_EST='';
function _mtTipo(r){
  var u=String(r.tipo||'').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(u==='MERMA') return 'MERMA';
  if(u==='TRASLADO') return 'TRASLADO';
  if(u==='NC'||u.indexOf('NOTA DE CRED')===0) return 'NC';
  return 'OTROS';
}
function _mtPend(r){ return String(r.estado||'').trim().toLowerCase()!=='retirado'; }
function _mtMoney(n){ return 'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _mtSum(a,k){ return a.reduce(function(s,x){return s+(Number(x[k])||0);},0); }
function _mtFechaKey(f){ var p=String(f||'').split('/'); return p.length===3?p[2]+p[1]+p[0]:''; }
function _mtBase(){ return _applyFiltroFecha('mt', DATA.mt||[]); }

function _mtFiltrados(){
  var q=((document.getElementById('mt-busq')||{}).value||'').toLowerCase().trim();
  var rows=_mtBase().filter(function(r){
    if(_MT_TIPO && _mtTipo(r)!==_MT_TIPO) return false;
    if(_MT_EST){
      var t=_mtTipo(r); if(t!=='MERMA'&&t!=='NC') return false;
      if(_MT_EST==='pen'?!_mtPend(r):_mtPend(r)) return false;
    }
    return !q||[r.sku,r.desc,r.motivo,r.obs,r.nroFactura].some(function(v){return String(v||'').toLowerCase().indexOf(q)>-1;});
  });
  rows.sort(function(a,b){ var ka=_mtFechaKey(a.fecha), kb=_mtFechaKey(b.fecha); return ka===kb?b._row-a._row:(ka<kb?1:-1); });
  return rows;
}

function _mtBadgeTipo(t,raw){
  if(t==='MERMA') return '<span class="mt2-bd m">MERMA</span>';
  if(t==='TRASLADO') return '<span class="mt2-bd t">TRASLADO</span>';
  if(t==='NC') return '<span class="mt2-bd nc">NC</span>';
  return '<span class="mt2-bd n">'+esc(raw||'SIN TIPO')+'</span>';
}
function _mtBadgeEstado(r,t){
  if(t!=='MERMA'&&t!=='NC') return '<span class="mt2-bd n">—</span>';
  return _mtPend(r)?'<span class="mt2-bd w">Pendiente</span>':'<span class="mt2-bd ok">Retirado</span>';
}

function _mtDiaLabel(f){
  var p=String(f||'').split('/'); if(p.length!==3) return f||'Sin fecha';
  var d=new Date(+p[2],+p[1]-1,+p[0]), h=new Date(); h.setHours(0,0,0,0);
  var dif=Math.round((h-d)/86400000);
  var pre=dif===0?'Hoy':dif===1?'Ayer':d.toLocaleDateString('es-PE',{weekday:'long'});
  return pre.charAt(0).toUpperCase()+pre.slice(1)+' · '+f;
}

function _mtMoneyCard(titulo,arr){
  var pen=arr.filter(_mtPend), ret=arr.filter(function(r){return !_mtPend(r);});
  var tot=_mtSum(arr,'costo'), cp=_mtSum(pen,'costo'), pp=tot>0?Math.round(cp/tot*100):0;
  return '<div class="sal2-card mt2-money"><div class="mt2-mh"><div><div class="sal2-k">'+titulo+'</div><div class="sal2-v">'+_mtMoney(tot)+'</div></div>'+
      '<span class="mt2-meta">'+arr.length+(arr.length===1?' registro':' registros')+' · '+fmt(_mtSum(arr,'cant'))+' und.</span></div>'+
    '<div class="mt2-bar">'+(tot>0?'<i style="width:'+pp+'%;background:var(--warn)"></i><i style="width:'+(100-pp)+'%;background:var(--ok)"></i>':'')+'</div>'+
    '<div class="mt2-lg"><div><span><em style="background:var(--warn)"></em>Pendiente</span><b>'+_mtMoney(cp)+'<small>'+fmt(_mtSum(pen,'cant'))+' und.</small></b></div>'+
      '<div><span><em style="background:var(--ok)"></em>Retirado</span><b>'+_mtMoney(_mtSum(ret,'costo'))+'<small>'+fmt(_mtSum(ret,'cant'))+' und.</small></b></div></div></div>';
}
function _mtNcCard(nc){
  var pen=nc.filter(_mtPend);
  return '<div class="sal2-card mt2-money"><div class="sal2-k"><em class="mt2-dot"></em>Notas de crédito pendientes</div><div class="sal2-v">'+_mtMoney(_mtSum(pen,'costo'))+'</div>'+
    '<div class="mt2-lg" style="margin-top:14px"><div><span>Pendientes</span><b>'+pen.length+'<small>NC</small></b></div><div><span>Unidades</span><b>'+fmt(_mtSum(pen,'cant'))+'<small>und.</small></b></div></div>'+
    '<div class="sal2-n" style="color:var(--text4)">Las NC retiradas no suman al costo</div></div>';
}

function renderMT(r){
  if(_handleExpired(r,'mt-root')) return;
  if(!r||!r.ok){errBox('mt-root',r?r.error:'Error desconocido','mt');return;}
  DATA.mt=r.data;
  _MT_TIPO=''; _MT_EST='';
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  document.getElementById('mt-root').innerHTML=
    '<div class="mt2-note">'+ICO('info',13)+'Resumen del período · no cambia con el filtro de tipo ni la búsqueda</div>'+
    '<div class="sal2-sum mt2-sum" id="mt-kpis"></div>'+
    '<div class="sal2-fl">'+
      '<div class="sal2-srch">'+icoBuscar+'<input id="mt-busq" placeholder="Buscar SKU, producto o motivo…" oninput="filterMT()"/></div>'+
      _fechaFiltroHTML('mt','filterMT','mtRangoCambio')+
      '<div class="sal2-seg" id="mt-tipo-seg"></div>'+
      '<div class="sal2-seg" id="mt-est-seg"></div>'+
      '<span class="sal2-cnt" id="mt-count"></span>'+
    '</div>'+
    '<div class="mt2-tw" id="mt-list"></div>';
  _initFiltroFecha('mt','filterMT',{page:'mt'});
  filterMT();
}
function mtSetTipo(k){ _MT_TIPO=(_MT_TIPO===k?'':k); _filterMT(); }
function mtSetEst(k){ _MT_EST=(_MT_EST===k?'':k); _filterMT(); }

function _filterMT(){
  var base=_mtBase();
  var mer=base.filter(function(r){return _mtTipo(r)==='MERMA';});
  var tra=base.filter(function(r){return _mtTipo(r)==='TRASLADO';});
  var nc =base.filter(function(r){return _mtTipo(r)==='NC';});
  var oth=base.filter(function(r){return _mtTipo(r)==='OTROS';});

  var el=document.getElementById('mt-kpis');
  if(el) el.innerHTML=_mtMoneyCard('Costo de merma',mer)+_mtNcCard(nc)+
    '<div class="sal2-card"><div class="sal2-k">Traslados</div><div class="sal2-v">'+fmt(_mtSum(tra,'cant'))+'<small>und.</small></div><div class="sal2-n">'+tra.length+(tra.length===1?' movimiento':' movimientos')+'</div></div>'+
    '<div class="sal2-card"><div class="sal2-k">Registros</div><div class="sal2-v">'+base.length+'<small>mov.</small></div><div class="sal2-n">'+mer.length+' mermas · '+nc.length+' NC · '+tra.length+' trasl.'+(oth.length?' · '+oth.length+' otros':'')+'</div></div>';

  var sg=function(k,txt,n){return '<button class="'+(_MT_TIPO===k?'on':'')+'" onclick="mtSetTipo(\''+k+'\')">'+txt+'<span>'+n+'</span></button>';};
  var sgt=document.getElementById('mt-tipo-seg');
  if(sgt) sgt.innerHTML='<button class="'+(_MT_TIPO===''?'on':'')+'" onclick="mtSetTipo(\'\')">Todos<span>'+base.length+'</span></button>'+
    sg('MERMA','Mermas',mer.length)+sg('TRASLADO','Traslados',tra.length)+sg('NC','NC',nc.length)+((oth.length||_MT_TIPO==='OTROS')?sg('OTROS','Otros',oth.length):'');
  var se=document.getElementById('mt-est-seg');
  if(se) se.innerHTML='<button class="'+(_MT_EST===''?'on':'')+'" onclick="mtSetEst(\'\')">Cualquier estado</button>'+
    '<button class="'+(_MT_EST==='pen'?'on':'')+'" onclick="mtSetEst(\'pen\')">Pendiente</button>'+
    '<button class="'+(_MT_EST==='ret'?'on':'')+'" onclick="mtSetEst(\'ret\')">Retirado</button>';

  var rows=_mtFiltrados();
  var cnt=document.getElementById('mt-count'); if(cnt) cnt.textContent=rows.length+' registros';

  window._MT_ROWS={};
  var html='', grupo=null, gAcum=[];
  var cierra=function(){ if(grupo!==null) html=html.replace('<!--g'+grupo+'-->','<em>'+gAcum.length+' mov. · '+fmt(_mtSum(gAcum,'cant'))+' und.</em>'); };
  rows.forEach(function(r){
    window._MT_ROWS[r._row]=r;
    var t=_mtTipo(r), k=r.fecha||'';
    if(k!==grupo){ cierra(); grupo=k; gAcum=[]; html+='<div class="mt2-grp">'+esc(_mtDiaLabel(k))+'<!--g'+k+'--></div>'; }
    gAcum.push(r);
    var sc=t==='MERMA'?'var(--danger)':t==='NC'?'#5CC8E0':t==='TRASLADO'?'var(--accent)':'var(--text4)';
    html+='<div class="mt2-tr mt2-row" style="--sc:'+sc+'">'+
      '<div class="mt2-p"><b title="'+esc(r.desc)+'">'+esc(r.desc)+'</b><span>'+esc(r.sku)+'</span></div>'+
      '<div class="mt2-t">'+_mtBadgeTipo(t,r.tipo)+'</div>'+
      '<div class="mt2-q">'+fmt(r.cant)+'<small> und.</small></div>'+
      '<div class="mt2-c">'+(r.costo?_mtMoney(r.costo):'—')+'</div>'+
      '<div class="mt2-m"><b>'+esc(r.motivo||'—')+'</b>'+(r.obs?'<span>'+esc(r.obs)+'</span>':'')+'</div>'+
      '<div class="mt2-e">'+_mtBadgeEstado(r,t)+'</div>'+
      '<div class="mt2-f'+((r.nroFactura||r.fechaRetiro)?'':' mt2-vacio')+'"><b>'+esc(r.nroFactura||'—')+'</b>'+(r.fechaRetiro?'<span>Retiro '+esc(r.fechaRetiro)+'</span>':'')+'</div>'+
      '<div class="mt2-a"><button class="mt2-ib" title="Editar" onclick="editarMTRow('+r._row+')">'+ICO('edit',14,'s')+'</button>'+
        '<button class="mt2-ib d" title="Eliminar" onclick="eliminarMTRow('+r._row+')">'+ICO('trash',14,'s')+'</button></div>'+
    '</div>';
  });
  cierra();
  var lst=document.getElementById('mt-list');
  if(lst) lst.innerHTML=rows.length?
    '<div class="mt2-tr mt2-h"><div>Producto</div><div class="c">Tipo</div><div class="r">Cant.</div><div class="r">Costo</div><div>Motivo</div><div class="c">Estado</div><div>Factura / NC</div><div></div></div>'+html
    :'<div class="mt2-vacio-t">Sin registros</div>';
}

function exportMT(){
  if(S&&S.rol!=='store'){
    var HDR=['Fecha','SKU','Descripción','Cantidad','Costo','Tipo','Motivo','Observaciones','Estado','Nro de factura','Fecha del retiro'];
    var CW=[{wch:12},{wch:14},{wch:36},{wch:10},{wch:12},{wch:10},{wch:20},{wch:24},{wch:12},{wch:16},{wch:14}];
    _exportConSpinner('btn-export-mt','mt',function(sedes){
      _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:HDR,rows:s.data,colWidths:CW,
        mapFn:function(r){return[r.fecha,r.sku,r.desc,r.cant,r.costo||0,r.tipo,r.motivo||'',r.obs||'',r.estado||'',r.nroFactura||'',r.fechaRetiro||''];}};}),'mt_sedes');
    });return;
  }
  var rows=_getFilteredRows('mt');
  _exportXLSX(['Fecha','SKU','Descripción','Cantidad','Costo','Tipo','Motivo','Observaciones','Estado','Nro de factura','Fecha del retiro'],
    rows,function(r){return[r.fecha,r.sku,r.desc,r.cant,r.costo||0,r.tipo,r.motivo||'',r.obs||'',r.estado||'',r.nroFactura||'',r.fechaRetiro||''];},'M-T','mermas_traslados');
}

function abrirNuevoMT(){
  document.getElementById('mt-row').value='';
  document.getElementById('mt-tipo').value='';
  document.getElementById('mt-sku').value='';
  document.getElementById('mt-desc').value='';
  document.getElementById('mt-cant').value='';
  document.getElementById('mt-motivo').value='';
  document.getElementById('mt-obs').value='';
  document.getElementById('mt-nro-factura').value='';
  document.getElementById('mt-fecha-retiro').value='';
  document.getElementById('mt-err').textContent='';
  document.getElementById('fs-mt-title').textContent='Registrar M-T';
  var btn=document.getElementById('btn-mt-save');
  if(btn) btn.textContent='Guardar movimiento';
  openFS('fs-mt');
}

function guardarMT(){
  var rowNum = document.getElementById('mt-row').value;
  var tipo   = document.getElementById('mt-tipo').value;
  var sku    = document.getElementById('mt-sku').value.trim();
  var cant   = document.getElementById('mt-cant').value;
  var err    = document.getElementById('mt-err');
  if(!tipo||!sku||!cant){err.textContent='Tipo, SKU y Cantidad son obligatorios';return;}
  var fila   = {tipo:tipo,sku:sku,desc:document.getElementById('mt-desc').value,
    cant:Number(cant),motivo:document.getElementById('mt-motivo').value,
    obs:document.getElementById('mt-obs').value,
    nroFactura:document.getElementById('mt-nro-factura').value.trim(),
    fechaRetiro:document.getElementById('mt-fecha-retiro').value};
  err.textContent='';
  var btn = document.getElementById('btn-mt-save');
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
  var onOk = function(r){
    if(btn){ btn.disabled=false; btn.textContent=rowNum?'Guardar cambios':'Guardar movimiento'; }
    onSaved(r,'fs-mt','mt',null,'');
    // reset form a modo nuevo
    document.getElementById('mt-row').value='';
    document.getElementById('fs-mt-title').textContent='Registrar M-T';
    if(btn) btn.textContent='Guardar movimiento';
  };
  var onErr = function(e){
    if(btn){ btn.disabled=false; btn.textContent=rowNum?'Guardar cambios':'Guardar movimiento'; }
    err.textContent=e.message;
  };
  if(rowNum){
    google.script.run.withSuccessHandler(onOk).withFailureHandler(onErr).editarMT(S.token,Number(rowNum),fila);
  } else {
    google.script.run.withSuccessHandler(onOk).withFailureHandler(onErr).registrarMT(S.token,fila);
  }
}

function editarMTRow(rowNum){
  var r=(window._MT_ROWS||{})[rowNum];
  if(!r){showToast('Error: no se encontró el registro','err');return;}
  document.getElementById('mt-row').value   = rowNum;
  document.getElementById('mt-tipo').value  = r.tipo||'';
  document.getElementById('mt-sku').value   = r.sku||'';
  document.getElementById('mt-desc').value  = r.desc||'';
  document.getElementById('mt-cant').value  = r.cant||0;
  document.getElementById('mt-motivo').value= r.motivo||'';
  document.getElementById('mt-obs').value   = r.obs||'';
  document.getElementById('mt-nro-factura').value = r.nroFactura||'';
  var frVal='';
  if(r.fechaRetiro){var parts=r.fechaRetiro.split('/');if(parts.length===3) frVal=parts[2]+'-'+parts[1]+'-'+parts[0];}
  document.getElementById('mt-fecha-retiro').value=frVal;
  document.getElementById('mt-err').textContent='';
  document.getElementById('fs-mt-title').textContent='Editar M-T';
  var btn=document.getElementById('btn-mt-save');
  if(btn) btn.textContent='Guardar cambios';
  openFS('fs-mt');
}

function eliminarMTRow(rowNum){
  _confirmDialog('Eliminar registro','Se eliminará este movimiento. Esta acción no se puede deshacer.',function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!r.ok){showToast(r.error,'err');return;}
        showToast('Eliminado','ok');
        reloadPage('mt');
      })
      .withFailureHandler(function(e){showToast(e.message,'err');})
      .eliminarMT(S.token,rowNum);
  },'Eliminar');
}

/* ── HELPER FILTRADO COMPARTIDO — usado por _filterXxx y exportXxx ──
   Evita duplicar la misma lógica de filtro en cada función de exportación. */
function _getFilteredRows(name) {
  if (name === 'stock') {
    var q   = ((document.getElementById('stock-busq')||{}).value||'').toLowerCase();
    var cat = ((document.getElementById('stock-cat') ||{}).value||'');
    var mar = ((document.getElementById('stock-mar') ||{}).value||'');
    return DATA.stock.filter(function(r) {
      return (!q  || r.sku.toLowerCase().indexOf(q)>-1 || r.desc.toLowerCase().indexOf(q)>-1) &&
             (!cat || r.categoria===cat) && (!mar || r.marca===mar);
    });
  }
  if (name === 'salidas') {
    var base = _salBase();
    return _SAL_EST ? base.filter(function(r){return _salEstadoLinea(r)===_SAL_EST;}) : base;
  }
  if (name === 'entradas') {
    var q = ((document.getElementById('ent-busq')||{}).value||'').toLowerCase();
    var rows = DATA.entradas.filter(function(r){
      return !q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||r.factura.toLowerCase().indexOf(q)>-1;
    });
    return _applyFiltroFecha('ent', rows).sort(function(a,b){return b._row-a._row;});
  }
  if (name === 'mt') {
    return _mtFiltrados();
  }
  if (name === 'cancelados') {
    var q = ((document.getElementById('canc-busq')||{}).value||'').toLowerCase();
    var rows = (DATA.cancelados||[]).filter(function(r){
      return !q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||r.nroPedido.toLowerCase().indexOf(q)>-1;
    });
    return _applyFiltroFecha('canc', rows).sort(function(a,b){return b._row-a._row;});
  }
  if (name === 'conteo') {
    var q = ((document.getElementById('cnt-busq')||{}).value||'').toLowerCase();
    var rows = (DATA.conteo||[]).filter(function(r){
      return !q||r.sku.toLowerCase().indexOf(q)>-1||r.producto.toLowerCase().indexOf(q)>-1||r.ean.toLowerCase().indexOf(q)>-1;
    });
    return _applyFiltroFecha('cnt', rows);
  }
  return [];
}
