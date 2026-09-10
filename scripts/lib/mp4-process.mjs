// Only this module mints process-completion capabilities, from its own child close.
// Serialized proof is historical evidence; downstream requires a separate root pin.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import {readFile,writeFile,lstat,realpath,mkdir} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hostname} from 'node:os';
import {processRows,descendants,safeEnvironment,hashFile} from './openscene-process.mjs';
import {need,same,exact,hex,hash,bytes,mp4SourcePins} from './mp4-contract.mjs';
export const MP4_CODEX='/Applications/ChatGPT.app/Contents/Resources/codex';
const sessions=new WeakMap(),completions=new WeakMap();
const execute=promisify(execFile);
export async function actualMcpNames(python){const {stdout}=await execute(python,['-c','import json,os,pathlib,tomllib; p=pathlib.Path(os.environ.get("CODEX_HOME",str(pathlib.Path.home()/".codex")))/"config.toml"; d=tomllib.loads(p.read_text()) if p.exists() else {}; print(json.dumps(sorted(d.get("mcp_servers",{}))))'],{env:safeEnvironment(),timeout:5000,maxBuffer:100000});return JSON.parse(stdout);}
export function mp4CodexArgs(runtime,directory,role,imagePaths){
 const args=['exec','--ephemeral','--sandbox',role==='reviewer'?'read-only':'workspace-write','--skip-git-repo-check','--cd',directory,'--json','--output-schema',join(directory,'receipt.schema.json'),'--output-last-message',join(directory,'receipt.json'),'-c','approval_policy="never"','-c','web_search="disabled"','-c','sandbox_workspace_write.network_access=false','-c','sandbox_workspace_write.writable_roots=[]','-c','sandbox_workspace_write.exclude_tmpdir_env_var=true','-c','sandbox_workspace_write.exclude_slash_tmp=true'];
 for(const f of ['apps','browser_use','browser_use_external','computer_use','in_app_browser','plugins','remote_plugin','hooks','multi_agent','image_generation'])args.push('--disable',f);
 for(const n of runtime.mcpServerNames)args.push('-c',`mcp_servers.${n}.enabled=false`);for(const p of imagePaths)args.push('--image',p);args.push('-');return args;
}
export async function filePin(path){const s=await lstat(path);need(isAbsolute(path)&&await realpath(path)===path&&s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'unsafe proof/runtime input');return {path,sha256:await hashFile(path),bytes:s.size};}
export async function verifyPin(p,{allowEmpty=false}={}){exact(p,'path sha256 bytes','pin fields');need(hex(p.sha256)&&Number.isSafeInteger(p.bytes)&&p.bytes>=(allowEmpty?0:1),'pin values');same(await filePin(p.path),p,'input changed: '+p.path);return p;}
export async function checkPins(pins){need(Array.isArray(pins)&&new Set(pins.map(x=>x.path)).size===pins.length,'duplicate pins');for(const p of pins)await verifyPin(p);}
export function assertQuiescentRows(rows,ownPid=process.pid){
 const ancestors=new Set([ownPid]);let n=ownPid;for(;;){const r=rows.find(x=>x.pid===n);if(!r||!r.ppid||ancestors.has(r.ppid))break;ancestors.add(r.ppid);n=r.ppid;}
 const live=rows.filter(r=>!ancestors.has(r.pid)&&/(run-illustrated|illustrated-coordinator|audit-accepted-illustrated|stage-accepted-illustrated|build-staged-illustrated|accepted-correction|codex\s+exec)/.test(r.command));
 need(live.length===0,'global reading/review/helper processes are not naturally quiet');return true;
}
const requiredCodePaths=JSON.parse(await readFile(new URL('./mp4-runtime-paths.json',import.meta.url),'utf8'));
export function validateMp4CodeMap(m){exact(m,'schemaVersion files','code map fields');need(m.schemaVersion===1&&Array.isArray(m.files),'code map shape');for(const x of m.files){exact(x,'location path sha256 bytes','code map entry');need(hex(x.sha256)&&Number.isSafeInteger(x.bytes)&&x.bytes>0,'code map entry pin');}same(m.files.map(x=>x.location+':'+x.path).sort(),requiredCodePaths,'exact complete runtime path inventory required');return true;}
export async function createMp4Session({approvalPin,repository,workDir,expectedCodeMapSha256}){
 await verifyPin(approvalPin);const a=JSON.parse(await readFile(approvalPin.path,'utf8'));
 exact(a,'schemaVersion kind domain paperId repository workDir approvedAt expiresAt codeMapSha256 runtime sourceDescriptorPin nativeProofPin nativeRootRecordPin priorStatusPin priorHistoryPins priorPublicationPins sourcePins','execution approval fields');
 need(a.schemaVersion===1&&a.kind==='root-approved-mp4-integration-execution-v1'&&a.domain==='production'&&a.paperId==='ref-23e2ef710ce5722e25a2','explicit source-specific root authorization required');
 need(a.repository===repository&&a.workDir===workDir&&await realpath(repository)===repository&&await realpath(workDir)===workDir,'approval root substitution');
 need(Number.isFinite(Date.parse(a.approvedAt))&&Date.parse(a.approvedAt)<=Date.now()&&Date.parse(a.expiresAt)>Date.now(),'expired or future authorization');
 need(a.codeMapSha256===expectedCodeMapSha256&&hex(expectedCodeMapSha256),'explicit code-map pin required');
 const mapPath=join(repository,'scripts/lib/mp4-runtime-map.json'),mapBytes=await readFile(mapPath);need(hash(mapBytes)===expectedCodeMapSha256,'runtime map changed');
 const m=JSON.parse(mapBytes);validateMp4CodeMap(m);
 const codePins=m.files.map(x=>{need(['repository','work'].includes(x.location)&&!isAbsolute(x.path)&&!x.path.split('/').includes('..'),'unsafe code-map entry');return {path:resolve(x.location==='repository'?repository:workDir,x.path),sha256:x.sha256,bytes:x.bytes};});
 need(codePins.some(p=>p.path===join(repository,'scripts/lib/mp4-process.mjs'))&&codePins.some(p=>p.path===join(workDir,'audit-accepted-illustrated.mjs')),'launcher/auditor missing from closure');
 await checkPins(codePins);const sourceDescriptor=JSON.parse(await readFile(a.sourceDescriptorPin.path,'utf8'));same(a.sourcePins,mp4SourcePins(sourceDescriptor,a.sourceDescriptorPin,workDir),'exact source pin inventory required');await checkPins(a.sourcePins);await checkPins(a.priorHistoryPins);await checkPins(a.priorPublicationPins);await verifyPin(a.priorStatusPin);await verifyPin(a.sourceDescriptorPin);await verifyPin(a.nativeProofPin);await verifyPin(a.nativeRootRecordPin);
 exact(a.runtime,'binary python mcpServerNames','runtime fields');need(a.runtime.binary.path===MP4_CODEX,'only approved normal Codex executable is permitted');await verifyPin(a.runtime.binary);await verifyPin(a.runtime.python);need(a.runtime.python.path===await realpath(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3')),'unapproved config parser runtime');
 need(Array.isArray(a.runtime.mcpServerNames)&&new Set(a.runtime.mcpServerNames).size===a.runtime.mcpServerNames.length&&a.runtime.mcpServerNames.every(s=>/^[A-Za-z0-9_-]+$/.test(s)),'MCP disable names');
 same(await actualMcpNames(a.runtime.python.path),a.runtime.mcpServerNames,'configured MCP names changed');
 const native=JSON.parse(await readFile(a.nativeProofPin.path,'utf8'));need(native.rootAttestation.recordSha256===a.nativeRootRecordPin.sha256,'native root attestation drift');
 const root=JSON.parse(await readFile(a.nativeRootRecordPin.path,'utf8'));need(root.kind==='root-observed-native-process'&&root.nativeJobId===native.execution.jobId&&root.sourceDescriptorSha256===a.sourceDescriptorPin.sha256&&root.actualExitCode===0,'native root attestation does not establish this job');
 await checkPins(native.runtimeFiles);
 const token=Object.freeze({});sessions.set(token,{a,approvalPin,repository,workDir,codePins,mapPin:await filePin(mapPath),jobIds:new Set(),children:new Set(),threads:new Set(),writer:null,interrupted:false});return token;
}
function internalSession(token){const s=sessions.get(token);need(s,'session is not coordinator-owned');return s;}
function immutable(value){if(value&&typeof value==='object'){for(const x of Object.values(value))immutable(x);Object.freeze(value);}return value;}
export function sessionData(token){const s=internalSession(token);return immutable(structuredClone({a:s.a,approvalPin:s.approvalPin,repository:s.repository,workDir:s.workDir,codePins:s.codePins,mapPin:s.mapPin,interrupted:s.interrupted}));}
export async function verifySession(token,{includePriorStatus=false}={}){const s=internalSession(token);need(!s.interrupted,'coordinator interrupted');await verifyPin(s.approvalPin);await verifyPin(s.mapPin);await checkPins(s.codePins);await checkPins(s.a.sourcePins);await checkPins(s.a.priorHistoryPins);await verifyPin(s.a.runtime.binary);await verifyPin(s.a.runtime.python);same(await actualMcpNames(s.a.runtime.python.path),s.a.runtime.mcpServerNames,'MCP config changed');await verifyPin(s.a.nativeProofPin);await verifyPin(s.a.nativeRootRecordPin);if(includePriorStatus)await verifyPin(s.a.priorStatusPin);same(JSON.parse(await readFile(s.approvalPin.path,'utf8')),s.a,'authorization state changed');return sessionData(token);}
export function interruptSession(token){const s=internalSession(token);s.interrupted=true;for(const child of s.children){try{process.kill(-child.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}}}
export function parseCodexReceipt(stdout,receipt,{review=false}={}){
 const rows=stdout.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
 need(rows.length>0&&!rows.some(x=>['error','turn.failed'].includes(x.type)||x.error),'failed or malformed event protocol');
 const threads=rows.filter(x=>x.type==='thread.started'),done=rows.filter(x=>x.type==='turn.completed');
 need(threads.length===1&&typeof threads[0].thread_id==='string'&&done.length===1&&rows.at(-1).type==='turn.completed','missing/ambiguous completed fresh turn');
 const completed=rows.filter(x=>x.type==='item.completed').map(x=>x.item);
 if(review)need(completed.every(i=>i?.type==='agent_message'||i?.type==='reasoning'),'reviewer invoked tools instead of direct attachments');
 const final=completed.filter(i=>i?.type==='agent_message');need(final.length>0&&(!review||final.length===1)&&typeof final.at(-1).text==='string','ambiguous final assistant message');
 same(JSON.parse(final.at(-1).text),receipt,'receipt file differs from captured final response');return {threadId:threads[0].thread_id,eventCount:rows.length};
}
export async function runMp4Child(token,{role,directory,prompt,imagePaths,inputPins,timeoutMs=2400000}){
 await verifySession(token);const s=internalSession(token);need(['writer','reviewer'].includes(role)&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=2400000,'invalid bounded role/deadline');
 need(isAbsolute(directory)&&await realpath(directory)===directory&&directory.startsWith(s.workDir+'/illustrated-runs/'+s.a.paperId+'/'),'unowned process directory');
 need(typeof prompt==='string'&&prompt.length>0&&prompt.length<500000&&new Set(imagePaths).size===imagePaths.length&&imagePaths.every(p=>p.startsWith(directory+'/')),'unsafe prompt/images');
 need(role!=='writer'||!s.writer,'one initial writer only');need(role!=='reviewer'||s.writer,'review must follow successful separate writer');
 for(const name of ['receipt.json','events.jsonl','stderr.log','process-proof.json']){try{await lstat(join(directory,name));throw Error('preexisting process output: '+name);}catch(e){if(e.code!=='ENOENT')throw e;}}
 await checkPins(inputPins);need(imagePaths.every(p=>inputPins.some(x=>x.path===p)),'unbound attachment argument');
 const schema=join(directory,'receipt.schema.json');need(inputPins.some(p=>p.path===schema),'schema is not pinned');
 const jobId=randomUUID();need(!s.jobIds.has(jobId),'reused process job');s.jobIds.add(jobId);
 const args=mp4CodexArgs(s.a.runtime,directory,role,imagePaths);
 const promptPath=join(directory,'prompt.txt');await writeFile(promptPath,prompt,{flag:'wx'});inputPins=[...inputPins,await filePin(promptPath)];
 const start=new Date().toISOString(),before=new Set((await processRows()).map(r=>r.pid)),env=safeEnvironment();
 await mkdir(join(directory,'tmp'),{recursive:false});Object.assign(env,{TMPDIR:join(directory,'tmp'),TMP:join(directory,'tmp'),TEMP:join(directory,'tmp')});
 const child=spawn(s.a.runtime.binary.path,args,{cwd:directory,env,detached:true,stdio:['pipe','pipe','pipe']});s.children.add(child);
 const out=[],err=[];let outputBytes=0,failure=null,closed=false,observations=new Map(),checks=Promise.resolve();
 const stop=e=>{failure ||= e instanceof Error?e:Error(e);if(!closed)try{process.kill(-child.pid,'SIGKILL');}catch(x){if(x.code!=='ESRCH')failure ||= x;}};
 const poll=()=>checks=checks.then(async()=>{if(closed)return;try{if(s.interrupted)return stop('interrupted');for(const r of descendants(await processRows(),child.pid))observations.set(r.pid,{startedAt:r.startedAt,command:r.command});}catch(e){stop(e);}});
 for(const [stream,target]of [[child.stdout,out],[child.stderr,err]]){stream.on('error',stop);stream.on('data',b=>{outputBytes+=b.length;if(outputBytes>30000000)stop('process output limit');else target.push(b);});}
 child.stdin.on('error',e=>{if(e.code!=='EPIPE')stop(e);});child.stdin.end(prompt);
 const timer=setTimeout(()=>stop('process deadline'),timeoutMs),interval=setInterval(poll,250);poll();
 const result=await new Promise(done=>{child.on('error',e=>{failure ||= e;done({code:null,signal:null});});child.on('close',(code,signal)=>done({code,signal}));});closed=true;clearTimeout(timer);clearInterval(interval);await checks;s.children.delete(child);
 const residual=(await processRows()).filter(r=>!before.has(r.pid)&&r.pid!==child.pid&&(r.pgid===child.pid||observations.get(r.pid)?.startedAt===r.startedAt&&observations.get(r.pid)?.command===r.command));
 if(residual.length){for(const r of residual)try{process.kill(r.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')failure ||= e;}failure ||= Error('owned descendant remained after root exit');}
 const stdout=Buffer.concat(out),stderr=Buffer.concat(err);await writeFile(join(directory,'events.jsonl'),stdout,{flag:'wx'});await writeFile(join(directory,'stderr.log'),stderr,{flag:'wx'});
 const proof={schemaVersion:1,kind:'coordinator-observed-mp4-codex-process-v1',domain:'production',jobId,role,coordinator:{pid:process.pid,hostname:hostname()},pid:child.pid??null,startedAt:start,completedAt:new Date().toISOString(),exitCode:result.code,signal:result.signal??null,interrupted:s.interrupted,error:failure?.message||null,ownedTreeExitConfirmed:residual.length===0,binary:s.a.runtime.binary,args,promptSha256:hash(prompt),inputPins,approvalSha256:s.approvalPin.sha256,codeMapSha256:s.mapPin.sha256,stdoutSha256:hash(stdout),stderrSha256:hash(stderr)};
 let receipt,protocol;
 try{need(!failure&&!s.interrupted&&result.code===0&&result.signal===null&&residual.length===0,'child did not cleanly complete');await checkPins(inputPins);await verifySession(token);receipt=JSON.parse(await readFile(join(directory,'receipt.json'),'utf8'));protocol=parseCodexReceipt(stdout.toString(),receipt,{review:role==='reviewer'});need(!s.threads.has(protocol.threadId),'reused model thread');need(role!=='reviewer'||child.pid!==s.writer.pid&&protocol.threadId!==s.writer.threadId,'writer cannot be independent reviewer');s.threads.add(protocol.threadId);Object.assign(proof,{...protocol,receiptSha256:(await filePin(join(directory,'receipt.json'))).sha256});}
 catch(e){proof.error ||= e.message;await writeFile(join(directory,'process-proof.json'),bytes(proof),{flag:'wx'});throw e;}
 await writeFile(join(directory,'process-proof.json'),bytes(proof),{flag:'wx'});
 const cap=Object.freeze({});completions.set(cap,{session:token,proof,proofPin:await filePin(join(directory,'process-proof.json')),receipt,used:false});if(role==='writer')s.writer={pid:child.pid,threadId:protocol.threadId,jobId};return cap;
}
export async function verifyMp4CompletionOutputs(c){await verifyPin(c.proofPin);const dir=c.proofPin.path.slice(0,-'/process-proof.json'.length);for(const [name,sha]of [['receipt.json',c.proof.receiptSha256],['events.jsonl',c.proof.stdoutSha256],['stderr.log',c.proof.stderrSha256]]){const p=await filePin(join(dir,name));need(p.sha256===sha,'completion output changed: '+name);await verifyPin(p,{allowEmpty:name==='stderr.log'});}same(JSON.parse(await readFile(join(dir,'receipt.json'),'utf8')),c.receipt,'completion receipt changed');}
export async function consumeMp4Completion(session,cap,role){const c=completions.get(cap);need(c&&c.session===session&&!c.used&&c.proof.role===role,'missing/forged/reused completion capability');await verifySession(session);await verifyMp4CompletionOutputs(c);await checkPins(c.proof.inputPins);c.used=true;return immutable(structuredClone({proof:c.proof,proofPin:c.proofPin,receipt:c.receipt}));}
