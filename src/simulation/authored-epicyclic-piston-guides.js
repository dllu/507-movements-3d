import {correctEpicyclicGuide,finishPistonGuides} from './piston-guide-329-331-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeGear,
  makeInvoluteInternalGear,
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

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 48,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function annulusGeometry(outerRadius, innerRadius, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  hole.closePath();
  shape.holes.push(hole);
  return centeredExtrusion(shape, depth);
}

function beamBetween2D(start, end, width, depth, material, z) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.set(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    z,
  );
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function makeCarrierFlywheel({
  carrierCrankRadius,
  carrierPlaneZ,
  darkMaterial,
  driverMaterial,
  flywheelDepth,
  flywheelInnerRadius,
  flywheelOuterRadius,
  flywheelPlaneZ,
  planetGearPlaneZ,
  sourceScale,
  whiteMaterial,
}) {
  const carrier = new THREE.Group();
  carrier.userData.axis = Z_AXIS.clone();
  carrier.userData.role =
    'one-rigid-input-flywheel-shaft-plate-C-and-carrier-crank';

  const flywheelRim = new THREE.Mesh(
    annulusGeometry(
      flywheelOuterRadius,
      flywheelInnerRadius,
      flywheelDepth,
    ),
    driverMaterial,
  );
  flywheelRim.position.z = flywheelPlaneZ;
  flywheelRim.userData.role = 'plate-C-input-flywheel-rim';

  const hubRadius = 1.12 * sourceScale;
  const spokeInnerRadius = hubRadius * 0.72;
  const spokeLength = flywheelInnerRadius - spokeInnerRadius + 0.08;
  const spokeCenterRadius = (flywheelInnerRadius + spokeInnerRadius) / 2;
  const flywheelSpokes = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = Math.PI / 4 + index * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        spokeLength,
        0.82 * sourceScale,
        flywheelDepth * 0.76,
      ),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * spokeCenterRadius,
      Math.sin(angle) * spokeCenterRadius,
      flywheelPlaneZ,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `plate-C-rigid-flywheel-spoke-${index + 1}`;
    flywheelSpokes.push(spoke);
  }

  const centralPlateC = cylinderAlongZ(
    1.75 * sourceScale,
    0.20,
    driverMaterial,
    48,
  );
  centralPlateC.position.z = carrierPlaneZ;
  centralPlateC.userData.role = 'shaft-fast-central-plate-C';
  const carrierCrankArmC = new THREE.Mesh(
    new THREE.BoxGeometry(
      carrierCrankRadius,
      0.70 * sourceScale,
      0.18,
    ),
    driverMaterial,
  );
  carrierCrankArmC.position.set(
    carrierCrankRadius / 2,
    0,
    carrierPlaneZ,
  );
  carrierCrankArmC.userData.role =
    'source-animation-replacement-crank-arm-for-circular-plate-C';
  const shaft = cylinderAlongZ(
    0.72 * sourceScale,
    planetGearPlaneZ - flywheelPlaneZ + 0.74,
    darkMaterial,
    40,
  );
  shaft.position.z = (planetGearPlaneZ + flywheelPlaneZ) / 2;
  shaft.userData.axis = Z_AXIS.clone();
  shaft.userData.role = 'live-shaft-fast-with-plate-C';
  const hub = cylinderAlongZ(
    hubRadius,
    // Ends short of the fixed main bearing's rear face (z=-0.37).
    flywheelDepth * 1.20,
    driverMaterial,
    44,
  );
  hub.position.z = flywheelPlaneZ;
  hub.userData.role = 'input-flywheel-hub-fast-with-plate-C';

  const carrierCrankPin = cylinderAlongZ(
    0.36 * sourceScale,
    planetGearPlaneZ - carrierPlaneZ + 0.58,
    darkMaterial,
    34,
  );
  carrierCrankPin.position.set(
    carrierCrankRadius,
    0,
    (planetGearPlaneZ + carrierPlaneZ) / 2,
  );
  carrierCrankPin.userData.role =
    'carrier-crank-pin-on-which-planet-wheel-B-turns';
  const carrierCrankPinAnchor = new THREE.Object3D();
  carrierCrankPinAnchor.position.set(
    carrierCrankRadius,
    0,
    planetGearPlaneZ,
  );
  carrierCrankPinAnchor.userData.role =
    'analytic-carrier-crank-pin-and-planet-center';
  const flywheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.30 * sourceScale,
      (flywheelOuterRadius - flywheelInnerRadius) * 0.78,
      0.034,
    ),
    whiteMaterial,
  );
  flywheelIndex.position.set(
    0,
    (flywheelOuterRadius + flywheelInnerRadius) / 2,
    flywheelPlaneZ + flywheelDepth / 2 + 0.026,
  );
  flywheelIndex.userData.role = 'white-index-fast-with-plate-C';
  const carrierIndex = new THREE.Mesh(
    new THREE.BoxGeometry(carrierCrankRadius * 0.54, 0.055, 0.032),
    whiteMaterial,
  );
  carrierIndex.position.set(
    carrierCrankRadius * 0.34,
    0,
    carrierPlaneZ + 0.12,
  );
  carrierIndex.userData.role = 'white-index-on-carrier-crank-C';

  carrier.add(
    flywheelRim,
    ...flywheelSpokes,
    hub,
    shaft,
    centralPlateC,
    carrierCrankArmC,
    carrierCrankPin,
    carrierCrankPinAnchor,
    flywheelIndex,
    carrierIndex,
  );
  return {
    carrier,
    carrierCrankArmC,
    carrierCrankPin,
    carrierCrankPinAnchor,
    carrierIndex,
    centralPlateC,
    flywheelIndex,
    flywheelRim,
    flywheelSpokes,
    hub,
    shaft,
  };
}

function FixedAnnulusAndFrame({
  darkMaterial,
  fixedRingDepth,
  fixedRingOuterRadius,
  fixedRingPitchRadius,
  fixedRingTeeth,
  frameMaterial,
  gearModule,
  gearPlaneZ,
  sourceScale,
}) {
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-frame-bearing-and-stationary-internal-gear-D';

  const fixedRingD = makeInvoluteInternalGear({
    color: PALETTE.frame,
    depth: fixedRingDepth,
    module: gearModule,
    outerRadius: fixedRingOuterRadius,
    pitchRadius: fixedRingPitchRadius,
    teeth: fixedRingTeeth,
    toothIndexOffset: 0,
    backlash: .001,
    flankSamples: 18,
    chamfer: 0,
  });
  fixedRingD.position.z = gearPlaneZ;
  fixedRingD.userData.fixed = true;
  fixedRingD.userData.role =
    'stationary-forty-eight-tooth-internally-toothed-gear-D';
  const annulusOuterBand = new THREE.Mesh(
    new THREE.TorusGeometry(
      fixedRingOuterRadius - 0.035,
      0.040,
      8,
      96,
    ),
    darkMaterial,
  );
  annulusOuterBand.position.z = gearPlaneZ + fixedRingDepth / 2 + 0.025;
  annulusOuterBand.userData.fixed = true;
  annulusOuterBand.userData.role = 'fixed-outer-band-of-gear-D';
  // Only the drawn outer edge of D: hidden reference, not a dark rim.
  annulusOuterBand.visible = false;
  annulusOuterBand.userData.retiredInkOutline = true;

  const centralBearing = cylinderAlongZ(
    0.88 * sourceScale,
    0.66,
    frameMaterial,
    44,
  );
  centralBearing.position.z = -0.08;
  centralBearing.userData.fixed = true;
  centralBearing.userData.role = 'fixed-central-main-shaft-bearing';
  const centralBore = cylinderAlongZ(
    0.48 * sourceScale,
    0.70,
    darkMaterial,
    36,
  );
  centralBore.position.z = -0.06;
  centralBore.userData.fixed = true;
  centralBore.userData.role = 'fixed-main-bearing-bore';

  const sideBearings = [];
  const supportLegs = [];
  for (const side of [-1, 1]) {
    const sideName = side < 0 ? 'left' : 'right';
    const bearing = cylinderAlongZ(
      1.0 * sourceScale,
      0.54,
      frameMaterial,
      42,
    );
    bearing.position.set(side * fixedRingOuterRadius, 0, -0.16);
    bearing.userData.fixed = true;
    bearing.userData.role = `${sideName}-fixed-annulus-D-bearing-boss`;
    sideBearings.push(bearing);
    // Brown draws each leg as one broad flat bar, not a pair of rods.
    for (const offset of [0]) {
      const leg = beamBetween2D(
        new THREE.Vector2(
          side * fixedRingOuterRadius + offset,
          -0.10,
        ),
        // Brown's legs run off the plate's foot; they continue on the same
        // line down to the level of the cylinder's foot (y = -6.842) and end
        // there cleanly (Brown draws no bed plate).
        new THREE.Vector2(
          side * fixedRingOuterRadius + offset + (side * 14.1 * sourceScale
            - side * fixedRingOuterRadius) * (6.842 - 0.10) / (20.15 * sourceScale - 0.10),
          -6.842,
        ),
        0.32,
        0.26,
        frameMaterial,
        // Kept ahead of the flywheel rim and arms (back face z=-0.37 against
        // the rim's -0.40) so the rotating wheel never passes through them.
        -0.24,
      );
      leg.userData.fixed = true;
      leg.userData.role = `${sideName}-A-frame-support-leg`;
      supportLegs.push(leg);
    }
  }

  const cylinderRadius = 3 * sourceScale;
  const cylinderHeight = 5 * sourceScale;
  const cylinderBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderRadius,
      cylinderRadius,
      cylinderHeight,
      48,
    ),
    frameMaterial,
  );
  cylinderBody.position.set(0, -16 * sourceScale, -0.18);
  cylinderBody.userData.fixed = true;
  cylinderBody.userData.role = 'fixed-engine-cylinder-around-piston-rod-A';
  const cylinderTop = new THREE.Mesh(
    new THREE.BoxGeometry(8 * sourceScale, 0.75 * sourceScale, 0.74),
    frameMaterial,
  );
  cylinderTop.position.set(0, -13.125 * sourceScale, -0.18);
  cylinderTop.userData.fixed = true;
  cylinderTop.userData.role = 'fixed-cylinder-top-crosshead';
  const gland = cylinderAlongZ(
    1.0 * sourceScale,
    0.80,
    darkMaterial,
    38,
  );
  gland.position.set(0, -11.4375 * sourceScale, -0.12);
  gland.userData.fixed = true;
  gland.userData.role = 'fixed-piston-rod-A-gland';
  const cylinderBase = new THREE.Mesh(
    new THREE.BoxGeometry(7.0 * sourceScale, 0.65 * sourceScale, 0.88),
    frameMaterial,
  );
  cylinderBase.position.set(0, -18.55 * sourceScale, -0.18);
  cylinderBase.userData.fixed = true;
  cylinderBase.userData.role = 'fixed-cylinder-base';

  fixedFrame.add(
    ...supportLegs,
    cylinderBody,
    cylinderTop,
    cylinderBase,
    gland,
    fixedRingD,
    annulusOuterBand,
    ...sideBearings,
    centralBearing,
    centralBore,
  );
  return {
    annulusOuterBand,
    centralBearing,
    centralBore,
    cylinderBase,
    cylinderBody,
    cylinderTop,
    fixedFrame,
    fixedRingD,
    gland,
    sideBearings,
    supportLegs,
  };
}

function EpicyclicPistonRodGuide(movement) {
  const root = new THREE.Group();

  // Exact official animation geometry. The fixed D annulus has twice the
  // pitch diameter and twice the tooth count of planet B. The carrier throw,
  // planet pitch radius, and wrist radius are all four source units.
  const sourceScale = 0.21;
  const sourceCarrierCrankRadius = 4;
  const sourcePlanetPitchRadius = 4;
  const sourceFixedRingPitchRadius = 8;
  const sourcePlanetTeeth = 24;
  const sourceFixedRingTeeth = 48;
  const sourceFixedRingOuterRadius = 9;
  const sourceFlywheelOuterRadius = 15;
  const sourceFlywheelInnerRadius = 13.5;
  const sourcePistonRodHalfWidth = 0.375;
  const sourcePistonRodTopLocalY = -0.927025;
  const sourcePistonRodBottomLocalY = -22.5;
  const sourcePistonHeadTopLocalY = -22.5;
  const sourcePistonHeadBottomLocalY = -23.5;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const carrierAngularSpeed = FULL_TURN / cyclePeriod;

  const carrierCrankRadius = sourceCarrierCrankRadius * sourceScale;
  const planetPitchRadius = sourcePlanetPitchRadius * sourceScale;
  const fixedRingPitchRadius = sourceFixedRingPitchRadius * sourceScale;
  const fixedRingOuterRadius = sourceFixedRingOuterRadius * sourceScale;
  const flywheelOuterRadius = sourceFlywheelOuterRadius * sourceScale;
  const flywheelInnerRadius = sourceFlywheelInnerRadius * sourceScale;
  const pistonRodHalfWidth = sourcePistonRodHalfWidth * sourceScale;
  const pistonRodTopLocalY = sourcePistonRodTopLocalY * sourceScale;
  const pistonRodBottomLocalY = sourcePistonRodBottomLocalY * sourceScale;
  const pistonHeadTopLocalY = sourcePistonHeadTopLocalY * sourceScale;
  const pistonHeadBottomLocalY = sourcePistonHeadBottomLocalY * sourceScale;
  const pistonStroke = 4 * carrierCrankRadius;
  const gearModule = 2 * planetPitchRadius / sourcePlanetTeeth;
  const gearToothHeight = 2.25 * gearModule;

  const flywheelPlaneZ = -0.52;
  const flywheelDepth = 0.24;
  const carrierPlaneZ = -0.13;
  const gearPlaneZ = 0.18;
  const fixedRingDepth = 0.28;
  const planetGearDepth = 0.30;
  const pistonPlaneZ = 0.68;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.11,
    roughness: 0.71,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const outputMaterial = matte(PALETTE.accent, {
    metalness: 0.08,
    roughness: 0.60,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const fixedParts = FixedAnnulusAndFrame({
    darkMaterial,
    fixedRingDepth,
    fixedRingOuterRadius,
    fixedRingPitchRadius,
    fixedRingTeeth: sourceFixedRingTeeth,
    frameMaterial,
    gearModule,
    gearPlaneZ,
    sourceScale,
  });
  const carrierParts = makeCarrierFlywheel({
    carrierCrankRadius,
    carrierPlaneZ,
    darkMaterial,
    driverMaterial,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    planetGearPlaneZ: gearPlaneZ,
    sourceScale,
    whiteMaterial,
  });

  const planetGearB = makeGear({
    axis: Z_AXIS,
    color: PALETTE.driven,
    depth: planetGearDepth,
    radius: planetPitchRadius,
    teeth: sourcePlanetTeeth,
    toothHeight: gearToothHeight,
    addendum: gearModule,
    dedendum: gearModule*1.25,
    chamfer: 0,
  });
  // Brown draws no white face index on wheel B; drop the generic gear's one.
  const planetFaceIndex = planetGearB.userData.rotor.children.at(-1);
  if (planetFaceIndex?.geometry?.type === 'BoxGeometry') {
    planetFaceIndex.removeFromParent();
    planetFaceIndex.geometry.dispose();
    planetFaceIndex.material.dispose();
  }
  const planetToothIndexOffset = Math.PI / sourcePlanetTeeth;
  planetGearB.userData.rotor.rotation.z = planetToothIndexOffset;
  planetGearB.position.set(carrierCrankRadius, 0, gearPlaneZ);
  planetGearB.userData.role =
    'orbiting-twenty-four-tooth-cog-wheel-B-with-opposite-wrist';
  planetGearB.userData.toothIndexOffset = planetToothIndexOffset;
  const planetCenterAnchor = new THREE.Object3D();
  planetCenterAnchor.userData.role = 'analytic-moving-center-of-wheel-B';
  const planetWristPin = cylinderAlongZ(
    0.50 * sourceScale,
    pistonPlaneZ - gearPlaneZ + 0.34,
    darkMaterial,
    34,
  );
  planetWristPin.position.set(
    -planetPitchRadius,
    0,
    (pistonPlaneZ - gearPlaneZ) / 2,
  );
  planetWristPin.userData.role =
    'wrist-fixed-to-wheel-B-opposite-its-carrier-center';
  const planetWristAnchor = new THREE.Object3D();
  planetWristAnchor.position.set(
    -planetPitchRadius,
    0,
    pistonPlaneZ - gearPlaneZ,
  );
  planetWristAnchor.userData.role = 'analytic-wheel-B-wrist-for-rod-A';
  planetGearB.add(
    planetCenterAnchor,
    planetWristPin,
    planetWristAnchor,
  );

  const pistonAssembly = new THREE.Group();
  pistonAssembly.userData.role =
    'nonrotating-vertical-piston-rod-A-and-piston-assembly';
  pistonAssembly.userData.rotationDegreesOfFreedom = 0;
  const wristBoss = cylinderAlongZ(
    1.0 * sourceScale,
    0.25,
    outputMaterial,
    40,
  );
  wristBoss.position.z = pistonPlaneZ;
  wristBoss.userData.role = 'piston-rod-A-upper-wrist-eye';
  const wristRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.62 * sourceScale, 0.10 * sourceScale, 8, 36),
    darkMaterial,
  );
  wristRing.position.z = pistonPlaneZ + 0.14;
  wristRing.userData.role = 'dark-wrist-bearing-on-piston-rod-A';
  const pistonRodLength = pistonRodTopLocalY - pistonRodBottomLocalY;
  const pistonRodA = new THREE.Mesh(
    new THREE.BoxGeometry(
      pistonRodHalfWidth * 2,
      pistonRodLength,
      0.15,
    ),
    outputMaterial,
  );
  pistonRodA.position.set(
    0,
    (pistonRodTopLocalY + pistonRodBottomLocalY) / 2,
    pistonPlaneZ,
  );
  pistonRodA.userData.role =
    'source-dimension-vertical-piston-rod-A';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(
      6 * sourceScale,
      pistonHeadTopLocalY - pistonHeadBottomLocalY,
      0.26,
    ),
    outputMaterial,
  );
  pistonHead.position.set(
    0,
    (pistonHeadTopLocalY + pistonHeadBottomLocalY) / 2,
    pistonPlaneZ,
  );
  pistonHead.userData.role = 'piston-head-rigid-with-rod-A';
  const pistonIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.046, 0.034),
    whiteMaterial,
  );
  pistonIndex.position.set(0, -1.35 * sourceScale, pistonPlaneZ + 0.11);
  pistonIndex.userData.role = 'white-index-on-translating-piston-rod-A';
  const pistonWristAnchor = new THREE.Object3D();
  pistonWristAnchor.position.z = pistonPlaneZ;
  pistonWristAnchor.userData.role = 'analytic-wrist-on-piston-rod-A';
  pistonAssembly.add(
    pistonRodA,
    pistonHead,
    wristBoss,
    wristRing,
    pistonIndex,
    pistonWristAnchor,
  );

  root.add(
    carrierParts.carrier,
    fixedParts.fixedFrame,
    planetGearB,
    pistonAssembly,
  );

  const stateAtCarrierAngle = (
    unwrappedCarrierAngle,
    angularVelocity = carrierAngularSpeed,
    poseOffset = 0,
  ) => {
    // The unwrapped angle and phase count turns from the demonstration start;
    // the pose offset is applied to the wrapped angle so a whole turn closes
    // exactly.
    const carrierAngle = positiveModulo(
      positiveModulo(unwrappedCarrierAngle, FULL_TURN) + poseOffset,
      FULL_TURN,
    );
    const sine = Math.sin(carrierAngle);
    const cosine = Math.cos(carrierAngle);
    const radialUnit = new THREE.Vector2(cosine, sine);
    const tangentUnit = new THREE.Vector2(-sine, cosine);
    const planetCenter = radialUnit.clone().multiplyScalar(
      carrierCrankRadius,
    );
    const planetCenterVelocity = tangentUnit.clone().multiplyScalar(
      carrierCrankRadius * angularVelocity,
    );
    const planetCenterAcceleration = radialUnit.clone().multiplyScalar(
      -carrierCrankRadius * angularVelocity ** 2,
    );
    const planetUnwrappedAngle = -unwrappedCarrierAngle;
    const planetAngle = positiveModulo(-carrierAngle, FULL_TURN);
    const planetAngularVelocity = -angularVelocity;
    const planetAngularAcceleration = 0;
    const wristRadiusVector = new THREE.Vector2(
      -planetPitchRadius * cosine,
      planetPitchRadius * sine,
    );
    const wristPin = planetCenter.clone().add(wristRadiusVector);
    const wristVelocity = new THREE.Vector2(
      0,
      2 * carrierCrankRadius * angularVelocity * cosine,
    );
    const wristAcceleration = new THREE.Vector2(
      0,
      -2 * carrierCrankRadius * angularVelocity ** 2 * sine,
    );

    const pitchContactPoint = radialUnit.clone().multiplyScalar(
      fixedRingPitchRadius,
    );
    const planetContactRadial = radialUnit.clone().multiplyScalar(
      planetPitchRadius,
    );
    const planetPitchPoint = planetCenter.clone().add(
      planetContactRadial,
    );
    const planetSpinContactVelocity = tangentUnit.clone().multiplyScalar(
      planetAngularVelocity * planetPitchRadius,
    );
    const planetContactVelocity = planetCenterVelocity.clone().add(
      planetSpinContactVelocity,
    );
    const fixedRingContactVelocity = new THREE.Vector2();

    return {
      carrierAngle,
      carrierAngularAcceleration: 0,
      carrierAngularVelocity: angularVelocity,
      carrierCrankPin: planetCenter.clone(),
      carrierPhase: carrierAngle / FULL_TURN,
      fixedRingAngle: 0,
      fixedRingAngularVelocity: 0,
      mesh: {
        centerDistance: planetCenter.length(),
        centerDistanceResidual: planetCenter.length()
          - (fixedRingPitchRadius - planetPitchRadius),
        fixedRingContactVelocity,
        meshPhaseInvariant:
          sourcePlanetTeeth * planetUnwrappedAngle
          + (sourceFixedRingTeeth - sourcePlanetTeeth)
            * unwrappedCarrierAngle,
        pitchContactPoint,
        pitchPointResidual: planetPitchPoint.clone().sub(
          pitchContactPoint,
        ),
        planetContactRadial,
        planetContactVelocity,
        planetPitchPoint,
        planetSpinContactVelocity,
        radialUnit,
        slipVelocity: planetContactVelocity.clone().sub(
          fixedRingContactVelocity,
        ),
        tangentUnit,
      },
      phase: positiveModulo(unwrappedCarrierAngle / FULL_TURN, 1),
      piston: {
        acceleration: wristAcceleration.clone(),
        axisX: 0,
        rotation: 0,
        stroke: pistonStroke,
        translationY: wristPin.y,
        velocity: wristVelocity.clone(),
      },
      pistonAxisResidual: wristPin.x,
      pistonAccelerationY: wristAcceleration.y,
      pistonVelocityY: wristVelocity.y,
      pistonY: wristPin.y,
      planetAngle,
      planetAngularAcceleration,
      planetAngularVelocity,
      planetCenter,
      planetCenterAcceleration,
      planetCenterVelocity,
      planetUnwrappedAngle,
      unwrappedCarrierAngle,
      wristAcceleration,
      wristPin,
      wristRadiusVector,
      wristVelocity,
    };
  };

  // Brown's plate shows wheel B up and to the left of the shaft, with wrist A
  // high on its stroke and the flywheel arms upright; the demonstration clock
  // starts at that carrier angle rather than the official canvas's zero.
  const sourcePoseCarrierAngle = Math.atan2(236 - 194, 214 - 264);
  const stateAtTime = (time) => {
    const elapsed = Number.isFinite(Number(time)) ? Number(time) : 0;
    return stateAtCarrierAngle(
      elapsed * carrierAngularSpeed,
      carrierAngularSpeed,
      sourcePoseCarrierAngle,
    );
  };
  const timeAtCarrierAngle = (angle) => positiveModulo(
    (angle - sourcePoseCarrierAngle) / carrierAngularSpeed,
    cyclePeriod,
  );
  const canonicalTimes = {
    cycleClosure: cyclePeriod,
    lowerDeadCenter: timeAtCarrierAngle(Math.PI * 1.5),
    oppositeMidStroke: timeAtCarrierAngle(Math.PI),
    plateStart: 0,
    sourceStartMidStroke: timeAtCarrierAngle(0),
    upperDeadCenter: timeAtCarrierAngle(Math.PI / 2),
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const officialViewMinimum = new THREE.Vector2(-16.5, -17.297248);
  const officialViewWidth = 33;
  const officialViewHeight = 33;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const rawX = point.x / sourceScale;
    const rawY = point.y / sourceScale;
    return new THREE.Vector2(
      (rawX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (rawY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  const geometry = {
    carrierAngularSpeed,
    carrierCrankRadius,
    carrierPlaneZ,
    cyclePeriod,
    fixedRingDepth,
    fixedRingOuterRadius,
    fixedRingPitchRadius,
    fixedRingTeeth: sourceFixedRingTeeth,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    gearModule,
    gearPlaneZ,
    gearToothHeight,
    pistonHeadBottomLocalY,
    pistonHeadTopLocalY,
    pistonPlaneZ,
    pistonRodBottomLocalY,
    pistonRodHalfWidth,
    pistonRodTopLocalY,
    pistonStroke,
    planetGearDepth,
    planetPitchRadius,
    planetTeeth: sourcePlanetTeeth,
    planetToothIndexOffset,
    sourceCarrierCrankRadius,
    sourceCyclesPerMinute,
    sourceFixedRingOuterRadius,
    sourceFixedRingPitchRadius,
    sourceFixedRingTeeth,
    sourceFlywheelInnerRadius,
    sourceFlywheelOuterRadius,
    sourcePistonHeadBottomLocalY,
    sourcePistonHeadTopLocalY,
    sourcePistonRodBottomLocalY,
    sourcePistonRodHalfWidth,
    sourcePistonRodTopLocalY,
    sourcePlanetPitchRadius,
    sourcePlanetTeeth,
    sourceScale,
  };

  const contacts = {
    carrierCrankPinToWheelBBearing: {
      carrier: carrierParts.carrier,
      movingWheel: planetGearB,
      point: new THREE.Vector3(
        carrierCrankRadius,
        0,
        gearPlaneZ,
      ),
      type: 'revolute-bearing-on-carried-crank-pin',
    },
    planetWheelBToFixedInternalGearD: {
      fixedMember: fixedParts.fixedRingD,
      movingMember: planetGearB,
      pitchPoint: new THREE.Vector3(
        fixedRingPitchRadius,
        0,
        gearPlaneZ,
      ),
      slipVelocity: new THREE.Vector2(),
      type: 'internal-involute-gear-mesh',
    },
    wheelBWristToPistonRodA: {
      pistonMember: pistonAssembly,
      point: new THREE.Vector3(0, 0, pistonPlaneZ),
      wheelMember: planetGearB,
      type: 'revolute-wrist-joint',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    carrierParts.carrier.rotation.z = state.carrierAngle;
    planetGearB.position.set(
      state.planetCenter.x,
      state.planetCenter.y,
      gearPlaneZ,
    );
    planetGearB.rotation.z = state.planetAngle;
    pistonAssembly.position.set(0, state.pistonY, 0);
    contacts.carrierCrankPinToWheelBBearing.point.set(
      state.planetCenter.x,
      state.planetCenter.y,
      gearPlaneZ,
    );
    contacts.planetWheelBToFixedInternalGearD.pitchPoint.set(
      state.mesh.pitchContactPoint.x,
      state.mesh.pitchContactPoint.y,
      gearPlaneZ,
    );
    contacts.planetWheelBToFixedInternalGearD.slipVelocity.copy(
      state.mesh.slipVelocity,
    );
    contacts.wheelBWristToPistonRodA.point.set(
      state.wristPin.x,
      state.wristPin.y,
      pistonPlaneZ,
    );
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'fixed-annulus-planet-wrist-straight-line-piston-guide';
  root.userData.blocks = {
    annulusOuterBand: fixedParts.annulusOuterBand,
    carrierCrankArmC: carrierParts.carrierCrankArmC,
    carrierCrankPin: carrierParts.carrierCrankPin,
    carrierCrankPinAnchor: carrierParts.carrierCrankPinAnchor,
    carrierIndex: carrierParts.carrierIndex,
    centralBearing: fixedParts.centralBearing,
    centralBore: fixedParts.centralBore,
    centralPlateC: carrierParts.centralPlateC,
    cylinderBase: fixedParts.cylinderBase,
    cylinderBody: fixedParts.cylinderBody,
    cylinderTop: fixedParts.cylinderTop,
    fixedFrame: fixedParts.fixedFrame,
    fixedRingD: fixedParts.fixedRingD,
    flywheelIndex: carrierParts.flywheelIndex,
    flywheelRim: carrierParts.flywheelRim,
    flywheelSpokes: carrierParts.flywheelSpokes,
    gland: fixedParts.gland,
    inputCarrierC: carrierParts.carrier,
    inputHub: carrierParts.hub,
    inputShaft: carrierParts.shaft,
    pistonAssembly,
    pistonHead,
    pistonIndex,
    pistonRodA,
    pistonWristAnchor,
    planetCenterAnchor,
    planetGearB,
    planetWristAnchor,
    planetWristPin,
    sideBearings: fixedParts.sideBearings,
    supportLegs: fixedParts.supportLegs,
    wristBoss,
    wristRing,
  };
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.52, -4.42, -0.80),
    new THREE.Vector3(3.52, 3.30, 1.00),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuous rotation of shaft-fast plate C',
    mechanism: 1,
    pistonRodRotation: 0,
    pistonRodTranslationAxes: 1,
    output:
      'one exact vertical translation generated by the diametral point of planet B',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -4.30;
  root.userData.mechanism =
    'fixed-48-tooth-annulus-D-24-tooth-planet-B-radius-four-carrier-C-opposite-radius-four-wrist-straight-line-piston-A';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialGeometry: {
      carrierCrankRadius: sourceCarrierCrankRadius,
      fixedRingOuterRadius: sourceFixedRingOuterRadius,
      fixedRingPitchRadius: sourceFixedRingPitchRadius,
      fixedRingTeeth: sourceFixedRingTeeth,
      flywheelInnerRadius: sourceFlywheelInnerRadius,
      flywheelOuterRadius: sourceFlywheelOuterRadius,
      pistonHeadBottomLocalY: sourcePistonHeadBottomLocalY,
      pistonHeadTopLocalY: sourcePistonHeadTopLocalY,
      pistonRodBottomLocalY: sourcePistonRodBottomLocalY,
      pistonRodHalfWidth: sourcePistonRodHalfWidth,
      pistonRodTopLocalY: sourcePistonRodTopLocalY,
      planetPitchRadius: sourcePlanetPitchRadius,
      planetTeeth: sourcePlanetTeeth,
      planetWristRadius: sourcePlanetPitchRadius,
    },
    officialKeyframes: [0, 0.25, 0.50, 0.75, 1].map((phase) => {
      const state = stateAtCarrierAngle(FULL_TURN * phase);
      return {
        carrierAngle: state.carrierAngle,
        phase,
        pistonWrist: state.wristPin.clone().multiplyScalar(1 / sourceScale),
        planetAngle: state.planetAngle,
        planetCenter: state.planetCenter.clone().multiplyScalar(
          1 / sourceScale,
        ),
      };
    }),
    officialPageAnimatedTabDisabled: false,
    referenceScope:
      'official 15-unit plate-C flywheel, radius-4 carrier pin, 24-tooth radius-4 wheel B, fixed 48-tooth radius-8 internal gear D, opposite radius-4 wrist, and piston-rod A',
    sourceNote:
      'The official animation replaces Brown’s circular plate C with a crank arm to expose its motion.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate329: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'wheel B orbits inside stationary internal gear D on plate C; its opposite pitch-circle wrist carries upright piston-rod A',
      measurementUncertaintyPixels: 32,
      rasterCarrierShaftCenter: new THREE.Vector2(264, 236),
      rasterCylinderCenter: new THREE.Vector2(264, 454),
      rasterFixedRingCenterD: new THREE.Vector2(264, 236),
      rasterPistonWristA: new THREE.Vector2(264, 153),
      rasterPlanetCenterB: new THREE.Vector2(214, 194),
    },
    officialAnimationImplementation: {
      carrierTransform: 'rotation +cyclePos about [0, 0]',
      pistonTransform: 'translation to wheel B crank_pin',
      planetTransform:
        'rotation -cyclePos about carrier crank_pin [4, 0]',
      planetWristLocal: new THREE.Vector2(-4, 0),
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
  root.userData.stateAtCarrierAngle = stateAtCarrierAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    carrierToPlanetAbsoluteRatio: -1,
    fixedRingToPlanetPitchDiameterRatio: 2,
    input: 'plate C and carrier rotate at 15 revolutions per minute',
    output:
      'diametral wrist of B follows x = 0 and y = 8 sin(theta) source units',
    outputStrokeSourceUnits: 16,
    planetToFixedRingToothRatio: 0.5,
  };

  update(0);
  markShadows(root);
  correctEpicyclicGuide(root);
  finishPistonGuides(root,update);
  // Brown crops the flywheel and shows only the cylinder cover; the view
  // frames the whole flywheel, the A-frame legs and the whole cylinder down
  // to its base. No bed plate is drawn, so none is built.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.5, -7.05, -0.80),
    new THREE.Vector3(4.5, 4.5, 1.00),
  );
  root.userData.cameraDistanceScale = 1.0;
  return {
    cameraDirection: new THREE.Vector3(.8,.4,15),
    root,
    update,
  };
}

export function createAuthoredEpicyclicPistonGuide(movement) {
  if (movement.id !== 329) return null;
  return EpicyclicPistonRodGuide(movement);
}
