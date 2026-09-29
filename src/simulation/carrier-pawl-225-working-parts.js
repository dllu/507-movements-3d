import * as THREE from 'three';
import { groundBlock } from './ground-block.js';
import { circle, plate, ring } from './finite-plate-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import { nearest390Outline } from './dual-band-pawl-contact.js';
import { matte, PALETTE } from './primitives.js';
import { carrierPawl225Return } from './baked/carrier-pawl-225-return.js';

// The rising edge is the positive-torque face. The long trailing edge used
// by clockwise mechanisms (such as 284) would drive the opposite direction.
// With `backClearance` the nose is seated in the root instead: as far down
// the flank as it goes while staying that far clear of the previous tooth's
// long back, which comes down into the root from `backTipPhase` pitches.
export function carrierPawlFlank225({ outerRadius, rootRadius, pitch, noseRadius, flankFraction = 0.58, backClearance = null, backTipPhase = -0.75, faceTipPhase = 0.16 }) {
  const root = new THREE.Vector2(rootRadius, 0);
  const tip = new THREE.Vector2(outerRadius * Math.cos(faceTipPhase * pitch), outerRadius * Math.sin(faceTipPhase * pitch));
  const edge = tip.clone().sub(root), normal = new THREE.Vector2(edge.y, -edge.x).normalize();
  const clearance = 0.0002;
  const centerAt = (fraction) => root.clone().lerp(tip, fraction).addScaledVector(normal, noseRadius + clearance);
  if (backClearance !== null) {
    const backTip = new THREE.Vector2(outerRadius * Math.cos(backTipPhase * pitch), outerRadius * Math.sin(backTipPhase * pitch));
    const back = backTip.clone().sub(root);
    const backGap = (fraction) => {
      const center = centerAt(fraction);
      const along = THREE.MathUtils.clamp(center.clone().sub(root).dot(back) / back.lengthSq(), 0, 1);
      return center.distanceTo(root.clone().addScaledVector(back, along)) - noseRadius;
    };
    let low = 0, high = 1;
    for (let step = 0; step < 60; step += 1) {
      const middle = (low + high) / 2;
      if (backGap(middle) >= backClearance) high = middle; else low = middle;
    }
    flankFraction = high;
  }
  const point = root.clone().lerp(tip, flankFraction);
  const center = centerAt(flankFraction);
  return { root, tip, point, normal, center, radius: center.length(), angle: Math.atan2(center.y, center.x), clearance, flankFraction };
}
// The tracked return table baked by scripts/generate-carrier-pawl-225-return.mjs,
// or null if it was baked for other geometry.
export function bakedReturnTable225(key) {
  return carrierPawl225Return.key === key ? Float64Array.from(carrierPawl225Return.angles) : null;
}
export function carrierPawlOutlineDistance225(point, outline) {
  return nearest390Outline(point, outline).distance;
}
export function carrierPawlClearance225(center, wheelAngle, outline, noseRadius) {
  const c = Math.cos(wheelAngle), s = Math.sin(wheelAngle);
  return nearest390Outline([c * center.x + s * center.y, -s * center.x + c * center.y], outline).distance - noseRadius;
}

// Signed clearance between the whole flat pawl outline (local to its hinge)
// and the wheel outline. The pawl shares the wheel's plane; its arched bar is
// shaped so that only the nose touches the teeth, which tests verify.
export function carrierPawlBarClearance225(pivot, angle, wheelAngle, barOutline, wheelOutline) {
  const ca = Math.cos(angle), sa = Math.sin(angle), cw = Math.cos(wheelAngle), sw = Math.sin(wheelAngle);
  let clearance = Infinity;
  for (const [x, y] of barOutline) {
    const wx = pivot.x + ca * x - sa * y, wy = pivot.y + sa * x + ca * y;
    if (wx * wx + wy * wy > 3.2) continue;
    clearance = Math.min(clearance, nearest390Outline([cw * wx + sw * wy, -sw * wx + cw * wy], wheelOutline).distance);
  }
  for (const [x, y] of wheelOutline) {
    const wx = cw * x - sw * y - pivot.x, wy = sw * x + cw * y - pivot.y;
    clearance = Math.min(clearance, nearest390Outline([ca * wx + sa * wy, -sa * wx + ca * wy], barOutline).distance);
  }
  return clearance;
}

// Largest pawl angle (the lift direction lowers it) at which the wheel-side
// edge of the bar, given as hinge-local points ordered away from the hinge,
// keeps at least `margin` from every point of the densified wheel outline.
const denseWheel225 = new WeakMap();
export function carrierPawlBarLiftLimit225(pivot, baseAngle, wheelAngle, edge, wheelOutline, margin) {
  let dense = denseWheel225.get(wheelOutline);
  if (!dense) {
    dense = [];
    for (let i = 0; i < wheelOutline.length; i++) {
      const [ax, ay] = wheelOutline[i], [bx, by] = wheelOutline[(i + 1) % wheelOutline.length];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.006));
      for (let k = 0; k < n; k++) dense.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
    }
    denseWheel225.set(wheelOutline, dense);
  }
  const radii = edge.map(([x, y]) => Math.hypot(x, y)), polar = edge.map(([x, y]) => Math.atan2(y, x));
  const cw = Math.cos(wheelAngle), sw = Math.sin(wheelAngle);
  let limit = Infinity;
  for (const [x, y] of dense) {
    const px = cw * x - sw * y - pivot.x, py = sw * x + cw * y - pivot.y, rho = Math.hypot(px, py);
    if (rho < radii[0] || rho > radii.at(-1)) continue;
    let j = 1;
    while (radii[j] < rho) j += 1;
    const t = (rho - radii[j - 1]) / (radii[j] - radii[j - 1]), psi = polar[j - 1] + (polar[j] - polar[j - 1]) * t;
    const local = Math.atan2(py, px) - baseAngle, wrapped = Math.atan2(Math.sin(local), Math.cos(local));
    if (Math.abs(wrapped - psi) > 0.35) continue;
    limit = Math.min(limit, baseAngle + wrapped - psi - margin / rho);
  }
  return limit;
}

export const PAWL_SAGITTA_225 = 0.12;
export const PAWL_END_RELIEF_225 = THREE.MathUtils.degToRad(14);
export const PAWL_END_HALF_WIDTH_225 = 0.1;

export function installCarrierPawl225(root) {
  const { blocks: b, geometry: g } = root.userData;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const material = b.pawlBody.material, dark = matte(PALETTE.ink, { metalness: 0.22, roughness: 0.48 });
  // Brown's pawl is a plain, slightly curved bar tapering from a broad hinge
  // end to its nose. Its centre line is one circular arc (sagitta 0.12 over
  // the length, as drawn), with no hook turned down into the tooth space. The end is a
  // straight cut lying along the driven tooth's steep face, as drawn, with
  // the working nose radius only at its wheel-side corner; the cut stands a
  // few degrees back from the face (PAWL_END_RELIEF) so the pawl's turn
  // against the wheel through the drive never brings it into the face.
  const sagitta = PAWL_SAGITTA_225;
  const arcRadius = (g.pawlLength ** 2 / 4 + sagitta ** 2) / (2 * sagitta);
  const halfAngle = Math.asin(g.pawlLength / 2 / arcRadius);
  const handle = 4 / 3 * arcRadius * Math.tan(halfAngle / 2);
  // The arch bows away from the wheel (-y in the pawl's frame; the wheel
  // lies on its +y side), so the bar passes over the tooth behind the nose.
  const control = [[0, 0], [handle * Math.cos(halfAngle), -handle * Math.sin(halfAngle)],
    [g.pawlLength - handle * Math.cos(halfAngle), -handle * Math.sin(halfAngle)], [g.pawlLength, 0]];
  const bezier = (t) => [0, 1].map((k) => (1 - t) ** 3 * control[0][k] + 3 * (1 - t) ** 2 * t * control[1][k]
    + 3 * (1 - t) * t ** 2 * control[2][k] + t ** 3 * control[3][k]);
  const tangentAt = (t) => {
    const d = [0, 1].map((k) => 3 * (1 - t) ** 2 * (control[1][k] - control[0][k]) + 6 * (1 - t) * t * (control[2][k] - control[1][k])
      + 3 * t ** 2 * (control[3][k] - control[2][k]));
    const l = Math.hypot(...d);
    return [d[0] / l, d[1] / l];
  };
  // The driven face's normal at mid-drive, in the pawl's frame (it points
  // from the face into the nose).
  const faceNormal = (() => {
    const state = root.userData.stateAtCycleCoordinate(0.25), a = -state.pawlAngle;
    const n = state.contactNormal;
    return [Math.cos(a) * n.x - Math.sin(a) * n.y, Math.sin(a) * n.x + Math.cos(a) * n.y];
  })();
  // A single ordered perimeter avoids unions between tangent capsule arcs,
  // which can fail ring reconstruction under browser floating-point arithmetic.
  const count = 64, parameters = Array.from({ length: count + 1 }, (_, i) => i / count);
  const points = parameters.map(bezier), tangents = parameters.map(tangentAt);
  // Brown's bar thickens steadily toward the hinge (about 0.33 there); the
  // wheel-side half stays slim near the nose, so most of the taper is on the
  // outer edge, which leaves room for the broad straight end cut.
  const noseRadius = g.pawlNoseRadius, hingeHalfWidth = 0.165;
  const taper = (t, power, end) => end + (hingeHalfWidth - end) * Math.max(0, 1 - t) ** power;
  const offset = (i, width) => [points[i][0] - tangents[i][1] * width, points[i][1] + tangents[i][0] * width];
  const wheelEdge = parameters.map((t, i) => offset(i, taper(t, 1.2, noseRadius)));
  const outerEdge = parameters.map((t, i) => offset(i, -taper(t, 0.8, PAWL_END_HALF_WIDTH_225)));
  // The cut: tangent to the nose circle, turned back from the face by the
  // relief, running out to the outer edge.
  const relief = PAWL_END_RELIEF_225;
  const nose = [g.pawlLength, 0];
  // Along the face, heading out to the bar's outer edge...
  let cut = [-faceNormal[1], faceNormal[0]];
  if (cut[0] * (outerEdge[count][0] - nose[0]) + cut[1] * (outerEdge[count][1] - nose[1]) < 0) cut = [-cut[0], -cut[1]];
  // ...leaning back from the face into the pawl by the relief.
  cut = [cut[0] + Math.tan(relief) * faceNormal[0], cut[1] + Math.tan(relief) * faceNormal[1]];
  const cutLength = Math.hypot(...cut);
  cut = [cut[0] / cutLength, cut[1] / cutLength];
  let touch = [-cut[1], cut[0]];
  if (touch[0] * faceNormal[0] + touch[1] * faceNormal[1] > 0) touch = [-touch[0], -touch[1]];
  const start = [nose[0] + noseRadius * touch[0], nose[1] + noseRadius * touch[1]];
  // Where the cut meets the outer edge (extended past the nose if needed).
  let hit = null, hitIndex = count;
  for (let i = count; i > 0 && !hit; i--) {
    const a = outerEdge[i], b = outerEdge[i - 1], e = [b[0] - a[0], b[1] - a[1]];
    const den = cut[0] * e[1] - cut[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const w = [a[0] - start[0], a[1] - start[1]];
    const t = (w[0] * e[1] - w[1] * e[0]) / den, u = (w[0] * cut[1] - w[1] * cut[0]) / den;
    if (t > 0 && (u >= 0 || i === count) && u <= 1) {
      hit = [start[0] + t * cut[0], start[1] + t * cut[1]];
      hitIndex = u < 0 ? count : i - 1;
    }
  }
  if (!hit) throw new Error('225 pawl end cut does not meet the outer edge');
  const outline = [...wheelEdge];
  const wheelSideAngle = Math.atan2(wheelEdge[count][1] - nose[1], wheelEdge[count][0] - nose[0]);
  // Round the corner past the nose's tip (both ends straddle the bar's axis).
  const touchAngle = Math.atan2(touch[1], touch[0]);
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const angle = wheelSideAngle + (touchAngle - wheelSideAngle) * i / steps;
    outline.push([nose[0] + noseRadius * Math.cos(angle), nose[1] + noseRadius * Math.sin(angle)]);
  }
  outline.push(hit);
  for (let i = hitIndex; i >= 0; i--) outline.push(outerEdge[i]);
  const startAngle = Math.atan2(tangents[0][1], tangents[0][0]);
  for (let i = 1; i < 32; i++) {
    const angle = startAngle - Math.PI / 2 - Math.PI * i / 32;
    outline.push([hingeHalfWidth * Math.cos(angle), hingeHalfWidth * Math.sin(angle)]);
  }
  g.pawlEndCut = { start, hit, direction: cut, relief };
  g.pawlWheelEdge = wheelEdge.filter(([x, y]) => Math.hypot(x, y) > 0.3);
  replace(b.pawlBody, plate([[outline, circle([0, 0], 0.074, 64)]], -0.065, 0.065));
  g.pawlOutline = outline;
  g.pawlCenterLine = points;
  g.pawlBarSagitta = sagitta;
  g.pawlBarArcRadius = arcRadius;
  b.pawlIndex.position.y = -0.12;
  b.pawlIndex.position.z = 0.08;
  for (const child of [...b.carrier.children]) { child.geometry?.dispose(); b.carrier.remove(child); }
  // p104: flush against the orange pawl, the carrier takes the ochre accent
  // so the two parts do not merge into one.
  const carrier = new THREE.Mesh(boredPlanarLinkGeometry({ length: g.carrierLength, width: 0.17, eyeRadius: 0.14, boreRadius: 0.074, depth: 0.14 }), matte(PALETTE.accent, { metalness: 0.1, roughness: 0.62 }));
  carrier.userData.role = 'bored-vibrating-carrier';
  const startCenter = new THREE.Object3D(), endCenter = new THREE.Object3D();
  b.carrier.add(carrier, startCenter, endCenter);
  b.carrier.userData.setEndpoints = (start, end) => {
    // p104: the carrier's eyes sit 0.005 in front of the pawl's eye (front
    // 0.295), as Brown draws them flush, not 0.1 off on a bare pin.
    carrier.position.set(start.x, start.y, 0.37);
    carrier.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
    startCenter.position.set(start.x, start.y, 0.37);
    endCenter.position.set(end.x, end.y, 0.37);
  };
  // Hinge and floor pins end 0.03 past the parts they join.
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.335, 64), dark);
  hinge.rotation.x = Math.PI / 2; hinge.userData.role = 'actual-carrier-pawl-hinge-shaft'; root.add(hinge);
  const floorPin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.62, 64), dark);
  floorPin.rotation.x = Math.PI / 2; floorPin.position.set(g.carrierPivot.x, g.carrierPivot.y, 0.16);
  floorPin.userData.role = 'actual-fixed-carrier-floor-shaft'; root.add(floorPin);
  // Brown's bell-shaped lug: a rounded head about the floor pin flaring down
  // in concave sides to a broad foot on the hatched ground, which is modelled
  // as a plain ground block (its top 0.314 below the pin, as drawn).
  const groundDrop = 0.314, head = 0.2, foot = 0.42, flare = -0.55;
  const bearing = [];
  for (let i = 0; i <= 48; i++) { const angle = flare + (Math.PI - 2 * flare) * i / 48; bearing.push([head * Math.cos(angle), head * Math.sin(angle)]); }
  const [lx, ly] = bearing.at(-1);
  for (let i = 1; i <= 16; i++) { const t = i / 16, u = t * t; bearing.push([lx + (-foot - lx) * u, ly + (-groundDrop - ly) * t]); }
  const [rx, ry] = bearing[0];
  for (let i = 0; i <= 15; i++) { const t = 1 - i / 16, u = t * t; bearing.push([rx + (foot - rx) * u, ry + (-groundDrop - ry) * t]); }
  // p104: the lug runs forward to 0.005 behind the carrier's lower eye.
  replace(b.bottomBearing, plate([[bearing.reverse(), circle([0, 0], 0.074, 64)]], -0.12, 0.295));
  b.bottomBearing.position.z = 0;
  b.bottomBearing.material = matte(PALETTE.frame);
  // Kept inside the framed view (right edge x 2.85, bottom y -2.65).
  const groundLeft = g.carrierPivot.x - 0.9, groundRight = 2.84;
  const ground = groundBlock(groundRight - groundLeft, 0.22, 0.8, { name: 'hatched-ground-under-carrier-lug' });
  // p101: the shared ground block's darker side faces are kept (the top-face
  // material on every face read as a pale slab).
  ground.position.set((groundLeft + groundRight) / 2, g.carrierPivot.y - groundDrop - 0.11, 0.05);
  root.add(ground);
  replace(b.ratchet.userData.hub, ring(0.108, 0.32, -0.1988, 0.1988, 96));
  const index = b.ratchet.userData.indicator;
  replace(index, new THREE.BoxGeometry(0.04, 0.65, 0.012));
  index.position.set(0, 0.9, g.ratchetDepth / 2 + 0.006);
  const journal = new THREE.Mesh(ring(0.108, 0.24, g.pawlPlaneZ - 0.44, g.pawlPlaneZ - 0.24, 96), matte(PALETTE.frame));
  journal.userData.role = 'bored-fixed-output-shaft-journal'; root.add(journal);
  root.userData.workingParts225 = { carrier, hinge, floorPin, journal };
  root.userData.updateWorkingParts225 = state => hinge.position.set(state.pawlPivot.x, state.pawlPivot.y, 0.3025);
  root.userData.minimumDisplayCycleSeconds = g.cyclePeriod;
  root.userData.hideGround = true;
  root.userData.reconstructionNote = 'The separately hinged pawl, a shallow arched bar as drawn, drives from its nose seated in the root. The carrier swings about 2 degrees right of plumb and the pawl is 2.3 long (Brown draws 2.6), so the bar clears the tooth behind the nose. On the return the pawl is tracked on the wheel outline (baked table): it slides up the tooth back, falls under a prescribed bias off the crest, and the carrier runs 1.5 degrees past the drive start so the nose passes the next tip; the drive stroke then begins with the wheel standing while the nose slides down into its root. The wheel is held during return; gravity or spring bias, holding friction, impact and load capacity are not dynamically solved. No animation is registered on the official page.';
  root.traverse(o => { for (const material of [].concat(o.material ?? [])) material.fog = false; });
}
