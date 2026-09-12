import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate,THREE} from './lib/pump-catch-complete-candidate.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {verifyPumpCatchStudySources} from './lib/pump-catch-study-sources.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-first-complete-dynamics.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-complete-rope',data=readStudyReport(input);
const nonmechanicalChanges=verifyPumpCatchStudySources(data.sources);
const sources=freezeStudySources([input,'scripts/check-pump-catch-complete-rope.mjs','scripts/lib/pump-catch-study-sources.mjs',...pumpCatchCompleteSources,'tests/helpers/solid-surface.mjs'],prefix),
  model=makePumpCatchCompleteCandidate(),u=model.root.userData,clamp=solidSurface(u.parts.wheelRopeClamp.geometry),head=solidSurface(u.parts.pumpCrosshead.geometry),
  selected=new Set(Array.from({length:201},(_,i)=>Math.round((data.rows.length-1)*i/200)));
for(const key of [0,2])for(const sign of [-1,1]){let index=0;for(let i=1;i<data.rows.length;i++)if(sign*data.rows[i].q[key]>sign*data.rows[index].q[key])index=i;selected.add(index);}
const errors={length:0,sectionRadius:0,anchor:0,load:0},rows=[];
for(const i of [...selected].sort((a,b)=>a-b)){
  const r=data.rows[i];model.setState({wheelAngle:r.q[0],catchAngle:r.q[1]-r.q[0],camAngle:data.angularSpeed*r.time,pumpHeight:r.q[2]});
  // Recover circular section centers from the actual position/UV buffers.
  // Duplicate seam/cap vertices do not get extra weight. Neither the model's
  // centerline nor its reported quadrature length enters this measurement.
  const geometry=u.parts.pumpRope.geometry,p=geometry.attributes.position,uv=geometry.attributes.uv,sections=new Map();
  for(let j=0;j<p.count;j++){
    if(uv.getY(j)===1)continue;const a=uv.getX(j),b=uv.getY(j),ring=sections.get(a)??new Map();
    if(!ring.has(b))ring.set(b,new THREE.Vector3().fromBufferAttribute(p,j));sections.set(a,ring);
  }
  const centers=[...sections.entries()].sort((a,b)=>a[0]-b[0]).map(([,ring])=>{
    assert.equal(ring.size,24);const points=[...ring.values()],center=points.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);
    for(const p of points)errors.sectionRadius=Math.max(errors.sectionRadius,Math.abs(p.distanceTo(center)-u.completeHardware.ropeRadius));return center;
  });
  let length=0;for(let j=1;j<centers.length;j++)length+=centers[j].distanceTo(centers[j-1]);
  const anchor=centers[0].clone().applyMatrix4(u.parts.wheelRopeClamp.matrixWorld.clone().invert()),load=centers.at(-1).clone().applyMatrix4(u.parts.pumpCrosshead.matrixWorld.clone().invert()),
    anchorGap=clamp.distance(anchor),loadGap=head.distance(load);
  errors.length=Math.max(errors.length,Math.abs(length-u.completeHardware.ropeLength));errors.anchor=Math.max(errors.anchor,anchorGap);errors.load=Math.max(errors.load,loadGap);
  rows.push({time:r.time,sections:centers.length,length,anchorGap,loadGap});
}
verifyStudySources(sources);const report={movement:86,status:'independent-rendered-rope-length-and-termination-screen',passed:errors.length<1e-5&&errors.sectionRadius<1e-6&&errors.anchor<1e-6&&errors.load<1e-6,
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,input,poses:rows.length,errors,rows,sources,nonmechanicalChanges,
  qualification:'Actual mesh section centers measure polygonal centerline length and radius; endpoint centers are checked against the actual clamp and crosshead surfaces. Sampling includes coordinate extrema. The 1e-5 length tolerance allows curve tessellation, not stretch in the analytic massless rope. This does not prove continuous clearance or a finite-mass slack equilibrium.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,sources:undefined});if(!report.passed)process.exitCode=1;
