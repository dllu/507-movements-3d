import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

test('013 and 014 ropes clear the rendered sheave flanges and the block plates throughout motion', () => {
  for (const id of [13, 14]) {
    const model = createMovementModel(catalog.movements[id - 1]);
    const blocks = model.root.userData.blocks;
    const pulleys = id === 13 ? [blocks.fixedPulley, blocks.movablePulley]
      : [...blocks.topPulleys, ...blocks.bottomPulleys];
    const cases = id === 13 ? [] : [blocks.topCase, blocks.bottomCase];
    for (let sample = 0; sample <= 29; sample += 1) {
      model.update(model.root.userData.animationTiming.authoredCyclePeriod * sample / 29, 0);
      model.root.updateMatrixWorld(true);
      const mesh = blocks.rope.userData.mesh;
      const positions = mesh.geometry.attributes.position;
      for (const pulley of pulleys) {
        const inverse = pulley.matrixWorld.clone().invert();
        const flanges = pulley.userData.rotor.children.filter((child) => child.geometry?.type === 'TorusGeometry');
        for (let index = 0; index < positions.count; index += 1) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
          for (const flange of flanges) {
            const { radius, tube } = flange.geometry.parameters;
            const gap = Math.hypot(Math.hypot(p.x, p.y) - radius, p.z - flange.position.z) - tube;
            assert.ok(gap > -1e-6, `${id}, phase ${sample}: rope/flange gap ${gap}`);
          }
          if (Math.abs(p.z) < pulley.userData.width / 2) {
            assert.ok(Math.hypot(p.x, p.y) >= pulley.userData.treadRadius - 0.0002,
              `${id}: rope clears the tread body`);
          }
        }
      }
      for (const casing of cases) {
        for (const plate of casing.userData.plates) {
          const inverse = plate.matrixWorld.clone().invert();
          plate.geometry.computeBoundingBox();
          const bounds = plate.geometry.boundingBox;
          const ellipse = plate.geometry.parameters.shapes.curves[0];
          for (let index = 0; index < positions.count; index += 1) {
            const p = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
            if (p.z < bounds.min.z || p.z > bounds.max.z) continue;
            assert.ok((p.x / ellipse.xRadius) ** 2 + (p.y / ellipse.yRadius) ** 2 > 1,
              'the fleeting rope remains outside the enclosing cheek plate');
          }
        }
      }
    }
  }
});

test('014 free effort leaf and reeved parts do not cross through each other', () => {
  const model = createMovementModel(catalog.movements[13]);
  for (let phase = 0; phase <= 16; phase += 1) {
    model.update(model.root.userData.animationTiming.authoredCyclePeriod * phase / 16, 0);
    const curve = model.root.userData.blocks.rope.userData.curve;
    const points = curve.getSpacedPoints(1200);
    const stepLength = curve.getLength() / 1200;
    const skip = Math.ceil(0.12 / stepLength);
    // Ignore neighboring sections of the same strand; all other sections
    // need the full diameter of room, including the final diagonal free end.
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + skip; j < points.length; j += 1) {
        assert.ok(points[i].distanceToSquared(points[j]) > (0.034 * 2) ** 2,
          `phase ${phase}: separate rope sections ${i}/${j} have finite clearance`);
      }
    }
  }
});

test('013 uses a smaller moving sheave and carries its pin, hanger, and cylindrical load as one assembly', () => {
  const model = createMovementModel(catalog.movements[12]);
  const b = model.root.userData.blocks;
  assert.ok(b.movablePulley.userData.radius < b.fixedPulley.userData.radius);
  assert.equal(b.weight.userData.body.geometry.type, 'CylinderGeometry');
  const loadOffset = b.weight.position.clone().sub(b.movablePulley.position);
  const hangerOrientation = b.movableHanger.quaternion.clone();
  for (let phase = 0; phase <= 29; phase += 1) {
    model.update(model.root.userData.animationTiming.authoredCyclePeriod * phase / 29, 0);
    assert.ok(b.movableHanger.position.distanceTo(b.movablePulley.position) < 1e-12);
    assert.ok(b.weight.position.clone().sub(b.movablePulley.position).distanceTo(loadOffset) < 1e-12);
    assert.ok(b.movableHanger.quaternion.angleTo(hangerOrientation) < 1e-12,
      'the sheave rotates inside its stationary hanger');
  }
});
