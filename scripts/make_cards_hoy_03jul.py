"""Cards dieciseisavos 3 jul: todos los marcadores (alineados con su barra) + quién pasa + cuadro ciego + decepción/revelación."""
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
  {'file':'hoy03_australia_egipto.png','hora':'HOY 20:00','home':'Australia','away':'Egipto','total':118,
   'x1':[('1 · AUSTRALIA',11,'13',False),('X · EMPATE',37,'44',False),('2 · EGIPTO',52,'61',True)],
   'scores':[('1-1',33),('1-2',31),('0-1',17),('0-2',11),('2-1',7),('2-2',6),('0-0',5),('1-0',4),('2-0',2),('1-3',2)],
   'adv':('Australia',28,'Egipto',90),'cc':('Australia',4,'Egipto',21),
   'special':[('REVELACIÓN','Australia: 1 la eligió como revelación','+3 si llega a cuartos')]},
  {'file':'hoy03_argentina_caboverde.png','hora':'HOY 00:00','home':'Argentina','away':'Cabo Verde','total':118,
   'x1':[('1 · ARGENTINA',98,'116',True),('X · EMPATE',2,'2',False),('2 · CABO VERDE',0,'0',False)],
   'scores':[('2-0',48),('3-0',37),('4-0',13),('3-1',6),('4-1',4),('5-0',4),('1-0',3),('1-1',1),('2-1',1),('0-0',1)],
   'adv':('Argentina',118,'Cabo Verde',0),'cc':('Argentina',113,'Cabo Verde',0),
   'special':[('DECEPCIÓN','Argentina: 21 la eligieron como decepción','+3 si cae hoy')]},
  {'file':'hoy03_colombia_ghana.png','hora':'HOY 03:30','home':'Colombia','away':'Ghana','total':118,
   'x1':[('1 · COLOMBIA',81,'96',True),('X · EMPATE',14,'17',False),('2 · GHANA',4,'5',False)],
   'scores':[('2-1',37),('2-0',34),('1-0',15),('1-1',11),('3-1',8),('2-2',4),('1-2',3),('3-0',2),('0-0',2),('1-3',1),('0-1',1)],
   'adv':('Colombia',110,'Ghana',8),'cc':('Colombia',83,'Ghana',3),
   'special':[('REVELACIÓN','Colombia: 8 la eligieron como revelación','+3 si llega a cuartos')]},
]

def render(c):
    BASE=c['total']; CT=256; RH=21; N=len(c['scores'])
    y0 = CT + N*RH + 16
    y1 = y0 + 58; y2 = y1 + 58
    yend = y2 + len(c['special'])*30 + 6
    H = yend + 20
    img = Image.new('RGB',(380*S,H*S),'#1a1d26'); d=ImageDraw.Draw(img)
    def rr(x,y,w,h,r,fill,outline=None,ow=0): d.rounded_rectangle([x*S,y*S,(x+w)*S,(y+h)*S],radius=r*S,fill=fill,outline=outline,width=max(1,ow*S) if outline else 1)
    def tx(x,y,s,sz,col,bold=False,anchor='la'): d.text((x*S,y*S),s,font=font(sz,bold),fill=col,anchor=anchor)
    def tw(s,sz,bold=False): return d.textlength(s,font=font(sz,bold))/S
    rr(0,0,380,84,16,'#21242e'); d.rectangle([0,82*S,380*S,84*S],fill=BLUE)
    tx(24,20,'PORRA MUNDIAL ',18,WHITE,True); tx(24+tw('PORRA MUNDIAL ',18,True),20,"'26",18,GOLD,True)
    tx(24,48,'Dieciseisavos · '+str(BASE)+' participantes',11,MUT)
    bw=tw(c['hora'],11,True)+26; rr(360-bw,18,bw,28,14,'#1f3a63'); tx(360-bw/2,32,c['hora'],11,BLUEL,True,anchor='mm')
    tx(24,116,c['home'],18,WHITE,True); wh=tw(c['home'],18,True)
    tx(24+wh+7,117,'vs',13,DIM); tx(24+wh+7+tw('vs',13)+7,116,c['away'],18,WHITE,True)
    tx(24,136,'Por jugarse · dieciseisavos',11,MUT)
    for (label,pct,votes,lead),x in zip(c['x1'],[24,138,252]):
        rr(x,150,104,64,10,'#12233f' if lead else '#21242e',outline=(BLUE if lead else None),ow=(2 if lead else 0))
        pc=BLUEL if lead else WHITE; sub='#7e93b5' if lead else '#6f747f'
        tx(x+52,167,label,10,sub,True,anchor='mm'); tx(x+52,188,str(pct)+'%',21,pc,True,anchor='mm'); tx(x+52,206,votes+' votos',9,sub,anchor='mm')
    tx(24,236,'TODOS LOS MARCADORES ('+str(N)+')',11,MUT,True)
    mx=max(n for _,n in c['scores'])
    for i,(sc,n) in enumerate(c['scores']):
        top=CT+i*RH; lead=(i==0); col=BLUEL if lead else WHITE; barcol=BLUE if lead else '#2f9e63'
        bar_cy=top+10  # centro vertical de la barra → todo el texto de la fila se centra aquí
        rr(76,top+6,180,8,4,'#2c303a'); rr(76,top+6,max(3,round(n/mx*180)),8,4,barcol)
        tx(26,bar_cy,sc,12,col,True,anchor='lm')
        tx(300,bar_cy,str(round(n/BASE*100,1))+'%',10,MUT,anchor='rm')
        tx(356,bar_cy,str(n),12,col,True,anchor='rm')
    def section(y,title,sub,hn,hv,an,av):
        tx(24,y,title,11,WHITE,True); tx(24,y+13,sub,8.5,DIM)
        total=max(1,hv+av); bw=332; by=y+25; hwid=round(hv/total*bw)
        rr(24,by,bw,13,6.5,GREEN)
        if hwid>4: rr(24,by,hwid,13,6.5,BLUE)
        tx(24,by+24,hn+': '+str(hv),11,BLUEL,True,anchor='lm'); tx(356,by+24,an+': '+str(av),11,GREENL,True,anchor='rm')
    section(y0,'QUIÉN PASA A OCTAVOS','Pronóstico de los participantes para este partido',c['adv'][0],c['adv'][1],c['adv'][2],c['adv'][3])
    section(y1,'SU CUADRO CIEGO','A quién pusieron en octavos antes del Mundial',c['cc'][0],c['cc'][1],c['cc'][2],c['cc'][3])
    for i,(kind,txt1,note) in enumerate(c['special']):
        yy=y2+i*30; chipcol='#e0533a' if kind=='DECEPCIÓN' else PURP
        rr(24,yy,332,26,8,'#22252f')
        chipw=tw(kind,8,True)+14; rr(34,yy+6,chipw,14,7,chipcol); tx(34+chipw/2,yy+13,kind,8,WHITE,True,anchor='mm')
        tx(34+chipw+10,yy+9,txt1,10.5,WHITE,True,anchor='lm')
        if note: tx(34+chipw+10,yy+20,note,8.5,MUT,anchor='lm')
    tx(190,H-12,'porra-mundial-2026 · dieciseisavos',9,DIM,anchor='ma')
    out=os.path.join(DESK,c['file']); img.save(out); print('->',out)

for c in CARDS: render(c)
