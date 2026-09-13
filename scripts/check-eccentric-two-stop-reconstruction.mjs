import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeEccentricTwoStopCompleteCandidate,THREE} from './lib/eccentric-two-stop-complete-candidate.mjs';
import {makeEccentricTwoStopDynamics} from './lib/eccentric-two-stop-dynamics.mjs';
import {auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';
import {nativePlateContours} from './lib/weighted-clutch-native-contours.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/088-reconstruction-check',fineFile='artifacts/review/088-gravity-fine.json.gz',coarseFile='artifacts/review/088-gravity-coarse.json.gz',
  fine=readStudyReport(fineFile),coarse=readStudyReport(coarseFile),model=makeEccentricTwoStopCompleteCandidate(fine.options),u=model.root.userData,d=makeEccentricTwoStopDynamics(model),
  sources=freezeStudySources([...fine.sources.map(s=>s.file),fineFile,coarseFile,'scripts/check-eccentric-two-stop-reconstruction.mjs',
    'scripts/lib/weighted-clutch-fit-audit.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','tests/helpers/solid-surface.mjs'],prefix);
verifyStudySources(fine.sources);verifyStudySources(coarse.sources);assert(!fine.error&&!coarse.error);
let maximumCoordinateDifference=0,maximumMomentumResidual=0,maximumGravityResidual=0,maximumBrakeExcess=0,maximumImpulseEnergyResidual=0;
for(let i=1;i<fine.rows.length;i++) {
  const a=fine.rows[i-1],b=fine.rows[i],h=b.time-a.time,g=b.contact?.outputGradient??0;
  maximumMomentumResidual=Math.max(maximumMomentumResidual,Math.abs(d.parameters.inertia*(b.speed-a.speed)-b.gravityImpulse-b.brakeImpulse-b.normalImpulse*g));
  maximumGravityResidual=Math.max(maximumGravityResidual,Math.abs(b.gravityImpulse-h*d.gravityTorque(a.output)));
  maximumBrakeExcess=Math.max(maximumBrakeExcess,Math.abs(b.brakeImpulse)-h*d.parameters.brakeAcceleration*d.parameters.inertia);
  maximumImpulseEnergyResidual=Math.max(maximumImpulseEnergyResidual,Math.abs(b.impulseEnergyResidual));
  assert(b.normalImpulse>=-1e-12 && (b.gap===null||b.gap>=-1e-10));
  assert(b.brakeImpulse*b.free<=1e-12);
  if(i%2===0)maximumCoordinateDifference=Math.max(maximumCoordinateDifference,Math.abs(b.output-coarse.rows[i/2].output));
}
assert(maximumCoordinateDifference<.002 && maximumMomentumResidual<1e-10 && maximumGravityResidual<1e-12 && maximumBrakeExcess<1e-10 && maximumImpulseEnergyResidual<1e-10);
assert(Math.abs(fine.closure.outputError)<1e-10 && fine.closure.speedError===0 && Math.abs(coarse.closure.outputError)<1e-10);
const rest=fine.events.filter(e=>e.kind==='rest'),increments=rest.slice(1).map((r,i)=>r.output-rest[i].output);
assert(increments.length>=3 && increments.every(x=>Math.abs(x+Math.PI)<.03));
// Gravity from the inferred eccentric rear disk makes the two stopping
// overshoots slightly different. A complete two-index cycle still closes.
const derivativeChecks=[];
for(const event of fine.events.filter(e=>e.kind==='contact')) {
  const target=event.time+.7,row=fine.rows[Math.round(target/fine.parameters.h)]; if(!row?.contact)continue;
  const eps=1e-7,min=(a,b)=>d.contact.query(a,b)[0].gap;
  const input=(min(row.input+eps,row.output)-min(row.input-eps,row.output))/(2*eps),
    output=(min(row.input,row.output+eps)-min(row.input,row.output-eps))/(2*eps),
    c=row.contact,entry={time:row.time,inputError:Math.abs(input-c.inputGradient),outputError:Math.abs(output-c.outputGradient)};
  derivativeChecks.push(entry);assert(entry.inputError<1e-5&&entry.outputError<1e-5);
}
const poses=[];
for(const [name,time]of [['source',0],['C-driven',1.6],['C-release',fine.events.find(e=>e.kind==='release').time],
  ['first-rest',rest[0].time+.1],['D-driven',12],['D-release',fine.events.filter(e=>e.kind==='release')[1].time],['second-rest',rest[1].time+.1]]) {
  const row=fine.rows[Math.round(time/fine.parameters.h)];model.setCoordinates(row.input,row.output);
  const solids=auditClutchSourceSolids(model);poses.push({name,time:row.time,input:row.input,output:row.output,...solids});
  console.log({name,checks:solids.checks,issues:solids.issues.length,topologyIssues:solids.topologyIssues.length});
  assert(!solids.issues.length&&!solids.topologyIssues.length);
}
model.setCoordinates(0,0);
const contour=nativePlateContours(u.parts.camA.geometry).sort((a,b)=>b.length-a.length)[0],
  project=p=>[p[0]*100+277,282-p[1]*100],outline=contour.map(project),
  sourceDistances=u.source.cam.map(point=>{
    let distance=Infinity;
    for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],dx=b[0]-a[0],dy=b[1]-a[1],
      f=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
      distance=Math.min(distance,Math.hypot(point[0]-a[0]-f*dx,point[1]-a[1]-f*dy));}
    return distance;
  });
assert(Math.max(...sourceDistances)<.1);
const result={movement:88,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,checksPassed:true,sources,
  states:fine.rows.length,maximumCoordinateDifference,maximumMomentumResidual,maximumGravityResidual,maximumBrakeExcess,maximumImpulseEnergyResidual,
  closure:fine.closure,stoppedIncrements:increments,derivativeChecks,poses,
  source:{camMean:sourceDistances.reduce((a,b)=>a+b,0)/sourceDistances.length,camMaximum:Math.max(...sourceDistances),
    distances:sourceDistances,registration:'One world-to-source mapping with the measured input at [277,282] and scale 100. No additional cam fit.',
    outputAxis:u.geometry.O,rearDiskCenterOffset:u.geometry.rearDiskCenterOffset},
  qualification:'Independent phase-gradient, momentum, dry brake, step-halving, repeated endpoint, source contour and seven full-solid pose checks. The hidden axis, small rear-disk eccentricity and stepped foot construction are explicit reconstruction assumptions. Continuous clearance and final playback remain separate.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({...result,sources:undefined,poses:poses.length,closure:{outputError:result.closure.outputError},source:result.source});
