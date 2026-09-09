// Private candidate: fail-closed child process budget and observed native closure.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat,realpath,readFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
const exec=promisify(execFile);
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const requireValue=(ok,message)=>{if(!ok)throw Error('OpenScene: '+message);};
export async function hashFile(path,maxBytes=2_000_000_000){
 const s=await lstat(path);requireValue(isAbsolute(path)&&await realpath(path)===path&&s.isFile()&&!s.isSymbolicLink()&&s.size<=maxBytes,'unsafe/unbounded runtime file');
 const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');
}
export async function verifyRuntimePins(items){
 requireValue(Array.isArray(items)&&items.length>0&&items.length<20000,'runtime file inventory');const paths=new Set();
 for(const pin of items){requireValue(!paths.has(pin.path)&&/^[a-f0-9]{64}$/.test(pin.sha256),'runtime pin duplicate/hash');paths.add(pin.path);requireValue(await hashFile(pin.path)===pin.sha256,'runtime fingerprint changed: '+pin.path);}
}
export function safeEnvironment(){
 const out={...process.env};for(const name of Object.keys(out))if(/^(?:DYLD_|LD_|PYTHON|NODE_OPTIONS$|NODE_PATH$)/.test(name))delete out[name];
 return {...out,PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1'};
}
export async function processRows(){
 const {stdout}=await exec('/bin/ps',['-axo','pid=,ppid=,pgid=,rss=,lstart=,command='],{timeout:2000,maxBuffer:8_000_000});
 const rows=stdout.trim().split('\n').map(line=>line.trim().split(/\s+/)).filter(p=>p.length>=10&&p.slice(0,4).every(x=>/^\d+$/.test(x))).map(p=>({pid:Number(p[0]),ppid:Number(p[1]),pgid:Number(p[2]),rssBytes:Number(p[3])*1024,startedAt:p.slice(4,9).join(' '),command:p.slice(9).join(' ')}));
 requireValue(rows.length>0,'cannot enforce process RSS: empty ps');return rows;
}
export function descendants(rows,pid){
 const ids=new Set([pid]);let changed=true;while(changed){changed=false;for(const r of rows)if(ids.has(r.ppid)&&!ids.has(r.pid)){ids.add(r.pid);changed=true;}}
 return rows.filter(r=>ids.has(r.pid));
}
export async function runBounded(executable,args,{input,cwd,timeoutMs=60000,maxRssBytes=768_000_000,maxOutputBytes=8_000_000,shouldStop=()=>false}={}){
 requireValue(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000&&Number.isInteger(maxRssBytes)&&maxRssBytes>0&&maxRssBytes<=2_000_000_000&&Number.isInteger(maxOutputBytes)&&maxOutputBytes>0&&maxOutputBytes<=20_000_000,'unbounded process policy');
 if(shouldStop())throw Error('OpenScene: interrupted before child');const preexisting=new Set((await processRows()).map(row=>row.pid)); // Lack of enforcement is refusal, never a warning.
 const started=Date.now(),child=spawn(executable,args,{cwd,env:safeEnvironment(),detached:true,stdio:['pipe','pipe','pipe']});
 let bytes=0,out=[],err=[],peak=0,samples=0,failure=null,checking=Promise.resolve(),closed=false;const observed=new Map();
 const kill=()=>{if(closed)return;try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')failure ||= error;}};
 const fail=e=>{failure ||= e instanceof Error?e:Error(e);kill();};
 const poll=()=>checking=checking.then(async()=>{if(closed)return;if(shouldStop()||Date.now()-started>timeoutMs)return fail('OpenScene: process interrupted or deadline');try{const tree=descendants(await processRows(),child.pid);for(const row of tree)observed.set(row.pid,{startedAt:row.startedAt,command:row.command});if(tree.length){samples++;const rss=tree.reduce((sum,r)=>sum+r.rssBytes,0);peak=Math.max(peak,rss);if(rss>maxRssBytes)fail('OpenScene: child-tree RSS budget exceeded');}}catch(e){fail(e);}});
 child.stdout.on('data',b=>{bytes+=b.length;if(bytes>maxOutputBytes)fail('OpenScene: child output budget');else out.push(b);});child.stderr.on('data',b=>{bytes+=b.length;if(bytes>maxOutputBytes)fail('OpenScene: child output budget');else err.push(b);});
 child.stdin.on('error',()=>{});child.stdin.end(typeof input==='string'?input:JSON.stringify(input??{}));
 const timer=setInterval(poll,75),wall=setTimeout(()=>fail('OpenScene: child wall-clock budget exceeded'),timeoutMs);poll();
 const result=await new Promise(resolve=>{child.on('error',e=>{failure ||= e;resolve({code:null});});child.on('close',(code,signal)=>resolve({code,signal}));});
 closed=true;await checking;
 // A successful root exit is not a successful bounded job if it left children.
 // Same-group orphans remain identifiable after reparenting; separate groups
 // are covered when observed during this trusted job's execution.
 const remainingOwned=async()=> (await processRows()).filter(row=>row.pid!==child.pid&&!preexisting.has(row.pid)&&(row.pgid===child.pid||(observed.has(row.pid)&&observed.get(row.pid).startedAt===row.startedAt&&observed.get(row.pid).command===row.command)));
 let cleanupConfirmed=false;
 try{
  let residual=await remainingOwned();
  if(residual.length){
   failure ||= Error('OpenScene: root exited with residual owned descendants');
   const cleanupDeadline=Date.now()+3000;
   do{
    // Re-inspect identities before every signal; never kill pre-existing processes.
    for(const row of residual){try{process.kill(row.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}}
    await new Promise(resolve=>setTimeout(resolve,25));
    residual=await remainingOwned();
   }while(residual.length&&Date.now()<cleanupDeadline);
   requireValue(residual.length===0,'owned descendant cleanup could not be confirmed');
  }
  cleanupConfirmed=true;
 }catch(error){if(failure)failure=new Error(failure.message+'; '+error.message);else failure=error;}
 finally{clearInterval(timer);clearTimeout(wall);}
 if(failure)throw failure;requireValue(result.code===0,'child failed: '+Buffer.concat(err).toString().slice(0,3000));requireValue(samples>0,'RSS enforcement had no live child sample');
 return {stdout:Buffer.concat(out).toString(),execution:{pid:child.pid,exitCode:result.code,elapsedMs:Date.now()-started,rssSamples:samples,peakRssBytes:peak,rssLimitBytes:maxRssBytes,timeoutMs,processGroupOwned:true,ownedTreeExitConfirmed:cleanupConfirmed}};
}
export async function mappedNativeFiles(pid){
 requireValue(Number.isInteger(pid)&&pid>1,'native mapping PID');
 const {stdout}=await exec('/usr/bin/vmmap',['-w',String(pid)],{timeout:15000,maxBuffer:20_000_000});
 const paths=[...new Set(stdout.split('\n').flatMap(line=>{if(!/^__TEXT\s/.test(line))return [];const i=line.indexOf(' /');return i<0?[]:[line.slice(i+1).trim()];}))].sort();
 requireValue(paths.some(p=>p.includes('Google Chrome Framework.framework')),'actual Chrome native mappings unavailable');
 return {paths,rawSha256:hash(stdout)};
}
