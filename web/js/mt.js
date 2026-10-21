/* Pantalla Mermas y Traslados — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   M-T
══════════════════════════════════════ */
function loadMT(){
  if(!S||!S.token){errBox('mt-root','Sin sesión activa. Recarga la página.','mt');PAGE_LOADING['mt']=false;return;}
  var force=!!_FORCE_REFRESH['mt']; _FORCE_REFRESH['mt']=false;
  var t = (REQ_TOKEN.mt = (REQ_TOKEN.mt||0) + 1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t !== REQ_TOKEN.mt) return;
      PAGE_LOADING['mt']=false; renderMT(r);
    })
    .withFailureHandler(function(e){
      if(t !== REQ_TOKEN.mt) return;
      PAGE_LOADING['mt']=false; errBox('mt-root',e.message,'mt');
    })
    .getMT(S.token, force, window.mt_rango||null);
}

/* ── M-T: tipos normalizados, KPI globales del período y filas agrupadas por día ── */
var _MT_TIPO='', _MT_EST='';
function _mtTipo(r){
  var u=String(r.tipo||'').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(u==='MERMA') return 'MERMA';
  if(u==='TRASLADO') return 'TRASLADO';
  if(u==='NC'||u.indexOf('NOTA DE CRED')===0) return 'NC';
  return 'OTROS';
}
function _mtPend(r){ return String(r.estado||'').trim().toLowerCase()!=='retirado'; }
function _mtMoney(n){ return 'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _mtSum(a,k){ return a.reduce(function(s,x){return s+(Number(x[k])||0);},0); }
function _mtFechaKey(f){ var p=String(f||'').split('/'); return p.length===3?p[2]+p[1]+p[0]:''; }
function _mtBase(){ return _applyFiltroFecha('mt', DATA.mt||[]); }

function _mtFiltrados(){
  var q=((document.getElementById('mt-busq')||{}).value||'').toLowerCase().trim();
  var rows=_mtBase().filter(function(r){
    if(_MT_TIPO && _mtTipo(r)!==_MT_TIPO) return false;
    if(_MT_EST){
      var t=_mtTipo(r); if(t!=='MERMA'&&t!=='NC') return false;
      if(_MT_EST==='pen'?!_mtPend(r):_mtPend(r)) return false;
    }
    return !q||[r.sku,r.desc,r.motivo,r.obs,r.nroFactura].some(function(v){return String(v||'').toLowerCase().indexOf(q)>-1;});
  });
  rows.sort(function(a,b){ var ka=_mtFechaKey(a.fecha), kb=_mtFechaKey(b.fecha); return ka===kb?b._row-a._row:(ka<kb?1:-1); });
  return rows;
}

function _mtBadgeTipo(t,raw){
  if(t==='MERMA') return '<span class="mt2-bd m">MERMA</span>';
  if(t==='TRASLADO') return '<span class="mt2-bd t">TRASLADO</span>';
  if(t==='NC') return '<span class="mt2-bd nc">NC</span>';
  return '<span class="mt2-bd n">'+esc(raw||'SIN TIPO')+'</span>';
}
function _mtBadgeEstado(r,t){
  if(t!=='MERMA'&&t!=='NC') return '<span class="mt2-bd n">—</span>';
  return _mtPend(r)?'<span class="mt2-bd w">Pendiente</span>':'<span class="mt2-bd ok">Retirado</span>';
}

function _mtDiaLabel(f){
  var p=String(f||'').split('/'); if(p.length!==3) return f||'Sin fecha';
  var d=new Date(+p[2],+p[1]-1,+p[0]), h=new Date(); h.setHours(0,0,0,0);
  var dif=Math.round((h-d)/86400000);
  var pre=dif===0?'Hoy':dif===1?'Ayer':d.toLocaleDateString('es-PE',{weekday:'long'});
  return pre.charAt(0).toUpperCase()+pre.slice(1)+' · '+f;
}

function _mtMoneyCard(titulo,arr){
  var pen=arr.filter(_mtPend), ret=arr.filter(function(r){return !_mtPend(r);});
  var tot=_mtSum(arr,'costo'), cp=_mtSum(pen,'costo'), pp=tot>0?Math.round(cp/tot*100):0;
  return '<div class="sal2-card mt2-money"><div class="mt2-mh"><div><div class="sal2-k">'+titulo+'</div><div class="sal2-v">'+_mtMoney(tot)+'</div></div>'+
      '<span class="mt2-meta">'+arr.length+(arr.length===1?' registro':' registros')+' · '+fmt(_mtSum(arr,'cant'))+' und.</span></div>'+
    '<div class="mt2-bar">'+(tot>0?'<i style="width:'+pp+'%;background:var(--warn)"></i><i style="width:'+(100-pp)+'%;background:var(--ok)"></i>':'')+'</div>'+
    '<div class="mt2-lg"><div><span><em style="background:var(--warn)"></em>Pendiente</span><b>'+_mtMoney(cp)+'<small>'+fmt(_mtSum(pen,'cant'))+' und.</small></b></div>'+
      '<div><span><em style="background:var(--ok)"></em>Retirado</span><b>'+_mtMoney(_mtSum(ret,'costo'))+'<small>'+fmt(_mtSum(ret,'cant'))+' und.</small></b></div></div></div>';
}
function _mtNcCard(nc){
  var pen=nc.filter(_mtPend);
  return '<div class="sal2-card mt2-money"><div class="sal2-k"><em class="mt2-dot"></em>Notas de crédito pendientes</div><div class="sal2-v">'+_mtMoney(_mtSum(pen,'costo'))+'</div>'+
    '<div class="mt2-lg" style="margin-top:14px"><div><span>Pendientes</span><b>'+pen.length+'<small>NC</small></b></div><div><span>Unidades</span><b>'+fmt(_mtSum(pen,'cant'))+'<small>und.</small></b></div></div>'+
    '<div class="sal2-n" style="color:var(--text4)">Las NC retiradas no suman al costo</div></div>';
}

function renderMT(r){
  if(_handleExpired(r,'mt-root')) return;
  if(!r||!r.ok){errBox('mt-root',r?r.error:'Error desconocido','mt');return;}
  DATA.mt=r.data;
  _MT_TIPO=''; _MT_EST='';
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  document.getElementById('mt-root').innerHTML=
    '<div class="mt2-note">'+ICO('info',13)+'Resumen del período · no cambia con el filtro de tipo ni la búsqueda</div>'+
    '<div class="sal2-sum mt2-sum" id="mt-kpis"></div>'+
    '<div class="sal2-fl">'+
      '<div class="sal2-srch">'+icoBuscar+'<input id="mt-busq" placeholder="Buscar SKU, producto o motivo…" oninput="filterMT()"/></div>'+
      _fechaFiltroHTML('mt','filterMT','mtRangoCambio')+
      '<div class="sal2-seg" id="mt-tipo-seg"></div>'+
      '<div class="sal2-seg" id="mt-est-seg"></div>'+
      '<span class="sal2-cnt" id="mt-count"></span>'+
    '</div>'+
    '<div class="mt2-tw" id="mt-list"></div>';
  _initFiltroFecha('mt','filterMT',{page:'mt'});
  filterMT();
}
function mtSetTipo(k){ _MT_TIPO=(_MT_TIPO===k?'':k); _filterMT(); }
function mtSetEst(k){ _MT_EST=(_MT_EST===k?'':k); _filterMT(); }

function _filterMT(){
  var base=_mtBase();
  var mer=base.filter(function(r){return _mtTipo(r)==='MERMA';});
  var tra=base.filter(function(r){return _mtTipo(r)==='TRASLADO';});
  var nc =base.filter(function(r){return _mtTipo(r)==='NC';});
  var oth=base.filter(function(r){return _mtTipo(r)==='OTROS';});

  var el=document.getElementById('mt-kpis');
  if(el) el.innerHTML=_mtMoneyCard('Costo de merma',mer)+_mtNcCard(nc)+
    '<div class="sal2-card"><div class="sal2-k">Traslados</div><div class="sal2-v">'+fmt(_mtSum(tra,'cant'))+'<small>und.</small></div><div class="sal2-n">'+tra.length+(tra.length===1?' movimiento':' movimientos')+'</div></div>'+
    '<div class="sal2-card"><div class="sal2-k">Registros</div><div class="sal2-v">'+base.length+'<small>mov.</small></div><div class="sal2-n">'+mer.length+' mermas · '+nc.length+' NC · '+tra.length+' trasl.'+(oth.length?' · '+oth.length+' otros':'')+'</div></div>';

  var sg=function(k,txt,n){return '<button class="'+(_MT_TIPO===k?'on':'')+'" onclick="mtSetTipo(\''+k+'\')">'+txt+'<span>'+n+'</span></button>';};
  var sgt=document.getElementById('mt-tipo-seg');
  if(sgt) sgt.innerHTML='<button class="'+(_MT_TIPO===''?'on':'')+'" onclick="mtSetTipo(\'\')">Todos<span>'+base.length+'</span></button>'+
    sg('MERMA','Mermas',mer.length)+sg('TRASLADO','Traslados',tra.length)+sg('NC','NC',nc.length)+((oth.length||_MT_TIPO==='OTROS')?sg('OTROS','Otros',oth.length):'');
  var se=document.getElementById('mt-est-seg');
  if(se) se.innerHTML='<button class="'+(_MT_EST===''?'on':'')+'" onclick="mtSetEst(\'\')">Cualquier estado</button>'+
    '<button class="'+(_MT_EST==='pen'?'on':'')+'" onclick="mtSetEst(\'pen\')">Pendiente</button>'+
    '<button class="'+(_MT_EST==='ret'?'on':'')+'" onclick="mtSetEst(\'ret\')">Retirado</button>';

  var rows=_mtFiltrados();
  var cnt=document.getElementById('mt-count'); if(cnt) cnt.textContent=rows.length+' registros';

  window._MT_ROWS={};
  // Rendimiento: se arma la lista de días y movimientos y se dibuja de a 60 elementos; al bajar se agregan los siguientes.
  var items=[], gAct=null, gKey=null;
  rows.forEach(function(r){
    window._MT_ROWS[r._row]=r;
    var k=r.fecha||'';
    if(k!==gKey){ gKey=k; gAct={ g:true, k:k, n:0, und:0 }; items.push(gAct); }
    gAct.n++; gAct.und+=(Number(r.cant)||0);
    items.push({ g:false, r:r });
  });
  _MT.items=items; _MT.n=0;
  var lst=document.getElementById('mt-list');
  if(!lst) return;
  if(!rows.length){ lst.innerHTML='<div class="mt2-vacio-t">Sin registros</div>'; _mtVigilar(null); return; }
  lst.innerHTML='<div class="mt2-tr mt2-h"><div>Producto</div><div class="c">Tipo</div><div class="r">Cant.</div><div class="r">Costo</div><div>Motivo</div><div class="c">Estado</div><div>Factura / NC</div><div></div></div>';
  _mtMas();
}

var _MT={ items:[], n:0, lote:60, obs:null };
function _mtItem(it){
  if(it.g) return '<div class="mt2-grp">'+esc(_mtDiaLabel(it.k))+'<em>'+it.n+' mov. · '+fmt(it.und)+' und.</em></div>';
  var r=it.r, t=_mtTipo(r);
  var sc=t==='MERMA'?'var(--danger)':t==='NC'?'#5CC8E0':t==='TRASLADO'?'var(--accent)':'var(--text4)';
  return '<div class="mt2-tr mt2-row" style="--sc:'+sc+'">'+
    '<div class="mt2-p"><b title="'+esc(r.desc)+'">'+esc(r.desc)+'</b><span>'+esc(r.sku)+'</span></div>'+
    '<div class="mt2-t">'+_mtBadgeTipo(t,r.tipo)+'</div>'+
    '<div class="mt2-q">'+fmt(r.cant)+'<small> und.</small></div>'+
    '<div class="mt2-c">'+(r.costo?_mtMoney(r.costo):'—')+'</div>'+
    '<div class="mt2-m"><b>'+esc(r.motivo||'—')+'</b>'+(r.obs?'<span>'+esc(r.obs)+'</span>':'')+'</div>'+
    '<div class="mt2-e">'+_mtBadgeEstado(r,t)+'</div>'+
    '<div class="mt2-f'+((r.nroFactura||r.fechaRetiro)?'':' mt2-vacio')+'"><b>'+esc(r.nroFactura||'—')+'</b>'+(r.fechaRetiro?'<span>Retiro '+esc(r.fechaRetiro)+'</span>':'')+'</div>'+
    '<div class="mt2-a"><button class="mt2-ib" title="Editar" onclick="editarMTRow('+r._row+')">'+ICO('edit',14,'s')+'</button>'+
      '<button class="mt2-ib d" title="Eliminar" onclick="eliminarMTRow('+r._row+')">'+ICO('trash',14,'s')+'</button></div>'+
  '</div>';
}
function _mtMas(){
  var host=document.getElementById('mt-list'); if(!host) return;
  var marca=document.getElementById('mt-mas'); if(marca) marca.remove();
  var desde=_MT.n, hasta=Math.min(desde+_MT.lote,_MT.items.length), h='', i;
  for(i=desde;i<hasta;i++) h+=_mtItem(_MT.items[i]);
  _MT.n=hasta;
  if(hasta<_MT.items.length) h+='<div id="mt-mas" style="text-align:center;color:var(--text3);padding:14px;font-size:12px">Mostrando más…</div>';
  host.insertAdjacentHTML('beforeend',h);
  _mtVigilar(document.getElementById('mt-mas'));
}
function _mtVigilar(marca){
  if(_MT.obs){ _MT.obs.disconnect(); _MT.obs=null; }
  if(!marca) return;
  if(!('IntersectionObserver' in window)){ while(_MT.n<_MT.items.length) _mtMas(); return; }
  _MT.obs=new IntersectionObserver(function(es){ if(es[0].isIntersecting) _mtMas(); },{rootMargin:'600px 0px'});
  _MT.obs.observe(marca);
}

function exportMT(){
  if(S&&S.rol!=='store'){
    var HDR=['Fecha','SKU','Descripción','Cantidad','Costo','Tipo','Motivo','Observaciones','Estado','Nro de factura','Fecha del retiro'];
    var CW=[{wch:12},{wch:14},{wch:36},{wch:10},{wch:12},{wch:10},{wch:20},{wch:24},{wch:12},{wch:16},{wch:14}];
    _exportConSpinner('btn-export-mt','mt',function(sedes){
      _exportMultiHoja(sedes.map(function(s){return{nombre:s.nombre,headers:HDR,rows:s.data,colWidths:CW,
        mapFn:function(r){return[r.fecha,r.sku,r.desc,r.cant,r.costo||0,r.tipo,r.motivo||'',r.obs||'',r.estado||'',r.nroFactura||'',r.fechaRetiro||''];}};}),'mt_sedes');
    });return;
  }
  var rows=_getFilteredRows('mt');
  _exportXLSX(['Fecha','SKU','Descripción','Cantidad','Costo','Tipo','Motivo','Observaciones','Estado','Nro de factura','Fecha del retiro'],
    rows,function(r){return[r.fecha,r.sku,r.desc,r.cant,r.costo||0,r.tipo,r.motivo||'',r.obs||'',r.estado||'',r.nroFactura||'',r.fechaRetiro||''];},'M-T','mermas_traslados');
}

/* ── REGISTRAR / EDITAR M-T ── */
var _MT_MOTIVOS={
  'MERMA':['Producto vencido','Roto en almacén','Roto en transporte','Faltante de inventario','Producto dañado'],
  'TRASLADO':['Reposición de stock','Pedido urgente','Devolución a sede'],
  'Nota de credito':['Devolución de cliente','Error de facturación','Producto en mal estado']
};
var _MT_NOMBRE={'MERMA':'Merma','TRASLADO':'Traslado','Nota de credito':'Nota de crédito'};
var _MTF={tipo:'',motivo:'',dest:'',sel:null,lineas:[],edit:false,destinos:null,res:[],seq:0,timer:0};

function _mtFechaHoy(){
  var d=new Date(), p=function(n){return (n<10?'0':'')+n;};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
function _mtEl(id){return document.getElementById(id);}

function mtTipo(t,conservar){
  _MTF.tipo=t;
  if(!conservar){ _MTF.motivo=''; _MTF.dest=''; _mtEl('mt-motivo').value=''; }
  document.querySelectorAll('.mt3-tp').forEach(function(b){ b.classList.toggle('on',b.dataset.t===t); });
  _mtEl('mt-b-motivo').classList.remove('mt3-oculto');
  _mtEl('mt-b-destino').classList.toggle('mt3-oculto',t!=='TRASLADO'||_MTF.edit);
  _mtEl('mt-chips').innerHTML=(_MT_MOTIVOS[t]||[]).map(function(m,i){
    return '<button type="button" class="mt3-chip" onclick="mtElegirMotivo('+i+')">'+esc(m)+'</button>';
  }).join('');
  _mtMarcarMotivo(); _mtDestinos(); mtPintar();
}
function _mtMarcarMotivo(){
  var lista=_MT_MOTIVOS[_MTF.tipo]||[];
  document.querySelectorAll('#mt-chips .mt3-chip').forEach(function(c,i){ c.classList.toggle('on',lista[i]===_MTF.motivo); });
}
function mtElegirMotivo(i){
  _MTF.motivo=(_MT_MOTIVOS[_MTF.tipo]||[])[i]||'';
  _mtEl('mt-motivo').value=_MTF.motivo; _mtMarcarMotivo(); mtPintar();
}
function mtMotivoInput(){
  _MTF.motivo=_mtEl('mt-motivo').value.trim(); _mtMarcarMotivo(); mtPintar();
}
function _mtDestinos(){
  var host=_mtEl('mt-destinos'), lista=_MTF.destinos||[];
  host.innerHTML=lista.map(function(n,i){
    return '<button type="button" class="mt3-chip'+(n===_MTF.dest?' on':'')+'" onclick="mtElegirDestino('+i+')">'+esc(n)+'</button>';
  }).join('');
}
function mtElegirDestino(i){ _MTF.dest=(_MTF.destinos||[])[i]||''; _mtDestinos(); mtPintar(); }

/* Buscador con stock */
function mtBuscar(){
  var q=_mtEl('mt-q').value.trim();
  if(_MTF.sel&&q!==_mtEtiqueta(_MTF.sel)){ _MTF.sel=null; mtInfo(); }
  clearTimeout(_MTF.timer);
  var list=_mtEl('ac-mt');
  if(q.length<2){ list.classList.remove('open'); return; }
  var n=++_MTF.seq;
  _MTF.timer=setTimeout(function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(n!==_MTF.seq||!r.ok) return;
        _MTF.res=r.results;
        if(!r.results.length){ list.classList.remove('open'); return; }
        if(r.results.length===1&&r.results[0].sku===q){ mtElegir(0); return; }   // código escaneado exacto
        list.innerHTML=r.results.map(function(x,i){
          return '<div class="ac-item" onclick="mtElegir('+i+')"><div class="ac-sku">'+esc(x.sku)+
            '<span class="ac-st'+(x.stock<=0?' c':'')+'">'+fmt(x.stock)+' und.</span></div><div class="ac-desc">'+esc(x.desc)+'</div></div>';
        }).join('');
        list.classList.add('open');
      })
      .withFailureHandler(function(){ list.classList.remove('open'); })
      .buscarSKUStock(S.token,q);
  },250);
}
function _mtEtiqueta(p){ return p.sku+' · '+p.desc; }
function mtQKey(e){
  if(e.key!=='Enter') return;
  e.preventDefault();
  var q=_mtEl('mt-q').value.trim(), i=-1;
  _MTF.res.forEach(function(x,k){ if(x.sku===q) i=k; });
  if(i<0&&_MTF.res.length===1) i=0;
  if(i>=0) mtElegir(i);
}
function mtElegir(i){
  var p=_MTF.res[i]; if(!p) return;
  _MTF.sel=p;
  _mtEl('mt-q').value=_mtEtiqueta(p);
  _mtEl('ac-mt').classList.remove('open');
  _mtEl('mt-cant').focus(); mtInfo();
}
// El escáner puso un SKU ya resuelto en el campo: se busca para traer su stock
var _mtEnganchado=false;
function _mtEnganchar(){
  if(_mtEnganchado) return; _mtEnganchado=true;
  _mtEl('mt-q').addEventListener('acpick',function(){
  var sku=_mtEl('mt-q').value.trim(); if(!sku) return;
  google.script.run.withSuccessHandler(function(r){
    if(!r.ok||!r.results.length) return;
    var i=0; r.results.forEach(function(x,k){ if(x.sku===sku) i=k; });
    _MTF.res=r.results; mtElegir(i);
  }).buscarSKUStock(S.token,sku);
  });
}

function _mtYaEsta(sku){ return _MTF.lineas.some(function(l){ return l.sku===sku; }); }
function mtInfo(){
  var b=_mtEl('mt-info'), p=_MTF.sel, btn=_mtEl('mt-btn-add');
  if(!p){ b.classList.remove('on'); btn.disabled=true; return; }
  var c=Number(_mtEl('mt-cant').value)||0, ya=_mtYaEsta(p.sku);
  var h='<span>Stock disponible: <b>'+fmt(p.stock)+' und.</b></span>';
  if(ya) h+='<span class="w">Ya está en la lista</span>';
  else if(p.stock<=0) h+='<span class="w">Sin stock</span>';
  else if(c>p.stock) h+='<span class="w">Pide '+fmt(c)+', solo hay '+fmt(p.stock)+'</span>';
  else if(c>0) h+='<span>Quedaría en <b>'+fmt(p.stock-c)+'</b></span>';
  b.innerHTML=h; b.classList.add('on');
  btn.disabled=!(c>0)||ya;
}
function mtAgregar(){
  var p=_MTF.sel, c=Number(_mtEl('mt-cant').value)||0;
  if(!p||c<=0||_mtYaEsta(p.sku)) return;
  _MTF.lineas.push({sku:p.sku,d:p.desc,s:p.stock,c:Math.floor(c)});
  _MTF.sel=null; _mtEl('mt-q').value=''; _mtEl('mt-cant').value='';
  mtInfo(); mtPintar(); _mtEl('mt-q').focus();
}
function mtQuitar(i){ _MTF.lineas.splice(i,1); mtInfo(); mtPintar(); }
function mtCantLinea(i,v){ _MTF.lineas[i].c=Math.floor(Number(v))||0; mtPintar(true); }

function _mtPintarLineas(){
  _mtEl('mt-ln-vacio').classList.toggle('mt3-oculto',_MTF.lineas.length>0);
  _mtEl('mt-ln-wrap').classList.toggle('mt3-oculto',_MTF.lineas.length===0);
  _mtEl('mt-ln-list').innerHTML=_MTF.lineas.map(function(l,i){
    var inf=l.s===Infinity, mal=!inf&&l.c>l.s;
    return '<div class="mt3-ln"><div class="n"><b title="'+esc(l.d)+'">'+esc(l.d)+'</b><span>'+esc(l.sku)+'</span></div>'+
      '<div class="st'+(mal?' mal':'')+'">'+(inf?'—':fmt(l.s))+'</div>'+
      '<input class="inp" type="number" min="1" value="'+l.c+'" oninput="mtCantLinea('+i+',this.value)"/>'+
      (_MTF.edit?'<span></span>':'<button type="button" class="x" title="Quitar" onclick="mtQuitar('+i+')">×</button>')+'</div>';
  }).join('');
}
function _mtExceso(){ return _MTF.lineas.filter(function(l){ return l.s!==Infinity&&l.c>l.s; }); }

function mtPintar(sinLineas){
  if(!sinLineas) _mtPintarLineas();
  var t=_MTF.tipo, tot=_MTF.lineas.reduce(function(a,l){ return a+l.c; },0), td=t==='TRASLADO'&&!_MTF.edit;
  var vacio='<span style="color:var(--text4)">—</span>';
  _mtEl('mt-r-tipo').innerHTML=t?'<span class="mt3-bd '+(t==='MERMA'?'merma':t==='TRASLADO'?'':'nc')+'">'+esc(_MT_NOMBRE[t])+'</span>':vacio;
  _mtEl('mt-r-mot').innerHTML=_MTF.motivo?esc(_MTF.motivo):vacio;
  _mtEl('mt-r-dest-l').classList.toggle('mt3-oculto',!td);
  _mtEl('mt-r-dest').classList.toggle('mt3-oculto',!td);
  _mtEl('mt-r-dest').textContent=_MTF.dest||'—';
  var f=_mtEl('mt-fecha').value; _mtEl('mt-r-fecha').textContent=f?f.split('-').reverse().join('/'):'—';
  _mtEl('mt-r-n').textContent=_MTF.lineas.length; _mtEl('mt-r-tot').textContent=fmt(tot);
  var exceso=_mtExceso().length, m, ok=false;
  if(!t) m='Elige el tipo de movimiento';
  else if(td&&!_MTF.dest) m='Elige la sede destino';
  else if(!_MTF.lineas.length) m='Agrega al menos un producto';
  else if(_MTF.lineas.some(function(l){ return l.c<=0; })) m='Hay productos sin cantidad';
  else{ ok=true; m=_MTF.lineas.length+' producto(s) · '+fmt(tot)+' und.'+(exceso?' · '+exceso+' superan el stock':''); }
  var msg=_mtEl('mt-msg'); msg.textContent=m; msg.className='en2-msg'+(exceso?' err':'');
  var btn=_mtEl('btn-mt-save'); if(!btn.dataset.ocupado) btn.disabled=!ok;
}

function _mtReset(){
  _MTF.tipo=''; _MTF.motivo=''; _MTF.dest=''; _MTF.sel=null; _MTF.lineas=[]; _MTF.edit=false; _MTF.res=[];
  document.querySelectorAll('.mt3-tp').forEach(function(b){ b.classList.remove('on'); });
  _mtEl('mt-b-motivo').classList.add('mt3-oculto'); _mtEl('mt-b-destino').classList.add('mt3-oculto');
  ['mt-motivo','mt-q','mt-cant','mt-obs','mt-nro-factura','mt-fecha-retiro'].forEach(function(id){ _mtEl(id).value=''; });
  var f=_mtEl('mt-fecha'); f.value=_mtFechaHoy(); f.max=f.value; f.disabled=false;
  _mtEl('mt-ext').open=false;
  _mtEl('mt-add').classList.remove('mt3-oculto'); _mtEl('mt-info').classList.remove('on');
  _mtEl('mt-row').value='';
  _mtEl('mt-btn-limpiar').style.display='';
  var btn=_mtEl('btn-mt-save'); delete btn.dataset.ocupado; btn.textContent='Guardar movimiento';
  _mtEl('fs-mt-title').textContent='Registrar M-T';
  mtInfo(); mtPintar();
}
function mtLimpiar(){ _mtReset(); }

function _mtCargarDestinos(){
  if(_MTF.destinos) return;
  google.script.run.withSuccessHandler(function(r){
    if(!r.ok) return;
    _MTF.destinos=r.data; _mtDestinos();
  }).getSedesDestino(S.token);
}

function abrirNuevoMT(){
  _mtEnganchar(); _mtReset(); _mtCargarDestinos();
  openFS('fs-mt');
}

function guardarMT(){
  var rowNum=_mtEl('mt-row').value, btn=_mtEl('btn-mt-save');
  if(!_MTF.tipo||!_MTF.lineas.length){ showToast('Completa el tipo y al menos un producto','err'); return; }
  var obs=_mtEl('mt-obs').value.trim();
  if(_MTF.dest) obs='Destino: '+_MTF.dest+(obs?' · '+obs:'');
  var comun={tipo:_MTF.tipo,motivo:_MTF.motivo,obs:obs,fecha:_mtEl('mt-fecha').value,
    nroFactura:_mtEl('mt-nro-factura').value.trim(),fechaRetiro:_mtEl('mt-fecha-retiro').value};
  var restaurar=function(){ delete btn.dataset.ocupado; btn.textContent=rowNum?'Guardar cambios':'Guardar movimiento'; mtPintar(true); };
  var enviar=function(){
    btn.dataset.ocupado='1'; btn.disabled=true; btn.textContent='Guardando...';
    var onErr=function(e){ restaurar(); showToast(e.message,'err'); };
    var onOk=function(r){
      restaurar();
      if(!r.ok){ showToast(r.error,'err'); return; }
      onSaved(r,'fs-mt','mt',null,'');
      _mtReset();
    };
    if(rowNum){
      var l=_MTF.lineas[0];
      google.script.run.withSuccessHandler(onOk).withFailureHandler(onErr).editarMT(S.token,Number(rowNum),
        {tipo:comun.tipo,sku:l.sku,desc:l.d,cant:l.c,motivo:comun.motivo,obs:comun.obs,nroFactura:comun.nroFactura,fechaRetiro:comun.fechaRetiro});
    } else {
      google.script.run.withSuccessHandler(onOk).withFailureHandler(onErr).registrarMTMultiple(S.token,comun,
        _MTF.lineas.map(function(l){ return {sku:l.sku,desc:l.d,cant:l.c}; }));
    }
  };
  var ex=_mtExceso();
  if(ex.length){
    _confirmDialog('Superas el stock','Estos productos tienen menos stock que lo que registras y quedarían en negativo:\n\n'+
      ex.map(function(l){ return l.sku+' · pide '+fmt(l.c)+', hay '+fmt(l.s); }).join('\n')+'\n\n¿Guardar de todos modos?',enviar,'Guardar');
  } else enviar();
}

function editarMTRow(rowNum){
  var r=(window._MT_ROWS||{})[rowNum];
  if(!r){showToast('Error: no se encontró el registro','err');return;}
  _mtEnganchar(); _mtReset();
  _MTF.edit=true;
  _mtEl('mt-row').value=rowNum;
  _MTF.lineas=[{sku:r.sku||'',d:r.desc||'',s:Infinity,c:Number(r.cant)||0}];
  _MTF.motivo=r.motivo||''; _mtEl('mt-motivo').value=_MTF.motivo;
  _mtEl('mt-obs').value=r.obs||'';
  _mtEl('mt-nro-factura').value=r.nroFactura||'';
  var frVal='';
  if(r.fechaRetiro){var parts=r.fechaRetiro.split('/');if(parts.length===3) frVal=parts[2]+'-'+parts[1]+'-'+parts[0];}
  _mtEl('mt-fecha-retiro').value=frVal;
  _mtEl('mt-ext').open=!!(r.nroFactura||frVal);
  var fp=(r.fecha||'').split('/'), fe=_mtEl('mt-fecha');
  fe.value=fp.length===3?fp[2]+'-'+fp[1]+'-'+fp[0]:''; fe.disabled=true;   // la fecha del movimiento no se edita aquí
  _mtEl('mt-add').classList.add('mt3-oculto');
  _mtEl('mt-btn-limpiar').style.display='none';
  _mtEl('fs-mt-title').textContent='Editar M-T';
  _mtEl('btn-mt-save').textContent='Guardar cambios';
  mtTipo(r.tipo||'',true);
  openFS('fs-mt');
}

function eliminarMTRow(rowNum){
  _confirmDialog('Eliminar registro','Se eliminará este movimiento. Esta acción no se puede deshacer.',function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!r.ok){showToast(r.error,'err');return;}
        showToast('Eliminado','ok');
        reloadPage('mt');
      })
      .withFailureHandler(function(e){showToast(e.message,'err');})
      .eliminarMT(S.token,rowNum);
  },'Eliminar');
}

/* ── HELPER FILTRADO COMPARTIDO — usado por _filterXxx y exportXxx ──
   Evita duplicar la misma lógica de filtro en cada función de exportación. */
function _getFilteredRows(name) {
  if (name === 'stock') {
    var q   = ((document.getElementById('stock-busq')||{}).value||'').toLowerCase();
    var cat = ((document.getElementById('stock-cat') ||{}).value||'');
    var mar = ((document.getElementById('stock-mar') ||{}).value||'');
    return DATA.stock.filter(function(r) {
      return (!q  || r.sku.toLowerCase().indexOf(q)>-1 || r.desc.toLowerCase().indexOf(q)>-1) &&
             (!cat || r.categoria===cat) && (!mar || r.marca===mar);
    });
  }
  if (name === 'salidas') {
    var base = _salBase();
    return _SAL_EST ? base.filter(function(r){return _salEstadoLinea(r)===_SAL_EST;}) : base;
  }
  if (name === 'entradas') {
    var q = ((document.getElementById('ent-busq')||{}).value||'').toLowerCase();
    var rows = DATA.entradas.filter(function(r){
      return !q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||r.factura.toLowerCase().indexOf(q)>-1;
    });
    return _applyFiltroFecha('ent', rows).sort(function(a,b){return b._row-a._row;});
  }
  if (name === 'mt') {
    return _mtFiltrados();
  }
  if (name === 'cancelados') {
    var q = ((document.getElementById('canc-busq')||{}).value||'').toLowerCase();
    var rows = (DATA.cancelados||[]).filter(function(r){
      return !q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1||r.nroPedido.toLowerCase().indexOf(q)>-1;
    });
    return _applyFiltroFecha('canc', rows).sort(function(a,b){return b._row-a._row;});
  }
  if (name === 'conteo') {
    var q = ((document.getElementById('cnt-busq')||{}).value||'').toLowerCase();
    var rows = (DATA.conteo||[]).filter(function(r){
      return !q||r.sku.toLowerCase().indexOf(q)>-1||r.producto.toLowerCase().indexOf(q)>-1||r.ean.toLowerCase().indexOf(q)>-1;
    });
    return _applyFiltroFecha('cnt', rows);
  }
  return [];
}
