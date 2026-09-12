import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchWeightedCandidate} from './lib/pump-catch-weighted-candidate.mjs';
import {makePumpCatchHeelContact} from './lib/pump-catch-heel-contact.mjs';
import {makePumpCatchBoundsContact} from './lib/pump-catch-bounds-contact.mjs';
import {makePumpCatchContact} from './lib/pump-catch-contact.mjs';
import {makePumpCatchSlackDynamics,pumpCatchImpactStep} from './lib/pump-catch-impact-dynamics.mjs';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-bounds-controls',input='artifacts/review/086-damped-heel-trial.json.gz',data=readStudyReport(input);
for(const s of data.sources){
  assert.equal(hashStudyFile(s.archive??s.file),s.sha256,'Retained input: '+s.file);
  if(s.file!=='scripts/lib/pump-catch-normal-contact.mjs')assert.equal(hashStudyFile(s.file),s.sha256,'Unchanged physical input: '+s.file);
}
const model=makePumpCatchWeightedCandidate(data.parameters.candidateOptions),ordinary=makePumpCatchHeelContact(model),bounded=makePumpCatchBoundsContact(model),
  dynamics=makePumpCatchSlackDynamics(model,data.parameters),timing={ordinary:0,bounded:0},counts={queries:0,steps:0};
const boundaryKeys=Object.fromEntries(['cam','hook','shaft','stop'].map(name=>[name,new Set(ordinary[name].boundary.flatMap(e=>[e.a.join(','),e.b.join(',')]))]));
const isInterior=c=>c.feature&&!boundaryKeys[c.feature.pointOn].has(ordinary[c.feature.pointOn].points[c.feature.vertex]?.join(','));
const raw=makePumpCatchContact(model).query([0,0,0],0,{margin:1}),interiorCapVertices=raw.filter(c=>c.feature&&isInterior(c)).length;
assert(interiorCapVertices>0,'Explicit interior-cap regression must exercise a nonboundary vertex');
const query=(q,angle,margin)=>{
  let started=performance.now();const a=ordinary.query(q,angle,{margin}),ga=ordinary.minimumRawGap(q,angle);timing.ordinary+=performance.now()-started;
  started=performance.now();const b=bounded.query(q,angle,{margin}),gb=bounded.minimumRawGap(q,angle);timing.bounded+=performance.now()-started;
  assert.deepEqual(b,a,'Complete finite feature list');assert.equal(gb,ga,'Raw penetration guard');counts.queries++;
  assert(!a.some(isInterior),'Only side-boundary vertices may supply a planar contact reaction');
};
query([0,0,0],0,1);
for(let i=0;i<data.rows.length;i+=61){const r=data.rows[i];query(r.q,data.angularSpeed*r.time,.01);}
for(let i=0;i<201;i++)query([Math.sin(i*.37)*4,Math.sin(i*.51)*5,0],Math.cos(i*.73)*6,[0,.000001,.01,.1,1][i%5]);
for(let i=1;i<data.rows.length;i+=397){
  const before=data.rows[i-1],saved=data.rows[i],h=saved.time-before.time;
  const a=pumpCatchImpactStep(dynamics,ordinary,before,saved.time,h,data.angularSpeed),b=pumpCatchImpactStep(dynamics,bounded,before,saved.time,h,data.angularSpeed);
  assert.deepEqual(b,a,'Complete impact step');assert.deepEqual(a.q,saved.q,'Retained trajectory position');assert.deepEqual(a.v,saved.v,'Retained trajectory velocity');counts.steps++;
}
// These public surface methods also serve callers outside a contact query.
for(const key of ['cam','hook','shaft','stop'])for(const p of [[0,0],[100,100],[-100,-100]])assert.deepEqual(bounded[key].closest(p),ordinary[key].closest(p));
const sources=freezeStudySources([input,'scripts/check-pump-catch-bounds.mjs','scripts/lib/pump-catch-bounds-contact.mjs',...data.sources.map(s=>s.file)],prefix);verifyStudySources(sources);
const report={movement:86,status:'conservative-contact-box-regression',passed:true,mechanicsPassed:false,candidateIntegrated:false,counts,interiorCapVertices,timing,stats:bounded.stats,
  observedSpeedup:timing.ordinary/timing.bounded,sources,
  qualification:'Every finite feature and raw gap agrees exactly with the original queries across solved and penetrating synthetic poses. Complete impact steps reproduce the retained trajectory exactly. This changes query cost only; it does not establish refined trajectory agreement or continuous clearance.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
