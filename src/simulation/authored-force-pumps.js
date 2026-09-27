import * as THREE from 'three';
import {correctForcePumpParts} from './force-pump-working-parts.js';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function horizontalRing(radius, tubeRadius, material) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 48),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function addRole(object, role) {
  object.userData.role = role;
  return object;
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

function ordinaryForcePump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.2;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const leverPivot = new THREE.Vector3(-1.02, 3.22, 0);
  const leverAmplitude = THREE.MathUtils.degToRad(14);
  const leverRodPinRadius = 1.02;
  const handleLength = 3.65;
  const sliderLinkLength = 0.48;
  const pistonRodJointOffset = 2.04;
  const pistonThickness = 0.24;
  const pistonRadius = 0.68;
  const barrelWaterRadius = 0.68;
  const barrelArea = Math.PI * barrelWaterRadius ** 2;
  const suctionValveSeatY = -1.17;
  const deliveryValveSeatY = .08;
  const maximumValveLift = 0.17;
  const groundY = -2.54;

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
    const leverAngle = leverAmplitude * sine;
    const leverAngularSpeed = leverAmplitude * cosine * inputSpeed;
    const leverAngularAcceleration = leverAmplitude * (
      -sine * inputSpeed ** 2 + cosine * inputAcceleration
    );
    const leverPin = new THREE.Vector3(
      leverPivot.x + leverRodPinRadius * Math.cos(leverAngle),
      leverPivot.y + leverRodPinRadius * Math.sin(leverAngle),
      0,
    );
    const leverPinVelocity = new THREE.Vector3(
      -leverRodPinRadius * Math.sin(leverAngle) * leverAngularSpeed,
      leverRodPinRadius * Math.cos(leverAngle) * leverAngularSpeed,
      0,
    );
    const leverPinAcceleration = new THREE.Vector3(
      -leverRodPinRadius * (
        Math.cos(leverAngle) * leverAngularSpeed ** 2
          + Math.sin(leverAngle) * leverAngularAcceleration
      ),
      leverRodPinRadius * (
        -Math.sin(leverAngle) * leverAngularSpeed ** 2
          + Math.cos(leverAngle) * leverAngularAcceleration
      ),
      0,
    );
    const verticalProjection = Math.sqrt(
      sliderLinkLength ** 2 - leverPin.x ** 2,
    );
    const pistonRodJoint = new THREE.Vector3(
      0,
      leverPin.y - verticalProjection,
      0,
    );
    const pistonRodJointVelocity = leverPinVelocity.y
      + leverPin.x * leverPinVelocity.x / verticalProjection;
    const pistonRodJointAcceleration = leverPinAcceleration.y
      + (
        leverPinVelocity.x ** 2
          + leverPin.x * leverPinAcceleration.x
      ) / verticalProjection
      + (leverPin.x * leverPinVelocity.x) ** 2
        / verticalProjection ** 3;
    const pistonY = pistonRodJoint.y - pistonRodJointOffset;
    const pistonVelocity = pistonRodJointVelocity;
    const pistonAcceleration = pistonRodJointAcceleration;
    const pistonBottomY = pistonY - pistonThickness / 2;
    const pistonTopY = pistonY + pistonThickness / 2;
    const suctionValveOpen = positiveC2Lobe(cosine);
    const deliveryValveOpen = positiveC2Lobe(-cosine);
    const intakeFlowRate = barrelArea * Math.max(0, pistonVelocity);
    const deliveryFlowRate = barrelArea
      * Math.max(0, -pistonVelocity);
    const cylinderWaterVolume = barrelArea
      * (pistonBottomY - suctionValveSeatY);
    const cylinderWaterVolumeRate = barrelArea * pistonVelocity;
    let mode;
    if (Math.abs(cosine) < 1e-12) {
      mode = sine > 0
        ? 'top-dead-center-both-force-pump-checks-seated'
        : 'bottom-dead-center-both-force-pump-checks-seated';
    } else if (cosine > 0) {
      mode = 'upstroke-suction-check-open-delivery-check-shut-cylinder-filling';
    } else {
      mode = 'downstroke-suction-check-shut-delivery-check-open-forcing-water-up-riser';
    }
    return {
      barrelArea,
      cylinderWaterVolume,
      cylinderWaterVolumeRate,
      deliveryFlowRate,
      deliveryValveLift: maximumValveLift * deliveryValveOpen,
      deliveryValveOpen,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      intakeFlowRate,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      leverPin,
      leverPinAcceleration,
      leverPinVelocity,
      mode,
      phase,
      pistonAcceleration,
      pistonBottomY,
      pistonRodJoint,
      pistonRodJointAcceleration,
      pistonRodJointVelocity,
      pistonTopY,
      pistonVelocity,
      pistonY,
      suctionValveLift: maximumValveLift * suctionValveOpen,
      suctionValveOpen,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.50,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const valveMaterial = matte(PALETTE.accent, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.27,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.72,
    roughness: 0.32,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.1, 0.16, 3.2),
    frameMaterial,
  ), 'fixed-force-pump-foundation');
  base.position.set(-0.15, groundY + 0.08, 0);
  root.add(base);

  const sourceWell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.02, 0.58, 52),
    shellMaterial,
  ), 'source-water-below-cylinder');
  sourceWell.position.set(0, -2.19, 0);
  root.add(sourceWell);
  const sourceWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.93, 0.93, 0.20, 48),
    waterMaterial,
  ), 'source-water-reservoir');
  sourceWater.position.y = -2.10;
  root.add(sourceWater);
  const wellRim = horizontalRing(1.02, 0.075, darkMaterial);
  wellRim.position.y = -1.90;
  root.add(wellRim);

  const suctionPipe = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.50, 0.38, 1.12, 48, 1, true),
    shellMaterial,
  ), 'fixed-suction-pipe');
  suctionPipe.position.y = -1.82;
  root.add(suctionPipe);
  const suctionWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.31, 1.10, 48),
    waterMaterial,
  ), 'water-rising-through-suction-pipe-on-upstroke');
  suctionWater.position.y = -1.82;
  root.add(suctionWater);

  const barrel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.79, 0.79, 3.52, 64, 1, true),
    shellMaterial,
  ), 'fixed-force-pump-cylinder-above-water');
  barrel.position.y = 0.49;
  root.add(barrel);
  for (const y of [-1.27, 2.25]) {
    const rim = horizontalRing(0.79, 0.07, darkMaterial);
    rim.position.y = y;
    root.add(rim);
  }
  const barrelRails = addRole(new THREE.Group(),
    'fixed-cutaway-force-pump-cylinder-outline');
  for (const x of [-0.57, 0.57]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 3.42, 0.10),
      frameMaterial,
    );
    rail.position.set(x, 0.49, -0.61);
    barrelRails.add(rail);
  }
  root.add(barrelRails);

  const suctionValveSeat = addRole(horizontalRing(
    0.46,
    0.07,
    darkMaterial,
  ), 'fixed-suction-check-seat');
  suctionValveSeat.position.y = suctionValveSeatY;
  root.add(suctionValveSeat);
  const suctionValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.09, 40),
    valveMaterial,
  ), 'suction-check-opening-only-on-piston-upstroke');
  root.add(suctionValveDisk);

  const piston = addRole(new THREE.Group(),
    'solid-force-pump-piston-with-no-through-valve');
  root.add(piston);
  const pistonBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pistonRadius,
      pistonRadius,
      pistonThickness,
      48,
    ),
    pistonMaterial,
  );
  piston.add(pistonBody);
  const pistonTop = horizontalRing(pistonRadius, 0.055, darkMaterial);
  pistonTop.position.y = pistonThickness / 2;
  piston.add(pistonTop);

  const cylinderWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      barrelWaterRadius,
      barrelWaterRadius,
      1,
      48,
    ),
    waterMaterial,
  ), 'single-water-chamber-below-solid-piston');
  root.add(cylinderWater);

  const lever = addRole(new THREE.Group(),
    'hand-lever-rocking-about-fixed-left-pivot');
  lever.position.copy(leverPivot);
  root.add(lever);
  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leverRodPinRadius, 0, 0),
    new THREE.Vector3(2.12, -0.12, 0),
    new THREE.Vector3(3.00, -0.50, 0),
    new THREE.Vector3(handleLength, -1.06, 0),
  ], false, 'centripetal');
  const leverArm = new THREE.Mesh(
    new THREE.TubeGeometry(leverCurve, 88, 0.12, 14, false),
    frameMaterial,
  );
  lever.add(leverArm);
  const pivotPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.42, 28),
    darkMaterial,
  );
  pivotPin.rotation.x = Math.PI / 2;
  lever.add(pivotPin);
  const rodPin = pivotPin.clone();
  rodPin.scale.setScalar(0.76);
  rodPin.position.x = leverRodPinRadius;
  lever.add(rodPin);
  const handleKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 28, 18),
    darkMaterial,
  );
  handleKnob.position.set(handleLength, -1.06, 0);
  lever.add(handleKnob);

  const pivotSupport = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 1, 20),
    darkMaterial,
  ), 'fixed-short-support-locating-lever-pivot');
  setCylinderBetween(
    pivotSupport,
    new THREE.Vector3(-0.72, 2.25, 0),
    leverPivot,
  );
  root.add(pivotSupport);

  const sliderLink = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 1, 20),
    darkMaterial,
  ), 'short-rigid-link-from-lever-to-centerline-pump-rod');
  root.add(sliderLink);
  const pumpRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 1, 20),
    darkMaterial,
  ), 'vertical-rod-driving-solid-piston');
  root.add(pumpRod);

  const deliveryCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.54, -0.72, 0),
    new THREE.Vector3(-1.20, -0.69, 0),
    new THREE.Vector3(-1.56, -0.34, 0),
    new THREE.Vector3(-1.62, 0.52, 0),
    new THREE.Vector3(-1.62, 2.10, 0),
    new THREE.Vector3(-1.62, 3.45, 0),
  ], false, 'centripetal');
  const deliveryPipe = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(deliveryCurve, 112, 0.29, 20, false),
    shellMaterial,
  ), 'fixed-delivery-pipe-to-any-distance-or-elevation');
  root.add(deliveryPipe);
  const deliveryWater = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(deliveryCurve, 112, 0.19, 16, false),
    waterMaterial,
  ), 'water-retained-in-elevated-delivery-pipe');
  root.add(deliveryWater);
  const deliveryValveBody = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.53, 40, 24),
    shellMaterial,
  ), 'fixed-outlet-check-valve-chamber');
  deliveryValveBody.position.set(-1.48, deliveryValveSeatY, 0);
  deliveryValveBody.scale.set(1.08, 0.78, 0.94);
  root.add(deliveryValveBody);
  const deliveryValveSeat = addRole(horizontalRing(
    0.34,
    0.06,
    darkMaterial,
  ), 'fixed-outlet-check-seat');
  deliveryValveSeat.position.set(-1.48, deliveryValveSeatY, 0);
  root.add(deliveryValveSeat);
  const deliveryValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.09, 36),
    valveMaterial,
  ), 'outlet-check-opening-only-on-piston-downstroke');
  deliveryValveDisk.position.x = -1.48;
  root.add(deliveryValveDisk);

  const deliveryMarkers = Array.from({ length: 7 }, (_, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 16, 10),
      whiteMaterial,
    ), 'forced-delivery-flow-tracer');
    marker.userData.index = index;
    root.add(marker);
    return marker;
  });

  const sliderLinkEndpoints = () => {
    sliderLink.updateMatrixWorld(true);
    return {
      lever: new THREE.Vector3(0, 0.5, 0)
        .applyMatrix4(sliderLink.matrixWorld),
      slider: new THREE.Vector3(0, -0.5, 0)
        .applyMatrix4(sliderLink.matrixWorld),
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    piston.position.y = state.pistonY;
    lever.rotation.z = state.leverAngle;
    setCylinderBetween(
      sliderLink,
      state.pistonRodJoint,
      state.leverPin,
    );
    setCylinderBetween(
      pumpRod,
      new THREE.Vector3(0, state.pistonTopY, 0),
      state.pistonRodJoint,
    );
    suctionValveDisk.position.y = suctionValveSeatY + 0.08
      + state.suctionValveLift;
    deliveryValveDisk.position.y = deliveryValveSeatY + 0.08
      + state.deliveryValveLift;
    setVerticalExtent(
      cylinderWater,
      suctionValveSeatY + 0.11,
      state.pistonBottomY - 0.04,
    );
    const flowing = state.deliveryFlowRate > 0.002;
    deliveryMarkers.forEach((marker, index) => {
      const travel = THREE.MathUtils.euclideanModulo(
        index / deliveryMarkers.length + state.phase * 2,
        1,
      );
      marker.position.copy(deliveryCurve.getPoint(travel));
      marker.position.z = 0.21;
      marker.visible = flowing;
    });
    root.userData.updateSolids?.(state);
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    barrelArea,
    barrelWaterRadius,
    cycleDuration,
    deliveryValveSeatY,
    groundY,
    handleLength,
    inputAngularSpeed,
    leverAmplitude,
    leverPivot: leverPivot.clone(),
    leverRodPinRadius,
    maximumValveLift,
    pistonRadius,
    pistonRodJointOffset,
    pistonThickness,
    sliderLinkLength,
    suctionValveSeatY,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'ordinary-two-check-force-pump-with-solid-piston-upstroke-suction-and-downstroke-elevated-delivery',
    blocks: {
      barrel,
      barrelRails,
      base,
      cylinderWater,
      deliveryMarkers,
      deliveryPipe,
      deliveryValveBody,
      deliveryValveDisk,
      deliveryValveSeat,
      deliveryWater,
      handleKnob,
      lever,
      piston,
      pistonBody,
      pivotSupport,
      pumpRod,
      sliderLink,
      sourceWater,
      sourceWell,
      suctionPipe,
      suctionValveDisk,
      suctionValveSeat,
      suctionWater,
    },
    degreesOfFreedom: {
      deliveryValveIndependent: false,
      independentPrescribedInputs: 1,
      leverIndependent: false,
      operatingDegreesOfFreedom: 1,
      suctionValveIndependent: false,
    },
    dynamics: {
      fullPressureWaterColumnInertiaValveImpactLeakageAndAppliedLeverForceModeled:
        false,
      checkValveModel:
        'The suction and delivery lifts are disjoint positive/negative cubic velocity lobes. Both seat with C2 continuity at dead center and can never be open together.',
      flowModel:
        'A primed incompressible cylinder is modeled. Its exact swept-volume derivative equals suction inflow minus forced delivery; the elevated delivery column is retained while its check is shut.',
      unlimitedDeliveryStatement:
        'Brown’s “any distance or elevation” describes positive displacement rather than unlimited real pressure; required handle force, structural capacity and hydraulic losses are not solved.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A hand lever drives a solid piston through a short rigid slider link and vertical rod. As the piston rises, the suction check opens and the outlet check shuts, drawing water from the lower source into the single cylinder chamber. As the piston descends, suction shuts and the outlet check opens, forcing the displaced water around the side branch and upward through the retained delivery column. Unlike the two preceding lift pumps, no water passes through the piston.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'lever-driven-solid-piston-with-alternating-upstroke-suction-and-downstroke-force-delivery',
    },
    sliderLinkEndpoints,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 450 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      deliveryValveOpen: sourceState.deliveryValveOpen,
      leverAngle: sourceState.leverAngle,
      mode: sourceState.mode,
      pistonY: sourceState.pistonY,
      suctionValveOpen: sourceState.suctionValveOpen,
    },
    sourceReference: {
      brownPlate450: {
        approximateDeliveryValveCenterPixels: [112, 354],
        approximateHandlePivotPixels: [169, 121],
        approximatePistonCenterPixels: [237, 311],
        approximateSuctionValveCenterPixels: [233, 454],
        approximateVerticalRiserCenterPixels: [111, 185],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is an ordinary force pump with two valves',
          'the cylinder is above the source water',
          'the piston is solid',
          'one valve closes the outlet pipe and one closes the suction pipe',
          'piston rise opens suction and closes outlet so water fills the cylinder',
          'piston descent closes suction and forces water through the outlet valve',
          'water may be delivered to any distance or elevation',
        ],
        engravingEvidence:
          'Brown’s section shows a lower suction tube and check below the vertical cylinder, a solid piston and rod, a rocking right-hand lever with a short left support, and a low side passage curving into a separate outlet-check chamber and tall left riser.',
        reconstructionDisclosure:
          'Brown gives no bore, stroke, lever dimensions, linkage closure, check lift, source level, delivery height, pressure, flow loss, leakage, or timing. Those values, the exact rigid slider link, C2 valve lobes, primed incompressible volume model, transparent cutaway, colors, tracers, and 5.2-second cycle are independently engineered. The above-water cylinder, solid piston, two checks, upstroke suction, downstroke forced delivery, and elevated riser are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 450',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      checkValveInterlock:
        'suctionOpen=max(cos(phi),0)^3 and deliveryOpen=max(-cos(phi),0)^3, so their product is identically zero.',
      rigidLink:
        'The short lever-pin-to-centerline-slider distance is exact; the vertical rod offset to the solid piston is constant.',
      volumeBalance:
        'dV_cylinder/dt=Q_suction-Q_delivery exactly, where Q_suction=A*max(v_piston,0) and Q_delivery=A*max(-v_piston,0).',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.05, groundY, -1.65),
    new THREE.Vector3(3.72, 3.85, 1.65),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(6.2, 4.6, 10.7);
  root.userData.groundFloorY = groundY;
  correctForcePumpParts(root,movement.id);
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

function airChamberForcePump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.2;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const pumpX = 1.48;
  const leverPivot = new THREE.Vector3(pumpX - 1.02, 3.20, 0);
  const leverAmplitude = THREE.MathUtils.degToRad(14);
  const leverRodPinRadius = 1.02;
  const handleLength = 3.58;
  const sliderLinkLength = 0.48;
  const pistonRodJointOffset = 2.04;
  const pistonThickness = 0.24;
  const pistonRadius = 0.68;
  const barrelWaterRadius = 0.68;
  const barrelArea = Math.PI * barrelWaterRadius ** 2;
  const suctionValveSeatY = -1.17;
  const deliveryValveSeatY = .60;
  const maximumValveLift = 0.17;
  const chamberCenter = new THREE.Vector3(-1.02, 1.16, 0);
  const chamberTotalInternalVolume = 1.80;
  const chamberSourceWaterVolume = 0.85;
  const chamberSourceAirVolume = chamberTotalInternalVolume
    - chamberSourceWaterVolume;
  const chamberSourceAirPressure = 1.12;
  const groundY = -2.54;

  const sliderStateAtCycleAngle = (
    cycleAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const sine = Math.sin(cycleAngle);
    const cosine = Math.cos(cycleAngle);
    const leverAngle = leverAmplitude * sine;
    const leverAngularSpeed = leverAmplitude * cosine * inputSpeed;
    const leverAngularAcceleration = leverAmplitude * (
      -sine * inputSpeed ** 2 + cosine * inputAcceleration
    );
    const leverPin = new THREE.Vector3(
      leverPivot.x + leverRodPinRadius * Math.cos(leverAngle),
      leverPivot.y + leverRodPinRadius * Math.sin(leverAngle),
      0,
    );
    const leverPinVelocity = new THREE.Vector3(
      -leverRodPinRadius * Math.sin(leverAngle) * leverAngularSpeed,
      leverRodPinRadius * Math.cos(leverAngle) * leverAngularSpeed,
      0,
    );
    const leverPinAcceleration = new THREE.Vector3(
      -leverRodPinRadius * (
        Math.cos(leverAngle) * leverAngularSpeed ** 2
          + Math.sin(leverAngle) * leverAngularAcceleration
      ),
      leverRodPinRadius * (
        -Math.sin(leverAngle) * leverAngularSpeed ** 2
          + Math.cos(leverAngle) * leverAngularAcceleration
      ),
      0,
    );
    const horizontalOffset = leverPin.x - pumpX;
    const horizontalVelocity = leverPinVelocity.x;
    const horizontalAcceleration = leverPinAcceleration.x;
    const verticalProjection = Math.sqrt(
      sliderLinkLength ** 2 - horizontalOffset ** 2,
    );
    const pistonRodJoint = new THREE.Vector3(
      pumpX,
      leverPin.y - verticalProjection,
      0,
    );
    const pistonVelocity = leverPinVelocity.y
      + horizontalOffset * horizontalVelocity / verticalProjection;
    const pistonAcceleration = leverPinAcceleration.y
      + (horizontalVelocity ** 2
        + horizontalOffset * horizontalAcceleration)
        / verticalProjection
      + (horizontalOffset * horizontalVelocity) ** 2
        / verticalProjection ** 3;
    return {
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      leverPin,
      leverPinAcceleration,
      leverPinVelocity,
      pistonAcceleration,
      pistonRodJoint,
      pistonVelocity,
      pistonY: pistonRodJoint.y - pistonRodJointOffset,
    };
  };

  const pistonTopDeadY = sliderStateAtCycleAngle(Math.PI / 2).pistonY;
  const pistonBottomDeadY = sliderStateAtCycleAngle(3 * Math.PI / 2)
    .pistonY;
  const pistonStroke = pistonTopDeadY - pistonBottomDeadY;
  const deliveredVolumePerCycle = barrelArea * pistonStroke;
  const nominalOutputFlowRate = deliveredVolumePerCycle / cycleDuration;

  const cumulativePumpDeliveryAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.clamp(phaseValue, 0, 1);
    if (phase <= 0.25) return 0;
    if (phase >= 0.75) return deliveredVolumePerCycle;
    const pistonY = sliderStateAtCycleAngle(FULL_TURN * phase).pistonY;
    return barrelArea * (pistonTopDeadY - pistonY);
  };

  const chamberWaterVolumeAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.clamp(phaseValue, 0, 1);
    return chamberSourceWaterVolume
      + cumulativePumpDeliveryAtPhase(phase)
      - deliveredVolumePerCycle * phase;
  };

  const nominalChamberRateAtPhase = (phase) => {
    const slider = sliderStateAtCycleAngle(FULL_TURN * phase);
    return barrelArea * Math.max(0, -slider.pistonVelocity)
      - nominalOutputFlowRate;
  };
  const findRateZero = (startPhase, endPhase) => {
    let low = startPhase;
    let high = endPhase;
    let lowRate = nominalChamberRateAtPhase(low);
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const middle = (low + high) / 2;
      const middleRate = nominalChamberRateAtPhase(middle);
      if (Math.sign(middleRate) === Math.sign(lowRate)) {
        low = middle;
        lowRate = middleRate;
      } else {
        high = middle;
      }
    }
    return (low + high) / 2;
  };
  const chamberWaterMinimumPhase = findRateZero(0.25, 0.50);
  const chamberWaterMaximumPhase = findRateZero(0.50, 0.75);
  const chamberWaterMinimum = chamberWaterVolumeAtPhase(
    chamberWaterMinimumPhase,
  );
  const chamberWaterMaximum = chamberWaterVolumeAtPhase(
    chamberWaterMaximumPhase,
  );

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
    const slider = sliderStateAtCycleAngle(
      cycleAngle,
      inputSpeed,
      inputAcceleration,
    );
    const pistonBottomY = slider.pistonY - pistonThickness / 2;
    const pistonTopY = slider.pistonY + pistonThickness / 2;
    const suctionValveOpen = positiveC2Lobe(cosine);
    const deliveryValveOpen = positiveC2Lobe(-cosine);
    const intakeFlowRate = barrelArea
      * Math.max(0, slider.pistonVelocity);
    const pumpDeliveryFlowRate = barrelArea
      * Math.max(0, -slider.pistonVelocity);
    const outputFlowRate = deliveredVolumePerCycle
      * inputSpeed / FULL_TURN;
    const cylinderWaterVolume = barrelArea
      * (pistonBottomY - suctionValveSeatY);
    const cylinderWaterVolumeRate = barrelArea
      * slider.pistonVelocity;
    const chamberWaterVolume = chamberWaterVolumeAtPhase(phase);
    const chamberWaterVolumeRate = pumpDeliveryFlowRate - outputFlowRate;
    const chamberAirVolume = chamberTotalInternalVolume
      - chamberWaterVolume;
    const chamberAirPressure = chamberSourceAirPressure
      * chamberSourceAirVolume / chamberAirVolume;
    let mode;
    if (Math.abs(cosine) < 1e-12) {
      mode = sine > 0
        ? 'top-dead-center-pump-checks-seated-air-chamber-supplying-outlet'
        : 'bottom-dead-center-pump-checks-seated-air-chamber-supplying-outlet';
    } else if (cosine > 0) {
      mode = 'upstroke-suction-open-air-expanding-to-maintain-constant-outlet';
    } else {
      mode = 'downstroke-delivery-open-water-compressing-air-and-feeding-outlet';
    }
    return {
      barrelArea,
      chamberAirPressure,
      chamberAirVolume,
      chamberWaterVolume,
      chamberWaterVolumeRate,
      cylinderWaterVolume,
      cylinderWaterVolumeRate,
      deliveryValveLift: maximumValveLift * deliveryValveOpen,
      deliveryValveOpen,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      intakeFlowRate,
      ...slider,
      mode,
      outputFlowRate,
      phase,
      pistonBottomY,
      pistonTopY,
      pumpDeliveryFlowRate,
      selectedOutletFlowRate: outputFlowRate,
      suctionValveLift: maximumValveLift * suctionValveOpen,
      suctionValveOpen,
      unselectedOutletFlowRate: 0,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.50,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const valveMaterial = matte(PALETTE.accent, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.27,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.72,
    roughness: 0.32,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const airMaterial = matte(PALETTE.white, {
    opacity: 0.30,
    roughness: 0.24,
    transparent: true,
  });
  airMaterial.depthWrite = false;
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.0, 0.16, 3.3),
    frameMaterial,
  ), 'fixed-air-chamber-force-pump-foundation');
  base.position.set(0.20, groundY + 0.08, 0);
  root.add(base);

  const sourceWell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.98, 0.98, 0.56, 52),
    shellMaterial,
  ), 'source-water-below-air-chamber-force-pump');
  sourceWell.position.set(pumpX, -2.19, 0);
  root.add(sourceWell);
  const sourceWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.89, 0.89, 0.20, 48),
    waterMaterial,
  ), 'source-water-reservoir');
  sourceWater.position.set(pumpX, -2.10, 0);
  root.add(sourceWater);
  const wellRim = horizontalRing(0.98, 0.075, darkMaterial);
  wellRim.position.set(pumpX, -1.91, 0);
  root.add(wellRim);

  const suctionPipe = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.37, 1.10, 48, 1, true),
    shellMaterial,
  ), 'fixed-suction-pipe');
  suctionPipe.position.set(pumpX, -1.82, 0);
  root.add(suctionPipe);
  const suctionWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.30, 1.08, 48),
    waterMaterial,
  ), 'water-rising-through-suction-pipe');
  suctionWater.position.set(pumpX, -1.82, 0);
  root.add(suctionWater);

  const barrel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 3.48, 64, 1, true),
    shellMaterial,
  ), 'fixed-solid-piston-force-pump-cylinder');
  barrel.position.set(pumpX, 0.47, 0);
  root.add(barrel);
  for (const y of [-1.27, 2.21]) {
    const rim = horizontalRing(0.78, 0.07, darkMaterial);
    rim.position.set(pumpX, y, 0);
    root.add(rim);
  }
  const barrelRails = addRole(new THREE.Group(),
    'fixed-cutaway-air-chamber-pump-outline');
  for (const xOffset of [-0.56, 0.56]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 3.38, 0.10),
      frameMaterial,
    );
    rail.position.set(pumpX + xOffset, 0.47, -0.60);
    barrelRails.add(rail);
  }
  root.add(barrelRails);

  const suctionValveSeat = addRole(horizontalRing(
    0.45,
    0.07,
    darkMaterial,
  ), 'fixed-suction-check-seat');
  suctionValveSeat.position.set(pumpX, suctionValveSeatY, 0);
  root.add(suctionValveSeat);
  const suctionValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.09, 40),
    valveMaterial,
  ), 'suction-check-opening-on-upstroke');
  suctionValveDisk.position.x = pumpX;
  root.add(suctionValveDisk);

  const piston = addRole(new THREE.Group(),
    'solid-piston-feeding-air-chamber-on-downstroke');
  root.add(piston);
  const pistonBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pistonRadius,
      pistonRadius,
      pistonThickness,
      48,
    ),
    pistonMaterial,
  );
  piston.add(pistonBody);
  const pistonRim = horizontalRing(pistonRadius, 0.055, darkMaterial);
  pistonRim.position.y = pistonThickness / 2;
  piston.add(pistonRim);

  const cylinderWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      barrelWaterRadius,
      barrelWaterRadius,
      1,
      48,
    ),
    waterMaterial,
  ), 'pump-water-below-solid-piston');
  cylinderWater.position.x = pumpX;
  root.add(cylinderWater);

  const lever = addRole(new THREE.Group(),
    'hand-lever-rocking-about-fixed-pivot');
  lever.position.copy(leverPivot);
  root.add(lever);
  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leverRodPinRadius, 0, 0),
    new THREE.Vector3(2.06, -0.12, 0),
    new THREE.Vector3(2.92, -0.49, 0),
    new THREE.Vector3(handleLength, -1.04, 0),
  ], false, 'centripetal');
  const leverArm = new THREE.Mesh(
    new THREE.TubeGeometry(leverCurve, 88, 0.12, 14, false),
    frameMaterial,
  );
  lever.add(leverArm);
  const pivotPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.42, 28),
    darkMaterial,
  );
  pivotPin.rotation.x = Math.PI / 2;
  lever.add(pivotPin);
  const rodPin = pivotPin.clone();
  rodPin.scale.setScalar(0.76);
  rodPin.position.x = leverRodPinRadius;
  lever.add(rodPin);
  const handleKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 28, 18),
    darkMaterial,
  );
  handleKnob.position.set(handleLength, -1.04, 0);
  lever.add(handleKnob);

  const pivotSupport = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 1, 20),
    darkMaterial,
  ), 'fixed-short-support-locating-lever-pivot');
  setCylinderBetween(
    pivotSupport,
    new THREE.Vector3(pumpX - 0.70, 2.21, 0),
    leverPivot,
  );
  root.add(pivotSupport);
  const sliderLink = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 1, 20),
    darkMaterial,
  ), 'short-rigid-lever-to-centerline-slider-link');
  root.add(sliderLink);
  const pumpRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 1, 20),
    darkMaterial,
  ), 'vertical-rod-driving-solid-piston');
  root.add(pumpRod);

  const chamberShell = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(1.18, 56, 32),
    shellMaterial,
  ), 'globular-outlet-air-chamber');
  chamberShell.position.copy(chamberCenter);
  chamberShell.scale.y = 1.20;
  root.add(chamberShell);
  const chamberNeck = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.50, 44, 1, true),
    shellMaterial,
  ), 'fixed-air-chamber-inlet-neck');
  chamberNeck.position.set(chamberCenter.x, -0.35, 0);
  root.add(chamberNeck);
  for (const y of [-0.60, 2.55]) {
    const rim = horizontalRing(y < 0 ? 0.56 : 0.46, 0.06, darkMaterial);
    rim.position.set(chamberCenter.x, y, 0);
    root.add(rim);
  }

  const pumpDeliveryCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(pumpX - 0.55, -0.69, 0),
    new THREE.Vector3(0.64, -0.66, 0),
    new THREE.Vector3(0.14, -0.43, 0),
    new THREE.Vector3(chamberCenter.x, -0.40, 0),
  ], false, 'centripetal');
  const pumpDeliveryPipe = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pumpDeliveryCurve, 80, 0.27, 20, false),
    shellMaterial,
  ), 'fixed-pump-to-air-chamber-delivery-pipe');
  root.add(pumpDeliveryPipe);
  const pumpDeliveryWater = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pumpDeliveryCurve, 80, 0.18, 16, false),
    waterMaterial,
  ), 'pulsed-water-delivery-into-air-chamber');
  root.add(pumpDeliveryWater);
  const deliveryValveSeat = addRole(horizontalRing(
    0.33,
    0.06,
    darkMaterial,
  ), 'fixed-pump-delivery-check-seat');
  deliveryValveSeat.position.set(0.10, deliveryValveSeatY, 0);
  root.add(deliveryValveSeat);
  const deliveryValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.09, 36),
    valveMaterial,
  ), 'delivery-check-opening-on-piston-downstroke');
  deliveryValveDisk.position.x = 0.10;
  root.add(deliveryValveDisk);

  const chamberWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.94, 0.76, 1, 48),
    waterMaterial,
  ), 'water-inventory-compressing-air-during-downstroke');
  chamberWater.position.x = chamberCenter.x;
  root.add(chamberWater);
  const compressedAir = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 44, 26),
    airMaterial,
  ), 'elastic-air-cushion-maintaining-constant-outlet');
  compressedAir.position.set(chamberCenter.x, 1.67, 0);
  root.add(compressedAir);

  const sideOutletCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(chamberCenter.x - 0.88, 0.42, 0),
    new THREE.Vector3(-2.02, 0.34, 0),
    new THREE.Vector3(-2.28, 0.65, 0),
    new THREE.Vector3(-2.28, 1.72, 0),
  ], false, 'centripetal');
  const selectedOutlet = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(sideOutletCurve, 80, 0.24, 18, false),
    shellMaterial,
  ), 'selected-side-outlet-from-air-chamber');
  root.add(selectedOutlet);
  const selectedOutletWater = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(sideOutletCurve, 80, 0.15, 14, false),
    waterMaterial,
  ), 'constant-flow-through-selected-air-chamber-outlet');
  root.add(selectedOutletWater);

  const alternativeOutletCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(chamberCenter.x, 0.50, 0),
    new THREE.Vector3(chamberCenter.x, 1.55, 0),
    new THREE.Vector3(chamberCenter.x, 2.48, 0),
    new THREE.Vector3(chamberCenter.x, 3.20, 0),
  ], false, 'centripetal');
  const alternativeOutlet = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(
      alternativeOutletCurve,
      72,
      0.20,
      18,
      false,
    ),
    frameMaterial,
  ), 'unselected-alternative-dip-tube-outlet');
  root.add(alternativeOutlet);
  // Pass 70: Brown leaves the central takeoff open (no cap). With the side
  // riser delivering, the air pressure holds water in the dip tube only up to
  // the side mouth's level, below its open top, so it stands full as a second
  // takeoff (and pressure column) without discharging.
  const alternativeOutletWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 1, 24),
    waterMaterial,
  ), 'standing-water-in-open-central-dip-tube');
  root.add(alternativeOutletWater);

  const inletMarkers = Array.from({ length: 5 }, (_, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 16, 10),
      whiteMaterial,
    ), 'pulsed-air-chamber-inlet-tracer');
    marker.userData.index = index;
    root.add(marker);
    return marker;
  });
  const outletMarkers = Array.from({ length: 6 }, (_, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 16, 10),
      whiteMaterial,
    ), 'constant-selected-outlet-tracer');
    marker.userData.index = index;
    root.add(marker);
    return marker;
  });

  const sliderLinkEndpoints = () => {
    sliderLink.updateMatrixWorld(true);
    return {
      lever: new THREE.Vector3(0, 0.5, 0)
        .applyMatrix4(sliderLink.matrixWorld),
      slider: new THREE.Vector3(0, -0.5, 0)
        .applyMatrix4(sliderLink.matrixWorld),
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    piston.position.set(pumpX, state.pistonY, 0);
    lever.rotation.z = state.leverAngle;
    setCylinderBetween(
      sliderLink,
      state.pistonRodJoint,
      state.leverPin,
    );
    setCylinderBetween(
      pumpRod,
      new THREE.Vector3(pumpX, state.pistonTopY, 0),
      state.pistonRodJoint,
    );
    suctionValveDisk.position.set(
      pumpX,
      suctionValveSeatY + 0.08 + state.suctionValveLift,
      0,
    );
    deliveryValveDisk.position.y = deliveryValveSeatY + 0.08
      + state.deliveryValveLift;
    setVerticalExtent(
      cylinderWater,
      suctionValveSeatY + 0.11,
      state.pistonBottomY - 0.04,
    );
    const chamberFraction = (state.chamberWaterVolume
      - chamberWaterMinimum) / (chamberWaterMaximum - chamberWaterMinimum);
    const chamberWaterHeight = 0.70 + 0.52 * chamberFraction;
    chamberWater.position.y = -0.20 + chamberWaterHeight / 2;
    chamberWater.scale.y = chamberWaterHeight;
    const airVolumeScale = Math.cbrt(
      state.chamberAirVolume / chamberSourceAirVolume,
    );
    compressedAir.scale.setScalar(airVolumeScale);
    compressedAir.position.y = 1.78 - 0.20 * chamberFraction;

    const inletFlowing = state.pumpDeliveryFlowRate > 0.002;
    inletMarkers.forEach((marker, index) => {
      const travel = THREE.MathUtils.euclideanModulo(
        index / inletMarkers.length + state.phase * 2,
        1,
      );
      marker.position.copy(pumpDeliveryCurve.getPoint(travel));
      marker.position.z = 0.20;
      marker.visible = inletFlowing;
    });
    outletMarkers.forEach((marker, index) => {
      const travel = THREE.MathUtils.euclideanModulo(
        index / outletMarkers.length + state.phase,
        1,
      );
      marker.position.copy(sideOutletCurve.getPoint(travel));
      marker.position.z = 0.18;
    });
    root.userData.updateSolids?.(state);
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    barrelArea,
    chamberCenter: chamberCenter.clone(),
    chamberSourceAirPressure,
    chamberSourceAirVolume,
    chamberSourceWaterVolume,
    chamberTotalInternalVolume,
    chamberWaterMaximum,
    chamberWaterMaximumPhase,
    chamberWaterMinimum,
    chamberWaterMinimumPhase,
    cycleDuration,
    deliveredVolumePerCycle,
    deliveryValveSeatY,
    groundY,
    inputAngularSpeed,
    leverAmplitude,
    leverPivot: leverPivot.clone(),
    leverRodPinRadius,
    maximumValveLift,
    nominalOutputFlowRate,
    pistonBottomDeadY,
    pistonRodJointOffset,
    pistonStroke,
    pistonThickness,
    pistonTopDeadY,
    pumpX,
    sliderLinkLength,
    suctionValveSeatY,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'two-check-force-pump-with-globular-outlet-air-chamber-pulsed-downstroke-charge-and-single-selected-constant-flow-outlet',
    blocks: {
      alternativeOutlet,
      alternativeOutletWater,
      barrel,
      barrelRails,
      base,
      chamberNeck,
      chamberShell,
      chamberWater,
      compressedAir,
      cylinderWater,
      deliveryValveDisk,
      deliveryValveSeat,
      inletMarkers,
      lever,
      outletMarkers,
      piston,
      pistonBody,
      pivotSupport,
      pumpDeliveryPipe,
      pumpDeliveryWater,
      pumpRod,
      selectedOutlet,
      selectedOutletWater,
      sliderLink,
      sourceWater,
      sourceWell,
      suctionPipe,
      suctionValveDisk,
      suctionValveSeat,
      suctionWater,
    },
    chamberWaterVolumeAtPhase,
    cumulativePumpDeliveryAtPhase,
    degreesOfFreedom: {
      airPressureIndependent: false,
      deliveryValveIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      outletFlowIndependent: false,
      suctionValveIndependent: false,
    },
    dynamics: {
      airCompressionModel:
        'The trapped air follows an isothermal p*V constant relation. The chamber-water inventory integrates the exact pump pulse minus a uniform outlet and closes each cycle without drift.',
      fullPressureWaveHeatTransferValveImpactLeakageCavitationAndAppliedLeverForceModeled:
        false,
      outletSelection:
        'Brown shows two possible takeoff locations. Both fixed pipes are reconstructed, but the side riser alone is selected for flow. The central dip tube is left open as Brown draws it: the chamber pressure holds its water at the side mouth’s level, below its top, so it stands full without discharging and output is never double-counted.',
      pumpModel:
        'The underlying two-check solid-piston force pump preserves Movement 450’s upstroke suction and downstroke delivery sequence.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The solid-piston force pump draws through its suction check on the upstroke and sends a pulse through the delivery check on the downstroke. That pulse enters a globular outlet chamber and reduces its trapped-air volume. Between pulses, especially throughout the upstroke, the compressed air expands against the chamber water and maintains a constant selected outlet flow. Brown’s two possible takeoff arrangements are both shown, but only the side outlet is active in this demonstration.',
    metering: {
      deliveredVolumePerCycle,
      nominalOutputFlowRate,
      selectedOutlet: 'side-riser',
      unselectedOutlet: 'central-dip-tube',
    },
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'solid-piston-force-pump-pulse-charging-isothermal-air-chamber-with-continuous-selected-outlet',
    },
    sliderLinkEndpoints,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 451 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      chamberAirPressure: sourceState.chamberAirPressure,
      chamberWaterVolume: sourceState.chamberWaterVolume,
      deliveryValveOpen: sourceState.deliveryValveOpen,
      mode: sourceState.mode,
      pistonY: sourceState.pistonY,
      suctionValveOpen: sourceState.suctionValveOpen,
    },
    sourceReference: {
      brownPlate451: {
        approximateAirChamberCenterPixels: [143, 173],
        approximateDeliveryCheckCenterPixels: [144, 313],
        approximateHandlePivotPixels: [244, 125],
        approximatePistonCenterPixels: [302, 313],
        approximateSuctionCheckCenterPixels: [302, 455],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the force pump is the same as Movement 450',
          'an air chamber is added to the outlet',
          'the air chamber produces constant flow',
          'two possible outlet locations are shown and either may be used',
          'water compresses the air during the piston downstroke',
          'air expands and presses water out during the piston upstroke',
        ],
        engravingEvidence:
          'Brown’s section shows the same right-hand solid-piston, two-check force pump and hand lever, connected at lower left to a large globular air chamber. It also shows a side U-shaped riser and a central top-entering dip tube as alternative chamber outlets.',
        reconstructionDisclosure:
          'Brown gives no bore, stroke, chamber volume, initial air charge, pressure, outlet diameter, choice of active outlet, flow rate, loss, heat-transfer law, or timing. Those values, exact mass-balanced inventory, isothermal relation, selected-side-outlet convention, standing dip-tube column, rigid linkage, transparent cutaway, colors, tracers, and 5.2-second cycle are independently engineered. The Movement 450 pump cycle, globular chamber, downstroke air compression, upstroke air expansion, constant flow, and two possible takeoffs are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 451',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      airCushion:
        'p_air*V_air=p_source*V_source with V_air=V_total-V_water.',
      massBalance:
        'dV_chamber/dt=Q_pump-Q_out exactly. Q_out is strokeVolume/cycle at nominal speed, and the integrated downstroke pulse equals one swept volume, so the chamber closes exactly.',
      outletChoice:
        'Q_side=Q_out and Q_central=0 for this selected configuration; choosing the other source-shown takeoff would swap those rates without changing their sum.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.62, groundY, -1.72),
    new THREE.Vector3(5.10, 3.76, 1.72),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(6.5, 4.8, 10.8);
  root.userData.groundFloorY = groundY;
  correctForcePumpParts(root,movement.id);
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredForcePumpMovement(movement) {
  if (movement.id === 450) return applyCutawayFor(ordinaryForcePump(movement), 450);
  if (movement.id === 451) return applyCutawayFor(airChamberForcePump(movement), 451);
  return null;
}
