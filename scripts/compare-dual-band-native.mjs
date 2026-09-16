import fs from 'node:fs';
import {createHash} from 'node:crypto';
const [coarsePath,finePath,outputPath='/dev/shm/390-native-comparison.json']=process.argv.slice(2);
const coarse=JSON.parse(fs.readFileSync(coarsePath)),fine=JSON.parse(fs.readFileSync(finePath));
let maxOutputAngleDifference=0,maxOutputSpeedDifference=0,maxPawlAngleDifference=0,j=0;
for(const a of coarse.samples){
  while(j+1<fine.samples.length&&Math.abs(fine.samples[j+1].time-a.time)<Math.abs(fine.samples[j].time-a.time))j++;
  const b=fine.samples[j];if(Math.abs(a.time-b.time)>1e-5)throw Error('Comparison requires coincident sample times');
  maxOutputAngleDifference=Math.max(maxOutputAngleDifference,Math.abs(a.q[4]-b.q[4]));
  maxOutputSpeedDifference=Math.max(maxOutputSpeedDifference,Math.abs(a.v[4]-b.v[4]));
  maxPawlAngleDifference=Math.max(maxPawlAngleDifference,...[1,3].map(k=>Math.abs(a.q[k]-b.q[k])));
}
const a=coarse.samples.at(-1),b=fine.samples.at(-1);
const comparison={finalOutputAngleDifference:Math.abs(a.q[4]-b.q[4]),maxOutputAngleDifference,maxOutputSpeedDifference,maxPawlAngleDifference,
  lastCycleAdvanceDifference:Math.abs(coarse.summary.lastCycleAdvance-fine.summary.lastCycleAdvance),
  passesPointwiseGate:maxOutputAngleDifference<.005&&maxOutputSpeedDifference<.03&&maxPawlAngleDifference<.01};
const files=['src/simulation/mujoco-dual-band/physics.js','src/simulation/dual-band-pawl-contact.js'];
const report={status:comparison.passesPointwiseGate?'candidate-needs-bake-and-solid-validation':'unqualified-do-not-bake',engine:'@mujoco/mujoco 3.13.0',
  modelSources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),
  coarse:coarse.summary,fine:fine.summary,comparison};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');console.log(comparison);
