import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredSiphonPressureGaugeMovement as siphon} from '../src/simulation/authored-siphon-pressure-gauges.js';
import {createAuthoredMercurialBarometerMovement as barometer} from '../src/simulation/authored-mercurial-barometers.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

for (const [id, create] of [[498, siphon], [501, barometer]]) {
  test(`${id} glass has a finite wall, continuous bore and nonpenetrating mercury`, () => {
    const m = create({id}), d = m.root.userData, b = d.blocks, g = d.geometry;
    try {
      const legs = id === 498 ? b.glassLegs : [b.glassLongLeg];
      const fluid = id === 498 ? b.mercuryColumns : [b.longMercuryColumn];
      const pairs = legs.map((leg, i) => [fluid[i], leg]);
      pairs.push([b.mercuryBend, b.glassBend]);
      if (id === 501) pairs.push([b.reservoirMercury, b.reservoirBulb], [b.lowerShortMercury, b.reservoirBulb], [b.lowerShortMercury, b.glassShortLower]);
      const cache = new Map();
      const get = o => {
        if (!cache.has(o)) cache.set(o, {surface: solidSurface(o.geometry), points: surfacePoints(o.geometry)});
        return cache.get(o);
      };
      for (let i = 0; i <= 16; i++) {
        m.update(g.cycleDuration * (i + .19) / 17); m.root.updateMatrixWorld(true);
        for (const [a, c] of pairs) {
          const tr = c.matrixWorld.clone().invert().multiply(a.matrixWorld);
          for (const p of get(a).points) {
            const q = p.clone().applyMatrix4(tr);
            assert.ok(get(c).surface.signedDistance(q, .015) >= -2e-6, `${id}: mercury crosses ${c.userData.role}`);
          }
        }
      }
      for (const leg of legs) {
        const s = get(leg).surface;
        assert.equal(s.inside(new T.Vector3(0, 0, 0)), false, 'open center');
        assert.equal(s.inside(new T.Vector3(g.glassOuterRadius - .01, 0, 0)), true, 'finite wall');
      }
      const bend = get(b.glassBend).surface;
      assert.equal(bend.inside(new T.Vector3(0, g.bendTangentY - g.legCenterX, 0)), false);
      assert.equal(bend.inside(new T.Vector3(0, g.bendTangentY - g.legCenterX, g.glassOuterRadius - .01)), true);
    } finally { disposeObject3D(m.root); }
  });

  test(`${id} retaining clips clear the glass and playback retains GPU storage`, () => {
    const m = create({id}), d = m.root.userData, b = d.blocks, g = d.geometry;
    try {
      const clips = id === 498 ? b.tubeClamps : b.retainingClips;
      m.root.updateMatrixWorld(true);
      const base = new T.Box3().setFromObject(id === 498 ? b.base : b.supportBase);
      const post = new T.Box3().setFromObject(id === 498 ? b.backPost : b.supportSpine);
      const bend = new T.Box3().setFromObject(b.glassBend);
      assert.ok(bend.min.y > base.max.y, 'lower glass bend clears the display base');
      assert.ok(Math.abs(post.min.y - base.max.y) < 1e-6, 'post meets the lowered base');
      for (let i = 0; i < clips.length; i++) {
        const surface = solidSurface(clips[i].geometry);
        const xs = id === 498 || i === 0 ? [-g.legCenterX, g.legCenterX] : [g.legCenterX];
        for (const x of xs) for (let j = 0; j < 96; j++) {
          const a = j / 96 * 2 * Math.PI;
          assert.equal(surface.inside(new T.Vector3(x + g.glassOuterRadius * Math.cos(a), 0, g.glassOuterRadius * Math.sin(a))), false);
        }
      }
      const objects = []; m.root.traverse(o => objects.push([o, o.geometry, o.geometry?.attributes.position.array]));
      for (let i = 0; i < 64; i++) m.update(i * .17);
      const after = []; m.root.traverse(o => after.push(o)); assert.equal(after.length, objects.length);
      for (const [o, geometry, array] of objects) { assert.equal(o.geometry, geometry); assert.equal(o.geometry?.attributes.position.array, array); }
      assert.equal(d.minimumDisplayCycleSeconds, 8); assert.equal(d.hideGround, true);
    } finally { disposeObject3D(m.root); }
  });
}

test('498 pressure elbow joins the left leg with a downward tangent and an open flange', () => {
  const m = siphon({id: 498}), b = m.root.userData.blocks, g = m.root.userData.geometry;
  try {
    const path = b.pressureConnection.userData.centerline;
    assert.ok(path.getPoint(1).distanceTo(new T.Vector3(-g.legCenterX, g.tubeTopY, 0)) < 1e-12);
    assert.ok(path.getTangent(1).distanceTo(new T.Vector3(0, -1, 0)) < 1e-3);
    for (const mesh of [b.boilerFlange, b.valveBoss]) assert.equal(solidSurface(mesh.geometry).inside(new T.Vector3()), false);
    const surface = solidSurface(b.pressureConnection.geometry);
    for (let i = 1; i < 100; i++) assert.equal(surface.inside(path.getPointAt(i / 100)), false);
  } finally { disposeObject3D(m.root); }
});

test('501 working reservoir matches its hydraulic area and leaves a sealed vacuum cap', () => {
  const m = barometer({id: 501}), d = m.root.userData, b = d.blocks, g = d.geometry;
  try {
    const reservoir = solidSurface(b.reservoirBulb.geometry);
    for (let i = 0; i <= 16; i++) {
      const y = d.stateAtTime(g.cycleDuration * i / 16).leftSurfaceY;
      assert.equal(reservoir.inside(new T.Vector3(g.reservoirInnerRadius, y, 0)), false);
      assert.equal(reservoir.inside(new T.Vector3(g.reservoirInnerRadius + .025, y, 0)), true);
    }
    const cap = solidSurface(b.sealedLongCap.geometry);
    assert.equal(cap.inside(new T.Vector3(.01, .03, 0)), false);
    assert.equal(cap.inside(new T.Vector3(.01, .08, 0)), true);
  } finally { disposeObject3D(m.root); }
});
