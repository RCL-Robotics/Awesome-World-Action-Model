// Exact four-document OpenScene profile. Neither source logs nor this descriptor are scientific approval.
import {readFile,writeFile,mkdir,copyFile,lstat,realpath,readdir} from 'node:fs/promises';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {randomUUID} from 'node:crypto';
import {runtimeFileInventory} from './html-original-media.mjs';
import {hash,hashFile,requireValue as need,runBounded,verifyRuntimePins} from './openscene-process.mjs';
export const openScenePolicyVersion='wam-openscene-original-html-gif-evidence-v1';
export const openSceneProfile='openscene-7286074-resource-v2';
export const openScenePaperId='ref-236eff7a0d0d26ae758e';
export const approvedRecipeSha256='f4858135945364329e9ba1e68d827b208e67dd90f68771827e70a23a73c2178a';
export const openSceneCodeSha256=hash(await readFile(new URL(import.meta.url)));
export const trustedOpenScenePython={"decoder":"8558cf7b9ece17be4aadaae8294128f702baf90210a191027e0da4a1a2fe33c8","validator":"ced538e6267a8a9262b1b86b547be79cbb2d8b82ea2ac80ae6ce3bd1eb8a7755","parser":"0988802d20a299be2c22b91313da816652d13ed4d69a67e6e8af2cac74fc8cf1"};
export const openSceneProcessCodeSha256=hash(await readFile(new URL('./openscene-process.mjs',import.meta.url)));
export const openSceneIds=['support-readme-identity','support-readme-description','support-stats-gif','support-stats-benchmark','support-stats-facts','support-stats-schema','support-driving-protocol','support-worldmodel-protocol','support-version-splits','support-storage-reuse','support-private-test','support-reproduction','figure-readme-history','figure-stats-benchmark','figure-stats-facts','figure-occupancy-frame0'];
const same=(a,b,message)=>need(isDeepStrictEqual(a,b),message);
export async function nativeFile(root,name,max=21_000_000){
 need(typeof name==='string'&&name&&!isAbsolute(name)&&!name.split(/[\\/]/).includes('..')&&!name.includes('\\'),'unsafe original path');const base=resolve(root);need(await realpath(base)===base&&!((await lstat(base)).isSymbolicLink()),'unsafe original root');let file=base;
 for(const p of name.split('/')){file=join(file,p);need(!(await lstat(file)).isSymbolicLink(),'original symlink');}
 const stat=await lstat(file);need(stat.isFile()&&stat.nlink===1&&stat.size<=max&&await realpath(file)===file,'unbounded/nonregular/hardlinked original');return file;
}
export async function nativeBytes(root,pin,max){need(pin&&/^[a-f0-9]{64}$/.test(pin.sha256),'missing original pin');const bytes=await readFile(await nativeFile(root,pin.path,max));need(hash(bytes)===pin.sha256&&(!('bytes'in pin)||bytes.length===pin.bytes),'original fingerprint changed: '+pin.path);return bytes;}
export function recipeFilePins(recipe){
 const pins=new Map();function walk(x){if(!x||typeof x!=='object')return;if(typeof x.path==='string'&&x.sha256&&!isAbsolute(x.path)){const old=pins.get(x.path);need(!old||old.sha256===x.sha256,'conflicting original file pin');pins.set(x.path,{path:x.path,sha256:x.sha256,...(x.bytes===undefined?{}:{bytes:x.bytes})});}for(const v of Object.values(x))walk(v);}walk(recipe);return [...pins.values()].sort((a,b)=>a.path.localeCompare(b.path));
}
export function assertDerivationBinding(recipe,decoded){
 const asset=recipe.asset,d=asset.derivation;const captures=recipe.captures.filter(c=>c.derivation);
 same(captures.map(c=>c.imageId),['support-stats-gif','figure-occupancy-frame0'],'exact derived capture inventory');
 for(const c of captures){same(c.derivation,d,'F1 per-capture/global complete derivation mismatch');need(c.documentId===asset.sourceParentDocument&&c.derivation.assetId===asset.assetId&&c.derivation.sourceNodeSha256===asset.sourceNodeSha256,'F1 canonical asset/source node mismatch');}
 same([d.frameIndex,d.timeMs,d.loopIteration,d.logicalWidth,d.logicalHeight,d.wrapperWidth,d.wrapperHeight,d.sourceHtmlWidth],[0,0,0,960,540,960,540,'996px'],'F1 frame/time/native-size contract');
 if(decoded){same([decoded.sourceSha256,decoded.frameIndex,decoded.timeMs,decoded.loopIteration,decoded.width,decoded.height,decoded.rgbaSha256,decoded.pngSha256,decoded.pngBytes],[asset.source.sha256,d.frameIndex,d.timeMs,d.loopIteration,d.logicalWidth,d.logicalHeight,d.rgbaSha256,d.framePng.sha256,d.framePng.bytes],'F1 actual fresh decoded frame differs');}
 return {sourceDocumentId:asset.sourceParentDocument,sourceSha256:asset.source.sha256,assetId:asset.assetId,sourceNodeSha256:asset.sourceNodeSha256,derivation:d,captures:captures.map(c=>({imageId:c.imageId,documentId:c.documentId,derivation:c.derivation}))};
}
export function publicSourceUrl(recipe,url){
 const allowed=recipe.documents.map(d=>d.canonicalUrl).concat(recipe.asset.canonicalUrl);
 need(typeof url==='string'&&!/[\s]/.test(url),'invalid public source URL');const parsed=new URL(url);need(!parsed.search&&!parsed.username&&!parsed.password,'private/query URL export');const base=url.split('#')[0];need(allowed.includes(base),'unapproved public source locator');
 if(parsed.hash)need(recipe.captures.some(c=>c.canonicalUrl===base&&c.anchors.includes(decodeURIComponent(parsed.hash.slice(1)))),'unapproved original source anchor');return url;
}
export function openSceneRole(image){return image.kind==='source-html-section'?'supporting-html-section':image.description?.htmlSource?.kind==='html-gif-derived-still'?'selected-html-gif-derived-still':'selected-original-html-table';}
export function openScenePolicy(pdf){return {...pdf,version:openScenePolicyVersion,supportingHtmlSections:'Verify all four exact original documents and every claim-bearing section. A source range is not a PDF page; readable used evidence is mandatory.',originalHtmlTables:'Keep every original table cell, unit, legend and relevant footnote. Wrapper typography/reflow is disclosed.',originalGifStill:'One exact composited frame 0 at 0 ms of loop 0, native 960x540. Authored img width996px is not reproduced. No full animation or absent class/GT/flow legend is inferred.'};}
export function openSceneDisclosure(f,d){return d.wrapperDisclosure+(f.derivation?' '+d.native.gifDisclosure:'');}
export function openSceneLocator(f,descriptorHash,d,rendererCodeSha256){
 return {kind:f.derivation?'html-gif-derived-still':f.role==='supporting-section'?'html-original':'html-original-table',profile:openSceneProfile,policyVersion:openScenePolicyVersion,fragmentId:f.id,anchor:f.anchor,documentId:f.documentId,sourceId:f.sourceId,sourceSha256:f.sourceSha256,sourceBundleSha256:d.native.sourceBundleSha256,recipeSha256:approvedRecipeSha256,parts:f.parts.map(({startCharacter,endCharacter,sha256})=>({startCharacter,endCharacter,sha256})),descriptorSha256:descriptorHash,wrapperSha256:d.wrapper.sha256,rendererSha256:d.runtime.chromeSha256,rendererCodeSha256,openSceneCodeSha256,processCodeSha256:openSceneProcessCodeSha256,...(f.derivation?{originalAssetUrl:d.native.assetUrl,assetSha256:d.native.assetSha256,frameIndex:0,timeMs:0,loopIteration:0,rgbaSha256:f.derivation.rgbaSha256,framePngSha256:f.derivation.framePng.sha256,nativeWidth:960,nativeHeight:540,authoredHtmlWidth:'996px',derivationSha256:hash(JSON.stringify(f.derivation))}:{})};
}
export async function loadOpenSceneEvidence(root,config,rendererCodeSha256){
 need(config.manifest.kind==='html'&&config.manifest.paperId===openScenePaperId,'native source kind/identity');const bytes=await nativeBytes(root,config.htmlVisuals,5_000_000),d=JSON.parse(bytes);
 need(d.schemaVersion===1&&d.policyVersion===openScenePolicyVersion&&d.paperId===openScenePaperId&&d.sourceSha256===config.manifest.sha256&&d.textSha256===config.manifest.textSha256&&d.canonicalUrl===config.manifest.canonicalUrl,'native descriptor identity');
 need(d.native?.recipe?.sha256===approvedRecipeSha256&&d.native.profile===openSceneProfile,'unknown native profile/recipe');
 need(d.native.codeSha256===openSceneCodeSha256&&d.native.processCodeSha256===openSceneProcessCodeSha256,'native trusted code changed');
 const recipeBytes=await nativeBytes(root,d.native.recipe,100000),recipe=JSON.parse(recipeBytes),recipeRoot=dirname(await nativeFile(root,d.native.recipe.path));
 same(recipe.captures.map(c=>c.imageId),openSceneIds,'required12+4 recipe inventory');same(d.native.sourceBundleSha256,recipe.sourceBundleCanonicalSha256,'native source bundle');
 same(d.native.assetSha256,recipe.asset.source.sha256,'native asset identity');same(d.native.assetUrl,recipe.asset.canonicalUrl,'native asset URL');
 const pins=recipeFilePins(recipe);same(d.native.recipeFiles,pins,'complete recipe input inventory');for(const pin of pins)await nativeBytes(recipeRoot,pin);
 const tree=await nativeBytes(recipeRoot,d.native.officialTree);need(d.native.officialTree.path==='inputs/official-tree.json','official tree location');
 assertDerivationBinding(recipe);await nativeBytes(recipeRoot,recipe.asset.derivation.framePng);
 await nativeBytes(root,{path:config.sourceFile,sha256:d.sourceSha256},2_000_000);await nativeBytes(root,{path:'source.txt',sha256:d.textSha256},30000);
 const primary=recipe.documents[0];same([primary.html.sha256,primary.text.sha256,primary.canonicalUrl],[d.sourceSha256,d.textSha256,d.canonicalUrl],'original primary/source snapshot');
 need(d.identitySectionId==='support-readme-identity','identity section');same(d.requiredSupportingSections,openSceneIds.slice(0,12),'required supporting context');same(d.selectedFigureIds,openSceneIds.slice(12),'four useful original figures');
 const css=(await nativeBytes(root,d.wrapper,100000)).toString();need(d.wrapperProfile==='openscene-native-layout-v1'&&css===openSceneCss(d.dependencies)&&typeof d.wrapperDisclosure==='string'&&d.wrapperDisclosure.length>100,'unapproved native wrapper');
 const dependencies=new Map();same(d.dependencies.map(x=>[x.url,x.sha256]),recipe.fonts.webfonts.map((x,i)=>['https://openscene-wrapper.invalid/font/'+i,x.sha256]),'native font inventory');for(const dep of d.dependencies)dependencies.set(dep.url,{...dep,bytes:await nativeBytes(root,dep,2_000_000)});
 const fragments=new Map(),sources=[];
 for(const doc of recipe.documents){const txt=(await nativeBytes(recipeRoot,doc.text)).toString(),manifest=doc.documentId==='readme'?config.manifest:JSON.parse(await nativeBytes(recipeRoot,doc.originalAcquisitionManifest));
  const source=doc.documentId==='readme'?{id:'primary',url:doc.canonicalUrl,title:config.manifest.observedTitle,kind:'html',sha256:doc.html.sha256,wordCount:config.manifest.wordCount,accessedAt:config.manifest.accessedAt}:{id:doc.upstreamDocumentId,url:doc.canonicalUrl,title:manifest.title,kind:'html',sha256:doc.html.sha256,wordCount:manifest.completeText.words,accessedAt:manifest.accessedAt};
  sources.push({...source,documentId:doc.documentId,textSha256:doc.text.sha256,text:txt});
 }
 same(d.native.publicSources,sources.map(({documentId,textSha256,text,...s})=>s),'exact four-source report manifests');
 for(const c of recipe.captures){const doc=recipe.documents.find(x=>x.documentId===c.documentId);const markup=(await Promise.all(c.parts.map(p=>nativeBytes(recipeRoot,p)))).map(b=>b.toString()).join('\n');const visible=(await nativeBytes(recipeRoot,c.completeVisibleText)).toString();
  publicSourceUrl(recipe,c.sourceLocatorUrl);fragments.set(c.imageId,{...c,id:c.imageId,sourceId:doc.upstreamDocumentId,sourceSha256:doc.html.sha256,anchor:c.anchors[0]??null,sourceLabel:d.native.sourceLabels[c.imageId],visibleTextSha256:hash(visible.replace(/\s+/g,' ').trim()),requiredText:[visible],markup,completeVisibleTextValue:visible});
 }
 need(Object.keys(d.native.sourceLabels).length===16&&[...fragments.values()].every(f=>typeof f.sourceLabel==='string'&&f.sourceLabel.length>8),'exact native source labels');
 same(Object.keys(d.native.tools).sort(),Object.keys(trustedOpenScenePython).sort(),'trusted tool inventory');for(const [key,p] of Object.entries(d.native.tools)){need(p.sha256===trustedOpenScenePython[key],'unapproved source/decoder executable');await nativeBytes(root,p,100000);}
 need(d.native.renderCodeSha256===hash(await readFile(new URL('./openscene-render.mjs',import.meta.url))),'unapproved renderer executable');
 await verifyRuntimePins(d.runtime.filePins);const runtimePins=new Map(d.runtime.filePins.map(p=>[p.path,p.sha256]));
 for(const path of [d.runtime.nodePath,d.runtime.pythonPath,d.runtime.chromePath,d.runtime.playwrightPath,'/bin/ps','/usr/bin/vmmap'])need(runtimePins.has(path),'missing mandatory executable/runtime pin');
 need(runtimePins.get(d.runtime.chromePath)===d.runtime.chromeSha256&&runtimePins.get(d.runtime.playwrightPath)===d.runtime.playwrightEntrySha256,'runtime point/closure fingerprint mismatch');
 for(const pin of await runtimeFileInventory(d.runtime.playwrightPath))need(runtimePins.get(pin.path)===pin.sha256,'incomplete actual Playwright package closure');
 for(const pin of [recipe.fonts.systemEmojiFont,recipe.fonts.systemCjkFont])need(runtimePins.get(await realpath(pin.path))===pin.sha256,'required actual system glyph-font bytes missing');
 const cache='/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld';const caches=(await readdir(cache)).filter(n=>n.startsWith('dyld_shared_cache_arm64e')).map(n=>join(cache,n)).sort();same([...d.runtime.systemSharedCacheFiles].sort(),caches,'incomplete macOS shared-cache subdivision inventory');for(const file of caches)need(runtimePins.has(file),'unbound native shared-cache bytes');need(d.runtime.platform==='darwin'&&process.platform==='darwin'&&d.runtime.nodePath===process.execPath&&d.runtime.nodeVersion===process.version,'runtime host/node identity');
 return {descriptor:d,descriptorSha256:hash(bytes),css,dependencies,fragments,recipe,recipeRoot,verifiedHtmlSources:d.native.publicSources,sources};
}
export function verifyObservedRuntime(observed,d,root){
 const pins=new Map(d.runtime.filePins.map(p=>[p.path,p.sha256]));if(root)for(const p of Object.values(d.native.tools))pins.set(resolve(root,p.path),p.sha256);for(const p of observed.loadedModules||[])need(pins.get(p.path)===p.sha256,'unbound actually loaded Python module');
 for(const name of observed.loadedNativeImages||[])need(pins.has(name)||d.runtime.systemNativeImages.includes(name),'unbound loaded native library');
 need(Array.isArray(observed.loadedNativeImages)&&observed.loadedNativeImages.length>0,'missing actual native load inventory');
}
// Lossless dictionary encoding keeps all observed per-PID native mappings in the
// immutable context without repeating long path lists. No path or PID is dropped.
export function compactNativeMaps(maps){
 const nativeImagePaths=[...new Set(maps.flatMap(m=>m.paths))].sort();const indexes=new Map(nativeImagePaths.map((p,i)=>[p,i])),sets=new Map();
 const browserProcesses=maps.map(m=>{same(m.paths,[...new Set(m.paths)].sort(),'noncanonical actual native map');const sha256=hash(JSON.stringify(m.paths));sets.set(sha256,{sha256,indexes:m.paths.map(p=>indexes.get(p))});return {pid:m.pid,nativeSetSha256:sha256,rawSha256:m.rawSha256};});
 const encoded={browserProcesses,nativeImagePaths,nativeImageSets:[...sets.values()].sort((a,b)=>a.sha256.localeCompare(b.sha256))};same(expandNativeMaps(encoded),maps,'native mapping encoding is not lossless');return encoded;
}
export function expandNativeMaps(e){
 const paths=e?.nativeImagePaths,sets=e?.nativeImageSets,processes=e?.browserProcesses;
 need(Array.isArray(paths)&&paths.length>0&&paths.length<=2000&&paths.every(p=>typeof p==='string'&&p.startsWith('/')&&!/[\x00-\x1f]/.test(p)),'missing or unbounded native path dictionary');same(paths,[...new Set(paths)].sort(),'duplicate/noncanonical native path dictionary');
 need(Array.isArray(sets)&&sets.length>0&&sets.length<=128,'missing or unbounded native mapping sets');const expanded=new Map(),usedPaths=new Set();
 for(const set of sets){same(Object.keys(set).sort(),['indexes','sha256'],'unknown native mapping-set fields');need(/^[a-f0-9]{64}$/.test(set.sha256)&&!expanded.has(set.sha256)&&Array.isArray(set.indexes)&&set.indexes.length>0,'duplicate/invalid native mapping set');let previous=-1;const names=set.indexes.map(i=>{need(Number.isInteger(i)&&i>previous&&i<paths.length,'invalid native path index');previous=i;usedPaths.add(i);return paths[i];});need(hash(JSON.stringify(names))===set.sha256,'native mapping set fingerprint differs');expanded.set(set.sha256,names);}
 same(sets.map(s=>s.sha256),[...expanded.keys()].sort(),'noncanonical native set ordering');
 need(Array.isArray(processes)&&processes.length>0&&processes.length<=128,'missing or unbounded native process inventory');const pids=new Set(),usedSets=new Set();
 const result=processes.map(p=>{same(Object.keys(p).sort(),['nativeSetSha256','pid','rawSha256'],'unknown/legacy native process fields');need(Number.isInteger(p.pid)&&p.pid>0&&!pids.has(p.pid)&&/^[a-f0-9]{64}$/.test(p.rawSha256)&&expanded.has(p.nativeSetSha256),'invalid native process/set reference');pids.add(p.pid);usedSets.add(p.nativeSetSha256);return {pid:p.pid,paths:expanded.get(p.nativeSetSha256),rawSha256:p.rawSha256};});
 need(usedSets.size===sets.length&&usedPaths.size===paths.length,'unused native dictionary/set entries');return result;
}
export function openSceneCss(deps){
 return deps.map((d,i)=>`@font-face{font-family:${i?'WrapperMono':'WrapperArial'};src:url(${JSON.stringify(d.url)})}`).join('\n')+`\n*{box-sizing:border-box}html{background:white;color:#141414}body{margin:0;padding:32px;width:1408px;font-family:WrapperArial,'Apple Color Emoji','PingFang SC';font-size:18px;line-height:1.45}main{width:1344px}h1{font-size:29px}h2{font-size:25px}h3{font-size:22px}h4{font-size:20px}a{color:#0757a1;text-decoration:none}.anchor{display:none}p,ul,ol,table,pre{margin:14px 0}table{border-collapse:collapse;width:100%;table-layout:auto}td,th{padding:9px 10px;border:1px solid #8d98a4;vertical-align:top;font-size:18px}th{background:#edf1f4}pre{padding:14px;border:1px solid #bec7d0;background:#f6f8fa;white-space:pre-wrap;overflow-wrap:anywhere;font-family:WrapperMono,'Apple Color Emoji','PingFang SC';font-size:14px;line-height:1.45}code{font-family:WrapperMono,'Apple Color Emoji','PingFang SC'}pre code{font-size:inherit}img{max-width:none}.wrapper-note{font-size:14px;color:#45525e;border-bottom:1px solid #9ca8b2;padding-bottom:12px;margin-bottom:20px}.fragment-boundary{height:14px;border-top:1px dotted #bec7d0;margin-top:16px}`;
}
export const openSceneSourceHashes={primary:'f96cfc3b2cdd5954b70708088c4108a07555047bce325a4c02cf0d63af2beb55','openscene-stats':'ebbef65bb34aa5f8c6ed78ba21d98b02da26890a9799ca86eca047df1bca3e6b','openscene-challenge-2024':'0d8556daa9714d258b97768b5abfd157fabf7945ffa69c7b0728f5027fe66ee8','openscene-getting-started':'aa63fb18179a6405ccccc504d416f738b6cc2365c01f849f82a448f2761f9325'};
export function validateOpenSceneSources(manifest,sources){
 need(manifest.kind==='html'&&manifest.paperId===openScenePaperId&&manifest.sha256===openSceneSourceHashes.primary,'multi-source profile source mismatch');same(sources.map(s=>s.id),Object.keys(openSceneSourceHashes),'exact source ID inventory');
 const names=['','dataset_stats','challenge_2024','getting_started'];for(const [i,s] of sources.entries()){need(s.kind==='html'&&s.sha256===openSceneSourceHashes[s.id]&&s.url===(i?`https://github.com/OpenDriveLab/OpenScene/blob/72860746787a67946bef07aa1f78bbbc6b20e445/docs/${names[i]}.md`:'https://github.com/OpenDriveLab/OpenScene'),'exact document source fingerprint/locator');}
 return sources;
}
export function validateOpenSceneBundle(pack,report,edition){
 const d=pack.descriptor;validateOpenSceneSources({kind:'html',paperId:report.paperId,sha256:d.sourceSha256},report.sources);same(report.sources,d.native.publicSources,'reported four sources differ from verified original manifests');
 same([...edition.visualAudit.inspectedSections].sort(),[...d.requiredSupportingSections].sort(),'missing required claim-bearing context');need(edition.visualAudit.inspectedPages===undefined,'HTML cannot fabricate inspectedPages');
 same(edition.visuals.map(v=>v.htmlSource.fragmentId).sort(),[...d.selectedFigureIds].sort(),'exact four useful selected figures required');
 for(const e of report.evidence){const ids=edition.visualAudit.htmlEvidence[e.id];need(Array.isArray(ids)&&ids.length>0,'missing document-specific evidence support');for(const id of ids)need(pack.fragments.get(id)?.role==='supporting-section'&&pack.fragments.get(id)?.sourceId===e.sourceId,'evidence mapped to another source document');}
 function publicStrings(x){if(typeof x==='string'){for(const url of x.match(/https?:\/\/[^\s<>"')]+/g)||[])publicSourceUrl(pack.recipe,url.replace(/[.,;]+$/,''));}else if(x&&typeof x==='object')for(const v of Object.values(x))publicStrings(v);}
 publicStrings(report);publicStrings(edition);
}
export function validateOpenSceneReviewContext(context){
 const native=context.htmlRendering?.openScene;const any=context.images?.some(i=>i.locator?.policyVersion===openScenePolicyVersion||['html-original-table','html-gif-derived-still'].includes(i.locator?.kind));
 if(context.policy?.version!==openScenePolicyVersion){need(!native&&!any,'native evidence cannot use an old/unknown policy');return false;}
 need(context.sourceKind==='html'&&context.paperId===openScenePaperId&&context.sourceSha256===openSceneSourceHashes.primary&&native?.kind==='executed-openscene-original-evidence-v1','native review identity/execution missing');
 const b=native.binding;need(b?.policyVersion===openScenePolicyVersion&&b.profile===openSceneProfile&&b.recipeSha256===approvedRecipeSha256&&b.codeSha256===openSceneCodeSha256&&b.processCodeSha256===openSceneProcessCodeSha256&&b.decoderSha256===trustedOpenScenePython.decoder&&b.validatorSha256===trustedOpenScenePython.validator,'native review code/recipe/runtime binding');
 need(b.sourceBundleSha256==='eca200b677f40fa93987ee0aeef6d52e9702260865393b12d70e3796eb73e6fd'&&b.descriptorSha256===context.htmlRendering.descriptorSha256,'native review descriptor/source bundle');same(b.imageIds,openSceneIds,'native execution image inventory');
 validateOpenSceneSources({kind:'html',paperId:context.paperId,sha256:context.sourceSha256},context.report.sources);need(context.edition.visualAudit.inspectedPages===undefined,'fake PDF inspection');same([...context.edition.visualAudit.inspectedSections].sort(),openSceneIds.slice(0,12).sort(),'missing12 supporting sections');
 need(Array.isArray(context.images)&&context.images.length===16&&new Set(context.images.map(i=>i.imageId)).size===16,'native current image inventory');const found=[];
 for(const image of context.images){const loc=image.locator;need(loc?.policyVersion===openScenePolicyVersion&&loc.recipeSha256===approvedRecipeSha256&&loc.descriptorSha256===b.descriptorSha256&&loc.sourceBundleSha256===b.sourceBundleSha256&&loc.sourceSha256===openSceneSourceHashes[loc.sourceId],'image source locator is unbound');const index=openSceneIds.indexOf(loc.fragmentId);need(index>=0,'unknown native fragment');found.push(loc.fragmentId);const sourceIndex=index<2||index===12?0:index<6||index>=13?1:index<8?2:3;const expectedSource=Object.keys(openSceneSourceHashes)[sourceIndex];need(loc.sourceId===expectedSource&&loc.documentId===['readme','dataset_stats','challenge_2024','getting_started'][sourceIndex],'fragment assigned to wrong source document');
  const role=index<12?'supporting-html-section':index===15?'selected-html-gif-derived-still':'selected-original-html-table';need(loc.kind===(index===2||index===15?'html-gif-derived-still':index<12?'html-original':'html-original-table'),'native locator kind does not match actual source role');need(image.reviewRole===role&&((index<12&&image.kind==='source-html-section'&&image.imageId==='section-'+loc.fragmentId)||(index>=12&&image.kind==='html-original-figure'&&image.description.htmlSource.fragmentId===loc.fragmentId)),'native image role/kind mismatch');
  if(index===2||index===15)need(loc.kind==='html-gif-derived-still'&&loc.frameIndex===0&&loc.timeMs===0&&loc.loopIteration===0&&loc.framePngSha256==='1554706d8304f665ef7261af47ed84f35fdfcb6837663b0c648a652c1914c9a9'&&loc.rgbaSha256==='d4687cf21eaad0c9883b659577c5c16ef9918143a97e40fdd9c17bb013df969c','native actual frame identity');
 }
 same(found.sort(),[...openSceneIds].sort(),'native fragment duplicate/missing');const execution=native.execution;expandNativeMaps(execution);need(execution?.sourceCodeExecuted===false&&execution.unapprovedNetworkRequests===0&&execution.cspMonitorVersion==='openscene-csp-monitor-v1'&&execution.decoderPid>0&&execution.rendererPid>0&&execution.decoderPid!==execution.rendererPid&&execution.browserProcesses?.length>0&&typeof execution.jobId==='string'&&/^[a-f0-9-]{36}$/.test(execution.jobId),'native execution telemetry absent');for(const budget of [execution.sourceBudget,execution.decoderBudget,execution.renderBudget])need(budget?.ownedTreeExitConfirmed===true&&budget.processGroupOwned===true&&budget.rssSamples>0&&budget.exitCode===0,'native executed process budget incomplete');return true;
}
export async function renderOpenSceneEvidence({root,config,ids,outputDirectory,shouldStop=()=>false,rendererCodeSha256}){
 need(!shouldStop(),'render interrupted before preparation');const pack=await loadOpenSceneEvidence(root,config,rendererCodeSha256);same([...ids].sort(),[...openSceneIds].sort(),'fresh original render requires all16 images');
 const output=resolve(outputDirectory);need(output.startsWith(resolve(root)+'/')&&await realpath(dirname(output))===dirname(output),'render output escapes or symlink');await mkdir(output,{recursive:false});
 const renderer=fileURLToPath(new URL('./openscene-render.mjs',import.meta.url));need(hash(await readFile(renderer))===pack.descriptor.native.renderCodeSha256,'renderer code changed');
 const jobId=randomUUID();const result=await runBounded(process.execPath,[renderer],{cwd:root,input:{jobId,root:resolve(root),config,ids:openSceneIds,outputDirectory:output,rendererCodeSha256},timeoutMs:300000,maxRssBytes:2_000_000_000,maxOutputBytes:5_000_000,shouldStop});const fresh=JSON.parse(result.stdout);
 need(fresh.nativeEvidence?.kind==='executed-openscene-original-evidence-v1'&&fresh.nativeEvidence.execution.jobId===jobId&&fresh.nativeEvidence.execution.outputDirectory===output,'missing actual fresh original-render execution');same(fresh.records.map(r=>r.id),openSceneIds,'fresh image inventory');for(const r of fresh.records){need(dirname(r.path)===output,'fresh render substituted external image');need(hash(await readFile(await nativeFile(root,relative(root,r.path),20_000_000)))===r.sha256,'fresh render PNG changed');}
 fresh.nativeEvidence.execution.renderBudget=result.execution;need(fresh.nativeEvidence.execution.rendererPid===result.execution.pid,'actual renderer process identity');
 await loadOpenSceneEvidence(root,config,rendererCodeSha256);return {...fresh,descriptor:pack.descriptor};
}
export async function snapshotOpenSceneEvidence({attempt,config,bundlePath,expectedSha256,helperPath,shouldStop,rendererCodeSha256}){
 const base=dirname(resolve(bundlePath)),bytes=await readFile(await nativeFile(base,basenamePath(bundlePath),5_000_000));need(hash(bytes)===expectedSha256,'explicit native input descriptor fingerprint');const d=JSON.parse(bytes);need(d.policyVersion===openScenePolicyVersion,'native snapshot policy');
 // Preserve the approved recipe bytes and its relative file layout; never rewrite source fragments.
 const recipe=JSON.parse(await nativeBytes(base,d.native.recipe));const srcRoot=dirname(await nativeFile(base,d.native.recipe.path));await mkdir(join(attempt,'html-source'),{recursive:false});
 const copy=async(from,to)=>{await mkdir(dirname(to),{recursive:true});await copyFile(from,to);};
 for(const pin of [...recipeFilePins(recipe),{path:'descriptor.json',sha256:approvedRecipeSha256},d.native.officialTree]){const from=await nativeFile(srcRoot,pin.path);need(hash(await readFile(from))===pin.sha256,'native original snapshot fingerprint');await copy(from,join(attempt,'html-source/original',pin.path));}
 const rewrite=async pin=>{const data=await nativeBytes(base,pin,100000000);const name='html-source/'+pin.path;await mkdir(dirname(join(attempt,name)),{recursive:true});await writeFile(join(attempt,name),data,{flag:'wx'});return {...pin,path:name};};
 const nativeTools={};for(const [key,pin] of Object.entries(d.native.tools))nativeTools[key]=await rewrite(pin);
 const snapshot={...d,wrapper:await rewrite(d.wrapper),dependencies:[] ,native:{...d.native,recipe:{...d.native.recipe,path:'html-source/original/descriptor.json'},tools:nativeTools}};
 // Font bytes are already part of original; avoid duplicate write collisions.
 snapshot.dependencies=d.dependencies.map(pin=>({...pin,path:'html-source/original/'+relative(srcRoot,resolve(base,pin.path))}));
 const serialized=JSON.stringify(snapshot,null,2)+'\n';await writeFile(join(attempt,'html-source/descriptor.json'),serialized,{flag:'wx'});
 for(const name of ['html-original-evidence.mjs','html-original-media.mjs','openscene-original-evidence.mjs','openscene-process.mjs','openscene-render.mjs'])await copyFile(new URL('./'+name,import.meta.url),join(attempt,name==='html-original-evidence.mjs'?'source-html.mjs':name));
 const next={...config,htmlVisuals:{rendererCodeSha256,openSceneCodeSha256,path:'html-source/descriptor.json',sha256:hash(serialized),inputSha256:expectedSha256}};
 const pack=await loadOpenSceneEvidence(attempt,next,rendererCodeSha256);const chunks=[];for(const source of pack.sources){let index=0;const parts=splitNativeText(source.text);for(const value of parts){const path=`chunks/${chunks.length+1}.txt`;if(chunks.length<config.chunks.length){need(config.chunks[chunks.length].sha256===hash(value),'primary chunk changed');}else await writeFile(join(attempt,path),value,{flag:'wx'});chunks.push({path,sha256:hash(value),sourceId:source.id,sourceChunk:++index});}}
 next.chunks=chunks;next.verifiedHtmlSources=pack.verifiedHtmlSources;
 const prepared=await renderOpenSceneEvidence({root:attempt,config:next,ids:openSceneIds,outputDirectory:join(attempt,'html-prepared'),shouldStop,rendererCodeSha256});
 for(const [name,value,key] of [['prepared-renders.json',prepared.records.map(r=>({...r,path:relative(attempt,r.path)})),'prepared'],['prepared-openscene.json',prepared.nativeEvidence,'preparedOpenScene']]){const data=JSON.stringify(value,null,2)+'\n';await writeFile(join(attempt,'html-source',name),data,{flag:'wx'});next.htmlVisuals[key]={path:'html-source/'+name,sha256:hash(data)};}
 return next;
}
const basenamePath=p=>p.split(/[\\/]/).at(-1);
function splitNativeText(text){const parts=[];for(let start=0;start<text.length;){let end=Math.min(start+12000,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;parts.push(text.slice(start,end));start=end;}return parts;}
export async function validateOpenSceneChunks(root,config,pack){
 const expected=[];for(const source of pack.sources){let n=0;for(const text of splitNativeText(source.text))expected.push({path:`chunks/${expected.length+1}.txt`,sha256:hash(text),sourceId:source.id,sourceChunk:++n});}
 same(config.chunks,expected,'complete four-document chunk inventory changed');same(config.verifiedHtmlSources,pack.verifiedHtmlSources,'four source identity changed');for(const chunk of expected)await nativeBytes(root,chunk,50000);return true;
}
export async function verifyOpenSceneInputPin({attempt,config,bundlePath,expectedSha256,rendererCodeSha256}){
 const base=dirname(resolve(bundlePath)),bytes=await readFile(await nativeFile(base,basenamePath(bundlePath),5_000_000));need(hash(bytes)===expectedSha256&&config.htmlVisuals.inputSha256===expectedSha256,'native recovery input fingerprint');const input=JSON.parse(bytes),recipeRoot=dirname(resolve(base,input.native.recipe.path));
 const expected={...input,wrapper:{...input.wrapper,path:'html-source/'+input.wrapper.path},dependencies:input.dependencies.map(p=>({...p,path:'html-source/original/'+relative(recipeRoot,resolve(base,p.path))})),native:{...input.native,recipe:{...input.native.recipe,path:'html-source/original/descriptor.json'},tools:Object.fromEntries(Object.entries(input.native.tools).map(([k,p])=>[k,{...p,path:'html-source/'+p.path}]))}};
 need(config.htmlVisuals.path==='html-source/descriptor.json'&&config.htmlVisuals.sha256===hash(JSON.stringify(expected,null,2)+'\n'),'native snapshot not derived from exact supplied input');return loadOpenSceneEvidence(attempt,config,rendererCodeSha256);
}
export async function preparedOpenSceneEvidence(root,config,pack){
 const evidence=JSON.parse(await nativeBytes(root,config.htmlVisuals.preparedOpenScene,5_000_000));need(evidence.kind==='executed-openscene-original-evidence-v1'&&evidence.binding.codeSha256===openSceneCodeSha256&&evidence.binding.processCodeSha256===openSceneProcessCodeSha256&&evidence.binding.descriptorSha256===pack.descriptorSha256,'prepared native execution/code changed');
 same(evidence.binding.imageIds,openSceneIds,'prepared complete image inventory');need(evidence.binding.derivationSha256===hash(JSON.stringify(assertDerivationBinding(pack.recipe))),'prepared per-capture/global GIF binding changed');return evidence;
}
