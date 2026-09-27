import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { angularCoverage, components, isFluidRole, screenModel } from '../scripts/screen-disconnected-parts.mjs';

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
