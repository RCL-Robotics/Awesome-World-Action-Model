// Portable structural/gate fixtures; no browser, source acquisition or approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mediaCodeSha256, mediaPolicyVersion, mediaPolicy, mediaRole, validateMediaReviewContext } from '../scripts/lib/html-original-media.mjs';
import { validateVisualReview } from '../scripts/lib/illustrated-runner.mjs';
import { visualReviewSchemaForContext } from '../scripts/lib/visual-review-schema.mjs';
import { validateIllustratedReport } from '../scripts/lib/illustrated-reports.mjs';
const hash='a'.repeat(64), paperId='synthetic', evidenceIds=['e1'];
const source={kind:'html',url:'https://example.invalid/original',sha256:hash};
const locator={kind:'html-animation-derived-still',fragmentId:'architecture',anchor:null,parts:[{startCharacter:0,endCharacter:1,sha256:hash}],descriptorSha256:hash,wrapperSha256:hash,rendererSha256:hash,rendererCodeSha256:hash,mediaPolicyVersion,mediaCodeSha256,mediaManifestSha256:hash,mediaId:'architecture',originalAssetSha256:hash,derivationSha256:hash,timeTuple:{outerFrame:200,outerFps:100,outerTimeSeconds:2,embeddedGIFFrame:0,embeddedGIFTimeMs:0}};
const visual={id:'architecture',kind:'figure',section:'mechanism',asset:`report-assets/${paperId}/architecture.png`,sourceSha256:hash,sourceUrl:source.url,htmlSource:locator,sourceRendering:'Explicit synthetic derivation disclosure',sourceLabel:'Animation-derived still',alt:'Synthetic fixture',caption:'Synthetic fixture',readingGuide:'Synthetic fixture',takeaway:'No approval',caution:'No actual reading',width:1280,height:466,evidenceIds};
const report={paperId,evidence:[{id:'e1'}],sources:[source],coverage:{scope:'resource-overview'},results:[]};
const edition={schemaVersion:1,paperId,shortTitle:'Fixture',thesis:'Fixture',standfirst:'Fixture',evidenceIds,visualLimitations:{kind:'analysis',text:'Synthetic source-limited fixture only',evidenceIds},visuals:[visual],walkthrough:Array.from({length:3},()=>({heading:'Fixture',text:'Fixture',kind:'analysis',evidenceIds})),reproductionChecks:Array.from({length:2},()=>({title:'Fixture',text:'Fixture',evidenceIds})),visualAudit:{inspectedSections:['identity'],htmlEvidence:{e1:['identity']},notes:'Synthetic mapping only'}};
test('new public media locator uses real canonical URL without invented null anchor',()=>assert.equal(validateIllustratedReport(edition,report),edition));
for(const [name,change] of [
 ['invented page',e=>e.visuals[0].page=1],['invented crop',e=>e.visuals[0].crop=[0,0,1,1]],['invented anchor',e=>e.visuals[0].sourceUrl+='#null'],['old policy',e=>e.visuals[0].htmlSource.mediaPolicyVersion='wam-original-html-evidence-v1'],['unbound original bytes',e=>delete e.visuals[0].htmlSource.originalAssetSha256],['fake inspected pages',e=>e.visualAudit.inspectedPages=[1]],['missing claim support',e=>e.visualAudit.htmlEvidence={}]
])test(`public media rejects ${name}`,()=>{const e=structuredClone(edition);change(e);assert.throws(()=>validateIllustratedReport(e,report));});
const context={paperId,sourceSha256:hash,sourceKind:'html',policy:mediaPolicy({reviewerRole:'independent-visual-evidence-reviewer'}),htmlRendering:{media:{codeSha256:mediaCodeSha256,manifestSha256:hash,runtimeExecution:{synthetic:true},derivations:[{cspMonitor:{version:'wam-media-csp-navigation-v2',installed:true,documentURL:'https://wam-original.invalid/helix-animation-wrapper',violations:[]},cspViolations:[]}]}},images:[{imageId:'figure-architecture',kind:'html-original-figure',sha256:hash,locator,reviewRole:'selected-html-animation-derived-still'}]};
const receipt={schemaVersion:1,paperId,sourceSha256:hash,approved:true,identityMatches:true,identityNotes:'Synthetic contract only',images:[{imageId:'figure-architecture',sha256:hash,reviewRole:'selected-html-animation-derived-still',legible:true,matchesDescription:true,claimsSupported:true,observedDetail:'Synthetic contract only'}]};
test('explicit role is independent of selected/final kind and cannot be confused with a PDF crop',()=>{assert.equal(mediaRole(context.images[0]),'selected-html-animation-derived-still');assert.equal(validateVisualReview(receipt,context),true);const r=structuredClone(receipt);r.images[0].reviewRole='selected-final-crop';assert.throws(()=>validateVisualReview(r,context));});
test('new policy rejects source-kind and media-code substitution',()=>{for(const change of[c=>c.sourceKind='pdf',c=>c.htmlRendering.media.codeSha256='b'.repeat(64),c=>c.images[0].reviewRole='selected-original-html-raster']){const c=structuredClone(context);change(c);assert.throws(()=>validateMediaReviewContext(c));}});
test('all scientific false flags still fail under media policy',()=>{for(const flag of['legible','matchesDescription','claimsSupported']){const r=structuredClone(receipt);r.images[0][flag]=false;assert.throws(()=>validateVisualReview(r,context));}});
test('media schema keeps four exact identity enums and adds required role without forcing scientific flags',async()=>{const template=JSON.parse(await readFile(new URL('../schemas/illustrated-visual-review.schema.json',import.meta.url))),s=visualReviewSchemaForContext(context,template),p=s.properties.images.items.properties;assert.deepEqual(s.properties.paperId.enum,[paperId]);assert.deepEqual(s.properties.sourceSha256.enum,[hash]);assert.deepEqual(p.imageId.enum,['figure-architecture']);assert.deepEqual(p.sha256.enum,[hash]);assert.deepEqual(p.reviewRole.enum,['selected-html-animation-derived-still']);assert.deepEqual(p.claimsSupported,{type:'boolean'});assert(s.properties.images.items.required.includes('reviewRole'));});

for(const [name,mutate] of [
 ['missing derivation',c=>delete c.htmlRendering.media.derivations],
 ['not installed',c=>c.htmlRendering.media.derivations[0].cspMonitor.installed=false],
 ['wrong document',c=>c.htmlRendering.media.derivations[0].cspMonitor.documentURL='about:blank'],
 ['old monitor',c=>c.htmlRendering.media.derivations[0].cspMonitor.version='unverified'],
 ['actual violation',c=>c.htmlRendering.media.derivations[0].cspMonitor.violations=[{directive:'script-src-elem'}]],
 ['mismatched telemetry',c=>c.htmlRendering.media.derivations[0].cspViolations=['script-src-elem']]
])test(`media context rejects ${name}`,()=>{const c=structuredClone(context);mutate(c);assert.throws(()=>validateMediaReviewContext(c));});
