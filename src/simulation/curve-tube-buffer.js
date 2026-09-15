import * as THREE from 'three';

// Reusable open tube for curves whose tangent has a nonzero XY projection.
// A projected XY normal avoids Frenet-frame flips at straight/curved joins.
// End caps are intentionally absent for ends embedded in fastening heads.
export function makeCurveTubeBuffer({segments=384,sides=8,radius=.048}={}){
 if(!Number.isInteger(segments)||segments<2||!Number.isInteger(sides)||sides<3||!Number.isFinite(radius)||radius<=0)throw new RangeError('Invalid tube dimensions');
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array((segments+1)*sides*3),normals=new Float32Array(positions.length),indices=[];
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
 const point=new THREE.Vector3(),tangent=new THREE.Vector3(),cos=Array.from({length:sides},(_,j)=>Math.cos(2*Math.PI*j/sides)),sin=cos.map((_,j)=>Math.sin(2*Math.PI*j/sides));
 const update=curve=>{
  for(let i=0;i<=segments;i++){
   curve.getPointAt(i/segments,point);curve.getTangentAt(i/segments,tangent).normalize();const h=Math.hypot(tangent.x,tangent.y);
   if(!(h>1e-10)||!point.toArray().every(Number.isFinite))throw new RangeError('Tube curve needs finite points and nonvertical tangents');
   const nx=-tangent.y/h,ny=tangent.x/h,bx=-tangent.z*tangent.x/h,by=-tangent.z*tangent.y/h,bz=h;
   for(let j=0;j<sides;j++){const k=(i*sides+j)*3;normals[k]=cos[j]*nx+sin[j]*bx;normals[k+1]=cos[j]*ny+sin[j]*by;normals[k+2]=sin[j]*bz;positions[k]=point.x+radius*normals[k];positions[k+1]=point.y+radius*normals[k+1];positions[k+2]=point.z+radius*normals[k+2];}
  }
  geometry.attributes.position.needsUpdate=geometry.attributes.normal.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
 };
 return{geometry,update};
}
