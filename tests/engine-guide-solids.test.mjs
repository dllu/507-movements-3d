import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeMovementModel} from '../src/simulation/dispose-model.js';

const movements=JSON.parse(await readFile(new URL('../src/data/movements.json',import.meta.url))).movements;
const bounds=object=>new THREE.Box3().setFromObject(object,true);
function clearBore(object,center,radius,axis=new THREE.Vector3(0,0,1)) {
  assert.ok(Number.isFinite(radius)&&radius>0,'finite physical probe radius');
  for(let i=-1;i<24;i++) {
    const p=center.clone();
    if(i>=0) {
      p.x+=radius*Math.cos(i*Math.PI/12);
      p[axis.z?'y':'z']+=radius*Math.sin(i*Math.PI/12);
    }
    const ray=new THREE.Raycaster(p.addScaledVector(axis,-12),axis,0,24);
    assert.equal(ray.intersectObject(object,true).length,0,`${object.userData.role} blocks its bore at ${i}`);
  }
}

for(const id of [326,327])test(`${id}: real rod and bearing bores, clear shaft end and complete sweep bounds`,()=>{
  const m=createMovementModel(movements[id-1]);
  try {
    const {blocks:b,geometry:g,animationTiming}=m.root.userData;
    for(let i=0;i<=32;i++) {
      m.update(animationTiming.authoredCyclePeriod*i/32);m.root.updateMatrixWorld(true);
      for(const [pin,radius] of [[b.crankPinShaft,g.crankPinRadius],[b.wristPinShaft,g.wristPinRadius*.58]]) {
        clearBore(b.connectingRod,pin.getWorldPosition(new THREE.Vector3()),radius);
      }
      const shaftRadius=b.liveShaft.geometry.parameters.radiusTop;
      for(const part of [b.bearingHousing,b.bearingBore])clearBore(part,new THREE.Vector3(),shaftRadius);
      assert.ok(bounds(b.liveShaft).max.z<bounds(b.connectingRod).min.z,'shaft end enters swinging rod');
      const sweep=m.root.userData.sweptBounds??m.root.userData.cameraFitBounds;
      assert.ok(sweep.containsBox(bounds(m.root)),'full stroke outside swept bounds');
    }
    assert.equal(m.root.userData.hideGround,true);
    m.root.traverse(o=>{for(const material of [].concat(o.material??[]))assert.equal(material.fog,false);});
  } finally {disposeMovementModel(m);}
});

test('326: translating piston rod clears the standard and its deep foot',()=>{
  const m=createMovementModel(movements[325]);
  try {
    const {blocks:b,geometry:g,animationTiming}=m.root.userData;m.root.updateMatrixWorld(true);
    // The rod runs down inside the hollow standard, into the foot's bore.
    assert.ok(bounds(b.pistonRod).min.z>bounds(b.framePlate).max.z);
    assert.ok(bounds(b.pistonRod).max.z<bounds(b.standardFrontSkin).min.z);
    for(let i=0;i<=32;i++) {
      m.update(animationTiming.authoredCyclePeriod*i/32);m.root.updateMatrixWorld(true);
      assert.ok(bounds(b.pistonRod).min.y>bounds(b.foundationSole).max.y-1e-9,'rod end stays inside the foot bore');
      assert.ok(bounds(b.pistonRod).min.z>bounds(b.flywheelRim).max.z,'rod clears the flywheel');
    }
    m.update(0);m.root.updateMatrixWorld(true);
    assert.ok(bounds(b.pistonRod).intersectsBox(bounds(b.slideBridge)),'piston rod must join slide');
    assert.equal(b.lowerSlideBridge,undefined,'no rear bridge behind the standard');
    for(const [shoe,face] of [[b.leftSlideShoe,b.leftPlanedFace],[b.rightSlideShoe,b.rightPlanedFace]]) {
      assert.ok(bounds(shoe.userData.frontCheek).min.z>bounds(face).max.z);
    }
    assert.equal(b.guideOutline,undefined,'no decorative ink outline around the real slot');
  }finally{disposeMovementModel(m);}
});

test('327: actual roller envelope touches each guide without penetrating it or its crosshead',()=>{
 const m=createMovementModel(movements[326]);
 try {
  const {blocks:b,geometry:g,animationTiming}=m.root.userData;
  for(let i=0;i<=32;i++) {
   m.update(animationTiming.authoredCyclePeriod*i/32);m.root.updateMatrixWorld(true);
   for(const [roller,guide,side] of [[b.leftRoller,b.leftGuideBarA,-1],[b.rightRoller,b.rightGuideBarA,1]]) {
    const r=bounds(roller),f=bounds(guide.userData.contactFace),bar=bounds(b.crossheadBar);
    const gap=side<0?r.min.x-f.max.x:f.min.x-r.max.x;
    assert.ok(gap>=-1e-6&&gap<.00025,`roller/guide gap ${gap}`);
    assert.ok(r.max.z<bar.min.z,'roller intersects crosshead bar');
    assert.ok(f.min.z<g.rollerPlaneZ&&f.max.z>g.rollerPlaneZ,'guide misses actual rolling plane');
    clearBore(roller,roller.getWorldPosition(new THREE.Vector3()),.50*g.sourceScale);
   }
  }
 } finally {disposeMovementModel(m);}
});

test('327: cylinder and gland have a passage aligned to the moving piston rod',()=>{
 const m=createMovementModel(movements[326]);
 try {
  const {blocks:b}=m.root.userData;m.root.updateMatrixWorld(true);
  const p=b.pistonRod.getWorldPosition(new THREE.Vector3()),box=bounds(b.pistonRod);
  // p104: the rod is round; probe its true radius (the half-diagonal of its
  // box would overstate it by sqrt 2).
  const radius=b.pistonRod.geometry.parameters.radiusTop??Math.hypot((box.max.x-box.min.x)/2,(box.max.z-box.min.z)/2);
  assert.ok(b.pistonRod.geometry.type==='CylinderGeometry','327 piston rod is round');
  // p109: the bore is closed below the rod's reach by a bottom end plug;
  // the passage above it must stay clear.
  const plug=b.cylinderBody.children.find(o=>o.userData.role==='fixed-engine-cylinder-bottom-end-plug');
  assert.ok(plug,'cylinder bottom closed by an end plug');
  plug.removeFromParent();
  for(const part of [b.cylinderBody,b.cylinderTopCap,b.gland])clearBore(part,p,radius,new THREE.Vector3(0,1,0));
  b.cylinderBody.add(plug);m.root.updateMatrixWorld(true);
  const period=m.root.userData.animationTiming.authoredCyclePeriod;let rodLow=Infinity;
  for(let i=0;i<=64;i++){m.update(period*i/64);m.root.updateMatrixWorld(true);rodLow=Math.min(rodLow,bounds(b.pistonRod).min.y);}
  const plugBox=bounds(plug);
  assert.ok(plugBox.max.y<rodLow-0.02,`rod stops clear above the plug (${plugBox.max.y} < ${rodLow})`);
  assert.ok(Math.abs(plugBox.min.y-bounds(b.cylinderBody).min.y)<1e-6,`plug flush with the cylinder bottom (${plugBox.min.y}, ${bounds(b.cylinderBody).min.y})`);
 }finally{disposeMovementModel(m);}
});
