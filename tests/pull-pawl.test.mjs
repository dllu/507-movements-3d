import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makePullPawlDrive} from '../src/simulation/pull-pawl.js';
import {samplePullPawlMotion} from '../src/simulation/pull-pawl-motion.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,a+' != '+b);
const dispose=model=>model.root.traverse(x=>{x.geometry?.dispose();x.material?.dispose();});
const pose=(model,time)=>{model.update(time);return model.root.userData.kinematics;};

test('078 follows the engraved frame, high fulcrum, pawl pivots and 26-tooth wheel',()=>{
 const model=makePullPawlDrive(),u=model.root.userData,p=u.geometry;
 const source=pixel=>[(pixel[0]-590.1847816329412)/379.2944180983833,(748.5887383490219-pixel[1])/379.2944180983833];
 for(const [name,pixel]of [['lever',[598.0604838709677,272.83266129032256]],['left',[431.5703125,259.177734375]],['right',[765.4758364312268,269.70260223048325]]]){
  const expected=source(pixel);near(u.blocks[name].position.x,expected[0]);near(u.blocks[name].position.y,expected[1]);
 }
 assert.equal(p.teeth,26);assert.equal(Object.keys(u.parts).length,25);// p101: +2 pin collarsnear(p.innerRadius,315.5246053439235/379.2944180983833);
 const wheel=u.parts.wheelBody.geometry.parameters.shapes[0];assert.equal(wheel.holes.length,7,'Six spoke openings and one axle bore');
 assert.ok(p.rootAngle<0,'The pulling ratchet needs undercut teeth');
 assert.equal(u.hideGround,true);assert.equal(u.fidelity,'authored');assert.match(u.idealConstraints,/rear relief/);
 dispose(model);
});

test('078 the wheel, rocker and independent pawls have real shaft bores',()=>{
 const model=makePullPawlDrive(),u=model.root.userData,p=u.geometry;
 for(const [name,center,z,r]of [['wheelBody',[0,0],0,.036],['frameA',[0,0],.25,.036],['frameA',p.A,.25,.036],
  ['rockerB',[0,0],.4,.036],['rockerB',p.arms.left,.4,.037],['rockerB',p.arms.right,.4,.037],
  ['leftPawl',[0,0],.13,.037],['rightPawl',[0,0],.13,.037]]){
  const solid=solidSurface(u.parts[name].geometry);
  for(let i=0;i<8;i++){
   const angle=2*Math.PI*(i+.37)/8,point=radius=>new THREE.Vector3(center[0]+radius*Math.cos(angle),center[1]+radius*Math.sin(angle),z);
   assert.equal(solid.inside(point(r*.7)),false,name+': missing bore');
   assert.equal(solid.inside(point(r+.008)),true,name+': missing bearing wall');
  }
 }
 dispose(model);
});

test('078 settles physically, then advances one clockwise tooth per complete rocking cycle',()=>{
 const model=makePullPawlDrive(),u=model.root.userData,p=u.geometry,initial=pose(model,0),first=pose(model,4);
 near(initial.theta,-.0175);near(initial.q,0);
 // p106: the right pawl is 13 source px shorter, so it seats in a root at
 // the start of its stroke; the re-simulated first cycle advances 0.9939.
 near((initial.theta-first.theta)/p.pitch,.99394672377,1e-7);
 // Each pulling stroke carries about half a pitch (was 0.33 / 0.67).
 const rising=(pose(model,5).theta-pose(model,7).theta+pose(model,7).theta-pose(model,9).theta)/p.pitch;
 const falling=(pose(model,5).theta-pose(model,7).theta)/p.pitch,risingOnly=(pose(model,7).theta-pose(model,9).theta)/p.pitch;
 near(falling+risingOnly,rising);near(falling+risingOnly,1,1e-6);
 assert.ok(falling>.45&&falling<.55&&risingOnly>.45&&risingOnly<.55,`strokes ${falling} ${risingOnly}`);
 for(const time of [4,4.1,4.5,5,6,7.8,8,19.2,103.7]){
  const a=pose(model,time),b=pose(model,time+4);near(b.theta-a.theta,-p.pitch);
  for(const key of ['q','leftAngle','rightAngle'])near(b[key],a[key]);
  pose(model,time+37);assert.deepEqual(pose(model,time),a);
 }
 let startupReverse=0,steadyReverse=0,stopped=0,previous=pose(model,0);
 for(let i=1;i<=8000;i++){
  const state=pose(model,i/1000),reverse=Math.max(0,state.theta-previous.theta);
  if(i<=4000)startupReverse+=reverse;
  else{steadyReverse+=reverse;if(Math.abs(state.theta-previous.theta)<1e-10)stopped++;}
  previous=state;
 }
 assert.ok(startupReverse/p.pitch>5e-5&&startupReverse/p.pitch<2e-4,'Retain the tiny initial physical rollback');
 assert.ok(steadyReverse<1e-8);assert.ok(stopped/4000>.37&&stopped/4000<.43);
 assert.ok(pose(model,4.5).theta>pose(model,5).theta,'First pulling stroke advances the wheel');
 assert.ok(pose(model,6.5).theta>pose(model,7).theta,'Second pulling stroke advances the wheel');
 near(u.playbackPeriod,4);near(u.minimumDisplayCycleSeconds,4);dispose(model);
});

test('078 playback seeks deterministically, joins continuously and scales the whole physical path',()=>{
 assert.deepEqual(samplePullPawlMotion(-1),samplePullPawlMotion(0));
 for(const time of [NaN,Infinity,-Infinity])assert.throws(()=>samplePullPawlMotion(time),/clock/);
 for(const period of [0,-1,NaN,Infinity])assert.throws(()=>samplePullPawlMotion(1,{period}),/clock/);
 for(const cycle of [1,2,26,63])for(const key of ['q','theta','leftAngle','rightAngle']){
  near(samplePullPawlMotion(cycle*4-1e-9)[key],samplePullPawlMotion(cycle*4+1e-9)[key],1e-8);
 }
 const normal=samplePullPawlMotion(4.57),fast=samplePullPawlMotion(2.285,{period:2});
 for(const key of ['q','theta','leftAngle','rightAngle'])near(normal[key],fast[key]);
 normal.angularVelocities.forEach((v,k)=>near(fast.angularVelocities[k],v*2));
});

test('078 both pulling hooks engage actual tooth material during their driving strokes',()=>{
 const model=makePullPawlDrive(),u=model.root.userData,wheel=u.parts.wheelBody,solid=solidSurface(wheel.geometry),wheelPoints=surfacePoints(wheel.geometry);
 for(const [time,key]of [[4.5,'right'],[6.5,'left']]){
  const hook=u.parts[key+'Hook'],points=surfacePoints(hook.geometry),hookSolid=solidSurface(hook.geometry);
  const penetrates=()=>{
   const matrix=wheel.matrixWorld.clone().invert().multiply(hook.matrixWorld);
   if(points.some(sample=>{const p=sample.clone().applyMatrix4(matrix);return solid.inside(p)&&solid.distance(p)>1e-6;}))return true;
   matrix.invert();
   return wheelPoints.some(sample=>{const p=sample.clone().applyMatrix4(matrix);return hookSolid.inside(p)&&hookSolid.distance(p)>1e-6;});
  };
  pose(model,time);assert.equal(penetrates(),false,key+': nominal intrusion');
  u.blocks.wheel.rotation.z+=1e-4;model.root.updateMatrixWorld(true);
  assert.equal(penetrates(),true,key+': absent driving face contact');
 }
 dispose(model);
});

test('078 separate solid families clear through both strokes and the repeat seam',()=>{
 const model=makePullPawlDrive(),u=model.root.userData,cache=new WeakMap();
 const parts=Object.entries(u.parts).map(([name,mesh])=>{
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  return{name,mesh,...cache.get(mesh.geometry)};
 });
 for(const time of [0,.5,1,2,3,3.9999,4,4.5,5,6,6.5,7,8,103.5]){
  pose(model,time);
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
   if(u.families[parts[i].name]===u.families[parts[j].name])continue;
   for(const [a,b]of [[parts[i],parts[j]],[parts[j],parts[i]]]){
    const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
    for(const sample of a.points){const point=sample.clone().applyMatrix4(matrix);if(b.solid.inside(point))assert.ok(b.solid.distance(point)<=1e-6,a.name+' enters '+b.name+' at '+time);}
   }
  }
 }
 dispose(model);
});

test('078 every physical mesh is closed, connected, outward and nondegenerate',()=>{
  const model=makePullPawlDrive();
  for(const [name,mesh] of Object.entries(model.root.userData.parts)){
    const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,edges=new Map(),parents=[];
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    let volume=0;
    for(let i=0;i<(g.index?.count??p.count);i+=3){
      const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j),vertices=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
        [a,b,c]=vertices,cross=b.clone().sub(a).cross(c.clone().sub(a)),triangle=parents.length;parents.push(triangle);
      assert.ok(cross.lengthSq()>1e-22,`${name}: degenerate triangle`);volume+=a.dot(b.clone().cross(c))/6;
      const normal=ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3());
      assert.ok(cross.dot(normal)>0,`${name}: inward shading normal`);
      const keys=vertices.map(v=>v.toArray().join(','));
      for(let j=0;j<3;j++){
        const a=keys[j],b=keys[(j+1)%3],key=a<b?a+'/'+b:b+'/'+a,e=edges.get(key)??{count:0,winding:0,triangle};
        e.count++;e.winding+=a<b?1:-1;parents[find(triangle)]=find(e.triangle);edges.set(key,e);
      }
    }
    assert.ok(volume>0,`${name}: enclosed volume`);
    assert.ok([...edges.values()].every(e=>e.count===2&&e.winding===0),`${name}: open boundary`);
    assert.equal(new Set(parents.map((_,i)=>find(i))).size,1,`${name}: detached component`);
  }
  dispose(model);
});
