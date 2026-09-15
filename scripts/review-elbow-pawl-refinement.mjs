import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sources=[],results=[];
for(const side of ['right','left']){
 const files=[`/dev/shm/155-supported-${side}-samples.json`,`/dev/shm/155-supported-${side}-fine-samples.json`],rows=files.map(f=>JSON.parse(fs.readFileSync(f)).slice(3080));sources.push(...files);
 const differences=['carrier','rod','pawl','output','slider'].map((name,k)=>({name,maximum:Math.max(...rows[0].map((s,i)=>Math.abs(s.qpos[k]-rows[1][i].qpos[k])))}));
 const sign=side==='right'?-1:1;let high=sign*rows[1][0].qpos[3],reverse=0;
 for(const s of rows[1]){const q=sign*s.qpos[3];high=Math.max(high,q);reverse=Math.max(reverse,high-q);}
 results.push({side,differences,maximumReverseExcursion:reverse,reverseToothFraction:reverse/(2*Math.PI/23)});
}
const report={movement:155,method:'Matched .01-second samples from the eighth cycle at dt=.0005 and .00025; maximum reverse excursion measured against the running forward maximum in the fine trajectory. Finite timestep/sampling evidence, not exact impact convergence.',results,sources:['scripts/review-elbow-pawl-refinement.mjs',...sources].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/155-supported-refinement.json',JSON.stringify(report,null,2)+'\n');console.log(results);
