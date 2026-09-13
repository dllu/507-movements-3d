const turn=2*Math.PI, wrap=a=>((a%turn)+turn)%turn;
const point=(arc,a)=>[arc.center[0]+arc.radius*Math.cos(a),arc.center[1]+arc.radius*Math.sin(a)];

/** Four circular arcs form a convex constant-width cam with two shaft-centered dwells. */
export function triangularEccentricProfile({width,smallRadius}) {
  if(!Number.isFinite(width)||!Number.isFinite(smallRadius)||!(width>0&&smallRadius>0&&smallRadius<width/2))
    throw new RangeError('The small radius must lie between zero and half the cam width');
  const largeRadius=width-smallRadius, halfWidth=width/2;
  const height=Math.sqrt(largeRadius**2-halfWidth**2),alpha=Math.atan2(height,halfWidth);
  const arcs=[
    {name:'upper',center:[0,0],radius:largeRadius,start:alpha,end:Math.PI-alpha},
    {name:'left',center:[halfWidth,height],radius:width,start:Math.PI,end:Math.PI+alpha},
    {name:'lower',center:[0,0],radius:smallRadius,start:Math.PI+alpha,end:turn-alpha},
    {name:'right',center:[-halfWidth,height],radius:width,start:turn-alpha,end:turn},
  ];
  const extreme=(rotation,sign=1)=>{
    const direction=[sign*Math.sin(rotation),sign*Math.cos(rotation)];
    const angle=wrap(Math.atan2(direction[1],direction[0]));let best;
    for(const arc of arcs)for(const a of [arc.start,arc.end,...(angle>=arc.start&&angle<=arc.end?[angle]:[])]) {
      const p=point(arc,a),value=p[0]*direction[0]+p[1]*direction[1];
      if(!best||value>best.projection)best={projection:value,value:sign*value,point:p,arc:arc.name};
    }
    return best;
  };
  const outline=tolerance=>{
    if(!(Number.isFinite(tolerance)&&tolerance>0))throw new RangeError('Positive finite chord tolerance required');
    return arcs.flatMap(arc=>{
      const step=2*Math.acos(Math.max(-1,1-tolerance/arc.radius));
      const count=Math.max(2,2*Math.ceil((arc.end-arc.start)/step/2));
      return Array.from({length:count},(_,i)=>point(arc,arc.start+(arc.end-arc.start)*i/count));
    });
  };
  const distance=p=>Math.min(...arcs.map(arc=>{
    const delta=p.map((x,i)=>x-arc.center[i]),angle=wrap(Math.atan2(delta[1],delta[0]));
    if(angle>=arc.start&&angle<=arc.end)return Math.abs(Math.hypot(...delta)-arc.radius);
    return Math.min(...[arc.start,arc.end].map(a=>Math.hypot(...point(arc,a).map((x,i)=>x-p[i]))));
  }));
  return {width,smallRadius,largeRadius,height,arcs,extreme,outline,distance,
    amplitude:(largeRadius-smallRadius)/2,dwellHalfAngle:Math.PI/2-alpha};
}
