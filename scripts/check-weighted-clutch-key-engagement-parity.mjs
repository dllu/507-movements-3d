import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyDynamics} from './lib/weighted-clutch-key-dynamics.mjs';
import {makeWeightedClutchKeyEngagement} from './lib/weighted-clutch-key-engagement.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-key-engagement-parity',input='artifacts/review/087-first-key-impact.json',initial=readStudyReport(input),
 files=['CCW','CW'].flatMap(d=>['artifacts/review/087-quarter-key-release-'+d+'.json.gz','artifacts/review/087-quarter-key-neutral-'+d+'.json.gz']),
 sources=freezeStudySources([...initial.sources.map(s=>s.file),input,...files,
  'scripts/lib/weighted-clutch-key-engagement.mjs','scripts/check-weighted-clutch-key-engagement-parity.mjs'],prefix),rows=[];
for(const file of files){
 const r=readStudyReport(file),first=initial.rows.find(x=>x.direction===r.direction&&x.staticCoefficient===.78),
  original=makeWeightedClutchKeyDynamics(makeWeightedClutchKeyCandidate(),first.profile,first),
  both=makeWeightedClutchKeyEngagement(makeWeightedClutchKeyCandidate(),first.profile,first);
 for(let i=0;i<17;i++){
  const state=r.rows[Math.floor((r.rows.length-2)*i/17)],h=1e-5,a=original.step(state,h),b=both.step(state,h);
  rows.push({file,time:state.time,positionError:Math.max(...a.q.map((v,k)=>Math.abs(v-b.q[k]))),
   velocityError:Math.max(...a.v.map((v,k)=>Math.abs(v-b.v[k]))),energyError:Math.abs(a.energy-b.energy),
   workError:Math.abs(a.work-b.work),lossError:Math.abs(a.loss-b.loss)});
 }
}
verifyStudySources(sources);const maxima=Object.fromEntries(['positionError','velocityError','energyError','workError','lossError'].map(k=>[k,Math.max(...rows.map(r=>r[k]))]));
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,rows,maxima,
 qualification:'The two-jaw engagement step reproduces the frozen key-friction integrator at 68 prior lifting/withdrawal/neutral states where the opposite jaw is safely separated. This checks the integrator refactor and conservative jaw omission; it does not substitute for actual two-jaw engagement checks.'})+'\n',{flag:'wx'});
console.log({states:rows.length,...maxima});assert(Object.values(maxima).every(x=>x<1e-8));
