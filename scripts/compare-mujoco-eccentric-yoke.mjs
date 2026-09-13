import fs from 'node:fs';
import assert from 'node:assert/strict';
import {hashStudyFile} from './lib/study-report-io.mjs';

const paths=process.argv.slice(2);assert.equal(paths.length,2,'Provide coarse and fine JSON reports');
const [a,b]=paths.map(path=>JSON.parse(fs.readFileSync(path)));
assert.deepEqual(a.sources.map(({file,sha256})=>({file,sha256})),b.sources.map(({file,sha256})=>({file,sha256})));
assert.equal(a.options.timestep,2*b.options.timestep);
assert.deepEqual({...a.options,timestep:0},{...b.options,timestep:0});assert.equal(a.rows.length,b.rows.length);
const differences=a.rows.map((r,i)=>{
  assert.ok(Math.abs(r.time-b.rows[i].time)<1e-7);
  return Math.abs(r.qpos[1]-b.rows[i].qpos[1])*100;
});
const sorted=[...differences].sort((x,y)=>x-y);
console.log(JSON.stringify({inputs:paths.map(file=>({file,sha256:hashStudyFile(file)})),seconds:a.seconds,samples:a.rows.length,
  timestep:a.options.timestep,maximumSliderDifferencePixels:sorted.at(-1),
  p95SliderDifferencePixels:sorted[Math.floor(sorted.length*.95)],
  rmsSliderDifferencePixels:Math.sqrt(differences.reduce((sum,x)=>sum+x*x,0)/differences.length),
  qualification:'Pointwise slider comparison every 10 ms; bounded subpixel differences do not establish identical impact timing.'},null,2));
