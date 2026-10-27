"""Busca reglas de app.css cuyos selectores usan clases o ids que no aparecen en ningún HTML/JS del sitio.
Uso: python -I tools/css_muerto.py          (solo informa)
     python -I tools/css_muerto.py --quitar (reescribe web/app.css sin esas reglas y sin duplicados exactos)
Una clase cuenta como usada si su nombre aparece en cualquier parte del HTML o los JS (también si se arma por partes
y el nombre completo está escrito en algún lado)."""
import re, glob, sys, os

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
os.chdir(RAIZ)
css = open('app.css', encoding='utf-8').read()
src = ''.join(open(f, encoding='utf-8', errors='ignore').read()
              for f in ['index.html', 'api.js', 'envases.js', 'documentos.js'] + glob.glob('js/*.js'))
BS = chr(92)


def salta_texto(s, k):
    q = s[k]
    k += 1
    while s[k] != q:
        k += 2 if s[k] == BS else 1
    return k + 1


def parse(s, i, n):
    """Devuelve lista de (tipo, preludio, (ini_cuerpo, fin_cuerpo), ini, fin)."""
    out = []
    while i < n:
        while i < n and s[i].isspace():
            i += 1
        if i >= n:
            break
        if s.startswith('/*', i):
            i = s.index('*/', i) + 2
            continue
        j = i
        while j < n and s[j] not in '{;':
            j = salta_texto(s, j) if s[j] in '"\'' else j + 1
        if j >= n:
            break
        if s[j] == ';':
            out.append(('at', s[i:j], None, i, j + 1))
            i = j + 1
            continue
        k, d = j + 1, 1
        while d:
            c = s[k]
            if c in '"\'':
                k = salta_texto(s, k)
                continue
            if c == '/' and s[k + 1] == '*':
                k = s.index('*/', k) + 2
                continue
            d += (c == '{') - (c == '}')
            k += 1
        out.append(('blk', s[i:j].strip(), (j + 1, k - 1), i, k))
        i = k
    return out


tok = re.compile(r'[.#]([A-Za-z_][\w-]*)')
cache = {}


def usada(nm):
    if nm not in cache:
        ok = nm in src
        if not ok:
            # nombre armado por partes: 'prefijo-' + algo, o prefijo+número ('cols'+n)
            for m in re.finditer('-|(?<=[a-z])(?=[0-9]+$)', nm):
                pre = nm[:m.end()] if nm[m.end() - 1:m.end()] == '-' else nm[:m.start()]
                if pre and re.search(re.escape(pre) + r"""['"`]\s*\+|\$\{""", src):
                    ok = True
                    break
        cache[nm] = ok
    return cache[nm]


def muerta(pre):
    sels = [x.strip() for x in re.split(r',(?![^(]*\))', pre)]
    for sel in sels:
        limpio = re.sub(r'\[[^\]]*\]', '', sel)
        limpio = re.sub(r':(not|is|where|has)\([^)]*\)', '', limpio)
        nombres = tok.findall(limpio)
        if not nombres or all(usada(n) for n in nombres):
            return False
    return True


cortes = []     # (ini, fin, motivo, texto)
vistas = {}     # (contexto, preludio normalizado, cuerpo normalizado) -> (ini, fin)


def norm(t):
    return re.sub(r'\s+', ' ', t).strip()


def visita(reglas, ctx):
    for tipo, pre, cuerpo, a, b in reglas:
        if tipo != 'blk':
            continue
        if pre.startswith('@media') or pre.startswith('@supports'):
            visita(parse(css, cuerpo[0], cuerpo[1]), ctx + '|' + norm(pre))
        elif pre.startswith('@'):
            continue
        else:
            if muerta(pre):
                cortes.append((a, b, 'sin uso', pre[:100]))
                continue
            clave = (ctx, norm(pre), norm(css[cuerpo[0]:cuerpo[1]]))
            if clave in vistas:
                # un duplicado exacto solo es seguro quitarlo si es el mismo contexto y no hay otra regla
                # con el mismo selector entre medias; para no arriesgar, se conserva la ÚLTIMA copia
                cortes.append((vistas[clave][0], vistas[clave][1], 'duplicada', pre[:100]))
            vistas[clave] = (a, b)


visita(parse(css, 0, len(css)), '')
cortes.sort()
bytes_ = sum(b - a for a, b, _, _ in cortes)
print(f'{len(cortes)} reglas a quitar ({bytes_ // 1024} KB de {len(css) // 1024} KB)')
for m in ('sin uso', 'duplicada'):
    print(f'  {m}: {sum(1 for c in cortes if c[2] == m)}')
if '--lista' in sys.argv:
    for a, b, m, p in cortes:
        print(f'{m:9} {b - a:5d}  {p}')
if '--quitar' in sys.argv:
    res, pos = [], 0
    for a, b, _, _ in cortes:
        if a < pos:
            continue
        res.append(css[pos:a])
        pos = b
    res.append(css[pos:])
    nuevo = ''.join(res)
    nuevo = re.sub(r'\n{3,}', '\n\n', nuevo)
    open('app.css', 'w', encoding='utf-8', newline='').write(nuevo)
    print('app.css reescrito:', len(css) // 1024, 'KB ->', len(nuevo) // 1024, 'KB')
