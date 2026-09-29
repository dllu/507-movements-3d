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
    // No undrawn guide or carrier in the plate's view: the valve arm, the
    // eccentric and the plain frame carrying both shafts stand below or past
    // the view (off the framed bounds).
    model.root.traverse((o) => assert.doesNotMatch(o.userData.role ?? '', /guide|carrier/));
    d.blocks.frame.traverse((o) => { if (o.isMesh) assert.equal(o.userData.runsPastCrop, true); });
    model.update(0); model.root.updateMatrixWorld(true);
    assert.ok(d.blocks.valveArm.position.y < d.cameraFitBounds.min.y - 1.5, 'rockshaft below the view');
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
    // Notch a is cut into the limb itself (pass 92): the handle's single
    // extrusion carries the ledge at Brown's step, and the leaf ends behind
    // the diagonal, set in the head's hidden tab.
    const leaf = d.leafPathAtAngle(0);
    assert.ok(leaf.end.distanceTo(R([216, 231])) < 1e-9);
    const leafBox = new THREE.Box3().setFromObject(b.leaf);
    assert.ok(leafBox.max.y < R([0, 222]).y, 'leaf stays below the notch, behind the diagonal');
    near(leafBox.min.x, R([106, 0]).x, 8 * px, 'leaf foot under the clip block');
    const pos = b.handleBody.geometry.attributes.position;
    const handleInverse = b.handleBody.matrixWorld.clone().invert();
    const ledge = [R([206, 177.5]), R([218, 177.5])].map((p) => new THREE.Vector3(p.x, p.y, 0).applyMatrix4(handleInverse));
    let ledgeVertices = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - ledge[0].y) < 1e-6 && pos.getX(i) > ledge[0].x - 3 * px && pos.getX(i) < ledge[1].x + 3 * px) ledgeVertices++;
    }
    assert.ok(ledgeVertices >= 4, 'notch a ledge is an edge of the handle extrusion');
    assert.equal(d.blocks.lug, undefined, 'no separate lug at a');
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
    // Running: one whole turn of the eccentric each way of t = 0 (so it stops
    // where it started, its sheave on top), at >= 2 s per turn.
    let turns = 0;
    for (let t = -4.4; t < 4.4; t += 0.01) if (S(t).rodX * S(t + 0.01).rodX < 0) turns += 0.5;
    assert.ok(turns >= 1.5, `eccentric turns ${turns}`);
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

test('188 contacts: toe touches the pin, gab captures then clears it, leaf end carried by the head', () => {
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
      // Leaf: constant length, tail hidden under the clip, end carried by the head's tab.
      const leaf = d.leafPathAtAngle(s.handleAngle);
      near(leaf.tail + leaf.free, g.leafLength, 1e-12, 'leaf length conserved');
      const tailX = leaf.path[0].x;
      assert.ok(tailX >= d.sourcePointFromRaster([105, 0]).x && tailX <= d.sourcePointFromRaster([140, 0]).x);
      const head = d.sourcePointFromRaster([216, 231]).sub(d.sourcePointFromRaster(g.pivotRaster))
        .rotateAround(new THREE.Vector2(), -s.handleAngle).add(d.sourcePointFromRaster(g.pivotRaster));
      assert.ok(leaf.end.distanceTo(head) < 1e-12, 'leaf end carried by the head');
    }
  });
});

test('188 pins never enter the rod, handle or tab solids through the cycle', () => {
  withModel((model) => {
    const d = model.root.userData;
    const checks = [...d.jointChecks, [d.blocks.tab, d.blocks.valvePin]]
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

test('188 leaf end is set in the head tab, hidden behind the diagonal', () => {
  withModel((model) => {
    const d = model.root.userData, {tab, leaf, handleBody} = d.blocks;
    const surface = solidSurface(tab.geometry), handleSurface = solidSurface(handleBody.geometry);
    for (let frame = 0; frame <= 24; frame++) {
      model.update(16 * frame / 24);
      model.root.updateMatrixWorld(true);
      const end = d.leafPathAtAngle(d.kinematics.handleAngle).end;
      const toTab = tab.matrixWorld.clone().invert().multiply(leaf.matrixWorld);
      assert.ok(surface.inside(new THREE.Vector3(end.x, end.y, -0.52).applyMatrix4(toTab)), `leaf end in the tab at ${frame}`);
      // The tab lies wholly behind the handle's front extrusion (hidden from the front).
      const toHandle = handleBody.matrixWorld.clone().invert().multiply(tab.matrixWorld);
      const p = tab.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const q = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(toHandle);
        q.z = -0.28;
        assert.ok(handleSurface.inside(q) || handleSurface.distance(q) < 1e-6, `tab shows past the handle outline at ${frame}`);
      }
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

test('p96: movement 188 rod crown and handle outlines are finely sampled smooth curves', () => {
  const model = createMovementModel(movement);
  const find = (role) => { let hit = null; model.root.traverse((o) => { if (o.userData.role === role) hit = o; }); return hit; };
  for (const role of ['eccentric-rod-with-crown-open-bottom-gab-and-tail', 'loop-handle-hub-diagonal-loop-limb-notched-head-and-pin-toe-arm']) {
    const mesh = find(role);
    const position = mesh.geometry.attributes.position;
    // Front-face outline points: consecutive boundary turns along the crown
    // stay small when the curve is sampled finely.
    const pts = new Map();
    let zMax = -Infinity;
    for (let i = 0; i < position.count; i += 1) zMax = Math.max(zMax, position.getZ(i));
    for (let i = 0; i < position.count; i += 1) {
      if (Math.abs(position.getZ(i) - zMax) > 1e-6) continue;
      pts.set(`${position.getX(i).toFixed(5)},${position.getY(i).toFixed(5)}`, true);
    }
    assert.ok(pts.size > 300, `${role} outline has ${pts.size} points`);
  }
  disposeObject3D(model.root);
});

test('p101: movement 188 rear web has the rod\'s exact height and fairs into its back face', () => {
  const model = createMovementModel(movement);
  const find = (role) => { let hit = null; model.root.traverse((o) => { if (o.userData.role === role) hit = o; }); return hit; };
  const rod = find('eccentric-rod-with-crown-open-bottom-gab-and-tail');
  const web = find('eccentric-rod-rear-web-carrying-leaf-clip');
  model.root.updateMatrixWorld(true);
  const rodBox = new THREE.Box3().setFromObject(rod), webBox = new THREE.Box3().setFromObject(web);
  // Bottom and top of the plain bar: the web spans exactly the rod's section.
  assert.ok(Math.abs(webBox.min.y - rodBox.min.y) < 1e-6, 'web bottom flush with rod bottom');
  const position = rod.geometry.attributes.position;
  let barTop = -Infinity;
  for (let i = 0; i < position.count; i += 1) if (position.getX(i) < webBox.max.x - 1) barTop = Math.max(barTop, position.getY(i));
  assert.ok(Math.abs(webBox.max.y - (barTop + rod.position.y)) < 1e-6, 'web top flush with the bar top');
  assert.ok(Math.abs(webBox.max.z - rodBox.min.z) < 1e-6, 'web front meets the rod back face');
  // The fairing: near the web's right end its depth tapers to zero.
  const wp = web.geometry.attributes.position;
  let endDepth = Infinity;
  for (let i = 0; i < wp.count; i += 1) if (wp.getX(i) > webBox.max.x - 1e-4) endDepth = Math.min(endDepth, wp.getZ(i));
  assert.ok(Math.abs(endDepth - webBox.max.z) < 1e-6, 'web ends tangent to the rod back face, not in a step');
  disposeObject3D(model.root);
});
