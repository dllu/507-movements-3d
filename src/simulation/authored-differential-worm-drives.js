import { makeSolidWorm } from './solid-worm.js';
import { makeSpecialWormWheel } from './special-worm-solids.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeShaft,
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

function annularGeometry({ depth, innerRadius, outerRadius }) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    bevelSegments: 1,
    bevelSize: Math.min(0.018, depth * 0.08),
    bevelThickness: Math.min(0.018, depth * 0.08),
    curveSegments: 72,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makePointer({
  axialPosition,
  color,
  length,
  rootAxialPosition,
  boreRadius,
}) {
  const pointer = new THREE.Group();
  pointer.position.z = axialPosition - rootAxialPosition;
  pointer.userData.axialPosition = axialPosition;
  pointer.userData.role = 'source-style-long-output-pointer';

  const material = matte(color, { metalness: 0.14, roughness: 0.54 });
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, length - 0.24, 0.055),
    material,
  );
  arm.position.y = length / 2 + 0.02;
  arm.userData.role = 'radial-pointer-arm-rigid-with-worm-wheel';

  const collar = new THREE.Mesh(
    annularGeometry({depth: .12, innerRadius: boreRadius, outerRadius: .17}),
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.46 }),
  );
  collar.userData.boreRadius = boreRadius;
  collar.userData.role = 'pointer-output-shaft-collar';

  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    matte(PALETTE.white, { roughness: 0.42 }),
  );
  tip.position.y = length - 0.1;
  tip.userData.role = 'white-output-rate-index';
  pointer.add(arm, collar, tip);
  return { arm, collar, pointer, tip };
}

function makeWormWheel({
  axialCenter,
  color,
  faceWidth,
  helixAngle,
  label,
  pitchRadius,
  pointerAxialPosition,
  pointerLength,
  teeth,
  toothHeight,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.position.x = axialCenter;
  root.quaternion.setFromUnitVectors(Z_AXIS, X_AXIS);
  root.userData.axis = X_AXIS.clone();
  root.userData.axialCenter = axialCenter;
  root.userData.rotor = rotor;
  root.userData.role = `${label}-independent-equal-diameter-worm-wheel`;

  const bodyRadius = pitchRadius - toothHeight / 2;
  const outerRadius = pitchRadius + toothHeight / 2;
  const boreRadius = 0.14;
  const bodyMaterial = matte(color, { metalness: 0.12, roughness: 0.62 });
  const toothMaterial = matte(color, { metalness: 0.16, roughness: 0.56 });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });

  const body = makeSpecialWormWheel(teeth === 100 ? 264100 : 264101, boreRadius, bodyMaterial);
  body.userData.role = `${label}-bored-worm-wheel-body`;
  rotor.add(body);
  const toothPitch = FULL_TURN * pitchRadius / teeth;
  // One closed sector is instanced per tooth; no independently rotated boxes.
  const toothMeshes = Array.from({length: teeth}, (_, index) => ({index, mesh: body, instance: index}));

  const faceRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(bodyRadius * 0.91, 0.027, 8, 96),
      inkMaterial,
    );
    rim.position.z = side * (faceWidth / 2 + 0.012);
    rim.userData.role = `${label}-wheel-face-rim`;
    rotor.add(rim);
    return rim;
  });

  const hub = new THREE.Mesh(
    annularGeometry({
      depth: faceWidth + 0.04,
      innerRadius: teeth === 100 ? .117 : .071,
      outerRadius: 0.31,
    }),
    inkMaterial,
  );
  hub.userData.role = `${label}-independent-bored-hub`;
  rotor.add(hub);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(pitchRadius * 0.52, 0.05, 0.026),
    matte(PALETTE.white, { roughness: 0.44 }),
  );
  faceIndex.position.set(
    pitchRadius * 0.38,
    0,
    faceWidth / 2 + 0.035,
  );
  faceIndex.userData.role = `${label}-white-wheel-rate-index`;
  rotor.add(faceIndex);

  const pointerParts = makePointer({
    axialPosition: pointerAxialPosition,
    color,
    length: pointerLength,
    rootAxialPosition: axialCenter,
    boreRadius: teeth === 100 ? .118 : .071,
  });
  rotor.add(pointerParts.pointer);

  root.userData.boreRadius = boreRadius;
  root.userData.faceWidth = faceWidth;
  root.userData.helixAngle = helixAngle;
  root.userData.outerRadius = outerRadius;
  root.userData.pitchRadius = pitchRadius;
  root.userData.teeth = teeth;
  root.userData.toothHeight = toothHeight;
  root.userData.toothMeshes = toothMeshes;
  root.userData.toothPitch = toothPitch;
  return {
    body,
    faceIndex,
    faceRims,
    hub,
    outerRadius,
    pointer: pointerParts.pointer,
    pointerArm: pointerParts.arm,
    pointerCollar: pointerParts.collar,
    pointerTip: pointerParts.tip,
    root,
    rotor,
    toothMeshes,
    toothPitch,
  };
}

function makeAnnularSleeve({
  depth,
  innerRadius,
  outerRadius,
  role,
  z,
}) {
  const sleeve = new THREE.Mesh(
    annularGeometry({ depth, innerRadius, outerRadius }),
    matte(PALETTE.ink, { metalness: 0.28, roughness: 0.43 }),
  );
  sleeve.position.z = z;
  sleeve.userData.innerRadius = innerRadius;
  sleeve.userData.outerRadius = outerRadius;
  sleeve.userData.role = role;
  return sleeve;
}

function torusAroundX(radius, tube, material) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, 36),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
}

function twinWormWheelDifferential(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.88);

  const wheel100Teeth = 100;
  const wheel101Teeth = 101;
  const wheelPitchRadius = 1.7;
  const wheelToothHeight = 0.07;
  const wheelFaceWidth = 0.3;
  const wheelAxialSeparation = 0.38;
  const wheel100AxialCenter = wheelAxialSeparation / 2;
  const wheel101AxialCenter = -wheelAxialSeparation / 2;
  const wormStarts = 1;
  const wormHandedness = 1;
  const wormPitchRadius = 0.5;
  const wormCoreRadius = wormPitchRadius - 1.25 * (2 * wheelPitchRadius / wheel100Teeth);
  const wormThreadRadius = 0.045;
  const wheel100CircularPitch = FULL_TURN
    * wheelPitchRadius / wheel100Teeth;
  const wheel101CircularPitch = FULL_TURN
    * wheelPitchRadius / wheel101Teeth;
  const wormPitch = wheel100CircularPitch;
  const wormLength = 1.1;
  const wormShaftLength = 1.8;
  const contactVerticalOffset = Math.sqrt(
    wormPitchRadius ** 2 - wheel100AxialCenter ** 2,
  );
  const wormCenter = new THREE.Vector3(
    0,
    wheelPitchRadius + contactVerticalOffset,
    0,
  );
  const wheel100Center = new THREE.Vector3(wheel100AxialCenter, 0, 0);
  const wheel101Center = new THREE.Vector3(wheel101AxialCenter, 0, 0);
  const wheel100ContactPoint = new THREE.Vector3(
    wheel100AxialCenter,
    wheelPitchRadius,
    0,
  );
  const wheel101ContactPoint = new THREE.Vector3(
    wheel101AxialCenter,
    wheelPitchRadius,
    0,
  );
  const helicalToothAngle = THREE.MathUtils.degToRad(13);
  const wheel100PointerLength = 1.55;
  const wheel101PointerLength = 1.72;
  const wheel100PointerAxialPosition = 0.78;
  const wheel101PointerAxialPosition = 1.09;

  const wheel100 = makeWormWheel({
    axialCenter: wheel100AxialCenter,
    color: PALETTE.driven,
    faceWidth: wheelFaceWidth,
    helixAngle: helicalToothAngle,
    label: 'one-hundred-tooth',
    pitchRadius: wheelPitchRadius,
    pointerAxialPosition: wheel100PointerAxialPosition,
    pointerLength: wheel100PointerLength,
    teeth: wheel100Teeth,
    toothHeight: wheelToothHeight,
  });
  const wheel101 = makeWormWheel({
    axialCenter: wheel101AxialCenter,
    color: PALETTE.accent,
    faceWidth: wheelFaceWidth,
    helixAngle: helicalToothAngle,
    label: 'one-hundred-and-one-tooth',
    pitchRadius: wheelPitchRadius,
    pointerAxialPosition: wheel101PointerAxialPosition,
    pointerLength: wheel101PointerLength,
    teeth: wheel101Teeth,
    toothHeight: wheelToothHeight,
  });

  const innerShaft = makeShaft({
    axis: X_AXIS,
    length: 3.8,
    radius: 0.07,
  });
  innerShaft.position.x = 0.18;
  innerShaft.userData.role =
    'inner-output-shaft-rigid-with-101-tooth-wheel';
  const sleeveStart = wheel100AxialCenter - wheelFaceWidth * 0.2;
  const sleeveEnd = wheel100PointerAxialPosition + 0.08;
  const outerSleeve = makeAnnularSleeve({
    depth: sleeveEnd - sleeveStart,
    innerRadius: 0.084,
    outerRadius: 0.116,
    role: 'hollow-output-sleeve-rigid-with-100-tooth-wheel',
    z: (sleeveStart + sleeveEnd) / 2 - wheel100AxialCenter,
  });
  wheel100.rotor.add(outerSleeve);

  const worm = makeSolidWorm({
    axis: Z_AXIS,
    color: PALETTE.driver,
    handedness: wormHandedness,
    length: wormLength,
    pitch: wormPitch,
    radius: wormPitchRadius,
    shaftRadius: .075,
  });
  worm.position.copy(wormCenter);
  worm.userData.role =
    'one-single-start-worm-spanning-both-equal-diameter-wheels';
  const wormIndex = new THREE.Group();
  wormIndex.userData.role = 'white-common-worm-speed-index';
  for (const side of [-1, 1]) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 18, 12),
      matte(PALETTE.white, { roughness: 0.42 }),
    );
    dot.position.set(
      wormPitchRadius * 0.46,
      0,
      side * (wormLength / 2 + 0.055),
    );
    dot.userData.role = side < 0
      ? 'rear-white-common-worm-speed-dot'
      : 'front-white-common-worm-speed-dot';
    wormIndex.add(dot);
  }
  worm.userData.rotor.add(wormIndex);
  const wormShaft = makeShaft({
    axis: Z_AXIS,
    length: wormShaftLength,
    radius: 0.075,
  });
  wormShaft.position.copy(wormCenter);
  wormShaft.userData.role = 'common-uniformly-rotating-input-worm-shaft';

  const contactMaterial = matte(PALETTE.white, { roughness: 0.38 });
  const wheel100ContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    contactMaterial,
  );
  wheel100ContactMarker.position.copy(wheel100ContactPoint);
  wheel100ContactMarker.userData.role =
    'plane-of-centers-contact-common-worm-to-100-tooth-wheel';
  const wheel101ContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    contactMaterial,
  );
  wheel101ContactMarker.position.copy(wheel101ContactPoint);
  wheel101ContactMarker.userData.role =
    'plane-of-centers-contact-common-worm-to-101-tooth-wheel';

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.67,
  });
  const baseY = -2.12;
  const leftBearingX = -2.35;
  const rightBearingX = 2.38;
  const wheelBearings = [leftBearingX, rightBearingX].map((x, index) => {
    const bearing = torusAroundX(0.16, 0.038, frameMaterial);
    bearing.position.set(x, 0, 0);
    bearing.userData.role = index === 0
      ? 'fixed-left-coaxial-output-bearing'
      : 'fixed-right-coaxial-output-bearing';
    return bearing;
  });
  const wheelBearingPosts = wheelBearings.map((bearing, index) => {
    const post = makeBeam(
      new THREE.Vector3(bearing.position.x, baseY, -0.42),
      bearing.position,
      { color: PALETTE.frame, depth: 0.15, thickness: 0.13 },
    );
    post.userData.role = index === 0
      ? 'left-output-bearing-standard'
      : 'right-output-bearing-standard';
    return post;
  });
  const wormBearingZs = [-2.18, 2.18];
  const wormBearings = wormBearingZs.map((z, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.036, 10, 36),
      frameMaterial,
    );
    bearing.position.set(0, wormCenter.y, z);
    bearing.userData.role = index === 0
      ? 'fixed-rear-common-worm-bearing'
      : 'fixed-front-common-worm-bearing';
    return bearing;
  });
  const wormBearingPosts = wormBearings.map((bearing, index) => {
    const foot = new THREE.Vector3(-1.08, baseY, bearing.position.z);
    const shoulder = new THREE.Vector3(-1.08, wormCenter.y, bearing.position.z);
    const post = makeBeam(foot, shoulder, {
      color: PALETTE.frame,
      depth: 0.13,
      thickness: 0.12,
    });
    post.userData.role = index === 0
      ? 'rear-worm-bearing-standard'
      : 'front-worm-bearing-standard';
    const arm = makeBeam(shoulder, bearing.position, {
      color: PALETTE.frame,
      depth: 0.13,
      thickness: 0.12,
    });
    arm.userData.role = index === 0
      ? 'rear-worm-bearing-arm'
      : 'front-worm-bearing-arm';
    return [post, arm];
  }).flat();
  const baseRail = makeBeam(
    new THREE.Vector3(-2.75, baseY, -2.45),
    new THREE.Vector3(2.75, baseY, 2.45),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.16 },
  );
  baseRail.userData.role = 'fixed-diagonal-study-base';

  root.add(
    wheel100.root,
    wheel101.root,
    innerShaft,
    worm,
    wormShaft,
    wheel100ContactMarker,
    wheel101ContactMarker,
    ...wheelBearings,
    ...wheelBearingPosts,
    ...wormBearings,
    ...wormBearingPosts,
    baseRail,
  );

  const wheel100RevolutionPeriod = 240;
  const wormAngularSpeed = FULL_TURN
    * wheel100Teeth / wheel100RevolutionPeriod;
  const wheel100AngularSpeed = -wormHandedness
    * wormStarts * wormAngularSpeed / wheel100Teeth;
  const wheel101AngularSpeed = -wormHandedness
    * wormStarts * wormAngularSpeed / wheel101Teeth;
  const fullBeatWormRevolutions = wheel100Teeth * wheel101Teeth;
  const fullBeatPeriod = fullBeatWormRevolutions
    * FULL_TURN / wormAngularSpeed;
  const fastWheelGainAngularSpeed = wormHandedness * wormStarts
    * wormAngularSpeed / fullBeatWormRevolutions;
  const wormPhase = 0;
  const wheel100Phase = 0;
  const wheel101Phase = 0;

  const stateAtWormTurns = (wormTurns) => {
    const wormTravelAngle = wormTurns * FULL_TURN;
    const wheel100TravelAngle = -wormHandedness
      * wormStarts * wormTravelAngle / wheel100Teeth;
    const wheel101TravelAngle = -wormHandedness
      * wormStarts * wormTravelAngle / wheel101Teeth;
    const wheel100UnwrappedAngle = wheel100Phase + wheel100TravelAngle;
    const wheel101UnwrappedAngle = wheel101Phase + wheel101TravelAngle;
    const fastWheelGainAngle = wormHandedness * wormStarts
      * wormTravelAngle / fullBeatWormRevolutions;
    return {
      fastWheelGainAngle,
      fastWheelGainRevolutions: fastWheelGainAngle / FULL_TURN,
      meshPhaseError100: wormHandedness * wormStarts * wormTravelAngle
        + wheel100Teeth * wheel100TravelAngle,
      meshPhaseError101: wormHandedness * wormStarts * wormTravelAngle
        + wheel101Teeth * wheel101TravelAngle,
      teethPassedAtWheel100Contact: wormStarts * wormTurns,
      teethPassedAtWheel101Contact: wormStarts * wormTurns,
      wheel100Angle: wrappedAngle(wheel100UnwrappedAngle),
      wheel100Revolutions: wheel100TravelAngle / FULL_TURN,
      wheel100ToothPassRate: -wheel100AngularSpeed
        * wheel100Teeth / FULL_TURN,
      wheel100UnwrappedAngle,
      wheel101Angle: wrappedAngle(wheel101UnwrappedAngle),
      wheel101Revolutions: wheel101TravelAngle / FULL_TURN,
      wheel101ToothPassRate: -wheel101AngularSpeed
        * wheel101Teeth / FULL_TURN,
      wheel101UnwrappedAngle,
      wormAngle: wrappedAngle(wormPhase + wormTravelAngle),
      wormRevolutionRate: wormAngularSpeed / FULL_TURN,
      wormTravelAngle,
      wormTurns,
    };
  };
  const stateAtTime = (time) => ({
    ...stateAtWormTurns(wormAngularSpeed * time / FULL_TURN),
    fastWheelGainAngularSpeed,
    time,
    wheel100AngularSpeed,
    wheel101AngularSpeed,
    wormAngularSpeed,
  });

  const wheelOuterRadius = wheelPitchRadius + wheelToothHeight / 2;
  const wormCoreToWheelTipClearance = wormCenter.y
    - wormCoreRadius - wheelOuterRadius;
  const sourceRasterWheelRadius = (477 - 118) / 2;

  root.userData.archetype =
    'single-start-common-worm-driving-equal-diameter-100-and-101-tooth-differential-wheels';
  root.userData.mechanism =
    'one-single-start-common-worm-advances-one-tooth-on-each-of-two-independent-equal-diameter-worm-wheels-so-the-100-tooth-wheel-gains-one-revolution-in-10100-worm-turns';
  root.userData.blocks = {
    baseRail,
    innerShaft,
    outerSleeve,
    wheel100: wheel100.root,
    wheel100ContactMarker,
    wheel100Pointer: wheel100.pointer,
    wheel100PointerTip: wheel100.pointerTip,
    wheel100Teeth: wheel100.toothMeshes,
    wheel101: wheel101.root,
    wheel101ContactMarker,
    wheel101Pointer: wheel101.pointer,
    wheel101PointerTip: wheel101.pointerTip,
    wheel101Teeth: wheel101.toothMeshes,
    wheelBearingPosts,
    wheelBearings,
    worm,
    wormBearingPosts,
    wormBearings,
    wormIndex,
    wormShaft,
  };
  root.userData.canonicalTimes = {
    oneHundredToothWheelRevolution: wheel100RevolutionPeriod,
    oneWormTurn: FULL_TURN / wormAngularSpeed,
    sourcePose: 0,
    wheelDifferentialBeatClosure: fullBeatPeriod,
  };
  root.userData.contactDefinition = {
    commonWormToWheel100: {
      contactPoint: wheel100ContactPoint,
      toothIndexingLaw:
        'worm-starts*worm-travel+wheel-teeth*wheel-travel=0',
    },
    commonWormToWheel101: {
      contactPoint: wheel101ContactPoint,
      toothIndexingLaw:
        'worm-starts*worm-travel+wheel-teeth*wheel-travel=0',
    },
    equalDiameterPitchAccommodation:
      'the 101-tooth wheel has a circular pitch 100/101 of the 100-tooth wheel, as required by the source equal-diameter construction',
  };
  root.userData.driveSchedule = {
    input: 'uniform-positive-rotation-of-the-single-common-worm',
    referenceDisplayCycle:
      'one-revolution-of-the-100-tooth-wheel-with-continuous-unreset-time',
    sourcePrescribesAbsoluteSpeed: false,
    sourcePrescribesDirection: false,
  };
  root.userData.geometry = {
    axesOrthogonality: X_AXIS.dot(Z_AXIS),
    commonWheelAxis: X_AXIS.clone(),
    contactVerticalOffset,
    helicalToothAngle,
    innerShaftRadius: 0.07,
    outerSleeveInnerRadius: outerSleeve.userData.innerRadius,
    outerSleeveOuterRadius: outerSleeve.userData.outerRadius,
    wheel100AxialCenter,
    wheel100Center,
    wheel100CircularPitch,
    wheel100ContactPoint,
    wheel100PointerAxialPosition,
    wheel100PointerLength,
    wheel100Teeth,
    wheel101AxialCenter,
    wheel101Center,
    wheel101CircularPitch,
    wheel101ContactPoint,
    wheel101PointerAxialPosition,
    wheel101PointerLength,
    wheel101Teeth,
    wheelAxialSeparation,
    wheelFaceWidth,
    wheelOuterRadius,
    wheelPitchRadius,
    wheelToothHeight,
    wormAxis: Z_AXIS.clone(),
    wormCenter,
    wormCoreRadius,
    wormCoreToWheelTipClearance,
    wormHandedness,
    wormLength,
    wormPitch,
    wormPitchRadius,
    wormShaftLength,
    wormStarts,
    wormThreadRadius,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement 264 page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate264: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one end-on common worm above two side-by-side equal-diameter worm-wheel rims with separate long output pointers',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterCommonAxisY: 296,
      rasterPointerRoots: [
        { x: 342, y: 296 },
        { x: 374, y: 296 },
      ],
      rasterPointerTips: [
        { x: 342, y: 132 },
        { x: 374, y: 111 },
      ],
      rasterShaftEndpointsX: [47, 407],
      rasterWheelOuterRadius: sourceRasterWheelRadius,
      rasterWheelRimCenterXs: [244, 284],
      rasterWormBoreRadius: 25,
      rasterWormCenter: { x: 270, y: 85 },
      rasterWormOuterRadius: 54,
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
  root.userData.stateAtWormTurns = stateAtWormTurns;
  root.userData.timeline = {
    demonstrationPeriod: wheel100RevolutionPeriod,
    fullBeatPeriod,
    fullBeatWormRevolutions,
    oneWormTurn: FULL_TURN / wormAngularSpeed,
  };
  root.userData.transmission = {
    fastWheelGainPerWormTurn: 1 / fullBeatWormRevolutions,
    fullBeatWormRevolutions,
    toothPassesPerWormRevolution: wormStarts,
    wheel100Ratio: -wormHandedness * wormStarts / wheel100Teeth,
    wheel101Ratio: -wormHandedness * wormStarts / wheel101Teeth,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(worm, state.wormAngle);
    setSpin(wormShaft, state.wormAngle);
    setSpin(wheel100.root, state.wheel100Angle);
    setSpin(wheel101.root, state.wheel101Angle);
    setSpin(innerShaft, state.wheel101Angle);
    worm.userData.angularSpeed = state.wormAngularSpeed;
    wheel100.root.userData.angularSpeed = state.wheel100AngularSpeed;
    wheel101.root.userData.angularSpeed = state.wheel101AngularSpeed;
    root.userData.contacts = {
      commonWormToWheel100: {
        meshPhaseError: state.meshPhaseError100,
        point: wheel100ContactPoint,
        teethPassed: state.teethPassedAtWheel100Contact,
      },
      commonWormToWheel101: {
        meshPhaseError: state.meshPhaseError101,
        point: wheel101ContactPoint,
        teethPassed: state.teethPassedAtWheel101Contact,
      },
    };
    root.userData.kinematics = state;
  };
  for (const object of [baseRail, ...wheelBearingPosts, ...wheelBearings, ...wormBearingPosts, ...wormBearings, wheel100ContactMarker, wheel101ContactMarker]) object.removeFromParent();
  root.traverse(o => {for (const material of (Array.isArray(o.material) ? o.material : [o.material])) if (material) material.fog = false;});
  root.userData.hideGround = true;
  root.userData.materialsIgnoreSceneFog = true;
  root.userData.minimumDisplayCycleSeconds = 240;
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-1.9, -1.76, -.92), new THREE.Vector3(2.2, 2.72, .92));
  root.userData.reconstructionNote = 'One worm turn advances each wheel one tooth. The 100/101 pointers separate by one turn after 10,100 input turns (6 h 44 min at this speed). Equal outside diameters use separately generated flanks, not equal operating pitches.';
  root.userData.contactQualification = {method: 'independent offline envelopes of the same finite common worm', clearance: .0025, nominalPitchRadiiAreReferenceOnly: true};
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(3.2, 1.4, 12),
  };
}

export function createAuthoredDifferentialWormDriveMovement(movement) {
  if (movement.id !== 264) return null;
  const result = twinWormWheelDifferential(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
