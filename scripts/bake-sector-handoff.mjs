import fs from 'node:fs';
import {BufferGeometry} from 'three';
import crypto from 'node:crypto';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {makeSectorHandoffGeometry} from '../src/simulation/mujoco-sector-handoff/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const input=process.env.REPORT??'/dev/shm/123-dynamics-final.json';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report=JSON.parse(fs.readFileSync(input));
assert.equal(report.timeResets,0);assert.equal(report.disableCam,false);assert.deepEqual(report.options,{});
for(const s of report.sources)assert.equal(hash(s.file),s.sha256,'Changed simulation input: '+s.file);
const visual=makeSectorHandoffGeometry(),u=visual.root.userData,names=['left','center','right','rack'];
try{
 const rows=[{time:0,qpos:Object.fromEntries(names.map(n=>[n,0]))},...report.rows];
 const period=6,turns=[-2*Math.PI,2*Math.PI,-2*Math.PI,0];
 // Find an already-settled complete cycle whose seam requires no pose correction.
 let best;
 for(let i=1;i+600<rows.length;i++){
  if(rows[i].time<12)continue;
  const end=rows[i+600];if(Math.abs(end.time-rows[i].time-period)>1e-7)continue;
  const error=Math.max(...names.map((n,k)=>Math.abs(end.qpos[n]-rows[i].qpos[n]-turns[k])*(n==='rack'?100:150)));
  if(!best||error<best.error)best={i,end:i+600,error};
 }
 assert(best&&best.error<.05,'Loop seam exceeds 0.05 source pixel');
 const motion=rows.slice(0,best.end+1).map(r=>[Number(r.time.toFixed(6)),...names.map(n=>r.qpos[n])]);
 const metadata={version:1,names,period,loopStart:Number(rows[best.i].time.toFixed(6)),loopEnd:Number(rows[best.end].time.toFixed(6)),turns,motion,source:{reportSha256:hash(input),simulationSources:report.sources.map(({file,sha256})=>({file,sha256})),maximumLoopSeamPixels:best.error},focus:visual.focus.toArray(),cameraDirection:visual.cameraDirection.toArray(),bounds:{min:u.cameraFitBounds.min.toArray(),max:u.cameraFitBounds.max.toArray()}};
 for(const[n,b]of Object.entries(u.blocks))b.name='body:'+n;
 visual.root.traverse(o=>{o.userData={};if(o.geometry){const g=new BufferGeometry().copy(o.geometry);g.userData={};o.geometry.dispose();o.geometry=g;}});
 const bundle={...metadata,object:visual.root.toJSON()};
 const output='src/simulation/baked/assets/123.json.gz',bytes=gzipSync(Buffer.from(JSON.stringify(bundle)),{level:9});
 fs.writeFileSync(output,bytes);
 const manifest={...metadata,motion:undefined,object:undefined,samples:motion.length,bytes:bytes.length,assetSha256:hash(output)};
 fs.writeFileSync('src/simulation/baked/assets/123.provenance.json',JSON.stringify(manifest,null,2)+'\n');
 console.log({output,bytes:bytes.length,samples:motion.length,loopStart:metadata.loopStart,loopEnd:metadata.loopEnd,seamPixels:best.error});
}finally{disposeObject3D(visual.root);}
