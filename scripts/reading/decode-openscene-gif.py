"""Bounded separate OpenScene GIF decoder; never imports or changes Helix's decoder.
Production accepts one exact GIF, frame 0, time 0, loop 0. parse_gif/composite
are separately callable only for conformance tests; CLI cannot select fixtures.
"""
import sys
sys.dont_write_bytecode = True
import hashlib, io, json, os, resource, struct, ctypes
from pathlib import Path
from PIL import Image

SHA = 'd59ff50b5aa1bcbb72f5e15dd38c909d8beb2005282719a4ab4dab4dbea0bd25'
RGBA = 'd4687cf21eaad0c9883b659577c5c16ef9918143a97e40fdd9c17bb013df969c'
PNG = '1554706d8304f665ef7261af47ed84f35fdfcb6837663b0c648a652c1914c9a9'
hash_bytes = lambda b: hashlib.sha256(b).hexdigest()
def require(ok, message):
 if not ok: raise ValueError(message)

def parse_gif(data, max_pixels=518400, max_frames=80, max_cumulative_pixels=41472000):
 require(len(data) <= 21000000 and len(data) >= 14, 'GIF byte budget/header')
 require(data[:6] in (b'GIF87a', b'GIF89a'), 'GIF format')
 width,height,packed,bg,aspect=struct.unpack('<HHBBB', data[6:13]); require(0<width*height<=max_pixels,'GIF logical pixel budget')
 i=13; palette_size=3*(2**((packed&7)+1)) if packed&128 else 0;i+=palette_size
 require(i<=len(data),'truncated global palette'); frames=[]; gce=None; loop=None; extensions=[]
 def blocks(at):
  out=[]
  while True:
   require(at<len(data),'truncated subblock'); n=data[at]; at+=1
   if n==0:return at,b''.join(out)
   require(at+n<=len(data),'truncated subblock data');out.append(data[at:at+n]);at+=n
 while i<len(data):
  marker=data[i];i+=1
  if marker==59:
   require(i==len(data) and frames and gce is None,'trailing GIF bytes or incomplete frame');break
  if marker==33:
   require(i<len(data),'truncated extension');label=data[i];i+=1
   if label==249:
    require(gce is None and i+6<=len(data) and data[i]==4 and data[i+5]==0,'invalid GCE')
    flags,delay,transparent=struct.unpack('<BHB',data[i+1:i+5]);require(flags>>5==0 and ((flags>>2)&7)<=3,'unsupported disposal/reserved flag')
    gce={'disposal':(flags>>2)&7,'durationMs':delay*10,'transparent':bool(flags&1),'transparentIndex':transparent,'userInput':bool(flags&2)};i+=6
   elif label==255:
    require(i<len(data) and data[i]==11 and i+12<=len(data),'application header');app=data[i+1:i+12];i+=12;i,payload=blocks(i)
    require(app==b'NETSCAPE2.0' and payload[:1]==b'\x01' and len(payload)==3 and loop is None,'unknown application/loop')
    loop=int.from_bytes(payload[1:],'little');extensions.append({'kind':'netscape-loop','value':loop})
   elif label==254:
    i,payload=blocks(i);require(len(payload)<=4096,'comment budget');extensions.append({'kind':'comment','sha256':hash_bytes(payload)})
   else:raise ValueError('unknown GIF extension')
  elif marker==44:
   require(i+9<=len(data),'truncated local image');left,top,w,h,flags=struct.unpack('<HHHHB',data[i:i+9]);i+=9
   require(w>0 and h>0 and left+w<=width and top+h<=height and flags&24==0,'invalid image rectangle/reserved bits')
   local_palette=3*2**((flags&7)+1) if flags&128 else 0;require(i+local_palette<len(data),'truncated local palette');i+=local_palette
   lzw=data[i];i+=1;require(2<=lzw<=8,'invalid LZW code size');i,compressed=blocks(i);require(compressed,'empty GIF image')
   frame={'left':left,'top':top,'width':w,'height':h,'interlaced':bool(flags&64),'localPalette':bool(flags&128),'localPaletteBytes':local_palette,'lzwMinimumCodeSize':lzw,'compressedSha256':hash_bytes(compressed),**(gce or {'disposal':0,'durationMs':0,'transparent':False,'transparentIndex':0,'userInput':False})};gce=None;frames.append(frame)
   require(len(frames)<=max_frames and len(frames)*width*height<=max_cumulative_pixels,'GIF cumulative decode budget')
  else:raise ValueError('unknown GIF marker')
 else:raise ValueError('missing GIF trailer')
 return {'format':data[:6].decode(),'width':width,'height':height,'backgroundIndex':bg,'pixelAspectByte':aspect,'loopCount':loop,'globalPaletteBytes':palette_size,'frames':frames,'extensions':extensions}

def composite(data, frame=0):
 with Image.open(io.BytesIO(data)) as image:
  image.seek(frame);rgba=image.convert('RGBA');out=io.BytesIO();rgba.save(out,format='PNG')
  png=out.getvalue()
  with Image.open(io.BytesIO(png)) as reopened:require(reopened.convert('RGBA').tobytes()==rgba.tobytes(),'PNG roundtrip pixel mismatch')
  return rgba.tobytes(),png

def main():
 # Kernel CPU/output bounds plus parent-enforced RSS and wall-clock watchdog.
 resource.setrlimit(resource.RLIMIT_CPU,(45,45));resource.setrlimit(resource.RLIMIT_FSIZE,(21000000,21000000));Image.MAX_IMAGE_PIXELS=518400
 spec=json.load(sys.stdin);require(set(spec)=={'source','output','frameIndex','timeMs','loopIteration'},'decoder arguments')
 require((spec['frameIndex'],spec['timeMs'],spec['loopIteration'])==(0,0,0),'only declared frame/time/loop zero')
 source=Path(spec['source']);require(source.is_absolute() and source.resolve()==source and not source.is_symlink(),'unsafe source path')
 info=source.stat();require(info.st_nlink==1 and info.st_size==20040470,'GIF source size/link count')
 data=source.read_bytes();require(hash_bytes(data)==SHA,'exact original GIF fingerprint')
 metadata=parse_gif(data);require(metadata['format']=='GIF89a' and (metadata['width'],metadata['height'],len(metadata['frames']),metadata['loopCount'])==(960,540,80,0),'exact GIF metadata')
 require(all(f['durationMs']==200 and f['disposal']==1 and not f['userInput'] for f in metadata['frames']),'exact frame metadata sequence')
 rgba,png=composite(data);require(hash_bytes(rgba)==RGBA and hash_bytes(png)==PNG,'actual frame RGBA/PNG fingerprint')
 output=Path(spec['output']);require(output.is_absolute() and output.parent.resolve()==output.parent and not output.exists() and not output.is_symlink(),'unsafe/nonfresh decoded output')
 with output.open('xb') as f:f.write(png)
 # Actual loaded Python modules. Native shared objects are observed separately by the parent.
 modules=[]
 for module in list(sys.modules.values()):
  name=getattr(module,'__file__',None)
  if name and Path(name).is_file():
   p=Path(name).resolve();modules.append({'path':str(p),'sha256':hash_bytes(p.read_bytes())})
 modules=sorted({m['path']:m for m in modules}.values(),key=lambda m:m['path'])
 lib=ctypes.CDLL(None);count=lib._dyld_image_count;count.restype=ctypes.c_uint32;name=lib._dyld_get_image_name;name.argtypes=[ctypes.c_uint32];name.restype=ctypes.c_char_p
 native=sorted({name(i).decode() for i in range(count())})
 print(json.dumps({'loadedNativeImages':native,'kind':'executed-openscene-gif-frame-v1','pid':os.getpid(),'sourceSha256':SHA,'frameIndex':0,'timeMs':0,'loopIteration':0,'width':960,'height':540,'rgbaSha256':RGBA,'pngSha256':PNG,'pngBytes':len(png),'metadata':metadata,'python':{'path':str(Path(sys.executable).resolve()),'version':sys.version},'loadedModules':modules,'cpuSecondsLimit':45,'fileBytesLimit':21000000}))
if __name__=='__main__':
 try:main()
 except Exception as error:print(type(error).__name__+': '+str(error),file=sys.stderr);sys.exit(1)
