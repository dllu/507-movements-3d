import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  filletPulleySpokes,
  spokedWheelGeometry,
  spokedWheelOutline,
  spokedWheelParameters,
} from '../src/simulation/spoked-wheel.js';
import { makePulley } from '../src/simulation/primitives.js';

const radiusOf = ([x, y]) => Math.hypot(x, y);
const area = (ring) => ring.reduce((sum, [x0, y0], i) => {
  const [x1, y1] = ring[(i + 1) % ring.length];
  return sum + (x0 * y1 - x1 * y0) / 2;
}, 0);

// Edges of a closed indexed mesh: every edge is shared by exactly two faces
// that traverse it in opposite directions.
function assertClosedOriented(geometry) {
  const index = geometry.index.array;
  const position = geometry.attributes.position;
  const key = (i) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(6)).join(',');
  const edges = new Map();
  for (let f = 0; f < index.length; f += 3) {
    for (let k = 0; k < 3; k += 1) {
      const a = key(index[f + k]);
      const b = key(index[f + (k + 1) % 3]);
      edges.set(`${a}|${b}`, (edges.get(`${a}|${b}`) ?? 0) + 1);
    }
  }
  for (const [edge, count] of edges) {
    const [a, b] = edge.split('|');
    assert.equal(count, 1, `edge used twice in one direction: ${edge}`);
    assert.equal(edges.get(`${b}|${a}`), 1, `open or non-manifold edge: ${edge}`);
  }
}

test('default spoked wheel: four three-piece windows meeting rim and hub, larger hub fillet', () => {
  const p = spokedWheelParameters();
  const { outer, windows, bore } = spokedWheelOutline(p);
  assert.equal(windows.length, 4);
  assert.ok(bore.length > 24);
  assert.ok(area(outer) > 0);
  for (const window of windows) {
    assert.ok(area(window) > 0, 'windows run anticlockwise before being reversed as holes');
    const radii = window.map(radiusOf);
    // The window reaches the rim's inside (concentric arc) exactly and never
    // cuts into the rim.
    assert.ok(Math.abs(Math.max(...radii) - p.rimInnerRadius) < 1e-9);
    // The web stays solid out to the hub radius.
    assert.ok(Math.abs(Math.min(...radii) - p.hubRadius) < 1e-6);
  }
  // Solve the automatic hub fillet back from the outline: it exceeds the
  // rim fillet (default proportions).
  const q = Math.SQRT2 * (p.spokeWidth / 2);
  const hubFillet = (p.hubRadius - q) / (Math.SQRT2 - 1);
  assert.ok(hubFillet > 2 * p.rimFillet);
});

test('the extruded plate is one closed, oriented, crease-shaded solid of the given thickness', () => {
  const geometry = spokedWheelGeometry({ spokes: 5, outerRadius: 2, thickness: 0.3, phase: 0.2 });
  geometry.computeBoundingBox();
  assert.ok(Math.abs(geometry.boundingBox.max.z - 0.15) < 1e-6 && Math.abs(geometry.boundingBox.min.z + 0.15) < 1e-6);
  assert.ok(Math.abs(geometry.boundingBox.max.x - 2) < 1e-6);
  assert.equal(geometry.userData.spokedWheel.spokes, 5);
  assertClosedOriented(geometry);
  // Flat faces keep exact axial normals; walls are radial-ish (no normal
  // averaged across the face-to-wall crease).
  const normal = geometry.attributes.normal;
  let axial = 0;
  for (let i = 0; i < normal.count; i += 1) {
    const nz = Math.abs(normal.getZ(i));
    assert.ok(nz > 1 - 1e-6 || nz < 1e-6, 'no normal averaged across a face/wall edge');
    if (nz > 0.5) axial += 1;
  }
  assert.ok(axial > 0);
});

test('a tooth outline replaces the rim circle; spokes can taper; windows can close on a hub arc', () => {
  const teeth = 20;
  const outline = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = (i / teeth) * Math.PI * 2;
    outline.push([Math.cos(a) * 1.0, Math.sin(a) * 1.0], [Math.cos(a + Math.PI / teeth) * 1.12, Math.sin(a + Math.PI / teeth) * 1.12]);
  }
  const { outer, windows } = spokedWheelOutline({ outline, rimInnerRadius: 0.85, spokeWidth: 0.16, spokeTipWidth: 0.08 });
  assert.equal(outer.length, outline.length);
  assert.equal(windows.length, 4);
  const hubArc = spokedWheelOutline({ hubArcRadius: 0.4, hubFillet: 0.03, rimFillet: 0.03 });
  for (const window of hubArc.windows) {
    const radii = window.map(radiusOf);
    assert.ok(Math.abs(Math.min(...radii) - 0.4) < 1e-9, 'inner concentric arc');
  }
  assert.throws(() => spokedWheelOutline({ spokes: 2 }));
});

test('filletPulleySpokes recasts a bar-spoked pulley as one plate bored for its hub', () => {
  const pulley = filletPulleySpokes(makePulley({ radius: 1, width: 0.3 }));
  const rotor = pulley.userData.rotor;
  assert.equal(pulley.userData.spokes.length, 0);
  assert.equal(rotor.children.filter((child) => child.userData.role === 'radial-pulley-spoke').length, 0);
  const tread = pulley.userData.tread;
  const wheel = tread.geometry.userData.spokedWheel;
  assert.equal(wheel.spokes, 4);
  assert.ok(Math.abs(wheel.boreRadius - 0.26) < 1e-6, 'bored exactly for the dark hub');
  assert.ok(wheel.hubRadius > wheel.boreRadius);
  assert.equal(tread.userData.noRotationIndicator, true);
  // Still stands in the pulley plane (axis along the pulley's Z).
  tread.updateMatrix();
  const box = new THREE.Box3().setFromBufferAttribute(tread.geometry.attributes.position).applyMatrix4(tread.matrix);
  assert.ok(Math.abs(box.max.z - 0.15) < 1e-6 && Math.abs(box.max.x - 1) < 1e-6 && Math.abs(box.max.y - 1) < 1e-3);
});
