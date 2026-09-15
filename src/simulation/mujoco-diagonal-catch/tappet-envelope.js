// Vertical support of a finite planar arm over the complete shoe width.
// Contact may move between edges; it is not tied to a material marker.
export function tappetEnvelope({rings,pivot,startAngle,endAngle,left,right,rising,halfHeight=.25}) {
 const at=angle=>{
  const c=Math.cos(angle),s=Math.sin(angle);
  let point=null;
  for(const ring of rings){
   const vertices=ring.map(([x,y])=>[pivot[0]+c*x-s*y,pivot[1]+s*x+c*y]);
   for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length],dx=b[0]-a[0];
    let lo=0,hi=1;
    if(Math.abs(dx)<1e-12){if(a[0]<left||a[0]>right)continue;}
    else {const t0=(left-a[0])/dx,t1=(right-a[0])/dx;lo=Math.max(0,Math.min(t0,t1));hi=Math.min(1,Math.max(t0,t1));if(lo>hi)continue;}
    for(const t of [lo,hi]){
     const p=[a[0]+dx*t,a[1]+(b[1]-a[1])*t];
     if(!point||(rising?p[1]<point[1]:p[1]>point[1]))point=p;
    }
   }
  }
  return point;
 };
 const angleAt=u=>startAngle+(endAngle-startAngle)*u;
 if(!at(startAngle))throw new Error('Working arm misses the input shoe');
 if(at(endAngle))throw new Error('Held working arm cannot clear the input shoe');
 let lo=0,hi=1;
 for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(at(angleAt(mid)))lo=mid;else hi=mid;}
 const releasePoint=at(angleAt(lo)),offset=rising?-halfHeight:halfHeight;
 const sample=angle=>{const point=at(angle);return {engaged:!!point,point:point??releasePoint,value:(point??releasePoint)[1]+offset};};
 const law=angleState=>{
  const h=1e-5,center=sample(angleState.value),minus=sample(angleState.value-h),plus=sample(angleState.value+h);
  const derivative=(plus.value-minus.value)/(2*h),second=(plus.value-2*center.value+minus.value)/(h*h);
  return {...center,first:derivative*angleState.first,second:second*angleState.first**2+derivative*angleState.second};
 };
 const pointState=angleState=>{
  const h=1e-5,point=sample(angleState.value).point,minus=sample(angleState.value-h).point,plus=sample(angleState.value+h).point;
  const derivative=point.map((_,i)=>(plus[i]-minus[i])/(2*h));
  return {point,first:derivative.map(v=>v*angleState.first),second:point.map((v,i)=>(plus[i]-2*v+minus[i])/(h*h)*angleState.first**2+derivative[i]*angleState.second)};
 };
 return {sample,law,pointState,releaseFraction:lo,strike:sample(startAngle).value,release:releasePoint[1]+offset};
}
