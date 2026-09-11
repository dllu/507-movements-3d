import {familyMass} from '../../src/simulation/finite-plate-geometry.js';
import {advanceAlternatingPegStep} from './alternating-peg-dynamics-study.mjs';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),
 dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],
 rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];

// The bar is the only prescribed coordinate. The wheel and both pawls have
// inertia and unilateral contact; no framewise resting-pose selection occurs.
export function makeReciprocatingPawlDynamics(model,{period=4,overtravel=.09,load=3,damping=[16,.01,.004],coulomb=0}={}){
 const u=model.root.userData,p=u.geometry,density=1/u.mass.B.volume,
  mass=['wheel','movingPawl','holdingPawl'].map(key=>{const m=familyMass(u.parts,u.families,key);return{m:m.volume*density,I:m.polar*density,c:m.centroid.slice(0,2)};}),
  inertia=mass.map(m=>m.I),omega=2*Math.PI/period,
  high=p.startWheelOffset+overtravel,low=p.endWheelOffset-overtravel,mid=(high+low)/2,amplitude=(high-low)/2,
  sourcePhase=Math.acos(-mid/amplitude)/(2*Math.PI),
  vectors=[rotate(p.VB,p.sourceBarAngle),rotate(p.VH,p.sourceHAngle)],
  edges=u.profile.points.map((a,i,pts)=>{const b=pts[(i+1)%pts.length],d=sub(b,a);return{a,b,d,square:dot(d,d),index:i};});
 const input=time=>{
  const arg=omega*time+2*Math.PI*sourcePhase,q=mid+amplitude*Math.cos(arg),v=-amplitude*omega*Math.sin(arg),acceleration=-amplitude*omega*omega*Math.cos(arg),
   pivot=rotate([-p.barRadius,0],p.sourceBarAngle+q),velocity=[-pivot[1]*v,pivot[0]*v],
   pivotAcceleration=[-pivot[1]*acceleration-pivot[0]*v*v,pivot[0]*acceleration-pivot[1]*v*v];
  return{q,v,acceleration,pivot,velocity,pivotAcceleration};
 };
 const forces=(x,time)=>{
  const k=input(time);return[load,...[0,1].map(i=>{const m=mass[i+1],r=rotate(m.c,x[i+1]);
   return-m.m*(9.81*r[0]+(i===0?cross(r,k.pivotAcceleration):0));})];
 };
 const constraints=(x,time,padding=.002)=>{
  const k=input(time),rows=[],gaps={};
  for(const [i,key] of ['B','H'].entries()){
   const pivot=i===0?k.pivot:p.PH,center=add(pivot,rotate(vectors[i],x[i+1])),local=rotate(center,-x[0]);
   let inside=false,best=Infinity;const features=[];
   for(const e of edges){
    if((e.a[1]>local[1])!==(e.b[1]>local[1])&&local[0]<(e.b[0]-e.a[0])*(local[1]-e.a[1])/(e.b[1]-e.a[1])+e.a[0])inside=!inside;
    const t=Math.max(0,Math.min(1,dot(sub(local,e.a),e.d)/e.square)),point=add(e.a,e.d.map(v=>v*t)),delta=sub(local,point),distance=Math.hypot(...delta);
    best=Math.min(best,distance);if(distance>p.noseRadius+padding)continue;
    const normal=delta.map(v=>v/distance);
    if(features.some(f=>dot(f.normal,normal)>1-1e-10&&Math.hypot(...sub(f.point,point))<1e-9))continue;
    features.push({point,normal,distance,index:e.index});
   }
   gaps[key]=(inside?-best:best)-p.noseRadius;
   for(const f of features){
    const normal=rotate(f.normal.map(v=>inside?-v:v),x[0]),point=rotate(f.point,x[0]),J=[-cross(center,normal),0,0];J[i+1]=cross(sub(center,pivot),normal);
    rows.push({id:key+':'+f.index,key,point,normal,J,gap:(inside?-f.distance:f.distance)-p.noseRadius,
     inputNormalVelocity:i===0?dot(normal,k.velocity):0});
   }
  }
  return{rows,gaps};
 };
 return{parameters:{period,overtravel,load,damping,coulomb,mass,inertia,sourcePhase,mid,amplitude},input,forces,constraints,
  initial:{time:0,x:[p.sourceWheelAngle,0,0],v:[0,0,0],active:[]}};
}
export const advanceReciprocatingPawlStep=advanceAlternatingPegStep;
