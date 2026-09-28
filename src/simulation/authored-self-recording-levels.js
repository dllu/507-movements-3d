import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { boredCylinderGeometry, fitPistonGuide } from './piston-guide-parts.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { bevelToothGeometry, bevelBodyGeometry } from './bevel-geometry.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, depth, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function cylinderAlongX(radius, depth, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
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

function lineTube(points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    closed,
    'centripetal',
  );
  const tubularSegments = Math.max(96, points.length * 3);
  const radialSegments = 8;
  const geometry = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    radius,
    radialSegments,
    closed,
  );
  if (!closed) capTubeEnds(geometry, tubularSegments, radialSegments);
  return new THREE.Mesh(geometry, material);
}

// Closes an open TubeGeometry with a flat fan at each end that reuses the
// end-ring vertices, so the tube is a watertight solid.
function capTubeEnds(geometry, tubularSegments, radialSegments) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const ring = radialSegments + 1;
  const positions = Array.from(position.array);
  const normals = Array.from(normal.array);
  const uvs = Array.from(uv.array);
  const indices = Array.from(geometry.index.array);
  for (const [ringIndex, sign] of [[0, -1], [tubularSegments, 1]]) {
    const start = ringIndex * ring;
    const center = new THREE.Vector3();
    for (let j = 0; j < radialSegments; j += 1) {
      center.add(new THREE.Vector3().fromBufferAttribute(position, start + j));
    }
    center.multiplyScalar(1 / radialSegments);
    const centerIndex = positions.length / 3;
    positions.push(center.x, center.y, center.z);
    normals.push(0, 0, 0);
    uvs.push(0.5, 0.5);
    for (let j = 0; j < radialSegments; j += 1) {
      const a = start + j;
      const b = start + j + 1;
      if (sign > 0) indices.push(centerIndex, a, b);
      else indices.push(centerIndex, b, a);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
}

// Involute spur outline with a small circumferential backlash, extruded
// along +Z and bored for its shaft.
function spurGearGeometry({ teeth, pitchRadius, depth, boreRadius, backlash = 0.012 }) {
  const pressureAngle = THREE.MathUtils.degToRad(20);
  const module = 2 * pitchRadius / teeth;
  const rootRadius = pitchRadius - 1.25 * module;
  const outerRadius = pitchRadius + module;
  const baseRadius = pitchRadius * Math.cos(pressureAngle);
  const pitch = FULL_TURN / teeth;
  const involute = (radius) => {
    if (radius <= baseRadius) return 0;
    const t = Math.sqrt((radius / baseRadius) ** 2 - 1);
    return t - Math.atan(t);
  };
  const pitchHalf = Math.PI / (2 * teeth) - backlash / (2 * pitchRadius)
    + Math.tan(pressureAngle) - pressureAngle;
  const startRadius = Math.max(rootRadius, baseRadius);
  const shape = new THREE.Shape();
  let first = true;
  const add = (radius, angle) => {
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (first) { shape.moveTo(x, y); first = false; } else shape.lineTo(x, y);
  };
  for (let index = 0; index < teeth; index += 1) {
    const center = index * pitch;
    add(rootRadius, center - pitch / 2);
    add(rootRadius, center - (pitchHalf - involute(startRadius)));
    for (let sample = 0; sample <= 8; sample += 1) {
      const radius = THREE.MathUtils.lerp(startRadius, outerRadius, sample / 8);
      add(radius, center - (pitchHalf - involute(radius)));
    }
    for (let sample = 8; sample >= 0; sample -= 1) {
      const radius = THREE.MathUtils.lerp(startRadius, outerRadius, sample / 8);
      add(radius, center + (pitchHalf - involute(radius)));
    }
    add(rootRadius, center + (pitchHalf - involute(startRadius)));
  }
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
  shape.holes.push(bore);
  return new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 32,
    depth,
  }).translate(0, 0, -depth / 2);
}

function makeWheel(
  radius,
  materials,
  role,
) {
  const rotor = new THREE.Group();
  rotor.userData.role = role;
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 0.055, 0.055, 12, 128),
    materials.dark,
  );
  tire.userData.role = `${role}-road-tire`;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.77, 0.050, 10, 56),
    materials.frame,
  );
  rim.userData.role = `${role}-inner-rim`;
  const hub = new THREE.Mesh(boredCylinderGeometry(radius * 0.16, 0.058, 0.34), materials.accent);
  hub.rotation.x = Math.PI / 2;
  hub.userData.role = `${role}-hub-on-transverse-axle`;
  rotor.add(tire, rim, hub);
  const spokes = Array.from({ length: 8 }, (_, index) => {
    const angle = FULL_TURN * index / 8;
    const spoke = beamBetween(
      new THREE.Vector3(
        radius * 0.13 * Math.cos(angle),
        radius * 0.13 * Math.sin(angle),
        0,
      ),
      new THREE.Vector3(
        radius * 0.73 * Math.cos(angle),
        radius * 0.73 * Math.sin(angle),
        0,
      ),
      0.055,
      // Pass 90: no deeper than the 0.10 rim and tyre (was 0.12, a lip).
      0.095,
      materials.frame,
    );
    spoke.userData.role = `${role}-spoke-${index + 1}`;
    rotor.add(spoke);
    return spoke;
  });
  const rotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    materials.white,
  );
  rotationIndex.position.set(0, radius * 0.77, 0.14);
  rotationIndex.userData.role = `${role}-white-no-slip-rotation-index`;
  rotor.add(rotationIndex);
  return { hub, rim, rotationIndex, rotor, spokes, tire };
}

function selfRecordingLevel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8.0;
  const triangleBase = 4.0;
  const wheelRadius = triangleBase / FULL_TURN;
  const wheelCircumference = FULL_TURN * wheelRadius;
  const leftWheelCenter = new THREE.Vector2(-triangleBase / 2, 0);
  const rightWheelCenter = new THREE.Vector2(triangleBase / 2, 0);
  // Brown's plate, scaled by its wheel-centre base (385 px per unit at 2x):
  // the arch rises about 1.85 over the axles with the pendulum eye on top,
  // the dotted apex stands 3.64 up, and the ruled drum (about 1.77 long,
  // radius 0.38) turns on its own shaft 0.61 above the axles, level with the
  // pendulum's middle eye. The bob hangs just below axle level.
  const constructionApex = new THREE.Vector2(0, 3.64);
  const pendulumPivot = new THREE.Vector2(0, 1.9);
  const pendulumBobRadius = 2.08;
  const maximumGroundInclination = 0.205;
  const drumRadius = 0.38;
  const chartContactRadius = drumRadius + 0.0008;
  const drumLength = 1.77;
  const drumCenter = new THREE.Vector3(0, 0.61, 0.60);
  const pencilPendulumRadius = pendulumPivot.y - drumCenter.y;
  // A 1:1 spur pair lifts the bevel output to the drum shaft.
  const drumSpurPitchRadius = drumCenter.y / 2;
  const drumSpurTeeth = 16;
  const drumSpurX = -1.465;
  const drumSpurWidth = 0.30;
  const wheelToDrumRatio = 1;
  const chartTraceSamples = 360;
  const drumVerticalScaleOffset = 0;
  const drumAxialPaperOffset = 0;
  const groundDashSpacing = triangleBase / 8;
  const groundDisplayLength = triangleBase * 1.90;
  const geometry = {
    drumSpurPitchRadius,
    drumSpurTeeth,
    drumSpurWidth,
    drumSpurX,
    chartTraceSamples,
    chartContactRadius,
    constructionApex,
    cycleDuration,
    drumAxialPaperOffset,
    drumCenter,
    drumLength,
    drumRadius,
    drumVerticalScaleOffset,
    groundDashSpacing,
    groundDisplayLength,
    leftWheelCenter,
    maximumGroundInclination,
    pencilPendulumRadius,
    pendulumBobRadius,
    pendulumPivot,
    rightWheelCenter,
    triangleBase,
    wheelCircumference,
    wheelRadius,
    wheelToDrumRatio,
  };

  const frameMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.53,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.22,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.44,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });
  const paperMaterial = matte(0xe8e2cf, {
    metalness: 0,
    roughness: 0.91,
  });
  const terrainMaterial = matte(0x77766f, {
    metalness: 0.02,
    roughness: 0.92,
  });
  const traceMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.driver,
    linewidth: 2,
  });
  const materials = {
    accent: accentMaterial,
    dark: darkMaterial,
    frame: frameMaterial,
    white: whiteMaterial,
  };

  const terrain = new THREE.Group();
  terrain.userData.role =
    'moving-local-tangent-ground-demonstrating-one-base-length-of-travel';
  const groundBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      groundDisplayLength,
      0.16,
      0.48,
    ),
    terrainMaterial,
  );
  groundBeam.position.set(0, -wheelRadius - 0.08, -0.08);
  groundBeam.userData.role = 'instantaneous-straight-ground-tangent';
  terrain.add(groundBeam);
  const groundDashes = Array.from({ length: 16 }, (_, index) => {
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.025, 0.025),
      whiteMaterial,
    );
    dash.position.set(
      -groundDisplayLength / 2 + index * groundDashSpacing,
      -wheelRadius + 0.015,
      0.18,
    );
    dash.userData.role = `ground-travel-index-${index + 1}`;
    terrain.add(dash);
    return dash;
  });
  root.add(terrain);

  const carriage = new THREE.Group();
  carriage.userData.role =
    'two-wheel-isosceles-frame-surveying-carriage';
  root.add(carriage);
  const leftWheel = makeWheel(
    wheelRadius,
    materials,
    'left-ground-driven-survey-wheel',
  );
  leftWheel.rotor.position.set(leftWheelCenter.x, leftWheelCenter.y, 0);
  carriage.add(leftWheel.rotor);
  const rightWheel = makeWheel(
    wheelRadius,
    materials,
    'right-no-slip-survey-wheel',
  );
  rightWheel.rotor.position.set(rightWheelCenter.x, rightWheelCenter.y, 0);
  carriage.add(rightWheel.rotor);

  // Brown curls the arch ends over the wheel hubs, so the tube runs in
  // front of the wheels (clear of tire, spokes, hub and index) to the axles.
  const archZ = 0.34;
  const actualArchPoints = [
    new THREE.Vector3(leftWheelCenter.x, 0.05, archZ),
    new THREE.Vector3(-1.77, 0.86, archZ),
    new THREE.Vector3(-1.25, 1.44, archZ),
    new THREE.Vector3(-0.6, 1.78, archZ),
    new THREE.Vector3(0, pendulumPivot.y, archZ),
    new THREE.Vector3(0.6, 1.78, archZ),
    new THREE.Vector3(1.25, 1.44, archZ),
    new THREE.Vector3(1.77, 0.86, archZ),
    new THREE.Vector3(rightWheelCenter.x, 0.05, archZ),
  ];
  const archFrame = lineTube(actualArchPoints, 0.105, frameMaterial);
  archFrame.userData.role =
    'curved-carriage-frame-governed-by-isosceles-triangle';
  carriage.add(archFrame);
  const baseBracePoints = [
    new THREE.Vector3(leftWheelCenter.x, 0.07, -0.02),
    new THREE.Vector3(-1.35, -0.16, -0.02),
    new THREE.Vector3(0, -0.08, -0.02),
    new THREE.Vector3(1.35, -0.16, -0.02),
    new THREE.Vector3(rightWheelCenter.x, 0.07, -0.02),
  ];
  baseBracePoints.forEach(point => { point.z = -0.43; });
  const baseBrace = lineTube(baseBracePoints, 0.075, frameMaterial);
  baseBrace.userData.role = 'lower-wheel-center-base-brace';
  carriage.add(baseBrace);
  // Brown's horizontal bar crosses the arch at about 1.33 and runs on past
  // the left side to the push handle.
  const upperBraceY = 1.33;
  const upperBrace = new THREE.Mesh(
    new THREE.BoxGeometry(3.36, 0.10, 0.16),
    frameMaterial,
  );
  upperBrace.position.set(-0.32, upperBraceY, 0.02);
  upperBrace.userData.role = 'upper-horizontal-carriage-brace';
  carriage.add(upperBrace);

  // Brown's dotted isosceles triangle is construction notation; the wheel
  // centres and apex stay as geometry data but no triangle is drawn.

  const handle = new THREE.Group();
  handle.userData.role = 'left-hand-push-handle-fixed-to-carriage';
  // The plate's hands hold one diagonal round bar that crosses the end of
  // the horizontal bar outside the arch; it lies on the brace and runs up
  // to the arch, which carry it.
  const gripStart = new THREE.Vector3(-2.62, 0.68, 0.17);
  const gripEnd = new THREE.Vector3(-1.22, 1.48, 0.17);
  const handleGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, gripStart.distanceTo(gripEnd), 30),
    darkMaterial,
  );
  handleGrip.position.copy(gripStart).add(gripEnd).multiplyScalar(0.5);
  handleGrip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
    gripEnd.clone().sub(gripStart).normalize());
  handleGrip.userData.role = 'diagonal-push-handle-bar';
  handle.add(handleGrip);
  carriage.add(handle);

  const drumCarrier = new THREE.Group();
  drumCarrier.position.set(
    drumAxialPaperOffset,
    drumVerticalScaleOffset,
    0,
  );
  drumCarrier.userData.role =
    'vertically-and-horizontally-adjustable-chart-drum-carrier';
  carriage.add(drumCarrier);
  const drumShaftStart = drumSpurX - drumSpurWidth / 2 - 0.02;
  const drumShaftEnd = 1.41;
  const drumShaft = cylinderAlongX(
    0.065,
    drumShaftEnd - drumShaftStart,
    darkMaterial,
    24,
  );
  drumShaft.position.copy(drumCenter)
    .setX((drumShaftStart + drumShaftEnd) / 2);
  drumShaft.userData.role =
    'horizontal-chart-drum-shaft-extending-to-left-spur-drive';
  // The drum shaft is live: it turns with the drum in fixed bearings.
  const drumRotor = new THREE.Group();
  drumRotor.position.copy(drumCenter);
  drumRotor.userData.role =
    'wheel-geared-horizontal-axis-chart-drum-rotor';
  drumCarrier.add(drumRotor);
  drumShaft.position.sub(drumCenter);
  drumRotor.add(drumShaft);
  const paperDrum = new THREE.Mesh(boredCylinderGeometry(drumRadius, 0.068, drumLength), paperMaterial);
  paperDrum.rotation.z = Math.PI / 2;
  paperDrum.userData.role =
    'cylindrical-sectionally-ruled-recording-paper';
  drumRotor.add(paperDrum);
  const chartSectionRings = Array.from({ length: 13 }, (_, index) => {
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      Array.from({length:128},(_,i)=>new THREE.Vector3(0,
        (drumRadius+0.0008)*Math.sin(FULL_TURN*i/128),
        (drumRadius+0.0008)*Math.cos(FULL_TURN*i/128))),
    ),new THREE.LineBasicMaterial({color:index%3===0?PALETTE.ink:PALETTE.frame}));
    ring.position.x = THREE.MathUtils.lerp(
      -drumLength / 2 + 0.04,
      drumLength / 2 - 0.04,
      index / 12,
    );
    ring.userData.role = index % 3 === 0
      ? 'major-axial-paper-section-ruling'
      : 'minor-axial-paper-section-ruling';
    drumRotor.add(ring);
    return ring;
  });
  const chartGeneratorLines = Array.from({ length: 12 }, (_, index) => {
    const angle = FULL_TURN * index / 12;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-drumLength/2+0.03,(drumRadius+0.0008)*Math.sin(angle),(drumRadius+0.0008)*Math.cos(angle)),
      new THREE.Vector3(drumLength/2-0.03,(drumRadius+0.0008)*Math.sin(angle),(drumRadius+0.0008)*Math.cos(angle)),
    ]),new THREE.LineBasicMaterial({color:index%3===0?PALETTE.ink:PALETTE.frame}));
    line.userData.role = index % 3 === 0
      ? 'major-circumferential-paper-section-ruling'
      : 'minor-circumferential-paper-section-ruling';
    drumRotor.add(line);
    return line;
  });
  const leftDrumCollar = cylinderAlongX(
    drumRadius * 0.72,
    0.12,
    darkMaterial,
    42,
  );
  leftDrumCollar.position.x = -drumLength / 2 - 0.07;
  const rightDrumCollar = cylinderAlongX(
    drumRadius * 0.72,
    0.12,
    darkMaterial,
    42,
  );
  rightDrumCollar.position.x = drumLength / 2 + 0.07;
  drumRotor.add(leftDrumCollar, rightDrumCollar);

  const verticalDrumGuide = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 1.40, 0.16),
    frameMaterial,
  );
  const guideBottom = 0.25;
  const guideTop = upperBraceY - 0.065;
  verticalDrumGuide.position.set(1.13, (guideBottom + guideTop) / 2,
    drumCenter.z);
  verticalDrumGuide.userData.role =
    'vertical-drum-scale-adjustment-guide';
  carriage.add(verticalDrumGuide);
  const verticalAdjustmentKnob = cylinderAlongZ(
    0.15,
    0.28,
    accentMaterial,
    30,
  );
  verticalAdjustmentKnob.position.set(1.13, drumCenter.y + 0.40,
    drumCenter.z + 0.13);
  verticalAdjustmentKnob.userData.role =
    'drum-vertical-scale-locking-knob';
  carriage.add(verticalAdjustmentKnob);
  // The knob's inner end stops 0.01 inside the guide (it lay in the
  // guide's inner face and flickered); its outer end is unchanged.
  const axialKnobLength = 0.25;
  const axialAdjustmentKnob = cylinderAlongX(
    0.14,
    axialKnobLength,
    accentMaterial,
    30,
  );
  axialAdjustmentKnob.position.set(1.185, drumCenter.y, drumCenter.z);
  axialAdjustmentKnob.userData.role =
    'drum-horizontal-paper-shift-locking-knob';
  carriage.add(axialAdjustmentKnob);

  const bevelDrive = new THREE.Group();
  bevelDrive.position.set(leftWheelCenter.x, 0, drumCenter.z);
  bevelDrive.userData.role =
    'left-wheel-axis-member-of-one-to-one-right-angle-bevel-stage';
  // Both pitch cones meet at the same apex. The wheel member extends
  // toward +Z, and the drum member extends toward +X.
  const makeBevel = (material, axis, phase) => {
    const group = new THREE.Group();
    const tooth = bevelToothGeometry({ teeth: 18, innerDistance: 0.17,
      outerDistance: 0.34, pitchConeAngle: Math.PI / 4,
      toothHeight: 0.074, toothThicknessFactor: 0.94 });
    const body = new THREE.Mesh(bevelBodyGeometry(tooth, 0.068), material);
    group.add(body);
    for (let i = 0; i < 18; i += 1) {
      const mesh = new THREE.Mesh(tooth.clone().rotateZ(i * FULL_TURN / 18 + phase), material);
      mesh.userData.bevelTooth = true;
      group.add(mesh);
    }
    tooth.dispose();
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    return group;
  };
  const bevelDriveCone = makeBevel(driverMaterial, new THREE.Vector3(0, 0, 1), 0);
  bevelDrive.add(bevelDriveCone);
  carriage.add(bevelDrive);
  const bevelDrum = new THREE.Group();
  bevelDrum.position.copy(bevelDrive.position);
  bevelDrum.userData.role =
    'horizontal-drum-axis-member-of-one-to-one-right-angle-bevel-stage';
  const bevelDrumCone = makeBevel(accentMaterial, new THREE.Vector3(1, 0, 0), Math.PI / 18);
  bevelDrum.add(bevelDrumCone);
  carriage.add(bevelDrum);
  // The bevel output turns a short axle-level countershaft; an equal spur
  // pair (the ribbed wheel Brown draws at the left end of the drum shaft)
  // carries the motion up to the drum, restoring the drum's sense.
  const countershaftStart = -1.86;
  const countershaftEnd = -1.08;
  const countershaft = cylinderAlongX(0.065,
    countershaftEnd - countershaftStart, darkMaterial, 24);
  countershaft.position.set(
    (countershaftStart + countershaftEnd) / 2 - leftWheelCenter.x, 0, 0,
  );
  countershaft.userData.role = 'axle-level-bevel-output-countershaft';
  bevelDrum.add(countershaft);
  const makeSpur = (material, phase, role) => {
    const spur = new THREE.Mesh(spurGearGeometry({
      boreRadius: 0.065,
      depth: drumSpurWidth,
      pitchRadius: drumSpurPitchRadius,
      teeth: drumSpurTeeth,
    }), material);
    // Shape angle theta lies at world (y, z) = r (sin theta, -cos theta).
    spur.geometry.rotateZ(phase);
    spur.rotation.y = Math.PI / 2;
    spur.userData.role = role;
    return spur;
  };
  const countershaftSpur = makeSpur(accentMaterial, 0,
    'countershaft-spur-driving-drum-spur');
  countershaftSpur.position.x = drumSpurX - leftWheelCenter.x;
  bevelDrum.add(countershaftSpur);
  const drumSpur = makeSpur(driverMaterial, Math.PI / drumSpurTeeth,
    'ribbed-drum-shaft-spur-driven-one-to-one');
  drumSpur.position.set(drumSpurX - drumCenter.x, 0, 0);
  drumRotor.add(drumSpur);

  const pendulum = new THREE.Group();
  pendulum.position.set(pendulumPivot.x, pendulumPivot.y, 1.17);
  pendulum.userData.role =
    'gravity-vertical-pendulum-relative-to-inclining-carriage';
  const pendulumRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, pendulumBobRadius, 0.095),
    darkMaterial,
  );
  pendulumRod.position.y = -pendulumBobRadius / 2;
  pendulumRod.userData.role = 'rigid-pendulum-rod';
  const pendulumBob = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.31, 0.25),
    driverMaterial,
  );
  pendulumBob.position.y = -pendulumBobRadius;
  pendulumBob.userData.role = 'gravity-pendulum-bob';
  const pencilCarrier = cylinderAlongZ(
    0.13,
    0.06,
    accentMaterial,
    30,
  );
  pencilCarrier.position.set(0, -pencilPendulumRadius, 0);
  pencilCarrier.userData.role =
    'pencil-carrier-fixed-on-pendulum-rod';
  pendulum.add(pendulumRod, pendulumBob, pencilCarrier);
  carriage.add(pendulum);
  const pendulumPivotAxle = cylinderAlongZ(
    0.16,
    1.20,
    darkMaterial,
    34,
  );
  pendulumPivotAxle.position.set(
    pendulumPivot.x,
    pendulumPivot.y,
    0.60,
  );
  pendulumPivotAxle.userData.role =
    'pendulum-pivot-on-carriage-perpendicular-bisector';
  carriage.add(pendulumPivotAxle);
  const pivotIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    whiteMaterial,
  );
  pivotIndex.position.set(
    pendulumPivot.x,
    pendulumPivot.y,
    1.23,
  );
  pivotIndex.userData.role = 'white-pendulum-axis-index';
  carriage.add(pivotIndex);

  const pencilStylus = new THREE.Group();
  pencilStylus.userData.role =
    'pendulum-pencil-maintaining-contact-with-chart-paper';
  const pencilBody = cylinderAlongZ(0.015, 1, darkMaterial, 24);
  pencilBody.userData.role = 'axial-pencil-stylus-to-drum';
  const pencilTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.015, 0.05, 24).rotateX(-Math.PI / 2).translate(0, 0, 0.025),
    driverMaterial,
  );
  pencilTip.userData.role = 'pencil-tip-on-rotating-paper';
  pencilStylus.add(pencilBody, pencilTip);
  carriage.add(pencilStylus);

  const pitchAtPhase = (phase) => maximumGroundInclination
    * Math.sin(FULL_TURN * phase);
  const traceMaterialPointAtPhase = (phase) => {
    const pitch = pitchAtPhase(phase);
    const pencilX = -pencilPendulumRadius * Math.sin(pitch);
    const pencilY = pendulumPivot.y
      - pencilPendulumRadius * Math.cos(pitch);
    const radialY = pencilY - drumCenter.y;
    const contactAngle = Math.asin(radialY / chartContactRadius);
    const drumAngle = -FULL_TURN * wheelToDrumRatio * phase;
    const materialAngle = contactAngle + drumAngle;
    return new THREE.Vector3(
      pencilX,
      chartContactRadius * Math.sin(materialAngle),
      chartContactRadius * Math.cos(materialAngle),
    );
  };
  const tracePointCount = chartTraceSamples + 2;
  const traceTemplate = new Float32Array(tracePointCount * 3);
  for (let index = 0; index < tracePointCount; index += 1) {
    const phase = Math.min(index / chartTraceSamples, 1);
    const point = traceMaterialPointAtPhase(phase);
    traceTemplate[index * 3] = point.x;
    traceTemplate[index * 3 + 1] = point.y;
    traceTemplate[index * 3 + 2] = point.z;
  }
  const tracePositions = new Float32Array(traceTemplate);
  const traceGeometry = new THREE.BufferGeometry();
  const tracePositionAttribute = new THREE.BufferAttribute(
    tracePositions,
    3,
  );
  tracePositionAttribute.setUsage(THREE.DynamicDrawUsage);
  traceGeometry.setAttribute('position', tracePositionAttribute);
  traceGeometry.setDrawRange(0, 1);
  const chartTrace = new THREE.Line(traceGeometry, traceMaterial);
  chartTrace.userData.role =
    'continuous-pencil-trace-progressively-inscribed-on-paper';
  drumRotor.add(chartTrace);

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const phaseAngle = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / cycleDuration;
    const travelDistance = triangleBase * cyclePhase;
    const travelSpeed = triangleBase / cycleDuration;
    const groundInclination = maximumGroundInclination
      * Math.sin(phaseAngle);
    const groundInclinationSpeed = maximumGroundInclination
      * angularFrequency * Math.cos(phaseAngle);
    const groundInclinationAcceleration = -maximumGroundInclination
      * angularFrequency ** 2 * Math.sin(phaseAngle);
    const wheelAngle = -travelDistance / wheelRadius;
    const wheelAngularSpeed = -travelSpeed / wheelRadius;
    // Bevel (reversing) then spur (reversing): the drum turns with the wheel.
    const drumAngle = wheelToDrumRatio * wheelAngle;
    const drumAngularSpeed = wheelToDrumRatio * wheelAngularSpeed;
    const pendulumRelativeAngle = -groundInclination;
    const pendulumWorldAngle = groundInclination
      + pendulumRelativeAngle;
    const pencilLocalX = -pencilPendulumRadius
      * Math.sin(groundInclination);
    const pencilLocalY = pendulumPivot.y
      - pencilPendulumRadius * Math.cos(groundInclination);
    const radialY = pencilLocalY - drumCenter.y;
    const radialZ = Math.sqrt(chartContactRadius ** 2 - radialY ** 2);
    const pencilContact = new THREE.Vector3(
      pencilLocalX,
      pencilLocalY,
      drumCenter.z + radialZ,
    );
    const pencilContactAngle = Math.atan2(radialY, radialZ);
    const pencilLocalXSpeed = -pencilPendulumRadius
      * Math.cos(groundInclination) * groundInclinationSpeed;
    const pencilLocalYSpeed = pencilPendulumRadius
      * Math.sin(groundInclination) * groundInclinationSpeed;
    const pencilLocalXAcceleration = pencilPendulumRadius * (
      Math.sin(groundInclination) * groundInclinationSpeed ** 2
      - Math.cos(groundInclination) * groundInclinationAcceleration
    );
    const pencilLocalYAcceleration = pencilPendulumRadius * (
      Math.cos(groundInclination) * groundInclinationSpeed ** 2
      + Math.sin(groundInclination) * groundInclinationAcceleration
    );
    const traceMaterialPoint = traceMaterialPointAtPhase(cyclePhase);
    const tracePointAfterDrumRotation = traceMaterialPoint.clone()
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), drumAngle)
      .add(drumCenter);
    return {
      cycleCoordinate,
      cyclePhase,
      drumAngle,
      drumAngularSpeed,
      groundInclination,
      groundInclinationAcceleration,
      groundInclinationSpeed,
      leftContactLocal: new THREE.Vector2(
        leftWheelCenter.x,
        -wheelRadius,
      ),
      noSlipResidual: travelDistance + wheelRadius * wheelAngle,
      pencilContact,
      pencilContactAngle,
      pencilContactRadialResidual:
        Math.hypot(radialY, radialZ) - chartContactRadius,
      pencilLocalAcceleration: new THREE.Vector2(
        pencilLocalXAcceleration,
        pencilLocalYAcceleration,
      ),
      pencilLocalPosition: new THREE.Vector2(
        pencilLocalX,
        pencilLocalY,
      ),
      pencilLocalVelocity: new THREE.Vector2(
        pencilLocalXSpeed,
        pencilLocalYSpeed,
      ),
      pendulumRelativeAngle,
      pendulumWorldAngle,
      rightContactLocal: new THREE.Vector2(
        rightWheelCenter.x,
        -wheelRadius,
      ),
      traceContactResidual: tracePointAfterDrumRotation.distanceTo(
        pencilContact,
      ),
      traceMaterialPoint,
      tracePointAfterDrumRotation,
      travelDistance,
      travelSpeed,
      wheelAngle,
      wheelAngularSpeed,
    };
  };

  // The drum turns once per cycle over periodic ground, so after the first
  // cycle the paper holds the whole closed profile and the pencil retraces
  // it; the trace is not wiped at each loop.
  const updateTrace = (cyclePhase, completedCycles = 0) => {
    tracePositions.set(traceTemplate);
    const exactIndex = Math.floor(cyclePhase * chartTraceSamples);
    const exactPoint = traceMaterialPointAtPhase(cyclePhase);
    const writeIndex = Math.min(exactIndex + 1, tracePointCount - 1);
    tracePositions[writeIndex * 3] = exactPoint.x;
    tracePositions[writeIndex * 3 + 1] = exactPoint.y;
    tracePositions[writeIndex * 3 + 2] = exactPoint.z;
    tracePositionAttribute.needsUpdate = true;
    const drawCount = completedCycles > 0 ? tracePointCount : writeIndex + 1;
    traceGeometry.setDrawRange(0, drawCount);
    return { drawCount, endpointIndex: writeIndex };
  };
  const update = (time) => {
    const state = stateAtTime(time);
    carriage.rotation.z = state.groundInclination;
    terrain.rotation.z = state.groundInclination;
    leftWheel.rotor.rotation.z = state.wheelAngle;
    rightWheel.rotor.rotation.z = state.wheelAngle;
    bevelDrive.rotation.z = state.wheelAngle;
    drumRotor.rotation.x = state.drumAngle;
    bevelDrum.rotation.x = -state.drumAngle;
    pendulum.rotation.z = state.pendulumRelativeAngle;
    const stylusOuterZ = 1.20;
    const stylusLength = stylusOuterZ - state.pencilContact.z;
    pencilStylus.position.set(
      state.pencilContact.x,
      state.pencilContact.y,
      (stylusOuterZ + state.pencilContact.z) / 2,
    );
    pencilBody.scale.y = stylusLength - 0.05;
    pencilBody.position.z = 0.025;
    pencilTip.position.set(
      0,
      0,
      -stylusLength / 2,
    );
    const traceState = updateTrace(state.cyclePhase, Math.floor(time / cycleDuration));
    for (let index = 0; index < groundDashes.length; index += 1) {
      const raw = -groundDisplayLength / 2
        + index * groundDashSpacing
        - state.travelDistance;
      groundDashes[index].position.x = positiveModulo(
        raw + groundDisplayLength / 2,
        groundDisplayLength,
      ) - groundDisplayLength / 2;
    }
    root.userData.contacts = {
      chartTraceToPencil: {
        active: true,
        materialPoint: state.traceMaterialPoint,
        radialResidual: state.pencilContactRadialResidual,
        spatialResidual: state.traceContactResidual,
      },
      leftWheelToGround: {
        active: true,
        localPoint: state.leftContactLocal,
        noSlipResidual: state.noSlipResidual,
      },
      pendulumPencilToPaper: {
        active: true,
        point: state.pencilContact,
        radialResidual: state.pencilContactRadialResidual,
      },
      rightWheelToGround: {
        active: true,
        localPoint: state.rightContactLocal,
        noSlipResidual: state.noSlipResidual,
      },
    };
    root.userData.traceState = traceState;
    root.userData.kinematics = state;
  };

  const replaceGeometry = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  for (const collar of [leftDrumCollar, rightDrumCollar]) {
    replaceGeometry(collar, boredCylinderGeometry(drumRadius * 0.72, 0.068, 0.12));
  }
  replaceGeometry(axialAdjustmentKnob, boredCylinderGeometry(0.14, 0.068, axialKnobLength));
  const guideHalf = (guideTop - guideBottom) / 2;
  const guideOutline = poly([[-0.08,-guideHalf],[0.08,-guideHalf],[0.08,guideHalf],[-0.08,guideHalf]]);
  replaceGeometry(verticalDrumGuide, plate(polygonClipping.difference(guideOutline,
    poly(circle([0,drumCenter.y-(guideBottom+guideTop)/2],0.068,128))), -0.08, 0.08).rotateY(Math.PI/2));
  const pendulumEye = new THREE.Mesh(boredCylinderGeometry(0.22,0.163,0.095), darkMaterial);
  pendulumEye.rotation.x=Math.PI/2;
  pendulumEye.userData.role='bored-pendulum-pivot-eye';
  pendulum.add(pendulumEye);
  // The pencil slides in a bore through the carrier and rod.
  const pencilBore = 0.0175;
  replaceGeometry(pendulumRod, plate(polygonClipping.difference(
    poly([[-0.0425,-pendulumBobRadius],[0.0425,-pendulumBobRadius],[0.0425,-0.19],[-0.0425,-0.19]]),
    poly(circle([0,-pencilPendulumRadius],pencilBore,48))), -0.0475, 0.0475));
  pendulumRod.position.y=0;
  replaceGeometry(pencilCarrier, boredCylinderGeometry(0.13, pencilBore, 0.06));
  const wheelAxles = [leftWheelCenter,rightWheelCenter].map(center=>{
    const left = center === leftWheelCenter;
    const axle=cylinderAlongZ(0.055,left ? 1.54 : 0.94,darkMaterial,48);
    axle.position.set(center.x,center.y,left ? 0.29 : -0.01);
    axle.userData.role='stationary-wheel-journal-axle';
    carriage.add(axle);return axle;
  });
  const drumBearing = new THREE.Mesh(boredCylinderGeometry(0.12,0.068,0.18),frameMaterial);
  drumBearing.rotation.z=Math.PI/2;
  drumBearing.position.set(-1.2,drumCenter.y,drumCenter.z);
  carriage.add(drumBearing);
  const countershaftBearing = new THREE.Mesh(boredCylinderGeometry(0.12,0.068,0.18),frameMaterial);
  countershaftBearing.rotation.z=Math.PI/2;
  countershaftBearing.position.set(-1.2,0,drumCenter.z);
  countershaftBearing.userData.role='countershaft-bearing';
  carriage.add(countershaftBearing);
  const bearingBridges=[[-1.2,upperBraceY],[1.13,upperBraceY]].map(([x,y])=>{
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.13,0.59),frameMaterial);
    bridge.position.set(x,y,0.31);carriage.add(bridge);return bridge;
  });
  // Two straps (above and between the bearings) keep clear of both shafts.
  const leftBearingSupport=new THREE.Mesh(new THREE.BoxGeometry(0.12,upperBraceY-0.065-drumCenter.y-0.12,0.14),frameMaterial);
  leftBearingSupport.position.set(-1.2,(upperBraceY-0.065+drumCenter.y+0.12)/2,drumCenter.z);carriage.add(leftBearingSupport);
  const lowerBearingStrap=new THREE.Mesh(new THREE.BoxGeometry(0.12,drumCenter.y-0.24,0.14),frameMaterial);
  lowerBearingStrap.position.set(-1.2,drumCenter.y/2,drumCenter.z);carriage.add(lowerBearingStrap);

  const sourceState = stateAtTime(0);
  root.userData = {
    archetype:
      'two-wheel-isosceles-survey-carriage-with-world-vertical-pendulum-wheel-geared-ruled-paper-drum-and-contact-pencil',
    blocks: {
      pendulumEye, wheelAxles, drumBearing, bearingBridges,
      countershaft, countershaftBearing, countershaftSpur, drumSpur,
      leftBearingSupport, lowerBearingStrap,
      archFrame,
      axialAdjustmentKnob,
      baseBrace,
      bevelDrive,
      bevelDriveCone,
      bevelDrum,
      bevelDrumCone,
      carriage,
      chartGeneratorLines,
      chartSectionRings,
      chartTrace,
      drumCarrier,
      drumRotor,
      drumShaft,
      groundBeam,
      groundDashes,
      handle,
      leftWheel,
      paperDrum,
      pencilCarrier,
      pencilStylus,
      pencilTip,
      pendulum,
      pendulumBob,
      pendulumPivotAxle,
      pendulumRod,
      rightWheel,
      terrain,
      upperBrace,
      verticalAdjustmentKnob,
      verticalDrumGuide,
    },
    constraints: {
      drum:
        'A one-to-one ideal right-angle bevel stage turns an axle-level countershaft, and an equal 16/16 spur pair lifts that motion to the raised drum shaft, so the drum turns with the ground wheel; these ratios are engineered because Brown gives no tooth counts.',
      frame:
        'The two wheel centers form the horizontal base of an isosceles governing triangle whose apex lies on their perpendicular bisector.',
      pendulum:
        'Quasi-static gravity keeps the pendulum world-vertical, so its carriage-relative angle is exactly the negative ground inclination.',
      recording:
        'The pendulum-carried pencil remains on the cylindrical chart/ink surface and coincides with the current endpoint of the progressively revealed material trace.',
      wheels:
        'Both equal wheels contact one instantaneous straight terrain tangent and roll without slip through one revolution per base-length of surface travel.',
    },
    degreesOfFreedom: {
      configurationCoordinates: [
        'vertical drum shift selecting record scale',
        'horizontal drum shift selecting unused paper',
      ],
      dependentCoordinates: [
        'equal wheel rotations from no-slip travel',
        'carriage inclination from local terrain tangent',
        'pendulum angle relative to carriage',
        'right-angle bevel and spur geared drum rotation',
        'pencil contact position on cylindrical paper',
      ],
      independentPrescribedInputs: 1,
      inputs: ['surface distance traveled by the carriage'],
      note:
        'Drum scale and paper offsets are locked configuration settings. The operating reconstruction has one travel input; terrain grade is a prescribed periodic function of that distance and all wheel, frame, pendulum, drum, and pencil coordinates follow.',
      operatingDegreesOfFreedom: 1,
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'equal rigid wheels with exact rolling and no slip',
        'rigid isosceles carriage on a locally straight terrain tangent',
        'quasi-static gravity pendulum with no oscillatory transient',
        'rigid ideal one-to-one bevel gears with no backlash and a 1:1 involute spur pair with 0.012 backlash',
        'massless frictionless pencil maintaining cylindrical chart contact; the trace radius is 0.0008 unit above the paper substrate',
        'periodic inclination demonstration and moving-ground display',
        'wheel load, terrain compliance, friction, inertia, damping, pencil drag, and ink thickness omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless spatial rolling, gravity, gearing, and recording kinematics',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'two equal ground wheels support a carriage governed by an isosceles triangle; their circumference equals the wheel-center base, a gravity pendulum indicates carriage inclination, one wheel turns a horizontal ruled-paper drum through right-angle gearing, and the pendulum pencil records its inclination profile on the moving paper',
    motion: {
      cycleDuration,
      sequence:
        'level -> rising tangent -> level crest -> falling tangent -> level, over exactly one base length and one wheel revolution',
      sourcePosePhase: 0,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 411 page marks Animated unavailable and provides only Brown’s engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate411: {
        carriageArchApproximateBoundsPixels: [71, 187, 456, 391],
        chartDrumApproximateBoundsPixels: [184, 286, 358, 361],
        constructionApexApproximatePixels: [270, 29],
        imageHeight: 525,
        imageWidth: 525,
        leftWheelApproximateBoundsPixels: [14, 329, 137, 449],
        measurementUncertaintyPixels: 11,
        pendulumApproximateBoundsPixels: [252, 178, 293, 418],
        rightWheelApproximateBoundsPixels: [389, 330, 505, 449],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the device is a self-recording level for surveyors',
          'its carriage shape is governed by an isosceles triangle with horizontal base',
          'each wheel circumference equals that triangle base',
          'the pendulum bisects the base on level ground',
          'the pendulum gravitates right or left on an inclination',
          'gearing from one carriage wheel rotates the drum',
          'the drum carries sectionally ruled paper',
          'the pendulum pencil traces a profile corresponding to traversed ground',
          'vertical drum shift selects scale',
          'horizontal drum shift avoids removing filled paper',
        ],
        engravingEvidence:
          'The plate shows two equal spoked wheels, a symmetric arched frame under a dotted isosceles construction, a central gravity pendulum and low bob, a horizontally oriented ruled-paper drum, a left-side right-angle drive, and push handles.',
        reconstructionDisclosure:
          'Brown fixes the topology, wheel-circumference/base equality, gravity indication, and wheel-driven chart but gives no dimensions, gear counts, paper scale, terrain function, timing, masses, or loads. The one-to-one bevel ratio, sinusoidal local inclination, quasi-static pendulum, drum offsets, colors, and progressive trace are independently engineered and explicitly exposed.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 411',
    },
    sourcePose: {
      drumAngle: sourceState.drumAngle,
      groundInclination: sourceState.groundInclination,
      pendulumWorldAngle: sourceState.pendulumWorldAngle,
      setting:
        'level terrain, horizontal wheel-center base, centered world-vertical pendulum, and horizontal ruled-paper drum, matching Brown’s plate',
      wheelAngle: sourceState.wheelAngle,
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    traceMaterialPointAtPhase,
    transmission: {
      baseCircumferenceRelation:
        'triangle base=wheel circumference=2*pi*wheel radius',
      drumRelation:
        'drum angle=wheelToDrumRatio*wheel angle with selected ratio 1 (bevel and spur reversals cancel)',
      noSlipRelation:
        'surface travel+wheel radius*wheel angle=0',
      pendulumRelation:
        'pendulum world angle=carriage inclination+relative pendulum angle=0',
    },
    update,
  };
  // Brown's crop: the hands at the left edge, the dotted apex at the top.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.78, -1.04, -0.52),
    new THREE.Vector3(2.78, 3.72, 1.08),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(6.4, 3.5, 13.0);
  root.userData.groundFloorY = -1.04;
  markShadows(root);
  groundBeam.receiveShadow = true;
  chartTrace.castShadow = false;
  root.userData.reconstructionNote = 'Closed journal bores, finite tire radius and a pointed stylus replace nominal contact markers; the 18/18 bevel pair uses back-cone involute approximations. The arch, apex, drum height and drum proportions follow the engraving; the bevel stage and 16/16 spur pair that raise the drive to the drum are engineered (Brown shows only a ribbed wheel at the drum shaft end). Pendulum response and terrain slope remain quasi-static prescribed inputs.';
  root.userData.cameraFov = 8;
  root.userData.cameraDirection.set(0.5, 0.25, 14);
  fitPistonGuide(root, update, cycleDuration);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredSelfRecordingLevelMovement(movement) {
  if (movement.id !== 411) return null;
  return selfRecordingLevel(movement);
}
