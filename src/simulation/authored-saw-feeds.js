import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicLink,
  makeGear,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevelSize = 0.006) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 4,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function rotate2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * vector.x - sine * vector.y,
    sine * vector.x + cosine * vector.y,
  );
}

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function makeSawtoothRatchet({
  boreRadius,
  depth,
  innerRadius,
  mountPhase,
  outerRadius,
  rootRadius,
  teeth,
  toothOuterEndPhase,
  toothOuterStartPhase,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  const toothPitch = FULL_TURN / teeth;
  const profilePoints = [];
  const toothFaces = [];
  const shape = new THREE.Shape();
  for (let toothIndex = 0; toothIndex < teeth; toothIndex += 1) {
    const rootAngle = mountPhase + toothIndex * toothPitch;
    const outerStartAngle = rootAngle
      + toothOuterStartPhase * toothPitch;
    const outerEndAngle = rootAngle + toothOuterEndPhase * toothPitch;
    const nextRootAngle = rootAngle + toothPitch;
    const rootPoint = new THREE.Vector2(
      Math.cos(rootAngle) * rootRadius,
      Math.sin(rootAngle) * rootRadius,
    );
    const outerStart = new THREE.Vector2(
      Math.cos(outerStartAngle) * outerRadius,
      Math.sin(outerStartAngle) * outerRadius,
    );
    const outerEnd = new THREE.Vector2(
      Math.cos(outerEndAngle) * outerRadius,
      Math.sin(outerEndAngle) * outerRadius,
    );
    if (toothIndex === 0) shape.moveTo(rootPoint.x, rootPoint.y);
    else shape.lineTo(rootPoint.x, rootPoint.y);
    shape.lineTo(outerStart.x, outerStart.y);
    shape.lineTo(outerEnd.x, outerEnd.y);
    profilePoints.push(rootPoint, outerStart, outerEnd);
    const nextRoot = new THREE.Vector2(
      Math.cos(nextRootAngle) * rootRadius,
      Math.sin(nextRootAngle) * rootRadius,
    );
    toothFaces.push({
      outer: outerEnd,
      root: nextRoot,
      toothIndex,
    });
  }
  shape.closePath();
  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(centerHole);

  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.49,
  });
  const rim = new THREE.Mesh(
    centeredExtrusion(shape, depth, 0.003),
    wheelMaterial,
  );
  rim.userData.role = 'thirty-eight-tooth-saw-feed-ratchet-rim';
  rotor.add(rim);

  const hub = cylinderAlongZ(boreRadius + 0.22, depth * 1.28,
    darkMaterial, 36);
  hub.userData.role = 'ratchet-and-pinion-common-hub';
  rotor.add(hub);
  const bore = cylinderAlongZ(boreRadius, depth * 1.6,
    matte(PALETTE.frame, { metalness: 0.18, roughness: 0.54 }), 32);
  bore.userData.role = 'ratchet-shaft-visible-bore';
  rotor.add(bore);
  const spokeLength = innerRadius - boreRadius - 0.16;
  for (let index = 0; index < 4; index += 1) {
    const angle = Math.PI / 4 + index * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(spokeLength, 0.18, depth * 0.72),
      wheelMaterial,
    );
    const radius = boreRadius + 0.16 + spokeLength / 2;
    spoke.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    spoke.rotation.z = angle;
    spoke.userData.role = 'open-ratchet-wheel-spoke';
    rotor.add(spoke);
  }
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, outerRadius * 0.52, 0.025),
    matte(PALETTE.white, { roughness: 0.45 }),
  );
  indicator.position.set(0, outerRadius * 0.63, depth / 2 + 0.025);
  indicator.userData.role = 'white-ratchet-rotation-index';
  rotor.add(indicator);

  root.userData.axis = Z_AXIS.clone();
  root.userData.body = rim;
  root.userData.indicator = indicator;
  root.userData.profilePoints = profilePoints;
  root.userData.rotor = rotor;
  root.userData.teeth = teeth;
  root.userData.toothFaces = toothFaces;
  root.userData.toothPitch = toothPitch;
  return markShadows(root);
}

function makeDownwardRackTooth({ depth, pitch, toothHeight }) {
  const shape = new THREE.Shape();
  shape.moveTo(-pitch * 0.42, toothHeight / 2);
  shape.lineTo(-pitch * 0.19, -toothHeight / 2);
  shape.lineTo(pitch * 0.19, -toothHeight / 2);
  shape.lineTo(pitch * 0.42, toothHeight / 2);
  shape.closePath();
  return centeredExtrusion(shape, depth);
}

function crankRockerAdjustableSawFeed(movement) {
  const root = new THREE.Group();

  // The official page marks Movement 284's animation unavailable. All source
  // coordinates below are independently measured from Brown's public-domain
  // 525 px engraving; the motion follows the resulting closed four-bar and
  // pawl-contact geometry rather than a generic rack-and-pinion animation.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.0155;
  const sourceRasterRatchetCenter = new THREE.Vector2(140, 352);
  const sourceRasterRatchetOuterRight = new THREE.Vector2(247, 352);
  const sourceRasterBellCrankPivot = new THREE.Vector2(141, 122);
  const sourceRasterRockerJoint = new THREE.Vector2(465, 122);
  const sourceRasterInputShaft = new THREE.Vector2(454, 453);
  const sourceRasterCrankPin = new THREE.Vector2(389, 438);
  const sourceRasterPawlHinge = new THREE.Vector2(141, 187);
  const sourceRasterPawlContactDirection = 0.18;
  const sourceRasterRackLeft = new THREE.Vector2(194, 318);
  const sourceRasterRackRight = new THREE.Vector2(492, 318);
  const sourceRasterHoldingPawlPivot = new THREE.Vector2(73, 232);
  const sourceRasterLeftFrameTop = new THREE.Vector2(62, 81);
  const sourceRasterLeftFrameBottom = new THREE.Vector2(62, 499);
  const sourceRasterRightFrameBottom = new THREE.Vector2(455, 506);

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterRatchetCenter.x) * sourceScale,
    (sourceRasterRatchetCenter.y - y) * sourceScale,
  );
  const ratchetCenter = sourcePointToModel(sourceRasterRatchetCenter);
  const bellCrankPivot = sourcePointToModel(sourceRasterBellCrankPivot);
  const sourceRockerJoint = sourcePointToModel(sourceRasterRockerJoint);
  const inputShaft = sourcePointToModel(sourceRasterInputShaft);
  const sourceCrankPin = sourcePointToModel(sourceRasterCrankPin);
  const sourcePawlHinge = sourcePointToModel(sourceRasterPawlHinge);
  const rockerLength = bellCrankPivot.distanceTo(sourceRockerJoint);
  const crankRadius = inputShaft.distanceTo(sourceCrankPin);
  const connectingRodLength = sourceCrankPin.distanceTo(sourceRockerJoint);
  const groundLength = bellCrankPivot.distanceTo(inputShaft);
  const sourceInputAngle = Math.atan2(
    sourceCrankPin.y - inputShaft.y,
    sourceCrankPin.x - inputShaft.x,
  );
  const sourceRockerAngle = Math.atan2(
    sourceRockerJoint.y - bellCrankPivot.y,
    sourceRockerJoint.x - bellCrankPivot.x,
  );

  const fourBarAtInputAngle = (inputAngle) => {
    const crankPin = inputShaft.clone().add(new THREE.Vector2(
      Math.cos(inputAngle) * crankRadius,
      Math.sin(inputAngle) * crankRadius,
    ));
    const delta = crankPin.clone().sub(bellCrankPivot);
    const centerDistance = delta.length();
    const along = (
      rockerLength ** 2 - connectingRodLength ** 2 + centerDistance ** 2
    ) / (2 * centerDistance);
    const heightSquared = rockerLength ** 2 - along ** 2;
    if (heightSquared < -1e-10) {
      throw new RangeError('Movement 284 four-bar cannot close.');
    }
    const height = Math.sqrt(Math.max(0, heightSquared));
    const unit = delta.clone().multiplyScalar(1 / centerDistance);
    const normal = new THREE.Vector2(-unit.y, unit.x);
    const foot = bellCrankPivot.clone().addScaledVector(unit, along);
    const candidates = [
      foot.clone().addScaledVector(normal, height),
      foot.clone().addScaledVector(normal, -height),
    ];
    const rockerJoint = candidates[0].y >= candidates[1].y
      ? candidates[0]
      : candidates[1];
    const rockerVector = rockerJoint.clone().sub(bellCrankPivot);
    const connectingRodVector = rockerJoint.clone().sub(crankPin);
    const rockerAngle = Math.atan2(rockerVector.y, rockerVector.x);
    const connectingRodAngle = Math.atan2(
      connectingRodVector.y,
      connectingRodVector.x,
    );
    const inputPerpendicular = new THREE.Vector2(
      -Math.sin(inputAngle),
      Math.cos(inputAngle),
    );
    const rockerPerpendicular = new THREE.Vector2(
      -Math.sin(rockerAngle),
      Math.cos(rockerAngle),
    );
    const rodPerpendicular = new THREE.Vector2(
      -Math.sin(connectingRodAngle),
      Math.cos(connectingRodAngle),
    );
    const derivativeDenominator = rockerLength
      * cross2(rockerPerpendicular, rodPerpendicular);
    const rockerDerivative = crankRadius
      * cross2(inputPerpendicular, rodPerpendicular)
      / derivativeDenominator;
    return {
      connectingRodAngle,
      connectingRodClosureError: Math.abs(
        connectingRodVector.length() - connectingRodLength,
      ),
      crankPin,
      rockerAngle,
      rockerDerivative,
      rockerJoint,
      rockerLengthError: Math.abs(rockerVector.length() - rockerLength),
    };
  };

  const extremum = (lower, upper, maximize) => {
    let low = lower;
    let high = upper;
    for (let iteration = 0; iteration < 90; iteration += 1) {
      const first = (2 * low + high) / 3;
      const second = (low + 2 * high) / 3;
      const firstValue = fourBarAtInputAngle(first).rockerAngle;
      const secondValue = fourBarAtInputAngle(second).rockerAngle;
      if ((firstValue < secondValue) === maximize) low = first;
      else high = second;
    }
    const inputAngle = (low + high) / 2;
    return {
      inputAngle,
      rockerAngle: fourBarAtInputAngle(inputAngle).rockerAngle,
    };
  };
  const rockerMaximum = extremum(0, Math.PI, true);
  const rockerMinimum = extremum(Math.PI, FULL_TURN, false);
  const inputStartAngle = rockerMinimum.inputAngle;
  const inputEndAngle = rockerMaximum.inputAngle;
  const driveEndPhase = THREE.MathUtils.euclideanModulo(
    inputStartAngle - inputEndAngle,
    FULL_TURN,
  ) / FULL_TURN;
  const sourceCycleCoordinate = THREE.MathUtils.euclideanModulo(
    inputStartAngle - sourceInputAngle,
    FULL_TURN,
  ) / FULL_TURN;

  const ratchetTeeth = 38;
  const ratchetToothPitch = FULL_TURN / ratchetTeeth;
  const ratchetOuterRadius = sourcePointToModel(
    sourceRasterRatchetOuterRight,
  ).x;
  const ratchetRootRadius = ratchetOuterRadius - 0.19;
  const ratchetInnerRadius = ratchetOuterRadius * 0.62;
  const pawlNoseRadius = 0.085;
  const pawlContactCenterRadius = ratchetOuterRadius + pawlNoseRadius;
  const sourcePawlContactCenter = new THREE.Vector2(
    Math.cos(sourceRasterPawlContactDirection) * pawlContactCenterRadius,
    Math.sin(sourceRasterPawlContactDirection) * pawlContactCenterRadius,
  );
  const pawlPivotAt = (rockerAngle, sliderRadius) => bellCrankPivot.clone()
    .add(rotate2(new THREE.Vector2(0, -sliderRadius), rockerAngle));
  const pawlLengthForSliderRadius = (sliderRadius) => pawlPivotAt(
    sourceRockerAngle,
    sliderRadius,
  ).distanceTo(sourcePawlContactCenter);
  const pawlContactGeometry = (
    rockerAngle,
    sliderRadius,
    pawlLength,
    contactCenterRadius = pawlContactCenterRadius,
  ) => {
    const pawlPivot = pawlPivotAt(rockerAngle, sliderRadius);
    const centerDistance = pawlPivot.length();
    const lineAngle = Math.atan2(pawlPivot.y, pawlPivot.x);
    const cosine = (
      centerDistance ** 2 + contactCenterRadius ** 2 - pawlLength ** 2
    ) / (2 * centerDistance * contactCenterRadius);
    const triangleAngle = Math.acos(THREE.MathUtils.clamp(cosine, -1, 1));
    const contactAngle = lineAngle - triangleAngle;
    const pawlContactCenter = new THREE.Vector2(
      Math.cos(contactAngle) * contactCenterRadius,
      Math.sin(contactAngle) * contactCenterRadius,
    );
    const pawlVector = pawlContactCenter.clone().sub(pawlPivot);
    const pivotDerivative = rotate2(
      new THREE.Vector2(sliderRadius, 0),
      rockerAngle,
    );
    const distanceDerivative = pawlPivot.dot(pivotDerivative)
      / centerDistance;
    const lineAngleDerivative = cross2(pawlPivot, pivotDerivative)
      / centerDistance ** 2;
    const cosineDerivative = distanceDerivative
      / (2 * contactCenterRadius) * (
        1 - (
          contactCenterRadius ** 2 - pawlLength ** 2
        ) / centerDistance ** 2
      );
    const contactAngleDerivative = lineAngleDerivative
      + cosineDerivative / Math.sqrt(Math.max(1e-18, 1 - cosine ** 2));
    return {
      contactAngle,
      contactAngleDerivative,
      pawlAngle: Math.atan2(pawlVector.y, pawlVector.x),
      pawlContactCenter,
      pawlPivot,
      pawlVector,
    };
  };
  const pawlSweepAtSliderRadius = (sliderRadius) => {
    const pawlLength = pawlLengthForSliderRadius(sliderRadius);
    const start = pawlContactGeometry(
      rockerMinimum.rockerAngle,
      sliderRadius,
      pawlLength,
    );
    const end = pawlContactGeometry(
      rockerMaximum.rockerAngle,
      sliderRadius,
      pawlLength,
    );
    return start.contactAngle - end.contactAngle;
  };
  let lowerSliderRadius = 45 * sourceScale;
  let upperSliderRadius = 90 * sourceScale;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (lowerSliderRadius + upperSliderRadius) / 2;
    if (pawlSweepAtSliderRadius(middle) < ratchetToothPitch) {
      lowerSliderRadius = middle;
    } else {
      upperSliderRadius = middle;
    }
  }
  const sliderRadius = (lowerSliderRadius + upperSliderRadius) / 2;
  const pawlLength = pawlLengthForSliderRadius(sliderRadius);
  const driveStartContact = pawlContactGeometry(
    rockerMinimum.rockerAngle,
    sliderRadius,
    pawlLength,
  );
  const driveEndContact = pawlContactGeometry(
    rockerMaximum.rockerAngle,
    sliderRadius,
    pawlLength,
  );
  const pawlReturnLift = 0.17;
  const toothOuterStartPhase = 0.12;
  const toothOuterEndPhase = 0.25;
  const ratchetMountPhase = driveStartContact.contactAngle
    - toothOuterEndPhase * ratchetToothPitch;
  const inputCyclePeriod = 5;
  const inputAngularSpeed = -FULL_TURN / inputCyclePeriod;
  const pinionTeeth = 12;
  const pinionPitchRadius = 0.58;
  const pinionToothHeight = 0.16;
  const rackPitch = FULL_TURN * pinionPitchRadius / pinionTeeth;
  const rackToothCount = 19;
  const rackLength = rackPitch * rackToothCount;
  const sourceRackCenterX = 2.83;
  const boundaryEpsilon = 1e-12;

  const normalizedCoordinate = (coordinate) => {
    const nearest = Math.round(coordinate);
    return Math.abs(coordinate - nearest) < boundaryEpsilon
      ? nearest
      : coordinate;
  };
  const returnLiftAtProgress = (progress) => 16 * progress ** 2
    * (1 - progress) ** 2;
  const poseAtCycleCoordinate = (rawCoordinate) => {
    const cycleCoordinate = normalizedCoordinate(rawCoordinate);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const inputAngle = inputStartAngle - FULL_TURN * cycleCoordinate;
    const fourBar = fourBarAtInputAngle(inputAngle);
    const rockerAngularSpeed = fourBar.rockerDerivative
      * inputAngularSpeed;
    const driving = cyclePhase < driveEndPhase;
    let wheelAngle;
    let wheelAngularSpeed;
    let pawlGeometry;
    let returnClearance;
    let returnProgress;
    if (driving) {
      pawlGeometry = pawlContactGeometry(
        fourBar.rockerAngle,
        sliderRadius,
        pawlLength,
      );
      wheelAngle = -cycleIndex * ratchetToothPitch
        + pawlGeometry.contactAngle - driveStartContact.contactAngle;
      wheelAngularSpeed = pawlGeometry.contactAngleDerivative
        * rockerAngularSpeed;
      returnClearance = 0;
      returnProgress = 0;
    } else {
      returnProgress = (
        cyclePhase - driveEndPhase
      ) / (1 - driveEndPhase);
      returnClearance = pawlReturnLift
        * returnLiftAtProgress(returnProgress);
      pawlGeometry = pawlContactGeometry(
        fourBar.rockerAngle,
        sliderRadius,
        pawlLength,
        pawlContactCenterRadius + returnClearance,
      );
      wheelAngle = -(cycleIndex + 1) * ratchetToothPitch;
      wheelAngularSpeed = 0;
    }
    return {
      ...fourBar,
      activeToothIndex: THREE.MathUtils.euclideanModulo(
        cycleIndex,
        ratchetTeeth,
      ),
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      driving,
      inputAngle,
      inputAngularSpeed,
      pawlGeometry,
      returnClearance,
      returnProgress,
      rockerAngularSpeed,
      stage: driving
        ? 'adjustable-pawl-driving-one-ratchet-tooth'
        : 'pawl-lifted-over-return-wheel-dwell',
      wheelAngle,
      wheelAngularSpeed,
    };
  };
  const sourcePose = poseAtCycleCoordinate(sourceCycleCoordinate);
  const sourceWheelAngle = sourcePose.wheelAngle;
  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const pose = poseAtCycleCoordinate(cycleCoordinate);
    const contactNormal = pose.pawlGeometry.pawlContactCenter
      .clone().normalize();
    const pawlContactPoint = pose.pawlGeometry.pawlContactCenter
      .clone().addScaledVector(contactNormal, -pawlNoseRadius);
    const activeLocalContactAngle = driveStartContact.contactAngle
      + pose.cycleIndex * ratchetToothPitch;
    const ratchetContactPoint = new THREE.Vector2(
      Math.cos(activeLocalContactAngle + pose.wheelAngle)
        * ratchetOuterRadius,
      Math.sin(activeLocalContactAngle + pose.wheelAngle)
        * ratchetOuterRadius,
    );
    const rackX = sourceRackCenterX - pinionPitchRadius
      * (pose.wheelAngle - sourceWheelAngle);
    const rackSpeed = -pinionPitchRadius * pose.wheelAngularSpeed;
    const crankPinVelocity = new THREE.Vector2(
      -Math.sin(pose.inputAngle) * crankRadius * inputAngularSpeed,
      Math.cos(pose.inputAngle) * crankRadius * inputAngularSpeed,
    );
    const pawlPivotVelocity = rotate2(
      new THREE.Vector2(sliderRadius, 0),
      pose.rockerAngle,
    ).multiplyScalar(pose.rockerAngularSpeed);
    return {
      ...pose,
      crankPinVelocity,
      pawlContactError: pose.driving
        ? pawlContactPoint.distanceTo(ratchetContactPoint)
        : null,
      pawlContactPoint,
      pawlPivotVelocity,
      pinionRackNoSlipError: rackSpeed
        + pinionPitchRadius * pose.wheelAngularSpeed,
      rackDisplacement: rackX - sourceRackCenterX,
      rackSpeed,
      rackVelocity: new THREE.Vector3(rackSpeed, 0, 0),
      rackX,
      ratchetContactPoint,
      wheelTeethAdvanced: -(pose.wheelAngle - sourceWheelAngle)
        / ratchetToothPitch,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    sourceCycleCoordinate + time / inputCyclePeriod,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.57,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-saw-feed-frame-and-carriage-guides';
  root.add(frame);
  const leftTop = sourcePointToModel(sourceRasterLeftFrameTop);
  const leftBottom = sourcePointToModel(sourceRasterLeftFrameBottom);
  const rightBottom = sourcePointToModel(sourceRasterRightFrameBottom);
  const leftPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, leftTop.y - leftBottom.y, 0.52),
    frameMaterial,
  );
  leftPost.position.set(leftTop.x, (leftTop.y + leftBottom.y) / 2, -0.42);
  leftPost.userData.role = 'left-fixed-bellcrank-and-output-bearing-post';
  frame.add(leftPost);
  const rightPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 1.72, 0.52),
    frameMaterial,
  );
  rightPost.position.set(rightBottom.x, rightBottom.y + 0.86, -0.42);
  rightPost.userData.role = 'right-fixed-input-crank-bearing-post';
  frame.add(rightPost);
  const carriageGuide = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.22, 0.42),
    frameMaterial,
  );
  carriageGuide.position.set(2.2, -0.38, -0.42);
  carriageGuide.userData.role = 'fixed-horizontal-carriage-slide';
  frame.add(carriageGuide);
  for (const x of [-1.45, 4.85]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.18, 0.62),
      frameMaterial,
    );
    foot.position.set(x, -2.35, -0.4);
    foot.userData.role = 'saw-feed-frame-foot';
    frame.add(foot);
  }

  const pinion = makeGear({
    color: PALETTE.driven,
    depth: 0.28,
    radius: pinionPitchRadius,
    teeth: pinionTeeth,
    toothHeight: pinionToothHeight,
  });
  pinion.position.set(0, 0, -0.12);
  pinion.userData.role = 'coaxial-carriage-feed-pinion';
  root.add(pinion);

  const ratchet = makeSawtoothRatchet({
    boreRadius: 0.18,
    depth: 0.32,
    innerRadius: ratchetInnerRadius,
    mountPhase: ratchetMountPhase,
    outerRadius: ratchetOuterRadius,
    rootRadius: ratchetRootRadius,
    teeth: ratchetTeeth,
    toothOuterEndPhase,
    toothOuterStartPhase,
  });
  ratchet.position.z = 0.24;
  ratchet.userData.role = 'large-one-way-saw-feed-ratchet-wheel';
  root.add(ratchet);
  const outputShaft = cylinderAlongZ(0.16, 0.94, darkMaterial, 36);
  outputShaft.position.z = 0.02;
  outputShaft.userData.role = 'common-ratchet-and-pinion-output-shaft';
  root.add(outputShaft);

  const carriage = new THREE.Group();
  carriage.userData.role = 'translating-saw-bed-carriage-with-side-rack';
  root.add(carriage);
  const rackDepth = 0.28;
  const rackToothGeometry = makeDownwardRackTooth({
    depth: rackDepth,
    pitch: rackPitch,
    toothHeight: pinionToothHeight,
  });
  const rackTeeth = [];
  for (let index = 0; index < rackToothCount; index += 1) {
    const tooth = new THREE.Mesh(rackToothGeometry, drivenMaterial);
    tooth.position.set(
      (index - (rackToothCount - 1) / 2) * rackPitch,
      pinionPitchRadius,
      -0.13,
    );
    tooth.userData.index = index;
    tooth.userData.role = 'downward-facing-carriage-rack-tooth';
    rackTeeth.push(tooth);
    carriage.add(tooth);
  }
  const rackBody = new THREE.Mesh(
    new THREE.BoxGeometry(rackLength + 0.18, 0.18, rackDepth),
    drivenMaterial,
  );
  rackBody.position.set(0, pinionPitchRadius + 0.17, -0.13);
  rackBody.userData.role = 'carriage-side-rack-bar';
  carriage.add(rackBody);
  const carriageBed = new THREE.Mesh(
    new THREE.BoxGeometry(rackLength + 0.74, 0.54, 0.72),
    drivenMaterial,
  );
  carriageBed.position.set(0, pinionPitchRadius + 0.55, -0.36);
  carriageBed.userData.role = 'sawing-machine-translating-bed';
  carriage.add(carriageBed);
  for (const y of [pinionPitchRadius + 0.88, pinionPitchRadius + 1.06]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(rackLength + 0.62, 0.08, 0.11),
      darkMaterial,
    );
    rail.position.set(0, y, -0.14);
    rail.userData.role = 'saw-bed-top-guide-rail';
    carriage.add(rail);
  }
  const rackIndex = new THREE.Mesh(
    new THREE.BoxGeometry(rackPitch * 0.66, 0.04, rackDepth + 0.035),
    whiteMaterial,
  );
  rackIndex.position.set(-rackPitch / 2, pinionPitchRadius + 0.27, -0.13);
  rackIndex.userData.role = 'white-carriage-feed-translation-index';
  carriage.add(rackIndex);

  const bellCrank = new THREE.Group();
  bellCrank.position.set(bellCrankPivot.x, bellCrankPivot.y, 0);
  bellCrank.userData.axis = Z_AXIS.clone();
  bellCrank.userData.role = 'adjustable-right-angle-bell-crank-lever';
  root.add(bellCrank);
  const horizontalArm = makeBeam(
    new THREE.Vector3(0, 0, 0.55),
    new THREE.Vector3(rockerLength, 0, 0.55),
    {
      color: PALETTE.driven,
      depth: 0.18,
      thickness: 0.18,
    },
  );
  horizontalArm.userData.role = 'bell-crank-horizontal-rocker-arm';
  bellCrank.add(horizontalArm);
  const slotMinimumRadius = 43 * sourceScale;
  const slotMaximumRadius = 92 * sourceScale;
  const verticalArmLength = slotMaximumRadius + 0.31;
  const verticalArm = makeBeam(
    new THREE.Vector3(0, 0, 0.55),
    new THREE.Vector3(0, -verticalArmLength, 0.55),
    {
      color: PALETTE.driven,
      depth: 0.25,
      thickness: 0.38,
    },
  );
  verticalArm.userData.role = 'slotted-bell-crank-feed-adjustment-arm';
  bellCrank.add(verticalArm);
  const adjustmentSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, slotMaximumRadius - slotMinimumRadius,
      0.035),
    darkMaterial,
  );
  adjustmentSlot.position.set(
    0,
    -(slotMinimumRadius + slotMaximumRadius) / 2,
    0.705,
  );
  adjustmentSlot.userData.role = 'vertical-feed-adjustment-slot';
  bellCrank.add(adjustmentSlot);
  const adjustmentScrew = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055,
      slotMaximumRadius - slotMinimumRadius + 0.3, 18),
    accentMaterial,
  );
  adjustmentScrew.position.set(
    0,
    -(slotMinimumRadius + slotMaximumRadius) / 2 + 0.03,
    0.73,
  );
  adjustmentScrew.userData.role = 'feed-variation-screw';
  bellCrank.add(adjustmentScrew);
  const screwThreads = [];
  for (let index = 0; index < 11; index += 1) {
    const thread = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.012, 7, 20),
      darkMaterial,
    );
    thread.rotation.x = Math.PI / 2;
    thread.position.set(
      0,
      -slotMinimumRadius - index
        * (slotMaximumRadius - slotMinimumRadius) / 10,
      0.73,
    );
    thread.userData.role = 'feed-adjustment-screw-thread';
    screwThreads.push(thread);
    bellCrank.add(thread);
  }
  const screwKnob = cylinderAlongZ(0.16, 0.25, accentMaterial, 28);
  screwKnob.position.set(0, 0.22, 0.57);
  screwKnob.userData.role = 'feed-adjustment-screw-hand-knob';
  bellCrank.add(screwKnob);
  const slider = cylinderAlongZ(0.17, 0.46, darkMaterial, 30);
  slider.position.set(0, -sliderRadius, 0.6);
  slider.userData.role = 'screw-positioned-pawl-hinge-slider';
  bellCrank.add(slider);
  const rockerJointIndex = cylinderAlongZ(0.12, 0.32, whiteMaterial, 28);
  rockerJointIndex.position.set(rockerLength, 0, 0.58);
  rockerJointIndex.userData.role = 'white-rocker-joint-index';
  bellCrank.add(rockerJointIndex);
  const bellCrankBearing = cylinderAlongZ(0.18, 0.82, darkMaterial, 34);
  bellCrankBearing.position.set(bellCrankPivot.x, bellCrankPivot.y, 0.28);
  bellCrankBearing.userData.role = 'fixed-bell-crank-fulcrum-a';
  root.add(bellCrankBearing);

  const inputCrank = new THREE.Group();
  inputCrank.position.set(inputShaft.x, inputShaft.y, 0);
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role = 'continuously-revolving-lower-input-crank';
  root.add(inputCrank);
  const crankArm = makeBeam(
    new THREE.Vector3(0, 0, 0.58),
    new THREE.Vector3(crankRadius, 0, 0.58),
    {
      color: PALETTE.driver,
      depth: 0.20,
      thickness: 0.22,
    },
  );
  crankArm.userData.role = 'rigid-input-crank-arm';
  inputCrank.add(crankArm);
  const crankPin = cylinderAlongZ(0.14, 0.54, darkMaterial, 30);
  crankPin.position.set(crankRadius, 0, 0.58);
  crankPin.userData.role = 'input-crank-pin';
  inputCrank.add(crankPin);
  const crankIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 20, 13),
    whiteMaterial,
  );
  crankIndex.position.set(crankRadius * 0.56, 0, 0.72);
  crankIndex.userData.role = 'white-input-crank-rotation-index';
  inputCrank.add(crankIndex);
  const inputBearing = cylinderAlongZ(0.23, 0.86, darkMaterial, 36);
  inputBearing.position.set(inputShaft.x, inputShaft.y, 0.25);
  inputBearing.userData.role = 'fixed-lower-input-shaft-bearing';
  root.add(inputBearing);

  const connectingRod = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.18,
    jointRadius: 0.13,
    thickness: 0.15,
  });
  connectingRod.userData.role = 'crank-to-bellcrank-connecting-rod';
  root.add(connectingRod);

  const pawl = new THREE.Group();
  pawl.userData.axis = Z_AXIS.clone();
  pawl.userData.role = 'separately-hinged-adjustable-curved-feed-pawl';
  const pawlCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(pawlLength * 0.34, 0.13, 0),
    new THREE.Vector3(pawlLength * 0.76, 0.08, 0),
    new THREE.Vector3(pawlLength, 0, 0),
  ], false, 'centripetal');
  const pawlBody = new THREE.Mesh(
    new THREE.TubeGeometry(pawlCurve, 54, 0.09, 11, false),
    accentMaterial,
  );
  pawlBody.userData.role = 'curved-feed-catch-body';
  pawl.add(pawlBody);
  const pawlNose = cylinderAlongZ(pawlNoseRadius, 0.42, darkMaterial, 26);
  pawlNose.position.set(pawlLength, 0, 0);
  pawlNose.userData.role = 'rounded-feed-pawl-working-nose';
  pawl.add(pawlNose);
  const pawlIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    whiteMaterial,
  );
  pawlIndex.position.set(pawlLength * 0.73, 0.11, 0.11);
  pawlIndex.userData.role = 'white-pawl-motion-index';
  pawl.add(pawlIndex);
  root.add(pawl);

  const holdingPawlPivot = sourcePointToModel(
    sourceRasterHoldingPawlPivot,
  );
  const holdingPawlLength = 0.78;
  const holdingPawlBaseAngle = -1.03;
  const holdingPawl = new THREE.Group();
  holdingPawl.position.set(holdingPawlPivot.x, holdingPawlPivot.y, 0.48);
  holdingPawl.userData.axis = Z_AXIS.clone();
  holdingPawl.userData.role = 'fixed-pivot-anti-reverse-holding-pawl';
  const holdingBody = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(holdingPawlLength, 0, 0),
    {
      color: PALETTE.accent,
      depth: 0.14,
      thickness: 0.13,
    },
  );
  holdingBody.userData.role = 'holding-pawl-body';
  holdingPawl.add(holdingBody);
  const holdingPivotPin = cylinderAlongZ(0.11, 0.42, darkMaterial, 26);
  holdingPivotPin.userData.role = 'holding-pawl-fixed-pivot-pin';
  holdingPawl.add(holdingPivotPin);
  root.add(holdingPawl);

  const pawlContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 20, 13),
    whiteMaterial,
  );
  pawlContactMarker.position.z = 0.72;
  pawlContactMarker.userData.role = 'active-pawl-ratchet-contact-marker';
  root.add(pawlContactMarker);
  const rackContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 20, 13),
    whiteMaterial,
  );
  rackContactMarker.position.set(0, pinionPitchRadius, 0.18);
  rackContactMarker.userData.role = 'pinion-rack-pitch-contact-marker';
  root.add(rackContactMarker);

  const oneCycleStart = stateAtTime(0);
  const oneCycleEnd = stateAtTime(inputCyclePeriod);
  root.userData.archetype =
    'continuous-crank-bellcrank-adjustable-pawl-ratchet-pinion-carriage-rack';
  root.userData.blocks = {
    adjustmentScrew,
    adjustmentSlot,
    bellCrank,
    bellCrankBearing,
    carriage,
    carriageBed,
    connectingRod,
    crankArm,
    crankPin,
    frame,
    holdingPawl,
    horizontalArm,
    inputBearing,
    inputCrank,
    outputShaft,
    pawl,
    pawlBody,
    pawlContactMarker,
    pawlNose,
    pinion,
    rackBody,
    rackContactMarker,
    rackIndex,
    rackTeeth,
    ratchet,
    ratchetRotor: ratchet.userData.rotor,
    screwKnob,
    screwThreads,
    slider,
    verticalArm,
  };
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.05, -2.65, -0.9),
    new THREE.Vector3(6.15, 4.45, 1.0),
  );
  root.userData.feedAdjustment = {
    maximumSliderRadius: slotMaximumRadius,
    maximumSweptTeeth: pawlSweepAtSliderRadius(slotMaximumRadius)
      / ratchetToothPitch,
    minimumSliderRadius: slotMinimumRadius,
    minimumSweptTeeth: pawlSweepAtSliderRadius(slotMinimumRadius)
      / ratchetToothPitch,
    pawlSweepAtSliderRadius,
    selectedOutputTeethPerCycle: 1,
    selectedSliderRadius: sliderRadius,
    screwAction:
      'turning the vertical screw moves the pawl hinge along the bell-crank arm, changing its tangential sweep at the ratchet',
  };
  root.userData.fourBarAtInputAngle = fourBarAtInputAngle;
  root.userData.geometry = {
    connectingRodLength,
    crankRadius,
    driveEndContactAngle: driveEndContact.contactAngle,
    driveEndPhase,
    driveStartContactAngle: driveStartContact.contactAngle,
    groundLength,
    inputCyclePeriod,
    inputEndAngle,
    inputStartAngle,
    pawlContactCenterRadius,
    pawlLength,
    pawlNoseRadius,
    pawlReturnLift,
    pinionPitchRadius,
    pinionTeeth,
    rackLength,
    rackPitch,
    rackToothCount,
    ratchetInnerRadius,
    ratchetOuterRadius,
    ratchetRootRadius,
    ratchetTeeth,
    ratchetToothPitch,
    rockerLength,
    rockerMaximumAngle: rockerMaximum.rockerAngle,
    rockerMinimumAngle: rockerMinimum.rockerAngle,
    sliderRadius,
    sourceCycleCoordinate,
    sourceInputAngle,
    sourceRockerAngle,
    sourceScale,
    sourceWheelAngle,
  };
  root.userData.mechanism =
    'one continuously revolving lower crank closes one crank-rocker four-bar with the horizontal arm of a right-angle bell crank; the screw-positioned hinge on its vertical arm carries one separately pivoted catch, which drives the large ratchet exactly one tooth on the power swing and lifts clear while the ratchet dwells on return; the ratchet shaft carries one coaxial pinion whose pitch motion advances the saw-bed carriage rack without slip';
  root.userData.pawlContactGeometry = pawlContactGeometry;
  root.userData.pawlSweepAtSliderRadius = pawlSweepAtSliderRadius;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 284 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate284: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredPinionTeeth: pinionTeeth,
      inferredRatchetTeeth: ratchetTeeth,
      inferredTopology:
        'a lower crank and long connecting rod rock the horizontal arm about fulcrum a; its perpendicular slotted arm carries a screw-adjusted pawl hinge; the pawl indexes the large ratchet, and a smaller pinion on the same shaft meshes beneath the carriage rack',
      measurementUncertaintyPixels: 7,
      rasterBellCrankPivot: {
        x: sourceRasterBellCrankPivot.x,
        y: sourceRasterBellCrankPivot.y,
      },
      rasterCrankPin: {
        x: sourceRasterCrankPin.x,
        y: sourceRasterCrankPin.y,
      },
      rasterHoldingPawlPivot: {
        x: sourceRasterHoldingPawlPivot.x,
        y: sourceRasterHoldingPawlPivot.y,
      },
      rasterInputShaft: {
        x: sourceRasterInputShaft.x,
        y: sourceRasterInputShaft.y,
      },
      rasterLeftFrameBottom: {
        x: sourceRasterLeftFrameBottom.x,
        y: sourceRasterLeftFrameBottom.y,
      },
      rasterLeftFrameTop: {
        x: sourceRasterLeftFrameTop.x,
        y: sourceRasterLeftFrameTop.y,
      },
      rasterPawlHinge: {
        x: sourceRasterPawlHinge.x,
        y: sourceRasterPawlHinge.y,
      },
      rasterRackLeft: {
        x: sourceRasterRackLeft.x,
        y: sourceRasterRackLeft.y,
      },
      rasterRackRight: {
        x: sourceRasterRackRight.x,
        y: sourceRasterRackRight.y,
      },
      rasterRatchetCenter: {
        x: sourceRasterRatchetCenter.x,
        y: sourceRasterRatchetCenter.y,
      },
      rasterRatchetOuterRight: {
        x: sourceRasterRatchetOuterRight.x,
        y: sourceRasterRatchetOuterRight.y,
      },
      rasterRightFrameBottom: {
        x: sourceRasterRightFrameBottom.x,
        y: sourceRasterRightFrameBottom.y,
      },
      rasterRockerJoint: {
        x: sourceRasterRockerJoint.x,
        y: sourceRasterRockerJoint.y,
      },
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    driveEndPhase,
    inputCyclePeriod,
    returnFraction: 1 - driveEndPhase,
    schedule: [
      'crank-driven-pawl-power-swing-and-one-tooth-index',
      'crank-driven-pawl-click-return-with-output-dwell',
    ],
    sourceCycleCoordinate,
  };
  root.userData.transmission = {
    carriageAdvancePerInputTurn: oneCycleEnd.rackX - oneCycleStart.rackX,
    direction:
      'clockwise input crank, clockwise one-tooth ratchet-and-pinion index, rightward carriage feed',
    inputTurnsPerRatchetTurn: ratchetTeeth,
    oneToothIndexAngle: ratchetToothPitch,
    outputTeethPerInputTurn: oneCycleEnd.wheelTeethAdvanced
      - oneCycleStart.wheelTeethAdvanced,
    pinionRackNoSlipLaw:
      'rack-speed = -pinion-pitch-radius * common-shaft-angular-speed',
    returnStrokeWheelDwell: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCrank.rotation.z = state.inputAngle;
    bellCrank.rotation.z = state.rockerAngle;
    connectingRod.userData.setEndpoints(
      new THREE.Vector3(state.crankPin.x, state.crankPin.y, 0.48),
      new THREE.Vector3(
        state.rockerJoint.x,
        state.rockerJoint.y,
        0.48,
      ),
    );
    pawl.position.set(
      state.pawlGeometry.pawlPivot.x,
      state.pawlGeometry.pawlPivot.y,
      0.52,
    );
    pawl.rotation.z = state.pawlGeometry.pawlAngle;
    setSpin(ratchet, state.wheelAngle);
    setSpin(pinion, state.wheelAngle);
    carriage.position.x = state.rackX;
    holdingPawl.rotation.z = holdingPawlBaseAngle + (
      state.driving
        ? 0.075 * (0.5 - 0.5 * Math.cos(
          state.wheelAngle * ratchetTeeth,
        ))
        : 0
    );
    pawlContactMarker.visible = state.driving;
    pawlContactMarker.position.x = state.ratchetContactPoint.x;
    pawlContactMarker.position.y = state.ratchetContactPoint.y;
    inputCrank.userData.angularSpeed = state.inputAngularSpeed;
    bellCrank.userData.angularSpeed = state.rockerAngularSpeed;
    ratchet.userData.angularSpeed = state.wheelAngularSpeed;
    pinion.userData.angularSpeed = state.wheelAngularSpeed;
    carriage.userData.velocity = state.rackVelocity.clone();
    root.userData.contacts = {
      pawlRatchet: state.driving ? {
        activeToothIndex: state.activeToothIndex,
        contactError: state.pawlContactError,
        point: state.ratchetContactPoint.clone(),
      } : null,
      pawlReturnClearance: state.returnClearance,
      pinionRack: {
        active: true,
        noSlipError: state.pinionRackNoSlipError,
        pitchPoint: new THREE.Vector3(0, pinionPitchRadius, 0),
      },
    };
    root.userData.kinematics = state;
  };

  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(6.2, 4.4, 14),
  };
}

export function createAuthoredSawFeedMovement(movement) {
  if (movement.id !== 284) return null;
  const result = crankRockerAdjustableSawFeed(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
