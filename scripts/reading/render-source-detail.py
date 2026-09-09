#!/usr/bin/env python3
"""Coordinator-only direct PDF render and unaltered crop; never accepts writer PNGs."""
import argparse,hashlib,json,math,pathlib,subprocess
from pypdf import PdfReader
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--pdf',required=True);p.add_argument('--source-sha256',required=True);p.add_argument('--pdftoppm',required=True);p.add_argument('--page',type=int,required=True);p.add_argument('--dpi',type=int,required=True);p.add_argument('--bounds',type=float,nargs=4,required=True);p.add_argument('--output-prefix',required=True);a=p.parse_args()
h=lambda path:hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
if h(a.pdf)!=a.source_sha256:raise ValueError('Source hash mismatch')
if not 180<=a.dpi<=600 or any(not math.isfinite(v)or not 0<=v<=1 for v in a.bounds)or not(a.bounds[0]<a.bounds[2]and a.bounds[1]<a.bounds[3]):raise ValueError('Invalid detail specification')
r=PdfReader(a.pdf)
if not 1<=a.page<=len(r.pages):raise ValueError('Invalid detail page')
box=r.pages[a.page-1].mediabox;pixels=math.ceil(float(box.width)*a.dpi/72)*math.ceil(float(box.height)*a.dpi/72)
if pixels>40000000:raise ValueError('Detail parent render exceeds pixel budget')
prefix=pathlib.Path(a.output_prefix)
for path in [prefix.with_suffix('.png'),pathlib.Path(str(prefix)+'-page.png')]:
 if path.exists()or path.is_symlink():raise ValueError('Refusing existing output')
subprocess.run([a.pdftoppm,'-f',str(a.page),'-l',str(a.page),'-singlefile','-r',str(a.dpi),'-png',a.pdf,str(prefix)+'-page'],check=True,timeout=50,stdout=subprocess.DEVNULL)
parent=pathlib.Path(str(prefix)+'-page.png');out=pathlib.Path(str(prefix)+'.png')
with Image.open(parent)as im:
 if im.width*im.height>40000000:raise ValueError('Actual render exceeds pixel budget')
 bounds=[round(n*[im.width,im.height][i%2])for i,n in enumerate(a.bounds)];dims=[bounds[2]-bounds[0],bounds[3]-bounds[1]]
 if min(dims)<32:raise ValueError('Source detail too small to inspect')
 im.crop(bounds).save(out);renderdims=list(im.size)
if h(a.pdf)!=a.source_sha256:raise ValueError('Source changed during render')
print(json.dumps({'sourceSha256':a.source_sha256,'page':a.page,'dpi':a.dpi,'bounds':a.bounds,'sha256':h(out),'renderSha256':h(parent),'renderDimensions':renderdims,'pixelBounds':bounds,'dimensions':dims}))
