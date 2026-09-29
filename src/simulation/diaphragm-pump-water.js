import * as THREE from 'three';
import {latheAtAngles, stackedFluidGeometry} from './stacked-fluid-volume.js';
import {mergePassageParts} from './finite-fluid-passages.js';
import {poly, polygonClipping} from './finite-plate-geometry.js';
import {waterStreamMaterial} from './water-stream.js';
import {PALETTE} from './primitives.js';

// Pass 110: movement 454's water is one continuous body from the suction
// pipe mouth, through the suction check, the chamber under the diaphragm,
// the delivery branch and check, and up the riser to its (cropped) top.
// Every surface stands `GAP` off the solid it fills, and the pieces continue
// one another ring for ring (open ends, no internal sheets):
//   suction column  lathe about the suction axis: pipe, flared check body,
//                   through the seat's two ports, up the body's lip;
//   chamber         a plan stack round the suction body's footprint up to
//                   the lip, then a lathe up the wall to the clamping ring;
//                   its top follows the diaphragm (and the clamp under it)
//                   every frame; the wall is bored where the branch leaves;
//   branch          a tube along the branch wall's centreline whose start
//                   is a saddle on the chamber water's wall;
//   delivery        lathe about the delivery axis: flared check body, seat
//                   ports, lip and the riser, one surface.
// The flowing columns (suction, branch, delivery) use the shared streak
// material; their streaks advance by the displaced volume (suction while
// the diaphragm rises, delivery while it falls) so they stand still while
// their check is seated and loop seamlessly.
const GAP = 0.008;
const TILES_PER_CYCLE = 5;
const ACROSS = 6;

const disk = (cx, cz, r, angles) => poly(angles.map((a) => [cx + r * Math.cos(a), cz + r * Math.sin(a)]));
const uniformAngles = (n, start = 0) => Array.from({length: n}, (_, i) => start + 2 * Math.PI * i / n);

// Remove triangles whose centroid satisfies `drop`.
function withoutTriangles(geometry, drop) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = source.attributes.position.array, keep = [];
  const c = new THREE.Vector3();
  for (let t = 0; t < p.length; t += 9) {
    c.set((p[t] + p[t + 3] + p[t + 6]) / 3, (p[t + 1] + p[t + 4] + p[t + 7]) / 3, (p[t + 2] + p[t + 5] + p[t + 8]) / 3);
    if (!drop(c)) keep.push(t / 3, t / 3 + 1, t / 3 + 2);
  }
  const out = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const size = attribute.itemSize, array = new Float32Array(keep.length * size);
    keep.forEach((v, i) => {for (let s = 0; s < size; s += 1) array[i * size + s] = attribute.array[v * size + s];});
    out.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  return out;
}

// Streak coordinates for a non-indexed flow surface: u round the axis (each
// triangle unwrapped so no texture seam is squeezed), v the displaced-volume
// coordinate `vAt(position)` in tiles.
function addFlowAttributes(geometry, axisAt, vAt) {
  const p = geometry.attributes.position.array, n = p.length / 3;
  const uv = new Float32Array(n * 2), color = new Float32Array(n * 4), tint = new THREE.Color(PALETTE.fluid);
  const v = new THREE.Vector3();
  for (let t = 0; t < n; t += 3) {
    const us = [];
    for (let k = 0; k < 3; k += 1) {
      v.fromArray(p, 3 * (t + k));
      const [ax, az] = axisAt(v);
      us.push(THREE.MathUtils.euclideanModulo(Math.atan2(v.z - az, v.x - ax) / (2 * Math.PI), 1) * ACROSS);
    }
    const ref = us[0];
    for (let k = 0; k < 3; k += 1) {
      let u = us[k];
      while (u - ref > ACROSS / 2) u -= ACROSS;
      while (ref - u > ACROSS / 2) u += ACROSS;
      v.fromArray(p, 3 * (t + k));
      uv[2 * (t + k)] = u;uv[2 * (t + k) + 1] = vAt(v);
      color.set([tint.r, tint.g, tint.b, 1], 4 * (t + k));
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 4));
  return geometry;
}

// Cumulative volume along y for a column of cross-section area(y).
function volumeCoordinate(y0, y1, area, steps = 2000) {
  const ys = [], vs = [];let vol = 0;
  for (let i = 0; i <= steps; i += 1) {
    const y = y0 + (y1 - y0) * i / steps;
    if (i) vol += 0.5 * (area(y) + area(ys[i - 1])) * (y - ys[i - 1]);
    ys.push(y);vs.push(vol);
  }
  return (y) => {
    const f = THREE.MathUtils.clamp((y - y0) / (y1 - y0) * steps, 0, steps), i = Math.min(steps - 1, Math.floor(f));
    return vs[i] + (vs[i + 1] - vs[i]) * (f - i);
  };
}

// One check body's water: the flared body under the seat, the seat's two
// ports, the body above it and whatever column follows (a lathe profile
// `above`, [y, r] pairs from the seat upward). `below` runs from the inlet up
// to the seat. Returns the merged geometry about (ax, az) and the profile.
function checkBodyWater({ax, az, seatY, seatBottom, seatTop, below, above, angles}) {
  const bodyRadius = 0.45 - GAP;
  const lower = latheAtAngles([...below, [seatBottom - GAP, bodyRadius]], angles);
  const upper = latheAtAngles([[seatTop + GAP, bodyRadius], ...above], angles);
  lower.translate(ax, 0, az);upper.translate(ax, 0, az);
  // Seat ports (the seat outline's two holes, see flexible-pump-working-parts.js),
  // symmetric in z; plan (x, z).
  const ports = polygonClipping.union(
    poly([[ax - 0.19 + GAP, az - 0.16 + GAP], [ax + 0.19 - GAP, az - 0.16 + GAP], [ax + 0.19 - GAP, az + 0.16 - GAP], [ax - 0.19 + GAP, az + 0.16 - GAP]]),
    poly([[ax - 0.33 + GAP, az - 0.30 + GAP], [ax - 0.175, az - 0.30 + GAP], [ax - 0.175, az + 0.30 - GAP], [ax - 0.33 + GAP, az + 0.30 - GAP]]));
  const faces = polygonClipping.difference(disk(ax, az, bodyRadius, angles), ports);
  const seat = stackedFluidGeometry([{region: ports, y0: seatBottom - GAP, y1: seatTop + GAP}], {
    openBottom: ports, openTop: ports,
    caps: [{region: faces, y: seatBottom - GAP, up: true}, {region: faces, y: seatTop + GAP, up: false}],
  });
  let portArea = 0;
  for (const [outer, ...holes] of ports) for (const [k, ring] of [outer, ...holes].entries()) {
    let a = 0;for (let i = 0; i < ring.length - 1; i += 1) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    portArea += (k ? -1 : 1) * Math.abs(a) / 2;
  }
  void seatY;
  return {geometry: mergePassageParts([lower, seat, upper]), portArea};
}

// Radius of a lathe profile ([y, r] pairs, y ascending) at y.
function profileRadius(profile, y) {
  for (let i = 0; i < profile.length - 1; i += 1) {
    const [y0, r0] = profile[i], [y1, r1] = profile[i + 1];
    if (y >= y0 && y <= y1 && y1 > y0) return r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return y < profile[0][0] ? profile[0][1] : profile[profile.length - 1][1];
}

export function buildDiaphragmPumpWater(root, {waterMaterial, membraneY, clampUnderRadius, clampUnderDepth}) {
  const d = root.userData, b = d.blocks, g = d.geometry;
  const wallInner = 1.25, floorTop = g.chamberBottomY + 0.07, rimLow = g.diaphragmRimY - 0.055;
  const chamberR = wallInner - GAP, holeR = g.diaphragmRadius - GAP;
  const branchR = 0.225 - GAP, riserR = 0.265 - GAP, suctionR = 0.245 - GAP;
  const chamberAngles = uniformAngles(192);

  // ---- suction column (pipe, check body, lip), about (sx, sz).
  const sv = b.suctionValve.userData.body.position, sx = sv.x, sz = sv.z, sy = sv.y;
  const sSeat = b.suctionValve.userData.seat, sSeatTop = sSeat.position.y, sSeatBottom = sSeatTop - 0.065;
  const lipTop = sy + 0.40, chamberJoin = lipTop + GAP;
  const suctionAngles = uniformAngles(48);
  const suctionBelow = [[-2.05, suctionR], [sy - 0.30, suctionR], [sy - 0.14, 0.45 - GAP]];
  const suctionAbove = [[sy + 0.30, 0.45 - GAP], [sy + 0.40, 0.265 - GAP], [chamberJoin, 0.265 - GAP]];
  const suction = checkBodyWater({ax: sx, az: sz, seatY: sy, seatBottom: sSeatBottom, seatTop: sSeatTop,
    below: suctionBelow, above: suctionAbove, angles: suctionAngles});
  const suctionProfile = [...suctionBelow, [sSeatBottom - GAP, 0.45 - GAP], [sSeatTop + GAP, 0.45 - GAP], ...suctionAbove];
  const suctionArea = (y) => (y > sSeatBottom - GAP && y < sSeatTop + GAP ? suction.portArea : Math.PI * profileRadius(suctionProfile, y) ** 2);

  // ---- chamber: plan stack round the suction body up to its lip, then a
  // lathe up the wall; the top (diaphragm and clamp) is rebuilt per frame.
  const bodyOuter = (y) => (y <= sy + 0.30 ? 0.50 : 0.50 - (y - sy - 0.30) / 0.10 * 0.19) + GAP;
  const chamberDisk = disk(0, 0, chamberR, chamberAngles);
  const layers = [{region: polygonClipping.difference(chamberDisk, disk(sx, sz, bodyOuter(0 + sy), chamberAngles)), y0: floorTop + GAP, y1: sy + 0.30}];
  for (let i = 0; i < 10; i += 1) {
    const y0 = sy + 0.30 + 0.01 * i, y1 = y0 + 0.01;
    layers.push({region: polygonClipping.difference(chamberDisk, disk(sx, sz, bodyOuter(y0), chamberAngles)), y0, y1});
  }
  const lastFoot = bodyOuter(lipTop);
  layers.push({region: polygonClipping.difference(chamberDisk, disk(sx, sz, lastFoot, chamberAngles)), y0: lipTop, y1: chamberJoin});
  const lipCap = polygonClipping.difference(disk(sx, sz, lastFoot, chamberAngles), disk(sx, sz, 0.265 - GAP, suctionAngles));
  const lowerChamber = stackedFluidGeometry(layers, {openTop: layers.at(-1).region, caps: [{region: lipCap, y: chamberJoin, up: false}]});
  const wallProfile = [];
  for (let y = chamberJoin; y < rimLow - GAP - 1e-6; y += 0.01) wallProfile.push([y, chamberR]);
  wallProfile.push([rimLow - GAP, chamberR], [rimLow - GAP, holeR]);
  const upperChamber = latheAtAngles(wallProfile, chamberAngles);

  // ---- branch: a tube on the branch wall's centreline (see
  // flexible-pump-working-parts.js), starting in a saddle on the chamber
  // water's wall and ending on the delivery body's inlet ring.
  const dv = b.deliveryValve.userData.body.position, dx = dv.x, dz = dv.z, dy = dv.y;
  const branchCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.95, 0.34, dz), new THREE.Vector3(1.30, 0.34, dz),
    new THREE.Vector3(1.5, 0.34, dz), new THREE.Vector3(2.02, 0.60, dz), new THREE.Vector3(dx, dy - 0.30, dz)]);
  const sides = 48, thetas = uniformAngles(sides);
  const binormal = new THREE.Vector3(0, 0, 1);
  const ringPoint = (u, theta) => {
    const p = branchCurve.getPointAt(u), t = branchCurve.getTangentAt(u), n = new THREE.Vector3().crossVectors(binormal, t).normalize();
    return p.addScaledVector(n, branchR * Math.cos(theta)).addScaledVector(binormal, branchR * Math.sin(theta));
  };
  const radial = (p) => Math.hypot(p.x, p.z) - chamberR;
  let uStart = 0;
  while (branchCurve.getPointAt(uStart).x < 1.27) uStart += 1e-4;
  const saddleU = thetas.map((theta) => {
    let lo = 0, hi = uStart;
    for (let k = 0; k < 50; k += 1) {const mid = (lo + hi) / 2;if (radial(ringPoint(mid, theta)) < 0) lo = mid;else hi = mid;}
    return hi;
  });
  const saddle = thetas.map((theta, j) => ringPoint(saddleU[j], theta));
  // The delivery lathe's angles are the branch end ring's, so they meet.
  const deliveryAngles = thetas.map((theta) => Math.PI - theta);
  const rings = [saddle], ringUs = [saddleU];
  const branchSteps = 72;
  for (let i = 0; i <= branchSteps; i += 1) {
    const u = uStart + (1 - uStart) * i / branchSteps;
    ringUs.push(thetas.map(() => u));
    rings.push(i === branchSteps
      ? deliveryAngles.map((a) => new THREE.Vector3(dx + branchR * Math.cos(a), dy - 0.30, dz + branchR * Math.sin(a)))
      : thetas.map((theta) => ringPoint(u, theta)));
  }
  const branchPositions = [], branchIJ = [];
  for (let i = 0; i < rings.length - 1; i += 1) for (let j = 0; j < sides; j += 1) {
    const a = rings[i][j], c = rings[i][(j + 1) % sides], e = rings[i + 1][j], f = rings[i + 1][(j + 1) % sides];
    for (const p of [a, c, f, a, f, e]) branchPositions.push(p.x, p.y, p.z);
    branchIJ.push([i, j], [i, j + 1], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i + 1, j]);
  }
  const branchGeometry = new THREE.BufferGeometry();
  branchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(branchPositions, 3));
  branchGeometry.computeVertexNormals();
  // Bore the chamber water's wall where the branch leaves it.
  const inPort = (c) => c.x > 0.8 && Math.hypot(c.y - 0.34, c.z - dz) < branchR;
  const chamberStatic = mergePassageParts([withoutTriangles(lowerChamber, inPort), withoutTriangles(upperChamber, inPort)]);

  // ---- delivery column: check body, seat ports, lip and the riser.
  const dSeat = b.deliveryValve.userData.seat, dSeatTop = dSeat.position.y, dSeatBottom = dSeatTop - 0.065;
  const riserTop = 3.34;
  const deliveryBelow = [[dy - 0.30, branchR], [dy - 0.14, 0.45 - GAP]];
  const deliveryAbove = [[dy + 0.30, 0.45 - GAP], [dy + 0.40, riserR], [riserTop, riserR]];
  const delivery = checkBodyWater({ax: dx, az: dz, seatY: dy, seatBottom: dSeatBottom, seatTop: dSeatTop,
    below: deliveryBelow, above: deliveryAbove, angles: deliveryAngles});
  const deliveryProfile = [...deliveryBelow, [dSeatBottom - GAP, 0.45 - GAP], [dSeatTop + GAP, 0.45 - GAP], ...deliveryAbove];
  const deliveryArea = (y) => (y > dSeatBottom - GAP && y < dSeatTop + GAP ? delivery.portArea : Math.PI * profileRadius(deliveryProfile, y) ** 2);

  // ---- streak coordinates: v counts displaced volume in tiles.
  const strokeVolume = d.geometry.diaphragmEffectiveArea * Math.abs(d.stateAtInputAngle(Math.PI).diaphragmCenterY - d.stateAtInputAngle(0).diaphragmCenterY);
  const tileVolume = strokeVolume / TILES_PER_CYCLE;
  const suctionV = volumeCoordinate(-2.05, chamberJoin, suctionArea);
  addFlowAttributes(suction.geometry, () => [sx, sz], (p) => suctionV(p.y) / tileVolume);
  const branchLength = branchCurve.getLength(), branchArea = Math.PI * branchR ** 2;
  {
    const uv = new Float32Array(branchIJ.length * 2), color = new Float32Array(branchIJ.length * 4), tint = new THREE.Color(PALETTE.fluid);
    branchIJ.forEach(([i, j], k) => {
      uv[2 * k] = j / sides * ACROSS;uv[2 * k + 1] = (ringUs[i][j % sides] - uStart) * branchLength * branchArea / tileVolume;
      color.set([tint.r, tint.g, tint.b, 1], 4 * k);
    });
    branchGeometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    branchGeometry.setAttribute('color', new THREE.BufferAttribute(color, 4));
  }
  const branchVolume = (1 - uStart) * branchLength * branchArea;
  const deliveryV = volumeCoordinate(dy - 0.30, riserTop, deliveryArea);
  addFlowAttributes(delivery.geometry, () => [dx, dz], (p) => (branchVolume + deliveryV(p.y)) / tileVolume);

  const streak = () => waterStreamMaterial({opacity: 0.5, normalScale: 0.3});
  const suctionMaterial = streak(), deliveryMaterial = streak();

  // ---- chamber top: indexed rings (duplicated at creases), rebuilt per frame.
  const radii = [];
  for (let i = 0; i <= 18; i += 1) radii.push(holeR + (Math.max(clampUnderRadius + GAP, d.geometry.clampRadius) - holeR) * i / 18);
  if (d.geometry.clampRadius > clampUnderRadius + GAP) for (let i = 1; i <= 4; i += 1) radii.push(d.geometry.clampRadius + (clampUnderRadius + GAP - d.geometry.clampRadius) * i / 4);
  const topRows = (c) => [
    [rimLow - GAP, holeR], [membraneY(holeR, c) - GAP, holeR],
    ...radii.map((r) => [membraneY(r, c) - GAP, r]),
    [c - clampUnderDepth - GAP, clampUnderRadius + GAP], [c - clampUnderDepth - GAP, clampUnderRadius + GAP],
    [c - clampUnderDepth - GAP, 0],
  ];
  // Crease rows are emitted twice so their normals do not smooth across.
  const creases = new Set([1, 1 + radii.length]);
  const layout = (c) => {const rows = [];topRows(c).forEach((row, i) => {rows.push(row);if (creases.has(i)) rows.push(row);});return rows;};
  const nRows = layout(g.diaphragmRimY).length, nA = chamberAngles.length;
  const topGeometry = new THREE.BufferGeometry();
  topGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nRows * nA * 3), 3));
  const index = [];
  for (let i = 0; i < nRows - 1; i += 1) for (let j = 0; j < nA; j += 1) {
    const a = i * nA + j, c = i * nA + (j + 1) % nA, e = a + nA, f = c + nA;
    index.push(a, c, f, a, f, e);
  }
  topGeometry.setIndex(index);
  const cosA = chamberAngles.map(Math.cos), sinA = chamberAngles.map(Math.sin);
  const updateTop = (c) => {
    const p = topGeometry.attributes.position.array;
    layout(c).forEach(([y, r], i) => {for (let j = 0; j < nA; j += 1) {const k = 3 * (i * nA + j);p[k] = r * cosA[j];p[k + 1] = y;p[k + 2] = r * sinA[j];}});
    topGeometry.attributes.position.needsUpdate = true;
    topGeometry.computeVertexNormals();topGeometry.computeBoundingSphere();topGeometry.computeBoundingBox();
  };

  // Replace the old proxies.
  const swap = (mesh, geometry, material, role) => {
    mesh.geometry.dispose();mesh.geometry = geometry;mesh.material = material;mesh.userData.role = role;
    mesh.position.set(0, 0, 0);mesh.rotation.set(0, 0, 0);mesh.scale.set(1, 1, 1);mesh.visible = true;
  };
  swap(b.chamberWater, chamberStatic, waterMaterial, 'water-filling-chamber-round-suction-check-to-clamping-ring');
  const chamberTop = new THREE.Mesh(topGeometry, waterMaterial);
  chamberTop.userData.role = 'water-under-flexible-diaphragm-following-membrane';
  root.add(chamberTop);
  swap(b.suctionPipe.water, suction.geometry, suctionMaterial, 'water-rising-through-suction-pipe-and-check-on-diaphragm-upstroke');
  swap(b.deliveryBranch.water, branchGeometry, deliveryMaterial, 'water-forced-from-chamber-through-branch-toward-delivery-check');
  swap(b.deliveryRiser.water, delivery.geometry, deliveryMaterial, 'water-expelled-through-delivery-check-and-up-riser');
  for (const m of [b.chamberWater, chamberTop, b.suctionPipe.water, b.deliveryBranch.water, b.deliveryRiser.water]) {m.castShadow = false;m.receiveShadow = false;m.userData.noShadow = true;}
  b.chamberWaterTop = chamberTop;

  const cLow = d.stateAtInputAngle(0).diaphragmCenterY, cHigh = d.stateAtInputAngle(Math.PI).diaphragmCenterY;
  const setOffset = (mesh, value) => {
    for (const m of [].concat(mesh.material)) for (const t of [m.map, m.normalMap]) if (t) t.offset.y = -THREE.MathUtils.euclideanModulo(value, 1);
  };
  const update = (state) => {
    updateTop(state.diaphragmCenterY);
    const rising = Math.sin(state.inputAngle) >= 0 && state.phase <= 0.5;
    const fraction = (state.diaphragmCenterY - cLow) / (cHigh - cLow);
    const suctionDone = rising ? fraction : 1, deliveryDone = rising ? 0 : 1 - fraction;
    setOffset(b.suctionPipe.water, TILES_PER_CYCLE * suctionDone);
    setOffset(b.deliveryBranch.water, TILES_PER_CYCLE * deliveryDone);
    setOffset(b.deliveryRiser.water, TILES_PER_CYCLE * deliveryDone);
  };
  return {update, streakMaterials: [suctionMaterial, deliveryMaterial]};
}
