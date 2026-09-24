import * as THREE from 'three';
import { plate, ring, polygonClipping } from './finite-plate-geometry.js';
import {
  PL, PU, circlePoints, deg, pinRadius, quadrantCatchParts, sourceScale, strokeSource,
  tappetSource,
} from './quadrant-catch-finite-parts.js';
import { quadrantCatchMotion } from './baked/quadrant-catch-motion.js';
import { PALETTE, markShadows, matte } from './primitives.js';

// Brown 183/184: two back-weighted valve handles on fixed shafts, each with a
// cast quadrant. The piston-rod tappet lifts the lower handle on the up
// stroke and depresses the upper one on the down stroke. The handles follow
// the tappet faces under their weights; each quadrant's concentric rim holds
// a stud on the other handle until the rim end passes it. Motion comes from
// the offline quasistatic solve in scripts/bake-quadrant-catch.mjs. 183 opens
// on the ascending stroke; 184 is the same gear at the top of the stroke.

// Axial layers, model units, back to front.
const layers = Object.freeze({
  rods: [-0.66, -0.58],
  W: [-0.52, -0.40],
  R: [-0.36, -0.16],
  A: [-0.12, 0.02],
  X: [0.04, 0.18],
  Y: [0.20, 0.34],
  B: [0.36, 0.50],
});
const span = (planes) => {
  const zs = [...planes].map((p) => layers[p]);
  return [Math.min(...zs.map((z) => z[0])), Math.max(...zs.map((z) => z[1]))];
};

const origin = [(PU[0] + PL[0]) / 2, (PU[1] + PL[1]) / 2];
const toModel = (p) => [(p[0] - origin[0]) * sourceScale, (origin[1] - p[1]) * sourceScale];
const relModel = (p, pivot) => [(p[0] - pivot[0]) * sourceScale, (pivot[1] - p[1]) * sourceScale];
const polyToModel = (mp, pivot) => mp.map((poly) => poly.map((r) => r.map((p) => relModel(p, pivot))));
const circlePoly = (c, r, n = 64) => [[[...circlePoints(c, r, n), circlePoints(c, r, n)[0]]]];

const period = 18;
const boreRadius = 16;
const shaftRadius = 15;
const eyeHole = 5;
const eyePin = 4.2;
const rodTopY = 38;
const rodBottomY = 500;
const weightRodBottom = { upper: 475, lower: 505 };

function interpolateRow(phase) {
  const { rows, samples } = quadrantCatchMotion;
  const x = (((phase % 1) + 1) % 1) * samples, i = Math.min(Math.floor(x), samples - 1), f = x - i;
  const a = rows[i], b = rows[i + 1];
  return a.map((v, k) => v + (b[k] - v) * f);
}

function sourceHandGear(movementId) {
  const root = new THREE.Group();
  const is184 = movementId === 184;
  const { upper, lower } = quadrantCatchParts();
  const materials = {
    upper: matte(PALETTE.driven, { metalness: 0.12, roughness: 0.6 }),
    lower: matte(PALETTE.accent, { metalness: 0.14, roughness: 0.58 }),
    pin: matte(PALETTE.ink, { metalness: 0.2, roughness: 0.5 }),
    shaft: matte(PALETTE.frame, { metalness: 0.12, roughness: 0.7 }),
    piston: matte(PALETTE.driver, { metalness: 0.1, roughness: 0.62 }),
    tappet: matte(0x7a2f22, { metalness: 0.1, roughness: 0.62 }),
  };
  const blocks = {};
  const makeHandle = (name, body, eye) => {
    const group = new THREE.Group();
    const pivot = body.pivot, pm = toModel(pivot);
    group.position.set(pm[0], pm[1], 0);
    group.userData.role = `${name}-back-weighted-quadrant-valve-handle`;
    group.userData.axis = new THREE.Vector3(0, 0, 1);
    const bore = circlePoly(pivot, boreRadius, 96);
    for (const [partName, part] of Object.entries(body.parts)) {
      let poly = partName === 'hub' ? null : polygonClipping.difference(part.poly, bore);
      const [low, high] = span(part.planes);
      if (eye && partName === (name === 'upper' ? 'quadrant' : 'weightArm')) {
        poly = polygonClipping.difference(poly, circlePoly(eye, eyeHole, 48));
      }
      const geometry = partName === 'hub'
        ? ring(boreRadius * sourceScale, (name === 'upper' ? 34 : 35) * sourceScale, low, high, 96)
        : plate(polyToModel(poly, pivot), low, high);
      const mesh = new THREE.Mesh(geometry, materials[name]);
      mesh.userData.role = `${name}-handle-${partName}`;
      group.add(mesh);
      blocks[`${name}${partName[0].toUpperCase()}${partName.slice(1)}`] = mesh;
    }
    root.add(group);
    return group;
  };
  const upperHandle = makeHandle('upper', upper, upper.eye);
  const lowerHandle = makeHandle('lower', lower, lower.eye);

  // Fixed shafts, drawn by Brown as hatched sections.
  for (const [name, pivot] of [['upper', PU], ['lower', PL]]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius * sourceScale, shaftRadius * sourceScale, 1.12, 48), materials.shaft);
    shaft.rotation.x = Math.PI / 2;
    const pm = toModel(pivot);
    shaft.position.set(pm[0], pm[1], 0);
    shaft.userData.role = `fixed-sectioned-${name}-handle-shaft`;
    shaft.userData.fixed = true;
    root.add(shaft);
    blocks[`${name}Shaft`] = shaft;
  }

  // Piston rod: a source-width section with broken ends (it runs beyond the
  // plate), carrying the projecting tappet.
  const rodX0 = 155, rodX1 = 190;
  const rodOutline = [[rodX0, rodBottomY], [rodX0 + 10, rodBottomY - 6], [rodX0 + 21, rodBottomY + 4], [rodX1, rodBottomY - 3],
    [rodX1, rodTopY], [rodX1 - 12, rodTopY + 5], [rodX1 - 22, rodTopY - 4], [rodX0, rodTopY + 3]].map(toModel);
  const pistonRod = new THREE.Mesh(plate([[[...rodOutline, rodOutline[0]]]], ...layers.R), materials.piston);
  pistonRod.userData.role = 'source-width-sectioned-piston-rod';
  root.add(pistonRod);
  const pistonGroup = new THREE.Group();
  pistonGroup.userData.role = 'vertically-reciprocating-piston-tappet';
  pistonGroup.userData.axis = new THREE.Vector3(0, 1, 0);
  const tappetDepth = layers.B[1] - layers.R[1];
  // The rendered shoe is 0.3 px inside the solved shoe on its working faces,
  // so solver-tolerance contacts show as touching rather than interpenetrating.
  const inset = 0.3;
  const tappet = new THREE.Mesh(new THREE.BoxGeometry(
    (tappetSource.x1 - tappetSource.x0 - inset) * sourceScale, (tappetSource.h - 2 * inset) * sourceScale, tappetDepth), materials.tappet);
  tappet.position.set(toModel([(tappetSource.x0 + tappetSource.x1 - inset) / 2, 0])[0], -tappetSource.h / 2 * sourceScale,
    layers.R[1] + tappetDepth / 2);
  tappet.userData.role = 'projecting-piston-rod-tappet';
  pistonGroup.add(tappet);
  root.add(pistonGroup);

  // Back-weight rods hang from the eyes and are cut at the plate edge.
  const weightRods = {};
  for (const [name, body] of [['upper', upper], ['lower', lower]]) {
    const group = new THREE.Group();
    group.userData.role = `${name}-back-weight-rod-hanging-from-eye`;
    const rod = new THREE.Mesh(new THREE.BoxGeometry(8 * sourceScale, 1, layers.rods[1] - layers.rods[0]), materials.pin);
    rod.position.z = (layers.rods[0] + layers.rods[1]) / 2;
    rod.userData.role = `${name}-back-weight-rod`;
    const eyeZ = span(name === 'upper' ? 'X' : 'W');
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(eyePin * sourceScale, eyePin * sourceScale, eyeZ[1] - layers.rods[1], 32), materials.pin);
    pin.rotation.x = Math.PI / 2;
    pin.position.z = (eyeZ[1] + layers.rods[1]) / 2;
    pin.userData.role = `${name}-back-weight-rod-eye-pin`;
    group.add(rod, pin);
    root.add(group);
    weightRods[name] = { group, rod, pin, eye: body.eye, pivot: body.pivot };
    blocks[`${name}WeightRod`] = rod;
    blocks[`${name}WeightPin`] = pin;
  }

  const phaseAt183 = Math.acos((strokeSource.source183 - (strokeSource.top + strokeSource.bottom) / 2)
    / ((strokeSource.bottom - strokeSource.top) / 2)) / (2 * Math.PI);
  const initialPhase = is184 ? 0.5 : phaseAt183;
  const eyeAt = (w, angle) => {
    const r = [w.eye[0] - w.pivot[0], w.eye[1] - w.pivot[1]], a = angle * deg;
    return [w.pivot[0] + r[0] * Math.cos(a) - r[1] * Math.sin(a), w.pivot[1] + r[0] * Math.sin(a) + r[1] * Math.cos(a)];
  };
  const stateAtTime = (time) => {
    const phase = (((time / period + initialPhase) % 1) + 1) % 1;
    const [tappetTop, upperAngle, lowerAngle] = interpolateRow(phase);
    return {
      phase, tappetTop, upperAngle, lowerAngle,
      upperLatchedByLowerQuadrant: upperAngle < 2,
      lowerLatchedByUpperQuadrant: lowerAngle > 53 && upperAngle > 34,
    };
  };
  const update = (time) => {
    const s = stateAtTime(time);
    upperHandle.rotation.z = -s.upperAngle * deg;
    lowerHandle.rotation.z = -s.lowerAngle * deg;
    pistonGroup.position.y = (origin[1] - s.tappetTop) * sourceScale;
    for (const [name, w] of Object.entries(weightRods)) {
      const e = eyeAt(w, name === 'upper' ? s.upperAngle : s.lowerAngle), m = toModel(e);
      const length = Math.max(0.05, (weightRodBottom[name] - e[1]) * sourceScale);
      w.group.position.set(m[0], m[1], 0);
      w.rod.scale.y = length;
      w.rod.position.y = -length / 2;
    }
    root.userData.kinematics = s;
  };

  root.userData.blocks = { ...blocks, upperHandle, lowerHandle, pistonGroup, pistonRod, tappet };
  root.userData.geometry = { layers, origin, sourceScale, cyclePeriod: period, initialPhase, boreRadius, shaftRadius, pinRadius, eyeHole, eyePin };
  root.userData.stateAtTime = stateAtTime;
  root.userData.archetype = is184
    ? 'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-184'
    : 'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-183';
  root.userData.mechanism = is184
    ? 'top-position-descending-piston-tappet-trips-upper-quadrant-handle-releases-lower-backweighted-quadrant-handle-and-restores-four-valves'
    : 'ascending-piston-tappet-trips-lower-quadrant-handle-releases-upper-backweighted-quadrant-handle-and-reverses-four-valves';
  root.userData.fidelity = 'authored';
  root.userData.variant = is184 ? 'source-184-top-of-cylinder-initial-pose' : 'source-183-ascending-stroke-initial-pose';
  root.userData.reconstructionNote = 'Handle motion is a quasistatic solve: the tappet pushes, the back weights are represented by each handle moving toward its weighted side until a contact or its undrawn valve stop, and concentric quadrant rims hold studs on the opposite handle. Forces, friction and impact are not simulated. 184 is the 183 geometry at the top of the stroke; Brown draws larger handle swings there.';
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 12;
  root.userData.cameraDirection = new THREE.Vector3(0, 0, 18);
  root.userData.cameraFov = 8;
  root.userData.cameraDistanceScale = 0.9;
  root.traverse((o) => { for (const m of [].concat(o.material ?? [])) m.fog = false; });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  const box = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i <= 72; i++) {
    update(period * i / 72); root.updateMatrixWorld(true);
    root.traverseVisible((o) => {
      const a = o.geometry?.attributes.position;
      if (a) for (let j = 0; j < a.count; j++) box.expandByPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld));
    });
  }
  root.userData.cameraFitBounds = box.expandByScalar(0.1);
  update(0);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredQuadrantCatchMovement(movement) {
  if (movement.id !== 183 && movement.id !== 184) return null;
  return sourceHandGear(movement.id);
}
