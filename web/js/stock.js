/* Pantalla Stock — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   STOCK
══════════════════════════════════════ */
/* ══════════════════════════════════════
   DASHBOARD — admin / invitado
   KPIs, salidas de hoy (con vista detallada) y órdenes de compra, en el mismo estilo que el resto de pestañas.
══════════════════════════════════════ */
var DASH={d:null,m:null,sal:null,sede:'',ts:null,q:'',oc:'',go:false,visto:false};

function loadDashboard(){
  if(!S||!S.token){errBox('dashboard-root','Sin sesión activa.','dashboard');PAGE_LOADING['dashboard']=false;return;}
  _FORCE_REFRESH['dashboard']=false;
  var t = (REQ_TOKEN.dashboard = (REQ_TOKEN.dashboard||0) + 1);
  var res={dash:null,oc:null,sal:null}, falta=3;
  var listo=function(){
    if(--falta>0||t!==REQ_TOKEN.dashboard) return;
    PAGE_LOADING['dashboard']=false;
    DATA.oc=(res.oc&&res.oc.ok)?res.oc.data:[];
    DASH.sal=(res.sal&&res.sal.ok)?res.sal.data:null;   // si las salidas fallan, el resto del tablero sigue funcionando
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
  google.script.run
    .withSuccessHandler(function(r){ res.sal=r; listo(); })
    .withFailureHandler(function(){ res.sal=null; listo(); })
    .getDashboardSalidas(S.token);
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
    return {oc:o.oc,pv:o.proveedor||'-',sedeId:o.sede_id,sede:sedeN(o.sede_id),col:col,txt:txt,fecha:o.fecha,dias:dias};
  });
  // Alertas por sede: alimentan la tarjeta «Hoy requiere atención» (sev: rd crítica, am aviso, bl info)
  var al=[];
  (d.stock_negativo||[]).forEach(function(x){ al.push({sede:sedeN(x.sede_id),sev:'rd'}); });
  ocs.forEach(function(o){
    if(o.col==='v') al.push({sede:o.sede,sev:'rd'});
    if(o.col==='h') al.push({sede:o.sede,sev:'am'});
  });
  (d.pedidos_duplicados||[]).forEach(function(x){ al.push({sede:sedeN(x.sede_id),sev:'am'}); });
  (d.sin_stock_con_demanda||[]).forEach(function(x){ al.push({sede:sedeN(x.sede_id),sev:'am'}); });
  var con={}; (d.con_conteo_hoy||[]).forEach(function(id){ con[id]=true; });
  (d.sedes||[]).forEach(function(s){ if(!con[s.id]) al.push({sede:s.nombre,sev:'bl'}); });
  var ocMap={}; ocs.forEach(function(o){ ocMap[o.oc]=o; });
  return {ocs:ocs,ocMap:ocMap,alertas:al,sedes:(d.sedes||[]).map(function(s){return s.nombre;}),conteo:con};
}

function renderDashboard(r){
  if(_handleExpired(r,'dashboard-root')) return;
  if(!r||!r.ok){errBox('dashboard-root',r?r.error:'Error desconocido','dashboard');return;}
  DASH.d=r.data; DASH.m=_dashModelo(r.data); DASH.ts=new Date(); DASH.go=false; DASH.visto=false;
  if(DASH.sede && DASH.m.sedes.indexOf(DASH.sede)<0) DASH.sede='';
  dashDibujar();
}

var _DASH_ICO_DL='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
var _DASH_ICO_TR='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
var _DASH_ICO_LOGO='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';

function _dashSedesSel(){   // sedes visibles según el filtro: [{id,nombre}]
  return (DASH.d.sedes||[]).filter(function(s){ return !DASH.sede||s.nombre===DASH.sede; });
}
function _dashChipsSede(id){
  var m=DASH.m; if(m.sedes.length<2) return '';
  return '<div class="db-seg" role="group" aria-label="Sede">'+[''].concat(m.sedes).map(function(s){
    return '<button class="'+(s===DASH.sede?'on':'')+'" aria-pressed="'+(s===DASH.sede)+'" onclick="dashSede(this.dataset.s)" data-s="'+esc(s)+'">'+(s||'Todas')+'</button>';
  }).join('')+'</div>';
}

function dashDibujar(){
  var root=document.getElementById('dashboard-root'); if(!root||!DASH.m) return;
  var hora=DASH.ts?DASH.ts.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
  // Orden de la pantalla: primero las órdenes de compra y debajo Salidas · análisis (lo de hoy por sede y el análisis del periodo)
  root.innerHTML=
    '<div id="db-main" class="'+(DASH.go?'db-go ':'')+(DASH.visto?'seen':'')+'">'+
      '<div class="db-top"><div class="db-sub">'+(hora?'Actualizado '+hora:'')+'</div>'+   // el título y la fecha ya los muestra el encabezado de la página
        '<div class="db-tools">'+_dashChipsSede()+
          '<button class="db-dl" id="db-dl" aria-haspopup="true" aria-expanded="false" onclick="dashMenu(event)">'+_DASH_ICO_DL+'Descargas</button>'+
          '<div class="db-menu" id="db-menu" role="menu">'+
            '<button role="menuitem" onclick="dashExportStock()">Stock actual (todas las sedes)</button>'+
            '<button role="menuitem" onclick="dashExportModulo(\'salidas\',\'db-dl\')">Salidas</button>'+
            '<button role="menuitem" onclick="dashExportModulo(\'entradas\',\'db-dl\')">Entradas</button>'+
            '<button role="menuitem" onclick="dashExportModulo(\'mt\',\'db-dl\')">Mermas y traslados</button></div>'+
        '</div></div>'+
      '<div class="db-sec" style="margin-top:6px"><b>Órdenes de compra</b><span>Estado de recepción</span></div>'+
      '<div class="db-kpis" id="db-kpis"></div>'+
      '<div class="sal2-pnl"><div class="sal2-fl"><div class="sal2-seg" id="db-occhips" role="group" aria-label="Filtrar órdenes"></div>'+
        '<div class="sal2-srch"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
        '<input id="db-ocq" placeholder="Buscar OC, proveedor o entrega…" aria-label="Buscar orden de compra" autocomplete="off" value="'+esc(DASH.q||'')+'" oninput="DASH.q=this.value;dashOCTabla()"/></div>'+
        '<span class="sal2-cnt" id="db-ocn"></span></div><div id="db-ocs"></div></div>'+
      (DASH.sal?'<div class="db-sec db-sec-an"><b>Salidas · análisis</b><span id="an-sub"></span></div><div id="db-sedes3"></div>':'<div class="db-sec db-sec-an"><b>Salidas · análisis</b><span id="an-sub"></span></div>')+
      '<div class="sal2-pnl" style="margin-bottom:12px"><div class="an-fl"><div class="sal2-seg" id="an-pres" role="group" aria-label="Periodo"></div>'+
        '<div class="an-rng" id="an-rng"><input type="date" class="fh-in" id="an-d0" aria-label="Desde" onchange="dashAnRango()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg><input type="date" class="fh-in" id="an-d1" aria-label="Hasta" onchange="dashAnRango()"></div>'+
        '<span class="an-cnt" id="an-cnt"></span></div></div>'+
      '<div id="an-body"></div>'+
    '</div>';
  dashKpis(); if(document.getElementById('db-sedes3')) dashSedes3(); dashOCTabla(); dashAnFiltros(); dashAnCargar();
  if(!DASH.go) requestAnimationFrame(function(){ requestAnimationFrame(function(){ DASH.go=true; DASH.visto=true; var mn=document.getElementById('db-main'); if(mn) mn.classList.add('db-go','seen'); }); });
}
function dashSede(s){ DASH.sede=s||''; dashDibujar(); }

/* ── KPIs de órdenes de compra ── */
function dashKpis(){
  var el=document.getElementById('db-kpis'); if(!el) return;
  var m=DASH.m, sede=DASH.sede, ocs=m.ocs.filter(function(x){ return !sede||x.sede===sede; });
  var abiertas=ocs.filter(function(x){return x.col!=='r';}).length, hoyN=ocs.filter(function(x){return x.col==='h';}).length;
  var venc=ocs.filter(function(x){return x.col==='v';}).length, recib=ocs.filter(function(x){return x.col==='r';}).length;
  var an=DASH.visto?';animation:none;opacity:1;transform:none':'';
  var st=function(i){ return 'style="animation-delay:'+(i*45)+'ms'+an+'"'; };
  el.innerHTML=
    '<div class="sal2-card db-k" '+st(0)+'><div class="sal2-k">OC pendientes</div><div class="sal2-v">'+abiertas+'</div><div class="sal2-n">'+hoyN+(hoyN===1?' llega hoy':' llegan hoy')+'</div></div>'+
    '<div class="sal2-card db-k" '+st(1)+'><div class="sal2-k">OC vencidas</div><div class="sal2-v '+(venc?'db-v-neg':'')+'">'+venc+'</div><div class="sal2-n">sin recibir tras su fecha</div></div>'+
    '<div class="sal2-card db-k" '+st(2)+'><div class="sal2-k">Recibidas · 7 días</div><div class="sal2-v">'+recib+'</div><div class="sal2-n">por fecha de recepción</div></div>';
}

/* ── Hoy por sede: una tarjeta por sede visible; tocarla deja el Dashboard en esa sede (y tocarla otra vez vuelve a todas) ── */
function dashSedes3(){
  var el=document.getElementById('db-sedes3'); if(!el||!DASH.sal) return;
  var m=DASH.m, M=_dashSalModelo(), s=DASH.sal;
  var an=DASH.visto?';animation:none;opacity:1;transform:none':'';
  var cancHoy={}, ret={}; (s.canc||[]).forEach(function(r){ if(r.fecha===s.hoy) cancHoy[r.sede_id]=(cancHoy[r.sede_id]||0)+r.p; });
  (s.retornables||[]).forEach(function(r){ ret[r.sede_id]=[r.pend,r.total]; });
  el.innerHTML='<div class="db-sc3">'+M.ses.map(function(x,i){
    var d=M.hoy.por[x.nombre], a=M.ayer.por[x.nombre], serie=M.dias.map(function(dd){ return dd.por[x.nombre][0]; }), mx=Math.max.apply(null,serie)||1;
    var oc=m.ocs.filter(function(o){return o.sede===x.nombre;}), pen=oc.filter(function(o){return o.col!=='r';}).length, ven=oc.filter(function(o){return o.col==='v';}).length;
    var al=m.alertas.filter(function(y){return y.sede===x.nombre;}), crit=al.filter(function(y){return y.sev==='rd';}).length, avi=al.filter(function(y){return y.sev==='am';}).length;
    var est=crit?['rd',crit+(crit===1?' crítica':' críticas')]:avi?['am',avi+(avi===1?' aviso':' avisos')]:['ok','Todo en orden'];
    var r=ret[x.id]||[0,0], c=cancHoy[x.id]||0, cn=!!m.conteo[x.id];
    return '<button class="sal2-card db-sc db-k" data-s="'+esc(x.nombre)+'" onclick="dashSede(DASH.sede?\'\':this.dataset.s)" aria-label="'+(DASH.sede?'Ver todas las sedes':'Ver solo la sede '+esc(x.nombre))+'" style="animation-delay:'+(i*45)+'ms'+an+'">'+
      '<div class="hd"><span class="nm">'+esc(x.nombre)+'</span><span class="db-st '+est[0]+'"><i></i>'+est[1]+'</span></div>'+
      '<div class="big"><b>'+fmt(d[0])+'</b><span>pedidos hoy · ayer '+fmt(a[0])+'</span></div>'+
      '<div class="spk" aria-hidden="true">'+serie.map(function(v){ return '<i style="height:'+Math.max(8,v/mx*100)+'%"></i>'; }).join('')+'</div>'+
      '<dl><dt>Unidades hoy</dt><dd>'+fmt(d[1])+'</dd>'+
        '<dt>Retornables por confirmar</dt><dd class="'+(r[0]?'':'ok')+'">'+r[0]+' de '+r[1]+'</dd>'+
        '<dt>Cancelados hoy</dt><dd class="'+(c?'':'mut')+'">'+c+'</dd>'+
        '<dt>OC pendientes</dt><dd>'+pen+(ven?' · <span style="color:#FF8A9B">'+ven+(ven===1?' vencida':' vencidas')+'</span>':'')+'</dd>'+
        '<dt>Conteo de hoy</dt><dd class="'+(cn?'ok':'neg')+'">'+(cn?'Registrado':'Sin conteo')+'</dd></dl>'+
      '<div class="go">'+(DASH.sede?'Ver todas las sedes ←':'Ver solo '+esc(x.nombre)+' →')+'</div></button>';
  }).join('')+'</div>';
}

/* ── Salidas: datos por día, hora y sede a partir de dashboard_salidas ── */
function _dashSalModelo(){
  var s=DASH.sal, ses=_dashSedesSel(), ids={}; ses.forEach(function(x){ ids[x.id]=x.nombre; });
  var fechas=[]; for(var k=6;k>=0;k--) fechas.push(new Date(Date.parse(s.hoy+'T00:00:00Z')-k*86400000).toISOString().slice(0,10));
  var fmtDia=new Intl.DateTimeFormat('es-PE',{weekday:'short',timeZone:'UTC'});
  var dia={}; (s.dias||[]).forEach(function(r){ if(ids[r.sede_id]) dia[r.sede_id+'|'+r.fecha]=[r.p,r.u]; });
  var dias=fechas.map(function(f){
    var por={}, p=0, u=0;
    ses.forEach(function(x){ var v=dia[x.id+'|'+f]||[0,0]; por[x.nombre]=v; p+=v[0]; u+=v[1]; });
    var nm=fmtDia.format(new Date(f+'T12:00:00Z')).replace('.',''); nm=nm.charAt(0).toUpperCase()+nm.slice(1);
    return {f:f,n:nm,fd:_dashFecha(f),por:por,p:p,u:u};
  });
  var cancHoy=0; (s.canc||[]).forEach(function(r){ if(ids[r.sede_id]&&r.fecha===s.hoy) cancHoy+=r.p; });
  var ret=0, pend=0; (s.retornables||[]).forEach(function(r){ if(ids[r.sede_id]){ ret+=r.total; pend+=r.pend; } });
  return {ses:ses,dias:dias,hoy:dias[dias.length-1],ayer:dias[dias.length-2],cancHoy:cancHoy,ret:ret,pend:pend};
}
/* ── Salidas · análisis: periodo y fechas, KPIs sin montos, sedes, horas y meses (la sede se elige arriba, con los chips de todo el Dashboard) ── */
var DASH_AN={pre:'7',d0:'',d1:'',data:null,cargando:false,err:'',cache:{}};
var _AN_PRES=[['7','Últimos 7 días'],['sp','Semana pasada'],['mes','Este mes'],['mp','Mes pasado'],['rg','Rango']];
var _AN_COL=['#7B61EF','#B9AEFF','#5C5C80','#8A7BF0'];

function _anMas(iso,n){ return new Date(Date.parse(iso+'T00:00:00Z')+n*86400000).toISOString().slice(0,10); }
function _anDM(iso){ return String(iso||'').slice(8,10)+'/'+String(iso||'').slice(5,7); }
function _anRango(){
  var hoy=DASH.d.hoy, pre=DASH_AN.pre;
  if(pre==='rg') return [DASH_AN.d0||_anMas(hoy,-6), DASH_AN.d1||hoy];
  if(pre==='sp'){ var dow=new Date(hoy+'T12:00:00Z').getUTCDay()||7; return [_anMas(hoy,-dow-6),_anMas(hoy,-dow)]; }
  if(pre==='mes') return [hoy.slice(0,8)+'01',hoy];
  if(pre==='mp'){ var ini=hoy.slice(0,8)+'01', fin=_anMas(ini,-1); return [fin.slice(0,8)+'01',fin]; }
  return [_anMas(hoy,-6),hoy];
}
function dashAnFiltros(){
  var pres=document.getElementById('an-pres'); if(!pres) return;
  pres.innerHTML=_AN_PRES.map(function(p){ return '<button class="'+(DASH_AN.pre===p[0]?'on':'')+'" aria-pressed="'+(DASH_AN.pre===p[0])+'" data-p="'+p[0]+'" onclick="dashAnPre(this.dataset.p)">'+p[1]+'</button>'; }).join('');
  var rg=document.getElementById('an-rng'); if(rg) rg.classList.toggle('on',DASH_AN.pre==='rg');
  var r=_anRango(), a=document.getElementById('an-d0'), b=document.getElementById('an-d1'); if(a) a.value=r[0]; if(b){ b.value=r[1]; b.max=DASH.d.hoy; }
}
function dashAnPre(p){ DASH_AN.pre=p; if(p==='rg'&&!DASH_AN.d0){ var r=_anRango(); DASH_AN.d0=r[0]; DASH_AN.d1=r[1]; } dashAnFiltros(); dashAnCargar(); }
function dashAnRango(){
  var a=document.getElementById('an-d0').value, b=document.getElementById('an-d1').value; if(!a||!b) return;
  if(a>b){ var t=a; a=b; b=t; }
  DASH_AN.d0=a; DASH_AN.d1=b>DASH.d.hoy?DASH.d.hoy:b; dashAnFiltros(); dashAnCargar();
}
function dashAnCargar(){
  var r=_anRango(), key=r[0]+'|'+r[1], body=document.getElementById('an-body'); if(!body) return;
  if(DASH_AN.cache[key]){ DASH_AN.data=DASH_AN.cache[key]; DASH_AN.err=''; dashAnCuerpo(); return; }
  DASH_AN.cargando=true; DASH_AN.err='';
  body.innerHTML=LD('Calculando salidas');
  var tk=(DASH_AN.tk=(DASH_AN.tk||0)+1);
  google.script.run
    .withSuccessHandler(function(res){
      if(tk!==DASH_AN.tk) return;   // se pidió otro rango mientras tanto
      DASH_AN.cargando=false;
      if(!res||!res.ok){ DASH_AN.err=(res&&res.error)||'No se pudo calcular'; dashAnCuerpo(); return; }
      DASH_AN.cache[key]=res.data; DASH_AN.data=res.data; dashAnCuerpo();
    })
    .withFailureHandler(function(e){ if(tk!==DASH_AN.tk) return; DASH_AN.cargando=false; DASH_AN.err=e.message; dashAnCuerpo(); })
    .getSalidasAnalisis(S.token,r[0],r[1]);
}
function _anDelta(cur,ant,ok){
  if(!ok||!ant) return '<b>sin dato anterior</b>';
  var d=(cur-ant)/ant*100, c=d>0.05?'up':d<-0.05?'dn':'';
  return '<b class="'+c+'">'+(d>0?'+':'')+d.toFixed(1).replace('.',',')+'%</b>';
}
function _anPct(d){ return (d>0?'+':'')+d.toFixed(1).replace('.',',')+'%'; }
function dashAnCuerpo(){
  var body=document.getElementById('an-body'); if(!body) return;
  if(DASH_AN.err){ body.innerHTML='<div class="err-box">'+esc(DASH_AN.err)+'</div>'; return; }
  var D=DASH_AN.data; if(!D) return;
  var r=_anRango(), a=r[0], b=r[1], n=Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000)+1;
  var pa=_anMas(a,-n), pb=_anMas(a,-1), okPrev=pa>=D.primera;
  var ses=(DASH.d.sedes||[]).filter(function(s){ return !DASH.sede||s.nombre===DASH.sede; }), ids={}; ses.forEach(function(s){ ids[s.id]=true; });
  var suma=function(campo,x,y,id){ return (D.dias||[]).reduce(function(t,d){ return (d.fecha>=x&&d.fecha<=y&&(id?d.sede_id===id:ids[d.sede_id]))?t+d[campo]:t; },0); };
  var p=suma('p',a,b), u=suma('u',a,b), pp=okPrev?suma('p',pa,pb):0, pu=okPrev?suma('u',pa,pb):0;
  var sub=document.getElementById('an-sub'), cnt=document.getElementById('an-cnt'), anio=a.slice(0,4);
  if(sub) sub.textContent=(DASH.sede?DASH.sede:(ses.length>1?'Las '+(ses.length===3?'tres':ses.length)+' sedes':'Sede'))+' · del '+_anDM(a)+' al '+_anDM(b)+' de '+anio;
  if(cnt) cnt.textContent=n+(n===1?' día':' días')+' · comparado con '+(okPrev?'el '+_anDM(pa)+' al '+_anDM(pb):'el periodo anterior (sin datos)');
  var dp=p/n, du=u/n, pdp=pp/n, pdu=pu/n;
  var kpis='<div class="an-k">'+
    '<div class="sal2-card an-c"><div class="sal2-k">Total de pedidos</div><div class="sal2-v">'+fmt(p)+'</div><div class="an-d">'+_anDelta(p,pp,okPrev)+'<span>vs periodo anterior ('+fmt(pp)+')</span></div></div>'+
    '<div class="sal2-card an-c"><div class="sal2-k">Pedidos diarios · promedio</div><div class="sal2-v">'+dp.toFixed(1).replace('.',',')+'</div><div class="an-d">'+_anDelta(dp,pdp,okPrev)+'<span>por día</span></div></div>'+
    '<div class="sal2-card an-c"><div class="sal2-k">Total de unidades</div><div class="sal2-v">'+fmt(u)+'<small>und.</small></div><div class="an-d">'+_anDelta(u,pu,okPrev)+'<span>vs periodo anterior ('+fmt(pu)+')</span></div></div>'+
    '<div class="sal2-card an-c"><div class="sal2-k">Unidades diarias · promedio</div><div class="sal2-v">'+fmt(Math.round(du))+'<small>und.</small></div><div class="an-d">'+_anDelta(du,pdu,okPrev)+'<span>'+(p?(u/p).toFixed(1).replace('.',','):'0')+' und. por pedido</span></div></div></div>';

  // pedidos por sede: barras agrupadas (periodo elegido contra el anterior) y tabla
  var canc={}; (D.canc||[]).forEach(function(c){ canc[c.sede_id]=c.p; });
  var sm={}; (D.sin_motorizado||[]).forEach(function(c){ sm[c.sede_id]=[c.total,c.sin]; });
  var mx=Math.max.apply(null,ses.map(function(s){ return Math.max(suma('p',a,b,s.id),okPrev?suma('p',pa,pb,s.id):0); }).concat([1]));
  var grp=ses.map(function(s){
    var c=suma('p',a,b,s.id), o=okPrev?suma('p',pa,pb,s.id):0;
    return '<div class="an-gc"><div class="an-gb"><div class="ant"><b>'+(okPrev?fmt(o):'-')+'</b><i style="height:'+(o/mx*100)+'%"></i></div><div class="act"><b>'+fmt(c)+'</b><i style="height:'+Math.max(c/mx*100,1)+'%"></i></div></div><small>'+esc(s.nombre)+'</small></div>';
  }).join('');
  var filas=ses.map(function(s){
    var c=suma('p',a,b,s.id), o=okPrev?suma('p',pa,pb,s.id):0, d=o?(c-o)/o*100:null, sh=p?c/p*100:0, cn=canc[s.id]||0, pc=(c+cn)?cn/(c+cn)*100:0, v=sm[s.id]||[0,0], ps=v[0]?v[1]/v[0]*100:0;
    return '<tr><td><div class="an-nm">'+esc(s.nombre)+'</div></td><td class="r an-n em">'+fmt(c)+'</td>'+
      '<td class="r">'+(d==null?'<span class="an-n">-</span>':'<span class="an-v '+(d>0.05?'up':d<-0.05?'dn':'')+'">'+_anPct(d)+'</span>')+'</td>'+
      '<td class="r col-m"><span class="an-sh"><span class="an-n">'+sh.toFixed(1).replace('.',',')+'%</span><i style="--w:'+sh+'%"></i></span></td>'+
      '<td class="r an-n col-m">'+fmt(suma('u',a,b,s.id))+'</td><td class="r an-n">'+cn+'</td><td class="r"><span class="an-v'+(pc>7?' warn':'')+'">'+pc.toFixed(1).replace('.',',')+'%</span></td>'+
      '<td class="r an-n col-m">'+Math.round(ps)+'%</td></tr>';
  }).join('');
  var tabla='<table><thead><tr><th>Sede</th><th class="r">Pedidos</th><th class="r">Variación</th><th class="r col-m">% del total</th><th class="r col-m">Unidades</th><th class="r" title="Pedidos cancelados en el periodo">Cancel.</th><th class="r" title="Cancelados sobre pedidos más cancelados">% cancel.</th><th class="r col-m" title="Pedidos sin motorizado asignado">Sin moto.</th></tr></thead><tbody>'+filas+
    '<tr class="an-tot"><td>Total</td><td class="r an-n em">'+fmt(p)+'</td><td class="r">'+(okPrev&&pp?'<span class="an-v '+(p>pp?'up':p<pp?'dn':'')+'">'+_anPct((p-pp)/pp*100)+'</span>':'-')+'</td><td class="r an-n col-m">100%</td><td class="r an-n col-m">'+fmt(u)+'</td><td colspan="3"></td></tr></tbody></table>';
  var sedesHtml='<div class="an-2"><div class="sal2-card an-g"><h4>Pedidos por sede <small>'+ses.length+(ses.length===1?' sede':' sedes')+'</small></h4><div class="nota">Periodo elegido frente al periodo anterior de la misma duración</div><div class="an-grp">'+grp+'</div>'+
    '<div class="an-lg"><span><em style="background:linear-gradient(180deg,#B9AEFF,#7B61EF)"></em>Periodo elegido</span><span><em style="background:rgba(255,255,255,.25)"></em>Periodo anterior</span></div></div>'+
    '<div class="sal2-pnl" style="display:flex;flex-direction:column"><div class="table-wrap an-t" style="margin-top:18px">'+tabla+'</div></div></div>';

  var top=D.top||[], mot=D.motivos||[];
  var extra='<div class="dt-2" style="margin-top:12px">'+
    '<div class="sal2-card dt-c" style="margin:0"><h4>Productos más vendidos <small>por unidades</small></h4>'+
      (top.length?top.map(function(t){ return '<div class="dt-li"><span title="'+esc(t.d)+'">'+esc(t.d)+'</span><b>'+fmt(t.u)+' und.</b><div class="bar"><i style="width:'+(t.u/top[0].u*100)+'%"></i></div><small>'+t.p+' pedidos</small></div>'; }).join(''):'<div class="dt-nota" style="border:0;margin:0;padding:0">Sin ventas en el periodo</div>')+'</div>'+
    '<div class="sal2-card dt-c" style="margin:0"><h4>Motivos de cancelación <small>todas las sedes</small></h4>'+
      (mot.length?mot.map(function(x){ return '<div class="dt-li"><span>'+esc(x.m)+'</span><b>'+x.p+' pedidos</b><div class="bar"><i style="width:'+(x.p/mot[0].p*100)+'%"></i></div></div>'; }).join(''):'<div class="dt-nota" style="border:0;margin:0;padding:0">Sin cancelaciones en el periodo</div>')+'</div></div>';

  body.innerHTML='<div class="'+(DASH.go?'an-go':'')+'" id="an-wrap">'+kpis+sedesHtml+'<div class="sal2-card an-g" id="an-hora"></div>'+_anMesesHtml(D,ses)+extra+'</div>';
  _anHora(D,ids,a,b);
  if(!DASH.go) requestAnimationFrame(function(){ requestAnimationFrame(function(){ var w=document.getElementById('an-wrap'); if(w) w.classList.add('an-go'); }); });
  else requestAnimationFrame(function(){ var w=document.getElementById('an-wrap'); if(w) w.classList.add('an-go'); });
}

/* Pedidos por hora: curva con área y detalle al apuntar (horas reales de cada pedido) */
function _anHora(D,ids,a,b){
  var el=document.getElementById('an-hora'); if(!el) return;
  var por={}, tot=0; (D.horas||[]).forEach(function(h){ if(ids[h.sede_id]){ por[h.h]=(por[h.h]||0)+h.p; tot+=h.p; } });
  var sedeTxt=DASH.sede?DASH.sede+' · ':'';
  if(!tot){ el.innerHTML='<h4>Pedidos por hora</h4><div class="nota">Sin pedidos con hora registrada en este periodo.</div>'; return; }
  var hs=Object.keys(por).map(Number).filter(function(h){ return por[h]>=tot*0.01; });
  var h0=Math.min.apply(null,hs.concat([8])), h1=Math.max.apply(null,hs.concat([22])), H=h1-h0+1, v=[];
  for(var h=h0;h<=h1;h++) v.push(por[h]||0);
  var mx=Math.max.apply(null,v), pk=v.indexOf(mx), p10=Math.pow(10,Math.floor(Math.log10(mx))), top=Math.max(mx,Math.ceil(mx/p10)*p10);
  var W=800, Ht=200, L=34, R=8, T=14, B=26, iw=W-L-R, ih=Ht-T-B;
  var X=function(i){ return L+i/(H-1)*iw; }, Y=function(x){ return T+ih-(x/top)*ih; };
  var pts=v.map(function(x,i){ return [X(i),Y(x)]; });
  var d='M'+pts[0][0]+' '+pts[0][1];
  for(var i=0;i<pts.length-1;i++){ var p0=pts[Math.max(i-1,0)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(i+2,pts.length-1)];
    d+=' C'+(p1[0]+(p2[0]-p0[0])/6)+' '+(p1[1]+(p2[1]-p0[1])/6)+' '+(p2[0]-(p3[0]-p1[0])/6)+' '+(p2[1]-(p3[1]-p1[1])/6)+' '+p2[0]+' '+p2[1]; }
  var area=d+' L'+X(H-1)+' '+(T+ih)+' L'+X(0)+' '+(T+ih)+' Z';
  var gl=[0,0.5,1].map(function(f){ var y=T+ih-f*ih; return '<line class="gl" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(L-6)+'" y="'+(y+3)+'" text-anchor="end">'+Math.round(top*f)+'</text>'; }).join('');
  var xs=v.map(function(_,i){ return '<text x="'+X(i)+'" y="'+(Ht-6)+'" text-anchor="middle"'+(i===pk?' class="pk"':'')+'>'+(h0+i)+'</text>'; }).join('');
  el.innerHTML='<h4>Pedidos por hora <small>'+esc(sedeTxt)+'del '+_anDM(a)+' al '+_anDM(b)+'</small></h4><div class="nota">Frecuencia de pedidos durante el día. Hora pico: '+(h0+pk)+':00 con '+mx+' pedidos.</div>'+
    '<div class="an-area" id="an-ar"><svg viewBox="0 0 '+W+' '+Ht+'" preserveAspectRatio="none" role="img" aria-label="Pedidos por hora, pico a las '+(h0+pk)+':00">'+gl+
    '<defs><linearGradient id="an-ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7B61EF" stop-opacity=".45"/><stop offset="1" stop-color="#7B61EF" stop-opacity="0"/></linearGradient></defs>'+
    '<path class="area" d="'+area+'" fill="url(#an-ag)"/><path class="ln" d="'+d+'"/>'+xs+
    '<text class="pk" x="'+X(pk)+'" y="'+(Y(mx)-8)+'" text-anchor="middle">'+mx+'</text>'+
    '<line class="cur" id="an-cur" y1="'+T+'" y2="'+(T+ih)+'"/><circle class="dot" id="an-dot" r="4.5"/></svg><div class="an-tip" id="an-tip" role="status"></div></div>';
  var ar=document.getElementById('an-ar'), svg=ar.querySelector('svg'), tip=document.getElementById('an-tip');
  var mover=function(cx){
    var rc=svg.getBoundingClientRect(), i=Math.max(0,Math.min(H-1,Math.round(((cx-rc.left)/rc.width*W-L)/iw*(H-1)))), px=X(i)/W*rc.width;
    var cur=document.getElementById('an-cur'), dot=document.getElementById('an-dot');
    cur.setAttribute('x1',X(i)); cur.setAttribute('x2',X(i)); dot.setAttribute('cx',X(i)); dot.setAttribute('cy',Y(v[i]));
    tip.innerHTML='<b>De '+(h0+i)+':00 a '+(h0+i+1)+':00</b><div>Pedidos<em>'+v[i]+'</em></div><div>Del total<em>'+(v[i]/tot*100).toFixed(1).replace('.',',')+'%</em></div>';
    var w=tip.offsetWidth||150, x=Math.max(w/2,Math.min(rc.width-w/2,px)); tip.style.left=x+'px'; tip.style.top=Math.max(0,(Y(v[i])/Ht*rc.height)-70)+'px';
    ar.classList.add('on'); tip.classList.add('on');
  };
  ar.onpointermove=function(e){ if(e.pointerType==='mouse'||e.buttons) mover(e.clientX); };
  ar.onpointerdown=function(e){ mover(e.clientX); };
  ar.onpointerleave=function(){ ar.classList.remove('on'); tip.classList.remove('on'); };
}

/* Pedidos por mes y sede (desde que hay datos). El mes en curso se marca como parcial. */
function _anMesesHtml(D,ses){
  var todas=DASH.d.sedes||[], meses=[], mapa={};
  (D.meses||[]).forEach(function(m){ if(meses.indexOf(m.mes)<0) meses.push(m.mes); mapa[m.mes+'|'+m.sede_id]=m.p; });
  meses.sort();
  if(!meses.length) return '';
  var nom=new Intl.DateTimeFormat('es-PE',{month:'short',timeZone:'UTC'});
  var etq=function(mes){ var t=nom.format(new Date(mes+'-15T12:00:00Z')).replace('.',''); return t.charAt(0).toUpperCase()+t.slice(1); };
  var hoyMes=DASH.d.hoy.slice(0,7), ultimoDia=_anMas(_anMas(hoyMes+'-01',32).slice(0,8)+'01',-1), parcial=function(mes){ return mes===hoyMes&&DASH.d.hoy!==ultimoDia; };
  var vis={}; ses.forEach(function(s){ vis[s.id]=true; });
  var tt=meses.map(function(m){ return todas.reduce(function(t,s){ return t+(mapa[m+'|'+s.id]||0); },0); }), mx=Math.max.apply(null,tt.concat([1]));
  var col=function(i){ return _AN_COL[i%_AN_COL.length]; };
  var barras=meses.map(function(m,i){ var cur=m===meses[meses.length-1];
    return '<div class="an-mc'+(cur?' cur':'')+'"><b>'+fmt(tt[i])+'</b><div class="col" style="height:'+(tt[i]/mx*100)+'%;flex:none">'+todas.map(function(s,k){ return '<i style="flex:'+(mapa[m+'|'+s.id]||0)+';background:'+col(k)+'"></i>'; }).join('')+'</div><small>'+etq(m)+(parcial(m)?' (parcial)':'')+'</small></div>';
  }).join('');
  var lg=todas.map(function(s,k){ return '<span><em style="background:'+col(k)+'"></em>'+esc(s.nombre)+'</span>'; }).join('');
  var filas=todas.map(function(s){
    var t=meses.reduce(function(a,m){ return a+(mapa[m+'|'+s.id]||0); },0);
    return '<tr'+(DASH.sede===s.nombre?' class="an-act"':'')+'><td><div class="an-nm">'+esc(s.nombre)+'</div></td>'+meses.map(function(m){ return '<td class="r an-n">'+fmt(mapa[m+'|'+s.id]||0)+'</td>'; }).join('')+'<td class="r an-n em">'+fmt(t)+'</td></tr>';
  }).join('');
  var primera=D.primera?_anDM(D.primera)+'/'+D.primera.slice(0,4):'';
  return '<div class="sal2-card an-g"><h4>Pedidos por mes <small>'+etq(meses[0])+' a '+etq(meses[meses.length-1])+' de '+meses[meses.length-1].slice(0,4)+'</small></h4><div class="nota">Cada color es una sede.'+(parcial(meses[meses.length-1])?' El último mes es parcial: llega hasta el '+_anDM(DASH.d.hoy)+'.':'')+'</div>'+
    '<div class="an-ms" style="grid-template-columns:repeat('+meses.length+',1fr)">'+barras+'</div><div class="an-lg">'+lg+'</div>'+
    '<div class="sal2-pnl" style="margin:16px -8px 0"><div class="table-wrap an-t"><table><thead><tr><th>Sede</th>'+meses.map(function(m){ return '<th class="r">'+etq(m)+'</th>'; }).join('')+'<th class="r">Total</th></tr></thead><tbody>'+filas+
    '<tr class="an-tot"><td>Total</td>'+tt.map(function(x){ return '<td class="r an-n em">'+fmt(x)+'</td>'; }).join('')+'<td class="r an-n em">'+fmt(tt.reduce(function(a,b){return a+b;},0))+'</td></tr></tbody></table></div></div>'+
    '<div class="an-info">La comparación contra el mismo mes del año anterior estará disponible cuando haya un año de historial: las salidas empiezan el '+primera+'.</div></div>';
}

/* ── Órdenes de compra: una sola tabla con chips por estado ── */
function _dashOCFilas(){
  var m=DASH.m, ids={}; (DASH.d.sedes||[]).forEach(function(s){ ids[s.id]=s.nombre; });
  return (DATA.oc||[]).map(function(r){
    var o=m.ocMap[r.oc], sede=ids[r.sedeId]||'';
    var col=o?o.col:(r.estado==='Recibido'?'r':r.estado==='Cancelada'?'x':'p');
    var txt=o?o.txt:(r.estado==='Recibido'?'Recibida':r.estado==='Cancelada'?'Cancelada':'Pendiente');
    return {oc:r.oc,pv:r.proveedor,en:r.entrega,sede:sede,f:r.fechaRecepcion,col:col,txt:txt};
  }).filter(function(x){ return !DASH.sede||x.sede===DASH.sede; });
}
var _DASH_RANK={v:0,h:1,p:2,r:3,x:4};
function dashOCTabla(){
  var el=document.getElementById('db-ocs'); if(!el) return;
  var all=_dashOCFilas(), c={'':all.length,v:0,h:0,p:0,r:0};
  all.forEach(function(x){ if(c[x.col]!=null) c[x.col]++; });
  var chips=document.getElementById('db-occhips');
  if(chips) chips.innerHTML=[['','Todas'],['v','Vencidas'],['h','Llegan hoy'],['p','Próximas'],['r','Recibidas']].map(function(x){
    return '<button class="'+(DASH.oc===x[0]?'on':'')+'" aria-pressed="'+(DASH.oc===x[0])+'" onclick="dashOCChip(this.dataset.f)" data-f="'+x[0]+'">'+x[1]+' <span>'+c[x[0]]+'</span></button>';
  }).join('');
  var q=(DASH.q||'').toLowerCase();
  var iso=function(d){ var p=String(d||'').split('/'); return p.length===3?p[2]+p[1]+p[0]:''; };
  var L=all.filter(function(x){ return (!DASH.oc||x.col===DASH.oc)&&(!q||((x.oc||'')+' '+(x.pv||'')+' '+(x.en||'')).toLowerCase().indexOf(q)>-1); });
  L.sort(function(a,b){
    var ra=_DASH_RANK[a.col]-_DASH_RANK[b.col]; if(ra) return ra;
    var fa=iso(a.f), fb=iso(b.f); return (a.col==='r'||a.col==='x')?(fa<fb?1:fa>fb?-1:0):(fa<fb?-1:fa>fb?1:0);
  });
  var n=document.getElementById('db-ocn'); if(n) n.textContent=L.length+(L.length===1?' orden':' órdenes');
  var admin=S&&S.rol==='admin';
  var h='<div class="table-wrap"><table><thead><tr><th>Orden de compra</th><th class="col-hide-mobile">Proveedor</th><th class="col-hide-mobile">Entrega</th><th class="col-hide-mobile">Sede</th><th class="col-hide-mobile">Fecha</th><th>Estado</th>'+(admin?'<th class="col-hide-mobile" style="width:1%"></th>':'')+'</tr></thead><tbody>';
  h+=L.length?L.map(function(x){
    var del=admin?'<button class="db-x" data-oc="'+esc(x.oc)+'" aria-label="Eliminar la orden '+esc(x.oc)+'" onclick="event.stopPropagation();dashEliminarOC(this.dataset.oc)">'+_DASH_ICO_TR+'Eliminar</button>':'';
    return '<tr class="db-oc" data-oc="'+esc(x.oc)+'" tabindex="0" role="button" aria-label="Ver el detalle de '+esc(x.oc)+'" onclick="abrirDetalleEntradaOCGlobal(this.dataset.oc)">'+
      '<td><div class="db-n">'+esc(x.oc)+'</div><div class="db-mm">'+esc(x.pv)+(x.sede?' · '+esc(x.sede):'')+'</div>'+(admin?'<div class="db-am">'+del+'</div>':'')+'</td>'+
      '<td class="db-pv col-hide-mobile" title="'+esc(x.pv)+'">'+esc(x.pv)+'</td><td class="db-pv col-hide-mobile" title="'+esc(x.en)+'">'+esc(x.en||'-')+'</td><td class="db-pv col-hide-mobile">'+esc(x.sede||'-')+'</td>'+
      '<td class="db-m col-hide-mobile">'+esc(x.f||'-')+'</td><td><span class="db-pill '+x.col+'"><i></i>'+esc(x.txt)+'</span></td>'+
      (admin?'<td class="col-hide-mobile"><div class="db-a">'+del+'</div></td>':'')+'</tr>';
  }).join(''):'<tr><td colspan="7" class="db-vacio">Ninguna orden coincide.<br>Prueba con otro estado, proveedor o número.</td></tr>';
  el.innerHTML=h+'</tbody></table></div>';
}
function dashOCChip(f){ DASH.oc=f||''; dashOCTabla(); }

// Eliminar una OC (solo el administrador): las entradas ya registradas con esa OC no se borran
function dashEliminarOC(oc){
  var o=(DATA.oc||[]).filter(function(x){return x.oc===oc;})[0]; if(!o) return;
  _confirmDialog('Eliminar orden de compra',
    'Se eliminará la orden '+oc+' ('+(o.proveedor||'sin proveedor')+'). Las entradas ya registradas con esta OC no se borran. Esta acción no se puede deshacer.',
    function(){
      google.script.run
        .withSuccessHandler(function(r){
          if(!r||!r.ok){ showToast((r&&r.error)||'No se pudo eliminar la orden','err'); return; }
          DATA.oc=(DATA.oc||[]).filter(function(x){return x.oc!==oc;});
          DASH.d.oc=(DASH.d.oc||[]).filter(function(x){return x.oc!==oc;});
          DASH.m=_dashModelo(DASH.d);
          showToast('Orden '+oc+' eliminada','ok');
          dashDibujar();
        })
        .withFailureHandler(function(e){ showToast(e.message,'err'); })
        .eliminarOC(S.token,oc);
    },'Eliminar');
}

/* Menú Descargas y teclado */
function dashMenu(e){
  if(e) e.stopPropagation();
  var m=document.getElementById('db-menu'), b=document.getElementById('db-dl'); if(!m) return;
  var on=!m.classList.contains('on'); m.classList.toggle('on',on); b.setAttribute('aria-expanded',on);
  if(on){ var f=m.querySelector('button'); if(f) f.focus(); }
}
document.addEventListener('click',function(){
  var m=document.getElementById('db-menu'); if(m&&m.classList.contains('on')){ m.classList.remove('on'); var b=document.getElementById('db-dl'); if(b) b.setAttribute('aria-expanded','false'); }
});
document.addEventListener('keydown',function(e){
  var t=e.target;
  if((e.key==='Enter'||e.key===' ')&&t&&t.classList&&t.classList.contains('db-oc')){ e.preventDefault(); t.click(); return; }
  if(e.key==='Escape'){
    var m=document.getElementById('db-menu');
    if(m&&m.classList.contains('on')){ m.classList.remove('on'); var b=document.getElementById('db-dl'); if(b){ b.setAttribute('aria-expanded','false'); b.focus(); } return; }
  }
});

function dashExportStock(){
  var btn=document.getElementById('db-dl'), orig=btn?btn.innerHTML:'';
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
  _STK_CAT='';
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
  _STK_T=Date.now();
  var sinCosto=rows.filter(function(x){return x.stock>0&&!x.costo;}).length;
  var packTot=rows.reduce(function(a,x){return a+(x.stock>0?(x.stockPack||0):0);},0);
  var undK=totalUnd>=1000?(totalUnd/1000).toFixed(1)+' K':fmt(totalUnd);
  var pc=function(n){return (n/tot*100).toFixed(2);};
  var costoK=costoTotal>=1000?(costoTotal/1000).toFixed(1)+' K':fmt(Math.round(costoTotal));
  var icoBuscar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var seg=function(id,val,txt,n){return '<button class="stk-sb'+(val===''?' active':'')+'" id="'+id+'" onclick="setStockFiltroEstado(\''+val+'\')">'+txt+'<span>'+n+'</span></button>';};
  var leg=function(val,color,n,txt){return '<span onclick="setStockFiltroEstado(\''+val+'\')" tabindex="0" role="button" data-kb><em style="background:'+color+'"></em><b>'+n+'</b> '+txt+'</span>';};

  var icoExportar='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var pctCon=rows.length?Math.round(conStock/rows.length*100):0;
  var cn={}; rows.forEach(function(x){ if(x.categoria) cn[x.categoria]=(cn[x.categoria]||0)+1; });
  var catCirc=cats.slice().sort(function(a,b){return cn[b]-cn[a];}).map(function(c){
    return '<button type="button" class="stk-ci" data-cat="'+esc(c)+'" onclick="stkCat(this.dataset.cat)"><span class="c">'+esc(c.charAt(0).toUpperCase())+'<em>'+cn[c]+'</em></span>'+esc(c)+'</button>';}).join('');
  var alerta=function(k,n,txt,acc,col,ico){ return n>0?'<div class="stk-al" style="--c:'+col+'" onclick="stkAl(\''+k+'\')" tabindex="0" role="button" data-kb><div class="t"><div class="ic">'+ico+'</div><div class="n">'+fmt(n)+'</div></div><div class="l">'+txt+'</div><div class="go">'+acc+' →</div></div>':''; };
  var alertas=alerta('neg',negativos,'Negativos: salieron más unidades de las que entraron','Revisar','#E39AA2','<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17v.5"/></svg>')+
    alerta('sp',sinCosto,'Con stock pero sin costo: falta el precio en el maestro','Ver productos','#E8B84A','<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 15.5v.5"/></svg>');
  var anillo=function(){ var C=188.5, a=conStock/tot*C, b=sinStock/tot*C, g=negativos/tot*C;
    var seg=function(l,o,col){ return l>0?'<circle cx="40" cy="40" r="30" fill="none" stroke="'+col+'" stroke-width="9" class="stk-rs" stroke-dasharray="0 '+C+'" data-da="'+Math.max(l-2,1).toFixed(1)+'" stroke-dashoffset="'+(-o).toFixed(1)+'" transform="rotate(-90 40 40)"/>':''; };
    return '<svg class="stk-ring" viewBox="0 0 80 80" width="96" height="96" aria-hidden="true"><circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="9"/>'+seg(a,0,'#5AD19A')+seg(b,a,'rgba(255,255,255,.55)')+seg(g,a+b,'#E39AA2')+'<text x="40" y="39" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">'+pctCon+'%</text><text x="40" y="51" text-anchor="middle" font-size="9" fill="rgba(255,255,255,.8)">con stock</text></svg>'; };
  document.getElementById('stock-root').innerHTML=
    '<div class="stk-hero">'+
      '<div class="stk-top"><button type="button" class="stk-hb" onclick="toggleMobileMenu()" aria-label="Menú"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>'+
        '<div class="stk-ms"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg><input id="stock-busq-m" placeholder="Buscar SKU…" oninput="stkBusqM(this.value)" autocomplete="off"/></div>'+
        '<div class="stk-sd">'+esc(_sedeBonita(S.usuario||'').replace(/^DS\s+/i,''))+'<svg viewBox="0 0 24 24"><path d="M5 9l7 7 7-7"/></svg></div></div>'+
      '<div class="stk-hello"><i></i><span id="stk-upd">Actualizado ahora</span></div>'+
      '<h1 class="stk-h1">Tu stock,<br><span>bajo control</span></h1>'+
    '<div class="stk-sum">'+
      '<div class="stk-card stk-card-h">'+anillo()+'<div class="stk-cb"><div class="stk-k">Control de inventario</div>'+
        '<div class="stk-v"><span data-n="'+rows.length+'">'+fmt(rows.length)+'</span><small>SKUs</small></div>'+
        '<div class="stk-dist"><i style="width:'+pc(conStock)+'%;background:var(--ok)"></i><i style="width:'+pc(sinStock)+'%;background:var(--text4)"></i><i style="width:'+pc(negativos)+'%;background:var(--danger)"></i></div>'+
        '<div class="stk-leg">'+leg('con','var(--ok)','<span data-n="'+conStock+'">'+conStock+'</span>','Con stock')+leg('sin','var(--text4)','<span data-n="'+sinStock+'">'+sinStock+'</span>','Sin stock')+leg('neg','var(--danger)','<span data-n="'+negativos+'">'+negativos+'</span>','Negativos')+'</div></div></div>'+
      '<div class="stk-card"><div class="stk-k">Unidades en stock</div><div class="stk-v"><span data-n="'+totalUnd+'">'+fmt(totalUnd)+'</span><small>und.</small></div><div class="stk-n">Solo stock positivo'+(packTot?' · '+fmt(Math.round(packTot))+' packs':'')+'</div></div>'+
      '<div class="stk-card"><div class="stk-k">Costo total</div><div class="stk-v">S/ '+(costoTotal>=1000?'<span data-n="'+(costoTotal/1000).toFixed(1)+'" data-d="1">'+(costoTotal/1000).toFixed(1)+'</span> K':fmt(Math.round(costoTotal)))+'</div><div class="stk-n">S/ '+fmt(Math.round(costoTotal*10)/10)+' en total</div></div>'+
    '</div></div>'+
    (alertas?'<div class="stk-alw"><div class="stk-sec"><b>Requiere atención</b><span>Toca para filtrar</span></div><div class="stk-als">'+alertas+'</div></div>':'')+
    '<div class="stk-sec"><b>Categorías</b><a onclick="stkVerCats()" id="stk-vc">Ver todas</a></div>'+
    '<div class="stk-cats" id="stk-cats"><button type="button" class="stk-ci add" onclick="abrirSKUForm(null)"><span class="c">+</span>Nuevo</button>'+catCirc+'</div>'+
    '<div class="sal2-pnl">'+
    '<div class="sal2-fl">'+
      '<div class="sal2-seg">'+seg('sbtn-todos','','Todos',rows.length)+seg('sbtn-con','con','Con stock',conStock)+seg('sbtn-sin','sin','Sin stock',sinStock)+seg('sbtn-neg','neg','Negativos',negativos)+'</div>'+
      '<div class="sal2-srch">'+icoBuscar+'<input id="stock-busq" placeholder="Buscar SKU o producto…" oninput="filterStock()"/></div>'+
      '<select class="stk-sel" id="stock-cat" onchange="filterStock()"><option value="">Todas las categorías</option>'+catOpts+'</select>'+
      '<select class="stk-sel" id="stock-mar" onchange="filterStock()"><option value="">Todas las marcas</option>'+marOpts+'</select>'+
      '<span class="sal2-cnt" id="stock-count"></span>'+
      '<button id="btn-export-stock" class="sal2-exp" onclick="exportStock()">'+icoExportar+'<span id="stk-exp-t">Exportar</span></button>'+
    '</div>'+
    '<div class="stk-sec"><b>Productos</b><span class="stk-so"><span id="stk-sec-n"></span><button type="button" class="stk-sort" onclick="stkOrden()"><span id="stk-ord">'+_STK_ORDL[_STK_ORD]+'</span><svg viewBox="0 0 24 24"><path d="M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3"/></svg></button></span></div>'+
    '<div class="stk-tw"><table class="stk-t">'+
      '<thead><tr><th>Producto</th><th class="r">Movimientos</th><th class="r">Stock</th><th class="r">Pack</th><th class="r">Costo</th><th>Estado</th><th></th></tr></thead>'+
      '<tbody id="stock-tbody"></tbody>'+
    '</table></div>'+
    '<div class="stk-cards" id="stock-cards"></div>'+
    '</div>';

  var ob=document.getElementById('stk-cbar'); if(ob) ob.remove();
  var cb=document.createElement('div'); cb.id='stk-cbar'; cb.className='stk-cbar';
  cb.innerHTML='<button type="button" class="stk-hb" onclick="toggleMobileMenu()" aria-label="Menú"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><div class="stk-pk"><span>'+fmt(rows.length)+' SKUs</span><b>'+undK+' und.</b><b>S/ '+costoK+'</b></div>';
  document.body.appendChild(cb);
  if(_STK_IO) _STK_IO.disconnect();
  if('IntersectionObserver' in window){
    _STK_IO=new IntersectionObserver(function(es){
      var e=es[es.length-1], r=e.boundingClientRect;
      cb.classList.toggle('on', !e.isIntersecting && r.height>0 && r.bottom<70 && window.innerWidth<=820);
    },{rootMargin:'-70px 0px 0px 0px'});
    _STK_IO.observe(document.querySelector('.stk-hero'));
  }
  _STK_H={};
  if(!document.getElementById('stk-dr')){
    var dr=document.createElement('div'); dr.id='stk-dr';
    dr.innerHTML='<button class="x" onclick="stkCerrar()" aria-label="Cerrar">×</button><div id="stk-drc"></div>';
    document.body.appendChild(dr);
    var dm=document.createElement('div'); dm.id='stk-dim'; dm.onclick=stkCerrar; document.body.appendChild(dm);
  }
  stkCerrar();
  filterStock();
  stkAnim();
}

function setStockFiltroEstado(val){
  _STOCK_ESTADO_FILTRO = val;
  ['todos','con','sin','neg'].forEach(function(k){
    var btn = document.getElementById('sbtn-'+k);
    if(btn) btn.classList.toggle('active', (val==='' ? k==='todos' : k===val));
  });
  filterStock();
}

// Lo que se ve en pantalla y lo que se exporta salen de la misma funcion: busqueda, categoria, marca, estado y orden
function _stkFiltrados(){
  var q=(document.getElementById('stock-busq')||{}).value||'';
  var cat=(document.getElementById('stock-cat')||{}).value||'';
  var mar=(document.getElementById('stock-mar')||{}).value||'';
  q=q.toLowerCase();
  var filtered=(DATA.stock||[]).filter(function(r){
    if(!(!q||r.sku.toLowerCase().indexOf(q)>-1||r.desc.toLowerCase().indexOf(q)>-1)) return false;
    if(!(!cat||r.categoria===cat)) return false;
    if(!(!mar||r.marca===mar)) return false;
    if(_STOCK_ESTADO_FILTRO==='con') return r.stock>0;
    if(_STOCK_ESTADO_FILTRO==='sin') return r.stock===0;
    if(_STOCK_ESTADO_FILTRO==='neg') return r.stock<0;
    if(_STOCK_ESTADO_FILTRO==='sp') return r.stock>0&&!r.costo;
    return true;
  });
  filtered.sort(function(a,b){ return _STK_ORD===0?b.stock-a.stock:_STK_ORD===1?a.stock-b.stock:String(a.desc).localeCompare(String(b.desc)); });
  return filtered;
}
var _STK_ESTADO_TXT={'':'productos',con:'con stock',sin:'sin stock',neg:'negativos',sp:'sin costo'};
function _filterStock(){
  var filtered=_stkFiltrados();
  var et=document.getElementById('stk-exp-t');   // solo la tienda exporta lo filtrado; el administrador descarga el pivot de todas las sedes
  if(et) et.textContent=(S&&S.rol==='store')?'Exportar '+filtered.length+' '+(_STK_ESTADO_TXT[_STOCK_ESTADO_FILTRO]||'productos'):'Exportar';
  var el=document.getElementById('stock-count');
  if(el)el.textContent=filtered.length+' productos';
  var sn=document.getElementById('stk-sec-n'); if(sn) sn.textContent=filtered.length+' productos';
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
  return '<tr onclick="stkAbrir('+r._row+')" tabindex="0" role="button" data-kb aria-label="Abrir detalle de '+esc(r.desc)+'">'+
    '<td><div class="stk-pn">'+esc(r.desc)+'</div><div class="stk-ps"><span class="sk">'+esc(r.sku)+'</span>'+
      (r.marca?'<i class="dot"></i><span>'+esc(r.marca)+'</span>':'')+(r.categoria?'<i class="dot"></i><span>'+esc(r.categoria)+'</span>':'')+'</div></td>'+
    '<td class="r"><div class="stk-mv"><span class="e" title="Entradas">+'+fmt(r.entradas)+'</span><span class="s" title="Salidas">−'+fmt(r.salidas)+'</span>'+(r.mt?'<span class="m" title="Mermas y traslados">M-T '+fmt(r.mt)+'</span>':'')+'</div></td>'+
    '<td class="r"><div class="stk-stk"><div class="stk-bar"><i style="width:'+Math.min(100,Math.abs(r.stock)/mx*100)+'%;background:'+_STK_COL[e]+'"></i></div><b'+(e==='ng'?' style="color:var(--danger)"':'')+'>'+fmt(r.stock)+'</b></div></td>'+
    '<td class="r">'+Math.round(r.stockPack)+'</td>'+
    '<td class="r">'+(r.costo?'S/ '+fmt(r.costo):'-')+'</td>'+
    '<td><span class="stk-pill '+e+'">'+_STK_LAB[e]+'</span></td>'+
    '<td class="r"><button class="stk-ed" onclick="event.stopPropagation();abrirSKUForm('+r._row+')">Editar</button></td>'+
  '</tr>';
}
function _stkPk(v,r){ if(!(r&&r.packs>0)) return ''; var x=v/r.packs, e=Math.abs(x-Math.round(x))<.05; return (e?fmt(Math.round(x)):x.toLocaleString('es-PE',{minimumFractionDigits:1,maximumFractionDigits:1}))+' packs'; }
var _STK_IO=null, _STK_H={}, _STK_ROW=0;
var _STK_CAT='', _STK_T=0, _STK_ORD=0, _STK_ORDL=['Mayor stock','Menor stock','A–Z'];
function stkOrden(){ _STK_ORD=(_STK_ORD+1)%3; var e=document.getElementById('stk-ord'); if(e) e.textContent=_STK_ORDL[_STK_ORD]; filterStock(); }
function stkAl(k){ setStockFiltroEstado(_STOCK_ESTADO_FILTRO===k?'':k); var c=document.getElementById('stk-cats'); if(c&&c.parentNode) c.scrollIntoView({block:'start',behavior:'smooth'}); }
function stkUpd(){ var e=document.getElementById('stk-upd'); if(!e||!_STK_T) return; var m=Math.floor((Date.now()-_STK_T)/60000); e.textContent=m<1?'Actualizado ahora':'Actualizado hace '+m+' min'; }
setInterval(function(){ if(!document.hidden) stkUpd(); },30000);

/* Entrada suave: los números suben contando y el anillo se dibuja (solo en móvil y sin "reducir movimiento") */
function stkAnim(){
  var rs=document.querySelectorAll('#stock-root .stk-rs');
  var fin=function(){ rs.forEach(function(c){ c.setAttribute('stroke-dasharray',c.dataset.da+' 188.5'); }); };
  setTimeout(fin,60);
  if(!_STK.mq.matches||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  document.querySelectorAll('#stock-root [data-n]').forEach(function(e){
    var to=+e.dataset.n, d=+(e.dataset.d||0), t0=null, ok=function(){ e.textContent=d?to.toFixed(d):fmt(to); };
    setTimeout(ok,1500);
    (function f(t){ if(!t0) t0=t; var k=Math.min((t-t0)/1100,1), v=to*(1-Math.pow(1-k,3)); e.textContent=d?v.toFixed(d):Math.round(v).toLocaleString('es-PE'); if(k<1) requestAnimationFrame(f); else e.textContent=d?to.toFixed(d):fmt(to); })(performance.now());
  });
}
function stkBusqM(v){ var i=document.getElementById('stock-busq'); if(i){ i.value=v; filterStock(); } }
function stkVerCats(){ var c=document.getElementById('stk-cats'), a=document.getElementById('stk-vc'); if(!c) return; var on=c.classList.toggle('all'); if(a) a.textContent=on?'Ver menos':'Ver todas'; }
function stkCat(c){
  _STK_CAT=(_STK_CAT===c?'':c);
  var s=document.getElementById('stock-cat'); if(s) s.value=_STK_CAT;
  document.querySelectorAll('.stk-ci[data-cat]').forEach(function(b){ b.classList.toggle('on',b.dataset.cat===_STK_CAT); });
  filterStock();
}
function _stkCard(r){
  var e=r.stock>0?'ok':(r.stock<0?'ng':'no'), ini=esc((r.desc||'?').charAt(0).toUpperCase()), t=((r.desc||'?').charCodeAt(0)||0)%5;
  return '<div class="stk-cd" onclick="stkAbrir('+r._row+')" tabindex="0" role="button" data-kb aria-label="Abrir detalle de '+esc(r.desc)+'"><div class="stk-av t'+t+'">'+ini+'<i class="'+e+'"></i></div>'+
    '<div class="stk-m"><div class="stk-t1"><b>'+esc(r.desc)+'</b><span>'+_STK_LAB[e]+'</span></div>'+
    '<p><u'+(e==='ng'?' class="ng"':'')+'>'+fmt(r.stock)+' und.</u>'+(r.packs>0?' · '+_stkPk(r.stock,r):'')+' · '+esc(r.sku)+(r.marca?' · '+esc(r.marca):'')+'</p></div></div>';
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
var _STK_FOCO=null;   // elemento que abrio el panel: al cerrarlo el foco vuelve ahi
function stkAbrir(row){
  var r=(DATA.stock||[]).filter(function(x){return x._row===row;})[0]; if(!r) return;
  _STK_FOCO=document.activeElement;
  var e=r.stock>0?'ok':(r.stock<0?'ng':'no');
  var c=document.getElementById('stk-drc'); if(!c) return;
  var pk=function(v){ var t=_stkPk(v,r); return t?'<small>'+t+'</small>':''; };
  var tienda=S&&S.rol==='store';
  var mb='<div class="stk-mb"><div class="stk-grab" onclick="stkCerrar()"></div><div class="stk-sk">'+esc(r.sku)+'</div><h3>'+esc(r.desc)+'</h3>'+
    '<div class="stk-sub">'+(r.marca?esc(r.marca):'')+(r.marca&&r.categoria?' · ':'')+(r.categoria?esc(r.categoria):'')+'</div>'+
    '<div class="stk-big"><div><div class="v"'+(e==='ng'?' style="color:var(--danger)"':'')+'>'+fmt(r.stock)+'<small>und.</small></div>'+(r.packs>0?'<div class="stk-vp">≈ '+_stkPk(r.stock,r)+'</div>':'')+'</div><span class="stk-pl '+e+'">'+_STK_LAB[e]+'</span></div>'+
    '<div class="stk-chart" id="stk-ch"><div class="stk-chl">Cargando evolución…</div></div>'+
    '<div class="stk-st3"><div><span>Entradas</span><b class="e">+'+fmt(r.entradas)+'</b>'+pk(r.entradas)+'</div><div><span>Salidas</span><b>−'+fmt(r.salidas)+'</b>'+pk(r.salidas)+'</div><div><span>M-T</span><b class="m">'+fmt(r.mt)+'</b>'+pk(r.mt)+'</div></div>'+
    '<div class="stk-st3 d2"><div><span>Costo en inventario</span><b>'+(r.costo?'S/ '+fmt(r.costo):'-')+'</b></div><div><span>Unidades por pack</span><b>'+(r.packs>0?fmt(r.packs):'-')+'</b></div></div>'+
    (e==='ng'?'<div class="stk-warn">Salieron más unidades de las que entraron. Revisa las entradas o haz un conteo.</div>':'')+
    '<div class="stk-btns">'+(tienda?'<button type="button" class="stk-b e" onclick="stkIr(\'entradas\')">'+_stkIc('<path d="M12 4v13"/><path d="M6 12l6 6 6-6"/>')+'Entrada</button><button type="button" class="stk-b s" onclick="stkIr(\'salidas\')">'+_stkIc('<path d="M12 20V7"/><path d="M6 12l6-6 6 6"/>')+'Salida</button><button type="button" class="stk-b g" onclick="stkIr(\'conteo\')">'+_stkIc('<path d="M5 9h14M5 15h14M9 4L7 20M17 4l-2 16"/>')+'Contar</button>':'')+
    '<button type="button" class="stk-b g'+(tienda?'':' w')+'" onclick="stkCerrar();abrirSKUForm('+r._row+')">'+_stkIc('<path d="M4 20h4l11-11-4-4L4 16z"/>')+'Editar SKU</button></div></div>';
  c.innerHTML=mb+'<div class="stk-dk">'+
    '<div class="stk-ps" style="margin:0 0 6px"><span class="sk">'+esc(r.sku)+'</span></div>'+
    '<h3>'+esc(r.desc)+'</h3>'+
    '<div class="stk-ps">'+(r.marca?'<span>'+esc(r.marca)+'</span>':'')+(r.marca&&r.categoria?'<i class="dot"></i>':'')+(r.categoria?'<span>'+esc(r.categoria)+'</span>':'')+'</div>'+
    '<div class="stk-g2"><div><span class="stk-k">Stock</span><b'+(e==='ng'?' style="color:var(--danger)"':'')+'>'+fmt(r.stock)+'</b></div><div><span class="stk-k">Pack</span><b>'+Math.round(r.stockPack)+'</b></div></div>'+
    '<div class="stk-rowm"><span>Entradas</span><b style="color:var(--ok)">+'+fmt(r.entradas)+'</b></div>'+
    '<div class="stk-rowm"><span>Salidas</span><b>−'+fmt(r.salidas)+'</b></div>'+
    '<div class="stk-rowm"><span>Mermas y traslados</span><b>'+fmt(r.mt)+'</b></div>'+
    '<div class="stk-rowm"><span>Costo en inventario</span><b>'+(r.costo?'S/ '+fmt(r.costo):'-')+'</b></div>'+
    (e==='ng'?'<div class="stk-warn">Salieron más unidades de las que entraron. Revisa las entradas o haz un conteo.</div>':'')+
    '<div style="margin-top:18px"><button class="btn btn-primary" style="width:100%" onclick="stkCerrar();abrirSKUForm('+r._row+')">Editar SKU</button></div></div>';
  document.getElementById('stk-dr').classList.add('on');
  var dm=document.getElementById('stk-dim'); if(dm) dm.classList.add('on');
  var bx=document.querySelector('#stk-dr .x'); if(bx) setTimeout(function(){ bx.focus(); },50);
  stkEvol(r);
}
function _stkIc(p){ return '<svg viewBox="0 0 24 24">'+p+'</svg>'; }
function stkIr(n){ stkCerrar(); navTo(n,document.getElementById('nav-'+n)); }
/* Evolución del stock de los últimos 30 días: se arma hacia atrás desde el stock de hoy con las entradas, salidas y M-T de cada día */
function stkEvol(r){
  _STK_ROW=r._row;
  var h=_STK_H[r._row];
  if(h&&Date.now()-h.t<60000){ _stkDibujar(r,h.d); return; }
  google.script.run
    .withSuccessHandler(function(res){
      if(!res||!res.ok){ _stkChMsg(r,'No se pudo cargar la evolución'); return; }
      _STK_H[r._row]={ t:Date.now(), d:res.data };
      _stkDibujar(r,res.data);
    })
    .withFailureHandler(function(){ _stkChMsg(r,'No se pudo cargar la evolución'); })
    .getStockHistorial(S.token,r._row,30);
}
function _stkChMsg(r,txt){ var el=document.getElementById('stk-ch'); if(el&&_STK_ROW===r._row) el.innerHTML='<div class="stk-chl">'+txt+'</div>'; }
function _stkDibujar(r,d){
  var el=document.getElementById('stk-ch'); if(!el||_STK_ROW!==r._row) return;
  var N=30, fechas=[], ahora=Date.now(), k, fmtLima=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima'});   // hora de Lima, igual que la base, sin importar la zona del equipo
  for(k=N;k>=0;k--) fechas.push(fmtLima.format(new Date(ahora-k*86400000)));
  var delta=fechas.map(function(f){ return (d.e[f]||0)-(d.s[f]||0)-(d.m[f]||0); });
  if(!delta.some(function(x){return x!==0;})){ el.innerHTML='<div class="stk-chl">Sin movimientos en los últimos 30 días</div>'; return; }
  var v=new Array(N+1), cur=r.stock; v[N]=cur;
  for(k=N;k>0;k--){ cur-=delta[k]; v[k-1]=cur; }
  var mx=Math.max.apply(null,v), mn=Math.min.apply(null,v), W=300, H=120, id='stkg'+r._row;
  var dd='M'+v.map(function(y,i){ return (i/N*W).toFixed(1)+','+(H-6-(y-mn)/(mx-mn||1)*(H-12)).toFixed(1); }).join(' L');
  var base=v[N-7], pc=base!==0?Math.round((v[N]-base)/Math.abs(base)*100):null;
  el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A86F2" stop-opacity=".5"/><stop offset="1" stop-color="#9A86F2" stop-opacity="0"/></linearGradient></defs><path d="'+dd+' L'+W+','+H+' L0,'+H+' Z" fill="url(#'+id+')"/><path d="'+dd+'" fill="none" stroke="#9A86F2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>'+
    '<div class="stk-cl"><span>hace 30 días</span>'+(pc===null?'':'<span>'+(pc>=0?'▲ +':'▼ ')+pc+'% en 7 días</span>')+'<span>hoy</span></div>';
}
function stkCerrar(){
  var d=document.getElementById('stk-dr'), abierto=!!(d&&d.classList.contains('on'));
  if(d) d.classList.remove('on'); var m=document.getElementById('stk-dim'); if(m) m.classList.remove('on');
  if(abierto&&_STK_FOCO&&document.contains(_STK_FOCO)){ try{ _STK_FOCO.focus(); }catch(e){} }
  _STK_FOCO=null;
}
// Teclado: Enter o Espacio activan filas, tarjetas y alertas (data-kb); Escape cierra el panel de detalle
document.addEventListener('keydown',function(e){
  var t=e.target;
  if((e.key==='Enter'||e.key===' ')&&t&&t.hasAttribute&&t.hasAttribute('data-kb')){ e.preventDefault(); t.click(); return; }
  if(e.key==='Escape'){ var d=document.getElementById('stk-dr'); if(d&&d.classList.contains('on')) stkCerrar(); }
});

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

/* ══════════════════════════════════════
   NUEVO / EDITAR SKU — asistente de 2 pasos
   1 Datos del producto · 2 Revisar y guardar (así se verá en Stock)
══════════════════════════════════════ */
var SK={paso:1,dir:1,modo:'nuevo',row:null,sheetId:null,sede:'',sku:'',sap:'',desc:'',pack:0,packOtro:false,precio:'',marca:'',cat:'',
        chk:'idle',dup:null,mHit:null,mBusy:false,fin:false,keep:true,orig:null,saving:false,run:0,chkRun:0,tm:null,bound:false};
var SKU_CACHE=[];                 // productos conocidos al abrir el formulario: avisa códigos repetidos y sugiere marcas/categorías
var SK_PACKS=[1,6,12,24];         // presentaciones habituales (unidades por pack); "Otro" permite cualquier número
var SK_MX={m:false,c:false};      // chips de marca/categoría desplegados
var SK_NOM=['Datos del producto','Revisar y guardar'];
var _skEl=function(id){ return document.getElementById(id); };
var _skEdit=function(){ return SK.modo==='editar'; };
var _skAdmin=function(){ return !!S&&S.rol==='admin'; };   // elegir tienda destino al crear: solo administrador
var _skMaestro=function(){ return !!S&&(S.rol==='admin'||S.rol==='store'); };   // SAP y precio (Maestro global): administrador y tiendas
function _skMoney(n){ return Number(n).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
var _SK_CHK='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
var _SK_CHK16='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
var _SK_LOCK='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

function abrirSKUForm(rowNum){
  var edit=rowNum!==null&&rowNum!==undefined;
  SKU_CACHE=(DATA.stock||[]).map(function(r){return {sku:String(r.sku||''),desc:r.desc||'',marca:r.marca||'',categoria:r.categoria||'',_row:r._row,sede:r.sede||''};});
  SK.run++; SK.chkRun++; clearTimeout(SK.tm);
  SK.paso=1; SK.dir=1; SK.fin=false; SK.saving=false; SK.modo=edit?'editar':'nuevo'; SK.row=edit?rowNum:null; SK.sheetId=null; SK.sede='';
  SK.sku=''; SK.sap=''; SK.desc=''; SK.pack=0; SK.packOtro=false; SK.precio=''; SK.marca=''; SK.cat='';
  SK.chk='idle'; SK.dup=null; SK.mHit=null; SK.mBusy=false; SK.orig=null; SK_MX={m:false,c:false};
  _skErr('');
  if(edit){
    var row=(DATA.stock||[]).find(function(r){return r._row===rowNum;});
    if(!row) return;
    SK.sheetId=row.sheetId||null; SK.sede=row.sede||'';
    SK.sku=row.sku; SK.desc=row.desc; SK.marca=row.marca; SK.cat=row.categoria;
    SK.pack=row.packs>0?row.packs:0; SK.packOtro=SK.pack>0&&SK_PACKS.indexOf(SK.pack)<0;
    SK.precio=row.precio>0?String(row.precio):'';
    SK.chk='ok';
    SK.orig={sku:row.sku,desc:row.desc,marca:row.marca,cat:row.categoria,pack:SK.pack,sap:'',precio:SK.precio};
    // el SAP no viene en el Stock: se trae del Maestro mientras se muestra el formulario
    var run=SK.run; SK.mBusy=true;
    google.script.run
      .withSuccessHandler(function(r){
        if(run!==SK.run) return;
        SK.mBusy=false;
        if(r&&r.ok&&r.existe){ SK.sap=r.sap||''; if(!SK.precio&&r.precio) SK.precio=r.precio; }
        SK.orig.sap=SK.sap; SK.orig.precio=SK.precio;
        skCargarCampos(); skActualizar();
      })
      .withFailureHandler(function(){ if(run!==SK.run) return; SK.mBusy=false; skCargarCampos(); skActualizar(); })
      .getMaestroSKU(S.token,row.sku);
  }
  skBind();
  skCargarCampos();
  skRender(false);
  openFS('fs-sku');
  setTimeout(function(){ var e=_skEl(edit?'sku-desc':'sku-lovis'); if(e) e.focus(); },160);
}

/* ── escribe el estado en los campos (al abrir, al cargar el Maestro y al pasar a "agregar otro") ── */
function skCargarCampos(){
  var set=function(id,v){ var e=_skEl(id); if(e&&e.value!==v) e.value=v; };
  set('sku-lovis',SK.sku); set('sku-sap',SK.sap); set('sku-desc',SK.desc); set('sku-precio',SK.precio);
  set('sku-marca',SK.marca); set('sku-categoria',SK.cat); set('sku-pack',SK.packOtro&&SK.pack?String(SK.pack):'');
  _skEl('sku-dcount').textContent=SK.desc.length+' / 120';
  var maestro=_skMaestro();
  var sap=_skEl('sku-sap'), pr=_skEl('sku-precio');
  sap.disabled=!maestro||SK.mBusy; pr.disabled=!maestro||SK.mBusy;
  sap.placeholder=SK.mBusy?'Cargando…':'Ej: 4000123';
  // sede (solo administrador creando)
  var sw=_skEl('sk-sede-wrap');
  if(_skAdmin()&&!_skEdit()){
    var tiendas=[...new Set((DATA.stock||[]).map(function(r){return r.sede;}).filter(Boolean))].sort();
    _skEl('sk-sedes').innerHTML=tiendas.map(function(t){return '<button type="button" class="sk-pill'+(SK.sede===t?' on':'')+'" onclick="skPickSede(this.dataset.s)" data-s="'+esc(t)+'">'+esc(t)+'</button>';}).join('');
    sw.style.display='';
  } else sw.style.display='none';
  _skEl('sk-packs').innerHTML=skPackPills();
  _skEl('sk-pko').classList.toggle('hidden',!SK.packOtro);
  skPackHelp(); skChips(); skSkuUI(); skMaestroHints();
}

function skBind(){
  if(SK.bound) return; SK.bound=true;
  var si=_skEl('sku-lovis'), sa=_skEl('sku-sap'), di=_skEl('sku-desc'), pr=_skEl('sku-precio'), po=_skEl('sku-pack'), mi=_skEl('sku-marca'), ci=_skEl('sku-categoria');
  si.addEventListener('input',function(){ SK.sku=si.value; skCheck(); });
  sa.addEventListener('input',function(){ var v=sa.value.replace(/\D/g,''); if(v!==sa.value) sa.value=v; SK.sap=v; skMaestroHints(); skActualizar(); });
  di.addEventListener('input',function(){ SK.desc=di.value; _skEl('sku-dcount').textContent=di.value.length+' / 120'; skMaestroHints(); skActualizar(); });
  pr.addEventListener('input',function(){ var v=pr.value.replace(/[^0-9.]/g,''), i=v.indexOf('.'); if(i>-1) v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,''); if(v!==pr.value) pr.value=v; SK.precio=v; skMaestroHints(); skActualizar(); });
  po.addEventListener('input',function(){ var n=parseInt(po.value,10); SK.pack=n>=1?n:0; skPackHelp(); skActualizar(); });
  mi.addEventListener('input',function(){ SK.marca=mi.value; skChips(); skActualizar(); });
  ci.addEventListener('input',function(){ SK.cat=ci.value; skChips(); skActualizar(); });
  /* Enter recorre los campos; al terminar la categoría pasa a revisar */
  var enter=function(el,fn){ el.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); fn(); } }); };
  enter(si,function(){ (sa.disabled?di:sa).focus(); });
  enter(sa,function(){ di.focus(); });
  enter(di,function(){ skFocusPack(); });
  enter(po,function(){ (pr.disabled?mi:pr).focus(); });
  enter(pr,function(){ mi.focus(); });
  enter(mi,function(){ ci.focus(); });
  enter(ci,function(){ if(skDatosOk()) skRevisar(); });
  _skEl('sk-packs').addEventListener('keydown',function(e){
    var b=[].slice.call(this.querySelectorAll('.sk-pill')), i=b.indexOf(document.activeElement);
    if(e.key==='ArrowRight'&&i<b.length-1){ e.preventDefault(); b[i+1].focus(); }
    if(e.key==='ArrowLeft'&&i>0){ e.preventDefault(); b[i-1].focus(); }
  });
}

/* ── validación del código: formato, repetido en el Stock y búsqueda en el Maestro ── */
function skCheck(){
  clearTimeout(SK.tm);
  var n=++SK.chkRun, v=SK.sku.trim();
  SK.dup=null; SK.mHit=null; SK.mBusy=false;
  if(!v){ SK.chk='idle'; skSkuUI(); skMaestroHints(); skActualizar(); return; }
  if(!/^[A-Za-z0-9\-_.]+$/.test(v)){ SK.chk='fmt'; skSkuUI(); skMaestroHints(); skActualizar(); return; }
  var sedeSel=SK.sede;
  if(_skEdit()) sedeSel=SK.sede;   // al editar solo cuenta la sede del producto (el mismo código puede existir en otra sede)
  var ex=SKU_CACHE.filter(function(r){
    return r.sku.toLowerCase()===v.toLowerCase() && r._row!==SK.row && (!sedeSel||!r.sede||r.sede===sedeSel);
  })[0]||null;
  if(ex){ SK.chk='dup'; SK.dup=ex; skSkuUI(); skMaestroHints(); skActualizar(); return; }
  SK.chk='ok'; skSkuUI(); skActualizar();               // disponible: no se espera a la consulta del Maestro para poder seguir
  if(_skEdit()&&SK.orig&&v===SK.orig.sku){ skMaestroHints(); return; }
  SK.mBusy=true; skSkuUI();
  SK.tm=setTimeout(function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(n!==SK.chkRun) return;
        SK.mBusy=false;
        if(r&&r.ok&&r.existe){
          SK.mHit=r;
          if(!SK.sap&&r.sap){ SK.sap=r.sap; skCargarCampos(); }
          if(!SK.precio&&r.precio){ SK.precio=r.precio; skCargarCampos(); }
        }
        skSkuUI(); skMaestroHints(); skActualizar();
      })
      .withFailureHandler(function(){ if(n!==SK.chkRun) return; SK.mBusy=false; skSkuUI(); skMaestroHints(); })
      .getMaestroSKU(S.token,v);
  },300);
}
function skSkuUI(){
  var inp=_skEl('sku-lovis'); if(!inp) return;
  var mal=SK.chk==='dup'||SK.chk==='fmt';
  inp.className='sk-in lg'+(mal?' bad':(SK.chk==='ok'&&SK.sku.trim()?' good':''));
  _skEl('sk-stt').innerHTML=SK.mBusy?'<span class="sk-spin"></span>':(SK.chk==='ok'?'<span class="okc">'+_SK_CHK+'</span>':(mal?'<span class="bdc">!</span>':''));
  var h=_skEl('sku-lovis-h'), ex=SK.dup;
  if(SK.chk==='dup'&&ex){
    h.innerHTML='<div class="sk-dup"><b>Este SKU ya existe en tu Stock</b>'+esc(ex.desc)+(ex.marca?' · '+esc(ex.marca):'')+
      (ex._row>0?'<br><button type="button" onclick="abrirSKUForm('+ex._row+')">Editar ese producto</button>':'')+'</div>';
  } else if(SK.chk==='fmt'){
    h.innerHTML='<div class="sk-hint err">Usa solo letras, números, guiones o puntos.</div>';
  } else if(SK.mBusy){
    h.innerHTML='<div class="sk-hint mut">Buscando en el Maestro…</div>';
  } else if(SK.chk==='ok'&&!_skEdit()){
    h.innerHTML='<div class="sk-hint ok">'+_SK_CHK+' Código disponible'+(SK.mHit?' · ya está en el Maestro':'')+'</div>';
  } else h.innerHTML='';
}
// Avisos de SAP y precio (bloqueados para tiendas; ayudas para el administrador) y atajo para usar la descripción del Maestro
function skMaestroHints(){
  var maestro=_skMaestro();
  var sh=_skEl('sku-sap-h'), ph=_skEl('sku-precio-h'); if(!sh||!ph) return;
  var lock='<div class="sk-lock">'+_SK_LOCK+'<span>Lo completa el administrador (Maestro).</span></div>';
  if(!maestro){ sh.innerHTML=lock; ph.innerHTML=lock; }
  else {
    sh.innerHTML=(SK.sap&&!/^[0-9]{4,10}$/.test(SK.sap))?'<div class="sk-hint err">Solo números (de 4 a 10 dígitos).</div>':'';
    ph.innerHTML='<div class="sk-hint mut">Se guarda en el Maestro (lo ven todas las tiendas) y valoriza el Stock: costo = precio × unidades.</div>';
  }
  if(SK.mHit&&SK.mHit.desc&&!SK.desc.trim()){
    var h=_skEl('sku-lovis-h');
    if(h&&!h.querySelector('.sk-dup')&&!h.querySelector('.sk-usar'))
      h.insertAdjacentHTML('beforeend','<div class="sk-hint mut sk-usar">En el Maestro: «'+esc(SK.mHit.desc)+'» <button type="button" onclick="skUsarDescMaestro()">Usar descripción</button></div>');
  }
}
function skUsarDescMaestro(){
  if(!SK.mHit||!SK.mHit.desc) return;
  SK.desc=SK.mHit.desc.slice(0,120); skCargarCampos(); skActualizar();
  var d=_skEl('sku-desc'); if(d) d.focus();
}

/* ── presentación (unidades por pack) ── */
function skPackPills(){
  return SK_PACKS.map(function(n){ return '<button type="button" class="sk-pill'+(!SK.packOtro&&SK.pack===n?' on':'')+'" onclick="skPickPack('+n+')">'+(n===1?'Unidad':'Pack x'+n)+'</button>'; }).join('')+
         '<button type="button" class="sk-pill'+(SK.packOtro?' on':'')+'" onclick="skPickPack(0)">Otro</button>';
}
function skPackHelp(){
  var h=_skEl('sk-pack-h'); if(!h) return;
  var pk=SK.pack;
  if(!pk){ h.className='sk-hint mut'; h.textContent='Elige cómo viene para poder calcular los packs.'; return; }
  var ej=pk===1?24:pk*4;
  h.className='sk-hint ok';
  h.innerHTML=_SK_CHK+(pk===1?' Se cuenta por unidad: 1 pack = 1 unidad.':' Cada pack trae '+pk+' unidades · ej.: '+ej+' unidades = '+(ej/pk)+' packs');
}
function skFocusPack(){ var b=document.querySelector('#sk-packs .sk-pill.on')||document.querySelector('#sk-packs .sk-pill'); if(b) b.focus(); }
function skPickPack(n){
  if(n===0){ SK.packOtro=true; SK.pack=parseInt(_skEl('sku-pack').value,10)||0; }
  else { SK.packOtro=false; SK.pack=n; }
  _skEl('sk-packs').innerHTML=skPackPills();
  _skEl('sk-pko').classList.toggle('hidden',!SK.packOtro);
  skPackHelp(); skActualizar();
  setTimeout(function(){
    if(SK.paso!==1) return;
    var next=SK.packOtro?_skEl('sku-pack'):(_skEl('sku-precio').disabled?_skEl('sku-marca'):_skEl('sku-precio'));
    if(next) next.focus();
  },60);
}
function skPickSede(nombre){
  SK.sede=nombre;
  document.querySelectorAll('#sk-sedes .sk-pill').forEach(function(b){ b.classList.toggle('on',b.dataset.s===nombre); });
  if(SK.sku.trim()) skCheck(); else skActualizar();
  setTimeout(function(){ var e=_skEl('sku-lovis'); if(e) e.focus(); },80);
}

/* ── sugerencias de marca/categoría a partir de lo ya cargado (3 visibles + "+N") ── */
function _skLista(campo){
  var vistos={}, lista=[];
  SKU_CACHE.forEach(function(r){ var x=r[campo]; if(x&&!vistos[x]){ vistos[x]=true; lista.push(x); } });
  return lista.sort();
}
function _skChipsHTML(lista,val,fn,key){
  var v=val.trim().toLowerCase();
  var items=lista.filter(function(x){ return !v||x.toLowerCase().indexOf(v)>-1; });
  items.sort(function(a,b){ return (b.toLowerCase()===v)-(a.toLowerCase()===v); });      // el elegido va primero
  var LIM=3, extra=items.length-LIM, ver=SK_MX[key]?items:items.slice(0,LIM);
  var h=ver.map(function(x){ return '<button type="button" class="'+(x.toLowerCase()===v?'on':'')+'" data-v="'+esc(x)+'" onclick="'+fn+'(this.dataset.v)">'+esc(x)+'</button>'; }).join('');
  if(extra>0) h+='<button type="button" class="more" onclick="skMas(\''+key+'\')">'+(SK_MX[key]?'Menos':'+'+extra)+'</button>';
  return h;
}
function skChips(){
  var m=_skEl('sku-chips-m'), c=_skEl('sku-chips-c');
  if(m) m.innerHTML=_skChipsHTML(_skLista('marca'),SK.marca,'skPickM','m');
  if(c) c.innerHTML=_skChipsHTML(_skLista('categoria'),SK.cat,'skPickC','c');
}
function skMas(k){ SK_MX[k]=!SK_MX[k]; skChips(); }
function skPickM(x){ SK.marca=(SK.marca.toLowerCase()===x.toLowerCase())?'':x; _skEl('sku-marca').value=SK.marca; skChips(); skActualizar(); }
function skPickC(x){ SK.cat=(SK.cat.toLowerCase()===x.toLowerCase())?'':x; _skEl('sku-categoria').value=SK.cat; skChips(); skActualizar(); }

/* ── reglas de avance ── */
function skCambios(){
  var o=SK.orig; if(!o) return [];
  var out=[];
  [['Código',o.sku,SK.sku.trim()],['Descripción',o.desc,SK.desc.trim()],['Pack',o.pack?'de '+o.pack:'',SK.pack?'de '+SK.pack:''],
   ['Marca',o.marca,SK.marca.trim()],['Categoría',o.cat,SK.cat.trim()],['Código SAP',o.sap,SK.sap],['Precio',o.precio?'S/ '+o.precio:'',SK.precio?'S/ '+SK.precio:'']].forEach(function(c){
    if(String(c[1]||'')!==String(c[2]||'')) out.push({k:c[0],a:c[1]||'-',d:c[2]||'-'});
  });
  return out;
}
function skDatosOk(){
  if(_skAdmin()&&!_skEdit()&&!SK.sede) return false;
  if(!SK.sku.trim()||!SK.desc.trim()||SK.chk==='dup'||SK.chk==='fmt'||!(SK.pack>=1)) return false;
  if(SK.sap&&!/^[0-9]{4,10}$/.test(SK.sap)) return false;
  if(SK.precio&&!(parseFloat(SK.precio)>=0)) return false;
  return true;
}
function skPuedeGuardar(){ return skDatosOk()&&(!_skEdit()||skCambios().length>0); }

/* ── navegación ── */
function skAnimar(){
  var p=_skEl('sk-pane'); if(!p) return;
  p.classList.remove('in-fwd','in-back'); void p.offsetWidth;
  p.classList.add(SK.dir>0?'in-fwd':'in-back');
}
function skRevisar(){ if(!skDatosOk()||SK.fin) return; SK.dir=1; SK.paso=2; skPintarRevisar(); skRender(true); }
function skIr(k){ if(SK.fin) return; if(k===1){ SK.dir=-1; SK.paso=1; skRender(true); } else skRevisar(); }
function skAtras(){ if(SK.paso===2){ SK.dir=-1; SK.paso=1; skRender(true); } else closeFS('fs-sku'); }

function skRender(anim){
  var edit=_skEdit();
  _skEl('fs-sku-title').textContent=edit?'Editar SKU':'Nuevo SKU';
  var pane=_skEl('sk-pane'); pane.dataset.paso=SK.fin?3:SK.paso;
  if(anim) skAnimar();
  var T={1:['Paso 1 de 2','Datos del producto',edit?'Corrige lo que necesites. El stock no cambia.':'Completa todo en una sola pantalla. El código se comprueba mientras escribes.'],
         2:['Paso 2 de 2',edit?'Revisa los cambios':'Así se verá en Stock','Si todo está bien, guárdalo. Puedes volver a editar sin perder nada.']}[SK.paso]||['','',''];
  _skEl('sk-ph').classList.toggle('hidden',SK.fin);
  _skEl('sk-eb').textContent=T[0]; _skEl('sk-t').textContent=T[1]; _skEl('sk-s').textContent=T[2];
  for(var k=1;k<=3;k++) _skEl('sk-s'+k).classList.toggle('hidden',k!==(SK.fin?3:SK.paso));
  _skEl('sku-nota-edit').style.display=edit&&SK.paso===1?'':'none';
  var fb=document.querySelector('#fs-sku .fs-body'); if(fb) fb.scrollTop=0;
  skActualizar();
}

// Se llama en cada cambio: refresca el riel y la barra de botones (barato)
function skActualizar(){
  _skRailUpd();
  var fin=SK.fin, edit=_skEdit(), p=SK.paso;
  _skEl('sk-footer').classList.toggle('hidden',fin);
  var back=_skEl('sk-back'), next=_skEl('btn-sku-next'), save=_skEl('btn-sku-save'), otro=_skEl('btn-sku-otro'), hints=_skEl('sk-hints');
  back.innerHTML=p>1?'← Editar datos':'Cancelar <span class="en2-kb">Esc</span>';
  next.classList.toggle('hidden',p!==1);
  save.classList.toggle('hidden',p!==2);
  otro.classList.toggle('hidden',p!==2||edit);
  next.disabled=!skDatosOk();
  var puede=skPuedeGuardar();
  save.disabled=!puede||SK.saving; otro.disabled=!puede||SK.saving;
  if(!SK.saving) save.textContent=edit?'Guardar cambios':'Guardar SKU';
  var hh=p===1
    ? '<span class="kb"><span class="kbd">Enter</span> siguiente campo</span><span class="kb"><span class="kbd">Ctrl</span> + <span class="kbd">Enter</span> guardar directo</span>'
    : (edit?'':'<label class="sk-keep"><input type="checkbox" id="sk-keep" '+(SK.keep?'checked':'')+' onchange="SK.keep=this.checked"> Mantener marca, categoría y pack al agregar otro</label>');
  if(hints._h!==hh){ hints._h=hh; hints.innerHTML=hh; }
}
function _skRailUpd(){
  var rail=_skEl('sk-rail'); if(!rail) return;
  if(!rail.dataset.built){
    rail.dataset.built='1';
    rail.innerHTML='<h4>Asistente · 2 pasos</h4>'+SK_NOM.map(function(n,i){
      var k=i+1;
      return '<button type="button" class="wz-stp" id="sk-stp-'+k+'" onclick="skIr('+k+')"><span class="wz-dot" id="sk-dot-'+k+'">'+k+'</span><span class="wz-ln"><i></i></span><span class="wz-tx"><strong>'+n+'</strong><small id="sk-sm-'+k+'"></small></span></button>';
    }).join('');
  }
  for(var k=1;k<=2;k++){
    var b=_skEl('sk-stp-'+k), hecho=SK.fin||(k<SK.paso&&skDatosOk()), on=!SK.fin&&k===SK.paso;
    b.classList.toggle('on',on); b.classList.toggle('done',hecho);
    b.disabled=SK.fin||(k===2&&!skDatosOk());
    var dot=_skEl('sk-dot-'+k);
    if((dot.dataset.d==='1')!==hecho){ dot.dataset.d=hecho?'1':'0'; dot.innerHTML=hecho?_SK_CHK16:k; }
    var sm=_skEl('sk-sm-'+k), tx=k===1?(SK.sku?SK.sku+(SK.desc?' · '+SK.desc.slice(0,20)+(SK.desc.length>20?'…':''):''):'Código, descripción y presentación'):(_skEdit()?'Revisa los cambios y guarda':'Mira cómo quedará y guarda');
    if(sm.textContent!==tx) sm.textContent=tx;
  }
}

/* ── paso 2: la fila tal como se verá en Stock + dónde se guarda cada dato ── */
function skPintarRevisar(){
  var edit=_skEdit(), admin=_skAdmin(), pM=_skMaestro();
  var fila=edit?(DATA.stock||[]).find(function(r){return r._row===SK.row;}):null;
  var stock=fila?fila.stock:0, ent=fila?fila.entradas:0, sal=fila?fila.salidas:0, pk=SK.pack, pr=parseFloat(SK.precio)||0;
  var est=stock>0?'ok':(stock<0?'ng':'no');
  var c=skCambios();
  var kv=function(k,v,mut){ return '<div class="sk-kv"><span>'+k+'</span><b'+(mut?' class="mut"':'')+'>'+(v?esc(v):'-')+'</b></div>'; };
  var sedeTxt=admin&&!edit&&SK.sede?SK.sede:(edit&&SK.sede?SK.sede:'tu tienda');
  var diff='';
  if(edit) diff='<div class="sk-diff"><h4>Cambios</h4>'+(c.length?c.map(function(x){return '<div class="sk-dr"><span>'+x.k+'</span><span class="a">'+esc(x.a)+'</span><span class="ar">→</span><span class="d">'+esc(x.d)+'</span></div>';}).join(''):'<div class="sk-sinc">Todavía no cambiaste nada. Vuelve atrás para editar.</div>')+'</div>';
  var donde='<div class="sk-where">'+
    '<div class="sk-wh"><div class="t"><span>Stock de '+esc(sedeTxt)+'</span><i>Solo esta tienda</i></div>'+kv('Código',SK.sku)+kv('Descripción',SK.desc)+kv('Unidades por pack',pk?(pk===1?'1 (por unidad)':String(pk)):'')+kv('Marca',SK.marca)+kv('Categoría',SK.cat)+'</div>'+
    '<div class="sk-wh"><div class="t"><span>Maestro</span><i class="g">Las 3 tiendas</i></div>'+
      (pM?kv('Código SAP',SK.sap)+kv('Precio por unidad',SK.precio?'S/ '+SK.precio:''):kv('Código SAP',SK.sap||'sin dato',!SK.sap)+kv('Precio por unidad',SK.precio?'S/ '+SK.precio:'sin dato',!SK.precio))+'</div></div>';
  var pend='';
  if(pM){ var q=[]; if(!SK.sap) q.push('Sin código SAP: no saldrá con SAP en la descarga de packs del Dashboard'); if(!SK.precio) q.push('Sin precio: el costo del Stock quedará en S/ 0.00'); if(q.length) pend='<div class="sk-pend">'+q.map(function(x){return '<span>⚠ '+x+'</span>';}).join('')+'</div>'; }
  _skEl('sk-s2').innerHTML=
    (admin&&!edit&&SK.sede?'<div class="sk-dest">Se creará en <b>'+esc(SK.sede)+'</b></div>':'')+
    '<div class="sk-pw"><div class="sk-pw-cap"><span>Así se verá en Stock</span><i>Vista previa</i></div>'+
    '<div class="sk-pw-hd"><span>Producto</span><span>Movimientos</span><span>Stock</span><span>Packs</span><span>Costo</span><span>Estado</span></div>'+
    '<div class="sk-pw-row"><div><div class="sk-pn">'+esc(SK.desc)+'</div><div class="sk-ps"><span class="sk-sku">'+esc(SK.sku)+'</span>'+(SK.sap?'<span class="sk-sku sap">SAP '+esc(SK.sap)+'</span>':'')+'<i class="sk-dotp"></i><span>'+esc(SK.marca||'Sin marca')+'</span><i class="sk-dotp"></i><span>'+esc(SK.cat||'Sin categoría')+'</span></div></div>'+
    '<div class="sk-pw-c"><b class="mv num"><i>+'+fmt(ent)+'</i> −'+fmt(sal)+'</b></div>'+
    '<div class="sk-pw-c"><b class="num">'+fmt(stock)+'</b><span class="sk-bar0"><i style="width:'+Math.max(0,Math.min(100,stock/4))+'%"></i></span></div>'+
    '<div class="sk-pw-c"><b class="num">'+(pk?fmt(Math.round(stock/pk*100)/100):'-')+'</b><small>'+(pk?(pk===1?'por unidad':'pack de '+pk):'sin definir')+'</small></div>'+
    '<div class="sk-pw-c"><b class="num">S/ '+_skMoney(stock*pr)+'</b><small>'+(pr?'S/ '+_skMoney(pr)+' c/u':'sin precio')+'</small></div>'+
    '<div class="sk-pw-c"><span class="sk-est '+est+'">'+(est==='ok'?'Con stock':(est==='ng'?'Negativo':'Sin stock'))+'</span></div></div></div>'+
    donde+pend+diff+
    '<div class="sk-nota"><span>ⓘ</span><span>'+(edit?'El stock y los movimientos de este producto no cambian.':'El producto se crea con stock en cero. Para ingresar unidades registra una Entrada o haz un Conteo.')+'</span></div>'+
    '<div id="sku-err2" class="err-msg" style="margin-top:12px"></div>';
}

/* ── guardar ── */
function _skErr(msg){ ['sku-err','sku-err2'].forEach(function(id){ var e=_skEl(id); if(e) e.textContent=msg||''; }); }
function skExito(){
  var edit=_skEdit();
  _skEl('sk-s3').innerHTML='<div class="sk-ok"><svg class="big" viewBox="0 0 100 100"><circle class="halo" cx="50" cy="50" r="46"/><circle class="c1" cx="50" cy="50" r="46"/><path class="c2" d="M30 52l14 14 27-30"/></svg>'+
    '<h2>'+(edit?'Cambios guardados':'SKU creado')+'</h2><p>'+(edit?'El producto se actualizó en Stock.':'Ya aparece en Stock'+(_skAdmin()&&SK.sede?' de '+esc(SK.sede):'')+'.')+'</p>'+
    '<div class="mini"><span class="sk-sku">'+esc(SK.sku)+'</span><span style="font-weight:600">'+esc(SK.desc)+'</span><span class="sk-sku sap">'+(SK.pack===1?'por unidad':'pack de '+SK.pack)+'</span></div>'+
    '<div class="acts">'+(edit?'':'<button type="button" class="btn btn-primary" onclick="skOtro()">Agregar otro SKU</button>')+'<button type="button" class="btn" onclick="closeFS(\'fs-sku\')">Listo</button></div></div>';
  SK.dir=1; skRender(true);
}
// Deja listo el siguiente SKU; la marca, categoría y pack se pueden conservar (casilla del paso 2)
function skOtro(){
  var m=SK.marca,c=SK.cat,pk=SK.pack,po=SK.packOtro,keep=SK.keep,sede=SK.sede;
  SK.run++; SK.chkRun++; clearTimeout(SK.tm);
  SK.modo='nuevo'; SK.row=null; SK.orig=null; SK.sheetId=null; SK.fin=false; SK.saving=false; SK.paso=1; SK.dir=-1;
  SK.sku=''; SK.sap=''; SK.desc=''; SK.precio=''; SK.chk='idle'; SK.dup=null; SK.mHit=null; SK.mBusy=false;
  SK.marca=keep?m:''; SK.cat=keep?c:''; SK.pack=keep?pk:0; SK.packOtro=keep?po:false; SK.sede=sede;
  _skErr(''); skCargarCampos(); skRender(true);
  setTimeout(function(){ var e=_skEl('sku-lovis'); if(e) e.focus(); },200);
}

// otro=true: guarda y deja el formulario vacío para cargar el siguiente
function guardarSKU(otro){
  if(!skPuedeGuardar()||SK.saving) return;
  var lovis=SK.sku.trim(), desc=SK.desc.trim(), esEd=_skEdit();
  // Admin creando nuevo: necesita la tienda destino
  var sheetId=SK.sheetId;
  if(_skAdmin()&&!esEd){
    var match=(DATA.stock||[]).find(function(r){return r.sede===SK.sede;});
    sheetId=match?match.sheetId:null;
    if(!sheetId){ _skErr('No se encontró el ID de la tienda'); return; }
  }
  var fila={
    sku:lovis, desc:desc, marca:SK.marca.trim(), categoria:SK.cat.trim(), sheetId:sheetId,
    pack:SK.pack, sap:SK.sap, precio:SK.precio
  };
  _skErr('');
  var btn=_skEl('btn-sku-save');
  SK.saving=true; btn.textContent='Guardando...'; skActualizar();
  var libera=function(){ SK.saving=false; skActualizar(); };
  var aviso=function(r){ if(r&&r.aviso) showToast(r.aviso,'err'); };
  if(esEd){
    google.script.run
      .withSuccessHandler(function(r){
        libera();
        if(!r.ok){ _skErr(r.error); return; }
        aviso(r);
        reloadPage('stock');
        SK.fin=true; skExito();
      })
      .withFailureHandler(function(e){ libera(); _skErr(e.message); })
      .editarSKU(S.token,SK.row,fila);
  } else {
    google.script.run
      .withSuccessHandler(function(r){
        libera();
        if(!r.ok){ _skErr(r.error); return; }
        aviso(r);
        // El código recién creado cuenta como repetido si se vuelve a escribir sin cerrar el formulario
        SKU_CACHE.push({sku:lovis,desc:desc,marca:fila.marca,categoria:fila.categoria,_row:-1,sede:SK.sede||''});
        reloadPage('stock');
        if(otro){ showToast('SKU '+lovis+' creado','ok'); skOtro(); }
        else { SK.fin=true; skExito(); }
      })
      .withFailureHandler(function(e){ libera(); _skErr(e.message); })
      .registrarSKU(S.token,fila);
  }
}

// Atajos en PC: Esc cierra y Ctrl+Enter guarda (también desde el paso 1, si lo obligatorio está completo)
document.addEventListener('keydown',function(e){
  var fs=document.getElementById('fs-sku');
  if(!fs||!fs.classList.contains('open')) return;
  if(e.key==='Escape'){ closeFS('fs-sku'); return; }
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!SK.fin&&skPuedeGuardar()){ e.preventDefault(); guardarSKU(false); }
});
