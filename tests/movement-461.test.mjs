import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface } from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'rigid-serpentine-swinging-gutter-with-bottom-scoop-top-outlet-and-one-way-flap-boxes';
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [].concat(object.material ?? [])) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function withModel(run) {
  const model = createMovementModel(catalog.movements[460]);
  try {
    run(model, model.root.userData);
  } finally {
    disposeModel(model.root);
  }
}

test('movement 461 is Brown\'s lattice: six horizontals, six parallel diagonals, six right and five left boxes, two serpentines', () => withModel((model, data) => {
  const movement = catalog.movements[460];
  const { blocks, geometry } = data;
  assert.equal(movement.id, 461);
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(geometry.rowLevels.length, 6);
  assert.equal(geometry.rightBoxes.length, 6);
  assert.equal(geometry.leftBoxes.length, 5);
  assert.equal(geometry.valveCount, 10);
  assert.equal(blocks.flaps.length, 10);
  assert.equal(geometry.paths.length, 2);
  // Every diagonal is parallel and joins a left box to the right box two rows up.
  for (let k = 0; k < 4; k += 1) {
    const delta = geometry.rightBoxes[k + 2].clone().sub(geometry.leftBoxes[k]);
    near(delta.x, geometry.diagonal.x, 1e-12, `diagonal ${k} x`);
    near(delta.y, geometry.diagonal.y, 1e-12, `diagonal ${k} y`);
  }
  const lowest = geometry.rightBoxes[1].clone().sub(geometry.lowerMouth);
  near(lowest.x, geometry.diagonal.x, 1e-12, 'lowest diagonal rises from the pool at the same slant');
  near(Math.atan2(geometry.diagonal.y, geometry.diagonal.x) * 180 / Math.PI, 35.6, 0.5, 'diagonal slant');
  // The two serpentines use disjoint boxes and rows; both pour from the open
  // top pipe (Brown's one jet): the even one joins it through a port where the
  // highest diagonal crosses behind it, below that diagonal's open vent.
  const [odd, even] = geometry.paths;
  assert.ok(odd.points.at(-1).equals(geometry.topOutlet));
  assert.ok(even.points.at(-1).equals(geometry.topOutlet));
  assert.ok(even.points.at(-2).equals(geometry.topJunction));
  near(geometry.topJunction.y, geometry.rowLevels[5], 1e-12, 'port on the top pipe');
  const vent = geometry.freeTop.clone().sub(geometry.topJunction);
  near(Math.atan2(vent.y, vent.x), Math.atan2(geometry.diagonal.y, geometry.diagonal.x), 1e-12, 'vent stub continues the diagonal');
  assert.ok(odd.points[0].equals(geometry.lowerMouth));
  assert.ok(even.points[0].equals(geometry.scoopMouth));
  for (const path of geometry.paths) {
    path.lengths.forEach((length, i) => {
      const horizontal = Math.abs(path.points[i + 1].y - path.points[i].y) < 1e-12;
      if (path.layers[i] === 'front') assert.ok(horizontal || Math.abs(path.points[i + 1].x - path.points[i].x) < 1e-12, 'front layer is horizontals and elbow stubs');
      else near(Math.atan2(path.points[i + 1].y - path.points[i].y, path.points[i + 1].x - path.points[i].x),
        Math.atan2(geometry.diagonal.y, geometry.diagonal.x), 1e-9, 'back layer is the parallel diagonals');
      assert.ok(length > 0);
    });
  }
  assert.ok(geometry.layers.back.z1 < geometry.layers.front.z0, 'diagonals pass behind the horizontals');
  assert.equal(blocks.posts.length, 2);
}));

test('movement 461 flaps close the whole bore against a seat rib and pocketed hinge, and open only toward their box', () => withModel((model, data) => {
  const { blocks, geometry } = data;
  const walls = { back: solidSurface(blocks.conduit.backWalls.geometry), front: solidSurface(blocks.conduit.frontWalls.geometry) };
  geometry.flapFrames.forEach((frame, index) => {
    const { flap, mount } = blocks.flaps[index];
    const { z0, z1 } = geometry.layers[frame.layer];
    const box = new THREE.Box3().setFromBufferAttribute(flap.geometry.attributes.position);
    // Spans the full depth of its pipe layer and, from the hinge, all but a
    // clearance of the bore width.
    near(box.min.z, z0 + 0.002, 1e-6, `flap ${index} back edge`);
    near(box.max.z, z1 - 0.002, 1e-6, `flap ${index} front edge`);
    near(box.max.y - box.min.y, geometry.boreHalfWidth * 2 - geometry.flapClearance + 0.026, 1e-6, `flap ${index} reach plus hinge boss`);
    // Seat rib material lies just upstream of the closed flap near the lower
    // wall; the closed flap's face is clear of it.
    const surface = walls[frame.layer];
    const z = (z0 + z1) / 2;
    const ribPoint = frame.seatCentre.clone()
      .addScaledVector(frame.direction, -geometry.flapThickness / 2 - 0.015)
      .addScaledVector(frame.up, -geometry.boreHalfWidth + 0.01).setZ(z);
    assert.ok(surface.inside(ribPoint), `flap ${index} seat rib`);
    const passage = frame.seatCentre.clone().addScaledVector(frame.direction, -geometry.flapThickness / 2 - 0.015).setZ(z);
    assert.ok(!surface.inside(passage), `flap ${index} bore open upstream of the rib`);
    // Hinge boss turns in a pocket cut into the upper wall.
    assert.ok(!surface.inside(frame.hinge.clone().setZ(z)), `flap ${index} hinge pocket`);
    assert.equal(mount.position.distanceTo(frame.hinge), 0);
  });
  for (let sample = 0; sample < 2000; sample += 1) {
    const state = data.stateAtInputAngle(FULL_TURN * sample / 2000);
    state.valveOpenAmounts.forEach((amount, index) => {
      assert.ok(amount >= 0 && amount <= 1);
      if (amount > 0) assert.equal(geometry.flapFrames[index].openHalf, state.half, `flap ${index} opens only on its half`);
      near(state.flapAngles[index], geometry.maximumFlapAngle * amount, 1e-15, `flap ${index} angle`);
    });
  }
  for (const angle of [0, Math.PI, FULL_TURN]) {
    const state = data.stateAtInputAngle(angle);
    assert.ok(state.valveOpenAmounts.every((amount) => amount === 0), 'all flaps seated at each reversal');
    assert.ok(state.valveOpenRates.every((rate) => rate === 0));
  }
}));

test('movement 461 conserves water: what each serpentine pours is what it scooped', () => withModel((model, data) => {
  const { geometry } = data;
  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = data.stateAtTime(geometry.cycleDuration * sample / 1200);
    state.serpentines.forEach((serpentine, pathIndex) => {
      // Water in the pipes at the start of the half (the even serpentine also
      // holds its parcel waiting in the top pipe through the left-down swing).
      const held = pathIndex === 1 && state.half === 0 ? 4 : 3;
      near(serpentine.conduitLength + serpentine.poured - serpentine.scooped, held * geometry.parcelLength, 1e-9,
        `serpentine ${pathIndex} inventory at ${sample}`);
    });
    // Parcels never overlap one another and never cross a closed flap.
    for (const pathIndex of [0, 1]) {
      const parcels = state.parcels.filter((parcel) => parcel.path === pathIndex).sort((a, b) => a.tail - b.tail);
      for (let i = 1; i < parcels.length; i += 1) assert.ok(parcels[i].tail >= parcels[i - 1].head - 1e-9, `parcels overlap at ${sample}`);
      geometry.flapFrames.forEach((frame, index) => {
        if (frame.path !== pathIndex || state.valveOpenAmounts[index] > 0) return;
        const half = geometry.flapThickness / 2;
        for (const parcel of parcels) {
          assert.ok(!(parcel.tail < frame.station + half - 1e-9 && parcel.head > frame.station - half + 1e-9),
            `parcel crosses closed flap ${index} at ${sample}`);
        }
      });
    }
  }
  // The odd serpentine scoops and pours on the left-down swing; the even one
  // pours then too (through the top jet) and scoops on the right-down swing.
  const endA = data.stateAtInputAngle(Math.PI - 1e-9);
  const endB = data.stateAtInputAngle(FULL_TURN - 1e-9);
  near(endA.serpentines[0].poured, geometry.parcelLength, 1e-6, 'odd serpentine pours one parcel on the left-down swing');
  near(endA.serpentines[0].scooped, geometry.parcelLength, 1e-6, 'odd serpentine scoops one parcel on the left-down swing');
  near(endA.serpentines[1].poured, geometry.parcelLength, 1e-6, 'even serpentine pours on the left-down swing');
  near(endB.serpentines[1].poured, 0, 0, 'even serpentine does not pour on the right-down swing');
  near(endB.serpentines[1].scooped, geometry.parcelLength, 1e-6, 'even serpentine scoops on the right-down swing');
}));

test('movement 461 scoops take water only below the pool surface, and horizontals are crossed while they slope toward their left box', () => withModel((model, data) => {
  const { geometry } = data;
  for (let sample = 0; sample <= 600; sample += 1) {
    const state = data.stateAtTime(geometry.cycleDuration * sample / 600);
    assert.ok(state.lowerMouthImmersion > 0.3, 'the lowest diagonal stays under water');
    const scooping = state.parcels.find((parcel) => parcel.path === 1 && parcel.from === 0);
    if (scooping && scooping.speed > 1e-9) assert.ok(state.scoopImmersion > 0, `right scoop slot submerged while filling at ${sample}`);
    // A parcel that runs the length of a horizontal does so on the swing
    // that lowers the horizontal's left (box) end.
    for (const parcel of state.parcels) {
      if (Math.abs(parcel.speed) < 1e-9) continue;
      const path = geometry.paths[parcel.path];
      path.lengths.forEach((length, i) => {
        const a = path.points[i], b = path.points[i + 1];
        if (!(Math.abs(a.y - b.y) < 1e-12 && b.x < a.x && length > 1)) return;
        if (parcel.from - geometry.parcelLength < path.stations[i] && parcel.to > path.stations[i + 1] - 0.3) {
          assert.ok(state.swingAngle >= 0, `horizontal crossed while sloping down-left at ${sample}`);
        }
      });
    }
  }
}));

test('movement 461 water is drawn per compartment, one parcel at most in each, closing exactly after one swing cycle', () => withModel((model, data) => {
  const { blocks, geometry } = data;
  assert.equal(blocks.waterSlugs.length, geometry.compartments.length);
  const snapshot = () => blocks.waterSlugs.map((mesh) => (mesh.visible ? Array.from(mesh.geometry.attributes.position.array) : null));
  for (let sample = 0; sample <= 400; sample += 1) {
    const state = data.stateAtTime(geometry.cycleDuration * sample / 400);
    for (const compartment of geometry.compartments) {
      const inside = state.parcels.filter((parcel) => parcel.path === compartment.path
        && parcel.head > compartment.low + 1e-9 && parcel.tail < compartment.high - 1e-9);
      assert.ok(inside.length <= 1, `compartment holds one parcel at ${sample}`);
    }
  }
  model.update(0);
  const start = snapshot();
  model.update(geometry.cycleDuration);
  const end = snapshot();
  start.forEach((positions, index) => {
    assert.equal(end[index] === null, positions === null, `compartment ${index} visibility closes`);
    if (positions) positions.forEach((value, k) => near(end[index][k], value, 1e-9, `compartment ${index} vertex ${k}`));
  });
}));

test('movement 461 both serpentines pour through Brown\'s one top jet, clear of the lattice', () => withModel((model, data) => {
  const { blocks, geometry } = data;
  const jets = blocks.dischargeJets;
  const seen = [0, 0];
  for (let sample = 0; sample <= 400; sample += 1) {
    const time = geometry.cycleDuration * sample / 400;
    model.update(time);
    jets.forEach((jet, index) => {
      if (!jet.visible) return;
      seen[index] += 1;
      // Brown's spray: only on the left-down swing, and left of the lattice.
      assert.ok(time < geometry.cycleDuration / 2 + 0.4, `jet ${index} pours on the left-down swing at ${sample}`);
      const P = jet.geometry.attributes.position.array;
      const theta = blocks.swingingGutter.rotation.z;
      for (let k = 0; k < P.length; k += 3) {
        const local = new THREE.Vector3(P[k] - geometry.gutterPivot.x, P[k + 1] - geometry.gutterPivot.y, 0)
          .applyAxisAngle(new THREE.Vector3(0, 0, 1), -theta);
        assert.ok(local.x < geometry.topOutlet.x + 0.05, `jet ${index} leaves the open left end at ${sample}`);
      }
    });
  }
  assert.ok(seen[0] > 0 && seen[1] > 0);
}));

test('movement 461 lattice is one rigid pendulum about the fixed axis', () => withModel((model, data) => {
  const { blocks, geometry } = data;
  const fixed = [blocks.pivotAxle, blocks.reservoir, ...blocks.posts];
  const before = fixed.map((object) => object.position.clone());
  for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
    const state = data.stateAtTime(geometry.cycleDuration * phase);
    model.update(geometry.cycleDuration * phase);
    near(blocks.swingingGutter.rotation.z, state.swingAngle, 0, `swing at ${phase}`);
    fixed.forEach((object, index) => assert.equal(object.position.distanceTo(before[index]), 0));
  }
  const step = 1e-6;
  for (const angle of [0.34, 1.18, 2.77, 4.13, 5.62]) {
    const a = data.stateAtInputAngle(angle - step), b = data.stateAtInputAngle(angle + step), s = data.stateAtInputAngle(angle);
    near(s.swingAngularSpeed, (b.swingAngle - a.swingAngle) * geometry.inputAngularSpeed / (2 * step), 1e-9, 'swing speed');
  }
  near(data.stateAtInputAngle(0).swingAngle, 0, 0, 'plate pose is the neutral lattice');
}));

test('movement 461 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement461 = catalog.movements[460];
  const movement507 = catalog.movements[506];
  const model461 = createMovementModel(movement461);
  const model507 = createMovementModel(movement507);
  model461.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model461.root);
  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.equal(movement461.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model461.root);
  disposeModel(model507.root);
});
