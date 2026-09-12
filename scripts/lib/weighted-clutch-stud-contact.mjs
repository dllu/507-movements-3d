import source from './weighted-clutch-source.mjs';
import {toWeightedClutchWorld as world} from './weighted-clutch-linkage.mjs';

const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),scale=(p,s)=>p.map(v=>v*s),
 dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],length=p=>Math.hypot(...p),
 rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];

// Exact planar circle/capsule contact screen for the visible upper arm of G.
// The finite bar end is retained. The rendered meshes approximate these curves
// and require a separate native-surface check before motion can be qualified.
export function weightedClutchStudContacts(linkage,leverAngle){
 const L=linkage.parameters,state=linkage.atAngle(leverAngle),G=L.G,E=world(source.wheelE.hub.center),
  upper0=sub(world(source.bell.upperEnd),G),upper=rotate(upper0,state.bellAngle),end=add(G,upper),barLength=length(upper),
  tangent=scale(upper,1/barLength),normal=[-tangent[1],tangent[0]],orbit=length(sub(world(source.wheelE.stud.center),E)),
  barRadius=source.bell.upperHalfWidth/source.scale,studRadius=source.wheelE.stud.radius/source.scale,R=barRadius+studRadius,
  candidates=[],tolerance=1e-10;
 const nearestOnBar=p=>{const t=Math.max(0,Math.min(barLength,dot(sub(p,G),tangent)));return add(G,scale(tangent,t));};
 const addCandidate=(p,feature)=>{
  const nearest=nearestOnBar(p),delta=sub(p,nearest),distance=length(delta);
  if(Math.abs(distance-R)>tolerance||candidates.some(c=>length(sub(c.stud,p))<1e-9))return;
  const outward=scale(delta,1/distance),forceOnG=scale(outward,-1),pointOnG=add(nearest,scale(outward,barRadius)),
   theta=Math.atan2(p[1]-E[1],p[0]-E[0]),derivativeE=dot(outward,[-(p[1]-E[1]),p[0]-E[0]]),torqueG=cross(sub(pointOnG,G),forceOnG);
  candidates.push({feature,theta,stud:p,pointOnG,forceOnG,torqueG,derivativeE,
   approachCCW:derivativeE<0,approachCW:derivativeE>0});
 };
 // Intersect the wheel orbit with both finite offset sides.
 for(const side of [-1,1]){
  const base=add(G,scale(normal,side*R)),delta=sub(base,E),b=dot(delta,tangent),c=dot(delta,delta)-orbit**2,discriminant=b*b-c;
  if(discriminant<0)continue;
  for(const t of [-b-Math.sqrt(discriminant),-b+Math.sqrt(discriminant)])if(t>=-tolerance&&t<=barLength+tolerance)
   addCandidate(add(base,scale(tangent,t)),'side'+side);
 }
 // Intersect the orbit with both rounded ends, rejecting the hidden half.
 for(const[center,feature]of [[G,'pivot-cap'],[end,'tip-cap']]){
  const delta=sub(center,E),d=length(delta),along=(orbit**2+d*d-R*R)/(2*d),square=orbit**2-along**2;
  if(!(d>0)||square<0)continue;
  const height=Math.sqrt(square),unit=scale(delta,1/d),n=[-unit[1],unit[0]];
  for(const sign of [-1,1]){
   const p=add(add(E,scale(unit,along)),scale(n,sign*height)),projection=dot(sub(p,center),tangent);
   if(feature==='pivot-cap'?projection<=tolerance:projection>=-tolerance)addCandidate(p,feature);
  }
 }
 const radialGap=length(sub(E,nearestOnBar(E)))-orbit-R;
 return{leverAngle,bellAngle:state.bellAngle,barLength,orbit,barRadius,studRadius,radialGap,contacts:candidates.sort((a,b)=>a.theta-b.theta)};
}
