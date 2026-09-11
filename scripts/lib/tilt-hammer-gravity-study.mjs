import polygonClipping from 'polygon-clipping';
import{makeTiltHammerContactStudy,rotate2}from'./tilt-hammer-contact-study.mjs';
const bisect=(fn,low,high)=>{
  const first=fn(low);
  if(first*fn(high)>0)throw new Error('Unbracketed event');
  for(let i=0;i<52;i++){const mid=(low+high)/2;if(fn(mid)*first>0)low=mid;else high=mid;}
  return(low+high)/2;
};
const circle=(center,radius)=>Array.from({length:2048},(_,i)=>[center[0]+radius*Math.cos(i*Math.PI/1024),center[1]+radius*Math.sin(i*Math.PI/1024)]);
const close=points=>[...points,points[0]];
const massProperties=study=>{
  const p=study.parameters;
  const polygons=[...Object.values(study.moving),circle(p.noseOffset,p.noseRadius),circle([0,0],50/p.scale)];
  const contours=polygonClipping.union(...polygons.map(points=>[close(points)]));
  let area=0,x=0,y=0,polar=0;
  for(const polygon of contours)for(const ring of polygon)for(let i=0;i<ring.length-1;i++){
    const a=ring[i],b=ring[i+1],c=a[0]*b[1]-b[0]*a[1];area+=c/2;
    x+=(a[0]+b[0])*c/6;y+=(a[1]+b[1])*c/6;
    polar+=(a[0]**2+a[0]*b[0]+b[0]**2+a[1]**2+a[1]*b[1]+b[1]**2)*c/12;
  }
  if(!(area>0&&polar>0))throw new Error('Invalid hammer mass profile');
  // A blind pivot bore accepts the fixed rear pin; the front 0.02 remains
  // closed, preserving the rounded source face. Normalize by body depth.
  const pivotBoreRadius=.065,pivotBoreDepth=.26,bodyDepth=.28;
  area-=Math.PI*pivotBoreRadius**2*pivotBoreDepth/bodyDepth;
  polar-=Math.PI*pivotBoreRadius**4/2*pivotBoreDepth/bodyDepth;
  return{area,centroid:[x/area,y/area],inertiaPerMass:polar/area,contours,pivotBoreRadius,pivotBoreDepth,bodyDepth};
};

export function makeTiltHammerGravityStudy({omega=.6,gravity=9.81,fallStep=1/8000}={}){
  const contact=makeTiltHammerContactStudy(),p=contact.parameters,mass=massProperties(contact),inputStart=.7;
  const acceleration=q=>-gravity*rotate2(mass.centroid,q)[0]/mass.inertiaPerMass;
  const energy=(q,v)=>mass.inertiaPerMass*v*v/2+gravity*rotate2(mass.centroid,q)[1];
  const drivenAt=angle=>{
    const state=contact.boundary(angle);if(!state)throw new Error('Missing support boundary');
    const h=1e-5,lo=contact.boundary(angle-h),hi=contact.boundary(angle+h);
    let curvature=(hi.derivative-lo.derivative)/(2*h);
    if(lo.feature!==state.feature&&hi.feature===state.feature){
      const farther=contact.boundary(angle+2*h);
      curvature=(-3*state.derivative+4*hi.derivative-farther.derivative)/(2*h);
    }else if(hi.feature!==state.feature&&lo.feature===state.feature){
      const farther=contact.boundary(angle-2*h);
      curvature=(3*state.derivative-4*lo.derivative+farther.derivative)/(2*h);
    }
    const ddq=omega*omega*curvature,velocity=-omega*state.derivative;
    const reaction=mass.inertiaPerMass*(ddq-acceleration(state.q))/state.outputMoment;
    return{...state,velocity,acceleration:ddq,reaction,motorPowerPerMass:-omega*reaction*state.inputMoment};
  };
  const entryAngle=bisect(angle=>contact.boundary(angle).q-p.restQ,.3,.7);
  let previous=entryAngle,releaseBracket=null;
  for(let i=1;i<=3200;i++){
    const angle=entryAngle-i/4000,state=drivenAt(angle);
    if(state.reaction<=0){releaseBracket=[angle,previous];break;}
    previous=angle;
  }
  if(!releaseBracket)throw new Error('No unilateral release found');
  const releaseAngle=bisect(angle=>drivenAt(angle).reaction,...releaseBracket);
  const entry=drivenAt(entryAngle),release=drivenAt(releaseAngle);
  const entryTime=(inputStart-entryAngle)/omega,releaseTime=(inputStart-releaseAngle)/omega;
  let joinLow=entryTime,joinHigh=releaseTime;
  for(let i=0;i<48;i++){
    const mid=(joinLow+joinHigh)/2;
    if(contact.boundary(inputStart-omega*mid).feature.startsWith('arc'))joinLow=mid;else joinHigh=mid;
  }
  const flankEndTime=(joinLow+joinHigh)/2,flankEndAngle=inputStart-omega*flankEndTime;
  const crestAngle=bisect(angle=>contact.boundary(angle).derivative,releaseAngle,flankEndAngle);
  const rk4=(state,h)=>{
    const f=([q,v])=>[v,acceleration(q)],add=(s,k,a)=>s.map((v,i)=>v+k[i]*a);
    const a=f(state),b=f(add(state,a,h/2)),c=f(add(state,b,h/2)),d=f(add(state,c,h));
    return state.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
  };
  const fall=[{time:releaseTime,q:release.q,velocity:release.velocity}];
  while(fall.at(-1).q<p.restQ){
    const last=fall.at(-1),state=[last.q,last.velocity];let h=fallStep,result=rk4(state,h);
    if(result[0]>=p.restQ){h=bisect(dt=>rk4(state,dt)[0]-p.restQ,0,h);result=rk4(state,h);}
    fall.push({time:last.time+h,q:result[0],velocity:result[1]});
    if(fall.length>100000)throw new Error('Fall did not land');
    if(Math.abs(result[0]-p.restQ)<1e-13)break;
  }
  const landing=fall.at(-1),period=p.pitch/omega;
  if(landing.time>=period+entryTime)throw new Error('Next lobe arrives before landing');
  const stateAtTime=time=>{
    const cycle=Math.floor(time/period),angle=inputStart-omega*time;
    let t=time-cycle*period;
    for(const event of [entryTime,releaseTime,landing.time])if(Math.abs(t-event)<1e-12)t=event;
    if(t<entryTime||t>=landing.time)return{time,angle,q:p.restQ,velocity:0,stage:'workpiece-dwell',cycle};
    if(t<=releaseTime)return{time,angle,...drivenAt(inputStart-omega*t),stage:'cam-lift-and-tip-contact',cycle};
    let low=0,high=fall.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(fall[mid].time<=t)low=mid;else high=mid;}
    const a=fall[low],b=fall[high],h=b.time-a.time,u=(t-a.time)/h;
    const q=(2*u**3-3*u*u+1)*a.q+(u**3-2*u*u+u)*h*a.velocity+(-2*u**3+3*u*u)*b.q+(u**3-u*u)*h*b.velocity;
    const velocity=((6*u*u-6*u)*a.q+(3*u*u-4*u+1)*h*a.velocity+(-6*u*u+6*u)*b.q+(3*u*u-2*u)*h*b.velocity)/h;
    return{time,angle,q,velocity,stage:'gravity-fall',cycle};
  };
  return{contact,parameters:{...p,omega,gravity,inputStart,period,fallStep},mass,
    events:{entry:{time:entryTime,angle:entryAngle,...entry},
      flankEnd:{time:flankEndTime,angle:flankEndAngle,...drivenAt(flankEndAngle)},
      crest:{time:(inputStart-crestAngle)/omega,angle:crestAngle,...drivenAt(crestAngle)},
      release:{time:releaseTime,angle:releaseAngle,...release},landing},
    fall,stateAtTime,drivenAt,acceleration,energy};
}
