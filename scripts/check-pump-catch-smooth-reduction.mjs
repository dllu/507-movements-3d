import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchDynamics,inverse2} from './lib/pump-catch-dynamics.mjs';
import {makePumpCatchSlackDynamics} from './lib/pump-catch-slack-dynamics.mjs';
import {makePumpCatchBoundsContact} from './lib/pump-catch-bounds-contact.mjs';
import {pumpCatchSmoothStep} from './lib/pump-catch-smooth-step.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-smooth-reduction-controls',input='artifacts/review/086-complete-sixteenth-ms.json.gz',
  data=readStudyReport(input),model=makePumpCatchCompleteCandidate(),p=data.parameters,
  full=makePumpCatchSlackDynamics(model,p),reduced=makePumpCatchDynamics(model,p),contact=makePumpCatchBoundsContact(model),results=[];
verifyStudySources(data.sources);
for(const time of [3,6]){
  const before=data.rows[Math.round(time/data.step)],r=pumpCatchSmoothStep(full,contact,before,time+.01,.01,data.angularSpeed);
  assert(r.integration,'Expected smooth return at '+time);
  const q=before.q.slice(0,2),v=before.v.slice(0,2),m=reduced.at(q,v),
    hinge=p.hingeDrag*(v[1]-v[0]),force=[m.force[0]-p.hubDrag*(v[0]-p.inputAngularSpeed)+hinge-p.pumpDrag*p.radius**2*v[0],m.force[1]-hinge];
  let expected;
  if(time===3){const inverse=inverse2(m.M);expected=inverse.map(row=>row.reduce((s,v,k)=>s+v*force[k],0));}
  else{const acceleration=(force[0]+force[1])/(m.M[0][0]+2*m.M[0][1]+m.M[1][1]);expected=[acceleration,acceleration];}
  expected.push(-p.radius*expected[0]);const error=Math.max(...expected.map((a,k)=>Math.abs(a-r.stages[0].acceleration[k])));
  assert(error<1e-12,'Eliminated-load equations match the three-coordinate constraint solve');
  assert(Math.abs(r.q[2]+p.radius*r.q[0])<1e-12);
  const incompatible={...before,v:before.v.map((v,k)=>v+(k===2?.01:0))};
  assert(pumpCatchSmoothStep(full,contact,incompatible,time+.01,.01,data.angularSpeed).unsupported,'Reject non-tangent initial velocity');
  results.push({time,error,expected,rejectedIncompatibleVelocity:true});
}
const sources=freezeStudySources([input,'scripts/check-pump-catch-smooth-reduction.mjs','scripts/lib/pump-catch-smooth-step.mjs',...data.sources.map(s=>s.file)],prefix);
verifyStudySources(sources);const report={movement:86,passed:true,results,sources,
  qualification:'Independent elimination of the pump coordinate gives the two-coordinate loaded-wheel mass matrix and pump-drag torque. Adding the held heel reduces this again to one coordinate. Both accelerations match the full constrained solve; incompatible initial velocities are rejected.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
