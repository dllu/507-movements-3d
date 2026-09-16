import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredHelicographMovement as create } from '../src/simulation/authored-helicographs.js';
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

test('384 closed complementary male/nut threads clear through the full inward and return sweep', () => {
  const model = create({ id: 384 }), d = model.root.userData, b = d.blocks, check = audit();
  const male = b.screwThread.geometry.userData.thread, female = b.wheelInternalThread.geometry.userData.thread;
  assert.ok(male.inner < d.geometry.screwCoreRadius);
  assert.ok(female.outer > d.geometry.wheelHubBoreRadius);
  assert.ok(female.inner > d.geometry.screwCoreRadius);
  for (let i = 0; i <= 32; i++) {
    model.update(d.timeline.cycleDuration * i / 32); model.root.updateMatrixWorld(true);
    check.check(b.wheelInternalThread, b.screwThread, 'female/male');
    check.check(b.screwThread, b.wheelInternalThread, 'male/female');
    check.check(b.screwThread, b.wheelHub, 'male/hub');
    check.check(b.screwCore, b.wheelInternalThread, 'core/nut', true);
    check.check(b.screwCore, b.wheelHub, 'core/hub', true);
    for (const spoke of b.wheelSpokes) check.check(b.screwThread, spoke, 'screw/spokes');
  }
  console.log({ id: 384, ...check.report() });
});

test('384 nut retains close opposing axial working flanks at every sampled station', () => {
  const model = create({ id: 384 }), d = model.root.userData, b = d.blocks;
  const male = solidSurface(b.screwThread.geometry), flanks = surfaceTriangles(b.wheelInternalThread.geometry)
    .map(t => ({ point: t.getMidpoint(new THREE.Vector3()), normal: t.getNormal(new THREE.Vector3()) }))
    .filter(p => Math.abs(p.normal.x) > .6 && Math.abs(p.point.x) < d.geometry.wheelWidth / 2 - .001);
  let maximumGap = 0, minimumAxialNormal = 1;
  for (let i = 0; i <= 64; i++) {
    model.update(d.timeline.cycleDuration * i / 64); model.root.updateMatrixWorld(true);
    const matrix = b.screwThread.matrixWorld.clone().invert().multiply(b.wheelInternalThread.matrixWorld);
    for (const sign of [-1, 1]) {
      let nearest = Infinity;
      for (const f of flanks) {
        if (f.normal.x * sign < .6) continue;
        const p = f.point.clone().applyMatrix4(matrix), gap = male.distance(p, .02);
        if (gap < nearest) { nearest = gap; minimumAxialNormal = Math.min(minimumAxialNormal, Math.abs(f.normal.x)); }
      }
      assert.ok(nearest < .0035, `${i}, flank ${sign}: ${nearest}`); maximumGap = Math.max(maximumGap, nearest);
    }
  }
  console.log({ id: 384, maximumOpposingFlankGap: maximumGap, minimumAxialNormal });
});

test('384 finite rim meets the transfer paper and all other wheel hardware clears the paper', () => {
  const model = create({ id: 384 }), d = model.root.userData, b = d.blocks;
  let maximumRimGap = 0, minimumRimGap = Infinity;
  const parts = [b.wheelRim, b.wheelHub, b.wheelFace, ...b.wheelSpokes, b.wheelInternalThread, b.wheelFaceIndex];
  const points = new Map(parts.map(mesh => [mesh, surfacePoints(mesh.geometry)]));
  const paperTop = b.transferPaper.position.y;
  assert.equal(paperTop, d.geometry.drawingPlaneY);
  for (let i = 0; i <= 64; i++) {
    model.update(d.timeline.cycleDuration * i / 64); model.root.updateMatrixWorld(true);
    let rimGap = Infinity;
    for (const mesh of parts) for (const local of points.get(mesh)) {
      const p = mesh.localToWorld(local.clone()), gap = p.y - paperTop;
      assert.ok(gap > -1e-6, `${mesh.userData.role} cuts paper ${gap}`);
      if (mesh === b.wheelRim) rimGap = Math.min(rimGap, gap);
    }
    assert.ok(rimGap < .00014, rimGap);
    maximumRimGap = Math.max(maximumRimGap, rimGap); minimumRimGap = Math.min(minimumRimGap, rimGap);
  }
  assert.equal(b.wheelTreadIndex.visible, false); assert.equal(b.liveContact.visible, false);
  const trace = b.transferredTrace.geometry.attributes.position;
  for (let i = 0; i < trace.count; i++) assert.ok(trace.getY(i) < paperTop);
  console.log({ id: 384, minimumRimGap, maximumRimGap });
});

test('384 pivot eye clears its actual spindle and the fixed cone has a downward point', () => {
  const model = create({ id: 384 }), d = model.root.userData, b = d.blocks, check = audit();
  for (let i = 0; i <= 16; i++) {
    model.update(d.timeline.cycleDuration * i / 16); model.root.updateMatrixWorld(true);
    check.check(b.pivotSleeve, b.boredBridge, 'fixed spindle/orbiting eye', true);
  }
  const needlePoints = surfacePoints(b.needle.geometry).map(p => b.needle.localToWorld(p.clone()));
  const minimumY = Math.min(...needlePoints.map(p => p.y));
  assert.ok(Math.abs(minimumY - d.geometry.drawingPlaneY) < 1e-7);
  for (const p of needlePoints.filter(p => Math.abs(p.y - minimumY) < 1e-7)) assert.ok(Math.hypot(p.x, p.z) < 1e-7);
  const sleeve = new THREE.Box3().setFromObject(b.pivotSleeve), knob = new THREE.Box3().setFromObject(b.pivotKnob);
  assert.ok(sleeve.max.y > knob.min.y);
  for (const spoke of b.wheelSpokes) {
    const axis = new THREE.Vector3(0, 1, 0).applyEuler(spoke.rotation);
    assert.ok(axis.dot(spoke.position.clone().normalize()) > 1 - 1e-12);
  }
  console.log({ id: 384, ...check.report() });
});

test('384 thread and flat trace normals face outwards; full-cycle fit and allocations remain stable', () => {
  const model = create({ id: 384 }), d = model.root.userData, b = d.blocks, saved = [];
  for (const mesh of [b.screwThread, b.wheelInternalThread]) {
    let volume = 0; for (const t of surfaceTriangles(mesh.geometry)) volume += t.a.dot(new THREE.Vector3().crossVectors(t.b, t.c)) / 6;
    assert.ok(volume > 0, volume);
  }
  for (const t of surfaceTriangles(b.transferredTrace.geometry)) assert.ok(t.getNormal(new THREE.Vector3()).y > .999);
  model.root.traverse(o => { if (o.geometry) saved.push([o, o.geometry, o.geometry.attributes.position.array]); for (const m of [].concat(o.material ?? [])) assert.equal(m.fog, false); });
  for (let i = 0; i <= 32; i++) {
    model.update(d.timeline.cycleDuration * i / 32); model.root.updateMatrixWorld(true);
    model.root.traverseVisible(o => { const p = o.geometry?.attributes.position; if (!p) return;
      for (let j = 0; j < p.count; j++) assert.ok(d.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld)), o.userData.role);
    });
  }
  let count = 0; model.root.traverse(o => { if (o.geometry) count++; }); assert.equal(count, saved.length);
  for (const [o, geometry, array] of saved) { assert.equal(o.geometry, geometry); assert.equal(o.geometry.attributes.position.array, array); }
  assert.equal(d.hideGround, true); assert.equal(d.minimumDisplayCycleSeconds, d.timeline.cycleDuration);
  assert.match(d.reconstructionNote, /scrubs axially/); assert.match(d.reconstructionNote, /not simulated/);
});
