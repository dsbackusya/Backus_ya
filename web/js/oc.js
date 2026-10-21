/* Órdenes de compra — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   ÓRDENES DE COMPRA — hoja externa compartida
══════════════════════════════════════ */
var OC_ROWS_PARSED = []; // filas del Excel ya parseadas, pendientes de importar

function _ocBadge(estado){
  var e=(estado||'Pendiente').trim();
  var cls=e==='Recibido'?'badge-ok':'badge-warn';
  return '<span class="badge '+cls+'">'+esc(e)+'</span>';
}

function _dashSedeDeOC(r){
  var s=((DASH.d&&DASH.d.sedes)||[]).filter(function(x){return x.id===r.sedeId;})[0];
  return s?s.nombre:'';
}
function filterOC(){
  var q=((document.getElementById('oc-busq')||{}).value||'').toLowerCase();
  var estadoF=((document.getElementById('oc-estado-filtro')||{}).value||'');
  var rows=(DATA.oc||[]).filter(function(r){
    var okQ=!q||
      (r.oc||'').toLowerCase().indexOf(q)>-1||
      (r.proveedor||'').toLowerCase().indexOf(q)>-1||
      (r.entrega||'').toLowerCase().indexOf(q)>-1;
    var okE=!estadoF||(r.estado||'Pendiente')===estadoF;
    var okS=!DASH.sede||_dashSedeDeOC(r)===DASH.sede;
    return okQ&&okE&&okS;
  });
  rows.sort(function(a,b){return (b._row||0)-(a._row||0);});
  var el=document.getElementById('oc-count');
  if(el)el.textContent=rows.length+' registros';
  var tbody=rows.map(function(r){
    return '<tr class="oc-row" data-oc="'+esc(r.oc)+'" style="cursor:pointer">'+
      '<td class="mono" style="font-size:12px">'+esc(r.fechaRecepcion||'—')+'</td>'+
      '<td class="mono">'+esc(r.oc)+'</td>'+
      '<td class="td-desc" title="'+esc(r.proveedor)+'">'+esc(r.proveedor)+'</td>'+
      '<td class="td-desc" title="'+esc(r.entrega)+'">'+esc(r.entrega||'—')+'</td>'+
      '<td class="c">'+_ocBadge(r.estado)+'</td>'+
    '</tr>';
  }).join('');
  var t=document.getElementById('oc-tbody');
  if(t){
    t.innerHTML=tbody||'<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:40px">Sin órdenes de compra registradas</td></tr>';
    t.querySelectorAll('.oc-row').forEach(function(tr){
      tr.addEventListener('click', function(){ abrirDetalleEntradaOCGlobal(tr.dataset.oc); });
    });
  }
}

function _isoToDDMMYYYY(iso){
  if(!iso) return '';
  var p=iso.split('-');
  if(p.length!==3) return '';
  return p[2]+'/'+p[1]+'/'+p[0];
}

function loadRecepcionesPorTienda(fechaISO){
  var grid=document.getElementById('oc-recep-grid');
  if(grid) grid.innerHTML=LD('Cargando');
  google.script.run
    .withSuccessHandler(function(r){DASH.rec=r;renderRecepcionesPorTienda(r);})
    .withFailureHandler(function(e){
      var g=document.getElementById('oc-recep-grid');
      if(g) g.innerHTML='<div style="color:var(--danger);font-size:12px;padding:8px 0">'+esc(e.message)+'</div>';
    })
    .getRecepcionesPorTienda(S.token, _isoToDDMMYYYY(fechaISO));
}

function renderRecepcionesPorTienda(r){
  var grid=document.getElementById('oc-recep-grid');
  if(!grid) return;
  if(!r||!r.ok){grid.innerHTML='<div style="color:var(--danger);font-size:12px;padding:8px 0">'+esc((r&&r.error)||'Error al cargar recepciones')+'</div>';return;}

  // Sincroniza el input de fecha con la fecha realmente consultada (por defecto: hoy en Lima)
  var inp=document.getElementById('oc-recep-fecha');
  if(inp && r.fecha){
    var p=r.fecha.split('/'); // dd/mm/yyyy
    if(p.length===3) inp.value=p[2]+'-'+p[1]+'-'+p[0];
  }

  var tiendas=(r.data||[]).filter(function(st){return !DASH.sede||st.nombre===DASH.sede;});
  if(!tiendas.length){
    grid.innerHTML='<div class="stat-card"><div class="stat-label">Sin tiendas registradas</div></div>';
    return;
  }
  grid.innerHTML=tiendas.map(function(st){
    var ocsHtml = (st.ocs&&st.ocs.length)
      ? '<div class="oc-chip-list" data-tienda="'+esc(st.nombre)+'" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">'+
          st.ocs.map(function(oc){
            return '<span class="badge badge-accent oc-chip" data-oc="'+esc(oc)+'" style="cursor:pointer">'+esc(oc)+'</span>';
          }).join('')+
        '</div>'
      : '<div style="margin-top:12px;font-size:11px;color:var(--text4)">Sin OC recibidas</div>';
    return '<div class="stat-card"><div class="stat-label">'+esc(st.nombre)+'</div>'+
      '<div class="stat-val-row"><div class="stat-val">'+st.recepciones+'</div><span class="stat-unit-pill">OC recibidas</span></div>'+
      ocsHtml+
    '</div>';
  }).join('');
  grid.querySelectorAll('.oc-chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      var tienda=chip.closest('.oc-chip-list').dataset.tienda;
      abrirDetalleEntradaOC(tienda, chip.dataset.oc);
    });
  });
}

function abrirDetalleEntradaOC(tienda, oc){
  document.getElementById('detalle-oc-title').textContent='OC '+oc;
  document.getElementById('detalle-oc-subtitle').textContent=tienda+' · cargando...';
  document.getElementById('detalle-oc-body').innerHTML=LD('Cargando detalle');
  document.getElementById('btn-detalle-oc-export').style.display='none';
  document.getElementById('modal-detalle-oc').style.display='flex';
  google.script.run
    .withSuccessHandler(function(r){renderDetalleOC(r);})
    .withFailureHandler(function(e){
      document.getElementById('detalle-oc-body').innerHTML='<div style="padding:24px;color:var(--danger);font-size:12px">'+esc(e.message)+'</div>';
    })
    .getDetalleEntradaOC(S.token, tienda, oc);
}

// Igual que abrirDetalleEntradaOC pero sin saber de antemano la tienda —
// busca en todas (usado al hacer click en una fila de la tabla principal de OC).
function abrirDetalleEntradaOCGlobal(oc){
  document.getElementById('detalle-oc-title').textContent='OC '+oc;
  document.getElementById('detalle-oc-subtitle').textContent='Buscando en todas las tiendas...';
  document.getElementById('detalle-oc-body').innerHTML=LD('Cargando detalle');
  document.getElementById('btn-detalle-oc-export').style.display='none';
  document.getElementById('modal-detalle-oc').style.display='flex';
  google.script.run
    .withSuccessHandler(function(r){renderDetalleOC(r);})
    .withFailureHandler(function(e){
      document.getElementById('detalle-oc-body').innerHTML='<div style="padding:24px;color:var(--danger);font-size:12px">'+esc(e.message)+'</div>';
    })
    .getDetalleEntradaOCGlobal(S.token, oc);
}

var DETALLE_OC_DATA=[];    // último detalle cargado en el modal — usado para exportar
var DETALLE_OC_CURRENT=''; // OC actualmente mostrada — usada para el nombre del archivo exportado

function renderDetalleOC(r){
  var body=document.getElementById('detalle-oc-body');
  var btnExp=document.getElementById('btn-detalle-oc-export');
  DETALLE_OC_DATA=[];
  DETALLE_OC_CURRENT=(r&&r.oc)||'';
  if(!r||!r.ok){
    body.innerHTML='<div style="padding:24px;color:var(--danger);font-size:12px">'+esc((r&&r.error)||'Error al cargar detalle')+'</div>';
    btnExp.style.display='none';
    return;
  }
  if(!r.data||!r.data.length){
    body.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px">Sin ítems registrados en ENTRADAS para esta OC</div>';
    document.getElementById('detalle-oc-subtitle').textContent='Sin ítems registrados';
    btnExp.style.display='none';
    return;
  }
  DETALLE_OC_DATA=r.data;
  var totalUnd=r.data.reduce(function(a,x){return a+(Number(x.unidades)||0);},0);
  var tiendas=r.data.reduce(function(acc,x){ if(x.tienda&&acc.indexOf(x.tienda)===-1)acc.push(x.tienda); return acc; },[]);
  var tiendaTxt=tiendas.length===1?tiendas[0]:(tiendas.length+' tienda'+(tiendas.length===1?'':'s'));
  document.getElementById('detalle-oc-subtitle').textContent=tiendaTxt+' · '+r.data.length+' ítem(s) · '+fmt(totalUnd)+' und.';
  var rows=r.data.map(function(it){
    return '<tr>'+
      '<td class="td-desc" style="font-size:11px;color:var(--text3)">'+esc(it.tienda||'—')+'</td>'+
      '<td class="mono">'+esc(it.sku)+'</td>'+
      '<td class="td-desc" title="'+esc(it.desc)+'">'+esc(it.desc)+'</td>'+
      '<td class="r" style="font-weight:600">'+fmt(it.unidades)+'</td>'+
      '<td class="mono" style="font-size:11px;color:var(--text3)">'+esc(it.fecha||'—')+'</td>'+
      '<td class="mono" style="font-size:11px;color:var(--text3)">'+esc(it.factura||'—')+'</td>'+
    '</tr>';
  }).join('');
  body.innerHTML='<div class="table-wrap"><table><thead><tr><th>Tienda</th><th>SKU</th><th>Descripción</th><th class="r">Und.</th><th>Fecha</th><th>Factura</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  btnExp.style.display='';
}

function exportarDetalleOC(){
  if(!DETALLE_OC_DATA.length){showToast('Sin datos para exportar','err');return;}
  _exportXLSX(
    ['Tienda','SKU','Descripción','Unidades','Fecha','Factura'],
    DETALLE_OC_DATA,
    function(it){return[it.tienda||'',it.sku,it.desc,it.unidades,it.fecha||'',it.factura||''];},
    'Detalle OC',
    'detalle_'+(DETALLE_OC_CURRENT||'oc').replace(/[^a-zA-Z0-9\-]/g,'_')
  );
}

function cerrarDetalleOC(){
  document.getElementById('modal-detalle-oc').style.display='none';
}

function exportOC(){
  var rows=DATA.oc||[];
  if(!rows.length){showToast('Sin datos para exportar','err');return;}
  _exportXLSX(
    ['Fecha de recepción solicitada','Orden de compra','Nombre del proveedor','Nombre de entrega','Estado de recepcion'],
    rows,
    function(r){return[r.fechaRecepcion||'',r.oc,r.proveedor,r.entrega||'',r.estado||'Pendiente'];},
    'OC',
    'ordenes_compra'
  );
}

/* ── Importar OC desde Excel ── */
function abrirImportarOC(){
  clearOCFile();
  document.getElementById('oc-import-err').textContent='';
  openFS('fs-oc-import');
}

function handleOCDrop(event){
  event.preventDefault();
  document.getElementById('oc-drop-zone').style.borderColor='var(--border2)';
  var file=event.dataTransfer.files[0];
  if(file)handleOCFileSelect(file);
}

function _ocFechaToStr(v){
  if(v instanceof Date && !isNaN(v)){
    var d=('0'+v.getDate()).slice(-2), m=('0'+(v.getMonth()+1)).slice(-2), y=v.getFullYear();
    return d+'/'+m+'/'+y;
  }
  if(typeof v==='number' && v>20000 && v<80000){
    var epoch=new Date(Math.round((v-25569)*86400*1000));
    var d2=('0'+epoch.getUTCDate()).slice(-2), m2=('0'+(epoch.getUTCMonth()+1)).slice(-2), y2=epoch.getUTCFullYear();
    return d2+'/'+m2+'/'+y2;
  }
  return String(v||'').trim();
}

// Mapa: campo interno: posibles encabezados normalizados (sin tildes, minúsculas) que puede traer el Excel.
// Permite aceptar formatos con columnas en distinto orden, de menos columnas, o con nombres levemente distintos.
var OC_FIELD_HEADERS = {
  oc:                  ['orden de compra'],
  cuentaProveedor:     ['cuenta de proveedor'],
  cuentaFacturacion:   ['cuenta de facturacion'],
  proveedor:           ['nombre del proveedor'],
  tipoCompra:          ['tipo de compra'],
  estadoAprobacion:    ['estado de aprobacion'],
  estadoOrden:         ['estado de orden de compra'],
  divisa:              ['divisa'],
  fechaRecepcion:      ['fecha de recepcion solicitada'],
  modoEntrega:         ['modo de entrega'],
  condicionesEntrega:  ['condiciones de entrega'],
  acuerdoCompra:       ['acuerdo de compra'],
  entregaDirecta:      ['entrega directa'],
  subcontratoProyecto: ['numero del subcontrato del proyecto'],
  nombreEntrega:       ['nombre de entrega'],
  almacen:             ['almacen']
};

function _normHeader(s){
  return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function handleOCFileSelect(file){
  if(!file)return;
  var err=document.getElementById('oc-import-err');
  err.textContent='';
  if(!file.name.match(/\.xlsx?$/i)){err.textContent='Solo se aceptan archivos .xlsx o .xls';return;}

  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=new Uint8Array(e.target.result);
      var wb=XLSX.read(data,{type:'array',cellDates:true});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(!rows.length){err.textContent='El archivo está vacío';return;}

      // Ubicar cada campo por nombre de columna, sin importar orden ni si faltan columnas
      var headerRow=rows[0]||[];
      var headerIdx={};
      headerRow.forEach(function(h,i){ headerIdx[_normHeader(h)]=i; });
      var idx={};
      Object.keys(OC_FIELD_HEADERS).forEach(function(field){
        var candidatos=OC_FIELD_HEADERS[field];
        idx[field]=-1;
        for(var i=0;i<candidatos.length;i++){
          if(headerIdx.hasOwnProperty(candidatos[i])){ idx[field]=headerIdx[candidatos[i]]; break; }
        }
      });
      if(idx.oc===-1){ err.textContent='No se encontró la columna "Orden de compra" en el archivo'; return; }

      var getCell=function(row,field){
        return idx[field]>-1 ? row[idx[field]] : '';
      };

      OC_ROWS_PARSED=[];
      rows.slice(1).forEach(function(row){
        var oc=String(getCell(row,'oc')||'').trim();
        if(!oc||_normHeader(oc)==='orden de compra')return;
        OC_ROWS_PARSED.push({
          oc: oc,
          cuentaProveedor:     String(getCell(row,'cuentaProveedor')||'').trim(),
          cuentaFacturacion:   String(getCell(row,'cuentaFacturacion')||'').trim(),
          proveedor:           String(getCell(row,'proveedor')||'').trim(),
          tipoCompra:          String(getCell(row,'tipoCompra')||'').trim(),
          estadoAprobacion:    String(getCell(row,'estadoAprobacion')||'').trim(),
          estadoOrden:         String(getCell(row,'estadoOrden')||'').trim(),
          divisa:              String(getCell(row,'divisa')||'').trim(),
          fechaRecepcion:      _ocFechaToStr(getCell(row,'fechaRecepcion')),
          modoEntrega:         String(getCell(row,'modoEntrega')||'').trim(),
          condicionesEntrega:  String(getCell(row,'condicionesEntrega')||'').trim(),
          acuerdoCompra:       String(getCell(row,'acuerdoCompra')||'').trim(),
          entregaDirecta:      String(getCell(row,'entregaDirecta')||'').trim(),
          subcontratoProyecto: String(getCell(row,'subcontratoProyecto')||'').trim(),
          nombreEntrega:       String(getCell(row,'nombreEntrega')||'').trim(),
          almacen:             String(getCell(row,'almacen')||'').trim()
        });
      });

      if(!OC_ROWS_PARSED.length){err.textContent='No se encontraron órdenes de compra en el archivo';return;}
      renderOCPreview();
    }catch(ex){err.textContent='Error leyendo archivo: '+ex.message;}
  };
  reader.readAsArrayBuffer(file);
}

function renderOCPreview(){
  document.getElementById('oc-preview-title').textContent=
    'Vista previa — '+OC_ROWS_PARSED.length+' orden(es) encontradas';
  var tbody=OC_ROWS_PARSED.map(function(r,i){
    return '<tr>'+
      '<td class="mono" style="font-size:11px;color:var(--text3)">'+(i+1)+'</td>'+
      '<td class="mono">'+esc(r.oc)+'</td>'+
      '<td class="td-desc">'+esc(r.proveedor)+'</td>'+
      '<td class="mono" style="font-size:12px">'+esc(r.fechaRecepcion||'—')+'</td>'+
      '<td class="td-desc">'+esc(r.nombreEntrega||'—')+'</td>'+
      '<td class="c">'+_ocBadge('Pendiente')+'</td>'+
    '</tr>';
  }).join('');
  document.getElementById('oc-preview-tbody').innerHTML=tbody;
  document.getElementById('oc-preview').classList.remove('hidden');
  document.getElementById('btn-oc-import-confirm').disabled=false;
}

function clearOCFile(){
  OC_ROWS_PARSED=[];
  document.getElementById('oc-file-inp').value='';
  document.getElementById('oc-preview').classList.add('hidden');
  document.getElementById('btn-oc-import-confirm').disabled=true;
}

function confirmarImportarOC(){
  if(!OC_ROWS_PARSED.length)return;
  var btn=document.getElementById('btn-oc-import-confirm');
  var err=document.getElementById('oc-import-err');
  err.textContent='';
  btn.disabled=true;btn.textContent='Importando...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Importar';
      if(!r||!r.ok){err.textContent=(r&&r.error)||'Error al importar';return;}
      closeFS('fs-oc-import');
      showToast(r.agregadas+' OC nuevas cargadas'+(r.omitidas?', '+r.omitidas+' omitidas (ya existían)':''),'ok');
      reloadPage('dashboard');
    })
    .withFailureHandler(function(e){
      btn.disabled=false;btn.textContent='Importar';
      err.textContent=e.message;
    })
    .importarOC(S.token, OC_ROWS_PARSED);
}

/* ── Validar recepción: cruza ENTRADAS de todas las tiendas contra el maestro OC ── */
function validarRecepcionOC(){
  var btn=document.getElementById('btn-oc-validar');
  if(btn){btn.disabled=true;}
  showToast('Validando recepción contra ENTRADAS de todas las tiendas...','info');
  google.script.run
    .withSuccessHandler(function(r){
      if(btn){btn.disabled=false;}
      if(!r||!r.ok){showToast((r&&r.error)||'Error al validar','err');return;}
      showToast(r.actualizadas+' OC actualizadas a "Recibido"','ok');
      reloadPage('dashboard');
    })
    .withFailureHandler(function(e){
      if(btn){btn.disabled=false;}
      showToast(e.message,'err');
    })
    .validarRecepcionOC(S.token);
}

/* ── Catálogo MAESTRO en memoria (Validación) ── */
var _MAESTRO_LOCAL = null; // caché en memoria del catálogo MAESTRO propio de la tienda

function _cargarMaestro(cb){
  if(_MAESTRO_LOCAL){ if(cb) cb(); return; }
  google.script.run
    .withSuccessHandler(function(r){
      if(r&&r.ok){ _MAESTRO_LOCAL=r.data; }
      if(cb) cb();
    })
    .withFailureHandler(function(){ if(cb) cb(); })
    .getMaestroCompleto(S.token);
}
