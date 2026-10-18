/* ══════════════════════════════════════════════════════════════
   ENVASES — control individual por tienda (todo manual)
   Conteo del día por líneas (como un inventario) + movimientos + pendientes de
   motorizados + precios. El Control compara el conteo inicial contra lo esperado.
   ══════════════════════════════════════════════════════════════ */
var ENV_TAM = {
  630:  { m:12, n:'Botella 630',  b:{llena:'2821',  vacia:'3500323'}, caja:'3500192', cn:'Caja plástica 620/650', g:'bot630_1000' },
  1000: { m:12, n:'Botella 1000', b:{llena:'14663', vacia:'3500381'}, caja:'3500193', cn:'Caja plástica 1100',    g:'bot630_1000' },
  310:  { m:24, n:'Botella 305',  b:{llena:'15421', vacia:'3502226'}, caja:'3500240', cn:'Caja plástica 330',     g:'bot310' }
};
var ENV_FAM = [
  { k:'caj6', n:'Cajas 6xx / litro',     tams:[630,1000], caja:true },
  { k:'bot6', n:'Botellas 6xx / litro',  tams:[630,1000], caja:false },
  { k:'caj3', n:'Cajas 3xx',             tams:[310],      caja:true },
  { k:'bot3', n:'Botellas 3xx',          tams:[310],      caja:false }
];
var ENV_PRECIO0 = { caja:3.8, bot630_1000:0.6, bot310:0.5 };
var ENV_UBIS = ['Palet','Cámara','Z3','Pendientes'];
var ENV_TIPOS = { entrada:'Entrada', devolucion:'Devolución a Backus', venta:'Venta', baja:'Baja (rotura)' };
var ENV = {
  d:null, vista:'control', ini:'', fin:'', fechaConteo:'', iniAuto:true, finAuto:true,
  f:{ estado:'vacia', tam:630, ubi:'Palet', packs:'', solas:'', und:'' },
  m:{ fecha:'', tipo:'entrada', tam:630, estado:'vacia', packs:'', und:'', nota:'' },
  p:{ abierto:false, fecha:'', moto:'', tam:630, cant:'', nota:'' },
  pFiltro:'pen', pr:{ caja:'', bot630_1000:'', bot310:'' }
};

/* ── utilidades ── */
function _envHoy(){ return (ENV.d && ENV.d.hoy) || new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'}); }
function _envF(iso){ return iso ? iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4) : ''; }
function _envDia(iso){
  if(!iso) return '';
  var d=new Date(iso+'T12:00:00'); var s=d.toLocaleDateString('es-PE',{weekday:'long'});
  return s.charAt(0).toUpperCase()+s.slice(1)+' '+iso.slice(8,10)+'/'+iso.slice(5,7);
}
function _envPrecio(g){ var p=ENV.d&&ENV.d.precios&&ENV.d.precios[g]; return (p===undefined||p===null)?ENV_PRECIO0[g]:p; }
function _envN(v){ var n=parseInt(v,10); return isNaN(n)||n<0?0:n; }
function _envSg(n){ return (n>0?'+':n<0?'−':'')+Math.abs(n).toLocaleString('es-PE'); }
function _envMoney(n){ return (n<0?'−':n>0?'+':'')+'S/ '+Math.abs(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _envM2(n){ return 'S/ '+Number(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _envCls(n){ return n<0?'neg':n>0?'pos':'zero'; }
function _envEstado(n){ return n<0?'<span class="env-bd f">Faltante</span>':n>0?'<span class="env-bd s">Sobrante</span>':'<span class="env-bd c">Cuadra</span>'; }
function _envFechas(){ var s={}; (ENV.d.conteo||[]).forEach(function(l){ s[l.fecha]=true; }); return Object.keys(s).sort(); }

/* ── conteo de una fecha: botellas llenas / vacías y cajas plásticas por tamaño ── */
function _envConteoDe(fecha){
  var o={};
  [630,1000,310].forEach(function(t){ o[t]={llena:0,vacia:0,caja:0}; });
  (ENV.d.conteo||[]).forEach(function(l){
    if(l.fecha!==fecha||!o[l.tamano]) return;
    o[l.tamano][l.estado]+=l.packs*ENV_TAM[l.tamano].m+l.unidades;
    o[l.tamano].caja+=l.packs+l.solas;
  });
  return o;
}

/* ── fechas por defecto: conteo inicial = último lunes con conteo; conteo final = el más reciente ── */
function _envFechasDefecto(){
  var fs=_envFechas();
  if(ENV.finAuto||fs.indexOf(ENV.fin)<0) ENV.fin=fs.length?fs[fs.length-1]:'';
  if(!ENV.fin){ ENV.ini=''; return; }
  if(ENV.iniAuto||fs.indexOf(ENV.ini)<0){
    var ini='', previas=fs.filter(function(f){ return f<ENV.fin; });
    for(var i=previas.length-1;i>=0;i--){ if(new Date(previas[i]+'T12:00:00').getDay()===1){ ini=previas[i]; break; } }
    if(!ini){
      var lim=new Date(ENV.fin+'T12:00:00'); lim.setDate(lim.getDate()-7); var li=lim.toISOString().slice(0,10);
      var cand=previas.filter(function(f){ return f>=li; });
      ini=cand.length?cand[0]:(previas.length?previas[previas.length-1]:'');
    }
    ENV.ini=ini;
  }
}

/* ── Control: esperado = inicial + entradas − devoluciones ± ventas ± pendientes; diferencia = contado − esperado ── */
function _envControl(){
  var fs=_envFechas();
  if(!ENV.ini||!ENV.fin||ENV.ini>=ENV.fin||fs.length<2) return null;
  var ini=_envConteoDe(ENV.ini), fin=_envConteoDe(ENV.fin);
  var entre=function(f){ return f>ENV.ini&&f<=ENV.fin; };
  var filas=[], fams=[], total=0;
  ENV_FAM.forEach(function(fam){
    var fl=[];
    fam.tams.forEach(function(t){
      var T=ENV_TAM[t];
      var tipos=fam.caja?[{c:T.caja,n:T.cn,k:'caja',g:'caja'}]:[{c:T.b.llena,n:T.n+' · llena',k:'llena',g:T.g},{c:T.b.vacia,n:T.n+' · vacía',k:'vacia',g:T.g}];
      tipos.forEach(function(x){
        var r={ cod:x.c, nombre:x.n, k:x.k, tam:t, ini:ini[t][x.k], cnt:fin[t][x.k], ent:0, dev:0, ven:0, pen:0 };
        (ENV.d.mov||[]).forEach(function(m){
          if(m.tamano!==t||!entre(m.fecha)) return;
          var bot=m.packs*T.m+m.unidades;
          if(x.k==='caja'){
            if(m.tipo==='entrada') r.ent+=m.packs;
            else if(m.tipo==='devolucion') r.dev-=m.packs;
          } else {
            if(m.tipo==='entrada'&&x.k==='llena') r.ent+=bot;
            else if(m.tipo==='devolucion'&&m.estado===x.k) r.dev-=bot;
            else if(m.tipo==='baja'&&m.estado===x.k) r.dev-=bot;
            else if(m.tipo==='venta'){ r.ven+=(x.k==='llena'?-bot:bot); }
          }
        });
        if(x.k==='vacia'){
          (ENV.d.pend||[]).forEach(function(p){
            if(p.tamano!==t) return;
            var abierto=!p.fechaEntrega||p.fechaEntrega>ENV.fin;
            if(p.fecha>ENV.ini&&p.fecha<=ENV.fin&&abierto) r.pen-=p.cantidad;
            if(p.fecha<=ENV.ini&&p.fechaEntrega&&p.fechaEntrega>ENV.ini&&p.fechaEntrega<=ENV.fin) r.pen+=p.cantidad;
          });
        }
        r.esp=r.ini+r.ent+r.dev+r.ven+r.pen;
        r.dif=r.cnt-r.esp;
        r.val=r.dif*_envPrecio(x.g);
        fl.push(r); total+=r.val;
      });
    });
    fams.push({ k:fam.k, n:fam.n, filas:fl, dif:fl.reduce(function(s,r){return s+r.dif;},0), val:fl.reduce(function(s,r){return s+r.val;},0) });
    filas=filas.concat(fl);
  });
  return { fams:fams, total:total };
}

/* ── carga / render ── */
function loadEnvases(){
  if(!S||!S.token){errBox('envases-root','Sin sesión activa. Recarga la página.','envases');PAGE_LOADING['envases']=false;return;}
  var t=(REQ_TOKEN.envases=(REQ_TOKEN.envases||0)+1);
  google.script.run
    .withSuccessHandler(function(r){ if(t!==REQ_TOKEN.envases) return; PAGE_LOADING['envases']=false; envRecibir(r); })
    .withFailureHandler(function(e){ if(t!==REQ_TOKEN.envases) return; PAGE_LOADING['envases']=false; errBox('envases-root',e.message,'envases'); })
    .getEnvases(S.token);
}
// Recarga en silencio (sin el loader) después de guardar algo
function _envRecargar(){
  google.script.run.withSuccessHandler(function(r){ if(r&&r.ok){ ENV.d=r; _envFechasDefecto(); _envRender(); } })
    .withFailureHandler(function(e){ showToast(e.message,'err'); }).getEnvases(S.token);
}
function envRecibir(r){
  if(_handleExpired(r,'envases-root')) return;
  if(!r||!r.ok){ errBox('envases-root',r?r.error:'Error desconocido','envases'); return; }
  ENV.d=r;
  if(!ENV.fechaConteo) ENV.fechaConteo=r.hoy;
  if(!ENV.m.fecha) ENV.m.fecha=r.hoy;
  if(!ENV.p.fecha) ENV.p.fecha=r.hoy;
  ['caja','bot630_1000','bot310'].forEach(function(g){ ENV.pr[g]=String(_envPrecio(g)); });
  _envFechasDefecto();
  _envRender();
}
function envVista(v){ ENV.vista=v; _envRender(); }
function envAbrirConteo(){ ENV.vista='conteo'; _envRender(); var el=document.getElementById('env-form'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }

function _envTabs(){
  var pend=(ENV.d.pend||[]).filter(function(p){return p.estado==='pendiente';}).length;
  var T=[['control','Control'],['conteo','Conteo del día'],['mov','Movimientos'],['pend','Pendientes'+(pend?' <em>'+pend+'</em>':'')],['precios','Precios']];
  return '<div class="env-tabs"><div class="sal2-seg">'+T.map(function(t){
    return '<button class="'+(ENV.vista===t[0]?'on':'')+'" onclick="envVista(\''+t[0]+'\')">'+t[1]+'</button>';
  }).join('')+'</div></div>';
}
function _envRender(){
  var root=document.getElementById('envases-root'); if(!root||!ENV.d) return;
  var v=ENV.vista, html=_envTabs();
  if(v==='conteo') html+=_envVConteo();
  else if(v==='mov') html+=_envVMov();
  else if(v==='pend') html+=_envVPend();
  else if(v==='precios') html+=_envVPrecios();
  else html+=_envVControl();
  root.innerHTML=html;
}

/* ══ Control ══ */
function _envVControl(){
  var fs=_envFechas();
  if(fs.length<2){
    return '<div class="env-vacio"><div style="font-size:14px;font-weight:600;color:var(--text2);margin-bottom:6px">Aún no hay suficientes conteos</div>'+
      'El Control compara el conteo inicial con el último. Registra al menos dos conteos de fechas distintas en la pestaña <b>Conteo del día</b>.<div style="margin-top:14px"><button class="btn btn-primary btn-sm" onclick="envVista(\'conteo\')">Ir a Conteo del día</button></div></div>';
  }
  var opt=function(sel){ return fs.slice().reverse().map(function(f){ return '<option value="'+f+'"'+(f===sel?' selected':'')+'>'+_envDia(f)+'</option>'; }).join(''); };
  var cab='<div class="env-chips"><label class="env-chip">Conteo inicial <select onchange="envFechaIni(this.value)">'+opt(ENV.ini)+'</select></label>'+
    '<label class="env-chip">Último conteo <select onchange="envFechaFin(this.value)">'+opt(ENV.fin)+'</select></label>'+
    '<span class="env-hint" style="margin-left:auto">Conteos al cierre del día · movimientos entre ambas fechas</span></div>';
  var c=_envControl();
  if(!c) return cab+'<div class="env-vacio">El conteo inicial debe ser anterior al último conteo.</div>';
  var neg=c.fams.filter(function(f){return f.dif<0;}).length, pos=c.fams.filter(function(f){return f.dif>0;}).length;
  var tarjetas='<div class="env-kp"><div class="sal2-card"><div class="sal2-k">Resultado</div><div class="sal2-v env-'+_envCls(c.total)+'">'+_envMoney(c.total)+'</div>'+
    '<div class="sal2-n">'+(c.total<0?'Faltante':c.total>0?'Sobrante':'Cuadra')+' valorizado · '+neg+' con faltante, '+pos+' con sobrante</div></div>'+
    c.fams.map(function(f){ return '<div class="sal2-card"><div class="sal2-k">'+f.n+'</div><div class="sal2-v env-'+_envCls(f.dif)+'">'+_envSg(f.dif)+'<small>und.</small></div>'+
      '<div class="env-fl">'+_envEstado(f.dif)+'<span class="env-mono env-'+_envCls(f.val)+'">'+_envMoney(f.val)+'</span></div></div>'; }).join('')+'</div>';
  var tabla='<div class="env-tw"><div class="env-tr env-ct env-h"><div>Envase</div><div class="r env-hm">Inicial</div><div class="r env-hm">+ Entr.</div><div class="r env-hm">− Devol.</div><div class="r env-hm">± Ventas</div><div class="r env-hm">Pendient.</div><div class="r">Esperado</div><div class="r">Contado</div><div class="r">Dif.</div><div class="r">Valor</div></div>';
  c.fams.forEach(function(f){
    tabla+='<div class="env-grp">'+f.n+'<em>'+_envSg(f.dif)+' und. · '+_envMoney(f.val)+'</em></div>';
    f.filas.forEach(function(r){
      var z=function(n){ return n?_envSg(n):'·'; };
      tabla+='<div class="env-tr env-ct"><div class="env-nm"><b>'+esc(r.nombre)+'</b><span>'+r.cod+'</span></div>'+
        '<div class="r env-mono env-dim env-hm">'+fmt(r.ini)+'</div><div class="r env-mono env-hm">'+z(r.ent)+'</div><div class="r env-mono env-hm">'+z(r.dev)+'</div><div class="r env-mono env-hm">'+z(r.ven)+'</div><div class="r env-mono env-hm">'+z(r.pen)+'</div>'+
        '<div class="r env-mono env-num" data-l="Esperado">'+fmt(r.esp)+'</div><div class="r env-mono env-num" data-l="Contado">'+fmt(r.cnt)+'</div>'+
        '<div class="r env-mono env-'+_envCls(r.dif)+'" style="font-weight:700" data-l="Dif.">'+(r.dif?_envSg(r.dif):'0')+'</div><div class="r env-mono env-'+_envCls(r.dif)+'" data-l="Valor">'+(r.dif?_envMoney(r.val):'—')+'</div></div>';
    });
  });
  tabla+='</div><div class="env-note">Esperado = inicial + entradas − devoluciones/bajas ± ventas ± pendientes de motorizados. Diferencia = contado − esperado, valorizada con los precios de la pestaña Precios. En una venta sale la botella llena y vuelve vacía.</div>';
  return cab+tarjetas+tabla;
}
function envFechaIni(v){ ENV.ini=v; ENV.iniAuto=false; _envRender(); }
function envFechaFin(v){ ENV.fin=v; ENV.finAuto=false; _envRender(); }

/* ══ Conteo del día (líneas, como un inventario) ══ */
function _envSeg(opts,sel,fn){
  return '<div class="sal2-seg">'+opts.map(function(o){
    return '<button class="'+(String(o[0])===String(sel)?'on':'')+'" onclick="'+fn+'(\''+o[0]+'\')">'+o[1]+'</button>';
  }).join('')+'</div>';
}
function envFSet(campo,v){ ENV.f[campo]=(campo==='tam')?Number(v):v; _envRender(); }
function envFIn(campo,el){ ENV.f[campo]=el.value; _envCalcForm(); }
function _envCalcForm(){
  var T=ENV_TAM[ENV.f.tam], packs=_envN(ENV.f.packs), solas=_envN(ENV.f.solas), und=_envN(ENV.f.und);
  var bot=packs*T.m+und;
  var a=document.getElementById('env-auto'); if(a) a.textContent=packs;
  var c1=document.getElementById('env-calc-caj'); if(c1) c1.innerHTML=packs+' + '+solas+' = <b>'+(packs+solas)+'</b> cajas';
  var c2=document.getElementById('env-calc-bot'); if(c2) c2.innerHTML=packs+' × '+T.m+' = '+(packs*T.m).toLocaleString('es-PE')+' + '+und+' = <b>'+bot.toLocaleString('es-PE')+'</b> botellas';
}
function envFechaConteo(v){ if(v){ ENV.fechaConteo=v; _envRender(); } }
function _envVConteo(){
  var f=ENV.f, T=ENV_TAM[f.tam];
  var inp=function(l,campo,v){ return '<div><label class="env-lb">'+l+'</label><input class="env-in" type="number" min="0" inputmode="numeric" value="'+esc(v)+'" placeholder="0" oninput="envFIn(\''+campo+'\',this)"></div>'; };
  var form='<div class="sal2-card env-form" id="env-form"><div class="sal2-k" style="margin-bottom:14px">Agregar al conteo</div>'+
    '<label class="env-lb">Estado</label>'+_envSeg([['llena','Llenas'],['vacia','Vacías']],f.estado,'envSetEstado')+
    '<label class="env-lb" style="margin-top:14px">Envase</label>'+_envSeg([[630,'Botella 630'],[310,'Botella 305'],[1000,'Botella 1000']],f.tam,'envSetTam')+
    '<div class="env-hint" style="margin-top:6px">Multiplica ×'+T.m+' · caja plástica asociada: '+T.cn.replace('Caja plástica ','')+' ('+T.caja+')</div>'+
    '<label class="env-lb" style="margin-top:14px">Ubicación</label>'+_envSeg(ENV_UBIS.map(function(u){return [u,u];}),f.ubi,'envSetUbi')+
    '<div class="env-blk"><div class="env-bh">'+ICO('caja',15,'s')+'Cajas plásticas<span class="env-auto">'+T.cn.replace('Caja plástica ','')+'</span></div><div class="env-g2">'+
      '<div><label class="env-lb">Con botellas</label><div class="env-ro"><small>auto</small><span id="env-auto">'+_envN(f.packs)+'</span></div></div>'+inp('Solas (sin botellas)','solas',f.solas)+'</div>'+
      '<div class="env-calc" id="env-calc-caj"></div></div>'+
    '<div class="env-blk"><div class="env-bh">'+ICO('botella',15,'s')+'Botellas<span class="env-auto">× '+T.m+' automático</span></div><div class="env-g2">'+
      inp('Packs (cajas completas)','packs',f.packs)+inp('Unidades sueltas','und',f.und)+'</div><div class="env-calc" id="env-calc-bot"></div></div>'+
    '<div class="env-hint" style="margin:10px 0 12px">Los packs de botellas ya cuentan como "cajas con botellas": solo se escriben una vez.</div>'+
    '<button class="btn btn-primary" style="width:100%;justify-content:center" onclick="envAgregarLinea()">'+ICO('check',14,'s')+' Agregar al conteo</button></div>';
  var lineas=(ENV.d.conteo||[]).filter(function(l){ return l.fecha===ENV.fechaConteo; });
  var filas=lineas.map(function(l){
    var m=ENV_TAM[l.tamano].m;
    return '<div class="env-tr env-lin"><div><span class="env-bd '+(l.estado==='llena'?'c':'w')+'">'+(l.estado==='llena'?'Llena':'Vacía')+'</span></div><div class="env-num">'+ENV_TAM[l.tamano].n+'</div><div class="env-dim">'+esc(l.ubicacion)+'</div>'+
      '<div class="r env-mono" data-l="Packs">'+(l.packs||'·')+'</div><div class="r env-mono" data-l="Unid.">'+(l.unidades||'·')+'</div><div class="r env-mono" data-l="C. solas">'+(l.solas||'·')+'</div>'+
      '<div class="r env-mono env-num" data-l="Botellas">'+fmt(l.packs*m+l.unidades)+'</div><div><button class="env-ib" title="Eliminar" onclick="envBorrarLinea('+l.id+')">'+ICO('x',13,'s')+'</button></div></div>';
  }).join('');
  var lista='<div class="env-tw"><div class="env-grp" style="border-top:0">Conteo registrado<em>'+lineas.length+(lineas.length===1?' línea':' líneas')+'</em></div>'+
    (lineas.length?'<div class="env-tr env-lin env-h"><div>Estado</div><div>Envase</div><div>Ubicación</div><div class="r">Packs</div><div class="r">Unid.</div><div class="r">C. solas</div><div class="r">Botellas</div><div></div></div><div class="env-scroll">'+filas+'</div>':
      '<div class="env-vacio" style="border:0">Aún no hay líneas para esta fecha. Agrega la primera con el formulario.</div>')+'</div>';
  var o=_envConteoDe(ENV.fechaConteo), cods=[];
  [630,310,1000].forEach(function(t){ var T2=ENV_TAM[t];
    cods.push([T2.b.llena,T2.n+' · llena',T2.m,o[t].llena]); cods.push([T2.b.vacia,T2.n+' · vacía',T2.m,o[t].vacia]); cods.push([T2.caja,T2.cn,1,o[t].caja]); });
  var tot='<div class="env-tw" style="margin-top:14px"><div class="env-grp" style="border-top:0">Total por envase<em>es lo que usa el Control</em></div><div class="env-tot">'+cods.map(function(c){
    return '<div class="env-tr"><div class="env-nm"><b>'+c[1]+'</b><span>'+c[0]+'</span></div><div class="env-mono env-dim r">×'+c[2]+'</div><div class="r env-mono env-num" style="font-size:13.5px">'+fmt(c[3])+'</div></div>'; }).join('')+'</div></div>';
  var cab='<div class="env-chips"><label class="env-chip">Fecha del conteo <input type="date" value="'+ENV.fechaConteo+'" max="'+_envHoy()+'" onchange="envFechaConteo(this.value)"></label><span class="env-hint" style="margin-left:auto">Cada línea se guarda al agregarla</span></div>';
  setTimeout(_envCalcForm,0);
  return cab+'<div class="env-cols">'+form+'<div>'+lista+tot+'</div></div>';
}
function envSetEstado(v){ envFSet('estado',v); }
function envSetTam(v){ envFSet('tam',v); }
function envSetUbi(v){ envFSet('ubi',v); }
function envAgregarLinea(){
  var f=ENV.f;
  var fila={ fecha:ENV.fechaConteo, estado:f.estado, tamano:f.tam, ubicacion:f.ubi, packs:_envN(f.packs), solas:_envN(f.solas), unidades:_envN(f.und) };
  if(fila.packs+fila.solas+fila.unidades===0){ showToast('Ingresa al menos una cantidad','err'); return; }
  google.script.run.withSuccessHandler(function(r){
    if(!r.ok){ showToast(r.error,'err'); return; }
    ENV.f.packs=''; ENV.f.solas=''; ENV.f.und='';
    showToast('Línea agregada','ok'); _envRecargar();
  }).withFailureHandler(function(e){ showToast(e.message,'err'); }).agregarEnvaseLinea(S.token,fila);
}
function envBorrarLinea(id){
  _confirmDialog('Eliminar línea','Se quitará esta línea del conteo.',function(){
    google.script.run.withSuccessHandler(function(r){ if(!r.ok){showToast(r.error,'err');return;} showToast('Eliminada','ok'); _envRecargar(); })
      .withFailureHandler(function(e){showToast(e.message,'err');}).eliminarEnvaseLinea(S.token,id);
  },'Eliminar');
}

/* ══ Movimientos ══ */
function envMSet(campo,v){ ENV.m[campo]=(campo==='tam')?Number(v):v; _envRender(); }
function envMIn(campo,el){ ENV.m[campo]=el.value; _envEfectoMov(); }
function _envEfectoMov(){
  var m=ENV.m, T=ENV_TAM[m.tam], packs=_envN(m.packs), und=_envN(m.und), bot=packs*T.m+und, el=document.getElementById('env-efecto'); if(!el) return;
  var t=fmt(bot), txt='';
  if(!bot) txt='Escribe la cantidad para ver cómo afecta al conteo esperado.';
  else if(m.tipo==='entrada') txt='Suma <b>'+t+'</b> botellas llenas de '+T.n.replace('Botella ','')+(packs?' y <b>'+packs+'</b> cajas plásticas':'')+'.';
  else if(m.tipo==='devolucion') txt='Resta <b>'+t+'</b> botellas vacías de '+T.n.replace('Botella ','')+(packs?' y <b>'+packs+'</b> cajas plásticas':'')+'.';
  else if(m.tipo==='venta') txt='Sale llena y vuelve vacía: resta <b>'+t+'</b> llenas y suma <b>'+t+'</b> vacías de '+T.n.replace('Botella ','')+'.';
  else txt='Resta <b>'+t+'</b> botellas '+(m.estado==='llena'?'llenas':'vacías')+' de '+T.n.replace('Botella ','')+' (rotura).';
  el.innerHTML=txt;
}
function envMAgregar(){
  var m=ENV.m;
  var f={ fecha:m.fecha, tipo:m.tipo, tamano:m.tam, estado:(m.tipo==='entrada'?'llena':m.tipo==='devolucion'?'vacia':m.tipo==='venta'?'llena':m.estado), packs:_envN(m.packs), unidades:_envN(m.und), nota:m.nota };
  if(f.packs+f.unidades===0){ showToast('Ingresa una cantidad','err'); return; }
  google.script.run.withSuccessHandler(function(r){
    if(!r.ok){ showToast(r.error,'err'); return; }
    ENV.m.packs=''; ENV.m.und=''; ENV.m.nota='';
    showToast('Movimiento registrado','ok'); _envRecargar();
  }).withFailureHandler(function(e){ showToast(e.message,'err'); }).agregarEnvaseMov(S.token,f);
}
function envMBorrar(id){
  _confirmDialog('Eliminar movimiento','Se quitará este movimiento y cambiará el conteo esperado.',function(){
    google.script.run.withSuccessHandler(function(r){ if(!r.ok){showToast(r.error,'err');return;} showToast('Eliminado','ok'); _envRecargar(); })
      .withFailureHandler(function(e){showToast(e.message,'err');}).eliminarEnvaseMov(S.token,id);
  },'Eliminar');
}
function _envVMov(){
  var m=ENV.m;
  var inp=function(l,campo,v,tipo){ return '<div><label class="env-lb">'+l+'</label><input class="env-in" '+(tipo==='text'?'type="text" style="text-align:left"':'type="number" min="0" inputmode="numeric"')+' value="'+esc(v)+'" placeholder="'+(tipo==='text'?'Opcional':'0')+'" oninput="envMIn(\''+campo+'\',this)"></div>'; };
  var sel=function(campo,opts,val){ return '<select class="env-in env-sel" onchange="envMSet(\''+campo+'\',this.value)">'+opts.map(function(o){return '<option value="'+o[0]+'"'+(String(o[0])===String(val)?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>'; };
  var form='<div class="sal2-card env-mform"><div class="env-mg">'+
    '<div><label class="env-lb">Fecha</label><input class="env-in env-sel" type="date" value="'+m.fecha+'" max="'+_envHoy()+'" onchange="envMSet(\'fecha\',this.value)"></div>'+
    '<div><label class="env-lb">Tipo</label>'+sel('tipo',Object.keys(ENV_TIPOS).map(function(k){return [k,ENV_TIPOS[k]];}),m.tipo)+'</div>'+
    '<div><label class="env-lb">Envase</label>'+sel('tam',[[630,'Botella 630'],[310,'Botella 305'],[1000,'Botella 1000']],m.tam)+'</div>'+
    (m.tipo==='baja'?'<div><label class="env-lb">Botella</label>'+sel('estado',[['vacia','Vacía'],['llena','Llena']],m.estado)+'</div>':'')+
    inp('Packs (cajas)','packs',m.packs)+inp('Unidades sueltas','und',m.und)+'</div>'+
    '<div class="env-eff" id="env-efecto"></div>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><input class="env-in" style="flex:1;min-width:180px;text-align:left" placeholder="Nota (opcional)" value="'+esc(m.nota)+'" oninput="envMIn(\'nota\',this)"><button class="btn btn-primary" onclick="envMAgregar()">'+ICO('check',14,'s')+' Registrar movimiento</button></div></div>';
  var movs=(ENV.d.mov||[]).slice().sort(function(a,b){ return a.fecha===b.fecha?b.id-a.id:(a.fecha<b.fecha?1:-1); }).slice(0,80);
  var bd={entrada:'<span class="env-bd c">Entrada</span>',devolucion:'<span class="env-bd w">Devolución</span>',venta:'<span class="env-bd s">Venta</span>',baja:'<span class="env-bd f">Baja</span>'};
  var filas=movs.map(function(x){
    var T=ENV_TAM[x.tamano], q=x.packs*T.m+x.unidades;
    var sg=(x.tipo==='entrada')?'+':'−';
    return '<div class="env-tr env-mv"><div class="env-mono env-dim">'+_envF(x.fecha)+'</div><div>'+bd[x.tipo]+'</div><div class="env-num">'+T.n+(x.tipo==='baja'?' · '+(x.estado==='llena'?'llena':'vacía'):'')+'</div>'+
      '<div class="r env-mono env-num">'+sg+fmt(q)+'<small class="env-dim"> '+(x.packs?x.packs+' caj.':'')+'</small></div><div class="env-dim env-nota">'+esc(x.nota)+'</div><div><button class="env-ib" title="Eliminar" onclick="envMBorrar('+x.id+')">'+ICO('x',13,'s')+'</button></div></div>';
  }).join('');
  var lista='<div class="env-tw"><div class="env-tr env-mv env-h"><div>Fecha</div><div>Tipo</div><div>Envase</div><div class="r">Botellas</div><div>Nota</div><div></div></div>'+
    (filas||'<div class="env-vacio" style="border:0">Aún no hay movimientos registrados.</div>')+'</div>';
  setTimeout(_envEfectoMov,0);
  return form+lista;
}

/* ══ Pendientes de motorizados ══ */
function envPAbrir(){ ENV.p.abierto=!ENV.p.abierto; _envRender(); }
function envPSet(campo,v){ ENV.p[campo]=(campo==='tam')?Number(v):v; if(campo==='tam') _envRender(); }
function envPFiltro(k){ ENV.pFiltro=k; _envRender(); }
function envPGuardar(){
  var p=ENV.p;
  var f={ fecha:p.fecha, motorizado:p.moto, tamano:p.tam, cantidad:_envN(p.cant), nota:p.nota };
  if(!f.motorizado.trim()){ showToast('Indica el motorizado','err'); return; }
  if(!f.cantidad){ showToast('Indica la cantidad de botellas','err'); return; }
  google.script.run.withSuccessHandler(function(r){
    if(!r.ok){ showToast(r.error,'err'); return; }
    ENV.p.moto=''; ENV.p.cant=''; ENV.p.nota=''; ENV.p.abierto=false;
    showToast('Pendiente registrado','ok'); _envRecargar();
  }).withFailureHandler(function(e){ showToast(e.message,'err'); }).agregarEnvasePend(S.token,f);
}
function envPEntrego(id,ok){
  google.script.run.withSuccessHandler(function(r){ if(!r.ok){showToast(r.error,'err');return;} showToast(ok===false?'Reabierto':'Marcado como entregado','ok'); _envRecargar(); })
    .withFailureHandler(function(e){showToast(e.message,'err');}).entregarEnvasePend(S.token,id,ok);
}
function envPBorrar(id){
  _confirmDialog('Eliminar pendiente','Se eliminará este registro.',function(){
    google.script.run.withSuccessHandler(function(r){ if(!r.ok){showToast(r.error,'err');return;} showToast('Eliminado','ok'); _envRecargar(); })
      .withFailureHandler(function(e){showToast(e.message,'err');}).eliminarEnvasePend(S.token,id);
  },'Eliminar');
}
function _envVPend(){
  var P=ENV.d.pend||[], hoy=_envHoy();
  var abiertos=P.filter(function(p){return p.estado==='pendiente';});
  var motos={}; abiertos.forEach(function(p){ motos[p.motorizado.toLowerCase()]=1; });
  var botellas=abiertos.reduce(function(s,p){return s+p.cantidad;},0);
  var valor=abiertos.reduce(function(s,p){return s+p.cantidad*_envPrecio(ENV_TAM[p.tamano].g);},0);
  var dias=function(f){ return Math.max(0,Math.round((new Date(hoy+'T12:00:00')-new Date(f+'T12:00:00'))/86400000)); };
  var viejo=abiertos.length?abiertos.slice().sort(function(a,b){return a.fecha<b.fecha?-1:1;})[0]:null;
  var kp='<div class="env-kp env-kp3"><div class="sal2-card"><div class="sal2-k"><i class="env-dot"></i>Pendientes de entrega</div><div class="sal2-v">'+Object.keys(motos).length+'<small>motorizados</small></div><div class="sal2-n">'+fmt(botellas)+' botellas por devolver</div></div>'+
    '<div class="sal2-card"><div class="sal2-k">Valor pendiente</div><div class="sal2-v">'+_envM2(valor)+'</div><div class="sal2-n">Con los precios actuales</div></div>'+
    '<div class="sal2-card"><div class="sal2-k">Más antiguo</div><div class="sal2-v">'+(viejo?dias(viejo.fecha):0)+'<small>días</small></div><div class="sal2-n">'+(viejo?_envF(viejo.fecha)+' · '+esc(viejo.motorizado):'Sin pendientes')+'</div></div></div>';
  var nombres={}; P.forEach(function(p){ nombres[p.motorizado]=1; });
  var p=ENV.p;
  var form=p.abierto?'<div class="sal2-card env-mform" style="margin-bottom:14px"><div class="env-mg">'+
    '<div><label class="env-lb">Fecha</label><input class="env-in env-sel" type="date" value="'+p.fecha+'" max="'+hoy+'" onchange="envPSet(\'fecha\',this.value)"></div>'+
    '<div><label class="env-lb">Motorizado</label><input class="env-in" style="text-align:left" list="env-motos" value="'+esc(p.moto)+'" placeholder="Nombre" oninput="envPSet(\'moto\',this.value)"><datalist id="env-motos">'+Object.keys(nombres).map(function(n){return '<option value="'+esc(n)+'">';}).join('')+'</datalist></div>'+
    '<div><label class="env-lb">Envase</label><select class="env-in env-sel" onchange="envPSet(\'tam\',this.value)">'+[[630,'Botella 630'],[310,'Botella 305'],[1000,'Botella 1000']].map(function(o){return '<option value="'+o[0]+'"'+(o[0]===p.tam?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div>'+
    '<div><label class="env-lb">Botellas</label><input class="env-in" type="number" min="1" inputmode="numeric" value="'+esc(p.cant)+'" placeholder="0" oninput="envPSet(\'cant\',this.value)"></div></div>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><input class="env-in" style="flex:1;min-width:180px;text-align:left" placeholder="Nota (opcional)" value="'+esc(p.nota)+'" oninput="envPSet(\'nota\',this.value)"><button class="btn btn-ghost" onclick="envPAbrir()">Cancelar</button><button class="btn btn-primary" onclick="envPGuardar()">Guardar pendiente</button></div></div>':'';
  var cont={pen:abiertos.length,ent:P.length-abiertos.length};
  var seg=_envSeg([['pen','Pendientes <em>'+cont.pen+'</em>'],['ent','Entregados <em>'+cont.ent+'</em>'],['todos','Todos']],ENV.pFiltro,'envPFiltro');
  var vis=P.filter(function(x){ return ENV.pFiltro==='todos'||(ENV.pFiltro==='pen'?x.estado==='pendiente':x.estado==='entregado'); }).sort(function(a,b){ return a.fecha===b.fecha?b.id-a.id:(a.fecha<b.fecha?-1:1); });
  var filas=vis.map(function(x){
    var ab=x.estado==='pendiente', d=dias(x.fecha);
    return '<div class="env-tr env-pd"><div class="env-mono env-dim">'+_envF(x.fecha)+'</div><div class="env-num">'+esc(x.motorizado)+'</div><div>'+ENV_TAM[x.tamano].n+' · vacía</div><div class="r env-mono env-num">'+fmt(x.cantidad)+'</div>'+
      '<div class="r env-mono" style="'+(ab&&d>=7?'color:#F0C27A':'color:var(--text3)')+'">'+(ab?d+' días':_envF(x.fechaEntrega))+'</div><div class="c">'+(ab?'<span class="env-bd w">Pendiente</span>':'<span class="env-bd c">Entregado</span>')+'</div>'+
      '<div class="env-acc">'+(ab?'<button class="btn btn-ghost btn-sm" onclick="envPEntrego('+x.id+')">'+ICO('check',13,'s')+' Entregó</button>':'<button class="btn btn-ghost btn-sm" onclick="envPEntrego('+x.id+',false)">Reabrir</button>')+'<button class="env-ib" title="Eliminar" onclick="envPBorrar('+x.id+')">'+ICO('x',13,'s')+'</button></div></div>'+
      (x.nota?'<div class="env-pnota">'+esc(x.nota)+'</div>':'');
  }).join('');
  var lista='<div class="env-tw"><div class="env-tr env-pd env-h"><div>Fecha</div><div>Motorizado</div><div>Envase</div><div class="r">Cantidad</div><div class="r">Antigüedad</div><div class="c">Estado</div><div></div></div>'+
    (filas||'<div class="env-vacio" style="border:0">'+(ENV.pFiltro==='pen'?'No hay pendientes. Todo entregado.':'Sin registros.')+'</div>')+'</div>';
  return kp+'<div class="env-chips">'+seg+'<span style="flex:1"></span><button class="btn btn-primary btn-sm" onclick="envPAbrir()"><span class="tb-btn-plus">+</span> Nuevo pendiente</button></div>'+form+lista+
    '<div class="env-note">Mientras el motorizado no entregue, esas botellas se descuentan del conteo esperado de vacías. Al marcar "Entregó" se vuelven a contar.</div>';
}

/* ══ Precios ══ */
function envPrIn(g,el){ ENV.pr[g]=el.value; }
function envPrGuardar(){
  var pr={}, ok=true;
  ['caja','bot630_1000','bot310'].forEach(function(g){ var v=Number(String(ENV.pr[g]).replace(',','.')); if(isNaN(v)||v<0) ok=false; pr[g]=v; });
  if(!ok){ showToast('Revisa los precios','err'); return; }
  google.script.run.withSuccessHandler(function(r){ if(!r.ok){showToast(r.error,'err');return;} showToast('Precios guardados','ok'); _envRecargar(); })
    .withFailureHandler(function(e){showToast(e.message,'err');}).guardarEnvasePrecios(S.token,pr);
}
function _envVPrecios(){
  var R=[['caja','Caja plástica (620/650, 330, 1100)','S/ por caja'],['bot630_1000','Botella 630 y 1000 ml','S/ por botella'],['bot310','Botella 305 / 310 ml','S/ por botella']];
  return '<div class="sal2-card env-prec"><div class="sal2-k" style="margin-bottom:6px">Precio por unidad (valoriza las diferencias)</div>'+
    R.map(function(r){ return '<div class="env-pr"><div><b>'+r[1]+'</b><div class="env-hint">'+r[2]+'</div></div><input class="env-in" type="number" step="0.01" min="0" value="'+esc(ENV.pr[r[0]])+'" oninput="envPrIn(\''+r[0]+'\',this)"></div>'; }).join('')+
    '<div style="display:flex;gap:10px;margin-top:8px;align-items:center;flex-wrap:wrap"><span class="env-hint" style="flex:1;min-width:200px">Valores iniciales: 3.80 la caja, 0.60 la botella de 630/1000 y 0.50 la de 305. Cambiarlos afecta el cálculo del Control.</span><button class="btn btn-primary" onclick="envPrGuardar()">Guardar precios</button></div></div>';
}

/* ══ Exportar el Control ══ */
function exportEnvases(){
  if(!ENV.d){ showToast('No hay datos para exportar','err'); return; }
  var c=_envControl(); if(!c){ showToast('Aún no hay un Control para exportar','err'); return; }
  var rows=[]; c.fams.forEach(function(f){ f.filas.forEach(function(r){ r.fam=f.n; rows.push(r); }); });
  _exportXLSX(['Familia','Código','Envase','Inicial ('+_envF(ENV.ini)+')','Entradas','Devoluciones/Bajas','Ventas','Pendientes','Esperado','Contado ('+_envF(ENV.fin)+')','Diferencia','Valor S/'],
    rows,function(r){ return [r.fam,r.cod,r.nombre,r.ini,r.ent,r.dev,r.ven,r.pen,r.esp,r.cnt,r.dif,Number(r.val.toFixed(2))]; },'Envases','control_envases');
}
