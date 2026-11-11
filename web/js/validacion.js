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
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  // Mismo patrón que Salidas, Entradas, Conteo y Documentos: tres tarjetas de resumen + panel violeta con tabla hundida
  root.innerHTML=
    '<div class="sal2-sum" id="val-kpis"></div>'+
    '<div class="sal2-pnl">'+
    '<div class="sal2-fl">'+
      '<div class="sal2-seg" role="group" aria-label="Vista">'+
        '<button id="val-tab-sku" class="on" aria-pressed="true" onclick="setValTab(\'sku\')">Por SKU</button>'+
        '<button id="val-tab-cat" aria-pressed="false" onclick="setValTab(\'categoria\')">Por Categoría</button>'+
      '</div>'+
      '<span class="val-lbl">Fecha de conteo</span>'+
      '<input type="date" id="val-fecha" class="inp" style="width:160px" aria-label="Fecha de conteo" value="'+VAL_FECHA+'"/>'+
      '<button class="btn btn-primary btn-sm" id="val-validar" onclick="correrValidacion()">Validar</button>'+
      '<span id="val-status" class="vx-st"></span>'+
      '<button class="sal2-exp" onclick="exportValidacion()">'+icoExportar+'Exportar</button>'+
    '</div>'+
    // Filtros por estado, búsqueda y marca (solo en la vista por SKU)
    '<div class="sal2-fl val-sub" id="val-sub">'+
      '<div class="sal2-seg" id="val-chips" role="group" aria-label="Filtrar por estado"></div>'+
      '<div class="sal2-srch">'+icoBuscar+'<input id="val-search" type="search" placeholder="Buscar SKU o descripción…" aria-label="Buscar SKU o descripción" autocomplete="off" oninput="setValSearch(this.value)"/></div>'+
      '<select class="inp" id="val-marca-sel" aria-label="Marca" onchange="setValMarca(this.value)"><option value="">Todas las marcas</option></select>'+
      '<span class="sal2-cnt" id="val-cnt"></span>'+
    '</div>'+
    '<div id="val-body"></div>'+
    '</div>';
  document.getElementById('val-fecha').addEventListener('change',function(e){VAL_FECHA=e.target.value;VAL_FECHA_MANUAL=(VAL_FECHA!==_hoyLima());});
  _valDelegar(document.getElementById('val-body'));
  VAL_SEARCH=''; VAL_MARCA=''; VAL_FILTRO=''; VAL_TAB='sku'; VAL_OPEN={};
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
  var t=(REQ_TOKEN.validacion=(REQ_TOKEN.validacion||0)+1);
  var _maestroOk=false, _valOk=false, _maestroData=null, _valData=null;
  function _tryRender(){
    if(t!==REQ_TOKEN.validacion) return; // se corrió otra validación (fecha distinta o reintento) mientras esta estaba en vuelo
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
    _valGo=false;
    renderValBody();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ _valGo=true; var kp=document.getElementById('val-kpis'); if(kp) kp.classList.add('vx-go'); }); });
  }
  google.script.run
    .withSuccessHandler(function(r){ _maestroData=r; _maestroOk=true; _tryRender(); })
    .withFailureHandler(function(){ _maestroOk=true; _tryRender(); })
    .getMaestroCompleto(S.token, false);
  google.script.run
    .withSuccessHandler(function(r){ _valData=r; _valOk=true; _tryRender(); })
    .withFailureHandler(function(e){ if(t!==REQ_TOKEN.validacion) return; st.textContent=''; showToast(e.message,'err'); })
    .getValidacion(S.token, VAL_FECHA, force===true);
}

function setValTab(tab){
  VAL_TAB=tab;
  var bs=document.getElementById('val-tab-sku'), bc=document.getElementById('val-tab-cat');
  bs.classList.toggle('on',tab==='sku'); bs.setAttribute('aria-pressed',tab==='sku');
  bc.classList.toggle('on',tab!=='sku'); bc.setAttribute('aria-pressed',tab!=='sku');
  document.getElementById('val-sub').style.display=tab==='sku'?'flex':'none';
  renderValBody();
}

function setValFiltro(f){
  VAL_FILTRO=f;
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
  var kp=document.getElementById('val-kpis');
  renderValChips();
  if(!VAL_DATA.length){
    if(kp) kp.innerHTML='';
    body.innerHTML='<div class="vx-sin">Elige la fecha y pulsa <b>Validar</b> para cruzar<br>conteo, salidas, M-T y entradas.</div>';
    var c0=document.getElementById('val-cnt'); if(c0) c0.textContent='';
    return;
  }
  renderValResumen();
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
function _valCosto(r){ return (r.diff||0)*(VAL_MAESTRO[r.sku]||0); }
function _valConteos(){
  var c={ok:0,f:0,s:0,nc:0,ns:0,na:0};
  VAL_DATA.forEach(function(r){ c[_valEst(r)]++; });
  return c;
}

/* ── Resumen: tres tarjetas con la misma estructura (título, cifra, nota y un pie alineado abajo) ── */
var _valGo=false;   // la barra solo se anima la primera vez y al validar; al filtrar o cambiar de vista se queda llena
function renderValResumen(){
  var kp=document.getElementById('val-kpis'); if(!kp) return;
  var c=_valConteos(), desv=c.f+c.s, base=c.ok+desv;
  var pct=base?Math.round(c.ok/base*1000)/10:100, nivel=pct>=99?'ok':pct>=95?'casi':'bajo';
  var vTxt={ok:'Todo cuadra',casi:'Casi perfecto',bajo:'Hay que revisar'}[nivel];
  var falt=0, sob=0, sinP=0;
  VAL_DATA.forEach(function(r){
    var e=_valEst(r); if(e!=='f'&&e!=='s') return;
    var v=_valCosto(r); if(v<0) falt+=v; else sob+=v;
    if(!Object.prototype.hasOwnProperty.call(VAL_MAESTRO,r.sku)) sinP++;
  });
  var neto=falt+sob, tf=Math.abs(falt), ts=Math.abs(sob);
  var conStock=VAL_DATA.length-c.ns;
  kp.className='sal2-sum'+(_valGo?' vx-go':'');
  kp.innerHTML=
    '<div class="sal2-card vx-card"><div class="sal2-k">Exactitud</div>'+
      '<div class="vx-row"><div class="sal2-v">'+pct+'%</div><span class="vx-lv '+nivel+'"><i></i>'+vTxt+'</span></div>'+
      '<div class="sal2-n">'+c.ok+' de '+base+' productos cuadran</div>'+
      '<div class="vx-foot"><div class="vx-bar" role="img" aria-label="'+c.ok+' cuadran, '+desv+' con desvío"><i style="flex:'+c.ok+';background:#4ADE9F"></i><i style="flex:'+desv+';background:#FF8A9B"></i></div>'+
      '<div class="vx-lg"><span><em style="background:#4ADE9F"></em>'+c.ok+' cuadran</span><span><em style="background:#FF8A9B"></em>'+desv+' con desvío</span></div></div></div>'+
    '<div class="sal2-card vx-card"><div class="sal2-k">Costo del desvío</div>'+
      '<div class="vx-row"><div class="sal2-v '+(neto?'vx-neg':'vx-pos')+'" style="font-size:28px">'+_valMoney(neto)+'</div></div>'+
      '<div class="sal2-n">'+(desv?'Neto de '+desv+(desv===1?' producto con desvío':' productos con desvío'):'Sin desvíos en este conteo')+'</div>'+
      '<div class="vx-foot"><div class="vx-bar"><i style="flex:'+tf+';background:#FF8A9B"></i><i style="flex:'+ts+';background:rgba(255,138,155,.4)"></i></div>'+
      '<div class="vx-two"><div><small>Faltante · '+c.f+'</small><b class="vx-neg">'+_valMoney(falt)+'</b></div><div><small>Sobrante · '+c.s+'</small><b>'+(sob?'+':'')+_valMoney(sob)+'</b></div></div></div>'+
      (sinP>0?'<div class="vx-warn" title="Estos SKUs no aparecen en la hoja MAESTRO (Cod_Lovis) o no tienen columna Precio: su costo se muestra como S/ 0.00 pero no está calculado">'+sinP+' SKU sin precio en MAESTRO: su costo no está calculado</div>':'')+'</div>'+
    '<div class="sal2-card vx-card"><div class="sal2-k">Sin contar</div>'+
      '<div class="vx-row"><div class="sal2-v '+(c.nc?'':'vx-pos')+'">'+c.nc+'</div><small class="vx-of">de '+conStock+' productos con stock</small></div>'+
      '<div class="sal2-n">'+(c.ns?c.ns+' sin stock no entran en el cálculo':'Todos los productos fueron contados')+'</div>'+
      '<div class="vx-foot">'+(c.nc?'<button class="vx-cta" id="val-ir-nc">Ver los que faltan <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>':'<div class="vx-ok">Todo el inventario fue contado</div>')+'</div></div>';
  var ir=document.getElementById('val-ir-nc');
  if(ir) ir.onclick=function(){ VAL_TAB==='sku' ? setValFiltro('nc') : (setValTab('sku'), setValFiltro('nc')); };
}

/* Chips de estado con su contador (los que no tienen productos siguen visibles, en cero) */
function renderValChips(){
  var el=document.getElementById('val-chips'); if(!el) return;
  var c=_valConteos();
  var L=[['','Todos',VAL_DATA.length],['f','Faltantes',c.f],['s','Sobrantes',c.s],['ok','Cuadran',c.ok],['nc','Sin contar',c.nc],['nostock','Sin stock',c.ns]];
  el.innerHTML=L.map(function(x){
    var on=VAL_FILTRO===x[0]||(VAL_FILTRO==='ns'&&x[0]==='nostock');
    return '<button class="'+(on?'on':'')+'" aria-pressed="'+on+'" data-f="'+x[0]+'">'+x[1]+' <span>'+x[2]+'</span></button>';
  }).join('');
  [].forEach.call(el.querySelectorAll('button'),function(b){ b.onclick=function(){ setValFiltro(b.dataset.f); }; });
}

/* ── Por SKU ── */
function renderValSKU(body){
  var rows=VAL_DATA;
  if(VAL_FILTRO==='diff')    rows=rows.filter(function(r){var e=_valEst(r);return e==='f'||e==='s';});
  if(VAL_FILTRO==='f')       rows=rows.filter(function(r){return _valEst(r)==='f';});
  if(VAL_FILTRO==='s')       rows=rows.filter(function(r){return _valEst(r)==='s';});
  if(VAL_FILTRO==='ok')      rows=rows.filter(function(r){return _valEst(r)==='ok';});
  if(VAL_FILTRO==='nc')      rows=rows.filter(function(r){return _valEst(r)==='nc';});
  if(VAL_FILTRO==='nostock') rows=rows.filter(function(r){return _valEst(r)==='ns';});
  if(VAL_MARCA)   rows=rows.filter(function(r){return (r.marca||'').trim()===VAL_MARCA;});
  if(VAL_SEARCH)  rows=rows.filter(function(r){
    return (r.sku||'').toLowerCase().indexOf(VAL_SEARCH)!==-1 ||
           (r.desc||'').toLowerCase().indexOf(VAL_SEARCH)!==-1;
  });
  var ct=document.getElementById('val-cnt'); if(ct) ct.textContent=rows.length+(rows.length===1?' producto':' productos');

  var html='<div class="table-wrap"><table><thead><tr>'+
      '<th>Producto</th>'+
      '<th class="r col-hide-mobile" title="Conteo del día anterior">C. Ant.</th>'+
      '<th class="r col-hide-mobile">− Sal.</th>'+
      '<th class="r col-hide-mobile">− M-T</th>'+
      '<th class="r col-hide-mobile">+ Ent.</th>'+
      '<th class="r col-hide-mobile">= Real</th>'+
      '<th class="r" title="Conteo real del día seleccionado">C. Actual</th>'+
      '<th class="r">Diferencia</th>'+
      '<th class="r col-hide-mobile">Costo</th>'+
      '<th class="col-hide-mobile" style="width:1%"></th>'+
    '</tr></thead><tbody>';
  if(!rows.length){
    html+='<tr><td colspan="10" class="vx-vacio">Ningún producto coincide.<br>Prueba con otro estado, marca o texto.</td></tr>';
  } else {
    rows.forEach(function(r){
      var e=_valEst(r), des=(e==='f'||e==='s');
      var dif=des ? '<span class="vx-ch '+e+'" aria-label="'+(e==='f'?'Faltante':'Sobrante')+' de '+fmt(Math.abs(r.diff))+'">'+(r.diff>0?'+':'−')+fmt(Math.abs(r.diff))+'</span>'
                  : e==='ok' ? '<span class="vx-ch ok">Cuadra</span>'
                  : '<span class="vx-ch '+e+'">'+_VAL_LAB[e]+'</span>';
      var cs;
      if(des){
        var tiene=Object.prototype.hasOwnProperty.call(VAL_MAESTRO,r.sku);
        cs='<span class="vx-c '+e+'"'+(tiene?'':' style="color:var(--warn)" title="SKU no encontrado en la hoja MAESTRO (Cod_Lovis), costo no calculado"')+'>'+_valMoney(_valCosto(r))+'</span>';
      } else cs='<span class="vx-c">-</span>';
      var mov=function(tipo,v){
        return v>0 ? '<td class="r vx-n col-hide-mobile"><span class="vx-mv val-mov-cell" data-tipo="'+tipo+'" data-sku="'+esc(r.sku)+'" tabindex="0" role="button">'+fmt(v)+'</span></td>'
                   : '<td class="r vx-n col-hide-mobile">'+(v!==null?fmt(v):'-')+'</td>';
      };
      var accion = e==='nc'
        ? '<button class="vx-b val-ir-contar">Ir a contar</button>'
        : (des ? '<button class="vx-b val-recontar" data-sku="'+esc(r.sku)+'">Recontar</button>' : '');
      // en el celular las columnas del cálculo se ocultan: se resume en una línea bajo el producto
      var eqn=(r.cAnterior!==null&&r.real!==null) ? fmt(r.cAnterior)+(r.salidas?' − '+fmt(r.salidas):'')+(r.mt?' − '+fmt(r.mt):'')+(r.entradas?' + '+fmt(r.entradas):'')+' = '+fmt(r.real) : '';
      html+='<tr>'+
        '<td><div class="vx-pr"><i>'+esc(_valIni(r.desc))+'</i><div style="min-width:0"><b title="'+esc(r.desc)+'">'+esc(r.desc)+'</b><small>'+esc(r.sku)+(r.categoria?' · '+esc(r.categoria):'')+'</small>'+
          (eqn?'<div class="vx-eqn">'+eqn+'</div>':'')+(accion?'<div class="vx-am">'+accion+'</div>':'')+'</div></div></td>'+
        '<td class="r vx-n col-hide-mobile">'+(r.cAnterior!==null?fmt(r.cAnterior):'-')+'</td>'+
        mov('sal',r.salidas)+mov('mt',r.mt)+mov('ent',r.entradas)+
        '<td class="r vx-n em col-hide-mobile">'+(r.real!==null?fmt(r.real):'-')+'</td>'+
        '<td class="r vx-n em">'+(r.cActual!==null?fmt(r.cActual):'-')+'</td>'+
        '<td class="r">'+dif+'</td>'+
        '<td class="r col-hide-mobile">'+cs+'</td>'+
        '<td class="r col-hide-mobile"><div class="vx-a">'+accion+'</div></td>'+
      '</tr>';
    });
  }
  html+='</tbody></table></div>';
  body.innerHTML='<div class="vx-pane">'+html+'</div>';
}

/* Eventos de la tabla: un solo oyente en el contenedor (evita onclick con datos de usuario) */
function _valDelegar(body){
  if(!body||body._valDel) return;
  body._valDel=true;
  body.addEventListener('click', function(e) {
    var cell = e.target.closest('.val-mov-cell');
    if (cell) { abrirModalMov(cell.dataset.tipo, cell.dataset.sku); return; }
    var btn = e.target.closest('.val-recontar');
    if (btn) { recontar(btn.dataset.sku); return; }
    if (e.target.closest('.val-ir-contar')) { navTo('conteo', document.getElementById('nav-conteo')); return; }
    var g = e.target.closest('tr.vx-g');
    if (g) _valAbrir(g.dataset.k);
  });
  body.addEventListener('keydown', function(e) {
    if (e.key!=='Enter' && e.key!==' ') return;
    var t=e.target;
    if (t.classList && (t.classList.contains('val-mov-cell') || t.classList.contains('vx-g'))) { e.preventDefault(); t.click(); }
  });
}

/* ── Por Categoría: categoría → marca → producto, todo en la misma tabla ── */
var VAL_OPEN={};   // filas abiertas del desglose
var _VAL_SEP='\u0001';
function _valArbol(){
  var cats={};
  VAL_DATA.forEach(function(r){
    var e=_valEst(r); if(e!=='f'&&e!=='s') return;
    var v=_valCosto(r), cn=r.categoria||'Sin categoría', mn=r.marca||'Sin marca';
    var C=cats[cn]||(cats[cn]={n:cn,f:0,s:0,k:0,m:{}});
    var M=C.m[mn]||(C.m[mn]={n:mn,f:0,s:0,k:0,r:[]});
    [C,M].forEach(function(x){ x.k++; if(v<0) x.f+=v; else x.s+=v; });
    M.r.push({r:r,v:v});
  });
  var tot=function(x){ return Math.abs(x.f+x.s); };
  return Object.keys(cats).map(function(k){
    var C=cats[k];
    C.m=Object.keys(C.m).map(function(x){ return C.m[x]; }).sort(function(a,b){ return tot(b)-tot(a); });
    C.m.forEach(function(M){ M.r.sort(function(a,b){ return Math.abs(b.v)-Math.abs(a.v); }); });
    return C;
  }).sort(function(a,b){ return tot(b)-tot(a); });
}
var _VAL_CHEV='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';
function _valMini(x){
  var t=Math.abs(x.f)+Math.abs(x.s)||1;
  return '<div class="vx-mini" aria-hidden="true"><i style="width:'+(Math.abs(x.f)/t*100)+'%;background:#FF8A9B"></i><i style="width:'+(Math.abs(x.s)/t*100)+'%;background:rgba(255,138,155,.4)"></i></div>';
}
function _valFila(lv,key,nombre,x,open,nuevo){
  var n=x.f+x.s;
  return '<tr class="vx-g vx-l'+lv+(open?' open':'')+(nuevo?' vx-r':'')+'" data-k="'+esc(key)+'" tabindex="0" role="button" aria-expanded="'+open+'" aria-label="'+esc(nombre)+', '+_valMoney(n)+'">'+
    '<td><span class="vx-chev">'+_VAL_CHEV+'</span><span style="display:inline-block;vertical-align:middle"><div class="vx-nm">'+esc(nombre)+'</div></span></td>'+
    '<td class="c col-hide-mobile"><span class="vx-pill">'+x.k+(x.k===1?' SKU':' SKUs')+'</span></td>'+
    '<td class="r vx-n col-hide-mobile">'+_valMoney(x.f)+'</td><td class="r vx-n col-hide-mobile">'+_valMoney(x.s)+'</td>'+
    '<td class="r"><b class="vx-c f" style="font-size:13.5px">'+_valMoney(n)+'</b></td><td class="col-hide-mobile">'+_valMini(x)+'</td></tr>';
}
function renderValCat(body){
  var A=_valArbol();
  var h='<div class="table-wrap"><table><thead><tr><th>Categoría · marca · producto</th><th class="c col-hide-mobile">Con desvío</th><th class="r col-hide-mobile">Faltante</th><th class="r col-hide-mobile">Sobrante</th><th class="r">Neto</th><th class="col-hide-mobile" style="width:110px"></th></tr></thead><tbody>';
  if(!A.length) h+='<tr><td colspan="6" class="vx-vacio">Sin desvíos: todos los productos contados cuadran.</td></tr>';
  A.forEach(function(C){
    var kc='c:'+C.n, oc=!!VAL_OPEN[kc];
    h+=_valFila(1,kc,C.n,C,oc,false);
    if(!oc) return;
    C.m.forEach(function(M){
      var km='m:'+C.n+_VAL_SEP+M.n, om=!!VAL_OPEN[km];
      h+=_valFila(2,km,M.n,M,om,true);
      if(!om) return;
      M.r.forEach(function(o){
        h+='<tr class="vx-l3 vx-r"><td><div class="vx-nm">'+esc(o.r.desc)+'<small>'+esc(o.r.sku)+'</small></div></td><td class="c col-hide-mobile"></td>'+
          '<td class="r vx-n col-hide-mobile">'+(o.v<0?_valMoney(o.v):'-')+'</td><td class="r vx-n col-hide-mobile">'+(o.v>0?_valMoney(o.v):'-')+'</td>'+
          '<td class="r"><span class="vx-ch '+(o.r.diff<0?'f':'s')+'">'+(o.r.diff>0?'+':'−')+fmt(Math.abs(o.r.diff))+' und</span></td><td class="col-hide-mobile"></td></tr>';
      });
    });
  });
  var ct=document.getElementById('val-cnt'); if(ct) ct.textContent='';
  body.innerHTML='<div class="vx-pane">'+h+'</tbody></table></div></div>';
}
function _valAbrir(k){
  VAL_OPEN[k]=!VAL_OPEN[k];
  if(!VAL_OPEN[k]){ Object.keys(VAL_OPEN).forEach(function(x){ if(x.indexOf(k.replace(/^c:/,'m:')+_VAL_SEP)===0) delete VAL_OPEN[x]; }); }   // al cerrar una categoría se cierran sus marcas
  var body=document.getElementById('val-body'); renderValCat(body);
  var fila=[].filter.call(body.querySelectorAll('tr.vx-g'),function(x){ return x.dataset.k===k; })[0];
  if(fila) fila.focus({preventScroll:true});
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
          showToast('Conteo eliminado ('+r.eliminados+' fila'+(r.eliminados>1?'s':'')+'), ve a Conteo para recontar','ok');
          // Marcar el producto como "sin contar" localmente (no quitarlo: seguiría contando en Stock,
          // categorías y KPIs, y desaparecería de la pantalla hasta la próxima validación completa)
          VAL_DATA.forEach(function(d){ if(d.sku===sku){ d.sinContar=true; d.real=null; d.diff=null; } });
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
    title.textContent='Salidas · '+sku;
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
          '<td style="padding:7px 8px;font-family:var(--font-mono);font-size:11px;color:var(--p600)">'+esc(s.nroPedido||'-')+'</td>'+
          '<td style="padding:7px 8px;color:var(--text2)">'+esc(s.desc)+'</td>'+
          '<td style="padding:7px 8px;text-align:right">'+fmt(s.pack)+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--danger)">'+fmt(s.unidad)+'</td>'+
          '<td style="padding:7px 8px;color:var(--text3);font-size:11px">'+esc(s.motorizado||'-')+'</td>'+
        '</tr>';
      });
      var total=items.reduce(function(a,s){return a+s.unidad;},0);
      html+='<tr style="border-top:2px solid var(--border);font-weight:700">'+
        '<td colspan="3" style="padding:8px;font-size:11px;color:var(--text3)">TOTAL</td>'+
        '<td style="padding:8px;text-align:right;color:var(--danger)">'+fmt(total)+'</td>'+
        '<td></td></tr></tbody></table>';
    }
  } else if(tipo==='mt'){
    title.textContent='Mermas / Traslados · '+sku;
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
          '<td style="padding:7px 8px;color:var(--text2)">'+esc(m.motivo||'-')+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--warn)">'+fmt(m.cant)+'</td>'+
          '<td style="padding:7px 8px;color:var(--text3);font-size:11px">'+esc(m.obs||'-')+'</td>'+
        '</tr>';
      });
      var total=items.reduce(function(a,m){return a+m.cant;},0);
      html+='<tr style="border-top:2px solid var(--border);font-weight:700">'+
        '<td colspan="2" style="padding:8px;font-size:11px;color:var(--text3)">TOTAL</td>'+
        '<td style="padding:8px;text-align:right;color:var(--warn)">'+fmt(total)+'</td>'+
        '<td></td></tr></tbody></table>';
    }
  } else if(tipo==='ent'){
    title.textContent='Entradas · '+sku;
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
          '<td style="padding:7px 8px;font-family:var(--font-mono);font-size:11px;color:var(--p600)">'+esc(e.factura||'-')+'</td>'+
          '<td style="padding:7px 8px;color:var(--text2)">'+esc(e.proveedor||'-')+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--ok)">'+fmt(e.unidades)+'</td>'+
          '<td style="padding:7px 8px;color:var(--text3);font-size:11px">'+esc(e.responsable||'-')+'</td>'+
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
