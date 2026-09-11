import {open,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const [prefix,separator,command,...args]=process.argv.slice(2);
if(!prefix||separator!=='--'||!command)throw Error('Usage: node scripts/run-review-check.mjs OUTPUT_PREFIX -- COMMAND [ARGS...]');
const log=await open(prefix+'.log','wx'),started=new Date(),start=performance.now();
const child=spawn(command,args,{stdio:['ignore',log.fd,log.fd]});
const result=await new Promise(resolve=>{
 child.once('error',error=>resolve({code:null,signal:null,error:error.message}));
 child.once('close',(code,signal)=>resolve({code,signal}));
});
await log.close();
const status={...result,command:[command,...args],started:started.toISOString(),ended:new Date().toISOString(),durationSeconds:(performance.now()-start)/1000};
await writeFile(prefix+'-exit-status.json',JSON.stringify(status,null,2)+'\n');
console.log(status);process.exitCode=result.code??1;
