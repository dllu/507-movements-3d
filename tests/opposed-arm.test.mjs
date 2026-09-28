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
 assert.equal(Object.keys(u.parts).length,42);assert.equal(p.teeth,33);assert.equal(u.hideGround,true);assert.equal(u.fidelity,'authored');
 near(p.innerRadius,338.90038109631433/400.22693572590316);
 const source=point=>[(point[0]-406.29814582227056)/400.22693572590316,(777.9249240149841-point[1])/400.22693572590316];
 for(const [key,pixel]of [['upper',[657.1801948051948,524.5487012987013]],['lower',[654.8850364963504,1041.6770072992701]]]){
  const expected=source(pixel);expected.forEach((v,i)=>near(p.arms[key].pivot[i],v));
 }
 source([1232.452865064695,769.3401109057302]).forEach((v,i)=>near(p.sourceSlider[i],v));
 const wheel=u.parts.wheelBody.geometry.userData.faceRatchet;
 assert.ok(wheel.crest>wheel.valley&&wheel.valley>wheel.web&&wheel.web>wheel.back);assert.equal(wheel.teeth,33);
 assert.match(u.idealConstraints,/falls under gravity onto the crown teeth/);dispose(model);
});

test('079 p96: B ends in an eye with an open hook, and spacers close every pin gap',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,p=u.geometry;
 const box=new THREE.Box3().setFromBufferAttribute(u.parts.sliderB.geometry.attributes.position);
 assert.ok(box.max.x<.30&&box.max.x>.26,'the hook reaches right of the eye');
 // A ray along +x from inside the hook's mouth meets no material: the hook is open to the right.
 const ray=new THREE.Raycaster(new THREE.Vector3(.215,0,.38),new THREE.Vector3(1,0,0));
 assert.equal(ray.intersectObject(new THREE.Mesh(u.parts.sliderB.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),false).length,0,'the hook is open to the right');
 const back=new THREE.Raycaster(new THREE.Vector3(.215,0,.38),new THREE.Vector3(-1,0,0));
 assert.ok(back.intersectObject(new THREE.Mesh(u.parts.sliderB.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),false)[0].distance>.04,'the hook has a real throat');
 const span=name=>{const b=new THREE.Box3().setFromBufferAttribute(u.parts[name].geometry.attributes.position);return[b.min.z,b.max.z];};
 for(const key of ['upper','lower']){
  const [lo,hi]=span(key+'RodPinSpacer');near(lo,p.arms[key].armHigh,1e-6);near(hi,p.arms[key].rodLow,1e-6);
 }
 const stack=[span('sliderRearPinCap'),span('upperConnectingRod'),span('lowerConnectingRod'),span('sliderB'),
  ...[0,1,2].map(i=>span('sliderPinSpacer'+i))].sort((a,b)=>a[0]-b[0]);
 for(let i=1;i<stack.length;i++)assert.ok(stack[i][0]<=stack[i-1][1]+1e-6,'no bare pin between the parts on B\'s pin');
 dispose(model);
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

test('079 preserves startup, nearly continuous three-tooth advance and deterministic seeking',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,p=u.geometry;
 near(sampleOpposedArmMotion(0).theta,0);near(-sampleOpposedArmMotion(4).theta/p.pitch,2.2280797784,1e-7);
 for(const time of [4,4.11,5.7,7.99,12.8,133.71]){
  const a=sampleOpposedArmMotion(time),b=sampleOpposedArmMotion(time+4);near(b.theta-a.theta,-3*p.pitch,1e-9);
  for(const key of ['upperBeta','lowerBeta','sliderX'])near(a[key],b[key]);
  model.update(time);const state={...u.kinematics};model.update(time+17);model.update(time);assert.deepEqual(u.kinematics,state);
 }
 // The wheel never runs back and coasts between pushes, standing still for
 // under 3% of the cycle.
 let standing=0;
 for(let i=0;i<4000;i++){const a=sampleOpposedArmMotion(4+i/1000).theta,b=sampleOpposedArmMotion(4+(i+1)/1000).theta;assert.ok(b<=a);if(b===a)standing++;}
 assert.ok(standing<.03*4000,`standing ${standing}`);
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
 for(const [time,key]of [[4.3,'upper'],[6.4,'lower']]){
  const pawl=u.parts[key+'Pawl'],points=surfacePoints(pawl.geometry),penetrates=()=>{
   const matrix=wheel.matrixWorld.clone().invert().multiply(pawl.matrixWorld);
   return points.some(v=>{const q=v.clone().applyMatrix4(matrix);return solid.box.containsPoint(q)&&solid.inside(q)&&solid.distance(q)>1e-6;});
  };
  model.update(time);assert.equal(penetrates(),false,key+': nominal overlap');
  u.blocks.wheel.rotation.z+=.001;model.root.updateMatrixWorld(true);assert.equal(penetrates(),true,key+': missing driving contact');
 }
 dispose(model);
});

test('079 independent solid families clear at reversals and contacts',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 for(const time of [0,.4,1,2,3,4,4.3,5,6,6.4,7,7.95,8,16]){
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

test('079 both pawls are the same simple blade on their drawn pivots, seated on the teeth',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,p=u.geometry,[a,b]=['upper','lower'].map(k=>u.parts[k+'Pawl'].geometry.attributes.position.array);
 assert.deepEqual(Array.from(a),Array.from(b));
 for(const key of ['upper','lower']){
  // Every outline vertex lies on one of two circular arcs meeting at the tip.
  const ring=p.arms[key].pawlContour[0][0].slice(0,-1),tip=p.arms[key].pawlTip;
  near(tip[0],0);near(tip[1],-p.pawl.length);
  for(const side of [-1,1]){
   const arc=ring.filter(([x,y])=>side*x>=-1e-12&&y<-p.pawl.root+1e-9),fit=(u,v,w)=>{
    const d=2*(u[0]*(v[1]-w[1])+v[0]*(w[1]-u[1])+w[0]*(u[1]-v[1])),s=q=>q[0]*q[0]+q[1]*q[1];
    return[(s(u)*(v[1]-w[1])+s(v)*(w[1]-u[1])+s(w)*(u[1]-v[1]))/d,(s(u)*(w[0]-v[0])+s(v)*(u[0]-w[0])+s(w)*(v[0]-u[0]))/d];
   },c=fit(arc[0],arc[Math.floor(arc.length/2)],arc.at(-1)),r=Math.hypot(arc[0][0]-c[0],arc[0][1]-c[1]);
   for(const q of arc)near(Math.hypot(q[0]-c[0],q[1]-c[1]),r,1e-9);
  }
 }
 // Each tilt is the deepest the teeth allow: tipping the pawl further down
 // by 0.002 rad at any sampled pose drives it into the wheel.
 const wheel=u.parts.wheelBody,solid=solidSurface(wheel.geometry);
 for(let i=0;i<40;i++){
  const time=4+i/10,state=sampleOpposedArmMotion(time);model.update(time);
  for(const key of ['upper','lower']){
   // Skip a pawl caught mid-fall off a crest (it is dropping, not resting).
   if(Math.abs(sampleOpposedArmMotion(time+.005)[key+'Beta']-sampleOpposedArmMotion(time-.005)[key+'Beta'])>.02)continue;
   const pawl=u.parts[key+'Pawl'],points=surfacePoints(pawl.geometry);
   u.setState({...state,[key+'Beta']:state[key+'Beta']+.002});
   const matrix=wheel.matrixWorld.clone().invert().multiply(pawl.matrixWorld);
   assert.ok(points.some(v=>{const q=v.clone().applyMatrix4(matrix);return solid.box.containsPoint(q)&&solid.inside(q);}),`${key} floats at ${time}`);
   model.update(time);
  }
 }
 dispose(model);
});

test('079 each pushing pawl seats in the root with its tip edge flat on the driving face',()=>{
 const model=makeOpposedArmDrive(),u=model.root.userData,p=u.geometry,{halfThickness:h,length:L,shear}=p.pawl;
 // The blade is a sheared extrusion whose tip edge is vertical at the seated tilt.
 near(Math.atan(shear),p.pawl.seatedTilt,1e-12);
 near(p.pivotZ-L*Math.sin(p.pawl.seatedTilt)-h/Math.cos(p.pawl.seatedTilt),p.valley,1e-12);
 const seen={upper:0,lower:0};
 for(let i=0;i<4000;i++){
  const time=4+i/1000,a=sampleOpposedArmMotion(time),b=sampleOpposedArmMotion(time+.001);if(!(a.theta-b.theta>1e-4))continue;
  model.update(time);
  for(const key of ['upper','lower']){
   const m=u.parts.wheelBody.matrixWorld.clone().invert().multiply(u.parts[key+'Pawl'].matrixWorld);
   const [lo,hi]=[-h,h].map(z=>{const c=new THREE.Vector3(0,-L+z*shear,z).applyMatrix4(m),angle=Math.atan2(c.y,c.x),
    k=Math.round((angle-p.phase)/p.pitch);return{gap:(angle-p.phase-k*p.pitch)*Math.hypot(c.x,c.y),z:c.z};});
   // A pawl bearing on a face with its low corner at root depth is pushing
   // (a pawl dropping off a crest passes the next face higher up).
   if(Math.abs(lo.gap)>2e-4||lo.z>p.valley+.002)continue;
   // Pushing: both corners of the tip edge bear on the face (no wedge) and
   // the lower corner is on the valley floor.
   seen[key]++;assert.ok(Math.abs(hi.gap-lo.gap)<5e-5,`${key} ${time}: wedge ${hi.gap-lo.gap}`);
   assert.ok(lo.z>=p.valley-1e-9,`${key} ${time}: tip below the root ${lo.z}`);
  }
 }
 assert.ok(seen.upper>50&&seen.lower>50,JSON.stringify(seen));dispose(model);
});
