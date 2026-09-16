import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createAuthoredJointedParallelRulerMovement } from '../src/simulation/authored-jointed-parallel-rulers.js';
import { createAuthoredParallelRulerMovement } from '../src/simulation/authored-parallel-rulers.js';
import { rulerArmProfiles } from '../src/simulation/ruler-arm-profiles.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
const make = id => (id === 349 ? createAuthoredJointedParallelRulerMovement : createAuthoredParallelRulerMovement)({ id });
const box = o => new THREE.Box3().setFromObject(o);
function pinFits(pin, mesh) {
  const center = pin.getWorldPosition(new THREE.Vector3()), radius = pin.geometry.parameters.radiusTop;
  const ray = new THREE.Raycaster();
  for (let i = 0; i < 24; i++) {
    ray.set(new THREE.Vector3(center.x + radius * Math.cos(i * Math.PI / 12), 10,
      center.z + radius * Math.sin(i * Math.PI / 12)), new THREE.Vector3(0, -1, 0));
    assert.equal(ray.intersectObject(mesh, false).length, 0, `${mesh.userData.role}: actual bore clears pin`);
  }
  const a = box(pin), b = box(mesh);
  assert.ok(a.min.y < b.min.y && a.max.y > b.max.y, 'pin spans complete member depth');
}
function preparePairs(pairs) {
  return pairs.flatMap(([a, b]) => [[a, b], [b, a]]).map(([a, b]) => ({ a, b,
    points: surfacePoints(a.geometry), surface: solidSurface(b.geometry) }));
}
function noPenetration(prepared) {
  for (const { a, b, points, surface } of prepared) {
    if (!box(a).intersectsBox(box(b))) continue;
    const transform = new THREE.Matrix4().copy(b.matrixWorld).invert().multiply(a.matrixWorld);
    for (const p of points) assert.ok(surface.signedDistance(p.clone().applyMatrix4(transform), .001) >= -1e-6,
      `${a.userData.role} cuts into ${b.userData.role}`);
  }
}

test('extracted ornamental profiles identify the exact engraving and normalized pin centers', () => {
  for (const id of [349, 367]) {
    const p = rulerArmProfiles[id];
    assert.equal(p.sourceSha256, createHash('sha256').update(readFileSync(`public/engravings/mm_${id}.png`)).digest('hex'));
    assert.ok(p.points.length > 25 && p.points.length < 150);
  }
});

test('349: actual bored arms, rulers and intermediate bar engage their six common pins', () => {
  const m = make(349), b = m.root.userData.blocks;
  const arms = Object.values(b.links).map(l => l.shank);
  const pairs = arms.flatMap((a, i) => arms.slice(i + 1).map(c => [a, c]));
  for (const arm of arms) for (const blade of [b.upperRuler.body, b.lowerRuler.body, b.intermediateBody]) pairs.push([arm, blade]);
  pairs.push([b.intermediateBody, b.upperRuler.body], [b.intermediateBody, b.lowerRuler.body]);
  const prepared = preparePairs(pairs);
  for (let i = 0; i <= 64; i++) {
    m.update(4 * i / 64); m.root.updateMatrixWorld(true);
    for (const [name, link] of Object.entries(b.links)) {
      pinFits(b.pivotPins[name], link.shank);
      pinFits(b.pivotPins[name], name.startsWith('upper') ? b.upperRuler.body : b.lowerRuler.body);
      const middle = name.endsWith('Left') ? 'middleLeft' : 'middleRight';
      pinFits(b.pivotPins[middle], link.shank); pinFits(b.pivotPins[middle], b.intermediateBody);
    }
    noPenetration(prepared);
  }
  disposeObject3D(m.root);
});

test('367: pinned flat arms clear blades, calibrated scale and fixed indicator', () => {
  const m = make(367), b = m.root.userData.blocks;
  const prepared = preparePairs(b.parallelLinks.flatMap(link => [b.brassArc, b.ivoryScale,
    b.upperBlade.userData.body, b.lowerBlade.userData.body].map(other => [link.userData.arm, other])));
  const arc = solidSurface(b.brassArc.geometry);
  for (let i = 0; i <= 64; i++) {
    m.update(8 * i / 64); m.root.updateMatrixWorld(true);
    for (const link of b.parallelLinks) for (const [j, pin] of link.userData.pivotBosses.entries()) {
      pinFits(pin, link.userData.arm); pinFits(pin, (j ? b.upperBlade : b.lowerBlade).userData.body);
    }
    noPenetration(prepared);
    const state = m.root.userData.currentState;
    const reading = state.incidencePoint.clone().applyMatrix4(m.root.matrixWorld);
    const local = b.brassArc.worldToLocal(reading);
    assert.ok(arc.distance(local) < .0001, 'calibrated reading lies on actual outer strip edge');
    assert.ok(box(b.brassArc).min.y > box(b.ivoryScale).max.y);
    for (const tick of b.scaleTicks) assert.ok(box(b.brassArc).min.y > box(tick).max.y);
  }
  disposeObject3D(m.root);
});

for (const id of [349, 367]) test(`${id}: source-facing ruler view has no ground or material fog`, () => {
  const m = make(id); assert.equal(m.root.userData.hideGround, true);
  m.root.traverse(o => { for (const material of [o.material].flat().filter(Boolean)) assert.equal(material.fog, false); });
  assert.ok(m.cameraDirection.y > 10);
  disposeObject3D(m.root);
});
