import {spawn} from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
const [prefix,command,...args]=process.argv.slice(2);if(!prefix||!command)throw Error('Usage: prefix command arguments');
const sources=[...new Set(['scripts/record-crossed-rack-command.mjs',...args.filter(a=>a.endsWith('.mjs')&&fs.existsSync(a))])].map((file,i)=>{
 const archive=`artifacts/review/${prefix}-command-source-${i}.txt`;fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const started=new Date(),tick=process.hrtime.bigint(),chunks=[],child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
child.stdout.on('data',b=>{chunks.push(b);process.stdout.write(b);});child.stderr.on('data',b=>{chunks.push(b);process.stderr.write(b);});
const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
fs.writeFileSync(`artifacts/review/${prefix}.log`,Buffer.concat(chunks),{flag:'wx'});
fs.writeFileSync(`artifacts/review/${prefix}-exit-status.json`,JSON.stringify({command,args,started:started.toISOString(),finished:new Date().toISOString(),
 seconds:Number(process.hrtime.bigint()-tick)/1e9,...result,sources},null,2)+'\n',{flag:'wx'});process.exitCode=result.code??1;
