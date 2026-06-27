"""Card: campana de Gauss de la distribución de puntos de la porra. -> PNG."""
import os, math, cairosvg

DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
W = 380

# ---- Datos (122 jugadores activos) ----
BINS = ['≤31', '32-35', '36-39', '40-43', '44-47', '48-51', '52-55', '56-58']
COUNTS = [4, 6, 17, 33, 28, 19, 12, 3]
N = sum(COUNTS)           # 122
MEDIA = 43.7
SD = 7.1
LIDER = 58
MAXC = max(COUNTS)        # 33

# Geometría del gráfico
PX0, PX1 = 30, 356        # extremos del eje X (en px)
VMIN, VMAX = 28, 60       # rango de puntos que cubre el eje
BASE_Y = 372              # línea base de las barras
TOP_Y = 150               # techo (barra más alta)
PLOT_H = BASE_Y - TOP_Y

def xval(v):  # valor de puntos -> px
    return PX0 + (v - VMIN) / (VMAX - VMIN) * (PX1 - PX0)

def ybar(c):  # recuento -> px de altura (deja aire arriba para las etiquetas)
    return c / MAXC * PLOT_H * 0.88

H = 440
p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">']
p.append(f'<rect x="0" y="0" width="380" height="{H}" rx="16" fill="#1a1d26"/>')

# Cabecera
p.append('<rect x="0" y="0" width="380" height="74" rx="16" fill="#21242e"/>')
p.append('<rect x="0" y="58" width="380" height="16" fill="#21242e"/>')
p.append('<rect x="0" y="72" width="380" height="2" fill="#ffcc00"/>')
p.append('<text x="24" y="32" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#ffffff" letter-spacing="0.3">PORRA MUNDIAL <tspan fill="#ffcc00">\'26</tspan></text>')
p.append('<text x="24" y="53" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">Cómo se reparten los puntos · fase de grupos</text>')

# Eyebrow + resumen
p.append('<text x="24" y="100" font-family="Helvetica, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#ffcc00" letter-spacing="2">LA CAMPANA DE LA PORRA</text>')
p.append(f'<text x="24" y="124" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#c7ccd4">{N} jugadores · media <tspan fill="#ffffff" font-weight="700">44</tspan> · líder <tspan fill="#ffcc00" font-weight="700">{LIDER}</tspan> · casi todos entre 36 y 51</text>')

# Barras (una por bin de 4 puntos)
BW = (PX1 - PX0) / 8 * 0.62
for i, (lab, c) in enumerate(zip(BINS, COUNTS)):
    cv = 30 + 4 * i        # centro del bin en puntos
    cx = xval(cv)
    h = ybar(c)
    y = BASE_Y - h
    top_bin = (c == MAXC)
    col = '#1f8a52' if not top_bin else '#2bb56a'
    p.append(f'<rect x="{cx-BW/2:.1f}" y="{y:.1f}" width="{BW:.1f}" height="{h:.1f}" rx="3" fill="{col}"/>')
    # recuento encima
    p.append(f'<text x="{cx:.1f}" y="{y-6:.1f}" font-family="Helvetica, Arial, sans-serif" font-size="10" font-weight="700" fill="#c7ccd4" text-anchor="middle">{c}</text>')
    # etiqueta del bin
    p.append(f'<text x="{cx:.1f}" y="{BASE_Y+16:.1f}" font-family="Helvetica, Arial, sans-serif" font-size="8.6" fill="#7d8290" text-anchor="middle">{lab}</text>')

# Eje base
p.append(f'<line x1="{PX0}" y1="{BASE_Y}" x2="{PX1}" y2="{BASE_Y}" stroke="#3a3f4a" stroke-width="1"/>')

# Curva normal teórica superpuesta (campana de Gauss)
def pdf(v):
    return math.exp(-((v - MEDIA) ** 2) / (2 * SD * SD)) / (SD * math.sqrt(2 * math.pi))
# recuento esperado en un bin de 4 puntos -> mismas unidades que las barras
pts = []
v = VMIN
while v <= VMAX + 0.01:
    exp_c = N * 4 * pdf(v)
    pts.append((xval(v), BASE_Y - ybar(exp_c)))
    v += 0.5
path = 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in pts)
p.append(f'<path d="{path}" fill="none" stroke="#ffcc00" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>')

# Línea de la media
mx = xval(MEDIA)
p.append(f'<line x1="{mx:.1f}" y1="{TOP_Y-6}" x2="{mx:.1f}" y2="{BASE_Y}" stroke="#ffffff" stroke-width="1" stroke-dasharray="3 3" opacity="0.45"/>')
p.append(f'<text x="{mx:.1f}" y="{TOP_Y-12}" font-family="Helvetica, Arial, sans-serif" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.8">media 44</text>')

# Marcador del líder
lx = xval(LIDER)
p.append(f'<circle cx="{lx:.1f}" cy="{BASE_Y - ybar(3) - 14:.1f}" r="3" fill="#ffcc00"/>')
p.append(f'<text x="{lx:.1f}" y="{BASE_Y - ybar(3) - 22:.1f}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="700" fill="#ffcc00" text-anchor="middle">líder</text>')

p.append(f'<text x="190" y="{H-14}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#5f636e" text-anchor="middle">porra-mundial-2026 · la mayoría se agolpa en la media, pocos en los extremos</text>')
p.append('</svg>')

out = os.path.join(DESK, 'campana_puntos.png')
cairosvg.svg2png(bytestring=''.join(p).encode('utf-8'), write_to=out, output_width=W * 3)
print('->', out)
