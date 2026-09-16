import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredBeveledCamMovement} from '../src/simulation/authored-beveled-cams.js';
import {createAuthoredEqualDiameterCamMovement} from '../src/simulation/authored-equal-diameter-cams.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';

function assertClearCycle(model, pairs, samples = 128) {
  const meshes = object => {const result = [];object.traverse(child => {if (child.isMesh) result.push(child);});return result;};
  const queries = pairs.flatMap(([a, b]) => meshes(a).flatMap(ma => meshes(b).flatMap(mb => [[ma, mb], [mb, ma]])))
    .map(([from, to]) => ({from, to, points: surfacePoints(from.geometry), surface: solidSurface(to.geometry)}));
  for (let frame = 0; frame <= samples; frame++) {
    model.update(frame * model.root.userData.timeline.cyclePeriod / samples);
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

test('272: visible annular working face is tangent to the finite shoe', () => {
  const model = createAuthoredBeveledCamMovement({id: 272}), {blocks: b, geometry: g} = model.root.userData;
  try {
    const vertices = b.bevelFace.geometry.attributes.position;
    const normal = new THREE.Vector3(-1, g.bevelTiltCoefficient, 0).normalize();
    for (let frame = 0; frame <= 256; frame++) {
      model.update(frame * model.root.userData.timeline.cyclePeriod / 256);model.root.updateMatrixWorld(true);
      const center = b.contactShoe.getWorldPosition(new THREE.Vector3()).applyMatrix4(b.camRotor.matrixWorld.clone().invert());
      for (let i = 0; i < vertices.count; i++) {
        const face = new THREE.Vector3().fromBufferAttribute(vertices, i);
        const gap = center.clone().sub(face).dot(normal) - g.shoeRadius;
        assert.ok(Math.abs(gap) < 7e-8, `visible face and shoe disagree by ${gap}`);
        assert.ok(gap - .012 < -.0119, 'former raised face intersects the same shoe');
      }
    }
    assertClearCycle(model, [[b.contactShoe, b.camBody], [b.followerRod, b.camBody]]);
  } finally {disposeObject3D(model.root);}
});

test('276: rendered cam envelope stays within machining tolerance of both rollers', () => {
  const model = createAuthoredEqualDiameterCamMovement({id: 276}), {blocks: b, geometry: g} = model.root.userData;
  try {
    const points = b.camBody.geometry.parameters.shapes.getPoints();
    let maxGap = 0, minGap = Infinity;
    for (let frame = 0; frame <= 512; frame++) {
      model.update(frame * g.cyclePeriod / 512);model.root.updateMatrixWorld(true);
      const transform = b.camRotor.matrixWorld.clone().invert();
      for (const roller of [b.leftRoller, b.rightRoller]) {
        const center3 = roller.getWorldPosition(new THREE.Vector3()).applyMatrix4(transform);
        const center = new THREE.Vector2(center3.x, center3.y);
        let distance = Infinity;
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i], edge = points[i + 1].clone().sub(a);
          const t = THREE.MathUtils.clamp(center.clone().sub(a).dot(edge) / edge.lengthSq(), 0, 1);
          distance = Math.min(distance, center.distanceTo(a.clone().addScaledVector(edge, t)));
        }
        const gap = distance - g.rollerRadius;
        minGap = Math.min(minGap, gap);maxGap = Math.max(maxGap, gap);
        assert.ok(gap >= -2e-7 && gap < .0007, `finite circle/cam gap ${gap}`);
        assert.ok(gap - .022 < -.021, 'former outward bevel exceeds contact allowance');
      }
    }
    assert.ok(minGap < .0001 && maxGap > .0002, 'check must resolve polygon chord error');
    assert.equal(b.camBody.geometry.parameters.options.bevelEnabled, false);
    assertClearCycle(model, [
      [b.leftRoller.userData.blocks.tread, b.camBody], [b.rightRoller.userData.blocks.tread, b.camBody],
      [b.leftRoller.userData.blocks.tread, b.profileOutline], [b.rightRoller.userData.blocks.tread, b.profileOutline],
    ]);
  } finally {disposeObject3D(model.root);}
});

test('276: finite yoke eye clears the cam, shaft and bearing while preserving attached webs', () => {
  const model = createAuthoredEqualDiameterCamMovement({id: 276}), {blocks: b, geometry: g} = model.root.userData;
  try {
    const polygons = b.bar.geometry.userData.plate.polygons;
    assert.equal(polygons.length, 1, 'one connected yoke');
    assert.equal(polygons[0].length, 2, 'one actual through-eye');
    assert.ok(g.yokeEyeOuterRadius - g.bearingReliefRadius >= .099, 'finite upper and lower load-bearing webs');
    assert.ok(g.barZ + g.barDepth / 2 > -g.rollerDepth * 1.54 / 2, 'roller axles reach inside the yoke');
    assertClearCycle(model, [
      ...[b.camBody, b.camHub, b.camShaft, b.camBearing, b.camBearingArm, b.camBearingPost]
        .map(other => [b.bar, other]),
      [b.camShaft, b.camBearing], [b.camShaft, b.camBearingArm],
      ...[b.leftRoller, b.rightRoller].flatMap(roller => [
        [roller.userData.blocks.tread, roller.userData.blocks.axle],
        ...roller.userData.blocks.rotationIndices.map(index => [index, roller.userData.blocks.axle]),
      ]),
    ]);
  } finally {disposeObject3D(model.root);}
});

for (const [id, create] of [[272, createAuthoredBeveledCamMovement], [276, createAuthoredEqualDiameterCamMovement]]) {
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
