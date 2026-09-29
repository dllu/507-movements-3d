import { finishSounding247Parts } from './release-mechanism-working-parts.js';
import {
  capsule,
  plate as finitePlate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';
import * as THREE from 'three';
import { makeLaidRopeMesh } from './laid-rope.js';
import { groundBlock } from './ground-block.js';
import {
  PALETTE,
  makeBeam,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (u * (u * 6 - 15) + 10);
}

function smootherStepFirstDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * u ** 2 * (u - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * u * (u - 1) * (2 * u - 1);
}

function transitionState(time, start, end, from, to) {
  if (time <= start) return { acceleration: 0, value: from, velocity: 0 };
  if (time >= end) return { acceleration: 0, value: to, velocity: 0 };
  const duration = end - start;
  const u = (time - start) / duration;
  const travel = to - from;
  return {
    acceleration: travel * smootherStepSecondDerivative(u) / duration ** 2,
    value: from + travel * smootherStep01(u),
    velocity: travel * smootherStepFirstDerivative(u) / duration,
  };
}

function rotateVector2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    vector.x * cosine - vector.y * sine,
    vector.x * sine + vector.y * cosine,
  );
}

function rigidPointState(localPoint, angleState) {
  const point = rotateVector2(localPoint, angleState.value);
  return {
    acceleration: new THREE.Vector2(
      -point.x * angleState.velocity ** 2
        - point.y * angleState.acceleration,
      -point.y * angleState.velocity ** 2
        + point.x * angleState.acceleration,
    ),
    point,
    velocity: new THREE.Vector2(
      -point.y * angleState.velocity,
      point.x * angleState.velocity,
    ),
  };
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

// Closes an open TubeGeometry with a flat fan at each end that reuses the
// end-ring vertices, so the tube is a watertight solid.
function openCylinderAlongY({
  centerY,
  cutawayHalfAngle,
  height,
  material,
  radius,
  segments = 72,
}) {
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      segments,
      1,
      true,
      cutawayHalfAngle,
      FULL_TURN - 2 * cutawayHalfAngle,
    ),
    material,
  );
  shell.position.y = centerY;
  return shell;
}

function boredSphericalWeightProfile(outerRadius, boreRadius, samples = 72) {
  const openingHalfHeight = Math.sqrt(
    outerRadius ** 2 - boreRadius ** 2,
  );
  const outerPoints = Array.from({ length: samples + 1 }, (_, index) => {
    const y = THREE.MathUtils.lerp(
      -openingHalfHeight,
      openingHalfHeight,
      index / samples,
    );
    return new THREE.Vector2(
      Math.sqrt(Math.max(0, outerRadius ** 2 - y ** 2)),
      y,
    );
  });
  return {
    openingHalfHeight,
    points: [
      ...outerPoints,
      new THREE.Vector2(boreRadius, openingHalfHeight),
      new THREE.Vector2(boreRadius, -openingHalfHeight),
    ],
  };
}

function makeBoredSphericalWeight({
  boreRadius,
  cutawayHalfAngle,
  material,
  outerRadius,
  sectionMaterial,
}) {
  const profile = boredSphericalWeightProfile(outerRadius, boreRadius);
  const group = new THREE.Group();
  group.userData.role =
    'detachable-bored-spherical-sounding-weight-with-front-section-cutaway';
  const shell = new THREE.Mesh(
    new THREE.LatheGeometry(
      profile.points,
      112,
      cutawayHalfAngle,
      FULL_TURN - 2 * cutawayHalfAngle,
    ),
    material,
  );
  shell.userData.role = 'bored-lead-weight-shell';
  shell.userData.isMechanicallyCompleteDespiteDisplayCutaway = true;
  group.add(shell);

  const sectionShape = new THREE.Shape();
  profile.points.forEach((point, index) => {
    if (index === 0) sectionShape.moveTo(point.x, point.y);
    else sectionShape.lineTo(point.x, point.y);
  });
  sectionShape.closePath();
  const sectionGeometry = new THREE.ShapeGeometry(sectionShape, 24);
  const sectionFaces = [
    cutawayHalfAngle,
    FULL_TURN - cutawayHalfAngle,
  ].map((angle, index) => {
    const face = new THREE.Mesh(sectionGeometry, sectionMaterial);
    face.rotation.y = angle - Math.PI / 2;
    face.userData.role = `visible-weight-section-face-${index + 1}`;
    group.add(face);
    return face;
  });

  group.userData.boreRadius = boreRadius;
  group.userData.cutawayHalfAngle = cutawayHalfAngle;
  group.userData.openingHalfHeight = profile.openingHalfHeight;
  group.userData.outerRadius = outerRadius;
  return { group, sectionFaces, shell };
}

function solveDescendingAngleForReach(
  pivotX,
  localPoint,
  targetReach,
) {
  let engaged = 0;
  let retracted = -0.8;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (engaged + retracted) / 2;
    const reach = pivotX + rotateVector2(localPoint, middle).x;
    if (reach > targetReach) engaged = middle;
    else retracted = middle;
  }
  return (engaged + retracted) / 2;
}

function seabedTriggeredSoundingWeight(movement) {
  const root = new THREE.Group();

  // Brown's plate is a longitudinal section. The measurements below retain
  // its one sliding bottom probe, one fixed-axis bell crank, curved spring,
  // and the lower catch that supports the bored weight. The 3D model leaves
  // a front sector open so that the otherwise enclosed trip can be inspected.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.014;
  const sourceRodBounds = {
    bottom: 451,
    left: 240,
    right: 307,
    top: 20,
  };
  const sourceWeightBounds = {
    bottom: 385,
    left: 176,
    right: 383,
    top: 171,
  };
  const sourceWindowBounds = {
    bottom: 405,
    left: 252,
    right: 320,
    top: 198,
  };
  const sourceProbeFootBounds = {
    bottom: 512,
    left: 235,
    right: 288,
    top: 459,
  };
  const sourceLeverPivot = new THREE.Vector2(283, 322);
  const sourceProbeContact = new THREE.Vector2(258, 229);
  const sourceCatchSupport = new THREE.Vector2(322, 375);
  const sourceDetentTip = new THREE.Vector2(292, 266);

  const cyclePeriod = 13;
  const timeline = {
    loadedDwellEnd: 0.5,
    seabedContact: 3.3,
    supportRelease: 4.4,
    catchFullyRetracted: 4.6,
    weightImpact: 5.3,
    probeDecompressed: 5.6,
    // Loop reset (p98, the user's review): the same weight is used again,
    // and nothing leaves the view. The rod is lifted on its line out of the
    // spent weight (the catch rubs up the bore and snaps out over its top
    // rim) until its probe foot hangs clear above the weight.
    // Pass 99: the rod is then lowered back into the weight where it lies on
    // the bottom: the top rim cams the catch's sloped back inward and the
    // catch rides down the bore; the rod stops with its foot just clear of
    // the bottom. Nothing drawn can get the catch under a weight lying on the
    // bottom (the foot hangs 1.23 below the seat), so the weight is then slid
    // straight up the rod that runs through it (the reset lift, by the
    // leadsman, is not drawn): its lower opening passes the catch, which
    // springs out under it, and the weight is set down on the seat. The
    // weight is off the bottom and not on the catch only while it slides,
    // and the rod carries it up into Brown's pose.
    rodRecovered: 6.9,
    reloadedDescentBegins: 7.0,
    rodInBore: 9.6,
    weightLiftBegins: 9.7,
    catchSprungUnderWeight: 10.95,
    weightSeated: 11.3,
    rodReturned: cyclePeriod,
    cycleClosure: cyclePeriod,
  };

  const seabedY = 0;
  const housingRadius = 0.43;
  // Bore radius leaves the bell-crank roller (outer x 0.505 at z 0.18) clear
  // of the bore wall while the loaded weight sits on the catch.
  const boreRadius = 0.545;
  const boreRadialClearance = boreRadius - housingRadius;
  const weightOuterRadius = 1.5;
  const weightCutawayHalfAngle = 0.58;
  const weightProfile = boredSphericalWeightProfile(
    weightOuterRadius,
    boreRadius,
  );
  const weightOpeningHalfHeight = weightProfile.openingHalfHeight;
  const pivot = new THREE.Vector2(0.08, 0.35);
  const upperContactLocal = new THREE.Vector2(-0.52, 1.35);
  // p98: the catch's lower limb (seat, sloped back and tip) is tucked in by
  // catchTuck about the pivot from its earlier drawn-reach reconstruction,
  // so the relaxed seat stands out under the weight's rim by about 0.17
  // rather than 0.24 (the user: "a little bit too far out").
  const catchTuck = -0.08;
  const catchSupportDrawn = new THREE.Vector2(0.68, -0.72);
  const catchSupportLocal = rotateVector2(catchSupportDrawn, catchTuck);
  const probeFootContactLocalY = -1.6;
  const seabedContactBodyY = -probeFootContactLocalY;
  // Brown's pose: the loaded rod a little above the bottom, still being
  // lowered, so the fixed bottom is just in the view below the probe foot.
  const recoveredBodyY = seabedContactBodyY + 0.8;
  const releaseAngle = solveDescendingAngleForReach(
    pivot.x,
    catchSupportLocal,
    boreRadius,
  );
  const heldRetractedAngle = releaseAngle - 0.05;
  const rotatedUpperAtRest = rotateVector2(upperContactLocal, 0);
  const probeRiseAtAngle = (angle) => (
    rotateVector2(upperContactLocal, angle).y - rotatedUpperAtRest.y
  );
  const maximumProbeRise = probeRiseAtAngle(heldRetractedAngle);
  const compressedBodyY = seabedContactBodyY - maximumProbeRise;
  const engagedSupportLocalY = pivot.y + catchSupportLocal.y;
  const loadedWeightCenterRelativeY = engagedSupportLocalY
    + weightOpeningHalfHeight;
  const loadedWeightCenterY = recoveredBodyY
    + loadedWeightCenterRelativeY;
  const groundedWeightCenterY = seabedY + weightOpeningHalfHeight;
  // Reload with the same weight (p98). The weight is lifted just enough off
  // the bottom that, when the rod is lowered into it and the catch springs
  // out under its lower opening (catchSnapDepth below the seat), the probe
  // foot still hangs footClearance above the bottom, so the probe is not
  // tripped. Before that the rod is lifted until its foot is clearance
  // above the lifted weight's top.
  const footClearance = 0.12;
  const catchSnapDepth = 0.08;
  const reloadLowBodyY = seabedContactBodyY + footClearance;
  // Pass 99: the rod waits at reloadLowBodyY while the weight slides up.
  const seatedBodyY = reloadLowBodyY;
  // (liftedWeightCenterY, weightLiftHeight and clearBodyY are set below,
  // once the catch outline gives the seat's true rest height.)
  let liftedWeightCenterY = 0;
  let weightLiftHeight = 0;
  let clearBodyY = 0;
  // The sounding line runs from the rod's top eye straight up out of any view.
  const lineTopY = 60;

  const zeroAngleState = Object.freeze({
    acceleration: 0,
    value: 0,
    velocity: 0,
  });
  const heldAngleState = Object.freeze({
    acceleration: 0,
    value: heldRetractedAngle,
    velocity: 0,
  });

  // Inverse of probeRiseAtAngle on the working branch (angle 0 at no rise):
  // ux sin(a) + uy cos(a) = uy + rise.
  const upperReach = Math.hypot(upperContactLocal.x, upperContactLocal.y);
  const upperPhase = Math.atan2(upperContactLocal.y, upperContactLocal.x);
  const angleStateForProbeRise = (rise) => {
    const value = Math.PI
      - Math.asin((upperContactLocal.y + rise.value) / upperReach)
      - upperPhase;
    const sine = Math.sin(value);
    const cosine = Math.cos(value);
    const lever = upperContactLocal.x * cosine - upperContactLocal.y * sine;
    const velocity = rise.velocity / lever;
    const acceleration = (rise.acceleration
      + (upperContactLocal.x * sine + upperContactLocal.y * cosine)
        * velocity ** 2) / lever;
    return { acceleration, value, velocity };
  };

  // Brown's catch is a sloped barb: a rounded seat on top (the finite seat's
  // capsule) and, below it, a convex face running down and in to a tip
  // inside the bore. A weight pushed up the rod meets that face and cams the
  // sprung catch aside; once its lower opening passes the seat, the spring
  // swings the catch out under it. The same outline limits the catch while
  // it rubs up the spent weight's bore after the trip.
  const tucked = ([x, y]) => rotateVector2(new THREE.Vector2(x, y), catchTuck).toArray();
  const catchSeatStartLocal = tucked([0.30, -0.84]);
  const catchSeatRadius = 0.025;
  const catchNoseHalfDepth = 0.05;
  const catchTipCenter = [0.40, -1.08];
  const catchTipRadius = 0.03;
  const catchNoseProfile = (() => {
    const quadratic = (a, c, b, u) => [
      (1 - u) ** 2 * a[0] + 2 * (1 - u) * u * c[0] + u ** 2 * b[0],
      (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * c[1] + u ** 2 * b[1],
    ];
    const tipPoint = (degrees) => [
      catchTipCenter[0] + catchTipRadius * Math.cos(degrees * Math.PI / 180),
      catchTipCenter[1] + catchTipRadius * Math.sin(degrees * Math.PI / 180),
    ];
    // The face leaves the seat's rounded end tangentially.
    // Built in the drawn frame, then tucked in about the pivot.
    const seatEnd = catchSupportDrawn.toArray();
    const faceStartAngle = -20 * Math.PI / 180;
    const faceStart = [
      seatEnd[0] + catchSeatRadius * Math.cos(faceStartAngle),
      seatEnd[1] + catchSeatRadius * Math.sin(faceStartAngle),
    ];
    const faceControl = [
      faceStart[0] + 0.2 * Math.sin(faceStartAngle),
      faceStart[1] - 0.2 * Math.cos(faceStartAngle),
    ];
    const faceEnd = tipPoint(-40);
    // A tapered blade hung from the eye: its right edge runs down inside
    // the bore to the seat, which is the only part standing out under the
    // weight; the left edge runs straight down to the tip.
    const points = [[0.08, -0.17], [0.44, -0.77], seatEnd];
    for (let i = 0; i <= 32; i += 1) {
      points.push(quadratic(faceStart, faceControl, faceEnd, i / 32));
    }
    for (let i = 1; i <= 16; i += 1) points.push(tipPoint(-40 - 108 * i / 16));
    points.push([-0.07, -0.17]);
    return polygonClipping.union(
      poly(points.map(tucked)),
      capsule(catchSeatStartLocal, catchSupportLocal.toArray(),
        catchSeatRadius, 64),
    );
  })();
  // Outer-ring samples that can meet the weight (x > 0.15 in the catch).
  const catchNoseRing = catchNoseProfile[0][0];
  // The ring resampled at 0.01 or finer, so no edge slips between samples.
  const catchNoseSamples = [];
  for (let i = 0; i + 1 < catchNoseRing.length; i += 1) {
    const [ax, ay] = catchNoseRing[i];
    const [bx, by] = catchNoseRing[i + 1];
    const count = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.01));
    for (let k = 0; k < count; k += 1) {
      const x = ax + (bx - ax) * k / count;
      const y = ay + (by - ay) * k / count;
      if (x > 0.15) catchNoseSamples.push(new THREE.Vector2(x, y));
    }
  }
  const insideCatchNose = (x, y) => {
    let inside = false;
    for (let i = 0, j = catchNoseRing.length - 1; i < catchNoseRing.length; j = i, i += 1) {
      const [xi, yi] = catchNoseRing[i];
      const [xj, yj] = catchNoseRing[j];
      if ((yi > y) !== (yj > y)
        && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  // The faceted shell's inner facets (112 segments over the open sweep).
  const weightFacetBore = boreRadius * Math.cos(
    (FULL_TURN - 2 * weightCutawayHalfAngle) / (2 * 112),
  );
  const springContactClearance = 0.003;
  const catchHitsWeight = (angle, weightRelativeY) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const bore = weightFacetBore - springContactClearance;
    const outer = weightOuterRadius + springContactClearance;
    for (const point of catchNoseSamples) {
      const x = pivot.x + point.x * cosine - point.y * sine;
      const y = pivot.y + point.x * sine + point.y * cosine - weightRelativeY;
      if (Math.hypot(x, catchNoseHalfDepth) > bore
        && x * x + catchNoseHalfDepth ** 2 + y * y < outer * outer) return true;
    }
    // The bore's rims (at the nose's face depth) against the nose outline,
    // so that sliding over a rim is resolved continuously.
    const rimX = Math.sqrt(bore * bore - catchNoseHalfDepth ** 2) - pivot.x;
    const rimHeight = Math.sqrt(outer * outer - bore * bore);
    for (const rimY of [-rimHeight, rimHeight]) {
      const ry = weightRelativeY + rimY - pivot.y;
      if (insideCatchNose(rimX * cosine + ry * sine, -rimX * sine + ry * cosine)) {
        return true;
      }
    }
    return false;
  };
  const weightLimitedAngle = (weightRelativeY) => {
    if (!catchHitsWeight(0, weightRelativeY)) return 0;
    // The spring swings the catch out from the retracted side until it
    // first meets the weight: scan outward, then refine.
    let clear = heldRetractedAngle - 0.02;
    let blocked = clear + 0.005;
    while (blocked < 0 && !catchHitsWeight(blocked, weightRelativeY)) {
      clear = blocked;
      blocked += 0.005;
    }
    blocked = Math.min(blocked, 0);
    for (let iteration = 0; iteration < 30; iteration += 1) {
      const middle = (clear + blocked) / 2;
      if (catchHitsWeight(middle, weightRelativeY)) blocked = middle;
      else clear = middle;
    }
    return clear;
  };

  // The lowest weight height (relative to the rod) at which the relaxed
  // catch's finite nose clears it: where the seat meets the lifted weight.
  const seatRestRelativeY = (() => {
    let low = loadedWeightCenterRelativeY - 0.05;
    let high = loadedWeightCenterRelativeY + 0.3;
    for (let iteration = 0; iteration < 50; iteration += 1) {
      const middle = (low + high) / 2;
      if (catchHitsWeight(0, middle)) low = middle;
      else high = middle;
    }
    return high;
  })();
  // Top of the slide: catchSnapDepth above the seat, so the catch has
  // sprung out under the lower opening before the weight is set down on it.
  liftedWeightCenterY = reloadLowBodyY + seatRestRelativeY + catchSnapDepth;
  weightLiftHeight = liftedWeightCenterY - groundedWeightCenterY;
  clearBodyY = groundedWeightCenterY + weightOuterRadius
    - probeFootContactLocalY + 0.2;

  // Where the rims act on the catch (p98). Scanning the weight's height
  // relative to the rod upward (the rod going down into it): the top rim
  // cams the catch in over [topRim[0], topRim[1]], and it springs out under
  // the lower opening over [bottomRim[0], bottomRim[1]]. The rod is moved
  // slowly through these windows so the camming and the snap read clearly.
  const rimWindows = (() => {
    const step = 0.04;
    const limits = [];
    for (let rel = -3.2; rel <= seatRestRelativeY + 1e-9; rel += step) {
      limits.push([rel, weightLimitedAngle(rel)]);
    }
    const deepest = Math.min(...limits.map(([, angle]) => angle));
    const firstIndex = (from, test) => {
      for (let i = from; i < limits.length; i += 1) if (test(limits[i][1])) return i;
      return limits.length - 1;
    };
    // The first height in (limits[i - 1], limits[i]] passing the test.
    const refine = (i, test) => {
      let low = limits[i - 1][0], high = limits[i][0];
      for (let k = 0; k < 14; k += 1) {
        const middle = (low + high) / 2;
        if (test(weightLimitedAngle(middle))) high = middle; else low = middle;
      }
      return high;
    };
    const entering = (angle) => angle < -1e-3;
    const deep = (angle) => angle <= deepest + 1e-3;
    const leaving = (angle) => angle > deepest + 1e-3;
    const out = (angle) => angle >= -1e-3;
    const a = firstIndex(1, entering);
    const b = firstIndex(a, deep);
    const c = firstIndex(b, leaving);
    const d = firstIndex(c, out);
    const pad = 0.02;
    return {
      bottomRim: [refine(c, leaving) - pad, refine(d, out) + pad],
      deepest,
      topRim: [refine(a, entering) - pad, refine(b, deep) + pad],
    };
  })();
  // A C1 cubic-Hermite path through knots [time, value, velocity].
  const hermiteTrack = (knots) => (time) => {
    if (time <= knots[0][0]) return { acceleration: 0, value: knots[0][1], velocity: knots[0][2] };
    for (let i = 0; i + 1 < knots.length; i += 1) {
      const [t0, y0, v0] = knots[i];
      const [t1, y1, v1] = knots[i + 1];
      if (time > t1 && i + 2 < knots.length) continue;
      const h = t1 - t0;
      const u = THREE.MathUtils.clamp((time - t0) / h, 0, 1);
      const m0 = v0 * h, m1 = v1 * h;
      const value = (2 * u ** 3 - 3 * u ** 2 + 1) * y0 + (u ** 3 - 2 * u ** 2 + u) * m0
        + (-2 * u ** 3 + 3 * u ** 2) * y1 + (u ** 3 - u ** 2) * m1;
      const d1 = (6 * u ** 2 - 6 * u) * y0 + (3 * u ** 2 - 4 * u + 1) * m0
        + (-6 * u ** 2 + 6 * u) * y1 + (3 * u ** 2 - 2 * u) * m1;
      const d2 = (12 * u - 6) * y0 + (6 * u - 4) * m0 + (-12 * u + 6) * y1 + (6 * u - 2) * m1;
      return { acceleration: d2 / h ** 2, value, velocity: d1 / h };
    }
    const last = knots.at(-1);
    return { acceleration: 0, value: last[1], velocity: 0 };
  };
  // Lays a path from rest to rest through the given waypoints: `slow`
  // segments are crossed at rimSpeed, the rest share the remaining time in
  // proportion to their lengths.
  const rimSpeed = 0.45;
  const planTrack = (t0, t1, waypoints) => {
    const ys = waypoints.map(([y]) => y);
    const kinds = waypoints.slice(0, -1).map(([, kind]) => kind);
    const lengths = ys.slice(1).map((y, i) => Math.abs(y - ys[i]));
    // 'slow' at rimSpeed; 'settle' decelerates from rimSpeed to rest.
    const fixedTime = (i) => (kinds[i] === 'slow' ? lengths[i] / rimSpeed
      : kinds[i] === 'settle' ? 2 * lengths[i] / rimSpeed : 0);
    const slowTime = lengths.reduce((sum, l, i) => sum + fixedTime(i), 0);
    const fastLength = lengths.reduce((sum, l, i) => sum + (kinds[i] ? 0 : l), 0);
    const knots = [];
    let time = t0;
    const sign = Math.sign(ys.at(-1) - ys[0]);
    for (let i = 0; i < ys.length; i += 1) {
      const touchesSlow = (i > 0 && kinds[i - 1] === 'slow') || (i < kinds.length && kinds[i]);
      const velocity = i === 0 || i === ys.length - 1 ? 0 : touchesSlow ? sign * rimSpeed : 0;
      knots.push([time, ys[i], velocity]);
      if (i < lengths.length) {
        time += kinds[i] ? fixedTime(i) : (t1 - t0 - slowTime) * lengths[i] / fastLength;
      }
    }
    return hermiteTrack(knots);
  };
  // Rub-up out of the spent weight lying on the bottom (rel = weight - rod).
  const recoveryTrack = planTrack(timeline.probeDecompressed, timeline.rodRecovered, [
    [seabedContactBodyY, null],
    [groundedWeightCenterY - rimWindows.topRim[1], 'slow'],
    [groundedWeightCenterY - rimWindows.topRim[0], null],
    [clearBodyY],
  ]);
  // Pass 99: down into the weight lying on the bottom: through the top rim
  // and down the bore, stopping with the foot footClearance above the bottom.
  const reloadTrack = planTrack(timeline.reloadedDescentBegins, timeline.rodInBore, [
    [clearBodyY, null],
    [groundedWeightCenterY - rimWindows.topRim[0], 'slow'],
    [groundedWeightCenterY - rimWindows.topRim[1], null],
    [reloadLowBodyY],
  ]);
  // The weight slid up the rod: its lower opening passes the catch slowly,
  // the catch springs out under it, and it comes to rest catchSnapDepth
  // above the seat.
  const weightSlideTrack = planTrack(timeline.weightLiftBegins, timeline.catchSprungUnderWeight, [
    [groundedWeightCenterY, null],
    [reloadLowBodyY + rimWindows.bottomRim[0], 'slow'],
    [reloadLowBodyY + rimWindows.bottomRim[1], 'settle'],
    [liftedWeightCenterY],
  ]);

  const catchStateForTime = (cycleTime) => {
    if (cycleTime < timeline.seabedContact) return zeroAngleState;
    if (cycleTime < timeline.supportRelease) {
      return transitionState(
        cycleTime,
        timeline.seabedContact,
        timeline.supportRelease,
        0,
        releaseAngle,
      );
    }
    if (cycleTime < timeline.catchFullyRetracted) {
      return transitionState(
        cycleTime,
        timeline.supportRelease,
        timeline.catchFullyRetracted,
        releaseAngle,
        heldRetractedAngle,
      );
    }
    if (cycleTime < timeline.weightImpact) return heldAngleState;
    // The leaf spring keeps the upper arm's roller down on the pusher pad,
    // so the catch follows the probe back out as the rod is lifted off the
    // bottom (the weight's bore may stop it first: see catchStateWithWeight).
    if (cycleTime < timeline.probeDecompressed) {
      const rise = transitionState(
        cycleTime,
        timeline.weightImpact,
        timeline.probeDecompressed,
        maximumProbeRise,
        0,
      );
      return angleStateForProbeRise(rise);
    }
    return zeroAngleState;
  };

  const releaseAngleState = {
    acceleration: 0,
    value: releaseAngle,
    velocity: 0,
  };
  const releaseUpper = rigidPointState(
    upperContactLocal,
    releaseAngleState,
  );
  const releaseNose = rigidPointState(
    catchSupportLocal,
    releaseAngleState,
  );
  const probeRiseAtRelease = releaseUpper.point.y
    - upperContactLocal.y;
  const releaseBodyY = seabedContactBodyY - probeRiseAtRelease;
  const releaseLowerOpeningY = releaseBodyY + pivot.y
    + releaseNose.point.y;
  const releaseWeightCenterY = releaseLowerOpeningY
    + weightOpeningHalfHeight;
  const fallDuration = timeline.weightImpact - timeline.supportRelease;
  const modelGravity = 2 * (releaseWeightCenterY - groundedWeightCenterY)
    / fallDuration ** 2;
  Object.freeze(timeline);
  // The reset lift (pass 99): the weight slides up the rod over the catch,
  // then is set down on the sprung-out seat.
  const liftedWeightYState = (cycleTime) => (cycleTime < timeline.catchSprungUnderWeight
    ? weightSlideTrack(cycleTime)
    : transitionState(cycleTime, timeline.catchSprungUnderWeight, timeline.weightSeated,
      liftedWeightCenterY, reloadLowBodyY + seatRestRelativeY));
  const weightLiftProgress = (cycleTime) => transitionState(cycleTime,
    timeline.weightLiftBegins, timeline.weightSeated, 0, 1);

  const bodyStateForTime = (cycleTime, catchAngleState) => {
    if (cycleTime < timeline.loadedDwellEnd) {
      return { acceleration: 0, value: recoveredBodyY, velocity: 0 };
    }
    if (cycleTime < timeline.seabedContact) {
      return transitionState(
        cycleTime,
        timeline.loadedDwellEnd,
        timeline.seabedContact,
        recoveredBodyY,
        seabedContactBodyY,
      );
    }
    if (cycleTime < timeline.catchFullyRetracted) {
      const upper = rigidPointState(upperContactLocal, catchAngleState);
      const probeOffset = upper.point.y - upperContactLocal.y;
      const probeVelocity = upper.velocity.y;
      const probeAcceleration = upper.acceleration.y;
      return {
        acceleration: -probeAcceleration,
        value: seabedContactBodyY - probeOffset,
        velocity: -probeVelocity,
      };
    }
    if (cycleTime < timeline.weightImpact) {
      return { acceleration: 0, value: compressedBodyY, velocity: 0 };
    }
    if (cycleTime < timeline.probeDecompressed) {
      return transitionState(
        cycleTime,
        timeline.weightImpact,
        timeline.probeDecompressed,
        compressedBodyY,
        seabedContactBodyY,
      );
    }
    if (cycleTime < timeline.rodRecovered) return recoveryTrack(cycleTime);
    if (cycleTime < timeline.reloadedDescentBegins) {
      return { acceleration: 0, value: clearBodyY, velocity: 0 };
    }
    if (cycleTime < timeline.rodInBore) return reloadTrack(cycleTime);
    if (cycleTime < timeline.weightSeated) {
      return { acceleration: 0, value: reloadLowBodyY, velocity: 0 };
    }
    return transitionState(cycleTime, timeline.weightSeated,
      timeline.rodReturned, seatedBodyY, recoveredBodyY);
  };

  const weightStateForTime = (
    cycleTime,
    bodyState,
    catchAngleState,
  ) => {
    if (cycleTime < timeline.loadedDwellEnd) {
      return {
        acceleration: 0,
        externallySupported: false,
        value: loadedWeightCenterY,
        velocity: 0,
      };
    }
    if (cycleTime < timeline.seabedContact) {
      return {
        acceleration: bodyState.acceleration,
        externallySupported: false,
        value: bodyState.value + loadedWeightCenterRelativeY,
        velocity: bodyState.velocity,
      };
    }
    if (cycleTime < timeline.supportRelease) {
      const support = rigidPointState(
        catchSupportLocal,
        catchAngleState,
      );
      return {
        acceleration: bodyState.acceleration + support.acceleration.y,
        externallySupported: false,
        value: bodyState.value + pivot.y + support.point.y
          + weightOpeningHalfHeight,
        velocity: bodyState.velocity + support.velocity.y,
      };
    }
    if (cycleTime < timeline.weightImpact) {
      const elapsed = cycleTime - timeline.supportRelease;
      return {
        acceleration: -modelGravity,
        externallySupported: false,
        value: releaseWeightCenterY
          - modelGravity * elapsed ** 2 / 2,
        velocity: -modelGravity * elapsed,
      };
    }
    if (cycleTime < timeline.weightLiftBegins) {
      return {
        acceleration: 0,
        externallySupported: false,
        value: groundedWeightCenterY,
        velocity: 0,
      };
    }
    // The same weight, lifted off the bottom and held by the reset lift.
    if (cycleTime < timeline.weightSeated) {
      return { ...liftedWeightYState(cycleTime), externallySupported: true };
    }
    // Seated on the sprung-out catch and carried up with the rod.
    return {
      acceleration: bodyState.acceleration,
      externallySupported: false,
      value: bodyState.value + seatRestRelativeY,
      velocity: bodyState.velocity,
    };
  };

  const stageAtTime = (cycleTime) => {
    if (cycleTime < timeline.loadedDwellEnd) return 'loaded-dwell';
    if (cycleTime < timeline.seabedContact) return 'descent';
    if (cycleTime < timeline.supportRelease) return 'probe-trigger';
    if (cycleTime < timeline.catchFullyRetracted) {
      return 'catch-clearance-and-free-fall';
    }
    if (cycleTime < timeline.weightImpact) return 'weight-free-fall';
    if (cycleTime < timeline.probeDecompressed) {
      return 'probe-decompression-catch-sprung-against-bore';
    }
    if (cycleTime < timeline.rodRecovered) {
      return 'rod-lifted-out-of-spent-weight-catch-snaps-out-over-top-rim';
    }
    if (cycleTime < timeline.reloadedDescentBegins) {
      return 'rod-hangs-above-spent-weight';
    }
    if (cycleTime < timeline.weightLiftBegins) {
      return 'rod-lowered-into-weight-on-bottom-top-rim-cams-catch-in';
    }
    if (cycleTime < timeline.catchSprungUnderWeight) {
      return 'weight-slid-up-rod-catch-springs-out-under-it';
    }
    if (cycleTime < timeline.weightSeated) {
      return 'weight-set-down-on-seat';
    }
    return 'rod-carries-weight-up-to-brown-pose';
  };

  // While no weight rests on it (after the spent weight lands, until the
  // catch has sprung out under the lifted weight), the sprung catch stands as far out as the probe
  // pad and the weight's bore and faces allow.
  const weightLimitActive = (cycleTime) => cycleTime >= timeline.weightImpact
    && cycleTime < timeline.catchSprungUnderWeight;
  const sprungCatchAngle = (cycleTime) => {
    const base = catchStateForTime(cycleTime);
    if (!weightLimitActive(cycleTime)) return base.value;
    const body = bodyStateForTime(cycleTime, base);
    const weight = weightStateForTime(cycleTime, body, base);
    return Math.min(base.value, weightLimitedAngle(weight.value - body.value));
  };
  const catchStateWithWeight = (cycleTime) => {
    const base = catchStateForTime(cycleTime);
    if (!weightLimitActive(cycleTime)) return { ...base, weightLimited: false };
    const value = sprungCatchAngle(cycleTime);
    if (value >= base.value) return { ...base, weightLimited: false };
    const step = 1e-4;
    const before = sprungCatchAngle(cycleTime - step);
    const after = sprungCatchAngle(cycleTime + step);
    return {
      acceleration: (after - 2 * value + before) / step ** 2,
      value,
      velocity: (after - before) / (2 * step),
      weightLimited: true,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = positiveModulo(time, cyclePeriod);
    const catchAngleState = catchStateWithWeight(cycleTime);
    const catchUpper = rigidPointState(
      upperContactLocal,
      catchAngleState,
    );
    const catchSupport = rigidPointState(
      catchSupportLocal,
      catchAngleState,
    );
    const body = bodyStateForTime(cycleTime, catchAngleState);

    let probeOffset = 0;
    let probeVelocity = 0;
    let probeAcceleration = 0;
    if (cycleTime >= timeline.seabedContact
      && cycleTime < timeline.catchFullyRetracted) {
      probeOffset = catchUpper.point.y - upperContactLocal.y;
      probeVelocity = catchUpper.velocity.y;
      probeAcceleration = catchUpper.acceleration.y;
    } else if (cycleTime >= timeline.catchFullyRetracted
      && cycleTime < timeline.weightImpact) {
      probeOffset = maximumProbeRise;
    } else if (cycleTime >= timeline.weightImpact
      && cycleTime < timeline.probeDecompressed) {
      probeOffset = seabedContactBodyY - body.value;
      probeVelocity = -body.velocity;
      probeAcceleration = -body.acceleration;
    }

    const weight = weightStateForTime(
      cycleTime,
      body,
      catchAngleState,
    );
    const catchUpperWorld = new THREE.Vector3(
      pivot.x + catchUpper.point.x,
      body.value + pivot.y + catchUpper.point.y,
      0.25,
    );
    const catchSupportWorld = new THREE.Vector3(
      pivot.x + catchSupport.point.x,
      body.value + pivot.y + catchSupport.point.y,
      0.25,
    );
    const probePusherWorldY = body.value + pivot.y
      + upperContactLocal.y + probeOffset;
    const probeFootContactY = body.value + probeFootContactLocalY
      + probeOffset;
    const weightLowerOpeningY = weight.value - weightOpeningHalfHeight;
    const weightUpperOpeningY = weight.value + weightOpeningHalfHeight;
    const supportRadialReach = catchSupportWorld.x;
    const supportOverlap = supportRadialReach - boreRadius;
    const catchSprungAgainstWeight = catchAngleState.weightLimited;
    const weightReload = cycleTime >= timeline.weightLiftBegins
      && cycleTime < timeline.weightSeated;
    // The spring holds the roller on the pad unless the weight holds the
    // catch further in.
    const probeToCatchContactActive = !catchSprungAgainstWeight;
    const catchToWeightContactActive = (
      cycleTime < timeline.supportRelease
      || cycleTime >= timeline.weightSeated
    );
    const weightOnSeabed = cycleTime >= timeline.weightImpact
      && cycleTime < timeline.weightLiftBegins;

    return {
      bodyAcceleration: body.acceleration,
      bodyPositionY: body.value,
      bodyVelocity: body.velocity,
      catchAngle: catchAngleState.value,
      catchAngularAcceleration: catchAngleState.acceleration,
      catchAngularSpeed: catchAngleState.velocity,
      catchSupportAcceleration: new THREE.Vector3(
        catchSupport.acceleration.x,
        body.acceleration + catchSupport.acceleration.y,
        0,
      ),
      catchSupportPosition: catchSupportWorld,
      catchSupportVelocity: new THREE.Vector3(
        catchSupport.velocity.x,
        body.velocity + catchSupport.velocity.y,
        0,
      ),
      catchToWeightContactActive,
      catchUpperPosition: catchUpperWorld,
      cyclePhase: cycleTime / cyclePeriod,
      cycleTime,
      catchSprungAgainstWeight,
      weightReload,
      weightLiftProgress: weightLiftProgress(cycleTime).value,
      weightLiftProgressRate: weightLiftProgress(cycleTime).velocity,
      weightLiftProgressAcceleration: weightLiftProgress(cycleTime).acceleration,
      probeAcceleration,
      probeFootContactY,
      probeOffset,
      probePusherClearance: catchUpperWorld.y - probePusherWorldY,
      probePusherWorldY,
      probeToCatchContactActive,
      probeVelocity,
      sourcePose: cycleTime === 0,
      stage: stageAtTime(cycleTime),
      supportOverlap,
      supportRadialClearance: boreRadius - supportRadialReach,
      supportRadialReach,
      weightAcceleration: weight.acceleration,
      weightCenterY: weight.value,
      weightExternallySupported: weight.externallySupported,
      weightLowerOpeningY,
      weightOnSeabed,
      weightUpperOpeningY,
      weightVelocity: weight.velocity,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(phase * cyclePeriod);

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const housingMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
    side: THREE.DoubleSide,
  });
  const housingSectionMaterial = matte(0xb84a35, {
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const catchMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.5,
  });
  // Steel probe: a white probe would read as a gap on the cream page.
  const probeMaterial = matte(PALETTE.muted, { metalness: 0.2, roughness: 0.46 });
  const weightMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.57,
    side: THREE.DoubleSide,
  });
  const weightSectionMaterial = matte(0x234b62, {
    metalness: 0.08,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const seabed = new THREE.Group();
  // Brown draws no sea bottom, but the caption has the weight detach on
  // striking it. It is a plain fixed block of bottom whose top is the
  // contact plane. The default view sees its top edge-on at the lower frame
  // edge. (p98: the vessel no longer moves on between soundings, so the
  // bottom is plain and still; its earlier travelling bands are gone.)
  const seabedThickness = 3.6;
  const seabedLength = 30;
  const seabedSlab = groundBlock(seabedLength, seabedThickness, 3.4, {
    name: 'sea-bottom-contact-plane',
  });
  seabedSlab.position.set(0, seabedY - seabedThickness / 2, 0);
  const seabedRings = [];
  seabed.add(seabedSlab);
  seabed.userData.fixed = true;
  seabed.userData.role = 'fixed-sea-bottom';
  root.add(seabed);

  const bodyAssembly = new THREE.Group();
  bodyAssembly.userData.axis = new THREE.Vector3(0, 1, 0);
  bodyAssembly.userData.role = 'recoverable-hollow-sounding-rod';
  // Brown breaks the rod off at the top of the plate; it runs on whole to
  // its line eye just above the view.
  const housingTop = new THREE.Mesh(
    new THREE.CylinderGeometry(housingRadius, housingRadius, 3.3, 72),
    housingMaterial,
  );
  housingTop.position.y = 3.55;
  housingTop.userData.role = 'solid-upper-sounding-rod';
  // Brown draws a longitudinal section, so the rod is shown as its back half
  // (the front 206 degrees open). The bell crank, probe pad and catch nose
  // swing outside the rod radius and must pass through that opening.
  const housingCutawayHalfAngle = 1.8;
  const windowShell = openCylinderAlongY({
    centerY: 0.55,
    cutawayHalfAngle: housingCutawayHalfAngle,
    height: 2.7,
    material: housingMaterial,
    radius: housingRadius,
  });
  windowShell.userData.role = 'front-open-trip-mechanism-housing';
  windowShell.userData.frontWindowIsPhysicalOpening = true;
  const lowerHousing = openCylinderAlongY({
    centerY: -1.05,
    cutawayHalfAngle: housingCutawayHalfAngle,
    height: 0.5,
    material: housingMaterial,
    radius: housingRadius,
  });
  lowerHousing.userData.role = 'lower-open-guide-sleeve';
  // Narrow enough that its back corners stay inside the weight's bore.
  const windowBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.60, 2.55, 0.09),
    housingSectionMaterial,
  );
  windowBack.position.set(0, 0.55, -0.36);
  windowBack.userData.role = 'sectioned-back-wall-of-hollow-rod';
  const lowerGuideBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.42, 0.68),
    housingSectionMaterial,
  );
  // Raised clear of the probe foot at the probe's greatest rise.
  lowerGuideBlock.position.set(0, -1.10, -0.02);
  lowerGuideBlock.userData.role = 'probe-lower-guide-block';
  bodyAssembly.add(
    housingTop,
    windowShell,
    lowerHousing,
    windowBack,
    lowerGuideBlock,
  );

  const probeAssembly = new THREE.Group();
  probeAssembly.userData.axis = new THREE.Vector3(0, 1, 0);
  probeAssembly.userData.role =
    'bottom-projecting-seabed-probe-sliding-relative-to-rod';
  // Pass 104: Brown draws a T probe: a stem near the rod's axis (his is
  // 0.10 left of it) carrying a symmetric foot. The stem runs 0.14 left of
  // the axis, as near as the bell-crank pivot pin allows (0.07 clear of it
  // in plan), up the guide block's bore to the pusher pad under the upper
  // arm's roller. The pad already spans x -0.45 .. 0.14, so the roller
  // contact, and with it the trip timing, is unchanged.
  const probeX = -0.14;
  const probeShaftTopY = pivot.y + upperContactLocal.y - 0.08;
  const probeShaftBottomY = probeFootContactLocalY + 0.12;
  const probeShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.055,
      0.055,
      probeShaftTopY - probeShaftBottomY,
      24,
    ),
    probeMaterial,
  );
  // The stem runs in front of the bell-crank plane, under the pusher pad.
  probeShaft.position.set(
    probeX,
    (probeShaftTopY + probeShaftBottomY) / 2,
    0.41,
  );
  probeShaft.userData.role = 'vertical-sliding-probe-stem';
  const probePusher = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.12, 0.22),
    probeMaterial,
  );
  probePusher.position.set(
    probeX + 0.055,
    pivot.y + upperContactLocal.y - 0.06,
    0.25,
  );
  probePusher.userData.contactSurfaceY = pivot.y + upperContactLocal.y;
  probePusher.userData.role = 'probe-upper-pusher-pad';
  // A symmetric T foot (+-0.25) centred on the stem; it passes up through
  // the released weight's bore when the rod is recovered.
  const probeFoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.18, 0.42),
    probeMaterial,
  );
  probeFoot.position.set(
    probeX,
    probeFootContactLocalY + 0.09,
    0.25,
  );
  probeFoot.userData.contactSurfaceY = probeFootContactLocalY;
  probeFoot.userData.role = 'seabed-contact-foot';
  probeAssembly.add(probeShaft, probePusher, probeFoot);
  bodyAssembly.add(probeAssembly);

  const catchAssembly = new THREE.Group();
  catchAssembly.position.set(pivot.x, pivot.y, 0.25);
  catchAssembly.userData.axis = Z_AXIS.clone();
  catchAssembly.userData.role =
    'single-rigid-bell-crank-and-weight-support-catch';
  const upperCatchArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      upperContactLocal.x,
      upperContactLocal.y,
      0,
    ),
    {
      color: PALETTE.brass,
      depth: 0.18,
      jointRadius: 0.095,
      thickness: 0.13,
    },
  );
  upperCatchArm.userData.role = 'probe-driven-upper-bell-crank-arm';
  const lowerCatchArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      catchSupportLocal.x - 0.08,
      catchSupportLocal.y + 0.06,
      0,
    ),
    {
      color: PALETTE.brass,
      depth: 0.18,
      jointRadius: 0.095,
      thickness: 0.17,
    },
  );
  lowerCatchArm.userData.role = 'lower-weight-releasing-catch-arm';
  const catchNoseShape = new THREE.Shape();
  catchNoseShape.moveTo(0.43, -0.73);
  catchNoseShape.lineTo(catchSupportLocal.x, catchSupportLocal.y);
  catchNoseShape.lineTo(0.55, -0.55);
  catchNoseShape.lineTo(0.40, -0.61);
  catchNoseShape.closePath();
  const catchNoseGeometry = new THREE.ExtrudeGeometry(catchNoseShape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    depth: 0.18,
  });
  catchNoseGeometry.translate(0, 0, -0.09);
  const catchNose = new THREE.Mesh(catchNoseGeometry, catchMaterial);
  catchNose.userData.localSupportPoint = catchSupportLocal.clone();
  catchNose.userData.role = 'radially-withdrawing-weight-support-nose';
  const catchIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    probeMaterial,
  );
  catchIndex.position.set(catchSupportLocal.x, catchSupportLocal.y, 0.11);
  catchIndex.userData.role = 'white-catch-contact-index';
  catchAssembly.add(
    upperCatchArm,
    lowerCatchArm,
    catchNose,
    catchIndex,
  );
  bodyAssembly.add(catchAssembly);

  const pivotPin = cylinderAlongZ(0.15, 0.72, darkMaterial, 36);
  pivotPin.position.set(pivot.x, pivot.y, 0.25);
  pivotPin.userData.fixedToHousing = true;
  pivotPin.userData.role = 'fixed-bell-crank-pivot-pin';
  bodyAssembly.add(pivotPin);

  // Brown's curved spring: a flat steel leaf fixed in the underside of the
  // solid rod above the window, bowed out to the right and ending in a
  // rolled curl that bears on the right edge of the upper arm. It presses
  // the arm to the left, which turns the catch outward (into engagement) and
  // keeps the arm's roller down on the probe pad; the probe's rise turns the
  // catch in against it and deflects the leaf. It is rebuilt in place each
  // frame (a deforming part) with a fixed vertex count.
  const springThickness = 0.04;
  const springHalfDepth = 0.05;
  const springCurlRadius = 0.055;
  // Set right of the arm's retracted top, so the swinging arm clears it.
  const springAnchor = new THREE.Vector2(0.22, 1.95);
  const springAnchorTangent = new THREE.Vector2(0.35, -0.94).normalize();
  const upperArmHalfWidth = 0.065;
  const upperArmDirection = upperContactLocal.clone().normalize();
  const upperArmRightNormal = new THREE.Vector2(
    upperArmDirection.y,
    -upperArmDirection.x,
  );
  const springBearingDistance = 0.72 * upperContactLocal.length();
  // Faceting allowance, so the rendered curl rests on the arm's edge.
  const springBearingClearance = 0.004;
  const springBowSamples = 30;
  const springCurlSamples = 16;
  const springSamples = springBowSamples + springCurlSamples;
  const springCenterline = (catchAngle) => {
    const along = rotateVector2(
      upperArmDirection.clone().multiplyScalar(springBearingDistance),
      catchAngle,
    ).add(pivot);
    const normal = rotateVector2(upperArmRightNormal, catchAngle);
    const curlCenter = along.clone().addScaledVector(
      normal,
      upperArmHalfWidth + springCurlRadius + springThickness / 2
        + springBearingClearance,
    );
    const curlStart = curlCenter.clone().add(
      new THREE.Vector2(springCurlRadius, 0),
    );
    const c1 = springAnchor.clone().addScaledVector(springAnchorTangent, 0.3);
    const c2 = curlStart.clone().add(new THREE.Vector2(0, 0.34));
    const points = [];
    for (let i = 0; i < springBowSamples; i += 1) {
      const u = i / springBowSamples;
      const v = 1 - u;
      points.push(new THREE.Vector2(
        v ** 3 * springAnchor.x + 3 * v * v * u * c1.x
          + 3 * v * u * u * c2.x + u ** 3 * curlStart.x,
        v ** 3 * springAnchor.y + 3 * v * v * u * c1.y
          + 3 * v * u * u * c2.y + u ** 3 * curlStart.y,
      ));
    }
    // The curl runs on past its bearing point, which faces the arm.
    const bearingAngle = Math.atan2(-normal.y, -normal.x);
    const curlEnd = (bearingAngle > 0 ? bearingAngle - FULL_TURN : bearingAngle)
      - 0.9;
    for (let i = 0; i < springCurlSamples; i += 1) {
      const angle = curlEnd * i / (springCurlSamples - 1);
      points.push(new THREE.Vector2(
        curlCenter.x + springCurlRadius * Math.cos(angle),
        curlCenter.y + springCurlRadius * Math.sin(angle),
      ));
    }
    return { bearing: along.addScaledVector(normal, upperArmHalfWidth), points };
  };
  // A closed, welded strip: four corners per sample, four side faces and
  // two end caps.
  const springGeometry = new THREE.BufferGeometry();
  springGeometry.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array(springSamples * 4 * 3), 3,
  ));
  {
    const index = [];
    // Corners: 0 (+side, back), 1 (+side, front), 2 (-side, front),
    // 3 (-side, back); faces run 0-1, 1-2, 2-3, 3-0.
    for (let i = 0; i < springSamples - 1; i += 1) {
      for (let c = 0; c < 4; c += 1) {
        const a = i * 4 + c;
        const b = i * 4 + (c + 1) % 4;
        const a2 = a + 4;
        const b2 = b + 4;
        index.push(a, b, a2, b, b2, a2);
      }
    }
    const last = (springSamples - 1) * 4;
    index.push(0, 2, 1, 0, 3, 2);
    index.push(last, last + 1, last + 2, last, last + 2, last + 3);
    springGeometry.setIndex(index);
  }
  const springFront = 0.25 + springHalfDepth;
  const springBack = 0.25 - springHalfDepth;
  const springCorners = [[1, springBack], [1, springFront], [-1, springFront],
    [-1, springBack]];
  const writeSpring = (catchAngle) => {
    const { points } = springCenterline(catchAngle);
    const position = springGeometry.attributes.position;
    for (let i = 0; i < springSamples; i += 1) {
      const previous = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const tangent = next.clone().sub(previous).normalize();
      springCorners.forEach(([side, z], c) => {
        position.setXYZ(
          i * 4 + c,
          points[i].x - tangent.y * side * springThickness / 2,
          points[i].y + tangent.x * side * springThickness / 2,
          z,
        );
      });
    }
    position.needsUpdate = true;
    springGeometry.computeVertexNormals();
    springGeometry.computeBoundingSphere();
    springGeometry.computeBoundingBox();
  };
  writeSpring(0);
  const detentSpring = new THREE.Group();
  const detentSpringMesh = new THREE.Mesh(
    springGeometry,
    matte(PALETTE.ink, { metalness: 0.3, roughness: 0.5 }),
  );
  detentSpringMesh.userData.role =
    'curled-leaf-spring-loading-catch-into-engagement';
  detentSpring.add(detentSpringMesh);
  detentSpring.userData.setAngle = writeSpring;
  detentSpring.userData.centerline = springCenterline;
  detentSpring.userData.role =
    'curled-leaf-spring-loading-catch-into-engagement';
  bodyAssembly.add(detentSpring);
  root.add(bodyAssembly);

  const weightParts = makeBoredSphericalWeight({
    boreRadius,
    cutawayHalfAngle: weightCutawayHalfAngle,
    material: weightMaterial,
    outerRadius: weightOuterRadius,
    sectionMaterial: weightSectionMaterial,
  });
  const weightAssembly = weightParts.group;
  weightAssembly.userData.massRole = 'discarded-ballast';
  root.add(weightAssembly);

  // The sounding line: tied through an eye on the rod's top end (above
  // Brown's crop) and running straight
  // in every phase up out of any view to the vessel (lineTopY): the rod is
  // lowered and lifted on it. (p98: nothing runs down it any more.)
  const rodTopLocalY = housingTop.position.y + 1.65;
  const lineEye = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 12, 32), darkMaterial);
  lineEye.position.set(0, rodTopLocalY + 0.13, 0);
  lineEye.userData.role = 'sounding-line-eye-on-rod-top';
  const lineEyeShank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 20), darkMaterial);
  lineEyeShank.position.set(0, rodTopLocalY + 0.02, 0);
  lineEyeShank.userData.role = 'sounding-line-eye-shank';
  bodyAssembly.add(lineEye, lineEyeShank);
  const lineRadius = 0.045;
  const lineMaterial = matte(PALETTE.belt, { roughness: 0.76 });
  const linePlaceholder = new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
  const soundingLine = makeLaidRopeMesh(linePlaceholder, lineMaterial, { radius: lineRadius, tubularSegments: 96 });
  soundingLine.userData.role = 'sounding-line-tied-to-rod';
  const lineKnot = new THREE.Mesh(new THREE.SphereGeometry(lineRadius * 1.7, 16, 12), lineMaterial);
  lineKnot.userData.role = 'sounding-line-knot-at-eye';
  const soundingLineGroup = new THREE.Group();
  soundingLineGroup.userData.role = 'sounding-line';
  soundingLineGroup.add(soundingLine, lineKnot);
  root.add(soundingLineGroup);

  root.userData.archetype =
    'seabed-triggered-sounding-weight-release-with-sliding-probe-and-latched-bell-crank';
  root.userData.mechanism =
    'bottom-probe-slides-upward-against-a-spring-loaded-bell-crank-which-withdraws-the-sloped-catch-from-beneath-the-bored-sounding-weight';
  root.userData.blocks = {
    bodyAssembly,
    catchAssembly,
    catchIndex,
    catchNose,
    detentSpring,
    housingTop,
    lowerGuideBlock,
    lowerHousing,
    pivotPin,
    probeAssembly,
    probeFoot,
    probePusher,
    probeShaft,
    lineEye,
    seabed,
    soundingLine,
    seabedSlab,
    weightAssembly,
    weightSectionFaces: weightParts.sectionFaces,
    weightShell: weightParts.shell,
    windowBack,
    windowShell,
  };
  root.userData.geometry = {
    catchNoseHalfDepth,
    catchNoseProfile,
    boreRadialClearance,
    boreRadius,
    catchSupportLocal: catchSupportLocal.clone(),
    compressedBodyY,
    engagedSupportLocalY,
    heldRetractedAngle,
    housingRadius,
    loadedWeightCenterRelativeY,
    loadedWeightCenterY,
    maximumProbeRise,
    modelGravity,
    pivot: pivot.clone(),
    clearBodyY,
    lineTopY,
    groundedWeightCenterY,
    seabedLength,
    catchTuck,
    catchSeatStartLocal: [...catchSeatStartLocal],
    footClearance,
    catchSnapDepth,
    reloadLowBodyY,
    seatedBodyY,
    liftedWeightCenterY,
    rimWindows,
    seatRestRelativeY,
    weightLiftHeight,
    probeFootContactLocalY,
    recoveredBodyY,
    releaseAngle,
    releaseBodyY,
    releaseLowerOpeningY,
    releaseWeightCenterY,
    seabedContactBodyY,
    seabedY,
    sourceScale,
    upperContactLocal: upperContactLocal.clone(),
    weightCutawayHalfAngle,
    weightOpeningHalfHeight,
    weightOuterRadius,
  };
  root.userData.timeline = {
    ...timeline,
    demonstrationPeriod: cyclePeriod,
  };
  root.userData.transmission = {
    automaticReset: false,
    catchDetainedAfterTrip: false,
    catchSpringLoadedIntoEngagement: true,
    catchSelfSetsOnReload: true,
    catchType: 'single-pivot-bell-crank-with-radial-support-nose',
    input: 'bottom-projecting-seabed-probe',
    loopReset:
      'rod-lifted-out-of-spent-weight-same-weight-lifted-slightly-off-bottom-rod-lowered-into-it-catch-cammed-in-by-top-rim-springs-out-under-it',
    oneShotRelease: true,
    output: 'detachable-bored-sounding-weight',
    probeDegreeOfFreedom: 'one-vertical-prismatic-slide-relative-to-rod',
    trigger:
      'probe-foot-contact-with-seabed-followed-by-rod-overtravel',
  };
  root.userData.sourceAnimation = {
    available: false,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    reason: 'The official Movement 247 page marks its animation unavailable.',
    referenceScope:
      'sectional topology, seabed-probe input, catch withdrawal, dropped weight, and light-rod recovery',
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate247: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one bottom slider contacts one pivoted catch with a sloped nose; a curved leaf spring loads the catch outward under the bored spherical weight',
      measurementUncertaintyPixels: 4,
      officialAnimationAvailable: false,
      rasterCatchSupport: sourceCatchSupport.clone(),
      rasterDetentTip: sourceDetentTip.clone(),
      rasterLeverPivot: sourceLeverPivot.clone(),
      rasterProbeContact: sourceProbeContact.clone(),
      rasterProbeFootBounds: { ...sourceProbeFootBounds },
      rasterRodBounds: { ...sourceRodBounds },
      rasterWeightBounds: { ...sourceWeightBounds },
      rasterWindowBounds: { ...sourceWindowBounds },
      view: 'longitudinal-section-through-rod-and-bored-weight',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
  };
  root.userData.catchWeightLimit = { catchHitsWeight, weightLimitedAngle };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.canonicalStates = {
    impact: stateAtTime(timeline.weightImpact),
    loaded: stateAtTime(0),
    recovered: stateAtTime(timeline.rodRecovered),
    release: stateAtTime(timeline.supportRelease),
    seabedContact: stateAtTime(timeline.seabedContact),
  };

  const update = (time) => {
    const state = stateAtTime(time);
    bodyAssembly.position.y = state.bodyPositionY;
    probeAssembly.position.y = state.probeOffset;
    catchAssembly.rotation.z = state.catchAngle;
    weightAssembly.position.y = state.weightCenterY;

    detentSpring.userData.setAngle(state.catchAngle);

    // The line leaves the top of the eye, knotted there.
    const eyeTop = new THREE.Vector3(0, state.bodyPositionY + rodTopLocalY + 0.13 + 0.13, 0);
    lineKnot.position.copy(eyeTop);
    soundingLine.userData.setCurve(new THREE.LineCurve3(eyeTop, new THREE.Vector3(0, lineTopY, 0)));

    bodyAssembly.userData.velocity = new THREE.Vector3(
      0,
      state.bodyVelocity,
      0,
    );
    bodyAssembly.userData.acceleration = new THREE.Vector3(
      0,
      state.bodyAcceleration,
      0,
    );
    probeAssembly.userData.velocity = new THREE.Vector3(
      0,
      state.probeVelocity,
      0,
    );
    probeAssembly.userData.acceleration = new THREE.Vector3(
      0,
      state.probeAcceleration,
      0,
    );
    catchAssembly.userData.angularSpeed = state.catchAngularSpeed;
    catchAssembly.userData.angularAcceleration =
      state.catchAngularAcceleration;
    weightAssembly.userData.velocity = new THREE.Vector3(
      0,
      state.weightVelocity,
      0,
    );
    weightAssembly.userData.acceleration = new THREE.Vector3(
      0,
      state.weightAcceleration,
      0,
    );
    root.userData.contacts = {
      catchSpring: {
        active: true,
        sprungAgainstWeight: state.catchSprungAgainstWeight,
        automaticReset: true,
        catchAngle: state.catchAngle,
      },
      catchToWeight: {
        active: state.catchToWeightContactActive,
        radialOverlap: state.supportOverlap,
        supportPoint: state.catchSupportPosition.clone(),
        verticalGap: state.weightLowerOpeningY
          - state.catchSupportPosition.y,
      },
      weightReload: {
        active: state.weightReload,
        automatic: false,
      },
      housingToWeightBore: {
        interference: false,
        radialClearance: boreRadialClearance,
      },
      probeToBellCrank: {
        active: state.probeToCatchContactActive,
        clearance: state.probePusherClearance,
        contactPoint: state.catchUpperPosition.clone(),
      },
      probeToSeabed: {
        active: Math.abs(state.probeFootContactY - seabedY) < 1e-9,
        gap: state.probeFootContactY - seabedY,
      },
      weightToSeabed: {
        active: state.weightOnSeabed,
        gap: state.weightLowerOpeningY - seabedY,
        impactSpeed: modelGravity * fallDuration,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.userData.fidelity = 'authored';
  root.userData.cameraDistanceScale = 1.08;
  // Brown's plate is a front section; a narrow lens keeps the view nearly
  // orthographic so the contact slab reads edge-on, as a ground line.
  root.userData.cameraFov = 10;
  markShadows(root);
  for (const ring of seabedRings) {
    ring.castShadow = false;
    ring.receiveShadow = false;
  }

  return {
    cameraDirection: new THREE.Vector3(0.9, 0.75, 12),
    root,
    update,
  };
}

export function createAuthoredSoundingWeightMovement(movement) {
  if (movement.id === 247) {
    const model = finishSounding247Parts(seabedTriggeredSoundingWeight(movement));
    // Brown's sloped barb: the finite seat's rounded top with the convex
    // camming face below it, one plain extrusion in the catch's plane.
    {
      const { catchNose } = model.root.userData.blocks;
      const { catchNoseHalfDepth, catchNoseProfile } = model.root.userData.geometry;
      catchNose.geometry.dispose();
      catchNose.geometry = finitePlate(
        catchNoseProfile,
        -catchNoseHalfDepth,
        catchNoseHalfDepth,
      );
      catchNose.userData.role = 'sloped-barb-catch-nose-under-weight';
    }
    // Keep the stem-to-pad bridge in front of the bell-crank plane with the
    // stem it joins.
    const bridge = model.root.userData.releaseWorkingParts?.bridge;
    if (bridge) bridge.position.z = 0.42;
    // Brown draws the instrument alone, filling the plate, with no sea
    // bottom. The loaded rod stands in Brown's pose a little above the
    // bottom and is lowered onto it, and the weight drops. The rod is lifted
    // out of the weight, the same weight is lifted slightly off the bottom
    // (by an undrawn reset lift) and the rod is lowered into it from above,
    // re-engages it and carries it back up into Brown's pose: one weight,
    // one sounding per loop. The display frame group is kept, at rest.
    const { root } = model;
    const displayFrame = new THREE.Group();
    displayFrame.userData.role = 'fixed-world-display-frame';
    for (const child of [...root.children]) displayFrame.add(child);
    root.add(displayFrame);
    const { timeline } = root.userData;
    root.userData.activeWeightAssembly = root.userData.blocks.weightAssembly;
    root.userData.animationTiming = { authoredCyclePeriod: timeline.cycleClosure };
    root.userData.minimumDisplayCycleSeconds = 16;
    root.userData.displayFrame247 = displayFrame;
    // Fit the plate pose: rod broken off above the weight, weight, window
    // and probe foot. The camera looks up slightly, from the bottom's own
    // level, so the bottom's top is seen edge-on as the lower frame edge:
    // Brown's pose shows no bottom, yet the probe's strike and the landed
    // weight stand on that edge.
    const fitBounds = new THREE.Box3();
    const partBounds = new THREE.Box3();
    model.update(0);
    root.updateMatrixWorld(true);
    root.traverseVisible((object) => {
      if (!object.geometry) return;
      if (object.userData.role === 'sea-bottom-contact-plane') return;
      fitBounds.union(partBounds.setFromObject(object, true));
    });
    const { loadedWeightCenterY, weightOuterRadius, seabedY } = root.userData.geometry;
    fitBounds.max.y = Math.min(fitBounds.max.y,
      loadedWeightCenterY + weightOuterRadius + 1.2);
    root.userData.cameraFitBounds = fitBounds.expandByScalar(0.05);
    // The crop's floor and the upward look are solved together (in the
    // engine's fit, for every aspect at which the height governs, 0.5 and
    // wider): the eye stands 0.014 below the bottom's plane, so its top is
    // never seen, and that plane projects 0.0025 (NDC) below the lower frame
    // edge, under a pixel. Brown's pose (foot 0.8 up) shows no bottom.
    root.userData.cameraFitBounds.min.y = seabedY + 0.47;
    model.cameraDirection = new THREE.Vector3(0.9, -1.06, 12);
    model.update(0);
    return model;
  }
  return null;
}
