import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import loadMujoco from '@mujoco/mujoco';
import {makeElbowPawlGeometry} from '../src/simulation/mujoco-elbow-pawl/geometry.js';
import {makeElbowPawlPhysics} from '../src/simulation/mujoco-elbow-pawl/physics.js';
import {syncElbowPawl} from '../src/simulation/mujoco-elbow-pawl/sync.js';
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const reports=['docs/validation/155-supported-right-fine.json','docs/validation/155-supported-left-fine.json','docs/validation/155-supported-assembly.json','docs/validation/155-supported-refinement.json'];
for(const file of reports){const r=JSON.parse(fs.readFileSync(file));for(const s of r.sources)assert.equal(hash(s.file),s.sha256,s.file);for(const result of r.results??[])if(result.failures)assert.equal(Object.keys(result.failures).length,0);}
const mujoco=await loadMujoco(),installations={};
for(const side of ['right','left']){
 const v=makeElbowPawlGeometry({side}),p=makeElbowPawlPhysics(mujoco,v,{timestep:.00025});
 try{
  const u=v.root.userData,b=u.blocks,names=['carrier','rod','pawl','output','slider'],turns=[0,0,0,(side==='right'?-1:1)*u.profile.pitch,0],motion=[];
  for(let tick=0;tick<=35200;tick++){if(tick%8===0)motion.push([tick*p.timestep,...p.data.qpos]);if(tick<35200)p.step();}
  const first=motion[2200].slice(1),last=motion.at(-1).slice(1),closure=last.map((x,i)=>x-first[i]-turns[i]);closure.forEach(x=>assert.ok(Math.abs(x)<1e-6));motion[motion.length-1]= [8.8,...first.map((x,i)=>x+turns[i])];
  const bounds=new THREE.Box3();for(const row of motion){syncElbowPawl(v,{qpos:row.slice(1)});bounds.union(new THREE.Box3().setFromObject(v.root,true));}bounds.expandByScalar(.02);
  syncElbowPawl(v,{qpos:[0,0,0,0,0]});
  for(const name of ['fixed',...names]){
   const body=b[name],groups=new Map(),lines=body.children.filter(o=>o.isLine);
   body.traverse(mesh=>{if(!mesh.isMesh)return;let geometry=mesh.geometry.clone();if(geometry.index){const old=geometry;geometry=old.toNonIndexed();old.dispose();}for(const n of Object.keys(geometry.attributes))if(!['position','normal'].includes(n))geometry.deleteAttribute(n);geometry.applyMatrix4(body.matrixWorld.clone().invert().multiply(mesh.matrixWorld));const key=mesh.material.color.getHex(),group=groups.get(key)??{material:mesh.material,geometries:[]};group.geometries.push(geometry);groups.set(key,group);});
   body.clear();for(const {material,geometries}of groups.values()){const mesh=new THREE.Mesh(mergeGeometries(geometries),material);geometries.forEach(g=>g.dispose());mesh.castShadow=true;mesh.receiveShadow=true;body.add(mesh);}if(lines.length)body.add(...lines);body.name='body:'+name;
  }
  // Native rod and pawl hinges are relative to the elbow; retain that hierarchy.
  b.carrier.add(b.rod,b.pawl);v.root.traverse(o=>{o.userData={};});
  let meshes=0;v.root.traverse(o=>{if(o.isMesh)meshes++;});
  installations[side]={version:1,names,turns,period:4.4,loopStart:4.4,loopEnd:8.8,sourceTime:0,closure,motion,meshes,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),cameraDirection:[.02,.03,15],object:v.root.toJSON()};
 }finally{p.dispose();v.dispose();}
}
const file='src/simulation/baked/assets/155.json.gz';fs.writeFileSync(file,gzipSync(JSON.stringify({installations}),{level:9}));
const sources=['scripts/bake-elbow-pawl.mjs','src/simulation/mujoco-elbow-pawl/geometry.js','src/simulation/mujoco-elbow-pawl/physics.js','src/simulation/mujoco-elbow-pawl/sync.js',...reports].map(file=>({file,sha256:hash(file)}));
const report={bytes:fs.statSync(file).size,sha256:hash(file),sources,installations:Object.fromEntries(Object.entries(installations).map(([side,{motion,object,...metadata}])=>[side,{...metadata,samples:motion.length}]))};fs.writeFileSync('src/simulation/baked/assets/155.provenance.json',JSON.stringify(report,null,2)+'\n');console.log({bytes:report.bytes,installations:report.installations});
