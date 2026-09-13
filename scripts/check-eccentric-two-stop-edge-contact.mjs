import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/088-production-edge-contact',input='artifacts/review/088-production-contact-normals.json',parent=readStudyReport(input),
  sources=freezeStudySources([...parent.sources.map(s=>s.file),input,'scripts/check-eccentric-two-stop-edge-contact.mjs'],prefix),rows=[];
verifyStudySources(parent.sources);
for(const r of parent.rows){
  const candidates=r.nearest.map(n=>({...n,inPlane:Math.hypot(n.normal[0],n.normal[1]),
    projectedAlignment:n.normal.slice(0,2).reduce((s,v,i)=>s+v*r.claimedFaceNormal[i],0)/Math.hypot(n.normal[0],n.normal[1])}))
    .filter(n=>n.inPlane>.1&&n.normal[2]>.1&&n.projectedAlignment>.999999&&n.outputAxisTorquePerUnitNormalForce<0);
  assert(candidates.length>0,'No driving-edge normal at '+r.time);
  rows.push({time:r.time,activeStop:r.activeStop,distance:r.distance,candidates});
}
const normals=rows.flatMap(r=>r.candidates),summary={states:rows.length,maximumGap:Math.max(...rows.map(r=>r.distance)),
  minimumProjectedAlignment:Math.min(...normals.map(n=>n.projectedAlignment)),
  minimumClockwiseTorqueArm:Math.min(...normals.map(n=>-n.outputAxisTorquePerUnitNormalForce)),
  maximumClockwiseTorqueArm:Math.max(...normals.map(n=>-n.outputAxisTorquePerUnitNormalForce))};
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:88,productionChanged:false,mechanicsPassed:false,sources,summary,rows,
  rejectedHypothesis:{file:input,exitCode:1,reason:'The axial-only normal assertion was false. Tied nearest triangles include a bevel normal whose in-plane projection supports the intended clockwise drive.'},
  qualification:'The current cone apex reaches the cam edge within Float32 precision and has an available torque-bearing cam normal. This rejects the missing-contact/axial-only hypothesis. It does not establish finite stop fidelity, complete solid topology, passive drive/dwell dynamics or source acceptance.'},null,2)+'\n',{flag:'wx'});
console.log(summary);assert(summary.maximumGap<1e-6);
