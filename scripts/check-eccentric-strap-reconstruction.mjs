import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeEccentricStrap,THREE} from '../src/simulation/eccentric-strap.js';
import {auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';
import {nativePlateContours} from './lib/weighted-clutch-native-contours.mjs';
import {freezeStudySources,verifyStudySources,readStudyReport} from './lib/study-report-io.mjs';
import {eccentricStrapClearance} from './lib/eccentric-strap-clearance.mjs';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/089-source-reconstruction';
const model=makeEccentricStrap(),u=model.root.userData,g=u.geometry;
const traced=readStudyReport('artifacts/review/089-traced-source.json');
const sources=freezeStudySources(['scripts/check-eccentric-strap-reconstruction.mjs','src/simulation/eccentric-strap.js',
  'src/simulation/eccentric-strap-source.js','src/simulation/eccentric-strap-joints.js',
  'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'scripts/lib/weighted-clutch-fit-audit.mjs','scripts/lib/weighted-clutch-solid-audit.mjs',
  'scripts/lib/eccentric-strap-clearance.mjs',
  'tests/helpers/solid-surface.mjs','scripts/lib/weighted-clutch-native-contours.mjs',
  'artifacts/review/089-traced-source.json','public/engravings/mm_089.png'],prefix);
const sourceComparison={};
const distanceToContours=(p,rings)=>{
  let minimum=Infinity;
  for(const ring of rings)for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
    const t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;
    minimum=Math.min(minimum,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
  }return minimum;
};
const contours=part=>nativePlateContours(part.geometry).map(r=>r.map(p=>{
  const v=part.localToWorld(new THREE.Vector3(...p,0));return [159+v.x*100,288-v.y*100];
}));
for(const [name,meshes]of [['strapOuter',[u.blocks.leftStrapHalf,u.blocks.rightStrapHalf]],
  ['sheaveFlange',[u.parts['front-retaining-flange']]],['sheaveFace',[u.parts['raised-sheave-face']]]]){
  const rings=meshes.flatMap(contours),errors=traced.circles[name].points.map(p=>distanceToContours(p,rings));
  sourceComparison[name]={count:errors.length,maximum:Math.max(...errors),rms:Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/errors.length)};
}
for(const [name,part,radius]of [['shaftCollar',u.parts['shaft-collar'],u.source.collarRadius/100],['shaft',u.parts['input-shaft'],g.shaftRadius]]){
  const errors=traced.circles[name].points.map(([x,y])=>Math.abs(Math.hypot(x-159,y-288)-radius*100));
  sourceComparison[name]={count:errors.length,maximum:Math.max(...errors),rms:Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/errors.length)};
}
for(const [name,points,part]of [['neckTop',u.source.neckTop,u.parts['flared-strap-neck']],['neckBottom',u.source.neckBottom,u.parts['flared-strap-neck']],
  ['rodTop',u.source.rodTop,u.parts['eccentric-rod']],['rodBottom',u.source.rodBottom,u.parts['eccentric-rod']]]){
  const rings=contours(part),errors=points.map(p=>distanceToContours(p,rings));
  sourceComparison[name]={count:errors.length,maximum:Math.max(...errors),rms:Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/errors.length)};
}
console.log({sourceComparison});
const poses=[];
for(const fraction of [0,.125,.25,.375,.5,.625,.75,.875,1]){
  model.update(fraction*4);const saved=u.families;
  // The source pose also checks all distinct rigid solids within each family.
  if(fraction===0)u.families=Object.fromEntries(Object.keys(u.parts).map(n=>[n,n]));
  const audit=auditClutchSourceSolids(model);u.families=saved;
  poses.push({fraction,...audit});console.log({fraction,checks:audit.checks,issues:audit.issues,topologyIssues:audit.topologyIssues});
}
let maximumJointError=0,maximumRodHeight=0,minimumFlangeGuideGap=Infinity,maximumForkX=-Infinity;
const p=new THREE.Vector3(),samples=4096;
for(let i=0;i<=samples;i++){
  model.update(i*4/samples);const b=u.blocks,eye=b.rodEndEye.getWorldPosition(new THREE.Vector3()),pin=b.wristPin.getWorldPosition(new THREE.Vector3());
  maximumJointError=Math.max(maximumJointError,eye.distanceTo(pin));
  const inverse=b.crosshead.matrixWorld.clone().invert(),points=b.eccentricRod.geometry.attributes.position;
  for(let k=0;k<points.count;k++){
    p.fromBufferAttribute(points,k).applyMatrix4(b.eccentricRod.matrixWorld);
    if(p.x>=g.guideMinimumX)maximumRodHeight=Math.max(maximumRodHeight,Math.abs(p.y-g.sliderY));
    p.applyMatrix4(inverse);maximumForkX=Math.max(maximumForkX,p.x);
  }
  for(const part of [b.innerCouplingPlate,b.outerCouplingPlate,...b.couplingBolts])minimumFlangeGuideGap=Math.min(minimumFlangeGuideGap,
    g.guideMinimumX-new THREE.Box3().setFromObject(part,true).max.x);
}
const continuous=eccentricStrapClearance(model);
const checksPassed=continuous.passed&&poses.every(p=>!p.issues.length&&!p.topologyIssues.length)&&Object.values(sourceComparison).every(p=>p.maximum<4)
  &&maximumJointError<1e-10&&maximumRodHeight<.34&&minimumFlangeGuideGap>.09&&maximumForkX<.251;
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:89,sources,sourceComparison,poses,samples,maximumJointError,maximumRodHeight,
  minimumFlangeGuideGap,maximumForkX,continuous,checksPassed,mechanicsPassed:false,
  qualification:'One common projection; native source contours, nine finite-solid poses and dense joint clearance sweep. Continuous family clearances use the native rod contour with a conservative travel envelope; final display is checked separately.'},null,2)+'\n',{flag:'wx'});
console.log({checksPassed,maximumJointError,maximumRodHeight,minimumFlangeGuideGap,maximumForkX});assert(checksPassed);
