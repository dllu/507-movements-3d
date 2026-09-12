import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,hashStudyFile,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-study',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);
const names=['086-baseline-surfaces.json','086-baseline-captures.json','086-first-source-measurements.json','086-first-candidate-surfaces.json',
  '086-first-candidate-captures.json','086-first-cam-seating.json'],files=new Set(['scripts/record-pump-catch-study.mjs','scripts/prepare-pump-catch-source.mjs']),reports=[];
for(const name of names){const file='artifacts/review/'+name,d=readStudyReport(file);verifyStudySources(d.sources);for(const s of d.sources)files.add(s.file);reports.push({file,sha256:hashStudyFile(file)});}
const baseline=readStudyReport(reports[0].file),candidate=readStudyReport('artifacts/review/086-first-candidate-surfaces.json'),seating=readStudyReport('artifacts/review/086-first-cam-seating.json');
assert(baseline.intrusions>0);assert(baseline.maximumContactMomentArm<1e-12);assert(candidate.topology.every(p=>p.closed));assert.equal(candidate.sourceIntrusions.length,0);assert(seating.passed);
const inspections=[];
for(const[name,count,assessment]of [['086-baseline-captures.json',10,'Rejected baseline: wrong proportions and contact geometry.'],
  ['086-first-candidate-captures.json',7,'Core geometry follows the source. Accepted as an initial reconstruction study only; rope, load, rear drive and final rendering remain incomplete.']]){
  const d=readStudyReport('artifacts/review/'+name);assert.equal(d.views.length,count);assert.equal(d.errors.length,0);assert.equal(d.unexpectedWarnings.length,0);
  for(const v of d.views){assert.equal(hashStudyFile(v.file),v.sha256);inspections.push({file:v.file,sha256:v.sha256,inspected:true,assessment});}
}
const measurement=readStudyReport('artifacts/review/086-first-source-measurements.json');assert.equal(hashStudyFile(measurement.image.file),measurement.image.sha256);
inspections.push({...measurement.image,inspected:true,assessment:'Circle overlay inspected. Measured front-bearing center adopted as the common shaft axis; fitted rim circles agree closely with the visible strokes.'});
for(const file of ['artifacts/reference/brown-086-detail.png','artifacts/reference/mm_086.png'])inspections.push({file,sha256:hashStudyFile(file),inspected:true,assessment:'Original engraving inspected; complete mechanism retained.'});
const provenance=readStudyReport('artifacts/review/086-source-provenance.json');assert.equal(hashStudyFile(provenance.output),provenance.sha256);assert.equal(hashStudyFile(provenance.source),provenance.sourceSha256);
const prior83=readStudyReport('artifacts/review/083-thirtysecond-complete-checkpoint.json'),prior82=readStudyReport('artifacts/review/082-bounded-writer-checkpoint.json');
verifyStudySources(prior83.sources);verifyStudySources(prior82.sources);
const sources=freezeStudySources([...files],prefix),checkpoint={movement:86,status:'source-core-reconstruction-and-first-contact-study',created:new Date().toISOString(),
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,full507GoalStillActive:true,ownedBrowserRunning:false,ownedStudyRunning:false,
  frozenProductionInputsMatched:Object.keys(frozen).length,priorStudySourcesUnchanged:{movement83:prior83.sources.length,movement82:prior82.sources.length},
  provenance,reports,inspections,sources,remaining:['Complete pump rope, load and rear input apparatus','Resolve coupled catch/wheel dynamics and stop release',
    'Verify forces, step-size agreement and continuous finite clearance','Prepare readable playback and finish rendering','Integrate and run final production checks'],
  qualification:'Baseline rejection, source measurements, thirteen closed core solids, diagnostic surface checks and first finite cam/hook contact are recorded. Prescribed diagnostic sweeps do not establish functioning dynamics. Production and prior unfinished studies remain unchanged; no full-suite or integration pass is claimed.'};
fs.writeFileSync(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});console.log({...checkpoint,sources:sources.length,inspections:inspections.length,reports:undefined,provenance:undefined});
