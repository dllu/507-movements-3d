import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { angularCoverage, components, isFluidRole, principalExtents, ringCoverage, screenModel } from '../scripts/screen-disconnected-parts.mjs';

test('components groups joined nodes, largest first', () => {
  const groups = components(6, [[0, 1], [1, 2], [4, 5]]);
  assert.deepEqual(groups.map((g) => g.length), [3, 2, 1]);
});

test('angular coverage separates a bore from a link end short of its pin', () => {
  const ring = Array.from({ length: 48 }, (_, i) => new THREE.Vector3(Math.cos(i / 48 * 2 * Math.PI) * 0.2, Math.sin(i / 48 * 2 * Math.PI) * 0.2, 0));
  const end = Array.from({ length: 12 }, (_, i) => new THREE.Vector3(0.3, -0.1 + i * 0.02, 0));
  const axis = new THREE.Vector3(0, 0, 1), origin = new THREE.Vector3();
  assert.equal(angularCoverage(ring, origin, axis, [-1, 1], 0.02, THREE).coverage, 1);
  assert.ok(angularCoverage(end, origin, axis, [-1, 1], 0.02, THREE).coverage <= 0.25);
});

test('fluid roles are fluid, solid parts named after a medium are not', () => {
  for (const role of ['live-steam-in-valve-chest', 'hand-pump-reservoir-water', 'long-column-mercury-meniscus', 'water-column-in-pipe'])
    assert.ok(isFluidRole(role), role);
  for (const role of ['plate-elevation-upstream-frame-log', 'fixed-water-wheel-horizontal-axle', 'fixed-upper-front-cutaway-steam-cylinder', 'left-air-pump-piston', 'shaft-exhaust-pipe-standing-in-water', 'float-immersed-in-mercury', 'fixed-force-pump-cylinder-above-water', 'upper-left-discharge-trough-receiving-raised-water'])
    assert.ok(!isFluidRole(role), role);
});

test('screenModel reports a floating block and a link that stops short of its pin, not a hanging rope load', () => {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const add = (role, geometry, position) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = role;
    mesh.position.set(...position);
    root.add(mesh);
    return mesh;
  };
  add('frame', new THREE.BoxGeometry(10, 1, 1), [0, 0, 0]);
  add('pivot-pin', new THREE.CylinderGeometry(0.2, 0.2, 1.4, 24).rotateX(Math.PI / 2), [3, 1.5, 0]);
  add('pin-post', new THREE.BoxGeometry(0.3, 1.2, 0.3), [3, 0.9, 0]);
  // Link ends 0.05 short of the pin surface.
  const link = add('swinging-link', new THREE.BoxGeometry(2, 0.3, 0.3), [1.75, 1.5, 0]);
  add('floating-block', new THREE.BoxGeometry(1, 1, 1), [-3, 1.3, 0]);
  // A rope hangs from the frame's front face and carries a load below it.
  add('hoist-rope', new THREE.CylinderGeometry(0.03, 0.03, 2, 8), [-4.5, -1, 0.53]);
  add('rope-load', new THREE.BoxGeometry(0.6, 0.6, 0.6), [-4.5, -2.299, 0.53]);
  const model = { root, update(time) { link.rotation.z = 0; void time; } };
  const result = screenModel(model, 0, { touch: 0.0006, connect: 0.012, figure: 0.04, phases: 3, spacing: 1 / 350, maxPoints: 5000 });
  const byPart = (name) => result.detached.find((row) => row.parts.includes(name));
  assert.equal(byPart('floating-block')?.kind, 'floating');
  const short = byPart('swinging-link');
  assert.equal(short?.kind, 'near-miss');
  assert.ok(Math.abs(short.gap - 0.05) < 0.01, `gap ${short.gap}`);
  assert.equal(byPart('rope-load'), undefined);
});

test('screenModel reports an uncapped tube leg but not a capped one', () => {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const add = (role, geometry, position) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = role;
    mesh.position.set(...position);
    root.add(mesh);
    return mesh;
  };
  const leg = (x) => new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 2, 0)), 4, 0.1, 12, false);
  add('table-top', new THREE.BoxGeometry(4, 0.2, 1), [0, 2.1, 0]);
  add('bare-leg', leg(-1.5), [0, 0, 0]);
  add('capped-leg', leg(1.5), [0, 0, 0]);
  add('capped-leg-foot', new THREE.SphereGeometry(0.1, 12, 8), [1.5, 0, 0]);
  const model = { root, update() {} };
  const result = screenModel(model, 0, { touch: 0.0015, connect: 0.012, figure: 0.04, phases: 2, spacing: 1 / 350, maxPoints: 5000 });
  assert.deepEqual(result.openEnds.map((row) => row.part), ['bare-leg']);
  assert.equal(result.openEnds[0].exposed, 1);
});

test('principal extents and ring coverage tell a bore ring from a filled disc', () => {
  const box = [];
  for (let i = 0; i <= 10; i += 1) for (let j = 0; j <= 4; j += 1) box.push(new THREE.Vector3(i * 0.3, j * 0.1, 0));
  const { extents } = principalExtents(box);
  assert.ok(Math.abs(extents[0] - 3) < 1e-6 && Math.abs(extents[1] - 0.4) < 1e-6 && extents[2] < 1e-9, extents.join());
  const ring = [], disc = [];
  for (let i = 0; i < 96; i += 1) {
    const a = (i / 96) * 2 * Math.PI;
    for (const z of [-0.1, 0, 0.1]) ring.push(new THREE.Vector3(Math.cos(a) * 0.2, Math.sin(a) * 0.2, z));
    for (const r of [0, 0.05, 0.1, 0.15, 0.2]) disc.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  assert.equal(ringCoverage(ring), 1);
  assert.equal(ringCoverage(disc), 0);
});

test('screenModel flags sliver joints and overhang lips, not solid, redundant or working contacts', () => {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const add = (role, geometry, position) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = role;
    mesh.position.set(...position);
    root.add(mesh);
    return mesh;
  };
  const post = (role, x, z = 0) => add(role, new THREE.BoxGeometry(0.3, 1, 0.3), [x, 0.8, z]); // 0.2 deep in the frame
  add('frame', new THREE.BoxGeometry(10, 1, 1), [0, 0, 0]);
  // A ball hung from a stem end by a 0.01-deep cap, and one run onto its stem.
  post('capped-stem', -4);
  add('capped-ball', new THREE.SphereGeometry(0.4, 48, 32), [-4, 1.3 + 0.39, 0]);
  post('solid-stem', -3);
  add('solid-ball', new THREE.SphereGeometry(0.4, 48, 32), [-3, 1.4, 0]);
  // A grip joined to its arm by a sliver of its side (0.02 of overlap along
  // the grip), and a twin grip that is also set into a second post.
  const grip = () => new THREE.CylinderGeometry(0.15, 0.15, 0.8, 32).rotateX(Math.PI / 2);
  post('sliver-arm', -1.5);
  add('sliver-grip', grip(), [-1.5, 1.3 + 0.149, 0.53]);
  post('twin-arm', 0);
  add('twin-grip', grip(), [0, 1.3 + 0.149, 0.53]);
  add('twin-grip-post', new THREE.BoxGeometry(0.2, 1.2, 0.2), [0, 0.9, 0.4]);
  // A wheel turning on its axle, a fixed stop touching its rim: working contact.
  add('axle', new THREE.CylinderGeometry(0.1, 0.1, 1.6, 32).rotateX(Math.PI / 2), [2, 1.4, 0]);
  add('axle-post', new THREE.BoxGeometry(0.3, 1.3, 0.3), [2, 0.95, -0.4]);
  const bored = [[0.1, -0.1], [0.5, -0.1], [0.5, 0.1], [0.1, 0.1], [0.1, -0.1]].map(([x, y]) => new THREE.Vector2(x, y));
  const wheel = add('wheel', new THREE.LatheGeometry(bored, 48).rotateX(Math.PI / 2), [2, 1.4, 0]);
  add('stop', new THREE.BoxGeometry(0.1, 0.4, 0.1), [2.55, 1.25, 0]);
  add('stop-foot', new THREE.BoxGeometry(0.3, 0.2, 0.3), [2.55, 0.55, 0]);
  add('stop-stem', new THREE.BoxGeometry(0.1, 0.45, 0.1), [2.55, 0.85, 0]);
  // A round rod twice as thick as the boss plate it ends in, and a flush one.
  add('thick-boss-plate', new THREE.BoxGeometry(1, 0.6, 0.1), [4, 1.8, 0.05]);
  add('thick-rod', new THREE.CylinderGeometry(0.1, 0.1, 1.2, 32).rotateZ(Math.PI / 2), [3.1 + 0.02, 1.8, 0.05]);
  add('flush-boss-plate', new THREE.BoxGeometry(1, 0.6, 0.2), [4, 3, 0.05]);
  add('flush-rod', new THREE.CylinderGeometry(0.1, 0.1, 1.2, 32).rotateZ(Math.PI / 2), [3.1 + 0.02, 3, 0.05]);
  const model = { root, update(time) { wheel.rotation.z = time; } };
  const result = screenModel(model, 0, { touch: 0.0015, connect: 0.012, figure: 0.04, phases: 3, spacing: 1 / 350, maxPoints: 5000 });
  const flagged = (name) => result.slivers.find((row) => row.flagged && row.parts.includes(name));
  assert.ok(flagged('capped-ball')?.reasons.includes('cap'), JSON.stringify(result.slivers.map((r) => [r.parts, r.reasons])));
  assert.ok(flagged('sliver-grip')?.reasons.includes('narrow-neck'));
  for (const name of ['solid-ball', 'twin-grip', 'stop', 'wheel', 'axle', 'frame']) assert.equal(flagged(name), undefined, name);
  const lip = result.lips.find((row) => row.rod === 'thick-rod');
  assert.ok(lip, JSON.stringify(result.lips));
  assert.deepEqual(lip.lips.map((l) => l.side).sort(), ['+v', '-v']);
  assert.ok(lip.lips.every((l) => Math.abs(l.size - 0.05) < 0.01), JSON.stringify(lip.lips));
  assert.equal(result.lips.find((row) => row.rod === 'flush-rod'), undefined);
});
