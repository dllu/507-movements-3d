import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {applyDisplayTiming} from '../src/simulation/display-timing.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfaceTriangles} from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements[187];

function withModel(run, entry = movement) {
  const model = createMovementModel(entry);
  try {return run(model);} finally {disposeObject3D(model.root);}
}
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${message}: expected ${expected} +/- ${tolerance}, received ${actual}`);
const worldXY = (object, local = new THREE.Vector3()) => {
  object.updateWorldMatrix(true, false);
  const p = local.clone().applyMatrix4(object.matrixWorld);
  return new THREE.Vector2(p.x, p.y);
};

test('188 catalog entry, authored contract and real-time display timing', () => {
  assert.equal(movement.id, 188);
  assert.equal(movement.title, 'Loop-Handle Pin-Cam Gab Disengaging Gear');
  assert.equal(movement.description, '187 and 188. Modifications of 186.');
  withModel((model) => {
    const d = model.root.userData;
    assert.equal(d.fidelity, 'authored');
    assert.equal(d.hideGround, true);
    assert.equal(d.geometry.cyclePeriod, 16);
    assert.equal(d.animationTiming.authoredCyclePeriod, 16);
    assert.equal(d.minimumDisplayCycleSeconds, 16);
    applyDisplayTiming(model, movement);
    near(d.animationTiming.displayCycleDuration, 16, 1e-9, 'display cycle plays in real time');
    assert.ok(d.rigidBodies.length === 4 && d.rigidBodies.every((b) => b.isObject3D));
    assert.ok(d.jointChecks.length >= 4);
    for (const [plateMesh, pin] of d.jointChecks) {
      assert.ok(plateMesh.isMesh);
      assert.equal(pin.geometry.type, 'CylinderGeometry');
    }
    // No undrawn frame, guide or carrier survives in the model.
    model.root.traverse((o) => assert.doesNotMatch(o.userData.role ?? '', /frame|guide|carrier/));
    for (const other of [187, 189]) withModel((m) => {
      assert.equal(m.root.userData.fidelity, 'authored');
      assert.notEqual(m.root.userData.mechanism, d.mechanism);
    }, catalog.movements[other - 1]);
  });
});

test('188 plate landmarks: pin, pivot, loop extents and step a sit where Brown draws them', () => {
  withModel((model) => {
    const d = model.root.userData, b = d.blocks, R = d.sourcePointFromRaster;
    model.update(0);
    model.root.updateMatrixWorld(true);
    assert.ok(worldXY(b.valvePin).distanceTo(R([394, 322])) < 1e-9, 'valve pin at the plate stud');
    assert.ok(worldXY(b.pivotPin).distanceTo(R([287, 288])) < 1e-9, 'pivot at the plate eye o');
    const box = new THREE.Box3().setFromObject(b.handleBody);
    const px = d.geometry.pixel;
    near(box.min.x, R([13, 0]).x, 4 * px, 'loop reaches the plate left edge');
    near(box.max.y, R([0, 74]).y, 4 * px, 'loop top at the plate');
    near(box.max.x, R([401, 0]).x, 4 * px, 'handle arm reaches the pin leg');
    const rod = new THREE.Box3().setFromObject(b.rodFront);
    // Brown's break at x 15 is a drawing convention: the rod runs on whole.
    near(rod.min.x, R([-300, 0]).x, 2 * px, 'rod runs on past Brown\'s break');
    near(rod.max.x, R([520, 0]).x, 2 * px, 'rod nose');
    near(rod.min.y, R([0, 335]).y, 1e-6, 'rod lower edge');
    // Step a: the leaf head ends exactly under the limb at the plate step.
    const leaf = d.leafPathAtAngle(0);
    assert.ok(leaf.end.distanceTo(R([223, 178])) < 1e-9);
    const leafBox = new THREE.Box3().setFromObject(b.leaf);
    near(leafBox.max.y, R([0, 178]).y, 2 * px, 'leaf top at a');
    near(leafBox.min.x, R([106, 0]).x, 8 * px, 'leaf foot under the clip block');
  });
});

test('188 cycle: running with the pin in the gab, stop, lift, held clear, lower, run again', () => {
  withModel((model) => {
    const S = model.root.userData.stateAtTime, g = model.root.userData.geometry;
    const stages = [];
    for (let t = 0; t < 16; t += 0.05) {
      const s = S(t);
      if (stages.at(-1) !== s.stage) stages.push(s.stage);
    }
    assert.deepEqual(stages, ['running', 'stopping', 'stopped', 'lifting-loop', 'held-by-leaf-at-a',
      'lowering-onto-pin', 'settled', 'starting', 'running']);
    const s0 = S(0);
    assert.equal(s0.stage, 'running');
    assert.equal(s0.rodX, 0);
    assert.equal(s0.handleAngle, 0);
    assert.ok(s0.pinInGab);
    // Running: two strokes of the eccentric each way of t = 0, at >= 2 s per turn.
    let turns = 0;
    for (let t = -4.4; t < 4.4; t += 0.01) if (S(t).rodX * S(t + 0.01).rodX < 0) turns += 0.5;
    assert.ok(turns >= 2.5, `eccentric turns ${turns}`);
    for (let t = -4.5; t <= 4.5; t += 0.05) {
      const s = S(t);
      assert.ok(Math.abs(s.rodX) <= g.stroke + 1e-12);
      assert.equal(s.pinX, s.rodX, 'pin driven with the rod while engaged');
      assert.equal(s.rodLift, 0);
    }
    const held = S(8.2);
    near(held.handleAngle, g.maximumHandleAngle, 1e-12, 'held at full swing');
    assert.ok(held.pinTopBelowRodBottom > 0.02, 'gab clear of the pin while held');
    assert.ok(g.maximumHandleAngle > 0.25 && g.maximumHandleAngle < 0.35, 'modest ~18 degree swing');
    // Each operator action lasts about two seconds.
    assert.ok(g.lift[1] - g.lift[0] >= 1.5 && g.lower[1] - g.lower[0] >= 1.5);
  });
});

test('188 contacts: toe touches the pin, gab captures then clears it, leaf head stays under step a', () => {
  withModel((model) => {
    const d = model.root.userData, b = d.blocks, g = d.geometry;
    for (let i = 0; i <= 160; i++) {
      const t = 16 * i / 160, s = model.update(t);
      model.root.updateMatrixWorld(true);
      near(s.toeGap, g.contactGap, 1e-9, `toe-pin gap at ${t}`);
      // World check of the toe/pin contact from rendered transforms.
      const pin = worldXY(b.valvePin);
      const toeLocal = d.sourcePointFromRaster([394, 322]).add(new THREE.Vector2(0, g.pinRadius + g.toeRadius + g.contactGap))
        .sub(d.sourcePointFromRaster(g.pivotRaster));
      const toe = worldXY(b.handleBody, new THREE.Vector3(toeLocal.x, toeLocal.y, 0));
      near(toe.distanceTo(pin), g.pinRadius + g.toeRadius + g.contactGap, 1e-6, `rendered toe contact at ${t}`);
      // Pivot pin coincides with the handle's rotation centre in both bodies.
      assert.ok(worldXY(b.pivotPin).distanceTo(worldXY(b.handleBody)) < 1e-9);
      // Gab: pin centred in the round-topped slot while running, clear when lifted.
      const gabCentre = worldXY(b.rodFront, new THREE.Vector3(0, 0, 0));
      if (s.pinInGab) assert.ok(gabCentre.distanceTo(pin) < 1e-9, `pin seated in gab at ${t}`);
      if (s.stage === 'held-by-leaf-at-a') assert.ok(s.pinTopBelowRodBottom >= 1.4 * g.pixel);
      // Leaf: constant length, tail hidden under the clip, head glued under the limb end.
      const leaf = d.leafPathAtAngle(s.handleAngle);
      near(leaf.tail + leaf.free, g.leafLength, 1e-12, 'leaf length conserved');
      const tailX = leaf.path[0].x;
      assert.ok(tailX >= d.sourcePointFromRaster([105, 0]).x && tailX <= d.sourcePointFromRaster([140, 0]).x);
      const head = d.sourcePointFromRaster([223, 178]).sub(d.sourcePointFromRaster(g.pivotRaster))
        .rotateAround(new THREE.Vector2(), -s.handleAngle).add(d.sourcePointFromRaster(g.pivotRaster));
      assert.ok(leaf.end.distanceTo(head) < 1e-12, 'leaf head carried at a');
    }
  });
});

test('188 pins never enter the rod, handle or lug solids through the cycle', () => {
  withModel((model) => {
    const d = model.root.userData;
    const checks = [...d.jointChecks, [d.blocks.lug, d.blocks.valvePin]]
      .map(([plateMesh, pin]) => ({plateMesh, pin, surface: solidSurface(plateMesh.geometry)}));
    for (let frame = 0; frame <= 32; frame++) {
      model.update(16 * frame / 32);
      model.root.updateMatrixWorld(true);
      for (const {plateMesh, pin, surface} of checks) {
        const transform = plateMesh.matrixWorld.clone().invert().multiply(pin.matrixWorld);
        const {radiusTop: radius, height} = pin.geometry.parameters;
        for (let axial = 0; axial <= 8; axial++) for (let k = 0; k < 32; k++) {
          const a = k * Math.PI / 16;
          const point = new THREE.Vector3(radius * Math.cos(a), height * (axial / 8 - 0.5), radius * Math.sin(a))
            .applyMatrix4(transform);
          assert.equal(surface.inside(point), false, `${pin.userData.role} in ${plateMesh.userData.role} at ${frame}`);
        }
      }
    }
  });
});

test('188 leaf head never penetrates the limb lug (touching with a small gap)', () => {
  withModel((model) => {
    const d = model.root.userData, lug = d.blocks.lug, leaf = d.blocks.leaf;
    const surface = solidSurface(lug.geometry), triangles = surfaceTriangles(lug.geometry);
    for (let frame = 0; frame <= 24; frame++) {
      model.update(16 * frame / 24);
      model.root.updateMatrixWorld(true);
      const toLug = lug.matrixWorld.clone().invert().multiply(leaf.matrixWorld);
      const p = leaf.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const q = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(toLug);
        assert.equal(surface.inside(q), false, `leaf vertex inside lug at ${frame}`);
      }
      const end = d.leafPathAtAngle(d.kinematics.handleAngle).end;
      const q = new THREE.Vector3(end.x, end.y, -0.52).applyMatrix4(toLug);
      const nearest = Math.min(...triangles.map((tri) => tri.closestPointToPoint(q, new THREE.Vector3()).distanceTo(q)));
      assert.ok(nearest > 0 && nearest < 0.004, `leaf head visibly meets the limb at ${frame} (${nearest})`);
    }
  });
});

test('188 motion is smooth (C1) and paced for reading', () => {
  withModel((model) => {
    const S = model.root.userData.stateAtTime, dt = 0.002;
    for (const key of ['rodX', 'rodLift', 'handleAngle']) {
      let maxSpeed = 0, maxAcc = 0;
      for (let t = 0; t < 16; t += dt) {
        const a = S(t - dt)[key], b = S(t)[key], c = S(t + dt)[key];
        maxSpeed = Math.max(maxSpeed, Math.abs(c - a) / (2 * dt));
        maxAcc = Math.max(maxAcc, Math.abs(c - 2 * b + a) / dt ** 2);
      }
      assert.ok(maxAcc < 2, `${key} acceleration bounded (${maxAcc})`);
      assert.ok(maxSpeed < 0.6, `${key} speed natural (${maxSpeed})`);
    }
  });
});
