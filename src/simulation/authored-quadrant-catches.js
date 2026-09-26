import * as THREE from 'three';
import { plate, ring, polygonClipping } from './finite-plate-geometry.js';
import {
  PL, PU, circlePoints, deg, pinRadius, quadrantCatchParts, sourceScale, strokeSource,
  tappetSource,
} from './quadrant-catch-finite-parts.js';
import { quadrantCatchMotion } from './baked/quadrant-catch-motion.js';
import { PALETTE, markShadows, matte } from './primitives.js';
import { glandCylinder } from './beyond-crop-hardware.js';
import { backBar, footPillar, pinBoss, slideSleeve, supportMaterial } from './back-plate-support.js';

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
  X: [-0.14, -0.06],
  A: [-0.04, 0.04],
  M: [0.06, 0.12],
  N: [0.14, 0.20],
  Y: [0.22, 0.34],
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
const rodTop183 = 38;
const rodBottom183 = 500;

function interpolateRow(phase) {
  const { rows, samples } = quadrantCatchMotion;
  const x = (((phase % 1) + 1) % 1) * samples, i = Math.min(Math.floor(x), samples - 1), f = x - i;
  const a = rows[i], b = rows[i + 1];
  return a.map((v, k) => v + (b[k] - v) * f);
}

// Plate 184 hangs both back-weight rods down from Brown's pins at mid height:
// the ball-lever handle carries a slender arm down-right from its (upper)
// hub to a pin clear of the wing, and the wing handle a hidden arm up-left
// from its hub to a pin behind the piston rod (dashed on the plate); the
// wing's tip carries no eye. In the unreflected frame these are 183's arms
// turned about half a turn with the pull reversed, so each weight still
// turns its handle the same way over the whole solved swing (the lever arm
// never changes sign). Pin positions are plate-184 pixels relative to each
// hub, reflected into this frame. Both arms lie in the rear layer W, which
// holds nothing else of the other handle, so the solve is unchanged.
function restoreBrown184Weights(upper, lower) {
  const arm = (pivot, eye) => polygonClipping.union(
    taperedBar(pivot, eye, 8, 5), circlePoly(eye, 10.5, 48), circlePoly(pivot, 30, 64));
  const upperEye = [PU[0] - 103, PU[1] + 85], lowerEye = [PL[0] + 97, PL[1] - 107];
  // The wing is trimmed to its concentric rim and squared off radially at
  // its tip, which drops 183's eye tab and neck.
  const tipCut = [[[PU, ...[-100, -70, -44.5].map((a) => [PU[0] + 220 * Math.cos(a * deg), PU[1] + 220 * Math.sin(a * deg)]), PU]]];
  upper.parts.quadrant = { ...upper.parts.quadrant, poly: polygonClipping.difference(
    polygonClipping.intersection(upper.parts.quadrant.poly, circlePoly(PU, 137.5, 192)), tipCut) };
  upper.parts.hub = { ...upper.parts.hub, planes: 'W' + upper.parts.hub.planes };
  upper.parts.weightArm = { planes: 'W', poly: arm(PU, upperEye) };
  upper.eye = upperEye;
  lower.parts.weightArm = { planes: 'W', poly: arm(PL, lowerEye) };
  lower.eye = lowerEye;
}

function taperedBar(a, b, w0, w1) {
  const d = [b[0] - a[0], b[1] - a[1]], n = Math.hypot(...d), u = [-d[1] / n, d[0] / n];
  return [[[[a[0] + u[0] * w0, a[1] + u[1] * w0], [b[0] + u[0] * w1, b[1] + u[1] * w1],
    [b[0] - u[0] * w1, b[1] - u[1] * w1], [a[0] - u[0] * w0, a[1] - u[1] * w0], [a[0] + u[0] * w0, a[1] + u[1] * w0]]]];
}

function sourceHandGear(movementId) {
  const root = new THREE.Group();
  const is184 = movementId === 184;
  const { upper, lower } = quadrantCatchParts();
  if (is184) restoreBrown184Weights(upper, lower);
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
      if (eye && partName === (name === 'upper' && !is184 ? 'quadrant' : 'weightArm')) {
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

  // Piston rod: a source-width section carrying the projecting tappet, so it
  // moves with the tappet. Plate 184 runs the rod from 30 to 490 px (its top
  // and bottom breaks), which is 416 to -44 in this unreflected frame.
  // Brown's breaks are a drawing convention: the rod is modelled whole, built
  // below once the framing is known, running from a guide above the view down
  // into the steam cylinder below it.
  const [rodBottomY, rodTopY] = is184 ? [416, -44] : [rodBottom183, rodTop183];
  const rodX0 = 155, rodX1 = 190;
  const plateRodCorners = [[rodX0, rodBottomY], [rodX1, rodTopY]].map(toModel);
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
  // View-frame sign: 184 is shown reflected top to bottom.
  const sgn = is184 ? -1 : 1;

  // Back-weight rods hang from the eyes and run on past the plate edge.
  const weightRods = {};
  for (const [name, body] of [['upper', upper], ['lower', lower]]) {
    const group = new THREE.Group();
    group.userData.role = `${name}-back-weight-rod-hanging-from-eye`;
    const rod = new THREE.Mesh(new THREE.BoxGeometry(8 * sourceScale, 1, layers.rods[1] - layers.rods[0]), materials.pin);
    rod.position.z = (layers.rods[0] + layers.rods[1]) / 2;
    rod.userData.role = `${name}-back-weight-rod`;
    rod.userData.runsPastCrop = true;
    const eyeZ = span(name === 'upper' && !is184 ? 'X' : 'W');
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(eyePin * sourceScale, eyePin * sourceScale, eyeZ[1] - layers.rods[1], 32), materials.pin);
    pin.rotation.x = Math.PI / 2;
    pin.position.z = (eyeZ[1] + layers.rods[1]) / 2;
    pin.userData.role = `${name}-back-weight-rod-eye-pin`;
    // Brown draws no weight: the rod runs straight out of the picture and
    // ends cleanly below the view in every pose (the back-weight load is an
    // implied, undrawn limit).
    group.add(rod, pin);
    root.add(group);
    weightRods[name] = { group, rod, pin, eye: body.eye, pivot: body.pivot, length: 1 };
    blocks[`${name}WeightRod`] = rod;
    blocks[`${name}WeightPin`] = pin;
  }

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
      upperLatchedByLowerQuadrant: upperAngle < 2,
      lowerLatchedByUpperQuadrant: lowerAngle > 50 && upperAngle > 34,
    };
  };
  const update = (time) => {
    const s = stateAtTime(time);
    upperHandle.rotation.z = -s.upperAngle * deg;
    lowerHandle.rotation.z = -s.lowerAngle * deg;
    pistonGroup.position.y = (origin[1] - s.tappetTop) * sourceScale;
    for (const [name, w] of Object.entries(weightRods)) {
      const e = eyeAt(w, name === 'upper' ? s.upperAngle : s.lowerAngle), m = toModel(e);
      // 183's rods hang down the page; 184's run the other way in the
      // unreflected frame, so they hang down in the reflected view. Each rod
      // has a fixed length and rises and falls with the eye.
      const length = w.length;
      w.group.position.set(m[0], m[1], 0);
      w.rod.scale.y = length;
      w.rod.position.y = -sgn * length / 2;
    }
    root.userData.kinematics = s;
  };

  root.userData.blocks = { ...blocks, upperHandle, lowerHandle, pistonGroup, tappet };
  root.userData.geometry = { layers, origin, sourceScale, cyclePeriod: period, initialPhase, boreRadius, shaftRadius, pinRadius, eyeHole, eyePin };
  root.userData.stateAtTime = stateAtTime;
  root.userData.archetype = is184
    ? 'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-184'
    : 'double-backweighted-valve-handles-mutually-latching-quadrants-piston-tappet-position-183';
  root.userData.mechanism = is184
    ? 'top-position-descending-piston-tappet-trips-upper-quadrant-handle-releases-lower-backweighted-quadrant-handle-and-restores-four-valves'
    : 'ascending-piston-tappet-trips-lower-quadrant-handle-releases-upper-backweighted-quadrant-handle-and-reverses-four-valves';
  root.userData.fidelity = 'authored';
  root.userData.variant = is184 ? 'source-184-reflected-top-of-cylinder-initial-pose' : 'source-183-ascending-stroke-initial-pose';
  root.userData.reconstructionNote = 'Handle motion is a quasistatic solve: the tappet pushes, the back weights are represented by each handle moving toward its weighted side until a contact or its undrawn valve stop, and concentric quadrant rims hold studs on the opposite handle. Forces, friction and impact are not simulated. 184 is the 183 gear reflected top to bottom, as plate 184 is plate 183 flipped; in that view the tappet stands at the top and descends onto the upper handle. Its back-weight rods hang down from Brown\'s mid-height pins on slender arms (183\'s arms turned half a turn with the pull reversed, so each weight still turns its handle the same way).';
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 12;
  root.userData.cameraDirection = new THREE.Vector3(0, 0, 18);
  root.userData.cameraFov = 8;
  root.userData.cameraDistanceScale = 0.9;
  root.traverse((o) => { for (const m of [].concat(o.material ?? [])) m.fog = false; });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  // The hidden catch features sit within drawn outlines; they cast no shadow
  // onto the plates they hide behind or in front of.
  for (const key of ['upperCatchBoss', 'upperStud', 'lowerStud', 'lowerLip']) blocks[key].castShadow = false;
  // Plate 184 is plate 183 drawn upside down: the ball lever and hook on
  // the upper shaft, the pointed-window wing hanging from the lower one,
  // and the tappet up by the upper shaft. Flipping plate 183 top to bottom
  // lays its parts over 184's, while no pose of the upright gear does
  // (184 would need both handles about 80 degrees further and the ball lever
  // and hook exchanged). So 184 shows the same gear reflected top to bottom
  // at 183's pose: the tappet is then at the top of its stroke in the view
  // and descends onto the upper (ball) handle, as Brown's caption for 182
  // and 184 describes. The reflection is a presentation transform; every
  // relative motion and contact is the 183 solve.
  if (is184) {
    const mirror = new THREE.Group();
    mirror.userData.role = 'plate-184-top-to-bottom-reflection';
    for (const child of [...root.children]) mirror.add(child);
    mirror.scale.y = -1;
    root.add(mirror);
    root.userData.blocks.plate184Reflection = mirror;
  }
  // Brown draws only the handles, shafts, tappet and rods. The rods run
  // on to real ends past the view: each back-weight rod to its weight, the
  // piston rod up through a guide and down into the steam cylinder. Both
  // shafts are carried in bosses on one plain back bar (behind the rear
  // weight-rod layer) that stands on the engine floor beside the cylinder
  // and carries the piston-rod guide on an arm above the view. Everything
  // here is in the (reflected) view frame, below and above Brown's crop.
  function addWorkingSupports() {
    const view = (unreflectedY) => sgn * unreflectedY;
    const tappetView = [], eyeView = { upper: [], lower: [] };
    for (let i = 0; i <= 144; i++) {
      const s = stateAtTime(period * i / 144);
      tappetView.push(view((origin[1] - s.tappetTop) * sourceScale));
      for (const [name, w] of Object.entries(weightRods)) {
        eyeView[name].push(view(toModel(eyeAt(w, name === 'upper' ? s.upperAngle : s.lowerAngle))[1]));
      }
    }
    const fit = root.userData.cameraFitBounds;
    // Weight rods end below the view in every pose, even when the eye is
    // at its highest.
    for (const [name, w] of Object.entries(weightRods)) w.length = Math.max(...eyeView[name]) - (fit.min.y - 0.35);
    const lowestWeight = Math.min(...Object.entries(weightRods).map(([name, w]) =>
      Math.min(...eyeView[name]) - w.length));
    const tvMin = Math.min(...tappetView), tvMax = Math.max(...tappetView);
    const guideY = fit.max.y + 0.7, glandY = lowestWeight - 0.35, floorY = glandY - (tvMax - tvMin) - 1.4;
    const above = guideY + 0.35 - tvMin, below = tvMax - (glandY - 0.45);
    const rodLocal = [sgn * above, -sgn * below];
    const rodOutline = [[rodX0, 0], [rodX1, 0]].map((p) => toModel(p)[0]);
    const rodGeometry = plate([[[[rodOutline[0], rodLocal[1]], [rodOutline[1], rodLocal[1]],
      [rodOutline[1], rodLocal[0]], [rodOutline[0], rodLocal[0]], [rodOutline[0], rodLocal[1]]]]], ...layers.R);
    const pistonRod = new THREE.Mesh(rodGeometry, materials.piston);
    pistonRod.userData.role = 'source-width-sectioned-piston-rod';
    pistonRod.userData.runsPastCrop = true;
    pistonGroup.add(pistonRod);
    root.userData.blocks.pistonRod = pistonRod;

    const mat = supportMaterial(), zFront = layers.rods[0] - 0.06, rodX = (rodOutline[0] + rodOutline[1]) / 2;
    mat.fog = false;
    const rodZ = (layers.R[0] + layers.R[1]) / 2, rodWidth = rodOutline[1] - rodOutline[0];
    const shafts = [blocks.upperShaft, blocks.lowerShaft].map((o) => o.getWorldPosition(new THREE.Vector3()));
    const barX = (shafts[0].x + shafts[1].x) / 2;
    const support = new THREE.Group();
    support.userData.role = 'fixed-back-bar-carrying-handle-shafts-rod-guide-and-cylinder';
    support.add(
      backBar([new THREE.Vector2(rodX, guideY), new THREE.Vector2(barX, guideY), new THREE.Vector2(barX, floorY + 0.1)],
        { zFront, width: 0.36, material: mat, role: 'fixed-back-bar-behind-handle-shafts' }),
      ...shafts.map((p) => pinBoss({ x: p.x, y: p.y, radius: 0.27, zBack: zFront, zFront: -0.56, material: mat, role: 'fixed-handle-shaft-boss' })),
      slideSleeve({ center: new THREE.Vector3(rodX, guideY, rodZ), axis: 'y', length: 0.4, innerWidth: rodWidth + 0.03,
        innerDepth: layers.R[1] - layers.R[0] + 0.03, zWall: zFront, material: mat, role: 'fixed-piston-rod-guide' }),
      glandCylinder({ x: rodX, topY: glandY, z: rodZ, length: glandY - floorY, glandRadius: 0.27, boreRadius: 0.5,
        outerRadius: 0.62, material: mat, role: 'fixed-steam-cylinder-below-view' }),
      footPillar({ x: barX, yTop: floorY + 0.1, yFloor: floorY, z: zFront - 0.05, width: 0.36, footWidth: 1.2, material: mat,
        role: 'fixed-back-bar-foot' }),
    );
    support.traverse((o) => { o.userData.runsPastCrop = true; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    root.add(support);
    root.userData.blocks.workingSupport = support;
  }
  const box = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i <= 72; i++) {
    update(period * i / 72); root.updateMatrixWorld(true);
    root.traverseVisible((o) => {
      const a = o.geometry?.attributes.position;
      if (a && !o.userData.runsPastCrop) for (let j = 0; j < a.count; j++) box.expandByPoint(point.fromBufferAttribute(a, j).applyMatrix4(o.matrixWorld));
    });
  }
  // Frame Brown's plate: the rods count only as far as his breaks.
  const viewFrame = root.userData.blocks.plate184Reflection ?? root;
  for (const [x, y] of plateRodCorners) box.expandByPoint(point.set(x, y, 0).applyMatrix4(viewFrame.matrixWorld));
  root.userData.cameraFitBounds = box.expandByScalar(0.1);
  addWorkingSupports();
  update(0);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredQuadrantCatchMovement(movement) {
  if (movement.id !== 183 && movement.id !== 184) return null;
  return sourceHandGear(movement.id);
}
