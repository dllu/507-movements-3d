import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const FULL_TURN = Math.PI * 2;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: expected ${b}, received ${a}`);

test('398 is one cam, one roller crosshead, one finite rod and one output wheel', () => {
  const model = createMovementModel(catalog.movements[397]);
  const d = model.root.userData;
  assert.equal(d.fidelity, 'authored');
  for (const block of ['cam', 'follower', 'connectingRod', 'outputWheel']) assert.equal(d.blocks[block].parent, model.root);
  assert.equal(d.degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(d.motion.outputIsContinuousUnidirectionalRotation, true);
});

test('398 derived groove: the roller covers exactly the crank stroke, so the wheel turns fully round', () => {
  const model = createMovementModel(catalog.movements[397]);
  const { geometry: g, law } = model.root.userData;
  near(g.strokeRange[1] - g.strokeRange[0], 2 * g.crankRadius, 1e-12, 'roller stroke equals twice the crank throw');
  // The groove centreline is the roller trace; its walls are offsets that do not fold.
  assert.ok(g.minimumConvexRadius > g.rollerRadius, `convex radius ${g.minimumConvexRadius}`);
  assert.ok(g.minimumConcaveRadius > g.rollerRadius, `concave radius ${g.minimumConcaveRadius}`);
  // A clean trefoil: exactly one convex lobe and one concave flank per side
  // (six curvature sign changes per turn), no wobble.
  let changes = 0, previousSign = null;
  for (let i = 0; i < 7200; i += 1) {
    const psi = FULL_TURN * i / 7200, h = 1e-4;
    const [x, y] = law.centerline(psi), [x1, y1] = law.centerline(psi + h), [x0, y0] = law.centerline(psi - h);
    const sign = Math.sign((x1 - x0) * (y1 - 2 * y + y0) - (y1 - y0) * (x1 - 2 * x + x0));
    if (previousSign !== null && sign !== previousSign) changes += 1;
    previousSign = sign;
  }
  assert.equal(changes, 6, 'three lobes and three concave flanks');
  // Three-fold: each side of the groove carries the wheel exactly once round.
  near(law.wheelAngle(FULL_TURN / 3) - law.wheelAngle(0), FULL_TURN, 1e-12, 'one wheel turn per groove side');
  for (let i = 0; i < 3000; i += 1) {
    const psi = FULL_TURN * i / 3000;
    const [x, y] = law.centerline(psi), [x3, y3] = law.centerline(psi + FULL_TURN / 3);
    const r = Math.hypot(x, y), r3 = Math.hypot(x3, y3);
    near(r, r3, 1e-12, 'groove repeats every third of a turn');
    assert.ok(r + g.rollerRadius < g.camRadius, 'groove stays on the cam disc');
  }
});

test('398 wheel turns monotonically at varying speed, never stopping, with a seamless loop', () => {
  const model = createMovementModel(catalog.movements[397]);
  const { stateAtTime, geometry: g } = model.root.userData;
  const T = g.cycleDuration;
  let previous = stateAtTime(0), minimum = Infinity, maximum = 0;
  for (let i = 1; i <= 7000; i += 1) {
    const s = stateAtTime(T * i / 7000);
    assert.ok(s.outputRotorAngle > previous.outputRotorAngle, 'never reverses');
    near(s.rodLengthError, 0, 1e-12, 'rigid rod');
    minimum = Math.min(minimum, s.outputAngularSpeed);
    maximum = Math.max(maximum, s.outputAngularSpeed);
    previous = s;
  }
  assert.ok(minimum > 0, 'never stops');
  assert.ok(maximum / minimum > 2.5, `speed varies: ${maximum / minimum}`);
  near(stateAtTime(T).outputRotorAngle - stateAtTime(0).outputRotorAngle, 3 * FULL_TURN, 1e-9, 'three turns per cam turn');
  near(stateAtTime(T).rollerDistance, stateAtTime(0).rollerDistance, 1e-12, 'follower loop closes');
});

test('398 rear crosshead block ends in a lug concentric with the rod pin (pass 96)', () => {
  const model = createMovementModel(catalog.movements[397]);
  const follower = model.root.userData.blocks.follower;
  const pin = follower.userData.pivot;
  const rear = follower.userData.blocks.at(-1);
  rear.geometry.computeBoundingBox();
  const box = rear.geometry.boundingBox;
  const lugRadius = 1.6 * 0.14;
  near(box.max.x, pin.position.x + lugRadius, 2e-3, 'lug reaches one lug radius past the pin');
  assert.ok(pin.position.x - 0.14 > box.min.x, 'pin fully over the block');
});
