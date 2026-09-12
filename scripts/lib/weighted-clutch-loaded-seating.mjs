import {makeWeightedClutchInertia} from './weighted-clutch-inertia.mjs';
import {makeWeightedClutchNativeCouplings} from './weighted-clutch-native-couplings.mjs';
import {makeWeightedClutchFastStud} from './weighted-clutch-fast-stud.mjs';
import {makeWeightedClutchOutputGravity} from './weighted-clutch-output-gravity.mjs';
import {makeClutchSeatingProfile,projectClutchSeatingVelocity} from './weighted-clutch-seating-contact.mjs';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

export function makeWeightedClutchLoadedSeating(model,impact,profile){
 const u=model.root.userData,inertia=makeWeightedClutchInertia(model),coupling=makeWeightedClutchNativeCouplings(model),
  stud=makeWeightedClutchFastStud(model),outputGravity=makeWeightedClutchOutputGravity(model,inertia),
  jaw=makeClutchSeatingProfile(profile,u.geometry.mainRatio),b=inertia.parameters.bodies,
  omegaInput=profile.omegaInput,phaseSign=profile.side==='left'?-1:1,
  outputInertia=b.D.inertia+b.shaft.inertia+b.pinion.inertia+b.E.inertia/u.geometry.eRatio**2;
 const input=t=>profile.input0+omegaInput*t,
  phase=(q,t)=>({input:input(t),output:q[3],e:q[3]/u.geometry.eRatio,
   relative:q[3]+phaseSign*u.geometry.mainRatio*input(t)}),
  mass=q=>[inertia.linkage(q[0]).inertia,b.shifter.inertia,b.D.mass,outputInertia],
  forces=(q,v)=>[-.5*inertia.linkage(q[0]).inertiaDerivative*v[0]**2-inertia.linkage(q[0]).potentialDerivative,
   -inertia.shifter(q[1]).potentialDerivative,0,-outputGravity.at(q[3]).derivative],
  energy=(q,v)=>inertia.linkage(q[0]).potential+inertia.shifter(q[1]).potential+outputGravity.at(q[3]).potential+.5*dot(mass(q),v.map(x=>x*x));
 function query(q,t,margin=1e-7){
  const p=phase(q,t),c=stud.evaluate(q[0],p.e);
  return [...coupling.query(q).map(c=>({...c,gradient:[...c.gradient,0],inputGradient:0})),
   {kind:'stud',gap:c.gap,gradient:[c.gradientLever,0,0,c.gradientWheel/u.geometry.eRatio],inputGradient:0},
   ...jaw.evaluate(p.relative,q[2],margin)];
 }
 function initial(){
  const q=impact.q.slice(),v=impact.velocityAfter.slice(),E=energy(q,v);
  return {time:0,q,v,energy:E,initialEnergy:E,loss:0,work:0,defect:0,absoluteDefect:0,phase:phase(q,0),
   active:impact.active,minimumGap:Math.min(...query(q,0).map(c=>c.gap))};
 }
 function step(before,h){
  const time=before.time+h,m=mass(before.q),force=forces(before.q,before.v),free=before.v.map((v,k)=>v+h*force[k]/m[k]);
  let q=before.q.map((x,i)=>x+h*free[i]),iterations=0,transport;
  for(;iterations<40;iterations++){
   const constraints=query(q,time,Math.max(1e-7,h)).map(c=>({...c,target:(dot(c.gradient,q.map((x,i)=>x-before.q[i]))-c.gap)/h})),
    p=projectClutchSeatingVelocity(free,m,constraints),next=before.q.map((x,i)=>x+h*p.v[i]),
    change=Math.max(...next.map((x,i)=>Math.abs(x-q[i])));
   q=next;transport=p;if(change<5e-12)break;
  }
  if(iterations===40)throw Error('Loaded seating position iteration failed at '+time);
  const contacts=query(q,time),minimumGap=Math.min(...contacts.map(c=>c.gap));
  if(minimumGap< -2e-9)throw Error('Loaded seating penetration: '+minimumGap);
  const constraints=contacts.filter(c=>c.gap<=2e-8).map(c=>({...c,target:-c.inputGradient*omegaInput})),
   p=projectClutchSeatingVelocity(free,m,constraints),E=energy(q,p.v),loss=.5*p.cost,
   work=p.active.reduce((s,c)=>s+c.impulse*c.target,0),defect=E-before.energy-work+loss;
  return {time,q,v:p.v,energy:E,loss:before.loss+loss,work:before.work+work,defect:before.defect+defect,
   absoluteDefect:before.absoluteDefect+Math.abs(defect),stepDefect:defect,h,iterations:iterations+1,minimumGap,
   active:p.active,freeVelocity:free,transportVelocity:transport.v,phase:phase(q,time)};
 }
 return {initial,step,query,mass,forces,energy,phase,inertia,coupling,stud,outputGravity,jaw,
  parameters:{direction:profile.direction,side:profile.side,omegaInput,omegaOutput:-phaseSign*u.geometry.mainRatio*omegaInput,
   outputInertia,profileTolerance:profile.tolerance,profilePeak:profile.peak,
   qualification:'Four independent coordinates under native inertia/gravity with unilateral slot, fork, stud and tabulated native jaw contacts. Both local jaw flanks may react at the seating corner. Input spin alone is prescribed. No F/shifter/D endpoint or output speed clamp. Piecewise-linear jaw interpolation and discrete stepping require independent native-gap and convergence checks.'}};
}
