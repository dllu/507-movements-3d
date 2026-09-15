import fs from 'node:fs';
import {createHash} from 'node:crypto';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const baseline='/dev/shm/147-cycle-baseline.json',a=JSON.parse(fs.readFileSync(baseline)).samples;
const comparisons=[['timestep','/dev/shm/147-cycle-fine-time-samples.json','/dev/shm/147-cycle-timestep.json'],['track-mesh','/dev/shm/147-cycle-samples.json','/dev/shm/147-cycle-mesh.json']].map(([kind,file,report])=>{
 const b=JSON.parse(fs.readFileSync(file)).samples;
 if(a.length!==b.length)throw new Error('Sample grids differ');
 return {kind,sampleHash:hash(file),run:JSON.parse(fs.readFileSync(report)),maximumDifference:Object.fromEntries(['lift','lag','speed'].map(k=>[k,Math.max(...a.map((s,i)=>Math.abs(s[k]-b[i][k])))]))};
});
const result={movement:147,status:'transient-mesh-refinement-unresolved',method:'Compare corresponding samples after six warmup speed cycles. Baseline 320 cells / 48000 ticks; halve timestep independently, then double cell count independently. Pose closure is not a convergence test.',baselineSampleHash:hash(baseline),comparisons,
 sources:['scripts/review-fan-governor-refinement.mjs','docs/validation/147-speed-cycle-fine.json'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync('docs/validation/147-refinement.json',JSON.stringify(result,null,2)+'\n');console.log(comparisons.map(({kind,maximumDifference})=>({kind,maximumDifference})));
