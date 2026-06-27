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
    {  # Panamá - Inglaterra
        'file': 'partido67_panama_inglaterra.png',
        'sub': '67º partido · Grupo L · 120 predicciones',
        'home': 'Panamá', 'away': 'Inglaterra', 'when': 'Hoy, 23:00 h', 'title_size': 16,
        'boxes': [('1 · PANAMÁ', '0%', votes_label(0), False),
                  ('X · EMPATE', '2%', votes_label(3), False),
                  ('2 · INGLATERRA', '98%', votes_label(117), True)],
        'scores': [('0-3',28),('1-3',28),('0-2',24),('0-4',12),('1-4',7),('1-2',7),
                   ('0-1',4),('1-6',3),('1-1',3),('1-5',2),('0-5',2)],
        'foot': 'porra-mundial-2026 · Inglaterra casi unánime (98%) · nadie ve ganar a Panamá',
    },
    {  # Croacia - Ghana
        'file': 'partido68_croacia_ghana.png',
        'sub': '68º partido · Grupo L · 120 predicciones',
        'home': 'Croacia', 'away': 'Ghana', 'when': 'Hoy, 23:00 h',
        'boxes': [('1 · CROACIA', '59%', votes_label(71), True),
                  ('X · EMPATE', '34%', votes_label(41), False),
                  ('2 · GHANA', '7%', votes_label(8), False)],
        'scores': [('1-1',27),('2-1',25),('2-0',15),('1-0',15),('2-2',11),('3-1',11),
                   ('1-2',5),('0-0',3),('3-2',3),('3-0',2),('0-1',2),('1-3',1)],
        'foot': 'porra-mundial-2026 · Croacia favorita (59%) pero el empate aprieta (34%)',
    },
    {  # Colombia - Portugal
        'file': 'partido71_colombia_portugal.png',
        'sub': '71º partido · Grupo K · 120 predicciones',
        'home': 'Colombia', 'away': 'Portugal', 'when': 'Madrugada, 01:30 h', 'title_size': 17,
        'boxes': [('1 · COLOMBIA', '2%', votes_label(2), False),
                  ('X · EMPATE', '28%', votes_label(34), False),
                  ('2 · PORTUGAL', '70%', votes_label(84), True)],
        'scores': [('1-2',47),('1-1',23),('1-3',21),('2-2',10),('2-3',8),('0-2',4),
                   ('0-1',3),('2-1',2),('3-3',1),('2-4',1)],
        'foot': 'porra-mundial-2026 · Portugal manda (70%) · 1-2 el marcador estrella',
    },
    {  # RD Congo - Uzbekistán
        'file': 'partido72_rdcongo_uzbekistan.png',
        'sub': '72º partido · Grupo K · 120 predicciones',
        'home': 'RD Congo', 'away': 'Uzbekistán', 'when': 'Madrugada, 01:30 h', 'title_size': 15,
        'boxes': [('1 · RD CONGO', '52%', votes_label(63), True),
                  ('X · EMPATE', '36%', votes_label(43), False),
                  ('2 · UZBEK.', '12%', votes_label(14), False)],
        'scores': [('1-1',26),('2-1',25),('1-0',21),('2-0',13),('0-0',11),('0-1',7),
                   ('2-2',5),('1-2',4),('0-2',3),('3-1',2),('3-3',1),('3-0',1),('3-2',1)],
        'foot': 'porra-mundial-2026 · el más abierto del día · RD Congo ligero favorito',
    },
    {  # Argelia - Austria
        'file': 'partido69_argelia_austria.png',
        'sub': '69º partido · Grupo J · 120 predicciones',
        'home': 'Argelia', 'away': 'Austria', 'when': 'Madrugada, 04:00 h',
        'boxes': [('1 · ARGELIA', '12%', votes_label(14), False),
                  ('X · EMPATE', '40%', votes_label(48), False),
                  ('2 · AUSTRIA', '48%', votes_label(58), True)],
        'scores': [('1-1',38),('1-2',35),('0-1',13),('2-1',10),('2-2',8),('0-2',6),
                   ('1-3',4),('0-0',2),('2-0',2),('3-2',1),('1-0',1)],
        'foot': 'porra-mundial-2026 · puro equilibrio · Austria 48%, empate 40%',
    },
    {  # Jordania - Argentina
        'file': 'partido70_jordania_argentina.png',
        'sub': '70º partido · Grupo J · 120 predicciones',
        'home': 'Jordania', 'away': 'Argentina', 'when': 'Madrugada, 04:00 h', 'title_size': 16,
        'boxes': [('1 · JORDANIA', '0%', votes_label(0), False),
                  ('X · EMPATE', '1%', votes_label(1), False),
                  ('2 · ARGENTINA', '99%', votes_label(119), True)],
        'scores': [('0-3',47),('0-4',20),('0-2',18),('1-3',17),('1-4',6),('0-1',3),
                   ('1-2',3),('1-5',2),('0-5',2),('1-1',1),('2-6',1)],
        'foot': 'porra-mundial-2026 · Argentina aplastante (99%) · 0-3 el marcador estrella',
    },
]

for cfg in CFGS:
    make_card(cfg)
