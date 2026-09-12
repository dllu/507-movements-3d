import {nativePlateContours,pointInsidePolygon,rotatingContourEvents,rotate2,dot2,subtract2,cross2} from './weighted-clutch-native-contours.mjs';

export function makeWeightedClutchNativeKey(model){
 const u=model.root.userData,waist=Math.fround(u.geometry.waist),holes={};
 for(const side of ['left','right']){
  const p=u.parts[side+'SlidingJaw'].geometry.attributes.position,points=new Map();
  // The common waist ring is an unmodulated native cross-section. Its keyed
  // bore lies inside radius .175; the groove root outside it is at .185.
  for(let i=0;i<p.count;i++)if(p.getZ(i)===waist&&Math.hypot(p.getX(i),p.getY(i))<.175){
   const xy=[p.getX(i),p.getY(i)];points.set(xy.join(','),xy);
  }
  holes[side]=[...points.values()].sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));
  if(holes[side].length<700)throw Error('Missing native keyed-bore section');
 }
 const key=nativePlateContours(u.parts.shaftFeather.geometry)[0],events=rotatingContourEvents(holes.left,key),
  lower=events.filter(e=>e.angle<0).at(-1),upper=events.find(e=>e.angle>0);
 if(!key.every(p=>pointInsidePolygon(p,holes.left))||!key.every(p=>pointInsidePolygon(p,holes.right)))throw Error('Key reference is not inside its bore');
 if(lower.kind!=='pin-vertex-wall-edge'||upper.kind!=='pin-vertex-wall-edge'||lower.gapDerivative<=0||upper.gapDerivative>=0)throw Error('Unexpected first native key contact');
 function query(q){
  const gamma=q[3]-q[4];
  if(Math.abs(gamma)>.05)throw Error('Key contact left its locally qualified range');
  return [lower,upper].map((e,i)=>{
   const p=rotate2(key[e.vertex],gamma),a=holes.left[e.edge],n=e.normal,derivative=cross2(p,n);
   return {kind:i===0?'key-lower':'key-upper',gap:dot2(n,subtract2(p,a)),gradient:[0,0,0,derivative,-derivative],
    inputGradient:0,target:0,normal:n,point:p,vertex:e.vertex,edge:e.edge,gamma,
    tangent:[0,0,1,0,0],friction:'axial-key'};
  });
 }
 return {query,parameters:{waist,holes,key,events,lower,upper,
  qualification:'Native Float32 bore ring and feather polygon. Actual vertex/wall gaps have unit transverse normals, so their reactions are forces and axial Coulomb limits have consistent units. Gamma is shaft angle minus D angle. Axial overlap and full-solid witnesses require separate checks.'}};
}
