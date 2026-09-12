import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {makeWeightedClutchInertia,weightedClutchContactCurvature} from './lib/weighted-clutch-inertia.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {weightedClutchStudContacts} from './lib/weighted-clutch-stud-contact.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-release-forces',steps=Number(process.env.PROBE_STEPS??128),
 parent=readStudyReport('artifacts/review/087-native-contact-checkpoint.json'),
 baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
 verify=()=>{for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);},
 sources=freezeStudySources([...parent.sources.map(s=>s.file).filter(f=>!f.endsWith('.md')),
  'scripts/study-weighted-clutch-release-forces.mjs','scripts/lib/weighted-clutch-inertia.mjs'],prefix),
 model=makeWeightedClutchLostMotionCandidate(),u=model.root.userData,inertia=makeWeightedClutchInertia(model),native=makeWeightedClutchNativeStud(model),
 end=u.lostMotion.parameters.leverLeft,speeds=[.05,.1,.2,.4,.8],rows=[],branches=[];
verify();assert(Number.isInteger(steps)&&steps>=16);
function zero(f,a,b){
 let fa=f(a);assert(fa*f(b)<0);
 for(let i=0;i<60;i++){const c=(a+b)/2,fc=f(c);if(fa*fc<=0)b=c;else{a=c;fa=fc;}}
 return(a+b)/2;
}
const equilibrium=zero(q=>inertia.linkage(q).potentialDerivative,0,end),
 shifterEquilibrium=zero(q=>inertia.shifter(q).potentialDerivative,u.lostMotion.parameters.shifterRight,u.lostMotion.parameters.shifterLeft);
let minInertia=Infinity,maxInertia=0,maximumPotentialDerivativeError=0,maximumInertiaDerivativeError=0,maximumHessianError=0;
for(let i=0;i<=steps;i++){
 const q=end*i/steps,r=inertia.linkage(q),h=1e-5,a=inertia.linkage(q-h),b=inertia.linkage(q+h);
 minInertia=Math.min(minInertia,r.inertia);maxInertia=Math.max(maxInertia,r.inertia);
 maximumPotentialDerivativeError=Math.max(maximumPotentialDerivativeError,Math.abs((b.potential-a.potential)/(2*h)-r.potentialDerivative));
 maximumInertiaDerivativeError=Math.max(maximumInertiaDerivativeError,Math.abs((b.inertia-a.inertia)/(2*h)-r.inertiaDerivative));
 rows.push({q,inertia:r.inertia,inertiaDerivative:r.inertiaDerivative,potential:r.potential,potentialDerivative:r.potentialDerivative,potentialSecond:r.potentialSecond});
}
for(const direction of ['CCW','CW']){
 const sign=direction==='CCW'?1:-1,contacts=[],speedRows=speeds.map(omega=>({omega:sign*omega,firstNegative:null,minimumReaction:Infinity,initial:null,rows:[]}));
 for(let i=0;i<=steps;i++){
  const q=end*(direction==='CCW'?i/steps:1-i/steps),analytic=weightedClutchStudContacts(u.linkage,q).contacts.filter(c=>c['approach'+direction]);
  assert.equal(analytic.length,1);const contact=native.root(q,analytic[0].theta,direction),c=weightedClutchContactCurvature(contact,inertia,native.parameters),r=inertia.linkage(q),h=2e-5;
  const qq=(native.evaluate(q+h,contact.wheelAngle).gap-2*contact.gap+native.evaluate(q-h,contact.wheelAngle).gap)/h**2,
   ee=(native.evaluate(q,contact.wheelAngle+h).gap-2*contact.gap+native.evaluate(q,contact.wheelAngle-h).gap)/h**2,
   qe=(native.evaluate(q+h,contact.wheelAngle+h).gap-native.evaluate(q+h,contact.wheelAngle-h).gap-
    native.evaluate(q-h,contact.wheelAngle+h).gap+native.evaluate(q-h,contact.wheelAngle-h).gap)/(4*h**2),
   hessianError=Math.max(Math.abs(qq-c.qq),Math.abs(qe-c.qe),Math.abs(ee-c.ee));
  maximumHessianError=Math.max(maximumHessianError,hessianError);
  contacts.push({...contact,curvature:{edge:c.edge,q:c.q,e:c.e,qq:c.qq,qe:c.qe,ee:c.ee},hessianError});
  for(const s of speedRows){
   const k=c.kinematicsAtWheelSpeed(s.omega),reaction=(r.inertia*k.acceleration+.5*r.inertiaDerivative*k.velocity**2+r.potentialDerivative)/c.q,
    row={q,wheelAngle:contact.wheelAngle,...k,reaction,totalLinkageEnergy:r.potential+.5*r.inertia*k.velocity**2};
   if(i===0){
    const impulse=r.inertia*k.velocity/c.q,kinetic=.5*r.inertia*k.velocity**2;
    s.initial={...row,normalImpulse:impulse,kineticEnergy:kinetic,motorImpulseWork:-impulse*c.e*s.omega,
     inelasticImpactLoss:-impulse*c.e*s.omega-kinetic};
   }
   if(reaction<0&&s.firstNegative===null)s.firstNegative=row;
   s.minimumReaction=Math.min(s.minimumReaction,reaction);s.rows.push(row);
  }
 }
 branches.push({direction,contacts,speeds:speedRows});
 console.log({direction,speeds:speedRows.map(({rows,...s})=>s)});
}
verify();verifyStudySources(sources);
const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,steps,
 inertia:inertia.parameters,equilibrium,shifterEquilibrium,weightVertical:u.linkage.parameters.overCenterAngle,
 minInertia,maxInertia,maximumPotentialDerivativeError,maximumInertiaDerivativeError,maximumHessianError,rows,branches,
 qualification:'Illustrative native-component inertia and prescribed-wheel-speed contact reaction screen. A negative normal reaction rejects continued contact at that sample. Smooth-feature Hessians do not qualify polygon-corner impacts, release time, free fall, slot/fork impacts or loaded clutch reversal. No timed animation is integrated.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({equilibriumDegrees:equilibrium*180/Math.PI,weightVerticalDegrees:report.weightVertical*180/Math.PI,
 shifterEquilibriumDegrees:shifterEquilibrium*180/Math.PI,minInertia,maxInertia,maximumPotentialDerivativeError,maximumInertiaDerivativeError,maximumHessianError});
assert(maximumPotentialDerivativeError<1e-7&&maximumInertiaDerivativeError<1e-7&&maximumHessianError<1e-3);
