import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function horizontalRing(radius, tubeRadius, material) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 56),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function setCylinderBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.clone().normalize(),
  );
  mesh.scale.set(1, delta.length(), 1);
}

function setVerticalExtent(mesh, bottom, top) {
  const height = Math.max(0.001, top - bottom);
  mesh.position.y = (bottom + top) / 2;
  mesh.scale.y = height;
  mesh.visible = top > bottom;
}

function positiveC2Lobe(value) {
  return Math.max(0, value) ** 3;
}

function makeTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 16, false),
    material,
  ), role);
  tube.userData.curve = curve;
  return tube;
}

function makeDiaphragmGeometry(radius, radialSegments, angularSegments) {
  const positions = [0, 0, 0];
  const radialFractions = [0];
  for (let radial = 1; radial <= radialSegments; radial += 1) {
    const fraction = radial / radialSegments;
    for (let angular = 0; angular < angularSegments; angular += 1) {
      const angle = FULL_TURN * angular / angularSegments;
      positions.push(
        radius * fraction * Math.cos(angle),
        0,
        radius * fraction * Math.sin(angle),
      );
      radialFractions.push(fraction);
    }
  }
  const indices = [];
  const ringVertex = (radial, angular) => 1
    + (radial - 1) * angularSegments
    + THREE.MathUtils.euclideanModulo(angular, angularSegments);
  for (let angular = 0; angular < angularSegments; angular += 1) {
    indices.push(
      0,
      ringVertex(1, angular),
      ringVertex(1, angular + 1),
    );
  }
  for (let radial = 2; radial <= radialSegments; radial += 1) {
    for (let angular = 0; angular < angularSegments; angular += 1) {
      const previous = ringVertex(radial - 1, angular);
      const previousNext = ringVertex(radial - 1, angular + 1);
      const current = ringVertex(radial, angular);
      const currentNext = ringVertex(radial, angular + 1);
      indices.push(previous, current, currentNext);
      indices.push(previous, currentNext, previousNext);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.userData.radialFractions = radialFractions;
  geometry.computeVertexNormals();
  return geometry;
}

function diaphragmForcePump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.1;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const leverPivot = new THREE.Vector3(-1.45, 2.70, 0);
  const leverPinRadius = 1.45;
  const leverAmplitude = THREE.MathUtils.degToRad(15);
  const diaphragmCenterX = 0;
  const connectingRodLength = 1.20;
  const diaphragmRadius = 1.15;
  const diaphragmRimY = 1.50;
  const chamberBottomY = -0.35;
  const chamberArea = Math.PI * diaphragmRadius ** 2;
  const diaphragmEffectiveArea = chamberArea / 3;
  const maximumValveAngle = THREE.MathUtils.degToRad(24);
  const groundY = -2.16;
  const suctionValveSeat = new THREE.Vector3(0, -0.22, 0.38);
  const deliveryValveSeat = new THREE.Vector3(2.02, 1.18, 0.38);

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const cycleAngle = FULL_TURN * phase;
    const sine = Math.sin(cycleAngle);
    const cosine = Math.cos(cycleAngle);
    const strokeSine = Math.abs(sine) < 1e-12 ? 0 : sine;
    const leverAngle = -leverAmplitude * cosine;
    const leverAngularSpeed = leverAmplitude * strokeSine * inputSpeed;
    const leverAngularAcceleration = leverAmplitude * (
      cosine * inputSpeed ** 2 + sine * inputAcceleration
    );
    const leverPin = new THREE.Vector3(
      leverPivot.x + leverPinRadius * Math.cos(leverAngle),
      leverPivot.y + leverPinRadius * Math.sin(leverAngle),
      0,
    );
    const leverPinVelocity = new THREE.Vector3(
      -leverPinRadius * Math.sin(leverAngle) * leverAngularSpeed,
      leverPinRadius * Math.cos(leverAngle) * leverAngularSpeed,
      0,
    );
    const leverPinAcceleration = new THREE.Vector3(
      -leverPinRadius * (
        Math.cos(leverAngle) * leverAngularSpeed ** 2
          + Math.sin(leverAngle) * leverAngularAcceleration
      ),
      leverPinRadius * (
        -Math.sin(leverAngle) * leverAngularSpeed ** 2
          + Math.cos(leverAngle) * leverAngularAcceleration
      ),
      0,
    );
    const horizontalOffset = leverPin.x - diaphragmCenterX;
    const verticalProjection = Math.sqrt(
      connectingRodLength ** 2 - horizontalOffset ** 2,
    );
    const diaphragmCenterY = leverPin.y - verticalProjection;
    const diaphragmCenterVelocity = leverPinVelocity.y
      + horizontalOffset * leverPinVelocity.x / verticalProjection;
    const diaphragmCenterAcceleration = leverPinAcceleration.y
      + (
        leverPinVelocity.x ** 2
          + horizontalOffset * leverPinAcceleration.x
      ) / verticalProjection
      + (horizontalOffset * leverPinVelocity.x) ** 2
        / verticalProjection ** 3;
    const connectingRodBottom = new THREE.Vector3(
      diaphragmCenterX,
      diaphragmCenterY,
      0,
    );
    const averageWaterTopY = diaphragmRimY
      + (diaphragmCenterY - diaphragmRimY) / 3;
    const chamberWaterVolume = chamberArea
      * (diaphragmRimY - chamberBottomY)
      + diaphragmEffectiveArea
        * (diaphragmCenterY - diaphragmRimY);
    const chamberWaterVolumeRate = diaphragmEffectiveArea
      * diaphragmCenterVelocity;
    const suctionFlowRate = Math.max(0, chamberWaterVolumeRate);
    const deliveryFlowRate = Math.max(0, -chamberWaterVolumeRate);
    const suctionOpen = positiveC2Lobe(strokeSine);
    const deliveryOpen = positiveC2Lobe(-strokeSine);
    let mode;
    if (strokeSine === 0) {
      mode = cosine >= 0
        ? 'diaphragm-low-dead-center-both-checks-seated'
        : 'diaphragm-high-dead-center-both-checks-seated';
    } else if (strokeSine > 0) {
      mode = 'diaphragm-rising-suction-check-open-chamber-filling';
    } else {
      mode = 'diaphragm-descending-delivery-check-open-water-forced-up-riser';
    }
    return {
      averageWaterTopY,
      chamberWaterVolume,
      chamberWaterVolumeRate,
      connectingRodBottom,
      deliveryFlowRate,
      deliveryValveAngle: maximumValveAngle * deliveryOpen,
      deliveryValveOpen: deliveryOpen,
      diaphragmCenterAcceleration,
      diaphragmCenterVelocity,
      diaphragmCenterY,
      diaphragmEffectiveArea,
      horizontalOffset,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      leverPin,
      leverPinAcceleration,
      leverPinVelocity,
      mode,
      phase,
      suctionFlowRate,
      suctionValveAngle: maximumValveAngle * suctionOpen,
      suctionValveOpen: suctionOpen,
      verticalProjection,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.60,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const leverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.55,
  });
  const diaphragmMaterial = matte(PALETTE.driven, {
    opacity: 0.92,
    roughness: 0.54,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.27,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.68,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const suctionMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.48,
  });
  const deliveryMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.48,
  });

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 0.15, 3.1),
    frameMaterial,
  ), 'fixed-diaphragm-pump-foundation');
  base.position.set(-0.25, groundY + 0.075, 0);
  root.add(base);

  const chamberHeight = diaphragmRimY - chamberBottomY;
  const chamberShell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      1.31,
      1.31,
      chamberHeight,
      64,
      1,
      true,
    ),
    shellMaterial,
  ), 'fixed-cylindrical-water-chamber-below-diaphragm');
  chamberShell.position.set(
    diaphragmCenterX,
    (diaphragmRimY + chamberBottomY) / 2,
    0,
  );
  root.add(chamberShell);
  const chamberBottom = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.31, 1.31, 0.14, 56),
    frameMaterial,
  ), 'fixed-diaphragm-pump-chamber-bottom');
  chamberBottom.position.set(diaphragmCenterX, chamberBottomY, 0);
  root.add(chamberBottom);
  const chamberRim = addRole(horizontalRing(
    1.31,
    0.085,
    darkMaterial,
  ), 'fixed-circular-clamping-ring-around-diaphragm-edge');
  chamberRim.position.set(diaphragmCenterX, diaphragmRimY, 0);
  root.add(chamberRim);
  const clampRing = horizontalRing(1.17, 0.055, leverMaterial);
  clampRing.position.copy(chamberRim.position);
  root.add(clampRing);

  const chamberRails = addRole(new THREE.Group(),
    'fixed-cutaway-diaphragm-chamber-outline');
  for (const x of [-1.18, 1.18]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, chamberHeight - 0.12, 0.10),
      frameMaterial,
    );
    rail.position.set(x, (diaphragmRimY + chamberBottomY) / 2, -0.92);
    chamberRails.add(rail);
  }
  root.add(chamberRails);

  const diaphragmGeometry = makeDiaphragmGeometry(
    diaphragmRadius,
    14,
    64,
  );
  const diaphragm = addRole(new THREE.Mesh(
    diaphragmGeometry,
    diaphragmMaterial,
  ), 'single-flexible-diaphragm-clamped-at-rim-and-driven-at-center');
  diaphragm.position.x = diaphragmCenterX;
  root.add(diaphragm);
  const diaphragmSeams = [0.28, 0.56, 0.84, 1.12].map(
    (radius, index) => {
      const seam = addRole(horizontalRing(
        radius,
        0.025,
        darkMaterial,
      ), `flexing-diaphragm-concentric-seam-${index + 1}`);
      seam.position.x = diaphragmCenterX;
      root.add(seam);
      return { radius, seam };
    },
  );

  const chamberWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      diaphragmRadius,
      diaphragmRadius,
      1,
      56,
    ),
    waterMaterial,
  ), 'water-volume-under-flexible-diaphragm');
  chamberWater.position.x = diaphragmCenterX;
  root.add(chamberWater);

  const centerClamp = addRole(new THREE.Group(),
    'moving-center-clamp-transmitting-link-motion-to-diaphragm');
  root.add(centerClamp);
  const upperClamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.10, 32),
    leverMaterial,
  );
  upperClamp.position.y = 0.05;
  centerClamp.add(upperClamp);
  const lowerClamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.12, 32),
    darkMaterial,
  );
  lowerClamp.position.y = -0.06;
  centerClamp.add(lowerClamp);

  const pivotStandard = addRole(new THREE.Group(),
    'fixed-left-standard-supporting-hand-lever-pivot');
  root.add(pivotStandard);
  const standardPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 1.36, 0.34),
    frameMaterial,
  );
  standardPost.position.set(leverPivot.x, 2.08, -0.48);
  pivotStandard.add(standardPost);
  const standardFoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.16, 0.76),
    frameMaterial,
  );
  standardFoot.position.set(leverPivot.x, 1.46, -0.48);
  pivotStandard.add(standardFoot);

  const lever = addRole(new THREE.Group(),
    'curved-hand-lever-rocking-about-fixed-left-pivot');
  lever.position.copy(leverPivot);
  root.add(lever);
  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.55, -0.58, 0),
    new THREE.Vector3(-1.75, -0.47, 0),
    new THREE.Vector3(-0.85, -0.16, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leverPinRadius, 0, 0),
  ], false, 'centripetal');
  const leverBody = new THREE.Mesh(
    new THREE.TubeGeometry(leverCurve, 84, 0.115, 18, false),
    leverMaterial,
  );
  lever.add(leverBody);
  const handGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.74, 26),
    darkMaterial,
  );
  handGrip.rotation.x = Math.PI / 2;
  handGrip.position.set(-2.58, -0.59, 0);
  lever.add(handGrip);
  const leverPinMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.58, 28),
    darkMaterial,
  );
  leverPinMesh.rotation.x = Math.PI / 2;
  leverPinMesh.position.x = leverPinRadius;
  lever.add(leverPinMesh);

  const pivotAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.70, 32),
    darkMaterial,
  ), 'fixed-hand-lever-fulcrum');
  pivotAxle.rotation.x = Math.PI / 2;
  pivotAxle.position.copy(leverPivot);
  root.add(pivotAxle);
  const pivotCollar = horizontalRing(0.22, 0.05, suctionMaterial);
  pivotCollar.position.copy(leverPivot);
  root.add(pivotCollar);

  const connectingRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 1, 24),
    darkMaterial,
  ), 'constant-length-link-from-lever-pin-to-diaphragm-center');
  root.add(connectingRod);

  const addPipePair = (points, role, waterRole, outerRadius = 0.25) => {
    const shell = makeTube(points, outerRadius, shellMaterial, role);
    const water = makeTube(
      points,
      outerRadius * 0.60,
      waterMaterial,
      waterRole,
    );
    root.add(shell, water);
    return { shell, water };
  };
  const suctionPipe = addPipePair([
    new THREE.Vector3(0, -2.05, 0.38),
    new THREE.Vector3(0, -1.15, 0.38),
    suctionValveSeat,
  ], 'single-suction-pipe-entering-below-diaphragm-chamber',
  'water-rising-through-suction-pipe-on-diaphragm-upstroke', 0.29);
  const deliveryBranch = addPipePair([
    new THREE.Vector3(1.15, 0.34, 0.38),
    new THREE.Vector3(1.52, 0.48, 0.38),
    new THREE.Vector3(1.77, 0.82, 0.38),
    deliveryValveSeat,
  ], 'delivery-branch-from-chamber-to-right-check',
  'water-forced-from-chamber-toward-delivery-check', 0.27);
  const deliveryRiser = addPipePair([
    deliveryValveSeat,
    new THREE.Vector3(2.02, 1.72, 0.38),
    new THREE.Vector3(2.02, 2.44, 0.38),
    new THREE.Vector3(2.02, 3.34, 0.38),
  ], 'single-upright-delivery-pipe-above-right-check',
  'water-expelled-up-delivery-pipe-on-diaphragm-downstroke', 0.31);
  const suctionMouth = horizontalRing(0.30, 0.055, darkMaterial);
  suctionMouth.position.set(0, -2.05, 0.38);
  root.add(suctionMouth);
  const deliveryMouth = horizontalRing(0.32, 0.055, darkMaterial);
  deliveryMouth.position.set(2.02, 3.34, 0.38);
  root.add(deliveryMouth);

  const makeCheckValve = (position, material, role) => {
    const body = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.43, 0.43, 0.54, 40, 1, true),
      shellMaterial,
    ), `${role}-transparent-body`);
    body.position.copy(position);
    root.add(body);
    const seat = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.075, 0.50),
      darkMaterial,
    ), `${role}-fixed-horizontal-seat`);
    seat.position.copy(position);
    seat.position.y -= 0.09;
    root.add(seat);
    const flap = addRole(new THREE.Group(), role);
    flap.position.copy(position);
    flap.position.x -= 0.25;
    root.add(flap);
    const disk = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.065, 0.46),
      material,
    );
    disk.position.x = 0.25;
    flap.add(disk);
    const hinge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.56, 22),
      darkMaterial,
    );
    hinge.rotation.x = Math.PI / 2;
    flap.add(hinge);
    flap.userData.body = body;
    flap.userData.disk = disk;
    flap.userData.seat = seat;
    return flap;
  };
  const suctionValve = makeCheckValve(
    suctionValveSeat,
    suctionMaterial,
    'lower-hinged-suction-check-opening-only-on-diaphragm-rise',
  );
  const deliveryValve = makeCheckValve(
    deliveryValveSeat,
    deliveryMaterial,
    'right-hinged-delivery-check-opening-only-on-diaphragm-descent',
  );

  const updateDiaphragm = (centerY) => {
    const positions = diaphragmGeometry.getAttribute('position');
    const { radialFractions } = diaphragmGeometry.userData;
    for (let index = 0; index < positions.count; index += 1) {
      const radialFraction = radialFractions[index];
      const profile = (1 - radialFraction ** 2) ** 2;
      positions.setY(
        index,
        diaphragmRimY + (centerY - diaphragmRimY) * profile,
      );
    }
    positions.needsUpdate = true;
    diaphragmGeometry.computeVertexNormals();
    diaphragmGeometry.computeBoundingBox();
    diaphragmGeometry.computeBoundingSphere();
    diaphragmSeams.forEach(({ radius, seam }) => {
      const radialFraction = radius / diaphragmRadius;
      const profile = (1 - radialFraction ** 2) ** 2;
      seam.position.y = diaphragmRimY
        + (centerY - diaphragmRimY) * profile;
    });
  };

  const update = (time) => {
    const state = stateAtTime(time);
    lever.rotation.z = state.leverAngle;
    centerClamp.position.set(
      diaphragmCenterX,
      state.diaphragmCenterY,
      0,
    );
    setCylinderBetween(
      connectingRod,
      state.connectingRodBottom,
      state.leverPin,
    );
    updateDiaphragm(state.diaphragmCenterY);
    setVerticalExtent(
      chamberWater,
      chamberBottomY + 0.08,
      state.averageWaterTopY,
    );
    suctionValve.rotation.z = state.suctionValveAngle;
    deliveryValve.rotation.z = state.deliveryValveAngle;
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    chamberArea,
    chamberBottomY,
    connectingRodLength,
    cycleDuration,
    deliveryValveSeat,
    diaphragmCenterX,
    diaphragmEffectiveArea,
    diaphragmRadius,
    diaphragmRimY,
    groundY,
    inputAngularSpeed,
    leverAmplitude,
    leverPinRadius,
    leverPivot,
    maximumValveAngle,
    suctionValveSeat,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'lever-driven-flexible-diaphragm-force-pump-with-two-hinged-checks-suction-upstroke-and-delivery-downstroke',
    blocks: {
      base,
      centerClamp,
      chamberBottom,
      chamberRails,
      chamberRim,
      chamberShell,
      chamberWater,
      connectingRod,
      deliveryBranch,
      deliveryRiser,
      deliveryValve,
      diaphragm,
      diaphragmSeams,
      lever,
      pivotAxle,
      pivotStandard,
      suctionPipe,
      suctionValve,
    },
    degreesOfFreedom: {
      deliveryCheckIndependent: false,
      diaphragmCenterIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      suctionCheckIndependent: false,
    },
    dynamics: {
      fullPressureWaveValveImpactLeakageDiaphragmElasticityCavitationAndAppliedLeverForceModeled:
        false,
      diaphragmVolumeModel:
        'The clamped membrane uses y(r)=y_rim+(y_center-y_rim)(1-(r/R)^2)^2. Integrating that axisymmetric profile gives the exact effective area pi*R^2/3 used for chamber volume and flow.',
      flowModel:
        'The chamber is treated as primed and incompressible. Center rise increases volume and admits through the lower suction check; center descent decreases volume and forces the same rate through the right delivery check. Pipe losses, leakage and trapped air are omitted.',
      valveModel:
        'The two source-like hinged flaps use disjoint C2 cubic stroke lobes and both lie on their seats at the high and low diaphragm reversals.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A curved hand lever rocks about the fixed left pivot. Its short arm drives a constant-length link whose lower end is constrained to the diaphragm centerline. The flexible circular diaphragm is clamped at its outer ring: lifting its center expands the water chamber and opens only the lower suction flap; lowering it contracts the chamber and opens only the right delivery flap, forcing water into the upright riser.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'hand-lever-and-constant-link-reciprocating-the-center-of-a-clamped-flexible-diaphragm',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 454 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      deliveryValveOpen: sourceState.deliveryValveOpen,
      diaphragmCenterY: sourceState.diaphragmCenterY,
      leverAngle: sourceState.leverAngle,
      mode: sourceState.mode,
      suctionValveOpen: sourceState.suctionValveOpen,
    },
    sourceReference: {
      brownPlate454: {
        approximateDeliveryCheckPixels: [411, 272],
        approximateDiaphragmCenterPixels: [252, 339],
        approximateDiaphragmRimPixels: [251, 268],
        approximateLeverPivotPixels: [144, 151],
        approximateLeverRodPinPixels: [251, 141],
        approximateSuctionCheckPixels: [252, 377],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 17,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the machine is a diaphragm forcing pump',
          'a flexible diaphragm replaces the bellows',
          'the valves are arranged as in Movement 453',
        ],
        engravingEvidence:
          'Brown’s section shows one flexible diaphragm clamped along a horizontal chamber rim and depressed at its linked center, a curved hand lever pivoted on the left, one vertical link from the lever’s right pin, a suction stem and flap below the chamber, and a separate delivery flap in the enlarged right-hand riser.',
        reconstructionDisclosure:
          'Brown gives no diaphragm diameter, elastic profile, lever dimensions, stroke, valve opening angle, chamber depth, pressure, leakage, applied force or timing. Those values, the smooth quartic membrane profile, transparent water proxy, colors and 5.1-second harmonic lever cycle are independently engineered. The one clamped diaphragm, center link, lower suction check, right delivery check and upright outlet are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 454',
      precedingMovement: 'https://507movements.com/mm_453.html',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      chamberBalance:
        'dV/dt=Q_suction-Q_delivery exactly, with dV/dt=(pi R^2/3)*v_center.',
      linkConstraint:
        'The lever pin stays on its fixed radius and the lower link point stays on the diaphragm centerline; the square-root closure keeps their separation equal to the constant rod length.',
      valveSequence:
        'sin(phi)>0 opens suction while the diaphragm rises; sin(phi)<0 opens delivery while it descends; sin(phi)=0 seats both checks.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.10, groundY, -1.58),
    new THREE.Vector3(3.05, 3.55, 1.58),
  );
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraDirection = new THREE.Vector3(6.4, 4.7, 10.6);
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

export function createAuthoredDiaphragmPumpMovement(movement) {
  if (movement.id !== 454) return null;
  return diaphragmForcePump(movement);
}
