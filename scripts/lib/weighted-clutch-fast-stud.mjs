import {makeWeightedClutchNativeStud} from './weighted-clutch-native-stud.mjs';

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>a[0]*b[1]-a[1]*b[0],
 rotatePolygon=(p,q,offset)=>{const c=Math.cos(q),s=Math.sin(q);return p.map(v=>[c*v[0]-s*v[1]+offset[0],s*v[0]+c*v[1]+offset[1]]);};
const axes=p=>p.map((a,i)=>{const b=p[(i+1)%p.length],x=b[0]-a[0],y=b[1]-a[1],l=Math.hypot(x,y);return[-y/l,x/l];});
const extrema=(p,n)=>{
 let low=0,high=0;for(let i=1;i<p.length;i++){if(dot(p[i],n)<dot(p[low],n))low=i;if(dot(p[i],n)>dot(p[high],n))high=i;}
 return{low,high};
};
function advance(p,n,at){
 for(const[key,sign]of [['low',-1],['high',1]])for(let j=0;j<p.length;j++){
  const next=(at[key]+1)%p.length;
  if(sign*dot(p[next],n)>sign*dot(p[at[key]],n))at[key]=next;else break;
 }
 return[dot(p[at.low],n),dot(p[at.high],n)];
}

// Rotating calipers preserve the same separating axes as the slower native
// polygon checker. Both convex contours are CCW, so support indices advance
// monotonically as each edge-normal list turns through one revolution.
export function makeWeightedClutchFastStud(model){
 const slow=makeWeightedClutchNativeStud(model),p=slow.parameters,L=model.root.userData.linkage.parameters,
  stud=p.stud.map(v=>v.map((x,i)=>x+p.offset[i]));
 const evaluate=(q,e)=>{
  const k=model.root.userData.linkage.atAngle(q),a=rotatePolygon(p.patch,k.bellAngle,p.G),b=rotatePolygon(stud,e,p.E);
  let gap=-Infinity,normal,owner;
  for(const [axisOwner,list] of [['G',axes(a)],['stud',axes(b)]]){
   const ai=extrema(a,list[0]),bi=extrema(b,list[0]);
   for(const n of list){
    const[al,ah]=advance(a,n,ai),[bl,bh]=advance(b,n,bi);
    if(bl-ah>gap){gap=bl-ah;normal=n;owner=axisOwner;}
    if(al-bh>gap){gap=al-bh;normal=n.map(v=>-v);owner=axisOwner;}
   }
  }
  const ai=extrema(a,normal),bi=extrema(b,normal),ah=dot(a[ai.high],normal),bl=dot(b[bi.low],normal),
   supportA=a.filter(v=>ah-dot(v,normal)<1e-9),supportB=b.filter(v=>dot(v,normal)-bl<1e-9),
   // Away from contact, the winning normal can come from the far side of a
   // polygon. Its near support is then a vertex, so support size alone cannot
   // identify which body rotates the normal.
   edgeG=owner==='G',vertex=edgeG?supportB[0]:supportA[0],
   rG=sub(vertex,p.G),rE=sub(vertex,p.E),rod=sub(k.B,k.A),
   beta1=cross(sub(k.A,L.F),rod)/cross(sub(k.B,L.G),rod),
   gradientLever=-cross(rG,normal)*beta1,gradientWheel=cross(rE,normal);
  return{gap,normal,gradientLever,gradientWheel,edge:edgeG?'G':'stud',supportA,supportB,
   ambiguous:supportA.length===2&&supportB.length===2};
 };
 return{evaluate,parameters:p,slow};
}
