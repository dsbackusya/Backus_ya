"""Genera dist/extension-tada/ y dist/extension-tada.zip: UNA sola extensión para todas las sedes.

La sede se determina por el usuario con el que se inicia sesión en la extensión (DS SAN MIGUEL, DS ATE...).
Uso: python -I tools/empaquetar_extension.py
En Chrome: chrome://extensions > Modo desarrollador > Cargar descomprimida > dist/extension-tada
"""
import os, shutil

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
destino = os.path.join(RAIZ, 'dist', 'extension-tada')
shutil.rmtree(destino, ignore_errors=True)
for viejo in ('extension-SM', 'extension-ATE', 'extension-CHO'):
    shutil.rmtree(os.path.join(RAIZ, 'dist', viejo), ignore_errors=True)
shutil.copytree(os.path.join(RAIZ, 'extension'), destino)
shutil.make_archive(destino, 'zip', destino)
print('generado', destino, 'y', destino + '.zip')
