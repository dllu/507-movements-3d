import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredAtmosphericBeamEngine } from '../src/simulation/authored-atmospheric-beam-engines.js';
import { createAuthoredUprightEngineParallelMotion } from '../src/simulation/authored-upright-engine-parallel-motions.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const bounds = part => new THREE.Box3().setFromObject(part);
const world = part => part.getWorldPosition(new THREE.Vector3());
function clearsBore(part, center, radius) {
  const ray = new THREE.Raycaster();
  for (let i = 0; i < 16; i++) {
    ray.set(new THREE.Vector3(center.x + radius * Math.cos(i * Math.PI / 8),
      center.y + radius * Math.sin(i * Math.PI / 8), 10), new THREE.Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(part, true).length, 0, `${part.userData.role}: finite pin fits open bore`);
  }
}
function pinSpans(pin, part) {
  const p = bounds(pin), b = bounds(part);
  assert.ok(p.min.z <= b.min.z && p.max.z >= b.max.z, `${part.userData.role}: engaged pin length`);
}

test('342: round piston joins its rod and stays inside the open-top cylinder bore', () => {
  const { root, update } = createAuthoredAtmosphericBeamEngine({ id: 342 }); const b = root.userData.blocks;
  const bore = b.openCylinder.geometry.userData.boreRadius;
  const headRadius = b.pistonHead.geometry.parameters.radiusTop;
  assert.ok(headRadius < bore - .01, 'piston head clears the bore');
  for (let i = 0; i <= 64; i++) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const head = bounds(b.pistonHead), rod = bounds(b.pistonRod), cylinder = bounds(b.openCylinder);
    assert.ok(head.intersectsBox(rod), 'piston head is joined to rod');
    assert.ok(Math.abs(world(b.pistonHead).x - world(b.openCylinder).x) < 1e-12, 'coaxial piston');
    assert.ok(head.min.y > bounds(b.cylinderBottom).max.y && head.max.y < cylinder.max.y, 'head stays within the barrel');
    assert.ok(bounds(b.pistonCrosshead).max.x - bounds(b.pistonCrosshead).min.x < 2 * bore, 'crosshead can enter the open top');
  }
  disposeObject3D(root);
});

test('343: round piston joins its rod and stays inside the plate cylinder barrel', () => {
  const { root, update } = createAuthoredUprightEngineParallelMotion({ id: 343 }); const b = root.userData.blocks;
  const bore = b.cylinderBody.geometry.userData.boreRadius;
  assert.ok(b.pistonHead.geometry.parameters.radiusTop < bore - .01, 'piston head clears the barrel bore');
  for (let i = 0; i <= 64; i++) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const head = bounds(b.pistonHead), rod = bounds(b.pistonRod);
    assert.ok(head.intersectsBox(rod), 'piston head is joined to rod');
    assert.ok(Math.abs(world(b.pistonHead).z - world(b.cylinderBody).z) < 1e-12, 'coaxial piston');
    assert.ok(Math.abs(world(b.pistonHead).x - world(b.cylinderBody).x)
      <= root.userData.geometry.maximumLateralDeviation + 1e-12, 'piston stays on its near-straight locus');
    assert.ok(head.min.y > bounds(b.cylinderBottom).max.y && head.max.y < bounds(b.cylinderTop).min.y,
      'head stays below the cover and above the bottom');
    const rodHalfDiagonal = Math.hypot(rod.max.x - rod.min.x, rod.max.z - rod.min.z) / 2;
    for (const part of [b.cylinderGland, b.cylinderNeck, b.cylinderTop]) {
      assert.ok(rodHalfDiagonal + Math.abs(world(b.pistonRod).x) < part.geometry.userData.boreRadius,
        `${part.userData.role} passes the piston rod`);
    }
  }
  disposeObject3D(root);
});

test('342: plate chain rides on the segment rim in the beam plane with headed pins', () => {
  const { root, update } = createAuthoredAtmosphericBeamEngine({ id: 342 });
  const b = root.userData.blocks, g = root.userData.geometry;
  const links = [...b.chainLinks, b.chainTerminalConnector.userData.parts];
  const head = bounds(b.chainShoe);
  for (let i = 0; i <= 64; i++) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const beamHead = bounds(b.chainShoe);
    for (const [j, link] of links.entries()) {
      const outer = j % 2 === 0 || j === links.length - 1;
      assert.equal(Boolean(link.startPin), outer, 'outer links own both pins');
      if (outer) {
        for (const pin of [link.startPin, link.endPin]) {
          const p = bounds(pin);
          for (const plate of link.plates) {
            const q = bounds(plate);
            assert.ok(p.min.z < q.min.z - .005 || p.max.z > q.max.z + .005, 'pin head stands proud of its plate');
          }
          assert.ok(p.min.z < g.chainOuterLow - .01 && p.max.z > g.chainOuterHigh + .01, 'pin heads proud of both faces');
          // Pass 94: the chain line stands 0.13 in front of the beam mid-plane so its
          // front plates show in rotated views; they stand at most ~0.04 proud.
          assert.ok(p.min.z > beamHead.min.z && p.max.z < beamHead.max.z + .045, 'chain stays within the head, front plates just proud');
        }
      } else {
        const neighbours = [links[j - 1].endPin, links[j + 1]?.startPin].filter(Boolean);
        for (const pin of neighbours) clearsBore(link.plates[0], world(pin), g.chainPinRadius);
      }
      for (const anchor of [link.startAnchor, link.endAnchor]) {
        const p = world(anchor), radial = Math.hypot(p.x, p.y);
        assert.ok(radial - g.chainWidth * .47 > g.shoeOuterRadius + .005 - 1e-12 || p.y < -1e-9,
          'link eyes on the pitch circle clear the 11.7-unit rim');
      }
    }
    for (const [part, pin] of [[b.pistonTopBoss, b.chainLinks[0].startPin],
      [b.chainLug, b.chainAttachmentPin]]) clearsBore(part, world(pin), g.chainPinRadius);
    assert.ok(bounds(b.pistonCrosshead).max.y < bounds(b.chainLinks[0].plates[0]).min.y, 'crosshead top clears the first link');
  }
  // Pass 94: the chain's front outer plate stands just proud of the head face.
  assert.ok(head.min.z < g.chainOuterLow && head.max.z > g.chainOuterHigh - .045, 'head face spans the chain (front plates just proud)');
  disposeObject3D(root);
});

test('343: bored linkage eyes engage pins in separated working layers', () => {
  const { root, update } = createAuthoredUprightEngineParallelMotion({ id: 343 }); const b = root.userData.blocks;
  for (let i = 0; i <= 64; i++) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    assert.ok(b.jointPins.U.parent === b.topRadiusRod && b.jointPins.D.parent === b.bottomRadiusRod,
      'radius-rod pins are fast in their rods');
    assert.ok(b.jointPins.P.parent === b.inputCrank && b.jointPins.C.parent === b.pistonOutput);
    for (const [part, pin] of [[b.connectingRod, b.jointPins.P], [b.connectingRod, b.jointPins.C],
      [b.topRadiusRod.children[0], b.topPivotBearing.shaft], [b.bottomRadiusRod.children[0], b.bottomPivotBearing.shaft],
      [b.crosspiece, b.jointPins.C], [b.crosspiece, b.jointPins.U], [b.crosspiece, b.jointPins.D],
      [b.pistonTopEye, b.jointPins.C], [b.crankBearing, b.crankShaft], [b.flywheelHub, b.crankShaft]]) {
      clearsBore(part, world(pin), pin.geometry.parameters.radiusTop); pinSpans(pin, part);
    }
    const rod = bounds(b.connectingRod), radius = bounds(b.topRadiusRod.children[0]), cross = bounds(b.crosspiece), piston = bounds(b.pistonRod);
    assert.ok(rod.max.z < radius.min.z && radius.max.z < cross.min.z && cross.max.z < piston.min.z);
    for (const pivot of [b.topPivotBearing, b.bottomPivotBearing]) {
      assert.ok(bounds(pivot.bearing).max.z < radius.min.z);
      assert.ok(bounds(pivot.support).intersectsBox(bounds(pivot.bearing)));
      assert.ok(b.framePillars.some(pillar => bounds(pillar).intersectsBox(bounds(pivot.support))));
    }
    assert.ok(bounds(b.flywheel).max.z < bounds(b.framePillars[0]).min.z);
  }
  disposeObject3D(root);
});
