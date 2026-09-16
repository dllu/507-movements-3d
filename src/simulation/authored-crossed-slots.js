import { capsule, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_CYCLE = 8;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedCycleTime(time, period) {
  const cycles = time / period;
  if (Math.abs(cycles - Math.round(cycles)) < 1e-12) return 0;
  return positiveModulo(time, period);
}

function smootherStep01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (u * (u * 6 - 15) + 10);
}

function smootherStepFirstDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * u ** 2 * (u - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * u * (u - 1) * (2 * u - 1);
}

function capsuleShape(startX, endX, radius) {
  const shape = new THREE.Shape();
  shape.moveTo(startX, -radius);
  shape.lineTo(endX, -radius);
  shape.absarc(endX, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(startX, radius);
  shape.absarc(startX, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

function capsuleHole(startX, endX, radius) {
  const hole = new THREE.Path();
  hole.moveTo(startX, -radius);
  hole.absarc(startX, 0, radius, -Math.PI / 2, -Math.PI * 1.5, true);
  hole.lineTo(endX, radius);
  hole.absarc(endX, 0, radius, Math.PI / 2, -Math.PI / 2, true);
  hole.lineTo(startX, -radius);
  hole.closePath();
  return hole;
}

function centeredExtrusion(shape, depth, bevel = 0.025) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 36,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeAxialCylinder({
  depth,
  material,
  radius,
  role,
  segments = 56,
}) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  cylinder.userData.role = role;
  return cylinder;
}

function makeSlottedArm({
  depth,
  end,
  holeRadius,
  material,
  outerRadius,
  role,
  start,
  z,
}) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const shape = capsuleShape(-length / 2, length / 2, outerRadius);
  shape.holes.push(capsuleHole(-length / 2, length / 2, holeRadius));
  const arm = new THREE.Mesh(
    centeredExtrusion(shape, depth),
    material,
  );
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  arm.position.set(midpoint.x, midpoint.y, z);
  arm.rotation.z = Math.atan2(direction.y, direction.x);
  arm.userData.actualThroughSlot = true;
  arm.userData.holeRadius = holeRadius;
  arm.userData.localSlotEnd = end.clone();
  arm.userData.localSlotStart = start.clone();
  arm.userData.outerRadius = outerRadius;
  arm.userData.role = role;
  return arm;
}

function pointToLineResidual(point, start, end) {
  const direction = end.clone().sub(start);
  const offset = point.clone().sub(start);
  return (direction.x * offset.y - direction.y * offset.x)
    / direction.length();
}

function officialStrokeState(time, travel) {
  const cycleTime = wrappedCycleTime(time, FULL_CYCLE);
  const phase = cycleTime / FULL_CYCLE;
  const activeDuration = FULL_CYCLE * 0.4;

  if (phase <= 0.4) {
    const u = phase / 0.4;
    return {
      acceleration:
        travel * smootherStepSecondDerivative(u) / activeDuration ** 2,
      cycleTime,
      phase,
      segment: 'outward-traverse',
      value: travel * smootherStep01(u),
      velocity: travel * smootherStepFirstDerivative(u) / activeDuration,
    };
  }
  if (phase <= 0.5) {
    return {
      acceleration: 0,
      cycleTime,
      phase,
      segment: 'outer-dwell',
      value: travel,
      velocity: 0,
    };
  }
  if (phase <= 0.9) {
    const u = (phase - 0.5) / 0.4;
    return {
      acceleration:
        -travel * smootherStepSecondDerivative(u) / activeDuration ** 2,
      cycleTime,
      phase,
      segment: 'inward-traverse',
      value: travel * (1 - smootherStep01(u)),
      velocity: -travel * smootherStepFirstDerivative(u) / activeDuration,
    };
  }
  return {
    acceleration: 0,
    cycleTime,
    phase,
    segment: 'inner-dwell',
    value: 0,
    velocity: 0,
  };
}

function equalOppositeCrossedSlotTraverse(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.68);

  // The official animation publishes these endpoint coordinates. Recenter x
  // about 8.5 but retain its distances exactly: D travels 6 coordinate units
  // while each roller travels 2.797846 units in the opposite horizontal
  // direction from its mate.
  const sourceSymmetryX = 8.5;
  const sourcePinY = 11.250462;
  const innerHalfSpacing = sourceSymmetryX - 6.647792;
  const outerHalfSpacing = sourceSymmetryX - 3.849946;
  const yokeTravel = 6;
  const rollerTravel = outerHalfSpacing - innerHalfSpacing;
  const rollerToYokeRatio = rollerTravel / yokeTravel;
  const pinY = 2.2;
  const yokeStartY = -4;
  const slotTopY = pinY - yokeStartY;
  const slotBottomY = slotTopY - yokeTravel;
  const leftSlotTop = new THREE.Vector2(-innerHalfSpacing, slotTopY);
  const leftSlotBottom = new THREE.Vector2(-outerHalfSpacing, slotBottomY);
  const rightSlotTop = new THREE.Vector2(innerHalfSpacing, slotTopY);
  const rightSlotBottom = new THREE.Vector2(outerHalfSpacing, slotBottomY);
  const pinRadius = 0.5;
  const movingSlotRadius = 0.58;
  const fixedSlotHalfHeight = 0.58;
  const rollerRadius = 1.5;
  const yokeDepth = 0.32;
  const fixedFrameDepth = 0.34;
  const fixedFramePlaneZ = -0.38;
  const movingYokePlaneZ = 0.16;
  const axialPlateClearance = movingYokePlaneZ - yokeDepth / 2
    - (fixedFramePlaneZ + fixedFrameDepth / 2);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.56,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });

  const fixedSlotFrame = new THREE.Group();
  fixedSlotFrame.userData.actualOpenChannel = true;
  fixedSlotFrame.userData.fixed = true;
  fixedSlotFrame.userData.role = 'fixed-horizontal-parallel-sided-slot-c';
  root.add(fixedSlotFrame);

  const railLength = 12.6;
  const railThickness = 0.52;
  const railCenterX = 0;
  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(railLength, railThickness, fixedFrameDepth),
    frameMaterial,
  );
  topRail.position.set(
    railCenterX,
    pinY + fixedSlotHalfHeight + railThickness / 2,
    fixedFramePlaneZ,
  );
  topRail.userData.innerSurfaceY = pinY + fixedSlotHalfHeight;
  topRail.userData.role = 'fixed-slot-c-upper-rail';
  fixedSlotFrame.add(topRail);

  const bottomRail = new THREE.Mesh(
    new THREE.BoxGeometry(railLength, railThickness, fixedFrameDepth),
    frameMaterial,
  );
  bottomRail.position.set(
    railCenterX,
    pinY - fixedSlotHalfHeight - railThickness / 2,
    fixedFramePlaneZ,
  );
  bottomRail.userData.innerSurfaceY = pinY - fixedSlotHalfHeight;
  bottomRail.userData.role = 'fixed-slot-c-lower-rail';
  fixedSlotFrame.add(bottomRail);

  const leftMountShape = new THREE.Shape();
  leftMountShape.moveTo(-7.05, pinY - 1.58);
  leftMountShape.lineTo(-6.6, pinY - 1.58);
  leftMountShape.quadraticCurveTo(-6.42, pinY - 1.2, -6.34, pinY - 0.84);
  leftMountShape.lineTo(-6.34, pinY + 0.84);
  leftMountShape.quadraticCurveTo(-6.42, pinY + 1.2, -6.6, pinY + 1.58);
  leftMountShape.lineTo(-7.05, pinY + 1.58);
  leftMountShape.closePath();
  const leftMount = new THREE.Mesh(
    centeredExtrusion(leftMountShape, fixedFrameDepth, 0.018),
    frameMaterial,
  );
  leftMount.position.z = fixedFramePlaneZ;
  leftMount.userData.role = 'fixed-slot-c-left-machine-frame-mount';
  fixedSlotFrame.add(leftMount);

  const movingYoke = new THREE.Group();
  movingYoke.position.y = yokeStartY;
  movingYoke.userData.input = true;
  movingYoke.userData.role = 'vertically-translated-piece-d';
  root.add(movingYoke);

  const leftArm = makeSlottedArm({
    depth: yokeDepth,
    end: leftSlotTop,
    holeRadius: movingSlotRadius,
    material: driverMaterial,
    outerRadius: 0.91,
    role: 'piece-d-left-oblique-slotted-arm',
    start: leftSlotBottom,
    z: movingYokePlaneZ,
  });
  const rightArm = makeSlottedArm({
    depth: yokeDepth,
    end: rightSlotTop,
    holeRadius: movingSlotRadius,
    material: driverMaterial,
    outerRadius: 0.91,
    role: 'piece-d-right-oblique-slotted-arm',
    start: rightSlotBottom,
    z: movingYokePlaneZ,
  });
  movingYoke.add(leftArm, rightArm);

  // Cut the two complete slots through every yoke member, including the
  // crossbar/web at their lower ends. The prior separate boxes blocked the pins.
  const cutYokeRectangle = (width, height, centerY) => {
    const outline = poly([[-width / 2, centerY - height / 2],
      [width / 2, centerY - height / 2], [width / 2, centerY + height / 2],
      [-width / 2, centerY + height / 2]]);
    const holes = [[leftSlotBottom, leftSlotTop], [rightSlotBottom, rightSlotTop]]
      .map(([a, b]) => capsule(a.toArray(), b.toArray(), movingSlotRadius, 64));
    const geometry = plate(polygonClipping.difference(outline, ...holes),
      -yokeDepth / 2, yokeDepth / 2);
    geometry.translate(0, -centerY, 0);
    return geometry;
  };
  const crossbar = new THREE.Mesh(
    cutYokeRectangle(10.7, 0.55, 0),
    driverMaterial,
  );
  crossbar.position.set(0, 0, movingYokePlaneZ);
  crossbar.userData.role = 'piece-d-horizontal-yoke-crossbar';
  movingYoke.add(crossbar);

  const lowerWeb = new THREE.Mesh(
    cutYokeRectangle(9.9, 0.28, -0.41),
    driverMaterial,
  );
  lowerWeb.position.set(0, -0.41, movingYokePlaneZ);
  lowerWeb.userData.role = 'piece-d-lower-stiffening-web';
  movingYoke.add(lowerWeb);

  const inputBlock = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 1.1, yokeDepth * 1.18),
    driverMaterial,
  );
  inputBlock.position.set(0, -0.3, movingYokePlaneZ + 0.025);
  inputBlock.userData.role = 'piece-d-central-input-block';
  movingYoke.add(inputBlock);

  const inputStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 2.2, 24),
    inkMaterial,
  );
  inputStem.position.set(0, -1.75, movingYokePlaneZ);
  inputStem.userData.role = 'external-vertical-input-stem-for-piece-d';
  movingYoke.add(inputStem);

  const makeRoller = (side) => {
    const label = side === 'left' ? 'a' : 'b';
    const roller = new THREE.Group();
    roller.userData.rotationalIndex = false;
    roller.userData.role = `roller-${label}-translating-collar-and-pin`;
    root.add(roller);

    const rearFlange = makeAxialCylinder({
      depth: 0.2,
      material: drivenMaterial,
      radius: rollerRadius,
      role: `roller-${label}-rear-retaining-flange`,
      segments: 72,
    });
    rearFlange.position.z = fixedFramePlaneZ - fixedFrameDepth / 2 - 0.12;
    roller.add(rearFlange);

    const frontFlange = makeAxialCylinder({
      depth: 0.24,
      material: drivenMaterial,
      radius: rollerRadius,
      role: `roller-${label}-plain-front-flange-without-orientation-mark`,
      segments: 72,
    });
    frontFlange.position.z = movingYokePlaneZ + yokeDepth / 2 + 0.14;
    frontFlange.userData.hasRadialIndex = false;
    roller.add(frontFlange);

    const pin = makeAxialCylinder({
      depth: 1.38,
      material: inkMaterial,
      radius: pinRadius,
      role: `roller-${label}-pin-through-both-slots`,
      segments: 48,
    });
    pin.position.z = 0;
    pin.userData.constrainedBy = [
      'fixed-horizontal-slot-c',
      `piece-d-${side}-oblique-slot`,
    ];
    roller.add(pin);

    return { frontFlange, pin, rearFlange, roller };
  };

  const leftRoller = makeRoller('left');
  const rightRoller = makeRoller('right');

  const stateAtTime = (time) => {
    const input = officialStrokeState(time, yokeTravel);
    const leftX = -innerHalfSpacing - rollerToYokeRatio * input.value;
    const rightX = -leftX;
    const leftVelocity = -rollerToYokeRatio * input.velocity;
    const rightVelocity = -leftVelocity;
    const leftAcceleration = -rollerToYokeRatio * input.acceleration;
    const rightAcceleration = -leftAcceleration;
    const yokeY = yokeStartY + input.value;
    const leftPinInYoke = new THREE.Vector2(leftX, pinY - yokeY);
    const rightPinInYoke = new THREE.Vector2(rightX, pinY - yokeY);
    const leftMovingSlotResidual = pointToLineResidual(
      leftPinInYoke,
      leftSlotBottom,
      leftSlotTop,
    );
    const rightMovingSlotResidual = pointToLineResidual(
      rightPinInYoke,
      rightSlotBottom,
      rightSlotTop,
    );

    return {
      cycleTime: input.cycleTime,
      fixedSlotResiduals: {
        left: 0,
        right: 0,
      },
      leftRollerAcceleration: new THREE.Vector2(leftAcceleration, 0),
      leftRollerCenter: new THREE.Vector2(leftX, pinY),
      leftRollerVelocity: new THREE.Vector2(leftVelocity, 0),
      midpoint: new THREE.Vector2((leftX + rightX) / 2, pinY),
      movingSlotParameters: {
        left: 1 - input.value / yokeTravel,
        right: 1 - input.value / yokeTravel,
      },
      movingSlotResiduals: {
        left: leftMovingSlotResidual,
        right: rightMovingSlotResidual,
      },
      phase: input.phase,
      rightRollerAcceleration: new THREE.Vector2(rightAcceleration, 0),
      rightRollerCenter: new THREE.Vector2(rightX, pinY),
      rightRollerVelocity: new THREE.Vector2(rightVelocity, 0),
      segment: input.segment,
      yokeAcceleration: input.acceleration,
      yokeDisplacement: input.value,
      yokeVelocity: input.velocity,
      yokeY,
    };
  };

  const solidClearanceAtTime = (time) => {
    const state = stateAtTime(time);
    return {
      axialPlateClearance,
      fixedSlotNormalClearance: fixedSlotHalfHeight - pinRadius,
      leftRollerToRightRollerClearance:
        state.rightRollerCenter.x - state.leftRollerCenter.x
        - 2 * rollerRadius,
      movingSlotNormalClearance: movingSlotRadius - pinRadius,
      pinSpansBothConstraintPlanes: true,
    };
  };

  root.userData.archetype =
    'vertically-translated-twin-oblique-slot-yoke-driving-equal-and-opposite-horizontal-rollers';
  root.userData.blocks = {
    bottomRail,
    crossbar,
    fixedSlotFrame,
    inputBlock,
    inputStem,
    leftArm,
    leftMount,
    leftRoller: leftRoller.roller,
    leftRollerFrontFlange: leftRoller.frontFlange,
    leftRollerPin: leftRoller.pin,
    lowerWeb,
    movingYoke,
    rightArm,
    rightRoller: rightRoller.roller,
    rightRollerFrontFlange: rightRoller.frontFlange,
    rightRollerPin: rightRoller.pin,
    topRail,
  };
  root.userData.hideGround = true;
  root.traverse(object => {
    for (const material of [].concat(object.material ?? [])) material.fog = false;
  });
  root.userData.cameraDistanceScale = 0.95;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.15, -4.25, -0.9),
    new THREE.Vector3(5.15, 6.25, 0.9),
  );
  root.userData.geometry = {
    axialPlateClearance,
    fixedFrameDepth,
    fixedFramePlaneZ,
    fixedSlotHalfHeight,
    innerHalfSpacing,
    leftSlotBottom,
    leftSlotTop,
    movingSlotRadius,
    movingYokePlaneZ,
    outerHalfSpacing,
    pinRadius,
    pinY,
    rightSlotBottom,
    rightSlotTop,
    rollerRadius,
    rollerToYokeRatio,
    rollerTravel,
    sourcePinY,
    sourceSymmetryX,
    yokeDepth,
    yokeStartY,
    yokeTravel,
  };
  root.userData.mechanism =
    'vertical-piece-d-crosses-two-mirror-oblique-slots-with-fixed-horizontal-slot-c-to-place-rollers-a-and-b-equally-about-the-centerline';
  root.userData.rollerSpinConstraint = {
    renderedRadialIndex: false,
    status: 'indeterminate-without-loaded-face-and-bearing-detail',
    explanation:
      'the intersecting slots determine each pin center but do not identify a loaded rolling face or a bearing law, so no roller angular velocity can be inferred',
  };
  root.userData.solidClearanceAtTime = solidClearanceAtTime;
  root.userData.sourceAnimation = {
    available: true,
    coordinateWindow: [0, 0, 17, 17],
    officialEndpointCoordinates: {
      leftRollerEnd: [[3.849946, 11.250462], [4.349946, 11.250462]],
      leftRollerStart: [[6.647792, 11.250462], [7.147792, 11.250462]],
      rightRollerEnd: [[13.150054, 11.250462], [13.650054, 11.250462]],
      rightRollerStart: [[10.352208, 11.250462], [10.852208, 11.250462]],
      yokeEnd: [[14.357716, 8.5], [16.357716, 8.5]],
      yokeStart: [[14.357716, 2.5], [16.357716, 2.5]],
    },
    officialInterpolationKeyframes: [0, 0.4, 0.5, 0.9, 1],
    officialStateSequence: ['inner', 'outer', 'outer', 'inner', 'inner'],
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate252: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'two mirror-image oblique slots in translated piece D intersect one fixed horizontal slot C at roller pins A and B',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: true,
      rasterFixedSlotBounds: {
        bottom: 209,
        left: 20,
        right: 489,
        top: 115,
      },
      rasterInputDBounds: {
        bottom: 467,
        left: 264,
        right: 332,
        top: 391,
      },
      rasterRollers: [
        {
          centerX: 246,
          centerY: 154,
          innerRadius: 15,
          outerRadius: 52,
        },
        {
          centerX: 352,
          centerY: 154,
          innerRadius: 15,
          outerRadius: 52,
        },
      ],
      rasterYokeBounds: {
        bottom: 460,
        left: 91,
        right: 490,
        top: 100,
      },
      view:
        'front-elevation-through-fixed-horizontal-slot-oblique-yoke-slots-and-two-roller-pins',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 65,
      edition: 21,
      illustrationPage: 64,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleClosure: FULL_CYCLE,
    demonstrationPeriod: FULL_CYCLE,
    innerDwellEnd: FULL_CYCLE,
    inwardTraverseEnd: FULL_CYCLE * 0.9,
    inwardTraverseStart: FULL_CYCLE * 0.5,
    outerDwellEnd: FULL_CYCLE * 0.5,
    outwardTraverseEnd: FULL_CYCLE * 0.4,
    outwardTraverseStart: 0,
  };
  root.userData.transmission = {
    constraintCountPerRoller: 2,
    fixedGuide: 'horizontal-slot-c',
    input: 'vertical-translation-of-piece-d',
    output: 'equal-and-opposite-horizontal-translation-of-rollers-a-and-b',
    rollerToYokeDisplacementRatio: rollerToYokeRatio,
    speedLaw: 'xA=-1.852208-(2.797846/6)q; xB=-xA',
  };

  const update = (time) => {
    const state = stateAtTime(time);
    movingYoke.position.y = state.yokeY;
    leftRoller.roller.position.set(
      state.leftRollerCenter.x,
      state.leftRollerCenter.y,
      0,
    );
    rightRoller.roller.position.set(
      state.rightRollerCenter.x,
      state.rightRollerCenter.y,
      0,
    );
    // The source supplies no loaded rolling face or bearing construction.
    // Keep both collars unindexed and do not fabricate angular motion.
    leftRoller.roller.rotation.z = 0;
    rightRoller.roller.rotation.z = 0;
    root.userData.constraints = {
      fixedSlotC: state.fixedSlotResiduals,
      movingObliqueSlots: state.movingSlotResiduals,
    };
    root.userData.kinematics = state;
  };
  const sweptBounds = new THREE.Box3();
  for (const time of [0, FULL_CYCLE * 0.4]) {
    update(time);
    root.updateMatrixWorld(true);
    sweptBounds.union(new THREE.Box3().setFromObject(root));
  }
  root.userData.cameraFitBounds = sweptBounds.expandByScalar(0.02);
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(1.2, 0.6, 13),
  };
}

export function createAuthoredCrossedSlotMovement(movement) {
  if (movement.id !== 252) return null;
  const result = equalOppositeCrossedSlotTraverse(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
