import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {THREE} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyDynamics} from './lib/weighted-clutch-key-dynamics.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {sourceFitStudContacts} from './lib/weighted-clutch-source-fit.mjs';
import {familyMass} from '../src/simulation/finite-plate-geometry.js';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-impact-v2',
  input=process.env.PROBE_INPUT??'artifacts/review/087-first-fixed-orbit-contacts.json',fit=readStudyReport(input),
  profileFile='artifacts/review/087-refined-seating-cusps.json',profiles=readStudyReport(profileFile),
  sources=freezeStudySources([...fit.sources.map(s=>s.file),input,profileFile,
    'scripts/study-weighted-clutch-fixed-orbit-impact.mjs',
    ...['inertia','key-dynamics','native-key','native-jaws','split-gravity','key-friction','seating-contact']
      .map(name=>'scripts/lib/weighted-clutch-'+name+'.mjs')],prefix),
  model=makeWeightedClutchDistributedCandidate(fit.options),u=model.root.userData,
  temporary=makeWeightedClutchKeyDynamics(model,profiles.profiles[0],{staticCoefficient:0,kineticCoefficient:0}),
  inertia=temporary.inertia,jaws=makeWeightedClutchNativeJaws(model),checks=[],gravityChecks=[],rows=[],
  components=Object.entries(u.parts).filter(([name])=>['lever','bell','rod'].includes(u.families[name])).map(([name,mesh])=>{
    const raw=familyMass({component:new THREE.Mesh(mesh.geometry)},{component:'body'},'body');
    return{name,mesh,raw,mass:raw.volume*inertia.parameters.density,centralInertia:raw.centralPolar*inertia.parameters.density};
  });
verifyStudySources(fit.sources);
function sample(q){
  model.setCoordinates([q,0,0,0,0],0);let potential=0;
  const states=components.map(c=>{
    const center=new THREE.Vector3(...c.raw.centroid).applyMatrix4(c.mesh.matrixWorld),m=c.mesh.matrixWorld.elements;
    potential+=c.mass*inertia.parameters.gravity*center.y;
    return{center:center.toArray(),angle:Math.atan2(m[1],m[0])};
  });
  return{potential,states};
}
for(let i=0;i<=128;i++){
  const q=.001+(u.linkage.parameters.leverLeft-.002)*i/128,h=1e-5,
    center=sample(q),before=sample(q-h),after=sample(q+h),expected=inertia.linkage(q);
  let measuredInertia=0;
  for(let j=0;j<components.length;j++){
    const a=before.states[j],b=after.states[j],v=b.center.map((x,k)=>(x-a.center[k])/(2*h)),
      omega=Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle))/(2*h),c=components[j];
    measuredInertia+=c.mass*v.reduce((s,x)=>s+x*x,0)+c.centralInertia*omega*omega;
  }
  checks.push({q,potentialError:Math.abs(center.potential-expected.potential),
    inertiaError:Math.abs(measuredInertia-expected.inertia),
    gravityError:Math.abs((after.potential-before.potential)/(2*h)-expected.potentialDerivative),
    inertiaDerivativeError:Math.abs((inertia.linkage(q+h).inertia-inertia.linkage(q-h).inertia)/(2*h)-expected.inertiaDerivative)});
}
for(let i=0;i<=64;i++){
  const shaft=-6+12*i/64,clutch=shaft+.004*Math.sin(i),g=temporary.gravity.at(shaft,clutch),h=1e-6,
    derivative=[(temporary.gravity.nativePotential(shaft+h,clutch)-temporary.gravity.nativePotential(shaft-h,clutch))/(2*h),
      (temporary.gravity.nativePotential(shaft,clutch+h)-temporary.gravity.nativePotential(shaft,clutch-h))/(2*h)];
  gravityChecks.push({shaft,clutch,nativeError:Math.abs(g.potential-temporary.gravity.nativePotential(shaft,clutch)),
    derivativeError:Math.max(Math.abs(derivative[0]-g.gradient[3]),Math.abs(derivative[1]-g.gradient[4]))});
}
for(const base of profiles.profiles){
  const left=base.side==='left',direction=left?'CW':'CCW',x=(left?-1:1)*base.peak.gap,
    forkKind=left?'fork-left':'fork-right',slot=temporary.coupling.parameters[left?'lower':'upper'];
  let s=u.lostMotion.parameters[left?'shifterLeft':'shifterRight'];
  for(let i=0;i<12;i++){
    const c=temporary.coupling.fork(s,x).find(c=>c.kind===forkKind);s-=c.gap/c.gradient[1];
  }
  const f=s-slot.angle,candidates=sourceFitStudContacts(u.linkage,f).contacts.filter(c=>c['approach'+direction]);
  assert.equal(candidates.length,1);
  const contact=temporary.stud.slow.root(f,candidates[0].theta,direction),shaft=contact.wheelAngle*u.geometry.eRatio,
    outputTorque=-temporary.gravity.at(shaft,shaft).gradient[3],
    gamma=temporary.key.parameters[outputTorque>0?'upper':'lower'].angle,D=shaft-gamma,
    phaseSign=left?-1:1,input0=(base.peak.angle-D)/(phaseSign*u.geometry.mainRatio),profile={...base,direction,input0},
    q=[f,s,x,shaft,D],omega=-phaseSign*u.geometry.mainRatio*profile.omegaInput,v=[0,0,0,omega,omega];
  for(const staticCoefficient of [0,.42,.78]){
    const kineticCoefficient=Math.min(.42,staticCoefficient),d=makeWeightedClutchKeyDynamics(model,profile,{staticCoefficient,kineticCoefficient}),
      m=d.mass(q),contacts=d.query(q,0),loaded=contacts.filter(c=>c.gap<2e-8),force=d.forces(q,v),
      holding=d.project(force.map((f,i)=>f/m[i]),m,loaded.filter(c=>c.kind!=='stud').map(c=>({...c,target:0})),0),
      impact=d.project(v,m,loaded.map(c=>({...c,target:-c.inputGradient*d.parameters.omegaInput})),0),
      momentum=impact.v.map((value,k)=>m[k]*(value-v[k])-impact.active.reduce((sum,c)=>
        sum+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),
      phase=d.phase(q,0),nativeStart=jaws.evaluate(profile.side,phase.relative,q[2]),directions=[];
    for(const eps of [1e-4,2e-5,4e-6]){
      const future=q.map((x,k)=>x+eps*impact.v[k]),p=d.phase(future,eps);
      directions.push({eps,nativeJawGap:jaws.evaluate(profile.side,p.relative,future[2]).gap,
        minimumCouplingGap:Math.min(...d.coupling.query(future).map(c=>c.gap)),
        studGap:d.stud.evaluate(future[0],p.e).gap,keyGaps:d.key.query(future).map(c=>({kind:c.kind,gap:c.gap}))});
    }
    const incomingGapVelocity=contacts.find(c=>c.kind==='stud').gradient.reduce((sum,g,i)=>sum+g*v[i],0);
    const row={direction,arrivalDirection:base.direction,side:base.side,staticCoefficient,kineticCoefficient,profile,q,velocityBefore:v,incomingGapVelocity,
      mass:m,phase,contacts,contact,initialPreload:{outputTorque,gamma,input0},holding,impact,momentumResidual:momentum,nativeStart,directions};
    rows.push(row);console.log({direction:row.direction,staticCoefficient,q,holdingAcceleration:Math.max(...holding.v.map(Math.abs)),
      after:impact.v,mode:impact.mode,minimumGap:Math.min(...contacts.map(c=>c.gap))});
  }
}
const maxima=Object.fromEntries(Object.keys(checks[0]).filter(k=>k.endsWith('Error')).map(k=>[k,Math.max(...checks.map(r=>r[k]))])),
  gravityMaxima={nativeError:Math.max(...gravityChecks.map(r=>r.nativeError)),derivativeError:Math.max(...gravityChecks.map(r=>r.derivativeError))};
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  input,options:fit.options,sources,inertiaParameters:inertia.parameters,checks,gravityChecks,maxima,gravityMaxima,rows,
  qualification:'Fresh native inertia and gravity checks for the fixed-orbit fit. Each direction starts independently at its next native stud contact, with a seated jaw cusp, slot end and fork wall. Initial key preload follows output gravity and input phase is retargeted once; these are initial states, not connected transitions. The native jaw meshes and their previously measured phase profiles are unchanged. Coulomb coefficients and additive mass remain illustrative hypotheses. No sustained lift or full-cycle claim follows from impact alone.'},null,2)+'\n',{flag:'wx'});
console.log({maxima,gravityMaxima});
assert(Object.values(maxima).every(v=>v<1e-7)&&Object.values(gravityMaxima).every(v=>v<1e-7));
for(const r of rows){
  assert(Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.impact.impulseEnergyResidual)<1e-9);
  assert(Math.max(...r.holding.v.map(Math.abs))<1e-8);
  assert(r.contacts.every(c=>c.gap> -1e-9)&&r.nativeStart.gap> -1e-9);
  assert(r.incomingGapVelocity<0&&r.impact.v[0]*(r.direction==='CCW'?1:-1)>0);
}
