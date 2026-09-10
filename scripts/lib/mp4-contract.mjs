import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {join} from 'node:path';
import {MP4_PAPER,MP4_SOURCE_SHA,MP4_TEXT_SHA,MP4_DESCRIPTOR_SHA,MP4_SCOPE,MP4_GUARDRAILS,MP4_REVIEW_INSTRUCTIONS,mp4Hash,mp4PinnedFile,loadMp4SourcePlan,prepareMp4ReviewPacket,verifyMp4PacketCurrent,validateMp4Packet} from './mp4-source.mjs';
export const MP4_FULL_POLICY='wam-original-mp4-full-report-v1';
export const MP4_FULL_INSTRUCTIONS=MP4_REVIEW_INSTRUCTIONS.replace('This packet is source-evidence preparation, not report acceptance; a future full report and all source/identity/visual evidence still require a fresh normal independent review.','This is a fresh fixed full-report review. Read the complete retained source text and every report/edition field. Inspect all40source stills and every selected public still. Original captions are attributed author claims, not measurements. Every required verdict must be independently truthful.');
export const MP4_URL='https://www.microsoft.com/en-us/research/story/advancing-ai-for-the-physical-world/';
export const MP4_VISUALS=JSON.parse(readFileSync(new URL('./mp4-visuals.json',import.meta.url)));
export const MP4_DISCLOSURE='Original Microsoft MP4 decoded to one full 1920 × 1080 PNG at the explicitly recorded requested and actual times. Selected still only; not a website screenshot, continuous video, audio, latency, benchmark success or model-execution proof.';
export const MP4_CAUTION='These sampled stills do not establish continuous motion, audio, latency, benchmark success, autonomous operation or model execution.';
export const need=(v,m)=>{if(!v)throw Error('MP4 full report: '+m);};
export const same=(a,b,m)=>need(isDeepStrictEqual(a,b),m);
export const bytes=x=>JSON.stringify(x,null,2)+'\n';
export const hash=mp4Hash;
export const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const exact=(o,n,m)=>same(Object.keys(o||{}).sort(),n.split(' ').sort(),m);
const plans=new WeakMap();
export async function loadFullMp4Plan({workDir,descriptorPin,requestedIds}){
 const sourceToken=await loadMp4SourcePlan({workDir,descriptorPin,requestedIds});
 const descriptorJson=(await mp4PinnedFile(workDir,descriptorPin)).toString('utf8'),d=JSON.parse(descriptorJson);
 const token=Object.freeze({});plans.set(token,{sourceToken,d,workDir,descriptorPin,descriptorJson});return token;
}
function internalPlan(token){const p=plans.get(token);need(p,'unowned full source plan');return p;}
export function fullMp4Plan(token){const p=internalPlan(token);return Object.freeze({...p,d:structuredClone(p.d),descriptorPin:structuredClone(p.descriptorPin)});}
export function mp4SourcePins(d,descriptorPin,workDir){const rel=[d.source,d.text,d.manifest,d.acquisition,d.captionBindings,d.nativeExtraction,d.decoderSource,...d.scienceRecords,...d.clips.flatMap(c=>[c.media,...c.frames.map(f=>({path:f.path,sha256:f.sha256,bytes:f.bytes}))])];return [descriptorPin,...rel.map(p=>({...p,path:join(workDir,p.path)}))].sort((a,b)=>a.path.localeCompare(b.path));}
export async function verifyFullMp4Plan(token){const p=internalPlan(token);await loadMp4SourcePlan({workDir:p.workDir,descriptorPin:p.descriptorPin,requestedIds:[MP4_PAPER]});return fullMp4Plan(token);}
export function mp4Visual(clipId,sampleIndex){const v=MP4_VISUALS.find(x=>x.clipId===clipId&&x.sampleIndex===sampleIndex);need(v,'unknown sampled original');return structuredClone(v);}
export function validateMp4Visual(v,source){
 need(source?.kind==='html'&&source.sha256===MP4_SOURCE_SHA&&source.url===MP4_URL,'visual primary identity');
 same(v.mp4Source,mp4Visual(v.mp4Source?.clipId,v.mp4Source?.sampleIndex),'visual original locator drift');
 need(v.kind==='figure'&&v.page===undefined&&v.crop===undefined&&v.htmlSource===undefined,'MP4 cannot masquerade as table/PDF/GIF');
 need(v.width===1920&&v.height===1080&&v.sourceUrl===MP4_URL&&v.sourceRendering===MP4_DISCLOSURE,'sample geometry/disclosure drift');
 need(typeof v.caution==='string'&&v.caution.includes(MP4_CAUTION),'missing still-only caution');
}
export function validateMp4EditionScope(edition,report){
 if(!edition?.visuals?.some(v=>v.mp4Source))return false;
 need(edition.paperId===MP4_PAPER&&report.paperId===MP4_PAPER&&report.sources.length===1&&report.sources[0].sha256===MP4_SOURCE_SHA,'MP4 report identity');
 need(edition.visuals.every(v=>v.mp4Source)&&edition.visualLimitations?.kind==='source','mixed source or invented quantitative visual inventory');
 need(report.coverage.scope==='resource-overview','technical article cannot become experimental paper');
 need(report.method.equations.length===0&&report.results.length===0,'source reports no equations or quantitative benchmark results');
 same(edition.visualAudit.inspectedSections,['complete-primary-text'],'complete supplied source text required');
 for(const e of report.evidence)same(edition.visualAudit.htmlEvidence[e.id],['complete-primary-text'],'evidence outside complete retained primary');
 need(edition.visuals.every(v=>v.asset===`report-assets/${report.paperId}/${v.id}.png`),'exact unique selected asset destination required');
 need(new Set(edition.visuals.map(v=>v.mp4Source.clipId+':'+v.mp4Source.sampleIndex)).size===edition.visuals.length,'duplicate selected frame');
 return true;
}
export function validateNativeProof(proof,d,{allowSynthetic=false}={}){
 exact(proof,'schemaVersion kind domain createdAt historicalDerivationSha256 decoderSourceSha256 sourceFiles frames runtimeFiles runtimeObservations execution rootAttestation','native proof fields');
 need(proof.schemaVersion===1&&proof.kind==='fresh-native-mp4-extraction-proof-v1'&&(proof.domain==='production'||allowSynthetic&&proof.domain==='synthetic'),'wrong native proof kind/domain');
 need(Number.isFinite(Date.parse(proof.createdAt))&&proof.historicalDerivationSha256===d.nativeExtraction.sha256&&proof.decoderSourceSha256===d.decoderSource.sha256,'native historical/current distinction');
 same(proof.sourceFiles,d.clips.map(c=>({url:c.url,sha256:c.media.sha256,bytes:c.media.bytes})),'native input inventory');
 same(proof.frames,d.clips.flatMap(c=>c.frames.map(f=>({clipId:c.id,sampleIndex:f.sampleIndex,sha256:f.sha256,width:f.width,height:f.height,requestedSeconds:f.requestedSeconds,actualSeconds:f.actualSeconds}))),'fresh extraction does not exactly match bound originals');
 need(Array.isArray(proof.runtimeFiles)&&proof.runtimeFiles.length>=2&&proof.runtimeFiles.every(p=>hex(p.sha256)&&typeof p.path==='string'&&p.path.startsWith('/')),'native runtime file closure');
 exact(proof.runtimeObservations,'osVersion osBuild architecture sdkVersion swiftVersion avFoundationVersion dyldSharedCacheIdentity limitations','native runtime observations');
 for(const [k,v]of Object.entries(proof.runtimeObservations))need(typeof v==='string'&&v.trim(),'native runtime fact missing: '+k);
 const x=proof.execution;need(x&&x.exitCode===0&&x.signal===null&&x.interrupted===false&&x.timedOut===false&&x.ownedTreeExitConfirmed===true&&hex(x.stdoutSha256)&&hex(x.stderrSha256)&&typeof x.jobId==='string','fresh native execution incomplete');
 need(proof.rootAttestation?.kind==='root-observed-native-process'&&hex(proof.rootAttestation.recordSha256),'native process requires independent root attestation pin');
 return true;
}
export async function fullMp4Context(token,{attemptId,reviewId,manifest,report,edition,metadata,nativeProof,codePins,generatedAt}){
 const p=await verifyFullMp4Plan(token);
 const source=await prepareMp4ReviewPacket(p.sourceToken,{attemptId,reviewId});await verifyMp4PacketCurrent(p.sourceToken,source);
 validateNativeProof(nativeProof,p.d);
 same(manifest,JSON.parse(await mp4PinnedFile(p.workDir,p.d.manifest)),'manifest changed');
 need(metadata.title===manifest.observedTitle&&metadata.sourceSha256===MP4_SOURCE_SHA&&metadata.page===undefined&&metadata.location==='complete-primary-text','metadata source location');
 need(report.generatedAt===generatedAt,'report generation changed');
 validateMp4EditionScope(edition,report);
 const images=source.images.map(({path,...i})=>({...i,path,reviewRole:'sampled-original-mp4-frame'}));
 for(const visual of edition.visuals){validateMp4Visual(visual,report.sources[0]);const i=images.find(i=>i.locator.clipId===visual.mp4Source.clipId&&i.locator.sampleIndex===visual.mp4Source.sampleIndex);images.push({...i,imageId:'crop-'+visual.id,kind:'selected-mp4-still',reviewRole:'selected-original-mp4-still',description:visual});}
 const sourceText=(await mp4PinnedFile(p.workDir,p.d.text)).toString('utf8');
 return {schemaVersion:1,sourceKind:'html',paperId:MP4_PAPER,sourceSha256:MP4_SOURCE_SHA,title:manifest.observedTitle,metadata,report,edition,
  policy:{version:MP4_FULL_POLICY,instructions:MP4_FULL_INSTRUCTIONS},
  images,mp4Original:{version:MP4_FULL_POLICY,sourceText,sourceTextSha256:MP4_TEXT_SHA,sourceScope:'resource-overview',descriptorJson:p.descriptorJson,descriptorSha256:MP4_DESCRIPTOR_SHA,historicalExtractionSha256:p.d.nativeExtraction.sha256,nativeProof,codePins,temporalScope:MP4_SCOPE,guardrails:MP4_GUARDRAILS,binding:source.mp4Evidence.binding,sourcePacket:source}};
}
export function validateFullMp4Context(c){
 const has=c?.images?.some(i=>i.kind==='source-mp4-frame'||i.kind==='selected-mp4-still');
 if(!c?.mp4Original){need(!has&&c?.policy?.version!==MP4_FULL_POLICY,'MP4 attachments without full contract');return false;}
 need(c.paperId===MP4_PAPER&&c.sourceKind==='html'&&c.sourceSha256===MP4_SOURCE_SHA&&!c.htmlRendering&&!c.sourceDetails&&!c.identitySupport,'mixed MP4 identity/source');
 same(c.policy,{version:MP4_FULL_POLICY,instructions:MP4_FULL_INSTRUCTIONS},'full review instruction drift');
 const p=c.mp4Original;exact(p,'version sourceText sourceTextSha256 sourceScope descriptorJson descriptorSha256 historicalExtractionSha256 nativeProof codePins temporalScope guardrails binding sourcePacket','full MP4 fields');
 need(p.version===MP4_FULL_POLICY&&c.policy.version===MP4_FULL_POLICY&&p.sourceScope==='resource-overview'&&hash(p.sourceText)===MP4_TEXT_SHA&&p.sourceTextSha256===MP4_TEXT_SHA&&hash(p.descriptorJson)===MP4_DESCRIPTOR_SHA&&p.descriptorSha256===MP4_DESCRIPTOR_SHA,'full source text/descriptor identity');
 const d=JSON.parse(p.descriptorJson);same(p.temporalScope,MP4_SCOPE,'temporal proof escalation');same(p.guardrails,MP4_GUARDRAILS,'scope constraints removed');validateNativeProof(p.nativeProof,d);
 need(Array.isArray(p.codePins)&&p.codePins.length>0&&p.codePins.every(x=>hex(x.sha256)),'integration code closure missing');
 need(c.metadata?.location==='complete-primary-text'&&c.metadata.page===undefined&&c.metadata.sourceSha256===MP4_SOURCE_SHA,'unbound metadata');
 validateMp4EditionScope(c.edition,c.report);
 validateMp4Packet(p.sourcePacket); same(p.binding,p.sourcePacket.mp4Evidence.binding,'source plan binding changed');
 const originals=c.images.filter(i=>i.kind==='source-mp4-frame');need(originals.length===40,'all40source stills required');
 same(originals.map(({path,...i})=>i),p.sourcePacket.images.map(({path,...i})=>i),'original source metadata differs');
 for(let n=0;n<40;n++){const v=MP4_VISUALS[n],i=originals[n];need(i.imageId===`mp4-${v.clipId}-${v.sampleIndex}`&&i.sha256===v.frameSha256&&i.width===1920&&i.height===1080&&i.reviewRole==='sampled-original-mp4-frame','original frame order/hash/role');need(i.locator.originalMp4Sha256===v.originalMp4Sha256&&i.locator.actualSeconds===v.actualSeconds&&i.locator.requestedSeconds===v.requestedSeconds&&i.locator.caption===v.caption,'caption/time binding');}
 const selected=c.images.filter(i=>i.kind==='selected-mp4-still');need(c.images.length===40+c.edition.visuals.length&&selected.length===c.edition.visuals.length&&new Set(c.images.map(i=>i.imageId)).size===c.images.length,'exact full attachment inventory');
 for(const v of c.edition.visuals){validateMp4Visual(v,c.report.sources[0]);const i=selected.find(i=>i.imageId==='crop-'+v.id);need(i?.sha256===v.mp4Source.frameSha256&&i.reviewRole==='selected-original-mp4-still','selected still identity');same(i.description,v,'selected still description differs');}
 return true;
}
