import { correctDicksonParts, finishOneWayFamily } from './one-way-clutch-working-parts.js';
import * as THREE from 'three';
import { replaceWithLaidRope } from './laid-rope.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function smootherStep(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return bounded ** 3 * (bounded * (bounded * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * bounded ** 2 * (bounded - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * bounded * (2 * bounded ** 2 - 3 * bounded + 1);
}

function profile(start, span, duration, elapsed) {
  const unitTime = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
  return {
    acceleration: span * smootherStepSecondDerivative(unitTime)
      / duration ** 2,
    position: start + span * smootherStep(unitTime),
    speed: span * smootherStepDerivative(unitTime) / duration,
    unitTime,
  };
}

function rotatePoint(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector3(
    point.x * cosine - point.y * sine,
    point.x * sine + point.y * cosine,
    point.z,
  );
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function annularDiskAlongZ({
  depth,
  innerRadius,
  material,
  outerRadius,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(0.018, depth * 0.08),
    bevelThickness: Math.min(0.018, depth * 0.08),
    curveSegments: 96,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, material);
}

function extrudedShape(points, depth, material) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(0.025, depth * 0.14),
    bevelThickness: Math.min(0.025, depth * 0.14),
    curveSegments: 1,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, material);
}

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function makePawl({
  material,
  pawlLength,
  role,
  whiteMaterial,
}) {
  const pawl = new THREE.Group();
  pawl.userData.role = role;
  const body = extrudedShape([
    [0, -0.095],
    [pawlLength - 0.22, -0.095],
    [pawlLength, -0.015],
    [pawlLength, 0.040],
    [pawlLength - 0.22, 0.095],
    [0, 0.095],
  ], 0.15, material);
  body.userData.role = `${role}-rigid-body`;
  pawl.add(body);
  const hinge = cylinderAlongZ(0.12, 0.23, material, 28);
  hinge.userData.role = `${role}-hinge-eye`;
  pawl.add(hinge);
  const contact = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 14),
    whiteMaterial,
  );
  contact.position.x = pawlLength;
  contact.userData.role = `${role}-white-rim-contact-index`;
  pawl.add(contact);
  const cordEye = cylinderAlongZ(0.065, 0.22, material, 20);
  cordEye.position.x = pawlLength * 0.58;
  cordEye.userData.role = `${role}-cord-eye`;
  pawl.add(cordEye);
  pawl.userData.contact = contact;
  pawl.userData.cordEye = cordEye;
  return pawl;
}

function updateCylinderBetween(cylinder, start, end) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    Y_AXIS,
    delta.clone().multiplyScalar(1 / length),
  );
  cylinder.scale.set(1, length, 1);
}

// Brown's cords from crank E are laid cord: one continuous laid rope along
// the constant-material-length route (crank pin, sag point, pawl eye). Its
// start is tied to the crank pin, so arc length from there is a material
// coordinate and the lay needs no extra travel.
// Circular arc of length `length` from `start` to `end`, bulging toward
// `toward` (in the plane of the chord and that point). A taut cord is the
// straight chord.
class CordSag extends THREE.Curve {
  constructor(start, end, length, toward) {
    super();
    this.start = start.clone();this.end = end.clone();
    const chord = end.clone().sub(start), c = chord.length();
    const mid = start.clone().add(end).multiplyScalar(0.5);
    let side = toward.clone().sub(mid);
    side.addScaledVector(chord, -side.dot(chord) / (c * c));
    this.straight = side.lengthSq() < 1e-12 || length <= c * (1 + 1e-9);
    if (this.straight) return;
    side.normalize();
    // Half-angle t of the arc: sin(t) / t = c / length.
    let lo = 1e-9, hi = Math.PI;
    for (let i = 0; i < 60; i++) {const t = (lo + hi) / 2;if (Math.sin(t) / t > c / length) lo = t;else hi = t;}
    const t = (lo + hi) / 2, radius = length / (2 * t);
    this.center = mid.clone().addScaledVector(side, -radius * Math.cos(t));
    this.v = side.clone();
    this.radius = radius;this.halfAngle = t;
    this.axisX = chord.clone().normalize();
  }
  getPoint(s, target = new THREE.Vector3()) {
    if (this.straight) return target.copy(this.start).lerp(this.end, s);
    // The start lies at angle pi/2 + t from the centre, the end at pi/2 - t.
    const angle = Math.PI / 2 + this.halfAngle - 2 * this.halfAngle * s;
    return target.copy(this.center)
      .addScaledVector(this.axisX, this.radius * Math.cos(angle))
      .addScaledVector(this.v, this.radius * Math.sin(angle));
  }
}

function makeDynamicCord(material, role) {
  const cord = new THREE.Group();
  cord.userData.role = role;
  const rope = new THREE.Mesh(new THREE.BufferGeometry(), material);
  rope.userData.role = `${role}-laid-cord`;
  cord.add(rope);
  cord.userData.rope = rope;
  // Pass 57: the slack is a smooth circular sag of the cord's material
  // length on the bend side, not two straight runs meeting at a corner.
  cord.userData.setRoute = (route) => {
    const path = new CordSag(route.start, route.end, route.materialLength, route.bend);
    replaceWithLaidRope(rope, path, { radius: 0.024 });
    cord.userData.renderedLength = path.straight ? route.start.distanceTo(route.end) : 2 * path.halfAngle * path.radius;
  };
  return cord;
}

function makeDynamicRod(material) {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 1, 20),
    material,
  );
  rod.userData.role = 'constant-length-input-connecting-rod';
  rod.userData.setEndpoints = (start, end) => {
    updateCylinderBetween(rod, start, end);
  };
  return rod;
}

function constantLengthCordRoute(start, end, materialLength, sagSide) {
  const chord = end.clone().sub(start);
  const chordLength = chord.length();
  const halfChord = chordLength / 2;
  const sag = Math.sqrt(Math.max(
    0,
    (materialLength / 2) ** 2 - halfChord ** 2,
  ));
  // Sag sideways in the wheel's plane, square to the (possibly sloping) chord.
  const planar = Math.hypot(chord.x, chord.y);
  const perpendicular = new THREE.Vector3(
    -chord.y / planar,
    chord.x / planar,
    0,
  ).multiplyScalar(sag * sagSide);
  const bend = start.clone().add(end).multiplyScalar(0.5).add(perpendicular);
  return {
    bend,
    chordLength,
    end,
    materialLength,
    sag,
    segmentLengths: [start.distanceTo(bend), bend.distanceTo(end)],
    start,
    totalLength: start.distanceTo(bend) + bend.distanceTo(end),
  };
}

function dicksonReversibleDrive(movement) {
  const root = new THREE.Group();
  const cycleDuration = 12;
  const leverAmplitude = 0.38;
  const oscillationDuration = 4;
  const halfStrokeDuration = oscillationDuration / 2;
  const cOscillationStart = 0.5;
  const cOscillationEnd = cOscillationStart + oscillationDuration;
  const cToBShiftStart = 5;
  const cToBShiftDuration = 1;
  const cToBShiftEnd = cToBShiftStart + cToBShiftDuration;
  const bOscillationStart = 6.5;
  const bOscillationEnd = bOscillationStart + oscillationDuration;
  const bToCShiftStart = 10.75;
  const bToCShiftDuration = 0.75;
  const bToCShiftEnd = bToCShiftStart + bToCShiftDuration;
  const selectorAmplitude = 0.42;
  const maximumPawlLiftAngle = 0.48;
  const overrunLiftFraction = 0.24;
  const wheelOuterRadius = 2.12;
  const wheelInnerRadius = 1.82;
  const pawlContactPhase = 0.55;
  const bPawlPivot = new THREE.Vector3(-0.42, 0.10, 0.54);
  const cPawlPivot = new THREE.Vector3(0.42, 0.10, 0.54);
  const bSeatedContact = new THREE.Vector3(
    wheelInnerRadius * Math.cos(Math.PI - pawlContactPhase),
    wheelInnerRadius * Math.sin(Math.PI - pawlContactPhase),
    bPawlPivot.z,
  );
  const cSeatedContact = new THREE.Vector3(
    wheelInnerRadius * Math.cos(pawlContactPhase),
    wheelInnerRadius * Math.sin(pawlContactPhase),
    cPawlPivot.z,
  );
  const pawlLength = bPawlPivot.distanceTo(bSeatedContact);
  const bSeatedAngle = Math.atan2(
    bSeatedContact.y - bPawlPivot.y,
    bSeatedContact.x - bPawlPivot.x,
  );
  const cSeatedAngle = Math.atan2(
    cSeatedContact.y - cPawlPivot.y,
    cSeatedContact.x - cPawlPivot.x,
  );
  const pawlCordEyeRadius = pawlLength * 0.58;
  // Crank E as Brown draws it: a small bent crank standing on lever A's hub,
  // its journal running up the lever's centre line (in the plane of the
  // wheel), a short web, and a pin rising from the web's end. Both cords are
  // tied to the top of the pin. E turns half a turn about its journal: with
  // the pin to the right (Brown's pose) C's cord slackens and B's draws B off
  // the rim; with it to the left the reverse.
  const selectorCenter = new THREE.Vector3(0, 0.275, 0.47);
  const selectorHornRadius = 0.24; // crank throw
  const crankJournalTop = 0.52;
  const crankPinTop = 0.80;
  const cordEyeZ = 0.64;
  const crankTurn = (angle) => Math.PI / 2 * (1 - angle / selectorAmplitude);
  const crankPinPoint = (angle) => {
    const turn = crankTurn(angle);
    return new THREE.Vector3(selectorHornRadius * Math.cos(turn), crankPinTop,
      selectorCenter.z + selectorHornRadius * Math.sin(turn));
  };
  const inputPinLocal = new THREE.Vector3(0, -1.48, 0.35);
  const inputGuideY = -1.39;
  const inputRodLength = 2.60;

  const leverStrokeAtElapsed = (elapsed) => {
    if (elapsed <= halfStrokeDuration) {
      return {
        ...profile(
          -leverAmplitude,
          leverAmplitude * 2,
          halfStrokeDuration,
          elapsed,
        ),
        half: 'positive',
      };
    }
    return {
      ...profile(
        leverAmplitude,
        -leverAmplitude * 2,
        halfStrokeDuration,
        elapsed - halfStrokeDuration,
      ),
      half: 'negative',
    };
  };

  const basicStateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    let leverAngle = -leverAmplitude;
    let leverAngularSpeed = 0;
    let leverAngularAcceleration = 0;
    let wheelAngle = 0;
    let wheelAngularSpeed = 0;
    let wheelAngularAcceleration = 0;
    let selectorAngle = selectorAmplitude;
    let selectorAngularSpeed = 0;
    let selectorAngularAcceleration = 0;
    let bLiftFraction = 1;
    let cLiftFraction = 0;
    let selectedPawl = 'C';
    let drivingPawl = null;
    let stage = 'stationary-C-selected';

    if (cycleTime >= cOscillationStart
      && cycleTime < cOscillationEnd) {
      const stroke = leverStrokeAtElapsed(cycleTime - cOscillationStart);
      leverAngle = stroke.position;
      leverAngularSpeed = stroke.speed;
      leverAngularAcceleration = stroke.acceleration;
      if (stroke.half === 'positive') {
        wheelAngle = leverAngle + leverAmplitude;
        wheelAngularSpeed = leverAngularSpeed;
        wheelAngularAcceleration = leverAngularAcceleration;
        drivingPawl = 'C';
        stage = 'C-positive-driving-stroke';
      } else {
        wheelAngle = leverAmplitude * 2;
        const returnUnitTime = (cycleTime - cOscillationStart
          - halfStrokeDuration) / halfStrokeDuration;
        cLiftFraction = overrunLiftFraction
          * Math.sin(Math.PI * returnUnitTime) ** 2;
        stage = 'C-negative-overrunning-return';
      }
    } else if (cycleTime >= cOscillationEnd
      && cycleTime < cToBShiftStart) {
      wheelAngle = leverAmplitude * 2;
      stage = 'stationary-before-C-to-B-selection';
    } else if (cycleTime >= cToBShiftStart
      && cycleTime < cToBShiftEnd) {
      const shift = profile(
        selectorAmplitude,
        -selectorAmplitude * 2,
        cToBShiftDuration,
        cycleTime - cToBShiftStart,
      );
      const selectionProgress = smootherStep(shift.unitTime);
      wheelAngle = leverAmplitude * 2;
      selectorAngle = shift.position;
      selectorAngularSpeed = shift.speed;
      selectorAngularAcceleration = shift.acceleration;
      bLiftFraction = 1 - selectionProgress;
      cLiftFraction = selectionProgress;
      selectedPawl = 'between-C-and-B';
      stage = 'E-shifting-C-out-and-B-in-at-rest';
    } else if (cycleTime >= cToBShiftEnd
      && cycleTime < bOscillationStart) {
      wheelAngle = leverAmplitude * 2;
      selectorAngle = -selectorAmplitude;
      bLiftFraction = 0;
      cLiftFraction = 1;
      selectedPawl = 'B';
      stage = 'stationary-B-selected';
    } else if (cycleTime >= bOscillationStart
      && cycleTime < bOscillationEnd) {
      const stroke = leverStrokeAtElapsed(cycleTime - bOscillationStart);
      leverAngle = stroke.position;
      leverAngularSpeed = stroke.speed;
      leverAngularAcceleration = stroke.acceleration;
      wheelAngle = leverAmplitude * 2;
      selectorAngle = -selectorAmplitude;
      bLiftFraction = 0;
      cLiftFraction = 1;
      selectedPawl = 'B';
      if (stroke.half === 'positive') {
        const returnUnitTime = (cycleTime - bOscillationStart)
          / halfStrokeDuration;
        bLiftFraction = overrunLiftFraction
          * Math.sin(Math.PI * returnUnitTime) ** 2;
        stage = 'B-positive-overrunning-outstroke';
      } else {
        wheelAngle = leverAmplitude + leverAngle;
        wheelAngularSpeed = leverAngularSpeed;
        wheelAngularAcceleration = leverAngularAcceleration;
        drivingPawl = 'B';
        stage = 'B-negative-driving-stroke';
      }
    } else if (cycleTime >= bOscillationEnd
      && cycleTime < bToCShiftStart) {
      selectorAngle = -selectorAmplitude;
      bLiftFraction = 0;
      cLiftFraction = 1;
      selectedPawl = 'B';
      stage = 'stationary-before-B-to-C-selection';
    } else if (cycleTime >= bToCShiftStart
      && cycleTime < bToCShiftEnd) {
      const shift = profile(
        -selectorAmplitude,
        selectorAmplitude * 2,
        bToCShiftDuration,
        cycleTime - bToCShiftStart,
      );
      const selectionProgress = smootherStep(shift.unitTime);
      selectorAngle = shift.position;
      selectorAngularSpeed = shift.speed;
      selectorAngularAcceleration = shift.acceleration;
      bLiftFraction = selectionProgress;
      cLiftFraction = 1 - selectionProgress;
      selectedPawl = 'between-B-and-C';
      stage = 'E-returning-B-out-and-C-in-at-rest';
    } else if (cycleTime >= bToCShiftEnd) {
      stage = 'stationary-C-selected-cycle-dwell';
    }

    const bPawlAngle = bSeatedAngle
      - maximumPawlLiftAngle * bLiftFraction;
    const cPawlAngle = cSeatedAngle
      + maximumPawlLiftAngle * cLiftFraction;
    const bPawlTipLocal = bPawlPivot.clone().add(new THREE.Vector3(
      pawlLength * Math.cos(bPawlAngle),
      pawlLength * Math.sin(bPawlAngle),
      0,
    ));
    const cPawlTipLocal = cPawlPivot.clone().add(new THREE.Vector3(
      pawlLength * Math.cos(cPawlAngle),
      pawlLength * Math.sin(cPawlAngle),
      0,
    ));
    const bCordEyeLocal = bPawlPivot.clone().add(new THREE.Vector3(
      pawlCordEyeRadius * Math.cos(bPawlAngle),
      pawlCordEyeRadius * Math.sin(bPawlAngle),
      cordEyeZ - bPawlPivot.z,
    ));
    const cCordEyeLocal = cPawlPivot.clone().add(new THREE.Vector3(
      pawlCordEyeRadius * Math.cos(cPawlAngle),
      pawlCordEyeRadius * Math.sin(cPawlAngle),
      cordEyeZ - cPawlPivot.z,
    ));
    const bCrankPinLocal = crankPinPoint(selectorAngle);
    const cCrankPinLocal = bCrankPinLocal.clone();
    const inputPin = rotatePoint(inputPinLocal, leverAngle);
    const inputVerticalOffset = inputGuideY - inputPin.y;
    const inputSliderX = inputPin.x + Math.sqrt(
      inputRodLength ** 2 - inputVerticalOffset ** 2,
    );
    const inputSlider = new THREE.Vector3(
      inputSliderX,
      inputGuideY,
      inputPin.z,
    );
    return {
      bCordEyeLocal,
      bCrankPinLocal,
      bLiftFraction,
      bPawlAngle,
      bPawlContactGap: wheelInnerRadius - Math.hypot(
        bPawlTipLocal.x,
        bPawlTipLocal.y,
      ),
      bPawlTipLocal,
      cCordEyeLocal,
      cCrankPinLocal,
      cLiftFraction,
      cPawlAngle,
      cPawlContactGap: wheelInnerRadius - Math.hypot(
        cPawlTipLocal.x,
        cPawlTipLocal.y,
      ),
      cPawlTipLocal,
      cycleTime,
      drivingPawl,
      inputPin,
      inputRodLength: inputPin.distanceTo(inputSlider),
      inputSlider,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      selectedPawl,
      selectorAngle,
      selectorAngularAcceleration,
      selectorAngularSpeed,
      stage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };

  let maximumBCordChord = 0;
  let maximumCCordChord = 0;
  for (let index = 0; index <= 2400; index += 1) {
    const sample = basicStateAtTime(cycleDuration * index / 2400);
    maximumBCordChord = Math.max(maximumBCordChord,
      sample.bCrankPinLocal.distanceTo(sample.bCordEyeLocal));
    maximumCCordChord = Math.max(maximumCCordChord,
      sample.cCrankPinLocal.distanceTo(sample.cCordEyeLocal));
  }
  const bCordMaterialLength = maximumBCordChord + 0.035;
  const cCordMaterialLength = maximumCCordChord + 0.035;
  // Playback time zero is Brown's pose: lever A upright in the middle of a
  // C-selected stroke, crank E with its pin to the right.
  const sourceTime = cOscillationStart + halfStrokeDuration / 2;
  const stateAtTime = (time) => {
    const state = basicStateAtTime(time + sourceTime);
    const bCord = constantLengthCordRoute(
      state.bCrankPinLocal,
      state.bCordEyeLocal,
      bCordMaterialLength,
      -1,
    );
    const cCord = constantLengthCordRoute(
      state.cCrankPinLocal,
      state.cCordEyeLocal,
      cCordMaterialLength,
      1,
    );
    return {
      ...state,
      bCord,
      cCord,
      bPawlTipWorld: rotatePoint(state.bPawlTipLocal, state.leverAngle),
      cPawlTipWorld: rotatePoint(state.cPawlTipLocal, state.leverAngle),
    };
  };

  const geometry = {
    sourceTime,
    crankThrow: selectorHornRadius,
    bCordMaterialLength,
    bOscillationEnd,
    bOscillationStart,
    bPawlPivot,
    bSeatedAngle,
    bSeatedContact,
    bToCShiftDuration,
    bToCShiftEnd,
    bToCShiftStart,
    cCordMaterialLength,
    cOscillationEnd,
    cOscillationStart,
    cPawlPivot,
    cSeatedAngle,
    cSeatedContact,
    cToBShiftDuration,
    cToBShiftEnd,
    cToBShiftStart,
    cycleDuration,
    halfStrokeDuration,
    inputGuideY,
    inputPinLocal,
    inputRodLength,
    leverAmplitude,
    maximumPawlLiftAngle,
    oscillationDuration,
    overrunLiftFraction,
    pawlContactPhase,
    pawlCordEyeRadius,
    pawlLength,
    selectorAmplitude,
    selectorCenter,
    selectorHornRadius,
    wheelInnerRadius,
    wheelOuterRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.25,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const leverMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.50,
  });
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.48,
  });
  // Brown draws wheel D as a plain disc: an opaque web, no spokes.
  const wheelBackMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.56,
    side: THREE.DoubleSide,
  });
  const pawlMaterial = matte(PALETTE.accent, {
    metalness: 0.25,
    roughness: 0.43,
  });
  const cordMaterial = matte(PALETTE.belt, {
    metalness: 0.02,
    roughness: 0.70,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-coaxial-wheel-and-lever-bearing-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.25, 0.20, 1.15),
    frameMaterial,
  );
  base.position.set(0.35, -2.50, -0.48);
  base.userData.role = 'fixed-foundation';
  fixedFrame.add(base);
  for (const x of [-2.38, 2.38]) {
    const post = beamBetween(
      new THREE.Vector3(x, -2.40, -0.53),
      new THREE.Vector3(x * 0.16, -0.12, -0.53),
      0.19,
      0.22,
      frameMaterial,
    );
    post.userData.role = 'fixed-wheel-bearing-brace';
    fixedFrame.add(post);
  }
  const rearBearing = cylinderAlongZ(0.26, 0.44, frameMaterial, 36);
  rearBearing.position.z = -0.46;
  rearBearing.userData.role = 'fixed-rear-bearing';
  fixedFrame.add(rearBearing);
  root.add(fixedFrame);

  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'intermittently-rotating-wheel-D-output';
  const wheelRing = annularDiskAlongZ({
    depth: 0.24,
    innerRadius: wheelInnerRadius,
    material: wheelMaterial,
    outerRadius: wheelOuterRadius,
  });
  wheelRing.userData.role = 'single-smooth-internal-friction-rim-of-wheel-D';
  wheelRotor.add(wheelRing);
  const wheelWeb = new THREE.Mesh(
    new THREE.CircleGeometry(wheelInnerRadius - 0.07, 96),
    wheelBackMaterial,
  );
  wheelWeb.position.z = -0.10;
  wheelWeb.userData.role = 'translucent-wheel-D-web';
  wheelRotor.add(wheelWeb);
  for (let index = 0; index < 4; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(wheelInnerRadius * 1.82, 0.085, 0.10),
      wheelMaterial,
    );
    spoke.rotation.z = index * Math.PI / 4;
    spoke.position.z = -0.13;
    spoke.userData.role = 'wheel-D-spoke-fast-with-rim-and-hub';
    wheelRotor.add(spoke);
  }
  const wheelHub = cylinderAlongZ(0.31, 0.34, wheelMaterial, 40);
  wheelHub.position.z = -0.08;
  wheelHub.userData.role = 'wheel-D-hub-fast-with-smooth-rim';
  wheelRotor.add(wheelHub);
  const wheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.55, 0.055),
    whiteMaterial,
  );
  wheelIndex.position.set(0, wheelOuterRadius - 0.28, 0.145);
  wheelIndex.userData.role = 'white-wheel-D-intermittent-rotation-index';
  wheelRotor.add(wheelIndex);
  root.add(wheelRotor);

  const leverRotor = new THREE.Group();
  leverRotor.userData.role = 'coaxially-oscillating-lever-A-input-carrier';
  const leverBody = extrudedShape([
    [-0.17, -1.48],
    [0.17, -1.48],
    [0.23, -0.56],
    [0.65, -0.43],
    [0.78, -0.18],
    [0.75, 0.18],
    [0.53, 0.31],
    [-0.53, 0.31],
    [-0.75, 0.18],
    [-0.78, -0.18],
    [-0.65, -0.43],
    [-0.23, -0.56],
  ], 0.19, leverMaterial);
  leverBody.position.z = 0.34;
  leverBody.userData.role = 'T-shaped-rigid-body-of-lever-A';
  leverRotor.add(leverBody);
  const leverHub = cylinderAlongZ(0.28, 0.30, darkMaterial, 36);
  leverHub.position.z = 0.39;
  leverHub.userData.role = 'lever-A-loose-hub-on-wheel-D-shaft';
  leverRotor.add(leverHub);
  const leverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.43, 0.05),
    whiteMaterial,
  );
  leverIndex.position.set(0, -0.92, 0.46);
  leverIndex.userData.role = 'white-lever-A-oscillation-index';
  leverRotor.add(leverIndex);

  const bPawl = makePawl({
    material: pawlMaterial,
    pawlLength,
    role: 'selectable-left-pawl-B',
    whiteMaterial,
  });
  bPawl.position.copy(bPawlPivot);
  const cPawl = makePawl({
    material: pawlMaterial,
    pawlLength,
    role: 'selectable-right-pawl-C',
    whiteMaterial,
  });
  cPawl.position.copy(cPawlPivot);
  leverRotor.add(bPawl, cPawl);

  const selectorRotor = new THREE.Group();
  selectorRotor.position.copy(selectorCenter);
  selectorRotor.userData.role = 'small-reversing-crank-E-on-lever-A';
  const crankRadius = 0.035;
  const journalLength = crankJournalTop - selectorCenter.y;
  const selectorHub = new THREE.Mesh(new THREE.CylinderGeometry(crankRadius, crankRadius, journalLength + crankRadius, 24), darkMaterial);
  selectorHub.position.y = (journalLength + crankRadius) / 2;
  selectorHub.userData.role = 'crank-E-journal-running-up-lever-A';
  selectorRotor.add(selectorHub);
  const selectorArm = new THREE.Mesh(new THREE.CylinderGeometry(crankRadius, crankRadius, selectorHornRadius, 24).rotateZ(Math.PI / 2), darkMaterial);
  selectorArm.position.set(selectorHornRadius / 2, journalLength, 0);
  selectorArm.userData.role = 'crank-E-web';
  selectorRotor.add(selectorArm);
  const pinLength = crankPinTop - crankJournalTop;
  const crankPin = new THREE.Mesh(new THREE.CylinderGeometry(crankRadius, crankRadius, pinLength + crankRadius, 24), darkMaterial);
  crankPin.position.set(selectorHornRadius, journalLength + (pinLength - crankRadius) / 2, 0);
  crankPin.userData.role = 'crank-E-pin-carrying-both-cords';
  selectorRotor.add(crankPin);
  for (const [x, y] of [[0, journalLength], [selectorHornRadius, journalLength]]) {
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(crankRadius, 20, 12), darkMaterial);
    elbow.position.set(x, y, 0);
    elbow.userData.role = 'crank-E-bend';
    selectorRotor.add(elbow);
  }
  leverRotor.add(selectorRotor);

  const bCord = makeDynamicCord(
    cordMaterial,
    'constant-material-length-cord-from-E-to-pawl-B',
  );
  bCord.userData.materialLength = bCordMaterialLength;
  const cCord = makeDynamicCord(
    cordMaterial,
    'constant-material-length-cord-from-E-to-pawl-C',
  );
  cCord.userData.materialLength = cCordMaterialLength;
  leverRotor.add(bCord, cCord);
  root.add(leverRotor);

  const fixedShaft = cylinderAlongZ(0.105, 1.50, darkMaterial, 32);
  fixedShaft.position.z = 0.15;
  fixedShaft.userData.role = 'fixed-common-shaft-for-wheel-D-and-lever-A';
  root.add(fixedShaft);

  const inputRod = makeDynamicRod(leverMaterial);
  root.add(inputRod);
  const inputSlider = new THREE.Group();
  inputSlider.position.y = inputGuideY;
  inputSlider.userData.role = 'horizontally-guided-oscillating-input-slider';
  const sliderBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.27, 0.34),
    frameMaterial,
  );
  sliderBlock.userData.role = 'input-slider-block';
  inputSlider.add(sliderBlock);
  const sliderPin = cylinderAlongZ(0.105, 0.48, whiteMaterial, 24);
  sliderPin.userData.role = 'white-input-slider-joint-index';
  inputSlider.add(sliderPin);
  root.add(inputSlider);
  // Rod D runs in front of the rim of wheel D (Brown draws it crossing over
  // the rim) to the slider that drives it, just beyond the plate's crop. The
  // slider runs between the two bars of a fixed channel guide.
  const inputRodZ = 0.80;
  inputSlider.position.z = inputRodZ;
  const inputGuide = new THREE.Group();
  inputGuide.userData.role = 'fixed-horizontal-input-slider-guide';
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.10, 0.34), frameMaterial);
    bar.position.set(2.65, inputGuideY + side * 0.186, inputRodZ);
    bar.userData.role = 'input-slider-guide-bar';
    inputGuide.add(bar);
  }
  const guideEnd = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.472, 0.34), frameMaterial);
  guideEnd.position.set(3.55, inputGuideY, inputRodZ);
  guideEnd.userData.role = 'input-slider-guide-end-bridge';
  inputGuide.add(guideEnd);
  root.add(inputGuide);
  const inputRodEye = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 16, 48), leverMaterial);
  inputRodEye.userData.role = 'rod-D-eye-round-lever-tail-pin';
  root.add(inputRodEye);
  const leverInputPin = cylinderAlongZ(0.11, inputRodZ + 0.06 - 0.095, whiteMaterial, 24);
  leverInputPin.position.copy(inputPinLocal);
  leverInputPin.position.z = (inputRodZ + 0.06 + 0.095) / 2;
  leverInputPin.userData.role = 'white-input-pin-on-tail-of-lever-A';
  leverRotor.add(leverInputPin);

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.wheelAngle;
    leverRotor.rotation.z = state.leverAngle;
    // E turns about its journal (lever A's centre line, local y).
    selectorRotor.rotation.y = -crankTurn(state.selectorAngle);
    bPawl.rotation.z = state.bPawlAngle;
    cPawl.rotation.z = state.cPawlAngle;
    bCord.userData.setRoute(state.bCord);
    cCord.userData.setRoute(state.cCord);
    {
      // Rod D ends in an eye round the lever-tail pin and butts on the slider.
      const pin = state.inputPin.clone().setZ(inputRodZ);
      const end = state.inputSlider.clone().setZ(inputRodZ).add(new THREE.Vector3(-0.176, 0, 0));
      const along = end.clone().sub(pin).normalize();
      inputRodEye.position.copy(pin);
      inputRod.userData.setEndpoints(pin.addScaledVector(along, 0.206), end);
    }
    inputSlider.position.x = state.inputSlider.x;
    const bContactScale = state.bPawlContactGap < 1e-7 ? 1.28 : 0.72;
    const cContactScale = state.cPawlContactGap < 1e-7 ? 1.28 : 0.72;
    bPawl.userData.contact.scale.setScalar(bContactScale);
    cPawl.userData.contact.scale.setScalar(cContactScale);
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'selector-cord-opposed-internal-friction-pawls-on-coaxial-oscillating-lever-for-reversible-intermittent-rim-drive',
    blocks: {
      bCord,
      bPawl,
      cCord,
      cPawl,
      fixedFrame,
      fixedShaft,
      inputRod,
      inputSlider,
      leverInputPin,
      leverRotor,
      selectorRotor,
      wheelIndex,
      wheelRing,
      wheelRotor,
    },
    degreesOfFreedom: {
      independentConfigurationSettings: 1,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pawlAnglesIndependent: false,
      selectorChangesPermittedWhileMoving: false,
      storedEnergyStates: 0,
    },
    dynamics: {
      complianceLoadsInertiaAndImpactModeled: false,
      frictionModel:
        'ideal directional self-wedging contact: the selected pawl locks to the smooth inner rim on its driving half-stroke and releases on its return half-stroke',
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Lever A oscillates coaxially about the shaft of wheel D. Crank E and its two cords select exactly one of the opposed hinged pawls: C self-wedges against D’s smooth inner rim on the positive half-stroke, or B self-wedges on the negative half-stroke. The selected pawl overruns on the return, so D is stationary for half of each oscillation and advances intermittently in the selected direction. Reversal is demonstrated only at rest.',
    motion: {
      bOscillationStart,
      bToCShiftStart,
      cOscillationStart,
      cToBShiftStart,
      cycleDuration,
      selectorDemonstration:
        'C drive, stopped C-to-B selection, B reverse drive, stopped B-to-C reset',
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 415 page marks its Animated control unavailable and supplies only Brown’s static plate.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      bPawlLiftFraction: sourceState.bLiftFraction,
      cPawlLiftFraction: sourceState.cLiftFraction,
      selector: 'pawl C seated against the inner rim and pawl B lifted',
    },
    sourceReference: {
      brownPlate415: {
        imageHeight: 525,
        imageWidth: 525,
        leverAApproximateBoundsPixels: [178, 238, 362, 415],
        measurementUncertaintyPixels: 12,
        pawlBApproximateBoundsPixels: [164, 177, 253, 272],
        pawlCApproximateBoundsPixels: [295, 214, 431, 271],
        reversingCrankEApproximateBoundsPixels: [269, 196, 312, 244],
        wheelDApproximateBoundsPixels: [104, 101, 454, 449],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the input is oscillating motion communicated to lever A',
          'pawls B and C are hinged to the upper side of A near D’s shaft',
          'small crank E is on the upper side of A',
          'E is attached by cord to each pawl',
          'C contacts the interior of D while B is out of gear',
          'lifting C and letting B into gear reverses wheel D',
          'the output is intermittent circular motion in either direction',
        ],
        engravingEvidence:
          'Brown’s plate shows one smooth annular wheel D, a T-shaped lever A loose on the same central shaft, opposed outward-pointing pawls B and C on A, a two-ended selector crank E between them, and two dotted cord paths from E to the pawls.',
        reconstructionDisclosure:
          'Brown fixes the topology, selection rule, and reversible intermittent result but gives no dimensions, friction coefficients, pawl profiles, stroke law, angular advance, or timing. Smooth inner-rim wedge contact is inferred from the explicitly named interior rim and toothless engraving. The dimensions, constant-length two-segment cord display, smooth stroke ramps, at-rest automatic selector demonstration, translucent wheel web, input slider, and frame are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 415',
    },
    stateAtTime,
    transmission: {
      cSelectedDrive:
        'wheelSpeed=leverSpeed>0 on C’s locking half-stroke; wheelSpeed=0 on C’s negative overrun',
      bSelectedDrive:
        'wheelSpeed=0 on B’s positive overrun; wheelSpeed=leverSpeed<0 on B’s locking half-stroke',
      cordConstraint:
        'each E-to-pawl cord is displayed as two straight material segments whose summed length is constant',
      inputRodConstraint:
        'distance between the rotating lever-tail pin and horizontal slider pin is constant',
      selectionConstraint:
        'E changes selection only while lever A and wheel D are stationary; the outgoing pawl lifts as the incoming pawl is released',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.05, -2.62, -1.05),
    new THREE.Vector3(4.02, 2.47, 1.18),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(5.8, 3.7, 10.5);
  root.userData.groundFloorY = -2.62;
  markShadows(root);
  wheelWeb.castShadow = false;
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredDicksonReversibleDriveMovement(movement) {
  if (movement.id !== 415) return null;
  return finishOneWayFamily(correctDicksonParts(dicksonReversibleDrive(movement)), 415);
}
