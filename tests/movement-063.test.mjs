import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import bakedCuts from '../src/simulation/baked/intermittent-63-211-snap-counter-cuts.js';
import {
  computeSnapCounterCuts,
  mitredOffset,
} from '../scripts/lib/intermittent-63-211-snap-counter-cuts.mjs';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const build = () => createMovementModel(
  catalog.movements.find(({ id }) => id === 63),
);

const rotate = ([x, y], angle) => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
];
const place = (ring, angle, [ox, oy]) => ring.map((point) => {
  const [x, y] = rotate(point, angle);
  return [x + ox, y + oy];
});
const segmentDistance = (point, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = THREE.MathUtils.clamp(
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy),
    0,
    1,
  );
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
};
const inside = (point, ring) => {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
};
const edgeDistance = (point, ring) => Math.min(...ring.map((a, index) => (
  segmentDistance(point, a, ring[(index + 1) % ring.length]))));
const crosses = (a, b, c, d) => {
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};
const edgesCross = (a, b) => a.some((p, i) => b.some((q, j) => crosses(
  p, a[(i + 1) % a.length], q, b[(j + 1) % b.length],
)));
// Signed planar gap between two rings; when they overlap, minus the deepest
// vertex penetration.
const ringGap = (a, b) => {
  const depth = Math.max(
    0,
    ...a.filter((point) => inside(point, b)).map((point) => edgeDistance(point, b)),
    ...b.filter((point) => inside(point, a)).map((point) => edgeDistance(point, a)),
  );
  if (depth > 0 || edgesCross(a, b)) return -depth;
  return Math.min(
    ...a.map((point) => edgeDistance(point, b)),
    ...b.map((point) => edgeDistance(point, a)),
  );
};
const circleGap = (ring, center, radius) => (inside(center, ring) ? -1 : 1)
  * edgeDistance(center, ring) - radius;

const starSurface = (inputs) => mitredOffset(Array.from(
  { length: inputs.starTeeth * 2 },
  (_, index) => {
    const angle = inputs.starMountPhase + index * Math.PI / inputs.starTeeth;
    const radius = index % 2 === 0 ? inputs.starOuterRadius : inputs.starGapRadius;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  },
), inputs.starBevel);
const pinCenters = (inputs, state, driverCenter = inputs.driverCenter) => (
  Array.from({ length: 3 }, (_, index) => {
    const angle = inputs.pinMountPhase - index * inputs.pinPitch + state.driverAngle;
    return [
      driverCenter[0] + Math.cos(angle) * inputs.pinOrbitRadius,
      driverCenter[1] + Math.sin(angle) * inputs.pinOrbitRadius,
    ];
  }));

const sampleCycle = (model, count, visit) => {
  const { geometry, stateAtTime } = model.root.userData;
  for (let index = 0; index <= count; index += 1) {
    visit(stateAtTime(geometry.eventPeriod * index / count));
  }
};

test('movement 63 is framed and layered like Brown\'s plate', () => {
  const model = build();
  const data = model.root.userData;
  const { drop, pawl, star } = data.blocks;
  assert.equal(data.mechanism, 'three-pin-spring-drop-ten-point-star-counter');
  assert.equal(data.hideGround, true);
  for (const role of ['baseRail', 'leftPost', 'rightPost', 'dropBracket', 'starBracket', 'driverBracket']) {
    assert.equal(data.blocks[role], undefined, `${role} is not drawn by Brown`);
  }
  const direction = model.cameraDirection.clone().normalize();
  assert.ok(direction.z > 0.98, 'the plate is seen face on');
  assert.equal(data.sweptCut.applied, true, 'the baked cuts match the factory inputs');
  assert.equal(data.sweptCut.fingerprint, bakedCuts.fingerprint);

  const starFront = star.position.z + star.userData.depth / 2 + data.sweptCut.inputs.starBevel;
  const shankBack = data.geometry.pawlPlaneZ + pawl.userData.depth / 2 - pawl.userData.shankDepth;
  const pawlFront = data.geometry.pawlPlaneZ + pawl.userData.depth / 2;
  const noseBack = data.geometry.pawlPlaneZ - pawl.userData.depth / 2;
  const dropFrontSlabBack = drop.position.z - drop.userData.depth / 2 + drop.userData.rearDepth;
  assert.ok(shankBack > starFront, 'the pawl shank runs clear in front of the star');
  assert.ok(noseBack < starFront - 0.05, 'the nose block works in the star plane');
  assert.ok(dropFrontSlabBack > pawlFront, 'the pawl works under the drop\'s full-outline front slab');
  assert.ok(drop.position.z - drop.userData.depth / 2 < pawlFront,
    'only the relieved back of the drop shares the pawl\'s depth');

  const driverDistance = data.geometry.driverCenter.distanceTo(data.geometry.starCenter);
  assert.ok(
    driverDistance - data.geometry.pinOrbitRadius - data.geometry.pinRadius
      > data.geometry.starOuterRadius + data.sweptCut.inputs.starBevel + 0.02,
    'the pin circle clears the star points it crosses',
  );
});

test('movement 63 baked cuts regenerate from the factory inputs', () => {
  const model = build();
  const { inputs } = model.root.userData.sweptCut;
  const regenerated = computeSnapCounterCuts(inputs, model.root.userData.stateAtTime);
  for (const key of ['pawl', 'pawlNose', 'dropRear']) {
    assert.deepEqual(regenerated[key], bakedCuts[key], `${key} matches the baked outline`);
    assert.equal(regenerated[key].length, 1, `${key} is one connected piece`);
  }
});

test('movement 63 keeps its pawl clear of the star, pins and striker through the cycle', () => {
  const model = build();
  const { inputs } = model.root.userData.sweptCut;
  const star = starSurface(inputs);
  const nose = bakedCuts.pawlNose[0][0];
  const shank = bakedCuts.pawl[0][0];
  const worst = { noseStar: Infinity, pinPawl: Infinity, pinStar: Infinity, striker: Infinity };
  let restStriker = Infinity;
  sampleCycle(model, 1536, (state) => {
    const pivot = [state.pawlPivotPosition.x, state.pawlPivotPosition.y];
    const noseWorld = place(nose, state.pawlAngle, pivot);
    const shankWorld = place(shank, state.pawlAngle, pivot);
    const starWorld = place(star, state.starAngle, inputs.starCenter);
    worst.noseStar = Math.min(worst.noseStar, ringGap(noseWorld, starWorld));
    for (const pin of pinCenters(inputs, state)) {
      worst.pinStar = Math.min(worst.pinStar, circleGap(starWorld, pin, inputs.pinRadius));
      worst.pinPawl = Math.min(
        worst.pinPawl,
        circleGap(noseWorld, pin, inputs.pinRadius),
        circleGap(shankWorld, pin, inputs.pinRadius),
      );
    }
    const striker = place([inputs.strikerLocal], state.dropAngle, inputs.dropPivot)[0];
    const strikerGap = circleGap(shankWorld, striker, inputs.strikerRadius);
    worst.striker = Math.min(worst.striker, strikerGap);
    if (state.stage === 'settle') restStriker = Math.min(restStriker, strikerGap);
  });
  assert.ok(worst.noseStar > 0.008 && worst.noseStar < 0.02,
    `the nose works ${worst.noseStar} from the star's bevelled surface`);
  assert.ok(worst.pinStar > 0.01, `pins clear the star points by ${worst.pinStar}`);
  assert.ok(worst.pinPawl > 0.008, `pins clear the pawl by ${worst.pinPawl}`);
  assert.ok(worst.striker > 0.008, `the striker clears the pawl shank by ${worst.striker}`);
  assert.ok(restStriker < 0.05, `the pawl rests ${restStriker} from the drop's striker pin`);

  // Negative controls: the uncut nose blank, Brown-proportioned pins at the
  // former centre distance and a striker set into the pawl's swing all fail.
  const pawl = model.root.userData.blocks.pawl;
  const rest = model.root.userData.stateAtTime(0);
  const restPivot = [rest.pawlPivotPosition.x, rest.pawlPivotPosition.y];
  assert.ok(ringGap(
    place(pawl.userData.noseOutline, rest.pawlAngle, restPivot),
    place(star, rest.starAngle, inputs.starCenter),
  ) < -0.05);
  let formerPinStar = Infinity;
  sampleCycle(model, 512, (state) => {
    const starWorld = place(star, state.starAngle, inputs.starCenter);
    for (const pin of pinCenters(inputs, state, [1.05, 0])) {
      formerPinStar = Math.min(formerPinStar, circleGap(starWorld, pin, inputs.pinRadius));
    }
  });
  assert.ok(formerPinStar < -0.05, `pins at the former centre distance cut the star by ${-formerPinStar}`);
  let farthest = null;
  sampleCycle(model, 1024, (state) => {
    if (!farthest || state.pawlAngle - state.dropAngle > farthest.pawlAngle - farthest.dropAngle) {
      farthest = state;
    }
  });
  const pivotLocal = model.root.userData.geometry.pawlPivotLocal;
  const intrudingLocal = rotate(
    [0.55, 0.12 + inputs.strikerRadius - 0.02],
    farthest.pawlAngle - farthest.dropAngle,
  ).map((value, index) => value + (index === 0 ? pivotLocal.x : pivotLocal.y));
  assert.ok(circleGap(
    place(shank, farthest.pawlAngle, [farthest.pawlPivotPosition.x, farthest.pawlPivotPosition.y]),
    place([intrudingLocal], farthest.dropAngle, inputs.dropPivot)[0],
    inputs.strikerRadius,
  ) < -0.01, 'a striker set into the pawl swing is detected');
});

test('movement 63 lifts the pawl point over the star points before it drops', () => {
  const model = build();
  const { geometry, stateAtTime } = model.root.userData;
  const center = geometry.starCenter;
  let crossingRadius = Infinity;
  let previous = null;
  sampleCycle(model, 2048, (state) => {
    const tipRadius = Math.hypot(state.pawlTipPosition.x - center.x, state.pawlTipPosition.y - center.y);
    if (state.stage === 'lifting' || state.stage === 'pawl-release') {
      const local = Math.atan2(state.pawlTipPosition.y - center.y, state.pawlTipPosition.x - center.x)
        - state.starAngle;
      const fromPoint = Math.abs(THREE.MathUtils.euclideanModulo(
        local - geometry.starMountPhase + geometry.starPitch / 2,
        geometry.starPitch,
      ) - geometry.starPitch / 2);
      if (fromPoint < 0.05) crossingRadius = Math.min(crossingRadius, tipRadius);
    }
    if (previous && previous.stage === state.stage && state.stage !== 'power-snap') {
      const dt = state.driverAngle - previous.driverAngle;
      const rate = (state.pawlAngle - previous.pawlAngle) / (dt / geometry.driverAngularSpeed);
      const mean = (state.pawlAngularSpeed + previous.pawlAngularSpeed) / 2;
      assert.ok(Math.abs(rate - mean) < 2e-3 + Math.abs(mean) * 2e-3,
        `pawl angular speed ${mean} matches the swing ${rate} in ${state.stage}`);
    }
    previous = state;
  });
  assert.ok(crossingRadius > geometry.starOuterRadius + 0.1,
    `the pawl point passes the star point at radius ${crossingRadius}`);
  const lifted = stateAtTime(geometry.liftEnd * geometry.eventPeriod - 1e-9);
  assert.ok(Math.abs(lifted.pawlAngle - geometry.pawlClearanceAngle) < 1e-9);
});
