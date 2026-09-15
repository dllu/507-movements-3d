import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeFanGovernorPhysics} from '../src/simulation/mujoco-fan-governor/physics.js';
import {makeFanGovernorGeometry} from '../src/simulation/mujoco-fan-governor/geometry.js';
import {fanGovernorSource as source} from '../src/simulation/mujoco-fan-governor/source.js';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
const mujoco=await loadMujoco(),visual=makeFanGovernorGeometry({segments:320}),u=visual.root.userData;
const physics=makeFanGovernorPhysics(mujoco,{massProperties:u.mass,timestep:.0005,segments:320});
try{
 const solids=new Map(Object.values(u.parts).map(mesh=>[mesh,solidSurface(mesh.geometry)]));
 visual.sync(physics.state());
 let compiledVertices=0,maximumCompiledError=0,contactsChecked=0,maximumCrownError=0,
  maximumTrackError=0,minimumCrownEndMargin=Infinity,maximumPenetration=0,maximumLatePenetration=0;
 const geomMatrix=id=>new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(physics.data.geom_xmat,id*9).transpose())
  .setPosition(new THREE.Vector3().fromArray(physics.data.geom_xpos,id*3));
 const trackById=new Map();
 for(const [name,mesh] of Object.entries(u.parts))if(name.startsWith('track_')){
  const id=physics.id('mjOBJ_GEOM',name),mi=physics.model.geom_dataid[id],first=physics.model.mesh_vertadr[mi],count=physics.model.mesh_vertnum[mi];
  trackById.set(id,mesh);
  const transform=mesh.matrixWorld.clone().invert().multiply(geomMatrix(id));
  for(let i=0;i<count;i++){
   const p=new THREE.Vector3().fromArray(physics.model.mesh_vert,3*(first+i)).applyMatrix4(transform);
   maximumCompiledError=Math.max(maximumCompiledError,solids.get(mesh).distance(p));compiledVertices++;
  }
 }
 const rollerById=new Map([0,1].map(i=>[physics.id('mjOBJ_GEOM','roller'+i),u.parts['crowned-roller-'+i]]));
 for(let step=0;step<=12000;step++){
  if(step%100===0){
   mujoco.mj_forward(physics.model,physics.data);visual.sync(physics.state());
   const contacts=physics.data.contact;
   try{for(let i=0;i<contacts.size();i++){
    const c=contacts.get(i);
    try{
     const sphereFirst=rollerById.has(c.geom1),roller=rollerById.get(sphereFirst?c.geom1:c.geom2),track=trackById.get(sphereFirst?c.geom2:c.geom1);
     if(!roller||!track)continue;
     const midpoint=new THREE.Vector3().fromArray(c.pos),normal=new THREE.Vector3().fromArray(c.frame);
     const rp=midpoint.clone().addScaledVector(normal,(sphereFirst?-1:1)*c.dist/2).applyMatrix4(roller.matrixWorld.clone().invert());
     const tp=midpoint.clone().addScaledVector(normal,(sphereFirst?1:-1)*c.dist/2).applyMatrix4(track.matrixWorld.clone().invert());
     contactsChecked++;maximumCrownError=Math.max(maximumCrownError,solids.get(roller).distance(rp));
     maximumTrackError=Math.max(maximumTrackError,solids.get(track).distance(tp));
     minimumCrownEndMargin=Math.min(minimumCrownEndMargin,source.rollerHalfWidth*source.scale-Math.abs(rp.x));
     maximumPenetration=Math.max(maximumPenetration,-c.dist);
     if(physics.data.time>2)maximumLatePenetration=Math.max(maximumLatePenetration,-c.dist);
    }finally{c.delete();}
   }}finally{contacts.delete();}
  }
  if(step<12000)physics.step();
 }
 const report={movement:147,status:'candidate-working-surfaces',method:'Compiled track vertices compared with visible convex cells. Native contact points on both surfaces compared with visible track and bored crown meshes during a six-second startup. Spherical proxy poles extend outside the crowns; contact points must remain inside the visible crown width. Contact copies are explicitly released.',
  options:physics.description.options,summary:{compiledVertices,maximumCompiledError,contactsChecked,maximumCrownError,maximumTrackError,minimumCrownEndMargin,maximumPenetration,maximumLatePenetration},mass:u.mass,final:physics.state(),
  sources:['scripts/review-fan-governor-surfaces.mjs','src/simulation/mujoco-fan-governor/source.js','src/simulation/mujoco-fan-governor/geometry.js','src/simulation/mujoco-fan-governor/physics.js','src/simulation/mujoco/mass.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 assert.ok(compiledVertices>1000&&contactsChecked>200);
 assert.ok(maximumCompiledError<1e-6&&maximumTrackError<1e-6);
 assert.ok(maximumCrownError<.0002&&minimumCrownEndMargin>.08);
 assert.ok(maximumLatePenetration<.0001,`late penetration ${maximumLatePenetration}`);
 fs.writeFileSync('docs/validation/147-candidate-surfaces.json',JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync('/dev/shm/147-candidate-state.json',JSON.stringify(physics.state()));console.log(report.summary);
}finally{physics.dispose();visual.dispose();}
