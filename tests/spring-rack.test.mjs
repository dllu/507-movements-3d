import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSpringRackDrive} from '../src/simulation/spring-rack.js';
import {makeSpringRackCandidate} from '../scripts/lib/spring-rack-candidate.mjs';
import {makeSpringRackPlayback} from '../scripts/lib/spring-rack-playback-study.mjs';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`),
 dispose=model=>model.root.traverse(x=>{x.geometry?.dispose();x.material?.dispose();});

test('081 follows the measured six-tooth wheel, seven-tooth rack and bored guides',()=>{
 const m=makeSpringRackDrive(),u=m.root.userData,p=u.geometry;
 assert.equal(p.teeth,16);assert.equal(p.installedTeeth,6);assert.equal(p.source.rackTeeth,7);
 assert.equal(Object.keys(u.parts).filter(n=>/^rackTooth/.test(n)).length,7);
 assert.ok(p.contactRatio>1);assert.ok(p.tipHalfAngle>0);
 assert.equal(u.fidelity,'authored');assert.equal(u.hideGround,true);
 near(u.parts.fixedAxle.position.length(),0);
 const mandrel=u.parts.fixedSlidingMandrel,seat=u.parts.movingSpringSeat,
  guide=u.parts.lowerRackGuide,rod=u.parts.rackRod,
  centerX=(p.guide.stemX[0]+p.guide.stemX[1])/2,
  x=u.source([centerX,0])[0];
 for(const mesh of [seat,guide]){
  mesh.geometry.computeBoundingBox();const y=mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).y;
  assert.equal(solidSurface(mesh.geometry).inside(new THREE.Vector3(x,y,.1)),false,'The guide must have a real passage');
 }
 // One closed rack-rod: solid behind the old slot line, bored only above
 // its floor, which stays below the mandrel through the whole stroke; no
 // travel-stop pin or cap remains.
 const rodSolid=solidSurface(rod.geometry),[sx,sy]=u.source([p.stop.sourceX,p.stop.sourceY]);
 assert.equal(rodSolid.inside(new THREE.Vector3(sx,sy,p.layers.rack[0]+.004)),true);
 assert.equal(rodSolid.inside(new THREE.Vector3(x,p.boreFloor+.05,.1)),false);
 assert.equal(rodSolid.inside(new THREE.Vector3(x,p.boreFloor-.05,.1)),true);
 mandrel.geometry.computeBoundingBox();assert.ok(p.boreFloor+u.profile.range[1]<mandrel.geometry.boundingBox.min.y);
 for(const name of ['fixedTravelStopPin','travelStopRearCap','slottedRackRearWall','rackLeftWall'])assert.equal(u.parts[name],undefined);
 assert.ok(mandrel.geometry.attributes.position.count>0);dispose(m);
});

test('081 all source solids are closed, consistently wound and nondegenerate',()=>{
 const m=makeSpringRackDrive();
 for(const [name,mesh] of Object.entries(m.root.userData.parts)){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,edges=new Map();let volume=0;
  for(let i=0;i<(g.index?.count??p.count);i+=3){
   const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
    cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
   assert.ok(cross.lengthSq()>1e-22,name+' degenerate face');volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
   assert.ok(cross.dot(ids.reduce((sum,j)=>sum.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()))>0,name+' inward shading');
   const keys=v.map(p=>p.toArray().join(','));for(let j=0;j<3;j++){
    const a=keys[j],b=keys[(j+1)%3],key=a<b?a+'/'+b:b+'/'+a,row=edges.get(key)??{count:0,sign:0};
    row.count++;row.sign+=a<b?1:-1;edges.set(key,row);
   }
  }
  assert.ok(volume>0,name+' nonpositive volume');assert.ok([...edges.values()].every(e=>e.count===2&&e.sign===0),name+' open surface');
 }
 dispose(m);
});

test('081 compresses its capped wire without scaling its thickness or losing spring-seat contact',()=>{
 const m=makeSpringRackDrive(),u=m.root.userData,p=u.geometry,wire=p.spring.wireRadius;
 for(const y of [u.profile.range[0],0,1,u.profile.range[1]]){
  m.setState({q:0,rackY:y});const g=u.parts.compressionSpring.geometry,a=g.attributes.position,c=g.userData.coil;
  near(c.bottom,p.spring.bottom+y);near(c.top,p.spring.top);near(c.currentLength,c.referenceLength,1e-10);
  near(g.boundingBox.min.y,c.bottom,1e-6);near(g.boundingBox.max.y,c.top,1e-6);
  for(let i=0;i<=c.segments;i+=16){
   const points=Array.from({length:c.sides},(_,j)=>new THREE.Vector3().fromBufferAttribute(a,i*c.sides+j)),
    center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/c.sides);
   for(const point of points)near(point.distanceTo(center),wire,5e-7);
  }
 }
 dispose(m);
});

test('081 production geometry and motion match the independently reviewed candidate',()=>{
 const model=makeSpringRackDrive(),u=model.root.userData,candidate=makeSpringRackCandidate(u.profile.geometry),v=candidate.root.userData,
  motion=makeSpringRackPlayback(candidate,u.profile);
 for(let i=0;i<=240;i++){
  const time=i*16/240,expected=motion.sample(time),actual=u.stateAtTime(time);
  near(actual.q,expected.q,0);near(actual.rackY,expected.rackY,0);
  if(i%12)continue;
  model.update(time);candidate.setState(expected);
  for(const [name,mesh] of Object.entries(u.parts)){
   const other=v.parts[name];assert.deepEqual(mesh.matrixWorld.elements,other.matrixWorld.elements,name+' transform');
   for(const attr of ['position','normal'])assert.deepEqual(mesh.geometry.attributes[attr].array,other.geometry.attributes[attr].array,name+' '+attr);
   assert.deepEqual(mesh.geometry.index?.array,other.geometry.index?.array,name+' topology');
  }
 }
 dispose(model);dispose(candidate);
});

test('081 repeats the settled cycle, retains lift and spring return, and stays inside its motion envelope',()=>{
 const m=makeSpringRackDrive(),u=m.root.userData,box=new THREE.Box3(new THREE.Vector3(...u.sampledMotionBounds.min),new THREE.Vector3(...u.sampledMotionBounds.max));
 let min=Infinity,max=-Infinity,minGap=Infinity,maxCorrection=0;
 for(let i=0;i<=400;i++){
  const t=i*8/400,s=u.stateAtTime(t);min=Math.min(min,s.rackY);max=Math.max(max,s.rackY);
  minGap=Math.min(minGap,u.motion.contact.pair(s.q,s.rackY,0).minimumGap);maxCorrection=Math.max(maxCorrection,s.projection);
  if(t>=4){const next=u.stateAtTime(t+4);near(next.rackY,s.rackY,1e-10);}
  if(i%20)continue;m.update(t);
  for(const mesh of Object.values(u.parts)){
   // Check the transformed vertices: rotated local boxes include empty corners
   // outside the gear's actual circular sweep.
   const actual=new THREE.Box3().setFromObject(mesh,true);assert.ok(box.containsBox(actual),mesh.name+' exceeds the camera envelope');
  }
 }
 assert.ok(max-min>2.9);assert.ok(minGap>=-1e-6);assert.ok(maxCorrection*u.geometry.source.scale<.002);
 near(u.playbackPeriod,4);dispose(m);
});

test('081 the deformed spring and independent solids clear the guides, teeth and stop through a cycle',()=>{
 const m=makeSpringRackDrive(),u=m.root.userData,parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 for(const time of [0,.4,.9,1.3,1.7,2.1,2.5,2.9,3.3,3.7,4,5.4,6.1,6.8,7.5]){
  m.update(time);
  for(const a of parts)if(u.families[a.name]==='spring'){a.solid=solidSurface(a.mesh.geometry);a.points=surfacePoints(a.mesh.geometry);}
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
   if(u.families[parts[i].name]===u.families[parts[j].name])continue;
   for(const [a,b] of [[parts[i],parts[j]],[parts[j],parts[i]]]){
    const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
    for(const sample of a.points){const point=sample.clone().applyMatrix4(matrix);
     if(b.solid.inside(point))assert.ok(b.solid.distance(point)<=1e-6,`${a.name} enters ${b.name} at ${time}`);
    }
   }
  }
 }
 dispose(m);
});
