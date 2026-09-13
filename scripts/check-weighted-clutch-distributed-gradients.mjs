import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-distributed-feature-gradients',input='artifacts/review/087-first-distributed-contacts.json',
  parent=readStudyReport(input),model=makeWeightedClutchDistributedCandidate(parent.options),native=makeWeightedClutchNativeStud(model),
  p=native.parameters,rows=[],broadStencilChanges=[],
  sources=freezeStudySources([...parent.sources.map(s=>s.file),input,'scripts/check-weighted-clutch-distributed-gradients.mjs'],prefix),
  rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
verifyStudySources(parent.sources);
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
  return {G:ids(r.supportA,p.G,r.bellAngle,[0,0],p.patch),stud:ids(r.supportB,p.E,r.wheelAngle,p.offset,p.stud)};
}
const key=r=>JSON.stringify(identity(r));
let maximumError=0,maximumRootDifference=0;
for(const[index,r]of parent.rows.entries()){
  const center=native.evaluate(r.leverAngle,r.wheelAngle),centerKey=key(center),expected=[r.torqueG*r.beta,r.derivativeE],stencils=[];
  maximumRootDifference=Math.max(maximumRootDifference,Math.abs(center.gap-r.gap));
  for(const h of [1e-5,2e-6,4e-7,8e-8,1.6e-8])for(let coordinate=0;coordinate<2;coordinate++){
    const point=[r.leverAngle,r.wheelAngle],lo=[...point],hi=[...point];lo[coordinate]-=h;hi[coordinate]+=h;
    const a=native.evaluate(...lo),b=native.evaluate(...hi),sameFeature=key(a)===centerKey&&key(b)===centerKey,
      derivative=(b.gap-a.gap)/(2*h),error=Math.abs(derivative-expected[coordinate]),
      stencil={h,coordinate,sameFeature,derivative,error,center:identity(center),before:identity(a),after:identity(b)};
    if(h<=4e-7){assert(sameFeature,'Fine stencil crossed a feature at row '+index);maximumError=Math.max(maximumError,error);assert(error<2e-6);}
    else if(!sameFeature)broadStencilChanges.push({index,direction:r.direction,...stencil});
    else assert(error<1e-5);
    stencils.push(stencil);
  }
  rows.push({index,direction:r.direction,leverAngle:r.leverAngle,wheelAngle:r.wheelAngle,expected,stencils});
}
assert(broadStencilChanges.length===4&&new Set(broadStencilChanges.map(r=>r.index)).size===1);
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,input,rows,broadStencilChanges,maximumError,maximumRootDifference,
  retainedFailure:{file:input,exitCode:1,maximumBroadStencilError:parent.maximumDerivativeError},
  qualification:'The original broad derivative assertion failed at one of 258 native contacts. Support-vertex identities show that both broad stencils cross a different polygon feature there. Three smaller stencil sizes stay on the same features at every contact and independently recover the analytic generalized gradients. The broad failure is preserved, not treated as a physical negative-force result.'},null,2)+'\n',{flag:'wx'});
console.log({contacts:rows.length,broadStencilChanges:broadStencilChanges.length,maximumError,maximumRootDifference});
