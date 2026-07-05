"""Card top 5 (fila) × 2 octavos de hoy (columna): su pronóstico. Pillow -> PNG."""
import os
from PIL import Image, ImageDraw, ImageFont
DESK = os.path.expanduser('~/Desktop/porra_tarjetas'); os.makedirs(DESK, exist_ok=True)
S = 3
def font(sz, bold=False):
    paths = (['/System/Library/Fonts/Supplemental/Arial Bold.ttf'] if bold else ['/System/Library/Fonts/Supplemental/Arial.ttf'])
    paths += ['/System/Library/Fonts/Helvetica.ttc']
    for p in paths:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz*S)
            except Exception: pass
    return ImageFont.load_default()
GOLD='#ffcc00'; SILVER='#c8ccd4'; BRONZE='#cd8246'; PRIZE='#9a8456'; BLUE='#2563eb'; BLUEL='#60a5fa'; MUT='#8a8f99'; DIM='#5f636e'; WHITE='#ffffff'

MATCHES = [('BRA – NOR','HOY 22:00'), ('MÉX – ING','LUN 02:00')]
# (pos, nombre, pts, color, [pred_p1, pred_p2])
TOP = [
  (1,'Jan Alemany',120,GOLD,['2-1','0-1']),
  (2,'Nacho de Oza',115,SILVER,['3-1','1-1']),
  (3,'Tomás Brillas',114,BRONZE,['1-1','0-1']),
  (4,'Gonzalo Gramunt',112,PRIZE,['2-1','1-2']),
  (5,'Carlos de Muller',110,PRIZE,['2-2','1-1']),
]
CX = [258, 340]  # centros de las 2 columnas de pronóstico
W=380; RH=62; H=84+44+len(TOP)*RH+26
img=Image.new('RGB',(W*S,H*S),'#1a1d26'); d=ImageDraw.Draw(img)
def rr(x,y,w,h,r,fill,outline=None,ow=0): d.rounded_rectangle([x*S,y*S,(x+w)*S,(y+h)*S],radius=r*S,fill=fill,outline=outline,width=max(1,ow*S) if outline else 1)
def tx(x,y,s,sz,col,bold=False,anchor='la'): d.text((x*S,y*S),s,font=font(sz,bold),fill=col,anchor=anchor)
def tw(s,sz,bold=False): return d.textlength(s,font=font(sz,bold))/S
# Header
rr(0,0,W,84,16,'#21242e'); d.rectangle([0,82*S,W*S,84*S],fill=BLUE)
tx(24,20,'PORRA MUNDIAL ',18,WHITE,True); tx(24+tw('PORRA MUNDIAL ',18,True),20,"'26",18,GOLD,True)
tx(24,48,'Top 5 · su pronóstico para los octavos de hoy',10.5,MUT)
tx(W-24,32,'TOP 5',13,GOLD,True,anchor='rm')
# Cabecera de columnas (partido + hora)
for (lab,hora),cx in zip(MATCHES,CX):
    tx(cx,100,lab,10,BLUEL,True,anchor='mm'); tx(cx,114,hora,8,DIM,anchor='mm')
d.line([(20*S,124*S),((W-20)*S,124*S)], fill='#2c303a', width=1*S)
# Filas
y0=132
for i,(pos,name,pts,col,preds) in enumerate(TOP):
    y=y0+i*RH
    tx(38,y+20,str(pos)+'º',17,col,True,anchor='mm')
    nm=name
    while tw(nm,14,True) > 168 and len(nm) > 4: nm=nm[:-1]
    tx(60,y+11,nm if nm==name else nm.rstrip()+'…',14,WHITE,True)
    tx(60,y+30,str(pts)+' pts',10,MUT)
    for pred,cx in zip(preds,CX):
        tx(cx,y+20,pred,17,WHITE,True,anchor='mm')
    if i<len(TOP)-1:
        d.line([(20*S,(y+RH-6)*S),((W-20)*S,(y+RH-6)*S)], fill='#23262f', width=1*S)
tx(W/2,H-13,'porra-mundial-2026 · octavos de hoy',9,DIM,anchor='ma')
out=os.path.join(DESK,'podio_octavos_05jul.png'); img.save(out); print('->',out)
