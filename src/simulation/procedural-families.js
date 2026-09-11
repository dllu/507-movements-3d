import * as THREE from 'three';
import {
  PALETTE,
  beltCurveCrossed,
  beltCurveOpen,
  makeBeam,
  makeBevelGear,
  makeCam,
  makeDynamicLink,
  makeGear,
  makeMovingBelt,
  makePaddleWheel,
  makePulley,
  makeRack,
  makeScrew,
  makeShaft,
  makeSpring,
  markShadows,
  matte,
  seededRandom,
  setSpin,
  smoothStep01,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function result(root, update, cameraDirection = new THREE.Vector3(6.5, 4.2, 8.5)) {
  root.userData.fidelity = 'procedural';
  markShadows(root);
  return { root, update, cameraDirection };
}

function axle(root, position, length = 1.3, axis = Z_AXIS) {
  const shaft = makeShaft({ length, radius: 0.075, axis });
  shaft.position.copy(position);
  root.add(shaft);
  return shaft;
}

function baseRail(root, y = -1.85, width = 5.2, z = -0.65) {
  root.add(makeBeam(
    new THREE.Vector3(-width / 2, y, z),
    new THREE.Vector3(width / 2, y, z),
    { thickness: 0.12, depth: 0.18, color: PALETTE.frame },
  ));
}

function gearPair(movement) {
  const random = seededRandom(movement.id);
  const root = new THREE.Group();
  const teethA = 14 + Math.floor(random() * 8);
  const teethB = 22 + Math.floor(random() * 12);
  const radiusA = 0.72 + random() * 0.22;
  const radiusB = radiusA * (teethB / teethA);
  const distance = (radiusA + radiusB) * 0.95;
  const gearA = makeGear({ teeth: teethA, radius: radiusA, depth: 0.34, color: PALETTE.driver });
  const gearB = makeGear({ teeth: teethB, radius: radiusB, depth: 0.34, color: PALETTE.driven });
  gearA.position.set(-distance / 2, 0, 0);
  gearB.position.set(distance / 2, 0, 0);
  root.add(gearA, gearB);
  axle(root, gearA.position);
  axle(root, gearB.position);
  baseRail(root, -Math.max(radiusA, radiusB) - 0.7, Math.max(5, distance + 2));
  return result(root, (time) => {
    const angle = time * 1.15;
    setSpin(gearA, angle);
    setSpin(gearB, -angle * teethA / teethB);
  });
}

function bevelPair(movement) {
  const random = seededRandom(movement.id * 7);
  const root = new THREE.Group();
  const radiusA = 0.82 + random() * 0.16;
  const radiusB = 0.82 + random() * 0.2;
  const gearA = makeBevelGear({ teeth: 18, radius: radiusA, color: PALETTE.driver, axis: X_AXIS });
  const gearB = makeBevelGear({ teeth: 20, radius: radiusB, color: PALETTE.driven, axis: Y_AXIS });
  gearA.position.set(-0.35, 0, 0);
  gearB.position.set(0, 0.35, 0);
  const shaftA = makeShaft({ length: 3.4, radius: 0.09, axis: X_AXIS });
  shaftA.position.set(-1.2, 0, 0);
  const shaftB = makeShaft({ length: 3.4, radius: 0.09, axis: Y_AXIS });
  shaftB.position.set(0, 1.2, 0);
  root.add(gearA, gearB, shaftA, shaftB);
  baseRail(root, -1.65, 4.6, -0.75);
  return result(root, (time) => {
    setSpin(gearA, time * 1.25);
    setSpin(gearB, -time * 1.12);
    setSpin(shaftA, time * 1.25);
    setSpin(shaftB, -time * 1.12);
  }, new THREE.Vector3(6.7, 4.8, 7.2));
}

function wormGear(movement) {
  const root = new THREE.Group();
  const worm = makeScrew({ length: 3.2, radius: 0.34, pitch: 0.48, color: PALETTE.driver, axis: X_AXIS });
  worm.position.set(0, 0.95, 0.38);
  const wheel = makeGear({ teeth: 28, radius: 1.15, depth: 0.38, color: PALETTE.driven, axis: Z_AXIS });
  wheel.position.set(0, -0.28, 0);
  root.add(worm, wheel);
  axle(root, wheel.position, 1.5);
  const wormShaft = makeShaft({ length: 4.3, radius: 0.075, axis: X_AXIS });
  wormShaft.position.copy(worm.position);
  root.add(wormShaft);
  baseRail(root, -1.75, 5.2);
  return result(root, (time) => {
    setSpin(worm, time * 2.2);
    setSpin(wormShaft, time * 2.2);
    setSpin(wheel, -time * 0.34);
  }, new THREE.Vector3(6.8, 4.6, 8));
}

function rackAndPinion(movement) {
  const root = new THREE.Group();
  const radius = 0.92;
  const gear = makeGear({ teeth: 18, radius, depth: 0.34, color: PALETTE.driver });
  gear.position.set(0, 0.7, 0);
  const rack = makeRack({ length: 4.4, toothCount: 21, width: 0.4, color: PALETTE.driven });
  rack.position.set(0, -0.4, 0);
  root.add(gear, rack);
  axle(root, gear.position);
  baseRail(root, -1.35, 5.2);
  return result(root, (time) => {
    const angle = Math.sin(time * 0.72) * 1.25;
    setSpin(gear, -angle);
    rack.position.x = angle * radius * 0.82;
  });
}

function ratchetMovement(movement, escapement = false) {
  const root = new THREE.Group();
  const teeth = escapement ? 24 : 16;
  const wheel = makeGear({ teeth, radius: 1.15, depth: 0.3, color: PALETTE.driven, toothDepth: escapement ? 0.3 : 0.2 });
  wheel.position.set(0, -0.2, 0);
  const pawl = new THREE.Group();
  const pawlBeam = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.14, 0.24), matte(PALETTE.driver));
  pawlBeam.position.x = -0.68;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4), matte(PALETTE.ink));
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = -1.45;
  pawl.add(pawlBeam, tip);
  pawl.position.set(0.88, 1.35, 0.1);
  root.add(wheel, pawl);
  axle(root, wheel.position);
  baseRail(root, -1.75, 4.6);
  return result(root, (time) => {
    const pulses = time * (escapement ? 1.8 : 1.25);
    const whole = Math.floor(pulses);
    const fraction = pulses - whole;
    const advance = whole + smoothStep01(Math.min(fraction * 2.8, 1));
    setSpin(wheel, -advance * Math.PI * 2 / teeth);
    pawl.rotation.z = (escapement ? 0.22 : 0.13) * Math.sin(pulses * Math.PI * 2) - 0.12;
  });
}

function camFollower(movement) {
  const random = seededRandom(movement.id * 11);
  const root = new THREE.Group();
  const eccentricity = 0.16 + random() * 0.18;
  const cam = makeCam({ radius: 0.9, eccentricity, depth: 0.34, color: PALETTE.driver });
  cam.position.set(0, -0.45, 0);
  const roller = makePulley({ radius: 0.24, width: 0.26, color: PALETTE.accent });
  const follower = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.5, 0.2), matte(PALETTE.driven));
  rod.position.y = 1.05;
  follower.add(roller, rod);
  follower.position.set(0, 0.7, 0.08);
  root.add(cam, follower);
  axle(root, cam.position);
  root.add(
    makeBeam(new THREE.Vector3(-0.5, 2.4, -0.5), new THREE.Vector3(0.5, 2.4, -0.5), { thickness: 0.18, depth: 0.25, color: PALETTE.frame }),
    makeBeam(new THREE.Vector3(-0.5, 0.3, -0.5), new THREE.Vector3(-0.5, 2.4, -0.5), { thickness: 0.1, depth: 0.12, color: PALETTE.frame }),
    makeBeam(new THREE.Vector3(0.5, 0.3, -0.5), new THREE.Vector3(0.5, 2.4, -0.5), { thickness: 0.1, depth: 0.12, color: PALETTE.frame }),
  );
  return result(root, (time) => {
    const angle = time * 1.25;
    setSpin(cam, angle);
    follower.position.y = 0.63 + Math.cos(angle) * eccentricity * 0.9;
    setSpin(roller, -angle * 2.4);
  });
}

function screwMovement(movement) {
  const root = new THREE.Group();
  const reversed = /right\s*(?:-|and)\s*left|double reversed/i.test(movement.description);
  const screw = makeScrew({ length: 4.4, radius: 0.36, pitch: 0.52, color: PALETTE.driver, axis: X_AXIS });
  const nutMaterial = matte(PALETTE.driven, { metalness: 0.1 });
  const nutA = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.9, 0.82), nutMaterial);
  nutA.position.y = 0;
  root.add(screw, nutA);
  let nutB;
  if (reversed) {
    nutB = nutA.clone();
    root.add(nutB);
  }
  const guide = makeBeam(new THREE.Vector3(-2.5, -0.72, -0.5), new THREE.Vector3(2.5, -0.72, -0.5), { thickness: 0.12, depth: 0.16, color: PALETTE.frame });
  root.add(guide);
  return result(root, (time) => {
    const travel = Math.sin(time * 0.55) * (reversed ? 1.35 : 1.7);
    setSpin(screw, time * 1.8);
    nutA.position.x = travel;
    if (nutB) nutB.position.x = -travel;
  }, new THREE.Vector3(6.6, 4.1, 8.2));
}

function crankSlider(movement, pump = false, steam = false) {
  const root = new THREE.Group();
  const flywheel = makePulley({ radius: steam ? 1.12 : 0.9, width: 0.32, color: PALETTE.driver, spokes: 6 });
  flywheel.position.set(-1.65, 0, 0);
  const crankPin = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), matte(PALETTE.accent));
  const link = makeDynamicLink({ thickness: 0.16, depth: 0.24, color: PALETTE.ink, jointRadius: 0.17 });
  const piston = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.82, 0.72), matte(PALETTE.driven));
  const cylinderMaterial = matte(steam ? PALETTE.brass : PALETTE.frame, { transparent: true, opacity: 0.48, side: THREE.DoubleSide });
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.4, 36, 1, true), cylinderMaterial);
  cylinder.rotation.z = Math.PI / 2;
  cylinder.position.set(1.5, 0, 0);
  root.add(flywheel, crankPin, link, piston, cylinder);
  axle(root, flywheel.position, 1.4);
  baseRail(root, -1.35, 5.8);

  if (pump) {
    const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.09, 10, 32, Math.PI), matte(PALETTE.fluid));
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(2.3, 0.55, 0);
    root.add(pipe);
  }

  const crankRadius = 0.58;
  const connectingLength = 2.25;
  return result(root, (time) => {
    const angle = time * (steam ? 1.45 : 1.15);
    const crank = new THREE.Vector3(
      flywheel.position.x + Math.cos(angle) * crankRadius,
      Math.sin(angle) * crankRadius,
      0.2,
    );
    const vertical = crank.y;
    const pistonX = flywheel.position.x + Math.cos(angle) * crankRadius
      + Math.sqrt(connectingLength ** 2 - vertical ** 2);
    const pistonPoint = new THREE.Vector3(pistonX, 0, 0.2);
    setSpin(flywheel, angle);
    crankPin.position.copy(crank);
    piston.position.set(pistonX, 0, 0);
    link.userData.setEndpoints(crank, pistonPoint);
  }, new THREE.Vector3(6.8, 4, 8.5));
}

function fourBar(movement) {
  const root = new THREE.Group();
  const fixedA = new THREE.Vector3(-1.55, -0.95, 0);
  const fixedD = new THREE.Vector3(1.55, -0.95, 0);
  const crankLength = 0.72;
  const couplerLength = 2.45;
  const rockerLength = 1.42;
  const crank = makeDynamicLink({ color: PALETTE.driver, thickness: 0.18, depth: 0.24, jointRadius: 0.17 });
  const coupler = makeDynamicLink({ color: PALETTE.ink, thickness: 0.14, depth: 0.22, jointRadius: 0.16 });
  const rocker = makeDynamicLink({ color: PALETTE.driven, thickness: 0.18, depth: 0.24, jointRadius: 0.17 });
  const ground = makeDynamicLink({ color: PALETTE.frame, thickness: 0.12, depth: 0.18, jointRadius: 0.12 });
  ground.userData.setEndpoints(fixedA, fixedD);
  root.add(crank, coupler, rocker, ground);
  baseRail(root, -1.65, 5.1);

  function circleIntersection(centerA, radiusA, centerB, radiusB) {
    const delta = new THREE.Vector3().subVectors(centerB, centerA);
    const distance = delta.length();
    const along = (radiusA ** 2 - radiusB ** 2 + distance ** 2) / (2 * distance);
    const height = Math.sqrt(Math.max(0, radiusA ** 2 - along ** 2));
    const base = centerA.clone().add(delta.clone().multiplyScalar(along / distance));
    const perpendicular = new THREE.Vector3(-delta.y, delta.x, 0).normalize().multiplyScalar(height);
    return base.add(perpendicular);
  }

  return result(root, (time) => {
    const angle = time * 0.9;
    const pointB = fixedA.clone().add(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).multiplyScalar(crankLength));
    const pointC = circleIntersection(pointB, couplerLength, fixedD, rockerLength);
    crank.userData.setEndpoints(fixedA, pointB);
    coupler.userData.setEndpoints(pointB, pointC);
    rocker.userData.setEndpoints(pointC, fixedD);
  });
}

function governor(movement) {
  const root = new THREE.Group();
  const shaft = makeShaft({ length: 4.2, radius: 0.09, axis: Y_AXIS });
  shaft.position.y = 0.2;
  const top = new THREE.Vector3(0, 1.85, 0);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.34, 28), matte(PALETTE.driven));
  const ballMaterial = matte(PALETTE.driver, { metalness: 0.15 });
  const ballA = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), ballMaterial);
  const ballB = ballA.clone();
  const rodA = makeDynamicLink({ thickness: 0.075, depth: 0.075, color: PALETTE.ink, jointRadius: 0.08 });
  const rodB = makeDynamicLink({ thickness: 0.075, depth: 0.075, color: PALETTE.ink, jointRadius: 0.08 });
  root.add(shaft, collar, ballA, ballB, rodA, rodB);
  baseRail(root, -2, 4.2);
  return result(root, (time) => {
    const spin = time * 2.3;
    const spread = 0.8 + 0.35 * (0.5 + 0.5 * Math.sin(time * 0.4));
    const ballY = 0.35 - spread * 0.25;
    ballA.position.set(Math.cos(spin) * spread, ballY, Math.sin(spin) * spread);
    ballB.position.set(-Math.cos(spin) * spread, ballY, -Math.sin(spin) * spread);
    collar.position.y = -0.45 + spread * 0.35;
    rodA.userData.setEndpoints(top, ballA.position);
    rodB.userData.setEndpoints(top, ballB.position);
    setSpin(shaft, spin);
  }, new THREE.Vector3(6.6, 4.2, 7.4));
}

function beltFamily(movement, friction = false) {
  const random = seededRandom(movement.id * 17);
  const root = new THREE.Group();
  const centerA = new THREE.Vector2(-1.45, 0.25);
  const centerB = new THREE.Vector2(1.45, -0.15);
  const radiusA = 0.62 + random() * 0.25;
  const radiusB = 0.72 + random() * 0.32;
  const crossed = /crossed|reverse/i.test(movement.description) || movement.id % 7 === 0;
  const pulleyA = makePulley({ radius: radiusA, color: PALETTE.driver });
  const pulleyB = makePulley({ radius: radiusB, color: PALETTE.driven });
  pulleyA.position.set(centerA.x, centerA.y, 0);
  pulleyB.position.set(centerB.x, centerB.y, 0);
  root.add(pulleyA, pulleyB);
  let belt;
  if (!friction) {
    belt = makeMovingBelt(
      crossed
        ? beltCurveCrossed(centerA, centerB, radiusA, radiusB, 0.04)
        : beltCurveOpen(centerA, centerB, radiusA, radiusB, 0.04),
      { radius: 0.055, markerCount: 9 },
    );
    root.add(belt);
  }
  axle(root, pulleyA.position);
  axle(root, pulleyB.position);
  baseRail(root, -1.55, 5.3);
  return result(root, (time) => {
    const angle = time * 1.2;
    setSpin(pulleyA, angle);
    setSpin(pulleyB, (crossed || friction ? -1 : 1) * angle * radiusA / radiusB);
    belt?.userData.update(time * 0.11);
  });
}

function waterWheel(movement) {
  const root = new THREE.Group();
  const wheel = makePaddleWheel({ radius: 1.55, width: 0.75, paddles: 14, color: PALETTE.driver });
  wheel.position.y = 0.1;
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.42, 2.3),
    matte(PALETTE.fluid, { transparent: true, opacity: 0.42, roughness: 0.35 }),
  );
  water.position.y = -1.25;
  const channelLeft = makeBeam(new THREE.Vector3(-2.6, -1.55, -1.15), new THREE.Vector3(2.6, -1.55, -1.15), { thickness: 0.12, depth: 0.16, color: PALETTE.frame });
  const channelRight = makeBeam(new THREE.Vector3(-2.6, -1.55, 1.15), new THREE.Vector3(2.6, -1.55, 1.15), { thickness: 0.12, depth: 0.16, color: PALETTE.frame });
  root.add(wheel, water, channelLeft, channelRight);
  axle(root, wheel.position, 2.4);
  return result(root, (time) => setSpin(wheel, -time * 0.7), new THREE.Vector3(6.8, 4.1, 7.8));
}

function hydraulicMovement(movement) {
  const root = new THREE.Group();
  const smallCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 2.2, 32, 1, true),
    matte(PALETTE.frame, { transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  const largeCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 2.2, 40, 1, true),
    matte(PALETTE.frame, { transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  smallCylinder.position.set(-1.35, 0, 0);
  largeCylinder.position.set(1.25, 0, 0);
  const smallPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 28), matte(PALETTE.driver));
  const largePiston = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.35, 36), matte(PALETTE.driven));
  const fluid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.2), matte(PALETTE.fluid, { transparent: true, opacity: 0.7 }));
  fluid.position.y = -1.1;
  root.add(smallCylinder, largeCylinder, smallPiston, largePiston, fluid);
  baseRail(root, -1.45, 5.4);
  return result(root, (time) => {
    const input = Math.sin(time * 0.8);
    smallPiston.position.set(-1.35, input * 0.72, 0);
    largePiston.position.set(1.25, -input * 0.32, 0);
  });
}

function pressMovement(movement) {
  const root = new THREE.Group();
  const topLeft = new THREE.Vector3(-1.45, 1.8, 0);
  const topRight = new THREE.Vector3(1.45, 1.8, 0);
  const joint = new THREE.Vector3(0, 0.45, 0);
  const armA = makeDynamicLink({ color: PALETTE.driver, thickness: 0.2, depth: 0.3, jointRadius: 0.18 });
  const armB = makeDynamicLink({ color: PALETTE.driven, thickness: 0.2, depth: 0.3, jointRadius: 0.18 });
  const ram = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.5, 0.62), matte(PALETTE.ink));
  const platen = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 1.2), matte(PALETTE.frame));
  platen.position.y = -1.35;
  root.add(armA, armB, ram, platen);
  root.add(
    makeBeam(new THREE.Vector3(-2, -1.65, -0.7), new THREE.Vector3(-2, 2.2, -0.7), { thickness: 0.16, depth: 0.22, color: PALETTE.frame }),
    makeBeam(new THREE.Vector3(2, -1.65, -0.7), new THREE.Vector3(2, 2.2, -0.7), { thickness: 0.16, depth: 0.22, color: PALETTE.frame }),
    makeBeam(new THREE.Vector3(-2, 2.2, -0.7), new THREE.Vector3(2, 2.2, -0.7), { thickness: 0.16, depth: 0.22, color: PALETTE.frame }),
  );
  return result(root, (time) => {
    joint.y = 0.35 + Math.sin(time * 0.78) * 0.72;
    armA.userData.setEndpoints(topLeft, joint);
    armB.userData.setEndpoints(joint, topRight);
    ram.position.set(0, joint.y - 0.76, 0);
  });
}

function springMovement(movement) {
  const root = new THREE.Group();
  const spring = makeSpring({ length: 2.5, radius: 0.36, turns: 10, color: PALETTE.driver });
  spring.position.y = 0.6;
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 18), matte(PALETTE.driven));
  const hanger = makeBeam(new THREE.Vector3(-1.2, 2.05, 0), new THREE.Vector3(1.2, 2.05, 0), { thickness: 0.14, depth: 0.2, color: PALETTE.frame });
  root.add(spring, bob, hanger);
  return result(root, (time) => {
    const stretch = 1 + Math.sin(time * 1.1) * 0.18;
    spring.scale.y = stretch;
    spring.position.y = 2.05 - 1.25 * stretch;
    bob.position.y = 2.05 - 2.5 * stretch - 0.48;
  });
}

function universalJoint(movement) {
  const root = new THREE.Group();
  const directionA = new THREE.Vector3(-1, 0, 0);
  const directionB = new THREE.Vector3(0.78, 0.5, 0.38).normalize();
  const shaftA = makeShaft({ length: 3.2, radius: 0.13, axis: X_AXIS, color: PALETTE.driver });
  shaftA.position.copy(directionA).multiplyScalar(1.55);
  const shaftB = makeShaft({ length: 3.2, radius: 0.13, axis: directionB, color: PALETTE.driven });
  shaftB.position.copy(directionB).multiplyScalar(1.55);
  const cross = new THREE.Group();
  const crossA = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.15, 18), matte(PALETTE.ink));
  const crossB = crossA.clone();
  crossA.rotation.z = Math.PI / 2;
  crossB.rotation.x = Math.PI / 2;
  cross.add(crossA, crossB);
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 12, 36, Math.PI), matte(PALETTE.driver));
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 12, 36, Math.PI), matte(PALETTE.driven));
  ringA.rotation.y = Math.PI / 2;
  ringB.quaternion.setFromUnitVectors(Z_AXIS, directionB);
  root.add(shaftA, shaftB, cross, ringA, ringB);
  return result(root, (time) => {
    const input = time * 1.25;
    const beta = Math.acos(directionB.dot(X_AXIS));
    const output = Math.atan2(Math.sin(input) * Math.cos(beta), Math.cos(input));
    setSpin(shaftA, input);
    setSpin(shaftB, output);
    ringA.rotation.x = input;
    ringB.rotateOnAxis(directionB, 0.012 * Math.cos(time));
    cross.rotation.x = input;
    cross.rotation.z = output;
  }, new THREE.Vector3(6.8, 4.8, 7.6));
}

function epicyclic(movement) {
  const root = new THREE.Group();
  const sunTeeth = 14;
  const planetTeeth = 10;
  const sun = makeGear({ teeth: sunTeeth, radius: 0.65, depth: 0.3, color: PALETTE.driver });
  const carrier = new THREE.Group();
  const planetRadius = 1.18;
  const planets = Array.from({ length: 3 }, (_, index) => {
    const planet = makeGear({ teeth: planetTeeth, radius: 0.45, depth: 0.28, color: PALETTE.driven });
    const angle = index * Math.PI * 2 / 3;
    planet.position.set(Math.cos(angle) * planetRadius, Math.sin(angle) * planetRadius, 0);
    carrier.add(planet);
    return planet;
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.14, 12, 72), matte(PALETTE.ink));
  const armMaterial = matte(PALETTE.brass);
  for (let index = 0; index < 3; index += 1) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(planetRadius, 0.11, 0.18), armMaterial);
    arm.position.x = planetRadius / 2;
    arm.rotation.z = index * Math.PI * 2 / 3;
    carrier.add(arm);
  }
  root.add(sun, carrier, ring);
  axle(root, new THREE.Vector3(), 1.5);
  baseRail(root, -2.05, 5.2);
  return result(root, (time) => {
    const sunAngle = time * 1.1;
    const carrierAngle = time * 0.22;
    setSpin(sun, sunAngle);
    carrier.rotation.z = carrierAngle;
    planets.forEach((planet) => setSpin(planet, -(sunAngle - carrierAngle) * sunTeeth / planetTeeth));
  });
}

function rotaryMachine(movement) {
  const root = new THREE.Group();
  const housing = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.18, 14, 64),
    matte(PALETTE.frame, { transparent: true, opacity: 0.55 }),
  );
  const rotor = new THREE.Group();
  for (let index = 0; index < 5; index += 1) {
    const vane = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.42), matte(index === 0 ? PALETTE.driver : PALETTE.driven));
    vane.position.x = 0.58;
    vane.rotation.z = index * Math.PI * 2 / 5;
    rotor.add(vane);
  }
  const shaft = makeShaft({ length: 1.7, radius: 0.12 });
  root.add(housing, rotor, shaft);
  baseRail(root, -1.85, 4.6);
  return result(root, (time) => {
    rotor.rotation.z = time * 1.25;
    setSpin(shaft, time * 1.25);
  });
}

export function createProceduralMovement(movement) {
  switch (movement.archetype) {
    case 'gear-pair': return gearPair(movement);
    case 'bevel-gears': return bevelPair(movement);
    case 'worm-gear': return wormGear(movement);
    case 'rack-pinion': return rackAndPinion(movement);
    case 'ratchet': return ratchetMovement(movement, false);
    case 'escapement': return ratchetMovement(movement, true);
    case 'cam-follower': return camFollower(movement);
    case 'screw': return screwMovement(movement);
    case 'crank-slider': return crankSlider(movement, false, false);
    case 'steam-engine': return crankSlider(movement, false, true);
    case 'pump': return crankSlider(movement, true, false);
    case 'linkage': return fourBar(movement);
    case 'governor': return governor(movement);
    case 'belt': return beltFamily(movement, false);
    case 'friction-drive': return beltFamily(movement, true);
    case 'waterwheel': return waterWheel(movement);
    case 'hydraulic': return hydraulicMovement(movement);
    case 'press': return pressMovement(movement);
    case 'spring': return springMovement(movement);
    case 'universal-joint': return universalJoint(movement);
    case 'epicyclic': return epicyclic(movement);
    case 'rotary-engine': return rotaryMachine(movement);
    case 'generic-kinematic':
    default: return fourBar(movement);
  }
}
