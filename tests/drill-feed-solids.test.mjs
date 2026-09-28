import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMovementModel} from '../src/simulation/registry.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
const bounds=o=>new THREE.Box3().setFromObject(o,true);
function clear(mesh,points,moving,surface){
 const transform=mesh.matrixWorld.clone().invert().multiply(moving.matrixWorld);
 let closest=Infinity,queries=0;
 for(const point of points){const p=point.clone().applyMatrix4(transform);
  if(surface.box.distanceToPoint(p)>.01)continue;
  const gap=surface.signedDistance(p,.01);assert.ok(gap>=-1e-6,`${mesh.userData.role}: ${gap}`);
  closest=Math.min(closest,gap);queries++;
 }
 return{closest,queries};
}

for(const id of [379,380])test(`${id} closed feed threads pass through the actual nut and bored frame throughout advance and return`,()=>{
 const {root,update}=createMovementModel(catalog[id-1]),b=root.userData.blocks;
 const points=surfacePoints(b.feedThread.geometry).filter((_,i)=>i%8===0);
 const targets=[b.nutThread,b.cFrame].map(o=>[o,solidSurface(o.geometry)]);
 let closest=Infinity,queries=0;
 for(let i=0;i<=32;i++){
  update(i*4/32);root.updateMatrixWorld(true);
  for(const [mesh,surface]of targets){const result=clear(mesh,points,b.feedThread,surface);queries+=result.queries;if(mesh===b.nutThread)closest=Math.min(closest,result.closest);}
 }
 assert.ok(queries>1000);assert.ok(closest>.002&&closest<.004);
 assert.equal(b.feedThread.geometry.type,'BufferGeometry');
});

test('380 inner spindle passes through the complete hollow sleeve, handle and thrust collar while the thrust rings capture it',()=>{
 const {root,update}=createMovementModel(catalog[379]),b=root.userData.blocks;
 const targets=[b.hollowSleeve,b.feedHandleHub,b.feedHandleBar,b.thrustCollar,b.sleeveNeck,b.lowerSleeveNeck].map(o=>[o,solidSurface(o.geometry)]);
 const points=surfacePoints(b.drillSpindle.geometry);
 for(let i=0;i<=64;i++){
  update(i*4/64);root.updateMatrixWorld(true);
  for(const [mesh,surface]of targets)clear(mesh,points,b.drillSpindle,surface);
  const collar=bounds(b.thrustCollar),low=bounds(b.thrustRings[0]),high=bounds(b.thrustRings[1]);
  assert.ok(collar.min.y-low.max.y>.009&&collar.min.y-low.max.y<.011);
  assert.ok(high.min.y-collar.max.y>.009&&high.min.y-collar.max.y<.011);
 }
});

test('379 and 380 actual drill points face down and preserve clearance to the work surface while rotating continuously',()=>{
 for(const id of[379,380]){
  const {root,update}=createMovementModel(catalog[id-1]),d=root.userData,b=d.blocks;
  for(let i=0;i<=64;i++){
   const time=i*4/64;update(time);root.updateMatrixWorld(true);const state=d.stateAtTime(time);
   const tip=bounds(b.drillBit).min.y,top=bounds(id===379?b.workRest:b.fixedWorkRest).max.y;
   assert.ok(Math.abs(tip-state.drillTipY)<1e-7);
   assert.ok(Math.abs(tip-top-state.clearance)<1e-7);
   assert.ok(tip>top);
  }
  assert.ok(d.stateAtTime(40).drillAngle-d.stateAtTime(36).drillAngle>24);
 }
});

test('366 finite keyed pinion and shaft guides clear the sliding feather across every feed position',()=>{
 const {root,update}=createMovementModel(catalog[365]),b=root.userData.blocks;
 const meshes=[];
 for(const object of[b.pinionGear.userData.body,b.pinionHub,...b.pinionBearingCollars,b.lowerShaftGuide,b.upperShaftGuide,b.thrustCollar,b.inputShaft])object.traverse(o=>{if(o.geometry)meshes.push(o);});
 const targets=meshes.map(o=>[o,solidSurface(o.geometry)]);
 for(let i=0;i<=64;i++){
  update(i*8/64);root.updateMatrixWorld(true);
  for(const moving of[b.drillShaft,b.shaftFeather,b.shaftSpinIndex]){
   const points=surfacePoints(moving.geometry);
   for(const [mesh,surface]of targets)clear(mesh,points,moving,surface);
  }
  const feather=bounds(b.shaftFeather),pinion=bounds(b.pinionGear.userData.body);
  // The feather keys the pinion over at least half its bore at every feed
  // position; it is kept short of the large bevel's inner tooth ends below.
  const engaged=Math.min(feather.max.y,pinion.max.y)-Math.max(feather.min.y,pinion.min.y);
  assert.ok(engaged>=.5*(pinion.max.y-pinion.min.y),`feather engagement ${engaged}`);
 }
});

test('366 feed rods have finite bores and distinct joint layers',()=>{
 const {root,update}=createMovementModel(catalog[365]),b=root.userData.blocks;
 const rods=[[b.verticalConnector,[b.feedPins[0],b.feedPins[1]]]];
 const ray=new THREE.Raycaster();
 for(let i=0;i<=64;i++){
  update(i*8/64);root.updateMatrixWorld(true);
  for(const [rod,pins]of rods)for(const pin of pins){
   const c=pin.getWorldPosition(new THREE.Vector3());
   for(let j=0;j<16;j++){
    ray.set(new THREE.Vector3(c.x+.06*Math.cos(j*Math.PI/8),c.y+.06*Math.sin(j*Math.PI/8),2),new THREE.Vector3(0,0,-1));
    assert.equal(ray.intersectObject(rod,true).length,0);
   }
   assert.ok(bounds(pin).min.z<bounds(rod).min.z&&bounds(pin).max.z>bounds(rod).max.z);
  }
  assert.ok(bounds(b.verticalConnector).min.z>bounds(b.treadleBeam).max.z);
  // The collar pin passes through the upper lever's slotted eye, in the shaft plane behind the shaft.
  assert.ok(bounds(b.collarPin).min.z<bounds(b.upperLeverBeam).min.z&&bounds(b.collarPin).max.z>bounds(b.upperLeverBeam).max.z);
  assert.ok(bounds(b.upperLeverBeam).max.z<-.2&&bounds(b.treadleBeam).max.z<-.2,'levers lie just behind the drill shaft');
 }
});

test('366 shared involute bevel surfaces clear each other throughout one tooth period',()=>{
 const {root,update}=createMovementModel(catalog[365]),b=root.userData.blocks;
 const parts=[b.driverGear,b.pinionGear].map(gear=>{
  const rotor=gear.userData.rotor;
  const gs=rotor.children.filter(o=>o===gear.userData.body||o.userData.bevelTooth).map(o=>{
   o.updateMatrix();let g=o.geometry.clone().applyMatrix4(o.matrix);if(g.index)g=g.toNonIndexed();
   for(const n of Object.keys(g.attributes))if(n!=='position')g.deleteAttribute(n);return g;
  });
  const g=mergeGeometries(gs);gs.forEach(g=>g.dispose());
  return{rotor,surface:solidSurface(g),points:surfacePoints(g).filter((_,i)=>i%4===0)};
 });
 let queries=0;
 for(let i=0;i<=24;i++){
  update((8/32)*i/24);root.updateMatrixWorld(true);let nearest=Infinity;
  for(const[from,to]of[[parts[0],parts[1]],[parts[1],parts[0]]]){
   const result=clear(to.rotor,from.points,from.rotor,to.surface);queries+=result.queries;nearest=Math.min(nearest,result.closest);
  }
  assert.ok(nearest<.003);
 }
 assert.ok(queries>10000);
});


test('366 source-facing upper pinion mounting clears its fixed bearing and moving thrust stack over the full feed stroke',()=>{
 const {root,update}=createMovementModel(catalog[365]),d=root.userData,b=d.blocks;
 const hubPoints=surfacePoints(b.pinionHub.geometry);
 const bearingSurface=solidSurface(b.upperShaftGuide.geometry);
 for(let i=0;i<=128;i++){
  update(i*8/128);root.updateMatrixWorld(true);
  const cone=bounds(b.pinionGear.userData.body),hub=bounds(b.pinionHub),bearing=bounds(b.upperShaftGuide);
  assert.ok(cone.min.y>b.inputRotor.position.y,'small bevel must be above the horizontal input shaft');
  assert.ok(cone.max.y<bearing.min.y,'pinion cone clears the upper bearing');
  assert.ok(hub.min.y<bearing.min.y&&hub.max.y>bearing.max.y,'fixed bearing captures the rotating neck');
  for(const ring of b.thrustRings)assert.ok(bounds(ring).min.y>hub.max.y,'thrust flanges clear the fixed-height pinion hub');
  assert.ok(bounds(b.thrustCollar).min.y>hub.max.y,'translating collar clears the hub');
  clear(b.upperShaftGuide,hubPoints,b.pinionHub,bearingSurface);
  assert.ok(bearing.min.y-bounds(b.pinionBearingCollars[0]).max.y>.019);
  assert.ok(bounds(b.pinionBearingCollars[1]).min.y-bearing.max.y>.019);
  assert.ok(d.stateAtTime(i*8/128).drillShaftAngularSpeed<0,'physical spindle phase follows the upward pinion axis');
 }
});

test('379 and 380 C-frames are one extrusion of one section thickness, arm ends buried in their journals clear of the bores',()=>{
 for(const [id,thickness,bores] of [[379,.32,{drillHousing:.109,fixedFeedNut:.189}],[380,.34,{fixedFeedNut:.325}]]){
  const {root}=createMovementModel(catalog[id-1]),b=root.userData.blocks;root.updateMatrixWorld(true);
  const outline=b.cFrame.userData.outline;
  assert.equal(b.cFrame.geometry.userData.plate.polygons.length,1);
  const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);
  const box={min:{x:Math.min(...xs),y:Math.min(...ys)},max:{x:Math.max(...xs),y:Math.max(...ys),z:b.cFrame.geometry.userData.plate.high}};
  // back, top arm and lower arm widths
  const backInner=Math.min(...xs.filter(x=>x>box.min.x+1e-9));
  assert.ok(Math.abs(backInner-box.min.x-thickness)<1e-9,`${id} back thickness`);
  const topInner=Math.max(...ys.filter(y=>y<box.max.y-1e-9&&y>0));
  assert.ok(Math.abs(box.max.y-topInner-thickness)<1e-9,`${id} top arm thickness`);
  const lowInner=Math.min(...outline.filter(([x])=>Math.abs(x-backInner)<1e-9).map(p=>p[1]));
  assert.ok(Math.abs(lowInner-box.min.y-thickness)<1e-9,`${id} lower arm thickness`);
  for(const [name,bore] of Object.entries(bores)){
   const journal=b[name],center=journal.position;
   journal.geometry.computeBoundingBox();const outer=journal.geometry.boundingBox.max.x,depth=box.max.z;
   const half=journal.geometry.boundingBox.max.y;
   const ends=outline.filter(([x,y])=>Math.abs(y-center.y)<=half+1e-9&&x>center.x-outer);
   assert.ok(ends.length>=2,`${id} ${name}: arm reaches the journal`);
   for(const [x] of ends){
    assert.ok(Math.hypot(center.x-x,depth)<outer,`${id} ${name}: arm end corners are inside the journal`);
    assert.ok(center.x-x>bore+.005,`${id} ${name}: arm end clears the bore`);
   }
  }
 }
});

// Pass 90: 379 and 380 share one crank treatment. The bar is one flat
// extrusion whose far end is a circular arc concentric with the turned
// handle; the handle's foot is sunk into the bar's top and lies wholly inside
// that end, so no bar edge overhangs the handle (the p87 lip).
test('379 and 380 cranks carry one turned handle whose foot stands wholly on the bar end',()=>{
 for(const [id,expected] of [[379,{handleX:-1.60,end:.15,height:.47}],[380,{handleX:-1.45,end:.20,height:.442}]]){
  const model=createMovementModel(catalog[id-1]),b=model.root.userData.blocks;
  const arm=b.drillCrankArm,knob=b.drillCrankKnob;
  assert.equal(knob.geometry.type,'LatheGeometry',`${id} handle is turned`);
  assert.ok(Math.abs(knob.position.x-expected.handleX)<1e-6,`${id} handle axis`);
  arm.geometry.computeBoundingBox();const box=arm.geometry.boundingBox;
  assert.ok(Math.abs(box.max.y-box.min.y-.11)<1e-6,`${id} bar is 0.11 thick`);
  assert.ok(Math.abs(box.min.x-(expected.handleX-expected.end))<1e-3,`${id} bar end is an arc about the handle axis`);
  const p=knob.geometry.attributes.position,foot={r:0,top:0};
  for(let i=0;i<p.count;i++){const y=p.getY(i),r=Math.hypot(p.getX(i),p.getZ(i));foot.top=Math.max(foot.top,y);if(y<=.013)foot.r=Math.max(foot.r,r);}
  assert.ok(Math.abs(foot.top-expected.height)<1e-6,`${id} handle height`);
  assert.ok(foot.r<expected.end-.02,`${id} foot ${foot.r} lies inside the bar end`);
  assert.ok(Math.abs(knob.position.y-(box.max.y-.012))<1e-6,`${id} foot is sunk 0.012 into the bar`);
  // Every bar vertex beyond the handle axis lies on the end arc.
  const q=arm.geometry.attributes.position;
  for(let i=0;i<q.count;i++){const x=q.getX(i),z=q.getZ(i);if(x<expected.handleX-1e-6)assert.ok(Math.abs(Math.hypot(x-expected.handleX,z)-expected.end)<1e-6,`${id} end arc`);}
 }
});
