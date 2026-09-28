import * as THREE from 'three';
import { makeBeam, matte, PALETTE } from './primitives.js';
import { squareToothOutline } from './square-tooth-outline.js';
import { plate, circle, ring, polygonClipping } from './finite-plate-geometry.js';

// Plate 239 draws square teeth. Their parallel flanks are 0.447 wide.
export const SQUARE_TOOTH_WIDTH_239 = 0.447;
export function spurStopProfile239({ teeth, pitchRadius, rootRadius, outerRadius }) {
  const square = squareToothOutline({ teeth, radius: pitchRadius, addendum: outerRadius - pitchRadius,
    dedendum: pitchRadius - rootRadius, width: SQUARE_TOOTH_WIDTH_239, taper: 0 });
  return { outline: square.points, halfRoot: square.rootAngle, halfTip: square.tipAngle, pitch: 2 * Math.PI / teeth };
}

// A point on tooth k's flank (side -1: the flank at the lower angle, +1:
// higher angle) at radius r, with the wheel turned by w.
export function flankPoint239(g, k, side, r, w) {
  const c = g.gearMountPhase + k * g.toothPitch + w, h = side * SQUARE_TOOTH_WIDTH_239 / 2, y = Math.sqrt(r * r - h * h);
  return new THREE.Vector2(Math.cos(c) * y - Math.sin(c) * h, Math.sin(c) * y + Math.cos(c) * h);
}

const bezier = (a, c, b, n) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n;
  return a.clone().multiplyScalar((1 - t) ** 2).addScaledVector(c, 2 * t * (1 - t)).addScaledVector(b, t * t);
});
const cross = (a, b) => a.x * b.y - a.y * b.x;

// Each stop is one flat plate: a round boss bored for its pin, an arm
// bounded by two smooth edges, and Brown's wedge-shaped nose. The nose's
// working edge lies along the flank it holds (at that stop's limit) and its
// point reaches to just above the root; its back edge rises clear of the
// neighbouring tooth's corner. Coordinates are world (gear centre at the
// origin); the stop never moves.
export function stopDesign239(g, side) {
  const s = g.stops[side], pivot = s.pivot;
  const face = r => flankPoint239(g, s.tooth, s.flank, r, s.limit);
  const nose = face(g.gearRootRadius + s.noseLift), top = face(s.faceTopRadius);
  // Back edge: from the nose past the neighbouring tooth's outer corner (at
  // the far end of the play, where it comes nearest) with a clearance.
  const neighbour = s.tooth + s.flank, corner = flankPoint239(g, neighbour, -s.flank, g.gearOuterRadius, s.otherLimit);
  // The back corner sits just outside it, radially and towards the gap,
  // so the back edge clears the tooth over the whole play and the arm's
  // lower edge runs on just above the tooth tops.
  const radial = corner.clone().normalize(), tangential = new THREE.Vector2(-radial.y, radial.x).multiplyScalar(-s.flank);
  const back = corner.clone().addScaledVector(radial, s.backClearance).addScaledVector(tangential, s.backClearance);
  // Boss tangent points either side of the arm.
  const axis = s.upperControl.clone().sub(pivot).normalize();
  const upperSide = side === 'left' ? 1 : -1;
  const normal = new THREE.Vector2(-axis.y, axis.x).multiplyScalar(upperSide);
  const bossUpper = pivot.clone().addScaledVector(normal, s.bossRadius), bossLower = pivot.clone().addScaledVector(normal, -s.bossRadius);
  const upper = bezier(bossUpper, s.upperControl, top, 24);
  const lower = bezier(back, s.lowerControl, bossLower, 24);
  const a0 = Math.atan2(bossLower.y - pivot.y, bossLower.x - pivot.x), a1 = Math.atan2(bossUpper.y - pivot.y, bossUpper.x - pivot.x);
  // The cap runs round the side away from the arm.
  let sweep = a1 - a0; const outward = -axis.x * Math.cos(a0 + sweep / 2) - axis.y * Math.sin(a0 + sweep / 2);
  if (outward < 0) sweep -= Math.sign(sweep) * 2 * Math.PI;
  const cap = Array.from({ length: 23 }, (_, i) => new THREE.Vector2(pivot.x + s.bossRadius * Math.cos(a0 + sweep * (i + 1) / 24), pivot.y + s.bossRadius * Math.sin(a0 + sweep * (i + 1) / 24)));
  // A short flat across the root end keeps the point blunt.
  const across = new THREE.Vector2(-nose.y, nose.x).normalize().multiplyScalar(s.flank);
  const heel = nose.clone().addScaledVector(across, s.tipWidth);
  let outline = [...upper, nose, heel, ...lower, ...cap];
  let area = 0; outline.forEach((p, i) => { area += cross(p, outline[(i + 1) % outline.length]); });
  if (area < 0) outline = outline.reverse();
  return { outline, upper, lower, nose, heel, top, back, corner, pivot, face: { root: face(g.gearRootRadius), outer: face(g.gearOuterRadius) } };
}

export function finishOpposedSpur239(model) {
  const { root } = model, d = root.userData, b = d.blocks, g = d.geometry;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const designs = {};
  for (const side of ['left', 'right']) {
    const stop = b[`${side}Stop`], body = stop.userData.body, design = stopDesign239(g, side);
    designs[side] = design;
    const local = design.outline.map(p => [p.x - design.pivot.x, p.y - design.pivot.y]);
    replace(body, plate(polygonClipping.difference([[[...local, local[0]]]], [[[...circle([0, 0], 0.08, 96), [0.08, 0]]]]), -0.15, 0.15));
    replace(stop.userData.hub, ring(0.08, 0.2, -0.2, 0.2, 96));
    stop.userData.hub.rotation.set(0, 0, 0);
    stop.userData.hub.material = body.material;
  }
  // The hub's rear face stops just in front of the fixed output journal
  // (z -0.43 to -0.23).
  replace(b.gearHub, ring(0.108, 0.46, -0.225, g.gearDepth * 0.71, 96));
  b.gearHub.rotation.set(0, 0, 0);
  // The fixed shafts terminate in bored journals attached to the rear rail.
  const journals = [], posts = [];
  const frameMaterial = matte(PALETTE.frame);
  for (const [name, pivot, boreRadius, outerRadius] of [
    ['left', g.leftPivot, 0.078, 0.20], ['right', g.rightPivot, 0.078, 0.20],
    ['output', new THREE.Vector2(), 0.108, 0.24],
  ]) {
    const journal = new THREE.Mesh(ring(boreRadius, outerRadius, -0.43, -0.23, 96), frameMaterial);
    journal.position.set(pivot.x, pivot.y, 0); journal.userData.role = `${name}-bored-fixed-journal`;
    const post = makeBeam(new THREE.Vector3(pivot.x, -3.35, -0.32), new THREE.Vector3(pivot.x, pivot.y - outerRadius + 0.03, -0.32), {color: PALETTE.frame, depth: 0.18, thickness: 0.14});
    post.userData.role = `${name}-journal-support-post`; root.add(journal, post); journals.push(journal); posts.push(post);
  }
  b.bearingPost.visible = false;
  // p93: Brown draws only the stops' eye holes. Drop their undrawn journals
  // and posts, and trim each fixed pivot to the boss's thickness (0.01 proud
  // each side); the pivots are fixed points with no drawn frame.
  for (const [i, side] of ['left', 'right'].entries()) {
    journals[i].visible = false; posts[i].visible = false;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || o.geometry.type !== 'CylinderGeometry') return;
      let r = o; while (r && !r.userData.role) r = r.parent;
      if (r?.userData.role !== `${side}-fixed-stop-pivot-shaft`) return;
      const box = new THREE.Box3().setFromObject(o), p = o.geometry.parameters;
      const low = -0.01, high = 0.41, axisZ = new THREE.Vector3(0, 1, 0).transformDirection(o.matrixWorld).z;
      const shift = ((low + high) / 2 - (box.min.z + box.max.z) / 2) / axisZ;
      replace(o, new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, high - low, p.radialSegments).translate(0, shift, 0));
    });
  }
  d.workingParts239 = { designs, journals, posts };
  // The plate breaks the wheel off just below its hub; that is Brown's
  // drawing convention, so the wheel is modelled whole. The camera fits the
  // plate's crop, so the whole wheel runs off the view just below the hub.
  d.sweptBounds = new THREE.Box3(new THREE.Vector3(-3.7, -3.55, -0.68), new THREE.Vector3(5, 3.25, 0.65));
  d.cameraFitBounds.set(new THREE.Vector3(-3.7, -1.05, -0.68), new THREE.Vector3(5, 3.25, 0.65));
  d.minimumDisplayCycleSeconds = 6;
  d.hideGround = true;
  d.reconstructionNote = 'Two flat stops, each a boss, a smooth arm and Brown\'s wedge nose, hold the wheel within a small play: the left nose bears on a tooth\'s left flank (stopping counter-clockwise turning), the right on a tooth\'s right flank (stopping clockwise). The alternating test torque and seated stops are prescribed; gravity seating, hinge reactions, friction and holding strength are not dynamically solved.';
  d.sourceAnimation.reason = 'The official page marks Animated unavailable and registers no inline animation.';
  root.traverse(o => { if(o.isMesh) {o.castShadow = true; o.receiveShadow = true;} for(const material of [].concat(o.material ?? [])) material.fog = false; });
  model.cameraDirection = new THREE.Vector3(0.4, 0.3, 15);
  model.update(0);
  return model;
}
