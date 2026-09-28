import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {windlassSheaveGeometry} from '../src/simulation/windlass-hardware.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/movements.json',import.meta.url)));
test('129 solid sheave has flat face normals, an axle bore and space for the full rope section',()=>{
 const ropeRadius=.064,g=windlassSheaveGeometry(1.1,ropeRadius),p=g.getAttribute('position'),n=g.getAttribute('normal');
 try{
  for(let i=0;i<p.count;i++){
   const radius=Math.hypot(p.getX(i),p.getY(i));assert(radius>.1049);
   assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);
  }
  const index=g.getIndex();let flatFaceTriangles=0;
  for(let i=0;i<index.count;i+=3){
   const face=[0,1,2].map(k=>index.getX(i+k)),z=p.getZ(face[0]);
   if(Math.abs(Math.abs(z)-.23)<1e-6&&face.every(k=>Math.abs(p.getZ(k)-z)<1e-7)){
    flatFaceTriangles++;for(const k of face)assert(Math.abs(n.getZ(k)-Math.sign(z))<1e-6);
   }
  }
  assert(flatFaceTriangles>=256);
  const profile=g.userData.profile;
  for(let i=0;i<=100;i++){
   const z=-ropeRadius+2*ropeRadius*i/100,ropeInside=1.1-Math.sqrt(Math.max(0,ropeRadius**2-z*z));
   const j=profile.findIndex((a,j)=>j&&profile[j-1][1]<=z&&a[1]>=z),a=profile[j-1],b=profile[j];
   assert(j>0);const wall=a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);
   assert(ropeInside>=wall-1e-12,'finite rope section clears the actual groove wall');
  }
 }finally{g.dispose();}
});

test('129 winding anchors rotate rigidly with the shaft and adjacent coils remain separate',()=>{
 const v=createMovementModel(catalog.movements[128]),u=v.root.userData,d=u.geometry,X=new THREE.Vector3(1,0,0);
 const initial=u.ropeGeometryAtShaftAngle(0),anchor=(h,t,a)=>h.getPoint(t).sub(new THREE.Vector3(0,d.shaftY,0)).applyAxisAngle(X,-a);
 let minimum=Infinity;
 try{
  assert.equal(u.blocks.lowerPulleyRotor.children.filter(o=>o.visible).length,1);
  v.root.updateMatrixWorld(true);
  const axialRange=mesh=>{
   const p=mesh.geometry.getAttribute('position'),values=[];
   for(let i=0;i<p.count;i++)values.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).dot(d.lowerPulleyAxis));
   return [Math.min(...values),Math.max(...values)];
  };
  const sheaveFront=axialRange(u.blocks.lowerPulleyContactTread)[1];
  // Pass 96: a symmetric two-cheek clevis: cheeks clear both sheave faces, the
  // bridge passes under the rim, and the axle runs through both cheeks.
  const [sheaveBack]=axialRange(u.blocks.lowerPulleyContactTread),[clevisBack,clevisFront]=axialRange(u.blocks.loadHanger),hanger=u.blocks.loadHanger.userData;
  const centre=(sheaveBack+sheaveFront)/2,halfWidth=(sheaveFront-sheaveBack)/2;
  assert(Math.abs((clevisBack+clevisFront)/2-centre)<1e-6,'clevis is symmetric about the sheave plane');
  assert(Math.abs(clevisFront-centre-hanger.cheekOuter)<1e-6&&hanger.cheekInner-halfWidth>.02,'cheeks clear both sheave faces');
  const rim=Math.max(...u.blocks.lowerPulleyContactTread.geometry.userData.profile.map(p=>p[0]));
  assert(-hanger.bridgeTop>rim+.03,'bridge passes under the sheave rim');
  let axleMesh;u.blocks.lowerAxle.traverse(o=>{if(o.isMesh)axleMesh=o;});const [axleBack,axleFront]=axialRange(axleMesh);
  assert(axleFront-centre>hanger.cheekOuter&&axleBack-centre<-hanger.cheekOuter,'axle passes through both cheeks');
  assert.equal(u.blocks.loadHangerOutline.visible,false);
  assert.notEqual(u.blocks.loadHanger.material.color.getHex(),u.blocks.lowerPulleyContactTread.material.color.getHex(),'block contrasts with the sheave');
  for(let i=0;i<=60;i++){
   const a=-d.shaftAngleAmplitude+2*d.shaftAngleAmplitude*i/60,s=u.ropeGeometryAtShaftAngle(a);
   for(const [name,end]of [['largeHelix',0],['smallHelix',1]]){
    const h=s[name];assert(anchor(h,end,a).distanceTo(anchor(initial[name],end,0))<1e-12);
    const points=Array.from({length:601},(_,j)=>h.getPoint(j/600));
    for(let j=0;j<points.length;j++)for(let k=j+Math.ceil(600*Math.PI/h.wrapSweep);k<points.length;k++)minimum=Math.min(minimum,points[j].distanceTo(points[k]));
   }
  }
  assert(minimum>2*d.ropeRadius,`nonlocal winding distance ${minimum}`);
  const n=6.6,t=1/n,oldSeparation=.105*n*(3*t*t-2*t*t*t);
  assert(oldSeparation<2*d.ropeRadius,'former globally eased winding must overlap');
 }finally{disposeObject3D(v.root);}
});

test('129 source-proportioned posts join both bearings and the rear base through their feet',()=>{
 const v=createMovementModel(catalog.movements[128]),u=v.root.userData,d=u.geometry,b=u.blocks;
 try{
  v.root.updateMatrixWorld(true);
  assert.equal(d.sourceRasterLargeBarrelRadius,50);assert.equal(d.sourceRasterSmallBarrelRadius,31);
  assert(Math.abs(b.barrelFlanges[0].geometry.parameters.radiusTop/d.sourceScale-68)<1);
  assert(Math.abs(b.barrelFlanges[2].geometry.parameters.radiusTop/d.sourceScale-46)<1);
  assert(Math.abs((d.shaftY-d.baseY)/d.sourceScale-315)<1e-10);
  for(let i=0;i<2;i++){
   const post=b.bearingPosts[i],sleeve=b.bearingSleeves[i],foot=b.footBlocks[i];
   assert.equal(post.geometry.parameters.shapes.holes.length,1);
   assert.equal(post.position.x,sleeve.position.x);assert.equal(post.position.z,sleeve.position.z);
   const shaftBounds=new THREE.Box3().setFromObject(b.inputShaft),bearingBounds=new THREE.Box3().setFromObject(sleeve);
   assert(shaftBounds.min.x<bearingBounds.min.x&&shaftBounds.max.x>bearingBounds.max.x);
   assert(d.shaftRadius<d.bearingInnerRadius-.008,'axle clears the bevelled sleeve bore');
   // This point is inside the post and bearing ring, proving a solid connection.
   assert(.2>d.bearingInnerRadius&&.2<d.bearingOuterRadius);
   for(const part of [post,b.baseRail]){
    const intersection=new THREE.Box3().setFromObject(foot).intersect(new THREE.Box3().setFromObject(part));
    const size=intersection.getSize(new THREE.Vector3());assert(size.x*size.y*size.z>0);
   }
  }
  assert.equal(b.crankArm.visible,false);assert.equal(b.crankHandle.visible,false);
 }finally{disposeObject3D(v.root);}
});
