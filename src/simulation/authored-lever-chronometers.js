import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { spokedWheelGeometry } from './spoked-wheel.js';
import { creaseIndexedNormals } from './crease-normals.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { PALETTE, markShadows, matte } from './primitives.js';

// Movement 314: Brown's lever chronometer escapement (after Grimthorpe's
// fig. 77, the "union" chronometer). Every part is a flat extrusion in
// Brown's plane arrangement, traced by design intent from the plate:
//
//   front plane  (z 0 .. 0.24): the thirteen-tooth escape wheel, the
//                crescent pallet plate carrying locking pallets A and B,
//                and impulse pallet C, a straight blade on a collet on the
//                balance staff;
//   lever plane  (z -0.24 .. 0): the lever, forked at the top round the
//                roller pin, pivoted on the crescent's arbor and banked at
//                its foot between two pins;
//   balance plane (z -0.40 .. -0.24): the plain balance disc with its small
//                notch, carrying the roller pin forward into the fork.
//
// Brown draws the lever over the disc and the crescent over the lever (its
// edges dashed under it), and C over the disc; the wheel lies clear of the
// lever and disc in his view. The lever pivots on the arbor Brown draws as
// the large circle on the crescent, like the pallet arbor of 296.
//
// A and B only lock. On the acting vibration A releases, the tooth two
// pitches ahead drops onto C (the wheel catches C with matched speed) and
// drives it through contact with the straight blade, slides off C's end,
// and the intervening tooth lands on B. On the return vibration B unlocks
// for the short residual transfer back to A, while C passes back through
// the gap between the teeth.

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const DEG = Math.PI / 180;

const v2 = (x, y) => new THREE.Vector2(x, y);
const rotate2 = (point, angle) => v2(
  point.x * Math.cos(angle) - point.y * Math.sin(angle),
  point.x * Math.sin(angle) + point.y * Math.cos(angle),
);
const crossZ = (point) => v2(-point.y, point.x);
const smootherStep = (u) => u * u * u * (u * (u * 6 - 15) + 10);
const smootherStepDerivative = (u) => 30 * u * u * (u - 1) * (u - 1);
const smootherStepSecondDerivative = (u) => 60 * u * (2 * u * u - 3 * u + 1);
const positiveModulo = (value, modulus) => ((value % modulus) + modulus) % modulus;

// Quintic from (x0, v0, a0) to (x1, v1, a1) over unit time.
function quintic(x0, v0, a0, x1, v1, a1) {
  const c3 = 10 * (x1 - x0) - 6 * v0 - 4 * v1 - 1.5 * a0 + 0.5 * a1;
  const c4 = -15 * (x1 - x0) + 8 * v0 + 7 * v1 + 1.5 * a0 - a1;
  const c5 = 6 * (x1 - x0) - 3 * v0 - 3 * v1 - 0.5 * a0 + 0.5 * a1;
  return (u) => ({
    x: x0 + v0 * u + 0.5 * a0 * u * u + c3 * u ** 3 + c4 * u ** 4 + c5 * u ** 5,
    v: v0 + a0 * u + 3 * c3 * u * u + 4 * c4 * u ** 3 + 5 * c5 * u ** 4,
    a: a0 + 6 * c3 * u + 12 * c4 * u * u + 20 * c5 * u ** 3,
  });
}

// Flat extrusion of polygon-clipping polygons with crisp plate edges and
// smooth curved walls.
function flatPart(polygons, low, high) {
  const extruded = plate(polygons, low, high);
  const polygonsKept = extruded.userData.plate;
  extruded.deleteAttribute('normal');
  extruded.deleteAttribute('uv');
  const geometry = mergeVertices(extruded, 1e-7);
  geometry.clearGroups();
  extruded.dispose();
  creaseIndexedNormals(geometry, Math.PI / 5);
  geometry.computeBoundingSphere();
  geometry.userData.plate = polygonsKept;
  return geometry;
}

function roundBar(radius, back, front, material, segments = 40) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, front - back, segments),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = (back + front) / 2;
  return mesh;
}

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.rotation.z = Math.atan2(delta.y, delta.x);
  return mesh;
}

// Points of a circular arc through three points (in order a, b, c).
function arcThrough(a, b, c, count) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const ux = ((a.lengthSq()) * (b.y - c.y) + (b.lengthSq()) * (c.y - a.y)
    + (c.lengthSq()) * (a.y - b.y)) / d;
  const uy = ((a.lengthSq()) * (c.x - b.x) + (b.lengthSq()) * (a.x - c.x)
    + (c.lengthSq()) * (b.x - a.x)) / d;
  const center = v2(ux, uy);
  const radius = a.distanceTo(center);
  const angle = (p) => Math.atan2(p.y - center.y, p.x - center.x);
  const a0 = angle(a);
  let a1 = angle(b);
  let a2 = angle(c);
  // Unwrap so the sweep passes through b.
  const unwrap = (x, ref) => x + FULL_TURN * Math.round((ref - x) / FULL_TURN);
  a1 = unwrap(a1, a0);
  a2 = unwrap(a2, a1);
  if ((a1 - a0) * (a2 - a1) < 0) a2 += Math.sign(a1 - a0) * FULL_TURN;
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = a0 + (a2 - a0) * i / count;
    return v2(center.x + radius * Math.cos(t), center.y + radius * Math.sin(t));
  });
}

function leverChronometerEscapement(movement) {
  const root = new THREE.Group();

  // ---- Plate measurements (525 px raster, y down) ----------------------
  // Tooth tips fitted by circle to the thirteen free tips: centre
  // (176, 275), radius 176 px, one tip every 27.7 degrees.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = v2(176, 275);
  const sourceRasterWheelOuterRadius = 176;
  const sourceRasterWheelRootRadius = 144;
  const sourceRasterBalanceCenter = v2(372, 116);
  const sourceRasterBalanceOuterRadius = 90;
  const sourceRasterBalancePin = v2(372, 159.4);
  const sourceRasterLeverPivot = v2(371.5, 375.5);
  const sourceRasterPalletA = v2(350.6, 296);
  const sourceRasterImpulseStartC = v2(291, 142);
  const sourceRasterCInner = v2(320, 130);
  const sourceRasterCOuter = v2(282.5, 146);
  const sourceRasterLeftBank = v2(324, 477);
  const sourceRasterRightBank = v2(424, 467);
  const sourceScale = 3.25 / sourceRasterWheelOuterRadius;
  const sourcePointToModel = ({ x, y }) => v2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const px = (x, y) => sourcePointToModel({ x, y });

  const wheelCenter = sourcePointToModel(sourceRasterWheelCenter);
  const balanceCenter = sourcePointToModel(sourceRasterBalanceCenter);
  const leverPivot = sourcePointToModel(sourceRasterLeverPivot);
  const pinPoint = sourcePointToModel(sourceRasterBalancePin);

  // ---- Planes ---------------------------------------------------------
  const frontLow = 0;
  const frontHigh = 0.24;
  const frontPlaneZ = (frontLow + frontHigh) / 2;
  const leverLow = -0.24;
  const leverHigh = 0;
  const leverPlaneZ = (leverLow + leverHigh) / 2;
  const leverDepth = leverHigh - leverLow;
  const discLow = -0.40;
  const discHigh = -0.24;
  const framePlaneZ = -0.80;

  // ---- Wheel ------------------------------------------------------------
  const toothCount = 13;
  const toothPitch = FULL_TURN / toothCount;
  const wheelToothTipRadius = sourceRasterWheelOuterRadius * sourceScale;
  const wheelToothRootRadius = sourceRasterWheelRootRadius * sourceScale;
  const wheelDepth = frontHigh - frontLow;
  // Tooth 0 locks on A with its tip where Brown draws it.
  const wheelBaseAngle = Math.atan2(
    sourcePointToModel(sourceRasterPalletA).y,
    sourcePointToModel(sourceRasterPalletA).x,
  );
  const longImpulseAdvance = toothPitch * 0.75;
  const shortReturnAdvance = toothPitch - longImpulseAdvance;
  const palletAReferenceAngle = wheelBaseAngle;
  const palletBReferenceAngle = wheelBaseAngle - toothPitch - longImpulseAdvance;
  const directImpulseToothOffset = 2;
  const directImpulseStartAngle = wheelBaseAngle + directImpulseToothOffset * toothPitch;

  // ---- Balance, lever and timing ----------------------------------------
  const balancePeriod = 4;
  const halfBeatDuration = balancePeriod / 2;
  // Time 0 is the plate's pose (see stateAtTime).
  const phaseOffset = 0.5 * halfBeatDuration;
  const balanceAmplitude = 68 * DEG;
  const balancePinOrbitRadius = pinPoint.distanceTo(balanceCenter);
  const balancePinRadius = 0.12;
  const balancePinMountAngle = Math.atan2(
    pinPoint.y - balanceCenter.y,
    pinPoint.x - balanceCenter.x,
  );
  const pivotToBalance = balanceCenter.clone().sub(leverPivot);
  // The roller pin turns the lever while the balance is within 40 degrees of
  // its middle. With Brown's pin radius and fork length the fork's own
  // geometry then gives a 7 degree lever throw each side.
  const statedLeverDetachAngle = 40 * DEG;
  const pinAt = (angle) => balanceCenter.clone().add(rotate2(
    v2(Math.cos(balancePinMountAngle), Math.sin(balancePinMountAngle))
      .multiplyScalar(balancePinOrbitRadius), angle));
  const leverAngleOfPin = (angle) => {
    const pin = pinAt(angle).sub(leverPivot);
    return Math.atan2(pin.y, pin.x) - Math.atan2(pivotToBalance.y, pivotToBalance.x);
  };
  const leverAmplitude = Math.abs(leverAngleOfPin(statedLeverDetachAngle));
  const pinEngagementHalfPhase = Math.acos(statedLeverDetachAngle / balanceAmplitude) / Math.PI;
  const pinDisengagementHalfPhase = 1 - pinEngagementHalfPhase;
  // A releases a little before the balance's middle; the next tooth catches
  // C with matched speed, rides it, slides off its end, and the tooth
  // between lands on B well after the lever has banked.
  const palletReleaseHalfPhase = 0.507;
  const impulseCatchHalfPhase = 0.60;
  const cReachRadius = 1.50;
  const nextPalletLandingHalfPhase = 0.775;
  const returnReleaseHalfPhase = 0.46;
  const returnLandingHalfPhase = 0.70;

  const sideForHalfBeat = (index) => (positiveModulo(index, 2) === 0 ? 1 : -1);
  const isActingHalfBeat = (index) => sideForHalfBeat(index) > 0;
  const palletNameForSide = (side) => (side > 0 ? 'A' : 'B');

  const balanceStateAtHalfPhase = (side, h) => {
    const w = Math.PI / halfBeatDuration;
    return {
      angle: -side * balanceAmplitude * Math.cos(Math.PI * h),
      angularSpeed: side * balanceAmplitude * w * Math.sin(Math.PI * h),
      angularAcceleration: side * balanceAmplitude * w * w * Math.cos(Math.PI * h),
    };
  };
  // Acting (side +1): the pin moves right and the fork above the pivot
  // turns the lever clockwise, from +a to -a.
  const leverStateAtHalfPhase = (side, h) => {
    const start = side * leverAmplitude;
    if (h <= pinEngagementHalfPhase) {
      return { angle: start, angularSpeed: 0, angularAcceleration: 0, progress: 0 };
    }
    if (h >= pinDisengagementHalfPhase) {
      return { angle: -start, angularSpeed: 0, angularAcceleration: 0, progress: 1 };
    }
    const duration = (pinDisengagementHalfPhase - pinEngagementHalfPhase) * halfBeatDuration;
    const u = (h - pinEngagementHalfPhase) / (pinDisengagementHalfPhase - pinEngagementHalfPhase);
    return {
      angle: start - 2 * start * smootherStep(u),
      angularSpeed: -2 * start * smootherStepDerivative(u) / duration,
      angularAcceleration: -2 * start * smootherStepSecondDerivative(u) / duration ** 2,
      progress: u,
    };
  };

  // ---- Pallet C: Brown's straight blade ----------------------------------
  // In the balance's frame (balance angle 0 = the plate's pose, pin down).
  const cInner = sourcePointToModel(sourceRasterCInner).sub(balanceCenter);
  const cOuter = sourcePointToModel(sourceRasterCOuter).sub(balanceCenter);
  const cDirection = cOuter.clone().sub(cInner).normalize();
  // Normal pointing to the side the driving tooth comes from.
  let cNormal = v2(-cDirection.y, cDirection.x);
  const impulseTipAt = (advance) => v2(
    Math.cos(directImpulseStartAngle - advance) * wheelToothTipRadius,
    Math.sin(directImpulseStartAngle - advance) * wheelToothTipRadius,
  );
  const bladeFrame = (advance, angle) => {
    const q = rotate2(impulseTipAt(advance).sub(balanceCenter), -angle).sub(cInner);
    return { n: q.dot(cNormal), s: q.dot(cDirection) };
  };
  if (bladeFrame(0, -balanceAmplitude).n < 0) cNormal.negate();
  // C reaches 1.50 from the staff (Brown draws about 1.74): any longer and
  // it could not pass back between the locked teeth on the return.
  const cBladeEndS = (() => {
    const b = cInner.dot(cDirection);
    return -b + Math.sqrt(b * b - cInner.lengthSq() + cReachRadius ** 2);
  })();
  const cBladeEnd = cInner.clone().addScaledVector(cDirection, cBladeEndS);
  // Wheel advance that keeps the impulse tooth's tip on the blade.
  const contactAdvance = (angle) => {
    let lo = -0.5;
    let hi = 1.5;
    let flo = bladeFrame(lo, angle).n;
    for (let k = 0; k < 80; k += 1) {
      const mid = (lo + hi) / 2;
      const fm = bladeFrame(mid, angle).n;
      if (fm * flo > 0) { lo = mid; flo = fm; } else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const contactAdvanceAtHalfPhase = (h) => contactAdvance(balanceStateAtHalfPhase(1, h).angle);
  const derivativeStep = 1e-4;
  const contactStateAtHalfPhase = (h) => {
    const e = derivativeStep;
    const x = contactAdvanceAtHalfPhase(h);
    const xp = contactAdvanceAtHalfPhase(h + e);
    const xm = contactAdvanceAtHalfPhase(h - e);
    return { x, v: (xp - xm) / (2 * e), a: (xp - 2 * x + xm) / (e * e) };
  };
  // Slide-off: the contact point reaches C's end.
  const impulseEndHalfPhase = (() => {
    let lo = impulseCatchHalfPhase + 0.02;
    let hi = pinDisengagementHalfPhase + 0.05;
    const s = (h) => bladeFrame(contactAdvanceAtHalfPhase(h), balanceStateAtHalfPhase(1, h).angle).s;
    for (let k = 0; k < 60; k += 1) {
      const mid = (lo + hi) / 2;
      if (s(mid) < cBladeEndS) lo = mid; else hi = mid;
    }
    return lo;
  })();
  const catchState = contactStateAtHalfPhase(impulseCatchHalfPhase);
  const endState = contactStateAtHalfPhase(impulseEndHalfPhase);
  const dropSpan = impulseCatchHalfPhase - palletReleaseHalfPhase;
  const runSpan = nextPalletLandingHalfPhase - impulseEndHalfPhase;
  const dropCurve = quintic(0, 0, 0, catchState.x, catchState.v * dropSpan, catchState.a * dropSpan ** 2);
  const runCurve = quintic(endState.x, endState.v * runSpan, endState.a * runSpan ** 2,
    longImpulseAdvance, 0, 0);
  const returnSpan = returnLandingHalfPhase - returnReleaseHalfPhase;
  const returnCurve = quintic(0, 0, 0, shortReturnAdvance, 0, 0);

  // Wheel advance (in half-phase units) within a half beat.
  const wheelAdvanceAtHalfPhase = (acting, h) => {
    const toTime = (x, v, a) => ({
      advance: x,
      angularSpeed: -v / halfBeatDuration,
      angularAcceleration: -a / halfBeatDuration ** 2,
    });
    if (acting) {
      if (h <= palletReleaseHalfPhase) return { ...toTime(0, 0, 0), event: 'locked', progress: 0 };
      if (h < impulseCatchHalfPhase) {
        const q = dropCurve((h - palletReleaseHalfPhase) / dropSpan);
        return { ...toTime(q.x, q.v / dropSpan, q.a / dropSpan ** 2), event: 'drop-onto-C', progress: 0 };
      }
      if (h < impulseEndHalfPhase) {
        const c = contactStateAtHalfPhase(h);
        return { ...toTime(c.x, c.v, c.a), event: 'direct-impulse-C', progress: 0.5 };
      }
      if (h < nextPalletLandingHalfPhase) {
        const q = runCurve((h - impulseEndHalfPhase) / runSpan);
        return { ...toTime(q.x, q.v / runSpan, q.a / runSpan ** 2), event: 'run-to-B-after-C', progress: 0.9 };
      }
      return { ...toTime(longImpulseAdvance, 0, 0), event: 'B-lock-after-direct-impulse', progress: 1 };
    }
    if (h <= returnReleaseHalfPhase) return { ...toTime(0, 0, 0), event: 'locked', progress: 0 };
    if (h < returnLandingHalfPhase) {
      const u = (h - returnReleaseHalfPhase) / returnSpan;
      const q = returnCurve(u);
      return { ...toTime(q.x, q.v / returnSpan, q.a / returnSpan ** 2), event: 'short-unpowered-B-to-A-transfer', progress: u };
    }
    return { ...toTime(shortReturnAdvance, 0, 0), event: 'A-lock-after-short-transfer', progress: 1 };
  };
  const accumulatedAdvanceAtHalfStart = (index) => Math.floor(index / 2) * toothPitch
    + (isActingHalfBeat(index) ? 0 : longImpulseAdvance);
  const wheelAngleAtHalfLanding = (index) => wheelBaseAngle - accumulatedAdvanceAtHalfStart(index);
  const currentLockToothIndex = (index) => {
    const oscillation = Math.floor(index / 2);
    return isActingHalfBeat(index)
      ? positiveModulo(oscillation, toothCount)
      : positiveModulo(oscillation - 1, toothCount);
  };
  const directImpulseToothIndex = (index) => positiveModulo(
    Math.floor(index / 2) + directImpulseToothOffset, toothCount);
  const toothTipPoint = (wheelAngle, toothIndex) => {
    const angle = wheelAngle + toothIndex * toothPitch;
    return wheelCenter.clone().add(v2(Math.cos(angle), Math.sin(angle)).multiplyScalar(wheelToothTipRadius));
  };

  // ---- Fork: conjugate to the roller pin ---------------------------------
  const pinCenterLeverLocal = (side, h) => rotate2(
    pinAt(balanceStateAtHalfPhase(side, h).angle).sub(leverPivot),
    -leverStateAtHalfPhase(side, h).angle,
  );
  const pinFrame = (side, h) => {
    const e = 1e-6;
    const center = pinCenterLeverLocal(side, h);
    const tangent = pinCenterLeverLocal(side, h + e).sub(pinCenterLeverLocal(side, h - e)).normalize();
    return { center, tangent, normal: v2(-tangent.y, tangent.x) };
  };
  const forkTineFaceLocalPoint = (side, h) => {
    const frame = pinFrame(side, h);
    return frame.center.clone().addScaledVector(frame.normal, balancePinRadius);
  };
  const forkTineFaceFrame = (side, h) => {
    const e = 1e-6;
    const centerFrame = pinFrame(side, h);
    const point = forkTineFaceLocalPoint(side, h);
    const tangent = forkTineFaceLocalPoint(side, h + e).sub(forkTineFaceLocalPoint(side, h - e)).normalize();
    return { ...centerFrame, point, faceTangent: tangent, faceNormal: v2(-tangent.y, tangent.x) };
  };
  const forkTineFacePoints = (side, count = 49) => Array.from({ length: count }, (_, i) =>
    forkTineFaceLocalPoint(side, THREE.MathUtils.lerp(
      pinEngagementHalfPhase, pinDisengagementHalfPhase, i / (count - 1))));

  // ---- Lock faces A and B: arcs about the lever arbor ------------------
  const referencePointForPallet = (name) => {
    const angle = name === 'A' ? palletAReferenceAngle : palletBReferenceAngle;
    return v2(Math.cos(angle), Math.sin(angle)).multiplyScalar(wheelToothTipRadius);
  };
  const palletSideForName = (name) => (name === 'A' ? 1 : -1);
  const releaseForName = (name) => (name === 'A' ? palletReleaseHalfPhase : returnReleaseHalfPhase);
  const palletLockLocalPoint = (name, h) => rotate2(
    referencePointForPallet(name).sub(leverPivot),
    -leverStateAtHalfPhase(palletSideForName(name), h).angle,
  );
  const palletLockFrame = (name, h) => {
    const e = 1e-6;
    const point = palletLockLocalPoint(name, h);
    let tangent = palletLockLocalPoint(name, h + e).sub(palletLockLocalPoint(name, h - e));
    if (tangent.lengthSq() < 1e-16) tangent = crossZ(point);
    tangent.normalize();
    return { point, tangent, normal: v2(-tangent.y, tangent.x) };
  };
  const palletLockPoints = (name, count = 39) => Array.from({ length: count }, (_, i) =>
    palletLockLocalPoint(name, THREE.MathUtils.lerp(
      pinEngagementHalfPhase, releaseForName(name), i / (count - 1))));

  const directImpulseLocalPointAtHalfPhase = (h) => rotate2(
    impulseTipAt(contactAdvanceAtHalfPhase(h)).sub(balanceCenter),
    -balanceStateAtHalfPhase(1, h).angle,
  );
  const directImpulsePoints = (count = 61) => Array.from({ length: count }, (_, i) =>
    directImpulseLocalPointAtHalfPhase(THREE.MathUtils.lerp(
      impulseCatchHalfPhase, impulseEndHalfPhase, i / (count - 1))));

  // ---- Materials ---------------------------------------------------------
  const driverMaterial = matte(PALETTE.driver, { metalness: 0.17, roughness: 0.50 });
  const drivenMaterial = matte(PALETTE.driven, { metalness: 0.18, roughness: 0.52 });
  const palletMaterial = matte(PALETTE.accent, { metalness: 0.14, roughness: 0.43 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.30, roughness: 0.42 });
  const frameMaterial = matte(PALETTE.frame, { metalness: 0.13, roughness: 0.68 });

  // ---- Escape wheel: one plate, teeth and web --------------------------
  // Brown's teeth: a sharp tip, a short leading face undercut slightly
  // behind it, and a straight back running the whole pitch down to the
  // next tooth's root.
  const leadAngle = 0.10;
  const toothPolygon = (index) => {
    const t = index * toothPitch;
    const polar = (radius, angle) => [radius * Math.cos(t + angle), radius * Math.sin(t + angle)];
    return [
      polar(wheelToothRootRadius, leadAngle),
      polar(wheelToothTipRadius, 0),
      polar(wheelToothTipRadius - 0.04, 0.02),
      polar(wheelToothRootRadius, toothPitch),
    ];
  };
  const wheelOutline = [];
  for (let index = 0; index < toothCount; index += 1) {
    const [root0, tip, nearTip] = toothPolygon(index);
    const t = index * toothPitch;
    // Along the root circle from the previous back's foot (at t) to this
    // tooth's leading root (t + leadAngle), then up the face.
    for (let k = 0; k <= 4; k += 1) {
      const angle = t + leadAngle * k / 4;
      wheelOutline.push([wheelToothRootRadius * Math.cos(angle), wheelToothRootRadius * Math.sin(angle)]);
    }
    wheelOutline.pop();
    wheelOutline.push(root0, tip, nearTip);
  }
  // The outline runs clockwise in angle order for undercut teeth; the
  // builder accepts either winding.
  const wheelPlate = new THREE.Mesh(
    spokedWheelGeometry({
      outline: wheelOutline,
      rimInnerRadius: 2.08,
      spokes: 4,
      spokeWidth: 0.50,
      hubFillet: 0.60,
      rimFillet: 0.25,
      boreRadius: 0.13,
      thickness: wheelDepth,
      arcSegments: 180,
      // Brown's cross stands square to the page in his pose (time 0).
      phase: -wheelBaseAngle,
    }),
    driverMaterial,
  );
  wheelPlate.position.z = frontPlaneZ;
  wheelPlate.userData.noRotationIndicator = true;
  wheelPlate.userData.role = 'thirteen-tooth-lever-chronometer-escape-wheel-plate';
  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role = 'clockwise-thirteen-tooth-lever-chronometer-escape-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'alternating-long-and-short-advance-escape-wheel-rotor';
  escapeWheel.add(wheelRotor);
  wheelRotor.add(wheelPlate);
  const wheelArbor = roundBar(0.13, framePlaneZ, frontHigh + 0.05, darkMaterial, 32);
  wheelArbor.userData.role = 'escape-wheel-arbor';
  wheelRotor.add(wheelArbor);

  // ---- Balance: plain disc with its notch, roller pin, collet and C ------
  const balance = new THREE.Group();
  balance.position.set(balanceCenter.x, balanceCenter.y, 0);
  balance.userData.axis = Z_AXIS.clone();
  balance.userData.role = 'balance-with-one-direct-impulse-pallet-C-and-one-roller-pin';
  const balanceRimRadius = sourceRasterBalanceOuterRadius * sourceScale;
  const notchCenter = px(318, 55).sub(balanceCenter).normalize().multiplyScalar(balanceRimRadius);
  const discShape = polygonClipping.difference(
    poly(circle([0, 0], balanceRimRadius, 256)),
    poly(circle(notchCenter.toArray(), 12 * sourceScale, 64)),
    poly(circle([0, 0], 0.118, 48)),
  );
  const balanceDisc = new THREE.Mesh(flatPart(discShape, discLow, discHigh),
    matte(PALETTE.fluid, { metalness: 0.18, roughness: 0.52 }));
  balanceDisc.userData.role = 'lever-chronometer-balance-wheel-rim';
  const balanceStaff = roundBar(0.115, framePlaneZ, frontHigh + 0.06, darkMaterial, 32);
  balanceStaff.userData.role = 'balance-staff-for-lever-chronometer';
  // Roller pin: from the disc forward into the fork (lever plane only).
  const pinLocal = pinPoint.clone().sub(balanceCenter);
  const balancePin = roundBar(balancePinRadius, discLow + 0.02, leverHigh - 0.02, darkMaterial, 32);
  balancePin.position.x = pinLocal.x;
  balancePin.position.y = pinLocal.y;
  balancePin.userData.role = 'single-balance-roller-pin-driving-locking-lever-both-ways';
  // C: one flat plate in the front plane, a collet round the staff and the
  // straight blade Brown draws, its working face on the line through his
  // blade, ending where the driving tooth slides off.
  const bladeWidth = 0.10;
  // Brown's line runs nearly through the staff, so the straight blade is
  // simply continued inward into the collet.
  const bladeStart = (() => {
    const bb = cInner.dot(cDirection);
    const inside = 0.2;
    return cInner.clone().addScaledVector(cDirection, -bb - Math.sqrt(Math.max(0, bb * bb - cInner.lengthSq() + inside ** 2)));
  })();
  const back = cNormal.clone().multiplyScalar(bladeWidth);
  const bladeRing = [
    cBladeEnd, bladeStart, bladeStart.clone().add(back), cBladeEnd.clone().add(back),
  ].map((p) => p.toArray());
  let cShape = polygonClipping.union(poly(circle([0, 0], 0.24, 64)), poly(bladeRing));
  cShape = polygonClipping.difference(cShape, poly(circle([0, 0], 0.118, 48)));
  const directPalletC = new THREE.Mesh(flatPart(cShape, frontLow, frontHigh), palletMaterial);
  directPalletC.userData.role = 'single-balance-mounted-direct-impulse-pallet-C';
  balance.add(balanceDisc, balanceStaff, balancePin, directPalletC);

  // ---- Clearance sweeps --------------------------------------------------
  // Everything is posed from the analytic state; sweeps sample two
  // oscillations' worth of half beats (both sides) and the wheel's own
  // repeat of one pitch.
  const round6 = (value) => Math.round(value * 1e6) / 1e6;
  const roundRing = (ring) => ring.map(([x, y]) => [round6(x), round6(y)]);
  // Capsule chain round a sequence of centres (swept disc).
  const sweptDisc = (centers, radius) => {
    const pieces = [];
    for (let i = 0; i + 1 < centers.length; i += 1) {
      const a = centers[i];
      const b = centers[i + 1];
      const d = b.clone().sub(a);
      if (d.length() < 1e-9) continue;
      const angle = Math.atan2(d.y, d.x);
      const ring = [];
      for (const [c, start] of [[b, angle - Math.PI / 2], [a, angle + Math.PI / 2]]) {
        for (let k = 0; k <= 16; k += 1) {
          const t = start + Math.PI * k / 16;
          ring.push([c.x + radius * Math.cos(t), c.y + radius * Math.sin(t)]);
        }
      }
      pieces.push([roundRing([...ring, ring[0]])]);
    }
    return pieces.length ? polygonClipping.union(...pieces.map((p) => [p])) : [];
  };

  // ---- Lever: one flat piece in the lever plane --------------------------
  // Lever-group coordinates are world offsets from the arbor at lever angle
  // 0, the plate's pose. Brown's lever: concave sides, about 54 px across at
  // the fork and the foot and 38 px at the waist, on the axis x = 372.
  const L = (x, y) => px(x, y).sub(leverPivot);
  const leverAxisX = L(372, 0).x;
  // The horns stop just below the detached pin's path (Brown's top at
  // y 145 would be cut into curls by the pin as it leaves the fork).
  const leverTopY = L(372, 155).y;
  const leverFootY = L(372, 497).y;
  const leverWaistY = L(372, 320).y;
  const edgeArc = (side) => arcThrough(
    v2(leverAxisX + side * 26 * sourceScale, leverTopY),
    v2(leverAxisX + side * 19 * sourceScale, leverWaistY),
    v2(leverAxisX + side * 28 * sourceScale, leverFootY),
    48,
  );
  const rightEdge = edgeArc(1);
  const leftEdge = edgeArc(-1);
  const leverRing = roundRing([...leftEdge, ...rightEdge.slice().reverse()].map((p) => p.toArray()));
  let leverShape = [[[...leverRing, leverRing[0]]]];
  // The fork: the roller pin's path in the lever's frame over the whole
  // cycle, plus running clearance. Inside the fork window its walls are the
  // pin's conjugate tine faces; outside it the same sweep cuts the horns
  // the detached pin passes over.
  // (The return half beat retraces the acting path exactly, backwards.)
  const pinPath = [];
  for (let i = 0; i <= 90; i += 1) pinPath.push(pinCenterLeverLocal(1, i / 90));
  const forkCut = sweptDisc(pinPath, balancePinRadius + 0.004);
  leverShape = polygonClipping.difference(leverShape, forkCut);
  leverShape = polygonClipping.difference(leverShape, [[roundRing(circle([0, 0], 0.152, 64))]]);
  // Keep the main piece (the horns' tips can be cut free by the sweep).
  const largest = (polygons) => {
    const area = (ring) => Math.abs(ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2);
    return [polygons.reduce((best, polygon) => (area(polygon[0]) > area(best[0]) ? polygon : best))];
  };
  leverShape = largest(leverShape);
  const leverBody = new THREE.Mesh(flatPart(leverShape, leverLow, leverHigh), drivenMaterial);
  leverBody.userData.role = 'forked-lever-with-banking-foot-in-lever-plane';

  // ---- Crescent with locking pallets A and B (front plane) -------------
  // Each lock face is the arc, about the lever arbor, that the resting tooth
  // tip traces as the lever turns: the tooth neither advances nor recoils
  // while it locks. The stone lies on the side the tooth pushes toward; its
  // release edge follows the tooth's travel.
  const toothTravel = (angle) => v2(Math.sin(angle), -Math.cos(angle));
  const stoneRing = (name) => {
    const points = palletLockPoints(name, 25);
    const refAngle = name === 'A' ? palletAReferenceAngle : palletBReferenceAngle;
    const travel = toothTravel(refAngle);
    const chord = points.at(-1).clone().sub(points[0]).normalize();
    const n = v2(-chord.y, chord.x);
    if (n.dot(travel) < 0) n.negate();
    const depth = 0.30;
    const lead = points[0].clone().addScaledVector(chord, -0.06);
    const releaseFoot = points.at(-1).clone().addScaledVector(travel, depth);
    const lockFoot = lead.clone().addScaledVector(n, depth);
    return roundRing([lead, ...points, releaseFoot, lockFoot].map((p) => p.toArray()));
  };
  const wheelLocal = wheelCenter.clone().sub(leverPivot);
  const polarAboutWheel = (radius, angle) => wheelLocal.clone().add(
    v2(Math.cos(angle), Math.sin(angle)).multiplyScalar(radius));
  // Brown's crescent: the inside a circular arc just clear of the tooth tips
  // at every lever angle (through the clearance envelope at its two ends and
  // middle), the outside a circular arc through his outline, square ends.
  const outerArc = arcThrough(L(422.5, 325), L(360, 445), L(290, 470), 64);
  // Both band ends stop on the stone side of their lock faces.
  const angleA = palletAReferenceAngle - 2 * DEG;
  const angleB = palletBReferenceAngle - 3 * DEG;
  const tipClearanceRadius = (angle) => {
    // Smallest radius about the wheel whose point, turned with the lever
    // through its whole throw, stays 0.03 outside the tip circle.
    const clear = (radius) => {
      const q = polarAboutWheel(radius, angle);
      for (let k = -16; k <= 16; k += 1) {
        const w = rotate2(q, leverAmplitude * k / 16).sub(wheelLocal);
        if (w.length() < wheelToothTipRadius + 0.03) return false;
      }
      return true;
    };
    let lo = wheelToothTipRadius;
    let hi = wheelToothTipRadius + 1;
    for (let k = 0; k < 40; k += 1) {
      const mid = (lo + hi) / 2;
      if (clear(mid)) hi = mid; else lo = mid;
    }
    return hi;
  };
  // A single circular arc just outside that clearance envelope: through
  // the envelope at both ends and the middle, lifted by the envelope's
  // largest excess over it.
  const envelope = Array.from({ length: 49 }, (_, i) => {
    const angle = THREE.MathUtils.lerp(angleB, angleA, i / 48);
    return { angle, radius: tipClearanceRadius(angle) };
  });
  const arcFrom = (lift) => arcThrough(
    polarAboutWheel(envelope[0].radius + lift, envelope[0].angle),
    polarAboutWheel(envelope[24].radius + lift, envelope[24].angle),
    polarAboutWheel(envelope[48].radius + lift, envelope[48].angle),
    96,
  );
  const excess = (arc) => {
    let worst = 0;
    for (const { angle, radius } of envelope) {
      // Radius of the arc along this ray from the wheel centre.
      const dir = v2(Math.cos(angle), Math.sin(angle));
      let best = Infinity;
      for (const p of arc) {
        const w = p.clone().sub(wheelLocal);
        const off = Math.abs(w.x * dir.y - w.y * dir.x);
        if (off < best) { best = off; var along = w.dot(dir); }
      }
      worst = Math.max(worst, radius - along);
    }
    return worst;
  };
  let innerLift = 0;
  for (let k = 0; k < 4; k += 1) innerLift += excess(arcFrom(innerLift)) + 0.002;
  const innerArc = arcFrom(innerLift);
  const bandRing = roundRing([...innerArc, ...outerArc].map((p) => p.toArray()));
  const stoneARing = stoneRing('A');
  const stoneBRing = stoneRing('B');
  // Each stone's root joins the band (hull of the stone and the band's end).
  const hull = (points) => {
    const pts = points.map(([x, y]) => v2(x, y)).sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = (list) => list.reduce((h, p) => {
      while (h.length >= 2 && cross(h.at(-2), h.at(-1), p) <= 0) h.pop();
      h.push(p);
      return h;
    }, []);
    const lower = half(pts);
    const upper = half(pts.slice().reverse());
    return roundRing([...lower.slice(0, -1), ...upper.slice(0, -1)].map((p) => p.toArray()));
  };
  const closeRing = (ring) => [[...ring, ring[0]]];
  const rootA = hull([...stoneARing, innerArc.at(-1).toArray(), outerArc[0].toArray(),
    innerArc.at(-6).toArray()]);
  const rootB = hull([...stoneBRing, innerArc[0].toArray(), outerArc.at(-1).toArray(),
    innerArc[5].toArray()]);
  let crescentShape = polygonClipping.union(
    closeRing(bandRing), closeRing(stoneARing), closeRing(stoneBRing),
    closeRing(rootA), closeRing(rootB));
  // Swept wheel teeth, in the lever's frame, plus running clearance.
  const toothClearance = 0.0015;
  const grownTooth = (() => {
    const ring = toothPolygon(0).map(([x, y]) => v2(x, y));
    const count = ring.length;
    let area = 0;
    for (let i = 0; i < count; i += 1) area += ring[i].x * ring[(i + 1) % count].y - ring[(i + 1) % count].x * ring[i].y;
    const sign = area > 0 ? 1 : -1;
    return ring.map((p, i) => {
      const prev = ring[(i + count - 1) % count];
      const next = ring[(i + 1) % count];
      const n1 = v2(p.y - prev.y, prev.x - p.x).normalize().multiplyScalar(sign);
      const n2 = v2(next.y - p.y, p.x - next.x).normalize().multiplyScalar(sign);
      const bis = n1.clone().add(n2).normalize();
      return p.clone().addScaledVector(bis, toothClearance / Math.max(bis.dot(n1), 0.2));
    });
  })();
  const sweepTimes = [];
  for (let i = 0; i < 240; i += 1) sweepTimes.push(balancePeriod * i / 240);
  const cutBySweptTeeth = (shape, toLocal) => {
    let cut = shape;
    const box = new THREE.Box2();
    for (const polygon of shape) for (const [x, y] of polygon[0]) box.expandByPoint(v2(x, y));
    box.expandByScalar(0.05);
    for (const time of sweepTimes) {
      const state = stateAtTime(time);
      const pieces = [];
      for (let k = 0; k < toothCount; k += 1) {
        const angle = state.wheelAngle + k * toothPitch;
        const ring = grownTooth.map((p) => toLocal(rotate2(p, angle).add(wheelCenter), state));
        const tb = new THREE.Box2().setFromPoints(ring);
        if (!tb.intersectsBox(box)) continue;
        pieces.push([roundRing(ring.map((p) => p.toArray()))]);
      }
      if (pieces.length) cut = polygonClipping.difference(cut, ...pieces.map((p) => [p]));
    }
    return cut;
  };
  crescentShape = cutBySweptTeeth(crescentShape,
    (world, state) => rotate2(world.clone().sub(leverPivot), -state.leverAngle));
  crescentShape = polygonClipping.difference(crescentShape, [[roundRing(circle([0, 0], 0.152, 64))]]);
  crescentShape = largest(crescentShape);
  const crescent = new THREE.Mesh(flatPart(crescentShape, frontLow, frontHigh), palletMaterial);
  crescent.userData.role = 'crescent-pallet-plate-with-locking-only-pallets-A-and-B';
  const leverArbor = roundBar(0.15, framePlaneZ, frontHigh + 0.03, darkMaterial, 40);
  leverArbor.userData.role = 'lever-and-pallet-arbor';
  const palletLever = new THREE.Group();
  palletLever.position.set(leverPivot.x, leverPivot.y, 0);
  palletLever.userData.axis = Z_AXIS.clone();
  palletLever.userData.role = 'pivoted-lever-with-crescent-pallets-A-B-and-fork';
  palletLever.add(leverBody, crescent, leverArbor);

  // ---- Banking pins: the foot banks at each end of its throw -----------
  const bankingPinRadius = 6 * sourceScale;
  const bankY = L(372, 472).y;
  const edgePointAt = (edge, y) => {
    for (let i = 0; i + 1 < edge.length; i += 1) {
      const a = edge[i];
      const b = edge[i + 1];
      if ((a.y - y) * (b.y - y) <= 0) {
        const t = (y - a.y) / (b.y - a.y);
        const point = a.clone().lerp(b, t);
        const tangent = b.clone().sub(a).normalize();
        return { point, tangent };
      }
    }
    throw new Error('bank height outside the lever edge');
  };
  const bankingContactPoints = {};
  const bankingPinCenters = {};
  const bankingPins = [-1, 1].map((sign) => {
    const name = sign < 0 ? 'left' : 'right';
    const { point, tangent } = edgePointAt(sign < 0 ? leftEdge : rightEdge, bankY);
    let outward = v2(-tangent.y, tangent.x);
    if (outward.x * sign < 0) outward.negate();
    // The foot, below the arbor, swings right (toward +x) as the lever
    // turns anticlockwise.
    const bankAngle = sign * leverAmplitude;
    const contact = leverPivot.clone().add(rotate2(point, bankAngle));
    const center = leverPivot.clone().add(rotate2(point.clone().addScaledVector(outward, bankingPinRadius), bankAngle));
    bankingContactPoints[name] = contact;
    bankingPinCenters[name] = center;
    const pin = roundBar(bankingPinRadius, framePlaneZ, leverHigh, frameMaterial, 32);
    pin.position.x = center.x;
    pin.position.y = center.y;
    pin.userData.role = `fixed-${name}-banking-pin-for-lever-foot`;
    return pin;
  });

  // ---- Frame: plain bars behind everything -----------------------------
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-back-bars-carrying-the-three-arbors-and-banking-pins';
  const at = (p) => new THREE.Vector3(p.x, p.y, framePlaneZ);
  const bankMid = bankingPinCenters.left.clone().add(bankingPinCenters.right).multiplyScalar(0.5);
  // Bored bearing bosses for the three arbors; the bars run between them.
  const bossRadius = 0.26;
  const bosses = [
    ['wheel', wheelCenter, 0.13],
    ['lever', leverPivot, 0.15],
    ['balance', balanceCenter, 0.115],
  ].map(([name, center, arborRadius]) => {
    const boss = new THREE.Mesh(
      boredLatheGeometry([
        { radial: bossRadius, axial: -0.09 },
        { radial: bossRadius, axial: 0.09 },
      ], arborRadius + 0.004, 64),
      frameMaterial,
    );
    boss.rotation.x = Math.PI / 2;
    boss.position.set(center.x, center.y, framePlaneZ);
    boss.userData.role = `fixed-back-bearing-${name}`;
    return boss;
  });
  const barBetween = (name, a, b, trimA, trimB) => {
    const dir = b.clone().sub(a).normalize();
    const start = a.clone().addScaledVector(dir, trimA);
    const end = b.clone().addScaledVector(dir, -trimB);
    const bar = beamBetween(at(start), at(end), 0.22, 0.14, frameMaterial);
    bar.userData.role = `fixed-back-bar-${name}`;
    return bar;
  };
  const trim = bossRadius - 0.02;
  const bars = [
    barBetween('wheel-to-lever', wheelCenter, leverPivot, trim, trim),
    barBetween('lever-to-balance', leverPivot, balanceCenter, trim, trim),
    barBetween('lever-to-banking', leverPivot, bankMid, trim, 0),
    barBetween('banking-pins', bankingPinCenters.left, bankingPinCenters.right, 0, 0),
  ];
  fixedFrame.add(...bars, ...bosses, ...bankingPins);

  root.add(fixedFrame, escapeWheel, palletLever, balance);

  // ---- State -------------------------------------------------------------
  // Time 0 is the plate's pose: the balance at its middle on the acting
  // vibration, the pin in the fork, A just releasing.
  function internalState(internalTime) {
    const coordinate = internalTime / halfBeatDuration;
    const halfBeatIndex = Math.floor(coordinate);
    const halfPhase = coordinate - halfBeatIndex;
    const side = sideForHalfBeat(halfBeatIndex);
    const acting = isActingHalfBeat(halfBeatIndex);
    const currentPallet = palletNameForSide(side);
    const nextPallet = palletNameForSide(-side);
    const balanceState = balanceStateAtHalfPhase(side, halfPhase);
    const leverState = leverStateAtHalfPhase(side, halfPhase);
    const wheelState = wheelAdvanceAtHalfPhase(acting, halfPhase);
    const wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex) - wheelState.advance;
    const releaseHalfPhase = acting ? palletReleaseHalfPhase : returnReleaseHalfPhase;
    const landingHalfPhase = acting ? nextPalletLandingHalfPhase : returnLandingHalfPhase;
    const beforeRelease = halfPhase <= releaseHalfPhase;
    const afterLanding = halfPhase >= landingHalfPhase;
    const lockingContactActive = beforeRelease || afterLanding;
    const directImpulseActive = acting && halfPhase >= impulseCatchHalfPhase
      && halfPhase < impulseEndHalfPhase;
    const shortTransferActive = !acting && !beforeRelease && !afterLanding;
    const forkPinContactActive = halfPhase >= pinEngagementHalfPhase
      && halfPhase <= pinDisengagementHalfPhase;
    const currentToothIndex = currentLockToothIndex(halfBeatIndex);
    const nextToothIndex = currentLockToothIndex(halfBeatIndex + 1);
    const lockingPallet = afterLanding ? nextPallet : currentPallet;
    const lockingToothIndex = afterLanding ? nextToothIndex : currentToothIndex;
    const lockingToothPoint = toothTipPoint(wheelAngle, lockingToothIndex);
    const balancePinCenter = pinAt(balanceState.angle);

    let stage;
    if (beforeRelease && halfPhase < pinEngagementHalfPhase) stage = `${currentPallet}-locked-balance-detached`;
    else if (beforeRelease) stage = `balance-pin-unlocking-${currentPallet}`;
    else if (acting && halfPhase < impulseCatchHalfPhase) stage = 'wheel-drops-onto-C';
    else if (directImpulseActive) stage = 'direct-wheel-to-balance-impulse-at-C-A-to-B';
    else if (acting && !afterLanding) stage = 'tooth-leaves-C-and-runs-to-B';
    else if (shortTransferActive) stage = 'short-unpowered-wheel-transfer-B-to-A';
    else if (forkPinContactActive) stage = `${nextPallet}-locks-as-balance-pin-leaves-fork`;
    else stage = `${nextPallet}-locked-balance-detached`;

    let lockingContact = null;
    if (lockingContactActive) {
      const lockSide = palletSideForName(lockingPallet);
      // On its own face the lock point is where the lever stood at
      // engagement, i.e. the face point for the lever's current angle.
      const leverAngle = leverState.angle;
      const refPoint = referencePointForPallet(lockingPallet);
      const localPoint = rotate2(refPoint.clone().sub(leverPivot), -leverAngle);
      const expectedPoint = leverPivot.clone().add(rotate2(localPoint, leverAngle));
      const faceTangent = rotate2(crossZ(localPoint).normalize(), leverAngle);
      const faceNormal = v2(-faceTangent.y, faceTangent.x);
      const toothVelocity = crossZ(lockingToothPoint.clone().sub(wheelCenter))
        .multiplyScalar(wheelState.angularSpeed);
      const palletVelocity = crossZ(expectedPoint.clone().sub(leverPivot))
        .multiplyScalar(leverState.angularSpeed);
      const relativeVelocity = toothVelocity.clone().sub(palletVelocity);
      lockingContact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint,
        lockSide,
        mode: 'locking-only-no-impulse',
        normalVelocityError: relativeVelocity.dot(faceNormal),
        pallet: lockingPallet,
        pointError: lockingToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        toothIndex: lockingToothIndex,
      };
    }

    let directImpulseContact = null;
    let impulseToothIndex = null;
    let impulseToothPoint = null;
    if (directImpulseActive) {
      impulseToothIndex = directImpulseToothIndex(halfBeatIndex);
      impulseToothPoint = toothTipPoint(wheelAngle, impulseToothIndex);
      const frame = bladeFrame(wheelState.advance, balanceState.angle);
      const faceTangent = rotate2(cDirection, balanceState.angle);
      const faceNormal = rotate2(cNormal, balanceState.angle);
      const toothVelocity = crossZ(impulseToothPoint.clone().sub(wheelCenter))
        .multiplyScalar(wheelState.angularSpeed);
      const palletVelocity = crossZ(impulseToothPoint.clone().sub(balanceCenter))
        .multiplyScalar(balanceState.angularSpeed);
      const relativeVelocity = toothVelocity.clone().sub(palletVelocity);
      directImpulseContact = {
        bladeS: frame.s,
        faceNormal,
        faceTangent,
        mode: 'escape-tooth-directly-impulses-balance-pallet-C',
        normalVelocityError: relativeVelocity.dot(faceNormal),
        pointError: Math.abs(frame.n),
        pushesForward: toothVelocity.dot(faceNormal) > 0,
        toothIndex: impulseToothIndex,
      };
    }

    let forkPinContact = null;
    if (forkPinContactActive) {
      const frame = forkTineFaceFrame(side, halfPhase);
      const expectedPoint = leverPivot.clone().add(rotate2(frame.point, leverState.angle));
      const faceTangent = rotate2(frame.faceTangent, leverState.angle);
      const faceNormal = rotate2(frame.faceNormal, leverState.angle);
      const surfaceOffset = rotate2(frame.point.clone().sub(frame.center), leverState.angle);
      const pinSurfacePoint = balancePinCenter.clone().add(surfaceOffset);
      const pinVelocity = crossZ(pinSurfacePoint.clone().sub(balanceCenter))
        .multiplyScalar(balanceState.angularSpeed);
      const leverVelocity = crossZ(expectedPoint.clone().sub(leverPivot))
        .multiplyScalar(leverState.angularSpeed);
      const relativeVelocity = pinVelocity.clone().sub(leverVelocity);
      forkPinContact = {
        expectedPoint,
        mode: `balance-pin-drives-lever-${acting ? 'A-to-B' : 'B-to-A'}`,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        pinRadiusError: balancePinCenter.distanceTo(pinSurfacePoint) - balancePinRadius,
        pointError: pinSurfacePoint.distanceTo(expectedPoint),
        tine: side > 0 ? 'acting-side' : 'return-side',
      };
    }

    return {
      actingHalfBeat: acting,
      balanceAngle: balanceState.angle,
      balanceAngularAcceleration: balanceState.angularAcceleration,
      balanceAngularSpeed: balanceState.angularSpeed,
      balanceDetached: !forkPinContactActive,
      balancePinCenter,
      currentLockToothIndex: currentToothIndex,
      currentPallet,
      directImpulseActive,
      directImpulseContact,
      forkPinContact,
      forkPinContactActive,
      halfBeatIndex,
      halfPhase,
      impulseToothIndex,
      impulseToothPoint,
      leverAngle: leverState.angle,
      leverAngularAcceleration: leverState.angularAcceleration,
      leverAngularSpeed: leverState.angularSpeed,
      lockingContact,
      lockingContactActive,
      lockingPallet,
      lockingToothIndex,
      lockingToothPoint,
      nextLockToothIndex: nextToothIndex,
      nextPallet,
      shortTransferActive,
      side,
      stage,
      wheelAdvance: wheelState.advance,
      wheelAngle,
      wheelAngularAcceleration: wheelState.angularAcceleration,
      wheelAngularSpeed: wheelState.angularSpeed,
      wheelEvent: wheelState.event,
    };
  }
  function stateAtTime(time) {
    return internalState(time + phaseOffset);
  }
  const internalCanonical = {
    aLocked: 0.10,
    aUnlockEntry: pinEngagementHalfPhase,
    aRelease: palletReleaseHalfPhase,
    impulseCatch: impulseCatchHalfPhase,
    directImpulseMid: (impulseCatchHalfPhase + impulseEndHalfPhase) / 2,
    impulseEnd: impulseEndHalfPhase,
    bLanding: nextPalletLandingHalfPhase,
    bLocked: 1.10,
    bUnlockEntry: 1 + pinEngagementHalfPhase,
    bRelease: 1 + returnReleaseHalfPhase,
    shortTransferMid: 1 + (returnReleaseHalfPhase + returnLandingHalfPhase) / 2,
    aRelock: 1 + returnLandingHalfPhase,
  };
  const canonicalTimes = Object.fromEntries(Object.entries(internalCanonical).map(([name, h]) => [
    name, positiveModulo(h * halfBeatDuration - phaseOffset, balancePeriod)]));

  const update = (time) => {
    const state = stateAtTime(time);
    balance.rotation.z = state.balanceAngle;
    balance.userData.angularSpeed = state.balanceAngularSpeed;
    balance.userData.angularAcceleration = state.balanceAngularAcceleration;
    palletLever.rotation.z = state.leverAngle;
    palletLever.userData.angularSpeed = state.leverAngularSpeed;
    palletLever.userData.angularAcceleration = state.leverAngularAcceleration;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    wheelRotor.userData.angularAcceleration = state.wheelAngularAcceleration;
    root.userData.contacts = {
      directImpulseC: state.directImpulseContact,
      forkPin: state.forkPinContact,
      lockingPallet: state.lockingContact,
    };
    root.userData.kinematics = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.mechanism = 'one 13-tooth clockwise escape wheel is alternately locked by pallets A and B on a crescent carried by the forked lever, neither with an impulse face; on the A-to-B vibration the tooth two pitches ahead drops onto the balance’s straight pallet C, drives it and slides off its end, and the tooth between lands on B; on the return vibration B unlocks for only a short unpowered transfer back to A';
  root.userData.transmission = {
    balanceImpulseCountPerOscillation: 1,
    balanceIsDetachedOutsideForkWindow: true,
    balanceMountedImpulsePalletCount: 1,
    directImpulseToothOffset,
    direction: 'escape wheel turns clockwise: one long acting advance and one short return advance per oscillation',
    leverPalletCount: 2,
    leverPalletImpulseFaceCount: 0,
    longImpulseAdvance,
    oscillationAdvance: toothPitch,
    shortReturnAdvance,
    toothCount,
    wheelReleasesPerOscillation: 2,
  };
  root.userData.blocks = {
    balance,
    balanceDisc,
    balancePin,
    balanceStaff,
    bankingPins,
    bars,
    bosses,
    crescent,
    directPalletC,
    escapeWheel,
    fixedFrame,
    leverArbor,
    leverBody,
    palletLever,
    wheelArbor,
    wheelPlate,
    wheelRotor,
  };
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.canonicalStates = Object.fromEntries(Object.entries(canonicalTimes).map(
    ([name, time]) => [name, stateAtTime(time)]));
  root.userData.forkTineFaceFrame = forkTineFaceFrame;
  root.userData.forkTineFacePoints = forkTineFacePoints;
  root.userData.palletLockFrame = palletLockFrame;
  root.userData.palletLockPoints = palletLockPoints;
  root.userData.directImpulsePoints = directImpulsePoints;
  root.userData.toothPolygon = toothPolygon;
  root.userData.planes = {
    front: [frontLow, frontHigh],
    lever: [leverLow, leverHigh],
    balance: [discLow, discHigh],
    frame: framePlaneZ,
  };
  root.userData.geometry = {
    balanceAmplitude,
    balanceCenter: balanceCenter.clone(),
    balancePeriod,
    balancePinMountAngle,
    balancePinOrbitRadius,
    balancePinRadius,
    balanceRimRadius,
    bankingContactPoints,
    bankingPinCenters,
    bankingPinRadius,
    cBladeEndS,
    cReachRadius,
    directImpulseStartAngle,
    halfBeatDuration,
    impulseCatchHalfPhase,
    impulseEndHalfPhase,
    leverAmplitude,
    leverDepth,
    leverPivot: leverPivot.clone(),
    leverPlaneZ,
    longImpulseAdvance,
    nextPalletLandingHalfPhase,
    palletAReferenceAngle,
    palletBReferenceAngle,
    palletReleaseHalfPhase,
    phaseOffset,
    pinDisengagementHalfPhase,
    pinEngagementHalfPhase,
    returnLandingHalfPhase,
    returnReleaseHalfPhase,
    shortReturnAdvance,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    statedLeverDetachAngle,
    toothCount,
    toothPitch,
    wheelBaseAngle,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelToothRootRadius,
    wheelToothTipRadius,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies the static 13-tooth wheel, balance pallet C, the crescent pallets A and B on the forked lever, roller pin and banking pins. Grimthorpe fig. 77 supplies the A-to-B direct-impulse and B-to-A short-transfer sequence; historic lift and drop angles are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_314.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate314: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one 13-tooth escape wheel; one lever pivoted on the crescent’s arbor, forked round one roller pin and banked between two pins, its crescent carrying locking-only pallets A and B; one direct impulse pallet C on the balance staff',
      measurementUncertaintyPixels: 6,
      rasterBalanceCenter: sourceRasterBalanceCenter.clone(),
      rasterBalanceOuterRadius: sourceRasterBalanceOuterRadius,
      rasterBalancePin: sourceRasterBalancePin.clone(),
      rasterCInner: sourceRasterCInner.clone(),
      rasterCOuter: sourceRasterCOuter.clone(),
      rasterImpulseStartC: sourceRasterImpulseStartC.clone(),
      rasterLeftBank: sourceRasterLeftBank.clone(),
      rasterLeverPivot: sourceRasterLeverPivot.clone(),
      rasterPalletA: sourceRasterPalletA.clone(),
      rasterRightBank: sourceRasterRightBank.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelOuterRadius: sourceRasterWheelOuterRadius,
      rasterWheelRootRadius: sourceRasterWheelRootRadius,
      visibleWheelToothCount: toothCount,
    },
    grimthorpeFigure77: {
      author: 'Edmund Beckett, Lord Grimthorpe',
      description: 'A unlocks as direct impulse begins at C; the intervening tooth lands on B at the end of impulse; the return unlocks B for a very short non-impulse movement back to A.',
      edition: 8,
      figure: 77,
      page: 234,
      publicationYear: 1903,
      source: 'A Rudimentary Treatise on Clocks, Watches, & Bells',
      url: 'https://www.gutenberg.org/ebooks/17576',
    },
    historicalExample: {
      description: 'Oscar T. Lang illustrates the same lever-chronometer, also known as the union chronometer, in Loveday, Wakefield No. 1356.',
      publication: 'Horological Institute of America, The Horologist’s Loupe',
      publicationYear: 1959,
      url: 'https://www.awci.com/wp-content/uploads/2018/02/1959-01-HIA.pdf',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = (phase) => stateAtTime(phase * balancePeriod);
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: balancePeriod,
    schedule: [
      'A-locks-while-balance-is-detached',
      'balance-pin-enters-fork-and-unlocks-A',
      'released-tooth-drops-onto-C-with-matched-speed',
      'escape-tooth-directly-impulses-balance-pallet-C',
      'tooth-slides-off-C-and-intervening-tooth-lands-on-B',
      'balance-returns-and-pin-unlocks-B',
      'wheel-makes-short-unpowered-transfer-from-B-to-A',
      'A-relocks-and-balance-detaches',
    ],
  };
  root.userData.toothTipPoint = toothTipPoint;
  root.userData.wheelAngleAtHalfLanding = wheelAngleAtHalfLanding;
  root.userData.wheelAdvanceAtHalfPhase = wheelAdvanceAtHalfPhase;
  root.userData.reconstructionNote = 'Brown’s parts are flat plates in three planes (wheel, crescent and C in front; lever behind; balance disc behind that). The lever pivots on the crescent’s arbor. Lock faces are arcs about that arbor; the fork is the roller pin’s swept path; C is Brown’s straight blade, shortened to reach 1.50 from the staff so it passes back between the locked teeth. The wheel drops onto C with matched speed, rides it by exact contact, and runs to B on a smooth law after sliding off; lever and wheel motion are prescribed kinematics (no dynamics).';
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 4;
  root.userData.cameraDirection = new THREE.Vector3(0, 0, 15);
  root.userData.cameraFov = 8;
  root.userData.cameraDistanceScale = 0.86;
  root.userData.fidelity = 'authored';

  root.traverse((object) => {
    for (const material of [].concat(object.material ?? [])) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (let i = 0; i <= 32; i += 1) {
    update(balancePeriod * i / 32);
    root.updateMatrixWorld(true);
    root.traverseVisible((object) => {
      const position = object.geometry?.attributes.position;
      if (!position) return;
      for (let j = 0; j < position.count; j += 1) {
        bounds.expandByPoint(point.fromBufferAttribute(position, j).applyMatrix4(object.matrixWorld));
      }
    });
  }
  root.userData.cameraFitBounds = bounds.expandByScalar(0.15);
  update(0);
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

export function createAuthoredLeverChronometerMovement(movement) {
  if (movement.id !== 314) return null;
  return leverChronometerEscapement(movement);
}
