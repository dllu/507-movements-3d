import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate,THREE} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {rotate2} from './lib/weighted-clutch-native-contours.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-native-jaws',steps=Number(process.env.PROBE_STEPS??32),
 parent=readStudyReport('artifacts/review/087-first-native-couplings.json'),
 sources=freezeStudySources([...parent.sources.map(s=>s.file),'scripts/lib/weighted-clutch-native-jaws.mjs','scripts/study-weighted-clutch-native-jaws.mjs'],prefix),
 model=makeWeightedClutchIndependentCandidate(),u=model.root.userData,jaws=makeWeightedClutchNativeJaws(model),
 pitch=2*Math.PI/u.geometry.jawCount,stroke=u.lostMotion.parameters.stroke,
 surfaces=new Map(['leftLooseJaw','leftSlidingJaw','rightLooseJaw','rightSlidingJaw'].map(n=>[n,solidSurface(u.parts[n].geometry)])),rows=[];
let maximumAnalyticError=0,maximumWitnessResidual=0,minimumInitialGap=Infinity;
function distance(name,point){
 const mesh=u.parts[name],p=new THREE.Vector3(...point).applyMatrix4(mesh.matrixWorld.clone().invert());return surfaces.get(name).signedDistance(p,.02);
}
for(const side of ['left','right'])for(let i=0;i<=steps;i++){
 const relativeAngle=pitch*(i/steps-.5),result=jaws.evaluate(side,relativeAngle),wrap=Math.atan2(Math.sin(relativeAngle*u.geometry.jawCount),Math.cos(relativeAngle*u.geometry.jawCount))/u.geometry.jawCount,
  analytic=(side==='left'?stroke:0)+u.geometry.jawAxialRelief-2*u.geometry.jawHeight/pitch*Math.abs(wrap),
  error=result.gap-analytic,x=(side==='left'?-1:1)*result.gap,inputAngle=.173,looseSpin=(side==='left'?1:-1)*u.geometry.mainRatio*inputAngle,
  outputAngle=looseSpin+relativeAngle,point=result.witness.pointLoose,yz=rotate2(point.slice(1),looseSpin),world=[point[0],...yz];
 model.setCoordinates([.7,.05,x,outputAngle],inputAngle);
 const witnesses={loose:distance(side+'LooseJaw',world),sliding:distance(side+'SlidingJaw',world)};
 maximumAnalyticError=Math.max(maximumAnalyticError,Math.abs(error));maximumWitnessResidual=Math.max(maximumWitnessResidual,...Object.values(witnesses).map(Math.abs));
 if(i===steps/2)minimumInitialGap=Math.min(minimumInitialGap,result.gap-(side==='left'?stroke:0));
 rows.push({...result,analytic,analyticError:error,seatedShift:x,worldWitness:world,witnesses});
 if(i%8===0)console.log({side,i,relativeAngle,gap:result.gap,analyticError:error,witnesses,tested:result.tested});
}
verifyStudySources(sources);const baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json');
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,steps,parameters:jaws.parameters,
 rows,maximumAnalyticError,maximumWitnessResidual,minimumInitialGap,
 qualification:'Native finite jaw-front clearance and independently transformed full-solid witnesses over one relative tooth pitch on each side. Compares the analytic triangular-wave approximation, without using it in the native query. No loaded-jaw dynamics or full reversal qualification.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({rows:rows.length,maximumAnalyticError,maximumWitnessResidual,minimumInitialGap});
assert(maximumWitnessResidual<1e-9&&minimumInitialGap>0);
