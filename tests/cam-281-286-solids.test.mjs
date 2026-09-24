import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredGroovedDiskFollowerMovement} from '../src/simulation/authored-grooved-disk-followers.js';
import {createAuthoredPoppetValveMovement} from '../src/simulation/authored-poppet-valves.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';

function assertClearCycle(model, pairs, samples = 128) {
  const meshes = object => {const result = [];object.traverse(child => {if (child.isMesh) result.push(child);});return result;};
  const queries = pairs.flatMap(([a, b]) => meshes(a).flatMap(ma => meshes(b).flatMap(mb => [[ma, mb], [mb, ma]])))
    .map(([from, to]) => ({from, to, points: surfacePoints(from.geometry), surface: solidSurface(to.geometry)}));
  for (let frame = 0; frame <= samples; frame++) {
    model.update(frame * model.root.userData.geometry.cyclePeriod / samples);
    model.root.updateMatrixWorld(true);
    for (const {from, to, points, surface} of queries) {
      if (!new THREE.Box3().setFromObject(from).intersectsBox(new THREE.Box3().setFromObject(to))) continue;
      const matrix = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      for (const p of points) {
        const q = p.clone().applyMatrix4(matrix);
        assert.ok(!surface.inside(q) || surface.distance(q) < 2e-7,
          `${from.userData.role} enters ${to.userData.role} at frame ${frame}`);
      }
    }
  }
}

test('281: finite pin runs in an actual recessed channel between opposing solid lands', () => {
  const model = createAuthoredGroovedDiskFollowerMovement({id: 281}), u = model.root.userData, b = u.blocks, g = u.geometry;
  try {
    const sections = b.grooveOuter.geometry.userData.plate.polygons;
    assert.equal(sections.length, 2, 'outer land and central island remain joined by the disk floor');
    assert.ok(g.diskFrontZ - g.grooveFloorZ > .2, 'channel has finite depth');
    const edges = sections.flatMap(polygon => polygon.flatMap(points => points.slice(0, -1).map((a, i) =>
      [new THREE.Vector2(...a), new THREE.Vector2(...points[i + 1])])));
    for (let frame = 0; frame <= 512; frame++) {
      const state = u.stateAtTime(frame * g.cyclePeriod / 512);
      const center = new THREE.Vector2(state.groovePointLocal.x, state.groovePointLocal.y);
      let distance = Infinity;
      for (const [a, end] of edges) {
        const edge = end.clone().sub(a), t = THREE.MathUtils.clamp(center.clone().sub(a).dot(edge) / edge.lengthSq(), 0, 1);
        distance = Math.min(distance, center.distanceTo(a.clone().addScaledVector(edge, t)));
      }
      assert.ok(Math.abs(distance - g.followerPinRadius - .035) < .0001,
        `finite land clearance ${distance - g.followerPinRadius}`);
    }
    assertClearCycle(model, [b.diskBody, b.grooveOuter, b.grooveFloor, b.diskRim].map(other => [b.followerPin, other]));
    model.update(0);model.root.updateMatrixWorld(true);
    const pinBounds = new THREE.Box3().setFromObject(b.followerPin);
    assert.ok(pinBounds.min.z > g.grooveFloorZ + .039, 'tip clears actual channel floor');
    assert.ok(Math.min(pinBounds.max.z, g.diskFrontZ) - Math.max(pinBounds.min.z, -.05) > .17,
      'pin and walls share enough depth to transmit motion');
    // Restoring the old uncut disk necessarily puts the pin tip inside it.
    assert.ok(pinBounds.min.z < .18 && pinBounds.max.z > 0, 'negative control for former disk penetration');
  } finally {disposeObject3D(model.root);}
});

test('286: finite shoe rests on the curved toe instead of straddling the contact plane', () => {
  const model = createAuthoredPoppetValveMovement({id: 286}), u = model.root.userData, b = u.blocks;
  try {
    let activeSamples = 0, maximumFacetGap = 0;
    for (let frame = 0; frame <= 512; frame++) {
      model.update(frame * u.geometry.cyclePeriod / 512);model.root.updateMatrixWorld(true);
      const state = u.kinematics, shoeBottom = new THREE.Box3().setFromObject(b.followerShoe).min.y;
      assert.ok(Math.abs(shoeBottom - state.followerBottomY) < 1e-8);
      if (!state.contactActive) continue;
      activeSamples++;
      let highest = -Infinity;
      const vertices = b.toeBody.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(b.toeBody.matrixWorld);
        highest = Math.max(highest, p.y);
      }
      const gap = shoeBottom - highest;
      assert.ok(gap >= -1e-7 && gap < .00006, `toe facet contact gap ${gap}`);
      maximumFacetGap = Math.max(maximumFacetGap, gap);
      assert.ok(gap - .0225 < -.0224, 'former centered shoe overlaps the same finite toe');
    }
    assert.ok(activeSamples > 200 && maximumFacetGap > 0);
    assertClearCycle(model, [b.toeBody, b.workingFlank].flatMap(toe =>
      [b.followerShoe, b.lifterBody].map(lifter => [toe, lifter])));
  } finally {disposeObject3D(model.root);}
});

test('286: undrawn rod guides are omitted and the finite valve closes onto its seat', () => {
  const model = createAuthoredPoppetValveMovement({id: 286}), u = model.root.userData, b = u.blocks;
  try {
    // Brown draws the rod alone; its guides and standard are not rendered.
    const guides = b.fixedGuides.children.filter(mesh => /guide$/.test(mesh.userData.role));
    assert.equal(guides.length, 0);
    assert.equal(b.guidePost.parent, null);
    for (let frame = 0; frame <= 128; frame++) {
      model.update(frame * u.geometry.cyclePeriod / 128);model.root.updateMatrixWorld(true);
      const head = new THREE.Box3().setFromObject(b.poppetHead), seat = new THREE.Box3().setFromObject(b.valveSeat);
      assert.ok(Math.abs(head.min.y - seat.max.y - u.kinematics.valveLift) < 1e-8,
        'finite seating gap must equal valve lift and close at rest');
      const rod = new THREE.Box3().setFromObject(b.valveRod);
      for (const guide of guides) {
        const bounds = new THREE.Box3().setFromObject(guide);
        assert.ok(rod.min.y < bounds.min.y && rod.max.y > bounds.max.y, 'guide stays fully on rod');
      }
    }
    assertClearCycle(model, [
      ...guides.map(guide => [b.valveRod, guide]),
      ...b.fixedGuides.children.flatMap(part => [[b.lifterBody, part], [b.poppetHead, part]]),
    ]);
  } finally {disposeObject3D(model.root);}
});

for (const [id, create] of [[281, createAuthoredGroovedDiskFollowerMovement], [286, createAuthoredPoppetValveMovement]]) {
  test(`${id}: contact geometry remains visible without floor or fog`, () => {
    const model = create({id});
    try {
      assert.equal(model.root.userData.hideGround, true);
      model.root.traverse(object => {
        for (const material of object.material ? [].concat(object.material) : []) assert.equal(material.fog, false);
      });
    } finally {disposeObject3D(model.root);}
  });
}
