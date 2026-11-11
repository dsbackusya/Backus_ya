/* Pantalla Cancelados — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   CANCELADOS
══════════════════════════════════════ */
function skeletonCancelados(){
  var cols=[48,40,90,200,90,36,36]; // anchos aprox por columna
  var rows='';
  for(var i=0;i<8;i++){
    var w=80+Math.floor(Math.sin(i*1.7)*18); // variación sutil de ancho
    rows+='<div class="sk-table-row">'+
      cols.map(function(c,ci){
        var pct=ci===3?100:Math.min(100,Math.round(c*(0.7+Math.random()*0.5)));
        return '<div class="sk-block sk-shimmer" style="width:'+pct+'px;flex:'+(ci===3?'1':'0 0 '+c+'px')+'"></div>';
      }).join('')+
    '</div>';
  }
  return '<div class="sk-stats">'+
    ['','',''].map(function(){
      return '<div class="sk-stat-card">'+
        '<div class="sk-block sk-shimmer" style="width:70px;height:11px"></div>'+
        '<div class="sk-block sk-shimmer" style="width:50px;height:28px"></div>'+
      '</div>';
    }).join('')+
  '</div>'+
  '<div class="sk-filters">'+
    '<div class="sk-block sk-shimmer" style="width:240px;height:32px;border-radius:8px"></div>'+
    '<div class="sk-block sk-shimmer" style="width:110px;height:32px;border-radius:8px"></div>'+
    '<div class="sk-block sk-shimmer" style="width:110px;height:32px;border-radius:8px"></div>'+
  '</div>'+
  '<div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;padding:0 16px">'+rows+'</div>';
}

function loadCancelados(){
  if(!S||!S.token){errBox('cancelados-root','Sin sesión activa. Recarga la página.','cancelados');PAGE_LOADING['cancelados']=false;return;}
  document.getElementById('cancelados-root').innerHTML=skeletonCancelados();
  var force=!!_FORCE_REFRESH['cancelados']; _FORCE_REFRESH['cancelados']=false;
  var t = (REQ_TOKEN.cancelados = (REQ_TOKEN.cancelados||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.cancelados) return;
      PAGE_LOADING['cancelados']=false;
      if(r===null||r===undefined){
        // GAS retornó null — problema de serialización, reintentar una vez
        google.script.run
          .withSuccessHandler(function(r2){
            if(t !== REQ_TOKEN.cancelados) return;
            if(!r2){errBox('cancelados-root','Error del servidor al cargar cancelados. Recarga la página.','cancelados');return;}
            renderCancelados(r2);
          })
          .withFailureHandler(function(e2){
            if(t !== REQ_TOKEN.cancelados) return;
            errBox('cancelados-root',e2.message,'cancelados');
          })
          .getCancelados(S.token, true, window.canc_rango||null);
        return;
      }
      renderCancelados(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.cancelados) return;
      PAGE_LOADING['cancelados']=false;errBox('cancelados-root',e.message,'cancelados');
    })
    .getCancelados(S.token, force, window.canc_rango||null);
}

var CANC_OPEN={};   // pedidos abiertos en la tabla
var _CANC_CHEV='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';
var _CANC_UNDO='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>';

function renderCancelados(r){
  if(_handleExpired(r,'cancelados-root')) return;
  if(!r||!r.ok){errBox('cancelados-root',r&&r.error?r.error:'Error al cargar cancelados, revisa la hoja "PD CANCELADOS" en el spreadsheet','cancelados');return;}
  DATA.cancelados=r.data;
  CANC_OPEN={};
  var icoExportar='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  // Los motivos del selector salen de lo que trae el servidor para el rango elegido
  var motivos=[...new Set(r.data.map(function(x){return (x.motivo||'').trim();}).filter(Boolean))].sort();
  // Mismo patrón que Salidas, Entradas, Conteo, Documentos y Validación: tres tarjetas de resumen + panel violeta con tabla hundida
  document.getElementById('cancelados-root').innerHTML=
    '<div class="sal2-sum" id="canc-sum"></div>'+
    '<div class="sal2-pnl">'+
    '<div class="sal2-fl">'+
      '<div class="sal2-srch">'+icoBuscar+
        '<input id="canc-busq" placeholder="Buscar SKU, pedido, descripción..." aria-label="Buscar SKU, pedido o descripción" autocomplete="off" oninput="filterCancelados()"/></div>'+
      '<select class="inp" id="canc-motivo" aria-label="Motivo" onchange="filterCancelados()"><option value="">Todos los motivos</option>'+
        motivos.map(function(m){return '<option>'+esc(m)+'</option>';}).join('')+'</select>'+
      _fechaFiltroHTML('canc','filterCancelados','cancRangoCambio')+
      '<span class="sal2-cnt" id="canc-count"></span>'+
      '<button id="btn-export-cancelados" class="sal2-exp" onclick="exportCancelados()">'+icoExportar+'Exportar</button>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr>'+
        '<th>Pedido</th><th class="col-hide-mobile">Motorizado</th><th class="col-hide-mobile">Motivo</th>'+
        '<th class="c">Ítems</th><th class="r">Und.</th><th class="c col-hide-mobile">Estado</th>'+
        '<th style="width:1%"></th>'+
      '</tr></thead>'+
      '<tbody id="cancelados-tbody"></tbody>'+
    '</table></div>'+
    '</div>';
  _initFiltroFecha('canc','filterCancelados',{page:'cancelados'});
  _cancDelegar();
  _cancResumenAnim=false;
  filterCancelados();
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ _cancResumenAnim=true; var s=document.getElementById('canc-sum'); if(s) s.classList.add('cn-go'); }); });
}
var _cancResumenAnim=false;   // las barras de motivos se llenan una sola vez al cargar; al filtrar se quedan llenas

/* Lo que se ve en pantalla y lo que se exporta salen de la misma función: búsqueda, motivo y fecha */
function _cancFiltradas(){
  var q=((document.getElementById('canc-busq')||{}).value||'').toLowerCase();
  var mot=(document.getElementById('canc-motivo')||{}).value||'';
  var rows=(DATA.cancelados||[]).filter(function(r){
    if(mot&&(r.motivo||'').trim()!==mot) return false;
    return !q||
      (r.sku||'').toLowerCase().indexOf(q)>-1||
      (r.desc||'').toLowerCase().indexOf(q)>-1||
      (r.nroPedido||'').toLowerCase().indexOf(q)>-1||
      (r.marca||'').toLowerCase().indexOf(q)>-1;
  });
  rows=_applyFiltroFecha('canc',rows);
  rows.sort(function(a,b){return b._row-a._row;});
  return rows;
}
/* Una fila por pedido (los ítems de un mismo pedido van juntos); un ítem sin número de pedido queda solo */
function _cancPedidos(rows){
  var map={}, list=[];
  rows.forEach(function(r){
    var k=r.nroPedido?String(r.nroPedido):'sin:'+r._row;
    if(!map[k]){ map[k]={ k:k, nro:r.nroPedido||'', fecha:r.fecha, hora:r.hora, motor:r.motorizado||'', motivo:r.motivo||'', estado:r.estado||'Cancelado', items:[] }; list.push(map[k]); }
    map[k].items.push(r);
  });
  return list;
}
function _cancUnd(p){ return p.items.reduce(function(a,x){return a+(Number(x.unidad)||0);},0); }

function _cancResumen(L,items){
  var el=document.getElementById('canc-sum'); if(!el) return;
  var und=L.reduce(function(a,p){return a+_cancUnd(p);},0), m={};
  L.forEach(function(p){ var k=(p.motivo||'').trim()||'Sin motivo'; m[k]=(m[k]||0)+1; });
  var top=Object.keys(m).map(function(k){return [k,m[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,3), mx=top.length?top[0][1]:1;
  var pedidos=L.filter(function(p){return p.nro;}).length;
  el.className='sal2-sum'+(_cancResumenAnim?' cn-go':'');
  el.innerHTML=
    '<div class="sal2-card cn-card"><div class="sal2-k">Unidades canceladas</div><div class="sal2-v">'+fmt(und)+'<small>und.</small></div><div class="sal2-n">en '+items+(items===1?' ítem':' ítems')+'</div></div>'+
    '<div class="sal2-card cn-card"><div class="sal2-k">Pedidos únicos</div><div class="sal2-v">'+pedidos+'</div><div class="sal2-n">'+(pedidos?(items/pedidos).toFixed(1).replace('.',',')+' ítems por pedido':'')+'</div></div>'+
    '<div class="sal2-card cn-card"><div class="sal2-k">Motivos más frecuentes</div>'+
      (top.length?'<div class="cn-mot">'+top.map(function(x){
        return '<div class="cn-mr"><span title="'+esc(x[0])+'">'+esc(x[0])+'</span><b>'+x[1]+(x[1]===1?' pedido':' pedidos')+'</b><div class="cn-mb"><i style="width:'+(x[1]/mx*100)+'%"></i></div></div>';
      }).join('')+'</div>':'<div class="cn-vacio-m">Sin cancelaciones en este filtro</div>')+'</div>';
}

function _filterCancelados(){
  var rows=_cancFiltradas();
  var L=_cancPedidos(rows);
  _cancResumen(L,rows.length);
  var el=document.getElementById('canc-count');
  if(el)el.textContent=L.length+(L.length===1?' pedido':' pedidos');
  var store=S&&S.rol==='store';
  var tbody=L.map(function(p){
    var o=!!CANC_OPEN[p.k], n=p.items.length, und=_cancUnd(p);
    var anular=(store&&p.nro)?'<div class="cn-a"><button class="cn-b" title="Devolver este pedido a Salidas" data-nro="'+esc(p.nro)+'" onclick="event.stopPropagation();anularCancAbrir(this.dataset.nro)">'+_CANC_UNDO+'Anular</button></div>':'';
    var h='<tr class="cn-g'+(o?' open':'')+'" data-k="'+esc(p.k)+'" tabindex="0" role="button" aria-expanded="'+o+'" aria-label="Pedido '+esc(p.nro||'sin número')+', '+n+(n===1?' ítem':' ítems')+', '+fmt(und)+' unidades">'+
      '<td><span class="cn-chev">'+_CANC_CHEV+'</span><span style="display:inline-block;vertical-align:middle"><div class="cn-nm"><span class="nro">'+esc(p.nro||'-')+'</span></div>'+
        '<div class="cn-sub">'+esc(p.fecha)+(p.hora?' · '+esc(p.hora):'')+'</div>'+
        '<div class="cn-mm">'+esc(p.motivo||'-')+(p.motor?' · '+esc(p.motor):'')+'</div></span></td>'+
      '<td class="cn-t col-hide-mobile">'+esc(p.motor||'-')+'</td>'+
      '<td class="cn-t col-hide-mobile" title="'+esc(p.motivo)+'">'+esc(p.motivo||'-')+'</td>'+
      '<td class="c"><span class="cn-pill">'+n+(n===1?' ítem':' ítems')+'</span></td>'+
      '<td class="r cn-und">'+fmt(und)+'</td>'+
      '<td class="c col-hide-mobile"><span class="sal-est cx"><i></i>'+esc(p.estado)+'</span></td>'+
      '<td class="r">'+anular+'</td></tr>';
    if(o) h+=p.items.map(function(x){
      return '<tr class="cn-r"><td><div class="cn-it"><b>'+esc(x.desc)+(x.marca?'<span class="cn-brand">'+esc(x.marca)+'</span>':'')+'</b>'+
        '<small>'+esc(x.sku)+(x.envases?' · Envases: '+esc(x.envases):'')+'</small></div></td>'+
        '<td class="cn-t mut col-hide-mobile">'+(x.revision?'Revisión: '+esc(x.revision):'')+'</td><td class="col-hide-mobile"></td>'+
        '<td class="c cn-t mut">'+fmt(x.pack)+' pack'+(Number(x.pack)===1?'':'s')+'</td><td class="r cn-und">'+fmt(x.unidad)+'</td><td class="col-hide-mobile"></td><td></td></tr>';
    }).join('');
    return h;
  }).join('');
  var t=document.getElementById('cancelados-tbody');
  if(t)t.innerHTML=tbody||'<tr><td colspan="7" class="cn-vacio">Sin cancelados.<br>Prueba con otra fecha, motivo, SKU o número de pedido.</td></tr>';
}

/* Un solo oyente en la tabla: clic o Enter/Espacio abren y cierran el pedido */
function _cancDelegar(){
  var t=document.getElementById('cancelados-tbody'); if(!t||t._cancDel) return;
  t._cancDel=true;
  var abrir=function(tr){
    var k=tr.dataset.k; CANC_OPEN[k]=!CANC_OPEN[k];
    _filterCancelados();
    var n=[].filter.call(t.querySelectorAll('tr.cn-g'),function(x){return x.dataset.k===k;})[0];
    if(n) n.focus({preventScroll:true});
  };
  t.addEventListener('click',function(e){ var tr=e.target.closest('tr.cn-g'); if(tr) abrir(tr); });
  t.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('cn-g')){ e.preventDefault(); abrir(e.target); }
  });
}

/* ── Anular una cancelación (el pedido vuelve a Salidas) ── */
var _ANUL_NRO=null;
function anularCancAbrir(nro){
  var filas=(DATA.cancelados||[]).filter(function(r){return r.nroPedido===nro;});
  if(!filas.length){showToast('Recarga la página: los datos están desactualizados.','err');return;}
  _ANUL_NRO=nro;
  var und=filas.reduce(function(a,x){return a+(Number(x.unidad)||0);},0);
  document.getElementById('modal-anular-canc-info').innerHTML=
    'El pedido <b class="mono">'+esc(nro)+'</b> ('+filas.length+' producto'+(filas.length===1?'':'s')+', '+fmt(und)+' und.) volverá a <b>Salidas</b> con su fecha y hora originales, y dejará de estar cancelado. '+
    (filas[0].motivo?'Motivo con que se canceló: <i>'+esc(filas[0].motivo)+'</i>.':'');
  document.getElementById('modal-anular-canc-preview').innerHTML=
    '<table style="width:100%"><tbody>'+filas.map(function(x){
      return '<tr><td class="mono" style="padding:6px 10px">'+esc(x.sku)+'</td><td style="padding:6px 10px">'+esc(x.desc)+'</td><td class="r" style="padding:6px 10px">'+fmt(x.unidad)+' und.</td></tr>';
    }).join('')+'</tbody></table>';
  document.getElementById('modal-anular-canc-err').textContent='';
  var b=document.getElementById('btn-anular-canc'); b.disabled=false; b.textContent='Devolver a Salidas';
  document.getElementById('modal-anular-canc').style.display='flex';
}
function anularCancCerrar(){ document.getElementById('modal-anular-canc').style.display='none'; _ANUL_NRO=null; }
function anularCancConfirmar(){
  var nro=_ANUL_NRO; if(!nro) return;
  var b=document.getElementById('btn-anular-canc'), err=document.getElementById('modal-anular-canc-err');
  b.disabled=true; b.textContent='Restaurando...'; err.textContent='';
  google.script.run
    .withSuccessHandler(function(r){
      if(!r||!r.ok){b.disabled=false;b.textContent='Devolver a Salidas';err.textContent=(r&&r.error)||'No se pudo anular la cancelación';return;}
      anularCancCerrar();
      showToast('Pedido '+nro+' devuelto a Salidas ('+r.filas+' producto'+(r.filas===1?'':'s')+')','ok');
      PAGE_LOADED['salidas']=false; PAGE_LOADED['stock']=false;
      reloadPage('cancelados');
    })
    .withFailureHandler(function(e){b.disabled=false;b.textContent='Devolver a Salidas';err.textContent=e.message;})
    .anularCancelado(S.token,nro);
}

function exportCancelados(){
  var rows = _getFilteredRows('cancelados');
  _exportXLSX(
    ['Fecha','Hora','SKU','Nro. Pedido','Descripción','Pack','Und.','Marca','Motorizado','Envases','Estado','Revisión','Motivo'],
    rows,
    function(r){return[r.fecha,r.hora,r.sku,r.nroPedido,r.desc,r.pack,r.unidad,r.marca||'',r.motorizado||'',r.envases||'',r.estado||'',r.revision||'',r.motivo||''];},
    'Cancelados','cancelados'
  );
}
