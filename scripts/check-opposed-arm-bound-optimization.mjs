import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {makeOpposedArmContactStudy} from './lib/opposed-arm-contact-study.mjs';
import {makeOpposedArmPrimaryBounds} from './lib/opposed-arm-primary-bounds.mjs';
import {makeOpposedArmPrimaryBounds as makeOriginal} from '../artifacts/review/079-primary-bounds-before-optimization.mjs';
const files=['artifacts/review/079-load6-dynamics.json','artifacts/review/079-load6-fine.json','artifacts/review/079-load6-finer.json','artifacts/review/079-load6-finest-initial.json'],
 runs=await Promise.all(files.map(async file=>JSON.parse(await readFile(file,'utf8')))),model=makeOpposedArmCandidate(runs[0].geometry),f=makeOpposedArmForceStudy(model,runs[0].parameters),
 c=makeOpposedArmContactStudy(model),before=makeOriginal(model,f,c),after=makeOpposedArmPrimaryBounds(model,f,c),cases=[],sources=[];
for(const [k,r]of runs.entries()){
 const indices=new Set([1,...Array.from({length:8},(_,i)=>1+Math.round((r.rows.length-2)*i/7)),[55,835,1670,3340][k]]);
 for(const index of indices){const a=r.rows[index-1],b=r.rows[index],start=performance.now(),old=before.interval(a,b),middle=performance.now(),updated=after.interval(a,b),end=performance.now();
  cases.push({file:files[k],index,time:[a.time,b.time],oldPassed:old.passed,newPassed:updated.passed,oldMilliseconds:middle-start,newMilliseconds:end-middle,
   oldFailure:old.failures[0]??null,newFailure:updated.failures[0]??null});
 }
}
const failures=cases.filter(c=>c.oldPassed!==c.newPassed),passed=failures.length===0&&cases.filter(c=>!c.oldPassed).length>=3;
for(const file of ['scripts/check-opposed-arm-bound-optimization.mjs','scripts/lib/opposed-arm-primary-bounds.mjs','artifacts/review/079-primary-bounds-before-optimization.mjs',
 'scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs','scripts/lib/opposed-arm-contact-study.mjs',...files]){
 const bytes=await readFile(file),archive=`artifacts/review/079-bound-optimization-geometry-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const report={movement:79,status:'continuous-bound-optimization-parity',productionChanged:false,mechanicsPassed:false,passed,cases,failures,sources,
 qualification:'The optimized checker retains the identical fixed-axis curvature bound and tolerance. It caches identical poses and tries face normals first, accepting only a complete separating-axis proof. These cases compare it with the archived implementation, including all three previously rejected intervals. Both full initial-trajectory runs provide additional independent execution parity.'};
await writeFile('artifacts/review/079-bound-optimization.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed,cases:cases.length,rejected:cases.filter(c=>!c.oldPassed).length,failures,oldMilliseconds:cases.reduce((s,c)=>s+c.oldMilliseconds,0),newMilliseconds:cases.reduce((s,c)=>s+c.newMilliseconds,0)});if(!passed)process.exitCode=1;
