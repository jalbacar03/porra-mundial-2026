"""Card EN VIVO Sudáfrica-Canadá (dieciseisavos) con Pillow. -> PNG WhatsApp."""
import os
from PIL import Image, ImageDraw, ImageFont

DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
S = 3  # escala (nitidez)

# Fuentes macOS
def font(sz, bold=False):
    paths = ([ '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
               '/Library/Fonts/Arial Bold.ttf' ] if bold else
             [ '/System/Library/Fonts/Supplemental/Arial.ttf',
               '/Library/Fonts/Arial.ttf' ])
    paths += ['/System/Library/Fonts/Helvetica.ttc']
    for p in paths:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz*S)
            except Exception: pass
    return ImageFont.load_default()

# Datos
BASE = 111
B1X2 = [('1 · SUDÁFRICA', 6, '7 votos', False),
        ('X · EMPATE',    8, '9 votos', False),
        ('2 · CANADÁ',    86,'95 votos', True)]
SCORES = [('0-2',33),('1-2',32),('0-1',14),('1-3',10),('1-1',9),('1-0',6)]
mx = max(v for _,v in SCORES)

W = 380
CT = 264            # top de marcadores
RH = 26
H = CT + len(SCORES)*RH + 86

img = Image.new('RGB', (W*S, H*S), '#1a1d26')
d = ImageDraw.Draw(img)
def rrect(x,y,w,h,r,fill,outline=None,ow=0):
    d.rounded_rectangle([x*S,y*S,(x+w)*S,(y+h)*S], radius=r*S, fill=fill,
                        outline=outline, width=max(1,ow*S) if outline else 1)
def txt(x,y,s,sz,col,bold=False,anchor='la'):
    d.text((x*S,y*S), s, font=font(sz,bold), fill=col, anchor=anchor)

GOLD='#ffcc00'; BLUE='#2563eb'; BLUEL='#60a5fa'; MUT='#8a8f99'; DIM='#5f636e'; WHITE='#ffffff'

# Header
rrect(0,0,W,84,16,'#21242e')
d.rectangle([0,82*S,W*S,84*S], fill=BLUE)
txt(24,20,'PORRA MUNDIAL ', 18, WHITE, True)
w_pm = d.textlength('PORRA MUNDIAL ', font=font(18,True))
txt(24+w_pm/S,20,"'26", 18, GOLD, True)
txt(24,48,'Dieciseisavos · cuadro real · '+str(BASE)+' porras', 11, MUT)
# Badge EN VIVO
rrect(286,18,74,28,14,'#c0392b')
d.ellipse([(296)*S,(28)*S,(304)*S,(36)*S], fill=WHITE)
txt(330,32,'EN VIVO', 11, WHITE, True, anchor='mm')

# Partido + marcador vivo
txt(24,112,'Sudáfrica', 19, WHITE, True)
wsud = d.textlength('Sudáfrica', font=font(19,True))/S
txt(24+wsud+8,113,'0 - 0', 17, BLUEL, True)
wsc = d.textlength('0 - 0', font=font(17,True))/S
txt(24+wsud+8+wsc+8,113,'Canadá', 19, WHITE, True)
txt(24,134,'En juego · 0-0 · dieciseisavos', 11, MUT)

# 1X2
xs=[24,138,252]
for (label,pct,votes,lead),x in zip(B1X2,xs):
    fill = '#12233f' if lead else '#21242e'
    rrect(x,150,104,66,10,fill, outline=(BLUE if lead else None), ow=(2 if lead else 0))
    pc = BLUEL if lead else WHITE
    sub = '#7e93b5' if lead else '#6f747f'
    txt(x+52,168,label, 10, sub, True, anchor='mm')
    txt(x+52,190,str(pct)+'%', 22, pc, True, anchor='mm')
    txt(x+52,208,votes, 9, sub, anchor='mm')

# Marcadores
txt(24,246,'MARCADORES MÁS PUESTOS', 11, MUT, True)
for i,(score,n) in enumerate(SCORES):
    top = CT + i*RH
    lead = (i==0)
    col = BLUEL if lead else WHITE
    barcol = BLUE if lead else '#007a45'
    bar = max(3, round(n/mx*176))
    pct = round(n/BASE*100,1)
    txt(24,top+15,score, 13, col, True)
    rrect(78,top+7,180,9,4.5,'#2c303a')
    rrect(78,top+7,bar,9,4.5,barcol)
    txt(300,top+15,str(pct)+'%', 11, MUT, anchor='ra')
    txt(356,top+15,str(n), 13, col, True, anchor='ra')

# Cuadro ciego highlight
cy = CT + len(SCORES)*RH + 6
rrect(24,cy,332,32,10,'#1e2330')
txt(40,cy+16,'Cuadro ciego: ', 11, MUT, anchor='lm')
wcc = d.textlength('Cuadro ciego: ', font=font(11))/S
txt(40+wcc,cy+16,'19 colegas', 11, BLUEL, True, anchor='lm')
wcc2 = d.textlength('19 colegas', font=font(11,True))/S
txt(40+wcc+wcc2,cy+16,' tienen a Canadá en su cruce', 11, MUT, anchor='lm')

# Footer
txt(W/2,H-16,'porra-mundial-2026 · el 86% lo da por Canadá', 10, DIM, anchor='ma')

out = os.path.join(DESK, 'live_sudafrica_canada.png')
img.save(out)
print('->', out)
