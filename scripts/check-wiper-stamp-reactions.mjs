import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeWiperStampCandidate} from './lib/wiper-stamp-candidate.mjs';
import {surfaceTriangles, solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/085-quarter-ms-dynamics.json.gz';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/085-first-reactions';
const data = readStudyReport(input); verifyStudySources(data.sources);
const model = makeWiperStampCandidate(), u = model.root.userData, index = new Map();
function boundary(mesh, point, outward) {
  if (!index.has(mesh.name)) index.set(mesh.name, {solid:solidSurface(mesh.geometry), triangles:surfaceTriangles(mesh.geometry).map(t =>
    ({t, normal:t.getNormal(new THREE.Vector3()), box:new THREE.Box3().setFromPoints([t.a,t.b,t.c])}))});
  const {solid,triangles} = index.get(mesh.name), inverse = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3(...point).applyMatrix4(inverse), target = new THREE.Vector3(...outward).transformDirection(inverse);
  const distance = solid.distance(local), normals = [], closest = new THREE.Vector3(); let supportingError = 0;
  for (const {t,normal,box} of triangles) {
    if (box.distanceToPoint(local)>1e-7 || t.closestPointToPoint(local,closest).distanceTo(local)>1e-7) continue;
    if (!normals.some(n=>n.distanceTo(normal)<1e-10)) normals.push(normal);
    for (const p of [t.a,t.b,t.c]) supportingError=Math.max(supportingError,p.clone().sub(local).dot(target));
  }
  let cone=Infinity;
  for (const [i,a] of normals.entries()) {
    cone=Math.min(cone,a.clone().multiplyScalar(Math.max(0,a.dot(target))).distanceTo(target));
    for (const b of normals.slice(i+1)) {
      const ab=a.dot(b), determinant=1-ab*ab; if(determinant<1e-14) continue;
      const wa=(a.dot(target)-ab*b.dot(target))/determinant,wb=(b.dot(target)-ab*a.dot(target))/determinant;
      if(wa< -1e-8||wb< -1e-8) continue;
      cone=Math.min(cone,a.clone().multiplyScalar(Math.max(0,wa)).addScaledVector(b,Math.max(0,wb)).distanceTo(target));
    }
  }
  return {distance,cone,supportingError,faces:normals.length};
}
const errors={boundary:0,cone:0,supporting:0,momentum:0,position:0,energy:0}, totals={camWork:0,bedWork:0,contactDriftWork:0,plasticStepLoss:0,energyChange:0};
const counts={intervals:0,camReactions:0,bedReactions:0,boundaries:0,failedReactions:0},issues=[];
for(let i=1;i<data.rows.length;i++) {
  const r=data.rows[i],before=data.rows[i-1],dt=r.time-before.time; counts.intervals++;
  model.setState(r); let work=0,drift=0;
  if(r.impulse>1e-10) {
    const cam=r.contact==='cam',normal=cam?r.cam.normal:[0,1],point=cam?[...r.cam.point,.05]
      :[(u.source.head.centerX-u.source.center[0])/u.source.scale,u.geometry.strikeY,u.source.rod.z];
    const a=cam?u.parts.flatProjectionB:u.parts.flaredStampHead,b=cam?u.parts.twoWipers:u.parts.strikingBed;
    const checks=[boundary(a,point,[-normal[0],-normal[1],0]),boundary(b,point,[...normal,0])];
    counts.boundaries+=2;counts[cam?'camReactions':'bedReactions']++;
    for(const c of checks){errors.boundary=Math.max(errors.boundary,c.distance);errors.cone=Math.max(errors.cone,c.cone);errors.supporting=Math.max(errors.supporting,c.supportingError);}
    if(checks.some(c=>c.distance>1e-7||c.cone>2e-5||c.supportingError>2e-7)) {
      counts.failedReactions++;if(issues.length<30)issues.push({time:r.time,contact:r.contact,point,normal,checks});
    }
    const impulse=r.impulse/normal[1],inputNormalVelocity=cam?data.angularSpeed*(-point[1]*normal[0]+point[0]*normal[1]):0;
    work=impulse*inputNormalVelocity;drift=r.impulse*r.velocity-work;
    totals[cam?'camWork':'bedWork']+=work;totals.contactDriftWork+=drift;
  }
  const momentum=r.velocity-before.velocity+data.gravity*dt-r.impulse,position=r.stampY-before.stampY-dt*r.velocity;
  const energy=.5*(r.velocity**2-before.velocity**2)+data.gravity*(r.stampY-before.stampY),loss=.5*(r.velocity-before.velocity)**2;
  errors.momentum=Math.max(errors.momentum,Math.abs(momentum));errors.position=Math.max(errors.position,Math.abs(position));
  errors.energy=Math.max(errors.energy,Math.abs(energy-work-drift+loss));totals.energyChange+=energy;totals.plasticStepLoss+=loss;
}
verifyStudySources(data.sources);
const sources=freezeStudySources([input,'scripts/check-wiper-stamp-reactions.mjs','tests/helpers/solid-surface.mjs',...data.sources.map(s=>s.file)],prefix);
const report={movement:85,status:'actual-mesh-normal-cone-and-energy-audit',productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,
  passed:!counts.failedReactions&&errors.momentum<1e-7&&errors.position<1e-9&&errors.energy<1e-8,input,counts,errors,totals,issues,sources,
  qualification:'Checks every positive support impulse against both actual mesh boundaries and the positive cone of adjacent outward triangle normals. Reconstructs vertical momentum, exact sampled position, shaft work, backward-Euler kinetic loss and contact drift work. The ideal prismatic guide supplies transverse forces and moments at zero work; its finite bearing load is not resolved. No continuous-clearance or continuum-error guarantee is made.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,issues:issues.slice(0,3)});
if(!report.passed)process.exitCode=1;
