import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import loadMujoco from '@mujoco/mujoco';
import {makeThreeWiperGeometry} from '../src/simulation/mujoco-three-wiper/geometry.js';
import {makeThreeWiperPhysics} from '../src/simulation/mujoco-three-wiper/physics.js';
import {sampleBakedMotion} from '../src/simulation/baked/playback.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const b=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/128.json.gz')));
const v=makeThreeWiperGeometry(),p=makeThreeWiperPhysics(await loadMujoco(),v,b.source.options);
try{
 let maximumPixels=0;
 for(let i=0;i<18/p.timestep;i++){
  p.step();assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-7);
  const q=sampleBakedMotion(b,p.data.time);
  for(let k=0;k<2;k++)maximumPixels=Math.max(maximumPixels,Math.abs(q[k]-p.data.qpos[k])*(k?100:126));
 }
 let maximumCoarseDifferencePixels=0;
 const coarse=makeThreeWiperPhysics(p.mujoco,v,{...b.source.options,timestep:.0005});
 try{for(let i=0;i<18/coarse.timestep;i++){
  coarse.step();assert(Math.abs(coarse.data.time-(i+1)*coarse.timestep)<1e-7);
  const q=sampleBakedMotion(b,coarse.data.time);
  for(let k=0;k<2;k++)maximumCoarseDifferencePixels=Math.max(maximumCoarseDifferencePixels,Math.abs(q[k]-coarse.data.qpos[k])*(k?100:126));
 }}finally{coarse.dispose();}
 const result={duration:p.data.time,maximumPixels,maximumCoarseDifferencePixels,qualification:'Fresh native comparison at every 0.25 ms tick, through startup and the first playback loop seam; additional 0.5 ms native run compared at every tick.'};
 fs.writeFileSync(process.env.PROBE_REPORT??'/dev/shm/128-bake-validation.json',JSON.stringify(result,null,2));console.log(result);assert(maximumPixels<.1);assert(maximumCoarseDifferencePixels<.1);
}finally{p.dispose();disposeObject3D(v.root);}
