import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate,THREE} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchLostMotionCandidate} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {makeWeightedClutchNativeCouplings} from './lib/weighted-clutch-native-couplings.mjs';
import {nativePlateContours,pointInsidePolygon,rotate2} from './lib/weighted-clutch-native-contours.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-native-couplings',parent=readStudyReport('artifacts/review/087-first-flight-checkpoint.json'),
 sources=freezeStudySources([...parent.sources.map(s=>s.file).filter(f=>!f.endsWith('.md')),
  'scripts/lib/weighted-clutch-independent-candidate.mjs','scripts/lib/weighted-clutch-native-contours.mjs',
  'scripts/lib/weighted-clutch-native-couplings.mjs','scripts/study-weighted-clutch-native-couplings.mjs'],prefix),
 model=makeWeightedClutchIndependentCandidate(),original=makeWeightedClutchLostMotionCandidate(),u=model.root.userData,
 coupling=makeWeightedClutchNativeCouplings(model),p=coupling.parameters,C=u.lostMotion.parameters,
 surfaces=new Map(['slottedQuadrant','slotFollowerPin','leftSlidingJaw','rightSlidingJaw','clutchForkShoe'].map(n=>[n,solidSurface(u.parts[n].geometry)]));
const distance=(name,point)=>{
 const mesh=u.parts[name],local=new THREE.Vector3(...point).applyMatrix4(mesh.matrixWorld.clone().invert());return surfaces.get(name).signedDistance(local,.02);
};
let maximumParityError=0,minimumInterior=Infinity,maximumWitnessResidual=0,maximumForkGradientError=0;
const parity=[],slotWitnesses=[],forkWitnesses=[];
for(const direction of ['leftward','rightward'])for(let i=0;i<=64;i++){
 const q=C.leverLeft*i/64,inputAngle=i*.031,outputAngle=-i*.053,
  state=original.setState({leverAngle:q,direction,inputAngle,outputAngle});
 model.setCoordinates([q,state.shifterAngle,state.clutchShift,outputAngle],inputAngle);
 let error=0;for(const[name,mesh]of Object.entries(u.parts))for(let j=0;j<16;j++)error=Math.max(error,Math.abs(mesh.matrixWorld.elements[j]-original.root.userData.parts[name].matrixWorld.elements[j]));
 maximumParityError=Math.max(maximumParityError,error);parity.push({q,direction,error});
}
for(let i=0;i<=256;i++){
 const theta=p.lower.angle+1e-7+(p.upper.angle-p.lower.angle-2e-7)*i/256;
 assert(p.pin.every(v=>pointInsidePolygon(rotate2(v,theta),p.hole)));
 minimumInterior=Math.min(minimumInterior,theta-p.lower.angle,p.upper.angle-theta);
}
for(const side of ['lower','upper']){
 const event=p[side];assert(p.events.every(e=>e.angle<=p.lower.angle+1e-10||e.angle>=p.upper.angle-1e-10));
 for(const q of [.1,.6,1.3]){
  const s=q+event.angle;model.setCoordinates([q,s,0,.27]);
  const xy=rotate2(event.point,q).map((v,i)=>v+p.F[i]),point=[...xy,1.15],
   distances={quadrant:distance('slottedQuadrant',point),pin:distance('slotFollowerPin',point)};
  maximumWitnessResidual=Math.max(maximumWitnessResidual,...Object.values(distances).map(Math.abs));slotWitnesses.push({side,q,s,event,point,distances});
 }
}
const shoepos=u.parts.clutchForkShoe.geometry.attributes.position,zs=Array.from({length:shoepos.count},(_,i)=>shoepos.getZ(i)),zEnds=[Math.min(...zs),Math.max(...zs)];
for(let i=0;i<=128;i++){
 const s=C.shifterRight-.0003+(C.shifterLeft-C.shifterRight+.0006)*i/128,h=1e-6,at=coupling.fork(s,0),before=coupling.fork(s-h,0),after=coupling.fork(s+h,0);
 for(const [j,contact]of at.entries()){
  maximumForkGradientError=Math.max(maximumForkGradientError,Math.abs((after[j].gap-before[j].gap)/(2*h)-contact.gradient[1]));
  const x=contact.gap*(j===0?1:-1);model.setCoordinates([.7,s,x,.47]);
  for(const z of zEnds){
   const point=[...contact.point,z],distances={shoe:distance('clutchForkShoe',point),jaw:distance(j===0?'leftSlidingJaw':'rightSlidingJaw',point)};
   maximumWitnessResidual=Math.max(maximumWitnessResidual,...Object.values(distances).map(Math.abs));
   forkWitnesses.push({s,x,kind:contact.kind,point,radius:Math.hypot(point[1],point[2]),distances});
  }
 }
}
verifyStudySources(sources);
const baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json');for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,parameters:p,
 maximumParityError,maximumWitnessResidual,maximumForkGradientError,minimumInterior,parity,slotWitnesses,forkWitnesses,
 diagnosticDifferences:{lower:p.lower.angle-(C.lower-C.followerAngle),upper:p.upper.angle-(C.upper-C.followerAngle)},
 qualification:'Native connected slot-angle interval from all finite vertex/edge events; diagnostic-transform parity; full 3D surface witnesses at both slot stops and both finite fork walls; independent fork derivatives. Does not qualify impact dynamics, jaw contact or full surrounding clearances.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({nativeLower:p.lower.angle,nativeUpper:p.upper.angle,diagnosticDifferences:report.diagnosticDifferences,events:p.events.length,
 parity:parity.length,slotWitnesses:slotWitnesses.length,forkWitnesses:forkWitnesses.length,maximumParityError,maximumWitnessResidual,maximumForkGradientError});
assert(maximumParityError<1e-12&&maximumWitnessResidual<1e-10&&maximumForkGradientError<1e-6);
