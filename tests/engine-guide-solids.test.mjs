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
      assert.ok(m.root.userData.cameraFitBounds.containsBox(bounds(m.root)),'full stroke outside camera bounds');
    }
    assert.equal(m.root.userData.hideGround,true);
    m.root.traverse(o=>{for(const material of [].concat(o.material??[]))assert.equal(material.fog,false);});
  } finally {disposeMovementModel(m);}
});

test('326: translating piston rod clears the standard and its deep foot',()=>{
  const m=createMovementModel(movements[325]);
  try {
    const {blocks:b}=m.root.userData;m.root.updateMatrixWorld(true);
    for(const fixed of [b.framePlate,b.foundationFoot])assert.ok(bounds(b.pistonRod).min.z>bounds(fixed).max.z);
    assert.ok(bounds(b.pistonRod).intersectsBox(bounds(b.lowerSlideBridge)),'piston rod must join slide');
    for(const shoe of [b.leftSlideShoe,b.rightSlideShoe])assert.ok(bounds(shoe).intersectsBox(bounds(b.lowerSlideBridge)),'lower bridge joins both shoes');
    for(const [shoe,face] of [[b.leftSlideShoe,b.leftPlanedFace],[b.rightSlideShoe,b.rightPlanedFace]]) {
      assert.ok(bounds(shoe.userData.frontCheek).min.z>bounds(face).max.z);
    }
    assert.equal(b.guideOutline.isLineLoop,true,'decorative tube must not protrude into shoes');
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
  const radius=Math.hypot((box.max.x-box.min.x)/2,(box.max.z-box.min.z)/2);
  for(const part of [b.cylinderBody,b.cylinderTopCap,b.gland])clearBore(part,p,radius,new THREE.Vector3(0,1,0));
 }finally{disposeMovementModel(m);}
});
