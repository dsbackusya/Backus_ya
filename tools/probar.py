"""Pruebas básicas de Tada, sin instalar nada (solo Python y Edge o Chrome).

Uso:   python tools/probar.py            revisiones de archivos + arranque en navegador
       python tools/probar.py --rapido   solo las revisiones de archivos (sin abrir el navegador)

Qué revisa:
  1. Que todos los archivos que carga index.html existan y estén en la lista del service worker.
  2. Que cada archivo de web/js esté cargado desde index.html.
  3. Que las llaves, paréntesis y corchetes de cada .js y del .css estén balanceados.
  4. Que ninguna función de nivel superior esté definida dos veces (la segunda pisa a la primera sin avisar).
  5. Que cada función usada en onclick/onchange/oninput exista.
  6. Que cada llamada google.script.run.xxx(S.token, ...) exista como API.xxx en api.js.
  7. Que las migraciones de supabase/migrations estén numeradas sin repetir ni saltar.
  8. Arranque real: abre la app en un navegador sin ventana y falla si hay errores de JavaScript al cargar.

No prueba las pantallas con datos (eso necesita iniciar sesión). Sale con código 1 si algo falla.
"""
import base64
import functools
import http.server
import json
import os
import re
import shutil
import socket
import socketserver
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(RAIZ, 'web')
FALLOS = []
AVISOS = []


def leer(ruta):
    with open(ruta, encoding='utf-8') as f:
        return f.read()


def fallo(msg):
    FALLOS.append(msg)


def archivos_con_codigo():
    return archivos_js() + [os.path.join(WEB, 'index.html')]


def archivos_js():
    out = [os.path.join(WEB, n) for n in ('api.js', 'config.js', 'envases.js', 'documentos.js', 'sw.js')]
    carpeta = os.path.join(WEB, 'js')
    out += [os.path.join(carpeta, n) for n in sorted(os.listdir(carpeta)) if n.endswith('.js')]
    return [p for p in out if os.path.exists(p)]


# ── 1 y 2: archivos referenciados ─────────────────────────────────────────
def revisar_archivos():
    html = leer(os.path.join(WEB, 'index.html'))
    refs = re.findall(r'<script[^>]+src="([^"]+)"', html) + re.findall(r'<link[^>]+href="([^"]+)"', html)
    locales = [r for r in refs if not re.match(r'^(https?:|//|data:|#|mailto:)', r)]
    for r in locales:
        if not os.path.exists(os.path.join(WEB, r.split('?')[0])):
            fallo('index.html carga "%s" pero el archivo no existe' % r)
    scripts = [r for r in re.findall(r'<script[^>]+src="([^"]+)"', html) if r in locales]
    js_dir = os.path.join(WEB, 'js')
    for n in sorted(os.listdir(js_dir)):
        if n.endswith('.js') and 'js/' + n not in scripts:
            fallo('web/js/%s no se carga desde index.html' % n)
    sw = leer(os.path.join(WEB, 'sw.js'))
    m = re.search(r'const BASE = \[(.*?)\];', sw, re.S)
    base = re.findall(r"'([^']+)'", m.group(1)) if m else []
    for s in scripts:
        if s not in base:
            fallo('sw.js no incluye "%s" en BASE (no se instalaría para usar sin conexión)' % s)
    for b in base:
        if b != './' and not os.path.exists(os.path.join(WEB, b)):
            fallo('sw.js lista "%s" en BASE pero el archivo no existe (rompe la instalación del service worker)' % b)


# ── 3: balance de llaves ──────────────────────────────────────────────────
def balance(texto, es_css=False):
    pares = {')': '(', ']': '[', '}': '{'}
    pila = []
    i, n, linea = 0, len(texto), 1
    ultimo = ''  # último carácter significativo, para distinguir / de regex
    while i < n:
        c = texto[i]
        if c == '\n':
            linea += 1
        if texto.startswith('/*', i):
            j = texto.find('*/', i + 2)
            j = n if j < 0 else j + 2
            linea += texto.count('\n', i, j)
            i = j
            continue
        if not es_css and texto.startswith('//', i):
            j = texto.find('\n', i)
            i = n if j < 0 else j
            continue
        if c in '"\'' and not (es_css and c == "'" and False):
            j = i + 1
            while j < n and texto[j] != c:
                if texto[j] == '\\':
                    j += 1
                if j < n and texto[j] == '\n':
                    linea += 1
                    if not es_css and c in '"\'':
                        pass
                j += 1
            i = j + 1
            ultimo = c
            continue
        if c == '`' and not es_css:
            j = i + 1
            prof = 0
            while j < n:
                if texto[j] == '\\':
                    j += 2
                    continue
                if texto.startswith('${', j):
                    prof += 1
                    j += 2
                    continue
                if texto[j] == '}' and prof:
                    prof -= 1
                elif texto[j] == '`' and not prof:
                    break
                if texto[j] == '\n':
                    linea += 1
                j += 1
            i = j + 1
            ultimo = '`'
            continue
        if not es_css and c == '/' and (ultimo in '(,=:[!&|?{};+-*%<>~^' or ultimo == ''):
            j = i + 1
            en_clase = False
            while j < n and texto[j] != '\n':
                if texto[j] == '\\':
                    j += 2
                    continue
                if texto[j] == '[':
                    en_clase = True
                elif texto[j] == ']':
                    en_clase = False
                elif texto[j] == '/' and not en_clase:
                    break
                j += 1
            i = j + 1
            ultimo = '/'
            continue
        if c in '([{':
            pila.append((c, linea))
        elif c in ')]}':
            if not pila or pila[-1][0] != pares[c]:
                return 'línea %d: "%s" sin su pareja' % (linea, c)
            pila.pop()
        if not c.isspace():
            ultimo = c
        i += 1
    if pila:
        return 'línea %d: "%s" sin cerrar' % (pila[-1][1], pila[-1][0])
    return None


def revisar_balance():
    for ruta in archivos_js():
        err = balance(leer(ruta))
        if err:
            fallo('%s: %s' % (os.path.relpath(ruta, RAIZ), err))
    err = balance(leer(os.path.join(WEB, 'app.css')), es_css=True)
    if err:
        fallo('web/app.css: %s' % err)


# ── 4 y 5: funciones ──────────────────────────────────────────────────────
def funciones_nivel_superior():
    donde = {}
    for ruta in archivos_con_codigo():
        if ruta.endswith('sw.js') or ruta.endswith('config.js'):
            continue
        for m in re.finditer(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', leer(ruta), re.M):
            donde.setdefault(m.group(1), []).append(os.path.relpath(ruta, RAIZ))
    return donde


def nombres_globales():
    nombres = set(funciones_nivel_superior())
    for ruta in archivos_con_codigo():
        t = leer(ruta)
        nombres.update(re.findall(r'^(?:var|let|const)\s+([A-Za-z_$][\w$]*)', t, re.M))
        nombres.update(re.findall(r'^\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*function', t, re.M))
        nombres.update(re.findall(r'window\.([A-Za-z_$][\w$]*)\s*=', t))
        nombres.update(re.findall(r'^([A-Za-z_$][\w$]*)\s*=\s*', t, re.M))
    return nombres


def revisar_funciones():
    for nombre, lugares in funciones_nivel_superior().items():
        if len(lugares) > 1:
            fallo('la función "%s" está definida %d veces (%s); la última pisa a las otras' % (nombre, len(lugares), ', '.join(lugares)))
    globales = nombres_globales()
    ignorar = {'event', 'this', 'document', 'window', 'if', 'return', 'function', 'confirm', 'alert', 'setTimeout',
               'location', 'history', 'navigator', 'void', 'stopPropagation', 'preventDefault', 'new', 'typeof',
               'parseInt', 'parseFloat', 'String', 'Number', 'Math', 'JSON', 'Object', 'Array', 'console', 'esc', 'else'}
    usados = {}
    fuentes = [os.path.join(WEB, 'index.html')] + archivos_js()
    for ruta in fuentes:
        t = leer(ruta)
        for m in re.finditer(r'\bon(?:click|change|input|keydown|keyup|focus|blur|submit|dblclick)=\\?"([^"]*)"', t):
            for trozo in m.group(1).split(';'):
                mm = re.match(r"\s*(?:if\s*\([^)]*\)\s*)?(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(", trozo)
                if mm and mm.group(1) not in ignorar:
                    usados.setdefault(mm.group(1), os.path.relpath(ruta, RAIZ))
    for nombre, ruta in sorted(usados.items()):
        if nombre not in globales:
            fallo('%s usa "%s(...)" en un onclick/onchange, pero esa función no existe' % (ruta, nombre))


# ── 6: API ────────────────────────────────────────────────────────────────
def revisar_api():
    api = leer(os.path.join(WEB, 'api.js'))
    definidas = set(re.findall(r'API\.([A-Za-z_]\w*)\s*=', api))
    faltan = {}
    for ruta in archivos_js():
        if ruta.endswith('api.js'):
            continue
        for m in re.finditer(r'\.([A-Za-z_]\w*)\(\s*S\.token', leer(ruta)):
            if m.group(1) not in definidas:
                faltan.setdefault(m.group(1), os.path.relpath(ruta, RAIZ))
    for nombre, ruta in sorted(faltan.items()):
        fallo('%s llama a la API "%s" y api.js no la define' % (ruta, nombre))


# ── 7: migraciones ────────────────────────────────────────────────────────
def revisar_migraciones():
    carpeta = os.path.join(RAIZ, 'supabase', 'migrations')
    if not os.path.isdir(carpeta):
        return
    nums = []
    for n in sorted(os.listdir(carpeta)):
        m = re.match(r'^(\d+)_.+\.sql$', n)
        if m:
            nums.append(int(m.group(1)))
    for a, b in zip(nums, nums[1:]):
        if a == b:
            fallo('migraciones: el número %04d está repetido' % a)
        elif b != a + 1:
            AVISOS.append('migraciones: salto de %04d a %04d' % (a, b))


# ── 8: arranque en navegador (Edge o Chrome sin ventana, controlado por el protocolo de depuración) ──
def buscar_navegador():
    for ruta in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                 r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
                 r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                 r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'):
        if os.path.exists(ruta):
            return ruta
    return None


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class WS:
    """Cliente WebSocket mínimo (solo lo necesario para hablar con el navegador en localhost)."""

    def __init__(self, url):
        m = re.match(r'ws://([^:/]+):(\d+)(/.*)', url)
        self.s = socket.create_connection((m.group(1), int(m.group(2))), timeout=10)
        clave = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(('GET %s HTTP/1.1\r\nHost: %s:%s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                        'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n'
                        % (m.group(3), m.group(1), m.group(2), clave)).encode())
        cab = b''
        while b'\r\n\r\n' not in cab:
            cab += self.s.recv(1)
        if b' 101 ' not in cab.split(b'\r\n')[0]:
            raise RuntimeError('el navegador rechazó la conexión de depuración')
        self.buf = b''

    def enviar(self, obj):
        datos = json.dumps(obj).encode()
        n = len(datos)
        cab = bytes([0x81])
        if n < 126:
            cab += bytes([0x80 | n])
        elif n < 65536:
            cab += bytes([0x80 | 126]) + struct.pack('>H', n)
        else:
            cab += bytes([0x80 | 127]) + struct.pack('>Q', n)
        mask = os.urandom(4)
        self.s.sendall(cab + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(datos)))

    def _leer(self, n):
        while len(self.buf) < n:
            trozo = self.s.recv(65536)
            if not trozo:
                raise EOFError()
            self.buf += trozo
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recibir(self, espera):
        """Devuelve el siguiente mensaje JSON o None si no llega nada en `espera` segundos."""
        self.s.settimeout(espera)
        try:
            texto = b''
            while True:
                b0, b1 = self._leer(2)
                n = b1 & 0x7F
                if n == 126:
                    n = struct.unpack('>H', self._leer(2))[0]
                elif n == 127:
                    n = struct.unpack('>Q', self._leer(8))[0]
                datos = self._leer(n)
                if b0 & 0x0F in (1, 0):
                    texto += datos
                    if b0 & 0x80:
                        return json.loads(texto.decode('utf-8', 'replace'))
                elif b0 & 0x0F == 8:
                    raise EOFError()
        except socket.timeout:
            return None


def revisar_navegador():
    nav = buscar_navegador()
    if not nav:
        AVISOS.append('no encontré Edge ni Chrome: se omitió la prueba de arranque en navegador')
        return
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=WEB))
    srv.daemon_threads = True
    puerto = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with socket.socket() as t:
        t.bind(('127.0.0.1', 0))
        dbg = t.getsockname()[1]
    perfil = tempfile.mkdtemp(prefix='tada_prueba_')
    proc = subprocess.Popen([nav, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
                             '--remote-debugging-port=%d' % dbg, '--user-data-dir=' + perfil, 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        destino = None
        for _ in range(60):
            try:
                lista = json.loads(urllib.request.urlopen('http://127.0.0.1:%d/json/list' % dbg, timeout=2).read())
                destino = next((x for x in lista if x.get('type') == 'page'), None)
                if destino:
                    break
            except Exception:
                pass
            time.sleep(0.5)
        if not destino:
            fallo('no pude conectar con el navegador sin ventana')
            return
        ws = WS(destino['webSocketDebuggerUrl'])
        ident = [0]

        def cmd(metodo, params=None):
            ident[0] += 1
            ws.enviar({'id': ident[0], 'method': metodo, 'params': params or {}})
            return ident[0]

        for m in ('Runtime.enable', 'Log.enable', 'Page.enable', 'Network.enable'):
            cmd(m)
        cmd('Page.navigate', {'url': 'http://127.0.0.1:%d/index.html' % puerto})
        local = 'http://127.0.0.1:%d/' % puerto
        fin = time.time() + 9
        while time.time() < fin:
            ev = ws.recibir(0.5)
            if not ev:
                continue
            met, p = ev.get('method'), ev.get('params', {})
            if met == 'Runtime.exceptionThrown':
                d = p.get('exceptionDetails', {})
                texto = (d.get('exception') or {}).get('description') or d.get('text', '')
                fallo('error de JavaScript al arrancar: %s (%s:%s)' % (texto.splitlines()[0][:200] if texto else '?',
                                                                      os.path.basename(d.get('url', '') or ''), d.get('lineNumber', 0) + 1))
            elif met == 'Runtime.consoleAPICalled' and p.get('type') == 'error':
                texto = ' '.join(str(a.get('value', a.get('description', ''))) for a in p.get('args', []))
                if not re.search(r'Failed to load resource|net::ERR', texto):
                    fallo('console.error al arrancar: ' + texto[:200])
            elif met == 'Network.responseReceived':
                r = p.get('response', {})
                if r.get('url', '').startswith(local) and r.get('status', 200) >= 400:
                    fallo('archivo local con error %s: %s' % (r['status'], r['url'].replace(local, '')))
        qid = cmd('Runtime.evaluate', {'returnByValue': True, 'expression': """(function(){
            var f=['navTo','loadPage','showToast','doLogin','_debounce','loadDashboard','loadStock','loadEntradas','loadSalidas','loadMT','loadCancelados','loadMaestro','loadMconteo','loadConteo','loadEnvases','loadDocumentos'], faltan=f.filter(function(n){return typeof window[n]!=='function'});
            var lg=document.getElementById('s-login'), app=document.getElementById('s-app');
            return {faltan:faltan, login:!!(lg&&lg.classList.contains('active')), app:!!(app&&app.classList.contains('active'))};})()"""})
        for _ in range(20):
            ev = ws.recibir(1)
            if ev and ev.get('id') == qid:
                v = ev['result']['result'].get('value') or {}
                if v.get('faltan'):
                    fallo('al arrancar faltan funciones esenciales: ' + ', '.join(v['faltan']))
                if not v.get('login') and not v.get('app'):
                    fallo('ni la pantalla de login ni la de la app quedaron activas')
                break
        cmd('Browser.close')
    except Exception as e:
        fallo('la prueba en el navegador se interrumpió: %s' % e)
    finally:
        try:
            proc.wait(timeout=8)
        except Exception:
            proc.terminate()
        srv.shutdown()
        shutil.rmtree(perfil, ignore_errors=True)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    rapido = '--rapido' in sys.argv
    pasos = [('archivos del sitio', revisar_archivos), ('llaves y paréntesis', revisar_balance),
             ('funciones', revisar_funciones), ('API', revisar_api), ('migraciones', revisar_migraciones)]
    if not rapido:
        pasos.append(('arranque en navegador', revisar_navegador))
    for nombre, fn in pasos:
        antes = len(FALLOS)
        try:
            fn()
        except Exception as e:  # una revisión rota no debe esconder las demás
            fallo('la revisión "%s" falló al ejecutarse: %s' % (nombre, e))
        print('%s  %s' % ('OK   ' if len(FALLOS) == antes else 'FALLA', nombre))
    for a in AVISOS:
        print('aviso: ' + a)
    if FALLOS:
        print('\n%d problema(s):' % len(FALLOS))
        for f in FALLOS:
            print(' - ' + f)
        sys.exit(1)
    print('\nTodo en orden.')


if __name__ == '__main__':
    main()
