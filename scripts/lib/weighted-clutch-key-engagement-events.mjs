import {makeWeightedClutchKeyDynamics} from './weighted-clutch-key-dynamics.mjs';
import {makeClutchSeatingProfile} from './weighted-clutch-seating-contact.mjs';
import {weightedClutchJawBounds} from './weighted-clutch-jaw-bound.mjs';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),tau=2*Math.PI;

// Both jaw sides participate. Only exact full rotations may be removed from
// a measured phase range; pitch symmetry is not used. Outside the available
// measurements, the analytic native-triangle bound must prove separation.
export function makeWeightedClutchKeyEngagementEvents(model,profile,friction,otherProfiles=[]){
 const base=makeWeightedClutchKeyDynamics(model,profile,friction),u=model.root.userData,
  bound=weightedClutchJawBounds(model),tables=[profile,...otherProfiles].map((p,index)=>({
   profile:p,index,jaw:makeClutchSeatingProfile(p,u.geometry.mainRatio),low:p.knots[0].angle,high:p.knots.at(-1).angle}));
 function phase(q,t){const p=base.phase(q,t);return{...p,relativeJaws:{left:q[4]-u.geometry.mainRatio*p.input,right:q[4]+u.geometry.mainRatio*p.input}};}
 function jawQuery(side,delta,shift,margin){
  const lower=bound.lower(side,delta,shift);
  if(lower>Math.max(2e-8,margin))return[];
  for(const table of tables.filter(t=>t.profile.side===side)){
   const turns=Math.round((delta-(table.low+table.high)/2)/tau),local=delta-turns*tau;
   if(local<table.low-1e-10||local>table.high+1e-10)continue;
   return table.jaw.evaluate(local,shift,margin).map(c=>({...c,kind:c.kind+'-profile'+table.index,
    gradient:[...c.gradient.slice(0,3),0,c.gradient[3]],absoluteRelativeAngle:delta,fullTurns:turns}));
  }
  throw Error('Unmeasured potentially contacting '+side+' jaw phase '+delta+' at shift '+shift+' (lower bound '+lower+')');
 }
 function query(q,t,margin=1e-7){
  const p=phase(q,t),s=base.stud.evaluate(q[0],p.e);
  return[...base.coupling.query(q).map(c=>({...c,gradient:[...c.gradient,0,0],inputGradient:0})),
   {kind:'stud',gap:s.gap,gradient:[s.gradientLever,0,0,s.gradientWheel/u.geometry.eRatio,0],inputGradient:0},
   ...base.key.query(q),...['left','right'].flatMap(side=>jawQuery(side,p.relativeJaws[side],q[2],margin))];
 }
 function step(before,h){
  const time=before.time+h,m=base.mass(before.q),force=base.forces(before.q,before.v),free=before.v.map((v,k)=>v+h*force[k]/m[k]);
  let q=before.q.map((x,i)=>x+h*free[i]),iterations=0,transport;
  for(;iterations<40;iterations++){
   const constraints=query(q,time,Math.max(1e-7,h)).map(c=>({...c,target:(dot(c.gradient,q.map((x,i)=>x-before.q[i]))-c.gap)/h})),
    p=base.project(free,m,constraints,before.v[2]),next=before.q.map((x,i)=>x+h*p.v[i]),
    change=Math.max(...next.map((x,i)=>Math.abs(x-q[i])));
   q=next;transport=p;if(change<5e-12)break;
  }
  if(iterations===40)throw Error('Key engagement position iteration failed at '+time);
  const contacts=query(q,time),minimumGap=Math.min(...contacts.map(c=>c.gap));
  if(minimumGap< -2e-9)throw Error('Key engagement penetration: '+minimumGap);
  const constraints=contacts.filter(c=>c.gap<=(c.kind.startsWith('jaw-')?2e-12:2e-8)).map(c=>({...c,target:-c.inputGradient*base.parameters.omegaInput})),
   p=base.project(free,m,constraints,before.v[2]),E=base.energy(q,p.v),defect=E-before.energy-p.work+p.loss;
  return{time,q,v:p.v,energy:E,loss:before.loss+p.loss,work:before.work+p.work,defect:before.defect+defect,
   absoluteDefect:before.absoluteDefect+Math.abs(defect),stepDefect:defect,h,iterations:iterations+1,minimumGap,
   active:p.active,mode:p.mode,slip:p.slip,freeVelocity:free,transportVelocity:transport.v,phase:phase(q,time),
   impulseEnergyResidual:p.impulseEnergyResidual,frictionWork:p.frictionWork,
   selectedPriorityVelocitySpread:p.selectedPriorityVelocitySpread,allModesVelocitySpread:p.allModesVelocitySpread,
   feasibleModes:p.feasibleModes,transportMode:transport.mode,transportPriorityVelocitySpread:transport.selectedPriorityVelocitySpread};
 }
 // A Coulomb mode switch can defeat a Newton step spanning the cusp. Retry
 // only that explicit iteration failure with a smaller step, preserving the
 // failed sizes. The corner is then the earliest reached phase, including a
 // landing that stays at zero offset instead of crossing to the other side.
 function advance(before,requestedH){
  let h=requestedH,after;const rejectedSteps=[];
  for(let retries=0;;retries++){
   try{after=step(before,h);break;}
   catch(error){
    if(!error.message.startsWith('Key engagement position iteration failed')||retries>=16||h/2<1e-10)throw error;
    rejectedSteps.push({h,message:error.message});h/=2;
   }
  }
  const p=phase(before.q,before.time),r=phase(after.q,after.time),events=[];
  for(const table of tables){
   const side=table.profile.side,delta=p.relativeJaws[side],turns=Math.round((delta-table.profile.peak.angle)/tau),
    peak=table.profile.peak.angle+turns*tau,a=delta-peak,b=r.relativeJaws[side]-peak;
   if(Math.abs(a)<1e-10||a*b>0&&Math.abs(b)>1e-12)continue;
   const gap=state=>Math.min(...jawQuery(side,phase(state.q,state.time).relativeJaws[side],state.q[2],1e-7).map(c=>c.gap));
   if(Math.min(gap(before),gap(after))>2e-8)continue;
   let lo=0,hi=h,end=after;
   for(let i=0;i<42&&hi-lo>1e-11;i++){
    const middle=(lo+hi)/2,test=step(before,middle),offset=phase(test.q,test.time).relativeJaws[side]-peak;
    if(offset*a<=0||Math.abs(offset)<=1e-12){hi=middle;end=test;}else lo=middle;
   }
   if(Math.abs(phase(end.q,end.time).relativeJaws[side]-peak)>1e-10)throw Error('Native key seating corner root failed');
   events.push({...end,seatingCornerImpact:true,cornerSide:side,cornerPhase:peak,
    cornerBracket:[before.time+lo,before.time+hi]});
  }
  const result=events.length?events.reduce((a,b)=>a.time<b.time?a:b):after;
  return{...result,requestedH,acceptedH:result.time-before.time,rejectedSteps};
 }
 return{...base,query,phase,step,advance,bound,tables,
  parameters:{...base.parameters,bothJawSides:true,cornerEventLocation:true,jawVelocityContactTolerance:2e-12,adaptiveIterationRecovery:true,
   measuredRanges:tables.map(t=>({side:t.profile.side,low:t.low,high:t.high,peak:t.profile.peak})),
   qualification:'Five-coordinate key-friction dynamics through loaded jaw engagement, including both jaw sides and native-cusp events. Only full-turn phase equivalence is used; unmeasured near-contact phases stop the study. Cusp landings use earliest-event brackets; failed position iterations are retried at smaller steps. No axial seat, shaft speed or F endpoint is clamped.'}};
}
