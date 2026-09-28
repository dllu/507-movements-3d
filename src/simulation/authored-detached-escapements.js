import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import {
  capsule,
  circle,
  plate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const DEG = Math.PI / 180;

function rotateXY([x, y], angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * x - s * y, s * x + c * y];
}

// Signed distance from a point to a polygon-clipping multipolygon: positive
// outside, negative inside (even-odd over every ring).
function signedDistance(point, multipolygon) {
  const px = point[0];
  const py = point[1];
  let best = Infinity;
  let inside = false;
  for (const polygon of multipolygon) {
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const ax = ring[j][0];
        const ay = ring[j][1];
        const bx = ring[i][0];
        const by = ring[i][1];
        if ((by > py) !== (ay > py) && px < (ax - bx) * (py - by) / (ay - by) + bx) {
          inside = !inside;
        }
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSquared = dx * dx + dy * dy;
        let t = lengthSquared > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSquared : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const ex = px - ax - t * dx;
        const ey = py - ay - t * dy;
        const squared = ex * ex + ey * ey;
        if (squared < best) best = squared;
      }
    }
  }
  best = Math.sqrt(best);
  return inside ? -best : best;
}

function quadraticPoints(a, control, b, count = 16) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const t = index / count;
    const u = 1 - t;
    return [
      u * u * a[0] + 2 * u * t * control[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * control[1] + t * t * b[1],
    ];
  });
}

function boredDisk(outer, inner, low, high) {
  const geometry = boredLatheGeometry(
    [{ radial: outer, axial: low }, { radial: outer, axial: high }],
    inner,
    48,
  );
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function solidRod(radius, low, high, segments = 32) {
  const geometry = new THREE.CylinderGeometry(radius, radius, high - low, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, (low + high) / 2);
  return geometry;
}

// Brown's plate 308 drawn as the engraving shows it: the broad pendulum P,P
// (two curved uprights joined by a web) swings across a small six-toothed
// hooked escape wheel carried under a screwed cock. Bell-crank Q locks a
// wheel tooth; click C on the pendulum lifts Q on the leftward swing and is
// pushed aside on the return; the single pallet I on the pendulum web takes
// the impulse from a falling tooth during the leftward swing only.
function brownDetachedEscapement(movement) {
  const root = new THREE.Group();

  // Raster measurements on public/engravings/mm_308.png (525 x 525).
  const S = 0.018;
  const raster = {
    wheelCenter: [241, 222],
    cockTop: [214, 279, 84, 133],
    cockScrew: [246, 110],
    qPivot: [304, 158],
    qBoss: [226, 309],
    cPivot: [262, 345],
    palletI: [192, 270, 285, 305],
    leftStopPin: [218, 352],
    rightStopPin: [275, 367],
  };
  const fromRaster = ([x, y]) => [
    (x - raster.wheelCenter[0]) * S,
    (raster.wheelCenter[1] - y) * S,
  ];
  const px = (value) => value * S;

  // Planes (z), front is +z toward the viewer.
  const Z = {
    frameLow: -0.40,
    frameHigh: -0.18,
    palletLow: -0.18,
    palletHigh: -0.11,
    nibHigh: 0.03,
    cockLow: -0.26,
    cockHigh: -0.16,
    wheelLow: -0.035,
    wheelHigh: 0.035,
    leverLow: 0.10,
    leverHigh: 0.17,
    headLow: -0.03,
    headHigh: 0.03,
  };

  // ---- Escape wheel: six hooked teeth, tips leading clockwise. ----
  const toothCount = 6;
  const toothPitch = 2 * Math.PI / toothCount;
  const tipRadius = px(58);
  const hubRadius = px(12);
  const arborRadius = px(4);
  const toothSweep = 40 * DEG;
  const toothHalfWidth = px(7);
  const toothOutline = (tipAngle) => {
    const count = 28;
    const centre = Array.from({ length: count + 1 }, (_, index) => {
      const s = index / count;
      const r = hubRadius * 0.7 + (tipRadius - hubRadius * 0.7) * s;
      const angle = tipAngle + toothSweep * (1 - s) ** 1.5;
      return [r * Math.cos(angle), r * Math.sin(angle)];
    });
    const leading = [];
    const trailing = [];
    centre.forEach((point, index) => {
      const a = centre[Math.max(0, index - 1)];
      const b = centre[Math.min(count, index + 1)];
      const tx = b[0] - a[0];
      const ty = b[1] - a[1];
      const length = Math.hypot(tx, ty);
      // Right-hand normal of an outward tangent points clockwise (leading).
      const nx = ty / length;
      const ny = -tx / length;
      const w = toothHalfWidth * (1 - index / count) ** 0.75;
      leading.push([point[0] + nx * w, point[1] + ny * w]);
      trailing.push([point[0] - nx * w, point[1] - ny * w]);
    });
    return [...leading, ...trailing.slice(0, -1).reverse()];
  };
  // Tooth tip angles at the start of every locked interval.
  const lockTipAngle = (index) => -60 * DEG + index * toothPitch;
  const wheelOutline = polygonClipping.union(
    poly(circle([0, 0], hubRadius, 64)),
    ...Array.from({ length: toothCount }, (_, index) => poly(
      toothOutline(lockTipAngle(index)),
    )),
  );
  const wheelOutlineAt = (advance) => wheelOutline.map((polygon) => polygon
    .map((ring) => ring.map((point) => rotateXY(point, -advance))));

  // ---- Pallet I and its impulse nib. ----
  // p94: the nib's top is 2.5 px lower (it was -52 px). The locked tooth
  // creeps about 6 degrees after Q's deeper hook as it lifts (the lock has
  // no draw), and at -52 px that brought the lowest tip into the nib's band
  // before the wheel was released.
  const nibTop = px(-54.5);
  const nibWidth = px(7);
  // tip angle while the tip is on the nib face lies between these values.
  const contactStartTip = -Math.PI / 2 + Math.acos(-nibTop / tipRadius);
  const contactEndTip = -Math.PI / 2 - Math.acos(-nibTop / tipRadius);
  const contactHalfChord = tipRadius * Math.cos(contactStartTip);

  // ---- Lever Q (bell crank) and its hooked head. ----
  const qPivot = fromRaster(raster.qPivot);
  const qBoss = fromRaster(raster.qBoss);
  const qBossRadius = px(5);
  const qArmHalfWidth = px(3.5);
  const qEyeRadius = px(9);
  const pivotBore = px(3.3);
  const pivotStud = px(3);
  const pinRadius = px(3.5);
  // p94: the hook's rounded end sits 12 px inside the tip circle, against
  // the locked tooth's leading face about a third of the way down it (it
  // was 2 px, on the tip). Deeper is forced out: the hook's lift is almost
  // radial (84 px of radial travel per radian of Q) and C can lift Q only
  // about 11.4 degrees, so a lock at Brown's sketched r = 32 px would need
  // about 19 degrees; his drawn hook, on the line from the wheel centre to
  // Q's pivot, would move tangentially and need about 42 degrees.
  const pinCenterRadius = tipRadius - px(12);
  const clearance = 0.002;

  // Place the hook's rounded end just ahead of the tooth locked at 120
  // degrees, with the whole hook bar (not only its end) held clear.
  const lockedWheel = wheelOutlineAt(0);
  let pinAngleLow = 95 * DEG;
  let pinAngleHigh = lockTipAngle(3) - 1 * DEG;
  // The hook's corner is set left so its bar leans along the locked
  // tooth's leading face (the valley's angle) instead of standing vertical.
  const hookCornerWorld = fromRaster([210, 146]);
  const pinGap = (angle) => {
    const end = [pinCenterRadius * Math.cos(angle), pinCenterRadius * Math.sin(angle)];
    let best = Infinity;
    for (let k = 0; k <= 24; k += 1) {
      const t = k / 24;
      best = Math.min(best, signedDistance(
        [end[0] + (hookCornerWorld[0] - end[0]) * t, end[1] + (hookCornerWorld[1] - end[1]) * t],
        lockedWheel,
      ) - (pinRadius + (px(5) - pinRadius) * t));
    }
    return best;
  };
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const middle = (pinAngleLow + pinAngleHigh) / 2;
    if (pinGap(middle) > clearance) pinAngleLow = middle;
    else pinAngleHigh = middle;
  }
  const pinAngle = pinAngleLow;
  const pinCenter = [
    pinCenterRadius * Math.cos(pinAngle),
    pinCenterRadius * Math.sin(pinAngle),
  ];
  const qLocal = (point) => [point[0] - qPivot[0], point[1] - qPivot[1]];
  const qPinLocal = qLocal(pinCenter);
  const qBossLocal = qLocal(qBoss);
  // Q is Brown's broad bell crank on one stud: the long arm down to the boss
  // at C in the front lever plane, and the head in the wheel's own plane,
  // running left from the pivot and ending in a downward hook whose rounded
  // end locks the wheel (the rounded end sits where the lock must be).
  const qArmRootHalfWidth = px(6);
  const qHeadHalfWidth = px(5.5);
  const qHookRootHalfWidth = px(5);
  const qHookCorner = qLocal(hookCornerWorld);
  // Convex hull of two discs: tangent quad plus both discs.
  const taperedBar = (a, ra, b, rb, segments = 48) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    const base = Math.atan2(dy, dx), turn = Math.PI / 2 + Math.asin((ra - rb) / d);
    const at = (c, r, angle) => [c[0] + r * Math.cos(angle), c[1] + r * Math.sin(angle)];
    return polygonClipping.union(
      poly([at(a, ra, base + turn), at(a, ra, base - turn), at(b, rb, base - turn), at(b, rb, base + turn)]),
      poly(circle(a, ra, segments)),
      poly(circle(b, rb, segments)),
    );
  };
  const qOutlineLocal = polygonClipping.difference(
    polygonClipping.union(
      poly(circle([0, 0], qEyeRadius, 64)),
      taperedBar([0, 0], qArmRootHalfWidth, qBossLocal, qArmHalfWidth),
      poly(circle(qBossLocal, qBossRadius, 48)),
    ),
    poly(circle([0, 0], pivotBore, 32)),
  );
  const qHeadOutlineLocal = polygonClipping.difference(
    polygonClipping.union(
      poly(circle([0, 0], qEyeRadius, 64)),
      taperedBar([0, 0], qHeadHalfWidth + px(1.5), qHookCorner, qHeadHalfWidth),
      taperedBar(qHookCorner, qHookRootHalfWidth, qPinLocal, pinRadius),
    ),
    poly(circle([0, 0], pivotBore, 32)),
  );
  // Discs whose union is the part of the head that can reach the wheel.
  const qHookDiscs = [];
  for (let k = 0; k <= 24; k += 1) {
    const t = k / 24;
    qHookDiscs.push({
      centre: [qPinLocal[0] + (qHookCorner[0] - qPinLocal[0]) * t, qPinLocal[1] + (qHookCorner[1] - qPinLocal[1]) * t],
      radius: pinRadius + (qHookRootHalfWidth - pinRadius) * t,
    });
  }
  for (let k = 1; k <= 12; k += 1) {
    const t = k / 12;
    qHookDiscs.push({
      centre: [qHookCorner[0] * (1 - t), qHookCorner[1] * (1 - t)],
      radius: qHeadHalfWidth + px(1.5) * t,
    });
  }
  // Q rotates clockwise (negative z) by q when lifted.
  const qPoint = (local, q) => {
    const [x, y] = rotateXY(local, -q);
    return [qPivot[0] + x, qPivot[1] + y];
  };
  const pinClearAngle = (() => {
    let low = 0;
    let high = 25 * DEG;
    const clear = (q) => qHookDiscs.every(({ centre, radius }) => {
      const [x, y] = qPoint(centre, q);
      return Math.hypot(x, y) - radius >= tipRadius + clearance;
    });
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (low + high) / 2;
      if (clear(middle)) high = middle;
      else low = middle;
    }
    return high;
  })();

  // ---- Click C on the pendulum (local to its pivot at rest). ----
  const cPivotRest = fromRaster(raster.cPivot);
  const cRoundRadius = px(5);
  // At u = 0 the click round just meets Q (running clearance).
  // p94: the round meets Q's boss on its upper right (55 degrees above the
  // horizontal, as Brown's curl of C rises beside Q's end), so the boss has
  // to climb over it: C lifts Q 11.4 degrees instead of 6.7, enough to free
  // the deeper hook.
  const cRoundContact = 55 * DEG;
  // At that height the round sits beside the lower end of Q's arm, so it is
  // moved right until it clears Q's whole outline by the running clearance
  // at the drawn instant (C just meets Q there).
  const cRoundHeight = qBoss[1] + (qBossRadius + cRoundRadius) * Math.sin(cRoundContact);
  const qOutlineWorld = qOutlineLocal.map((polygon) => polygon.map(
    (ring) => ring.map(([x, y]) => [x + qPivot[0], y + qPivot[1]]),
  ));
  let roundLow = qBoss[0];
  let roundHigh = qBoss[0] + px(40);
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const middle = (roundLow + roundHigh) / 2;
    if (signedDistance([middle, cRoundHeight], qOutlineWorld) - cRoundRadius > clearance) roundHigh = middle;
    else roundLow = middle;
  }
  const cRoundRest = [roundHigh, cRoundHeight];
  const cRoundLocal = [
    cRoundRest[0] - cPivotRest[0],
    cRoundRest[1] - cPivotRest[1],
  ];
  const cPlateLow = px(-10);
  const cOutlineLocal = polygonClipping.difference(
    polygonClipping.union(
      poly([[px(-17), cPlateLow], [px(30), cPlateLow], [px(30), px(9)],
        [px(-17), px(9)]]),
      poly(circle([px(-17), px(-0.5)], px(9.5), 48)),
      capsule([px(-15), px(2)], cRoundLocal, px(3.5), 16),
      poly(circle(cRoundLocal, cRoundRadius, 48)),
    ),
    poly(circle([0, 0], pivotBore, 32)),
  );
  const rightStopLocal = [px(14), cPlateLow - px(4) - clearance];
  const leftStopLocal = [
    px(raster.leftStopPin[0] - raster.cPivot[0]),
    px(raster.cPivot[1] - raster.leftStopPin[1]),
  ];

  // Pendulum offset u (model x) moves every pendulum-borne part.
  const cLocalToWorld = (local, u, c) => {
    const [x, y] = rotateXY(local, c);
    return [cPivotRest[0] + u + x, cPivotRest[1] + y];
  };
  const worldToCLocal = (point, u, c) => rotateXY(
    [point[0] - cPivotRest[0] - u, point[1] - cPivotRest[1]],
    -c,
  );
  const qBossClearance = (q, u, c) => signedDistance(
    worldToCLocal(qPoint(qBossLocal, q), u, c),
    cOutlineLocal,
  ) - qBossRadius;
  const qArmClearance = (q, u, c) => {
    // Sample the long arm's centre line away from the boss as well.
    let best = Infinity;
    // Above half its length the arm stays well clear of the click.
    // Sampled densely (every 2 px): C's round now bears on the arm itself.
    for (let k = 0; k <= 48; k += 1) {
      const t = 0.5 + 0.5 * k / 48;
      const point = [qBossLocal[0] * t, qBossLocal[1] * t];
      const halfWidth = qArmRootHalfWidth + (qArmHalfWidth - qArmRootHalfWidth) * t;
      best = Math.min(best, signedDistance(
        worldToCLocal(qPoint(point, q), u, c),
        cOutlineLocal,
      ) - (t === 1 ? qBossRadius : halfWidth));
    }
    return best;
  };
  const clickReach = Math.max(...cOutlineLocal.flat(2).length
    ? cOutlineLocal[0][0].map(([x, y]) => Math.hypot(x, y)) : [0]);
  const qClickClearance = (q, u, c) => {
    const [bx, by] = qPoint(qBossLocal, q);
    const far = Math.hypot(bx - cPivotRest[0] - u, by - cPivotRest[1])
      - clickReach - qBossRadius - 0.5 * Math.hypot(...qBossLocal);
    if (far > clearance) return far;
    return Math.min(qBossClearance(q, u, c), qArmClearance(q, u, c));
  };

  // Least Q lift on the upper branch while C drives it leftward (used only
  // to place pallet I's nib relative to the release point).
  const qMaximum = 26 * DEG;
  const cMaximum = 40 * DEG;
  const tolerance = clearance - 1e-9;
  const resolveUp = (candidate, clearanceAt, maximum) => {
    if (clearanceAt(candidate) >= tolerance) return candidate;
    const steps = 64;
    let low = candidate;
    let high = null;
    for (let k = 1; k <= steps; k += 1) {
      const value = candidate + (maximum - candidate) * k / steps;
      if (clearanceAt(value) >= tolerance) { high = value; break; }
      low = value;
    }
    if (high === null) throw new Error('308: part cannot be cleared within its travel');
    for (let iteration = 0; iteration < 36; iteration += 1) {
      const middle = (low + high) / 2;
      if (clearanceAt(middle) >= tolerance) high = middle;
      else low = middle;
    }
    return high;
  };
  const resolveDown = (low, candidate, clearanceAt) => {
    if (clearanceAt(candidate) >= tolerance) return candidate;
    let high = candidate;
    for (let iteration = 0; iteration < 36; iteration += 1) {
      const middle = (low + high) / 2;
      if (clearanceAt(middle) >= tolerance) low = middle;
      else high = middle;
    }
    return low;
  };

  const travelStep = px(0.25);
  let travelAtRelease = null;
  for (let v = 0, q = 0; v < px(60); v += travelStep) {
    q = resolveUp(q, (value) => qClickClearance(value, -v, 0), qMaximum);
    if (q >= pinClearAngle) { travelAtRelease = v; break; }
  }
  if (travelAtRelease === null) throw new Error('308: click C cannot release Q');

  const dropMargin = px(3);
  // Face of the nib (wheel frame) when the pendulum stands as drawn.
  const nibFaceAtContact = contactHalfChord + travelAtRelease + dropMargin;
  const nibBottom = fromRaster([0, raster.palletI[2] + 4])[1];
  const pendulumPeriod = 4;
  // The right extreme leaves C 14 px clear of Q's boss once the tooth that
  // drove the nib has left it. p94: the swing keeps its former 78 px
  // amplitude instead of being centred on the nib: the deeper hook needs C
  // to carry Q 36 px (it was 12), and a swing centred on the impulse would
  // then run P's right upright into the cock and Q's stud at its left
  // extreme. The impulse now falls a little left of the swing's centre.
  const offsetMaximum = contactHalfChord + px(14);
  const swingAmplitude = px(78);
  const swingCentre = offsetMaximum - swingAmplitude;
  const offsetMinimum = swingCentre - swingAmplitude;
  if (offsetMinimum > -(nibFaceAtContact + contactHalfChord + px(14))) {
    throw new Error('308: the swing ends before the impulse is complete');
  }

  // Only tooth points beyond the nib top radius can reach the nib.
  const wheelVertices = wheelOutline.flat(2)
    .filter(([x, y]) => Math.hypot(x, y) >= -nibTop - px(1));
  const rectSigned = ([x, y], x0, x1, y0, y1) => {
    const dx = Math.max(x0 - x, 0, x - x1);
    const dy = Math.max(y0 - y, 0, y - y1);
    if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
    return -Math.min(x - x0, x1 - x, y - y0, y1 - y);
  };
  const nibClearance = (advance, offset) => {
    const face = nibFaceAtContact + offset;
    const x0 = face - nibWidth;
    if (x0 > tipRadius + 0.05 || face < -tipRadius - 0.05) return 1;
    let best = Infinity;
    for (const vertex of wheelVertices) {
      best = Math.min(best, rectSigned(rotateXY(vertex, -advance), x0, face, nibBottom, nibTop));
    }
    for (const corner of [[x0, nibTop], [face, nibTop]]) {
      if (Math.hypot(...corner) > tipRadius + clearance) continue;
      best = Math.min(best, signedDistance(rotateXY(corner, advance), wheelOutline));
    }
    return best;
  };
  const pinWheelClearance = (lift, advance) => {
    let best = Infinity;
    for (const { centre: local, radius } of qHookDiscs) {
      const centre = qPoint(local, lift);
      const outside = Math.hypot(...centre) - radius - tipRadius;
      if (outside > clearance) { best = Math.min(best, outside); continue; }
      best = Math.min(best, signedDistance(rotateXY(centre, advance), wheelOutline) - radius);
    }
    return best;
  };

  // Kinematic projection: each step every part tends toward its driven or
  // spring-returned target and is held back by finite outline clearance.
  const wheelFreeRate = 3 * DEG / S;
  // p94: the deeper hook must fall about 11 degrees between C letting Q go
  // and the next tooth arriving, so Q falls 2.5 times faster than before.
  const leverFallRate = 1.5 * DEG / S;
  const clickReturnRate = 1.5 * DEG / S;
  const stepCount = Math.ceil((offsetMaximum - offsetMinimum) / travelStep);
  const leftTable = [];
  let lift = 0;
  let advance = 0;
  for (let i = 0; i <= stepCount; i += 1) {
    const offset = offsetMaximum - (offsetMaximum - offsetMinimum) * i / stepCount;
    const heldAdvance = advance;
    lift = resolveUp(
      Math.max(0, lift - leverFallRate * travelStep),
      (value) => Math.min(
        qClickClearance(value, offset, 0),
        pinWheelClearance(value, heldAdvance),
      ),
      qMaximum,
    );
    const heldLift = lift;
    advance = resolveDown(
      advance,
      Math.min(toothPitch, advance + wheelFreeRate * travelStep),
      (value) => Math.min(
        nibClearance(value, offset),
        pinWheelClearance(heldLift, value),
      ),
    );
    leftTable.push({
      advance,
      impulse: advance > 1e-7 && advance < toothPitch - 1e-7
        && nibClearance(advance, offset) < clearance * 4,
      lift,
    });
  }
  // Snap sub-tolerance bisection residue of the locked states.
  for (const row of leftTable) {
    if (row.advance < 1e-7) row.advance = 0;
    if (toothPitch - row.advance < 1e-7) row.advance = toothPitch;
  }
  if (Math.abs(advance - toothPitch) > 1e-7 || lift !== 0) {
    throw new Error('308: the wheel does not relock one tooth per cycle');
  }
  const rightTable = [];
  let yielded = 0;
  for (let i = 0; i <= stepCount; i += 1) {
    const offset = offsetMinimum + (offsetMaximum - offsetMinimum) * i / stepCount;
    yielded = resolveUp(
      Math.max(0, yielded - clickReturnRate * travelStep),
      (value) => qClickClearance(0, offset, value),
      cMaximum,
    );
    rightTable.push(yielded);
  }
  if (yielded !== 0) throw new Error('308: click C does not return before the next swing');
  const leftIndex = (offset) => (offsetMaximum - offset)
    / (offsetMaximum - offsetMinimum) * stepCount;
  const rightIndex = (offset) => (offset - offsetMinimum)
    / (offsetMaximum - offsetMinimum) * stepCount;
  const sample = (table, position, read) => {
    const clamped = THREE.MathUtils.clamp(position, 0, stepCount);
    const index = Math.min(Math.floor(clamped), stepCount - 1);
    const t = clamped - index;
    return read(table[index]) * (1 - t) + read(table[index + 1]) * t;
  };
  const firstIndex = (predicate) => leftTable.findIndex(predicate);
  const offsetAtLeftIndex = (index) => offsetMaximum
    - (offsetMaximum - offsetMinimum) * index / stepCount;
  const releaseOffset = offsetAtLeftIndex(firstIndex((row) => row.advance > 1e-7));
  const impulseStartOffset = offsetAtLeftIndex(firstIndex((row) => row.impulse));
  const impulseEndOffset = offsetAtLeftIndex(
    leftTable.length - 1 - [...leftTable].reverse().findIndex((row) => row.impulse),
  );
  const relockOffset = offsetAtLeftIndex(firstIndex((row) => row.advance >= toothPitch));

  // t = 0 is the drawn instant: C has just met Q on the leftward swing.
  const phaseOrigin = Math.acos(-swingCentre / swingAmplitude) / (2 * Math.PI);
  const stateAtTime = (time) => {
    const cycleCoordinate = time / pendulumPeriod + phaseOrigin;
    const cycleIndex = Math.floor(cycleCoordinate);
    const phase = cycleCoordinate - cycleIndex;
    const omega = 2 * Math.PI / pendulumPeriod;
    const offset = swingCentre + swingAmplitude * Math.cos(2 * Math.PI * phase);
    const velocity = -swingAmplitude * omega * Math.sin(2 * Math.PI * phase);
    const leftward = phase < 0.5;
    let leverLift = 0;
    let clickAngle = 0;
    let wheelAdvance = toothPitch;
    let impulseActive = false;
    let mode;
    if (leftward) {
      const position = leftIndex(offset);
      leverLift = sample(leftTable, position, (row) => row.lift);
      wheelAdvance = sample(leftTable, position, (row) => row.advance);
      impulseActive = offset <= impulseStartOffset && offset >= impulseEndOffset;
      if (wheelAdvance === 0) mode = leverLift > 0 ? 'C-lifts-Q' : 'detached-leftward-approach';
      else if (impulseActive) mode = 'I-leftward-impulse';
      else if (wheelAdvance < toothPitch) mode = 'wheel-running-free';
      else mode = 'detached-leftward-overswing';
    } else {
      clickAngle = sample(rightTable, rightIndex(offset), (value) => value);
      mode = clickAngle > 0 ? 'C-pushed-aside-by-Q' : 'detached-rightward-return';
    }
    return {
      clickAngle,
      cycleIndex,
      cyclePhase: phase,
      detachedFromEscapeWheel: !(leverLift > 0 || impulseActive),
      impulseActive,
      leverLift,
      locked: wheelAdvance === 0 || wheelAdvance === toothPitch,
      mode,
      pendulumOffset: offset,
      pendulumVelocity: velocity,
      wheelAdvance,
      wheelAngle: -(cycleIndex * toothPitch + wheelAdvance),
    };
  };

  // ---- Materials. ----
  const frameMaterial = matte(PALETTE.driven, { metalness: 0.18, roughness: 0.6 });
  const wheelMaterial = matte(PALETTE.driver, { metalness: 0.3, roughness: 0.42 });
  const leverMaterial = matte(PALETTE.accent, { metalness: 0.4, roughness: 0.34 });
  const cockMaterial = matte(PALETTE.frame, { metalness: 0.3, roughness: 0.5 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.36, roughness: 0.42 });
  // Steel pallet I: a white plate would read as a hole on the cream page.
  const palletMaterial = matte(PALETTE.muted, { metalness: 0.25, roughness: 0.4 });

  // ---- Fixed cock with its screw, and the lever stud. ----
  const [cockLeft, cockRight, cockTop, cockNeck] = raster.cockTop;
  const cockOutline = polygonClipping.difference(
    polygonClipping.union(
      poly([
        fromRaster([cockLeft, cockTop]), fromRaster([cockRight, cockTop]),
        fromRaster([cockRight, cockNeck]), fromRaster([258, 214]),
        fromRaster([228, 214]), fromRaster([cockLeft, cockNeck]),
      ]),
      poly(circle([0, 0], hubRadius, 48)),
      // A minimal lug in the cock's own plane carries Q's pivot stud (Brown
      // draws the stud just right of the cock, with no other support).
      capsule(fromRaster([cockRight - 6, raster.qPivot[1]]), qPivot, px(11), 32),
      poly(circle(qPivot, px(15), 48)),
    ),
    poly(circle([0, 0], arborRadius + px(0.3), 32)),
  );
  const cock = new THREE.Mesh(plate(cockOutline, Z.cockLow, Z.cockHigh), cockMaterial);
  cock.userData.role = 'fixed-wheel-cock';
  root.add(cock);
  const cockScrew = new THREE.Mesh(
    plate(polygonClipping.difference(
      poly(circle(fromRaster(raster.cockScrew), px(14), 48)),
      poly([
        rotateXY([-px(13), -px(1.6)], -1.1).map((v, i) => v + fromRaster(raster.cockScrew)[i]),
        rotateXY([px(13), -px(1.6)], -1.1).map((v, i) => v + fromRaster(raster.cockScrew)[i]),
        rotateXY([px(13), px(1.6)], -1.1).map((v, i) => v + fromRaster(raster.cockScrew)[i]),
        rotateXY([-px(13), px(1.6)], -1.1).map((v, i) => v + fromRaster(raster.cockScrew)[i]),
      ]),
    ), Z.cockHigh - 0.01, Z.cockHigh + 0.04),
    darkMaterial,
  );
  cockScrew.userData.role = 'cock-fixing-screw';
  root.add(cockScrew);
  // The stud's foot is buried in the lug (no end face on the cock's back).
  const leverStud = new THREE.Mesh(solidRod(pivotStud, Z.cockLow + 0.03, Z.leverHigh + 0.03), darkMaterial);
  leverStud.position.set(qPivot[0], qPivot[1], 0);
  leverStud.userData.role = 'Q-pivot-stud';
  root.add(leverStud);

  // ---- Escape wheel. ----
  const escapeWheel = new THREE.Group();
  escapeWheel.userData.role = 'six-tooth-hooked-escape-wheel';
  root.add(escapeWheel);
  const wheelPlate = new THREE.Mesh(
    plate(polygonClipping.difference(wheelOutline, poly(circle([0, 0], arborRadius, 32))),
      Z.wheelLow, Z.wheelHigh),
    wheelMaterial,
  );
  wheelPlate.userData.role = 'hooked-tooth-escape-wheel';
  escapeWheel.add(wheelPlate);
  const arbor = new THREE.Mesh(solidRod(arborRadius, Z.cockLow + 0.02, Z.wheelHigh + 0.035), darkMaterial);
  arbor.userData.role = 'escape-wheel-arbor';
  escapeWheel.add(arbor);
  const collet = new THREE.Mesh(
    plate(polygonClipping.difference(
      poly(circle([0, 0], px(10), 48)),
      poly(circle([0, 0], arborRadius, 32)),
      ...[0, 1, 2, 3].map((k) => poly(circle(rotateXY([px(6), 0], Math.PI / 4 + k * Math.PI / 2), px(1.4), 12))),
    ), Z.wheelHigh, Z.wheelHigh + 0.03),
    darkMaterial,
  );
  collet.userData.role = 'escape-wheel-collet';
  escapeWheel.add(collet);

  // ---- Lever Q. ----
  const lever = new THREE.Group();
  lever.position.set(qPivot[0], qPivot[1], 0);
  lever.userData.role = 'locking-lever-Q';
  root.add(lever);
  const leverPlate = new THREE.Mesh(plate(qOutlineLocal, Z.leverLow, Z.leverHigh), leverMaterial);
  leverPlate.userData.role = 'Q-bell-crank';
  lever.add(leverPlate);
  const leverHead = new THREE.Mesh(plate(qHeadOutlineLocal, Z.headLow, Z.headHigh), leverMaterial);
  leverHead.userData.role = 'Q-hooked-head-in-wheel-plane';
  lever.add(leverHead);
  // One bored hub joins the head and the arm on the stud.
  const leverHub = new THREE.Mesh(
    boredDisk(qEyeRadius * 0.8, pivotBore, Z.headHigh - 0.01, Z.leverLow + 0.01),
    leverMaterial,
  );
  leverHub.userData.role = 'Q-hub-joining-head-and-arm';
  lever.add(leverHub);

  // ---- Pendulum P, P with pallet I, click C and its stop pins. ----
  const pendulum = new THREE.Group();
  pendulum.userData.role = 'detached-pendulum-P';
  root.add(pendulum);
  // Each upright bows outward like the engraving's broken-off pieces P.
  const barCentre = quadraticPoints([54, 146], [50, 360], [112, 466], 24);
  const barHalf = 20;
  const barOutline = (mirror) => {
    const map = ([x, y]) => fromRaster([mirror ? 523 - x : x, y]);
    const left = barCentre.map(([x, y]) => [x - barHalf, y]);
    const right = barCentre.map(([x, y]) => [x + barHalf, y]);
    const pts = [...left, ...right.reverse()].map(map);
    // A round top concentric with the band's end centre, not a square cut
    // (the band is near vertical there, so the arc meets both edges).
    return polygonClipping.union(
      poly(mirror ? pts.reverse() : pts),
      poly(circle(map(barCentre[0]), px(barHalf), 48)),
    );
  };
  const webOutline = poly([
    ...quadraticPoints([66, 190], [72, 272], [130, 275]),
    ...quadraticPoints([393, 275], [451, 272], [457, 190]),
    [470, 330],
    ...quadraticPoints([407, 456], [401, 386], [360, 385]),
    ...quadraticPoints([163, 385], [122, 386], [116, 456]),
    [55, 330],
  ].map(fromRaster).reverse());
  const pendulumOutline = polygonClipping.union(barOutline(false), barOutline(true), webOutline);
  const pendulumPlate = new THREE.Mesh(plate(pendulumOutline, Z.frameLow, Z.frameHigh), frameMaterial);
  pendulumPlate.userData.role = 'pendulum-P-P-and-web';
  pendulum.add(pendulumPlate);

  const [pl, pr, pt, pb] = raster.palletI;
  const palletPlate = new THREE.Mesh(
    plate(poly([fromRaster([pl, pb]), [nibFaceAtContact, fromRaster([0, pb])[1]],
      [nibFaceAtContact, fromRaster([0, pt])[1]], fromRaster([pl, pt])]),
      Z.palletLow, Z.palletHigh),
    palletMaterial,
  );
  palletPlate.userData.role = 'pallet-I-plate';
  pendulum.add(palletPlate);
  // The nib's working face is offset so the tooth meets it after the drop.
  const nibFaceRest = nibFaceAtContact;
  const nib = new THREE.Mesh(
    plate(poly([
      [nibFaceRest - nibWidth, fromRaster([0, pt + 4])[1]],
      [nibFaceRest, fromRaster([0, pt + 4])[1]],
      [nibFaceRest, nibTop],
      [nibFaceRest - nibWidth, nibTop],
    ]), Z.palletLow, Z.nibHigh),
    palletMaterial,
  );
  nib.userData.role = 'pallet-I-impulse-nib';
  pendulum.add(nib);
  const palletScrews = [pl + 13, pr - 10].map((x) => {
    const screw = new THREE.Mesh(solidRod(px(4.5), Z.palletHigh - 0.01, Z.palletHigh + 0.02, 24), darkMaterial);
    const [sx, sy] = fromRaster([x, (pt + pb) / 2]);
    screw.position.set(sx, sy, 0);
    screw.userData.role = 'pallet-I-screw';
    pendulum.add(screw);
    return screw;
  });

  const click = new THREE.Group();
  click.position.set(cPivotRest[0], cPivotRest[1], 0);
  click.userData.role = 'click-C';
  pendulum.add(click);
  const clickPlate = new THREE.Mesh(plate(cOutlineLocal, Z.leverLow, Z.leverHigh), leverMaterial);
  clickPlate.userData.role = 'click-C-hooked-plate';
  click.add(clickPlate);
  const clickStud = new THREE.Mesh(solidRod(pivotStud, Z.frameHigh - 0.02, Z.leverHigh + 0.02), darkMaterial);
  clickStud.position.set(cPivotRest[0], cPivotRest[1], 0);
  clickStud.userData.role = 'click-C-pivot-stud';
  pendulum.add(clickStud);
  const clickScrewHead = new THREE.Mesh(boredDisk(px(6), px(1.5), Z.leverHigh + 0.02, Z.leverHigh + 0.045), darkMaterial);
  clickScrewHead.position.set(cPivotRest[0], cPivotRest[1], 0);
  clickScrewHead.userData.role = 'click-C-pivot-screw-head';
  pendulum.add(clickScrewHead);
  const stopPins = [rightStopLocal, leftStopLocal].map((local, index) => {
    const pin = new THREE.Mesh(solidRod(px(4), Z.frameHigh - 0.02, Z.leverHigh, 24), darkMaterial);
    pin.position.set(cPivotRest[0] + local[0], cPivotRest[1] + local[1], 0);
    pin.userData.role = index === 0 ? 'click-C-rest-stop-pin' : 'click-C-yield-stop-pin';
    pendulum.add(pin);
    return pin;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    pendulum.position.x = state.pendulumOffset;
    click.rotation.z = state.clickAngle;
    lever.rotation.z = -state.leverLift;
    escapeWheel.rotation.z = state.wheelAngle;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    arbor,
    click,
    clickPlate,
    clickScrewHead,
    clickStud,
    cock,
    cockScrew,
    collet,
    escapeWheel,
    lever,
    leverHead,
    leverHub,
    leverPlate,
    leverStud,
    nib,
    palletPlate,
    palletScrews,
    pendulum,
    pendulumPlate,
    stopPins,
    wheelPlate,
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    clearance,
    clickOutline: cOutlineLocal,
    clickPivotRest: cPivotRest,
    contactHalfChord,
    leverOutline: qOutlineLocal,
    leverHeadOutline: qHeadOutlineLocal,
    leverPivot: qPivot,
    lockPinCenter: pinCenter,
    lockPinRadius: pinRadius,
    mechanismCyclePeriod: pendulumPeriod,
    nibBottom,
    nibFaceAtContact,
    nibTop,
    nibWidth,
    pendulumPeriod,
    pinClearAngle,
    qBossLocal,
    qBossRadius,
    rasterScale: S,
    swingAmplitude,
    swingCentre,
    tipRadius,
    toothCount,
    toothPitch,
    impulseEndOffset,
    impulseStartOffset,
    offsetMaximum,
    offsetMinimum,
    relockOffset,
    releaseOffset,
    travelAtRelease,
  };
  root.userData.wheelOutlineAt = wheelOutlineAt;
  root.userData.signedDistance = signedDistance;
  root.userData.leverPoint = qPoint;
  root.userData.clickLocalToWorld = cLocalToWorld;
  root.userData.mechanism = 'Brown’s detached pendulum escapement: bell-crank Q locks a tooth of the six-toothed hooked escape wheel under its cock; click C on the broad pendulum P, P lifts Q on the leftward swing, the released wheel drops onto the single pallet I and drives it leftward, and Q relocks the next tooth; on the return C pivots aside under Q, leaving the pendulum detached.';
  root.userData.presentation = 'front elevation matching Brown’s plate: pendulum pieces P, P and web, cock with screw, hooked wheel, lever Q, click C with its stop pins, and pallet I';
  root.userData.reconstructionNote = 'Geometry is traced from Brown’s plate at 0.018 model units per raster pixel. Q lift and C yield are solved from finite outline clearance against the moving pendulum; wheel drop, contact with pallet I’s nib and relock are kinematic. Inferred, not drawn: the nib standing up from pallet I into the wheel plane, that Q’s hooked head lies in the wheel plane on a hub behind its arm, with the hook’s rounded end seated against the locked tooth’s leading face a third of the way down it (Brown sketches it deeper, which the lift C can give Q cannot free), the round of C meeting Q’s boss on its upper side, the click’s round tip, the pivot studs, and that the pendulum translates (its suspension is outside the plate). Q’s gravity rest banking and C’s return spring are not drawn and are prescribed; passive impulse energy and impacts are not simulated.';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 308 page marks Animated unavailable and supplies only Brown’s static elevation and description.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate308: { imageHeight: 525, imageWidth: 525, raster },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.stateAtCyclePhase = (phase) => stateAtTime(phase * pendulumPeriod);
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'detached-leftward-approach',
      'C-lifts-Q',
      'wheel-released-drop',
      'I-leftward-impulse',
      'detached-leftward-overswing',
      'detached-rightward-return',
      'C-pushed-aside-by-Q',
    ],
  };
  root.userData.transmission = {
    direction: 'clockwise in the front elevation',
    impulsesPerPendulumCycle: 1,
    impulsesPerVibration: [1, 0],
    toothCount,
    wheelAdvancePerCycleRadians: toothPitch,
  };
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 4;
  root.userData.cameraDirection = new THREE.Vector3(0, 0.12, 15);
  root.userData.cameraFov = 8;
  root.userData.cameraDistanceScale = 0.9;

  root.traverse((object) => {
    for (const material of [].concat(object.material ?? [])) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (let i = 0; i <= 32; i += 1) {
    update(pendulumPeriod * i / 32);
    root.updateMatrixWorld(true);
    root.traverseVisible((object) => {
      const positions = object.geometry?.attributes.position;
      if (!positions) return;
      for (let j = 0; j < positions.count; j += 1) {
        bounds.expandByPoint(point.fromBufferAttribute(positions, j).applyMatrix4(object.matrixWorld));
      }
    });
  }
  root.userData.cameraFitBounds = bounds.expandByScalar(0.1);
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredDetachedEscapementMovement(movement) {
  switch (movement.id) {
    case 308: return brownDetachedEscapement(movement);
    default: return null;
  }
}
