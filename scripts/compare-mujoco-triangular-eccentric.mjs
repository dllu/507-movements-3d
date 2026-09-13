import fs from 'node:fs';
import assert from 'node:assert/strict';
import {hashStudyFile} from './lib/study-report-io.mjs';

const paths=process.argv.slice(2);assert.equal(paths.length,2,'Provide two 091 probe reports');
const [a,b]=paths.map(path=>JSON.parse(fs.readFileSync(path)));
assert.deepEqual(a.sources.map(({file,sha256})=>({file,sha256})),b.sources.map(({file,sha256})=>({file,sha256})));
const changed=Object.keys(a.options).filter(k=>a.options[k]!==b.options[k]);
assert.equal(changed.length,1);assert.ok(['timestep','chordTolerance'].includes(changed[0]));
assert.equal(a.rows.length,b.rows.length);
const differences=a.rows.map((r,i)=>{assert.ok(Math.abs(r.time-b.rows[i].time)<1e-7);return Math.abs(r.qpos[1]-b.rows[i].qpos[1])*100;});
const sorted=[...differences].sort((x,y)=>x-y);
console.log(JSON.stringify({inputs:paths.map(file=>({file,sha256:hashStudyFile(file)})),changedOption:changed[0],
  values:[a.options[changed[0]],b.options[changed[0]]],seconds:a.seconds,samples:sorted.length,
  maximumYokeDifferencePixels:sorted.at(-1),p95YokeDifferencePixels:sorted[Math.floor(sorted.length*.95)],
  rmsYokeDifferencePixels:Math.sqrt(differences.reduce((sum,x)=>sum+x*x,0)/differences.length),
  qualification:'Pointwise output comparison every 10 ms; this bounds displayed motion, not contact-force convergence.'},null,2));
