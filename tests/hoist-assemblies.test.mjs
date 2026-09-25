import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const makeModel = (id) => createMovementModel(catalog.movements[id - 1]);

const ropesByName = (id, model) => id === 16 ? {
  primary: model.root.userData.ropes.hauling, secondary: model.root.userData.ropes.interblock,
} : model.root.userData.ropes;

for (const id of [16, 17, 18, 19, 20, 21, 22]) {
  test(`${id} separate rope strands retain their full diameter of clearance`, () => {
    const model = makeModel(id);
    const diameter = 0.064;
    for (let phase = 0; phase <= 16; phase += 1) {
      model.update(model.root.userData.animationTiming.authoredCyclePeriod * phase / 16, 0);
      const strands = Object.values(model.root.userData.ropes).map((rope) => {
        const curve = rope.userData.curve;
        const count = Math.ceil(curve.getLength() / 0.01);
        return { points: curve.getSpacedPoints(count), step: curve.getLength() / count };
      });
      for (let a = 0; a < strands.length; a += 1) {
        for (let b = a; b < strands.length; b += 1) {
          for (let i = 0; i < strands[a].points.length; i += 1) {
            const first = a === b ? i + Math.ceil(0.12 / strands[a].step) : 0;
            for (let j = first; j < strands[b].points.length; j += 1) {
              assert.ok(strands[a].points[i].distanceToSquared(strands[b].points[j]) > diameter ** 2,
                `phase ${phase}, strands ${a}/${b}, samples ${i}/${j}: rope surfaces clear`);
            }
          }
        }
      }
    }
  });

  test(`${id} actual rope surfaces clear the sheave bodies, flanges, and stirrup bars`, () => {
    const model = makeModel(id);
    const pulleys = Object.values(model.root.userData.pulleys);
    const ropes = Object.values(model.root.userData.ropes);
    const bars = [];
    for (const pulley of pulleys) pulley.userData.frame.traverse((part) => {
      if (part.geometry?.type === 'BoxGeometry') bars.push(part);
    });
    for (let sample = 0; sample <= 31; sample += 1) {
      model.update(model.root.userData.animationTiming.authoredCyclePeriod * sample / 31, 0);
      model.root.updateMatrixWorld(true);
      for (const rope of ropes) {
        const mesh = rope.userData.mesh;
        const positions = mesh.geometry.attributes.position;
        for (const pulley of pulleys) {
          const inverse = pulley.matrixWorld.clone().invert();
          // Retired ink tread-edge rings are hidden placeholders, not flanges.
          const flanges = pulley.userData.rotor.children.filter((part) => part.visible
            && part.geometry?.type === 'TorusGeometry');
          for (let i = 0; i < positions.count; i += 1) {
            const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
            if (Math.abs(point.z) < pulley.userData.width / 2) {
              assert.ok(Math.hypot(point.x, point.y) >= pulley.userData.treadRadius - 1e-6,
                'the rope stays outside the solid drum');
            }
            for (const flange of flanges) {
              const { radius, tube } = flange.geometry.parameters;
              const gap = Math.hypot(Math.hypot(point.x, point.y) - radius, point.z - flange.position.z) - tube;
              assert.ok(gap > 0.04, 'the former axial flange penetration is removed');
            }
          }
        }
        for (const bar of bars) {
          const inverse = bar.matrixWorld.clone().invert();
          const { width, height, depth } = bar.geometry.parameters;
          for (let i = 0; i < positions.count; i += 1) {
            const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
            assert.ok(Math.abs(point.x) >= width / 2 || Math.abs(point.y) >= height / 2 || Math.abs(point.z) >= depth / 2,
              'the rope clears the rigid stirrup bars');
          }
        }
      }
      for (const [name, definition] of Object.entries(model.root.userData.contactDefinitions)) {
        const arc = ropesByName(id, model)[definition.rope].userData.curve.curves[definition.index];
        const pulley = model.root.userData.pulleys[name];
        assert.ok(arc.center.distanceTo(pulley.getWorldPosition(new THREE.Vector3())) < 1e-12,
          'the rope wrap is centered on its actual sheave');
        assert.ok(Math.abs(arc.radialStart.length() - pulley.userData.treadRadius - 0.032) < 1e-12,
          'the neutral rope radius seats on the actual tread');
      }
    }
  });

  test(`${id} rendered wheel rotation follows the material rope without slip`, () => {
    const model = makeModel(id);
    const delta = 1e-4;
    const ropes = ropesByName(id, model);
    for (const time of [0.3, 1.5, 2.7, 5.3, 8.1, 10.9]) {
      for (const [name, definition] of Object.entries(model.root.userData.contactDefinitions)) {
        model.update(time, 0);
        model.root.updateMatrixWorld(true);
        const rotor = model.root.userData.pulleys[name].userData.rotor;
        const curve = ropes[definition.rope].userData.curve;
        const arc = curve.curves[definition.index];
        const materialDistance = curve.curves.slice(0, definition.index).reduce((sum, part) => sum + part.getLength(), 0)
          + arc.getLength() * 0.45;
        const localContact = rotor.worldToLocal(arc.getPoint(0.45));
        const sample = (at) => {
          model.update(at, 0);
          model.root.updateMatrixWorld(true);
          const path = ropes[definition.rope].userData.curve;
          return { rope: path.getPoint(materialDistance / path.getLength()),
            wheel: rotor.localToWorld(localContact.clone()) };
        };
        const before = sample(time - delta);
        const after = sample(time + delta);
        const ropeVelocity = after.rope.sub(before.rope).multiplyScalar(1 / (2 * delta));
        const wheelVelocity = after.wheel.sub(before.wheel).multiplyScalar(1 / (2 * delta));
        assert.ok(ropeVelocity.distanceTo(wheelVelocity) < 2e-6,
          `${name}: independently sampled material and surface velocities agree`);
      }
    }
  });
}

test('017 uses actual rope force components and satisfies virtual work at its angled hauling end', () => {
  const model = makeModel(17);
  for (const time of [0.3, 1.5, 2.7, 5.3, 8.1, 10.9]) {
    model.update(time, 0);
    const state = model.root.userData.kinematics;
    const carrierArc = model.root.userData.contacts.carrierArc;
    const supportOverEffort = carrierArc.getTangent(0).y - carrierArc.getTangent(1).y;
    const loadOverEffort = supportOverEffort * 2 + carrierArc.getTangent(0).y;
    assert.ok(Math.abs(loadOverEffort * state.effortForceOverLoad - 1) < 1e-6);
    assert.ok(Math.abs(state.effortForceOverLoad * state.haulSpeed - state.loadSpeed) < 1e-9);
    assert.ok(state.carrierAngularSpeed !== -3 * state.loadSpeed / state.carrierRadius,
      'the old parallel-rope angular approximation is no longer imposed');
  }
});

for (const id of [19, 20, 21]) {
  test(`${id} actual endpoint motion satisfies virtual work using forces from the rendered rope directions`, () => {
    const model = makeModel(id);
    const paired = id === 19;
    const delta = 1e-4;
    for (const time of [0.3, 1.5, 2.7, 5.3, 8.1, 10.9]) {
      model.update(time, 0);
      let tension = 1;
      let supportedLoad = 0;
      for (const contact of model.root.userData.contacts) {
        supportedLoad += (paired ? 2 : 1) * tension;
        const arc = contact.upperArc;
        tension *= arc.getTangent(0).y - arc.getTangent(1).y + (paired ? 1 : 0);
      }
      const effortDirection = model.root.userData.ropes[0].userData.curve.curves.at(-1).getTangent(1);
      const sample = (at) => {
        model.update(at, 0);
        return { effort: model.root.userData.ropes[0].userData.curve.getPoint(1),
          loadY: model.root.userData.blocks.load.position.y };
      };
      const before = sample(time - delta);
      const after = sample(time + delta);
      const inputPower = after.effort.sub(before.effort).dot(effortDirection) / (2 * delta * supportedLoad);
      const outputPower = (after.loadY - before.loadY) / (2 * delta);
      assert.ok(Math.abs(inputPower - outputPower) < 1e-8,
        'the independently differentiated rendered motion conserves work for a unit load');
    }
  });
}
