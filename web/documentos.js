/* ══════════════════════════════════════════════════════════════
   DOCUMENTOS DE DESPACHO — Marcaje (conciliación de envases), Orden de NC y Traslado.
   Se llenan a mano, se guardan en el historial y se imprimen para firma.
   Marcaje alimenta Envases (entrada / devolución) y la NC alimenta M-T (pendiente, factura en Motivo).
   ══════════════════════════════════════════════════════════════ */

/* Envases del Marcaje, en el orden del formato impreso. cz = color del texto en el papel;
   main = botella que se completa sola al escribir las cajas (cajas × botellas por caja). */
var DCX_GR0 = [
  { g:'6xx · 630 / 650 ML', tam:630, mult:12, rows:[
    { sku:3500192, code:'CJPL620/650',   ref:'Caja 6xx',              cz:'b', caja:1 },
    { sku:3500323, code:'BOTVER630CV',   ref:'Botella Pilsen 6xx',    cz:'g', main:1 },
    { sku:3500179, code:'BOTAMB650CV',   ref:'Botellas Cristal',      cz:'' },
    { sku:3500178, code:'BOTINKA620CV',  ref:'Botellas Cusqueña',     cz:'p' } ] },
  { g:'1 LITRO · 1000 ML', tam:1000, mult:12, rows:[
    { sku:3500193, code:'CJPL1100',      ref:'Caja 1 litro',          cz:'b', caja:1 },
    { sku:3500381, code:'BOTVER1000CV',  ref:'Botella litro',         cz:'',  main:1 } ] },
  { g:'3xx · 305 / 310 ML', tam:310, mult:24, rows:[
    { sku:3500240, code:'CJPL330',       ref:'Caja 3xx',              cz:'b', caja:1 },
    { sku:3502226, code:'BOTAMB305R',    ref:'Botella 305',           cz:'',  main:1 },
    { sku:3501495, code:'BOTVRDPC310R',  ref:'Botellas Pilsen 3xx',   cz:'g' },
    { sku:3501491, code:'BOTAMCUS310R',  ref:'Botellas Cusqueña 3xx', cz:'p' } ] }
];
var DCX_PRECIO0 = { caja:3.8, bot630_1000:0.6, bot310:0.5 };
var DCX_TIT = { marcaje:'Conciliación de envases', nc:'Orden para nota de crédito', traslado:'Cargo de despacho' };
var DCX_DESTINOS = ['TADA EVENTOS','ATE','CHORRILLOS','SAN MIGUEL','OTRO'];

var DCX = {
  d:null, tab:'mar', busy:false,
  h:{ reparto:'', transporte:'', placa:'', fecha:'' },
  hi:'', hf:'', env:true, gr:null,
  nc:{ fac:'', lineas:[] },
  tr:{ destino:'TADA EVENTOS', obs:'', lineas:[] },
  res:{ nc:[], tr:[] }, tm:{},
  hist:[], filtro:'', q:'', edit:null
};

/* ── utilidades ── */
function _dcNum(v){
  var s=String(v==null?'':v).trim(); if(!s) return 0;
  if(/^[0-9+\s]+$/.test(s)) return s.split('+').reduce(function(a,x){ return a+(parseInt(x,10)||0); },0);
  return parseInt(s,10)||0;
}
function _dcF(iso){ return iso ? String(iso).slice(8,10)+'/'+String(iso).slice(5,7)+'/'+String(iso).slice(0,4) : ''; }
function _dcMoney(n){ return 'S/ '+Number(n||0).toFixed(2); }
function _dcHms(v){ v=String(v||''); return v.length===5 ? v+':00' : v; }
function _dcSede(){ return String((DCX.d&&DCX.d.sede)||'').toUpperCase(); }
function _dcGrNuevo(){
  return DCX_GR0.map(function(g){ return { g:g.g, tam:g.tam, mult:g.mult, rows:g.rows.map(function(r){
    return { sku:r.sku, code:r.code, ref:r.ref, cz:r.cz, caja:r.caja, main:r.main, ent:0, dev:0 }; }) }; });
}
function _dcPrecio(g,r){
  var p=(DCX.d&&DCX.d.precios)||{};
  var v=r.caja ? p.caja : (g.tam===310 ? p.bot310 : p.bot630_1000);
  if(v==null||isNaN(v)) v=r.caja ? DCX_PRECIO0.caja : (g.tam===310 ? DCX_PRECIO0.bot310 : DCX_PRECIO0.bot630_1000);
  return v;
}

/* ── carga ── */
function loadDocumentos(){
  if(!S||!S.token){ errBox('documentos-root','Sin sesión activa. Recarga la página.','documentos'); PAGE_LOADING['documentos']=false; return; }
  var t=(REQ_TOKEN.documentos=(REQ_TOKEN.documentos||0)+1);
  google.script.run
    .withSuccessHandler(function(r){
      if(t!==REQ_TOKEN.documentos) return;
      PAGE_LOADING['documentos']=false;
      if(_handleExpired(r,'documentos-root')) return;
      if(!r||!r.ok){ errBox('documentos-root',r&&r.error?r.error:'Error al cargar los documentos','documentos'); return; }
      DCX.d=r; DCX.hist=r.docs||[];
      if(!DCX.h.fecha) DCX.h.fecha=r.hoy;
      if(!DCX.gr) DCX.gr=_dcGrNuevo();
      renderDocumentos();
    })
    .withFailureHandler(function(e){
      if(t!==REQ_TOKEN.documentos) return;
      PAGE_LOADING['documentos']=false; errBox('documentos-root',e.message,'documentos');
    })
    .getDocumentos(S.token);
}

/* ── pantalla ── */
function renderDocumentos(){
  var root=document.getElementById('documentos-root'); if(!root||!DCX.d) return;
  var tabs=[['mar','Marcaje','<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'],
            ['nc','Orden de NC','<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14h6M9 18h6"/>'],
            ['tr','Traslado','<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>'],
            ['his','Historial','<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/>']];
  root.innerHTML=
    '<div class="dc-wrap">'+
      '<div class="dc-top"><span class="dc-chip"><i></i>'+esc(DCX.d.sede)+'</span><span class="dc-sub">Se llenan a mano, se guardan en el historial y se imprimen para firma.</span></div>'+
      _dcBannerEdit()+
      (DCX.tab==='his'?'':_dcCabecera())+
      '<div class="dc-tabs">'+tabs.map(function(t){
        return '<button class="dc-tab'+(DCX.tab===t[0]?' on':'')+'" onclick="dcTab(\''+t[0]+'\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+t[2]+'</svg>'+t[1]+'</button>';
      }).join('')+'</div>'+
      '<div id="dc-body"></div>'+
    '</div>';
  _dcCuerpo();
}
function dcTab(t){
  if(DCX.edit && DCX.edit.tab!==t) dcCancelarEdicion(true);
  DCX.tab=t; renderDocumentos();
}

function _dcCabecera(){
  var tr=DCX.tab==='tr';
  return '<div class="dc-card dc-cab"><div class="dc-h"><span class="t">'+(tr?'Datos del traslado':'Datos del reparto')+'</span>'+
    '<span class="s">'+(tr?'':'se usan en Marcaje y en la orden de NC')+'</span></div>'+
    '<div class="dc-g">'+
      (tr?'':'<div class="dc-f"><label>Reparto</label><input class="inp" value="'+esc(DCX.h.reparto)+'" oninput="DCX.h.reparto=this.value"></div>'+
           '<div class="dc-f"><label>Transporte</label><input class="inp" value="'+esc(DCX.h.transporte)+'" oninput="DCX.h.transporte=this.value"></div>')+
      '<div class="dc-f"><label>Placa</label><input class="inp" value="'+esc(DCX.h.placa)+'" oninput="DCX.h.placa=this.value.toUpperCase()" style="text-transform:uppercase"></div>'+
      '<div class="dc-f"><label>Fecha</label><input class="inp" type="date" value="'+esc(DCX.h.fecha)+'" oninput="DCX.h.fecha=this.value"></div>'+
    '</div></div>';
}

function _dcCuerpo(){
  var b=document.getElementById('dc-body'); if(!b) return;
  if(DCX.tab==='mar') b.innerHTML=_dcMarcajeHtml();
  else if(DCX.tab==='nc') b.innerHTML=_dcListaHtml('nc');
  else if(DCX.tab==='tr') b.innerHTML=_dcListaHtml('tr');
  else b.innerHTML=_dcHistHtml();
  if(DCX.tab==='mar') dcCalcM();
  if(DCX.tab==='nc'||DCX.tab==='tr') dcDibujaL(DCX.tab);
  if(DCX.tab==='his') dcHistFiltrar();
}

/* ── Marcaje ── */
function _dcMarcajeHtml(){
  var h='';
  DCX.gr.forEach(function(g,gi){
    h+='<div class="dm-grp">'+g.g+'</div>';
    g.rows.forEach(function(r,ri){
      h+='<div class="dm-r" data-g="'+gi+'" data-r="'+ri+'">'+
        '<div class="dm-n"><b>'+r.ref+(r.caja?' <em class="dm-x">× '+g.mult+'</em>':'')+(r.main?' <em class="dm-a">auto</em>':'')+'</b><small>'+r.sku+' · '+r.code+'</small></div>'+
        '<input class="inp" inputmode="numeric" value="'+(r.ent||'')+'" placeholder="0" data-k="ent" oninput="dcMIn(this)">'+
        '<input class="inp" inputmode="numeric" value="'+(r.dev||'')+'" placeholder="0" data-k="dev" oninput="dcMIn(this)">'+
        '<div class="dm-d" id="dm-d'+gi+'_'+ri+'">0</div><div class="dm-c" id="dm-c'+gi+'_'+ri+'">—</div></div>';
    });
  });
  return '<div class="dc-card"><div class="dc-h"><span class="t">Conciliación de envases</span><span class="s">Entregado (ENT) contra devuelto (DEV). Al escribir las cajas, la botella se completa sola.</span></div>'+
      '<div class="dc-g dc-g2" style="margin-bottom:16px">'+
        '<div class="dc-f"><label>Hora inicio</label><input class="inp" type="time" value="'+esc(DCX.hi)+'" oninput="DCX.hi=this.value"></div>'+
        '<div class="dc-f"><label>Hora fin</label><input class="inp" type="time" value="'+esc(DCX.hf)+'" oninput="DCX.hf=this.value"></div>'+
      '</div>'+
      '<div class="dm-h"><span>Envase</span><span>ENT</span><span>DEV</span><span>Dif.</span><span>Costo</span></div>'+h+'</div>'+
    '<div class="dc-card"><div class="dc-h"><span class="t">Convertidor · cajas llenas</span><span class="s">botellas ÷ botellas por caja, comparado con las cajas contadas</span></div><div class="dm-conv" id="dm-conv"></div></div>'+
    '<div class="dc-card"><div class="dm-tot"><div><div class="k">Diferencia valorizada</div><div class="v" id="dm-tot">S/ 0.00</div></div><span style="flex:1"></span>'+
      '<label class="dm-sw"><input type="checkbox"'+(DCX.env?' checked':'')+' onchange="DCX.env=this.checked">Registrar también en Envases (entrada y devolución)</label></div></div>'+
    _dcBarra('marcaje');
}
function dcMIn(el){
  var r=el.parentNode, gi=r.dataset.g, G=DCX.gr[gi], row=G.rows[r.dataset.r], k=el.dataset.k;
  row[k]=_dcNum(el.value);
  if(row.caja){
    G.rows.forEach(function(x,xi){
      if(!x.main) return;
      x[k]=row[k]*G.mult;
      var inp=document.querySelector('.dm-r[data-g="'+gi+'"][data-r="'+xi+'"] input[data-k="'+k+'"]');
      if(inp) inp.value=x[k]||'';
    });
  }
  dcCalcM();
}
function dcCalcM(){
  var tot=0;
  DCX.gr.forEach(function(g,gi){ g.rows.forEach(function(r,ri){
    var d=(r.ent||0)-(r.dev||0), c=Math.abs(d)*_dcPrecio(g,r); tot+=c;
    var de=document.getElementById('dm-d'+gi+'_'+ri), ce=document.getElementById('dm-c'+gi+'_'+ri);
    if(!de||!ce) return;
    de.textContent=d>0?'+'+d:d; de.className='dm-d '+(d===0?'zero':d>0?'neg':'pos');
    ce.textContent=d===0?'—':_dcMoney(c);
  }); });
  var te=document.getElementById('dm-tot');
  if(te){ te.textContent=_dcMoney(tot); te.className='v '+(tot===0?'zero':'neg'); }
  var h='';
  DCX.gr.forEach(function(g){
    var be=0,bd=0,ce=0,cd=0;
    g.rows.forEach(function(r){ if(r.caja){ ce=r.ent||0; cd=r.dev||0; } else { be+=r.ent||0; bd+=r.dev||0; } });
    if(!be&&!bd&&!ce&&!cd) return;
    var qe=Math.floor(be/g.mult), qd=Math.floor(bd/g.mult), okE=qe===ce, okD=qd===cd;
    h+='<div class="dm-cv"><b>'+g.g.split(' · ')[0]+'</b>Entrega: '+be+' bot. ÷ '+g.mult+' = <span class="'+(okE?'ok':'bad')+'">'+qe+' cajas'+(okE?' ✓':' · contadas '+ce)+'</span><br>'+
      'Devolución: '+bd+' bot. ÷ '+g.mult+' = <span class="'+(okD?'ok':'bad')+'">'+qd+' cajas'+(okD?' ✓':' · contadas '+cd)+'</span></div>';
  });
  var cv=document.getElementById('dm-conv'); if(cv) cv.innerHTML=h||'<div class="dm-cv">Escribe las cantidades para ver el convertidor</div>';
}
/* Movimientos de Envases: ENT = entrada llena, DEV = devolución vacía (cajas = packs; botellas sueltas = unidades) */
function _dcMovs(){
  var out=[];
  DCX.gr.forEach(function(g){
    ['ent','dev'].forEach(function(k){
      var caj=0, bot=0;
      g.rows.forEach(function(r){ if(r.caja) caj=r[k]||0; else bot+=r[k]||0; });
      var und=Math.max(0,bot-caj*g.mult);
      if(caj||und) out.push({ tipo:k==='ent'?'entrada':'devolucion', tamano:g.tam, estado:k==='ent'?'llena':'vacia', packs:caj, unidades:und });
    });
  });
  return out;
}

/* ── NC y Traslado: buscador de productos + cantidades ── */
function _dcListaHtml(w){
  var nc=w==='nc';
  return (nc
    ? '<div class="dc-card"><div class="dc-h"><span class="t">Nota de crédito</span><span class="s">la factura se guarda en M-T, en la columna Motivo</span></div>'+
        '<div class="dc-g dc-g2"><div class="dc-f"><label>Nro. de factura</label><input class="inp" value="'+esc(DCX.nc.fac)+'" placeholder="Ej: F001-000123" oninput="DCX.nc.fac=this.value"></div></div></div>'
    : '<div class="dc-card"><div class="dc-h"><span class="t">Cargo de despacho</span></div><div class="dc-g dc-g3">'+
        '<div class="dc-f"><label>Origen</label><input class="inp" value="'+esc(_dcSede())+'" disabled></div>'+
        '<div class="dc-f"><label>Destino</label><select onchange="DCX.tr.destino=this.value">'+(DCX_DESTINOS.indexOf(DCX.tr.destino)<0?[DCX.tr.destino].concat(DCX_DESTINOS):DCX_DESTINOS).map(function(d){ return '<option'+(d===DCX.tr.destino?' selected':'')+'>'+esc(d)+'</option>'; }).join('')+'</select></div>'+
        '<div class="dc-f"><label>Observaciones</label><input class="inp" value="'+esc(DCX.tr.obs)+'" placeholder="Opcional" oninput="DCX.tr.obs=this.value"></div></div></div>')+
    '<div class="dc-card"><div class="dc-h"><span class="t">'+(nc?'Productos que no dejaron':'Productos')+'</span><span class="s">busca por nombre o SKU y escribe '+(nc?'solo las unidades':'las cantidades')+'</span></div>'+
      '<div class="dc-sr"><input class="inp" id="dc-q-'+w+'" placeholder="Buscar producto: pilsen, guaraná, 10000092…" autocomplete="off" oninput="dcBuscar(\''+w+'\')" onblur="setTimeout(function(){dcCerrarAc(\''+w+'\')},180)"><div class="dc-ac" id="dc-ac-'+w+'"></div></div>'+
      '<div id="dc-ln-'+w+'"></div></div>'+
    _dcBarra(nc?'nc':'traslado');
}
function _dcL(w){ return w==='nc'?DCX.nc.lineas:DCX.tr.lineas; }
function dcBuscar(w){
  clearTimeout(DCX.tm[w]);
  var q=(document.getElementById('dc-q-'+w)||{}).value||'';
  if(q.trim().length<2){ dcCerrarAc(w); return; }
  DCX.tm[w]=setTimeout(function(){
    google.script.run
      .withSuccessHandler(function(r){
        var inp=document.getElementById('dc-q-'+w); if(!inp||inp.value!==q) return;
        var ac=document.getElementById('dc-ac-'+w); if(!ac) return;
        DCX.res[w]=(r&&r.ok)?r.results:[];
        ac.innerHTML=DCX.res[w].length
          ? DCX.res[w].map(function(c,i){ return '<div class="dc-ai" onmousedown="dcAgregar(\''+w+'\','+i+')"><b>'+esc(c.desc)+'</b><small>SKU '+esc(c.sku)+(c.sap?' · SAP '+esc(c.sap):' · sin SAP')+'</small></div>'; }).join('')
          : '<div class="dc-ai" style="cursor:default;color:var(--text3)">Sin resultados</div>';
        ac.classList.add('on');
      })
      .withFailureHandler(function(){ dcCerrarAc(w); })
      .buscarProductoDoc(S.token,q);
  },260);
}
function dcCerrarAc(w){ var ac=document.getElementById('dc-ac-'+w); if(ac) ac.classList.remove('on'); }
function dcAgregar(w,i){
  var c=(DCX.res[w]||[])[i]; if(!c) return;
  var L=_dcL(w), idx=-1;
  L.forEach(function(x,k){ if(x.sku===c.sku) idx=k; });
  if(idx<0){ L.push({ sku:c.sku, sap:c.sap, desc:c.desc, und:0 }); idx=L.length-1; }
  var q=document.getElementById('dc-q-'+w); if(q) q.value='';
  dcCerrarAc(w); dcDibujaL(w);
  var ins=document.querySelectorAll('#dc-ln-'+w+' .inp'); var el=ins[idx];
  if(el){ el.focus(); el.select(); }
}
function dcDibujaL(w){
  var L=_dcL(w), el=document.getElementById('dc-ln-'+w); if(!el) return;
  el.innerHTML=L.length ? L.map(function(x,i){
    return '<div class="dc-ln"><div class="d"><b>'+esc(x.desc)+'</b><small>SKU '+esc(x.sku)+(x.sap?' · SAP '+esc(x.sap):' · sin SAP')+'</small></div>'+
      '<input class="inp" inputmode="numeric" value="'+(x.und||'')+'" placeholder="'+(w==='nc'?'Und':'Pack/U')+'" oninput="dcUnd(\''+w+'\','+i+',this.value)">'+
      '<button class="dc-x" title="Quitar" onclick="dcQuitar(\''+w+'\','+i+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>';
  }).join('') : '<div class="dc-empty">Aún no hay productos. Búscalos arriba.</div>';
}
function dcUnd(w,i,v){ var x=_dcL(w)[i]; if(x) x.und=_dcNum(v); }
function dcQuitar(w,i){ _dcL(w).splice(i,1); dcDibujaL(w); }

/* ── guardar ── */
function dcGuardar(tipo,imprimir){
  if(DCX.busy) return;
  var d={ tipo:tipo, fecha:DCX.h.fecha, placa:DCX.h.placa, reparto:'', transporte:'', horaInicio:'', horaFin:'', nroFactura:'', destino:'', observaciones:'', lineas:[], movs:[] };
  if(tipo==='marcaje'){
    var hay=false;
    DCX.gr.forEach(function(g){ g.rows.forEach(function(r){
      if(r.ent||r.dev) hay=true;
      d.lineas.push({ sku:r.sku, code:r.code, ref:r.ref, cz:r.cz, ent:r.ent||0, dev:r.dev||0 });
    }); });
    if(!hay){ showToast('Escribe al menos una cantidad en ENT o DEV','err'); return; }
    d.reparto=DCX.h.reparto; d.transporte=DCX.h.transporte; d.horaInicio=DCX.hi; d.horaFin=DCX.hf;
    d.movs=DCX.env?_dcMovs():[];
  } else if(tipo==='nc'){
    if(!String(DCX.nc.fac||'').trim()){ showToast('Escribe el nro. de factura','err'); return; }
    d.lineas=DCX.nc.lineas.filter(function(x){ return x.und>0; }).map(function(x){ return { sku:x.sku, sap:x.sap, desc:x.desc, und:x.und }; });
    if(!d.lineas.length){ showToast('Agrega al menos un producto con unidades','err'); return; }
    d.reparto=DCX.h.reparto; d.transporte=DCX.h.transporte; d.nroFactura=String(DCX.nc.fac).trim();
  } else {
    d.lineas=DCX.tr.lineas.filter(function(x){ return x.und>0; }).map(function(x){ return { sku:x.sku, sap:x.sap, desc:x.desc, und:x.und }; });
    if(!d.lineas.length){ showToast('Agrega al menos un producto con cantidad','err'); return; }
    d.destino=DCX.tr.destino; d.observaciones=DCX.tr.obs;
  }
  DCX.busy=true;
  var editando=DCX.edit&&DCX.edit.tipo===tipo ? DCX.edit : null;
  var llamada=google.script.run
    .withSuccessHandler(function(r){
      DCX.busy=false;
      if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo guardar','err'); return; }
      var doc;
      if(editando){
        doc=DCX.hist.filter(function(x){ return x.id===editando.id; })[0];
        if(doc){
          doc.fecha=d.fecha; doc.reparto=d.reparto; doc.transporte=d.transporte; doc.placa=d.placa; doc.horaInicio=d.horaInicio; doc.horaFin=d.horaFin;
          doc.nroFactura=d.nroFactura; doc.destino=d.destino; doc.observaciones=d.observaciones; doc.lineas=d.lineas;
        }
        if(tipo==='marcaje') DCX.d.conEnv[editando.id]=d.movs.length>0;
        DCX.edit=null;
      } else {
        doc={ id:r.id, tipo:tipo, fecha:d.fecha, reparto:d.reparto, transporte:d.transporte, placa:d.placa, horaInicio:d.horaInicio, horaFin:d.horaFin,
          nroFactura:d.nroFactura, destino:d.destino, observaciones:d.observaciones, lineas:d.lineas, usuario:(S&&S.usuario)||'', creado:new Date().toISOString() };
        DCX.hist.unshift(doc);
        if(tipo==='marcaje'&&d.movs.length) DCX.d.conEnv[r.id]=true;
      }
      showToast(editando ? 'Documento actualizado'
        : tipo==='marcaje'?'Marcaje guardado'+(DCX.env&&d.movs.length?' y registrado en Envases':''):tipo==='nc'?'NC guardada y agregada a M-T como pendiente':'Traslado guardado','ok');
      if(tipo==='marcaje') PAGE_LOADED['envases']=false;
      if(tipo==='nc') PAGE_LOADED['mt']=false;
      _dcReset(tipo);
      if(editando){ DCX.h={ reparto:'', transporte:'', placa:'', fecha:DCX.d.hoy }; DCX.tab='his'; }
      renderDocumentos();
      if(imprimir&&doc) dcVer(doc);
    })
    .withFailureHandler(function(e){ DCX.busy=false; showToast(e.message,'err'); });
  if(editando) llamada.actualizarDocumento(S.token,editando.id,d); else llamada.guardarDocumento(S.token,d);
}
/* limpia el formulario del tipo (Reparto, Transporte y Placa se conservan al crear: sirven para la NC del mismo reparto) */
function _dcReset(tipo){
  if(tipo==='marcaje'){ DCX.gr=_dcGrNuevo(); DCX.hi=''; DCX.hf=''; DCX.env=true; }
  if(tipo==='nc') DCX.nc={ fac:'', lineas:[] };
  if(tipo==='traslado'){ DCX.tr.lineas=[]; DCX.tr.obs=''; }
}

/* ── editar un documento del historial ── */
function _dcBannerEdit(){
  var e=DCX.edit; if(!e||e.tab!==DCX.tab) return '';
  return '<div class="dc-edit"><span>Editando <b>'+esc(DCX_TIT[e.tipo])+'</b> N.º '+e.id+' · '+_dcF(e.fecha)+'. Los cambios reemplazan lo guardado'+
    (e.tipo==='marcaje'?' y lo registrado en Envases':e.tipo==='nc'?' y las filas de M-T':'')+'.</span>'+
    '<button class="btn btn-ghost btn-sm" onclick="dcCancelarEdicion()">Cancelar edición</button></div>';
}
function _dcBarra(tipo){
  var ed=DCX.edit&&DCX.edit.tipo===tipo, nc=tipo==='nc';
  return '<div class="dc-bar"><button class="btn btn-ghost" onclick="dcGuardar(\''+tipo+'\',false)">'+
    (ed?'Guardar cambios':nc?'Guardar en M-T como NC pendiente':'Guardar')+'</button>'+
    '<button class="btn btn-primary" onclick="dcGuardar(\''+tipo+'\',true)">'+(ed?'Guardar cambios e imprimir':'Guardar e imprimir')+'</button></div>';
}
function dcEditar(id){
  var d=DCX.hist.filter(function(x){ return x.id===id; })[0]; if(!d) return;
  var tab=d.tipo==='marcaje'?'mar':d.tipo==='nc'?'nc':'tr';
  DCX.edit={ id:d.id, tipo:d.tipo, tab:tab, fecha:d.fecha };
  DCX.h={ reparto:d.reparto, transporte:d.transporte, placa:d.placa, fecha:d.fecha };
  if(d.tipo==='marcaje'){
    DCX.gr=_dcGrNuevo();
    d.lineas.forEach(function(l){ DCX.gr.forEach(function(g){ g.rows.forEach(function(r){ if(r.sku===l.sku){ r.ent=l.ent||0; r.dev=l.dev||0; } }); }); });
    DCX.hi=d.horaInicio; DCX.hf=d.horaFin; DCX.env=!!(DCX.d.conEnv&&DCX.d.conEnv[d.id]);
  } else if(d.tipo==='nc'){
    DCX.nc={ fac:d.nroFactura, lineas:d.lineas.map(function(l){ return { sku:l.sku, sap:l.sap, desc:l.desc, und:l.und }; }) };
  } else {
    DCX.tr={ destino:d.destino||'TADA EVENTOS', obs:d.observaciones, lineas:d.lineas.map(function(l){ return { sku:l.sku, sap:l.sap, desc:l.desc, und:l.und }; }) };
  }
  DCX.tab=tab; renderDocumentos();
  var c=document.getElementById('documentos-root'); if(c&&c.scrollIntoView) c.scrollIntoView({block:'start'});
}
function dcCancelarEdicion(silencioso){
  var e=DCX.edit; if(!e) return;
  DCX.edit=null; _dcReset(e.tipo==='traslado'?'traslado':e.tipo);
  DCX.h={ reparto:'', transporte:'', placa:'', fecha:DCX.d.hoy };
  if(!silencioso){ DCX.tab='his'; renderDocumentos(); }
}
function dcEliminar(id){
  var d=DCX.hist.filter(function(x){ return x.id===id; })[0]; if(!d) return;
  var efecto=d.tipo==='marcaje'?' También se quitan los movimientos que registró en Envases.'
    :d.tipo==='nc'?' También se quitan sus filas pendientes de M-T (las ya retiradas se conservan).':'';
  _confirmDialog('Eliminar documento','Se eliminará el '+DCX_TIT[d.tipo].toLowerCase()+' del '+_dcF(d.fecha)+(d.reparto?' (reparto '+d.reparto+')':d.nroFactura?' (factura '+d.nroFactura+')':'')+'.'+efecto,
    function(){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo eliminar','err'); return; }
          DCX.hist=DCX.hist.filter(function(x){ return x.id!==id; });
          if(DCX.edit&&DCX.edit.id===id) DCX.edit=null;
          if(d.tipo==='marcaje') PAGE_LOADED['envases']=false;
          if(d.tipo==='nc') PAGE_LOADED['mt']=false;
          showToast('Documento eliminado'+(r.conservadas?' · '+r.conservadas+' fila(s) de M-T ya retiradas se conservaron':''),'ok');
          renderDocumentos();
        })
        .withFailureHandler(function(e){ showToast(e.message,'err'); })
        .eliminarDocumento(S.token,id);
    },'Eliminar');
}

/* ── historial ── */
function _dcHistHtml(){
  var chips=[['','Todos'],['marcaje','Marcaje'],['nc','NC'],['traslado','Traslado']];
  return '<div class="dc-card"><div class="dc-h"><span class="t">Historial</span><span class="s">los últimos documentos guardados; se pueden volver a imprimir</span></div>'+
    '<div class="dc-hf">'+chips.map(function(c){ return '<button class="dc-chp'+(DCX.filtro===c[0]?' on':'')+'" onclick="dcHistTipo(\''+c[0]+'\')">'+c[1]+'</button>'; }).join('')+
      '<input class="inp dc-hq" placeholder="Buscar reparto, factura, destino o producto…" value="'+esc(DCX.q)+'" oninput="DCX.q=this.value;dcHistFiltrar()"></div>'+
    '<div id="dc-hlist"></div></div>';
}
function dcHistTipo(t){ DCX.filtro=t; _dcCuerpo(); }
function dcHistFiltrar(){
  var q=String(DCX.q||'').toLowerCase().trim(), el=document.getElementById('dc-hlist'); if(!el) return;
  var rows=DCX.hist.filter(function(d){
    if(DCX.filtro&&d.tipo!==DCX.filtro) return false;
    if(!q) return true;
    var txt=[d.reparto,d.nroFactura,d.destino,d.placa,d.transporte].concat((d.lineas||[]).map(function(l){ return (l.desc||'')+' '+(l.sku||'')+' '+(l.code||''); })).join(' ').toLowerCase();
    return txt.indexOf(q)>-1;
  });
  var bd={ marcaje:'<span class="dc-bd m">Marcaje</span>', nc:'<span class="dc-bd n">NC</span>', traslado:'<span class="dc-bd t">Traslado</span>' };
  el.innerHTML=rows.length ? rows.map(function(d){
    var det=d.tipo==='marcaje' ? ('Reparto '+(d.reparto||'—')+(d.placa?' · '+d.placa:''))
          : d.tipo==='nc' ? ('Factura '+(d.nroFactura||'—')+' · '+d.lineas.length+(d.lineas.length===1?' producto':' productos'))
          : ('Destino '+(d.destino||'—')+' · '+d.lineas.length+(d.lineas.length===1?' producto':' productos'));
    return '<div class="dc-hr"><div class="dc-hd">'+_dcF(d.fecha)+'</div><div>'+bd[d.tipo]+'</div><div class="dc-ht"><b>'+esc(det)+'</b><small>'+esc(d.usuario||'')+'</small></div>'+
      '<div class="dc-ha"><button class="btn btn-ghost btn-sm" onclick="dcVerId('+d.id+')">Ver / Imprimir</button>'+
      '<button class="btn btn-ghost btn-sm" onclick="dcEditar('+d.id+')">Editar</button>'+
      '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="dcEliminar('+d.id+')">Eliminar</button></div></div>';
  }).join('') : '<div class="dc-empty">Sin documentos guardados'+(DCX.filtro||q?' con ese filtro':'')+'.</div>';
}
function dcVerId(id){ var d=DCX.hist.filter(function(x){ return x.id===id; })[0]; if(d) dcVer(d); }

/* ── papel e impresión ── */
function _dcFirmas(a,b){ return '<div class="dp-sig"><div><b>'+a+'</b>NOMBRE:<br>DNI:</div><div><b>'+b+'</b>NOMBRE:<br>DNI:</div></div>'; }
function _dcCab(d){
  return '<div class="dp-hd"><div><span>Reparto.</span><b>'+esc(d.reparto)+'</b></div><div><span>Fecha</span><b>'+_dcF(d.fecha)+'</b></div>'+
    '<div><span>Transporte</span><b>'+esc(d.transporte)+'</b></div><div><span>Placa</span><b>'+esc(d.placa)+'</b></div></div>';
}
function _dcPapel(d){
  var sede=_dcSede(), t, i, x;
  if(d.tipo==='marcaje'){
    var mh=function(l1,v1,l2,v2){ return '<div class="dpm-h"><div class="l"><span>'+l1+'</span><b>'+esc(v1)+'</b></div><div class="rr"><span>'+l2+'</span><b>'+esc(v2)+'</b></div></div>'; };
    t='<h2>CONCILIACIÓN DE ENVASES - '+esc(sede)+'</h2>'+
      mh('Reparto:',d.reparto,'Fecha:',_dcF(d.fecha))+mh('Transporte:',d.transporte,'Placa:',d.placa)+mh('Hora Inicio:',_dcHms(d.horaInicio),'Hora Fin:',_dcHms(d.horaFin))+
      '<table><tr><th style="width:19%">Sku</th><th style="width:33%">Descripcion</th><th>ENT</th><th>DEV</th><th>DIFF</th></tr>';
    (d.lineas||[]).forEach(function(r){
      var c=r.cz?' cz-'+r.cz:'';
      t+='<tr><td class="'+c+'">'+r.sku+'</td><td class="'+c+'">'+esc(r.code)+'</td><td class="c">'+(r.ent||0)+'</td><td class="c">'+(r.dev||0)+'</td><td class="c">'+((r.ent||0)-(r.dev||0))+'</td></tr>';
    });
    return t+'</table><div class="dpm-sig"><div><b>TRASPORTE</b><i>NOMBRE</i><u>DNI</u></div><div><b>TIENDA</b><i>NOMBRE</i><u>DNI</u></div></div>';
  }
  if(d.tipo==='nc'){
    t='<h2>ORDEN PARA NOTA DE CRÉDITO - '+esc(sede)+'</h2>'+_dcCab(d)+'<p class="dp-note">Se deja constancia que no dejaron los siguientes productos:</p>'+
      '<table><tr><th style="width:15%">Sku</th><th style="width:15%">SAP</th><th>Descripción</th><th style="width:11%">Und</th></tr>';
    for(i=0;i<Math.max(7,d.lineas.length);i++){ x=d.lineas[i];
      t+=x?'<tr><td class="c">'+esc(x.sku)+'</td><td class="c">'+esc(x.sap)+'</td><td>'+esc(x.desc)+'</td><td class="c">'+(x.und||'')+'</td></tr>':'<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>'; }
    return t+'</table>'+_dcFirmas('TRANSPORTE','TIENDA');
  }
  t='<h2>CARGO DESPACHO - '+esc(sede)+'</h2><div class="dp-hd"><div><span>Placa:</span><b>'+esc(d.placa)+'</b></div><div><span>Fecha</span><b>'+_dcF(d.fecha)+'</b></div></div>'+
    '<table><tr><th>FECHA</th><th>SKU</th><th>SAP</th><th>DESCRIPCIÓN</th><th>PACK/U</th><th>ORIGEN</th><th>DESTINO</th></tr>';
  for(i=0;i<Math.max(8,d.lineas.length);i++){ x=d.lineas[i];
    t+=x?'<tr><td class="c">'+_dcF(d.fecha)+'</td><td class="c">'+esc(x.sku)+'</td><td class="c">'+esc(x.sap)+'</td><td>'+esc(x.desc)+'</td><td class="c">'+(x.und||'')+'</td><td class="c">'+esc(sede)+'</td><td class="c">'+esc(d.destino)+'</td></tr>'
        :'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'; }
  return t+'</table><p class="dp-note"><b>Observaciones:</b> '+esc(d.observaciones)+'</p>'+_dcFirmas('DS '+esc(sede),'PROVEEDOR');
}
function dcVer(d){
  var pv=document.getElementById('dc-pv');
  if(!pv){
    pv=document.createElement('div'); pv.id='dc-pv'; pv.className='dv';
    pv.innerHTML='<div class="dv-top"><b id="dc-pv-t"></b><span class="sp"></span><button class="btn btn-ghost" onclick="dcCerrarPv()">Cerrar</button><button class="btn btn-primary" onclick="window.print()">Imprimir</button></div>'+
      '<div class="dv-body"><div class="dp" id="dc-paper"></div></div>';
    document.body.appendChild(pv);
  }
  var p=document.getElementById('dc-paper');
  p.className='dp'+(d.tipo==='marcaje'?' mar':'');
  p.innerHTML=_dcPapel(d);
  document.getElementById('dc-pv-t').textContent=DCX_TIT[d.tipo]||'Documento';
  pv.classList.add('on'); document.body.classList.add('doc-printing'); document.documentElement.classList.add('doc-printing');
}
function dcCerrarPv(){
  var pv=document.getElementById('dc-pv'); if(pv) pv.classList.remove('on');
  document.body.classList.remove('doc-printing'); document.documentElement.classList.remove('doc-printing');
}
