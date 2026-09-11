import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

class PlanarArcCurve3 extends THREE.Curve {
  constructor(center, radius, startAngle, sweep, z) {
    super();
    this.center = center.clone();
    this.radius = radius;
    this.startAngle = startAngle;
    this.sweep = sweep;
    this.z = z;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    return target.set(
      this.center.x + this.radius * Math.cos(angle),
      this.center.y + this.radius * Math.sin(angle),
      this.z,
    );
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }

  getTangent(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    const direction = Math.sign(this.sweep) || 1;
    return target.set(
      -Math.sin(angle) * direction,
      Math.cos(angle) * direction,
      0,
    );
  }

  getTangentAt(parameter, target = new THREE.Vector3()) {
    return this.getTangent(parameter, target);
  }

  getLength() {
    return Math.abs(this.sweep) * this.radius;
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

function tangentPoint(point, center, radius, angleOffsetSign) {
  const displacement = point.clone().sub(center);
  const distance = displacement.length();
  if (distance <= radius) {
    throw new RangeError('Gig-saw spring endpoint entered its bend circle.');
  }
  const baseAngle = Math.atan2(displacement.y, displacement.x);
  const offset = Math.acos(radius / distance);
  const angle = baseAngle + angleOffsetSign * offset;
  return {
    angle,
    point: new THREE.Vector3(
      center.x + radius * Math.cos(angle),
      center.y + radius * Math.sin(angle),
      point.z,
    ),
  };
}

function flexibleLeafCurve({
  bendCenter,
  bendRadius,
  fixedEnd,
  movingEnd,
}) {
  const startTangent = tangentPoint(
    movingEnd,
    bendCenter,
    bendRadius,
    -1,
  );
  const endTangent = tangentPoint(
    fixedEnd,
    bendCenter,
    bendRadius,
    1,
  );
  let sweep = endTangent.angle - startTangent.angle;
  while (sweep > 0) sweep -= FULL_TURN;
  const firstSpan = new THREE.LineCurve3(
    movingEnd.clone(),
    startTangent.point,
  );
  const bend = new PlanarArcCurve3(
    bendCenter,
    bendRadius,
    startTangent.angle,
    sweep,
    movingEnd.z,
  );
  const lastSpan = new THREE.LineCurve3(
    endTangent.point,
    fixedEnd.clone(),
  );
  const curve = new THREE.CurvePath();
  curve.add(firstSpan);
  curve.add(bend);
  curve.add(lastSpan);
  curve.userData = {
    bendCenter: bendCenter.clone(),
    bendRadius,
    endTangentAngle: endTangent.angle,
    endTangentPoint: endTangent.point.clone(),
    fixedEnd: fixedEnd.clone(),
    joinTangentDots: [
      firstSpan.getTangent(1).dot(bend.getTangent(0)),
      bend.getTangent(1).dot(lastSpan.getTangent(0)),
    ],
    movingEnd: movingEnd.clone(),
    startTangentAngle: startTangent.angle,
    startTangentPoint: startTangent.point.clone(),
    sweep,
  };
  return curve;
}

function makeCrankFlywheel({
  crankRadius,
  darkMaterial,
  depth,
  material,
  wheelRadius,
  whiteMaterial,
}) {
  const rotor = new THREE.Group();
  rotor.userData.role = 'uniformly-rotating-gig-saw-crank-flywheel';
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadius, 0.115, 14, 80),
    material,
  );
  rim.userData.role = 'four-unit-source-radius-flywheel-rim';
  rotor.add(rim);
  const spokes = [];
  for (let index = 0; index < 4; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(wheelRadius * 1.74, 0.11, depth * 0.62),
      material,
    );
    spoke.rotation.z = index * Math.PI / 2;
    spoke.userData.role = 'flywheel-spoke-fast-with-crank';
    rotor.add(spoke);
    spokes.push(spoke);
  }
  const hub = cylinderAlongZ(0.20, depth * 1.52, darkMaterial, 34);
  hub.userData.role = 'fixed-axis-crankshaft-hub';
  rotor.add(hub);
  const throwArm = makeDynamicLink({
    color: PALETTE.driver,
    depth: depth * 0.80,
    jointRadius: 0.001,
    thickness: 0.15,
  });
  throwArm.userData.setEndpoints(
    new THREE.Vector3(0, 0, 0.02),
    new THREE.Vector3(-crankRadius, 0, 0.02),
  );
  throwArm.userData.role = 'rigid-two-and-one-half-unit-crank-throw';
  rotor.add(throwArm);
  const crankPin = cylinderAlongZ(0.135, depth * 1.58, darkMaterial, 28);
  crankPin.position.x = -crankRadius;
  crankPin.userData.role = 'crank-pin-driving-lower-connecting-rod';
  rotor.add(crankPin);
  const spinIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 12),
    whiteMaterial,
  );
  spinIndex.position.set(-crankRadius, 0, depth / 2 + 0.20);
  spinIndex.userData.role = 'white-crank-throw-spin-index';
  rotor.add(spinIndex);
  rotor.userData.crankPin = crankPin;
  rotor.userData.hub = hub;
  rotor.userData.rim = rim;
  rotor.userData.spinIndex = spinIndex;
  rotor.userData.spokes = spokes;
  rotor.userData.throwArm = throwArm;
  return markShadows(rotor);
}

function makeSawAssembly({
  bladeBottom,
  bladeMaterial,
  bladeTop,
  darkBladeMaterial,
  depth,
  lowerBlockTop,
  springAttachmentY,
  upperBlockBottom,
  upperBlockTop,
  whiteMaterial,
}) {
  const saw = new THREE.Group();
  saw.userData.role =
    'single-rigid-reciprocating-gig-saw-blade-and-two-guide-blocks';

  const bladeWidth = 0.105;
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(bladeWidth, bladeTop - bladeBottom, depth * 0.42),
    bladeMaterial,
  );
  blade.position.y = (bladeBottom + bladeTop) / 2;
  blade.userData.role = 'straight-vertical-gig-saw-blade';
  saw.add(blade);

  const sawTeeth = [];
  const toothCount = 30;
  const toothPitch = (bladeTop - bladeBottom) / toothCount;
  const toothShape = new THREE.Shape();
  toothShape.moveTo(-bladeWidth / 2, -toothPitch * 0.46);
  toothShape.lineTo(-bladeWidth / 2 - 0.105, -toothPitch * 0.18);
  toothShape.lineTo(-bladeWidth / 2, toothPitch * 0.46);
  toothShape.closePath();
  const toothGeometry = new THREE.ExtrudeGeometry(toothShape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: depth * 0.38,
    steps: 1,
  });
  toothGeometry.translate(0, 0, -depth * 0.19);
  for (let index = 0; index < toothCount; index += 1) {
    const tooth = new THREE.Mesh(toothGeometry, darkBladeMaterial);
    tooth.position.y = bladeBottom + (index + 0.5) * toothPitch;
    tooth.userData.index = index;
    tooth.userData.role = 'one-cutting-tooth-on-ungated-gig-saw-blade';
    saw.add(tooth);
    sawTeeth.push(tooth);
  }

  const lowerBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, lowerBlockTop, depth),
    bladeMaterial,
  );
  lowerBlock.position.y = lowerBlockTop / 2;
  lowerBlock.userData.role = 'lower-sliding-wrist-block';
  saw.add(lowerBlock);
  const lowerWrist = cylinderAlongZ(0.13, depth * 1.40, darkBladeMaterial, 28);
  lowerWrist.userData.role = 'lower-wrist-pin-joining-connecting-rod';
  saw.add(lowerWrist);

  const upperBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, upperBlockTop - upperBlockBottom, depth),
    bladeMaterial,
  );
  upperBlock.position.y = (upperBlockBottom + upperBlockTop) / 2;
  upperBlock.userData.role = 'upper-sliding-blade-block';
  saw.add(upperBlock);
  const upperCrossPin = cylinderAlongZ(
    0.095,
    depth * 1.35,
    darkBladeMaterial,
    24,
  );
  upperCrossPin.position.y = (upperBlockBottom + upperBlockTop) / 2;
  upperCrossPin.userData.role = 'upper-guide-block-cross-pin';
  saw.add(upperCrossPin);

  const springStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, springAttachmentY - upperBlockTop, depth * 0.48),
    bladeMaterial,
  );
  springStem.position.y = (upperBlockTop + springAttachmentY) / 2;
  springStem.userData.role =
    'slender-upper-blade-extension-to-flexing-spring';
  saw.add(springStem);
  const springAttachment = cylinderAlongZ(
    0.10,
    depth * 1.18,
    darkBladeMaterial,
    24,
  );
  springAttachment.position.y = springAttachmentY;
  springAttachment.userData.role = 'moving-upper-spring-attachment';
  saw.add(springAttachment);

  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.050, 0.36, 0.035),
    whiteMaterial,
  );
  translationIndex.position.set(
    0.22,
    (bladeBottom + bladeTop) / 2,
    depth / 2 + 0.06,
  );
  translationIndex.userData.role =
    'white-index-making-straight-saw-reciprocation-legible';
  saw.add(translationIndex);

  saw.userData.blade = blade;
  saw.userData.lowerBlock = lowerBlock;
  saw.userData.lowerWrist = lowerWrist;
  saw.userData.sawTeeth = sawTeeth;
  saw.userData.springAttachment = springAttachment;
  saw.userData.springStem = springStem;
  saw.userData.translationIndex = translationIndex;
  saw.userData.upperBlock = upperBlock;
  saw.userData.upperCrossPin = upperCrossPin;
  return markShadows(saw);
}

function makeFlexibleSpringSegments({
  color,
  depth,
  segmentCount,
}) {
  const spring = new THREE.Group();
  spring.userData.role =
    'single-flexing-upper-leaf-spring-maintaining-blade-tension';
  const segments = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const segment = makeDynamicLink({
      color,
      depth,
      jointRadius: index === 0 || index === segmentCount - 1
        ? 0.040
        : 0.001,
      thickness: 0.075,
    });
    segment.userData.index = index;
    segment.userData.role = 'short-rigid-render-segment-of-flexing-leaf-spring';
    spring.add(segment);
    segments.push(segment);
  }
  spring.userData.segments = segments;
  spring.userData.setCurve = (curve) => {
    for (let index = 0; index < segments.length; index += 1) {
      const start = curve.getPointAt(index / segments.length);
      const end = curve.getPointAt((index + 1) / segments.length);
      segments[index].userData.setEndpoints(start, end);
    }
    spring.userData.currentCurve = curve;
    spring.userData.currentLength = curve.getLength();
  };
  return markShadows(spring);
}

function gigSawWithTensionSpring(movement) {
  const root = new THREE.Group();

  // The official canvas model supplies a dimensionless construction.  This
  // implementation independently solves its exact crank-circle/slider
  // intersection and its point-circle tangent leaf-spring route.
  const sourceScale = 0.255;
  const originY = -2.25;
  const sourceCrankWheelRadius = 4;
  const sourceCrankRadius = 2.5;
  const sourceInitialWristY = 7.27988;
  const sourceRodLength = Math.hypot(
    sourceCrankRadius,
    sourceInitialWristY,
  );
  const wheelRadius = sourceCrankWheelRadius * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const connectingRodLength = sourceRodLength * sourceScale;
  const cycleDuration = 5;
  const crankAngularSpeed = FULL_TURN / cycleDuration;
  const crankCenter = new THREE.Vector3(0, originY, 0.10);
  const tableY = 12.15488 * sourceScale + originY;
  const bladeBottom = 1 * sourceScale;
  const bladeTop = 8.75 * sourceScale;
  const lowerBlockTop = 1 * sourceScale;
  const upperBlockBottom = 8.75 * sourceScale;
  const upperBlockTop = 10.25 * sourceScale;
  const springAttachmentY = 15.582695 * sourceScale;
  const lowerGuideBottom = 5.02988 * sourceScale + originY;
  const lowerGuideTop = 11.02988 * sourceScale + originY;
  const upperGuideBottom = 14.27988 * sourceScale + originY;
  const upperGuideTop = 20.27988 * sourceScale + originY;
  const springBendCenter = new THREE.Vector3(
    11.121157 * sourceScale,
    13.17988 * sourceScale + originY,
    0.33,
  );
  const springBendRadius = 13 * sourceScale;
  const springFixedEnd = new THREE.Vector3(
    13.121157 * sourceScale,
    26.12988 * sourceScale + originY,
    0.33,
  );
  const sliderLowY = originY + connectingRodLength - crankRadius;
  const sliderHighY = originY + connectingRodLength + crankRadius;
  const sliderStroke = sliderHighY - sliderLowY;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenDarkMaterial = matte(0x244b61, {
    metalness: 0.19,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.11,
    roughness: 0.69,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.45,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.21,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const frame = new THREE.Group();
  frame.userData.role =
    'fixed-table-separated-upper-and-lower-open-saw-guides';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.55, 0.24, 1.65),
    frameMaterial,
  );
  base.position.set(0, -3.46, -0.39);
  base.userData.role = 'fixed-gig-saw-machine-bed';
  frame.add(base);
  const bearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 1.40, 0.30),
    frameMaterial,
  );
  bearingPost.position.set(0, -2.80, -0.58);
  bearingPost.userData.role = 'fixed-crankshaft-bearing-standard';
  frame.add(bearingPost);

  const tableHalfWidth = 7.5 * sourceScale;
  const tableGapHalfWidth = 0.5 * sourceScale;
  const tableDepth = 2.15;
  const tableParts = [];
  for (const side of [-1, 1]) {
    const width = tableHalfWidth - tableGapHalfWidth;
    const tablePart = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.20, tableDepth),
      frameMaterial,
    );
    tablePart.position.set(
      side * (tableHalfWidth + tableGapHalfWidth) / 2,
      tableY,
      -0.12,
    );
    tablePart.userData.role =
      'fixed-work-table-half-leaving-narrow-blade-slot';
    frame.add(tablePart);
    tableParts.push(tablePart);
  }

  const guideRails = [];
  for (const [region, bottom, top] of [
    ['lower', lowerGuideBottom, lowerGuideTop],
    ['upper', upperGuideBottom, upperGuideTop],
  ]) {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.105, top - bottom, 0.54),
        frameMaterial,
      );
      rail.position.set(
        side * 1.25 * sourceScale,
        (bottom + top) / 2,
        -0.20,
      );
      rail.userData.region = region;
      rail.userData.role =
        `${region}-fixed-open-guide-cheek-for-saw-block`;
      rail.userData.side = side;
      frame.add(rail);
      guideRails.push(rail);
    }
  }
  root.add(markShadows(frame));

  const crankRotor = makeCrankFlywheel({
    crankRadius,
    darkMaterial,
    depth: 0.46,
    material: driverMaterial,
    wheelRadius,
    whiteMaterial,
  });
  crankRotor.position.copy(crankCenter);
  root.add(crankRotor);

  const connectingRod = makeDynamicLink({
    color: PALETTE.brass,
    depth: 0.24,
    jointRadius: 0.16,
    thickness: 0.16,
  });
  connectingRod.userData.role =
    'constant-length-crank-pin-to-vertical-saw-wrist-connecting-rod';
  root.add(connectingRod);

  const sawAssembly = makeSawAssembly({
    bladeBottom,
    bladeMaterial: drivenMaterial,
    bladeTop,
    darkBladeMaterial: drivenDarkMaterial,
    depth: 0.42,
    lowerBlockTop,
    springAttachmentY,
    upperBlockBottom,
    upperBlockTop,
    whiteMaterial,
  });
  sawAssembly.position.z = 0.28;
  root.add(sawAssembly);

  const flexingSpring = makeFlexibleSpringSegments({
    color: PALETTE.brass,
    depth: 0.15,
    segmentCount: 36,
  });
  root.add(flexingSpring);
  const springFixedBoss = cylinderAlongZ(
    0.13,
    0.72,
    darkMaterial,
    28,
  );
  springFixedBoss.position.copy(springFixedEnd);
  springFixedBoss.userData.role = 'fixed-right-hand-anchor-of-leaf-spring';
  root.add(springFixedBoss);

  const springCurveAtSlider = (sliderY) => flexibleLeafCurve({
    bendCenter: springBendCenter,
    bendRadius: springBendRadius,
    fixedEnd: springFixedEnd,
    movingEnd: new THREE.Vector3(
      0,
      sliderY + springAttachmentY,
      springFixedEnd.z,
    ),
  });
  const minimumSpringLength = springCurveAtSlider(sliderHighY).getLength();
  const maximumSpringLength = springCurveAtSlider(sliderLowY).getLength();
  const springPreloadExtension = 0.10;
  const springNaturalLength = minimumSpringLength - springPreloadExtension;
  const springRateProxy = 1;

  const stateAtTime = (time) => {
    const crankRotation = crankAngularSpeed * time;
    const phase = positiveModulo(crankRotation / FULL_TURN, 1);
    const cosine = Math.cos(crankRotation);
    const sine = Math.sin(crankRotation);
    const crankPin = new THREE.Vector3(
      crankCenter.x - crankRadius * cosine,
      crankCenter.y - crankRadius * sine,
      0.28,
    );
    const horizontalOffset = crankRadius * cosine;
    const verticalClosure = Math.sqrt(
      connectingRodLength ** 2 - horizontalOffset ** 2,
    );
    const sliderY = crankCenter.y - crankRadius * sine + verticalClosure;
    const sliderDerivativeByAngle = -crankRadius * cosine
      + crankRadius ** 2 * cosine * sine / verticalClosure;
    const sliderSecondDerivativeByAngle2 = crankRadius * sine
      + crankRadius ** 2 * (cosine ** 2 - sine ** 2)
        / verticalClosure
      - crankRadius ** 4 * cosine ** 2 * sine ** 2
        / verticalClosure ** 3;
    const sliderVelocity = sliderDerivativeByAngle * crankAngularSpeed;
    const sliderAcceleration = sliderSecondDerivativeByAngle2
      * crankAngularSpeed ** 2;
    const wrist = new THREE.Vector3(0, sliderY, crankPin.z);
    const springCurve = springCurveAtSlider(sliderY);
    const springLength = springCurve.getLength();
    const springExtension = springLength - springNaturalLength;
    return {
      bladeBottomY: sliderY + bladeBottom,
      bladeTopY: sliderY + bladeTop,
      crankAngularSpeed,
      crankPin,
      crankRotation,
      cycleTime: positiveModulo(time, cycleDuration),
      phase,
      rodAngle: Math.atan2(verticalClosure, horizontalOffset),
      rodLength: crankPin.distanceTo(wrist),
      sliderAcceleration,
      sliderVelocity,
      sliderY,
      spring: {
        curve: springCurve,
        extension: springExtension,
        fixedEnd: springFixedEnd.clone(),
        forceProxy: springRateProxy * springExtension,
        length: springLength,
        movingEnd: springCurve.userData.movingEnd.clone(),
      },
      wrist,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    crankRotor.rotation.z = state.crankRotation;
    connectingRod.userData.setEndpoints(state.crankPin, state.wrist);
    connectingRod.userData.start = state.crankPin.clone();
    connectingRod.userData.end = state.wrist.clone();
    sawAssembly.position.set(0, state.sliderY, 0.28);
    flexingSpring.userData.setCurve(state.spring.curve);
    root.userData.contacts = {
      connectingRodToSawWrist: {
        closed: true,
        lengthError: state.rodLength - connectingRodLength,
        point: state.wrist.clone(),
      },
      leafSpringToSawTop: {
        closed: true,
        extension: state.spring.extension,
        pointError: state.spring.curve.getPoint(0)
          .distanceTo(state.spring.movingEnd),
        tensionPositive: state.spring.forceProxy > 0,
      },
      sawBlocksToFixedGuides: {
        lowerBlockXError: state.wrist.x,
        upperBlockXError: state.wrist.x,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'crank-driven-ungated-gig-saw-with-tangent-flexing-upper-tension-spring',
    blocks: {
      connectingRod,
      crankRotor,
      flexingSpring,
      frame,
      guideRails,
      sawAssembly,
      springFixedBoss,
      tableParts,
    },
    constraintResiduals: {
      sourceInitialRodClosure:
        sourceRodLength ** 2
          - sourceCrankRadius ** 2 - sourceInitialWristY ** 2,
      sliderStroke: sliderStroke - 2 * crankRadius,
      springMaximumOrdering:
        maximumSpringLength > minimumSpringLength ? 0 : 1,
    },
    constraints: {
      crankSlider:
        'The lower wrist is the upper intersection of the crank-pin circle of connecting-rod length with the fixed vertical line x=0.',
      leafSpring:
        'The flexing spring runs from the moving blade top to a tangent on the source 13-unit bend circle, clockwise around that circle, then tangent to its fixed right anchor.',
      noGate:
        'Only the narrow blade and its two sliding blocks reciprocate; the separated upper/lower guide cheeks and work table are fixed.',
      sawRigidity:
        'Lower wrist block, toothed blade, upper block, stem, and spring attachment translate as one straight rigid assembly.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'vertical saw-wrist position',
        'connecting-rod obliquity',
        'rigid blade translation',
        'upper leaf-spring tangent point and wrap angle',
      ],
      independentPrescribedInputs: 1,
      inputs: ['uniform crankshaft angle'],
      note:
        'The slider-line constraint selects one wrist intersection; the spring flexure follows that one saw coordinate.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid crank, connecting rod, blade, and guide blocks',
        'zero-clearance frictionless straight guides',
        'quasi-static flexing leaf represented by its source tangent-circle construction',
        'positive preload retained throughout the stroke',
        'cutting force, flywheel inertia, vibration, and material removal omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless source-derived kinematic model',
    },
    fidelity: 'authored',
    geometry: {
      bladeBottom,
      bladeTop,
      connectingRodLength,
      crankCenter: crankCenter.clone(),
      crankRadius,
      lowerGuideBottom,
      lowerGuideTop,
      maximumSpringLength,
      minimumSpringLength,
      sourceScale,
      springAttachmentY,
      springBendCenter: springBendCenter.clone(),
      springBendRadius,
      springFixedEnd: springFixedEnd.clone(),
      springNaturalLength,
      springPreloadExtension,
      sliderHighY,
      sliderLowY,
      sliderStroke,
      tableY,
      upperGuideBottom,
      upperGuideTop,
      wheelRadius,
    },
    mechanism:
      'one-uniform-crank-and-constant-length-connecting-rod-reciprocate-one-straight-toothed-gig-saw-blade-through-two-fixed-open-guide-pairs-while-one-flexing-upper-leaf-spring-maintains-positive-tension-without-a-moving-gate',
    motion: {
      bladeAxis: new THREE.Vector3(0, 1, 0),
      crankAngularSpeed,
      inputCycleDuration: cycleDuration,
      sliderLaw:
        'y=-r*sin(theta)+sqrt(L^2-r^2*cos(theta)^2)+crankCenterY',
      stroke: sliderStroke,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasModelPresent: true,
      sourceCanvasRotationsPerPanelCycle: 2,
      sourcePrescribedAbsoluteTiming: false,
      sourceSliderSolution: 'upper circle-line intersection',
    },
    sourceReference: {
      canvasModel392: {
        crankPinAtZero: [-2.5, 0],
        crankRadius: sourceCrankRadius,
        crankWheelRadius: sourceCrankWheelRadius,
        lowerGuideYRange: [5.02988, 11.02988],
        modelViewport: [-14.270615, -5.166375, 33, 33],
        sawBladeLocalYRange: [1, 8.75],
        sliderLine: [[0, 4], [0, 24]],
        springBendCenter: [11.121157, 13.17988],
        springBendRadius: 13,
        springFixedEnd: [13.121157, 26.12988],
        springMovingEndLocalY: 15.582695,
        tableY: 12.15488,
        upperGuideYRange: [14.27988, 20.27988],
        wristAtZero: [0, sourceInitialWristY],
      },
      constructionEvidence: {
        engravingEvidence:
          'The plate shows a flywheel crank below, one oblique connecting rod, a narrow toothed vertical blade crossing a slotted table, two separated fixed guide pairs, and a long flexing top spring anchored at the right.',
        explicitInBrownDescription: [
          'gig-saw lower end connected with a crank',
          'crank works the saw',
          'upper end connected with a spring',
          'spring keeps the blade strained',
          'no gate surrounds the blade',
        ],
        reconstructionDisclosure:
          'The official canvas construction is available; this Three.js model independently re-solves its circle-line slider and tangent-circle spring geometry rather than copying its rendering code.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 392',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      lowerDeadCenterPhase: 0.25,
      sourceCanvasMechanicalCyclesPerPanelCycle: 2,
      upperDeadCenterPhase: 0.75,
    },
    transmission: {
      bladeTensionLaw:
        'T_proxy=k*(leaf path length-natural length)>0 over the complete stroke',
      crankSliderLaw:
        'L^2=(0-x_crank)^2+(y_wrist-y_crank)^2',
      springPathLaw:
        'moving point-tangent span + clockwise 13-unit circular bend + tangent span-fixed point',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.30, -3.76, -1.15),
    new THREE.Vector3(3.75, 4.80, 1.15),
  );
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraDirection = new THREE.Vector3(7.2, 3.4, 11.2);
  root.userData.groundFloorY = -3.59;
  update(0);
  return { root, update };
}

export function createAuthoredGigSawMovement(movement) {
  if (movement.id !== 392) return null;
  return gigSawWithTensionSpring(movement);
}
