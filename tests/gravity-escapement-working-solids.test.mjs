import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createGravityEscapementModel,
  plateInputFingerprint,
} from '../scripts/generate-gravity-escapement-plates.mjs';
import { probeBodyIntersections } from '../scripts/probe-gravity-escapement-intersections.mjs';
import {
  contactGapsAt,
  engagementAt,
} from '../scripts/check-gravity-escapement-engagement.mjs';
import { GRAVITY_ESCAPEMENT_PLATES } from '../src/simulation/baked/gravity-escapement-plates.js';

const IDS = [309, 310, 311, 312];
const PENETRATION_TOLERANCE = 0.002;
const RUNNING_CLEARANCE = 0.006;

const models = new Map();
const modelFor = async (id) => {
  if (!models.has(id)) models.set(id, await createGravityEscapementModel(id));
  return models.get(id);
};

const phases = (count) => Array.from({ length: count }, (_, i) => (i + 0.5) / count);

test('gravity escapement working plates are baked from their current inputs', async () => {
  for (const id of IDS) {
    const model = await modelFor(id);
    const plates = model.root.userData.sweptPlates;
    assert.ok(plates.length >= 4, `${id} declares swept working plates`);
    assert.equal(GRAVITY_ESCAPEMENT_PLATES[String(id)].inputHash,
      plateInputFingerprint(model), `${id} baked plates match current geometry`);
    for (const plate of plates) {
      assert.equal(plate.mesh.userData.bakedSweptCut, true,
        `${id} ${plate.key} renders its baked swept cut`);
    }
  }
});

test('gravity escapement bodies do not interpenetrate over a period', async () => {
  for (const id of IDS) {
    const result = probeBodyIntersections(await modelFor(id), { samples: 65 });
    const deep = result.pairs.filter((pair) => pair.depth > PENETRATION_TOLERANCE);
    assert.deepEqual(deep.map((pair) => `${pair.kind} ${pair.depth.toFixed(4)} ${pair.pair}`), [],
      `${id} has no solid or coaxial penetration`);
    assert.deepEqual(result.openMeshes, [], `${id} renders closed solids`);
  }
});

test('gravity escapement contact markers stay diagnostic and hidden', async () => {
  for (const id of IDS) {
    const model = await modelFor(id);
    model.update(1.3, 0.016);
    const markers = [];
    model.root.traverse((object) => {
      if (object.isMesh && /^live-/.test(object.userData.role ?? '')) markers.push(object);
    });
    assert.ok(markers.length >= 3, `${id} keeps its contact loci`);
    for (const marker of markers) {
      assert.equal(marker.visible, false, `${id} ${marker.userData.role} is hidden`);
      assert.equal(typeof marker.userData.active, 'boolean');
    }
  }
});

const sampleContacts = async (id, count) => {
  const model = await modelFor(id);
  const { engagementContacts, geometry, stateAtTime } = model.root.userData;
  return phases(count).map((phase) => {
    const time = phase * geometry.pendulumPeriod;
    const state = stateAtTime(time);
    const { advanceSign, contacts } = engagementContacts(state);
    return {
      phase,
      state,
      engagement: engagementAt(model, time, { advanceSign, contacts }),
      gaps: contactGapsAt(model, time, { contacts }),
    };
  });
};

test('311 exclusive stops D and E and both diamond pallets carry the wheels', async () => {
  for (const sample of await sampleContacts(311, 80)) {
    const { engagement, gaps, phase, state } = sample;
    if (state.wheelLocked) {
      const stops = Object.entries(engagement.lock ?? {});
      assert.ok(stops.length > 0, `311 lock at ${phase} has a stop ahead`);
      const letter = state.activeLockWheel === 'front-ABC' ? 'D' : 'E';
      assert.ok(stops.every(([key]) => key.endsWith(`stop-${letter}`)),
        `311 lock at ${phase} is taken only by stop ${letter}`);
      assert.ok(Math.min(...stops.map(([, a]) => a)) < THREE.MathUtils.degToRad(2));
      assert.ok(gaps.lock.gap > 0, `311 locked leg clears its stop at ${phase}`);
    }
    if (state.wheelStepActive) {
      assert.ok(gaps.lift.gap > 0, `311 lifting pin clears the pallet at ${phase}`);
      assert.ok(gaps.lift.gap < 0.07, `311 lifting pin stays near the pallet at ${phase}`);
    }
  }
});

test('312 outer detents lock the T-heads and plane pallets ride the small-wheel teeth', async () => {
  let lifts = 0;
  for (const { engagement, gaps, phase, state } of await sampleContacts(312, 80)) {
    if (state.wheelLocked) {
      const letter = state.activeLockSide === 'right' ? 'B' : 'A';
      const advance = engagement.lock?.[`${state.activeLockSide}-stop-${letter}`];
      assert.ok(advance !== undefined && advance < THREE.MathUtils.degToRad(1),
        `312 T-head meets stop ${letter} at ${phase}`);
      assert.ok(gaps.lock.gap > 0 && gaps.lock.gap < 2 * RUNNING_CLEARANCE,
        `312 locked T-head runs at clearance at ${phase}: ${gaps.lock.gap}`);
    }
    if (state.wheelStepActive) {
      lifts += 1;
      assert.ok(gaps.lift.gap > 0 && gaps.lift.gap < 2 * RUNNING_CLEARANCE,
        `312 small-wheel tooth drives its pallet at ${phase}: ${gaps.lift.gap}`);
    }
  }
  assert.ok(lifts >= 4);
});

test('negative control: an unbaked working blank is caught by the probe', async () => {
  for (const [id, key] of [[311, 'right-stop-D'], [312, 'left-detent-A']]) {
    const model = await createGravityEscapementModel(id);
    const plate = model.root.userData.sweptPlates.find((entry) => entry.key === key);
    const shapes = plate.primitiveRings.map((ring) => new THREE.Shape(
      ring.map(([x, y]) => new THREE.Vector2(x, y)),
    ));
    const blank = new THREE.ExtrudeGeometry(shapes, {
      bevelEnabled: false,
      curveSegments: 1,
      depth: plate.z1 - plate.z0,
      steps: 1,
    });
    blank.translate(0, 0, plate.z0);
    plate.mesh.geometry.dispose();
    plate.mesh.geometry = blank;
    const result = probeBodyIntersections(model, { samples: 65 });
    const hit = result.pairs.find((pair) => pair.kind === 'solid'
      && pair.pair.includes(plate.mesh.userData.role)
      && pair.depth > 0.02);
    assert.ok(hit, `${id} uncut ${key} is reported intersecting the wheel`);
  }
});
