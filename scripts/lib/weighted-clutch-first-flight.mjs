import {makeWeightedClutchInertia} from './weighted-clutch-inertia.mjs';
import {makeWeightedClutchFastStud} from './weighted-clutch-fast-stud.mjs';
import {weightedClutchStudContacts} from './weighted-clutch-stud-contact.mjs';

// A bounded subsystem study: E has a prescribed constant speed and the shifter
// stays at its engaged end. F/G/rod move under gravity, native stud contact and
// the starting slot stop. Stop before the other slot end transfers momentum to
// the shifter. No clutch reversal or prescribed release angle is supplied.
export function makeWeightedClutchFirstFlight(model,{direction='CCW',speed=.1,gravity=9.81,weightMultiplier=1}={}){
 if(!['CCW','CW'].includes(direction)||!(speed>0&&Number.isFinite(speed)))throw Error('Invalid flight parameters');
 const u=model.root.userData,coupling=u.lostMotion.parameters,sign=direction==='CCW'?1:-1,
  start=sign>0?0:coupling.leverLeft,target=sign>0?coupling.freeAngle:coupling.shifterLeft-coupling.shifterRight,
  omega=sign*speed,inertia=makeWeightedClutchInertia(model,{gravity,weightMultiplier}),contact=makeWeightedClutchFastStud(model),
  analytic=weightedClutchStudContacts(u.linkage,start).contacts.filter(c=>c['approach'+direction]);
 if(analytic.length!==1)throw Error('Initial contact branch is not unique');
 const initialContact=contact.slow.root(start,analytic[0].theta,direction),wheelStart=initialContact.wheelAngle,
  energy=(q,v)=>{const m=inertia.linkage(q);return m.potential+.5*m.inertia*v*v;};
 const constraints=(q,e)=>{
  const c=contact.evaluate(q,e);
  return [{kind:'stud',gap:c.gap,gradient:c.gradientLever,inputGradient:c.gradientWheel},
   {kind:'starting-slot-stop',gap:sign*(q-start),gradient:sign,inputGradient:0}];
 };
 function projectVelocity(q,e,free,mass){
  let low=-Infinity,high=Infinity,lower,upper;
  const candidates=constraints(q,e).filter(c=>c.gap<=2e-8);
  for(const c of candidates){
   if(Math.abs(c.gradient)<1e-10)throw Error('Contact is near a linkage singularity');
   const bound=-c.inputGradient*omega/c.gradient;
   if(c.gradient>0&&bound>low){low=bound;lower=c;}
   if(c.gradient<0&&bound<high){high=bound;upper=c;}
  }
  if(low>high+1e-10)throw Error('Infeasible unilateral velocity interval');
  const v=Math.max(low,Math.min(high,free)),c=v>free?lower:v<free?upper:null,
   active=c?[{...c,impulse:mass*(v-free)/c.gradient}]:[];
  if(active.some(c=>c.impulse<0))throw Error('Tensile unilateral impulse');
  return {v,active,candidates};
 }
 const initial=()=>{
  const mass=inertia.linkage(start).inertia,p=projectVelocity(start,wheelStart,0,mass),
   work=p.active.reduce((s,c)=>s-c.impulse*c.inputGradient*omega,0),loss=.5*mass*p.v*p.v;
  return {time:0,q:start,v:p.v,e:wheelStart,gap:initialContact.gap,active:p.active,
   energy:energy(start,p.v),work,loss,defect:0,absoluteDefect:0,initialImpact:true};
 };
 function step(before,h){
  if(!(h>0&&Number.isFinite(h)))throw Error('Invalid time step');
  const time=before.time+h,e=wheelStart+omega*time,m=inertia.linkage(before.q),
   acceleration=(-.5*m.inertiaDerivative*before.v**2-m.potentialDerivative)/m.inertia,
   free=before.v+h*acceleration;
  let q=before.q+h*free,positionIterations=0;
  for(;positionIterations<30;positionIterations++){
   if(sign*(q-start)<0)q=start;
   const c=contact.evaluate(q,e);
   if(c.gap>=-1e-11)break;
   if(Math.abs(c.gradientLever)<1e-10)throw Error('Position contact is near a singularity');
   const correction=-(c.gap-1e-13)/c.gradientLever;
   if(Math.abs(correction)>.01)throw Error('Unresolved position correction: '+correction);
   q+=correction;
  }
  if(positionIterations===30)throw Error('Position projection did not converge');
  const c=contact.evaluate(q,e),p=projectVelocity(q,e,free,m.inertia),
   work=p.active.reduce((s,c)=>s-c.impulse*c.inputGradient*omega,0),loss=.5*m.inertia*(p.v-free)**2,
   currentEnergy=energy(q,p.v),defect=currentEnergy-before.energy-work+loss;
  if(c.gap< -2e-9||sign*(q-start)< -1e-12)throw Error('Invalid projected position');
  for(const constraint of p.candidates){
   if(constraint.gradient*p.v+constraint.inputGradient*omega< -1e-10)throw Error('Closing post-impact velocity');
  }
  return {time,q,v:p.v,e,gap:c.gap,active:p.active,energy:currentEnergy,
   work:before.work+work,loss:before.loss+loss,defect:before.defect+defect,
   absoluteDefect:before.absoluteDefect+Math.abs(defect),stepDefect:defect,
   transportVelocity:(q-before.q)/h,freeVelocity:free,positionIterations,h};
 }
 const reached=state=>sign*(state.q-target)>=0;
 const advance=(before,h)=>{
  const after=step(before,h);if(!reached(after))return after;
  let low=0,high=h,end=after;
  for(let i=0;i<36;i++){
   const middle=(low+high)/2,test=step(before,middle);
   if(reached(test)){high=middle;end=test;}else low=middle;
  }
  return {...end,endpoint:true};
 };
 return {initial,step,advance,reached,energy,contact,inertia,parameters:{direction,omega,start,target,wheelStart,gravity,weightMultiplier,
  shifterAngle:sign>0?coupling.shifterRight:coupling.shifterLeft,
  qualification:'Plastic unilateral stud/start-stop impulses with separate position and velocity projections, variable linkage inertia and gravity. E is prescribed; the shifter is held at its engaged end. End at the opposite diagnostic slot stop, whose existing finite-circle fit leaves a one-microunit clearance margin. Slot impact, shifter/clutch forces, motor inertia, friction and reversal are excluded.'}};
}
