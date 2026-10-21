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
  document.getElementById('entradas-root').innerHTML=
    '<div class="ent-sum" id="ent-sum"></div>'+
    '<div class="ent-fl">'+
      '<div class="ent-srch">'+icoBuscar+'<input id="ent-busq" placeholder="Buscar factura, OC, proveedor o producto…" oninput="filterEntradas()"/></div>'+
      _fechaFiltroHTML('ent','filterEntradas','entRangoCambio')+
      '<div class="ent-seg" id="ent-est"></div>'+
      '<span class="ent-cnt" id="ent-count"></span>'+
    '</div>'+
    '<div class="ent-tw">'+
      '<div class="ent-hd"><span></span><span>Fecha</span><span>Factura · Proveedor</span><span>Orden de compra</span><span class="r">Productos</span><span class="r">Unidades</span><span>Dynamics</span><span>Responsable</span><span></span></div>'+
      '<div id="ent-rows"></div>'+
    '</div>'+
    '<div class="ent-lst" id="ent-lst"></div>';
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
      .withSuccessHandler(function(x){ if(!x.ok){ showToast(x.error,'err'); return; } showToast('Producto eliminado','ok'); _entRecargar(); })
      .withFailureHandler(function(e){ showToast(e.message,'err'); })
      .eliminarEntradas(S.token,[row]);
  },'Eliminar');
}
function entEliminarFactura(i){
  var g=_ENT_GRUPOS[i]; if(!g) return;
  _confirmDialog('Eliminar ingreso completo','Se eliminarán los '+g.items.length+' productos ('+fmt(g.und)+' und.) de la factura '+(g.factura||'—')+' del '+g.fecha+'. El stock se descuenta. No se puede deshacer.',function(){
    google.script.run
      .withSuccessHandler(function(x){ if(!x.ok){ showToast(x.error,'err'); return; } showToast('Ingreso eliminado ('+x.eliminados+' productos)','ok'); _entRecargar(); })
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
  m.style.display='flex';
}
function entGuardarEdicion(){
  var m=document.getElementById('modal-ent-edit'), row=Number(m.dataset.row), err=document.getElementById('ee-err');
  var d={ sku:document.getElementById('ee-sku').value.trim(), desc:document.getElementById('ee-desc').value.trim(), unidades:document.getElementById('ee-und').value };
  if(!d.sku){ err.textContent='El SKU no puede quedar vacío'; return; }
  if(d.unidades===''||Number(d.unidades)<0||Math.floor(Number(d.unidades))!==Number(d.unidades)){ err.textContent='Unidades: un entero igual o mayor a 0'; return; }
  var b=document.getElementById('ee-ok'); b.disabled=true;
  google.script.run
    .withSuccessHandler(function(x){ b.disabled=false; if(!x.ok){ err.textContent=x.error; return; } m.style.display='none'; showToast('Entrada actualizada','ok'); _entRecargar(); })
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
  document.getElementById('ent-m-manual').classList.toggle('on', tab==='manual');
  document.getElementById('ent-m-archivo').classList.toggle('on', tab==='archivo');
  document.getElementById('btn-ent-save').textContent=tab==='manual'?'Guardar entrada':'Importar desde archivo';
  entResumen();
}

function entDyn(b){
  document.getElementById('ent-dynamics').value=b.dataset.v;
  document.querySelectorAll('#ent-dy button').forEach(function(x){x.classList.toggle('on',x===b);});
}

// Resumen del pie y estado del botón Guardar
function entResumen(){
  var fac=(document.getElementById('ent-factura').value||'').trim();
  var n=0,u=0;
  if(ENTRADA_TAB==='manual'){
    document.querySelectorAll('#ent-rows-wrap [id^="ent-row-"]').forEach(function(row){
      var id=row.id.replace('ent-row-','');
      var sku=((document.getElementById('er-sku-'+id)||{}).value||'').trim();
      var und=Number((document.getElementById('er-und-'+id)||{}).value||0);
      if(sku&&und>0){ n++; u+=und; }
    });
  } else {
    ARCH_ROWS.forEach(function(r){ if(r.incluir){ n++; u+=Number(r.cant)||0; } });
  }
  var ok=!!fac&&n>0;
  var btn=document.getElementById('btn-ent-save');
  if(btn&&btn.textContent.indexOf('...')<0) btn.disabled=!ok;
  var msg=document.getElementById('ent-msg');
  if(msg){
    msg.innerHTML=ok?'<b>'+n+'</b> '+(n===1?'producto':'productos')+' · <b>'+fmt(u)+'</b> unidades':(!fac?'Escribe la factura para continuar':(ENTRADA_TAB==='manual'?'Agrega al menos un producto':'Carga un archivo y marca los productos'));
    msg.style.color=ok?'':'var(--text3)';
  }
  var st=document.getElementById('ent-stat');
  if(st){ st.className='en2-stat'+(ok?' ok':''); document.getElementById('ent-stat-t').textContent=ok?'Listo para guardar':'Faltan datos'; }
}

function abrirEntrada(){
  switchEntradaTab('manual');
  ['ent-factura','ent-proveedor','ent-oc','ent-fvenc'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  document.getElementById('ent-responsable').value=(S&&S.usuario)||'';
  document.getElementById('ent-dynamics').value='Pendiente';
  document.querySelectorAll('#ent-dy button').forEach(function(x){x.classList.toggle('on',x.dataset.v==='Pendiente');});
  document.getElementById('ent-rows-wrap').innerHTML='';
  ENT_ROW_COUNT=0;
  document.getElementById('ent-err').textContent='';
  addEntradaRow();
  clearFile();
  document.getElementById('arch-err').textContent='';
  entCargarOCs();
  entResumen();
  openFS('fs-entrada');
  setTimeout(function(){document.getElementById('ent-factura').focus();},120);
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
  sku.focus();
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
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){
    var b=document.getElementById('btn-ent-save');
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
  _archEstado('');
  if(/\.pdf$/i.test(file.name) || file.type==='application/pdf'){ leerPDFdeOC(file); return; }
  if(!file.name.match(/\.xlsx?$/i)){err.textContent='Solo se aceptan archivos .xlsx, .xls o .pdf';return;}

  var reader=new FileReader();
  reader.onload=function(e){
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

      if(!ARCH_ROWS.length){err.textContent='No se encontraron productos en el archivo';return;}
      renderPreview();
    }catch(ex){err.textContent='Error leyendo archivo: '+ex.message;}
  };
  reader.readAsArrayBuffer(file);
}

function _soles(n){
  return 'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// Monto de la OC: baja al desmarcar productos. Solo aparece si el archivo trae montos (el PDF de la OC los trae).
function _archTotal(){ _archTotalInner(); entResumen(); }
function _archTotalInner(){
  var el=document.getElementById('arch-total'); if(!el) return;
  var th=document.getElementById('arch-th-monto');
  var conMonto=ARCH_ROWS.some(function(r){return typeof r.monto==='number';});
  if(th) th.style.display=conMonto?'':'none';
  if(!conMonto){ el.style.display='none'; el.innerHTML=''; return; }
  var todo=0, sel=0, nSel=0;
  ARCH_ROWS.forEach(function(r){
    if(typeof r.monto!=='number') return;
    todo+=r.monto;
    if(r.incluir){ sel+=r.monto; nSel++; }
  });
  todo=Math.round(todo*100)/100; sel=Math.round(sel*100)/100;
  var quita=Math.round((todo-sel)*100)/100;
  var t=ARCH_TOT||{};
  var html='<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r2);padding:14px 16px">'+
    '<div><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3)">Monto a importar (sin impuestos)</div>'+
      '<div style="font-size:26px;font-weight:700;letter-spacing:-.02em;color:var(--text)">'+_soles(sel)+'</div>'+
      '<div style="font-size:12px;color:var(--text2)">'+nSel+' de '+ARCH_ROWS.length+' productos'+(quita>0.004?' · <span style="color:var(--warn)">− '+_soles(quita)+' sin incluir</span>':'')+'</div></div>';
  if(t.total && t.sub){
    var exacto=Math.abs(sel-t.sub)<0.005;
    var est=exacto? t.total : Math.round(sel*(t.total/t.sub)*100)/100;
    html+='<div style="text-align:right"><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3)">Total con impuestos'+(exacto?'':' (aprox.)')+'</div>'+
      '<div style="font-size:18px;font-weight:600;color:var(--text)">'+(exacto?'':'≈ ')+_soles(est)+'</div>'+
      '<div style="font-size:12px;color:var(--text2)">OC completa: '+_soles(t.total)+'</div></div>';
  }
  html+='</div>';
  if(t.sub && Math.abs(todo-t.sub)>0.05){
    html+='<div style="font-size:12px;color:var(--warn);margin-top:6px">'+ICO('warn',13)+'La suma de las líneas ('+_soles(todo)+') no coincide con el subtotal del PDF ('+_soles(t.sub)+'). Puede que algún monto se leyó mal: revisa la columna Monto.</div>';
  }
  el.innerHTML=html; el.style.display='block';
}

function renderPreview(){
  document.getElementById('arch-preview-title').textContent=
    'Vista previa — '+ARCH_ROWS.length+' producto(s) encontrados';
  var conMonto=ARCH_ROWS.some(function(r){return typeof r.monto==='number';});
  var tbody=ARCH_ROWS.map(function(r){
    // Las filas leídas de un PDF se pueden corregir aquí (SKU y cantidad); las de Excel se muestran tal cual
    var skuCell=r.editable
      ? '<input class="inp" value="'+esc(r.sku)+'" onchange="editArch('+r.idx+',\'sku\',this.value)" style="width:98px;padding:4px 6px;font-size:13px;font-family:var(--font-mono)"/>'
      : esc(r.sku);
    var cantCell=r.editable
      ? '<input class="inp" type="number" min="0" value="'+esc(r.cant)+'" onchange="editArch('+r.idx+',\'cant\',this.value)" style="width:68px;padding:4px 6px;font-size:13px;text-align:right;font-weight:600"/>'
      : fmt(r.cant);
    return '<tr id="prev-row-'+r.idx+'">'+
      '<td class="mono" style="font-size:11px;color:var(--text3)">'+r.idx+'</td>'+
      '<td class="mono">'+skuCell+'</td>'+
      '<td class="td-desc"'+(r.editable?' style="max-width:130px"':'')+'>'+esc(r.desc)+(r.aviso?'<div style="font-size:11px;color:var(--warn);white-space:normal">'+esc(r.aviso)+'</div>':'')+'</td>'+
      '<td class="r" style="font-weight:600">'+cantCell+'</td>'+
      (conMonto?'<td class="r mono" style="font-size:12px;color:var(--text2);white-space:nowrap">'+(typeof r.monto==='number'?_soles(r.monto).replace('S/ ',''):'—')+'</td>':'')+
      '<td class="c"><input type="checkbox" '+(r.incluir?'checked':'')+ 
        ' onchange="toggleArch('+r.idx+',this.checked)" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer"/></td>'+
    '</tr>';
  }).join('');
  document.getElementById('arch-preview-tbody').innerHTML=tbody;
  document.getElementById('arch-preview').classList.remove('hidden');
  _archTotal();
}

function toggleArch(idx,val){
  var row=ARCH_ROWS.find(function(r){return r.idx===idx;});
  if(row)row.incluir=val;
  _archTotal();
}

/* ── LEER LA OC DESDE UN PDF ──
   Los PDF de la OC son imágenes (sin texto), así que se leen con OCR en el propio navegador
   (pdf.js dibuja cada página y Tesseract la lee). Todo se descarga solo la primera vez que se usa.
   El resultado va a la misma vista previa que el Excel, donde se puede corregir antes de importar. */
function _archEstado(txt){
  var el=document.getElementById('arch-ocr-estado'); if(!el) return;
  el.style.display=txt?'block':'none';
  el.textContent=txt||'';
}
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
  var reItem=/^[\s|~_.\-]*(\d{1,3})\s+(\d{6,10})\s+(.*?)\s*(\d{2}\/\d{2}\/\d{4})\s+(\d[\d.]*,\d{2}|\d+)\s+[A-Za-z]{2,4}\b(.*)$/;
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
  var err=document.getElementById('arch-err');
  var worker=null;
  try{
    _archEstado('Preparando el lector de PDF… (la primera vez descarga unos 7 MB)');
    await _ocrCargarLibs();
    var buf=await file.arrayBuffer();
    var pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
    var base=new URL('vendor/ocr/',location.href).href;
    worker=await Tesseract.createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,gzip:true});
    var paginas=[];
    for(var i=1;i<=pdf.numPages;i++){
      _archEstado('Leyendo el PDF… página '+i+' de '+pdf.numPages);
      var pg=await pdf.getPage(i);
      var vp=pg.getViewport({scale:2.5});
      var cv=document.createElement('canvas'); cv.width=vp.width; cv.height=vp.height;
      await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      var res=await worker.recognize(cv);
      paginas.push(res.data.text||'');
    }
    await worker.terminate(); worker=null;

    var r=_parsearOCTexto(paginas);
    if(!r.items.length){
      _archEstado('');
      err.textContent='No se encontraron productos en el PDF. Si es otro formato, usa el Excel o la carga manual.';
      return;
    }
    ARCH_ROWS=r.items.map(function(it,i){
      return {idx:i+1,sku:it.sku,desc:it.desc,cant:it.cant,incluir:it.cant>0,editable:true,aviso:it.aviso,descOCR:it.desc,monto:it.monto};
    });
    ARCH_TOT=r.totales||{sub:null,imp:null,total:null};
    var ocEl=document.getElementById('ent-oc');
    if(r.oc && ocEl && !ocEl.value.trim()){ ocEl.value=r.oc; entAplicarOC(r.oc); }

    // Verificar cada SKU contra el Stock de la sede y usar su descripción oficial
    _archEstado('Comprobando los SKU con tu Stock…');
    google.script.run
      .withSuccessHandler(function(s){
        var mapa=(s&&s.ok&&s.data)||{};
        ARCH_ROWS.forEach(function(row){ _archAplicarStock(row,mapa); });
        _archEstado('PDF leído'+(r.oc?' · '+r.oc:'')+' · revisa la vista previa antes de importar'+
          (r.faltan.length?' · Atención: no se leyeron las líneas: '+r.faltan.join(', '):''));
        renderPreview();
      })
      .withFailureHandler(function(){
        _archEstado('PDF leído · no se pudo comprobar el Stock, revisa los SKU a mano');
        renderPreview();
      })
      .skusEnStock(S.token, ARCH_ROWS.map(function(x){return x.sku;}));
  }catch(ex){
    if(worker){ try{ await worker.terminate(); }catch(e){} }
    _archEstado('');
    err.textContent='No se pudo leer el PDF: '+(ex&&ex.message?ex.message:ex)+'. Usa el Excel o la carga manual.';
  }
}

function _archAplicarStock(row,mapa){
  var d=mapa[String(row.sku).trim()];
  if(d){
    row.desc=d; row.aviso=row.cant>0?'':row.aviso; row.noStock=false;
    if(row.cant>0) row.incluir=true;
  } else {
    row.desc=row.descOCR||row.desc; row.noStock=true;
    row.aviso='No está en el Stock de tu sede: corrige el SKU, o marca ¿Incluir? si es un producto nuevo';
    row.incluir=false;
  }
}

function editArch(idx,campo,valor){
  var row=ARCH_ROWS.find(function(r){return r.idx===idx;}); if(!row) return;
  if(campo==='cant'){
    var n=Math.floor(Number(valor)); row.cant=(n>=0)?n:0;
    if(row.cant>0 && !row.noStock) row.incluir=true;
    if(row.cant>0 && row.aviso && /cantidad/i.test(row.aviso)) row.aviso='';
    renderPreview(); return;
  }
  row.sku=String(valor||'').trim();
  google.script.run
    .withSuccessHandler(function(s){ _archAplicarStock(row,(s&&s.ok&&s.data)||{}); renderPreview(); })
    .withFailureHandler(function(){ renderPreview(); })
    .skusEnStock(S.token,[row.sku]);
}

function clearFile(){
  ARCH_ROWS=[]; ARCH_TOT=null;
  _archEstado('');
  document.getElementById('arch-file-inp').value='';
  document.getElementById('arch-preview').classList.add('hidden');
  document.getElementById('arch-err').textContent='';
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
  var err=document.getElementById('ent-err');
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
    fVenc:document.getElementById('ent-fvenc').value,
    dynamics:document.getElementById('ent-dynamics').value,
    responsable:document.getElementById('ent-responsable').value
  };

  err.textContent='';
  var btn=document.getElementById('btn-ent-save');
  btn.disabled=true;btn.textContent='Guardando...';

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Guardar entrada';
      if(!r.ok){err.textContent=r.error;return;}
      showToast('Entrada registrada ('+filas.length+' SKU'+(filas.length>1?'s':'')+')','ok');
      closeFS('fs-entrada');
      reloadPage('entradas');
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Guardar entrada';err.textContent=e.message;})
    .registrarEntradasMultiple(S.token, filas, comun);
}

function guardarEntradaArchivo(){
  var fac=document.getElementById('ent-factura').value.trim();
  var err=document.getElementById('arch-err');
  if(!fac){err.textContent='La factura/referencia es obligatoria';return;}
  var seleccionados=ARCH_ROWS.filter(function(r){return r.incluir;});
  if(!seleccionados.length){err.textContent='Selecciona al menos un producto';return;}

  var filas=seleccionados.map(function(r){return{sku:r.sku,desc:r.desc,unidades:r.cant};});
  var comun={
    factura:fac,
    proveedor:document.getElementById('ent-proveedor').value,
    oc:document.getElementById('ent-oc').value,
    fVenc:document.getElementById('ent-fvenc').value,
    dynamics:document.getElementById('ent-dynamics').value,
    responsable:document.getElementById('ent-responsable').value
  };

  err.textContent='';
  var btn=document.getElementById('btn-ent-save');
  btn.disabled=true;btn.textContent='Importando...';

  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Importar desde archivo';
      if(!r.ok){err.textContent=r.error;return;}
      showToast('Importados '+filas.length+' SKU'+(filas.length>1?'s':'')+' correctamente','ok');
      clearFile();
      closeFS('fs-entrada');
      reloadPage('entradas');
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Importar desde archivo';err.textContent=e.message;})
    .registrarEntradasMultiple(S.token, filas, comun);
}
