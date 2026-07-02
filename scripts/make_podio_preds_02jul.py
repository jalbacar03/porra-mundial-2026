"""Card del podio (top 3) con sus pronósticos para los partidos de hoy. Pillow -> PNG."""
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
GOLD='#ffcc00'; SILVER='#c8ccd4'; BRONZE='#cd8246'; BLUE='#2563eb'; BLUEL='#60a5fa'; MUT='#8a8f99'; DIM='#5f636e'; WHITE='#ffffff'

MATCHES = [('ESP-AUT','21:00'),('POR-CRO','03:00'),('SUI-ARG','05:00')]
# (pos, nombre, pts, color, [pred1, pred2, pred3])
TOP = [
  (1,'Jan Alemany',101,GOLD,['3-1','2-1','1-0']),
  (2,'Javi Albácar',96,SILVER,['2-1','1-0','3-0']),
  (3,'Nacho de Oza',96,BRONZE,['2-0','2-0','1-0']),
]
CX = [205, 278, 350]  # centros de las 3 columnas de pronóstico
W=380; RH=70; H=84+42+len(TOP)*RH+26
img=Image.new('RGB',(W*S,H*S),'#1a1d26'); d=ImageDraw.Draw(img)
def rr(x,y,w,h,r,fill,outline=None,ow=0): d.rounded_rectangle([x*S,y*S,(x+w)*S,(y+h)*S],radius=r*S,fill=fill,outline=outline,width=max(1,ow*S) if outline else 1)
def tx(x,y,s,sz,col,bold=False,anchor='la'): d.text((x*S,y*S),s,font=font(sz,bold),fill=col,anchor=anchor)
def tw(s,sz,bold=False): return d.textlength(s,font=font(sz,bold))/S
# Header
rr(0,0,W,84,16,'#21242e'); d.rectangle([0,82*S,W*S,84*S],fill=BLUE)
tx(24,20,'PORRA MUNDIAL ',18,WHITE,True); tx(24+tw('PORRA MUNDIAL ',18,True),20,"'26",18,GOLD,True)
tx(24,48,'Top 3 · sus pronósticos para hoy',11,MUT)
tx(W-24,32,'PODIO',13,GOLD,True,anchor='rm')
# Cabecera de columnas (partido + hora)
for (lab,hora),cx in zip(MATCHES,CX):
    tx(cx,100,lab,9.5,BLUEL,True,anchor='mm'); tx(cx,113,hora,8,DIM,anchor='mm')
d.line([(20*S,122*S),((W-20)*S,122*S)], fill='#2c303a', width=1*S)
# Filas
y0=128
for i,(pos,name,pts,col,preds) in enumerate(TOP):
    y=y0+i*RH
    tx(40,y+22,str(pos)+'º',18,col,True,anchor='mm')
    tx(62,y+12,name,15,WHITE,True)
    tx(62,y+33,str(pts)+' pts',10,MUT)
    for pred,cx in zip(preds,CX):
        tx(cx,y+22,pred,17,WHITE,True,anchor='mm')
    if i<len(TOP)-1:
        d.line([(20*S,(y+RH-8)*S),((W-20)*S,(y+RH-8)*S)], fill='#23262f', width=1*S)
tx(W/2,H-13,'porra-mundial-2026 · dieciseisavos de hoy',9,DIM,anchor='ma')
out=os.path.join(DESK,'podio_preds_02jul.png'); img.save(out); print('->',out)
