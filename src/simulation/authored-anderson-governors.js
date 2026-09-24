import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeBevelGear,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';
import { plate as plateGeometry, polygonClipping } from './finite-plate-geometry.js';
import { makeBoredPlanarLink } from './bored-planar-link.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';

import { correctAndersonGovernor } from './governor-274-357-parts.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongX(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 40) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusNormalToX(majorRadius, tubeRadius, material, segments = 80) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 12, segments),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
}

function torusNormalToY(majorRadius, tubeRadius, material, segments = 112) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 14, segments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function torusNormalToZ(majorRadius, tubeRadius, material, segments = 64) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 12, segments),
    material,
  );
}

function curveTube(curve, radius, material, role) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

// A straight bar with round eyes and real pin bores, in its own x-y frame.
function boredBarOutline(eyes, halfWidth) {
  const ring = (cx, r) => [[...Array.from({ length: 48 }, (_, i) => [
    cx + r * Math.cos(i * Math.PI / 24), r * Math.sin(i * Math.PI / 24)]),
  [cx + r, 0]]];
  const xs = eyes.map(({ x }) => x);
  const low = Math.min(...xs);
  const high = Math.max(...xs);
  const bar = [[[low, -halfWidth], [high, -halfWidth], [high, halfWidth],
    [low, halfWidth], [low, -halfWidth]]];
  return polygonClipping.difference(
    polygonClipping.union(bar, ...eyes.map(({ x, eye }) => ring(x, eye))),
    ...eyes.map(({ x, bore }) => ring(x, bore)),
  );
}

function makeCoilSpring(material) {
  const spring = new THREE.Group();
  const points = [];
  const turns = 12;
  const samples = turns * 12;
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const endBlend = Math.sin(Math.PI * progress) ** 0.35;
    const angle = progress * turns * Math.PI * 2;
    points.push(new THREE.Vector3(
      0.105 * Math.cos(angle) * endBlend,
      progress,
      0.105 * Math.sin(angle) * endBlend,
    ));
  }
  const coil = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      samples,
      0.027,
      8,
      false,
    ),
    material,
  );
  coil.userData.role = 'spring-L-coil';
  spring.add(coil);
  spring.userData.setEndpoints = (start, end) => {
    const direction = end.clone().sub(start);
    const length = direction.length();
    spring.position.copy(start);
    spring.quaternion.setFromUnitVectors(
      Y_AXIS,
      direction.clone().normalize(),
    );
    spring.scale.set(1, length, 1);
  };
  return spring;
}

function makeStationaryCrownGear({
  pitchRadius,
  teeth,
  material,
  darkMaterial,
  indexMaterial,
}) {
  const group = new THREE.Group();
  const ring = torusNormalToY(pitchRadius, 0.24, material, 160);
  ring.scale.y = 0.58;
  ring.userData.role = 'stationary-toothed-circle-G-body';
  group.add(ring);

  const innerRail = torusNormalToY(pitchRadius - 0.27, 0.055,
    darkMaterial, 144);
  const outerRail = torusNormalToY(pitchRadius + 0.27, 0.055,
    darkMaterial, 144);
  innerRail.userData.role = 'inner-edge-of-stationary-circle-G';
  outerRail.userData.role = 'outer-edge-of-stationary-circle-G';
  group.add(innerRail, outerRail);

  const toothMeshes = [];
  const angularPitch = Math.PI * 2 / teeth;
  for (let index = 0; index < teeth; index += 1) {
    const angle = index * angularPitch;
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, pitchRadius * angularPitch * 0.56),
      index === 0 ? indexMaterial : material,
    );
    tooth.position.set(
      pitchRadius * Math.cos(angle),
      0.13,
      -pitchRadius * Math.sin(angle),
    );
    tooth.rotation.y = angle;
    tooth.userData.role = index === 0
      ? 'white-index-tooth-on-stationary-circle-G'
      : 'fixed-radial-crown-tooth-on-circle-G';
    tooth.userData.toothIndex = index;
    group.add(tooth);
    toothMeshes.push(tooth);
  }
  group.userData.angularPitch = angularPitch;
  group.userData.pitchRadius = pitchRadius;
  group.userData.teeth = teeth;
  group.userData.toothMeshes = toothMeshes;
  return group;
}

function circleIntersection({ centerA, centerB, radiusA, radiusB, side }) {
  const delta = centerB.clone().sub(centerA);
  const distance = delta.length();
  const along = (
    radiusA ** 2 - radiusB ** 2 + distance ** 2
  ) / (2 * distance);
  const perpendicularDistance = Math.sqrt(Math.max(
    0,
    radiusA ** 2 - along ** 2,
  ));
  const unit = delta.clone().multiplyScalar(1 / distance);
  const perpendicular = new THREE.Vector2(-unit.y, unit.x);
  return centerA.clone()
    .addScaledVector(unit, along)
    .addScaledVector(perpendicular, side * perpendicularDistance);
}

function andersonGyroscopeGovernor(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Brown's 525 px plate is a compact copy of the much clearer contemporary
  // Scientific American engraving (September 22, 1860).  The measurements
  // below use Brown's plate for proportions; line widths make sub-10 px
  // claims unjustified.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRingCenterRaster = new THREE.Vector2(270, 258);
  const sourceRingLeftRaster = new THREE.Vector2(48, 226);
  const sourceRingRightRaster = new THREE.Vector2(487, 252);
  const sourcePinionCenterRaster = new THREE.Vector2(89, 217);
  const sourceUniversalJointRaster = new THREE.Vector2(194, 210);
  const sourceRotorHingeRaster = new THREE.Vector2(272, 226);
  const sourceOutputBearingRaster = new THREE.Vector2(349, 240);
  const sourceDiskTopRaster = new THREE.Vector2(282, 119);
  const sourceDiskBottomRaster = new THREE.Vector2(247, 323);
  const sourceValveSwivelRaster = new THREE.Vector2(278, 92);
  const sourceSpringTopRaster = new THREE.Vector2(66, 53);
  const sourceSpringBottomRaster = new THREE.Vector2(49, 318);
  const sourceDriveAxisRaster = new THREE.Vector2(283, 437);
  const sourceFloorRaster = new THREE.Vector2(271, 513);

  const carrierCenterY = 1.02;
  const crownPitchRadius = 2.55;
  const crownTeeth = 60;
  const pinionPitchRadius = 0.51;
  const pinionTeeth = 12;
  const crownToPinionRatio = crownTeeth / pinionTeeth;
  const jointLocal = new THREE.Vector3(-0.42, pinionPitchRadius, 0);
  const pinionCenterLocal = new THREE.Vector3(
    -crownPitchRadius,
    pinionPitchRadius,
    0,
  );
  const crownContactLocal = new THREE.Vector3(-crownPitchRadius, 0, 0);
  const rotorRadius = 1.18;
  const rotorWidth = 0.38;
  const rotorCenterOffset = 0.65;
  const outputLeverLength = 1.58;
  const outputLinkLength = 2.5;
  const forkLayerOffset = 0.26;
  // Hinge bearings sit outboard of the open hinge ring around the Cardan.
  const hingeTrunnionRadius = 0.66;
  const cardanTrunnionRadius = 0.32;
  const shaftRadius = 0.075;

  const cyclePeriod = 8;
  const speedCycleRate = fullTurn / cyclePeriod;
  const meanCarrierAngularSpeed = fullTurn * 2 / cyclePeriod;
  const carrierSpeedAmplitude = 0.42;
  const sourceCarrierYaw = 0;
  const sourceInputShaftPhase = 0.46;
  // Brown draws axle B dipping about 10 degrees toward its outer end, so
  // wheel A leans up-right; the plate pose is the nominal-speed balance.
  // Speed still raises the outer end, lifting valve rod D through rods C.
  const restTiltAngle = -0.42;
  const nominalTiltAngle = -0.17;
  const maximumTiltAngle = 0.30;

  const rotorMass = 7.8;
  const rotorSpinInertia = 0.5 * rotorMass * rotorRadius ** 2;

  const outputGeometryAtTilt = (tiltAngle) => {
    const radial = jointLocal.x
      + outputLeverLength * Math.cos(tiltAngle);
    const endpointY = jointLocal.y
      + outputLeverLength * Math.sin(tiltAngle);
    const verticalSpan = Math.sqrt(
      outputLinkLength ** 2 - radial ** 2,
    );
    const swivelY = endpointY + verticalSpan;
    const radialRatePerTilt = -outputLeverLength * Math.sin(tiltAngle);
    const endpointRatePerTilt = outputLeverLength * Math.cos(tiltAngle);
    const swivelRatePerTilt = endpointRatePerTilt
      - radial * radialRatePerTilt / verticalSpan;
    const radialSecondPerTilt = -outputLeverLength * Math.cos(tiltAngle);
    const endpointSecondPerTilt = -outputLeverLength * Math.sin(tiltAngle);
    const verticalSecondPerTilt = -(
      radialRatePerTilt ** 2 + radial * radialSecondPerTilt
    ) / verticalSpan - (
      radial ** 2 * radialRatePerTilt ** 2
    ) / verticalSpan ** 3;
    return {
      endpointY,
      radial,
      radialRatePerTilt,
      swivelRatePerTilt,
      swivelSecondPerTilt:
        endpointSecondPerTilt + verticalSecondPerTilt,
      swivelY,
      verticalSpan,
    };
  };

  const restOutputGeometry = outputGeometryAtTilt(restTiltAngle);
  const nominalOutputGeometry = outputGeometryAtTilt(nominalTiltAngle);
  const springRate = (
    rotorSpinInertia
    * crownToPinionRatio
    * meanCarrierAngularSpeed ** 2
    * Math.cos(nominalTiltAngle)
  ) / (
    (nominalOutputGeometry.swivelY - restOutputGeometry.swivelY)
    * nominalOutputGeometry.swivelRatePerTilt
  );

  const springTorqueAtTilt = (tiltAngle) => {
    const geometry = outputGeometryAtTilt(tiltAngle);
    return springRate
      * (geometry.swivelY - restOutputGeometry.swivelY)
      * geometry.swivelRatePerTilt;
  };
  const springTorqueSlopeAtTilt = (tiltAngle) => {
    const geometry = outputGeometryAtTilt(tiltAngle);
    return springRate * (
      geometry.swivelRatePerTilt ** 2
      + (geometry.swivelY - restOutputGeometry.swivelY)
        * geometry.swivelSecondPerTilt
    );
  };
  const gyroscopicTorqueAt = (carrierAngularSpeed, tiltAngle) => (
    rotorSpinInertia
    * crownToPinionRatio
    * carrierAngularSpeed ** 2
    * Math.cos(tiltAngle)
  );
  const equilibriumTiltAtCarrierSpeed = (carrierAngularSpeed) => {
    let lower = restTiltAngle;
    let upper = maximumTiltAngle;
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (springTorqueAtTilt(middle)
        < gyroscopicTorqueAt(carrierAngularSpeed, middle)) {
        lower = middle;
      } else {
        upper = middle;
      }
    }
    return (lower + upper) / 2;
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.17,
    roughness: 0.63,
  });
  const fixedMaterial = matte(PALETTE.driven, {
    metalness: 0.19,
    roughness: 0.58,
  });
  const carrierMaterial = matte(PALETTE.driver, {
    metalness: 0.19,
    roughness: 0.55,
  });
  const rotorMaterial = matte(PALETTE.brass, {
    metalness: 0.3,
    roughness: 0.43,
  });
  const linkageMaterial = matte(PALETTE.accent, {
    metalness: 0.23,
    roughness: 0.51,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.3,
    roughness: 0.43,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const base = cylinderAlongY(1.38, 0.22, frameMaterial, 72);
  base.position.y = -3.08;
  base.scale.z = 0.72;
  base.userData.role = 'fixed-cast-base-of-Anderson-governor';
  const baseRim = torusNormalToY(1.08, 0.055, darkMaterial, 80);
  baseRim.position.y = -2.96;
  baseRim.scale.z = 0.72;
  baseRim.userData.role = 'dark-rim-on-governor-base';

  const lowerStandard = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.24, 0.84),
    frameMaterial,
  );
  lowerStandard.position.set(0, -2.39, 0);
  lowerStandard.userData.role = 'fixed-lower-drive-standard';
  const lowerStandardCap = cylinderAlongY(0.49, 0.18, frameMaterial, 48);
  lowerStandardCap.position.y = -1.73;
  lowerStandardCap.userData.role = 'upper-bearing-cap-on-drive-standard';

  const crownGear = makeStationaryCrownGear({
    darkMaterial,
    indexMaterial,
    material: fixedMaterial,
    pitchRadius: crownPitchRadius,
    teeth: crownTeeth,
  });
  crownGear.position.y = carrierCenterY;

  const ringSupportLegs = [-1, 1].map((side) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 2.42, 0.38),
      frameMaterial,
    );
    leg.position.set(side * (crownPitchRadius + 0.22), -0.16, 0);
    leg.rotation.z = side * 0.09;
    leg.userData.role = 'fixed-standard-supporting-stationary-circle-G';
    leg.userData.side = side;
    return leg;
  });

  const outerArchLeft = curveTube(
    new THREE.CubicBezierCurve3(
      new THREE.Vector3(-crownPitchRadius - 0.25, 0.7, 0.05),
      new THREE.Vector3(-3.18, 2.62, 0.05),
      new THREE.Vector3(-2.16, 4.37, 0.05),
      new THREE.Vector3(-0.35, 4.58, 0.05),
    ),
    0.115,
    frameMaterial,
    'left-fixed-arch-above-stationary-circle-G',
  );
  const outerArchRight = curveTube(
    new THREE.CubicBezierCurve3(
      new THREE.Vector3(crownPitchRadius + 0.25, 0.7, 0.05),
      new THREE.Vector3(3.18, 2.62, 0.05),
      new THREE.Vector3(2.16, 4.37, 0.05),
      new THREE.Vector3(0.35, 4.58, 0.05),
    ),
    0.115,
    frameMaterial,
    'right-fixed-arch-above-stationary-circle-G',
  );
  const topBridge = cylinderAlongX(0.13, 0.78, frameMaterial, 36);
  topBridge.position.set(0, 4.58, 0.05);
  topBridge.userData.role = 'top-bridge-supporting-valve-rod-guide';

  const carrierGroup = new THREE.Group();
  carrierGroup.position.y = carrierCenterY;
  carrierGroup.userData.role = 'revolving-frame-H';

  const carrierLowerRing = torusNormalToY(2.08, 0.13,
    carrierMaterial, 120);
  carrierLowerRing.position.y = -0.23;
  carrierLowerRing.userData.role = 'lower-circular-member-of-revolving-frame-H';
  carrierGroup.add(carrierLowerRing);

  const carrierHub = cylinderAlongY(0.38, 0.56, carrierMaterial, 48);
  carrierHub.position.y = -1.82;
  carrierHub.userData.role = 'lower-hub-of-revolving-frame-H';
  carrierGroup.add(carrierHub);

  const carrierCageArms = [];
  for (const side of [-1, 1]) {
    const arm = curveTube(
      new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, -1.72, side * 0.28),
        new THREE.Vector3(side * 0.16, -1.15, side * 1.62),
        new THREE.Vector3(-1.45, -0.38, side * 1.92),
        new THREE.Vector3(jointLocal.x, jointLocal.y - 0.19,
          side * hingeTrunnionRadius),
      ),
      0.1,
      carrierMaterial,
      'curved-bearing-arm-of-revolving-frame-H',
    );
    arm.userData.side = side;
    carrierGroup.add(arm);
    carrierCageArms.push(arm);
  }

  const radialCarrierBeam = new THREE.Mesh(
    new THREE.BoxGeometry(crownPitchRadius * 1.66, 0.18, 0.26),
    carrierMaterial,
  );
  radialCarrierBeam.position.set(-0.43, 0.31, 0);
  radialCarrierBeam.userData.role = 'radial-member-of-revolving-frame-H';
  carrierGroup.add(radialCarrierBeam);

  const hingeBearings = [-1, 1].map((side) => {
    const bearing = cylinderAlongZ(0.17, 0.24, carrierMaterial, 36);
    bearing.position.copy(jointLocal);
    bearing.position.z = side * hingeTrunnionRadius;
    bearing.userData.role = 'hinge-bearing-connecting-piece-B-to-frame-H';
    bearing.userData.side = side;
    carrierGroup.add(bearing);
    return bearing;
  });

  const pinion = makeBevelGear({
    axis: X_AXIS,
    color: PALETTE.driver,
    depth: 0.46,
    radius: pinionPitchRadius,
    teeth: pinionTeeth,
  });
  pinion.position.copy(pinionCenterLocal);
  pinion.userData.role = 'orbiting-bevel-pinion-I';
  carrierGroup.add(pinion);

  const inputRotor = new THREE.Group();
  inputRotor.position.copy(jointLocal);
  inputRotor.userData.role = 'pinion-shaft-B1-input-yoke';
  const inputShaftLength = jointLocal.x - pinionCenterLocal.x;
  const inputShaft = cylinderAlongX(
    shaftRadius,
    inputShaftLength,
    darkMaterial,
    36,
  );
  inputShaft.position.x = -inputShaftLength / 2;
  inputShaft.userData.role = 'shaft-B1-between-pinion-I-and-universal-joint';
  inputRotor.add(inputShaft);
  const inputShaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(inputShaftLength * 0.52, 0.032, 0.09),
    indexMaterial,
  );
  inputShaftIndex.position.set(-inputShaftLength * 0.48, 0, shaftRadius);
  inputShaftIndex.userData.role = 'white-spin-index-on-shaft-B1';
  inputRotor.add(inputShaftIndex);

  const inputYokeNeck = cylinderAlongX(0.18, 0.42,
    carrierMaterial, 36);
  inputYokeNeck.position.x = -0.24;
  inputYokeNeck.userData.role = 'input-yoke-neck-of-universal-joint';
  inputRotor.add(inputYokeNeck);
  const inputYokeArms = [];
  const inputYokeEyes = [];
  for (const side of [-1, 1]) {
    const arm = makeBeam(
      new THREE.Vector3(-0.31, 0, side * 0.09),
      new THREE.Vector3(-0.14, 0, side * (cardanTrunnionRadius - 0.02)),
      { color: PALETTE.driver, depth: 0.12, thickness: 0.12 },
    );
    arm.userData.role = 'input-yoke-arm-of-universal-joint';
    inputRotor.add(arm);
    inputYokeArms.push(arm);
    const eye = torusNormalToZ(0.105, 0.038, carrierMaterial, 32);
    eye.position.z = side * cardanTrunnionRadius;
    eye.userData.role = 'input-yoke-bearing-eye';
    eye.userData.side = side;
    inputRotor.add(eye);
    inputYokeEyes.push(eye);
  }
  carrierGroup.add(inputRotor);

  const tiltGroup = new THREE.Group();
  tiltGroup.position.copy(jointLocal);
  tiltGroup.userData.role =
    'piece-B-hinged-to-revolving-frame-H-about-tangential-axis';
  const hingePins = [-1, 1].map((side) => {
    const pin = cylinderAlongZ(0.073, hingeTrunnionRadius + 0.2,
      darkMaterial, 32);
    pin.position.z = side * hingeTrunnionRadius / 2;
    pin.userData.role = 'tangential-hinge-trunnion-rigid-with-piece-B';
    pin.userData.side = side;
    tiltGroup.add(pin);
    return pin;
  });

  const outputRotor = new THREE.Group();
  outputRotor.userData.role =
    'heavy-wheel-A-piece-B-and-output-yoke-spinning-together';
  tiltGroup.add(outputRotor);

  const rotorDisk = cylinderAlongX(
    rotorRadius,
    rotorWidth,
    rotorMaterial,
    80,
  );
  rotorDisk.position.x = rotorCenterOffset;
  rotorDisk.userData.role = 'heavy-gyroscope-wheel-A';
  outputRotor.add(rotorDisk);
  const rotorFaceRings = [-1, 1].map((side) => {
    const ring = torusNormalToX(rotorRadius * 0.78, 0.042,
      darkMaterial, 96);
    ring.position.x = rotorCenterOffset + side * (rotorWidth / 2 + 0.01);
    ring.userData.role = 'dark-face-ring-on-heavy-wheel-A';
    ring.userData.side = side;
    outputRotor.add(ring);
    return ring;
  });
  const rotorRim = torusNormalToX(rotorRadius, 0.06, darkMaterial, 112);
  rotorRim.position.x = rotorCenterOffset;
  rotorRim.userData.role = 'dark-working-rim-of-heavy-wheel-A';
  outputRotor.add(rotorRim);

  const outputShaft = cylinderAlongX(
    shaftRadius,
    outputLeverLength + 0.34,
    darkMaterial,
    36,
  );
  outputShaft.position.x = (outputLeverLength + 0.1) / 2;
  outputShaft.userData.role = 'tilting-axle-piece-B';
  outputRotor.add(outputShaft);
  const rotorHub = cylinderAlongX(0.24, rotorWidth + 0.02,
    carrierMaterial, 48);
  rotorHub.position.x = rotorCenterOffset;
  rotorHub.userData.role = 'hub-of-heavy-wheel-A-on-piece-B';
  outputRotor.add(rotorHub);
  const rotorFaceIndexes = [-1, 1].map((side) => {
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, rotorRadius * 0.72, 0.075),
      indexMaterial,
    );
    index.position.set(
      rotorCenterOffset + side * (rotorWidth / 2 + 0.025),
      rotorRadius * 0.34,
      0,
    );
    index.userData.role = 'white-spin-index-on-heavy-wheel-A';
    index.userData.side = side;
    outputRotor.add(index);
    return index;
  });
  const rotorIndexBead = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 14),
    indexMaterial,
  );
  rotorIndexBead.position.set(
    rotorCenterOffset + rotorWidth / 2 + 0.03,
    -rotorRadius * 0.54,
    rotorRadius * 0.37,
  );
  rotorIndexBead.userData.role = 'off-axis-index-showing-wheel-A-spin';
  outputRotor.add(rotorIndexBead);

  const outputYokeNeck = cylinderAlongX(0.17, 0.42,
    carrierMaterial, 36);
  outputYokeNeck.position.x = 0.24;
  outputYokeNeck.userData.role = 'output-yoke-neck-rigid-with-piece-B';
  outputRotor.add(outputYokeNeck);
  const outputYokeArms = [];
  const outputYokeEyes = [];
  for (const side of [-1, 1]) {
    const arm = makeBeam(
      new THREE.Vector3(0.31, -side * 0.09, 0),
      new THREE.Vector3(0.14, -side * (cardanTrunnionRadius - 0.02), 0),
      { color: PALETTE.driven, depth: 0.12, thickness: 0.12 },
    );
    arm.userData.role = 'output-yoke-arm-of-universal-joint';
    outputRotor.add(arm);
    outputYokeArms.push(arm);
    const eye = torusNormalToY(0.105, 0.038, fixedMaterial, 32);
    eye.position.y = -side * cardanTrunnionRadius;
    eye.userData.role = 'output-yoke-bearing-eye';
    eye.userData.side = side;
    outputRotor.add(eye);
    outputYokeEyes.push(eye);
  }

  const outputBearingCollar = cylinderAlongX(0.19, 0.26,
    linkageMaterial, 40);
  outputBearingCollar.position.x = outputLeverLength;
  outputBearingCollar.userData.role =
    'nonrotating-bearing-at-outer-end-of-piece-B-for-rods-C';
  tiltGroup.add(outputBearingCollar);
  const outputBearingRim = torusNormalToX(0.14, 0.037,
    darkMaterial, 36);
  outputBearingRim.position.x = outputLeverLength + 0.14;
  outputBearingRim.userData.role = 'outer-end-bearing-rim-on-piece-B';
  tiltGroup.add(outputBearingRim);
  carrierGroup.add(tiltGroup);

  const cardanSpider = new THREE.Group();
  cardanSpider.position.copy(jointLocal);
  cardanSpider.userData.role =
    'cross-spider-of-single-universal-joint-between-B1-and-B';
  const spiderInputTrunnion = cylinderAlongX(
    0.064,
    cardanTrunnionRadius * 2.32,
    rotorMaterial,
    28,
  );
  spiderInputTrunnion.userData.role =
    'spider-trunnion-in-input-yoke-bearings';
  const spiderOutputTrunnion = cylinderAlongY(
    0.064,
    cardanTrunnionRadius * 2.32,
    rotorMaterial,
    28,
  );
  spiderOutputTrunnion.userData.role =
    'perpendicular-spider-trunnion-in-output-yoke-bearings';
  const spiderHub = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 24, 16),
    darkMaterial,
  );
  spiderHub.userData.role = 'central-hub-of-universal-joint-spider';
  cardanSpider.add(spiderInputTrunnion, spiderOutputTrunnion, spiderHub);
  carrierGroup.add(cardanSpider);

  // Brown draws each rod C as a bowed arm from the outer end of B to the
  // swivel under D. The rigid bowed plate carries real eye bores; tangential
  // stub pins on the outer B bearing and on the swivel pass through them.
  const rodCDepth = 0.10;
  const rodCBow = 0.42;
  const rodCPinRadius = 0.06;
  const rodCEyeBore = rodCPinRadius + 0.012;
  const rodCOutline = (() => {
    const eyeRadius = 0.135;
    const halfWidth = 0.05;
    const samples = 40;
    const centre = Array.from({ length: samples + 1 }, (_, i) => {
      const t = i / samples;
      return [outputLinkLength * t, -rodCBow * Math.sin(Math.PI * t)];
    });
    const band = [];
    const back = [];
    centre.forEach(([x, y], i) => {
      const a = centre[Math.max(0, i - 1)];
      const b = centre[Math.min(samples, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      band.push([x - dy / length * halfWidth, y + dx / length * halfWidth]);
      back.push([x + dy / length * halfWidth, y - dx / length * halfWidth]);
    });
    const eye = (cx) => [Array.from({ length: 48 }, (_, i) => [
      cx + eyeRadius * Math.cos(i * Math.PI / 24),
      eyeRadius * Math.sin(i * Math.PI / 24)])];
    const bore = (cx) => [Array.from({ length: 48 }, (_, i) => [
      cx + rodCEyeBore * Math.cos(i * Math.PI / 24),
      rodCEyeBore * Math.sin(i * Math.PI / 24)])];
    const close = (ring) => [[...ring[0], ring[0][0]]];
    return polygonClipping.difference(
      polygonClipping.union(close([[...band, ...back.reverse()]]),
        close(eye(0)), close(eye(outputLinkLength))),
      close(bore(0)), close(bore(outputLinkLength)),
    );
  })();
  const connectingForkC = [-1, 1].map((side) => {
    const link = new THREE.Group();
    const plate = new THREE.Mesh(
      plateGeometry(rodCOutline, -rodCDepth / 2, rodCDepth / 2),
      linkageMaterial,
    );
    plate.userData.role = 'rotating-connecting-rod-C';
    const startAnchor = new THREE.Object3D();
    startAnchor.userData.role = 'analytic-rod-C-end-at-B';
    const endAnchor = new THREE.Object3D();
    endAnchor.userData.role = 'analytic-rod-C-end-at-swivel';
    link.add(plate, startAnchor, endAnchor);
    link.userData.setEndpoints = (start, end) => {
      plate.position.copy(start);
      plate.rotation.set(0, 0, Math.atan2(end.y - start.y, end.x - start.x));
      startAnchor.position.copy(start);
      endAnchor.position.copy(end);
    };
    link.userData.role = 'rotating-connecting-rod-C';
    link.userData.side = side;
    carrierGroup.add(link);
    return link;
  });
  // The rotating swivel is bored for the foot of D; the non-rotating race
  // bears on its top face, and tangential stub pins carry the rods C.
  const rotatingSwivel = new THREE.Mesh(boredLatheGeometry([
    { axial: -0.15, radial: 0.19 }, { axial: 0.15, radial: 0.19 },
  ], 0.075 + 0.012, 48), linkageMaterial);
  rotatingSwivel.userData.role =
    'rotating-lower-member-of-swivel-between-C-and-valve-rod-D';
  const rodCPinOuter = forkLayerOffset + rodCDepth / 2 + 0.05;
  for (const side of [-1, 1]) {
    const stub = cylinderAlongZ(rodCPinRadius, rodCPinOuter - 0.12,
      linkageMaterial, 24);
    stub.position.z = side * (rodCPinOuter + 0.12) / 2;
    stub.userData.role = 'swivel-stub-pin-for-rod-C';
    rotatingSwivel.add(stub);
    const outerStub = cylinderAlongZ(rodCPinRadius, rodCPinOuter - 0.12,
      linkageMaterial, 24);
    outerStub.position.set(outputLeverLength, 0,
      side * (rodCPinOuter + 0.12) / 2);
    outerStub.userData.role = 'outer-B-bearing-stub-pin-for-rod-C';
    tiltGroup.add(outerStub);
  }
  carrierGroup.add(rotatingSwivel);

  // The shaft stops in hub H; wheel A swings low through the space above.
  const verticalCarrierShaft = cylinderAlongY(0.12, 1.4,
    darkMaterial, 36);
  verticalCarrierShaft.position.y = -2.25;
  verticalCarrierShaft.userData.role =
    'vertical-shaft-driving-revolving-frame-H';
  carrierGroup.add(verticalCarrierShaft);

  const carrierDriveGear = makeBevelGear({
    axis: Y_AXIS,
    color: PALETTE.driver,
    depth: 0.5,
    radius: 0.62,
    teeth: 18,
  });
  carrierDriveGear.position.set(0, -2.77, 0);
  carrierDriveGear.userData.role =
    'vertical-bevel-gear-driving-revolving-frame-H';
  carrierGroup.add(carrierDriveGear);

  const engineInputGear = makeBevelGear({
    axis: Z_AXIS,
    color: PALETTE.driven,
    depth: 0.5,
    radius: 0.62,
    teeth: 18,
  });
  engineInputGear.position.set(0, -2.39, -0.62);
  engineInputGear.userData.role = 'engine-input-bevel-gear-M';
  const engineInputShaft = cylinderAlongZ(0.13, 2.0,
    darkMaterial, 36);
  engineInputShaft.position.set(0, 0, -0.72);
  engineInputShaft.userData.role = 'horizontal-engine-input-shaft-M';
  const engineInputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.72),
    indexMaterial,
  );
  engineInputIndex.position.set(0.13, 0, -0.96);
  engineInputIndex.userData.role = 'white-index-on-engine-input-shaft-M';
  const engineInputRotor = new THREE.Group();
  engineInputRotor.position.set(0, -2.39, -0.62);
  engineInputRotor.userData.role = 'engine-input-shaft-M-rotor';
  engineInputRotor.add(engineInputShaft, engineInputIndex);

  // D runs up through a guide in the casing peak; rod P's pin sits below it.
  const valveRodLength = 1.45;
  const valveRodPinHeight = 0.86;
  const valveRodD = cylinderAlongY(0.075, valveRodLength,
    linkageMaterial, 32);
  valveRodD.userData.role = 'nonrotating-vertically-moving-valve-rod-D';
  const valveRodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.08, 0.12),
    indexMaterial,
  );
  valveRodIndex.userData.role = 'white-travel-index-on-valve-rod-D';
  const fixedSwivelRace = new THREE.Mesh(boredLatheGeometry([
    { axial: 0.155, radial: 0.23 }, { axial: 0.215, radial: 0.23 },
  ], 0.074, 48), darkMaterial);
  fixedSwivelRace.userData.role =
    'stationary-upper-race-of-C-to-D-rotation-isolating-swivel';
  const valveRodGuide = cylinderAlongY(0.14, 0.34,
    frameMaterial, 36);
  valveRodGuide.position.set(0, 4.76, 0);
  valveRodGuide.userData.role = 'fixed-guide-for-vertical-valve-rod-D';

  const leverPivot2 = new THREE.Vector2(-1.75, 4.45);
  const leverShortRadius = 0.68;
  const rodPLength = 1.25;
  const springArmLength = 1.45;
  const leverPlaneZ = 0.37;
  // Brown hooks L to the casing lip outside the bell.
  const springLowerAnchor = new THREE.Vector3(-3.5, 1.2, leverPlaneZ);
  const leverPivot = new THREE.Vector3(
    leverPivot2.x,
    leverPivot2.y,
    leverPlaneZ,
  );
  // Lever N is one rigid bored bar turning on a slim fixed pin; rod P rides
  // a pin on its short arm in a separate front layer and a pin on valve rod D.
  const leverDepth = 0.12;
  const rodPPlaneZ = leverPlaneZ + 0.13;
  const leverPivotBearing = cylinderAlongZ(0.07, 0.27,
    darkMaterial, 36);
  leverPivotBearing.position.set(leverPivot.x, leverPivot.y, 0.325);
  leverPivotBearing.userData.role = 'fixed-pivot-of-lever-N';
  const leverPArm = new THREE.Mesh(
    plateGeometry(boredBarOutline([
      { x: -springArmLength, eye: 0.1, bore: 0.05 },
      { x: 0, eye: 0.15, bore: 0.082 },
      { x: leverShortRadius, eye: 0.12, bore: 0.062 },
    ], 0.06), leverPlaneZ - leverDepth / 2, leverPlaneZ + leverDepth / 2),
    linkageMaterial,
  );
  leverPArm.position.set(leverPivot.x, leverPivot.y, 0);
  leverPArm.userData.role = 'rigid-bored-lever-N-for-rod-P-and-spring-L';
  const leverPPin = cylinderAlongZ(0.05, rodPPlaneZ + 0.07 - 0.31,
    darkMaterial, 28);
  leverPPin.position.set(leverShortRadius, 0, (rodPPlaneZ + 0.07 + 0.31) / 2);
  leverPPin.userData.role = 'pin-on-short-arm-of-lever-N-for-rod-P';
  leverPArm.add(leverPPin);
  const leverSpringArm = leverPArm;
  const rodP = makeBoredPlanarLink({
    boreRadius: 0.062,
    depth: 0.1,
    eyeRadius: 0.115,
    length: rodPLength,
    width: 0.1,
  }, linkageMaterial);
  rodP.userData.role = 'rod-P-between-lever-N-and-valve-rod-D';
  const valveRodPPin = cylinderAlongZ(0.05, rodPPlaneZ + 0.07, darkMaterial, 28);
  valveRodPPin.position.set(0, valveRodPinHeight - valveRodLength / 2,
    (rodPPlaneZ + 0.07) / 2);
  valveRodPPin.userData.role = 'pin-on-valve-rod-D-for-rod-P';
  valveRodD.add(valveRodPPin);
  const springL = makeCoilSpring(darkMaterial);
  springL.userData.role = 'spring-L-opposing-gyroscope-rise';
  const springLowerEye = torusNormalToZ(0.15, 0.045,
    frameMaterial, 32);
  springLowerEye.position.copy(springLowerAnchor);
  springLowerEye.userData.role = 'fixed-lower-anchor-of-spring-L';

  root.add(
    base,
    baseRim,
    lowerStandard,
    lowerStandardCap,
    crownGear,
    ...ringSupportLegs,
    outerArchLeft,
    outerArchRight,
    topBridge,
    carrierGroup,
    engineInputGear,
    engineInputRotor,
    valveRodD,
    valveRodIndex,
    fixedSwivelRace,
    valveRodGuide,
    leverPivotBearing,
    leverPArm,
    rodP,
    springL,
    springLowerEye,
  );

  const carrierRateAtTime = (time) => (
    meanCarrierAngularSpeed
    + carrierSpeedAmplitude * Math.sin(speedCycleRate * time)
  );
  const carrierAccelerationAtTime = (time) => (
    carrierSpeedAmplitude
    * speedCycleRate
    * Math.cos(speedCycleRate * time)
  );
  const carrierAngleAtTime = (time) => (
    sourceCarrierYaw
    + meanCarrierAngularSpeed * time
    + carrierSpeedAmplitude / speedCycleRate
      * (1 - Math.cos(speedCycleRate * time))
  );

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cyclePeriod;
    const cyclePhase = THREE.MathUtils.euclideanModulo(cycleCoordinate, 1);
    const carrierAngle = carrierAngleAtTime(time);
    const carrierAngularSpeed = carrierRateAtTime(time);
    const carrierAngularAcceleration = carrierAccelerationAtTime(time);
    const tiltAngle = equilibriumTiltAtCarrierSpeed(carrierAngularSpeed);
    const geometry = outputGeometryAtTilt(tiltAngle);
    const springTorque = springTorqueAtTilt(tiltAngle);
    const gyroscopicTorque = gyroscopicTorqueAt(
      carrierAngularSpeed,
      tiltAngle,
    );
    const equilibriumDenominator = springTorqueSlopeAtTilt(tiltAngle)
      + rotorSpinInertia
        * crownToPinionRatio
        * carrierAngularSpeed ** 2
        * Math.sin(tiltAngle);
    const tiltRatePerCarrierSpeed = (
      2
      * rotorSpinInertia
      * crownToPinionRatio
      * carrierAngularSpeed
      * Math.cos(tiltAngle)
    ) / equilibriumDenominator;
    const tiltAngularSpeed = tiltRatePerCarrierSpeed
      * carrierAngularAcceleration;
    const inputAngle = sourceInputShaftPhase
      + crownToPinionRatio * (carrierAngle - sourceCarrierYaw);
    const inputAngularSpeed = crownToPinionRatio * carrierAngularSpeed;

    const inputTrunnionAxisLocal = Z_AXIS.clone()
      .applyAxisAngle(X_AXIS, inputAngle)
      .normalize();
    const outputAxisLocal = X_AXIS.clone()
      .applyAxisAngle(Z_AXIS, tiltAngle)
      .normalize();
    const outputBearingReferenceLocal = outputAxisLocal.clone()
      .cross(Z_AXIS)
      .normalize();
    const outputTangentReferenceLocal = outputAxisLocal.clone()
      .cross(outputBearingReferenceLocal)
      .normalize();
    const outputTrunnionAxisLocal = new THREE.Vector3()
      .crossVectors(outputAxisLocal, inputTrunnionAxisLocal)
      .normalize();
    const outputPrincipalAngle = Math.atan2(
      outputTrunnionAxisLocal.dot(outputTangentReferenceLocal),
      outputTrunnionAxisLocal.dot(outputBearingReferenceLocal),
    );
    const outputAngle = outputPrincipalAngle + fullTurn * Math.round(
      (inputAngle - outputPrincipalAngle) / fullTurn,
    );
    const cosineTilt = Math.cos(tiltAngle);
    const sineTilt = Math.sin(tiltAngle);
    const speedDenominator = 1
      - sineTilt ** 2 * Math.sin(inputAngle) ** 2;
    const outputAngularSpeed = (
      cosineTilt * inputAngularSpeed
      - sineTilt
        * tiltAngularSpeed
        * Math.sin(inputAngle)
        * Math.cos(inputAngle)
    ) / speedDenominator;
    const spiderNormalLocal = new THREE.Vector3()
      .crossVectors(inputTrunnionAxisLocal, outputTrunnionAxisLocal)
      .normalize();
    const spiderQuaternionLocal = new THREE.Quaternion()
      .setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        inputTrunnionAxisLocal,
        outputTrunnionAxisLocal,
        spiderNormalLocal,
      ));

    const carrierQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Y_AXIS,
      carrierAngle,
    );
    const carrierOrigin = new THREE.Vector3(0, carrierCenterY, 0);
    const localToWorld = (point) => point.clone()
      .applyQuaternion(carrierQuaternion)
      .add(carrierOrigin);
    const localDirectionToWorld = (direction) => direction.clone()
      .applyQuaternion(carrierQuaternion)
      .normalize();
    const outputAxis = localDirectionToWorld(outputAxisLocal);
    const inputAxis = localDirectionToWorld(X_AXIS);
    const hingeAxis = localDirectionToWorld(Z_AXIS);
    const inputTrunnionAxis = localDirectionToWorld(
      inputTrunnionAxisLocal,
    );
    const outputTrunnionAxis = localDirectionToWorld(
      outputTrunnionAxisLocal,
    );
    const jointCenter = localToWorld(jointLocal);
    const rotorCenter = localToWorld(
      jointLocal.clone().addScaledVector(outputAxisLocal, rotorCenterOffset),
    );
    const outputBearingCenterLocal = jointLocal.clone()
      .addScaledVector(outputAxisLocal, outputLeverLength);
    const outputBearingCenter = localToWorld(outputBearingCenterLocal);
    const rotatingSwivelLocal = new THREE.Vector3(0, geometry.swivelY, 0);
    const valveSwivelCenter = localToWorld(rotatingSwivelLocal);
    const connectingRodEndpointsLocal = [-1, 1].map((side) => ({
      end: rotatingSwivelLocal.clone().add(
        new THREE.Vector3(0, 0, side * forkLayerOffset),
      ),
      start: outputBearingCenterLocal.clone().add(
        new THREE.Vector3(0, 0, side * forkLayerOffset),
      ),
    }));

    const crownContactPoint = localToWorld(crownContactLocal);
    const pinionCenter = localToWorld(pinionCenterLocal);
    const carrierContactVelocity = new THREE.Vector3().crossVectors(
      Y_AXIS.clone().multiplyScalar(carrierAngularSpeed),
      crownContactPoint.clone().sub(carrierOrigin),
    );
    const pinionRelativeAngularVelocity = inputAxis.clone()
      .multiplyScalar(inputAngularSpeed);
    const pinionRelativeContactVelocity = new THREE.Vector3().crossVectors(
      pinionRelativeAngularVelocity,
      crownContactPoint.clone().sub(pinionCenter),
    );
    const pinionContactVelocity = carrierContactVelocity.clone()
      .add(pinionRelativeContactVelocity);

    const valveRodBottomY = valveSwivelCenter.y;
    const valveRodTopY = valveRodBottomY + valveRodLength;
    const valveRodPin = new THREE.Vector3(
      0,
      valveRodBottomY + valveRodPinHeight,
      leverPlaneZ,
    );
    const leverConnection2 = circleIntersection({
      centerA: leverPivot2,
      centerB: new THREE.Vector2(valveRodPin.x, valveRodPin.y),
      radiusA: leverShortRadius,
      radiusB: rodPLength,
      side: -1,
    });
    const leverConnection = new THREE.Vector3(
      leverConnection2.x,
      leverConnection2.y,
      leverPlaneZ,
    );
    const leverDirection = leverConnection.clone()
      .sub(leverPivot)
      .normalize();
    const springArmDirection = new THREE.Vector3(
      -leverDirection.x,
      -leverDirection.y,
      0,
    );
    const springUpperAnchor = leverPivot.clone()
      .addScaledVector(springArmDirection, springArmLength);
    const springVisualLength = springUpperAnchor.distanceTo(
      springLowerAnchor,
    );

    const meanRotorSpinAngularSpeed =
      crownToPinionRatio * carrierAngularSpeed;
    const averagedSpinAngularMomentum = outputAxis.clone()
      .multiplyScalar(rotorSpinInertia * meanRotorSpinAngularSpeed);
    return {
      averagedSpinAngularMomentum,
      carrierAngle,
      carrierAngularAcceleration,
      carrierAngularSpeed,
      carrierContactVelocity,
      carrierOrigin,
      connectingRodEndpointsLocal,
      crownContactPoint,
      cycleCoordinate,
      cyclePhase,
      effectiveSpringExtension:
        geometry.swivelY - restOutputGeometry.swivelY,
      effectiveSpringForce: springRate
        * (geometry.swivelY - restOutputGeometry.swivelY),
      engineInputAngle: carrierAngle,
      engineInputAngularSpeed: carrierAngularSpeed,
      equilibriumError: springTorque - gyroscopicTorque,
      gyroscopicTorque,
      hingeAxis,
      inputAngle,
      inputAngularSpeed,
      inputAxis,
      inputBearingCenters: [-1, 1].map((side) => jointCenter.clone()
        .addScaledVector(
          inputTrunnionAxis,
          side * cardanTrunnionRadius,
        )),
      inputTrunnionAxis,
      jointCenter,
      leverConnection,
      meanRotorSpinAngularSpeed,
      outputAngle,
      outputAngularSpeed,
      outputAxis,
      outputBearingCenter,
      outputBearingReferenceLocal,
      outputGeometry: geometry,
      outputTangentReferenceLocal,
      outputTrunnionAxis,
      outputBearingCenters: [-1, 1].map((side) => jointCenter.clone()
        .addScaledVector(
          outputTrunnionAxis,
          side * cardanTrunnionRadius,
        )),
      pinionCenter,
      pinionContactVelocity,
      pinionRelativeAngularVelocity,
      pinionRelativeContactVelocity,
      rodPLengthError: leverConnection.distanceTo(valveRodPin)
        - rodPLength,
      rotorCenter,
      speedDenominator,
      spiderNormalLocal,
      spiderQuaternionLocal,
      springArmDirection,
      springTorque,
      springUpperAnchor,
      springVisualLength,
      tiltAngle,
      tiltAngularSpeed,
      tiltRatePerCarrierSpeed,
      trunnionOrthogonalityError: Math.abs(
        inputTrunnionAxis.dot(outputTrunnionAxis),
      ),
      universalJointAngle: Math.acos(THREE.MathUtils.clamp(
        inputAxis.dot(outputAxis),
        -1,
        1,
      )),
      valveRodBottomY,
      valveRodPin,
      valveRodTopY,
      valveRodTravel: geometry.swivelY
        - nominalOutputGeometry.swivelY,
      valveSwivelCenter,
    };
  };

  const contacts = {
    crownGearMesh: {
      pitchPoint: new THREE.Vector3(),
      velocityError: 0,
    },
    engineBevelMesh: {
      ratioError: 0,
      velocityError: 0,
    },
    outputFork: {
      lengthErrors: [0, 0],
    },
    pieceBHinge: {
      axis: new THREE.Vector3(),
      centerError: 0,
    },
    universalJoint: {
      centerError: 0,
      trunnionOrthogonalityError: 0,
    },
  };

  const lowerDrivePitchRadius = 0.62;
  const lowerDriveContactPoint = new THREE.Vector3(0, -1.77, -0.62);
  const inputDriveCenter = new THREE.Vector3(0, -2.39, -0.62);
  const carrierDriveCenter = new THREE.Vector3(0, -1.77, 0);

  const update = (time) => {
    const state = stateAtTime(time);
    carrierGroup.rotation.set(0, state.carrierAngle, 0);
    inputRotor.rotation.set(state.inputAngle, 0, 0);
    tiltGroup.rotation.set(0, 0, state.tiltAngle);
    outputRotor.rotation.set(state.outputAngle, 0, 0);
    cardanSpider.quaternion.copy(state.spiderQuaternionLocal);
    setSpin(pinion, state.inputAngle);
    setSpin(carrierDriveGear, 0);
    setSpin(engineInputGear, state.engineInputAngle);
    engineInputRotor.rotation.set(0, 0, state.engineInputAngle);

    state.connectingRodEndpointsLocal.forEach(({ start, end }, index) => {
      connectingForkC[index].userData.setEndpoints(start, end);
    });
    rotatingSwivel.position.set(0, state.outputGeometry.swivelY, 0);
    valveRodD.position.set(
      0,
      (state.valveRodBottomY + state.valveRodTopY) / 2,
      0,
    );
    valveRodIndex.position.set(0.1, state.valveRodTopY - 0.2, 0);
    fixedSwivelRace.position.copy(state.valveSwivelCenter);
    leverPArm.rotation.set(0, 0, Math.atan2(
      state.leverConnection.y - leverPivot.y,
      state.leverConnection.x - leverPivot.x,
    ));
    rodP.userData.setEndpoints(
      state.leverConnection.clone().setZ(rodPPlaneZ),
      state.valveRodPin.clone().setZ(rodPPlaneZ),
    );
    springL.userData.setEndpoints(springLowerAnchor,
      state.springUpperAnchor);

    const inputDriveAngularVelocity = Z_AXIS.clone()
      .multiplyScalar(state.engineInputAngularSpeed);
    const carrierDriveAngularVelocity = Y_AXIS.clone()
      .multiplyScalar(state.carrierAngularSpeed);
    const inputDriveVelocity = new THREE.Vector3().crossVectors(
      inputDriveAngularVelocity,
      lowerDriveContactPoint.clone().sub(inputDriveCenter),
    );
    const carrierDriveVelocity = new THREE.Vector3().crossVectors(
      carrierDriveAngularVelocity,
      lowerDriveContactPoint.clone().sub(carrierDriveCenter),
    );
    contacts.engineBevelMesh.ratioError =
      state.engineInputAngularSpeed / state.carrierAngularSpeed - 1;
    contacts.engineBevelMesh.velocityError = inputDriveVelocity.distanceTo(
      carrierDriveVelocity,
    );
    contacts.crownGearMesh.pitchPoint.copy(state.crownContactPoint);
    contacts.crownGearMesh.velocityError =
      state.pinionContactVelocity.length();
    contacts.outputFork.lengthErrors =
      state.connectingRodEndpointsLocal.map(({ start, end }) => (
        start.distanceTo(end) - outputLinkLength
      ));
    contacts.pieceBHinge.axis.copy(state.hingeAxis);
    contacts.pieceBHinge.centerError = state.jointCenter.distanceTo(
      state.carrierOrigin.clone().add(
        jointLocal.clone().applyAxisAngle(Y_AXIS, state.carrierAngle),
      ),
    );
    contacts.universalJoint.centerError = cardanSpider
      .getWorldPosition(new THREE.Vector3())
      .distanceTo(state.jointCenter);
    contacts.universalJoint.trunnionOrthogonalityError =
      state.trunnionOrthogonalityError;
    root.userData.kinematics = state;
  };

  root.userData.archetype = 'anderson-gyroscope-spring-governor';
  root.userData.blocks = {
    base,
    baseRim,
    cardanSpider,
    carrierCageArms,
    carrierDriveGear,
    carrierGroup,
    carrierHub,
    carrierLowerRing,
    connectingForkC,
    crownGear,
    engineInputGear,
    engineInputIndex,
    engineInputRotor,
    engineInputShaft,
    fixedSwivelRace,
    hingeBearings,
    hingePins,
    inputRotor,
    inputShaft,
    inputShaftIndex,
    inputYokeArms,
    inputYokeEyes,
    leverPArm,
    leverPivotBearing,
    leverSpringArm,
    lowerStandard,
    outputBearingCollar,
    outputBearingRim,
    outputRotor,
    outputShaft,
    outputYokeArms,
    outputYokeEyes,
    pinion,
    radialCarrierBeam,
    ringSupportLegs,
    rodP,
    rotatingSwivel,
    rotorDisk,
    rotorFaceIndexes,
    rotorFaceRings,
    rotorHub,
    rotorIndexBead,
    rotorRim,
    spiderHub,
    spiderInputTrunnion,
    spiderOutputTrunnion,
    springL,
    springLowerEye,
    tiltGroup,
    valveRodD,
    valveRodGuide,
    valveRodIndex,
    verticalCarrierShaft,
  };
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.42, -3.25, -3.06),
    new THREE.Vector3(3.42, 4.82, 3.06),
  );
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'engine rotation drives revolving frame H about the vertical axis',
    mechanism: 2,
    output:
      'one spring-balanced tilt of axle piece B raises valve rod D through rotating rods C and a coaxial swivel',
    spin:
      'pinion I rolling around fixed toothed circle G drives wheel A through one Cardan joint',
  };
  root.userData.dynamics = {
    equilibriumTiltAtCarrierSpeed,
    gyroscopicTorqueAt,
    nominalTiltAngle,
    restTiltAngle,
    rotorMass,
    rotorSpinInertia,
    springRate,
    springTorqueAtTilt,
    springTorqueSlopeAtTilt,
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    cardanTrunnionRadius,
    carrierCenterY,
    carrierSpeedAmplitude,
    crownContactLocal: crownContactLocal.clone(),
    crownPitchRadius,
    crownTeeth,
    cyclePeriod,
    forkLayerOffset,
    fullTurn,
    hingeTrunnionRadius,
    jointLocal: jointLocal.clone(),
    leverPivot: leverPivot.clone(),
    leverShortRadius,
    maximumTiltAngle,
    meanCarrierAngularSpeed,
    nominalOutputGeometry,
    nominalTiltAngle,
    outputGeometryAtTilt,
    outputLeverLength,
    outputLinkLength,
    pinionCenterLocal: pinionCenterLocal.clone(),
    pinionPitchRadius,
    pinionTeeth,
    restOutputGeometry,
    restTiltAngle,
    rodPLength,
    rotorCenterOffset,
    rotorRadius,
    rotorWidth,
    sourceCarrierYaw,
    sourceInputShaftPhase,
    speedCycleRate,
    springArmLength,
    springLowerAnchor: springLowerAnchor.clone(),
    valveRodLength,
  };
  root.userData.mechanism =
    'engine-bevel-drive-turns-revolving-frame-H-carrying-pinion-I-around-stationary-toothed-circle-G-so-pinion-shaft-B1-drives-heavy-wheel-A-through-one-universal-joint-while-piece-B-hinges-in-H-and-its-speed-dependent-gyroscopic-torque-balances-spring-L-to-move-valve-rod-D-through-rods-C-and-P-and-lever-N';
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    pageMarksAnimationUnavailable: true,
    sourcePrescribedTiming: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate357: {
      diskBottom: sourceDiskBottomRaster.clone(),
      diskTop: sourceDiskTopRaster.clone(),
      driveAxis: sourceDriveAxisRaster.clone(),
      floor: sourceFloorRaster.clone(),
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      measurementUncertaintyPixels: 12,
      outputBearing: sourceOutputBearingRaster.clone(),
      pinionCenterI: sourcePinionCenterRaster.clone(),
      ringCenterG: sourceRingCenterRaster.clone(),
      ringLeftG: sourceRingLeftRaster.clone(),
      ringRightG: sourceRingRightRaster.clone(),
      rotorHinge: sourceRotorHingeRaster.clone(),
      springBottomL: sourceSpringBottomRaster.clone(),
      springTopL: sourceSpringTopRaster.clone(),
      universalJointBB1: sourceUniversalJointRaster.clone(),
      valveSwivelD: sourceValveSwivelRaster.clone(),
    },
    contemporaryDetail: {
      publication: 'Scientific American, New Series, volume III, number 13',
      publicationDate: '1860-09-22',
      title: 'Improved Gyrascope Steam Engine Governor',
      use:
        'clarifies the fixed crown ring, orbiting pinion, rotating carrier cage, lower bevel input, central swivel, and external spring linkage obscured in Brown’s reduced plate',
    },
    labels: {
      A: 'heavy gyroscope wheel or disk',
      B: 'tilting wheel axle hinged at its middle to revolving frame H',
      B1: 'pinion axle joined to B by a universal joint',
      C: 'paired rotating rods from axle B to the valve-rod swivel',
      D: 'nonrotating vertically moving valve rod',
      G: 'stationary toothed circle',
      H: 'revolving frame driven by the engine bevel gears',
      I: 'pinion carried around stationary circle G',
      L: 'spring opposing the wheel’s tendency to rise',
      N: 'spring lever',
      P: 'rod connecting lever N to valve rod D',
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    cardanLaw:
      'the single Hooke joint obeys tan(output phase) = cos(tilt) tan(input phase), including its twice-per-turn velocity ripple',
    crownMesh:
      'pinion I rolls without slip around fixed crown circle G; omega_I/Omega_H = teeth_G/teeth_I = pitchRadius_G/pitchRadius_I = 5',
    cyclePeriod,
    demonstrationScope:
      'the source provides no timing; the eight-second slow speed sweep is an explicit quasi-static governor demonstration',
    governorBalance:
      'cycle-averaged gyroscopic moment I_spin*(5 Omega_H)*Omega_H*cos(tilt) balances the effective spring force on rod D by virtual work',
    valveLinkage:
      'two equal rods C rotate with H and meet a coaxial swivel, allowing D, P, N, and spring L to remain in the stationary frame',
  };

  update(0);
  markShadows(root);
  correctAndersonGovernor(root, update);
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredAndersonGovernorMovement(movement) {
  if (movement.id === 357) return andersonGyroscopeGovernor(movement);
  return null;
}
