import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate,THREE} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchNativeKey} from './lib/weighted-clutch-native-key.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-native-key',parent=readStudyReport('artifacts/review/087-refined-seating-cusps.json'),
 sources=freezeStudySources([...parent.sources.map(s=>s.file),'scripts/lib/weighted-clutch-key-candidate.mjs',
  'scripts/lib/weighted-clutch-native-key.mjs','scripts/study-weighted-clutch-native-key.mjs'],prefix),
 model=makeWeightedClutchKeyCandidate(),control=makeWeightedClutchIndependentCandidate(),u=model.root.userData,key=makeWeightedClutchNativeKey(model),
 parity=[],witnesses=[],gradients=[],surfaces={};
for(const name of ['shaftFeather','leftSlidingJaw','rightSlidingJaw'])surfaces[name]=solidSurface(u.parts[name].geometry);
for(let i=0;i<=32;i++){
 const q=[1.46*i/32,.133*i/32,-.246*i/32,.37*i],input=-.12*i;
 model.setCoordinates([...q,q[3]],input);control.setCoordinates(q,input);
 parity.push(Math.max(...Object.keys(u.parts).flatMap(name=>u.parts[name].matrixWorld.elements.map((v,k)=>Math.abs(v-control.root.userData.parts[name].matrixWorld.elements[k])))));
}
for(const[e,index]of [[key.parameters.lower,0],[key.parameters.upper,1]])for(const x of [-.247,-.12,0])for(const spin of [0,.63,2.17]){
 const q=[.7,.066,x,spin+e.angle,spin],contact=key.query(q)[index];model.setCoordinates(q,-.47);
 for(const[side,dz]of [['left',-.03],['right',.03]]){
  const name=side+'SlidingJaw',local=new THREE.Vector3(...contact.point,u.geometry.waist+dz),world=local.clone().applyMatrix4(u.blocks.D.matrixWorld),distances={};
  for(const part of ['shaftFeather',name])distances[part]=surfaces[part].signedDistance(world.clone().applyMatrix4(u.parts[part].matrixWorld.clone().invert()),.02);
  witnesses.push({side,x,spin,kind:contact.kind,gap:contact.gap,world:world.toArray(),distances});
 }
}
for(let i=0;i<=256;i++){
 const gamma=key.parameters.lower.angle+(key.parameters.upper.angle-key.parameters.lower.angle)*i/256,q=[0,0,-.12,gamma,0];
 for(const c of key.query(q)){
  const h=1e-7,a=key.query([0,0,-.12,gamma+h,0]).find(x=>x.kind===c.kind),b=key.query([0,0,-.12,gamma-h,0]).find(x=>x.kind===c.kind);
  gradients.push(Math.abs((a.gap-b.gap)/(2*h)-c.gradient[3]));assert(c.gap>=-1e-12);
 }
}
verifyStudySources(sources);const baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json');for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
const maximumWitnessError=Math.max(...witnesses.flatMap(w=>Object.values(w.distances).map(Math.abs))),
 report={movement:87,productionChanged:false,mechanicsPassed:false,sources,parameters:key.parameters,parity,witnesses,
  maximumParityError:Math.max(...parity),maximumGradientError:Math.max(...gradients),maximumWitnessError};
fs.writeFileSync(prefix+'.json',JSON.stringify(report)+'\n',{flag:'wx'});
console.log({parts:Object.keys(u.parts).length,limits:[key.parameters.lower.angle,key.parameters.upper.angle],witnesses:witnesses.length,
 maximumParityError:report.maximumParityError,maximumGradientError:report.maximumGradientError,maximumWitnessError});
assert(report.maximumParityError<1e-12&&report.maximumGradientError<1e-7&&maximumWitnessError<1e-9);
