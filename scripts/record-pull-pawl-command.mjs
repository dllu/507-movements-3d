import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [prefix,command,...args]=process.argv.slice(2);
if(!prefix||!command)throw Error('Usage: prefix command arguments');
const sources=[];
for(const file of ['scripts/record-pull-pawl-command.mjs','scripts/lib/pull-pawl-candidate.mjs',...args.filter(a=>a.endsWith('.mjs'))]){
 const bytes=await readFile(file),sha256=createHash('sha256').update(bytes).digest('hex'),archive=`artifacts/review/${prefix}-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,sha256,archive});
}
const started=new Date(),tick=process.hrtime.bigint(),child=spawn(command,args,{stdio:['ignore','pipe','pipe']}),chunks=[];
child.stdout.on('data',b=>{chunks.push(b);process.stdout.write(b);});child.stderr.on('data',b=>{chunks.push(b);process.stderr.write(b);});
const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
await writeFile(`artifacts/review/${prefix}.log`,Buffer.concat(chunks),{flag:'wx'});
await writeFile(`artifacts/review/${prefix}-exit-status.json`,JSON.stringify({command,args,started:started.toISOString(),finished:new Date().toISOString(),seconds:Number(process.hrtime.bigint()-tick)/1e9,...result,sources},null,2)+'\n',{flag:'wx'});
process.exitCode=result.code??1;
