import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { fitPistonGuide } from './piston-guide-parts.js';
import { latheSectionGeometry } from './cutaway-section.js';
import {
  angleOf,
  arcBetween,
  circlePolygon,
  convexHull,
  farRadiusAlongRay,
  lineCircleFillet,
  multiArea,
  partPlate,
  polygonClipping,
  ringPolygon,
  safeClip,
  sectionPlate,
  setSteamRegions,
  steamVolume,
} from './steam-section-kit.js';

const FULL_TURN = Math.PI * 2;
const DEG = Math.PI / 180;
const wrap = (angle) => THREE.MathUtils.euclideanModulo(angle, FULL_TURN);

// Movement 428, the india-rubber rotary engine (pass 69 rebuild).
//
// The rubber lining E is clamped into the middle of each port neck, so it
// divides the space between itself and the rigid bore into an upper and a
// lower half. Each neck has two channels, one either side of the clamp: the
// left neck's upper channel and the right neck's lower channel admit steam,
// the other two exhaust (Brown's two arrows both run clockwise, away from the
// admitting necks). Each roller A presses the rubber against the bore and so
// seals the steam space. Behind the leading roller of each half the steam
// presses the rubber in, taut, against the rollers (the rubber here takes the
// outward face of the convex hull of its clamp and the rollers it rests on),
// so the space grows as the roller moves on: the steam expands and drives the
// arms B clockwise. When a roller rolls past the far channel, the space
// behind it opens to the exhaust and the rubber falls back against the bore.
// The rollers roll on the rubber without slip, turning the other way.
function rubberLinedRotaryEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6; // one turn of B; three power impulses per half
  const rotorAngularSpeed = -FULL_TURN / cycleDuration; // clockwise
  const sourceRotorAngle = 182 * DEG; // Brown: rollers at about 182, 62, -58 degrees

  const boreRadius = 3.0;
  const rubberThickness = 0.13;
  const rubberRestInner = boreRadius - rubberThickness;
  // Rolling without slip turns each roller 5.25 times per turn of B, so its
  // quadrant cue repeats exactly at the loop seam.
  const rollerTurnsPerRotorTurn = 5.25;
  const rollerRadius = rubberRestInner / (rollerTurnsPerRotorTurn + 1);
  const rollerPathRadius = rubberRestInner - rollerRadius;
  const casingRadius = 3.5;
  const neckHalfHeight = 0.9;
  const neckEnd = 4.25;
  const channelInner = 0.3;
  const channelOuter = 0.62;
  const vTipRadius = 3.3; // inner surface of the rubber at the clamp
  const vRimAngle = 5.0 * DEG;
  const depth = 1.3;
  const zBack = -depth;
  const backThickness = 0.2;
  const armLayer = [-1.25, -1.05];
  const rollerLayer = [-1.0, -0.07];
  const hubRadius = 0.78;
  const shaftRadius = 0.42;
  const pinRadius = 0.15;
  const samples = 360;
  const blowdownAngle = 10 * DEG;
  const mouthAngle = Math.asin(channelOuter / boreRadius); // far edge of a channel mouth
  const halves = [
    { name: 'upper', inlet: Math.PI, inletChannel: 'left-upper', exhaustChannel: 'right-upper' },
    { name: 'lower', inlet: 0, inletChannel: 'right-lower', exhaustChannel: 'left-lower' },
  ];

  // ---- rest shape of the rubber (inner surface, polar) -------------------------
  const restInner = (theta) => {
    for (const neck of [0, Math.PI]) {
      const delta = Math.abs(wrap(theta - neck + Math.PI) - Math.PI);
      if (delta < vRimAngle) {
        // straight V legs from the rim point to the clamp tip
        const rim = [rubberRestInner * Math.cos(vRimAngle), rubberRestInner * Math.sin(vRimAngle)];
        const tip = [vTipRadius, 0];
        const dx = rim[0] - tip[0];
        const dy = rim[1] - tip[1];
        const c = Math.cos(delta);
        const s = Math.sin(delta);
        // ray r*(c,s) meets tip + k*(dx,dy)
        const denominator = c * dy - s * dx;
        const r = (tip[0] * dy - tip[1] * dx) / denominator;
        return r;
      }
    }
    return rubberRestInner;
  };
  const sampleAngles = Array.from({ length: samples }, (_, i) => i / samples * FULL_TURN);
  const restRadii = sampleAngles.map(restInner);

  const rollerCenters = (rotorAngle) => [0, 1, 2].map((k) => {
    const angle = rotorAngle + k * FULL_TURN / 3;
    return { index: k, angle, center: [rollerPathRadius * Math.cos(angle), rollerPathRadius * Math.sin(angle)] };
  });
  const circleSamples = (center, radius, count = 20) => Array.from({ length: count }, (_, i) => {
    const a = i / count * FULL_TURN;
    return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
  });

  // Spans of each half: [startU, endU] measured clockwise from its inlet, the
  // supports the rubber rests on there, and the steam pressure (1 live, 0
  // exhausted).
  const spansAt = (rotorAngle) => {
    const rollers = rollerCenters(rotorAngle);
    const spans = [];
    for (const half of halves) {
      // A roller still just short of the clamp (u slightly negative) already
      // bears on the rubber this half presses in, so it counts as a support.
      const lead = 25 * DEG;
      const u = (angle) => wrap(half.inlet - angle + lead) - lead;
      const ordered = rollers.map((roller) => ({ ...roller, u: u(roller.angle) })).sort((a, b) => a.u - b.u);
      const tip = [vTipRadius * Math.cos(half.inlet), vTipRadius * Math.sin(half.inlet)];
      const sealIndex = ordered.findIndex((roller) => roller.u >= mouthAngle);
      const first = ordered[sealIndex];
      spans.push({
        half: half.name,
        kind: 'admission',
        key: `roller-${first.index}`,
        from: 0,
        to: Math.min(first.u, Math.PI),
        pressure: 1,
        supports: [tip, ...ordered.slice(0, sealIndex + 1).map((roller) => roller.center)],
      });
      if (first.u < Math.PI) {
        const second = ordered[(sealIndex + 1) % 3];
        const secondU = second.u > first.u ? second.u : second.u + FULL_TURN;
        const past = secondU - (Math.PI - mouthAngle);
        const pressure = past <= 0 ? 1 : 1 - THREE.MathUtils.smootherstep(past / blowdownAngle, 0, 1);
        spans.push({
          half: half.name,
          kind: past <= 0 ? 'expanding-sealed-pocket' : 'exhausting',
          key: secondU < Math.PI ? `roller-${second.index}` : `end-${half.name}`,
          from: first.u,
          to: Math.min(secondU, Math.PI),
          pressure,
          supports: [first.center, second.center],
        });
        if (secondU < Math.PI) {
          spans.push({ half: half.name, kind: 'exhausted', key: `end-${half.name}`, from: secondU, to: Math.PI, pressure: 0, supports: [] });
        }
      }
      for (const span of spans.filter((s) => s.half === half.name)) {
        span.inlet = half.inlet;
        span.thetaFrom = half.inlet - span.from;
        span.thetaTo = half.inlet - span.to;
      }
    }
    return { rollers, spans };
  };

  const innerRadiiAt = (rotorAngle, out = new Float64Array(samples)) => {
    const { spans } = spansAt(rotorAngle);
    for (let i = 0; i < samples; i += 1) out[i] = restRadii[i];
    for (const span of spans) {
      if (!(span.pressure > 1e-4) || !span.supports.length) continue;
      const points = span.supports.flatMap((support, index) => (
        index === 0 && span.kind === 'admission' ? [support]
          // circumscribed polygon, so the sampled rubber never cuts a roller
          : circleSamples(support, rollerRadius / Math.cos(Math.PI / 48) + 0.002, 48)
      ));
      const hull = convexHull(points);
      for (let i = 0; i < samples; i += 1) {
        const u = wrap(span.inlet - sampleAngles[i]);
        if (u < span.from - 1e-9 || u > span.to + 1e-9) continue;
        const far = farRadiusAlongRay(hull, sampleAngles[i]);
        if (!Number.isFinite(far)) continue;
        const target = Math.min(far, restRadii[i]);
        out[i] = restRadii[i] - span.pressure * (restRadii[i] - target);
      }
    }
    return out;
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const rotorAngle = sourceRotorAngle + rotorAngularSpeed * cycleTime;
    return {
      cycleTime,
      phase: cycleTime / cycleDuration,
      rotorAngle,
      rotorAngularSpeed,
      // rolling without slip on the rubber: absolute roller angle
      rollerAngle: -rotorAngularSpeed * (rollerPathRadius / rollerRadius) * cycleTime,
      ...spansAt(rotorAngle),
    };
  };

  // ---- casing -------------------------------------------------------------------
  const footTop = -3.1;
  const footBottom = -3.52;
  const footHalfWidth = 2.9;
  const circle = { center: [0, 0], radius: casingRadius };
  const neckFillet = (sideX, lineY) => lineCircleFillet(
    { point: [sideX * neckEnd, lineY], direction: [1, 0], side: lineY > 0 ? 1 : -1 },
    circle, 0.55, { hint: [sideX * 3.6, lineY + Math.sign(lineY) * 0.6] },
  );
  const footFillet = (sideX) => lineCircleFillet(
    { point: [sideX * footHalfWidth, footTop], direction: [1, 0], side: 1 },
    circle, 0.6, { hint: [sideX * 2.2, -2.5] },
  );
  const rightFoot = footFillet(1);
  const rightNeckLow = neckFillet(1, -neckHalfHeight);
  const rightNeckHigh = neckFillet(1, neckHalfHeight);
  const leftNeckHigh = neckFillet(-1, neckHalfHeight);
  const leftNeckLow = neckFillet(-1, -neckHalfHeight);
  const leftFoot = footFillet(-1);
  const outerOutline = ringPolygon([
    [-footHalfWidth, footBottom], [footHalfWidth, footBottom], [footHalfWidth, footTop],
    ...rightFoot.points,
    ...arcBetween([0, 0], casingRadius, angleOf(rightFoot.onCircle), angleOf(rightNeckLow.onCircle)).slice(1, -1),
    ...rightNeckLow.points.slice().reverse(),
    [neckEnd, -neckHalfHeight], [neckEnd, neckHalfHeight],
    ...rightNeckHigh.points,
    ...arcBetween([0, 0], casingRadius, angleOf(rightNeckHigh.onCircle), angleOf(leftNeckHigh.onCircle)).slice(1, -1),
    ...leftNeckHigh.points.slice().reverse(),
    [-neckEnd, neckHalfHeight], [-neckEnd, -neckHalfHeight],
    ...leftNeckLow.points,
    ...arcBetween([0, 0], casingRadius, angleOf(leftNeckLow.onCircle), angleOf(leftFoot.onCircle)).slice(1, -1),
    ...leftFoot.points.slice().reverse(),
    [-footHalfWidth, footTop],
  ]);

  // rubber rest outer surface to size the clamp faces
  const restOuterTipRadius = vTipRadius + rubberThickness / Math.sin(Math.atan2(
    rubberRestInner * Math.sin(vRimAngle), vTipRadius - rubberRestInner * Math.cos(vRimAngle),
  ));
  const clampFace = restOuterTipRadius + 0.004;
  const neckCavity = (sideX) => polygonClipping.union(
    ringPolygon([[sideX * (boreRadius - 0.2), channelInner], [sideX * (neckEnd + 0.1), channelInner],
      [sideX * (neckEnd + 0.1), channelOuter], [sideX * (boreRadius - 0.2), channelOuter]]),
    ringPolygon([[sideX * (boreRadius - 0.2), -channelOuter], [sideX * (neckEnd + 0.1), -channelOuter],
      [sideX * (neckEnd + 0.1), -channelInner], [sideX * (boreRadius - 0.2), -channelInner]]),
    ringPolygon([[sideX * (boreRadius - 0.2), -channelInner], [sideX * clampFace, -channelInner],
      [sideX * clampFace, channelInner], [sideX * (boreRadius - 0.2), channelInner]]),
  );
  const cavity = polygonClipping.union(circlePolygon([0, 0], boreRadius, 240), neckCavity(-1), neckCavity(1));
  const casingOutline = polygonClipping.difference(outerOutline, cavity);

  const frameMaterial = matte(PALETTE.frame, { metalness: 0.24, roughness: 0.54 });
  const backMaterial = matte(0x7d8786, { metalness: 0.18, roughness: 0.6 });
  const rubberMaterial = matte(0x2f2b29, { metalness: 0.02, roughness: 0.86 });
  const armMaterial = matte(PALETTE.driven, { metalness: 0.22, roughness: 0.46 });
  const rollerMaterial = matte(PALETTE.driver, { metalness: 0.2, roughness: 0.48 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.3, roughness: 0.43 });

  const casing = sectionPlate(casingOutline, zBack, 0, frameMaterial,
    'sectioned-round-casing-with-two-channel-necks-and-foot');
  root.add(casing);
  const backCover = sectionPlate(polygonClipping.difference(outerOutline, circlePolygon([0, 0], shaftRadius + 0.01, 64)),
    zBack - backThickness, zBack, backMaterial, 'solid-back-of-casing');
  backCover.material = [backMaterial, backMaterial];
  root.add(backCover);

  // ---- rubber lining E (deforming) ----------------------------------------------------
  const rubberGeometry = new THREE.BufferGeometry();
  const rubberPositions = new Float32Array(samples * 8 * 3);
  const rubberNormals = new Float32Array(samples * 8 * 3);
  rubberGeometry.setAttribute('position', new THREE.BufferAttribute(rubberPositions, 3).setUsage(THREE.DynamicDrawUsage));
  rubberGeometry.setAttribute('normal', new THREE.BufferAttribute(rubberNormals, 3).setUsage(THREE.DynamicDrawUsage));
  const rubberIndex = [];
  // vertex blocks: 0 front-inner, 1 front-outer, 2 back-inner, 3 back-outer,
  // 4 inner-side front, 5 inner-side back, 6 outer-side front, 7 outer-side back
  const v = (block, i) => block * samples + (i % samples);
  for (let i = 0; i < samples; i += 1) {
    const j = i + 1;
    rubberIndex.push(v(0, i), v(1, i), v(1, j), v(0, i), v(1, j), v(0, j)); // front (+z)
    rubberIndex.push(v(2, i), v(3, j), v(3, i), v(2, i), v(2, j), v(3, j)); // back
    rubberIndex.push(v(4, i), v(4, j), v(5, j), v(4, i), v(5, j), v(5, i)); // inner side (faces centre)
    rubberIndex.push(v(6, i), v(7, j), v(6, j), v(6, i), v(7, i), v(7, j)); // outer side
  }
  rubberGeometry.setIndex(rubberIndex);
  const rubberZ = [zBack + 0.004, -0.004];
  const rubber = new THREE.Mesh(rubberGeometry, rubberMaterial);
  rubber.userData.role = 'india-rubber-lining-E-pressed-in-against-rollers';
  rubber.userData.deformingMesh = true;
  root.add(rubber);
  const innerRadii = new Float64Array(samples);
  const innerPoints = Array.from({ length: samples }, () => [0, 0]);
  const outerPoints = Array.from({ length: samples }, () => [0, 0]);
  const updateRubber = (rotorAngle) => {
    innerRadiiAt(rotorAngle, innerRadii);
    for (let i = 0; i < samples; i += 1) {
      innerPoints[i][0] = innerRadii[i] * Math.cos(sampleAngles[i]);
      innerPoints[i][1] = innerRadii[i] * Math.sin(sampleAngles[i]);
    }
    for (let i = 0; i < samples; i += 1) {
      const a = innerPoints[(i + samples - 2) % samples];
      const b = innerPoints[(i + 2) % samples];
      let nx = b[1] - a[1];
      let ny = -(b[0] - a[0]);
      const length = Math.hypot(nx, ny) || 1;
      nx /= length; ny /= length;
      if (nx * innerPoints[i][0] + ny * innerPoints[i][1] < 0) { nx = -nx; ny = -ny; }
      outerPoints[i][0] = innerPoints[i][0] + nx * rubberThickness;
      outerPoints[i][1] = innerPoints[i][1] + ny * rubberThickness;
      // keep the outer face on or inside the bore (it rests there)
      const r = Math.hypot(outerPoints[i][0], outerPoints[i][1]);
      const limit = restInner(sampleAngles[i]) === rubberRestInner ? boreRadius - 0.002 : Infinity;
      if (r > limit) { outerPoints[i][0] *= limit / r; outerPoints[i][1] *= limit / r; }
      const set = (block, point, z, n) => {
        const k = v(block, i) * 3;
        rubberPositions[k] = point[0]; rubberPositions[k + 1] = point[1]; rubberPositions[k + 2] = z;
        rubberNormals[k] = n[0]; rubberNormals[k + 1] = n[1]; rubberNormals[k + 2] = n[2];
      };
      set(0, innerPoints[i], rubberZ[1], [0, 0, 1]);
      set(1, outerPoints[i], rubberZ[1], [0, 0, 1]);
      set(2, innerPoints[i], rubberZ[0], [0, 0, -1]);
      set(3, outerPoints[i], rubberZ[0], [0, 0, -1]);
      set(4, innerPoints[i], rubberZ[1], [-nx, -ny, 0]);
      set(5, innerPoints[i], rubberZ[0], [-nx, -ny, 0]);
      set(6, outerPoints[i], rubberZ[1], [nx, ny, 0]);
      set(7, outerPoints[i], rubberZ[0], [nx, ny, 0]);
    }
    rubberGeometry.attributes.position.needsUpdate = true;
    rubberGeometry.attributes.normal.needsUpdate = true;
    rubberGeometry.computeBoundingSphere();
  };

  // ---- arms B and rollers A ---------------------------------------------------------------
  const rotor = new THREE.Group();
  rotor.userData.role = 'arms-B-on-main-shaft-carrying-rollers-A';
  const armOutline = polygonClipping.union(
    circlePolygon([0, 0], hubRadius, 64),
    ...[0, 1, 2].map((k) => {
      const a = k * FULL_TURN / 3;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const pts = [[0.2, -0.36], [rollerPathRadius, -0.2], [rollerPathRadius, 0.2], [0.2, 0.36]];
      return ringPolygon(pts.map(([x, y]) => [x * c - y * s, x * s + y * c]));
    }),
    ...[0, 1, 2].map((k) => circlePolygon([
      rollerPathRadius * Math.cos(k * FULL_TURN / 3), rollerPathRadius * Math.sin(k * FULL_TURN / 3),
    ], 0.3, 32)),
  );
  const arms = partPlate(polygonClipping.difference(armOutline, circlePolygon([0, 0], shaftRadius, 48)),
    armLayer[0], armLayer[1], armMaterial, 'three-armed-spider-B');
  rotor.add(arms);
  const shaftB = new THREE.Mesh(latheSectionGeometry(
    [[0, zBack - backThickness - 0.8], [shaftRadius, zBack - backThickness - 0.8], [shaftRadius, -0.01], [0, -0.01]],
    { segments: 48, phiStart: 0, phiLength: FULL_TURN },
  ), darkMaterial);
  shaftB.rotation.x = Math.PI / 2;
  shaftB.userData.role = 'main-shaft-B';
  rotor.add(shaftB);
  const rollers = [];
  for (let k = 0; k < 3; k += 1) {
    const a = k * FULL_TURN / 3;
    const center = [rollerPathRadius * Math.cos(a), rollerPathRadius * Math.sin(a)];
    // the pin starts inside the arm (no face flush with the arm's back)
    const pinBack = armLayer[0] + 0.03;
    const pinFront = -0.04;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, pinFront - pinBack, 24), darkMaterial);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(center[0], center[1], (pinBack + pinFront) / 2);
    pin.userData.role = `roller-A-${k + 1}-pin-on-arm`;
    rotor.add(pin);
    const roller = new THREE.Group();
    roller.position.set(center[0], center[1], 0);
    roller.userData.role = `roller-A-${k + 1}`;
    const body = new THREE.Mesh(latheSectionGeometry(
      [[pinRadius + 0.01, rollerLayer[0]], [rollerRadius, rollerLayer[0]], [rollerRadius, rollerLayer[1]], [pinRadius + 0.01, rollerLayer[1]]],
      { segments: 64, phiStart: 0, phiLength: FULL_TURN },
    ), rollerMaterial);
    body.rotation.x = Math.PI / 2;
    body.userData.role = `roller-A-${k + 1}-rolling-on-rubber`;
    roller.add(body);
    rotor.add(roller);
    rollers.push(roller);
  }
  root.add(rotor);
  // the rollers take the shared quadrant cue from src/data/rotation-indicators.js

  // ---- steam ------------------------------------------------------------------------------
  const steamZ = [zBack + 0.012, -0.012];
  // One steam volume per span, keyed by the roller that closes it (or by
  // the half it ends in), so each changes shape smoothly as B turns.
  const steamKeys = ['roller-0', 'roller-1', 'roller-2', 'end-upper', 'end-lower'];
  const steamMeshes = steamKeys.map((key) => {
    const mesh = steamVolume(`steam-space-between-rubber-and-bore-${key}`, steamZ[0], steamZ[1], { sealed: true });
    root.add(mesh);
    return mesh;
  });
  // The cavity seen from the shaft: first boundary crossing along each
  // sample ray (bore, clamp face or channel end), plus the few channel
  // corners no ray reaches (static pieces, assigned to the span holding them).
  const steamCavity = polygonClipping.intersection(cavity, outerOutline);
  const cavityRings = steamCavity.flatMap((polygon) => polygon);
  const cavityRadius = sampleAngles.map((angle) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let best = Infinity;
    for (const ring of cavityRings) {
      for (let i = 0; i + 1 < ring.length; i += 1) {
        const a = ring[i];
        const b = ring[i + 1];
        const ex = b[0] - a[0];
        const ey = b[1] - a[1];
        const denominator = dx * ey - dy * ex;
        if (Math.abs(denominator) < 1e-12) continue;
        const t = (a[0] * ey - a[1] * ex) / denominator;
        const u = (a[0] * dy - a[1] * dx) / denominator;
        if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
      }
    }
    return best;
  });
  // The spans reach out only to the bore (and into the clamp notch); the four
  // channels beyond the bore are drawn as their own steady volumes: the
  // admitting channels always live, the exhausting ones faint.
  for (let i = 0; i < samples; i += 1) {
    const nearNeck = Math.abs(Math.sin(sampleAngles[i])) < Math.sin(vRimAngle) * 0.999;
    if (!nearNeck) cavityRadius[i] = Math.min(cavityRadius[i], boreRadius);
  }
  const starRegion = ringPolygon(sampleAngles.map((angle, i) => [cavityRadius[i] * Math.cos(angle), cavityRadius[i] * Math.sin(angle)]));
  const channelMeshes = safeClip('difference', steamCavity, starRegion)
    .filter((polygon) => multiArea([polygon]) > 1e-4)
    .map((polygon) => {
      const ring = polygon[0];
      const cx = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
      const cy = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
      const admitting = (cx < 0 && cy > 0) || (cx > 0 && cy < 0);
      const name = `${cx < 0 ? 'left' : 'right'}-${cy > 0 ? 'upper' : 'lower'}`;
      const mesh = steamVolume(`steam-in-${name}-${admitting ? 'admission' : 'exhaust'}-channel`, steamZ[0], steamZ[1], { sealed: true });
      mesh.userData.steamChannel = { region: [polygon], pressure: admitting ? 1 : 0 };
      root.add(mesh);
      return mesh;
    });
  const hiddenCorners = [];
  const steamReport = { spans: [] };
  // Steam is drawn in intervals cut at every roller (sealing or not), each
  // keyed by the roller that ends it, so no volume ever jumps: a roller
  // entering a half starts a new interval from nothing.
  const drawIntervals = (rollers, spans) => {
    const intervals = [];
    for (const half of halves) {
      const own = spans.filter((span) => span.half === half.name);
      const cuts = rollers.map((roller) => ({ index: roller.index, u: wrap(half.inlet - roller.angle) }))
        .filter((cut) => cut.u > 1e-9 && cut.u < Math.PI).sort((a, b) => a.u - b.u);
      let from = 0;
      for (const cut of [...cuts, { index: -1, u: Math.PI }]) {
        const middle = (from + cut.u) / 2;
        const source = own.find((span) => middle >= span.from - 1e-9 && middle <= span.to + 1e-9) ?? own.at(-1);
        intervals.push({
          half: half.name,
          kind: source.kind,
          key: cut.index >= 0 ? `roller-${cut.index}` : `end-${half.name}`,
          from,
          to: cut.u,
          pressure: source.pressure,
          inlet: half.inlet,
          thetaFrom: half.inlet - from,
          thetaTo: half.inlet - cut.u,
        });
        from = cut.u;
      }
    }
    return intervals;
  };
  const updateSteam = (rollers, spans) => {
    steamReport.spans = [];
    const used = new Set();
    const entries = [];
    drawIntervals(rollers, spans).forEach((span) => {
      const mesh = steamMeshes[steamKeys.indexOf(span.key)];
      used.add(mesh);
      const region = [];
      // an exhausted space has the rubber back on the bore: its thin band
      // fades out with the pressure
      const visibility = THREE.MathUtils.smoothstep(span.pressure, 0, 0.15);
      if (span.to - span.from > 1e-4 && visibility > 1e-3) {
        const outer = [];
        const inner = [];
        const step = FULL_TURN / samples;
        const i0 = Math.ceil(span.thetaTo / step);
        const i1 = Math.floor(span.thetaFrom / step);
        for (let k = i0; k <= i1; k += 1) {
          const i = ((k % samples) + samples) % samples;
          const angle = k * step;
          outer.push([cavityRadius[i] * Math.cos(angle), cavityRadius[i] * Math.sin(angle)]);
          inner.push(outerPoints[i]);
        }
        // Near a clamp the rubber's V leg lies beyond the cavity outline, so
        // the sampled ring folds over itself and out into the channel: keep
        // only its part inside the cavity outline (no steam drawn twice).
        if (outer.length >= 2) {
          region.push(...safeClip('intersection', safeClip('union', [[[...outer, ...inner.reverse(), outer[0]]]]), starRegion)
            .filter((polygon) => multiArea([polygon]) > 1e-6));
        }
        for (const corner of hiddenCorners) {
          const u = wrap(span.inlet - corner.angle);
          if (u >= span.from && u <= span.to) region.push(corner.polygon);
        }
      }
      entries.push({ mesh, region, pressure: span.pressure, visibility, span });
    });
    for (const mesh of steamMeshes) if (!used.has(mesh)) entries.push({ mesh, region: [], pressure: 0 });
    // Set together, so a span and the channel it opens into draw as one
    // closed body of steam (no sheet across the channel mouth).
    setSteamRegions([...entries, ...channelMeshes.map((mesh) => ({ mesh, ...mesh.userData.steamChannel }))]);
    for (const { mesh, span } of entries) {
      if (span) steamReport.spans.push({ half: span.half, kind: span.kind, key: span.key, pressure: span.pressure, area: mesh.userData.area, from: span.from, to: span.to });
    }
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.rotorAngle;
    for (const roller of rollers) roller.rotation.z = state.rollerAngle - state.rotorAngle;
    updateRubber(state.rotorAngle);
    updateSteam(state.rollers, state.spans);
  };

  root.userData = {
    animationTiming: { authoredCyclePeriod: cycleDuration, targetCycleDuration: 6 },
    archetype: 'three-arm-clockwise-rotor-with-counterspinning-rollers-on-a-steam-deformed-rubber-lining',
    blocks: { casing, backCover, rubber, rotor, arms, shaftB, rollers, steamMeshes, channelMeshes },
    degreesOfFreedom: { independentPrescribedInputs: 1, operatingDegreesOfFreedom: 1 },
    dynamics: {
      rubberShape: 'Where steam stands behind the rubber it is drawn taut against the rollers (outward face of the convex hull of its clamp and supporting rollers); where the space is exhausted it lies on the bore. Blowdown after a roller passes the exhaust channel is a smooth 10-degree fade, not a flow solution.',
      pressureForcesElasticityLeakageAndFrictionModeled: false,
    },
    fidelity: 'authored',
    geometry: {
      cycleDuration,
      boreRadius, rubberThickness, rollerRadius, rollerPathRadius, casingRadius, channelInner, channelOuter,
      vTipRadius, vRimAngle, mouthAngle, depth, samples, cavity, casingOutline,
    },
    innerRadiiAt,
    restRadii,
    sampleAngles,
    mechanism: 'Rubber lining E is clamped into the middle of each neck, between the neck’s two channels, dividing the steam space behind it into halves. Steam from the left neck’s upper channel and the right neck’s lower channel presses the rubber in against the rollers A behind the leading roller of each half; the rollers seal the space by pinching the rubber on the bore, so the space expands as B turns clockwise. Past the far neck’s channel the space exhausts and the rubber returns to the bore.',
    motion: { cycleDuration, rotorAngularSpeed, rollerAngularSpeed: -rotorAngularSpeed * rollerPathRadius / rollerRadius },
    sourceAnimation: {
      available: false,
      reason: 'The official Movement 428 page has no animation; the working was reconstructed from Brown’s plate and caption.',
    },
    sourceReference: {
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 428',
      brownPlate428: { imageWidth: 525, imageHeight: 525, shaftBCenterPixels: [262, 258], borePixels: 160, rollerPathPixels: 118, rollerRadiusPixels: 22 },
      reconstructionDisclosure: 'Brown does not say which channels admit and which exhaust; his two clockwise arrows, the bulged rubber behind the top and bottom rollers and the rubber lying on the bore elsewhere fix the arrangement used. The clamp into each neck follows his V-shaped rubber at the necks. Dimensions, the taut-hull rubber law, the blowdown fade and the six-second turn are engineered.',
    },
    spansAt,
    stateAtTime,
    steamReport,
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0.08, 0.05, 1);
  root.userData.cameraFov = 8;
  update(0);
  markShadows(root);
  for (const mesh of [...steamMeshes, ...channelMeshes]) { mesh.castShadow = false; mesh.receiveShadow = false; }
  rubber.castShadow = true;
  fitPistonGuide(root, update, cycleDuration);
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

export function createAuthoredRubberLinedRotaryEngineMovement(movement) {
  if (movement.id !== 428) return null;
  return rubberLinedRotaryEngine(movement);
}
