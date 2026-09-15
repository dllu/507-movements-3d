import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { createAuthoredLinkageMovement } from '../src/simulation/authored-linkages.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { solidSurface } from './helpers/solid-surface.mjs';

test('145 rendered pin bores close on the independent linkage pins throughout a revolution', () => {
  const model = createAuthoredLinkageMovement({ id: 145 });
  try {
    const b = model.root.userData.blocks;
    const primary = b.primaryConnectingRod.children[0], connector = b.beamConnectingRod.children[0];
    const pairs = [[primary,b.crankPin], [primary,b.tiePin],
      [primary,b.slidingStandard.userData.blocks.sliderWristPin],
      [connector,b.tiePin], [connector,b.beamEndPin],
      [b.beamBody,b.beamEndPin], [b.beamBody,b.beamPivotPin]];
    const solids = new Map([primary,connector,b.beamBody].map(body => [body,solidSurface(body.geometry)]));
    for (let pose = 0; pose <= 64; pose++) {
      model.update(8 * pose / 64); model.root.updateMatrixWorld(true);
      for (const [body,pin] of pairs) {
        const axis = pin.getWorldPosition(new Vector3());
        const bounds = new Box3().setFromObject(body);
        const inverse = body.matrixWorld.clone().invert();
        for (let i = 0; i < 48; i++) {
          const point = new Vector3(axis.x + .105 * Math.cos(i * Math.PI / 24),
            axis.y + .105 * Math.sin(i * Math.PI / 24), (bounds.min.z + bounds.max.z) / 2);
          assert.ok(solids.get(body).signedDistance(point.applyMatrix4(inverse)) > .0027);
        }
      }
      assert.ok(new Box3().setFromObject(b.flywheelShaft).max.z + .02
        < new Box3().setFromObject(primary).min.z, 'wheel shaft ends behind the rod');
    }
  } finally { disposeObject3D(model.root); }
});
