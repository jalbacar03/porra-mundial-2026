"""Cards combinadas dieciseisavos HOY (29 jun): 1X2 + marcadores + quién avanza + CC. -> PNG."""
import os
from PIL import Image, ImageDraw, ImageFont

DESK = os.path.expanduser('~/Desktop/porra_tarjetas')
os.makedirs(DESK, exist_ok=True)
S = 3

def font(sz, bold=False):
    paths = (['/System/Library/Fonts/Supplemental/Arial Bold.ttf'] if bold
             else ['/System/Library/Fonts/Supplemental/Arial.ttf'])
    paths += ['/System/Library/Fonts/Helvetica.ttc']
    for p in paths:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz*S)
            except Exception: pass
    return ImageFont.load_default()

GOLD='#ffcc00'; BLUE='#2563eb'; BLUEL='#60a5fa'; GREEN='#2f9e63'; MUT='#8a8f99'; DIM='#5f636e'; WHITE='#ffffff'

CARDS = [
  {'file':'hoy_brasil_japon.png','hora':'HOY 19:00','home':'Brasil','away':'Japón','total':112,
   'x1':[('1 · BRASIL',82,'92',True),('X · EMPATE',16,'18',False),('2 · JAPÓN',2,'2',False)],
   'scores':[('2-1',43),('3-1',19),('2-0',15),('1-1',12),('3-2',7)],
   'adv':('Brasil',104,'Japón',6),'cc':('Brasil',103,'Japón',1)},
  {'file':'hoy_alemania_paraguay.png','hora':'HOY 22:30','home':'Alemania','away':'Paraguay','total':112,
   'x1':[('1 · ALEMANIA',99,'111',True),('X · EMPATE',1,'1',False),('2 · PARAGUAY',0,'0',False)],
   'scores':[('2-0',40),('3-0',30),('3-1',21),('4-1',7),('4-0',6)],
   'adv':('Alemania',111,'Paraguay',1),'cc':('Alemania',112,'Paraguay',0)},
  {'file':'hoy_paisesbajos_marruecos.png','hora':'HOY 03:00','home':'Países Bajos','away':'Marruecos','total':118,
   'x1':[('1 · P. BAJOS',32,'38',False),('X · EMPATE',53,'63',True),('2 · MARRUECOS',14,'17',False)],
   'scores':[('1-1',31),('2-2',30),('2-1',26),('1-2',12),('3-2',4)],
   'adv':('Países Bajos',72,'Marruecos',46),'cc':('Países Bajos',74,'Marruecos',33)},
]

def render(c):
    BASE=c['total']; CT=262; RH=24
    H = 522
    img = Image.new('RGB',(380*S,H*S),'#1a1d26'); d=ImageDraw.Draw(img)
    def rrect(x,y,w,h,r,fill,outline=None,ow=0):
        d.rounded_rectangle([x*S,y*S,(x+w)*S,(y+h)*S],radius=r*S,fill=fill,outline=outline,width=max(1,ow*S) if outline else 1)
    def txt(x,y,s,sz,col,bold=False,anchor='la'):
        d.text((x*S,y*S),s,font=font(sz,bold),fill=col,anchor=anchor)
    def tw(s,sz,bold=False): return d.textlength(s,font=font(sz,bold))/S

    # Header
    rrect(0,0,380,84,16,'#21242e'); d.rectangle([0,82*S,380*S,84*S],fill=BLUE)
    txt(24,20,'PORRA MUNDIAL ',18,WHITE,True); txt(24+tw('PORRA MUNDIAL ',18,True),20,"'26",18,GOLD,True)
    txt(24,48,'Dieciseisavos · cuadro real · '+str(BASE)+' porras',11,MUT)
    bw=tw(c['hora'],11,True)+26
    rrect(360-bw,18,bw,28,14,'#1f3a63'); txt(360-bw/2,32,c['hora'],11,BLUEL,True,anchor='mm')

    # Partido
    txt(24,116,c['home'],19,WHITE,True)
    wh=tw(c['home'],19,True); txt(24+wh+8,117,'vs',13,DIM); txt(24+wh+8+tw('vs',13)+8,116,c['away'],19,WHITE,True)
    txt(24,136,'Por jugarse · dieciseisavos',11,MUT)

    # 1X2
    xs=[24,138,252]
    for (label,pct,votes,lead),x in zip(c['x1'],xs):
        rrect(x,150,104,66,10,'#12233f' if lead else '#21242e',outline=(BLUE if lead else None),ow=(2 if lead else 0))
        pc=BLUEL if lead else WHITE; sub='#7e93b5' if lead else '#6f747f'
        txt(x+52,168,label,10,sub,True,anchor='mm'); txt(x+52,190,str(pct)+'%',22,pc,True,anchor='mm'); txt(x+52,208,votes+' votos',9,sub,anchor='mm')

    # Marcadores
    txt(24,246,'MARCADORES MÁS PUESTOS',11,MUT,True)
    mx=max(n for _,n in c['scores'])
    for i,(sc,n) in enumerate(c['scores']):
        top=CT+i*RH; lead=(i==0); col=BLUEL if lead else WHITE; barcol=BLUE if lead else '#2f9e63'
        txt(24,top+14,sc,13,col,True); rrect(78,top+6,176,9,4.5,'#2c303a'); rrect(78,top+6,max(3,round(n/mx*176)),9,4.5,barcol)
        txt(300,top+14,str(round(n/BASE*100,1))+'%',11,MUT,anchor='ra'); txt(356,top+14,str(n),13,col,True,anchor='ra')

    # Secciones quién avanza + CC (barras split)
    def split(y,title,hn,hv,an,av):
        txt(24,y,title,10,MUT,True)
        total=max(1,hv+av); bw=332; hwid=max(2,round(hv/total*bw)) if hv else 0
        by=y+12
        rrect(24,by,bw,16,8,GREEN)               # away (fondo verde)
        if hwid>0: rrect(24,by,hwid,16,8,BLUE)   # home (azul)
        txt(24,by+30,hn+' '+str(hv),11,BLUEL,True,anchor='lm')
        txt(356,by+30,str(av)+' '+an,11,'#7fcaa0',True,anchor='rm')

    split(394,'QUIÉN AVANZA · cuadro real (+1)', c['adv'][0],c['adv'][1],c['adv'][2],c['adv'][3])
    split(452,'EN OCTAVOS · cuadro ciego (CC)',  c['cc'][0], c['cc'][1], c['cc'][2], c['cc'][3])

    txt(190,H-12,'porra-mundial-2026 · dieciseisavos',10,DIM,anchor='ma')
    out=os.path.join(DESK,c['file']); img.save(out); print('->',out)

for c in CARDS: render(c)
