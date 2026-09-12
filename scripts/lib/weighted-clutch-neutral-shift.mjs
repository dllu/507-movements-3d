import {makeWeightedClutchInertia} from './weighted-clutch-inertia.mjs';
import {makeWeightedClutchNativeCouplings} from './weighted-clutch-native-couplings.mjs';
import {makeWeightedClutchFastStud} from './weighted-clutch-fast-stud.mjs';
import {makeWeightedClutchNativeJaws} from './weighted-clutch-native-jaws.mjs';
import {weightedClutchJawBounds} from './weighted-clutch-jaw-bound.mjs';
import {projectWeightedClutchVelocity} from './weighted-clutch-diagonal-contact.mjs';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

// Three free coordinates during withdrawal and neutral coasting. E/output
// retain their incoming speed until a stud or opposite jaw contact ends the
// validity of that assumption. Slot/fork impacts and gravity determine F, the
// independent shifter and D. Do not continue through the terminating jaw hit.
export function makeWeightedClutchNeutralShift(model,flight){
 const u=model.root.userData,C=u.lostMotion.parameters,sign=flight.direction==='CCW'?1:-1,
  side=sign>0?'left':'right',formerSide=sign>0?'right':'left',inertia=makeWeightedClutchInertia(model),
  coupling=makeWeightedClutchNativeCouplings(model),stud=makeWeightedClutchFastStud(model),jaws=makeWeightedClutchNativeJaws(model),bound=weightedClutchJawBounds(model),
  x0=sign>0?0:-C.stroke,holding=sign>0?1:0,omegaE=flight.parameters.omega,omegaOutput=u.geometry.eRatio*omegaE,
  omegaInput=-Math.abs(omegaOutput)/u.geometry.mainRatio;
 let s0=flight.parameters.shifterAngle;
 for(let i=0;i<5;i++){const c=coupling.fork(s0,x0)[holding];s0-=c.gap/c.gradient[1];}
 const q0=s0-coupling.parameters[sign>0?'lower':'upper'].angle,
  dt=(q0-flight.end.q)/flight.end.v,v0=flight.end.v+inertia.freeAcceleration(flight.end.q,flight.end.v)*dt,
  e0=flight.end.e+omegaE*dt,output0=u.geometry.eRatio*e0,input0=output0/u.geometry.mainRatio*(sign>0?-1:1),
  formerGap=jaws.evaluate(formerSide,0,x0).gap;
 const mass=q=>[inertia.linkage(q[0]).inertia,inertia.parameters.bodies.shifter.inertia,inertia.parameters.bodies.D.mass],
  energy=(q,v)=>{const m=mass(q);return inertia.linkage(q[0]).potential+inertia.shifter(q[1]).potential+.5*dot(m,v.map(x=>x*x));},
  phase=t=>({e:e0+omegaE*t,output:output0+omegaOutput*t,input:input0+omegaInput*t});
 let nativeJawQueries=0;
 const jaw=(q,t,force=false)=>{
  const p=phase(t),delta=p.output+(side==='left'?-1:1)*u.geometry.mainRatio*p.input,lower=bound.lower(side,delta,q[2]);
  if(!force&&lower>0)return{side,relativeAngle:delta,clutchShift:q[2],lowerBound:lower,exact:false};
  nativeJawQueries++;return{...jaws.evaluate(side,delta,q[2]),lowerBound:lower,exact:true};
 };
 const query=(q,t)=>{
  const p=phase(t),c=stud.evaluate(q[0],p.e);
  return [...coupling.query(q).map(c=>({...c,inputGradient:0})),{kind:'stud',gap:c.gap,gradient:[c.gradientLever,0,0],inputGradient:c.gradientWheel}];
 };
 const initial=()=>{
  const q=[q0,s0,x0],before=[v0,0,0],m=mass(q),constraints=query(q,0).filter(c=>c.gap<2e-8).map(c=>({...c,target:-c.inputGradient*omegaE})),
   p=projectWeightedClutchVelocity(before,m,constraints),loss=.5*p.cost;
  return{time:0,q,v:p.v,active:p.active,energy:energy(q,p.v),initialEnergy:energy(q,before),loss,defect:0,absoluteDefect:0,
   initialImpact:true,jaw:jaw(q,0),phase:phase(0)};
 };
 function step(before,h){
  const time=before.time+h,m=mass(before.q),free=[before.v[0]+h*inertia.freeAcceleration(before.q[0],before.v[0]),
   before.v[1]-h*inertia.shifter(before.q[1]).potentialDerivative/m[1],before.v[2]];
  let q=before.q.map((x,i)=>x+h*free[i]),iterations=0,transport;
  for(;iterations<30;iterations++){
   const constraints=query(q,time).map(c=>({...c,target:(dot(c.gradient,q.map((x,i)=>x-before.q[i]))-c.gap)/h})),
    p=projectWeightedClutchVelocity(free,m,constraints),next=before.q.map((x,i)=>x+h*p.v[i]),change=Math.max(...next.map((x,i)=>Math.abs(x-q[i])));
   q=next;transport=p;if(change<1e-11)break;
  }
  if(iterations===30)throw Error('Neutral-shift position iteration failed');
  const contacts=query(q,time),minimumGap=Math.min(...contacts.map(c=>c.gap));
  if(minimumGap< -2e-9)throw Error('Neutral-shift penetration: '+minimumGap);
  const constraints=contacts.filter(c=>c.gap<=2e-8).map(c=>({...c,target:-c.inputGradient*omegaE})),p=projectWeightedClutchVelocity(free,m,constraints);
  if(p.active.some(c=>c.kind==='stud'))throw Error('Stud contact ends free output coast');
  const oldJawGap=formerGap+(formerSide==='left'?1:-1)*(q[2]-x0);
  if(oldJawGap< -1e-10)throw Error('Former jaw recontact ends free coast');
  const E=energy(q,p.v),loss=.5*p.cost,defect=E-before.energy+loss;
  return {time,q,v:p.v,active:p.active,energy:E,loss:before.loss+loss,defect:before.defect+defect,
   absoluteDefect:before.absoluteDefect+Math.abs(defect),stepDefect:defect,h,iterations:iterations+1,minimumGap,oldJawGap,
   transportVelocity:transport.v,freeVelocity:free,jaw:jaw(q,time),phase:phase(time)};
 }
 const advance=(before,h)=>{
  const after=step(before,h);if(!after.jaw.exact||after.jaw.gap>0)return after;
  let low=0,high=h,end=after;
  for(let i=0;i<28;i++){
   const middle=(low+high)/2,test=step(before,middle);
   if(test.jaw.exact&&test.jaw.gap<=0){high=middle;end=test;}else low=middle;
  }
  return{...end,oppositeJawImpact:true};
 };
 return {initial,step,advance,query,jaw,mass,energy,phase,inertia,coupling,jaws,bound,get nativeJawQueries(){return nativeJawQueries;},
  parameters:{direction:flight.direction,side,formerSide,q0,s0,x0,v0,e0,output0,input0,omegaE,omegaOutput,omegaInput,
   retarget:{shifterAngle:s0-flight.parameters.shifterAngle,leverAngle:q0-flight.end.q,time:dt},jawBounds:bound.fronts,
   qualification:'Native slot/fork impact and neutral-shift subsystem with three independent coordinates. Output coasts at incoming speed; no stud or former-jaw recontact is allowed. Terminates at exact opposite native jaw-front contact before that impact. Native support alignment retargets the prior approximate slot/fork endpoints by microunits; it is an initial-state correction, not an animated snap.'}};
}
