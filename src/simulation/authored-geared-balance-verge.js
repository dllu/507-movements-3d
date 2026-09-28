import * as THREE from 'three';
import { PALETTE, makeGear, markShadows, matte } from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Brown's 298: balance C on a vertical staff whose pinion drives a crown wheel
// (the drum, geared like Movement 26) on a horizontal arbor. That arbor carries
// two tilted loops over the top of a face-on saw-tooth escape wheel. At the top
// the teeth move along the arbor, so each loop's lowest arc is a short helical
// pallet: a tooth corner pushing it turns the arbor. The two working arcs are
// mirror images through the vertical plane of the arbor (one works behind the
// wheel's mid-plane, one in front), so they drive the arbor opposite ways while
// both loops lean alike in the front view, tops to the left, as Brown draws
// them. Each pallet releases where its wire lifts off under the arbor. Coordinates: x right, y up, z toward the viewer;
// 0.03 model units per source pixel, origin at source (150, 276), the arbor axis.
const SCALE = 0.03;
const source = (px, py) => new THREE.Vector2((px - 150) * SCALE, (276 - py) * SCALE);

// Closed solid from a map of the unit cube [0,1]^3 sampled nu x nv x 1. Faces
// are emitted outward in parameter space, then the whole mesh is flipped if
// the map reverses orientation, so every face shares one outward winding.
const CROWN_TOOTH_HALF_WIDTH = 0.072;
const CROWN_TOOTH_DRAFT_DEG = 8;
const CROWN_TOOTH_RADIAL_WIDTH = 0.24;

function cylinder(radius, length, axis, material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, axis);
  return mesh;
}

function gearedBalanceVergeEscapement(movement) {
  const root = new THREE.Group();
  const steel = matte(PALETTE.ink, { metalness: 0.3, roughness: 0.45 });
  const brass = matte(PALETTE.brass, { metalness: 0.2, roughness: 0.5 });
  const wheelMaterial = matte(PALETTE.driven, { metalness: 0.12, roughness: 0.6 });
  const balanceMaterial = matte(PALETTE.driver, { metalness: 0.12, roughness: 0.6 });
  const crownMaterial = matte(PALETTE.accent, { metalness: 0.16, roughness: 0.55 });

  // Escape wheel: 26 saw teeth turning counterclockwise (Brown's arrow rises
  // on the right), so the top teeth travel toward -x along the arbor. Each
  // tooth has a radial leading face and a straight sloped back, as drawn.
  const escapeCenter = new THREE.Vector2(source(108.4, 0).x, source(0, 364.8).y);
  const toothCount = 26;
  const pitch = FULL_TURN / toothCount;
  const tipRadius = 2.45;
  const rootRadius = 2.13;
  const wheelThickness = 0.1;
  const halfThickness = wheelThickness / 2;

  // Arbor and the two wire-loop pallets. Each loop is a round wire whose lower
  // working arc is a short helix about the arbor (x = c + side * p * delta in
  // the arbor frame); the tooth's leading face pushes the wire along the arbor
  // and so turns it. The rest of the loop rises at the arc ends and is wrapped
  // over the top of the arbor, soldered to it.
  const arborY = 0;
  const arborRadius = 0.13;
  const arborAmplitude = THREE.MathUtils.degToRad(34);
  const releaseAngle = THREE.MathUtils.degToRad(5);
  const helixPitch = 0.22;
  const wireRadius = 0.035;
  const contactClearance = 0.002;
  const contactDistance = wireRadius + contactClearance;
  // The wire's centre runs just above the nominal tip corner, so the corner
  // meets the lower half of the wire and the wire lifts clear on release.
  const wireLift = 0.005;
  const topRadius = arborRadius + wireRadius - 0.012;
  // Brown's loops stand well clear above the rod: the top of each loop's
  // wire centreline is this far from the arbor axis.
  const loopTop = 0.41;
  // Brown's loops lean with their tops to the left: measured on the plate the
  // loop axis runs about 0.34 px left per px of rise.
  const brownLoopLean = 0.34;

  // Signed distance from a wire-centreline point to the leading face (and tip
  // corner) of the tooth whose tip is at world angle phi: positive when the
  // point lies ahead of the face.
  const faceDistance = (phi, wx, wy, wz) => {
    const px = wx - escapeCenter.x, py = wy - escapeCenter.y;
    const c = Math.cos(phi), s = Math.sin(phi);
    const along = px * c + py * s;
    const perp = -px * s + py * c;
    const excessRadial = along - THREE.MathUtils.clamp(along, rootRadius, tipRadius);
    const excessAxial = Math.max(0, Math.abs(wz) - halfThickness);
    // Behind the face and within its extent: inside the tooth.
    if (perp < 0 && excessRadial === 0 && excessAxial === 0) return perp;
    return Math.sqrt(perp * perp + excessRadial * excessRadial + excessAxial * excessAxial);
  };
  const GOLDEN = (Math.sqrt(5) - 1) / 2;
  // Smallest signed distance between the helix centreline (arbor angle theta)
  // and the tooth face: golden-section search over the arbor-frame angle.
  const helixGap = (loop, theta, phi) => {
    const f = (delta) => faceDistance(
      phi,
      loop.center + loop.side * helixPitch * delta,
      -loop.rho * Math.cos(delta - theta),
      loop.rho * Math.sin(delta - theta),
    );
    let a = theta - 0.7, b = theta + 0.7;
    let x1 = b - GOLDEN * (b - a), x2 = a + GOLDEN * (b - a);
    let f1 = f(x1), f2 = f(x2);
    for (let iteration = 0; iteration < 70; iteration += 1) {
      if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - GOLDEN * (b - a); f1 = f(x1); }
      else { a = x1; x1 = x2; f1 = f2; x2 = a + GOLDEN * (b - a); f2 = f(x2); }
    }
    const delta = (a + b) / 2;
    return { delta, gap: f(delta) };
  };
  // Tip angle of the tooth that touches the loop at arbor angle theta.
  const solveTip = (loop, theta) => {
    // Advance the tooth from well behind the wire to the first touch, then
    // bisect.
    let low = loop.nominalTip - 0.4, high = low;
    while (helixGap(loop, theta, high).gap > contactDistance) {
      low = high;
      high += 0.02;
      if (high > loop.nominalTip + 0.4) throw new Error('298: loop out of reach of the teeth');
    }
    for (let iteration = 0; iteration < 56; iteration += 1) {
      const middle = (low + high) / 2;
      if (helixGap(loop, theta, middle).gap > contactDistance) low = middle; else high = middle;
    }
    return (low + high) / 2;
  };
  // Natural cubic spline of the tip angle over a loop's contact range, for
  // smooth playback with exact first and second derivatives.
  const spline = (xs, ys) => {
    const n = xs.length, h = xs[1] - xs[0];
    const m = new Float64Array(n), c = new Float64Array(n), d = new Float64Array(n);
    for (let i = 1; i < n - 1; i += 1) {
      const w = 4 - (i > 1 ? c[i - 1] : 0);
      c[i] = 1 / w;
      d[i] = (6 * (ys[i + 1] - 2 * ys[i] + ys[i - 1]) / (h * h) - (i > 1 ? d[i - 1] : 0)) / w;
    }
    for (let i = n - 2; i >= 1; i -= 1) m[i] = d[i] - c[i] * m[i + 1];
    return (x) => {
      const i = THREE.MathUtils.clamp(Math.floor((x - xs[0]) / h), 0, n - 2);
      const t = x - xs[i], u = xs[i + 1] - x;
      const value = m[i] * u ** 3 / (6 * h) + m[i + 1] * t ** 3 / (6 * h)
        + (ys[i] / h - m[i] * h / 6) * u + (ys[i + 1] / h - m[i + 1] * h / 6) * t;
      const slope = -m[i] * u ** 2 / (2 * h) + m[i + 1] * t ** 2 / (2 * h)
        - (ys[i] / h - m[i] * h / 6) + (ys[i + 1] / h - m[i + 1] * h / 6);
      const curvature = (m[i] * u + m[i + 1] * t) / h;
      return { value, slope, curvature };
    };
  };
  // Each loop's wire runs at the depth of the tooth tip at its nominal
  // station.
  const makeLoop = (side, center, tabulate = true) => {
    const nominalTip = Math.acos(THREE.MathUtils.clamp((center - escapeCenter.x) / tipRadius, -1, 1));
    const tipDepth = arborY - (escapeCenter.y + tipRadius * Math.sin(nominalTip));
    const loop = { center, nominalTip, rho: tipDepth - wireLift, side };
    if (!tabulate) return loop;
    // Pallet 1 (side -1) drives while the arbor rises from -A to +release;
    // pallet 2 (side +1) while it falls from +A to -release.
    const low = side < 0 ? -arborAmplitude - 0.02 : -releaseAngle - 0.02;
    const high = side < 0 ? releaseAngle + 0.02 : arborAmplitude + 0.02;
    const count = 241;
    const thetas = Array.from({ length: count }, (_, i) => low + (high - low) * i / (count - 1));
    loop.tip = spline(thetas, thetas.map((theta) => solveTip(loop, theta)));
    loop.contactDelta = (theta) => helixGap(loop, theta, loop.tip(theta).value).delta;
    return loop;
  };
  const pallet1X = source(90, 0).x;
  // The second loop's station makes the two drops equal.
  const drops = (loop1, loop2) => ({
    first: loop2.tip(arborAmplitude).value + pitch - loop1.tip(releaseAngle).value,
    second: loop1.tip(-arborAmplitude).value - loop2.tip(-releaseAngle).value,
  });
  const loop1 = makeLoop(-1, pallet1X);
  let lowX = pallet1X + 0.2, highX = pallet1X + 0.8;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const middle = (lowX + highX) / 2;
    const candidate = makeLoop(1, middle, false);
    const first = solveTip(candidate, arborAmplitude) + pitch - loop1.tip(releaseAngle).value;
    const second = loop1.tip(-arborAmplitude).value - solveTip(candidate, -releaseAngle);
    if (first > second) lowX = middle; else highX = middle;
  }
  const pallet2X = (lowX + highX) / 2;
  const loop2 = makeLoop(1, pallet2X);
  const dropAngles = drops(loop1, loop2);
  const loops = { [-1]: loop1, [1]: loop2 };

  const period = 4;
  const omega = FULL_TURN / period;
  const phaseAtAngle = (angle, rising) => {
    const base = Math.acos(THREE.MathUtils.clamp(-angle / arborAmplitude, -1, 1));
    return (rising ? base : FULL_TURN - base) / omega;
  };
  // Each tooth lands as the arbor reverses, when the catching loop has come
  // back as far as it goes, so the wheel never recoils: it only slows to rest
  // for an instant and turns on counterclockwise.
  const times = {
    release1: phaseAtAngle(releaseAngle, true),
    catch2: period / 2,
    release2: phaseAtAngle(-releaseAngle, false),
    catch1: period,
  };
  const arborAt = (time) => ({
    angle: -arborAmplitude * Math.cos(omega * time),
    speed: arborAmplitude * omega * Math.sin(omega * time),
    acceleration: arborAmplitude * omega ** 2 * Math.cos(omega * time),
  });
  const contactState = (side, time, offset) => {
    const arbor = arborAt(time);
    const tip = loops[side].tip(arbor.angle);
    return {
      angle: tip.value + offset - Math.PI / 2,
      speed: tip.slope * arbor.speed,
      acceleration: tip.curvature * arbor.speed ** 2 + tip.slope * arbor.acceleration,
    };
  };
  // Drops: from the release state (angle, speed, acceleration) to the
  // landing angle, arriving at rest just as the catching loop reverses. The
  // speed is (1 - u)^2 (V0 + (2 V0 + A0) u + K u^2): it starts at the release
  // speed and acceleration, never goes negative, and reaches zero with zero
  // slope, so the wheel only ever turns counterclockwise.
  const dropCurve = (start, endAngle, t0, t1, time) => {
    const span = t1 - t0, u = (time - t0) / span;
    const V0 = start.speed * span, A0 = start.acceleration * span ** 2;
    // Match the release acceleration unless that would make the speed dip
    // below zero before landing (q(1) >= 0).
    const b = Math.min(2 * V0 + A0, 20 * (endAngle - start.angle) - 6 * V0);
    const K = 30 * (endAngle - start.angle - V0 / 3 - b / 12);
    // Integral of (1 - u)^2 (V0 + b u + K u^2).
    const w = 1 - u;
    const q = V0 + b * u + K * u * u;
    const integral = (x) => V0 * (x - x ** 2 + x ** 3 / 3)
      + b * (x ** 2 / 2 - 2 * x ** 3 / 3 + x ** 4 / 4)
      + K * (x ** 3 / 3 - x ** 4 / 2 + x ** 5 / 5);
    return { angle: start.angle + integral(u), speed: w * w * q / span, acceleration: 0 };
  };
  const stateAtTime = (time) => {
    const cycle = Math.floor(time / period);
    const local = time - cycle * period;
    const arbor = arborAt(local);
    const base = cycle * pitch;
    let wheel, stage, activePallet = null;
    if (local < times.release1) {
      wheel = contactState(-1, local, base); stage = 'pallet-1-impulse'; activePallet = 1;
    } else if (local < times.catch2) {
      wheel = dropCurve(contactState(-1, times.release1, base), contactState(1, times.catch2, base + pitch).angle,
        times.release1, times.catch2, local); stage = 'drop-to-pallet-2';
    } else if (local < times.release2) {
      wheel = contactState(1, local, base + pitch); stage = 'pallet-2-impulse'; activePallet = 2;
    } else {
      wheel = dropCurve(contactState(1, times.release2, base + pitch), contactState(-1, times.catch1, base + pitch).angle,
        times.release2, times.catch1, local); stage = 'drop-to-pallet-1';
    }
    return {
      activePallet,
      arborAngle: arbor.angle,
      arborSpeed: arbor.speed,
      balanceAngle: arbor.angle * gearRatio,
      balanceSpeed: arbor.speed * gearRatio,
      stage,
      wheelAngle: wheel.angle,
      wheelSpeed: wheel.speed,
    };
  };

  // Escape wheel solid: saw teeth and Brown's four lens-shaped crossings,
  // each a vesica of two circular arcs.
  const wheelShape = new THREE.Shape();
  for (let index = 0; index < toothCount; index += 1) {
    const tip = Math.PI / 2 + index * pitch;
    const back = new THREE.Vector2(Math.cos(tip - pitch) * rootRadius, Math.sin(tip - pitch) * rootRadius);
    const top = new THREE.Vector2(Math.cos(tip) * tipRadius, Math.sin(tip) * tipRadius);
    const foot = new THREE.Vector2(Math.cos(tip) * rootRadius, Math.sin(tip) * rootRadius);
    if (index === 0) wheelShape.moveTo(back.x, back.y);
    wheelShape.lineTo(top.x, top.y);
    wheelShape.lineTo(foot.x, foot.y);
  }
  wheelShape.closePath();
  // Each lens lies across a radius: centre radius, half length along the
  // tangent and half width across it, measured from the plate.
  const lensCentre = 1.45, lensHalfLength = 0.85, lensHalfWidth = 0.34;
  const lensInner = lensCentre - lensHalfWidth, lensOuter = lensCentre + lensHalfWidth;
  const lensSpread = Math.atan2(lensHalfLength, lensCentre);
  // Brown's lenses stand at about 70 degrees plus quarter turns.
  const lensPhase = THREE.MathUtils.degToRad(70) - Math.PI / 4;
  for (let lens = 0; lens < 4; lens += 1) {
    const middle = Math.PI / 4 + lensPhase + lens * Math.PI / 2;
    const mid = Math.hypot(lensCentre, lensHalfLength);
    const polar = (angle, radius) => new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    const a = polar(middle - lensSpread, mid), b = polar(middle + lensSpread, mid);
    // Circle through a, b and the point q on the lens axis at the given
    // radius; the arc runs from `from` to `to` through q.
    const arcThrough = (radius, from, to, path) => {
      const q = polar(middle, radius);
      const axis = polar(middle, 1);
      // Centre on the lens axis: |C - a| = |C - q| with C = k * axis.
      const k = (q.lengthSq() - a.lengthSq()) / (2 * (q.dot(axis) - a.dot(axis)));
      const centre = axis.clone().multiplyScalar(k);
      const angleOf = (point) => Math.atan2(point.y - centre.y, point.x - centre.x);
      const start = angleOf(from), end = angleOf(to), through = angleOf(q);
      const ccwSweep = (x) => ((x - start) % FULL_TURN + FULL_TURN) % FULL_TURN;
      const clockwise = ccwSweep(through) > ccwSweep(end);
      path.absarc(centre.x, centre.y, centre.distanceTo(a), start, end, clockwise);
    };
    const hole = new THREE.Path();
    hole.moveTo(a.x, a.y);
    arcThrough(lensOuter, a, b, hole);
    arcThrough(lensInner, b, a, hole);
    wheelShape.holes.push(hole);
  }
  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(escapeCenter.x, escapeCenter.y, 0);
  const escapeRotor = new THREE.Group();
  escapeWheel.add(escapeRotor);
  const wheelGeometry = new THREE.ExtrudeGeometry(wheelShape, { bevelEnabled: false, curveSegments: 24, depth: wheelThickness });
  wheelGeometry.translate(0, 0, -halfThickness);
  const toothedWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  toothedWheel.userData.role = 'twenty-six-tooth-saw-escape-wheel';
  const escapeHub = cylinder(0.3, 0.24, Z_AXIS, steel);
  escapeHub.userData.role = 'escape-wheel-hub';
  const escapeArbor = cylinder(0.1, 0.9, Z_AXIS, steel, 20);
  escapeArbor.position.z = 0.25;
  escapeArbor.userData.role = 'escape-wheel-arbor-toward-viewer';
  escapeRotor.add(toothedWheel, escapeHub, escapeArbor);
  root.add(escapeWheel);

  // Horizontal arbor with the two wire-loop pallets and the crown wheel.
  const arbor = new THREE.Group();
  arbor.position.set(0, arborY, 0);
  arbor.userData.axis = X_AXIS.clone();
  const arborLeft = source(7, 0).x;
  const crownRearX = source(197, 0).x;
  const arborRod = cylinder(arborRadius, crownRearX - arborLeft + 0.2, X_AXIS, steel, 32);
  arborRod.position.x = (arborLeft + crownRearX + 0.2) / 2;
  arborRod.userData.role = 'horizontal-pallet-arbor';
  arbor.add(arborRod);

  // Loop centreline in the arbor frame (angle delta from straight down).
  const arborFramePoint = (delta, rho, x) => new THREE.Vector3(x, -rho * Math.cos(delta), rho * Math.sin(delta));
  const loopCenterline = (loop) => {
    // The working helix ends exactly at the contact point at release; from
    // there the wire bends up at once (it keeps the helix's advance along the
    // arbor, so it lifts away from the escaping tooth instead of standing in
    // its path) to pass just under the arbor, where it is soldered. The rest
    // of the loop is one smooth egg round the rod (soldered at its foot under
    // the arbor, clear at the sides, arched well above the rod as Brown's
    // loops are), which the far end of the working arc joins smoothly.
    const releaseDelta = loop.contactDelta(loop.side < 0 ? releaseAngle : -releaseAngle);
    const releaseSense = loop.side < 0 ? 1 : -1;
    // The far end stands a little beyond the deepest contact, at the swing's
    // extreme.
    const farDelta = loop.contactDelta(loop.side < 0 ? -arborAmplitude : arborAmplitude) - releaseSense * 0.12;
    const releaseRise = 0.25, farRise = 0.7;
    loop.arcEnds = [Math.min(releaseDelta, farDelta), Math.max(releaseDelta, farDelta)];
    const helixX = (delta) => loop.center + loop.side * helixPitch * delta;
    // The egg is an upright ellipse in the end view: its foot rests on the
    // arbor's underside (topRadius), its top is loopTop above the axis and
    // its sides stand just clear of the rod, so the loop is tall and narrow.
    const eggCentre = (loopTop - topRadius) / 2, eggHeight = (loopTop + topRadius) / 2, eggWidth = 0.2;
    const egg = (delta) => {
      // Ray from the axis at arbor angle delta: (z, y) = r (sin, -cos).
      const sz = Math.sin(delta) / eggWidth, cy = -Math.cos(delta) / eggHeight, oy = -eggCentre / eggHeight;
      const a = sz * sz + cy * cy, b = 2 * cy * oy, c = oy * oy - 1;
      return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    };
    const points = [];
    // Walk the loop in the release sense starting at the far end.
    const start = farDelta - releaseSense * farRise;
    const workingEnd = releaseDelta;
    const count = 480;
    for (let i = 0; i < count; i += 1) {
      const delta = start + releaseSense * FULL_TURN * i / count;
      const along = (delta - start) * releaseSense;
      const pastRelease = (delta - workingEnd) * releaseSense;
      let rho;
      if (along < farRise) {
        const u = along / farRise;
        rho = THREE.MathUtils.lerp(egg(delta), loop.rho, u * u * (3 - 2 * u));
      } else if (pastRelease <= 0) {
        rho = loop.rho;
      } else if (pastRelease < releaseRise) {
        const u = pastRelease / releaseRise;
        rho = THREE.MathUtils.lerp(loop.rho, egg(delta), 1 - (1 - u) ** 2);
      } else {
        rho = egg(delta);
      }
      points.push(arborFramePoint(delta, rho, helixX(delta)));
    }
    // Brown draws both loops as narrow rings leaning the same way, tops to
    // the left (the loop axis runs about 0.34 px left per px of rise). The
    // working arcs of the two loops are mirror images through the vertical
    // plane of the arbor, which leaves the front view unchanged, so both can
    // lean alike. Near the bottom the helix is, to first order, the plane
    // x = centre + side (pitch / rho) z. Beyond the working arc the wire
    // eases (over freeBlend radians) onto a surface that starts as that
    // plane and, going up, narrows toward the lean line: its z slope falls
    // to upperSlope by arbor height and it is sheared left above leanFloor
    // (clear of every tooth contact, which stays below arbor-frame y -0.129)
    // so that the loop's top stands back by Brown's lean. The working helix
    // and its contact law are untouched.
    const helixTaper = 0.15, freeBlend = 0.5, upperSlope = 0.45, returnSlope = 0.15, leanFloor = -0.1, leanBlend = 0.1;
    const workFrom = farRise, workTo = (workingEnd - start) * releaseSense;
    const lowSlope = helixPitch / loop.rho;
    const smooth = (u) => { const v = THREE.MathUtils.clamp(u, 0, 1); return v * v * (3 - 2 * v); };
    const ramp = (y) => {
      const h = y - leanFloor;
      if (h <= 0) return 0;
      return h < leanBlend ? h * h / (2 * leanBlend) : h - leanBlend / 2;
    };
    const lowest = points.reduce((p, q) => (q.y < p.y ? q : p));
    const highest = points.reduce((p, q) => (q.y > p.y ? q : p));
    let lean = 0;
    const surfaceX = (point) => {
      const slope = THREE.MathUtils.lerp(lowSlope, upperSlope, (point.y + loop.rho) / (loopTop + loop.rho));
      // Only the strand on the working side spreads along the arbor with the
      // helix; the other strand stays near the loop's station (bowing a
      // little the other way), so that neither loop's back strands run into
      // the other's working arc.
      const across = loop.side * point.z;
      const soft = (v) => (v + Math.sqrt(v * v + 0.01)) / 2;
      return loop.center + slope * soft(across) - returnSlope * soft(-across) + lean * ramp(point.y);
    };
    // The lean puts the top of the loop Brown's lean left of its lowest
    // point (which lies on the working arc).
    lean = (lowest.x - brownLoopLean * (highest.y - lowest.y) - surfaceX(highest)) / ramp(highest.y);
    for (let i = 0; i < count; i += 1) {
      const along = FULL_TURN * i / count;
      const outside = Math.max(0, workFrom - along, along - workTo);
      const gap = along > workTo ? Math.min(outside, FULL_TURN - along + workFrom) : outside;
      if (gap <= 0) continue;
      // Beyond the arc the helix's advance along the arbor tapers off, so
      // the wire does not run on past the working face and double back.
      const beyondFar = along < workFrom;
      const endDelta = beyondFar ? farDelta : workingEnd;
      const outward = beyondFar ? -releaseSense : releaseSense;
      const helixRun = helixX(endDelta + outward * helixTaper * Math.tanh(gap / helixTaper));
      points[i].x = THREE.MathUtils.lerp(helixRun, surfaceX(points[i]), smooth(gap / freeBlend));
    }
    // Round the loop's three corners (release bend, top wrap, closure) so
    // the wire bends no tighter than about 1.3 of its own radius: a sharper
    // corner folds the tube's inner side inside out. Smoothing is confined
    // to a short window around each corner, tapering to zero, so the
    // working helix is untouched except within a few hundredths of the
    // release corner.
    const minimumBend = 1.3 * wireRadius;
    const bendRadius = (p0, p1, p2) => {
      const ab = p0.distanceTo(p1), bc = p1.distanceTo(p2), ac = p0.distanceTo(p2);
      const area = new THREE.Vector3().subVectors(p1, p0)
        .cross(new THREE.Vector3().subVectors(p2, p0)).length() / 2;
      return area > 1e-14 ? ab * bc * ac / (4 * area) : Infinity;
    };
    const at = (i) => points[(i + count) % count];
    const corners = [];
    for (let i = 0; i < count; i += 1) {
      if (bendRadius(at(i - 1), at(i), at(i + 1)) < minimumBend) corners.push(i);
    }
    const window = 24;
    const weights = points.map((_, i) => corners.reduce((w, k) => {
      const d = Math.min(Math.abs(i - k), count - Math.abs(i - k));
      const taper = d < window ? Math.cos(d / window * Math.PI / 2) ** 2 : 0;
      return Math.max(w, taper);
    }, 0) * 0.5);
    const next = points.map((point) => point.clone());
    for (let pass = 0; pass < 300; pass += 1) {
      let tightest = Infinity;
      for (let i = 0; i < count; i += 1) {
        tightest = Math.min(tightest, bendRadius(at(i - 1), at(i), at(i + 1)));
        next[i].copy(points[i]);
        if (weights[i] > 0) {
          next[i].lerp(at(i - 1).clone().add(at(i + 1)).multiplyScalar(0.5), weights[i]);
        }
      }
      if (tightest >= minimumBend) break;
      for (let i = 0; i < count; i += 1) points[i].copy(next[i]);
    }
    return points;
  };
  const makePallet = (loop) => {
    const smooth = loopCenterline(loop);
    const curve = new THREE.CatmullRomCurve3(smooth, true, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 360, wireRadius, 14, true), brass);
    mesh.userData.role = loop.side > 0 ? 'right-wire-loop-pallet' : 'left-wire-loop-pallet';
    mesh.userData.centerline = smooth;
    return mesh;
  };
  const pallet1 = makePallet(loop1);
  const pallet2 = makePallet(loop2);
  arbor.add(pallet1, pallet2);

  // Crown wheel geared like Movement 26: a drum with straight-sided axial
  // teeth that act as a rack where they pass the involute pinion.
  const pinionTeeth = 12, crownTeeth = 30;
  const gearModule = 0.135;
  const pinionRadius = pinionTeeth * gearModule / 2;
  const crownPitchRadius = crownTeeth * gearModule / 2;
  const gearRatio = crownPitchRadius / pinionRadius;
  const crownOuterRadius = 2.15;
  const crownFaceX = crownRearX + 0.85;
  const crown = new THREE.Group();
  crown.userData.role = 'crown-wheel-geared-like-26';
  const crownProfile = [
    new THREE.Vector2(0.12, crownRearX), new THREE.Vector2(crownOuterRadius, crownRearX),
    new THREE.Vector2(crownOuterRadius, crownFaceX), new THREE.Vector2(crownPitchRadius - 0.15, crownFaceX),
    new THREE.Vector2(crownPitchRadius - 0.15, crownRearX + 0.12), new THREE.Vector2(0.12, crownRearX + 0.12),
    new THREE.Vector2(0.12, crownRearX),
  ];
  const drumGeometry = new THREE.LatheGeometry(crownProfile.map((p) => new THREE.Vector2(p.x, p.y)), 96);
  drumGeometry.rotateZ(-Math.PI / 2);
  const drum = new THREE.Mesh(drumGeometry, crownMaterial);
  drum.userData.role = 'crown-wheel-drum';
  crown.add(drum);
  const addendum = gearModule, dedendum = gearModule * 1.25;
  const pitchLineX = crownFaceX + dedendum;
  // Brown draws square crenellations with rounded tops, about half a pitch
  // wide. Each tooth is one extrusion of that section (tangent x axial),
  // run radially across the rim: nearly parallel flanks with a slight draft,
  // capped by a full circular arc. The draft and the arc's clearance give the
  // backlash the involute pinion needs.
  const crownToothHalfWidth = CROWN_TOOTH_HALF_WIDTH;
  const crownToothDraft = Math.tan(THREE.MathUtils.degToRad(CROWN_TOOTH_DRAFT_DEG));
  const crownToothHeight = addendum + dedendum;
  const crownToothRadialWidth = CROWN_TOOTH_RADIAL_WIDTH;
  const crownToothSection = (() => {
    // Half width at height h above the drum face (pitch line at h = dedendum).
    const halfAt = (h) => crownToothHalfWidth + (dedendum - h) * crownToothDraft;
    // The tip arc is tangent to both flanks and reaches the full height.
    let tipRadius = halfAt(crownToothHeight);
    for (let i = 0; i < 20; i += 1) tipRadius = halfAt(crownToothHeight - tipRadius);
    const tipCentre = crownToothHeight - tipRadius;
    const shape = new THREE.Shape();
    const baseHalf = halfAt(-0.02);
    shape.moveTo(-baseHalf, -0.02);
    shape.lineTo(baseHalf, -0.02);
    shape.lineTo(halfAt(tipCentre), tipCentre);
    shape.absarc(0, tipCentre, tipRadius, 0, Math.PI, false);
    shape.lineTo(-baseHalf, -0.02);
    return shape;
  })();
  const crownToothGeometry = new THREE.ExtrudeGeometry(crownToothSection, { bevelEnabled: false, curveSegments: 24, depth: crownToothRadialWidth });
  // Section x -> tangent (+z at the top), section y -> +x along the arbor,
  // extrusion -> radial, centred on the pitch radius.
  crownToothGeometry.translate(0, 0, -crownToothRadialWidth / 2);
  crownToothGeometry.applyMatrix4(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0),
  ));
  crownToothGeometry.translate(crownFaceX, crownPitchRadius, 0);
  const crownToothSolids = [];
  for (let index = 0; index < crownTeeth; index += 1) {
    const angle = Math.PI / 2 + index * FULL_TURN / crownTeeth;
    const geometry = crownToothGeometry.clone();
    // Tooth 0 sits at the top (+y); tooth i at angle measured from +z.
    geometry.rotateX(Math.PI / 2 - angle);
    const tooth = new THREE.Mesh(geometry, crownMaterial);
    tooth.userData.role = 'crown-wheel-axial-tooth';
    tooth.userData.index = index;
    crown.add(tooth);
    crownToothSolids.push(tooth);
  }
  arbor.add(crown);
  root.add(arbor);

  // Balance C on its vertical staff with the pinion just below it.
  const staffX = pitchLineX + pinionRadius;
  const staff = new THREE.Group();
  staff.position.set(staffX, 0, 0);
  staff.userData.axis = Y_AXIS.clone();
  const staffTop = source(0, 96).y, staffBottom = source(0, 420).y;
  const staffRod = cylinder(0.1, staffTop - staffBottom, Y_AXIS, steel, 20);
  staffRod.position.y = (staffTop + staffBottom) / 2;
  staffRod.userData.role = 'vertical-balance-staff';
  const pinion = makeGear({ axis: Y_AXIS, color: PALETTE.accent, depth: 0.9, radius: pinionRadius, teeth: pinionTeeth, toothHeight: addendum + dedendum, addendum, dedendum });
  const pinionRotor = pinion.userData.rotor;
  for (const child of [...pinionRotor.children].slice(2)) {
    pinionRotor.remove(child);
    child.geometry.dispose();
  }
  pinion.position.y = crownPitchRadius - 0.1;
  pinion.userData.role = 'twelve-leaf-balance-pinion';
  const balanceY = source(0, 119).y;
  const balanceRadius = 7.3;
  const balance = new THREE.Group();
  balance.position.y = balanceY;
  // Brown draws a broad flat rim.
  const rimShape = new THREE.Shape().absarc(0, 0, balanceRadius, 0, FULL_TURN, false);
  rimShape.holes.push(new THREE.Path().absarc(0, 0, balanceRadius - 0.62, 0, FULL_TURN, true));
  const rimGeometry = new THREE.ExtrudeGeometry(rimShape, { bevelEnabled: false, curveSegments: 96, depth: 0.22 });
  rimGeometry.translate(0, 0, -0.11);
  const rim = new THREE.Mesh(rimGeometry, balanceMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.userData.role = 'balance-C-rim';
  balance.add(rim);
  for (let index = 0; index < 3; index += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(balanceRadius - 0.3, 0.12, 0.34), balanceMaterial);
    // At the display pose (balance angle zero) one spoke points left and two
    // reach right, to front and back, as Brown draws them toward C.
    const angle = Math.PI + index * FULL_TURN / 3;
    spoke.position.set(Math.cos(angle) * (balanceRadius - 0.3) / 2, 0, -Math.sin(angle) * (balanceRadius - 0.3) / 2);
    spoke.rotation.y = angle;
    spoke.userData.role = 'balance-C-spoke';
    balance.add(spoke);
  }
  // Brown's collar on the staff: a round boss the spokes run into.
  const balanceHub = cylinder(0.5, 0.3, Y_AXIS, balanceMaterial, 48);
  balanceHub.userData.role = 'balance-C-hub';
  balance.add(balanceHub);
  staff.add(staffRod, pinion, balance);
  root.add(staff);

  // Mesh phase: a crown tooth sits at the top at arbor angle zero, so a pinion
  // space must face the crown there.
  const pinionPhase = Math.PI / pinionTeeth;
  // Display time starts a quarter period in, at mid-swing (arbor angle zero),
  // so t = 0 shows both loops standing upright over the arbor and the balance
  // spokes as Brown draws them, rather than the arbor at a 34 degree extreme.
  const displayTimeOffset = period / 4;
  const update = (time) => {
    const state = stateAtTime(time + displayTimeOffset);
    arbor.rotation.x = state.arborAngle;
    escapeRotor.rotation.z = state.wheelAngle;
    staff.rotation.y = state.balanceAngle;
    pinionRotor.rotation.z = pinionPhase;
    root.userData.kinematics = state;
  };

  root.userData.fidelity = 'authored';
  root.userData.archetype = movement.archetype;
  root.userData.hideGround = true;
  root.userData.blocks = { arbor, arborRod, balance, crown, crownToothSolids, drum, escapeRotor, escapeWheel, pallet1, pallet2, pinion, staff, staffRod, toothedWheel };
  root.userData.geometry = {
    arborAmplitude, arborRadius, crownPitchRadius, crownTeeth, dropAngles, escapeCenter: escapeCenter.clone(), gearModule, gearRatio,
    helixPitch, mechanismCyclePeriod: period, pallet1X, pallet2X, period, pinionRadius, pinionTeeth,
    pitch, pitchLineX, releaseAngle, rootRadius, staffX, tipRadius, toothCount, wheelThickness, wireRadius,
    contactDistance, loop1Rho: loop1.rho, loop2Rho: loop2.rho, loop1Arc: loop1.arcEnds, loop2Arc: loop2.arcEnds,
  };
  root.userData.animationTiming = { authoredCyclePeriod: period };
  root.userData.minimumDisplayCycleSeconds = 4;
  root.userData.contactTipAngle = (side, theta) => loops[side].tip(theta).value;
  root.userData.helixGap = (side, theta, phi) => helixGap(loops[side], theta, phi).gap;
  root.userData.contactDelta = (side, theta) => loops[side].contactDelta(theta);
  root.userData.times = times;
  root.userData.stateAtTime = stateAtTime;
  root.userData.displayTimeOffset = displayTimeOffset;
  root.userData.sourceAnimation = {
    available: false,
    reason: 'The official Movement 298 page marks Animated unavailable and serves only the original engraving.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.reconstruction = {
    drawn: 'balance C, vertical staff and pinion, 26-style crown wheel on a horizontal arbor, two tilted wire loops on that arbor over a face-on saw-tooth wheel with four lens crossings, arrow rising on the wheel’s right',
    inferred: 'each loop is a round wire soldered under the arbor whose lower working arc is a short helix; the two working arcs are mirror images through the arbor’s vertical plane, so the loops drive opposite ways yet lean alike (tops left) as drawn: a tooth’s leading face pushes the wire along the arbor and turns it, and the loop releases where its wire lifts off; each tooth lands as the arbor reverses, so the wheel never recoils; tooth counts 26/30/12, helix pitch, swing and drop schedule are inferred',
  };
  update(0);
  markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.4, 3.4, 10) };
}

export function createAuthoredGearedBalanceVergeMovement(movement) {
  if (movement.id !== 298) return null;
  return gearedBalanceVergeEscapement(movement);
}
