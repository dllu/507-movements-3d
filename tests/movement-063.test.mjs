import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import bakedMotion from '../src/simulation/baked/intermittent-63-211-snap-counter-cuts.js';
import {
  layout,
  makeSnapCounterMechanism,
  ringGap,
  ringPointGap,
  snapCounterMotionFingerprint,
} from '../src/simulation/snap-counter-63-mechanism.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const build = () => createMovementModel(
  catalog.movements.find(({ id }) => id === 63),
);
const zRange = (object) => {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  return [box.min.z, box.max.z];
};

test('movement 63 is framed face on and layered as Brown dashes it', () => {
  const model = build();
  const data = model.root.userData;
  const { drop, driver, pawl, star, springLeaf } = data.blocks;
  assert.equal(data.mechanism, 'three-pin-spring-drop-ten-point-star-counter');
  assert.equal(data.hideGround, true);
  assert.ok(model.cameraDirection.clone().normalize().z > 0.98, 'the plate is seen face on');
  const { z } = data.geometry;
  assert.ok(z.dropFront < z.diskBack, 'the drop, whose leg Brown dashes, runs behind the pin disk');
  assert.ok(z.diskFront < z.pawlBack, 'the broad pawl works in front of the disk');
  assert.ok(z.pinFront < z.starBack, 'the pins end behind the star, so they never meet it');
  assert.ok(z.pinBack < z.dropFront && z.pinFront > z.pawlBack, 'the pins reach both the leg and the lobe');
  assert.ok(z.noseFront > z.starBack + 0.1, 'the pawl nose steps forward into the star plane');
  assert.equal(pawl.parent, drop.userData.rotor, 'the pawl hangs on the drop');
  assert.equal(driver.userData.pins.length, 3);
  const [springBack, springFront] = zRange(springLeaf);
  assert.ok(springBack > z.dropFront - 1e-9 && springFront < z.diskBack, 'the spring lies on the drop tail');
  assert.ok(zRange(star)[1] > z.starFront - 1e-9);
});

test('movement 63 plays the baked steady contact solution, which the live solver reproduces', () => {
  const model = build();
  const { snapCounter } = model.root.userData;
  assert.equal(snapCounter.fingerprint, snapCounterMotionFingerprint());
  assert.equal(bakedMotion.fingerprint, snapCounter.fingerprint, 'rebake after changing the mechanism');
  assert.equal(snapCounter.motion.live, undefined, 'the baked motion is used');
  const live = makeSnapCounterMechanism().periodicEvent();
  for (const key of ['delta', 'rho', 'sigma']) {
    const error = Math.max(...live[key].map((value, index) => Math.abs(value - bakedMotion[key][index])));
    assert.ok(error < 1e-6, `${key} matches the live solution (${error})`);
  }
  assert.ok(live.repeatError < 0.01, 'the second and third events repeat');
  const pitch = Math.PI * 2 / layout.starTeeth;
  assert.ok(Math.abs(live.advance + pitch) < 0.002, 'the solved event turns the star one point');
});

test('movement 63 keeps every working pair clear through a steady event', () => {
  const mechanism = makeSnapCounterMechanism();
  const { delta, phaseOffset, rho, sigma, startSigma, stepsPerEvent } = bakedMotion;
  let pinPawl = Infinity;
  let pinDrop = Infinity;
  let noseStar = Infinity;
  let striker = Infinity;
  let stop = Infinity;
  for (let step = 0; step <= stepsPerEvent; step += 1) {
    const driverAngle = -(phaseOffset + step / stepsPerEvent) * mechanism.pinPitch;
    const pins = mechanism.pinsAt(driverAngle);
    const pawl = mechanism.pawlAt(delta[step], rho[step]);
    const drop = mechanism.dropAt(delta[step]);
    for (const pin of pins) {
      pinPawl = Math.min(pinPawl, ringPointGap(pawl, pin) - layout.pinRadius);
      pinDrop = Math.min(pinDrop, ringPointGap(drop, pin) - layout.pinRadius);
    }
    noseStar = Math.min(noseStar, ringGap(
      mechanism.noseAt(delta[step], rho[step]),
      mechanism.starAt(startSigma + sigma[step]),
    ));
    striker = Math.min(striker, mechanism.strikerGap(delta[step], rho[step]));
    stop = Math.min(stop, ringPointGap(drop, mechanism.stopPin) - layout.stopPinRadius);
  }
  assert.ok(pinPawl > 1, `pins clear the pawl (${pinPawl} px)`);
  assert.ok(pinDrop > 1, `pins clear the drop (${pinDrop} px)`);
  assert.ok(noseStar > 1, `the nose clears the star (${noseStar} px)`);
  assert.ok(striker > 0 && striker < 1, `the striker bears on the pawl at rest (${striker} px)`);
  assert.ok(stop > 0 && stop < 1, `the drop comes to rest just on the stop pin (${stop} px)`);
});

test('movement 63 lifts, releases the pawl first, then snaps the drop and star', () => {
  const { delta, rho, sigma, stepsPerEvent } = bakedMotion;
  const pitch = Math.PI * 2 / layout.starTeeth;
  const firstLift = delta.findIndex((value) => value > delta[0] + 1e-4);
  const pawlRelease = rho.findIndex((value, index) => index > firstLift && value < -0.001);
  const peak = delta.indexOf(Math.max(...delta));
  const starStart = sigma.findIndex((value) => value < -1e-4);
  assert.ok(firstLift > 0 && firstLift < pawlRelease, 'the pins lift the pawl with the drop first');
  assert.ok(delta[pawlRelease] - delta[0] > 0.07,
    'the pawl rides on the striker while the pin lifts its lobe and the drop');
  assert.ok(pawlRelease < peak, 'the pin escapes the pawl before it escapes the drop');
  assert.ok(Math.max(...delta) > 0.3, 'the drop is lifted about twenty degrees');
  assert.ok(starStart > peak, 'the star stays still until the drop falls');
  assert.ok((stepsPerEvent - starStart) / stepsPerEvent < 0.1, 'the spring throws the drop and star quickly');
  for (let index = 1; index <= stepsPerEvent; index += 1) {
    assert.ok(sigma[index] <= sigma[index - 1] + 1e-9, 'the star only turns forward (clockwise)');
  }
  assert.ok(Math.abs(sigma.at(-1) + pitch) < 1e-6, 'each pin turns the star one point');
  assert.ok(Math.abs(delta.at(-1) - delta[0]) < 1e-6 && Math.abs(rho.at(-1) - rho[0]) < 1e-3,
    'each event ends where the next begins');
});

test('movement 63 bends the spring with the drop and poses every part from the state', () => {
  const model = build();
  const { blocks, geometry, snapCounter, stateAtTime } = model.root.userData;
  let previousStar = null;
  for (const phase of [0, 0.3, 0.5, 0.7, 0.85, 0.95, 0.99, 1.2]) {
    model.update(phase * geometry.eventPeriod);
    const state = model.root.userData.kinematics;
    assert.deepEqual(state, stateAtTime(phase * geometry.eventPeriod));
    assert.equal(blocks.drop.userData.rotor.rotation.z, state.dropAngle);
    assert.equal(blocks.pawl.userData.rotor.rotation.z, state.pawlAngle);
    assert.equal(blocks.star.userData.rotor.rotation.z, state.starAngle);
    assert.equal(blocks.driver.userData.rotor.rotation.z, state.driverAngle);
    const end = blocks.springLeaf.userData.curve.getPoint(1);
    const expected = snapCounter.toWorld(snapCounter.mechanism.rotateAboutHinge(layout.springEnd, state.dropAngle));
    assert.ok(Math.hypot(end.x - expected.x, end.y - expected.y) < 1e-9, 'the spring end moves with the drop');
    if (previousStar !== null) assert.ok(state.starAngle <= previousStar + 1e-12);
    previousStar = state.starAngle;
  }
  const oneEvent = stateAtTime(geometry.eventPeriod * 1.05).starAngle - stateAtTime(geometry.eventPeriod * 0.05).starAngle;
  assert.ok(Math.abs(oneEvent + geometry.starPitch) < 1e-9);
});
