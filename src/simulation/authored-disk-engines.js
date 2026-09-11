import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cylinderAlongX(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
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
    X_AXIS,
    delta.clone().normalize(),
  );
  return beam;
}

function tubeThrough(points, radius, material, tubularSegments = 32) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, 9, false),
    material,
  );
}

function normalizedVectorWithRates(raw, rawVelocity, rawAcceleration) {
  const length = raw.length();
  const lengthVelocity = raw.dot(rawVelocity) / length;
  const lengthAcceleration = (
    rawVelocity.lengthSq()
      + raw.dot(rawAcceleration)
      - lengthVelocity ** 2
  ) / length;
  const direction = raw.clone().multiplyScalar(1 / length);
  const velocity = rawVelocity.clone().multiplyScalar(1 / length)
    .addScaledVector(raw, -lengthVelocity / length ** 2);
  const acceleration = rawAcceleration.clone().multiplyScalar(1 / length)
    .addScaledVector(rawVelocity,
      -2 * lengthVelocity / length ** 2)
    .addScaledVector(raw,
      -lengthAcceleration / length ** 2
        + 2 * lengthVelocity ** 2 / length ** 3);
  return {
    acceleration,
    direction,
    length,
    lengthAcceleration,
    lengthVelocity,
    velocity,
  };
}

function slottedDiscGeometry(radius, thickness, slotHalfAngle) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(
    radius * Math.cos(slotHalfAngle),
    radius * Math.sin(slotHalfAngle),
  );
  shape.absarc(
    0,
    0,
    radius,
    slotHalfAngle,
    FULL_TURN - slotHalfAngle,
    false,
  );
  shape.lineTo(0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 80,
    depth: thickness,
    steps: 1,
  });
  geometry.translate(0, 0, -thickness / 2);
  // ExtrudeGeometry uses XY for the shape and Z for thickness. The moving
  // disk frame uses local X for its normal, local Y for the radial slot, and
  // local Z for the in-plane transverse direction.
  geometry.applyMatrix4(new THREE.Matrix4().set(
    0, 0, 1, 0,
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 1,
  ));
  geometry.computeVertexNormals();
  return geometry;
}

function sphericalZoneGeometry(radius, halfAngle, segments = 28) {
  const axialSegments = Math.max(8, Math.round(segments * 0.7));
  const azimuthSegments = segments;
  const positions = [];
  const normals = [];
  const indices = [];
  for (let axialIndex = 0; axialIndex <= axialSegments;
    axialIndex += 1) {
    const axialAngle = THREE.MathUtils.lerp(
      -halfAngle,
      halfAngle,
      axialIndex / axialSegments,
    );
    for (let azimuthIndex = 0; azimuthIndex <= azimuthSegments;
      azimuthIndex += 1) {
      // Retain the rear half (z <= 0) as a cutaway shell.
      const azimuth = Math.PI
        + Math.PI * azimuthIndex / azimuthSegments;
      const x = radius * Math.sin(axialAngle);
      const radial = radius * Math.cos(axialAngle);
      const y = radial * Math.cos(azimuth);
      const z = radial * Math.sin(azimuth);
      positions.push(x, y, z);
      normals.push(x / radius, y / radius, z / radius);
    }
  }
  const rowLength = azimuthSegments + 1;
  for (let axialIndex = 0; axialIndex < axialSegments;
    axialIndex += 1) {
    for (let azimuthIndex = 0; azimuthIndex < azimuthSegments;
      azimuthIndex += 1) {
      const a = axialIndex * rowLength + azimuthIndex;
      const b = a + rowLength;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(
    positions,
    3,
  ));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(
    normals,
    3,
  ));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function radialPartitionGeometry({
  ballRadius,
  chamberRadius,
  halfAngle,
  thickness,
}) {
  const samples = 28;
  const shape = new THREE.Shape();
  const outerStartX = -chamberRadius * Math.sin(halfAngle);
  const outerEndX = chamberRadius * Math.sin(halfAngle);
  for (let index = 0; index <= samples; index += 1) {
    const x = THREE.MathUtils.lerp(
      outerStartX,
      outerEndX,
      index / samples,
    );
    const y = Math.sqrt(Math.max(0, chamberRadius ** 2 - x ** 2));
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const innerEndX = ballRadius * Math.sin(halfAngle);
  const innerStartX = -innerEndX;
  shape.lineTo(
    innerEndX,
    Math.sqrt(ballRadius ** 2 - innerEndX ** 2),
  );
  for (let index = samples; index >= 0; index -= 1) {
    const x = THREE.MathUtils.lerp(
      innerStartX,
      innerEndX,
      index / samples,
    );
    const y = Math.sqrt(Math.max(0, ballRadius ** 2 - x ** 2));
    shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 32,
    depth: thickness,
    steps: 1,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function diskEngine(movement) {
  const root = new THREE.Group();

  // Movement 347 has no official canvas animation and supplies no dimensions.
  // Its first visible phase is reconstructed from Brown's 525 px engraving.
  // The topology is independently confirmed by Reuleaux's conic double-slider
  // analysis and by the preserved Dakeyne model described by the Science
  // Museum: spherical zone, opposed conical heads, central ball, perpendicular
  // rod, crank socket, and a fixed radial diaphragm passing through a disk slot.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterBallCenter = new THREE.Vector2(321, 257);
  const sourceRasterCrankPin = new THREE.Vector2(115, 155);
  const sourceRasterDiscUpperRim = new THREE.Vector2(370, 130);
  const sourceRasterDiscLowerRim = new THREE.Vector2(277, 388);
  const sourceRasterChamberTop = new THREE.Vector2(329, 87);
  const sourceRasterChamberBottom = new THREE.Vector2(330, 423);
  const sourceDiscRadiusPixels = (
    sourceRasterDiscUpperRim.distanceTo(sourceRasterBallCenter)
      + sourceRasterDiscLowerRim.distanceTo(sourceRasterBallCenter)
  ) / 2;
  const chamberRadius = 2.4;
  const sourcePixelsPerModelUnit = sourceDiscRadiusPixels / chamberRadius;
  const sourceCrankVectorPixels = new THREE.Vector2(
    sourceRasterCrankPin.x - sourceRasterBallCenter.x,
    sourceRasterBallCenter.y - sourceRasterCrankPin.y,
  );
  const nutationHalfAngle = Math.atan2(
    Math.abs(sourceCrankVectorPixels.y),
    Math.abs(sourceCrankVectorPixels.x),
  );
  const pistonRodCrankLength = sourceCrankVectorPixels.length()
    / sourcePixelsPerModelUnit;
  const crankPlaneDistance = pistonRodCrankLength
    * Math.cos(nutationHalfAngle);
  const crankRadius = pistonRodCrankLength
    * Math.sin(nutationHalfAngle);
  const chamberAxialHalfLength = chamberRadius
    * Math.sin(nutationHalfAngle);
  const chamberJunctionRadius = chamberRadius
    * Math.cos(nutationHalfAngle);
  const centralBallRadius = 0.49;
  const pistonDiscBodyRadius = chamberRadius - 0.06;
  const pistonDiscThickness = 0.15;
  const radialSlotHalfAngle = THREE.MathUtils.degToRad(3.6);
  const radialPartitionThickness = 0.10;
  const counterRodLength = 2.75;
  const ballCenter = new THREE.Vector3(0, 2.85, 0);
  const crankCenter = new THREE.Vector3(
    ballCenter.x - crankPlaneDistance,
    ballCenter.y,
    ballCenter.z,
  );
  const demonstrationCyclesPerMinute = 15;
  const cyclePeriod = 60 / demonstrationCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const stateAtInputAngle = (
    unwrappedInputAngle,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const pointP = new THREE.Vector3(
      crankCenter.x,
      crankCenter.y + crankRadius * cosine,
      crankCenter.z + crankRadius * sine,
    );
    const pointPThetaDerivative = new THREE.Vector3(
      0,
      -crankRadius * sine,
      crankRadius * cosine,
    );
    const pointPThetaSecondDerivative = new THREE.Vector3(
      0,
      -crankRadius * cosine,
      -crankRadius * sine,
    );
    const pointPVelocity = pointPThetaDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed);
    const pointPAcceleration = pointPThetaSecondDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed ** 2)
      .addScaledVector(pointPThetaDerivative, inputAngularAcceleration);
    const diskNormal = pointP.clone().sub(ballCenter)
      .multiplyScalar(1 / pistonRodCrankLength);
    const diskNormalThetaDerivative = pointPThetaDerivative.clone()
      .multiplyScalar(1 / pistonRodCrankLength);
    const diskNormalThetaSecondDerivative =
      pointPThetaSecondDerivative.clone()
        .multiplyScalar(1 / pistonRodCrankLength);
    const diskNormalVelocity = diskNormalThetaDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed);
    const diskNormalAcceleration = diskNormalThetaSecondDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed ** 2)
      .addScaledVector(
        diskNormalThetaDerivative,
        inputAngularAcceleration,
      );

    // The fixed diaphragm is the world XY half-plane. Its intersection with
    // the moving disk is the disk's radial slot direction. Choosing the sign
    // with positive Y keeps that one-sided slot on the physical diaphragm.
    const rawSlotDirection = new THREE.Vector3(
      diskNormal.y,
      -diskNormal.x,
      0,
    );
    const rawSlotVelocity = new THREE.Vector3(
      diskNormalVelocity.y,
      -diskNormalVelocity.x,
      0,
    );
    const rawSlotAcceleration = new THREE.Vector3(
      diskNormalAcceleration.y,
      -diskNormalAcceleration.x,
      0,
    );
    const slotState = normalizedVectorWithRates(
      rawSlotDirection,
      rawSlotVelocity,
      rawSlotAcceleration,
    );
    const transverseDirection = new THREE.Vector3()
      .crossVectors(diskNormal, slotState.direction).normalize();
    const transverseVelocity = new THREE.Vector3()
      .crossVectors(diskNormalVelocity, slotState.direction)
      .add(new THREE.Vector3().crossVectors(
        diskNormal,
        slotState.velocity,
      ));
    const transverseAcceleration = new THREE.Vector3()
      .crossVectors(diskNormalAcceleration, slotState.direction)
      .addScaledVector(
        new THREE.Vector3().crossVectors(
          diskNormalVelocity,
          slotState.velocity,
        ),
        2,
      )
      .add(new THREE.Vector3().crossVectors(
        diskNormal,
        slotState.acceleration,
      ));
    const diskAngularVelocity = new THREE.Vector3()
      .crossVectors(diskNormal, diskNormalVelocity)
      .add(new THREE.Vector3().crossVectors(
        slotState.direction,
        slotState.velocity,
      ))
      .add(new THREE.Vector3().crossVectors(
        transverseDirection,
        transverseVelocity,
      ))
      .multiplyScalar(0.5);
    const diskAngularAcceleration = new THREE.Vector3()
      .crossVectors(diskNormal, diskNormalAcceleration)
      .add(new THREE.Vector3().crossVectors(
        slotState.direction,
        slotState.acceleration,
      ))
      .add(new THREE.Vector3().crossVectors(
        transverseDirection,
        transverseAcceleration,
      ))
      .multiplyScalar(0.5);
    const rotationMatrix = new THREE.Matrix4().makeBasis(
      diskNormal,
      slotState.direction,
      transverseDirection,
    );
    const orientation = new THREE.Quaternion()
      .setFromRotationMatrix(rotationMatrix).normalize();

    const projectedAxis = X_AXIS.clone().addScaledVector(
      diskNormal,
      -X_AXIS.dot(diskNormal),
    ).normalize();
    const coneContactPlus = ballCenter.clone().addScaledVector(
      projectedAxis,
      chamberRadius,
    );
    const coneContactMinus = ballCenter.clone().addScaledVector(
      projectedAxis,
      -chamberRadius,
    );
    const slotOuterPoint = ballCenter.clone().addScaledVector(
      slotState.direction,
      chamberRadius,
    );

    return {
      crank: {
        angle: inputAngle,
        angularAcceleration: inputAngularAcceleration,
        angularVelocity: resolvedInputAngularSpeed,
        axis: X_AXIS.clone(),
      },
      disk: {
        angularAcceleration: diskAngularAcceleration,
        angularVelocity: diskAngularVelocity,
        coneContactMinus,
        coneContactPlus,
        normal: diskNormal,
        normalAcceleration: diskNormalAcceleration,
        normalVelocity: diskNormalVelocity,
        orientation,
        slotDirection: slotState.direction,
        slotDirectionAcceleration: slotState.acceleration,
        slotDirectionVelocity: slotState.velocity,
        slotOuterPoint,
        transverseDirection,
        transverseDirectionAcceleration: transverseAcceleration,
        transverseDirectionVelocity: transverseVelocity,
      },
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      pistonRod: {
        ballCenter: ballCenter.clone(),
        crankEnd: pointP,
        length: pointP.distanceTo(ballCenter),
        lengthError: pointP.distanceTo(ballCenter)
          - pistonRodCrankLength,
      },
      pointP,
      pointPAcceleration,
      pointPVelocity,
      unwrappedInputAngle,
    };
  };

  const stateAtCyclePhase = (phase) => stateAtInputAngle(
    FULL_TURN * phase,
    inputAngularSpeed,
    0,
  );
  const stateAtTime = (time) => {
    const state = stateAtInputAngle(inputAngularSpeed * time);
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };
  const canonicalTimes = {
    engravingPhase: 0,
    quarterTurn: cyclePeriod / 4,
    halfTurn: cyclePeriod / 2,
    threeQuarterTurn: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.62,
  });
  const frameEdgeMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.50,
  });
  const chamberMaterial = matte(PALETTE.driven, {
    opacity: 0.19,
    roughness: 0.70,
    side: THREE.DoubleSide,
    transparent: true,
  });
  chamberMaterial.depthWrite = false;
  const chamberRibMaterial = matte(PALETTE.frame, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const diskMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.57,
    side: THREE.DoubleSide,
  });
  const diskEdgeMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const crankMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.56,
  });
  const ballMaterial = matte(PALETTE.accent, {
    metalness: 0.19,
    roughness: 0.50,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-conical-heads-spherical-zone-ball-seats-and-radial-diaphragm';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      crankPlaneDistance + chamberAxialHalfLength + 2.6,
      0.24,
      5.45,
    ),
    frameMaterial,
  );
  base.position.set(
    (crankCenter.x + chamberAxialHalfLength) / 2 - 0.25,
    0.16,
    0,
  );
  base.userData.role = 'fixed-disc-engine-foundation';
  const baseEdge = new THREE.Mesh(
    new THREE.BoxGeometry(
      crankPlaneDistance + chamberAxialHalfLength + 2.85,
      0.07,
      5.67,
    ),
    frameEdgeMaterial,
  );
  baseEdge.position.set(base.position.x, 0.30, 0);
  baseEdge.userData.role = 'fixed-foundation-top-edge';
  fixedFrame.add(base, baseEdge);

  const fixedChamber = new THREE.Group();
  fixedChamber.position.copy(ballCenter);
  fixedChamber.userData.axis = X_AXIS.clone();
  fixedChamber.userData.role =
    'fixed-cutaway-disc-engine-chamber-about-central-ball';
  const sphericalZone = new THREE.Mesh(
    sphericalZoneGeometry(chamberRadius, nutationHalfAngle, 40),
    chamberMaterial,
  );
  sphericalZone.userData.role = 'fixed-rear-half-spherical-zone';
  const conicalHeads = [-1, 1].map((side, index) => {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(
        chamberJunctionRadius,
        chamberAxialHalfLength,
        64,
        1,
        true,
        Math.PI / 2,
        Math.PI,
      ),
      chamberMaterial,
    );
    cone.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    cone.position.x = side * chamberAxialHalfLength / 2;
    cone.userData.role = `fixed-opposed-conical-cylinder-head-${index + 1}`;
    fixedChamber.add(cone);
    return cone;
  });
  const chamberJunctionRings = [-1, 1].map((side, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        chamberJunctionRadius,
        0.055,
        9,
        72,
      ),
      chamberRibMaterial,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * chamberAxialHalfLength;
    ring.userData.role = `fixed-cone-to-spherical-zone-ring-${index + 1}`;
    fixedChamber.add(ring);
    return ring;
  });
  const centralSeatRings = [-1, 1].map((side, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        centralBallRadius * Math.cos(nutationHalfAngle),
        0.045,
        8,
        48,
      ),
      frameEdgeMaterial,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * centralBallRadius
      * Math.sin(nutationHalfAngle);
    ring.userData.role = `fixed-concentric-ball-seat-ring-${index + 1}`;
    fixedChamber.add(ring);
    return ring;
  });

  const chamberShellRibs = [];
  for (const azimuth of [Math.PI, Math.PI * 1.25, Math.PI * 1.5,
    Math.PI * 1.75, FULL_TURN]) {
    const points = [];
    for (let index = 0; index <= 18; index += 1) {
      const axialAngle = THREE.MathUtils.lerp(
        -nutationHalfAngle,
        nutationHalfAngle,
        index / 18,
      );
      points.push(new THREE.Vector3(
        chamberRadius * Math.sin(axialAngle),
        chamberRadius * Math.cos(axialAngle) * Math.cos(azimuth),
        chamberRadius * Math.cos(axialAngle) * Math.sin(azimuth),
      ));
    }
    const rib = tubeThrough(points, 0.027, chamberRibMaterial, 24);
    rib.userData.role = 'fixed-spherical-zone-meridian-rib';
    fixedChamber.add(rib);
    chamberShellRibs.push(rib);
  }
  const coneGeneratorRibs = [];
  for (const side of [-1, 1]) {
    for (const azimuth of [Math.PI, Math.PI * 1.25, Math.PI * 1.5,
      Math.PI * 1.75, FULL_TURN]) {
      const direction = new THREE.Vector3(
        side * Math.sin(nutationHalfAngle),
        Math.cos(nutationHalfAngle) * Math.cos(azimuth),
        Math.cos(nutationHalfAngle) * Math.sin(azimuth),
      );
      const rib = beamBetween3D(
        direction.clone().multiplyScalar(centralBallRadius),
        direction.clone().multiplyScalar(chamberRadius),
        0.035,
        0.035,
        chamberRibMaterial,
      );
      rib.userData.role = `fixed-conical-head-generator-rib-${side}`;
      fixedChamber.add(rib);
      coneGeneratorRibs.push(rib);
    }
  }
  const fixedPartition = new THREE.Mesh(
    radialPartitionGeometry({
      ballRadius: centralBallRadius,
      chamberRadius,
      halfAngle: nutationHalfAngle,
      thickness: radialPartitionThickness,
    }),
    frameMaterial,
  );
  fixedPartition.userData.role =
    'fixed-radial-diaphragm-through-piston-disc-slot';
  const partitionFace = new THREE.Mesh(
    radialPartitionGeometry({
      ballRadius: centralBallRadius + 0.025,
      chamberRadius: chamberRadius - 0.025,
      halfAngle: nutationHalfAngle,
      thickness: 0.012,
    }),
    ballMaterial,
  );
  partitionFace.position.z = radialPartitionThickness / 2 + 0.008;
  partitionFace.userData.role = 'visible-fixed-radial-diaphragm-face';
  fixedChamber.add(sphericalZone, fixedPartition, partitionFace);
  fixedFrame.add(fixedChamber);

  const chamberFeet = [-1, 1].map((side, index) => {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.28, 1.02),
      frameMaterial,
    );
    foot.position.set(
      side * (chamberAxialHalfLength + 0.28),
      0.43,
      -0.36,
    );
    foot.userData.role = `fixed-chamber-foot-${index + 1}`;
    fixedFrame.add(foot);
    return foot;
  });
  const chamberCradle = tubeThrough(
    Array.from({ length: 25 }, (_, index) => {
      const angle = Math.PI + Math.PI * index / 24;
      return new THREE.Vector3(
        0,
        ballCenter.y + (chamberRadius + 0.13) * Math.sin(angle),
        (chamberRadius + 0.13) * Math.cos(angle) - 0.10,
      );
    }),
    0.095,
    frameMaterial,
    40,
  );
  chamberCradle.userData.role = 'fixed-lower-chamber-cradle';
  fixedFrame.add(chamberCradle);

  const inputCrank = new THREE.Group();
  inputCrank.position.copy(crankCenter);
  inputCrank.userData.axis = X_AXIS.clone();
  inputCrank.userData.role =
    'rotating-output-shaft-flywheel-and-crank-arm';
  const crankShaft = cylinderAlongX(0.21, 2.45,
    frameEdgeMaterial, 40);
  crankShaft.position.x = -0.36;
  crankShaft.userData.role = 'rotating-horizontal-output-shaft';
  const flywheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.72, 0.13, 12, 72),
    crankMaterial,
  );
  flywheelRim.rotation.y = Math.PI / 2;
  flywheelRim.position.x = -0.52;
  flywheelRim.userData.role = 'rotating-output-flywheel-rim';
  const flywheelSpokes = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    const spoke = beamBetween3D(
      new THREE.Vector3(-0.52, 0, 0),
      new THREE.Vector3(
        -0.52,
        1.50 * Math.cos(angle),
        1.50 * Math.sin(angle),
      ),
      0.11,
      0.09,
      crankMaterial,
    );
    spoke.userData.role = `rotating-flywheel-spoke-${index + 1}`;
    inputCrank.add(spoke);
    flywheelSpokes.push(spoke);
  }
  const crankHub = cylinderAlongX(0.39, 0.50,
    frameEdgeMaterial, 40);
  crankHub.position.x = -0.31;
  crankHub.userData.role = 'rotating-output-shaft-hub';
  const crankArm = beamBetween3D(
    new THREE.Vector3(0.13, 0, 0),
    new THREE.Vector3(0.13, crankRadius, 0),
    0.27,
    0.22,
    crankMaterial,
  );
  crankArm.userData.role = 'rotating-crank-arm-O-P';
  const crankSocket = cylinderAlongX(0.28, 0.48,
    crankMaterial, 36);
  crankSocket.position.set(0.13, crankRadius, 0);
  crankSocket.userData.role = 'rotating-socket-at-crank-pin-P';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(0, crankRadius, 0);
  crankPinAnchor.userData.role = 'analytic-crank-pin-center-P';
  const crankIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 12),
    whiteMaterial,
  );
  crankIndex.position.set(-0.67, 1.72, 0);
  crankIndex.userData.role = 'flywheel-angular-index';
  inputCrank.add(
    crankShaft,
    flywheelRim,
    crankHub,
    crankArm,
    crankSocket,
    crankPinAnchor,
    crankIndex,
  );
  root.add(inputCrank);

  const crankBearings = [-1, 1].map((side, index) => {
    const bearing = cylinderAlongX(0.36, 0.30,
      frameEdgeMaterial, 38);
    bearing.position.set(
      crankCenter.x - 0.36 + side * 0.90,
      crankCenter.y,
      crankCenter.z,
    );
    bearing.userData.role = `fixed-output-shaft-bearing-${index + 1}`;
    const standardHeight = crankCenter.y - 0.34;
    const standard = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, standardHeight, 0.70),
      frameMaterial,
    );
    standard.position.set(
      bearing.position.x,
      0.34 + standardHeight / 2,
      -0.03,
    );
    standard.userData.role = `fixed-output-shaft-standard-${index + 1}`;
    fixedFrame.add(bearing, standard);
    return { bearing, standard };
  });
  root.add(fixedFrame);

  const diskAssembly = new THREE.Group();
  diskAssembly.position.copy(ballCenter);
  diskAssembly.userData.role =
    'nutating-non-free-spinning-slotted-disc-ball-and-piston-rod';
  const pistonDisc = new THREE.Mesh(
    slottedDiscGeometry(
      pistonDiscBodyRadius,
      pistonDiscThickness,
      radialSlotHalfAngle,
    ),
    diskMaterial,
  );
  pistonDisc.userData.role =
    'nutating-circular-piston-disc-with-one-radial-slot';
  const diskRimPoints = [];
  for (let index = 0; index <= 72; index += 1) {
    const angle = THREE.MathUtils.lerp(
      radialSlotHalfAngle,
      FULL_TURN - radialSlotHalfAngle,
      index / 72,
    );
    diskRimPoints.push(new THREE.Vector3(
      0,
      pistonDiscBodyRadius * Math.cos(angle),
      pistonDiscBodyRadius * Math.sin(angle),
    ));
  }
  const diskRimSeal = tubeThrough(
    diskRimPoints,
    chamberRadius - pistonDiscBodyRadius,
    diskEdgeMaterial,
    90,
  );
  diskRimSeal.userData.role =
    'moving-disc-peripheral-seal-in-spherical-zone';
  const slotLips = [-1, 1].map((side, index) => {
    const angle = side * radialSlotHalfAngle;
    const lip = beamBetween3D(
      new THREE.Vector3(
        0,
        centralBallRadius * Math.cos(angle),
        centralBallRadius * Math.sin(angle),
      ),
      new THREE.Vector3(
        0,
        pistonDiscBodyRadius * Math.cos(angle),
        pistonDiscBodyRadius * Math.sin(angle),
      ),
      0.045,
      0.045,
      diskEdgeMaterial,
    );
    lip.userData.role = `moving-radial-slot-lip-${index + 1}`;
    diskAssembly.add(lip);
    return lip;
  });
  const pistonBall = new THREE.Mesh(
    new THREE.SphereGeometry(centralBallRadius, 40, 24),
    ballMaterial,
  );
  pistonBall.userData.role =
    'moving-central-ball-attached-to-piston-disc';
  const crankSideRod = cylinderAlongX(0.105,
    pistonRodCrankLength - centralBallRadius * 0.45,
    ballMaterial, 30);
  crankSideRod.position.x = (
    pistonRodCrankLength + centralBallRadius * 0.45
  ) / 2;
  crankSideRod.userData.role =
    'rigid-piston-rod-from-central-ball-to-crank-socket';
  const counterSideRod = cylinderAlongX(0.10,
    counterRodLength - centralBallRadius * 0.45,
    ballMaterial, 30);
  counterSideRod.position.x = -(
    counterRodLength + centralBallRadius * 0.45
  ) / 2;
  counterSideRod.userData.role =
    'rigid-opposite-piston-rod-extension';
  const crankEndBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.235, 28, 18),
    ballMaterial,
  );
  crankEndBall.position.x = pistonRodCrankLength;
  crankEndBall.userData.role = 'moving-ball-in-crank-pin-socket-P';
  const crankEndAnchor = new THREE.Object3D();
  crankEndAnchor.position.x = pistonRodCrankLength;
  crankEndAnchor.userData.role = 'analytic-piston-rod-crank-end-P';
  const centralBallAnchor = new THREE.Object3D();
  centralBallAnchor.userData.role = 'analytic-fixed-center-of-moving-ball-B';
  const slotOuterAnchor = new THREE.Object3D();
  slotOuterAnchor.position.y = chamberRadius;
  slotOuterAnchor.userData.role = 'analytic-outer-end-of-radial-disc-slot';
  const discIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      pistonDiscThickness + 0.025,
      pistonDiscBodyRadius * 0.82,
      0.075,
    ),
    whiteMaterial,
  );
  discIndex.position.set(
    pistonDiscThickness / 2 + 0.018,
    -pistonDiscBodyRadius * 0.49,
    0,
  );
  discIndex.userData.role = 'fixed-to-disc-roll-index';
  diskAssembly.add(
    pistonDisc,
    diskRimSeal,
    pistonBall,
    crankSideRod,
    counterSideRod,
    crankEndBall,
    crankEndAnchor,
    centralBallAnchor,
    slotOuterAnchor,
    discIndex,
  );
  root.add(diskAssembly);

  const coneContactMarkers = [-1, 1].map((side, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 20, 12),
      whiteMaterial,
    );
    marker.userData.role = `moving-cone-generator-contact-marker-${index + 1}`;
    root.add(marker);
    return marker;
  });

  const contacts = {
    centralBallInConcentricSeats: {
      fixedMember: fixedChamber,
      movingMember: diskAssembly,
      point: ballCenter.clone(),
      type: 'spherical-pair-central-ball-in-fixed-concentric-seats-B',
    },
    diskFacesAtConicalHeads: {
      members: [diskAssembly, fixedChamber],
      points: [new THREE.Vector3(), new THREE.Vector3()],
      type: 'two-moving-generator-lines-on-opposed-fixed-conical-heads',
    },
    diskRimInSphericalZone: {
      center: ballCenter.clone(),
      fixedMember: fixedChamber,
      movingMember: diskAssembly,
      nominalRadius: chamberRadius,
      type: 'nutating-peripheral-seal-on-fixed-spherical-zone',
    },
    pistonRodAtCrankSocket: {
      members: [diskAssembly, inputCrank],
      point: new THREE.Vector3(),
      type: 'spherical-pair-piston-rod-end-in-rotating-crank-socket-P',
    },
    radialSlotOnFixedDiaphragm: {
      fixedMember: fixedPartition,
      movingMember: diskAssembly,
      outerPoint: new THREE.Vector3(),
      planeNormal: Z_AXIS.clone(),
      type: 'sliding-radial-slot-over-fixed-diaphragm-in-world-XY-plane',
    },
    shaftBearings: {
      fixedMember: fixedFrame,
      movingMember: inputCrank,
      point: crankCenter.clone(),
      type: 'fixed-revolute-output-shaft-bearings-about-X',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCrank.rotation.x = state.inputAngle;
    inputCrank.userData.angularSpeed = state.inputAngularSpeed;
    inputCrank.userData.angularAcceleration =
      state.inputAngularAcceleration;
    diskAssembly.quaternion.copy(state.disk.orientation);
    diskAssembly.userData.angularVelocity =
      state.disk.angularVelocity.clone();
    diskAssembly.userData.angularAcceleration =
      state.disk.angularAcceleration.clone();
    coneContactMarkers[0].position.copy(state.disk.coneContactMinus);
    coneContactMarkers[1].position.copy(state.disk.coneContactPlus);
    contacts.diskFacesAtConicalHeads.points[0]
      .copy(state.disk.coneContactMinus);
    contacts.diskFacesAtConicalHeads.points[1]
      .copy(state.disk.coneContactPlus);
    contacts.pistonRodAtCrankSocket.point.copy(state.pointP);
    contacts.radialSlotOnFixedDiaphragm.outerPoint
      .copy(state.disk.slotOuterPoint);
    root.userData.kinematics = state;
  };

  const modelPointToReferenceRaster = (point) => new THREE.Vector2(
    sourceRasterBallCenter.x
      + (point.x - ballCenter.x) * sourcePixelsPerModelUnit,
    sourceRasterBallCenter.y
      - (point.y - ballCenter.y) * sourcePixelsPerModelUnit,
  );

  const geometry = {
    ballCenter,
    centralBallRadius,
    chamberAxialHalfLength,
    chamberJunctionRadius,
    chamberRadius,
    counterRodLength,
    crankCenter,
    crankPlaneDistance,
    crankRadius,
    cyclePeriod,
    inputAngularSpeed,
    nutationHalfAngle,
    pistonDiscBodyRadius,
    pistonDiscThickness,
    pistonRodCrankLength,
    radialPartitionThickness,
    radialSlotHalfAngle,
    sourceDiscRadiusPixels,
    sourcePixelsPerModelUnit,
  };

  root.userData.archetype =
    'nutating-disc-steam-engine-ball-joint-crank';
  root.userData.blocks = {
    base,
    baseEdge,
    centralBallAnchor,
    centralSeatRings,
    chamberCradle,
    chamberFeet,
    chamberJunctionRings,
    chamberShellRibs,
    coneContactMarkers,
    coneGeneratorRibs,
    conicalHeads,
    counterSideRod,
    crankArm,
    crankBearings,
    crankEndAnchor,
    crankEndBall,
    crankHub,
    crankIndex,
    crankPinAnchor,
    crankShaft,
    crankSideRod,
    discIndex,
    diskAssembly,
    diskRimSeal,
    fixedChamber,
    fixedFrame,
    fixedPartition,
    flywheelRim,
    flywheelSpokes,
    inputCrank,
    partitionFace,
    pistonBall,
    pistonDisc,
    slotLips,
    slotOuterAnchor,
    sphericalZone,
  };
  root.userData.cameraDistanceScale = 1.16;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(crankCenter.x - 1.85, 0, -2.72),
    new THREE.Vector3(chamberAxialHalfLength + 2.75,
      ballCenter.y + chamberRadius + 0.30, 2.72),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input:
      'one rotating crankshaft coordinate; steam power may drive the same coordinate in the reverse causal direction',
    mechanism: 1,
    output:
      'one disk normal precessing on a fixed cone while its radial slot remains on the fixed diaphragm plane',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = 0;
  root.userData.mechanism =
    'fixed-spherical-zone-and-opposed-conical-heads-central-ball-B-slotted-nutating-disc-rigid-perpendicular-piston-rod-B-P-socketed-to-crank-P-on-horizontal-output-shaft-with-fixed-radial-diaphragm-preventing-free-disc-spin';
  root.userData.modelPointToReferenceRaster = modelPointToReferenceRaster;
  root.userData.sourceAnimation = {
    available: false,
    demonstrationCyclesPerMinute,
    demonstrationDurationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason:
      'the official Movement 347 page marks Animated unavailable and contains no canvas model; the four-second loop is an explicit demonstration tempo, not a claimed source speed',
    referenceScope:
      'Brown fixes the edgewise nutating disk, opposed conical heads, central ball and crank-connected perpendicular rod. Reuleaux and the preserved Dakeyne model independently fix the spherical peripheral zone and the otherwise omitted fixed radial diaphragm and matching one-sided disk slot.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate347: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one edgewise circular disk fixed perpendicular to a rod through central ball B; its left end reaches a crank pin while the fixed chamber supplies opposed cones and a spherical peripheral wall',
      measurementUncertaintyPixels: 20,
      rasterBallCenter: sourceRasterBallCenter,
      rasterChamberBottom: sourceRasterChamberBottom,
      rasterChamberTop: sourceRasterChamberTop,
      rasterCrankPin: sourceRasterCrankPin,
      rasterDiscLowerRim: sourceRasterDiscLowerRim,
      rasterDiscUpperRim: sourceRasterDiscUpperRim,
    },
    reuleauxConicDoubleSlider: {
      author: 'Franz Reuleaux',
      construction:
        'Davies disc engine is chamber gear from the conic turning double-slider; the plane disc has spherical center and peripheral surfaces, its faces envelope two cones, and its radial slit or packed sliding block works over a fixed chamber diaphragm.',
      pages: [386, 388, 389],
      plate: 'XXVIII, figures 1–3',
      publication: 'The Kinematics of Machinery',
      publicationYear: 1876,
      url: 'https://en.wikisource.org/wiki/Page:The_Kinematics_of_Machinery.djvu/408',
    },
    scienceMuseumDakeyneModel: {
      collectionNumber: '1893-172',
      construction:
        'spherical lateral zone, opposed cones meeting at their apexes, circular disc with central ball, perpendicular rod socketed in a crank, fixed radial partition, and corresponding disc slot',
      institution: 'Science Museum Group',
      url: 'https://collection.sciencemuseumgroup.org.uk/objects/co51101/model-of-disc-engine',
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
    reconstruction: {
      crankPlaneDistance,
      crankRadius,
      dimensionalStatus:
        'proportional normalization from engraving landmarks; Brown supplies no dimensions',
      nutationHalfAngle,
      pistonRodCrankLength,
      sourcePixelsPerModelUnit,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    chamberContact:
      'the disk rim remains on the sphere |X-B|=R while its two faces touch one generator of each opposed cone',
    crankConstraint:
      'P=B+L n lies on the crank circle P=(-D, r cos(theta), r sin(theta)) with L^2=D^2+r^2',
    diaphragmConstraint:
      'the one-sided disk slot follows normalized (n_y,-n_x,0), exactly the intersection of the disk plane n·(X-B)=0 with the fixed XY diaphragm plane',
    motion:
      'uniform shaft rotation makes disk normal n precess at constant half-angle beta; the fixed diaphragm controls roll, so the disk nutates rather than freely spinning about n',
    powerFlow:
      'steam alternately expands on opposite disk faces and can drive the crankshaft; the visualization parameterizes that reversible one-DOF relation by shaft angle',
  };

  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(-8.3, 5.2, 10.8),
    root,
    update,
  };
}

export function createAuthoredDiskEngineMovement(movement) {
  switch (movement.id) {
    case 347: return diskEngine(movement);
    default: return null;
  }
}
