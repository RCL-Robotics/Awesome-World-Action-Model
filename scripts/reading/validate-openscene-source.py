"""Exact original-source inventory validator. No scientific approval or renderer proof."""
from pathlib import Path
from html.parser import HTMLParser
import json, hashlib, importlib.util, re, sys, stat, ctypes, os
sys.dont_write_bytecode=True
from lxml import html
from PIL import Image
D=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
COMMIT='72860746787a67946bef07aa1f78bbbc6b20e445'
PAPER='ref-236eff7a0d0d26ae758e'
EXPECTED_SOURCES={
 'readme':('f96cfc3b2cdd5954b70708088c4108a07555047bce325a4c02cf0d63af2beb55','429f850121874bb296a629919f0934b9d32f15fba85c6912aae27a5ff78e0ec9'),
 'dataset_stats':('ebbef65bb34aa5f8c6ed78ba21d98b02da26890a9799ca86eca047df1bca3e6b','7c4f5cc89f37a33d7a6c2a713379276ea3708c444d5c4a2cb01757937a4a950b'),
 'challenge_2024':('0d8556daa9714d258b97768b5abfd157fabf7945ffa69c7b0728f5027fe66ee8','104786d8b58ea46e605d419b267196fd1aefd2b6a13c6bc6ed8b82a183c0e12d'),
 'getting_started':('aa63fb18179a6405ccccc504d416f738b6cc2365c01f849f82a448f2761f9325','2cc6f4ae1b843e8c23da0c44c8808e9d97f48b44c028ea5aa8bbe869f8ea289c')}
EXPECTED_IDS=['support-readme-identity','support-readme-description','support-stats-gif','support-stats-benchmark','support-stats-facts','support-stats-schema','support-driving-protocol','support-worldmodel-protocol','support-version-splits','support-storage-reuse','support-private-test','support-reproduction','figure-readme-history','figure-stats-benchmark','figure-stats-facts','figure-occupancy-frame0']
class Rejected(ValueError):pass
def need(ok,message):
 if not ok:raise Rejected(message)
def checked(root,p):
 name=p['path']; rel=Path(name)
 need(not rel.is_absolute() and name and '..' not in rel.parts and '\\' not in name,'unsafe packaged path')
 target=root
 for part in rel.parts:
  target=target/part; need(not target.is_symlink(),'symlink source path')
 info=target.stat();need(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and info.st_size<=21000000,'unbounded/nonregular/hardlinked source')
 data=target.read_bytes();need(sha(data)==p['sha256'],'file hash mismatch: '+name)
 if 'bytes' in p:need(len(data)==p['bytes'],'file length mismatch')
 return data
class Balanced(HTMLParser):
 def __init__(self,s):self.stack=[];super().__init__(convert_charrefs=False);self.feed(s);self.close();need(not self.stack,'unclosed source fragment')
 def handle_starttag(self,t,a):
  if t not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(t)
 def handle_startendtag(self,t,a):pass
 def handle_endtag(self,t):need(bool(self.stack) and self.stack[-1]==t,'unbalanced original fragment: '+t);self.stack.pop()
def identity_projection(x):
 if isinstance(x,dict):return {k:identity_projection(v) for k,v in x.items() if k!='path'}
 if isinstance(x,list):return [identity_projection(v) for v in x]
 return x
def load_parser():
 s=importlib.util.spec_from_file_location('source_parser',D/'openscene-source-parser.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
P=load_parser()
def validate_capture(root,c,documents):
 doc=documents[c['documentId']];raw=checked(root,doc['html']).decode();joined='';previous=-1
 for p in c['parts']:
  start,end=p['startCharacter'],p['endCharacter'];need(p['rangeUnit']=='unicode-codepoints','wrong range unit');need(isinstance(start,int) and isinstance(end,int) and doc['article']['startCharacter']<=start<end<=doc['article']['endCharacter'],'source range escapes unique article');need(start>=previous,'reordered or overlapping capture parts');previous=end
  frag=checked(root,p).decode();need(raw[start:end]==frag,'fragment differs from exact native HTML slice');Balanced(frag);joined+=frag
 need(checked(root,c['completeVisibleText']).decode()==P.text(joined),'visible text changed or incomplete')
 r=html.fragment_fromstring(joined,create_parent='div')
 need(not r.xpath('.//script|.//iframe|.//object|.//embed|.//style|.//link|.//video|.//audio|.//canvas'),'active/unknown source element')
 need(not any(k.lower().startswith('on') or (k=='style' and any(s in v.lower() for s in ['url(','expression(','@import'])) for n in r.iter() if isinstance(n.tag,str) for k,v in n.attrib.items()),'active attribute')
 imgs=r.xpath('.//img');need(len(imgs)==c['nativeImageCount'],'image inventory changed')
 if 'derivation'in c:
  d=c['derivation'];need(len(imgs)==1 and d['frameIndex']==0 and d['timeMs']==0 and d['loopIteration']==0,'wrong frame/time contract')
  need((d['wrapperWidth'],d['wrapperHeight'],d['logicalWidth'],d['logicalHeight'])==(960,540,960,540),'native GIF dimensions changed')
  node=raw[d['sourceNodeStart']:d['sourceNodeEnd']];need(sha(node.encode())==d['sourceNodeSha256'],'source image node mismatch');need(dict(imgs[0].attrib)==d['originalAttributes'],'original image attributes changed');need(imgs[0].get('width')=='996px' and d['sourceHtmlWidth']=='996px','original authored width lost')
 else:need(not imgs,'unacquired image in source capture')
 tables=[{'rowsIncludingHeader':len(t.xpath('.//tr')),'cells':len(t.xpath('.//th|.//td')),'allCellText':[P.norm(c.text_content()) for c in t.xpath('.//th|.//td')]} for t in r.xpath('.//table')]
 need(tables==c['originalTableInventory'],'table inventory or cells changed')
 codes=[{'textSha256':sha(n.text_content().encode()),'characters':len(n.text_content())} for n in r.xpath('.//pre')];need(codes==c['completeCodeBlocks'],'code block dropped/changed')
 need(c['role'] in ['supporting-section','original-figure'],'wrong image role')
 expected='supporting-html-section' if c['role']=='supporting-section' else ('selected-html-gif-derived-still' if 'derivation'in c else 'selected-original-html-table');need(c['reviewRole']==expected,'review role mismatch')
 expected_url=doc['canonicalUrl']+('#'+c['anchors'][0] if c['anchors'] else '');need(c['canonicalUrl']==doc['canonicalUrl'] and c['sourceLocatorUrl']==expected_url,'locator mismatch')
 for a in c['anchors']:need(a!='user-content-top' and len(r.xpath('.//*[@id=$id]',id=a))==1,'ambiguous or absent anchor')
 return joined

def validate(root=D,descriptor=None,decode=False):
 d=descriptor or json.loads((root/'descriptor.json').read_text());need(d['paperId']==PAPER and d['commit']==COMMIT,'wrong identity/commit');need(d['kind']=='openscene-executable-input-descriptor-candidate' and d['profile']=='openscene-7286074-resource-v2' and d['descriptorRevision']==2,'unknown profile');need(d['consumerImplemented'] is False and d['publicationApproval'] is False and d['acceptanceProof'] is None and d['realReviewerInvocations']==0,'candidate is not approval')
 need([x['documentId'] for x in d['documents']]==list(EXPECTED_SOURCES),'exact four-document inventory required')
 bundle=json.loads(checked(root,d['sourceBundle']));need(bundle['profile']==d['profile'] and bundle['policy']==d['policy'],'source profile/policy drift');need(sha(json.dumps(identity_projection(bundle),sort_keys=True,ensure_ascii=False,separators=(',',':')).encode())==d['sourceBundleCanonicalSha256'],'source bundle canonical hash mismatch');need(bundle['documents']==d['documents'] and bundle['asset']==d['asset'],'descriptor source identity drift')
 docs={x['documentId']:x for x in d['documents']};bytecounts={'html':0,'text':0}
 for key,doc in docs.items():
  need(doc['sourceKind']=='html' and doc['commit']==COMMIT,'source-kind/commit mismatch');raw=checked(root,doc['html']).decode();tx=checked(root,doc['text']).decode();need((sha(raw.encode()),sha(tx.encode()))==EXPECTED_SOURCES[key],'unapproved source identity')
  ps=P.Positions(raw);articles=[n for n in ps.nodes if n['tag']=='article'];need(len(articles)==1,'unique actual article required');ar=articles[0];need((ar['start'],ar['end'])==(doc['article']['startCharacter'],doc['article']['endCharacter']),'article scope mismatch');need(sha(raw[ar['start']:ar['end']].encode())==doc['article']['sha256'],'article hash mismatch')
  prev=0;unique=0
  for scope in doc['textScope']:need(scope['startCharacter']==prev and prev<scope['endCharacter']<=len(tx),'full source text scope gap/overlap');prev=scope['endCharacter'];unique+=scope['role']=='unique-article'
  need(prev==len(tx) and unique==1,'complete text/unique scope required')
  md=checked(root,doc['rawMarkdown']);blob=hashlib.sha1(b'blob '+str(len(md)).encode()+b'\0'+md).hexdigest();tree=json.loads((root/'inputs/official-tree.json').read_text());need(blob==doc['rawMarkdown']['gitBlobSha1']==next(x['sha'] for x in tree['tree'] if x['path']==doc['repositoryPath']),'Git blob mismatch')
  if key!='readme':
   need(doc['canonicalUrl']==f'https://github.com/OpenDriveLab/OpenScene/blob/{COMMIT}/docs/{key}.md','not same-commit official URL')
   h=json.loads(checked(root,doc['http']));need(h['httpStatus']==200 and h['requestedUrl']==h['finalUrl']==doc['canonicalUrl'] and h['bodySha256']==doc['html']['sha256'],'HTTP source pin mismatch')
   checked(root,doc['acquisitionComparison']);checked(root,doc['priorScope']);m=json.loads(checked(root,doc['originalAcquisitionManifest']));need(m['documentId']==doc['upstreamDocumentId'] and m['paperId']==PAPER and m['sourceKind']=='html','acquired document identity mismatch');need(P.text(raw[ar['start']:ar['end']])==tx,'supplement complete source text differs')
  bytecounts['html']+=doc['html']['bytes'];bytecounts['text']+=doc['text']['bytes']
 need([x['imageId'] for x in d['captures']]==EXPECTED_IDS,'exact 12+4 inventory required')
 bound=bundle['captureSourceInventory'];need(bound==[{k:c[k] for k in ['imageId','role','reviewRole','documentId','parts','completeVisibleText','sourceLocatorUrl']} for c in d['captures']],'capture source inventory drift')
 source_parts=[validate_capture(root,c,docs) for c in d['captures']]
 b=d['budget'];need(b['exactSupportingCaptures']==12 and b['supportingCaptureLimit']==16 and b['exactSelectedFigures']==4 and b['exactReviewImageCount']==16,'count limits changed');need(bytecounts['html']<=b['sourceHtmlTotalMaxBytes'] and bytecounts['text']<=b['sourceTextTotalMaxBytes'],'full source exceeds budget')
 need(sum(len(c['completeCodeBlocks']) for c in d['captures'][:12])==5,'all five source code blocks must be covered')
 for id,count in [('figure-readme-history',(9,45)),('figure-stats-benchmark',(8,56)),('figure-stats-facts',(8,16))]:
  inv=next(c['originalTableInventory'] for c in d['captures'] if c['imageId']==id);need(len(inv)==1 and (inv[0]['rowsIncludingHeader'],inv[0]['cells'])==count,'selected table must be complete')
 mapping=json.loads(checked(root,d['chapterMap']));chapters=mapping['chapters'];need(len(chapters)==30 and len({(c['documentId'],c['chapterId']) for c in chapters})==30,'exact chapter map required');need(all(i in EXPECTED_IDS[:12] for c in chapters for i in c['supportingCaptureIds']),'unknown supporting map ID')
 g=checked(root,d['asset']['source']);need(len(g)==20040470 and sha(g)=='d59ff50b5aa1bcbb72f5e15dd38c909d8beb2005282719a4ab4dab4dbea0bd25','original GIF changed');need(len(g)<=b['singleOriginalGifMaxBytes'],'GIF budget');need(hashlib.sha1(b'blob '+str(len(g)).encode()+b'\0'+g).hexdigest()==d['asset']['gitBlobSha1'],'GIF blob mismatch')
 # F1: both consumer captures must carry the complete same canonical derivation.
 derived=[c for c in d['captures'] if 'derivation' in c]
 need([c['imageId'] for c in derived]==['support-stats-gif','figure-occupancy-frame0'],'exact derived capture inventory')
 for c in derived:
  need(c['documentId']==d['asset']['sourceParentDocument'],'derived source document mismatch')
  need(c['derivation']==d['asset']['derivation'],'per-capture/global full derivation mismatch')
  checked(root,c['derivation']['framePng'])
 png=checked(root,d['asset']['derivation']['framePng']);need(sha(png)=='1554706d8304f665ef7261af47ed84f35fdfcb6837663b0c648a652c1914c9a9','expected GIF frame PNG mismatch')
 if decode:
  with Image.open(root/d['asset']['source']['path']) as im:
   need(im.format=='GIF' and im.size==(960,540) and im.n_frames==80,'GIF dimensions/count');im.seek(0);rgba=im.convert('RGBA').tobytes();need(sha(rgba)==d['asset']['derivation']['rgbaSha256'],'GIF composited frame mismatch')
  with Image.open(root/d['asset']['derivation']['framePng']['path']) as im:need(im.convert('RGBA').tobytes()==rgba,'PNG does not reproduce decoded original frame')
 for f in d['fonts']['webfonts']:checked(root,f)
 ef=d['fonts']['systemEmojiFont'];ep=Path(ef['path']);need(ep.is_file() and not ep.is_symlink() and sha(ep.read_bytes())==ef['sha256'] and ep.stat().st_size<=b['specificSystemEmojiFontMaxBytes'],'system emoji dependency mismatch')
 cf=d['fonts']['systemCjkFont'];cp=Path(cf['path']);need(cp.is_file() and not cp.is_symlink() and sha(cp.read_bytes())==cf['sha256'] and cp.stat().st_size<=b['specificSystemCjkFontMaxBytes'],'system CJK dependency mismatch')
 return {'kind':'openscene-original-source-validation-v1','pass':True,'documents':4,'supplementChapters':30,'supportingCaptures':12,'selectedFigures':4,'images':16,'sourceBytes':bytecounts,'codeBlocks':5,'allSourceInputsRetained':True,'gifFrame0Decoded':decode,'productionAcceptance':False,'realReviewerInvocations':0,'runtimeProofCreated':False}

if __name__=='__main__':
 try:
  spec=json.load(sys.stdin);root=Path(spec['root']).resolve(strict=True)
  descriptor_bytes=checked(root,{'path':'descriptor.json','sha256':'f4858135945364329e9ba1e68d827b208e67dd90f68771827e70a23a73c2178a'})
  result=validate(root,json.loads(descriptor_bytes),False)
  modules={}
  for module in list(sys.modules.values()):
   name=getattr(module,'__file__',None)
   if name and Path(name).is_file():
    path=Path(name).resolve();modules[str(path)]={'path':str(path),'sha256':sha(path.read_bytes())}
  lib=ctypes.CDLL(None);count=lib._dyld_image_count;count.restype=ctypes.c_uint32;name=lib._dyld_get_image_name;name.argtypes=[ctypes.c_uint32];name.restype=ctypes.c_char_p
  result['loadedModules']=sorted(modules.values(),key=lambda p:p['path']);result['loadedNativeImages']=sorted({name(i).decode() for i in range(count())});result['pid']=os.getpid()
  print(json.dumps(result))
 except Exception as error:print(type(error).__name__+': '+str(error),file=sys.stderr);sys.exit(1)
