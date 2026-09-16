import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createMovementModel} from '../src/simulation/registry.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const m=createMovementModel(JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements[401]),r=m.root,b=r.userData.blocks;
const pairs=[];
for(const[gear,rack]of[[b.upperBalance.workingPinion,b.externalRack],[b.leftBalance.workingPinion,b.internalRack]])for(const tooth of[rack.children[0],...rack.userData.teeth])pairs.push([gear,tooth]);
for(const h of[...b.escapeWheelTeeth,...b.escapeWheelFeet,b.escapeWheelWeb])for(const p of[...b.palletBodies,...b.anchorArms])pairs.push([h,p]);
const points=new Map(),solids=new Map();for(const p of pairs.flat()){if(!points.has(p.geometry))points.set(p.geometry,surfacePoints(p.geometry));if(!solids.has(p.geometry))solids.set(p.geometry,solidSurface(p.geometry));}
test('402 actual sector/pinion and pallet/head surfaces clear over a full cycle',()=>{
let worst={distance:1};
for(const time of [...Array.from({length:17},(_,i)=>i/4),.2,.9599609375,.839,.841,1.039,1.041,1.199,1.201,2.839,2.841,3.039,3.041,3.199,3.201]){
 m.update(time);r.updateMatrixWorld(true);
 for(const pair of pairs)for(const[a,z]of[pair,[...pair].reverse()]){
  const mat=z.matrixWorld.clone().invert().multiply(a.matrixWorld),solid=solids.get(z.geometry);
  for(const pt of points.get(a.geometry)){
   const p=pt.clone().applyMatrix4(mat);if(solid.box.distanceToPoint(p)>.003)continue;
   const d=solid.signedDistance(p,.003);
   if(d<worst.distance)worst={distance:d,time,a:a.userData.role,z:z.userData.role,world:a.localToWorld(pt.clone()).toArray()};
  }
 }
}
console.log(JSON.stringify(worst));
assert.ok(worst.distance > -1e-6,JSON.stringify(worst));
});

// Independent nearest points on the actual rendered triangle surfaces, not
// the point-locus metadata used by the old lock-coincidence tests.
import {surfaceTriangles} from './helpers/solid-surface.mjs';
const faces=new Map();
function nearest(mesh,world){
 if(!faces.has(mesh.geometry))faces.set(mesh.geometry,surfaceTriangles(mesh.geometry));
 const local=mesh.worldToLocal(world.clone()),q=new THREE.Vector3();let distance=Infinity,result;
 for(const triangle of faces.get(mesh.geometry)){
  triangle.closestPointToPoint(local,q);const d=q.distanceToSquared(local);
  if(d<distance){distance=d;result=q.clone();}
 }
 return mesh.localToWorld(result);
}
function edges(mesh){
 if(!faces.has(mesh.geometry))faces.set(mesh.geometry,surfaceTriangles(mesh.geometry));
 const result=[],seen=new Set();
 for(const triangle of faces.get(mesh.geometry)){
  if(Math.abs(triangle.getNormal(new THREE.Vector3()).z)>.1)continue;
  const a=triangle.a,b=[triangle.b,triangle.c].find(p=>Math.hypot(a.x-p.x,a.y-p.y)>1e-8);
  if(!b)continue;
  const key=[[a.x,a.y],[b.x,b.y]].sort().flat().join(',');if(seen.has(key))continue;seen.add(key);
  result.push([mesh.localToWorld(a.clone()),mesh.localToWorld(b.clone())]);
 }
 return result;
}
function workingPair(time){
 m.update(time);r.updateMatrixWorld(true);
 const c=r.userData.kinematics.activePalletContact,p=b.palletBodies[c.side==='upper'?0:1],h=b.escapeWheelTeeth[c.toothIndex];
 let gap=Infinity,a,z;
 const check=(point,u,v,reverse)=>{
  const dx=v.x-u.x,dy=v.y-u.y,t=Math.max(0,Math.min(1,((point.x-u.x)*dx+(point.y-u.y)*dy)/(dx*dx+dy*dy)));
  const q=new THREE.Vector3(u.x+t*dx,u.y+t*dy,.32),distance=Math.hypot(point.x-q.x,point.y-q.y);
  if(distance<gap){gap=distance;a=(reverse?q:point).clone();z=(reverse?point:q).clone();a.z=z.z=.32;}
 };
 for(const[ha,hz]of edges(h))for(const[pa,pz]of edges(p)){
  check(ha,pa,pz,false);check(hz,pa,pz,false);check(pa,ha,hz,true);check(pz,ha,hz,true);
 }
 return{a,z,p,h,c,gap};
}

test('402 both finite impulse branches have actual face/corner normal cones and properly signed reactions',()=>{
 const g=r.userData.geometry,report=[];
 for(const time of [.92,.96,1,2.96,3]){
  const pair=workingPair(time),{a,z,p,h,c,gap}=pair,n=a.clone().sub(z).normalize();
  assert.ok(gap>.0003&&gap<.003,`working gap ${gap} at ${time}`);
  const wheelMoment=new THREE.Vector3(a.x-g.escapeWheelCenter.x,a.y-g.escapeWheelCenter.y,0).cross(n).z;
  const leverMoment=new THREE.Vector3(z.x,z.y,0).cross(n.clone().negate()).z;
  assert.ok(wheelMoment>0,'normal opposes clockwise escape-wheel drive');
  assert.ok(leverMoment*r.userData.kinematics.leverAngularSpeed>0,'impulse helps actual lever motion');
  for(const[mesh,point,dir]of[[h,a,n],[p,z,n.clone().negate()]]){
   const local=mesh.worldToLocal(point.clone()),normals=[];
   for(const triangle of faces.get(mesh.geometry)){
    if(triangle.closestPointToPoint(local,new THREE.Vector3()).distanceTo(local)>2e-6)continue;
    const normal=triangle.getNormal(new THREE.Vector3()).negate().transformDirection(mesh.matrixWorld);
    if(Math.abs(normal.z)<.1)normals.push(normal);
   }
   let supported=normals.some(normal=>normal.dot(dir)>1-1e-5);
   for(const u of normals)for(const v of normals){
    const det=u.x*v.y-u.y*v.x;if(Math.abs(det)<1e-8)continue;
    const alpha=(dir.x*v.y-dir.y*v.x)/det,beta=(u.x*dir.y-u.y*dir.x)/det;
    if(alpha>=-1e-5&&beta>=-1e-5)supported=true;
   }
   assert.ok(supported,JSON.stringify({time,role:mesh.userData.role,normal:dir.toArray(),incidentNormals:normals.map(p=>p.toArray())}));
  }
  report.push({time,gap,wheelMoment,leverMoment});
 }
 console.log(JSON.stringify({finiteImpulses:report}));
});

test('402 unresolved upper holding and early lower impulse gaps remain explicit',()=>{
 const early=workingPair(2.92);assert.ok(early.gap>.004&&early.gap<.0041);
 const pair=workingPair(0);
 assert.ok(pair.gap>.009 && pair.gap<.014);
 assert.equal(r.userData.finiteWorkingParts.contact.completeLoadedHandoff,false);
 assert.match(r.userData.reconstructionNote,/upper pallet.*holding/i);
 assert.ok(r.userData.contacts.escapeWheelToAnchorPallet.error<1e-12);
});

test('402 both involute meshes retain nearby working flanks throughout their oscillation',()=>{
 const samples=[];
 for(const[pinion,rack,label]of[[b.upperBalance.workingPinion,b.externalRack,'external'],[b.leftBalance.workingPinion,b.internalRack,'internal']]){
  let maximumGap=0;
  for(let pose=0;pose<=32;pose++){
   m.update(pose/8);r.updateMatrixWorld(true);let best=Infinity;
   for(const tooth of rack.userData.teeth){
    const matrix=pinion.matrixWorld.clone().invert().multiply(tooth.matrixWorld),solid=solids.get(pinion.geometry);
    for(const p of points.get(tooth.geometry))best=Math.min(best,solid.distance(p.clone().applyMatrix4(matrix),best));
   }
   maximumGap=Math.max(maximumGap,best);assert.ok(best<.003,`${label} flank gap ${best}`);
  }
  samples.push({label,maximumGap});
 }
 console.log(JSON.stringify({gearContact:samples}));
});

test('402 journals and underlying arm/frame bores clear actual arbor surfaces',()=>{
 m.update(0);r.updateMatrixWorld(true);
 const groups=[
  [b.leverShaft,[b.leverHub,b.leverBearing,...b.anchorArms,...b.rackArms,...b.frameBars]],
  [b.escapeShaft,[b.escapeWheelHub,b.escapeBearing,b.escapeWheelWeb,...b.frameBars]],
  [b.upperBalance.shaft,[b.upperBalance.hub,b.upperBalance.bearing,b.upperBalance.workingPinion,...b.upperBalance.spokes,...b.frameBars]],
  [b.leftBalance.shaft,[b.leftBalance.hub,b.leftBalance.bearing,b.leftBalance.workingPinion,...b.leftBalance.spokes,...b.frameBars]],
 ];
 for(const[shaft,targets]of groups)for(const target of targets){
  const solid=solidSurface(target.geometry),matrix=target.matrixWorld.clone().invert().multiply(shaft.matrixWorld);
  for(const point of surfacePoints(shaft.geometry)){
   const local=point.clone().applyMatrix4(matrix);
   if(solid.box.distanceToPoint(local)>.004)continue;
   assert.ok(solid.signedDistance(local)>-1e-6,`shaft intrudes ${target.userData.role}`);
  }
 }
 // Pallets overlap their front arms; raised arms clear the wheel's front face.
 for(let i=0;i<2;i++){
  const arm=b.anchorArms[i],p=b.palletBodies[i],solid=solidSurface(arm.geometry),matrix=arm.matrixWorld.clone().invert().multiply(p.matrixWorld);
  assert.ok(surfacePoints(p.geometry).some(point=>solid.inside(point.clone().applyMatrix4(matrix))),'pallet has a finite attachment');
 }
});

test('402 effective camera, scene flags, separate balances and buffers remain stable',()=>{
 assert.ok(m.cameraDirection.z>15);assert.equal(r.userData.hideGround,true);
 assert.equal(r.userData.minimumDisplayCycleSeconds,6);
 const counts=()=>{let n=0;const g=[];r.traverse(o=>{n++;if(o.geometry)g.push(o.geometry.attributes.position);});return{n,g};};
 const before=counts();
 for(let i=0;i<=16;i++){m.update(i/4);r.updateMatrixWorld(true);
  const a=new THREE.Box3().setFromObject(b.upperBalance.rim),z=new THREE.Box3().setFromObject(b.leftBalance.rim);
  assert.ok(a.min.z>z.max.z);
 }
 const after=counts();assert.equal(after.n,before.n);assert.deepEqual(after.g,before.g);
 r.traverse(o=>{for(const mat of[o.material].flat().filter(Boolean))assert.equal(mat.fog,false);if(o.isMesh)assert.equal(o.castShadow,true);});
});

test('402 every relieved front land has finite rear stock connected to the compact rim',()=>{
 m.update(0);r.updateMatrixWorld(true);
 const head=b.escapeWheelTeeth[0],foot=b.escapeWheelFeet[0],support=solidSurface(foot.geometry);
 head.geometry.computeBoundingBox();foot.geometry.computeBoundingBox();
 assert.ok(foot.geometry.boundingBox.max.z-head.geometry.boundingBox.min.z>.0009);
 for(const point of surfacePoints(head.geometry)){
  point.z=-.08;
  assert.ok(support.signedDistance(point)<1e-6,'each front land lies over continuous rear stock');
 }
 const rim=solidSurface(b.escapeWheelWeb.geometry);
 for(const p of b.escapeWheelFeet){
  const matrix=b.escapeWheelWeb.matrixWorld.clone().invert().multiply(p.matrixWorld);
  assert.ok(surfacePoints(p.geometry).some(point=>rim.inside(point.clone().applyMatrix4(matrix))),'foot has finite overlap with rim');
 }
 const maxRadius=Math.max(...surfacePoints(foot.geometry).map(p=>Math.hypot(p.x,p.y)));
 assert.ok(maxRadius<.914,'compact heel remains inside the original wheel envelope plus .004');
});
