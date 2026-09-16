import { correctEntwistleGearing } from './capstan-entwistle-corrections.js';
import * as THREE from 'three';
import { makeMiterGear } from './authored-gears.js';
import {
  PALETTE,
  makeBeam,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function annulusGeometry(outerRadius, boreRadius, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.025,
    bevelOffset: -0.025,
    bevelThickness: 0.025,
    curveSegments: 64,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function entwistlePatentGearing(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const carrierAxis = X_AXIS.clone();
  const fixedGearAxis = X_AXIS.clone();
  const outputGearAxis = X_AXIS.clone().negate();
  const planetAxisAtSource = Y_AXIS.clone();
  const apex = new THREE.Vector3(0, 0.62, 0);
  const teeth = 20;
  const innerDistance = 0.31;
  const outerDistance = 1.26;
  const toothHeight = 0.22;
  const toothPitch = fullTurn / teeth;
  const contactDistance = (innerDistance + outerDistance) / 2;
  const shaftRadius = 0.085;
  const looseBoreRadius = 0.14;
  const cycleDuration = 6;
  const carrierAngularSpeed = fullTurn / cycleDuration;

  const fixedGearA = makeMiterGear({
    axis: fixedGearAxis,
    boreRadius: looseBoreRadius,
    color: PALETTE.accent,
    innerDistance,
    outerDistance,
    teeth,
    toothHeight,
  });
  fixedGearA.position.copy(apex);
  fixedGearA.userData.connection = 'fixed-to-right-hand-standard';
  fixedGearA.userData.fixed = true;
  fixedGearA.userData.role = 'fixed-equal-bevel-gear-A';

  const outputGearC = makeMiterGear({
    axis: outputGearAxis,
    boreRadius: looseBoreRadius,
    color: PALETTE.driven,
    innerDistance,
    outerDistance,
    teeth,
    toothHeight,
  });
  outputGearC.position.copy(apex);
  outputGearC.userData.connection = 'fast-with-output-drum-C-prime';
  outputGearC.userData.looseOnShaftD = true;
  outputGearC.userData.role = 'loose-equal-bevel-output-gear-C';

  const planetGearB = makeMiterGear({
    axis: planetAxisAtSource,
    boreRadius: 0.074,
    color: PALETTE.driver,
    innerDistance,
    outerDistance,
    teeth,
    toothHeight,
  });
  planetGearB.position.copy(apex);
  planetGearB.userData.connection = 'free-to-spin-on-carried-stud-E';
  planetGearB.userData.role = 'carried-equal-bevel-planet-B';

  const carrierAssembly = addRole(
    new THREE.Group(),
    'input-shaft-D-and-radial-stud-E-carrier',
  );
  carrierAssembly.position.copy(apex);
  const shaftD = makeShaft({
    axis: carrierAxis,
    color: PALETTE.ink,
    length: 7.8,
    radius: shaftRadius,
  });
  shaftD.position.set(0, 0, 0);
  shaftD.userData.role = 'rotating-input-shaft-D';
  const studE = makeShaft({
    axis: planetAxisAtSource,
    color: PALETTE.ink,
    length: 1.55,
    radius: 0.072,
  });
  studE.position.copy(planetAxisAtSource).multiplyScalar(0.78);
  studE.userData.role = 'stud-E-fixed-radially-in-shaft-D';
  const carrierCollar = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.32, 32),
    matte(PALETTE.brass, { metalness: 0.25, roughness: 0.43 }),
  ), 'carrier-collar-securing-stud-E-to-shaft-D');
  carrierCollar.rotation.z = Math.PI / 2;
  carrierCollar.position.set(0, 0, 0);
  const carrierIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.72, 0.07),
    matte(PALETTE.white, { roughness: 0.42 }),
  ), 'visible-input-carrier-index');
  carrierIndex.position.set(2.95, 0.39, 0);
  planetGearB.position.set(0, 0, 0);
  carrierAssembly.add(
    shaftD,
    studE,
    carrierCollar,
    carrierIndex,
    planetGearB,
  );

  const outputAssembly = addRole(
    new THREE.Group(),
    'loose-output-C-and-attached-drum-C-prime',
  );
  outputAssembly.position.copy(apex);
  outputGearC.position.set(0, 0, 0);
  outputAssembly.add(outputGearC);
  const outputSleeve = addRole(new THREE.Mesh(
    annulusGeometry(0.245, 0.115, 2.25),
    matte(PALETTE.driven, { metalness: 0.22, roughness: 0.5 }),
  ), 'output-sleeve-running-loose-around-shaft-D');
  outputSleeve.rotation.y = -Math.PI / 2;
  outputSleeve.position.set(-1.88, 0, 0);
  outputSleeve.userData.boreRadius = 0.115;
  const outputDrum = addRole(new THREE.Mesh(
    annulusGeometry(0.78, 0.115, 1.06),
    matte(PALETTE.driven, { metalness: 0.18, roughness: 0.53 }),
  ), 'attached-output-drum-C-prime');
  outputDrum.rotation.y = -Math.PI / 2;
  outputDrum.position.set(-3.0, 0, 0);
  const drumFlangeMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.48,
  });
  const outputFlanges = [-3.53, -2.47].map((x, index) => {
    const flange = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.74, 0.075, 12, 54),
      drumFlangeMaterial,
    ), `output-drum-C-prime-flange-${index + 1}`);
    flange.rotation.y = Math.PI / 2;
    flange.position.set(x, 0, 0);
    return flange;
  });
  const outputIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.69, 0.065),
    matte(PALETTE.white, { roughness: 0.44 }),
  ), 'visible-two-times-speed-output-index');
  outputIndex.position.set(-3.55, 0.37, 0);
  outputAssembly.add(
    outputSleeve,
    outputDrum,
    ...outputFlanges,
    outputIndex,
  );

  const fixedMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.9, 0.24, 2.7),
    fixedMaterial,
  ), 'fixed-bedplate');
  base.position.set(0, -2.0, 0);
  base.userData.fixed = true;
  const rightStandard = makeBeam(
    new THREE.Vector3(2.64, -1.88, -0.9),
    new THREE.Vector3(2.64, apex.y, -0.34),
    { color: PALETTE.frame, thickness: 0.2, depth: 0.22 },
  );
  rightStandard.userData.fixed = true;
  rightStandard.userData.role = 'fixed-standard-carrying-gear-A';
  const fixedGearBrace = makeBeam(
    new THREE.Vector3(2.64, apex.y, -0.34),
    apex.clone().add(new THREE.Vector3(1.47, 0, -0.16)),
    { color: PALETTE.frame, thickness: 0.19, depth: 0.2 },
  );
  fixedGearBrace.userData.fixed = true;
  fixedGearBrace.userData.role = 'rigid-brace-preventing-gear-A-rotation';
  const bearingMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const bearings = [-3.72, 3.72].map((x, index) => {
    const bearing = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.065, 10, 42),
      bearingMaterial,
    ), `fixed-shaft-D-bearing-${index + 1}`);
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(x, apex.y, 0);
    bearing.userData.fixed = true;
    return bearing;
  });
  const bearingPosts = bearings.map((bearing, index) => {
    const post = makeBeam(
      new THREE.Vector3(bearing.position.x, -1.88, 0),
      bearing.position,
      { color: PALETTE.frame, thickness: 0.17, depth: 0.19 },
    );
    post.userData.fixed = true;
    post.userData.role = `fixed-bearing-post-${index + 1}`;
    return post;
  });

  const contactMarkerMaterial = matte(PALETTE.white, {
    roughness: 0.35,
  });
  const fixedContactMarker = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    contactMarkerMaterial,
  ), 'visible-A-to-B-pitch-contact');
  const outputContactMarker = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    contactMarkerMaterial,
  ), 'visible-B-to-C-pitch-contact');

  root.add(
    base,
    rightStandard,
    fixedGearBrace,
    ...bearings,
    ...bearingPosts,
    fixedGearA,
    carrierAssembly,
    outputAssembly,
    fixedContactMarker,
    outputContactMarker,
  );

  const stateAtCarrierAngle = (
    carrierAngle,
    angularSpeed = carrierAngularSpeed,
  ) => {
    const outputAngle = 2 * carrierAngle;
    const planetRelativeAngle = carrierAngle;
    const outputAngularSpeed = 2 * angularSpeed;
    const planetRelativeAngularSpeed = angularSpeed;
    const planetAxis = planetAxisAtSource.clone().applyAxisAngle(
      carrierAxis,
      carrierAngle,
    );
    const fixedContact = apex.clone()
      .addScaledVector(fixedGearAxis, contactDistance)
      .addScaledVector(planetAxis, contactDistance);
    const outputContact = apex.clone()
      .addScaledVector(outputGearAxis, contactDistance)
      .addScaledVector(planetAxis, contactDistance);
    const carrierAngularVelocity = carrierAxis.clone().multiplyScalar(
      angularSpeed,
    );
    const outputAngularVelocity = carrierAxis.clone().multiplyScalar(
      outputAngularSpeed,
    );
    const planetAngularVelocity = carrierAngularVelocity.clone()
      .addScaledVector(planetAxis, planetRelativeAngularSpeed);
    const velocityAt = (angularVelocity, point) => (
      new THREE.Vector3().crossVectors(
        angularVelocity,
        point.clone().sub(apex),
      )
    );
    const fixedGearContactVelocity = new THREE.Vector3();
    const planetAtFixedVelocity = velocityAt(
      planetAngularVelocity,
      fixedContact,
    );
    const outputGearContactVelocity = velocityAt(
      outputAngularVelocity,
      outputContact,
    );
    const planetAtOutputVelocity = velocityAt(
      planetAngularVelocity,
      outputContact,
    );
    return {
      carrierAngle,
      carrierAngularSpeed: angularSpeed,
      fixedContact,
      fixedGearAngle: 0,
      fixedGearAngularSpeed: 0,
      fixedGearContactVelocity,
      fixedMeshNoSlipError: fixedGearContactVelocity.distanceTo(
        planetAtFixedVelocity,
      ),
      outputAngle,
      outputAngularSpeed,
      outputContact,
      outputGearContactVelocity,
      outputMeshNoSlipError: outputGearContactVelocity.distanceTo(
        planetAtOutputVelocity,
      ),
      planetAngularVelocity,
      planetAtFixedVelocity,
      planetAtOutputVelocity,
      planetAxis,
      planetRelativeAngle,
      planetRelativeAngularSpeed,
      willisAngleInvariant: outputAngle - 2 * carrierAngle,
      willisVelocityInvariant: outputAngularSpeed - 2 * angularSpeed,
    };
  };
  const stateAtTime = (time) => stateAtCarrierAngle(
    carrierAngularSpeed * time,
    carrierAngularSpeed,
  );

  const sourceState = stateAtTime(0);
  const closureState = stateAtTime(cycleDuration);
  const sourceContactA = sourceState.fixedContact.clone();
  const sourceContactC = sourceState.outputContact.clone();
  const fixedMountPhase = 0;
  const outputMountPhase = 0;
  const planetMountPhase = toothPitch / 2;
  setSpin(fixedGearA, fixedMountPhase);
  setSpin(outputGearC, outputMountPhase);
  setSpin(planetGearB, planetMountPhase);

  root.userData.archetype =
    'entwistle-fixed-side-equal-miter-planetary-speed-doubler';
  root.userData.mechanism =
    'shaft-D-carries-stud-E-and-planet-B-around-fixed-A-while-B-spin-drives-loose-C-and-drum-C-prime-at-two-times-D';
  root.userData.blocks = {
    base,
    bearingPosts,
    bearings,
    carrierAssembly,
    carrierCollar,
    carrierIndex,
    contactMarkers: [fixedContactMarker, outputContactMarker],
    fixedGearA,
    fixedGearBrace,
    gears: [fixedGearA, planetGearB, outputGearC],
    outputAssembly,
    outputDrum,
    outputFlanges,
    outputGearC,
    outputIndex,
    outputSleeve,
    planetGearB,
    rightStandard,
    shaftD,
    studE,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.15, -3.02, -3.02),
    new THREE.Vector3(4.15, 3.02, 3.02),
  );
  root.userData.canonicalTimes = {
    carrierHalfTurn: cycleDuration / 2,
    carrierQuarterTurn: cycleDuration / 4,
    cycleClosure: cycleDuration,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    independentCarrierInputs: 1,
    independentOutputCoordinates: 0,
    independentPlanetSpinCoordinates: 0,
  };
  root.userData.geometry = {
    apex,
    carrierAxis,
    contactDistance,
    cycleDuration,
    fixedGearAxis,
    fixedMountPhase,
    innerDistance,
    looseBoreRadius,
    outerDistance,
    outputGearAxis,
    outputMountPhase,
    planetAxisAtSource,
    planetMountPhase,
    shaftRadius,
    sourceContactA,
    sourceContactC,
    teeth,
    toothHeight,
    toothPitch,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 495 page marks Animated unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    historicalCorroboration: {
      detail:
        'The Inventor’s Universal Educator explains that carrying B about fixed A gives B both revolution and axial rotation, and that those two motions give C two revolutions.',
      page: 26,
      title: 'The Inventor’s Universal Educator, Vol. I (1889)',
      url:
        'https://archive.org/details/inventorsunivers01diet/page/26/mode/2up',
    },
    officialDescription: movement.description,
    officialEngraving: {
      labels: {
        fixedBevel: 'A',
        planet: 'B',
        outputBevel: 'C',
        outputDrum: 'C-prime',
        shaft: 'D',
        stud: 'E',
      },
      sourceUrl: movement.sourceUrl,
    },
    reconstructionDisclosure:
      'Because the official animation is unavailable, dimensions and cycle speed are presentation choices; topology and the 0:1:2 equal-miter velocity relation follow Brown’s description and the 1889 explanation.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCarrierAngle = stateAtCarrierAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.groundFloorY = -2.12;
  root.userData.transmission = {
    allGearDiametersEqual: true,
    allGearToothCountsEqual: true,
    carrierAngularSpeed,
    carrierTurnsPerCycle: 1,
    fixedGearTurnsPerCycle: 0,
    fixedSideWillisEquation: 'omega_A + omega_C = 2 * omega_D',
    outputSpeedRatioToCarrier: 2,
    outputTurnsPerCycle: 2,
    planetRelativeSpeedRatioToCarrier: 1,
    planetRelativeTurnsPerCycle: 1,
    reverseDriveCarrierRatioToOutput: 0.5,
    verifiedCarrierClosure: (
      closureState.carrierAngle - sourceState.carrierAngle
    ) / fullTurn,
    verifiedOutputClosure: (
      closureState.outputAngle - sourceState.outputAngle
    ) / fullTurn,
  };
  root.userData.cameraDistanceScale = 1.04;

  const update = (time) => {
    const state = stateAtTime(time);
    carrierAssembly.rotation.x = state.carrierAngle;
    outputAssembly.rotation.x = state.outputAngle;
    setSpin(planetGearB, planetMountPhase + state.planetRelativeAngle);
    fixedContactMarker.position.copy(state.fixedContact);
    outputContactMarker.position.copy(state.outputContact);
    carrierAssembly.userData.angularSpeed = state.carrierAngularSpeed;
    fixedGearA.userData.angularSpeed = 0;
    outputAssembly.userData.angularSpeed = state.outputAngularSpeed;
    planetGearB.userData.relativeAngularSpeed =
      state.planetRelativeAngularSpeed;
    root.userData.contacts = {
      fixedAToPlanetB: {
        noSlipError: state.fixedMeshNoSlipError,
        point: state.fixedContact,
      },
      planetBToOutputC: {
        noSlipError: state.outputMeshNoSlipError,
        point: state.outputContact,
      },
    };
    root.userData.kinematics = state;
  };
  correctEntwistleGearing(root);
  update(0);
  root.userData.fidelity = 'authored';
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(2.8, 2.5, 12),
  };
}

export function createAuthoredEntwistleGearingMovement(movement) {
  if (movement.id !== 495) return null;
  return entwistlePatentGearing(movement);
}
