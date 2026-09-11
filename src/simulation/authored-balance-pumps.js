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

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

function balancePumps(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6.2;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const beamAmplitude = THREE.MathUtils.degToRad(14);
  const beamPivot = new THREE.Vector3(0, 2.05, 0);
  const beamHalfLength = 2.85;
  const attachmentRadius = 1.00;
  const cylinderOffset = 0.68;
  const pitmanLength = 1.42;
  const pistonRodOffset = 1.15;
  const cylinderBottomY = -1.25;
  const cylinderTopY = -0.05;
  const cylinderHeight = cylinderTopY - cylinderBottomY;
  const cylinderInnerRadius = 0.255;
  const pistonRadius = 0.235;
  const reservoirSurfaceY = -0.98;
  const groundY = -1.52;
  const nominalPistonSpeed = attachmentRadius * beamAmplitude
    * inputAngularSpeed * 1.14;

  const pumpKinematics = (
    side,
    beamAngle,
    beamAngularVelocity,
    beamAngularAcceleration,
  ) => {
    const attachmentLocalX = side * attachmentRadius;
    const sliderX = side * cylinderOffset;
    const cosine = Math.cos(beamAngle);
    const sine = Math.sin(beamAngle);
    const beamPin = new THREE.Vector3(
      beamPivot.x + attachmentLocalX * cosine,
      beamPivot.y + attachmentLocalX * sine,
      0,
    );
    const horizontalOffset = sliderX - beamPin.x;
    const verticalDrop = Math.sqrt(Math.max(
      0,
      pitmanLength ** 2 - horizontalOffset ** 2,
    ));
    const crossheadY = beamPin.y - verticalDrop;
    const crosshead = new THREE.Vector3(sliderX, crossheadY, 0);
    const piston = new THREE.Vector3(
      sliderX,
      crossheadY - pistonRodOffset,
      0,
    );

    const horizontalOffsetDerivative = attachmentLocalX * sine;
    const horizontalOffsetSecondDerivative = attachmentLocalX * cosine;
    const product = horizontalOffset * horizontalOffsetDerivative;
    const productDerivative = horizontalOffsetDerivative ** 2
      + horizontalOffset * horizontalOffsetSecondDerivative;
    const crossheadDerivativeByBeamAngle = attachmentLocalX * cosine
      + product / verticalDrop;
    const crossheadSecondDerivativeByBeamAngle = -attachmentLocalX * sine
      + productDerivative / verticalDrop
      + product ** 2 / verticalDrop ** 3;
    const pistonVelocity = crossheadDerivativeByBeamAngle
      * beamAngularVelocity;
    const pistonAcceleration = crossheadSecondDerivativeByBeamAngle
      * beamAngularVelocity ** 2
      + crossheadDerivativeByBeamAngle * beamAngularAcceleration;
    const inletOpenAmount = smootherStep(
      Math.max(0, pistonVelocity) / nominalPistonSpeed,
    );
    const deliveryOpenAmount = smootherStep(
      Math.max(0, -pistonVelocity) / nominalPistonSpeed,
    );
    return {
      attachmentLocalX,
      beamPin,
      crosshead,
      crossheadDerivativeByBeamAngle,
      crossheadSecondDerivativeByBeamAngle,
      deliveryOpenAmount,
      horizontalOffset,
      inletOpenAmount,
      piston,
      pistonAcceleration,
      pistonVelocity,
      side: side < 0 ? 'left' : 'right',
      sliderX,
      verticalDrop,
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const cycleAngle = THREE.MathUtils.euclideanModulo(inputAngle, FULL_TURN);
    const beamAngle = beamAmplitude * Math.sin(cycleAngle);
    const beamAngularVelocity = beamAmplitude
      * Math.cos(cycleAngle) * inputSpeed;
    const beamAngularAcceleration = beamAmplitude * (
      -Math.sin(cycleAngle) * inputSpeed ** 2
      + Math.cos(cycleAngle) * inputAcceleration
    );
    const pumps = [-1, 1].map((side) => pumpKinematics(
      side,
      beamAngle,
      beamAngularVelocity,
      beamAngularAcceleration,
    ));
    const normalizedBeamSpeed = beamAngularVelocity
      / (beamAmplitude * Math.max(Math.abs(inputSpeed), 1e-12));
    const leftPressAmount = smootherStep(Math.max(0, normalizedBeamSpeed));
    const rightPressAmount = smootherStep(Math.max(0, -normalizedBeamSpeed));
    let activePressSide = 'neither-at-beam-reversal';
    if (leftPressAmount > 1e-12) activePressSide = 'left-end-pressed-down';
    else if (rightPressAmount > 1e-12) {
      activePressSide = 'right-end-pressed-down';
    }
    return {
      activePressSide,
      beamAngle,
      beamAngularAcceleration,
      beamAngularVelocity,
      cycleAngle,
      inputAcceleration,
      inputSpeed,
      leftPressAmount,
      phase: cycleAngle / FULL_TURN,
      pumps,
      rightPressAmount,
      totalDeliveryOpenAmount: pumps.reduce(
        (sum, pump) => sum + pump.deliveryOpenAmount,
        0,
      ),
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.17,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.50,
  });
  const beamMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.56,
  });
  const leftPumpMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.56,
  });
  const rightPumpMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.56,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.48,
  });
  const glassMaterial = matte(PALETTE.muted, {
    opacity: 0.24,
    roughness: 0.32,
    side: THREE.DoubleSide,
    transparent: true,
  });
  glassMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.40,
    roughness: 0.26,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;

  const foundation = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.0, 0.15, 3.20),
    frameMaterial,
  ), 'fixed-foundation-and-well-edge-under-balance-pumps');
  foundation.position.set(0, groundY + 0.075, 0);
  root.add(foundation);
  const reservoir = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(4.20, 0.52, 2.35),
    waterMaterial,
  ), 'common-water-source-reservoir-for-both-pump-inlets');
  reservoir.position.set(0, reservoirSurfaceY - 0.26, 0);
  root.add(reservoir);
  const reservoirRim = addRole(new THREE.Group(),
    'open-rim-around-common-pump-reservoir');
  root.add(reservoirRim);
  for (const z of [-1.26, 1.26]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(4.55, 0.11, 0.13),
      frameMaterial,
    );
    rail.position.set(0, reservoirSurfaceY, z);
    reservoirRim.add(rail);
  }
  for (const x of [-2.21, 2.21]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.11, 2.39),
      frameMaterial,
    );
    rail.position.set(x, reservoirSurfaceY, 0);
    reservoirRim.add(rail);
  }

  const support = addRole(new THREE.Group(),
    'fixed-platform-and-frame-supporting-central-beam-pivot');
  root.add(support);
  for (const x of [-1.80, 1.80]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 2.75, 0.22),
      frameMaterial,
    );
    post.position.set(x, 0.34, -0.58);
    support.add(post);
  }
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(4.25, 0.16, 1.65),
    frameMaterial,
  );
  platform.position.set(0, 1.58, -0.18);
  support.add(platform);
  const pivotStand = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.80, 0.32),
    frameMaterial,
  );
  pivotStand.position.set(0, 1.72, -0.42);
  support.add(pivotStand);

  const beam = addRole(new THREE.Group(),
    'single-human-worked-balance-beam-driving-both-pumps');
  beam.position.copy(beamPivot);
  root.add(beam);
  const beamBar = new THREE.Mesh(
    new THREE.BoxGeometry(beamHalfLength * 2, 0.14, 0.24),
    beamMaterial,
  );
  beam.add(beamBar);
  const endWeights = [-1, 1].map((side, index) => {
    const weight = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 28, 18),
      brassMaterial,
    ), index === 0
      ? 'left-functional-balance-weight'
      : 'right-functional-balance-weight');
    weight.position.x = side * beamHalfLength;
    beam.add(weight);
    return weight;
  });
  const treadMaterials = [beamMaterial.clone(), beamMaterial.clone()];
  const treadPads = [-1, 1].map((side, index) => {
    const tread = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.12, 0.62),
      treadMaterials[index],
    ), index === 0
      ? 'left-operator-pressure-pad'
      : 'right-operator-pressure-pad');
    tread.position.set(side * 1.92, 0.11, 0);
    beam.add(tread);
    return tread;
  });
  const attachmentPins = [-1, 1].map((side, index) => {
    const pin = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.42, 22),
      brassMaterial,
    ), index === 0
      ? 'left-beam-to-pitman-pin'
      : 'right-beam-to-pitman-pin');
    pin.rotation.x = Math.PI / 2;
    pin.position.x = side * attachmentRadius;
    beam.add(pin);
    return pin;
  });
  const beamAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.66, 26),
    darkMaterial,
  ), 'fixed-central-balance-beam-pivot-axle');
  beamAxle.rotation.x = Math.PI / 2;
  beamAxle.position.copy(beamPivot);
  root.add(beamAxle);

  const makeBranchCurve = (side) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * cylinderOffset, cylinderTopY - 0.03, 0),
    new THREE.Vector3(side * cylinderOffset, 0.20, 0),
    new THREE.Vector3(side * 0.34, 0.48, 0),
    new THREE.Vector3(0, 0.62, 0),
  ]);
  const pumpAssemblies = [-1, 1].map((side, index) => {
    const name = side < 0 ? 'left' : 'right';
    const pistonMaterial = index === 0
      ? leftPumpMaterial
      : rightPumpMaterial;
    const cylinder = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(
        cylinderInnerRadius + 0.045,
        cylinderInnerRadius + 0.045,
        cylinderHeight,
        36,
        1,
        true,
      ),
      glassMaterial,
    ), `${name}-transparent-single-acting-pump-cylinder`);
    cylinder.position.set(
      side * cylinderOffset,
      (cylinderBottomY + cylinderTopY) / 2,
      0,
    );
    root.add(cylinder);
    const piston = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(pistonRadius, pistonRadius, 0.09, 30),
      pistonMaterial,
    ), `${name}-pump-piston`);
    root.add(piston);
    const pistonRod = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 1, 18),
      darkMaterial,
    ), `${name}-vertical-piston-rod`);
    root.add(pistonRod);
    const crosshead = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.34),
      pistonMaterial,
    ), `${name}-vertical-slider-crosshead`);
    root.add(crosshead);
    const pitman = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 1, 18),
      darkMaterial,
    ), `${name}-fixed-length-beam-pitman`);
    root.add(pitman);
    const inletPipe = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.50, 22),
      frameMaterial,
    ), `${name}-reservoir-to-cylinder-inlet-pipe`);
    inletPipe.position.set(side * cylinderOffset, -1.27, 0);
    root.add(inletPipe);
    const inletWaterMaterial = waterMaterial.clone();
    const inletWater = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.066, 0.066, 0.46, 18),
      inletWaterMaterial,
    ), `${name}-active-suction-water-column`);
    inletWater.position.copy(inletPipe.position);
    root.add(inletWater);
    const deliveryCurve = makeBranchCurve(side);
    const deliveryPipe = addRole(new THREE.Mesh(
      new THREE.TubeGeometry(deliveryCurve, 36, 0.10, 12, false),
      frameMaterial,
    ), `${name}-cylinder-to-common-outlet-delivery-branch`);
    root.add(deliveryPipe);
    const deliveryWaterMaterial = waterMaterial.clone();
    const deliveryWater = addRole(new THREE.Mesh(
      new THREE.TubeGeometry(deliveryCurve, 36, 0.052, 10, false),
      deliveryWaterMaterial,
    ), `${name}-active-delivery-water-column`);
    root.add(deliveryWater);
    const inletValve = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.045, 24),
      brassMaterial,
    ), `${name}-functional-inlet-check-disk`);
    inletValve.position.set(side * cylinderOffset, cylinderBottomY + 0.12, 0);
    root.add(inletValve);
    const deliveryValve = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.045, 24),
      brassMaterial,
    ), `${name}-functional-delivery-check-disk`);
    deliveryValve.position.set(side * cylinderOffset, cylinderTopY + 0.09, 0);
    root.add(deliveryValve);
    return {
      crosshead,
      cylinder,
      deliveryPipe,
      deliveryValve,
      deliveryWater,
      deliveryWaterMaterial,
      index,
      inletPipe,
      inletValve,
      inletWater,
      inletWaterMaterial,
      piston,
      pistonRod,
      pitman,
      side,
    };
  });

  const commonOutlet = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.125, 0.72, 24),
    frameMaterial,
  ), 'common-delivery-outlet-fed-alternately-by-two-pumps');
  commonOutlet.position.set(0, 0.96, 0);
  root.add(commonOutlet);
  const commonOutletMaterial = waterMaterial.clone();
  const commonOutletWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.066, 0.066, 0.68, 18),
    commonOutletMaterial,
  ), 'pulsating-water-column-in-common-delivery-outlet');
  commonOutletWater.position.copy(commonOutlet.position);
  root.add(commonOutletWater);

  const update = (time) => {
    const state = stateAtTime(time);
    beam.rotation.z = state.beamAngle;
    const pressAmounts = [state.leftPressAmount, state.rightPressAmount];
    treadMaterials.forEach((material, index) => {
      material.color.setHex(
        pressAmounts[index] > 1e-5 ? PALETTE.accent : PALETTE.driver,
      );
    });
    state.pumps.forEach((pumpState, index) => {
      const assembly = pumpAssemblies[index];
      assembly.crosshead.position.copy(pumpState.crosshead);
      assembly.piston.position.copy(pumpState.piston);
      setRodBetween(
        assembly.pitman,
        pumpState.beamPin,
        pumpState.crosshead,
      );
      setRodBetween(
        assembly.pistonRod,
        pumpState.crosshead,
        pumpState.piston,
      );
      assembly.inletValve.position.y = cylinderBottomY + 0.12
        + 0.075 * pumpState.inletOpenAmount;
      assembly.deliveryValve.position.y = cylinderTopY + 0.09
        + 0.075 * pumpState.deliveryOpenAmount;
      assembly.inletWater.visible = pumpState.inletOpenAmount > 1e-4;
      assembly.deliveryWater.visible = pumpState.deliveryOpenAmount > 1e-4;
      assembly.inletWaterMaterial.opacity = 0.16
        + 0.48 * pumpState.inletOpenAmount;
      assembly.deliveryWaterMaterial.opacity = 0.16
        + 0.48 * pumpState.deliveryOpenAmount;
    });
    commonOutletWater.visible = state.totalDeliveryOpenAmount > 1e-4;
    commonOutletMaterial.opacity = 0.16 + 0.42 * Math.min(
      1,
      state.totalDeliveryOpenAmount,
    );
  };

  const sourceState = stateAtInputAngle(-Math.PI / 4);
  const geometry = {
    attachmentRadius,
    beamAmplitude,
    beamHalfLength,
    beamPivot,
    cylinderBottomY,
    cylinderHeight,
    cylinderInnerRadius,
    cylinderOffset,
    cylinderTopY,
    cycleDuration,
    groundY,
    inputAngularSpeed,
    nominalPistonSpeed,
    pistonRadius,
    pistonRodOffset,
    pitmanLength,
    reservoirSurfaceY,
  };
  root.userData = {
    archetype:
      'human-worked-balance-beam-driving-two-reciprocal-single-acting-pumps-with-alternating-check-valves',
    blocks: {
      attachmentPins,
      beam,
      beamAxle,
      beamBar,
      commonOutlet,
      commonOutletWater,
      endWeights,
      foundation,
      platform,
      pumpAssemblies,
      reservoir,
      reservoirRim,
      support,
      treadPads,
    },
    degreesOfFreedom: {
      beamIsSolePrescribedInput: true,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pumpSlidersIndependent: false,
    },
    dynamics: {
      humanMassForcePumpPressureWaterInertiaLeakageValveImpactAndPipeLossesModeled:
        false,
      operatorModel:
        'The highlighted pressure pads identify the end moving downward during each half-stroke. Brown supplies neither operator timing nor force, so a smooth harmonic rocking input is prescribed.',
      valveModel:
        'Each ideal inlet check opens only while its piston rises and each delivery check opens only while that piston falls. Quintic opening profiles make both checks seat with zero opening velocity and acceleration at every reversal.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A person presses alternate ends of one centrally pivoted balance beam. Two symmetric pins on that beam pull fixed-length pitmans connected to vertical crossheads, so one single-acting piston rises while the other falls. The rising pump draws from the common reservoir through its inlet check; the falling pump closes its inlet and discharges through its delivery check into the shared central outlet.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'harmonic-human-worked-beam-with-exact-pitman-slider-closure-and-velocity-derived-check-valves',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      activePressSide: sourceState.activePressSide,
      beamAngle: sourceState.beamAngle,
      crossheadPositions: sourceState.pumps.map(
        ({ crosshead }) => crosshead.clone(),
      ),
      pistonPositions: sourceState.pumps.map(
        ({ piston }) => piston.clone(),
      ),
    },
    sourceReference: {
      brownPlate465: {
        approximateBalanceBeamEndpointsPixels: [[72, 165], [433, 306]],
        approximateCylinderCentersPixels: [[230, 382], [292, 382]],
        approximatePlatformBoundsPixels: [133, 232, 260, 25],
        approximateRockingPivotPixels: [300, 249],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 16,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is a pair of balance pumps',
          'the pair works reciprocally',
          'a person presses alternately on opposite ends',
          'both ends belong to one lever or beam',
        ],
        engravingEvidence:
          'Brown shows a long centrally rocking ball-ended beam above two side-by-side pump barrels, two descending rod connections, a common reservoir or well, and two delivery branches meeting at a central outlet.',
        reconstructionDisclosure:
          'Brown gives no beam length, pivot dimensions, attachment radii, pitman lengths, piston stroke, cylinder bore, valve construction, flow direction detail, force or timing. Exact slider-pitman dimensions, a 14-degree harmonic beam stroke, ideal check-valve phases, colors and a 6.2-second cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 465',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      pitmanClosure:
        'For each side, the crosshead lies on its fixed vertical slider and at exactly one pitman length below its rotating beam pin.',
      reciprocity:
        'The signed symmetric beam pins make the two piston velocities opposite in sign throughout every non-reversal half-stroke.',
      valves:
        'piston rising: inlet open and delivery seated; piston falling: inlet seated and delivery open; reversal: both seated',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.62, groundY - 0.02, -1.68),
    new THREE.Vector3(3.62, 3.16, 1.68),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(4.7, 2.8, 12.4);
  root.userData.groundFloorY = groundY;
  markShadows(root);
  foundation.receiveShadow = true;
  reservoir.castShadow = false;
  pumpAssemblies.forEach(({ deliveryWater, inletWater }) => {
    deliveryWater.castShadow = false;
    inletWater.castShadow = false;
  });
  commonOutletWater.castShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredBalancePumpMovement(movement) {
  if (movement.id !== 465) return null;
  return balancePumps(movement);
}
