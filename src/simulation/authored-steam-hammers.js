import {correctHammerWorkingParts} from './hammer-working-parts.js';
import {
  circle,
  plate,
  poly,
  polygonClipping,
  spline,
} from './finite-plate-geometry.js';
import * as THREE from 'three';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

function smootherStepIntegral(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 2.5 * x ** 4 - 3 * x ** 5 + x ** 6;
}

function smootherStepDoubleIntegral(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 0.5 * x ** 5 - 0.5 * x ** 6 + x ** 7 / 7;
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

function cylinderAlongX(radius, length, material, segments = 28) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function rodBetween(start, end, radius, material, segments = 18) {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, segments),
    material,
  );
  setRodBetween(rod, start, end);
  return rod;
}

// Brown draws one cast standard: two legs splayed into feet at the ground
// line, rising as straight columns either side of the cylinder and joined by
// a crown that the cylinder passes through, with a crossbar under the
// cylinder. The legs are one plate in the elevation plane; the crown and the
// crossbar are plan plates bored for the cylinder and the piston rod.
function buildArchedCastStandard(frame, material, groundY, {
  cylinderOuterRadius,
  crossbarTopY,
}) {
  for (const child of [...frame.children]) {
    child.removeFromParent();
    child.geometry?.dispose();
  }
  const back = -0.30;
  const front = 0.22;
  const innerX = 0.64;
  const outerX = 1.02;
  const crownBottomY = 2.75;
  const crownTopY = 2.95;
  const footY = groundY + 0.14;
  const halfLeg = [
    [innerX, crownBottomY],
    [outerX, crownBottomY],
    ...spline([[outerX, 0.75], [1.07, 0.20], [1.24, -0.45], [1.55, footY]]),
    [1.74, groundY + 0.10],
    [1.74, groundY],
    [1.04, groundY],
    [1.04, groundY + 0.10],
    ...spline([[1.18, footY], [0.88, -0.35], [0.69, 0.35], [innerX, 0.95]]),
  ];
  for (const side of [-1, 1]) {
    const points = halfLeg.map(([x, y]) => [side * x, y]);
    if (side < 0) points.reverse();
    const leg = addRole(new THREE.Mesh(
      plate(poly(points), back, front),
      material,
    ), `arched-cast-standard-leg-${side < 0 ? 'left' : 'right'}`);
    frame.add(leg);
  }
  const planPlate = (halfWidth, holeRadius, low, high) => {
    // The plan polygon's y is -z after the rotation.
    const outline = poly([
      [-halfWidth, -front],
      [halfWidth, -front],
      [halfWidth, -back],
      [-halfWidth, -back],
    ]);
    return plate(
      polygonClipping.difference(outline, poly(circle([0, 0], holeRadius, 128))),
      low,
      high,
    ).rotateX(-Math.PI / 2);
  };
  const crown = addRole(new THREE.Mesh(
    planPlate(outerX, cylinderOuterRadius, crownBottomY, crownTopY),
    material,
  ), 'standard-crown-bored-for-cylinder');
  frame.add(crown);
  const crossbar = addRole(new THREE.Mesh(
    planPlate(innerX, 0.09, crossbarTopY - 0.10, crossbarTopY),
    material,
  ), 'standard-crossbar-bored-for-piston-rod');
  frame.add(crossbar);
}

function steamHammer(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.2;
  const liftStartPhase = 0.08;
  const liftEndPhase = 0.46;
  const topHoldEndPhase = 0.52;
  const releaseDuration = 0.22;
  const releaseEndPhase = topHoldEndPhase
    + releaseDuration / cycleDuration;
  const gravity = 9.81;
  const maximumLift = 1.05;
  const movingMassKilogram = 160;
  const pistonRadius = 0.337;
  const pistonArea = Math.PI * pistonRadius ** 2;
  const staticSupportGaugePressure = movingMassKilogram * gravity
    / pistonArea;
  const liftDuration = (liftEndPhase - liftStartPhase) * cycleDuration;
  const releaseDrop = gravity * releaseDuration ** 2 / 7;
  const releaseEndDownwardSpeed = gravity * releaseDuration / 2;
  const ballisticDrop = maximumLift - releaseDrop;
  const ballisticDuration = (
    -releaseEndDownwardSpeed
    + Math.sqrt(
      releaseEndDownwardSpeed ** 2 + 2 * gravity * ballisticDrop,
    )
  ) / gravity;
  const impactPhase = releaseEndPhase + ballisticDuration / cycleDuration;
  const impactSpeed = releaseEndDownwardSpeed
    + gravity * ballisticDuration;
  const impactKineticEnergyJoule = 0.5 * movingMassKilogram
    * impactSpeed ** 2;
  const impactImpulseNewtonSecond = movingMassKilogram * impactSpeed;
  const anvilTopY = -0.52;
  const hammerHeadHeight = 0.50;
  const hammerHeadBottomCenterY = anvilTopY + hammerHeadHeight / 2;
  const pistonBottomCenterY = 1.62;
  const pistonThickness = 0.20;
  const cylinderInnerBottomY = 1.25;
  const cylinderInnerTopY = 3.10;
  const cylinderOuterRadius = 0.44;
  const cylinderInnerRadius = 0.34;
  const valvePivot = new THREE.Vector3(1.63, 1.28, 0.52);
  const valveSliderY = 1.28;
  const valveCrankRadius = 0.22;
  const valvePitmanLength = 0.46;
  const valveBaseAngle = Math.PI / 2;
  const valveAngleAmplitude = THREE.MathUtils.degToRad(25);
  const valveSpoolHalfTravel = 0.10;
  const groundY = -1.12;

  const valveKinematics = (command) => {
    const clampedCommand = THREE.MathUtils.clamp(command, -1, 1);
    const crankAngle = valveBaseAngle
      + valveAngleAmplitude * clampedCommand;
    const crankPin = new THREE.Vector3(
      valvePivot.x + valveCrankRadius * Math.cos(crankAngle),
      valvePivot.y + valveCrankRadius * Math.sin(crankAngle),
      valvePivot.z,
    );
    const verticalOffset = valveSliderY - crankPin.y;
    const horizontalReach = Math.sqrt(Math.max(
      0,
      valvePitmanLength ** 2 - verticalOffset ** 2,
    ));
    const spoolPin = new THREE.Vector3(
      crankPin.x - horizontalReach,
      valveSliderY,
      valvePivot.z,
    );
    return {
      command: clampedCommand,
      crankAngle,
      crankPin,
      horizontalReach,
      spoolPin,
      verticalOffset,
    };
  };

  const stateAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = [0, liftStartPhase, liftEndPhase, topHoldEndPhase,
      releaseEndPhase, impactPhase].find((boundary) =>
      Math.abs(rawPhase - boundary) < 1e-12) ?? rawPhase;
    let hammerLift = 0;
    let hammerVelocity = 0;
    let hammerAcceleration = 0;
    let gaugePressure = 0;
    let valveCommand = 1;
    let admissionOpening = 0;
    let exhaustOpening = 1;
    let regime;

    if (phase < liftStartPhase) {
      const local = phase / liftStartPhase;
      const progress = smootherStep(local);
      valveCommand = 1 - 2 * progress;
      admissionOpening = progress;
      exhaustOpening = 1 - progress;
      gaugePressure = staticSupportGaugePressure * progress;
      regime = 'bottom-contact-valve-shifts-to-admission-and-pressure-builds';
    } else if (phase < liftEndPhase) {
      const local = (phase - liftStartPhase)
        / (liftEndPhase - liftStartPhase);
      hammerLift = maximumLift * smootherStep(local);
      hammerVelocity = maximumLift * smootherStepDerivative(local)
        / liftDuration;
      hammerAcceleration = maximumLift
        * smootherStepSecondDerivative(local) / liftDuration ** 2;
      gaugePressure = movingMassKilogram
        * (gravity + hammerAcceleration) / pistonArea;
      valveCommand = -1;
      admissionOpening = 1;
      exhaustOpening = 0;
      regime = 'steam-admitted-below-piston-raises-hammer';
    } else if (phase < topHoldEndPhase) {
      hammerLift = maximumLift;
      gaugePressure = staticSupportGaugePressure;
      valveCommand = -1;
      admissionOpening = 1;
      exhaustOpening = 0;
      regime = 'steam-pressure-holds-hammer-at-top';
    } else if (phase < releaseEndPhase) {
      const local = (phase - topHoldEndPhase)
        / (releaseEndPhase - topHoldEndPhase);
      const progress = smootherStep(local);
      hammerLift = maximumLift - gravity * releaseDuration ** 2
        * smootherStepDoubleIntegral(local);
      hammerVelocity = -gravity * releaseDuration
        * smootherStepIntegral(local);
      hammerAcceleration = -gravity * progress;
      gaugePressure = staticSupportGaugePressure * (1 - progress);
      valveCommand = -1 + 2 * progress;
      admissionOpening = 1 - progress;
      exhaustOpening = progress;
      regime = 'slide-valve-opens-exhaust-and-steam-support-decays';
    } else if (phase < impactPhase) {
      const elapsedFallTime = (phase - releaseEndPhase) * cycleDuration;
      hammerLift = maximumLift - releaseDrop
        - releaseEndDownwardSpeed * elapsedFallTime
        - 0.5 * gravity * elapsedFallTime ** 2;
      hammerVelocity = -releaseEndDownwardSpeed
        - gravity * elapsedFallTime;
      hammerAcceleration = -gravity;
      valveCommand = 1;
      admissionOpening = 0;
      exhaustOpening = 1;
      regime = 'exhaust-open-hammer-and-piston-in-gravitational-free-fall';
    } else {
      valveCommand = 1;
      admissionOpening = 0;
      exhaustOpening = 1;
      regime = phase < impactPhase + 0.035
        ? 'anvil-impact-removes-downward-momentum-by-contact-impulse'
        : 'hammer-rests-on-anvil-with-cylinder-exhausted';
    }

    const valve = valveKinematics(valveCommand);
    const pistonCenterY = pistonBottomCenterY + hammerLift;
    const hammerHeadCenterY = hammerHeadBottomCenterY + hammerLift;
    const hammerFaceY = hammerHeadCenterY - hammerHeadHeight / 2;
    const steamChamberHeight = pistonCenterY - pistonThickness / 2
      - cylinderInnerBottomY;
    const steamChamberVolume = pistonArea * steamChamberHeight;
    const pressureForce = gaugePressure * pistonArea;
    const weightForce = movingMassKilogram * gravity;
    const unconstrainedForceResidual = pressureForce - weightForce
      - movingMassKilogram * hammerAcceleration;
    const anvilReaction = phase < liftStartPhase
      ? Math.max(0, weightForce - pressureForce)
      : phase >= impactPhase
        ? weightForce
        : 0;
    return {
      admissionOpening,
      anvilReaction,
      exhaustOpening,
      gaugePressure,
      hammerAcceleration,
      hammerFaceY,
      hammerHeadCenterY,
      hammerLift: Math.max(0, hammerLift),
      hammerVelocity,
      phase,
      pistonCenterY,
      pressureForce,
      regime,
      steamChamberHeight,
      steamChamberVolume,
      steamVisible: gaugePressure > staticSupportGaugePressure * 0.015,
      unconstrainedForceResidual,
      valve,
      valveCommand,
      weightForce,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.46,
    roughness: 0.37,
  });
  const movingMaterial = matte(PALETTE.driver, {
    metalness: 0.28,
    roughness: 0.46,
  });
  const cylinderMaterial = matte(PALETTE.driven, {
    transparent: true,
    opacity: 0.42,
    metalness: 0.20,
    roughness: 0.38,
    side: THREE.DoubleSide,
  });
  cylinderMaterial.depthWrite = false;
  const steamMaterial = matte(PALETTE.white, {
    transparent: true,
    opacity: 0.54,
    roughness: 0.18,
  });
  steamMaterial.emissive.set(0xb8d6dc);
  steamMaterial.emissiveIntensity = 0.15;
  steamMaterial.depthWrite = false;

  const foundation = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.75, 0.18, 1.70),
    frameMaterial,
  ), 'steam-hammer-foundation');
  foundation.position.set(0, groundY + 0.09, 0);
  root.add(foundation);

  const pressFrame = addRole(new THREE.Group(), 'fixed-steam-hammer-frame');
  root.add(pressFrame);
  for (const side of [-1, 1]) {
    const column = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 3.85, 0.48),
      frameMaterial,
    ), `frame-column-${side < 0 ? 'left' : 'right'}`);
    column.position.set(side * 1.38, 0.82, -0.20);
    pressFrame.add(column);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.24, 0.82),
      frameMaterial,
    );
    foot.position.set(side * 1.38, groundY + 0.20, -0.12);
    pressFrame.add(foot);
    const brace = rodBetween(
      new THREE.Vector3(side * 1.38, -0.70, -0.20),
      new THREE.Vector3(side * 0.88, 0.00, -0.20),
      0.13,
      frameMaterial,
      20,
    );
    pressFrame.add(brace);
  }
  const crown = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.02, 0.30, 0.62),
    frameMaterial,
  ), 'frame-crown');
  crown.position.set(0, 3.34, -0.20);
  pressFrame.add(crown);

  const cylinderHeight = cylinderInnerTopY - cylinderInnerBottomY + 0.18;
  const fixedCylinder = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderOuterRadius,
      cylinderOuterRadius,
      cylinderHeight,
      52,
      1,
      true,
      Math.PI * 0.16,
      Math.PI * 1.68,
    ),
    cylinderMaterial,
  ), 'fixed-upper-front-cutaway-steam-cylinder');
  fixedCylinder.position.y = (cylinderInnerBottomY + cylinderInnerTopY) / 2;
  root.add(fixedCylinder);
  const cylinderRings = [
    cylinderInnerBottomY - 0.09,
    cylinderInnerTopY + 0.09,
  ].map((y, index) => {
    const ring = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(cylinderOuterRadius + 0.02, 0.055, 10, 56),
      darkMaterial,
    ), `fixed-cylinder-ring-${index + 1}`);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    root.add(ring);
    return ring;
  });

  const movingAssembly = addRole(new THREE.Group(),
    'rigid-piston-rod-and-hammer-assembly');
  root.add(movingAssembly);
  const piston = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderInnerRadius,
      cylinderInnerRadius,
      pistonThickness,
      42,
    ),
    movingMaterial,
  ), 'moving-steam-piston');
  piston.position.y = pistonBottomCenterY;
  movingAssembly.add(piston);
  const pistonSeal = new THREE.Mesh(
    new THREE.TorusGeometry(cylinderInnerRadius * 0.97, 0.030, 8, 48),
    darkMaterial,
  );
  pistonSeal.rotation.x = Math.PI / 2;
  pistonSeal.position.y = pistonBottomCenterY;
  movingAssembly.add(pistonSeal);

  const pistonRodStartY = hammerHeadBottomCenterY + hammerHeadHeight / 2;
  const pistonRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.075,
      0.075,
      pistonBottomCenterY - pistonRodStartY,
      28,
    ),
    darkMaterial,
  ), 'rigid-piston-rod');
  pistonRod.position.y = (pistonBottomCenterY + pistonRodStartY) / 2;
  movingAssembly.add(pistonRod);

  const hammerHead = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.29, hammerHeadHeight, 36),
    movingMaterial,
  ), 'gravity-falling-hammer-head');
  hammerHead.position.y = hammerHeadBottomCenterY;
  movingAssembly.add(hammerHead);
  const hammerFace = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.30, 0.045, 36),
    darkMaterial,
  ), 'hammer-striking-face');
  hammerFace.position.y = hammerHeadBottomCenterY - hammerHeadHeight / 2;
  movingAssembly.add(hammerFace);

  const anvil = addRole(new THREE.Group(), 'fixed-anvil');
  root.add(anvil);
  const anvilBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.46, 0.42, 36),
    matte(PALETTE.brass, { metalness: 0.38, roughness: 0.40 }),
  );
  anvilBody.position.y = anvilTopY - 0.21;
  anvil.add(anvilBody);
  const anvilFace = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.40, 0.055, 38),
    darkMaterial,
  ), 'anvil-contact-face');
  anvilFace.position.y = anvilTopY - 0.0275;
  anvil.add(anvilFace);

  const steamChamber = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderInnerRadius * 0.92,
      cylinderInnerRadius * 0.92,
      1,
      38,
    ),
    steamMaterial,
  ), 'variable-steam-chamber-below-piston');
  root.add(steamChamber);

  const valveChestMaterial = matte(PALETTE.white, {
    transparent: true,
    opacity: 0.34,
    roughness: 0.22,
    side: THREE.DoubleSide,
  });
  valveChestMaterial.depthWrite = false;
  const valveChest = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.42, 0.54),
    valveChestMaterial,
  ), 'cutaway-admission-and-exhaust-valve-chest');
  valveChest.position.set(1.08, valveSliderY, valvePivot.z);
  root.add(valveChest);
  const valveSpool = addRole(cylinderAlongX(
    0.105,
    0.35,
    movingMaterial,
    28,
  ), 'horizontal-slide-valve-spool');
  valveSpool.position.set(1.10, valveSliderY, valvePivot.z);
  root.add(valveSpool);

  const valveLever = addRole(new THREE.Group(), 'valve-rocking-hand-lever');
  valveLever.position.copy(valvePivot);
  root.add(valveLever);
  const leverBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.075, 0.075),
    darkMaterial,
  );
  leverBar.position.x = 0.34;
  valveLever.add(leverBar);
  const leverHandle = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 22, 14),
    movingMaterial,
  );
  leverHandle.position.x = 0.76;
  valveLever.add(leverHandle);
  const leverAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.28, 24),
    darkMaterial,
  );
  leverAxle.rotation.x = Math.PI / 2;
  valveLever.add(leverAxle);

  // The pitman is a bored link one plane in front of the lever bar and spool,
  // riding on a finite pin in each, so no member passes through another.
  const pitmanPlaneOffset = 0.16;
  const valvePinRadius = 0.03;
  const valvePitman = addRole(new THREE.Mesh(
    boredPlanarLinkGeometry({ length: valvePitmanLength, width: 0.07,
      eyeRadius: 0.07, boreRadius: valvePinRadius + 0.003, depth: 0.06 }),
    matte(PALETTE.accent, { metalness: 0.28, roughness: 0.46 }),
  ), 'constant-length-valve-pitman');
  valvePitman.userData.length = valvePitmanLength;
  root.add(valvePitman);
  const crankPinMesh = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(valvePinRadius, valvePinRadius, 0.26, 20),
    darkMaterial,
  ), 'valve-lever-crank-pin');
  crankPinMesh.rotation.x = Math.PI / 2;
  crankPinMesh.position.set(valveCrankRadius, 0, 0.10);
  valveLever.add(crankPinMesh);
  const spoolPinMesh = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(valvePinRadius, valvePinRadius, 0.18, 20),
    darkMaterial,
  ), 'valve-spool-pitman-pin');
  spoolPinMesh.rotation.x = Math.PI / 2;
  spoolPinMesh.position.set(0, 0, 0.13);
  valveSpool.add(spoolPinMesh);

  const cylinderInlet = new THREE.Vector3(
    cylinderOuterRadius,
    1.34,
    valvePivot.z,
  );
  const chestOutlet = new THREE.Vector3(0.72, 1.34, valvePivot.z);
  const admissionPassage = addRole(rodBetween(
    cylinderInlet,
    chestOutlet,
    0.075,
    darkMaterial,
    20,
  ), 'steam-passage-from-valve-to-lower-cylinder');
  root.add(admissionPassage);
  const supplyPipe = addRole(rodBetween(
    new THREE.Vector3(1.43, 1.18, valvePivot.z),
    new THREE.Vector3(2.05, 1.18, valvePivot.z),
    0.085,
    darkMaterial,
    20,
  ), 'external-steam-supply-pipe');
  root.add(supplyPipe);
  const exhaustStack = addRole(rodBetween(
    new THREE.Vector3(1.13, 1.49, valvePivot.z),
    new THREE.Vector3(1.13, 2.25, valvePivot.z),
    0.085,
    darkMaterial,
    20,
  ), 'steam-exhaust-stack');
  root.add(exhaustStack);

  const update = (time) => {
    const state = stateAtTime(time);
    movingAssembly.position.y = state.hammerLift;
    const chamberHeight = Math.max(0.001, state.steamChamberHeight);
    steamChamber.scale.y = chamberHeight;
    steamChamber.position.y = cylinderInnerBottomY + chamberHeight / 2;
    steamChamber.visible = state.steamVisible;
    valveLever.rotation.z = state.valve.crankAngle;
    valveSpool.position.copy(state.valve.spoolPin);
    valvePitman.position.copy(state.valve.crankPin);
    valvePitman.position.z += pitmanPlaneOffset;
    valvePitman.rotation.z = Math.atan2(
      state.valve.spoolPin.y - state.valve.crankPin.y,
      state.valve.spoolPin.x - state.valve.crankPin.x,
    );
    steamMaterial.opacity = 0.22 + 0.38 * THREE.MathUtils.clamp(
      state.gaugePressure / staticSupportGaugePressure,
      0,
      1.35,
    );
  };

  const sourceState = stateAtPhase(0.31);
  const geometry = {
    anvilTopY,
    ballisticDrop,
    ballisticDuration,
    cylinderInnerBottomY,
    cylinderInnerRadius,
    cylinderInnerTopY,
    cylinderOuterRadius,
    cycleDuration,
    gravity,
    hammerHeadBottomCenterY,
    hammerHeadHeight,
    impactKineticEnergyJoule,
    impactImpulseNewtonSecond,
    impactPhase,
    impactSpeed,
    liftDuration,
    liftEndPhase,
    liftStartPhase,
    maximumLift,
    movingMassKilogram,
    pistonArea,
    pistonBottomCenterY,
    pistonRadius,
    pistonThickness,
    releaseDrop,
    releaseDuration,
    releaseEndDownwardSpeed,
    releaseEndPhase,
    staticSupportGaugePressure,
    topHoldEndPhase,
    valveAngleAmplitude,
    valveBaseAngle,
    valveCrankRadius,
    valvePitmanLength,
    valvePivot: valvePivot.clone(),
    valveSliderY,
    valveSpoolHalfTravel,
  };

  root.userData = {
    archetype:
      'single-acting-steam-hammer-with-pressure-raised-rigid-piston-rod-head-gravity-fall-exhaust-valve-and-anvil-impact',
    blocks: {
      admissionPassage,
      anvil,
      anvilFace,
      cylinderRings,
      exhaustStack,
      fixedCylinder,
      foundation,
      hammerFace,
      hammerHead,
      movingAssembly,
      piston,
      pistonRod,
      pressFrame,
      steamChamber,
      supplyPipe,
      valveChest,
      valveLever,
      valvePitman,
      valveSpool,
    },
    degreesOfFreedom: {
      cylinderTranslates: false,
      hammerAndPistonIndependent: false,
      independentPrescribedInputs: 1,
      movingAssemblyDegreesOfFreedom: 1,
      valveScheduledFromSameCycle: true,
    },
    dynamics: {
      condensationLeakageValvePressureDropRodFlexFrameFlexAirResistanceAndImpactDeformationModeled:
        false,
      fallingModel:
        'A quintic exhaust-opening interval reduces supporting gauge pressure from mg/A to zero while exactly integrating the resulting acceleration. It joins an exact constant-g ballistic fall with matching position, velocity and acceleration.',
      impactModel:
        'At exact hammer-face/anvil-face contact the ideal rigid impact removes the computed downward momentum instantaneously. The position is continuous; the velocity discontinuity is the physical contact impulse.',
      liftingModel:
        'The displayed gauge pressure is solved from P*A-m*g=m*a for the C2 lift trajectory, so piston, rod and hammer move as one rigid mass rather than independent animation channels.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Steam admitted only beneath the fixed upper cylinder’s piston raises the rigid piston-rod-hammer assembly. The slide valve then connects that chamber to exhaust; pressure support decays, the assembly enters gravity-only free fall, and the hammer face strikes the fixed anvil. No steam is admitted above the piston.',
    motion: {
      cycleDuration,
      motionType:
        'pressure-build-c2-powered-lift-top-hold-integrated-exhaust-release-exact-ballistic-fall-rigid-anvil-impact-and-bottom-dwell',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      hammerLift: sourceState.hammerLift,
      pistonCenterY: sourceState.pistonCenterY,
      valveCommand: sourceState.valveCommand,
    },
    sourceReference: {
      brownPlate470: {
        approximateCylinderBoundsPixels: [233, 126, 112, 177],
        approximateFrameBoundsPixels: [67, 85, 397, 386],
        approximateHammerBoundsPixels: [221, 269, 91, 144],
        approximateValveGearBoundsPixels: [344, 306, 120, 157],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the steam cylinder is fixed above the hammer',
          'the hammer is attached to the lower end of the piston rod',
          'steam is alternately admitted below the piston and allowed to escape',
          'admission raises the hammer and release lets it fall',
        ],
        engravingEvidence:
          'Brown shows a tall portal frame supporting the upper vertical cylinder, a single straight piston rod ending in a cylindrical hammer head over an anvil, a side steam passage and an external valve lever.',
        reconstructionDisclosure:
          'Brown gives no dimensions, mass, lift, gravity scale, steam pressure, valve law, fall duration, impact compliance or timing. A 160 kg rigid moving assembly, 1.05 m lift, 0.27 m piston radius, terrestrial gravity, force-derived pressure, ideal rigid impact, exact slider linkage, colors and a 5.2-second cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 470',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      contact:
        'hammer face height equals anvil top height at zero lift; computed ballistic flight ends at that same constraint before impact velocity is removed',
      force:
        'below-piston gauge pressure times piston area minus moving weight equals moving mass times vertical acceleration whenever the assembly is off the anvil',
      rigidAssembly:
        'piston center, rod and hammer head share exactly one vertical translation',
      valve:
        'a scheduled rocker drives a horizontal spool through one constant-length pitman; admission opens for lift and exhaust opens before gravity fall',
    },
    update,
    valveKinematics,
  };
  correctHammerWorkingParts(root, 470);
  buildArchedCastStandard(pressFrame, frameMaterial, groundY, {
    cylinderOuterRadius,
    crossbarTopY: cylinderInnerBottomY - 0.08,
  });
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.15, groundY - 0.02, -1.06),
    new THREE.Vector3(2.25, 3.34, 1.06),
  );
  root.userData.cameraDistanceScale = 1.00;
  root.userData.cameraDirection = new THREE.Vector3(.7, 1.0, 15);
  root.userData.groundFloorY = groundY;

  markShadows(root);
  for (const object of [fixedCylinder, steamChamber, valveChest]) {
    object.castShadow = false;
  }
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSteamHammerMovement(movement) {
  if (movement.id !== 470) return null;
  return steamHammer(movement);
}
