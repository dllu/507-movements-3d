import * as THREE from 'three';

/** Arc-length samples of the upper wrap, including its two tangent spans. */
export function bellCrankCordPath(start,end,center,radius,segments){
 const angle=(p,sign)=>{
  const d=p.map((v,i)=>v-center[i]),length=Math.hypot(d[0],d[1]);
  if(length<=radius)throw new RangeError('126 cord end is inside its pulley');
  return Math.atan2(d[1],d[0])+sign*Math.acos(radius/length);
 };
 let left=angle(start,-1),right=angle(end,1);
 while(left<right)left+=2*Math.PI;
 if(left-right>Math.PI*1.5)throw new RangeError('126 selected the wrong pulley wrap');
 const at=a=>[center[0]+radius*Math.cos(a),center[1]+radius*Math.sin(a),center[2]];
 const a=at(left),b=at(right),distance=(p,q)=>Math.hypot(...p.map((v,i)=>v-q[i]));
 const lengths=[distance(start,a),(left-right)*radius,distance(b,end)],length=lengths.reduce((s,v)=>s+v,0);
 const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
 const points=Array.from({length:segments+1},(_,i)=>{
  const s=i*length/segments;
  if(s<lengths[0])return mix(start,a,s/lengths[0]);
  if(s<lengths[0]+lengths[1])return at(left-(s-lengths[0])/radius);
  return mix(b,end,(s-lengths[0]-lengths[1])/lengths[2]);
 });
 const direction=new THREE.Vector3(...start).sub(new THREE.Vector3(...a)).normalize().toArray();
 return{points,length,lengths,left,right,direction};
}
