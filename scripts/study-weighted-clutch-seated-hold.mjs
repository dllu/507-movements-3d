import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchLoadedSeating} from './lib/weighted-clutch-loaded-seating.mjs';
import {projectClutchSeatingVelocity} from './lib/weighted-clutch-seating-contact.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-seated-hold',
 seatingPrefix=process.env.PROBE_SEATING??'artifacts/review/087-quarter-step-loaded-seating',
 seatingFile=seatingPrefix+'.json',seating=readStudyReport(seatingFile),
 profileFile=process.env.PROBE_PROFILE??'artifacts/review/087-first-seating-profile.json',profiles=readStudyReport(profileFile),
 impacts=readStudyReport('artifacts/review/087-first-gravity-jaw-impact.json'),
 sources=freezeStudySources([...seating.sources.map(s=>s.file),seatingFile,'scripts/study-weighted-clutch-seated-hold.mjs'],prefix),
 model=makeWeightedClutchIndependentCandidate(),branches=[];
verifyStudySources(seating.sources);
for(const branch of seating.summaries){
 assert(branch.seat&&!branch.error);const profile=profiles.profiles.find(p=>p.direction===branch.direction),
  impact=impacts.rows.find(r=>r.direction===branch.direction),d=makeWeightedClutchLoadedSeating(model,impact,profile),
  start=branch.end,omega=d.parameters.omegaOutput,pose=t=>start.q.map((v,k)=>v+(k===3?omega*(t-start.time):0)),
  gap=t=>{const q=pose(t);return d.stud.evaluate(q[0],q[3]/model.root.userData.geometry.eRatio).gap;};
 let low=start.time,high=null;
 for(let t=low+.02;t<low+80;t+=.02)if(gap(t)<=0){high=t;break;}
 assert(high!==null,'Stud must return within one E revolution');low=high-.02;
 for(let i=0;i<44;i++){const m=(low+high)/2;if(gap(m)>0)low=m;else high=m;}
 const endTime=(low+high)/2,rows=[];let firstLoss=null,maximumAcceleration=0,maximumPowerResidual=0,minimumReaction=Infinity;
 for(let i=0;i<=1024;i++){
  const time=start.time+(endTime-start.time)*i/1024,q=pose(time),v=[0,0,0,omega],m=d.mass(q),force=d.forces(q,v),
   constraints=d.query(q,time).filter(c=>c.kind!=='stud'&&c.gap<2e-8).map(c=>({...c,target:0})),
   result=projectClutchSeatingVelocity(force.map((f,k)=>f/m[k]),m,constraints),
   acceleration=Math.max(...result.v.map(Math.abs)),
   motorPower=result.active.reduce((s,c)=>s-c.impulse*c.inputGradient*d.parameters.omegaInput,0),
   potentialPower=d.outputGravity.at(q[3]).derivative*omega,
   row={time,q,v,phase:d.phase(q,time),studGap:gap(time),reactions:result.active.map(({impulse,...c})=>({...c,force:impulse})),
    acceleration:result.v,motorPower,potentialPower,powerResidual:motorPower-potentialPower};
  rows.push(row);maximumAcceleration=Math.max(maximumAcceleration,acceleration);
  maximumPowerResidual=Math.max(maximumPowerResidual,Math.abs(row.powerResidual));
  minimumReaction=Math.min(minimumReaction,...result.active.map(c=>c.impulse));
  if(!firstLoss&&acceleration>1e-7)firstLoss=row;
 }
 const result={direction:branch.direction,startTime:start.time,timeToNextStud:endTime-start.time,endTime,
  start:rows[0],end:rows.at(-1),firstLoss,maximumAcceleration,maximumPowerResidual,minimumReaction,rows};
 branches.push(result);console.log({direction:branch.direction,timeToNextStud:result.timeToNextStud,end:result.end.q,
  firstLoss:firstLoss&&{time:firstLoss.time,acceleration:firstLoss.acceleration},maximumAcceleration,maximumPowerResidual,minimumReaction});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,branches,
 qualification:'Static feasibility of the seated branch while the eccentric output turns at its motor-imposed gear speed. Reaction forces are solved at 1,025 phases through the next native stud-contact root. Any nonzero projected acceleration invalidates the assumed holding path. This is not a simulation of the subsequent lifting stroke or proof of repeat closure.'})+'\n',{flag:'wx'});
assert(branches.every(b=>!b.firstLoss&&b.maximumPowerResidual<1e-8));
