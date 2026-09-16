import { correctDifferentialThreads } from './differential-thread-solids.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function wrappedAngle(angle) {
  const turns = angle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-11) return 0;
  return THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
}

function smootherStep(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * clamped ** 2 * (1 - clamped) ** 2;
}

function smootherStepSecondDerivative(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * clamped * (1 - clamped) * (1 - 2 * clamped);
}

function axialRotor(axis) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  root.userData.axis = axis.clone().normalize();
  root.userData.rotor = rotor;
  root.add(rotor);
  return { root, rotor };
}

function cylinderAlongLocalZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

class LocalZHelixCurve extends THREE.Curve {
  constructor({ handedness, pitch, radius, zEnd, zStart }) {
    super();
    this.handedness = handedness;
    this.pitch = pitch;
    this.radius = radius;
    this.zEnd = zEnd;
    this.zStart = zStart;
  }

  getPoint(progress, target = new THREE.Vector3()) {
    const z = THREE.MathUtils.lerp(this.zStart, this.zEnd, progress);
    const angle = this.handedness * FULL_TURN
      * (z - this.zStart) / this.pitch;
    return target.set(
      this.radius * Math.cos(angle),
      this.radius * Math.sin(angle),
      z,
    );
  }
}

function makeThread({
  handedness,
  material,
  pitch,
  radius,
  role,
  tubeRadius,
  zEnd,
  zStart,
}) {
  const curve = new LocalZHelixCurve({
    handedness,
    pitch,
    radius,
    zEnd,
    zStart,
  });
  const turns = (zEnd - zStart) / pitch;
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.ceil(turns * 52),
      tubeRadius,
      9,
      false,
    ),
    material,
  );
  mesh.userData.handedness = handedness;
  mesh.userData.pitch = pitch;
  mesh.userData.role = role;
  mesh.userData.screwThread = true;
  mesh.userData.turns = turns;
  mesh.userData.zEnd = zEnd;
  mesh.userData.zStart = zStart;
  return { curve, mesh, turns };
}

function rectangularAnnularGeometry({
  boreRadius,
  depth,
  height,
  width,
}) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelOffset: -0.025,
    bevelThickness: 0.025,
    curveSegments: 48,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function torusAroundX(radius, tube, material, x) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 9, 38),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  torus.position.x = x;
  return torus;
}

function makeBearingBlock({ color, depth, fixed, role }) {
  const group = new THREE.Group();
  group.userData.axiallyFixed = fixed;
  group.userData.nonrotating = true;
  group.userData.role = role;
  const material = matte(color, {
    metalness: 0.12,
    roughness: 0.65,
  });
  const body = new THREE.Mesh(
    rectangularAnnularGeometry({
      boreRadius: 0.225,
      depth,
      height: 1.02,
      width: 0.7,
    }),
    material,
  );
  body.rotation.y = Math.PI / 2;
  body.userData.role = fixed
    ? 'fixed-bearing-body-with-threaded-through-bore'
    : 'movable-bearing-body-with-threaded-through-bore';
  group.add(body);
  const collars = [-1, 1].map((side) => {
    const collar = torusAroundX(
      0.205,
      0.025,
      matte(PALETTE.ink, { metalness: 0.24, roughness: 0.46 }),
      side * (depth / 2 + 0.016),
    );
    collar.userData.role = fixed
      ? 'fixed-bearing-internal-thread-mouth'
      : 'movable-bearing-internal-thread-mouth';
    group.add(collar);
    return collar;
  });
  return { body, collars, group };
}

function twoPitchDifferentialScrew(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.9);

  const fixedThreadPitch = 0.3;
  const movingThreadPitch = 0.24;
  const pitchDifference = fixedThreadPitch - movingThreadPitch;
  const threadHandedness = 1;
  const threadRadius = 0.17;
  const threadTubeRadius = 0.035;
  const shaftCoreRadius = 0.102;
  const fixedThreadStart = -2.5;
  const fixedThreadEnd = -0.35;
  const movingThreadStart = 0.4;
  const movingThreadEnd = 2.15;
  const shaftCoreStart = -2.88;
  const shaftCoreEnd = 2.34;
  const fixedBearingX = -1.45;
  const movingBearingInitialX = 1.45;
  const fixedBearingDepth = 0.34;
  const movingBearingDepth = 0.36;
  const inputMaximumTurns = 3;
  const inputMaximumAngle = inputMaximumTurns * FULL_TURN;
  const demonstrationPeriod = 12;
  const halfPeriod = demonstrationPeriod / 2;
  const maximumShaftTranslation = fixedThreadPitch * inputMaximumTurns;
  const maximumBearingTravel = pitchDifference * inputMaximumTurns;
  const baseY = -1.18;

  const shaftMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.55,
  });
  const threadMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.67,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const shaftAssembly = axialRotor(X_AXIS);
  const shaft = shaftAssembly.root;
  const shaftRotor = shaftAssembly.rotor;
  shaft.userData.role =
    'one-translating-rotating-shaft-carrying-two-same-hand-different-pitch-threads';
  const shaftCore = cylinderAlongLocalZ(
    shaftCoreRadius,
    shaftCoreEnd - shaftCoreStart,
    shaftMaterial,
  );
  shaftCore.position.z = (shaftCoreStart + shaftCoreEnd) / 2;
  shaftCore.userData.role = 'continuous-core-through-both-threaded-regions';
  shaftRotor.add(shaftCore);

  const fixedThread = makeThread({
    handedness: threadHandedness,
    material: threadMaterial,
    pitch: fixedThreadPitch,
    radius: threadRadius,
    role: 'coarser-same-hand-thread-working-through-fixed-bearing',
    tubeRadius: threadTubeRadius,
    zEnd: fixedThreadEnd,
    zStart: fixedThreadStart,
  });
  const movingThread = makeThread({
    handedness: threadHandedness,
    material: threadMaterial,
    pitch: movingThreadPitch,
    radius: threadRadius,
    role: 'finer-same-hand-thread-working-through-movable-bearing',
    tubeRadius: threadTubeRadius,
    zEnd: movingThreadEnd,
    zStart: movingThreadStart,
  });
  shaftRotor.add(fixedThread.mesh, movingThread.mesh);

  const handleBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.86, 28),
    shaftMaterial,
  );
  handleBar.position.z = -2.72;
  handleBar.userData.role = 'rigid-transverse-input-t-handle';
  const handleHub = cylinderAlongLocalZ(0.16, 0.16, threadMaterial, 30);
  handleHub.position.z = -2.72;
  handleHub.userData.role = 'input-handle-hub-rigid-with-screw-shaft';
  const handleIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 18, 12),
    whiteMaterial,
  );
  handleIndex.position.set(0, 0.39, -2.72);
  handleIndex.userData.role = 'white-input-handle-rotation-index';
  shaftRotor.add(handleBar, handleHub, handleIndex);

  const fixedBearingParts = makeBearingBlock({
    color: PALETTE.frame,
    depth: fixedBearingDepth,
    fixed: true,
    role: 'base-fixed-nonrotating-threaded-bearing',
  });
  const fixedBearing = fixedBearingParts.group;
  fixedBearing.position.x = fixedBearingX;
  const fixedSupport = makeBeam(
    new THREE.Vector3(fixedBearingX, baseY, -0.48),
    new THREE.Vector3(fixedBearingX, -0.34, 0),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
  );
  fixedSupport.userData.role = 'fixed-bearing-standard-rigid-with-base';

  const movingBearingParts = makeBearingBlock({
    color: PALETTE.driven,
    depth: movingBearingDepth,
    fixed: false,
    role: 'nonrotating-bearing-free-to-move-to-and-fro',
  });
  const movingBearing = movingBearingParts.group;
  movingBearing.position.x = movingBearingInitialX;
  const movingFoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.14, 1.04),
    matte(PALETTE.driven, { metalness: 0.12, roughness: 0.65 }),
  );
  movingFoot.position.y = baseY + 0.11;
  movingFoot.userData.role = 'movable-bearing-foot-sliding-on-base-guides';
  const movingStandard = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.58, 0.34),
    matte(PALETTE.driven, { metalness: 0.12, roughness: 0.65 }),
  );
  movingStandard.position.y = -0.76;
  movingStandard.userData.role =
    'movable-bearing-standard-rigidly-joining-bearing-to-sliding-foot';
  movingBearing.add(movingFoot, movingStandard);
  const movingIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    whiteMaterial,
  );
  movingIndex.position.set(0, 0.62, 0.38);
  movingIndex.userData.role = 'white-index-showing-differential-bearing-travel';
  movingBearing.add(movingIndex);

  const fixedContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    whiteMaterial,
  );
  fixedContactMarker.position.set(fixedBearingX, threadRadius, 0);
  fixedContactMarker.userData.role = 'fixed-thread-phase-contact-marker';
  const movingContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    whiteMaterial,
  );
  movingContactMarker.position.set(0, threadRadius, 0);
  movingContactMarker.userData.role = 'moving-thread-phase-contact-marker';
  movingBearing.add(movingContactMarker);

  const baseRails = [-0.48, 0.48].map((z, index) => {
    const rail = makeBeam(
      new THREE.Vector3(-2.35, baseY, z),
      new THREE.Vector3(3.05, baseY, z),
      { color: PALETTE.frame, depth: 0.16, thickness: 0.12 },
    );
    rail.userData.role = index === 0
      ? 'rear-fixed-linear-bearing-guide'
      : 'front-fixed-linear-bearing-guide';
    return rail;
  });
  const baseCrossbars = [-2.25, 2.92].map((x, index) => {
    const crossbar = makeBeam(
      new THREE.Vector3(x, baseY, -0.62),
      new THREE.Vector3(x, baseY, 0.62),
      { color: PALETTE.frame, depth: 0.2, thickness: 0.14 },
    );
    crossbar.userData.role = index === 0
      ? 'left-base-crossbar'
      : 'right-base-crossbar';
    return crossbar;
  });

  root.add(
    shaft,
    fixedBearing,
    fixedSupport,
    movingBearing,
    fixedContactMarker,
    ...baseRails,
    ...baseCrossbars,
  );

  const inputStateAtTime = (time) => {
    const phase = THREE.MathUtils.euclideanModulo(time, demonstrationPeriod);
    const forward = phase <= halfPeriod;
    const localProgress = forward
      ? phase / halfPeriod
      : (phase - halfPeriod) / halfPeriod;
    const easedProgress = smootherStep(localProgress);
    const easedRate = smootherStepDerivative(localProgress) / halfPeriod;
    const easedAcceleration = smootherStepSecondDerivative(localProgress)
      / halfPeriod ** 2;
    if (forward) {
      return {
        inputAngle: inputMaximumAngle * easedProgress,
        inputAngularAcceleration: inputMaximumAngle * easedAcceleration,
        inputAngularSpeed: inputMaximumAngle * easedRate,
        phase,
        stage: 'forward-differential-feed',
      };
    }
    return {
      inputAngle: inputMaximumAngle * (1 - easedProgress),
      inputAngularAcceleration: -inputMaximumAngle * easedAcceleration,
      inputAngularSpeed: -inputMaximumAngle * easedRate,
      phase,
      stage: 'reverse-differential-return',
    };
  };

  const configurationAtInputAngle = (
    inputAngle,
    inputAngularSpeed = 0,
    inputAngularAcceleration = 0,
  ) => {
    const inputTurns = inputAngle / FULL_TURN;
    const shaftTranslation = fixedThreadPitch * inputTurns;
    const shaftAxialVelocity = fixedThreadPitch
      * inputAngularSpeed / FULL_TURN;
    const shaftAxialAcceleration = fixedThreadPitch
      * inputAngularAcceleration / FULL_TURN;
    const bearingTravel = pitchDifference * inputTurns;
    const bearingAxialVelocity = pitchDifference
      * inputAngularSpeed / FULL_TURN;
    const bearingAxialAcceleration = pitchDifference
      * inputAngularAcceleration / FULL_TURN;
    const movingBearingX = movingBearingInitialX + bearingTravel;
    const fixedLocalThreadPosition = fixedBearingX - shaftTranslation;
    const movingLocalThreadPosition = movingBearingX - shaftTranslation;
    const fixedThreadMaterialPhase = threadHandedness * FULL_TURN
      * (fixedLocalThreadPosition - fixedThreadStart) / fixedThreadPitch
      + inputAngle;
    const movingThreadMaterialPhase = threadHandedness * FULL_TURN
      * (movingLocalThreadPosition - movingThreadStart) / movingThreadPitch
      + inputAngle;
    const fixedReferencePhase = threadHandedness * FULL_TURN
      * (fixedBearingX - fixedThreadStart) / fixedThreadPitch;
    const movingReferencePhase = threadHandedness * FULL_TURN
      * (movingBearingInitialX - movingThreadStart) / movingThreadPitch;
    return {
      bearingAxialAcceleration,
      bearingAxialVelocity,
      bearingTravel,
      fixedBearingX,
      fixedLocalThreadPosition,
      fixedThreadEngagementLeft: fixedLocalThreadPosition - fixedThreadStart,
      fixedThreadEngagementRight: fixedThreadEnd - fixedLocalThreadPosition,
      fixedThreadMaterialPhase,
      fixedThreadPhaseError: fixedThreadMaterialPhase - fixedReferencePhase,
      inputAngle: wrappedAngle(inputAngle),
      inputAngleUnwrapped: inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed,
      inputTurns,
      movingBearingX,
      movingLocalThreadPosition,
      movingThreadEngagementLeft:
        movingLocalThreadPosition - movingThreadStart,
      movingThreadEngagementRight:
        movingThreadEnd - movingLocalThreadPosition,
      movingThreadMaterialPhase,
      movingThreadPhaseError: movingThreadMaterialPhase - movingReferencePhase,
      shaftAxialAcceleration,
      shaftAxialVelocity,
      shaftTranslation,
    };
  };

  const stateAtTime = (time) => {
    const input = inputStateAtTime(time);
    return {
      ...configurationAtInputAngle(
        input.inputAngle,
        input.inputAngularSpeed,
        input.inputAngularAcceleration,
      ),
      stage: input.stage,
      time,
      timelinePhase: input.phase,
    };
  };

  root.userData.archetype =
    'same-hand-two-pitch-translating-shaft-fixed-nut-differential-moving-bearing';
  root.userData.mechanism =
    'one-shaft-carries-coarse-and-fine-same-hand-threads-the-coarse-thread-translates-the-shaft-through-a-fixed-bearing-and-the-fine-thread-subtracts-relative-motion-so-the-free-bearing-travels-by-the-pitch-difference';
  root.userData.blocks = {
    baseCrossbars,
    baseRails,
    fixedBearing,
    fixedBearingBody: fixedBearingParts.body,
    fixedBearingCollars: fixedBearingParts.collars,
    fixedContactMarker,
    fixedSupport,
    fixedThread: fixedThread.mesh,
    handleBar,
    handleHub,
    handleIndex,
    movingBearing,
    movingBearingBody: movingBearingParts.body,
    movingBearingCollars: movingBearingParts.collars,
    movingContactMarker,
    movingFoot,
    movingIndex,
    movingStandard,
    movingThread: movingThread.mesh,
    shaft,
    shaftCore,
    shaftRotor,
  };
  root.userData.canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    maximumForwardTravel: halfPeriod,
    midForward: halfPeriod / 2,
    midReverse: halfPeriod * 3 / 2,
    sourcePose: 0,
  };
  root.userData.contactDefinition = {
    fixedThreadLaw:
      'shaft-translation=fixed-thread-pitch*input-angle/(2*pi)',
    movingThreadLaw:
      'moving-bearing-position-shaft-position=initial-relative-position-moving-thread-pitch*input-angle/(2*pi)',
    threadHandedness: 'same-hand-right-hand',
  };
  root.userData.driveSchedule = {
    input:
      'smooth-three-turn-forward-excursion-followed-by-three-turn-reverse-return',
    purpose:
      'the finite engraved thread lengths stay engaged and the differential bearing returns without teleporting',
    sourcePrescribesReversal: false,
  };
  root.userData.geometry = {
    fixedBearingDepth,
    fixedBearingX,
    fixedThreadEnd,
    fixedThreadPitch,
    fixedThreadStart,
    inputMaximumAngle,
    inputMaximumTurns,
    maximumBearingTravel,
    maximumShaftTranslation,
    movingBearingDepth,
    movingBearingInitialX,
    movingThreadEnd,
    movingThreadPitch,
    movingThreadStart,
    pitchDifference,
    shaftAxis: X_AXIS.clone(),
    shaftCoreEnd,
    shaftCoreRadius,
    shaftCoreStart,
    threadHandedness,
    threadRadius,
    threadTubeRadius,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement 266 page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate266: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one handled translating shaft with two separated same-hand thread regions, one base-fixed threaded bearing, and one footed nonrotating bearing free to slide on the base',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterBaseBounds: {
        bottom: 344,
        left: 51,
        right: 505,
        top: 313,
      },
      rasterFixedBearingCenterX: 149,
      rasterFixedThreadBounds: { left: 94, right: 211 },
      rasterFixedThreadPitch: 13,
      rasterMovingBearingCenterX: 374,
      rasterMovingFootBounds: {
        bottom: 314,
        left: 318,
        right: 440,
        top: 296,
      },
      rasterMovingThreadBounds: { left: 332, right: 431 },
      rasterMovingThreadPitch: 10.4,
      rasterShaftAxisY: 237,
      rasterSmoothShaftBounds: { left: 211, right: 332 },
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 67,
      edition: 21,
      illustrationPage: 66,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    forwardEnd: halfPeriod,
    reverseReturnEnd: demonstrationPeriod,
  };
  root.userData.transmission = {
    bearingTravelForInputAngle: (inputAngle) => (
      pitchDifference * inputAngle / FULL_TURN
    ),
    bearingTravelForPitches: (
      inputAngle,
      fixedPitch = fixedThreadPitch,
      movingPitch = movingThreadPitch,
    ) => ((fixedPitch - movingPitch) * inputAngle / FULL_TURN),
    bearingTravelPerRevolution: pitchDifference,
    configurationAtInputAngle,
    differentialLaw:
      'bearing-travel=(fixed-thread-pitch-moving-thread-pitch)*input-revolutions',
    equalPitchesProduceZeroTravel: true,
    shaftTravelPerRevolution: fixedThreadPitch,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    shaft.position.x = state.shaftTranslation;
    setSpin(shaft, state.inputAngle);
    movingBearing.position.x = state.movingBearingX;
    fixedContactMarker.position.x = fixedBearingX;
    shaft.userData.angularSpeed = state.inputAngularSpeed;
    shaft.userData.axialVelocity = state.shaftAxialVelocity;
    movingBearing.userData.axialVelocity = state.bearingAxialVelocity;
    root.userData.contacts = {
      coarseThreadThroughFixedBearing: {
        materialPhaseError: state.fixedThreadPhaseError,
        nutX: fixedBearingX,
      },
      fineThreadThroughMovingBearing: {
        materialPhaseError: state.movingThreadPhaseError,
        nutX: state.movingBearingX,
      },
    };
    root.userData.kinematics = state;
  };
  correctDifferentialThreads(root, 266);
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(-2.2, 3.8, 11.5),
  };
}

export function createAuthoredDifferentialScrewMovement(movement) {
  if (movement.id !== 266) return null;
  const result = twoPitchDifferentialScrew(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
