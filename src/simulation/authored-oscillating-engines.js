import * as THREE from 'three';
import { fitPistonGuide, boredJournal } from './piston-guide-parts.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween3D(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    delta.clone().normalize(),
  );
  return beam;
}

// A finite rectangular gland/cover with a passage along local Y.
export function rectangularRodPassageGeometry(width, height, depth, halfX, halfZ, offsetZ = 0) {
  const rectangle = (x0, z0, x1, z1) => poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  const geometry = plate(clip.difference(
    rectangle(-width / 2, -depth / 2, width / 2, depth / 2),
    rectangle(-halfX, offsetZ - halfZ, halfX, offsetZ + halfZ)), -height / 2, height / 2);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

// Brown draws the engine rails as bars broken off at both ends.
function brokenRailOutline(x0, x1, yTop, yBottom, jag) {
  const h = yTop - yBottom;
  return poly([
    [x0, yTop], [x1, yTop],
    [x1 - jag, yTop - h * 0.35], [x1 + jag * 0.6, yTop - h * 0.7], [x1, yBottom],
    [x0, yBottom],
    [x0 + jag * 0.6, yBottom + h * 0.3], [x0 - jag, yBottom + h * 0.65],
  ]);
}

// Shared solid construction for Movements 344 and 345. Source lengths are in
// official animation units; `towardP` is the sign of the cylinder's local Y
// that points from trunnion T toward crank pin P. The barrel is a closed,
// round, bored casting, so the piston is enclosed exactly as Brown shows it.
function buildSourceOscillatingEngine(o) {
  const s = o.sourceScale;
  const u = (value) => value * s;
  const towardP = o.towardP;
  const axisZ = 0.42;
  const crankLow = 0.06;
  const crankHigh = 0.26;
  const rodRadius = u(o.pistonRodHalfWidth);
  const rodBore = rodRadius + 0.006;
  const pinRadius = u(0.17);
  const shaftRadius = u(0.25);

  const frameMaterial = matte(PALETTE.frame, { metalness: 0.14, roughness: 0.69 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.25, roughness: 0.47 });
  const crankMaterial = matte(PALETTE.driver, { metalness: 0.10, roughness: 0.57 });
  const cylinderMaterial = matte(PALETTE.driven, { metalness: 0.10, roughness: 0.57 });
  const pistonMaterial = matte(0x4d8963, { metalness: 0.09, roughness: 0.59 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = o.frameRole;
  const rails = o.rails.map(({ bores, high, low, outline, role }) => {
    let shape = outline;
    for (const bore of bores) {
      shape = clip.difference(shape, poly(circle(bore.center, bore.radius, 96)));
    }
    const rail = new THREE.Mesh(plate(shape, low, high), frameMaterial);
    rail.userData.fixed = true;
    rail.userData.role = role;
    rail.userData.bores = bores.map(({ center, radius }) => ({ x: center[0], y: center[1], radius }));
    fixedFrame.add(rail);
    return rail;
  });

  const inputCrank = new THREE.Group();
  inputCrank.position.set(o.crankCenter.x, o.crankCenter.y, 0);
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role = o.crankRole;
  const r = o.crankRadius;
  const bossO = u(0.80);
  const bossP = u(0.55);
  const crankOutline = clip.union(
    poly(circle([0, 0], bossO, 96)),
    poly(circle([r, 0], bossP, 96)),
    poly([[0, bossO * 0.82], [r, bossP * 0.82], [r, -bossP * 0.82], [0, -bossO * 0.82]]),
  );
  const crankArm = new THREE.Mesh(plate(crankOutline, crankLow, crankHigh), crankMaterial);
  crankArm.userData.role = `${o.rolePrefix}link-shaped-crank-O-P`;
  const shaftBack = o.crankRailLow - 0.04;
  const shaftFront = crankHigh + 0.02;
  const crankShaft = cylinderAlongZ(shaftRadius, shaftFront - shaftBack, darkMaterial, 34);
  crankShaft.position.z = (shaftFront + shaftBack) / 2;
  crankShaft.userData.role = `${o.rolePrefix}live-crankshaft-O`;
  // Brown draws the crank plate over the rod eye. The crank is therefore
  // double-webbed: the shaft ends in the rear web, the rod eye rides the pin
  // between the webs, and the front web is carried by the pin alone, so the
  // rod can pass over the shaft axis at dead centre with nothing to cut.
  const frontWebLow = axisZ + 0.10 + 0.02;
  const frontWebHigh = frontWebLow + (crankHigh - crankLow);
  const crankFrontWeb = new THREE.Mesh(plate(crankOutline, frontWebLow, frontWebHigh), crankMaterial);
  crankFrontWeb.userData.role = `${o.rolePrefix}front-crank-web-over-rod-eye-O-P`;
  const shaftEndCap = cylinderAlongZ(shaftRadius, 0.04, darkMaterial, 34);
  shaftEndCap.position.z = frontWebHigh + 0.01;
  shaftEndCap.userData.role = `${o.rolePrefix}front-web-shaft-centre-boss`;
  const pinFront = frontWebHigh + 0.03;
  const crankPin = cylinderAlongZ(pinRadius, pinFront - crankLow, darkMaterial, 30);
  crankPin.position.set(r, 0, (pinFront + crankLow) / 2);
  crankPin.userData.role = `${o.rolePrefix}crank-pin-P-carried-by-crank`;
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(r, 0, axisZ);
  crankPinAnchor.userData.role = `analytic-${o.rolePrefix}direct-crank-pin-P`;
  inputCrank.add(crankArm, crankFrontWeb, shaftEndCap, crankShaft, crankPin, crankPinAnchor);

  const cylinderAssembly = new THREE.Group();
  cylinderAssembly.position.set(o.cylinderPivot.x, o.cylinderPivot.y, 0);
  cylinderAssembly.userData.axis = Z_AXIS.clone();
  cylinderAssembly.userData.role = o.cylinderRole;
  const localY = (sourceU) => towardP * u(sourceU);
  const axialSpan = (from, to) => [localY(from), localY(to)].sort((a, b) => a - b);
  const [boreLow, boreHigh] = axialSpan(o.boreFrom, o.boreTo);
  const barrel = new THREE.Mesh(boredLatheGeometry([
    { axial: boreLow, radial: u(o.barrelOuterRadius) },
    { axial: boreHigh, radial: u(o.barrelOuterRadius) },
  ], u(o.barrelInnerRadius), 72), cylinderMaterial);
  barrel.position.z = axisZ;
  barrel.userData.role = `${o.rolePrefix}closed-round-cylinder-barrel`;
  const cylinderEndPlates = o.covers.map(({ from, passage, role, to }) => {
    const [low, high] = axialSpan(from, to);
    const cover = new THREE.Mesh(passage
      ? boredLatheGeometry([{ axial: low, radial: u(o.coverRadius) },
        { axial: high, radial: u(o.coverRadius) }], rodBore, 72)
      : new THREE.CylinderGeometry(u(o.coverRadius), u(o.coverRadius), high - low, 72),
    cylinderMaterial);
    if (!passage) cover.position.y = (low + high) / 2;
    cover.position.z = axisZ;
    cover.userData.role = role;
    return cover;
  });
  const glandCollars = o.collars.map(({ height, radius, u: at }, index) => {
    const [low, high] = axialSpan(at - height / 2, at + height / 2);
    const collar = new THREE.Mesh(boredLatheGeometry([
      { axial: low, radial: u(radius) },
      { axial: high, radial: u(radius) },
    ], rodBore, 60), cylinderMaterial);
    collar.position.z = axisZ;
    collar.userData.role = `${o.rolePrefix}cylinder-gland-collar-${index + 1}`;
    return collar;
  });
  const cylinderTrunnion = new THREE.Group();
  const rearStubFront = axisZ - u(o.barrelOuterRadius) + 0.03;
  const rearStubBack = o.trunnionRailLow - 0.04;
  const rearStub = cylinderAlongZ(u(0.30), rearStubFront - rearStubBack, cylinderMaterial, 38);
  rearStub.position.z = (rearStubFront + rearStubBack) / 2;
  rearStub.userData.role = `${o.rolePrefix}rear-trunnion-stub-in-rail-bearing`;
  const frontBossBack = axisZ + u(o.barrelOuterRadius) - 0.03;
  const frontBossFront = axisZ + u(o.frontBossSurfaceRadius) + 0.08;
  const frontBoss = cylinderAlongZ(u(0.36), frontBossFront - frontBossBack, cylinderMaterial, 38);
  frontBoss.position.z = (frontBossFront + frontBossBack) / 2;
  frontBoss.userData.role = `${o.rolePrefix}front-trunnion-boss`;
  cylinderTrunnion.add(rearStub, frontBoss);
  cylinderTrunnion.userData.role = o.trunnionRole;
  const cylinderPivotAnchor = new THREE.Object3D();
  cylinderPivotAnchor.position.z = axisZ;
  cylinderPivotAnchor.userData.role = `analytic-${o.rolePrefix}cylinder-pivot-T`;
  const cylinderAxisAnchor = new THREE.Object3D();
  cylinderAxisAnchor.position.set(0, o.axisRayLocalY, axisZ);
  cylinderAxisAnchor.userData.role = `analytic-${o.rolePrefix}cylinder-axis-ray`;
  cylinderAssembly.add(barrel, ...cylinderEndPlates, ...glandCollars,
    cylinderTrunnion, cylinderPivotAnchor, cylinderAxisAnchor);

  const pistonAssembly = new THREE.Group();
  pistonAssembly.userData.axis = Z_AXIS.clone();
  pistonAssembly.userData.role = o.pistonRole;
  const visibleRodLength = o.pistonRodLength / s
    - o.pistonHeadThickness / 2 - o.pistonRodCrankClearance;
  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(rodRadius, rodRadius, u(visibleRodLength), 28),
    pistonMaterial,
  );
  pistonRod.position.set(0, -towardP * u(
    o.pistonRodCrankClearance + o.pistonRodLength / s - o.pistonHeadThickness / 2,
  ) / 2, axisZ);
  pistonRod.userData.role = `${o.rolePrefix}round-piston-rod-from-P`;
  const pistonHead = new THREE.Mesh(
    new THREE.CylinderGeometry(u(o.barrelInnerRadius) - 0.012,
      u(o.barrelInnerRadius) - 0.012, u(o.pistonHeadThickness), 60),
    pistonMaterial,
  );
  pistonHead.position.set(0, -towardP * o.pistonRodLength, axisZ);
  pistonHead.userData.role = `${o.rolePrefix}enclosed-piston-head`;
  const pistonCrankEye = boredJournal(u(0.36), pinRadius + 0.006, 0.20, pistonMaterial);
  pistonCrankEye.position.z = axisZ;
  pistonCrankEye.userData.role = `${o.rolePrefix}piston-rod-eye-at-P`;
  const pistonCrankAnchor = new THREE.Object3D();
  pistonCrankAnchor.position.z = axisZ;
  pistonCrankAnchor.userData.role = `analytic-${o.rolePrefix}piston-rod-crank-end-P`;
  const pistonHeadAnchor = new THREE.Object3D();
  pistonHeadAnchor.position.set(0, -towardP * o.pistonRodLength, axisZ);
  pistonHeadAnchor.userData.role = `analytic-${o.rolePrefix}piston-head-center-H`;
  pistonAssembly.add(pistonRod, pistonHead, pistonCrankEye,
    pistonCrankAnchor, pistonHeadAnchor);

  return {
    axisZ,
    barrel,
    crankArm,
    crankFrontWeb,
    crankPin,
    crankPinAnchor,
    crankShaft,
    cylinderAssembly,
    cylinderAxisAnchor,
    cylinderEndPlates,
    cylinderPivotAnchor,
    cylinderTrunnion,
    fixedFrame,
    glandCollars,
    inputCrank,
    pistonAssembly,
    pistonCrankAnchor,
    pistonCrankEye,
    pistonHead,
    pistonHeadAnchor,
    pistonRod,
    rails,
  };
}

function oscillatingCylinderEngine(movement) {
  const root = new THREE.Group();

  // Official source geometry. The two add_rot_to operations do not impose
  // separate link lengths: they orient both the cylinder and piston assembly
  // on the same instantaneous T-P line. The green assembly is rooted at crank
  // pin P and its piston-head center is 6.75 units down that line. Therefore
  // the head's signed coordinate in the cylinder is |T-P|-6.75.
  const sourceScale = 0.62;
  const sourceCrankCenter = new THREE.Vector2(0, 0);
  const sourceCrankRadius = 2.25;
  const sourceCrankPhaseOffsetTurns = 0.625;
  const sourceCylinderPivot = new THREE.Vector2(0, -6.75);
  const sourcePistonRodLength = 6.75;
  const sourcePistonHeadHalfWidth = 1.3125;
  const sourcePistonHeadThickness = 0.375;
  const sourcePistonRodHalfWidth = 0.15625;
  const sourcePistonRodCrankClearance = 0.340897;
  const sourceCylinderOuterHalfWidth = 1.75;
  const sourceCylinderWallOuterX = 1.5;
  const sourceCylinderWallInnerX = 1.3125;
  const sourceCylinderBoreEnd = 2.5;
  const sourceCylinderShellEnd = 2.875;
  // Brown's plate draws a much smaller crank and a short barrel: measured
  // against O-T (6.75 units, 315 px) the crank is ≈1.7 units and the covers
  // sit ≈2.25-2.35 units either side of T. The model follows the plate and
  // keeps the official rod length, pivot and timing; the bore end keeps the
  // official 0.0625-unit end clearance for the shorter 3.4-unit stroke.
  const plateCrankRadius = 1.7;
  const plateCylinderBoreEnd = 1.95;
  const plateCylinderShellEnd = 2.325;
  const sourceCylinderDirectionRay = new THREE.Vector2(0, 2.5);
  const sourcePistonDirectionRay = new THREE.Vector2(0, -6.9375);
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;
  const sourceCrankPhaseOffset = FULL_TURN
    * sourceCrankPhaseOffsetTurns;

  const crankCenter = sourceCrankCenter.clone().multiplyScalar(sourceScale);
  const crankRadius = plateCrankRadius * sourceScale;
  const cylinderPivot = sourceCylinderPivot.clone()
    .multiplyScalar(sourceScale);
  const pistonRodLength = sourcePistonRodLength * sourceScale;
  const pistonHeadHalfWidth = sourcePistonHeadHalfWidth * sourceScale;
  const pistonHeadThickness = sourcePistonHeadThickness * sourceScale;
  const cylinderBoreEnd = plateCylinderBoreEnd * sourceScale;
  const cylinderShellEnd = plateCylinderShellEnd * sourceScale;

  const sourceStateAtCyclePosition = (cyclePosition) => {
    const unwrappedInputAngle = sourceCrankPhaseOffset
      + FULL_TURN * cyclePosition;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const pointP = sourceCrankCenter.clone().add(new THREE.Vector2(
      sourceCrankRadius * Math.cos(inputAngle),
      sourceCrankRadius * Math.sin(inputAngle),
    ));
    const trunnionToCrank = pointP.clone().sub(sourceCylinderPivot);
    const crankToTrunnionDistance = trunnionToCrank.length();
    const cylinderAxis = trunnionToCrank.clone()
      .multiplyScalar(1 / crankToTrunnionDistance);
    const cylinderAngle = Math.atan2(cylinderAxis.y, cylinderAxis.x)
      - Math.PI / 2;
    const pistonTravel = crankToTrunnionDistance
      - sourcePistonRodLength;
    const pistonHead = sourceCylinderPivot.clone().addScaledVector(
      cylinderAxis,
      pistonTravel,
    );
    return {
      crankToTrunnionDistance,
      cylinderAngle,
      cylinderAxis,
      inputAngle,
      pistonAssemblyOrigin: pointP.clone(),
      pistonHead,
      pistonTravel,
      pointP,
      unwrappedInputAngle,
    };
  };

  const stateAtInputAngle = (
    unwrappedInputAngle,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const pointP = crankCenter.clone().add(new THREE.Vector2(
      crankRadius * cosine,
      crankRadius * sine,
    ));
    const pointPVelocity = new THREE.Vector2(
      -crankRadius * sine * resolvedInputAngularSpeed,
      crankRadius * cosine * resolvedInputAngularSpeed,
    );
    const pointPAcceleration = new THREE.Vector2(
      -crankRadius * (
        cosine * resolvedInputAngularSpeed ** 2
          + sine * inputAngularAcceleration
      ),
      crankRadius * (
        -sine * resolvedInputAngularSpeed ** 2
          + cosine * inputAngularAcceleration
      ),
    );
    const trunnionToCrank = pointP.clone().sub(cylinderPivot);
    const crankToTrunnionDistance = trunnionToCrank.length();
    const cylinderAxis = trunnionToCrank.clone()
      .multiplyScalar(1 / crankToTrunnionDistance);
    const cylinderAxisNormal = new THREE.Vector2(
      -cylinderAxis.y,
      cylinderAxis.x,
    );
    const pistonTravel = crankToTrunnionDistance - pistonRodLength;
    const pistonVelocity = trunnionToCrank.dot(pointPVelocity)
      / crankToTrunnionDistance;
    const pistonAcceleration = (
      pointPVelocity.lengthSq()
        + trunnionToCrank.dot(pointPAcceleration)
        - pistonVelocity ** 2
    ) / crankToTrunnionDistance;
    const cylinderAngle = Math.atan2(cylinderAxis.y, cylinderAxis.x)
      - Math.PI / 2;
    const cylinderAngularVelocity = cross2(
      trunnionToCrank,
      pointPVelocity,
    ) / trunnionToCrank.lengthSq();
    const cylinderAngularAcceleration = cross2(
      trunnionToCrank,
      pointPAcceleration,
    ) / trunnionToCrank.lengthSq()
      - 2 * pistonVelocity * cylinderAngularVelocity
        / crankToTrunnionDistance;
    const cylinderAxisVelocity = cylinderAxisNormal.clone()
      .multiplyScalar(cylinderAngularVelocity);
    const cylinderAxisAcceleration = cylinderAxisNormal.clone()
      .multiplyScalar(cylinderAngularAcceleration)
      .addScaledVector(
        cylinderAxis,
        -(cylinderAngularVelocity ** 2),
      );
    const pistonHead = cylinderPivot.clone().addScaledVector(
      cylinderAxis,
      pistonTravel,
    );
    const pistonHeadVelocity = cylinderAxis.clone()
      .multiplyScalar(pistonVelocity)
      .addScaledVector(
        cylinderAxisVelocity,
        pistonTravel,
      );
    const pistonHeadAcceleration = cylinderAxis.clone()
      .multiplyScalar(pistonAcceleration)
      .addScaledVector(cylinderAxisVelocity,
        2 * pistonVelocity)
      .addScaledVector(cylinderAxisAcceleration,
        pistonTravel);
    const pistonRodVector = pointP.clone().sub(pistonHead);
    const pistonRodRelativeVelocity = pointPVelocity.clone()
      .sub(pistonHeadVelocity);
    const pistonRodRelativeAcceleration = pointPAcceleration.clone()
      .sub(pistonHeadAcceleration);

    return {
      crank: {
        angle: inputAngle,
        angularAcceleration: inputAngularAcceleration,
        angularVelocity: resolvedInputAngularSpeed,
      },
      crankToTrunnionDistance,
      cylinder: {
        angle: cylinderAngle,
        angularAcceleration: cylinderAngularAcceleration,
        angularVelocity: cylinderAngularVelocity,
        axis: cylinderAxis,
        axisAcceleration: cylinderAxisAcceleration,
        axisNormal: cylinderAxisNormal,
        axisVelocity: cylinderAxisVelocity,
      },
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      piston: {
        acceleration: pistonAcceleration,
        head: pistonHead,
        headAcceleration: pistonHeadAcceleration,
        headVelocity: pistonHeadVelocity,
        rodAngularAcceleration: cylinderAngularAcceleration,
        rodAngularVelocity: cylinderAngularVelocity,
        rodLengthError: pistonRodVector.length() - pistonRodLength,
        rodRelativeAcceleration: pistonRodRelativeAcceleration,
        rodRelativeVelocity: pistonRodRelativeVelocity,
        travel: pistonTravel,
        velocity: pistonVelocity,
      },
      pointP,
      pointPAcceleration,
      pointPVelocity,
      unwrappedInputAngle,
    };
  };

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => stateAtInputAngle(
    sourceCrankPhaseOffset + inputTravel,
    resolvedInputAngularSpeed,
    inputAngularAcceleration,
  );

  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time,
      inputAngularSpeed,
      0,
    );
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const sourceStateAtTime = (time) => {
    const state = sourceStateAtCyclePosition(time / cyclePeriod);
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    sourceStart: 0,
    nearestDeadCenter: cyclePeriod / 8,
    sourceQuarter: cyclePeriod / 4,
    sourceHalf: cyclePeriod / 2,
    farthestDeadCenter: cyclePeriod * 5 / 8,
    sourceThreeQuarter: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  let maximumCylinderAngle = -Infinity;
  let maximumCrankToTrunnionDistance = -Infinity;
  let maximumPistonTravel = -Infinity;
  let maximumPistonX = -Infinity;
  let maximumPistonY = -Infinity;
  let maximumRodLengthError = 0;
  let minimumCylinderAngle = Infinity;
  let minimumCrankToTrunnionDistance = Infinity;
  let minimumPistonTravel = Infinity;
  let minimumPistonX = Infinity;
  let minimumPistonY = Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtInputTravel(FULL_TURN * sample / 16384);
    maximumCylinderAngle = Math.max(maximumCylinderAngle,
      state.cylinder.angle);
    minimumCylinderAngle = Math.min(minimumCylinderAngle,
      state.cylinder.angle);
    maximumCrankToTrunnionDistance = Math.max(
      maximumCrankToTrunnionDistance,
      state.crankToTrunnionDistance,
    );
    minimumCrankToTrunnionDistance = Math.min(
      minimumCrankToTrunnionDistance,
      state.crankToTrunnionDistance,
    );
    maximumPistonTravel = Math.max(maximumPistonTravel,
      state.piston.travel);
    minimumPistonTravel = Math.min(minimumPistonTravel,
      state.piston.travel);
    maximumPistonX = Math.max(maximumPistonX, state.piston.head.x);
    minimumPistonX = Math.min(minimumPistonX, state.piston.head.x);
    maximumPistonY = Math.max(maximumPistonY, state.piston.head.y);
    minimumPistonY = Math.min(minimumPistonY, state.piston.head.y);
    maximumRodLengthError = Math.max(maximumRodLengthError,
      Math.abs(state.piston.rodLengthError));
  }
  const minimumEndClearance = cylinderBoreEnd
    - pistonHeadThickness / 2
    - Math.max(Math.abs(minimumPistonTravel), maximumPistonTravel);

  const geometry = {
    crankCenter,
    crankRadius,
    cyclePeriod,
    cylinderBoreEnd,
    cylinderPivot,
    cylinderShellEnd,
    inputAngularSpeed,
    maximumCrankToTrunnionDistance,
    maximumCylinderAngle,
    maximumPistonTravel,
    maximumPistonX,
    maximumPistonY,
    maximumRodLengthError,
    minimumCrankToTrunnionDistance,
    minimumCylinderAngle,
    minimumEndClearance,
    minimumPistonTravel,
    minimumPistonX,
    minimumPistonY,
    pistonHeadHalfWidth,
    pistonHeadThickness,
    pistonRodLength,
    pistonStroke: maximumPistonTravel - minimumPistonTravel,
    sourceCrankPhaseOffset,
    sourceScale,
  };

  // Brown's plate: the crank bearing rail and the trunnion rail are both
  // broken-off bars behind the moving parts; the middle rail and its bearing
  // boss are dashed where the closed cylinder hides them.
  const shaftBore = 0.25 * sourceScale + 0.012;
  const upperRailOutline = clip.union(
    brokenRailOutline(-2.65 * sourceScale, 2.5 * sourceScale,
      -0.28 * sourceScale, -0.82 * sourceScale, 0.18 * sourceScale),
    poly(circle([crankCenter.x, crankCenter.y], 0.62 * sourceScale, 96)),
  );
  const middleRailOutline = clip.union(
    brokenRailOutline(-2.87 * sourceScale, 3.17 * sourceScale,
      cylinderPivot.y + 0.15 * sourceScale, cylinderPivot.y - 0.54 * sourceScale,
      0.18 * sourceScale),
    poly(circle([cylinderPivot.x, cylinderPivot.y], 0.78 * sourceScale, 96)),
  );
  const crankRailLow = -0.62;
  const trunnionRailLow = -1.20;
  const parts = buildSourceOscillatingEngine({
    axisRayLocalY: plateCylinderBoreEnd * sourceScale,
    barrelInnerRadius: sourceCylinderWallInnerX,
    barrelOuterRadius: sourceCylinderWallOuterX,
    boreFrom: -plateCylinderBoreEnd,
    boreTo: plateCylinderBoreEnd,
    collars: [
      { height: 0.125, radius: 0.50, u: 2.6375 },
      { height: 0.125, radius: 0.25, u: 2.7625 },
      { height: 0.125, radius: 0.50, u: 2.8875 },
    ],
    coverRadius: sourceCylinderOuterHalfWidth,
    covers: [
      { from: -plateCylinderShellEnd, passage: false, role: 'oscillating-cylinder-bottom-cover', to: -plateCylinderBoreEnd },
      { from: plateCylinderBoreEnd, passage: true, role: 'oscillating-cylinder-top-cover', to: plateCylinderShellEnd },
    ],
    crankCenter,
    crankRadius,
    crankRailLow,
    crankRole: 'one-point-seven-unit-direct-acting-crank-O-P',
    cylinderPivot,
    cylinderRole: 'mid-trunnion-closed-oscillating-cylinder',
    frameRole: 'fixed-upper-crank-bearing-and-mid-cylinder-trunnion-frame',
    frontBossSurfaceRadius: sourceCylinderWallOuterX,
    pistonHeadThickness: sourcePistonHeadThickness,
    pistonRodCrankClearance: sourcePistonRodCrankClearance,
    pistonRodHalfWidth: sourcePistonRodHalfWidth,
    pistonRodLength,
    pistonRole: 'fixed-length-piston-rod-and-head-rooted-at-crank-pin-P',
    rails: [
      {
        bores: [{ center: [crankCenter.x, crankCenter.y], radius: shaftBore }],
        high: -0.22,
        low: crankRailLow,
        outline: upperRailOutline,
        role: 'fixed-upper-engine-frame-rail-and-crank-bearing',
      },
      {
        bores: [{ center: [cylinderPivot.x, cylinderPivot.y], radius: 0.30 * sourceScale + 0.012 }],
        high: -0.76,
        low: trunnionRailLow,
        outline: middleRailOutline,
        role: 'fixed-mid-height-trunnion-rail-behind-cylinder',
      },
    ],
    rolePrefix: '',
    sourceScale,
    towardP: 1,
    trunnionRailLow,
    trunnionRole: 'moving-cylinder-midpoint-trunnion',
  });
  const {
    barrel,
    crankArm,
    crankFrontWeb,
    crankPin,
    crankPinAnchor,
    crankShaft,
    cylinderAssembly,
    cylinderEndPlates,
    cylinderPivotAnchor,
    cylinderTrunnion,
    fixedFrame,
    glandCollars,
    inputCrank,
    pistonAssembly,
    pistonCrankAnchor,
    pistonCrankEye,
    pistonHead,
    pistonHeadAnchor,
    pistonRod,
  } = parts;
  const [upperRail, lowerRail] = parts.rails;
  const cylinderTopAxisAnchor = parts.cylinderAxisAnchor;
  root.add(fixedFrame, inputCrank, cylinderAssembly, pistonAssembly);

  const contacts = {
    crankBearingO: {
      fixedMember: fixedFrame,
      movingMember: inputCrank,
      point: new THREE.Vector3(crankCenter.x, crankCenter.y, 0.2),
      type: 'fixed-revolute-crank-bearing-O',
    },
    crankPinP: {
      members: [inputCrank, pistonAssembly],
      point: new THREE.Vector3(),
      type: 'direct-crank-to-piston-rod-revolute-pin-P',
    },
    cylinderTrunnionT: {
      fixedMember: fixedFrame,
      movingMember: cylinderAssembly,
      point: new THREE.Vector3(cylinderPivot.x, cylinderPivot.y, 0.08),
      type: 'fixed-mid-cylinder-revolute-trunnion-T',
    },
    pistonInCylinder: {
      axis: new THREE.Vector3(),
      members: [pistonAssembly, cylinderAssembly],
      point: new THREE.Vector3(),
      signedTravel: 0,
      type: 'coaxial-prismatic-piston-in-oscillating-cylinder',
    },
    pistonRodAtGland: {
      axis: new THREE.Vector3(),
      members: [pistonAssembly, cylinderAssembly],
      point: new THREE.Vector3(),
      type: 'sliding-piston-rod-through-oscillating-gland',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCrank.rotation.z = state.inputAngle;
    inputCrank.userData.angularSpeed = state.inputAngularSpeed;
    inputCrank.userData.angularAcceleration = state.inputAngularAcceleration;
    cylinderAssembly.rotation.z = state.cylinder.angle;
    cylinderAssembly.userData.angularSpeed =
      state.cylinder.angularVelocity;
    cylinderAssembly.userData.angularAcceleration =
      state.cylinder.angularAcceleration;
    pistonAssembly.position.set(state.pointP.x, state.pointP.y, 0);
    pistonAssembly.rotation.z = state.cylinder.angle;
    pistonAssembly.userData.angularSpeed =
      state.piston.rodAngularVelocity;
    pistonAssembly.userData.angularAcceleration =
      state.piston.rodAngularAcceleration;
    pistonAssembly.userData.relativeTravel = state.piston.travel;
    pistonAssembly.userData.relativeVelocity = state.piston.velocity;
    pistonAssembly.userData.relativeAcceleration = state.piston.acceleration;
    contacts.crankPinP.point.set(state.pointP.x, state.pointP.y, parts.axisZ);
    contacts.pistonInCylinder.axis.set(
      state.cylinder.axis.x,
      state.cylinder.axis.y,
      0,
    );
    contacts.pistonInCylinder.point.set(
      state.piston.head.x,
      state.piston.head.y,
      parts.axisZ,
    );
    contacts.pistonInCylinder.signedTravel = state.piston.travel;
    contacts.pistonRodAtGland.axis.copy(contacts.pistonInCylinder.axis);
    contacts.pistonRodAtGland.point.set(
      cylinderPivot.x + state.cylinder.axis.x * 3.3125 * sourceScale,
      cylinderPivot.y + state.cylinder.axis.y * 3.3125 * sourceScale,
      0.42,
    );
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-6.5, -10.3125);
  const officialViewWidth = 13;
  const officialViewHeight = 13;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale;
    const sourceY = point.y / sourceScale;
    return new THREE.Vector2(
      (sourceX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (sourceY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  root.userData.archetype =
    'mid-trunnion-oscillating-cylinder-direct-crank-engine';
  root.userData.blocks = {
    barrel,
    crankArm,
    crankFrontWeb,
    crankBearing: upperRail,
    crankPin,
    crankPinAnchor,
    crankShaft,
    cylinderAssembly,
    cylinderEndPlates,
    cylinderPivotAnchor,
    cylinderTopAxisAnchor,
    cylinderTrunnion,
    cylinderWalls: [barrel],
    fixedFrame,
    glandCollars,
    inputCrank,
    lowerRail,
    pistonAssembly,
    pistonCrankAnchor,
    pistonCrankEye,
    pistonHead,
    pistonHeadAnchor,
    pistonRod,
    trunnionBearingBack: lowerRail,
    upperRail,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuously rotating 1.7-unit crank O-P (plate proportion)',
    mechanism: 1,
    output:
      'the piston slides along the cylinder while the whole cylinder oscillates about its midpoint trunnions',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -6.72;
  root.userData.mechanism =
    'crank-O-P-direct-piston-rod-P-H-sliding-in-cylinder-oscillating-about-fixed-midpoint-trunnion-T';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_stat',
      'add_rot',
      'add_rot_to',
      'add_rot_to',
      'add_text',
    ],
    officialGeometry: {
      crankCenter: sourceCrankCenter,
      crankPhaseOffsetTurns: sourceCrankPhaseOffsetTurns,
      crankRadius: sourceCrankRadius,
      cylinderBoreEnd: sourceCylinderBoreEnd,
      cylinderDirectionRay: sourceCylinderDirectionRay,
      cylinderOuterHalfWidth: sourceCylinderOuterHalfWidth,
      cylinderPivot: sourceCylinderPivot,
      cylinderShellEnd: sourceCylinderShellEnd,
      cylinderWallInnerX: sourceCylinderWallInnerX,
      cylinderWallOuterX: sourceCylinderWallOuterX,
      pistonDirectionRay: sourcePistonDirectionRay,
      pistonHeadHalfWidth: sourcePistonHeadHalfWidth,
      pistonHeadThickness: sourcePistonHeadThickness,
      pistonRodCrankClearance: sourcePistonRodCrankClearance,
      pistonRodHalfWidth: sourcePistonRodHalfWidth,
      pistonRodLength: sourcePistonRodLength,
    },
    officialPageAnimatedTabDisabled: false,
    physicalCorrection: {
      applied: false,
      reason:
        'both official add_rot_to transforms share the exact T-P axis, and the fixed 6.75-unit piston rod remains physically compatible with the mid-trunnion cylinder through the full crank cycle',
    },
    referenceScope:
      'official mid-length trunnion T, fixed-length direct piston rod and head, source phase, and 15 rpm timing; the crank radius (1.7 against the official 2.25), barrel length, gland, rails, crank outline, and view follow the plate',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate344: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one cylinder swings about midpoint trunnions in fixed bearings while its piston rod connects directly to the crank pin without a crosshead guide',
      measurementUncertaintyPixels: 3,
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.sourceStateAtCyclePosition = sourceStateAtCyclePosition;
  root.userData.sourceStateAtTime = sourceStateAtTime;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    exactConstraint:
      '|O-P|=1.7 and H=P-6.75u, where u=(P-T)/|P-T| is the common piston-and-cylinder axis',
    input: 'the upper crank pin P rotates uniformly about fixed bearing O',
    output:
      'distance |T-P| simultaneously sets cylinder angle and the piston coordinate |T-P|-6.75 along its bore',
    stroke:
      '|T-P| ranges from 5.05 to 8.45, giving exactly 3.4 source units of piston travel',
  };

  update(0);
  fitPistonGuide(root, update, cyclePeriod);
  // Brown's crop: just above the crank's top reach, just below the lower cover, with
  // both rails running off the plate's sides.
  root.userData.sweptBounds = root.userData.cameraFitBounds;
  root.userData.cameraDistanceScale = 0.96;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.4 * sourceScale, -9.7 * sourceScale, -1.2),
    new THREE.Vector3(5.4 * sourceScale, 2.3 * sourceScale, 1.5),
  );
  // Brown's flat elevation: a narrow field keeps the covers from opening
  // into ellipses.
  root.userData.cameraFov = 12;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.3, 0.1, 14),
    root,
    update,
  };
}

function invertedPendulumEngine(movement) {
  const root = new THREE.Group();

  // In 345 the cylinder hangs from an end trunnion instead of pivoting at its
  // midpoint. The official blue add_rot_to points local -Y from T toward crank
  // pin P. The green assembly is rooted at P and points local +Y back toward T;
  // its piston-head center is 7.75 units from P. Thus the signed head position
  // down the five-unit bore is |T-P|-7.75, ranging from 0.25 to 4.75.
  const sourceScale = 0.60;
  const sourceCrankCenter = new THREE.Vector2(0, 0);
  const sourceCrankRadius = 2.25;
  const sourceCrankPhaseOffsetTurns = 0.375;
  const sourceCylinderPivot = new THREE.Vector2(0, 10.25);
  const sourcePistonRodLength = 7.75;
  const sourcePistonHeadHalfWidth = 1.5;
  const sourcePistonHeadThickness = 0.375;
  const sourcePistonRodHalfWidth = 0.15625;
  const sourcePistonRodCrankClearance = 0.340897;
  const sourceCylinderOuterHalfWidth = 1.875;
  const sourceCylinderWallOuterX = 1.6875;
  const sourceCylinderWallInnerX = 1.5;
  const sourceCylinderBoreLength = 5;
  const sourceCylinderShellEnd = 5.375;
  const sourceCylinderDirectionRay = new THREE.Vector2(0, -5);
  const sourcePistonDirectionRay = new THREE.Vector2(0, 7.5625);
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;
  const sourceCrankPhaseOffset = FULL_TURN
    * sourceCrankPhaseOffsetTurns;

  const crankCenter = sourceCrankCenter.clone().multiplyScalar(sourceScale);
  const crankRadius = sourceCrankRadius * sourceScale;
  const cylinderPivot = sourceCylinderPivot.clone()
    .multiplyScalar(sourceScale);
  const pistonRodLength = sourcePistonRodLength * sourceScale;
  const pistonHeadHalfWidth = sourcePistonHeadHalfWidth * sourceScale;
  const pistonHeadThickness = sourcePistonHeadThickness * sourceScale;
  const cylinderBoreLength = sourceCylinderBoreLength * sourceScale;
  const cylinderShellEnd = sourceCylinderShellEnd * sourceScale;

  const sourceStateAtCyclePosition = (cyclePosition) => {
    const unwrappedInputAngle = sourceCrankPhaseOffset
      + FULL_TURN * cyclePosition;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const pointP = sourceCrankCenter.clone().add(new THREE.Vector2(
      sourceCrankRadius * Math.cos(inputAngle),
      sourceCrankRadius * Math.sin(inputAngle),
    ));
    const trunnionToCrank = pointP.clone().sub(sourceCylinderPivot);
    const crankToTrunnionDistance = trunnionToCrank.length();
    const cylinderAxis = trunnionToCrank.clone()
      .multiplyScalar(1 / crankToTrunnionDistance);
    const cylinderAngle = Math.atan2(cylinderAxis.y, cylinderAxis.x)
      + Math.PI / 2;
    const pistonTravel = crankToTrunnionDistance
      - sourcePistonRodLength;
    const pistonHead = sourceCylinderPivot.clone().addScaledVector(
      cylinderAxis,
      pistonTravel,
    );
    return {
      crankToTrunnionDistance,
      cylinderAngle,
      cylinderAxis,
      inputAngle,
      pistonAssemblyOrigin: pointP.clone(),
      pistonHead,
      pistonTravel,
      pointP,
      unwrappedInputAngle,
    };
  };

  const stateAtInputAngle = (
    unwrappedInputAngle,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const pointP = crankCenter.clone().add(new THREE.Vector2(
      crankRadius * cosine,
      crankRadius * sine,
    ));
    const pointPVelocity = new THREE.Vector2(
      -crankRadius * sine * resolvedInputAngularSpeed,
      crankRadius * cosine * resolvedInputAngularSpeed,
    );
    const pointPAcceleration = new THREE.Vector2(
      -crankRadius * (
        cosine * resolvedInputAngularSpeed ** 2
          + sine * inputAngularAcceleration
      ),
      crankRadius * (
        -sine * resolvedInputAngularSpeed ** 2
          + cosine * inputAngularAcceleration
      ),
    );
    const trunnionToCrank = pointP.clone().sub(cylinderPivot);
    const crankToTrunnionDistance = trunnionToCrank.length();
    const cylinderAxis = trunnionToCrank.clone()
      .multiplyScalar(1 / crankToTrunnionDistance);
    const cylinderAxisNormal = new THREE.Vector2(
      -cylinderAxis.y,
      cylinderAxis.x,
    );
    const pistonTravel = crankToTrunnionDistance - pistonRodLength;
    const pistonVelocity = trunnionToCrank.dot(pointPVelocity)
      / crankToTrunnionDistance;
    const pistonAcceleration = (
      pointPVelocity.lengthSq()
        + trunnionToCrank.dot(pointPAcceleration)
        - pistonVelocity ** 2
    ) / crankToTrunnionDistance;
    const cylinderAngle = Math.atan2(cylinderAxis.y, cylinderAxis.x)
      + Math.PI / 2;
    const cylinderAngularVelocity = cross2(
      trunnionToCrank,
      pointPVelocity,
    ) / trunnionToCrank.lengthSq();
    const cylinderAngularAcceleration = cross2(
      trunnionToCrank,
      pointPAcceleration,
    ) / trunnionToCrank.lengthSq()
      - 2 * pistonVelocity * cylinderAngularVelocity
        / crankToTrunnionDistance;
    const cylinderAxisVelocity = cylinderAxisNormal.clone()
      .multiplyScalar(cylinderAngularVelocity);
    const cylinderAxisAcceleration = cylinderAxisNormal.clone()
      .multiplyScalar(cylinderAngularAcceleration)
      .addScaledVector(
        cylinderAxis,
        -(cylinderAngularVelocity ** 2),
      );
    const pistonHead = cylinderPivot.clone().addScaledVector(
      cylinderAxis,
      pistonTravel,
    );
    const pistonHeadVelocity = cylinderAxis.clone()
      .multiplyScalar(pistonVelocity)
      .addScaledVector(cylinderAxisVelocity, pistonTravel);
    const pistonHeadAcceleration = cylinderAxis.clone()
      .multiplyScalar(pistonAcceleration)
      .addScaledVector(cylinderAxisVelocity, 2 * pistonVelocity)
      .addScaledVector(cylinderAxisAcceleration, pistonTravel);
    const pistonRodVector = pointP.clone().sub(pistonHead);
    const pistonRodRelativeVelocity = pointPVelocity.clone()
      .sub(pistonHeadVelocity);
    const pistonRodRelativeAcceleration = pointPAcceleration.clone()
      .sub(pistonHeadAcceleration);

    return {
      crank: {
        angle: inputAngle,
        angularAcceleration: inputAngularAcceleration,
        angularVelocity: resolvedInputAngularSpeed,
      },
      crankToTrunnionDistance,
      cylinder: {
        angle: cylinderAngle,
        angularAcceleration: cylinderAngularAcceleration,
        angularVelocity: cylinderAngularVelocity,
        axis: cylinderAxis,
        axisAcceleration: cylinderAxisAcceleration,
        axisNormal: cylinderAxisNormal,
        axisVelocity: cylinderAxisVelocity,
      },
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      piston: {
        acceleration: pistonAcceleration,
        head: pistonHead,
        headAcceleration: pistonHeadAcceleration,
        headVelocity: pistonHeadVelocity,
        rodAngularAcceleration: cylinderAngularAcceleration,
        rodAngularVelocity: cylinderAngularVelocity,
        rodLengthError: pistonRodVector.length() - pistonRodLength,
        rodRelativeAcceleration: pistonRodRelativeAcceleration,
        rodRelativeVelocity: pistonRodRelativeVelocity,
        travel: pistonTravel,
        velocity: pistonVelocity,
      },
      pointP,
      pointPAcceleration,
      pointPVelocity,
      unwrappedInputAngle,
    };
  };

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => stateAtInputAngle(
    sourceCrankPhaseOffset + inputTravel,
    resolvedInputAngularSpeed,
    inputAngularAcceleration,
  );
  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time,
      inputAngularSpeed,
      0,
    );
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };
  const sourceStateAtTime = (time) => {
    const state = sourceStateAtCyclePosition(time / cyclePeriod);
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    sourceStart: 0,
    sourceQuarter: cyclePeriod / 4,
    farthestDeadCenter: cyclePeriod * 3 / 8,
    sourceHalf: cyclePeriod / 2,
    sourceThreeQuarter: cyclePeriod * 3 / 4,
    nearestDeadCenter: cyclePeriod * 7 / 8,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  let maximumCylinderAngle = -Infinity;
  let maximumCrankToTrunnionDistance = -Infinity;
  let maximumPistonTravel = -Infinity;
  let maximumPistonX = -Infinity;
  let maximumPistonY = -Infinity;
  let maximumRodLengthError = 0;
  let minimumCylinderAngle = Infinity;
  let minimumCrankToTrunnionDistance = Infinity;
  let minimumPistonTravel = Infinity;
  let minimumPistonX = Infinity;
  let minimumPistonY = Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtInputTravel(FULL_TURN * sample / 16384);
    maximumCylinderAngle = Math.max(maximumCylinderAngle,
      state.cylinder.angle);
    minimumCylinderAngle = Math.min(minimumCylinderAngle,
      state.cylinder.angle);
    maximumCrankToTrunnionDistance = Math.max(
      maximumCrankToTrunnionDistance,
      state.crankToTrunnionDistance,
    );
    minimumCrankToTrunnionDistance = Math.min(
      minimumCrankToTrunnionDistance,
      state.crankToTrunnionDistance,
    );
    maximumPistonTravel = Math.max(maximumPistonTravel,
      state.piston.travel);
    minimumPistonTravel = Math.min(minimumPistonTravel,
      state.piston.travel);
    maximumPistonX = Math.max(maximumPistonX, state.piston.head.x);
    minimumPistonX = Math.min(minimumPistonX, state.piston.head.x);
    maximumPistonY = Math.max(maximumPistonY, state.piston.head.y);
    minimumPistonY = Math.min(minimumPistonY, state.piston.head.y);
    maximumRodLengthError = Math.max(maximumRodLengthError,
      Math.abs(state.piston.rodLengthError));
  }
  const minimumEndClearance = Math.min(
    minimumPistonTravel - pistonHeadThickness / 2,
    cylinderBoreLength - maximumPistonTravel - pistonHeadThickness / 2,
  );

  const geometry = {
    crankCenter,
    crankRadius,
    cyclePeriod,
    cylinderBoreLength,
    cylinderPivot,
    cylinderShellEnd,
    inputAngularSpeed,
    maximumCrankToTrunnionDistance,
    maximumCylinderAngle,
    maximumPistonTravel,
    maximumPistonX,
    maximumPistonY,
    maximumRodLengthError,
    minimumCrankToTrunnionDistance,
    minimumCylinderAngle,
    minimumEndClearance,
    minimumPistonTravel,
    minimumPistonX,
    minimumPistonY,
    pistonHeadHalfWidth,
    pistonHeadThickness,
    pistonRodLength,
    pistonStroke: maximumPistonTravel - minimumPistonTravel,
    sourceCrankPhaseOffset,
    sourceScale,
  };

  // Brown's plate: a broken-off rail behind the top cover carries trunnion T
  // (its bearing boss shows above the cover), and the crank bearing O sits on
  // a plain block whose rounded pedestal is hidden behind the crank boss.
  const shaftBore = 0.25 * sourceScale + 0.012;
  const upperRailOutline = clip.union(
    brokenRailOutline(-2.9 * sourceScale, 3.5 * sourceScale,
      cylinderPivot.y - 0.12 * sourceScale, cylinderPivot.y - 0.98 * sourceScale,
      0.18 * sourceScale),
    poly(circle([cylinderPivot.x, cylinderPivot.y], 0.55 * sourceScale, 96)),
  );
  // The block runs on below the frame, as Brown's runs off the plate.
  // A low base plate, as wide as Brown's block, whose top lies just below
  // the crank's swept circle (pin radius 2.25 plus the eye), and a small
  // tapered bearing pedestal rising behind the crank to the round boss at O.
  // The frame crops the base plate's bottom as Brown does.
  const baseTopSourceY = -3.0;
  const lowerBlockOutline = clip.union(
    poly([
      [-2.9 * sourceScale, baseTopSourceY * sourceScale], [3.0 * sourceScale, baseTopSourceY * sourceScale],
      [3.0 * sourceScale, -6.0 * sourceScale], [-2.9 * sourceScale, -6.0 * sourceScale],
    ]),
    poly([
      [-1.05 * sourceScale, (baseTopSourceY + 0.01) * sourceScale],
      [1.05 * sourceScale, (baseTopSourceY + 0.01) * sourceScale],
      [0.55 * sourceScale, -0.35 * sourceScale],
      [-0.55 * sourceScale, -0.35 * sourceScale],
    ]),
    poly(circle([crankCenter.x, crankCenter.y - 0.2 * sourceScale], 0.8 * sourceScale, 96)),
  );
  const crankRailLow = -0.62;
  const trunnionRailLow = -1.22;
  const parts = buildSourceOscillatingEngine({
    axisRayLocalY: sourceCylinderDirectionRay.y * sourceScale,
    barrelInnerRadius: sourceCylinderWallInnerX,
    barrelOuterRadius: sourceCylinderWallOuterX,
    boreFrom: 0,
    boreTo: sourceCylinderBoreLength,
    collars: [
      { height: 0.125, radius: 0.50, u: 5.6875 },
      { height: 0.125, radius: 0.25, u: 5.8125 },
      { height: 0.125, radius: 0.50, u: 5.9375 },
    ],
    coverRadius: sourceCylinderOuterHalfWidth,
    covers: [
      { from: -(sourceCylinderShellEnd - sourceCylinderBoreLength), passage: false, role: 'pendulum-cylinder-pivot-end-cover', to: 0 },
      { from: sourceCylinderBoreLength, passage: true, role: 'pendulum-cylinder-rod-end-cover', to: sourceCylinderShellEnd },
    ],
    crankCenter,
    crankRadius,
    crankRailLow,
    crankRole: 'lower-two-point-two-five-unit-direct-acting-crank-O-P',
    cylinderPivot,
    cylinderRole: 'upper-end-trunnion-closed-pendulum-cylinder',
    frameRole: 'fixed-upper-end-trunnion-rail-and-lower-crank-block',
    frontBossSurfaceRadius: sourceCylinderOuterHalfWidth,
    pistonHeadThickness: sourcePistonHeadThickness,
    pistonRodCrankClearance: sourcePistonRodCrankClearance,
    pistonRodHalfWidth: sourcePistonRodHalfWidth,
    pistonRodLength,
    pistonRole: 'inverted-fixed-length-piston-rod-and-head-rooted-at-lower-crank-pin-P',
    rails: [
      {
        bores: [{ center: [cylinderPivot.x, cylinderPivot.y], radius: 0.30 * sourceScale + 0.012 }],
        high: -0.80,
        low: trunnionRailLow,
        outline: upperRailOutline,
        role: 'fixed-upper-pendulum-engine-trunnion-rail-behind-cylinder',
      },
      {
        bores: [{ center: [crankCenter.x, crankCenter.y], radius: shaftBore }],
        high: -0.22,
        low: crankRailLow,
        outline: lowerBlockOutline,
        role: 'fixed-lower-crank-block-and-bearing-O',
      },
    ],
    rolePrefix: 'lower-',
    sourceScale,
    towardP: -1,
    trunnionRailLow,
    trunnionRole: 'moving-upper-end-cylinder-trunnion',
  });
  const {
    barrel,
    crankArm,
    crankFrontWeb,
    crankPin,
    crankPinAnchor,
    crankShaft,
    cylinderAssembly,
    cylinderEndPlates,
    cylinderPivotAnchor,
    cylinderTrunnion,
    fixedFrame,
    glandCollars,
    inputCrank,
    pistonAssembly,
    pistonCrankAnchor,
    pistonCrankEye,
    pistonHead,
    pistonHeadAnchor,
    pistonRod,
  } = parts;
  const [upperRail, lowerFoundation] = parts.rails;
  const cylinderBottomAxisAnchor = parts.cylinderAxisAnchor;
  root.add(fixedFrame, inputCrank, cylinderAssembly, pistonAssembly);

  const contacts = {
    crankBearingO: {
      fixedMember: fixedFrame,
      movingMember: inputCrank,
      point: new THREE.Vector3(crankCenter.x, crankCenter.y, 0.2),
      type: 'fixed-revolute-lower-crank-bearing-O',
    },
    crankPinP: {
      members: [inputCrank, pistonAssembly],
      point: new THREE.Vector3(),
      type: 'lower-crank-to-inverted-piston-rod-pin-P',
    },
    cylinderTrunnionT: {
      fixedMember: fixedFrame,
      movingMember: cylinderAssembly,
      point: new THREE.Vector3(cylinderPivot.x, cylinderPivot.y, 0.08),
      type: 'fixed-upper-end-cylinder-trunnion-T',
    },
    pistonInCylinder: {
      axis: new THREE.Vector3(),
      members: [pistonAssembly, cylinderAssembly],
      point: new THREE.Vector3(),
      signedTravel: 0,
      type: 'coaxial-prismatic-piston-in-pendulum-cylinder',
    },
    pistonRodAtGland: {
      axis: new THREE.Vector3(),
      members: [pistonAssembly, cylinderAssembly],
      point: new THREE.Vector3(),
      type: 'sliding-inverted-piston-rod-through-lower-gland',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCrank.rotation.z = state.inputAngle;
    inputCrank.userData.angularSpeed = state.inputAngularSpeed;
    inputCrank.userData.angularAcceleration = state.inputAngularAcceleration;
    cylinderAssembly.rotation.z = state.cylinder.angle;
    cylinderAssembly.userData.angularSpeed = state.cylinder.angularVelocity;
    cylinderAssembly.userData.angularAcceleration =
      state.cylinder.angularAcceleration;
    pistonAssembly.position.set(state.pointP.x, state.pointP.y, 0);
    pistonAssembly.rotation.z = state.cylinder.angle;
    pistonAssembly.userData.angularSpeed =
      state.piston.rodAngularVelocity;
    pistonAssembly.userData.angularAcceleration =
      state.piston.rodAngularAcceleration;
    pistonAssembly.userData.relativeTravel = state.piston.travel;
    pistonAssembly.userData.relativeVelocity = state.piston.velocity;
    pistonAssembly.userData.relativeAcceleration = state.piston.acceleration;
    contacts.crankPinP.point.set(state.pointP.x, state.pointP.y, parts.axisZ);
    contacts.pistonInCylinder.axis.set(
      state.cylinder.axis.x,
      state.cylinder.axis.y,
      0,
    );
    contacts.pistonInCylinder.point.set(
      state.piston.head.x,
      state.piston.head.y,
      parts.axisZ,
    );
    contacts.pistonInCylinder.signedTravel = state.piston.travel;
    contacts.pistonRodAtGland.axis.copy(contacts.pistonInCylinder.axis);
    contacts.pistonRodAtGland.point.set(
      cylinderPivot.x + state.cylinder.axis.x * 5.8125 * sourceScale,
      cylinderPivot.y + state.cylinder.axis.y * 5.8125 * sourceScale,
      0.42,
    );
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-6.5, -1.069328);
  const officialViewWidth = 13;
  const officialViewHeight = 13;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale;
    const sourceY = point.y / sourceScale;
    return new THREE.Vector2(
      (sourceX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (sourceY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  root.userData.archetype =
    'upper-end-trunnion-inverted-oscillating-pendulum-engine';
  root.userData.blocks = {
    barrel,
    crankArm,
    crankFrontWeb,
    crankBearing: lowerFoundation,
    crankPin,
    crankPinAnchor,
    crankShaft,
    cylinderAssembly,
    cylinderBottomAxisAnchor,
    cylinderEndPlates,
    cylinderPivotAnchor,
    cylinderTrunnion,
    cylinderWalls: [barrel],
    fixedFrame,
    glandCollars,
    inputCrank,
    lowerFoundation,
    pistonAssembly,
    pistonCrankAnchor,
    pistonCrankEye,
    pistonHead,
    pistonHeadAnchor,
    pistonRod,
    trunnionBearingBack: upperRail,
    upperRail,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuously rotating lower 2.25-unit crank O-P',
    mechanism: 1,
    output:
      'the piston slides upward in a cylinder that hangs and oscillates from its upper end trunnion',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -1.43;
  root.userData.mechanism =
    'lower-crank-O-P-direct-inverted-piston-rod-P-H-sliding-in-pendulum-cylinder-hung-from-fixed-upper-end-trunnion-T';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_stat',
      'add_rot',
      'add_rot_to',
      'add_rot_to',
      'add_text',
    ],
    officialGeometry: {
      crankCenter: sourceCrankCenter,
      crankPhaseOffsetTurns: sourceCrankPhaseOffsetTurns,
      crankRadius: sourceCrankRadius,
      cylinderBoreLength: sourceCylinderBoreLength,
      cylinderDirectionRay: sourceCylinderDirectionRay,
      cylinderOuterHalfWidth: sourceCylinderOuterHalfWidth,
      cylinderPivot: sourceCylinderPivot,
      cylinderShellEnd: sourceCylinderShellEnd,
      cylinderWallInnerX: sourceCylinderWallInnerX,
      cylinderWallOuterX: sourceCylinderWallOuterX,
      pistonDirectionRay: sourcePistonDirectionRay,
      pistonHeadHalfWidth: sourcePistonHeadHalfWidth,
      pistonHeadThickness: sourcePistonHeadThickness,
      pistonRodCrankClearance: sourcePistonRodCrankClearance,
      pistonRodHalfWidth: sourcePistonRodHalfWidth,
      pistonRodLength: sourcePistonRodLength,
    },
    officialPageAnimatedTabDisabled: false,
    physicalCorrection: {
      applied: false,
      reason:
        'both official add_rot_to transforms share the exact T-P axis, and the fixed 7.75-unit piston rod remains inside the five-unit end-pivot cylinder with positive clearance throughout the cycle',
    },
    referenceScope:
      'official lower 2.25-unit crank, upper-end trunnion T, hanging cylinder (closed as in Brown\'s plate) and lower gland, fixed-length inverted piston rod and head, source phase, and 15 rpm timing; rail, crank block, crank outline, and view follow the plate',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate345: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one cylinder hangs like a pendulum from upper-end trunnions while its piston rod extends downward directly to the lower crank pin',
      measurementUncertaintyPixels: 3,
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.sourceStateAtCyclePosition = sourceStateAtCyclePosition;
  root.userData.sourceStateAtTime = sourceStateAtTime;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    exactConstraint:
      '|O-P|=2.25 and H=P+7.75v, where v=(T-P)/|T-P| points from the lower crank pin toward the upper trunnion',
    input: 'the lower crank pin P rotates uniformly about fixed bearing O',
    output:
      'distance |T-P| simultaneously sets pendulum-cylinder angle and piston coordinate |T-P|-7.75 down its bore',
    stroke:
      '|T-P| ranges from 8.0 to 12.5, giving exactly 4.5 source units of piston travel',
  };

  update(0);
  fitPistonGuide(root, update, cyclePeriod);
  // Brown's crop: just above the trunnion boss at the top; at the bottom it
  // cuts through the low base plate just under the crank's swept circle, so
  // the crank stays whole through the turn.
  root.userData.sweptBounds = root.userData.cameraFitBounds;
  root.userData.cameraDistanceScale = 0.96;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.5 * sourceScale, -2.2 * sourceScale, -1.2),
    new THREE.Vector3(5.7 * sourceScale, 11.0 * sourceScale, 1.5),
  );
  markShadows(root);
  // Brown draws the crank block as a plain outline; the crank's cast shadow
  // made its exposed face read as a large dark mass.
  lowerFoundation.traverse((object) => { object.receiveShadow = false; });
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
    root,
    update,
  };
}

export function createAuthoredOscillatingEngineMovement(movement) {
  switch (movement.id) {
    case 344: return oscillatingCylinderEngine(movement);
    case 345: return invertedPendulumEngine(movement);
    default: return null;
  }
}
