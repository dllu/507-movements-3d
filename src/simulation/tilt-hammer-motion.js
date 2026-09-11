const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const tangent=p=>[-p[1],p[0]];

// Contact is solved against the actual circular flank or finite lobe tip.
// Gravity knots retain the independently audited trajectory. No polygon
// construction, event search or numerical integration runs during playback.
export function makeTiltHammerMotion(profile){
  const p=profile.parameters,mass=profile.mass,events=profile.events,fall=profile.fall;
  const gravityAcceleration=q=>-p.gravity*rotate(mass.centroid,q)[0]/mass.inertiaPerMass;
  const energy=(q,velocity)=>mass.inertiaPerMass*velocity**2/2+p.gravity*rotate(mass.centroid,q)[1];
  const contactAtAngle=angle=>{
    if(Math.abs(angle-events.flankEnd.angle)<1e-12)angle=events.flankEnd.angle;
    const arc=angle>events.flankEnd.angle;
    const center=rotate(arc?p.flankCenter:[0,p.high],angle),radius=arc?p.flankRadius+p.noseRadius:p.noseRadius;
    const delta=sub(center,p.pivot),length=Math.hypot(...delta);
    const x=(p.noseOrbit**2-radius**2+length**2)/(2*length);
    const height=Math.sqrt(Math.max(0,p.noseOrbit**2-x*x));
    const candidates=[];
    for(const sign of [-1,1]){
      const nose=[p.pivot[0]+(x*delta[0]-sign*height*delta[1])/length,
        p.pivot[1]+(x*delta[1]+sign*height*delta[0])/length];
      const arm=sub(nose,p.pivot),d=sub(nose,center),normal=d.map(v=>v/radius);
      const q=Math.atan2(Math.sin(Math.atan2(arm[1],arm[0])-Math.atan2(p.noseOffset[1],p.noseOffset[0])),
        Math.cos(Math.atan2(arm[1],arm[0])-Math.atan2(p.noseOffset[1],p.noseOffset[0])));
      const point=nose.map((v,i)=>v-p.noseRadius*normal[i]);
      const outputMoment=cross(arm,normal),inputMoment=cross(center,normal);
      if(q<-.2||q>.25||outputMoment>=-1e-8)continue;
      const derivative=inputMoment/outputMoment;
      const relative=tangent(arm).map((v,i)=>v*derivative-tangent(center)[i]);
      const curvature=(dot(d,arm)*derivative**2-dot(d,center)-dot(relative,relative))/dot(d,tangent(arm));
      const acceleration=p.omega**2*curvature,velocity=-p.omega*derivative;
      const reaction=mass.inertiaPerMass*(acceleration-gravityAcceleration(q))/outputMoment;
      candidates.push({q,velocity,acceleration,reaction,derivative,point,normal,center:nose,
        outputMoment,inputMoment,motorPowerPerMass:-p.omega*reaction*inputMoment,feature:arc?'arc-0':'tip-0'});
    }
    const state=candidates.sort((a,b)=>a.q-b.q)[0];
    if(!state)throw new Error('Tilt hammer has no compressive contact branch');
    return state;
  };
  const atCycleTime=t=>{
    for(const event of [events.entry,events.release,events.landing])if(Math.abs(t-event.time)<1e-12)t=event.time;
    if(t<events.entry.time||t>=events.landing.time)return{q:p.restQ,velocity:0,stage:'workpiece-dwell'};
    if(t<=events.release.time)return{...contactAtAngle(p.inputStart-p.omega*t),stage:'cam-lift-and-tip-contact'};
    let low=0,high=fall.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(fall[mid][0]<=t)low=mid;else high=mid;}
    const a=fall[low],b=fall[high],h=b[0]-a[0],u=(t-a[0])/h;
    const q=(2*u**3-3*u*u+1)*a[1]+(u**3-2*u*u+u)*h*a[2]+(-2*u**3+3*u*u)*b[1]+(u**3-u*u)*h*b[2];
    const velocity=((6*u*u-6*u)*a[1]+(3*u*u-4*u+1)*h*a[2]+(-6*u*u+6*u)*b[1]+(3*u*u-2*u)*h*b[2])/h;
    return{q,velocity,stage:'gravity-fall'};
  };
  const atTime=time=>{
    const absoluteTime=time+p.initialTime,cycle=Math.floor(absoluteTime/p.period),cycleTime=absoluteTime-cycle*p.period;
    const state=atCycleTime(cycleTime);
    return{...state,time,absoluteTime,cycle,cycleTime,angle:p.inputStart-p.omega*absoluteTime,
      inputSpeed:-p.omega,camContactEngaged:state.stage==='cam-lift-and-tip-contact',
      workpieceContactEngaged:state.stage==='workpiece-dwell'};
  };
  return{parameters:p,mass,events,atTime,atCycleTime,contactAtAngle,gravityAcceleration,energy};
}
