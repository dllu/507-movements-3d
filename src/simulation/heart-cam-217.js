// Plate 217: Brown's grooved heart cam C, D, B, e with the stud A that works
// in its groove. Brown draws the cam alone; the stud and the lever carrying it
// about H are reconstructed so the turning cam visibly drives something.
//
// The groove centre line is measured from the engraving (ray samples from the
// cam centre, symmetric about the e-D axis): its radius falls from the
// outward point e at twelve o'clock to the inward notch D at six o'clock.
// Both walls are exact offsets of that centre line, so the groove has one
// constant width and the stud roller keeps a small clearance to both walls.
// Stud A is carried on a long lever about a fixed shaft H to the right of the
// cam; it rides the groove almost radially (the lever swings about 28
// degrees), so every stud position is solved from the actual groove.
import * as THREE from 'three';
import {capsule, circle, poly, polygonClipping as clip, plate} from './finite-plate-geometry.js';
import {PALETTE, markShadows, matte} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const RASTER = 5.58 / 237; // world units per engraving pixel (cam rim 237 px)
// Groove centre-line radius (engraving pixels) measured every 10 degrees
// from e to D; a least-squares quintic in (angle from e)/180 degrees smooths
// the hand measurements (maximum residual 2.6 px).
const PROFILE_PX = [204, 192, 180.3, 170.3, 162, 154.2, 147, 140.5, 134, 128, 124, 118.5, 111.5, 101.5, 91, 86, 77, 70, 66];
const PROFILE_FIT = [203.8334, -213.02, -28.1205, 867.0306, -1453.2581, 689.6601];
const profilePx = x => PROFILE_FIT.reduceRight((sum, c) => sum * x + c, 0);

export function heartCam217Geometry() {
  // phi: clockwise angle from the cam's e direction (+y in cam frame).
  const radiusAt = phi => RASTER * profilePx(Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))) / Math.PI);
  const camRadius = 5.58, grooveHalfWidth = 18 * RASTER, rollerRadius = grooveHalfWidth - 0.035;
  const bossRadius = 42.5 * RASTER, boreRadius = 23 * RASTER, keyholeRadius = 52 * RASTER;
  const centreLine = Array.from({length: 360}, (_, i) => {
    const phi = i / 360 * FULL_TURN, r = radiusAt(phi);
    return [r * Math.sin(phi), r * Math.cos(phi)];
  });
  const rMin = radiusAt(Math.PI), rMax = radiusAt(0);
  const H = [6.6, (rMin + rMax) / 2];
  const leverLength = Math.hypot(H[0], H[1] - rMin);
  return {measuredProfilePx: PROFILE_PX, camRadius, grooveHalfWidth, rollerRadius, bossRadius, boreRadius, keyholeRadius, centreLine, radiusAt, rMin, rMax, H, leverLength};
}

function band(centreLine, radius) {
  // Minkowski band of the closed centre line: union of capsules, in batches.
  const pieces = centreLine.map((p, i) => capsule(p, centreLine[(i + 1) % centreLine.length], radius, 12));
  let groups = [];
  for (let i = 0; i < pieces.length; i += 24) groups.push(clip.union(...pieces.slice(i, i + 24)));
  while (groups.length > 1) {
    const next = [];
    for (let i = 0; i < groups.length; i += 2) next.push(i + 1 < groups.length ? clip.union(groups[i], groups[i + 1]) : groups[i]);
    groups = next;
  }
  return groups[0];
}

const ringLoop = (ring, z) => new THREE.BufferGeometry().setFromPoints(ring.slice(0, -1).map(([x, y]) => new THREE.Vector3(x, y, z)));

export function createHeartCam217() {
  const g = heartCam217Geometry();
  const root = new THREE.Group(), parts = {}, blocks = {};
  const heart = poly(g.centreLine);
  const groove = band(g.centreLine, g.grooveHalfWidth);
  const bevel = band(g.centreLine, g.grooveHalfWidth + 11 * RASTER);
  const disk = poly(circle([0, 0], g.camRadius, 256));
  const keyhole = poly(circle([0, 0], g.keyholeRadius, 96));
  const outerLand = clip.difference(disk, clip.union(heart, groove));
  const island = clip.difference(heart, groove, keyhole);
  const outerBevel = clip.union(heart, bevel);
  const islandBevel = clip.difference(heart, bevel, poly(circle([0, 0], g.keyholeRadius + 11 * RASTER, 96)));

  const landMaterial = matte(PALETTE.driver, {metalness: .13, roughness: .62});
  const floorMaterial = matte(0xa94734, {metalness: .1, roughness: .72});
  const leverMaterial = matte(PALETTE.driven, {metalness: .12, roughness: .63});
  const inkMaterial = matte(PALETTE.ink, {metalness: .23, roughness: .51});
  const lineMaterial = new THREE.LineBasicMaterial({color: PALETTE.ink});
  const add = (parent, name, geometry, material) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.userData.role = name; parent.add(mesh); parts[name] = mesh; return mesh;
  };

  const cam = new THREE.Group(); cam.name = 'body:cam'; cam.userData.role = 'clockwise-grooved-heart-cam-C-D-B-e'; root.add(cam); blocks.cam = cam;
  add(cam, 'groove-floor-and-cam-web', plate(clip.difference(disk, poly(circle([0, 0], g.boreRadius, 96))), -.16, 0), floorMaterial);
  add(cam, 'outer-cam-land', plate(outerLand, 0, .22), landMaterial);
  add(cam, 'heart-island', plate(island, 0, .22), landMaterial);
  add(cam, 'hub-boss', plate(clip.difference(poly(circle([0, 0], g.bossRadius, 96)), poly(circle([0, 0], g.boreRadius, 96))), 0, .22), landMaterial);
  add(cam, 'cam-shaft', plate(poly(circle([0, 0], g.boreRadius - .01, 64)), -.4, .3), inkMaterial);
  // Brown's double wall lines: the groove edge and the bevel line on each land.
  for (const polygons of [outerBevel, clip.union(heart, groove), island, islandBevel]) for (const polygon of polygons) for (const ring of polygon) {
    const line = new THREE.LineLoop(ringLoop(ring, .222), lineMaterial); line.userData.role = 'engraved-wall-line'; cam.add(line);
  }

  const lever = new THREE.Group(); lever.name = 'body:lever'; lever.userData.role = 'lever-A-H'; lever.position.set(g.H[0], g.H[1], 0); root.add(lever); blocks.lever = lever;
  const L = g.leverLength;
  // The lever boss is bored for the fixed shaft H; the stud roller is seated
  // on the lever's underside and runs free of the groove floor.
  add(lever, 'lever-A-H', plate(clip.difference(clip.union(capsule([0, 0], [-L, 0], .2, 24), poly(circle([0, 0], .42, 64)), poly(circle([-L, 0], .3, 48))), poly(circle([0, 0], .21, 48))), .30, .40), leverMaterial);
  add(lever, 'stud-A-roller', plate(poly(circle([-L, 0], g.rollerRadius, 96)), .03, .30), leverMaterial);
  add(lever, 'stud-A-pin-head', plate(poly(circle([-L, 0], .12, 32)), .40, .44), inkMaterial);
  add(root, 'fixed-shaft-H', plate(poly(circle(g.H, .2, 48)), -.3, .46), inkMaterial);

  // Solve the lever angle for every cam angle from the actual groove.
  const samples = 4096, beta = new Float64Array(samples + 1);
  const studAt = b => [g.H[0] + L * Math.cos(b), g.H[1] + L * Math.sin(b)];
  const residual = (b, theta) => {
    const [x, y] = studAt(b), c = Math.cos(-theta), s = Math.sin(-theta), xc = c * x - s * y, yc = s * x + c * y;
    return Math.hypot(x, y) - g.radiusAt(Math.atan2(xc, yc));
  };
  const bisect = (a, c, theta) => {
    let fa = residual(a, theta);
    for (let n = 0; n < 52; n++) { const m = (a + c) / 2, fm = residual(m, theta); if (fa * fm <= 0) c = m; else { a = m; fa = fm; } }
    return (a + c) / 2;
  };
  // Every sign change of the residual in [lo, hi]; the root nearest the
  // previous lever angle keeps the stud on one continuous branch.
  const roots = (lo, hi, steps, theta) => {
    const found = [];
    let bPrev = lo, fPrev = residual(lo, theta);
    for (let k = 1; k <= steps; k++) {
      const b = lo + (hi - lo) * k / steps, f = residual(b, theta);
      if (fPrev === 0 || fPrev * f < 0) found.push(bisect(bPrev, b, theta));
      bPrev = b; fPrev = f;
    }
    return found;
  };
  let previous = Math.PI;
  for (let i = 0; i <= samples; i++) {
    const theta = -FULL_TURN * i / samples;
    let found = i ? roots(previous - .03, previous + .03, 6, theta) : [];
    if (found.length !== 1) found = roots(Math.PI - .5, Math.PI + .5, 200, theta);
    if (!found.length) throw new Error('217 stud lost the groove');
    previous = found.reduce((best, r) => (Math.abs(r - previous) < Math.abs(best - previous) ? r : best));
    beta[i] = previous;
  }
  const period = 8;
  const leverAngleAt = time => {
    const u = ((time / period) % 1 + 1) % 1 * samples, i = Math.floor(u), t = u - i;
    return beta[i] + (beta[Math.min(samples, i + 1)] - beta[i]) * t;
  };
  const update = time => {
    const theta = -FULL_TURN * time / period, b = leverAngleAt(time);
    cam.rotation.z = theta; lever.rotation.z = b - Math.PI;
    const stud = studAt(b);
    root.userData.state = {time, camAngle: theta, leverAngle: b, stud, studRadius: Math.hypot(...stud)};
    root.updateMatrixWorld(true);
  };
  update(0);
  let minBeta = Infinity, maxBeta = -Infinity;
  for (const b of beta) { minBeta = Math.min(minBeta, b); maxBeta = Math.max(maxBeta, b); }
  const bounds = new THREE.Box3(new THREE.Vector3(-g.camRadius, -g.camRadius, -.4), new THREE.Vector3(g.camRadius, g.camRadius, .46));
  for (const b of [minBeta, maxBeta, Math.PI]) { const [x, y] = studAt(b); bounds.expandByPoint(new THREE.Vector3(x, y, 0)); }
  bounds.expandByPoint(new THREE.Vector3(g.H[0] + .5, g.H[1] + .5, 0));
  bounds.expandByScalar(.15);
  root.traverse(o => { for (const m of [].concat(o.material ?? [])) m.fog = false; });
  markShadows(root);
  Object.assign(root.userData, {
    parts, blocks, geometry: g, hideGround: true, materialsIgnoreSceneFog: true, cameraFitBounds: bounds,
    leverAngleAt, leverSweep: maxBeta - minBeta,
    animationTiming: {authoredCyclePeriod: period, displayCycleDuration: period, playbackTimeScale: 1},
    mechanism: 'clockwise grooved heart cam C-D-B-e driving stud A on a lever about H',
    fidelity: 'authored', reconstructionStatus: 'verified',
    reconstructionNote: 'Brown draws the heart cam alone. Its groove is the measured symmetric heart, with both walls exact offsets of one centre line. Stud A rides the groove on a lever about a fixed shaft H to the right; the lever is reconstructed (Brown shows it on plate 218, where the full wool-comber catch and notch wheel are presented). Every lever angle is solved from the groove; loads and friction are not simulated.',
  });
  return {root, update, cameraDirection: new THREE.Vector3(0, 0, 15)};
}
