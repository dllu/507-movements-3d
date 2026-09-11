import {add,sub,mul,dot,cross,rotate,pegPawlProfile} from './alternating-peg-contact-study.mjs';
import {solveContactProjection} from './jointed-tappet-dynamics-study.mjs';

export function samplePegInputClock(clock,time){
 if(!clock)return{phase:time,rate:1,acceleration:0};
 let low=0,high=clock.intervals.length-1;
 while(low<high){const middle=(low+high)>>1;if(time<clock.intervals[middle].end)high=middle;else low=middle+1;}
 const interval=clock.intervals[low],h=interval.end-interval.start,u=(time-interval.start)/h,c=interval.coefficients;
 return{phase:c.reduce((sum,v,i)=>sum+v*u**i,0),rate:c.slice(1).reduce((sum,v,i)=>sum+(i+1)*v*u**i,0)/h,
  acceleration:c.slice(2).reduce((sum,v,i)=>sum+(i+2)*(i+1)*v*u**i,0)/h**2};
}

export function makeAlternatingPegDynamics(candidate,{period=12,load=2,coulomb=0,qmid=.10,amplitude=.26,damping=[4,.006,.006],clock}={}){
 const u=candidate.root.userData,p=u.geometry,motion=u.motion,density=1/u.masses.lower.volume,omega=2*Math.PI/period,
  phase=Math.asin(-qmid/amplitude),mass=Object.fromEntries(['wheel','upper','lower'].map(key=>{const m=u.masses[key];return[key,{m:m.volume*density,I:m.polar*density,c:m.centroid.slice(0,2)}];})),
  inertia=['wheel','upper','lower'].map(key=>mass[key].I),profiles=Object.fromEntries(['upper','lower'].map(key=>[key,pegPawlProfile(u.profiles[key])]));
 if(!Number.isFinite(phase))throw Error('Input does not pass the source pose');
 const input=time=>{const sample=samplePegInputClock(clock,time/period-Math.floor(time/period)),a=clock?2*Math.PI*sample.phase+phase:omega*time+phase,
  phaseSpeed=omega*sample.rate,phaseAcceleration=omega/period*sample.acceleration,
  q=qmid+amplitude*Math.sin(a),v=amplitude*phaseSpeed*Math.cos(a),acceleration=amplitude*(phaseAcceleration*Math.cos(a)-phaseSpeed*phaseSpeed*Math.sin(a));
  const pawls=Object.fromEntries(['upper','lower'].map(key=>{const arm=rotate(p.arms[key],q),tangent=[-arm[1],arm[0]];
   return[key,{pivot:add(p.A,arm),velocity:mul(tangent,v),acceleration:add(mul(tangent,acceleration),mul(arm,-v*v))}];}));
  return{q,v,acceleration,pawls};
 };
 const forces=(x,time)=>{const k=input(time);return[-load,...['upper','lower'].map((key,i)=>{
  const m=mass[key],r=rotate(m.c,x[i+1]);return-m.m*(9.81*r[0]+cross(r,k.pawls[key].acceleration));
 })];};
 const constraints=(x,time,padding=.003)=>{
  const k=input(time),rows=[],gaps={},pins=Array.from({length:24},(_,j)=>motion.pinAt(j,x[0]));
  for(const [i,key]of ['upper','lower'].entries()){
   const profile=profiles[key],alpha=x[i+1],P=k.pawls[key].pivot;let minimum=Infinity;
   for(let pinIndex=0;pinIndex<pins.length;pinIndex++){
    const pin=pins[pinIndex],delta=sub(pin,P),distance=Math.hypot(...delta);
    if(distance>profile.maximumRadius+p.pinRadius+padding){minimum=Math.min(minimum,distance-profile.maximumRadius-p.pinRadius);continue;}
    const center=rotate(delta,-alpha),near=profile.closest(center),gap=near.signedDistance-p.pinRadius;minimum=Math.min(minimum,gap);
    if(gap>padding)continue;
    for(const f of profile.features(center)){
     if(f.distance>p.pinRadius+padding)continue;
     const normal=rotate(mul(f.normal,near.inside?-1:1),alpha),point=add(P,rotate(f.point,alpha)),J=[cross(pin,normal),0,0];J[i+1]=-cross(sub(point,P),normal);
     if(rows.some(r=>r.key===key&&r.pin===pinIndex&&dot(r.normal,normal)>1-1e-10&&Math.hypot(...sub(r.point,point))<1e-8))continue;
     rows.push({id:key+':'+pinIndex+':'+f.index,key,pin:pinIndex,point,normal,J,gap:(near.inside?-f.distance:f.distance)-p.pinRadius,
      inputNormalVelocity:-dot(normal,k.pawls[key].velocity)});
    }
   }
   gaps[key]=minimum;
  }
  return{rows,gaps};
 };
 return{parameters:{period,load,coulomb,qmid,amplitude,damping,density,mass,omega,phase,inertia,clock},input,forces,constraints,
  initial:{time:0,x:[0,p.initialAngles.upper,p.initialAngles.lower],v:[0,0,0],active:[]}};
}

export function solvePegFrictionProjection(inverse,free,rows,b,bound,lastIds=[]){
 if(bound===0){const result=solveContactProjection(inverse,free,rows,b,lastIds);return result?{...result,frictionImpulse:0,frictionMode:'none'}:null;}
 for(const sign of [1,-1]){
  const shifted=free.map((v,i)=>v-sign*bound*inverse[i][0]),result=solveContactProjection(inverse,shifted,rows,b,lastIds);
  if(result&&sign*result.v[0]>=-1e-10)return{...result,frictionImpulse:-sign*bound,frictionMode:sign>0?'positive-slide':'negative-slide'};
 }
 const reduced=inverse.map((row,i)=>row.map((v,j)=>i===0||j===0?0:v)),result=solveContactProjection(reduced,[0,...free.slice(1)],rows,b,lastIds);
 if(!result)return null;
 const normalImpulse=rows.reduce((sum,row,i)=>sum+row.J[0]*result.impulses[i],0),frictionImpulse=-free[0]/inverse[0][0]-normalImpulse;
 if(Math.abs(frictionImpulse)>bound+1e-8)return null;
 return{...result,frictionImpulse,frictionMode:'stick'};
}

export function advanceAlternatingPegStep(physics,state,dt){
 const time=state.time+dt,x0=state.x,{inertia,damping}=physics.parameters,effective=inertia.map((I,i)=>I+dt*damping[i]),
  inverse=effective.map((I,i)=>effective.map((_,j)=>i===j?1/I:0));
 let x=x0.map((a,i)=>a+dt*state.v[i]),lastIds=state.active;
 for(let iteration=0;iteration<40;iteration++){
  const F=physics.forces(x,time),free=F.map((f,i)=>(inertia[i]*state.v[i]+dt*f)/effective[i]),contact=physics.constraints(x,time),
   b=contact.rows.map(r=>(r.J.reduce((sum,a,i)=>sum+a*(x[i]-x0[i]),0)-r.gap)/dt),
   solution=solvePegFrictionProjection(inverse,free,contact.rows,b,physics.parameters.coulomb*dt,lastIds);
  if(!solution)return{okay:false,reason:'contact-projection-infeasible',time,x,contact};
  const next=x0.map((a,i)=>a+dt*solution.v[i]),change=Math.max(...next.map((a,i)=>Math.abs(a-x[i])));x=next;lastIds=solution.active;
  if(change<1e-11){
   const final=physics.constraints(x,time),minimumGap=Math.min(...Object.values(final.gaps));
   if(minimumGap< -2e-9)return{okay:false,reason:'nonlinear-penetration',time,x,minimumGap,contact:final};
   return{okay:true,state:{time,x,v:solution.v,active:lastIds},diagnostic:{iterations:iteration+1,minimumGap,residual:solution.residual,
    frictionImpulse:solution.frictionImpulse,frictionMode:solution.frictionMode,
    contacts:contact.rows.map((r,i)=>({id:r.id,key:r.key,pin:r.pin,impulse:solution.impulses[i],gap:r.gap})).filter(r=>r.impulse>1e-12)}};
  }
 }
 return{okay:false,reason:'nonlinear-iteration-limit',time,x};
}
