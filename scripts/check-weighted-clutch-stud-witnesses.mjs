import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate,THREE} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {makeWeightedClutchCandidate} from './lib/weighted-clutch-candidate.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-stud-witnesses',
 input='artifacts/review/087-first-native-stud.json',report=readStudyReport(input),
 sources=freezeStudySources([...report.sources.map(s=>s.file),'scripts/check-weighted-clutch-stud-witnesses.mjs',input],prefix),
 model=makeWeightedClutchLostMotionCandidate(),u=model.root.userData,G=u.parts.bellCrankG,E=u.parts.reversingStud,
 surfaces={G:solidSurface(G.geometry),E:solidSurface(E.geometry)},rows=[];
function inspect(row){
 model.setState({leverAngle:row.leverAngle,outputAngle:row.wheelAngle*u.geometry.eRatio,
  direction:row.direction==='CW'?'rightward':'leftward'});
 const inverse={G:G.matrixWorld.clone().invert(),E:E.matrixWorld.clone().invert()},distances={};
 for(const[pointName,xy]of [['G',row.pointA],['E',row.pointB]])for(const target of ['G','E']){
  const p=new THREE.Vector3(...xy,1.25).applyMatrix4(inverse[target]);
  distances[pointName+'PointTo'+target]={point:p.toArray(),signedDistance:surfaces[target].signedDistance(p,.02)};
 }
 return{direction:row.direction,leverAngle:row.leverAngle,wheelAngle:row.wheelAngle,distances};
}
const initial=inspect(report.initial),measured=makeWeightedClutchCandidate(),
 measuredContact=makeWeightedClutchNativeStud(measured).evaluate(0,0),measuredWitnesses={};
for(const[pointName,xy,target]of [['G',measuredContact.pointA,'reversingStud'],['E',measuredContact.pointB,'bellCrankG']]){
 const part=measured.root.userData.parts[target],point=new THREE.Vector3(...xy,1.25).applyMatrix4(part.matrixWorld.clone().invert());
 measuredWitnesses[pointName+'PointTo'+target]={point:point.toArray(),signedDistance:solidSurface(part.geometry).signedDistance(point,.02)};
}
const measuredSourcePose={solids:Object.keys(measured.root.userData.parts).length,contact:measuredContact,witnesses:measuredWitnesses};
let maximumSurfaceResidual=0;
for(const r of report.rows){
 const row=inspect(r);rows.push(row);
 for(const d of Object.values(row.distances))maximumSurfaceResidual=Math.max(maximumSurfaceResidual,Math.abs(d.signedDistance));
}
verifyStudySources(sources);
const result={movement:87,input:{file:input,sha256:hashStudyFile(input)},sources,initial,measuredSourcePose,rows,maximumSurfaceResidual,mechanicsPassed:false,
 qualification:'Independent triangle BVH queries against both full 3D solids at the planar contact witnesses, within their shared Z interval. Initial source-pose witnesses prove actual overlap between long edges despite the earlier sampled screen passing. No other-pair or continuous-clearance claim.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({rows:rows.length,maximumSurfaceResidual,initial:initial.distances,measuredSourcePose:{solids:measuredSourcePose.solids,gap:measuredContact.gap,witnesses:measuredWitnesses}});
assert(maximumSurfaceResidual<1e-9);
assert(initial.distances.GPointToE.signedDistance< -.005&&initial.distances.EPointToG.signedDistance< -.005);
assert.equal(measuredSourcePose.solids,207);assert(measuredContact.gap< -.005);
for(const w of Object.values(measuredWitnesses))assert(w.signedDistance< -.005);
