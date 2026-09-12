import * as THREE from 'three';
import {pumpCatchRope} from './pump-catch-rope.js';

// A massless slack rope has no unique equilibrium shape. This explicit smooth
// bow retains the analytic rope length, keeps both terminations attached and
// moves the slack forward, clear of the overhead post and rear drive band.
// It is a rendering completion, not a finite-mass catenary solution.
const integral=(f,n=256)=>{
  let sum=f(0)+f(1);
  for(let i=1;i<n;i++)sum+=(i%2?4:2)*f(i/n);
  return sum/(3*n);
};
export function pumpCatchRopeCenterline(q,{radius,ropeLength=4.75,z=-.49,arcStep=.003}={}){
  const rope=pumpCatchRope(q,{radius,ropeLength}),p=rope.path;
  if(rope.gap < -1e-7)throw Error('Cannot draw an overstretched pump rope');
  if(p.winding<0||q[0]<-Math.PI)throw Error('Rope mesh requires the qualified left-wrap motion range');
  const wrapped=p.arcAngle>1e-7,A=wrapped?p.tangent:p.anchor,
    tangent=wrapped?[0,-1]:[Math.sin(q[0]),-Math.cos(q[0])],B=[-radius,A[1]-.25],
    C=[A[0]+tangent[0]/12,A[1]+tangent[1]/12],D=[B[0],B[1]+1/12],
    lead=t=>{const s=1-t;return [0,1].map(k=>s*s*s*A[k]+3*s*s*t*C[k]+3*s*t*t*D[k]+t*t*t*B[k]);},
    leadDerivative=t=>{const s=1-t;return [0,1].map(k=>3*s*s*(C[k]-A[k])+6*s*t*(D[k]-C[k])+3*t*t*(B[k]-D[k]));},
    leadLength=integral(t=>Math.hypot(...leadDerivative(t))),
    cut=-.85,endCut=p.pump[1]+.20,bowSpan=cut-endCut,
    verticalLength=B[1]-p.pump[1],arcLength=wrapped?radius*p.arcAngle:0;
  if(bowSpan<=0||B[1]<cut||verticalLength<=0)throw Error('Pump rope is outside the reconstructed guide range');
  const freeLength=amplitude=>verticalLength-bowSpan+bowSpan*integral(t=>Math.hypot(1,amplitude*Math.PI*Math.sin(2*Math.PI*t)/bowSpan)),
    target=ropeLength-arcLength-leadLength;
  if(target<verticalLength-1e-7)throw Error('The rope clamp lead-in exceeds the available length');
  let low=0,high=.25;
  while(freeLength(high)<target){high*=2;if(high>4)throw Error('Excessive slack bow');}
  for(let i=0;i<42;i++){const mid=(low+high)/2;if(freeLength(mid)>target)high=mid;else low=mid;}
  const amplitude=target-verticalLength<1e-12?0:(low+high)/2,points=[],tangents=[],append=(point,t)=>{points.push(point);tangents.push(new THREE.Vector3(...t).normalize().toArray());};
  if(wrapped){
    const count=Math.ceil(p.arcAngle/arcStep);
    for(let i=0;i<count;i++){const a=p.alpha+p.arcAngle*i/count;append([radius*Math.cos(a),radius*Math.sin(a),z],[-Math.sin(a),Math.cos(a),0]);}
  }
  for(let i=0;i<64;i++){const t=i/64;append([...lead(t),z],[...leadDerivative(t),0]);}
  // Include support boundaries exactly. The final 0.2 units stay vertical
  // through the hollow ferrule on the crosshead.
  append([B[0],B[1],z],[0,-1,0]);
  append([-radius,cut,z],[0,-1,0]);
  for(let i=1;i<=512;i++){const s=i/512;append([-radius,cut-bowSpan*s,z+amplitude*Math.sin(Math.PI*s)**2],
    [0,-bowSpan,amplitude*Math.PI*Math.sin(2*Math.PI*s)]);}
  append([...p.pump,z],[0,-1,0]);
  return {points,tangents,amplitude,arcLength,leadLength,verticalLength,
    length:arcLength+leadLength+freeLength(amplitude),ideal:rope,
    qualification:'Fixed-length massless rope with a smooth forward slack bow and a wheel-fixed clamp tangent. The bow is an explicit display choice; tension and winding use the analytic unilateral rope.'};
}

// Closed swept circular section. Shared side rings and separate flat caps
// retain exactly matching boundary coordinates for independent solid audits.
export function pumpCatchRopeMesh(centerline,{radius=.0625,sides=24}={}){
  const {points,tangents}=centerline,position=[],normal=[],uv=[],index=[],distances=[0],stride=sides+1;
  for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])));
  for(let i=0;i<points.length;i++){
    const T=new THREE.Vector3(...tangents[i]),U=new THREE.Vector3(T.y,-T.x,0).normalize(),V=new THREE.Vector3().crossVectors(T,U),P=new THREE.Vector3(...points[i]);
    for(let j=0;j<=sides;j++){const a=(j%sides)*2*Math.PI/sides,N=U.clone().multiplyScalar(Math.cos(a)).addScaledVector(V,Math.sin(a));
      position.push(...P.clone().addScaledVector(N,radius).toArray());normal.push(...N.toArray());uv.push(distances[i]/centerline.length,j/sides);
      if(i<points.length-1&&j<sides){const x=i*stride+j,y=x+1;index.push(x,y,x+stride,y,y+stride,x+stride);}}
  }
  for(const i of [0,points.length-1]){
    const start=position.length/3,sign=i===0?-1:1,N=tangents[i].map(v=>sign*v);
    for(let j=0;j<sides;j++){position.push(...position.slice(3*(i*stride+j),3*(i*stride+j+1)));normal.push(...N);uv.push(0,0);}
    const center=position.length/3;position.push(...points[i]);normal.push(...N);uv.push(0,0);
    for(let j=0;j<sides;j++){const a=start+j,b=start+(j+1)%sides;index.push(...(sign<0?[center,b,a]:[center,a,b]));}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(index);
  return geometry;
}
