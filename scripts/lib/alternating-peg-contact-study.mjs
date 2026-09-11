import {polygonContact} from '../../src/simulation/jointed-tappet-contact.js';
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],
 dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],mul=(p,s)=>p.map(v=>v*s),
 rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];

const profileCache=new WeakMap();
export function pegPawlProfile(points){
 if(profileCache.has(points))return profileCache.get(points);
 const profile=polygonContact(points),maximumRadius=Math.max(...points.map(p=>Math.hypot(...p)));
 const closest=point=>{
  let square=Infinity,best,inside=false;
  for(const e of profile.edges){
   const x=point[0]-e.a[0],y=point[1]-e.a[1],fraction=Math.max(0,Math.min(1,(x*e.d[0]+y*e.d[1])/e.square)),
    dx=x-fraction*e.d[0],dy=y-fraction*e.d[1],s=dx*dx+dy*dy;
   if(s<square){square=s;best={edge:e,fraction,dx,dy};}
   if((e.a[1]>point[1])!==(e.b[1]>point[1])&&point[0]<e.d[0]*(point[1]-e.a[1])/e.d[1]+e.a[0])inside=!inside;
  }
  const distance=Math.sqrt(square),e=best.edge;
  return{distance,signedDistance:(inside?-1:1)*distance,inside,index:e.index,fraction:best.fraction,
   point:[point[0]-best.dx,point[1]-best.dy],normal:distance>1e-12?[best.dx/distance,best.dy/distance]:e.normal};
 };
 const result={...profile,closest,maximumRadius};profileCache.set(points,result);return result;
}

export function makeAlternatingPegStudy({seatPhase=1.0016665532175244}={}){
 const center=[456.9848887445678,837.6559823723948],scale=433.5789672975984,
  source=p=>[(p[0]-center[0])/scale,(center[1]-p[1])/scale],
  A=source([1177.5296875,619.965625]),pivots={upper:source([1180.398316970547,475.1991584852735]),lower:source([1180.7553310886644,771.7384960718294])},
  arms=Object.fromEntries(Object.entries(pivots).map(([k,p])=>[k,sub(p,A)])),pitch=2*Math.PI/24,orbit=379.3842184404373/scale,
  upperPhase=seatPhase,phases={upper:upperPhase,lower:upperPhase-2*pitch},
  seats=Object.fromEntries(Object.entries(phases).map(([k,a])=>[k,rotate([orbit,0],a)])),
  vectors=Object.fromEntries(Object.entries(pivots).map(([k,P])=>[k,sub(seats[k],P)])),
  lengths=Object.fromEntries(Object.entries(vectors).map(([k,v])=>[k,Math.hypot(...v)])),
  initialAngles=Object.fromEntries(Object.entries(vectors).map(([k,v])=>[k,Math.atan2(-v[1],-v[0])])),
  anchorAt=(key,q)=>add(A,rotate(arms[key],q)),pinAt=(index,theta)=>rotate([orbit,0],upperPhase+index*pitch+theta);
 const drivenAngle=(key,q)=>{
  const P=anchorAt(key,q),d=Math.hypot(...P),cos=(d*d+orbit*orbit-lengths[key]**2)/(2*d*orbit);
  if(Math.abs(cos)>1)throw new Error('Unreachable peg center');
  const mid=Math.atan2(P[1],P[0]),half=Math.acos(cos);return[mid-half,mid+half].sort((a,b)=>Math.abs(a-phases[key])-Math.abs(b-phases[key]))[0];
 };
 const mismatch=q=>drivenAngle('lower',q)-drivenAngle('upper',q)+3*pitch;let low=0,high=.233;
 if(mismatch(low)*mismatch(high)>0)throw new Error('Missing second common seat');
 for(let i=0;i<60;i++){const middle=(low+high)/2;if(mismatch(middle)>0)low=middle;else high=middle;}
 const stroke=(low+high)/2;
 const atPhase=coordinate=>{
  const cycle=Math.floor(coordinate),phase=coordinate-cycle,q=stroke*(1-Math.cos(2*Math.PI*phase))/2,active=phase<.5?'upper':'lower',
   theta=(active==='upper'?drivenAngle('upper',q)-phases.upper:drivenAngle('lower',q)-phases.lower+pitch)+cycle*pitch,
   index=(active==='upper'?0:-3)-cycle,P=anchorAt(active,q),N=pinAt(index,theta),angle=Math.atan2(P[1]-N[1],P[0]-N[0]);
  return{cycle,phase,q,theta,active,index,activeAngle:angle,anchors:{upper:anchorAt('upper',q),lower:anchorAt('lower',q)}};
 };
 return{parameters:{center,scale,A,pivots,arms,pitch,orbit,phases,seats,vectors,lengths,initialAngles,stroke,pinRadius:.049,innerRadius:323.5218298952886/scale},source,anchorAt,pinAt,drivenAngle,atPhase};
}

// Increasing pawl angle lowers its left-hand center of mass. In its fixed
// profile frame the peg moves around the pivot with the opposite rotation.
export function closePegPawl(points,pivot,pins,radius,{lower,upper=Math.PI/2}={}){
 if(!Number.isFinite(lower)||!Number.isFinite(upper)||upper<lower)throw new Error('Invalid closing bracket');
 const profile=pegPawlProfile(points),maximumRadius=profile.maximumRadius,candidates=[],
  unwrap=a=>{while(a<lower-Math.PI)a+=2*Math.PI;while(a>lower+Math.PI)a-=2*Math.PI;return a;};
 for(const world of pins){
  const center=rotate(sub(world,pivot),-lower),near=profile.closest(center),gap=near.signedDistance-radius;
  if(gap< -1e-7)throw new Error('Opening bracket is obstructed');
  if(Math.abs(gap)<1e-7)for(const feature of profile.features(center)){
   if(Math.abs(feature.distance-radius)<1e-7&&cross(center,feature.normal)>1e-10)candidates.push({angle:lower,feature:feature.index,initialContact:true});
  }
 }
 const addCandidate=(pin,center,normal,feature)=>{
  const alpha=unwrap(-Math.atan2(cross(pin,center),dot(pin,center)));
  if(alpha<lower-1e-10||alpha>upper+1e-10||cross(center,normal)<=1e-10)return;
  candidates.push({angle:alpha,feature});
 };
 for(const world of pins){
  const pin=sub(world,pivot),orbit=Math.hypot(...pin);
  if(orbit>maximumRadius+radius)continue;
  for(const edge of profile.edges){
   const base=add(edge.a,mul(edge.normal,radius)),t=mul(edge.d,1/edge.length),distance=-dot(base,edge.normal),square=orbit*orbit-distance*distance;
   if(square<0)continue;const middle=-dot(base,t),half=Math.sqrt(square);
   for(const along of [middle-half,middle+half])if(along>=-1e-10&&along<=edge.length+1e-10)addCandidate(pin,add(base,mul(t,along)),edge.normal,edge.index);
  }
  for(let i=0;i<points.length;i++){
   const previous=profile.edges[(i+points.length-1)%points.length],next=profile.edges[i];if(cross(previous.d,next.d)<=0)continue;
   const Q=points[i],d=Math.hypot(...Q);if(d>orbit+radius||d<Math.abs(orbit-radius)||d===0)continue;
   const along=(orbit*orbit-radius*radius+d*d)/(2*d),square=orbit*orbit-along*along;if(square<0)continue;
   const unit=mul(Q,1/d),middle=mul(unit,along),height=Math.sqrt(square);
   for(const sign of [-1,1]){
    const center=add(middle,mul([-unit[1],unit[0]],sign*height)),normal=mul(sub(center,Q),1/radius);
    if(dot(normal,previous.d)<-1e-10||dot(normal,next.d)>1e-10)continue;addCandidate(pin,center,normal,i);
   }
  }
 }
 candidates.sort((a,b)=>a.angle-b.angle);
 for(const result of candidates){
  const contacts=[],gaps=pins.map((world,index)=>{
   const center=rotate(sub(world,pivot),-result.angle),near=profile.closest(center),gap=near.signedDistance-radius;
   if(Math.abs(gap)<1e-7)for(const f of profile.features(center).filter(f=>Math.abs(f.distance-radius)<1e-7))contacts.push({pin:index,feature:f.index,point:add(pivot,rotate(f.point,result.angle)),normal:rotate(f.normal,result.angle)});
   return gap;
  });
  if(Math.min(...gaps)<-1e-7)continue;
  return{...result,contacts,gaps,minimumGap:Math.min(...gaps)};
 }
 throw new Error('Gravity closure missed every peg');
}
