import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyEngagementEvents} from './lib/weighted-clutch-key-engagement-events.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-key-corner-recovery',input='artifacts/review/087-first-left-key-engagement.json',failed=readStudyReport(input),
 impactFile='artifacts/review/087-first-key-jaw-impact.json',impact=readStudyReport(impactFile).rows.find(r=>r.side==='left'),
 profileFile='artifacts/review/087-reused-left-key-seating.json',profile=readStudyReport(profileFile).profiles[0],
 sources=freezeStudySources([...failed.sources.map(s=>s.file),input,impactFile,profileFile,
  'scripts/lib/weighted-clutch-key-engagement-events.mjs','scripts/check-weighted-clutch-key-corner-recovery.mjs'],prefix),
 state=failed.summaries[0].end,d=makeWeightedClutchKeyEngagementEvents(makeWeightedClutchKeyCandidate(),profile,impact.friction,[impact.originalProfile]),rows=[];
assert(failed.summaries[0].error.message.startsWith('Key engagement position iteration failed'));
for(const h of [.00025,.000125,.0000625,.000043]){
 const r=d.advance(state,h),m=d.mass(state.q),momentum=r.v.map((v,k)=>m[k]*(v-r.freeVelocity[k])-
  r.active.reduce((s,c)=>s+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0));
 rows.push({requestedH:h,time:r.time,q:r.q,v:r.v,phase:r.phase,mode:r.mode,corner:r.seatingCornerImpact,
  cornerBracket:r.cornerBracket,rejectedSteps:r.rejectedSteps,momentumResidual:Math.max(...momentum.map(Math.abs)),
  impulseEnergyResidual:r.impulseEnergyResidual,minimumGap:r.minimumGap});
}
const maximumEventTimeDifference=Math.max(...rows.map(r=>Math.abs(r.time-rows[0].time))),
 maximumEventPositionDifference=Math.max(...rows.flatMap(r=>r.q.map((v,k)=>Math.abs(v-rows[0].q[k]))));
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,rows,
 maximumEventTimeDifference,maximumEventPositionDifference,
 qualification:'Regression at the exact preserved failing left-cusp state. Four requested step sizes locate the earliest seated-corner arrival, preserve momentum and release the shaft from the formerly loaded key wall. This addresses the local Newton failure without replacing the contact event by an endpoint snap.'})+'\n',{flag:'wx'});
for(const r of rows)assert(r.corner&&r.cornerBracket[1]-r.cornerBracket[0]<1.1e-11&&r.momentumResidual<1e-9&&Math.abs(r.impulseEnergyResidual)<1e-9&&r.minimumGap> -2e-9);
assert(maximumEventTimeDifference<1e-10&&maximumEventPositionDifference<1e-10);
console.log({cases:rows.length,maximumEventTimeDifference,maximumEventPositionDifference,
 events:rows.map(r=>({requestedH:r.requestedH,time:r.time,mode:r.mode,retries:r.rejectedSteps.length}))});
