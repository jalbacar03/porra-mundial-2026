"""Cupón Brasil - Marruecos con 1X2 + TODOS los marcadores. -> PNG."""
import os, cairosvg

DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
W = 380
BASE = 120

# (marcador, votos) — todos, orden descendente
SCORES = [('2-1',41),('1-1',18),('2-2',14),('3-1',13),('1-2',8),('3-2',8),
          ('1-0',4),('2-0',4),('3-3',2),('4-2',2),('0-0',1),('0-1',1),
          ('0-2',1),('0-3',1),('2-3',1),('4-3',1)]
mx = max(v for _, v in SCORES)
CT = 256
RH = 22
H = CT + len(SCORES)*RH + 28

p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">']
p.append(f'<rect x="0" y="0" width="380" height="{H}" rx="16" fill="#1a1d26"/>')
p.append('<rect x="0" y="0" width="380" height="78" rx="16" fill="#21242e"/>')
p.append('<rect x="0" y="60" width="380" height="18" fill="#21242e"/>')
p.append('<rect x="0" y="76" width="380" height="2" fill="#ffcc00"/>')
p.append('<text x="24" y="34" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="0.3">PORRA MUNDIAL <tspan fill="#ffcc00">\'26</tspan></text>')
p.append('<text x="24" y="56" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">6º partido · Grupo C · 120 predicciones</text>')
p.append('<rect x="300" y="26" width="60" height="26" rx="13" fill="#c0392b"/>')
p.append('<text x="330" y="43" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">HOY</text>')
p.append('<text x="24" y="108" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff">Brasil <tspan fill="#5f636e" font-size="14">vs</tspan> Marruecos</text>')
p.append('<text x="24" y="127" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">Esta noche, 00:00 h · Nueva York</text>')

# 1X2
boxes = [('1 · BRASIL','61%','73 votos',True),('X · EMPATE','29%','35 votos',False),('2 · MARRUECOS','10%','12 votos',False)]
xs = [24,138,252]
for (label,pct,votes,lead),x in zip(boxes,xs):
    fill = '#0c3d28' if lead else '#21242e'
    stroke = ' stroke="#ffcc00" stroke-width="1.5"' if lead else ''
    pc = '#ffcc00' if lead else '#ffffff'
    sub = '#7c8a82' if lead else '#6f747f'
    p.append(f'<rect x="{x}" y="140" width="104" height="68" rx="10" fill="{fill}"{stroke}/>')
    p.append(f'<text x="{x+52}" y="161" font-family="Helvetica, Arial, sans-serif" font-size="9.5" font-weight="700" fill="{sub}" text-anchor="middle">{label}</text>')
    p.append(f'<text x="{x+52}" y="187" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="{pc}" text-anchor="middle">{pct}</text>')
    p.append(f'<text x="{x+52}" y="201" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="{sub}" text-anchor="middle">{votes}</text>')

p.append('<text x="24" y="238" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#8a8f99" letter-spacing="0.4">TODOS LOS MARCADORES</text>')

for i,(score,n) in enumerate(SCORES):
    top = CT + i*RH
    lead = (i==0)
    col = '#ffcc00' if lead else '#ffffff'
    barcol = '#ffcc00' if lead else '#007a45'
    bar = max(3, round(n/mx*180))
    pct = round(n/BASE*100,1)
    p.append(f'<text x="24" y="{top+14}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="{col}">{score}</text>')
    p.append(f'<rect x="78" y="{top+6}" width="180" height="9" rx="4.5" fill="#2c303a"/>')
    p.append(f'<rect x="78" y="{top+6}" width="{bar}" height="9" rx="4.5" fill="{barcol}"/>')
    p.append(f'<text x="300" y="{top+14}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99" text-anchor="end">{pct}%</text>')
    p.append(f'<text x="356" y="{top+14}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="{col}" text-anchor="end">{n}</text>')

p.append(f'<text x="190" y="{H-12}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#5f636e" text-anchor="middle">porra-mundial-2026 · 16 marcadores distintos · el más abierto</text>')
p.append('</svg>')

out = os.path.join(DESK, 'partido6_brasil_marruecos.png')
cairosvg.svg2png(bytestring=''.join(p).encode('utf-8'), write_to=out, output_width=W*3)
print('->', out)
