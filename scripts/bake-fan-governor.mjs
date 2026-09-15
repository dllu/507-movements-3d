import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeFanGovernorGeometry} from '../src/simulation/mujoco-fan-governor/geometry.js';
import {fanGovernorCycle} from '../src/simulation/mujoco-fan-governor/cycle.js';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sampleFile=process.env.CYCLE_SAMPLES??'/dev/shm/147-cycle-baseline.json';
const assembly=JSON.parse(fs.readFileSync('docs/validation/147-candidate-assembly.json'));
assert.equal(hash(sampleFile),assembly.sampleHash);assert.equal(assembly.summary.failingPairs,0);
for(const s of assembly.sources)assert.equal(hash(s.file),s.sha256,s.file);
const recorded=JSON.parse(fs.readFileSync(sampleFile)).samples,period=fanGovernorCycle.period;
const begin=recorded[0],end=recorded.at(-1),count=recorded.length-1;
assert.ok(Math.abs(end.lift-begin.lift)<1e-7&&Math.abs(end.yaw-begin.yaw-12*Math.PI)<1e-7);
// Start near the engraving's raised configuration, with the fans facing front.
const start=recorded.slice(0,-1).reduce((best,s,i)=>s.lift>recorded[best].lift?i:best,0);
const samples=Array.from({length:count+1},(_,i)=>{
 const index=start+i,loops=Math.floor(index/count),s=recorded[index%count];
 return {...s,time:i*period/count,shaft:s.shaft+loops*12*Math.PI,yaw:s.yaw+loops*12*Math.PI,
  roll0:s.roll0+loops*(end.roll0-begin.roll0),roll1:s.roll1+loops*(end.roll1-begin.roll1)};
});
const first=samples[0],last=samples.at(-1);
const visual=makeFanGovernorGeometry({segments:320});
try{
 const bounds=new THREE.Box3();
 for(const s of samples){visual.sync({...s,shaft:s.shaft-first.yaw,yaw:s.yaw-first.yaw});bounds.union(new THREE.Box3().setFromObject(visual.root,true));}
 visual.sync({shaft:0,lift:0,yaw:0,roll0:0,roll1:0});
 // Preserve each rigid body's coordinates and normals, merging only meshes
 // with the same material. This removes the 320 separate track draw calls.
 for(const [name,body] of Object.entries(visual.root.userData.blocks)){
  body.name='body:'+name;
  const batches=new Map();
  for(const mesh of [...body.children])if(mesh.isMesh){
   mesh.updateMatrix();let g=new THREE.BufferGeometry().copy(mesh.geometry).applyMatrix4(mesh.matrix);
   if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}
   g.deleteAttribute('uv');
   if(!batches.has(mesh.material))batches.set(mesh.material,[]);
   batches.get(mesh.material).push(g);body.remove(mesh);mesh.geometry.dispose();
  }
  for(const [material,geometries] of batches){
   const merged=mergeGeometries(geometries),mesh=new THREE.Mesh(merged,material);
   for(const g of geometries)g.dispose();mesh.castShadow=true;mesh.receiveShadow=true;body.add(mesh);
  }
 }
 visual.root.traverse(o=>{o.userData={};});
 const motion=samples.map(s=>[s.time-first.time,s.shaft-first.yaw,s.lift,s.yaw-first.yaw,s.roll0-first.roll0,s.roll1-first.roll1]);
 motion[0][0]=0;motion.at(-1)[0]=period;
 const sources=['scripts/bake-fan-governor.mjs','src/simulation/mujoco-fan-governor/geometry.js','src/simulation/mujoco-fan-governor/cycle.js','docs/validation/147-speed-cycle-fine.json','docs/validation/147-candidate-assembly.json'].map(file=>({file,sha256:hash(file)}));
 const metadata={version:1,names:['shaft','lift','yaw','roll0','roll1'],period,loopStart:0,loopEnd:period,startSample:start,
  turns:[12*Math.PI,0,12*Math.PI,last.roll0-first.roll0,last.roll1-first.roll1],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},sources,sampleHash:hash(sampleFile)};
 const file='src/simulation/baked/assets/147.json.gz';
 fs.writeFileSync(file,gzipSync(JSON.stringify({...metadata,motion,object:visual.root.toJSON()}),{level:9}));
 let meshes=0;visual.root.traverse(o=>{if(o.isMesh)meshes++;});
 const provenance={...metadata,bytes:fs.statSync(file).size,sha256:hash(file),samples:motion.length,meshes};
 fs.writeFileSync('src/simulation/baked/assets/147.provenance.json',JSON.stringify(provenance,null,2)+'\n');console.log({bytes:provenance.bytes,meshes,samples:motion.length});
}finally{visual.dispose();}
