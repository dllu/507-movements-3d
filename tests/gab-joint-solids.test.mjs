import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredGabDisengagerMovement} from '../src/simulation/authored-gab-disengagers.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface} from './helpers/solid-surface.mjs';

for (const id of [186, 187, 188, 189]) test(`${id}: rendered joint plates clear their actual shafts and pins throughout playback`, () => {
  const model = createAuthoredGabDisengagerMovement({id});
  const b = model.root.userData.blocks;
  const pairs = id === 188 ? [[b.valvePinBoss, b.valvePin], [b.valveCarrierWeb, b.valvePin]] : [
    [b.valveArm, b.valveShaft], [b.valveArm, b.valvePin], [b.valveShaftFace, b.valveShaft],
  ];
  if (id === 189) pairs.push(
    [b.hangerLink, b.crankPin], [b.hangerLink, b.rodHangerPin],
    [b.operatingHandleStem, b.operatingPivotPin],
    [b.operatingCrankArm, b.operatingPivotPin], [b.operatingCrankArm, b.crankPin],
    [b.operatingPivotFace, b.operatingPivotPin], [b.rodHangerBoss, b.rodHangerPin],
    [b.rodRightTail, b.rodHangerPin], [b.frameValveBearing, b.valveShaft],
    [b.frameOperatingBearing, b.operatingPivotPin],
  );
  const checks = pairs.map(([plate, pin]) => ({plate, pin, surface: solidSurface(plate.geometry)}));
  try {
    assert.equal(model.root.userData.hideGround, true);
    model.root.traverse(object => {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material) assert.equal(material.fog, false);
      }
    });
    for (let frame = 0; frame <= 32; frame++) {
      model.update(model.root.userData.geometry.cyclePeriod * frame / 32);
      model.root.updateMatrixWorld(true);
      for (const {plate, pin, surface} of checks) {
        const transform = plate.matrixWorld.clone().invert().multiply(pin.matrixWorld);
        const {radiusTop: radius, height} = pin.geometry.parameters;
        for (let axial = 0; axial <= 8; axial++) for (let angle = 0; angle < 32; angle++) {
          const theta = angle * Math.PI / 16;
          const point = new THREE.Vector3(radius * Math.cos(theta),
            height * (axial / 8 - .5), radius * Math.sin(theta)).applyMatrix4(transform);
          assert.equal(surface.inside(point), false,
            `${id}: ${pin.userData.role} penetrates ${plate.userData.role} at frame ${frame}`);
        }
      }
    }
  } finally {disposeObject3D(model.root);}
});
