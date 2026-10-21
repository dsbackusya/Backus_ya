/* Autocompletado, EAN y ayudas de formularios a pantalla completa — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   AUTOCOMPLETE + EAN
══════════════════════════════════════ */
var acTimers={}; // mapa por listId — evita que filas distintas cancelen sus timers entre sí
// Cache de resultados por listId — evita pasar JSON por onclick
// Máx 20 entradas para evitar crecimiento ilimitado en sesiones largas
var AC_CACHE={};
var _AC_CACHE_KEYS=[];
var _AC_CACHE_MAX=20;
function _acCacheSet(listId, results){
  if(!AC_CACHE[listId]) _AC_CACHE_KEYS.push(listId);
  AC_CACHE[listId]=results;
  if(_AC_CACHE_KEYS.length>_AC_CACHE_MAX){
    var oldest=_AC_CACHE_KEYS.shift();
    delete AC_CACHE[oldest];
  }
}

// acSearch — búsqueda de SKU con autocomplete reutilizable.
// onSelectFn (opcional): string con nombre de función JS para el onclick de cada ítem.
//   Si se omite, usa acSelect con los parámetros skuId/descId/marcaId/listId.
function acSearch(skuId,descId,marcaId,listId,onSelectFn){
  clearTimeout(acTimers[listId]);
  var q=document.getElementById(skuId).value.trim();
  if(q.length<2){document.getElementById(listId).classList.remove('open');return;}
  acTimers[listId]=setTimeout(function(){
    google.script.run
      .withSuccessHandler(function(r){
        if(!r.ok)return;
        var list=document.getElementById(listId);
        if(!r.results.length){list.classList.remove('open');return;}
        AC_CACHE[listId]=r.results; // mantener para acSelect con índice numérico
        _acCacheSet(listId, r.results);
        list.innerHTML=r.results.map(function(x,i){
          var clickHandler = onSelectFn
            ? onSelectFn+'('+i+')'
            : 'acSelect(\''+skuId+'\',\''+descId+'\','+(marcaId?'\''+marcaId+'\'':'null')+',\''+listId+'\','+i+')';
          return '<div class="ac-item" onclick="'+clickHandler+'">'+
            '<div class="ac-sku">'+esc(x.sku)+'</div>'+
            '<div class="ac-desc">'+esc(x.desc)+'</div>'+
          '</div>';
        }).join('');
        list.classList.add('open');
      })
      .withFailureHandler(function(){ document.getElementById(listId).classList.remove('open'); })
      .buscarSKU(S.token,q);
  },300);
}

function acSelect(skuId,descId,marcaId,listId,idx){
  var item=(AC_CACHE[listId]||[])[Number(idx)];
  if(!item)return;
  document.getElementById(skuId).value=item.sku;
  document.getElementById(skuId).dispatchEvent(new CustomEvent('acpick'));
  var descEl=document.getElementById(descId);
  if(descEl){
    var wasReadOnly=descEl.readOnly;
    descEl.readOnly=false;
    descEl.value=item.desc;
    descEl.readOnly=wasReadOnly;
  }
  if(marcaId&&document.getElementById(marcaId))document.getElementById(marcaId).value=item.marca||'';
  document.getElementById(listId).classList.remove('open');
}


function eanFill(eanId,skuId,descId,marcaId){
  var ean=document.getElementById(eanId).value.trim();
  if(!ean)return;
  // Resolver localmente si el catálogo ya está en memoria — evita llamada al servidor
  if(_MCONTEO_LOCAL && _MCONTEO_EAN_IDX){
    var normEan = /[eE]/.test(ean) ? Math.round(Number(ean)).toString() : ean.replace(/\.0+$/,'');
    var found = _MCONTEO_EAN_IDX[normEan];
    if(found){
      document.getElementById(skuId).value=found.sku;
      document.getElementById(descId).value=found.producto||'';
      if(marcaId&&document.getElementById(marcaId))document.getElementById(marcaId).value='';
      document.getElementById(eanId).value='';
      return;
    }
  }
  // Fallback al servidor si no hay catálogo local o no se encontró
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.ok){showToast('EAN no encontrado','err');return;}
      document.getElementById(skuId).value=r.sku;
      document.getElementById(descId).value=r.producto||r.desc||'';
      if(marcaId&&document.getElementById(marcaId))document.getElementById(marcaId).value=r.marca||'';
      document.getElementById(eanId).value='';
    })
    .withFailureHandler(function(e){showToast(e.message,'err');})
    .buscarEAN(S.token,ean);
}

/* ── FULL-SCREEN FORM HELPERS ── */
function openFS(id){
  var el=document.getElementById(id);
  el.style.display='flex';
  setTimeout(function(){el.classList.add('open');},10);
}
function closeFS(id){
  if(id==='fs-conteo') _cntCamDetener();
  var el=document.getElementById(id);
  el.classList.remove('open');
  setTimeout(function(){el.style.display='none';},200);
}

// onSaved: cierra el form y marca páginas relacionadas como stale.
// NO recarga inmediatamente desde la API — la recarga ocurre la próxima vez
// que el usuario navegue a esa sección o pulse "Actualizar".
// Excepción: si el caller ya actualizó DATA local (salidas, conteo),
// puede pasar localUpdate=true para saltar incluso el PAGE_LOADED=false.
function onSaved(r, fsId, page, btn, btnLabel, localUpdate){
  if(btn){btn.disabled=false;btn.textContent=btnLabel;}
  if(!r.ok){showToast(r.error,'err');return;}
  showToast('Guardado correctamente','ok');
  closeFS(fsId);
  if(!localUpdate){
    // Marcar la página como stale — se recargará al navegar a ella
    PAGE_LOADED[page]=false;
    // Marcar stock como stale también
    PAGE_LOADED['stock']=false;
  }
}

function clearForm(ids){
  ids.forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.value='';
  });
}
