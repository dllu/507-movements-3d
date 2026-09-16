import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeMovementModel} from '../src/simulation/dispose-model.js';
import {readFile} from 'node:fs/promises';
const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url))).movements;

function clearColumn(mesh, localPoint, axis, radius) {
  const center = localPoint.clone().applyMatrix4(mesh.matrixWorld);
  const [a, b] = axis.x ? [new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1)]
    : [new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,1)];
  for (let i=0;i<12;i++) {
    const point = center.clone().addScaledVector(a, radius*Math.cos(i*Math.PI/6))
      .addScaledVector(b, radius*Math.sin(i*Math.PI/6));
    const ray = new THREE.Raycaster(point.addScaledVector(axis,-2), axis, 0, 4);
    assert.equal(ray.intersectObject(mesh,false).length,0,`${mesh.userData.role ?? 'part'} blocks a pin`);
  }
}

for (const id of [324,325]) test(`${id} arm eyes and fixed ruler bores clear actual pins`, () => {
  const model=createMovementModel(catalog[id-1]);
  try {
    const {blocks:b,geometry:g}=model.root.userData;
    const arms=id===324?[b.armUpperFixedToLowerSlider,b.armLowerFixedToUpperSlider]:[b.leftArmC,b.rightArmC];
    for(let i=0;i<=16;i++) {
      model.update(g.demonstrationPeriod*i/16);model.root.updateMatrixWorld(true);
      for(const arm of arms) for(const x of arm.userData.boreCenters) clearColumn(arm,new THREE.Vector3(x,0,0),new THREE.Vector3(0,1,0),.078);
      const rulers=id===324?[[b.upperRulerA,[g.fixedPivotX]],[b.lowerRulerA,[g.fixedPivotX]]]
        :[[b.upperRulerA,[g.upperLeftPivotOffsetX,g.upperRightPivotOffsetX]],[b.lowerRulerB,[g.lowerLeftPivotOffsetX,g.lowerRightPivotOffsetX]]];
      for(const [ruler,xs] of rulers) for(const x of xs) clearColumn(ruler.userData.body,new THREE.Vector3(x,0,0),new THREE.Vector3(0,1,0),.075);
    }
  } finally {disposeMovementModel(model);}
});

test('323 wheel/hub bores and journal bores clear the common axle; treads stay above the contact plane',()=>{
 const model=createMovementModel(catalog[322]);
 try {
  const {blocks:b,geometry:g}=model.root.userData;
  for(let i=0;i<=16;i++) {
   model.update(g.cyclePeriod*i/16);model.root.updateMatrixWorld(true);
   for(const wheel of [b.wheelALeft,b.wheelARight]) {
    for(const mesh of [wheel.userData.body,wheel.userData.hub])clearColumn(mesh,new THREE.Vector3(),new THREE.Vector3(1,0,0),g.axleRadius);
    const bounds=new THREE.Box3().setFromObject(wheel,true);
    assert.ok(bounds.min.y >= g.paperTopY-1e-6,`wheel penetrates nominal paper at ${i}`);
   }
   for(const housing of b.bearingHousings) for(const part of housing.children.filter(o=>o.userData.role==='fixed-axle-C-journal-bearing-on-ruler-B'))clearColumn(part,new THREE.Vector3(0,g.wheelCenterY,0),new THREE.Vector3(1,0,0),g.axleRadius);
  }
 } finally {disposeMovementModel(model);}
});

for(const id of [322,323,324,325])test(`${id} has source-facing plan orientation and no ground, paper decoration or fog`,()=>{
 const model=createMovementModel(catalog[id-1]);
 try {
  assert.equal(model.root.userData.hideGround,true);
  assert.equal(model.root.scale.z,-1);
  assert.equal(model.root.userData.blocks.paper.parent,null);
  model.root.traverse(o=>{for(const material of [o.material].flat().filter(Boolean))assert.equal(material.fog,false);});
  const period=model.root.userData.animationTiming.authoredCyclePeriod;
  for(let i=0;i<=16;i++) {
   model.update(period*i/16);model.root.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(model.root,true);
   assert.ok(model.root.userData.cameraFitBounds.containsBox(bounds),`pose${i} clipped`);
  }
 } finally{disposeMovementModel(model);}
});
