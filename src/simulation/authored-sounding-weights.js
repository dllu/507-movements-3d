import { finishSounding247Parts } from './release-mechanism-working-parts.js';
import {
  capsule,
  plate as finitePlate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';
import * as THREE from 'three';
import { makeLaidRopeMesh } from './laid-rope.js';
import { makeHaulingHand } from './hauling-hand.js';
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

  const cyclePeriod = 11.4;
  const timeline = Object.freeze({
    loadedDwellEnd: 0.5,
    seabedContact: 3.3,
    supportRelease: 4.4,
    catchFullyRetracted: 4.6,
    weightImpact: 5.3,
    probeDecompressed: 5.6,
    // Loop reset. The rod is hauled up out of the top of the view on its
    // line, leaving the spent weight lying on the bottom. High above any
    // view a fresh bored weight is threaded on over the probe foot and slid
    // up past the still-retracted catch nose; the detent is released, the
    // catch swings its nose out under it and it is let down onto the nose.
    // The re-armed rod is lowered back into view with its weight seated.
    // As it returns, the vessel (and with it the rod's line and the view)
    // moves on to the next sounding station: the bottom and the spent
    // weight lying on it move off sideways together, rigidly, as one world
    // (nothing sinks into or slides over the bottom). Two weight objects
    // alternate: the fresh one is the weight left at the previous station,
    // lifted there far beyond the side of any view and carried across far
    // above it to the rod's line (the carrying gear is not modelled).
    rodRecovered: 7.4,
    freshWeightAtRod: 7.55,
    freshWeightRaised: 7.8,
    detentReleased: 7.8,
    catchSet: 7.95,
    weightSeated: 8.1,
    reloadedDescentBegins: 8.1,
    rodReturned: 9.5,
    // The move to the next station starts slowly while the rod is away, so
    // the spent weight is still in view as the rod comes back into it.
    stationDriftBegins: 7.8,
    stationRunBegins: 10.4,
    stationDriftEnds: cyclePeriod,
    cycleClosure: cyclePeriod,
  });

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
  const catchSupportLocal = new THREE.Vector2(0.68, -0.72);
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
  // The rod is hauled up to rearmBodyY, where the fresh weight is threaded
  // on far above any view of the bottom.
  const rearmBodyY = 24.0;
  const freshWeightStartRelativeY = probeFootContactLocalY
    - weightOpeningHalfHeight - 0.25;
  // Successive stations lie stationDrift apart, far beyond the side of any
  // view; the soundings alternate direction, so two soundings close the
  // loop. worldOffsetX is where the bottom's station-0 point stands in the
  // view (the rod's line is always x = 0).
  // (40: far beyond the side of the fit zoomed out three times at 16:9,
  // and of the usual oblique views.) The move is a slow creep while the
  // spent weight is in view (stationCreep over the whole move) and a faster
  // run once it has left the view; both are C2.
  const stationDrift = 40;
  const stationCreep = 12;
  const worldOffsetForTime = (cycleTime, parity) => {
    const sign = parity === 0 ? -1 : 1;
    const from = parity === 0 ? 0 : -stationDrift;
    return from + sign * (transitionState(cycleTime, timeline.stationDriftBegins,
      timeline.stationDriftEnds, 0, stationCreep).value
      + transitionState(cycleTime, timeline.stationRunBegins,
        timeline.stationDriftEnds, 0, stationDrift - stationCreep).value);
  };
  // The weight left at the previous station lies on the bottom stationDrift
  // to the side; it is lifted there, far beyond the side of any view, and
  // carried across far above the view to the rod's line.
  const freshWeightStartY = rearmBodyY + freshWeightStartRelativeY;
  const spareTravel = Object.freeze({ liftStart: 0.2, upEnd: 5.8 });
  const spareWeightPositionForTime = (cycleTime, parity) => {
    const side = parity === 0 ? stationDrift : -stationDrift;
    if (cycleTime < spareTravel.upEnd) {
      return [side, transitionState(cycleTime, spareTravel.liftStart,
        spareTravel.upEnd, groundedWeightCenterY, freshWeightStartY).value];
    }
    return [transitionState(cycleTime, spareTravel.upEnd, timeline.freshWeightAtRod,
      side, 0).value, freshWeightStartY];
  };
  const freshWeightLift = 0.12;
  const freshWeightRaisedRelativeY = loadedWeightCenterRelativeY
    + freshWeightLift;

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
  const catchSeatStartLocal = [0.30, -0.84];
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
    const seatEnd = catchSupportLocal.toArray();
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
      poly(points),
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
    if (cycleTime < timeline.rodRecovered) {
      return transitionState(
        cycleTime,
        timeline.probeDecompressed,
        timeline.rodRecovered,
        seabedContactBodyY,
        rearmBodyY,
      );
    }
    if (cycleTime < timeline.reloadedDescentBegins) {
      return { acceleration: 0, value: rearmBodyY, velocity: 0 };
    }
    return transitionState(
      cycleTime,
      timeline.reloadedDescentBegins,
      timeline.rodReturned,
      rearmBodyY,
      recoveredBodyY,
    );
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
    if (cycleTime < timeline.rodRecovered) {
      return {
        acceleration: 0,
        externallySupported: false,
        value: groundedWeightCenterY,
        velocity: 0,
      };
    }
    // Far above the view, a fresh weight is threaded on the rod under its
    // foot, slid up the rod, held while the catch is set beneath it, and let
    // down onto the catch.
    if (cycleTime < timeline.weightSeated) {
      const relative = cycleTime < timeline.freshWeightRaised
        ? transitionState(
          cycleTime,
          timeline.freshWeightAtRod,
          timeline.freshWeightRaised,
          freshWeightStartRelativeY,
          freshWeightRaisedRelativeY,
        )
        : cycleTime < timeline.catchSet
          ? { acceleration: 0, value: freshWeightRaisedRelativeY, velocity: 0 }
          : transitionState(
            cycleTime,
            timeline.catchSet,
            timeline.weightSeated,
            freshWeightRaisedRelativeY,
            loadedWeightCenterRelativeY,
          );
      return {
        acceleration: bodyState.acceleration + relative.acceleration,
        externallySupported: true,
        value: bodyState.value + relative.value,
        velocity: bodyState.velocity + relative.velocity,
      };
    }
    // The fresh weight, seated on the reset catch.
    return {
      acceleration: bodyState.acceleration,
      externallySupported: false,
      value: bodyState.value + loadedWeightCenterRelativeY,
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
      return 'rod-hauled-up-out-of-view-spent-weight-left-on-bottom';
    }
    if (cycleTime < timeline.freshWeightRaised) {
      return 'fresh-weight-pushed-up-camming-sprung-catch-aside';
    }
    if (cycleTime < timeline.catchSet) {
      return 'catch-sprung-out-under-raised-weight';
    }
    if (cycleTime < timeline.weightSeated) {
      return 'fresh-weight-let-down-onto-catch';
    }
    if (cycleTime < timeline.stationDriftBegins) {
      return 're-armed-rod-lowered-back-into-view';
    }
    return 're-armed-rod-returns-to-brown-pose-as-vessel-moves-to-next-station';
  };

  // While no weight rests on it (after the spent weight lands, until the
  // fresh one is let down), the sprung catch stands as far out as the probe
  // pad and the weight's bore and faces allow.
  const weightLimitActive = (cycleTime) => cycleTime >= timeline.weightImpact
    && cycleTime < timeline.catchSet;
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
    const parity = positiveModulo(Math.round((time - cycleTime) / cyclePeriod), 2);
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
    const freshWeightReload = cycleTime >= timeline.freshWeightAtRod
      && cycleTime < timeline.weightSeated;
    // The spring holds the roller on the pad unless the weight holds the
    // catch further in.
    const probeToCatchContactActive = !catchSprungAgainstWeight;
    const catchToWeightContactActive = (
      cycleTime < timeline.supportRelease
      || cycleTime >= timeline.weightSeated
    );
    const weightOnSeabed = cycleTime >= timeline.weightImpact
      && cycleTime < timeline.rodRecovered;

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
      freshWeightReload,
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
      weightCenterX: cycleTime >= timeline.rodRecovered && cycleTime < timeline.freshWeightAtRod
        ? spareWeightPositionForTime(cycleTime)[0] : 0,
      weightCenterY: weight.value,
      weightExternallySupported: weight.externallySupported,
      // The other weight: before recovery the one left at the previous
      // station; after it, this sounding's spent weight lying on the bottom
      // and moving off with it as the vessel moves on.
      spentWeightPosition: cycleTime < timeline.rodRecovered
        ? spareWeightPositionForTime(cycleTime, parity)
        : [worldOffsetForTime(cycleTime, parity) - (parity === 0 ? 0 : -stationDrift),
          groundedWeightCenterY],
      spentWeightLyingOnBottom: cycleTime >= timeline.rodRecovered,
      worldOffsetX: worldOffsetForTime(cycleTime, parity),
      // The sounding's index, consistent with cycleTime's own modulo.
      soundingParity: parity,
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
  // striking it. It is a plain block of bottom whose top is the contact
  // plane, long enough to hold both stations with its ends far beyond any
  // view. The default view sees its top edge-on at the lower frame edge.
  const seabedThickness = 3.6;
  const seabedLength = 200;
  const seabedSlab = groundBlock(seabedLength, seabedThickness, 3.4, {
    name: 'sea-bottom-contact-plane',
  });
  seabedSlab.geometry.dispose();
  seabedSlab.geometry = new THREE.BoxGeometry(seabedLength, seabedThickness, 3.4, 800, 1, 12);
  seabedSlab.position.set(stationDrift / 2, seabedY - seabedThickness / 2, 0);
  const seabedRings = [];
  seabed.add(seabedSlab);
  // Fixed in the sea; it moves in the view only as the vessel changes
  // station.
  seabed.userData.fixed = false;
  seabed.userData.role = 'sea-bottom-passing-as-vessel-changes-station';
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
  const probeX = pivot.x + upperContactLocal.x + 0.09;
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
  // The foot is set toward the rod axis so it passes up through the
  // released weight's bore when the rod is recovered.
  const probeFoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.18, 0.42),
    probeMaterial,
  );
  probeFoot.position.set(
    probeX + 0.20,
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
  // Brown's crop) and paid out and hauled in through the leadsman's hand
  // above, in every phase: the rod is lowered and recovered on it, and it
  // stays tied while the rod is hauled clear and re-armed.
  const rodTopLocalY = housingTop.position.y + 1.65;
  const lineEye = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 12, 32), darkMaterial);
  lineEye.position.set(0, rodTopLocalY + 0.13, 0);
  lineEye.userData.role = 'sounding-line-eye-on-rod-top';
  const lineEyeShank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 20), darkMaterial);
  lineEyeShank.position.set(0, rodTopLocalY + 0.02, 0);
  lineEyeShank.userData.role = 'sounding-line-eye-shank';
  bodyAssembly.add(lineEye, lineEyeShank);
  const lineRadius = 0.045;
  // The hand holds the line well above the rod top (above the view).
  const lineHandY = recoveredBodyY + 6.95;
  const lineMaterial = matte(PALETTE.belt, { roughness: 0.76 });
  const linePlaceholder = new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
  const soundingLine = makeLaidRopeMesh(linePlaceholder, lineMaterial, { radius: lineRadius, tubularSegments: 96 });
  soundingLine.userData.role = 'sounding-line-tied-to-rod';
  const lineKnot = new THREE.Mesh(new THREE.SphereGeometry(lineRadius * 1.7, 16, 12), lineMaterial);
  lineKnot.userData.role = 'sounding-line-knot-at-eye';
  const lineHand = makeHaulingHand(new THREE.Vector3(0, -1, 0), lineRadius / 0.8, {
    armDirection: new THREE.Vector3(-0.35, 1, 0),
    tailPoints: [
      new THREE.Vector3(0, -0.15, 0),
      new THREE.Vector3(0, 0.24, 0),
      new THREE.Vector3(0.12, 0.45, 0),
      new THREE.Vector3(0.35, 0.5, 0),
      new THREE.Vector3(0.55, 0.3, 0),
      new THREE.Vector3(0.6, -0.1, 0),
    ],
  });
  lineHand.scale.setScalar(0.8);
  lineHand.position.set(0, lineHandY, 0);
  lineHand.userData.role = 'leadsman-hand-on-sounding-line';
  const soundingLineGroup = new THREE.Group();
  soundingLineGroup.userData.role = 'sounding-line-and-leadsman-hand';
  soundingLineGroup.add(soundingLine, lineKnot, lineHand);
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
    lineHand,
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
    freshWeightLift,
    freshWeightRaisedRelativeY,
    freshWeightStartRelativeY,
    freshWeightStartY,
    groundedWeightCenterY,
    seabedLength,
    stationDrift,
    rearmBodyY,
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
      'rod-hauled-out-re-armed-far-above-view-and-lowered-back-seated-as-vessel-moves-to-next-station-carrying-bottom-and-spent-weight-off-sideways',
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
    // The leadsman's hand hauls the line in with the rod (above the view).
    lineHand.position.y = lineHandY
      + Math.max(0, state.bodyPositionY - recoveredBodyY);
    soundingLine.userData.setCurve(new THREE.LineCurve3(eyeTop, lineHand.position.clone()));

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
      freshWeightReload: {
        active: state.freshWeightReload,
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
    // bottom and is lowered onto it, the weight drops, and the rod is hauled
    // up out of the view on its line, leaving the spent weight on the
    // bottom. Far above any view the weight left at the previous station is
    // threaded on as the fresh weight, and the re-armed rod is lowered back
    // into Brown's pose while the vessel moves on to the next station: the
    // bottom and the spent weight on it move off sideways together. The two
    // weights swap roles each sounding, so the display loop is two
    // soundings long. The display frame group is kept, at rest.
    const { root } = model;
    const displayFrame = new THREE.Group();
    displayFrame.userData.role = 'fixed-world-display-frame';
    for (const child of [...root.children]) displayFrame.add(child);
    root.add(displayFrame);
    const { weightAssembly } = root.userData.blocks;
    const spareWeight = weightAssembly.clone(true);
    spareWeight.userData.role = 'second-alternating-bored-sounding-weight';
    displayFrame.add(spareWeight);
    root.userData.blocks.spareWeightAssembly = spareWeight;
    const weights = [weightAssembly, spareWeight];
    const { timeline } = root.userData;
    const frameUpdate = model.update;
    model.update = (time) => {
      frameUpdate(time);
      const state = root.userData.kinematics;
      // Before recovery the working weight is this sounding's; after it,
      // the fresh one is the other weight, which is next sounding's.
      const own = state.soundingParity;
      const working = state.cycleTime < timeline.rodRecovered ? own : 1 - own;
      weights[working].position.set(state.weightCenterX, state.weightCenterY, 0);
      weights[1 - working].position.set(state.spentWeightPosition[0], state.spentWeightPosition[1], 0);
      root.userData.blocks.seabed.position.x = state.worldOffsetX;
      root.userData.activeWeightAssembly = weights[working];
    };
    // Two soundings make one seamless loop (the weights swap roles).
    root.userData.animationTiming = { authoredCyclePeriod: 2 * timeline.cycleClosure };
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
      for (let node = object; node; node = node.parent) if (node === spareWeight) return;
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
