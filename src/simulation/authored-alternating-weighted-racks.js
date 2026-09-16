import * as THREE from 'three';
import {installWeightedRackSelector, selectorState} from './weighted-rack-selector-contact.js';
import { correctWeightedRackInterfaces, correctWeightedRackTeeth, finishAlternatingDrive } from './alternating-drive-finite-parts.js';
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

function wrappedSignedAngle(angle) {
  const wrapped = positiveModulo(angle + Math.PI, FULL_TURN) - Math.PI;
  return Math.abs(wrapped + Math.PI) < 1e-14 ? Math.PI : wrapped;
}

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.006) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 12,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeSpurGear({
  depth,
  material,
  pitchRadius,
  toothCount,
  toothHeight,
  whiteMaterial,
  darkMaterial,
}) {
  const rotor = new THREE.Group();
  rotor.userData.role =
    'continuous-counterclockwise-fixed-axis-output-cog-wheel';
  const angularPitch = FULL_TURN / toothCount;
  const rootRadius = pitchRadius - toothHeight / 2;
  const outerRadius = pitchRadius + toothHeight / 2;
  const shape = new THREE.Shape();
  let first = true;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    for (const [offset, radius] of [
      [-0.50, rootRadius],
      [-0.27, outerRadius],
      [0.27, outerRadius],
      [0.50, rootRadius],
    ]) {
      const angle = (tooth + offset) * angularPitch;
      const point = new THREE.Vector2(
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      );
      if (first) {
        shape.moveTo(point.x, point.y);
        first = false;
      } else shape.lineTo(point.x, point.y);
    }
  }
  shape.closePath();
  const wheel = new THREE.Mesh(
    centeredExtrusion(shape, depth, 0.008),
    material,
  );
  wheel.userData.role = 'twenty-tooth-output-cog-wheel-body';
  rotor.add(wheel);

  const hub = cylinderAlongZ(0.22, depth * 1.48, darkMaterial, 36);
  hub.userData.role = 'output-cog-wheel-hub-fast-on-shaft';
  rotor.add(hub);
  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(pitchRadius * 0.54, 0.045, 10, 64),
    darkMaterial,
  );
  faceRing.position.z = depth / 2 + 0.015;
  faceRing.userData.role = 'output-wheel-face-reference-ring';
  rotor.add(faceRing);
  const shaft = cylinderAlongZ(0.105, 1.12, darkMaterial, 28);
  shaft.userData.role = 'fixed-axis-output-shaft';
  rotor.add(shaft);

  const spinIndex = new THREE.Mesh(
    new THREE.BoxGeometry(pitchRadius * 0.62, 0.060, 0.035),
    whiteMaterial,
  );
  spinIndex.position.set(pitchRadius * 0.34, 0, depth / 2 + 0.065);
  spinIndex.userData.role =
    'white-index-making-continuous-output-rotation-legible';
  rotor.add(spinIndex);

  rotor.userData.angularPitch = angularPitch;
  rotor.userData.outerRadius = outerRadius;
  rotor.userData.pitchRadius = pitchRadius;
  rotor.userData.rootRadius = rootRadius;
  rotor.userData.shaft = shaft;
  rotor.userData.spinIndex = spinIndex;
  rotor.userData.toothCount = toothCount;
  rotor.userData.wheel = wheel;
  return markShadows(rotor);
}

function makeRack({
  bodyLength,
  bodyMaterial,
  bodyWidth,
  circularPitch,
  darkMaterial,
  depth,
  guideArm,
  guideY,
  side,
  toothCount,
  toothHeight,
  toothMaterial,
  whiteMaterial,
}) {
  const rack = new THREE.Group();
  const name = side < 0 ? 'left-rack-A' : 'right-rack-A1';
  rack.userData.role = `${name}-weighted-pivoted-rack`;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, bodyLength, depth),
    bodyMaterial,
  );
  body.position.y = bodyLength / 2;
  body.userData.role = `${name}-straight-bar`;
  rack.add(body);

  const inward = -side;
  const rootX = inward * bodyWidth / 2;
  const tipX = inward * (bodyWidth / 2 + toothHeight);
  const toothShape = new THREE.Shape();
  toothShape.moveTo(rootX, -circularPitch * 0.42);
  toothShape.lineTo(tipX, -circularPitch * 0.20);
  toothShape.lineTo(tipX, circularPitch * 0.20);
  toothShape.lineTo(rootX, circularPitch * 0.42);
  toothShape.closePath();
  const toothGeometry = centeredExtrusion(toothShape, depth * 0.94, 0.004);
  const teeth = [];
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
    tooth.position.y = 0.24 + toothIndex * circularPitch;
    tooth.userData.materialToothIndex = toothIndex;
    tooth.userData.pitch = circularPitch;
    tooth.userData.role = `${name}-inward-facing-working-tooth`;
    rack.add(tooth);
    teeth.push(tooth);
  }

  const guideArmLink = makeDynamicLink({
    color: PALETTE.driver,
    depth: depth * 0.72,
    jointRadius: 0.055,
    thickness: 0.105,
  });
  guideArmLink.userData.setEndpoints(
    new THREE.Vector3(0, guideY, 0),
    new THREE.Vector3(side * guideArm, guideY, 0),
  );
  guideArmLink.userData.role = `${name}-rigid-outward-guide-arm`;
  rack.add(guideArmLink);

  const guidePin = cylinderAlongZ(0.115, 1.05, darkMaterial, 28);
  guidePin.position.set(side * guideArm, guideY, 0);
  guidePin.userData.role = `${name}-pin-running-in-fixed-guide-groove-b`;
  rack.add(guidePin);
  const guidePinIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 20, 12),
    whiteMaterial,
  );
  guidePinIndex.position.set(side * guideArm, guideY, depth / 2 + 0.36);
  guidePinIndex.userData.role = `${name}-white-guide-pin-index`;
  rack.add(guidePinIndex);

  const pivotBoss = cylinderAlongZ(0.20, depth * 1.38, bodyMaterial, 32);
  pivotBoss.userData.role = `${name}-lower-pivot-boss-a`;
  rack.add(pivotBoss);
  const pivotBore = cylinderAlongZ(0.085, depth * 1.66, darkMaterial, 24);
  pivotBore.userData.role = `${name}-lower-pivot-pin-a`;
  rack.add(pivotBore);

  // The unequal-looking lower arms follow the source plate: A has its
  // conspicuous weight outboard; A1's ball lies inboard of its lower pivot.
  const weightX = side < 0 ? -1.02 : -0.91;
  const weightArm = makeDynamicLink({
    color: PALETTE.driver,
    depth: depth * 0.72,
    jointRadius: 0.001,
    thickness: 0.105,
  });
  weightArm.userData.setEndpoints(
    new THREE.Vector3(0, 0.02, 0),
    new THREE.Vector3(weightX, 0.02, 0),
  );
  weightArm.userData.role = `${name}-lower-weight-arm`;
  rack.add(weightArm);
  const weight = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 28, 18),
    bodyMaterial,
  );
  weight.position.set(weightX, 0.02, 0);
  weight.userData.role = `${name}-gravity-bias-weight`;
  rack.add(weight);

  const toothPhaseIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, circularPitch * 0.76, 0.035),
    whiteMaterial,
  );
  toothPhaseIndex.position.set(
    inward * (bodyWidth / 2 + toothHeight * 0.54),
    1.71,
    depth / 2 + 0.055,
  );
  toothPhaseIndex.userData.role = `${name}-white-rack-pitch-index`;
  rack.add(toothPhaseIndex);

  rack.userData.body = body;
  rack.userData.guideArm = guideArmLink;
  rack.userData.guidePin = guidePin;
  rack.userData.guidePinIndex = guidePinIndex;
  rack.userData.guidePinLocal = new THREE.Vector2(side * guideArm, guideY);
  rack.userData.pivotBoss = pivotBoss;
  rack.userData.pivotBore = pivotBore;
  rack.userData.side = side;
  rack.userData.teeth = teeth;
  rack.userData.toothPhaseIndex = toothPhaseIndex;
  rack.userData.weight = weight;
  rack.userData.weightArm = weightArm;
  return markShadows(rack);
}

class GuidePinCurve extends THREE.Curve {
  constructor(pointAtPhase, z) {
    super();
    this.pointAtPhase = pointAtPhase;
    this.z = z;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const point = this.pointAtPhase(positiveModulo(parameter, 1));
    return target.set(point.x, point.y, this.z);
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }
}

function makeGuideGroove({
  centerline,
  darkMaterial,
  frameMaterial,
  role,
}) {
  const guide = new THREE.Group();
  guide.userData.role = role;
  const casting = new THREE.Mesh(
    new THREE.TubeGeometry(centerline, 192, 0.155, 12, true),
    frameMaterial,
  );
  casting.userData.role = `${role}-fixed-cast-surround`;
  guide.add(casting);
  const slot = new THREE.Mesh(
    new THREE.TubeGeometry(centerline, 192, 0.068, 10, true),
    darkMaterial,
  );
  slot.position.z = 0.045;
  slot.userData.role = `${role}-dark-running-slot-centerline`;
  guide.add(slot);
  guide.userData.casting = casting;
  guide.userData.centerline = centerline;
  guide.userData.slot = slot;
  return markShadows(guide);
}

function makeDynamicCoilSpring(material, pointCount = 65) {
  const positions = new Float32Array(pointCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const spring = new THREE.Line(geometry, material);
  spring.userData.role = 'tension-spring-d-returning-elbow-lever-C';
  spring.userData.setEndpoints = (start, end) => {
    const delta = end.clone().sub(start);
    const length = delta.length();
    const unit = delta.clone().multiplyScalar(1 / Math.max(length, 1e-12));
    const normal = new THREE.Vector3(-unit.y, unit.x, 0);
    const binormal = new THREE.Vector3(0, 0, 1);
    const turns = 10;
    for (let index = 0; index < pointCount; index += 1) {
      const u = index / (pointCount - 1);
      const taper = Math.sin(Math.PI * u);
      const phase = turns * FULL_TURN * u;
      const point = start.clone().addScaledVector(delta, u)
        .addScaledVector(normal, 0.070 * taper * Math.sin(phase))
        .addScaledVector(binormal, 0.070 * taper * Math.cos(phase));
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();
    spring.userData.currentLength = length;
    spring.userData.end = end.clone();
    spring.userData.start = start.clone();
  };
  return spring;
}

function alternatingWeightedRackDrive(movement) {
  const root = new THREE.Group();

  // Brown's page provides an engraving and description but no animation.
  // The working/return branches are therefore reconstructed as exact traces
  // of rigid rack guide pins.  Zero-velocity dwells at the two guide corners
  // let the rack pair exchange mesh without tooth interference.
  const cycleDuration = 8;
  const ascentEnd = 0.42;
  const topCrossoverEnd = 0.50;
  const descentEnd = 0.92;
  const pinionPitchRadius = 0.78;
  const pinionToothCount = 20;
  const pinionAngularPitch = FULL_TURN / pinionToothCount;
  const circularPitch = pinionPitchRadius * pinionAngularPitch;
  const stroke = 8 * circularPitch;
  const outputAdvancePerCycle = 2 * stroke / pinionPitchRadius;
  const rackPitchesPerStroke = stroke / circularPitch;
  const rackRootExtension = .60;
  const crossheadLowY = -2.76-rackRootExtension;
  const crossheadHighY = crossheadLowY + stroke;
  const rackPivotHalfSpacing = pinionPitchRadius + 0.26;
  const rackBodyLength = 4.36+rackRootExtension;
  const rackBodyWidth = 0.26;
  const rackDepth = 0.37;
  const rackToothHeight = 0.26;
  const rackToothCount = 17;
  const guideArm = 0.68;
  const guideY = 4.08+rackRootExtension;
  const outwardRackAngle = 0.205;
  const guidePlaneZ = -0.34;
  const rackPlaneZ = 0.12;
  const gearPlaneZ = 0.18;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.58,
  });
  const driverDarkMaterial = matte(0xb94531, {
    metalness: 0.17,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.67,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.49,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.42,
  });

  const phaseState = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    let stage;
    let stageProgress;
    let crossheadY;
    let crossheadVelocityPerPhase = 0;
    let crossheadAccelerationPerPhase2 = 0;
    let leftOutwardFraction;
    let leftOutwardRatePerPhase = 0;
    let rightOutwardFraction;
    let rightOutwardRatePerPhase = 0;
    let outputWithinCycle;
    let outputAngularSpeedPerPhase = 0;

    if (phase < ascentEnd) {
      stage = 'right-rack-A1-working-upstroke';
      stageProgress = phase / ascentEnd;
      const motion = quinticState(stageProgress);
      crossheadY = crossheadLowY + stroke * motion.value;
      crossheadVelocityPerPhase = stroke * motion.rate / ascentEnd;
      crossheadAccelerationPerPhase2 =
        stroke * motion.acceleration / ascentEnd ** 2;
      leftOutwardFraction = 1;
      rightOutwardFraction = 0;
      outputWithinCycle = (crossheadY - crossheadLowY)
        / pinionPitchRadius;
      outputAngularSpeedPerPhase = crossheadVelocityPerPhase
        / pinionPitchRadius;
    } else if (phase < topCrossoverEnd) {
      stage = 'top-zero-speed-guide-crossover-with-elbow-assist';
      stageProgress = (phase - ascentEnd)
        / (topCrossoverEnd - ascentEnd);
      const switchState = quinticState(stageProgress);
      crossheadY = crossheadHighY;
      leftOutwardFraction = 1-switchState.value;
      leftOutwardRatePerPhase = -switchState.rate
        / (topCrossoverEnd - ascentEnd);
      rightOutwardFraction = switchState.value;
      rightOutwardRatePerPhase = switchState.rate
        / (topCrossoverEnd - ascentEnd);
      outputWithinCycle = stroke / pinionPitchRadius;
    } else if (phase < descentEnd) {
      stage = 'left-rack-A-working-downstroke';
      stageProgress = (phase - topCrossoverEnd)
        / (descentEnd - topCrossoverEnd);
      const motion = quinticState(stageProgress);
      crossheadY = crossheadHighY - stroke * motion.value;
      crossheadVelocityPerPhase = -stroke * motion.rate
        / (descentEnd - topCrossoverEnd);
      crossheadAccelerationPerPhase2 = -stroke * motion.acceleration
        / (descentEnd - topCrossoverEnd) ** 2;
      leftOutwardFraction = 0;
      rightOutwardFraction = 1;
      outputWithinCycle = stroke / pinionPitchRadius
        - (crossheadY - crossheadHighY) / pinionPitchRadius;
      outputAngularSpeedPerPhase = -crossheadVelocityPerPhase
        / pinionPitchRadius;
    } else {
      stage = 'bottom-zero-speed-guide-crossover';
      stageProgress = (phase - descentEnd) / (1 - descentEnd);
      const switchState = quinticState(stageProgress);
      crossheadY = crossheadLowY;
      leftOutwardFraction = switchState.value;
      leftOutwardRatePerPhase = switchState.rate / (1 - descentEnd);
      rightOutwardFraction = 1-switchState.value;
      rightOutwardRatePerPhase = -switchState.rate / (1 - descentEnd);
      outputWithinCycle = 2 * stroke / pinionPitchRadius;
    }

    return {
      crossheadAccelerationPerPhase2,
      crossheadVelocityPerPhase,
      crossheadY,
      leftOutwardFraction,
      leftOutwardRatePerPhase,
      outputAngularSpeedPerPhase,
      outputWithinCycle,
      phase,
      rightOutwardFraction,
      rightOutwardRatePerPhase,
      stage,
      stageProgress,
    };
  };

  const rackPose = (side, phase) => {
    const phaseData = phaseState(phase);
    const outwardFraction = side < 0
      ? phaseData.leftOutwardFraction
      : phaseData.rightOutwardFraction;
    const outwardRate = side < 0
      ? phaseData.leftOutwardRatePerPhase
      : phaseData.rightOutwardRatePerPhase;
    const rackAngle = -side * outwardRackAngle * outwardFraction;
    const rackAngularRatePerPhase = -side * outwardRackAngle * outwardRate;
    const pivot = new THREE.Vector2(
      side * rackPivotHalfSpacing,
      phaseData.crossheadY,
    );
    const guidePinLocal = new THREE.Vector2(side * guideArm, guideY);
    const cosine = Math.cos(rackAngle);
    const sine = Math.sin(rackAngle);
    const guidePin = new THREE.Vector2(
      pivot.x + cosine * guidePinLocal.x - sine * guidePinLocal.y,
      pivot.y + sine * guidePinLocal.x + cosine * guidePinLocal.y,
    );
    return {
      guidePin,
      guidePinLocal,
      outwardFraction,
      pivot,
      rackAngle,
      rackAngularRatePerPhase,
    };
  };

  const guideCurves = {
    left: new GuidePinCurve(
      (phase) => rackPose(-1, phase).guidePin,
      guidePlaneZ,
    ),
    right: new GuidePinCurve(
      (phase) => rackPose(1, phase).guidePin,
      guidePlaneZ,
    ),
  };
  const leftGuide = makeGuideGroove({
    centerline: guideCurves.left,
    darkMaterial,
    frameMaterial,
    role: 'left-fixed-closed-guide-groove-b',
  });
  const rightGuide = makeGuideGroove({
    centerline: guideCurves.right,
    darkMaterial,
    frameMaterial,
    role: 'right-fixed-closed-guide-groove-b',
  });
  root.add(leftGuide, rightGuide);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-carrying-guide-grooves-and-output-bearing';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.05, 0.26, 1.45),
    frameMaterial,
  );
  base.position.set(0, -3.58, -0.36);
  base.userData.role = 'fixed-machine-bed';
  fixedFrame.add(base);
  const bearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 3.35, 0.34),
    frameMaterial,
  );
  bearingPost.position.set(0, -1.67, -0.62);
  bearingPost.userData.role = 'fixed-output-shaft-bearing-standard';
  fixedFrame.add(bearingPost);
  for (const side of [-1, 1]) {
    const support = makeDynamicLink({
      color: PALETTE.frame,
      depth: 0.25,
      jointRadius: 0.001,
      thickness: 0.17,
    });
    const lowerPoint = new THREE.Vector3(side * 2.52, -3.47, -0.55);
    const guidePoint = side < 0
      ? guideCurves.left.getPoint(0.70)
      : guideCurves.right.getPoint(0.18);
    support.userData.setEndpoints(
      lowerPoint,
      new THREE.Vector3(guidePoint.x, guidePoint.y, -0.55),
    );
    support.userData.role = 'fixed-guide-groove-support-standard';
    fixedFrame.add(support);
  }
  const pistonGuide = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.50, 36),
    frameMaterial,
  );
  pistonGuide.position.set(0, -3.34, 0);
  pistonGuide.userData.role = 'fixed-piston-rod-guide-collar';
  fixedFrame.add(pistonGuide);
  root.add(fixedFrame);

  const outputGear = makeSpurGear({
    darkMaterial,
    depth: 0.48,
    material: drivenMaterial,
    pitchRadius: pinionPitchRadius,
    toothCount: pinionToothCount,
    toothHeight: rackToothHeight,
    whiteMaterial,
  });
  outputGear.position.set(0, 0, gearPlaneZ);
  root.add(outputGear);

  const crosshead = new THREE.Group();
  crosshead.position.z = rackPlaneZ - 0.12;
  crosshead.userData.role =
    'one-reciprocating-piston-rod-crosshead-carrying-both-rack-pivots';
  const crossheadBeam = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.18, 0.34),
    driverDarkMaterial,
  );
  crossheadBeam.userData.role = 'rigid-two-pivot-crosshead';
  crosshead.add(crossheadBeam);
  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 2.35, 24),
    darkMaterial,
  );
  pistonRod.position.y = -1.22;
  pistonRod.userData.role = 'reciprocating-input-piston-rod';
  crosshead.add(pistonRod);
  const inputIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 18, 12),
    whiteMaterial,
  );
  inputIndex.position.set(0, -0.28, 0.23);
  inputIndex.userData.role = 'white-crosshead-reciprocation-index';
  crosshead.add(inputIndex);
  root.add(markShadows(crosshead));

  const leftRack = makeRack({
    bodyLength: rackBodyLength,
    bodyMaterial: driverMaterial,
    bodyWidth: rackBodyWidth,
    circularPitch,
    darkMaterial,
    depth: rackDepth,
    guideArm,
    guideY,
    side: -1,
    toothCount: rackToothCount,
    toothHeight: rackToothHeight,
    toothMaterial: driverDarkMaterial,
    whiteMaterial,
  });
  const rightRack = makeRack({
    bodyLength: rackBodyLength,
    bodyMaterial: driverMaterial,
    bodyWidth: rackBodyWidth,
    circularPitch,
    darkMaterial,
    depth: rackDepth,
    guideArm,
    guideY,
    side: 1,
    toothCount: rackToothCount,
    toothHeight: rackToothHeight,
    toothMaterial: driverDarkMaterial,
    whiteMaterial,
  });
  leftRack.position.z = rackPlaneZ;
  rightRack.position.z = rackPlaneZ;
  root.add(leftRack, rightRack);

  const elbowPivot = new THREE.Vector3(1.48, 5.13-(Math.PI*pinionPitchRadius-stroke), 0.13);
  const elbowLever = new THREE.Group();
  elbowLever.position.copy(elbowPivot);
  elbowLever.userData.role =
    'spring-returned-elbow-lever-C-for-right-upper-guide-angle';
  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.10, -0.58, 0),
    new THREE.Vector3(0.03, -1.12, 0),
    new THREE.Vector3(0.47, -1.52, 0),
  ]);
  const leverBody = new THREE.Mesh(
    new THREE.TubeGeometry(leverCurve, 48, 0.105, 12, false),
    brassMaterial,
  );
  leverBody.userData.role = 'curved-two-arm-body-of-elbow-lever-C';
  elbowLever.add(leverBody);
  const leverPivotPin = cylinderAlongZ(0.13, 0.78, darkMaterial, 28);
  leverPivotPin.userData.role = 'fixed-upper-pivot-of-elbow-lever-C';
  elbowLever.add(leverPivotPin);
  const leverContactIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 18, 12),
    whiteMaterial,
  );
  leverContactIndex.position.set(0.47, -1.52, 0.28);
  leverContactIndex.userData.role =
    'white-index-at-elbow-lever-C-upper-crossover-contact';
  elbowLever.add(leverContactIndex);
  root.add(markShadows(elbowLever));

  const springAnchor = new THREE.Vector3(2.95, 4.82-(Math.PI*pinionPitchRadius-stroke), 0.13);
  const springAnchorBoss = cylinderAlongZ(0.10, 0.54, darkMaterial, 24);
  springAnchorBoss.position.copy(springAnchor);
  springAnchorBoss.userData.role = 'fixed-anchor-of-tension-spring-d';
  root.add(springAnchorBoss);
  const spring = makeDynamicCoilSpring(
    new THREE.LineBasicMaterial({ color: PALETTE.brass }),
  );
  root.add(spring);

  const stateAtTime = (time) => {
    const cycles = Math.floor(time / cycleDuration);
    const cycleTime = positiveModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const phaseData = phaseState(phase);
    const leftPose = rackPose(-1, phase);
    const rightPose = rackPose(1, phase);
    const outputAngle = cycles * outputAdvancePerCycle
      + phaseData.outputWithinCycle;
    const outputAngularSpeed = phaseData.outputAngularSpeedPerPhase
      / cycleDuration;
    const crossheadVelocity = phaseData.crossheadVelocityPerPhase
      / cycleDuration;
    const crossheadAcceleration =
      phaseData.crossheadAccelerationPerPhase2 / cycleDuration ** 2;
    const contactState = selectorState(rightPose,guideY,elbowPivot);
    const topAssistActive = phaseData.stage === 'top-zero-speed-guide-crossover-with-elbow-assist' && contactState.contact;
    const assistProgress = topAssistActive ? phaseData.stageProgress : 0;
    const leftRackPhaseError = wrappedSignedAngle(
      (phaseData.outputWithinCycle + (phaseData.crossheadY - crossheadLowY)
        / pinionPitchRadius) * pinionToothCount,
    );
    const rightRackPhaseError = wrappedSignedAngle(
      (phaseData.outputWithinCycle - (phaseData.crossheadY - crossheadHighY)
        / pinionPitchRadius + stroke/pinionPitchRadius) * pinionToothCount,
    );
    return {
      activeDrive: phaseData.stage,
      assistProgress,
      crossheadAcceleration,
      crossheadVelocity,
      crossheadY: phaseData.crossheadY,
      cycleTime,
      cycles,
      elbowAssist: {
        active: topAssistActive,
        ...contactState,
        loading: contactState.contact && !topAssistActive,
      },
      leftRack: {
        ...leftPose,
        angularSpeed: leftPose.rackAngularRatePerPhase / cycleDuration,
        engaged: phaseData.stage === 'left-rack-A-working-downstroke',
        toothPhaseError: leftRackPhaseError/pinionToothCount,
      },
      outputAngle,
      outputAngularSpeed,
      phase,
      rightRack: {
        ...rightPose,
        angularSpeed: rightPose.rackAngularRatePerPhase / cycleDuration,
        engaged: phaseData.stage === 'right-rack-A1-working-upstroke',
        toothPhaseError: rightRackPhaseError/pinionToothCount,
      },
      stageProgress: phaseData.stageProgress,
    };
  };

  const springAttachmentLocal = new THREE.Vector3(-0.02, -0.62, 0);
  const update = (time) => {
    const state = stateAtTime(time);
    crosshead.position.y = state.crossheadY;
    leftRack.position.set(
      state.leftRack.pivot.x,
      state.leftRack.pivot.y,
      rackPlaneZ,
    );
    leftRack.rotation.z = state.leftRack.rackAngle;
    rightRack.position.set(
      state.rightRack.pivot.x,
      state.rightRack.pivot.y,
      rackPlaneZ,
    );
    rightRack.rotation.z = state.rightRack.rackAngle;
    outputGear.rotation.z = state.outputAngle;
    elbowLever.rotation.z = state.elbowAssist.leverAngle;
    leverContactIndex.visible = state.elbowAssist.contact;
    root.userData.updateSelectorContact?.(state);
    const springAttachment = springAttachmentLocal.clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), elbowLever.rotation.z)
      .add(elbowPivot);
    spring.userData.setEndpoints(springAttachment, springAnchor);

    root.userData.contacts = {
      elbowLeverCToRightRackUpperCrossover: {
        active: state.elbowAssist.active,
        guidePin: state.rightRack.guidePin.clone(),
        progress: state.assistProgress,
        springDeflection: state.elbowAssist.springDeflection,
      },
      leftRackAToCogWheel: {
        active: state.leftRack.engaged,
        pitchLineVelocityError: state.leftRack.engaged
          ? state.crossheadVelocity
            + pinionPitchRadius * state.outputAngularSpeed
          : null,
        toothPhaseError: state.leftRack.engaged
          ? state.leftRack.toothPhaseError
          : null,
      },
      rightRackA1ToCogWheel: {
        active: state.rightRack.engaged,
        pitchLineVelocityError: state.rightRack.engaged
          ? state.crossheadVelocity
            - pinionPitchRadius * state.outputAngularSpeed
          : null,
        toothPhaseError: state.rightRack.engaged
          ? state.rightRack.toothPhaseError
          : null,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'dual-weighted-pivoted-racks-closed-guide-grooves-alternating-stroke-unidirectional-pinion',
    blocks: {
      crosshead,
      crossheadBeam,
      elbowLever,
      fixedFrame,
      guideCurves,
      inputIndex,
      leftGuide,
      leftRack,
      leverContactIndex,
      outputGear,
      pistonRod,
      rightGuide,
      rightRack,
      spring,
      springAnchorBoss,
    },
    constraintResiduals: {
      pitchesPerStroke: rackPitchesPerStroke - 8,
      outputCycleClosure: 5*outputAdvancePerCycle - 4*FULL_TURN,
      rackPitchIdentity:
        circularPitch - pinionPitchRadius * pinionAngularPitch,
    },
    constraints: {
      commonCrosshead:
        'Both lower pivots a translate together on one rigid piston-rod crosshead.',
      guideClosure:
        'Each guide groove b is the closed fixed locus of its rigid rack guide pin; inner and outer branches meet only during zero-speed crossovers.',
      meshSelection:
        'Rack A1 is exactly vertical and meshes on ascent; rack A is exactly vertical and meshes on descent. The spring-loaded selector pushes A1 outward at the upper corner.',
      rigidRack:
        'Each rack, its teeth, lower weight arm, upper guide arm, and guide pin are one rigid body about pivot a.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'common crosshead height',
        'rack A angle selected by left guide groove b',
        'rack A1 angle selected by right guide groove b',
        'cog-wheel angle from whichever rack is working',
        'spring-loaded elbow lever C deflection at the upper right corner',
      ],
      independentPrescribedInputs: 1,
      inputs: ['one reciprocating piston-rod stroke'],
      note:
        'The fixed guide grooves select the two rack attitudes; the corner traversal is prescribed; passive branch dynamics are not solved.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid links and frame',
        'zero backlash and exact common circular pitch at the active mesh',
        'quintic piston acceleration with short zero-speed corner dwells',
        'gravity weights and spring d shown kinematically without mass-force integration',
        'flywheel inertia, tooth compliance, friction, and impact omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless kinematic reconstruction',
    },
    fidelity: 'authored',
    geometry: {
      ascentEnd,
      circularPitch,
      crossheadHighY,
      crossheadLowY,
      descentEnd,
      gearPlaneZ,
      guideArm,
      guidePlaneZ,
      guideY,
      outwardRackAngle,
      outputAdvancePerCycle,
      markedClosureCycles: 5,
      pinionAngularPitch,
      pinionPitchRadius,
      pinionToothCount,
      rackRootExtension,
      rackBodyLength,
      rackBodyWidth,
      rackDepth,
      rackPitchesPerStroke,
      rackPivotHalfSpacing,
      rackToothCount,
      rackToothHeight,
      stroke,
      topCrossoverEnd,
    },
    mechanism:
      'one-piston-rod-crosshead-reciprocates-two-weighted-pivoted-racks-A-and-A1-whose-end-pins-follow-opposed-fixed-closed-guide-grooves-b-so-A1-meshes-on-ascent-and-A-meshes-on-descent-to-turn-one-cog-wheel-continuously-counterclockwise-while-spring-d-returns-elbow-lever-C-at-the-right-upper-corner',
    motion: {
      outputDirection: 'counterclockwise only, with zero speed at guide crossovers',
      outputTurnsPerInputCycle: .8,
      rackExchange:
        'top and bottom exchanges occur while the piston and cog wheel are instantaneously stationary',
      strokeLaw:
        'quintic rise, top crossover dwell, quintic fall, bottom crossover dwell',
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 391 page marks Animated unavailable and contains no canvas model.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate391: {
        elbowLeverUpperPivotPixels: [379, 26],
        gearCenterPixels: [249, 287],
        gearOuterRadiusPixels: 62,
        imageHeight: 525,
        imageWidth: 525,
        leftGuidePinPixels: [117, 193],
        leftLowerPivotPixels: [170, 480],
        measurementUncertaintyPixels: 10,
        rightGuidePinPixels: [419, 174],
        rightLowerPivotPixels: [321, 480],
      },
      constructionEvidence: {
        engravingEvidence:
          'The plate shows two inward-toothed racks on lower pivots a, two outboard D-shaped guide grooves b, one central cog wheel, unequal lower weights, and spring-loaded elbow lever C above the right upper corner.',
        explicitInBrownDescription: [
          'weighted racks A and A1',
          'both racks pivoted to the end of one piston rod',
          'rack-end pins working in fixed guide grooves b',
          'one rack operates ascending and the other descending',
          'elbow lever C and spring d carry the right-hand pin over the upper angle',
        ],
        reconstructionDisclosure:
          'Because no official animation is available, branch curvature, crossover dwell fraction, dimensions, tooth count, colors, and timing are independently engineered with the spring/selector direction determining the previously unspecified working-side assignment.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 391',
    },
    stateAtTime,
    timeline: {
      ascent: [0, ascentEnd],
      bottomCrossover: [descentEnd, 1],
      cycleDuration,
      descent: [topCrossoverEnd, descentEnd],
      topCrossover: [ascentEnd, topCrossoverEnd],
    },
    transmission: {
      activeMeshLaw:
        'theta=DeltaY/R on rack A1 ascent; theta=theta_top-DeltaY/R on rack A descent',
      fullCycleLaw: 'Delta theta = 2 stroke / R = 1.6 pi; the marked wheel closes after five piston cycles and four counterclockwise turns',
      guideLaw:
        'inner branch means rack angle zero and exact mesh; outer branch means rack angle is displaced outward by 0.205 rad',
      pitchLaw: 'p=2*pi*R/N and stroke=8*p; five piston cycles advance the wheel by four turns',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.25, -3.95, -1.05),
    new THREE.Vector3(3.30, 5.55, 1.05),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(1.4, 1.1, 12);
  root.userData.groundFloorY = -3.72;
  correctWeightedRackInterfaces(root);
  correctWeightedRackTeeth(root);
  installWeightedRackSelector(root);
  finishAlternatingDrive(root,update,cycleDuration);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredAlternatingWeightedRackMovement(movement) {
  if (movement.id !== 391) return null;
  return alternatingWeightedRackDrive(movement);
}
