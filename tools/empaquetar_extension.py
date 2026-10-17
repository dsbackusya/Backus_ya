"""Genera dist/extension-<SEDE>/ con la extensión lista para instalar (config.js con la clave de la sede).

Uso: python -I tools/empaquetar_extension.py            (todas las sedes)
     python -I tools/empaquetar_extension.py SM ATE     (solo esas)
En Chrome: chrome://extensions > Modo desarrollador > Cargar descomprimida > dist/extension-SM
"""
import os, shutil, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def leer_env():
    env = {}
    with open(os.path.join(RAIZ, '.env'), encoding='utf-8') as f:
        for linea in f:
            if '=' in linea and not linea.startswith('#'):
                k, v = linea.strip().split('=', 1)
                env[k] = v
    return env


env = leer_env()
sedes = sys.argv[1:] or [k.replace('INGEST_KEY_', '') for k in env if k.startswith('INGEST_KEY_')]
for cod in sedes:
    destino = os.path.join(RAIZ, 'dist', f'extension-{cod}')
    shutil.rmtree(destino, ignore_errors=True)
    shutil.copytree(os.path.join(RAIZ, 'extension'), destino, ignore=shutil.ignore_patterns('config.js'))
    with open(os.path.join(destino, 'config.js'), 'w', encoding='utf-8') as f:
        f.write(f"const TADA_CONFIG = {{ URL: '{env['SUPABASE_URL']}', KEY: '{env['INGEST_KEY_' + cod]}' }};\n")
    print('generado', destino)
