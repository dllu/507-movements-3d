import {correctVariableFaceGear} from './variable-face-gear-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeGear,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function unwrapNear(principalAngle, referenceAngle) {
  return principalAngle + FULL_TURN * Math.round(
    (referenceAngle - principalAngle) / FULL_TURN,
  );
}

function radialPoint(radius, angle) {
  return new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
}

function centeredExtrusion(shape, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    curveSegments: 2,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function annularSegmentShape(innerRadius, outerRadius, halfAngle) {
  const shape = new THREE.Shape();
  const segments = 24;
  for (let index = 0; index <= segments; index += 1) {
    const angle = -halfAngle + 2 * halfAngle * index / segments;
    const point = radialPoint(outerRadius, angle);
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  }
  for (let index = segments; index >= 0; index -= 1) {
    const angle = -halfAngle + 2 * halfAngle * index / segments;
    const point = radialPoint(innerRadius, angle);
    shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  return shape;
}

function expandingPulley(movement) {
  const root = new THREE.Group();
  const armCount = 6;
  const wheelTeeth = 32;
  const pinionTeeth = 10;
  const module = 0.096875;
  const wheelPitchRadius = module * wheelTeeth / 2;
  const pinionPitchRadius = module * pinionTeeth / 2;
  const gearCenterDistance = wheelPitchRadius + pinionPitchRadius;
  const slotMidRadius = 0.88;
  const slotSweep = 0.9;
  const slotRadialTravel = 0.62;
  const slotSlope = slotRadialTravel / slotSweep;
  const slotHalfWidth = 0.09;
  const adjustmentAmplitude = 0.31;
  const studRadius = 0.075;
  const studLength = 0.7;
  const studCenterZ = 0.15;
  const rimMidRadius = 2.84;
  const rimInnerRadius = 2.61;
  const rimOuterRadius = 3.03;
  const rimHalfAngle = THREE.MathUtils.degToRad(24.5);
  const wheelAngularFrequency = 0.72;
  const cyclePeriod = FULL_TURN / wheelAngularFrequency;

  const stateAtPhase = (phase, phaseRate = wheelAngularFrequency) => {
    const wheelAngle = adjustmentAmplitude * Math.sin(phase);
    const wheelAngularSpeed = adjustmentAmplitude * Math.cos(phase) * phaseRate;
    const radialOffset = -slotSlope * wheelAngle;
    const radialSpeed = -slotSlope * wheelAngularSpeed;
    const studRadius = slotMidRadius + radialOffset;
    const pulleyRadius = rimMidRadius + radialOffset;
    const pinionAngle = -wheelAngle * wheelTeeth / pinionTeeth;
    const pinionAngularSpeed = -wheelAngularSpeed * wheelTeeth / pinionTeeth;
    const slotStates = Array.from({ length: armCount }, (_, index) => {
      const guideAngle = index * FULL_TURN / armCount;
      const stud = radialPoint(studRadius, guideAngle);
      const cosine = Math.cos(-wheelAngle);
      const sine = Math.sin(-wheelAngle);
      const localStud = new THREE.Vector2(
        cosine * stud.x - sine * stud.y,
        sine * stud.x + cosine * stud.y,
      );
      const localAngle = unwrapNear(
        Math.atan2(localStud.y, localStud.x),
        guideAngle - wheelAngle,
      );
      const expectedLocalAngle = guideAngle - wheelAngle;
      const expectedRadius = slotMidRadius
        + slotSlope * (expectedLocalAngle - guideAngle);
      return {
        expectedLocalAngle,
        expectedRadius,
        guideAngle,
        localAngle,
        angularResidual: localAngle - expectedLocalAngle,
        guideResidual: Math.abs(
          stud.x * Math.sin(guideAngle) - stud.y * Math.cos(guideAngle)
        ),
        localRadius: localStud.length(),
        radialResidual: localStud.length() - expectedRadius,
        stud,
      };
    });
    const wheelContactPhase = (
      Math.PI / 2 - wheelAngle
    ) / (FULL_TURN / wheelTeeth);
    const pinionContactPhase = (
      -Math.PI / 2 - pinionAngle
    ) / (FULL_TURN / pinionTeeth);
    const meshPhaseSum = positiveModulo(
      wheelContactPhase + pinionContactPhase,
      1,
    );
    const wheelSurfaceSpeed = -wheelPitchRadius * wheelAngularSpeed;
    const pinionSurfaceSpeed = pinionPitchRadius * pinionAngularSpeed;
    return {
      gearNoSlipError: Math.abs(wheelSurfaceSpeed - pinionSurfaceSpeed),
      meshPhaseError: Math.abs(meshPhaseSum - 0.5),
      meshPhaseSum,
      phase,
      pinionAngle,
      pinionAngularSpeed,
      pulleyRadius,
      radialOffset,
      radialSpeed,
      slotStates,
      studRadius,
      wheelAngle,
      wheelAngularSpeed,
      wheelSurfaceSpeed,
      pinionSurfaceSpeed,
    };
  };
  const stateAtTime = (time) => stateAtPhase(
    time * wheelAngularFrequency,
    wheelAngularFrequency,
  );

  const driverMaterial = matte(PALETTE.driver, { metalness: 0.13, roughness: 0.58 });
  const drivenMaterial = matte(PALETTE.driven, { metalness: 0.12, roughness: 0.61 });
  const frameMaterial = matte(PALETTE.frame, { metalness: 0.13, roughness: 0.66 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.22, roughness: 0.49 });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const wheelGear = makeGear({
    color: PALETTE.driven,
    depth: 0.22,
    radius: wheelPitchRadius,
    teeth: wheelTeeth,
    toothHeight: module * 2.05,
  });
  wheelGear.position.z = -0.2;
  wheelGear.userData.role = 'thirty-two-tooth-adjusting-wheel-c';
  root.add(wheelGear);

  const slotPlateShape = new THREE.Shape();
  slotPlateShape.absarc(0, 0, wheelPitchRadius * 0.88, 0, FULL_TURN, false);
  const slotSampleCount = 30;
  const slotPaths = [];
  for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
    const baseAngle = armIndex * FULL_TURN / armCount;
    const hole = new THREE.Path();
    const centerline = [];
    for (let index = 0; index <= slotSampleCount; index += 1) {
      const offsetAngle = -slotSweep / 2 + slotSweep * index / slotSampleCount;
      const radius = slotMidRadius + slotSlope * offsetAngle;
      centerline.push(radialPoint(radius, baseAngle + offsetAngle));
      const point = radialPoint(radius + slotHalfWidth, baseAngle + offsetAngle);
      if (index === 0) hole.moveTo(point.x, point.y);
      else hole.lineTo(point.x, point.y);
    }
    for (let index = slotSampleCount; index >= 0; index -= 1) {
      const offsetAngle = -slotSweep / 2 + slotSweep * index / slotSampleCount;
      const radius = slotMidRadius + slotSlope * offsetAngle;
      const point = radialPoint(radius - slotHalfWidth, baseAngle + offsetAngle);
      hole.lineTo(point.x, point.y);
    }
    hole.closePath();
    slotPlateShape.holes.push(hole);
    slotPaths.push(centerline);
  }
  const slotPlate = new THREE.Mesh(centeredExtrusion(slotPlateShape, 0.18), drivenMaterial);
  slotPlate.position.z = 0.06;
  slotPlate.userData.cutThroughSlotCount = armCount;
  slotPlate.userData.role = 'wheel-c-with-six-real-spiral-slots';
  wheelGear.userData.rotor.add(slotPlate);

  const pinion = makeGear({
    color: PALETTE.driver,
    depth: 0.28,
    radius: pinionPitchRadius,
    teeth: pinionTeeth,
    toothHeight: module * 2.05,
  });
  pinion.position.set(0, gearCenterDistance, -0.18);
  pinion.userData.role = 'ten-tooth-hand-adjusting-pinion-d';
  root.add(pinion);

  const sliders = [];
  const studs = [];
  const rimSegments = [];
  const guides = [];
  for (let index = 0; index < armCount; index += 1) {
    const angle = index * FULL_TURN / armCount;
    const guide = new THREE.Group();
    guide.rotation.z = angle;
    const rails = [-0.105, 0.105].map((lateral) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.055, 0.12), frameMaterial);
      rail.position.set(1.52, lateral, 0.36);
      return rail;
    });
    guide.add(...rails);
    guide.userData.role = `fixed-radial-guide-${index}`;
    guides.push(guide);
    root.add(guide);

    const slider = new THREE.Group();
    slider.rotation.z = angle;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.16, 0.13), drivenMaterial);
    arm.position.set(1.72, 0, 0.5);
    arm.userData.role = `pulley-arm-${index}`;
    const rim = new THREE.Mesh(
      centeredExtrusion(annularSegmentShape(rimInnerRadius, rimOuterRadius, rimHalfAngle), 0.2),
      drivenMaterial,
    );
    rim.position.z = 0.5;
    rim.userData.role = `expanding-pulley-rim-segment-${index}`;
    const stud = new THREE.Mesh(
      new THREE.CylinderGeometry(
        studRadius,
        studRadius,
        studLength,
        24,
      ),
      darkMaterial,
    );
    stud.rotation.x = Math.PI / 2;
    stud.position.set(slotMidRadius, 0, studCenterZ);
    stud.userData.role = `slot-captive-arm-stud-${index}`;
    const studCap = new THREE.Mesh(new THREE.SphereGeometry(0.084, 18, 12), whiteMaterial);
    studCap.position.set(slotMidRadius, 0, 0.53);
    slider.add(arm, rim, stud, studCap);
    sliders.push(slider);
    studs.push(stud);
    rimSegments.push(rim);
    root.add(slider);
  }

  const centerShaft = makeShaft({ axis: Z_AXIS, color: PALETTE.ink, length: 1.45, radius: 0.12 });
  centerShaft.position.z = 0.03;
  centerShaft.userData.role = 'expanding-pulley-main-shaft';
  root.add(centerShaft);
  const pinionShaft = makeShaft({ axis: Z_AXIS, color: PALETTE.ink, length: 0.85, radius: 0.09 });
  pinionShaft.position.set(0, gearCenterDistance, -0.12);
  pinionShaft.userData.role = 'pinion-d-adjusting-shaft';
  root.add(pinionShaft);

  root.userData.archetype = 'six-arm-spiral-slot-expanding-pulley';
  root.userData.blocks = { centerShaft, guides, pinion, pinionShaft, rimSegments, sliders, slotPlate, studs, wheelGear };
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-3.35, -3.35, -0.9), new THREE.Vector3(3.35, 3.35, 1));
  root.userData.canonicalTimes = { contracted: cyclePeriod * 0.25, expanded: cyclePeriod * 0.75, sourcePose: 0, cycleClosure: cyclePeriod };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    adjustmentAmplitude,
    armCount,
    gearCenterDistance,
    module,
    pinionPitchRadius,
    pinionTeeth,
    rimMidRadius,
    slotEndArcClearance: (
      slotMidRadius - slotSlope * adjustmentAmplitude
    ) * (slotSweep / 2 - adjustmentAmplitude) - studRadius,
    slotHalfWidth,
    slotMidRadius,
    slotPaths,
    slotRadialTravel,
    slotSlope,
    slotSweep,
    studCenterZ,
    studLength,
    studRadius,
    wheelPitchRadius,
    wheelTeeth,
  };
  root.userData.mechanism = 'pinion-d-rotates-slotted-wheel-c-to-slide-six-pulley-arms-radially';
  root.userData.sourceAnimation = { available: false, independentlyReconstructed: true, reason: 'The official Movement 224 page marks its animation unavailable.', sourceUrl: movement.sourceUrl };
  root.userData.sourceReference = { officialDescription: movement.description, plate224: { imageHeight: 525, imageWidth: 525, inferredArmCount: 6, inferredPinionTeeth: pinionTeeth, inferredWheelTeeth: wheelTeeth, rasterMainCenter: new THREE.Vector2(263, 263), rasterPinionCenter: new THREE.Vector2(263, 118) }, sourceUrl: movement.sourceUrl };
  root.userData.stateAtPhase = stateAtPhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = { cyclePeriod, pinionToWheelRatio: -wheelTeeth / pinionTeeth, radialTravel: 2 * slotSlope * adjustmentAmplitude, reversibleAdjustment: true };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(wheelGear, state.wheelAngle);
    setSpin(centerShaft, state.wheelAngle);
    setSpin(pinion, state.pinionAngle);
    setSpin(pinionShaft, state.pinionAngle);
    sliders.forEach((slider) => { slider.position.set(Math.cos(slider.rotation.z) * state.radialOffset, Math.sin(slider.rotation.z) * state.radialOffset, 0); });
    wheelGear.userData.angularSpeed = state.wheelAngularSpeed;
    pinion.userData.angularSpeed = state.pinionAngularSpeed;
    root.userData.kinematics = state;
    root.userData.constraints = {
      gearNoSlipError: state.gearNoSlipError,
      maximumGuideResidual: Math.max(
        ...state.slotStates.map((slot) => slot.guideResidual),
      ),
      maximumSlotAngularResidual: Math.max(
        ...state.slotStates.map((slot) => Math.abs(slot.angularResidual)),
      ),
      maximumSlotRadialResidual: Math.max(
        ...state.slotStates.map((slot) => Math.abs(slot.radialResidual)),
      ),
      meshPhaseError: state.meshPhaseError,
    };
  };
  update(0);
  correctVariableFaceGear(root, 224);
  markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(1.6, -2, 12) };
}

export function createAuthoredExpandingPulleyMovement(movement) {
  if (movement.id === 224) return expandingPulley(movement);
  return null;
}
