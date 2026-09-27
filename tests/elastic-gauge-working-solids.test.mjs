import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createAuthoredBourdonPressureGaugeMovement as bourdon} from '../src/simulation/authored-bourdon-pressure-gauges.js';
import {createAuthoredDiaphragmPressureGaugeMovement as diaphragm} from '../src/simulation/authored-diaphragm-pressure-gauges.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';

for (const [id, create] of [[499, bourdon], [500, diaphragm]]) {
  test(`${id} finite meshing teeth, journals and articulated eyes clear through the pressure cycle`, () => {
    const model = create({id}), d = model.root.userData, b = d.blocks;
    try {
      const links = id === 499 ? b.links : [b.connectingRod];
      const pairs = [[b.sectorRim, b.workingPinion], [b.sectorRim, b.sectorHub], [b.workingPinion, b.pinionShaft]];
      links.forEach((link, l) => {
        for (let i = 0; i < 2; i++) {
          const eye = link.userData.workingSockets[i], ball = link.userData.workingBalls[i];
          const stud = i ? b.sectorInputPins[l] : id === 499 ? b.tubeEndPins[l] : b.diaphragmBoss;
          pairs.push([eye, ball], [eye, stud], [ball, link.children[0]], [stud, b.sectorRim], [stud, b.workingPinion]);
          assert.ok(eye.geometry.userData.portRadius < ball.geometry.parameters.radius, 'socket throat captures its ball');
        }
        for (const part of [link.children[0], ...link.userData.workingSockets, ...link.userData.workingBalls]) pairs.push([part, b.sectorRim]);
      });
      const cache = new Map();
      const get = o => {
        if (!cache.has(o)) cache.set(o, {points: surfacePoints(o.geometry), surface: solidSurface(o.geometry)});
        return cache.get(o);
      };
      let worst = 0, description = '', largestMeshGap = 0;
      for (let i = 0; i <= 32; i++) {
        model.update(d.geometry.cycleDuration * i / 32);
        model.root.updateMatrixWorld(true);
        for (let pair = 0; pair < pairs.length; pair++) {
          let meshGap = Infinity;
          for (const [moving, fixed] of [pairs[pair], [...pairs[pair]].reverse()]) {
            const transform = fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld);
            for (const point of get(moving).points) {
              const q = point.clone().applyMatrix4(transform), target = get(fixed).surface;
              if (pair > 0 && target.box.distanceToPoint(q) > 1e-5) continue;
              const gap = target.signedDistance(q, .02);
              meshGap = Math.min(meshGap, Math.abs(gap));
              if (gap < worst) { worst = gap; description = `${i}: ${moving.userData.role} / ${fixed.userData.role}`; }
            }
          }
          if (pair === 0) largestMeshGap = Math.max(largestMeshGap, meshGap);
        }
      }
      assert.ok(worst > -2e-6, `${description}: ${worst}`);
      assert.ok(largestMeshGap < .002, `mesh remains engaged: ${largestMeshGap}`);
    } finally { disposeObject3D(model.root); }
  });

  test(`${id} pressure feed has a real bore and keeps its illustrative core inside the pipe`, () => {
    const model = create({id}), b = model.root.userData.blocks;
    try {
      const pipe = id === 499 ? b.pressurePassage : b.inletPipe;
      const core = id === 499 ? b.pressureCore : b.inletPressureCore;
      const shell = solidSurface(pipe.geometry);
      const curve = core.geometry.parameters.path;
      for (let i = 1; i < 32; i++) assert.equal(shell.inside(curve.getPoint(i / 32)), false);
      for (const p of surfacePoints(core.geometry)) assert.ok(shell.signedDistance(p, .02) > -2e-6);
      const collar = solidSurface(b.inletCollar.geometry);
      // 500's collar is Brown's stem below the case (pass 82): a bored sleeve
      // over the inlet pipe from the case down to the hex union nut.
      const y = id === 499 ? 0 : -4.1;
      assert.equal(collar.inside(new T.Vector3(0, y, 0)), false);
      assert.equal(collar.inside(new T.Vector3(.35, y, 0)), true);
    } finally { disposeObject3D(model.root); }
  });

  test(`${id} retains GPU geometry and readable eight-second playback`, () => {
    const model = create({id}), d = model.root.userData;
    try {
      const snapshot = () => { const objects = []; model.root.traverse(o => objects.push([o, o.geometry])); return objects; };
      const before = snapshot();
      for (let i = 0; i <= 128; i++) model.update(d.geometry.cycleDuration * i / 128);
      assert.deepEqual(snapshot(), before);
      assert.equal(d.minimumDisplayCycleSeconds, 8);
      assert.equal(d.hideGround, true);
      assert.match(d.workingPartsReview.residual, /remain prescribed/);
    } finally { disposeObject3D(model.root); }
  });
}

test('499 deformed tube keeps finite flattened walls around an open pressure lumen at every sampled pose', () => {
  const model = bourdon({id: 499});
  try {
    for (let pose = 0; pose <= 16; pose++) {
      model.update(pose / 2);
      for (const branch of model.root.userData.blocks.tubeBranches) {
        // The tube buffer deforms in place: rebuild the independent BVH per pose.
        const surface = solidSurface(branch.geometry), points = branch.userData.centerlinePoints;
        for (let i = 1; i < points.length - 1; i++) {
          const tangent = points[i + 1].clone().sub(points[i - 1]).normalize();
          const normal = new T.Vector3(-tangent.y, tangent.x, 0);
          assert.equal(surface.inside(points[i]), false, 'open pressure lumen');
          assert.equal(surface.inside(points[i].clone().addScaledVector(normal, .115)), true, 'finite side wall');
          assert.equal(surface.inside(points[i].clone().add(new T.Vector3(0, 0, .056))), true, 'finite front wall');
        }
      }
    }
  } finally { disposeObject3D(model.root); }
});
