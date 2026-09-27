import * as THREE from 'three';
import {correctLiftPumpParts} from './lift-pump-working-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import {waterJetGeometry, waterJetMaterial} from './water-volume.js';
import {WaterStream, ballisticPath, guidedPath, joinPaths} from './water-stream.js';

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

function commonLiftPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const leverPivot = new THREE.Vector3(0.82, 3.18, 0);
  const leverBaseAngle = THREE.MathUtils.degToRad(-30);
  const leverAmplitude = THREE.MathUtils.degToRad(16);
  const leftLeverRadius = 0.90;
  const handleRadius = 2.80;
  const connectingRodLength = 1.45;
  const pistonJointOffsetY = 0.62;
  const pistonThickness = 0.20;
  const pistonRadius = 0.67;
  const barrelWaterRadius = 0.61;
  const barrelArea = Math.PI * barrelWaterRadius ** 2;
  const footValveSeatY = -1.27;
  const spoutWaterLevelY = 2.23;
  const maximumValveLift = 0.16;
  // Brown draws both checks as clack flaps: the lower one hinged at its
  // right edge (its knuckle shows there), the bucket's at its left edge.
  const maximumFootFlapAngle = THREE.MathUtils.degToRad(30);
  const footFlapHingeX = 0.40;
  const maximumBucketFlapAngle = THREE.MathUtils.degToRad(30);
  const bucketFlapHingeX = -0.29;
  const groundY = -2.62;

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
    const leverAngle = leverBaseAngle - leverAmplitude * sine;
    const leverAngularSpeed = -leverAmplitude * cosine * inputSpeed;
    const leverAngularAcceleration = leverAmplitude * (
      sine * inputSpeed ** 2 - cosine * inputAcceleration
    );
    const leverPin = new THREE.Vector3(
      leverPivot.x - leftLeverRadius * Math.cos(leverAngle),
      leverPivot.y - leftLeverRadius * Math.sin(leverAngle),
      0,
    );
    const leverPinVelocity = new THREE.Vector3(
      leftLeverRadius * Math.sin(leverAngle) * leverAngularSpeed,
      -leftLeverRadius * Math.cos(leverAngle) * leverAngularSpeed,
      0,
    );
    const leverPinAcceleration = new THREE.Vector3(
      leftLeverRadius * (
        Math.cos(leverAngle) * leverAngularSpeed ** 2
          + Math.sin(leverAngle) * leverAngularAcceleration
      ),
      leftLeverRadius * (
        Math.sin(leverAngle) * leverAngularSpeed ** 2
          - Math.cos(leverAngle) * leverAngularAcceleration
      ),
      0,
    );
    const verticalProjection = Math.sqrt(
      connectingRodLength ** 2 - leverPin.x ** 2,
    );
    const pistonRodJoint = new THREE.Vector3(
      0,
      leverPin.y - verticalProjection,
      0,
    );
    const pistonVelocity = leverPinVelocity.y
      + leverPin.x * leverPinVelocity.x / verticalProjection;
    const pistonAcceleration = leverPinAcceleration.y
      + (
        leverPinVelocity.x ** 2
          + leverPin.x * leverPinAcceleration.x
      ) / verticalProjection
      + (leverPin.x * leverPinVelocity.x) ** 2
        / verticalProjection ** 3;
    const pistonY = pistonRodJoint.y - pistonJointOffsetY;
    const pistonBottomY = pistonY - pistonThickness / 2;
    const pistonTopY = pistonY + pistonThickness / 2;
    const footValveOpen = positiveC2Lobe(cosine);
    const pistonValveOpen = positiveC2Lobe(-cosine);
    const intakeFlowRate = barrelArea * Math.max(0, pistonVelocity);
    const dischargeFlowRate = intakeFlowRate;
    const pistonTransferFlowRate = barrelArea
      * Math.max(0, -pistonVelocity);
    const lowerChamberWaterVolume = barrelArea
      * (pistonBottomY - footValveSeatY);
    const lowerChamberWaterVolumeRate = barrelArea * pistonVelocity;
    const upperChamberWaterVolume = barrelArea
      * (spoutWaterLevelY - pistonTopY);
    const upperChamberWaterVolumeRate = -barrelArea * pistonVelocity;
    let mode;
    if (Math.abs(cosine) < 1e-12) {
      mode = sine > 0
        ? 'top-dead-center-both-check-valves-seated'
        : 'bottom-dead-center-both-check-valves-seated';
    } else if (cosine > 0) {
      mode = 'upstroke-foot-valve-open-bucket-valve-shut-lifting-and-discharging';
    } else {
      mode = 'downstroke-foot-valve-shut-bucket-valve-open-water-passing-through-piston';
    }
    return {
      barrelArea,
      dischargeFlowRate,
      footFlapAngle: maximumFootFlapAngle * footValveOpen,
      footValveLift: maximumValveLift * footValveOpen,
      footValveOpen,
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
      lowerChamberWaterVolume,
      lowerChamberWaterVolumeRate,
      mode,
      phase,
      pistonAcceleration,
      pistonBottomY,
      pistonRodJoint,
      pistonTopY,
      pistonTransferFlowRate,
      pistonFlapAngle: maximumBucketFlapAngle * pistonValveOpen,
      pistonValveLift: maximumValveLift * pistonValveOpen,
      pistonValveOpen,
      pistonVelocity,
      pistonY,
      upperChamberWaterVolume,
      upperChamberWaterVolumeRate,
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
  const flowMaterial = waterMaterial.clone();
  flowMaterial.color.setHex(0x2d819c);
  flowMaterial.opacity = 0.88;
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.5, 0.16, 3.2),
    frameMaterial,
  ), 'fixed-pump-foundation');
  base.position.set(0.35, groundY + 0.08, 0);
  root.add(base);

  const well = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.18, 0.62, 56),
    shellMaterial,
  ), 'source-water-well');
  well.position.set(0, -2.22, 0);
  root.add(well);
  const wellRim = horizontalRing(1.18, 0.08, darkMaterial);
  wellRim.position.y = -1.91;
  wellRim.visible = false;
  wellRim.userData.retiredInkOutline = true;
  root.add(wellRim);
  const wellWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.08, 0.22, 48),
    waterMaterial,
  ), 'source-water-below-suction-pipe');
  wellWater.position.y = -2.12;
  root.add(wellWater);

  const suctionPipe = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.43, 1.20, 48, 1, true),
    shellMaterial,
  ), 'fixed-suction-pipe-below-foot-valve');
  suctionPipe.position.y = -1.84;
  root.add(suctionPipe);
  const suctionWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.34, 1.18, 48),
    waterMaterial,
  ), 'water-rushing-up-suction-pipe-on-upstroke');
  suctionWater.position.y = -1.84;
  root.add(suctionWater);

  const barrel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 3.92, 64, 1, true),
    shellMaterial,
  ), 'fixed-vertical-lift-pump-barrel');
  barrel.position.y = 0.57;
  root.add(barrel);
  for (const y of [-1.39, 2.53]) {
    const rim = horizontalRing(0.78, 0.07, darkMaterial);
    rim.position.y = y;
    // Edge line only: hidden reference, not a dark rim.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    root.add(rim);
  }

  const barrelRearFrame = new THREE.Group();
  barrelRearFrame.userData.role = 'fixed-cutaway-barrel-wall';
  for (const x of [-0.56, 0.56]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 3.84, 0.10),
      frameMaterial,
    );
    rail.position.set(x, 0.57, -0.60);
    barrelRearFrame.add(rail);
  }
  root.add(barrelRearFrame);

  const footValveSeat = addRole(horizontalRing(
    0.47,
    0.07,
    darkMaterial,
  ), 'fixed-lower-foot-valve-seat');
  footValveSeat.position.y = footValveSeatY;
  root.add(footValveSeat);
  const footFlapPivot = addRole(new THREE.Group(),
    'lower-check-flap-hinge-pivot');
  footFlapPivot.position.set(footFlapHingeX, footValveSeatY + 0.08, 0);
  root.add(footFlapPivot);
  const footValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.40, 0.10, 64),
    valveMaterial,
  ), 'lower-check-valve-opening-only-on-upstroke');
  footValveDisk.position.x = -footFlapHingeX;
  footFlapPivot.add(footValveDisk);

  const piston = addRole(new THREE.Group(),
    'moving-piston-or-bucket');
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
  const pistonValveSeat = addRole(horizontalRing(
    0.30,
    0.055,
    darkMaterial,
  ), 'valve-seat-within-moving-piston');
  pistonValveSeat.position.y = pistonThickness / 2 + 0.015;
  piston.add(pistonValveSeat);
  const pistonFlapPivot = addRole(new THREE.Group(),
    'bucket-check-flap-hinge-pivot');
  pistonFlapPivot.position.set(bucketFlapHingeX, pistonThickness / 2 + 0.07, 0);
  piston.add(pistonFlapPivot);
  const pistonValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.08, 48),
    valveMaterial,
  ), 'bucket-check-valve-opening-only-on-downstroke');
  pistonValveDisk.position.x = -bucketFlapHingeX;
  pistonFlapPivot.add(pistonValveDisk);

  const lowerChamberWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      barrelWaterRadius,
      barrelWaterRadius,
      1,
      48,
    ),
    waterMaterial,
  ), 'water-below-bucket-filled-through-lower-valve');
  root.add(lowerChamberWater);
  const upperChamberWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      barrelWaterRadius,
      barrelWaterRadius,
      1,
      48,
    ),
    waterMaterial,
  ), 'water-above-bucket-lifted-to-spout');
  root.add(upperChamberWater);

  const lever = addRole(new THREE.Group(), 'hand-lever-rocking-on-fixed-pivot');
  lever.position.copy(leverPivot);
  root.add(lever);
  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-leftLeverRadius, 0, 0),
    new THREE.Vector3(-0.34, 0.08, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1.12, -0.03, 0),
    new THREE.Vector3(handleRadius, -0.16, 0),
  ], false, 'centripetal');
  const leverArm = new THREE.Mesh(
    new THREE.TubeGeometry(leverCurve, 72, 0.12, 14, false),
    frameMaterial,
  );
  lever.add(leverArm);
  const leverPivotPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.42, 30),
    darkMaterial,
  );
  leverPivotPin.rotation.x = Math.PI / 2;
  lever.add(leverPivotPin);
  const leverRodPin = leverPivotPin.clone();
  leverRodPin.scale.setScalar(0.70);
  leverRodPin.position.x = -leftLeverRadius;
  lever.add(leverRodPin);
  const handleKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 28, 18),
    darkMaterial,
  );
  handleKnob.position.set(handleRadius, -0.16, 0);
  lever.add(handleKnob);

  const connectingRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 1, 20),
    darkMaterial,
  ), 'rigid-link-from-lever-pin-to-vertical-pump-rod');
  root.add(connectingRod);
  const pumpRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 1, 20),
    darkMaterial,
  ), 'vertical-pump-rod-driving-bucket');
  root.add(pumpRod);

  // Pass 70: the spout leaves the wall of Brown's wider pump head.
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.98, 2.18, 0),
    new THREE.Vector3(-1.30, 2.12, 0),
    new THREE.Vector3(-1.62, 1.92, 0),
    new THREE.Vector3(-2.12, 1.78, 0),
  ], false, 'centripetal');
  const spout = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(spoutCurve, 72, 0.25, 20, false),
    shellMaterial,
  ), 'fixed-side-overflow-spout');
  root.add(spout);
  const spoutWater = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(spoutCurve, 72, 0.16, 16, false),
    flowMaterial,
  ), 'water-running-over-spout-on-each-upstroke');
  root.add(spoutWater);
  // The water leaving the spout lip falls as one translucent stream that
  // thins and breaks up as it drops (it does not end in a flat cut).
  const dischargeStream = addRole(new THREE.Mesh(
    waterJetGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.12, -0.17, 0),
      new THREE.Vector3(-0.2, -1.64, 0),
    ), { radius: 0.13, endRadius: 0.08, segments: 32, fadeStart: 0.55, flare: 1.4 }),
    waterJetMaterial(),
  ), 'intermittent-spout-discharge-stream');
  dischargeStream.renderOrder = 2;
  // Hung from the spout lip, so it scales from there with the discharge.
  dischargeStream.position.set(-2.12, 1.76, 0);
  root.add(dischargeStream);

  const valveFlowMarkers = Array.from({ length: 4 }, (_, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 16, 10),
      whiteMaterial,
    ), 'through-bucket-flow-tracer');
    marker.userData.index = index;
    root.add(marker);
    return marker;
  });

  const rodEndpoints = () => {
    connectingRod.updateMatrixWorld(true);
    return {
      lever: new THREE.Vector3(0, 0.5, 0)
        .applyMatrix4(connectingRod.matrixWorld),
      piston: new THREE.Vector3(0, -0.5, 0)
        .applyMatrix4(connectingRod.matrixWorld),
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    piston.position.y = state.pistonY;
    pistonFlapPivot.rotation.z = state.pistonFlapAngle;
    footFlapPivot.rotation.z = -state.footFlapAngle;
    lever.rotation.z = state.leverAngle;
    setCylinderBetween(
      connectingRod,
      state.pistonRodJoint,
      state.leverPin,
    );
    setCylinderBetween(
      pumpRod,
      new THREE.Vector3(0, state.pistonTopY, 0),
      state.pistonRodJoint,
    );
    setVerticalExtent(
      lowerChamberWater,
      footValveSeatY + 0.11,
      state.pistonBottomY - 0.04,
    );
    setVerticalExtent(
      upperChamberWater,
      state.pistonTopY + 0.04,
      spoutWaterLevelY,
    );
    const maximumNominalFlow = barrelArea * 0.30;
    const dischargeFraction = THREE.MathUtils.clamp(
      state.dischargeFlowRate / maximumNominalFlow,
      0,
      1,
    );
    spoutWater.visible = dischargeFraction > 0.002;
    dischargeStream.visible = dischargeFraction > 0.002;
    dischargeStream.scale.set(
      0.45 + 0.55 * dischargeFraction,
      0.45 + 0.55 * dischargeFraction,
      0.45 + 0.55 * dischargeFraction,
    );
    const transferVisible = state.pistonTransferFlowRate > 0.002;
    valveFlowMarkers.forEach((marker, index) => {
      const travel = THREE.MathUtils.euclideanModulo(
        index / valveFlowMarkers.length - state.phase * 2,
        1,
      );
      marker.position.set(
        0.24 * Math.cos(index * Math.PI / 2),
        state.pistonY + THREE.MathUtils.lerp(-0.30, 0.34, travel),
        0.24 * Math.sin(index * Math.PI / 2),
      );
      marker.visible = transferVisible;
    });
    root.userData.updateSolids?.(state);
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    barrelArea,
    barrelWaterRadius,
    connectingRodLength,
    cycleDuration,
    footValveSeatY,
    groundY,
    handleRadius,
    inputAngularSpeed,
    leftLeverRadius,
    leverAmplitude,
    leverBaseAngle,
    leverPivot: leverPivot.clone(),
    bucketFlapHingeX,
    footFlapHingeX,
    maximumBucketFlapAngle,
    maximumFootFlapAngle,
    maximumValveLift,
    pistonJointOffsetY,
    pistonRadius,
    pistonThickness,
    spoutWaterLevelY,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'common-lift-pump-with-lower-foot-check-valve-valved-bucket-hand-lever-suction-pipe-and-upstroke-spout-discharge',
    blocks: {
      barrel,
      barrelRearFrame,
      base,
      connectingRod,
      dischargeStream,
      footFlapPivot,
      footValveDisk,
      footValveSeat,
      lever,
      lowerChamberWater,
      piston,
      pistonBody,
      pistonFlapPivot,
      pistonValveDisk,
      pistonValveSeat,
      pumpRod,
      spout,
      spoutWater,
      suctionPipe,
      suctionWater,
      upperChamberWater,
      valveFlowMarkers,
      well,
      wellWater,
    },
    degreesOfFreedom: {
      footValveIndependent: false,
      independentPrescribedInputs: 1,
      leverIndependent: false,
      operatingDegreesOfFreedom: 1,
      pistonValveIndependent: false,
    },
    dynamics: {
      airExhaustionAndInitialPrimingModeled: false,
      checkValveModel:
        'Valve lift is the cube of the positive or negative piston-driving cosine. The two nonnegative C2 lobes have disjoint support, so both checks seat at dead center and can never be open together.',
      flowModel:
        'The display represents a fully primed incompressible steady cycle. Cylinder volume swept upward equals both intake and discharge; swept downward equals transfer through the bucket. Leakage, valve inertia, pressure loss, cavitation, air compressibility and water-column inertia are not solved.',
      thirtyFootLimit:
        'Brown’s stated limit is retained as source information; atmospheric suction head is not scaled or simulated by the scene dimensions.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The hand lever and a rigid connecting link raise and lower the bucket in the fixed barrel. On the upstroke the lower foot check opens while the check in the bucket shuts: water enters through the suction pipe, the water already above the bucket is lifted, and an equal swept volume leaves the side spout. On the downstroke the lower check shuts and the bucket check opens, allowing the same swept volume to pass upward through the descending piston. Both checks are seated at each dead center and never open together.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'hand-lever-rigid-link-bucket-reciprocation-with-exclusive-foot-and-piston-check-valves',
    },
    rodEndpoints,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 448 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      footValveOpen: sourceState.footValveOpen,
      leverAngle: sourceState.leverAngle,
      mode: sourceState.mode,
      pistonValveOpen: sourceState.pistonValveOpen,
      pistonY: sourceState.pistonY,
    },
    sourceReference: {
      brownPlate448: {
        approximateBucketCenterPixels: [261, 275],
        approximateFootValveCenterPixels: [259, 445],
        approximateLeverPivotPixels: [345, 68],
        approximateRodLeverPinPixels: [257, 35],
        approximateSpoutMouthPixels: [153, 220],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is a common lift pump',
          'the lower valve opens and the piston valve shuts on the upstroke',
          'air is exhausted and water rises through the suction pipe to fill the vacuum',
          'the lower valve shuts and the piston valve opens on the downstroke',
          'water passes through the piston on the downstroke',
          'water above the piston is lifted and runs from the spout on each upstroke',
          'the pump cannot raise water more than thirty feet',
        ],
        engravingEvidence:
          'Brown’s section shows a vertical suction pipe and barrel, a bottom clack or foot valve, a valved bucket, a long vertical pump rod, a fixed lever pivot with right-hand handle, and a left side spout above the bucket.',
        reconstructionDisclosure:
          'Brown gives no barrel diameter, stroke, rod or lever dimensions, check-valve lift, water level, operating rate, pressure, loss, leakage, or exact lever geometry. Those values, the rigid-link closure, C2 valve-lift lobes, primed incompressible volume model, transparent cutaway, colors, and 5.4-second cycle are independently engineered. The two exclusive checks, upstroke suction and discharge, downstroke bucket transfer, lever drive, side spout, and thirty-foot statement are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 448',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      checkValveInterlock:
        'footOpen=max(cos(phi),0)^3 and bucketOpen=max(-cos(phi),0)^3; their product is identically zero.',
      rigidLink:
        'The lever pin-to-piston-rod-joint distance is exactly constant while the joint remains on the barrel centerline.',
      volumeBalance:
        'dV_lower/dt=Q_intake-Q_transfer and dV_upper/dt=Q_transfer-Q_discharge exactly; Q_intake=Q_discharge=A*max(v_piston,0) and Q_transfer=A*max(-v_piston,0).',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.55, groundY, -1.65),
    new THREE.Vector3(4.00, 3.82, 1.65),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(6.3, 4.5, 10.8);
  root.userData.groundFloorY = groundY;
  correctLiftPumpParts(root, movement.id);
  // Pass 69: the water leaving the spout lip is one continuous falling
  // stream whose section follows the discharge (it used to snap between
  // hidden and 45 per cent size at the start and end of each upstroke).
  const lip = spoutCurve.getPointAt(1), lipDirection = spoutCurve.getTangentAt(1);
  // It runs through the spout (where the pipe hides it) and on from the lip,
  // so no separate tube of spout water switches on and off.
  const spill = new WaterStream(joinPaths(guidedPath(spoutCurve, {speed: 1.1, samples: 24}), ballisticPath({
    origin: lip,
    velocity: lipDirection.clone().multiplyScalar(1.1),
    endY: lip.y - 1.75,
    samples: 24,
  })), {width: 0.15, thickness: 0.15, fadeOut: 0.3, cyclePeriod: cycleDuration, streakRate: 1, opacity: 0.4});
  spill.userData.role = 'water-falling-from-spout-lip-on-each-upstroke';
  root.add(spill);
  dischargeStream.removeFromParent();
  spoutWater.removeFromParent();
  const baseUpdate = update;
  const liveUpdate = (time) => {
    baseUpdate(time);
    const state = stateAtTime(time);
    const fraction = THREE.MathUtils.clamp(state.dischargeFlowRate / (barrelArea * 0.30), 0, 1);
    // Near zero discharge the thinning stream also fades, so it never
    // blinks on or off at the ends of the upstroke.
    spill.setFlow(Math.max(1e-3, fraction));
    spill.material.opacity = 0.4 * THREE.MathUtils.smoothstep(fraction, 0, 0.12);
    spill.visible = spill.material.opacity > 0;
    spill.update(time);
  };
  root.userData.update = liveUpdate;
  root.userData.blocks.spill = spill;
  markShadows(root);
  spill.castShadow = false;
  spill.receiveShadow = false;
  base.receiveShadow = true;
  liveUpdate(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update: liveUpdate,
  };
}

function modernLiftingPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4.8;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const pistonCenterY = 0.34;
  const pistonAmplitude = 0.62;
  const pistonThickness = 0.20;
  const pistonRadius = 0.67;
  const barrelWaterRadius = 0.61;
  const barrelArea = Math.PI * barrelWaterRadius ** 2;
  const footValveSeatY = -1.31;
  const upperChamberTopY = 1.63;
  const stuffingBoxY = 1.98;
  const deliveryFlapY = 2.73;
  const maximumValveLift = 0.16;
  const maximumDeliveryFlapAngle = THREE.MathUtils.degToRad(34);
  // Pass 70: Brown's lower check is a flap hinged at its left edge, like
  // the delivery flap, not a lifting disk.
  const maximumFootFlapAngle = THREE.MathUtils.degToRad(30);
  const footFlapHingeX = -0.40;
  // The bucket check is a clack flap too, hinged at its left edge.
  const maximumBucketFlapAngle = THREE.MathUtils.degToRad(30);
  const bucketFlapHingeX = -0.29;
  const pumpRodLength = 3.18;
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
    const pistonY = pistonCenterY + pistonAmplitude * sine;
    const pistonVelocity = pistonAmplitude * cosine * inputSpeed;
    const pistonAcceleration = pistonAmplitude * (
      -sine * inputSpeed ** 2 + cosine * inputAcceleration
    );
    const pistonBottomY = pistonY - pistonThickness / 2;
    const pistonTopY = pistonY + pistonThickness / 2;
    const upstrokeValveOpen = positiveC2Lobe(cosine);
    const downstrokeValveOpen = positiveC2Lobe(-cosine);
    const intakeFlowRate = barrelArea * Math.max(0, pistonVelocity);
    const dischargeFlowRate = intakeFlowRate;
    const pistonTransferFlowRate = barrelArea
      * Math.max(0, -pistonVelocity);
    const lowerChamberWaterVolume = barrelArea
      * (pistonBottomY - footValveSeatY);
    const lowerChamberWaterVolumeRate = barrelArea * pistonVelocity;
    const upperChamberWaterVolume = barrelArea
      * (upperChamberTopY - pistonTopY);
    const upperChamberWaterVolumeRate = -barrelArea * pistonVelocity;
    let mode;
    if (Math.abs(cosine) < 1e-12) {
      mode = sine > 0
        ? 'top-dead-center-all-three-checks-seated'
        : 'bottom-dead-center-all-three-checks-seated';
    } else if (cosine > 0) {
      mode = 'upstroke-foot-and-delivery-checks-open-bucket-check-shut';
    } else {
      mode = 'downstroke-foot-and-delivery-checks-shut-bucket-check-open';
    }
    return {
      barrelArea,
      deliveryFlapAngle: maximumDeliveryFlapAngle * upstrokeValveOpen,
      deliveryFlapAngularSpeed: -3 * maximumDeliveryFlapAngle
        * Math.max(0, cosine) ** 2 * sine * inputSpeed,
      deliveryValveOpen: upstrokeValveOpen,
      dischargeFlowRate,
      footFlapAngle: maximumFootFlapAngle * upstrokeValveOpen,
      footValveLift: maximumValveLift * upstrokeValveOpen,
      footValveOpen: upstrokeValveOpen,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      intakeFlowRate,
      lowerChamberWaterVolume,
      lowerChamberWaterVolumeRate,
      mode,
      phase,
      pistonAcceleration,
      pistonBottomY,
      pistonTopY,
      pistonTransferFlowRate,
      pistonFlapAngle: maximumBucketFlapAngle * downstrokeValveOpen,
      pistonValveLift: maximumValveLift * downstrokeValveOpen,
      pistonValveOpen: downstrokeValveOpen,
      pistonVelocity,
      pistonY,
      rodBottomY: pistonTopY + .52,
      rodTopY: pistonTopY + .52 + pumpRodLength,
      upperChamberWaterVolume,
      upperChamberWaterVolumeRate,
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
  const flowMaterial = waterMaterial.clone();
  flowMaterial.color.setHex(0x2d819c);
  flowMaterial.opacity = 0.88;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(5.7, 0.16, 3.0),
    frameMaterial,
  ), 'fixed-modern-pump-foundation');
  base.position.set(0.35, groundY + 0.08, 0);
  root.add(base);

  const sourceWell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.03, 1.03, 0.58, 52),
    shellMaterial,
  ), 'source-water-well');
  sourceWell.position.set(0, -2.19, 0);
  root.add(sourceWell);
  const sourceWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.94, 0.94, 0.20, 48),
    waterMaterial,
  ), 'source-water-below-modern-lift-pump');
  sourceWater.position.y = -2.10;
  root.add(sourceWater);
  const wellRim = horizontalRing(1.03, 0.075, darkMaterial);
  wellRim.position.y = -1.90;
  wellRim.visible = false;
  wellRim.userData.retiredInkOutline = true;
  root.add(wellRim);

  const suctionPipe = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.51, 0.39, 1.12, 48, 1, true),
    shellMaterial,
  ), 'fixed-suction-pipe-below-lower-check');
  suctionPipe.position.y = -1.83;
  root.add(suctionPipe);
  const suctionWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.32, 1.10, 48),
    waterMaterial,
  ), 'water-drawn-through-suction-pipe');
  suctionWater.position.y = -1.83;
  root.add(suctionWater);

  const barrel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 3.40, 64, 1, true),
    shellMaterial,
  ), 'fixed-enclosed-modern-lift-pump-barrel');
  barrel.position.y = 0.33;
  root.add(barrel);
  for (const y of [-1.37, 2.03]) {
    const rim = horizontalRing(0.78, 0.07, darkMaterial);
    rim.position.y = y;
    // Edge line only: hidden reference, not a dark rim.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    root.add(rim);
  }
  const barrelRails = addRole(new THREE.Group(),
    'fixed-cutaway-modern-barrel-outline');
  for (const x of [-0.56, 0.56]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 3.30, 0.10),
      frameMaterial,
    );
    rail.position.set(x, 0.33, -0.60);
    barrelRails.add(rail);
  }
  root.add(barrelRails);

  const topCover = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.77, 0.77, 0.14, 52),
    frameMaterial,
  ), 'fixed-enclosed-pump-head');
  topCover.position.y = 2.00;
  root.add(topCover);
  const stuffingBox = addRole(new THREE.Group(),
    'fixed-stuffing-box-sealing-sliding-piston-rod');
  stuffingBox.position.y = stuffingBoxY;
  root.add(stuffingBox);
  const stuffingBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.33, 0.42, 36),
    valveMaterial,
  );
  stuffingBody.position.y = 0.20;
  stuffingBox.add(stuffingBody);
  const stuffingBore = horizontalRing(0.14, 0.045, darkMaterial);
  stuffingBore.position.y = 0.42;
  stuffingBox.add(stuffingBore);

  const footValveSeat = addRole(horizontalRing(
    0.46,
    0.07,
    darkMaterial,
  ), 'fixed-lower-check-valve-seat');
  footValveSeat.position.y = footValveSeatY;
  root.add(footValveSeat);
  const footFlapPivot = addRole(new THREE.Group(),
    'lower-check-flap-hinge-pivot');
  footFlapPivot.position.set(footFlapHingeX, footValveSeatY + 0.08, 0);
  root.add(footFlapPivot);
  const footValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.40, 0.09, 64),
    valveMaterial,
  ), 'lower-check-flap-opening-on-upstroke');
  footValveDisk.position.x = -footFlapHingeX;
  footFlapPivot.add(footValveDisk);

  const piston = addRole(new THREE.Group(),
    'moving-valved-bucket-in-modern-lift-pump');
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
  const pistonValveSeat = addRole(horizontalRing(
    0.30,
    0.055,
    darkMaterial,
  ), 'check-seat-within-modern-bucket');
  pistonValveSeat.position.y = pistonThickness / 2 + 0.015;
  piston.add(pistonValveSeat);
  const pistonFlapPivot = addRole(new THREE.Group(),
    'bucket-check-flap-hinge-pivot');
  pistonFlapPivot.position.set(bucketFlapHingeX, pistonThickness / 2 + 0.07, 0);
  piston.add(pistonFlapPivot);
  const pistonValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.08, 48),
    valveMaterial,
  ), 'bucket-check-opening-on-downstroke');
  pistonValveDisk.position.x = -bucketFlapHingeX;
  pistonFlapPivot.add(pistonValveDisk);

  const pumpRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, pumpRodLength, 20),
    darkMaterial,
  ), 'piston-rod-sliding-through-stuffing-box');
  root.add(pumpRod);
  const lowerChamberWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      barrelWaterRadius,
      barrelWaterRadius,
      1,
      48,
    ),
    waterMaterial,
  ), 'water-below-modern-bucket');
  root.add(lowerChamberWater);
  const upperChamberWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      barrelWaterRadius,
      barrelWaterRadius,
      1,
      48,
    ),
    waterMaterial,
  ), 'pressurized-water-above-modern-bucket');
  root.add(upperChamberWater);

  const deliveryCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.62, 1.48, 0),
    new THREE.Vector3(1.12, 1.54, 0),
    new THREE.Vector3(1.42, 1.89, 0),
    new THREE.Vector3(1.44, 2.72, 0),
    new THREE.Vector3(1.47, 3.70, 0),
  ], false, 'centripetal');
  const deliveryPipe = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(deliveryCurve, 96, 0.30, 20, false),
    shellMaterial,
  ), 'fixed-high-level-delivery-riser');
  root.add(deliveryPipe);
  const deliveryWater = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(deliveryCurve, 96, 0.20, 16, false),
    waterMaterial,
  ), 'retained-water-column-above-delivery-flap');
  root.add(deliveryWater);
  const deliveryBell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.31, 0.74, 44, 1, true),
    shellMaterial,
  ), 'fixed-delivery-flap-chamber');
  deliveryBell.position.set(1.45, deliveryFlapY, 0);
  root.add(deliveryBell);
  for (const y of [deliveryFlapY - 0.37, deliveryFlapY + 0.37]) {
    const rim = horizontalRing(y > deliveryFlapY ? 0.43 : 0.31,
      0.05, darkMaterial);
    rim.position.set(1.45, y, 0);
    // Edge line only: hidden reference, not a dark rim.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    root.add(rim);
  }

  const deliveryFlapSeat = addRole(horizontalRing(
    0.27,
    0.055,
    darkMaterial,
  ), 'fixed-upward-delivery-flap-seat');
  deliveryFlapSeat.position.set(1.45, deliveryFlapY - 0.14, 0);
  root.add(deliveryFlapSeat);
  const deliveryFlapPivot = addRole(new THREE.Group(),
    'upward-opening-delivery-flap-pivot');
  deliveryFlapPivot.position.set(1.20, deliveryFlapY - 0.08, 0);
  root.add(deliveryFlapPivot);
  const deliveryFlap = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.075, 0.48),
    valveMaterial,
  ), 'outlet-flap-opening-upward-on-upstroke');
  deliveryFlap.position.x = 0.25;
  deliveryFlapPivot.add(deliveryFlap);
  const flapHinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.58, 20),
    darkMaterial,
  );
  flapHinge.rotation.x = Math.PI / 2;
  deliveryFlapPivot.add(flapHinge);

  const update = (time) => {
    const state = stateAtTime(time);
    piston.position.y = state.pistonY;
    pistonFlapPivot.rotation.z = state.pistonFlapAngle;
    footFlapPivot.rotation.z = state.footFlapAngle;
    pumpRod.position.y = (state.rodBottomY + state.rodTopY) / 2;
    deliveryFlapPivot.rotation.z = state.deliveryFlapAngle;
    setVerticalExtent(
      lowerChamberWater,
      footValveSeatY + 0.11,
      state.pistonBottomY - 0.04,
    );
    setVerticalExtent(
      upperChamberWater,
      state.pistonTopY + 0.04,
      upperChamberTopY,
    );
    root.userData.updateSolids?.(state);
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    barrelArea,
    barrelWaterRadius,
    cycleDuration,
    deliveryFlapY,
    footValveSeatY,
    groundY,
    inputAngularSpeed,
    maximumDeliveryFlapAngle,
    bucketFlapHingeX,
    maximumBucketFlapAngle,
    maximumFootFlapAngle,
    maximumValveLift,
    pistonAmplitude,
    pistonCenterY,
    pistonRadius,
    pistonThickness,
    pumpRodLength,
    stuffingBoxY,
    upperChamberTopY,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'modern-lifting-pump-with-stuffing-box-valved-bucket-lower-check-and-upward-opening-high-delivery-flap',
    blocks: {
      barrel,
      barrelRails,
      base,
      deliveryBell,
      deliveryFlap,
      deliveryFlapPivot,
      deliveryFlapSeat,
      deliveryPipe,
      deliveryWater,
      footFlapPivot,
      footValveDisk,
      footValveSeat,
      lowerChamberWater,
      piston,
      pistonBody,
      pistonFlapPivot,
      pistonValveDisk,
      pistonValveSeat,
      pumpRod,
      sourceWater,
      sourceWell,
      stuffingBox,
      suctionPipe,
      suctionWater,
      topCover,
      upperChamberWater,
    },
    degreesOfFreedom: {
      deliveryFlapIndependent: false,
      footValveIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pistonValveIndependent: false,
    },
    dynamics: {
      airExhaustionInitialPrimingAndAppliedRodForceModeled: false,
      checkValveModel:
        'Foot and high-delivery checks share the positive C2 piston-velocity lobe; the bucket check uses the disjoint negative lobe. All three seat at dead center, and the delivery flap opens geometrically upward.',
      flowModel:
        'The display is a primed incompressible volume model. Upstroke displacement enters through the foot check and leaves through the high delivery check; downstroke displacement transfers through the bucket check while the delivery flap retains the rising-main column.',
      unlimitedLiftStatement:
        'Brown’s phrase “any height above this pump” means the delivery is not limited by atmospheric suction head in the manner of the open-spout lift pump; required rod force, structural strength and losses still grow with delivery head and are not solved here.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The piston rod slides through a fixed stuffing box into an enclosed pump head. During the upstroke, the lower check and the upward-opening delivery flap open while the valve in the bucket shuts; equal swept volumes enter from below and are forced into the high rising main. During the downstroke, both lower and delivery checks shut, the bucket check opens, and water passes through the descending piston into the upper chamber. The delivery flap then prevents the elevated column from returning.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'stuffing-box-piston-reciprocation-with-synchronous-foot-and-delivery-checks-opposed-to-bucket-check',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 449 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      deliveryFlapAngle: sourceState.deliveryFlapAngle,
      deliveryValveOpen: sourceState.deliveryValveOpen,
      footValveOpen: sourceState.footValveOpen,
      mode: sourceState.mode,
      pistonValveOpen: sourceState.pistonValveOpen,
      pistonY: sourceState.pistonY,
    },
    sourceReference: {
      brownPlate449: {
        approximateBucketCenterPixels: [266, 331],
        approximateDeliveryFlapCenterPixels: [376, 110],
        approximateFootValveCenterPixels: [266, 462],
        approximateStuffingBoxCenterPixels: [248, 169],
        approximateUpperDeliveryMouthPixels: [363, 35],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is a modern lifting pump',
          'it operates in the same manner as the preceding common lift pump',
          'the piston rod passes through a stuffing box',
          'the outlet is closed by a flap valve',
          'the outlet flap opens upward',
          'water can be lifted to any height above the pump',
        ],
        engravingEvidence:
          'Brown’s section shows a vertical barrel and suction pipe, a bottom check, a valved bucket, a piston rod through a packed top opening, an enclosed upper chamber bending into a tall delivery riser, and an oblique upward-opening flap in the enlarged outlet head.',
        reconstructionDisclosure:
          'Brown gives no bore, stroke, rod speed or force, stuffing pressure, valve lift, flap angle, delivery height, pressure, loss, leakage, or timing. Those values, the sinusoidal stroke, C2 check lobes, incompressible volume model, transparent cutaway, colors, tracer motion, and 4.8-second cycle are independently engineered. The preceding pump cycle, stuffing box, upward delivery flap, retained high column, and above-pump delivery are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 449',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      checkValveInterlock:
        'footOpen=deliveryOpen=max(cos(phi),0)^3 and bucketOpen=max(-cos(phi),0)^3; neither inlet nor delivery can overlap the bucket check.',
      stuffingBox:
        'The rod remains exactly on the barrel axis and translates through the fixed packing without changing length.',
      volumeBalance:
        'dV_lower/dt=Q_intake-Q_transfer and dV_upper/dt=Q_transfer-Q_delivery exactly, with Q_intake=Q_delivery=A*max(v,0) and Q_transfer=A*max(-v,0).',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.65, groundY, -1.55),
    new THREE.Vector3(2.35, 4.48, 1.55),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(6.1, 4.7, 10.5);
  root.userData.groundFloorY = groundY;
  correctLiftPumpParts(root, movement.id);
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredLiftPumpMovement(movement) {
  if (movement.id === 448) return commonLiftPump(movement);
  if (movement.id === 449) return modernLiftingPump(movement);
  return null;
}
