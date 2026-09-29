import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import loadMujoco from '@mujoco/mujoco';
import {makeStudReverserPhysics} from '../src/simulation/mujoco-stud-reverser/physics.js';
import {makeRelievedStudReverser,FLAT_INPUT_ARM} from '../src/simulation/mujoco-stud-reverser/geometry.js';
import {syncStudReverser} from '../src/simulation/mujoco-stud-reverser/sync.js';
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for(const file of ['docs/validation/153-supported-fine.json','docs/validation/153-assembly.json','docs/validation/153-moving-volumes.json']){
 const r=JSON.parse(fs.readFileSync(file));for(const s of r.sources)assert.equal(hash(s.file),s.sha256,s.file);if(r.summary.failingPairs!==undefined)assert.equal(r.summary.failingPairs,0);
}
const p=makeStudReverserPhysics(await loadMujoco(),{...FLAT_INPUT_ARM,barFriction:2,timestep:.000125}),v=makeRelievedStudReverser();
try{
 const b=v.root.userData.blocks,g=v.root.userData.geometry,names=['disk','bar','lever','leftGuide','rightGuide'],turns=[-2*Math.PI,0,0,0,0],motion=[];
 const start=480000,end=576000,stride=16;
 const coords=s=>[...s.qpos,-s.qpos[1]/g.guideRollerRadius,-s.qpos[1]/g.guideRollerRadius];
 let first,last;
 for(let tick=0;tick<=end;tick++){
  if(tick>=start&&(tick-start)%stride===0){const s=p.state(),q=coords(s);first??=q;last=q;motion.push([(tick-start)*p.timestep,...q]);}
  if(tick<end)p.step();
 }
 const closure=last.map((x,i)=>x-first[i]-turns[i]);closure.forEach(x=>assert.ok(Math.abs(x)<1e-6));motion[motion.length-1]=[12,...first.map((x,i)=>x+turns[i])];
 for(const object of [b.cameraEnvelope,b.directContactMarker,b.returnInputContactMarker,b.returnOutputContactMarker])object.removeFromParent();
 // Brown shows only the bar on its two rollers, the disk and the elbow. The
 // base rail, rear posts and C-shaped bar guides are undrawn visual supports
 // (the native bar guide is an ideal constraint), so they are not baked.
 // Shafts and the physical elbow stop remain.
 const undrawn=[];b.fixedFrame.traverse(o=>{if(o.isMesh&&/^(fixed-base-rail|fixed-rear-support-post|bar-guide-)/.test(o.name||o.userData.role||''))undrawn.push(o);});
 assert.equal(undrawn.length,15);for(const mesh of undrawn){mesh.removeFromParent();mesh.geometry.dispose();}
 const bounds=new THREE.Box3();for(const row of motion){syncStudReverser(v,{qpos:row.slice(1,4)});bounds.union(new THREE.Box3().setFromObject(v.root,true));}bounds.expandByScalar(.02);
 syncStudReverser(v,{qpos:[0,0,0]});
 const bodies=[b.diskRotor,b.slidingBar,b.lever,...b.guideRollers.map(g=>g.userData.rotor)];names.forEach((n,i)=>bodies[i].name='body:'+n);
 // Merge only within a rigid body and material; retain body transforms for playback.
 for(const body of [b.fixedFrame,...bodies]){
  const groups=new Map();body.traverse(mesh=>{if(!mesh.isMesh)return;let geometry=mesh.geometry.clone();if(geometry.index){const old=geometry;geometry=old.toNonIndexed();old.dispose();}
   for(const name of Object.keys(geometry.attributes))if(!['position','normal'].includes(name))geometry.deleteAttribute(name);
   geometry.applyMatrix4(body.matrixWorld.clone().invert().multiply(mesh.matrixWorld));const group=groups.get(mesh.material)??[];group.push(geometry);groups.set(mesh.material,group);
  });
  body.clear();for(const [material,geometries]of groups){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;body.add(mesh);}
 }
 v.root.traverse(o=>{o.userData={};});
 const sources=['scripts/bake-stud-reverser.mjs','src/simulation/mujoco-stud-reverser/geometry.js','src/simulation/mujoco-stud-reverser/physics.js','src/simulation/mujoco-stud-reverser/sync.js','src/simulation/authored-stud-drives.js','src/simulation/mujoco/mass.js','docs/validation/153-supported-fine.json','docs/validation/153-assembly.json','docs/validation/153-moving-volumes.json'].map(file=>({file,sha256:hash(file)}));
 const metadata={version:1,names,turns,period:12,loopStart:0,loopEnd:12,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),cameraDirection:[.02,.03,15],sources,closure,sourceTime:60};
 const file='src/simulation/baked/assets/153.json.gz';fs.writeFileSync(file,gzipSync(JSON.stringify({...metadata,motion,object:v.root.toJSON()}),{level:9}));let meshes=0;v.root.traverse(o=>{if(o.isMesh)meshes++;});
 fs.writeFileSync('src/simulation/baked/assets/153.provenance.json',JSON.stringify({...metadata,bytes:fs.statSync(file).size,sha256:hash(file),samples:motion.length,meshes},null,2)+'\n');console.log({bytes:fs.statSync(file).size,samples:motion.length,meshes,closure});
}finally{v.dispose();p.dispose();}
