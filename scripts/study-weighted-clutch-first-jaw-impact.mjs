import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate,THREE} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchInertia} from './lib/weighted-clutch-inertia.mjs';
import {makeWeightedClutchNativeCouplings} from './lib/weighted-clutch-native-couplings.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {projectWeightedClutchVelocity} from './lib/weighted-clutch-diagonal-contact.mjs';
import {rotate2} from './lib/weighted-clutch-native-contours.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-jaw-impact',
 inputs=['CCW','CW'].map(d=>'artifacts/review/087-sixteenth-step-neutral-shift-'+d+'.json.gz'),reports=inputs.map(readStudyReport),
 sources=freezeStudySources([...reports[0].sources.map(s=>s.file),'scripts/study-weighted-clutch-first-jaw-impact.mjs',...inputs],prefix),
 model=makeWeightedClutchIndependentCandidate(),u=model.root.userData,inertia=makeWeightedClutchInertia(model),
 coupling=makeWeightedClutchNativeCouplings(model),jaws=makeWeightedClutchNativeJaws(model),b=inertia.parameters.bodies,
 outputInertia=b.D.inertia+b.shaft.inertia+b.pinion.inertia+b.E.inertia/u.geometry.eRatio**2,rows=[];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
for(const report of reports){
 verifyStudySources(report.sources);assert(report.end.oppositeJawImpact);
 const end=report.end,side=end.jaw.side,q=[...end.q,end.phase.output],v=[...end.v,report.parameters.omegaOutput],
  delta=end.jaw.relativeAngle,mass=[inertia.linkage(q[0]).inertia,b.shifter.inertia,b.D.mass,outputInertia],derivatives=[];
 for(const h of [1e-5,2e-6,4e-7]){
  const before=jaws.evaluate(side,delta-h,q[2]),after=jaws.evaluate(side,delta+h,q[2]);derivatives.push({h,value:(after.gap-before.gap)/(2*h)});
 }
 const derivative=derivatives.at(-1).value,inputGradient=(side==='left'?-1:1)*u.geometry.mainRatio*derivative,
  jaw={kind:'opposite-jaw',gap:end.jaw.gap,gradient:[0,0,side==='left'?1:-1,derivative],inputGradient,
   target:-inputGradient*report.parameters.omegaInput},
  constraints=[...coupling.query(q).filter(c=>c.gap<2e-8).map(c=>({...c,gradient:[...c.gradient,0],inputGradient:0,target:0})),jaw];
 assert.equal(constraints.length,3); // One slot stop, one fork wall, one jaw.
 const result=projectWeightedClutchVelocity(v,mass,constraints),post=result.v,kineticBefore=.5*dot(mass,v.map(x=>x*x)),kineticAfter=.5*dot(mass,post.map(x=>x*x)),
  work=result.active.reduce((s,c)=>s-c.impulse*c.inputGradient*report.parameters.omegaInput,0),loss=.5*result.cost,
  momentum=post.map((x,k)=>mass[k]*(x-v[k])-result.active.reduce((s,c)=>s+c.impulse*c.gradient[k],0)),
  maximumDerivativeDifference=Math.max(...derivatives.map(d=>Math.abs(d.value-derivative))),directions=[];
 for(const eps of [1e-4,2e-5,4e-6]){
  const futureInput=end.phase.input+report.parameters.omegaInput*eps,futureQ=q.map((x,k)=>x+post[k]*eps),
   futureDelta=futureQ[3]+(side==='left'?-1:1)*u.geometry.mainRatio*futureInput,
   actual=jaws.evaluate(side,futureDelta,futureQ[2]);
  directions.push({eps,gap:actual.gap,rate:(actual.gap-end.jaw.gap)/eps,
   constraints:coupling.query(futureQ).map(c=>({kind:c.kind,gap:c.gap}))});
 }
 // Transform the exact native contact witness into the actual motor/output
 // phase, independently of the relative-angle height-field calculation.
 const looseSpin=(side==='left'?1:-1)*u.geometry.mainRatio*end.phase.input,
  nativePoint=end.jaw.witness.pointLoose,yz=rotate2(nativePoint.slice(1),looseSpin),point=[nativePoint[0],...yz];
 model.setCoordinates(q,end.phase.input);const distances={};
 for(const name of [side+'LooseJaw',side+'SlidingJaw']){
  const mesh=u.parts[name],surface=solidSurface(mesh.geometry),local=new THREE.Vector3(...point).applyMatrix4(mesh.matrixWorld.clone().invert());
  distances[name]=surface.signedDistance(local,.02);
 }
 const row={direction:report.direction,side,q,velocityBefore:v,velocityAfter:post,mass,outputInertia,derivatives,maximumDerivativeDifference,
  constraints,active:result.active,kineticBefore,kineticAfter,motorImpulseWork:work,plasticLoss:loss,
  energyResidual:kineticAfter-kineticBefore-work+loss,momentumResidual:momentum,
  closingRateBefore:dot(jaw.gradient,v)+inputGradient*report.parameters.omegaInput,
  closingRateAfter:dot(jaw.gradient,post)+inputGradient*report.parameters.omegaInput,
  shaftReverses:v[3]*post[3]<0,directionalChecks:directions,worldWitness:point,witnessDistances:distances};
 rows.push(row);console.log(row);
}
verifyStudySources(sources);const baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json');
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,rows,
 qualification:'First opposite-jaw plastic impact with F, shifter, sliding D and output rotation as independent coordinates. Includes reflected E/pinion inertia and motor impulse work. Native gap derivatives and full-solid witnesses qualify this sampled impact; continuing loaded-jaw motion, seating, repeat behavior and source fidelity remain pending.'},null,2)+'\n',{flag:'wx'});
for(const r of rows){
 // Reversal is an observed outcome, not an imposed impact condition. The
 // return hit initially accelerates the old spin on the contacted jaw flank;
 // seating must still establish whether the complete mechanism reverses.
 assert(r.maximumDerivativeDifference<1e-5&&r.active.every(c=>c.impulse>=0));
 assert(Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.energyResidual)<1e-9&&Math.abs(r.closingRateAfter)<1e-9);
 assert(Math.max(...Object.values(r.witnessDistances).map(Math.abs))<1e-9&&r.directionalChecks.at(-1).gap> -1e-8);
}
