import * as THREE from 'three';

// A capped circular wire swept along a helix. End pitch eases to zero so the
// wire touches each flat seat at its outer surface. Axial compression changes
// pitch, not wire thickness. Radius adjusts to retain the quadrature length.
export function makeSpringRackCoil({turns=8,radius,wireRadius,referenceSpan,segments=512,sides=16}){
 const angleSpan=-2*Math.PI*turns,ease=.5/turns;
 const height=t=>{
  if(t<ease){const u=t/ease;return [ease*(u**3-u**4/2)/(1-ease),(3*u*u-2*u**3)/(1-ease)];}
  if(t>1-ease){const u=(1-t)/ease;return [1-ease*(u**3-u**4/2)/(1-ease),(3*u*u-2*u**3)/(1-ease)];}
  return [(t-ease/2)/(1-ease),1/(1-ease)];
 };
 const length=(R,span)=>{
  let total=0;const count=256;for(let i=0;i<=count;i++){const slope=height(i/count)[1],weight=i===0||i===count?1:i%2?4:2;
   total+=weight*Math.hypot(angleSpan*R,span*slope);}
  return total/(3*count);
 },referenceLength=length(radius,referenceSpan);
 let lastSpan,lastRadius;
 const radiusAt=span=>{
  if(span===lastSpan)return lastRadius;
  if(!(span>0&&span<referenceLength))throw Error('Invalid spring span');
  let low=0,high=referenceLength/Math.abs(angleSpan);for(let i=0;i<48;i++){const mid=(low+high)/2;if(length(mid,span)<referenceLength)low=mid;else high=mid;}
  lastSpan=span;lastRadius=(low+high)/2;return lastRadius;
 };
 const geometry=new THREE.BufferGeometry(),ringCount=(segments+1)*sides,vertexCount=ringCount+2*(sides+1),
  positions=new Float32Array(vertexCount*3),normals=new Float32Array(vertexCount*3),
  frames=Array.from({length:segments+1},(_,i)=>{
   const t=i/segments,theta=Math.PI+angleSpan*t,[h,dh]=height(t);return{cos:Math.cos(theta),sin:Math.sin(theta),h,dh};
  }),sections=Array.from({length:sides},(_,i)=>({cos:Math.cos(2*Math.PI*i/sides),sin:Math.sin(2*Math.PI*i/sides)}));
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
 const put=(array,index,x,y,z)=>{array[3*index]=x;array[3*index+1]=y;array[3*index+2]=z;};
 let indexed=false;
 const update=(bottom,top,centerX,centerZ)=>{
  const span=top-bottom-2*wireRadius,R=radiusAt(span);
  for(let i=0;i<=segments;i++){
   const f=frames[i],tx=-R*f.sin*angleSpan,ty=span*f.dh,tz=R*f.cos*angleSpan,
    inverseT=1/Math.sqrt(tx*tx+ty*ty+tz*tz),T=[tx*inverseT,ty*inverseT,tz*inverseT],
    bx=T[1]*f.sin,by=T[2]*f.cos-T[0]*f.sin,bz=-T[1]*f.cos,
    inverseB=1/Math.sqrt(bx*bx+by*by+bz*bz),B=[bx*inverseB,by*inverseB,bz*inverseB],
    C=[centerX+R*f.cos,bottom+wireRadius+span*f.h,centerZ+R*f.sin];
   for(let j=0;j<sides;j++){
    const s=sections[j],nx=f.cos*s.cos+B[0]*s.sin,ny=B[1]*s.sin,nz=f.sin*s.cos+B[2]*s.sin,index=i*sides+j;
    put(normals,index,nx,ny,nz);put(positions,index,C[0]+nx*wireRadius,C[1]+ny*wireRadius,C[2]+nz*wireRadius);
   }
   if(i===0||i===segments){
    const cap=ringCount+(i===0?0:sides+1),sign=i===0?-1:1;
    put(positions,cap,...C);put(normals,cap,...T.map(v=>v*sign));
    for(let j=0;j<sides;j++){
     const source=(i*sides+j)*3;put(positions,cap+1+j,positions[source],positions[source+1],positions[source+2]);
     put(normals,cap+1+j,...T.map(v=>v*sign));
    }
   }
  }
  if(!indexed){
   const indices=[],v=(array,i)=>new THREE.Vector3().fromArray(array,3*i),triangle=(a,b,c)=>{
    const face=v(positions,b).sub(v(positions,a)).cross(v(positions,c).sub(v(positions,a))),normal=v(normals,a).add(v(normals,b)).add(v(normals,c));
    if(face.dot(normal)<0)[b,c]=[c,b];indices.push(a,b,c);
   };
   for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
    const a=i*sides,b=(i+1)*sides,k=(j+1)%sides;triangle(a+j,b+j,b+k);triangle(a+j,b+k,a+k);
   }
   for(const cap of [ringCount,ringCount+sides+1])for(let j=0;j<sides;j++)triangle(cap,cap+1+j,cap+1+(j+1)%sides);
   geometry.setIndex(indices);indexed=true;
  }
  geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.coil={turns,radius:R,wireRadius,bottom,top,span,referenceLength,currentLength:length(R,span),segments,sides};
  return geometry.userData.coil;
 };
 return {geometry,update,radiusAt,referenceLength};
}
