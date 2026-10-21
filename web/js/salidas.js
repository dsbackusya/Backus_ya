/* Pantalla Salidas (en vivo, resumen de envases y agregar pedido a mano) — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   SALIDAS
══════════════════════════════════════ */
/* ── Salidas en vivo (Supabase Realtime): las filas aparecen solas, sin avisos ── */
var _salFlash = {};
function _salVivoIniciar(){
  if(!window.TadaRealtime) return;
  TadaRealtime.salidas(function(){ return window.sal_rango||null; }, _salVivoCambio, _salVivoResync);
}
function _salVivoCambio(c){
  _sbSalidasRefrescar();
  if(!S||!S.token||!document.getElementById('salidas-tbody')) return; // pantalla no abierta: se cargará fresca al entrar
  var porId={}; (DATA.salidas||[]).forEach(function(r){ porId[r._row]=r; });
  var hubo=c.upserts.length>0;
  c.borrados.forEach(function(id){ if(porId[id]){ delete porId[id]; hubo=true; } });
  if(!hubo) return; // p. ej. borrados de otra sede o de filas que no están cargadas
  c.upserts.forEach(function(r){ if(!porId[r._row]) _salFlash[r._row]=true; porId[r._row]=r; });
  DATA.salidas=Object.keys(porId).map(function(k){return porId[k];}).sort(function(a,b){return a._row-b._row;});
  _SAL.mantener=true; filterSalidas();
  setTimeout(function(){ _salFlash={}; _SAL.mantener=true; filterSalidas(); }, 3500);
}
// Tras recuperar la conexión, vuelve a leer el rango visible sin tocar la pantalla
function _salVivoResync(){
  _sbSalidasRefrescar();
  if(!S||!S.token||!document.getElementById('salidas-tbody')) return;
  google.script.run.withSuccessHandler(function(r){
    if(r&&r.ok&&document.getElementById('salidas-tbody')){ DATA.salidas=r.data; _SAL.mantener=true; filterSalidas(); }
  }).getSalidas(S.token, true, window.sal_rango||null);
}

// Al volver a la app (celular que estuvo en segundo plano / pantalla apagada) la conexión en vivo puede haberse
// dormido: se vuelve a conectar y se relee el rango visible para no perder pedidos que llegaron mientras tanto.
var _salVisUlt = 0;
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState!=='visible'||!S||!S.token||!window.TadaRealtime) return;
  if(!document.getElementById('s-app').classList.contains('active')) return;
  var ahora = Date.now();
  if(ahora-_salVisUlt<5000) return;
  _salVisUlt = ahora;
  if(!TadaRealtime.vivo()) _salVivoIniciar();
  _salVivoResync();
});

function loadSalidas(){
  if(!S||!S.token){errBox('salidas-root','Sin sesión activa. Recarga la página.','salidas');PAGE_LOADING['salidas']=false;return;}
  var force=!!_FORCE_REFRESH['salidas']; _FORCE_REFRESH['salidas']=false;
  var t = (REQ_TOKEN.salidas = (REQ_TOKEN.salidas||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.salidas) return;
      PAGE_LOADING['salidas']=false; renderSalidas(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.salidas) return;
      PAGE_LOADING['salidas']=false; errBox('salidas-root',e.message,'salidas');
    })
    .getSalidas(S.token, force, window.sal_rango||null);
}

function renderSalidas(r){
  if(_handleExpired(r,'salidas-root')) return;
  if(!r||!r.ok){errBox('salidas-root',r?r.error:'Error desconocido');return;}
  DATA.salidas=r.data;
  _SAL_EST='';
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  document.getElementById('salidas-root').innerHTML=
    '<div class="sal2-sum">'+
      '<div class="sal2-card sal2-ped"><div class="sal2-pl"><div class="sal2-k">Pedidos</div><div class="sal2-v" id="sal-stat-total">0</div></div>'+
        '<div class="sal2-pr" id="sal-ultimo"></div></div>'+
      '<div class="sal2-card"><div class="sal2-k">Unidades salidas</div><div class="sal2-v"><span id="sal-stat-und">0</span><small>und.</small></div><div class="sal2-n" id="sal-prod"></div></div>'+
      '<div class="sal2-card"><div class="sal2-k">Envases</div><div class="sal2-env" id="sal-env"></div></div>'+
    '</div>'+
    '<div class="sal2-fl">'+
      '<div class="sal2-srch">'+icoBuscar+'<input id="sal-busq" placeholder="Buscar pedido, SKU, producto o motorizado…" oninput="filterSalidas()"/></div>'+
      _fechaFiltroHTML('sal','filterSalidas','salRangoCambio')+
      '<div class="sal2-seg" id="sal-est"></div>'+
      '<span class="sal2-cnt" id="sal-count"></span>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr>'+
        '<th>Fecha</th><th class="col-hide-mobile">Hora</th><th>Nro. Pedido</th><th class="col-hide-mobile">SKU</th><th>Descripción</th>'+
        '<th class="col-hide-mobile">Marca</th><th class="r col-hide-mobile">Pack</th><th class="r">Und.</th>'+
        '<th class="c col-hide-mobile">Motor.</th><th class="r col-hide-mobile">Envases</th>'+
        '<th class="c col-hide-mobile">Estado</th><th class="c col-hide-mobile">Revisión</th>'+
        '<th class="c col-hide-mobile" style="min-width:110px;width:110px"></th>'+
      '</tr></thead>'+
      '<tbody id="salidas-tbody"></tbody>'+
    '</table></div>';

  // Estado inicial: activar filtro "Hoy" por defecto
  _initFiltroFecha('sal','filterSalidas',{page:'salidas'});
  filterSalidas();
}

function _salTiempoRelativo(fecha, hora){
  try {
    if(!fecha||!hora) return '';
    var partesFecha=fecha.split('/'); // dd/mm/yyyy
    if(partesFecha.length<3) return '';
    var iso=partesFecha[2]+'-'+partesFecha[1]+'-'+partesFecha[0]+'T'+hora+':00';
    var ts=new Date(iso).getTime();
    if(isNaN(ts)) return '';
    var diff=Math.floor((Date.now()-ts)/60000);
    if(diff<1) return 'ahora mismo';
    if(diff<60) return 'hace '+diff+' min';
    if(diff<1440) return 'hace '+Math.floor(diff/60)+' h';
    return 'hace '+Math.floor(diff/1440)+' d';
  } catch(e){ return ''; }
}

function _salMenuContextual(row){
  var cancelado=row.cancelado||row.estado==='cancelado'||row.estado==='CANCELADO';
  if(cancelado) return '';
  return '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;color:var(--accent);white-space:nowrap" '+
    'onclick="abrirEditarSkuFila('+row._row+')">'+ICO('edit',12)+'SKU</button> '+
    '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 10px;color:var(--danger);border-color:var(--danger);white-space:nowrap" '+
    'data-row="'+row._row+'" data-nro="'+esc(row.nroPedido)+'" '+
    'onclick="abrirModalCancelarBtn(this)">'+ICO('x',12)+'Cancelar</button> '+
    (_salEsDup(row)?'<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;color:var(--text3);white-space:nowrap" title="Fila duplicada: elimina solo esta, la otra se conserva" '+
    'onclick="eliminarDuplicadoSalida('+row._row+')">'+ICO('trash',12,'s')+'Duplicado</button>':'');
}

// Una fila es duplicada si otra del mismo pedido tiene el mismo SKU, pack y unidades. Solo esas se pueden eliminar,
// y siempre queda al menos una (la base lo exige tambien).
function _salDupClave(x){ return [x.nroPedido,x.sku,x.pack,x.unidad].join('|'); }
var _salDupCache={ ref:null, n:-1, mapa:{} };
function _salEsDup(row){
  var d=DATA.salidas||[];
  if(_salDupCache.ref!==d||_salDupCache.n!==d.length){
    var m={}; d.forEach(function(x){ if(x.nroPedido){ var k=_salDupClave(x); m[k]=(m[k]||0)+1; } });
    _salDupCache={ ref:d, n:d.length, mapa:m };
  }
  return !!row.nroPedido && _salDupCache.mapa[_salDupClave(row)]>1;
}
function eliminarDuplicadoSalida(rowNum){
  var fila=DATA.salidas.find(function(r){return r._row===rowNum;});
  if(!fila){ showToast('Recarga la página — los datos están desactualizados.','err'); return; }
  var k=_salDupClave(fila);
  var otras=DATA.salidas.filter(function(x){return x._row!==rowNum&&_salDupClave(x)===k;});
  if(!otras.length){ showToast('No es un duplicado: no se puede eliminar.','err'); return; }
  var det=function(x){ return (x.hora||'')+(x.desc?' · '+x.desc:' · sin descripción')+(x.motorizado?' · Moto: '+x.motorizado:'')+(x.envases?' · '+x.envases:'')+(x.estado?' · '+x.estado:''); };
  _confirmDialog('Eliminar fila duplicada',
    'Pedido '+fila.nroPedido+', SKU '+fila.sku+' ('+fmt(fila.unidad)+' und.) está repetido '+(otras.length+1)+' veces.\n\n'+
    'SE ELIMINA solo esta: '+det(fila)+'\n'+
    'SE CONSERVA: '+otras.map(det).join('\n            ')+'\n\n'+
    'No pasa a Cancelados. El stock devuelve '+fmt(fila.unidad)+' und. No se puede deshacer.',function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!r.ok){ showToast(r.error,'err'); if(r.stale) setTimeout(function(){reloadPage('salidas');},1200); return; }
        DATA.salidas=DATA.salidas.filter(function(x){return x._row!==rowNum;});
        _SAL.mantener=true;
        filterSalidas();
        PAGE_LOADED['stock']=false;
        showToast('Duplicado eliminado','ok');
      })
      .withFailureHandler(function(e){ showToast(e.message,'err'); })
      .eliminarSalidaDuplicada(S.token,rowNum);
  },'Eliminar este');
}

function _salEstadoBadge(r){
  var cancelado=r.cancelado||r.estado==='cancelado'||r.estado==='CANCELADO';
  if(cancelado) return '—';
  var e=String(r.estado||'').trim();
  var eL=e.toLowerCase();
  if(eL==='entregado') return '<span style="background:var(--teal-bg,#d1fae5);color:var(--teal,#065f46);font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600">'+e+'</span>';
  if(e) return '<span style="background:var(--warn-bg,#fef3c7);color:var(--warn,#92400e);font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600">'+e+'</span>';
  return '<span style="color:var(--text3);font-size:12px">—</span>';
}

function _salRevisionCell(r){
  var cancelado=r.cancelado||r.estado==='cancelado'||r.estado==='CANCELADO';
  if(cancelado) return '—';
  var rev=String(r.revision||'').trim();
  var est=String(r.estado||'').trim();
  if(rev.toLowerCase()==='entregado') return '<span style="color:var(--teal,#065f46);font-size:16px;font-weight:600">'+ICO('check',16,'s')+'</span>';
  // Mostrar botón si estado tiene cualquier valor y revision está vacío
  // No comparar texto exacto — la fórmula puede devolver cualquier variante
  if(!est) return '<span style="color:var(--text3);font-size:12px">—</span>';
  return '<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px;border-radius:5px;white-space:nowrap" '+
    'onclick="confirmarRecepcion('+r._row+',this)">Confirmar recepción</button>';
}

function confirmarRecepcion(rowNum, btn){
  btn.disabled=true;
  btn.textContent='...';
  google.script.run
    .withSuccessHandler(function(res){
      if(res&&res.ok){
        // Actualizar la fila localmente sin recargar toda la tabla
        var td=btn.closest('tr');
        if(td){
          var cells=td.querySelectorAll('td');
          // col Estado = penúltima - 2, col Revisión = penúltima - 1
          var nCols=cells.length;
          if(nCols>=3){
            cells[nCols-3].innerHTML='<span style="background:var(--teal-bg,#d1fae5);color:var(--teal,#065f46);font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600">Entregado</span>';
            cells[nCols-2].innerHTML='<span style="color:var(--teal,#065f46);font-size:16px;font-weight:600">'+ICO('check',16,'s')+'</span>';
          }
        }
      } else {
        btn.disabled=false;
        btn.textContent='Confirmar recepción';
        showToast('Error: '+(res&&res.error?res.error:'Error desconocido'),'err');
      }
    })
    .withFailureHandler(function(e){
      btn.disabled=false;
      btn.textContent='Confirmar recepción';
      showToast('Error de red: '+e.message,'err');
    })
    .marcarEntregado(S.token,rowNum);
}

// ── Resumen de Envases (Retornables y Venta por tamaño) ──
// Tamaños canónicos que siempre se muestran (en orden)
var SAL_TAMANOS = ['310','630','1000'];
var _SAL_EST=''; // filtro de estado: '', 'pen' (por confirmar), 'ent' (entregado), 'cx' (cancelado)

// Estado de una línea de salida (coincide con el botón "Confirmar recepción")
function _salEstadoLinea(r){
  if(r.cancelado||String(r.estado||'').toLowerCase()==='cancelado') return 'cx';
  var est=String(r.estado||'').trim(), rev=String(r.revision||'').trim().toLowerCase();
  if(rev==='entregado') return 'ent';
  if(est) return 'pen';
  return 'sin';
}

// Líneas que cumplen búsqueda y fecha (antes del filtro de estado)
function _salBase(){
  var q = ((document.getElementById('sal-busq')||{}).value||'').toLowerCase();
  var rows = DATA.salidas.filter(function(r) {
    return !q||(r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||
      r.nroPedido.toLowerCase().indexOf(q)>-1||String(r.motorizado||'').toLowerCase().indexOf(q)>-1);
  });
  return _applyFiltroFecha('sal', rows).sort(function(a,b){return b._row-a._row;});
}

function _salEnvasesHTML(rows){
  var ret={}, ven={};
  rows.forEach(function(r){
    var env=String(r.envases||'').trim().toLowerCase(), tam=String(r.tamano||'').trim(), und=r.unidad||0;
    if(!tam) return;
    if(env==='retornable') ret[tam]=(ret[tam]||0)+und;
    else if(env==='venta') ven[tam]=(ven[tam]||0)+und;
  });
  var bloque=function(titulo,color,o){
    var tot=0; SAL_TAMANOS.forEach(function(t){tot+=o[t]||0;});
    return '<div><div class="sal2-envh"><b>'+fmt(tot)+'</b><span><em style="background:'+color+'"></em>'+titulo+'</span></div>'+
      SAL_TAMANOS.map(function(t){
        var v=o[t]||0, pct=tot>0?Math.round(v/tot*100):0;
        return '<div class="sal2-sz"'+(v?'':' style="opacity:.35"')+'><span>'+t+' ml</span><div class="sal2-bar"><i style="width:'+pct+'%;background:'+color+'"></i></div><b>'+fmt(v)+'</b></div>';
      }).join('')+'</div>';
  };
  return bloque('Retornables','var(--ok)',ret)+bloque('Venta','var(--warn)',ven);
}

function _filterSalidas(){
  var base = _salBase();
  var c={pen:0,ent:0,cx:0}, vivas=[];
  base.forEach(function(r){ var e=_salEstadoLinea(r); if(c[e]!==undefined) c[e]++; if(e!=='cx') vivas.push(r); });

  var seg=function(k,txt,n){return '<button class="'+(_SAL_EST===k?'on':'')+'" onclick="salSetEstado(\''+k+'\')">'+txt+'<span>'+n+'</span></button>';};
  document.getElementById('sal-est').innerHTML=seg('','Todos',base.length)+seg('pen','Por confirmar',c.pen)+seg('ent','Entregados',c.ent)+(c.cx?seg('cx','Cancelados',c.cx):'');

  var filtered = _getFilteredRows('salidas');

  // Resumen (sin contar líneas canceladas)
  var stats = vivas.reduce(function(acc, r){
    acc.totalUnd += r.unidad;
    if(r.nroPedido && r.nroPedido.trim() !== ''){
      acc.pedidos.add(r.nroPedido);
      if(r._row > acc.ultimoRow){ acc.ultimoRow = r._row; acc.ultimoPedido = r.nroPedido; acc.ultimoFecha=r.fecha; acc.ultimoHora=r.hora; }
    }
    return acc;
  }, {totalUnd:0, pedidos: new Set(), ultimoRow:-1, ultimoPedido:'', ultimoFecha:'', ultimoHora:''});
  var el;
  if(el=document.getElementById('sal-stat-total')) el.textContent=fmt(stats.pedidos.size);
  if(el=document.getElementById('sal-stat-und'))   el.textContent=fmt(stats.totalUnd);
  if(el=document.getElementById('sal-prod'))       el.textContent=fmt(vivas.length)+(vivas.length===1?' línea de producto':' líneas de producto');
  if(el=document.getElementById('sal-ultimo')){
    var rel=_salTiempoRelativo(stats.ultimoFecha, stats.ultimoHora);
    el.innerHTML=stats.ultimoPedido?'<div class="sal2-k sal2-k4">Último pedido</div><span class="sal-ped sal2-pc">'+esc(stats.ultimoPedido)+'</span>'+
      (rel?'<span class="sal2-ago">'+ICO('reloj',13)+rel+'</span>':''):'<div class="sal2-k sal2-k4">Último pedido</div><span class="sal2-ago">Sin pedidos en este período</span>';
  }
  if(el=document.getElementById('sal-env')) el.innerHTML=_salEnvasesHTML(vivas);

  if(el=document.getElementById('sal-count')) el.textContent = filtered.length + ' registros';

  // Rendimiento: se dibujan de a 60 filas y, al bajar, se agregan las siguientes (con miles de filas la tabla entera tardaba segundos).
  _SAL.lista=filtered;
  _SAL.n=0;
  var hasta=_SAL.mantener?Math.max(_SAL.lote,_SAL.hasta||0):_SAL.lote;
  _SAL.mantener=false;
  var t = document.getElementById('salidas-tbody');
  if(!t) return;
  if(!filtered.length){ t.innerHTML='<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:40px">Sin registros</td></tr>'; _salVigilar(null); return; }
  t.innerHTML='';
  _salMas(hasta);
}

var _SAL={ lista:[], n:0, lote:60, hasta:0, mantener:false, obs:null };
function _salFila(r){
  var cancelado=r.cancelado||r.estado==='cancelado'||r.estado==='CANCELADO';
  var trStyle=cancelado?'opacity:0.45;':'';
  var descCell=cancelado
    ? '<td class="td-desc" title="'+esc(r.desc)+'"><span style="text-decoration:line-through">'+esc(r.desc)+'</span> <span style="background:var(--danger-bg,#fee2e2);color:var(--danger,#dc2626);font-size:10px;padding:1px 6px;border-radius:4px;font-weight:600;vertical-align:middle">cancelado</span></td>'
    : '<td class="td-desc" title="'+esc(r.desc)+'">'+esc(r.desc)+'</td>';
  return '<tr'+(_salFlash[r._row]?' class="flash-new"':'')+' style="'+trStyle+'">'+
    '<td class="mono" style="font-size:12px">'+esc(r.fecha)+'</td>'+
    '<td class="mono col-hide-mobile" style="font-size:12px;color:var(--text3)">'+esc(r.hora)+'</td>'+
    '<td class="pedido-link">'+(r.nroPedido?'<span class="sal-ped">'+esc(r.nroPedido)+'</span>':'<span style="color:var(--text4)">—</span>')+'</td>'+
    '<td class="mono col-hide-mobile">'+esc(r.sku)+'</td>'+
    descCell+
    '<td class="col-hide-mobile" style="font-size:12px">'+(r.marca?'<span class="brand-pill">'+esc(r.marca)+'</span>':'<span style="color:var(--text4)">—</span>')+'</td>'+
    '<td class="r col-hide-mobile">'+fmt(r.pack)+'</td>'+
    '<td class="r" style="font-weight:600">'+fmt(r.unidad)+'</td>'+
    '<td class="c col-hide-mobile" style="font-size:11px;color:var(--text3);white-space:nowrap">'+esc(r.motorizado||'—')+'</td>'+
    '<td class="r col-hide-mobile" style="font-size:12px">'+esc(r.envases||'—')+'</td>'+
    '<td class="c col-hide-mobile">'+_salEstadoBadge(r)+'</td>'+
    '<td class="c col-hide-mobile" style="white-space:nowrap">'+_salRevisionCell(r)+'</td>'+
    '<td class="c col-hide-mobile" style="white-space:nowrap;width:210px;padding-right:16px">'+_salMenuContextual(r)+'</td>'+
  '</tr>';
}
// Dibuja filas hasta llegar a `hasta` (o un lote más si no se indica) y deja una marca al final para seguir al bajar.
function _salMas(hasta){
  var t=document.getElementById('salidas-tbody'); if(!t) return;
  var marca=document.getElementById('sal-mas'); if(marca) marca.remove();
  var desde=_SAL.n, tope=Math.min(hasta||desde+_SAL.lote,_SAL.lista.length), h='', i;
  for(i=desde;i<tope;i++) h+=_salFila(_SAL.lista[i]);
  _SAL.n=tope; _SAL.hasta=tope;
  if(tope<_SAL.lista.length) h+='<tr id="sal-mas"><td colspan="13" style="text-align:center;color:var(--text3);padding:14px;font-size:12px">Mostrando '+tope+' de '+_SAL.lista.length+'…</td></tr>';
  t.insertAdjacentHTML('beforeend',h);
  _salVigilar(document.getElementById('sal-mas'));
}
function _salVigilar(marca){
  if(_SAL.obs){ _SAL.obs.disconnect(); _SAL.obs=null; }
  if(!marca) return;
  if(!('IntersectionObserver' in window)){ while(_SAL.n<_SAL.lista.length) _salMas(); return; }
  _SAL.obs=new IntersectionObserver(function(es){ if(es[0].isIntersecting) _salMas(); },{rootMargin:'600px 0px'});
  _SAL.obs.observe(marca);
}

function salSetEstado(k){ _SAL_EST=(_SAL_EST===k?'':k); _filterSalidas(); }

// Exportar salidas filtradas a Excel
function exportSalidas(){
  if(S&&S.rol!=='store'){
    var HDR=['Fecha','Hora','SKU','Nro. Pedido','Descripción','Pack','Unidad','Marca','Motorizado','Envases','Estado','Revisión','Tamaño'];
    var CW=[{wch:12},{wch:8},{wch:14},{wch:14},{wch:36},{wch:8},{wch:8},{wch:14},{wch:16},{wch:10},{wch:12},{wch:12},{wch:10}];
    _exportConSpinner('btn-export-salidas','salidas',function(sedes){
      _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:HDR,rows:s.data,colWidths:CW,
        mapFn:function(r){return[r.fecha,r.hora,r.sku,r.nroPedido,r.desc,r.pack,r.unidad,r.marca||'',r.motorizado||'',r.envases||'',r.estado||'',r.revision||'',r.tamano||''];}};}),'salidas_sedes');
    });return;
  }
  var rows=_getFilteredRows('salidas');
  if(!rows.length){showToast('No hay datos para exportar','err');return;}
  var ws_data=[['Fecha','Hora','SKU','Nro. Pedido','Descripción','Pack','Unidad','Marca','Motorizado','Envases','Estado','Revisión','Tamaño']];
  rows.forEach(function(r){ws_data.push([r.fecha,r.hora,r.sku,r.nroPedido,r.desc,r.pack,r.unidad,r.marca||'',r.motorizado||'',r.envases||'',r.estado||'',r.revision||'',r.tamano||'']);});
  var wb=XLSX.utils.book_new();var ws=XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols']=[{wch:12},{wch:8},{wch:14},{wch:14},{wch:36},{wch:8},{wch:8},{wch:14},{wch:16},{wch:10},{wch:12},{wch:12},{wch:10}];
  XLSX.utils.book_append_sheet(wb,ws,'Salidas');XLSX.writeFile(wb,'salidas_'+_hoyISO()+'.xlsx');
  showToast('Excel descargado ('+rows.length+' registros)','ok');
}

function openSalidaForm(){
  EDIT_ROW=null;
  clearForm(['sal-sku','sal-ean','sal-desc','sal-nropedido','sal-pack','sal-unidad','sal-marca','sal-motorizado']);
  document.getElementById('fs-salida-title').textContent='Registrar Salida';
  document.getElementById('btn-sal-save').textContent='Guardar salida';
  document.getElementById('sal-err').textContent='';
  openFS('fs-salida');
}

function guardarSalida(){
  var sku=document.getElementById('sal-sku').value.trim();
  var pack=document.getElementById('sal-pack').value;
  var und=document.getElementById('sal-unidad').value;
  var err=document.getElementById('sal-err');
  if(!sku||!pack||!und){err.textContent='SKU, Pack y Unidades son obligatorios';return;}
  var fila={sku:sku,desc:document.getElementById('sal-desc').value,
    nroPedido:document.getElementById('sal-nropedido').value,
    pack:Number(pack),unidad:Number(und),
    marca:document.getElementById('sal-marca').value,
    motorizado:document.getElementById('sal-motorizado').value};
  err.textContent='';
  var btn=document.getElementById('btn-sal-save');
  var btnLabel=EDIT_ROW?'Guardar cambios':'Guardar salida';
  btn.disabled=true;btn.textContent='Guardando...';

  if(EDIT_ROW){
    // EDITAR — actualizar fila existente en DATA local
    var editRow=EDIT_ROW;
    google.script.run
      .withSuccessHandler(function(r){
        btn.disabled=false;btn.textContent=btnLabel;
        if(!r.ok){err.textContent=r.error;return;}
        // Actualizar DATA.salidas localmente sin recargar
        var idx=DATA.salidas.findIndex(function(x){return x._row===editRow;});
        if(idx>-1) DATA.salidas[idx]=Object.assign(DATA.salidas[idx],fila);
        closeFS('fs-salida');
        filterSalidas();
        showToast('Salida actualizada','ok');
      })
      .withFailureHandler(function(e){btn.disabled=false;btn.textContent=btnLabel;err.textContent=e.message;})
      .editarSalida(S.token,EDIT_ROW,fila);
  } else {
    // NUEVO — el backend devuelve la fila insertada con su _row real
    google.script.run
      .withSuccessHandler(function(r){
        btn.disabled=false;btn.textContent=btnLabel;
        if(!r.ok){err.textContent=r.error;return;}
        // Insertar en DATA.salidas localmente sin recargar desde API
        if(r.inserted) DATA.salidas.push(r.inserted);
        closeFS('fs-salida');
        filterSalidas();
        showToast('Salida registrada','ok');
        // Marcar stock como stale (sin recarga forzada — se actualizará al navegar)
        PAGE_LOADED['stock']=false;
      })
      .withFailureHandler(function(e){btn.disabled=false;btn.textContent=btnLabel;err.textContent=e.message;})
      .registrarSalida(S.token,fila);
  }
}

/* ── AGREGAR PEDIDO A MANO (varias líneas, con buscador en maestro y Stock) ── */
var PED={n:0,lineas:{},res:{},timers:{}};

function abrirPedidoManual(){
  PED={n:0,lineas:{},res:{},timers:{}};
  document.getElementById('ped-nro').value='';
  var f=document.getElementById('ped-fecha'); f.value=_hoyISO(); f.max=_hoyISO();
  document.getElementById('ped-moto').value='';
  document.getElementById('ped-lineas').innerHTML='';
  document.getElementById('ped-err').textContent='';
  var b=document.getElementById('btn-ped-save'); b.disabled=false; b.textContent='Guardar pedido';
  pedAgregarLinea();
  openFS('fs-pedido');
}

function pedAgregarLinea(){
  var id=++PED.n;
  PED.lineas[id]={sku:'',desc:'',factor:1,pack:1,und:'',undManual:false};
  var d=document.createElement('div');
  d.id='pl-'+id;
  d.style.cssText='border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px';
  d.innerHTML=
    '<div style="display:flex;gap:8px;align-items:flex-start">'+
      '<div class="autocomplete-wrap" style="flex:1">'+
        '<input class="inp" id="pl-q-'+id+'" placeholder="Busca por descripción o SKU..." autocomplete="off" oninput="pedBuscar('+id+')"/>'+
        '<div class="ac-list" id="pl-ac-'+id+'"></div>'+
      '</div>'+
      '<button class="btn btn-ghost btn-sm" title="Quitar producto" onclick="pedQuitarLinea('+id+')">'+ICO('x',14,'s')+'</button>'+
    '</div>'+
    '<div id="pl-sel-'+id+'" style="font-size:12px;color:var(--text3)">Elige un producto de la lista</div>'+
    '<div style="display:flex;gap:10px">'+
      '<div style="flex:1"><div class="form-label">Pack <span class="req">*</span></div><input class="inp" id="pl-pack-'+id+'" type="number" min="1" step="1" value="1" oninput="pedCambioPack('+id+')"/></div>'+
      '<div style="flex:1"><div class="form-label">Unidades <span class="req">*</span></div><input class="inp" id="pl-und-'+id+'" type="number" readonly tabindex="-1" placeholder="Se calcula solo" style="opacity:.8;cursor:default"/></div>'+
    '</div>';
  document.getElementById('ped-lineas').appendChild(d);
}

function pedQuitarLinea(id){
  var d=document.getElementById('pl-'+id); if(d) d.remove();
  delete PED.lineas[id];
  if(!Object.keys(PED.lineas).length) pedAgregarLinea();
}

function pedBuscar(id){
  var l=PED.lineas[id]; if(!l) return;
  // Si vuelve a escribir, la selección anterior ya no vale
  l.sku=''; l.desc='';
  document.getElementById('pl-und-'+id).value='';
  document.getElementById('pl-sel-'+id).textContent='Elige un producto de la lista';
  clearTimeout(PED.timers[id]);
  var q=document.getElementById('pl-q-'+id).value.trim();
  var list=document.getElementById('pl-ac-'+id);
  if(q.length<2){list.classList.remove('open');return;}
  PED.timers[id]=setTimeout(function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!PED.lineas[id]||!r||!r.ok)return;
        if(!r.results.length){list.innerHTML='<div class="ac-item"><div class="ac-desc">Sin resultados</div></div>';list.classList.add('open');return;}
        PED.res[id]=r.results;
        list.innerHTML=r.results.map(function(x,i){
          return '<div class="ac-item" onclick="pedElegir('+id+','+i+')">'+
            '<div class="ac-sku">'+esc(x.sku)+(x.fuente==='maestro'?' · '+fmt(x.factor)+' und. por pack':' · Stock')+'</div>'+
            '<div class="ac-desc">'+esc(x.desc)+'</div>'+
          '</div>';
        }).join('');
        list.classList.add('open');
      })
      .withFailureHandler(function(){list.classList.remove('open');})
      .buscarProductoPedido(S.token,q);
  },300);
}

function pedElegir(id,i){
  var x=(PED.res[id]||[])[i], l=PED.lineas[id]; if(!x||!l) return;
  l.sku=x.sku; l.desc=x.desc; l.factor=x.factor||1;
  document.getElementById('pl-q-'+id).value=x.desc||x.sku;
  document.getElementById('pl-ac-'+id).classList.remove('open');
  document.getElementById('pl-sel-'+id).textContent='SKU '+x.sku+(x.fuente==='maestro'
    ? ' · '+fmt(x.factor)+' und. por pack (maestro)'
    : ' · producto del Stock, no está en el maestro: se cuenta 1 unidad por pack');
  pedCambioPack(id);
}

function pedCambioPack(id){
  var l=PED.lineas[id]; if(!l) return;
  var p=parseInt(document.getElementById('pl-pack-'+id).value,10);
  document.getElementById('pl-und-'+id).value=(p>0&&l.sku)?p*l.factor:'';
}

function guardarPedidoManual(){
  var err=document.getElementById('ped-err');
  var nro=document.getElementById('ped-nro').value.trim().toUpperCase();
  if(!nro){err.textContent='Escribe el número de pedido';return;}
  var lineas=[], ids=Object.keys(PED.lineas);
  for(var k=0;k<ids.length;k++){
    var id=ids[k], l=PED.lineas[id];
    var pack=Number(document.getElementById('pl-pack-'+id).value);
    var und=Number(document.getElementById('pl-und-'+id).value);
    if(!l.sku){err.textContent='Producto '+(k+1)+': elige un producto de la lista';return;}
    if(!(pack>=1)||pack!==Math.floor(pack)){err.textContent='Producto '+(k+1)+': el pack debe ser un número entero mayor a 0';return;}
    if(!(und>=1)||und!==Math.floor(und)){err.textContent='Producto '+(k+1)+': las unidades deben ser un número entero mayor a 0';return;}
    lineas.push({sku:l.sku,desc:l.desc,pack:pack,unidad:und});
  }
  err.textContent='';
  var btn=document.getElementById('btn-ped-save');
  btn.disabled=true; btn.textContent='Guardando...';
  var fecha=document.getElementById('ped-fecha').value;
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false; btn.textContent='Guardar pedido';
      if(!r||!r.ok){err.textContent=(r&&r.error)||'No se pudo guardar el pedido';return;}
      closeFS('fs-pedido');
      showToast('Pedido '+nro+' registrado ('+r.filas+' producto'+(r.filas===1?'':'s')+')','ok');
      PAGE_LOADED['stock']=false;
      reloadPage('salidas');
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Guardar pedido';err.textContent=e.message;})
    .registrarPedidoManual(S.token,{nroPedido:nro,fecha:fecha,motorizado:document.getElementById('ped-moto').value.trim(),lineas:lineas});
}

var CANCEL_ROW=null;
var CANCEL_NRO=null;

// Wrapper seguro para botones generados dinámicamente — lee data-row y data-nro
// en lugar de recibir nroPedido como parámetro inline en onclick (evita XSS)
function abrirModalCancelarBtn(btn){
  var rowNum    = parseInt(btn.getAttribute('data-row'), 10);
  var nroPedido = btn.getAttribute('data-nro') || '';
  abrirModalCancelar(rowNum, nroPedido);
}

function abrirModalCancelar(rowNum, nroPedido){
  var fila = DATA.salidas.find(function(r){return r._row===rowNum;});
  if(!fila){showToast('Recarga la página — los datos están desactualizados.','err');return;}

  CANCEL_ROW = rowNum;
  CANCEL_NRO = nroPedido;

  var tieneNro = nroPedido && nroPedido.trim()!=='';
  var itemsDelPedido = tieneNro
    ? DATA.salidas.filter(function(r){return r.nroPedido===nroPedido;})
    : [fila];

  document.getElementById('modal-cancelar-info').innerHTML =
    tieneNro
      ? 'Pedido <strong>'+esc(nroPedido)+'</strong> — '+itemsDelPedido.length+' ítem(s) serán cancelados'
      : 'Registro sin Nro. de Pedido — se cancelará este ítem';

  // Preview tabla
  var previewHTML = '<table style="width:100%;border-collapse:collapse">'+
    '<thead><tr style="background:var(--surface2);font-weight:600">'+
      '<th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">SKU</th>'+
      '<th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)">Descripción</th>'+
      '<th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">Und.</th>'+
    '</tr></thead><tbody>';
  itemsDelPedido.forEach(function(r){
    previewHTML += '<tr>'+
      '<td style="padding:6px 10px;font-family:var(--font-mono);font-size:11px;border-bottom:1px solid var(--border)">'+esc(r.sku)+'</td>'+
      '<td style="padding:6px 10px;font-size:12px;border-bottom:1px solid var(--border)">'+esc(r.desc)+'</td>'+
      '<td style="padding:6px 10px;text-align:right;font-weight:600;border-bottom:1px solid var(--border)">'+fmt(r.unidad)+'</td>'+
    '</tr>';
  });
  previewHTML += '</tbody></table>';
  document.getElementById('modal-cancelar-preview').innerHTML = previewHTML;

  var btnLabel = itemsDelPedido.length > 1
    ? 'Cancelar pedido completo ('+itemsDelPedido.length+' ítems)'
    : 'Cancelar este registro';
  document.getElementById('btn-cancel-confirmar').textContent = btnLabel;

  // Resetear motivo cada vez que se abre el modal
  document.getElementById('modal-cancelar-motivo').value='';
  var motivoOtro = document.getElementById('modal-cancelar-motivo-otro');
  motivoOtro.value='';
  motivoOtro.style.display='none';

  document.getElementById('modal-cancelar').style.display = 'flex';
}

function onCambioMotivoCancelar(){
  var sel = document.getElementById('modal-cancelar-motivo');
  var otro = document.getElementById('modal-cancelar-motivo-otro');
  otro.style.display = (sel.value==='__otro__') ? 'block' : 'none';
  if(sel.value!=='__otro__') otro.value='';
}

function closeModalCancelar(){
  document.getElementById('modal-cancelar').style.display='none';
  // Resetear estado del botón — puede quedar disabled si la llamada anterior falló
  var btn = document.getElementById('btn-cancel-confirmar');
  if (btn) btn.disabled = false;
  CANCEL_ROW=null; CANCEL_NRO=null;
}

function confirmarCancelar(){
  if(!CANCEL_ROW) return;
  var selMotivo = document.getElementById('modal-cancelar-motivo');
  var otroMotivo = document.getElementById('modal-cancelar-motivo-otro');
  var motivo = (selMotivo.value==='__otro__') ? otroMotivo.value.trim() : selMotivo.value;
  if(!motivo){
    showToast('Selecciona o escribe el motivo de la cancelación.','err');
    return;
  }
  var rowNum = CANCEL_ROW;
  var nroPed = CANCEL_NRO;
  var btn = document.getElementById('btn-cancel-confirmar');
  if(btn) btn.disabled=true;
  closeModalCancelar();
  google.script.run
    .withSuccessHandler(function(r){
      if(btn) btn.disabled=false;
      if(!r.ok){
        if(r.stale){
          // El pedido ya no existe en la hoja — probablemente ya fue cancelado
          showToast('Este pedido ya no está en Salidas. Actualizando...','warn');
          setTimeout(function(){reloadPage('salidas');}, 1200);
        } else {
          showToast(r.error,'err');
        }
        return;
      }
      // Quitar del DATA local las filas canceladas (por nroPedido o solo la fila)
      var nro = r.nroPedido;
      if(nro){
        DATA.salidas = DATA.salidas.filter(function(x){return x.nroPedido!==nro;});
      } else {
        DATA.salidas = DATA.salidas.filter(function(x){return x._row!==rowNum;});
      }
      filterSalidas(); // re-renderizar tabla sin llamar al servidor
      showToast('Pedido cancelado ('+r.cancelados+' fila'+(r.cancelados>1?'s':'')+') a PD CANCELADOS','ok');
      // Forzar recarga inmediata de cancelados y marcar stock como stale
      PAGE_LOADED['stock']=false;
      reloadPage('cancelados');
    })
    .withFailureHandler(function(e){
      if(btn) btn.disabled=false;
      showToast(e.message,'err');
    })
    .cancelarSalida(S.token, rowNum, 'pedido', nroPed, motivo);
}
