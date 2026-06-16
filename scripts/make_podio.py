"""Card PODIO del día: lo que pone el top-3 (con empates) en cada partido. -> PNG.
Formato en filas: una persona por fila → escala a cualquier nº de empatados."""
import os, cairosvg

DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
W = 380

# ---- Datos del día ----
DATE_LABEL = 'Martes 16 de junio'
MATCHES = ['Francia–Senegal', 'Irak–Noruega', 'Argentina–Argelia', 'Austria–Jordania']
CODES = ['FRA-SEN', 'IRK-NOR', 'ARG-ALG', 'AUT-JOR']
# Cada persona: rank, nombre, pts y predicciones alineadas con MATCHES
PEOPLE = [
    {'rank': 1, 'name': 'Pedro J. Albácar', 'pts': 23, 'preds': ['1-1', '1-3', '2-0', '2-0']},
    {'rank': 2, 'name': 'Luis Alonso',      'pts': 20, 'preds': ['2-2', '0-3', '1-1', '2-0']},
    {'rank': 3, 'name': 'Kike Sala-Vivé',   'pts': 18, 'preds': ['1-0', '0-2', '1-0', '3-0']},
    {'rank': 3, 'name': 'Ramón Colomer',    'pts': 18, 'preds': ['1-1', '1-1', '3-0', '2-0']},
]

GOLD, SILVER, BRONZE = '#ffd24a', '#c9ccd4', '#d68a52'
MEDAL = {1: GOLD, 2: SILVER, 3: BRONZE}

def medal_col(rank):
    return MEDAL.get(rank, '#8a8f99')

def initials(name):
    parts = [w for w in name.split() if not (len(w) <= 2 and w.endswith('.'))]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return parts[0][:2].upper() if parts else '?'

CX = [186, 238, 290, 342]     # centros de las 4 columnas de predicción
HEAD_Y = 98
ROWS_TOP = 112
RH = 44
H = ROWS_TOP + len(PEOPLE) * RH + 24

p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">']
p.append(f'<rect x="0" y="0" width="380" height="{H}" rx="16" fill="#1a1d26"/>')
# Cabecera
p.append('<rect x="0" y="0" width="380" height="74" rx="16" fill="#21242e"/>')
p.append('<rect x="0" y="58" width="380" height="16" fill="#21242e"/>')
p.append('<rect x="0" y="72" width="380" height="2" fill="#ffcc00"/>')
p.append('<text x="24" y="32" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#ffffff" letter-spacing="0.3">PORRA MUNDIAL <tspan fill="#ffcc00">\'26</tspan></text>')
p.append(f'<text x="24" y="53" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">El podio predice · {DATE_LABEL}</text>')
p.append('<rect x="298" y="24" width="62" height="25" rx="12.5" fill="#0c3d28" stroke="#ffcc00" stroke-width="1.2"/>')
p.append('<text x="329" y="40" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffcc00" text-anchor="middle">TOP 3</text>')

# ---- Cabecera de columnas: códigos de partido ----
p.append('<text x="18" y="{}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="700" fill="#6f747f" letter-spacing="0.4">PARTICIPANTE</text>'.format(HEAD_Y))
for cx, code in zip(CX, CODES):
    p.append(f'<text x="{cx}" y="{HEAD_Y}" font-family="Helvetica, Arial, sans-serif" font-size="8.5" font-weight="700" fill="#7d8290" text-anchor="middle" letter-spacing="0.3">{code}</text>')
p.append(f'<line x1="14" y1="{HEAD_Y+7}" x2="366" y2="{HEAD_Y+7}" stroke="#2c303a" stroke-width="0.7"/>')

# ---- Filas (una por persona) ----
for i, person in enumerate(PEOPLE):
    y = ROWS_TOP + i * RH
    cy = y + RH / 2
    mc = medal_col(person['rank'])
    first = (person['rank'] == 1)
    # fondo de fila
    if first:
        p.append(f'<rect x="12" y="{y+3}" width="356" height="{RH-6}" rx="9" fill="rgba(255,210,74,0.07)" stroke="rgba(255,210,74,0.30)" stroke-width="1"/>')
    elif i % 2 == 1:
        p.append(f'<rect x="12" y="{y+3}" width="356" height="{RH-6}" rx="9" fill="rgba(255,255,255,0.022)"/>')
    # medalla
    p.append(f'<circle cx="28" cy="{cy}" r="9.5" fill="{mc}"/>')
    p.append(f'<text x="28" y="{cy+3.3}" font-family="Helvetica, Arial, sans-serif" font-size="10" font-weight="800" fill="#1a1d26" text-anchor="middle">{person["rank"]}</text>')
    # avatar
    p.append(f'<circle cx="56" cy="{cy}" r="14" fill="#20242e" stroke="{mc}" stroke-width="2"/>')
    p.append(f'<text x="56" y="{cy+4}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">{initials(person["name"])}</text>')
    # nombre + pts
    nm = person['name']
    nfs = 11 if len(nm) <= 15 else 10
    p.append(f'<text x="76" y="{cy-2}" font-family="Helvetica, Arial, sans-serif" font-size="{nfs}" font-weight="{800 if first else 700}" fill="#ffffff">{nm}</text>')
    p.append(f'<text x="76" y="{cy+11}" font-family="Helvetica, Arial, sans-serif" font-size="8.8" font-weight="800" fill="{mc}">{person["pts"]} pts</text>')
    # predicciones
    for cx, pred in zip(CX, person['preds']):
        col = GOLD if first else '#ffffff'
        fs = 14.5 if first else 13
        p.append(f'<text x="{cx}" y="{cy+4.5}" font-family="Helvetica, Arial, sans-serif" font-size="{fs}" font-weight="800" fill="{col}" text-anchor="middle">{pred}</text>')

p.append(f'<text x="190" y="{H-8}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="#5f636e" text-anchor="middle">porra-mundial-2026 · lo que juega el top 3 hoy</text>')
p.append('</svg>')

out = os.path.join(DESK, 'podio_2026-06-16.png')
cairosvg.svg2png(bytestring=''.join(p).encode('utf-8'), write_to=out, output_width=W * 3)
print('->', out)
