import { correctEpicyclic503504 } from './epicyclic-503-504-contact.js';
import { correctCompoundEpicyclic } from './compound-epicyclic-corrections.js';
import { correctEpicyclicFamily } from './epicyclic-family-corrections.js';
import * as THREE from 'three';
import { bevelBodyGeometry } from './bevel-geometry.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { crankArmOutline, HANDLE_FOOT_EMBED, handleShank, standardTurnedHandleGeometry } from './turned-handle.js';
import {
  circle,
  plate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  makeBevelGear,
  makeGear,
  makeInvoluteInternalGear,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function angularPointVelocity(centerVelocity, angularSpeed, offset) {
  return centerVelocity.clone().add(new THREE.Vector3(
    -angularSpeed * offset.y,
    angularSpeed * offset.x,
    0,
  ));
}

function axialPointVelocity(centerVelocity, axis, angularSpeed, offset) {
  return centerVelocity.clone().add(
    new THREE.Vector3().crossVectors(
      axis.clone().multiplyScalar(angularSpeed),
      offset,
    ),
  );
}

function makeSourceLetter(letter, material) {
  const group = addRole(new THREE.Group(), `source-label-${letter}`);
  group.userData.label = letter;
  const glyph = letter;
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.43, 0.028),
    matte(PALETTE.white, { roughness: 0.78 }),
  );
  plaque.position.z = -0.028;
  const points = {
    A: [
      [[-0.12, -0.16], [0, 0.17]],
      [[0, 0.17], [0.12, -0.16]],
      [[-0.072, -0.025], [0.072, -0.025]],
    ],
    B: [
      [[-0.10, -0.17], [-0.10, 0.17]],
      [[-0.10, 0.17], [0.07, 0.13]],
      [[0.07, 0.13], [0.08, 0.02]],
      [[0.08, 0.02], [-0.10, 0]],
      [[-0.10, 0], [0.08, -0.03]],
      [[0.08, -0.03], [0.07, -0.14]],
      [[0.07, -0.14], [-0.10, -0.17]],
    ],
    C: [
      [[0.11, 0.13], [0, 0.17]],
      [[0, 0.17], [-0.11, 0.08]],
      [[-0.11, 0.08], [-0.11, -0.08]],
      [[-0.11, -0.08], [0, -0.17]],
      [[0, -0.17], [0.11, -0.13]],
    ],
    D: [
      [[-0.10, -0.17], [-0.10, 0.17]],
      [[-0.10, 0.17], [0.05, 0.13]],
      [[0.05, 0.13], [0.11, 0]],
      [[0.11, 0], [0.05, -0.13]],
      [[0.05, -0.13], [-0.10, -0.17]],
    ],
    E: [
      [[-0.10, -0.17], [-0.10, 0.17]],
      [[-0.10, 0.17], [0.11, 0.17]],
      [[-0.10, 0], [0.07, 0]],
      [[-0.10, -0.17], [0.11, -0.17]],
    ],
    F: [
      [[-0.10, -0.17], [-0.10, 0.17]],
      [[-0.10, 0.17], [0.11, 0.17]],
      [[-0.10, 0], [0.07, 0]],
    ],
    G: [
      [[0.11, 0.12], [0, 0.17]],
      [[0, 0.17], [-0.11, 0.08]],
      [[-0.11, 0.08], [-0.11, -0.08]],
      [[-0.11, -0.08], [0, -0.17]],
      [[0, -0.17], [0.11, -0.12]],
      [[0.11, -0.12], [0.11, -0.01]],
      [[0.11, -0.01], [0.015, -0.01]],
    ],
    H: [
      [[-0.11, -0.17], [-0.11, 0.17]],
      [[0.11, -0.17], [0.11, 0.17]],
      [[-0.11, 0], [0.11, 0]],
    ],
    K: [
      [[-0.11, -0.17], [-0.11, 0.17]],
      [[-0.11, 0], [0.11, 0.17]],
      [[-0.11, 0], [0.11, -0.17]],
    ],
    L: [
      [[-0.10, 0.17], [-0.10, -0.17]],
      [[-0.10, -0.17], [0.11, -0.17]],
    ],
    M: [
      [[-0.12, -0.17], [-0.12, 0.17]],
      [[-0.12, 0.17], [0, 0.01]],
      [[0, 0.01], [0.12, 0.17]],
      [[0.12, 0.17], [0.12, -0.17]],
    ],
    N: [
      [[-0.11, -0.17], [-0.11, 0.17]],
      [[-0.11, 0.17], [0.11, -0.17]],
      [[0.11, -0.17], [0.11, 0.17]],
    ],
    a: [
      [[0.09, -0.12], [0.09, 0.10]],
      [[0.09, 0.08], [-0.02, 0.11]],
      [[-0.02, 0.11], [-0.11, 0.04]],
      [[-0.11, 0.04], [-0.10, -0.08]],
      [[-0.10, -0.08], [-0.01, -0.13]],
      [[-0.01, -0.13], [0.09, -0.07]],
    ],
    b: [
      [[-0.10, -0.15], [-0.10, 0.17]],
      [[-0.10, 0.06], [-0.01, 0.11]],
      [[-0.01, 0.11], [0.10, 0.05]],
      [[0.10, 0.05], [0.10, -0.07]],
      [[0.10, -0.07], [0, -0.13]],
      [[0, -0.13], [-0.10, -0.08]],
    ],
    c: [
      [[0.10, 0.07], [0.01, 0.11]],
      [[0.01, 0.11], [-0.10, 0.04]],
      [[-0.10, 0.04], [-0.09, -0.08]],
      [[-0.09, -0.08], [0.01, -0.13]],
      [[0.01, -0.13], [0.10, -0.09]],
    ],
    d: [
      [[0.10, -0.15], [0.10, 0.17]],
      [[0.10, 0.06], [0.01, 0.11]],
      [[0.01, 0.11], [-0.10, 0.04]],
      [[-0.10, 0.04], [-0.10, -0.08]],
      [[-0.10, -0.08], [0, -0.13]],
      [[0, -0.13], [0.10, -0.08]],
    ],
    e: [
      [[-0.10, -0.01], [0.10, -0.01]],
      [[0.10, -0.01], [0.07, 0.08]],
      [[0.07, 0.08], [-0.02, 0.11]],
      [[-0.02, 0.11], [-0.10, 0.04]],
      [[-0.10, 0.04], [-0.08, -0.08]],
      [[-0.08, -0.08], [0.02, -0.13]],
      [[0.02, -0.13], [0.10, -0.09]],
    ],
    f: [
      [[-0.02, -0.15], [-0.02, 0.13]],
      [[-0.02, 0.13], [0.08, 0.17]],
      [[-0.10, 0.05], [0.08, 0.05]],
    ],
    g: [
      [[0.09, 0.08], [-0.01, 0.11]],
      [[-0.01, 0.11], [-0.10, 0.04]],
      [[-0.10, 0.04], [-0.09, -0.07]],
      [[-0.09, -0.07], [0, -0.12]],
      [[0, -0.12], [0.09, -0.06]],
      [[0.09, 0.09], [0.08, -0.15]],
      [[0.08, -0.15], [0, -0.19]],
    ],
    h: [
      [[-0.10, -0.15], [-0.10, 0.17]],
      [[-0.10, 0.04], [-0.02, 0.11]],
      [[-0.02, 0.11], [0.09, 0.05]],
      [[0.09, 0.05], [0.09, -0.15]],
    ],
    k: [
      [[-0.10, -0.15], [-0.10, 0.17]],
      [[-0.10, -0.02], [0.09, 0.11]],
      [[-0.06, 0.01], [0.10, -0.14]],
    ],
    l: [
      [[-0.02, -0.15], [-0.02, 0.17]],
    ],
    m: [
      [[-0.12, -0.14], [-0.12, 0.10]],
      [[-0.12, 0.05], [-0.04, 0.10]],
      [[-0.04, 0.10], [0.01, 0.04]],
      [[0.01, 0.04], [0.08, 0.10]],
      [[0.08, 0.10], [0.12, 0.04]],
      [[0.12, 0.04], [0.12, -0.14]],
    ],
    n: [
      [[-0.10, -0.14], [-0.10, 0.10]],
      [[-0.10, 0.04], [-0.01, 0.11]],
      [[-0.01, 0.11], [0.10, 0.04]],
      [[0.10, 0.04], [0.10, -0.14]],
    ],
    p: [
      [[-0.10, -0.19], [-0.10, 0.10]],
      [[-0.10, 0.05], [-0.01, 0.11]],
      [[-0.01, 0.11], [0.10, 0.04]],
      [[0.10, 0.04], [0.09, -0.07]],
      [[0.09, -0.07], [0, -0.12]],
      [[0, -0.12], [-0.10, -0.06]],
    ],
  };
  const strokes = points[glyph].map(([start, end]) => makeBeam(
    new THREE.Vector3(start[0], start[1], 0),
    new THREE.Vector3(end[0], end[1], 0),
    {
      color: material.color.getHex(),
      depth: 0.042,
      jointRadius: 0.001,
      thickness: 0.032,
    },
  ));
  group.add(plaque, ...strokes);
  return group;
}

function compoundOutputEpicyclic(movement) {
  const root = new THREE.Group();
  const nominalCarrierPeriod = 9;
  const carrierAngularSpeed = FULL_TURN / nominalCarrierPeriod;
  const module = 0.08;
  const toothHeight = module * 0.82;
  const gearDepth = 0.27;
  const teeth = Object.freeze({
    A: 23,
    B: 15,
    D: 17,
    E: 23,
    F: 17,
  });
  const pitchRadii = Object.freeze(Object.fromEntries(
    Object.entries(teeth).map(([label, toothCount]) => [
      label,
      toothCount * module / 2,
    ]),
  ));
  const compoundCenterRadius = pitchRadii.A + pitchRadii.F;
  const outerOutputCenterRadius = compoundCenterRadius
    + pitchRadii.E + pitchRadii.B;
  const backPlaneZ = -0.22;
  const frontPlaneZ = 0.18;
  const carrierPlaneZ = 0.55;
  const sunMountPhase = Math.PI / 2;
  const compoundFMountPhase = 3 * Math.PI / 2 - Math.PI / teeth.F;
  const compoundEMountPhase = 3 * Math.PI / 2 - Math.PI / teeth.E;
  const outputBMountPhase = 3 * Math.PI / 2 - Math.PI / teeth.B;
  const outputDMountPhase = Math.PI / 2;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const carrierMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.50 });

  const supportBase = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.75, 0.20, 0.86),
    frameMaterial,
  ), 'stationary-pedestal-base');
  supportBase.position.set(0, -4.25, -0.48);
  const supportPost = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 4.25, 0.30),
    frameMaterial,
  ), 'stationary-central-axis-support');
  supportPost.position.set(0, -2.10, -0.72);
  const supportHead = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.08, 0.20, 56),
    frameMaterial,
  ), 'stationary-back-bearing-plate');
  supportHead.rotation.x = Math.PI / 2;
  supportHead.position.z = -0.60;

  const fixedSunA = makeGear({
    color: PALETTE.muted,
    depth: gearDepth,
    radius: pitchRadii.A,
    teeth: teeth.A,
    toothHeight,
  });
  fixedSunA.position.z = backPlaneZ;
  fixedSunA.userData.isGear = true;
  fixedSunA.userData.fixed = true;
  fixedSunA.userData.sourceLabel = 'A';
  fixedSunA.userData.role = 'fixed-central-wheel-A';
  setSpin(fixedSunA, sunMountPhase);

  const outputD = makeGear({
    color: PALETTE.driven,
    depth: gearDepth,
    radius: pitchRadii.D,
    teeth: teeth.D,
    toothHeight,
  });
  outputD.position.z = frontPlaneZ;
  outputD.userData.isGear = true;
  outputD.userData.looseOnCentralAxis = true;
  outputD.userData.sourceLabel = 'D';
  outputD.userData.role = 'loose-coaxial-output-wheel-D';

  const centralStationaryShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 1.55, 28),
    darkMaterial,
  ), 'stationary-stud-common-to-A-D-and-carrier-C');
  centralStationaryShaft.rotation.x = Math.PI / 2;
  centralStationaryShaft.position.z = 0.04;
  centralStationaryShaft.userData.fixed = true;

  const fixedLock = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 1.58, 0.16),
    darkMaterial,
  ), 'fixed-lock-from-frame-to-wheel-A');
  fixedLock.position.set(-0.58, -0.77, backPlaneZ - 0.23);
  fixedLock.rotation.z = -0.44;

  const carrierC = addRole(new THREE.Group(),
    'driven-train-bearing-arm-C');
  carrierC.userData.axis = Z_AXIS.clone();
  carrierC.userData.input = true;
  const carrierBar = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.24, outerOutputCenterRadius + 0.22, 0.16),
    carrierMaterial,
  ), 'rigid-carrier-bar-through-D-F-and-B-axes');
  carrierBar.position.set(
    0,
    (outerOutputCenterRadius + 0.10) / 2,
    carrierPlaneZ,
  );
  carrierC.add(carrierBar);

  const carrierPivots = [
    ['central-carrier-pivot', 0],
    ['compound-F-E-carrier-pin', compoundCenterRadius],
    ['carried-output-B-pin', outerOutputCenterRadius],
  ].map(([role, y]) => {
    // Pass 93: the F/E and B pin heads (r 0.13 on 0.091 bores) sit inside
    // the arm's round eyes (r 0.22 and 0.20) instead of covering them.
    const radius = y === 0 ? 0.20 : 0.13;
    const pivot = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.23, 28),
      darkMaterial,
    ), role);
    pivot.rotation.x = Math.PI / 2;
    pivot.position.set(0, y, carrierPlaneZ + 0.02);
    carrierC.add(pivot);
    return pivot;
  });
  const carrierIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.78, 0.028),
    whiteMaterial,
  ), 'white-carrier-C-speed-index');
  carrierIndex.position.set(0, 0.70, carrierPlaneZ + 0.10);
  carrierC.add(carrierIndex);

  const compoundF = makeGear({
    color: PALETTE.accent,
    depth: gearDepth,
    radius: pitchRadii.F,
    teeth: teeth.F,
    toothHeight,
  });
  compoundF.position.set(0, compoundCenterRadius, backPlaneZ);
  compoundF.userData.isGear = true;
  compoundF.userData.rigidPair = 'F-E';
  compoundF.userData.sourceLabel = 'F';
  compoundF.userData.role = 'seventeen-tooth-pinion-F-of-rigid-compound';
  carrierC.add(compoundF);

  const compoundE = makeGear({
    color: PALETTE.accent,
    depth: gearDepth,
    radius: pitchRadii.E,
    teeth: teeth.E,
    toothHeight,
  });
  compoundE.position.set(0, compoundCenterRadius, frontPlaneZ);
  compoundE.userData.isGear = true;
  compoundE.userData.rigidPair = 'F-E';
  compoundE.userData.sourceLabel = 'E';
  compoundE.userData.role = 'twenty-three-tooth-wheel-E-of-rigid-compound';
  carrierC.add(compoundE);

  const compoundSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.77, 28),
    darkMaterial,
  ), 'single-sleeve-rigidly-uniting-F-and-E');
  compoundSleeve.rotation.x = Math.PI / 2;
  compoundSleeve.position.set(0, compoundCenterRadius, -0.01);
  carrierC.add(compoundSleeve);

  const outputB = makeGear({
    color: PALETTE.driven,
    depth: gearDepth,
    radius: pitchRadii.B,
    teeth: teeth.B,
    toothHeight,
  });
  outputB.position.set(0, outerOutputCenterRadius, frontPlaneZ);
  outputB.userData.carriedBy = 'C';
  outputB.userData.isGear = true;
  outputB.userData.looseOnCarrierPin = true;
  outputB.userData.sourceLabel = 'B';
  outputB.userData.role = 'fifteen-tooth-carried-output-wheel-B';
  carrierC.add(outputB);

  const contactMarkers = [
    ['A-F', pitchRadii.A, backPlaneZ + gearDepth * 0.58],
    ['D-E', pitchRadii.D, frontPlaneZ + gearDepth * 0.58],
    [
      'E-B',
      compoundCenterRadius + pitchRadii.E,
      frontPlaneZ + gearDepth * 0.58,
    ],
  ].map(([pair, y, z]) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.070, 18, 12),
      whiteMaterial,
    ), `pitch-contact-${pair}`);
    marker.position.set(0, y, z);
    marker.userData.pair = pair;
    carrierC.add(marker);
    return marker;
  });

  const labelMaterial = matte(PALETTE.ink, { roughness: 0.55 });
  const labels = Object.fromEntries(
    ['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => [
      letter,
      makeSourceLetter(letter, labelMaterial),
    ]),
  );
  Object.values(labels).forEach((label) => {
    label.position.z = 0.83;
  });

  root.add(
    supportBase,
    supportPost,
    supportHead,
    fixedLock,
    fixedSunA,
    outputD,
    centralStationaryShaft,
    carrierC,
    ...Object.values(labels),
  );

  const compoundRelativeRatio = teeth.A / teeth.F;
  const outputBRelativeRatio = -teeth.E / teeth.B
    * compoundRelativeRatio;
  const outputDRelativeRatio = -teeth.E / teeth.D
    * compoundRelativeRatio;
  const compoundAbsoluteRatio = 1 + compoundRelativeRatio;
  const outputBAbsoluteRatio = 1 + outputBRelativeRatio;
  const outputDAbsoluteRatio = 1 + outputDRelativeRatio;
  const afPhaseConstant = teeth.A * sunMountPhase
    + teeth.F * compoundFMountPhase;
  const dePhaseConstant = teeth.D * outputDMountPhase
    + teeth.E * compoundEMountPhase;
  const ebPhaseConstant = teeth.E * compoundEMountPhase
    + teeth.B * outputBMountPhase;

  const stateAtTime = (time) => {
    const carrierAngle = carrierAngularSpeed * time;
    const carrierCyclePosition = THREE.MathUtils.euclideanModulo(
      time,
      nominalCarrierPeriod,
    ) / nominalCarrierPeriod;
    const radial = new THREE.Vector3(
      -Math.sin(carrierAngle),
      Math.cos(carrierAngle),
      0,
    );
    const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
    const compoundCenter = radial.clone().multiplyScalar(
      compoundCenterRadius,
    );
    const outputBCenter = radial.clone().multiplyScalar(
      outerOutputCenterRadius,
    );
    const compoundCenterVelocity = tangent.clone().multiplyScalar(
      carrierAngularSpeed * compoundCenterRadius,
    );
    const outputBCenterVelocity = tangent.clone().multiplyScalar(
      carrierAngularSpeed * outerOutputCenterRadius,
    );
    const compoundRelativeAngle = compoundRelativeRatio * carrierAngle;
    const outputBRelativeAngle = outputBRelativeRatio * carrierAngle;
    const compoundFAbsoluteAngle = compoundFMountPhase
      + compoundAbsoluteRatio * carrierAngle;
    const compoundEAbsoluteAngle = compoundEMountPhase
      + compoundAbsoluteRatio * carrierAngle;
    const outputBAbsoluteAngle = outputBMountPhase
      + outputBAbsoluteRatio * carrierAngle;
    const outputDAbsoluteAngle = outputDMountPhase
      + outputDAbsoluteRatio * carrierAngle;
    const compoundAbsoluteAngularSpeed = compoundAbsoluteRatio
      * carrierAngularSpeed;
    const outputBAbsoluteAngularSpeed = outputBAbsoluteRatio
      * carrierAngularSpeed;
    const outputDAbsoluteAngularSpeed = outputDAbsoluteRatio
      * carrierAngularSpeed;

    const contactAF = radial.clone().multiplyScalar(pitchRadii.A);
    const contactDE = radial.clone().multiplyScalar(pitchRadii.D);
    const contactEB = radial.clone().multiplyScalar(
      compoundCenterRadius + pitchRadii.E,
    );
    const contactAFOnF = compoundCenter.clone().addScaledVector(
      radial,
      -pitchRadii.F,
    );
    const contactDEOnE = compoundCenter.clone().addScaledVector(
      radial,
      -pitchRadii.E,
    );
    const contactEBOnE = compoundCenter.clone().addScaledVector(
      radial,
      pitchRadii.E,
    );
    const contactEBOnB = outputBCenter.clone().addScaledVector(
      radial,
      -pitchRadii.B,
    );
    const fixedAContactVelocity = new THREE.Vector3();
    const compoundAFContactVelocity = angularPointVelocity(
      compoundCenterVelocity,
      compoundAbsoluteAngularSpeed,
      radial.clone().multiplyScalar(-pitchRadii.F),
    );
    const outputDContactVelocity = angularPointVelocity(
      new THREE.Vector3(),
      outputDAbsoluteAngularSpeed,
      radial.clone().multiplyScalar(pitchRadii.D),
    );
    const compoundDEContactVelocity = angularPointVelocity(
      compoundCenterVelocity,
      compoundAbsoluteAngularSpeed,
      radial.clone().multiplyScalar(-pitchRadii.E),
    );
    const compoundEBContactVelocity = angularPointVelocity(
      compoundCenterVelocity,
      compoundAbsoluteAngularSpeed,
      radial.clone().multiplyScalar(pitchRadii.E),
    );
    const outputBContactVelocity = angularPointVelocity(
      outputBCenterVelocity,
      outputBAbsoluteAngularSpeed,
      radial.clone().multiplyScalar(-pitchRadii.B),
    );

    return {
      afContactPositionResidual: contactAF.distanceTo(contactAFOnF),
      afPitchVelocityResidual: compoundAFContactVelocity
        .distanceTo(fixedAContactVelocity),
      carrierAngle,
      carrierAngularSpeed,
      carrierCyclePosition,
      compoundAbsoluteAngularSpeed,
      compoundCenter,
      compoundCenterVelocity,
      compoundEAbsoluteAngle,
      compoundFAbsoluteAngle,
      compoundRigidAngleResidual:
        compoundEAbsoluteAngle - compoundFAbsoluteAngle
        - (compoundEMountPhase - compoundFMountPhase),
      deContactPositionResidual: contactDE.distanceTo(contactDEOnE),
      dePitchVelocityResidual: compoundDEContactVelocity
        .distanceTo(outputDContactVelocity),
      ebContactPositionResidual: contactEBOnE.distanceTo(contactEBOnB),
      ebPitchVelocityResidual: compoundEBContactVelocity
        .distanceTo(outputBContactVelocity),
      meshPhaseResiduals: {
        AF: teeth.A * (sunMountPhase - carrierAngle)
          + teeth.F * (compoundFAbsoluteAngle - carrierAngle)
          - afPhaseConstant,
        DE: teeth.D * (outputDAbsoluteAngle - carrierAngle)
          + teeth.E * (compoundEAbsoluteAngle - carrierAngle)
          - dePhaseConstant,
        EB: teeth.E * (compoundEAbsoluteAngle - carrierAngle)
          + teeth.B * (outputBAbsoluteAngle - carrierAngle)
          - ebPhaseConstant,
      },
      outputBAbsoluteAngle,
      outputBAbsoluteAngularSpeed,
      outputBCenter,
      outputBCenterVelocity,
      outputDAbsoluteAngle,
      outputDAbsoluteAngularSpeed,
      radial,
      tangent,
    };
  };

  const initialState = stateAtTime(0);
  root.userData.archetype =
    'fixed-sun-carried-compound-planet-two-free-output-branches-epicyclic';
  root.userData.mechanism =
    'fixed-A-drivable-carrier-C-compound-F-E-and-compatible-free-output-wheels-B-and-D';
  root.userData.blocks = {
    carrierBar,
    carrierC,
    carrierIndex,
    carrierPivots,
    centralStationaryShaft,
    compoundE,
    compoundF,
    compoundSleeve,
    contactMarkers,
    fixedLock,
    fixedSunA,
    labels,
    outputB,
    outputD,
    supportBase,
    supportHead,
    supportPost,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.15, -4.40, -0.95),
    new THREE.Vector3(4.15, 4.18, 1.05),
  );
  root.userData.canonicalTimes = {
    carrierAtLeft: nominalCarrierPeriod / 4,
    carrierAtTop: 0,
    carrierAtBottom: nominalCarrierPeriod / 2,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    dependentOutputCoordinates: 2,
    independentCarrierInputs: 1,
    independentCompoundCoordinates: 0,
  };
  root.userData.geometry = {
    backPlaneZ,
    carrierPlaneZ,
    compoundCenterRadius,
    frontPlaneZ,
    gearDepth,
    module,
    outerOutputCenterRadius,
    pitchRadii,
    toothHeight,
  };
  root.userData.meshes = [
    {
      centerDistance: compoundCenterRadius,
      external: true,
      first: 'A',
      firstPitchRadius: pitchRadii.A,
      planeZ: backPlaneZ,
      second: 'F',
      secondPitchRadius: pitchRadii.F,
    },
    {
      centerDistance: compoundCenterRadius,
      external: true,
      first: 'D',
      firstPitchRadius: pitchRadii.D,
      planeZ: frontPlaneZ,
      second: 'E',
      secondPitchRadius: pitchRadii.E,
    },
    {
      centerDistance: pitchRadii.E + pitchRadii.B,
      external: true,
      first: 'E',
      firstPitchRadius: pitchRadii.E,
      planeZ: frontPlaneZ,
      second: 'B',
      secondPitchRadius: pitchRadii.B,
    },
  ];
  root.userData.sourceAnimation = {
    available: true,
    officialCanvasModelPresent: true,
    sourceUrl: movement.sourceUrl,
    usedAsMotionValidationOnly: true,
  };
  root.userData.sourceReference = {
    engineeringCorroboration: {
      detail:
        'NASA SP-8100 analyzes a planetary train by subtracting the carrier angular velocity from every member, leaving an ordinary fixed-axis train with unchanged engagement forces and equal pitch-line velocities.',
      report: 'NASA SP-8100, Dynamics of Planetary Gear Trains (1984)',
      url: 'https://ntrs.nasa.gov/api/citations/19840017959/downloads/19840017959.pdf',
    },
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_502.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'Brown and the engraving fix the A-F compound F/E, E-B, alternative/concentric D branch, and labels. The official canvas provides the exact displayed angular factors C=1, F/E=1+23/17, B=1-529/255, and D=1-529/289, which identify the compatible 23/17/23/15/17 tooth counts used here. Geometry is independently authored: module, face widths, depth separation, frame, colors, labels, and a nine-second carrier period are reconstruction choices. Both freely rotating output branches pictured by the source are shown; only A is fixed, so B and D do not impose competing input constraints.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    carrierAngularSpeed,
    compoundAbsoluteRatio,
    compoundRelativeRatio,
    continuousUnwrappedRotation: true,
    nominalCarrierPeriod,
    outputBAbsoluteRatio,
    outputBRelativeRatio,
    outputDAbsoluteRatio,
    outputDRelativeRatio,
    sourceCanvasRatios: {
      B: -274 / 255,
      C: 1,
      D: -240 / 289,
      E_F: 40 / 17,
    },
    teeth,
  };
  root.userData.kinematics = initialState;
  root.userData.cameraDistanceScale = 1.05;
  root.userData.groundFloorY = -4.37;

  const update = (time) => {
    const state = stateAtTime(time);
    carrierC.rotation.z = state.carrierAngle;
    setSpin(
      compoundF,
      compoundFMountPhase
        + compoundRelativeRatio * state.carrierAngle,
    );
    setSpin(
      compoundE,
      compoundEMountPhase
        + compoundRelativeRatio * state.carrierAngle,
    );
    setSpin(
      outputB,
      outputBMountPhase
        + outputBRelativeRatio * state.carrierAngle,
    );
    setSpin(outputD, state.outputDAbsoluteAngle);

    labels.A.position.set(-1.20, -0.78, 0.83);
    labels.D.position.set(0.88, -0.58, 0.83);
    labels.C.position.copy(state.radial).multiplyScalar(0.72)
      .addScaledVector(state.tangent, 0.42);
    labels.F.position.copy(state.compoundCenter)
      .addScaledVector(state.tangent, 0.48);
    labels.E.position.copy(state.compoundCenter)
      .addScaledVector(state.radial, 0.57)
      .addScaledVector(state.tangent, -0.40);
    labels.B.position.copy(state.outputBCenter)
      .addScaledVector(state.radial, 0.52)
      .addScaledVector(state.tangent, -0.38);
    for (const label of [labels.C, labels.F, labels.E, labels.B]) {
      label.position.z = 0.83;
    }
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  correctEpicyclicFamily(root, movement.id);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.1, 0.2, 16),
  };
}

function bevelDifferentialEpicyclic(movement) {
  const root = new THREE.Group();
  // Brown draws C and D as broad, shallow wheels about 1.7 times the
  // diameter of B, whose rim meets theirs: C/D heel pitch radius equals B's
  // distance from A and vice versa, giving one common apex.
  // planetTeeth is a multiple of four so B presents a tooth space to both
  // C and D a quarter turn from its mounting index.
  const sideTeeth = 48;
  const planetTeeth = 28;
  const bevelPitchRadius = 1.60;
  const planetPitchRadius = bevelPitchRadius * planetTeeth / sideTeeth;
  const bevelDepth = planetPitchRadius / 2;
  const planetBevelDepth = bevelPitchRadius / 2;
  const pitchConeHalfAngle = Math.atan2(bevelPitchRadius, planetPitchRadius);
  const planetPitchConeHalfAngle = Math.PI / 2 - pitchConeHalfAngle;
  const pitchApexOffset = bevelDepth * 1.5;
  const planetApexOffset = planetBevelDepth * 1.5;
  const representativePitchCoordinate = 0.72;
  const representativeRadialCoordinate =
    representativePitchCoordinate * Math.tan(pitchConeHalfAngle);
  const lowerCInputAngularSpeed = 0.95;
  const upperDInputAngularSpeed = 0.35;
  const carrierAngularSpeed = (
    lowerCInputAngularSpeed + upperDInputAngularSpeed
  ) / 2;
  const planetAngularSpeedAboutOutwardRadial =
    sideTeeth / planetTeeth
    * (lowerCInputAngularSpeed - upperDInputAngularSpeed) / 2;
  const nominalCarrierPeriod = FULL_TURN / carrierAngularSpeed;
  const lowerCMountPhase = 0;
  const upperDMountPhase = 0;
  const planetMountPhase = Math.PI / planetTeeth;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.46,
  });
  const carrierMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const supportBase = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(4.75, 0.20, 2.55),
    frameMaterial,
  ), 'stationary-differential-support-base');
  supportBase.position.set(0, -3.10, -0.38);
  const rearPost = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 5.45, 0.30),
    frameMaterial,
  ), 'stationary-rear-support-for-shaft-A');
  rearPost.position.set(-1.95, -0.34, -0.78);
  const bearingArms = [-2.30, 2.30].map((y, index) => {
    const arm = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.20, 0.24),
      frameMaterial,
    ), `${index === 0 ? 'lower' : 'upper'}-shaft-A-bearing-arm`);
    arm.position.set(-0.94, y, -0.60);
    return arm;
  });
  const bearings = [-2.30, 2.30].map((y, index) => {
    const bearing = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.075, 10, 32),
      darkMaterial,
    ), `${index === 0 ? 'lower' : 'upper'}-shaft-A-bearing`);
    bearing.rotation.x = Math.PI / 2;
    bearing.position.set(0, y, -0.05);
    return bearing;
  });

  const carrierShaftA = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 5.25, 28),
    darkMaterial,
  ), 'central-shaft-A-rigidly-secured-to-carrier-F-G');
  carrierShaftA.userData.rigidAssembly = 'A-F-G';
  carrierShaftA.userData.sourceLabel = 'A';

  const lowerC = makeBevelGear({
    axis: Y_AXIS,
    color: PALETTE.driver,
    depth: bevelDepth,
    radius: bevelPitchRadius,
    teeth: sideTeeth,
  });
  lowerC.position.set(0, -pitchApexOffset, 0);
  lowerC.userData.axisDirection = Y_AXIS.clone();
  lowerC.userData.independentInput = true;
  lowerC.userData.isGear = true;
  lowerC.userData.pitchConeApex = new THREE.Vector3();
  lowerC.userData.sourceLabel = 'C';
  lowerC.userData.role = 'lower-loose-bevel-wheel-C-input';

  const upperD = makeBevelGear({
    axis: Y_AXIS.clone().negate(),
    color: PALETTE.brass,
    depth: bevelDepth,
    radius: bevelPitchRadius,
    teeth: sideTeeth,
  });
  upperD.position.set(0, pitchApexOffset, 0);
  upperD.userData.axisDirection = Y_AXIS.clone().negate();
  upperD.userData.independentInput = true;
  upperD.userData.isGear = true;
  upperD.userData.pitchConeApex = new THREE.Vector3();
  upperD.userData.sourceLabel = 'D';
  upperD.userData.role = 'upper-loose-bevel-wheel-D-input';

  const carrierFG = addRole(new THREE.Group(),
    'aggregate-output-arm-F-G-rigid-with-central-shaft-A');
  carrierFG.userData.aggregateOutput = true;
  carrierFG.userData.axis = Y_AXIS.clone();
  carrierFG.userData.rigidAssembly = 'A-F-G';
  const carrierSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 1.18, 32),
    carrierMaterial,
  ), 'central-carrier-sleeve-F-rigid-with-arm-G');
  const planetAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 2.34, 24),
    darkMaterial,
  ), 'radial-carrier-axle-for-free-bevel-wheel-B');
  planetAxle.rotation.z = Math.PI / 2;
  planetAxle.position.x = 0.98;
  const outerCarrierHead = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.34, 28),
    carrierMaterial,
  ), 'outer-carrier-head-G');
  outerCarrierHead.rotation.z = Math.PI / 2;
  outerCarrierHead.position.x = 2.02;
  const carrierIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.07, 0.055),
    whiteMaterial,
  ), 'white-arm-F-G-angular-speed-index');
  carrierIndex.position.set(1.62, 0.18, 0);
  const shaftAIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.065, 0.065),
    whiteMaterial,
  ), 'white-shaft-A-index-rigid-with-carrier-F-G');
  shaftAIndex.position.set(0.28, 2.54, 0);
  carrierFG.add(
    carrierShaftA,
    carrierSleeve,
    planetAxle,
    outerCarrierHead,
    carrierIndex,
    shaftAIndex,
  );

  const planetB = makeBevelGear({
    axis: X_AXIS.clone().negate(),
    color: PALETTE.accent,
    depth: planetBevelDepth,
    radius: planetPitchRadius,
    teeth: planetTeeth,
  });
  planetB.position.set(planetApexOffset, 0, 0);
  planetB.userData.axisDirectionInCarrier = X_AXIS.clone().negate();
  planetB.userData.freeOnCarrierAxle = true;
  planetB.userData.isGear = true;
  planetB.userData.pitchConeApexInCarrier = new THREE.Vector3();
  planetB.userData.sourceLabel = 'B';
  planetB.userData.role = 'free-radial-bevel-planet-B';
  carrierFG.add(planetB);

  const contactMarkers = [-1, 1].map((side) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 20, 14),
      whiteMaterial,
    ), side < 0
      ? 'representative-lower-C-B-pitch-cone-contact'
      : 'representative-upper-D-B-pitch-cone-contact');
    marker.position.set(
      representativeRadialCoordinate,
      side * representativePitchCoordinate,
      0,
    );
    marker.userData.pair = side < 0 ? 'C-B' : 'D-B';
    carrierFG.add(marker);
    return marker;
  });

  const labelMaterial = matte(PALETTE.ink, { roughness: 0.55 });
  const labels = Object.fromEntries(
    ['A', 'B', 'C', 'D', 'F', 'G'].map((letter) => [
      letter,
      makeSourceLetter(letter, labelMaterial),
    ]),
  );
  labels.A.position.set(-0.55, 2.62, 0.78);
  labels.C.position.set(-1.52, -1.42, 0.78);
  labels.D.position.set(-1.52, 1.42, 0.78);
  labels.F.position.set(-0.53, 0.38, 0.78);

  root.add(
    supportBase,
    rearPost,
    ...bearingArms,
    ...bearings,
    lowerC,
    upperD,
    carrierFG,
    ...Object.values(labels),
  );

  // Mesh phases in side-wheel angle: the planet turns planetTeeth/sideTeeth
  // of a side-wheel pitch for each of its own pitch angles.
  const planetToSide = planetTeeth / sideTeeth;
  const lowerMeshPhaseConstant =
    lowerCMountPhase - planetToSide * planetMountPhase;
  const upperMeshPhaseConstant =
    upperDMountPhase + planetToSide * planetMountPhase;
  const stateAtTime = (time) => {
    const lowerCCommonAxisAngle = lowerCMountPhase
      + lowerCInputAngularSpeed * time;
    const upperDCommonAxisAngle = upperDMountPhase
      + upperDInputAngularSpeed * time;
    const carrierAngle = carrierAngularSpeed * time;
    const planetSpinAngleAboutOutwardRadial = planetMountPhase
      + planetAngularSpeedAboutOutwardRadial * time;
    const radial = new THREE.Vector3(
      Math.cos(carrierAngle),
      0,
      -Math.sin(carrierAngle),
    );
    const orbitalTangent = new THREE.Vector3().crossVectors(
      Y_AXIS,
      radial,
    );
    const planetCenter = radial.clone().multiplyScalar(planetApexOffset);
    const planetAxisDirection = radial.clone().negate();
    const lowerContact = radial.clone()
      .multiplyScalar(representativeRadialCoordinate)
      .addScaledVector(Y_AXIS, -representativePitchCoordinate);
    const upperContact = radial.clone()
      .multiplyScalar(representativeRadialCoordinate)
      .addScaledVector(Y_AXIS, representativePitchCoordinate);
    const lowerAngularVelocity = Y_AXIS.clone().multiplyScalar(
      lowerCInputAngularSpeed,
    );
    const upperAngularVelocity = Y_AXIS.clone().multiplyScalar(
      upperDInputAngularSpeed,
    );
    const planetAngularVelocity = Y_AXIS.clone()
      .multiplyScalar(carrierAngularSpeed)
      .addScaledVector(
        radial,
        planetAngularSpeedAboutOutwardRadial,
      );
    const lowerContactVelocityC = new THREE.Vector3().crossVectors(
      lowerAngularVelocity,
      lowerContact,
    );
    const lowerContactVelocityB = new THREE.Vector3().crossVectors(
      planetAngularVelocity,
      lowerContact,
    );
    const upperContactVelocityD = new THREE.Vector3().crossVectors(
      upperAngularVelocity,
      upperContact,
    );
    const upperContactVelocityB = new THREE.Vector3().crossVectors(
      planetAngularVelocity,
      upperContact,
    );
    const lowerPitchApexFromC = new THREE.Vector3(
      0,
      -pitchApexOffset,
      0,
    ).addScaledVector(Y_AXIS, pitchApexOffset);
    const upperPitchApexFromD = new THREE.Vector3(
      0,
      pitchApexOffset,
      0,
    ).addScaledVector(Y_AXIS, -pitchApexOffset);
    const planetPitchApex = planetCenter.clone().addScaledVector(
      planetAxisDirection,
      planetApexOffset,
    );
    return {
      carrierAngle,
      carrierAngularSpeed,
      differentialEquationResidual:
        lowerCInputAngularSpeed + upperDInputAngularSpeed
        - 2 * carrierAngularSpeed,
      lowerCCommonAxisAngle,
      lowerCInputAngularSpeed,
      lowerContact,
      lowerPitchApexResidual: lowerPitchApexFromC.length(),
      lowerPitchVelocityResidual: lowerContactVelocityC
        .distanceTo(lowerContactVelocityB),
      meshPhaseResiduals: {
        CB: lowerCCommonAxisAngle - carrierAngle
          - planetToSide * planetSpinAngleAboutOutwardRadial
          - lowerMeshPhaseConstant,
        DB: upperDCommonAxisAngle - carrierAngle
          + planetToSide * planetSpinAngleAboutOutwardRadial
          - upperMeshPhaseConstant,
      },
      orbitalTangent,
      planetAngularSpeedAboutOutwardRadial,
      planetAxisDirection,
      planetCenter,
      planetPitchApexResidual: planetPitchApex.length(),
      planetSpinAngleAboutOutwardRadial,
      radial,
      upperContact,
      upperDCommonAxisAngle,
      upperDInputAngularSpeed,
      upperPitchApexResidual: upperPitchApexFromD.length(),
      upperPitchVelocityResidual: upperContactVelocityD
        .distanceTo(upperContactVelocityB),
    };
  };

  root.userData.archetype =
    'two-input-equal-miter-bevel-differential-with-radial-planet-carrier-output';
  root.userData.mechanism =
    'loose-bevel-inputs-C-D-drive-the-average-speed-carrier-F-G-while-free-planet-B-spins-at-half-the-difference';
  root.userData.blocks = {
    bearingArms,
    bearings,
    carrierFG,
    carrierIndex,
    carrierSleeve,
    contactMarkers,
    carrierShaftA,
    labels,
    lowerC,
    outerCarrierHead,
    planetAxle,
    planetB,
    rearPost,
    supportBase,
    shaftAIndex,
    upperD,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.52, -3.23, -2.30),
    new THREE.Vector3(2.52, 2.84, 3.12),
  );
  root.userData.canonicalTimes = {
    carrierQuarterTurn: nominalCarrierPeriod / 4,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    dependentCarrierCoordinates: 1,
    dependentPlanetCoordinates: 1,
    independentBevelWheelInputs: 2,
  };
  root.userData.geometry = {
    bevelDepth,
    bevelPitchRadius,
    pitchApexOffset,
    pitchConeHalfAngle,
    planetApexOffset,
    planetBevelDepth,
    planetPitchConeHalfAngle,
    planetPitchRadius,
    planetTeeth,
    representativePitchCoordinate,
    representativeRadialCoordinate,
    sideTeeth,
  };
  root.userData.meshes = [
    {
      axesAngle: pitchConeHalfAngle + planetPitchConeHalfAngle,
      first: 'C',
      pitchConeApex: new THREE.Vector3(),
      second: 'B',
      teeth: [sideTeeth, planetTeeth],
    },
    {
      axesAngle: pitchConeHalfAngle + planetPitchConeHalfAngle,
      first: 'D',
      pitchConeApex: new THREE.Vector3(),
      second: 'B',
      teeth: [sideTeeth, planetTeeth],
    },
  ];
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    engineeringCorroboration: {
      detail:
        'NASA SP-8100 removes carrier rotation to analyze planetary engagement as a fixed-axis gear train; for equal opposed side gears this gives the carrier-average and planet-half-difference relations used here.',
      report: 'NASA SP-8100, Dynamics of Planetary Gear Trains (1984)',
      url: 'https://ntrs.nasa.gov/api/citations/19840017959/downloads/19840017959.pdf',
    },
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_503.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The official page marks Animated unavailable. Brown fixes two loose coaxial bevel wheels C and D, radial free planet B, carrier F-G rigid with shaft A, and either two-wheel or carrier-plus-wheel input modes, but gives no tooth counts, cone dimensions, speeds, or timing. This model selects Brown’s two-wheel-input mode with equal 48-tooth side wheels C and D and a 28-tooth planet B, sized from the engraving’s broad shallow side wheels (pitch cones about 59.4 and 30.6 degrees), C=0.95 rad/s, D=0.35 rad/s, independently authored dimensions, labels, and colors. The exact average/difference law, common pitch apex, and both contact velocities are constraints; the selected tooth counts, rates and appearance are reconstruction choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    carrierAngularSpeed,
    constraintLaw:
      '2 * carrierAngularSpeed = lowerCInputAngularSpeed + upperDInputAngularSpeed',
    continuousUnwrappedRotation: true,
    lowerCInputAngularSpeed,
    nominalCarrierPeriod,
    planetAngularSpeedAboutOutwardRadial,
    planetDifferenceLaw:
      'planetAngularSpeed = sideTeeth / planetTeeth * (C - D) / 2',
    upperDInputAngularSpeed,
  };
  root.userData.cameraDistanceScale = 1.10;
  root.userData.groundFloorY = -3.22;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(lowerC, state.lowerCCommonAxisAngle);
    setSpin(upperD, -state.upperDCommonAxisAngle);
    carrierFG.rotation.y = state.carrierAngle;
    setSpin(planetB, -state.planetSpinAngleAboutOutwardRadial);

    labels.B.position.copy(state.planetCenter)
      .addScaledVector(state.radial, 0.52)
      .addScaledVector(Y_AXIS, 0.25);
    labels.G.position.copy(state.radial).multiplyScalar(2.22)
      .addScaledVector(Y_AXIS, -0.20);
    labels.F.position.copy(state.radial).multiplyScalar(0.43)
      .addScaledVector(Y_AXIS, 0.36);
    for (const label of [labels.B, labels.F, labels.G]) {
      label.position.z += 0.78;
    }
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  correctEpicyclicFamily(root, movement.id);
  correctEpicyclic503504(root, movement.id);
  fit503SourceProportions(root);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.3, 0.3, 16),
  };
}

// The shared corrections assume one bevel depth; B is now a smaller, deeper
// cone, so its bored body, the hubs, sleeve F and arm G are refitted here.
function fit503SourceProportions(root) {
  const b = root.userData.blocks;
  const g = root.userData.geometry;
  const replace = (mesh, geometry) => {
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  };
  const annulus = (inner, outer, low, high) => boredLatheGeometry(
    [{ radial: outer, axial: low }, { radial: outer, axial: high }],
    inner,
    64,
  ).rotateX(Math.PI / 2);
  const planetRotor = b.planetB.userData.rotor;
  const planetBody = planetRotor.children[0];
  replace(planetBody, bevelBodyGeometry(
    b.planetB.userData.toothMeshes[0].geometry,
    0.106,
  ).rotateX(Math.PI).translate(0, 0, 1.5 * g.planetBevelDepth));
  planetBody.userData.boreRadius = 0.106;
  // Local z is measured from each wheel's origin toward its apex. The side
  // bosses stand outside the back faces, as Brown draws them round A; B's
  // boss runs inward from its toe toward F.
  const hubs = [
    [b.lowerC, 0.116, 0.34, -0.46, 0.19],
    [b.upperD, 0.116, 0.34, -0.46, 0.19],
    [b.planetB, 0.106, 0.30, -0.50, 0.40],
  ];
  for (const [gear, bore, outer, low, high] of hubs) {
    const rotor = gear.userData.rotor;
    const hub = rotor.children.find((object) => object.userData.boreRadius
      && !object.userData.bevelGearBody && object !== rotor.children[0]);
    replace(hub, annulus(bore, outer, low, high));
    hub.userData.boreRadius = bore;
    const indicator = rotor.children.find((object) => (
      object.geometry?.type === 'BoxGeometry'
    ));
    const start = outer + 0.03;
    const end = gear.userData.radius * 0.72;
    replace(indicator, new THREE.BoxGeometry(
      end - start,
      Math.max(0.04, gear.userData.radius * 0.05),
      0.024,
    ));
    indicator.position.x = (start + end) / 2;
  }
  // Brown draws F as a square block on A carrying the stub axle of B.
  replace(b.carrierSleeve, new THREE.BoxGeometry(0.44, 0.80, 0.44));
  replace(b.planetAxle, new THREE.CylinderGeometry(0.105, 0.105, 1.95, 48));
  b.planetAxle.position.x = 0.975;
  replace(b.outerCarrierHead, new THREE.CylinderGeometry(0.20, 0.20, 0.18, 48));
  b.outerCarrierHead.position.x = 1.81;
  b.carrierIndex.position.set(1.81, 0.22, 0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.98, -1.70, -1.98),
    new THREE.Vector3(1.98, 1.70, 1.98),
  );
  root.userData.sampledMotionBounds = {
    max: root.userData.cameraFitBounds.max.toArray(),
    min: root.userData.cameraFitBounds.min.toArray(),
  };
}

function fergusonMechanicalParadox(movement) {
  const root = new THREE.Group();
  const fixedTeeth = 20;
  const intermediateTeeth = 20;
  const outputTeeth = Object.freeze({ E: 21, F: 20, G: 19 });
  const carrierPinSpacing = 1.55;
  const fixedModule = 2 * carrierPinSpacing
    / (fixedTeeth + intermediateTeeth);
  const fixedPitchRadius = fixedTeeth * fixedModule / 2;
  const intermediateInputPitchRadius = intermediateTeeth
    * fixedModule / 2;
  const carrierAngularSpeed = 0.75;
  const nominalCarrierPeriod = FULL_TURN / carrierAngularSpeed;
  const gearDepth = 0.19;
  const layerY = Object.freeze({
    A: 0,
    E: 0.32,
    F: 0,
    G: -0.32,
  });
  const carrierPlaneY = 0.84;
  const intermediateMountPhase = Math.PI / intermediateTeeth;
  const fixedMountPhase = 0;
  const outputMountPhases = Object.freeze(Object.fromEntries(
    Object.entries(outputTeeth).map(([label, count]) => [
      label,
      count % 2 === 0 ? 0 : Math.PI / count,
    ]),
  ));
  const outputWorkingGeometry = Object.freeze(Object.fromEntries(
    Object.entries(outputTeeth).map(([label, count]) => {
      const branchModule = 2 * carrierPinSpacing
        / (intermediateTeeth + count);
      return [label, Object.freeze({
        intermediatePitchRadius:
          intermediateTeeth * branchModule / 2,
        module: branchModule,
        outputPitchRadius: count * branchModule / 2,
      })];
    }),
  ));

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.65,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.47,
  });
  const carrierMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.54,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });
  const outputColors = Object.freeze({
    E: 0x397a94,
    F: 0x6f8f9d,
    G: 0x244e67,
  });

  const supportBase = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.35, 0.22, 8.35),
    frameMaterial,
  ), 'stationary-paradox-support-base');
  supportBase.position.y = -1.72;
  const supportPedestal = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.66, 0.90, 1.58, 42),
    frameMaterial,
  ), 'stationary-pedestal-under-fixed-wheel-A');
  supportPedestal.position.y = -0.92;
  const stationaryStud = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 2.82, 28),
    darkMaterial,
  ), 'stationary-stud-carrying-fixed-wheel-A-and-carrier-C-D');
  stationaryStud.userData.fixed = true;

  const fixedA = makeGear({
    axis: Y_AXIS,
    color: PALETTE.muted,
    depth: gearDepth,
    radius: fixedPitchRadius,
    teeth: fixedTeeth,
    toothHeight: fixedModule * 0.82,
  });
  fixedA.position.y = layerY.A;
  fixedA.userData.fixed = true;
  fixedA.userData.isGear = true;
  fixedA.userData.sourceLabel = 'A';
  fixedA.userData.role = 'fixed-twenty-tooth-wheel-A';
  setSpin(fixedA, fixedMountPhase);

  const carrierCD = addRole(new THREE.Group(),
    'driven-train-bearing-arm-C-D');
  carrierCD.userData.axis = Y_AXIS.clone();
  carrierCD.userData.input = true;
  const carrierBar = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.72, 0.17, 0.27),
    carrierMaterial,
  ), 'rigid-carrier-arm-from-C-through-pins-M-N-to-D');
  carrierBar.position.set(1.74, carrierPlaneY, 0);
  const carrierPivots = [
    ['central-carrier-pivot-C', 0],
    ['intermediate-pin-M', carrierPinSpacing],
    ['three-output-common-pin-N', 2 * carrierPinSpacing],
  ].map(([role, x], index) => {
    // Pass 93: the nuts under M and N (r 0.13 and 0.17 on 0.091 and 0.131
    // bores) sit inside round bosses on the arm, not flush with its edges.
    const radius = [0.19, 0.13, 0.17][index];
    const pivot = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.34, 28),
      darkMaterial,
    ), role);
    pivot.position.set(x, carrierPlaneY - 0.09, 0);
    carrierCD.add(pivot);
    return pivot;
  });
  const carrierHandle = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.13, 0.18),
    carrierMaterial,
  ), 'outer-hand-driven-end-D-of-carrier');
  carrierHandle.position.set(3.58, carrierPlaneY, 0);
  const carrierIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.025, 0.075),
    whiteMaterial,
  ), 'white-carrier-C-D-speed-index');
  carrierIndex.position.set(0.72, carrierPlaneY + 0.10, 0);
  carrierCD.add(carrierBar, carrierHandle, carrierIndex);

  const intermediateRows = [];
  const inputRowB = makeGear({
    axis: Y_AXIS,
    color: PALETTE.accent,
    depth: gearDepth,
    radius: intermediateInputPitchRadius,
    teeth: intermediateTeeth,
    toothHeight: fixedModule * 0.82,
  });
  inputRowB.position.set(carrierPinSpacing, layerY.A, 0);
  inputRowB.userData.branch = 'A-B';
  inputRowB.userData.isGear = true;
  inputRowB.userData.rigidAssembly = 'thick-wheel-B';
  inputRowB.userData.role = 'input-row-of-thick-wheel-B-meshing-fixed-A';
  carrierCD.add(inputRowB);
  intermediateRows.push(inputRowB);

  const outputs = {};
  const outputIndices = {};
  for (const label of ['E', 'F', 'G']) {
    const geometry = outputWorkingGeometry[label];
    const intermediateRow = makeGear({
      axis: Y_AXIS,
      color: PALETTE.accent,
      depth: gearDepth,
      radius: geometry.intermediatePitchRadius,
      teeth: intermediateTeeth,
      toothHeight: geometry.module * 0.82,
    });
    intermediateRow.position.set(carrierPinSpacing, layerY[label], 0);
    intermediateRow.userData.branch = `B-${label}`;
    intermediateRow.userData.isGear = true;
    intermediateRow.userData.rigidAssembly = 'thick-wheel-B';
    intermediateRow.userData.role =
      `twenty-tooth-working-row-of-thick-B-meshing-${label}`;
    carrierCD.add(intermediateRow);
    intermediateRows.push(intermediateRow);

    const output = makeGear({
      axis: Y_AXIS,
      color: outputColors[label],
      depth: gearDepth,
      radius: geometry.outputPitchRadius,
      teeth: outputTeeth[label],
      toothHeight: geometry.module * 0.82,
    });
    output.position.set(2 * carrierPinSpacing, layerY[label], 0);
    output.userData.commonLoosePin = 'N';
    output.userData.isGear = true;
    output.userData.sourceLabel = label;
    output.userData.role =
      `${outputTeeth[label]}-tooth-loose-output-wheel-${label}`;
    const longIndex = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(
        geometry.outputPitchRadius * 1.22,
        0.028,
        0.065,
      ),
      whiteMaterial,
    ), `long-world-orientation-index-on-output-${label}`);
    longIndex.position.x = geometry.outputPitchRadius * 0.25;
    longIndex.position.z = gearDepth * 0.63;
    output.userData.rotor.add(longIndex);
    carrierCD.add(output);
    outputs[label] = output;
    outputIndices[label] = longIndex;
  }

  const intermediateSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 1.25, 28),
    darkMaterial,
  ), 'single-sleeve-rigidly-uniting-all-four-rows-of-thick-wheel-B');
  intermediateSleeve.position.set(carrierPinSpacing, 0, 0);
  intermediateSleeve.userData.rigidAssembly = 'thick-wheel-B';
  carrierCD.add(intermediateSleeve);
  const outputPin = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 1.30, 28),
    darkMaterial,
  ), 'common-stationary-in-carrier-pin-N-for-loose-E-F-G');
  outputPin.position.set(2 * carrierPinSpacing, 0, 0);
  carrierCD.add(outputPin);

  const contactMarkers = [
    {
      branch: 'A-B',
      pitchRadiusFromInnerCenter: fixedPitchRadius,
      y: layerY.A,
    },
    ...['E', 'F', 'G'].map((label) => ({
      branch: `B-${label}`,
      pitchRadiusFromInnerCenter:
        carrierPinSpacing
        + outputWorkingGeometry[label].intermediatePitchRadius,
      y: layerY[label],
    })),
  ].map(({ branch, pitchRadiusFromInnerCenter, y }) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.060, 18, 12),
      whiteMaterial,
    ), `pitch-contact-${branch}`);
    marker.position.set(pitchRadiusFromInnerCenter, y, 0);
    marker.userData.branch = branch;
    carrierCD.add(marker);
    return marker;
  });

  const labelMaterial = matte(PALETTE.ink, { roughness: 0.55 });
  const labels = Object.fromEntries(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'M', 'N'].map((letter) => [
      letter,
      makeSourceLetter(letter, labelMaterial),
    ]),
  );
  labels.A.position.set(-0.92, -0.54, 1.02);

  root.add(
    supportBase,
    supportPedestal,
    stationaryStud,
    fixedA,
    carrierCD,
    ...Object.values(labels),
  );

  const intermediateAbsoluteRatio = 2;
  const outputAbsoluteRatios = Object.freeze(Object.fromEntries(
    Object.entries(outputTeeth).map(([label, count]) => [
      label,
      1 - fixedTeeth / count,
    ]),
  ));
  const abPhaseConstant = fixedTeeth * fixedMountPhase
    + intermediateTeeth * intermediateMountPhase;
  const outputPhaseConstants = Object.freeze(Object.fromEntries(
    Object.entries(outputTeeth).map(([label, count]) => [
      label,
      intermediateTeeth * intermediateMountPhase
        + count * outputMountPhases[label],
    ]),
  ));
  const stateAtTime = (time) => {
    const carrierAngle = carrierAngularSpeed * time;
    const radial = new THREE.Vector3(
      Math.cos(carrierAngle),
      0,
      -Math.sin(carrierAngle),
    );
    const tangent = new THREE.Vector3().crossVectors(Y_AXIS, radial);
    const intermediateCenter = radial.clone().multiplyScalar(
      carrierPinSpacing,
    );
    const outputCenter = radial.clone().multiplyScalar(
      2 * carrierPinSpacing,
    );
    const intermediateCenterVelocity = tangent.clone().multiplyScalar(
      carrierAngularSpeed * carrierPinSpacing,
    );
    const outputCenterVelocity = tangent.clone().multiplyScalar(
      carrierAngularSpeed * 2 * carrierPinSpacing,
    );
    const intermediateAbsoluteAngle = intermediateMountPhase
      + intermediateAbsoluteRatio * carrierAngle;
    const intermediateAbsoluteAngularSpeed =
      intermediateAbsoluteRatio * carrierAngularSpeed;
    const outputsState = {};
    const meshPhaseResiduals = {
      AB: fixedTeeth * (fixedMountPhase - carrierAngle)
        + intermediateTeeth
          * (intermediateAbsoluteAngle - carrierAngle)
        - abPhaseConstant,
    };
    const pitchVelocityResiduals = {};
    const contactPositionResiduals = {};
    const fixedContact = radial.clone().multiplyScalar(fixedPitchRadius);
    const intermediateInputContact = intermediateCenter.clone()
      .addScaledVector(radial, -intermediateInputPitchRadius);
    const fixedContactVelocity = new THREE.Vector3();
    const intermediateInputContactVelocity = axialPointVelocity(
      intermediateCenterVelocity,
      Y_AXIS,
      intermediateAbsoluteAngularSpeed,
      radial.clone().multiplyScalar(-intermediateInputPitchRadius),
    );
    contactPositionResiduals.AB = fixedContact.distanceTo(
      intermediateInputContact,
    );
    pitchVelocityResiduals.AB = fixedContactVelocity.distanceTo(
      intermediateInputContactVelocity,
    );

    for (const label of ['E', 'F', 'G']) {
      const count = outputTeeth[label];
      const geometry = outputWorkingGeometry[label];
      const absoluteRatio = outputAbsoluteRatios[label];
      const absoluteAngle = outputMountPhases[label]
        + absoluteRatio * carrierAngle;
      const absoluteAngularSpeed = absoluteRatio * carrierAngularSpeed;
      const intermediateContact = intermediateCenter.clone()
        .addScaledVector(radial, geometry.intermediatePitchRadius);
      const outputContact = outputCenter.clone()
        .addScaledVector(radial, -geometry.outputPitchRadius);
      const intermediateContactVelocity = axialPointVelocity(
        intermediateCenterVelocity,
        Y_AXIS,
        intermediateAbsoluteAngularSpeed,
        radial.clone().multiplyScalar(geometry.intermediatePitchRadius),
      );
      const outputContactVelocity = axialPointVelocity(
        outputCenterVelocity,
        Y_AXIS,
        absoluteAngularSpeed,
        radial.clone().multiplyScalar(-geometry.outputPitchRadius),
      );
      outputsState[label] = {
        absoluteAngle,
        absoluteAngularSpeed,
        absoluteRatio,
        localAngle: absoluteAngle - carrierAngle,
      };
      contactPositionResiduals[`B${label}`] =
        intermediateContact.distanceTo(outputContact);
      pitchVelocityResiduals[`B${label}`] =
        intermediateContactVelocity.distanceTo(outputContactVelocity);
      meshPhaseResiduals[`B${label}`] = intermediateTeeth
        * (intermediateAbsoluteAngle - carrierAngle)
        + count * (absoluteAngle - carrierAngle)
        - outputPhaseConstants[label];
    }

    return {
      carrierAngle,
      carrierAngularSpeed,
      contactPositionResiduals,
      intermediateAbsoluteAngle,
      intermediateAbsoluteAngularSpeed,
      intermediateCenter,
      intermediateCenterVelocity,
      meshPhaseResiduals,
      outputCenter,
      outputCenterVelocity,
      outputs: outputsState,
      pitchVelocityResiduals,
      radial,
      tangent,
    };
  };

  root.userData.archetype =
    'ferguson-paradox-fixed-20-carried-compound-20-loose-21-20-19-output-stack';
  root.userData.mechanism =
    'fixed-A-rolls-rigid-thick-B-around-carrier-and-B-drives-coaxial-E-F-G-at-forward-stationary-reverse-rates';
  root.userData.blocks = {
    carrierBar,
    carrierCD,
    carrierHandle,
    carrierIndex,
    carrierPivots,
    contactMarkers,
    fixedA,
    inputRowB,
    intermediateRows,
    intermediateSleeve,
    labels,
    outputIndices,
    outputPin,
    outputs,
    stationaryStud,
    supportBase,
    supportPedestal,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.31, -1.86, -4.31),
    new THREE.Vector3(4.31, 1.45, 4.31),
  );
  root.userData.canonicalTimes = {
    carrierHalfTurn: nominalCarrierPeriod / 2,
    carrierQuarterTurn: nominalCarrierPeriod / 4,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    dependentIntermediateCoordinates: 1,
    dependentOutputCoordinates: 3,
    independentCarrierInputs: 1,
  };
  root.userData.geometry = {
    carrierPinSpacing,
    carrierPlaneY,
    fixedModule,
    fixedPitchRadius,
    gearDepth,
    intermediateInputPitchRadius,
    layerY,
    outputWorkingGeometry,
  };
  root.userData.meshes = [
    {
      centerDistance: carrierPinSpacing,
      first: 'A',
      firstPitchRadius: fixedPitchRadius,
      module: fixedModule,
      second: 'B-input-row',
      secondPitchRadius: intermediateInputPitchRadius,
      teeth: [fixedTeeth, intermediateTeeth],
    },
    ...['E', 'F', 'G'].map((label) => ({
      centerDistance: carrierPinSpacing,
      first: `B-${label}-row`,
      firstPitchRadius:
        outputWorkingGeometry[label].intermediatePitchRadius,
      module: outputWorkingGeometry[label].module,
      second: label,
      secondPitchRadius: outputWorkingGeometry[label].outputPitchRadius,
      teeth: [intermediateTeeth, outputTeeth[label]],
    })),
  ];
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    engineeringCorroboration: {
      detail:
        'NASA SP-8100 analyzes epicyclic trains in the carrier frame; applying its fixed-axis reduction to Brown’s 20-tooth fixed wheel gives output/carrier = 1 - 20/N for each loose output.',
      report: 'NASA SP-8100, Dynamics of Planetary Gear Trains (1984)',
      url: 'https://ntrs.nasa.gov/api/citations/19840017959/downloads/19840017959.pdf',
    },
    historicalConstructionCorroboration: {
      detail:
        'A 1947 Practical Mechanics construction article explicitly notes that equal-diameter output blanks with one tooth more or less are theoretically imperfect; the present reconstruction instead uses common-base-pitch involutes with adjusted output tooth thicknesses.',
      report: 'Practical Mechanics, “A Mechanical Paradox” (May–June 1947)',
      url: 'https://www.worldradiohistory.com/UK/Practical-Mechanics/40s/Practical-Mechanics-1947-05-06-S-OCR.pdf',
    },
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_504.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The official page marks Animated unavailable. Brown fixes A=20, F=20, E=21, G=19, one rigid thick intermediate B, pins M/N, carrier C-D, and the stationary/forward/reverse result, but gives no B count, pitches, dimensions, speed, or timing. B is reconstructed as one continuous 20-tooth profile with common base pitch across all outputs. Adjusted output tooth thicknesses and working pressure angles keep the center distances identical and every pitch contact slip-free. Output E is above F, which is above G, with A aligned to F. Tooth profiles, dimensions and carrier speed are reconstruction choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    carrierAngularSpeed,
    continuousUnwrappedRotation: true,
    fixedTeeth,
    intermediateAbsoluteRatio,
    intermediateTeeth,
    nominalCarrierPeriod,
    outputAbsoluteRatios,
    outputTeeth,
    exactSteppedWorkingBands: false,
    constantIntermediateProfile: true,
  };
  root.userData.cameraDistanceScale = 1.08;
  root.userData.groundFloorY = -1.84;

  const update = (time) => {
    const state = stateAtTime(time);
    carrierCD.rotation.y = state.carrierAngle;
    const intermediateLocalAngle = state.intermediateAbsoluteAngle
      - state.carrierAngle;
    intermediateRows.forEach((row) => {
      setSpin(row, intermediateLocalAngle);
    });
    for (const label of ['E', 'F', 'G']) {
      setSpin(outputs[label], state.outputs[label].localAngle);
    }

    labels.B.position.copy(state.intermediateCenter)
      .addScaledVector(state.tangent, -0.78);
    labels.M.position.copy(state.intermediateCenter)
      .addScaledVector(state.tangent, 0.72);
    labels.N.position.copy(state.outputCenter)
      .addScaledVector(state.tangent, 0.80);
    labels.C.position.copy(state.radial).multiplyScalar(0.42)
      .addScaledVector(state.tangent, -0.72);
    labels.D.position.copy(state.radial).multiplyScalar(3.67)
      .addScaledVector(state.tangent, -0.55);
    labels.E.position.copy(state.outputCenter)
      .addScaledVector(state.radial, 0.94)
      .addScaledVector(state.tangent, 0.52);
    labels.F.position.copy(state.outputCenter)
      .addScaledVector(state.radial, 1.00);
    labels.G.position.copy(state.outputCenter)
      .addScaledVector(state.radial, 0.94)
      .addScaledVector(state.tangent, -0.52);
    const labelHeights = {
      B: 1.08,
      C: 1.08,
      D: 1.08,
      E: -0.38,
      F: 0.08,
      G: 0.54,
      M: 1.08,
      N: 1.08,
    };
    for (const [label, height] of Object.entries(labelHeights)) {
      labels[label].position.y = height;
    }
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  correctEpicyclicFamily(root, movement.id);
  correctEpicyclic503504(root, movement.id);
  // Brown's side elevation shows the arm at rest along +x, from A's pedestal
  // to the outer end D. The view frames that pose whole and centred, plus
  // 2.2 of the turn to A's left, so the carried wheels leave the frame only
  // near the far side of the turn; in the near-orthographic side view the
  // sweep's depth barely projects, so the fit box uses a shallower depth.
  // The swept surfaces reach x +/-4.021, y -1.570 to 0.680.
  root.userData.sweptBounds = new THREE.Box3(
    new THREE.Vector3(-4.04, -1.59, -4.04),
    new THREE.Vector3(4.04, 0.70, 4.04),
  );
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.2, -1.59, -1.0),
    new THREE.Vector3(4.07, 0.70, 1.0),
  );
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.3, 1.3, 16),
  };
}

function fixedAnnulusSimplePlanetary(movement) {
  const root = new THREE.Group();
  const sunTeeth = 14;
  const planetTeeth = 11;
  const ringTeeth = 36;
  const module = 0.12;
  const sunPitchRadius = sunTeeth * module / 2;
  const planetPitchRadius = planetTeeth * module / 2;
  const ringPitchRadius = ringTeeth * module / 2;
  const planetCenterRadius = sunPitchRadius + planetPitchRadius;
  const gearDepth = 0.32;
  const toothHeight = module * 0.82;
  const carrierAngularSpeed = 0.62;
  const nominalCarrierPeriod = FULL_TURN / carrierAngularSpeed;
  const sunAbsoluteRatio = 1 + ringTeeth / sunTeeth;
  const planetAbsoluteRatio = 1 - ringTeeth / planetTeeth;
  const sunMountPhase = 0;
  const planetMountPhase = 0;
  const ringMountPhase = Math.PI / ringTeeth;

  if (ringTeeth !== sunTeeth + 2 * planetTeeth) {
    throw new Error('Simple planetary tooth counts do not close geometrically.');
  }

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.65,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.47,
  });
  const carrierMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.53,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const supportBase = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.55, 0.20, 1.10),
    frameMaterial,
  ), 'stationary-annular-train-support-base');
  supportBase.position.set(0, -3.25, -0.54);
  const rearPost = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 3.75, 0.30),
    frameMaterial,
  ), 'stationary-support-for-fixed-annular-wheel-C');
  rearPost.position.set(0, -1.50, -0.82);
  const centralStud = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 1.42, 28),
    darkMaterial,
  ), 'central-axis-shared-by-A-C-and-carrier-D');
  centralStud.rotation.x = Math.PI / 2;
  centralStud.position.z = 0.02;

  const fixedRingC = makeInvoluteInternalGear({
    addendum: module * 0.8,
    color: PALETTE.muted,
    dedendum: module * 1.05,
    depth: gearDepth,
    module,
    pressureAngle: 25 * Math.PI / 180,
    backlash: 0.0012,
    chamfer: 0,
    flankSamples: 32,
    tipSamples: 8,
    rootGapSamples: 8,
    outerRadius: ringPitchRadius + module * 3.0,
    pitchRadius: ringPitchRadius,
    teeth: ringTeeth,
  });
  fixedRingC.userData.fixed = true;
  fixedRingC.userData.isGear = true;
  fixedRingC.userData.sourceLabel = 'C';
  fixedRingC.userData.role = 'fixed-thirty-six-tooth-annular-wheel-C';
  setSpin(fixedRingC, ringMountPhase);

  const fixedRingClamps = [0, 1, 2].map((index) => {
    const angle = -Math.PI / 2 + (index - 1) * Math.PI * 0.58;
    const clamp = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.72, 0.18),
      frameMaterial,
    ), `fixed-annulus-C-clamp-${index + 1}`);
    clamp.position.set(
      Math.cos(angle) * (ringPitchRadius + 0.34),
      Math.sin(angle) * (ringPitchRadius + 0.34),
      -0.34,
    );
    clamp.rotation.z = angle - Math.PI / 2;
    clamp.userData.fixed = true;
    return clamp;
  });

  const sunA = makeGear({
    color: PALETTE.driven,
    depth: gearDepth,
    radius: sunPitchRadius,
    teeth: sunTeeth,
    toothHeight,
  });
  sunA.userData.isGear = true;
  sunA.userData.output = true;
  sunA.userData.sourceLabel = 'A';
  sunA.userData.role = 'fourteen-tooth-coaxial-output-sun-A';

  const sunOutputShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 1.62, 30),
    darkMaterial,
  ), 'output-shaft-rigid-with-sun-A');
  sunOutputShaft.rotation.x = Math.PI / 2;
  sunOutputShaft.position.z = 0.20;
  const sunOutputIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.07, 0.055),
    whiteMaterial,
  ), 'white-sun-A-output-speed-index');
  sunOutputIndex.position.set(0.34, 0, 0.91);
  sunA.userData.rotor.add(sunOutputShaft, sunOutputIndex);

  const carrierD = addRole(new THREE.Group(),
    'driven-arm-D-carrying-pinion-B');
  carrierD.userData.axis = Z_AXIS.clone();
  carrierD.userData.input = true;
  const carrierBar = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.16, 0.22, 0.16),
    carrierMaterial,
  ), 'rigid-arm-D-through-central-and-planet-axes');
  carrierBar.position.set(1.26, 0, 0.53);
  const carrierPivots = [
    ['central-arm-D-pivot', 0],
    ['planet-B-carrier-pin', planetCenterRadius],
  ].map(([role, x]) => {
    const pivot = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.30, 28),
      darkMaterial,
    ), role);
    pivot.rotation.x = Math.PI / 2;
    pivot.position.set(x, 0, 0.55);
    carrierD.add(pivot);
    return pivot;
  });
  const carrierHandle = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.20, 0.18),
    carrierMaterial,
  ), 'hand-driven-extension-of-arm-D');
  carrierHandle.position.set(2.83, 0, 0.53);
  const carrierIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.06, 0.035),
    whiteMaterial,
  ), 'white-arm-D-input-speed-index');
  carrierIndex.position.set(2.32, 0, 0.63);
  carrierD.add(carrierBar, carrierHandle, carrierIndex);

  const planetB = makeGear({
    color: PALETTE.accent,
    depth: gearDepth,
    radius: planetPitchRadius,
    teeth: planetTeeth,
    toothHeight,
  });
  planetB.position.x = planetCenterRadius;
  planetB.userData.carriedBy = 'D';
  planetB.userData.freeOnCarrierPin = true;
  planetB.userData.isGear = true;
  planetB.userData.sourceLabel = 'B';
  planetB.userData.role = 'eleven-tooth-carried-pinion-B';
  carrierD.add(planetB);

  const contactMarkers = [
    ['A-B-external', sunPitchRadius],
    ['B-C-internal', ringPitchRadius],
  ].map(([pair, x]) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.070, 18, 12),
      whiteMaterial,
    ), `pitch-contact-${pair}`);
    marker.position.set(x, 0, gearDepth * 0.62);
    marker.userData.pair = pair;
    carrierD.add(marker);
    return marker;
  });

  const labelMaterial = matte(PALETTE.ink, { roughness: 0.55 });
  const labels = Object.fromEntries(
    ['A', 'B', 'C', 'D'].map((letter) => [
      letter,
      makeSourceLetter(letter, labelMaterial),
    ]),
  );
  labels.A.position.set(-0.72, 0.68, 0.82);
  labels.C.position.set(-2.63, -1.87, 0.72);

  root.add(
    supportBase,
    rearPost,
    centralStud,
    ...fixedRingClamps,
    fixedRingC,
    sunA,
    carrierD,
    ...Object.values(labels),
  );

  const abPhaseConstant = sunTeeth * sunMountPhase
    + planetTeeth * planetMountPhase;
  const bcPhaseConstant = planetTeeth * planetMountPhase
    - ringTeeth * ringMountPhase;
  const stateAtTime = (time) => {
    // Start at the engraving's diagonal arm; preserve the same closed gear orbit.
    const carrierAngle = Math.PI / 4 + carrierAngularSpeed * time;
    const radial = new THREE.Vector3(
      Math.cos(carrierAngle),
      Math.sin(carrierAngle),
      0,
    );
    const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
    const planetCenter = radial.clone().multiplyScalar(planetCenterRadius);
    const planetCenterVelocity = tangent.clone().multiplyScalar(
      carrierAngularSpeed * planetCenterRadius,
    );
    const sunAbsoluteAngle = sunMountPhase
      + sunAbsoluteRatio * carrierAngle;
    const planetAbsoluteAngle = planetMountPhase
      + planetAbsoluteRatio * carrierAngle;
    const sunAbsoluteAngularSpeed = sunAbsoluteRatio
      * carrierAngularSpeed;
    const planetAbsoluteAngularSpeed = planetAbsoluteRatio
      * carrierAngularSpeed;
    const sunContact = radial.clone().multiplyScalar(sunPitchRadius);
    const planetInnerContact = planetCenter.clone().addScaledVector(
      radial,
      -planetPitchRadius,
    );
    const planetOuterContact = planetCenter.clone().addScaledVector(
      radial,
      planetPitchRadius,
    );
    const ringContact = radial.clone().multiplyScalar(ringPitchRadius);
    const sunContactVelocity = angularPointVelocity(
      new THREE.Vector3(),
      sunAbsoluteAngularSpeed,
      sunContact,
    );
    const planetInnerContactVelocity = angularPointVelocity(
      planetCenterVelocity,
      planetAbsoluteAngularSpeed,
      radial.clone().multiplyScalar(-planetPitchRadius),
    );
    const planetOuterContactVelocity = angularPointVelocity(
      planetCenterVelocity,
      planetAbsoluteAngularSpeed,
      radial.clone().multiplyScalar(planetPitchRadius),
    );
    return {
      carrierAngle,
      carrierAngularSpeed,
      contactPositionResiduals: {
        AB: sunContact.distanceTo(planetInnerContact),
        BC: planetOuterContact.distanceTo(ringContact),
      },
      meshPhaseResiduals: {
        AB: sunTeeth * (sunAbsoluteAngle - carrierAngle)
          + planetTeeth * (planetAbsoluteAngle - carrierAngle)
          - abPhaseConstant,
        BC: planetTeeth * (planetAbsoluteAngle - carrierAngle)
          - ringTeeth * (ringMountPhase - carrierAngle)
          - bcPhaseConstant,
      },
      planetAbsoluteAngle,
      planetAbsoluteAngularSpeed,
      planetCenter,
      planetCenterVelocity,
      planetLocalAngle: planetAbsoluteAngle - carrierAngle,
      radial,
      ringAbsoluteAngle: ringMountPhase,
      ringAbsoluteAngularSpeed: 0,
      sunAbsoluteAngle,
      sunAbsoluteAngularSpeed,
      tangent,
      velocityResiduals: {
        AB: sunContactVelocity.distanceTo(planetInnerContactVelocity),
        BC: planetOuterContactVelocity.length(),
      },
      willisResidual: sunTeeth
        * (sunAbsoluteAngularSpeed - carrierAngularSpeed)
        + ringTeeth * (0 - carrierAngularSpeed),
    };
  };

  root.userData.archetype =
    'fixed-annulus-36-driven-carrier-single-planet-11-output-sun-14';
  root.userData.mechanism =
    'fixed-annular-C-driven-arm-D-carried-pinion-B-and-fast-coaxial-sun-A-output';
  root.userData.blocks = {
    carrierBar,
    carrierD,
    carrierHandle,
    carrierIndex,
    carrierPivots,
    centralStud,
    contactMarkers,
    fixedRingC,
    fixedRingClamps,
    labels,
    planetB,
    rearPost,
    sunA,
    sunOutputIndex,
    sunOutputShaft,
    supportBase,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.45, -3.38, -1.12),
    new THREE.Vector3(3.45, 3.30, 1.04),
  );
  root.userData.canonicalTimes = {
    carrierHalfTurn: nominalCarrierPeriod / 2,
    carrierQuarterTurn: nominalCarrierPeriod / 4,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    dependentPlanetCoordinates: 1,
    dependentSunCoordinates: 1,
    independentCarrierInputs: 1,
    stationaryAnnulusCoordinates: 0,
  };
  root.userData.geometry = {
    gearDepth,
    module,
    planetCenterRadius,
    planetPitchRadius,
    ringPitchRadius,
    sunPitchRadius,
    toothHeight,
  };
  root.userData.meshes = [
    {
      centerDistance: planetCenterRadius,
      first: 'A',
      firstPitchRadius: sunPitchRadius,
      internal: false,
      second: 'B',
      secondPitchRadius: planetPitchRadius,
      teeth: [sunTeeth, planetTeeth],
    },
    {
      centerDistance: planetCenterRadius,
      first: 'B',
      firstPitchRadius: planetPitchRadius,
      internal: true,
      second: 'C',
      secondPitchRadius: ringPitchRadius,
      teeth: [planetTeeth, ringTeeth],
    },
  ];
  root.userData.sourceAnimation = {
    available: true,
    officialCanvasModelPresent: true,
    sourceUrl: movement.sourceUrl,
    usedAsMotionValidationOnly: true,
  };
  root.userData.sourceReference = {
    engineeringCorroboration: {
      detail:
        'KHK’s planetary-gear conditions require ring teeth = sun teeth + twice planet teeth; NASA SP-8100 supplies the carrier-frame reduction used for the signed Willis equation.',
      reports: [
        'KHK Technical Information, Internal Gears',
        'NASA SP-8100, Dynamics of Planetary Gear Trains (1984)',
      ],
      urls: [
        'https://khkgears.net/pdf/internal-tech.pdf',
        'https://ntrs.nasa.gov/api/citations/19840017959/downloads/19840017959.pdf',
      ],
    },
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_505.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'Brown fixes concentric sun A and annulus C, carried pinion B, arm D, and the choice that either A or C may be stationary. The official canvas outline resolves the compatible A=14, B=11, C=36 teeth used here. This model selects one mechanically closed configuration only: C fixed, D driven, A output; Brown’s alternative A-fixed configuration is documented but not instantiated simultaneously. Module, face widths, 0.62-rad/s carrier input, supports, labels, and colors are independently authored reconstruction choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    carrierAngularSpeed,
    continuousUnwrappedRotation: true,
    fixedMember: 'C',
    nominalCarrierPeriod,
    planetAbsoluteRatio,
    planetTeeth,
    ringTeeth,
    selectedConfiguration: 'C-fixed-D-input-A-output',
    sunAbsoluteRatio,
    sunTeeth,
    toothClosureEquation: 'ringTeeth = sunTeeth + 2 * planetTeeth',
  };
  root.userData.cameraDistanceScale = 1.08;
  root.userData.groundFloorY = -3.36;

  const update = (time) => {
    const state = stateAtTime(time);
    carrierD.rotation.z = state.carrierAngle;
    setSpin(sunA, state.sunAbsoluteAngle);
    setSpin(planetB, state.planetLocalAngle);
    setSpin(fixedRingC, ringMountPhase);

    labels.B.position.copy(state.planetCenter)
      .addScaledVector(state.tangent, 0.56);
    labels.D.position.copy(state.radial).multiplyScalar(2.88)
      .addScaledVector(state.tangent, 0.36);
    labels.B.position.z = 0.82;
    labels.D.position.z = 0.82;
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  correctEpicyclicFamily(root, movement.id);
  fit505SourceArm(root);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.3, 0.2, 16),
  };
}

// Brown's arm D is one slender bar with a broad central eye round A's boss,
// reaching about half the ring radius beyond C; there is no separate handle.
// The central eye is bored to clear the sun's output sleeve (outer .166).
function fit505SourceArm(root) {
  const b = root.userData.blocks;
  const g = root.userData.geometry;
  const replace = (mesh, geometry) => {
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  };
  const armEnd = 3.72;
  const outline = polygonClipping.union(
    poly([[0, -0.145], [armEnd, -0.145], [armEnd, 0.145], [0, 0.145]]),
    poly(circle([0, 0], 0.34, 96)),
    poly(circle([g.planetCenterRadius, 0], 0.23, 64)),
    poly(circle([armEnd, 0], 0.145, 48)),
  );
  // Pass 104: the eye is bored to the pivot hub's outer radius (less 0.0015,
  // so each hides the other's face) rather than to the hub's own bore,
  // whose face it duplicated in one cylinder (flicker at grazing angles).
  replace(b.carrierBar, plate(polygonClipping.difference(
    outline,
    poly(circle([0, 0], 0.2785, 96)),
    poly(circle([g.planetCenterRadius, 0], 0.091, 64)),
  ), 0.45, 0.61));
  b.carrierBar.position.set(0, 0, 0);
  const pivot = b.carrierPivots[0];
  replace(pivot, boredLatheGeometry([
    { radial: 0.28, axial: -0.15 },
    { radial: 0.28, axial: 0.15 },
  ], 0.171, 96));
  pivot.userData.boreRadius = 0.171;
  b.carrierHandle.removeFromParent();
  b.carrierHandle.geometry.dispose();
  b.carrierIndex.position.x = 2.9;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.90, -3.90, -0.72),
    new THREE.Vector3(3.90, 3.90, 1.04),
  );
}

function dualEndDrivenCompoundBevelDifferential(movement) {
  const root = new THREE.Group();
  const teeth = Object.freeze({
    a: 20,
    b: 40,
    c: 24,
    d: 16,
    e: 12,
    f: 20,
    g: 32,
    h: 24,
  });
  const module = 0.10;
  const pitchRadii = Object.freeze(Object.fromEntries(
    Object.entries(teeth).map(([label, count]) => [
      label,
      count * module / 2,
    ]),
  ));
  const bevelDepth = 0.24;
  const representativeConeDistance = 1.08;
  const differentialApex = new THREE.Vector3(0, 0.10, 0);
  const driverAngularSpeed = 1.35;
  const lowerBCSignedRatio = -teeth.a / teeth.b;
  const upperFGSignedRatio = teeth.h / teeth.g;
  const lowerBCAngularSpeed = lowerBCSignedRatio * driverAngularSpeed;
  const upperFGAngularSpeed = upperFGSignedRatio * driverAngularSpeed;
  const lowerAggregateWeight = teeth.c * teeth.e;
  const upperAggregateWeight = teeth.f * teeth.d;
  const aggregateWeight = lowerAggregateWeight + upperAggregateWeight;
  const carrierAngularSpeed = (
    lowerAggregateWeight * lowerBCAngularSpeed
      + upperAggregateWeight * upperFGAngularSpeed
  ) / aggregateWeight;
  const planetCompoundAngularSpeed = teeth.c / teeth.d
    * (lowerBCAngularSpeed - carrierAngularSpeed);
  const nominalCarrierPeriod = FULL_TURN / carrierAngularSpeed;
  const mountPhases = Object.freeze({
    driver: Math.PI,
    lowerBC: 0,
    planetDE: Math.PI / teeth.d,
    upperFG: 0,
  });

  const normalizedRay = (...terms) => {
    const ray = new THREE.Vector3();
    for (const [axis, scale] of terms) ray.addScaledVector(axis, scale);
    return ray.normalize().multiplyScalar(representativeConeDistance);
  };
  const fixedContactRays = Object.freeze({
    AB: normalizedRay([X_AXIS, -teeth.b], [Y_AXIS, -teeth.a]),
    HG: normalizedRay([X_AXIS, -teeth.g], [Y_AXIS, teeth.h]),
  });
  const phaseConstants = Object.freeze({
    AB: teeth.a * mountPhases.driver
      + teeth.b * mountPhases.lowerBC,
    CD: teeth.c * (mountPhases.lowerBC - 0)
      - teeth.d * mountPhases.planetDE,
    EF: teeth.e * mountPhases.planetDE
      + teeth.f * (mountPhases.upperFG - 0),
    HG: teeth.h * mountPhases.driver
      - teeth.g * mountPhases.upperFG,
  });

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.46,
  });
  const carrierMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const supportBase = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.20, 0.22, 4.70),
    frameMaterial,
  ), 'stationary-base-for-movement-506');
  supportBase.position.set(-0.55, -3.27, -0.18);
  const rearPost = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 5.92, 0.32),
    frameMaterial,
  ), 'stationary-rear-standard');
  rearPost.position.set(-4.06, -0.22, -1.72);
  const mainBearingBrackets = [-2.72, 2.72].map((y, index) => {
    const bracket = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(4.18, 0.23, 0.30),
      frameMaterial,
    ), `${index === 0 ? 'lower' : 'upper'}-main-shaft-bearing-bracket`);
    bracket.position.set(-2.00, y, -1.72);
    return bracket;
  });
  const mainBearingLinks = [-2.72, 2.72].map((y, index) => {
    const link = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.22, 1.72),
      frameMaterial,
    ), `${index === 0 ? 'lower' : 'upper'}-bearing-link-to-main-axis`);
    link.position.set(0, y, -0.86);
    return link;
  });
  const mainBearings = [-2.72, 2.72].map((y, index) => {
    const bearing = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.075, 10, 34),
      darkMaterial,
    ), `${index === 0 ? 'lower-m' : 'upper-n'}-main-shaft-bearing`);
    bearing.rotation.x = Math.PI / 2;
    bearing.position.set(0, y, 0);
    return bearing;
  });
  const driverBearing = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.075, 10, 34),
    darkMaterial,
  ), 'driver-shaft-A-bearing');
  driverBearing.rotation.y = Math.PI / 2;
  driverBearing.position.set(-3.76, 0, 0);
  const driverBearingPedestal = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 2.64, 0.28),
    frameMaterial,
  ), 'driver-A-bearing-pedestal');
  driverBearingPedestal.position.set(-3.76, -1.39, 0);

  const driverAH = addRole(new THREE.Group(),
    'input-shaft-A-rigid-with-bevel-wheels-a-and-h');
  driverAH.userData.axis = X_AXIS.clone();
  driverAH.userData.input = true;
  driverAH.userData.rigidAssembly = 'A-a-h';
  const driverShaftA = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 3.00, 28),
    darkMaterial,
  ), 'driver-shaft-A');
  driverShaftA.rotation.z = Math.PI / 2;
  driverShaftA.position.x = -3.05;
  driverShaftA.userData.sourceLabel = 'A';
  driverShaftA.userData.rigidAssembly = 'A-a-h';
  // Pass 92: Brown draws crank A with the usual turned handle standing out
  // from the crank's end. The crank is one flat plate (0.15 thick along A)
  // whose ends are circular arcs, concentric with the handle axis (radius
  // 0.17, a 0.07 margin round the handle's 0.10 foot) and with shaft A
  // (radius 0.13, round the 0.12 shaft). The handle (the shared turned
  // handle, 0.46 long, bulb 0.12) stands on the crank's outer face, its foot
  // sunk HANDLE_FOOT_EMBED into it.
  const CRANK_THROW = 1.02, CRANK_X = -4.49, CRANK_HALF_THICKNESS = 0.075;
  const crankArmPlan = plate(poly(crankArmOutline({
    handleX: CRANK_THROW, handleEndRadius: 0.17, hubEndRadius: 0.13,
  })), -CRANK_HALF_THICKNESS, CRANK_HALF_THICKNESS);
  // Plan x runs along the crank (world y), plan y across it (world z), and
  // the extrusion along shaft A (world x).
  crankArmPlan.applyMatrix4(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0),
  ));
  const crankArm = addRole(new THREE.Mesh(
    crankArmPlan,
    matte(PALETTE.driver, { metalness: 0.15, roughness: 0.54 }),
  ), 'hand-crank-rigid-with-driver-A');
  crankArm.position.x = CRANK_X;
  const crankGrip = addRole(new THREE.Mesh(
    // Pass 98: the grip runs on through the crank, flush with its inner face.
    standardTurnedHandleGeometry({ height: 0.46, bulbRadius: 0.12, footRadius: 0.10, shank: handleShank(2 * CRANK_HALF_THICKNESS) }),
    darkMaterial,
  ), 'driver-A-hand-grip');
  // The lathe axis (+y) turned to point out along -x, away from the machine.
  crankGrip.rotation.z = Math.PI / 2;
  // Offset of the handle's foot from the crank's mid-plane along A (kept
  // when the source-support correction moves the crank along A).
  crankGrip.userData.armOffsetX = -CRANK_HALF_THICKNESS + HANDLE_FOOT_EMBED;
  crankGrip.position.set(CRANK_X + crankGrip.userData.armOffsetX, CRANK_THROW, 0);
  crankGrip.userData.turnedHandle = { axis: [-1, 0, 0], foot: 0.10, height: 0.46, bulb: 0.12 };
  const inputIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.74, 0.055),
    whiteMaterial,
  ), 'white-driver-A-angular-speed-index');
  inputIndex.position.set(-4.36, 0.37, 0.10);

  const gearA = makeBevelGear({
    axis: X_AXIS,
    color: PALETTE.driver,
    depth: bevelDepth,
    radius: pitchRadii.a,
    teeth: teeth.a,
  });
  gearA.position.set(-pitchRadii.b, 0, 0);
  gearA.userData.isGear = true;
  gearA.userData.rigidAssembly = 'A-a-h';
  gearA.userData.sourceLabel = 'a';
  gearA.userData.role = 'twenty-tooth-lower-driver-bevel-a';
  const gearH = makeBevelGear({
    axis: X_AXIS,
    color: PALETTE.brass,
    depth: bevelDepth,
    radius: pitchRadii.h,
    teeth: teeth.h,
  });
  gearH.position.set(-pitchRadii.g, 0, 0);
  gearH.userData.isGear = true;
  gearH.userData.rigidAssembly = 'A-a-h';
  gearH.userData.sourceLabel = 'h';
  gearH.userData.role = 'twenty-four-tooth-upper-driver-bevel-h';
  driverAH.add(
    driverShaftA,
    crankArm,
    crankGrip,
    inputIndex,
    gearA,
    gearH,
  );

  const lowerBC = addRole(new THREE.Group(),
    'lower-loose-compound-b-c-on-shaft-m-n');
  lowerBC.userData.looseOnShaft = 'm-n';
  lowerBC.userData.rigidAssembly = 'b-c';
  const gearB = makeBevelGear({
    axis: Y_AXIS,
    color: PALETTE.driven,
    depth: bevelDepth,
    radius: pitchRadii.b,
    teeth: teeth.b,
  });
  gearB.position.set(0, -pitchRadii.a, 0);
  gearB.userData.isGear = true;
  gearB.userData.looseOnShaft = 'm-n';
  gearB.userData.rigidAssembly = 'b-c';
  gearB.userData.sourceLabel = 'b';
  gearB.userData.role = 'forty-tooth-lower-loose-bevel-b';
  const gearC = makeBevelGear({
    axis: Y_AXIS,
    color: PALETTE.driven,
    depth: bevelDepth,
    radius: pitchRadii.c,
    teeth: teeth.c,
  });
  gearC.position.copy(differentialApex)
    .addScaledVector(Y_AXIS, -pitchRadii.d);
  gearC.userData.isGear = true;
  gearC.userData.looseOnShaft = 'm-n';
  gearC.userData.rigidAssembly = 'b-c';
  gearC.userData.sourceLabel = 'c';
  gearC.userData.role = 'twenty-four-tooth-first-epicyclic-wheel-c';
  const lowerSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.82, 30),
    matte(PALETTE.driven, { metalness: 0.18, roughness: 0.50 }),
  ), 'loose-sleeve-rigidly-uniting-b-and-c');
  lowerSleeve.position.y = -1.05;
  lowerSleeve.userData.rigidAssembly = 'b-c';
  const lowerIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.055, 0.055),
    whiteMaterial,
  ), 'white-b-c-compound-speed-index');
  lowerIndex.position.set(0.46, -1.40, 0);
  lowerBC.add(gearB, gearC, lowerSleeve, lowerIndex);

  const upperFG = addRole(new THREE.Group(),
    'upper-loose-compound-f-g-on-shaft-m-n');
  upperFG.userData.looseOnShaft = 'm-n';
  upperFG.userData.rigidAssembly = 'f-g';
  const gearF = makeBevelGear({
    axis: Y_AXIS.clone().negate(),
    color: PALETTE.muted,
    depth: bevelDepth,
    radius: pitchRadii.f,
    teeth: teeth.f,
  });
  gearF.position.copy(differentialApex)
    .addScaledVector(Y_AXIS, pitchRadii.e);
  gearF.userData.isGear = true;
  gearF.userData.looseOnShaft = 'm-n';
  gearF.userData.rigidAssembly = 'f-g';
  gearF.userData.sourceLabel = 'f';
  gearF.userData.role = 'twenty-tooth-last-epicyclic-wheel-f';
  const gearG = makeBevelGear({
    axis: Y_AXIS.clone().negate(),
    color: PALETTE.muted,
    depth: bevelDepth,
    radius: pitchRadii.g,
    teeth: teeth.g,
  });
  gearG.position.set(0, pitchRadii.h, 0);
  gearG.userData.isGear = true;
  gearG.userData.looseOnShaft = 'm-n';
  gearG.userData.rigidAssembly = 'f-g';
  gearG.userData.sourceLabel = 'g';
  gearG.userData.role = 'thirty-two-tooth-upper-loose-bevel-g';
  const upperSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.88, 30),
    matte(PALETTE.muted, { metalness: 0.18, roughness: 0.50 }),
  ), 'loose-sleeve-rigidly-uniting-f-and-g');
  upperSleeve.position.y = 0.98;
  upperSleeve.userData.rigidAssembly = 'f-g';
  const upperIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.055, 0.055),
    whiteMaterial,
  ), 'white-f-g-compound-speed-index');
  upperIndex.position.set(0.44, 1.52, 0);
  upperFG.add(gearF, gearG, upperSleeve, upperIndex);

  const carrierKL = addRole(new THREE.Group(),
    'aggregate-output-carrier-k-l-rigid-with-shaft-m-n');
  carrierKL.userData.aggregateOutput = true;
  carrierKL.userData.axis = Y_AXIS.clone();
  carrierKL.userData.rigidAssembly = 'k-l-m-n';
  const carrierShaftMN = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 5.72, 28),
    darkMaterial,
  ), 'carrier-shaft-m-n');
  carrierShaftMN.userData.rigidAssembly = 'k-l-m-n';
  const carrierSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.72, 30),
    carrierMaterial,
  ), 'central-carrier-hub-k');
  carrierSleeve.position.y = differentialApex.y;
  const radialAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 2.72, 26),
    darkMaterial,
  ), 'radial-axle-l-for-rigid-compound-d-e');
  radialAxle.rotation.z = Math.PI / 2;
  radialAxle.position.set(1.20, differentialApex.y, 0);
  const outerCarrierHead = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.36, 28),
    carrierMaterial,
  ), 'outer-head-of-train-bearing-arm-l');
  outerCarrierHead.rotation.z = Math.PI / 2;
  outerCarrierHead.position.set(2.48, differentialApex.y, 0);
  const carrierBar = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.58, 0.16, 0.15),
    carrierMaterial,
  ), 'rigid-train-bearing-arm-k-l');
  carrierBar.position.set(1.29, differentialApex.y, 0.24);
  const carrierIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.06, 0.045),
    whiteMaterial,
  ), 'white-aggregate-carrier-speed-index');
  carrierIndex.position.set(1.88, 0.13, 0.34);
  carrierKL.add(
    carrierShaftMN,
    carrierSleeve,
    radialAxle,
    outerCarrierHead,
    carrierBar,
    carrierIndex,
  );

  const planetCompoundDE = addRole(new THREE.Group(),
    'carried-rigid-compound-bevel-wheels-d-e');
  planetCompoundDE.position.y = differentialApex.y;
  planetCompoundDE.userData.freeOnCarrierArm = 'k-l';
  planetCompoundDE.userData.rigidAssembly = 'd-e';
  const gearD = makeBevelGear({
    axis: X_AXIS.clone().negate(),
    color: PALETTE.accent,
    depth: bevelDepth,
    radius: pitchRadii.d,
    teeth: teeth.d,
  });
  gearD.position.set(pitchRadii.c, 0, 0);
  gearD.userData.carriedBy = 'k-l';
  gearD.userData.isGear = true;
  gearD.userData.rigidAssembly = 'd-e';
  gearD.userData.sourceLabel = 'd';
  gearD.userData.role = 'twenty-four-tooth-carried-compound-wheel-d';
  const gearE = makeBevelGear({
    axis: X_AXIS.clone().negate(),
    color: PALETTE.brass,
    depth: bevelDepth,
    radius: pitchRadii.e,
    teeth: teeth.e,
  });
  gearE.position.set(pitchRadii.f, 0, 0);
  gearE.userData.carriedBy = 'k-l';
  gearE.userData.isGear = true;
  gearE.userData.rigidAssembly = 'd-e';
  gearE.userData.sourceLabel = 'e';
  gearE.userData.role = 'sixteen-tooth-carried-compound-wheel-e';
  const compoundSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.74, 26),
    matte(PALETTE.accent, { metalness: 0.16, roughness: 0.52 }),
  ), 'sleeve-rigidly-uniting-d-and-e');
  compoundSleeve.rotation.z = Math.PI / 2;
  compoundSleeve.position.x = 1.11;
  compoundSleeve.userData.rigidAssembly = 'd-e';
  const planetIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.64, 0.05),
    whiteMaterial,
  ), 'white-d-e-compound-spin-index');
  planetIndex.position.set(1.14, 0.35, 0);
  planetCompoundDE.add(gearD, gearE, compoundSleeve, planetIndex);
  carrierKL.add(planetCompoundDE);

  const makeContactMarker = (pair, position) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 18, 12),
      whiteMaterial,
    ), `representative-${pair}-pitch-cone-contact`);
    marker.position.copy(position);
    marker.userData.pair = pair;
    return marker;
  };
  const fixedContactMarkers = [
    makeContactMarker('a-b', fixedContactRays.AB),
    makeContactMarker('h-g', fixedContactRays.HG),
  ];
  const carriedContactMarkers = [
    makeContactMarker('c-d', normalizedRay(
      [X_AXIS, teeth.c],
      [Y_AXIS, -teeth.d],
    ).add(differentialApex)),
    makeContactMarker('e-f', normalizedRay(
      [X_AXIS, teeth.f],
      [Y_AXIS, teeth.e],
    ).add(differentialApex)),
  ];
  carrierKL.add(...carriedContactMarkers);

  const labelMaterial = matte(PALETTE.ink, { roughness: 0.55 });
  const labels = Object.fromEntries(
    ['A', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n']
      .map((letter) => [letter, makeSourceLetter(letter, labelMaterial)]),
  );
  for (const [letter, label] of Object.entries(labels)) {
    if (letter !== 'A') label.scale.setScalar(0.78);
  }
  labels.A.position.set(-4.58, -0.18, 2.46);
  labels.a.position.set(-2.52, -1.22, 2.46);
  labels.h.position.set(-2.20, 1.35, 2.46);
  labels.b.position.set(-1.82, -1.92, 2.46);
  labels.c.position.set(-0.72, -1.54, 2.46);
  labels.f.position.set(-0.64, 0.57, 2.46);
  labels.g.position.set(-1.58, 1.74, 2.46);
  labels.m.position.set(0.30, -2.75, 2.46);
  labels.n.position.set(0.30, 2.70, 2.46);

  root.add(
    supportBase,
    rearPost,
    ...mainBearingBrackets,
    ...mainBearingLinks,
    ...mainBearings,
    driverBearing,
    driverBearingPedestal,
    driverAH,
    lowerBC,
    upperFG,
    carrierKL,
    ...fixedContactMarkers,
    ...Object.values(labels),
  );

  const stateAtTime = (time) => {
    const driverAngle = mountPhases.driver + driverAngularSpeed * time;
    const lowerBCAngle = mountPhases.lowerBC
      + lowerBCAngularSpeed * time;
    const upperFGAngle = mountPhases.upperFG
      + upperFGAngularSpeed * time;
    const carrierAngle = carrierAngularSpeed * time;
    const planetCompoundAngle = mountPhases.planetDE
      + planetCompoundAngularSpeed * time;
    const radial = new THREE.Vector3(
      Math.cos(carrierAngle),
      0,
      -Math.sin(carrierAngle),
    );
    const tangent = new THREE.Vector3().crossVectors(Y_AXIS, radial);
    const contactRays = {
      AB: fixedContactRays.AB.clone(),
      CD: normalizedRay(
        [radial, teeth.c],
        [Y_AXIS, -teeth.d],
      ),
      EF: normalizedRay(
        [radial, teeth.f],
        [Y_AXIS, teeth.e],
      ),
      HG: fixedContactRays.HG.clone(),
    };
    const angularVelocities = {
      driver: X_AXIS.clone().multiplyScalar(driverAngularSpeed),
      lowerBC: Y_AXIS.clone().multiplyScalar(lowerBCAngularSpeed),
      planetDE: Y_AXIS.clone().multiplyScalar(carrierAngularSpeed)
        .addScaledVector(radial, planetCompoundAngularSpeed),
      upperFG: Y_AXIS.clone().multiplyScalar(upperFGAngularSpeed),
    };
    const pointVelocity = (angularVelocity, point) =>
      new THREE.Vector3().crossVectors(angularVelocity, point);
    const gearCenters = {
      a: X_AXIS.clone().multiplyScalar(-pitchRadii.b),
      b: Y_AXIS.clone().multiplyScalar(-pitchRadii.a),
      c: differentialApex.clone()
        .addScaledVector(Y_AXIS, -pitchRadii.d),
      d: differentialApex.clone()
        .addScaledVector(radial, pitchRadii.c),
      e: differentialApex.clone()
        .addScaledVector(radial, pitchRadii.f),
      f: differentialApex.clone()
        .addScaledVector(Y_AXIS, pitchRadii.e),
      g: Y_AXIS.clone().multiplyScalar(pitchRadii.h),
      h: X_AXIS.clone().multiplyScalar(-pitchRadii.g),
    };
    const apexResidual = (
      center,
      direction,
      distance,
      apex = new THREE.Vector3(),
    ) => center.clone()
      .addScaledVector(direction, distance)
      .sub(apex)
      .length();
    return {
      aggregateEquationResidual:
        lowerAggregateWeight
          * (lowerBCAngularSpeed - carrierAngularSpeed)
        + upperAggregateWeight
          * (upperFGAngularSpeed - carrierAngularSpeed),
      angularVelocities,
      carrierAngle,
      carrierAngularSpeed,
      contactRays,
      driverAngle,
      driverAngularSpeed,
      gearCenters,
      lowerBCAngle,
      lowerBCAngularSpeed,
      meshPhaseResiduals: {
        AB: teeth.a * driverAngle + teeth.b * lowerBCAngle
          - phaseConstants.AB,
        CD: teeth.c * (lowerBCAngle - carrierAngle)
          - teeth.d * planetCompoundAngle - phaseConstants.CD,
        EF: teeth.e * planetCompoundAngle
          + teeth.f * (upperFGAngle - carrierAngle)
          - phaseConstants.EF,
        HG: teeth.h * driverAngle - teeth.g * upperFGAngle
          - phaseConstants.HG,
      },
      meshRateResiduals: {
        AB: teeth.a * driverAngularSpeed
          + teeth.b * lowerBCAngularSpeed,
        CD: teeth.c * (lowerBCAngularSpeed - carrierAngularSpeed)
          - teeth.d * planetCompoundAngularSpeed,
        EF: teeth.e * planetCompoundAngularSpeed
          + teeth.f * (upperFGAngularSpeed - carrierAngularSpeed),
        HG: teeth.h * driverAngularSpeed
          - teeth.g * upperFGAngularSpeed,
      },
      pitchConeApexResiduals: {
        a: apexResidual(gearCenters.a, X_AXIS, pitchRadii.b),
        b: apexResidual(gearCenters.b, Y_AXIS, pitchRadii.a),
        c: apexResidual(gearCenters.c, Y_AXIS, pitchRadii.d,
          differentialApex),
        d: apexResidual(gearCenters.d, radial.clone().negate(),
          pitchRadii.c, differentialApex),
        e: apexResidual(gearCenters.e, radial.clone().negate(),
          pitchRadii.f, differentialApex),
        f: apexResidual(gearCenters.f, Y_AXIS.clone().negate(),
          pitchRadii.e, differentialApex),
        g: apexResidual(gearCenters.g, Y_AXIS.clone().negate(),
          pitchRadii.h),
        h: apexResidual(gearCenters.h, X_AXIS, pitchRadii.g),
      },
      pitchVelocityResiduals: {
        AB: pointVelocity(angularVelocities.driver, contactRays.AB)
          .distanceTo(pointVelocity(
            angularVelocities.lowerBC,
            contactRays.AB,
          )),
        CD: pointVelocity(angularVelocities.lowerBC, contactRays.CD)
          .distanceTo(pointVelocity(
            angularVelocities.planetDE,
            contactRays.CD,
          )),
        EF: pointVelocity(angularVelocities.planetDE, contactRays.EF)
          .distanceTo(pointVelocity(
            angularVelocities.upperFG,
            contactRays.EF,
          )),
        HG: pointVelocity(angularVelocities.driver, contactRays.HG)
          .distanceTo(pointVelocity(
            angularVelocities.upperFG,
            contactRays.HG,
          )),
      },
      planetCompoundAngle,
      planetCompoundAngularSpeed,
      radial,
      tangent,
      upperFGAngle,
      upperFGAngularSpeed,
    };
  };

  root.userData.archetype =
    'dual-bevel-input-compounds-drive-compound-bevel-differential-carrier-output';
  root.userData.mechanism =
    'rigid-driver-a-h-drives-oppositely-signed-loose-b-c-and-f-g-end-compounds-whose-weighted-aggregate-rotates-carrier-k-l-m-n-through-carried-d-e';
  root.userData.blocks = {
    carrierBar,
    carrierIndex,
    carrierKL,
    carrierShaftMN,
    carrierSleeve,
    carriedContactMarkers,
    compoundSleeve,
    crankArm,
    crankGrip,
    driverAH,
    driverBearing,
    driverBearingPedestal,
    driverShaftA,
    fixedContactMarkers,
    gearA,
    gearB,
    gearC,
    gearD,
    gearE,
    gearF,
    gearG,
    gearH,
    inputIndex,
    labels,
    lowerBC,
    lowerIndex,
    lowerSleeve,
    mainBearingBrackets,
    mainBearingLinks,
    mainBearings,
    outerCarrierHead,
    planetCompoundDE,
    planetIndex,
    radialAxle,
    rearPost,
    supportBase,
    upperFG,
    upperIndex,
    upperSleeve,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.08, -3.43, -2.84),
    new THREE.Vector3(3.70, 2.94, 2.84),
  );
  root.userData.canonicalTimes = {
    carrierHalfTurn: nominalCarrierPeriod / 2,
    carrierQuarterTurn: nominalCarrierPeriod / 4,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    dependentCarrierCoordinates: 1,
    dependentLowerCompoundCoordinates: 1,
    dependentPlanetCompoundCoordinates: 1,
    dependentUpperCompoundCoordinates: 1,
    independentDriverInputs: 1,
  };
  root.userData.geometry = {
    bevelDepth,
    differentialApex: differentialApex.clone(),
    module,
    pitchRadii,
    representativeConeDistance,
  };
  root.userData.meshes = [
    {
      axesAngle: Math.PI / 2,
      first: 'a',
      pitchConeApex: new THREE.Vector3(),
      second: 'b',
      signedRateEquation: 'Na * omegaA + Nb * omegaBC = 0',
      teeth: [teeth.a, teeth.b],
    },
    {
      axesAngle: Math.PI / 2,
      first: 'h',
      pitchConeApex: new THREE.Vector3(),
      second: 'g',
      signedRateEquation: 'Nh * omegaA - Ng * omegaFG = 0',
      teeth: [teeth.h, teeth.g],
    },
    {
      axesAngle: Math.PI / 2,
      first: 'c',
      pitchConeApex: new THREE.Vector3(),
      second: 'd',
      signedRateEquation:
        'Nc * (omegaBC - omegaCarrier) - Nd * omegaDE = 0',
      teeth: [teeth.c, teeth.d],
    },
    {
      axesAngle: Math.PI / 2,
      first: 'e',
      pitchConeApex: new THREE.Vector3(),
      second: 'f',
      signedRateEquation:
        'Ne * omegaDE + Nf * (omegaFG - omegaCarrier) = 0',
      teeth: [teeth.e, teeth.f],
    },
  ];
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    engineeringCorroboration: {
      detail:
        'NASA SP-8100’s carrier-frame method gives the two opposed compound-bevel mesh equations and their tooth-weighted aggregate carrier speed.',
      report: 'NASA SP-8100, Dynamics of Planetary Gear Trains (1984)',
      url: 'https://ntrs.nasa.gov/api/citations/19840017959/downloads/19840017959.pdf',
    },
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_506.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The official page marks Animated unavailable. Brown fixes input shaft A with rigid a/h, loose rigid compounds b/c and f/g, carrier k/l rigid with shaft m/n, and carried rigid compound d/e, but supplies no tooth counts, pitch geometry, speed, or timing. This model instantiates Brown’s original configuration only, using disclosed reconstructed counts a=20, b=40, c=24, d=16, e=12, f=20, g=32, h=24 and a 1.35-rad/s driver. Brown’s later modified configuration, in which f/g are disunited and g is fixed to the carrier shaft, is documented but not superimposed. All four common-apex pitch constraints, signed speed ratios, and zero-slip contacts are exact; dimensions, supports, colors, and timing are reconstruction choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    aggregateCarrierLaw:
      'Nc * Ne * (omegaBC - omegaCarrier) + Nf * Nd * (omegaFG - omegaCarrier) = 0',
    aggregateWeight,
    carrierAngularSpeed,
    carrierToDriverRatio: carrierAngularSpeed / driverAngularSpeed,
    continuousUnwrappedRotation: true,
    driverAngularSpeed,
    lowerAggregateWeight,
    lowerBCAngularSpeed,
    lowerBCSignedRatio,
    nominalCarrierPeriod,
    planetCompoundAngularSpeed,
    planetCompoundToDriverRatio:
      planetCompoundAngularSpeed / driverAngularSpeed,
    selectedConfiguration: 'original-rigid-b-c-rigid-f-g',
    teeth,
    upperAggregateWeight,
    upperFGAngularSpeed,
    upperFGSignedRatio,
  };
  root.userData.cameraDistanceScale = 1.04;
  root.userData.groundFloorY = -3.39;

  const update = (time) => {
    const state = stateAtTime(time);
    driverAH.rotation.x = state.driverAngle;
    lowerBC.rotation.y = state.lowerBCAngle;
    upperFG.rotation.y = state.upperFGAngle;
    carrierKL.rotation.y = state.carrierAngle;
    planetCompoundDE.rotation.x = state.planetCompoundAngle;

    const labelDepth = 2.46;
    labels.d.position.copy(state.radial).multiplyScalar(1.78)
      .addScaledVector(state.tangent, 0.42)
      .addScaledVector(Y_AXIS, -0.46);
    labels.e.position.copy(state.radial).multiplyScalar(1.72)
      .addScaledVector(state.tangent, 0.12)
      .addScaledVector(Y_AXIS, 0.52);
    labels.k.position.copy(state.radial).multiplyScalar(0.24)
      .addScaledVector(Y_AXIS, -0.48);
    labels.l.position.copy(state.radial).multiplyScalar(2.72)
      .addScaledVector(Y_AXIS, 0.12);
    for (const label of [labels.d, labels.e, labels.k, labels.l]) {
      label.position.z = labelDepth;
    }
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  correctCompoundEpicyclic(root, movement.id);
  // Brown's 506 is a level elevation: a narrow field and a nearly level
  // direction keep the base from reading as a raised top face.
  root.userData.cameraFov = 12;
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.3, 0.15, 16.0),
  };
}

function twentyFiveThousandToOneEpicyclic(movement) {
  const root = new THREE.Group();
  const teeth = Object.freeze({
    A: 10,
    C: 100,
    D: 10,
    E: 61,
    F: 49,
    G: 41,
    H: 51,
  });
  const bevelModule = 0.05;
  const bevelPitchRadii = Object.freeze({
    A: teeth.A * bevelModule / 2,
    C: teeth.C * bevelModule / 2,
    D: teeth.D * bevelModule / 2,
  });
  // Brown's upper train spans most of the plate: the arm n-m is about 1.4
  // times the radius of wheel C, so F-E and G-H reach well past C's height.
  // The spur radii follow from this centre distance and the tooth counts;
  // 2530 * 11 / 8192 (about 3.40) keeps both layer modules, 253/4096 and
  // 605/8192, exact binary fractions so the pitch radii sum exactly.
  const carrierPinSpacing = 2530 * 11 / 8192;
  const layerModules = Object.freeze({
    EF: 2 * carrierPinSpacing / (teeth.E + teeth.F),
    GH: 2 * carrierPinSpacing / (teeth.G + teeth.H),
  });
  const spurPitchRadii = Object.freeze({
    E: teeth.E * layerModules.EF / 2,
    F: teeth.F * layerModules.EF / 2,
    G: teeth.G * layerModules.GH / 2,
    H: teeth.H * layerModules.GH / 2,
  });
  const layerY = Object.freeze({ EF: 3.68, GH: 3.15 });
  const bevelDepth = 0.25;
  const spurDepth = 0.18;
  const representativeConeDistance = 1.42;
  const upperProduct = teeth.E * teeth.G;
  const lowerProduct = teeth.H * teeth.F;
  const productDifference = upperProduct - lowerProduct;
  const bevelMultiplier = teeth.C / teeth.A;
  const carrierToSlowOutputRatio = bevelMultiplier
    * (upperProduct + lowerProduct) / productDifference;
  const carrierAngularSpeed = 0.60;
  const slowOutputAngularSpeed = carrierAngularSpeed
    / carrierToSlowOutputRatio;
  const shortSleeveAngularSpeed = -bevelMultiplier
    * slowOutputAngularSpeed;
  const longSleeveAngularSpeed = bevelMultiplier
    * slowOutputAngularSpeed;
  const planetCompoundAngularSpeed = carrierAngularSpeed
    - teeth.E / teeth.F
      * (longSleeveAngularSpeed - carrierAngularSpeed);
  const nominalCarrierPeriod = FULL_TURN / carrierAngularSpeed;
  const nominalSlowOutputPeriod = FULL_TURN / slowOutputAngularSpeed;
  const mountPhases = Object.freeze({
    carrier: Math.PI,
    longDE: 0,
    outputC: 0,
    planetFG: Math.PI / teeth.F,
    shortAH: 0,
  });
  const normalizedRay = (...terms) => {
    const ray = new THREE.Vector3();
    for (const [axis, scale] of terms) ray.addScaledVector(axis, scale);
    return ray.normalize().multiplyScalar(representativeConeDistance);
  };
  const bevelContactRays = Object.freeze({
    CA: normalizedRay([X_AXIS, teeth.A], [Y_AXIS, teeth.C]),
    CD: normalizedRay([X_AXIS, teeth.D], [Y_AXIS, -teeth.C]),
  });
  const phaseConstants = Object.freeze({
    CA: teeth.C * mountPhases.outputC
      + teeth.A * mountPhases.shortAH,
    CD: teeth.C * mountPhases.outputC
      - teeth.D * mountPhases.longDE,
    EF: teeth.E * (mountPhases.longDE - mountPhases.carrier)
      + teeth.F * (mountPhases.planetFG - mountPhases.carrier),
    HG: teeth.H * (mountPhases.shortAH - mountPhases.carrier)
      + teeth.G * (mountPhases.planetFG - mountPhases.carrier),
  });

  if (upperProduct !== 2501
      || lowerProduct !== 2499
      || carrierToSlowOutputRatio !== 25000) {
    throw new Error('Movement 507 tooth products do not produce 25,000:1.');
  }

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.21,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.29,
    roughness: 0.45,
  });
  const outputMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const carrierMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.53,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const supportBase = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.00, 0.22, 6.45),
    frameMaterial,
  ), 'stationary-base-for-movement-507');
  supportBase.position.set(0.42, -3.35, -0.10);
  const outputBearingPedestal = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 3.25, 0.34),
    frameMaterial,
  ), 'stationary-pedestal-for-slow-output-shaft-a');
  outputBearingPedestal.position.set(2.91, -1.66, -0.92);
  const outputBearingArm = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.24, 1.84),
    frameMaterial,
  ), 'slow-output-bearing-arm');
  outputBearingArm.position.set(2.91, -0.02, -0.02);
  const outputBearing = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.078, 10, 34),
    darkMaterial,
  ), 'bearing-for-horizontal-wheel-C-shaft-a');
  outputBearing.rotation.y = Math.PI / 2;
  outputBearing.position.set(2.91, 0, 0.88);
  const bottomMainBearing = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.27, 0.08, 10, 34),
    darkMaterial,
  ), 'bottom-bearing-p-of-fixed-main-shaft-m-p');
  bottomMainBearing.rotation.x = Math.PI / 2;
  bottomMainBearing.position.set(0, -3.00, 0);
  const fixedShaftMP = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 7.40, 30),
    darkMaterial,
  ), 'fixed-main-shaft-m-p');
  fixedShaftMP.position.y = 0.67;
  fixedShaftMP.userData.fixed = true;
  fixedShaftMP.userData.sourceLabels = ['m', 'p'];

  const outputCAssembly = addRole(new THREE.Group(),
    'very-slow-output-wheel-C-and-horizontal-shaft-a');
  outputCAssembly.userData.axis = X_AXIS.clone();
  outputCAssembly.userData.output = true;
  outputCAssembly.userData.rigidAssembly = 'C-a';
  const gearC = addRole(new THREE.Group(),
    'one-hundred-tooth-open-crown-wheel-C');
  gearC.position.x = bevelPitchRadii.A;
  gearC.userData.isGear = true;
  gearC.userData.output = true;
  gearC.userData.pitchRadius = bevelPitchRadii.C;
  gearC.userData.rigidAssembly = 'C-a';
  gearC.userData.sourceLabel = 'C';
  gearC.userData.teeth = teeth.C;
  const crownRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(
      bevelPitchRadii.C - 0.10,
      0.13,
      10,
      180,
    ),
    outputMaterial,
  ), 'open-rim-of-crown-wheel-C');
  crownRim.rotation.y = Math.PI / 2;
  const crownToothMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.51,
  });
  const crownToothGeometry = new THREE.BoxGeometry(
    bevelDepth,
    Math.PI * 2 * bevelPitchRadii.C / teeth.C * 0.54,
    bevelModule * 1.05,
  );
  const crownTeeth = Array.from({ length: teeth.C }, (_, index) => {
    const angle = FULL_TURN * index / teeth.C;
    const tooth = addRole(new THREE.Mesh(
      crownToothGeometry,
      crownToothMaterial,
    ), `crown-wheel-C-tooth-${index + 1}`);
    tooth.position.set(
      0,
      Math.cos(angle) * bevelPitchRadii.C,
      Math.sin(angle) * bevelPitchRadii.C,
    );
    tooth.rotation.x = angle - Math.PI / 2;
    tooth.userData.bevelTooth = true;
    tooth.userData.toothIndex = index;
    return tooth;
  });
  const crownSpokes = Array.from({ length: 6 }, (_, index) => {
    const angle = FULL_TURN * index / 6;
    // The spokes lie within the thin conical rim (local x -0.005 to 0.049)
    // and end just inside its 1.97 inner edge, clear of pinions A and D.
    const inner = new THREE.Vector3(
      0.022,
      Math.cos(angle) * 0.38,
      Math.sin(angle) * 0.38,
    );
    const outer = new THREE.Vector3(
      0.022,
      Math.cos(angle) * 2.0,
      Math.sin(angle) * 2.0,
    );
    return addRole(makeBeam(inner, outer, {
      color: PALETTE.driven,
      depth: 0.05,
      jointRadius: 0.001,
      thickness: 0.085,
    }), `crown-wheel-C-spoke-${index + 1}`);
  });
  // The hub stops 0.01 short of the long D-E sleeve on the main shaft.
  const crownHub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.235, 34),
    outputMaterial,
  ), 'crown-wheel-C-hub');
  crownHub.rotation.z = Math.PI / 2;
  crownHub.position.x = 0.0125;
  const outputShaftA = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 2.72, 30),
    darkMaterial,
  ), 'horizontal-slow-output-shaft-a');
  outputShaftA.rotation.z = Math.PI / 2;
  outputShaftA.position.x = 1.54;
  outputShaftA.userData.rigidAssembly = 'C-a';
  const outputIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 1.04, 0.075),
    whiteMaterial,
  ), 'white-index-showing-wheel-C-very-slow-motion');
  outputIndex.position.set(0.43, 0.68, 0);
  gearC.add(crownRim, ...crownTeeth, ...crownSpokes, crownHub);
  outputCAssembly.add(gearC, outputShaftA, outputIndex);

  const longSleeveDE = addRole(new THREE.Group(),
    'long-loose-sleeve-rigidly-carrying-D-and-E');
  longSleeveDE.userData.looseOnFixedShaft = 'm-p';
  longSleeveDE.userData.rigidAssembly = 'D-E';
  const longSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 6.38, 32),
    matte(PALETTE.muted, { metalness: 0.18, roughness: 0.52 }),
  ), 'long-sleeve-between-D-and-E');
  longSleeve.position.y = 0.57;
  longSleeve.userData.rigidAssembly = 'D-E';
  const gearD = makeBevelGear({
    axis: Y_AXIS,
    color: PALETTE.muted,
    depth: bevelDepth,
    radius: bevelPitchRadii.D,
    teeth: teeth.D,
  });
  gearD.position.set(0, -bevelPitchRadii.C, 0);
  gearD.userData.isGear = true;
  gearD.userData.rigidAssembly = 'D-E';
  gearD.userData.sourceLabel = 'D';
  gearD.userData.role = 'ten-tooth-lower-bevel-wheel-D';
  const gearE = makeGear({
    axis: Y_AXIS,
    color: PALETTE.muted,
    depth: spurDepth,
    radius: spurPitchRadii.E,
    teeth: teeth.E,
    toothHeight: layerModules.EF * 0.82,
  });
  gearE.position.set(0, layerY.EF, 0);
  gearE.userData.isGear = true;
  gearE.userData.looseOnFixedShaft = 'm-p';
  gearE.userData.rigidAssembly = 'D-E';
  gearE.userData.sourceLabel = 'E';
  gearE.userData.role = 'sixty-one-tooth-upper-wheel-E';
  const longSleeveIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.045, 0.045),
    whiteMaterial,
  ), 'white-D-E-sleeve-speed-index');
  longSleeveIndex.position.set(0.45, layerY.EF + 0.13, 0);
  longSleeveDE.add(longSleeve, gearD, gearE, longSleeveIndex);

  const shortSleeveAH = addRole(new THREE.Group(),
    'short-outer-sleeve-rigidly-carrying-A-and-H');
  shortSleeveAH.userData.fittedUpon = 'long-sleeve-D-E';
  shortSleeveAH.userData.rigidAssembly = 'A-H';
  const shortSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.255, 1.07, 32),
    matte(PALETTE.brass, { metalness: 0.17, roughness: 0.53 }),
  ), 'short-sleeve-between-A-and-H');
  shortSleeve.position.y = 2.83;
  shortSleeve.userData.rigidAssembly = 'A-H';
  const gearA = makeBevelGear({
    axis: Y_AXIS.clone().negate(),
    color: PALETTE.brass,
    depth: bevelDepth,
    radius: bevelPitchRadii.A,
    teeth: teeth.A,
  });
  gearA.position.set(0, bevelPitchRadii.C, 0);
  gearA.userData.isGear = true;
  gearA.userData.rigidAssembly = 'A-H';
  gearA.userData.sourceLabel = 'A';
  gearA.userData.role = 'ten-tooth-upper-bevel-wheel-A';
  const gearH = makeGear({
    axis: Y_AXIS,
    color: PALETTE.brass,
    depth: spurDepth,
    radius: spurPitchRadii.H,
    teeth: teeth.H,
    toothHeight: layerModules.GH * 0.82,
  });
  gearH.position.set(0, layerY.GH, 0);
  gearH.userData.fittedUpon = 'long-sleeve-D-E';
  gearH.userData.isGear = true;
  gearH.userData.rigidAssembly = 'A-H';
  gearH.userData.sourceLabel = 'H';
  gearH.userData.role = 'fifty-one-tooth-lower-wheel-H';
  const shortSleeveIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.045, 0.045),
    whiteMaterial,
  ), 'white-A-H-sleeve-speed-index');
  shortSleeveIndex.position.set(0.44, layerY.GH - 0.13, 0);
  shortSleeveAH.add(shortSleeve, gearA, gearH, shortSleeveIndex);

  const carrierMN = addRole(new THREE.Group(),
    'driven-train-bearing-arm-m-n');
  carrierMN.userData.axis = Y_AXIS.clone();
  carrierMN.userData.input = true;
  const carrierHub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.46, 32),
    carrierMaterial,
  ), 'carrier-hub-m-free-on-fixed-shaft');
  carrierHub.position.y = 4.17;
  const carrierArm = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.28, 0.19, 0.19),
    carrierMaterial,
  ), 'train-bearing-arm-m-n');
  carrierArm.position.set(carrierPinSpacing / 2, 4.17, 0);
  const planetStudN = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 1.56, 28),
    darkMaterial,
  ), 'carrier-stud-n-for-united-wheels-F-G');
  planetStudN.position.set(
    carrierPinSpacing,
    (layerY.EF + layerY.GH) / 2 + 0.08,
    0,
  );
  const outerCarrierHead = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.32, 28),
    carrierMaterial,
  ), 'outer-carrier-head-n');
  outerCarrierHead.position.set(carrierPinSpacing, 4.17, 0);
  const carrierIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.055, 0.045),
    whiteMaterial,
  ), 'white-carrier-input-speed-index');
  carrierIndex.position.set(1.42, 4.29, 0);
  carrierMN.add(
    carrierHub,
    carrierArm,
    planetStudN,
    outerCarrierHead,
    carrierIndex,
  );

  const planetCompoundFG = addRole(new THREE.Group(),
    'carried-united-wheels-F-and-G');
  planetCompoundFG.position.x = carrierPinSpacing;
  planetCompoundFG.userData.carriedBy = 'm-n';
  planetCompoundFG.userData.freeOnStud = 'n';
  planetCompoundFG.userData.rigidAssembly = 'F-G';
  const planetSleeve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.86, 28),
    matte(PALETTE.accent, { metalness: 0.16, roughness: 0.52 }),
  ), 'sleeve-rigidly-uniting-F-and-G');
  planetSleeve.position.y = (layerY.EF + layerY.GH) / 2;
  planetSleeve.userData.rigidAssembly = 'F-G';
  const gearF = makeGear({
    axis: Y_AXIS,
    color: PALETTE.accent,
    depth: spurDepth,
    radius: spurPitchRadii.F,
    teeth: teeth.F,
    toothHeight: layerModules.EF * 0.82,
  });
  gearF.position.set(0, layerY.EF, 0);
  gearF.userData.carriedBy = 'm-n';
  gearF.userData.isGear = true;
  gearF.userData.rigidAssembly = 'F-G';
  gearF.userData.sourceLabel = 'F';
  gearF.userData.role = 'forty-nine-tooth-carried-wheel-F';
  const gearG = makeGear({
    axis: Y_AXIS,
    color: PALETTE.accent,
    depth: spurDepth,
    radius: spurPitchRadii.G,
    teeth: teeth.G,
    toothHeight: layerModules.GH * 0.82,
  });
  gearG.position.set(0, layerY.GH, 0);
  gearG.userData.carriedBy = 'm-n';
  gearG.userData.isGear = true;
  gearG.userData.rigidAssembly = 'F-G';
  gearG.userData.sourceLabel = 'G';
  gearG.userData.role = 'forty-one-tooth-carried-wheel-G';
  const planetIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.045, 0.045),
    whiteMaterial,
  ), 'white-F-G-compound-spin-index');
  planetIndex.position.set(0.43, layerY.EF + 0.13, 0);
  planetCompoundFG.add(planetSleeve, gearF, gearG, planetIndex);
  carrierMN.add(planetCompoundFG);

  const makeContactMarker = (pair, position, parent = root) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.070, 18, 12),
      whiteMaterial,
    ), `representative-${pair}-pitch-contact`);
    marker.position.copy(position);
    marker.userData.pair = pair;
    parent.add(marker);
    return marker;
  };
  const bevelContactMarkers = [
    makeContactMarker('C-A', bevelContactRays.CA),
    makeContactMarker('C-D', bevelContactRays.CD),
  ];
  const spurContactMarkers = [
    makeContactMarker(
      'E-F',
      new THREE.Vector3(spurPitchRadii.E, layerY.EF, 0),
      carrierMN,
    ),
    makeContactMarker(
      'H-G',
      new THREE.Vector3(spurPitchRadii.H, layerY.GH, 0),
      carrierMN,
    ),
  ];

  const labelMaterial = matte(PALETTE.ink, { roughness: 0.55 });
  const labels = Object.fromEntries(
    ['A', 'C', 'D', 'E', 'F', 'G', 'H', 'a', 'm', 'n', 'p']
      .map((letter) => [letter, makeSourceLetter(letter, labelMaterial)]),
  );
  for (const letter of ['a', 'm', 'n', 'p']) {
    labels[letter].scale.setScalar(0.78);
  }
  const labelDepth = 2.88;
  labels.A.position.set(-0.48, 2.38, labelDepth);
  labels.C.position.set(2.80, 0.70, labelDepth);
  labels.D.position.set(-0.48, -2.42, labelDepth);
  labels.E.position.set(-1.46, 3.88, labelDepth);
  labels.H.position.set(-1.45, 2.96, labelDepth);
  labels.a.position.set(2.60, -0.36, labelDepth);
  labels.m.position.set(0.34, 4.48, labelDepth);
  labels.p.position.set(0.34, -3.02, labelDepth);

  root.add(
    supportBase,
    outputBearingPedestal,
    outputBearingArm,
    outputBearing,
    bottomMainBearing,
    fixedShaftMP,
    outputCAssembly,
    longSleeveDE,
    shortSleeveAH,
    carrierMN,
    ...Object.values(labels),
  );

  const stateAtTime = (time) => {
    const carrierAngle = mountPhases.carrier
      + carrierAngularSpeed * time;
    const slowOutputAngle = mountPhases.outputC
      + slowOutputAngularSpeed * time;
    const shortSleeveAngle = mountPhases.shortAH
      + shortSleeveAngularSpeed * time;
    const longSleeveAngle = mountPhases.longDE
      + longSleeveAngularSpeed * time;
    const planetCompoundAbsoluteAngle = mountPhases.planetFG
      + planetCompoundAngularSpeed * time;
    const planetCompoundLocalAngle = planetCompoundAbsoluteAngle
      - carrierAngle;
    const radial = new THREE.Vector3(
      Math.cos(carrierAngle),
      0,
      -Math.sin(carrierAngle),
    );
    const tangent = new THREE.Vector3().crossVectors(Y_AXIS, radial);
    const planetCenter = radial.clone().multiplyScalar(carrierPinSpacing);
    const planetCenterVelocity = tangent.clone().multiplyScalar(
      carrierAngularSpeed * carrierPinSpacing,
    );
    const efMainContact = radial.clone().multiplyScalar(spurPitchRadii.E)
      .addScaledVector(Y_AXIS, layerY.EF);
    const efPlanetContact = planetCenter.clone()
      .addScaledVector(radial, -spurPitchRadii.F)
      .addScaledVector(Y_AXIS, layerY.EF);
    const hgMainContact = radial.clone().multiplyScalar(spurPitchRadii.H)
      .addScaledVector(Y_AXIS, layerY.GH);
    const hgPlanetContact = planetCenter.clone()
      .addScaledVector(radial, -spurPitchRadii.G)
      .addScaledVector(Y_AXIS, layerY.GH);
    const longContactVelocity = axialPointVelocity(
      new THREE.Vector3(),
      Y_AXIS,
      longSleeveAngularSpeed,
      radial.clone().multiplyScalar(spurPitchRadii.E),
    );
    const shortContactVelocity = axialPointVelocity(
      new THREE.Vector3(),
      Y_AXIS,
      shortSleeveAngularSpeed,
      radial.clone().multiplyScalar(spurPitchRadii.H),
    );
    const planetEFContactVelocity = axialPointVelocity(
      planetCenterVelocity,
      Y_AXIS,
      planetCompoundAngularSpeed,
      radial.clone().multiplyScalar(-spurPitchRadii.F),
    );
    const planetGHContactVelocity = axialPointVelocity(
      planetCenterVelocity,
      Y_AXIS,
      planetCompoundAngularSpeed,
      radial.clone().multiplyScalar(-spurPitchRadii.G),
    );
    const outputAngularVelocity = X_AXIS.clone().multiplyScalar(
      slowOutputAngularSpeed,
    );
    const shortAngularVelocity = Y_AXIS.clone().multiplyScalar(
      shortSleeveAngularSpeed,
    );
    const longAngularVelocity = Y_AXIS.clone().multiplyScalar(
      longSleeveAngularSpeed,
    );
    const pointVelocity = (angularVelocity, point) =>
      new THREE.Vector3().crossVectors(angularVelocity, point);
    const bevelCenters = {
      A: Y_AXIS.clone().multiplyScalar(bevelPitchRadii.C),
      C: X_AXIS.clone().multiplyScalar(bevelPitchRadii.A),
      D: Y_AXIS.clone().multiplyScalar(-bevelPitchRadii.C),
    };
    return {
      aggregateEquationResidual:
        upperProduct * (longSleeveAngularSpeed - carrierAngularSpeed)
        - lowerProduct
          * (shortSleeveAngularSpeed - carrierAngularSpeed),
      bevelCenters,
      bevelPitchApexResiduals: {
        A: bevelCenters.A.clone()
          .addScaledVector(Y_AXIS, -bevelPitchRadii.C).length(),
        C: bevelCenters.C.clone()
          .addScaledVector(X_AXIS, -bevelPitchRadii.A).length(),
        D: bevelCenters.D.clone()
          .addScaledVector(Y_AXIS, bevelPitchRadii.C).length(),
      },
      carrierAngle,
      carrierAngularSpeed,
      contactPositionResiduals: {
        EF: efMainContact.distanceTo(efPlanetContact),
        HG: hgMainContact.distanceTo(hgPlanetContact),
      },
      longSleeveAngle,
      longSleeveAngularSpeed,
      meshPhaseResiduals: {
        CA: teeth.C * slowOutputAngle + teeth.A * shortSleeveAngle
          - phaseConstants.CA,
        CD: teeth.C * slowOutputAngle - teeth.D * longSleeveAngle
          - phaseConstants.CD,
        EF: teeth.E * (longSleeveAngle - carrierAngle)
          + teeth.F * (planetCompoundAbsoluteAngle - carrierAngle)
          - phaseConstants.EF,
        HG: teeth.H * (shortSleeveAngle - carrierAngle)
          + teeth.G * (planetCompoundAbsoluteAngle - carrierAngle)
          - phaseConstants.HG,
      },
      meshRateResiduals: {
        CA: teeth.C * slowOutputAngularSpeed
          + teeth.A * shortSleeveAngularSpeed,
        CD: teeth.C * slowOutputAngularSpeed
          - teeth.D * longSleeveAngularSpeed,
        EF: teeth.E
          * (longSleeveAngularSpeed - carrierAngularSpeed)
          + teeth.F
            * (planetCompoundAngularSpeed - carrierAngularSpeed),
        HG: teeth.H
          * (shortSleeveAngularSpeed - carrierAngularSpeed)
          + teeth.G
            * (planetCompoundAngularSpeed - carrierAngularSpeed),
      },
      pitchVelocityResiduals: {
        CA: pointVelocity(outputAngularVelocity, bevelContactRays.CA)
          .distanceTo(pointVelocity(
            shortAngularVelocity,
            bevelContactRays.CA,
          )),
        CD: pointVelocity(outputAngularVelocity, bevelContactRays.CD)
          .distanceTo(pointVelocity(
            longAngularVelocity,
            bevelContactRays.CD,
          )),
        EF: longContactVelocity.distanceTo(planetEFContactVelocity),
        HG: shortContactVelocity.distanceTo(planetGHContactVelocity),
      },
      planetCenter,
      planetCenterVelocity,
      planetCompoundAbsoluteAngle,
      planetCompoundAngularSpeed,
      planetCompoundLocalAngle,
      radial,
      shortSleeveAngle,
      shortSleeveAngularSpeed,
      slowOutputAngle,
      slowOutputAngularSpeed,
      tangent,
    };
  };

  root.userData.archetype =
    'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary';
  root.userData.mechanism =
    'carrier-m-n-drives-united-F-G-between-near-equal-product-E-H-branches-while-opposed-100-to-10-bevels-produce-one-C-turn-per-25000-carrier-turns';
  root.userData.blocks = {
    bevelContactMarkers,
    bottomMainBearing,
    carrierArm,
    carrierHub,
    carrierIndex,
    carrierMN,
    crownHub,
    crownRim,
    crownSpokes,
    crownTeeth,
    fixedShaftMP,
    gearA,
    gearC,
    gearD,
    gearE,
    gearF,
    gearG,
    gearH,
    labels,
    longSleeve,
    longSleeveDE,
    longSleeveIndex,
    outerCarrierHead,
    outputBearing,
    outputBearingArm,
    outputBearingPedestal,
    outputCAssembly,
    outputIndex,
    outputShaftA,
    planetCompoundFG,
    planetIndex,
    planetSleeve,
    planetStudN,
    shortSleeve,
    shortSleeveAH,
    shortSleeveIndex,
    spurContactMarkers,
    supportBase,
  };
  // The planet wheels F, G orbit m out to 4.970 (actual surfaces). The view
  // frames Brown's pose (arm n m and F, G reaching left of the shaft) whole,
  // plus 2.75 of the orbit to the shaft's right, so F, G and the arm leave
  // the frame only near the far side of their turn. In the flat front
  // elevation the orbit's depth barely projects, so the fit box keeps a
  // shallow depth.
  root.userData.sweptBounds = new THREE.Box3(
    new THREE.Vector3(-4.99, -3.48, -4.99),
    new THREE.Vector3(4.99, 4.42, 4.99),
  );
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.99, -3.48, -1.0),
    new THREE.Vector3(2.75, 4.42, 1.0),
  );
  root.userData.canonicalTimes = {
    carrierHalfTurn: nominalCarrierPeriod / 2,
    carrierQuarterTurn: nominalCarrierPeriod / 4,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    dependentLongSleeveCoordinates: 1,
    dependentPlanetCompoundCoordinates: 1,
    dependentShortSleeveCoordinates: 1,
    dependentSlowOutputCoordinates: 1,
    independentCarrierInputs: 1,
    stationaryShaftCoordinates: 0,
  };
  root.userData.geometry = {
    bevelDepth,
    bevelModule,
    bevelPitchRadii,
    carrierPinSpacing,
    layerModules,
    layerY,
    representativeConeDistance,
    spurDepth,
    spurPitchRadii,
  };
  root.userData.meshes = [
    {
      axesAngle: Math.PI / 2,
      first: 'C',
      pitchConeApex: new THREE.Vector3(),
      second: 'A',
      signedRateEquation: 'NC * omegaC + NA * omegaAH = 0',
      teeth: [teeth.C, teeth.A],
      type: 'bevel',
    },
    {
      axesAngle: Math.PI / 2,
      first: 'C',
      pitchConeApex: new THREE.Vector3(),
      second: 'D',
      signedRateEquation: 'NC * omegaC - ND * omegaDE = 0',
      teeth: [teeth.C, teeth.D],
      type: 'bevel',
    },
    {
      centerDistance: carrierPinSpacing,
      first: 'E',
      firstPitchRadius: spurPitchRadii.E,
      module: layerModules.EF,
      second: 'F',
      secondPitchRadius: spurPitchRadii.F,
      signedRateEquation:
        'NE * (omegaDE - omegaCarrier) + NF * (omegaFG - omegaCarrier) = 0',
      teeth: [teeth.E, teeth.F],
      type: 'external-spur',
    },
    {
      centerDistance: carrierPinSpacing,
      first: 'H',
      firstPitchRadius: spurPitchRadii.H,
      module: layerModules.GH,
      second: 'G',
      secondPitchRadius: spurPitchRadii.G,
      signedRateEquation:
        'NH * (omegaAH - omegaCarrier) + NG * (omegaFG - omegaCarrier) = 0',
      teeth: [teeth.H, teeth.G],
      type: 'external-spur',
    },
  ];
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    engineeringCorroboration: {
      detail:
        'NASA SP-8100’s carrier-frame method gives the two external compound-planet equations; eliminating F/G exposes the 2501 versus 2499 product difference and the exact 25,000:1 reduction.',
      report: 'NASA SP-8100, Dynamics of Planetary Gear Trains (1984)',
      url: 'https://ntrs.nasa.gov/api/citations/19840017959/downloads/19840017959.pdf',
    },
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_507.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The official page marks Animated unavailable. Brown explicitly supplies A=10, C=100, D=10, E=61, F=49, G=41, H=51 and 25,000 carrier revolutions per C revolution, but gives no pitch dimensions, driving member, speed, or timing. This model selects the useful reduction mode with carrier m/n driven at 0.60 rad/s and wheel C as the very-slow output. The opposed C-A and C-D bevel signs, rigid D/E, A/H, and F/G sleeves, and both carrier-frame spur equations are exact. Because 61+49 and 51+41 differ, the two spur layers use disclosed layer-specific modules to share one exact carrier-pin spacing; supports, colors, face widths, and timing are reconstruction choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    aggregateCarrierLaw:
      'NE * NG * (omegaDE - omegaCarrier) - NH * NF * (omegaAH - omegaCarrier) = 0',
    bevelMultiplier,
    carrierAngularSpeed,
    carrierToSlowOutputRatio,
    continuousUnwrappedRotation: true,
    longSleeveAngularSpeed,
    longSleeveToCarrierRatio:
      longSleeveAngularSpeed / carrierAngularSpeed,
    lowerProduct,
    nominalCarrierPeriod,
    nominalSlowOutputPeriod,
    planetCompoundAngularSpeed,
    planetCompoundToCarrierRatio:
      planetCompoundAngularSpeed / carrierAngularSpeed,
    productDifference,
    selectedConfiguration: 'carrier-input-C-very-slow-output',
    shortSleeveAngularSpeed,
    shortSleeveToCarrierRatio:
      shortSleeveAngularSpeed / carrierAngularSpeed,
    slowOutputAngularSpeed,
    slowOutputToCarrierRatio:
      slowOutputAngularSpeed / carrierAngularSpeed,
    teeth,
    upperProduct,
  };
  root.userData.cameraDistanceScale = 1.03;
  root.userData.groundFloorY = -3.47;

  const update = (time) => {
    const state = stateAtTime(time);
    outputCAssembly.rotation.x = state.slowOutputAngle;
    shortSleeveAH.rotation.y = state.shortSleeveAngle;
    longSleeveDE.rotation.y = state.longSleeveAngle;
    carrierMN.rotation.y = state.carrierAngle;
    planetCompoundFG.rotation.y = state.planetCompoundLocalAngle;

    labels.F.position.copy(state.planetCenter)
      .addScaledVector(state.tangent, 0.32)
      .addScaledVector(Y_AXIS, layerY.EF + 0.28);
    labels.G.position.copy(state.planetCenter)
      .addScaledVector(state.tangent, 0.30)
      .addScaledVector(Y_AXIS, layerY.GH - 0.28);
    labels.n.position.copy(state.planetCenter)
      .addScaledVector(state.tangent, 0.28)
      .addScaledVector(Y_AXIS, 4.45);
    for (const label of [labels.F, labels.G, labels.n]) {
      label.position.z = labelDepth;
    }
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  correctCompoundEpicyclic(root, movement.id);
  // Brown draws no white speed or phase indices: drop the wheel, sleeve,
  // carrier and output indices from the scene (their blocks stay for review).
  {
    const indices = [outputIndex, longSleeveIndex, shortSleeveIndex,
      carrierIndex, planetIndex];
    for (const gear of [gearA, gearD, gearE, gearF, gearG, gearH]) {
      const rotor = gear.userData.rotor ?? gear;
      for (const child of rotor.children) {
        if (child.isMesh && !child.userData.role
          && child.geometry?.type === 'BoxGeometry'
          && child.material?.color?.getHex() === PALETTE.white) {
          indices.push(child);
        }
      }
    }
    for (const index of indices) index?.removeFromParent();
  }
  // Brown's flat front elevation: a narrow view avoids looking down on E-H.
  root.userData.cameraFov = 10;
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.7, 0.35, 18.0),
  };
}

// Pass 96: 502, 504, 505 and 507 carry wheels or an arm round a fixed axis,
// so their default view is fitted to the whole swept envelope (the carried
// parts' orbit), not to a partial box that let B, the left train, arm D or
// the E/F wheels leave the square frame at mid-cycle. 502, 504 and 507
// already record that envelope as sweptBounds; 505's is sampled over one
// full carrier turn.
function fitSweptEnvelope(model) {
  const d = model.root.userData;
  let swept = d.sweptBounds?.clone();
  if (!swept) {
    const turn = 2 * d.canonicalTimes.carrierHalfTurn;
    swept = new THREE.Box3();
    for (let i = 0; i <= 96; i += 1) {
      model.update(turn * i / 96);
      model.root.updateMatrixWorld(true);
      model.root.traverseVisible((o) => { if (o.isMesh) swept.union(new THREE.Box3().setFromObject(o, true)); });
    }
    model.update(0);
    model.root.updateMatrixWorld(true);
    swept.expandByScalar(0.05);
    d.sweptBounds = swept.clone();
  }
  d.cameraFitBounds = swept;
  return model;
}

export function createAuthoredEpicyclicTrainMovement(movement) {
  if (movement.id === 502) return fitSweptEnvelope(compoundOutputEpicyclic(movement));
  if (movement.id === 503) return bevelDifferentialEpicyclic(movement);
  if (movement.id === 504) return fitSweptEnvelope(fergusonMechanicalParadox(movement));
  if (movement.id === 505) return fitSweptEnvelope(fixedAnnulusSimplePlanetary(movement));
  if (movement.id === 506) {
    return dualEndDrivenCompoundBevelDifferential(movement);
  }
  if (movement.id === 507) return fitSweptEnvelope(twentyFiveThousandToOneEpicyclic(movement));
  return null;
}
