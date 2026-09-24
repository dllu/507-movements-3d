import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {makeSelectorRackDrive} from '../src/simulation/selector-rack.js';
import {makeSelectorRackFreeCandidate} from '../scripts/lib/selector-rack-free-candidate.mjs';
import {makeSelectorRackDynamics} from '../scripts/lib/selector-rack-dynamics.mjs';
import {solidSurface, surfacePoints, surfaceTriangles} from './helpers/solid-surface.mjs';

const near = (a, b, tolerance = 1e-9) => assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const dispose = m => m.root.traverse(o => {o.geometry?.dispose(); o.material?.dispose();});

test('084 uses the measured single cam, complete wheel and open suspension slots', () => {
  const m = createMovementModel({id: 84}), u = m.root.userData;
  assert.equal(u.mechanism, 'single-cam-governor-selected-double-rack'); assert.equal(u.fidelity, 'authored'); assert(u.hideGround);
  const rack = solidSurface(u.parts.slottedRackFrame.geometry), {center, scale} = u.source;
  for (const slot of u.source.slots) {
    const x = ((slot.left + slot.right) / 2 - center[0]) / scale, y = (center[1] - (slot.top + slot.bottom) / 2) / scale;
    assert.equal(rack.inside(new THREE.Vector3(x, y, 0)), false, 'Suspension slots are holes through the plate');
  }
  const wheel = u.parts.fullCurvedSpokeWheel.geometry.attributes.position;
  const radius = Math.max(...Array.from({length: wheel.count}, (_, i) => Math.hypot(wheel.getX(i), wheel.getY(i))));
  near(radius * scale, 231.4045, .001);
  assert.equal(u.source.upper.length, 13); assert.equal(u.source.lower.length, 14);
  near(u.animationTiming.playbackTimeScale, 1); near(u.playbackDuration, 17.2);
  m.update(17.2); assert(u.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(m.root, true))); dispose(m);
});

test('084 parts remain closed solids with consistent face winding', () => {
  const m = makeSelectorRackDrive();
  for (const [name, mesh] of Object.entries(m.root.userData.parts)) {
    const edges = new Map(); let volume = 0;
    for (const t of surfaceTriangles(mesh.geometry)) {
      const vertices = [t.a, t.b, t.c]; assert(t.getArea() > 1e-14, name + ' degenerate triangle');
      volume += t.a.dot(t.b.clone().cross(t.c)) / 6;
      const keys = vertices.map(v => v.toArray().join(','));
      for (let i = 0; i < 3; i++) {const a = keys[i], b = keys[(i + 1) % 3], key = [a, b].sort().join('/'), edge = edges.get(key) ?? {count: 0, sign: 0};
        edge.count++; edge.sign += a < b ? 1 : -1; edges.set(key, edge);}
    }
    assert(volume > 0, name + ' volume'); assert([...edges.values()].every(e => e.count === 2 && e.sign === 0), name + ' closure');
  }
  dispose(m);
});

test('084 production preserves reviewed geometry and the exact governor inputs', () => {
  const m = makeSelectorRackDrive(), u = m.root.userData, candidate = makeSelectorRackFreeCandidate(), physics = makeSelectorRackDynamics(candidate);
  for (let i = 0; i <= 180; i++) {
    const time = u.playbackDuration * i / 180, state = u.stateAtTime(time), input = physics.input(time);
    near(state.camAngle, input.camAngle); near(state.selectorY, input.selectorY);
    if (i % 10) continue;
    m.update(time); candidate.setState(state);
    for (const [name, mesh] of Object.entries(u.parts)) {
      const expected = candidate.root.userData.parts[name]; assert.deepEqual(mesh.matrixWorld.elements, expected.matrixWorld.elements, name);
      for (const attr of ['position', 'normal']) assert.deepEqual(mesh.geometry.attributes[attr].array, expected.geometry.attributes[attr].array, name);
      assert.deepEqual(mesh.geometry.index?.array, expected.geometry.index?.array, name);
    }
  }
  assert.throws(() => u.stateAtTime(NaN)); assert.throws(() => u.stateAtTime(Infinity)); dispose(m); dispose(candidate);
});

test('084 walks the rack along its teeth both ways, retains free tilt and holds its final pose for replay', () => {
  const m = makeSelectorRackDrive(), u = m.root.userData, first = u.stateAtTime(0), end = u.stateAtTime(17.2);
  // Two cam turns on the upper rack, two on the lower, two on the upper.
  const offset = time => (u.stateAtTime(time).center[0] - first.center[0]) * 240;
  const stops = [4.5, 7, 9, 11.2, 14, 17.2].map(offset);
  assert(stops[0] > 30 && stops[1] > stops[0] + 30, 'upper rack walks right one step per turn');
  assert(stops[2] < stops[1] - 50 && stops[3] < stops[2] - 50, 'lower rack walks left one step per turn');
  assert(stops[4] > stops[3] + 30 && stops[5] > stops[4] + 30, 'upper rack walks right again');
  assert(stops[1] - stops[3] > 170, 'the rack travels about three tooth pitches');
  const limits = m.root.userData.geometry.limits.rackX.map(v => v * 240);
  for (const r of u.profile.knots) {const x = (r[1] - first.center[0]) * 240; assert(x >= limits[0] - .01 && x <= limits[1] + .01);}
  assert(Math.max(...u.profile.knots.map(r => Math.abs(r[3]))) > .001);
  assert.equal(end.finished, true); assert.deepEqual(u.stateAtTime(99), end);
  near(u.stateAtTime(99).selectorY, -3 / 240); assert.deepEqual(u.stateAtTime(0), first);
  const bounds = new THREE.Box3(new THREE.Vector3(...u.sampledMotionBounds.min), new THREE.Vector3(...u.sampledMotionBounds.max));
  for (const time of [0, 2.7, 3.2, 4.5, 5.8, 6.6, 7.4, 8.3, 10.4, 11, 12, 14.9, 17.2]) {
    m.update(time); for (const mesh of Object.values(u.parts)) assert(bounds.containsBox(new THREE.Box3().setFromObject(mesh, true)), mesh.name + ' framing');
  }
  dispose(m);
});

test('084 working cam, suspension and guides have finite clearance in loaded poses', () => {
  const m = makeSelectorRackDrive(), u = m.root.userData;
  const parts = Object.entries(u.parts).map(([name, mesh]) => ({name, mesh, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry)}));
  for (const time of [0, 2.6, 2.9, 3.2, 5.6, 5.9, 6.6, 7.3, 7.6, 10.2, 10.5, 10.9, 12, 12.3, 14.8, 15.2, 17.2]) {
    m.update(time);
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      if (u.families[parts[i].name] === u.families[parts[j].name]) continue;
      for (const [a, b] of [[parts[i], parts[j]], [parts[j], parts[i]]]) {
        const transform = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
        if (!a.solid.box.clone().applyMatrix4(transform).intersectsBox(b.solid.box)) continue;
        for (const point of a.points) {const local = point.clone().applyMatrix4(transform);
          if (b.solid.inside(local)) assert(b.solid.distance(local) <= 1e-6, `${a.name} penetrates ${b.name} at ${time}`);}
      }
    }
  }
  dispose(m);
});
