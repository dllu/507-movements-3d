import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {pumpCatchHardwareBounds} from './lib/pump-catch-hardware-bounds.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {ring,plate,poly} from '../src/simulation/finite-plate-geometry.js';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-hardware-controls',input='artifacts/review/086-complete-sixteenth-ms-summary.json',data=readStudyReport(input),
  range=data.range,camRange=[data.angularSpeed*data.actualEnd,0],baseline=pumpCatchHardwareBounds(makePumpCatchCompleteCandidate(),{range,camRange}),results=[];
assert.equal(baseline.unresolved.length,0);assert.equal(baseline.primaryPairs.length,7);
const cases=[
  {name:'undersized-shaft-bore',part:'frontBearingLip',pair:['frontBearingLip','inputShaft'],change:u=>ring(u.geometry.bore-.005,.235,.43,.49,128)},
  {name:'solid-crosshead-guide-hole',part:'pumpCrosshead',pair:['pumpCrosshead','pumpGuideLeft'],
    change:()=>plate(poly([[-.31,-.12],[.31,-.12],[.31,.12],[-.31,.12]]),0,.16).rotateX(Math.PI/2)},
  {name:'band-bed-interference',part:'rearDriveRim',pair:['rearDriveRim','inputDriveBand'],change:u=>u.parts.rearDriveRim.geometry.clone().scale(1.02,1.02,1)},
  {name:'misplaced-plinth-opening',part:'basePlinth',pair:['basePlinth','pumpCrosshead'],change:u=>u.parts.basePlinth.geometry.clone().scale(.9,1,1)},
];
for(const c of cases){
  const model=makePumpCatchCompleteCandidate(),u=model.root.userData,geometry=c.change(u);u.parts[c.part].geometry.dispose();u.parts[c.part].geometry=geometry;
  const result=pumpCatchHardwareBounds(model,{range,camRange}),p=result.pairs.find(p=>c.pair.includes(p.a)&&c.pair.includes(p.b));
  assert(p&&!p.certified&&p.method!=='primary-contact',c.name+' must not be certified');results.push({name:c.name,pair:p,rejected:true});
}
const sources=freezeStudySources([input,'scripts/check-pump-catch-hardware-controls.mjs','scripts/lib/pump-catch-hardware-bounds.mjs',...pumpCatchCompleteSources,
  'tests/helpers/solid-surface.mjs'],prefix);verifyStudySources(sources);
const report={movement:86,passed:true,baselineCertified:baseline.pairs.filter(p=>p.certified).length,baselinePrimary:baseline.primaryPairs.length,results,sources,
  qualification:'Actual-mesh controls deliberately close a shaft bore and a guide hole, enlarge a band contact bed and displace the plinth passage. The relevant interference is rejected in each case. These fixtures are isolated models and do not modify candidate or production geometry.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
