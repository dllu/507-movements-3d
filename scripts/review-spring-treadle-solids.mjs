import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeSpringTreadleSolids} from '../src/simulation/mujoco-spring-return-treadle/solids.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const sampleFile=process.env.SAMPLES??'/dev/shm/160-coupled-0.000125.json',samples=JSON.parse(fs.readFileSync(sampleFile)).filter(r=>r.time>=11.999),v=makeSpringTreadleSolids({segments:Number(process.env.SEGMENTS??32),tailSegments:Number(process.env.TAIL_SEGMENTS??6)}),u=v.root.userData;
try{
 const parts=Object.entries(u.parts).filter(([n])=>n!=='band').map(([name,mesh])=>({name,mesh,family:u.families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family||a.family!=='fixed').map(b=>[a,b]));
 const joined=new Set(['leaf/springClamp','leaf/springAnchorStem','springAnchorHead/springAnchorStem','treadleAnchorHead/treadleAnchorStem'].map(s=>s.split('/').sort().join('/'))),failures={},fastenings={};let checks=0;
 for(let pose=0;pose<=128;pose++){
  v.update(samples[Math.round((samples.length-1)*pose/128)]);
  for(const p of parts){if(p.name==='leaf'){p.solid=solidSurface(p.mesh.geometry);p.points=surfacePoints(p.mesh.geometry);}p.box=new THREE.Box3().setFromObject(p.mesh,true);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b]of pairs){if(pose&&a.family===b.family&&a.family!=='spring'||!a.box.intersectsBox(b.box))continue;
   const name=[a.name,b.name].sort().join('/'),target=joined.has(name)?fastenings:failures;
   for(const [from,to]of [[a,b],[b,a]]){
    const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);assert.ok(Number.isFinite(depth));if(depth<=1e-6)continue;const e=target[name]??{firstPose:pose,maximumDepth:0,points:0};e.maximumDepth=Math.max(e.maximumDepth,depth);e.points++;target[name]=e;}
   }
  }
 }
 const report={movement:160,method:'Bidirectional visible mesh vertices, edge midpoints and triangle centers; 129 settled-cycle poses, dynamic leaf rebuilt at each. Same rigid moving-body pairs once, fixed-frame unions excluded. Only named root clamp and fastening unions classified as intentional. Band reviewed separately. Finite sampling, not continuous collision proof.',parts:parts.length,pairs:pairs.length,poses:129,checks,failures,fastenings,sources:['scripts/review-spring-treadle-solids.mjs','src/simulation/mujoco-spring-return-treadle/solids.js','src/simulation/curve-tube-buffer.js',sampleFile,'tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync(process.env.REPORT??'docs/validation/160-solid-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));assert.equal(Object.keys(failures).length,0);
}finally{v.dispose();}
