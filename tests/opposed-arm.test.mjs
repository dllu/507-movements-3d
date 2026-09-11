import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeOpposedArmDrive} from '../src/simulation/opposed-arm.js';
import {sampleOpposedArmMotion} from '../src/simulation/opposed-arm-motion.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const dispose=model=>model.root.traverse(x=>{x.geometry?.dispose();x.material?.dispose();});

test('079 follows the engraved joints and 33-tooth axial face ratchet',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,p=u.geometry;
 assert.equal(Object.keys(u.parts).length,37);assert.equal(p.teeth,33);assert.equal(u.hideGround,true);assert.equal(u.fidelity,'authored');
 near(p.innerRadius,338.90038109631433/400.22693572590316);
 const source=point=>[(point[0]-406.29814582227056)/400.22693572590316,(777.9249240149841-point[1])/400.22693572590316];
 for(const [key,pixel]of [['upper',[657.1801948051948,524.5487012987013]],['lower',[654.8850364963504,1041.6770072992701]]]){
  const expected=source(pixel);expected.forEach((v,i)=>near(p.arms[key].pivot[i],v));
 }
 source([1232.452865064695,769.3401109057302]).forEach((v,i)=>near(p.sourceSlider[i],v));
 const wheel=u.parts.wheelBody.geometry.userData.faceRatchet;
 assert.ok(wheel.crest>wheel.valley&&wheel.valley>wheel.web&&wheel.web>wheel.back);assert.equal(wheel.teeth,33);
 assert.match(u.idealConstraints,/torsional hinge preload/);dispose(model);
});

test('079 all rendered components have closed oriented triangle surfaces',()=>{
 const model=makeOpposedArmDrive();
 for(const [name,mesh]of Object.entries(model.root.userData.parts)){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,edges=new Map();let volume=0;
  for(let i=0;i<(g.index?.count??p.count);i+=3){
   const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
    normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
   assert.ok(normal.lengthSq()>1e-22,name+': degenerate face');volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
   assert.ok(normal.dot(ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()))>0,name+': inward normal');
   const keys=v.map(p=>p.toArray().join(','));
   for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],id=a<b?a+'/'+b:b+'/'+a,e=edges.get(id)??{count:0,sign:0};e.count++;e.sign+=a<b?1:-1;edges.set(id,e);}
  }
  assert.ok(volume>0,name+': nonpositive volume');for(const e of edges.values()){assert.equal(e.count,2,name+': open edge');assert.equal(e.sign,0,name+': inconsistent winding');}
 }
 dispose(model);
});

test('079 both fixed-length rods close through the entire horizontal stroke',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,p=u.geometry;
 for(let i=0;i<=200;i++){
  model.update(i*.11937);const state=u.kinematics;near(state.slider[1],p.sourceSlider[1]);
  for(const key of ['upper','lower']){
   near(Math.hypot(state.slider[0]-state.arms[key].joint[0],state.slider[1]-state.arms[key].joint[1]),p.arms[key].rodLength,2e-12);
   const end=new THREE.Vector3(p.arms[key].rodLength,0,0).applyMatrix4(u.blocks[key+'Rod'].matrixWorld);
   near(end.x,state.slider[0],2e-12);near(end.y,state.slider[1],2e-12);
  }
 }
 dispose(model);
});

test('079 preserves startup, continuous four-tooth advance and deterministic seeking',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,p=u.geometry;
 near(sampleOpposedArmMotion(0).theta,0);near(-sampleOpposedArmMotion(4).theta/p.pitch,3.6850632702,1e-7);
 for(const time of [4,4.11,5.7,7.99,12.8,133.71]){
  const a=sampleOpposedArmMotion(time),b=sampleOpposedArmMotion(time+4);near(b.theta-a.theta,-4*p.pitch);
  for(const key of ['upperBeta','lowerBeta','sliderX'])near(a[key],b[key]);
  model.update(time);const state={...u.kinematics};model.update(time+17);model.update(time);assert.deepEqual(u.kinematics,state);
 }
 for(let i=0;i<4000;i++)assert.ok(sampleOpposedArmMotion(4+(i+1)/1000).theta<sampleOpposedArmMotion(4+i/1000).theta);
 for(const cycle of [1,2,33,60])for(const key of ['theta','upperBeta','lowerBeta','sliderX'])near(sampleOpposedArmMotion(cycle*4-1e-9)[key],sampleOpposedArmMotion(cycle*4+1e-9)[key],1e-8);
 const normal=sampleOpposedArmMotion(4.57),fast=sampleOpposedArmMotion(2.285,{period:2});
 for(const key of ['theta','upperBeta','lowerBeta','sliderX'])near(normal[key],fast[key]);
 assert.deepEqual(sampleOpposedArmMotion(-1),sampleOpposedArmMotion(0));
 for(const time of [NaN,Infinity,-Infinity])assert.throws(()=>sampleOpposedArmMotion(time));
 for(const period of [0,-1,NaN,Infinity])assert.throws(()=>sampleOpposedArmMotion(1,{period}));
 near(u.minimumDisplayCycleSeconds,4);dispose(model);
});

test('079 radial arms and both rod ends contain real shaft bores',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,p=u.geometry;
 for(const key of ['upper','lower'])for(const [name,center,radius,z]of [
  [key+'RadialArm',[0,0],.115,(p.arms[key].armLow+p.arms[key].armHigh)/2],
  [key+'ConnectingRod',[0,0],.035,(p.arms[key].rodLow+p.arms[key].rodHigh)/2],
  [key+'ConnectingRod',[p.arms[key].rodLength,0],.035,(p.arms[key].rodLow+p.arms[key].rodHigh)/2]]){
  const solid=solidSurface(u.parts[name].geometry);
  for(let i=0;i<8;i++){const a=(i+.27)*Math.PI/4,point=r=>new THREE.Vector3(center[0]+r*Math.cos(a),center[1]+r*Math.sin(a),z);
   assert.equal(solid.inside(point(radius*.7)),false,name+': absent bore');assert.equal(solid.inside(point(radius+.008)),true,name+': absent bearing wall');}
 }
 dispose(model);
});

test('079 each driving pawl bears against actual ratchet tooth material',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,wheel=u.parts.wheelBody,solid=solidSurface(wheel.geometry);
 for(const [time,key]of [[15.988999999985412/2,'upper'],[12.125999999994415/2,'lower']]){
  const pawl=u.parts[key+'Pawl'],points=surfacePoints(pawl.geometry),penetrates=()=>{
   const matrix=wheel.matrixWorld.clone().invert().multiply(pawl.matrixWorld);
   return points.some(v=>{const q=v.clone().applyMatrix4(matrix);return solid.box.containsPoint(q)&&solid.inside(q)&&solid.distance(q)>1e-6;});
  };
  model.update(time);assert.equal(penetrates(),false,key+': nominal overlap');
  u.blocks.wheel.rotation.z+=.001;model.root.updateMatrixWorld(true);assert.equal(penetrates(),true,key+': missing driving contact');
 }
 dispose(model);
});

test('079 independent solid families clear at reversals, contacts and the repaired interpolation',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 for(const time of [0,.4,1,2,3,4,8.135343750003717/2,5,12.125999999994415/2,7,15.988999999985412/2,8,16]){
  model.update(time);const boxes=parts.map(p=>p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld));
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(u.families[parts[i].name]!==u.families[parts[j].name]&&boxes[i].intersectsBox(boxes[j])){
   for(const [a,b]of [[parts[i],parts[j]],[parts[j],parts[i]]]){
    const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    for(const v of a.points){const q=v.clone().applyMatrix4(matrix);if(b.solid.box.containsPoint(q)&&b.solid.inside(q))assert.ok(b.solid.distance(q)<=1e-6,`${time}: ${a.name}/${b.name}`);}
   }
  }
 }
 dispose(model);
});
