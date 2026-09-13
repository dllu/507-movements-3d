import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

for(const level of ['coarse','fine']){
  const prefix='artifacts/review/087-fixed-orbit-seating-'+level,
    inputs=['CW','CCW'].map(d=>'artifacts/review/087-fixed-orbit-seating-'+d+'-'+level+'.json'),
    reports=inputs.map(readStudyReport),sources=freezeStudySources([...reports.flatMap(r=>r.sources.map(s=>s.file)),...inputs,
      'scripts/collect-weighted-clutch-fixed-orbit-seating.mjs'],prefix+'-collection'),
    summaries=reports.flatMap(r=>r.summaries);
  for(const r of reports)verifyStudySources(r.sources);
  assert.deepEqual(reports[0].options,reports[1].options);
  assert.equal(summaries.length,2);assert.equal(new Set(summaries.map(s=>s.direction)).size,2);
  assert(summaries.every(s=>s.settled&&!s.error));verifyStudySources(sources);
  fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
    sources,options:reports[0].options,inputs,summaries,
    qualification:'Collects the two independently run direction reports without altering any state, profile, time or trajectory. Both report observed seating. Independent native geometry and convergence checks are recorded separately.'})+'\n',{flag:'wx'});
  console.log({level,states:summaries.reduce((n,s)=>n+s.states,0),seats:summaries.map(s=>({direction:s.direction,time:s.seat.time}))});
}
