"""Card resumen de estadísticas de la porra (varias en una). -> PNG."""
import os, cairosvg

DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
W = 380
GOLD = '#ffcc00'

# (valor, título, subtítulo)
STATS = [
    ('120/120', 'El favorito que más pinchó', 'España 0-0 Cabo Verde · los 120 fallaron'),
    ('15º',     'Ir siempre con el favorito', 'te deja 15º de 120 · 14 baten a las cuotas'),
    ('29',      'El rey del casi', 'Álvaro García M.: más signos, pocos exactos'),
    ('10',      'El mejor día de la porra', '3 exactos en un día · nadie ha hecho pleno de 4'),
    ('13',      'Pelea abierta arriba', 'a 5 pts o menos del líder (52) · media: 39'),
]

ROW_TOP = 116
RH = 60
H = ROW_TOP + len(STATS) * RH + 30

p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">']
p.append(f'<rect x="0" y="0" width="380" height="{H}" rx="16" fill="#1a1d26"/>')

# Cabecera
p.append('<rect x="0" y="0" width="380" height="74" rx="16" fill="#21242e"/>')
p.append('<rect x="0" y="58" width="380" height="16" fill="#21242e"/>')
p.append('<rect x="0" y="72" width="380" height="2" fill="#ffcc00"/>')
p.append('<text x="24" y="32" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#ffffff" letter-spacing="0.3">PORRA MUNDIAL <tspan fill="#ffcc00">\'26</tspan></text>')
p.append('<text x="24" y="53" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">La porra en cifras · fase de grupos</text>')

# Eyebrow
p.append('<text x="24" y="100" font-family="Helvetica, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#ffcc00" letter-spacing="2">5 DATOS DEL MUNDIAL</text>')

# Filas de stats
for i, (val, title, sub) in enumerate(STATS):
    y = ROW_TOP + i * RH
    cy = y + RH / 2
    if i % 2 == 1:
        p.append(f'<rect x="12" y="{y+4}" width="356" height="{RH-8}" rx="9" fill="rgba(255,255,255,0.022)"/>')
    # separador fino
    if i > 0:
        p.append(f'<line x1="20" y1="{y+2}" x2="360" y2="{y+2}" stroke="#2c303a" stroke-width="0.6"/>')
    # valor (gold) — fuente menor si es largo
    vfs = 20 if len(val) > 4 else 29
    p.append(f'<text x="22" y="{cy+ (7 if vfs>24 else 6)}" font-family="Helvetica, Arial, sans-serif" font-size="{vfs}" font-weight="800" fill="{GOLD}">{val}</text>')
    # título + subtítulo
    p.append(f'<text x="120" y="{cy-4}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="#ffffff">{title}</text>')
    p.append(f'<text x="120" y="{cy+13}" font-family="Helvetica, Arial, sans-serif" font-size="10.3" fill="#8a8f99">{sub}</text>')

p.append(f'<text x="190" y="{H-12}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#5f636e" text-anchor="middle">porra-mundial-2026 · datos tras la fase de grupos</text>')
p.append('</svg>')

out = os.path.join(DESK, 'stats_resumen.png')
cairosvg.svg2png(bytestring=''.join(p).encode('utf-8'), write_to=out, output_width=W * 3)
print('->', out)
