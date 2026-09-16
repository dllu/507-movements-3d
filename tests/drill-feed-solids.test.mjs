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
 const targets=[b.nutThread,id===379?b.frameBottom:b.frameTop].map(o=>[o,solidSurface(o.geometry)]);
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
 for(const object of[b.pinionGear.userData.body,b.lowerShaftGuide,b.upperShaftGuide,b.thrustCollar,b.collarYoke,b.inputShaft])object.traverse(o=>{if(o.geometry)meshes.push(o);});
 const targets=meshes.map(o=>[o,solidSurface(o.geometry)]);
 for(let i=0;i<=64;i++){
  update(i*8/64);root.updateMatrixWorld(true);
  for(const moving of[b.drillShaft,b.shaftFeather,b.shaftSpinIndex]){
   const points=surfacePoints(moving.geometry);
   for(const [mesh,surface]of targets)clear(mesh,points,moving,surface);
  }
  const feather=bounds(b.shaftFeather),pinion=bounds(b.pinionGear.userData.body);
  assert.ok(feather.min.y<pinion.min.y&&feather.max.y>pinion.max.y);
 }
});

test('366 feed rods have finite bores and distinct joint layers',()=>{
 const {root,update}=createMovementModel(catalog[365]),b=root.userData.blocks;
 const rods=[[b.verticalConnector,[b.feedPins[0],b.feedPins[1]]],[b.upperThrustLink,[b.feedPins[2],b.collarPin]]];
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
  assert.ok(bounds(b.upperThrustLink).min.z>bounds(b.upperLeverBeam).max.z);
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
