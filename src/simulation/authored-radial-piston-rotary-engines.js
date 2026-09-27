import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { fitPistonGuide } from './piston-guide-parts.js';
import { latheSectionGeometry } from './cutaway-section.js';
import {
  angleOf,
  arcBetween,
  arcPoints,
  bandPolygon,
  circlePolygon,
  lineCircleFillet,
  multiArea,
  partPlate,
  pointInPolygon,
  polygonClipping,
  ringPolygon,
  safeClip,
  sectionPlate,
  steamVolume,
} from './steam-section-kit.js';

const FULL_TURN = Math.PI * 2;
const DEG = Math.PI / 180;

// Movement 426, rotary engine with two stationary abutments D and two
// pistons A sliding radially in grooves in hub C (pass 69 rebuild).
//
// The working space between hub C and the cast cylinder is closed at the two
// abutments D, where the cylinder closes on the hub, and so forms an upper
// and a lower chamber. Each side of the casing has two ports, one either side
// of its abutment, run out through the neck as two separate channels: steam
// enters each chamber just past one abutment (the right neck's upper channel
// and the left neck's lower channel) and leaves just before the other (the
// left neck's upper channel and the right neck's lower channel), as Brown's
// arrows show. Each piston A, kept out against the cylinder wall, divides its
// chamber: steam behind it drives it and hub C anticlockwise while the space
// ahead of it exhausts. Both pistons are driven at once.
function radialPistonRotaryEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 16 / 3; // one turn of C (as before, 1.5 pi per 4 s)
  const rotorAngularSpeed = FULL_TURN / cycleDuration; // anticlockwise
  const sourceRotorAngle = Math.atan2(438 - 94, 243 - 280); // Brown: A nearly upright

  // Units of the official canvas reconstruction (hub radius 4), which is a
  // trace of Brown's plate.
  const hubRadius = 4.0;
  const shaftRadius = 0.7;
  const grooveInner = 1.0;
  const pistonHalfWidth = 0.25;
  const pistonLength = 2.7;
  const tipClearance = 0.01;
  const casingRadius = 7.0;
  const depth = 1.6;
  const zBack = -depth;
  const backThickness = 0.25;

  // Cylinder wall of the upper chamber (arcs of the official trace): from the
  // right abutment, a fillet up into the large arc over the top, a smaller
  // arc down the left side, and the left abutment where the wall closes on C.
  const upperWall = [
    ...arcPoints([3.092475, 1.587961], 2.000003, 5.180658, 0.149044 + FULL_TURN, 24),
    ...arcPoints([0.127285, 1.149067], 4.997495, 0.147787, 2.297989, 64).slice(1),
    ...arcPoints([-1.200599, 2.641283], 3, 2.297989, 3.649761, 30).slice(1),
    ...arcPoints([0, 0], hubRadius, 2.841732, 3.092387, 12).slice(1),
  ];
  const chamberProfile = [...upperWall, ...upperWall.map(([x, y]) => [-x, -y])];
  const chamberPolygon = ringPolygon(chamberProfile);

  // ---- piston travel: largest radius at which the round end of A clears the wall
  const distanceToProfile = (point) => {
    let best = Infinity;
    for (let i = 0; i < chamberProfile.length; i += 1) {
      const a = chamberProfile[i];
      const b = chamberProfile[(i + 1) % chamberProfile.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = THREE.MathUtils.clamp(((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      best = Math.min(best, Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy));
    }
    return best;
  };
  const tableSize = 720;
  const tipTable = new Float64Array(tableSize);
  for (let i = 0; i < tableSize; i += 1) {
    const angle = i / tableSize * FULL_TURN;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let low = hubRadius - pistonHalfWidth - 0.003;
    let high = 7;
    for (let iteration = 0; iteration < 26; iteration += 1) {
      const mid = (low + high) / 2;
      const inside = pointInPolygon([mid * c, mid * s], chamberPolygon[0])
        && distanceToProfile([mid * c, mid * s]) >= pistonHalfWidth + tipClearance;
      if (inside) low = mid; else high = mid;
    }
    // over the abutments the round end stands just inside the hub face
    tipTable[i] = Math.max(low, hubRadius - pistonHalfWidth - 0.003);
  }
  // light smoothing of the sampled cam, never beyond the clear position
  // (nor beyond it between samples)
  const smoothed = Float64Array.from(tipTable, (_, i) => Math.min(
    tipTable[(i + tableSize - 1) % tableSize], tipTable[i], tipTable[(i + 1) % tableSize],
    (tipTable[(i + tableSize - 1) % tableSize] + 2 * tipTable[i] + tipTable[(i + 1) % tableSize]) / 4));
  const tipCenterRadius = (angle) => {
    const x = THREE.MathUtils.euclideanModulo(angle, FULL_TURN) / FULL_TURN * tableSize;
    const i = Math.floor(x);
    const f = x - i;
    return smoothed[i % tableSize] * (1 - f) + smoothed[(i + 1) % tableSize] * f;
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const rotorAngle = sourceRotorAngle + rotorAngularSpeed * cycleTime;
    const pistons = [0, 1].map((k) => {
      const angle = rotorAngle + k * Math.PI;
      const tip = tipCenterRadius(angle);
      return { angle, tipCenterRadius: tip, outerRadius: tip + pistonHalfWidth, extension: tip + pistonHalfWidth - hubRadius };
    });
    return { cycleTime, phase: cycleTime / cycleDuration, rotorAngle, rotorAngularSpeed, pistons };
  };

  // ---- casing ---------------------------------------------------------------------
  // Outline of the official trace of Brown's casing: a circle of radius 7
  // with a neck each side, each flank a radius-2 arc from the neck-end
  // corner tangent into the circle, on a foot whose flanks are radius-1.5
  // arcs from the plate.
  const neckEnd = 7.5;
  const flank = (center, from, to) => arcPoints(center, 2, from, to, 20);
  const angleFrom = (center, point) => Math.atan2(point[1] - center[1], point[0] - center[0]);
  const leftUpperCenter = [-7.658534, 4.727246];
  const leftLowerCenter = [-8.823681, -1.772754];
  const rightLowerCenter = [7.658534, -4.727246];
  const rightUpperCenter = [8.823681, 1.772754];
  const onCircle = (center) => {
    const d = Math.hypot(...center);
    return [center[0] * casingRadius / d, center[1] * casingRadius / d];
  };
  const footArcRight = arcPoints([4.5, -5.5], 1.5, 270 * DEG, 209.2 * DEG, 16);
  const footArcLeft = arcPoints([-4.5, -5.5], 1.5, -29.2 * DEG, -90 * DEG, 16);
  const outerOutline = ringPolygon([
    [-6, -8], [6, -8], [6, -7],
    ...footArcRight,
    ...arcBetween([0, 0], casingRadius, angleOf(footArcRight.at(-1)), angleOf(onCircle(rightLowerCenter))).slice(1, -1),
    ...flank(rightLowerCenter, angleFrom(rightLowerCenter, onCircle(rightLowerCenter)), angleFrom(rightLowerCenter, [neckEnd, -2.73354])),
    [neckEnd, 0.273464],
    ...flank(rightUpperCenter, angleFrom(rightUpperCenter, [neckEnd, 0.273464]), angleFrom(rightUpperCenter, onCircle(rightUpperCenter)) + (angleFrom(rightUpperCenter, onCircle(rightUpperCenter)) > angleFrom(rightUpperCenter, [neckEnd, 0.273464]) ? -FULL_TURN : 0)).slice(1),
    ...arcBetween([0, 0], casingRadius, angleOf(onCircle(rightUpperCenter)), angleOf(onCircle(leftUpperCenter))).slice(1, -1),
    ...flank(leftUpperCenter, angleFrom(leftUpperCenter, onCircle(leftUpperCenter)), angleFrom(leftUpperCenter, [-neckEnd, 2.73354])),
    [-neckEnd, -0.273464],
    ...flank(leftLowerCenter, angleFrom(leftLowerCenter, [-neckEnd, -0.273464]), angleFrom(leftLowerCenter, onCircle(leftLowerCenter))).slice(1),
    ...arcBetween([0, 0], casingRadius, angleOf(onCircle(leftLowerCenter)), angleOf(footArcLeft[0])).slice(1, -1),
    ...footArcLeft,
    [-6, -7],
  ]);
  // Two channels in each neck (Brown's "two valves on each side"): on the
  // left, the upper one runs straight into the upper chamber just above D,
  // the lower one bends down round D into the lower chamber just below it.
  const straightChannel = bandPolygon([[-neckEnd - 0.05, 1.977], [-5.4, 1.977], [-3.2, 1.977]], 0.35);
  const bentChannel = bandPolygon([
    [-neckEnd - 0.05, 0.977], [-6.137, 0.977],
    ...arcPoints([-6.137265, -0.372754], 1.35, Math.PI / 2, 25 * DEG, 24).slice(1),
    [-4.62, -0.35], [-3.9, -0.95],
  ], 0.35);
  const mirror = (multi) => multi.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [-x, -y])));
  const channels = {
    leftEduction: straightChannel,
    leftInduction: bentChannel,
    rightEduction: mirror(straightChannel),
    rightInduction: mirror(bentChannel),
  };
  const cavity = polygonClipping.intersection(polygonClipping.union(chamberPolygon, ...Object.values(channels)), outerOutline);
  const casingOutline = polygonClipping.difference(outerOutline, cavity);

  const frameMaterial = matte(PALETTE.frame, { metalness: 0.24, roughness: 0.54 });
  const backMaterial = matte(0x7d8786, { metalness: 0.18, roughness: 0.6 });
  const hubMaterial = matte(PALETTE.driven, { metalness: 0.2, roughness: 0.5 });
  const pistonMaterial = matte(PALETTE.driver, { metalness: 0.2, roughness: 0.48 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.3, roughness: 0.43 });

  const casing = sectionPlate(casingOutline, zBack, 0, frameMaterial,
    'sectioned-cylinder-with-abutments-D-and-two-channels-in-each-neck');
  root.add(casing);
  const back = sectionPlate(polygonClipping.difference(outerOutline, circlePolygon([0, 0], shaftRadius + 0.01, 48)),
    zBack - backThickness, zBack, backMaterial, 'solid-back-of-cylinder');
  back.material = [backMaterial, backMaterial];
  root.add(back);

  // ---- hub C with grooves, shaft B and pistons A ------------------------------------------
  const rotor = new THREE.Group();
  rotor.userData.role = 'hub-C-fast-on-main-shaft-B';
  const grooves = [0, Math.PI].map((a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return ringPolygon([[grooveInner, -pistonHalfWidth - 0.01], [hubRadius + 0.1, -pistonHalfWidth - 0.01],
      [hubRadius + 0.1, pistonHalfWidth + 0.01], [grooveInner, pistonHalfWidth + 0.01]]
      .map(([x, y]) => [x * c - y * s, x * s + y * c]));
  });
  const hubC = partPlate(polygonClipping.difference(circlePolygon([0, 0], hubRadius - 0.004, 192),
    ...grooves, circlePolygon([0, 0], shaftRadius, 48)), zBack + 0.01, -0.01, hubMaterial,
  'hub-C-with-two-radial-grooves');
  rotor.add(hubC);
  const shaftB = new THREE.Mesh(latheSectionGeometry(
    [[0, zBack - backThickness - 0.8], [shaftRadius, zBack - backThickness - 0.8], [shaftRadius, -0.012], [0, -0.012]],
    { segments: 48, phiStart: 0, phiLength: FULL_TURN },
  ), darkMaterial);
  shaftB.rotation.x = Math.PI / 2;
  shaftB.userData.role = 'main-shaft-B';
  rotor.add(shaftB);
  root.add(rotor);
  const pistonOutline = polygonClipping.union(
    ringPolygon([[-pistonLength, -pistonHalfWidth], [0, -pistonHalfWidth], [0, pistonHalfWidth], [-pistonLength, pistonHalfWidth]]),
    circlePolygon([0, 0], pistonHalfWidth, 32),
  );
  const pistons = [0, 1].map((k) => {
    const piston = partPlate(pistonOutline, zBack + 0.02, -0.02, pistonMaterial,
      k === 0 ? 'radially-sliding-piston-A-1' : 'radially-sliding-piston-A-2');
    root.add(piston);
    return piston;
  });

  // ---- steam -------------------------------------------------------------------------------
  const steamZ = [zBack + 0.015, -0.015];
  // One steam volume per body of steam, so each changes shape smoothly: a
  // body is born behind a piston as it passes the first abutment of a
  // chamber, grows while it drives, and after the piston leaves the chamber
  // it is the space ahead of the next piston, blown down and swept out.
  // Keyed by (chamber, piston it was born behind).
  const chambers = [
    { name: 'upper', start: -3 * DEG, end: 163 * DEG, induction: [6.5, -0.977], eduction: [-6.5, 1.977] },
    { name: 'lower', start: 177 * DEG, end: 343 * DEG, induction: [-6.5, 0.977], eduction: [6.5, -1.977] },
  ];
  const steamMeshes = [];
  for (const chamber of chambers) {
    chamber.meshes = [0, 1].map((k) => {
      const mesh = steamVolume(`steam-in-${chamber.name}-chamber-born-behind-piston-A-${k + 1}`, ...steamZ);
      root.add(mesh);
      steamMeshes.push(mesh);
      return mesh;
    });
  }
  const blowdownAngle = 10 * DEG;
  const hubSplitter = circlePolygon([0, 0], hubRadius + 0.012, 192);
  const pistonSplitter = polygonClipping.union(pistonOutline,
    ringPolygon([[0, -pistonHalfWidth], [0.6, -pistonHalfWidth], [0.6, pistonHalfWidth], [0, pistonHalfWidth]]));
  const place = (multi, radius, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return multi.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [(x + radius) * c - y * s, (x + radius) * s + y * c])));
  };
  // The four channels are drawn as their own steady volumes; each chamber is
  // split by its piston into the body behind it and the body ahead of it.
  const channelOnly = Object.fromEntries(Object.entries(channels).map(([name, channel]) => [name,
    safeClip('difference', polygonClipping.intersection(channel, outerOutline), chamberPolygon)]));
  const channelMeshes = Object.entries(channelOnly).map(([name, region]) => {
    const mesh = steamVolume(`steam-in-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}-channel`, ...steamZ);
    mesh.userData.setRegion(region, /Induction/.test(name) ? 1 : 0);
    root.add(mesh);
    steamMeshes.push(mesh);
    return mesh;
  });
  const steamReport = { pieces: [] };
  const updateSteam = (state) => {
    const pieces = safeClip('difference', chamberPolygon, hubSplitter,
      ...state.pistons.map((p) => place(pistonSplitter, p.tipCenterRadius, p.angle)));
    steamReport.pieces = [];
    const assigned = new Map(steamMeshes.filter((mesh) => !channelMeshes.includes(mesh))
      .map((mesh) => [mesh, { region: [], pressure: 0 }]));
    for (const chamber of chambers) {
      const span = THREE.MathUtils.euclideanModulo(chamber.end - chamber.start, FULL_TURN);
      const progress = state.pistons.map((p) => THREE.MathUtils.euclideanModulo(p.angle - chamber.start, FULL_TURN));
      const inside = progress[0] <= span ? 0 : 1; // the piston working in this chamber
      const other = 1 - inside;
      const mine = pieces.filter((piece) => {
        const ring = piece[0];
        const cx = ring.reduce((sum, q) => sum + q[0], 0) / ring.length;
        const cy = ring.reduce((sum, q) => sum + q[1], 0) / ring.length;
        piece.progress = THREE.MathUtils.euclideanModulo(Math.atan2(cy, cx) - chamber.start, FULL_TURN);
        return piece.progress <= span + 4 * DEG || piece.progress > FULL_TURN - 4 * DEG;
      });
      for (const piece of mine) {
        const at = piece.progress > FULL_TURN - 4 * DEG ? 0 : piece.progress;
        let key;
        let pressure;
        if (mine.length === 1) {
          // both pistons over the abutments: the whole chamber is open from
          // inlet to exhaust (the dead point); it is the body just driven
          const toEnd = progress.map((q) => Math.abs(THREE.MathUtils.euclideanModulo(q - span + Math.PI, FULL_TURN) - Math.PI));
          key = toEnd[0] < toEnd[1] ? 0 : 1;
          pressure = 1;
        } else if (at < progress[inside]) {
          key = inside; // behind the working piston: live
          pressure = 1;
        } else {
          key = other; // ahead of it: blown down and swept to the eduction
          pressure = 1 - THREE.MathUtils.smootherstep(progress[inside] / blowdownAngle, 0, 1);
        }
        const slot = assigned.get(chamber.meshes[key]);
        slot.region.push(piece);
        slot.pressure = pressure;
        steamReport.pieces.push({ chamber: chamber.name, behind: key === inside && mine.length > 1, pressure, area: multiArea([piece]) });
      }
    }
    for (const [mesh, { region, pressure }] of assigned) mesh.userData.setRegion(region, pressure);
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.rotorAngle;
    state.pistons.forEach((p, k) => {
      pistons[k].position.set(p.tipCenterRadius * Math.cos(p.angle), p.tipCenterRadius * Math.sin(p.angle), 0);
      pistons[k].rotation.z = p.angle;
    });
    updateSteam(state);
  };

  let minTip = Infinity;
  let maxTip = -Infinity;
  for (let i = 0; i < tableSize; i += 1) { minTip = Math.min(minTip, smoothed[i]); maxTip = Math.max(maxTip, smoothed[i]); }
  root.userData = {
    animationTiming: { authoredCyclePeriod: cycleDuration, targetCycleDuration: cycleDuration },
    archetype: 'two-radially-sliding-pistons-in-rotating-hub-between-two-abutments-with-two-ported-necks',
    blocks: { casing, back, rotor, hubC, shaftB, pistons, steamMeshes },
    degreesOfFreedom: { independentPrescribedInputs: 1, operatingDegreesOfFreedom: 1 },
    dynamics: {
      steam: 'Steam volumes are the actual pieces of the working space after hub C and the two pistons divide it: pieces joined to an induction channel are live, pieces joined to an eduction channel exhaust; while both pistons pass the abutments each chamber is briefly open from inlet to exhaust (the engine’s dead point).',
      pistonOutwardForce: 'The pistons are kept against the cylinder wall; the steam or spring that does it is not modelled.',
    },
    fidelity: 'authored',
    geometry: {
      cycleDuration,
      hubRadius, pistonHalfWidth, pistonLength, grooveInner, casingRadius, depth, minTipCenter: minTip, maxTipCenter: maxTip,
      chamberProfile, cavity, casingOutline, channels,
    },
    mechanism: 'Hub C on shaft B turns anticlockwise inside a cylinder that closes on it at the two abutments D. Pistons A slide in radial grooves in C and follow the cylinder wall. Each neck carries two channels, one either side of its abutment: steam enters each chamber just past one abutment and is educted just before the other, so both pistons are driven at once.',
    motion: { cycleDuration, rotorAngularSpeed },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      reason: 'The official Movement 426 page traces the cylinder wall (the arcs used here), two channels in each neck — one straight into the chamber above the left abutment, one bent round it into the chamber below — and pistons that follow the wall. Its geometry numbers were used as a trace of Brown’s plate; the code is independent.',
    },
    sourceReference: {
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 426',
      reconstructionDisclosure: 'Brown does not say how the pistons are kept against the wall or show the channels beyond the necks. Piston length, groove depth, casing depth and the round piston ends are engineered.',
    },
    stateAtTime,
    steamReport,
    tipCenterRadius,
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0.08, 0.05, 1);
  root.userData.cameraFov = 8;
  // Built in the official trace's units; shown at the earlier model scale.
  root.scale.setScalar(0.48);
  update(0);
  markShadows(root);
  for (const mesh of steamMeshes) { mesh.castShadow = false; mesh.receiveShadow = false; }
  fitPistonGuide(root, update, cycleDuration);
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

export function createAuthoredRadialPistonRotaryEngineMovement(movement) {
  if (movement.id !== 426) return null;
  return radialPistonRotaryEngine(movement);
}
