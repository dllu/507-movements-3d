import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const makeModel = () => createMovementModel(catalog.movements[22]);

test('023 actual belt and suspension surfaces clear the solid sheaves and their flanges', () => {
  const model = makeModel();
  const b = model.root.userData.blocks;
  const pulleys = [b.driver, b.movable, b.compensatorRear, b.compensatorFront, ...b.guides];
  for (let sample = 0; sample <= 31; sample += 1) {
    model.update(model.root.userData.animationTiming.authoredCyclePeriod * sample / 31, 0);
    model.root.updateMatrixWorld(true);
    for (const rope of [b.belt, b.suspension]) {
      const mesh = rope.userData.mesh;
      const positions = mesh.geometry.attributes.position;
      for (const pulley of pulleys) {
        const inverse = pulley.matrixWorld.clone().invert();
        const rims = pulley.userData.rotor.children.filter((part) => part.geometry?.type === 'TorusGeometry');
        for (let index = 0; index < positions.count; index += 1) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
          if (Math.abs(p.z) < pulley.userData.width / 2) {
            assert.ok(Math.hypot(p.x, p.y) >= pulley.userData.treadRadius - 2e-6, 'the rope stays outside the drum');
          }
          for (const rim of rims) {
            const { radius, tube } = rim.geometry.parameters;
            assert.ok(Math.hypot(Math.hypot(p.x, p.y) - radius, p.z - rim.position.z) - tube > -2e-6,
              'the rope clears the sheave flange');
          }
        }
      }
    }
  }
});

test('023 circular idlers follow material travel and helical tracking has bounded circumferential slip', () => {
  const model = makeModel();
  const b = model.root.userData.blocks;
  const delta = 1e-4;
  for (const time of [0.3, 1.5, 2.7, 5.3, 8.1, 10.9]) {
    const contacts = [[b.compensatorRear, 1], [b.movable, 3], [b.compensatorFront, 5], [b.driver, 7]];
    for (const [pulley, index, fraction] of contacts.flatMap(([pulley, index]) =>
      [0.15, 0.5, 0.85].map((fraction) => [pulley, index, fraction]))) {
      model.update(time, 0);
      model.root.updateMatrixWorld(true);
      const curve = b.belt.userData.curve;
      const arc = curve.curves[index];
      const material = curve.curves.slice(0, index).reduce((sum, part) => sum + part.getLength(), 0)
        + arc.getLength() * fraction;
      const local = pulley.userData.rotor.worldToLocal(arc.getPoint(fraction));
      const speed = model.root.userData.kinematics.beltSpeed;
      const sample = (at) => {
        model.update(at, 0);
        model.root.updateMatrixWorld(true);
        const path = b.belt.userData.curve;
        return { rope: path.getPoint((material + (at - time) * speed) / path.getLength()),
          wheel: pulley.userData.rotor.localToWorld(local.clone()) };
      };
      const before = sample(time - delta);
      const after = sample(time + delta);
      const residual = after.rope.sub(before.rope).sub(after.wheel.sub(before.wheel)).multiplyScalar(1 / (2 * delta));
      if (!arc.axialTravel) assert.ok(residual.length() < 2e-6, 'the circular idler contacts do not slip');
      else {
        assert.ok(Math.hypot(residual.x, residual.y) < speed * 0.001,
          'changing helix pitch keeps circumferential mismatch below 0.1% of belt speed');
        assert.ok(Math.abs(residual.z) > 0.02, 'the helical crossover is explicitly an axial-sliding approximation');
      }
    }
  }
});
