import * as THREE from 'three';
import {makePumpCatchCompleteGeometry} from './pump-catch-complete-geometry.js';
import {pumpCatchRopeCenterline} from './pump-catch-rope-mesh.js';

export function makePumpCatchLiveRope({radius=.0625,sides=24,capacity=1700}={}){
  const stride=sides+1,maximumVertices=capacity*stride+2*(sides+1),geometry=new THREE.BufferGeometry(),
    positions=new Float32Array(maximumVertices*3),normals=new Float32Array(maximumVertices*3),uvs=new Float32Array(maximumVertices*2),
    indices=new Uint16Array((capacity-1)*sides*6+2*sides*3),angles=Array.from({length:stride},(_,i)=>{
      const a=(i%sides)*2*Math.PI/sides;return[Math.cos(a),Math.sin(a)];
    });
  if(maximumVertices>=65536)throw Error('Live rope exceeds its index capacity');
  for(const[name,array,size]of [['position',positions,3],['normal',normals,3],['uv',uvs,2]])geometry.setAttribute(name,new THREE.BufferAttribute(array,size).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(indices,1).setUsage(THREE.DynamicDrawUsage));
  // Complete admitted domain: |theta| < pi, 0 <= pumpHeight < 3, A < 1.
  geometry.boundingBox=new THREE.Box3(new THREE.Vector3(-2,-5,-1),new THREE.Vector3(2,2,1));
  geometry.boundingSphere=geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  let previousCount=0;
  const update=centerline=>{
    const{points,tangents}=centerline,count=points.length;if(count>capacity)throw Error('Live rope section capacity exceeded');
    let distance=0;
    for(let i=0;i<count;i++){
      const P=points[i],T=tangents[i],h=Math.hypot(T[0],T[1]),ux=T[1]/h,uy=-T[0]/h,
        vx=-T[2]*uy,vy=T[2]*ux,vz=T[0]*uy-T[1]*ux;
      if(i)distance+=Math.hypot(...P.map((v,k)=>v-points[i-1][k]));
      for(let j=0;j<stride;j++){
        const[c,s]=angles[j],nx=ux*c+vx*s,ny=uy*c+vy*s,nz=vz*s,p=3*(i*stride+j),v=2*(i*stride+j);
        positions[p]=P[0]+radius*nx;positions[p+1]=P[1]+radius*ny;positions[p+2]=P[2]+radius*nz;
        normals[p]=nx;normals[p+1]=ny;normals[p+2]=nz;uvs[v]=distance/centerline.length;uvs[v+1]=j/sides;
      }
    }
    let vertices=count*stride;
    for(const i of [0,count-1]){
      const sign=i===0?-1:1,T=tangents[i];
      for(let j=0;j<=sides;j++){
        const p=3*vertices++,source=3*(i*stride+j);
        for(let k=0;k<3;k++){positions[p+k]=j<sides?positions[source+k]:points[i][k];normals[p+k]=sign*T[k];}
        uvs[2*(vertices-1)]=0;uvs[2*(vertices-1)+1]=0;
      }
    }
    const indexCount=(count-1)*sides*6+2*sides*3;
    if(count!==previousCount){
      let cursor=0;
      for(let i=0;i<count-1;i++)for(let j=0;j<sides;j++){
        const x=i*stride+j,y=x+1;indices[cursor++]=x;indices[cursor++]=y;indices[cursor++]=x+stride;
        indices[cursor++]=y;indices[cursor++]=y+stride;indices[cursor++]=x+stride;
      }
      for(let end=0;end<2;end++){
        const start=count*stride+end*(sides+1),center=start+sides;
        for(let j=0;j<sides;j++){const a=start+j,b=start+(j+1)%sides;indices[cursor++]=center;indices[cursor++]=end?a:b;indices[cursor++]=end?b:a;}
      }
      geometry.index.count=indexCount;geometry.index.clearUpdateRanges();geometry.index.addUpdateRange(0,indexCount);geometry.index.needsUpdate=true;
      geometry.setDrawRange(0,indexCount);previousCount=count;
    }
    for(const attribute of Object.values(geometry.attributes)){
      attribute.count=vertices;attribute.clearUpdateRanges();attribute.addUpdateRange(0,vertices*attribute.itemSize);attribute.needsUpdate=true;
    }
    return geometry;
  };
  return{geometry,update};
}

export function makePumpCatchGeometry(){
  const model=makePumpCatchCompleteGeometry(),u=model.root.userData,{radius,ropeRadius,ropeLength,z}=u.completeHardware,
    live=makePumpCatchLiveRope({radius:ropeRadius});u.parts.pumpRope.geometry.dispose();u.parts.pumpRope.geometry=live.geometry;
  const setState=({pumpHeight=0,...state}={})=>{
    if(!Number.isFinite(pumpHeight))throw Error('Nonfinite pump height');
    const result=model.setRigidState(state);u.blocks.pump.position.set(-radius,pumpHeight-ropeLength,z);
    const centerline=pumpCatchRopeCenterline([result.wheelAngle,result.catchAngle+result.wheelAngle,pumpHeight],{radius,ropeLength,z});
    live.update(centerline);u.ropeCenterline=centerline;model.root.updateMatrixWorld(true);return u.state={...result,pumpHeight};
  };
  model.setState=setState;u.setState=setState;setState();return model;
}
