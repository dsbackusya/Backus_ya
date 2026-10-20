/* Capa de compatibilidad: reemplaza google.script.run por llamadas a Supabase.
   Cada función devuelve el mismo formato que devolvía Code.gs ({ ok, data, ... }),
   por lo que la interfaz no necesita cambios. Requiere config.js y supabase-js. */
(function () {
  'use strict';

  var CFG = window.TADA_CONFIG;
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage }
  });
  window.tadaSupabase = sb;

  var TZ = 'America/Lima';
  var PAGE = 1000;

  /* ───────── utilidades ───────── */
  function pad(n) { return String(n).padStart(2, '0'); }
  function limaParts(d) {
    var f = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(d || new Date());
    var o = {};
    f.forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  function hoyISO() { var p = limaParts(); return p.year + '-' + p.month + '-' + p.day; }
  function horaAhora() { var p = limaParts(); return p.hour + ':' + p.minute + ':' + p.second; }
  function fmtFecha(iso) {
    if (!iso) return '';
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso);
  }
  function fmtHora(t) {
    if (!t) return '';
    var m = String(t).match(/(\d{1,2}):(\d{2})/);
    return m ? pad(m[1]) + ':' + m[2] : '';
  }
  function parseFecha(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s) ? null : s.toISOString().slice(0, 10);
    s = String(s).trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
  }
  function restarDias(iso, n) {
    var d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    var n = Number(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  function entero(v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; }
  function nulo(v) { v = str(v); return v === '' ? null : v; }
  function normEan(v) {
    var raw = str(v);
    return /[eE]/.test(raw) ? String(Math.round(Number(raw))) : raw.replace(/\.0+$/, '');
  }
  function usuarioAEmail(u) {
    var s = String(u).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    return s + '@tada.local';
  }
  function lcEsc(s) { return String(s).replace(/[%_\\]/g, '\\$&'); }

  function esExpirada(error) {
    var t = (error && (error.message || error.code || '')) + '';
    return /jwt|token|not authenticated|expired/i.test(t) && !/violates/i.test(t);
  }
  function mensaje(error) {
    var m = (error && error.message) || String(error);
    if (/row-level security/i.test(m)) return 'No tienes permiso para realizar esta acción.';
    if (/duplicate key/i.test(m)) return 'El registro ya existe.';
    return m;
  }
  function esRedCaida(error) {
    var m = (error && error.message) || '';
    return /failed to fetch|network|load failed|timeout|503|502|504/i.test(m);
  }

  /* ───────── sesión / perfil ───────── */
  var _perfil = null;
  var _sedes = null;

  async function cargarPerfil(uid) {
    var r = await sb.from('perfiles').select('usuario,rol,sede_id').eq('user_id', uid).maybeSingle();
    if (r.error) throw r.error;
    if (!r.data) throw new Error('Tu usuario no tiene perfil configurado. Contacta al administrador.');
    _perfil = r.data;
    return _perfil;
  }
  async function cargarSedes() {
    if (_sedes) return _sedes;
    var r = await sb.from('sedes').select('id,codigo,nombre').order('nombre');
    if (r.error) throw r.error;
    _sedes = r.data;
    return _sedes;
  }
  function sedeNombre(id) {
    var s = (_sedes || []).find(function (x) { return x.id === id; });
    return s ? s.nombre : '';
  }

  async function contexto() {
    var s = await sb.auth.getSession();
    if (!s.data.session) return null;
    if (!_perfil) await cargarPerfil(s.data.session.user.id);
    await cargarSedes();
    return _perfil;
  }

  function guard(fn) {
    return async function () {
      var args = Array.prototype.slice.call(arguments);
      try {
        var p = await contexto();
        if (!p) return { ok: false, error: 'Sesión expirada', expired: true };
        return await fn.apply(null, [p].concat(args.slice(1))); // args[0] = token (se ignora)
      } catch (e) {
        if (esExpirada(e)) return { ok: false, error: 'Sesión expirada', expired: true };
        return { ok: false, error: mensaje(e) };
      }
    };
  }

  function sedeDe(p, fila) {
    if (p.rol === 'store') return p.sede_id;
    var id = fila && Number(fila.sheetId);
    return id || null;
  }
  function exigirSede(p, fila) {
    var id = sedeDe(p, fila);
    if (!id) throw new Error('Selecciona una sede.');
    return id;
  }
  function filtroSede(q, p) {
    return p.rol === 'store' ? q.eq('sede_id', p.sede_id) : q;
  }

  async function todas(construir) {
    var primero = await construir().range(0, PAGE - 1);
    if (primero.error) throw primero.error;
    var filas = primero.data;
    if (filas.length < PAGE) return filas;
    var paginas = [];
    var desde = PAGE;
    var hecho = false;
    while (!hecho) {
      var lote = [];
      for (var i = 0; i < 6; i++) { lote.push(construir().range(desde, desde + PAGE - 1)); desde += PAGE; }
      var res = await Promise.all(lote);
      for (var j = 0; j < res.length; j++) {
        if (res[j].error) throw res[j].error;
        paginas.push(res[j].data);
        if (res[j].data.length < PAGE) { hecho = true; break; }
      }
    }
    return filas.concat.apply(filas, paginas);
  }

  /* ───────── API ───────── */
  var API = {};

  API.login = async function (usuario, password) {
    try {
      var r = await sb.auth.signInWithPassword({ email: usuarioAEmail(usuario), password: password });
      if (r.error) return { ok: false, error: 'Usuario o contraseña incorrectos' };
      _perfil = null;
      var p = await cargarPerfil(r.data.user.id);
      await cargarSedes();
      return {
        ok: true, token: r.data.session.access_token, usuario: p.usuario, rol: p.rol,
        sheetId: p.rol === 'store' ? String(p.sede_id) : '*'
      };
    } catch (e) { return { ok: false, error: mensaje(e) }; }
  };

  API.cerrarSesion = async function () {
    try { await sb.auth.signOut(); } catch (e) { /* ignorar */ }
    _perfil = null;
    return { ok: true };
  };

  API.pingSession = async function () {
    try {
      var r = await sb.auth.getUser();
      // Sin red (o servidor caído) no es sesión vencida: se propaga para que la app no cierre la sesión
      if (r.error && (r.error.name === 'AuthRetryableFetchError' || !r.error.status || r.error.status >= 500)) throw r.error;
      if (r.error || !r.data.user) return { ok: false, expired: true };
      var p = await contexto();
      if (!p) return { ok: false, expired: true };
      return { ok: true, usuario: p.usuario, rol: p.rol };
    } catch (e) {
      if (esExpirada(e)) return { ok: false, expired: true };
      throw e; // fallo de red: el frontend lo ignora
    }
  };

  /* ── STOCK ── */
  var _stockRows = {}; // _row -> { sede_id, sku }
  API.getStock = guard(async function (p) {
    var filas = await todas(function () {
      return filtroSede(sb.from('v_stock').select('*'), p).order('sede_id').order('sku');
    });
    _stockRows = {};
    var data = filas.map(function (r, i) {
      var row = i + 2;
      _stockRows[row] = { sede_id: r.sede_id, sku: r.sku };
      var o = {
        _row: row, sku: str(r.sku), desc: str(r.descripcion), marca: str(r.marca), categoria: str(r.categoria),
        entradas: num(r.entradas), salidas: num(r.salidas), mt: num(r.mt),
        stock: num(r.stock_actual), stockPack: num(r.stock_pack), costo: num(r.costo),
        fVenc: '', diasVenc: ''
      };
      o.sede = sedeNombre(r.sede_id);
      if (p.rol !== 'store') o.sheetId = String(r.sede_id);
      return o;
    });
    return { ok: true, data: data, usuario: p.usuario, rol: p.rol };
  });

  API.registrarSKU = guard(async function (p, fila) {
    var sku = str(fila.sku);
    if (!sku) return { ok: false, error: 'SKU obligatorio' };
    var sede = exigirSede(p, fila);
    var r = await sb.from('sede_productos').insert({
      sede_id: sede, sku: sku, descripcion: str(fila.desc), marca: nulo(fila.marca), categoria: nulo(fila.categoria)
    });
    if (r.error) {
      if (r.error.code === '23505') return { ok: false, error: 'El SKU "' + sku + '" ya existe en STOCK.' };
      throw r.error;
    }
    return { ok: true };
  });

  API.editarSKU = guard(async function (p, rowNum, fila) {
    var ref = _stockRows[rowNum];
    if (!ref) return { ok: false, error: 'Recarga el stock e intenta de nuevo.' };
    var r = await sb.from('sede_productos').update({
      sku: str(fila.sku), descripcion: str(fila.desc), marca: nulo(fila.marca), categoria: nulo(fila.categoria)
    }).eq('sede_id', ref.sede_id).eq('sku', ref.sku);
    if (r.error) {
      if (r.error.code === '23505') return { ok: false, error: 'El SKU "' + str(fila.sku) + '" ya existe.' };
      throw r.error;
    }
    return { ok: true };
  });

  API.buscarSKU = guard(async function (p, query) {
    var q = String(query || '').replace(/[,()*%\\]/g, ' ').trim();
    if (!q) return { ok: true, results: [] };
    var r = await filtroSede(sb.from('sede_productos').select('sku,descripcion,marca'), p)
      .or('sku.ilike.%' + q + '%,descripcion.ilike.%' + q + '%').order('sku').limit(30);
    if (r.error) throw r.error;
    var vistos = {};
    var results = [];
    r.data.forEach(function (x) {
      if (vistos[x.sku] || results.length >= 10) return;
      vistos[x.sku] = true;
      results.push({ sku: str(x.sku), desc: str(x.descripcion), marca: str(x.marca) });
    });
    return { ok: true, results: results };
  });

  // Qué SKUs de una lista existen en el Stock de la sede (devuelve {sku: descripción}); lo usa la lectura de la OC en PDF.
  API.skusEnStock = guard(async function (p, skus) {
    var sede = exigirSede(p, null);
    var lista = (skus || []).map(str).filter(Boolean);
    if (!lista.length) return { ok: true, data: {} };
    var r = await sb.from('sede_productos').select('sku,descripcion').eq('sede_id', sede).in('sku', lista);
    if (r.error) throw r.error;
    var m = {};
    r.data.forEach(function (x) { m[str(x.sku)] = str(x.descripcion); });
    return { ok: true, data: m };
  });

  API.getMaestroCompleto = guard(async function () {
    var filas = await todas(function () { return sb.from('maestro_sku').select('*').order('sku'); });
    return {
      ok: true,
      data: filas.map(function (r) {
        return { lovis: str(r.sku), desc: str(r.descripcion), sap: str(r.cod_sap), precio: num(r.precio) };
      })
    };
  });

  /* ── SALIDAS ── */
  function mapSalida(r) {
    return {
      _row: r.id, fecha: fmtFecha(r.fecha), hora: fmtHora(r.hora), sku: str(r.sku), nroPedido: str(r.nro_pedido),
      desc: str(r.descripcion), pack: num(r.pack), unidad: num(r.unidad), marca: str(r.marca),
      motorizado: str(r.motorizado), envases: str(r.envases), estado: str(r.estado),
      revision: str(r.revision), tamano: r.tamano == null ? '' : String(r.tamano)
    };
  }

  // Rango que pide la pantalla ({desde,hasta} en ISO); sin rango = solo hoy.
  function rangoPantalla(rango) {
    var hoy = hoyISO();
    var desde = parseFecha(rango && rango.desde) || hoy;
    var hasta = parseFecha(rango && rango.hasta) || (rango && rango.desde ? hoy : desde);
    return { desde: desde, hasta: hasta };
  }

  // Solo trae el rango pedido (por defecto, hoy): el historial completo se pide cuando el usuario elige fechas.
  API.getSalidas = guard(async function (p, force, rango) {
    var hoy = hoyISO();
    var rg = rangoPantalla(rango);
    var filas = await todas(function () {
      return filtroSede(sb.from('v_salidas').select('*'), p).gte('fecha', rg.desde).lte('fecha', rg.hasta).order('id');
    });
    return { ok: true, data: filas.map(mapSalida), hoyStr: fmtFecha(hoy), rango: rg };
  });

  API.registrarSalida = guard(async function (p, fila) {
    var pack = entero(fila.pack), unidad = entero(fila.unidad), sku = str(fila.sku);
    if (!sku) return { ok: false, error: 'SKU es obligatorio' };
    if (pack === null || pack < 0) return { ok: false, error: 'Pack inválido' };
    if (unidad === null || unidad < 0) return { ok: false, error: 'Unidades inválidas' };
    var sede = exigirSede(p, fila);
    var hora = horaAhora();
    var r = await sb.from('salidas').insert({
      sede_id: sede, fecha: hoyISO(), hora: hora, sku: sku, nro_pedido: nulo(fila.nroPedido),
      descripcion: str(fila.desc), pack: pack, unidad: unidad, motorizado: nulo(fila.motorizado), origen: 'manual'
    }).select('id').single();
    if (r.error) throw r.error;
    return {
      ok: true,
      inserted: {
        _row: r.data.id, fecha: fmtFecha(hoyISO()), hora: hora, sku: sku, nroPedido: str(fila.nroPedido),
        desc: str(fila.desc), pack: pack, unidad: unidad, marca: str(fila.marca),
        motorizado: str(fila.motorizado), envases: fila.envases !== undefined ? fila.envases : ''
      }
    };
  });

  // Buscador para armar un pedido a mano: primero el maestro (trae SKU y unidades por pack), luego Stock.
  API.buscarProductoPedido = guard(async function (p, query) {
    var q = String(query || '').replace(/[,()*%\\]/g, ' ').trim();
    if (!q) return { ok: true, results: [] };
    var sede = exigirSede(p, null);
    var filtro = 'descripcion.ilike.%' + q + '%,sku.ilike.%' + q + '%';
    var res = await Promise.all([
      sb.from('mbees').select('descripcion,sku,factor').eq('sede_id', sede).or(filtro).order('descripcion').limit(15),
      sb.from('sede_productos').select('sku,descripcion').eq('sede_id', sede).or(filtro).order('sku').limit(15)
    ]);
    if (res[0].error) throw res[0].error;
    if (res[1].error) throw res[1].error;
    var results = [];
    res[0].data.forEach(function (r) {
      if (/^SIN SKU/i.test(str(r.sku))) return;
      results.push({ sku: str(r.sku), desc: str(r.descripcion), factor: num(r.factor) || 1, fuente: 'maestro' });
    });
    res[1].data.forEach(function (r) {
      results.push({ sku: str(r.sku), desc: str(r.descripcion), factor: 1, fuente: 'stock' });
    });
    return { ok: true, results: results };
  });

  // Registra un pedido completo a mano (varias líneas). La base rechaza pedidos repetidos o cancelados.
  API.registrarPedidoManual = guard(async function (p, d) {
    var sede = exigirSede(p, null);
    var fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha || '')) ? d.fecha : null;
    var r = await sb.rpc('registrar_pedido_manual', {
      p_sede: sede, p_nro_pedido: str(d.nroPedido), p_fecha: fecha, p_motorizado: str(d.motorizado),
      p_lineas: (d.lineas || []).map(function (l) {
        return { sku: str(l.sku), descripcion: str(l.desc), pack: l.pack, unidad: l.unidad };
      })
    });
    if (r.error) throw r.error;
    return r.data;
  });

  API.editarSalida = guard(async function (p, rowNum, fila) {
    var r = await sb.from('salidas').update({
      sku: str(fila.sku), nro_pedido: nulo(fila.nroPedido), descripcion: str(fila.desc),
      pack: entero(fila.pack), unidad: entero(fila.unidad), motorizado: nulo(fila.motorizado)
    }).eq('id', rowNum);
    if (r.error) throw r.error;
    return { ok: true };
  });

  API.marcarEntregado = guard(async function (p, rowNum) {
    if (!rowNum) return { ok: false, error: 'Fila inválida' };
    var act = await sb.from('salidas').select('revision').eq('id', rowNum).maybeSingle();
    if (act.error) throw act.error;
    if (act.data && act.data.revision === 'Entregado') return { ok: true, yaConfirmado: true };
    var r = await sb.from('salidas').update({ revision: 'Entregado' }).eq('id', rowNum);
    if (r.error) throw r.error;
    return { ok: true };
  });

  API.cancelarSalida = guard(async function (p, rowNum, modo, expectedNroPedido, motivo) {
    var nro = str(expectedNroPedido), sede = p.sede_id;
    if (!nro && rowNum) {
      var s = await sb.from('salidas').select('nro_pedido,sede_id').eq('id', rowNum).maybeSingle();
      if (s.error) throw s.error;
      if (s.data) { nro = str(s.data.nro_pedido); sede = s.data.sede_id; }
    } else if (p.rol !== 'store') {
      var s2 = await sb.from('salidas').select('sede_id').eq('nro_pedido', nro).limit(1).maybeSingle();
      if (s2.error) throw s2.error;
      if (s2.data) sede = s2.data.sede_id;
    }
    if (!nro) return { ok: false, error: 'No se encontró el pedido a cancelar.', stale: true };
    var r = await sb.rpc('cancelar_pedido', { p_sede: sede, p_nro_pedido: nro, p_motivo: str(motivo) });
    if (r.error) throw r.error;
    return r.data;
  });

  // Edición manual de una fila: SKU (p. ej. SKU espejo) y/o cantidades. Queda marcada para que la revalidación no la pise.
  API.editarSKUFila = guard(async function (p, rowNum, nuevoSKU, nuevaDesc, pack, unidad) {
    var cambios = { ajuste_manual: true };
    if (str(nuevoSKU)) cambios.sku = str(nuevoSKU);
    if (pack !== undefined && pack !== null && pack !== '') {
      var pk = entero(pack);
      if (pk === null || pk < 0) return { ok: false, error: 'El pack debe ser un número entero (0 o más)' };
      cambios.pack = pk;
    }
    if (unidad !== undefined && unidad !== null && unidad !== '') {
      var un = entero(unidad);
      if (un === null || un < 0) return { ok: false, error: 'Las unidades deben ser un número entero (0 o más)' };
      cambios.unidad = un;
    }
    var r = await sb.from('salidas').update(cambios).eq('id', rowNum).select('id');
    if (r.error) throw r.error;
    if (!r.data.length) return { ok: false, error: 'No se encontró la fila. Actualiza la pantalla.' };
    return { ok: true };
  });

  API.reemplazarSKUEnFilas = guard(async function (p, rowNumbers, skuDestino) {
    if (!rowNumbers || !rowNumbers.length) return { ok: true, count: 0 };
    var ids = rowNumbers.map(Number);
    var total = 0;
    for (var i = 0; i < ids.length; i += 200) {
      var r = await sb.from('salidas').update({ sku: str(skuDestino) }).in('id', ids.slice(i, i + 200)).select('id');
      if (r.error) throw r.error;
      total += r.data.length;
    }
    return { ok: true, count: total };
  });

  /* ── CANCELADOS ── */
  // Solo trae el rango pedido (por defecto, hoy)
  API.getCancelados = guard(async function (p, force, rango) {
    var rg = rangoPantalla(rango);
    var filas = await todas(function () {
      return filtroSede(sb.from('cancelados').select('*'), p).gte('fecha', rg.desde).lte('fecha', rg.hasta).order('id');
    });
    var data = filas.map(function (x) {
      return {
        _row: x.id, fecha: fmtFecha(x.fecha), hora: fmtHora(x.hora), sku: str(x.sku), nroPedido: str(x.nro_pedido),
        desc: str(x.descripcion), pack: num(x.pack), unidad: num(x.unidad), marca: str(x.marca),
        motorizado: str(x.motorizado), envases: str(x.envases), estado: str(x.estado),
        revision: str(x.revision), motivo: str(x.motivo)
      };
    });
    return { ok: true, data: data, rango: rg };
  });

  // Anula una cancelación hecha por error: el pedido completo vuelve de Cancelados a Salidas.
  API.anularCancelado = guard(async function (p, nroPedido) {
    var sede = exigirSede(p, null);
    var r = await sb.rpc('anular_cancelado', { p_sede: sede, p_nro_pedido: str(nroPedido) });
    if (r.error) throw r.error;
    return r.data;
  });

  /* ── ENTRADAS ── */
  function fVencTxt(v) {
    if (!v) return '';
    return /^\d{4}-\d{2}-\d{2}/.test(v) ? fmtFecha(v) : String(v);
  }
  // Solo trae el rango pedido (por defecto, hoy)
  API.getEntradas = guard(async function (p, force, rango) {
    var r = rangoPantalla(rango);
    var filas = await todas(function () {
      return filtroSede(sb.from('entradas').select('*'), p).gte('fecha', r.desde).lte('fecha', r.hasta).order('id');
    });
    return {
      ok: true,
      rango: r,
      data: filas.map(function (r) {
        return {
          _row: r.id, factura: str(r.factura), fecha: fmtFecha(r.fecha), sku: str(r.sku), desc: str(r.descripcion),
          unidades: num(r.unidades), fVenc: fVencTxt(r.f_vencimiento), proveedor: str(r.proveedor), oc: str(r.oc),
          dynamics: str(r.dynamics), responsable: str(r.responsable)
        };
      })
    };
  });

  API.registrarEntradasMultiple = guard(async function (p, filas, comun) {
    var sede = exigirSede(p, comun);
    var rows = [];
    for (var i = 0; i < filas.length; i++) {
      var f = filas[i], sku = str(f.sku), und = entero(f.unidades);
      if (!sku) return { ok: false, error: 'SKU vacío en fila ' + (i + 1) };
      if (und === null || und < 0) return { ok: false, error: 'Unidades inválidas en fila ' + (i + 1) };
      rows.push({
        sede_id: sede, factura: nulo(comun.factura), fecha: hoyISO(), sku: sku, descripcion: str(f.desc),
        unidades: und, f_vencimiento: nulo(comun.fVenc), proveedor: nulo(comun.proveedor), oc: nulo(comun.oc),
        dynamics: nulo(comun.dynamics), responsable: nulo(comun.responsable)
      });
    }
    var r = await sb.from('entradas').insert(rows);
    if (r.error) throw r.error;
    return { ok: true, registrados: rows.length };
  });

  API.editarDynamicsEntrada = guard(async function (p, rowNum, dynamics) {
    var ref = await sb.from('entradas').select('sede_id,oc').eq('id', rowNum).maybeSingle();
    if (ref.error) throw ref.error;
    if (!ref.data) return { ok: false, error: 'Fila no encontrada' };
    var oc = str(ref.data.oc);
    var q = sb.from('entradas').update({ dynamics: nulo(dynamics) }).eq('sede_id', ref.data.sede_id);
    q = oc ? q.eq('oc', oc) : q.eq('id', rowNum);
    var r = await q.select('id');
    if (r.error) throw r.error;
    return { ok: true, actualizados: r.data.length, oc: oc };
  });

  /* ── M-T ── */
  // Solo trae el rango pedido (por defecto, hoy)
  API.getMT = guard(async function (p, force, rango) {
    var rg = rangoPantalla(rango);
    var filas = await todas(function () {
      return filtroSede(sb.from('v_mt').select('*'), p).gte('fecha', rg.desde).lte('fecha', rg.hasta).order('id');
    });
    return {
      ok: true,
      rango: rg,
      data: filas.map(function (r) {
        return {
          _row: r.id, fecha: fmtFecha(r.fecha), sku: str(r.sku), desc: str(r.descripcion), cant: num(r.cantidad),
          tipo: str(r.tipo), motivo: str(r.motivo), obs: str(r.observaciones), estado: str(r.estado),
          nroFactura: str(r.nro_factura), fechaRetiro: fmtFecha(r.fecha_retiro), costo: num(r.costo)
        };
      })
    };
  });

  function validarMT(fila) {
    var cant = entero(fila.cant), sku = str(fila.sku), tipo = str(fila.tipo);
    if (!sku) return 'SKU es obligatorio';
    if (!tipo) return 'Tipo es obligatorio';
    if (cant === null || cant < 0) return 'Cantidad inválida';
    return null;
  }
  API.registrarMT = guard(async function (p, fila) {
    var e = validarMT(fila);
    if (e) return { ok: false, error: e };
    var sede = exigirSede(p, fila);
    var r = await sb.from('mt').insert({
      sede_id: sede, fecha: hoyISO(), sku: str(fila.sku), descripcion: str(fila.desc), cantidad: entero(fila.cant),
      tipo: str(fila.tipo), motivo: nulo(fila.motivo), observaciones: nulo(fila.obs)
    });
    if (r.error) throw r.error;
    return { ok: true };
  });
  API.editarMT = guard(async function (p, rowNum, fila) {
    var e = validarMT(fila);
    if (e) return { ok: false, error: e };
    var r = await sb.from('mt').update({
      sku: str(fila.sku), descripcion: str(fila.desc), cantidad: entero(fila.cant), tipo: str(fila.tipo),
      motivo: nulo(fila.motivo), observaciones: nulo(fila.obs), nro_factura: nulo(fila.nroFactura),
      fecha_retiro: parseFecha(fila.fechaRetiro)
    }).eq('id', Number(rowNum));
    if (r.error) throw r.error;
    return { ok: true };
  });
  API.eliminarMT = guard(async function (p, rowNum) {
    var r = await sb.from('mt').delete().eq('id', Number(rowNum));
    if (r.error) throw r.error;
    return { ok: true };
  });

  /* ── CONTEO ── */
  API.getMConteo = guard(async function (p) {
    var filas = await todas(function () { return filtroSede(sb.from('mconteo').select('*'), p).order('id'); });
    return {
      ok: true,
      data: filas.map(function (r) {
        return { id: r.id, ean: str(r.ean), sku: str(r.sku), sap: str(r.sap), producto: str(r.producto), multiplicador: Number(r.multiplicador || 1) };
      })
    };
  });

  // Alta y edición de una fila de MCONTEO (f.id = fila a editar; sin id = nueva). El EAN no puede repetirse en la sede.
  API.guardarMConteo = guard(async function (p, f) {
    var sede = exigirSede(p, null);
    var ean = normEan(f.ean), sku = str(f.sku), mult = Number(f.multiplicador);
    if (!ean) return { ok: false, error: 'El EAN es obligatorio' };
    if (!sku) return { ok: false, error: 'El SKU es obligatorio' };
    if (!(mult > 0)) return { ok: false, error: 'El multiplicador debe ser mayor a 0' };
    var dup = sb.from('mconteo').select('id').eq('sede_id', sede).eq('ean', ean).limit(1);
    if (f.id) dup = dup.neq('id', Number(f.id));
    dup = await dup;
    if (dup.error) throw dup.error;
    if (dup.data.length) return { ok: false, error: 'Ya existe ese EAN en el maestro de conteo.' };
    var fila = { ean: ean, sku: sku, sap: nulo(f.sap), producto: nulo(f.producto), multiplicador: mult };
    var r;
    if (f.id) {
      r = await sb.from('mconteo').update(fila).eq('id', Number(f.id)).eq('sede_id', sede).select('id');
      if (!r.error && !r.data.length) return { ok: false, error: 'No se pudo guardar (sin permiso o la fila ya no existe). Actualiza la pantalla.' };
    } else {
      fila.sede_id = sede;
      r = await sb.from('mconteo').insert(fila).select('id');
      if (!r.error && !r.data.length) return { ok: false, error: 'No se pudo guardar. Revisa tus permisos.' };
    }
    if (r.error) throw r.error;
    return { ok: true };
  });

  API.eliminarMConteo = guard(async function (p, id) {
    var sede = exigirSede(p, null);
    var r = await sb.from('mconteo').delete().eq('id', Number(id)).eq('sede_id', sede).select('id');
    if (r.error) throw r.error;
    if (!r.data.length) return { ok: false, error: 'No se pudo eliminar (sin permiso o la fila ya no existe).' };
    return { ok: true };
  });

  /* ── MAESTRO (MBEES): descripción del pedido -> SKU y unidades por pack ── */
  API.getMaestroMBEES = guard(async function (p) {
    var sede = exigirSede(p, null);
    var res = await Promise.all([
      todas(function () { return sb.from('mbees').select('descripcion,sku,factor').eq('sede_id', sede).order('descripcion'); }),
      todas(function () { return sb.from('sede_productos').select('sku,descripcion').eq('sede_id', sede).order('sku'); }),
      todas(function () { return sb.from('salidas').select('descripcion,pack').eq('sede_id', sede).in('sku', ['SIN SKU', '']).order('id'); })
    ]);
    var pend = {};
    res[2].forEach(function (r) {
      var d = str(r.descripcion);
      var x = pend[d] || (pend[d] = { descripcion: d, filas: 0, packs: 0 });
      x.filas++; x.packs += num(r.pack);
    });
    return {
      ok: true,
      data: res[0].map(function (r) { return { descripcion: str(r.descripcion), sku: str(r.sku), factor: num(r.factor) || 1 }; }),
      productos: res[1].map(function (r) { return { sku: str(r.sku), desc: str(r.descripcion) }; }),
      sinSku: Object.keys(pend).map(function (k) { return pend[k]; })
    };
  });

  API.guardarMBEES = guard(async function (p, f) {
    var sede = exigirSede(p, null);
    var desc = str(f.descripcion), sku = str(f.sku), factor = parseInt(f.factor, 10);
    if (!desc) return { ok: false, error: 'La descripción es obligatoria' };
    if (!sku) return { ok: false, error: 'El SKU es obligatorio' };
    if (!(factor >= 1)) return { ok: false, error: 'Las unidades por pack deben ser un número mayor a 0' };
    var orig = str(f.descripcionOriginal);
    var r;
    if (orig) {
      r = await sb.from('mbees').update({ descripcion: desc, sku: sku, factor: factor })
        .eq('sede_id', sede).eq('descripcion', orig).select('descripcion');
      if (!r.error && !r.data.length) return { ok: false, error: 'No se encontró la fila a editar. Actualiza la pantalla.' };
    } else {
      r = await sb.from('mbees').insert({ sede_id: sede, descripcion: desc, sku: sku, factor: factor });
    }
    if (r.error) {
      if (r.error.code === '23505') return { ok: false, error: 'Ya existe esa descripción en el maestro.' };
      throw r.error;
    }
    return { ok: true };
  });

  API.eliminarMBEES = guard(async function (p, descripcion) {
    var sede = exigirSede(p, null);
    var r = await sb.from('mbees').delete().eq('sede_id', sede).eq('descripcion', str(descripcion)).select('descripcion');
    if (r.error) throw r.error;
    return { ok: true, eliminados: r.data.length };
  });

  // opts: { descripcion (null = todo el maestro), incluirConSku, desde (dd/mm/aaaa o ISO), ejecutar }
  API.aplicarMaestro = guard(async function (p, opts) {
    var sede = exigirSede(p, null);
    opts = opts || {};
    var r = await sb.rpc('aplicar_maestro', {
      p_sede: sede,
      p_descripcion: opts.descripcion ? str(opts.descripcion) : null,
      p_incluir_con_sku: !!opts.incluirConSku,
      p_desde: opts.desde ? parseFecha(opts.desde) : null,
      p_ejecutar: !!opts.ejecutar
    });
    if (r.error) throw r.error;
    return r.data;
  });

  function mapMConteo(r) {
    return { ok: true, ean: str(r.ean), sku: str(r.sku), sap: str(r.sap), producto: str(r.producto), multiplicador: Number(r.multiplicador || 1) };
  }
  API.buscarEAN = guard(async function (p, ean) {
    var q = normEan(ean);
    var r = await filtroSede(sb.from('mconteo').select('*'), p).eq('ean', q).limit(1).maybeSingle();
    if (r.error) throw r.error;
    if (!r.data) return { ok: false, error: 'EAN ' + q + ' no encontrado en MCONTEO' };
    return mapMConteo(r.data);
  });
  API.buscarSKUConteo = guard(async function (p, sku) {
    var r = await filtroSede(sb.from('mconteo').select('*'), p).ilike('sku', lcEsc(str(sku))).limit(1).maybeSingle();
    if (r.error) throw r.error;
    if (!r.data) return { ok: false, error: 'SKU ' + sku + ' no encontrado en MCONTEO' };
    return mapMConteo(r.data);
  });

  function mapConteo(r) {
    return {
      _row: r.id, fecha: fmtFecha(r.fecha), hora: fmtHora(r.hora), ean: str(r.ean), sku: str(r.sku),
      producto: str(r.producto), packs: num(r.packs), und: num(r.und_packs), unds: num(r.unds),
      total: num(r.total), ubicacion: str(r.ubicacion), _uid: str(r.uid)
    };
  }
  // Trae el rango pedido (por defecto, hoy) y siempre los conteos de hoy, que la pantalla usa para sumar lo ya contado.
  API.getConteo = guard(async function (p, diasAtras, force, rango) {
    var r = rangoPantalla(rango), hoy = hoyISO();
    var filas = await todas(function () {
      var q = filtroSede(sb.from('conteos').select('*'), p);
      q = (r.desde <= hoy && r.hasta >= hoy)
        ? q.gte('fecha', r.desde).lte('fecha', r.hasta)
        : q.or('and(fecha.gte.' + r.desde + ',fecha.lte.' + r.hasta + '),fecha.eq.' + hoy);
      return q.order('id');
    });
    return { ok: true, data: filas.map(mapConteo), rango: r };
  });

  API.registrarConteo = guard(async function (p, filas) {
    var sede = exigirSede(p, null);
    var fecha = hoyISO(), hora = horaAhora();
    var inserted = [];
    var nuevas = [], edits = [];

    filas.forEach(function (f) {
      var packs = num(f.packs), mult = num(f.multiplicador || 1) || 1, sueltas = num(f.sueltas);
      var und = packs * mult;
      var fila = {
        sede_id: sede, uid: nulo(f._uid), fecha: fecha, hora: hora, ean: nulo(f.ean), sku: str(f.sku),
        producto: nulo(f.producto), packs: packs, und_packs: und, unds: sueltas, total: und + sueltas,
        ubicacion: null, created_by: p.usuario
      };
      if (f._editRow) edits.push({ id: Number(f._editRow), fila: fila });
      else nuevas.push(fila);
    });

    try {
      for (var i = 0; i < edits.length; i++) {
        var e = edits[i];
        var upd = await sb.from('conteos').update({
          fecha: e.fila.fecha, hora: e.fila.hora, ean: e.fila.ean, sku: e.fila.sku, producto: e.fila.producto,
          packs: e.fila.packs, und_packs: e.fila.und_packs, unds: e.fila.unds, total: e.fila.total
        }).eq('id', e.id).select('*').single();
        if (upd.error) throw upd.error;
        inserted.push(mapConteo(upd.data));
      }

      var conUid = nuevas.filter(function (x) { return x.uid; });
      var sinUid = nuevas.filter(function (x) { return !x.uid; });

      if (conUid.length) {
        var ins = await sb.from('conteos').upsert(conUid, { onConflict: 'sede_id,uid', ignoreDuplicates: true }).select('*');
        if (ins.error) throw ins.error;
        var creados = {};
        ins.data.forEach(function (r) { creados[r.uid] = r; inserted.push(mapConteo(r)); });
        var faltan = conUid.filter(function (x) { return !creados[x.uid]; }).map(function (x) { return x.uid; });
        if (faltan.length) {
          var ex = await sb.from('conteos').select('*').eq('sede_id', sede).in('uid', faltan);
          if (ex.error) throw ex.error;
          ex.data.forEach(function (r) { var m = mapConteo(r); m._duplicado = true; inserted.push(m); });
        }
      }
      if (sinUid.length) {
        var ins2 = await sb.from('conteos').insert(sinUid).select('*');
        if (ins2.error) throw ins2.error;
        ins2.data.forEach(function (r) { inserted.push(mapConteo(r)); });
      }
    } catch (err) {
      if (esRedCaida(err)) {
        return { ok: false, error: 'Sin conexión con el servidor. Reintenta en unos segundos.', retryable: true };
      }
      throw err;
    }
    return { ok: true, registrados: filas.length, inserted: inserted };
  });

  API.eliminarConteo = guard(async function (p, rowNum) {
    var r = await sb.from('conteos').delete().eq('id', Number(rowNum));
    if (r.error) throw r.error;
    return { ok: true };
  });
  API.eliminarConteoMultiple = guard(async function (p, rowNums) {
    if (!rowNums || !rowNums.length) return { ok: true, eliminados: 0 };
    var ids = rowNums.map(Number);
    for (var i = 0; i < ids.length; i += 200) {
      var r = await sb.from('conteos').delete().in('id', ids.slice(i, i + 200));
      if (r.error) throw r.error;
    }
    return { ok: true, eliminados: ids.length };
  });
  API.eliminarConteoPorSKU = guard(async function (p, sku, fechaStr) {
    var sede = exigirSede(p, null);
    var r = await sb.from('conteos').delete().eq('sede_id', sede).eq('sku', str(sku)).eq('fecha', parseFecha(fechaStr)).select('id');
    if (r.error) throw r.error;
    if (!r.data.length) return { ok: false, error: 'No se encontraron registros para ese SKU y fecha' };
    return { ok: true, eliminados: r.data.length };
  });

  API.getValidacion = guard(async function (p, fechaStr) {
    var sede = exigirSede(p, null);
    var r = await sb.rpc('get_validacion', { p_sede: sede, p_fecha: parseFecha(fechaStr) });
    if (r.error) throw r.error;
    return { ok: true, data: r.data || [] };
  });

  /* ── ÓRDENES DE COMPRA ── */
  API.getOrdenesCompra = guard(async function () {
    var filas = await todas(function () { return sb.from('ordenes_compra').select('*').order('oc'); });
    return {
      ok: true,
      data: filas.map(function (r, i) {
        return {
          _row: i + 2, sedeId: r.sede_id, oc: str(r.oc), proveedor: str(r.proveedor), fechaRecepcion: fmtFecha(r.fecha_recepcion),
          entrega: str(r.nombre_entrega), estado: str(r.estado_recepcion) || 'Pendiente'
        };
      })
    };
  });

  API.importarOC = guard(async function (p, filas) {
    var vistos = {}, rows = [], omitidas = 0;
    (filas || []).forEach(function (f) {
      var oc = str(f.oc);
      if (!oc || vistos[oc]) { omitidas++; return; }
      vistos[oc] = true;
      rows.push({
        oc: oc, cuenta_proveedor: nulo(f.cuentaProveedor), cuenta_facturacion: nulo(f.cuentaFacturacion),
        proveedor: nulo(f.proveedor), tipo_compra: nulo(f.tipoCompra), estado_aprobacion: nulo(f.estadoAprobacion),
        estado_orden: nulo(f.estadoOrden), divisa: nulo(f.divisa), fecha_recepcion: parseFecha(f.fechaRecepcion),
        modo_entrega: nulo(f.modoEntrega), condiciones_entrega: nulo(f.condicionesEntrega),
        acuerdo_compra: nulo(f.acuerdoCompra), entrega_directa: nulo(f.entregaDirecta),
        subcontrato_proyecto: nulo(f.subcontratoProyecto), nombre_entrega: nulo(f.nombreEntrega),
        estado_recepcion: 'Pendiente'
      });
    });
    if (!rows.length) return { ok: true, agregadas: 0, omitidas: omitidas };
    var r = await sb.from('ordenes_compra').upsert(rows, { onConflict: 'oc', ignoreDuplicates: true }).select('oc');
    if (r.error) throw r.error;
    return { ok: true, agregadas: r.data.length, omitidas: omitidas + (rows.length - r.data.length) };
  });

  API.validarRecepcionOC = guard(async function () {
    var r = await sb.rpc('validar_recepcion_oc');
    if (r.error) throw r.error;
    return { ok: true, actualizadas: r.data || 0 };
  });

  /* ── DASHBOARD: alertas por sede + estado de OC (una sola llamada) ── */
  API.getDashboard = guard(async function (p) {
    // Mantiene al día el estado de las OC (las que ya tienen entradas pasan a Recibido) para no mostrar vencidas falsas
    if (p.rol !== 'invitado') { try { await sb.rpc('validar_recepcion_oc'); } catch (e) { /* no bloquea el tablero */ } }
    var r = await sb.rpc('dashboard_resumen');
    if (r.error) throw r.error;
    return { ok: true, data: r.data };
  });

  API.getRecepcionesPorTienda = guard(async function (p, fecha) {
    var r = await sb.rpc('recepciones_por_sede', { p_fecha: parseFecha(fecha) });
    if (r.error) throw r.error;
    return {
      ok: true,
      data: r.data.map(function (x) { return { nombre: x.nombre, recepciones: x.recepciones, ocs: x.ocs || [] }; }),
      fecha: fecha || fmtFecha(hoyISO())
    };
  });

  API.getDetalleEntradaOC = guard(async function (p, tiendaNombre, oc) {
    var sede = (_sedes || []).find(function (s) { return s.nombre === tiendaNombre; });
    if (!sede) return { ok: false, error: 'Tienda no encontrada: ' + tiendaNombre };
    var r = await sb.from('entradas').select('*').eq('sede_id', sede.id).eq('oc', str(oc)).order('id');
    if (r.error) throw r.error;
    return {
      ok: true, tienda: tiendaNombre, oc: str(oc),
      data: r.data.map(function (x) {
        return {
          tienda: tiendaNombre, fecha: fmtFecha(x.fecha), sku: str(x.sku), desc: str(x.descripcion),
          unidades: num(x.unidades), factura: str(x.factura), proveedor: str(x.proveedor),
          dynamics: str(x.dynamics), responsable: str(x.responsable)
        };
      })
    };
  });

  API.getDetalleEntradaOCGlobal = guard(async function (p, oc) {
    var r = await sb.from('entradas').select('*').eq('oc', str(oc)).order('id');
    if (r.error) throw r.error;
    return {
      ok: true, oc: str(oc),
      data: r.data.map(function (x) {
        return {
          tienda: sedeNombre(x.sede_id), factura: str(x.factura), fecha: fmtFecha(x.fecha), sku: str(x.sku),
          desc: str(x.descripcion), unidades: num(x.unidades), proveedor: str(x.proveedor)
        };
      })
    };
  });

  /* ── EXPORT MULTI-SEDE ── */
  API.getExportMultiSede = guard(async function (p, modulo) {
    var cfg = {
      salidas: { tabla: 'v_salidas', cols: 'id,sede_id,fecha,hora,sku,nro_pedido,descripcion,pack,unidad,marca,motorizado,envases,estado,revision,tamano', map: function (r) {
        return { fecha: fmtFecha(r.fecha), hora: fmtHora(r.hora), sku: str(r.sku), nroPedido: str(r.nro_pedido), desc: str(r.descripcion),
          pack: r.pack || 0, unidad: r.unidad || 0, marca: str(r.marca), motorizado: str(r.motorizado), envases: str(r.envases),
          estado: str(r.estado), revision: str(r.revision), tamano: r.tamano == null ? '' : String(r.tamano) }; } },
      entradas: { tabla: 'entradas', cols: 'id,sede_id,factura,fecha,sku,descripcion,unidades,f_vencimiento,proveedor,oc,dynamics,responsable', map: function (r) {
        return { factura: str(r.factura), fecha: fmtFecha(r.fecha), sku: str(r.sku), desc: str(r.descripcion), unidades: r.unidades || 0,
          fVenc: fVencTxt(r.f_vencimiento), proveedor: str(r.proveedor), oc: str(r.oc), dynamics: str(r.dynamics), responsable: str(r.responsable) }; } },
      mt: { tabla: 'v_mt', cols: 'id,sede_id,fecha,sku,descripcion,cantidad,tipo,motivo,observaciones,estado,nro_factura,fecha_retiro', map: function (r) {
        return { fecha: fmtFecha(r.fecha), sku: str(r.sku), desc: str(r.descripcion), cant: r.cantidad || 0, tipo: str(r.tipo),
          motivo: str(r.motivo), obs: str(r.observaciones), estado: str(r.estado), nroFactura: str(r.nro_factura),
          fechaRetiro: fmtFecha(r.fecha_retiro) }; } },
      conteo: { tabla: 'conteos', cols: 'id,sede_id,fecha,hora,ean,sku,producto,packs,und_packs,unds,total,ubicacion', map: function (r) {
        return { fecha: fmtFecha(r.fecha), hora: fmtHora(r.hora), ean: str(r.ean), sku: str(r.sku), producto: str(r.producto),
          packs: r.packs || 0, und: r.und_packs || 0, unds: r.unds || 0, total: r.total || 0, ubicacion: str(r.ubicacion) }; } }
    }[modulo];
    if (!cfg) return { ok: false, error: 'Módulo no soportado: ' + modulo };
    var filas = await todas(function () { return sb.from(cfg.tabla).select(cfg.cols).order('id'); });
    var sedes = (_sedes || []).filter(function (s) { return p.rol !== 'store' || s.id === p.sede_id; }).map(function (s) {
      return { nombre: s.nombre, data: filas.filter(function (r) { return r.sede_id === s.id; }).map(cfg.map).filter(function (r) { return r.sku; }) };
    });
    return { ok: true, sedes: sedes };
  });

  /* ── ENVASES: conteo por líneas, movimientos, pendientes de motorizados y precios (todo manual, por tienda) ── */
  var ENV_TAMANOS = [310, 630, 1000];
  function mapEnvConteo(r) {
    return { id: r.id, fecha: r.fecha, estado: r.estado, tamano: r.tamano, ubicacion: str(r.ubicacion),
      packs: num(r.packs), solas: num(r.cajas_solas), unidades: num(r.unidades) };
  }
  function mapEnvMov(r) {
    return { id: r.id, fecha: r.fecha, tipo: r.tipo, tamano: r.tamano, estado: r.estado,
      packs: num(r.packs), unidades: num(r.unidades), nota: str(r.nota) };
  }
  function mapEnvPend(r) {
    return { id: r.id, fecha: r.fecha, motorizado: str(r.motorizado), tamano: r.tamano, cantidad: num(r.cantidad),
      estado: r.estado, fechaEntrega: r.fecha_entrega || '', nota: str(r.nota) };
  }
  function enteroNoNeg(v) { var n = entero(v === '' || v === null || v === undefined ? 0 : v); return n === null || n < 0 ? null : n; }

  API.getEnvases = guard(async function (p) {
    var sede = exigirSede(p, null);
    var desde = restarDias(hoyISO(), 120);
    var res = await Promise.all([
      todas(function () { return sb.from('envases_conteo').select('*').eq('sede_id', sede).gte('fecha', desde).order('fecha').order('id'); }),
      todas(function () { return sb.from('envases_mov').select('*').eq('sede_id', sede).gte('fecha', desde).order('fecha').order('id'); }),
      todas(function () { return sb.from('envases_pend').select('*').eq('sede_id', sede).order('fecha').order('id'); }),
      sb.from('envases_precio').select('grupo,precio').eq('sede_id', sede)
    ]);
    if (res[3].error) throw res[3].error;
    var precios = {};
    res[3].data.forEach(function (r) { precios[r.grupo] = Number(r.precio); });
    return { ok: true, hoy: hoyISO(), conteo: res[0].map(mapEnvConteo), mov: res[1].map(mapEnvMov), pend: res[2].map(mapEnvPend), precios: precios };
  });

  API.agregarEnvaseLinea = guard(async function (p, f) {
    var sede = exigirSede(p, null);
    var packs = enteroNoNeg(f.packs), solas = enteroNoNeg(f.solas), und = enteroNoNeg(f.unidades), fecha = parseFecha(f.fecha);
    if (!fecha) return { ok: false, error: 'Fecha inválida' };
    if (f.estado !== 'llena' && f.estado !== 'vacia') return { ok: false, error: 'Estado inválido' };
    if (ENV_TAMANOS.indexOf(Number(f.tamano)) < 0) return { ok: false, error: 'Envase inválido' };
    if (packs === null || solas === null || und === null) return { ok: false, error: 'Cantidades inválidas' };
    if (packs + solas + und === 0) return { ok: false, error: 'Ingresa al menos una cantidad' };
    var r = await sb.from('envases_conteo').insert({ sede_id: sede, fecha: fecha, estado: f.estado, tamano: Number(f.tamano),
      ubicacion: str(f.ubicacion) || 'Palet', packs: packs, cajas_solas: solas, unidades: und, created_by: p.usuario });
    if (r.error) throw r.error;
    return { ok: true };
  });
  API.eliminarEnvaseLinea = guard(async function (p, id) {
    var r = await sb.from('envases_conteo').delete().eq('id', Number(id));
    if (r.error) throw r.error;
    return { ok: true };
  });

  API.agregarEnvaseMov = guard(async function (p, f) {
    var sede = exigirSede(p, null);
    var packs = enteroNoNeg(f.packs), und = enteroNoNeg(f.unidades), fecha = parseFecha(f.fecha);
    if (!fecha) return { ok: false, error: 'Fecha inválida' };
    if (['entrada', 'devolucion', 'venta', 'baja'].indexOf(f.tipo) < 0) return { ok: false, error: 'Tipo inválido' };
    if (ENV_TAMANOS.indexOf(Number(f.tamano)) < 0) return { ok: false, error: 'Envase inválido' };
    if (packs === null || und === null) return { ok: false, error: 'Cantidades inválidas' };
    if (packs + und === 0) return { ok: false, error: 'Ingresa una cantidad' };
    var estado = f.estado === 'vacia' ? 'vacia' : 'llena';
    var r = await sb.from('envases_mov').insert({ sede_id: sede, fecha: fecha, tipo: f.tipo, tamano: Number(f.tamano), estado: estado,
      packs: packs, unidades: und, nota: nulo(f.nota), created_by: p.usuario });
    if (r.error) throw r.error;
    return { ok: true };
  });
  API.eliminarEnvaseMov = guard(async function (p, id) {
    var r = await sb.from('envases_mov').delete().eq('id', Number(id));
    if (r.error) throw r.error;
    return { ok: true };
  });

  API.agregarEnvasePend = guard(async function (p, f) {
    var sede = exigirSede(p, null);
    var cant = entero(f.cantidad), fecha = parseFecha(f.fecha), moto = str(f.motorizado);
    if (!moto) return { ok: false, error: 'Indica el motorizado' };
    if (!fecha) return { ok: false, error: 'Fecha inválida' };
    if (ENV_TAMANOS.indexOf(Number(f.tamano)) < 0) return { ok: false, error: 'Envase inválido' };
    if (cant === null || cant <= 0) return { ok: false, error: 'Cantidad inválida' };
    var r = await sb.from('envases_pend').insert({ sede_id: sede, fecha: fecha, motorizado: moto, tamano: Number(f.tamano),
      cantidad: cant, nota: nulo(f.nota), created_by: p.usuario });
    if (r.error) throw r.error;
    return { ok: true };
  });
  API.entregarEnvasePend = guard(async function (p, id, entregado) {
    var r = await sb.from('envases_pend').update(entregado === false
      ? { estado: 'pendiente', fecha_entrega: null }
      : { estado: 'entregado', fecha_entrega: hoyISO() }).eq('id', Number(id));
    if (r.error) throw r.error;
    return { ok: true };
  });
  API.eliminarEnvasePend = guard(async function (p, id) {
    var r = await sb.from('envases_pend').delete().eq('id', Number(id));
    if (r.error) throw r.error;
    return { ok: true };
  });

  API.guardarEnvasePrecios = guard(async function (p, precios) {
    var sede = exigirSede(p, null);
    var filas = [];
    ['caja', 'bot630_1000', 'bot310'].forEach(function (g) {
      var v = num(precios && precios[g]);
      if (v < 0) throw new Error('Precio inválido');
      filas.push({ sede_id: sede, grupo: g, precio: v });
    });
    var r = await sb.from('envases_precio').upsert(filas, { onConflict: 'sede_id,grupo' });
    if (r.error) throw r.error;
    return { ok: true };
  });

  /* ───────── google.script.run ───────── */
  function runner(onOk, onFail) {
    return new Proxy({}, {
      get: function (_, prop) {
        if (prop === 'withSuccessHandler') return function (fn) { return runner(fn, onFail); };
        if (prop === 'withFailureHandler') return function (fn) { return runner(onOk, fn); };
        return function () {
          var args = arguments;
          Promise.resolve()
            .then(function () {
              if (typeof API[prop] !== 'function') throw new Error('Función no soportada: ' + String(prop));
              return API[prop].apply(null, args);
            })
            .then(function (r) { if (onOk) onOk(r); },
                  function (e) { if (onFail) onFail(e); else console.error(e); });
        };
      }
    });
  }

  /* ───────── Tiempo real (Salidas) ───────── */
  var _rt = { canal: null, cambios: {}, timer: null, visto: false };

  async function _rtVaciar(rangoFn, onCambio) {
    var cambios = _rt.cambios; _rt.cambios = {};
    var upd = [], borrados = [];
    Object.keys(cambios).forEach(function (id) { (cambios[id] === 'del' ? borrados : upd).push(Number(id)); });
    var filas = [];
    for (var i = 0; i < upd.length; i += 100) {
      var r = await sb.from('v_salidas').select('*').in('id', upd.slice(i, i + 100));
      if (r.error) return;
      filas = filas.concat(r.data);
    }
    var rg = rangoFn() || {};
    var hoy = hoyISO();
    var desde = (rg.desde) || hoy, hasta = (rg.hasta) || hoy;
    filas = filas.filter(function (f) { return f.fecha >= desde && f.fecha <= hasta; });
    // una fila editada que sale del rango visible se trata como borrada
    var vistos = {}; filas.forEach(function (f) { vistos[f.id] = true; });
    upd.forEach(function (id) { if (!vistos[id]) borrados.push(id); });
    onCambio({ upserts: filas.map(mapSalida), borrados: borrados });
  }

  window.TadaRealtime = {
    // rangoFn: devuelve el rango cargado en pantalla ({desde,hasta}) o null = hoy
    salidas: async function (rangoFn, onCambio, onReconectar) {
      this.detener();
      var p = await contexto();
      if (!p) return;
      var cfg = { event: '*', schema: 'public', table: 'salidas' };
      if (p.rol === 'store') cfg.filter = 'sede_id=eq.' + p.sede_id;
      var avisar = function (pl) {
        var id = (pl.new && pl.new.id) || (pl.old && pl.old.id);
        if (!id) return;
        _rt.cambios[id] = pl.eventType === 'DELETE' ? 'del' : 'upd';
        clearTimeout(_rt.timer);
        _rt.timer = setTimeout(function () { _rtVaciar(rangoFn, onCambio).catch(function () {}); }, 300);
      };
      _rt.visto = false;
      // Realtime no admite filtros en DELETE (solo viaja el id): se escucha aparte y se ignora lo que no esté cargado.
      _rt.canal = sb.channel('salidas-vivo')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'salidas', filter: cfg.filter }, avisar)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'salidas', filter: cfg.filter }, avisar)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'salidas' }, avisar)
        .subscribe(function (status) {
          if (status !== 'SUBSCRIBED') return;
          if (_rt.visto && onReconectar) onReconectar(); // se cayó la conexión: pudo haber cambios perdidos
          _rt.visto = true;
        });
    },
    // true si el canal está conectado (el celular puede dejarlo caído al volver de segundo plano)
    vivo: function () { return !!(_rt.canal && _rt.canal.state === 'joined'); },
    detener: function () {
      clearTimeout(_rt.timer); _rt.cambios = {};
      if (_rt.canal) { try { sb.removeChannel(_rt.canal); } catch (e) { /* ignorar */ } _rt.canal = null; }
    }
  };

  window.google = { script: { run: runner(null, null) } };
})();
