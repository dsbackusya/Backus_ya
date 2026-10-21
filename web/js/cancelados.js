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

function renderCancelados(r){
  if(_handleExpired(r,'cancelados-root')) return;
  if(!r||!r.ok){errBox('cancelados-root',r&&r.error?r.error:'Error al cargar cancelados — revisa la hoja "PD CANCELADOS" en el spreadsheet','cancelados');return;}
  DATA.cancelados=r.data;
  var total=r.data.reduce(function(a,x){return a+(Number(x.unidad)||0);},0);
  var pedidos=[...new Set(r.data.map(function(x){return x.nroPedido;}).filter(Boolean))].length;
  // Aviso si se están mostrando solo los últimos N registros
  var avisoTotal = r.total && r.total > r.data.length
    ? '<div style="background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:var(--r);padding:8px 14px;font-size:12px;color:var(--warn);margin-bottom:16px;font-family:var(--font-mono)">'+
        ICO('warn',13)+'Mostrando los últimos '+r.data.length+' de '+r.total+' registros totales. Usa el filtro de fecha para buscar registros anteriores.'+
      '</div>'
    : '';
  document.getElementById('cancelados-root').innerHTML=
    avisoTotal+
    '<div class="stats">'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div><div class="stat-label">Total ítems</div><div class="stat-val-row"><div class="stat-val" id="canc-stat-items">'+r.data.length+'</div><span class="stat-unit-pill">ítems</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-label">Pedidos únicos</div><div class="stat-val-row"><div class="stat-val" id="canc-stat-pedidos" style="color:var(--warn)">'+pedidos+'</div><span class="stat-unit-pill">pedidos</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><line x1="3.27" y1="6.96" x2="12" y2="12.01"/><line x1="20.73" y1="6.96" x2="12" y2="12.01"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="stat-label">Unidades canceladas</div><div class="stat-val-row"><div class="stat-val" id="canc-stat-und" style="color:var(--danger)">'+fmt(total)+'</div><span class="stat-unit-pill">und.</span></div></div>'+
    '</div>'+
    '<div class="filters" style="flex-wrap:wrap;gap:8px;align-items:center">'+
      '<input class="filter-inp" id="canc-busq" placeholder="Buscar SKU, pedido, descripción..." style="width:240px" oninput="filterCancelados()"/>'+
      _fechaFiltroHTML('canc','filterCancelados','cancRangoCambio')+
      '<span class="result-count" id="canc-count"></span>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr>'+
        '<th>Fecha</th><th>Hora</th><th>SKU</th><th>Nro. Pedido</th><th>Descripción</th>'+
        '<th class="r">Pack</th><th class="r">Und.</th><th>Marca</th>'+
        '<th class="c">Motor.</th><th class="r">Envases</th>'+
        '<th class="c">Estado</th><th class="c">Revisión</th><th>Motivo</th>'+
        (S&&S.rol==='store'?'<th class="c"></th>':'')+
      '</tr></thead>'+
      '<tbody id="cancelados-tbody"></tbody>'+
    '</table></div>';
  _initFiltroFecha('canc','filterCancelados',{page:'cancelados'});
  filterCancelados();
}

function _filterCancelados(){
  var q=((document.getElementById('canc-busq')||{}).value||'').toLowerCase();
  var rows=(DATA.cancelados||[]).filter(function(r){
    return !q||
      (r.sku||'').toLowerCase().indexOf(q)>-1||
      (r.desc||'').toLowerCase().indexOf(q)>-1||
      (r.nroPedido||'').toLowerCase().indexOf(q)>-1||
      (r.marca||'').toLowerCase().indexOf(q)>-1;
  });
  rows=_applyFiltroFecha('canc',rows);
  rows.sort(function(a,b){return b._row-a._row;});
  var totalUnd=rows.reduce(function(a,x){return a+(Number(x.unidad)||0);},0);
  var pedUnicos=new Set(rows.map(function(x){return x.nroPedido;}).filter(Boolean)).size;
  var si=document.getElementById('canc-stat-items');   if(si)si.textContent=rows.length;
  var sp=document.getElementById('canc-stat-pedidos'); if(sp)sp.textContent=pedUnicos;
  var su=document.getElementById('canc-stat-und');     if(su)su.textContent=fmt(totalUnd);
  var el=document.getElementById('canc-count');
  if(el)el.textContent=rows.length+' registros';
  var tbody=rows.map(function(r){
    return '<tr>'+
      '<td class="mono" style="font-size:12px">'+esc(r.fecha)+'</td>'+
      '<td class="mono" style="font-size:12px;color:var(--text3)">'+esc(r.hora)+'</td>'+
      '<td class="mono">'+esc(r.sku)+'</td>'+
      '<td class="mono pedido-link" style="font-size:11.5px;color:var(--danger)">'+esc(r.nroPedido||'—')+'</td>'+
      '<td class="td-desc" title="'+esc(r.desc)+'">'+esc(r.desc)+'</td>'+
      '<td class="r">'+fmt(r.pack)+'</td>'+
      '<td class="r" style="font-weight:700;color:var(--danger)">'+fmt(r.unidad)+'</td>'+
      '<td style="font-size:12px">'+(r.marca?'<span class="brand-pill">'+esc(r.marca)+'</span>':'<span style="color:var(--text4)">—</span>')+'</td>'+
      '<td class="c" style="font-size:12px;color:var(--text3)">'+esc(r.motorizado||'—')+'</td>'+
      '<td class="r" style="font-size:12px">'+esc(r.envases||'—')+'</td>'+
      '<td class="c"><span style="background:var(--danger-bg);color:var(--danger);font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600">'+esc(r.estado||'Cancelado')+'</span></td>'+
      '<td class="c" style="font-size:12px;color:var(--text3)">'+esc(r.revision||'—')+'</td>'+
      '<td style="font-size:12px" title="'+esc(r.motivo)+'">'+esc(r.motivo||'—')+'</td>'+
      (S&&S.rol==='store'&&r.nroPedido?'<td class="c" style="white-space:nowrap"><button class="btn btn-ghost btn-sm" title="Devolver este pedido a Salidas" data-nro="'+esc(r.nroPedido)+'" onclick="anularCancAbrir(this.dataset.nro)">'+ICO('undo',12)+'Anular</button></td>':(S&&S.rol==='store'?'<td></td>':''))+
    '</tr>';
  }).join('');
  var t=document.getElementById('cancelados-tbody');
  if(t)t.innerHTML=tbody||'<tr><td colspan="14" style="text-align:center;color:var(--text3);padding:40px">Sin cancelados</td></tr>';
}

/* ── Anular una cancelación (el pedido vuelve a Salidas) ── */
var _ANUL_NRO=null;
function anularCancAbrir(nro){
  var filas=(DATA.cancelados||[]).filter(function(r){return r.nroPedido===nro;});
  if(!filas.length){showToast('Recarga la página — los datos están desactualizados.','err');return;}
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
