import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeAlternatingPegPawlDrive} from '../src/simulation/alternating-peg-pawl.js';
import {sampleAlternatingPegMotion} from '../src/simulation/alternating-peg-motion.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,a+' != '+b);
const dispose=model=>model.root.traverse(x=>{x.geometry?.dispose();x.material?.dispose();});
const pose=(model,time)=>{model.update(time);return model.root.userData.kinematics;};

test('077 matches the source wheel, high fulcrum and two-pitch engaged pair',()=>{
 const model=makeAlternatingPegPawlDrive(),u=model.root.userData,p=u.geometry;
 const source=point=>[(point[0]-456.9848887445678)/433.5789672975984,(837.6559823723948-point[1])/433.5789672975984];
 for(const [name,pixel]of [['lever',[1177.5296875,619.965625]],['upper',[1180.398316970547,475.1991584852735]],['lower',[1180.7553310886644,771.7384960718294]]]){
  const expected=source(pixel);near(u.blocks[name].position.x,expected[0]);near(u.blocks[name].position.y,expected[1]);
 }
 near(p.A[1],.5020777615932099,1e-10);near(p.innerRadius,323.5218298952886/433.5789672975984);
 assert.equal(p.pinCenters.length,24);assert.equal(Object.keys(u.parts).length,63);
 near(p.phases.upper-p.phases.lower,2*Math.PI/12);
 for(const [index,pixel]of [[0,[670,524]],[22,[799,669]]]){
  const expected=source(pixel),actual=p.pinCenters[index];assert.ok(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])*p.scale<2.5);
 }
 assert.equal(u.hideGround,true);assert.equal(u.fidelity,'authored');assert.match(u.idealConstraints,/reconstruction assumptions/);
 dispose(model);
});

test('077 all bearings are bored and retain material around the shaft',()=>{
 const model=makeAlternatingPegPawlDrive(),u=model.root.userData,p=u.geometry;
 for(const [name,center,z,r]of [['wheelBody',[0,0],0,.14],['leverBody',[0,0],.25,.044],['leverBody',p.arms.upper,.25,.037],['leverBody',p.arms.lower,.25,.037],['upperPawl',[0,0],.15,.037],['lowerPawl',[0,0],.15,.037]]){
  const solid=solidSurface(u.parts[name].geometry);
  for(let i=0;i<8;i++){
   const angle=2*Math.PI*(i+.37)/8,point=radius=>new THREE.Vector3(center[0]+radius*Math.cos(angle),center[1]+radius*Math.sin(angle),z);
   assert.equal(solid.inside(point(r*.7)),false,name+': missing bore');assert.equal(solid.inside(point(r+.008)),true,name+': missing bearing wall');
  }
 }
 dispose(model);
});

test('077 advances one pin per steady cycle with independent gravity-returning pawls',()=>{
 const model=makeAlternatingPegPawlDrive(),u=model.root.userData,p=u.geometry;
 near(pose(model,0).theta,0);near(pose(model,0).q,0);
 const first=pose(model,4);assert.ok(first.theta/p.pitch>1.27&&first.theta/p.pitch<1.30);
 for(const time of [4,4.1,4.5,5,6,7.8,8,19.2,95.7]){
  const a=pose(model,time),b=pose(model,time+4);near(b.theta-a.theta,p.pitch);
  for(const key of ['q','upperAngle','lowerAngle'])near(b[key],a[key]);
  pose(model,time+37);assert.deepEqual(pose(model,time),a);
 }
 let stopped=0,upperReset=0,lowerReset=0,reverse=0,previous=pose(model,4);
 for(let i=1;i<=4000;i++){
  const state=pose(model,4+4*i/4000);if(Math.abs(state.theta-previous.theta)<1e-10)stopped++;
  reverse+=Math.min(0,state.theta-previous.theta);
  upperReset=Math.max(upperReset,previous.upperAngle-state.upperAngle);lowerReset=Math.max(lowerReset,previous.lowerAngle-state.lowerAngle);previous=state;
 }
 assert.ok(stopped/4000<.20);assert.ok(stopped/4000>.15);
 assert.ok(reverse<0&&Math.abs(reverse)<5e-6,'Retain the reduced physical backlash');
 assert.ok(upperReset>1e-5&&lowerReset>1e-5,'Both independent pawls must lift to return');
 near(u.playbackPeriod,4);near(u.minimumDisplayCycleSeconds,4);dispose(model);
});

test('077 the cached clock joins continuously, supports seeking and scales display speed',()=>{
 assert.deepEqual(sampleAlternatingPegMotion(-1),sampleAlternatingPegMotion(0));
 for(const time of [NaN,Infinity,-Infinity])assert.throws(()=>sampleAlternatingPegMotion(time),/clock/);
 for(const period of [0,-1,NaN,Infinity])assert.throws(()=>sampleAlternatingPegMotion(1,{period}),/clock/);
 for(const cycle of [1,2,24,63])for(const key of ['q','theta','upperAngle','lowerAngle'])near(sampleAlternatingPegMotion(cycle*4-1e-9)[key],sampleAlternatingPegMotion(cycle*4+1e-9)[key],1e-8);
 const normal=sampleAlternatingPegMotion(4.57),fast=sampleAlternatingPegMotion(2.285,{period:2});
 for(const key of ['q','theta','upperAngle','lowerAngle'])near(normal[key],fast[key]);
 normal.angularVelocities.forEach((v,k)=>near(fast.angularVelocities[k],v*2));
});

test('077 each driving hook has actual material contact with its wheel pin',()=>{
 const model=makeAlternatingPegPawlDrive(),u=model.root.userData;
 for(const [time,key]of [[4.5,'upper'],[6,'lower']]){
  const pawn=u.parts[key+'Pawl'],solid=solidSurface(pawn.geometry),points=surfacePoints(pawn.geometry),pinSolid=solidSurface(u.parts.wheelPin0.geometry);
  const penetrates=()=>Object.entries(u.parts).filter(([name])=>/^wheelPin\d+$/.test(name)).some(([,pin])=>{
   const toPin=pin.matrixWorld.clone().invert().multiply(pawn.matrixWorld);
   return points.some(sample=>{const point=sample.clone().applyMatrix4(toPin);return pinSolid.inside(point)&&pinSolid.distance(point)>1e-6;});
  });
  const state=pose(model,time),p=u.geometry,
    nose=new THREE.Vector3(-p.lengths[key],0,0).applyMatrix4(u.blocks[key].matrixWorld),
    pegCenters=p.pinCenters.map(point=>new THREE.Vector3(...point,0).applyMatrix4(u.blocks.wheel.matrixWorld));
  assert.ok(Math.min(...pegCenters.map(center=>center.distanceTo(nose)))<2e-6,key+': driving pin must sit inside the hook');
  assert.equal(penetrates(),false,key+': nominal intrusion');
  u.blocks.wheel.rotation.z-=1e-4;model.root.updateMatrixWorld(true);assert.equal(penetrates(),true,key+': absent driving face contact');
  assert.ok(solid.box.getSize(new THREE.Vector3()).x>.8);
 }
 dispose(model);
});

test('077 separate solid families clear through both strokes and the repeat seam',()=>{
 const model=makeAlternatingPegPawlDrive(),u=model.root.userData,cache=new WeakMap();
 const parts=Object.entries(u.parts).map(([name,mesh])=>{
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  return{name,mesh,...cache.get(mesh.geometry)};
 });
 for(const time of [0,.25,.5,.8665,1,1.5,2,2.5,3,3.5,3.9999,4,4.5,5,6,7,8,9,18,95.5]){
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

test('077 every physical mesh is closed, connected, outward and nondegenerate',()=>{
  const model=makeAlternatingPegPawlDrive();
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

test('077 both hook heads are the same C of true circular arcs, seating the peg at their back',()=>{
 const model=makeAlternatingPegPawlDrive(),u=model.root.userData,p=u.geometry,heads={};
 for(const key of ['upper','lower']){
  const center=[-p.lengths[key]+p.socketOffset[0],p.socketOffset[1]],radii=u.profiles[key]
   .map(([x,y])=>Math.hypot(x-center[0],y-center[1])).filter(r=>r<.1);
  // Outline vertices of the head lie on the socket, the rim or the two round lip ends.
  const onSocket=radii.filter(r=>Math.abs(r-p.socketRadius)<1e-6).length,onRim=radii.filter(r=>Math.abs(r-.09)<1e-6).length;
  assert.ok(onSocket>500&&onRim>500,key+': circular socket and rim '+onSocket+' '+onRim);
  assert.ok(.09-p.socketRadius>.03,key+': rim thickness');
  heads[key]=u.profiles[key].map(([x,y])=>[x+p.lengths[key],y]).filter(([x,y])=>Math.hypot(x,y)<.1);
  // The seated peg (centred on the hook) touches the socket at one point.
  near(Math.hypot(...p.socketOffset)+p.pinRadius,p.socketRadius,1e-12);
 }
 assert.equal(heads.upper.length,heads.lower.length);
 for(const [a,b]of [[heads.upper,heads.lower],[heads.lower,heads.upper]])
  for(const q of a)assert.ok(Math.min(...b.map(v=>Math.hypot(v[0]-q[0],v[1]-q[1])))<1e-6,'heads differ');
 dispose(model);
});

test('077 p93: hook shanks are flat bars about 0.6 of a peg diameter wide; dark steel pegs',()=>{
 const model=makeAlternatingPegPawlDrive(),u=model.root.userData,r=u.geometry.pinRadius;
 for(const key of ['upper','lower']){
  const L=u.geometry.lengths[key],outline=u.profiles[key];
  // Measure the bar's width half way along the shank (pawl frame: pivot at 0, head at -L).
  const x=-L/2,ys=[];
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];if((a[0]-x)*(b[0]-x)<0)ys.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}
  assert.equal(ys.length,2);const width=Math.abs(ys[0]-ys[1]);
  assert.ok(Math.abs(width/(2*r)-.59)<.02,`${key} shank width ${width}`);
 }
 for(let i=0;i<24;i++)for(const name of ['wheelPin'+i,'wheelPinCap'+i])assert.ok(u.parts[name].material.color.getHSL({}).l<.4,name);
});
