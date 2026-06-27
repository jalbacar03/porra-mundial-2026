"""Muestra: card de Campeón con banderas + ranking, look&feel porra. -> PNG en escritorio."""
import os, base64, cairosvg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLAGS = os.path.join(ROOT, 'exports', 'flags')
DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)

def flag(code):
    with open(os.path.join(FLAGS, f'{code}.png'), 'rb') as f:
        b = base64.b64encode(f.read()).decode()
    return f'data:image/png;base64,{b}'

W = 420
SUB = 'Para ser campeón del Mundial  ·  118 votos'
# (nombre, code, votos, pct, bar_px_sobre_90)
ROWS = [
    ('España','es',77,'65.3%',90),
    ('Portugal','pt',20,'16.9%',23),
    ('Brasil','br',7,'5.9%',8),
    ('Francia','fr',7,'5.9%',8),
    ('Inglaterra','gb-eng',6,'5.1%',7),
    ('Argentina','ar',1,'0.8%',1),
]
CT = 92          # content top
RH = 38          # row height
H = CT + len(ROWS)*RH + 30

parts = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {H}">']
# fondo + header
parts.append(f'<rect x="0" y="0" width="{W}" height="{H}" rx="16" fill="#1a1d26"/>')
parts.append(f'<rect x="0" y="0" width="{W}" height="78" rx="16" fill="#21242e"/>')
parts.append(f'<rect x="0" y="60" width="{W}" height="18" fill="#21242e"/>')
parts.append(f'<rect x="0" y="76" width="{W}" height="2" fill="#ffcc00"/>')
parts.append('<text x="24" y="34" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="0.3">PORRA MUNDIAL <tspan fill="#ffcc00">\'26</tspan></text>')
parts.append(f'<text x="24" y="56" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">{SUB}</text>')
parts.append(f'<rect x="{W-92}" y="26" width="72" height="26" rx="13" fill="none" stroke="#3a3f4b" stroke-width="1"/>')
parts.append(f'<text x="{W-56}" y="43" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#cfd3da" text-anchor="middle">CAMPEÓN</text>')

for i,(name,code,votes,pct,bar) in enumerate(ROWS):
    top = CT + i*RH
    lead = (i==0)
    col = '#ffcc00' if lead else '#ffffff'
    numcol = '#ffcc00' if lead else '#8a8f99'
    barcol = '#ffcc00' if lead else '#007a45'
    parts.append(f'<text x="32" y="{top+25}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="{numcol}" text-anchor="middle">{i+1}</text>')
    parts.append(f'<image x="50" y="{top+10}" width="30" height="20" xlink:href="{flag(code)}" preserveAspectRatio="xMidYMid slice"/>')
    parts.append(f'<rect x="50" y="{top+10}" width="30" height="20" fill="none" stroke="#3a3f4b" stroke-width="0.5"/>')
    parts.append(f'<text x="92" y="{top+25}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="{col}">{name}</text>')
    parts.append(f'<rect x="215" y="{top+13}" width="90" height="8" rx="4" fill="#2c303a"/>')
    parts.append(f'<rect x="215" y="{top+13}" width="{bar}" height="8" rx="4" fill="{barcol}"/>')
    parts.append(f'<text x="350" y="{top+25}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="{col}" text-anchor="end">{pct}</text>')
    parts.append(f'<text x="396" y="{top+25}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#8a8f99" text-anchor="end">{votes}</text>')

parts.append(f'<text x="{W/2}" y="{H-14}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#5f636e" text-anchor="middle">porra-mundial-2026  ·  6 selecciones recibieron votos</text>')
parts.append('</svg>')

svg = ''.join(parts)
out = os.path.join(DESK, '0_muestra_campeon_banderas.png')
cairosvg.svg2png(bytestring=svg.encode('utf-8'), write_to=out, output_width=W*3)
print('->', out)
