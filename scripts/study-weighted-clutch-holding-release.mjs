import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchSeatingEvents} from './lib/weighted-clutch-seating-events.mjs';
import {solveClutchSystem} from './lib/weighted-clutch-seating-contact.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-return-holding-release',
 holdFile='artifacts/review/087-return-seated-hold.json',hold=readStudyReport(holdFile),branch=hold.branches[0],
 profileFile='artifacts/review/087-wide-return-seating-profile.json',profile=readStudyReport(profileFile).profiles[0],
 impact=readStudyReport('artifacts/review/087-first-gravity-jaw-impact.json').rows.find(r=>r.direction==='CW'),
 sources=freezeStudySources([...hold.sources.map(s=>s.file),holdFile,'scripts/lib/weighted-clutch-seating-events.mjs',
  'scripts/study-weighted-clutch-holding-release.mjs'],prefix),model=makeWeightedClutchIndependentCandidate(),
 d=makeWeightedClutchSeatingEvents(model,impact,profile),omega=d.parameters.omegaOutput,
 pose=t=>branch.start.q.map((v,k)=>v+(k===3?omega*(t-branch.startTime):0)),velocity=[0,0,0,omega];
verifyStudySources(hold.sources);assert(branch.direction==='CW'&&branch.firstLoss);
function reactions(time){
 const q=pose(time),force=d.forces(q,velocity),constraints=d.query(q,time).filter(c=>c.kind!=='stud'&&c.gap<2e-8);
 assert.equal(constraints.length,4);
 const lambda=solveClutchSystem([0,1,2,3].map(k=>constraints.map(c=>c.gradient[k])),force.map(v=>-v));
 assert(lambda);return{time,q,phase:d.phase(q,time),force,constraints,lambda,minimum:Math.min(...lambda)};
}
let hi=branch.firstLoss.time,lo=branch.rows[branch.rows.indexOf(branch.firstLoss)-1]?.time;
// The JSON copy of firstLoss is a distinct object; locate its clock instead.
lo=branch.rows.filter(r=>r.time<hi).at(-1).time;
assert(reactions(lo).minimum>=0&&reactions(hi).minimum<0);
for(let i=0;i<44;i++){const m=(lo+hi)/2;if(reactions(m).minimum>=0)lo=m;else hi=m;}
const root=reactions((lo+hi)/2),energy=d.energy(root.q,velocity),initial={time:root.time,q:root.q,v:velocity,phase:root.phase,
 energy,initialEnergy:energy,loss:0,work:0,defect:0,absoluteDefect:0,active:[]},rows=[initial],h=Number(process.env.PROBE_DT??.0000625);
let state=initial,error=null;
try{while(state.time<initial.time+2){state=d.advance(state,h);rows.push(state);}}
catch(e){error={message:e.message,stack:e.stack};}
const summary={direction:'CW',h,states:rows.length,parameters:d.parameters,root,bracket:[lo,hi],start:initial,end:state,error,
 timeBeforeStud:branch.endTime-root.time,maximumWithdrawal:Math.max(...rows.map(r=>initial.q[2]-r.q[2])),
 maximumOutputSpeedDeparture:Math.max(...rows.map(r=>Math.abs(r.v[3]-omega)))};
verifyStudySources(sources);await writeGzipStudyReport(prefix+'-CW.json.gz',
 {movement:87,productionChanged:false,mechanicsPassed:false,sources,...summary,rows});
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,summaries:[summary],
 qualification:'First zero of an unconstrained seated normal reaction, bracketed between compressive and tensile equilibria. Subsequent four-coordinate motion tests the resulting loss of contact under output gravity. The later fixed-clutch path in the parent static screen is infeasible and is not used as motion evidence.'})+'\n',{flag:'wx'});
console.log({rootTime:root.time,lambda:root.lambda,timeBeforeStud:summary.timeBeforeStud,states:rows.length,error,
 maximumWithdrawal:summary.maximumWithdrawal,maximumOutputSpeedDeparture:summary.maximumOutputSpeedDeparture,end:{time:state.time,q:state.q,v:state.v}});
assert(!error&&summary.timeBeforeStud>0&&summary.maximumWithdrawal>0);
