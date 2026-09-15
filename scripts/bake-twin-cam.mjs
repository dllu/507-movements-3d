import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeTwinCamPhysics} from '../src/simulation/mujoco-twin-cam/physics.js';
import {makeTwinCamGeometry} from '../src/simulation/mujoco-twin-cam/geometry.js';
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for(const file of ['docs/validation/149-guided-fine.json','docs/validation/149-guided-assembly.json']){
 const r=JSON.parse(fs.readFileSync(file));for(const s of r.sources)assert.equal(hash(s.file),s.sha256,s.file);
 if(r.summary.failingPairs!==undefined)assert.equal(r.summary.failingPairs,0);
}
const p=makeTwinCamPhysics(await loadMujoco(),{timestep:.00025}),v=makeTwinCamGeometry();
try{
 const names=['shaft','upper','upperRoll','upperRod','lower','lowerRoll','lowerRod','upperSlide','lowerSlide'],samples=[];
 for(let tick=0;tick<=240000;tick++){
  if(tick>=216000&&(tick-216000)%40===0)samples.push(p.state());
  if(tick<240000)p.step();
 }
 const first=samples[0],last=samples.at(-1),turns=names.map(n=>n==='shaft'?2*Math.PI:n.endsWith('Roll')?last[n]-first[n]:0);
 const closure=Object.fromEntries(names.map((n,i)=>[n,last[n]-first[n]-turns[i]]));
 for(const [name,error] of Object.entries(closure))assert.ok(Math.abs(error)<1e-4,name+' closure');
 const motion=samples.map((s,i)=>[i*.01,...names.map(n=>s[n])]);
 // Close tiny measured position residuals at the final sample only. Roller
 // angles retain their measured accumulated spin, rather than jumping to zero.
 motion[motion.length-1]=[6,...names.map((n,i)=>first[n]+turns[i])];
 const bounds=v.root.userData.cameraFitBounds.clone();
 for(const row of motion){v.sync(Object.fromEntries(names.map((n,i)=>[n,row[i+1]])));bounds.union(new THREE.Box3().setFromObject(v.root,true));}
 const {cams,levers,rollers,rods,sliders}=v.root.userData.blocks;
 const bodies=[cams,levers[0],rollers[0],rods[0],levers[1],rollers[1],rods[1],sliders[0],sliders[1]];
 names.forEach((n,i)=>{bodies[i].name='body:'+n;});
 v.sync(Object.fromEntries(names.map(n=>[n,0])));v.root.traverse(o=>{o.userData={};});
 const sources=['scripts/bake-twin-cam.mjs','src/simulation/mujoco-twin-cam/source.js','src/simulation/mujoco-twin-cam/geometry.js','src/simulation/mujoco-twin-cam/physics.js','src/simulation/mujoco/mass.js','docs/validation/149-guided-fine.json','docs/validation/149-guided-assembly.json'].map(file=>({file,sha256:hash(file)}));
 const metadata={version:1,names,turns,period:6,loopStart:0,loopEnd:6,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),cameraDirection:[.05,.03,15],sources,closure};
 const file='src/simulation/baked/assets/149.json.gz';fs.writeFileSync(file,gzipSync(JSON.stringify({...metadata,motion,object:v.root.toJSON()}),{level:9}));
 fs.writeFileSync('src/simulation/baked/assets/149.provenance.json',JSON.stringify({...metadata,bytes:fs.statSync(file).size,sha256:hash(file),samples:motion.length},null,2)+'\n');
 console.log({bytes:fs.statSync(file).size,samples:motion.length,closure});
}finally{v.dispose();p.dispose();}
