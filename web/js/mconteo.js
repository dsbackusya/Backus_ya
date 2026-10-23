/* Maestro de Conteo (EAN -> SKU) — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   MAESTRO DE CONTEO (MCONTEO): EAN -> SKU, producto y multiplicador
══════════════════════════════════════ */
var MCONTEO={data:[],vista:[]};
var _MC_EDIT=null;   // id de la fila que se edita (null = nueva)
var _MC_AL_GUARDAR=null; // qué hacer al guardar (p. ej. volver a resolver el código en Conteo)

function _setSbGrp(abrir){
  var grp=document.getElementById('sb-grp-maestro'); if(!grp) return;
  grp.classList.toggle('open',!!abrir);
  var hd=document.getElementById('nav-maestro-grp'); if(hd) hd.setAttribute('aria-expanded',abrir?'true':'false');
}
function toggleSbGrp(){
  var grp=document.getElementById('sb-grp-maestro'); if(!grp) return;
  _setSbGrp(!grp.classList.contains('open'));
}

function loadMconteo(){
  if(!S||!S.token){errBox('mconteo-root','Sin sesión activa. Recarga la página.','mconteo');PAGE_LOADING['mconteo']=false;return;}
  var t=(REQ_TOKEN.mconteo=(REQ_TOKEN.mconteo||0)+1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t!==REQ_TOKEN.mconteo) return;
      PAGE_LOADING['mconteo']=false;
      renderMconteo(r);
    })
    .withFailureHandler(function(e){
      if(t!==REQ_TOKEN.mconteo) return;
      PAGE_LOADING['mconteo']=false;errBox('mconteo-root',e.message,'mconteo');
    })
    .getMConteo(S.token);
}

function renderMconteo(r){
  if(_handleExpired(r,'mconteo-root')) return;
  if(!r||!r.ok){errBox('mconteo-root',r&&r.error?r.error:'Error al cargar el maestro de conteo','mconteo');return;}
  MCONTEO.data=r.data;
  DATA.mconteo=r.data;
  var ico='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12"/></svg>';
  var skus={}; MCONTEO.data.forEach(function(m){ skus[m.sku]=true; });
  var nSku=Object.keys(skus).length;
  var sinProd=MCONTEO.data.filter(function(m){return !m.producto;}).length;
  var icoExportar='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  document.getElementById('mconteo-root').innerHTML=
    '<div class="stats">'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">Códigos EAN</div><div class="stat-val-row"><div class="stat-val">'+fmt(MCONTEO.data.length)+'</div><span class="stat-unit-pill">filas</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">SKU distintos</div><div class="stat-val-row"><div class="stat-val">'+fmt(nSku)+'</div><span class="stat-unit-pill">sku</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">Sin nombre de producto</div><div class="stat-val-row"><div class="stat-val" style="color:'+(sinProd?'var(--warn)':'inherit')+'">'+fmt(sinProd)+'</div><span class="stat-unit-pill">filas</span></div></div>'+
    '</div>'+
    '<div class="sal2-pnl">'+
    '<div class="sal2-fl">'+
      '<div class="sal2-srch"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="mc-busq" placeholder="Buscar EAN, SKU, SAP o producto..." oninput="filterMconteo()"/></div>'+
      '<span class="sal2-cnt" id="mc-count"></span>'+
      '<button id="btn-export-mconteo" class="sal2-exp" onclick="exportMconteo()">'+icoExportar+'Exportar</button>'+
    '</div>'+
    '<div class="table-wrap"><table style="min-width:0">'+
      '<thead><tr><th>EAN</th><th>SKU</th><th class="col-hide-mobile">SAP</th><th>Producto</th><th class="r">Multiplicador</th><th class="c">Acciones</th></tr></thead>'+
      '<tbody id="mconteo-tbody"></tbody>'+
    '</table></div>'+
    '</div>';
  filterMconteo();
}

function filterMconteo(){
  var q=((document.getElementById('mc-busq')||{}).value||'').toLowerCase().trim();
  var rows=MCONTEO.data.filter(function(m){
    return !q||m.ean.toLowerCase().indexOf(q)>-1||m.sku.toLowerCase().indexOf(q)>-1||
      m.sap.toLowerCase().indexOf(q)>-1||m.producto.toLowerCase().indexOf(q)>-1;
  });
  var MAX=500, total=rows.length;
  if(rows.length>MAX) rows=rows.slice(0,MAX);
  MCONTEO.vista=rows;
  var el=document.getElementById('mc-count');
  if(el) el.textContent=total>MAX ? ('Mostrando '+MAX+' de '+total+' — usa el buscador') : (total+' registros');
  var html=rows.map(function(m,i){
    return '<tr style="cursor:pointer" title="Tocar para editar" onclick="abrirMConteoForm('+i+')">'+
      '<td class="mono" style="font-weight:600">'+esc(m.ean)+'</td>'+
      '<td class="mono">'+esc(m.sku||'—')+'</td>'+
      '<td class="mono col-hide-mobile" style="color:var(--text3)">'+esc(m.sap||'—')+'</td>'+
      '<td class="td-desc" title="'+esc(m.producto)+'">'+(m.producto?esc(m.producto):'<span style="color:var(--text3)">—</span>')+'</td>'+
      '<td class="r">'+fmt(m.multiplicador)+'</td>'+
      '<td class="c" style="white-space:nowrap">'+
        '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();abrirMConteoForm('+i+')">Editar</button> '+
        '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="event.stopPropagation();eliminarMConteoFila('+i+')">Eliminar</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  var t=document.getElementById('mconteo-tbody');
  if(t) t.innerHTML=html||'<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:40px">Sin resultados</td></tr>';
}

/* idx = posición en la vista filtrada; null = nuevo */
function abrirMConteoForm(idx,eanPrefill,alGuardar){
  var m=(idx===null||idx===undefined)?null:MCONTEO.vista[idx];
  _MC_EDIT=m?m.id:null;
  _MC_AL_GUARDAR=alGuardar||null;
  document.getElementById('mc-buscar').value='';
  document.getElementById('mc-stock-sel').innerHTML='';
  document.getElementById('ac-mc').classList.remove('open');
  document.getElementById('fs-mconteo-title').textContent=m?'Editar maestro de conteo':'Agregar al maestro de conteo';
  document.getElementById('mc-ean').value=m?m.ean:(eanPrefill||'');
  document.getElementById('mc-sku').value=m?m.sku:'';
  document.getElementById('mc-producto').value=m?m.producto:'';
  document.getElementById('mc-sap').value=m?m.sap:'';
  document.getElementById('mc-mult').value=m?m.multiplicador:1;
  document.getElementById('mc-err').textContent='';
  mconteoEanCambio();
  mconteoSkuCambio();
  openFS('fs-mconteo');
  setTimeout(function(){document.getElementById(m||eanPrefill?'mc-buscar':'mc-ean').focus();},120);
}

/* Elegir un producto del Stock: completa SKU y nombre; si el SKU ya tiene otro EAN, copia también SAP y multiplicador */
function mconteoElegirStock(idx){
  var item=(AC_CACHE['ac-mc']||[])[idx];
  if(!item) return;
  document.getElementById('ac-mc').classList.remove('open');
  document.getElementById('mc-buscar').value='';
  document.getElementById('mc-sku').value=item.sku;
  document.getElementById('mc-producto').value=item.desc;
  document.getElementById('mc-stock-sel').innerHTML='<span style="color:var(--text3)">'+ICO('right',12)+esc(item.sku)+' · '+esc(item.desc)+'</span>';
  mconteoSkuCambio();
  var otro=MCONTEO.data.filter(function(m){return m.id!==_MC_EDIT&&m.sku.toLowerCase()===String(item.sku).toLowerCase();})[0];
  if(otro){ document.getElementById('mc-sap').value=otro.sap; document.getElementById('mc-mult').value=otro.multiplicador; }
  var e=document.getElementById('mc-ean');
  var sig=document.getElementById(e.value?'mc-mult':'mc-ean'); sig.focus(); if(sig.select) sig.select();
}

/* Desde Conteo: un código que no está en el maestro se asocia a un producto del Stock y se vuelve a resolver */
function cntAsociarEAN(){
  var ean=(document.getElementById('cnt-ean').value||'').trim();
  ean=/[eE]/.test(ean)?String(Math.round(Number(ean))):ean.replace(/\.0+$/,'');
  if(!MCONTEO.data.length && _MCONTEO_LOCAL) MCONTEO.data=_MCONTEO_LOCAL; // para copiar datos de un SKU que ya tiene otro EAN
  abrirMConteoForm(null,ean,function(){
    var inp=document.getElementById('cnt-ean'); if(inp) inp.value=ean;
    _cargarMConteo(function(){ resolverEAN(); },true);
  });
}

/* Avisa si el EAN escrito o escaneado ya existe en el maestro */
function mconteoEanCambio(){
  var inp=document.getElementById('mc-ean');
  var v=(inp.value||'').replace(/\s+/g,'');
  if(v!==inp.value) inp.value=v;
  var el=document.getElementById('mc-ean-info');
  var otro=v&&MCONTEO.data.filter(function(m){return m.id!==_MC_EDIT&&m.ean===v;})[0];
  el.innerHTML=otro
    ? '<span style="color:var(--warn)">'+ICO('warn',12)+'Este EAN ya está en el maestro: '+esc(otro.producto||otro.sku)+' (SKU '+esc(otro.sku)+')</span>'
    : '';
}

/* Si el SKU ya está en el maestro con otro EAN, ofrece su nombre y multiplicador */
function mconteoSkuCambio(){
  var sku=(document.getElementById('mc-sku').value||'').trim().toLowerCase();
  var el=document.getElementById('mc-sku-info');
  if(!sku){el.innerHTML='';return;}
  var otro=MCONTEO.data.filter(function(m){return m.id!==_MC_EDIT&&m.sku.toLowerCase()===sku;})[0];
  el.innerHTML=otro
    ? '<span style="color:var(--text3)">'+ICO('right',12)+'Ya está con otro EAN: '+esc(otro.producto||otro.sku)+' · x'+fmt(otro.multiplicador)+
      ' <a href="#" onclick="mconteoCopiarSku();return false" style="color:var(--accent);font-weight:600">Usar estos datos</a></span>'
    : '';
}
function mconteoCopiarSku(){
  var sku=(document.getElementById('mc-sku').value||'').trim().toLowerCase();
  var otro=MCONTEO.data.filter(function(m){return m.id!==_MC_EDIT&&m.sku.toLowerCase()===sku;})[0];
  if(!otro) return;
  document.getElementById('mc-producto').value=otro.producto;
  document.getElementById('mc-sap').value=otro.sap;
  document.getElementById('mc-mult').value=otro.multiplicador;
}

function guardarMConteoForm(){
  var ean =(document.getElementById('mc-ean').value ||'').trim();
  var sku =(document.getElementById('mc-sku').value ||'').trim();
  var prod=(document.getElementById('mc-producto').value||'').trim();
  var sap =(document.getElementById('mc-sap').value ||'').trim();
  var mult=Number(document.getElementById('mc-mult').value);
  var err =document.getElementById('mc-err');
  if(!ean){err.textContent='El EAN es obligatorio';return;}
  if(!sku){err.textContent='El SKU es obligatorio';return;}
  if(!(mult>0)){err.textContent='El multiplicador debe ser mayor a 0';return;}
  err.textContent='';
  var btn=document.getElementById('btn-mc-save');
  btn.disabled=true;btn.textContent='Guardando...';
  var eraNuevo=(_MC_EDIT===null);
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Guardar';
      if(!r.ok){err.textContent=r.error;return;}
      closeFS('fs-mconteo');
      showToast('Maestro de conteo actualizado','ok');
      _mconteoInvalidarConteo();
      loadMconteo();
      if(_MC_AL_GUARDAR){ var f=_MC_AL_GUARDAR; _MC_AL_GUARDAR=null; f(); return; }
      // el producto nuevo queda a la vista: se filtra por su EAN
      if(eraNuevo) setTimeout(function(){ var b=document.getElementById('mc-busq'); if(b){b.value=ean;filterMconteo();} },400);
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Guardar';err.textContent=e.message;})
    .guardarMConteo(S.token,{id:_MC_EDIT,ean:ean,sku:sku,producto:prod,sap:sap,multiplicador:mult});
}

function eliminarMConteoFila(i){
  var m=MCONTEO.vista[i]; if(!m) return;
  _confirmDialog('Eliminar del maestro de conteo',
    'El EAN '+m.ean+(m.producto?' ('+m.producto+')':'')+' se quitará del maestro. Al escanearlo en Conteo ya no se reconocerá. Los conteos registrados no cambian.',
    function(){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){showToast(r.error||'No se pudo eliminar','err');return;}
          showToast('Eliminado del maestro de conteo','ok');
          _mconteoInvalidarConteo();
          loadMconteo();
        })
        .withFailureHandler(function(e){showToast(e.message,'err');})
        .eliminarMConteo(S.token,m.id);
    },'Eliminar');
}

// La pantalla de Conteo guarda una copia del maestro; hay que descartarla para que tome los cambios.
function _mconteoInvalidarConteo(){
  _MCONTEO_LOCAL=null; _MCONTEO_PENDING=[]; _MCONTEO_EAN_IDX={}; _MCONTEO_SKU_IDX={};
  try{ localStorage.removeItem('ds_mconteo_cache_v1'); }catch(e){}
}

function exportMconteo(){
  _exportXLSX(
    ['EAN','DYNAMICS','SAP','PRODUCTO','MULTIPLICADOR'],
    MCONTEO.data,
    function(m){return[m.ean,m.sku,m.sap,m.producto,m.multiplicador];},
    'MCONTEO','maestro_conteo'
  );
}
