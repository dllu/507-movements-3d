import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeCordTreadleSolids} from '../src/simulation/mujoco-cord-treadle/solids.js';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
const sampleFile=process.env.SAMPLES??'/dev/shm/159-with-anchors.json',rows=JSON.parse(fs.readFileSync(sampleFile));
const assembly=makeCordTreadleSolids(),radius=.045,spacing=.015,minimum={},contacts={};let queries=0;
try{
 const parts=Object.entries(assembly.root.userData.parts).map(([name,mesh])=>({name,mesh,surface:solidSurface(mesh.geometry)}));
 for(const row of rows){
  assembly.update(row);
  for(const part of parts){part.inverse=part.mesh.matrixWorld.clone().invert();part.box=new THREE.Box3().setFromObject(part.mesh).expandByScalar(radius+spacing);}
  const points=row.points.map(p=>new THREE.Vector3(...p)),lengths=points.slice(1).map((p,i)=>p.distanceTo(points[i])),total=lengths.reduce((a,b)=>a+b,0);let material=0;
  for(let i=0;i<lengths.length;i++){
   const count=Math.ceil(lengths[i]/spacing),segmentBox=new THREE.Box3().setFromPoints([points[i],points[i+1]]);
   for(const part of parts){if(!segmentBox.intersectsBox(part.box))continue;
    for(let j=0;j<=count;j++){
     const distance=material+lengths[i]*j/count;
     // Only the local embedded ends are intended fastening intersections.
     if(part.name==='crankCordAnchor'&&distance<.15||part.name==='treadleCordAnchor'&&total-distance<.15)continue;
     const point=points[i].clone().lerp(points[i+1],j/count).applyMatrix4(part.inverse);
     const clearance=part.surface.signedDistance(point)-radius;queries++;assert.ok(Number.isFinite(clearance),`Nonfinite distance to ${part.name}`);
     const target=['pulleyCore','pulleyRearFlange','pulleyFrontFlange'].includes(part.name)||part.name==='floor'?contacts:minimum;
     if(!target[part.name]||clearance<target[part.name].clearance)target[part.name]={clearance,time:row.time,materialDistance:distance};
    }
   }
   material+=lengths[i];
  }
 }
 const failures=Object.fromEntries(Object.entries(minimum).filter(([,value])=>value.clearance<-.001));
 const files=['scripts/review-cord-treadle-rope-hardware.mjs','src/simulation/mujoco-cord-treadle/solids.js','tests/helpers/solid-surface.mjs',sampleFile];
 const report={movement:159,method:'Native poses every .02 s; rope centerlines sampled at <=.015 display units, minus capsule radius .045, against actual visible triangle surfaces. Intended embedding excluded only within .15 material units of the matching anchor. Pulley and floor contact depths reported separately. Spatial distance sampling can miss up to half the spacing; no continuous-time proof.',samples:rows.length,queries,minimum,contacts,failures,sources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync(process.env.REPORT??'docs/validation/159-rope-hardware.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.equal(Object.keys(failures).length,0);
}finally{assembly.dispose();}
