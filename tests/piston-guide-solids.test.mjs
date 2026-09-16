import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createAuthoredCartwrightParallelMotion} from '../src/simulation/authored-cartwright-parallel-motions.js';
import {createAuthoredForkedPistonGuide} from '../src/simulation/authored-forked-piston-guides.js';
import {disposeMovementModel} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
const make=id=>(id===328?createAuthoredCartwrightParallelMotion:createAuthoredForkedPistonGuide)(catalog[id-1]);
const box=o=>new THREE.Box3().setFromObject(o,true);
function openDisc(object,center,radius,axis=new THREE.Vector3(0,0,1)) {
 assert.ok(Number.isFinite(radius)&&radius>0);
 for(let i=-1;i<32;i++) {
  const p=center.clone();
  if(i>=0){p.x+=radius*Math.cos(i*Math.PI/16);p[axis.z?'y':'z']+=radius*Math.sin(i*Math.PI/16);}
  const ray=new THREE.Raycaster(p.addScaledVector(axis,-12),axis,0,24);
  assert.equal(ray.intersectObject(object,true).length,0,`${object.userData.role} blocks its finite pin/rod`);
 }
}
function assertSurfacesClear(a,b,cache,label) {
 if(!box(a).intersectsBox(box(b)))return;
 for(const mesh of [a,b])if(!cache.has(mesh))cache.set(mesh,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
 for(const [from,to] of [[a,b],[b,a]]) {
  const transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),surface=cache.get(to).surface;
  for(const point of cache.get(from).points) {
   const p=point.clone().applyMatrix4(transform);
   if(surface.inside(p))assert.ok(surface.distance(p,.03)<1e-6,label);
  }
 }
}

test('328: rods and stationary bearings clear finite pins; piston attachment and gland are connected',()=>{
 const m=make(328);try {
  const {blocks:b,geometry:g}=m.root.userData;
  for(let i=0;i<=32;i++) {
   m.update(g.assemblyClosurePeriod*i/32);m.root.updateMatrixWorld(true);
   for(const [rod,crank,wrist] of [[b.leftRod,b.leftCrankPinShaft,b.crossheadPins[0]],[b.rightRod,b.rightCrankPinShaft,b.crossheadPins[1]]]) {
    openDisc(rod,crank.getWorldPosition(new THREE.Vector3()),.25*g.sourceScale);
    openDisc(rod,wrist.getWorldPosition(new THREE.Vector3()),.375*g.sourceScale);
   }
  }
  for(const bearing of [b.leftBearing,b.rightBearing])openDisc(bearing,bearing.getWorldPosition(new THREE.Vector3()),.47*g.sourceScale);
  assert.ok(box(b.pistonBoss).intersectsBox(box(b.pistonRodB)));
  assert.ok(box(b.pistonBoss).intersectsBox(box(b.crossheadBar)));
  assert.ok(box(b.glandNeck).intersectsBox(box(b.pistonGland)));
  assert.ok(box(b.glandNeck).intersectsBox(box(b.cylinderTop)));
  assert.ok(box(b.cylinderBody).intersectsBox(box(b.cylinderTop)));
  const center=b.pistonRodB.getWorldPosition(new THREE.Vector3()),radius=Math.hypot(.25*g.sourceScale,.075);
  for(const part of [b.cylinderBody,b.cylinderTop,b.pistonGland,b.glandNeck])openDisc(part,center,radius,new THREE.Vector3(0,1,0));
 } finally {disposeMovementModel(m);}
});

test('328: open four-spoke wheels retain engaged, nonpenetrating involute working surfaces',()=>{
 const m=make(328);try {
  const {blocks:b,geometry:g}=m.root.userData,cache=new Map();
  const body=gear=>gear.userData.rotor.children[0];
  for(const wheel of [b.leftWheelC,b.rightWheelC]) {
   assert.equal(wheel.userData.sourceSpokeCount,4);
   assert.equal(body(wheel).geometry.parameters.shapes.holes.length,5);
  }
  for(const [a,c] of [[b.inputPinion,b.rightWheelC],[b.leftWheelC,b.rightWheelC]]) {
   const p=a.userData,q=c.userData,alpha=p.pressureAngle;
   const ratio=(Math.sqrt(p.outerRadius**2-p.baseRadius**2)+Math.sqrt(q.outerRadius**2-q.baseRadius**2)-(p.radius+q.radius)*Math.sin(alpha))/(Math.PI*p.module*Math.cos(alpha));
   assert.ok(ratio>1.1,`continuous engagement ratio ${ratio}`);
  }
  for(let i=0;i<=128;i++) {
   m.update(g.assemblyClosurePeriod*i/128);m.root.updateMatrixWorld(true);
   for(const [a,c] of [[b.inputPinion,b.rightWheelC],[b.leftWheelC,b.rightWheelC]])assertSurfacesClear(body(a),body(c),cache,`328 working teeth at ${i}`);
  }
 }finally{disposeMovementModel(m);}
});

test('330: fork eyes are bored and all fork solids clear piston, crosshead and fixed guide',()=>{
 const m=make(330);try {
  const {blocks:b,geometry:g}=m.root.userData,meshes=[],cache=new Map();
  b.forkedConnectingRod.traverse(o=>{if(o.isMesh)meshes.push(o);});
  for(let i=0;i<=64;i++) {
   m.update(g.cyclePeriod*i/64);m.root.updateMatrixWorld(true);
   openDisc(b.forkedConnectingRod,b.crankPinAnchor.getWorldPosition(new THREE.Vector3()),.11);
   openDisc(b.forkedConnectingRod,b.commonWristPin.getWorldPosition(new THREE.Vector3()),.12);
   for(const part of meshes)for(const other of [b.pistonRod,b.crosshead,b.guideShoe,b.guideBracket,b.guideCollar])assertSurfacesClear(part,other,cache,`${part.userData.role}/${other.userData.role} at ${i}`);
   const head=box(b.pistonHead);
   assert.ok(head.max.y<box(b.cylinderTop).min.y,'piston emerges through cylinder cap');
   assert.ok(head.min.y>box(b.cylinderBase).max.y,'piston hits cylinder base');
   assert.ok(head.intersectsBox(box(b.pistonRod)),'piston rod detached from piston');
  }
  const center=b.pistonRod.getWorldPosition(new THREE.Vector3()),radius=Math.hypot(g.pistonRodHalfWidth,g.pistonRodDepth/2);
  for(const part of [b.guideA,b.cylinderTop,b.gland])openDisc(part,center,radius,new THREE.Vector3(0,1,0));
  openDisc(b.cylinderBody,center,.58,new THREE.Vector3(0,1,0));
  for(const part of [b.bearingHousing,b.bearingBore])openDisc(part,new THREE.Vector3(g.crankCenter.x,g.crankCenter.y,0),.13);
 }finally{disposeMovementModel(m);}
});

for(const id of [328,330])test(`${id}: full-stroke bounds and no ground/fog`,()=>{
 const m=make(id);try {
  assert.equal(m.root.userData.hideGround,true);
  m.root.traverse(o=>{for(const material of [].concat(o.material??[]))assert.equal(material.fog,false);});
  const g=m.root.userData.geometry,period=id===328?g.assemblyClosurePeriod:g.cyclePeriod;
  assert.ok(Number.isFinite(period)&&period>0);
  for(let i=0;i<=32;i++) {
   m.update(period*i/32);m.root.updateMatrixWorld(true);
   assert.ok(m.root.userData.cameraFitBounds.containsBox(box(m.root)));
  }
 }finally{disposeMovementModel(m);}
});
