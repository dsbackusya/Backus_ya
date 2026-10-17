"""Crea un usuario de Tada (Supabase Auth + perfil).

Uso: python -I tools/crear_usuario.py --usuario "DS SAN MIGUEL" --rol store --sede SM [--password XXXXXXXXXX]
     python -I tools/crear_usuario.py --usuario "admin" --rol admin
Roles: store (requiere --sede), admin, invitado. Sin --password se genera una y se guarda en credenciales.local.txt
"""
import argparse, json, os, re, secrets, sys, unicodedata, urllib.request, urllib.error

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def leer_env():
    env = {}
    with open(os.path.join(RAIZ, '.env'), encoding='utf-8') as f:
        for linea in f:
            if '=' in linea and not linea.startswith('#'):
                k, v = linea.strip().split('=', 1)
                env[k] = v
    return env


def usuario_a_email(u):
    s = unicodedata.normalize('NFD', u.strip().lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-z0-9]+', '.', s).strip('.')
    return s + '@tada.local'


def llamar(env, metodo, ruta, cuerpo=None):
    h = {'apikey': env['SUPABASE_SECRET_KEY'], 'Content-Type': 'application/json'}
    req = urllib.request.Request(env['SUPABASE_URL'] + ruta, method=metodo, headers=h,
                                 data=json.dumps(cuerpo).encode() if cuerpo is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        sys.exit(f'{metodo} {ruta} -> {e.code}: {e.read().decode()[:300]}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--usuario', required=True)
    ap.add_argument('--rol', required=True, choices=['store', 'admin', 'invitado'])
    ap.add_argument('--sede')
    ap.add_argument('--password')
    a = ap.parse_args()
    env = leer_env()

    sede_id = None
    if a.rol == 'store':
        if not a.sede:
            sys.exit('El rol store requiere --sede')
        s = llamar(env, 'GET', f'/rest/v1/sedes?codigo=eq.{a.sede}&select=id')
        if not s:
            sys.exit(f'Sede {a.sede} no existe')
        sede_id = s[0]['id']

    pw = a.password or secrets.token_urlsafe(12)
    if len(pw) < 8:
        sys.exit('La contraseña debe tener mínimo 8 caracteres')
    if len(pw) < 10:
        print('Aviso: contraseña de menos de 10 caracteres; conviene cambiarla.')
    email = usuario_a_email(a.usuario)
    u = llamar(env, 'POST', '/auth/v1/admin/users',
               {'email': email, 'password': pw, 'email_confirm': True, 'user_metadata': {'usuario': a.usuario.strip()}})
    llamar(env, 'POST', '/rest/v1/perfiles', {'user_id': u['id'], 'usuario': a.usuario.strip(), 'rol': a.rol, 'sede_id': sede_id})

    if not a.password:
        with open(os.path.join(RAIZ, 'credenciales.local.txt'), 'a', encoding='utf-8') as f:
            f.write(f'{a.usuario.strip()}\t{pw}\t{a.rol}\t{a.sede or "*"}\n')
    print(f'Usuario creado: {a.usuario.strip()} ({a.rol}{", " + a.sede if a.sede else ""})' +
          ('' if a.password else ' — contraseña en credenciales.local.txt'))


if __name__ == '__main__':
    main()
