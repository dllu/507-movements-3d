import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredTextileDressingMovement as textile } from '../src/simulation/authored-textile-dressing.js';
import { createAuthoredPlanerFeedMovement as planer } from '../src/simulation/authored-planer-feeds.js';
import { surfacePoints, surfaceTriangles, solidSurface } from './helpers/solid-surface.mjs';

function audit() {
  const points = new Map(), solids = new Map(), triangles = new Map(), minima = {};
  let queries = 0;
  const check = (a, b, label, journal = false) => {
    if (!points.has(a.geometry)) points.set(a.geometry, surfacePoints(a.geometry));
    if (!solids.has(b.geometry)) solids.set(b.geometry, solidSurface(b.geometry));
    const solid = solids.get(b.geometry), matrix = b.matrixWorld.clone().invert().multiply(a.matrixWorld);
    const verify = point => {
      const gap = solid.signedDistance(point, .1); queries++;
      assert.ok(Number.isFinite(gap)); minima[label] = Math.min(minima[label] ?? .1, gap);
      assert.ok(gap >= -1e-5, `${label}: ${a.userData.role} -> ${b.userData.role}: ${gap}`);
      return gap;
    };
    let minimum = .1;
    for (const point of points.get(a.geometry)) minimum = Math.min(minimum, verify(point.clone().applyMatrix4(matrix)));
    // A long shaft's ends can lie beyond a thin journal. Intersect its actual
    // triangle edges with the journal's interior slices as well as vertices.
    if (journal) {
      if (!triangles.has(a.geometry)) triangles.set(a.geometry, surfaceTriangles(a.geometry));
      for (const triangle of triangles.get(a.geometry)) {
        const vertices = [triangle.a, triangle.b, triangle.c].map(p => p.clone().applyMatrix4(matrix));
        for (const axis of ['x', 'y', 'z']) for (const coordinate of [solid.box.min[axis] + 1e-6, (solid.box.min[axis] + solid.box.max[axis]) / 2, solid.box.max[axis] - 1e-6]) {
          for (let j = 0; j < 3; j++) {
            const a = vertices[j], b = vertices[(j + 1) % 3], t = (coordinate - a[axis]) / (b[axis] - a[axis]);
            if (t >= 0 && t <= 1) verify(a.clone().lerp(b, t));
          }
        }
      }
    }
    return minimum;
  };
  return { check, report: () => ({ queries, minima }) };
}

test('383: actual roll surfaces meet the web; brush solids and rims clear its finite sampled surface', () => {
  const model = textile({ id: 383 }), data = model.root.userData, b = data.blocks, a = audit();
  let maximumBrushGap = 0, maximumWindingGap = 0;
  for (let i = 0; i <= 32; i++) {
    model.update(data.timeline.demonstrationPeriod * i / 32); model.root.updateMatrixWorld(true);
    let brushGap = .1;
    for (const brush of b.brushBars) {
      brushGap = Math.min(brushGap, a.check(b.webRibbon, brush, 'cloth/brush'));
      for (const stripe of b.webMarkers) a.check(stripe, brush, 'cloth marking/brush');
    }
    maximumBrushGap = Math.max(maximumBrushGap, brushGap);
    for (const roller of b.windingRollers) {
      const gap = a.check(b.webRibbon, roller.userData.blocks.rollBody, 'cloth/winding roll');
      maximumWindingGap = Math.max(maximumWindingGap, gap);
      for (const rim of roller.userData.blocks.rollRims) a.check(b.webRibbon, rim, 'cloth/edge rim');
    }
  }
  assert.ok(maximumWindingGap < .0003, maximumWindingGap);
  assert.ok(maximumBrushGap < .001, maximumBrushGap);
  console.log({ id: 383, maximumWindingGap, maximumBrushGap, ...a.report() });
});

test('383: real journal bores and rear crossbars clear each rotating shaft through a full cycle', () => {
  const model = textile({ id: 383 }), d = model.root.userData, b = d.blocks, a = audit();
  for (let i = 0; i <= 16; i++) {
    model.update(d.timeline.demonstrationPeriod * i / 16); model.root.updateMatrixWorld(true);
    for (const roller of b.windingRollers) {
      const p = roller.userData.blocks;
      for (const fixed of [...b.bearingBlocks, ...b.bearingBars, p.rollBody]) a.check(p.axle, fixed, 'winding journal', true);
    }
    for (const fixed of [...b.bearingBlocks, ...b.bearingBars, b.dressingCore]) a.check(b.dressingAxle, fixed, 'brush journal', true);
  }
  console.log({ id: 383, ...a.report() });
});

test('388: pointed feed teeth have bounded intentional wood bite throughout a pitch; smooth support is tangent', () => {
  const model = planer({ id: 388 }), d = model.root.userData, b = d.blocks, g = d.geometry, a = audit();
  const toothPoints = surfacePoints(b.upperTeeth[0].geometry);
  let minBite = Infinity, maxBite = 0, minimumForwardNormal = 1;
  const toothTriangles = surfaceTriangles(b.upperTeeth[0].geometry);
  for (let i = 0; i <= 64; i++) {
    model.update(d.timeline.cycleDuration * i / (64 * g.toothCount)); model.root.updateMatrixWorld(true);
    a.check(b.workpieceBoard, b.lowerRoller.userData.drum, 'wood/smooth support');
    let bite = 0, forward = 0;
    for (const tooth of b.upperTeeth) {
      for (const point of toothPoints) {
        const world = tooth.localToWorld(point.clone());
        if (Math.abs(world.z) < g.plankWidth / 2) bite = Math.max(bite, g.boardTopY - world.y);
      }
      for (const t of toothTriangles) {
        const point = tooth.localToWorld(t.getMidpoint(new THREE.Vector3()));
        if (point.y > g.boardTopY || point.y < g.boardBottomY || Math.abs(point.z) > g.plankWidth / 2) continue;
        const normal = t.getNormal(new THREE.Vector3()).transformDirection(tooth.matrixWorld);
        forward = Math.max(forward, normal.x);
      }
    }
    minBite = Math.min(minBite, bite); maxBite = Math.max(maxBite, bite); minimumForwardNormal = Math.min(minimumForwardNormal, forward);
    assert.ok(bite > .033 && bite <= .050001, bite);
    assert.ok(forward > .1, forward);
  }
  assert.equal(d.workingInterfaces.rigidContactValidated, false);
  assert.match(d.reconstructionNote, /not rigid nonpenetration/);
  console.log({ id: 388, minBite, maxBite, minimumForwardNormal, ...a.report() });
});

test('388: roller shafts clear their actual bearing blocks, collars, support arms and bored bodies', () => {
  const model = planer({ id: 388 }), d = model.root.userData, b = d.blocks, a = audit();
  for (let i = 0; i <= 16; i++) {
    model.update(d.timeline.cycleDuration * i / 16); model.root.updateMatrixWorld(true);
    for (const roller of [b.lowerRoller, b.upperRoller]) {
      const r = roller.userData;
      for (const target of [...b.frameBearingBlocks, ...b.frameBearingRings, ...b.frameArms, r.drum ?? r.core]) a.check(r.shaft, target, 'roller journal', true);
    }
    for (const tooth of b.upperTeeth) for (const target of [...b.frameBearingBlocks, ...b.frameArms]) a.check(tooth, target, 'feed/frame');
  }
  for (const standard of b.frame.userData.standards) {
    const box = new THREE.Box3().setFromObject(standard), base = new THREE.Box3().setFromObject(b.frame.userData.base);
    assert.ok(box.min.y <= base.max.y + 1e-6 && box.max.y > base.max.y);
  }
  console.log({ id: 388, ...a.report() });
});

for (const [id, factory] of [[383, textile], [388, planer]]) test(`${id}: all visible vertices fit for a full cycle; buffers, timing and fog are stable`, () => {
  const model = factory({ id }), d = model.root.userData, saved = [];
  model.root.traverse(o => { if (o.geometry) saved.push([o, o.geometry, o.geometry.attributes.position.array]); for (const material of [].concat(o.material ?? [])) assert.equal(material.fog, false); });
  for (let i = 0; i <= 32; i++) {
    model.update(d.timeline.demonstrationPeriod * i / 32); model.root.updateMatrixWorld(true);
    model.root.traverseVisible(o => { const p = o.geometry?.attributes.position; if (!p) return;
      for (let j = 0; j < p.count; j++) assert.ok(d.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld)), `bounds: ${o.userData.role}`);
    });
  }
  let count = 0; model.root.traverse(o => { if (o.geometry) count++; }); assert.equal(count, saved.length);
  for (const [o, geometry, array] of saved) { assert.equal(o.geometry, geometry); assert.equal(o.geometry.attributes.position.array, array); }
  assert.equal(d.hideGround, true); assert.equal(d.minimumDisplayCycleSeconds, d.timeline.demonstrationPeriod);
  console.log({ id, geometries: count });
});
