import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredWoolComberMovement} from '../src/simulation/authored-wool-comber.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';

// Read the rendered outline, independently of the runtime clearance diagnostic.
function nearestBoundary(points, center, radius) {
  let distance = Infinity, point;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], edge = b.clone().sub(a);
    if (edge.lengthSq() < 1e-18) continue;
    const t = THREE.MathUtils.clamp(center.clone().sub(a).dot(edge) / edge.lengthSq(), 0, 1);
    const candidate = a.clone().addScaledVector(edge, t), d = center.distanceTo(candidate);
    if (d < distance) {distance = d;point = candidate;}
  }
  return {gap: distance - radius, point, normal: center.clone().sub(point).normalize()};
}

for (const id of [217, 218]) {
  test(`${id}: relieved notch retains opposing load-bearing flanks and limited take-up`, () => {
    const model = createAuthoredWoolComberMovement({id}), {blocks: b, geometry: g} = model.root.userData;
    try {
      const points = b.notchWheel.geometry.parameters.shapes.getPoints();
      const contact = angle => nearestBoundary(points,
        g.engagedHookLocal.clone().rotateAround(new THREE.Vector2(), -angle), g.catchHookRadius);
      for (const sign of [-1, 1]) {
        let lo = 0, hi = .01;
        assert.ok(contact(0).gap > .0018, 'finite milling clearance remains');
        assert.ok(contact(sign * hi).gap < -.005, 'nearby solid flank must stop relative rotation');
        for (let i = 0; i < 48; i++) {
          const mid = (lo + hi) / 2;
          if (contact(sign * mid).gap > 0) lo = mid;else hi = mid;
        }
        assert.ok(hi > .001 && hi < .002, `take-up is bounded: ${hi}`);
        const {point, normal} = contact(sign * hi);
        const wheelReactionTorque = -(point.x * normal.y - point.y * normal.x);
        assert.ok(sign * wheelReactionTorque < -1.1,
          'each flank supplies a tangential reaction opposing relative rotation');
      }
      // Both contacting solids share depth; the fix does not separate them axially.
      const overlap = Math.min(g.wheelCenterZ + g.wheelDepth / 2, g.catchHookCenterZ + g.catchHookLength / 2)
        - Math.max(g.wheelCenterZ - g.wheelDepth / 2, g.catchHookCenterZ - g.catchHookLength / 2);
      assert.ok(overlap > .05);
    } finally {disposeObject3D(model.root);}
  });

  test(`${id}: finite hook and wheel clear through entry, drive, release, and return`, () => {
    const model = createAuthoredWoolComberMovement({id}), {blocks: b, motion} = model.root.userData;
    try {
      const pairs = [[b.catchHook, b.notchWheel], [b.notchWheel, b.catchHook]].map(([from, to]) =>
        ({from, to, points: surfacePoints(from.geometry), surface: solidSurface(to.geometry)}));
      for (let frame = 0; frame <= 256; frame++) {
        model.update(frame * motion.inputCycleDuration / 256);model.root.updateMatrixWorld(true);
        for (const {from, to, points, surface} of pairs) {
          if (!new THREE.Box3().setFromObject(from).intersectsBox(new THREE.Box3().setFromObject(to))) continue;
          const matrix = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
          for (const p of points) {
            const point = p.clone().applyMatrix4(matrix);
            assert.ok(!surface.inside(point) || surface.distance(point) < 1e-7,
              `${from.userData.role} intersects ${to.userData.role} at frame ${frame}`);
          }
        }
      }
    } finally {disposeObject3D(model.root);}
  });
}

test('the former radial notch binds the same finite hook during release', () => {
  const model = createAuthoredWoolComberMovement({id: 217}), u = model.root.userData, g = u.geometry;
  try {
    const points = [];
    for (let i = 0; i < g.notchCount; i++) {
      const center = g.notchPhaseAngle + i * g.notchPitchAngle;
      for (const [offset, radius] of [
        [-g.notchPitchAngle / 2, 1.55], [-.095, 1.55], [-.095, 1.16],
        [.095, 1.16], [.095, 1.55], [g.notchPitchAngle / 2, 1.55],
      ]) points.push(new THREE.Vector2(Math.cos(center + offset), Math.sin(center + offset)).multiplyScalar(radius));
    }
    const state = u.stateAtInputTravel(.5632 * Math.PI * 2);
    const center = state.catchHookWorld.clone().sub(g.outputCenter)
      .rotateAround(new THREE.Vector2(), -state.outputAngle);
    assert.ok(nearestBoundary(points, center, g.catchHookRadius).gap < -.017,
      'the negative control must expose the old flank penetration');
    assert.ok(state.catchSolidClearance > .0018, 'the relieved rendered outline clears the same pose');
  } finally {disposeObject3D(model.root);}
});
