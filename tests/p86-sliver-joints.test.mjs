// Pass 86 (lane 8): joints the sliver screen found barely touching are now
// solid: sunk roots, bored lugs, pins and sealed pipe ends.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredHorizontalOvershotWaterWheelMovement} from '../src/simulation/authored-horizontal-overshot-water-wheels.js';
import {createAuthoredForcePumpMovement} from '../src/simulation/authored-force-pumps.js';
import {createAuthoredDiaphragmPumpMovement} from '../src/simulation/authored-diaphragm-pumps.js';
import {createAuthoredOldRotaryPumpMovement} from '../src/simulation/authored-old-rotary-pumps.js';
import {createAuthoredReciprocatingWellLiftMovement} from '../src/simulation/authored-reciprocating-well-lifts.js';
import {createAuthoredDiaphragmPressureGaugeMovement} from '../src/simulation/authored-diaphragm-pressure-gauges.js';

const byRole = (root, test) => {
  const found = [];
  root.traverse((o) => { if (typeof o.userData.role === 'string' && test(o.userData.role)) found.push(o); });
  return found;
};
const pointsIn = (mesh, frame) => {
  mesh.updateWorldMatrix(true, false); frame.updateWorldMatrix(true, false);
  const m = frame.matrixWorld.clone().invert().multiply(mesh.matrixWorld), p = mesh.geometry.attributes.position, out = [];
  for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m));
  return out;
};

test('433: every pitched board root is sunk inside the hub', () => {
  const m = createAuthoredHorizontalOvershotWaterWheelMovement({id: 433});
  m.update(0);
  const [hub] = byRole(m.root, (r) => r === 'horizontal-wheel-hub-fast-on-vertical-shaft');
  hub.geometry.computeBoundingBox();
  const box = hub.geometry.boundingBox, radius = box.max.x, low = box.min.y, high = box.max.y;
  const boards = byRole(m.root, (r) => r.startsWith('radial-floor-of-horizontal-scoop-'));
  assert.equal(boards.length, 16);
  for (const board of boards) {
    const points = pointsIn(board, hub);
    assert.ok(Math.min(...points.map((p) => Math.hypot(p.x, p.z))) < radius - 0.15, 'root reaches 0.15 into the hub');
    // Where the board is inside the hub radius, the hub encloses it top to bottom.
    for (const p of points) if (Math.hypot(p.x, p.z) < radius) assert.ok(p.y >= low - 1e-6 && p.y <= high + 1e-6, `board inside hub at y ${p.y}`);
  }
});

test('451: the outlet pipe end is a saddle seated in the neck wall', () => {
  const m = createAuthoredForcePumpMovement({id: 451});
  m.update(0);
  const [neck] = byRole(m.root, (r) => r === 'fixed-air-chamber-inlet-neck');
  const [outlet] = byRole(m.root, (r) => r === 'selected-side-outlet-from-air-chamber');
  const axisX = neck.getWorldPosition(new THREE.Vector3()).x;
  const distances = pointsIn(outlet, m.root).map((p) => Math.hypot(p.x - axisX, p.z));
  // Neck wall 0.475-0.53: the whole end lies on its mid-wall cylinder.
  assert.ok(Math.min(...distances) > 0.5 - 1e-4, `pipe enters the bore by ${0.5 - Math.min(...distances)}`);
  assert.ok(distances.filter((d) => d < 0.5 + 1e-4).length >= 48, 'both end rings lie on the wall');
});

test('454: each check knuckle turns in two bored lugs on its seat', () => {
  const m = createAuthoredDiaphragmPumpMovement({id: 454});
  const d = m.root.userData;
  for (const valve of [d.blocks.suctionValve, d.blocks.deliveryValve]) {
    const seat = valve.userData.seat, disk = valve.userData.disk;
    const knuckle = valve.children.find((o) => o.geometry?.type === 'CylinderGeometry');
    for (let i = 0; i <= 16; i++) {
      m.update(i * d.geometry.cycleDuration / 16);
      const axis = knuckle.getWorldPosition(new THREE.Vector3()).applyMatrix4(seat.matrixWorld.clone().invert());
      const bore = pointsIn(seat, seat).filter((p) => Math.abs(Math.hypot(p.x - axis.x, p.y - axis.y) - 0.07) < 1e-3 && Math.abs(p.z) > 0.2);
      assert.ok(bore.length >= 100, `lug bores round the knuckle (${bore.length})`);
    }
    assert.ok(disk.geometry.parameters.depth < 0.44, 'flap clears the lugs at |z| 0.22');
    assert.ok(knuckle.geometry.parameters.height / 2 <= 0.28 + 1e-9, 'knuckle ends flush with the lugs');
  }
});

test('455: each segment valve turns on a pin fast in the rotor web', () => {
  const m = createAuthoredOldRotaryPumpMovement({id: 455});
  const b = m.root.userData.blocks;
  const web = new THREE.Box3().setFromBufferAttribute(b.rotorRearWeb.geometry.attributes.position);
  for (const [index, {blade, hinge}] of b.valves.entries()) {
    const [pin] = byRole(m.root, (r) => r === `hinge-pin-${index + 1}-fast-in-rotor-web`);
    assert.ok(pin, 'pin present');
    const r = pin.geometry.parameters.radiusTop;
    const holeRadius = Math.min(...pointsIn(blade, blade).map((p) => Math.hypot(p.x, p.y)));
    assert.ok(holeRadius > r && holeRadius < r + 0.01, `knuckle bored round the pin (${holeRadius})`);
    assert.ok(pin.position.distanceTo(hinge.position) < 1e-9, 'pin on the hinge axis');
    assert.ok(pin.geometry.parameters.height / 2 >= -web.min.z - 1e-6, 'pin runs into the web');
    assert.ok(Math.hypot(pin.position.x, pin.position.y) < web.max.x + 1e-6, 'web reaches the pin');
  }
});

test('459: a Hooke spider joins the wind-wheel shaft and the rocking spiral, turning with both', () => {
  const m = createAuthoredReciprocatingWellLiftMovement({id: 459});
  const d = m.root.userData;
  const [spider] = byRole(m.root, (r) => r === 'flexible-coupling-permitting-small-lateral-worm-vibration');
  const [upperFork] = byRole(m.root, (r) => r === 'coupling-fork-on-wind-wheel-shaft');
  const [lowerFork] = byRole(m.root, (r) => r === 'spiral-shaft-with-coupling-fork');
  const [trunnions] = byRole(m.root, (r) => r === 'coupling-spider-trunnions');
  let turned = 0, previous = null;
  for (let i = 0; i <= 24; i++) {
    m.update(i * d.geometry.cycleDuration / 24);
    m.root.updateMatrixWorld(true);
    const q = spider.getWorldQuaternion(new THREE.Quaternion());
    if (previous) turned += previous.angleTo(q);
    previous = q;
    // Each fork's bore stays on its trunnion axis: upper on spider x, lower on spider z.
    for (const [fork, axis] of [[upperFork, new THREE.Vector3(1, 0, 0)], [lowerFork, new THREE.Vector3(0, 0, 1)]]) {
      const onSpider = pointsIn(fork, trunnions);
      const bore = onSpider.filter((p) => {
        const along = p.dot(axis), off = p.clone().addScaledVector(axis, -along).length();
        return Math.abs(off - 0.042) < 2e-3 && Math.abs(along) > 0.119 && Math.abs(along) < 0.181;
      });
      assert.ok(bore.length > 150, `${fork.userData.role} bored round its trunnion at step ${i} (${bore.length})`);
    }
  }
  assert.ok(turned > 1, `spider turns with the shafts (${turned})`);
});

test('454: the delivery branch is sealed in a round chamber port that fits it', () => {
  const m = createAuthoredDiaphragmPumpMovement({id: 454});
  const b = m.root.userData.blocks;
  m.update(0); m.root.updateMatrixWorld(true);
  const wall = pointsIn(b.chamberShell, m.root);
  // Round bore of the pipe's 0.27 outside about the branch axis (y 0.34, z 0.38).
  const bore = wall.filter((p) => p.x > 1 && Math.abs(Math.hypot(p.y - 0.34, p.z - 0.38) - 0.27) < 1e-3);
  assert.ok(bore.length > 200, `round port (${bore.length})`);
  assert.ok(!wall.some((p) => p.x > 1 && Math.hypot(p.y - 0.34, p.z - 0.38) < 0.27 - 1e-3), 'nothing of the wall inside the port');
  const pipe = pointsIn(b.deliveryBranch.shell, m.root).filter((p) => p.x < 1.4);
  assert.ok(Math.min(...pipe.map((p) => Math.hypot(p.x, p.z))) > 1.28 - 1e-4, 'pipe end lies on the wall mid-radius');
});

test('500: the inlet enters a bored boss and clamp ring A is bedded in the chamber lip', () => {
  const m = createAuthoredDiaphragmPressureGaugeMovement({id: 500});
  const b = m.root.userData.blocks;
  const chamber = pointsIn(b.chamber, b.chamber);
  const bore = chamber.filter((p) => Math.abs(Math.hypot(p.x, p.z + 0.05) - 0.17) < 1e-3 && p.y < -1.46 && p.y > -1.56);
  assert.ok(bore.length > 60, `bored boss round the inlet (${bore.length})`);
  const top = Math.max(...pointsIn(b.inletPipe, m.root).map((p) => p.y));
  assert.ok(top < -1.46 && top > -1.55, `pipe ends in the wall (${top})`);
  const lip = chamber.filter((p) => Math.abs(Math.hypot(p.x, p.y) - 1.40) < 1e-3);
  assert.ok(lip.length > 100, 'chamber carries its inner lip');
  const clamp = b.diaphragmClamp;
  const {radius, tube} = clamp.geometry.parameters;
  assert.ok(radius + tube > 1.40 + 0.02, 'clamp ring overlaps the lip');
});
