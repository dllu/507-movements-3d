import * as THREE from 'three';
import { makeBoredPlanarLink } from './bored-planar-link.js';
import { boreZCylinder, addZJournal, finishSpringFamily } from './spring-pivot-family-parts.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function wrapSignedAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, FULL_TURN)
    - Math.PI;
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function findPeriodicRoots(evaluate, samples = 7200) {
  const roots = [];
  let previousAngle = 0;
  let previousValue = evaluate(previousAngle);
  for (let index = 1; index <= samples; index += 1) {
    const angle = FULL_TURN * index / samples;
    const value = evaluate(angle);
    if (value * previousValue < 0) {
      let lower = previousAngle;
      let upper = angle;
      let lowerValue = previousValue;
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const middle = (lower + upper) / 2;
        const middleValue = evaluate(middle);
        if (lowerValue * middleValue <= 0) {
          upper = middle;
        } else {
          lower = middle;
          lowerValue = middleValue;
        }
      }
      roots.push((lower + upper) / 2);
    }
    previousAngle = angle;
    previousValue = value;
  }
  return roots;
}

// Brown's spring A (plate 416) is a flat coiled spring on the fixed arbor A:
// its inner end is hooked in the key slot at the foot of the arbor, it wraps
// once closely round the arbor, opens out through a further half turn and
// leaves the top of the coil as a free tail that ends in an eye on crank pin B.
// The strip section is a flat rectangle. Its deformation is prescribed (the
// outer turn opens and closes with the arbor-to-pin distance and the tail is a
// smooth cubic onto the pin eye); it is not an elastic solve.
function makeCoiledSpringA(material, {thickness = 0.03, width = 0.10, startRadius = 0.292, wrapRadius = 0.31, endRadius = 0.89, eyeRadius = 0.13, restDistance = 1.24} = {}) {
  const wrapSteps = 120, openSteps = 110, tailSteps = 70;
  const count = wrapSteps + openSteps + tailSteps + 1;
  // Eight vertices per section (two per flat face) keep the four faces flat.
  const positions = new Float32Array(count * 8 * 3);
  const indices = [];
  for (let i = 0; i < count - 1; i += 1) for (let face = 0; face < 4; face += 1) {
    const a = i * 8 + face * 2, b = a + 1, c = a + 9, d = a + 8;
    indices.push(a, b, c, a, c, d);
  }
  for (const base of [0, (count - 1) * 8]) {
    const cap = [0, 2, 4, 6].map(k => base + k);
    if (base === 0) indices.push(cap[0], cap[2], cap[1], cap[0], cap[3], cap[2]);
    else indices.push(cap[0], cap[1], cap[2], cap[0], cap[2], cap[3]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.userData.deforming = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.userData.role = 'coiled-spring-A-on-fixed-arbor-with-tail-to-crank-pin-B';
  const points = Array.from({length: count}, () => new THREE.Vector2());
  const start = -Math.PI / 2, wrapEnd = start - 1.75 * Math.PI, restEnd = start - 3 * Math.PI;
  mesh.userData.setEndpoints = (anchor, pin) => {
    mesh.position.copy(anchor);
    const target = new THREE.Vector2(pin.x - anchor.x, pin.y - anchor.y);
    const distance = target.length(), stretch = distance - restDistance;
    // The open outer turn winds a little further and swells as B draws away.
    const end = restEnd - 0.22 * stretch, outer = endRadius + 0.10 * stretch;
    for (let i = 0; i <= wrapSteps; i += 1) {
      const u = i / wrapSteps, angle = start + (wrapEnd - start) * u;
      const radius = wrapRadius + (startRadius - wrapRadius) * (1 - Math.min(1, u * 8)) ** 2;
      points[i].set(radius * Math.cos(angle), radius * Math.sin(angle));
    }
    for (let i = 1; i <= openSteps; i += 1) {
      const u = i / openSteps, angle = wrapEnd + (end - wrapEnd) * u;
      const radius = wrapRadius + (outer - wrapRadius) * u ** 1.15;
      points[wrapSteps + i].set(radius * Math.cos(angle), radius * Math.sin(angle));
    }
    const join = points[wrapSteps + openSteps].clone();
    const direction = join.clone().sub(points[wrapSteps + openSteps - 1]).normalize();
    // The tail meets the pin eye on its side facing the coil.
    // It arrives square to the eye's rim, ending just on its surface.
    const eyeTouch = target.clone().addScaledVector(target.clone().sub(join).normalize(), -(eyeRadius + 0.003));
    const chord = eyeTouch.distanceTo(join);
    const c1 = join.clone().addScaledVector(direction, chord * 0.42);
    const arrive = target.clone().sub(eyeTouch).normalize();
    const c2 = eyeTouch.clone().addScaledVector(arrive, -chord * 0.30);
    for (let i = 1; i <= tailSteps; i += 1) {
      const u = i / tailSteps, v = 1 - u;
      points[wrapSteps + openSteps + i].set(
        v * v * v * join.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * eyeTouch.x,
        v * v * v * join.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * eyeTouch.y,
      );
    }
    for (let i = 0; i < count; i += 1) {
      const before = points[Math.max(0, i - 1)], after = points[Math.min(count - 1, i + 1)];
      const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy);
      const nx = -dy / length * thickness / 2, ny = dx / length * thickness / 2, p = points[i];
      const corners = [[1, -1], [1, 1], [1, 1], [-1, 1], [-1, 1], [-1, -1], [-1, -1], [1, -1]];
      for (let k = 0; k < 8; k += 1) {
        const [side, face] = corners[k], o = (i * 8 + k) * 3;
        positions[o] = p.x + side * nx;
        positions[o + 1] = p.y + side * ny;
        positions[o + 2] = face * width / 2;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    mesh.userData.attachmentDistance = distance;
    mesh.userData.tailEnd = eyeTouch.clone();
    mesh.userData.terminalPoint = pin.clone();
  };
  return mesh;
}

function springAssistedTreadle(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const crankAngularSpeed = FULL_TURN / cycleDuration;
  // Brown's plate (525 px): hub of crank B, pin B, the treadle joint, the
  // treadle's intermediate pivot lug, its tip and arbor A, at the flywheel's
  // 1.24 radius over its 128 px drawn radius.
  const plateScale = 1.24 / 128;
  const platePixels = {
    wheelCenter: [341.7, 173.3], crankPin: [272.3, 161.0], treadleJoint: [349.0, 437.3],
    treadlePivot: [245.0, 443.3], treadleTip: [38.3, 439.3], arbor: [158.3, 219.3],
  };
  const wheelCenter = new THREE.Vector3(1.00, 1.05, 0);
  const fromPlate = ([x, y]) => new THREE.Vector3(
    wheelCenter.x + (x - platePixels.wheelCenter[0]) * plateScale,
    wheelCenter.y - (y - platePixels.wheelCenter[1]) * plateScale, 0);
  const sourceCrankPin = fromPlate(platePixels.crankPin);
  const sourceTreadleJoint = fromPlate(platePixels.treadleJoint);
  const treadlePivot = fromPlate(platePixels.treadlePivot);
  const sourceTreadleTip = fromPlate(platePixels.treadleTip);
  const sourceCrankAngle = Math.atan2(sourceCrankPin.y - wheelCenter.y, sourceCrankPin.x - wheelCenter.x);
  const crankRadius = sourceCrankPin.distanceTo(wheelCenter);
  const treadleJointRadius = sourceTreadleJoint.distanceTo(treadlePivot);
  const pitmanLength = sourceCrankPin.distanceTo(sourceTreadleJoint);
  const wheelRadius = 1.24;
  const springPlaneZ = 0.66;
  const springAnchor = fromPlate(platePixels.arbor).setZ(springPlaneZ);
  const springRate = 5;
  const springTurns = 1.5;
  const springCoilRadius = 0.89;

  const linkageAtCrankAngle = (crankAngle) => {
    const crankRadial = new THREE.Vector3(
      crankRadius * Math.cos(crankAngle),
      crankRadius * Math.sin(crankAngle),
      0,
    );
    const crankPin = wheelCenter.clone().add(crankRadial);
    const groundToCrank = crankPin.clone().sub(treadlePivot);
    const groundToCrankLength = groundToCrank.length();
    const groundAngle = Math.atan2(groundToCrank.y, groundToCrank.x);
    const cosineOffset = THREE.MathUtils.clamp(
      (treadleJointRadius ** 2 + groundToCrankLength ** 2
        - pitmanLength ** 2)
        / (2 * treadleJointRadius * groundToCrankLength),
      -1,
      1,
    );
    const treadleAngle = groundAngle - Math.acos(cosineOffset);
    const treadleRadial = new THREE.Vector3(
      treadleJointRadius * Math.cos(treadleAngle),
      treadleJointRadius * Math.sin(treadleAngle),
      0,
    );
    const treadleJoint = treadlePivot.clone().add(treadleRadial);
    const pitmanVector = treadleJoint.clone().sub(crankPin);
    return {
      crankAngle,
      crankPin,
      crankRadial,
      deadCenterMoment: cross2(crankRadial, pitmanVector),
      groundToCrankLength,
      pitmanVector,
      treadleAngle,
      treadleJoint,
      treadleRadial,
    };
  };

  const deadCenterAngles = findPeriodicRoots((angle) =>
    linkageAtCrankAngle(angle).deadCenterMoment);
  if (deadCenterAngles.length !== 2) {
    throw new Error('Movement 416 must have exactly two crank dead centers');
  }
  const springAttachmentAtCrankAngle = (angle) => {
    const attachment = linkageAtCrankAngle(angle).crankPin.clone();
    attachment.z = springAnchor.z;
    return attachment;
  };
  const deadCenterSpringLengths = deadCenterAngles.map((angle) =>
    springAttachmentAtCrankAngle(angle).distanceTo(springAnchor));
  const springNeutralLength = (
    deadCenterSpringLengths[0] + deadCenterSpringLengths[1]
  ) / 2;

  const stateAtCrankAngle = (
    crankAngle,
    crankSpeed = crankAngularSpeed,
    crankAcceleration = 0,
  ) => {
    const linkage = linkageAtCrankAngle(crankAngle);
    const crankUnit = linkage.crankRadial.clone()
      .multiplyScalar(1 / crankRadius);
    const crankTangent = new THREE.Vector3(-crankUnit.y, crankUnit.x, 0);
    const treadleUnit = linkage.treadleRadial.clone()
      .multiplyScalar(1 / treadleJointRadius);
    const treadleTangent = new THREE.Vector3(
      -treadleUnit.y,
      treadleUnit.x,
      0,
    );
    const pitmanVelocityDenominator = treadleJointRadius
      * linkage.pitmanVector.dot(treadleTangent);
    const treadleAngularSpeed = crankRadius * crankSpeed
      * linkage.pitmanVector.dot(crankTangent)
      / pitmanVelocityDenominator;
    const crankPinVelocity = crankTangent.clone()
      .multiplyScalar(crankRadius * crankSpeed);
    const treadleJointVelocity = treadleTangent.clone()
      .multiplyScalar(treadleJointRadius * treadleAngularSpeed);
    const relativeVelocity = treadleJointVelocity.clone()
      .sub(crankPinVelocity);
    const treadleAngularAcceleration = (
      -relativeVelocity.lengthSq()
      + treadleJointRadius * treadleAngularSpeed ** 2
        * linkage.pitmanVector.dot(treadleUnit)
      + crankRadius * crankAcceleration
        * linkage.pitmanVector.dot(crankTangent)
      - crankRadius * crankSpeed ** 2
        * linkage.pitmanVector.dot(crankUnit)
    ) / pitmanVelocityDenominator;
    const springAttachment = linkage.crankPin.clone();
    springAttachment.z = springAnchor.z;
    const springAxis = springAttachment.clone().sub(springAnchor);
    const springLength = springAxis.length();
    const springExtension = springLength - springNeutralLength;
    const springAxisUnit = springAxis.clone().multiplyScalar(1 / springLength);
    const springForceOnCrank = springAxisUnit.clone()
      .multiplyScalar(-springRate * springExtension);
    const springTorque = cross2(
      linkage.crankRadial,
      springForceOnCrank,
    );
    const tangentialSpringForce = springForceOnCrank.dot(crankTangent);
    const radialSpringForce = springForceOnCrank.dot(crankUnit);
    const springPotentialEnergy = springRate * springExtension ** 2 / 2;
    const angularDistancesToDeadCenters = deadCenterAngles.map((angle) =>
      Math.abs(wrapSignedAngle(crankAngle - angle)));
    return {
      ...linkage,
      angularDistanceToNearestDeadCenter: Math.min(
        ...angularDistancesToDeadCenters,
      ),
      crankAcceleration,
      crankPinVelocity,
      crankSpeed,
      crankTangent,
      crankUnit,
      pitmanLengthResidual: linkage.pitmanVector.length() - pitmanLength,
      pitmanVelocityConstraintResidual: linkage.pitmanVector.dot(
        relativeVelocity,
      ),
      radialSpringForce,
      relativeVelocity,
      springAxis,
      springAxisUnit,
      springAttachment,
      springCondition: springExtension > 1e-10
        ? 'tension'
        : springExtension < -1e-10
          ? 'compression'
          : 'neutral',
      springExtension,
      springForceOnCrank,
      springLength,
      springPotentialEnergy,
      springPower: springTorque * crankSpeed,
      springTorque,
      tangentialSpringForce,
      treadleAngularAcceleration,
      treadleAngularSpeed,
      treadleJointVelocity,
      treadleTangent,
      treadleUnit,
    };
  };

  const deadCenterStates = deadCenterAngles.map((angle) =>
    stateAtCrankAngle(angle));
  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const crankAngle = sourceCrankAngle
      + crankAngularSpeed * cycleTime;
    return {
      ...stateAtCrankAngle(crankAngle),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const centerToSpringAnchorLength = Math.hypot(
    springAnchor.x - wheelCenter.x,
    springAnchor.y - wheelCenter.y,
  );
  const springMinimumLengthAngle = Math.atan2(
    springAnchor.y - wheelCenter.y,
    springAnchor.x - wheelCenter.x,
  );
  const springMaximumLengthAngle = springMinimumLengthAngle + Math.PI;
  const minimumSpringLength = centerToSpringAnchorLength - crankRadius;
  const maximumSpringLength = centerToSpringAnchorLength + crankRadius;
  let minimumTreadleAngle = Infinity;
  let maximumTreadleAngle = -Infinity;
  let minimumAt = 0, maximumAt = 0;
  for (let index = 0; index <= 7200; index += 1) {
    const angle = FULL_TURN * index / 7200;
    const sample = stateAtCrankAngle(angle);
    if (sample.treadleAngle < minimumTreadleAngle) { minimumTreadleAngle = sample.treadleAngle; minimumAt = angle; }
    if (sample.treadleAngle > maximumTreadleAngle) { maximumTreadleAngle = sample.treadleAngle; maximumAt = angle; }
  }
  // Refine both extremes of the rocking treadle by golden-section search.
  const refineExtreme = (center, sign) => {
    let lower = center - FULL_TURN / 7200, upper = center + FULL_TURN / 7200;
    const golden = (Math.sqrt(5) - 1) / 2;
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const a = upper - golden * (upper - lower), b = lower + golden * (upper - lower);
      if (sign * linkageAtCrankAngle(a).treadleAngle < sign * linkageAtCrankAngle(b).treadleAngle) upper = b;
      else lower = a;
    }
    return linkageAtCrankAngle((lower + upper) / 2).treadleAngle;
  };
  minimumTreadleAngle = refineExtreme(minimumAt, 1);
  maximumTreadleAngle = refineExtreme(maximumAt, -1);

  const geometry = {
    crankAngularSpeed,
    crankRadius,
    cycleDuration,
    deadCenterAngles,
    deadCenterSpringLengths,
    maximumSpringLength,
    maximumTreadleAngle,
    minimumSpringLength,
    minimumTreadleAngle,
    pitmanLength,
    sourceCrankAngle,
    springAnchor,
    springCoilRadius,
    springNeutralLength,
    springRate,
    springTurns,
    springMaximumLengthAngle,
    springMinimumLengthAngle,
    treadleJointRadius,
    treadlePivot,
    wheelCenter,
    wheelRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.26,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.21,
    roughness: 0.47,
  });
  const springMaterial = matte(PALETTE.accent, {
    metalness: 0.34,
    roughness: 0.38,
  });
  const steelPinMaterial = matte(PALETTE.muted, { metalness: 0.2, roughness: 0.40 });

  // Brown draws no frame. The fixed arbor A (with the key slot that holds the
  // spring's inner end), the crankshaft and the treadle pivot pin are short
  // stubs that end cleanly just behind the parts they carry.
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-arbor-A-crankshaft-and-treadle-pivot-stubs';
  const arborRadius = 0.194;
  const arbor = cylinderAlongZ(arborRadius, 0.42, frameMaterial, 48);
  arbor.position.copy(springAnchor).setZ(springPlaneZ - 0.15);
  arbor.userData.role = 'fixed-arbor-A-carrying-spring-inner-end';
  fixedFrame.add(arbor);
  const arborKey = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.10, 0.12), frameMaterial);
  arborKey.position.set(springAnchor.x, springAnchor.y - 0.225, springPlaneZ);
  arborKey.userData.role = 'arbor-A-key-holding-spring-inner-end';
  fixedFrame.add(arborKey);
  const crankShaft = cylinderAlongZ(0.13, 0.80, darkMaterial, 40);
  crankShaft.position.copy(wheelCenter).setZ(0.0);
  crankShaft.userData.role = 'fixed-crankshaft-journal-for-flywheel-and-crank-B';
  fixedFrame.add(crankShaft);
  // Pass 101: the pin (0.004 running clearance in the lug's 0.048 bore)
  // stands only 0.01 proud of the lug's front face, so at the oblique default
  // view it no longer reads off-centre with a pale crescent of bore beside it.
  const treadleShaft = cylinderAlongZ(0.044, 0.22, darkMaterial, 40);
  treadleShaft.position.copy(treadlePivot).setZ(0.33);
  treadleShaft.userData.role = 'fixed-treadle-pivot-pin';
  fixedFrame.add(treadleShaft);
  root.add(fixedFrame);

  const flywheelRotor = new THREE.Group();
  flywheelRotor.position.copy(wheelCenter);
  flywheelRotor.userData.role =
    'continuous-full-rotation-flywheel-and-crank-B-rotor';
  const flywheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadius, 0.12, 14, 96),
    drivenMaterial,
  );
  flywheelRim.position.z = -0.08;
  flywheelRim.userData.role = 'heavy-flywheel-rim-fast-on-crankshaft';
  flywheelRotor.add(flywheelRim);
  // Brown draws the flywheel as a plain disc: a bored web, no spokes.
  const flywheelWeb = cylinderAlongZ(wheelRadius - 0.06, 0.10, drivenMaterial, 96);
  boreZCylinder(flywheelWeb, wheelRadius - 0.06, 0.134, 0.10);
  flywheelWeb.position.z = -0.08;
  flywheelWeb.userData.role = 'plain-flywheel-disc-web-fast-on-crankshaft';
  flywheelRotor.add(flywheelWeb);
  const flywheelHub = addZJournal(flywheelRotor, 0.28, 0.134, 0.36, drivenMaterial,
    new THREE.Vector3(0, 0, -0.06), 'flywheel-hub-fast-on-crankshaft');
  // Crank B: Brown's round boss on the shaft tapering to the pin eye.
  const crankOutline = polygonClipping.union(
    poly(circle([0, 0], 0.35, 96)), poly(circle([crankRadius, 0], 0.13, 64)),
    poly([[0, -0.20], [crankRadius, -0.10], [crankRadius, 0.10], [0, 0.20]]));
  const crankArm = new THREE.Mesh(plate(polygonClipping.difference(crankOutline,
    poly(circle([0, 0], 0.134, 64))), 0.12, 0.30), driverMaterial);
  crankArm.userData.role = 'rigid-crank-B-arm';
  flywheelRotor.add(crankArm);
  const crankHub = crankArm;
  // Steel pins (the role names are historical): white ones would read as
  // holes on the cream page.
  const crankPin = cylinderAlongZ(0.075, 0.44, steelPinMaterial, 28);
  crankPin.position.set(crankRadius, 0, 0.52);
  crankPin.userData.role = 'white-crank-B-pin-and-spring-attachment';
  flywheelRotor.add(crankPin);
  root.add(flywheelRotor);

  // Brown's slim treadle bar tapers to its left tip; its pivot lug hangs
  // below the bar at the intermediate fulcrum and the eye at its right end
  // takes the pitman.
  const treadleRotor = new THREE.Group();
  treadleRotor.position.copy(treadlePivot);
  treadleRotor.userData.role = 'rocking-foot-treadle-input';
  const sourceTreadleAngle = Math.atan2(sourceTreadleJoint.y - treadlePivot.y, sourceTreadleJoint.x - treadlePivot.x);
  const tipLocal = sourceTreadleTip.clone().sub(treadlePivot).applyAxisAngle(new THREE.Vector3(0, 0, 1), -sourceTreadleAngle);
  const barHalf = x => 0.018 + 0.026 * (x - tipLocal.x) / (treadleJointRadius - tipLocal.x);
  const barTop = [], barBottom = [];
  for (const x of [tipLocal.x, treadleJointRadius]) {
    const y = x === tipLocal.x ? tipLocal.y : 0;
    barTop.push([x, y + barHalf(x)]);
    barBottom.push([x, y - barHalf(x)]);
  }
  const treadleOutline = polygonClipping.union(
    poly([barBottom[0], barBottom[1], barTop[1], barTop[0]]),
    poly(circle([tipLocal.x, tipLocal.y], barHalf(tipLocal.x), 24)),
    poly(circle([0, 0], 0.09, 64)),
    poly(circle([treadleJointRadius, 0], 0.145, 64)));
  const treadleBeam = new THREE.Mesh(plate(polygonClipping.difference(treadleOutline,
    poly(circle([0, 0], 0.048, 48)), poly(circle([treadleJointRadius, 0], 0.08, 48))),
  -0.05, 0.05), driverMaterial);
  treadleBeam.position.z = 0.38;
  treadleBeam.userData.role = 'rigid-treadle-lever-with-intermediate-pivot-lug';
  treadleRotor.add(treadleBeam);
  const treadleHub = treadleBeam;
  const treadleJointPin = cylinderAlongZ(0.075, 0.24, steelPinMaterial, 24);
  treadleJointPin.position.set(treadleJointRadius, 0, 0.44);
  treadleJointPin.userData.role = 'white-treadle-to-pitman-joint';
  treadleRotor.add(treadleJointPin);
  root.add(treadleRotor);

  const pitman = makeBoredPlanarLink({length:pitmanLength,width:.10,eyeRadius:.145,boreRadius:.079,depth:.08},darkMaterial);
  pitman.userData.role = 'constant-length-pitman-from-crank-B-to-treadle';
  root.add(pitman);
  const spring = makeCoiledSpringA(springMaterial, {restDistance: sourceCrankPin.distanceTo(springAnchor.clone().setZ(0))});
  root.add(spring);
  const springCrankEye = addZJournal(root, 0.13, 0.079, 0.10, springMaterial, springAnchor, 'spring-A-tail-eye-on-crank-pin-B');
  const springAnchorPin = arbor;

  const update = (time) => {
    const state = stateAtTime(time);
    flywheelRotor.rotation.z = state.crankAngle;
    treadleRotor.rotation.z = state.treadleAngle;
    const pitmanStart = state.crankPin.clone();
    const pitmanEnd = state.treadleJoint.clone();
    pitmanStart.z = 0.49;
    pitmanEnd.z = 0.49;
    pitman.userData.setEndpoints(pitmanStart, pitmanEnd);
    spring.userData.setEndpoints(springAnchor, state.springAttachment);
    springCrankEye.position.copy(state.springAttachment);
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'preloaded-tension-compression-helical-spring-assisted-full-rotation-crank-rocker-treadle-through-both-dead-centers',
    blocks: {
      crankArm,
      crankHub,
      crankPin,
      fixedFrame,
      flywheelRotor,
      pitman,
      crankShaft,
      treadleShaft,
      treadleHub,
      arbor,
      arborKey,
      flywheelHub,
      springCrankEye,
      spring,
      springAnchorPin,
      treadleJointPin,
      treadleRotor,
    },
    deadCenterStates,
    degreesOfFreedom: {
      elasticEnergyStates: 1,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pitmanLengthIndependent: false,
      treadleAngleIndependent: false,
    },
    dynamics: {
      gravityDampingInertiaFootLoadsAndBearingFrictionModeled: false,
      helicalSpringLaw: 'force=-springRate*(length-neutralLength)',
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      springPotentialEnergy: '0.5*springRate*extension^2',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Crank B and its flywheel make one continuous turn while a constant-length pitman rocks the treadle through exact four-bar closure. Preloaded spring A, coiled on its arbor, is stretched at the upper toggle and compressed at the lower toggle; its force therefore gives B positive tangential torque at both zero-leverage dead centers, exchanging stored energy without imposing net work over a complete turn.',
    motion: {
      cycleDuration,
      crankAngularSpeed,
      crankTurnsPerCycle: 1,
      springBehavior:
        'tension at one dead center, compression at the other, neutral between them',
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 416 page marks its Animated control unavailable and supplies only Brown’s static plate.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      crankAngle: sourceState.crankAngle,
      springCondition: sourceState.springCondition,
      treadleAngle: sourceState.treadleAngle,
    },
    sourceReference: {
      brownPlate416: {
        crankBPinApproximatePixels: [270, 164],
        flywheelApproximateBoundsPixels: [213, 48, 469, 304],
        helicalSpringAApproximateBoundsPixels: [92, 126, 274, 267],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        pitmanApproximateEndpointsPixels: [[270, 164], [350, 439]],
        treadleApproximateBoundsPixels: [39, 428, 364, 465],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism belongs to a treadle motion',
          'the device assists the crank over the dead centers',
          'A is a helical spring',
          'B is the crank',
          'A tends to move B at right angles to the dead centers',
        ],
        engravingEvidence:
          'Brown’s plate shows one flywheel and crank B, a long pitman from B to a rocking treadle, and a separately anchored spring A whose free end reaches the crankpin.',
        reconstructionDisclosure:
          'Brown fixes the crank, pitman, treadle, spring attachment, and intended dead-center assistance but gives no link lengths, spring rate, preload, speed, or force values. The flywheel centre, crank pin, treadle pivot lug, treadle joint and arbor A are measured from the plate; the full-turn timing, the flat coiled spring on arbor A (one close turn round the keyed arbor opening out through a further half turn into a free tail hooked on crank pin B, its outer turn and tail deforming by a prescribed rule rather than an elastic solve), the ideal linear spring-force readout along the arbor-to-pin line, and the neutral spring length halfway between the two toggle lengths are independently engineered. The latter makes the modeled spring pull at one dead center and push at the other so both tangential torques have the same sign.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 416',
    },
    stateAtCrankAngle,
    stateAtTime,
    transmission: {
      deadCenterDefinition:
        'cross(crank radial vector, pitman vector)=0',
      fourBarClosure:
        'distance(crank pin B,treadle joint)=constant pitman length',
      springAssistance:
        'cross(crank radial vector,spring force)>0 at both dead centers',
      springWork:
        'spring force derives from 0.5*k*extension^2, so its net work is zero over a closed crank turn',
      velocityClosure:
        'pitmanVector dot (treadleJointVelocity-crankPinVelocity)=0',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.05, -2.30, -0.40),
    new THREE.Vector3(2.42, 2.45, 0.76),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(5.8, 3.8, 10.8);
  finishSpringFamily(root, cycleDuration);
  markShadows(root);
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSpringAssistedTreadleMovement(movement) {
  if (movement.id !== 416) return null;
  return springAssistedTreadle(movement);
}
