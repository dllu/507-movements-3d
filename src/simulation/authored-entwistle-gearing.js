import { correctEntwistleGearing } from './capstan-entwistle-corrections.js';
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMiterGear } from './miter-gear.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import {
  circle,
  plate,
  poly,
  polygonClipping,
  spline,
} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function annulusGeometry(outerRadius, boreRadius, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.025,
    bevelOffset: -0.025,
    bevelThickness: 0.025,
    curveSegments: 64,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

// Brown's plate is a sectional elevation: shaft D runs from the broken-off
// left standard, through drum C' cast on C, the carrier block and stud E, and
// through the cast right standard that carries A, to the driving pulley on
// its right; both standards stand on one flat cast foot. No bearing posts,
// rails, brace or indices are drawn.
function presentHousedSection(root, material) {
  const blocks = root.userData.blocks;
  const geometry = root.userData.geometry;
  const axisY = geometry.apex.y;
  const shaftRadius = geometry.shaftRadius;
  const footTop = -1.74;
  const footBottom = -2.06;
  const depth = 0.30;
  const replace = (mesh, next) => {
    mesh.geometry.dispose();
    mesh.geometry = next;
  };
  const hide = (object) => {
    object.visible = false;
  };
  const detach = (object) => {
    object.removeFromParent();
    object.traverse((part) => part.geometry?.dispose());
  };
  [
    blocks.fixedGearBrace,
    blocks.carrierIndex,
    blocks.outputIndex,
    blocks.rightStandard,
    ...blocks.bearings,
    ...blocks.bearingPosts,
    ...blocks.outputFlanges,
  ].forEach(detach);
  for (const key of ['fixedGearBrace', 'carrierIndex', 'outputIndex']) {
    delete blocks[key];
  }
  blocks.bearings = [];
  blocks.bearingPosts = [];
  blocks.outputFlanges = [];
  // Gear back-face rings, white indicators and the white index tooth.
  for (const gear of blocks.gears) {
    hide(gear.userData.inset);
    hide(gear.userData.indicator);
    const [tooth] = gear.userData.toothMeshes;
    const plain = gear.userData.toothMeshes[1];
    if (tooth && plain) tooth.material = plain.material;
  }

  // Shaft D ends flush with the left boss and the pulley's outer face.
  const shaftLeft = -3.56;
  const shaftRight = 2.92;
  const shaftMesh = blocks.shaftD.userData.rotor.children[0];
  replace(shaftMesh, new THREE.CylinderGeometry(
    shaftRadius, shaftRadius, shaftRight - shaftLeft, 32,
  ));
  blocks.shaftD.position.x = (shaftLeft + shaftRight) / 2;

  // Drum C' cast on C, running back to the left standard.
  const drumLeft = -3.24;
  const drumRight = -1.40;
  const drumRadius = 0.70;
  replace(blocks.outputDrum, boredLatheGeometry([
    { axial: -(drumRight - drumLeft) / 2, radial: drumRadius },
    { axial: (drumRight - drumLeft) / 2, radial: drumRadius },
  // p94: the drum is cast over sleeve C' (bored 0.005 inside its 0.245
  // outside), so no drum bore lies on the sleeve's own bore.
  ], 0.24, 96).rotateX(Math.PI / 2));
  blocks.outputDrum.userData.castOnSleeve = true;
  blocks.outputDrum.rotation.set(0, -Math.PI / 2, 0);
  blocks.outputDrum.position.x = (drumLeft + drumRight) / 2;

  // Driving pulley fast on D beyond the right standard.
  const pulleyLeft = 2.12;
  const pulley = addRole(new THREE.Mesh(
    boredLatheGeometry([
      { axial: -(shaftRight - pulleyLeft) / 2, radial: 1.22 },
      { axial: 0, radial: 1.28 },
      { axial: (shaftRight - pulleyLeft) / 2, radial: 1.22 },
    ], shaftRadius + 0.001, 96),
    matte(PALETTE.driver, { metalness: 0.18, roughness: 0.5 }),
  ), 'driving-pulley-fast-on-shaft-D');
  pulley.rotation.z = Math.PI / 2;
  pulley.position.x = (pulleyLeft + shaftRight) / 2;
  blocks.carrierAssembly.add(pulley);
  blocks.drivingPulley = pulley;

  // Shaft D runs along x through each standard's boss: the elevation plate is
  // slotted there and a turned bearing bored for D fills the slot.
  const bearingRadius = 0.30;
  const standardBearings = [];
  const elevation = (outline, [x0, x1], role) => {
    const slot = poly([
      [x0 - 0.05, axisY - bearingRadius + 0.02], [x1 + 0.05, axisY - bearingRadius + 0.02],
      [x1 + 0.05, axisY + bearingRadius - 0.02], [x0 - 0.05, axisY + bearingRadius - 0.02],
    ]);
    const mesh = addRole(new THREE.Mesh(
      plate(polygonClipping.difference(poly(outline), slot), -depth, depth),
      material,
    ), role);
    mesh.userData.fixed = true;
    root.add(mesh);
    const bearing = addRole(new THREE.Mesh(
      boredLatheGeometry([
        { axial: -(x1 - x0) / 2, radial: bearingRadius },
        { axial: (x1 - x0) / 2, radial: bearingRadius },
      ], shaftRadius + 0.002, 96),
      material,
    ), `${role}-bearing-for-shaft-D`);
    bearing.rotation.z = Math.PI / 2;
    bearing.position.set((x0 + x1) / 2, axisY, 0);
    bearing.userData.fixed = true;
    root.add(bearing);
    standardBearings.push(bearing);
    return mesh;
  };
  const boss = (x, radius, start, end, radiusY = radius, count = 48) => Array.from(
    { length: count + 1 },
    (_, i) => {
      const angle = start + (end - start) * i / count;
      return [x + radius * Math.cos(angle), axisY + radiusY * Math.sin(angle)];
    },
  );
  // Right standard: a boss around D behind A, dropping to the foot.
  const rightX = 1.72;
  const standardRight = elevation([
    ...boss(rightX, 0.34, Math.PI, 0, 0.82),
    [2.06, -0.2],
    ...spline([[2.06, -1.1], [2.14, -1.58], [2.36, footTop]]),
    ...spline([[1.12, footTop], [1.34, -1.58], [1.40, -1.1]]),
    [1.40, -0.2],
  ], [1.40, 2.06], 'cast-right-standard-carrying-gear-A');
  standardRight.userData.foot = new THREE.Vector3(rightX, footTop, 0);
  // Left standard, broken off in the plate, carrying D beside drum C'.
  const leftX = -3.40;
  const standardLeft = elevation([
    ...boss(leftX, 0.155, 0, Math.PI),
    ...spline([[-3.555, axisY], [-3.56, -0.40], [-3.30, -1.30], [-2.88, footTop]]),
    ...spline([[-2.28, footTop], [-2.70, -1.10], [-3.08, -0.45], [-3.25, -0.14]]),
    [-3.25, axisY],
  ], [-3.555, -3.25], 'cast-left-standard-carrying-shaft-D');
  blocks.rightStandard = standardRight;
  blocks.leftStandard = standardLeft;
  blocks.castStandards = [standardLeft, standardRight];
  blocks.standardBearings = standardBearings;

  // One flat cast foot under both standards.
  const footLength = 3.34 + 3.84;
  replace(blocks.base, new THREE.BoxGeometry(footLength, footTop - footBottom, 1.1));
  blocks.base.position.set((3.34 - 3.84) / 2, (footTop + footBottom) / 2, 0);
  blocks.base.userData.role = 'cast-foot-plate';
  blocks.base.userData.fixed = true;

  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.9, footBottom - 0.02, -2.18),
    new THREE.Vector3(3.4, 2.80, 2.18),
  );
  root.userData.groundFloorY = footBottom;
  // A narrow field of view keeps the flat sectional elevation flat.
  root.userData.cameraFov = 12;
  root.traverse((object) => {
    for (const mat of [object.material].flat()) if (mat) mat.fog = false;
  });
}


// Pass 90: Brown's bevels are short-faced: the teeth fill only the outer
// part of the cone distance and the toe is cut square to the axis.
// p94: Brown's section shows each wheel with a plain flat back, as wide as
// the tooth tips, not a flat toothed back. Three equal miters can carry such
// a back only if every wheel's teeth stay inside the cylinder of radius
// backZ - clearance and its back plane stands at backZ: then the planet's
// teeth (radius < backZ about their own axis) never reach A's or C's back
// plane, and vice versa. So the teeth run on along their cone from the old
// heel (axial 1.20, tip radius 1.34) to the back plane at 1.36, their tips
// turned to that cylinder where they would pass it (a short turned band,
// as Brown draws at A), and a plain back disc closes them. The body under
// the teeth rises 0.012 above their roots and runs into the disc.
const BEVEL_BACK = {heelZ: 1.20, clearance: 0.02, thickness: 0.07};
function truncateEntwistleBevel(gear, toeZ, heelZ) {
  const rotor = gear.userData.rotor;
  const teethMeshes = rotor.children.filter((o) => o.userData.bevelTooth);
  const source = teethMeshes[0].geometry;
  const position = source.attributes.position;
  // bevelToothGeometry writes the toe cap (n), the heel cap (n), then four
  // vertices per side quad (4n).
  const n = position.count / 6;
  const heelOutline = Array.from({length: n}, (_, i) => {
    const p = new THREE.Vector3().fromBufferAttribute(position, n + i);
    return p.multiplyScalar(heelZ / p.z);
  });
  let tipHeel = 0, rootHeel = Infinity;
  for (const p of heelOutline) {
    const r = Math.hypot(p.x, p.y);
    tipHeel = Math.max(tipHeel, r); rootHeel = Math.min(rootHeel, r);
  }
  const tipLimit = tipHeel, backZ = tipLimit + BEVEL_BACK.clearance;
  const toothEnd = backZ + 0.01;
  // Stations along the cone; dense where the tips meet the turned band.
  const stations = [];
  for (let k = 0; k <= 8; k += 1) stations.push(toeZ + (heelZ - toeZ) * k / 8);
  for (let k = 1; k <= 8; k += 1) stations.push(heelZ + (toothEnd - heelZ) * k / 8);
  // Inside the back disc the tips step 0.003 in, off the disc's own rim.
  stations.splice(stations.findIndex((z) => z > backZ), 0, backZ);
  const ring = (z) => heelOutline.map((p) => {
    const q = p.clone().multiplyScalar(z / heelZ), r = Math.hypot(q.x, q.y);
    const limit = z > backZ + 1e-9 ? tipLimit - 0.003 : tipLimit;
    if (r > limit) { q.x *= limit / r; q.y *= limit / r; }
    return q;
  });
  const rings = stations.map(ring);
  const positions = [];
  const push = (...points) => { for (const v of points) positions.push(v.x, v.y, v.z); };
  const cap = THREE.ShapeUtils.triangulateShape(heelOutline.map((p) => new THREE.Vector2(p.x, p.y)), []);
  const toe = rings[0], end = rings.at(-1);
  for (const [a, b, c] of cap) { push(toe[c], toe[b], toe[a]); push(end[a], end[b], end[c]); }
  for (let k = 0; k + 1 < rings.length; k += 1) {
    const lo = rings[k], hi = rings[k + 1];
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      push(lo[i], lo[j], hi[j], lo[i], hi[j], hi[i]);
    }
  }
  const raw = new THREE.BufferGeometry();
  raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const flat = toCreasedNormals(raw, Math.PI / 4.5);
  raw.dispose();
  flat.userData = {...source.userData, profile: 'flat-backed-bevel-with-turned-tip-band', toeZ, heelZ, backZ, tipLimit};
  for (const mesh of teethMeshes) mesh.geometry = flat;
  source.dispose();
  const rootAt = (z) => rootHeel * z / heelZ + 0.012;
  // The body is carried on the gear's hub (0.005 into it), not bored to the
  // hub's own bore, where the two bores lay on each other.
  const hub = gear.userData.hub;
  hub.geometry.computeBoundingBox();
  const bore = Math.max(hub.geometry.boundingBox.max.x, hub.geometry.boundingBox.max.y) - 0.005;
  const body = gear.userData.body;
  body.geometry.dispose();
  const z0 = toeZ + 0.003, z1 = backZ + 0.02;
  body.geometry = boredLatheGeometry([{axial: z0, radial: rootAt(z0)}, {axial: z1, radial: rootAt(z1)}], bore, 96)
    .rotateX(Math.PI / 2);
  body.userData.bevelGearBody = true;
  // The plain back: a disc from the hub out to the tip cylinder.
  const back = new THREE.Mesh(
    boredLatheGeometry([{axial: backZ, radial: tipLimit}, {axial: backZ + BEVEL_BACK.thickness, radial: tipLimit}], bore, 128).rotateX(Math.PI / 2),
    body.material,
  );
  back.userData.role = 'plain-flat-back-of-bevel-wheel';
  back.userData.bevelGearBody = true;
  rotor.add(back);
  gear.userData.back = back;
  for (const part of [gear.userData.inset, gear.userData.indicator]) if (part) part.visible = false;
  gear.userData.toothFace = {toeZ, heelZ, backZ, tipLimit, backThickness: BEVEL_BACK.thickness};
}

function entwistlePatentGearing(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const carrierAxis = X_AXIS.clone();
  const fixedGearAxis = X_AXIS.clone();
  const outputGearAxis = X_AXIS.clone().negate();
  const planetAxisAtSource = Y_AXIS.clone();
  const apex = new THREE.Vector3(0, 0.62, 0);
  const teeth = 20;
  const innerDistance = 0.31;
  const outerDistance = 1.26;
  const toothHeight = 0.22;
  const toothPitch = fullTurn / teeth;
  const contactDistance = (innerDistance + outerDistance) / 2;
  const shaftRadius = 0.085;
  const looseBoreRadius = 0.14;
  const cycleDuration = 6;
  const carrierAngularSpeed = fullTurn / cycleDuration;

  const fixedGearA = makeMiterGear({
    axis: fixedGearAxis,
    boreRadius: looseBoreRadius,
    color: PALETTE.accent,
    innerDistance,
    outerDistance,
    teeth,
    toothHeight,
  });
  fixedGearA.position.copy(apex);
  fixedGearA.userData.connection = 'fixed-to-right-hand-standard';
  fixedGearA.userData.fixed = true;
  fixedGearA.userData.role = 'fixed-equal-bevel-gear-A';

  const outputGearC = makeMiterGear({
    axis: outputGearAxis,
    boreRadius: looseBoreRadius,
    color: PALETTE.driven,
    innerDistance,
    outerDistance,
    teeth,
    toothHeight,
  });
  outputGearC.position.copy(apex);
  outputGearC.userData.connection = 'fast-with-output-drum-C-prime';
  outputGearC.userData.looseOnShaftD = true;
  outputGearC.userData.role = 'loose-equal-bevel-output-gear-C';

  const planetGearB = makeMiterGear({
    axis: planetAxisAtSource,
    boreRadius: 0.074,
    color: PALETTE.driver,
    innerDistance,
    outerDistance,
    teeth,
    toothHeight,
  });
  planetGearB.position.copy(apex);
  planetGearB.userData.connection = 'free-to-spin-on-carried-stud-E';
  planetGearB.userData.role = 'carried-equal-bevel-planet-B';

  const carrierAssembly = addRole(
    new THREE.Group(),
    'input-shaft-D-and-radial-stud-E-carrier',
  );
  carrierAssembly.position.copy(apex);
  const shaftD = makeShaft({
    axis: carrierAxis,
    color: PALETTE.ink,
    length: 7.8,
    radius: shaftRadius,
  });
  shaftD.position.set(0, 0, 0);
  shaftD.userData.role = 'rotating-input-shaft-D';
  const studE = makeShaft({
    axis: planetAxisAtSource,
    color: PALETTE.ink,
    length: 1.55,
    radius: 0.072,
  });
  studE.position.copy(planetAxisAtSource).multiplyScalar(0.78);
  studE.userData.role = 'stud-E-fixed-radially-in-shaft-D';
  const carrierCollar = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.32, 32),
    matte(PALETTE.brass, { metalness: 0.25, roughness: 0.43 }),
  ), 'carrier-collar-securing-stud-E-to-shaft-D');
  carrierCollar.rotation.z = Math.PI / 2;
  carrierCollar.position.set(0, 0, 0);
  const carrierIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.72, 0.07),
    matte(PALETTE.white, { roughness: 0.42 }),
  ), 'visible-input-carrier-index');
  carrierIndex.position.set(2.95, 0.39, 0);
  planetGearB.position.set(0, 0, 0);
  carrierAssembly.add(
    shaftD,
    studE,
    carrierCollar,
    carrierIndex,
    planetGearB,
  );

  const outputAssembly = addRole(
    new THREE.Group(),
    'loose-output-C-and-attached-drum-C-prime',
  );
  outputAssembly.position.copy(apex);
  outputGearC.position.set(0, 0, 0);
  outputAssembly.add(outputGearC);
  const outputSleeve = addRole(new THREE.Mesh(
    annulusGeometry(0.245, 0.115, 2.25),
    matte(PALETTE.driven, { metalness: 0.22, roughness: 0.5 }),
  ), 'output-sleeve-running-loose-around-shaft-D');
  outputSleeve.rotation.y = -Math.PI / 2;
  outputSleeve.position.set(-1.88, 0, 0);
  outputSleeve.userData.boreRadius = 0.115;
  const outputDrum = addRole(new THREE.Mesh(
    annulusGeometry(0.78, 0.115, 1.06),
    matte(PALETTE.driven, { metalness: 0.18, roughness: 0.53 }),
  ), 'attached-output-drum-C-prime');
  outputDrum.rotation.y = -Math.PI / 2;
  outputDrum.position.set(-3.0, 0, 0);
  const drumFlangeMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.48,
  });
  const outputFlanges = [-3.53, -2.47].map((x, index) => {
    const flange = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.74, 0.075, 12, 54),
      drumFlangeMaterial,
    ), `output-drum-C-prime-flange-${index + 1}`);
    flange.rotation.y = Math.PI / 2;
    flange.position.set(x, 0, 0);
    return flange;
  });
  const outputIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.69, 0.065),
    matte(PALETTE.white, { roughness: 0.44 }),
  ), 'visible-two-times-speed-output-index');
  outputIndex.position.set(-3.55, 0.37, 0);
  outputAssembly.add(
    outputSleeve,
    outputDrum,
    ...outputFlanges,
    outputIndex,
  );

  const fixedMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.7,
  });
  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.9, 0.24, 2.7),
    fixedMaterial,
  ), 'fixed-bedplate');
  base.position.set(0, -2.0, 0);
  base.userData.fixed = true;
  const rightStandard = makeBeam(
    new THREE.Vector3(2.64, -1.88, -0.9),
    new THREE.Vector3(2.64, apex.y, -0.34),
    { color: PALETTE.frame, thickness: 0.2, depth: 0.22 },
  );
  rightStandard.userData.fixed = true;
  rightStandard.userData.role = 'fixed-standard-carrying-gear-A';
  const fixedGearBrace = makeBeam(
    new THREE.Vector3(2.64, apex.y, -0.34),
    apex.clone().add(new THREE.Vector3(1.47, 0, -0.16)),
    { color: PALETTE.frame, thickness: 0.19, depth: 0.2 },
  );
  fixedGearBrace.userData.fixed = true;
  fixedGearBrace.userData.role = 'rigid-brace-preventing-gear-A-rotation';
  const bearingMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const bearings = [-3.72, 3.72].map((x, index) => {
    const bearing = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.065, 10, 42),
      bearingMaterial,
    ), `fixed-shaft-D-bearing-${index + 1}`);
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(x, apex.y, 0);
    bearing.userData.fixed = true;
    return bearing;
  });
  const bearingPosts = bearings.map((bearing, index) => {
    const post = makeBeam(
      new THREE.Vector3(bearing.position.x, -1.88, 0),
      bearing.position,
      { color: PALETTE.frame, thickness: 0.17, depth: 0.19 },
    );
    post.userData.fixed = true;
    post.userData.role = `fixed-bearing-post-${index + 1}`;
    return post;
  });

  const contactMarkerMaterial = matte(PALETTE.white, {
    roughness: 0.35,
  });
  const fixedContactMarker = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    contactMarkerMaterial,
  ), 'visible-A-to-B-pitch-contact');
  const outputContactMarker = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    contactMarkerMaterial,
  ), 'visible-B-to-C-pitch-contact');

  root.add(
    base,
    rightStandard,
    fixedGearBrace,
    ...bearings,
    ...bearingPosts,
    fixedGearA,
    carrierAssembly,
    outputAssembly,
    fixedContactMarker,
    outputContactMarker,
  );

  const stateAtCarrierAngle = (
    carrierAngle,
    angularSpeed = carrierAngularSpeed,
  ) => {
    const outputAngle = 2 * carrierAngle;
    const planetRelativeAngle = carrierAngle;
    const outputAngularSpeed = 2 * angularSpeed;
    const planetRelativeAngularSpeed = angularSpeed;
    const planetAxis = planetAxisAtSource.clone().applyAxisAngle(
      carrierAxis,
      carrierAngle,
    );
    const fixedContact = apex.clone()
      .addScaledVector(fixedGearAxis, contactDistance)
      .addScaledVector(planetAxis, contactDistance);
    const outputContact = apex.clone()
      .addScaledVector(outputGearAxis, contactDistance)
      .addScaledVector(planetAxis, contactDistance);
    const carrierAngularVelocity = carrierAxis.clone().multiplyScalar(
      angularSpeed,
    );
    const outputAngularVelocity = carrierAxis.clone().multiplyScalar(
      outputAngularSpeed,
    );
    const planetAngularVelocity = carrierAngularVelocity.clone()
      .addScaledVector(planetAxis, planetRelativeAngularSpeed);
    const velocityAt = (angularVelocity, point) => (
      new THREE.Vector3().crossVectors(
        angularVelocity,
        point.clone().sub(apex),
      )
    );
    const fixedGearContactVelocity = new THREE.Vector3();
    const planetAtFixedVelocity = velocityAt(
      planetAngularVelocity,
      fixedContact,
    );
    const outputGearContactVelocity = velocityAt(
      outputAngularVelocity,
      outputContact,
    );
    const planetAtOutputVelocity = velocityAt(
      planetAngularVelocity,
      outputContact,
    );
    return {
      carrierAngle,
      carrierAngularSpeed: angularSpeed,
      fixedContact,
      fixedGearAngle: 0,
      fixedGearAngularSpeed: 0,
      fixedGearContactVelocity,
      fixedMeshNoSlipError: fixedGearContactVelocity.distanceTo(
        planetAtFixedVelocity,
      ),
      outputAngle,
      outputAngularSpeed,
      outputContact,
      outputGearContactVelocity,
      outputMeshNoSlipError: outputGearContactVelocity.distanceTo(
        planetAtOutputVelocity,
      ),
      planetAngularVelocity,
      planetAtFixedVelocity,
      planetAtOutputVelocity,
      planetAxis,
      planetRelativeAngle,
      planetRelativeAngularSpeed,
      willisAngleInvariant: outputAngle - 2 * carrierAngle,
      willisVelocityInvariant: outputAngularSpeed - 2 * angularSpeed,
    };
  };
  const stateAtTime = (time) => stateAtCarrierAngle(
    carrierAngularSpeed * time,
    carrierAngularSpeed,
  );

  const sourceState = stateAtTime(0);
  const closureState = stateAtTime(cycleDuration);
  const sourceContactA = sourceState.fixedContact.clone();
  const sourceContactC = sourceState.outputContact.clone();
  const fixedMountPhase = 0;
  const outputMountPhase = 0;
  const planetMountPhase = toothPitch / 2;
  setSpin(fixedGearA, fixedMountPhase);
  setSpin(outputGearC, outputMountPhase);
  setSpin(planetGearB, planetMountPhase);

  root.userData.archetype =
    'entwistle-fixed-side-equal-miter-planetary-speed-doubler';
  root.userData.mechanism =
    'shaft-D-carries-stud-E-and-planet-B-around-fixed-A-while-B-spin-drives-loose-C-and-drum-C-prime-at-two-times-D';
  root.userData.blocks = {
    base,
    bearingPosts,
    bearings,
    carrierAssembly,
    carrierCollar,
    carrierIndex,
    contactMarkers: [fixedContactMarker, outputContactMarker],
    fixedGearA,
    fixedGearBrace,
    gears: [fixedGearA, planetGearB, outputGearC],
    outputAssembly,
    outputDrum,
    outputFlanges,
    outputGearC,
    outputIndex,
    outputSleeve,
    planetGearB,
    rightStandard,
    shaftD,
    studE,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.15, -3.02, -3.02),
    new THREE.Vector3(4.15, 3.02, 3.02),
  );
  root.userData.canonicalTimes = {
    carrierHalfTurn: cycleDuration / 2,
    carrierQuarterTurn: cycleDuration / 4,
    cycleClosure: cycleDuration,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    independentCarrierInputs: 1,
    independentOutputCoordinates: 0,
    independentPlanetSpinCoordinates: 0,
  };
  root.userData.geometry = {
    apex,
    carrierAxis,
    contactDistance,
    cycleDuration,
    fixedGearAxis,
    fixedMountPhase,
    innerDistance,
    looseBoreRadius,
    outerDistance,
    outputGearAxis,
    outputMountPhase,
    planetAxisAtSource,
    planetMountPhase,
    shaftRadius,
    sourceContactA,
    sourceContactC,
    teeth,
    toothHeight,
    toothPitch,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 495 page marks Animated unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    historicalCorroboration: {
      detail:
        'The Inventor’s Universal Educator explains that carrying B about fixed A gives B both revolution and axial rotation, and that those two motions give C two revolutions.',
      page: 26,
      title: 'The Inventor’s Universal Educator, Vol. I (1889)',
      url:
        'https://archive.org/details/inventorsunivers01diet/page/26/mode/2up',
    },
    officialDescription: movement.description,
    officialEngraving: {
      labels: {
        fixedBevel: 'A',
        planet: 'B',
        outputBevel: 'C',
        outputDrum: 'C-prime',
        shaft: 'D',
        stud: 'E',
      },
      sourceUrl: movement.sourceUrl,
    },
    reconstructionDisclosure:
      'Because the official animation is unavailable, dimensions and cycle speed are presentation choices; topology and the 0:1:2 equal-miter velocity relation follow Brown’s description and the 1889 explanation.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCarrierAngle = stateAtCarrierAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.groundFloorY = -2.12;
  root.userData.transmission = {
    allGearDiametersEqual: true,
    allGearToothCountsEqual: true,
    carrierAngularSpeed,
    carrierTurnsPerCycle: 1,
    fixedGearTurnsPerCycle: 0,
    fixedSideWillisEquation: 'omega_A + omega_C = 2 * omega_D',
    outputSpeedRatioToCarrier: 2,
    outputTurnsPerCycle: 2,
    planetRelativeSpeedRatioToCarrier: 1,
    planetRelativeTurnsPerCycle: 1,
    reverseDriveCarrierRatioToOutput: 0.5,
    verifiedCarrierClosure: (
      closureState.carrierAngle - sourceState.carrierAngle
    ) / fullTurn,
    verifiedOutputClosure: (
      closureState.outputAngle - sourceState.outputAngle
    ) / fullTurn,
  };
  root.userData.cameraDistanceScale = 1.04;

  const update = (time) => {
    const state = stateAtTime(time);
    carrierAssembly.rotation.x = state.carrierAngle;
    outputAssembly.rotation.x = state.outputAngle;
    setSpin(planetGearB, planetMountPhase + state.planetRelativeAngle);
    fixedContactMarker.position.copy(state.fixedContact);
    outputContactMarker.position.copy(state.outputContact);
    carrierAssembly.userData.angularSpeed = state.carrierAngularSpeed;
    fixedGearA.userData.angularSpeed = 0;
    outputAssembly.userData.angularSpeed = state.outputAngularSpeed;
    planetGearB.userData.relativeAngularSpeed =
      state.planetRelativeAngularSpeed;
    root.userData.contacts = {
      fixedAToPlanetB: {
        noSlipError: state.fixedMeshNoSlipError,
        point: state.fixedContact,
      },
      planetBToOutputC: {
        noSlipError: state.outputMeshNoSlipError,
        point: state.outputContact,
      },
    };
    root.userData.kinematics = state;
  };
  correctEntwistleGearing(root);
  presentHousedSection(root, fixedMaterial);
  // The heel plane stands where the old back-cone heels' tips did (axial
  // 1.20), so the planet's tips sweep no further toward the right standard;
  // the face is the outer third of that.
  for (const gear of [fixedGearA, outputGearC, planetGearB]) {
    truncateEntwistleBevel(gear, 0.80, 1.20);
  }
  // Pass 93: in Brown's section each wheel's boss starts at its toe, so the
  // space between the three toes is free for the carrier block; the hubs no
  // longer run in toward the apex (they began 0.19 from it).
  for (const gear of [fixedGearA, outputGearC, planetGearB]) {
    const hub = gear.userData.hub;
    hub.geometry.computeBoundingBox();
    const box = hub.geometry.boundingBox;
    const outer = Math.max(box.max.x, box.max.y), center = hub.position.z;
    const boreRadius = gear === planetGearB ? 0.074 : looseBoreRadius;
    hub.geometry.dispose();
    // p94: B's boss stands 0.06 proud of its plain back, as Brown draws it
    // round stud E; A's back meets the standard's bearing, C's its sleeve.
    const bossEnd = gear === planetGearB ? gear.userData.toothFace.backZ + gear.userData.toothFace.backThickness + 0.06 : 1.38;
    hub.geometry = boredLatheGeometry([{axial: 0.80 - center, radial: outer}, {axial: bossEnd - center, radial: outer}], boreRadius, 64)
      .rotateX(Math.PI / 2);
    hub.userData.boreRadius = boreRadius;
  }
  // Brown's carrier is a square block on D, the stud E rising from it
  // through B. Pass 93: at his proportions it is about 0.37 of B's tip
  // diameter wide and 0.54 tall, filling the space between the three toes
  // (0.30 clear of each); it was a 0.40 x 0.28 collar.
  {
    const high = 0.62, low = -0.75, half = 0.50, length = 1.00;
    const square = poly([[low, -half], [high, -half], [high, half], [low, half]]);
    carrierCollar.geometry.dispose();
    // Bored along its local y, like the collar it replaces (turned onto x).
    carrierCollar.geometry = plate(polygonClipping.difference(square, poly(circle([0, 0], 0.087, 64))), -length / 2, length / 2)
      .rotateX(Math.PI / 2);
    carrierCollar.userData.boreRadius = 0.087;
    carrierCollar.userData.role = 'square-carrier-block-securing-stud-E-to-shaft-D';
  }
  update(0);
  root.userData.fidelity = 'authored';
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0.02, 0.03, 1),
  };
}

export function createAuthoredEntwistleGearingMovement(movement) {
  if (movement.id !== 495) return null;
  return entwistlePatentGearing(movement);
}
