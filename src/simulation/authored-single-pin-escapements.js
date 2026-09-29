import * as THREE from 'three';
import {correctSinglePinParts, finishPinEscapement} from './pin-escapement-working-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  return beam;
}

function edgeTube(points, z, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
    false,
    'centripetal',
  );
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(36, points.length * 2),
      radius, 8, false),
    material,
  );
  edge.userData.role = role;
  return edge;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (x * (x * 6 - 15) + 10);
}

function bisect(predicate, low, high, iterations = 64) {
  // Returns the boundary between `low` (predicate false) and `high` (true).
  let lo = low;
  let hi = high;
  for (let index = 0; index < iterations; index += 1) {
    const middle = (lo + hi) / 2;
    if (predicate(middle)) hi = middle;
    else lo = middle;
  }
  return { high: hi, low: lo };
}

// A dead face: an arc about the pendulum pivot (the pivot is the origin of
// the pendulum frame) where the pin works, |x| up to `working`; beyond it the
// slope eases to level so the window keeps Brown's straight edge.
function deadFaceCurve(radius, working = 0.22, ease = 0.2) {
  return (x) => {
    const u = Math.abs(x);
    if (u <= working) return -Math.sqrt(radius ** 2 - u ** 2);
    const base = -Math.sqrt(radius ** 2 - working ** 2);
    const slope = working / Math.sqrt(radius ** 2 - working ** 2);
    const run = Math.min(u - working, ease);
    return base + slope * (run - run * run / (2 * ease));
  };
}

// Brown's bottle-shaped pendulum plate as one part, in the pendulum frame
// (pivot at the origin, raster scale `scale`): the eye round the pivot, the
// straight rod, the bottle's belly and flat foot, the two adjustment holes,
// and the escapement opening cut as one outline to Brown's shape. The opening
// is his Z: an upper-left and a lower-right window, each a quarter circle
// joined to a straight top (or bottom) edge, sharing a horizontal band at the
// disc arbor. Its edges are the pallets: the band's upper edge (right of the
// neck) and lower edge (left of the neck) are the dead faces, arcs about the
// pivot; the two upright edges at the neck are the impulse faces.
function macdowallPlateShape({
  adjustmentCenters,
  adjustmentRadius,
  ceilingRadius,
  floorRadius,
  neckHalfWidth,
  pivotBoreRadius,
  scale,
  windowBottom,
  windowReach,
  windowTop,
}) {
  // Brown's outline half-widths (raster pixels, to the ink centre) against
  // raster y below the pivot at y 35.
  const profile = [
    [55, 12.5], [160, 12.5], [180, 14.5], [210, 19.5], [240, 25.5],
    [270, 38], [300, 54.5], [330, 75], [360, 91], [390, 97], [402, 97.5],
    [420, 94], [450, 82.5], [480, 65.5], [492, 61.5], [505, 61],
  ].map(([y, half]) => new THREE.Vector2(half * scale, -(y - 35) * scale));
  const eyeRadius = 24 * scale;
  const side = new THREE.SplineCurve(profile.slice(2)).getPoints(96);
  const stemHalf = profile[0].x;
  const eyeJoin = -Math.sqrt(eyeRadius ** 2 - stemHalf ** 2);
  // Counterclockwise outline (the holes run clockwise): down the left side,
  // across the foot, up the right side and over the eye.
  const shape = new THREE.Shape();
  shape.moveTo(-stemHalf, eyeJoin);
  shape.lineTo(-stemHalf, profile[1].y);
  side.forEach((point) => shape.lineTo(-point.x, point.y));
  [...side].reverse().forEach((point) => shape.lineTo(point.x, point.y));
  shape.lineTo(stemHalf, profile[1].y);
  shape.lineTo(stemHalf, eyeJoin);
  shape.absarc(0, 0, eyeRadius, Math.atan2(eyeJoin, stemHalf),
    Math.atan2(eyeJoin, -stemHalf) + FULL_TURN, false);
  shape.closePath();

  const pivotBore = new THREE.Path();
  pivotBore.absarc(0, 0, pivotBoreRadius, 0, FULL_TURN, true);
  shape.holes.push(pivotBore);
  for (const [x, y] of adjustmentCenters) {
    const hole = new THREE.Path();
    hole.absarc(x, y, adjustmentRadius, 0, FULL_TURN, true);
    shape.holes.push(hole);
  }

  // The escapement opening, one clockwise outline: along the ceiling (upper
  // dead face) from the upper neck corner, round the lower-right window's
  // quarter circle, back along its bottom, up the lower impulse face to the
  // lower neck corner, along the floor (lower dead face), round the
  // upper-left window's quarter circle, along its top and down the upper
  // impulse face to the start.
  const ceiling = deadFaceCurve(ceilingRadius);
  const floor = deadFaceCurve(floorRadius);
  const c = neckHalfWidth;
  const points = [];
  const steps = 64;
  for (let index = 0; index <= steps; index += 1) {
    const x = c + (windowReach - c) * index / steps;
    points.push([x, ceiling(x)]);
  }
  const rightRadius = ceiling(windowReach) - windowBottom;
  const rightCenter = [windowReach - rightRadius, ceiling(windowReach)];
  for (let index = 1; index <= 32; index += 1) {
    const t = Math.PI / 2 * index / 32;
    points.push([rightCenter[0] + rightRadius * Math.cos(t),
      rightCenter[1] - rightRadius * Math.sin(t)]);
  }
  points.push([-c, windowBottom]);
  for (let index = 0; index <= steps; index += 1) {
    const x = -c - (windowReach - c) * index / steps;
    points.push([x, floor(x)]);
  }
  const leftRadius = windowTop - floor(-windowReach);
  const leftCenter = [-windowReach + leftRadius, floor(-windowReach)];
  for (let index = 1; index <= 32; index += 1) {
    const t = Math.PI / 2 * index / 32;
    points.push([leftCenter[0] - leftRadius * Math.cos(t),
      leftCenter[1] + leftRadius * Math.sin(t)]);
  }
  points.push([c, windowTop]);
  const opening = new THREE.Path(points.map(([x, y]) => new THREE.Vector2(x, y)));
  opening.closePath();
  shape.holes.push(opening);
  return { opening: points, shape };
}

function macdowallSinglePinEscapement(movement) {
  const root = new THREE.Group();

  // Plate 305: the hatched circle in the neck of the Z opening is the pin and
  // the small open ring 21 px to its left is the disc arbor; the disc (its
  // edge seen in both windows, dashed where the plate hides it) is centred
  // on that ring. The Z opening itself is point-symmetric about the neck
  // centre on the pendulum centreline. Contemporary accounts identify this as
  // C. Macdowall's 1851 single-pin dead escapement.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterPendulumPivot = new THREE.Vector2(264, 35);
  const sourceRasterOpeningCenter = new THREE.Vector2(264, 380);
  const sourceRasterDiskCenter = new THREE.Vector2(240, 380);
  const sourceRasterRubyPin = new THREE.Vector2(261, 380);
  const sourceRasterUpperPalletCorner = new THREE.Vector2(270, 370);
  const sourceRasterLowerPalletCorner = new THREE.Vector2(259, 388);
  const sourceRasterLeftDeadFaceEnd = new THREE.Vector2(190, 388);
  const sourceRasterRightDeadFaceEnd = new THREE.Vector2(340, 370);
  const sourceRasterLeftAdjustment = new THREE.Vector2(224, 479);
  const sourceRasterRightAdjustment = new THREE.Vector2(297, 479);
  const sourceRasterDirectionArrow = new THREE.Vector2(287, 392);
  const sourcePinOrbitPixels = 21;
  const sourcePinRadiusPixels = 8.7;
  const sourceDiskRadiusPixels = 36;

  const sourceScale = 4.5
    / (sourceRasterOpeningCenter.y - sourceRasterPendulumPivot.y);
  const palletPivot = new THREE.Vector2(0, 4.30);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    palletPivot.x + (x - sourceRasterPendulumPivot.x) * sourceScale,
    palletPivot.y + (sourceRasterPendulumPivot.y - y) * sourceScale,
  );
  // The disc arbor stands on the pendulum centreline at the centre of the
  // opening's symmetry, so both beats are alike (Brown draws the arbor ring
  // 24 px left of it, which would put the escapement out of beat).
  const diskCenter = new THREE.Vector2(0, -0.20);
  const centerDistance = palletPivot.distanceTo(diskCenter);

  // Brown's proportions: the pin's orbit (21 px) and diameter (17 px) and
  // the disc (36 px) as he draws them. This is much larger than the 1:60
  // eccentricity of the period construction rule, so the angle of escape is
  // about 3.5 degrees rather than 1.
  const pinOrbitRadius = sourcePinOrbitPixels * sourceScale;
  const eccentricityRatio = pinOrbitRadius / centerDistance;
  const pinRadius = sourcePinRadiusPixels * sourceScale;
  const diskRadius = sourceDiskRadiusPixels * sourceScale;
  // Half the horizontal gap between the two upright faces at the neck. Brown
  // draws about 5.5 px (0.072); after leaving the upper face the pin must
  // land with its centre clear over the floor (x <= -c), which leaves a thin
  // margin at 0.07, so the neck is narrowed to 0.05 (3.8 px).
  const neckHalfWidth = 0.05;
  // Depth, back to front: the disc behind the pendulum plate, its pin
  // standing forward through the plate's opening, whose edges are the
  // pallets.
  const diskDepth = 0.22;
  const palletDepth = 0.25;
  const plateZ = 0.02;
  const plateBack = plateZ - palletDepth / 2;
  const diskZ = plateBack - 0.01 - diskDepth / 2;
  const diskFront = diskZ + diskDepth / 2;
  const pinFront = plateZ + palletDepth / 2 + 0.02;
  // The pin is set into the disc face.
  const pinSeat = 0.06;
  const pinLength = pinFront - diskFront + pinSeat;
  const workingPlaneZ = (pinFront + diskFront - pinSeat) / 2;
  const contactMarkerZ = pinFront + 0.1;

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const pendulumAmplitude = THREE.MathUtils.degToRad(5.5);
  const escapeAngle = Math.atan(pinOrbitRadius / centerDistance);
  // The clock starts as Brown draws the pin: at 3 o'clock, in the neck
  // corner between the two upright faces, just after it has left the floor
  // dead face and begun the lower impulse. The pendulum then leans about
  // 3.5 degrees (upright is 0.39 of a period earlier, mid upper impulse).
  const displayStartPhase = 0.39;
  const timeOrigin = halfBeatDuration / 2 + displayStartPhase * pendulumPeriod;
  // Share of a half-beat taken by the free drop from the impulse face onto
  // the opposite dead face (prescribed; in a clock it is almost instant).
  const dropSpan = 0.05;

  // Pendulum frame: the pivot at the origin, the arbor on the centreline at
  // (0, -centerDistance). The pin locks with its centre at 9 or 3 o'clock
  // (clockwise it presses up on the ceiling or down on the floor), so both
  // dead faces lie at the same lock-centre radius from the pivot, one pin
  // radius inside and outside it.
  const lockCenterRadius = Math.hypot(centerDistance, pinOrbitRadius);
  const upperDeadFaceRadius = lockCenterRadius - pinRadius;
  const lowerDeadFaceRadius = lockCenterRadius + pinRadius;
  const ceilingCorner = new THREE.Vector2(neckHalfWidth,
    -Math.sqrt(upperDeadFaceRadius ** 2 - neckHalfWidth ** 2));
  const floorCorner = new THREE.Vector2(-neckHalfWidth,
    -Math.sqrt(lowerDeadFaceRadius ** 2 - neckHalfWidth ** 2));

  const pendulumMotionAtHalfPhase = (halfBeatIndex, halfPhase) => {
    const direction = positiveModulo(halfBeatIndex, 2) === 0 ? -1 : 1;
    const argument = Math.PI * halfPhase;
    const angularFrequency = Math.PI / halfBeatDuration;
    return {
      angle: direction * pendulumAmplitude * Math.cos(argument),
      angularAcceleration: -direction * pendulumAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angularSpeed: -direction * pendulumAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };
  const pendulumAngleAt = (upperBeat, halfPhase) => (
    (upperBeat ? -1 : 1) * pendulumAmplitude * Math.cos(Math.PI * halfPhase)
  );

  // Pin centre in the pendulum frame for disc angle `theta` (0 = pin at 3
  // o'clock) and pendulum angle `phi`.
  const pinLocalAt = (theta, phi) => {
    const x = pinOrbitRadius * Math.cos(theta);
    const y = -centerDistance + pinOrbitRadius * Math.sin(theta);
    return rotate2(new THREE.Vector2(x, y), -phi);
  };
  // Signed distances (negative inside) from a pendulum-frame point to the
  // two solids that meet at the neck: the upper-right one (x >= c, inside
  // the ceiling radius) and the lower-left one (x <= -c, outside the floor
  // radius).
  const upperSolidDistance = (p) => {
    const rho = p.length();
    const c = neckHalfWidth;
    if (p.x >= c) {
      if (rho <= upperDeadFaceRadius) return Math.max(rho - upperDeadFaceRadius, c - p.x);
      if (p.x * upperDeadFaceRadius / rho >= c) return rho - upperDeadFaceRadius;
      return p.distanceTo(ceilingCorner);
    }
    if (p.y >= ceilingCorner.y) return c - p.x;
    return p.distanceTo(ceilingCorner);
  };
  const lowerSolidDistance = (p) => {
    const rho = p.length();
    const c = neckHalfWidth;
    if (p.x <= -c) {
      if (rho >= lowerDeadFaceRadius) return Math.max(lowerDeadFaceRadius - rho, p.x + c);
      return lowerDeadFaceRadius - rho;
    }
    if (p.y <= floorCorner.y) return p.x + c;
    return p.distanceTo(floorCorner);
  };
  const pinClearanceAt = (theta, phi) => {
    const p = pinLocalAt(theta, phi);
    return Math.min(upperSolidDistance(p), lowerSolidDistance(p)) - pinRadius;
  };
  const beatStartTheta = (upperBeat) => (upperBeat ? Math.PI : 0);
  const locked = (upperBeat, phi) => {
    const x = pinLocalAt(beatStartTheta(upperBeat), phi).x;
    return upperBeat ? x >= neckHalfWidth : x <= -neckHalfWidth;
  };
  // How far the driven disc can turn from its lock before the pin meets the
  // plate, with the pendulum at `phi`: the pin is driven clockwise and only
  // the opening's edges hold it.
  const scanStep = 0.004;
  const blockedAdvance = (upperBeat, phi) => {
    if (locked(upperBeat, phi)) return 0;
    const theta0 = beatStartTheta(upperBeat);
    const blocked = (advance) => pinClearanceAt(theta0 - advance, phi) < -1e-12;
    let previous = 0;
    for (let advance = scanStep; ; advance += scanStep) {
      const bounded = Math.min(advance, Math.PI);
      if (blocked(bounded)) return bisect(blocked, previous, bounded).low;
      if (bounded >= Math.PI) return Math.PI;
      previous = bounded;
    }
  };
  // Beat events, in half-beat phase: release from the dead face, and the
  // moment the pin leaves the impulse face and drops onto the opposite dead
  // face.
  const beatEvents = (upperBeat) => {
    const edgeRelease = bisect(
      (u) => !locked(upperBeat, pendulumAngleAt(upperBeat, u)), 0, 1,
    ).high;
    // Just past the corner the pin's centre is no longer over the dead face,
    // but the room it has to turn first shrinks slightly (by ~1e-5 rad)
    // before it grows, because the corner is not on the pin's radial line.
    // The pin stays where it is until that minimum, so the disc never backs
    // up; release is taken there.
    const advanceAt = (u) => blockedAdvance(upperBeat,
      pendulumAngleAt(upperBeat, u));
    let lo = edgeRelease;
    let hi = edgeRelease + 0.02;
    for (let index = 0; index < 80; index += 1) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (advanceAt(m1) <= advanceAt(m2)) hi = m2;
      else lo = m1;
    }
    const release = (lo + hi) / 2;
    const drop = bisect(
      (u) => blockedAdvance(upperBeat, pendulumAngleAt(upperBeat, u)) >= Math.PI,
      release, 1,
    ).high;
    const dropAdvance = blockedAdvance(upperBeat,
      pendulumAngleAt(upperBeat, drop - 1e-9));
    return { drop, dropAdvance, edgeRelease, release, releaseAdvance: advanceAt(release) };
  };
  const events = { lower: beatEvents(false), upper: beatEvents(true) };

  const rawStateAtTime = (time) => {
    const halfCoordinate = (time + timeOrigin) / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfCoordinate);
    const halfPhase = halfCoordinate - halfBeatIndex;
    const upperBeat = positiveModulo(halfBeatIndex, 2) === 0;
    const impulseSide = upperBeat ? 'upper' : 'lower';
    const startingRest = upperBeat ? 'ceiling' : 'floor';
    const endingRest = upperBeat ? 'floor' : 'ceiling';
    const pendulum = pendulumMotionAtHalfPhase(halfBeatIndex, halfPhase);
    const beat = events[impulseSide];
    const wheelAngleAtBeatStart = Math.PI - halfBeatIndex * Math.PI;
    let beatAdvance;
    let contactKind;
    let mode;
    let restFace = null;

    if (halfPhase < beat.release) {
      beatAdvance = 0;
      contactKind = 'dead-rest';
      mode = `${startingRest}-dead-rest`;
      restFace = startingRest;
    } else if (halfPhase < beat.drop) {
      beatAdvance = blockedAdvance(upperBeat, pendulum.angle);
      const p = pinLocalAt(beatStartTheta(upperBeat) - beatAdvance,
        pendulum.angle);
      const onFace = upperBeat
        ? p.y >= ceilingCorner.y
        : p.y <= floorCorner.y;
      contactKind = onFace ? 'upright-impulse' : 'corner-impulse';
      mode = `${impulseSide}-${onFace ? 'upright' : 'corner'}-impulse`;
    } else if (halfPhase < beat.drop + dropSpan) {
      beatAdvance = THREE.MathUtils.lerp(beat.dropAdvance, Math.PI,
        smootherStep((halfPhase - beat.drop) / dropSpan));
      contactKind = 'free';
      mode = `${endingRest}-landing-drop`;
    } else {
      beatAdvance = Math.PI;
      contactKind = 'dead-rest';
      mode = `${endingRest}-dead-rest`;
      restFace = endingRest;
    }

    const wheelAngle = wheelAngleAtBeatStart - beatAdvance;
    const pinCenter = diskCenter.clone().add(new THREE.Vector2(
      Math.cos(wheelAngle) * pinOrbitRadius,
      Math.sin(wheelAngle) * pinOrbitRadius,
    ));
    return {
      beatAdvance,
      contactKind,
      endingRest,
      halfBeatIndex,
      halfPhase,
      impulseSide,
      mode,
      pendulumAngle: pendulum.angle,
      pendulumAngularAcceleration: pendulum.angularAcceleration,
      pendulumAngularSpeed: pendulum.angularSpeed,
      pinCenter,
      restFace,
      startingRest,
      upperBeat,
      wheelAngle,
    };
  };

  const palletLocalPoint = (worldPoint, palletAngle) => rotate2(
    worldPoint.clone().sub(palletPivot),
    -palletAngle,
  );
  const palletWorldPoint = (localPoint, palletAngle) => palletPivot.clone()
    .add(rotate2(localPoint, palletAngle));

  const addContactState = (state) => {
    let activeFace = null;
    let contactError = null;
    let contactPointLocal = null;
    const pinCenterLocal = palletLocalPoint(
      state.pinCenter,
      state.pendulumAngle,
    );
    const upper = state.impulseSide === 'upper';
    if (state.contactKind === 'upright-impulse') {
      const faceX = upper ? neckHalfWidth : -neckHalfWidth;
      contactPointLocal = new THREE.Vector2(faceX, pinCenterLocal.y);
      activeFace = `${state.impulseSide}-upright-impulse-face`;
    } else if (state.contactKind === 'corner-impulse') {
      contactPointLocal = (upper ? ceilingCorner : floorCorner).clone();
      activeFace = `${state.impulseSide}-neck-corner`;
    } else if (state.contactKind === 'dead-rest') {
      const faceRadius = state.restFace === 'ceiling'
        ? upperDeadFaceRadius
        : lowerDeadFaceRadius;
      contactPointLocal = pinCenterLocal.clone().setLength(faceRadius);
      activeFace = `${state.restFace}-concentric-dead-face`;
    }
    const contactPoint = contactPointLocal
      ? palletWorldPoint(contactPointLocal, state.pendulumAngle)
      : null;
    if (contactPoint) {
      contactError = Math.abs(
        contactPoint.distanceTo(state.pinCenter) - pinRadius,
      );
    }
    return {
      ...state,
      activeFace,
      contactError,
      contactPoint,
      contactPointLocal,
      pinCenterLocal,
    };
  };

  const derivativeStep = 1e-5;
  const stateAtTime = (time) => {
    const state = addContactState(rawStateAtTime(time));
    const before = rawStateAtTime(time - derivativeStep).wheelAngle;
    const after = rawStateAtTime(time + derivativeStep).wheelAngle;
    const wheelAngularSpeed = (after - before) / (2 * derivativeStep);
    const wheelAngularAcceleration = (
      after - 2 * state.wheelAngle + before
    ) / derivativeStep ** 2;
    return {
      ...state,
      cycleIndex: Math.floor(time / pendulumPeriod),
      cyclePhase: positiveModulo(time, pendulumPeriod) / pendulumPeriod,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const pinCenterAtWheelAngle = (wheelAngle) => diskCenter.clone().add(
    new THREE.Vector2(
      Math.cos(wheelAngle) * pinOrbitRadius,
      Math.sin(wheelAngle) * pinOrbitRadius,
    ),
  );

  const plateMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.57,
  });
  const palletMaterial = matte(0x244e63, {
    metalness: 0.24,
    roughness: 0.50,
  });
  const diskMaterial = matte(PALETTE.driver, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.38,
    roughness: 0.42,
  });
  const faceMaterial = matte(PALETTE.accent, {
    metalness: 0.38,
    roughness: 0.38,
  });
  const rubyMaterial = matte(0x9b2335, {
    metalness: 0.05,
    roughness: 0.30,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.32,
    roughness: 0.52,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-two-arbor-clock-frame';
  root.add(fixedFrame);
  const rearUpright = beamBetween(
    new THREE.Vector3(-1.62, -1.27, -0.47),
    new THREE.Vector3(-1.62, 4.54, -0.47),
    0.16,
    0.18,
    frameMaterial,
  );
  rearUpright.userData.role = 'rear-clock-frame-upright';
  fixedFrame.add(rearUpright);
  for (const [point, role] of [
    [palletPivot, 'fixed-pendulum-pivot'],
    [diskCenter, 'fixed-single-pin-disc-arbor'],
  ]) {
    const support = beamBetween(
      new THREE.Vector3(-1.62, point.y, -0.47),
      new THREE.Vector3(point.x, point.y, -0.47),
      0.13,
      0.18,
      frameMaterial,
    );
    support.userData.role = `${role}-bracket`;
    fixedFrame.add(support);
    const bearing = cylinderAlongZ(0.16, 0.82, darkMaterial);
    bearing.position.set(point.x, point.y, -0.05);
    bearing.userData.role = role;
    fixedFrame.add(bearing);
  }

  const palletAssembly = new THREE.Group();
  palletAssembly.position.set(palletPivot.x, palletPivot.y, 0);
  palletAssembly.userData.axis = Z_AXIS.clone();
  palletAssembly.userData.role = 'pendulum-carried-z-slot-pallet-plate';
  root.add(palletAssembly);
  const localDiskCenterY = diskCenter.y - palletPivot.y;
  // Brown's two lower adjustment holes, each holding an eccentric bush with
  // its screw set off centre (raster centres 227 and 295 at y 476).
  const adjustmentCenters = [227, 295].map((x) => [
    (x - sourceRasterPendulumPivot.x) * sourceScale,
    -(476 - sourceRasterPendulumPivot.y) * sourceScale,
  ]);
  const adjustmentRadius = 22 * sourceScale;
  const pivotBoreRadius = 0.076;
  // Brown's windows reach 74.5 px either side of the neck and 40 px above
  // (upper-left) or below (lower-right) the arbor.
  const windowReach = 74.5 * sourceScale;
  const windowHalfHeight = 40 * sourceScale;
  const { opening: escapementOpening, shape: plateShape } = macdowallPlateShape({
    adjustmentCenters,
    adjustmentRadius,
    ceilingRadius: upperDeadFaceRadius,
    floorRadius: lowerDeadFaceRadius,
    neckHalfWidth,
    pivotBoreRadius,
    scale: sourceScale,
    windowBottom: localDiskCenterY - windowHalfHeight,
    windowReach,
    windowTop: localDiskCenterY + windowHalfHeight,
  });
  const plateGeometry = new THREE.ExtrudeGeometry(plateShape, {
    bevelEnabled: false,
    curveSegments: 48,
    depth: palletDepth,
  });
  plateGeometry.translate(0, 0, -palletDepth / 2);
  const plate = new THREE.Mesh(plateGeometry, plateMaterial);
  plate.position.z = plateZ;
  plate.userData.role = 'macdowall-bottle-profile-pallet-plate';
  plate.userData.escapementOpening = escapementOpening;
  palletAssembly.add(plate);

  // Hidden references for the working stretch of each dead face: the arc
  // about the pivot from the neck corner outwards.
  const deadFacePoints = (rest) => {
    const upper = rest === 'ceiling';
    const faceRadius = upper ? upperDeadFaceRadius : lowerDeadFaceRadius;
    return Array.from({ length: 33 }, (_, index) => {
      const x = (upper ? 1 : -1) * (neckHalfWidth + 0.36 * index / 32);
      return new THREE.Vector2(x, -Math.sqrt(faceRadius ** 2 - x ** 2));
    });
  };
  const upperDeadPoints = deadFacePoints('ceiling');
  const lowerDeadPoints = deadFacePoints('floor');
  const upperDeadEdge = edgeTube(
    upperDeadPoints,
    workingPlaneZ + palletDepth * 0.22,
    0.025,
    faceMaterial,
    'ceiling-concentric-horizontal-dead-face',
  );
  const lowerDeadEdge = edgeTube(
    lowerDeadPoints,
    workingPlaneZ + palletDepth * 0.22,
    0.025,
    faceMaterial,
    'floor-concentric-horizontal-dead-face',
  );
  palletAssembly.add(upperDeadEdge, lowerDeadEdge);

  const upperImpulsePoints = [
    ceilingCorner.clone(),
    new THREE.Vector2(neckHalfWidth, localDiskCenterY + windowHalfHeight),
  ];
  const lowerImpulsePoints = [
    new THREE.Vector2(-neckHalfWidth, localDiskCenterY - windowHalfHeight),
    floorCorner.clone(),
  ];
  const upperImpulseEdge = edgeTube(
    upperImpulsePoints,
    workingPlaneZ + palletDepth * 0.22,
    0.027,
    faceMaterial,
    'upper-upright-impulse-face',
  );
  const lowerImpulseEdge = edgeTube(
    lowerImpulsePoints,
    workingPlaneZ + palletDepth * 0.22,
    0.027,
    faceMaterial,
    'lower-upright-impulse-face',
  );
  palletAssembly.add(upperImpulseEdge, lowerImpulseEdge);

  // Each adjustment hole carries an eccentric bush flush with the plate,
  // turned by its off-centre screw (Brown's small hatched circles).
  // Brass, so the bushes read as separate parts in the blue plate.
  const bushMaterial = matte(PALETTE.brass, { metalness: 0.3, roughness: 0.45 });
  const adjustmentScrews = adjustmentCenters.map(([x, y], index) => {
    const screw = new THREE.Group();
    screw.position.set(x, y, plateZ);
    screw.userData.index = index;
    screw.userData.role = 'pallet-plate-adjustment-screw';
    const bush = cylinderAlongZ(adjustmentRadius - 0.006, palletDepth, bushMaterial, 48);
    bush.userData.role = 'eccentric-adjusting-bush';
    const offset = (index === 0 ? -9 : 14) * sourceScale;
    const head = cylinderAlongZ(7.5 * sourceScale, 0.04, darkMaterial, 32);
    head.position.set(offset, 0, palletDepth / 2 + 0.02);
    head.userData.role = 'eccentric-bush-screw-head';
    screw.add(bush, head);
    palletAssembly.add(screw);
    return screw;
  });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(diskCenter.x, diskCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role = 'single-pin-escape-disc';
  root.add(escapeWheel);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-half-turn-per-beat-rotor';
  escapeWheel.add(wheelRotor);
  const disk = cylinderAlongZ(diskRadius, diskDepth, diskMaterial, 64);
  disk.position.z = diskZ;
  disk.userData.role = 'very-small-solid-escape-disc';
  wheelRotor.add(disk);
  // The arbor ends at the disc's face, behind the plate; its end is Brown's
  // small ring at the disc centre.
  const diskHub = cylinderAlongZ(0.115, 0.6, darkMaterial);
  diskHub.position.z = diskFront - 0.3;
  diskHub.userData.role = 'single-pin-disc-arbor';
  wheelRotor.add(diskHub);
  const rubyPin = cylinderAlongZ(pinRadius, pinLength, rubyMaterial, 32);
  rubyPin.position.set(pinOrbitRadius, 0, workingPlaneZ);
  rubyPin.userData.eccentricity = pinOrbitRadius;
  rubyPin.userData.index = 0;
  rubyPin.userData.material = 'ruby';
  rubyPin.userData.role = 'single-eccentric-ruby-pin';
  wheelRotor.add(rubyPin);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.088, 18, 12),
    rubyMaterial,
  );
  contactMarker.position.z = contactMarkerZ;
  contactMarker.userData.role = 'active-pin-pallet-contact';
  root.add(contactMarker);

  const update = (time) => {
    const state = stateAtTime(time);
    palletAssembly.rotation.z = state.pendulumAngle;
    wheelRotor.rotation.z = state.wheelAngle;
    contactMarker.visible = state.contactPoint !== null && !root.userData.workingPartsReview?.contactMarkersSuppressed;
    if (state.contactPoint) {
      contactMarker.position.set(
        state.contactPoint.x,
        state.contactPoint.y,
        contactMarkerZ,
      );
    }
    contactMarker.userData.activeFace = state.activeFace;
    contactMarker.userData.contactKind = state.contactKind;
    contactMarker.userData.contactError = state.contactError;
    contactMarker.userData.mode = state.mode;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    adjustmentScrews,
    contactMarker,
    disk,
    diskHub,
    escapeWheel,
    fixedFrame,
    lowerDeadEdge,
    lowerImpulseEdge,
    palletAssembly,
    plate,
    rubyPin,
    upperDeadEdge,
    upperImpulseEdge,
    wheelRotor,
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    centerDistance,
    ceilingCorner: ceilingCorner.clone(),
    contactMarkerZ,
    diskCenter: diskCenter.clone(),
    diskDepth,
    diskFront,
    diskRadius,
    diskZ,
    dropSpan,
    eccentricityRatio,
    escapeAngle,
    events: {
      lower: { ...events.lower },
      upper: { ...events.upper },
    },
    floorCorner: floorCorner.clone(),
    halfBeatDuration,
    lockCenterRadius,
    lowerDeadFaceRadius,
    neckHalfWidth,
    palletDepth,
    palletPivot: palletPivot.clone(),
    plateZ,
    pendulumAmplitude,
    pendulumPeriod,
    pinCount: 1,
    pinLength,
    pinOrbitRadius,
    pinRadius,
    pinSeat,
    sourceDiskRadiusPixels,
    sourceImageHeight,
    sourceImageWidth,
    sourcePinOrbitPixels,
    sourcePinRadiusPixels,
    sourceScale,
    timeOrigin,
    upperDeadFaceRadius,
    windowHalfHeight,
    windowReach,
    workingPlaneZ,
  };
  root.userData.pinClearanceAt = pinClearanceAt;
  root.userData.pinLocalAt = pinLocalAt;
  root.userData.mechanism = 'Macdowall single-pin dead escapement: one ruby pin on a small disc behind the pendulum plate alternately rests on the ceiling and the floor of the Z opening, dead faces concentric with the pendulum pivot; after each release it rolls round the neck corner, impulses the upright face above or below the neck and drops onto the opposite dead face, so the disc completes exactly one clockwise half-turn per pendulum beat.';
  root.userData.palletFaces = {
    lower: {
      corner: floorCorner.clone(),
      deadFacePoints: lowerDeadPoints,
      deadFaceRadius: lowerDeadFaceRadius,
      impulseCenterlineX: -neckHalfWidth + pinRadius,
      impulseFaceX: -neckHalfWidth,
      position: 'lower-left solid: floor and the upright face below the neck',
    },
    upper: {
      corner: ceilingCorner.clone(),
      deadFacePoints: upperDeadPoints,
      deadFaceRadius: upperDeadFaceRadius,
      impulseCenterlineX: neckHalfWidth - pinRadius,
      impulseFaceX: neckHalfWidth,
      position: 'upper-right solid: ceiling and the upright face above the neck',
    },
  };
  root.userData.palletLocalPoint = palletLocalPoint;
  root.userData.palletWorldPoint = palletWorldPoint;
  root.userData.pinCenterAtWheelAngle = pinCenterAtWheelAngle;
  root.userData.presentation = 'front elevation with the pendulum plate opened around the single working pin';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 305 page marks Animated unavailable and supplies only Brown’s static plate and description.',
    referenceScope: 'Brown fixes the bottle-profile pendulum plate, the Z-shaped escapement opening, the small disc with its single pin (orbit 21 px, pin 17 px across), the clockwise arrow and the two lower adjustments. The period Macdowall description fixes the single ruby pin, one-half-turn-per-beat rate, upright impulse faces and horizontal dead faces; its 1:60 eccentricity limit is not followed because Brown draws the pin about four times further out.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    periodConstructionReference: {
      constructionRule: 'For an angle of escape no greater than one degree, the ruby-pin eccentricity is no more than one-sixtieth of the distance between the disc and pallet centres.',
      description: 'A small disc with one ruby pin turns half a revolution at every beat; the pin impulses the vertical faces and rests on the horizontal faces.',
      figure: 7,
      inventor: 'C. Macdowall',
      patentYear: 1851,
      publication: 'Encyclopaedia Britannica, Ninth Edition, volume 6, Clocks',
      publicationYear: 1878,
      url: 'https://en.wikisource.org/wiki/Page:Encyclop%C3%A6dia_Britannica,_Ninth_Edition,_v._6.djvu/29',
    },
    plate305: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one eccentric ruby pin on a small disc works through a Z-like opening: an upper-left and a lower-right window sharing a band at the arbor, the neck between them bounded by two upright faces',
      rasterOpeningCenter: sourceRasterOpeningCenter.clone(),
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterDirectionArrow: sourceRasterDirectionArrow.clone(),
      rasterDiskCenter: sourceRasterDiskCenter.clone(),
      rasterLeftAdjustment: sourceRasterLeftAdjustment.clone(),
      rasterLeftDeadFaceEnd: sourceRasterLeftDeadFaceEnd.clone(),
      rasterLowerPalletCorner: sourceRasterLowerPalletCorner.clone(),
      rasterPendulumPivot: sourceRasterPendulumPivot.clone(),
      rasterRightAdjustment: sourceRasterRightAdjustment.clone(),
      rasterRightDeadFaceEnd: sourceRasterRightDeadFaceEnd.clone(),
      rasterRubyPin: sourceRasterRubyPin.clone(),
      rasterUpperPalletCorner: sourceRasterUpperPalletCorner.clone(),
      sourceDirection: 'clockwise, from the curved arrow beside the disc',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    survivingModelReference: {
      collection: 'Franklin Institute escapement collection',
      credit: 'C. Macdowall, London — 1850',
      description: 'The surviving demonstrator confirms one central disc and the opposed upper-left/lower-right pallet openings carried by the pendulum assembly.',
      url: 'https://commons.wikimedia.org/wiki/File:1850_MacDowall_single_pin_escapement_-_Franklin_Institute_-_DSC06671.jpg',
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'ceiling-concentric-dead-rest',
      'upper-neck-corner-impulse',
      'upper-upright-face-impulse',
      'short-clockwise-drop-to-floor-rest',
      'floor-concentric-dead-rest',
      'lower-neck-corner-impulse',
      'lower-upright-face-impulse',
      'short-clockwise-drop-to-ceiling-rest',
    ],
  };
  root.userData.transmission = {
    deadFaces: 'the ceiling and floor of the opening\'s band, arcs concentric with the pendulum pivot, seen nearly horizontal at the disc',
    direction: 'clockwise in Brown’s front elevation',
    discAdvancePerBeatRadians: Math.PI,
    discTurnsPerPendulumCycle: 1,
    impulseFaces: 'the two upright faces at the neck of the Z opening, above and below the band, with the neck corners',
    pinCount: 1,
    recoil: 'none while either dead face is engaged',
  };

  correctSinglePinParts(root);
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [contactMarker]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(1.1, 1.0, 13.8),
    root,
    update,
  };
}

export function createAuthoredSinglePinEscapementMovement(movement) {
  if (movement.id !== 305) return null;
  return finishPinEscapement(macdowallSinglePinEscapement(movement));
}
