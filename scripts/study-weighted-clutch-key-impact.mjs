import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyDynamics} from './lib/weighted-clutch-key-dynamics.mjs';
import {makeWeightedClutchOutputGravity} from './lib/weighted-clutch-output-gravity.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-key-impact',
 holdFile='artifacts/review/087-refined-seated-hold.json',hold=readStudyReport(holdFile),
 profileFile='artifacts/review/087-refined-seating-cusps.json',profiles=readStudyReport(profileFile),
 keyFile='artifacts/review/087-first-native-key.json',native=readStudyReport(keyFile),
 sources=freezeStudySources([...hold.sources.map(s=>s.file),...native.sources.map(s=>s.file),holdFile,profileFile,keyFile,
  'scripts/lib/weighted-clutch-split-gravity.mjs','scripts/lib/weighted-clutch-key-friction.mjs',
  'scripts/lib/weighted-clutch-key-dynamics.mjs','scripts/study-weighted-clutch-key-impact.mjs'],prefix),
 model=makeWeightedClutchKeyCandidate(),jaws=makeWeightedClutchNativeJaws(model),rows=[],gravityChecks=[];
verifyStudySources(hold.sources);verifyStudySources(native.sources);
for(const branch of hold.branches){
 const base=profiles.profiles.find(p=>p.direction===branch.direction),end=branch.end,
  temporary=makeWeightedClutchKeyDynamics(model,base,{staticCoefficient:0,kineticCoefficient:0}),
  outputTorque=-temporary.gravity.at(end.q[3],end.q[3]).gradient[3],
  gamma=(outputTorque>0?temporary.key.parameters.upper:temporary.key.parameters.lower).angle,
  phaseSign=base.side==='left'?-1:1,input0=end.phase.input+gamma/(phaseSign*model.root.userData.geometry.mainRatio),
  profile={...base,input0},q=[...end.q,end.q[3]-gamma],v=[...end.v,end.v[3]];
 if(branch.direction===hold.branches[0].direction){
  const oldGravity=makeWeightedClutchOutputGravity(model,temporary.inertia);
  for(let i=0;i<=64;i++){
   const shaft=-6+12*i/64,clutch=shaft+.004*Math.sin(i),g=temporary.gravity.at(shaft,clutch),h=1e-6,
    nativeValue=temporary.gravity.nativePotential(shaft,clutch),same=temporary.gravity.at(shaft,shaft),old=oldGravity.at(shaft),
    derivative=[(temporary.gravity.nativePotential(shaft+h,clutch)-temporary.gravity.nativePotential(shaft-h,clutch))/(2*h),
     (temporary.gravity.nativePotential(shaft,clutch+h)-temporary.gravity.nativePotential(shaft,clutch-h))/(2*h)];
   gravityChecks.push({shaft,clutch,nativeError:Math.abs(g.potential-nativeValue),
    derivativeError:Math.max(Math.abs(derivative[0]-g.gradient[3]),Math.abs(derivative[1]-g.gradient[4])),
    equalAnglePotentialError:Math.abs(same.potential-old.potential),
    equalAngleDerivativeError:Math.abs(same.gradient[3]+same.gradient[4]-old.derivative)});
  }
 }
 for(const staticCoefficient of [0,.2,.42,.5,.51,.6,.78]){
  const kineticCoefficient=Math.min(.42,staticCoefficient),d=makeWeightedClutchKeyDynamics(model,profile,{staticCoefficient,kineticCoefficient}),
   m=d.mass(q),force=d.forces(q,[0,0,0,v[3],v[4]]),contacts=d.query(q,0).filter(c=>c.gap<2e-8),
   holding=d.project(force.map((f,i)=>f/m[i]),m,contacts.filter(c=>c.kind!=='stud').map(c=>({...c,target:0})),0),
   constraints=contacts.map(c=>({...c,target:-c.inputGradient*d.parameters.omegaInput})),
   impact=d.project(v,m,constraints,0),momentum=impact.v.map((value,k)=>m[k]*(value-v[k])-
    impact.active.reduce((s,c)=>s+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),
   p=d.phase(q,0),nativeStart=jaws.evaluate(profile.side,p.relative,q[2]),directions=[];
  for(const eps of [1e-4,2e-5,4e-6]){
   const future=q.map((x,k)=>x+eps*impact.v[k]),phase=d.phase(future,eps),jaw=jaws.evaluate(profile.side,phase.relative,future[2]);
   directions.push({eps,nativeJawGap:jaw.gap,minimumCouplingGap:Math.min(...d.coupling.query(future).map(c=>c.gap)),
    studGap:d.stud.evaluate(future[0],phase.e).gap,keyGaps:d.key.query(future).map(c=>({kind:c.kind,gap:c.gap}))});
  }
  const row={direction:branch.direction,side:profile.side,staticCoefficient,kineticCoefficient,parameters:d.parameters,
   q,velocityBefore:v,profile,phase:p,originalHeldPhase:end.phase,originalHeldTime:end.time,initialPreload:{outputTorque,gamma,inputPhaseAdjustment:input0-end.phase.input},
   holding,impact,momentumResidual:momentum,nativeStart,directions};
  rows.push(row);console.log({direction:row.direction,staticCoefficient,holdingAcceleration:Math.max(...holding.v.map(Math.abs)),
   after:impact.v,mode:impact.mode,spread:impact.selectedPriorityVelocitySpread,allModesSpread:impact.allModesVelocitySpread});
 }
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,
 sources,gravityChecks,rows,qualification:'Explicit loaded initial states at the next-stud phase. Shaft/D backlash is taken up according to the native output gravity torque, with the input phase retargeted to preserve the seated jaw cusp. This initial preload is not an animated transition. Coulomb coefficients are sensitivity hypotheses, not historical material identification. Full-cycle retention and release remain unverified.'})+'\n',{flag:'wx'});
for(const r of gravityChecks)assert(Math.max(...Object.entries(r).filter(([k])=>k.endsWith('Error')).map(([,v])=>v))<1e-8);
for(const r of rows){
 assert(Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.impact.impulseEnergyResidual)<1e-9);
 assert(Math.max(...r.holding.v.map(Math.abs))<1e-8);
 assert(r.directions.at(-1).nativeJawGap> -1e-6&&r.directions.at(-1).keyGaps.every(c=>c.gap> -1e-10));
}
