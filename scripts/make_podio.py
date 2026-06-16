"""Card PODIO del día: lo que pone el top-3 en cada partido. -> PNG."""
import os, cairosvg

DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
W = 380

# ---- Datos del día ----
DATE_LABEL = 'Martes 16 de junio'
TOP3 = [
    {'pos': 1, 'name': 'Pedro J. Albácar', 'pts': 23},
    {'pos': 2, 'name': 'Luis Alonso',      'pts': 20},
    {'pos': 3, 'name': 'Ramón Colomer',    'pts': 18},
]
MATCHES = ['Francia–Senegal', 'Irak–Noruega', 'Argentina–Argelia', 'Austria–Jordania']
PREDS = {
    1: ['1-1', '1-3', '2-0', '2-0'],
    2: ['2-2', '0-3', '1-1', '2-0'],
    3: ['1-1', '1-1', '3-0', '2-0'],
}

CX = {2: 132, 1: 224, 3: 320}     # centros de columna (podio <-> tabla)
GOLD, SILVER, BRONZE = '#ffd24a', '#c9ccd4', '#d68a52'
MEDAL = {1: GOLD, 2: SILVER, 3: BRONZE}
INIT_COL = {1: GOLD, 2: '#e7e9ee', 3: '#e7b78a'}

def initials(name):
    parts = [w for w in name.split() if not (len(w) <= 2 and w.endswith('.'))]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return parts[0][:2].upper() if parts else '?'

GRID_TOP = 196
RH = 30
H = GRID_TOP + len(MATCHES) * RH + 22

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

by_pos = {t['pos']: t for t in TOP3}

# Realce del 1º: panel sutil que abarca cabecera + su columna en la tabla
p.append(f'<rect x="{CX[1]-52}" y="84" width="104" height="{GRID_TOP + len(MATCHES)*RH - 80}" rx="12" fill="rgba(255,210,74,0.05)" stroke="rgba(255,210,74,0.22)" stroke-width="1"/>')

# ---- Cabeceras de jugador (avatar + nombre + pts) ----
AV_Y = {1: 116, 2: 126, 3: 126}
AV_R = {1: 23, 2: 19, 3: 19}
for pos in (2, 1, 3):
    t = by_pos[pos]
    cx, cy, r = CX[pos], AV_Y[pos], AV_R[pos]
    ring = MEDAL[pos]
    # avatar
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#20242e" stroke="{ring}" stroke-width="{2.5 if pos==1 else 2}"/>')
    p.append(f'<text x="{cx}" y="{cy+ (5 if pos==1 else 4)}" font-family="Helvetica, Arial, sans-serif" font-size="{15 if pos==1 else 13}" font-weight="800" fill="{INIT_COL[pos]}" text-anchor="middle">{initials(t["name"])}</text>')
    # medallita con la posición (abajo-derecha del avatar)
    bx, by = cx + r - 3, cy + r - 3
    p.append(f'<circle cx="{bx}" cy="{by}" r="8.5" fill="{ring}" stroke="#1a1d26" stroke-width="1.5"/>')
    p.append(f'<text x="{bx}" y="{by+3}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" font-weight="800" fill="#1a1d26" text-anchor="middle">{pos}</text>')
    # nombre + puntos
    nm = t['name']
    nfs = 10.5 if len(nm) <= 14 else 9.3
    p.append(f'<text x="{cx}" y="166" font-family="Helvetica, Arial, sans-serif" font-size="{nfs}" font-weight="{800 if pos==1 else 700}" fill="#ffffff" text-anchor="middle">{nm}</text>')
    p.append(f'<text x="{cx}" y="181" font-family="Helvetica, Arial, sans-serif" font-size="10" font-weight="800" fill="{ring}" text-anchor="middle">{t["pts"]} pts</text>')

# ---- Tabla de predicciones ----
for i, mlabel in enumerate(MATCHES):
    y = GRID_TOP + i * RH
    if i % 2 == 0:
        p.append(f'<rect x="12" y="{y-7}" width="356" height="{RH}" rx="6" fill="rgba(255,255,255,0.022)"/>')
    p.append(f'<text x="18" y="{y+13}" font-family="Helvetica, Arial, sans-serif" font-size="9.8" font-weight="600" fill="#c9ced6">{mlabel}</text>')
    for pos in (2, 1, 3):
        pred = PREDS[pos][i]
        cx = CX[pos]
        big = (pos == 1)
        col = GOLD if big else '#ffffff'
        fs = 16 if big else 13.5
        p.append(f'<text x="{cx}" y="{y+14}" font-family="Helvetica, Arial, sans-serif" font-size="{fs}" font-weight="800" fill="{col}" text-anchor="middle">{pred}</text>')

p.append(f'<text x="190" y="{H-8}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="#5f636e" text-anchor="middle">porra-mundial-2026 · lo que juega el top 3 hoy</text>')
p.append('</svg>')

out = os.path.join(DESK, 'podio_2026-06-16.png')
cairosvg.svg2png(bytestring=''.join(p).encode('utf-8'), write_to=out, output_width=W * 3)
print('->', out)
