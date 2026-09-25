import * as THREE from 'three';
import {
  PALETTE,
  makeScrew,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

import {boredJournal, boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';
import {helicalThread, polygonCylinder, threadAngles} from './mujoco-screw/thread-geometry.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (x * (x * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (x - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (2 * x ** 2 - 3 * x + 1);
}

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
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

function makeHandwheel(material, indexMaterial) {
  const handwheel = new THREE.Group();
  handwheel.userData.role = 'three-lobed-handwheel-rigid-on-adjusting-screw';
  const hub = cylinderAlongZ(0.22, 0.22, material, 34);
  hub.userData.role = 'adjusting-screw-handwheel-hub';
  handwheel.add(hub);
  const lobeShape = new THREE.Shape();
  const points = 72;
  for (let index = 0; index <= points; index += 1) {
    const angle = FULL_TURN * index / points;
    const radius = 0.34 + 0.10 * Math.cos(3 * angle);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (index === 0) lobeShape.moveTo(x, y);
    else lobeShape.lineTo(x, y);
  }
  lobeShape.closePath();
  const lobeGeometry = new THREE.ExtrudeGeometry(lobeShape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 16,
    depth: 0.12,
  });
  lobeGeometry.translate(0, 0, -0.06);
  const lobes = new THREE.Mesh(lobeGeometry, material);
  lobes.userData.role = 'three-lobed-adjusting-grip';
  handwheel.add(lobes);
  const angularIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 14, 10),
    indexMaterial,
  );
  angularIndex.position.set(0.30, 0, 0.085);
  angularIndex.userData.role = 'white-screw-handwheel-angular-index';
  handwheel.add(angularIndex);
  return { angularIndex, handwheel, hub, lobes };
}

function flexibleBarCyclograph(movement) {
  const root = new THREE.Group();
  const supportHalfSpan = 2.70;
  const supportY = 0.43;
  const maximumSagitta = 1.34;
  const minimumSagitta = 0.67;
  const maximumCircleCenter = new THREE.Vector2(
    0,
    supportY + (
      maximumSagitta ** 2 - supportHalfSpan ** 2
    ) / (2 * maximumSagitta),
  );
  const maximumCircleRadius = (
    maximumSagitta ** 2 + supportHalfSpan ** 2
  ) / (2 * maximumSagitta);
  const middleBarDepth = 0.28;
  const endBarDepth = middleBarDepth / 2;
  const barThickness = 0.18;
  const centralSampleCount = 97;
  const overhangSampleCount = 13;
  const totalPathSampleCount = centralSampleCount
    + 2 * (overhangSampleCount - 1);
  const terminalOverhangAtMaximum = 0.61;
  const rollerRadius = 0.18;
  const rollerDepth = 0.30;
  const threadPitch = 0.18;
  const threadLead = threadPitch;
  const screwLength = 2.30;
  const screwRadius = 0.15;
  const cycleDuration = 6;
  const sourcePhaseOffset = 0.5;

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterLeftRollerCenter = new THREE.Vector2(82, 220);
  const sourceRasterRightRollerCenter = new THREE.Vector2(452, 230);
  const sourceRasterOuterApex = new THREE.Vector2(267, 173);
  const sourceRasterInnerApex = new THREE.Vector2(268, 204);
  const sourceRasterScrewAxisX = 269;
  const sourceRasterStraightBar = [18, 290, 514, 342];

  const barMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  barMaterial.flatShading = true;
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.53,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.17,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.29,
    roughness: 0.43,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.24,
    roughness: 0.46,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const depthAtNormalizedSpan = (normalizedX) => (
    endBarDepth
      + (middleBarDepth - endBarDepth)
        * Math.max(0, 1 - normalizedX ** 2)
  );
  const maximumOuterEdgeY = (x) => (
    maximumCircleCenter.y
      + Math.sqrt(Math.max(0, maximumCircleRadius ** 2 - x ** 2))
  );
  const minimumOuterEdgeY = (x) => {
    const normalized = x / supportHalfSpan;
    return supportY + minimumSagitta * (1 - normalized ** 2);
  };
  const rawOuterEdgeY = (x, bend) => THREE.MathUtils.lerp(
    minimumOuterEdgeY(x),
    maximumOuterEdgeY(x),
    THREE.MathUtils.clamp(bend, 0, 1),
  );
  const minimumOuterSlope = (x) => (
    -2 * minimumSagitta * x / supportHalfSpan ** 2
  );
  const maximumOuterSlope = (x) => (
    -x / Math.sqrt(Math.max(
      1e-15,
      maximumCircleRadius ** 2 - x ** 2,
    ))
  );
  const outerSlope = (x, bend) => THREE.MathUtils.lerp(
    minimumOuterSlope(x),
    maximumOuterSlope(x),
    THREE.MathUtils.clamp(bend, 0, 1),
  );
  // Fixed finite rollers touch the circular source setting along its normal.
  // During adjustment the contact moves along the strip, not the standard.
  const sourceSlope = outerSlope(supportHalfSpan, 1);
  const rollerCenterX = supportHalfSpan - rollerRadius * sourceSlope
    / Math.hypot(1, sourceSlope);
  const rollerCenterY = supportY + rollerRadius / Math.hypot(1, sourceSlope);
  let lastContact;
  const contactAtBend = (bend) => {
    if (lastContact?.bend === bend) return lastContact;
    let low = supportHalfSpan - 2 * rollerRadius;
    let high = supportHalfSpan + 2 * rollerRadius;
    for (let i = 0; i < 48; i++) {
      const x = (low + high) / 2, slope = outerSlope(x, bend);
      if (x - rollerRadius * slope / Math.hypot(1, slope) < rollerCenterX) low = x;
      else high = x;
    }
    const x = bend === 1 ? supportHalfSpan : (low + high) / 2;
    const slope = outerSlope(x, bend), normalLength = Math.hypot(1, slope);
    const slopeBend = maximumOuterSlope(x) - minimumOuterSlope(x);
    const slopeX = (1 - bend) * (-2 * minimumSagitta / supportHalfSpan ** 2)
      - bend * maximumCircleRadius ** 2 / (maximumCircleRadius ** 2 - x ** 2) ** 1.5;
    const xBend = rollerRadius * slopeBend / (normalLength ** 3 - rollerRadius * slopeX);
    const shift = bend === 1 ? 0
      : rollerCenterY - rawOuterEdgeY(x, bend) - rollerRadius / normalLength;
    const shiftBend = -(maximumOuterEdgeY(x) - minimumOuterEdgeY(x));
    return lastContact = {bend, x, slope, shift, shiftBend,
      shiftBendBend: -slopeBend * xBend,
      normalTurnBend: -(slopeBend + slopeX * xBend) / normalLength ** 2};
  };
  const outerEdgeY = (x, bend) => rawOuterEdgeY(x, bend) + contactAtBend(bend).shift;
  const minimumApexY = outerEdgeY(0, 0);
  const screwStroke = outerEdgeY(0, 1) - minimumApexY;
  const initialContactSlope = contactAtBend(0).slope;
  const centralArcLengthAtBend = (bend) => {
    const contactX = contactAtBend(bend).x;
    let length = 0;
    let previous = new THREE.Vector2(
      -contactX,
      outerEdgeY(-contactX, bend),
    );
    for (let index = 1; index < centralSampleCount; index += 1) {
      const x = THREE.MathUtils.lerp(
        -contactX,
        contactX,
        index / (centralSampleCount - 1),
      );
      const point = new THREE.Vector2(x, outerEdgeY(x, bend));
      length += point.distanceTo(previous);
      previous = point;
    }
    return length;
  };
  const maximumCentralArcLength = centralArcLengthAtBend(1);
  const minimumCentralArcLength = centralArcLengthAtBend(0);
  const totalOuterEdgeLength = maximumCentralArcLength
    + 2 * terminalOverhangAtMaximum;
  const overhangLengthAtBend = (bend) => (
    (totalOuterEdgeLength - centralArcLengthAtBend(bend)) / 2
  );

  const pathAtBend = (bend) => {
    const contactX = contactAtBend(bend).x;
    const central = Array.from({ length: centralSampleCount }, (_, index) => {
      const x = THREE.MathUtils.lerp(
        -contactX,
        contactX,
        index / (centralSampleCount - 1),
      );
      return new THREE.Vector2(x, outerEdgeY(x, bend));
    });
    const overhangLength = (
      totalOuterEdgeLength
      - central.reduce((length, point, index) => (
        index === 0 ? 0 : length + point.distanceTo(central[index - 1])
      ), 0)
    ) / 2;
    const leftContact = central[0];
    const rightContact = central.at(-1);
    const leftOutward = new THREE.Vector2(
      -1,
      -outerSlope(-contactX, bend),
    ).normalize();
    const rightOutward = new THREE.Vector2(
      1,
      outerSlope(contactX, bend),
    ).normalize();
    const leftOverhang = Array.from(
      { length: overhangSampleCount },
      (_, index) => leftContact.clone().addScaledVector(
        leftOutward,
        overhangLength * (1 - index / (overhangSampleCount - 1)),
      ),
    );
    const rightOverhang = Array.from(
      { length: overhangSampleCount },
      (_, index) => rightContact.clone().addScaledVector(
        rightOutward,
        overhangLength * index / (overhangSampleCount - 1),
      ),
    );
    const outerPoints = [
      ...leftOverhang.slice(0, -1),
      ...central,
      ...rightOverhang.slice(1),
    ];
    const innerPoints = outerPoints.map((point, index) => {
      const previous = outerPoints[Math.max(0, index - 1)];
      const next = outerPoints[Math.min(outerPoints.length - 1, index + 1)];
      const tangent = next.clone().sub(previous).normalize();
      const inwardNormal = new THREE.Vector2(tangent.y, -tangent.x);
      const normalizedX = THREE.MathUtils.clamp(
        point.x / contactX,
        -1,
        1,
      );
      return point.clone().addScaledVector(
        inwardNormal,
        depthAtNormalizedSpan(normalizedX),
      );
    });
    return {
      centralArcLength: totalOuterEdgeLength - 2 * overhangLength,
      innerPoints,
      outerPoints,
      overhangLength,
    };
  };

  const barPositions = new Float32Array(totalPathSampleCount * 4 * 3);
  const barIndices = [];
  for (let index = 0; index < totalPathSampleCount - 1; index += 1) {
    const current = index * 4;
    const next = current + 4;
    const outerFront = current;
    const innerFront = current + 1;
    const outerBack = current + 2;
    const innerBack = current + 3;
    const nextOuterFront = next;
    const nextInnerFront = next + 1;
    const nextOuterBack = next + 2;
    const nextInnerBack = next + 3;
    barIndices.push(
      outerFront,
      innerFront,
      nextOuterFront,
      nextOuterFront,
      innerFront,
      nextInnerFront,
      outerBack,
      nextOuterBack,
      innerBack,
      nextOuterBack,
      nextInnerBack,
      innerBack,
      outerFront,
      nextOuterFront,
      outerBack,
      nextOuterFront,
      nextOuterBack,
      outerBack,
      innerFront,
      innerBack,
      nextInnerFront,
      nextInnerFront,
      innerBack,
      nextInnerBack,
    );
  }
  barIndices.push(
    0, 2, 1, 1, 2, 3,
    (totalPathSampleCount - 1) * 4,
    (totalPathSampleCount - 1) * 4 + 1,
    (totalPathSampleCount - 1) * 4 + 2,
    (totalPathSampleCount - 1) * 4 + 1,
    (totalPathSampleCount - 1) * 4 + 3,
    (totalPathSampleCount - 1) * 4 + 2,
  );
  const barGeometry = new THREE.BufferGeometry();
  const barPositionAttribute = new THREE.BufferAttribute(barPositions, 3);
  barPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  barGeometry.setAttribute('position', barPositionAttribute);
  barGeometry.setIndex(barIndices);
  const elasticBar = new THREE.Mesh(barGeometry, barMaterial);
  elasticBar.position.z = 0.26;
  elasticBar.frustumCulled = false;
  elasticBar.userData.role =
    'single-continuous-elastic-arched-bar-tapered-to-half-depth-at-ends';
  root.add(elasticBar);

  const updateBarGeometry = (bend) => {
    const path = pathAtBend(bend);
    for (let index = 0; index < totalPathSampleCount; index += 1) {
      const outer = path.outerPoints[index];
      const inner = path.innerPoints[index];
      const positionOffset = index * 12;
      barPositions[positionOffset] = outer.x;
      barPositions[positionOffset + 1] = outer.y;
      barPositions[positionOffset + 2] = barThickness / 2;
      barPositions[positionOffset + 3] = inner.x;
      barPositions[positionOffset + 4] = inner.y;
      barPositions[positionOffset + 5] = barThickness / 2;
      barPositions[positionOffset + 6] = outer.x;
      barPositions[positionOffset + 7] = outer.y;
      barPositions[positionOffset + 8] = -barThickness / 2;
      barPositions[positionOffset + 9] = inner.x;
      barPositions[positionOffset + 10] = inner.y;
      barPositions[positionOffset + 11] = -barThickness / 2;
    }
    barPositionAttribute.needsUpdate = true;
    barGeometry.computeVertexNormals();
    barGeometry.computeBoundingSphere();
    elasticBar.userData.currentPath = path;
    return path;
  };
  elasticBar.userData.updateForBend = updateBarGeometry;
  updateBarGeometry(1);

  const bendLawAtCyclePhase = (cyclePhase) => {
    if (cyclePhase < 0.5) {
      const local = cyclePhase * 2;
      return {
        acceleration: smootherStepSecondDerivative(local)
          * 4 / cycleDuration ** 2,
        direction: 'screw-advancing-and-bar-bending',
        rate: smootherStepDerivative(local) * 2 / cycleDuration,
        value: smootherStep(local),
      };
    }
    const local = (cyclePhase - 0.5) * 2;
    return {
      acceleration: -smootherStepSecondDerivative(local)
        * 4 / cycleDuration ** 2,
      direction: 'screw-withdrawing-and-bar-relaxing',
      rate: -smootherStepDerivative(local) * 2 / cycleDuration,
      value: 1 - smootherStep(local),
    };
  };

  const arcLengthDerivativeAtBend = (bend) => {
    const epsilon = 1e-5;
    const lower = Math.max(0, bend - epsilon);
    const upper = Math.min(1, bend + epsilon);
    if (upper === lower) return 0;
    return (
      centralArcLengthAtBend(upper) - centralArcLengthAtBend(lower)
    ) / (upper - lower);
  };
  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(
      cycleCoordinate + sourcePhaseOffset,
      1,
    );
    const bendLaw = bendLawAtCyclePhase(cyclePhase);
    const bend = bendLaw.value;
    const bendRate = bendLaw.rate;
    const bendAcceleration = bendLaw.acceleration;
    const centralArcLength = centralArcLengthAtBend(bend);
    const overhangLength = (
      totalOuterEdgeLength - centralArcLength
    ) / 2;
    const materialSlidePerEnd = (
      centralArcLength - minimumCentralArcLength
    ) / 2;
    const arcLengthDerivative = arcLengthDerivativeAtBend(bend);
    const materialSlideSpeedPerEnd = arcLengthDerivative
      * bendRate / 2;
    const contact = contactAtBend(bend);
    const apexBend = maximumSagitta - minimumSagitta + contact.shiftBend;
    const screwDisplacement = outerEdgeY(0, bend) - minimumApexY;
    const screwAxialSpeed = apexBend * bendRate;
    const screwAxialAcceleration = apexBend * bendAcceleration
      + contact.shiftBendBend * bendRate ** 2;
    const screwAngle = screwDisplacement / threadLead * FULL_TURN;
    const screwAngularSpeed = screwAxialSpeed / threadLead * FULL_TURN;
    const screwAngularAcceleration = screwAxialAcceleration
      / threadLead * FULL_TURN;
    const outerApex = new THREE.Vector2(
      0,
      outerEdgeY(0, bend),
    );
    const innerApex = new THREE.Vector2(
      0,
      outerApex.y - middleBarDepth,
    );
    const contactNormalTurn = -(Math.atan(contact.slope) - Math.atan(initialContactSlope));
    const leftRollerAngle = materialSlidePerEnd / rollerRadius + contactNormalTurn;
    const rightRollerAngle = -leftRollerAngle;
    const leftRollerAngularSpeed = materialSlideSpeedPerEnd
      / rollerRadius + contact.normalTurnBend * bendRate;
    const rightRollerAngularSpeed = -leftRollerAngularSpeed;
    return {
      bend,
      bendAcceleration,
      bendLaw,
      bendRate,
      centralArcLength,
      contactNormalTurn,
      cycleCoordinate,
      cyclePhase,
      innerApex,
      leftRollerAngle,
      leftRollerAngularSpeed,
      leftRollerNoSlipResidual:
        rollerRadius * (leftRollerAngle - contactNormalTurn) - materialSlidePerEnd,
      materialSlidePerEnd,
      materialSlideSpeedPerEnd,
      outerApex,
      overhangLength,
      rightRollerAngle,
      rightRollerAngularSpeed,
      rightRollerNoSlipResidual:
        rollerRadius * (-rightRollerAngle - contactNormalTurn) - materialSlidePerEnd,
      screwAngle,
      screwAngularAcceleration,
      screwAngularSpeed,
      screwAxialAcceleration,
      screwAxialSpeed,
      screwDisplacement,
      screwLeadResidual:
        screwDisplacement - screwAngle / FULL_TURN * threadLead,
      screwPadContactResidual: innerApex.y
        - (minimumApexY - middleBarDepth
          + screwDisplacement),
    };
  };

  const baseShape = new THREE.Shape();
  baseShape.moveTo(-3.275, -.45); baseShape.lineTo(3.275, -.45);
  baseShape.lineTo(3.275, .45); baseShape.lineTo(-3.275, .45); baseShape.closePath();
  const baseBore = new THREE.Path(); baseBore.absarc(0, -.14, .176, 0, FULL_TURN, true);
  baseShape.holes.push(baseBore);
  const baseGeometry = new THREE.ExtrudeGeometry(baseShape,
    {depth: .34, bevelEnabled: false, curveSegments: 48});
  baseGeometry.translate(0, 0, -.17); baseGeometry.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(
    baseGeometry,
    frameMaterial,
  );
  base.position.set(0, -.42, .12);
  base.userData.role = 'fixed-straight-bar-carrying-screw-and-end-rollers';
  root.add(base);
  const baseFeet = [-3.12, 3.12].map((x, index) => {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.30, 0.60),
      frameMaterial,
    );
    foot.position.set(x, -.64, 0);
    foot.userData.role = `straight-bar-end-foot-${index + 1}`;
    root.add(foot);
    return foot;
  });

  const rollerAssemblies = [-1, 1].map((side) => {
    const x = side * rollerCenterX;
    const role = side < 0 ? 'left' : 'right';
    const standard = beamBetween(
      new THREE.Vector3(x, -.28, -.08),
      new THREE.Vector3(x, rollerCenterY, -.08),
      0.18,
      0.30,
      frameMaterial,
    );
    standard.userData.role = `${role}-fixed-roller-standard`;
    root.add(standard);
    const roller = new THREE.Group();
    roller.position.set(x, rollerCenterY, .26);
    roller.userData.role = `${role}-small-confining-roller`;
    const body = boredJournal(rollerRadius, .058, rollerDepth, accentMaterial);
    body.userData.role = `${role}-roller-body`;
    const axle = cylinderAlongZ(0.055, 0.58, darkMaterial, 26);
    axle.userData.role = `${role}-fixed-roller-axle`;
    const index = new THREE.Mesh(
      new THREE.SphereGeometry(0.040, 14, 10),
      whiteMaterial,
    );
    index.position.set(rollerRadius * 0.72, 0, rollerDepth * 0.57);
    index.userData.role = `${role}-white-roller-angular-index`;
    roller.add(body, axle, index);
    root.add(roller);
    return { axle, body, index, roller, standard };
  });

  const fixedNut = new THREE.Mesh(
    boredCylinderGeometry(.27, .176, .32),
    darkMaterial,
  );
  fixedNut.position.set(0, -.10, .26);
  fixedNut.userData.role = 'fixed-threaded-nut-in-straight-bar';
  root.add(fixedNut);
  const screw = makeScrew({
    axis: new THREE.Vector3(0, 1, 0),
    color: PALETTE.driver,
    length: screwLength,
    pitch: threadPitch,
    radius: screwRadius,
    threadRadius: 0.022,
  });
  screw.userData.role = 'single-right-hand-central-adjusting-screw';
  // Closed square threads and a complementary fixed nut replace the coil.
  const threadProfile = {inner: .102, outer: .172, width: threadPitch / 2,
    lead: threadPitch / FULL_TURN, low: -screwLength / 2, high: screwLength / 2,
    phase: -screwLength / 2};
  const angles = threadAngles(threadProfile, 64);
  const rotor = screw.userData.rotor;
  for (const old of [...rotor.children]) { rotor.remove(old); old.geometry?.dispose(); }
  const core = new THREE.Mesh(polygonCylinder(.102, threadProfile.low, threadProfile.high, angles), driverMaterial);
  const thread = new THREE.Mesh(helicalThread(threadProfile, angles), driverMaterial);
  thread.userData.screwThread = true; rotor.add(core, thread);
  screw.userData.thread = thread; screw.userData.threadCaps = [];
  const minimumScrewCenterY = minimumApexY - middleBarDepth - .32 - screwLength / 2;
  const nutProfile = {inner: .104, outer: .176, width: threadPitch / 2 - .006,
    lead: threadPitch / FULL_TURN, low: -.16, high: .16,
    phase: threadProfile.phase + minimumScrewCenterY - fixedNut.position.y + threadPitch / 2};
  const nutThread = new THREE.Mesh(helicalThread(nutProfile, threadAngles(nutProfile, 64)), darkMaterial);
  nutThread.rotation.x = -Math.PI / 2; fixedNut.add(nutThread);

  root.add(screw);
  const handwheel = makeHandwheel(driverMaterial, whiteMaterial);
  handwheel.handwheel.rotation.x = Math.PI / 2;
  handwheel.handwheel.position.z = 0.30;
  screw.userData.rotor.add(handwheel.handwheel);
  handwheel.handwheel.position.z = -screwLength / 2 - 0.16;

  const thrustPad = new THREE.Group();
  thrustPad.userData.role =
    'nonrotating-swivel-thrust-pad-at-inner-arched-bar-midpoint';
  const padBody = cylinderAlongZ(.16, .18, accentMaterial, 96);
  padBody.userData.role = 'central-screw-thrust-pad';
  padBody.position.y = -.085;
  const padContact = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.065, 0.25),
    accentMaterial,
  );
  padContact.position.y = 0.07;
  padContact.userData.role = 'flat-pad-contacting-inner-bar-edge';
  thrustPad.add(padBody);
  root.add(thrustPad);

  const requiredArcPoints = [
    new THREE.Vector2(-supportHalfSpan, supportY),
    new THREE.Vector2(0, supportY + maximumSagitta),
    new THREE.Vector2(supportHalfSpan, supportY),
  ].map((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      whiteMaterial,
    );
    marker.position.set(point.x, point.y, 0.48);
    marker.userData.role = `given-required-arc-point-${index + 1}`;
    root.add(marker);
    return marker;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    const path = updateBarGeometry(state.bend);
    const screwTopY = state.innerApex.y - .32;
    screw.position.set(0, screwTopY - screwLength / 2, .26);
    setSpin(screw, state.screwAngle);
    thrustPad.position.set(0, state.innerApex.y - 0.075, .26);
    rollerAssemblies[0].roller.rotation.z = state.leftRollerAngle;
    rollerAssemblies[1].roller.rotation.z = state.rightRollerAngle;
    root.userData.contacts = {
      leftRollerToElasticBar: {
        active: true,
        barPoint: path.outerPoints[overhangSampleCount - 1],
        noSlipResidual: state.leftRollerNoSlipResidual,
      },
      rightRollerToElasticBar: {
        active: true,
        barPoint: path.outerPoints[
          totalPathSampleCount - overhangSampleCount
        ],
        noSlipResidual: state.rightRollerNoSlipResidual,
      },
      screwToFixedNut: {
        active: true,
        leadResidual: state.screwLeadResidual,
      },
      thrustPadToBarMidpoint: {
        active: true,
        point: state.innerApex,
        residual: state.screwPadContactResidual,
      },
    };
    root.userData.kinematics = state;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    archetype:
      'screw-adjusted-variable-depth-elastic-arched-bar-cyclograph-confined-by-two-fixed-end-rollers-and-circular-at-maximum-bend',
    bendLawAtCyclePhase,
    blocks: {
      base,
      baseFeet,
      elasticBar,
      fixedNut,
      handwheel,
      padBody,
      nutThread,
      requiredArcPoints,
      rollerAssemblies,
      screw,
      thrustPad,
    },
    centralArcLengthAtBend,
    constraints: {
      elasticBar:
        'One continuous inextensible-length ribbon has end depth exactly half its middle depth; its working outer profile deforms from a shallower noncircular arch to the specified circular maximum-bend profile.',
      rollers:
        'Two small fixed-axis rollers hold the outer edge at the two straight-bar stations while material slides beneath them; their opposite rotations satisfy no-slip arc-length uptake.',
      screw:
        'One right-hand screw turns in the fixed central nut, advances one lead per revolution, and its nonrotating thrust pad remains against the inner midpoint of the elastic bar.',
      threePoints:
        'At maximum bend the bar outer edge passes through the two roller stations and the central prescribed point and has one constant circle radius over the supported span.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'central screw translation through thread lead',
        'elastic-bar deflection and material uptake through both rollers',
        'equal-and-opposite end-roller rotations',
      ],
      independentPrescribedInputs: 1,
      inputs: ['central screw rotation'],
      note:
        'Brown specifies the maximum circular condition and two-to-one depth taper but no elastic modulus, load, neutral shape, or force law; intermediate profiles are a disclosed smooth kinematic interpolation.',
      storedEnergyStates: 0,
    },
    depthAtNormalizedSpan,
    dynamics: {
      idealizations: [
        'one continuous bar of constant total outer-edge material length',
        'zero-clearance, no-slip fixed-axis end rollers',
        'rigid straight frame, fixed nut, screw, handwheel, and swivel thrust pad',
        'bar stress, elastic modulus, roller friction, screw friction, backlash, and applied torque omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless quasi-static flexible-template kinematics',
    },
    fidelity: 'authored',
    geometry: {
      barThickness,
      centralSampleCount,
      cycleDuration,
      endBarDepth,
      maximumCentralArcLength,
      maximumCircleCenter,
      maximumCircleRadius,
      maximumSagitta,
      middleBarDepth,
      minimumCentralArcLength,
      minimumSagitta,
      overhangSampleCount,
      rollerCenterX,
      rollerCenterY,
      rollerDepth,
      rollerRadius,
      screwLength,
      screwRadius,
      screwStroke,
      sourcePhaseOffset,
      supportHalfSpan,
      supportY,
      terminalOverhangAtMaximum,
      threadLead,
      threadPitch,
      totalOuterEdgeLength,
      totalPathSampleCount,
    },
    contactAtBend,
    maximumOuterEdgeY,
    mechanism:
      'one tapered elastic arched template passes beneath two small rollers fixed to a straight base; one central screw in a fixed nut raises a swivel pad against the bar midpoint, drawing material inward through both rollers until the outer edge fits the three prescribed points as a true circular arc',
    minimumOuterEdgeY,
    motion: {
      cycleDuration,
      maximumAdjustmentTurns: screwStroke / threadLead,
      sequence:
        'maximum circular setting -> screw withdraws and bar relaxes while ends feed outward -> minimum arch -> screw advances and bar bends while ends feed inward -> maximum circular setting',
    },
    outerEdgeY,
    outerSlope,
    overhangLengthAtBend,
    pathAtBend,
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 404 page marks Animated unavailable and supplies only Brown’s static engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate404: {
        imageHeight: sourceImageHeight,
        imageWidth: sourceImageWidth,
        innerApexApproximatePixels: sourceRasterInnerApex.toArray(),
        leftRollerCenterApproximatePixels:
          sourceRasterLeftRollerCenter.toArray(),
        measurementUncertaintyPixels: 9,
        outerApexApproximatePixels: sourceRasterOuterApex.toArray(),
        rightRollerCenterApproximatePixels:
          sourceRasterRightRollerCenter.toArray(),
        screwAxisXApproximatePixels: sourceRasterScrewAxisX,
        straightBarApproximateBoundsPixels: sourceRasterStraightBar,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one elastic arched bar is used as the drawing template',
          'the bar is half as deep at its ends as at its middle',
          'its outer edge is a true circular arc at greatest bend',
          'three points in the required arc set the bar',
          'a screw bends the bar to those points',
          'a small roller confines each end to the straight bar',
        ],
        engravingEvidence:
          'The plate shows one thickened-center bowed strip, a central vertical screw and top thrust pad, one straight base, and two small rollers on fixed end standards above the strip.',
        reconstructionDisclosure:
          'Brown gives no elastic modulus, force, screw lead, unstressed profile, exact cross section, or dimensions. The maximum circular outer edge and two-to-one depth taper are enforced exactly; intermediate deformation, arc-length uptake, screw pitch, and timing are independently synthesized and identified as such.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 404',
    },
    sourcePose: {
      bend: sourceState.bend,
      outerApex: sourceState.outerApex,
      setting: 'greatest bend with true circular outer edge',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    transmission: {
      endRollerRelation:
        'leftAngle=materialSlide/rollerRadius+contactNormalTurn and rightAngle=-leftAngle',
      screwLeadRelation:
        'screwDisplacement=screwAngle*threadLead/(2*pi)',
      totalBarLengthRelation:
        'central supported arc length plus two equal straight tangent overhangs remains constant',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.58, -1.82, -0.52),
    new THREE.Vector3(3.58, 2.08, 0.88),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(5.8, 4.0, 12.8);
  root.userData.groundFloorY = -1.80;
  markShadows(root);
  root.userData.cameraFov = 8;
  root.userData.cameraDirection = new THREE.Vector3(0, .8, 12);
  fitPistonGuide(root, update, cycleDuration);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredFlexibleCyclographMovement(movement) {
  if (movement.id !== 404) return null;
  return flexibleBarCyclograph(movement);
}
