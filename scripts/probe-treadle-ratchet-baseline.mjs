import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {surfacePoints,solidSurface} from '../tests/helpers/solid-surface.mjs';

const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 frozen=JSON.parse(fs.readFileSync('artifacts/review/081-production-source-hashes.json'));
for(const [file,h] of Object.entries(frozen))if(hash(file)!==h)throw Error('Changed input '+file);
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')),
 model=createMovementModel(catalog.movements[81]),u=model.root.userData,b=u.blocks,g=u.geometry,
 names={wheel:b.ratchetBody,frontPawl:b.frontPawl.userData.body,rearPawl:b.rearPawl.userData.body,
  frontFinger:b.frontPawl.userData.contactFinger,rearFinger:b.rearPawl.userData.contactFinger},
 parts=Object.fromEntries(Object.entries(names).map(([name,mesh])=>[name,{mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}])),
 pairs=Object.keys(parts).filter(k=>k!=='wheel').map(name=>({a:name,b:'wheel',checks:0,intrusions:0,maximumDepth:0,worst:null})),
 phases=Array.from({length:129},(_,i)=>i/128);
let minimumResetAngle=Infinity,maximumResetAngle=-Infinity;
for(const phase of phases){
 model.update((phase-g.initialCyclePhase)/g.cyclesPerSecond);model.root.updateMatrixWorld(true);
 const s=u.kinematics,angle=s.frontDriving?s.rearPawlAngle:s.frontPawlAngle;
 minimumResetAngle=Math.min(minimumResetAngle,angle);maximumResetAngle=Math.max(maximumResetAngle,angle);
 for(const row of pairs)for(const [an,bn] of [[row.a,row.b],[row.b,row.a]]){
  const a=parts[an],b=parts[bn],matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
  for(const p of a.points){const q=p.clone().applyMatrix4(matrix);row.checks++;
   if(!b.solid.inside(q))continue;const depth=b.solid.distance(q);if(depth<=1e-6)continue;
   row.intrusions++;if(depth>row.maximumDepth){row.maximumDepth=depth;row.worst={phase,sampleOn:an,inside:bn,point:q.toArray()};}
  }
 }
}
const sources=['scripts/probe-treadle-ratchet-baseline.mjs','src/simulation/authored-intermittent.js','tests/helpers/solid-surface.mjs'],
 report={movement:82,status:'baseline-contact-screen',productionChanged:false,mechanicsPassed:false,poses:phases.length,pairs,
 checks:pairs.reduce((s,r)=>s+r.checks,0),intrusions:pairs.reduce((s,r)=>s+r.intrusions,0),
 maximumDepth:Math.max(...pairs.map(r=>r.maximumDepth)),resetAngleRange:[minimumResetAngle,maximumResetAngle],
 geometry:g,sourceCommit:'c13f7ec03ee2dd2d7c0ccb5b0b560373f14fa97e',sources:sources.map(file=>({file,sha256:hash(file)})),
 qualification:'Selected finite pawl/ratchet solids, sampled bidirectionally at 129 poses. This rejects interference but does not certify other pairs or continuous motion.'};
for(const [file,h] of Object.entries(frozen))if(hash(file)!==h)throw Error('Changed input '+file);
fs.writeFileSync('artifacts/review/082-baseline-surfaces.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({checks:report.checks,intrusions:report.intrusions,maximumDepth:report.maximumDepth,pairs});
