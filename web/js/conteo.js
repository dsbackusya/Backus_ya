/* Pantalla Conteo — parte de la antigua app.js; se carga en este orden desde index.html */
/* ── CONTEO ── */
// Catálogo MCONTEO cargado en memoria al abrir el formulario.
// Se resuelven EAN y SKU localmente — cero llamadas al servidor por escaneo.
var _MCONTEO_LOCAL   = null;  // null = no cargado aún
var _MCONTEO_PENDING = [];    // queue de callbacks esperando la carga — reemplaza setInterval polling

function _cargarMConteo(cb, force) {
  // Ya cargado y no es recarga forzada: ejecutar callback inmediatamente
  if (_MCONTEO_LOCAL && !force) { if (cb) cb(); return; }
  // Carga en curso (no forzada): encolar callback
  if (!force && _MCONTEO_PENDING !== null) {
    if (cb) _MCONTEO_PENDING.push(cb);
    if (_MCONTEO_PENDING.length > 1) return; // ya hay una petición en vuelo
  }
  // Limpiar localStorage para no servir datos viejos offline
  if (force) try { localStorage.removeItem('ds_mconteo_cache_v1'); } catch(e) {}
  // Iniciar carga (force=true invalida el caché del servidor también)
  google.script.run
    .withSuccessHandler(function(r) {
      if (r && r.ok) {
        _MCONTEO_LOCAL = r.data;
        _MCONTEO_EAN_IDX = {};
        _MCONTEO_SKU_IDX = {};
        r.data.forEach(function(item) {
          _MCONTEO_EAN_IDX[item.ean] = item;
          _MCONTEO_SKU_IDX[item.sku.toLowerCase()] = item;
        });
        // Persistir en localStorage para uso offline
        try { localStorage.setItem('ds_mconteo_cache_v1', JSON.stringify(r.data)); } catch(e) {}
      }
      // Drenar la queue — notificar a todos los callers que estaban esperando
      var pending = _MCONTEO_PENDING.slice();
      _MCONTEO_PENDING = [];
      pending.forEach(function(fn) { try { fn(); } catch(e) {} });
      if (force && cb) { try { cb(); } catch(e) {} }
    })
    .withFailureHandler(function() {
      // En caso de fallo también drenar la queue para no dejar callers colgados
      var pending = _MCONTEO_PENDING.slice();
      _MCONTEO_PENDING = [];
      pending.forEach(function(fn) { try { fn(); } catch(e) {} });
      if (force && cb) { try { cb(); } catch(e) {} }
    })
    .getMConteo(S.token, !!force);
}

// Índices de búsqueda O(1) — populados junto con _MCONTEO_LOCAL
var _MCONTEO_EAN_IDX = {};
var _MCONTEO_SKU_IDX = {};

function loadConteo(){
  if(!S||!S.token){errBox('conteo-root','Sin sesión activa. Recarga la página.','conteo');PAGE_LOADING['conteo']=false;return;}
  var force=!!_FORCE_REFRESH['conteo']; _FORCE_REFRESH['conteo']=false;
  var t = (REQ_TOKEN.conteo = (REQ_TOKEN.conteo||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.conteo) return;
      PAGE_LOADING['conteo']=false;
      if(!r){errBox('conteo-root','Error al conectar con el servidor. Reintenta.','conteo');return;}
      renderConteo(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.conteo) return;
      PAGE_LOADING['conteo']=false;errBox('conteo-root',e.message,'conteo');
    })
    .getConteo(S.token, 7, force, window.cnt_rango||null); // por defecto solo hoy
}

function renderConteo(r){
  if(_handleExpired(r,'conteo-root')) return;
  if(!r||!r.ok){errBox('conteo-root',r?r.error:'Respuesta inválida del servidor');return;}
  DATA.conteo=r.data;
  var totalUnd=r.data.reduce(function(a,x){return a+x.total;},0);
  var skusU=new Set(r.data.map(function(x){ return x.sku; }));

  document.getElementById('conteo-root').innerHTML=
    '<div class="stats">'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg></div><div class="stat-label">Registros</div><div class="stat-val-row"><div class="stat-val" id="cnt-stat-total">'+r.data.length+'</div><span class="stat-unit-pill">filas</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-label">SKUs únicos</div><div class="stat-val-row"><div class="stat-val" id="cnt-stat-skus" style="color:var(--blue)">'+skusU.size+'</div><span class="stat-unit-pill">SKUs</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="stat-label">Unidades contadas</div><div class="stat-val-row"><div class="stat-val" id="cnt-stat-und" style="color:var(--ok)">'+fmt(totalUnd)+'</div><span class="stat-unit-pill">und.</span></div></div>'+
    '</div>'+
    '<div class="filters" style="flex-wrap:wrap;gap:8px;align-items:center">'+
      '<div style="display:flex;gap:6px;align-items:center">'+
        '<input class="filter-inp" id="cnt-busq" placeholder="Buscar SKU, EAN, producto..." style="width:220px" oninput="filterConteo()"/>'+
        '<button class="cam-btn" title="Escanear" onclick="openScannerConteoFiltro()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5a2 2 0 0 1 2-2h1v2H5v1H3V5z"/><path d="M19 5a2 2 0 0 0-2-2h-1v2h2v1h2V5z"/><path d="M3 19a2 2 0 0 0 2 2h1v-2H5v-1H3v1z"/><path d="M19 19a2 2 0 0 1-2 2h-1v-2h2v-1h2v1z"/><line x1="7" y1="12" x2="7" y2="12.01"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="13" y1="9" x2="13" y2="15"/><line x1="16" y1="9" x2="16" y2="15"/><line x1="7" y1="9" x2="7" y2="11"/></svg></button>'+
        '<button class="btn btn-danger btn-sm" id="btn-eliminar-ean-dia" style="display:none;white-space:nowrap" onclick="eliminarEANDia()">'+ICO('x',13)+'Eliminar EAN del día</button>'+
      '</div>'+
      _fechaFiltroHTML('cnt','filterConteo','cntRangoCambio')+
      '<span class="result-count" id="cnt-count"></span>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr>'+
        '<th>Fecha</th><th class="col-hide-mobile">Hora</th><th class="col-hide-mobile">EAN</th><th>SKU/Lovis</th><th>Producto</th>'+
        '<th class="r col-hide-mobile">PACKS</th><th class="r col-hide-mobile">x Mult.</th>'+
        '<th class="r col-hide-mobile">UND PACKS</th><th class="r col-hide-mobile">UNDS</th><th class="r">TOTAL</th><th class="c">Editar</th><th class="c">-</th>'+
      '</tr></thead>'+
      '<tbody id="conteo-tbody"></tbody>'+
    '</table></div>';
  _initFiltroFecha('cnt','filterConteo',{page:'conteo'});
  filterConteo();
}

function _filterConteo(){
  var q=((document.getElementById('cnt-busq')||{}).value||'').toLowerCase();
  var filtered=(DATA.conteo||[]).filter(function(r){
    return !q||r.sku.toLowerCase().indexOf(q)>-1||
           r.producto.toLowerCase().indexOf(q)>-1||
           r.ean.toLowerCase().indexOf(q)>-1;
  });
  filtered=_applyFiltroFecha('cnt',filtered);

  // Actualizar stat cards con los datos filtrados
  var totalUnd=filtered.reduce(function(a,x){return a+x.total;},0);
  var skusU=new Set();
  filtered.forEach(function(x){ skusU.add(x.sku); });
  var st=document.getElementById('cnt-stat-total'); if(st)st.textContent=filtered.length;
  var ss=document.getElementById('cnt-stat-skus');  if(ss)ss.textContent=skusU.size;
  var su=document.getElementById('cnt-stat-und');   if(su)su.textContent=fmt(totalUnd);

  var el=document.getElementById('cnt-count');
  if(el)el.textContent=filtered.length+' registros';

  // Mostrar/ocultar botón "Eliminar EAN del día" según si hay búsqueda activa
  var qTrim=((document.getElementById('cnt-busq')||{}).value||'').trim();
  var btnElimEAN=document.getElementById('btn-eliminar-ean-dia');
  if(btnElimEAN) btnElimEAN.style.display=qTrim?'inline-flex':'none';

  // Agrupar filas por SKU — badge de N conteos + total acumulado visible
  function _calcRow(r){
    var p=r.packs||0, u=r.und||r.total||0, m=1;
    if(p>0){ m=Math.round(u/p)||1; }
    else if(u>0){
      var sn=String(r.sku||'').toLowerCase();
      if(_MCONTEO_SKU_IDX&&_MCONTEO_SKU_IDX[sn]){m=Number(_MCONTEO_SKU_IDX[sn].multiplicador)||1;p=Math.round(u/m);}
      else{m=1;p=u;}
    }
    return {packsReal:p,undReal:u,mult:m};
  }
  var grupos = new Map(); // Map preserva orden de inserción + lookups O(1) sin colisiones de prototype
  // Índice global para evitar interpolación de strings en onclick
  window._CNT_ROWS = {};
  filtered.forEach(function(r){
    var c=_calcRow(r), key=r.sku||r.ean;
    if(!grupos.has(key)){
      grupos.set(key, {sku:r.sku,ean:r.ean,producto:r.producto,mult:c.mult,filas:[],totalUnd:0,totalPacks:0,totalUnds:0});
    }
    var g = grupos.get(key);
    g.filas.push({r:r,packsReal:c.packsReal,undReal:c.undReal,mult:c.mult});
    g.totalUnd+=c.undReal; g.totalPacks+=c.packsReal; g.totalUnds+=Number(r.unds||0);
    // Snapshot por fila para que editarConteoRowSafe lea desde aquí
    window._CNT_ROWS[r._row] = {r:r, packsReal:c.packsReal, mult:c.mult};
  });
  // Rendimiento: solo se dibujan de a 40 productos (se agregan más al bajar) y las filas de cada producto se crean al abrirlo.
  _CNT.grupos=[]; _CNT.mapa={}; _CNT.n=0;
  grupos.forEach(function(g, key){ g.gid='cg-'+key.replace(/[^a-zA-Z0-9]/g,'_'); _CNT.grupos.push(g); _CNT.mapa[g.gid]=g; });
  var t=document.getElementById('conteo-tbody');
  if(!t) return;
  t.innerHTML='';
  if(!_CNT.grupos.length){ t.innerHTML='<tr><td colspan="12" style="text-align:center;color:var(--text3);padding:40px">Sin registros</td></tr>'; _cntVigilar(null); return; }
  _cntMas();
}

var _CNT={ grupos:[], mapa:{}, n:0, lote:40, obs:null };
function _cntFila(item, gid, display){
  var r=item.r;
  return '<tr class="cg-rows-'+gid+'" style="display:'+display+'">'+
    '<td class="mono" style="font-size:11px;color:var(--text3);padding-left:28px">'+esc(r.fecha)+'</td>'+
    '<td class="mono col-hide-mobile" style="font-size:11px;color:var(--text3)">'+esc(r.hora||'')+'</td>'+
    '<td class="mono col-hide-mobile" style="font-size:10px;color:var(--text3)">'+esc(r.ean)+'</td>'+
    '<td class="mono" style="color:var(--text3);font-size:12px">'+esc(r.sku)+'</td>'+
    '<td class="td-desc" style="color:var(--text3);font-size:12px">'+esc(r.producto)+'</td>'+
    '<td class="r col-hide-mobile" style="font-size:15px;font-weight:600">'+fmt(item.packsReal)+'</td>'+
    '<td class="r col-hide-mobile" style="color:var(--text3)">x'+item.mult+'</td>'+
    '<td class="r col-hide-mobile">'+fmt(item.undReal)+'</td>'+
    '<td class="r col-hide-mobile" style="color:var(--text2)">'+fmt(r.unds||0)+'</td>'+
    '<td class="r" style="color:var(--ok)">'+fmt(r.total)+'</td>'+
    '<td class="c"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editarConteoRowSafe('+r._row+')">Editar</button></td>'+
    '<td class="c"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();eliminarConteoRow('+r._row+')">'+ICO('x',14,'s')+'</button></td>'+
  '</tr>';
}
function _cntGrupo(g){
  var n=g.filas.length, gid=g.gid;
  var badge=n>1?'<span style="background:var(--accent);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px">'+n+'×</span>':'';
  var chevron=n>1?'<span id="chv-'+gid+'" style="margin-left:auto;font-size:11px;color:var(--text3);transition:transform .2s">'+ICO('right',12,'s')+'</span>':'';
  var cursor=n>1?'cursor:pointer;user-select:none;':'';
  var html='<tr id="cgh-'+gid+'" style="background:var(--surface2);border-top:2px solid var(--border2);'+cursor+'" '+(n>1?'onclick="_toggleGrupoConteo(\''+gid+'\')"':'')+'>' +
    '<td colspan="4" style="padding:8px 12px">'+
      '<div style="display:flex;align-items:center;gap:6px">'+badge+
        '<span class="mono" style="font-weight:700;font-size:13px;margin-left:'+(n>1?'6':'0')+'px">'+esc(g.sku)+'</span>'+
        '<span style="color:var(--text3);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(g.producto)+'</span>'+
        chevron+
      '</div>'+
    '</td>'+
    '<td class="r col-hide-mobile" style="font-weight:700;color:var(--accent)">'+fmt(g.totalPacks)+'</td>'+
    '<td class="r col-hide-mobile" style="color:var(--text3);font-size:11px">x'+g.mult+'</td>'+
    '<td class="r col-hide-mobile" style="font-weight:700">'+fmt(g.totalUnd)+'</td>'+
    '<td class="r col-hide-mobile" style="font-weight:700;color:var(--text2)">'+fmt(g.totalUnds||0)+'</td>'+
    '<td class="r" style="font-weight:700;font-size:15px;color:var(--ok)">'+fmt(g.totalUnd+(g.totalUnds||0))+'</td>'+
    '<td class="c" colspan="2"></td>'+
  '</tr>';
  // Un solo registro: se muestra de una vez. Varios: se crean al abrir el producto.
  if(n===1) html+=_cntFila(g.filas[0],gid,'table-row');
  return html;
}
function _cntMas(){
  var t=document.getElementById('conteo-tbody'); if(!t) return;
  var marca=document.getElementById('cnt-mas'); if(marca) marca.remove();
  var desde=_CNT.n, hasta=Math.min(desde+_CNT.lote,_CNT.grupos.length), h='', i;
  for(i=desde;i<hasta;i++) h+=_cntGrupo(_CNT.grupos[i]);
  _CNT.n=hasta;
  if(hasta<_CNT.grupos.length) h+='<tr id="cnt-mas"><td colspan="12" style="text-align:center;color:var(--text3);padding:14px;font-size:12px">Mostrando '+hasta+' de '+_CNT.grupos.length+' productos…</td></tr>';
  t.insertAdjacentHTML('beforeend',h);
  _cntVigilar(document.getElementById('cnt-mas'));
}
function _cntVigilar(marca){
  if(_CNT.obs){ _CNT.obs.disconnect(); _CNT.obs=null; }
  if(!marca) return;
  if(!('IntersectionObserver' in window)){ while(_CNT.n<_CNT.grupos.length) _cntMas(); return; }
  _CNT.obs=new IntersectionObserver(function(es){ if(es[0].isIntersecting) _cntMas(); },{rootMargin:'600px 0px'});
  _CNT.obs.observe(marca);
}

// Wrapper seguro — evita interpolar strings dentro del onclick (los SKUs con comillas rompían el handler)
function editarConteoRowSafe(rowNum){
  var snap = (window._CNT_ROWS||{})[rowNum];
  if(!snap){ showToast('Recarga la página — datos desactualizados.','err'); return; }
  var r = snap.r;
  editarConteoRow(rowNum, snap.packsReal, r.unds||0, r.sku||'', r.ean||'', r.producto||'', snap.mult);
}

function _toggleGrupoConteo(gid){
  var rows=document.querySelectorAll('.cg-rows-'+gid), chv=document.getElementById('chv-'+gid);
  if(rows.length){ rows.forEach(function(tr){ tr.remove(); }); if(chv) chv.style.transform=''; return; }   // cerrar
  var g=_CNT.mapa[gid], cab=document.getElementById('cgh-'+gid); if(!g||!cab) return;                       // abrir: se crean ahora
  cab.insertAdjacentHTML('afterend',g.filas.map(function(item){ return _cntFila(item,gid,'table-row'); }).join(''));
  if(chv) chv.style.transform='rotate(90deg)';
}

function eliminarConteoRow(rowNum){
  _confirmDialog('Eliminar registro', 'Se eliminará esta fila del conteo. Esta acción no se puede deshacer.', function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!r.ok){showToast(r.error,'err');return;}
        showToast('Eliminado','ok');
        reloadPage('conteo');
      })
      .withFailureHandler(function(e){showToast(e.message,'err');})
      .eliminarConteo(S.token,rowNum);
  }, 'Eliminar');
}

// ── EDITAR FILA DE CONTEO ──
var _CNT_EDIT_ROW = null;
function editarConteoRow(rowNum, packs, unds, sku, ean, producto, mult){
  _CNT_EDIT_ROW = rowNum;
  // Cargar datos en el form de conteo y abrirlo
  openFS('fs-conteo');
  // Esperar a que el form esté visible, luego poblar
  setTimeout(function(){
    // Reset parcial — no llamar limpiarFormConteo() porque resetea cnt-packs
    clearTimeout(_eanTimer);
    document.getElementById('cnt-ean').value='';
    document.getElementById('cnt-err').textContent='';
    document.getElementById('cnt-ean-status').textContent='';
    document.getElementById('cnt-producto-card').style.display='none';
    document.getElementById('cnt-manual-wrap').style.display='none';
    document.getElementById('cnt-total-display').textContent='0';
    _cnt = {ean:ean, sku:sku, sap:'', producto:producto, multiplicador:mult, _stock:null, _editRow:rowNum};
    // Cargar stock desde DATA.stock o MCONTEO
    if(DATA && DATA.stock && DATA.stock.length){
      var skuNorm=String(sku).trim().toLowerCase();
      for(var i=0;i<DATA.stock.length;i++){
        if(String(DATA.stock[i].sku||'').trim().toLowerCase()===skuNorm){
          _cnt._stock=Number(DATA.stock[i].stock||0); break;
        }
      }
    }
    document.getElementById('cnt-sku').value=sku;
    document.getElementById('cnt-producto-h').value=producto;
    document.getElementById('cnt-producto-nombre').textContent=producto;
    document.getElementById('cnt-sku-display').textContent=sku;
    var multUnd=document.getElementById('cnt-mult-und');if(multUnd)multUnd.textContent=mult;
    // NO setear cnt-ean via .value directo — dispararía autoResolverEAN y borraría packs
    // El ean ya está en _cnt.ean; lo ponemos sin disparar eventos
    var eanEl=document.getElementById('cnt-ean');
    if(eanEl){ eanEl.value=ean; }
    document.getElementById('cnt-mult').value=mult;
    document.getElementById('cnt-producto-card').style.display='block';
    // Cambiar título del botón guardar para indicar edición
    var btn=document.getElementById('btn-guardar-siguiente');
    if(btn){ btn.innerHTML=ICO('check',14)+'Guardar cambios'; }
    // Setear packs en último lugar y disparar calcTotal — evita que limpiarFormConteo lo pise
    var packsEl=document.getElementById('cnt-packs');
    if(packsEl){ packsEl.value=Number(packs)||0; }
    var sueltasEl=document.getElementById('cnt-und-sueltas');
    if(sueltasEl){ sueltasEl.value=Number(unds)||0; }
    calcTotalConteo();
    _cntVista();
    if(packsEl){ packsEl.focus(); packsEl.select(); }
  }, 150);
}

// ── ELIMINAR TODOS LOS REGISTROS DE UN EAN/SKU/TÉRMINO DEL DÍA ──
function eliminarEANDia(){
  var q=((document.getElementById('cnt-busq')||{}).value||'').trim();
  if(!q){ showToast('Escribe un EAN, SKU o nombre en el buscador primero','warn'); return; }
  var hoy=new Date();
  var hoyStr=String(hoy.getDate()).padStart(2,'0')+'/'+String(hoy.getMonth()+1).padStart(2,'0')+'/'+hoy.getFullYear();
  var matches=(DATA.conteo||[]).filter(function(r){
    var qL=q.toLowerCase();
    return r.fecha===hoyStr && (
      r.sku.toLowerCase().indexOf(qL)>-1 ||
      r.ean.toLowerCase().indexOf(qL)>-1 ||
      r.producto.toLowerCase().indexOf(qL)>-1
    );
  });
  if(!matches.length){ showToast('No hay registros de HOY que coincidan con "'+q+'" — verificá el filtro de fecha','warn'); return; }
  var totalUndElim=matches.reduce(function(a,r){return a+(Number(r.total)||Number(r.und)||0);},0);
  _confirmDialog(
    'Eliminar '+matches.length+' registro(s) de hoy',
    '"'+q+'" · '+matches.length+' conteo(s) · '+totalUndElim+' und. en total | Fecha: '+hoyStr+' | Esta acción no se puede deshacer.',
    function(){
      var rows=matches.map(function(r){return r._row;});
      // Una sola llamada batch en vez de N requests
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){ showToast('Error: '+r.error,'err'); return; }
          showToast('Eliminados '+r.eliminados+' registros','ok');
          reloadConteoForce();
        })
        .withFailureHandler(function(e){
          showToast('Error: '+e.message,'err');
          reloadConteoForce();
        })
        .eliminarConteoMultiple(S.token, rows);
    },
    'Eliminar '+matches.length+' registro(s)'
  );
}

// ── ACTUALIZAR CONTEO FORZANDO REFRESCO DE CACHÉ EN SERVIDOR ──
function exportConteo(){
  if(S&&S.rol!=='store'){
    var HDR=['Fecha','Hora','EAN','SKU / Lovis','Producto','Packs','UND Packs','UNDS','Total','Ubicación'];
    var CW=[{wch:12},{wch:8},{wch:16},{wch:14},{wch:40},{wch:8},{wch:10},{wch:8},{wch:10},{wch:16}];
    _exportConSpinner('btn-export-conteo','conteo',function(sedes){
      _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:HDR,rows:s.data,colWidths:CW,
        mapFn:function(r){return[r.fecha,r.hora||'',r.ean,r.sku,r.producto,r.packs||0,r.und||0,r.unds||0,r.total,r.ubicacion||''];}};}),'conteo_sedes');
    });return;
  }
  var rows = DATA.conteo || [];
  var q=((document.getElementById('cnt-busq')||{}).value||'').toLowerCase();
  rows = rows.filter(function(r){
    return !q || r.sku.toLowerCase().indexOf(q)>-1 ||
           r.producto.toLowerCase().indexOf(q)>-1 || r.ean.toLowerCase().indexOf(q)>-1;
  });
  rows = _applyFiltroFecha('cnt', rows);
  if(!rows.length){ showToast('No hay datos para exportar','err'); return; }
  var data = rows.map(function(r){
    var packsReal = r.packs || 0;
    var undReal   = r.und || r.total || 0;
    var mult = 1;
    if(packsReal > 0){ mult = Math.round(undReal/packsReal)||1; }
    else if(undReal > 0 && _MCONTEO_SKU_IDX){
      var sn = String(r.sku||'').toLowerCase();
      if(_MCONTEO_SKU_IDX[sn]){ mult=Number(_MCONTEO_SKU_IDX[sn].multiplicador)||1; packsReal=Math.round(undReal/mult); }
      else { packsReal=undReal; }
    }
    return {'Fecha':r.fecha,'Hora':r.hora||'','EAN':r.ean,'SKU / Lovis':r.sku,'Producto':r.producto,
      'Packs':packsReal,'Multiplicador':mult,'UND Packs':undReal,'UNDS':r.unds||0,'Total':r.total,'Ubicación':r.ubicacion||''};
  });
  var ws = XLSX.utils.json_to_sheet(data);
  ws['!cols']=[{wch:12},{wch:8},{wch:16},{wch:14},{wch:40},{wch:8},{wch:13},{wch:10},{wch:8},{wch:10},{wch:16}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conteo');
  XLSX.writeFile(wb, 'conteo_'+_hoyISO()+'.xlsx');
  showToast('Exportado '+rows.length+' registros','ok');
}

function _cerrarFormConteo(){
  var packs = Number((document.getElementById('cnt-packs')||{}).value||0);
  var tieneDatos = packs > 0 || (_cnt && _cnt.sku);
  if(tieneDatos && _conteoBuffer.length === 0){
    // Solo pedir confirmación si no hay nada guardado aún en el buffer
    _confirmDialog(
      '¿Salir sin guardar?',
      'Tenés datos sin guardar en el formulario. Si salís ahora se perderán.',
      function(){ limpiarFormConteo(); closeFS('fs-conteo'); },
      'Salir sin guardar'
    );
    return;
  }
  if(tieneDatos && _conteoBuffer.length > 0){
    _confirmDialog(
      '¿Cerrar el formulario?',
      'El formulario se cerrará. Los '+_conteoBuffer.length+' registro(s) del historial ya están guardados.',
      function(){ limpiarFormConteo(); closeFS('fs-conteo'); },
      'Cerrar'
    );
    return;
  }
  limpiarFormConteo();
  closeFS('fs-conteo');
}

function reloadConteoForce(){
  // Limpiar caché local
  _MCONTEO_LOCAL=null; _MCONTEO_PENDING=[]; _MCONTEO_EAN_IDX={}; _MCONTEO_SKU_IDX={};
  DATA.conteo=[];
  PAGE_LOADED['conteo']=false;
  PAGE_LOADING['conteo']=true;
  _FORCE_REFRESH['conteo']=true; // bypass caché del servidor
  var root=document.getElementById('conteo-root');
  if(root) root.innerHTML=LD('Actualizando conteo');
  loadConteo();
}

// ── SCANNER PARA EL FILTRO DE CONTEO ──
function openScannerConteoFiltro(){
  _scannerTarget = {skuId:'cnt-busq', descId:null, marcaId:null, conteoMode:false, filtroMode:true};
  _abrirPopupScanner('cnt-busq', 'Escanea el EAN o SKU a buscar');
}

function limpiarFormConteo(){
  clearTimeout(_eanTimer);
  _cnt={ean:'',sku:'',sap:'',producto:'',multiplicador:1,_stock:null,_editRow:null};
  _CNT_EDIT_ROW = null;
  ['cnt-ean','cnt-packs','cnt-und-sueltas','cnt-sku','cnt-sap','cnt-mult','cnt-producto-h'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('cnt-err').textContent='';
  document.getElementById('cnt-ean-status').textContent='';
  document.getElementById('cnt-producto-card').style.display='none';
  document.getElementById('cnt-manual-wrap').style.display='none';
  document.getElementById('cnt-total-display').textContent='0';
  _cntListo(0);
  _cntVista();
}

var _eanTimer = null;
function autoResolverEAN(){
  clearTimeout(_eanTimer);
  var ean = document.getElementById('cnt-ean').value.trim();
  if(!ean || ean.length < 8) return;
  _eanTimer = setTimeout(function(){
    if(!_cnt.sku) resolverEAN();
  }, 120);
}

function resolverEAN(){
  clearTimeout(_eanTimer);
  var ean = document.getElementById('cnt-ean').value.trim();
  if (!ean) return;
  var st = document.getElementById('cnt-ean-status');

  // Normalizar EAN (notación científica o .0)
  var normEAN = /[eE]/.test(ean) ? Math.round(Number(ean)).toString() : ean.replace(/\.0+$/, '');

  function _buscarLocal() {
    var found = _MCONTEO_EAN_IDX[normEAN];
    if (!found) {
      st.textContent = 'No encontrado: EAN ' + normEAN + ' no está en MCONTEO';
      st.style.color = 'var(--danger)';
      document.getElementById('cnt-manual-wrap').style.display = 'block';
      _cntCamNoEncontrado();
      return;
    }
    st.textContent = '';
    setProductoConteo(found.ean, found.sku, found.sap || '', found.producto, found.multiplicador, found.stock);
    document.getElementById('cnt-packs').focus();
  }

  if (_MCONTEO_LOCAL) {
    // Resolución instantánea desde caché local — sin llamada al servidor
    _buscarLocal();
  } else {
    st.style.color = 'var(--text3)'; st.textContent = 'Cargando catálogo...';
    _cargarMConteo(function() {
      if (_MCONTEO_LOCAL) { _buscarLocal(); }
      else {
        // Fallback al servidor si la carga falló
        st.textContent = 'Buscando en servidor...';
        google.script.run
          .withSuccessHandler(function(r) {
            if (!r.ok) { st.textContent = 'No encontrado: ' + r.error; st.style.color = 'var(--danger)'; document.getElementById('cnt-manual-wrap').style.display = 'block'; _cntCamNoEncontrado(); return; }
            st.textContent = '';
            setProductoConteo(r.ean, r.sku, r.sap || '', r.producto, r.multiplicador, r.stock);
            document.getElementById('cnt-packs').focus();
          })
          .withFailureHandler(function(e) { st.textContent = 'Error: ' + e.message; st.style.color = 'var(--danger)'; })
          .buscarEAN(S.token, ean);
      }
    });
  }
}

function setProductoConteo(ean,sku,sap,producto,multiplicador,stock){
  var mult=Number(multiplicador)||1;
  var stockVal=(stock!==undefined&&stock!==null&&stock!=='') ? Number(stock) : null;
  // Fallback: si MCONTEO no trajo stock (cache vieja de GAS), buscar en DATA.stock ya cargado
  if(stockVal===null && sku && DATA && DATA.stock && DATA.stock.length){
    var skuNorm=String(sku).trim().toLowerCase();
    for(var _si=0;_si<DATA.stock.length;_si++){
      if(String(DATA.stock[_si].sku||'').trim().toLowerCase()===skuNorm){
        stockVal=Number(DATA.stock[_si].stock||0);
        break;
      }
    }
  }
  var editRowPrev = _cnt._editRow || null; // preservar antes de reasignar
  _cnt={ean:ean,sku:sku,sap:sap,producto:producto,multiplicador:mult,_stock:stockVal,_editRow:editRowPrev};
  document.getElementById('cnt-sku').value=sku;
  document.getElementById('cnt-sap').value=sap;
  document.getElementById('cnt-mult').value=mult;
  document.getElementById('cnt-producto-h').value=producto;
  document.getElementById('cnt-producto-nombre').textContent=producto;
  document.getElementById('cnt-sku-display').textContent=sku;
  var multUnd=document.getElementById('cnt-mult-und');if(multUnd)multUnd.textContent=mult;
  document.getElementById('cnt-producto-card').style.display='block';
  document.getElementById('cnt-manual-wrap').style.display='none';
  // Resetear packs solo si NO es una edición en curso
  if(!_cnt._editRow){ document.getElementById('cnt-packs').value=''; }
  calcTotalConteo();
  _cntVista();
}

function limpiarProductoConteo(){
  _cnt={ean:'',sku:'',sap:'',producto:'',multiplicador:1,_stock:null};
  ['cnt-ean','cnt-sku','cnt-sap','cnt-mult','cnt-producto-h'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('cnt-producto-card').style.display='none';
  document.getElementById('cnt-ean-status').textContent='';
  document.getElementById('cnt-packs').value='';
  document.getElementById('cnt-und-sueltas').value='';
  document.getElementById('cnt-total-display').textContent='0';
  _cntListo(0);
  var bar=document.getElementById('cnt-progress-bar');
  if(bar){bar.style.width='0%';}
  var label=document.getElementById('cnt-progress-label');
  if(label){label.textContent='— / — und.';}
  var hint=document.getElementById('cnt-progress-hint');
  if(hint){hint.textContent='';}
  _cntVista();
}

// Wrapper delgado — delega en acSearch con handler de selección propio (acSelectConteo)
function acSearchConteo(){
  var inp=document.getElementById('cnt-sku-manual');
  if(!inp)return;
  // Reutiliza acSearch: listId='ac-cnt', onSelectFn='acSelectConteo'
  acSearch('cnt-sku-manual', null, null, 'ac-cnt', 'acSelectConteo');
}

function acSelectConteo(idx){
  var item=(AC_CACHE['ac-cnt']||[])[idx];
  if(!item)return;
  document.getElementById('ac-cnt').classList.remove('open');
  var st=document.getElementById('cnt-ean-status');

  function _resolverLocal() {
    var found = _MCONTEO_SKU_IDX[item.sku.toLowerCase()];
    if (found) {
      st.textContent = '';
      setProductoConteo(found.ean, found.sku, found.sap || '', found.producto, found.multiplicador, found.stock);
    } else {
      setProductoConteo('', item.sku, '', item.desc, 1, null);
      st.textContent = 'Multiplicador no encontrado en MCONTEO, usando x1';
      st.style.color = 'var(--warn)';
    }
  }

  if (_MCONTEO_LOCAL) {
    _resolverLocal();
  } else {
    st.style.color = 'var(--text3)'; st.textContent = 'Buscando multiplicador...';
    _cargarMConteo(function() {
      if (_MCONTEO_LOCAL) { _resolverLocal(); }
      else {
        // Fallback al servidor
        google.script.run
          .withSuccessHandler(function(r) {
            st.textContent = '';
            if (r.ok) { setProductoConteo(r.ean, r.sku, r.sap || '', r.producto, r.multiplicador, r.stock); }
            else { setProductoConteo('', item.sku, '', item.desc, 1, null); st.textContent = 'Multiplicador no encontrado, usando x1'; st.style.color = 'var(--warn)'; }
          })
          .withFailureHandler(function() { st.textContent = ''; setProductoConteo('', item.sku, '', item.desc, 1, null); })
          .buscarSKUConteo(S.token, item.sku);
      }
    });
  }
}

// El botón de guardar se pone de color cuando hay producto y cantidad
function _cntListo(total){
  var b=document.getElementById('btn-guardar-siguiente');
  if(b) b.classList.toggle('listo', !!(_cnt&&_cnt.sku)&&total>0);
  var t=document.getElementById('cnt-total-display');
  if(t) t.style.color=total>0?'#C9BEF7':'';
}

function calcTotalConteo(){
  var packs=Number(document.getElementById('cnt-packs').value||0);
  var sueltas=Number(document.getElementById('cnt-und-sueltas').value||0);
  var mult=_cnt.multiplicador||1;
  var total=packs*mult+sueltas;
  document.getElementById('cnt-total-display').textContent=total;
  _cntListo(total);

  // Progress bar vs stock — sumar conteos previos del mismo SKU en el buffer
  var stock=_cnt._stock;
  var bar=document.getElementById('cnt-progress-bar');
  var label=document.getElementById('cnt-progress-label');
  var hint=document.getElementById('cnt-progress-hint');
  if(bar&&label&&hint){
    if(stock==null||stock===undefined||stock===''){
      label.textContent='— / — und.';
      bar.style.width='0%';
      bar.style.background='var(--text4)';
      hint.textContent='';
    } else {
      var stockNum=Number(stock)||0;
      // Sumar conteos previos del mismo SKU: buffer local + registros del servidor de hoy
      var prevUnd=0;
      var skuNorm=String(_cnt.sku||'').trim();
      // 1. Buffer local (mismo dispositivo, aún no guardados)
      if(skuNorm && _conteoBuffer && _conteoBuffer.length){
        _conteoBuffer.forEach(function(b){
          if(String(b.sku||'').trim()===skuNorm) prevUnd+=Number(b.total||b.und||0);
        });
      }
      // 2. DATA.conteo del servidor — registros ya guardados hoy (cualquier dispositivo)
      if(skuNorm && DATA && DATA.conteo && DATA.conteo.length){
        var hoy=new Date();
        var hoyStr=String(hoy.getDate()).padStart(2,'0')+'/'+String(hoy.getMonth()+1).padStart(2,'0')+'/'+hoy.getFullYear();
        var editRowNum=_cnt._editRow||null;
        DATA.conteo.forEach(function(c){
          if(String(c.sku||'').trim()===skuNorm && String(c.fecha||'').trim()===hoyStr){
            // Excluir la fila que se está editando para no duplicar su conteo
            if(editRowNum && c._row===editRowNum) return;
            // Evitar doble conteo si este registro ya está reflejado en el buffer local
            var yaEnBuffer=_conteoBuffer.some(function(b){ return b._row && b._row===c._row; });
            if(!yaEnBuffer) prevUnd+=Number(c.total||c.und||0);
          }
        });
      }
      var totalAcum=prevUnd+total;
      var labelPrev=prevUnd>0?' (+'+prevUnd+' prev)':'';
      label.textContent=totalAcum+' / '+stockNum+' und.'+labelPrev;
      var pct=stockNum>0?Math.min(Math.round(totalAcum/stockNum*100),100):100;
      bar.style.width=pct+'%';
      if(pct>=100){
        bar.style.background='var(--ok)';
        hint.style.color='var(--ok)';
        hint.innerHTML=ICO('check',13)+'Stock cubierto'+(totalAcum>stockNum?' (+'+( totalAcum-stockNum)+' extra)':'');
      } else if(pct>=60){
        bar.style.background='var(--warn)';
        hint.style.color='var(--warn)';
        hint.textContent='Faltan '+(stockNum-totalAcum)+' und. para cubrir stock';
      } else {
        bar.style.background='var(--danger)';
        hint.style.color='var(--danger)';
        hint.textContent='Faltan '+(stockNum-totalAcum)+' und. para cubrir stock';
      }
    }
  }
}
// Buffer local de conteo y persistencia
// (declarado aquí abajo — las funciones de conteo lo usan después de carga)

function saveConteoBuffer() {
  // FIX: aplicar cutoff de 24h también al guardar (no solo al cargar) y
  // proteger contra QuotaExceededError de iOS (límite ~5MB de localStorage).
  // Si falla, advertir al usuario para que sincronice antes de seguir.
  var cutoff = Date.now() - 24 * 60 * 60 * 1000;
  _conteoBuffer = (_conteoBuffer || []).filter(function(it){ return !it._ts || it._ts > cutoff; });
  try {
    localStorage.setItem(CACHE_CONTEO_KEY, JSON.stringify(_conteoBuffer));
  } catch(e) {
    // QuotaExceededError, SecurityError (Safari incognito), etc.
    console.error('[saveConteoBuffer] localStorage falló:', e.message);
    showToast('No se pudo guardar localmente. Sincroniza pronto.', 'err');
  }
  renderConteoHistory();
  _actualizarBannerPendientes(); // sincronizar badge del banner offline
}

function loadConteoBuffer() {
  try {
    var stored = localStorage.getItem(CACHE_CONTEO_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      var cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 horas
      _conteoBuffer = parsed.filter(function(item) {
        // Compatibilidad: ítems sin timestamp se conservan una vez más
        return !item._ts || item._ts > cutoff;
      });
      // Si se limpió alguno, persistir el estado actualizado
      if (_conteoBuffer.length !== parsed.length) {
        try { localStorage.setItem(CACHE_CONTEO_KEY, JSON.stringify(_conteoBuffer)); } catch(e) {}
      }
    } else {
      _conteoBuffer = [];
    }
  } catch(e) { _conteoBuffer = []; }
  renderConteoHistory();
}

function clearConteoBuffer() {
  _conteoBuffer = [];
  localStorage.removeItem(CACHE_CONTEO_KEY);
  renderConteoHistory();
}

var _renderConteoHistoryTimer = null;
function renderConteoHistory() {
  // Diferir el render para evitar re-pintados en cascada cuando se acumulan varios pushes
  clearTimeout(_renderConteoHistoryTimer);
  _renderConteoHistoryTimer = setTimeout(_renderConteoHistoryNow, 50);
}
function _renderConteoHistoryNow() {
  var container = document.getElementById('cnt-history-container');
  var list = document.getElementById('cnt-history-list');
  var badge = document.getElementById('cnt-history-badge');
  
  // Sincronizar el badge mini (si aún lo usaras)
  _actualizarContadorBuffer();

  // Historial reciente de ESTE equipo (últimas 24 h), del más nuevo al más antiguo.
  // Los conteos que aún no llegaron al servidor (sin _row) se marcan y permiten editar o quitar.
  var items = _conteoBuffer || [];
  if (items.length === 0) {
    container.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  badge.textContent = items.length;

  var html = '';
  for (var i = items.length - 1; i >= 0; i--) {
    var item = items[i];
    var packs = Number(item.packs) || 0, sueltas = Number(item.sueltas) || 0;
    var desc = (packs ? packs + (packs === 1 ? ' pack' : ' packs') : '') +
               (packs && sueltas ? ' + ' : '') +
               (sueltas ? sueltas + (sueltas === 1 ? ' suelta' : ' sueltas') : '');
    var hora = item._ts ? new Date(item._ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    var pend = !item._row;
    html += '<div class="cnt-h">' +
      '<div class="cnt-h-main">' +
        '<div class="cnt-h-n" title="' + esc(item.producto) + '">' + esc(item.producto) + '</div>' +
        '<div class="cnt-h-s">' + esc(hora) + (hora && desc ? ' · ' : '') + esc(desc) + (pend ? ' · <span class="pend">Sin enviar</span>' : '') + '</div>' +
      '</div>' +
      (pend ? '<div class="cnt-h-b"><button onclick="editBufferItem(' + i + ')">Editar</button><button onclick="deleteBufferItem(' + i + ')" aria-label="Quitar">'+ICO('x',14,'s')+'</button></div>' : '') +
      '<div class="cnt-h-t">' + (Number(item.total) || 0) + '<small>und.</small></div>' +
    '</div>';
  }
  list.innerHTML = html;
}

function editBufferItem(idx) {
  var item = _conteoBuffer[idx];
  if (!item) return;

  // 1. Quitarlo del historial (para que lo vuelvan a agregar modificado)
  _conteoBuffer.splice(idx, 1);
  saveConteoBuffer();

  // 2. Cargarlo en el formulario activo — guardar _editRow para que el servidor sobreescriba esa fila
  _cnt._editRow = item._row || null;
  setProductoConteo(item.ean, item.sku, item.sap, item.producto, item.multiplicador);
  document.getElementById('cnt-packs').value = item.packs;
  document.getElementById('cnt-und-sueltas').value = item.sueltas || '';
  calcTotalConteo();

  // 3. Subir el scroll hasta arriba
  document.querySelector('#fs-conteo .fs-body').scrollTop = 0;
  showToast('Cargado para editar. Al terminar presiona Siguiente.', 'info');
}


function abrirConteo(){
  // Recuperar lo guardado en caché para no perder si se recargó la app
  loadConteoBuffer();
  limpiarFormConteo();
  openFS('fs-conteo');
  // Siempre recargar MCONTEO al abrir — garantiza códigos actualizados
  _MCONTEO_LOCAL=null; _MCONTEO_PENDING=[]; _MCONTEO_EAN_IDX={}; _MCONTEO_SKU_IDX={};
  var st = document.getElementById('cnt-ean-status');
  if (st) { st.style.color = 'var(--text3)'; st.textContent = 'Cargando catálogo de productos...'; }
  _cntCam.error = false;
  _cntCamNegro(null);
  // La cámara arranca de inmediato (no espera al catálogo); el catálogo solo hace falta al detectar un código
  setTimeout(_cntVista, 60);
  _cargarMConteo(function() {
    var st2 = document.getElementById('cnt-ean-status');
    if (st2 && st2.textContent === 'Cargando catálogo de productos...') st2.textContent = '';
  }, true);
}

function _actualizarContadorBuffer(){
  var badge = document.getElementById('cnt-buffer-badge');
  if(!badge) return;
  if(_conteoBuffer.length === 0){
    badge.style.display='none';
  } else {
    badge.style.display='inline-block';
    badge.textContent = _conteoBuffer.length + ' en cola';
  }
}



// Agrega o reemplaza (por _row) una fila de conteo en la tabla local: editar no debe duplicar el registro
function _conteoUpsertLocal(row){
  if(!DATA.conteo) DATA.conteo=[];
  var i=-1;
  if(row && row._row!=null){
    for(var k=0;k<DATA.conteo.length;k++){ if(DATA.conteo[k]._row===row._row){ i=k; break; } }
  }
  if(i>=0) DATA.conteo[i]=row; else DATA.conteo.push(row);
}

function guardarYContinuar(){
  var sku=_cnt.sku;
  var packs=Number(document.getElementById('cnt-packs').value||0);
  var sueltas=Number(document.getElementById('cnt-und-sueltas').value||0);
  var mult=_cnt.multiplicador||1;
  var und=packs*mult+sueltas;
  var err=document.getElementById('cnt-err');

  if(!sku){err.textContent='Escanea un EAN o busca el SKU';document.getElementById('cnt-ean').focus();return;}
  if(packs<=0&&sueltas<=0){err.textContent='Ingresa packs o unidades sueltas';document.getElementById('cnt-packs').focus();return;}

  err.textContent='';

  var btn = document.getElementById('btn-guardar-siguiente');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  var fila = {ean:_cnt.ean||'',sku:sku,sap:_cnt.sap||'',producto:_cnt.producto||'',
      packs:packs,und:und,sueltas:sueltas,multiplicador:mult,total:und,ubicacion:'',
      _editRow:_cnt._editRow||null,
      _uid: _cnt._editRow ? '' : _genUID()};
  _cnt._editRow = null; // limpiar para el siguiente escaneo

  // Enviar inmediatamente al servidor
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled = false;
      btn.textContent = 'Guardar y escanear siguiente';
      if(!r.ok){
        if(r.retryable){
          // Falla transitoria (ej. otro usuario contando a la vez) — no se pierde el
          // dato: se encola como pendiente y se reintenta solo en unos segundos.
          showToast(r.error+' Se reintentará automáticamente.','warn');
          _conteoBuffer.push(Object.assign({}, fila, { _ts: Date.now() }));
          saveConteoBuffer();
          _actualizarBannerPendientes();
          _CNT_EDIT_ROW = null;
          var btnR=document.getElementById('btn-guardar-siguiente');
          if(btnR) btnR.textContent='Guardar y escanear siguiente';
          limpiarFormConteo();
          setTimeout(_intentarSyncOffline, 3000);
          setTimeout(function() { openScannerConteo(); }, 400);
        } else {
          showToast(r.error,'err');
        }
        return;
      }

      // Agregar al historial — sin deduplicar por SKU (cada escaneo es un registro independiente)
      // Si fue una edición, la fila ya existe en el historial: se reemplaza, no se agrega otra
      var itemHistorial = Object.assign({}, fila, { _ts: Date.now(), _row: r.inserted[0]._row });
      _conteoBuffer = _conteoBuffer.filter(function(b){ return !(b._row && b._row === itemHistorial._row); });
      _conteoBuffer.push(itemHistorial);
      saveConteoBuffer();

      showToast('Guardado: ' + packs + ' packs de ' + sku, 'ok');
      _CNT_EDIT_ROW = null;
      var btn2=document.getElementById('btn-guardar-siguiente');
      if(btn2) btn2.textContent='Guardar y escanear siguiente';

      // Agregar a tabla principal local — sin deduplicar
      _conteoUpsertLocal(r.inserted[0]);
      if(typeof filterConteo==='function') filterConteo();
      _updateConteoStats();

      // Preparar para el siguiente
      limpiarFormConteo();
      setTimeout(function() { openScannerConteo(); }, 400);
    })
    .withFailureHandler(function(e){
      // Fallback offline si el internet falla justo al guardar
      btn.disabled = false;
      btn.textContent = 'Guardar y escanear siguiente';
      showToast('Sin red. Guardado en historial, se sincronizará luego.', 'warn');
      _CNT_EDIT_ROW = null;
      var btn2=document.getElementById('btn-guardar-siguiente');
      if(btn2) btn2.textContent='Guardar y escanear siguiente';
      
      _conteoBuffer.push(Object.assign({}, fila, { _ts: Date.now() }));
      saveConteoBuffer();
      _actualizarBannerPendientes();
      
      limpiarFormConteo();
      setTimeout(function() { openScannerConteo(); }, 400);
    })
    .registrarConteo(S.token, [fila]);
}

// Actualización opcional: Hacer que la "X" del historial elimine directo del servidor
function deleteBufferItem(idx) {
  var item = _conteoBuffer[idx];
  if (!item) return;

  _confirmDialog('Eliminar registro', '¿Eliminar este conteo definitivamente?', function(){
    if (item._row) {
      google.script.run
        .withSuccessHandler(function(r){
           if(r.ok) {
             _conteoBuffer.splice(idx, 1);
             saveConteoBuffer();
             reloadPage('conteo');
             showToast('Eliminado', 'ok');
           } else {
             showToast('Error al eliminar: '+(r.error||'Error desconocido'),'err');
           }
        })
        .withFailureHandler(function(e){ showToast('Error de red: '+e.message,'err'); })
        .eliminarConteo(S.token, item._row);
    } else {
      _conteoBuffer.splice(idx, 1);
      saveConteoBuffer();
      _actualizarBannerPendientes();
    }
  }, 'Eliminar');
}

// Inicializar debounced filters aquí — todas las funciones _filterXxx ya están definidas
filterStock      = _debounce(_filterStock,      150);
filterSalidas    = _debounce(_filterSalidas,    150);
filterEntradas   = _debounce(_filterEntradas,   150);
filterMT         = _debounce(_filterMT,         150);
filterCancelados = _debounce(_filterCancelados, 150);
filterConteo     = _debounce(_filterConteo,     150);
