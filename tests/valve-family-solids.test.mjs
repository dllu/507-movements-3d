import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredLocomotiveValveGearMovement } from '../src/simulation/authored-locomotive-valve-gears.js';
import { createAuthoredValveReliefGuideMovement } from '../src/simulation/authored-valve-relief-guides.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

function discClears(mesh, center, radius) {
  const ray = new THREE.Raycaster();
  for (let i = 0; i < 32; i += 1) {
    const angle = i * Math.PI / 16;
    ray.set(new THREE.Vector3(center.x + radius * Math.cos(angle),
      center.y + radius * Math.sin(angle), 10), new THREE.Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(mesh, false).length, 0, `${mesh.userData.role}: bore sample ${i}`);
  }
}

test('185: finite die fits within the free slot and eccentric rods clear the rotating sheaves', () => {
  const { root, update } = createAuthoredLocomotiveValveGearMovement({ id: 185 });
  const { blocks: b, geometry: g } = root.userData;
  const point = new THREE.Vector3();
  for (let i = 0; i <= 192; i += 1) {
    update(g.selectorPeriod * i / 192); root.updateMatrixWorld(true);
    const positions = b.dieBody.geometry.attributes.position;
    let minZ = Infinity, maxZ = -Infinity;
    for (let j = 0; j < positions.count; j += 1) {
      point.fromBufferAttribute(positions, j).applyMatrix4(b.dieBody.matrixWorld);
      b.expansionLink.worldToLocal(point);
      const r = Math.hypot(point.x - g.linkSlotCenterLocal.x, point.y);
      assert.ok(Math.abs(r - g.linkSlotRadius) < g.linkSlotHalfWidth,
        `die corner must stay between free slot walls at ${i}`);
      minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z);
    }
    assert.ok(minZ < -0.07 && maxZ > 0.07, 'die crosses the rail plane rather than floating in front');
    discClears(b.dieBody, b.diePin.getWorldPosition(new THREE.Vector3()), 0.085);
    for (const lug of b.linkPinAssemblies) {
      discClears(b.innerLinkRail, lug.getWorldPosition(new THREE.Vector3()), 0.07);
    }
    discClears(b.outerLinkRail, b.suspensionLug.getWorldPosition(new THREE.Vector3()), 0.075);
    for (const [rod, strap] of [[b.forwardEccentricRod, b.forwardStrap], [b.backwardEccentricRod, b.backwardStrap]]) {
      const center = strap.getWorldPosition(new THREE.Vector3());
      const vertices = rod.geometry.attributes.position;
      for (let j = 0; j < vertices.count; j += 1) {
        point.fromBufferAttribute(vertices, j).applyMatrix4(rod.matrixWorld);
        assert.ok(Math.hypot(point.x - center.x, point.y - center.y) > g.sheaveRadius + 0.04,
          'eccentric rod starts outside its sheave');
      }
    }
  }
  assert.equal(root.userData.hideGround, true);
  disposeObject3D(root);
});

test('418: rod clears guide rails and roller, axle bores remain open, valve rests on seat', () => {
  const { root, update } = createAuthoredValveReliefGuideMovement({ id: 418 });
  const { blocks: b, geometry: g, stateAtTime } = root.userData;
  for (let i = 0; i <= 64; i += 1) {
    const time = 4 * i / 64;
    update(time); root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    const rod = new THREE.Box3().setFromBufferAttribute(b.rodB.geometry.attributes.position).applyMatrix4(b.rodB.matrixWorld);
    for (const mesh of [b.upperArcD, b.lowerArcD, b.rollerBody]) {
      const fixed = new THREE.Box3().setFromObject(mesh);
      assert.ok(rod.max.z < fixed.min.z - 0.05, 'rear rod clears working guide and roller');
    }
    discClears(b.rodB, state.lowerPin, 0.08);
    discClears(b.rodB, state.upperPin, 0.08);
    discClears(b.rodB, state.rollerCenter, 0.08);
    discClears(b.rollerBody, state.rollerCenter, 0.08);
    for (const brace of b.guideEndBraces) discClears(brace, state.rollerCenter, g.rollerRadius);
    discClears(b.upperSliderBlock, state.upperPin, 0.08);
    discClears(b.valveNeck, state.lowerPin, 0.08);
    const body = new THREE.Box3().setFromObject(b.valveBody);
    const seat = new THREE.Box3().setFromObject(b.valveSeat);
    assert.ok(Math.abs(body.min.y - seat.max.y) < 1e-7, 'valve does not penetrate seat');
    const upper = new THREE.Vector3(g.rodLength, 0, 0).applyMatrix4(b.rodB.matrixWorld);
    assert.ok(Math.hypot(upper.x - state.upperPin.x, upper.y - state.upperPin.y) < 1e-12,
      'rigid rod endpoint follows the exact upper-pin constraint');
  }
  assert.equal(root.userData.hideGround, true);
  disposeObject3D(root);
});
