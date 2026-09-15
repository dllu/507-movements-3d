import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {makeRelievedStudReverser} from '../src/simulation/mujoco-stud-reverser/geometry.js';
import {syncStudReverser} from '../src/simulation/mujoco-stud-reverser/sync.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const samples=JSON.parse(fs.readFileSync('/dev/shm/153-relieved-fine-samples.json'));
const v=makeRelievedStudReverser(),u=v.root.userData,b=u.blocks;
try{
 const pins=b.pinAssemblies.map(p=>p.userData.blocks.pin),arms=b.inputArm.children;
 const data=new Map([...pins,...arms].map(mesh=>[mesh,{points:surfacePoints(mesh.geometry),solid:solidSurface(mesh.geometry)}]));
 let checks=0,maxDepth=0,witness=null,penetratingPoses=0,raisedMaximumDepth=0;
 for(let pose=0;pose<=600;pose++){
  const state=samples[6000+pose*2],time=state.time;syncStudReverser(v,state);let failed=false;
  for(const pin of pins)for(const arm of arms)for(const [from,to] of [[pin,arm],[arm,pin]]){
   const matrix=to.matrixWorld.clone().invert().multiply(from.matrixWorld);
   for(const p of data.get(from).points){checks++;const q=p.clone().applyMatrix4(matrix);if(!data.get(to).solid.inside(q))continue;const depth=data.get(to).solid.distance(q);if(arm.name==='raised-inner-input-arm')raisedMaximumDepth=Math.max(raisedMaximumDepth,depth);if(depth>1e-5)failed=true;if(depth>maxDepth){maxDepth=depth;witness={time,part:arm.name,depth};}}
  }
  if(failed)penetratingPoses++;
 }
 const report={movement:153,method:'Bidirectional actual pin and stepped input-arm vertices, edge midpoints and triangle centers at 601 native poses from the sixth full cycle. Reports soft working contact separately from raised-arm clearance. Not a complete assembly or continuous collision proof.',summary:{poses:601,checks,penetratingPoses,maxDepth,raisedMaximumDepth,witness},sources:['scripts/review-stud-reverser-relief.mjs','src/simulation/mujoco-stud-reverser/geometry.js','src/simulation/mujoco-stud-reverser/sync.js','/dev/shm/153-relieved-fine-samples.json','src/simulation/authored-stud-drives.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/153-relief-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
}finally{disposeObject3D(v.root);}
