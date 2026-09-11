import{tiltHammerSource as source,tiltHammerOutlines}from'./tilt-hammer-source-profile.mjs';
const pitch=Math.PI/2,turn=Math.PI*2;
export const rotate2=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const closest=(p,a,b)=>{
  const d=sub(b,a),den=dot(d,d),t=den?Math.max(0,Math.min(1,dot(sub(p,a),d)/den)):0;
  return add(a,d.map(v=>v*t));
};
const circleIntersections=(a,ar,b,br)=>{
  const d=sub(b,a),length=Math.hypot(...d);
  if(length>ar+br||length<Math.abs(ar-br)||length===0)return[];
  const x=(ar*ar-br*br+length*length)/(2*length),h=Math.sqrt(Math.max(0,ar*ar-x*x));
  return[-1,1].map(sign=>[a[0]+(x*d[0]-sign*h*d[1])/length,a[1]+(x*d[1]+sign*h*d[0])/length]);
};
const insidePolygon=(p,points)=>{
  let inside=false;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
};
const overlap=(a,b)=>{
  if(a.some(p=>insidePolygon(p,b))||b.some(p=>insidePolygon(p,a)))return true;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
    const x=a[i],y=a[(i+1)%a.length],u=b[j],v=b[(j+1)%b.length];
    if(cross(sub(y,x),sub(u,x))*cross(sub(y,x),sub(v,x))<0
      &&cross(sub(v,u),sub(x,u))*cross(sub(v,u),sub(y,u))<0)return true;
  }
  return false;
};

export function makeTiltHammerContactStudy(){
  const s=source.scale,world=p=>[(p[0]-source.camCenter[0])/s,(source.camCenter[1]-p[1])/s];
  const pivot=world(source.pivot),noseOffset=sub(world(source.noseCenter),pivot),noseRadius=source.noseRadius/s;
  const flankCenter=world(source.flankCenter),flankRadius=source.flankRadius/s,noseOrbit=Math.hypot(...noseOffset);
  const radial=angle=>{const d=[Math.cos(angle),Math.sin(angle)],v=dot(flankCenter,d);
    return v+Math.sqrt(flankRadius**2-dot(flankCenter,flankCenter)+v*v);};
  const low=radial(0),high=radial(pitch),baseA=[low,0],baseB=[0,high];
  const arcs=Array.from({length:4},(_,i)=>({center:rotate2(flankCenter,i*pitch),angle:i*pitch,
    a:rotate2(baseA,i*pitch),b:rotate2(baseB,i*pitch)}));
  const steps=arcs.map((arc,i)=>({a:arc.b,b:arcs[(i+1)%4].a}));
  const arcContains=(point,arc)=>{const p=rotate2(point,-arc.angle);return p[0]>=-1e-9&&p[1]>=-1e-9;};
  const camGap=point=>{
    let distance=Infinity;
    for(const arc of arcs){
      const delta=sub(point,arc.center),r=Math.hypot(...delta);
      const at=add(arc.center,delta.map(v=>v*flankRadius/r));
      if(arcContains(at,arc))distance=Math.min(distance,Math.abs(r-flankRadius));
    }
    for(const step of steps)distance=Math.min(distance,Math.hypot(...sub(point,closest(point,step.a,step.b))));
    const angle=((Math.atan2(point[1],point[0])%pitch)+pitch)%pitch;
    const inside=Math.hypot(...point)<radial(angle);
    return inside?-distance-noseRadius:distance-noseRadius;
  };
  const gap=(angle,q)=>camGap(rotate2(add(pivot,rotate2(noseOffset,q)),-angle));
  const boundary=angle=>{
    const candidates=[];
    const offer=(center,at,feature)=>{
      const offset=sub(center,pivot),q=wrap(Math.atan2(offset[1],offset[0])-Math.atan2(noseOffset[1],noseOffset[0]));
      if(q<-.2||q>.25)return;
      const delta=sub(center,at),distance=Math.hypot(...delta),normal=delta.map(v=>v/distance);
      const outputMoment=cross(sub(at,pivot),normal),inputMoment=cross(at,normal);
      if(outputMoment>=-1e-8||Math.abs(gap(angle,q))>2e-7)return;
      candidates.push({q,feature,center,point:at,normal,outputMoment,inputMoment,derivative:inputMoment/outputMoment});
    };
    for(const[i,arc]of arcs.entries()){
      const center=rotate2(arc.center,angle);
      for(const nose of circleIntersections(pivot,noseOrbit,center,flankRadius+noseRadius)){
        const at=add(center,sub(nose,center).map(v=>v*flankRadius/(flankRadius+noseRadius)));
        if(arcContains(rotate2(at,-angle),arc))offer(nose,at,`arc-${i}`);
      }
      for(const[end,local]of[['root',arc.a],['tip',arc.b]]){
        const at=rotate2(local,angle);
        for(const nose of circleIntersections(pivot,noseOrbit,at,noseRadius))offer(nose,at,`${end}-${i}`);
      }
      const a=rotate2(steps[i].a,angle),b=rotate2(steps[i].b,angle),d=sub(b,a),length=Math.hypot(...d);
      const normal=[d[1]/length,-d[0]/length],offset=add(a,normal.map(v=>v*noseRadius));
      const v=sub(offset,pivot),aa=dot(d,d),bb=2*dot(d,v),cc=dot(v,v)-noseOrbit*noseOrbit,disc=bb*bb-4*aa*cc;
      if(disc>=0)for(const sign of [-1,1]){
        const t=(-bb+sign*Math.sqrt(disc))/(2*aa);
        if(t>=0&&t<=1)offer(add(offset,d.map(v=>v*t)),add(a,d.map(v=>v*t)),`step-${i}`);
      }
    }
    return candidates.sort((a,b)=>a.q-b.q)[0]??null;
  };
  const outlines=tiltHammerOutlines(),moving={};
  for(const name of ['hammer','striker','sleeve','neck','noseStem'])moving[name]=outlines[name].map(p=>sub(world(p),pivot));
  const workpiece=outlines.workpiece.map(world),atQ=(points,q)=>points.map(p=>add(pivot,rotate2(p,q)));
  const hitsWorkpiece=q=>Object.values(moving).some(points=>overlap(atQ(points,q),workpiece));
  if(hitsWorkpiece(0)||!hitsWorkpiece(.2))throw new Error('Workpiece contact bracket failed');
  let restLow=0,restHigh=.2;
  for(let i=0;i<48;i++){const mid=(restLow+restHigh)/2;if(hitsWorkpiece(mid))restHigh=mid;else restLow=mid;}
  return{parameters:{scale:s,pivot,noseOffset,noseRadius,noseOrbit,flankCenter,flankRadius,low,high,pitch,restQ:restLow},
    arcs,steps,moving,workpiece,boundary,gap,radial,atQ};
}
