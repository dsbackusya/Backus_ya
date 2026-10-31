/* Pantalla Validación de inventario — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   VALIDACIÓN DE INVENTARIO
══════════════════════════════════════ */
var VAL_DATA=[];     // resultado actual del servidor
var VAL_FECHA='';    // fecha seleccionada 'YYYY-MM-DD'
var VAL_TAB='sku';   // 'sku' | 'categoria'
var VAL_FILTRO='';   // '' | 'ok' | 'diff'
var VAL_SEARCH='';   // búsqueda por SKU / descripción
var VAL_MARCA='';    // filtro por marca
var VAL_MAESTRO={};  // mapa lovis a precio para costo desvíos
var VAL_TREE_SEL={cat:null,marca:null}; // selección activa del árbol de descomposición

// Fecha de hoy en Lima (YYYY-MM-DD), sin depender de la zona horaria del teléfono
function _hoyLima(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
var VAL_FECHA_MANUAL=false; // true si el usuario eligió otra fecha a mano
function initValidacion(){
  // Fecha por defecto: hoy. Después se puede cambiar, pero al volver a entrar aparece la actual.
  VAL_FECHA=_hoyLima(); VAL_FECHA_MANUAL=false;
  renderValidacionShell();
}
// Al volver a la pantalla (o si la app quedó abierta de un día para otro) la fecha vuelve a hoy, salvo que se haya elegido otra
function _valFechaHoy(){
  if(VAL_FECHA_MANUAL) return;
  var hoy=_hoyLima(), el=document.getElementById('val-fecha');
  if(el && VAL_FECHA!==hoy){ VAL_FECHA=hoy; el.value=hoy; }
}

function renderValidacionShell(){
  var root=document.getElementById('validacion-root');
  var icoExportar='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  root.innerHTML=
    '<div id="val-kpis"></div>'+
    '<div class="sal2-pnl">'+
    '<div class="sal2-fl">'+
      '<div class="sal2-seg">'+
        '<button id="val-tab-sku" class="on" onclick="setValTab(\'sku\')">Por SKU</button>'+
        '<button id="val-tab-cat" onclick="setValTab(\'categoria\')">Por Categoría</button>'+
      '</div>'+
      '<span class="val-lbl">Fecha de conteo</span>'+
      '<input type="date" id="val-fecha" class="inp" style="width:160px" value="'+VAL_FECHA+'"/>'+
      '<button class="btn btn-primary btn-sm" onclick="correrValidacion()">Validar</button>'+
      '<span id="val-status" style="font-size:12px;color:var(--text3);font-family:var(--font-mono)"></span>'+
      '<button class="sal2-exp" onclick="exportValidacion()">'+icoExportar+'Exportar</button>'+
    '</div>'+
    '<div class="sal2-fl val-sub" id="val-sub">'+
    // Barra de búsqueda + filtro por Marca (solo visible en tab SKU)
    '<div id="val-search-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      '<div style="position:relative;flex:1;min-width:180px;max-width:340px">'+
        '<svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text4)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
        '<input class="inp" id="val-search" type="search" placeholder="Buscar SKU o descripción…" style="padding-left:32px;font-size:13px" oninput="setValSearch(this.value)"/>'+
      '</div>'+
      '<select class="inp" id="val-marca-sel" style="min-width:150px;max-width:200px;font-size:13px" onchange="setValMarca(this.value)">'+
        '<option value="">Todas las marcas</option>'+
      '</select>'+
    '</div>'+
    // Filtro rápido (solo visible en tab SKU)
    '<div id="val-filtros" style="display:flex;gap:6px;flex-wrap:wrap">'+
      '<button class="btn btn-ghost btn-sm active" id="vf-all" onclick="setValFiltro(\'\')">Todos</button>'+
      '<button class="btn btn-ghost btn-sm" id="vf-diff" onclick="setValFiltro(\'diff\')">Solo desvíos</button>'+
      '<button class="btn btn-ghost btn-sm" id="vf-ok" onclick="setValFiltro(\'ok\')">Solo cuadran</button>'+
      '<button class="btn btn-ghost btn-sm" id="vf-nc" onclick="setValFiltro(\'nc\')">Sin contar</button>'+
      '<button class="btn btn-ghost btn-sm" id="vf-ns" onclick="setValFiltro(\'nostock\')">Sin stock</button>'+
    '</div>'+
    '</div>'+
    '<div id="val-body"></div>'+
    '</div>';
  document.getElementById('val-fecha').addEventListener('change',function(e){VAL_FECHA=e.target.value;VAL_FECHA_MANUAL=(VAL_FECHA!==_hoyLima());});
  VAL_SEARCH=''; VAL_MARCA='';
  renderValBody();
}

function correrValidacion(force){
  var fecha=document.getElementById('val-fecha').value;
  if(!fecha){showToast('Selecciona una fecha','err');return;}
  VAL_FECHA=fecha;
  var st=document.getElementById('val-status');
  st.textContent='Calculando...';
  document.getElementById('val-body').innerHTML=LD('Cruzando datos');
  // Cargar maestro (precios) y validación en paralelo
  var _maestroOk=false, _valOk=false, _maestroData=null, _valData=null;
  function _tryRender(){
    if(!_maestroOk || !_valOk) return;
    st.textContent='';
    if(_maestroData && _maestroData.ok){
      VAL_MAESTRO={};
      (_maestroData.data||[]).forEach(function(m){ VAL_MAESTRO[m.lovis]=m.precio||0; });
    }
    if(!_valData || !_valData.ok){
      document.getElementById('val-body').innerHTML='<div class="err-box">'+esc((_valData||{}).error||'Error desconocido')+'</div>';
      return;
    }
    VAL_DATA=_valData.data;
    _poblarMarcas();
    renderValBody();
  }
  google.script.run
    .withSuccessHandler(function(r){ _maestroData=r; _maestroOk=true; _tryRender(); })
    .withFailureHandler(function(){ _maestroOk=true; _tryRender(); })
    .getMaestroCompleto(S.token, false);
  google.script.run
    .withSuccessHandler(function(r){ _valData=r; _valOk=true; _tryRender(); })
    .withFailureHandler(function(e){ st.textContent=''; showToast(e.message,'err'); })
    .getValidacion(S.token, VAL_FECHA, force===true);
}

function setValTab(tab){
  VAL_TAB=tab;
  document.getElementById('val-tab-sku').classList.toggle('on',tab==='sku');
  document.getElementById('val-tab-cat').classList.toggle('on',tab==='categoria');
  var showSku=tab==='sku';
  document.getElementById('val-filtros').style.display=showSku?'flex':'none';
  document.getElementById('val-search-row').style.display=showSku?'flex':'none';
  document.getElementById('val-sub').style.display=showSku?'flex':'none';
  renderValBody();
}

function setValFiltro(f){
  VAL_FILTRO=f;
  ['all','diff','ok','nc','ns'].forEach(function(id){
    var btn=document.getElementById('vf-'+id);
    if(btn) btn.classList.toggle('active', (f===''&&id==='all')||(f===id)||(f==='nostock'&&id==='ns'));
  });
  renderValBody();
}

function setValSearch(v){
  VAL_SEARCH=(v||'').trim().toLowerCase();
  renderValBody();
}

function setValMarca(v){
  VAL_MARCA=v||'';
  renderValBody();
}

function _poblarMarcas(){
  var sel=document.getElementById('val-marca-sel');
  if(!sel)return;
  // Extraer marcas únicas no vacías
  var marcas=[...new Set(VAL_DATA.map(function(r){return (r.marca||'').trim();}).filter(Boolean))].sort();
  var prev=sel.value;
  sel.innerHTML='<option value="">Todas las marcas</option>';
  marcas.forEach(function(m){
    var o=document.createElement('option');
    o.value=m; o.textContent=m;
    sel.appendChild(o);
  });
  // Restaurar selección previa si aún existe
  if(prev && marcas.indexOf(prev)!==-1) sel.value=prev;
  else { VAL_MARCA=''; }
}

function renderValBody(){
  var body=document.getElementById('val-body');
  if(!body)return;
  var kp=document.getElementById('val-kpis'); if(kp) kp.innerHTML='';
  body.classList.toggle('val-cat',VAL_TAB!=='sku');
  if(!VAL_DATA.length){
    body.innerHTML='<div style="padding:60px;text-align:center;color:var(--text3);font-size:13px">Selecciona una fecha y presiona <strong>Validar</strong></div>';
    return;
  }
  if(VAL_TAB==='sku') renderValSKU(body);
  else                renderValCat(body);
}

/* Estado de cada fila (excluyentes): ok, f (faltante), s (sobrante), nc (sin contar), ns (sin stock), na (sin conteo anterior) */
function _valEst(r){
  if(r.sinContar) return (r.real!==null&&r.real===0)?'ns':'nc';
  if(r.diff===null) return 'na';
  if(r.diff!==0) return r.diff<0?'f':'s';
  return (r.real!==null&&r.real===0)?'ns':'ok';
}
var _VAL_LAB={ ok:'Cuadra', f:'Faltante', s:'Sobrante', nc:'Sin contar', ns:'Sin stock', na:'Sin conteo ant.' };
function _valIni(d){ return String(d||'').split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w.charAt(0);}).join('').toUpperCase(); }
function _valMoney(n){ return (n<0?'−':'')+'S/ '+Math.abs(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }

function renderValSKU(body){
  var est=function(r){ return _valEst(r); };
  var rows=VAL_DATA;
  if(VAL_FILTRO==='diff')    rows=rows.filter(function(r){var e=est(r);return e==='f'||e==='s';});
  if(VAL_FILTRO==='ok')      rows=rows.filter(function(r){return est(r)==='ok';});
  if(VAL_FILTRO==='nc')      rows=rows.filter(function(r){return est(r)==='nc';});
  if(VAL_FILTRO==='nostock') rows=rows.filter(function(r){return est(r)==='ns';});
  if(VAL_MARCA)   rows=rows.filter(function(r){return (r.marca||'').trim()===VAL_MARCA;});
  if(VAL_SEARCH)  rows=rows.filter(function(r){
    return (r.sku||'').toLowerCase().indexOf(VAL_SEARCH)!==-1 ||
           (r.desc||'').toLowerCase().indexOf(VAL_SEARCH)!==-1;
  });

  // Conteos por estado (excluyentes) y costo del desvío
  var c={ok:0,f:0,s:0,nc:0,ns:0,na:0};
  VAL_DATA.forEach(function(r){ c[est(r)]++; });
  var desv=c.f+c.s, tot=VAL_DATA.length||1;
  var costo=function(r){ return (r.diff||0)*(VAL_MAESTRO[r.sku]||0); };
  var falt=0, sob=0, skusSinPrecio=0;
  VAL_DATA.forEach(function(r){
    var e=est(r); if(e!=='f'&&e!=='s') return;
    var v=costo(r); if(v<0) falt+=v; else sob+=v;
    if(!Object.prototype.hasOwnProperty.call(VAL_MAESTRO,r.sku)) skusSinPrecio++;
  });
  var neto=falt+sob;
  var costoFmt=(function(v){
    var abs=Math.abs(v), sign=v<0?'−':'';
    if(abs>=1000000) return sign+'S/ '+(abs/1000000).toFixed(1)+'M';
    if(abs>=1000)    return sign+'S/ '+(abs/1000).toFixed(1)+'K';
    return sign+'S/ '+abs.toFixed(2);
  })(neto);
  var pct=Math.round(c.ok/Math.max(1,c.ok+desv)*1000)/10;

  // anillo
  var col={ok:'#FFFFFF',s:'#7B61EF',f:'#CC7A83',nc:'#D9A85A',ns:'#5C5C64',na:'#8A8A93'};
  var lab={ok:'Cuadran',s:'Sobrante',f:'Faltante',nc:'Sin contar',ns:'Sin stock',na:'Sin conteo ant.'};
  var fil={ok:'ok',s:'diff',f:'diff',nc:'nc',ns:'nostock',na:''};
  var orden=['ok','s','f','nc','ns','na'];
  var C=2*Math.PI*46, off=0, svg='<circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="12"/>';
  orden.forEach(function(k){ if(!c[k]) return; var len=c[k]/tot*C, seg=Math.max(1,len-2);
    svg+='<circle cx="60" cy="60" r="46" fill="none" stroke="'+col[k]+'" stroke-width="12" stroke-dasharray="'+seg+' '+(C-seg)+'" stroke-dashoffset="'+(-off)+'"/>'; off+=len; });
  var leyenda=orden.filter(function(k){ return c[k]||k!=='na'; }).map(function(k){
    return '<div class="vk-li" data-f="'+fil[k]+'"><em class="vk-dot" style="background:'+col[k]+'"></em><span>'+lab[k]+'</span><b>'+c[k]+'</b>'+
      '<div class="vk-lb"><i style="width:'+(c[k]/tot*100)+'%;background:'+col[k]+'"></i></div></div>';
  }).join('');

  // mayores desvíos
  var top=VAL_DATA.filter(function(r){var e=est(r);return e==='f'||e==='s';})
    .sort(function(a,b){ return Math.abs(costo(b))-Math.abs(costo(a)) || Math.abs(b.diff)-Math.abs(a.diff); }).slice(0,3);
  var topHtml=top.length?top.map(function(r){
    return '<div class="vk-ti" data-sku="'+esc(r.sku)+'"><i>'+esc(_valIni(r.desc))+'</i><div style="min-width:0"><b title="'+esc(r.desc)+'">'+esc(r.desc)+'</b><small>'+esc(r.sku)+(r.categoria?' · '+esc(r.categoria):'')+'</small></div>'+
      '<div class="vk-rt"><span class="'+(r.diff<0?'f':'s')+'">'+(r.diff>0?'+':'−')+fmt(Math.abs(r.diff))+' und.</span><small>'+_valMoney(costo(r))+'</small></div></div>';
  }).join(''):'<div class="vk-none">Todo cuadra, no hay desvíos</div>';

  var fch=String(VAL_FECHA||''); fch=fch.length>=10?fch.slice(8,10)+'/'+fch.slice(5,7):'';
  var base=c.ok+desv, nivel=pct>=99?'ok':pct>=95?'casi':'bajo';
  var vTxt={ok:'Todo cuadra',casi:'Casi perfecto',bajo:'Hay que revisar'}[nivel];
  var vSub=desv?(desv===1?'Solo 1 producto con diferencia.':desv+' productos con diferencia.'):'No hay diferencias en este conteo.';
  var nota=[]; if(c.ns) nota.push(c.ns+' sin stock no entran en el cálculo'); if(c.nc) nota.push(c.nc+' sin contar');
  var R=46, CI=2*Math.PI*R, arco=Math.max(0,Math.min(1,pct/100))*CI;
  var gr=nivel==='bajo'?['#E39AA2','#CC7A83','#7B61EF']:['#E4DEFC','#7B61EF','#CC7A83'];
  var arc='cx="60" cy="60" r="'+R+'" fill="none" stroke-linecap="round" stroke-dasharray="'+arco+' '+CI+'"';
  var anillo='<svg viewBox="0 0 120 120"><defs><linearGradient id="vkAu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+gr[0]+'"/><stop offset=".55" stop-color="'+gr[1]+'"/><stop offset="1" stop-color="'+gr[2]+'"/></linearGradient></defs>'+
    '<circle cx="60" cy="60" r="'+R+'" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="9"/>'+
    '<circle '+arc+' stroke="url(#vkAu)" stroke-width="16" opacity=".45" class="vk-aur"/>'+
    '<circle '+arc+' stroke="url(#vkAu)" stroke-width="9"/></svg>';
  var tile=function(k,f){ return '<div class="vk-t'+(c[k]?'':' z')+'" data-f="'+f+'"><span><em class="vk-dot" style="background:'+col[k]+'"></em>'+lab[k]+'</span><b>'+c[k]+'</b></div>'; };
  var fch=String(VAL_FECHA||''); fch=fch.length>=10?fch.slice(8,10)+'/'+fch.slice(5,7):'';
  var kpiHtml=
    '<div class="vk-sum2">'+
      '<div class="vk-c vk-hero"><div class="vk-dn">'+anillo+'<div class="vk-mid"><b>'+pct+'%</b><span>exactitud</span></div></div>'+
        '<div class="vk-hb"><span class="vk-v '+nivel+'"><em class="vk-dot"></em>'+vTxt+'</span>'+
        '<div class="vk-ht"><b>'+c.ok+'</b><span>/ '+base+'</span></div>'+
        '<div class="vk-hl">productos cuadran</div>'+
        '<div class="vk-hf">'+(c.ns?'<span title="Los productos sin stock no entran en el porcentaje">'+c.ns+' sin stock excluidos</span>':'')+(c.nc?'<span class="d">'+c.nc+' sin contar</span>':'')+'</div></div></div>'+
      '<div class="vk-tiles"><div class="vk-k">Estado de los productos</div>'+tile('ok','ok')+tile('f','diff')+tile('s','diff')+tile('nc','nc')+tile('ns','nostock')+'</div>'+
      '<div class="vk-c"><div class="vk-k">Costo del desvío</div>'+
        '<div class="vk-big '+(neto<0?'neg':neto>0?'pos':'')+'">'+costoFmt+'<small>pen</small></div>'+
        '<div class="vk-sub">'+(desv?desv+(desv===1?' producto con desvío':' productos con desvío'):'Sin desvíos en este conteo')+'</div>'+
        '<div class="vk-dv"><i style="flex:'+(Math.abs(falt)||(!sob?1:0))+';background:#CC7A83"></i><i style="flex:'+Math.abs(sob)+';background:#7B61EF"></i></div>'+
        '<div class="vk-lr"><span style="color:#CC7A83">Faltante '+_valMoney(falt)+'</span><span style="color:#C4B8FA">Sobrante '+_valMoney(sob)+'</span></div>'+
        (skusSinPrecio>0?'<div class="vk-warn" title="Estos SKUs no aparecen en la hoja MAESTRO (Cod_Lovis) o no tienen columna Precio — su costo se muestra como S/ 0.00 pero no está calculado">'+ICO('warn',12)+skusSinPrecio+' SKU sin precio en MAESTRO</div>':'')+
      '</div>'+
    '</div>';
  var kp=document.getElementById('val-kpis');
  if(kp){
    kp.innerHTML=kpiHtml;
    if(!kp._valDel){
      kp._valDel=true;
      kp.addEventListener('click',function(e){
        var li=e.target.closest('.vk-li,.vk-ver,.vk-t'); if(li){ setValFiltro(li.dataset.f); return; }
        var ti=e.target.closest('.vk-ti'); if(ti){ valIrSku(ti.dataset.sku); }
      });
    }
  }

  // contadores en los filtros rápidos
  var cnt={ 'vf-all':['Todos',VAL_DATA.length], 'vf-diff':['Solo desvíos',desv], 'vf-ok':['Solo cuadran',c.ok], 'vf-nc':['Sin contar',c.nc], 'vf-ns':['Sin stock',c.ns] };
  Object.keys(cnt).forEach(function(id){ var b=document.getElementById(id); if(b) b.innerHTML=cnt[id][0]+'<span>'+cnt[id][1]+'</span>'; });

  var html=
    '<div class="table-wrap" style="overflow-x:auto"><table style="min-width:900px"><thead><tr>'+
      '<th style="min-width:230px">Producto</th>'+
      '<th class="r" style="min-width:90px" title="Conteo del día anterior">C. Anterior</th>'+
      '<th class="r" style="min-width:80px">− Salidas</th>'+
      '<th class="r" style="min-width:70px">− M-T</th>'+
      '<th class="r" style="min-width:90px">+ Entradas</th>'+
      '<th class="r" style="min-width:90px">= Stock Real</th>'+
      '<th class="r" style="min-width:80px" title="Conteo real del día seleccionado">C. Actual</th>'+
      '<th class="r" style="min-width:90px">Diferencia</th>'+
      '<th class="r" style="min-width:90px">Costo Dif.</th>'+
      '<th style="min-width:120px;padding-left:16px !important">Estado</th>'+
      '<th style="min-width:80px"></th>'+
    '</tr></thead><tbody>';

  if(!rows.length){
    html+='<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:32px">Sin resultados con ese filtro</td></tr>';
  } else {
    rows.forEach(function(r){
      var e=est(r), rowCls=(e==='nc')?' class="val-nc"':'';
      var dif;
      if(e==='f'||e==='s') dif='<span class="vk-chip '+(r.diff<0?'f':'s')+'">'+(r.diff>0?'+':'−')+fmt(Math.abs(r.diff))+'</span>';
      else if(r.diff===0)  dif='<span class="vk-chip">0</span>';
      else                 dif='<span class="vk-chip">—</span>';
      var costoTd;
      if(e==='f'||e==='s'){
        var tieneMaestro=Object.prototype.hasOwnProperty.call(VAL_MAESTRO,r.sku), cs=costo(r);
        costoTd=tieneMaestro
          ? '<td class="r vk-cost '+(cs<0?'f':'s')+'">'+_valMoney(cs)+'</td>'
          : '<td class="r vk-cost" style="color:var(--warn)" title="SKU no encontrado en la hoja MAESTRO (Cod_Lovis) — costo no calculado">'+ICO('warn',12)+_valMoney(cs)+'</td>';
      } else costoTd='<td class="r vk-cost">—</td>';
      var mov=function(tipo,v){
        return v>0 ? '<td class="r val-mov-cell vk-mov" data-tipo="'+tipo+'" data-sku="'+esc(r.sku)+'">'+fmt(v)+'</td>'
                   : '<td class="r vk-mut">'+(v!==null?fmt(v):'—')+'</td>';
      };
      var accion = e==='nc'
        ? '<button class="btn btn-ghost btn-sm val-ir-contar">Ir a contar</button>'
        : ((e==='f'||e==='s') ? '<button class="btn btn-ghost btn-sm val-recontar" data-sku="'+esc(r.sku)+'">Recontar</button>' : '');
      html+='<tr'+rowCls+'>'+
        '<td><div class="vk-pr"><i>'+esc(_valIni(r.desc))+'</i><div><b title="'+esc(r.desc)+'">'+esc(r.desc)+'</b><small>'+esc(r.sku)+(r.categoria?' · '+esc(r.categoria):'')+'</small></div></div></td>'+
        '<td class="r vk-n">'+(r.cAnterior!==null?fmt(r.cAnterior):'—')+'</td>'+
        mov('sal',r.salidas)+mov('mt',r.mt)+mov('ent',r.entradas)+
        '<td class="r vk-n vk-em">'+(r.real!==null?fmt(r.real):'—')+'</td>'+
        '<td class="r vk-n"><b>'+(r.cActual!==null?fmt(r.cActual):'—')+'</b></td>'+
        '<td class="r">'+dif+'</td>'+
        costoTd+
        '<td style="padding-left:16px !important"><span class="sal-est '+e+'"><i></i>'+_VAL_LAB[e]+'</span></td>'+
        '<td class="c vk-act">'+accion+'</td>'+
      '</tr>';
    });
  }
  html+='</tbody></table></div>';
  body.innerHTML=html;

  // Event delegation — evita onclick inline con datos de usuario (XSS); se registra una sola vez
  if(body._valDel) return;
  body._valDel=true;
  body.addEventListener('click', function(e) {
    var cell = e.target.closest('.val-mov-cell');
    if (cell) { abrirModalMov(cell.dataset.tipo, cell.dataset.sku); return; }
    var btn = e.target.closest('.val-recontar');
    if (btn) { recontar(btn.dataset.sku); return; }
    if (e.target.closest('.val-ir-contar')) { navTo('conteo', document.getElementById('nav-conteo')); }
  });
}
// Al tocar un desvío del resumen: se busca ese SKU en la tabla (se quita el filtro de estado)
function valIrSku(sku){
  var inp=document.getElementById('val-search'); if(inp) inp.value=sku;
  VAL_SEARCH=String(sku||'').trim().toLowerCase();
  setValFiltro('');
}

/* ── Vista Árbol de Descomposición (Por Categoría) — única vista ── */
function renderValCat(body){
  _vcInjectCss();
  body.innerHTML='<div id="vc-tree-root"></div><div id="vc-stats" class="vc-stats"></div>';
  var kp=document.getElementById('val-kpis'); if(kp) kp.innerHTML='<div id="vc-kpi-row" class="vc-kpi-row"></div>';
  renderValKpis(true);
  renderValTree(document.getElementById('vc-tree-root'),true);
  renderValStats();
}

/* CSS de KPIs + árbol estilo referencia (gradientes sólidos) — inyectado una sola vez */
function _vcInjectCss(){
  if(document.getElementById('vc-css')) return;
  var st=document.createElement('style'); st.id='vc-css';
  st.textContent=
    /* Gradientes derivados de las variables del sistema (se adaptan al tema) */
    '.vc-g-blue{background:linear-gradient(135deg,color-mix(in srgb,var(--blue),#fff 28%),color-mix(in srgb,var(--blue),#000 12%));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--blue) 50%,transparent)}'+
    '.vc-g-pink{background:linear-gradient(135deg,color-mix(in srgb,var(--danger),#fff 22%),color-mix(in srgb,var(--danger),#000 22%));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--danger) 45%,transparent)}'+
    '.vc-g-verde{background:linear-gradient(135deg,color-mix(in srgb,var(--ok),#fff 20%),color-mix(in srgb,var(--ok),#000 25%));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--ok) 45%,transparent)}'+
    '.vc-g-purple{background:linear-gradient(135deg,var(--p400),var(--p600));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--p500) 50%,transparent)}'+
    '.vc-g-violet{background:linear-gradient(135deg,var(--p500),color-mix(in srgb,var(--p600),#000 20%));box-shadow:0 12px 30px -10px color-mix(in srgb,var(--p600) 55%,transparent)}'+
    /* KPI cards — estilo del proyecto (card oscura + icono tintado) */
    '.vc-kpi-row{display:flex;gap:14px;overflow-x:auto;padding:6px 2px 18px;margin-bottom:14px;border-bottom:1px solid var(--border)}'+
    '.vc-kpi{min-width:212px;max-width:212px;flex:0 0 auto;padding:13px 15px 12px;border:1px solid var(--border);border-radius:14px;background:var(--surface);cursor:pointer;transition:transform .2s,border-color .2s,background .2s,opacity .2s;animation:vcIn .38s ease both;animation-delay:calc(var(--i)*55ms)}'+
    '.vc-kpi:hover{transform:translateY(-3px);border-color:var(--p500)}'+
    '.vc-kpi-act{border-color:var(--p500);background:var(--surface2)}'+
    '.vc-kpi.vc-dim{opacity:.4}'+
    '.vc-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}'+
    '.vc-kpi-ico{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center}'+
    '.vc-kpi-ico svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'+
    '.vc-ico-blue{background:var(--blue-bg);color:var(--blue)}'+
    '.vc-ico-falt{background:var(--danger-bg);color:var(--danger)}'+
    '.vc-ico-sobr{background:var(--ok-bg);color:var(--ok)}'+
    '.vc-ico-gris{background:var(--surface2);color:var(--text3)}'+
    '.vc-kpi-badge{flex:0 0 auto;font-size:10px;font-weight:600;color:var(--text3);background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:2px 9px;font-variant-numeric:tabular-nums}'+
    '.vc-kpi-name{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:4px}'+
    '.vc-kpi-val{font-size:21px;font-weight:800;line-height:1.05;letter-spacing:-.01em;color:var(--text);font-variant-numeric:tabular-nums}'+
    '.vc-kpi-und{font-size:11px;color:var(--text3);margin-top:3px;font-variant-numeric:tabular-nums}'+
    '.vc-kpi-bar{display:flex;height:5px;border-radius:3px;overflow:hidden;background:var(--border);margin:10px 0 7px;transform-origin:left;animation:vcBar .5s ease both;animation-delay:calc(var(--i)*55ms + .12s)}'+
    '.vc-kpi-bar>span{height:100%}'+
    '.vc-kpi-split{display:flex;justify-content:space-between;font-size:10.5px;font-weight:600;font-variant-numeric:tabular-nums}'+
    /* Nodos del árbol — más grandes y con aire, como la referencia */
    '.vc-node{border-radius:14px;padding:14px 17px 13px;color:#fff;position:relative;border:1px solid rgba(255,255,255,.14);transition:transform .2s cubic-bezier(.2,.8,.3,1.2),opacity .2s,box-shadow .2s;animation:vcIn .35s ease both;animation-delay:calc(var(--i)*50ms)}'+
    '.vc-node::after{content:"";position:absolute;inset:0;border-radius:14px;pointer-events:none;background:linear-gradient(178deg,rgba(255,255,255,.18),rgba(255,255,255,0) 46%)}'+
    '.vc-tn-cat:hover,.vc-tn-marca:hover{transform:translateY(-3px)}'+
    '.vc-sel{box-shadow:0 18px 44px -8px rgba(0,0,0,.75)!important;transform:scale(1.03)}'+
    '.vc-dim{opacity:.3}'+
    '.vc-tn-big{padding:20px 18px 17px!important;min-height:128px;display:flex;flex-direction:column;justify-content:flex-end}'+
    '.vc-tn-big .vc-n-ico{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.24);display:flex;align-items:center;justify-content:center;margin-bottom:auto}'+
    '.vc-tn-big .vc-n-ico svg{width:16px;height:16px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'+
    '.vc-tn-big .vc-n-name{font-size:14px;margin-top:12px;white-space:normal}'+
    '.vc-tn-big .vc-n-val{font-size:17px}'+
    '.vc-n-name{font-size:12px;font-weight:600;opacity:.95;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.vc-n-val{font-size:16px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}'+
    '.vc-n-und{display:block;font-size:10px;opacity:.75;font-weight:600;margin-top:3px;letter-spacing:.02em}'+
    /* Conectores */
    '#vc-tree-svg path.vc-lnk{animation:vcLnkIn .5s ease backwards;animation-delay:calc(var(--j)*45ms)}'+
    '@keyframes vcLnkIn{from{opacity:0}}'+
    /* Stats footer */
    '.vc-stats{display:flex;gap:clamp(30px,8vw,110px);justify-content:center;align-items:flex-start;padding:24px 0 8px}'+
    '.vc-stat{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;animation:vcIn .4s ease both;animation-delay:calc(var(--i)*90ms + .25s)}'+
    '.vc-stat-circ{width:38px;height:38px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text3)}'+
    '.vc-stat-circ svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'+
    '.vc-stat-lbl{font-size:9px;font-weight:600;letter-spacing:.18em;color:var(--text3);text-transform:uppercase}'+
    '.vc-stat-num{font-size:23px;font-weight:800;color:var(--text);letter-spacing:-.01em;font-variant-numeric:tabular-nums}'+
    /* Animaciones base */
    '@keyframes vcIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}'+
    '@keyframes vcBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}'+
    '.vc-noanim .vc-node,.vc-noanim .vc-kpi,.vc-noanim .vc-kpi-bar,.vc-noanim .vc-stat{animation:none!important}'+
    '@media (prefers-reduced-motion:reduce){.vc-kpi,.vc-node,.vc-kpi-bar,.vc-stat,#vc-tree-svg path.vc-lnk{animation:none!important}.vc-kpi,.vc-node{transition:none}}';
  document.head.appendChild(st);
}

/* Fila de KPI cards: Global + una por categoría con desvío */
function renderValKpis(anim){
  var row=document.getElementById('vc-kpi-row'); if(!row) return;
  var D=_vcTreeData();
  if(!D.n){ row.innerHTML=''; row.style.display='none'; return; }
  row.style.display='';
  row.classList.toggle('vc-noanim',!anim);
  var ICO_CUBE='<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>';
  var card=function(key,name,o,cont,active,idx){
    var kind=key==='__all__'?'blue':(o.val<0?'falt':(o.val>0?'sobr':'gris'));
    var totAbs=Math.abs(o.falt)+Math.abs(o.sobr);
    var pF=totAbs>0?Math.round(Math.abs(o.falt)/totAbs*100):0;
    var dim=VAL_TREE_SEL.cat&&!active&&key!=='__all__'?' vc-dim':'';
    return '<div class="vc-kpi'+(active&&key!=='__all__'?' vc-kpi-act':'')+dim+'" data-key="'+esc(key)+'" style="--i:'+idx+'">'+
      '<div class="vc-kpi-top">'+
        '<div class="vc-kpi-ico vc-ico-'+kind+'"><svg viewBox="0 0 24 24">'+ICO_CUBE+'</svg></div>'+
        '<span class="vc-kpi-badge" title="SKUs con desvío / SKUs contados">'+o.nDesv+'/'+cont+' SKU</span>'+
      '</div>'+
      '<div class="vc-kpi-name" title="'+esc(name)+'">'+esc(name)+'</div>'+
      '<div class="vc-kpi-val">'+_vcMoney(o.val)+'</div>'+
      '<div class="vc-kpi-und">'+(o.und>0?'+':'')+fmt(o.und)+' und netas</div>'+
      '<div class="vc-kpi-bar">'+
        '<span style="width:'+pF+'%;background:var(--danger)"></span>'+
        '<span style="flex:1;background:var(--ok)"></span>'+
      '</div>'+
      '<div class="vc-kpi-split">'+
        '<span style="color:var(--danger)">'+_vcMoney(o.falt)+' falt</span>'+
        '<span style="color:var(--ok)">'+(o.sobr>0?'+':'')+_vcMoney(o.sobr)+' sobr</span>'+
      '</div>'+
    '</div>';
  };
  var catArr=Object.values(D.cats).sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});
  var html=card('__all__','Global',{val:D.total,und:D.totalUnd,falt:D.falt,sobr:D.sobr,nDesv:D.n},D.contTotal,!VAL_TREE_SEL.cat,0);
  catArr.forEach(function(c,i){
    html+=card(c.name,c.name,c,D.contados[c.name]||c.nDesv,c.name===VAL_TREE_SEL.cat,i+1);
  });
  row.innerHTML=html;
  row.onclick=function(e){
    var el=e.target.closest('.vc-kpi'); if(!el) return;
    var k=el.getAttribute('data-key');
    VAL_TREE_SEL=(k==='__all__'||VAL_TREE_SEL.cat===k)?{cat:null,marca:null}:{cat:k,marca:null};
    renderValKpis(false);
    renderValTree(document.getElementById('vc-tree-root'),false);
  };
}

/* Stats footer estilo referencia: SKUs contados · Con desvío · Costo neto */
function renderValStats(){
  var el=document.getElementById('vc-stats'); if(!el) return;
  var D=_vcTreeData();
  if(!D.n){ el.innerHTML=''; return; }
  var stat=function(ico,lbl,num,i){
    return '<div class="vc-stat" style="--i:'+i+'">'+
      '<div class="vc-stat-circ"><svg viewBox="0 0 24 24">'+ico+'</svg></div>'+
      '<div class="vc-stat-lbl">'+lbl+'</div>'+
      '<div class="vc-stat-num">'+num+'</div>'+
    '</div>';
  };
  el.innerHTML=
    stat('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>','SKUs contados',fmt(D.contTotal),0)+
    stat('<path d="M12 3v18M5 10l7-7 7 7"/>','Con desvío',fmt(D.n),1)+
    stat('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>','Costo neto',_vcMoney(D.total),2);
}

// Dataset del árbol: SOLO SKUs con diferencia ≠ 0 (positiva o negativa)
function _vcTreeData(){
  var rows=VAL_DATA.filter(function(r){
    return !r.sinContar && r.diff!==null && r.diff!==undefined && (Number(r.diff)||0)!==0;
  });
  // SKUs contados (incluye los que cuadran) por categoría — denominador de los KPIs
  var contados={}, contTotal=0;
  VAL_DATA.forEach(function(r){
    if(!r.sinContar && r.diff!==null && r.diff!==undefined){
      var c0=r.categoria||'Sin categoría';
      contados[c0]=(contados[c0]||0)+1; contTotal++;
    }
  });
  var cats={}, total=0, totalUnd=0, falt=0, sobr=0;
  rows.forEach(function(r){
    var dif=Number(r.diff)||0;
    var costo=dif*(Number(VAL_MAESTRO[r.sku])||0);
    var c=r.categoria||'Sin categoría', m=r.marca||'Sin marca';
    if(!cats[c]) cats[c]={name:c,val:0,und:0,falt:0,sobr:0,nDesv:0,marcas:{}};
    var C=cats[c];
    if(!C.marcas[m]) C.marcas[m]={name:m,val:0,und:0,skus:[]};
    C.val+=costo; C.und+=dif; C.nDesv++; C.marcas[m].val+=costo; C.marcas[m].und+=dif;
    if(costo<0){ C.falt+=costo; falt+=costo; } else { C.sobr+=costo; sobr+=costo; }
    total+=costo; totalUnd+=dif;
    C.marcas[m].skus.push({name:r.desc||r.sku,sku:r.sku,val:costo,und:dif});
  });
  return {total:total,totalUnd:totalUnd,falt:falt,sobr:sobr,cats:cats,n:rows.length,contados:contados,contTotal:contTotal};
}

function _vcMoney(v){
  return (v<0?'-':'')+'S/ '+Math.abs(v).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function _vcTreeNode(cls,key,name,val,und,kind,active,dim,clickable,idx){
  return '<div class="vc-node vc-g-'+kind+' '+cls+(active?' vc-sel':'')+(dim?' vc-dim':'')+'" data-key="'+esc(key)+'" data-val="'+Math.abs(val)+'" data-sign="'+(val<0?'neg':(val>0?'pos':'zero'))+'" style="--i:'+(idx||0)+';'+(clickable?'cursor:pointer':'')+'">'+
    '<div class="vc-n-name" title="'+esc(name)+'">'+esc(name)+'</div>'+
    '<div class="vc-n-val">'+_vcMoney(val)+'</div>'+
    '<span class="vc-n-und">'+(und>0?'+':'')+fmt(und)+' unidades</span>'+
  '</div>';
}

function renderValTree(root,anim){
  var D=_vcTreeData();
  if(!D.n){
    root.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px">Sin desvíos — todos los SKUs contados cuadran '+ICO('check',14,'l')+'</div>';
    return;
  }
  var noanim=anim?'':' vc-noanim';
  var colStyle='display:flex;flex-direction:column;gap:22px;min-width:248px;max-width:248px;max-height:560px;overflow-y:auto;padding:8px;';
  var hdr=function(t,n){
    return '<div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);padding:0 4px 6px;border-bottom:2px solid var(--border);margin-bottom:4px">'+t+
      (n!=null?' <span style="color:var(--p500)">'+n+'</span>':'')+'</div>';
  };

  var catArr=Object.values(D.cats).sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});

  // Total (card azul, como la referencia)
  var html='<div id="vc-tree-cols" class="'+noanim+'" style="position:relative;display:flex;gap:84px;overflow-x:auto;padding:10px 4px">'+
    '<svg id="vc-tree-svg" style="position:absolute;inset:0;pointer-events:none"></svg>'+
    '<div style="'+colStyle+'align-self:center;max-height:none;overflow:visible">'+hdr('Total desvíos',D.n+' SKU')+
      '<div id="vc-tn-total">'+
        '<div class="vc-node vc-g-blue vc-tn-big" style="--i:0">'+
          '<div class="vc-n-ico"><svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/></svg></div>'+
          '<div class="vc-n-name">Total Faltantes y Sobrantes</div>'+
          '<div class="vc-n-val">'+_vcMoney(D.total)+'</div>'+
          '<span class="vc-n-und">'+(D.totalUnd>0?'+':'')+fmt(D.totalUnd)+' unidades netas</span>'+
        '</div>'+
      '</div>'+
    '</div>';

  // Categorías (rosa)
  html+='<div class="vc-tree-col" style="'+colStyle+'">'+hdr('Categoría',catArr.length);
  catArr.forEach(function(c,ci){
    var isSel=c.name===VAL_TREE_SEL.cat;
    html+=_vcTreeNode('vc-tn-cat',c.name,c.name,c.val,c.und,'purple',isSel,VAL_TREE_SEL.cat&&!isSel,true,ci);
  });
  html+='</div>';

  // Marcas (violeta) — solo si hay categoría seleccionada
  var selCat=VAL_TREE_SEL.cat?D.cats[VAL_TREE_SEL.cat]:null;
  if(selCat){
    var marcaArr=Object.values(selCat.marcas).sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});
    html+='<div class="vc-tree-col" style="'+colStyle+'">'+hdr('Marca',marcaArr.length);
    marcaArr.forEach(function(m,mi){
      var isSel=m.name===VAL_TREE_SEL.marca;
      var mk=m.val<0?'pink':(m.val>0?'verde':'purple');
      html+=_vcTreeNode('vc-tn-marca',m.name,m.name,m.val,m.und,mk,isSel,VAL_TREE_SEL.marca&&!isSel,true,mi);
    });
    html+='</div>';
  }

  // SKUs (violeta profundo) — solo si hay marca seleccionada
  var selM=selCat&&VAL_TREE_SEL.marca?selCat.marcas[VAL_TREE_SEL.marca]:null;
  if(selM){
    var skuArr=selM.skus.slice().sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});
    html+='<div class="vc-tree-col" style="'+colStyle+'min-width:288px;max-width:288px">'+hdr('SKU',skuArr.length);
    skuArr.forEach(function(s,si){
      var sk=s.val<0?'pink':(s.val>0?'verde':'violet');
      html+=_vcTreeNode('vc-tn-sku',s.sku,s.name,s.val,s.und,sk,false,false,false,si);
    });
    html+='</div>';
  }

  html+='</div>'+
    '<div style="font-size:11px;color:var(--text3);margin-top:8px;padding:0 4px">Mostrando solo SKUs con diferencia ≠ 0 · Haz clic en una categoría o marca para desglosar</div>';

  root.innerHTML=html;

  // Delegación de clicks (evita inline onclick con nombres con comillas)
  var cols=document.getElementById('vc-tree-cols');
  cols.onclick=function(e){
    var cat=e.target.closest('.vc-tn-cat');
    if(cat){
      var k=cat.getAttribute('data-key');
      VAL_TREE_SEL = (VAL_TREE_SEL.cat===k) ? {cat:null,marca:null} : {cat:k,marca:null};
      renderValKpis(false); renderValTree(root,false); return;
    }
    var m=e.target.closest('.vc-tn-marca');
    if(m){
      var km=m.getAttribute('data-key');
      VAL_TREE_SEL.marca = (VAL_TREE_SEL.marca===km) ? null : km;
      renderValTree(root,false); return;
    }
  };
  // Redibujar conectores al hacer scroll dentro de las columnas (sin re-animar)
  cols.addEventListener('scroll',function(){requestAnimationFrame(function(){vcTreeDrawLinks(false);});},true);
  requestAnimationFrame(function(){vcTreeDrawLinks(!!anim);});
}

function vcTreeDrawLinks(animate){
  var rootEl=document.getElementById('vc-tree-cols');
  var svg=document.getElementById('vc-tree-svg');
  if(!rootEl||!svg)return;
  var W=rootEl.scrollWidth,H=rootEl.scrollHeight;
  svg.setAttribute('width',W); svg.setAttribute('height',H);
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
  svg.style.width=W+'px'; svg.style.height=H+'px';
  var rb=rootEl.getBoundingClientRect();
  // Colores de sistema: origen fijo por columna, destino según signo del nodo
  var SIGN_COL={neg:'var(--danger)',pos:'var(--ok)',zero:'var(--p500)'};
  var defs='<defs>', paths='', nLnk=0, GID=0;
  // Cinta rellena de (x1,y1) a (x2,y2) con grosor t y gradiente c1 a c2 propio
  var ribbon=function(x1,y1,x2,y2,t,c1,c2,op){
    var mx=(x1+x2)/2,h=t/2,id='vcrg'+(GID++);
    defs+='<linearGradient id="'+id+'" x1="'+x1+'" y1="0" x2="'+x2+'" y2="0" gradientUnits="userSpaceOnUse">'+
      '<stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>';
    var d='M'+x1+' '+(y1-h)+
      ' C'+mx+' '+(y1-h)+' '+mx+' '+(y2-h)+' '+x2+' '+(y2-h)+
      ' L'+x2+' '+(y2+h)+
      ' C'+mx+' '+(y2+h)+' '+mx+' '+(y1+h)+' '+x1+' '+(y1+h)+' Z';
    paths+='<path '+(animate?'class="vc-lnk" style="--j:'+(nLnk++)+';mix-blend-mode:screen" ':'style="mix-blend-mode:screen" ')+
      'd="'+d+'" fill="url(#'+id+')" opacity="'+op+'"/>';
  };
  // Dibuja un grupo origen a destinos con salidas APILADAS a lo alto del nodo origen
  // (estilo Sankey: cada cinta ocupa su propia franja, ordenadas por la posición del destino)
  var group=function(srcEl,els,srcCol,opFn,destCol){
    if(!srcEl||!els.length) return;
    var sb=srcEl.getBoundingClientRect();
    var sx=sb.right-rb.left+rootEl.scrollLeft;
    var sTop=sb.top-rb.top+rootEl.scrollTop;
    var list=els.map(function(el){
      var b=el.getBoundingClientRect();
      return {el:el,
        x:b.left-rb.left+rootEl.scrollLeft,
        y:b.top+b.height/2-rb.top+rootEl.scrollTop,
        v:parseFloat(el.getAttribute('data-val'))||0};
    }).sort(function(a,b){return a.y-b.y;});
    var maxV=list.reduce(function(m,o){return Math.max(m,o.v);},0);
    var ths=list.map(function(o){return maxV>0?10+Math.sqrt(o.v/maxV)*22:12;});
    var sum=ths.reduce(function(a,b){return a+b;},0);
    var pad=5, avail=Math.max(sb.height-pad*2,10);
    var k=sum>avail?avail/sum:1;                 // comprime si no caben en el alto del nodo
    var off=sTop+pad+(avail-sum*k)/2;            // centra el bloque de cintas verticalmente
    list.forEach(function(o,i){
      var t=Math.max(ths[i]*k,3);
      var c2=destCol||SIGN_COL[o.el.getAttribute('data-sign')]||SIGN_COL.zero;
      ribbon(sx,off+t/2,o.x,o.y,t,srcCol,c2,opFn(o.el));
      off+=t;
    });
  };
  var esc2=function(s){return (window.CSS&&CSS.escape)?CSS.escape(s):s.replace(/"/g,'\\"');};
  var tot=document.getElementById('vc-tn-total');
  var totCard=tot?tot.firstElementChild:null;
  var catEls=Array.prototype.slice.call(document.querySelectorAll('.vc-tn-cat'));
  group(totCard,catEls,'var(--blue)',function(el){
    var isSel=el.getAttribute('data-key')===VAL_TREE_SEL.cat;
    return !VAL_TREE_SEL.cat?'.72':(isSel?'.9':'.12');
  },'var(--p500)');
  if(VAL_TREE_SEL.cat){
    var selCat=document.querySelector('.vc-tn-cat[data-key="'+esc2(VAL_TREE_SEL.cat)+'"]');
    var mEls=Array.prototype.slice.call(document.querySelectorAll('.vc-tn-marca'));
    group(selCat,mEls,'var(--p500)',function(el){
      var isSel=el.getAttribute('data-key')===VAL_TREE_SEL.marca;
      return !VAL_TREE_SEL.marca?'.72':(isSel?'.9':'.12');
    });
  }
  if(VAL_TREE_SEL.marca){
    var selM=document.querySelector('.vc-tn-marca[data-key="'+esc2(VAL_TREE_SEL.marca)+'"]');
    var sEls=Array.prototype.slice.call(document.querySelectorAll('.vc-tn-sku'));
    if(selM){
      var srcCol=SIGN_COL[selM.getAttribute('data-sign')]||SIGN_COL.zero;
      group(selM,sEls,srcCol,function(){return '.85';});
    }
  }
  svg.innerHTML=defs+'</defs>'+paths;
}

function recontar(sku){
  if(!VAL_FECHA){showToast('No hay fecha de validación activa','err');return;}
  _confirmDialog(
    'Eliminar conteo para recontar',
    'Se eliminará el conteo de ' + sku + ' del ' + VAL_FECHA + '. Podrás recontar desde la sección Conteo.',
    function(){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){showToast(r.error,'err');return;}
          showToast('Conteo eliminado ('+r.eliminados+' fila'+(r.eliminados>1?'s':'')+') — ve a Conteo para recontar','ok');
          // Quitar de VAL_DATA localmente y re-renderizar
          VAL_DATA=VAL_DATA.filter(function(d){return d.sku!==sku;});
          renderValBody();
        })
        .withFailureHandler(function(e){showToast(e.message,'err');})
        .eliminarConteoPorSKU(S.token, sku, VAL_FECHA);
    },
    'Eliminar conteo'
  );
}

function exportValidacion(){
  if(!VAL_DATA.length){showToast('Primero ejecuta una validación','err');return;}
  // Hoja 1: Por SKU
  var dataSKU=VAL_DATA.map(function(r){
    var costoDif='';
    if(r.diff && r.diff!==0 && r.diff!==null && !r.sinContar){
      var precio=VAL_MAESTRO[r.sku]||0;
      costoDif=r.diff*precio;
    }
    return{
      'SKU':r.sku,'Descripción':r.desc,'Categoría':r.categoria,
      'C. Anterior':r.cAnterior!==null?r.cAnterior:'',
      'Salidas (día)':r.salidas!==null?r.salidas:'',
      'M-T (día)':r.mt!==null?r.mt:'',
      'Entradas (día)':r.entradas!==null?r.entradas:'',
      'C. Actual':r.cActual!==null?r.cActual:'',
      'Stock Real':r.real!==null?r.real:'',
      'Diferencia':r.diff!==null?r.diff:'',
      'Costo Dif.':costoDif,
      'Estado':r.sinContar?'Sin contar':r.diff===0?'Cuadra':r.diff!==null?'Desvío':'Sin conteo ant.'
    };
  });
  // Hoja 2: Por Categoría
  var cats={};
  VAL_DATA.forEach(function(r){
    var c=r.categoria||'Sin categoría';
    if(!cats[c])cats[c]={Categoría:c,'SKUs contados':0,'Cuadran':0,'Con desvío':0,'Und. desvío total':0};
    cats[c]['SKUs contados']++;
    if(!r.sinContar && r.diff===0)cats[c]['Cuadran']++;
    else if(r.diff!==null){cats[c]['Con desvío']++;cats[c]['Und. desvío total']+=Math.abs(r.diff);}
  });
  var dataCat=Object.values(cats).sort(function(a,b){return b['Con desvío']-a['Con desvío'];});

  var wsSKU=XLSX.utils.json_to_sheet(dataSKU);
  wsSKU['!cols']=[{wch:14},{wch:38},{wch:16},{wch:9},{wch:12},{wch:13},{wch:14},{wch:11},{wch:11},{wch:10}];
  var wsCat=XLSX.utils.json_to_sheet(dataCat);
  wsCat['!cols']=[{wch:20},{wch:14},{wch:10},{wch:12},{wch:18}];

  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,wsSKU,'Por SKU');
  XLSX.utils.book_append_sheet(wb,wsCat,'Por Categoría');
  XLSX.writeFile(wb,'validacion_'+VAL_FECHA+'.xlsx');
  showToast('Exportado correctamente','ok');
}

/* ── MODAL DETALLE MOVIMIENTOS ── */
function abrirModalMov(tipo, sku){
  var row=VAL_DATA.find(function(r){return r.sku===sku;});
  if(!row) return;
  var modal=document.getElementById('modal-mov');
  var title=document.getElementById('modal-mov-title');
  var sub=document.getElementById('modal-mov-sub');
  var body=document.getElementById('modal-mov-body');

  // Los movimientos son del día anterior al seleccionado
  var d=new Date(VAL_FECHA+'T00:00:00'); d.setDate(d.getDate()-1);
  var dStr=d.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});

  var html='';
  if(tipo==='sal'){
    title.textContent='Salidas — '+sku;
    sub.textContent=row.desc+' · '+dStr;
    var items=row.salidasDet||[];
    if(!items.length){ html='<div style="color:var(--text3);font-size:13px;padding:20px 0">Sin salidas ese día</div>'; }
    else {
      html='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="border-bottom:1px solid var(--border)">'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Nro. Pedido</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Descripción</th>'+
          '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Pack</th>'+
          '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Und.</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Motorizado</th>'+
        '</tr></thead><tbody>';
      items.forEach(function(s,i){
        var bg=i%2===0?'':'background:var(--surface2)';
        html+='<tr style="'+bg+'">'+
          '<td style="padding:7px 8px;font-family:var(--font-mono);font-size:11px;color:var(--p600)">'+esc(s.nroPedido||'—')+'</td>'+
          '<td style="padding:7px 8px;color:var(--text2)">'+esc(s.desc)+'</td>'+
          '<td style="padding:7px 8px;text-align:right">'+fmt(s.pack)+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--danger)">'+fmt(s.unidad)+'</td>'+
          '<td style="padding:7px 8px;color:var(--text3);font-size:11px">'+esc(s.motorizado||'—')+'</td>'+
        '</tr>';
      });
      var total=items.reduce(function(a,s){return a+s.unidad;},0);
      html+='<tr style="border-top:2px solid var(--border);font-weight:700">'+
        '<td colspan="3" style="padding:8px;font-size:11px;color:var(--text3)">TOTAL</td>'+
        '<td style="padding:8px;text-align:right;color:var(--danger)">'+fmt(total)+'</td>'+
        '<td></td></tr></tbody></table>';
    }
  } else if(tipo==='mt'){
    title.textContent='Mermas / Traslados — '+sku;
    sub.textContent=row.desc+' · '+dStr;
    var items=row.mtDet||[];
    if(!items.length){ html='<div style="color:var(--text3);font-size:13px;padding:20px 0">Sin M-T ese día</div>'; }
    else {
      html='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="border-bottom:1px solid var(--border)">'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Tipo</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Motivo</th>'+
          '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Cantidad</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Obs.</th>'+
        '</tr></thead><tbody>';
      items.forEach(function(m,i){
        var bg=i%2===0?'':'background:var(--surface2)';
        var bc=m.tipo==='MERMA'?'var(--danger)':'var(--blue)';
        html+='<tr style="'+bg+'">'+
          '<td style="padding:7px 8px"><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;border:1px solid '+bc+';color:'+bc+'">'+esc(m.tipo)+'</span></td>'+
          '<td style="padding:7px 8px;color:var(--text2)">'+esc(m.motivo||'—')+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--warn)">'+fmt(m.cant)+'</td>'+
          '<td style="padding:7px 8px;color:var(--text3);font-size:11px">'+esc(m.obs||'—')+'</td>'+
        '</tr>';
      });
      var total=items.reduce(function(a,m){return a+m.cant;},0);
      html+='<tr style="border-top:2px solid var(--border);font-weight:700">'+
        '<td colspan="2" style="padding:8px;font-size:11px;color:var(--text3)">TOTAL</td>'+
        '<td style="padding:8px;text-align:right;color:var(--warn)">'+fmt(total)+'</td>'+
        '<td></td></tr></tbody></table>';
    }
  } else if(tipo==='ent'){
    title.textContent='Entradas — '+sku;
    sub.textContent=row.desc+' · '+dStr;
    var items=row.entradasDet||[];
    if(!items.length){ html='<div style="color:var(--text3);font-size:13px;padding:20px 0">Sin entradas ese día</div>'; }
    else {
      html='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="border-bottom:1px solid var(--border)">'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Factura</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Proveedor</th>'+
          '<th style="text-align:right;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Unidades</th>'+
          '<th style="text-align:left;padding:6px 8px;color:var(--text3);font-size:10px;letter-spacing:.06em;text-transform:uppercase">Responsable</th>'+
        '</tr></thead><tbody>';
      items.forEach(function(e,i){
        var bg=i%2===0?'':'background:var(--surface2)';
        html+='<tr style="'+bg+'">'+
          '<td style="padding:7px 8px;font-family:var(--font-mono);font-size:11px;color:var(--p600)">'+esc(e.factura||'—')+'</td>'+
          '<td style="padding:7px 8px;color:var(--text2)">'+esc(e.proveedor||'—')+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--ok)">'+fmt(e.unidades)+'</td>'+
          '<td style="padding:7px 8px;color:var(--text3);font-size:11px">'+esc(e.responsable||'—')+'</td>'+
        '</tr>';
      });
      var total=items.reduce(function(a,e){return a+e.unidades;},0);
      html+='<tr style="border-top:2px solid var(--border);font-weight:700">'+
        '<td colspan="2" style="padding:8px;font-size:11px;color:var(--text3)">TOTAL</td>'+
        '<td style="padding:8px;text-align:right;color:var(--ok)">'+fmt(total)+'</td>'+
        '<td></td></tr></tbody></table>';
    }
  }
  body.innerHTML=html;
  modal.style.display='flex';
}

function cerrarModalMov(){
  document.getElementById('modal-mov').style.display='none';
}
