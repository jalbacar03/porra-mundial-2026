"""Card PODIO del día: lo que pone el top-3 en cada partido. Formato podio. -> PNG."""
import os, cairosvg

DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
W = 380

# ---- Datos del día ----
DATE_LABEL = 'Martes 16 de junio'
TOP3 = [
    {'pos': 1, 'name': 'Pedro J. Albácar', 'pts': 23, 'ex': 5},
    {'pos': 2, 'name': 'Luis Alonso',      'pts': 20, 'ex': 5},
    {'pos': 3, 'name': 'Ramón Colomer',    'pts': 18, 'ex': 4},
]
MATCHES = ['Francia–Senegal', 'Irak–Noruega', 'Argentina–Argelia', 'Austria–Jordania']
# predicciones alineadas con MATCHES, por posición
PREDS = {
    1: ['1-1', '1-3', '2-0', '2-0'],
    2: ['2-2', '0-3', '1-1', '2-0'],
    3: ['1-1', '1-1', '3-0', '2-0'],
}

# Centros de columna (alineados podio <-> tabla): 2º izq, 1º centro, 3º der
CX = {2: 122, 1: 222, 3: 322}
GOLD, SILVER, BRONZE = '#ffd700', '#c0c0c0', '#cd7f32'
MEDAL_COL = {1: GOLD, 2: SILVER, 3: BRONZE}

PODIUM_BASE = 200              # base inferior de los pedestales
PLATE = {  # (ancho, alto, top)
    1: (104, 96, PODIUM_BASE - 96),
    2: (88,  74, PODIUM_BASE - 74),
    3: (88,  62, PODIUM_BASE - 62),
}

GRID_TOP = 240
RH = 30
H = GRID_TOP + len(MATCHES) * RH + 24

p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">']
p.append(f'<rect x="0" y="0" width="380" height="{H}" rx="16" fill="#1a1d26"/>')
# Cabecera
p.append('<rect x="0" y="0" width="380" height="78" rx="16" fill="#21242e"/>')
p.append('<rect x="0" y="60" width="380" height="18" fill="#21242e"/>')
p.append('<rect x="0" y="76" width="380" height="2" fill="#ffcc00"/>')
p.append('<text x="24" y="34" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="0.3">PORRA MUNDIAL <tspan fill="#ffcc00">\'26</tspan></text>')
p.append(f'<text x="24" y="56" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">El podio predice · {DATE_LABEL}</text>')
p.append('<rect x="296" y="26" width="64" height="26" rx="13" fill="#0c3d28" stroke="#ffcc00" stroke-width="1.2"/>')
p.append('<text x="328" y="43" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffcc00" text-anchor="middle">TOP 3</text>')

# ---- Pedestales (2 izq · 1 centro · 3 der) ----
by_pos = {t['pos']: t for t in TOP3}
for pos in (2, 1, 3):
    t = by_pos[pos]
    w, h, top = PLATE[pos]
    cx = CX[pos]
    x = cx - w / 2
    fill = '#22301f' if pos == 1 else '#22252f'
    border = MEDAL_COL[pos]
    bw = 2 if pos == 1 else 1
    p.append(f'<rect x="{x:.0f}" y="{top}" width="{w}" height="{h+20}" rx="10" fill="{fill}" stroke="{border}" stroke-width="{bw}"/>')
    # medalla / posición
    p.append(f'<circle cx="{cx}" cy="{top+18}" r="13" fill="{border}"/>')
    p.append(f'<text x="{cx}" y="{top+22}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="800" fill="#1a1d26" text-anchor="middle">{pos}</text>')
    # nombre (recorta a nombre + 1er apellido si hace falta lo hacemos manual)
    nm = t['name']
    nfs = 10 if len(nm) <= 14 else 9
    p.append(f'<text x="{cx}" y="{top+40}" font-family="Helvetica, Arial, sans-serif" font-size="{nfs}" font-weight="700" fill="#ffffff" text-anchor="middle">{nm}</text>')
    # puntos
    p.append(f'<text x="{cx}" y="{top+h+13}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="800" fill="{border}" text-anchor="middle">{t["pts"]} pts</text>')

# ---- Banda dorada vertical detrás de la columna del 1º (énfasis) ----
p.append(f'<rect x="{CX[1]-46}" y="{GRID_TOP-10}" width="92" height="{len(MATCHES)*RH+8}" rx="8" fill="rgba(255,204,0,0.06)"/>')

# ---- Tabla de predicciones ----
for i, mlabel in enumerate(MATCHES):
    y = GRID_TOP + i * RH
    # separador
    if i > 0:
        p.append(f'<line x1="20" y1="{y-6}" x2="360" y2="{y-6}" stroke="#2c303a" stroke-width="0.5"/>')
    # nombre del partido (izquierda)
    p.append(f'<text x="20" y="{y+12}" font-family="Helvetica, Arial, sans-serif" font-size="10.5" font-weight="600" fill="#c9ced6">{mlabel}</text>')
    # predicciones por columna
    for pos in (2, 1, 3):
        pred = PREDS[pos][i]
        cx = CX[pos]
        big = (pos == 1)
        col = '#ffcc00' if big else '#ffffff'
        fs = 16 if big else 14
        p.append(f'<text x="{cx}" y="{y+13}" font-family="Helvetica, Arial, sans-serif" font-size="{fs}" font-weight="800" fill="{col}" text-anchor="middle">{pred}</text>')

p.append(f'<text x="190" y="{H-9}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="#5f636e" text-anchor="middle">porra-mundial-2026 · lo que juega el top 3 hoy</text>')
p.append('</svg>')

out = os.path.join(DESK, 'podio_2026-06-16.png')
cairosvg.svg2png(bytestring=''.join(p).encode('utf-8'), write_to=out, output_width=W * 3)
print('->', out)
