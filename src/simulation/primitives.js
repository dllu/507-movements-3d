import * as THREE from 'three';
import { bevelBodyGeometry, bevelToothGeometry } from './bevel-geometry.js';
import { beltFrameAt, flatBeltGeometry } from './belt-geometry.js';
import { LaidRopeGeometry, replaceWithLaidRope } from './laid-rope.js';

export const PALETTE = Object.freeze({
  ink: 0x252a2d,
  muted: 0x7e8584,
  driver: 0xde5a3f,
  driven: 0x315f78,
  accent: 0xd8a533,
  belt: 0x315f78,
  brass: 0xb7863f,
  fluid: 0x4a93a8,
  frame: 0x59605f,
  paper: 0xf3f0e9,
  white: 0xfaf9f5,
});

export function matte(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.08,
    roughness: options.roughness ?? 0.72,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
}

export function markShadows(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      // Invisible framing markers contribute to camera bounds only. Their
      // depth materials can still cast shadows despite zero visible opacity.
      const physicalPart = !child.userData.cameraFitGuide;
      child.castShadow = physicalPart;
      child.receiveShadow = physicalPart;
    }
  });
  return object;
}

function rotorRoot(axis = new THREE.Vector3(0, 0, 1)) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
  root.userData.axis = axis.clone().normalize();
  root.userData.rotor = rotor;
  return root;
}

export function setSpin(object, angle) {
  const rotor = object.userData.rotor ?? object;
  rotor.rotation.z = angle;
}

export function addSpin(object, angle) {
  const rotor = object.userData.rotor ?? object;
  rotor.rotation.z += angle;
}

export function makePulley({
  radius = 1,
  width = 0.34,
  hubLength = width * 1.45,
  color = PALETTE.driver,
  grooves = 1,
  spokes = 4,
  axis = new THREE.Vector3(0, 0, 1),
  bore = 0,
} = {}) {
  const root = rotorRoot(axis);
  const rotor = root.userData.rotor;
  const material = matte(color);
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.2, roughness: 0.55 });
  const annulus = (inner, outer, length, segments) => new THREE.LatheGeometry([
    new THREE.Vector2(inner, -length / 2),
    new THREE.Vector2(outer, -length / 2),
    new THREE.Vector2(outer, length / 2),
    new THREE.Vector2(inner, length / 2),
    new THREE.Vector2(inner, -length / 2),
  ], segments);

  const spokeDepth = width * 0.62;
  const innerRadius = radius * 0.82;
  const rimGeometry = spokes > 0
    ? annulus(innerRadius, radius, width, 80)
    : bore > 0 ? annulus(bore, radius, width, 80)
      : new THREE.CylinderGeometry(radius, radius, width, 80);
  const sheave = new THREE.Mesh(
    rimGeometry,
    material,
  );
  sheave.rotation.x = Math.PI / 2;
  sheave.userData.role = spokes > 0 ? 'open-pulley-rim' : 'solid-pulley-drum';
  rotor.add(sheave);

  // Brown outlines tread edges in ink only because the plate is a line
  // drawing; they are not separate parts. The former dark edge rings stay as
  // hidden placeholders so callers that index rotor children keep working.
  for (let index = 0; grooves > 0 && index <= grooves; index += 1) {
    const z = -width / 2 + (width * index) / Math.max(grooves, 1);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, Math.max(0.035, radius * 0.055), 10, 56),
      darkMaterial,
    );
    rim.position.z = z;
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    rotor.add(rim);
  }

  // A bored hub keeps a wall around its pin even on small sheaves.
  const boredHubRadius = Math.max(radius * 0.26, bore + 0.03);
  const hub = new THREE.Mesh(
    bore > 0
      ? annulus(bore, boredHubRadius, hubLength, 40)
      : new THREE.CylinderGeometry(radius * 0.26, radius * 0.26, hubLength, 40),
    darkMaterial,
  );
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);

  const spokeMeshes = [];
  for (let index = 0; index < spokes; index += 1) {
    const angle = index * Math.PI * 2 / spokes;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.65, radius * 0.10, spokeDepth),
      material,
    );
    spoke.position.set(Math.cos(angle) * radius * 0.54, Math.sin(angle) * radius * 0.54, 0);
    spoke.rotation.z = angle;
    spoke.userData.role = 'radial-pulley-spoke';
    rotor.add(spoke);
    spokeMeshes.push(spoke);
  }

  // A small index patch on the tread keeps rotation legible when the pulley
  // is viewed edge-on and its face spokes are hidden.
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.max(0.04, radius * 0.08),
      Math.max(0.07, radius * 0.14),
      width * 0.62,
    ),
    matte(PALETTE.white, { roughness: 0.5 }),
  );
  indicator.position.x = radius - Math.max(0.04, radius * 0.08) / 2 + 0.001;
  rotor.add(indicator);

  // Put the more legible index on both faces as well as the tread. The two
  // face marks remain visible from either side and make pulley ratios easy to
  // compare without waiting for a spoke to pass a particular angle.
  const faceInner = bore > 0 ? Math.max(radius * 0.34, boredHubRadius + 0.005) : radius * 0.34;
  const faceIndicators = [-1, 1].map((side) => {
    const faceIndicator = new THREE.Mesh(
      new THREE.BoxGeometry(
        bore > 0 ? radius * 0.76 - faceInner : radius * 0.42,
        radius * 0.065,
        0.008,
      ),
      matte(PALETTE.white, { roughness: 0.5 }),
    );
    faceIndicator.position.set(
      bore > 0 ? (radius * 0.76 + faceInner) / 2 : radius * 0.55,
      0,
      side * ((spokes > 0 ? spokeDepth : width) / 2 + 0.004),
    );
    rotor.add(faceIndicator);
    return faceIndicator;
  });

  root.userData.faceIndicators = faceIndicators;
  root.userData.hub = hub;
  root.userData.spokes = spokeMeshes;
  root.userData.tread = sheave;
  root.userData.treadRadius = radius;
  root.userData.radius = radius;
  root.userData.width = width;
  return markShadows(root);
}

export function makeGear({
  teeth = 20,
  radius = 1,
  depth = 0.3,
  color = PALETTE.driver,
  axis = new THREE.Vector3(0, 0, 1),
  toothDepth = 0.16,
  toothHeight,
  addendum,
  dedendum,
  chamfer,
  pressureAngle = THREE.MathUtils.degToRad(20),
} = {}) {
  const root = rotorRoot(axis);
  const rotor = root.userData.rotor;
  const resolvedToothHeight = toothHeight ?? radius * toothDepth;
  const resolvedDedendum = dedendum ?? resolvedToothHeight * 0.5;
  const resolvedAddendum = addendum ?? resolvedToothHeight * 0.5;
  const rootRadius = radius - resolvedDedendum;
  const outerRadius = radius + resolvedAddendum;
  const baseRadius = radius * Math.cos(pressureAngle);
  const angularPitch = Math.PI * 2 / teeth;
  const pitchHalfToothAngle = Math.PI / (2 * teeth);
  const involuteAtPitch = Math.tan(pressureAngle) - pressureAngle;
  const involuteAngleAtRadius = (sampleRadius) => {
    if (sampleRadius <= baseRadius) return 0;
    const parameter = Math.sqrt((sampleRadius / baseRadius) ** 2 - 1);
    return parameter - Math.atan(parameter);
  };
  const involuteStartRadius = Math.max(rootRadius, baseRadius);
  const flankSamples = 7;
  const shape = new THREE.Shape();
  let firstPoint = true;
  const appendPolarPoint = (pointRadius, angle) => {
    const x = Math.cos(angle) * pointRadius;
    const y = Math.sin(angle) * pointRadius;
    if (firstPoint) {
      shape.moveTo(x, y);
      firstPoint = false;
    } else {
      shape.lineTo(x, y);
    }
  };

  for (let toothIndex = 0; toothIndex < teeth; toothIndex += 1) {
    const centerAngle = toothIndex * angularPitch;
    const startHalfAngle = pitchHalfToothAngle + involuteAtPitch
      - involuteAngleAtRadius(involuteStartRadius);
    appendPolarPoint(rootRadius, centerAngle - angularPitch / 2);
    appendPolarPoint(rootRadius, centerAngle - startHalfAngle);
    if (involuteStartRadius > rootRadius + 1e-10) {
      appendPolarPoint(involuteStartRadius, centerAngle - startHalfAngle);
    }
    for (let sample = 1; sample <= flankSamples; sample += 1) {
      const progress = sample / flankSamples;
      const sampleRadius = THREE.MathUtils.lerp(
        involuteStartRadius,
        outerRadius,
        progress,
      );
      const halfAngle = pitchHalfToothAngle + involuteAtPitch
        - involuteAngleAtRadius(sampleRadius);
      appendPolarPoint(sampleRadius, centerAngle - halfAngle);
    }
    const outerHalfAngle = pitchHalfToothAngle + involuteAtPitch
      - involuteAngleAtRadius(outerRadius);
    appendPolarPoint(outerRadius, centerAngle + outerHalfAngle);
    for (let sample = flankSamples - 1; sample >= 0; sample -= 1) {
      const progress = sample / flankSamples;
      const sampleRadius = THREE.MathUtils.lerp(
        involuteStartRadius,
        outerRadius,
        progress,
      );
      const halfAngle = pitchHalfToothAngle + involuteAtPitch
        - involuteAngleAtRadius(sampleRadius);
      appendPolarPoint(sampleRadius, centerAngle + halfAngle);
    }
    if (involuteStartRadius > rootRadius + 1e-10) {
      appendPolarPoint(rootRadius, centerAngle + startHalfAngle);
    }
    appendPolarPoint(rootRadius, centerAngle + angularPitch / 2);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: chamfer ?? Math.min(0.035, depth * 0.12),
    // ExtrudeGeometry otherwise expands the outline by bevelSize, widening
    // every tooth beyond its involute and into the mating tooth space.
    bevelOffset: -(chamfer ?? Math.min(0.035, depth * 0.12)),
    bevelThickness: chamfer ?? Math.min(0.035, depth * 0.12),
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  const gear = new THREE.Mesh(geometry, matte(color, { metalness: 0.12 }));
  rotor.add(gear);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.19, radius * 0.19, depth * 1.35, 30),
    matte(PALETTE.ink, { metalness: 0.22, roughness: 0.5 }),
  );
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);

  // Brown draws no dark ring on a gear face. The former face ring stays as a
  // hidden placeholder so callers that index rotor children keep working.
  const inset = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.54, Math.max(0.025, radius * 0.035), 8, 48),
    matte(PALETTE.ink),
  );
  inset.position.z = depth * 0.51;
  inset.visible = false;
  inset.userData.retiredInkOutline = true;
  rotor.add(inset);

  // The high tooth counts used by many historical gears can otherwise make
  // direction and rate hard to read. This face index rotates with the gear.
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.5, Math.max(0.045, radius * 0.055), 0.024),
    matte(PALETTE.white, { roughness: 0.5 }),
  );
  indicator.position.set(radius * 0.42, 0, depth * 0.58);
  rotor.add(indicator);

  root.userData.radius = radius;
  root.userData.angularPitch = angularPitch;
  root.userData.baseRadius = baseRadius;
  root.userData.involuteStartRadius = involuteStartRadius;
  root.userData.module = radius * 2 / teeth;
  root.userData.outerRadius = outerRadius;
  root.userData.pitchRadius = radius;
  root.userData.pressureAngle = pressureAngle;
  root.userData.rootRadius = rootRadius;
  root.userData.teeth = teeth;
  root.userData.addendum = resolvedAddendum;
  root.userData.dedendum = resolvedDedendum;
  root.userData.toothHeight = resolvedAddendum + resolvedDedendum;
  root.userData.toothProfile = 'true-involute';
  return markShadows(root);
}

export function makeInvoluteInternalGear({
  teeth = 48,
  pitchRadius = 1.6,
  module = pitchRadius * 2 / teeth,
  outerRadius = pitchRadius + module * 2.4,
  depth = 0.3,
  color = PALETTE.driven,
  axis = new THREE.Vector3(0, 0, 1),
  addendum = module,
  dedendum = module * 1.25,
  pressureAngle = THREE.MathUtils.degToRad(20),
  toothIndexOffset = 0,
  chamfer,
  backlash = 0,
  flankSamples = 7,
  tipSamples = 2,
  rootGapSamples = 2,
} = {}) {
  const root = rotorRoot(axis);
  const rotor = root.userData.rotor;
  const tipRadius = pitchRadius - addendum;
  const rootRadius = pitchRadius + dedendum;
  const baseRadius = pitchRadius * Math.cos(pressureAngle);
  if (tipRadius <= baseRadius) {
    throw new RangeError(
      'Internal involute tooth tips must remain outside the base circle.',
    );
  }
  if (outerRadius <= rootRadius) {
    throw new RangeError(
      'Internal gear outer radius must exceed its tooth-root radius.',
    );
  }

  const angularPitch = Math.PI * 2 / teeth;
  const pitchHalfToothAngle = Math.PI / (2 * teeth) - backlash / (2 * pitchRadius);
  const involuteAngleAtRadius = (sampleRadius) => {
    const parameter = Math.sqrt(
      Math.max(0, (sampleRadius / baseRadius) ** 2 - 1),
    );
    return parameter - Math.atan(parameter);
  };
  const involuteAtPitch = involuteAngleAtRadius(pitchRadius);
  const flankHalfAngleAtRadius = (sampleRadius) =>
    pitchHalfToothAngle - involuteAtPitch
      + involuteAngleAtRadius(sampleRadius);
  const rootHalfAngle = flankHalfAngleAtRadius(rootRadius);
  const tipHalfAngle = flankHalfAngleAtRadius(tipRadius);
  if (rootHalfAngle * 2 >= angularPitch) {
    throw new RangeError('Internal involute tooth roots overlap.');
  }

  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  let firstPoint = true;
  const appendPolarPoint = (pointRadius, angle) => {
    const x = Math.cos(angle) * pointRadius;
    const y = Math.sin(angle) * pointRadius;
    if (firstPoint) {
      hole.moveTo(x, y);
      firstPoint = false;
    } else {
      hole.lineTo(x, y);
    }
  };
  for (let toothIndex = 0; toothIndex < teeth; toothIndex += 1) {
    const centerAngle = toothIndexOffset - toothIndex * angularPitch;
    appendPolarPoint(rootRadius, centerAngle + rootHalfAngle);
    for (let sample = 1; sample <= flankSamples; sample += 1) {
      const progress = sample / flankSamples;
      const sampleRadius = THREE.MathUtils.lerp(
        rootRadius,
        tipRadius,
        progress,
      );
      appendPolarPoint(
        sampleRadius,
        centerAngle + flankHalfAngleAtRadius(sampleRadius),
      );
    }
    for (let sample = 1; sample <= tipSamples; sample += 1) {
      appendPolarPoint(
        tipRadius,
        centerAngle + THREE.MathUtils.lerp(
          tipHalfAngle,
          -tipHalfAngle,
          sample / tipSamples,
        ),
      );
    }
    for (let sample = flankSamples - 1; sample >= 0; sample -= 1) {
      const progress = sample / flankSamples;
      const sampleRadius = THREE.MathUtils.lerp(
        rootRadius,
        tipRadius,
        progress,
      );
      appendPolarPoint(
        sampleRadius,
        centerAngle - flankHalfAngleAtRadius(sampleRadius),
      );
    }
    const nextCenterAngle = centerAngle - angularPitch;
    for (let sample = 1; sample <= rootGapSamples; sample += 1) {
      appendPolarPoint(
        rootRadius,
        THREE.MathUtils.lerp(
          centerAngle - rootHalfAngle,
          nextCenterAngle + rootHalfAngle,
          sample / rootGapSamples,
        ),
      );
    }
  }
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: (chamfer ?? Math.min(0.018, depth * 0.08)) > 0,
    bevelSegments: 1,
    bevelSize: chamfer ?? Math.min(0.018, depth * 0.08),
    bevelOffset: -(chamfer ?? Math.min(0.018, depth * 0.08)),
    bevelThickness: chamfer ?? Math.min(0.018, depth * 0.08),
    curveSegments: 64,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  const gear = new THREE.Mesh(
    geometry,
    matte(color, { metalness: 0.11, roughness: 0.66 }),
  );
  gear.userData.role = 'continuous-internal-involute-gear-body';
  rotor.add(gear);

  root.userData.addendum = addendum;
  root.userData.angularPitch = angularPitch;
  root.userData.axis = axis.clone().normalize();
  root.userData.baseRadius = baseRadius;
  root.userData.circularPitch = Math.PI * module;
  root.userData.dedendum = dedendum;
  root.userData.module = module;
  root.userData.outerRadius = outerRadius;
  root.userData.pitchRadius = pitchRadius;
  root.userData.pressureAngle = pressureAngle;
  root.userData.rootRadius = rootRadius;
  root.userData.teeth = teeth;
  root.userData.tipRadius = tipRadius;
  root.userData.toothIndexOffset = toothIndexOffset;
  root.userData.backlash = backlash;
  root.userData.toothProfile = 'true-involute-internal';
  return markShadows(root);
}

export function makeEllipticalGear({
  teeth = 28,
  radiusX = 1.35,
  radiusY = 0.78,
  depth = 0.3,
  color = PALETTE.driver,
  focusSign = 1,
  axis = new THREE.Vector3(0, 0, 1),
} = {}) {
  const root = rotorRoot(axis);
  const rotor = root.userData.rotor;
  const focus = Math.sqrt(Math.max(0, radiusX ** 2 - radiusY ** 2)) * focusSign;
  const shape = new THREE.Shape();
  const pointCount = teeth * 4;
  for (let index = 0; index < pointCount; index += 1) {
    const angle = index / pointCount * Math.PI * 2;
    const toothScale = index % 4 === 1 || index % 4 === 2 ? 1.07 : 0.94;
    const x = Math.cos(angle) * radiusX * toothScale - focus;
    const y = Math.sin(angle) * radiusY * toothScale;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
  geometry.translate(0, 0, -depth / 2);
  rotor.add(new THREE.Mesh(geometry, matte(color, { metalness: 0.12 })));
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, depth * 1.35, 24),
    matte(PALETTE.ink),
  );
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  root.userData.focus = focus;
  root.userData.radiusX = radiusX;
  root.userData.radiusY = radiusY;
  return markShadows(root);
}

export function makeInternalGear({
  teeth = 30,
  outerRadius = 1.5,
  innerRadius = 1.06,
  depth = 0.3,
  color = PALETTE.driven,
  axis = new THREE.Vector3(0, 0, 1),
} = {}) {
  const root = rotorRoot(axis);
  const rotor = root.userData.rotor;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
    curveSegments: 64,
  });
  geometry.translate(0, 0, -depth / 2);
  rotor.add(new THREE.Mesh(geometry, matte(color, { metalness: 0.11 })));
  const toothMaterial = matte(PALETTE.ink, { metalness: 0.16, roughness: 0.6 });
  for (let index = 0; index < teeth; index += 1) {
    const angle = index / teeth * Math.PI * 2;
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry((Math.PI * innerRadius / teeth) * 1.18, outerRadius - innerRadius + 0.08, depth * 0.82),
      toothMaterial,
    );
    tooth.position.set(
      Math.cos(angle) * (innerRadius + (outerRadius - innerRadius) * 0.16),
      Math.sin(angle) * (innerRadius + (outerRadius - innerRadius) * 0.16),
      0,
    );
    tooth.rotation.z = angle + Math.PI / 2;
    rotor.add(tooth);
  }
  root.userData.teeth = teeth;
  root.userData.innerRadius = innerRadius;
  return markShadows(root);
}

export function makeRectangularGear({
  width = 2,
  height = 1.45,
  teethPerSide = 9,
  depth = 0.3,
  color = PALETTE.driver,
} = {}) {
  const root = rotorRoot();
  const rotor = root.userData.rotor;
  const material = matte(color, { metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  rotor.add(body);
  const toothMaterial = matte(PALETTE.ink, { metalness: 0.12, roughness: 0.62 });
  const toothSize = Math.min(width, height) * 0.12;
  for (let index = 0; index < teethPerSide; index += 1) {
    const x = -width / 2 + (index + 0.5) * width / teethPerSide;
    for (const side of [-1, 1]) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(width / teethPerSide * 0.58, toothSize, depth * 0.82), toothMaterial);
      tooth.position.set(x, side * (height / 2 + toothSize / 2), 0);
      rotor.add(tooth);
    }
    const y = -height / 2 + (index + 0.5) * height / teethPerSide;
    for (const side of [-1, 1]) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(toothSize, height / teethPerSide * 0.58, depth * 0.82), toothMaterial);
      tooth.position.set(side * (width / 2 + toothSize / 2), y, 0);
      rotor.add(tooth);
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, depth * 1.4, 24), matte(PALETTE.ink));
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  return markShadows(root);
}

export function makeBevelGear({
  teeth = 18,
  radius = 1,
  depth = 0.65,
  color = PALETTE.driver,
  axis = new THREE.Vector3(0, 0, 1),
} = {}) {
  const root = rotorRoot(axis);
  const rotor = root.userData.rotor;
  const pitchConeAngle = Math.atan2(radius, 2 * depth);
  const toothGeometry = bevelToothGeometry({
    teeth,
    innerDistance: depth,
    outerDistance: 2 * depth,
    pitchConeAngle,
    toothHeight: radius * 0.18,
  });
  const bodyGeometry = bevelBodyGeometry(toothGeometry);
  const largeRootRadius = toothGeometry.userData.root.radius;
  const smallRootRadius = largeRootRadius / 2;
  const largeTipRadius = radius + toothGeometry.userData.height * 0.45 * Math.cos(pitchConeAngle);
  const smallTipRadius = largeTipRadius / 2;
  const backFaceZ = 1.5 * depth - toothGeometry.userData.root.z;
  for (const geometry of [toothGeometry, bodyGeometry]) {
    geometry.rotateX(Math.PI);
    geometry.translate(0, 0, 1.5 * depth);
  }
  const body = new THREE.Mesh(bodyGeometry, matte(color, { metalness: 0.14, roughness: 0.62 }));
  body.userData.bevelGearBody = true;
  rotor.add(body);
  const toothMaterial = matte(color, { metalness: 0.16, roughness: 0.57 });
  const toothMeshes = [];
  for (let index = 0; index < teeth; index += 1) {
    const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
    tooth.rotation.z = index * Math.PI * 2 / teeth;
    tooth.userData.bevelTooth = true;
    tooth.userData.toothIndex = index;
    rotor.add(tooth);
    toothMeshes.push(tooth);
  }

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, depth * 1.45, 24),
    toothMaterial,
  );
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);

  const faceIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.56, Math.max(0.04, radius * 0.06), 0.024),
    matte(PALETTE.white, { roughness: 0.5 }),
  );
  faceIndicator.position.set(radius * 0.37, 0, backFaceZ - 0.018);
  rotor.add(faceIndicator);
  root.userData.radius = radius;
  root.userData.teeth = teeth;
  root.userData.toothMeshes = toothMeshes;
  root.userData.toothProfile = 'back-cone-involute-approximation';
  root.userData.pitchConeAngle = pitchConeAngle;
  root.userData.toothRadii = {
    largeRootRadius,
    largeTipRadius,
    smallRootRadius,
    smallTipRadius,
  };
  return markShadows(root);
}

export function makeShaft({
  length = 3,
  radius = 0.09,
  color = PALETTE.ink,
  axis = new THREE.Vector3(0, 0, 1),
} = {}) {
  const root = rotorRoot(axis);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 22),
    matte(color, { metalness: 0.28, roughness: 0.44 }),
  );
  shaft.rotation.x = Math.PI / 2;
  root.userData.rotor.add(shaft);
  root.userData.length = length;
  return markShadows(root);
}

export function makeSteppedPulley({
  radii = [0.55, 0.8, 1.05],
  stepWidth = 0.3,
  color = PALETTE.driver,
  reverse = false,
  axis = new THREE.Vector3(0, 0, 1),
} = {}) {
  const root = rotorRoot(axis);
  const rotor = root.userData.rotor;
  const ordered = reverse ? [...radii].reverse() : radii;
  const material = matte(color, { metalness: 0.1 });
  const indicatorMaterial = matte(PALETTE.white, { roughness: 0.5 });
  ordered.forEach((radius, index) => {
    const step = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, stepWidth, 80),
      material,
    );
    step.rotation.x = Math.PI / 2;
    step.position.z = (index - (ordered.length - 1) / 2) * stepWidth;
    rotor.add(step);
    step.userData.role = 'stepped-pulley-tread';

    // A single index stripe makes both the direction and rate of rotation
    // legible even when a stepped pulley is viewed nearly face-on.
    for (const side of [-1, 1]) {
      const indicator = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 0.7, radius * 0.035, 0.004),
        indicatorMaterial,
      );
      indicator.position.set(
        radius * 0.35,
        0,
        step.position.z + side * (stepWidth / 2 + 0.002),
      );
      rotor.add(indicator);
    }
  });
  root.userData.radii = ordered;
  root.userData.stepWidth = stepWidth;
  return markShadows(root);
}

export function makeConePulley({
  length = 2.2,
  radiusStart = 0.42,
  radiusEnd = 1.12,
  color = PALETTE.driver,
  profile = 'linear',
  reverse = false,
  axis = new THREE.Vector3(0, 0, 1),
} = {}) {
  const root = rotorRoot(axis);
  const rotor = root.userData.rotor;
  const radiusAt = (normalized) => {
    const t = reverse ? 1 - normalized : normalized;
    let shaped = t;
    if (profile === 'convex') shaped = 1 - (1 - t) ** 1.8;
    if (profile === 'concave') shaped = t ** 1.8;
    return THREE.MathUtils.lerp(radiusStart, radiusEnd, shaped);
  };
  const points = [new THREE.Vector2(0, -length / 2)];
  const segments = 96;
  for (let index = 0; index <= segments; index += 1) {
    const normalized = index / segments;
    const radius = radiusAt(normalized);
    points.push(new THREE.Vector2(radius, -length / 2 + normalized * length));
  }
  points.push(new THREE.Vector2(0, length / 2));
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(points, 64),
    matte(color, { metalness: 0.12, roughness: 0.64 }),
  );
  body.rotation.x = Math.PI / 2;
  rotor.add(body);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, length * 1.35, 20),
    matte(PALETTE.ink, { metalness: 0.25, roughness: 0.45 }),
  );
  shaft.rotation.x = Math.PI / 2;
  rotor.add(shaft);
  const indicatorMaterial = matte(PALETTE.white, { roughness: 0.48 });
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const radius = radiusAt(i / segments) + 0.0008;
    for (const angle of [-0.025, 0.025]) {
      positions.push(radius * Math.cos(angle), radius * Math.sin(angle), -length / 2 + length * i / segments);
    }
    if (i < segments) indices.push(2 * i, 2 * i + 1, 2 * i + 3, 2 * i, 2 * i + 3, 2 * i + 2);
  }
  const indicatorGeometry = new THREE.BufferGeometry();
  indicatorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  indicatorGeometry.setIndex(indices);
  indicatorGeometry.computeVertexNormals();
  const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
  indicator.userData.role = 'cone-surface-index';
  rotor.add(indicator);
  root.userData.radiusAt = radiusAt;
  root.userData.length = length;
  root.userData.body = body;
  return markShadows(root);
}

export class CircularArcCurve3 extends THREE.Curve {
  constructor(center, radialStart, axis, sweep) {
    super();
    this.center = center.clone();
    this.radialStart = radialStart.clone();
    this.axis = axis.clone().normalize();
    this.sweep = sweep;
  }

  getPoint(t, target = new THREE.Vector3()) {
    return target
      .copy(this.radialStart)
      .applyAxisAngle(this.axis, this.sweep * t)
      .add(this.center);
  }

  getTangent(t, target = new THREE.Vector3()) {
    const radial = new THREE.Vector3()
      .copy(this.radialStart)
      .applyAxisAngle(this.axis, this.sweep * t);
    return target
      .crossVectors(this.axis, radial)
      .multiplyScalar(Math.sign(this.sweep) || 1)
      .normalize();
  }
}

export function circularArcThrough(
  center,
  start,
  end,
  axis,
  startTangent,
) {
  const normalizedAxis = axis.clone().normalize();
  const radialStart = start.clone().sub(center);
  const radialEnd = end.clone().sub(center);
  const radius = radialStart.length();
  if (radius < 1e-8 || Math.abs(radius - radialEnd.length()) > 1e-5) {
    throw new RangeError('Circular arc endpoints must have the same non-zero radius.');
  }

  const startUnit = radialStart.clone().divideScalar(radius);
  const endUnit = radialEnd.clone().divideScalar(radius);
  let sweep = Math.atan2(
    normalizedAxis.dot(new THREE.Vector3().crossVectors(startUnit, endUnit)),
    THREE.MathUtils.clamp(startUnit.dot(endUnit), -1, 1),
  );
  const positiveTangent = new THREE.Vector3()
    .crossVectors(normalizedAxis, startUnit)
    .normalize();
  const wantsPositiveSweep = positiveTangent.dot(startTangent) >= 0;
  if (wantsPositiveSweep && sweep <= 1e-8) sweep += Math.PI * 2;
  if (!wantsPositiveSweep && sweep >= -1e-8) sweep -= Math.PI * 2;
  return new CircularArcCurve3(center, radialStart, normalizedAxis, sweep);
}

function makeTube(path, { radius = 0.055, color = PALETTE.belt, closed = true, width, thickness, widthDirection, laid = false } = {}) {
  const fromPoints = Array.isArray(path);
  const curve = fromPoints
    ? new THREE.CatmullRomCurve3(path, closed, 'centripetal', 0.35)
    : path;
  if (typeof curve?.getPoint !== 'function') {
    throw new TypeError('A belt requires either points or a Three.js curve.');
  }
  const segmentCount = fromPoints
    ? Math.max(96, path.length * 6)
    : Math.max(128, (curve.curves?.length ?? 4) * 28);
  const geometry = width
    ? flatBeltGeometry(curve, { width, thickness, widthDirection, closed, segments: Math.max(256, segmentCount) })
    : laid ? new LaidRopeGeometry(curve, segmentCount, radius, 8, closed)
      : new THREE.TubeGeometry(curve, segmentCount, radius, 10, closed);
  const mesh = new THREE.Mesh(geometry, matte(color, { roughness: 0.76 }));
  mesh.castShadow = true;
  return { curve, mesh };
}

function beltMarker(radius, material, width, thickness) {
  const geometry = width
    ? new THREE.BoxGeometry(width + 0.001, thickness + 0.002, 0.035)
    : new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, radius * 0.85, 12);
  const marker = new THREE.Mesh(geometry, material);
  marker.userData.isFlowMarker = true;
  return marker;
}

function placeBeltMarker(marker, curve, u, width, widthDirection) {
  if (width) {
    const frame = beltFrameAt(curve, u, widthDirection);
    marker.position.copy(frame.point);
    marker.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.width, frame.normal, frame.tangent));
  } else {
    marker.position.copy(curve.getPointAt(u));
    const tangent = curve.getTangentAt(u).normalize();
    if (tangent.lengthSq() > 1e-10) marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  }
}

export function makeMovingBelt(path, {
  radius = 0.055,
  color = PALETTE.belt,
  markerColor = PALETTE.white,
  markerCount = 8,
  closed = true,
  width,
  thickness = 0.024,
  widthDirection = new THREE.Vector3(0, 0, 1),
  laid = false,
} = {}) {
  const group = new THREE.Group();
  // A laid rope shows its travel by its moving lay, so it carries no markers.
  const isLaid = laid && !width;
  const { curve, mesh } = makeTube(path, { radius, color, closed, width, thickness, widthDirection, laid: isLaid });
  group.add(mesh);
  const markerMaterial = matte(markerColor, { roughness: 0.5 });
  const markers = Array.from({ length: isLaid ? 0 : markerCount }, () => {
    const marker = beltMarker(radius, markerMaterial, width, thickness);
    group.add(marker);
    return marker;
  });

  group.userData.curve = curve;
  group.userData.crossSection = width ? 'flat' : isLaid ? 'laid-rope' : 'round';
  group.userData.width = width;
  group.userData.thickness = width ? thickness : 2 * radius;
  group.userData.mesh = mesh;
  group.userData.length = curve.getLength();
  group.userData.update = (phase) => {
    if (isLaid) mesh.geometry.setTravel(phase * group.userData.length);
    markers.forEach((marker, index) => {
      placeBeltMarker(marker, curve, THREE.MathUtils.euclideanModulo(phase + index / markerCount, 1), width, widthDirection);
    });
  };
  group.userData.updateDistance = (distance) => {
    group.userData.update(distance / group.userData.length);
  };
  group.userData.update(0);
  return group;
}

export function makeDynamicMovingBelt(initialCurve, {
  radius = 0.055,
  color = PALETTE.belt,
  markerColor = PALETTE.white,
  markerCount = 8,
  tubularSegments = 128,
  closed = true,
  width,
  thickness = 0.024,
  widthDirection = new THREE.Vector3(0, 0, 1),
  sectionAt,
  laid = false,
} = {}) {
  const group = new THREE.Group();
  const isLaid = laid && !width;
  const beltMaterial = matte(color, { roughness: 0.76 });
  const markerMaterial = matte(markerColor, { roughness: 0.5 });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), beltMaterial);
  mesh.castShadow = true;
  const markers = Array.from({ length: isLaid ? 0 : markerCount }, () => {
    const marker = beltMarker(radius, markerMaterial, width, thickness);
    group.add(marker);
    return marker;
  });
  group.add(mesh);
  group.userData.crossSection = width ? 'flat' : isLaid ? 'laid-rope' : 'round';
  group.userData.width = width;
  group.userData.thickness = width ? thickness : 2 * radius;
  group.userData.mesh = mesh;
  let distance = 0;

  group.userData.setCurve = (curve) => {
    if (typeof curve?.getPoint !== 'function') throw new TypeError('A dynamic belt requires a Three.js curve.');
    const replacement = width
      ? flatBeltGeometry(curve, { width, thickness, widthDirection, sectionAt, closed, segments: Math.max(256, tubularSegments) })
      : isLaid ? new LaidRopeGeometry(curve, tubularSegments, radius, 8, closed, { travel: distance })
        : new THREE.TubeGeometry(curve, tubularSegments, radius, 10, closed);
    const current = mesh.geometry;
    const canReuse = current.attributes.position?.count === replacement.attributes.position.count
      && current.index?.count === replacement.index?.count;
    if (isLaid && canReuse) {
      current._laid = replacement._laid;
      current.userData = replacement.userData;
    }
    if (canReuse) {
      for (const name of ['position', 'normal']) {
        current.attributes[name].array.set(replacement.attributes[name].array);
        current.attributes[name].needsUpdate = true;
      }
      current.computeBoundingBox();
      current.computeBoundingSphere();
      replacement.dispose();
    } else {
      mesh.geometry = replacement;
      current.dispose();
    }
    group.userData.curve = curve;
    group.userData.length = curve.getLength();
    group.userData.updateDistance(distance);
  };
  group.userData.updateDistance = (nextDistance) => {
    distance = nextDistance;
    const curve = group.userData.curve;
    const length = group.userData.length;
    if (!curve || !length) return;
    if (isLaid) mesh.geometry.setTravel?.(distance);
    markers.forEach((marker, index) => {
      const basePhase = closed ? index / markerCount : (index + 1) / (markerCount + 1);
      const phase = closed
        ? THREE.MathUtils.euclideanModulo(distance / length + basePhase, 1)
        : THREE.MathUtils.clamp(distance / length + basePhase, 0, 1);
      placeBeltMarker(marker, curve, phase, width, widthDirection);
    });
  };
  group.userData.closed = closed;
  group.userData.setCurve(initialCurve);
  return group;
}

function planarCenter(center, z) {
  return new THREE.Vector3(center.x, center.y, z);
}

class LiftedSpanCurve3 extends THREE.Curve {
  constructor(start, end, lift) {
    super();
    this.start = start.clone();
    this.end = end.clone();
    this.lift = lift;
    this.crossoverLift = lift;
  }

  getPoint(t, target = new THREE.Vector3()) {
    return target
      .copy(this.start)
      .lerp(this.end, t)
      .addScaledVector(
        new THREE.Vector3(0, 0, 1),
        this.lift * Math.sin(Math.PI * t) ** 2,
      );
  }

  getTangent(t, target = new THREE.Vector3()) {
    return target
      .subVectors(this.end, this.start)
      .add(new THREE.Vector3(
        0,
        0,
        this.lift * Math.PI * Math.sin(Math.PI * 2 * t),
      ))
      .normalize();
  }
}

function planarBeltCurve(centerA, centerB, radiusA, radiusB, z, crossed) {
  if (radiusA <= 0 || radiusB <= 0) throw new RangeError('Belt radii must be positive.');
  const firstCenter = planarCenter(centerA, z);
  const secondCenter = planarCenter(centerB, z);
  const direction = new THREE.Vector2().subVectors(centerB, centerA);
  const centerDistance = direction.length();
  const tangentOffset = crossed ? radiusA + radiusB : radiusA - radiusB;
  if (centerDistance <= Math.abs(tangentOffset) + 1e-8) {
    throw new RangeError('Pulley spacing does not admit the requested common tangents.');
  }

  const along = direction.clone().divideScalar(centerDistance);
  const across = new THREE.Vector2(-along.y, along.x);
  const projection = tangentOffset / centerDistance;
  const perpendicular = Math.sqrt(Math.max(0, 1 - projection ** 2));
  const normalA = along.clone().multiplyScalar(projection).addScaledVector(across, perpendicular);
  const normalB = along.clone().multiplyScalar(projection).addScaledVector(across, -perpendicular);
  const toPoint = (center, normal, radius, sign = 1) => new THREE.Vector3(
    center.x + normal.x * radius * sign,
    center.y + normal.y * radius * sign,
    z,
  );

  const firstA = toPoint(centerA, normalA, radiusA);
  const firstB = toPoint(centerB, normalA, radiusB, crossed ? -1 : 1);
  const secondA = toPoint(centerA, normalB, radiusA);
  const secondB = toPoint(centerB, normalB, radiusB, crossed ? -1 : 1);
  // A real crossed belt cannot occupy the same point at its crossover. Bow
  // the two free spans to opposite sides of the pulley plane, with zero axial
  // slope at every tangency, so the loop remains smooth and collision-free.
  const crossoverLift = crossed ? 0.13 : 0;
  const firstSpan = crossed
    ? new LiftedSpanCurve3(firstA, firstB, crossoverLift)
    : new THREE.LineCurve3(firstA, firstB);
  const secondSpan = crossed
    ? new LiftedSpanCurve3(secondB, secondA, -crossoverLift)
    : new THREE.LineCurve3(secondB, secondA);
  const secondArc = circularArcThrough(
    secondCenter,
    firstB,
    secondB,
    new THREE.Vector3(0, 0, 1),
    firstB.clone().sub(firstA).normalize(),
  );
  const firstArc = circularArcThrough(
    firstCenter,
    secondA,
    firstA,
    new THREE.Vector3(0, 0, 1),
    secondA.clone().sub(secondB).normalize(),
  );
  const curve = new THREE.CurvePath();
  curve.add(firstSpan);
  curve.add(secondArc);
  curve.add(secondSpan);
  curve.add(firstArc);
  curve.userData = {
    crossoverLift,
    selfIntersectionAvoidance: crossed ? 'opposed-axial-lifts' : 'not-required',
  };
  return curve;
}

export function beltCurveOpen(centerA, centerB, radiusA, radiusB, z = 0) {
  return planarBeltCurve(centerA, centerB, radiusA, radiusB, z, false);
}

export function beltCurveCrossed(centerA, centerB, radiusA, radiusB, z = 0) {
  return planarBeltCurve(centerA, centerB, radiusA, radiusB, z, true);
}

function sampledBeltPoints(curve, divisions = 80) {
  const points = curve.getSpacedPoints(divisions);
  if (points[0].distanceToSquared(points.at(-1)) < 1e-12) points.pop();
  return points;
}

export function beltPointsOpen(centerA, centerB, radiusA, radiusB, z = 0) {
  return sampledBeltPoints(beltCurveOpen(centerA, centerB, radiusA, radiusB, z));
}

export function beltPointsCrossed(centerA, centerB, radiusA, radiusB, z = 0) {
  return sampledBeltPoints(beltCurveCrossed(centerA, centerB, radiusA, radiusB, z));
}

export function makeDynamicLink({
  thickness = 0.14,
  depth = 0.22,
  color = PALETTE.ink,
  jointRadius = 0.18,
} = {}) {
  const group = new THREE.Group();
  const material = matte(color, { metalness: 0.1, roughness: 0.65 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, thickness, depth), material);
  const startJoint = new THREE.Mesh(new THREE.SphereGeometry(jointRadius, 18, 12), material);
  const endJoint = startJoint.clone();
  group.add(beam, startJoint, endJoint);
  group.userData.setEndpoints = (start, end) => {
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    beam.position.copy(midpoint);
    beam.scale.set(length, 1, 1);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
    startJoint.position.copy(start);
    endJoint.position.copy(end);
  };
  return markShadows(group);
}

export function makeDynamicCable({
  maxSegments = 32,
  radius = 0.045,
  color = PALETTE.belt,
  laid = false,
} = {}) {
  const group = new THREE.Group();
  if (laid) {
    // One laid rope along the polyline, in place of separate cylinders.
    const rope = new THREE.Mesh(new THREE.BufferGeometry(), matte(color, { roughness: 0.78 }));
    rope.castShadow = true;
    group.add(rope);
    group.userData.mesh = rope;
    group.userData.setPoints = (points, travel = 0) => {
      const path = new THREE.CurvePath();
      const count = Math.min(points.length - 1, maxSegments);
      for (let index = 0; index < count; index += 1) {
        if (points[index].distanceToSquared(points[index + 1]) < 1e-12) continue;
        path.add(new THREE.LineCurve3(points[index].clone(), points[index + 1].clone()));
      }
      if (!path.curves.length) { rope.visible = false; return; }
      rope.visible = true;
      replaceWithLaidRope(rope, path, { radius, travel });
    };
    return group;
  }
  const geometry = new THREE.CylinderGeometry(radius, radius, 1, 8);
  const material = matte(color, { roughness: 0.78 });
  const segments = Array.from({ length: maxSegments }, () => {
    const segment = new THREE.Mesh(geometry, material);
    segment.castShadow = true;
    group.add(segment);
    return segment;
  });
  const up = new THREE.Vector3(0, 1, 0);
  group.userData.setPoints = (points) => {
    const segmentCount = Math.min(points.length - 1, segments.length);
    segments.forEach((segment, index) => {
      segment.visible = index < segmentCount;
      if (index >= segmentCount) return;
      const start = points[index];
      const end = points[index + 1];
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = Math.max(direction.length(), 0.0001);
      segment.position.copy(start).add(end).multiplyScalar(0.5);
      segment.scale.set(1, length, 1);
      segment.quaternion.setFromUnitVectors(up, direction.normalize());
    });
  };
  return group;
}

export function makeBeam(start, end, options = {}) {
  const link = makeDynamicLink({ ...options, jointRadius: options.jointRadius ?? 0.001 });
  link.userData.setEndpoints(start, end);
  return link;
}

export function makeBearing(position, { height = 1.4, color = PALETTE.frame } = {}) {
  const group = new THREE.Group();
  const material = matte(color, { metalness: 0.12, roughness: 0.7 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, height, 0.38), material);
  post.position.y = -height / 2;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.075, 10, 28), material);
  group.add(post, collar);
  group.position.copy(position);
  return markShadows(group);
}

export function makeRack({
  length = 4,
  toothCount = 18,
  width = 0.35,
  color = PALETTE.driven,
} = {}) {
  const group = new THREE.Group();
  const material = matte(color, { metalness: 0.1 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(length, width * 0.55, width), material);
  base.position.y = -width * 0.28;
  group.add(base);
  const spacing = length / toothCount;
  for (let index = 0; index < toothCount; index += 1) {
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(spacing * 0.58, width * 0.55, width),
      material,
    );
    tooth.position.set(-length / 2 + (index + 0.5) * spacing, width * 0.26, 0);
    tooth.rotation.z = Math.PI / 4;
    group.add(tooth);
  }
  return markShadows(group);
}

export function makeCam({
  radius = 1,
  eccentricity = 0.26,
  depth = 0.3,
  color = PALETTE.driver,
} = {}) {
  const root = rotorRoot();
  const rotor = root.userData.rotor;
  const shape = new THREE.Shape();
  const segments = 72;
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const r = radius * (1 + eccentricity * Math.cos(angle));
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025 });
  geometry.translate(0, 0, -depth / 2);
  rotor.add(new THREE.Mesh(geometry, matte(color)));
  return markShadows(root);
}

export function makeScrew({
  length = 3.6,
  radius = 0.38,
  pitch = 0.55,
  color = PALETTE.driver,
  axis = new THREE.Vector3(1, 0, 0),
  handedness = 1,
  threadRadius = radius * 0.09,
} = {}) {
  const root = rotorRoot(axis);
  const rotor = root.userData.rotor;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, length, 28),
    matte(color, { metalness: 0.15, roughness: 0.58 }),
  );
  shaft.rotation.x = Math.PI / 2;
  rotor.add(shaft);
  const turns = length / pitch;
  const pointCount = Math.ceil(turns * 28) + 1;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const normalized = index / (pointCount - 1);
    const angle = normalized * turns * Math.PI * 2 * handedness;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      -length / 2 + normalized * length,
    );
  });
  const threadAssembly = makeTube(points, {
    radius: threadRadius,
    color: PALETTE.ink,
    closed: false,
  });
  const helix = threadAssembly.mesh;
  helix.userData.screwThread = true;
  const threadCapMaterial = matte(PALETTE.ink, { metalness: 0.15, roughness: 0.58 });
  const threadCaps = [points[0], points.at(-1)].map((point, index) => {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(threadRadius, 12, 8),
      threadCapMaterial,
    );
    cap.position.copy(point);
    cap.userData.screwThreadCap = true;
    cap.userData.threadEnd = index === 0 ? 'start' : 'end';
    rotor.add(cap);
    return cap;
  });
  rotor.add(helix);
  root.userData.axis = axis.clone().normalize();
  root.userData.handedness = handedness;
  root.userData.length = length;
  root.userData.pitch = pitch;
  root.userData.radius = radius;
  root.userData.starts = 1;
  root.userData.thread = helix;
  root.userData.threadCaps = threadCaps;
  root.userData.threadCurve = threadAssembly.curve;
  root.userData.threadPoints = points;
  root.userData.threadRadius = threadRadius;
  root.userData.turns = turns;
  return markShadows(root);
}

export function makeSpring({
  length = 2.6,
  radius = 0.38,
  turns = 9,
  color = PALETTE.ink,
} = {}) {
  const pointCount = turns * 22 + 1;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const t = index / (pointCount - 1);
    const angle = t * turns * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, -length / 2 + t * length, Math.sin(angle) * radius);
  });
  return markShadows(makeTube(points, { radius: 0.045, color, closed: false }).mesh);
}

export function makePaddleWheel({
  radius = 1.5,
  width = 0.7,
  paddles = 12,
  color = PALETTE.driver,
} = {}) {
  const root = rotorRoot();
  const rotor = root.userData.rotor;
  const material = matte(color, { roughness: 0.68 });
  const leftRim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.08, 10, 48), material);
  leftRim.position.z = -width / 2;
  const rightRim = leftRim.clone();
  rightRim.position.z = width / 2;
  rotor.add(leftRim, rightRim);
  for (let index = 0; index < paddles; index += 1) {
    const angle = (index / paddles) * Math.PI * 2;
    const paddle = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.52, 0.16, width),
      material,
    );
    paddle.position.set(Math.cos(angle) * radius * 0.82, Math.sin(angle) * radius * 0.82, 0);
    paddle.rotation.z = angle;
    rotor.add(paddle);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, width * 1.25, 24), matte(PALETTE.ink));
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  return markShadows(root);
}

export function smoothStep01(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
