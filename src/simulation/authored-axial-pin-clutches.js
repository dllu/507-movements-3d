import { correctAxialPinParts, finishOneWayFamily } from './one-way-clutch-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicMovingBelt,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);

function smootherStep(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return bounded * bounded * bounded
    * (bounded * (bounded * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * bounded * bounded
    * (bounded - 1) * (bounded - 1);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function signedAngleError(angle) {
  return positiveModulo(angle + Math.PI, FULL_TURN) - Math.PI;
}

function cylinderAlongX(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 28) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusNormalToX(majorRadius, tubeRadius, material, segments = 72) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 12, segments),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
}

class AxisXCircularArcCurve3 extends THREE.Curve {
  constructor(center, radius, startAngle, endAngle) {
    super();
    this.center = center.clone();
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
  }

  getPoint(value, target = new THREE.Vector3()) {
    const angle = THREE.MathUtils.lerp(
      this.startAngle,
      this.endAngle,
      THREE.MathUtils.clamp(value, 0, 1),
    );
    return target.set(
      this.center.x,
      this.center.y + this.radius * Math.cos(angle),
      this.center.z + this.radius * Math.sin(angle),
    );
  }

  getPointAt(value, target = new THREE.Vector3()) {
    return this.getPoint(value, target);
  }

  getTangent(value, target = new THREE.Vector3()) {
    const angle = THREE.MathUtils.lerp(
      this.startAngle,
      this.endAngle,
      THREE.MathUtils.clamp(value, 0, 1),
    );
    const direction = Math.sign(this.endAngle - this.startAngle) || 1;
    return target.set(
      0,
      -direction * Math.sin(angle),
      direction * Math.cos(angle),
    );
  }

  getTangentAt(value, target = new THREE.Vector3()) {
    return this.getTangent(value, target);
  }

  getLength() {
    return this.radius * Math.abs(this.endAngle - this.startAngle);
  }

  getLengths(divisions = 200) {
    const length = this.getLength();
    return Array.from(
      { length: divisions + 1 },
      (_, index) => length * index / divisions,
    );
  }

  getUtoTmapping(value) {
    return value;
  }
}

// One closed material path is used for the whole belt.  Each component is
// addressed by physical arc length, and both cubic free spans meet their
// pulley arcs with vertical tangents.  Consequently a material marker has no
// position or velocity discontinuity as it enters or leaves either pulley.
class AxiallySkewedOpenBeltCurve extends THREE.Curve {
  constructor({ lowerCenter, radius, upperCenter }) {
    super();
    const tangentHandle = Math.PI * radius / 3;
    const upperRight = new THREE.Vector3(
      upperCenter.x,
      upperCenter.y,
      upperCenter.z + radius,
    );
    const lowerRight = new THREE.Vector3(
      lowerCenter.x,
      lowerCenter.y,
      lowerCenter.z + radius,
    );
    const lowerLeft = new THREE.Vector3(
      lowerCenter.x,
      lowerCenter.y,
      lowerCenter.z - radius,
    );
    const upperLeft = new THREE.Vector3(
      upperCenter.x,
      upperCenter.y,
      upperCenter.z - radius,
    );
    const descendingSpan = new THREE.CubicBezierCurve3(
      upperRight,
      upperRight.clone().add(new THREE.Vector3(0, -tangentHandle, 0)),
      lowerRight.clone().add(new THREE.Vector3(0, tangentHandle, 0)),
      lowerRight,
    );
    const lowerWrap = new AxisXCircularArcCurve3(
      lowerCenter,
      radius,
      Math.PI / 2,
      Math.PI * 3 / 2,
    );
    const ascendingSpan = new THREE.CubicBezierCurve3(
      lowerLeft,
      lowerLeft.clone().add(new THREE.Vector3(0, tangentHandle, 0)),
      upperLeft.clone().add(new THREE.Vector3(0, -tangentHandle, 0)),
      upperLeft,
    );
    const upperWrap = new AxisXCircularArcCurve3(
      upperCenter,
      radius,
      Math.PI * 3 / 2,
      Math.PI * 5 / 2,
    );
    descendingSpan.arcLengthDivisions = 600;
    ascendingSpan.arcLengthDivisions = 600;
    this.components = [
      { name: 'descending-free-span', curve: descendingSpan },
      { name: 'lower-pulley-semicircular-wrap', curve: lowerWrap },
      { name: 'ascending-free-span', curve: ascendingSpan },
      { name: 'upper-pulley-semicircular-wrap', curve: upperWrap },
    ].map((component) => ({
      ...component,
      length: component.curve.getLength(),
    }));
    let cumulativeLength = 0;
    this.components.forEach((component) => {
      component.startDistance = cumulativeLength;
      cumulativeLength += component.length;
      component.endDistance = cumulativeLength;
    });
    this.totalLength = cumulativeLength;
    this.boundaryFractions = this.components
      .slice(0, -1)
      .map(({ endDistance }) => endDistance / this.totalLength);
    this.lowerCenter = lowerCenter.clone();
    this.radius = radius;
    this.upperCenter = upperCenter.clone();
  }

  componentAt(value) {
    const phase = THREE.MathUtils.clamp(value, 0, 1);
    const distance = phase * this.totalLength;
    const component = this.components.find(
      ({ endDistance }) => distance <= endDistance + 1e-12,
    ) ?? this.components.at(-1);
    const localDistance = THREE.MathUtils.clamp(
      distance - component.startDistance,
      0,
      component.length,
    );
    return {
      component,
      localPhase: component.length > 1e-12
        ? localDistance / component.length
        : 0,
    };
  }

  getPoint(value, target = new THREE.Vector3()) {
    const { component, localPhase } = this.componentAt(value);
    return component.curve.getPointAt(localPhase, target);
  }

  getPointAt(value, target = new THREE.Vector3()) {
    return this.getPoint(value, target);
  }

  getTangent(value, target = new THREE.Vector3()) {
    const { component, localPhase } = this.componentAt(value);
    return component.curve.getTangentAt(localPhase, target).normalize();
  }

  getTangentAt(value, target = new THREE.Vector3()) {
    return this.getTangent(value, target);
  }

  getLength() {
    return this.totalLength;
  }

  getLengths(divisions = 200) {
    return Array.from(
      { length: divisions + 1 },
      (_, index) => this.totalLength * index / divisions,
    );
  }

  getUtoTmapping(value) {
    return value;
  }
}

function addGroovedPulley({
  group,
  indexRole,
  material,
  radius,
  rolePrefix,
  width,
  whiteMaterial,
  darkMaterial,
  flangeRadius = 0.54,
}) {
  // Brown draws each pulley edge-on as two tall flanges with the rope
  // between them (as 255's flanged pulley): the flanges stand about 0.54
  // (his proportion) from the axis, well above the 0.038-radius rope on
  // the 0.46 pitch circle, so it cannot run off as the pulley shifts.
  const sheave = cylinderAlongX(radius * 0.88, width, material, 64);
  sheave.userData.role = `${rolePrefix}-solid-sheave`;
  group.add(sheave);
  const flanges = [-1, 1].map((side) => {
    const flange = cylinderAlongX(
      flangeRadius,
      0.055,
      material,
      64,
    );
    flange.position.x = side * (width / 2 - 0.020);
    flange.userData.role = `${rolePrefix}-belt-retaining-flange`;
    flange.userData.side = side;
    group.add(flange);
    return flange;
  });
  const groove = null;
  const hub = cylinderAlongX(0.17, width + 0.18, darkMaterial, 40);
  hub.userData.role = `${rolePrefix}-hub`;
  group.add(hub);
  // Brown draws no phase index on the pulleys.
  const index = null;
  return {
    flanges,
    groove,
    hub,
    index,
    sheave,
  };
}

function axialPinPulleyClutch(movement) {
  const root = new THREE.Group();

  const cyclePeriod = 12;
  const freeRunDuration = 3;
  const shiftDuration = 1.5;
  const upperCenter = new THREE.Vector3(0, 1.05, 0);
  const lowerCenter = new THREE.Vector3(0, -0.92, 0);
  const upperPitchRadius = 0.46;
  const lowerPitchRadius = 0.46;
  const pulleyRatio = upperPitchRadius / lowerPitchRadius;
  const pulleyWidth = 0.27;
  const disengagedPulleyX = 0.14;
  const engagedPulleyX = -0.10;
  const pulleyDogLength = 0.30;
  const pulleyDogRadius = 0.36;
  const shaftDogCenterX = -0.45;
  const shaftDogAxialWidth = 0.14;
  const shaftRadius = 0.085;
  const pinContactPhase = Math.asin(0.12 / pulleyDogRadius);
  const beltMarkerCount = 10;

  const dogIntervalsAtPulleyX = (pulleyX) => {
    const pulleyDog = {
      left: pulleyX - pulleyWidth / 2 - pulleyDogLength,
      right: pulleyX - pulleyWidth / 2,
    };
    const shaftDog = {
      left: shaftDogCenterX - shaftDogAxialWidth / 2,
      right: shaftDogCenterX + shaftDogAxialWidth / 2,
    };
    const overlap = Math.max(
      0,
      Math.min(pulleyDog.right, shaftDog.right)
        - Math.max(pulleyDog.left, shaftDog.left),
    );
    const clearance = pulleyDog.left > shaftDog.right
      ? pulleyDog.left - shaftDog.right
      : shaftDog.left > pulleyDog.right
        ? shaftDog.left - pulleyDog.right
        : 0;
    return {
      clearance,
      overlap,
      pulleyDog,
      shaftDog,
    };
  };

  const beltPathAtPulleyX = (pulleyX) => {
    const curve = new AxiallySkewedOpenBeltCurve({
      lowerCenter: new THREE.Vector3(
        pulleyX,
        lowerCenter.y,
        lowerCenter.z,
      ),
      radius: lowerPitchRadius,
      upperCenter,
    });
    return {
      boundaryFractions: [...curve.boundaryFractions],
      components: curve.components.map(({ length, name }) => ({
        length,
        name,
      })),
      curve,
      length: curve.getLength(),
      lowerCenter: curve.lowerCenter.clone(),
      upperCenter: curve.upperCenter.clone(),
    };
  };

  const engagedBeltLength = beltPathAtPulleyX(engagedPulleyX).length;
  const disengagedBeltLength = beltPathAtPulleyX(disengagedPulleyX).length;
  const beltLengthChange = disengagedBeltLength - engagedBeltLength;

  const stateAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    const cycleTime = time - cycleIndex * cyclePeriod;
    let driverAngleWithinCycle;
    let driverAngularSpeed;
    let outputAngleWithinCycle;
    let outputAngularSpeed;
    let pulleyAxialPosition;
    let pulleyAxialSpeed;
    let clutchMode;

    if (cycleTime < freeRunDuration) {
      const local = cycleTime / freeRunDuration;
      driverAngleWithinCycle = FULL_TURN * smootherStep(local);
      driverAngularSpeed = FULL_TURN
        * smootherStepDerivative(local) / freeRunDuration;
      outputAngleWithinCycle = 0;
      outputAngularSpeed = 0;
      pulleyAxialPosition = disengagedPulleyX;
      pulleyAxialSpeed = 0;
      clutchMode = 'disengaged-free-running';
    } else if (cycleTime < freeRunDuration + shiftDuration) {
      const local = (cycleTime - freeRunDuration) / shiftDuration;
      const progress = smootherStep(local);
      driverAngleWithinCycle = FULL_TURN;
      driverAngularSpeed = 0;
      outputAngleWithinCycle = 0;
      outputAngularSpeed = 0;
      pulleyAxialPosition = THREE.MathUtils.lerp(
        disengagedPulleyX,
        engagedPulleyX,
        progress,
      );
      pulleyAxialSpeed = (engagedPulleyX - disengagedPulleyX)
        * smootherStepDerivative(local) / shiftDuration;
      clutchMode = 'engaging-at-rest';
    } else if (cycleTime < freeRunDuration * 2 + shiftDuration) {
      const local = (
        cycleTime - freeRunDuration - shiftDuration
      ) / freeRunDuration;
      const progress = smootherStep(local);
      driverAngleWithinCycle = FULL_TURN + FULL_TURN * progress;
      driverAngularSpeed = FULL_TURN
        * smootherStepDerivative(local) / freeRunDuration;
      outputAngleWithinCycle = FULL_TURN * progress;
      outputAngularSpeed = driverAngularSpeed * pulleyRatio;
      pulleyAxialPosition = engagedPulleyX;
      pulleyAxialSpeed = 0;
      clutchMode = 'engaged-driving';
    } else if (cycleTime < freeRunDuration * 2 + shiftDuration * 2) {
      const local = (
        cycleTime - freeRunDuration * 2 - shiftDuration
      ) / shiftDuration;
      const progress = smootherStep(local);
      driverAngleWithinCycle = FULL_TURN * 2;
      driverAngularSpeed = 0;
      outputAngleWithinCycle = FULL_TURN;
      outputAngularSpeed = 0;
      pulleyAxialPosition = THREE.MathUtils.lerp(
        engagedPulleyX,
        disengagedPulleyX,
        progress,
      );
      pulleyAxialSpeed = (disengagedPulleyX - engagedPulleyX)
        * smootherStepDerivative(local) / shiftDuration;
      clutchMode = 'disengaging-at-rest';
    } else {
      const local = (
        cycleTime - freeRunDuration * 2 - shiftDuration * 2
      ) / freeRunDuration;
      driverAngleWithinCycle = FULL_TURN * 2
        + FULL_TURN * smootherStep(local);
      driverAngularSpeed = FULL_TURN
        * smootherStepDerivative(local) / freeRunDuration;
      outputAngleWithinCycle = FULL_TURN;
      outputAngularSpeed = 0;
      pulleyAxialPosition = disengagedPulleyX;
      pulleyAxialSpeed = 0;
      clutchMode = 'disengaged-free-running';
    }

    const driverAngle = cycleIndex * FULL_TURN * 3
      + driverAngleWithinCycle;
    const lowerPulleyAngle = driverAngle * pulleyRatio;
    const lowerPulleyAngularSpeed = driverAngularSpeed * pulleyRatio;
    const outputAngle = cycleIndex * FULL_TURN + outputAngleWithinCycle + pinContactPhase;
    const intervals = dogIntervalsAtPulleyX(pulleyAxialPosition);
    const dogAngularAlignmentError = Math.abs(signedAngleError(
      lowerPulleyAngle - outputAngle + pinContactPhase,
    ));
    const beltPath = beltPathAtPulleyX(pulleyAxialPosition);
    const pinsAxiallyOverlapping = intervals.overlap > 1e-9;
    const clutchTransmitting = clutchMode === 'engaged-driving';
    return {
      beltLength: beltPath.length,
      beltLinearSpeed: upperPitchRadius * driverAngularSpeed,
      beltPath,
      beltTravel: upperPitchRadius * driverAngle,
      clutchMode,
      clutchTransmitting,
      cycleIndex,
      cycleTime,
      dogAngularAlignmentError,
      dogAxialClearance: intervals.clearance,
      dogAxialOverlap: intervals.overlap,
      driverAngle,
      driverAngularSpeed,
      lowerPulleyAngle,
      lowerPulleyAngularSpeed,
      outputAngle,
      outputAngularSpeed,
      outputDirection: outputAngularSpeed > 1e-9
        ? 'same positive direction as both pulleys'
        : 'stationary under the display load',
      pinsAxiallyOverlapping,
      pulleyAxialPosition,
      pulleyAxialSpeed,
      safeShiftCondition: Math.abs(driverAngularSpeed) < 1e-9
        && Math.abs(outputAngularSpeed) < 1e-9
        && dogAngularAlignmentError < 1e-9,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.52,
  });
  const brassMaterial = matte(PALETTE.accent, {
    metalness: 0.31,
    roughness: 0.42,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-two-level-bearing-frame';
  // Brown's uprights run off the foot of the plate; no base is drawn.
  const framePosts = [-1.38, 1.38].map((x, index) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 3.12, 0.30),
      frameMaterial,
    );
    post.position.set(x, -0.08, -0.43);
    post.userData.role = index === 0
      ? 'left-two-bearing-upright'
      : 'right-two-bearing-upright';
    frame.add(post);
    return post;
  });
  const bearingBlocks = [];
  for (const x of [-1.38, 1.38]) {
    for (const y of [upperCenter.y, lowerCenter.y]) {
      const bearing = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.40, 0.40),
        frameMaterial,
      );
      bearing.position.set(x, y, -0.22);
      bearing.userData.role = 'fixed-shaft-bearing-block';
      frame.add(bearing);
      bearingBlocks.push(bearing);
    }
  }
  root.add(frame);

  const driverRotor = new THREE.Group();
  driverRotor.position.copy(upperCenter);
  driverRotor.userData.axis = X_AXIS.clone();
  driverRotor.userData.role =
    'upper-handwheel-shaft-and-driving-pulley-one-rotor';
  const driverShaft = cylinderAlongX(0.075, 3.72, darkMaterial, 32);
  driverShaft.userData.role = 'upper-continuous-driving-shaft';
  driverRotor.add(driverShaft);
  const upperPulley = addGroovedPulley({
    darkMaterial,
    group: driverRotor,
    indexRole: 'white-upper-driving-pulley-index',
    material: driverMaterial,
    radius: upperPitchRadius,
    rolePrefix: 'upper-driving-pulley',
    whiteMaterial,
    width: pulleyWidth,
  });
  // Brown draws the hand wheel edge-on as a heavy disk with a rounded rim
  // (about 0.9 radius and 0.3 thick at the plate's scale), not a spoked wheel.
  const handwheelRadius = 0.90;
  const handwheelThickness = 0.30;
  // The flat faces end just short of the rounded rim, so each face keeps
  // its own flat normal (a face vertex shared with the rim's first arc
  // segment shaded the whole face as a shallow dome).
  const faceEdge = handwheelRadius - handwheelThickness / 2;
  const handwheelProfile = [new THREE.Vector2(0, -handwheelThickness / 2),
    new THREE.Vector2(faceEdge - 0.002, -handwheelThickness / 2)];
  for (let step = 0; step <= 24; step += 1) {
    const angle = -Math.PI / 2 + Math.PI * step / 24;
    handwheelProfile.push(new THREE.Vector2(
      faceEdge + handwheelThickness / 2 * Math.cos(angle),
      handwheelThickness / 2 * Math.sin(angle),
    ));
  }
  handwheelProfile.push(new THREE.Vector2(faceEdge - 0.002, handwheelThickness / 2),
    new THREE.Vector2(0, handwheelThickness / 2));
  const handwheelRim = new THREE.Mesh(
    new THREE.LatheGeometry(handwheelProfile, 96),
    driverMaterial,
  );
  handwheelRim.rotation.z = Math.PI / 2;
  handwheelRim.position.x = -1.76;
  handwheelRim.userData.role = 'left-handwheel-fast-on-upper-shaft';
  driverRotor.add(handwheelRim);
  const handwheelSpokes = [];
  const crankArm = makeBeam(
    new THREE.Vector3(1.78, 0, 0),
    new THREE.Vector3(1.78, 0.44, 0),
    { color: PALETTE.driver, depth: 0.11, thickness: 0.10 },
  );
  crankArm.userData.role = 'right-hand-crank-fast-on-upper-shaft';
  driverRotor.add(crankArm);
  const crankHandle = cylinderAlongX(0.075, 0.34, darkMaterial, 28);
  crankHandle.position.set(1.94, 0.44, 0);
  crankHandle.userData.role = 'upper-shaft-crank-handle';
  driverRotor.add(crankHandle);
  root.add(driverRotor);

  const outputRotor = new THREE.Group();
  outputRotor.position.copy(lowerCenter);
  outputRotor.userData.axis = X_AXIS.clone();
  outputRotor.userData.role =
    'lower-output-shaft-and-radial-dog-one-rotor';
  const outputShaft = cylinderAlongX(shaftRadius, 3.62, darkMaterial, 32);
  outputShaft.userData.role =
    'lower-shaft-distinct-from-loose-sliding-pulley';
  outputRotor.add(outputShaft);
  const shaftDog = cylinderAlongY(
    0.060,
    pulleyDogRadius - shaftRadius + 0.05,
    brassMaterial,
    28,
  );
  shaftDog.position.set(
    shaftDogCenterX,
    (shaftRadius + pulleyDogRadius + 0.05) / 2,
    0,
  );
  shaftDog.scale.x = shaftDogAxialWidth / 0.12;
  shaftDog.userData.role = 'single-radial-pin-fast-on-lower-shaft';
  outputRotor.add(shaftDog);
  const outputIndex = null;
  root.add(outputRotor);

  const slidingPulley = new THREE.Group();
  slidingPulley.position.copy(lowerCenter);
  slidingPulley.userData.axis = X_AXIS.clone();
  slidingPulley.userData.role =
    'lower-belt-pulley-free-to-spin-and-slide-on-output-shaft';
  const lowerPulley = addGroovedPulley({
    darkMaterial,
    group: slidingPulley,
    indexRole: 'white-lower-free-pulley-index',
    material: drivenMaterial,
    radius: lowerPitchRadius,
    rolePrefix: 'lower-loose-sliding-pulley',
    whiteMaterial,
    width: pulleyWidth,
  });
  const pulleyDog = cylinderAlongX(
    0.060,
    pulleyDogLength,
    brassMaterial,
    28,
  );
  pulleyDog.position.set(
    -pulleyWidth / 2 - pulleyDogLength / 2,
    pulleyDogRadius,
    0,
  );
  pulleyDog.userData.role = 'single-axial-pin-fast-on-pulley-side';
  slidingPulley.add(pulleyDog);
  root.add(slidingPulley);

  const shiftCarrier = new THREE.Group();
  shiftCarrier.position.copy(lowerCenter);
  shiftCarrier.userData.role =
    'nonrotating-shift-collar-translating-with-lower-pulley';
  const shiftCollarOffsetX = pulleyWidth / 2 + 0.62;
  // Brown draws two separate narrow collars on the lower shaft with the
  // lever strap dropping between them: each collar is 0.12 thick with a 0.40
  // radius, 0.30 apart on a 0.19 hub that carries the fork prong.
  const spoolProfile = [
    [0.092, -0.27], [0.40, -0.27], [0.40, -0.15], [0.19, -0.15],
    [0.19, 0.15], [0.40, 0.15], [0.40, 0.27], [0.092, 0.27], [0.092, -0.27],
  ].map(([radius, axial]) => new THREE.Vector2(radius, axial));
  const shiftCollar = new THREE.Mesh(
    new THREE.LatheGeometry(spoolProfile, 72),
    brassMaterial,
  );
  shiftCollar.rotation.z = -Math.PI / 2;
  shiftCollar.position.x = shiftCollarOffsetX;
  shiftCollar.userData.role = 'fork-groove-collar-moving-pulley-axially';
  shiftCarrier.add(shiftCollar);
  // Thrust sleeve carrying the collar ring against the pulley hub face.
  const sleeveStart = pulleyWidth / 2 + 0.095;
  const sleeveEnd = shiftCollarOffsetX - 0.27;
  const shiftSleeve = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0.092, 0),
      new THREE.Vector2(0.15, 0),
      new THREE.Vector2(0.15, sleeveEnd - sleeveStart),
      new THREE.Vector2(0.092, sleeveEnd - sleeveStart),
      new THREE.Vector2(0.092, 0),
    ], 48),
    brassMaterial,
  );
  shiftSleeve.rotation.z = -Math.PI / 2;
  shiftSleeve.position.x = sleeveStart;
  shiftSleeve.userData.role = 'shift-sleeve-carrying-collar-against-pulley-hub';
  shiftCarrier.add(shiftSleeve);
  root.add(shiftCarrier);

  // Brown's operating lever hangs from a stud on the right upright: its eye
  // sits about 0.58 above the lower shaft, the strap hooks over to the left
  // and drops vertically past the shaft between two collars.  The lever is a
  // flat hooked strap turning about that stud; two fork pins behind the strap
  // straddle the shift collar ring, so the strap pushes the pulley axially.
  const leverPivot = new THREE.Vector3(
    (disengagedPulleyX + engagedPulleyX) / 2 + shiftCollarOffsetX + 0.50,
    lowerCenter.y + 0.58,
    0.42,
  );
  const leverStrapOffsetX = -0.50;
  const leverHookRadius = 0.30;
  const leverStrapBottom = -1.26;
  const leverStrapWidth = 0.13;
  const leverThickness = 0.07;
  const leverPivotPin = cylinderAlongZ(0.05, 0.42 + 0.28 + 0.06, darkMaterial, 28);
  leverPivotPin.position.set(leverPivot.x, leverPivot.y, (-0.28 + 0.48) / 2);
  leverPivotPin.userData.role = 'fixed-operating-lever-pivot';
  root.add(leverPivotPin);
  // The stud seats directly in the right upright's front face, as Brown
  // draws the lever eye at the upright's edge; no separate bracket.
  const leverRotor = new THREE.Group();
  leverRotor.position.copy(leverPivot);
  leverRotor.userData.role = 'hooked-operating-lever-turning-on-upright-stud';
  root.add(leverRotor);
  const leverCenterline = new THREE.Path();
  leverCenterline.moveTo(leverStrapOffsetX, leverStrapBottom);
  leverCenterline.lineTo(leverStrapOffsetX, -leverHookRadius);
  leverCenterline.absarc(
    leverStrapOffsetX + leverHookRadius,
    -leverHookRadius,
    leverHookRadius,
    Math.PI,
    Math.PI / 2,
    true,
  );
  leverCenterline.lineTo(-0.10, 0);
  const leverPoints = leverCenterline.getSpacedPoints(96);
  const halfWidth = leverStrapWidth / 2;
  const leftEdge = [];
  const rightEdge = [];
  leverPoints.forEach((point, index) => {
    const next = leverPoints[Math.min(index + 1, leverPoints.length - 1)];
    const previous = leverPoints[Math.max(index - 1, 0)];
    const tangent = next.clone().sub(previous).normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    leftEdge.push(point.clone().addScaledVector(normal, halfWidth));
    rightEdge.push(point.clone().addScaledVector(normal, -halfWidth));
  });
  const leverShape = new THREE.Shape([...leftEdge, ...rightEdge.reverse()]);
  const operatingLever = new THREE.Mesh(
    new THREE.ExtrudeGeometry(leverShape, {
      bevelEnabled: false,
      curveSegments: 48,
      depth: leverThickness,
    }),
    brassMaterial,
  );
  operatingLever.geometry.translate(0, 0, -leverThickness / 2);
  operatingLever.userData.role =
    'source-shown-operating-lever-with-sliding-fork-contact';
  leverRotor.add(operatingLever);
  const leverEyeShape = new THREE.Shape();
  leverEyeShape.absarc(0, 0, 0.125, 0, Math.PI * 2, false);
  const leverEyeHole = new THREE.Path();
  leverEyeHole.absarc(0, 0, 0.053, 0, Math.PI * 2, true);
  leverEyeShape.holes.push(leverEyeHole);
  const leverEye = new THREE.Mesh(
    new THREE.ExtrudeGeometry(leverEyeShape, {
      bevelEnabled: false,
      curveSegments: 48,
      depth: leverThickness,
    }),
    brassMaterial,
  );
  leverEye.geometry.translate(0, 0, -leverThickness / 2);
  leverEye.userData.role = 'operating-lever-eye-on-upright-stud';
  leverRotor.add(leverEye);
  // One fork prong reaches back from the strap into the collar groove,
  // below the shaft, at the strap line.
  const leverForkLocalY = lowerCenter.y - leverPivot.y - 0.30;
  const forkProngFront = -leverThickness / 2;
  const forkProngBack = 0.13 - leverPivot.z;
  const forkArms = [0].map((side) => {
    const arm = cylinderAlongZ(0.034, forkProngFront - forkProngBack, darkMaterial, 20);
    arm.position.set(
      leverStrapOffsetX,
      leverForkLocalY,
      (forkProngFront + forkProngBack) / 2,
    );
    arm.userData.role = 'fork-arm-running-in-shift-collar-groove';
    arm.userData.side = side;
    leverRotor.add(arm);
    return arm;
  });
  const leverHandle = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 16),
    darkMaterial,
  );
  leverHandle.position.set(leverStrapOffsetX, leverStrapBottom, 0);
  leverHandle.userData.role = 'manual-shift-lever-handle';
  leverRotor.add(leverHandle);
  const leverAngleForCollarX = (collarX) => {
    // Rotate the strap so its fork line (local x = offset, local y = fork
    // height) lands on the collar plane.
    const targetX = collarX - leverPivot.x;
    let low = -0.9;
    let high = 0.9;
    const forkX = (angle) => leverStrapOffsetX * Math.cos(angle)
      - leverForkLocalY * Math.sin(angle);
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (low + high) / 2;
      if ((forkX(middle) - targetX) * (forkX(low) - targetX) <= 0) {
        high = middle;
      } else {
        low = middle;
      }
    }
    return (low + high) / 2;
  };

  const initialState = stateAtTime(0);
  const belt = makeDynamicMovingBelt(initialState.beltPath.curve, {
    closed: true,
    color: PALETTE.belt,
    // Brown hatches the band as a laid rope; its lay shows the travel.
    laid: true,
    radius: 0.038,
    tubularSegments: 180,
  });
  belt.userData.markers = [];
  belt.userData.role =
    'single-open-belt-linking-upper-and-lower-equal-pitch-pulleys';
  belt.userData.pathContinuity = 'closed C1 tangent-continuous material path';
  root.add(belt);

  const updateLever = (pulleyX) => {
    leverRotor.rotation.z = leverAngleForCollarX(pulleyX + shiftCollarOffsetX);
  };

  const update = (time) => {
    const state = stateAtTime(time);
    driverRotor.rotation.x = state.driverAngle;
    outputRotor.rotation.x = state.outputAngle;
    slidingPulley.position.x = state.pulleyAxialPosition;
    slidingPulley.rotation.x = state.lowerPulleyAngle;
    shiftCarrier.position.x = state.pulleyAxialPosition;
    belt.userData.setCurve(state.beltPath.curve);
    belt.userData.updateDistance(state.beltTravel);
    updateLever(state.pulleyAxialPosition);
    root.userData.currentState = state;
  };

  root.userData = {
    archetype: 'axially-shifted-single-pin-pulley-clutch',
    beltGeometry: {
      beltLengthChange,
      beltPathAtPulleyX,
      disengagedLength: disengagedBeltLength,
      engagedLength: engagedBeltLength,
      note:
        'the source-inherent small axial skew changes the modeled centerline length slightly; the pulley shift is stopped and the flexible belt changes plane smoothly',
      pathContinuity:
        'the two cubic free spans and two semicircular wraps form one closed tangent-continuous curve parameterized by physical distance',
    },
    blocks: {
      bearingBlocks,
      belt,
      crankArm,
      crankHandle,
      driverRotor,
      driverShaft,
      forkArms,
      frame,
      framePosts,
      handwheelRim,
      handwheelSpokes,
      leverHandle,
      leverPivotPin,
      leverRotor,
      lowerPulley,
      operatingLever,
      outputIndex,
      outputRotor,
      outputShaft,
      pulleyDog,
      shaftDog,
      shiftCarrier,
      shiftCollar,
      slidingPulley,
      upperPulley,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 2,
      inputs:
        'upper shaft rotation and the independently operated axial clutch lever',
      note:
        'the lower pulley remains belt-constrained in both positions; the lower shaft is constrained to it only while the two pins overlap',
      storedEnergyStates: 0,
    },
    dogGeometry: {
      pinContactPhase,
      dogIntervalsAtPulleyX,
      engagedIntervals: dogIntervalsAtPulleyX(engagedPulleyX),
      disengagedIntervals: dogIntervalsAtPulleyX(disengagedPulleyX),
      pulleyDogLength,
      pulleyDogRadius,
      shaftDogAxialWidth,
      shaftDogCenterX,
    },
    dynamics: {
      disengagedOutputAssumption:
        'the source gives no inertia or load; the demonstration holds the disconnected output shaft still so engagement is unmistakable',
      sourceSpecifiesInertiaLoadOrTiming: false,
    },
    fidelity: 'authored',
    geometry: {
      beltMarkerCount,
      cyclePeriod,
      disengagedPulleyX,
      engagedPulleyX,
      freeRunDuration,
      lowerCenter: lowerCenter.clone(),
      lowerPitchRadius,
      pulleyRatio,
      pulleyWidth,
      shiftDuration,
      upperCenter: upperCenter.clone(),
      upperPitchRadius,
    },
    mechanism:
      'single-open-belt-driving-a-loose-axially-sliding-pulley-with-one-pin-clutch-to-a-distinct-lower-shaft',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate361: {
        handwheelCenter: new THREE.Vector2(43, 113),
        imageHeight: 525,
        imageWidth: 525,
        leftFramePostX: 105,
        leverPivot: new THREE.Vector2(378, 307),
        lowerPulleyCenter: new THREE.Vector2(242, 389),
        lowerPulleyRadiusPixels: 49,
        lowerShaftCenterY: 389,
        measurementUncertaintyPixels: 8,
        pulleyAxialPin: new THREE.Vector2(201, 333),
        rightFramePostX: 412,
        shaftRadialPin: new THREE.Vector2(161, 350),
        upperPulleyCenter: new THREE.Vector2(243, 110),
        upperPulleyRadiusPixels: 49,
        upperShaftCenterY: 110,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one pin is on the lower shaft',
          'one pin is on the side of the pulley',
          'the pulley moves lengthwise of the shaft',
          'a lever or other means brings the pins into or out of contact',
        ],
        engravingEvidence:
          'the plate shows one open belt, an upper hand-driven shaft, a narrow lower pulley sliding on a distinct shaft, and a forked operating lever',
        inference:
          'the nearly equal engraved pitch diameters imply equal same-direction pulley speed for the open belt; exact equality is the explicit display idealization',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod: cyclePeriod,
      disengageAtRest: [7.5, 9],
      engageAtRest: [3, 4.5],
      engagedDrive: [4.5, 7.5],
      freePulleyRuns: [[0, 3], [9, 12]],
      note:
        'Brown supplies no timing; this deliberately slow display stops aligned pins before either axial shift, avoiding an invented impact engagement',
    },
    transmission: {
      beltCount: 1,
      clutchLaw:
        'with axial overlap the pulley pin bears on the shaft pin and outputAngle = lowerPulleyAngle modulo one turn; without overlap the pulley runs freely around the stationary displayed output',
      directionLaw:
        'an open belt makes both pulleys turn in the same direction',
      equalRadiusLaw:
        'upperPitchRadius = lowerPitchRadius, so lowerPulleyAngularSpeed = driverAngularSpeed',
      noSlipLaw:
        'upperPitchRadius * driverAngularSpeed = lowerPitchRadius * lowerPulleyAngularSpeed',
      travelLaw:
        'belt material travel = upperPitchRadius * unbounded driver angle',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.12, -1.72, -0.72),
    new THREE.Vector3(2.18, 1.78, 0.84),
  );
  root.userData.groundFloorY = -1.70;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.1, 2.7, 8.4),
    root,
    update,
  };
}

export function createAuthoredAxialPinClutchMovement(movement) {
  if (movement.id === 361) {
    const model = finishOneWayFamily(correctAxialPinParts(axialPinPulleyClutch(movement)), 361);
    // Brown's plate is a flat front elevation of the frame, shafts and band.
    model.cameraDirection = new THREE.Vector3(-0.10, 0.02, 1);
    model.root.userData.cameraDirection = model.cameraDirection;
    // A long lens keeps the outboard hand wheel edge-on as Brown draws it.
    model.root.userData.cameraFov = 14;
    return model;
  }
  return null;
}
