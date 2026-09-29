import { correctFriction267, finishFrictionFamily } from './friction-family-working-parts.js';
import * as THREE from 'three';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
import {
  PALETTE,
  makeDynamicCable,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function wrappedAngle(angle) {
  const turns = angle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-11) return 0;
  return THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
}

function smootherStep(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * clamped ** 2 * (1 - clamped) ** 2;
}

function smootherStepSecondDerivative(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * clamped * (1 - clamped) * (1 - 2 * clamped);
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function annularExtrusionGeometry({ depth, innerRadius, outerRadius }) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 96,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function lobedCarrierGeometry({
  baseRadius,
  boreRadius,
  depth,
  lobeAmplitude,
  lobeCount,
  phase,
}) {
  const shape = new THREE.Shape();
  const segments = 128;
  for (let index = 0; index <= segments; index += 1) {
    const angle = FULL_TURN * index / segments;
    const radius = baseRadius
      + lobeAmplitude * Math.cos(lobeCount * (angle - phase));
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 64,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cubicPoint(points, progress) {
  const inverse = 1 - progress;
  return points[0].clone().multiplyScalar(inverse ** 3)
    .add(points[1].clone().multiplyScalar(3 * inverse ** 2 * progress))
    .add(points[2].clone().multiplyScalar(3 * inverse * progress ** 2))
    .add(points[3].clone().multiplyScalar(progress ** 3));
}

function cubicTangent(points, progress) {
  const inverse = 1 - progress;
  return points[1].clone().sub(points[0])
    .multiplyScalar(3 * inverse ** 2)
    .add(points[2].clone().sub(points[1])
      .multiplyScalar(6 * inverse * progress))
    .add(points[3].clone().sub(points[2])
      .multiplyScalar(3 * progress ** 2))
    .normalize();
}

function taperedCurvedArmGeometry({
  controlPoints,
  depth,
  endHalfWidth,
  startHalfWidth,
}) {
  const outer = [];
  const inner = [];
  const samples = 48;
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const center = cubicPoint(controlPoints, progress);
    const tangent = cubicTangent(controlPoints, progress);
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const widthProgress = smootherStep(progress);
    const halfWidth = THREE.MathUtils.lerp(
      startHalfWidth,
      endHalfWidth,
      widthProgress,
    );
    outer.push(center.clone().addScaledVector(normal, halfWidth));
    inner.push(center.clone().addScaledVector(normal, -halfWidth));
  }
  const shape = new THREE.Shape();
  shape.moveTo(outer[0].x, outer[0].y);
  outer.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
  inner.reverse().forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 24,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function radialSpoke({
  angle,
  depth,
  innerRadius,
  material,
  outerRadius,
  width,
  z,
}) {
  const length = outerRadius - innerRadius;
  const spoke = new THREE.Mesh(
    new THREE.BoxGeometry(length, width, depth),
    material,
  );
  const centerRadius = (innerRadius + outerRadius) / 2;
  spoke.position.set(
    centerRadius * Math.cos(angle),
    centerRadius * Math.sin(angle),
    z,
  );
  spoke.rotation.z = angle;
  return spoke;
}

function clockwiseArrow({ material, radius, z }) {
  const points = [];
  const startAngle = THREE.MathUtils.degToRad(55);
  const endAngle = THREE.MathUtils.degToRad(20);
  const samples = 42;
  for (let index = 0; index <= samples; index += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      index / samples,
    );
    points.push(new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const group = new THREE.Group();
  const arc = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 48, 0.022, 8, false),
    material,
  );
  arc.userData.role = 'fixed-source-clockwise-freewheel-direction-arrow';
  const end = points.at(-1);
  const tangent = new THREE.Vector3(
    Math.sin(endAngle),
    -Math.cos(endAngle),
    0,
  ).normalize();
  const arrowhead = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.22, 20),
    material,
  );
  arrowhead.position.copy(end).addScaledVector(tangent, 0.05);
  arrowhead.quaternion.setFromUnitVectors(Y_AXIS, tangent);
  arrowhead.userData.role = 'clockwise-freewheel-arrowhead';
  group.add(arc, arrowhead);
  group.userData.role = 'fixed-clockwise-arrow-not-part-of-pulley';
  return group;
}

function zigzagSpringPoints(anchor, attachment, z) {
  const direction = attachment.clone().sub(anchor);
  const length = direction.length();
  if (length < 1e-10) return [
    new THREE.Vector3(anchor.x, anchor.y, z),
    new THREE.Vector3(attachment.x, attachment.y, z),
  ];
  direction.multiplyScalar(1 / length);
  const normal = new THREE.Vector2(-direction.y, direction.x);
  const points = [];
  const bends = 8;
  for (let index = 0; index <= bends; index += 1) {
    const progress = index / bends;
    const point = anchor.clone().lerp(attachment, progress);
    if (index > 0 && index < bends) {
      point.addScaledVector(normal, index % 2 === 0 ? -0.04 : 0.04);
    }
    points.push(new THREE.Vector3(point.x, point.y, z));
  }
  return points;
}

function springBiasedOverrunningPulley(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.94);

  const rimOuterRadius = 2.2;
  const rimInnerRadius = 2;
  const rimDepth = 0.34;
  const rearWebZ = -0.22;
  const rearWebDepth = 0.12;
  const looseHubOuterRadius = 0.55;
  const shaftRadius = 0.31;
  // Pass 107: pivot centres measured from the plate's four pin circles.
  const carrierPhase = THREE.MathUtils.degToRad(79);
  const carrierBaseRadius = 0.75;
  const carrierLobeAmplitude = 0.13;
  const carrierDepth = 0.22;
  const carrierZ = 0.2;
  const pivotRadius = 0.67;
  const pivotBossRadius = 0.055;
  const pivotCount = 4;
  // Brown's wedge: the radial straight side leads the pivot by 10.8 degrees,
  // the shoe runs from 1 to 15.5 degrees behind it (the clockwise end is the
  // drawn contact), and the relief ends on the rim 6 degrees ahead.
  const straightEdgeLead = THREE.MathUtils.degToRad(10.8);
  const straightEdgeOuterRadius = 1.78;
  const reliefEndLead = THREE.MathUtils.degToRad(6);
  const reliefDepth = 0.035;
  const shoeStartLead = THREE.MathUtils.degToRad(-1);
  const contactLeadAngle = THREE.MathUtils.degToRad(-15.5);
  const releasedArmAngle = THREE.MathUtils.degToRad(-21);
  // The plates lie behind the carrier, as drawn (the hub covers their roots).
  const armDepth = 0.14;
  const armPlaneZ = -0.02;
  const bandDepth = 0.12;
  const springPlaneZ = armPlaneZ;
  const pinBack = armDepth / 2 + 0.012 - armPlaneZ;
  const pinFront = carrierZ + carrierDepth / 2 + 0.025 + 0.012;
  const clipBack = bandDepth / 2 + 0.01;
  const clipFront = carrierZ - carrierDepth / 2 - 0.025 + 0.01 - armPlaneZ;
  const driveDuration = 4;
  const freewheelDuration = 4;
  const springResetDuration = 1.2;
  const demonstrationPeriod = driveDuration
    + freewheelDuration + springResetDuration;
  const armReleaseFraction = 0.32;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.6,
  });
  const armMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });

  const outerRotor = new THREE.Group();
  outerRotor.userData.axis = new THREE.Vector3(0, 0, 1);
  outerRotor.userData.role =
    'independently-rotating-friction-pulley-rim-and-loose-rear-web';
  const rim = new THREE.Mesh(
    annularExtrusionGeometry({
      depth: rimDepth,
      innerRadius: rimInnerRadius,
      outerRadius: rimOuterRadius,
    }),
    driverMaterial,
  );
  rim.userData.role = 'continuous-inner-surface-driving-pulley-rim';
  const innerLiner = new THREE.Mesh(
    new THREE.TorusGeometry(
      rimInnerRadius + 0.035,
      0.035,
      9,
      120,
    ),
    darkMaterial,
  );
  innerLiner.position.z = rimDepth / 2 + 0.012;
  innerLiner.userData.role = 'friction-rim-inner-working-surface';

  const looseHub = new THREE.Mesh(
    annularExtrusionGeometry({
      depth: rearWebDepth,
      // Free on the shaft with a 0.003 running fit.
      innerRadius: shaftRadius + 0.003,
      outerRadius: looseHubOuterRadius,
    }),
    driverMaterial,
  );
  looseHub.position.z = rearWebZ;
  looseHub.userData.role = 'loose-pulley-hub-free-on-output-shaft';
  const spokes = Array.from({ length: 4 }, (_, index) => {
    const spoke = radialSpoke({
      // Behind the middle of each wedge, so the plates hide the rear web
      // while the clutch is locked (Brown draws no spokes).
      angle: carrierPhase - THREE.MathUtils.degToRad(2.35) + index * Math.PI / 2,
      depth: rearWebDepth,
      innerRadius: looseHubOuterRadius - 0.03,
      material: driverMaterial,
      outerRadius: rimInnerRadius + 0.02,
      width: 0.15,
      z: rearWebZ,
    });
    spoke.userData.role = 'rear-loose-pulley-web-spoke';
    return spoke;
  });
  // Brown draws no index marks on the rim, shaft or arm tips; the white
  // rotation indices were removed in the pass-51 wave-4 review.
  outerRotor.add(
    rim,
    innerLiner,
    looseHub,
    ...spokes,
  );

  const carrierRotor = new THREE.Group();
  carrierRotor.userData.axis = new THREE.Vector3(0, 0, 1);
  carrierRotor.userData.role =
    'output-shaft-carrier-with-four-independent-pivoted-eccentric-arms';
  const carrier = new THREE.Mesh(
    lobedCarrierGeometry({
      baseRadius: carrierBaseRadius,
      // Keyed to the shaft: the bore is the shaft radius.
      boreRadius: shaftRadius,
      depth: carrierDepth,
      lobeAmplitude: carrierLobeAmplitude,
      lobeCount: pivotCount,
      phase: carrierPhase,
    }),
    drivenMaterial,
  );
  carrier.position.z = carrierZ;
  carrier.userData.role = 'four-lobed-output-shaft-arm-carrier';
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, 1.18, 40),
    darkMaterial,
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.03;
  shaft.userData.role = 'driven-output-shaft-rigid-with-arm-carrier';
  // A turned steel end face on the black shaft (it was the carrier's blue,
  // so the shaft end read as an empty tube showing the carrier through it).
  const shaftFace = new THREE.Mesh(
    new THREE.CircleGeometry(shaftRadius * 0.82, 40),
    matte(PALETTE.muted, { metalness: 0.35, roughness: 0.42 }),
  );
  shaftFace.position.z = 0.625;
  shaftFace.userData.role = 'driven-output-shaft-front-face';
  carrierRotor.add(carrier, shaft, shaftFace);

  // Pass 107: each arm is a wedge-shaped plate traced from the engraving
  // (the enclosed white region between a radial line and a curved band) and
  // idealized to lines and circular arcs. In arm coordinates (origin at the
  // pivot, +x along the pivot radial), carrier polar angles are relative to
  // the pivot's radial. The plate's counterclockwise side is Brown's straight
  // radial line (10.8 degrees ahead of the pivot), tangent to the pivot eye;
  // its outer end is a broad shoe concentric with the rim from 1 to 15.5
  // degrees behind the pivot radial, relieved ahead of it (Brown's chamfer);
  // its clockwise side is Brown's curved band, a circular arc about bandCenter.
  // Only shoe points behind (clockwise of) the pivot radial meet the rim, so
  // counterclockwise drag swings the plate outward and wedges it, and
  // clockwise drag swings it inward and releases it.
  const shoeInnerRadius = rimInnerRadius * Math.cos(Math.PI / 768) - 1e-6;
  const polarArm = (radius, angle) => new THREE.Vector2(
    radius * Math.cos(angle) - pivotRadius,
    radius * Math.sin(angle),
  );
  const eyeRadius = pivotRadius * Math.sin(straightEdgeLead);
  const bandCenter = new THREE.Vector2(0.282, -0.79);
  const bandRadius = 0.62;
  const bandHalfWidth = 0.025;
  const bandEdgeRadius = bandRadius + bandHalfWidth + 0.003;
  const bandTopAngle = THREE.MathUtils.degToRad(49.2);
  const bandContactEndAngle = THREE.MathUtils.degToRad(98);
  const bandClipAngle = THREE.MathUtils.degToRad(158);
  const bandRootAngle = THREE.MathUtils.degToRad(166);
  const onBand = (radius, angle) => bandCenter.clone().add(
    new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(radius),
  );
  const armOutline = [];
  const pushArc = (center, radius, from, to, steps) => {
    for (let index = 0; index <= steps; index += 1) {
      const angle = THREE.MathUtils.lerp(from, to, index / steps);
      armOutline.push(center.clone().add(
        new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(radius),
      ));
    }
  };
  const tangentStart = polarArm(pivotRadius * Math.cos(straightEdgeLead), straightEdgeLead);
  armOutline.push(tangentStart, polarArm(straightEdgeOuterRadius, straightEdgeLead));
  armOutline.push(polarArm(shoeInnerRadius - reliefDepth, reliefEndLead));
  for (let index = 0; index <= 96; index += 1) {
    const angle = THREE.MathUtils.lerp(shoeStartLead, contactLeadAngle, index / 96);
    armOutline.push(polarArm(shoeInnerRadius, angle));
  }
  armOutline.push(polarArm(1.8, contactLeadAngle - THREE.MathUtils.degToRad(0.3)));
  pushArc(bandCenter, bandEdgeRadius, bandTopAngle, bandContactEndAngle, 64);
  const bandLow = armOutline.at(-1);
  const lowDistance = bandLow.length();
  const lowAngle = Math.atan2(bandLow.y, bandLow.x);
  const eyeTangentAngle = lowAngle - Math.acos(eyeRadius / lowDistance);
  const tangentStartAngle = Math.atan2(tangentStart.y, tangentStart.x);
  pushArc(new THREE.Vector2(0, 0), eyeRadius, eyeTangentAngle,
    tangentStartAngle - FULL_TURN, 64);
  armOutline.pop();
  const armRegion = clip.difference(
    poly(armOutline.map((point) => point.toArray())),
    poly(circle([0, 0], pivotBossRadius + 0.004, 64)),
  );
  const armGeometry = plate(armRegion, -armDepth / 2, armDepth / 2);
  const bandOutline = [];
  for (let index = 0; index <= 96; index += 1) {
    const angle = THREE.MathUtils.lerp(bandTopAngle + 0.04, bandRootAngle, index / 96);
    bandOutline.push(onBand(bandRadius - bandHalfWidth, angle).toArray());
  }
  for (let index = 1; index < 24; index += 1) {
    const u = Math.PI * index / 24;
    const end = onBand(bandRadius, bandRootAngle);
    const radial = new THREE.Vector2(Math.cos(bandRootAngle), Math.sin(bandRootAngle));
    const tangent = new THREE.Vector2(-radial.y, radial.x);
    bandOutline.push(end.clone().addScaledVector(radial, -bandHalfWidth * Math.cos(u))
      .addScaledVector(tangent, bandHalfWidth * Math.sin(u)).toArray());
  }
  for (let index = 0; index <= 96; index += 1) {
    const angle = THREE.MathUtils.lerp(bandRootAngle, bandTopAngle + 0.04, index / 96);
    bandOutline.push(onBand(bandRadius + bandHalfWidth, angle).toArray());
  }
  for (let index = 1; index < 24; index += 1) {
    const u = Math.PI * index / 24;
    const end = onBand(bandRadius, bandTopAngle + 0.04);
    const radial = new THREE.Vector2(Math.cos(bandTopAngle + 0.04), Math.sin(bandTopAngle + 0.04));
    const tangent = new THREE.Vector2(-radial.y, radial.x);
    bandOutline.push(end.clone().addScaledVector(radial, bandHalfWidth * Math.cos(u))
      .addScaledVector(tangent, -bandHalfWidth * Math.sin(u)).toArray());
  }
  const bandTop = onBand(bandEdgeRadius, bandTopAngle);
  const bandClip = onBand(bandRadius + 0.02, bandClipAngle);

  const pivotLocal = new THREE.Vector2(pivotRadius, 0);
  const contactRadial = new THREE.Vector2(
    Math.cos(contactLeadAngle),
    Math.sin(contactLeadAngle),
  );
  const tipOuterRelative = contactRadial.clone()
    .multiplyScalar(rimInnerRadius)
    .sub(pivotLocal);
  const arms = [];
  const pivotBosses = [];
  const springs = [];
  const springDefinitions = [];

  for (let index = 0; index < pivotCount; index += 1) {
    const baseAngle = carrierPhase - index * Math.PI / 2;
    const pivot = new THREE.Vector2(
      pivotRadius * Math.cos(baseAngle),
      pivotRadius * Math.sin(baseAngle),
    );
    const armGroup = new THREE.Group();
    armGroup.position.set(pivot.x, pivot.y, armPlaneZ);
    armGroup.rotation.z = baseAngle;
    armGroup.userData.baseAngle = baseAngle;
    armGroup.userData.role = 'spring-biased-pivoted-eccentric-friction-arm';
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.userData.armIndex = index;
    arm.userData.contactLeadAngle = contactLeadAngle;
    arm.userData.eccentricArm = true;
    arm.userData.role = 'wedge-shaped-eccentric-friction-arm-plate';
    armGroup.add(arm);
    arms.push(armGroup);
    carrierRotor.add(armGroup);

    // A plain steel pin through the carrier lobe (Brown's small circles) and
    // the plate's eye behind it.
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(pivotBossRadius, pivotBossRadius, pinBack + pinFront, 30),
      darkMaterial,
    );
    boss.rotation.x = Math.PI / 2;
    boss.position.set(pivot.x, pivot.y, (pinFront - pinBack) / 2);
    boss.userData.role = 'fixed-to-carrier-eccentric-arm-pivot-pin';
    pivotBosses.push(boss);
    carrierRotor.add(boss);

    // Brown's curved band is the leaf spring: clipped to the carrier by the
    // small rectangle beside the next pivot, it runs up the plate's clockwise
    // flank to the plate's outer corner. Retracting the plate bends it; its
    // free part follows the plate and its root stays in the clip.
    const spring = new THREE.Group();
    spring.position.set(pivot.x, pivot.y, armPlaneZ);
    spring.rotation.z = baseAngle;
    const leafGeometry = plate(poly(bandOutline), -bandDepth / 2, bandDepth / 2);
    const leaf = new THREE.Mesh(leafGeometry, darkMaterial);
    leaf.userData.role = 'curved-leaf-spring-along-arm-flank';
    const restPositions = leafGeometry.attributes.position.array.slice();
    const restNormals = leafGeometry.attributes.normal.array.slice();
    const clipBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.1, clipBack + clipFront),
      darkMaterial,
    );
    // Across the band, from just inside it to under the carrier's edge.
    clipBlock.position.set(bandClip.x, bandClip.y, (clipFront - clipBack) / 2);
    clipBlock.rotation.z = bandClipAngle;
    clipBlock.userData.role = 'spring-clip-on-carrier';
    spring.add(leaf, clipBlock);
    spring.userData.leaf = leaf;
    spring.userData.seat = clipBlock;
    spring.userData.restPositions = restPositions;
    spring.userData.restNormals = restNormals;
    spring.userData.role = 'spring-holding-eccentric-arm-toward-rim';
    springs.push(spring);
    carrierRotor.add(spring);
    springDefinitions.push({ baseAngle, pivot, spring });
  }

  const directionArrow = clockwiseArrow({
    material: darkMaterial,
    // Brown's short feathered arrow sits just outside the rim between
    // roughly 1 and 2 o'clock (plate raster 396,79 -> 466,194).
    radius: 2.42,
    z: 0.48,
  });
  root.add(outerRotor, carrierRotor, directionArrow);

  const armWorkingPointAtAngle = (armPivotAngle) => pivotLocal.clone().add(
    rotate2(tipOuterRelative, armPivotAngle),
  );
  const armTipRadiusAtAngle = (armPivotAngle) => (
    armWorkingPointAtAngle(armPivotAngle).length()
  );
  const armTipClearanceAtAngle = (armPivotAngle) => (
    rimInnerRadius - armTipRadiusAtAngle(armPivotAngle)
  );
  // Spring span: the clip to the plate's outer corner, where the band ends.
  const springLengthAtAngle = (armPivotAngle) => (
    bandClip.distanceTo(rotate2(bandTop, armPivotAngle))
  );

  const stateAtTime = (time) => {
    const phase = THREE.MathUtils.euclideanModulo(time, demonstrationPeriod);
    const completedCycles = Math.round((time - phase) / demonstrationPeriod);
    const outputCycleBase = completedCycles * FULL_TURN;
    let stage;
    let rimAngleUnwrapped;
    let rimAngularSpeed;
    let rimAngularAcceleration;
    let outputAngleUnwrapped;
    let outputAngularSpeed;
    let outputAngularAcceleration;
    let armPivotAngle;
    let armPivotAngularSpeed;
    let armPivotAngularAcceleration;

    if (phase < driveDuration) {
      const progress = phase / driveDuration;
      const position = smootherStep(progress);
      const rate = smootherStepDerivative(progress) / driveDuration;
      const acceleration = smootherStepSecondDerivative(progress)
        / driveDuration ** 2;
      stage = 'opposite-arrow-counterclockwise-locked-drive';
      rimAngleUnwrapped = FULL_TURN * position;
      rimAngularSpeed = FULL_TURN * rate;
      rimAngularAcceleration = FULL_TURN * acceleration;
      outputAngleUnwrapped = outputCycleBase + FULL_TURN * position;
      outputAngularSpeed = rimAngularSpeed;
      outputAngularAcceleration = rimAngularAcceleration;
      armPivotAngle = 0;
      armPivotAngularSpeed = 0;
      armPivotAngularAcceleration = 0;
    } else if (phase < driveDuration + freewheelDuration) {
      const localTime = phase - driveDuration;
      const progress = localTime / freewheelDuration;
      const position = smootherStep(progress);
      const rate = smootherStepDerivative(progress) / freewheelDuration;
      const acceleration = smootherStepSecondDerivative(progress)
        / freewheelDuration ** 2;
      const releaseProgress = THREE.MathUtils.clamp(
        progress / armReleaseFraction,
        0,
        1,
      );
      const releasePosition = smootherStep(releaseProgress);
      const releaseRate = releaseProgress < 1
        ? smootherStepDerivative(releaseProgress)
          / (freewheelDuration * armReleaseFraction)
        : 0;
      const releaseAcceleration = releaseProgress < 1
        ? smootherStepSecondDerivative(releaseProgress)
          / (freewheelDuration * armReleaseFraction) ** 2
        : 0;
      stage = 'arrow-direction-clockwise-freewheel';
      rimAngleUnwrapped = FULL_TURN * (1 - position);
      rimAngularSpeed = -FULL_TURN * rate;
      rimAngularAcceleration = -FULL_TURN * acceleration;
      outputAngleUnwrapped = outputCycleBase + FULL_TURN;
      outputAngularSpeed = 0;
      outputAngularAcceleration = 0;
      armPivotAngle = releasedArmAngle * releasePosition;
      armPivotAngularSpeed = releasedArmAngle * releaseRate;
      armPivotAngularAcceleration = releasedArmAngle * releaseAcceleration;
    } else {
      const localTime = phase - driveDuration - freewheelDuration;
      const progress = localTime / springResetDuration;
      const position = smootherStep(progress);
      const rate = smootherStepDerivative(progress) / springResetDuration;
      const acceleration = smootherStepSecondDerivative(progress)
        / springResetDuration ** 2;
      stage = 'stationary-spring-return-to-rim';
      rimAngleUnwrapped = 0;
      rimAngularSpeed = 0;
      rimAngularAcceleration = 0;
      outputAngleUnwrapped = outputCycleBase + FULL_TURN;
      outputAngularSpeed = 0;
      outputAngularAcceleration = 0;
      armPivotAngle = releasedArmAngle * (1 - position);
      armPivotAngularSpeed = -releasedArmAngle * rate;
      armPivotAngularAcceleration = -releasedArmAngle * acceleration;
    }

    const armTipRadius = armTipRadiusAtAngle(armPivotAngle);
    const armTipClearance = rimInnerRadius - armTipRadius;
    return {
      armPivotAngle,
      armPivotAngularAcceleration,
      armPivotAngularSpeed,
      armTipClearance,
      armTipRadius,
      clutchLocked: Math.abs(armPivotAngle) < 1e-12,
      completedCycles,
      outputAngle: wrappedAngle(outputAngleUnwrapped),
      outputAngleUnwrapped,
      outputAngularAcceleration,
      outputAngularSpeed,
      outputShaftAtRest: outputAngularSpeed === 0,
      phase,
      relativeRimOutputAngularSpeed:
        rimAngularSpeed - outputAngularSpeed,
      rimAngle: wrappedAngle(rimAngleUnwrapped),
      rimAngleUnwrapped,
      rimAngularAcceleration,
      rimAngularSpeed,
      springLength: springLengthAtAngle(armPivotAngle),
      stage,
      time,
    };
  };

  const engagedWorkingPoint = armWorkingPointAtAngle(0);
  const engagedForceDirection = new THREE.Vector2(
    -Math.sin(contactLeadAngle),
    Math.cos(contactLeadAngle),
  );
  const engagedLeverArm = tipOuterRelative.clone();
  const engagingTorquePerUnitTangentialForce = (
    engagedLeverArm.x * engagedForceDirection.y
      - engagedLeverArm.y * engagedForceDirection.x
  );
  const radialExpansionPerArmRadian = contactRadial.dot(
    new THREE.Vector2(-engagedLeverArm.y, engagedLeverArm.x),
  );

  root.userData.archetype =
    'spring-biased-four-pivot-eccentric-arm-overrunning-friction-pulley';
  root.userData.mechanism =
    'four-spring-biased-eccentric-arms-are-pivoted-to-the-output-shaft-carrier-inside-an-independent-pulley-rim-counterclockwise-friction-wedges-the-arms-for-one-to-one-drive-while-clockwise-friction-retracts-them-and-the-rim-overruns-a-stationary-shaft';
  root.userData.blocks = {
    arms,
    carrier,
    carrierRotor,
    directionArrow,
    innerLiner,
    looseHub,
    outerRotor,
    pivotBosses,
    rim,
    shaft,
    shaftFace,
    spokes,
    springs,
  };
  root.userData.canonicalTimes = {
    driveMidpoint: driveDuration / 2,
    freewheelMidpoint: driveDuration + freewheelDuration / 2,
    lockedDriveEnd: driveDuration,
    maximumRelease: driveDuration
      + freewheelDuration * armReleaseFraction,
    sourcePose: 0,
    springResetStart: driveDuration + freewheelDuration,
    cycleClosure: demonstrationPeriod,
  };
  root.userData.contactDefinition = {
    arrowDirection: 'clockwise-negative-about-the-visible-positive-z-face',
    engagedWorkingPoint: engagedWorkingPoint.clone(),
    engagingTorquePerUnitTangentialForce,
    freewheelTorquePerUnitTangentialForce:
      -engagingTorquePerUnitTangentialForce,
    radialExpansionPerArmRadian,
    reason:
      'the arm contact leads its carrier pivot clockwise so counterclockwise rim drag rotates the eccentric toward increasing radius and clockwise drag rotates it inward',
  };
  root.userData.driveSchedule = {
    input:
      'one-smooth-counterclockwise-locked-rim-turn-one-smooth-clockwise-freewheel-return-then-a-stationary-spring-reset',
    purpose:
      'both source-prescribed directions are shown without an angular teleport and the spring action is visible before the next drive stroke',
    sourcePrescribesTiming: false,
  };
  root.userData.geometry = {
    armDepth,
    armOutline: armOutline.map((point) => point.clone()),
    armPlaneZ,
    bandCenter: bandCenter.clone(),
    bandClipAngle,
    bandContactEndAngle,
    bandHalfWidth,
    bandRadius,
    bandRootAngle,
    bandTopAngle,
    carrierBaseRadius,
    carrierDepth,
    carrierLobeAmplitude,
    carrierPhase,
    carrierZ,
    contactLeadAngle,
    eyeRadius,
    looseHubOuterRadius,
    pivotBossRadius,
    pivotCount,
    pivotRadius,
    rearWebDepth,
    rearWebZ,
    reliefDepth,
    reliefEndLead,
    releasedArmAngle,
    releasedTipClearance: armTipClearanceAtAngle(releasedArmAngle),
    rimDepth,
    rimInnerRadius,
    rimOuterRadius,
    shaftRadius,
    shoeInnerRadius,
    shoeStartLead,
    springPlaneZ,
    straightEdgeLead,
    straightEdgeOuterRadius,
    tipOuterRelative: tipOuterRelative.clone(),
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement 267 page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate267: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one independently rotating loose pulley rim (carried by an undrawn rear web) surrounding a shaft-fixed four-lobed carrier with four pivoted wedge-shaped eccentric plates and four return springs (the curved bands clipped to the carrier)',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterArrow: {
        end: { x: 466, y: 194 },
        start: { x: 396, y: 79 },
      },
      // Pass 107: where each wedge's clockwise side meets the rim (the end
      // of its shoe) and the centres of the four pin circles on the hub.
      rasterArmContactPoints: [
        { x: 347, y: 97 },
        { x: 433, y: 357 },
        { x: 183, y: 438 },
        { x: 95, y: 194 },
      ],
      rasterCarrierPivotCenters: [
        { x: 276, y: 205 },
        { x: 328, y: 283 },
        { x: 253, y: 333 },
        { x: 206, y: 258 },
      ],
      rasterInnerWorkingRadius: 190,
      rasterOuterRimCenter: { x: 266, y: 269 },
      rasterOuterRimRadius: 209,
      rasterShaftRadius: 33,
      rasterArmCount: 4,
      // The four straight lines are the wedges' radial sides, not spokes.
      rasterSpokeCount: 0,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 67,
      edition: 21,
      illustrationPage: 66,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    armReleaseFraction,
    demonstrationPeriod,
    driveDuration,
    freewheelDuration,
    springResetDuration,
  };
  root.userData.transmission = {
    arrowDirectionOutputAngularSpeed: 0,
    arrowDirectionShaftRemainsAtRest: true,
    oppositeArrowLockedRatio: 1,
    oppositeArrowMotion: 'counterclockwise-positive',
    outputAdvancePerDemonstrationCycle: FULL_TURN,
  };

  // The band's free part (on the plate's flank) follows the plate; from the
  // end of that contact to the clip it bends progressively (a smooth ramp of
  // the plate's rotation about the pivot), and its root stays in the clip.
  const bendWeight = (point) => {
    const angle = Math.atan2(point.y - bandCenter.y, point.x - bandCenter.x);
    const u = THREE.MathUtils.clamp(
      (angle - bandContactEndAngle) / (bandClipAngle - bandContactEndAngle), 0, 1,
    );
    return 1 - smootherStep(u);
  };
  const bandWeights = (() => {
    const rest = springDefinitions[0].spring.userData.restPositions;
    const weights = new Float32Array(rest.length / 3);
    for (let index = 0; index < weights.length; index += 1) {
      weights[index] = bendWeight(new THREE.Vector2(rest[3 * index], rest[3 * index + 1]));
    }
    return weights;
  })();
  let bentAngle = null;
  const updateSprings = (armPivotAngle) => {
    if (armPivotAngle === bentAngle) return;
    bentAngle = armPivotAngle;
    springDefinitions.forEach(({ spring }) => {
      const { leaf, restNormals, restPositions } = spring.userData;
      const position = leaf.geometry.attributes.position;
      const normal = leaf.geometry.attributes.normal;
      for (let index = 0; index < bandWeights.length; index += 1) {
        const angle = bandWeights[index] * armPivotAngle;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const x = restPositions[3 * index];
        const y = restPositions[3 * index + 1];
        position.array[3 * index] = c * x - s * y;
        position.array[3 * index + 1] = s * x + c * y;
        const nx = restNormals[3 * index];
        const ny = restNormals[3 * index + 1];
        normal.array[3 * index] = c * nx - s * ny;
        normal.array[3 * index + 1] = s * nx + c * ny;
      }
      position.needsUpdate = true;
      normal.needsUpdate = true;
      leaf.geometry.computeBoundingBox();
      leaf.geometry.computeBoundingSphere();
      spring.userData.bendAngle = armPivotAngle;
    });
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(outerRotor, state.rimAngle);
    setSpin(carrierRotor, state.outputAngle);
    arms.forEach((arm) => {
      arm.rotation.z = arm.userData.baseAngle + state.armPivotAngle;
    });
    updateSprings(state.armPivotAngle);
    outerRotor.userData.angularSpeed = state.rimAngularSpeed;
    carrierRotor.userData.angularSpeed = state.outputAngularSpeed;
    root.userData.contacts = arms.map((_, index) => ({
      armIndex: index,
      clearance: state.armTipClearance,
      engaged: state.clutchLocked,
      rimRadius: rimInnerRadius,
      tipRadius: state.armTipRadius,
    }));
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(2.5, 2.1, 10.8),
  };
}

export function createAuthoredFrictionClutchMovement(movement) {
  if (movement.id !== 267) return null;
  const result = springBiasedOverrunningPulley(movement);
  result.root.userData.fidelity = 'authored';
  return finishFrictionFamily(correctFriction267(result), 267);
}
