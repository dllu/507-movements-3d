import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

function chainPump(movement) {
  const root = new THREE.Group();
  const pitchRadius = 0.62;
  const wheelPocketCount = 8;
  const carrierCount = 24;
  const diskEveryCarriers = 2;
  const diskCount = carrierCount / diskEveryCarriers;
  const carrierSpacing = FULL_TURN * pitchRadius / wheelPocketCount;
  const totalPathLength = carrierCount * carrierSpacing;
  const wheelCenterDistance = (totalPathLength - FULL_TURN * pitchRadius) / 2;
  const topWheelCenter = new THREE.Vector3(0, 2.67, 0);
  const bottomWheelCenter = new THREE.Vector3(
    0,
    topWheelCenter.y - wheelCenterDistance,
    0,
  );
  const leftLegX = -pitchRadius;
  const rightLegX = pitchRadius;
  const diskSpacing = carrierSpacing * diskEveryCarriers;
  const linearSpeed = 0.84;
  const wheelAngularSpeed = -linearSpeed / pitchRadius;
  const inputAngularSpeed = linearSpeed / pitchRadius;
  const wheelPitchCircumference = FULL_TURN * pitchRadius;
  const visualRepeatCarrierShift = wheelPocketCount;
  const visualRepeatWheelAngle = FULL_TURN;
  const cycleDuration = wheelPitchCircumference / linearSpeed;
  const cylinderInnerRadius = 0.285;
  const diskRadius = 0.270;
  const radialSealClearance = cylinderInnerRadius - diskRadius;
  const diskThickness = 0.085;
  const cylinderTopY = 1.70;
  const cylinderBottomY = bottomWheelCenter.y + 0.08;
  const cylinderHeight = cylinderTopY - cylinderBottomY;
  const cylinderCenterY = (cylinderTopY + cylinderBottomY) / 2;
  const theoreticalBucketVolume = Math.PI * cylinderInnerRadius ** 2
    * diskSpacing;
  const theoreticalFlowRate = Math.PI * cylinderInnerRadius ** 2
    * linearSpeed;
  const reservoirSurfaceY = -0.55;
  const groundY = -2.18;
  const leftVerticalEnd = wheelCenterDistance;
  const topArcEnd = leftVerticalEnd + Math.PI * pitchRadius;
  const rightVerticalEnd = topArcEnd + wheelCenterDistance;

  const pathPointAtDistance = (unwrappedDistance) => {
    const distance = positiveModulo(unwrappedDistance, totalPathLength);
    if (distance < leftVerticalEnd) {
      return {
        accelerationNormal: new THREE.Vector3(),
        distance,
        position: new THREE.Vector3(
          leftLegX,
          bottomWheelCenter.y + distance,
          0,
        ),
        segment: 'ascending-water-tight-cylinder-leg',
        tangent: new THREE.Vector3(0, 1, 0),
      };
    }
    if (distance < topArcEnd) {
      const arcDistance = distance - leftVerticalEnd;
      const angle = Math.PI - arcDistance / pitchRadius;
      const position = new THREE.Vector3(
        topWheelCenter.x + pitchRadius * Math.cos(angle),
        topWheelCenter.y + pitchRadius * Math.sin(angle),
        0,
      );
      return {
        accelerationNormal: topWheelCenter.clone().sub(position).normalize(),
        distance,
        position,
        segment: 'upper-wheel-semicircle',
        tangent: new THREE.Vector3(Math.sin(angle), -Math.cos(angle), 0),
      };
    }
    if (distance < rightVerticalEnd) {
      const legDistance = distance - topArcEnd;
      return {
        accelerationNormal: new THREE.Vector3(),
        distance,
        position: new THREE.Vector3(
          rightLegX,
          topWheelCenter.y - legDistance,
          0,
        ),
        segment: 'exposed-descending-return-leg',
        tangent: new THREE.Vector3(0, -1, 0),
      };
    }
    const arcDistance = distance - rightVerticalEnd;
    const angle = -arcDistance / pitchRadius;
    const position = new THREE.Vector3(
      bottomWheelCenter.x + pitchRadius * Math.cos(angle),
      bottomWheelCenter.y + pitchRadius * Math.sin(angle),
      0,
    );
    return {
      accelerationNormal: bottomWheelCenter.clone().sub(position).normalize(),
      distance,
      position,
      segment: 'lower-wheel-semicircle',
      tangent: new THREE.Vector3(Math.sin(angle), -Math.cos(angle), 0),
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const chainTravel = pitchRadius * inputAngle;
    const chainSpeed = pitchRadius * inputSpeed;
    const chainAcceleration = pitchRadius * inputAcceleration;
    const wheelAngle = -inputAngle;
    const wheelSpeed = -inputSpeed;
    const wheelAcceleration = -inputAcceleration;
    const carrierStates = Array.from({ length: carrierCount }, (_, index) => {
      const baseDistance = index * carrierSpacing;
      const path = pathPointAtDistance(baseDistance + chainTravel);
      const velocity = path.tangent.clone().multiplyScalar(chainSpeed);
      const acceleration = path.tangent.clone().multiplyScalar(chainAcceleration)
        .addScaledVector(
          path.accelerationNormal,
          path.accelerationNormal.lengthSq() > 0
            ? chainSpeed ** 2 / pitchRadius
            : 0,
        );
      return {
        ...path,
        acceleration,
        hasSealingDisk: index % diskEveryCarriers === 0,
        index,
        velocity,
      };
    });
    const ascendingDisks = carrierStates.filter(({ hasSealingDisk, position,
      segment }) => hasSealingDisk
      && segment === 'ascending-water-tight-cylinder-leg'
      && position.y >= cylinderBottomY - diskThickness / 2
      && position.y <= cylinderTopY + diskThickness / 2);
    return {
      ascendingDiskCount: ascendingDisks.length,
      ascendingDiskIndices: ascendingDisks.map(({ index }) => index),
      carrierStates,
      chainAcceleration,
      chainSpeed,
      chainTravel,
      deliveredFlowDirection: 'up-left-leg-and-out-discharge-trough',
      inputAcceleration,
      inputAngle,
      inputSpeed,
      phase: positiveModulo(chainTravel, diskSpacing) / diskSpacing,
      theoreticalFlowRate:
        Math.PI * cylinderInnerRadius ** 2 * Math.max(0, chainSpeed),
      wheelAcceleration,
      wheelAngle,
      wheelSpeed,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const diskMaterial = matte(PALETTE.brass, {
    metalness: 0.14,
    roughness: 0.55,
  });
  const topWheelMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.57,
  });
  const bottomWheelMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.57,
  });
  const pipeMaterial = matte(PALETTE.muted, {
    opacity: 0.30,
    roughness: 0.68,
    side: THREE.DoubleSide,
    transparent: true,
  });
  pipeMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.42,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const reservoirWaterMaterial = matte(PALETTE.fluid, {
    opacity: 0.20,
    roughness: 0.32,
    side: THREE.DoubleSide,
    transparent: true,
  });
  reservoirWaterMaterial.depthWrite = false;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.14, 3.2),
    frameMaterial,
  ), 'fixed-foundation-of-endless-chain-pump');
  base.position.set(0, groundY + 0.07, 0);
  root.add(base);
  const reservoir = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.15, 1.45, 2.45),
    reservoirWaterMaterial,
  ), 'lower-reservoir-submerging-return-wheel-and-chain-intake');
  reservoir.position.set(0, reservoirSurfaceY - 0.725, 0);
  root.add(reservoir);
  const reservoirRim = addRole(new THREE.Group(),
    'open-four-rail-reservoir-rim');
  for (const z of [-1.295, 1.295]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(6.45, 0.14, 0.16),
      frameMaterial,
    );
    rail.position.set(0, reservoirSurfaceY - 0.02, z);
    reservoirRim.add(rail);
  }
  for (const x of [-3.145, 3.145]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.14, 2.59),
      frameMaterial,
    );
    rail.position.set(x, reservoirSurfaceY - 0.02, 0);
    reservoirRim.add(rail);
  }
  root.add(reservoirRim);
  const reservoirOpening = new THREE.Mesh(
    new THREE.BoxGeometry(6.10, 0.025, 2.40),
    reservoirWaterMaterial,
  );
  reservoirOpening.position.set(0, reservoirSurfaceY + 0.015, 0);
  root.add(reservoirOpening);

  const support = addRole(new THREE.Group(),
    'fixed-frame-supporting-upper-powered-chain-wheel');
  root.add(support);
  for (const x of [-1.45, 1.45]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 3.55, 0.22),
      frameMaterial,
    );
    post.position.set(x, 1.55, -0.58);
    support.add(post);
  }
  const topBeam = new THREE.Mesh(
    new THREE.BoxGeometry(3.25, 0.18, 0.26),
    frameMaterial,
  );
  topBeam.position.set(0, topWheelCenter.y, -0.58);
  support.add(topBeam);

  const makeWheel = (center, material, side) => {
    const rotor = addRole(new THREE.Group(),
      `${side}-eight-spoke-chain-wheel-rotor`);
    rotor.position.copy(center);
    root.add(rotor);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(pitchRadius, 0.075, 12, 64),
      material,
    );
    rotor.add(rim);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.48, 28),
      darkMaterial,
    );
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);
    const spokes = [];
    for (let index = 0; index < wheelPocketCount; index += 1) {
      const angle = index * FULL_TURN / wheelPocketCount;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(pitchRadius * 1.60, 0.075, 0.16),
        index === 0
          ? matte(PALETTE.white, { roughness: 0.48 })
          : darkMaterial,
      );
      spoke.position.set(
        Math.cos(angle) * pitchRadius * 0.36,
        Math.sin(angle) * pitchRadius * 0.36,
        0,
      );
      spoke.rotation.z = angle;
      rotor.add(spoke);
      spokes.push(spoke);
    }
    const axle = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.88, 24),
      darkMaterial,
    ), `${side}-fixed-chain-wheel-axle`);
    axle.rotation.x = Math.PI / 2;
    axle.position.copy(center);
    root.add(axle);
    return { axle, hub, rim, rotor, spokes };
  };
  const topWheel = makeWheel(topWheelCenter, topWheelMaterial, 'upper-powered');
  const bottomWheel = makeWheel(
    bottomWheelCenter,
    bottomWheelMaterial,
    'lower-return',
  );

  const pathCurve = new THREE.Curve();
  pathCurve.getPoint = (parameter, target = new THREE.Vector3()) => target.copy(
    pathPointAtDistance(parameter * totalPathLength).position,
  );
  const endlessChain = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pathCurve, 320, 0.034, 8, true),
    darkMaterial,
  ), 'one-continuous-endless-chain-around-two-equal-wheels');
  root.add(endlessChain);

  const cylinder = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderInnerRadius + 0.06,
      cylinderInnerRadius + 0.06,
      cylinderHeight,
      40,
      1,
      true,
    ),
    pipeMaterial,
  ), 'water-tight-rising-cylinder-fitted-to-moving-disks');
  cylinder.position.set(leftLegX, cylinderCenterY, 0);
  root.add(cylinder);
  const cylinderWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderInnerRadius * 0.94,
      cylinderInnerRadius * 0.94,
      cylinderHeight - 0.08,
      32,
    ),
    waterMaterial,
  ), 'water-column-lifted-between-successive-chain-disks');
  cylinderWater.position.copy(cylinder.position);
  root.add(cylinderWater);
  const cylinderFlanges = [cylinderBottomY, cylinderTopY].map((y, index) => {
    const flange = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(cylinderInnerRadius + 0.07, 0.045, 10, 40),
      darkMaterial,
    ), index === 0 ? 'lower-cylinder-mouth' : 'upper-cylinder-mouth');
    flange.rotation.x = Math.PI / 2;
    flange.position.set(leftLegX, y, 0);
    root.add(flange);
    return flange;
  });

  const dischargeTrough = addRole(new THREE.Group(),
    'upper-left-discharge-trough-receiving-raised-water');
  root.add(dischargeTrough);
  const troughFloor = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.09, 0.72),
    frameMaterial,
  );
  troughFloor.position.set(leftLegX - 1.05, cylinderTopY - 0.02, 0);
  troughFloor.rotation.z = THREE.MathUtils.degToRad(-4);
  dischargeTrough.add(troughFloor);
  for (const z of [-0.39, 0.39]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.24, 0.055),
      frameMaterial,
    );
    rail.position.copy(troughFloor.position);
    rail.position.z = z;
    rail.rotation.z = troughFloor.rotation.z;
    dischargeTrough.add(rail);
  }
  const dischargeWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.20, 0.055, 0.64),
    waterMaterial,
  ), 'continuous-delivery-stream-from-chain-pump-cylinder');
  dischargeWater.position.copy(troughFloor.position);
  dischargeWater.position.y += 0.09;
  dischargeWater.rotation.z = troughFloor.rotation.z;
  dischargeTrough.add(dischargeWater);

  const carriers = Array.from({ length: carrierCount }, (_, index) => {
    const carrier = addRole(new THREE.Group(),
      `functional-chain-carrier-${index + 1}`);
    root.add(carrier);
    const link = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.040, 0.12, 3, 8),
      darkMaterial,
    );
    carrier.add(link);
    let disk = null;
    if (index % diskEveryCarriers === 0) {
      disk = addRole(new THREE.Mesh(
        new THREE.CylinderGeometry(
          diskRadius,
          diskRadius,
          diskThickness,
          30,
        ),
        diskMaterial,
      ), `water-sealing-chain-disk-${index / diskEveryCarriers + 1}`);
      carrier.add(disk);
    }
    return { carrier, disk, index, link };
  });

  const update = (time) => {
    const state = stateAtTime(time);
    topWheel.rotor.rotation.z = state.wheelAngle;
    bottomWheel.rotor.rotation.z = state.wheelAngle;
    state.carrierStates.forEach((carrierState, index) => {
      const carrier = carriers[index].carrier;
      carrier.position.copy(carrierState.position);
      carrier.quaternion.setFromUnitVectors(
        Y_AXIS,
        carrierState.tangent,
      );
    });
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    bottomWheelCenter,
    carrierCount,
    carrierSpacing,
    cylinderBottomY,
    cylinderHeight,
    cylinderInnerRadius,
    cylinderTopY,
    cycleDuration,
    diskCount,
    diskEveryCarriers,
    diskRadius,
    diskSpacing,
    diskThickness,
    groundY,
    inputAngularSpeed,
    leftLegX,
    linearSpeed,
    pitchRadius,
    radialSealClearance,
    reservoirSurfaceY,
    rightLegX,
    theoreticalBucketVolume,
    theoreticalFlowRate,
    topWheelCenter,
    totalPathLength,
    visualRepeatWheelAngle,
    visualRepeatCarrierShift,
    wheelAngularSpeed,
    wheelCenterDistance,
    wheelPitchCircumference,
    wheelPocketCount,
  };
  root.userData = {
    archetype:
      'endless-chain-pump-with-sealing-disks-water-tight-riser-and-powered-upper-wheel',
    blocks: {
      base,
      bottomWheel,
      carriers,
      cylinder,
      cylinderFlanges,
      cylinderWater,
      dischargeTrough,
      dischargeWater,
      endlessChain,
      reservoir,
      reservoirOpening,
      reservoirRim,
      support,
      topWheel,
    },
    degreesOfFreedom: {
      bottomWheelIndependent: false,
      carrierMotionIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      topWheelPowerInput: true,
    },
    dynamics: {
      chainElasticityDiskLeakageFluidInertiaHydraulicHeadBearingFrictionCavitationAndDriveTorqueModeled:
        false,
      flowModel:
        'With zero ideal leakage, successive disks displace cylinder area times chain speed, Q=pi*r_cylinder^2*v. The displayed water column and trough clarify the delivery route; pressure, slip and real volumetric efficiency are not solved.',
      pathModel:
        'Every carrier advances at constant arc length around two vertical tangents and two exact semicircles. Position and tangent are continuous at all four wheel tangencies; ideal centripetal acceleration changes from zero on a straight leg to v^2/R on a wheel arc.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Power turns the upper eight-pocket wheel clockwise. One endless chain travels upward on the left through a water-tight cylinder, over the upper wheel, downward on the exposed right return leg, and around the submerged lower wheel. Twelve equally spaced wood-or-metal disks are carried perpendicular to the chain tangent; their small radial clearance in the left cylinder divides its water column into successive moving buckets. Both equal wheels have the same exact no-slip angular rate, chain speed divided by pitch radius.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'uniform-arc-length-endless-chain-with-functional-sealing-disks',
    },
    pathPointAtDistance,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      carrierPositions: sourceState.carrierStates.map(
        ({ position }) => position.clone(),
      ),
      chainTravel: sourceState.chainTravel,
      wheelAngle: sourceState.wheelAngle,
    },
    sourceReference: {
      brownPlate462: {
        approximateBottomWheelCenterPixels: [315, 413],
        approximateCylinderBoundsPixels: [226, 176, 94, 190],
        approximateLeftChainLegXPixel: 264,
        approximateRightChainLegXPixel: 364,
        approximateTopWheelCenterPixels: [317, 99],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'a chain pump lifts water by continuous circular motion',
          'wood or metal disks are carried by an endless chain',
          'the disks fit a water-tight cylinder',
          'successive disks and cylinder spaces form buckets filled with water',
          'power is applied at the upper wheel',
        ],
        engravingEvidence:
          'Brown shows equal upper and lower spoked wheels, a closed chain loop with its left ascending leg inside a vertical riser and right descending leg exposed, repeated transverse disks on both legs, the lower wheel submerged, and a left discharge trough at the riser head.',
        reconstructionDisclosure:
          'Brown gives no wheel diameter, chain pitch, disk count or spacing, cylinder bore, seal clearance, speed, head, flow, power or timing. Equal 0.62-radius eight-pocket wheels, 24 chain carriers, twelve functional disks, exact pitch closure, a 0.015 radial clearance, ideal displacement diagnostics, colors and 0.84-unit-per-second chain speed are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 462',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      chainPitchClosure:
        'Twenty-four carrier pitches exactly equal two straight center distances plus both semicircular wraps; one wheel circumference contains exactly eight carrier pitches.',
      noSlip:
        'theta_top=theta_bottom=-s/R and omega_top=omega_bottom=-v/R for upward motion on the left tangent.',
      sealingBuckets:
        'Every second carrier bears a disk, so adjacent sealing disks enclose one ideal cylinder bucket of length two carrier pitches.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.55, groundY - 0.02, -1.72),
    new THREE.Vector3(3.55, 3.65, 1.72),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(3.4, 1.45, 13.0);
  root.userData.groundFloorY = groundY;
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredChainPumpMovement(movement) {
  if (movement.id !== 462) return null;
  return chainPump(movement);
}
