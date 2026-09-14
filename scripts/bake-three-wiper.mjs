import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {BufferGeometry} from 'three';
import {makeThreeWiperGeometry} from '../src/simulation/mujoco-three-wiper/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const file=process.env.REPORT??'/dev/shm/128-recording.json',report=JSON.parse(fs.readFileSync(file));
assert.equal(report.resets,0);assert.equal(report.wallContacts,0);assert(report.penetration<.001);
assert.deepEqual(report.options,{timestep:.00025,period:6,damping:.05,guideFriction:5});
for(const s of report.sources)assert.equal(hash(s.file),s.sha256,'Changed simulation input: '+s.file);
const v=makeThreeWiperGeometry();
try{
 const rows=[{time:0,qpos:[Math.PI/6,.03]},...report.rows],period=6,turns=[-2*Math.PI,0];let best;
 const stride=Math.round(period/(rows[2].time-rows[1].time));
 for(let i=1;i+stride<rows.length;i++){
  if(rows[i].time<6)continue;
  const end=rows[i+stride];assert(Math.abs(end.time-rows[i].time-period)<1e-7);
  const error=Math.max(...turns.map((turn,k)=>Math.abs(end.qpos[k]-rows[i].qpos[k]-turn)*(k?100:126)));
  if(!best||error<best.error)best={start:i,end:i+stride,error};
 }
 assert(best&&best.error<.01,'No continuous settled loop');
 const motion=rows.slice(0,best.end+1).map(r=>[Number(r.time.toFixed(6)),...r.qpos]);
 for(const [n,b]of Object.entries(v.root.userData.blocks))b.name='body:'+n;
 v.root.traverse(o=>{o.userData={};if(o.geometry){const g=new BufferGeometry().copy(o.geometry);g.userData={};o.geometry.dispose();o.geometry=g;}});
 v.root.updateMatrixWorld(true);
 const metadata={version:1,names:['rotor','frame'],period,loopStart:Number(rows[best.start].time.toFixed(6)),loopEnd:Number(rows[best.end].time.toFixed(6)),turns,
  bounds:{min:[-3.15,-2.05,-.3],max:[2.95,2.05,.3]},focus:[-.1,0,0],cameraDirection:[.3,.2,10],
  source:{reportSha256:hash(file),simulationSources:report.sources,options:report.options,maximumLoopSeamPixels:best.error,maximumPenetrationPixels:report.penetration*100}};
 const output='src/simulation/baked/assets/128.json.gz';fs.writeFileSync(output,gzipSync(JSON.stringify({...metadata,motion,object:v.root.toJSON()}),{level:9}));
 fs.writeFileSync('src/simulation/baked/assets/128.provenance.json',JSON.stringify({...metadata,samples:motion.length,bytes:fs.statSync(output).size,assetSha256:hash(output)},null,2)+'\n');
 console.log({output,samples:motion.length,loopStart:metadata.loopStart,loopEnd:metadata.loopEnd,seamPixels:best.error,bytes:fs.statSync(output).size});
}finally{disposeObject3D(v.root);}
