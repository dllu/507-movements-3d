import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeSpringTreadleSolids} from '../src/simulation/mujoco-spring-return-treadle/solids.js';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
const rows=JSON.parse(fs.readFileSync('/dev/shm/160-coupled-0.000125.json')).filter((r,i)=>i>=1200&&i%4===0),v=makeSpringTreadleSolids(),radius=.048,minimum={},contact={},fixedSurfaces=new Map();let queries=0;
try{
 for(const row of rows){
  v.update(row);const curve=v.root.userData.bandCurve,length=curve.getLength(),count=Math.ceil(length/.01);
  for(const [name,mesh]of Object.entries(v.root.userData.parts)){
   if(name==='band')continue;
   if(!fixedSurfaces.has(name)||name==='leaf')fixedSurfaces.set(name,solidSurface(mesh.geometry));
   const surface=fixedSurfaces.get(name),inverse=mesh.matrixWorld.clone().invert(),box=new THREE.Box3().setFromObject(mesh).expandByScalar(radius+.01);
   for(let i=0;i<=count;i++){
    const distance=length*i/count;
    if(name.startsWith('springAnchor')&&distance<.15||name.startsWith('treadleAnchor')&&length-distance<.15)continue;
    const p=curve.getPoint(i/count);if(!box.containsPoint(p))continue;
    const clearance=surface.signedDistance(p.applyMatrix4(inverse))-radius;queries++;assert.ok(Number.isFinite(clearance),name);
    const target=name.startsWith('pulley')&&['pulleyCore','pulleyRearFlange','pulleyFrontFlange'].includes(name)?contact:minimum;
    if(!target[name]||clearance<target[name].clearance)target[name]={clearance,time:row.time,materialDistance:distance};
   }
  }
 }
 const failures=Object.entries({...minimum,...contact}).filter(([,s])=>s.clearance<-.001),report={movement:160,poses:rows.length,queries,method:'Signed distances from band centerline points at <=0.01 world spacing to actual visible triangle meshes, minus band radius. Only terminal 0.15 units at each own fastening excluded. Pulley contact recorded separately and limited to 0.001 penetration. Expanded-box rejection certifies >0.01 clearance at rejected sample points. Sampled clearance, not continuous-time or full rigid-pair qualification.',minimum,pulleyContact:contact,failures,sources:['scripts/review-spring-treadle-hardware.mjs','src/simulation/mujoco-spring-return-treadle/solids.js','src/simulation/mujoco-spring-return-treadle/band-route.js','src/simulation/axially-separated-band.js','docs/validation/160-coupled.json'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/160-band-hardware.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));assert.equal(failures.length,0);
}finally{v.dispose();}
