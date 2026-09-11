const turn=2*Math.PI,mod=(a,b)=>((a%b)+b)%b;

// Distance to every finite boundary feature. A round follower can touch both
// sides of a concave tooth seat, requiring two independent normal reactions.
export function ratchetFeatureDistances(ratchet,point){
  return ratchet.features.map((feature,index)=>{
    let candidate;
    if(feature.type==='face'){
      const dx=feature.b[0]-feature.a[0],dy=feature.b[1]-feature.a[1];
      const t=Math.max(0,Math.min(1,((point[0]-feature.a[0])*dx+(point[1]-feature.a[1])*dy)/(dx*dx+dy*dy)));
      candidate=[feature.a[0]+t*dx,feature.a[1]+t*dy];
    }else{
      const angle=Math.atan2(point[1]-feature.center[1],point[0]-feature.center[0]);
      if(mod(feature.start-angle,turn)<=feature.span)
        candidate=[feature.center[0]+feature.radius*Math.cos(angle),feature.center[1]+feature.radius*Math.sin(angle)];
      else candidate=Math.hypot(point[0]-feature.a[0],point[1]-feature.a[1])
        <Math.hypot(point[0]-feature.b[0],point[1]-feature.b[1])?feature.a:feature.b;
    }
    const delta=[point[0]-candidate[0],point[1]-candidate[1]],distance=Math.hypot(...delta);
    return{index,feature:feature.type,tooth:feature.tooth,point:candidate,distance,
      normal:distance>1e-12?delta.map(v=>v/distance):null};
  });
}
