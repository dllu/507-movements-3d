import * as THREE from 'three';
import { plate, ring, polygonClipping } from './finite-plate-geometry.js';
import {
  PL, PU, boreRadius, circlePoly, deg, eyeRadius, hubRadius, planes, quadrantCatchParts, shaftRadius,
  sourceScale, strokeSource, tangentLever, tappetSource,
} from './quadrant-catch-finite-parts.js';
import { quadrantCatchMotion } from './baked/quadrant-catch-motion.js';
import { PALETTE, markShadows, matte } from './primitives.js';
import { makeSeeThrough } from './see-through-part.js';

// Brown 183/184: two back-weighted valve handles on fixed shafts, each with a
// cast quadrant. Every part is one of Brown's drawn outlines extruded flat in
// the plane his hidden lines give it (quadrant-catch-finite-parts.js); the
// quadrants latch each other only through their drawn concentric rims, and the
// motion is the offline sequence in scripts/bake-quadrant-catch.mjs. Where
// Brown dashes working parts behind a quadrant (the upper C-arm behind the
// lower quadrant, the upper weight arm and rod behind the wing), the quadrant
// in front is drawn in the shared see-through style. 183 opens on the
// ascending stroke; 184 is the same gear reflected top to bottom.

const period = 18;
const eyeHole = 5;
const eyePin = 4.2;
const rodHalfWidth = 4;
const rodEyeRadius = 8.5;
const proud = 0.015;

const origin = [(PU[0] + PL[0]) / 2, (PU[1] + PL[1]) / 2];
const toModel = (p) => [(p[0] - origin[0]) * sourceScale, (origin[1] - p[1]) * sourceScale];
const relModel = (p, pivot) => [(p[0] - pivot[0]) * sourceScale, (pivot[1] - p[1]) * sourceScale];
const polyToModel = (mp, pivot) => mp.map((poly) => poly.map((r) => r.map((p) => relModel(p, pivot))));

function interpolateRow(phase) {
  const { rows, samples } = quadrantCatchMotion;
  const x = (((phase % 1) + 1) % 1) * samples, i = Math.min(Math.floor(x), samples - 1), f = x - i;
  const a = rows[i], b = rows[i + 1];
  return a.map((v, k) => v + (b[k] - v) * f);
}

// Plate 184 hangs both back-weight rods down from Brown's pins at mid height:
// the ball-lever handle carries a plain arm down-right from its (upper) hub
// to a pin behind the wing, and the wing handle a hidden arm up-left from its
// hub to a pin behind the piston rod (dashed on the plate); the wing's tip
// carries no eye. In the unreflected frame these are 183's arms turned about
// half a turn with the pull reversed, so each weight still turns its handle
// the same way over the whole swing. Both arms lie in the rear plane W, behind
// the piston rod and the wing, and take no part in the latch.
function restoreBrown184Weights(upper, lower) {
  const upperEye = [PU[0] - 103, PU[1] + 85], lowerEye = [PL[0] + 97, PL[1] - 107];
  // The wing's straight edge already meets its rim square at the tip, as
  // Brown squares it off on plate 184, so 183's casting is used unchanged.
  delete upper.parts.weightArm;
  upper.parts.weightArm = { planes: 'W', poly: tangentLever(PU, 20, upperEye, eyeRadius) };
  upper.parts.hub = { ...upper.parts.hub, planes: 'WAF' };
  upper.eye = upperEye;
  lower.parts.weightArm = { planes: 'W', poly: tangentLever(PL, 20, lowerEye, eyeRadius) };
  lower.eye = lowerEye;
}

// Extent of a set of plane letters (model units).
const extent = (letters) => {
  const zs = [...letters].map((c) => planes[c]);
  return [Math.min(...zs.map((z) => z[0])), Math.max(...zs.map((z) => z[1]))];
};

function sourceHandGear(movementId) {
  const root = new THREE.Group();
  const is184 = movementId === 184;
  const { upper, lower } = quadrantCatchParts();
  if (is184) restoreBrown184Weights(upper, lower);
  const materials = {
    upper: matte(PALETTE.driven, { metalness: 0.12, roughness: 0.6 }),
    lower: matte(PALETTE.accent, { metalness: 0.14, roughness: 0.58 }),
    // p109: mid steel grey; the pale #9aa19d pins read as holes in the bosses.
    steel: matte(PALETTE.muted, { metalness: 0.3, roughness: 0.45 }),
    rod: matte(PALETTE.frame, { metalness: 0.2, roughness: 0.5 }),
    // Pass 99: the piston rod is steel grey so the orange tappet on its face
    // reads as a separate part.
    piston: matte(PALETTE.muted, { metalness: 0.2, roughness: 0.55 }),
    tappet: matte(PALETTE.driver, { metalness: 0.1, roughness: 0.62 }),
  };
  const blocks = {};
  const makeHandle = (name, body) => {
    const group = new THREE.Group();
    const pivot = body.pivot, pm = toModel(pivot);
    group.position.set(pm[0], pm[1], 0);
    group.userData.role = `${name}-back-weighted-quadrant-valve-handle`;
    group.userData.axis = new THREE.Vector3(0, 0, 1);
    const bore = circlePoly(pivot, boreRadius, 96);
    let hubPlanes = '';
    for (const [partName, part] of Object.entries(body.parts)) {
      if (partName === 'hub') continue;
      hubPlanes += part.planes;
      let poly = polygonClipping.difference(part.poly, bore);
      if (partName === 'weightArm') poly = polygonClipping.difference(poly, circlePoly(body.eye, eyeHole, 48));
      const mesh = new THREE.Mesh(plate(polyToModel(poly, pivot), ...extent(part.planes)), materials[name]);
      mesh.userData.role = `${name}-handle-${partName}`;
      group.add(mesh);
      blocks[`${name}${partName[0].toUpperCase()}${partName.slice(1)}`] = mesh;
    }
    // The bored boss (Brown's double circle) runs through every plate of the
    // casting and stands just proud of the outermost faces.
    const [low, high] = extent(hubPlanes);
    const hub = new THREE.Mesh(ring(boreRadius * sourceScale, hubRadius[name] * sourceScale, low - proud, high + proud, 128), materials[name]);
    hub.userData.role = `${name}-handle-hub`;
    group.add(hub);
    blocks[`${name}Hub`] = hub;
    // The fixed shaft (Brown's hatched section) fills the bore, flush with the boss.
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius * sourceScale, shaftRadius * sourceScale, high - low + 2 * proud, 64), materials.steel);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(pm[0], pm[1], (low + high) / 2);
    shaft.userData.role = `fixed-sectioned-${name}-handle-shaft`;
    shaft.userData.fixed = true;
    root.add(group, shaft);
    blocks[`${name}Shaft`] = shaft;
    return group;
  };
  const upperHandle = makeHandle('upper', upper);
  const lowerHandle = makeHandle('lower', lower);
  // Brown dashes working parts behind both quadrants: they are see-through.
  makeSeeThrough(blocks.lowerQuadrant);
  makeSeeThrough(blocks.upperWing);

  // Piston rod (source width, built once the framing is known) and the
  // hatched tappet projecting from its front face through the handle planes.
  const rodX0 = 155, rodX1 = 190;
  const pistonGroup = new THREE.Group();
  pistonGroup.userData.role = 'vertically-reciprocating-piston-tappet';
  pistonGroup.userData.axis = new THREE.Vector3(0, 1, 0);
  const tappetLow = planes.R[1] - 0.01, tappetHigh = planes.H[1];
  // The rendered block is 0.4 px inside the solved one on its working
  // faces, so contacts sampled between table rows read as touching.
  const inset = 0.4;
  const tappet = new THREE.Mesh(new THREE.BoxGeometry((tappetSource.x1 - tappetSource.x0 - inset) * sourceScale,
    (tappetSource.h - 2 * inset) * sourceScale, tappetHigh - tappetLow), materials.tappet);
  tappet.position.set(toModel([(tappetSource.x0 + tappetSource.x1) / 2, 0])[0], -tappetSource.h / 2 * sourceScale, (tappetLow + tappetHigh) / 2);
  tappet.userData.role = 'projecting-piston-rod-tappet';
  pistonGroup.add(tappet);
  root.add(pistonGroup);
  const sgn = is184 ? -1 : 1;

  // Back-weight rods: flat bars hanging close behind their arm's eye on a pin
  // through both eyes; each runs straight out of the view to its weight.
  const weightRods = {};
  for (const [name, body] of [['upper', upper], ['lower', lower]]) {
    const armZ = extent(body.parts.weightArm.planes);
    const rodZ = body.parts.weightArm.planes === 'B' ? planes.rodsB : planes.rodsW;
    const group = new THREE.Group();
    group.userData.role = `${name}-back-weight-rod-hanging-from-eye`;
    const rod = new THREE.Mesh(new THREE.BufferGeometry(), materials.rod);
    rod.userData.role = `${name}-back-weight-rod`;
    rod.userData.runsPastCrop = true;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(eyePin * sourceScale, eyePin * sourceScale, armZ[1] - rodZ[0], 32), materials.steel);
    pin.rotation.x = Math.PI / 2;
    pin.position.z = (armZ[1] + rodZ[0]) / 2;
    pin.userData.role = `${name}-back-weight-rod-eye-pin`;
    group.add(rod, pin);
    root.add(group);
    weightRods[name] = { group, rod, pin, eye: body.eye, pivot: body.pivot, rodZ, length: 1 };
    blocks[`${name}WeightRod`] = rod;
    blocks[`${name}WeightPin`] = pin;
  }
  const buildRod = (w) => {
    // The bar and its round eye are one outline, the eye concentric with the pin.
    const r = rodEyeRadius * sourceScale, h = rodHalfWidth * sourceScale, L = w.length;
    const bar = [[[[-h, 0], [h, 0], [h, -sgn * L], [-h, -sgn * L], [-h, 0]]]];
    const eye = circlePoly([0, 0], r / sourceScale, 64).map((p) => p.map((ringPts) => ringPts.map(([x, y]) => [x * sourceScale, y * sourceScale])));
    const hole = circlePoly([0, 0], eyeHole, 48).map((p) => p.map((ringPts) => ringPts.map(([x, y]) => [x * sourceScale, y * sourceScale])));
    w.rod.geometry.dispose();
    w.rod.geometry = plate(polygonClipping.difference(polygonClipping.union(bar, eye), hole), ...w.rodZ);
  };

  const phaseAt183 = Math.acos((strokeSource.source183 - (strokeSource.top + strokeSource.bottom) / 2)
    / ((strokeSource.bottom - strokeSource.top) / 2)) / (2 * Math.PI);
  const initialPhase = phaseAt183;
  const eyeAt = (w, angle) => {
    const r = [w.eye[0] - w.pivot[0], w.eye[1] - w.pivot[1]], a = angle * deg;
    return [w.pivot[0] + r[0] * Math.cos(a) - r[1] * Math.sin(a), w.pivot[1] + r[0] * Math.sin(a) + r[1] * Math.cos(a)];
  };
  const stateAtTime = (time) => {
    const phase = (((time / period + initialPhase) % 1) + 1) % 1;
    const [tappetTop, upperAngle, lowerAngle] = interpolateRow(phase);
    return {
      phase, tappetTop, upperAngle, lowerAngle,
      upperLatchedByLowerQuadrant: upperAngle < 1,
      lowerLatchedByUpperQuadrant: lowerAngle > 45 && upperAngle > 3,
    };
  };
  const update = (time) => {
    const s = stateAtTime(time);
    upperHandle.rotation.z = -s.upperAngle * deg;
    lowerHandle.rotation.z = -s.lowerAngle * deg;
    pistonGroup.position.y = (origin[1] - s.tappetTop) * sourceScale;
    for (const [name, w] of Object.entries(weightRods)) {
      const m = toModel(eyeAt(w, name === 'upper' ? s.upperAngle : s.lowerAngle));
      w.group.position.set(m[0], m[1], 0);
    }
    root.userData.kinematics = s;
  };

  root.userData.blocks = { ...blocks, upperHandle, lowerHandle, pistonGroup, tappet };
  root.userData.geometry = { planes, origin, sourceScale, cyclePeriod: period, initialPhase, boreRadius, shaftRadius, eyeHole, eyePin };
  root.userData.stateAtTime = stateAtTime;
  root.userData.archetype = is184
    ? 'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-184'
    : 'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-183';
  root.userData.mechanism = is184
    ? 'top-position-descending-piston-tappet-trips-upper-quadrant-handle-releases-lower-backweighted-quadrant-handle-and-restores-four-valves'
    : 'ascending-piston-tappet-trips-lower-quadrant-handle-releases-upper-backweighted-quadrant-handle-and-reverses-four-valves';
  root.userData.fidelity = 'authored';
  root.userData.variant = is184 ? 'source-184-reflected-top-of-cylinder-initial-pose' : 'source-183-ascending-stroke-initial-pose';
  root.userData.reconstructionNote = 'The quadrants latch through their drawn concentric rims only: the wing\'s toe rests on the lower band\'s rim, and after the transfer the band\'s end rests against the dropped wing. Tappet contacts are solved from the outlines; the weighted drops, the valve stops and the two throws of the handles (the caption\'s "throws the catches and handles") are timed kinematic laws, and forces are not simulated. Deliberate departure: the lower quadrant is cast 14° clockwise of Brown\'s relative to his ball lever, so the handle is held at 59.9° with the ball clear of the upper boss (with Brown\'s castings the hold is 73.9°, the lever pointing straight at the upper shaft). 184 is the 183 gear reflected top to bottom; its back-weight rods hang from Brown\'s mid-height pins on plain arms behind the piston rod and the wing.';
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 12;
  root.userData.cameraDirection = new THREE.Vector3(0, 0, 18);
  root.userData.cameraFov = 8;
  root.userData.cameraDistanceScale = 0.9;

  // Frame Brown's plate over the whole cycle (unreflected frame); the rods
  // count only as far as his breaks.
  const box = new THREE.Box3(), point = new THREE.Vector3();
  const rodTop = is184 ? -44 : 38, rodBottom = is184 ? 416 : 500;
  const eyeY = { upper: [], lower: [] }, pistonY = [];
  for (let i = 0; i <= 144; i++) {
    update(period * i / 144); root.updateMatrixWorld(true);
    pistonY.push(pistonGroup.position.y);
    for (const [name, w] of Object.entries(weightRods)) eyeY[name].push(w.group.position.y);
    if (i % 2) continue;
    root.traverseVisible((o) => {
      const a = o.geometry?.attributes?.position;
      if (a && !o.userData.runsPastCrop) for (let j = 0; j < a.count; j++) box.expandByPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld));
    });
  }
  for (const [x, y] of [[rodX0, rodBottom], [rodX1, rodTop]].map(toModel)) box.expandByPoint(point.set(x, y, 0));
  box.expandByScalar(0.1);
  // View-frame extremes: 184 is shown reflected, so its rods hang the other
  // way in this frame.
  const viewMin = is184 ? -box.max.y : box.min.y, viewMax = is184 ? -box.min.y : box.max.y;
  for (const [name, w] of Object.entries(weightRods)) {
    const eyes = eyeY[name].map((y) => sgn * y);
    w.length = Math.max(...eyes) - (viewMin - 0.35);
    buildRod(w);
  }
  // The whole piston rod runs past both of Brown's breaks in every pose.
  const pv = pistonY.map((y) => sgn * y);
  const localLow = viewMin - 0.8 - Math.max(...pv), localHigh = viewMax + 0.8 - Math.min(...pv);
  const [x0, x1] = [toModel([rodX0, 0])[0], toModel([rodX1, 0])[0]];
  const [ya, yb] = [sgn * localLow, sgn * localHigh].sort((a, b) => a - b);
  const pistonRod = new THREE.Mesh(plate([[[[x0, ya], [x1, ya], [x1, yb], [x0, yb], [x0, ya]]]], ...planes.R), materials.piston);
  pistonRod.userData.role = 'source-width-sectioned-piston-rod';
  pistonRod.userData.runsPastCrop = true;
  pistonGroup.add(pistonRod);
  root.userData.blocks.pistonRod = pistonRod;

  root.traverse((o) => { for (const m of [].concat(o.material ?? [])) m.fog = false; });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  // Plate 184 is plate 183 drawn upside down: the ball lever and hook on the
  // upper shaft, the pointed-window wing hanging from the lower one, and the
  // tappet up by the upper shaft. It shows the same gear reflected top to
  // bottom at 183's pose: the tappet then stands at the top of its stroke in
  // the view and descends onto the upper (ball) handle, as Brown's caption for
  // 182 and 184 describes. The reflection is a presentation transform; every
  // relative motion and contact is the 183 sequence.
  if (is184) {
    const mirror = new THREE.Group();
    mirror.userData.role = 'plate-184-top-to-bottom-reflection';
    for (const child of [...root.children]) mirror.add(child);
    mirror.scale.y = -1;
    root.add(mirror);
    root.userData.blocks.plate184Reflection = mirror;
  }
  root.userData.cameraFitBounds = is184
    ? new THREE.Box3(new THREE.Vector3(box.min.x, -box.max.y, box.min.z), new THREE.Vector3(box.max.x, -box.min.y, box.max.z))
    : box;
  update(0);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredQuadrantCatchMovement(movement) {
  if (movement.id !== 183 && movement.id !== 184) return null;
  return sourceHandGear(movement.id);
}
