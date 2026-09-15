import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeWaterGovernorPhysics} from '../src/simulation/mujoco-water-governor/physics.js';
import {makeWaterGovernorSolids} from '../src/simulation/mujoco-water-governor/solids.js';
import {waterGovernorState,waterGovernorMotionBound} from '../src/simulation/mujoco-water-governor/kinematics.js';
const qualification=JSON.parse(fs.readFileSync('docs/validation/162-loop-qualification.json'));
for(const s of qualification.sources)assert.equal(createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,'stale loop qualification');
assert.ok(qualification.best.score<1);
const m=await loadMujoco(),p=makeWaterGovernorPhysics(m,{period:qualification.period,timestep:qualification.timestep}),v=makeWaterGovernorSolids(),g=p.geometry;
try{
 const start=qualification.initialState,dt=p.timestep,loopTick=qualification.best.index*qualification.stride,endTick=loopTick+Math.round(qualification.period/dt);
 p.data.qpos.set(start.qpos);p.data.qvel.set(start.qvel);p.data.time=start.time;
 const k=2*Math.PI/qualification.period,w=p.description.nominalSpeed,A=p.description.speedAmplitude;
 p.data.ctrl[0]=w*start.time+A*(1-Math.cos(k*start.time))/k+.01*(w+A*Math.sin(k*start.time));m.mj_forward(p.model,p.data);
 const offsets=start.qpos.map((q,i)=>[0,6,7,8].includes(i)?2*Math.PI*Math.round(q/(2*Math.PI)):0),native=[],velocities=[];
 for(let tick=0;tick<=endTick;tick++){
  assert.ok(Math.abs(p.data.time-start.time-tick*dt)<1e-7,'native clock reset');
  native.push([tick*dt,...Array.from(p.data.qpos,(q,i)=>q-offsets[i])]);velocities.push(Array.from(p.data.qvel));
  if(tick<endTick)p.step();
 }
 const turns=qualification.best.turns,residual=native.at(-1).slice(1).map((q,i)=>q-native[loopTick][i+1]-turns[i]),velocityResidual=velocities.at(-1).map((q,i)=>q-velocities[loopTick][i]);
 const positionClosure=waterGovernorMotionBound(residual,g),velocityClosure=waterGovernorMotionBound(velocityResidual,g);
 assert.ok(positionClosure<.0001&&velocityClosure<.001,'restored native state must retain the qualified seam');
 // C1 numerical closure, smaller than the native integration/contact error.
 // This does not balance gate travel: the output retains two measured turns.
 const rows=native.map(row=>row.slice()),blendDuration=.1,endTime=endTick*dt;
 for(const row of rows){const u=Math.max(0,Math.min(1,(row[0]-endTime+blendDuration)/blendDuration)),h=3*u*u-2*u*u*u,j=u*u*u-u*u;
  for(let i=0;i<9;i++)row[i+1]-=residual[i]*h+velocityResidual[i]*blendDuration*j;
 }
 rows.at(-1).splice(1,9,...rows[loopTick].slice(1).map((q,i)=>q+turns[i]));
 const keep=new Set([0,loopTick,endTick]),stack=[[0,loopTick],[loopTick,endTick]];
 while(stack.length){const [a,b]=stack.pop();let worst=.00002,index=-1;
  for(let i=a+1;i<b;i++){const t=(i-a)/(b-a),d=rows[i].slice(1).map((q,j)=>q-rows[a][j+1]-t*(rows[b][j+1]-rows[a][j+1])),error=waterGovernorMotionBound(d,g);if(error>worst){worst=error;index=i;}}
  if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}
 }
 const indices=[...keep].sort((a,b)=>a-b),motion=indices.map(i=>rows[i]);let maximumNativeError=0,segment=0;
 for(let i=0;i<=endTick;i++){
  while(segment+1<indices.length-1&&indices[segment+1]<i)segment++;
  const a=indices[segment],b=indices[segment+1],t=(i-a)/(b-a),d=native[i].slice(1).map((q,j)=>rows[a][j+1]+t*(rows[b][j+1]-rows[a][j+1])-q);
  maximumNativeError=Math.max(maximumNativeError,waterGovernorMotionBound(d,g));
 }
 assert.ok(maximumNativeError<.0001,'all native ticks must stay within the visible error budget');
 const bounds=new THREE.Box3();for(let i=0;i<rows.length;i+=32){v.update(waterGovernorState(rows[i].slice(1),g));bounds.union(new THREE.Box3().setFromObject(v.root,true));}bounds.expandByScalar(.04);v.update(waterGovernorState(motion[0].slice(1),g));
 // Instance repeated teeth offline: 38 draw objects and one tooth geometry
 // per gear, avoiding the download cost of duplicating every tooth vertex.
 for(const name of ['upperInput','spindleDrive','upperLoose','lowerLoose','gateOutput']){
  const block=v.root.getObjectByName('body:'+name),children=block.children.filter(c=>c.name.includes('Tooth'));
  const teeth=new THREE.InstancedMesh(children[0].geometry,children[0].material,children.length);
  children.forEach((child,i)=>{child.updateMatrix();teeth.setMatrixAt(i,child.matrix);});
  teeth.name=name+'Teeth';teeth.instanceMatrix.needsUpdate=true;teeth.castShadow=true;teeth.receiveShadow=true;block.remove(...children);block.add(teeth);
 }
 v.root.traverse(o=>{o.userData={};});
 const sources=['scripts/bake-water-governor.mjs','docs/validation/162-loop-qualification.json','src/simulation/mujoco-water-governor/physics.js','src/simulation/mujoco-water-governor/solids.js','src/simulation/mujoco-water-governor/update-solids.js','src/simulation/mujoco-water-governor/kinematics.js','src/simulation/mujoco-water-governor/backing-contact.js','src/simulation/mujoco-water-governor/bevel-train.js','src/simulation/bevel-geometry.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const bundle={version:1,movement:162,object:v.root.toJSON(),geometry:g,motion,names:['spindle','leftSpread','leftLink','rightSpread','rightLink','sleeve','upper','lower','output'],turns,period:qualification.period,loopStart:loopTick*dt,loopEnd:endTime,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),cameraDirection:[.01,.01,15],sources,parameters:p.description,initialState:start,offsets,positionClosure,velocityClosure,blendDuration,maximumNativeError,nativeSamples:native.length};
 const bytes=gzipSync(JSON.stringify(bundle),{level:9});fs.writeFileSync('src/simulation/baked/assets/162.json.gz',bytes);fs.writeFileSync('src/simulation/baked/assets/162.provenance.json',JSON.stringify({...bundle,object:undefined,motion:undefined,samples:motion.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');console.log({bytes:bytes.length,samples:motion.length,positionClosure,velocityClosure,maximumNativeError});
}finally{v.dispose();p.dispose();}
