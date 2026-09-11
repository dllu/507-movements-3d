const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const add=(a,b)=>a.map((v,i)=>v+b[i]);

// Playback of the continuous three-coordinate contact integration. Linear
// interpolation is deliberate: its swept nose clearance is checked separately.
export function makeReciprocatingPawlMotion(profile){
  const p=profile.parameters,playback=profile.playback,
    noseB=rotate(p.VB,p.sourceBarAngle),noseH=rotate(p.VH,p.sourceHAngle);
  const atTime=time=>{
    if(!Number.isFinite(time))throw new Error('Invalid ratchet playback time');
    const physical=time*playback.period/p.period,cycle=Math.floor(physical/playback.period),local=physical-cycle*playback.period,
      table=cycle===0?playback.first:playback.steady;
    let low=0,high=table.length-1;
    while(high-low>1){const middle=(low+high)>>1;if(table[middle][0]<=local)low=middle;else high=middle;}
    const a=table[low],b=table[high],fraction=Math.max(0,Math.min(1,(local-a[0])/(b[0]-a[0]))),
      values=a.slice(1).map((v,k)=>v+(b[k+1]-v)*fraction),
      velocities=a.slice(1).map((v,k)=>(b[k+1]-v)/(b[0]-a[0])*playback.period/p.period),
      [barOffset,theta,angleB,angleH]=values,
      wheelAngle=theta-(cycle===0?0:cycle-1)*p.pitch,barAngle=p.sourceBarAngle+barOffset,
      pivotB=rotate([-p.barRadius,0],barAngle),rodPosition=rotate(p.rodJoint,barAngle),
      rodAngle=Math.asin((p.rodX-rodPosition[0])/p.rodLength),
      coordinate=p.sourcePhase+time/p.period,phase=coordinate-Math.floor(coordinate),
      B={pivot:pivotB,center:add(pivotB,rotate(noseB,angleB)),angle:angleB-barOffset},
      H={pivot:p.PH,center:add(p.PH,rotate(noseH,angleH)),angle:angleH+p.sourceHAngle};
    B.gravityMoment=-9.81*rotate(profile.mass.B.centroid,angleB)[0];
    H.gravityMoment=-9.81*profile.mass.density*profile.mass.H.volume*rotate(profile.mass.H.centroid,angleH)[0];
    return{time,phase,cycle,barAngle,wheelAngle,barOffset,wheelOffset:wheelAngle-p.sourceWheelAngle,
      angleB,angleH,B,H,rodPosition,rodAngle,rodY:rodPosition[1],
      barVelocity:velocities[0],wheelVelocity:velocities[1],angularVelocities:velocities,
      stage:velocities[0]<0?'drive':'return'};
  };
  const atPhase=(phase,cycle=0)=>atTime((phase-p.sourcePhase+cycle)*p.period);
  return{parameters:p,points:profile.points,atPhase,atTime};
}
