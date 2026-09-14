import fs from 'node:fs';import assert from 'node:assert/strict';import{gunzipSync}from'node:zlib';import loadMujoco from '@mujoco/mujoco';
import {makeMujocoSectorHandoff} from '../src/simulation/mujoco-sector-handoff/visual.js';
import {sampleBakedMotion} from '../src/simulation/baked/playback.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/123.json.gz'))),v=makeMujocoSectorHandoff(await loadMujoco()),p=v.physics;
try{let maximumPixels=0;const perJoint={};for(let i=0;i<6250;i++){p.step();assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-8);const q=sampleBakedMotion(bundle,p.data.time);bundle.names.forEach((n,k)=>{const error=Math.abs(q[k]-p.data.qpos[p.joints[n].q])*(n==='rack'?100:200);perJoint[n]=Math.max(perJoint[n]??0,error);maximumPixels=Math.max(maximumPixels,error);});}
const result={duration:p.data.time,maximumPixels,perJoint,qualification:'Baked linear interpolation versus fresh native states at every 1 ms tick, including startup and a complete handoff cycle. Angular error scaled at a conservative 2-world-unit radius.'};fs.writeFileSync(process.env.PROBE_REPORT??'/dev/shm/123-baked-validation-a.json',JSON.stringify(result,null,2)+'\n');console.log(result);assert(maximumPixels<.1);
}finally{v.dispose();}
