/* Editar SKU por fila (Salidas) — parte de la antigua app.js; se carga en este orden desde index.html */
/* ══════════════════════════════════════
   EDITAR SKU POR FILA — SALIDAS
══════════════════════════════════════ */
var _eskuRow=null, _eskuNuevoSKU='', _eskuNuevaDesc='';

// ── Modal Editar SKU por fila ──
function abrirEditarSkuFila(rowNum){
  var row=(DATA.salidas||[]).find(function(r){ return r._row===rowNum; });
  if(!row) return;
  _eskuRow=row; _eskuNuevoSKU=''; _eskuNuevaDesc='';
  document.getElementById('esku-info').textContent='Fila '+rowNum+' · SKU actual: '+row.sku+' — '+row.desc;
  document.getElementById('esku-busq').value='';
  document.getElementById('esku-busq-results').style.display='none';
  document.getElementById('esku-sel-card').style.display='none';
  document.getElementById('esku-pack').value=row.pack;
  document.getElementById('esku-und').value=row.unidad;
  document.getElementById('esku-err').textContent='';
  document.getElementById('esku-save-btn').disabled=false;
  document.getElementById('esku-save-btn').textContent='Guardar';
  document.getElementById('modal-editar-sku-fila').style.display='flex';
  if(!_MAESTRO_LOCAL){
    _cargarMaestro(function(){
      var inp=document.getElementById('esku-busq');
      if(inp&&inp.value.trim()) buscarESKU();
    });
  }
  setTimeout(function(){ document.getElementById('esku-busq').focus(); },200);
}

// Al cambiar el pack, las unidades siguen la proporción original (p. ej. 24 und. por pack)
function _eskuPackCambio(){
  var r=_eskuRow; if(!r) return;
  var pk=parseInt(document.getElementById('esku-pack').value,10);
  if(isNaN(pk)||!(r.pack>0)) return;
  document.getElementById('esku-und').value=Math.round(pk*(r.unidad/r.pack));
}

function cerrarModalESKU(){
  document.getElementById('modal-editar-sku-fila').style.display='none';
}

function buscarESKU(){
  var q=(document.getElementById('esku-busq').value||'').trim().toLowerCase();
  var res=document.getElementById('esku-busq-results');
  if(!q){ res.style.display='none'; return; }

  function doSearch(){
    var skuSet={};
    (DATA.salidas||[]).forEach(function(r){ if(!skuSet[r.sku]) skuSet[r.sku]={sku:r.sku,desc:r.desc}; });
    var matches=Object.values(skuSet).filter(function(p){
      return p.sku.toLowerCase().includes(q)||p.desc.toLowerCase().includes(q);
    });
    if(_MAESTRO_LOCAL){
      _MAESTRO_LOCAL.filter(function(p){
        return !skuSet[p.lovis]&&(p.lovis.toLowerCase().includes(q)||p.desc.toLowerCase().includes(q));
      }).forEach(function(p){ matches.push({sku:p.lovis,desc:p.desc}); });
    }
    matches=matches.slice(0,25);
    if(!matches.length){
      res.innerHTML='<div style="padding:10px;font-size:12px;color:var(--text3)">Sin resultados</div>';
      res.style.display='block'; return;
    }
    res.innerHTML=matches.map(function(p,i){
      return '<div class="bees-opt" id="esku-opt-'+i+'" style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px">'
        +'<span style="font-family:monospace;font-size:11px;background:var(--surface2);padding:1px 5px;border-radius:3px;margin-right:6px">'+esc(p.sku)+'</span>'
        +esc(p.desc)+'</div>';
    }).join('');
    res.querySelectorAll('.bees-opt').forEach(function(el,i){
      el.addEventListener('click',function(){ seleccionarESKU(matches[i]); });
    });
    res.style.display='block';
  }

  if(_MAESTRO_LOCAL){ doSearch(); }
  else {
    res.innerHTML=LDm('Cargando catálogo');
    res.style.display='block';
    _cargarMaestro(doSearch);
  }
}

function seleccionarESKU(p){
  _eskuNuevoSKU=p.sku; _eskuNuevaDesc=p.desc;
  document.getElementById('esku-busq').value=p.desc||p.sku;
  document.getElementById('esku-busq-results').style.display='none';
  document.getElementById('esku-sel-desc').textContent=p.desc;
  document.getElementById('esku-sel-sku').textContent=p.sku;
  document.getElementById('esku-sel-card').style.display='block';
}

function guardarEditarSkuFila(){
  var err=document.getElementById('esku-err');
  // Aceptar SKU escrito manualmente si no se seleccionó del dropdown
  if(!_eskuNuevoSKU){
    var input=(document.getElementById('esku-busq').value||'').trim();
    if(input){
      var match=null;
      if(_MAESTRO_LOCAL) match=_MAESTRO_LOCAL.find(function(p){ return p.lovis===input; });
      if(!match) match=(DATA.salidas||[]).map(function(r){ return {lovis:r.sku,desc:r.desc}; }).find(function(p){ return p.lovis===input; });
      if(match){ _eskuNuevoSKU=match.lovis; _eskuNuevaDesc=match.desc||input; }
      else { _eskuNuevoSKU=input; _eskuNuevaDesc=input; }
    }
  }
  var packTxt=document.getElementById('esku-pack').value, undTxt=document.getElementById('esku-und').value;
  var cambiaSku=!!_eskuNuevoSKU && _eskuNuevoSKU!==_eskuRow.sku;
  var cambiaCant=String(packTxt)!==String(_eskuRow.pack) || String(undTxt)!==String(_eskuRow.unidad);
  if(!cambiaSku && !cambiaCant){ err.textContent='No hiciste ningún cambio'; return; }
  err.textContent='';
  var btn=document.getElementById('esku-save-btn');
  btn.disabled=true; btn.textContent='Guardando...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false; btn.textContent='Guardar';
      if(!r||!r.ok){ err.textContent=r?r.error:'Error al guardar'; return; }
      cerrarModalESKU();
      showToast('Fila actualizada','ok');
      PAGE_LOADED['salidas']=false; PAGE_LOADED['stock']=false; reloadPage('salidas');
    })
    .withFailureHandler(function(e){
      btn.disabled=false; btn.textContent='Guardar';
      err.textContent=e.message;
    })
    .editarSKUFila(S.token, _eskuRow._row, cambiaSku?_eskuNuevoSKU:'', _eskuNuevaDesc, packTxt, undTxt);
}
