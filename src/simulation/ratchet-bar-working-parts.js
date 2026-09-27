import * as THREE from 'three';
import { PALETTE, matte } from './primitives.js';
import { capsule, circle, plate, poly, polygonClipping, ring } from './finite-plate-geometry.js';

// Each pawl is one flat plate in the rack's plane: a round boss bored for its
// lever pin, a straight bar of constant width, a circular elbow and a short
// finger dropping into the teeth, as Brown draws the two hooks. The finger's
// working (left) face lies along the vertical tooth face and its underside
// along the return ramp, meeting in a small rounded nose that seats in the
// root. The outline is laid out at the pawl's steepest working angle, so over
// the rest of the stroke the face leans off the tooth; the underside is
// relieved by the pawl's working swing so it never digs into the ramp.
export function makeSteppedRatchetPawl({
  color, length, role, noseRadius, rampAngle, workingAngles, toothHeight,
  width = 0.07, bossRadius = 0.13, boreRadius = 0.087, elbowRadius = 0.06, low = -0.1, high = 0.1,
}) {
  const pawl = new THREE.Group();
  const material = matte(color, { metalness: 0.13, roughness: 0.61 });
  const layoutAngle = Math.max(...workingAngles) + THREE.MathUtils.degToRad(0.1);
  const relief = layoutAngle - Math.min(...workingAngles) + THREE.MathUtils.degToRad(0.4);
  const chamferAngle = rampAngle + relief;
  // Layout frame: world orientation, origin at the pin, nose at N.
  const nose = [length * Math.cos(layoutAngle), length * Math.sin(layoutAngle)];
  const faceX = nose[0] - noseRadius;
  const rootY = nose[1] - noseRadius * (Math.tan(rampAngle) + 1 / Math.cos(rampAngle));
  const half = width / 2, fingerX = faceX + half;
  const elbowY = rootY + toothHeight + 0.035 + half;
  const elbowCenter = [fingerX + elbowRadius, elbowY];
  // The bar leaves the elbow tangentially, aimed at the pin.
  let heading = Math.PI / 2;
  for (let i = 0; i < 20; i++) {
    const end = [elbowCenter[0] + elbowRadius * Math.cos(heading + Math.PI / 2), elbowCenter[1] + elbowRadius * Math.sin(heading + Math.PI / 2)];
    heading = Math.atan2(-end[1], -end[0]);
  }
  const center = [[fingerX, rootY - 0.08]];
  const normals = [[-1, 0]];
  const arcCount = 48;
  for (let i = 0; i <= arcCount; i++) {
    const t = Math.PI + (heading + Math.PI / 2 - Math.PI) * i / arcCount;
    center.push([elbowCenter[0] + elbowRadius * Math.cos(t), elbowCenter[1] + elbowRadius * Math.sin(t)]);
    normals.push([Math.cos(t), Math.sin(t)]);
  }
  center.push([0, 0]);
  normals.push(normals.at(-1));
  const left = center.map((q, i) => [q[0] + half * normals[i][0], q[1] + half * normals[i][1]]);
  const right = center.map((q, i) => [q[0] - half * normals[i][0], q[1] - half * normals[i][1]]);
  const band = poly([...left, ...right.reverse()]);
  // Cut the tip: nothing left of the working face, nothing below the
  // relieved underside, and a nose of the seat radius between them.
  const tangentStart = Math.PI, tangentEnd = 1.5 * Math.PI + chamferAngle;
  const arc = Array.from({ length: 33 }, (_, i) => {
    const t = tangentStart + (tangentEnd - tangentStart) * i / 32;
    return [nose[0] + noseRadius * Math.cos(t), nose[1] + noseRadius * Math.sin(t)];
  });
  const reach = 2 * width, tangent = arc.at(-1);
  const cut = poly([
    [faceX - 0.3, elbowY], [faceX, elbowY], ...arc,
    [tangent[0] + reach, tangent[1] + reach * Math.tan(chamferAngle)],
    [tangent[0] + reach, rootY - 0.3], [faceX - 0.3, rootY - 0.3],
  ]);
  const outline = polygonClipping.difference(
    polygonClipping.union(band, poly(circle([0, 0], bossRadius, 96))),
    cut, poly(circle([0, 0], boreRadius, 96)));
  const toLocal = q => [q[0] * Math.cos(-layoutAngle) - q[1] * Math.sin(-layoutAngle), q[0] * Math.sin(-layoutAngle) + q[1] * Math.cos(-layoutAngle)];
  const local = outline.map(polygon => polygon.map(ring => ring.map(toLocal)));
  const body = new THREE.Mesh(plate(local, low, high), material);
  body.userData.role = `${role}-flat-hook-plate`;
  // A transform-only witness at the nose center keeps the kinematic API explicit.
  const noseWitness = new THREE.Object3D();
  noseWitness.position.set(length, 0, 0);
  noseWitness.userData.role = `${role}-rounded-toe-center`;
  pawl.add(body, noseWitness);
  Object.assign(pawl.userData, {
    role, length, body, nose: noseWitness, noseRadius, boreRadius, bossRadius, width,
    layoutAngle, chamferAngle, outline: local,
  });
  return pawl;
}

// Brown draws a small triangular plate round the three holes, with the
// handle springing from it: the hull of the three bosses, not an X of arms.
function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => {
    const out = [];
    for (const point of list) {
      while (out.length > 1 && cross(out.at(-2), out.at(-1), point) <= 0) out.pop();
      out.push(point);
    }
    return out.slice(0, -1);
  };
  const hull = [...half(sorted), ...half([...sorted].reverse())];
  return [[[...hull, hull[0]]]];
}

export function boredLeverPlate(anchors, handle) {
  const bosses = [[[0, 0], 0.22], ...anchors.map(point => [point.toArray(), 0.17])]
    .flatMap(([center, radius]) => circle(center, radius, 48));
  const outline = polygonClipping.union(convexHull(bosses),
    capsule([0, 0], handle.toArray(), 0.1, 32));
  const holes = [poly(circle([0, 0], 0.134, 64)), ...anchors.map(point => poly(circle(point.toArray(), 0.088, 64)))];
  return plate(polygonClipping.difference(outline, ...holes), -0.1, 0.1);
}

// C2 imposed return: rise before the first crest, descend only after the final
// crest. The finite gap at pickup supplies the otherwise missing overtravel.
export function pawlReturnLift(fraction) {
  const start = 0, riseEnd = 0.50, fallStart = 0.80, end = 1;
  if (fraction <= start || fraction >= end) return { value: 0, first: 0, second: 0 };
  if (fraction >= riseEnd && fraction <= fallStart) return { value: 1, first: 0, second: 0 };
  const rising = fraction < riseEnd, width = rising ? riseEnd : end - fallStart;
  const u = rising ? fraction / width : (end - fraction) / width;
  return { value: u ** 3 * (10 - 15 * u + 6 * u ** 2),
    first: (rising ? 1 : -1) * 30 * u ** 2 * (1 - u) ** 2 / width,
    second: 60 * u * (1 - u) * (1 - 2 * u) / width ** 2 };
}

export function finishRatchetBarSupports(root) {
  const { blocks: b, geometry: g } = root.userData;
  b.baseRail.geometry.dispose();
  b.baseRail.geometry = new THREE.BoxGeometry(6.9, 0.16, 0.54);
  b.baseRail.position.x = -2.34;
  // Replace the overlapping lever bars/solid center disk with one bored plate.
  for (const child of [...b.leverBody.children]) { child.geometry?.dispose(); b.leverBody.remove(child); }
  const lever = new THREE.Mesh(boredLeverPlate([g.longAnchorLocal, g.shortAnchorLocal], g.handleEndLocal), matte(PALETTE.driver));
  lever.userData.role = 'finite-three-bore-vibrating-lever';
  b.leverBody.add(lever);
  for (const pin of b.leverPins) {
    pin.geometry.dispose();
    const center = pin.userData.role === 'fixed-middle-fulcrum-pin';
    // The pawl pins pass through the pawl bosses (in the rack's plane) and
    // the lever plate in front of them.
    pin.geometry = new THREE.CylinderGeometry(center ? 0.13 : 0.085, center ? 0.13 : 0.085, 0.43, 64);
    pin.position.z = -0.09;
    // The lever turns on the stationary fulcrum shaft; a second, rotating
    // copy of that shaft would occupy the same solid.
    if (center) pin.visible = false;
  }
  // Brown's post stands on the ground line beside the table.
  const groundY = (246 - 377) * 0.018;
  b.pivotStand.geometry.dispose();
  b.pivotStand.geometry = new THREE.BoxGeometry(0.42, -0.2 - groundY, 0.7);
  b.pivotStand.position.y = (-0.2 + groundY) / 2;
  const bearing = new THREE.Mesh(ring(0.134, 0.25, -0.69, 0.01, 96), matte(PALETTE.frame));
  bearing.userData.role = 'bored-stationary-fulcrum-bearing';
  root.add(bearing);
  // The plate draws a plank table on two block legs, not a bed rail with
  // guide pedestals and keepers: the thin bar simply lies on the table top.
  for (const { post, cap } of b.guidePosts) {
    root.remove(post, cap);
    post.geometry.dispose(); cap.geometry.dispose();
  }
  root.remove(b.baseRail);
  b.baseRail.geometry.dispose();
  delete b.baseRail;
  delete b.guidePosts;
  const frameMaterial = b.pivotStand.material;
  const sourceX = x => (x - 432) * 0.018, sourceY = y => (246 - y) * 0.018;
  const tableTop = g.rackBaseBottomY - 0.002, tableBottom = sourceY(342);
  // Brown runs the table's top and bottom edges into the post's left face,
  // so the plank ends against the post (the post stands 7 px right of the
  // plate's, clearing the bar's in-view return).
  const tableRight = b.pivotStand.position.x - b.pivotStand.geometry.parameters.width / 2;
  const table = new THREE.Mesh(new THREE.BoxGeometry(tableRight - sourceX(135), tableTop - tableBottom, 0.6), frameMaterial);
  table.position.set((sourceX(135) + tableRight) / 2, (tableTop + tableBottom) / 2, -0.06);
  table.userData.role = 'source-plank-table-carrying-the-ratchet-bar';
  root.add(table);
  b.table = table;
  b.tableLegs = [[147, 190], [318, 360]].map(([left, right], index) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(sourceX(right) - sourceX(left), tableBottom - groundY, 0.6), frameMaterial);
    leg.position.set((sourceX(left) + sourceX(right)) / 2, (tableBottom + groundY) / 2, -0.06);
    leg.userData.role = `source-table-block-leg-${index + 1}`;
    root.add(leg);
    return leg;
  });
  // Brown draws no white bar marks or contact dots.
  for (const marker of b.rackIndexes) marker.visible = false;
  // Include the entire finite bar, the left pulley and its hanging cord.
  root.userData.cameraFitBounds.set(new THREE.Vector3(-7.72, -2.9, -0.85), new THREE.Vector3(2.06, 1.62, 1.1));
}
