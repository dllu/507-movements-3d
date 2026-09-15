import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBeltGovernorPhysics} from '../src/simulation/mujoco-belt-governor/physics.js';
import {makeBeltGovernorSolids} from '../src/simulation/mujoco-belt-governor/solids.js';
import {beltGovernorState,beltGovernorMotionBound} from '../src/simulation/mujoco-belt-governor/kinematics.js';
const qualification=JSON.parse(fs.readFileSync('docs/validation/163-loop-qualification.json'));
for(const {file,sha256}of qualification.sources)assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sha256,'stale qualification');
assert.equal(qualification.status,'native-loop-qualified');
const m=await loadMujoco(),p=makeBeltGovernorPhysics(m,qualification.parameters),g=p.geometry;let v;
try{
 const checkpoint=qualification.initialState,dt=p.timestep,w=p.description.nominalSpeed,A=p.description.speedAmplitude,k=2*Math.PI/p.description.period;
 p.data.qpos.set(checkpoint.qpos);p.data.qvel.set(checkpoint.qvel);p.data.time=checkpoint.time;p.data.ctrl[0]=w*checkpoint.time+A*(1-Math.cos(k*checkpoint.time))/k+.01*(w+A*Math.sin(k*checkpoint.time));m.mj_forward(p.model,p.data);
 for(let tick=0;tick<qualification.best.index*qualification.stride;tick++)p.step();
 const initialState=p.state(),offsets=initialState.qpos.map((q,i)=>[0,11,12].includes(i)?q:0),native=[],velocities=[],ticks=Math.round(qualification.period/dt);
 for(let tick=0;tick<=ticks;tick++){
  assert.ok(Math.abs(p.data.time-initialState.time-tick*dt)<1e-7,'native clock reset');
  native.push([tick*dt,...Array.from(p.data.qpos,(q,i)=>q-offsets[i])]);velocities.push(Array.from(p.data.qvel));if(tick<ticks)p.step();
 }
 const turns=initialState.qpos.map((_,i)=>i===0?16*Math.PI:i>=11?native.at(-1)[i+1]-native[0][i+1]:0),residual=native.at(-1).slice(1).map((q,i)=>q-native[0][i+1]-turns[i]),velocityResidual=velocities.at(-1).map((q,i)=>q-velocities[0][i]);
 const positionClosure=beltGovernorMotionBound(residual,g),velocityClosure=beltGovernorMotionBound(velocityResidual,g);assert.ok(positionClosure<1e-6&&velocityClosure<1e-6,'restored native replay must retain closure');
 // Keep native samples unchanged: no seam blending, endpoint snapping or speed
 // correction. Only free absolute phases are offset for the initial front view.
 const keep=new Set([0,ticks]),stack=[[0,ticks]];
 while(stack.length){const [a,b]=stack.pop();let worst=.00002,index=-1;
  for(let i=a+1;i<b;i++){const u=(i-a)/(b-a),d=native[i].slice(1).map((q,j)=>q-native[a][j+1]-u*(native[b][j+1]-native[a][j+1]));const error=beltGovernorMotionBound(d,g);if(error>worst){worst=error;index=i;}}
  if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}
 }
 const indices=[...keep].sort((a,b)=>a-b),motion=indices.map(i=>native[i]);let maximumNativeError=0,segment=0;
 for(let i=0;i<=ticks;i++){while(segment+1<indices.length-1&&indices[segment+1]<i)segment++;const a=indices[segment],b=indices[segment+1],u=(i-a)/(b-a),d=native[i].slice(1).map((q,j)=>q-native[a][j+1]-u*(native[b][j+1]-native[a][j+1]));maximumNativeError=Math.max(maximumNativeError,beltGovernorMotionBound(d,g));}
 assert.ok(maximumNativeError<.000021);
 // Repeated seam marks are a visual cue. Choose their spacing from measured
 // travel so their pattern also repeats; native belt speed is never changed.
 const beltSeamSpacing=turns[12]/Math.round(turns[12]/2.4);v=makeBeltGovernorSolids({beltSeamSpacing});
 const bounds=new THREE.Box3();for(let i=0;i<native.length;i+=32){v.update(beltGovernorState(native[i].slice(1),g));bounds.union(new THREE.Box3().setFromObject(v.root,true));}bounds.expandByScalar(.04);v.update(beltGovernorState(motion[0].slice(1),g));v.root.traverse(o=>{o.userData={};});
 const sources=['scripts/bake-belt-governor.mjs','docs/validation/163-loop-qualification.json','src/simulation/mujoco-belt-governor/physics.js','src/simulation/mujoco-belt-governor/geometry.js','src/simulation/mujoco-belt-governor/belt-contact.js','src/simulation/mujoco-belt-governor/solids.js','src/simulation/mujoco-belt-governor/update-solids.js','src/simulation/mujoco-belt-governor/kinematics.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const bundle={version:1,movement:163,object:v.root.toJSON(),geometry:g,motion,names:['spindle','leftSpread','leftLink','rightSpread','rightLink','sleeve','collar','radialSlide','bell','rod','fork','loose','beltTravel'],turns,period:qualification.period,loopStart:0,loopEnd:qualification.period,beltSeamSpacing,parameters:p.description,initialState,offsets,positionClosure,velocityClosure,maximumNativeError,nativeSamples:native.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),cameraDirection:[.01,.01,15],sources};
 const bytes=gzipSync(JSON.stringify(bundle),{level:9});fs.writeFileSync('src/simulation/baked/assets/163.json.gz',bytes);fs.writeFileSync('src/simulation/baked/assets/163.provenance.json',JSON.stringify({...bundle,object:undefined,motion:undefined,samples:motion.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');console.log({bytes:bytes.length,samples:motion.length,positionClosure,velocityClosure,maximumNativeError,beltSeamSpacing});
}finally{v?.dispose();p.dispose();}
