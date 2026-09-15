import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeSelectableCamPhysics} from '../src/simulation/mujoco-selectable-cam/physics.js';
import {syncSelectableCamPhysics} from '../src/simulation/mujoco-selectable-cam/sync.js';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSelectableCamValve} from '../src/simulation/selectable-cam-valve.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeSelectableCamValve(),p=makeSelectableCamPhysics(await loadMujoco(),{ticksPerPeriod:120000});
try{
 const u=v.root.userData,b=u.blocks,groups=new Map([[b.fixedFrame,'fixed'],[b.camRotor,'shaft'],[b.slidingCarrier,'carrier'],[b.lever,'lever'],[b.followerRoller.rotor,'roller'],[u.valveBodies.rod,'rod'],[u.valveBodies.slider,'slider']]);
 const parts=[];v.root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.opacity===0)return;
  let parent=mesh,family;while(parent&&!family){family=groups.get(parent);parent=parent.parent;}
  if(!family)throw Error('Unclassified mesh');
  parts.push({name:(mesh.name||mesh.userData.role||'part')+'-'+parts.length,mesh,family,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
 });
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>b.family!==a.family).map(b=>[a,b]));let checks=0;const failures={},workingContacts={},samples=[];
 for(let tick=0;tick<=360000;tick++){
  if(tick>=240000&&(tick-240000)%1875===0){
  const pose=(tick-240000)/1875,state=p.state();samples.push(state);syncSelectableCamPhysics(v,state);
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b] of pairs){if(!a.box.intersectsBox(b.box))continue;const name=a.name+'/'+b.name;
   for(const [from,to] of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;
     const carrier=a.family==='carrier'?a:b,roller=a.family==='roller'?a:b;
     const working=carrier.family==='carrier'&&roller.family==='roller'&&/working-cam-plate|common-heel-selection-sleeve/.test(carrier.mesh.userData.role??'');
     const entries=working?workingContacts:failures;
     const e=entries[name]??{firstPose:pose,points:0,maximumDepth:0};e.points++;e.maximumDepth=Math.max(e.maximumDepth,depth);entries[name]=e;
    }
   }
  }
  }
  if(tick<360000)p.step();
 }
 const report={movement:150,method:'All visible mesh pairs belonging to different rigid bodies, bidirectional vertices/edge midpoints/face centers, 65 native-physics poses in the third demonstration, spanning all selections. Soft carrier/roller contact reported separately. Same-body mating interfaces excluded. No continuous collision proof.',summary:{parts:parts.length,pairs:pairs.length,poses:65,checks,failingPairs:Object.keys(failures).length},failures,workingContacts,sources:['scripts/review-selectable-cam-passive.mjs','src/simulation/selectable-cam-valve.js','src/simulation/authored-selectable-cams.js','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs','src/simulation/mujoco-selectable-cam/physics.js','src/simulation/mujoco-selectable-cam/sync.js','src/simulation/mujoco/mass.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/150-passive-assembly.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync('/dev/shm/150-passive-assembly-samples.json',JSON.stringify(samples));console.log(report.summary,failures,workingContacts);assert.equal(Object.keys(failures).length,0);
}finally{v.dispose();p.dispose();}
