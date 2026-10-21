/* Maestro Bees (descripción del pedido -> SKU) — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   MAESTRO — descripción del pedido -> SKU y unidades por pack
   (si un producto no está aquí, la salida entra como "SIN SKU")
══════════════════════════════════════ */
var MAESTRO={data:[],prod:{},lista:[],sinSku:[],vista:[]};
var _MAE_EDIT=null;   // descripción original de la fila que se edita (null = nueva)
var _MAE_AP=null;     // estado del diálogo "Actualizar salidas"

function loadMaestro(){
  if(!S||!S.token){errBox('maestro-root','Sin sesión activa. Recarga la página.','maestro');PAGE_LOADING['maestro']=false;return;}
  var t=(REQ_TOKEN.maestro=(REQ_TOKEN.maestro||0)+1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t!==REQ_TOKEN.maestro) return;
      PAGE_LOADING['maestro']=false;
      renderMaestro(r);
    })
    .withFailureHandler(function(e){
      if(t!==REQ_TOKEN.maestro) return;
      PAGE_LOADING['maestro']=false;errBox('maestro-root',e.message,'maestro');
    })
    .getMaestroMBEES(S.token);
}

function renderMaestro(r){
  if(_handleExpired(r,'maestro-root')) return;
  if(!r||!r.ok){errBox('maestro-root',r&&r.error?r.error:'Error al cargar el maestro','maestro');return;}
  MAESTRO.data=r.data;
  DATA.maestro=r.data;
  MAESTRO.prod={};
  (r.productos||[]).forEach(function(p){ MAESTRO.prod[p.sku]=p.desc; });
  MAESTRO.lista=(r.productos||[]).map(function(p){ return {sku:p.sku,desc:p.desc,n:_maeNorm(p.sku+' '+p.desc)}; });
  MAESTRO.sinSku=(r.sinSku||[]).sort(function(a,b){return b.filas-a.filas;});

  var enMaestro={};
  MAESTRO.data.forEach(function(m){ enMaestro[m.descripcion]=true; });
  var filasSin=MAESTRO.sinSku.reduce(function(a,x){return a+x.filas;},0);
  var fueraStock=MAESTRO.data.filter(function(m){return m.sku && !MAESTRO.prod[m.sku];}).length;
  var ico='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  var panel='';
  if(MAESTRO.sinSku.length){
    panel='<div style="background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:var(--r);padding:12px 14px;margin-bottom:16px">'+
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">'+
        '<div style="font-size:13px;font-weight:700;color:var(--warn)">'+ICO('warn',14)+filasSin+' salida'+(filasSin===1?'':'s')+' SIN SKU ('+MAESTRO.sinSku.length+' producto'+(MAESTRO.sinSku.length===1?'':'s')+' distinto'+(MAESTRO.sinSku.length===1?'':'s')+')</div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:6px">'+
      MAESTRO.sinSku.map(function(x,i){
        var ya=enMaestro[x.descripcion];
        return '<div style="display:flex;align-items:center;gap:10px;font-size:12.5px">'+
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(x.descripcion)+'">'+esc(x.descripcion)+'</span>'+
          '<span class="mono" style="color:var(--text3)">'+x.filas+' fila'+(x.filas===1?'':'s')+' · '+fmt(x.packs)+' pack</span>'+
          (ya
            ? '<button class="btn btn-ghost btn-sm" onclick="maestroAplicarSinSku('+i+')">Ya está en el maestro: aplicar</button>'
            : '<button class="btn btn-primary btn-sm" onclick="maestroAsignar('+i+')">Asignar SKU</button>')+
        '</div>';
      }).join('')+
      '</div>'+
    '</div>';
  }

  document.getElementById('maestro-root').innerHTML=
    panel+
    '<div class="stats">'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">Productos en el maestro</div><div class="stat-val-row"><div class="stat-val" id="mae-stat-total">'+MAESTRO.data.length+'</div><span class="stat-unit-pill">filas</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">Salidas SIN SKU</div><div class="stat-val-row"><div class="stat-val" style="color:'+(filasSin?'var(--warn)':'var(--ok,inherit)')+'">'+filasSin+'</div><span class="stat-unit-pill">filas</span></div></div>'+
      '<div class="stat-card"><div class="stat-ico">'+ico+'</div><div class="stat-label">SKU que no están en Stock</div><div class="stat-val-row"><div class="stat-val" style="color:'+(fueraStock?'var(--warn)':'inherit')+'">'+fueraStock+'</div><span class="stat-unit-pill">filas</span></div></div>'+
    '</div>'+
    '<div class="filters" style="flex-wrap:wrap;gap:8px;align-items:center">'+
      '<input class="filter-inp" id="mae-busq" placeholder="Buscar descripción o SKU..." style="width:280px" oninput="filterMaestro()"/>'+
      '<span class="result-count" id="mae-count"></span>'+
    '</div>'+
    '<div class="table-wrap"><table>'+
      '<thead><tr><th>Descripción del pedido</th><th>SKU</th><th>Producto del SKU (Stock)</th><th class="r">Und. por pack</th><th class="c">Acciones</th></tr></thead>'+
      '<tbody id="maestro-tbody"></tbody>'+
    '</table></div>';
  filterMaestro();
}

function filterMaestro(){
  var q=((document.getElementById('mae-busq')||{}).value||'').toLowerCase().trim();
  var rows=MAESTRO.data.filter(function(m){
    return !q||m.descripcion.toLowerCase().indexOf(q)>-1||m.sku.toLowerCase().indexOf(q)>-1;
  });
  var MAX=500, total=rows.length;
  if(rows.length>MAX) rows=rows.slice(0,MAX);
  MAESTRO.vista=rows;
  var el=document.getElementById('mae-count');
  if(el) el.textContent=total>MAX ? ('Mostrando '+MAX+' de '+total+' — usa el buscador') : (total+' registros');
  var html=rows.map(function(m,i){
    var nombre=MAESTRO.prod[m.sku];
    var celdaProd=nombre
      ? '<span title="'+esc(nombre)+'">'+esc(nombre)+'</span>'
      : '<span style="color:var(--warn)" title="Este SKU no existe en el Stock de la sede">'+ICO('warn',12)+'SKU no está en Stock</span>';
    return '<tr>'+
      '<td class="td-desc" title="'+esc(m.descripcion)+'">'+esc(m.descripcion)+'</td>'+
      '<td class="mono" style="font-weight:600">'+esc(m.sku||'—')+'</td>'+
      '<td class="td-desc" style="font-size:12px;color:var(--text3)">'+celdaProd+'</td>'+
      '<td class="r">'+fmt(m.factor)+'</td>'+
      '<td class="c" style="white-space:nowrap">'+
        '<button class="btn btn-ghost btn-sm" onclick="abrirMaestroForm('+i+')">Editar</button> '+
        '<button class="btn btn-ghost btn-sm" title="Revisar las salidas de este producto contra el maestro" onclick="maestroRevalidar('+i+')">Revalidar</button> '+
        '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="eliminarMaestro('+i+')">Eliminar</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  var t=document.getElementById('maestro-tbody');
  if(t) t.innerHTML=html||'<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:40px">Sin resultados</td></tr>';
}

/* idx = posición en la vista filtrada; null = nuevo; prefill = descripción sugerida para un nuevo */
function abrirMaestroForm(idx,prefill){
  var m=(idx===null||idx===undefined)?null:MAESTRO.vista[idx];
  _MAE_EDIT=m?m.descripcion:null;
  document.getElementById('fs-maestro-title').textContent=m?'Editar maestro':'Agregar al maestro';
  document.getElementById('mae-desc').value=m?m.descripcion:(prefill||'');
  document.getElementById('mae-sku').value=m?m.sku:'';
  document.getElementById('mae-factor').value=m?m.factor:1;
  document.getElementById('mae-err').textContent='';
  document.getElementById('mae-buscar').value='';
  document.getElementById('ac-mae').classList.remove('open');
  maestroSkuCambio();
  maestroSugerir(m?'':(prefill||''));
  openFS('fs-maestro');
  setTimeout(function(){document.getElementById(m?'mae-sku':(prefill?'mae-buscar':'mae-desc')).focus();},120);
}
function maestroAsignar(i){ abrirMaestroForm(null,MAESTRO.sinSku[i].descripcion); }

function _maeNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }

/* Búsqueda por lo que escribe el usuario: todas las palabras deben estar en el SKU o nombre */
function maestroBuscar(){
  var list=document.getElementById('ac-mae');
  var q=_maeNorm(document.getElementById('mae-buscar').value).split(/[^a-z0-9]+/).filter(Boolean);
  if(!q.length){list.classList.remove('open');return;}
  var res=MAESTRO.lista.filter(function(p){return q.every(function(t){return p.n.indexOf(t)>-1;});}).slice(0,30);
  if(!res.length){
    list.innerHTML='<div class="ac-item" style="color:var(--text3);cursor:default">Sin resultados en el Stock de la sede</div>';
  } else {
    list.innerHTML=res.map(function(p){
      return '<div class="ac-item" data-sku="'+esc(p.sku)+'" onclick="maestroElegir(this.dataset.sku)"><div class="ac-sku">'+esc(p.sku)+'</div><div class="ac-desc">'+esc(p.desc)+'</div></div>';
    }).join('');
  }
  list.classList.add('open');
}

/* Sugerencias automáticas: productos del Stock que comparten palabras con la descripción del pedido */
function maestroSugerir(desc){
  var box=document.getElementById('mae-sugs');
  var stop={und:1,con:1,sin:1,del:1,los:1,las:1,pack:1};
  var toks=_maeNorm(desc).split(/[^a-z0-9]+/).filter(function(t){return t.length>=2&&!stop[t];});
  toks=toks.filter(function(t,i){return toks.indexOf(t)===i;});
  if(!toks.length){box.innerHTML='';return;}
  var min=toks.length>=3?2:1;
  var res=MAESTRO.lista.map(function(p){
    var sc=0; toks.forEach(function(t){ if(p.n.indexOf(t)>-1) sc++; });
    return {p:p,sc:sc};
  }).filter(function(x){return x.sc>=min;}).sort(function(a,b){return b.sc-a.sc;}).slice(0,6);
  if(!res.length){box.innerHTML='<div style="font-size:12px;color:var(--text3)">No hay sugerencias: busca el producto arriba por nombre o SKU.</div>';return;}
  box.innerHTML='<div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Sugerencias del Stock (clic para elegir)</div>'+
    res.map(function(x){
      return '<div class="ac-item" style="border:1px solid var(--border);border-radius:8px;margin-bottom:4px" data-sku="'+esc(x.p.sku)+'" onclick="maestroElegir(this.dataset.sku)"><div class="ac-sku">'+esc(x.p.sku)+'</div><div class="ac-desc">'+esc(x.p.desc)+'</div></div>';
    }).join('');
}

function maestroElegir(sku){
  document.getElementById('mae-sku').value=sku;
  document.getElementById('ac-mae').classList.remove('open');
  document.getElementById('mae-buscar').value='';
  document.getElementById('mae-sugs').innerHTML='';
  maestroSkuCambio();
  document.getElementById('mae-factor').focus();
  document.getElementById('mae-factor').select();
}

function maestroSkuCambio(){
  var sku=(document.getElementById('mae-sku').value||'').trim();
  var el=document.getElementById('mae-sku-info');
  var fi=document.getElementById('mae-factor-info');
  var otros=MAESTRO.data.filter(function(m){return sku&&m.sku===sku;}).map(function(m){return m.factor;});
  otros=otros.filter(function(f,i){return otros.indexOf(f)===i;});
  fi.textContent=otros.length?('En el maestro, este SKU también se usa con: '+otros.join(', ')+' und. por pack'):'';
  if(!sku){el.innerHTML='';return;}
  var n=MAESTRO.prod[sku];
  el.innerHTML=n
    ? '<span style="color:var(--text3)">'+ICO('right',12)+''+esc(n)+'</span>'
    : '<span style="color:var(--warn)">'+ICO('warn',13)+'Este SKU no está en el Stock de la sede. Puedes guardarlo, pero la salida no aparecerá en Stock hasta crearlo con "Nuevo SKU".</span>';
}

function guardarMaestro(){
  var desc=(document.getElementById('mae-desc').value||'').trim();
  var sku =(document.getElementById('mae-sku').value ||'').trim();
  var fac =parseInt(document.getElementById('mae-factor').value,10);
  var err =document.getElementById('mae-err');
  if(!desc){err.textContent='La descripción es obligatoria';return;}
  if(!sku){err.textContent='El SKU es obligatorio';return;}
  if(!(fac>=1)){err.textContent='Las unidades por pack deben ser 1 o más';return;}
  err.textContent='';
  var btn=document.getElementById('btn-mae-save');
  btn.disabled=true;btn.textContent='Guardando...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false;btn.textContent='Guardar';
      if(!r.ok){err.textContent=r.error;return;}
      closeFS('fs-maestro');
      showToast('Maestro actualizado','ok');
      loadMaestro();
      _maePreguntarAplicar(desc,{sku:sku,factor:fac});
    })
    .withFailureHandler(function(e){btn.disabled=false;btn.textContent='Guardar';err.textContent=e.message;})
    .guardarMBEES(S.token,{descripcionOriginal:_MAE_EDIT,descripcion:desc,sku:sku,factor:fac});
}

function eliminarMaestro(i){
  var m=MAESTRO.vista[i]; if(!m) return;
  _confirmDialog('Eliminar del maestro',
    '"'+m.descripcion+'" se quitará del maestro. Las salidas ya registradas no cambian; los próximos pedidos con esta descripción entrarán como SIN SKU.',
    function(){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r.ok){showToast(r.error||'No se pudo eliminar','err');return;}
          showToast('Eliminado del maestro','ok');
          loadMaestro();
        })
        .withFailureHandler(function(e){showToast(e.message,'err');})
        .eliminarMBEES(S.token,m.descripcion);
    },'Eliminar');
}

/* ── Actualizar salidas ya registradas con lo que dice el maestro ── */
function maestroAplicarSinSku(i){ _maePreguntarAplicar(MAESTRO.sinSku[i].descripcion,null,true); }
function maestroRevalidar(i){ var m=MAESTRO.vista[i]; if(m) _maePreguntarAplicar(m.descripcion,null,true); }

function _maeHoyISO(){
  var d=new Date(), p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  return p;
}
function _maeSumarDias(iso,n){
  var d=new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10);
}
/* Ventanas de fechas para revalidar salidas que ya tienen SKU pero no coinciden con el maestro */
var _MAE_VENTANAS=[
  {k:'hoy', etq:'Solo hoy',          dias:0,    c:'d_hoy'},
  {k:'7',   etq:'Últimos 7 días',    dias:6,    c:'d_7'},
  {k:'30',  etq:'Últimos 30 días',   dias:29,   c:'d_30'},
  {k:'todo',etq:'Todo el historial', dias:null, c:'d_todo'}
];
function _maeVentana(k){ return _MAE_VENTANAS.filter(function(x){return x.k===k;})[0]||null; }

/* forzar = abrir el diálogo aunque no haya nada pendiente (botón "Revalidar") */
function _maePreguntarAplicar(desc,valores,forzar){
  _MAE_AP={desc:desc,ventana:'ninguna',sin:0,w:{},m:valores||null};
  _maeContar(function(){
    var a=_MAE_AP;
    if(desc!==null && !forzar && !a.sin && !a.w.d_30) return; // nada relevante: no molestar
    // Preselección: la ventana más corta que cubra todo lo que no coincide en los últimos 30 días
    if(a.w.d_30>0){
      var v=_MAE_VENTANAS.filter(function(x){return x.k!=='todo' && a.w[x.c]===a.w.d_30;})[0];
      if(v) a.ventana=v.k;
    }
    _maeDibujarAplicar();
    document.getElementById('modal-aplicar').style.display='flex';
  });
}
function _maeContar(cb){
  var a=_MAE_AP;
  google.script.run
    .withSuccessHandler(function(r){
      if(!r||!r.ok){showToast((r&&r.error)||'No se pudo revisar las salidas','err');return;}
      a.sin=r.sin_sku; a.w={d_hoy:r.d_hoy,d_7:r.d_7,d_30:r.d_30,d_todo:r.d_todo};
      if(cb) cb();
    })
    .withFailureHandler(function(e){showToast(e.message,'err');})
    .aplicarMaestro(S.token,{descripcion:a.desc,incluirConSku:false,ejecutar:false});
}
function _maeCambioVentana(k){ _MAE_AP.ventana=k; _maeDibujarAplicar(); }
function _maeDibujarAplicar(){
  var a=_MAE_AP, v=_maeVentana(a.ventana);
  var nDist=v?a.w[v.c]:0, k=a.sin+nDist;
  var m=a.m||(a.desc?MAESTRO.data.filter(function(x){return x.descripcion===a.desc;})[0]:null);
  var html='';
  if(a.desc) html+='<div style="font-size:12.5px;color:var(--text2)"><b>'+esc(a.desc)+'</b>'+(m?'<br><span class="mono">SKU '+esc(m.sku)+' · '+fmt(m.factor)+' und. por pack</span>':'')+'</div>';
  else html+='<div style="font-size:12.5px;color:var(--text2)">Se revisarán todas las salidas con el maestro actual.</div>';
  if(a.sin){
    html+='<div style="font-size:13px">Hay <b>'+a.sin+'</b> salida'+(a.sin===1?'':'s')+' que quedó'+(a.sin===1?'':'ron')+' <b>SIN SKU</b>'+(a.desc?' con esta descripción':'')+' (de cualquier fecha). Se les pondrá el SKU del maestro y las unidades se calcularán (packs × unidades por pack).</div>';
  } else if(!a.w.d_todo){
    html+='<div style="font-size:13px">Todo está al día: las salidas coinciden con el maestro.</div>';
  } else {
    html+='<div style="font-size:13px">No hay salidas SIN SKU para actualizar.</div>';
  }
  if(a.w.d_todo>0){
    html+='<div style="border-top:1px solid var(--border);padding-top:10px;font-size:12.5px;color:var(--text2)">'+
      '<b>Revalidar:</b> hay salidas que ya tienen SKU pero con un SKU o unas unidades <b>distintas a las del maestro</b> (packs × unidades por pack). Elige hasta qué fecha corregirlas:'+
      '<select class="inp" id="mae-ap-vent" onchange="_maeCambioVentana(this.value)" style="margin-top:8px;width:100%">'+
        '<option value="ninguna"'+(a.ventana==='ninguna'?' selected':'')+'>No corregir</option>'+
        _MAE_VENTANAS.map(function(x){
          return '<option value="'+x.k+'"'+(a.ventana===x.k?' selected':'')+'>'+x.etq+' ('+a.w[x.c]+' salida'+(a.w[x.c]===1?'':'s')+')</option>';
        }).join('')+
      '</select>'+
      '<div style="font-size:11.5px;color:var(--text3);margin-top:6px">Las filas que editaste a mano con el botón "SKU" no se modifican.</div>'+
    '</div>';
  }
  document.getElementById('modal-aplicar-body').innerHTML=html;
  var ok=document.getElementById('modal-aplicar-ok');
  ok.disabled=!k;
  ok.textContent=k?('Actualizar '+k+' salida'+(k===1?'':'s')):'Nada que actualizar';
}
function _maeAplicarCancelar(){ document.getElementById('modal-aplicar').style.display='none'; _MAE_AP=null; }
function _maeAplicarOk(){
  var a=_MAE_AP; if(!a) return;
  var v=_maeVentana(a.ventana);
  var desde=v?(v.dias===null?'1900-01-01':_maeSumarDias(_maeHoyISO(),-v.dias)):null;
  var ok=document.getElementById('modal-aplicar-ok');
  ok.disabled=true; ok.textContent='Actualizando...';
  google.script.run
    .withSuccessHandler(function(r){
      _maeAplicarCancelar();
      if(!r||!r.ok){showToast((r&&r.error)||'No se pudo actualizar','err');return;}
      showToast(r.actualizadas+' salida'+(r.actualizadas===1?'':'s')+' actualizada'+(r.actualizadas===1?'':'s'),'ok');
      PAGE_LOADED['salidas']=false; PAGE_LOADED['stock']=false;
      loadMaestro();
    })
    .withFailureHandler(function(e){_maeAplicarCancelar();showToast(e.message,'err');})
    .aplicarMaestro(S.token,{descripcion:a.desc,incluirConSku:!!v,desde:desde,ejecutar:true});
}

function exportMaestro(){
  _exportXLSX(
    ['Descripción','SKU','Producto del SKU','Und. por pack'],
    MAESTRO.data,
    function(m){return[m.descripcion,m.sku,MAESTRO.prod[m.sku]||'',m.factor];},
    'Maestro','maestro'
  );
}
