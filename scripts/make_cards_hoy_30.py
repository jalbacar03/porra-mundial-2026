"""Cards dieciseisavos HOY 30 jun: TODOS los marcadores + quién avanza + CC + decepción/revelación."""
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
GOLD='#ffcc00'; BLUE='#2563eb'; BLUEL='#60a5fa'; GREEN='#2f9e63'; GREENL='#7fcaa0'; MUT='#8a8f99'; DIM='#5f636e'; WHITE='#ffffff'; PURP='#a855f7'

CARDS = [
  {'file':'hoy30_costamarfil_noruega.png','hora':'HOY 19:00','home':'Costa de Marfil','away':'Noruega','total':118,
   'x1':[('1 · C.MARFIL',8,'10',False),('X · EMPATE',21,'25',False),('2 · NORUEGA',70,'83',True)],
   'scores':[('1-2',54),('1-1',16),('0-1',9),('1-3',8),('2-2',8),('2-1',8),('2-3',4),('0-2',4),('0-3',3),('3-2',1),('1-4',1),('0-0',1),('1-0',1)],
   'adv':('Costa de Marfil',18,'Noruega',100),'cc':('Costa de Marfil',15,'Noruega',53),
   'special':[('REVELACIÓN','Noruega 26 lo ven revelación','+3 si llega a cuartos'),('REVELACIÓN','Costa de Marfil: 3','')]},
  {'file':'hoy30_francia_suecia.png','hora':'HOY 23:00','home':'Francia','away':'Suecia','total':118,
   'x1':[('1 · FRANCIA',99,'117',True),('X · EMPATE',1,'1',False),('2 · SUECIA',0,'0',False)],
   'scores':[('3-1',42),('3-0',30),('4-1',17),('2-0',13),('4-0',4),('2-1',3),('4-2',3),('3-2',2),('1-0',2),('2-2',1),('5-1',1)],
   'adv':('Francia',118,'Suecia',0),'cc':('Francia',119,'Suecia',2),
   'special':[('DECEPCIÓN','Francia: 2 la tienen','¡+3 para ellos si cae hoy!')]},
  {'file':'hoy30_mexico_ecuador.png','hora':'HOY 03:00','home':'México','away':'Ecuador','total':118,
   'x1':[('1 · MÉXICO',35,'41',False),('X · EMPATE',36,'42',True),('2 · ECUADOR',30,'35',False)],
   'scores':[('1-1',35),('1-2',22),('2-1',19),('1-0',13),('0-1',10),('2-0',6),('0-0',4),('0-2',3),('3-1',3),('2-2',3)],
   'adv':('México',72,'Ecuador',46),'cc':('México',97,'Ecuador',60),
   'special':[('REVELACIÓN','Ecuador: 16 lo ven revelación','+3 si llega a cuartos')]},
]

def render(c):
    BASE=c['total']; CT=256; RH=21; N=len(c['scores'])
    y0 = CT + N*RH + 12
    y1 = y0 + 50; y2 = y1 + 50
    yend = y2 + len(c['special'])*20 + 6
    H = yend + 20
    img = Image.new('RGB',(380*S,H*S),'#1a1d26'); d=ImageDraw.Draw(img)
    def rr(x,y,w,h,r,fill,outline=None,ow=0): d.rounded_rectangle([x*S,y*S,(x+w)*S,(y+h)*S],radius=r*S,fill=fill,outline=outline,width=max(1,ow*S) if outline else 1)
    def tx(x,y,s,sz,col,bold=False,anchor='la'): d.text((x*S,y*S),s,font=font(sz,bold),fill=col,anchor=anchor)
    def tw(s,sz,bold=False): return d.textlength(s,font=font(sz,bold))/S
    # Header
    rr(0,0,380,84,16,'#21242e'); d.rectangle([0,82*S,380*S,84*S],fill=BLUE)
    tx(24,20,'PORRA MUNDIAL ',18,WHITE,True); tx(24+tw('PORRA MUNDIAL ',18,True),20,"'26",18,GOLD,True)
    tx(24,48,'Dieciseisavos · cuadro real · '+str(BASE)+' porras',11,MUT)
    bw=tw(c['hora'],11,True)+26; rr(360-bw,18,bw,28,14,'#1f3a63'); tx(360-bw/2,32,c['hora'],11,BLUEL,True,anchor='mm')
    # Partido
    tx(24,116,c['home'],18,WHITE,True); wh=tw(c['home'],18,True)
    tx(24+wh+7,117,'vs',13,DIM); tx(24+wh+7+tw('vs',13)+7,116,c['away'],18,WHITE,True)
    tx(24,136,'Por jugarse · dieciseisavos',11,MUT)
    # 1X2
    for (label,pct,votes,lead),x in zip(c['x1'],[24,138,252]):
        rr(x,150,104,64,10,'#12233f' if lead else '#21242e',outline=(BLUE if lead else None),ow=(2 if lead else 0))
        pc=BLUEL if lead else WHITE; sub='#7e93b5' if lead else '#6f747f'
        tx(x+52,167,label,10,sub,True,anchor='mm'); tx(x+52,188,str(pct)+'%',21,pc,True,anchor='mm'); tx(x+52,206,votes+' votos',9,sub,anchor='mm')
    # Todos los marcadores
    tx(24,236,'TODOS LOS MARCADORES ('+str(N)+')',11,MUT,True)
    mx=max(n for _,n in c['scores'])
    for i,(sc,n) in enumerate(c['scores']):
        top=CT+i*RH; lead=(i==0); col=BLUEL if lead else WHITE; barcol=BLUE if lead else '#2f9e63'
        tx(26,top+13,sc,12,col,True); rr(76,top+6,180,8,4,'#2c303a'); rr(76,top+6,max(3,round(n/mx*180)),8,4,barcol)
        tx(300,top+13,str(round(n/BASE*100,1))+'%',10,MUT,anchor='ra'); tx(356,top+13,str(n),12,col,True,anchor='ra')
    # Split bars
    def split(y,title,hn,hv,an,av,col=BLUE):
        tx(24,y,title,10,MUT,True); total=max(1,hv+av); bw=332; hwid=max(2,round(hv/total*bw)) if hv else 0; by=y+13
        rr(24,by,bw,15,7,GREEN)
        if hwid>0: rr(24,by,hwid,15,7,col)
        tx(24,by+27,hn+' '+str(hv),11,BLUEL,True,anchor='lm'); tx(356,by+27,str(av)+' '+an,11,GREENL,True,anchor='rm')
    split(y0,'QUIÉN AVANZA · cuadro real (+1)',*c['adv'])
    split(y1,'EN OCTAVOS · cuadro ciego CC (+1)',*c['cc'])
    # Especiales (decepción/revelación)
    for i,(kind,txt1,note) in enumerate(c['special']):
        yy=y2+i*20
        chipcol = '#e0533a' if kind=='DECEPCIÓN' else PURP
        chipw=tw(kind,8,True)+14
        rr(24,yy,chipw,15,7,chipcol); tx(24+chipw/2,yy+8,kind,8,WHITE,True,anchor='mm')
        tx(24+chipw+8,yy+8,txt1+('  ·  '+note if note else ''),10,MUT,anchor='lm')
    tx(190,H-12,'porra-mundial-2026 · dieciseisavos',9,DIM,anchor='ma')
    out=os.path.join(DESK,c['file']); img.save(out); print('->',out)

for c in CARDS: render(c)
