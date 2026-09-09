from pathlib import Path
from html.parser import HTMLParser
from lxml import html,etree
import json,hashlib,re,datetime,urllib.parse,posixpath,sys

sha=lambda b:hashlib.sha256(b).hexdigest(); pin=lambda p:{'path':str(p),'sha256':sha(p.read_bytes())}
class Positions(HTMLParser):
 def __init__(self,s):
  super().__init__(convert_charrefs=True);self.s=s;self.lines=[0]+[m.end() for m in re.finditer('\n',s)];self.nodes=[];self.stack=[];self.feed(s);self.close()
 def off(self):
  l,c=self.getpos();return self.lines[l-1]+c
 def handle_starttag(self,t,a):
  st=self.off();n={'tag':t,'attrs':dict(a),'start':st,'startEnd':st+len(self.get_starttag_text()),'end':None,'parent':self.stack[-1] if self.stack else None};i=len(self.nodes);self.nodes.append(n)
  if t in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:n['end']=n['startEnd']
  else:self.stack.append(i)
 def handle_startendtag(self,t,a):
  self.handle_starttag(t,a)
  if self.stack and self.nodes[self.stack[-1]]['tag']==t:self.nodes[self.stack.pop()]['end']=self.off()+len(self.get_starttag_text())
 def handle_endtag(self,t):
  for k in range(len(self.stack)-1,-1,-1):
   if self.nodes[self.stack[k]]['tag']==t:
    st=self.off();end=self.s.index('>',st)+1
    for i in self.stack[k:]:self.nodes[i]['end']=end
    del self.stack[k:];return

def norm(s):return re.sub(r'\s+',' ',s).strip()
def element(s):return html.fragment_fromstring(s,create_parent='div')
def text(s):
 r=element(s)
 for n in r.xpath('.//script|.//style|.//svg|.//button|.//comment()'):
  tail=n.tail or '';p=n.getparent();idx=p.index(n)
  if idx: p[idx-1].tail=(p[idx-1].tail or '')+tail
  else:p.text=(p.text or '')+tail
  p.remove(n)
 block={'div','article','h1','h2','h3','h4','h5','h6','p','li','ul','ol','table','tr','pre','blockquote'}
 def walk(n):
  out=n.text or ''
  for c in n:
   if not isinstance(c.tag,str):continue
   if c.tag in block or c.tag=='br':out+='\n'
   out+=walk(c)
   if c.tag in block or c.tag=='br':out+='\n'
   if c.tag in {'th','td'}:out+='\t'
   out+=c.tail or ''
  return out
 return re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+','\n\n',walk(r)).strip()+'\n'
