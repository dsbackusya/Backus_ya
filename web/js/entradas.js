/* Pantalla Entradas (formulario manual/archivo/PDF) y filtro de fecha compartido — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   ENTRADAS
══════════════════════════════════════ */
function loadEntradas(){
  dbg('[ENTRADAS] loadEntradas() — token='+(S&&S.token?S.token.slice(0,8)+'...':'NULL')+' force='+!!_FORCE_REFRESH['entradas']);
  if(!S||!S.token){errBox('entradas-root','Sin sesión activa. Recarga la página.','entradas');PAGE_LOADING['entradas']=false;return;}
  var force=!!_FORCE_REFRESH['entradas']; _FORCE_REFRESH['entradas']=false;
  var t = (REQ_TOKEN.entradas = (REQ_TOKEN.entradas||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.entradas) return; // response stale, descartar
      dbg('[ENTRADAS] respuesta servidor:', JSON.stringify(r).slice(0,200));
      if(r===null||r===undefined){
        // GAS retornó null — puede ser timeout o error de serialización al forzar refresco
        // Reintentar una vez sin force (leerá del caché si existe)
        console.warn('[ENTRADAS] respuesta null, reintentando sin force...');
        google.script.run
          .withSuccessHandler(function(r2){
            if(t !== REQ_TOKEN.entradas) return;
            PAGE_LOADING['entradas']=false;
            if(!r2){errBox('entradas-root','Error del servidor al cargar entradas. Recarga la página.','entradas');return;}
            renderEntradas(r2);
          })
          .withFailureHandler(function(e2){
            if(t !== REQ_TOKEN.entradas) return;
            PAGE_LOADING['entradas']=false;PAGE_LOADED['entradas']=false;errBox('entradas-root',e2.message,'entradas');
          })
          .getEntradas(S.token, false, window.ent_rango||null);
        return;
      }
      PAGE_LOADING['entradas']=false;renderEntradas(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.entradas) return;
      console.error('[ENTRADAS] failure handler:', e.message);
      PAGE_LOADING['entradas']=false;PAGE_LOADED['entradas']=false;errBox('entradas-root',e.message,'entradas');
    })
    .getEntradas(S.token, force, window.ent_rango||null);
}


/* ── FILTRO FECHA COMPARTIDO — Entradas, M-T, Cancelados ── */
function _hoyISO(){
  var h=new Date();
  return h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0')+'-'+String(h.getDate()).padStart(2,'0');
}
function _genUID(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
function _hoyDMY(){
  var h=new Date();
  return String(h.getDate()).padStart(2,'0')+'/'+String(h.getMonth()+1).padStart(2,'0')+'/'+h.getFullYear();
}
function _parseDataDMY(str){
  if(!str)return null;
  var p=str.split('/');
  return p.length===3?new Date(p[2],p[1]-1,p[0]):null;
}
function _parseISO(str){
  if(!str)return null;
  var p=str.split('-');
  return p.length===3?new Date(p[0],p[1]-1,p[2]):null;
}
// Devuelve el bloque HTML de filtros de fecha reutilizable por prefijo
// prefix ej: 'ent', 'mt', 'canc' — fnFilter: nombre de la función JS de filtro
function _fechaFiltroHTML(prefix, fnFilter, rangoFn){
  var evt = rangoFn ? 'onchange="'+rangoFn+'()"' : 'oninput="'+fnFilter+'()"';
  return '<button id="'+prefix+'-btn-hoy" class="fh-btn on" onclick="'+prefix+'ToggleHoy()">'+
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'+
      'Hoy</button>'+
    '<div id="'+prefix+'-rango-wrap" class="fh-rng" style="display:none">'+
      '<input type="date" id="'+prefix+'-fecha-desde" class="fh-in" '+evt+'/>'+
      ICO('right',14,'s')+
      '<input type="date" id="'+prefix+'-fecha-hasta" class="fh-in" '+evt+'/>'+
      '<button class="fh-x" onclick="'+prefix+'LimpiarFechas()" title="Volver a Hoy" aria-label="Volver a Hoy">×</button>'+
    '</div>';
}
// Inicializa el estado "Hoy activo" y las funciones toggle/limpiar para un prefijo
function _initFiltroFecha(prefix, fnFilter, opts){
  var pagina = opts && opts.page;
  window[prefix+'_filtroHoy']=true;
  // Rango remoto: la pantalla solo tiene cargado lo que cubre window[prefix+'_rango'] (null = solo hoy)
  var recargarSiHabiaRango=function(){
    if(pagina && window[prefix+'_rango']){ window[prefix+'_rango']=null; reloadPage(pagina); return true; }
    return false;
  };
  window[prefix+'RangoCambio']=function(){
    var d=(document.getElementById(prefix+'-fecha-desde')||{}).value||'';
    var h=(document.getElementById(prefix+'-fecha-hasta')||{}).value||'';
    if(!d&&!h){ if(!recargarSiHabiaRango()) window[fnFilter](); return; }
    var hoy=_hoyISO();
    var desde=d||h, hasta=h||(d>hoy?d:hoy);
    if(desde>hasta){ var t=desde; desde=hasta; hasta=t; }
    window[prefix+'_rango']={desde:desde,hasta:hasta};
    reloadPage(pagina);
  };
  window[prefix+'ToggleHoy']=function(){
    window[prefix+'_filtroHoy']=!window[prefix+'_filtroHoy'];
    var btn=document.getElementById(prefix+'-btn-hoy');
    var wrap=document.getElementById(prefix+'-rango-wrap');
    if(window[prefix+'_filtroHoy']){
      // Hoy activo: morado, ocultar rango, limpiar fechas
      if(btn)btn.classList.add('on');
      if(wrap)wrap.style.display='none';
      var d=document.getElementById(prefix+'-fecha-desde');
      var h=document.getElementById(prefix+'-fecha-hasta');
      if(d)d.value=''; if(h)h.value='';
      if(recargarSiHabiaRango()) return;
    } else {
      // Rango activo: ghost, mostrar rango
      if(btn)btn.classList.remove('on');
      if(wrap)wrap.style.display='flex';
    }
    window[fnFilter]();
  };
  window[prefix+'LimpiarFechas']=function(){
    // X = volver a Hoy
    window[prefix+'_filtroHoy']=true;
    var btn=document.getElementById(prefix+'-btn-hoy');
    var wrap=document.getElementById(prefix+'-rango-wrap');
    if(btn)btn.classList.add('on');
    if(wrap)wrap.style.display='none';
    var d=document.getElementById(prefix+'-fecha-desde');
    var h=document.getElementById(prefix+'-fecha-hasta');
    if(d)d.value=''; if(h)h.value='';
    if(recargarSiHabiaRango()) return;
    window[fnFilter]();
  };
  // Tras recargar con un rango elegido, restaurar el estado visual del filtro
  var rg=window[prefix+'_rango'];
  if(pagina && rg){
    window[prefix+'_filtroHoy']=false;
    var b0=document.getElementById(prefix+'-btn-hoy'), w0=document.getElementById(prefix+'-rango-wrap');
    if(b0)b0.classList.remove('on');
    if(w0)w0.style.display='flex';
    var d0=document.getElementById(prefix+'-fecha-desde'), h0=document.getElementById(prefix+'-fecha-hasta');
    if(d0)d0.value=rg.desde; if(h0)h0.value=rg.hasta;
  }
}
// Aplica filtro de fecha a un array de filas (que tienen campo .fecha en dd/MM/yyyy)
function _applyFiltroFecha(prefix, rows){
  if(window[prefix+'_filtroHoy']) return rows.filter(function(r){return r.fecha===_hoyDMY();});
  var desdeISO=(document.getElementById(prefix+'-fecha-desde')||{}).value||'';
  var hastaISO=(document.getElementById(prefix+'-fecha-hasta')||{}).value||'';
  var desde=_parseISO(desdeISO); var hasta=_parseISO(hastaISO);
  if(!desde&&!hasta) return rows;
  return rows.filter(function(r){
    var d=_parseDataDMY(r.fecha);
    if(!d)return false;
    if(desde&&d<desde)return false;
    if(hasta&&d>hasta)return false;
    return true;
  });
}
// Exporta a Excel con SheetJS
function _exportXLSX(headers, rows, mapFn, sheetName, fileName){
  if(!rows.length){showToast('No hay datos para exportar','err');return;}
  var ws_data=[headers];
  rows.forEach(function(r){ws_data.push(mapFn(r));});
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  XLSX.writeFile(wb,fileName+'_'+_hoyISO()+'.xlsx');
  showToast('Excel descargado ('+rows.length+' registros)','ok');
}
function _sheetName(n){ return String(n||'Sede').replace(/[:\\\\/\?\*\[\]]/g,'').substring(0,31); }
function _exportMultiHoja(sedesData,fileName){
  if(!sedesData||!sedesData.length){showToast('Sin datos para exportar','err');return;}
  var wb=XLSX.utils.book_new(); var totalRows=0;
  sedesData.forEach(function(sede){
    if(!sede.rows||!sede.rows.length) return;
    var ws_data=[sede.headers];
    sede.rows.forEach(function(r){ ws_data.push(sede.mapFn(r)); });
    var ws=XLSX.utils.aoa_to_sheet(ws_data);
    if(sede.colWidths) ws['!cols']=sede.colWidths;
    XLSX.utils.book_append_sheet(wb,ws,_sheetName(sede.nombre));
    totalRows+=sede.rows.length;
  });
  if(!wb.SheetNames||!wb.SheetNames.length){showToast('Sin datos para exportar','err');return;}
  XLSX.writeFile(wb,fileName+'_'+_hoyISO()+'.xlsx');
  showToast('Excel descargado ('+totalRows+' registros en '+wb.SheetNames.length+' sede(s))','ok');
}
function _exportConSpinner(btnId,modulo,callback){
  var btn=document.getElementById(btnId), orig=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.textContent='Exportando...';}
  google.script.run
    .withSuccessHandler(function(r){
      if(btn){btn.disabled=false;btn.innerHTML=orig;}
      if(!r||!r.ok){showToast(r?r.error:'Error al exportar','err');return;}
      callback(r.sedes);
    })
    .withFailureHandler(function(e){
      if(btn){btn.disabled=false;btn.innerHTML=orig;}
      showToast(e.message,'err');
    })
    .getExportMultiSede(S.token,modulo);
}

var _ENT_EST='';      // filtro de estado Dynamics: '', 'pen', 'par', 'reg'
var _ENT_ABIERTOS={}; // recepciones desplegadas (se conservan al filtrar)
var _ENT_GRUPOS=[];

function renderEntradas(r){
  dbg('[ENTRADAS] renderEntradas() — r.ok='+( r&&r.ok)+' r.error='+(r&&r.error)+' data.length='+(r&&r.data&&r.data.length));
  if(_handleExpired(r,'entradas-root')) return;
  if(!r||!r.ok){PAGE_LOADED['entradas']=false;errBox('entradas-root',r?r.error:'Error desconocido','entradas');return;}
  DATA.entradas=r.data;
  _ENT_EST=''; _ENT_ABIERTOS={};
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
var icoExportar='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  document.getElementById('entradas-root').innerHTML=
    '<div class="ent-sum" id="ent-sum"></div>'+
    '<div class="sal2-pnl">'+
    '<div class="sal2-fl">'+
      '<div class="sal2-seg" id="ent-est"></div>'+
      '<div class="sal2-srch">'+icoBuscar+'<input id="ent-busq" placeholder="Buscar factura, OC, proveedor o producto…" oninput="filterEntradas()"/></div>'+
      _fechaFiltroHTML('ent','filterEntradas','entRangoCambio')+
      '<span class="sal2-cnt" id="ent-count"></span>'+
      '<button id="btn-export-entradas" class="sal2-exp" onclick="exportEntradas()">'+icoExportar+'Exportar</button>'+
    '</div>'+
    '<div class="ent-tw">'+
      '<div class="ent-hd"><span></span><span>Fecha</span><span>Factura · Proveedor</span><span>Orden de compra</span><span class="r">Productos</span><span class="r">Unidades</span><span>Dynamics</span><span>Responsable</span><span></span></div>'+
      '<div id="ent-rows"></div>'+
    '</div>'+
    '<div class="ent-lst" id="ent-lst"></div>'+
    '</div>';
  _initFiltroFecha('ent','filterEntradas',{page:'entradas'});
  filterEntradas();
}

// Estado de Dynamics de una línea: reg (Registrado), car (Cargado), pen (Pendiente), sin (vacío o "--")
function _entDyn(v){
  v=String(v||'').trim().toLowerCase();
  if(v==='registrado') return 'reg';
  if(v==='cargado') return 'car';
  if(v==='pendiente') return 'pen';
  return 'sin';
}
function _entPillLinea(v){
  var k=_entDyn(v);
  if(k==='reg') return '<span class="ent-pill ok">Registrado</span>';
  if(k==='car') return '<span class="ent-pill pa">Cargado</span>';
  if(k==='pen') return '<span class="ent-pill wa">Pendiente</span>';
  return '<span class="ent-pill no">Sin estado</span>';
}
// Estado de una recepción completa: pen / par / reg
function _entEstadoGrupo(g){
  var reg=g.items.filter(function(i){return _entDyn(i.dynamics)==='reg';}).length;
  var pen=g.items.filter(function(i){var k=_entDyn(i.dynamics);return k==='pen'||k==='sin';}).length;
  g.nReg=reg;
  if(reg===g.items.length) return 'reg';
  if(pen===g.items.length) return 'pen';
  return 'par';
}
function _entPillGrupo(g){
  if(g.est==='reg') return '<span class="ent-pill ok">Registrado</span>';
  if(g.est==='pen') return '<span class="ent-pill wa">Pendiente</span>';
  var todoCargado=g.items.every(function(i){return _entDyn(i.dynamics)==='car';});
  return '<span class="ent-pill pa">'+(todoCargado?'Cargado':'Parcial '+g.nReg+'/'+g.items.length)+'</span>';
}

function _filterEntradas(){
  var q=((document.getElementById('ent-busq')||{}).value||'').toLowerCase();
  var rows=DATA.entradas.filter(function(r){
    return !q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||r.factura.toLowerCase().indexOf(q)>-1||
      (r.oc||'').toLowerCase().indexOf(q)>-1||(r.proveedor||'').toLowerCase().indexOf(q)>-1;
  });
  rows=_applyFiltroFecha('ent',rows);
  rows.sort(function(a,b){return b._row-a._row;});

  // Una fila por recepción: misma fecha, factura, proveedor y OC
  var mapa={}, grupos=[];
  rows.forEach(function(r){
    var k=[r.fecha,r.factura,r.proveedor,r.oc].join('|');
    if(!mapa[k]){ mapa[k]={key:k,fecha:r.fecha,factura:r.factura,proveedor:r.proveedor,oc:r.oc,responsable:r.responsable,items:[],und:0}; grupos.push(mapa[k]); }
    mapa[k].items.push(r); mapa[k].und+=r.unidades;
  });
  grupos.forEach(function(g){ g.est=_entEstadoGrupo(g); });
  var c={pen:0,par:0,reg:0}; grupos.forEach(function(g){c[g.est]++;});
  var totalUnd=grupos.reduce(function(a,g){return a+g.und;},0);

  // Resumen
  var t=grupos.length||1, pc=function(n){return (n/t*100).toFixed(2);};
  var leg=function(k,color,n,txt){return '<span onclick="entSetEstado(\''+k+'\')"><em style="background:'+color+'"></em><b>'+n+'</b> '+txt+'</span>';};
  document.getElementById('ent-sum').innerHTML=
    '<div class="ent-card"><div class="ent-k">Recepciones</div><div class="ent-v">'+fmt(grupos.length)+'</div><div class="ent-n">'+fmt(rows.length)+(rows.length===1?' producto recibido':' productos recibidos')+'</div></div>'+
    '<div class="ent-card"><div class="ent-k">Unidades recibidas</div><div class="ent-v">'+fmt(totalUnd)+'<small>und.</small></div><div class="ent-n">En el período seleccionado</div></div>'+
    '<div class="ent-card"><div class="ent-k">Registro en Dynamics</div>'+
      '<div class="ent-dist"><i style="width:'+pc(c.reg)+'%;background:var(--ok)"></i><i style="width:'+pc(c.par)+'%;background:var(--accent)"></i><i style="width:'+pc(c.pen)+'%;background:var(--warn)"></i></div>'+
      '<div class="ent-leg">'+leg('pen','var(--warn)',c.pen,'Pendientes')+leg('par','var(--accent)',c.par,'Parciales')+leg('reg','var(--ok)',c.reg,'Registradas')+'</div></div>';

  var seg=function(k,txt,n){return '<button class="'+(_ENT_EST===k?'on':'')+'" onclick="entSetEstado(\''+k+'\')">'+txt+'<span>'+n+'</span></button>';};
  document.getElementById('ent-est').innerHTML=seg('','Todas',grupos.length)+seg('pen','Pendientes',c.pen)+seg('par','Parciales',c.par)+seg('reg','Registradas',c.reg);

  var vis=_ENT_EST?grupos.filter(function(g){return g.est===_ENT_EST;}):grupos;
  _ENT_GRUPOS=vis;
  window._ENT_ROWS={}; rows.forEach(function(r){window._ENT_ROWS[r._row]=r;});
  var el=document.getElementById('ent-count');
  if(el)el.textContent=vis.length+(vis.length===1?' recepción':' recepciones');

  var chev='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  var lapiz=function(row,tit){return '<button class="ent-edb" title="'+tit+'" onclick="event.stopPropagation();editarDynamicsRowSafe('+row+')">'+ICO('edit',13,'s')+'</button>';};
  var delFac=function(i){return '<button class="ent-edb d" title="Eliminar la factura completa" onclick="event.stopPropagation();entEliminarFactura('+i+')">'+ICO('trash',13,'s')+'</button>';};
  var lineas=function(g,i){
    if(!_ENT_ABIERTOS[g.key]) return '';
    return '<div class="ent-its on">'+g.items.map(function(x){
      return '<div class="ent-it"><span class="mono">'+esc(x.sku)+'</span><span class="d">'+esc(x.desc)+'</span><span class="r"><b>'+fmt(x.unidades)+'</b></span><span>'+_entPillLinea(x.dynamics)+'</span>'+
        '<span class="r ent-acc">'+(g.oc?'':lapiz(x._row,'Cambiar estado de Dynamics'))+
          '<button class="ent-edb" title="Editar SKU o cantidad" onclick="event.stopPropagation();entEditarLinea('+x._row+')">'+ICO('edit',13,'s')+'</button>'+
          '<button class="ent-edb d" title="Eliminar este producto" onclick="event.stopPropagation();entEliminarLinea('+x._row+')">'+ICO('trash',13,'s')+'</button></span></div>';
    }).join('')+'<div class="ent-pie"><button class="ent-edb d" onclick="event.stopPropagation();entEliminarFactura('+i+')">'+ICO('trash',13,'s')+' Eliminar ingreso completo</button></div></div>';
  };
  document.getElementById('ent-rows').innerHTML=vis.map(function(g,i){
    var o=!!_ENT_ABIERTOS[g.key];
    return '<div class="ent-g"><div class="ent-rc'+(o?' open':'')+'" onclick="entTg('+i+')"><span class="ent-chev">'+chev+'</span>'+
      '<span class="mono">'+esc(g.fecha)+'</span>'+
      '<div><div class="ent-fa mono">'+esc(g.factura||'—')+'</div><div class="ent-sb">'+esc(g.proveedor||'')+'</div></div>'+
      '<span>'+(g.oc?'<span class="ent-oc">'+esc(g.oc)+'</span>':'<span class="ent-sin">Sin OC</span>')+'</span>'+
      '<span class="r">'+g.items.length+'</span><span class="r"><b>'+fmt(g.und)+'</b></span>'+
      '<span>'+_entPillGrupo(g)+'</span><span class="ent-resp">'+esc(g.responsable||'')+'</span>'+
      '<span class="r ent-acc">'+(g.oc?lapiz(g.items[0]._row,'Cambiar el estado de Dynamics de toda la OC'):'')+delFac(i)+'</span></div>'+lineas(g,i)+'</div>';
  }).join('')||'<div class="ent-vacio">Sin registros</div>';
  document.getElementById('ent-lst').innerHTML=vis.map(function(g,i){
    return '<div class="ent-cd"><div class="ent-h" onclick="entTg('+i+')"><div style="min-width:0"><div class="ent-fa mono">'+esc(g.factura||'—')+'</div>'+
      '<div class="ent-sb">'+esc(g.proveedor||'')+' · '+esc(g.fecha)+'</div>'+
      '<div class="ent-tags">'+_entPillGrupo(g)+(g.oc?'<span class="ent-oc">'+esc(g.oc)+'</span>':'')+(g.oc?lapiz(g.items[0]._row,'Cambiar el estado de Dynamics de toda la OC'):'')+delFac(i)+'</div></div>'+
      '<div class="ent-u"><b>'+fmt(g.und)+'</b><span>'+g.items.length+' prod.</span></div></div>'+lineas(g,i)+'</div>';
  }).join('')||'<div class="ent-vacio">Sin registros</div>';
}

/* ── Editar / eliminar entradas ── */
function _entRecargar(){ reloadPage('entradas'); }
function entEliminarLinea(row){
  var r=(window._ENT_ROWS||{})[row]; if(!r) return;
  _confirmDialog('Eliminar producto','Se eliminará '+r.sku+' ('+fmt(r.unidades)+' und.) de la factura '+(r.factura||'—')+'. El stock se descuenta. No se puede deshacer.',function(){
    google.script.run
      .withSuccessHandler(function(x){ if(!x.ok){ showToast(x.error,'err'); return; } showToast('Producto eliminado','ok'); PAGE_LOADED['stock']=false; _entRecargar(); })
      .withFailureHandler(function(e){ showToast(e.message,'err'); })
      .eliminarEntradas(S.token,[row]);
  },'Eliminar');
}
function entEliminarFactura(i){
  var g=_ENT_GRUPOS[i]; if(!g) return;
  _confirmDialog('Eliminar ingreso completo','Se eliminarán los '+g.items.length+' productos ('+fmt(g.und)+' und.) de la factura '+(g.factura||'—')+' del '+g.fecha+'. El stock se descuenta. No se puede deshacer.',function(){
    google.script.run
      .withSuccessHandler(function(x){ if(!x.ok){ showToast(x.error,'err'); return; } showToast('Ingreso eliminado ('+x.eliminados+' productos)','ok'); PAGE_LOADED['stock']=false; _entRecargar(); })
      .withFailureHandler(function(e){ showToast(e.message,'err'); })
      .eliminarEntradas(S.token,g.items.map(function(x){return x._row;}));
  },'Eliminar todo');
}
function entEditarLinea(row){
  var r=(window._ENT_ROWS||{})[row]; if(!r) return;
  var m=document.getElementById('modal-ent-edit');
  if(!m){
    m=document.createElement('div'); m.id='modal-ent-edit';
    m.style.cssText='display:none;position:fixed;inset:0;z-index:110;align-items:center;justify-content:center;background:rgba(46,16,101,.25);backdrop-filter:blur(2px)';
    m.innerHTML='<div style="background:var(--surface);border:1px solid var(--border);border-top:3px solid var(--accent);border-radius:var(--r2);padding:24px 28px;width:400px;max-width:94vw;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;gap:14px">'+
      '<div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text)">Editar producto de la entrada</div>'+
      '<div><div class="ent-lbl">SKU</div><input class="inp" id="ee-sku" style="width:100%" autocomplete="off"/></div>'+
      '<div><div class="ent-lbl">Descripción</div><input class="inp" id="ee-desc" style="width:100%" autocomplete="off"/></div>'+
      '<div><div class="ent-lbl">Unidades</div><input class="inp" id="ee-und" type="number" min="0" step="1" style="width:100%"/></div>'+
      '<div><div class="ent-lbl">Fecha de ingreso</div><input class="inp" id="ee-fecha" type="date" style="width:100%"/></div>'+
      '<label id="ee-todos-w" style="display:none;align-items:center;gap:8px;font-size:12px;color:var(--text2)"><input type="checkbox" id="ee-todos" checked/> <span id="ee-todos-t"></span></label>'+
      '<div id="ee-err" style="color:var(--danger);font-size:12px;min-height:14px"></div>'+
      '<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'modal-ent-edit\').style.display=\'none\'">Cancelar</button>'+
      '<button class="btn btn-primary btn-sm" id="ee-ok" onclick="entGuardarEdicion()">Guardar</button></div></div>';
    document.body.appendChild(m);
    document.getElementById('ee-sku').addEventListener('change',function(){
      var v=this.value.trim(); if(!v) return;
      google.script.run.withSuccessHandler(function(x){
        var h=(x.results||[]).filter(function(a){return a.sku===v;})[0];
        if(h) document.getElementById('ee-desc').value=h.desc;
      }).buscarSKU(S.token,v);
    });
  }
  m.dataset.row=row;
  document.getElementById('ee-sku').value=r.sku; document.getElementById('ee-desc').value=r.desc;
  document.getElementById('ee-und').value=r.unidades; document.getElementById('ee-err').textContent='';
  var p=String(r.fecha||'').split('/'), hoy=_hoyISO();
  var fe=document.getElementById('ee-fecha'); fe.max=hoy; fe.value=p.length===3?p[2]+'-'+p[1]+'-'+p[0]:'';
  m.dataset.fecha0=fe.value;
  var hermanos=(DATA.entradas||[]).filter(function(x){return x.fecha===r.fecha&&x.factura===r.factura&&x.proveedor===r.proveedor&&x.oc===r.oc;});
  m.dataset.ids=hermanos.map(function(x){return x._row;}).join(',');
  document.getElementById('ee-todos-w').style.display=hermanos.length>1?'flex':'none';
  document.getElementById('ee-todos').checked=true;
  document.getElementById('ee-todos-t').textContent='Cambiar la fecha en los '+hermanos.length+' productos de esta factura';
  m.style.display='flex';
}
function entGuardarEdicion(){
  var m=document.getElementById('modal-ent-edit'), row=Number(m.dataset.row), err=document.getElementById('ee-err');
  var d={ sku:document.getElementById('ee-sku').value.trim(), desc:document.getElementById('ee-desc').value.trim(), unidades:document.getElementById('ee-und').value };
  if(!d.sku){ err.textContent='El SKU no puede quedar vacío'; return; }
  if(d.unidades===''||Number(d.unidades)<0||Math.floor(Number(d.unidades))!==Number(d.unidades)){ err.textContent='Unidades: un entero igual o mayor a 0'; return; }
  d.fecha=document.getElementById('ee-fecha').value;
  if(!d.fecha){ err.textContent='Elige la fecha de ingreso'; return; }
  if(d.fecha>_hoyISO()){ err.textContent='La fecha no puede ser futura'; return; }
  if(d.fecha!==m.dataset.fecha0 && document.getElementById('ee-todos').checked && m.dataset.ids) d.ids=m.dataset.ids.split(',').map(Number);
  var b=document.getElementById('ee-ok'); b.disabled=true;
  google.script.run
    .withSuccessHandler(function(x){ b.disabled=false; if(!x.ok){ err.textContent=x.error; return; } m.style.display='none'; showToast('Entrada actualizada','ok'); PAGE_LOADED['stock']=false; _entRecargar(); })
    .withFailureHandler(function(e){ b.disabled=false; err.textContent=e.message; })
    .editarEntradaLinea(S.token,row,d);
}
function entTg(i){ var g=_ENT_GRUPOS[i]; if(!g) return; _ENT_ABIERTOS[g.key]=!_ENT_ABIERTOS[g.key]; _filterEntradas(); }
function entSetEstado(k){ _ENT_EST=(_ENT_EST===k?'':k); _filterEntradas(); }

// Wrapper seguro — lee valor actual desde el índice en lugar de recibirlo por interpolación de string
function editarDynamicsRowSafe(rowNum){
  var r = (window._ENT_ROWS||{})[rowNum];
  editarDynamicsRow(rowNum, r ? (r.dynamics||'') : '');
}

function exportEntradas(){
  if(S&&S.rol!=='store'){
    var HDR=['Fecha','Factura','SKU','Descripción','Unidades','F. Vencimiento','Proveedor','OC','Dynamics','Responsable'];
    var CW=[{wch:12},{wch:16},{wch:14},{wch:36},{wch:10},{wch:14},{wch:20},{wch:14},{wch:12},{wch:16}];
    _exportConSpinner('btn-export-entradas','entradas',function(sedes){
      _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:HDR,rows:s.data,colWidths:CW,
        mapFn:function(r){return[r.fecha,r.factura,r.sku,r.desc,r.unidades,r.fVenc||'',r.proveedor,r.oc,r.dynamics,r.responsable];}};}),'entradas_sedes');
    });return;
  }
  var rows=_getFilteredRows('entradas');
  _exportXLSX(['Fecha','Factura','SKU','Descripción','Unidades','F. Vencimiento','Proveedor','OC','Dynamics','Responsable'],
    rows,function(r){return[r.fecha,r.factura,r.sku,r.desc,r.unidades,r.fVenc||'',r.proveedor,r.oc,r.dynamics,r.responsable];},'Entradas','entradas');
}

function editarDynamicsRow(rowNum, valorActual){
  // Obtener la OC de la fila para mostrarla en el título
  var item = DATA.entradas.find(function(x){ return x._row === rowNum; });
  var oc   = item ? (item.oc || '—') : '—';
  _selectDialog(
    'Editar Dynamics · OC: ' + oc,
    'Dynamics',
    ['Registrado','Pendiente'],
    valorActual || '',
    function(nuevoValor){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){ showToast(r.error,'err'); return; }
          // Actualizar DATA local: todas las filas con la misma OC
          DATA.entradas.forEach(function(x){
            if((x.oc||'') === (item ? item.oc : '')) x.dynamics = nuevoValor;
          });
          filterEntradas();
          showToast('Dynamics actualizado en ' + r.actualizados + ' fila(s) de OC: ' + r.oc, 'ok');
        })
        .withFailureHandler(function(e){ showToast(e.message,'err'); })
        .editarDynamicsEntrada(S.token, rowNum, nuevoValor);
    }
  );
}

/* ── ENTRADA: un solo formulario, dos formas de cargar los productos ── */
var ENTRADA_TAB='manual';
var ARCH_ROWS=[];   // filas parseadas del archivo
var ARCH_TOT=null;  // totales de la OC leídos del PDF: {sub, imp, total}
var ENT_ROW_COUNT=0;
var ENT_OCS=[];     // OC pendientes de recibir (sugerencias)

function switchEntradaTab(tab){
  ENTRADA_TAB=tab;
  document.getElementById('tab-content-manual').classList.toggle('hidden', tab!=='manual');
  document.getElementById('tab-content-archivo').classList.toggle('hidden', tab!=='archivo');
  entResumen();
}

function entDyn(b){
  document.getElementById('ent-dynamics').value=b.dataset.v;
  document.querySelectorAll('#ent-dy button').forEach(function(x){x.classList.toggle('on',x===b);});
}

// Productos válidos y unidades de la carga actual (manual o archivo)
function _entCuenta(){
  var n=0,u=0,incompletas=0;
  if(ENTRADA_TAB==='manual'){
    document.querySelectorAll('#ent-rows-wrap [id^="ent-row-"]').forEach(function(row){
      var id=row.id.replace('ent-row-','');
      var sku=((document.getElementById('er-sku-'+id)||{}).value||'').trim();
      var und=Number((document.getElementById('er-und-'+id)||{}).value||0);
      if(sku&&und>0){ n++; u+=und; }
      else if(sku||und>0) incompletas++;   // fila a medias; la fila totalmente vacía se ignora
    });
  } else {
    ARCH_ROWS.forEach(function(r){ if(r.incluir){ n++; u+=Number(r.cant)||0; } });
  }
  return {n:n,u:u,incompletas:incompletas};
}

// Se llama cada vez que cambia algo del formulario: refresca el aviso de estado y el asistente
function entResumen(){
  var fac=(document.getElementById('ent-factura').value||'').trim();
  var c=_entCuenta();
  var ok=!!fac&&c.n>0;
  var st=document.getElementById('ent-stat');
  if(st){ st.className='en2-stat'+(ok?' ok':''); document.getElementById('ent-stat-t').textContent=ok?'Listo para guardar':'Faltan datos'; }
  wzActualizar();
}

/* ── ASISTENTE (4 pasos): 1 Origen · 2 Factura · 3 Productos · 4 Confirmar ── */
var WZ={paso:1,origen:null,leyendo:false,run:0,dir:1,pi:0,fin:false};
var WZ_NOM=['Origen','Datos de la factura','Productos','Confirmar'];
var _wzEl=function(id){return document.getElementById(id);};
function _wzReducido(){ return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches); }
function _wzEspera(ms){ return new Promise(function(ok){ setTimeout(ok,ms); }); }
function _numFmt2(n){ return Number(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _numFmt0(n){ return fmt(Math.round(n)); }

// Número que "cuenta" hasta su valor. Usa setInterval (no requestAnimationFrame) para no congelarse en segundo plano.
function countTo(el,to,fmtFn,ms){
  if(!el) return;
  clearInterval(el._iv);
  var from=Number(el.dataset.v||0); fmtFn=fmtFn||_numFmt2; ms=ms||650;
  el.dataset.v=to;
  if(from===to||_wzReducido()){ el.textContent=fmtFn(to); return; }
  var t0=performance.now();
  el._iv=setInterval(function(){
    var p=Math.min(1,(performance.now()-t0)/ms), e=1-Math.pow(1-p,4);
    el.textContent=fmtFn(from+(to-from)*e);
    if(p>=1||!el.isConnected){ clearInterval(el._iv); el.textContent=fmtFn(to); }
  },16);
}

function wzOrigen(o){
  WZ.origen=o;
  switchEntradaTab(o);
  if(o==='manual') wzIr(2);                        // escribir a mano no necesita archivo: directo a la factura
  else _ocrCargarLibs().catch(function(){});       // mientras eliges el archivo ya se va precargando el lector
}

// ¿Se puede salir de este paso hacia adelante? → {ok, msg}
function wzValido(p){
  var c=_entCuenta();
  if(p===1){
    if(!WZ.origen) return {ok:false,msg:'Elige cómo cargar los productos'};
    if(WZ.origen==='archivo'&&(WZ.leyendo||!ARCH_ROWS.length)) return {ok:false,msg:'Sube la orden de compra o el Excel para continuar'};
    return {ok:true,msg:''};
  }
  if(p===2){
    return (document.getElementById('ent-factura').value||'').trim()?{ok:true,msg:''}:{ok:false,msg:'Escribe la factura para continuar'};
  }
  if(p===3){
    if(c.incompletas) return {ok:false,msg:'Completa SKU y unidades de cada fila, o quita las incompletas'};
    if(WZ.origen==='archivo'&&ARCH_ROWS.some(_pvRev)) return {ok:false,msg:'Resuelve los productos por revisar'};
    if(!c.n) return {ok:false,msg:WZ.origen==='archivo'?'Marca al menos un producto':'Agrega al menos un producto'};
    return {ok:true,msg:''};
  }
  return {ok:true,msg:''};
}
function _wzPuedeIr(k){
  if(k<=WZ.paso) return true;
  for(var j=1;j<k;j++){ if(!wzValido(j).ok) return false; }
  return true;
}
// Anima el cambio de paso (se desliza según vayas adelante o atrás)
function _wzAnimar(){
  var p=document.querySelector('#fs-entrada .wz-pane'); if(!p) return;
  p.classList.remove('in-fwd','in-back'); void p.offsetWidth;
  p.classList.add(WZ.dir>0?'in-fwd':'in-back');
}
function wzIr(k){
  if(k<1||k>4||WZ.fin||!_wzPuedeIr(k)) return;
  var cambia=k!==WZ.paso;
  WZ.dir=k>=WZ.paso?1:-1; WZ.paso=k;
  if(k===4) wzResumen();
  if(k===1) wzDonePintar();
  if(cambia) _wzAnimar();
  wzActualizar();
  var pb=document.querySelector('#fs-entrada .fs-body'); if(pb) pb.scrollTop=0;
  if(k===2) setTimeout(function(){var e=_wzEl('ent-factura'); if(e&&!e.value) e.focus({preventScroll:true});},450);
  if(k===1) setTimeout(function(){var b=_wzEl('wz-cta'); if(b&&b.offsetParent) b.focus({preventScroll:true});},450);
}
function wzSiguiente(){ if(wzValido(WZ.paso).ok) wzIr(WZ.paso+1); }
function wzAtras(){ if(WZ.paso>1) wzIr(WZ.paso-1); else closeFS('fs-entrada'); }

function _wzResumenPaso(k){
  var c=_entCuenta();
  if(k===1){
    if(!WZ.origen) return 'Elige cómo cargar';
    if(WZ.origen==='manual') return 'Escribir a mano';
    if(WZ.leyendo) return 'Leyendo el archivo…';
    if(!ARCH_ROWS.length) return 'Sube la OC o el Excel';
    var oc=(document.getElementById('ent-oc').value||'').trim();
    return (oc||'Archivo')+' · '+ARCH_ROWS.length+' productos';
  }
  if(k===2){ var f=(document.getElementById('ent-factura').value||'').trim(); return f?'Factura '+f:'Factura y datos del ingreso'; }
  if(k===3){
    if(WZ.origen==='archivo'){
      var rev=ARCH_ROWS.filter(_pvRev).length;
      return rev?(rev+' por resolver'):(c.n?(c.n+' productos listos'):'Revisa los productos');
    }
    return c.n?(c.n+(c.n===1?' producto':' productos')+' · '+fmt(c.u)+' u.'):'Agrega los productos';
  }
  return 'Confirma y guarda';
}

// Texto del botón final según el origen
function _wzTxtGuardar(){
  var n=_entCuenta().n;
  return WZ.origen==='archivo'?'Importar '+n+(n===1?' producto':' productos'):'Guardar entrada';
}

// Riel de pasos: se construye una vez y luego solo se actualizan clases y textos (así animan las transiciones)
var _WZ_CHK='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
function _wzRailUpd(){
  var rail=_wzEl('wz-rail'); if(!rail) return;
  if(!rail.dataset.built){
    rail.dataset.built='1';
    rail.innerHTML='<h4>Asistente · 4 pasos</h4>'+WZ_NOM.map(function(n,i){
      var k=i+1;
      return '<button type="button" class="wz-stp" id="wz-stp-'+k+'" onclick="wzIr('+k+')"><span class="wz-dot" id="wz-dot-'+k+'">'+k+'</span><span class="wz-ln"><i></i></span><span class="wz-tx"><strong>'+n+'</strong><small id="wz-sm-'+k+'"></small></span></button>';
    }).join('');
  }
  for(var k=1;k<=4;k++){
    var b=_wzEl('wz-stp-'+k), hecho=WZ.fin||(k<WZ.paso&&wzValido(k).ok), on=!WZ.fin&&k===WZ.paso;
    b.classList.toggle('on',on); b.classList.toggle('done',hecho);
    b.disabled=WZ.fin||!_wzPuedeIr(k);
    var dot=_wzEl('wz-dot-'+k);
    if((dot.dataset.d==='1')!==hecho){ dot.dataset.d=hecho?'1':'0'; dot.innerHTML=hecho?_WZ_CHK:k; }
    var sm=_wzEl('wz-sm-'+k), tx=_wzResumenPaso(k);
    if(sm.textContent!==tx) sm.textContent=tx;
  }
}

// Paso 1: una de tres vistas (soltar archivo · leyendo · listo)
function wzVista(){
  var arch=WZ.origen==='archivo';
  var v=WZ.leyendo?'read':(ARCH_ROWS.length?'done':'drop');
  ['drop','read','done'].forEach(function(k){ _wzEl('wz-v-'+k).classList.toggle('hidden',v!==k); });
  var ch=_wzEl('wz-ch');
  ch.classList.toggle('gone',WZ.leyendo);
  ch.classList.toggle('compact',arch);
}

// Repinta el riel, el encabezado, el paso visible y la barra de botones (barato: se llama en cada cambio)
function wzActualizar(){
  // si se quitó el archivo estando más adelante, se vuelve al paso 1
  if(WZ.origen==='archivo'&&!ARCH_ROWS.length&&!WZ.leyendo&&WZ.paso>=3&&!WZ.fin) WZ.paso=1;
  if(!_wzEl('wz-rail')) return;
  _wzRailUpd();
  var fin=WZ.fin, v=wzValido(WZ.paso), c=_entCuenta();
  var T=[
    ['Origen de los productos','Sube la orden de compra y leemos todo por ti, o escríbelos a mano.'],
    ['Datos de la factura',WZ.origen==='archivo'&&(document.getElementById('ent-oc').value||'').trim()?'Lo del archivo ya está completado. Falta la factura.':'Escribe la factura y completa lo que necesites.'],
    ['Productos recibidos',WZ.origen==='archivo'?'Resuelve lo pendiente y desmarca lo que no llegó.':'Busca cada producto por SKU o nombre y escribe las unidades.'],
    ['Confirma y guarda','Revisa el resumen. Puedes editar cualquier sección antes de guardar.']
  ][WZ.paso-1];
  document.querySelector('#fs-entrada .wz-ph').classList.toggle('hidden',fin);
  document.querySelector('#fs-entrada .wz-pane').dataset.paso=WZ.paso;   // el paso 3 usa una columna más ancha
  _wzEl('wz-eb').textContent='Paso '+WZ.paso+' de 4';
  _wzEl('wz-t').textContent=T[0];
  _wzEl('wz-s').textContent=T[1];
  for(var k=1;k<=5;k++) _wzEl('wz-s'+k).classList.toggle('hidden',k!==(fin?5:WZ.paso));
  _wzEl('ent-m-archivo').classList.toggle('sel',WZ.origen==='archivo');
  _wzEl('ent-m-manual').classList.toggle('sel',WZ.origen==='manual');
  _wzEl('wz-s1-arch').classList.toggle('hidden',WZ.origen!=='archivo');
  _wzEl('wz-s1-man').classList.toggle('hidden',WZ.origen!=='manual');
  wzVista();

  _wzEl('ent-footer').classList.toggle('hidden',fin);
  var back=_wzEl('btn-ent-back'), nx=_wzEl('btn-ent-next'), sv=_wzEl('btn-ent-save');
  back.innerHTML=WZ.paso>1?'← Atrás':'Cancelar <span class="en2-kb">Esc</span>';
  // en el paso 1 no hay "Siguiente": el botón grande de la vista final hace de Continuar
  nx.classList.toggle('hidden',WZ.paso===4||WZ.paso===1);
  sv.classList.toggle('hidden',WZ.paso!==4);
  nx.disabled=!v.ok;
  if(sv.textContent.indexOf('...')<0){
    sv.textContent=_wzTxtGuardar();
    sv.disabled=!((document.getElementById('ent-factura').value||'').trim()&&c.n>0);
  }
  var msg=_wzEl('ent-msg');
  if(msg){
    var txt=(WZ.paso>1&&(v.ok||WZ.paso===4)&&c.n)?'<b>'+c.n+'</b> '+(c.n===1?'producto':'productos')+' · <b>'+fmt(c.u)+'</b> unidades':'';
    if(msg._t!==txt){ msg._t=txt; msg.innerHTML=txt; }
  }
}

// Paso 4: resumen con enlaces para editar cada sección y total que cuenta hacia arriba
function wzResumen(){
  var el=_wzEl('wz-resumen'); if(!el) return;
  var g=function(id){return (document.getElementById(id)||{}).value||'';};
  var c=_entCuenta();
  function kv(k,v){ return '<div class="wz-kv"><span>'+k+'</span><b>'+(v?esc(v):'—')+'</b></div>'; }
  var origen=WZ.origen==='archivo'
    ? kv('Origen','Archivo ('+ARCH_ROWS.length+' líneas)')+kv('Orden de compra',g('ent-oc'))+kv('Proveedor',g('ent-proveedor'))
    : kv('Origen','Escrito a mano')+kv('Orden de compra',g('ent-oc'))+kv('Proveedor',g('ent-proveedor'));
  var h='<div class="wz-rv">'+
    '<div class="wz-rc"><div class="wz-rt"><span>Origen</span><button type="button" onclick="wzIr(1)">Editar</button></div>'+origen+'</div>'+
    '<div class="wz-rc"><div class="wz-rt"><span>Factura</span><button type="button" onclick="wzIr(2)">Editar</button></div>'+
      kv('Referencia',g('ent-factura'))+kv('Fecha de ingreso',g('ent-fecha'))+kv('Dynamics',g('ent-dynamics'))+kv('Responsable',g('ent-responsable'))+'</div>';
  var conMonto=WZ.origen==='archivo'&&ARCH_ROWS.some(function(r){return typeof r.monto==='number';}), valor=0, esMonto=false;
  if(conMonto){
    var sel=0; ARCH_ROWS.forEach(function(r){ if(r.incluir&&typeof r.monto==='number') sel+=r.monto; });
    sel=Math.round(sel*100)/100; valor=sel; esMonto=true;
    var t=ARCH_TOT||{}, cuadra=t.sub&&Math.abs(sel-t.sub)<0.05;
    h+='<div class="wz-tot"><div><small>Total a importar (sin impuestos)</small><b class="num">S/ <span id="wz-tv" data-v="0">0.00</span></b></div>'+
       '<div class="r"><small>'+c.n+' productos · '+fmt(c.u)+' u.</small><b>'+(t.sub?(cuadra?'Cuadra con la OC ✓':'Subtotal OC '+_soles(t.sub)):'')+'</b></div></div>';
  } else {
    valor=c.u;
    h+='<div class="wz-tot"><div><small>Se sumará al stock de la sede</small><b class="num"><span id="wz-tv" data-v="0">0</span> unidades</b></div><div class="r"><small>Productos</small><b>'+c.n+'</b></div></div>';
  }
  if(WZ.origen==='archivo'){
    var om=ARCH_ROWS.filter(function(r){return !r.incluir;});
    h+=om.length
      ? '<div class="wz-nt w"><b>'+om.length+(om.length===1?' línea omitida':' líneas omitidas')+':</b> '+om.map(function(r){return esc(r.sku+' '+(r.desc||''));}).join(' · ')+' <a href="#" onclick="wzIr(3);return false">Revisar</a></div>'
      : '<div class="wz-nt o"><b>Todo conforme.</b> Se importan todas las líneas del archivo.</div>';
  }
  h+='</div>';
  el.innerHTML=h;
  _wzEl('ent-err4').textContent='';
  setTimeout(function(){ countTo(_wzEl('wz-tv'),valor,esMonto?_numFmt2:_numFmt0,1000); },350);
}

/* ── Paso 1 · lectura del archivo: escenario a todo el ancho con el texto real que se va leyendo ── */
var WZ_Q=[], WZ_QT=null, WZ_N=0, WZ_EXP=0, _ocrWorkerAct=null;
function wzLeerInicio(tipo,nombre){
  WZ.run++; WZ.leyendo=true; WZ_Q=[]; WZ_N=0; WZ_EXP=0; clearInterval(WZ_QT); WZ_QT=null;
  var xl=tipo==='xlsx', n=esc(nombre||'archivo');
  _wzEl('wz-v-read').innerHTML='<div class="wz-rstage" id="wz-rst">'+
    '<div class="wz-rhead"><div><div class="wz-rt1">Leyendo '+n+'</div><div class="wz-big num"><span id="wz-cnt">0</span><small>productos encontrados</small></div></div>'+
      '<div class="wz-pw"><div class="wz-pbar"><i id="wz-pgb"></i></div><div class="wz-rmsg" id="wz-st-msg">Preparando el lector…</div></div>'+
      '<button type="button" class="btn btn-ghost btn-sm" onclick="wzCancelarLectura()">Cancelar</button></div>'+
    '<div class="wz-docbox"><div class="wz-beam" id="wz-beam"></div>'+
      '<div class="wz-dh"><span class="wz-nm"><i class="'+(xl?'xl':'')+'">'+(xl?'XLS':'PDF')+'</i>'+n+'</span><span class="wz-pg" id="wz-pgi">'+(xl?'Hoja 1':'')+'</span></div>'+
      '<div class="wz-paper'+(xl?' xl':'')+'" id="wz-paper"><div class="wz-ph1">'+(xl?'<b>Hoja1</b><span id="wz-doc-oc">&nbsp;</span>':'<b>Orden de compra</b><span id="wz-doc-oc">&nbsp;</span>')+'</div><div id="wz-dl"></div></div>'+
    '</div></div>';
  wzActualizar();
  return WZ.run;
}
function wzStageMsg(txt){ var m=_wzEl('wz-st-msg'); if(m&&txt) m.textContent=txt; }
function wzStagePag(i,n){
  var b=_wzEl('wz-pgb'); if(b) b.style.width=Math.round(i/n*100)+'%';
  var g=_wzEl('wz-pgi'); if(g&&n) g.textContent='Pág. '+Math.max(1,Math.min(n,i+(i<n?1:0)))+' de '+n;
}
function _wzLinea(it){
  var q=it.cant>0?_numFmt2(it.cant):'—', m=typeof it.monto==='number'?_numFmt2(it.monto):'';
  return '<div class="wz-dl'+(it.cant>0?'':' sq')+'"><span>'+esc(it.linea)+'</span><span>'+esc(it.sku)+'</span><span class="d">'+esc(it.desc)+'</span><span class="q">'+q+'</span><span class="m">'+m+'</span></div>';
}
// Las líneas entran por tandas pequeñas: se ve fluido y no bloquea la pantalla con listas largas
function _wzDrain(){
  var dl=_wzEl('wz-dl');
  if(!dl||!WZ.leyendo||!WZ_Q.length){ clearInterval(WZ_QT); WZ_QT=null; return; }
  var n=Math.max(1,Math.ceil(WZ_Q.length/40)), lote=WZ_Q.splice(0,n), h='';
  lote.forEach(function(it){ h+=_wzLinea(it); });
  WZ_N+=lote.length;
  dl.insertAdjacentHTML('beforeend',h);
  var c=_wzEl('wz-cnt'); if(c) c.textContent=WZ_N;
  if(WZ_EXP){ var b=_wzEl('wz-pgb'); if(b) b.style.width=Math.round(WZ_N/WZ_EXP*100)+'%'; }
  var sc=_wzEl('wz-paper'); if(sc) sc.scrollTop=sc.scrollHeight;
}
function wzStageAdd(items,run){
  if(run!==WZ.run||!items.length) return;
  WZ_Q=WZ_Q.concat(items);
  if(!WZ_QT) WZ_QT=setInterval(_wzDrain,45);
}
function _wzEsperarCola(run){
  return new Promise(function(ok){ (function chk(){ if(!WZ_Q.length||run!==WZ.run) ok(); else setTimeout(chk,40); })(); });
}
// Sello "leído" → el escenario se desvanece → queda el resumen y el botón Continuar
async function wzFinLectura(run){
  await _wzEsperarCola(run); if(run!==WZ.run) return;
  var bm=_wzEl('wz-beam'); if(bm) bm.remove();
  var box=document.querySelector('#wz-rst .wz-docbox');
  if(box) box.insertAdjacentHTML('beforeend','<div class="wz-stamp"><div class="wz-sc"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div><b>'+ARCH_ROWS.length+' productos leídos</b></div>');
  var rd=_wzReducido();
  await _wzEspera(rd?250:1100); if(run!==WZ.run) return;
  var st=_wzEl('wz-rst'); if(st) st.classList.add('out');
  await _wzEspera(rd?0:480); if(run!==WZ.run) return;
  WZ.leyendo=false;
  wzDonePintar();
  var d=_wzEl('wz-v-done'); d.classList.remove('wz-reveal'); void d.offsetWidth; d.classList.add('wz-reveal');
  _wzEl('wz-v-read').innerHTML='';
  wzActualizar();
  var b=_wzEl('wz-cta'); if(b) b.focus({preventScroll:true});
}
// Algo salió mal al leer: se vuelve a la zona de soltar archivo y se muestra el motivo
function wzLeerFallo(run,msg){
  if(run!==WZ.run) return;
  WZ.run++; WZ.leyendo=false; clearInterval(WZ_QT); WZ_QT=null; WZ_Q=[];
  _wzEl('wz-v-read').innerHTML='';
  clearFile();
  _wzEl('arch-err').textContent=msg;
}
function wzCancelarLectura(){
  WZ.run++; WZ.leyendo=false; clearInterval(WZ_QT); WZ_QT=null; WZ_Q=[];
  if(_ocrWorkerAct){ try{ _ocrWorkerAct.terminate(); }catch(e){} _ocrWorkerAct=null; }
  _wzEl('wz-v-read').innerHTML='';
  clearFile();
}

// Vista final del paso 1: archivo leído + datos detectados + botón Continuar
function wzDonePintar(){
  var el=_wzEl('wz-v-done'); if(!el) return;
  if(!ARCH_ROWS.length){ el.innerHTML=''; return; }
  var pdf=/\.pdf$/i.test(ARCH_FILE), oc=(document.getElementById('ent-oc').value||'').trim(), t=ARCH_TOT||{};
  var pe=ARCH_ROWS.filter(_pvRev).length;
  el.innerHTML='<div class="wz-fl"><div class="wz-fi'+(pdf?'':' xl')+'">'+(pdf?'PDF':'XLS')+'</div><div class="wz-flm"><div class="wz-fn">'+esc(ARCH_FILE||'Archivo')+'</div><div class="wz-fs">'+ARCH_ROWS.length+' líneas leídas</div></div>'+
      '<button type="button" class="btn btn-ghost btn-sm" onclick="clearFile()">Cambiar</button></div>'+
    '<div class="wz-found">'+(oc?'<span>✓ '+esc(oc)+'</span>':'')+'<span>✓ '+ARCH_ROWS.length+' productos</span>'+(t.sub?'<span>✓ Subtotal '+_soles(t.sub)+'</span>':'')+'</div>'+
    (pe?'<div class="wz-warnbox">⚠ '+pe+(pe===1?' línea necesita':' líneas necesitan')+' tu revisión. Las verás en el paso 3.</div>':'')+
    '<div class="wz-cta1"><button type="button" class="btn btn-primary wz-big" id="wz-cta" onclick="wzIr(2)">Continuar con los datos de la factura →</button><span class="wz-kbd">Enter</span></div>';
}

// Pantalla de éxito después de guardar
function wzExito(n,u,fac,monto){
  WZ.fin=true; WZ.dir=1;
  _wzEl('wz-s5').innerHTML='<div class="wz-okc"><svg viewBox="0 0 100 100"><circle class="halo" cx="50" cy="50" r="46"/><circle class="c1" cx="50" cy="50" r="46"/><path class="c2" d="M30 52l14 14 27-30"/></svg>'+
    '<h2>Entrada registrada</h2><p><b class="num">'+n+'</b> '+(n===1?'producto':'productos')+' · <b class="num">'+fmt(u)+'</b> unidades sumadas al stock.</p>'+
    '<p class="num" style="font-size:13px">Factura '+esc(fac)+(monto?' · '+_soles(monto):'')+'</p>'+
    '<div class="acts"><button type="button" class="btn" onclick="abrirEntrada()">Registrar otra entrada</button><button type="button" class="btn btn-primary" onclick="closeFS(\'fs-entrada\')">Ir a Entradas</button></div></div>';
  _wzAnimar();
  wzActualizar();
}

var ARCH_FILE='';   // nombre del archivo cargado
function abrirEntrada(){
  // invalida cualquier lectura en curso y reinicia el asistente
  WZ.run++; WZ.leyendo=false; WZ.fin=false; WZ.paso=1; WZ.origen=null; WZ.pi=0; WZ.dir=1;
  clearInterval(WZ_QT); WZ_QT=null; WZ_Q=[];
  if(_ocrWorkerAct){ try{ _ocrWorkerAct.terminate(); }catch(e){} _ocrWorkerAct=null; }
  _wzEl('wz-v-read').innerHTML=''; _wzEl('wz-s5').innerHTML='';
  var pn=document.querySelector('#fs-entrada .wz-pane'); if(pn) pn.classList.remove('in-fwd','in-back');
  switchEntradaTab('manual');
  ['ent-factura','ent-proveedor','ent-oc','ent-fvenc'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  var fe=document.getElementById('ent-fecha'); fe.value=_hoyISO(); fe.max=_hoyISO();
  document.getElementById('ent-responsable').value=(S&&S.usuario)||'';
  document.getElementById('ent-dynamics').value='Pendiente';
  document.querySelectorAll('#ent-dy button').forEach(function(x){x.classList.toggle('on',x.dataset.v==='Pendiente');});
  document.getElementById('ent-rows-wrap').innerHTML='';
  ENT_ROW_COUNT=0;
  document.getElementById('ent-err').textContent='';
  document.getElementById('ent-err4').textContent='';
  document.getElementById('ent-oc-tag').textContent='opcional';
  addEntradaRow();
  clearFile();
  document.getElementById('arch-err').textContent='';
  entCargarOCs();
  entResumen();
  openFS('fs-entrada');
}

// OC pendientes de recibir de esta tienda: al elegir una se llenan OC y proveedor
function entCargarOCs(){
  ENT_OCS=[];
  document.getElementById('ent-ocs').innerHTML='';
  google.script.run
    .withSuccessHandler(function(r){
      if(!r||!r.ok) return;
      ENT_OCS=(r.data||[]).filter(function(o){
        return (o.estado||'Pendiente')==='Pendiente' && (!S||S.rol!=='store'||String(o.sedeId)===String(S.sheetId));
      }).slice(0,6);
      entPintarOCs();
    })
    .withFailureHandler(function(){})
    .getOrdenesCompra(S.token);
}
function entPintarOCs(){
  var el=document.getElementById('ent-ocs'); if(!el) return;
  el.innerHTML=ENT_OCS.length?'<small>Pendientes:</small>'+ENT_OCS.map(function(o,i){
    return '<button type="button" onclick="entAplicarOC('+i+')">'+esc(o.oc)+'</button>';
  }).join(''):'';
}
function entAplicarOC(i){
  var o=typeof i==='number'?ENT_OCS[i]:ENT_OCS.filter(function(x){return x.oc===i;})[0];
  if(!o) return;
  document.getElementById('ent-oc').value=o.oc;
  var pv=document.getElementById('ent-proveedor');
  if(pv&&!pv.value.trim()) pv.value=o.proveedor||'';
  entResumen();
}

/* ── MANUAL: filas de producto ── */
function addEntradaRow(){
  ENT_ROW_COUNT++;
  var id=ENT_ROW_COUNT;
  var wrap=document.getElementById('ent-rows-wrap');
  var div=document.createElement('div');
  div.id='ent-row-'+id;
  div.className='en2-ln';
  div.innerHTML=
    '<span class="en2-n"></span>'+
    '<div class="en2-sk autocomplete-wrap">'+
      '<input class="en2-in mono" id="er-sku-'+id+'" placeholder="SKU o nombre…" autocomplete="off"/>'+
      '<button type="button" class="en2-cam" title="Escanear" aria-label="Escanear" tabindex="-1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>'+
      '<div class="ac-list" id="ac-er-'+id+'"></div>'+
    '</div>'+
    '<input class="en2-in en2-d" id="er-desc-'+id+'" placeholder="Se completa solo" readonly/>'+
    '<input class="en2-in en2-u" id="er-und-'+id+'" type="number" min="0" inputmode="numeric" placeholder="0"/>'+
    '<button type="button" class="en2-del" title="Quitar" aria-label="Quitar producto">×</button>';
  wrap.appendChild(div);
  var sku=document.getElementById('er-sku-'+id), und=document.getElementById('er-und-'+id);
  sku.addEventListener('input',function(){ acSearch('er-sku-'+id,'er-desc-'+id,'','ac-er-'+id); entResumen(); });
  sku.addEventListener('acpick',function(){ entResumen(); und.focus(); });
  und.addEventListener('input',entResumen);
  und.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); addEntradaRow(); } });
  div.querySelector('.en2-cam').addEventListener('click',function(){ openScanner('er-sku-'+id,'er-desc-'+id,''); });
  div.querySelector('.en2-del').addEventListener('click',function(){ removeEntradaRow(id); });
  entNumerar();
  entResumen();
  if(WZ.paso===3&&ENTRADA_TAB==='manual') sku.focus();
}

function entNumerar(){
  document.querySelectorAll('#ent-rows-wrap .en2-n').forEach(function(n,i){ n.textContent=i+1; });
}

function removeEntradaRow(id){
  var el=document.getElementById('ent-row-'+id);
  if(el)el.remove();
  if(!document.querySelector('#ent-rows-wrap [id^="ent-row-"]')) addEntradaRow();
  entNumerar();
  entResumen();
}

// Atajos: Esc cierra y Ctrl+Enter guarda
document.addEventListener('keydown',function(e){
  var fs=document.getElementById('fs-entrada');
  if(!fs||!fs.classList.contains('open')) return;
  if(e.key==='Escape'){ closeFS('fs-entrada'); return; }
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!WZ.fin){
    var b=document.getElementById(WZ.paso===4?'btn-ent-save':(WZ.paso===1?'wz-cta':'btn-ent-next'));
    if(b&&!b.disabled){ e.preventDefault(); b.click(); }
  }
});

/* ── ARCHIVO: parse Excel en el browser con SheetJS ── */
function handleDrop(event){
  event.preventDefault();
  document.getElementById('drop-zone').style.borderColor='var(--border2)';
  var file=event.dataTransfer.files[0];
  if(file)handleFileSelect(file);
}

function handleFileSelect(file){
  if(!file)return;
  var err=document.getElementById('arch-err');
  err.textContent='';
  ARCH_FILE=file.name||'';
  _archEstado('');
  if(/\.pdf$/i.test(file.name) || file.type==='application/pdf'){ leerPDFdeOC(file); return; }
  if(!file.name.match(/\.xlsx?$/i)){err.textContent='Solo se aceptan archivos .xlsx, .xls o .pdf';return;}

  var reader=new FileReader();
  var run=wzLeerInicio('xlsx',file.name);
  wzStageMsg('Leyendo la hoja de cálculo…');
  reader.onload=function(e){
    if(run!==WZ.run) return;
    try{
      var data=new Uint8Array(e.target.result);
      var wb=XLSX.read(data,{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});

      // Detectar fila de headers (buscar "Código de artículo" o similar)
      var dataStart=1; // por defecto saltar fila 0 (headers)
      ARCH_ROWS=[]; ARCH_TOT=null;

      // Si el Excel trae una columna de monto (por su encabezado), se muestra el total a importar
      var montoCol=-1;
      (rows[0]||[]).forEach(function(h,ci){
        var n=String(h||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
        if(montoCol<0 && ['monto','monto neto','importe','importe neto','importe de linea','valor neto'].indexOf(n)>-1) montoCol=ci;
      });

      rows.slice(dataStart).forEach(function(row,i){
        var sku=String(row[2]||'').trim();
        var desc=String(row[4]||'').trim();
        var cant=Number(row[6]||0);
        if(!sku||sku===''||sku.toLowerCase()==='código de artículo')return;
        var fila={idx:i+1,sku:sku,desc:desc,cant:cant,incluir:true};
        if(montoCol>-1){
          var mv=row[montoCol];
          var mn=typeof mv==='number'?mv:Number(String(mv||'').replace(/[^\d.,-]/g,'').replace(/,/g,''));
          if(isFinite(mn)&&String(mv||'')!=='') fila.monto=Math.round(mn*100)/100;
        }
        ARCH_ROWS.push(fila);
      });

      if(!ARCH_ROWS.length){ wzLeerFallo(run,'No se encontraron productos en el archivo'); return; }
      wzStageMsg('Reconociendo SKU, cantidades y montos…');
      WZ_EXP=ARCH_ROWS.length;
      wzStageAdd(ARCH_ROWS.map(function(r){return {linea:r.idx,sku:r.sku,desc:r.desc,cant:r.cant,monto:r.monto};}),run);
      renderPreview();
      wzFinLectura(run);
    }catch(ex){ wzLeerFallo(run,'Error leyendo archivo: '+ex.message); }
  };
  reader.onerror=function(){ wzLeerFallo(run,'No se pudo leer el archivo'); };
  reader.readAsArrayBuffer(file);
}

function _soles(n){
  return 'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// Resumen del paso 3: monto y unidades que "cuentan" al cambiar la selección + cuadre con el subtotal de la OC.
function _archTotal(){ _archTotalInner(); entResumen(); }
function _archTotalInner(){
  var el=document.getElementById('arch-total'); if(!el) return;
  var conMonto=ARCH_ROWS.some(function(r){return typeof r.monto==='number';});
  var box=document.getElementById('arch-preview-box');
  if(box) box.classList.toggle('pv-conmonto',conMonto);
  if(!ARCH_ROWS.length){ el.style.display='none'; el.innerHTML=''; return; }
  if(!el.firstChild){
    el.innerHTML='<div class="wz-strip">'+
      '<div id="st-mb"><small>Monto a importar</small><div class="wz-v num">S/ <span id="st-m" data-v="0">0.00</span></div><div class="wz-sub" id="st-imp"></div></div>'+
      '<div><small>Unidades</small><div class="wz-v2 num" id="st-u" data-v="0">0</div><div class="wz-sub" id="st-n"></div></div>'+
      '<div id="st-cb"><small>Cuadre con la OC</small><div class="wz-v3 num" id="st-c"></div><div class="wz-rb" id="st-rb"><i></i></div></div></div>'+
      '<div class="wz-warn" id="st-w" style="display:none"></div>';
  }
  el.style.display='block';
  var todo=0, sel=0, nSel=0, und=0;
  ARCH_ROWS.forEach(function(r){
    if(typeof r.monto==='number'){ todo+=r.monto; if(r.incluir) sel+=r.monto; }
    if(r.incluir){ nSel++; und+=Number(r.cant)||0; }
  });
  todo=Math.round(todo*100)/100; sel=Math.round(sel*100)/100;
  var quita=Math.round((todo-sel)*100)/100, t=ARCH_TOT||{};
  document.getElementById('st-mb').style.display=conMonto?'':'none';
  countTo(document.getElementById('st-m'),sel,_numFmt2,650);
  countTo(document.getElementById('st-u'),und,_numFmt0,650);
  document.getElementById('st-n').innerHTML=nSel+' de '+ARCH_ROWS.length+' productos'+(quita>0.004?' · <b>− '+_soles(quita)+' sin incluir</b>':'');
  var imp=document.getElementById('st-imp');
  if(t.total&&t.sub){
    var exacto=Math.abs(sel-t.sub)<0.005, est=exacto?t.total:Math.round(sel*(t.total/t.sub)*100)/100;
    imp.textContent=(exacto?'':'≈ ')+_soles(est)+' con impuestos';
  } else imp.textContent='';
  var cb=document.getElementById('st-cb'), rb=document.getElementById('st-rb');
  if(conMonto&&t.sub){
    var dif=Math.round((t.sub-sel)*100)/100, cuadra=Math.abs(dif)<0.05;
    cb.style.display='';
    document.getElementById('st-c').textContent=cuadra?'Cuadra ✓':(dif>0?'Faltan ':'Sobran ')+_soles(Math.abs(dif));
    rb.classList.toggle('w',!cuadra);
    rb.firstChild.style.width=Math.min(100,sel/t.sub*100)+'%';
  } else cb.style.display='none';
  var w=document.getElementById('st-w');
  if(t.sub && Math.abs(todo-t.sub)>0.05){
    w.innerHTML=ICO('warn',13)+'La suma de las líneas ('+_soles(todo)+') no coincide con el subtotal del PDF ('+_soles(t.sub)+'). Puede que algún monto se leyó mal: revisa la columna Monto.';
    w.style.display='';
  } else w.style.display='none';
}

// Una fila necesita revisión si su SKU no está en el Stock o (en PDF) no se leyó la cantidad
function _pvRev(r){
  if(r.omit) return false;
  return (!!r.noStock&&!r.nuevo) || (!!r.editable && !(r.cant>0));
}

function _pvFila(r){
  var editable=!!r.editable;
  var sku=editable
    ? '<div class="pv-sk"><input class="en2-in'+(r.noStock?' bad':'')+'" id="pv-sku-'+r.idx+'" value="'+esc(r.sku)+'" placeholder="SKU o nombre…" autocomplete="off" spellcheck="false"'+
        ' oninput="pvSkuInput('+r.idx+')" onchange="editArch('+r.idx+',\'sku\',this.value,\'cant\')" onkeydown="pvSkuKey(event,'+r.idx+')" onfocus="this.select()"/>'+
        '<div class="ac-list" id="ac-pv-'+r.idx+'"></div></div>'
    : '<div class="pv-sk mono" style="font-size:13px;font-weight:600">'+esc(r.sku)+'</div>';
  var cant=editable
    ? '<input class="en2-in pv-u" id="pv-u-'+r.idx+'" type="number" min="0" inputmode="numeric" value="'+esc(r.cant)+'" placeholder="0"'+
        ' oninput="pvCant('+r.idx+',this.value)" onblur="_pvRefrescar('+r.idx+')" onkeydown="pvCantKey(event,'+r.idx+')" onfocus="this.select()"/>'
    : '<div class="r" style="font-weight:600">'+fmt(r.cant)+'</div>';
  var rev=_pvRev(r);
  return '<div class="pv-row'+(rev?' rev warn':'')+(r.incluir?'':' off')+'" id="prev-row-'+r.idx+'">'+
    '<div class="pv-ckc"><input type="checkbox" class="pv-ck" '+(r.incluir?'checked':'')+' onchange="toggleArch('+r.idx+',this.checked)" aria-label="Incluir"/></div>'+
    sku+
    '<div class="pv-d"><span class="pv-n">#'+r.idx+'</span><span class="pv-d-t">'+esc(r.desc)+'</span>'+
      '<div class="pv-av"'+(r.aviso?'':' style="display:none"')+'>'+esc(r.aviso||'')+'</div></div>'+
    '<div class="pv-uc">'+cant+'</div>'+
    '<div class="pv-m" id="pv-m-'+r.idx+'">'+(typeof r.monto==='number'?_soles(r.monto).replace('S/ ',''):'—')+'</div>'+
  '</div>';
}

var PV_SOLO=false;
function renderPreview(){
  document.getElementById('arch-preview-title').textContent=
    'Vista previa — '+ARCH_ROWS.length+' producto(s) encontrados';
  var list=document.getElementById('arch-preview-list');
  list.innerHTML=ARCH_ROWS.map(_pvFila).join('');
  // Al elegir un producto de la lista de sugerencias se verifica el SKU
  ARCH_ROWS.forEach(function(r){
    var inp=document.getElementById('pv-sku-'+r.idx);
    if(inp) inp.addEventListener('acpick',function(){ editArch(r.idx,'sku',inp.value,'cant'); });
  });
  document.getElementById('arch-preview').classList.remove('hidden');
  _pvBarra();
  _archTotal();
  wzDonePintar();
}

// Barra superior: "Incluir todos" y el botón que filtra las filas por revisar
function _pvBarra(){
  var nRev=ARCH_ROWS.filter(_pvRev).length;
  if(!nRev) PV_SOLO=false;
  var box=document.getElementById('arch-preview-box'); if(box) box.classList.toggle('pv-solo',PV_SOLO);
  var b=document.getElementById('pv-fil');
  if(b){
    b.style.display=nRev?'':'none';
    b.classList.toggle('on',PV_SOLO);
    b.textContent=PV_SOLO?'Ver todos':nRev+' por revisar';
    b.title=PV_SOLO?'Mostrar todos los productos':'Mostrar solo los productos con SKU o cantidad por corregir';
  }
  var all=document.getElementById('pv-all');
  if(all){
    var n=ARCH_ROWS.filter(function(r){return r.incluir;}).length;
    all.checked=n>0&&n===ARCH_ROWS.length; all.indeterminate=n>0&&n<ARCH_ROWS.length;
  }
  _pvFocus();
}
function pvFiltro(){ PV_SOLO=!PV_SOLO; _pvBarra(); }
function pvTodos(v){
  ARCH_ROWS.forEach(function(r){
    r.incluir=!!v && (r.cant>0) && (!r.noStock||r.nuevo);
    if(r.incluir) r.omit=false;
  });
  renderPreview();
}

// Actualiza solo una fila (sin repintar la lista, para no perder el cursor mientras se escribe)
function _pvRefrescar(idx,foco,destello){
  var r=ARCH_ROWS.find(function(x){return x.idx===idx;});
  var el=document.getElementById('prev-row-'+idx);
  if(!r||!el){ _pvBarra(); _archTotal(); return; }
  var rev=_pvRev(r), act=document.activeElement, eraRev=el.classList.contains('rev');
  // Si se está escribiendo en la fila, no se oculta del filtro "por revisar" hasta salir de ella
  el.className='pv-row'+((rev||(PV_SOLO&&el.contains(act)&&el.classList.contains('rev')))?' rev':'')+(rev?' warn':'')+(r.incluir?'':' off');
  var ck=el.querySelector('.pv-ck'); if(ck) ck.checked=!!r.incluir;
  var t=el.querySelector('.pv-d-t'); if(t) t.textContent=r.desc;
  var av=el.querySelector('.pv-av'); if(av){ av.textContent=r.aviso||''; av.style.display=r.aviso?'':'none'; }
  var sk=document.getElementById('pv-sku-'+idx);
  if(sk){ sk.classList.toggle('bad',!!r.noStock); if(act!==sk) sk.value=r.sku; }
  var u=document.getElementById('pv-u-'+idx);
  if(u&&act!==u) u.value=r.cant;
  if(foco==='cant'&&u&&!(r.cant>0)){ u.focus(); u.select(); }
  if((destello||eraRev)&&!rev&&r.incluir){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  _pvBarra(); _archTotal();
}

function toggleArch(idx,val){
  var row=ARCH_ROWS.find(function(r){return r.idx===idx;}); if(!row) return;
  if(val&&row.editable&&!(row.cant>0)){            // sin cantidad no se puede incluir
    _pvRefrescar(idx);
    var u=document.getElementById('pv-u-'+idx); if(u){ u.focus(); u.select(); }
    return;
  }
  if(val&&row.noStock&&!row.nuevo){ row.nuevo=true; row.aviso='Producto nuevo: no está en tu Stock'; }   // marcar un SKU desconocido = es un producto nuevo
  if(!val&&row.nuevo){ row.nuevo=false; row.aviso=_PV_AVISO_STOCK; }
  if(val) row.omit=false;
  row.incluir=val;
  _pvRefrescar(idx);
}

// ── Tarjeta de pendientes (paso 3): una línea a la vez, con sugerencias ──
var _PV_AVISO_STOCK='No está en el Stock de tu sede: busca el producto en el SKU, o marca el check si es un producto nuevo';
var _pvFocusSig='';
function pvFocoNav(d){
  var n=ARCH_ROWS.filter(_pvRev).length; if(!n) return;
  WZ.pi=(WZ.pi+d+n)%n; _pvFocusSig=''; _pvFocus();
}
function _pvFocus(){
  var el=document.getElementById('arch-focus'); if(!el) return;
  var P=ARCH_ROWS.filter(_pvRev);
  if(!P.length){
    var sig0='ok:'+ARCH_ROWS.length;
    if(sig0===_pvFocusSig) return; _pvFocusSig=sig0;
    el.innerHTML=ARCH_ROWS.length?'<div class="wz-allok"><span style="color:var(--ok)">'+_WZ_CHK+'</span><div><b>Todos los productos están verificados.</b> Revisa la lista y desmarca lo que no llegó.</div></div>':'';
    return;
  }
  if(WZ.pi>=P.length) WZ.pi=0;
  var r=P[WZ.pi], sinStock=!!r.noStock&&!r.nuevo;
  var sig=r.idx+':'+(sinStock?'s':'c')+':'+P.length+':'+WZ.pi+':'+(r.sug?r.sug.length:'-');
  if(sig===_pvFocusSig) return; _pvFocusSig=sig;
  var h='<div class="wz-focus"><div class="wz-ft"><span>Pendiente '+(WZ.pi+1)+' de '+P.length+'</span>'+
    (P.length>1?'<div class="wz-fnav"><button type="button" onclick="pvFocoNav(-1)" aria-label="Anterior">‹</button><button type="button" onclick="pvFocoNav(1)" aria-label="Siguiente">›</button></div>':'')+'</div>';
  if(sinStock){
    h+='<h3>El SKU '+esc(r.sku)+' no está en tu Stock</h3><p>Línea '+r.idx+' · '+esc(r.descOCR||r.desc)+'</p><div class="wz-opts">';
    if(r.sug&&r.sug.length) h+=r.sug.map(function(x,k){ return '<button type="button" class="wz-op" onclick="pvUsarSug('+r.idx+','+k+')"><code>'+esc(x.sku)+'</code>'+esc(x.desc)+'</button>'; }).join('');
    else if(!r.sug) h+='<span class="wz-busca">Buscando coincidencias…</span>';
    h+='<button type="button" class="wz-op g" onclick="pvIrFila('+r.idx+')">Buscar otro…</button>'+
       '<button type="button" class="wz-op g" onclick="pvNuevo('+r.idx+')">Es un producto nuevo</button>'+
       '<button type="button" class="wz-op g" onclick="pvOmitir('+r.idx+')">Omitir esta línea</button></div>';
  } else {
    h+='<h3>No se pudo leer la cantidad</h3><p>Línea '+r.idx+' · '+esc(r.desc)+'</p><div class="wz-opts">'+
       '<input class="en2-in" id="fc-cant" type="number" min="1" inputmode="numeric" placeholder="Unidades" onkeydown="if(event.key===\'Enter\'){event.preventDefault();pvFocoCant('+r.idx+')}"/>'+
       '<button type="button" class="wz-op" onclick="pvFocoCant('+r.idx+')">Aplicar</button>'+
       '<button type="button" class="wz-op g" onclick="pvOmitir('+r.idx+')">Omitir esta línea</button></div>';
  }
  el.innerHTML=h+'</div>';
  if(sinStock&&!r.sug) _pvSugerir(r);
}
// Busca productos parecidos: por las palabras de la descripción y por el comienzo del SKU (errores típicos del OCR)
function _pvSugerir(r){
  if(r.sug||r.sugBusy) return;
  r.sugBusy=true;
  var desc=String(r.descOCR||r.desc||'').toUpperCase();
  var pal=desc.replace(/[^A-ZÑÁÉÍÓÚ0-9 ]/g,' ').split(/\s+/).filter(function(w){ return w.length>=4&&!/^\d+$/.test(w); });
  var uniq=[]; pal.forEach(function(w){ if(uniq.indexOf(w)<0) uniq.push(w); });
  var consultas=uniq.slice().sort(function(a,b){return b.length-a.length;}).slice(0,3);
  var pre=String(r.sku||'').slice(0,6); if(pre.length>=5) consultas.push(pre);
  if(!consultas.length){ r.sug=[]; r.sugBusy=false; _pvFocusSig=''; _pvFocus(); return; }
  var faltan=consultas.length, mapa={};
  function listo(){
    if(--faltan) return;
    var ranked=Object.keys(mapa).map(function(k){
      var x=mapa[k], d=String(x.desc||'').toUpperCase(), pts=0;
      uniq.forEach(function(w){ if(d.indexOf(w)>-1) pts++; });
      if(pre.length>=5&&String(x.sku).indexOf(pre)===0) pts+=2;
      return {x:x,pts:pts};
    }).filter(function(o){return o.pts>0;}).sort(function(a,b){return b.pts-a.pts;});
    var corte=ranked.length?Math.max(1,ranked[0].pts-2):1;       // solo las que se parecen casi tanto como la mejor
    r.sug=ranked.filter(function(o){return o.pts>=corte;}).slice(0,4).map(function(o){return o.x;});
    r.sugBusy=false; _pvFocusSig=''; _pvFocus();
  }
  consultas.forEach(function(q){
    google.script.run
      .withSuccessHandler(function(res){ ((res&&res.results)||[]).forEach(function(x){ mapa[x.sku]=x; }); listo(); })
      .withFailureHandler(function(){ listo(); })
      .buscarSKU(S.token,q);
  });
}
function pvUsarSug(idx,k){
  var r=ARCH_ROWS.find(function(x){return x.idx===idx;}); if(!r||!r.sug||!r.sug[k]) return;
  editArch(idx,'sku',r.sug[k].sku,'cant',true);
}
function pvIrFila(idx){
  var e=document.getElementById('pv-sku-'+idx);
  if(e){ e.scrollIntoView({block:'center',behavior:_wzReducido()?'auto':'smooth'}); e.focus(); e.select(); }
}
function pvNuevo(idx){
  var r=ARCH_ROWS.find(function(x){return x.idx===idx;}); if(!r) return;
  r.nuevo=true; r.omit=false; r.incluir=r.cant>0;
  r.aviso=r.cant>0?'Producto nuevo: no está en tu Stock':'Falta la cantidad: escríbela';
  _pvRefrescar(idx,null,true);
}
function pvOmitir(idx){
  var r=ARCH_ROWS.find(function(x){return x.idx===idx;}); if(!r) return;
  r.omit=true; r.incluir=false; r.aviso='Línea omitida: no se importará';
  _pvRefrescar(idx);
}
function pvFocoCant(idx){
  var e=document.getElementById('fc-cant'), v=Math.floor(Number(e&&e.value));
  if(!(v>0)){ if(e){ e.focus(); } return; }
  var r=ARCH_ROWS.find(function(x){return x.idx===idx;}); if(r) r.omit=false;
  pvCant(idx,v);
  _pvRefrescar(idx,null,true);
}

// Cambios rápidos en la vista previa
function pvSkuInput(idx){ acSearch('pv-sku-'+idx,'pv-nodesc','','ac-pv-'+idx); }
function pvSkuKey(e,idx){
  if(e.key!=='Enter') return;
  e.preventDefault();
  var inp=e.target, listId='ac-pv-'+idx, list=document.getElementById(listId), res=AC_CACHE[listId]||[];
  if(list&&list.classList.contains('open')&&res.length){
    // Enter elige la sugerencia (la del SKU exacto si existe, si no la primera)
    var q=inp.value.trim(), i=res.findIndex(function(x){return String(x.sku)===q;});
    acSelect(inp.id,'pv-nodesc','',listId,i<0?0:i);
  } else {
    clearTimeout(acTimers[listId]);
    editArch(idx,'sku',inp.value,'cant');
  }
}
function pvCant(idx,valor){
  var row=ARCH_ROWS.find(function(r){return r.idx===idx;}); if(!row) return;
  var n=Math.floor(Number(valor)); row.cant=(n>=0)?n:0;
  if(row.cant>0){ if(!row.noStock||row.nuevo) row.incluir=true; if(/cantidad/i.test(row.aviso||'')) row.aviso=''; }
  else { row.incluir=false; if(!row.noStock||row.nuevo) row.aviso='Falta la cantidad: escríbela'; }
  _pvRefrescar(idx);
}
// Enter en la cantidad pasa a la cantidad de la fila siguiente que se vea
function pvCantKey(e,idx){
  if(e.key!=='Enter') return;
  e.preventDefault();
  var el=document.getElementById('prev-row-'+idx), sig=el&&el.nextElementSibling;
  while(sig&&sig.offsetParent===null) sig=sig.nextElementSibling;
  var u=sig&&sig.querySelector('.pv-u');
  if(u){ u.focus(); u.select(); sig.scrollIntoView({block:'nearest'}); } else e.target.blur();
}

/* ── LEER LA OC DESDE UN PDF ──
   Los PDF de la OC son imágenes (sin texto), así que se leen con OCR en el propio navegador
   (pdf.js dibuja cada página y Tesseract la lee). Todo se descarga solo la primera vez que se usa.
   El resultado va a la misma vista previa que el Excel, donde se puede corregir antes de importar. */
function _archEstado(txt){ wzStageMsg(txt); }   // el estado se muestra dentro del escenario de lectura
function _ocrScript(src){
  return new Promise(function(ok,ko){
    var s=document.createElement('script'); s.src=src;
    s.onload=ok; s.onerror=function(){ ko(new Error('No se pudo cargar '+src)); };
    document.head.appendChild(s);
  });
}
var _ocrLibs=null;
function _ocrCargarLibs(){
  if(!_ocrLibs){
    _ocrLibs=Promise.all([_ocrScript('vendor/pdfjs/pdf.min.js'),_ocrScript('vendor/ocr/tesseract.min.js')]).then(function(){
      pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';
    });
  }
  return _ocrLibs.catch(function(e){ _ocrLibs=null; throw e; });
}

// Convierte el texto leído por OCR (todas las páginas) en { oc, items:[{linea,sku,desc,cant,aviso}] }
function _parsearOCTexto(paginas){
  var oc='';
  var items=[], ultimaLinea=0;
  var reItem=/^[\s|~_.\-]*(\d{1,3})\s+(\d{6,10})\s+(.*?)\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d[\d.]*,\d{2}|\d+)\s+[A-Za-z]{2,4}\b(.*)$/;
  // Los montos siempre llevan 2 decimales; el OCR a veces pierde la coma ("3.14815"), así que se toman los dígitos y se divide entre 100
  function monto(tok){ var d=String(tok||'').replace(/\D/g,''); return d? Number(d)/100 : null; }
  function ultimoNumero(txt){
    var t=String(txt||'').split(/\s+/).filter(function(x){ return /^\d[\d.,]*$/.test(x); });
    return t.length? t[t.length-1] : '';
  }
  var totales=null;
  var reItemFlojo=/^[\s|~_.\-]*(\d{1,3})\s+(\d{6,10})\s+(.*)$/;
  var reFinTabla=/Monto del|subtotal|^\s*Moneda|Impuesto/i;
  function limpiar(s){ return String(s||'').replace(/[~_|]+/g,' ').replace(/\s+/g,' ').trim(); }
  paginas.forEach(function(texto){
    var lineas=String(texto||'').split(/\r?\n/);
    if(!oc){
      var m=String(texto).match(/[O0]C-\d{5,}(?:-\d+)?/);
      if(m) oc=m[0].replace(/^0C/,'OC');
    }
    var dentro=false, actual=null;
    // Totales de la OC (última página): "PEN subtotal descuento cargos impuesto redondeo total"
    lineas.forEach(function(l){
      if(/^\s*PEN\b/.test(l)){
        var nums=l.split(/\s+/).filter(function(x){ return /^\d[\d.,]*$/.test(x); }).map(monto);
        if(nums.length>=2) totales={sub:nums[0], imp:nums.length>=4?nums[3]:null, total:nums[nums.length-1]};
      }
    });
    lineas.forEach(function(l){
      if(!dentro){ if(/de\s+l[ií]nea/i.test(l)) dentro=true; return; }
      if(reFinTabla.test(l)){ dentro=false; actual=null; return; }
      var m=l.match(reItem);
      if(m){
        var cant=Number(String(m[5]).replace(/\./g,'').replace(',','.'));
        actual={linea:Number(m[1]),sku:m[2],desc:limpiar(m[3]),cant:cant,aviso:'',monto:monto(ultimoNumero(m[6]))};
        items.push(actual); ultimaLinea=Math.max(ultimaLinea,actual.linea); return;
      }
      var f=l.match(reItemFlojo);
      if(f){
        // Línea con código pero sin cantidad legible: se muestra para corregirla a mano
        actual={linea:Number(f[1]),sku:f[2],desc:limpiar(f[3]),cant:0,aviso:'No se pudo leer la cantidad: escríbela'};
        items.push(actual); ultimaLinea=Math.max(ultimaLinea,actual.linea); return;
      }
      // Continuación de la descripción (la descripción ocupa varias líneas en el PDF)
      var t=limpiar(l);
      if(actual && t) actual.desc=(actual.desc+' '+t).trim();
    });
  });
  // Si faltan números de línea (1..N seguidos), alguna fila no se leyó
  var vistas={}; items.forEach(function(it){ vistas[it.linea]=true; });
  var faltan=[];
  for(var n=1;n<=ultimaLinea;n++){ if(!vistas[n]) faltan.push(n); }
  return {oc:oc.replace(/(OC-\d+)-\d+$/,'$1'), items:items, faltan:faltan, totales:totales};
}

async function leerPDFdeOC(file){
  var worker=null;
  var run=wzLeerInicio('pdf',file.name);
  var vivo=function(){ return run===WZ.run; };
  try{
    _archEstado('Preparando el lector de PDF… (la primera vez descarga unos 7 MB)');
    await _ocrCargarLibs(); if(!vivo()) return;
    var buf=await file.arrayBuffer(); if(!vivo()) return;
    var pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise; if(!vivo()) return;
    var base=new URL('vendor/ocr/',location.href).href;
    worker=await Tesseract.createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,gzip:true});
    _ocrWorkerAct=worker;
    if(!vivo()){ try{ await worker.terminate(); }catch(e){} return; }
    var paginas=[], n=pdf.numPages;
    for(var i=1;i<=n;i++){
      _archEstado('Leyendo el PDF… página '+i+' de '+n);
      wzStagePag(i-1,n);
      var pg=await pdf.getPage(i);
      var vp=pg.getViewport({scale:2.5});
      var cv=document.createElement('canvas'); cv.width=vp.width; cv.height=vp.height;
      await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      var res=await worker.recognize(cv);
      cv.width=cv.height=0;                            // libera la memoria del canvas
      if(!vivo()){ try{ await worker.terminate(); }catch(e){} return; }
      var texto=res.data.text||'';
      paginas.push(texto);
      // las líneas de esta página entran en el escenario apenas se leen
      var parcial=_parsearOCTexto([texto]);
      wzStageAdd(parcial.items.map(function(it){return {linea:it.linea,sku:it.sku,desc:it.desc,cant:it.cant,monto:it.monto};}),run);
      if(parcial.oc){ var d=_wzEl('wz-doc-oc'); if(d) d.textContent=parcial.oc.replace(/(OC-\d+)-\d+$/,'$1'); }
      wzStagePag(i,n);
    }
    await worker.terminate(); worker=null; _ocrWorkerAct=null;
    if(!vivo()) return;

    var r=_parsearOCTexto(paginas);
    if(!r.items.length){
      wzLeerFallo(run,'No se encontraron productos en el PDF. Si es otro formato, usa el Excel o la carga manual.');
      return;
    }
    ARCH_ROWS=r.items.map(function(it,i){
      return {idx:i+1,sku:it.sku,desc:it.desc,cant:it.cant,incluir:it.cant>0,editable:true,aviso:it.aviso,descOCR:it.desc,monto:it.monto};
    });
    ARCH_TOT=r.totales||{sub:null,imp:null,total:null};
    var ocEl=document.getElementById('ent-oc');
    if(r.oc && ocEl && !ocEl.value.trim()){ ocEl.value=r.oc; entAplicarOC(r.oc); document.getElementById('ent-oc-tag').textContent='✓ del PDF'; }

    // Verificar cada SKU contra el Stock de la sede y usar su descripción oficial
    _archEstado('Comprobando los SKU con tu Stock…');
    google.script.run
      .withSuccessHandler(function(s){
        if(!vivo()) return;
        var mapa=(s&&s.ok&&s.data)||{};
        ARCH_ROWS.forEach(function(row){ _archAplicarStock(row,mapa); });
        renderPreview();
        wzFinLectura(run);
      })
      .withFailureHandler(function(){
        if(!vivo()) return;
        renderPreview();
        wzFinLectura(run);
      })
      .skusEnStock(S.token, ARCH_ROWS.map(function(x){return x.sku;}));
  }catch(ex){
    if(worker){ try{ await worker.terminate(); }catch(e){} }
    _ocrWorkerAct=null;
    if(!vivo()) return;
    wzLeerFallo(run,'No se pudo leer el PDF: '+(ex&&ex.message?ex.message:ex)+'. Usa el Excel o la carga manual.');
  }
}

function _archAplicarStock(row,mapa){
  var d=mapa[String(row.sku).trim()];
  if(d){
    row.desc=d; row.noStock=false;
    row.aviso=row.cant>0?'':'Falta la cantidad: escríbela';
    if(row.cant>0) row.incluir=true;
  } else {
    row.desc=row.descOCR||row.desc; row.noStock=true;
    row.aviso=_PV_AVISO_STOCK;
    row.incluir=false;
  }
}

function editArch(idx,campo,valor,foco,destello){
  var row=ARCH_ROWS.find(function(r){return r.idx===idx;}); if(!row) return;
  if(campo==='cant'){ pvCant(idx,valor); return; }
  var nuevo=String(valor||'').trim();
  if(nuevo===row.sku && !row.noStock) return;   // sin cambios y ya verificado
  row.sku=nuevo; row.nuevo=false; row.omit=false; row.sug=null; row.sugBusy=false;
  google.script.run
    .withSuccessHandler(function(s){ _archAplicarStock(row,(s&&s.ok&&s.data)||{}); _pvRefrescar(idx,foco,destello); })
    .withFailureHandler(function(){ _pvRefrescar(idx); })
    .skusEnStock(S.token,[row.sku]);
}

function clearFile(){
  ARCH_ROWS=[]; ARCH_TOT=null; _pvFocusSig='';
  document.getElementById('arch-file-inp').value='';
  document.getElementById('arch-preview').classList.add('hidden');
  document.getElementById('arch-err').textContent='';
  var tt=document.getElementById('arch-total'); if(tt){ tt.innerHTML=''; tt.style.display='none'; }
  var ff=document.getElementById('arch-focus'); if(ff) ff.innerHTML='';
  ARCH_FILE='';
  if(typeof wzDonePintar==='function') wzDonePintar();
  if(typeof entResumen==='function') entResumen();
}

/* ── GUARDAR (manual o archivo) ── */
function guardarEntrada(){
  if(ENTRADA_TAB==='archivo'){
    guardarEntradaArchivo();
  } else {
    guardarEntradaManual();
  }
}

function guardarEntradaManual(){
  var fac=document.getElementById('ent-factura').value.trim();
  var err=document.getElementById('ent-err4');
  if(!fac){err.textContent='La factura/referencia es obligatoria';return;}

  // Recopilar todas las filas de producto
  var filas=[];
  var rows=document.getElementById('ent-rows-wrap').querySelectorAll('[id^="ent-row-"]');
  var valido=true;
  rows.forEach(function(row){
    var id=row.id.replace('ent-row-','');
    var sku=(document.getElementById('er-sku-'+id)||{}).value||'';
    var und=(document.getElementById('er-und-'+id)||{}).value||'';
    sku=sku.trim();
    if(!sku&&!und) return;   // fila totalmente vacía: se ignora
    if(!sku||!und){valido=false;return;}
    filas.push({
      sku:sku,
      desc:(document.getElementById('er-desc-'+id)||{}).value||'',
      unidades:Number(und)
    });
  });

  if(!filas.length){err.textContent='Agrega al menos un producto';return;}
  if(!valido){err.textContent='Completa SKU y Unidades en todos los productos';return;}

  var comun={
    factura:fac,
    proveedor:document.getElementById('ent-proveedor').value,
    oc:document.getElementById('ent-oc').value,
    fecha:document.getElementById('ent-fecha').value,
    fVenc:document.getElementById('ent-fvenc').value,
    dynamics:document.getElementById('ent-dynamics').value,
    responsable:document.getElementById('ent-responsable').value
  };

  err.textContent='';
  var btn=document.getElementById('btn-ent-save');
  btn.disabled=true;btn.textContent='Guardando...';

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent=_wzTxtGuardar();
      if(!r.ok){err.textContent=r.error;return;}
      PAGE_LOADED['stock']=false;
      reloadPage('entradas');
      wzExito(filas.length,filas.reduce(function(a,f){return a+f.unidades;},0),fac,0);
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent=_wzTxtGuardar();err.textContent=e.message;})
    .registrarEntradasMultiple(S.token, filas, comun);
}

function guardarEntradaArchivo(){
  var fac=document.getElementById('ent-factura').value.trim();
  var err=document.getElementById('ent-err4');
  if(!fac){err.textContent='La factura/referencia es obligatoria';return;}
  var seleccionados=ARCH_ROWS.filter(function(r){return r.incluir;});
  if(!seleccionados.length){err.textContent='Selecciona al menos un producto';return;}

  var filas=seleccionados.map(function(r){return{sku:r.sku,desc:r.desc,unidades:r.cant};});
  var comun={
    factura:fac,
    proveedor:document.getElementById('ent-proveedor').value,
    oc:document.getElementById('ent-oc').value,
    fecha:document.getElementById('ent-fecha').value,
    fVenc:document.getElementById('ent-fvenc').value,
    dynamics:document.getElementById('ent-dynamics').value,
    responsable:document.getElementById('ent-responsable').value
  };

  err.textContent='';
  var btn=document.getElementById('btn-ent-save');
  btn.disabled=true;btn.textContent='Importando...';

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent=_wzTxtGuardar();
      if(!r.ok){err.textContent=r.error;return;}
      var montoImp=0; seleccionados.forEach(function(x){ if(typeof x.monto==='number') montoImp+=x.monto; });
      var unidImp=filas.reduce(function(a,f){return a+f.unidades;},0), nImp=filas.length;
      PAGE_LOADED['stock']=false;
      reloadPage('entradas');
      WZ.fin=true;                                  // la pantalla de éxito ya no depende de las filas del archivo
      clearFile();
      wzExito(nImp,unidImp,fac,Math.round(montoImp*100)/100);
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent=_wzTxtGuardar();err.textContent=e.message;})
    .registrarEntradasMultiple(S.token, filas, comun);
}
