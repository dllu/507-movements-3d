import * as THREE from 'three';
import {circle, plate, poly, polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE, markShadows, matte} from './primitives.js';
import generatedEnds from './generated-parsons-ends.js';

// Movement 394, C. Parsons's endless rack. The plate shows an oblong frame
// toothed all round its inside (two straight rows joined by two toothed
// semicircular ends), a small pinion meshing with the upper row, a larger
// concentric flange behind the pinion whose top runs hidden in the rack
// (Brown's dashed arc), and the rod running off to the right to a collar.
//
// Reconstruction: the pinion turns on a fixed shaft at constant speed. Its
// centre, seen from the rack, runs round a stadium path whose straight parts
// lie one pinion pitch radius inside the straight rows and whose ends are
// concentric with the toothed ends. Every rack tooth therefore meshes once per
// cycle: along the upper row the rack runs left (Brown's arrow), round the
// right end the pinion rolls inside a toothed semicircle exactly as a planet
// in a fixed internal gear (the rack translates, never turns), along the lower
// row the rack runs right, and round the left end back again. The rack also
// shifts up and down by 2e while the pinion goes round each end; the
// oscillating cylinder the rod belongs to allows that.
//
// Tooth forms (pass 99): Brown's box teeth. The straight rows are a
// zero-pressure-angle rack: square notches with vertical walls, their tooth
// tips on the pitch line and half a pitch wide. Each tip corner, lying on the
// pitch line, traces an involute of the pinion's pitch circle as the rack
// rolls, so the pinion's teeth are those involutes (base circle = pitch
// circle) with radial walls below it: the corner drives the involute along the
// pitch line with a contact ratio of 1.11. The ends are internal gears of the
// same zero-angle form with their tips on the pitch circle; with 10 pinion
// teeth and 14-tooth ends the pinion tips would sweep the ring tooth corners
// outside the line of action, so each end is relieved by the sweep of the
// pinion itself (scripts/generate-parsons-ends.py), as a gear shaper would.
//
// The two concentric flanges of different diameters sit behind the pinion
// and run against two stepped rebates ("grooves on its side") in the back of
// the rack, which hold the pinion at its working depth all round the path.

const FULL_TURN = Math.PI * 2;
const involuteFunction = (angle) => Math.tan(angle) - angle;

// Closed outline of an external involute gear, tooth centred on +x.
export function involuteGearOutline({teeth, module, pressureAngle, tipRadius,
  rootRadius, pitchThickness, flankSamples = 18}) {
  const pitchRadius = teeth * module / 2;
  const baseRadius = pitchRadius * Math.cos(pressureAngle);
  const halfAtBase = pitchThickness / (2 * pitchRadius)
    + involuteFunction(pressureAngle);
  const start = Math.max(baseRadius, rootRadius);
  const flank = [];
  for (let i = 0; i <= flankSamples; i += 1) {
    const radius = start + (tipRadius - start) * i / flankSamples;
    const pressure = Math.acos(Math.min(1, baseRadius / radius));
    flank.push([radius, halfAtBase - involuteFunction(pressure)]);
  }
  const points = [];
  const halfSpace = Math.PI / teeth;
  const low = flank[0][1];
  const tip = flank.at(-1)[1];
  const at = (radius, angle) => [radius * Math.cos(angle), radius * Math.sin(angle)];
  for (let k = 0; k < teeth; k += 1) {
    const c = k * FULL_TURN / teeth;
    for (let i = 0; i < 4; i += 1) points.push(at(rootRadius, c - halfSpace + (halfSpace - low) * i / 4));
    if (rootRadius < baseRadius) points.push(at(rootRadius, c - low));
    for (const [radius, angle] of flank) points.push(at(radius, c - angle));
    for (let i = 1; i < 4; i += 1) points.push(at(tipRadius, c - tip + 2 * tip * i / 4));
    for (const [radius, angle] of [...flank].reverse()) points.push(at(radius, c + angle));
    if (rootRadius < baseRadius) points.push(at(rootRadius, c + low));
    for (let i = 1; i < 4; i += 1) points.push(at(rootRadius, c + low + (halfSpace - low) * i / 4));
  }
  return points;
}

const stadium = (halfStraight, radius, count = 96) => {
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const a = -Math.PI / 2 + Math.PI * i / count;
    points.push([halfStraight + radius * Math.cos(a), radius * Math.sin(a)]);
  }
  for (let i = 0; i <= count; i += 1) {
    const a = Math.PI / 2 + Math.PI * i / count;
    points.push([-halfStraight + radius * Math.cos(a), radius * Math.sin(a)]);
  }
  return points;
};

// Tooth form (pass 99): zero pressure angle. The pinion is shifted out by
// 0.55m with addendum 0.55m, so its tips stand 1.1m above its pitch circle and
// the rack and ring tips (shift minus addendum) lie exactly on their pitch
// lines; the rack spaces are 1.6m (0.51 pitch) deep with flat roots. Pass 84's
// 22.5 degree involute rows tapered the rack tips to 0.32 pitch.
export function parsonsDesign(overrides = {}) {
  const pinionTeeth = 10;
  const endTeeth = 14; // full-circle count of each toothed semicircular end
  const straightPitches = 14; // pitches along each straight row
  const module = 0.13;
  const pressureAngle = (overrides.pressureDeg ?? 0) * Math.PI / 180;
  const addendum = (overrides.addendum ?? 0.55) * module;
  const dedendum = (overrides.dedendum ?? 1.05) * module;
  const profileShift = (overrides.profileShift ?? 0.55) * module;
  const endAddendum = (overrides.endAddendum ?? 0.55) * module;
  // The generated end relief belongs to the default design only.
  const endCarve = overrides.endCarve ?? Object.keys(overrides).length === 0;
  const backlash = (overrides.backlash ?? 0.02) * module;
  const pitch = Math.PI * module;
  const pinionPitchRadius = pinionTeeth * module / 2;
  const endPitchRadius = endTeeth * module / 2;
  const halfStraight = straightPitches * pitch / 2;
  const eccentricity = endPitchRadius - pinionPitchRadius;
  const bandOuterRadius = endPitchRadius + 0.8 * module + 0.52;
  const largeFlangeRadius = 1.0;
  const smallFlangeRadius = 0.85;
  const rebateClearance = 0.01;
  const pathLength = 4 * halfStraight + FULL_TURN * eccentricity;
  return {
    addendum, backlash, bandOuterRadius, dedendum, eccentricity, endAddendum, endCarve, endPitchRadius,
    endTeeth, halfStraight, largeFlangeRadius, module, pathLength, pinionPitchRadius,
    pinionTeeth, pitch, pressureAngle, profileShift, rebateClearance, smallFlangeRadius, straightPitches,
    rackToothCount: 2 * straightPitches + endTeeth,
    pinionTurnsPerCycle: pathLength / (FULL_TURN * pinionPitchRadius),
  };
}

// Transverse contact ratios of the pinion with the straight rows and with the
// internal ends, and the pinion's tip thickness.
export function parsonsMeshRatios(g) {
  const {pressureAngle: al, pinionPitchRadius: rp, endPitchRadius: R, profileShift: x} = g;
  const rb = rp * Math.cos(al), Rb = R * Math.cos(al);
  const ra = rp + x + g.addendum, Ra = R + x - g.endAddendum;
  const pb = g.pitch * Math.cos(al);
  const approach = Math.sqrt(ra * ra - rb * rb);
  const inv = (a) => Math.tan(a) - a;
  const s = g.pitch / 2 - g.backlash / 2 + 2 * x * Math.tan(al);
  // The rack's own addendum (its tips above the pitch line) adds action on the
  // other side of the pitch point; at zero pressure angle it is zero.
  const rackAddendum = g.addendum - x;
  return {
    straightRows: (approach - rp * Math.sin(al) + (rackAddendum > 1e-12 ? rackAddendum / Math.sin(al) : 0)) / pb,
    internalEnds: (approach - Math.sqrt(Ra * Ra - Rb * Rb) + (R - rp) * Math.sin(al)) / pb,
    pinionTipThickness: 2 * ra * (s / (2 * rp) + inv(al) - inv(Math.acos(rb / ra))),
  };
}

// The air inside the toothed band: the region the band does not occupy.
export function parsonsRackVoid(g) {
  const {addendum, backlash, dedendum, endPitchRadius: H, halfStraight: L,
    pitch, pressureAngle, module, profileShift: shift} = g;
  const tan = Math.tan(pressureAngle);
  const tipY = H + shift - addendum;
  const reachY = H + shift + addendum; // the pinion tips' deepest reach
  const rootY = H + shift + dedendum;
  const parts = [poly([[-L, -tipY], [L, -tipY], [L, tipY], [-L, tipY]])];
  // Straight rows: a tooth space is centred on every pitch mark from -L to L;
  // straight involute flanks over the working depth, square below it. The two
  // junction spaces are left whole so the half cut by the end's involute and
  // the half cut by the row both stand clear.
  const halfAtTip = pitch / 4 + backlash / 2 + addendum * tan;
  const halfAtReach = pitch / 4 + backlash / 2 - addendum * tan;
  for (let k = 0; k <= g.straightPitches; k += 1) {
    const x = -L + k * pitch;
    for (const s of [1, -1]) {
      const pts = [[x - halfAtTip, s * (tipY - 1e-4)], [x + halfAtTip, s * (tipY - 1e-4)],
        [x + halfAtReach, s * reachY], [x + halfAtReach, s * rootY],
        [x - halfAtReach, s * rootY], [x - halfAtReach, s * reachY]];
      if (k === 0 || k === g.straightPitches) parts.push(poly(pts));
      else parts.push(clip.intersection(poly(pts), poly([[-L, -2 * H], [L, -2 * H], [L, 2 * H], [-L, 2 * H]])));
    }
  }
  // Toothed ends: the internal gear's spaces are the teeth of a 14-tooth
  // external "cutter" of the same module and shift, a space centred at each
  // junction. Like the rows, each space is involute out to the pinion tips'
  // reach and continues with parallel walls to the rows' root line.
  const pitchThickness = pitch / 2 + backlash / 2 + 2 * shift * tan;
  const cutterTeeth = involuteGearOutline({teeth: g.endTeeth, module, pressureAngle,
    tipRadius: reachY, rootRadius: H + shift - g.endAddendum, pitchThickness});
  const baseRadius = H * Math.cos(pressureAngle);
  const inv = (a) => Math.tan(a) - a;
  const reachHalf = reachY * (pitchThickness / (2 * H) + inv(pressureAngle)
    - inv(Math.acos(baseRadius / reachY)));
  const reliefs = [];
  for (let k = 0; k < g.endTeeth; k += 1) {
    const c = k * FULL_TURN / g.endTeeth, u = [Math.cos(c), Math.sin(c)], n = [-u[1], u[0]];
    const at = (r, w) => [r * u[0] + w * n[0], r * u[1] + w * n[1]];
    const inner = reachY * Math.cos(reachHalf / reachY) - 1e-3;
    reliefs.push(poly([at(inner, -reachHalf), at(rootY, -reachHalf), at(rootY, reachHalf), at(inner, reachHalf)]));
  }
  const cutter = clip.union(poly(cutterTeeth), ...reliefs)
    .map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [-y, x]))); // a space at the top junction
  for (const side of [1, -1]) {
    const moved = cutter.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [side * L + x, y])));
    const half = side > 0
      ? poly([[L, -2 * H], [L + 2 * H, -2 * H], [L + 2 * H, 2 * H], [L, 2 * H]])
      : poly([[-L - 2 * H, -2 * H], [-L, -2 * H], [-L, 2 * H], [-L - 2 * H, 2 * H]]);
    parts.push(clip.intersection(moved, half));
  }
  if (g.endCarve) {
    const right = generatedEnds.rightEndRelief;
    parts.push([right], [right.map(([x, y]) => [-x, -y])]);
  }
  return clip.union(...parts);
}

export function parsonsPinionOutline(g) {
  return involuteGearOutline({teeth: g.pinionTeeth, module: g.module, pressureAngle: g.pressureAngle,
    tipRadius: g.pinionPitchRadius + g.profileShift + g.addendum,
    rootRadius: g.pinionPitchRadius + g.profileShift - g.dedendum,
    pitchThickness: g.pitch / 2 - g.backlash / 2 + 2 * g.profileShift * Math.tan(g.pressureAngle)});
}

// Pinion centre on its stadium path (rack frame) at path distance s, running
// clockwise: right along the upper row, down round the right end, left along
// the lower row and up round the left end.
export function parsonsPathPoint(g, distance) {
  const {halfStraight: L, eccentricity: e} = g;
  let s = ((distance % g.pathLength) + g.pathLength) % g.pathLength;
  if (s < 2 * L) return {x: -L + s, y: e, vx: 1, vy: 0, segment: 'upper-row'};
  s -= 2 * L;
  const arc = Math.PI * e;
  if (s < arc) {
    const a = Math.PI / 2 - s / e;
    return {x: L + e * Math.cos(a), y: e * Math.sin(a), vx: Math.sin(a), vy: -Math.cos(a), segment: 'right-end'};
  }
  s -= arc;
  if (s < 2 * L) return {x: L - s, y: -e, vx: -1, vy: 0, segment: 'lower-row'};
  s -= 2 * L;
  const a = -Math.PI / 2 - s / e;
  return {x: -L + e * Math.cos(a), y: e * Math.sin(a), vx: Math.sin(a), vy: -Math.cos(a), segment: 'left-end'};
}

function parsonsEndlessRackDrive(movement) {
  const root = new THREE.Group();
  const g = parsonsDesign();
  const cycleDuration = 16;
  const speed = g.pathLength / cycleDuration; // pinion-centre path speed = omega * r
  const omega = speed / g.pinionPitchRadius;
  // Brown's pose: the pinion on the upper row a little right of centre.
  const sourceDistance = g.halfStraight + 0.7;

  const rackMaterial = matte(PALETTE.driver, {metalness: 0.13, roughness: 0.58});
  const pinionMaterial = matte(PALETTE.driven, {metalness: 0.17, roughness: 0.53});
  const flangeMaterial = matte(0x9dbfd0, {metalness: 0.17, roughness: 0.55});
  const steelMaterial = matte(PALETTE.ink, {metalness: 0.26, roughness: 0.45});

  // Rack: toothed band in front, two stepped rebates behind, rod and collar.
  const rack = new THREE.Group();
  rack.userData.role = 'endless-rack-with-rod-reciprocating-and-shifting';
  const outer = poly(stadium(g.halfStraight, g.bandOuterRadius));
  const band = new THREE.Mesh(plate(clip.difference(outer, parsonsRackVoid(g)), -0.15, 0.15), rackMaterial);
  band.userData.role = 'endless-rack-band-toothed-all-round-inside';
  const largeEdge = g.eccentricity + g.largeFlangeRadius + g.rebateClearance;
  const smallEdge = g.eccentricity + g.smallFlangeRadius + g.rebateClearance;
  const largeRebate = new THREE.Mesh(plate(clip.difference(outer, poly(stadium(g.halfStraight, largeEdge))), -0.27, -0.15), rackMaterial);
  largeRebate.userData.role = 'rack-side-groove-rebate-for-large-flange';
  const smallRebate = new THREE.Mesh(plate(clip.difference(outer, poly(stadium(g.halfStraight, smallEdge))), -0.39, -0.27), rackMaterial);
  smallRebate.userData.role = 'rack-side-groove-rebate-for-small-flange';
  const rodStart = g.halfStraight + g.bandOuterRadius - 0.12;
  const rodLength = 2.35;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, rodLength, 48).rotateZ(Math.PI / 2), rackMaterial);
  rod.position.set(rodStart + rodLength / 2, 0, -0.12);
  rod.userData.role = 'input-rod-from-oscillating-cylinder';
  // Brown ends the rod in a flat rectangular crosshead block.
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.30, 1.30, 0.72), rackMaterial);
  collar.position.set(rodStart + rodLength + 0.15, 0, -0.12);
  collar.userData.role = 'input-rod-end-collar';
  rack.add(band, largeRebate, smallRebate, rod, collar);
  root.add(markShadows(rack));

  // Pinion with its two concentric flanges and shaft, on a fixed axis.
  const rotor = new THREE.Group();
  rotor.userData.role = 'fixed-axis-output-pinion-with-two-concentric-flanges';
  const pinion = new THREE.Mesh(plate(poly(parsonsPinionOutline(g)), -0.13, 0.13), pinionMaterial);
  pinion.userData.role = 'ten-tooth-involute-output-pinion';
  const largeFlange = new THREE.Mesh(plate(poly(circle([0, 0], g.largeFlangeRadius, 256)), -0.25, -0.17), flangeMaterial);
  largeFlange.userData.role = 'large-concentric-flange-running-in-rack-side-groove';
  const smallFlange = new THREE.Mesh(plate(poly(circle([0, 0], g.smallFlangeRadius, 256)), -0.37, -0.29), flangeMaterial);
  smallFlange.userData.role = 'small-concentric-flange-running-in-rack-side-groove';
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 48).rotateX(Math.PI / 2), pinionMaterial);
  hub.position.z = -0.24;
  hub.userData.role = 'hub-joining-pinion-and-flanges';
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 40).rotateX(Math.PI / 2), steelMaterial);
  shaft.position.z = -0.37 - 0.4;
  shaft.userData.role = 'fixed-axis-output-shaft-running-back';
  rotor.add(pinion, largeFlange, smallFlange, hub, shaft);
  root.add(markShadows(rotor));

  const stateAtTime = (time) => {
    const distance = sourceDistance + speed * time;
    const point = parsonsPathPoint(g, distance);
    // A tooth points at the upper junction contact when distance = 0.
    const pinionAngle = Math.PI / 2 + distance / g.pinionPitchRadius;
    return {
      segment: point.segment,
      pathDistance: distance,
      pinionCenterInRack: new THREE.Vector2(point.x, point.y),
      rackPosition: new THREE.Vector2(-point.x, -point.y),
      rackVelocity: new THREE.Vector2(-speed * point.vx, -speed * point.vy),
      outputAngle: pinionAngle,
      outputAngularSpeed: omega,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rack.position.set(state.rackPosition.x, state.rackPosition.y, 0);
    rotor.rotation.z = state.outputAngle;
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype: movement.archetype,
    fidelity: 'authored',
    mechanism: 'one-oblong-endless-rack-toothed-all-round-inside-reciprocated-by-a-rod-turning-one-fixed-axis-ten-tooth-involute-pinion-continuously-held-in-depth-by-two-concentric-flanges-in-stepped-side-grooves',
    blocks: {rack, band, largeRebate, smallRebate, rod, collar, rotor, pinion, largeFlange, smallFlange, hub, shaft},
    geometry: {...g, cycleDuration, mechanismCyclePeriod: cycleDuration, sourceDistance, pathSpeed: speed},
    stateAtTime,
    update,
    reconstructionNote:
      'Kinematic reconstruction: constant pinion speed, rack translating so the pinion centre traces a stadium in the rack frame; all 42 rack teeth mesh once per cycle. The flanges bound the mesh depth against over-engagement only; retention against the separating tooth force is not solved (prescribed path). Brown gives no dimensions, tooth counts or animation; counts are chosen for the plate proportions and a working involute internal mesh.',
    sourceAnimation: {available: false, officialPage: movement.sourceUrl},
  };
  root.userData.hideGround = true;
  root.userData.cameraDirection = new THREE.Vector3(0, 0, 1);
  const bounds = new THREE.Box3();
  for (let i = 0; i <= 64; i += 1) {
    update(cycleDuration * i / 64);
    root.updateMatrixWorld(true);
    bounds.union(new THREE.Box3().setFromObject(root));
  }
  root.userData.cameraFitBounds = bounds.expandByScalar(0.05);
  root.userData.cameraDistanceScale = 1.05;
  update(0);
  return {root, update, cameraDirection: root.userData.cameraDirection};
}

export function createAuthoredParsonsRackMovement(movement) {
  if (movement.id !== 394) return null;
  return parsonsEndlessRackDrive(movement);
}
