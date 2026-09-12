import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makePumpCatchWeightedCandidate} from './lib/pump-catch-weighted-candidate.mjs';
import {makePumpCatchHeelContact} from './lib/pump-catch-heel-contact.mjs';
import {boundaryCone} from './lib/crossed-rack-mesh-prisms.mjs';
import {rotate2,cross2} from './lib/pump-catch-contact.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-heel-controls',model=makePumpCatchWeightedCandidate({headBackDepth:.1,heelStop:true}),u=model.root.userData,
  contact=makePumpCatchHeelContact(model),errors={boundary:0,cone:0,moment:0,gradient:0},rows=[];
const gap=q=>Math.min(...contact.heel(q,{margin:1,raw:true}).map(c=>c.gap));
let low=-.121,high=-.119;
assert(gap([0,low,0])<0);assert(gap([0,high,0])>0);
for(let i=0;i<60;i++){const mid=(low+high)/2;if(gap([0,mid,0])<0)low=mid;else high=mid;}
const angle=(low+high)/2;
for(let i=0;i<101;i++){
  const wheel=-2*Math.PI+4*Math.PI*i/100,q=[wheel,wheel+angle,0],P=rotate2(u.geometry.pivot,wheel),near=contact.heel(q).filter(c=>Math.abs(c.gap)<1e-9);
  assert(near.length);
  for(const c of near){
    const arm=c.point.map((v,k)=>v-P[k]),lugPoint=rotate2(arm,-q[1]),stopPoint=rotate2(arm,-q[0]),
      checks=[boundaryCone(contact.lug,lugPoint,rotate2(c.normal.map(v=>-v),-q[1])),boundaryCone(contact.heelStop,stopPoint,rotate2(c.normal,-q[0]))];
    for(const b of checks){errors.boundary=Math.max(errors.boundary,b.distance);errors.cone=Math.max(errors.cone,b.residual);}
    const moment=cross2(arm,c.normal);errors.moment=Math.max(errors.moment,Math.abs(c.gradient[0]+moment),Math.abs(c.gradient[1]-moment));
    for(let k=0;k<2;k++){
      const a=q.slice(),b=q.slice(),eps=1e-6;a[k]+=eps;b[k]-=eps;
      errors.gradient=Math.max(errors.gradient,Math.abs((gap(a)-gap(b))/(2*eps)-c.gradient[k]));
    }
    assert(c.pointZ>Math.max(contact.lug.low,contact.heelStop.low)&&c.pointZ<Math.min(contact.lug.high,contact.heelStop.high));
    rows.push({q,contact:c,checks});
  }
}
// The lug joins the head's rear cap, and the heel block joins the wheel.
// Check their actual meshes in the source pose, including hidden attachment.
model.setState();
const head=solidSurface(u.parts.catchHeadBack.geometry),lug=u.parts.catchHeelLug.geometry.attributes.position;
for(let i=0;i<lug.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(lug,i);p.z=-.05;assert(head.inside(p),'Heel lug must sit within head backing');
}
const wheel=solidSurface(u.parts.spokedLooseWheelA.geometry),stop=u.parts.wheelHeelStop,positions=stop.geometry.attributes.position;
let attached=0;
for(let i=0;i<positions.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(positions,i).add(stop.position);p.z=-.2;if(wheel.inside(p))attached++;
}
assert(attached>0,'Heel block must overlap the wheel rim in projection');
const sources=freezeStudySources(['scripts/check-pump-catch-heel.mjs','scripts/lib/pump-catch-heel-contact.mjs','scripts/lib/pump-catch-weighted-candidate.mjs',
  'scripts/lib/pump-catch-normal-contact.mjs','scripts/lib/pump-catch-contact.mjs','scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs',
  'scripts/lib/crossed-rack-mesh-prisms.mjs','src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js',
  'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','tests/helpers/solid-surface.mjs','scripts/lib/study-report-io.mjs'],prefix);
verifyStudySources(sources);
const report={movement:86,status:'finite-heel-stop-boundary-and-moment-controls',passed:Object.values(errors).every(v=>v<1e-7),mechanicsPassed:false,candidateIntegrated:false,
  nominalAngle:u.heelStop.minimumAngle,actualContactAngle:angle,errors,poses:101,attachedSamples:attached,rows,sources,
  qualification:'Actual lug and stop prism boundaries, common normal cones, generalized moments and finite-difference gaps are checked through a full rotation in each direction. Hidden attachment footprints are checked against actual head and rim meshes. These controls do not establish repeated operation or complete swept clearance.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,sources:undefined});if(!report.passed)process.exitCode=1;
