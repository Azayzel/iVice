"""Generate original SVG screen compositions illustrating the iVice mobile UI.
These are DESIGN PREVIEWS, not native-device screenshots.
"""
from pathlib import Path
from html import escape
OUT=Path(__file__).resolve().parents[1]/'docs'/'screenshots'
OUT.mkdir(parents=True,exist_ok=True)
DARK='#0B0D19'; PANEL='#17192D'; TEXT='#F5F1F8'; MUTED='#A8A4BC'; AQUA='#5CE8DE'; PINK='#FF59A8'; BORDER='#353451'

def rect(x,y,w,h,fill,r=0,stroke=None):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"'+(f' stroke="{stroke}"' if stroke else '')+'/>'
def txt(x,y,t,size=16,color=TEXT,weight=700,spacing=0):return f'<text x="{x}" y="{y}" fill="{color}" font-family="Arial, Helvetica, sans-serif" font-size="{size}" font-weight="{weight}" letter-spacing="{spacing}">{escape(t)}</text>'
def base(inner):return f'''<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844"><defs><linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#64305c"/><stop offset=".55" stop-color="#3d2850"/><stop offset="1" stop-color="#173c46"/></linearGradient></defs>{rect(0,0,390,844,DARK)}{txt(21,48,'i',29,PINK,900)}{txt(31,48,'Vice',29,TEXT,900)}{txt(93,48,'.',29,AQUA,900)}{txt(21,66,'THE LEONIDA FIELD GUIDE',9,MUTED,800,1.8)}{rect(328,23,39,39,PANEL,20,BORDER)}{txt(341,49,'◉',17,AQUA,700)}{rect(0,79,390,1,'#272840')}{inner}{rect(0,769,390,75,'#121421')}{rect(0,769,390,1,BORDER)}{txt(22,808,'⌂  HOME',11,PINK,800)}{txt(121,808,'▤  LIBRARY',11,MUTED,800)}{txt(246,808,'✓  TRACK',11,MUTED,800)}{txt(330,808,'✎',16,MUTED,800)}</svg>'''

def tile(x,y,name,sub,icon):return rect(x,y,167,111,PANEL,13,BORDER)+txt(x+14,y+35,icon,23,AQUA,800)+txt(x+14,y+65,name,13,TEXT,800)+txt(x+14,y+85,sub,10,MUTED,400)
def card(y,title,meta,sub):return rect(20,y,350,94,PANEL,13,BORDER)+rect(33,y+13,57,66,'#382943',11)+txt(47,y+53,'◇',28,PINK,700)+txt(101,y+31,title,15,TEXT,800)+txt(101,y+49,meta,9,AQUA,800,1)+txt(101,y+69,sub,11,MUTED,400)

home=rect(20,101,350,232,'url(#hero)',19)+txt(43,136,'YOUR PASS TO LEONIDA',10,AQUA,900,1.2)+txt(42,179,'PLAY SMARTER.',33,TEXT,900)+txt(42,217,'EXPLORE',33,TEXT,900)+txt(42,255,'EVERYTHING.',33,AQUA,900)+txt(42,285,'Your spoiler-aware pocket guide.',12,'#D7CEDF',400)+rect(42,299,145,22,AQUA,8)+txt(54,314,'OPEN LIBRARY →',10,DARK,900)+txt(20,366,'Quick guides',19,TEXT,900)+tile(20,385,'MAKE MONEY','Routes & rewards','$')+tile(203,385,'STORY PATH','Chapters & missables','↗')+tile(20,507,'BEST RIDES','Cars, planes & boats','⌁')+tile(203,507,'TRACK IT','Secrets & checklists','✓')+txt(20,654,'Featured field notes',18,TEXT,900)+card(672,'Quick cash: sell cars','MONEY · SOURCE-LINKED','After the Moses unlock, Chapter 2')
(OUT/'home-preview.svg').write_text(base(home))

money=txt(20,124,'THE LIBRARY.',30,TEXT,900)+txt(20,147,'Find your next move, faster.',13,MUTED,400)+rect(20,164,350,47,PANEL,12,BORDER)+txt(37,193,'⌕  Search guides and vehicles…',13,MUTED,400)+rect(20,226,69,34,AQUA,18)+txt(33,248,'Money',12,DARK,900)+rect(97,226,65,34,PANEL,18,BORDER)+txt(113,248,'Story',12,TEXT,800)+rect(170,226,78,34,PANEL,18,BORDER)+txt(182,248,'Vehicles',12,TEXT,800)+txt(20,298,'4 MONEY GUIDES · SOURCED',10,AQUA,900,1.2)+card(313,'Quick cash: sell cars','EARLY-GAME PICK','Reported route after Chapter 2')+card(419,'First-hour cash discipline','START HERE','Make the earnings you have count')+card(525,'Opportunistic robberies','RISK VS REWARD','Compare heat and your time')+card(631,'High-reward: vault robberies','LATER CHAPTERS · SPOILERS','High payouts, significant risk')
(OUT/'money-preview.svg').write_text(base(money))

guide=txt(20,113,'← BACK TO LIBRARY',11,AQUA,900)+rect(20,132,350,197,'url(#hero)',19)+txt(42,174,'$',41,AQUA,900)+txt(43,198,'MONEY / CHAPTER 2+',10,AQUA,900,1.4)+txt(43,237,'Quick cash:',28,TEXT,900)+txt(43,270,'sell stolen cars',28,TEXT,900)+txt(20,359,'★ EARLY-GAME PICK',11,'#FFC66D',900,1.1)+txt(20,392,'SOURCE-LINKED / REPORTED',11,AQUA,900)+txt(20,441,'FIELD INTEL',18,TEXT,900)+txt(20,469,'After the Moses unlock, selling eligible',13,TEXT,400)+txt(20,488,'stolen vehicles is a practical early-game',13,TEXT,400)+txt(20,507,'method. Compare payout and travel time.',13,TEXT,400)+txt(20,553,'YOUR CHECKLIST',18,TEXT,900)+txt(20,588,'□  Complete the Moses introduction',13,TEXT,500)+txt(20,622,'□  Locate an eligible vehicle',13,TEXT,500)+txt(20,656,'□  Record your real payout',13,TEXT,500)+txt(20,706,'SOURCES & ATTRIBUTION',17,TEXT,900)+txt(20,737,'↗  PowerPyx · PC Gamer · GTA Base',12,AQUA,600)
(OUT/'guide-preview.svg').write_text(base(guide))
print('Wrote',len(list(OUT.glob('*.svg'))),'design preview SVGs')
