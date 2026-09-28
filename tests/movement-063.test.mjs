import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { isSeeThrough } from '../src/simulation/see-through-part.js';
import bakedMotion from '../src/simulation/baked/intermittent-63-211-snap-counter-cuts.js';
import {
  defaultLeg,
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

test('movement 63 is framed face on, with the pins working only in the drop\'s plane', () => {
  const model = build();
  const data = model.root.userData;
  const { drop, driver, pawl, star, springLeaf } = data.blocks;
  assert.equal(data.mechanism, 'three-pin-spring-drop-ten-point-star-counter');
  assert.equal(data.hideGround, true);
  assert.ok(model.cameraDirection.clone().normalize().z > 0.98, 'the plate is seen face on');
  const { z } = data.geometry;
  assert.ok(z.diskFront < z.dropBack, 'the opaque pin disk runs behind the drop');
  assert.ok(z.dropFront < z.pawlBack, 'the drop runs behind the pawl');
  assert.ok(z.pinBack < z.dropBack && z.pinFront > z.dropFront, 'the pins\' front ends reach through the drop\'s leg');
  assert.ok(z.pinFront < z.pawlBack && z.pinFront < z.starBack, 'the pins end short of the pawl and the star');
  assert.equal(z.pawlBack, z.starBack, 'the pawl is flush with the star at the back');
  assert.equal(z.pawlFront, z.starFront, 'the pawl is flush with the star at the front');
  assert.equal(pawl.parent, drop.userData.rotor, 'the pawl hangs on the drop');
  assert.equal(driver.userData.pins.length, 3);
  const pawlBody = pawl.userData.rotor.children.find((child) => child.userData.pawlBody);
  const [pawlBack, pawlFront] = zRange(pawlBody);
  const [starBack, starFront] = zRange(star.userData.body);
  assert.ok(Math.abs(pawlBack - starBack) < 1e-6 && Math.abs(pawlFront - starFront) < 1e-6, 'pawl and star faces are flush');
  for (const pin of driver.userData.pins) {
    assert.ok(zRange(pin)[1] < pawlBack - 0.02, 'no pin reaches the pawl');
    const [pinBack, pinFront] = zRange(pin);
    const dropBody = drop.userData.rotor.children.find((child) => child.userData.springDropBody);
    const [dropBack, dropFront] = zRange(dropBody);
    assert.ok(pinBack < dropBack && pinFront > dropFront, 'every pin spans the drop\'s thickness');
  }
  // Brown dots the leg and the disk's rim behind the pawl's lobe: the pawl
  // is the see-through part; the disk is opaque.
  assert.ok(isSeeThrough(pawlBody), 'the pawl is see-through');
  assert.ok(!isSeeThrough(driver.userData.rotor.children.find((child) => child.userData.driverDisk)), 'the disk is opaque');
  const [springBack, springFront] = zRange(springLeaf);
  assert.ok(springBack > z.dropBack + 1e-3 && springFront < z.dropFront - 1e-3,
    'p96: the spring is a flat strip in the drop\'s own plane, inside its thickness');
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
  let pinDrop = Infinity;
  let pinPawl = Infinity;
  let noseStar = Infinity;
  let striker = Infinity;
  let stop = Infinity;
  for (let step = 0; step <= stepsPerEvent; step += 1) {
    const driverAngle = -(phaseOffset + step / stepsPerEvent) * mechanism.pinPitch;
    const pins = mechanism.pinsAt(driverAngle);
    const pawl = mechanism.pawlAt(delta[step], rho[step]);
    const drop = mechanism.dropAt(delta[step]);
    for (const pin of pins) {
      pinDrop = Math.min(pinDrop, ringPointGap(drop, pin) - layout.pinRadius);
      pinPawl = Math.min(pinPawl, ringPointGap(pawl, pin) - layout.pinRadius);
    }
    noseStar = Math.min(noseStar, ringGap(
      mechanism.noseAt(delta[step], rho[step]),
      mechanism.starAt(startSigma + sigma[step]),
    ));
    striker = Math.min(striker, mechanism.strikerGap(delta[step], rho[step]));
    stop = Math.min(stop, ringPointGap(drop, mechanism.stopPin) - layout.stopPinRadius);
  }
  assert.ok(pinDrop > 1 && pinDrop < 3, `the pins bear on the drop's leg without entering it (${pinDrop} px)`);
  assert.ok(pinPawl > 10, `the pins never touch the pawl, even in plan (${pinPawl} px)`);
  assert.ok(noseStar > 1, `the nose clears the star (${noseStar} px)`);
  // The pins never hold the pawl up, so the striker only limits its rise:
  // at rest it sits a pixel or so above the arm (0.005 plate units).
  assert.ok(striker > 0 && striker < 1.5, `the striker sits just above the pawl's arm (${striker} px)`);
  assert.ok(stop > 0 && stop < 1, `the drop comes to rest just on the stop pin (${stop} px)`);
});

test('movement 63 lifts the drop, lets the pawl ride into the next space, then snaps the star', () => {
  const { delta, rho, sigma, stepsPerEvent } = bakedMotion;
  const pitch = Math.PI * 2 / layout.starTeeth;
  const firstLift = delta.findIndex((value) => value > delta[0] + 1e-4);
  const peak = delta.indexOf(Math.max(...delta));
  const lowestPawl = rho.indexOf(Math.min(...rho));
  const starStart = sigma.findIndex((value) => value < -1e-4);
  assert.ok(firstLift > 0, 'the drop rests on its stop pin first');
  for (let index = firstLift + 1; index <= peak; index += 1) {
    assert.ok(delta[index] >= delta[index - 1] - 1e-9, 'the pins lift the drop steadily');
    assert.ok(rho[index] <= rho[index - 1] + 1e-9, 'the pawl hangs lower on the screw as the drop rises');
  }
  assert.ok(Math.max(...delta) > 0.3, 'the drop is lifted about twenty degrees');
  assert.ok(Math.min(...rho) < -0.3, 'the pawl drops over the next point into the next space');
  assert.ok(lowestPawl <= peak + 10, 'the pawl is in the next space before the drop falls');
  assert.ok(starStart > peak - 10, 'the star stays still until the drop falls');
  assert.ok((stepsPerEvent - starStart) / stepsPerEvent < 0.1, 'the spring throws the drop and star quickly');
  for (let index = 1; index <= stepsPerEvent; index += 1) {
    assert.ok(sigma[index] <= sigma[index - 1] + 1e-9, 'the star only turns forward (clockwise)');
  }
  assert.ok(Math.abs(sigma.at(-1) + pitch) < 1e-6, 'each pin turns the star one point');
  assert.ok(Math.abs(delta.at(-1) - delta[0]) < 1e-6 && Math.abs(rho.at(-1) - rho[0]) < 1e-4,
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

test('movement 63 draws every part whole and solid, with no dashed outline or undrawn zone', () => {
  const model = build();
  const { blocks, geometry } = model.root.userData;
  assert.equal(blocks.legHiddenLine, undefined);
  model.root.traverse((object) => {
    assert.ok(!object.isLine, `${object.userData.role ?? object.type} is not a drawn outline`);
    for (const material of [object.material].flat().filter(Boolean)) {
      assert.ok(!material.isLineDashedMaterial);
      assert.equal(material.onBeforeCompile?.toString().includes('discard'), false,
        'no fragment is cut away from a part');
    }
  });
  const pawlBodies = blocks.pawl.userData.rotor.children.filter((child) => child.isMesh);
  assert.equal(pawlBodies.length, 1, 'the pawl is one plate');
  const [pawlBack, pawlFront] = zRange(pawlBodies[0]);
  assert.ok(Math.abs(pawlBack - geometry.z.starBack) < 1e-6 && Math.abs(pawlFront - geometry.z.starFront) < 1e-6,
    'the one plate is flush with the star');
  const dropBody = blocks.drop.userData.rotor.children.find((child) => child.userData.springDropBody);
  // The drop keeps Brown's broad pointed leg, solid down to its tip.
  dropBody.geometry.computeBoundingBox();
  const k = geometry.sourceScale;
  const [hx, hy] = layout.dropHinge;
  const tip = defaultLeg.reduce((low, point) => (point[1] > low[1] ? point : low));
  assert.ok(dropBody.geometry.boundingBox.min.y < (-tip[1] - hy) * k + 1e-6, 'the leg tip is solid for the pins');
  assert.ok(dropBody.geometry.boundingBox.max.x > (878 - hx) * k - 1e-6);
});

test('movement 63 p96: no bracket; the stop pin and spring stud are plain studs, the spring runs into the tail', () => {
  const model = build();
  const { geometry, blocks } = model.root.userData;
  const byRole = (role) => model.root.children.find((child) => child.userData.role === role);
  assert.equal(byRole('fixed-bracket-carrying-stop-pin-and-spring-clamp'), undefined, 'no bracket bar');
  assert.equal(byRole('fixed-clamp-block-holding-leaf-spring-end'), undefined, 'no box clamp');
  const pin = byRole('fixed-drop-stop-pin');
  const stud = byRole('fixed-round-stud-holding-leaf-spring-end');
  assert.ok(pin && stud);
  const shaftBack = zRange(blocks.starShaft)[0];
  for (const part of [pin, stud]) {
    assert.equal(part.geometry.type, 'CylinderGeometry', 'a plain round stud');
    assert.ok(Math.abs(zRange(part)[0] - shaftBack) < 1e-6, 'it runs back to the shafts\' back plane');
  }
  assert.equal(stud.geometry.parameters.radiusTop, pin.geometry.parameters.radiusTop, 'both studs match');
  const [springBack, springFront] = zRange(blocks.springLeaf);
  assert.ok(zRange(stud)[1] > springFront, 'the stud grips the whole spring width');
  // The spring's moving end lies inside the drop's tail outline at every pose.
  const dropBody = blocks.drop.userData.rotor.children.find((child) => child.userData.springDropBody);
  const raycaster = new THREE.Raycaster();
  for (const time of [0, 0.4, 0.9, 1.7, 2.6]) {
    model.update(time, 0);
    model.root.updateMatrixWorld(true);
    const end = blocks.springLeaf.userData.curve.getPoint(1);
    raycaster.set(new THREE.Vector3(end.x, end.y, 5), new THREE.Vector3(0, 0, -1));
    assert.ok(raycaster.intersectObject(dropBody, false).length > 0, `t=${time}: the spring end is in the tail`);
    // The strip never touches the stop pin.
    const curve = blocks.springLeaf.userData.curve;
    let gap = Infinity;
    for (let i = 0; i <= 64; i += 1) {
      const p = curve.getPoint(i / 64);
      gap = Math.min(gap, Math.hypot(p.x - pin.position.x, p.y - pin.position.y));
    }
    assert.ok(gap > pin.geometry.parameters.radiusTop + 0.02, 'the spring clears the stop pin');
  }
  assert.ok(springBack > geometry.z.dropBack);
});
