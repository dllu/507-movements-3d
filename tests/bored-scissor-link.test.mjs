import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { createAuthoredLinkageMovement } from '../src/simulation/authored-linkages.js';
import { makeBoredScissorLink } from '../src/simulation/bored-scissor-link.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { solidSurface } from './helpers/solid-surface.mjs';

test('144 flat links provide real clearance at their end and crossing pins', () => {
  for (const centerPin of [false, true]) {
    const length = Math.hypot(85 / 2, 99) * .016 * (centerPin ? 2 : 1);
    const link = makeBoredScissorLink({ length, depth: .2, thickness: .18,
      color: 0x174f69, pinRadius: .105, centerPin });
    try {
      const body = link.children[0], solid = solidSurface(body.geometry);
      const pinXs = centerPin ? [0, length / 2, length] : [0, length];
      for (let pose = 0; pose <= 64; pose++) {
        const angle = (7 + 20 * pose / 64) * Math.PI / 180;
        const start = new Vector3(-1, .4, .24);
        const end = start.clone().add(new Vector3(length * Math.sin(angle), length * Math.cos(angle), 0));
        link.userData.setEndpoints(start, end); link.updateMatrixWorld(true);
        assert.equal(body.scale.x, 1);
        const inverse = body.matrixWorld.clone().invert();
        for (const x of pinXs) {
          // Pin axis determined independently from the two linkage endpoints.
          const axis = start.clone().lerp(end, x / length);
          for (let i = 0; i < 48; i++) for (const z of [-.099, 0, .099]) {
            const p = axis.clone().add(new Vector3(.105 * Math.cos(i * Math.PI / 24),
              .105 * Math.sin(i * Math.PI / 24), z)).applyMatrix4(inverse);
            assert.ok(solid.signedDistance(p) > .0027, 'actual pin surface clears actual bore');
          }
          assert.ok(solid.inside(new Vector3(x, .14, 0)), 'the eye retains material around its bore');
        }
      }
    } finally { disposeObject3D(link); }
  }
});

test('144 clevis pins span both bored cheeks and the fixed pin seats in its pedestal', () => {
  const model = createAuthoredLinkageMovement({ id: 144 });
  try {
    model.root.updateMatrixWorld(true);
    const b = model.root.userData.blocks;
    const pedestal = new Box3().setFromObject(b.pedestal);
    const fixedPin = new Box3().setFromObject(b.fixedCenterPin.userData.blocks.shaft);
    assert.ok(fixedPin.min.z < pedestal.max.z - .1);
    assert.ok(fixedPin.max.z > .34);
    for (const handle of [b.leftOutputAssembly, b.rightInputAssembly]) {
      const { hub, endpointPin } = handle.userData.blocks;
      const shaft = endpointPin.userData.blocks.shaft;
      const shaftBounds = new Box3().setFromObject(shaft);
      for (const cheek of hub.children.filter(o => o.geometry.userData.plate)) {
        const solid = solidSurface(cheek.geometry), bounds = new Box3().setFromObject(cheek);
        assert.ok(shaftBounds.min.z < bounds.min.z);
        assert.ok(shaftBounds.max.z > bounds.max.z);
        const midZ = (bounds.min.z + bounds.max.z) / 2;
        for (let i = 0; i < 64; i++) {
          const p = new Vector3(.105 * Math.cos(i * Math.PI / 32), .105 * Math.sin(i * Math.PI / 32), midZ);
          assert.ok(solid.signedDistance(p) > .0027);
        }
      }
    }
  } finally { disposeObject3D(model.root); }
});
