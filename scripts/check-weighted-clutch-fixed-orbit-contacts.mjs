import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate,THREE} from './lib/weighted-clutch-distributed-candidate.mjs';
import {sourceFitStudContacts} from './lib/weighted-clutch-source-fit.mjs';
import {distributedClutchSources} from './lib/weighted-clutch-distributed-sources.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-fixed-orbit-contacts',
  input=process.env.PROBE_INPUT??'artifacts/review/087-first-fixed-orbit-fit.json',fit=readStudyReport(input),
  model=makeWeightedClutchDistributedCandidate(fit.options),u=model.root.userData,L=u.linkage.parameters,
  native=makeWeightedClutchNativeStud(model),p=native.parameters,rows=[],
  sources=freezeStudySources([...distributedClutchSources,input,'scripts/check-weighted-clutch-fixed-orbit-contacts.mjs',
    'scripts/lib/weighted-clutch-native-stud.mjs','tests/helpers/solid-surface.mjs'],prefix),
  surfaces=Object.fromEntries(['bellCrankG','reversingStud'].map(name=>[name,solidSurface(u.parts[name].geometry)])),
  rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
verifyStudySources(fit.sources);
function identity(r){
  function ids(support,center,angle,offset,vertices){
    return support.map(point=>{
      const local=rotate(point.map((v,i)=>v-center[i]),-angle).map((v,i)=>v-offset[i]);
      let index=-1,distance=Infinity;
      for(let i=0;i<vertices.length;i++){
        const d=Math.hypot(...local.map((v,k)=>v-vertices[i][k]));if(d<distance){index=i;distance=d;}
      }
      assert(distance<1e-9);return index;
    }).sort((a,b)=>a-b);
  }
  return JSON.stringify({G:ids(r.supportA,p.G,r.bellAngle,[0,0],p.patch),stud:ids(r.supportB,p.E,r.wheelAngle,p.offset,p.stud)});
}
let minimumForward=Infinity,minimumReturn=Infinity,maximumGapResidual=0,maximumDerivativeError=0,maximumWitnessDistance=0,
  minimumCutDistance=Infinity,featureCrossings=0;
for(const direction of ['CCW','CW'])for(let i=0;i<=128;i++){
  const q=direction==='CCW'?L.overCenterAngle*i/128:L.leverLeft-(L.leverLeft-L.overCenterAngle)*i/128,
    analytic=sourceFitStudContacts(u.linkage,q).contacts.filter(c=>c['approach'+direction]);
  assert.equal(analytic.length,1);
  const r=native.root(q,analytic[0].theta,direction),sign=direction==='CCW'?1:-1,beta=u.linkage.atAngle(q).beta,
    usefulMoment=sign*r.torqueG*beta,expected=[r.torqueG*beta,r.derivativeE],id=identity(r),stencils=[],accepted=[0,0],
    before=native.evaluate(q,r.wheelAngle-sign*1e-5),after=native.evaluate(q,r.wheelAngle+sign*1e-5);
  assert(before.gap>0&&after.gap<0&&sign*r.derivativeE<0&&usefulMoment>0);
  for(const h of [1e-5,2e-6,4e-7,8e-8,1.6e-8])for(let coordinate=0;coordinate<2;coordinate++){
    const lo=[q,r.wheelAngle],hi=[q,r.wheelAngle];lo[coordinate]-=h;hi[coordinate]+=h;
    const a=native.evaluate(...lo),b=native.evaluate(...hi),sameFeature=identity(a)===id&&identity(b)===id,
      derivative=(b.gap-a.gap)/(2*h),error=Math.abs(derivative-expected[coordinate]);
    if(sameFeature){accepted[coordinate]++;maximumDerivativeError=Math.max(maximumDerivativeError,error);assert(error<2e-6);}
    else featureCrossings++;
    stencils.push({h,coordinate,derivative,error,sameFeature,before:identity(a),after:identity(b)});
  }
  assert(accepted.every(n=>n>=3));
  const witnesses=[];
  if(i%16===0){
    model.setCoordinates([q,0,0,r.wheelAngle*u.geometry.eRatio,r.wheelAngle*u.geometry.eRatio],0);
    for(const[name,point]of [['bellCrankG',r.pointA],['reversingStud',r.pointB]]){
      const world=[...point,1.25],mesh=u.parts[name],local=new THREE.Vector3(...world).applyMatrix4(mesh.matrixWorld.clone().invert()),
        distance=surfaces[name].signedDistance(local,.02);
      maximumWitnessDistance=Math.max(maximumWitnessDistance,Math.abs(distance));witnesses.push({name,world,distance});
    }
  }
  if(direction==='CCW')minimumForward=Math.min(minimumForward,usefulMoment);else minimumReturn=Math.min(minimumReturn,usefulMoment);
  maximumGapResidual=Math.max(maximumGapResidual,Math.abs(r.gap));minimumCutDistance=Math.min(minimumCutDistance,r.contactForwardCoordinate-p.cut);
  rows.push({...r,beta,usefulMoment,beforeGap:before.gap,afterGap:after.gap,expected,accepted,stencils,witnesses});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,input,options:fit.options,parameters:p,rows,minimumForward,minimumReturn,maximumGapResidual,maximumDerivativeError,
  maximumWitnessDistance,minimumCutDistance,featureCrossings,
  qualification:'258 native G/stud contacts for the fixed-orbit fit, including entry signs, positive generalized lifting moments, support-identified finite differences and 36 full-solid witnesses. Derivative checks require at least three stencils per coordinate on the same native contact features. Stencils that cross a feature are retained separately. Witness poses isolate the G/E pair; complete driven-hardware clearance and gravity dynamics remain pending.'},null,2)+'\n',{flag:'wx'});
console.log({contacts:rows.length,minimumForward,minimumReturn,maximumGapResidual,maximumDerivativeError,maximumWitnessDistance,minimumCutDistance,featureCrossings});
assert(maximumGapResidual<1e-11&&maximumWitnessDistance<1e-9&&minimumCutDistance>.2);
