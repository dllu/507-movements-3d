import * as THREE from 'three';

export function weightedCordGeometry(g,leverAngle){
 const angle=-leverAngle+g.leverIncludedAngle,s=g.sourceScale;
 const leverAttachment={x:g.sourceLeverPivot.x+g.outputArmLength*Math.cos(angle)/s,y:g.sourceLeverPivot.y+g.outputArmLength*Math.sin(angle)/s};
 const dx=leverAttachment.x-g.sourcePulleyCenter.x,dy=leverAttachment.y-g.sourcePulleyCenter.y,d2=dx*dx+dy*dy,r=g.pulleyPitchRadius/s;
 const incomingLength=Math.sqrt(d2-r*r),scale=r*r/d2,perpendicular=r*incomingLength/d2;
 const incomingTangent={x:g.sourcePulleyCenter.x+dx*scale-dy*perpendicular,y:g.sourcePulleyCenter.y+dy*scale+dx*perpendicular};
 const incomingTangentAngle=(Math.atan2(incomingTangent.y-g.sourcePulleyCenter.y,incomingTangent.x-g.sourcePulleyCenter.x)+2*Math.PI)%(2*Math.PI);
 return {leverAttachment,incomingTangent,incomingTangentAngle,incomingLength,wrapLength:r*(2*Math.PI-incomingTangentAngle)};
}

/** Fixed-topology planar rope tube: no geometry allocation/disposal during playback. */
export function updateWeightedCord(mesh,g,weightY,cordState){
 const segments=128,sides=10,count=(segments+1)*(sides+1);
 if(mesh.geometry.attributes.position?.count!==count){
  mesh.geometry.dispose();mesh.geometry=new THREE.BufferGeometry();
  mesh.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));
  mesh.geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(count*3),3));
  const indices=[];
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  for(let j=1;j<sides-1;j++){indices.push(0,j,j+1);const end=segments*(sides+1);indices.push(end,end+j+1,end+j);}
  mesh.geometry.setIndex(indices);
 }
 const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,s=g.sourceScale,c=cordState;
 const ax=(c.leverAttachment.x-g.sourceDiskCenter.x)*s,ay=(g.sourceDiskCenter.y-c.leverAttachment.y)*s;
 const tx=(c.incomingTangent.x-g.sourceDiskCenter.x)*s,ty=(g.sourceDiskCenter.y-c.incomingTangent.y)*s;
 const straight=c.incomingLength*s,arc=c.wrapLength*s,vertical=g.pulleyCenter.y-weightY-.56,total=straight+arc+vertical;
 for(let i=0;i<=segments;i++){
  const distance=total*i/segments;let x,y,dx,dy;
  if(distance<=straight){const t=distance/straight;x=ax+(tx-ax)*t;y=ay+(ty-ay)*t;dx=(tx-ax)/straight;dy=(ty-ay)/straight;}
  else if(distance<straight+arc){const a=c.incomingTangentAngle+(distance-straight)/g.pulleyPitchRadius;x=g.pulleyCenter.x+g.pulleyPitchRadius*Math.cos(a);y=g.pulleyCenter.y-g.pulleyPitchRadius*Math.sin(a);dx=-Math.sin(a);dy=-Math.cos(a);}
  else{x=g.pulleyCenter.x+g.pulleyPitchRadius;y=g.pulleyCenter.y-(distance-straight-arc);dx=0;dy=-1;}
  for(let j=0;j<=sides;j++){const a=2*Math.PI*j/sides,nx=dy*Math.cos(a),ny=-dx*Math.cos(a),nz=Math.sin(a),index=i*(sides+1)+j;p.setXYZ(index,x+g.cordRadius*nx,y+g.cordRadius*ny,g.cordPlaneZ+g.cordRadius*nz);n.setXYZ(index,nx,ny,nz);}
 }
 p.needsUpdate=true;n.needsUpdate=true;mesh.geometry.computeBoundingSphere();
}

export function syncWeightedBellCrank(model,state){
 const u=model.root.userData,b=u.blocks,g=u.geometry,[disk,lever,lift]=state.qpos;
 b.diskRotor.rotation.z=disk;b.lever.rotation.z=lever;
 b.weight.position.y=(g.sourceDiskCenter.y-g.sourceWeightCenter.y)*g.sourceScale+lift;
 b.pulleyRotor.rotation.z=lift/g.pulleyPitchRadius;
 updateWeightedCord(b.cord,g,b.weight.position.y,weightedCordGeometry(g,lever));
 b.contactMarker.visible=false;u.physicsState=state;model.root.updateMatrixWorld(true);
}
