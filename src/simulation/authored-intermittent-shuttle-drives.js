import * as THREE from 'three';
import { openCrescentShuttleLaw } from './open-crescent-shuttle-motion.js';
import crescent from './baked/open-crescent-shuttle.js';
import { capsule, circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import { boredCylinderGeometry } from './piston-guide-parts.js';
import { makeBoredPlanarLink } from './bored-planar-link.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeCrank({
  crankRadius,
  darkMaterial,
  driverMaterial,
  pinRadius,
  whiteMaterial,
}) {
  const crank = new THREE.Group();
  crank.userData.role =
    'constant-speed-input-crank-with-slot-roller-pin';
  // Brown draws an eyed crank arm, not a disk: a round boss on the shaft
  // tapering to a small eye carrying the slot pin.
  const disk = new THREE.Mesh(plate(polygonClipping.union(
    poly(circle([0, 0], 0.30, 96)),
    capsule([0, 0], [crankRadius, 0], 0.085, 32),
    poly(circle([crankRadius, 0], 0.12, 64)),
  ), 0.20, 0.38), driverMaterial);
  disk.userData.role = 'eyed-input-crank-arm';
  crank.add(disk);
  // Its end shows in the crank eye as Brown's shaft hole.
  const shaft = cylinderAlongZ(0.14, 0.80, darkMaterial, 28);
  shaft.position.z = -0.01;
  shaft.userData.role = 'fixed-axis-input-crankshaft';
  crank.add(shaft);
  // The arm is part of the eyed crank plate above.
  const arm = disk;
  // p89: the pin stands on the eye's front face (z 0.38) instead of running
  // down into the eye, whose radius it shares; the coincident walls z-fought.
  // Its front end is unchanged (z 0.61).
  const pin = cylinderAlongZ(pinRadius, 0.23, darkMaterial, 28);
  pin.position.set(crankRadius, 0, 0.495);
  pin.userData.role = 'crank-pin-running-in-synthesized-curved-slot';
  crank.add(pin);
  const pinIndex = cylinderAlongZ(pinRadius * 0.62, 0.10,
    whiteMaterial, 22);
  pinIndex.position.set(crankRadius, 0, 0.66);
  pinIndex.userData.role = 'white-index-on-slot-roller';
  crank.add(pinIndex);
  crank.userData.arm = arm;
  crank.userData.disk = disk;
  crank.userData.pin = pin;
  crank.userData.pinIndex = pinIndex;
  crank.userData.shaft = shaft;
  return markShadows(crank);
}

function makeSlottedRocker({
  darkMaterial,
  rockerMaterial,
  slotCurve,
  topJointLocal,
  whiteMaterial,
}) {
  const rocker = new THREE.Group();
  rocker.userData.role =
    'bottom-pivoted-rocker-carrying-one-open-crescent-cam-slot';
  const slotBody = new THREE.Mesh(plate(crescent.body,.40,.64),rockerMaterial);
  slotBody.userData.role='finite-open-crescent-channel-walls';rocker.add(slotBody);
  const slot=new THREE.Group();slot.userData.role='open-crescent-slot-void';rocker.add(slot);
  const lowerArm=new THREE.Mesh(plate(crescent.lower,.40,.64),rockerMaterial);
  lowerArm.userData.role='rocker-lower-arm-to-fixed-pivot';
  const upperArm=new THREE.Mesh(plate(crescent.upper,.40,.64),rockerMaterial);
  upperArm.userData.role='rocker-upper-arm-to-output-joint';rocker.add(lowerArm,upperArm);
  // Let the bearing caps and rim stand proud of the arm's coincident surfaces.
  const pivotHub = new THREE.Mesh(boredCylinderGeometry(.235,.147,.28),darkMaterial);pivotHub.rotation.x=Math.PI/2;
  pivotHub.position.z = 0.52;
  pivotHub.userData.role = 'fixed-bottom-rocker-pivot-bearing';
  const topJoint = cylinderAlongZ(0.15, 0.66, darkMaterial, 28);
  topJoint.position.set(topJointLocal.x, topJointLocal.y, 0.63);
  topJoint.userData.role = 'rocker-top-pin-to-finite-output-rod';
  const topJointIndex = cylinderAlongZ(0.075, 0.10, whiteMaterial, 22);
  topJointIndex.position.set(topJointLocal.x, topJointLocal.y, 1.00);
  topJointIndex.userData.role = 'white-index-on-rocker-output-pin';
  rocker.add(pivotHub, topJoint, topJointIndex);

  rocker.userData.lowerArm = lowerArm;
  rocker.userData.pivotHub = pivotHub;
  rocker.userData.slot = slot;
  rocker.userData.slotBody = slotBody;
  rocker.userData.slotCurve = slotCurve;
  rocker.userData.topJoint = topJoint;
  rocker.userData.topJointIndex = topJointIndex;
  rocker.userData.upperArm = upperArm;
  return markShadows(rocker);
}

function intermittentShuttleDrive(movement) {
  const root = new THREE.Group();

  // The source has one open crescent, not the previous synthesized closed loop.
  // Radius about the fixed rocker pivot selects a unique groove station.
  const cycleDuration = 6;
  // Plate: crank centre (381, 242) and pin (300, 195) px against the rocker
  // pivot (327, 407), at 79.7 px per unit (pivot to top joint 3.75). Brown's
  // slot stops 238 px from the pivot, but his crank would carry the pin to
  // 268 px (centre distance plus throw), and the slot must reach the pin.
  // The difference is shared: the centre stands 9 px left of and below his
  // (0.575, 0.02), the throw is 1.00 (his 1.18), and the pin is drawn 9 px
  // from his, so the slot's upper end runs 9 px past his stop, not 30.
  const crankCenter = new THREE.Vector2(0.575, 0.02);
  const rockerPivot = new THREE.Vector2(0, -2.00);
  const crankRadius = 1.00;
  const crankReferenceAngle = THREE.MathUtils.degToRad(145);
  const crankAngularSpeed = FULL_TURN / cycleDuration;
  const topJointRadius = 3.75;
  // Brown draws the rocker upright while it rests (his pose). The slot's
  // rest angle is a small lean, so the top joint is set back by it in the
  // rocker's frame: at rest the joint stands straight over the pivot.
  const restLean = crescent.parameters.restLean;
  const topJointLocal = new THREE.Vector2(
    topJointRadius * Math.sin(restLean),
    topJointRadius * Math.cos(restLean),
  );
  // Plate: the link runs level from the top joint to the table lug, eye
  // centre to eye centre 169 px (2.14 units) to its left, the joint about
  // 0.03 above the top joint. At the full swing (about 57 degrees) the top
  // joint falls 1.74 below the guide, so the link stays 36 degrees off
  // vertical.
  const guideY = rockerPivot.y + topJointRadius + 0.03;
  const connectingRodLength = 2.14;
  const pinRadius = 0.12;
  const sourcePoseLawPhase = 0.35;
  const slotSampleCount = 513;

  const openLaw=openCrescentShuttleLaw({crankCenter,rockerPivot,crankRadius,reference:crankReferenceAngle,period:cycleDuration});
  const rockerLawAtPhase=phase=>openLaw.atPhase(phase-sourcePoseLawPhase);
  const crankPinWorldAtPhase = (driverPhase) => crankCenter.clone().add(
    rotate2(
      new THREE.Vector2(crankRadius, 0),
      crankReferenceAngle + FULL_TURN * driverPhase,
    ),
  );
  const slotLocalAtDriverPhase = (driverPhase) => {
    const rockerState = rockerLawAtPhase(
      driverPhase + sourcePoseLawPhase,
    );
    return rotate2(
      crankPinWorldAtPhase(driverPhase).sub(rockerPivot),
      -rockerState.angle,
    );
  };
  const slotSamples=crescent.points.map(([x,y])=>new THREE.Vector3(x,y,.52));
  const slotCurve=new THREE.CatmullRomCurve3(slotSamples,false,'centripetal');
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.51,
  });
  const rockerMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.47,
  });
  const outputMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.53,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.65,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.42,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.38 });

  const crank = makeCrank({
    crankRadius,
    darkMaterial,
    driverMaterial,
    pinRadius,
    whiteMaterial,
  });
  crank.position.set(crankCenter.x, crankCenter.y, 0);
  root.add(crank);
  const rocker = makeSlottedRocker({
    darkMaterial,
    rockerMaterial,
    slotCurve,
    topJointLocal,
    whiteMaterial,
  });
  rocker.position.set(rockerPivot.x, rockerPivot.y, 0);
  root.add(rocker);

  const connectingRod = makeBoredPlanarLink({length:connectingRodLength,width:.15,eyeRadius:.21,boreRadius:.154,depth:.10},rockerMaterial);
  connectingRod.userData.role =
    'finite-link-from-rocker-top-to-horizontal-shuttle-slide';
  root.add(markShadows(connectingRod));
  const outputSlider = new THREE.Group();
  outputSlider.userData.role =
    'intermittently-reciprocating-horizontal-shuttle-carriage';
  // Brown draws the shuttle as one flat bar that runs from just behind the
  // link lug to beyond the rocker head.
  // Plate: 290 px long and 14 px deep, running at rest from 3.2 left of the
  // top joint to 0.69 right of it (fitted in the default view); the link
  // joint rests 2.14 left of the top joint.
  const shuttleBar = new THREE.Mesh(
    new THREE.BoxGeometry(3.89, 0.18, 0.28),
    outputMaterial,
  );
  shuttleBar.position.set(0.885, 0.38, 0);
  shuttleBar.userData.role = 'sewing-machine-or-printing-press-output-slide';
  // Brown's lug under the bar's left end: a round eye on the link pin with
  // a neck leaning up to the right into the bar's underside, one piece with
  // the bar and in its plane. The pin is fast in the lug and turns in the
  // link eye (bore 0.154) in front.
  const shuttleLug = new THREE.Mesh(plate(polygonClipping.difference(
    polygonClipping.union(
      poly(circle([0, 0], 0.24, 96)),
      poly([[-0.17, 0], [0.17, 0], [0.36, 0.30], [-0.10, 0.30]]),
    ),
    poly(circle([0, 0], 0.1515, 96)),
  ), -0.139, 0.139), outputMaterial);
  shuttleLug.userData.role = 'shuttle-bar-lug-carrying-link-pin';
  const sliderJoint = cylinderAlongZ(0.15, 0.58, darkMaterial, 28);
  sliderJoint.position.z = 0.28;
  sliderJoint.userData.role = 'output-rod-to-slider-pin';
  const outputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.32, 0.06),
    whiteMaterial,
  );
  outputIndex.position.set(-0.47, 0.38, 0.20);
  outputIndex.userData.role =
    'white-index-making-output-strokes-and-dwells-legible';
  outputSlider.add(shuttleBar, shuttleLug, sliderJoint, outputIndex);
  root.add(markShadows(outputSlider));

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-carrying-crank-rocker-and-horizontal-slide-guides';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.30, 0.22, 1.28),
    frameMaterial,
  );
  base.position.set(-1.0, -2.35, -0.32);
  base.userData.role = 'fixed-machine-base';
  fixedFrame.add(base);
  const rockerBoss = cylinderAlongZ(0.30, 0.20, frameMaterial, 34);
  rockerBoss.position.set(rockerPivot.x, rockerPivot.y, -0.24);
  rockerBoss.userData.role = 'fixed-rocker-bearing-boss';
  const crankBoss = cylinderAlongZ(0.30, 0.20, frameMaterial, 34);
  // Set back clear of the crank disk's rear face.
  crankBoss.position.set(crankCenter.x, crankCenter.y, -0.28);
  crankBoss.userData.role = 'fixed-crank-bearing-boss';
  fixedFrame.add(rockerBoss, crankBoss);
  for(const boss of [rockerBoss,crankBoss]){boss.geometry.dispose();boss.geometry=boredCylinderGeometry(.30,.144,.20);}
  const rockerShaft=cylinderAlongZ(.14,1.10,darkMaterial);rockerShaft.position.set(rockerPivot.x,rockerPivot.y,.18);fixedFrame.add(rockerShaft);
  const guideLength = 8.8;
  const guides = [-1, 1].map((side) => {
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(guideLength, 0.075, 0.12),
      darkMaterial,
    );
    guide.position.set(-.50, guideY + 0.38 + side * 0.15, .32);
    guide.userData.side = side;
    guide.userData.role = 'fixed-horizontal-shuttle-guide-rail';
    fixedFrame.add(guide);
    return guide;
  });
  // Minimal fixed supports in place of the long undrawn rails and bed:
  // Brown's grounded boss under the rocker pivot (a lug on a short ground
  // sill), one standard behind the mechanism carrying the crank bearing,
  // and a short channel guide on that standard. The guide sits where the
  // shuttle bar overlaps it at every point of its stroke, and its lower
  // lip stays behind the slider pin's path.
  {
    const standardX = crankCenter.x;
    const sill = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.20, 1.20), frameMaterial);
    sill.position.set(0.30, rockerPivot.y - 0.45, 0.15);
    sill.userData.role = 'fixed-ground-sill-under-rocker-foot';
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.30, 0.20), frameMaterial);
    lug.position.set(rockerPivot.x, rockerPivot.y - 0.20, -0.24);
    lug.userData.role = 'fixed-grounded-rocker-pivot-lug';
    const lowerStandard = new THREE.Mesh(new THREE.BoxGeometry(0.24, crankCenter.y - 0.28 - (rockerPivot.y - 0.35), 0.16), frameMaterial);
    lowerStandard.position.set(standardX, (crankCenter.y - 0.28 + rockerPivot.y - 0.35) / 2, -0.28);
    lowerStandard.userData.role = 'fixed-rear-standard-to-crank-bearing';
    const guideBottom = guideY + 0.38 - 0.23;
    const guideTop = guideY + 0.38 + 0.23;
    const upperStandard = new THREE.Mesh(new THREE.BoxGeometry(0.24, guideTop - (crankCenter.y + 0.28), 0.16), frameMaterial);
    upperStandard.position.set(standardX, (guideTop + crankCenter.y + 0.28) / 2, -0.28);
    upperStandard.userData.role = 'fixed-rear-standard-to-shuttle-guide';
    const guideLeft = 0.20;
    const guideRight = 1.60;
    const guideWidth = guideRight - guideLeft;
    const guideCenterX = (guideLeft + guideRight) / 2;
    const guideSpacer = new THREE.Mesh(new THREE.BoxGeometry(0.40, guideTop - guideBottom, 0.40), frameMaterial);
    guideSpacer.position.set(standardX, (guideTop + guideBottom) / 2, -0.16);
    guideSpacer.userData.role = 'fixed-shuttle-guide-bracket';
    const guideBack = new THREE.Mesh(new THREE.BoxGeometry(guideWidth, guideTop - guideBottom, 0.12), frameMaterial);
    guideBack.position.set(guideCenterX, (guideTop + guideBottom) / 2, 0.10);
    guideBack.userData.role = 'fixed-shuttle-guide-channel-back';
    const topLip = new THREE.Mesh(new THREE.BoxGeometry(guideWidth, 0.08, 0.38), frameMaterial);
    topLip.position.set(guideCenterX, guideY + 0.38 + 0.15, 0.35);
    topLip.userData.role = 'fixed-shuttle-guide-channel-top-lip';
    const bottomLip = new THREE.Mesh(new THREE.BoxGeometry(guideWidth, 0.08, 0.12), frameMaterial);
    bottomLip.position.set(guideCenterX, guideY + 0.38 - 0.15, 0.22);
    bottomLip.userData.role = 'fixed-shuttle-guide-channel-bottom-lip';
    fixedFrame.add(sill, lug, lowerStandard, upperStandard, guideSpacer, guideBack, topLip, bottomLip);
  }
  root.add(markShadows(fixedFrame));

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const inputAngle = crankReferenceAngle + FULL_TURN * cycleCoordinate;
    const inputPinWorld = crankCenter.clone().add(rotate2(
      new THREE.Vector2(crankRadius, 0),
      inputAngle,
    ));
    const rockerState = rockerLawAtPhase(
      cyclePhase + sourcePoseLawPhase,
    );
    const slotLocalPoint = rotate2(
      inputPinWorld.clone().sub(rockerPivot),
      -rockerState.angle,
    );
    const reconstructedPinWorld = rockerPivot.clone().add(rotate2(
      slotLocalPoint,
      rockerState.angle,
    ));
    const topJointWorld = rockerPivot.clone().add(rotate2(
      topJointLocal,
      rockerState.angle,
    ));
    const topJointAngle = rockerState.angle - restLean;
    const topJointVelocity = new THREE.Vector2(
      -topJointRadius * Math.cos(topJointAngle)
        * rockerState.angularSpeed,
      -topJointRadius * Math.sin(topJointAngle)
        * rockerState.angularSpeed,
    );
    const verticalDifference = guideY - topJointWorld.y;
    const horizontalReach = Math.sqrt(
      Math.max(0, connectingRodLength ** 2 - verticalDifference ** 2),
    );
    const sliderJointWorld = new THREE.Vector2(
      topJointWorld.x - horizontalReach,
      guideY,
    );
    const verticalDifferenceRate = -topJointVelocity.y;
    const sliderVelocity = topJointVelocity.x
      + verticalDifference * verticalDifferenceRate / horizontalReach;
    return {
      cycleCoordinate,
      cyclePhase,
      dwellActive: /rest/.test(rockerState.stage),
      inputAngle,
      inputAngularSpeed: crankAngularSpeed,
      inputPinWorld,
      lawPhase: rockerState.lawPhase,
      outputStage: rockerState.stage,
      reconstructedPinWorld,
      rockerAngle: rockerState.angle,
      rockerAngularAcceleration: rockerState.angularAcceleration,
      rockerAngularSpeed: rockerState.angularSpeed,
      sliderJointWorld,
      sliderVelocity,
      slotLocalPoint,
      slotPinClosureError: reconstructedPinWorld.distanceTo(inputPinWorld),
      strokeActive: /stroke/.test(rockerState.stage),
      topJointVelocity,
      topJointWorld,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    crank.rotation.z = state.inputAngle;
    rocker.rotation.z = state.rockerAngle;
    outputSlider.position.set(
      state.sliderJointWorld.x,
      state.sliderJointWorld.y,
      0.32,
    );
    connectingRod.userData.setEndpoints(
      new THREE.Vector3(state.topJointWorld.x, state.topJointWorld.y, 0.80),
      new THREE.Vector3(
        state.sliderJointWorld.x,
        state.sliderJointWorld.y,
        0.80,
      ),
    );
    root.userData.contacts = {
      crankPinToCurvedSlot: {
        active: true,
        drivingRocker: state.strokeActive,
        pinCenterWorld: state.inputPinWorld.clone(),
        reconstructedSlotPointWorld: state.reconstructedPinWorld.clone(),
        slotCenterlineError: state.slotPinClosureError,
      },
      outputRodToRocker: {
        active: true,
        joint: state.topJointWorld.clone(),
      },
      outputRodToSlider: {
        active: true,
        guideError: Math.abs(state.sliderJointWorld.y - guideY),
        joint: state.sliderJointWorld.clone(),
        lengthError: state.topJointWorld.distanceTo(
          state.sliderJointWorld,
        ) - connectingRodLength,
      },
    };
    root.userData.kinematics = state;
  };

  const fullStates=Array.from({length:2048},(_,i)=>stateAtTime(cycleDuration*i/2048));
  const rightSlider=Math.max(...fullStates.map(s=>s.sliderJointWorld.x));
  const leftSlider=Math.min(...fullStates.map(s=>s.sliderJointWorld.x));
  const dwellFraction=fullStates.filter(s=>s.dwellActive).length/fullStates.length;
  root.userData = {
    archetype:
      'constant-speed-crank-pin-in-synthesized-two-dwell-curved-slot-rocker-driving-finite-rod-shuttle',
    blocks: {
      base,
      connectingRod,
      crank,
      crankBoss,
      fixedFrame,
      guides,
      outputIndex,
      outputSlider,
      rocker,
      rockerShaft,
      rockerBoss,
      shuttleBar,
      sliderJoint,
    },
    constraintResiduals: {
      crankRadiusAtReference:crankPinWorldAtPhase(0).distanceTo(crankCenter)-crankRadius,
      slotCycleClosure:slotLocalAtDriverPhase(0).distanceTo(slotLocalAtDriverPhase(1)),
    },
    constraints: {
      crank:
        'The input crank turns continuously at constant angular speed and carries one roller at a fixed radius.',
      output:
        'A finite connecting rod joins the rocker top pin to a carriage constrained to one horizontal guide line.',
      rocker:
        'The rocker has one fixed bottom pivot and one rotational coordinate; the plain crescent gives a near-rest while the pin runs along it and a swing out and back on the other half turn.',
      slot:
        'One open crescent has monotone radius about the rocker pivot; the pin radius selects a station and its polar angle determines the rocker angle. The same finite slot is traversed forward and backward.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'rocker angle selected by slot profile',
        'finite-rod output carriage position',
      ],
      independentPrescribedInputs: 1,
      inputs: ['constant-speed crank angle'],
      note:
        'The slot closes the chain; while the pin runs along the crescent the rocker and shuttle nearly rest (a few degrees of creep, because the arc is slightly flatter than the crank circle).',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid crank, roller, grooved rocker, rod, carriage, and frame',
        'ideal centerline closure with .0015 finite roller/slot running clearance',
        'constant input angular speed',
        'a single circular arc slightly flatter than the crank circle meets the pin-radius circles at a finite angle at its ends, so rocker velocity stays continuous without end hooks',
        'inertia, friction, impact, elastic deformation, and load omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless positive-cam kinematic synthesis',
    },
    fidelity: 'authored',
    geometry: {
      connectingRodLength,
      crankCenter: crankCenter.clone(),
      crankRadius,
      crankReferenceAngle,
      guideY,
      leftSlider,
      pinRadius,
      rightSlider,
      rockerAmplitude:(Math.max(...fullStates.map(s=>s.rockerAngle))-Math.min(...fullStates.map(s=>s.rockerAngle)))/2,
      rockerPivot: rockerPivot.clone(),
      slotSampleCount,
      sourcePoseLawPhase,
      topJointLocal: topJointLocal.clone(),
      topJointRadius,
    },
    mechanism:
      'one-constant-speed-crank-roller-runs-in-one-curved-positive-cam-slot-on-a-bottom-pivoted-rocker-whose-top-pin-and-finite-rod-drive-one-horizontally-guided-shuttle-through-alternating-strokes-and-dwells',
    motion: {
      cycleDuration,
      inputDirection: 'counterclockwise continuously',
      dwellFraction,
      outputStroke: rightSlider - leftSlider,

    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 397 page marks Animated unavailable and provides only Brown’s static engraving.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate397: {
        crankCenterApproximatePixels: [381, 242],
        crankPinApproximatePixels: [300, 195],
        crankRadiusApproximatePixels: 94,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
        outputGuideApproximateYPixels: 81,
        rockerPivotApproximatePixels: [327, 407],
        rockerTopJointApproximatePixels: [327, 108],
      },
      constructionEvidence: {
        engravingEvidence:
          'The plate shows one fixed-axis crank and roller, one long curved slot in a bottom-pivoted rocker, a top joint, one finite horizontal link, and one guided rectilinear output bar.',
        explicitInBrownDescription: [
          'continuous circular input',
          'intermittent rectilinear reciprocating output',
          'used to drive sewing-machine shuttles',
          'also applied to three-revolution cylinder printing presses',
        ],
        reconstructionDisclosure:
          'Brown supplies no animation, dimensions, slot coordinates, dwell fractions, crank direction, or speed. The open crescent is one plain circular arc (sagitta 0.8 crank radius) with rounded ends, as drawn; dimensions, end continuation, centerline constraint, six-second timing and the resulting dwell fraction are reconstructed. No two-dwell motion is imposed independently of the groove.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 397',
    },
    slotSynthesis: {
      curve: slotCurve,
      localPointAtDriverPhase: slotLocalAtDriverPhase,
      law:
        'q(phi)=R(-theta(phi))*(C+r*[cos(phi),sin(phi)]-O)',
      samples: slotSamples.map((point, index) => ({
        radialFraction: index / (slotSamples.length-1),
        point: new THREE.Vector2(point.x, point.y),
      })),
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePoseLawPhase,
    },
    transmission: {
      outputLaw:
        'x=s_top.x-sqrt(Lrod^2-(yguide-s_top.y)^2)',
      slotLaw:
        'worldPin=O+R(theta)*q; q is fixed in the slotted rocker',
      stageSequence:
        'near-rest along the crescent -> rounded end -> working stroke and return through the same open crescent',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.45, -2.62, -0.72),
    new THREE.Vector3(5.85, 2.50, 1.08),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(0.25, 0.2, 16);
  root.userData.groundFloorY = -2.48;
  root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=cycleDuration;
  root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});
  root.userData.reconstructionNote = 'The source shows an open crescent, not a closed cam loop. It is one plain circular arc with rounded ends (no hooks), slightly flatter than the crank circle so the near-rest is entered and left without a knock; the pin follows the ideal channel centerline. Motion is prescribed, without solved friction, loads or clearance backlash.';
  root.userData.openCrescentLaw=openLaw;
  update(0);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredIntermittentShuttleDriveMovement(movement) {
  if (movement.id !== 397) return null;
  return intermittentShuttleDrive(movement);
}
