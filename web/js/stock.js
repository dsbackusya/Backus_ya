/* Pantalla Stock — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   STOCK
══════════════════════════════════════ */
/* ══════════════════════════════════════
   DASHBOARD — admin / invitado
══════════════════════════════════════ */
var DASH={d:null,m:null,sede:'',hl:'',ts:null,q:'',est:'',rec:null};

function loadDashboard(){
  if(!S||!S.token){errBox('dashboard-root','Sin sesión activa.','dashboard');PAGE_LOADING['dashboard']=false;return;}
  _FORCE_REFRESH['dashboard']=false;
  var t = (REQ_TOKEN.dashboard = (REQ_TOKEN.dashboard||0) + 1);
  var res={dash:null,oc:null}, falta=2;
  var listo=function(){
    if(--falta>0||t!==REQ_TOKEN.dashboard) return;
    PAGE_LOADING['dashboard']=false;
    DATA.oc=(res.oc&&res.oc.ok)?res.oc.data:[];
    renderDashboard(res.dash);
  };
  google.script.run
    .withSuccessHandler(function(r){ res.dash=r; listo(); })
    .withFailureHandler(function(e){ res.dash={ok:false,error:e.message}; listo(); })
    .getDashboard(S.token);
  google.script.run
    .withSuccessHandler(function(r){ res.oc=r; listo(); })
    .withFailureHandler(function(){ res.oc=null; listo(); })
    .getOrdenesCompra(S.token);
}

function _dashDias(fechaISO, hoyISO){
  if(!fechaISO) return null;
  return Math.round((Date.parse(fechaISO+'T00:00:00Z')-Date.parse(hoyISO+'T00:00:00Z'))/86400000);
}
function _dashFecha(iso){ var p=String(iso||'').split('-'); return p.length===3?p[2]+'/'+p[1]:''; }

// Convierte lo que devuelve la base en OC por columna y alertas por sede
function _dashModelo(d){
  var nom={}; (d.sedes||[]).forEach(function(s){ nom[s.id]=s.nombre; });
  var sedeN=function(id){ return nom[id]||'Sin sede'; };
  var ocs=(d.oc||[]).map(function(o){
    var dias=_dashDias(o.fecha,d.hoy), col, txt;
    if(o.estado==='Recibido'){ col='r'; txt=dias===null?'Recibida':(dias===0?'Hoy':dias===-1?'Ayer':'Hace '+(-dias)+' d'); }
    else if(dias===null){ col='p'; txt='Sin fecha'; }
    else if(dias<0){ col='v'; txt='Vencida '+(-dias)+(dias===-1?' día':' d'); }
    else if(dias===0){ col='h'; txt='Hoy'; }
    else { col='p'; txt=dias===1?'Mañana':'En '+dias+' d'; }
    return {oc:o.oc,pv:o.proveedor||'—',sedeId:o.sede_id,sede:sedeN(o.sede_id),col:col,txt:txt,fecha:o.fecha,dias:dias};
  });
  var al=[];
  (d.stock_negativo||[]).forEach(function(x){
    al.push({sede:sedeN(x.sede_id),sev:'rd',t:x.n+(x.n===1?' SKU con stock negativo':' SKUs con stock negativo'),
      d:'Salidas mayores a lo ingresado'+((x.ejemplos&&x.ejemplos.length)?'. Ej.: '+x.ejemplos.join(', '):''),ir:'Ver stock',go:'stock:neg'});
  });
  ocs.forEach(function(o){
    if(o.col==='v') al.push({sede:o.sede,sev:'rd',t:o.oc+' vencida hace '+(-o.dias)+(o.dias===-1?' día':' días'),
      d:'Esperada el '+_dashFecha(o.fecha)+' · '+o.pv,ir:'Ver OC',go:'oc',key:o.oc});
    if(o.col==='h') al.push({sede:o.sede,sev:'am',t:o.oc+' llega hoy',d:o.pv+' · falta registrar la entrada',ir:'Ver OC',go:'oc',key:o.oc});
  });
  (d.pedidos_duplicados||[]).forEach(function(x){
    al.push({sede:sedeN(x.sede_id),sev:'am',t:x.n+(x.n===1?' pedido está':' pedidos están')+' en Salidas y en Cancelados',
      d:'Posible duplicado: confirma cuál es el vigente',ir:'Revisar',go:'cancelados'});
  });
  (d.sin_stock_con_demanda||[]).forEach(function(x){
    al.push({sede:sedeN(x.sede_id),sev:'am',t:x.n+(x.n===1?' SKU sin stock con salidas':' SKUs sin stock con salidas')+' esta semana',
      d:'Había demanda en los últimos 7 días y hoy está en cero o negativo',ir:'Ver stock',go:'stock:sin'});
  });
  var con={}; (d.con_conteo_hoy||[]).forEach(function(id){ con[id]=true; });
  (d.sedes||[]).forEach(function(s){
    if(!con[s.id]) al.push({sede:s.nombre,sev:'bl',t:'Sin conteo registrado hoy',d:'La validación de hoy quedará vacía hasta que cuenten',ir:'Ir a Conteo',go:'conteo'});
  });
  var ord={rd:0,am:1,bl:2};
  al.sort(function(a,b){ return ord[a.sev]-ord[b.sev]; });
  return {ocs:ocs,alertas:al,sedes:(d.sedes||[]).map(function(s){return s.nombre;})};
}

function renderDashboard(r){
  if(_handleExpired(r,'dashboard-root')) return;
  if(!r||!r.ok){errBox('dashboard-root',r?r.error:'Error desconocido','dashboard');return;}
  DASH.d=r.data; DASH.m=_dashModelo(r.data); DASH.ts=new Date(); DASH.hl='';
  if(DASH.sede && DASH.m.sedes.indexOf(DASH.sede)<0) DASH.sede='';
  dashDibujar();
}

function dashDibujar(){
  var root=document.getElementById('dashboard-root'); if(!root||!DASH.m) return;
  var m=DASH.m, sede=DASH.sede;
  var fs=function(x){ return !sede||x.sede===sede; };
  var al=m.alertas.filter(fs), ocs=m.ocs.filter(fs);
  var crit=al.filter(function(x){return x.sev==='rd';}).length, avis=al.filter(function(x){return x.sev==='am';}).length;
  var abiertas=ocs.filter(function(x){return x.col!=='r';});
  var venc=ocs.filter(function(x){return x.col==='v';}).length, hoyN=ocs.filter(function(x){return x.col==='h';}).length;
  var recib=ocs.filter(function(x){return x.col==='r';}).length;
  var fechaTxt=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',weekday:'long',day:'numeric',month:'long'}).format(new Date(DASH.d.hoy+'T12:00:00Z'));
  fechaTxt=fechaTxt.replace(',','');
  fechaTxt=fechaTxt.charAt(0).toUpperCase()+fechaTxt.slice(1);
  var hora=DASH.ts?DASH.ts.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}):'';

  var seg='';
  if(m.sedes.length>1){
    seg='<div class="dash-seg">'+[''].concat(m.sedes).map(function(s){
      return '<button class="'+(s===sede?'on':'')+'" onclick="dashSede(this.dataset.s)" data-s="'+esc(s)+'">'+(s||'Todas')+'</button>';
    }).join('')+'</div>';
  }

  var hero=
    '<div class="dash-hero">'+
      '<div class="dash-hc big"><div class="dash-k">Hoy requiere atención</div>'+
        '<div class="dash-v">'+al.length+' <span class="dash-v-s">'+(al.length===1?'cosa':'cosas')+'</span></div>'+
        '<div class="dash-msg">'+(al.length?((crit?crit+(crit===1?' crítica':' críticas'):'Nada crítico')+(avis?' y '+avis+(avis===1?' aviso':' avisos'):'')+'. Empieza por lo rojo.'):'Todo en orden.')+'</div></div>'+
      '<div class="dash-hc"><div class="dash-k">OC pendientes</div><div class="dash-v">'+abiertas.length+'</div><div class="dash-n">'+hoyN+(hoyN===1?' llega hoy':' llegan hoy')+'</div></div>'+
      '<div class="dash-hc"><div class="dash-k">OC vencidas</div><div class="dash-v" style="color:'+(venc?'var(--danger)':'var(--text)')+'">'+venc+'</div><div class="dash-n">sin recibir tras su fecha</div></div>'+
      '<div class="dash-hc"><div class="dash-k">Recibidas (7 días)</div><div class="dash-v" style="color:var(--ok)">'+recib+'</div><div class="dash-n">por fecha de recepción</div></div>'+
    '</div>';

  var cols=[['v','Vencidas','p-rd'],['h','Llegan hoy','p-am'],['p','Próximas','p-ac'],['r','Recibidas','p-ok']];
  var kan='<div class="dash-kan">'+cols.map(function(c){
    var l=ocs.filter(function(x){return x.col===c[0];});
    if(c[0]==='r') l=l.slice().reverse();
    return '<div class="dash-col"><div class="dash-colh">'+c[1]+'<span class="c">'+l.length+'</span></div>'+
      (l.length?l.map(function(x){
        return '<div class="dash-oc" data-oc="'+esc(x.oc)+'" onclick="dashResaltar(this.dataset.oc)">'+
          '<div class="n">'+esc(x.oc)+'</div><div class="p">'+esc(x.pv)+'</div>'+
          '<div class="f"><span>'+esc(x.sede)+'</span><span class="dash-pill '+c[2]+'">'+esc(x.txt)+'</span></div></div>';
      }).join(''):'<div class="dash-empty">Sin órdenes</div>')+'</div>';
  }).join('')+'</div>';

  var sedesMostrar=m.sedes.filter(function(s){return !sede||s===sede;});
  if(m.alertas.some(function(x){return x.sede==='Sin sede';})&&!sede) sedesMostrar=sedesMostrar.concat(['Sin sede']);
  var tarjetas='<div class="dash-sedes">'+sedesMostrar.map(function(s){
    var a=m.alertas.filter(function(x){return x.sede===s;}), nOC=m.ocs.filter(function(x){return x.sede===s&&x.col!=='r';}).length;
    var rojas=a.filter(function(x){return x.sev==='rd';}).length;
    var filas=a.length?a.map(function(x){
      var sel=DASH.hl&&x.key===DASH.hl;
      return '<div class="dash-li'+(sel?' hl':'')+'"><span class="dd '+x.sev+'"></span><div class="t">'+esc(x.t)+'<small>'+esc(x.d)+'</small></div>'+
        '<button data-go="'+esc(x.go)+'" data-key="'+esc(x.key||'')+'" onclick="dashIr(this.dataset.go,this.dataset.key)">'+esc(x.ir)+'</button></div>';
    }).join(''):'<div class="dash-okline"><i></i> Todo en orden</div>';
    return '<div class="dash-sd"><div class="dash-sdh"><div class="dash-sdn">'+esc(s)+'</div></div>'+
      '<div class="dash-sdsub">'+a.length+(a.length===1?' alerta · ':' alertas · ')+nOC+(nOC===1?' OC abierta':' OC abiertas')+'</div>'+
      '<div class="dash-mini"><div><b style="color:'+(rojas?'var(--danger)':'var(--text)')+'">'+rojas+'</b><span>críticas</span></div><div><b>'+nOC+'</b><span>OC abiertas</span></div></div>'+
      filas+'</div>';
  }).join('')+'</div>';

  var icoDl='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var dl=function(id,txt,fn){ return '<button class="dash-dl" id="'+id+'" onclick="'+fn+'">'+icoDl+' '+txt+'</button>'; };

  root.innerHTML=
    '<div class="dash-top"><div><div class="dash-h1">Dashboard</div><div class="dash-sub">'+esc(fechaTxt)+(hora?' · actualizado '+hora:'')+'</div></div>'+seg+'</div>'+
    hero+
    '<div class="dash-sec"><span>Órdenes de compra · estado de recepción</span><a onclick="dashVerOC(\'\')">Ver todas las OC '+ICO('right',13,'l')+'</a></div>'+kan+
    '<div class="dash-sec"><span>Qué atender por sede</span></div>'+tarjetas+
    '<div class="dash-sec"><span>Recepciones por tienda</span>'+
      '<span class="dash-sec-r"><input type="date" class="filter-inp" id="oc-recep-fecha" onchange="loadRecepcionesPorTienda(this.value)"/></span></div>'+
      '<div class="stats" id="oc-recep-grid"></div>'+
    '<div class="dash-sec" id="dash-oclist"><span>Todas las órdenes de compra</span><span class="result-count" id="oc-count"></span></div>'+
    '<div class="filters" style="flex-wrap:wrap;gap:8px;align-items:center">'+
      '<input class="filter-inp" id="oc-busq" placeholder="Buscar OC, proveedor, entrega..." style="width:260px" value="'+esc(DASH.q||'')+'" oninput="DASH.q=this.value;filterOC()"/>'+
      '<select class="filter-select" id="oc-estado-filtro" onchange="DASH.est=this.value;filterOC()">'+
        '<option value="">Todos los estados</option>'+
        '<option value="Pendiente"'+(DASH.est==='Pendiente'?' selected':'')+'>Pendiente</option>'+
        '<option value="Recibido"'+(DASH.est==='Recibido'?' selected':'')+'>Recibido</option>'+
        '<option value="Cancelada"'+(DASH.est==='Cancelada'?' selected':'')+'>Cancelada</option>'+
      '</select>'+
    '</div>'+
    '<div class="table-wrap"><table><thead><tr><th>Fecha recepción</th><th>Orden de compra</th><th>Proveedor</th><th>Nombre de entrega</th><th class="c">Estado</th></tr></thead><tbody id="oc-tbody"></tbody></table></div>'+
    '<div class="dash-sec"><span>Descargas</span></div>'+
    '<div class="dash-dls">'+dl('btn-dl-stock','Stock actual','dashExportStock()')+dl('btn-dl-salidas','Salidas','dashExportModulo(\'salidas\',\'btn-dl-salidas\')')+
      dl('btn-dl-entradas','Entradas','dashExportModulo(\'entradas\',\'btn-dl-entradas\')')+dl('btn-dl-mt','Mermas y traslados','dashExportModulo(\'mt\',\'btn-dl-mt\')')+'</div>';
  dashPostDibujo();
}

function dashPostDibujo(){
  filterOC();
  if(DASH.rec) renderRecepcionesPorTienda(DASH.rec); else loadRecepcionesPorTienda('');
}
function dashSede(s){ DASH.sede=s||''; DASH.hl=''; dashDibujar(); }
function dashResaltar(oc){ DASH.hl=(DASH.hl===oc?'':oc); dashDibujar(); }

// Lleva a la pantalla donde se resuelve la alerta (y aplica el filtro de stock cuando corresponde)
function dashVerOC(oc){
  DASH.q=oc||''; DASH.est='';
  dashDibujar();
  var el=document.getElementById('dash-oclist'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}
function dashIr(dest,key){
  if(dest==='oc'){ dashVerOC(key); return; }
  var p=String(dest).split(':'), pag=p[0], filtro=p[1]||'';
  navTo(pag,document.getElementById('nav-'+pag));
  if(pag==='stock'&&filtro){
    var n=0, iv=setInterval(function(){
      n++;
      if(document.getElementById('sbtn-'+filtro)){ clearInterval(iv); setStockFiltroEstado(filtro); }
      else if(n>40) clearInterval(iv);
    },150);
  }
}

function dashExportStock(){
  var btn=document.getElementById('btn-dl-stock'), orig=btn?btn.innerHTML:'';
  if(btn){btn.disabled=true;btn.textContent='Preparando…';}
  google.script.run
    .withSuccessHandler(function(r){
      if(btn){btn.disabled=false;btn.innerHTML=orig;}
      if(!r||!r.ok){showToast(r?r.error:'Error al exportar','err');return;}
      _dashExportStockExcel(r.data||[]);
    })
    .withFailureHandler(function(e){ if(btn){btn.disabled=false;btn.innerHTML=orig;} showToast(e.message,'err'); })
    .getStockPackTodasSedes(S.token);
}
function _dashExportStockExcel(data){
  data=data||[];
  if(!data.length){showToast('Sin datos','err');return;}
  var sedes=[...new Set(data.map(function(x){return x.sede;}).filter(Boolean))].sort();
  if(!sedes.length){showToast('Sin datos multi-sede','err');return;}
  var skuMap={};
  data.forEach(function(r){
    if(!r.sku) return;
    if(!skuMap[r.sku]) skuMap[r.sku]={sku:r.sku,sap:'',desc:'',marca:'',cat:'',sedes:{}};
    if(!skuMap[r.sku].sap&&r.sap) skuMap[r.sku].sap=r.sap;
    if(!skuMap[r.sku].desc&&r.desc) skuMap[r.sku].desc=r.desc;
    if(!skuMap[r.sku].marca&&r.marca) skuMap[r.sku].marca=r.marca;
    if(!skuMap[r.sku].cat&&r.categoria) skuMap[r.sku].cat=r.categoria;
    if(r.sede) skuMap[r.sku].sedes[r.sede]=(skuMap[r.sku].sedes[r.sede]||0)+(Number(r.stockPack)||0);
  });
  var headers=['SKU / Lovis','SAP','Descripción','Marca','Categoría'];
  sedes.forEach(function(s){headers.push(s+' · Stock pack');});
  headers.push('TOTAL Stock pack');
  var ws_data=[headers];
  Object.values(skuMap).sort(function(a,b){return a.sku.localeCompare(b.sku);}).forEach(function(item){
    var fila=[item.sku,item.sap,item.desc,item.marca,item.cat];var total=0;
    sedes.forEach(function(s){var v=Math.round(item.sedes[s]||0);fila.push(v);total+=v;});
    fila.push(total);ws_data.push(fila);
  });
  var wb=XLSX.utils.book_new();var ws=XLSX.utils.aoa_to_sheet(ws_data);
  var colW=[{wch:14},{wch:12},{wch:40},{wch:16},{wch:18}];
  sedes.forEach(function(){colW.push({wch:16});});colW.push({wch:14});
  ws['!cols']=colW;XLSX.utils.book_append_sheet(wb,ws,'Stock por sede');
  XLSX.writeFile(wb,'stock_pivot_'+_hoyISO()+'.xlsx');
  showToast('Pivot Stock exportado ('+Object.keys(skuMap).length+' SKUs · '+sedes.length+' sedes)','ok');
}

function dashExportModulo(modulo,btnId){
  var HDR_MAP={
    salidas:{hdr:['Fecha','Hora','SKU','Nro. Pedido','Descripción','Pack','Unidad','Marca','Motorizado','Envases','Estado','Revisión','Tamaño'],
      cw:[{wch:12},{wch:8},{wch:14},{wch:14},{wch:36},{wch:8},{wch:8},{wch:14},{wch:16},{wch:10},{wch:12},{wch:12},{wch:10}],
      fn:function(r){return[r.fecha,r.hora,r.sku,r.nroPedido,r.desc,r.pack,r.unidad,r.marca||'',r.motorizado||'',r.envases||'',r.estado||'',r.revision||'',r.tamano||''];}},
    entradas:{hdr:['Fecha','Factura','SKU','Descripción','Unidades','F. Vencimiento','Proveedor','OC','Dynamics','Responsable'],
      cw:[{wch:12},{wch:16},{wch:14},{wch:36},{wch:10},{wch:14},{wch:20},{wch:14},{wch:12},{wch:16}],
      fn:function(r){return[r.fecha,r.factura,r.sku,r.desc,r.unidades,r.fVenc||'',r.proveedor,r.oc,r.dynamics,r.responsable];}},
    mt:{hdr:['Fecha','SKU','Descripción','Cantidad','Tipo','Motivo','Observaciones','Estado','Nro de factura','Fecha del retiro'],
      cw:[{wch:12},{wch:14},{wch:36},{wch:10},{wch:10},{wch:20},{wch:24},{wch:12},{wch:16},{wch:14}],
      fn:function(r){return[r.fecha,r.sku,r.desc,r.cant,r.tipo,r.motivo||'',r.obs||'',r.estado||'',r.nroFactura||'',r.fechaRetiro||''];}}
  };
  var cfg=HDR_MAP[modulo];if(!cfg){showToast('Módulo no soportado','err');return;}
  _exportConSpinner(btnId,modulo,function(sedes){
    _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:cfg.hdr,rows:s.data,colWidths:cfg.cw,mapFn:cfg.fn};}),modulo+'_sedes');
  });
}

function loadStock(){
  if(!S||!S.token){errBox('stock-root','Sin sesión activa. Recarga la página.');return;}
  var force=!!_FORCE_REFRESH['stock']; _FORCE_REFRESH['stock']=false;
  var t = (REQ_TOKEN.stock = (REQ_TOKEN.stock||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.stock) return; // response stale, descartar
      PAGE_LOADING['stock']=false; renderStock(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.stock) return;
      PAGE_LOADING['stock']=false; errBox('stock-root',e.message,'stock');
    })
    .getStock(S.token, force);
}

function renderStock(r){
  if(_handleExpired(r,'stock-root')) return;
  if(!r||!r.ok){errBox('stock-root',r?r.error:'Error desconocido');return;}
  DATA.stock=r.data;
  _STOCK_ESTADO_FILTRO=''; // resetear filtro de estado al recibir datos frescos
  var rows=r.data;
  var conStock=rows.filter(function(x){return x.stock>0;}).length;
  var sinStock=rows.filter(function(x){return x.stock===0;}).length;
  var negativos=rows.filter(function(x){return x.stock<0;}).length;
  var totalUnd=rows.reduce(function(a,x){return a+(x.stock>0?x.stock:0);},0);
  var costoTotal=rows.reduce(function(a,x){return a+(x.costo||0);},0);
  DATA._stockMax=rows.reduce(function(m,x){return Math.max(m,Math.abs(x.stock)||0);},0)||1;

  var cats=[...new Set(rows.map(function(x){return x.categoria;}).filter(Boolean))].sort();
  var marcas=[...new Set(rows.map(function(x){return x.marca;}).filter(Boolean))].sort();
  var catOpts=cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
  var marOpts=marcas.map(function(m){return '<option value="'+esc(m)+'">'+esc(m)+'</option>';}).join('');

  var tot=rows.length||1;
  var pc=function(n){return (n/tot*100).toFixed(2);};
  var costoK=costoTotal>=1000?(costoTotal/1000).toFixed(1)+'K':fmt(Math.round(costoTotal));
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var seg=function(id,val,txt,n){return '<button class="stk-sb'+(val===''?' active':'')+'" id="'+id+'" onclick="setStockFiltroEstado(\''+val+'\')">'+txt+'<span>'+n+'</span></button>';};
  var leg=function(val,color,n,txt){return '<span onclick="setStockFiltroEstado(\''+val+'\')"><em style="background:'+color+'"></em><b>'+n+'</b> '+txt+'</span>';};

  document.getElementById('stock-root').innerHTML=
    '<div class="stk-sum">'+
      '<div class="stk-card"><div class="stk-k">Salud del inventario</div>'+
        '<div class="stk-v">'+fmt(rows.length)+'<small>SKUs</small></div>'+
        '<div class="stk-dist"><i style="width:'+pc(conStock)+'%;background:var(--ok)"></i><i style="width:'+pc(sinStock)+'%;background:var(--text4)"></i><i style="width:'+pc(negativos)+'%;background:var(--danger)"></i></div>'+
        '<div class="stk-leg">'+leg('con','var(--ok)',conStock,'Con stock')+leg('sin','var(--text4)',sinStock,'Sin stock')+leg('neg','var(--danger)',negativos,'Negativos')+'</div></div>'+
      '<div class="stk-card"><div class="stk-k">Unidades en stock</div><div class="stk-v">'+fmt(totalUnd)+'<small>und.</small></div><div class="stk-n">Solo stock positivo</div></div>'+
      '<div class="stk-card"><div class="stk-k">Costo total</div><div class="stk-v">S/ '+costoK+'</div><div class="stk-n">S/ '+fmt(Math.round(costoTotal*10)/10)+' en inventario</div></div>'+
    '</div>'+
    '<div class="stk-fl">'+
      '<div class="stk-srch">'+icoBuscar+'<input id="stock-busq" placeholder="Buscar SKU o producto…" oninput="filterStock()"/></div>'+
      '<select class="stk-sel" id="stock-cat" onchange="filterStock()"><option value="">Todas las categorías</option>'+catOpts+'</select>'+
      '<select class="stk-sel" id="stock-mar" onchange="filterStock()"><option value="">Todas las marcas</option>'+marOpts+'</select>'+
      '<div class="stk-seg">'+seg('sbtn-todos','','Todos',rows.length)+seg('sbtn-con','con','Con stock',conStock)+seg('sbtn-sin','sin','Sin stock',sinStock)+seg('sbtn-neg','neg','Negativos',negativos)+'</div>'+
      '<span class="stk-cnt" id="stock-count"></span>'+
    '</div>'+
    '<div class="stk-tw"><table class="stk-t">'+
      '<thead><tr><th>Producto</th><th class="r">Movimientos</th><th class="r">Stock</th><th class="r">Pack</th><th class="r">Costo</th><th>Estado</th><th></th></tr></thead>'+
      '<tbody id="stock-tbody"></tbody>'+
    '</table></div>'+
    '<div class="stk-cards" id="stock-cards"></div>';

  if(!document.getElementById('stk-dr')){
    var dr=document.createElement('div'); dr.id='stk-dr';
    dr.innerHTML='<button class="x" onclick="stkCerrar()" aria-label="Cerrar">×</button><div id="stk-drc"></div>';
    document.body.appendChild(dr);
  }
  stkCerrar();
  filterStock();
}

function setStockFiltroEstado(val){
  _STOCK_ESTADO_FILTRO = val;
  ['todos','con','sin','neg'].forEach(function(k){
    var btn = document.getElementById('sbtn-'+k);
    if(btn) btn.classList.toggle('active', (val==='' ? k==='todos' : k===val));
  });
  filterStock();
}

function _filterStock(){
  var q=(document.getElementById('stock-busq')||{}).value||'';
  var cat=(document.getElementById('stock-cat')||{}).value||'';
  var mar=(document.getElementById('stock-mar')||{}).value||'';
  q=q.toLowerCase();
  var filtered=DATA.stock.filter(function(r){
    if(!(!q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1)) return false;
    if(!(!cat||r.categoria===cat)) return false;
    if(!(!mar||r.marca===mar)) return false;
    if(_STOCK_ESTADO_FILTRO==='con') return r.stock>0;
    if(_STOCK_ESTADO_FILTRO==='sin') return r.stock===0;
    if(_STOCK_ESTADO_FILTRO==='neg') return r.stock<0;
    return true;
  });
  var el=document.getElementById('stock-count');
  if(el)el.textContent=filtered.length+' productos';
  _STK.lista=filtered; _STK.n=0; _STK.tabla=!_STK.mq.matches;
  var t=document.getElementById('stock-tbody'), c=document.getElementById('stock-cards');
  if(t) t.innerHTML='';
  if(c) c.innerHTML='';
  if(!filtered.length){
    if(t&&_STK.tabla) t.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">Sin resultados</td></tr>';
    if(c&&!_STK.tabla) c.innerHTML='<div style="text-align:center;color:var(--text3);padding:40px">Sin resultados</div>';
    _stkVigilar(null);
    return;
  }
  _stkMas();
}

/* Rendimiento: solo se dibuja la vista que se ve (tabla o tarjetas) y de a 60 productos; al bajar se agregan más. */
var _STK={ lista:[], n:0, tabla:true, mq:window.matchMedia('(max-width:820px)'), obs:null, lote:60 };
_STK.mq.addEventListener('change',function(){ if(DATA.stock&&document.getElementById('stock-tbody')) _filterStock(); });
var _STK_LAB={ok:'Con stock',no:'Sin stock',ng:'Negativo'}, _STK_COL={ok:'var(--ok)',no:'var(--text4)',ng:'var(--danger)'};

function _stkFila(r,mx){
  var e=r.stock>0?'ok':(r.stock<0?'ng':'no');
  return '<tr onclick="stkAbrir('+r._row+')">'+
    '<td><div class="stk-pn">'+esc(r.desc)+'</div><div class="stk-ps"><span class="sk">'+esc(r.sku)+'</span>'+
      (r.marca?'<i class="dot"></i><span>'+esc(r.marca)+'</span>':'')+(r.categoria?'<i class="dot"></i><span>'+esc(r.categoria)+'</span>':'')+'</div></td>'+
    '<td class="r"><div class="stk-mv"><span class="e" title="Entradas">+'+fmt(r.entradas)+'</span><span class="s" title="Salidas">−'+fmt(r.salidas)+'</span>'+(r.mt?'<span class="m" title="Mermas y traslados">M-T '+fmt(r.mt)+'</span>':'')+'</div></td>'+
    '<td class="r"><div class="stk-stk"><div class="stk-bar"><i style="width:'+Math.min(100,Math.abs(r.stock)/mx*100)+'%;background:'+_STK_COL[e]+'"></i></div><b'+(e==='ng'?' style="color:var(--danger)"':'')+'>'+fmt(r.stock)+'</b></div></td>'+
    '<td class="r">'+Math.round(r.stockPack)+'</td>'+
    '<td class="r">'+(r.costo?'S/ '+fmt(r.costo):'—')+'</td>'+
    '<td><span class="stk-pill '+e+'">'+_STK_LAB[e]+'</span></td>'+
    '<td class="r"><button class="stk-ed" onclick="event.stopPropagation();abrirSKUForm('+r._row+')">Editar</button></td>'+
  '</tr>';
}
function _stkCard(r){
  var e=r.stock>0?'ok':(r.stock<0?'ng':'no');
  return '<div class="stk-cd" onclick="stkAbrir('+r._row+')"><div style="min-width:0"><div class="stk-pn">'+esc(r.desc)+'</div>'+
    '<div class="stk-ps"><span class="sk">'+esc(r.sku)+'</span>'+(r.marca?'<i class="dot"></i><span>'+esc(r.marca)+'</span>':'')+'</div>'+
    '<div style="margin-top:8px"><span class="stk-pill '+e+'">'+_STK_LAB[e]+'</span></div></div>'+
    '<div class="stk-rt"><b'+(e==='ng'?' style="color:var(--danger)"':'')+'>'+fmt(r.stock)+'</b><span>und.</span></div></div>';
}
// Dibuja el siguiente lote y deja una marca al final: cuando se acerca a la pantalla, se dibuja el que sigue.
function _stkMas(){
  var t=document.getElementById('stock-tbody'), c=document.getElementById('stock-cards');
  var host=_STK.tabla?t:c; if(!host) return;
  var marca=document.getElementById('stk-mas'); if(marca) marca.remove();
  var mx=DATA._stockMax||1, desde=_STK.n, hasta=Math.min(desde+_STK.lote,_STK.lista.length), h='', i;
  for(i=desde;i<hasta;i++) h+=_STK.tabla?_stkFila(_STK.lista[i],mx):_stkCard(_STK.lista[i]);
  _STK.n=hasta;
  if(hasta<_STK.lista.length){
    h+=_STK.tabla
      ? '<tr id="stk-mas"><td colspan="7" style="text-align:center;color:var(--text3);padding:14px;font-size:12px">Mostrando '+hasta+' de '+_STK.lista.length+'…</td></tr>'
      : '<div id="stk-mas" style="text-align:center;color:var(--text3);padding:14px;font-size:12px">Mostrando '+hasta+' de '+_STK.lista.length+'…</div>';
  }
  host.insertAdjacentHTML('beforeend',h);
  _stkVigilar(document.getElementById('stk-mas'));
}
function _stkVigilar(marca){
  if(_STK.obs){ _STK.obs.disconnect(); _STK.obs=null; }
  if(!marca) return;
  if(!('IntersectionObserver' in window)){ while(_STK.n<_STK.lista.length) _stkMas(); return; }
  _STK.obs=new IntersectionObserver(function(es){ if(es[0].isIntersecting) _stkMas(); },{rootMargin:'600px 0px'});
  _STK.obs.observe(marca);
}

// Panel lateral con el detalle de un producto
function stkAbrir(row){
  var r=(DATA.stock||[]).filter(function(x){return x._row===row;})[0]; if(!r) return;
  var e=r.stock>0?'ok':(r.stock<0?'ng':'no');
  var c=document.getElementById('stk-drc'); if(!c) return;
  c.innerHTML=
    '<div class="stk-ps" style="margin:0 0 6px"><span class="sk">'+esc(r.sku)+'</span></div>'+
    '<h3>'+esc(r.desc)+'</h3>'+
    '<div class="stk-ps">'+(r.marca?'<span>'+esc(r.marca)+'</span>':'')+(r.marca&&r.categoria?'<i class="dot"></i>':'')+(r.categoria?'<span>'+esc(r.categoria)+'</span>':'')+'</div>'+
    '<div class="stk-g2"><div><span class="stk-k">Stock</span><b'+(e==='ng'?' style="color:var(--danger)"':'')+'>'+fmt(r.stock)+'</b></div><div><span class="stk-k">Pack</span><b>'+Math.round(r.stockPack)+'</b></div></div>'+
    '<div class="stk-rowm"><span>Entradas</span><b style="color:var(--ok)">+'+fmt(r.entradas)+'</b></div>'+
    '<div class="stk-rowm"><span>Salidas</span><b>−'+fmt(r.salidas)+'</b></div>'+
    '<div class="stk-rowm"><span>Mermas y traslados</span><b>'+fmt(r.mt)+'</b></div>'+
    '<div class="stk-rowm"><span>Costo en inventario</span><b>'+(r.costo?'S/ '+fmt(r.costo):'—')+'</b></div>'+
    (e==='ng'?'<div class="stk-warn">Salieron más unidades de las que entraron. Revisa las entradas o haz un conteo.</div>':'')+
    '<div style="margin-top:18px"><button class="btn btn-primary" style="width:100%" onclick="stkCerrar();abrirSKUForm('+r._row+')">Editar SKU</button></div>';
  document.getElementById('stk-dr').classList.add('on');
}
function stkCerrar(){ var d=document.getElementById('stk-dr'); if(d) d.classList.remove('on'); }

function exportStock(){
  var rows=_getFilteredRows('stock');
  if(!rows.length){showToast('No hay datos para exportar','err');return;}
  if(!S||S.rol==='store'){
    var data=rows.map(function(r){return{'SKU / Lovis':r.sku,'Descripción':r.desc,'Marca':r.marca,'Categoría':r.categoria,'Entradas':r.entradas,'Salidas':r.salidas,'M-T':r.mt,'Stock actual':r.stock,'Stock Pack':Math.round(r.stockPack),'Costo':r.costo||0};});
    var ws=XLSX.utils.json_to_sheet(data);ws['!cols']=[{wch:14},{wch:40},{wch:16},{wch:18},{wch:10},{wch:10},{wch:8},{wch:13},{wch:12},{wch:12}];
    var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Stock');XLSX.writeFile(wb,'stock_'+_hoyISO()+'.xlsx');showToast('Exportado correctamente','ok');return;
  }
  // admin/invitado: pivot SKU x sedes (mismo que dashExportStock)
  dashExportStock();
}

var SKU_EDIT_ROW=null;
var SKU_SHEET_ID=null; // para admin: sheetId de la tienda del SKU
var SKU_CACHE=[];      // productos conocidos al abrir el formulario: avisa códigos repetidos y sugiere marcas/categorías

function _skuMostrar(modo){ // 'form' | 'ok'
  var f=modo==='form';
  document.getElementById('sku-form').style.display=f?'':'none';
  document.getElementById('sku-prev').style.display=f?'':'none';
  document.getElementById('sku-foot').style.display=f?'':'none';
  document.getElementById('sku-ok').style.display=f?'none':'';
}
function _skuTextos(esEdicion){
  document.getElementById('fs-sku-title').textContent=esEdicion?'Editar SKU':'Nuevo SKU';
  document.getElementById('sku-h1').textContent=esEdicion?'Editar SKU':'Nuevo SKU';
  document.getElementById('sku-nota-edit').style.display=esEdicion?'flex':'none';
  document.getElementById('sku-pnote').textContent=esEdicion?'El stock y los movimientos de este producto no cambian.':'El producto se crea con stock en cero. Para ingresar unidades registra una Entrada o haz un Conteo.';
  document.getElementById('btn-sku-save').textContent=esEdicion?'Guardar cambios':'Guardar SKU';
  document.getElementById('btn-sku-otro').style.display=esEdicion?'none':'';
}

function abrirSKUForm(rowNum){
  SKU_EDIT_ROW=rowNum;
  SKU_SHEET_ID=null;
  var esEdicion=rowNum!==null;
  SKU_CACHE=(DATA.stock||[]).map(function(r){return {sku:String(r.sku||''),desc:r.desc||'',marca:r.marca||'',categoria:r.categoria||'',_row:r._row,sede:r.sede||''};});
  document.getElementById('sku-err').textContent='';
  _skuMostrar('form');
  _skuTextos(esEdicion);

  // Selector de sede para admin en modo nuevo
  var sedeWrap=document.getElementById('sku-sede-wrap');
  if(sedeWrap){
    if(S.rol==='admin' && !esEdicion){
      var tiendas=[...new Set((DATA.stock||[]).map(function(r){return r.sede;}).filter(Boolean))].sort();
      var opts=tiendas.map(function(t){return '<option value="'+esc(t)+'">'+esc(t)+'</option>';}).join('');
      document.getElementById('sku-sede').innerHTML='<option value="">Selecciona tienda...</option>'+opts;
      sedeWrap.style.display='';
    } else {
      sedeWrap.style.display='none';
    }
  }

  if(esEdicion){
    var row=(DATA.stock||[]).find(function(r){return r._row===rowNum;});
    if(!row)return;
    SKU_SHEET_ID=row.sheetId||null;
    document.getElementById('sku-lovis').value=row.sku;
    document.getElementById('sku-desc').value=row.desc;
    document.getElementById('sku-marca').value=row.marca;
    document.getElementById('sku-categoria').value=row.categoria;
  } else {
    document.getElementById('sku-lovis').value='';
    document.getElementById('sku-desc').value='';
    document.getElementById('sku-marca').value='';
    document.getElementById('sku-categoria').value='';
  }
  skuEv();
  openFS('fs-sku');
  setTimeout(function(){document.getElementById('sku-lovis').focus();},120);
}

// Atajos en PC: Esc cierra y Ctrl+Enter guarda
document.addEventListener('keydown',function(e){
  var fs=document.getElementById('fs-sku');
  if(!fs||!fs.classList.contains('open')) return;
  if(e.key==='Escape'){ closeFS('fs-sku'); return; }
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){
    var b=document.getElementById('btn-sku-save');
    if(b&&!b.disabled&&document.getElementById('sku-foot').style.display!=='none'){ e.preventDefault(); b.click(); }
  }
});

// Sugerencias de marca/categoría a partir de lo ya cargado
function _skuChips(elId,campo,inpId){
  var v=(document.getElementById(inpId).value||'').trim().toLowerCase(), vistos={}, lista=[];
  SKU_CACHE.forEach(function(r){ var x=r[campo]; if(x&&!vistos[x]){vistos[x]=true;lista.push(x);} });
  lista.sort();
  var sug=lista.filter(function(x){return !v||x.toLowerCase().indexOf(v)>-1;}).slice(0,6);
  document.getElementById(elId).innerHTML=sug.map(function(x){
    return '<button type="button" class="'+(x.toLowerCase()===v?'on':'')+'" data-i="'+inpId+'" data-v="'+esc(x)+'" onclick="skuElegir(this)">'+esc(x)+'</button>';
  }).join('');
}
function skuElegir(b){ document.getElementById(b.dataset.i).value=b.dataset.v; skuEv(); }

// Valida en vivo: código repetido, formato, vista previa y estado de los botones
function skuEv(){
  var sku=(document.getElementById('sku-lovis').value||'').trim();
  var d=(document.getElementById('sku-desc').value||'').trim();
  var ma=(document.getElementById('sku-marca').value||'').trim();
  var ca=(document.getElementById('sku-categoria').value||'').trim();
  var esEd=SKU_EDIT_ROW!==null;
  document.getElementById('sku-dcount').textContent=document.getElementById('sku-desc').value.length+' / 120';

  var sedeSel=(document.getElementById('sku-sede')||{}).value||'';
  if(esEd){ var fe=(DATA.stock||[]).filter(function(r){return r._row===SKU_EDIT_ROW;})[0]; sedeSel=fe?fe.sede:''; }  // al editar, solo cuenta la sede del producto (el mismo código puede existir en otra sede)
  var ex=null;
  if(sku){
    ex=SKU_CACHE.filter(function(r){
      return r.sku.toLowerCase()===sku.toLowerCase() && r._row!==SKU_EDIT_ROW && (!sedeSel||!r.sede||r.sede===sedeSel);
    })[0]||null;
  }
  var formatoMal=sku&&!/^[A-Za-z0-9\-_.]+$/.test(sku);
  var inp=document.getElementById('sku-lovis');
  inp.className='sku-in mono'+((ex||formatoMal)?' bad':(sku?' good':''));
  var h=document.getElementById('sku-lovis-h');
  if(ex){
    h.innerHTML='<div class="sku-dup"><b>Este SKU ya existe en tu Stock</b><br>'+esc(ex.desc)+(ex.marca?' · '+esc(ex.marca):'')+
      (ex._row>0?'<br><button type="button" onclick="abrirSKUForm('+ex._row+')">Editar ese producto</button>':'')+'</div>';
  } else if(formatoMal){
    h.innerHTML='<div class="sku-hint err">Usa solo letras, números, guiones o puntos.</div>';
  } else if(sku&&!esEd){
    h.innerHTML='<div class="sku-hint ok">'+ICO('check',13)+'Código disponible</div>';
  } else { h.innerHTML=''; }

  _skuChips('sku-chips-m','marca','sku-marca');
  _skuChips('sku-chips-c','categoria','sku-categoria');

  // Vista previa: la fila tal como se verá en Stock (al editar, con los números reales del producto)
  var pn=document.getElementById('sku-pvn'); pn.textContent=d||'Descripción del producto'; pn.className='sku-pn'+(d?'':' empty');
  document.getElementById('sku-pvs').textContent=sku||'SKU';
  document.getElementById('sku-pvm').textContent=ma||'Sin marca';
  document.getElementById('sku-pvc').textContent=ca||'Sin categoría';
  var fila=esEd?(DATA.stock||[]).filter(function(r){return r._row===SKU_EDIT_ROW;})[0]:null;
  var st=fila?fila.stock:0, e=st>0?'ok':(st<0?'ng':'no');
  document.getElementById('sku-pvmov').innerHTML=fila?('<span style="color:var(--ok)">+'+fmt(fila.entradas)+'</span> &nbsp;−'+fmt(fila.salidas)):'+0 &nbsp;−0';
  var stk=document.getElementById('sku-pvstk'); stk.textContent=fmt(st); stk.style.color=e==='ng'?'var(--danger)':'';
  document.getElementById('sku-pvpack').textContent=fila?Math.round(fila.stockPack):'0';
  document.getElementById('sku-pvcost').textContent=(fila&&fila.costo)?'S/ '+fmt(fila.costo):'—';
  var pe=document.getElementById('sku-pvest'); pe.textContent=e==='ok'?'Con stock':(e==='ng'?'Negativo':'Sin stock'); pe.className='sku-pill '+e;

  var sinSede=S.rol==='admin'&&!esEd&&!sedeSel;
  var malo=!sku||!d||!!ex||formatoMal||sinSede;
  document.getElementById('btn-sku-save').disabled=malo;
  document.getElementById('btn-sku-otro').disabled=malo;
  var msg=document.getElementById('sku-msg');
  msg.textContent=ex?'Ese código ya existe: edítalo en lugar de crearlo':(sinSede?'Selecciona la tienda destino':(malo?'Completa el código y la descripción para guardar':'Todo listo para guardar'));
  msg.style.color=ex?'var(--warn)':(malo?'var(--text3)':'var(--ok)');
  var stt=document.getElementById('sku-stat');
  stt.className='sku-stat '+(ex?'no':(malo?'':'ok'));
  document.getElementById('sku-stat-t').textContent=ex?'Código repetido':(malo?'Faltan datos':'Listo para guardar');
}

function skuOtro(){
  SKU_EDIT_ROW=null; SKU_SHEET_ID=null;
  _skuMostrar('form');
  _skuTextos(false);
  ['sku-lovis','sku-desc','sku-marca','sku-categoria'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('sku-err').textContent='';
  skuEv();
  setTimeout(function(){document.getElementById('sku-lovis').focus();},60);
}

// otro=true: guarda y deja el formulario vacío para cargar el siguiente
function guardarSKU(otro){
  var lovis=(document.getElementById('sku-lovis').value||'').trim();
  var desc =(document.getElementById('sku-desc').value ||'').trim();
  var err  = document.getElementById('sku-err');
  if(!lovis){err.textContent='El código Lovis es obligatorio';return;}
  if(!desc) {err.textContent='La descripción es obligatoria';return;}

  // Admin creando nuevo: necesita seleccionar tienda
  var sheetId=SKU_SHEET_ID;
  if(S.rol==='admin' && SKU_EDIT_ROW===null){
    var sedeEl=document.getElementById('sku-sede');
    var sedeName=sedeEl?sedeEl.value:'';
    if(!sedeName){err.textContent='Selecciona la tienda destino';return;}
    var match=DATA.stock.find(function(r){return r.sede===sedeName;});
    sheetId=match?match.sheetId:null;
    if(!sheetId){err.textContent='No se encontró el ID de la tienda';return;}
  }

  var fila={
    sku:       lovis,
    desc:      desc,
    marca:     (document.getElementById('sku-marca').value||'').trim(),
    categoria: (document.getElementById('sku-categoria').value||'').trim(),
    sheetId:   sheetId
  };
  err.textContent='';
  var btn=document.getElementById('btn-sku-save'), btn2=document.getElementById('btn-sku-otro');
  var esEd=SKU_EDIT_ROW!==null;
  var etiqueta=esEd?'Guardar cambios':'Guardar SKU';
  var libera=function(){ btn.textContent=etiqueta; btn.disabled=false; btn2.disabled=false; };
  btn.disabled=true; btn2.disabled=true; btn.textContent='Guardando...';
  if(esEd){
    google.script.run
      .withSuccessHandler(function(r){
        libera();
        if(!r.ok){err.textContent=r.error;return;}
        showToast('SKU actualizado correctamente','ok');
        closeFS('fs-sku');
        reloadPage('stock');
      })
      .withFailureHandler(function(e){libera();err.textContent=e.message;})
      .editarSKU(S.token,SKU_EDIT_ROW,fila);
  } else {
    google.script.run
      .withSuccessHandler(function(r){
        libera();
        if(!r.ok){err.textContent=r.error;return;}
        // El código recién creado cuenta como repetido si se vuelve a escribir sin cerrar el formulario
        SKU_CACHE.push({sku:lovis,desc:desc,marca:fila.marca,categoria:fila.categoria,_row:-1,sede:(document.getElementById('sku-sede')||{}).value||''});
        reloadPage('stock');
        if(otro){
          showToast('SKU '+lovis+' creado','ok');
          ['sku-lovis','sku-desc','sku-marca','sku-categoria'].forEach(function(id){document.getElementById(id).value='';});
          skuEv();
          document.getElementById('sku-lovis').focus();
        } else {
          _skuMostrar('ok');
        }
      })
      .withFailureHandler(function(e){libera();err.textContent=e.message;})
      .registrarSKU(S.token,fila);
  }
}
