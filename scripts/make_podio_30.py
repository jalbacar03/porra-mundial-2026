"""Card del podio (top 3) con desglose de puntos. Pillow -> PNG."""
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

# (pos, medalla, nombre, pts, RE, 1X2, CC, ESP, color)
TOP = [
  (1,'🥇','Jan Alemany',84,45,33,1,5,GOLD),
  (2,'🥈','Tomás Brillas',83,40,37,1,5,SILVER),
  (3,'🥉','Nacho de Oza',81,30,39,3,9,BRONZE),
]
W=380; RH=92; H=84+44+len(TOP)*RH+30
img=Image.new('RGB',(W*S,H*S),'#1a1d26'); d=ImageDraw.Draw(img)
def rr(x,y,w,h,r,fill,outline=None,ow=0): d.rounded_rectangle([x*S,y*S,(x+w)*S,(y+h)*S],radius=r*S,fill=fill,outline=outline,width=max(1,ow*S) if outline else 1)
def tx(x,y,s,sz,col,bold=False,anchor='la'): d.text((x*S,y*S),s,font=font(sz,bold),fill=col,anchor=anchor)
def tw(s,sz,bold=False): return d.textlength(s,font=font(sz,bold))/S
# Header
rr(0,0,W,84,16,'#21242e'); d.rectangle([0,82*S,W*S,84*S],fill=BLUE)
tx(24,20,'PORRA MUNDIAL ',18,WHITE,True); tx(24+tw('PORRA MUNDIAL ',18,True),20,"'26",18,GOLD,True)
tx(24,48,'Clasificación · top 3 · tras los dieciseisavos jugados',11,MUT)
tx(W-24,32,'PODIO',13,GOLD,True,anchor='rm')
# Filas
y0=100
for i,(pos,medal,name,pts,re,x12,cc,esp,col) in enumerate(TOP):
    y=y0+i*RH
    rr(20,y,W-40,RH-12,14,'#22252f',outline=col,ow=2 if pos==1 else 0)
    tx(46,y+(RH-12)/2,str(pos)+'º',20,col,True,anchor='mm')
    tx(80,y+22,name,18,WHITE,True)
    tx(80,y+48,'RE '+str(re)+'  ·  1X2 '+str(x12)+'  ·  CC '+str(cc)+'  ·  ESP '+str(esp),11,MUT)
    tx(W-40,y+24,str(pts),30,col,True,anchor='rm')
    tx(W-40,y+52,'puntos',10,MUT,anchor='rm')
tx(W/2,H-14,'porra-mundial-2026 · RE+1X2+CC+ESP = puntos',9.5,DIM,anchor='ma')
out=os.path.join(DESK,'podio_30jun.png'); img.save(out); print('->',out)
