import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredBeltMovement as create } from '../src/simulation/authored-belts.js';
import { surfacePoints, surfaceTriangles, solidSurface } from './helpers/solid-surface.mjs';

function audit() {
  const points = new Map(), solids = new Map(), triangles = new Map(), minima = {};
  let queries = 0;
  const check = (a, b, label, journal = false, dynamic = false) => {
    if (dynamic || !points.has(a.geometry)) points.set(a.geometry, surfacePoints(a.geometry));
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

const visibleMeshes = root => { const result = []; root.traverseVisible(o => { if (o.isMesh) result.push(o); }); return result; };

test('242 braking starts only after slack take-up; unloading finishes before the lever returns', () => {
  const m = create({ id: 242 }), d = m.root.userData;
  for (let i = 0; i <= 1000; i++) {
    const s = d.stateAtCycleCoordinate(i / 1000);
    if (s.brakeEngagement > 1e-10) { assert.equal(s.bandTaut, true); assert.ok(s.bandPath.slackLength < 1e-10); }
    if (!s.bandTaut) assert.equal(s.brakeEngagement, 0);
    assert.equal(s.brakeNormalForce, null);
  }
  for (const phase of [d.geometry.releasedEnd, d.geometry.brakingStart, d.geometry.applicationEnd,
    d.geometry.appliedHoldEnd, d.geometry.accelerationEnd, d.geometry.releaseEnd, 1]) {
    const a = d.stateAtCycleCoordinate(phase - 1e-7), b = d.stateAtCycleCoordinate(phase + 1e-7);
    assert.ok(a.lowerBandEnd.distanceTo(b.lowerBandEnd) < 1e-5);
    assert.ok(Math.abs(a.leverAngularSpeed - b.leverAngularSpeed) < 1e-5);
    assert.ok(Math.abs(a.wheelAngle - b.wheelAngle) < 1e-5);
  }
  assert.equal(d.dynamics.forceValidated, false); assert.match(d.reconstructionNote, /not validated braking dynamics/);
});

test('242 the actual updated band clears the drum, and taut working faces remain close', () => {
  const m = create({ id: 242 }), d = m.root.userData, b = d.blocks, a = audit();
  let maximumTautGap = 0;
  for (let i = 0; i <= 32; i++) {
    m.update(d.geometry.cyclePeriod * i / 32); m.root.updateMatrixWorld(true);
    // setPoints updates the same GPU buffer, so refresh surface samples after
    // every pose rather than reusing points from the initial slack shape.
    const gap = a.check(b.brakeBand, b.wheelBody, 'live band/drum', false, true);
    if (d.kinematics.bandTaut) { maximumTautGap = Math.max(maximumTautGap, gap); assert.ok(gap < .001, gap); }
    for (const eye of [d.workingParts.upperEye, d.workingParts.lowerEye]) a.check(eye, b.wheelBody, 'strap eyes/drum');
  }
  console.log({ id: 242, maximumTautGap, ...a.report() });
});

test('242 new end pins span bored strap eyes and lever layers without cutting them', () => {
  const m = create({ id: 242 }), d = m.root.userData, b = d.blocks, p = d.workingParts, a = audit();
  const wheelShaft = visibleMeshes(b.wheelShaft)[0], fulcrum = visibleMeshes(b.leverFulcrumShaft)[0], upper = visibleMeshes(b.upperEndpointShaft)[0];
  for (let i = 0; i <= 16; i++) {
    m.update(d.geometry.cyclePeriod * i / 16); m.root.updateMatrixWorld(true);
    for (const target of [b.wheelBody, b.wheelHub, p.wheelPost]) a.check(wheelShaft, target, 'wheel shaft', true);
    for (const target of [p.short, p.long, p.anchor, p.fulcrumPost]) a.check(fulcrum, target, 'lever fulcrum', true);
    for (const target of [p.upperEye, p.anchor]) a.check(upper, target, 'upper strap pin', true);
    for (const target of [p.lowerEye, p.short, p.lowerRing]) a.check(p.lowerPin, target, 'lower strap pin', true);
    a.check(b.brakeBand, p.lowerPin, 'band/lower pin', false, true);
    a.check(b.brakeBand, upper, 'band/upper pin', false, true);
    for (const moving of [p.short, p.long, p.lowerPin, p.lowerRing]) a.check(moving, p.anchor, 'lever/fixed anchor');
    const pin = new THREE.Box3().setFromObject(p.lowerPin);
    for (const part of [p.lowerEye, p.short]) {
      const box = new THREE.Box3().setFromObject(part); assert.ok(pin.min.z < box.min.z && pin.max.z > box.max.z);
    }
  }
  console.log({ id: 242, ...a.report() });
});

test('242 strap eyes, anchor link and lever form one flat joint with pins trimmed to the stack', () => {
  const m = create({ id: 242 }), d = m.root.userData, b = d.blocks, j = d.flatBrakeJoint;
  m.update(0); m.root.updateMatrixWorld(true);
  const box = (o) => new THREE.Box3().setFromObject(o);
  // Lever against the strap front, link against its back: the whole joint
  // is under half a unit deep.
  assert.ok(j.leverFront - j.stackBack < 0.46, `stack ${j.leverFront - j.stackBack}`);
  assert.ok(box(d.workingParts.short).min.z - j.bandFront < 0.01);
  assert.ok(j.bandBack - box(d.workingParts.anchor).max.z < 0.01);
  // The fulcrum boss joins the lever eye to the link.
  const boss = box(d.workingParts.boss);
  assert.ok(boss.min.z - box(d.workingParts.anchor).max.z < 0.002);
  assert.ok(box(d.workingParts.short).min.z - boss.max.z < 0.002);
  for (const pin of [b.leverFulcrumShaft, b.upperEndpointShaft, d.workingParts.lowerPin]) {
    const p = box(pin);
    assert.ok(p.min.z > j.stackBack - 0.035 && p.max.z < j.leverFront + 0.1, `${p.min.z} ${p.max.z}`);
  }
});

test('243 finite belt surfaces clear all five actual pulleys; undrawn band markers are not rendered', () => {
  const m = create({ id: 243 }), d = m.root.userData, b = d.blocks, a = audit();
  assert.ok(b.belt.userData.markers.every((marker) => marker.parent === null), 'Brown draws no marks on the band');
  const pulleys = [b.driver, b.leftGuide, b.rightGuide, b.leftVertical, b.rightVertical], ribbon = b.belt.userData.ribbon;
  let maximumWorkingGap = 0;
  for (let i = 0; i <= 32; i++) {
    m.update(d.geometry.cyclePeriod * i / 32); m.root.updateMatrixWorld(true);
    for (const pulley of pulleys) {
      const gap = a.check(ribbon, pulley.userData.tread, 'belt/working tread'); maximumWorkingGap = Math.max(maximumWorkingGap, gap);
      assert.ok(gap < .0015, `${pulley.userData.role}: ${gap}`);
      for (const solid of visibleMeshes(pulley)) {
        a.check(ribbon, solid, 'belt/pulley');
      }
    }
  }
  console.log({ id: 243, maximumWorkingGap, ...a.report() });
});

test('243 actual shafts clear bored pulley hubs and connected spokes', () => {
  const m = create({ id: 243 }), d = m.root.userData, b = d.blocks, a = audit();
  for (let i = 0; i <= 16; i++) {
    m.update(d.geometry.cyclePeriod * i / 16); m.root.updateMatrixWorld(true);
    for (const [pulley, shaft] of [[b.driver, b.driverShaft], [b.leftGuide, b.leftGuideShaft], [b.rightGuide, b.rightGuideShaft],
      [b.leftVertical, b.leftVerticalShaft], [b.rightVertical, b.rightVerticalShaft]]) {
      for (const s of visibleMeshes(shaft)) for (const part of [pulley.userData.hub, ...pulley.userData.spokes]) a.check(s, part, 'shaft/pulley', true);
    }
  }
  console.log({ id: 243, ...a.report() });
});

for (const id of [242, 243]) test(`${id}: full-cycle visible fit, geometry buffers, normals and shadows`, () => {
  const m = create({ id }), d = m.root.userData, saved = [];
  m.root.traverse(o => { if (o.geometry) saved.push([o, o.geometry, o.geometry.attributes.position.array]); for (const material of [].concat(o.material ?? [])) assert.equal(material.fog, false); });
  for (let i = 0; i <= 32; i++) {
    m.update(d.geometry.cyclePeriod * i / 32); m.root.updateMatrixWorld(true);
    m.root.traverseVisible(o => { const p = o.geometry?.attributes.position; if (!p) return;
      for (let j = 0; j < p.count; j++) assert.ok(d.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld)), `bounds ${o.userData.role}`);
    });
    const band = id === 242 ? d.blocks.brakeBand : d.blocks.belt.userData.ribbon;
    let volume = 0; for (const t of surfaceTriangles(band.geometry)) volume += t.a.dot(new THREE.Vector3().crossVectors(t.b, t.c)) / 6;
    assert.ok(volume > 0, `band winding ${volume}`);
  }
  let count = 0; m.root.traverse(o => { if (o.geometry) count++; }); assert.equal(count, saved.length);
  for (const [o, geometry, array] of saved) { assert.equal(o.geometry, geometry); assert.equal(o.geometry.attributes.position.array, array); }
  assert.equal(d.hideGround, true); assert.equal(d.minimumDisplayCycleSeconds, 6);
  for (const o of visibleMeshes(m.root)) if (!o.userData.noShadow) assert.equal(o.castShadow, true);
});
