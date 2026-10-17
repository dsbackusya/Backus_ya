import { createClient } from 'jsr:@supabase/supabase-js@2';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-ingest-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function igual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// La clave tiene la forma CODIGO_SEDE.secreto
async function sedeDesdeClave(clave: string): Promise<number | null> {
  const punto = clave.indexOf('.');
  if (punto < 1) return null;
  const codigo = clave.slice(0, punto);
  const secreto = clave.slice(punto + 1);
  const { data: sede } = await sb.from('sedes').select('id').eq('codigo', codigo).eq('activa', true).maybeSingle();
  if (!sede) return null;
  const { data: k } = await sb.from('ingest_keys').select('key_hash').eq('sede_id', sede.id).maybeSingle();
  if (!k) return null;
  return igual(await sha256(secreto), k.key_hash) ? sede.id : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);

  const sedeId = await sedeDesdeClave(req.headers.get('x-ingest-key') ?? '');
  if (sedeId === null) return json({ ok: false, error: 'No autorizado' }, 401);

  const texto = await req.text();
  if (!texto || texto.length > 300_000) return json({ ok: false, error: 'Cuerpo vacío o demasiado grande' }, 400);
  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(texto);
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  if (datos.accion === 'actualizar_motorizado') {
    const { data, error } = await sb.rpc('actualizar_motorizado', {
      p_sede: sedeId,
      p_nro_pedido: String(datos.numeroPedido ?? ''),
      p_motorizado: String(datos.motorizado ?? ''),
    });
    if (error) return json({ ok: false, error: error.message }, 500);
    return json(data);
  }

  const { data, error } = await sb.rpc('ingestar_pedido', { p_sede: sedeId, p_datos: datos });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json(data);
});
