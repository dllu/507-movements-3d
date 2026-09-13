import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate,THREE} from './lib/weighted-clutch-distributed-candidate.mjs';
import {sourceFitStudContacts,sourceFitBranchMargins} from './lib/weighted-clutch-source-fit.mjs';
import {distributedClutchSources} from './lib/weighted-clutch-distributed-sources.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-distributed-contacts',
  input='artifacts/review/087-first-distributed-source-fit.json',fit=readStudyReport(input),
  options={shifts:fit.selected.shifts,freeAngle:fit.freeAngle},model=makeWeightedClutchDistributedCandidate(options),
  u=model.root.userData,L=u.linkage.parameters,native=makeWeightedClutchNativeStud(model),rows=[],
  sources=freezeStudySources([...distributedClutchSources,input,'scripts/study-weighted-clutch-distributed-contacts.mjs',
    'scripts/lib/weighted-clutch-native-stud.mjs','tests/helpers/solid-surface.mjs'],prefix),
  surfaces=Object.fromEntries(['bellCrankG','reversingStud'].map(name=>[name,solidSurface(u.parts[name].geometry)]));
verifyStudySources(fit.sources);
let minimumForward=Infinity,minimumReturn=Infinity,maximumGapResidual=0,maximumDerivativeError=0,maximumWitnessDistance=0,minimumCutDistance=Infinity;
for(const direction of ['CCW','CW'])for(let i=0;i<=128;i++){
  const q=direction==='CCW'?L.overCenterAngle*i/128:L.leverLeft-(L.leverLeft-L.overCenterAngle)*i/128,
    analytic=sourceFitStudContacts(u.linkage,q).contacts.filter(c=>c['approach'+direction]);
  assert.equal(analytic.length,1);
  const r=native.root(q,analytic[0].theta,direction),sign=direction==='CCW'?1:-1,
    beta=u.linkage.atAngle(q).beta,usefulMoment=sign*r.torqueG*beta,
    before=native.evaluate(q,r.wheelAngle-sign*1e-5),after=native.evaluate(q,r.wheelAngle+sign*1e-5),derivatives=[];
  assert(before.gap>0&&after.gap<0&&sign*r.derivativeE<0&&usefulMoment>0);
  for(const h of [1e-5,2e-6,4e-7]){
    const dq=(native.evaluate(q+h,r.wheelAngle).gap-native.evaluate(q-h,r.wheelAngle).gap)/(2*h),
      de=(native.evaluate(q,r.wheelAngle+h).gap-native.evaluate(q,r.wheelAngle-h).gap)/(2*h);
    derivatives.push({h,dq,de});
    maximumDerivativeError=Math.max(maximumDerivativeError,Math.abs(dq-r.torqueG*beta),Math.abs(de-r.derivativeE));
  }
  const witnesses=[];
  if(i%16===0){
    model.setCoordinates([q,0,0,r.wheelAngle*u.geometry.eRatio,r.wheelAngle*u.geometry.eRatio],0);
    for(const[name,p]of [['bellCrankG',r.pointA],['reversingStud',r.pointB]]){
      const mesh=u.parts[name],world=[...p,1.25],local=new THREE.Vector3(...world).applyMatrix4(mesh.matrixWorld.clone().invert()),
        distance=surfaces[name].signedDistance(local,.02);
      maximumWitnessDistance=Math.max(maximumWitnessDistance,Math.abs(distance));witnesses.push({name,world,distance});
    }
  }
  if(direction==='CCW')minimumForward=Math.min(minimumForward,usefulMoment);else minimumReturn=Math.min(minimumReturn,usefulMoment);
  maximumGapResidual=Math.max(maximumGapResidual,Math.abs(r.gap));minimumCutDistance=Math.min(minimumCutDistance,r.contactForwardCoordinate-native.parameters.cut);
  rows.push({...r,beta,usefulMoment,beforeGap:before.gap,afterGap:after.gap,derivatives,witnesses});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options,sourceAdjustments:u.sourceAdjustments,parameters:native.parameters,rows,minimumForward,minimumReturn,
  maximumGapResidual,maximumDerivativeError,maximumWitnessDistance,minimumCutDistance,
  analyticMargins:sourceFitBranchMargins(u.linkage,2048),
  qualification:'258 native polygon contacts across both lifting branches of the distributed source fit. Useful force moments are generalized to F, with finite-difference gap derivatives and 36 full-solid witnesses. The witness poses isolate G/E contact; they are not a full driven-hardware trajectory or a gravity solution.'},null,2)+'\n',{flag:'wx'});
console.log({contacts:rows.length,minimumForward,minimumReturn,maximumGapResidual,maximumDerivativeError,maximumWitnessDistance,minimumCutDistance});
assert(maximumGapResidual<1e-11&&maximumDerivativeError<1e-5&&maximumWitnessDistance<1e-9&&minimumCutDistance>.2);
