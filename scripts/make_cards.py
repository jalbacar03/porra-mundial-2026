"""Genera todas las cards de la porra (formato ranking + banderas, look&feel) a PNG. 118 humanos."""
import os, base64, cairosvg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLAGS = os.path.join(ROOT, 'exports', 'flags')
DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
BASE = 118
W = 430

_cache = {}
def flag(code):
    if not code:
        return None
    if code not in _cache:
        with open(os.path.join(FLAGS, f'{code}.png'), 'rb') as f:
            _cache[code] = 'data:image/png;base64,' + base64.b64encode(f.read()).decode()
    return _cache[code]

def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def header(p, sub, badge, badge_fill, badge_stroke, badge_txt, H):
    p.append(f'<rect x="0" y="0" width="{W}" height="{H}" rx="16" fill="#1a1d26"/>')
    p.append(f'<rect x="0" y="0" width="{W}" height="78" rx="16" fill="#21242e"/>')
    p.append(f'<rect x="0" y="60" width="{W}" height="18" fill="#21242e"/>')
    p.append(f'<rect x="0" y="76" width="{W}" height="2" fill="#ffcc00"/>')
    p.append('<text x="24" y="34" font-family="Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff" letter-spacing="0.3">PORRA MUNDIAL <tspan fill="#ffcc00">\'26</tspan></text>')
    p.append(f'<text x="24" y="56" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#8a8f99">{esc(sub)}</text>')
    bw = max(54, 11*len(badge)+22)
    p.append(f'<rect x="{W-24-bw}" y="26" width="{bw}" height="26" rx="13" fill="{badge_fill}" stroke="{badge_stroke}" stroke-width="1"/>')
    p.append(f'<text x="{W-24-bw/2}" y="43" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="{badge_txt}" text-anchor="middle">{badge}</text>')

def ranking_card(filename, sub, badge, rows, footer, badge_red=False):
    # rows: list of (name, flagcode_or_None, votes)
    CT, RH = 92, 38
    H = CT + len(rows)*RH + 30
    mx = max(v for _, _, v in rows) or 1
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {H}">']
    bf = '#c0392b' if badge_red else 'none'
    bs = '#c0392b' if badge_red else '#3a3f4b'
    bt = '#ffffff' if badge_red else '#cfd3da'
    header(p, sub, badge, bf, bs, bt, H)
    for i, (name, code, votes) in enumerate(rows):
        top = CT + i*RH
        lead = (i == 0)
        col = '#ffcc00' if lead else '#ffffff'
        numcol = '#ffcc00' if lead else '#8a8f99'
        barcol = '#ffcc00' if lead else '#007a45'
        pct = f'{round(votes/BASE*100,1)}%'
        bar = max(2, round(votes/mx*68))
        p.append(f'<text x="32" y="{top+25}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="{numcol}" text-anchor="middle">{i+1}</text>')
        nx = 92
        if code:
            p.append(f'<image x="50" y="{top+10}" width="30" height="20" xlink:href="{flag(code)}" preserveAspectRatio="xMidYMid slice"/>')
            p.append(f'<rect x="50" y="{top+10}" width="30" height="20" fill="none" stroke="#3a3f4b" stroke-width="0.5"/>')
        else:
            nx = 50
        p.append(f'<text x="{nx}" y="{top+25}" font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="{col}">{esc(name)}</text>')
        p.append(f'<rect x="244" y="{top+13}" width="68" height="8" rx="4" fill="#2c303a"/>')
        p.append(f'<rect x="244" y="{top+13}" width="{bar}" height="8" rx="4" fill="{barcol}"/>')
        p.append(f'<text x="364" y="{top+25}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="{col}" text-anchor="end">{pct}</text>')
        p.append(f'<text x="412" y="{top+25}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#8a8f99" text-anchor="end">{votes}</text>')
    p.append(f'<text x="{W/2}" y="{H-14}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#5f636e" text-anchor="middle">{esc(footer)}</text>')
    p.append('</svg>')
    out = os.path.join(DESK, filename)
    cairosvg.svg2png(bytestring=''.join(p).encode('utf-8'), write_to=out, output_width=W*3)
    print('->', filename)

def yesno_card(filename, rows, footer):
    # rows: list of (question, yes_votes)
    CT, RH = 92, 52
    H = CT + len(rows)*RH + 26
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">']
    header(p, '¿Sí o No?  ·  118 votos', 'SÍ / NO', 'none', '#3a3f4b', '#cfd3da', H)
    for i, (q, yes) in enumerate(rows):
        top = CT + i*RH
        ypct = round(yes/BASE*100)
        npct = 100 - ypct
        ybar = round(yes/BASE*382)
        p.append(f'<text x="24" y="{top+16}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="#ffffff">{esc(q)}</text>')
        p.append(f'<rect x="24" y="{top+24}" width="382" height="14" rx="7" fill="#2c303a"/>')
        p.append(f'<rect x="24" y="{top+24}" width="{ybar}" height="14" rx="7" fill="#007a45"/>')
        p.append(f'<text x="30" y="{top+35}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff">Sí {ypct}%</text>')
        p.append(f'<text x="400" y="{top+35}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#8a8f99" text-anchor="end">No {npct}%</text>')
    p.append(f'<text x="{W/2}" y="{H-12}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#5f636e" text-anchor="middle">{esc(footer)}</text>')
    p.append('</svg>')
    out = os.path.join(DESK, filename)
    cairosvg.svg2png(bytestring=''.join(p).encode('utf-8'), write_to=out, output_width=W*3)
    print('->', filename)

# ===================== EQUIPOS =====================
ranking_card('01_campeon.png', 'Para ser campeón del Mundial  ·  118 votos', 'CAMPEÓN', [
    ('España','es',77),('Portugal','pt',20),('Brasil','br',7),('Francia','fr',7),('Inglaterra','gb-eng',6),('Argentina','ar',1),
], 'porra-mundial-2026  ·  2 de cada 3, con la Roja')

ranking_card('02_finalistas.png', 'Equipos más puestos en la final  ·  118 votos', 'FINAL', [
    ('España','es',93),('Portugal','pt',63),('Francia','fr',24),('Brasil','br',22),('Inglaterra','gb-eng',19),('Argentina','ar',12),('Alemania','de',2),('Marruecos','ma',1),
], 'porra-mundial-2026  ·  España finalista en 4 de cada 5 porras')

ranking_card('03_semifinalistas.png', 'Equipos más puestos en semifinales  ·  118 votos', 'SEMIS', [
    ('España','es',118),('Francia','fr',98),('Portugal','pt',90),('Brasil','br',58),('Inglaterra','gb-eng',48),('Argentina','ar',27),('Alemania','de',16),('Países Bajos','nl',5),
], 'porra-mundial-2026  ·  España en semis en el 100% de las porras')

ranking_card('04_revelacion.png', 'Selección revelación (llega a cuartos)  ·  118 votos', 'REVELACIÓN', [
    ('Noruega','no',25),('Marruecos','ma',23),('Ecuador','ec',15),('Países Bajos','nl',12),('Turquía','tr',12),('Colombia','co',8),('Senegal','sn',5),('Estados Unidos','us',3),
], 'porra-mundial-2026  ·  la sorpresa, muy repartida')

ranking_card('05_decepcion.png', 'Selección decepción (no pasa de 16avos)  ·  118 votos', 'DECEPCIÓN', [
    ('Bélgica','be',42),('Argentina','ar',21),('Brasil','br',19),('Alemania','de',17),('Inglaterra','gb-eng',15),('Francia','fr',2),('Portugal','pt',2),
], 'porra-mundial-2026  ·  Bélgica, la decepción favorita')

ranking_card('06_mas_goleadora.png', 'Selección más goleadora en grupos  ·  118 votos', 'GOLES', [
    ('España','es',32),('Alemania','de',20),('Brasil','br',19),('Francia','fr',14),('Portugal','pt',11),('Inglaterra','gb-eng',9),('Argentina','ar',7),('Bélgica','be',5),
], 'porra-mundial-2026  ·  9 selecciones recibieron votos')

ranking_card('07_menos_goleada.png', 'Selección menos goleada en grupos  ·  118 votos', 'DEFENSA', [
    ('España','es',53),('Portugal','pt',11),('Francia','fr',11),('Alemania','de',9),('Bélgica','be',7),('Inglaterra','gb-eng',6),('Argentina','ar',5),('Ecuador','ec',4),
], 'porra-mundial-2026  ·  la defensa española, la más fiable')

# ===================== JUGADORES (bandera = nacionalidad) =====================
ranking_card('08_mvp.png', 'MVP del torneo  ·  118 votos', 'MVP', [
    ('Lamine Yamal','es',60),('Pedri','es',15),('Vitinha','pt',12),('M. Olise','fr',11),('Kylian Mbappé','fr',5),('H. Kane','gb-eng',4),('Cristiano Ronaldo','pt',3),('Bruno Fernandes','pt',2),
], 'porra-mundial-2026  ·  medio grupo confía en Lamine')

ranking_card('09_bota_oro.png', 'Bota de Oro · máximo goleador  ·  118 votos', 'BOTA', [
    ('Kylian Mbappé','fr',60),('H. Kane','gb-eng',24),('Mikel Oyarzabal','es',13),('Ferran Torres','es',3),('Cristiano Ronaldo','pt',2),('L. Messi','ar',2),('M. Olise','fr',2),('Lamine Yamal','es',2),
], 'porra-mundial-2026  ·  Mbappé, el goleador de la peña')

ranking_card('10_asistente.png', 'Máximo asistente  ·  118 votos', 'ASIST.', [
    ('Lamine Yamal','es',41),('Bruno Fernandes','pt',25),('M. Olise','fr',21),('Pedri','es',10),('L. Messi','ar',4),('Vitinha','pt',3),('João Neves','pt',3),('O. Dembélé','fr',3),
], 'porra-mundial-2026  ·  Lamine, MVP y asistente para muchos')

ranking_card('11_guante_oro.png', 'Guante de Oro · mejor portero  ·  118 votos', 'GUANTE', [
    ('Diogo Costa','pt',30),('Unai Simón','es',19),('M. Maignan','fr',19),('David Raya','es',9),('Joan García','es',8),('J. Pickford','gb-eng',7),('Alisson Becker','br',7),('M. Neuer','de',6),
], 'porra-mundial-2026  ·  la más repartida: 12 porteros')

# ===================== MARCADOR (sin bandera por fila) =====================
ranking_card('12_resultado_hoy.png', 'México - Sudáfrica, hoy 21:00 h  ·  118 votos', 'HOY', [
    ('2-0',None,49),('2-1',None,33),('1-0',None,16),('3-1',None,10),('1-1',None,4),('3-0',None,3),('1-3',None,1),('2-2',None,1),('3-2',None,1),
], 'porra-mundial-2026  ·  solo 1 da ganador a Sudáfrica', badge_red=True)

# ===================== SÍ / NO =====================
yesno_card('13_si_no.png', [
    ('¿El campeón será europeo?', 114),
    ('¿Habrá hat-trick en el torneo?', 109),
    ('¿Goleada por 5+ de diferencia?', 95),
    ('¿Ambos equipos verán roja en un partido?', 82),
    ('¿La final se decidirá en penaltis?', 8),
], 'porra-mundial-2026  ·  el grupo casi unánime con el campeón europeo')

print('\nTodas generadas en', DESK)
