import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredStudEscapementMovement as create } from '../src/simulation/authored-stud-escapements.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

function nearest(p, polygon) {
  let distance = Infinity, point, inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i], v = b.clone().sub(a);
    const q = a.clone().addScaledVector(v, THREE.MathUtils.clamp(p.clone().sub(a).dot(v) / v.lengthSq(), 0, 1));
    if (q.distanceTo(p) < distance) { distance = q.distanceTo(p); point = q; }
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return { gap: inside ? -distance : distance, point };
}

test('292: finite pallet reactions oppose drive and the remaining handoff error is bounded', () => {
  const m = create({ id: 292 }), d = m.root.userData, g = d.geometry;
  const polygons = [d.blocks.frontPalletBody, d.blocks.rearPalletBody].map(o => o.geometry.parameters.shapes.getPoints());
  let minimum = Infinity, maximumActive = 0, maximumReaction = -Infinity, mountMinimum = Infinity;
  for (let i = 0; i <= 2048; i++) {
    const s = d.stateAtTime(g.pendulumPeriod * i / 2048);
    for (let n = 0; n < g.studCount; n++) {
      const a = s.wheelAngle + n * g.studPitch;
      const world = g.wheelCenter.clone().add(new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(g.studOrbitRadius));
      const local = world.clone().sub(g.palletPivot).rotateAround(new THREE.Vector2(), -s.palletAngle);
      const hit = nearest(local, polygons[n % 2]), gap = hit.gap - g.studRadius;
      minimum = Math.min(minimum, gap);
      const mount = d.annularStudWorkingParts.mounts[n % 2];
      mountMinimum = Math.min(mountMinimum, local.distanceTo(new THREE.Vector2(mount.position.x, mount.position.y)) - .065 - g.studRadius);
      if (s.contactActive && n === s.activeStudIndex) {
        maximumActive = Math.max(maximumActive, Math.abs(gap));
        const reaction = local.clone().sub(hit.point).normalize().rotateAround(new THREE.Vector2(), s.palletAngle);
        const radius = world.clone().sub(g.wheelCenter);
        maximumReaction = Math.max(maximumReaction, reaction.dot(new THREE.Vector2(radius.y, -radius.x).normalize()));
      }
    }
  }
  // This deliberately records an open finite-offset cusp; it is not a zero-
  // penetration qualification. The old inward backing penetrated by .058.
  assert.ok(minimum > -.0017, `handoff penetration ${minimum}`);
  assert.ok(maximumActive < .0017, `working-face separation ${maximumActive}`);
  assert.ok(maximumReaction < -.5, `reaction must resist clockwise drive: ${maximumReaction}`);
  assert.ok(mountMinimum > .08, `axial mount / stud gap ${mountMinimum}`);
  console.log({ minimum, maximumActive, maximumReaction, mountMinimum });
});

test('292: finite arms clear both pin rows and mount solidly to the working blocks', () => {
  const m = create({ id: 292 }), d = m.root.userData, b = d.blocks;
  m.root.updateMatrixWorld(true);
  for (const [index, group] of [b.frontPallet, b.rearPallet].entries()) {
    const mount = d.annularStudWorkingParts.mounts[index];
    const arm = group.children.find(o => o.userData.role.endsWith('long-arm-from-F'));
    const bridge = group.children.find(o => o.userData.role.endsWith('arm-to-working-pallet-bridge'));
    const body = index === 0 ? b.frontPalletBody : b.rearPalletBody;
    for (const part of [arm, bridge]) {
      assert.ok(Math.abs(part.position.z) - part.geometry.parameters.depth / 2 > .815 + .04);
    }
    for (const [a, target] of [[mount, body], [mount, bridge], [arm, bridge], [arm, b.palletPivotHub]]) {
      const field = solidSurface(target.geometry), transform = target.matrixWorld.clone().invert().multiply(a.matrixWorld);
      const minimum = Math.min(...surfacePoints(a.geometry).map(p => field.signedDistance(p.clone().applyMatrix4(transform), .02)));
      assert.ok(minimum < -.001, `${a.userData.role} must attach to ${target.userData.role}: ${minimum}`);
    }
    assert.ok(group.children.filter(o => o.geometry?.type === 'TubeGeometry').every(o => !o.visible));
  }
});
