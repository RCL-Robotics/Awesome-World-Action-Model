import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, copyFile, symlink, cp, chmod } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { digest, originalHtmlLayoutCss, loadHtmlEvidence, renderHtmlEvidence, htmlLocator, snapshotHtmlEvidence, verifyHtmlInputPin, preparedHtmlImages } from '../scripts/lib/html-original-evidence.mjs';
import { validateIllustratedReport } from '../scripts/lib/illustrated-reports.mjs';
import { validateBundle, validateVisualReview } from '../scripts/lib/illustrated-runner.mjs';
import { visualReviewSchemaForContext } from '../scripts/lib/visual-review-schema.mjs';
const execute = promisify(execFile), repo = fileURLToPath(new URL('../', import.meta.url));
const base = JSON.parse(await readFile(join(repo,'data/reports/2608.08839.json')));
const originalEdition = JSON.parse(await readFile(join(repo,'data/illustrated-reports/2608.08839.json')));
const template = JSON.parse(await readFile(join(repo,'schemas/illustrated-visual-review.schema.json')));
const chromePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const playwrightPath='/Users/lzx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
// Bind this synthetic recipe to the installed bundle, just as its executable
// hash is captured below. The renderer still checks the live browser version.
const {stdout:chromeVersion}=await execute('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',join(dirname(dirname(chromePath)),'Info.plist')],{timeout:5000});
const browserVersion=chromeVersion.trim();assert.match(browserVersion,/^\d+\.\d+\.\d+\.\d+$/);
const runtime={chromePath,chromeSha256:digest(await readFile(chromePath)),browserVersion,playwrightPath,playwrightEntrySha256:digest(await readFile(playwrightPath)),nodePath:process.execPath};
const css=originalHtmlLayoutCss([]);
const title='<section id="identity"><h1>Fixture title</h1><p>Fixture author</p><p>Protocol: 10 synthetic trials, one synthetic device.</p></section>';
const figure='<section id="fig-1"><svg role="img" viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="120" height="150" fill="#27684e"/><text x="160" y="80">Value 42</text><text x="160" y="140">Unit: synthetic points</text></svg><p>Figure 1. Synthetic fixture.</p><p>Footnote: not a scientific experiment.</p></section>';
const html=title+figure, sourceText='Fixture source text only; not a real paper.';
const normalize=s=>s.replace(/\s+/g,' ').trim();
const h=x=>digest(Buffer.from(x));
const descriptor=()=>({schemaVersion:1,wrapperProfile:'original-html-layout-v1',policyVersion:'wam-original-html-evidence-v1',paperId:'fixture',sourceSha256:h(html),textSha256:h(sourceText),canonicalUrl:'https://example.org/fixture',runtime,viewport:{width:900,height:600},deviceScaleFactor:1,wrapper:{path:'wrapper.css',sha256:h(css)},wrapperDisclosure:'Extracted original HTML with an isolated layout wrapper; synthetic test only.',dependencies:[],identitySectionId:'identity',fragments:[{id:'identity',role:'supporting-section',anchor:'identity',sourceLabel:'Source identity and protocol',parts:[{startCharacter:0,endCharacter:Array.from(title).length,sha256:h(title)}],requiredText:['Fixture title','Fixture author','10 synthetic trials'],visibleTextSha256:h('Fixture title Fixture author Protocol: 10 synthetic trials, one synthetic device.')},{id:'figure',role:'original-figure',anchor:'fig-1',sourceLabel:'Figure 1',parts:[{startCharacter:Array.from(title).length,endCharacter:Array.from(html).length,sha256:h(figure)}],requiredText:['Value 42','Unit: synthetic points','Footnote: not a scientific experiment.'],visibleTextSha256:h('Value 42 Unit: synthetic points Figure 1. Synthetic fixture. Footnote: not a scientific experiment.')}]});
async function fixture(t){
 const root=await mkdtemp(join(repo,'test-private-html-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const d=descriptor();const manifest={paperId:'fixture',kind:'html',sha256:h(html),textSha256:h(sourceText),canonicalUrl:d.canonicalUrl,observedTitle:'Fixture title',titleMatch:true,accessStatus:'full-text',wordCount:8,accessedAt:'2026-09-08T00:00:00Z',scope:'resource-overview',omissions:[]};
 const config={manifest,sourceFile:'source.raw',chunks:[{path:'chunks/1.txt',sha256:h(sourceText)}],python:'/fixture/python',pdftoppm:'/fixture/pdftoppm',htmlVisuals:{path:'descriptor.json',sha256:h(JSON.stringify(d))}};
 await Promise.all([['source.raw',html],['source.txt',sourceText],['wrapper.css',css],['descriptor.json',JSON.stringify(d)],['source-config.json',JSON.stringify(config)]].map(([n,b])=>writeFile(join(root,n),b)));
 return {root,d,config,manifest,async repin(){await writeFile(join(root,'descriptor.json'),JSON.stringify(d));config.htmlVisuals.sha256=h(JSON.stringify(d));await writeFile(join(root,'source-config.json'),JSON.stringify(config));}};
}
test('pinned HTML descriptor resolves exact source ranges and original anchors',async t=>{const f=await fixture(t),p=await loadHtmlEvidence(f.root,f.config);assert.equal(p.fragments.get('figure').markup,figure);assert.equal(p.descriptor.paperId,'fixture');});
for(const [name,change,pattern] of [
 ['raw source tamper',async f=>writeFile(join(f.root,'source.raw'),html.replace('42','99')),/fingerprint/],
 ['primary text tamper',async f=>writeFile(join(f.root,'source.txt'),'other'),/fingerprint/],
 ['descriptor tamper',async f=>writeFile(join(f.root,'descriptor.json'),'{}'),/fingerprint/],
 ['wrapper tamper',async f=>writeFile(join(f.root,'wrapper.css'),css+'body{display:none}'),/fingerprint/],
 ['fragment tamper',async f=>{f.d.fragments[1].parts[0].sha256='0'.repeat(64);await f.repin();},/fragment fingerprint/],
 ['missing labels',async f=>{f.d.fragments[1].requiredText=[];await f.repin();},/labels/],
 ['missing text hash',async f=>{delete f.d.fragments[1].visibleTextSha256;await f.repin();},/labels/],
 ['wrong paper identity',async f=>{f.d.paperId='wrong';await f.repin();},/identity/],
 ['wrong source identity',async f=>{f.d.sourceSha256='0'.repeat(64);await f.repin();},/identity/],
 ['wrong source kind',async f=>{f.config.manifest.kind='pdf';},/source-kind/],
 ['missing identity evidence',async f=>{f.d.identitySectionId='missing';await f.repin();},/identity supporting/],
 ['invented anchor',async f=>{f.d.fragments[1].anchor='invented';await f.repin();},/anchor/],
 ['overlapping ranges',async f=>{f.d.fragments[1].parts.push(f.d.fragments[1].parts[0]);await f.repin();},/range/],
 ['out-of-bounds range',async f=>{f.d.fragments[1].parts[0].endCharacter=99999;await f.repin();},/range/],
 ['renderer drift',async f=>{f.d.runtime={...runtime,chromeSha256:'0'.repeat(64)};await f.repin();},/renderer runtime/],
 ['unlisted wrapper URL',async f=>{const v=css+'@font-face{src:url(https://example.org/no-font)}';await writeFile(join(f.root,'wrapper.css'),v);f.d.wrapper.sha256=h(v);await f.repin();},/unapproved layout wrapper|unpinned dependency/],
 ['symlinked source',async f=>{await rm(join(f.root,'source.raw'));await symlink(join(f.root,'source.txt'),join(f.root,'source.raw'));},/symlink/]
]) test(`rejects ${name}`,async t=>{const f=await fixture(t);await change(f);await assert.rejects(loadHtmlEvidence(f.root,f.config),pattern);});
test('font dependency bytes are pinned even when caller updates descriptor pin',async t=>{const f=await fixture(t);await writeFile(join(f.root,'font.bin'),'font-original');f.d.dependencies=[{path:'font.bin',sha256:h('font-original'),url:'https://example.org/font.woff2',mimeType:'font/woff2'}];const fontCss=originalHtmlLayoutCss(f.d.dependencies);await writeFile(join(f.root,'wrapper.css'),fontCss);f.d.wrapper.sha256=h(fontCss);await f.repin();await loadHtmlEvidence(f.root,f.config);await writeFile(join(f.root,'font.bin'),'font-changed');await assert.rejects(loadHtmlEvidence(f.root,f.config),/fingerprint/);});
test('snapshot copies dependencies into a fresh attempt and pins rewritten descriptor',async t=>{const f=await fixture(t),attempt=join(f.root,'attempt');await mkdir(attempt);await copyFile(join(f.root,'source.raw'),join(attempt,'source.raw'));await copyFile(join(f.root,'source.txt'),join(attempt,'source.txt'));const config=await snapshotHtmlEvidence({attempt,config:{...f.config,htmlVisuals:undefined},bundlePath:join(f.root,'descriptor.json'),expectedSha256:f.config.htmlVisuals.sha256,helperPath:join(repo,'scripts/lib/html-original-evidence.mjs')});const p=await loadHtmlEvidence(attempt,config);assert.equal(p.descriptor.wrapper.path,`html-source/${h(css)}.bin`);assert.equal(config.htmlVisuals.inputSha256,f.config.htmlVisuals.sha256);});

async function bundleFixture(f, rendered){
 const prepared=JSON.stringify(rendered.records.map(item=>({...item,path:item.path.slice(f.root.length+1)})));await writeFile(join(f.root,'prepared.json'),prepared);f.config.htmlVisuals.prepared={path:'prepared.json',sha256:h(prepared)};await writeFile(join(f.root,'source-config.json'),JSON.stringify(f.config));
 const report=structuredClone(base);report.paperId='fixture';report.reportStatus='resource-reviewed';report.resourceType='technical-resource';report.coverage.scope='resource-overview';report.coverage.omissions=[];report.relatedPaperIds=[];report.sources=[{id:'primary',url:f.manifest.canonicalUrl,title:f.manifest.observedTitle,kind:'html',sha256:f.manifest.sha256,wordCount:8,accessedAt:f.manifest.accessedAt}];
 const edition=structuredClone(originalEdition);edition.paperId='fixture';const loc=htmlLocator(f.d.fragments[1],f.config.htmlVisuals.sha256,f.d);const image=rendered.records.find(x=>x.id==='figure');
 edition.visuals=[{...edition.visuals[0],id:'figure',asset:'report-assets/fixture/figure.png',sourceLabel:'Figure 1',sourceSha256:f.manifest.sha256,sourceUrl:f.manifest.canonicalUrl+'#fig-1',width:image.width,height:image.height,htmlSource:loc,sourceRendering:f.d.wrapperDisclosure}];delete edition.visuals[0].page;delete edition.visuals[0].crop;
 edition.visualLimitations={kind:'analysis',text:'A synthetic fixture with one diagram, not a scientific paper or review.',evidenceIds:[report.evidence[0].id]};edition.visualAudit={inspectedSections:['identity'],htmlEvidence:Object.fromEntries(report.evidence.map(e=>[e.id,['identity']])),notes:'Synthetic fixture only; these mappings exercise shape checks, not actual science.'};
 const metadata={title:'Fixture title',authors:'Fixture author',sourceSha256:f.manifest.sha256,location:'identity'};
 const receipt={schemaVersion:1,paperId:'fixture',outcome:'illustrated',reason:'Synthetic test only.',evidenceIds:[report.evidence[0].id],baseReportPath:'report.json',editionPath:'edition.json',metadataPath:'metadata.json'};
 await mkdir(join(f.root,'assets'));await copyFile(image.path,join(f.root,'assets/figure.png'));
 for(const [n,v] of Object.entries({'report.json':report,'edition.json':edition,'metadata.json':metadata,'receipt.json':receipt})) await writeFile(join(f.root,n),JSON.stringify(v));
 await writeFile(join(f.root,'source-audit.jsonl'),[{operation:'read',chunk:1,sha256:f.config.chunks[0].sha256},...rendered.records.map(r=>({operation:'html-delivery',id:r.id,descriptorSha256:f.config.htmlVisuals.sha256}))].map(x=>JSON.stringify(x)).join('\n'));
 const context={paper:{id:'fixture'},paperIds:new Set(['fixture']),manifest:f.manifest,config:f.config,classification:report.taxonomy.recordedClassification,generatedAt:report.generatedAt};
 return {attempt:f.root,context,report,edition,metadata,receipt};
}
test('real offline synthetic SVG render, independent rerender, receipt rejection and final asset checks',async t=>{
 const f=await fixture(t);const first=await renderHtmlEvidence({root:f.root,config:f.config,ids:['identity','figure'],outputDirectory:join(f.root,'first')});
 const second=await renderHtmlEvidence({root:f.root,config:f.config,ids:['identity','figure'],outputDirectory:join(f.root,'second')});
 assert.deepEqual(first.records.map(x=>x.sha256),second.records.map(x=>x.sha256),'fresh rerenders must match pixels');
 const b=await bundleFixture(f,first);validateIllustratedReport(b.edition,b.report);
 const noEvidence=structuredClone(b.edition);delete noEvidence.visualAudit.htmlEvidence[b.report.evidence[0].id];assert.throws(()=>validateIllustratedReport(noEvidence,b.report),/every HTML evidence/);
 const inventedPage=structuredClone(b.edition);inventedPage.visuals[0].page=1;assert.throws(()=>validateIllustratedReport(inventedPage,b.report),/no PDF page/);
 const wrongSource=structuredClone(b.report);wrongSource.sources[0].kind='pdf';assert.throws(()=>validateIllustratedReport(b.edition,wrongSource),/PDF page/);
 let packets=0;
 const reviewImages=async packet=>{
  packets++;assert.deepEqual(packet.images.map(i=>i.kind),['source-html-section','html-original-figure']);assert.ok(packet.images.every(i=>i.path.includes('html-verification-')));
  const context={paperId:'fixture',sourceSha256:f.manifest.sha256,images:packet.images};
  const receipt={schemaVersion:1,paperId:'fixture',sourceSha256:f.manifest.sha256,approved:true,identityMatches:true,identityNotes:'SIMULATED protocol gate fixture; not a real scientific or visual approval.',images:packet.images.map(i=>({imageId:i.imageId,sha256:i.sha256,legible:true,matchesDescription:true,claimsSupported:true,observedDetail:'SIMULATED return for validator branch coverage, not human/model observation.'}))};
  assert.equal(validateVisualReview(receipt,context),true);
  const schema=visualReviewSchemaForContext(context,template);assert.deepEqual(schema.properties.paperId.enum,['fixture']);assert.equal(schema.properties.approved.type,'boolean');
  for(const mutation of [r=>r.approved=false,r=>r.identityMatches=false,r=>r.paperId='other',r=>r.sourceSha256='0'.repeat(64),r=>r.images.pop(),r=>r.images.push(r.images[0]),r=>r.images[1].imageId=r.images[0].imageId,r=>r.images[0].sha256=r.images[1].sha256]){const bad=structuredClone(receipt);mutation(bad);assert.throws(()=>validateVisualReview(bad,context),/reviewer rejected/);}
  for(const i of [0,1]) for(const flag of ['legible','matchesDescription','claimsSupported']) {const bad=structuredClone(receipt);bad.images[i][flag]=false;assert.throws(()=>validateVisualReview(bad,context),/reviewer rejected/);}
  return true;
 };
 const result=await validateBundle({...b,reviewImages});assert.equal(result.assets.length,1);assert.equal(packets,1);
 await assert.rejects(validateBundle({...b,reviewImages:async()=>false}),/did not approve/);
 await writeFile(join(f.root,'assets/figure.png'),await readFile(first.records[0].path));await assert.rejects(validateBundle({...b,reviewImages}),/pixels differ/);assert.equal(packets,1,'tampered PNG must fail before reviewer');
});
test('real renderer rejects missing visible labels and unexpected source scripts before approval',async t=>{const f=await fixture(t);f.d.fragments[1].requiredText.push('invented missing label');await f.repin();await assert.rejects(renderHtmlEvidence({root:f.root,config:f.config,ids:['figure'],outputDirectory:join(f.root,'bad-label')}),/missing source labels/);});

test('snapshot recovery requires the same explicit descriptor and rejects rewritten snapshot pins',async t=>{
 const f=await fixture(t),attempt=join(f.root,'attempt');await mkdir(attempt);await copyFile(join(f.root,'source.raw'),join(attempt,'source.raw'));await copyFile(join(f.root,'source.txt'),join(attempt,'source.txt'));
 const config=await snapshotHtmlEvidence({attempt,config:{...f.config,htmlVisuals:undefined},bundlePath:join(f.root,'descriptor.json'),expectedSha256:f.config.htmlVisuals.sha256,helperPath:join(repo,'scripts/lib/html-original-evidence.mjs')});
 await verifyHtmlInputPin({attempt,config,bundlePath:join(f.root,'descriptor.json'),expectedSha256:f.config.htmlVisuals.sha256});await assert.rejects(verifyHtmlInputPin({attempt,config}),/explicit original descriptor/);
 const d=JSON.parse(await readFile(join(attempt,config.htmlVisuals.path)));d.fragments[1].requiredText=['fake'];const changed=JSON.stringify(d);await writeFile(join(attempt,config.htmlVisuals.path),changed);config.htmlVisuals.sha256=h(changed);
 await assert.rejects(verifyHtmlInputPin({attempt,config,bundlePath:join(f.root,'descriptor.json'),expectedSha256:f.config.htmlVisuals.sha256}),/snapshot descriptor differs/);
});
test('active source scripts and unsupported image resources fail source validation',async t=>{
 const f=await fixture(t);for(const bad of ['<script>alert(1)</script>','<img src="https://example.org/x">','<svg><use href="https://example.org/x"></use></svg>']){
  const value=title+bad;await writeFile(join(f.root,'source.raw'),value);f.manifest.sha256=f.d.sourceSha256=h(value);f.d.fragments[1].parts=[{startCharacter:Array.from(title).length,endCharacter:Array.from(value).length,sha256:h(bad)}];f.d.fragments[1].anchor=null;await f.repin();
  await assert.rejects(loadHtmlEvidence(f.root,f.config),/active or external|external SVG/);
 }
});
test('render output cannot follow a symlink or overwrite a previous render directory',async t=>{
 const f=await fixture(t);await mkdir(join(f.root,'outside'));await symlink(join(f.root,'outside'),join(f.root,'alias'));await assert.rejects(renderHtmlEvidence({root:f.root,config:f.config,ids:['figure'],outputDirectory:join(f.root,'alias','new')}),/symlink render output/);await assert.rejects(readFile(join(f.root,'outside','new')),/ENOENT/);
 await assert.rejects(renderHtmlEvidence({root:f.root,config:f.config,ids:['figure'],outputDirectory:join(f.root,'outside')}),/EEXIST/);
});
test('private synthetic coordinator follows fresh HTML reviewer schema and normal publisher/index path',async t=>{
 const f=await fixture(t),r=join(f.root,'repo'),w=join(f.root,'work'),control=join(f.root,'control');await mkdir(r);await mkdir(control);
 for(const n of ['scripts/lib','scripts/reading/run-illustrated.mjs','scripts/reading/illustrated-source.py','src/lib/classification-snapshot.mjs','src/lib/taxonomy.mjs','schemas','skills/wam-paper-reader']){await mkdir(dirname(join(r,n)),{recursive:true});await cp(join(repo,n),join(r,n),{recursive:true});}
 const paper=(JSON.parse(await readFile(join(repo,'data/papers.json')))).find(x=>x.id==='2608.08839');paper.id='fixture';
 const put=async(n,v)=>{await mkdir(dirname(n),{recursive:true});await writeFile(n,JSON.stringify(v));};
 await put(join(r,'data/papers.json'),[paper]);await put(join(r,'data/meta.json'),{updatedAt:'2026-09-08T00:00:00.000Z'});await put(join(r,'data/report-pilot.json'),{state:'approved',approvedAt:'2026-09-08T00:00:00.000Z',paperIds:Array.from({length:10},(_,n)=>'pilot-'+n)});await put(join(r,'data/illustrated-report-metadata.json'),{});
 const source=join(w,'sources/fixture');await mkdir(source,{recursive:true});await copyFile(join(f.root,'source.raw'),join(source,'source.raw'));await copyFile(join(f.root,'source.txt'),join(source,'source.txt'));await put(join(source,'manifest.json'),{...f.manifest,sourcePath:join(source,'source.raw'),textPath:join(source,'source.txt')});
 await put(join(control,'base.json'),base);await put(join(control,'edition.json'),originalEdition);
 const fake=join(control,'fake-worker.mjs');await writeFile(fake,`#!${process.execPath}
import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import path from 'node:path';
const control=process.env.HTML_FIXTURE_CONTROL;let prompt='';for await(const chunk of process.stdin)prompt+=chunk;
let review;try{review=JSON.parse(await fs.readFile('review-context.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(review){
 await fs.appendFile(path.join(control,'calls.txt'),'review\\n');await fs.writeFile(path.join(control,'review-context.json'),JSON.stringify(review));await fs.copyFile(process.argv[process.argv.indexOf('--output-schema')+1],path.join(control,'review-schema.json'));
 await fs.writeFile('receipt.json',JSON.stringify({schemaVersion:1,paperId:review.paperId,sourceSha256:review.sourceSha256,approved:true,identityMatches:true,identityNotes:'SIMULATED fixture response only, not scientific or visual approval.',images:review.images.map(i=>({imageId:i.imageId,sha256:i.sha256,legible:true,matchesDescription:true,claimsSupported:true,observedDetail:'SIMULATED validator fixture, not a real independent reading.'}))}));process.exit(0);
}
await fs.appendFile(path.join(control,'calls.txt'),'writer\\n');const c=JSON.parse(await fs.readFile('context.json'));for(let n=1;n<=c.config.chunks.length;n++)execFileSync(c.config.python,['source-tool.py','read',String(n)]);
const rendered=JSON.parse(execFileSync(process.execPath,['source-html.mjs','--root','.','--show','identity,figure'],{encoding:'utf8'}));const image=rendered.records.find(i=>i.id==='figure');await fs.mkdir('assets');await fs.copyFile(image.path,'assets/figure.png');
const r=JSON.parse(await fs.readFile(path.join(control,'base.json')));r.paperId=c.paper.id;r.generatedAt=c.generatedAt;r.reportStatus='resource-reviewed';r.resourceType='technical-resource';r.sources=[c.primary];r.coverage.scope='resource-overview';r.coverage.omissions=c.manifest.omissions;r.relatedPaperIds=[];r.taxonomy.recordedClassification=c.classification;
const e=JSON.parse(await fs.readFile(path.join(control,'edition.json')));e.paperId=c.paper.id;e.visuals=[{...e.visuals[0],id:'figure',asset:'report-assets/fixture/figure.png',sourceLabel:'Figure 1',sourceSha256:c.manifest.sha256,sourceUrl:c.manifest.canonicalUrl+'#fig-1',width:image.width,height:image.height,htmlSource:image.locator,sourceRendering:rendered.descriptor.wrapperDisclosure}];delete e.visuals[0].page;delete e.visuals[0].crop;e.visualLimitations={kind:'analysis',text:'Synthetic isolated integration fixture only; not scientific approval.',evidenceIds:[r.evidence[0].id]};e.visualAudit={inspectedSections:['identity'],htmlEvidence:Object.fromEntries(r.evidence.map(x=>[x.id,['identity']])),notes:'Simulated evidence map for a private integration fixture only.'};
for(const [n,v] of Object.entries({'report.json':r,'edition.json':e,'metadata.json':{title:c.manifest.observedTitle,authors:'Fixture author',sourceSha256:c.manifest.sha256,location:'identity'},'receipt.json':{schemaVersion:1,paperId:c.paper.id,outcome:'illustrated',reason:'Synthetic isolated integration fixture only.',evidenceIds:[r.evidence[0].id],baseReportPath:'report.json',editionPath:'edition.json',metadataPath:'metadata.json'}}))await fs.writeFile(n,JSON.stringify(v));
`);await chmod(fake,0o755);
 await execute(process.execPath,[join(r,'scripts/reading/run-illustrated.mjs'),'--work-dir',w,'--ids','fixture','--concurrency','1','--html-visual-bundle',join(f.root,'descriptor.json'),'--html-visual-sha256',f.config.htmlVisuals.sha256],{env:{...process.env,CODEX_BIN:fake,HTML_FIXTURE_CONTROL:control},timeout:60_000});
 const status=JSON.parse(await readFile(join(w,'illustrated-runs/fixture/status.json')));assert.equal(status.state,'complete');assert.equal(status.validationRepairs,0);assert.equal(await readFile(join(control,'calls.txt'),'utf8'),'writer\nreview\n');
 const review=JSON.parse(await readFile(join(control,'review-context.json'))),schema=JSON.parse(await readFile(join(control,'review-schema.json')));assert.equal(review.policy.version,'wam-original-html-evidence-v1');assert.equal(review.sourceKind,'html');assert.equal(digest(await readFile(join(status.visualReviewPath,'html-render-descriptor.json'))),review.htmlRendering.descriptorSha256);assert.match(review.htmlRendering.rendererCodeSha256,/^[a-f0-9]{64}$/);assert.deepEqual(review.images.map(i=>i.reviewRole),['supporting-html-section','selected-original-html-figure']);assert.deepEqual(schema.properties.paperId.enum,['fixture']);assert.deepEqual(schema.properties.sourceSha256.enum,[f.manifest.sha256]);assert.deepEqual(schema.properties.images.items.properties.imageId.enum,review.images.map(i=>i.imageId));assert.deepEqual(schema.properties.images.items.properties.sha256.enum,[...new Set(review.images.map(i=>i.sha256))]);
 assert.ok(status.files.some(i=>i.path==='data/illustrated-reports/fixture.json'));assert.equal(JSON.parse(await readFile(join(r,'data/reading-index.json'))).entries[0].readingStatus,'resource');await assert.rejects(readFile(join(w,'illustrated-runs/illustrated.lock')),/ENOENT/);
});
test('an external HTML descriptor requires its separately supplied reviewed hash before snapshot writes',async t=>{
 const f=await fixture(t),attempt=join(f.root,'attempt');await mkdir(attempt);
 for(const expectedSha256 of [undefined,'0'.repeat(64)]) await assert.rejects(snapshotHtmlEvidence({attempt,config:f.config,bundlePath:join(f.root,'descriptor.json'),expectedSha256,helperPath:join(repo,'scripts/lib/html-original-evidence.mjs')}),/explicit SHA256/);
 await assert.rejects(readFile(join(attempt,'html-source/descriptor.json')),/ENOENT/);
});
test('a repinned arbitrary stylesheet cannot alter original chart geometry',async t=>{
 const f=await fixture(t),bad=css+'svg rect{height:1px}';await writeFile(join(f.root,'wrapper.css'),bad);f.d.wrapper.sha256=h(bad);await f.repin();await assert.rejects(loadHtmlEvidence(f.root,f.config),/unapproved layout wrapper/);
});
test('coordinator-prepared images can be delivered without a renderer invocation and tampering fails',async t=>{
 const f=await fixture(t),attempt=join(f.root,'attempt');await mkdir(attempt);await copyFile(join(f.root,'source.raw'),join(attempt,'source.raw'));await copyFile(join(f.root,'source.txt'),join(attempt,'source.txt'));
 const config=await snapshotHtmlEvidence({attempt,config:{...f.config,htmlVisuals:undefined},bundlePath:join(f.root,'descriptor.json'),expectedSha256:f.config.htmlVisuals.sha256,helperPath:join(repo,'scripts/lib/html-original-evidence.mjs')});
 const delivered=await preparedHtmlImages(attempt,config,['figure']);assert.equal(delivered.records.length,1);assert.equal(delivered.records[0].id,'figure');
 await writeFile(delivered.records[0].path,'changed PNG');await assert.rejects(preparedHtmlImages(attempt,config,['figure']),/fingerprint/);
});
test('a stop request aborts HTML preparation before browser launch or output creation',async t=>{
 const f=await fixture(t);await assert.rejects(renderHtmlEvidence({root:f.root,config:f.config,ids:['figure'],outputDirectory:join(f.root,'stopped'),shouldStop:()=>true}),/interrupted/);await assert.rejects(readFile(join(f.root,'stopped')),/ENOENT/);
});

test('a changed trusted renderer code pin is rejected before rendering',async t=>{const f=await fixture(t);f.config.htmlVisuals.rendererCodeSha256='0'.repeat(64);await assert.rejects(loadHtmlEvidence(f.root,f.config),/renderer code changed/);});

test('each fragment renders identically when MathML and SVG source sections are visited in a different order',async t=>{
 const f=await fixture(t),math='<section id="math"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math></section>',raw=title+math+figure;
 await writeFile(join(f.root,'source.raw'),raw);f.manifest.sha256=f.d.sourceSha256=h(raw);
 f.d.fragments[1].parts=[{startCharacter:Array.from(title+math).length,endCharacter:Array.from(raw).length,sha256:h(figure)}];
 f.d.fragments.push({id:'math',role:'supporting-section',anchor:'math',sourceLabel:'Original equation fixture',parts:[{startCharacter:Array.from(title).length,endCharacter:Array.from(title+math).length,sha256:h(math)}],requiredText:['𝑥'],visibleTextSha256:h('𝑥')});await f.repin();
 const all=await renderHtmlEvidence({root:f.root,config:f.config,ids:['identity','math','figure'],outputDirectory:join(f.root,'all-order')});
 const reversed=await renderHtmlEvidence({root:f.root,config:f.config,ids:['figure','math','identity'],outputDirectory:join(f.root,'reverse-order')});
 assert.deepEqual(Object.fromEntries(all.records.map(i=>[i.id,i.sha256])),Object.fromEntries(reversed.records.map(i=>[i.id,i.sha256])));
});


test('an explicitly supplied HTML visual bundle cannot downgrade a rendering failure to unavailable',async t=>{
 const f=await fixture(t);const rendered=await renderHtmlEvidence({root:f.root,config:f.config,ids:['identity','figure'],outputDirectory:join(f.root,'prepared-unavailable')});
 const b=await bundleFixture(f,rendered);await rm(join(f.root,'edition.json'));b.receipt.outcome='illustration-unavailable';b.receipt.editionPath=null;b.receipt.reason='Pretended rendering limitation';await writeFile(join(f.root,'receipt.json'),JSON.stringify(b.receipt));
 await assert.rejects(validateBundle({...b,reviewImages:async()=>true}),/not an unavailable shortcut/);
});
