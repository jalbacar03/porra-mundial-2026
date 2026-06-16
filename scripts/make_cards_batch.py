"""Genera varias cards de partido (1X2 + todos los marcadores) en lote. -> PNG."""
import os, cairosvg

DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
W = 380
BASE = 120

def votes_label(n):
    return '1 voto' if n == 1 else f'{n} votos'

def make_card(cfg):
    SCORES = cfg['scores']
    mx = max(v for _, v in SCORES)
    CT = 256
    RH = 24 if len(SCORES) <= 12 else 22
    H = CT + len(SCORES) * RH + 28

    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">']
    p.append(f'<rect x="0" y="0" width="380" height="{H}" rx="16" fill="#1a1d26"/>')
    p.append('<rect x="0" y="0" width="380" height="78" rx="16" fill="#21242e"/>')
    p.append('<rect x="0" y="60" width="380" height="18" fill="#21242e"/>')
    p.append('<rect x="0" y="76" width="380" height="2" fill="#ffcc00"/>')
    p.append('<text x="24" y="34" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="0.3">PORRA MUNDIAL <tspan fill="#ffcc00">\'26</tspan></text>')
    p.append(f'<text x="24" y="56" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">{cfg["sub"]}</text>')
    p.append('<rect x="300" y="26" width="60" height="26" rx="13" fill="#c0392b"/>')
    p.append('<text x="330" y="43" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">HOY</text>')
    p.append(f'<text x="24" y="108" font-family="Helvetica, Arial, sans-serif" font-size="{cfg.get("title_size",18)}" font-weight="700" fill="#ffffff">{cfg["home"]} <tspan fill="#5f636e" font-size="14">vs</tspan> {cfg["away"]}</text>')
    p.append(f'<text x="24" y="127" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">{cfg["when"]}</text>')

    xs = [24, 138, 252]
    for (label, pct, votes, lead), x in zip(cfg['boxes'], xs):
        fill = '#0c3d28' if lead else '#21242e'
        stroke = ' stroke="#ffcc00" stroke-width="1.5"' if lead else ''
        pc = '#ffcc00' if lead else '#ffffff'
        sub = '#7c8a82' if lead else '#6f747f'
        p.append(f'<rect x="{x}" y="140" width="104" height="68" rx="10" fill="{fill}"{stroke}/>')
        p.append(f'<text x="{x+52}" y="161" font-family="Helvetica, Arial, sans-serif" font-size="9.5" font-weight="700" fill="{sub}" text-anchor="middle">{label}</text>')
        p.append(f'<text x="{x+52}" y="187" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="{pc}" text-anchor="middle">{pct}</text>')
        p.append(f'<text x="{x+52}" y="201" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="{sub}" text-anchor="middle">{votes}</text>')

    p.append('<text x="24" y="238" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#8a8f99" letter-spacing="0.4">TODOS LOS MARCADORES</text>')

    for i, (score, n) in enumerate(SCORES):
        top = CT + i * RH
        lead = (i == 0)
        col = '#ffcc00' if lead else '#ffffff'
        barcol = '#ffcc00' if lead else '#007a45'
        bar = max(3, round(n / mx * 180))
        pct = round(n / BASE * 100, 1)
        p.append(f'<text x="24" y="{top+14}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="{col}">{score}</text>')
        p.append(f'<rect x="78" y="{top+6}" width="180" height="9" rx="4.5" fill="#2c303a"/>')
        p.append(f'<rect x="78" y="{top+6}" width="{bar}" height="9" rx="4.5" fill="{barcol}"/>')
        p.append(f'<text x="300" y="{top+14}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99" text-anchor="end">{pct}%</text>')
        p.append(f'<text x="356" y="{top+14}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="{col}" text-anchor="end">{n}</text>')

    p.append(f'<text x="190" y="{H-12}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#5f636e" text-anchor="middle">{cfg["foot"]}</text>')
    p.append('</svg>')

    out = os.path.join(DESK, cfg['file'])
    cairosvg.svg2png(bytestring=''.join(p).encode('utf-8'), write_to=out, output_width=W * 3)
    print('->', out)


CFGS = [
    {  # Francia - Senegal
        'file': 'partido17_francia_senegal.png',
        'sub': '17º partido · Grupo I · 120 predicciones',
        'home': 'Francia', 'away': 'Senegal', 'when': 'Hoy, 21:00 h · Nueva York',
        'boxes': [('1 · FRANCIA', '88%', votes_label(105), True),
                  ('X · EMPATE', '10%', votes_label(12), False),
                  ('2 · SENEGAL', '2%', votes_label(3), False)],
        'scores': [('2-1',44),('3-1',31),('2-0',8),('1-1',7),('1-0',6),('3-0',4),
                   ('1-2',3),('2-2',3),('3-2',3),('4-0',3),('4-1',3),('4-2',2),
                   ('0-0',1),('3-3',1),('5-2',1)],
        'foot': 'porra-mundial-2026 · Francia favorita · 2-1 y 3-1 acaparan el grupo',
    },
    {  # Irak - Noruega
        'file': 'partido18_irak_noruega.png',
        'sub': '18º partido · Grupo I · 120 predicciones',
        'home': 'Irak', 'away': 'Noruega', 'when': 'Esta noche, 00:00 h · Boston',
        'boxes': [('1 · IRAK', '0%', votes_label(0), False),
                  ('X · EMPATE', '8%', votes_label(9), False),
                  ('2 · NORUEGA', '92%', votes_label(111), True)],
        'scores': [('0-2',52),('0-3',26),('1-2',12),('1-3',11),('1-1',7),('0-1',5),
                   ('0-4',4),('2-2',2),('2-4',1)],
        'foot': 'porra-mundial-2026 · nadie ve ganar a Irak · Noruega arrasa (0-2)',
    },
    {  # Argentina - Argelia
        'file': 'partido19_argentina_argelia.png',
        'sub': '19º partido · Grupo J · 120 predicciones',
        'home': 'Argentina', 'away': 'Argelia', 'when': 'Esta noche, 03:00 h · Kansas City',
        'boxes': [('1 · ARGENTINA', '93%', votes_label(112), True),
                  ('X · EMPATE', '6%', votes_label(7), False),
                  ('2 · ARGELIA', '1%', votes_label(1), False)],
        'scores': [('2-0',45),('2-1',20),('3-0',19),('3-1',16),('1-0',7),('1-1',6),
                   ('4-2',2),('0-0',1),('1-2',1),('3-2',1),('4-0',1),('4-1',1)],
        'foot': 'porra-mundial-2026 · Argentina clarísima · 2-0 el más votado',
    },
    {  # Austria - Jordania
        'file': 'partido20_austria_jordania.png',
        'sub': '20º partido · Grupo J · 120 predicciones',
        'home': 'Austria', 'away': 'Jordania', 'when': 'Madrugada, 06:00 h · San Francisco',
        'boxes': [('1 · AUSTRIA', '98%', votes_label(117), True),
                  ('X · EMPATE', '2%', votes_label(2), False),
                  ('2 · JORDANIA', '1%', votes_label(1), False)],
        'scores': [('2-0',67),('3-0',19),('1-0',14),('2-1',11),('3-1',3),('4-0',3),
                   ('0-1',1),('1-1',1),('2-2',1)],
        'foot': 'porra-mundial-2026 · Austria casi unánime · 2-0 se lleva el 56%',
    },
]

for cfg in CFGS:
    make_card(cfg)
