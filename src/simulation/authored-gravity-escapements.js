import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import { GRAVITY_ESCAPEMENT_PLATES } from './baked/gravity-escapement-plates.js';
import { ringArea, trimOutwardCusps } from './outline-cusps.js';
import { spokedWheelGeometry } from './spoked-wheel.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import { makeSeeThrough } from './see-through-part.js';

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

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (x * (x * 6 - 15) + 10);
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 12,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
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
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.max(36, points.length * 2),
      radius,
      8,
      false,
    ),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function polygonShape(points) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return shape;
}

// A locking leg as one flat outline: two straight flanks tapering from the
// root edge (at rootX, half-width rootHalfWidth) tangent into a round tip of
// tipRadius centred at tipCenterX on the leg's axis. The hardened tip is
// part of the leg, so no separate stud stands proud of its faces.
function taperedRoundTipLegShape(rootX, rootHalfWidth, tipCenterX, tipRadius,
  segments = 24) {
  const a = rootX - tipCenterX;
  const b = rootHalfWidth;
  const reach = Math.hypot(a, b);
  const base = Math.atan2(b, a);
  const spread = Math.acos(tipRadius / reach);
  const tangentAngle = [base - spread, base + spread]
    .find((angle) => Math.sin(angle) > 0 && Math.cos(angle) > -0.5);
  const points = [new THREE.Vector2(rootX, -rootHalfWidth)];
  for (let index = 0; index <= segments; index += 1) {
    const angle = -tangentAngle + 2 * tangentAngle * index / segments;
    points.push(new THREE.Vector2(
      tipCenterX + tipRadius * Math.cos(angle),
      tipRadius * Math.sin(angle),
    ));
  }
  points.push(new THREE.Vector2(rootX, rootHalfWidth));
  return polygonShape(points);
}

// Working plates are declared in their owner's frame as unions of straight
// bands, discs and polygons over a z slab. Their production outlines are
// the blanks minus every other body's swept envelope, baked offline by
// scripts/generate-gravity-escapement-plates.mjs.
const PLATE_DISC_SEGMENTS = 36;
const plateBand = (start, end, width) => ({
  end: [end.x, end.y],
  kind: 'band',
  start: [start.x, start.y],
  width,
});
const plateDisc = (center, radius) => ({
  center: [center.x, center.y],
  kind: 'disc',
  radius,
});
const platePolygon = (points) => ({
  kind: 'polygon',
  points: points.map((point) => [point.x, point.y]),
});
const plateSector = (center, innerRadius, outerRadius, startAngle,
  endAngle, segments = 12) => platePolygon([
  ...Array.from({ length: segments + 1 }, (_, index) => {
    const angle = THREE.MathUtils.lerp(startAngle, endAngle,
      index / segments);
    return new THREE.Vector2(
      center.x + Math.cos(angle) * outerRadius,
      center.y + Math.sin(angle) * outerRadius,
    );
  }),
  ...Array.from({ length: segments + 1 }, (_, index) => {
    const angle = THREE.MathUtils.lerp(endAngle, startAngle,
      index / segments);
    return new THREE.Vector2(
      center.x + Math.cos(angle) * innerRadius,
      center.y + Math.sin(angle) * innerRadius,
    );
  }),
]);
const plateStroke = (points, width) => [
  ...points.slice(1).map((point, index) => plateBand(
    points[index], point, width,
  )),
  ...points.slice(1, -1).map((point) => plateDisc(point, width / 2)),
];

function platePrimitiveRing(primitive) {
  if (primitive.kind === 'disc') {
    const [x, y] = primitive.center;
    return Array.from({ length: PLATE_DISC_SEGMENTS }, (_, index) => {
      const angle = index * FULL_TURN / PLATE_DISC_SEGMENTS;
      return [
        x + Math.cos(angle) * primitive.radius,
        y + Math.sin(angle) * primitive.radius,
      ];
    });
  }
  if (primitive.kind === 'band') {
    const [ax, ay] = primitive.start;
    const [bx, by] = primitive.end;
    const length = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / length * primitive.width / 2;
    const ny = (bx - ax) / length * primitive.width / 2;
    return [
      [ax + nx, ay + ny],
      [bx + nx, by + ny],
      [bx - nx, by - ny],
      [ax - nx, ay - ny],
    ];
  }
  return primitive.points.map((point) => [...point]);
}

function ringShape(outer, holes = []) {
  const shape = polygonShape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of holes) {
    const path = new THREE.Path();
    hole.forEach(([x, y], index) => {
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// 310 and 312: each joint of a stroked arm leaves a sub-pixel step where the
// band's square corner stands up to 0.0004 proud of the joint disc's chords;
// the faceting screen reads the pairs as a zigzag outline. Cutting those
// outward corners only removes material, so the baked clearance still holds.
const TRIM_JOINT_STEP_IDS = new Set([310, 312]);
const trimJointSteps = (outer) => trimOutwardCusps(outer, {
  material: Math.sign(ringArea(outer)),
  maxSegment: 0,
  tinySegment: 0.001,
});

function createSweptPlateRegistry(movementId) {
  const bake = GRAVITY_ESCAPEMENT_PLATES[movementId] ?? null;
  const plates = [];
  const add = ({ key, material, owner, primitives, role, z0, z1 }) => {
    const bakedEntry = bake?.plates?.[key];
    const baked = bakedEntry?.outer?.length && TRIM_JOINT_STEP_IDS.has(movementId)
      ? { ...bakedEntry, outer: trimJointSteps(bakedEntry.outer) }
      : bakedEntry;
    const shapes = baked?.outer?.length
      ? [ringShape(baked.outer, baked.holes)]
      : primitives.map((primitive) => ringShape(
        platePrimitiveRing(primitive),
      ));
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      bevelEnabled: false,
      curveSegments: 1,
      depth: z1 - z0,
      steps: 1,
    });
    geometry.translate(0, 0, z0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = role;
    mesh.userData.sweptPlateKey = key;
    mesh.userData.bakedSweptCut = Boolean(baked?.outer?.length);
    owner.add(mesh);
    plates.push({
      key,
      mesh,
      outline: baked?.outer?.length ? baked.outer : null,
      owner,
      primitiveRings: primitives.map(platePrimitiveRing),
      primitives,
      z0,
      z1,
    });
    return mesh;
  };
  return {
    add,
    bakeInputHash: bake?.inputHash ?? null,
    plates,
    runningClearance: bake?.runningClearance ?? null,
  };
}

function boredBearing(outerRadius, boreRadius, length, material,
  segments = 36) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: segments,
    depth: length,
    steps: 1,
  });
  geometry.translate(0, 0, -length / 2);
  return new THREE.Mesh(geometry, material);
}

function mudgeGravityEscapement(movement) {
  const root = new THREE.Group();

  // Brown's front elevation is almost exactly the diagram reproduced as
  // Beckett's Fig. 21. The small asymmetries below are measurements of the
  // engraving, not functional asymmetries: paired landmarks are averaged to
  // reconstruct the intended mirror-symmetric mechanism.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(258, 319);
  const sourceRasterWheelTop = new THREE.Vector2(257, 148);
  const sourceRasterLeftArbor = new THREE.Vector2(242, 28);
  const sourceRasterRightArbor = new THREE.Vector2(272, 28);
  const sourceRasterLeftPalletB = new THREE.Vector2(102, 210);
  const sourceRasterRightPalletA = new THREE.Vector2(414, 208);
  const sourceRasterForkPinQ = new THREE.Vector2(220, 501);
  const sourceRasterForkPinP = new THREE.Vector2(290, 500);
  const sourceRasterLeftWeight = new THREE.Vector2(105, 106);
  const sourceRasterRightWeight = new THREE.Vector2(403, 108);

  const wheelCenter = new THREE.Vector2(0, 0.20);
  const toothTipRadius = 2.25;
  const sourceWheelRadius = sourceRasterWheelCenter.distanceTo(
    sourceRasterWheelTop,
  );
  const sourceScale = toothTipRadius / sourceWheelRadius;
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    wheelCenter.x + (x - sourceRasterWheelCenter.x) * sourceScale,
    wheelCenter.y + (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const mappedLeftArbor = sourcePointToModel(sourceRasterLeftArbor);
  const mappedRightArbor = sourcePointToModel(sourceRasterRightArbor);
  const mappedForkPinQ = sourcePointToModel(sourceRasterForkPinQ);
  const mappedForkPinP = sourcePointToModel(sourceRasterForkPinP);
  const mappedLeftWeight = sourcePointToModel(sourceRasterLeftWeight);
  const mappedRightWeight = sourcePointToModel(sourceRasterRightWeight);
  const mappedLeftPallet = sourcePointToModel(sourceRasterLeftPalletB);
  const mappedRightPallet = sourcePointToModel(sourceRasterRightPalletA);

  const palletPivotX = (
    Math.abs(mappedLeftArbor.x) + Math.abs(mappedRightArbor.x)
  ) / 2;
  const palletPivotY = (mappedLeftArbor.y + mappedRightArbor.y) / 2;
  const palletPivot = (side) => new THREE.Vector2(
    side * palletPivotX,
    palletPivotY,
  );
  const forkWorldX = (
    Math.abs(mappedForkPinQ.x) + Math.abs(mappedForkPinP.x)
  ) / 2;
  const forkWorldY = (mappedForkPinQ.y + mappedForkPinP.y) / 2;
  const forkLocalX = forkWorldX - palletPivotX;
  const forkLocalY = forkWorldY - palletPivotY;
  const forkLocalPoint = (side) => new THREE.Vector2(
    side * forkLocalX,
    forkLocalY,
  );
  const weightWorldX = (
    Math.abs(mappedLeftWeight.x) + Math.abs(mappedRightWeight.x)
  ) / 2;
  const weightWorldY = (mappedLeftWeight.y + mappedRightWeight.y) / 2;
  const weightLocalX = weightWorldX - palletPivotX;
  const weightLocalY = weightWorldY - palletPivotY;
  const weightLocalPoint = (side) => new THREE.Vector2(
    side * weightLocalX,
    weightLocalY,
  );
  const sourcePalletWorldX = (
    Math.abs(mappedLeftPallet.x) + Math.abs(mappedRightPallet.x)
  ) / 2;
  const sourcePalletWorldY = (
    mappedLeftPallet.y + mappedRightPallet.y
  ) / 2;

  const pendulumPivot = new THREE.Vector2(0, palletPivotY + 0.15);
  const pendulumRodRadius = 0.075;
  const forkPinRadius = 0.105;
  const forkContactClearance = pendulumRodRadius + forkPinRadius;
  const pendulumPeriod = 4;
  const pendulumAmplitude = THREE.MathUtils.degToRad(5);
  const pickupAngle = THREE.MathUtils.degToRad(1.5);
  const unlockAngle = THREE.MathUtils.degToRad(2.1);
  const wheelDepth = 0.28;
  const palletDepth = 0.16;
  const palletPlaneZ = 0;
  const pendulumPlaneZ = 0.5;

  const toothCount = 30;
  const toothPitch = FULL_TURN / toothCount;
  const wheelRootRadius = 1.98;
  const wheelInnerRadius = 1.48;
  // Brown draws the locked B tooth with its tip in notch b at 129.4 degrees
  // about the wheel centre (and his teeth at that phase). The mirrored lock
  // stations 129 and 51 degrees are six and a half pitches apart: the wheel
  // steps half a pitch per beat, so a fallen pallet's stop always hangs over
  // the middle of a tooth space, never on a tooth. (Locking at 135/45, seven
  // and a half pitches apart, set B's lifting face so low that the teeth
  // swept away Brown's level bottom edge.)
  const leftLockAngle = THREE.MathUtils.degToRad(129);
  const rightLockAngle = THREE.MathUtils.degToRad(51);
  const lockStationSeparationTeeth = 6.5;
  const wheelAdvancePerBeat = toothPitch / 2;
  const wheelAdvancePerCycle = toothPitch;

  const pendulumMotionAtPhase = (cyclePhase) => {
    const argument = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / pendulumPeriod;
    return {
      acceleration: -pendulumAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angle: pendulumAmplitude * Math.cos(argument),
      speed: -pendulumAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };

  const forkCenterAt = (side, magnitude) => palletPivot(side).add(
    rotate2(forkLocalPoint(side), side * magnitude),
  );
  const signedForkClearance = (outwardPendulumAngle, magnitude) => {
    const forkCenter = forkCenterAt(1, magnitude);
    const pendulumNormal = new THREE.Vector2(
      Math.cos(outwardPendulumAngle),
      Math.sin(outwardPendulumAngle),
    );
    return pendulumNormal.dot(
      forkCenter.clone().sub(pendulumPivot),
    );
  };
  const forkMagnitudeAt = (outwardPendulumAngle) => {
    let lower = THREE.MathUtils.degToRad(-12);
    let upper = THREE.MathUtils.degToRad(8);
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (signedForkClearance(outwardPendulumAngle, middle)
          > forkContactClearance) {
        upper = middle;
      } else {
        lower = middle;
      }
    }
    return (lower + upper) / 2;
  };
  const cockedMagnitude = forkMagnitudeAt(pickupAngle);
  const releaseMagnitude = forkMagnitudeAt(unlockAngle);
  const fallenMagnitude = forkMagnitudeAt(-pickupAngle);
  const maximumLiftMagnitude = forkMagnitudeAt(pendulumAmplitude);

  const rightEffectiveImpulseStartPhase = Math.acos(
    pickupAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const leftPickupPhase = Math.acos(
    -pickupAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const leftUnlockPhase = Math.acos(
    -unlockAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const firstWheelStepEndPhase = 0.44;
  const leftEffectiveImpulseStartPhase = 0.5
    + rightEffectiveImpulseStartPhase;
  const rightPickupPhase = 1 - rightEffectiveImpulseStartPhase;
  const rightUnlockPhase = 1 - Math.acos(
    unlockAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const secondWheelStepEndPhase = 0.94;
  const phaseBoundaryEpsilon = 1e-12;

  const lockAngleForSide = (side) => (
    side > 0 ? rightLockAngle : leftLockAngle
  );
  const toothTipAt = (wheelAngle, toothIndex) => {
    const angle = wheelAngle + toothIndex * toothPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * toothTipRadius,
      Math.sin(angle) * toothTipRadius,
    ));
  };
  const fixedLockPointForSide = (side) => {
    const angle = lockAngleForSide(side);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * toothTipRadius,
      Math.sin(angle) * toothTipRadius,
    ));
  };
  const palletLocalPoint = (side, worldPoint, magnitude) => rotate2(
    worldPoint.clone().sub(palletPivot(side)),
    -side * magnitude,
  );
  const palletWorldPoint = (side, localPoint, magnitude) => palletPivot(side)
    .add(rotate2(localPoint, side * magnitude));
  const liftFaceLocalPointAt = (side, progress) => {
    const easedProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const toothAngle = lockAngleForSide(side)
      + wheelAdvancePerBeat * (1 - easedProgress);
    const toothPoint = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(toothAngle) * toothTipRadius,
      Math.sin(toothAngle) * toothTipRadius,
    ));
    const magnitude = THREE.MathUtils.lerp(
      fallenMagnitude,
      cockedMagnitude,
      easedProgress,
    );
    return palletLocalPoint(side, toothPoint, magnitude);
  };
  const lockFaceLocalPointAt = (side, magnitude) => palletLocalPoint(
    side,
    fixedLockPointForSide(side),
    magnitude,
  );
  const weightCenterAt = (side, magnitude) => palletWorldPoint(
    side,
    weightLocalPoint(side),
    magnitude,
  );
  const standardGravity = 9.80665;
  const palletWeightMass = 1;
  const gravityPotentialAt = (side, magnitude) => (
    palletWeightMass * standardGravity * weightCenterAt(side, magnitude).y
  );
  const netGravityPotentialDrop = gravityPotentialAt(1, cockedMagnitude)
    - gravityPotentialAt(1, fallenMagnitude);

  const wheelAngleAtCycleStart = (cycleIndex) => (
    leftLockAngle - cycleIndex * wheelAdvancePerCycle
  );

  const rawStateAtTime = (time) => {
    const cycleCoordinate = time / pendulumPeriod;
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const pendulum = pendulumMotionAtPhase(cyclePhase);
    const startingLeftToothIndex = positiveModulo(
      cycleIndex,
      toothCount,
    );
    const rightToothIndex = positiveModulo(
      startingLeftToothIndex - (lockStationSeparationTeeth - 0.5),
      toothCount,
    );
    const landingLeftToothIndex = positiveModulo(
      startingLeftToothIndex + 1,
      toothCount,
    );
    let activeLiftSide = null;
    let activeLiftToothIndex = null;
    let activeLockSide = null;
    let activeLockToothIndex = null;
    let effectiveGravityImpulseActive = false;
    let forkContactSide = null;
    let gravityDescentSide = null;
    let leftMagnitude = cockedMagnitude;
    let liftProgress = null;
    let mode = 'right-pallet-gravity-recovery';
    let pendulumRaisedPalletSide = null;
    let rightMagnitude = cockedMagnitude;
    let trainCoupledToPendulum = false;
    let wheelAdvance = 0;

    if (cyclePhase < leftPickupPhase - phaseBoundaryEpsilon) {
      rightMagnitude = forkMagnitudeAt(pendulum.angle);
      activeLockSide = 'left';
      activeLockToothIndex = startingLeftToothIndex;
      forkContactSide = 'right';
      gravityDescentSide = 'right';
      if (cyclePhase >= rightEffectiveImpulseStartPhase) {
        effectiveGravityImpulseActive = true;
        mode = 'right-weighted-pallet-gravity-impulse';
      }
    } else if (cyclePhase < leftUnlockPhase - phaseBoundaryEpsilon) {
      leftMagnitude = forkMagnitudeAt(-pendulum.angle);
      rightMagnitude = fallenMagnitude;
      activeLockSide = 'left';
      activeLockToothIndex = startingLeftToothIndex;
      forkContactSide = 'left';
      mode = 'left-fork-Q-lifts-and-unlocks-pallet-B';
      pendulumRaisedPalletSide = 'left';
      trainCoupledToPendulum = true;
    } else if (cyclePhase <= firstWheelStepEndPhase
      + phaseBoundaryEpsilon) {
      const linearProgress = (
        cyclePhase - leftUnlockPhase
      ) / (firstWheelStepEndPhase - leftUnlockPhase);
      liftProgress = smootherStep(linearProgress);
      leftMagnitude = forkMagnitudeAt(-pendulum.angle);
      rightMagnitude = THREE.MathUtils.lerp(
        fallenMagnitude,
        cockedMagnitude,
        liftProgress,
      );
      activeLiftSide = 'right';
      activeLiftToothIndex = rightToothIndex;
      forkContactSide = 'left';
      mode = 'wheel-cocks-right-weighted-pallet-A';
      pendulumRaisedPalletSide = 'left';
      wheelAdvance = wheelAdvancePerBeat * liftProgress;
    } else if (cyclePhase < 0.5 - phaseBoundaryEpsilon) {
      leftMagnitude = forkMagnitudeAt(-pendulum.angle);
      rightMagnitude = cockedMagnitude;
      activeLockSide = 'right';
      activeLockToothIndex = rightToothIndex;
      forkContactSide = 'left';
      mode = 'left-pallet-carried-to-outer-turn';
      pendulumRaisedPalletSide = 'left';
      wheelAdvance = wheelAdvancePerBeat;
    } else if (cyclePhase < rightPickupPhase - phaseBoundaryEpsilon) {
      leftMagnitude = forkMagnitudeAt(-pendulum.angle);
      rightMagnitude = cockedMagnitude;
      activeLockSide = 'right';
      activeLockToothIndex = rightToothIndex;
      forkContactSide = 'left';
      gravityDescentSide = 'left';
      mode = 'left-pallet-gravity-recovery';
      wheelAdvance = wheelAdvancePerBeat;
      if (cyclePhase >= leftEffectiveImpulseStartPhase) {
        effectiveGravityImpulseActive = true;
        mode = 'left-weighted-pallet-gravity-impulse';
      }
    } else if (cyclePhase < rightUnlockPhase - phaseBoundaryEpsilon) {
      leftMagnitude = fallenMagnitude;
      rightMagnitude = forkMagnitudeAt(pendulum.angle);
      activeLockSide = 'right';
      activeLockToothIndex = rightToothIndex;
      forkContactSide = 'right';
      mode = 'right-fork-P-lifts-and-unlocks-pallet-A';
      pendulumRaisedPalletSide = 'right';
      trainCoupledToPendulum = true;
      wheelAdvance = wheelAdvancePerBeat;
    } else if (cyclePhase <= secondWheelStepEndPhase
      + phaseBoundaryEpsilon) {
      const linearProgress = (
        cyclePhase - rightUnlockPhase
      ) / (secondWheelStepEndPhase - rightUnlockPhase);
      liftProgress = smootherStep(linearProgress);
      leftMagnitude = THREE.MathUtils.lerp(
        fallenMagnitude,
        cockedMagnitude,
        liftProgress,
      );
      rightMagnitude = forkMagnitudeAt(pendulum.angle);
      activeLiftSide = 'left';
      activeLiftToothIndex = landingLeftToothIndex;
      forkContactSide = 'right';
      mode = 'wheel-cocks-left-weighted-pallet-B';
      pendulumRaisedPalletSide = 'right';
      wheelAdvance = wheelAdvancePerBeat * (1 + liftProgress);
    } else {
      leftMagnitude = cockedMagnitude;
      rightMagnitude = forkMagnitudeAt(pendulum.angle);
      activeLockSide = 'left';
      activeLockToothIndex = landingLeftToothIndex;
      forkContactSide = 'right';
      mode = 'right-pallet-carried-to-outer-turn';
      pendulumRaisedPalletSide = 'right';
      wheelAdvance = wheelAdvancePerCycle;
    }

    const wheelAngle = wheelAngleAtCycleStart(cycleIndex) - wheelAdvance;
    const leftPalletAngle = -leftMagnitude;
    const rightPalletAngle = rightMagnitude;
    const forkSideSign = forkContactSide === 'right' ? 1 : -1;
    const forkMagnitude = forkContactSide === 'right'
      ? rightMagnitude
      : leftMagnitude;
    const activeForkCenter = forkCenterAt(forkSideSign, forkMagnitude);
    const pendulumDirection = new THREE.Vector2(
      Math.sin(pendulum.angle),
      -Math.cos(pendulum.angle),
    );
    const pendulumNormal = new THREE.Vector2(
      Math.cos(pendulum.angle),
      Math.sin(pendulum.angle),
    );
    const forkProjection = activeForkCenter.clone().sub(pendulumPivot)
      .dot(pendulumDirection);
    const pendulumRodCenterPoint = pendulumPivot.clone().add(
      pendulumDirection.clone().multiplyScalar(forkProjection),
    );
    const pendulumSurfacePoint = pendulumRodCenterPoint.clone().add(
      pendulumNormal.clone().multiplyScalar(
        forkSideSign * pendulumRodRadius,
      ),
    );
    const forkSurfacePoint = activeForkCenter.clone().add(
      pendulumNormal.clone().multiplyScalar(
        -forkSideSign * forkPinRadius,
      ),
    );
    const forkContactPoint = pendulumSurfacePoint.clone().add(
      forkSurfacePoint,
    ).multiplyScalar(0.5);

    const activeLiftPoint = activeLiftToothIndex === null
      ? null
      : toothTipAt(wheelAngle, activeLiftToothIndex);
    const activeLiftFaceLocalPoint = activeLiftSide === null
      ? null
      : liftFaceLocalPointAt(
        activeLiftSide === 'right' ? 1 : -1,
        liftProgress,
      );
    const liftSideSign = activeLiftSide === 'right' ? 1 : -1;
    const liftMagnitude = activeLiftSide === 'right'
      ? rightMagnitude
      : leftMagnitude;
    const activeLiftFacePoint = activeLiftSide === null
      ? null
      : palletWorldPoint(
        liftSideSign,
        activeLiftFaceLocalPoint,
        liftMagnitude,
      );
    const lockSideSign = activeLockSide === 'right' ? 1 : -1;
    const lockMagnitude = activeLockSide === 'right'
      ? rightMagnitude
      : leftMagnitude;
    const activeLockPoint = activeLockSide === null
      ? null
      : toothTipAt(wheelAngle, activeLockToothIndex);
    const activeLockFaceLocalPoint = activeLockSide === null
      ? null
      : lockFaceLocalPointAt(lockSideSign, lockMagnitude);
    const activeLockFacePoint = activeLockSide === null
      ? null
      : palletWorldPoint(
        lockSideSign,
        activeLockFaceLocalPoint,
        lockMagnitude,
      );

    return {
      activeForkCenter,
      activeLiftFaceLocalPoint,
      activeLiftFacePoint,
      activeLiftPoint,
      activeLiftSide,
      activeLiftToothIndex,
      activeLockFaceLocalPoint,
      activeLockFacePoint,
      activeLockPoint,
      activeLockSide,
      activeLockToothIndex,
      cycleIndex,
      cyclePhase,
      effectiveGravityImpulseActive,
      forkContactError: Math.abs(
        activeForkCenter.distanceTo(pendulumRodCenterPoint)
          - forkContactClearance
      ),
      forkContactPoint,
      forkContactSide,
      gravityDescentSide,
      gravityImpulseIsolatedFromTrain:
        effectiveGravityImpulseActive && !trainCoupledToPendulum,
      impulseDirection: effectiveGravityImpulseActive
        ? gravityDescentSide === 'right' ? 'leftward' : 'rightward'
        : null,
      landingLeftToothIndex,
      leftPalletAngle,
      leftPalletMagnitude: leftMagnitude,
      liftContactError: activeLiftPoint === null
        ? null
        : activeLiftPoint.distanceTo(activeLiftFacePoint),
      liftProgress,
      lockContactError: activeLockPoint === null
        ? null
        : activeLockPoint.distanceTo(activeLockFacePoint),
      mode,
      palletPotentialEnergy: {
        left: gravityPotentialAt(-1, leftMagnitude),
        right: gravityPotentialAt(1, rightMagnitude),
      },
      pendulumAngle: pendulum.angle,
      pendulumAngularAcceleration: pendulum.acceleration,
      pendulumAngularSpeed: pendulum.speed,
      pendulumRaisedPalletSide,
      rightPalletAngle,
      rightPalletMagnitude: rightMagnitude,
      rightToothIndex,
      startingLeftToothIndex,
      trainCoupledToPendulum,
      trainRaisingPalletSide: activeLiftSide,
      wheelAdvance,
      wheelAngle,
      wheelLocked: activeLockSide !== null,
      wheelStepActive: activeLiftSide !== null,
    };
  };

  const derivativeStep = 1e-5;
  const stateAtTime = (time) => {
    const state = rawStateAtTime(time);
    const before = rawStateAtTime(time - derivativeStep);
    const after = rawStateAtTime(time + derivativeStep);
    return {
      ...state,
      leftPalletAngularSpeed: (
        after.leftPalletAngle - before.leftPalletAngle
      ) / (2 * derivativeStep),
      rightPalletAngularSpeed: (
        after.rightPalletAngle - before.rightPalletAngle
      ) / (2 * derivativeStep),
      wheelAngularAcceleration: (
        after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle
      ) / derivativeStep ** 2,
      wheelAngularSpeed: (
        after.wheelAngle - before.wheelAngle
      ) / (2 * derivativeStep),
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.28,
    roughness: 0.56,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.38,
    roughness: 0.40,
  });
  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const palletMaterial = matte(PALETTE.accent, {
    metalness: 0.34,
    roughness: 0.42,
  });
  const weightMaterial = matte(PALETTE.brass, {
    metalness: 0.42,
    roughness: 0.35,
  });
  const pendulumMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.56,
  });
  const markerMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.28,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-Mudge-escapement-frame';
  root.add(fixedFrame);
  const topCrossbar = beamBetween(
    new THREE.Vector3(-3.0, palletPivotY + 0.55, -0.56),
    new THREE.Vector3(3.0, palletPivotY + 0.55, -0.56),
    0.16,
    0.18,
    frameMaterial,
  );
  topCrossbar.userData.role = 'upper-arbor-frame-crossbar';
  fixedFrame.add(topCrossbar);
  const frameUprights = [-1, 1].map((side) => {
    const upright = beamBetween(
      new THREE.Vector3(side * 2.92, -3.62, -0.56),
      new THREE.Vector3(side * 2.92, palletPivotY + 0.55, -0.56),
      0.16,
      0.18,
      frameMaterial,
    );
    upright.userData.side = side;
    upright.userData.role = 'clock-frame-upright';
    fixedFrame.add(upright);
    return upright;
  });
  const lowerCrossbar = beamBetween(
    new THREE.Vector3(-3.0, -3.62, -0.56),
    new THREE.Vector3(3.0, -3.62, -0.56),
    0.16,
    0.18,
    frameMaterial,
  );
  lowerCrossbar.userData.role = 'clock-frame-lower-crossbar';
  fixedFrame.add(lowerCrossbar);
  const wheelBearingBracket = beamBetween(
    new THREE.Vector3(-2.92, wheelCenter.y, -0.56),
    new THREE.Vector3(wheelCenter.x - 0.17, wheelCenter.y, -0.56),
    0.13,
    0.17,
    frameMaterial,
  );
  wheelBearingBracket.userData.role = 'escape-wheel-bearing-bracket';
  fixedFrame.add(wheelBearingBracket);
  const palletBearingBrackets = [-1, 1].map((side) => {
    const pivot = palletPivot(side);
    const bracket = beamBetween(
      new THREE.Vector3(side * 2.92, pivot.y, -0.52),
      new THREE.Vector3(pivot.x + side * 0.11, pivot.y, -0.52),
      0.11,
      0.15,
      frameMaterial,
    );
    bracket.userData.side = side;
    bracket.userData.role = 'independent-pallet-arbor-bracket';
    fixedFrame.add(bracket);
    return bracket;
  });
  const plateRegistry = createSweptPlateRegistry(movement.id);
  // Journals are bored rings on the rear frame plane; the moving arbors run
  // back through them. The pendulum hangs from a cock in front, clear of the
  // two pallet arbors either side of its axis.
  const frameBearings = [
    [wheelCenter, 'escape-wheel-bearing', -0.56, 0.21, 0.12],
    [palletPivot(-1), 'left-independent-pallet-bearing-C', -0.52, 0.14,
      0.085],
    [palletPivot(1), 'right-independent-pallet-bearing-C', -0.52, 0.14,
      0.085],
  ].map(([point, role, z, outerRadius, boreRadius]) => {
    const bearing = boredBearing(outerRadius, boreRadius, 0.16,
      darkMaterial);
    bearing.position.set(point.x, point.y, z);
    bearing.userData.role = role;
    fixedFrame.add(bearing);
    return bearing;
  });
  const suspensionCockZ = pendulumPlaneZ + 0.20;
  const suspensionCockTopY = palletPivotY + 0.55 + 0.15;
  const suspensionStud = cylinderAlongZ(0.13,
    suspensionCockZ + 0.04 - (pendulumPlaneZ - 0.12), darkMaterial, 30);
  suspensionStud.position.set(pendulumPivot.x, pendulumPivot.y,
    (suspensionCockZ + 0.04 + pendulumPlaneZ - 0.12) / 2);
  suspensionStud.userData.role = 'pendulum-suspension-bearing';
  fixedFrame.add(suspensionStud);
  frameBearings.push(suspensionStud);
  const suspensionCock = beamBetween(
    new THREE.Vector3(pendulumPivot.x, pendulumPivot.y, suspensionCockZ),
    new THREE.Vector3(pendulumPivot.x, suspensionCockTopY + 0.06,
      suspensionCockZ),
    0.14,
    0.08,
    frameMaterial,
  );
  suspensionCock.userData.role = 'front-pendulum-suspension-cock';
  fixedFrame.add(suspensionCock);
  const suspensionCockArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.12, suspensionCockZ + 0.04 + 0.65),
    frameMaterial,
  );
  suspensionCockArm.position.set(pendulumPivot.x, suspensionCockTopY,
    (suspensionCockZ + 0.04 - 0.65) / 2);
  suspensionCockArm.userData.role = 'pendulum-cock-to-frame-arm';
  fixedFrame.add(suspensionCockArm);

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-thirty-tooth-Mudge-gravity-escape-wheel';
  root.add(escapeWheel);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'two-steps-per-cycle-wheel-rotor';
  escapeWheel.add(wheelRotor);
  // Brown's ratchet teeth: each tip has a nearly radial face on its
  // clockwise (leading) side and a long straight back sloping down on its
  // counterclockwise side to the root, followed by a short land on the root
  // circle (measured on both flanks of his wheel: back about half a pitch,
  // land about 0.45 pitch). The tips, which do all the locking and lifting,
  // keep their stations.
  const toothFaceUndercut = 0.03;
  const toothBack = 0.5;
  const polarPoint = (angle, radius) => new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
  const wheelShape = new THREE.Shape();
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const centerAngle = toothIndex * toothPitch;
    const landEnd = centerAngle + toothPitch * (1 - toothFaceUndercut);
    const landStart = centerAngle + toothPitch * toothBack;
    const outline = [
      polarPoint(centerAngle - toothPitch * toothFaceUndercut, wheelRootRadius),
      polarPoint(centerAngle, toothTipRadius),
      ...Array.from({ length: 4 }, (_, index) => polarPoint(
        THREE.MathUtils.lerp(landStart, landEnd, index / 4),
        wheelRootRadius,
      )),
    ];
    for (const point of outline) {
      if (toothIndex === 0 && point === outline[0]) {
        wheelShape.moveTo(point.x, point.y);
      } else {
        wheelShape.lineTo(point.x, point.y);
      }
    }
  }
  wheelShape.closePath();
  // One plate (spoked-wheel.js): the thirty teeth on a narrow rim (Brown's
  // rim is about 0.14 of the root radius deep) and an X of four slender
  // spokes that flare into the rim and, with large fillets, into the hub.
  // The phase stands Brown's X of spokes at 45 degrees in the opening pose.
  const wheelTeeth = new THREE.Mesh(
    spokedWheelGeometry({
      outline: wheelShape.getPoints(),
      rimInnerRadius: wheelRootRadius * 0.875,
      spokes: 4,
      spokeWidth: 0.12,
      hubRadius: 0.40,
      rimFillet: 0.05,
      boreRadius: 0.30,
      thickness: wheelDepth,
      phase: Math.PI / 4 - stateAtTime(0).wheelAngle,
    }),
    wheelMaterial,
  );
  wheelTeeth.userData.role = 'thirty-pointed-escape-wheel-teeth';
  wheelTeeth.userData.noRotationIndicator = true;
  wheelRotor.add(wheelTeeth);
  // The spokes are part of the one-piece wheel plate.
  const spokeMeshes = [];
  // The hub stays below the half-fork layer that crosses in front of it.
  const wheelHub = cylinderAlongZ(0.30, 0.30, darkMaterial, 36);
  wheelHub.userData.role = 'escape-wheel-hub';
  wheelRotor.add(wheelHub);
  const wheelShaftRearZ = -0.68;
  const wheelShaftFrontZ = 0.15;
  const wheelShaft = cylinderAlongZ(0.11,
    wheelShaftFrontZ - wheelShaftRearZ, darkMaterial, 28);
  wheelShaft.position.z = (wheelShaftFrontZ + wheelShaftRearZ) / 2;
  wheelShaft.userData.role = 'escape-wheel-arbor';
  wheelRotor.add(wheelShaft);
  const wheelPhaseWitness = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 12),
    markerMaterial,
  );
  wheelPhaseWitness.position.set(
    Math.cos(Math.PI / 4) * 0.95,
    Math.sin(Math.PI / 4) * 0.95,
    0.06,
  );
  wheelPhaseWitness.userData.role = 'white-wheel-phase-witness';
  wheelRotor.add(wheelPhaseWitness);

  // Each pallet is one flat plate in the wheel's plane, as Brown draws it: a
  // broad arm from its arbor C down to the working end, where a straight
  // lifting face (B, A) leads into the locking notch (b, a) whose stop is an
  // arc about C; a threaded stem carries the ball weight square to the arm's
  // outer edge. The long half-fork to pin Q or P is a second flat bar on the
  // same arbor, in front of the wheel. Brown's outlines are measured on the
  // left pallet (the right one is its mirror image).
  const sourceRasterLeftArmOuterTop = new THREE.Vector2(228, 34);
  const sourceRasterLeftArmInnerTop = new THREE.Vector2(233, 55);
  const sourceRasterLeftArmOuterEnd = new THREE.Vector2(101, 203);
  const armPlaneHalfDepth = 0.08;
  const forkBarZ0 = 0.20;
  const forkBarZ1 = 0.30;
  const makeGravityPallet = (side) => {
    const sideName = side > 0 ? 'right-A-P' : 'left-B-Q';
    const group = new THREE.Group();
    const pivot = palletPivot(side);
    group.position.set(pivot.x, pivot.y, palletPlaneZ);
    group.userData.axis = Z_AXIS.clone();
    group.userData.side = side;
    group.userData.role =
      `${sideName}-independent-weighted-gravity-pallet`;
    root.add(group);

    // Local frame at the cocked pose; plate points are mirrored for side +1.
    const sourceLocal = (raster) => {
      const leftLocal = palletLocalPoint(-1, sourcePointToModel(raster), cockedMagnitude);
      return side < 0 ? leftLocal : new THREE.Vector2(-leftLocal.x, leftLocal.y);
    };
    const liftFacePoints = Array.from({ length: 25 }, (_, index) => (
      liftFaceLocalPointAt(side, index / 24)
    ));
    const lockFacePoints = Array.from({ length: 9 }, (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        cockedMagnitude,
        releaseMagnitude,
        index / 8,
      );
      return lockFaceLocalPointAt(side, magnitude);
    });
    const lock = lockFacePoints[0];
    const liftStart = liftFacePoints[0];
    const faceDirection = lock.clone().sub(liftStart).normalize();
    const stopEnd = lockFaceLocalPointAt(side, releaseMagnitude + 0.006);
    const stopArc = Array.from({ length: 7 }, (_, index) => lockFaceLocalPointAt(
      side,
      THREE.MathUtils.lerp(cockedMagnitude, releaseMagnitude + 0.006, index / 6),
    ));
    const outerTop = sourceLocal(sourceRasterLeftArmOuterTop);
    const innerTop = sourceLocal(sourceRasterLeftArmInnerTop);
    const outerEnd = sourceLocal(sourceRasterLeftArmOuterEnd);
    const armDirection = outerEnd.clone().sub(outerTop).normalize();
    // The inner edge runs parallel to the outer one at Brown's arm width and
    // meets the notch's back wall, which rises from the stop toward C.
    const armNormal = new THREE.Vector2(-armDirection.y, armDirection.x);
    if (armNormal.dot(innerTop.clone().sub(outerTop)) < 0) armNormal.multiplyScalar(-1);
    const armWidth = innerTop.clone().sub(outerTop).dot(armNormal);
    const innerLineAt = (point) => point.clone().addScaledVector(
      armNormal,
      -(point.clone().sub(outerTop).dot(armNormal) - armWidth),
    );
    const outerLineAt = (point) => outerTop.clone().addScaledVector(
      armDirection,
      point.clone().sub(outerTop).dot(armDirection),
    );
    const hubRadius = 0.15;
    // Brown runs both edges of the arm up into the eye round its arbor C:
    // the edges continue to the arbor's station along the arm, where the
    // hub disc rounds the end, so the arm and eye are one plate.
    const topOuter = outerLineAt(new THREE.Vector2(0, 0));
    const topInner = innerLineAt(topOuter);
    // The tooth tip rests on the stop arc (about C) from `lock` to `stopEnd`;
    // it pushes toward C on the left and away from C on the right, because
    // the wheel turns clockwise. After release it runs on along the wheel,
    // so the stop's end wall is cut back along that path.
    let armOutline;
    if (side < 0) {
      // B lifts on the arm's end face; b's stop wall rises toward C.
      const toPivot = stopEnd.clone().multiplyScalar(-1).normalize();
      const notchBack = stopEnd.clone().addScaledVector(toPivot, 0.14);
      // Brown's B end: a well-rounded outer corner at his (101.7, 202.5)
      // and his level bottom edge (y 206.5), which drops into a small nib
      // before rising into the lifting face. Brown hangs his nib in the
      // tooth space behind the locked tooth (x 135-151, down to y 215),
      // but the cocking tooth sweeps everything under the lifting face
      // (right of x ~129), so the nib hangs just short of that sweep: the
      // bottom runs to x 121.5, slopes down to a point at (128.3, 212.3)
      // and its right side rises beside the swept path into the lifting
      // face. The bake trims its lower edge clear of the next tooth's tip.
      const bluntCorner = sourceLocal(new THREE.Vector2(101.7, 202.5));
      const brownBottomEnd = sourceLocal(new THREE.Vector2(121.5, 206.1));
      const nibPoint = sourceLocal(new THREE.Vector2(128.3, 212.3));
      const nibRise = sourceLocal(new THREE.Vector2(130.5, 200));
      const bottomDirection = brownBottomEnd.clone().sub(bluntCorner).normalize();
      const round = 0.14;
      const cornerIn = bluntCorner.clone().addScaledVector(armDirection, -round);
      const cornerOut = bluntCorner.clone().addScaledVector(bottomDirection, round);
      const cornerArc = Array.from({ length: 9 }, (_, index) => {
        const u = (index + 1) / 10;
        return cornerIn.clone().multiplyScalar((1 - u) ** 2)
          .addScaledVector(bluntCorner, 2 * u * (1 - u))
          .addScaledVector(cornerOut, u * u);
      });
      armOutline = [
        topOuter,
        cornerIn,
        ...cornerArc,
        cornerOut,
        brownBottomEnd,
        nibPoint,
        nibRise,
        ...liftFacePoints,
        ...stopArc.slice(1),
        notchBack,
        innerLineAt(notchBack),
        topInner,
      ];
    } else {
      // A lifts on a block on the arm's inner edge; a is a hook at the end.
      const faceEnd = liftStart.clone().addScaledVector(faceDirection, -0.04);
      const outward = stopEnd.clone().normalize();
      const stopDrift = lock.clone().sub(stopEnd).normalize();
      const hookOut = stopEnd.clone().addScaledVector(
        outward.clone().addScaledVector(stopDrift, 0.55).normalize(),
        0.16,
      );
      armOutline = [
        topOuter,
        outerLineAt(hookOut),
        hookOut,
        ...stopArc.slice().reverse(),
        ...liftFacePoints.slice().reverse().slice(1),
        faceEnd,
        innerLineAt(faceEnd),
        topInner,
      ];
    }
    // Threaded weight stem, square to the arm's outer edge through the ball.
    const weightPoint = weightLocalPoint(side);
    const stemFoot = outerTop.clone().addScaledVector(
      armDirection,
      weightPoint.clone().sub(outerTop).dot(armDirection),
    );
    const stemOutward = weightPoint.clone().sub(stemFoot).normalize();
    const weightRadius = 0.30;
    const stemTip = weightPoint.clone().addScaledVector(stemOutward, weightRadius + 0.12);
    const arm = plateRegistry.add({
      key: `${side > 0 ? 'right' : 'left'}-pallet-plate`,
      material: palletMaterial,
      owner: group,
      primitives: [
        platePolygon(armOutline),
        plateDisc(new THREE.Vector2(0, 0), hubRadius),
        plateBand(stemFoot.clone().addScaledVector(stemOutward, -0.04), stemTip, 0.09),
      ],
      role: `${sideName}-pallet-plate-with-lifting-face-and-stop`,
      z0: -armPlaneHalfDepth - palletPlaneZ,
      z1: armPlaneHalfDepth - palletPlaneZ,
    });
    const forkPoint = forkLocalPoint(side);
    const forkRod = plateRegistry.add({
      key: `${side > 0 ? 'right' : 'left'}-half-fork`,
      material: palletMaterial,
      owner: group,
      primitives: [
        plateBand(new THREE.Vector2(0, 0), forkPoint, 0.12),
        plateDisc(new THREE.Vector2(0, 0), 0.12),
        // Pass 92: Brown draws each half-fork ending in a round eye with the
        // pin P or Q small and concentric inside it; the eye stands a margin
        // of half the pin's radius round the pin (it was smaller than the pin).
        plateDisc(forkPoint, forkPinRadius * 1.5),
      ],
      role: `${sideName}-half-fork-to-pin-${side > 0 ? 'P' : 'Q'}`,
      z0: forkBarZ0 - palletPlaneZ,
      z1: forkBarZ1 - palletPlaneZ,
    });
    const forkPinFrontZ = pendulumPlaneZ + 0.12;
    // The pin's back end stops a hair inside the fork bar's rear face, so
    // the two faces are not coplanar.
    const forkPinBackZ = forkBarZ0 + 0.004;
    const forkPin = cylinderAlongZ(
      forkPinRadius,
      forkPinFrontZ - forkPinBackZ,
      darkMaterial,
      24,
    );
    forkPin.position.set(forkPoint.x, forkPoint.y,
      (forkPinFrontZ + forkPinBackZ) / 2 - palletPlaneZ);
    forkPin.userData.label = side > 0 ? 'P' : 'Q';
    forkPin.userData.role = `${sideName}-fork-pin-${side > 0 ? 'P' : 'Q'}`;
    group.add(forkPin);

    const weight = new THREE.Mesh(
      new THREE.SphereGeometry(weightRadius, 40, 24),
      weightMaterial,
    );
    weight.position.set(weightPoint.x, weightPoint.y, 0);
    weight.userData.mass = palletWeightMass;
    weight.userData.role = `${sideName}-gravity-impulse-weight`;
    group.add(weight);

    // Arbor C joins the arm plate and the half-fork.
    const arborRearZ = -armPlaneHalfDepth - 0.02;
    const arborFrontZ = forkBarZ1 + 0.02;
    const arborHub = cylinderAlongZ(0.075, arborFrontZ - arborRearZ,
      darkMaterial, 24);
    arborHub.position.z = (arborFrontZ + arborRearZ) / 2 - palletPlaneZ;
    arborHub.userData.role = `${sideName}-independent-arbor-C`;
    group.add(arborHub);

    return {
      arborHub,
      arm,
      faceBacking: arm,
      forkPin,
      forkRod,
      group,
      liftFace: arm,
      liftFacePoints,
      lockFacePoints,
      lockingNib: arm,
      weight,
      weightStem: arm,
    };
  };

  const leftPallet = makeGravityPallet(-1);
  const rightPallet = makeGravityPallet(1);
  // Brown's small circle above the two arbors C: the fixed suspension stud
  // of the (undrawn) pendulum, seen end-on. It is a short stud spanning
  // exactly the depth of the two arbor hubs beside it, so it reads as a
  // third pivot end, not a long bar laid across the eyes.
  const suspensionPinRearZ = palletPlaneZ
    + leftPallet.arborHub.position.z
    - leftPallet.arborHub.geometry.parameters.height / 2;
  const suspensionPinFrontZ = palletPlaneZ
    + leftPallet.arborHub.position.z
    + leftPallet.arborHub.geometry.parameters.height / 2;
  const suspensionPin = cylinderAlongZ(0.07,
    suspensionPinFrontZ - suspensionPinRearZ, darkMaterial, 24);
  suspensionPin.position.set(pendulumPivot.x, pendulumPivot.y,
    (suspensionPinFrontZ + suspensionPinRearZ) / 2);
  suspensionPin.userData.role = 'fixed-pendulum-suspension-stud-end';
  root.add(suspensionPin);

  const pendulumAssembly = new THREE.Group();
  pendulumAssembly.position.set(
    pendulumPivot.x,
    pendulumPivot.y,
    pendulumPlaneZ,
  );
  pendulumAssembly.userData.axis = Z_AXIS.clone();
  pendulumAssembly.userData.role = 'free-pendulum-between-fork-pins-P-Q';
  root.add(pendulumAssembly);
  const pendulumRod = beamBetween(
    new THREE.Vector3(0, -0.17, 0),
    new THREE.Vector3(0, -7.92, 0),
    pendulumRodRadius * 2,
    0.17,
    pendulumMaterial,
  );
  pendulumRod.userData.role = 'pendulum-rod-between-P-and-Q';
  pendulumAssembly.add(pendulumRod);
  const pendulumPivotEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.060, 10, 36),
    pendulumMaterial,
  );
  pendulumPivotEye.position.z = 0.03;
  pendulumPivotEye.userData.role = 'pendulum-suspension-eye';
  pendulumAssembly.add(pendulumPivotEye);
  const pendulumBob = cylinderAlongZ(0.53, 0.24, pendulumMaterial, 48);
  pendulumBob.position.set(0, -7.52, 0);
  pendulumBob.scale.y = 1.20;
  pendulumBob.userData.role = 'pendulum-bob';
  pendulumAssembly.add(pendulumBob);
  const forkContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.070, 16, 12),
    markerMaterial,
  );
  forkContactMarker.userData.role = 'live-pendulum-to-P-or-Q-contact';
  root.add(forkContactMarker);
  const wheelLiftMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.073, 16, 12),
    markerMaterial,
  );
  wheelLiftMarker.userData.role =
    'live-wheel-to-opposite-pallet-cocking-contact';
  root.add(wheelLiftMarker);
  const lockMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.066, 16, 12),
    darkMaterial,
  );
  lockMarker.userData.role = 'live-tooth-against-terminal-nib';
  root.add(lockMarker);
  // Contact loci sit inside the working parts; they stay positioned for
  // diagnostics but never render.
  for (const marker of [forkContactMarker, wheelLiftMarker, lockMarker]) {
    marker.visible = false;
    marker.userData.diagnosticOnly = true;
  }

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.wheelAngle;
    leftPallet.group.rotation.z = state.leftPalletAngle;
    rightPallet.group.rotation.z = state.rightPalletAngle;
    pendulumAssembly.rotation.z = state.pendulumAngle;

    forkContactMarker.position.set(
      state.forkContactPoint.x,
      state.forkContactPoint.y,
      pendulumPlaneZ + 0.12,
    );
    forkContactMarker.userData.contactError = state.forkContactError;
    forkContactMarker.userData.active = true;
    forkContactMarker.userData.contactSide = state.forkContactSide;
    forkContactMarker.userData.gravityImpulseActive =
      state.effectiveGravityImpulseActive;

    wheelLiftMarker.userData.active = state.wheelStepActive;
    if (state.activeLiftPoint) {
      wheelLiftMarker.position.set(
        state.activeLiftPoint.x,
        state.activeLiftPoint.y,
        0,
      );
    }
    wheelLiftMarker.userData.contactError = state.liftContactError;
    wheelLiftMarker.userData.contactSide = state.activeLiftSide;
    wheelLiftMarker.userData.toothIndex = state.activeLiftToothIndex;

    lockMarker.userData.active = state.wheelLocked;
    if (state.activeLockPoint) {
      lockMarker.position.set(
        state.activeLockPoint.x,
        state.activeLockPoint.y,
        0,
      );
    }
    lockMarker.userData.contactError = state.lockContactError;
    lockMarker.userData.contactSide = state.activeLockSide;
    lockMarker.userData.toothIndex = state.activeLockToothIndex;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    escapeWheel,
    fixedFrame,
    forkContactMarker,
    frameBearings,
    frameUprights,
    leftPallet,
    lockMarker,
    lowerCrossbar,
    palletBearingBrackets,
    pendulumAssembly,
    pendulumBob,
    pendulumPivotEye,
    pendulumRod,
    rightPallet,
    spokeMeshes,
    suspensionCock,
    suspensionCockArm,
    topCrossbar,
    wheelBearingBracket,
    wheelHub,
    wheelLiftMarker,
    wheelPhaseWitness,
    wheelRotor,
    wheelShaft,
    wheelTeeth,
  };
  root.userData.sweptPlates = plateRegistry.plates;
  root.userData.sweptPlateInputHash = plateRegistry.bakeInputHash;
  root.userData.engagementContacts = (state) => ({
    advanceSign: -1,
    contacts: {
      lock: state.wheelLocked ? {
        point: state.activeLockPoint,
        z: [-wheelDepth / 2, wheelDepth / 2],
      } : null,
      lift: state.wheelStepActive ? {
        point: state.activeLiftPoint,
        z: [-wheelDepth / 2, wheelDepth / 2],
      } : null,
    },
  });
  // Brown's front elevation ends just below fork pins Q and P; the pendulum
  // bob hangs below that crop. A narrow lens keeps the view near-orthographic.
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraFov = 12;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.75, -2.55, -0.82),
    new THREE.Vector3(2.75, 4.55, 1.18),
  );
  root.userData.fidelity = 'authored';
  root.userData.fixedLockPointForSide = fixedLockPointForSide;
  root.userData.forkCenterAt = forkCenterAt;
  root.userData.forkMagnitudeAt = forkMagnitudeAt;
  root.userData.geometry = {
    cockedMagnitude,
    fallenMagnitude,
    firstWheelStepEndPhase,
    forkContactClearance,
    forkLocalX,
    forkLocalY,
    forkPinRadius,
    forkWorldX,
    forkWorldY,
    leftEffectiveImpulseStartPhase,
    leftLockAngle,
    leftPickupPhase,
    leftUnlockPhase,
    lockStationSeparationTeeth,
    mappedForkPinP,
    mappedForkPinQ,
    mappedLeftArbor,
    mappedLeftPallet,
    mappedLeftWeight,
    mappedRightArbor,
    mappedRightPallet,
    mappedRightWeight,
    maximumLiftMagnitude,
    netGravityPotentialDrop,
    palletDepth,
    palletPivotX,
    palletPivotY,
    palletPlaneZ,
    palletWeightMass,
    pendulumAmplitude,
    pendulumPeriod,
    pendulumPivot: pendulumPivot.clone(),
    pendulumRodRadius,
    pickupAngle,
    releaseMagnitude,
    rightEffectiveImpulseStartPhase,
    rightLockAngle,
    rightPickupPhase,
    rightUnlockPhase,
    secondWheelStepEndPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourcePalletWorldX,
    sourcePalletWorldY,
    sourceScale,
    standardGravity,
    toothCount,
    toothPitch,
    toothTipRadius,
    unlockAngle,
    weightLocalX,
    weightLocalY,
    wheelAdvancePerBeat,
    wheelAdvancePerCycle,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelRootRadius,
  };
  root.userData.gravityPotentialAt = gravityPotentialAt;
  root.userData.liftFaceLocalPointAt = liftFaceLocalPointAt;
  root.userData.lockFaceLocalPointAt = lockFaceLocalPointAt;
  root.userData.mechanism = 'Mudge’s gravity escapement: two independent weighted pallets A/P and B/Q turn on separate adjacent arbors C. The pendulum alternately lifts one fork-pin just enough to free its locking nib; the clockwise thirty-tooth wheel advances half a pitch and raises the opposite pallet along its acting face; on the return swing that stored pallet falls past its pickup position and gives a weight-controlled impulse directly to the pendulum.';
  root.userData.palletWorldPoint = palletWorldPoint;
  root.userData.presentation = 'front elevation of Brown’s paired-arbor escapement: the wheel and two flat pallet plates in its plane, each with its lifting face and locking stop, ball weights, and the long half-forks P/Q in front, between which the (undrawn) pendulum plays';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 309 page marks Animated unavailable and supplies Brown’s static elevation and description.',
    referenceScope: 'Brown fixes the two separate pallet arbors C, opposed weighted arms A/B, and long fork-pins P/Q. Beckett fixes the tooth-lifting acting faces, terminal nib locks, clockwise B-to-A wheel direction, alternating one-tooth sequence, gravity fall past the pickup point, and the preferred no-gap handoff between pallets.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    beckettConstructionReference: {
      author: 'Edmund Beckett, Lord Grimthorpe',
      figure: 21,
      operatingEvidence: 'The acting faces lift alternate independent pallets until a tooth reaches nib a or b. The pendulum then lifts that pallet by P or Q to unlock; the wheel immediately cocks the opposite pallet, whose weight later falls beyond its pickup position to supply a constant impulse.',
      page: 76,
      publication: 'A Rudimentary Treatise on Clocks, Watches and Bells for Public Purposes',
      publicationEdition: 8,
      publicationYear: 1903,
      theoryEvidence: 'With beta equal to gamma, one pallet is taken up just as the other is left, giving equal net impulse arcs on the two sides while one pallet or the other remains continuously in contact.',
      url: 'https://www.survivorlibrary.com/library/a_rudimentary_treatise_on_clocks_watches_and_bells_for_public_purposes_1903.pdf',
    },
    britannicaReference: {
      edition: 11,
      figure: 17,
      operatingEvidence: 'A wheel tooth rests against the stop at one pallet; the pendulum lifts its half-fork to unlock, after which the opposite tooth raises and catches the other pallet. Each pallet descends to a lower point than pickup.',
      page: 544,
      publication: 'Encyclopaedia Britannica, Volume 6',
      publicationYear: 1911,
      url: 'https://en.wikisource.org/wiki/Page:EB1911_-_Volume_06.djvu/562',
    },
    museumContext: {
      collection: 'British Museum',
      historicalEvidence: 'The early gravity-escapement principle uses weighted arms falling through repeatable distances so successive impulses are equal and substantially isolated from variations in the clock train.',
      object: 'William Nicholson table regulator, London, 1797',
      url: 'https://www.britishmuseum.org/collection/object/H_1958-1006-1925',
    },
    officialDescription: movement.description,
    plate309: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one thirty-tooth wheel between two mirror-symmetric weighted pallets on separate adjacent arbors; each pallet shares its arbor with one long half-fork terminating at P or Q',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterForkPinP: sourceRasterForkPinP.clone(),
      rasterForkPinQ: sourceRasterForkPinQ.clone(),
      rasterLeftArbor: sourceRasterLeftArbor.clone(),
      rasterLeftPalletB: sourceRasterLeftPalletB.clone(),
      rasterLeftWeight: sourceRasterLeftWeight.clone(),
      rasterRightArbor: sourceRasterRightArbor.clone(),
      rasterRightPalletA: sourceRasterRightPalletA.clone(),
      rasterRightWeight: sourceRasterRightWeight.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelTop: sourceRasterWheelTop.clone(),
      symmetryReconstruction: 'paired left/right engraving landmarks are averaged before construction so line-width and hand-drawn offsets do not create unequal pallet geometry',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'right-weighted-pallet-falls-with-pendulum',
      'left-fork-Q-lifts-and-unlocks-pallet-B',
      'wheel-cocks-right-weighted-pallet-A',
      'left-pallet-carried-to-outer-turn',
      'left-weighted-pallet-falls-with-pendulum',
      'right-fork-P-lifts-and-unlocks-pallet-A',
      'wheel-cocks-left-weighted-pallet-B',
      'right-pallet-carried-to-outer-turn',
    ],
  };
  root.userData.toothTipAt = toothTipAt;
  root.userData.transmission = {
    direction: 'clockwise from B toward A in the reconstructed front elevation',
    effectiveImpulseArc: 'each weighted pallet supplies its net gravity impulse from 2.5 degrees before center to 2.5 degrees after center',
    equalImpulseEnergyPerSide: netGravityPotentialDrop,
    gravityIsolation: 'the train raises the opposite pallet while the released pallet supplies the pendulum impulse from its own fixed weight and fall; train pressure enters only during unlocking',
    impulsesPerPendulumCycle: 2,
    impulsesPerVibration: [1, 1],
    locking: 'alternate tooth tips rest without wheel motion against the short terminal nib a or b until P or Q lifts that pallet clear',
    palletHandoff: 'beta equals gamma: the pendulum takes up one fork-pin at the same angle that it leaves the other, so one pallet is always in contact',
    stepsPerPendulumCycle: 2,
    toothCount,
    wheelAdvancePerBeatRadians: wheelAdvancePerBeat,
    wheelAdvancePerCycleRadians: wheelAdvancePerCycle,
    wheelCyclesPerRevolution: toothCount,
  };
  root.userData.weightCenterAt = weightCenterAt;
  root.userData.wheelAngleAtCycleStart = wheelAngleAtCycleStart;

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
  for (const object of [
    forkContactMarker,
    lockMarker,
    wheelLiftMarker,
    wheelPhaseWitness,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(0.6, 0.35, 14.8),
    root,
    update,
  };
}

function singleThreeLeggedGravityEscapement(movement) {
  const root = new THREE.Group();

  // Brown's engraving is a front elevation. Its left/right errors are small
  // enough to expose the intended symmetry, but large enough that directly
  // tracing them would make the two gravity impulses unequal. Preserve the
  // measured scale and average paired landmarks before building the model.
  const sourceImageWidth = 263;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(133, 301);
  const sourceRasterLeftPalletArbor = new THREE.Vector2(112, 65);
  const sourceRasterRightPalletArbor = new THREE.Vector2(142, 65);
  const sourceRasterPendulumSuspension = new THREE.Vector2(133, 32);
  const sourceRasterLeftLiftFaceB = new THREE.Vector2(99, 286);
  const sourceRasterRightLiftFaceA = new THREE.Vector2(154, 319);
  const sourceRasterLeftStopD = new THREE.Vector2(50, 321);
  const sourceRasterRightStopE = new THREE.Vector2(215, 302);
  const sourceRasterLeftBeatPin = new THREE.Vector2(109, 479);
  const sourceRasterRightBeatPin = new THREE.Vector2(164, 470);
  const sourceRasterLiftingPins = [
    new THREE.Vector2(122, 294),
    new THREE.Vector2(134, 285),
    new THREE.Vector2(144, 298),
  ];

  const wheelCenter = new THREE.Vector2(0, 0.15);
  const lockingLegRadius = 1.80;
  const measuredLeftStopRadius = sourceRasterWheelCenter.distanceTo(
    sourceRasterLeftStopD,
  );
  const measuredRightStopRadius = sourceRasterWheelCenter.distanceTo(
    sourceRasterRightStopE,
  );
  const meanSourceLockingRadius = (
    measuredLeftStopRadius + measuredRightStopRadius
  ) / 2;
  const sourceScale = lockingLegRadius / meanSourceLockingRadius;
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    wheelCenter.x + (x - sourceRasterWheelCenter.x) * sourceScale,
    wheelCenter.y + (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const mappedLeftPalletArbor = sourcePointToModel(
    sourceRasterLeftPalletArbor,
  );
  const mappedRightPalletArbor = sourcePointToModel(
    sourceRasterRightPalletArbor,
  );
  const mappedPendulumSuspension = sourcePointToModel(
    sourceRasterPendulumSuspension,
  );
  const mappedLeftLiftFaceB = sourcePointToModel(
    sourceRasterLeftLiftFaceB,
  );
  const mappedRightLiftFaceA = sourcePointToModel(
    sourceRasterRightLiftFaceA,
  );
  const mappedLeftStopD = sourcePointToModel(sourceRasterLeftStopD);
  const mappedRightStopE = sourcePointToModel(sourceRasterRightStopE);
  const mappedLeftBeatPin = sourcePointToModel(sourceRasterLeftBeatPin);
  const mappedRightBeatPin = sourcePointToModel(sourceRasterRightBeatPin);
  const mappedLiftingPins = sourceRasterLiftingPins.map(sourcePointToModel);

  const palletPivotX = (
    Math.abs(mappedLeftPalletArbor.x)
      + Math.abs(mappedRightPalletArbor.x)
  ) / 2;
  const palletPivotY = (
    mappedLeftPalletArbor.y + mappedRightPalletArbor.y
  ) / 2;
  const palletPivot = (side) => new THREE.Vector2(
    side * palletPivotX,
    palletPivotY,
  );
  const beatPinWorldX = (
    Math.abs(mappedLeftBeatPin.x) + Math.abs(mappedRightBeatPin.x)
  ) / 2;
  const beatPinWorldY = (
    mappedLeftBeatPin.y + mappedRightBeatPin.y
  ) / 2;
  const beatPinLocalX = beatPinWorldX - palletPivotX;
  const beatPinLocalY = beatPinWorldY - palletPivotY;
  const beatPinLocalPoint = (side) => new THREE.Vector2(
    side * beatPinLocalX,
    beatPinLocalY,
  );
  const pendulumPivot = new THREE.Vector2(
    0,
    mappedPendulumSuspension.y,
  );

  const pendulumPeriod = 4;
  const pendulumAmplitude = THREE.MathUtils.degToRad(3);
  const pickupAngle = THREE.MathUtils.degToRad(1.2);
  // Brown gives no unlocking arc. 1.8 degrees leaves a visible radial stop
  // engagement after the swept running clearance.
  const unlockAngle = THREE.MathUtils.degToRad(1.8);
  const pendulumRodRadius = 0.070;
  const beatPinRadius = 0.105;
  const beatPinEyeRadius = 1.5 * beatPinRadius;
  // Brown closes the two legs on a collar clamped to the pendulum rod just
  // above its lower screw; the beat pins bear on the collar's flat flanks.
  const beatCollarHalfWidth = 0.17;
  const beatContactClearance = beatCollarHalfWidth + beatPinRadius;
  const palletPlaneOffset = 0.27;
  // Brown dashes the rod: it hangs behind the whole escapement. The escape
  // arbor runs back to its bearing on the frame at the wheel centre, where
  // the rod passes, so the rod's plane lies just behind that bearing and the
  // pivot block; the beat pins reach back to it below the wheel and fly.
  const pendulumPlaneZ = -1.0;
  const lockingWheelDepth = 0.26;
  const lockingLegPitch = FULL_TURN / 3;
  const leftLockAngle = 5 * Math.PI / 6;
  const rightLockAngle = Math.PI / 6;
  const wheelAdvancePerBeat = lockingLegPitch;
  const wheelAdvancePerCycle = lockingLegPitch * 2;
  const liftingPinPhaseOffset = 2 * Math.PI / 3;
  const meanSourceLiftingPinRadius = mappedLiftingPins.reduce(
    (sum, point) => sum + point.distanceTo(wheelCenter),
    0,
  ) / mappedLiftingPins.length;
  const liftingPinRadius = meanSourceLiftingPinRadius;

  const pendulumMotionAtPhase = (cyclePhase) => {
    const argument = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / pendulumPeriod;
    return {
      acceleration: -pendulumAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angle: pendulumAmplitude * Math.cos(argument),
      speed: -pendulumAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };
  const beatPinCenterAt = (side, magnitude) => palletPivot(side).add(
    rotate2(beatPinLocalPoint(side), side * magnitude),
  );
  const signedBeatClearance = (outwardPendulumAngle, magnitude) => {
    const beatPinCenter = beatPinCenterAt(1, magnitude);
    const pendulumNormal = new THREE.Vector2(
      Math.cos(outwardPendulumAngle),
      Math.sin(outwardPendulumAngle),
    );
    return pendulumNormal.dot(
      beatPinCenter.clone().sub(pendulumPivot),
    );
  };
  const palletMagnitudeAt = (outwardPendulumAngle) => {
    let lower = THREE.MathUtils.degToRad(-15);
    let upper = THREE.MathUtils.degToRad(10);
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (signedBeatClearance(outwardPendulumAngle, middle)
          > beatContactClearance) {
        upper = middle;
      } else {
        lower = middle;
      }
    }
    return (lower + upper) / 2;
  };
  const cockedMagnitude = palletMagnitudeAt(pickupAngle);
  const releaseMagnitude = palletMagnitudeAt(unlockAngle);
  const fallenMagnitude = palletMagnitudeAt(-pickupAngle);
  const maximumLiftMagnitude = palletMagnitudeAt(pendulumAmplitude);

  const rightEffectiveImpulseStartPhase = Math.acos(
    pickupAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const leftPickupPhase = Math.acos(
    -pickupAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const leftUnlockPhase = Math.acos(
    -unlockAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const firstWheelStepEndPhase = 0.42;
  const leftEffectiveImpulseStartPhase = 0.5
    + rightEffectiveImpulseStartPhase;
  const rightPickupPhase = 1 - rightEffectiveImpulseStartPhase;
  const rightUnlockPhase = 1 - Math.acos(
    unlockAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const secondWheelStepEndPhase = 0.92;
  const phaseBoundaryEpsilon = 1e-12;

  const palletLocalPoint = (side, worldPoint, magnitude) => rotate2(
    worldPoint.clone().sub(palletPivot(side)),
    -side * magnitude,
  );
  const palletWorldPoint = (side, localPoint, magnitude) => palletPivot(side)
    .add(rotate2(localPoint, side * magnitude));
  const lockAngleForSide = (side) => (
    side > 0 ? rightLockAngle : leftLockAngle
  );
  const fixedLockPointForSide = (side) => {
    const angle = lockAngleForSide(side);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * lockingLegRadius,
      Math.sin(angle) * lockingLegRadius,
    ));
  };
  const lockingLegTipAt = (wheelAngle, legIndex) => {
    const angle = wheelAngle + legIndex * lockingLegPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * lockingLegRadius,
      Math.sin(angle) * lockingLegRadius,
    ));
  };
  const liftingPinAt = (wheelAngle, pinIndex) => {
    const angle = wheelAngle
      + pinIndex * lockingLegPitch
      + liftingPinPhaseOffset;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * liftingPinRadius,
      Math.sin(angle) * liftingPinRadius,
    ));
  };
  const liftFaceLocalPointAt = (side, progress) => {
    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const pinStartAngle = side > 0 ? -Math.PI / 2 : Math.PI / 6;
    const pinAngle = pinStartAngle
      + wheelAdvancePerBeat * clampedProgress;
    const pinPoint = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(pinAngle) * liftingPinRadius,
      Math.sin(pinAngle) * liftingPinRadius,
    ));
    const magnitude = THREE.MathUtils.lerp(
      fallenMagnitude,
      cockedMagnitude,
      clampedProgress,
    );
    return palletLocalPoint(side, pinPoint, magnitude);
  };
  const lockFaceLocalPointAt = (side, magnitude) => palletLocalPoint(
    side,
    fixedLockPointForSide(side),
    magnitude,
  );

  // The arms themselves are the weights. A mirror-symmetric effective centre
  // of mass lets the state expose the fixed gravitational impulse explicitly.
  const effectiveCenterOfMassLocal = (side) => new THREE.Vector2(
    side * 1.08,
    -4.10,
  );
  const weightedArmMass = 0.85;
  const standardGravity = 9.80665;
  const effectiveCenterOfMassAt = (side, magnitude) => palletWorldPoint(
    side,
    effectiveCenterOfMassLocal(side),
    magnitude,
  );
  const gravityPotentialAt = (side, magnitude) => weightedArmMass
    * standardGravity * effectiveCenterOfMassAt(side, magnitude).y;
  const netGravityPotentialDrop = gravityPotentialAt(1, cockedMagnitude)
    - gravityPotentialAt(1, fallenMagnitude);

  const wheelAngleAtCycleStart = (cycleIndex) => leftLockAngle
    + cycleIndex * wheelAdvancePerCycle;
  const rawStateAtTime = (time) => {
    const cycleCoordinate = time / pendulumPeriod;
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const pendulum = pendulumMotionAtPhase(cyclePhase);
    const startingLeftLegIndex = positiveModulo(cycleIndex, 3);
    const rightLandingLegIndex = positiveModulo(cycleIndex + 1, 3);
    const landingLeftLegIndex = positiveModulo(cycleIndex + 1, 3);
    let activeLiftPinIndex = null;
    let activeLiftSide = null;
    let activeLockLegIndex = null;
    let activeLockSide = null;
    let effectiveGravityImpulseActive = false;
    let beatContactSide = null;
    let gravityDescentSide = null;
    let leftMagnitude = cockedMagnitude;
    let liftProgress = null;
    let mode = 'right-gravity-arm-recovery';
    let pendulumRaisedPalletSide = null;
    let rightMagnitude = cockedMagnitude;
    let trainCoupledToPendulum = false;
    let wheelAdvance = 0;

    if (cyclePhase < leftPickupPhase - phaseBoundaryEpsilon) {
      rightMagnitude = palletMagnitudeAt(pendulum.angle);
      activeLockSide = 'left';
      activeLockLegIndex = startingLeftLegIndex;
      beatContactSide = 'right';
      gravityDescentSide = 'right';
      if (cyclePhase >= rightEffectiveImpulseStartPhase) {
        effectiveGravityImpulseActive = true;
        mode = 'right-weighted-arm-gravity-impulse';
      }
    } else if (cyclePhase < leftUnlockPhase - phaseBoundaryEpsilon) {
      leftMagnitude = palletMagnitudeAt(-pendulum.angle);
      rightMagnitude = fallenMagnitude;
      activeLockSide = 'left';
      activeLockLegIndex = startingLeftLegIndex;
      beatContactSide = 'left';
      mode = 'pendulum-lifts-left-arm-and-releases-stop-D';
      pendulumRaisedPalletSide = 'left';
      trainCoupledToPendulum = true;
    } else if (cyclePhase <= firstWheelStepEndPhase
      + phaseBoundaryEpsilon) {
      const linearProgress = (
        cyclePhase - leftUnlockPhase
      ) / (firstWheelStepEndPhase - leftUnlockPhase);
      liftProgress = smootherStep(linearProgress);
      leftMagnitude = palletMagnitudeAt(-pendulum.angle);
      rightMagnitude = THREE.MathUtils.lerp(
        fallenMagnitude,
        cockedMagnitude,
        liftProgress,
      );
      activeLiftSide = 'right';
      activeLiftPinIndex = startingLeftLegIndex;
      beatContactSide = 'left';
      mode = 'central-pin-cocks-right-pallet-A';
      pendulumRaisedPalletSide = 'left';
      wheelAdvance = wheelAdvancePerBeat * liftProgress;
    } else if (cyclePhase < 0.5 - phaseBoundaryEpsilon) {
      leftMagnitude = palletMagnitudeAt(-pendulum.angle);
      rightMagnitude = cockedMagnitude;
      activeLockSide = 'right';
      activeLockLegIndex = rightLandingLegIndex;
      beatContactSide = 'left';
      mode = 'right-stop-E-holds-wheel';
      pendulumRaisedPalletSide = 'left';
      wheelAdvance = wheelAdvancePerBeat;
    } else if (cyclePhase < rightPickupPhase - phaseBoundaryEpsilon) {
      leftMagnitude = palletMagnitudeAt(-pendulum.angle);
      rightMagnitude = cockedMagnitude;
      activeLockSide = 'right';
      activeLockLegIndex = rightLandingLegIndex;
      beatContactSide = 'left';
      gravityDescentSide = 'left';
      mode = 'left-gravity-arm-recovery';
      wheelAdvance = wheelAdvancePerBeat;
      if (cyclePhase >= leftEffectiveImpulseStartPhase) {
        effectiveGravityImpulseActive = true;
        mode = 'left-weighted-arm-gravity-impulse';
      }
    } else if (cyclePhase < rightUnlockPhase - phaseBoundaryEpsilon) {
      leftMagnitude = fallenMagnitude;
      rightMagnitude = palletMagnitudeAt(pendulum.angle);
      activeLockSide = 'right';
      activeLockLegIndex = rightLandingLegIndex;
      beatContactSide = 'right';
      mode = 'pendulum-lifts-right-arm-and-releases-stop-E';
      pendulumRaisedPalletSide = 'right';
      trainCoupledToPendulum = true;
      wheelAdvance = wheelAdvancePerBeat;
    } else if (cyclePhase <= secondWheelStepEndPhase
      + phaseBoundaryEpsilon) {
      const linearProgress = (
        cyclePhase - rightUnlockPhase
      ) / (secondWheelStepEndPhase - rightUnlockPhase);
      liftProgress = smootherStep(linearProgress);
      leftMagnitude = THREE.MathUtils.lerp(
        fallenMagnitude,
        cockedMagnitude,
        liftProgress,
      );
      rightMagnitude = palletMagnitudeAt(pendulum.angle);
      activeLiftSide = 'left';
      activeLiftPinIndex = startingLeftLegIndex;
      beatContactSide = 'right';
      mode = 'central-pin-cocks-left-pallet-B';
      pendulumRaisedPalletSide = 'right';
      wheelAdvance = wheelAdvancePerBeat * (1 + liftProgress);
    } else {
      leftMagnitude = cockedMagnitude;
      rightMagnitude = palletMagnitudeAt(pendulum.angle);
      activeLockSide = 'left';
      activeLockLegIndex = landingLeftLegIndex;
      beatContactSide = 'right';
      mode = 'left-stop-D-holds-wheel';
      pendulumRaisedPalletSide = 'right';
      wheelAdvance = wheelAdvancePerCycle;
    }

    const wheelAngle = wheelAngleAtCycleStart(cycleIndex) + wheelAdvance;
    const flyPhaseOffset = Math.PI / 6;
    const flyAngle = wheelAngle + flyPhaseOffset;
    const leftPalletAngle = -leftMagnitude;
    const rightPalletAngle = rightMagnitude;
    const beatSideSign = beatContactSide === 'right' ? 1 : -1;
    const beatMagnitude = beatContactSide === 'right'
      ? rightMagnitude
      : leftMagnitude;
    const activeBeatPinCenter = beatPinCenterAt(
      beatSideSign,
      beatMagnitude,
    );
    const pendulumDirection = new THREE.Vector2(
      Math.sin(pendulum.angle),
      -Math.cos(pendulum.angle),
    );
    const pendulumNormal = new THREE.Vector2(
      Math.cos(pendulum.angle),
      Math.sin(pendulum.angle),
    );
    const beatProjection = activeBeatPinCenter.clone().sub(pendulumPivot)
      .dot(pendulumDirection);
    const pendulumRodCenterPoint = pendulumPivot.clone().add(
      pendulumDirection.clone().multiplyScalar(beatProjection),
    );
    const pendulumSurfacePoint = pendulumRodCenterPoint.clone().add(
      pendulumNormal.clone().multiplyScalar(
        beatSideSign * beatCollarHalfWidth,
      ),
    );
    const beatPinSurfacePoint = activeBeatPinCenter.clone().add(
      pendulumNormal.clone().multiplyScalar(
        -beatSideSign * beatPinRadius,
      ),
    );
    const beatContactPoint = pendulumSurfacePoint.clone().add(
      beatPinSurfacePoint,
    ).multiplyScalar(0.5);

    const activeLiftPoint = activeLiftPinIndex === null
      ? null
      : liftingPinAt(wheelAngle, activeLiftPinIndex);
    const liftSideSign = activeLiftSide === 'right' ? 1 : -1;
    const liftMagnitude = activeLiftSide === 'right'
      ? rightMagnitude
      : leftMagnitude;
    const activeLiftFaceLocalPoint = activeLiftSide === null
      ? null
      : liftFaceLocalPointAt(liftSideSign, liftProgress);
    const activeLiftFacePoint = activeLiftSide === null
      ? null
      : palletWorldPoint(
        liftSideSign,
        activeLiftFaceLocalPoint,
        liftMagnitude,
      );
    const lockSideSign = activeLockSide === 'right' ? 1 : -1;
    const lockMagnitude = activeLockSide === 'right'
      ? rightMagnitude
      : leftMagnitude;
    const activeLockPoint = activeLockLegIndex === null
      ? null
      : lockingLegTipAt(wheelAngle, activeLockLegIndex);
    const activeLockFaceLocalPoint = activeLockSide === null
      ? null
      : lockFaceLocalPointAt(lockSideSign, lockMagnitude);
    const activeLockFacePoint = activeLockSide === null
      ? null
      : palletWorldPoint(
        lockSideSign,
        activeLockFaceLocalPoint,
        lockMagnitude,
      );

    return {
      activeBeatPinCenter,
      activeLiftFaceLocalPoint,
      activeLiftFacePoint,
      activeLiftPinIndex,
      activeLiftPoint,
      activeLiftSide,
      activeLockFaceLocalPoint,
      activeLockFacePoint,
      activeLockLegIndex,
      activeLockPoint,
      activeLockSide,
      beatContactError: Math.abs(
        activeBeatPinCenter.distanceTo(pendulumRodCenterPoint)
          - beatContactClearance
      ),
      beatContactPoint,
      beatContactSide,
      cycleIndex,
      cyclePhase,
      effectiveGravityImpulseActive,
      flyAngle,
      gravityDescentSide,
      gravityImpulseIsolatedFromTrain:
        effectiveGravityImpulseActive && !trainCoupledToPendulum,
      impulseDirection: effectiveGravityImpulseActive
        ? gravityDescentSide === 'right' ? 'leftward' : 'rightward'
        : null,
      landingLeftLegIndex,
      leftPalletAngle,
      leftPalletMagnitude: leftMagnitude,
      liftContactError: activeLiftPoint === null
        ? null
        : activeLiftPoint.distanceTo(activeLiftFacePoint),
      liftProgress,
      lockContactError: activeLockPoint === null
        ? null
        : activeLockPoint.distanceTo(activeLockFacePoint),
      mode,
      palletPotentialEnergy: {
        left: gravityPotentialAt(-1, leftMagnitude),
        right: gravityPotentialAt(1, rightMagnitude),
      },
      pendulumAngle: pendulum.angle,
      pendulumAngularAcceleration: pendulum.acceleration,
      pendulumAngularSpeed: pendulum.speed,
      pendulumRaisedPalletSide,
      rightLandingLegIndex,
      rightPalletAngle,
      rightPalletMagnitude: rightMagnitude,
      startingLeftLegIndex,
      trainCoupledToPendulum,
      trainRaisingPalletSide: activeLiftSide,
      wheelAdvance,
      wheelAngle,
      wheelLocked: activeLockSide !== null,
      wheelStepActive: activeLiftSide !== null,
    };
  };

  const derivativeStep = 1e-5;
  const stateAtTime = (time) => {
    const state = rawStateAtTime(time);
    const before = rawStateAtTime(time - derivativeStep);
    const after = rawStateAtTime(time + derivativeStep);
    const wheelAngularSpeed = (
      after.wheelAngle - before.wheelAngle
    ) / (2 * derivativeStep);
    return {
      ...state,
      flyAngularSpeed: wheelAngularSpeed,
      leftPalletAngularSpeed: (
        after.leftPalletAngle - before.leftPalletAngle
      ) / (2 * derivativeStep),
      rightPalletAngularSpeed: (
        after.rightPalletAngle - before.rightPalletAngle
      ) / (2 * derivativeStep),
      wheelAngularAcceleration: (
        after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle
      ) / derivativeStep ** 2,
      wheelAngularSpeed,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.42,
    roughness: 0.38,
  });
  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.45,
  });
  const palletMaterial = matte(PALETTE.driven, {
    metalness: 0.30,
    roughness: 0.48,
  });
  const pinMaterial = matte(PALETTE.brass, {
    metalness: 0.48,
    roughness: 0.34,
  });
  const pendulumMaterial = matte(PALETTE.accent, {
    metalness: 0.22,
    roughness: 0.52,
  });
  const markerMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.25,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-three-legged-escapement-frame';
  root.add(fixedFrame);
  const roundedRectShape = (cx, cy, halfWidth, halfHeight, radius) => {
    const shape = new THREE.Shape();
    const x0 = cx - halfWidth, x1 = cx + halfWidth;
    const y0 = cy - halfHeight, y1 = cy + halfHeight;
    shape.moveTo(x0 + radius, y0);
    shape.lineTo(x1 - radius, y0);
    shape.absarc(x1 - radius, y0 + radius, radius, -Math.PI / 2, 0, false);
    shape.lineTo(x1, y1 - radius);
    shape.absarc(x1 - radius, y1 - radius, radius, 0, Math.PI / 2, false);
    shape.lineTo(x0 + radius, y1);
    shape.absarc(x0 + radius, y1 - radius, radius, Math.PI / 2, Math.PI, false);
    shape.lineTo(x0, y0 + radius);
    shape.absarc(x0 + radius, y0 + radius, radius, Math.PI, 1.5 * Math.PI,
      false);
    return shape;
  };
  // Brown's hatched block under the suspension carries both leg arbors
  // (his dotted squares) and two screws; it is only as wide as his block
  // (about 64 px, 1.38 units), no longer a bar overhanging the frame.
  const pivotBlockTop = palletPivotY + 0.26;
  const pivotBlockBottom = palletPivotY - 0.20;
  // Each arbor's bearing ring is seated in a bore through the block.
  const pivotBlockShape = roundedRectShape(0,
    (pivotBlockTop + pivotBlockBottom) / 2,
    0.69, (pivotBlockTop - pivotBlockBottom) / 2, 0.04);
  for (const side of [-1, 1]) {
    const bore = new THREE.Path();
    bore.absarc(side * palletPivotX, palletPivotY, 0.15, 0, FULL_TURN, true);
    pivotBlockShape.holes.push(bore);
  }
  const topCrossbar = new THREE.Mesh(
    centeredExtrusion(pivotBlockShape, 0.18, 0.006),
    frameMaterial,
  );
  topCrossbar.position.z = -0.76;
  topCrossbar.userData.role = 'fixed-pivot-block-carrying-both-leg-arbors';
  fixedFrame.add(topCrossbar);
  const pivotBlockScrews = [-1, 1].map((side) => {
    const screw = cylinderAlongZ(0.075, 0.05, darkMaterial, 24);
    screw.position.set(side * 0.56, palletPivotY + 0.17, -0.76 + 0.09 + 0.018);
    screw.userData.role = `${side < 0 ? 'left' : 'right'}-pivot-block-screw-head`;
    fixedFrame.add(screw);
    return screw;
  });
  const plateRegistry = createSweptPlateRegistry(movement.id);
  const backFrameZ = -0.76;
  const wheelBearingBracket = beamBetween(
    new THREE.Vector3(-2.30, wheelCenter.y, backFrameZ),
    new THREE.Vector3(wheelCenter.x - 0.15, wheelCenter.y, backFrameZ),
    0.12,
    0.16,
    frameMaterial,
  );
  wheelBearingBracket.userData.role = 'single-wheel-bearing-bracket';
  fixedFrame.add(wheelBearingBracket);
  // Brown's suspension block stands on the pivot block. It is one solid
  // cock reaching back to just in front of the pendulum's eye, so the
  // suspension stud is only a short pin through the eye.
  const suspensionBlockFrontZ = -0.76 + 0.06;
  const suspensionBlockRearZ = pendulumPlaneZ + 0.08 + 0.03;
  const suspensionBlockBottom = pivotBlockTop - 0.02;
  const suspensionBlockTop = pendulumPivot.y + 0.30;
  const suspensionBracket = new THREE.Mesh(
    centeredExtrusion(roundedRectShape(0,
      (suspensionBlockTop + suspensionBlockBottom) / 2, 0.38,
      (suspensionBlockTop - suspensionBlockBottom) / 2, 0.05),
    suspensionBlockFrontZ - suspensionBlockRearZ, 0.006),
    frameMaterial,
  );
  suspensionBracket.position.z = (suspensionBlockFrontZ
    + suspensionBlockRearZ) / 2;
  suspensionBracket.userData.role = 'pendulum-suspension-block';
  fixedFrame.add(suspensionBracket);
  // Journals are bored rings on the back frame plane; the moving arbors run
  // back through them. The fixed suspension stud reaches the pendulum eye.
  const frameBearings = [
    [wheelCenter, 'single-escape-wheel-bearing', 0.19, 0.105],
    [palletPivot(-1), 'left-gravity-arm-bearing', 0.15, 0.083],
    [palletPivot(1), 'right-gravity-arm-bearing', 0.15, 0.083],
  ].map(([point, role, outerRadius, boreRadius]) => {
    const bearing = boredBearing(outerRadius, boreRadius, 0.16,
      darkMaterial);
    bearing.position.set(point.x, point.y, backFrameZ);
    bearing.userData.role = role;
    fixedFrame.add(bearing);
    return bearing;
  });
  const suspensionStudFrontZ = suspensionBlockRearZ + 0.04;
  const suspensionStudRearZ = pendulumPlaneZ - 0.08 - 0.04;
  const suspensionStud = cylinderAlongZ(0.13,
    suspensionStudFrontZ - suspensionStudRearZ, darkMaterial, 30);
  suspensionStud.position.set(pendulumPivot.x, pendulumPivot.y,
    (suspensionStudFrontZ + suspensionStudRearZ) / 2);
  suspensionStud.userData.role = 'pendulum-suspension-bearing';
  fixedFrame.add(suspensionStud);
  frameBearings.push(suspensionStud);

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'single-counterclockwise-three-legged-escape-wheel';
  root.add(escapeWheel);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'one-wheel-three-leg-locking-rotor';
  escapeWheel.add(wheelRotor);
  const lockingLegMeshes = [];
  const lockingLegTipMeshes = [];
  for (let legIndex = 0; legIndex < 3; legIndex += 1) {
    const angle = legIndex * lockingLegPitch;
    // One straight taper ending in the round locking tip (the old separate
    // hardened tip, r 0.08 about R - 0.025, is now the leg's own end).
    const legShape = taperedRoundTipLegShape(0.18, 0.12,
      lockingLegRadius - 0.025, 0.080);
    const leg = new THREE.Mesh(
      centeredExtrusion(legShape, lockingWheelDepth, 0.007),
      wheelMaterial,
    );
    leg.rotation.z = angle;
    leg.userData.index = legIndex;
    leg.userData.role = `locking-leg-${legIndex + 1}-of-3`;
    wheelRotor.add(leg);
    lockingLegMeshes.push(leg);
    lockingLegTipMeshes.push(leg);
  }
  // The hub stays inside the leg slab so both pallet planes pass clear.
  const wheelHub = cylinderAlongZ(0.255, lockingWheelDepth + 0.06,
    wheelMaterial, 36);
  wheelHub.userData.role = 'single-three-legged-wheel-hub';
  wheelRotor.add(wheelHub);
  const wheelShaftFrontZ = palletPlaneOffset - 0.09;
  const wheelShaftRearZ = backFrameZ - 0.12;
  const wheelShaft = cylinderAlongZ(0.095,
    wheelShaftFrontZ - wheelShaftRearZ, darkMaterial, 28);
  wheelShaft.position.z = (wheelShaftFrontZ + wheelShaftRearZ) / 2;
  wheelShaft.userData.role = 'single-escape-wheel-arbor';
  wheelRotor.add(wheelShaft);
  const liftingPinMeshes = [];
  for (let pinIndex = 0; pinIndex < 3; pinIndex += 1) {
    const angle = pinIndex * lockingLegPitch + liftingPinPhaseOffset;
    // Each pin spans the wheel and both lift pads, ending just past the
    // pads' outer faces.
    const pin = cylinderAlongZ(0.074, 2 * (palletPlaneOffset + 0.07 + 0.02),
      pinMaterial, 24);
    pin.position.set(
      Math.cos(angle) * liftingPinRadius,
      Math.sin(angle) * liftingPinRadius,
      0,
    );
    pin.userData.index = pinIndex;
    pin.userData.role = `shared-central-lifting-pin-${pinIndex + 1}-of-3`;
    wheelRotor.add(pin);
    liftingPinMeshes.push(pin);
  }
  const wheelPhaseWitness = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 12),
    markerMaterial,
  );
  wheelPhaseWitness.position.set(lockingLegRadius * 0.69, 0, 0.10);
  wheelPhaseWitness.userData.role = 'white-single-wheel-phase-witness';
  wheelRotor.add(wheelPhaseWitness);

  // Brown labels FLY on one long plain blade seen edge-on, running up from
  // the arbor to about raster y 196 (105 px, 2.26 units); as on 311 it is
  // one blade through the arbor, vertical at t = 0 as drawn.
  const flyRotor = new THREE.Group();
  flyRotor.position.z = -0.605;
  flyRotor.userData.axis = Z_AXIS.clone();
  flyRotor.userData.role = 'long-plain-fly-on-escape-arbor';
  escapeWheel.add(flyRotor);
  const flyRadius = 105 * sourceScale;
  const flyBladeThickness = 0.07;
  const flyBladeDepth = 0.13;
  const flyDrawnAngle = Math.PI / 2 - stateAtTime(0).flyAngle;
  const flyBar = new THREE.Mesh(
    new THREE.BoxGeometry(2 * flyRadius, flyBladeThickness, flyBladeDepth)
      .rotateZ(flyDrawnAngle),
    darkMaterial,
  );
  flyBar.userData.role = 'long-plain-fly-blade-edge-on';
  flyRotor.add(flyBar);
  const flyVanes = [];
  const flyPhaseWitness = new THREE.Object3D();
  flyPhaseWitness.position.set(flyRadius * Math.cos(flyDrawnAngle),
    flyRadius * Math.sin(flyDrawnAngle), 0);
  flyPhaseWitness.userData.role = 'fly-blade-tip-locus';
  flyRotor.add(flyPhaseWitness);

  const makeGravityArm = (side) => {
    const sideName = side > 0 ? 'right-A-E' : 'left-B-D';
    const group = new THREE.Group();
    const pivot = palletPivot(side);
    group.position.set(
      pivot.x,
      pivot.y,
      side * palletPlaneOffset,
    );
    group.userData.axis = Z_AXIS.clone();
    group.userData.side = side;
    group.userData.role = `${sideName}-independent-weighted-gravity-arm`;
    root.add(group);

    const referenceWorldPoints = [
      palletPivot(side),
      new THREE.Vector2(side * 0.68, palletPivotY - 1.65),
      new THREE.Vector2(side * 1.26, wheelCenter.y + 1.05),
      new THREE.Vector2(side * 1.56, wheelCenter.y + 0.26),
      new THREE.Vector2(side * 1.90, wheelCenter.y - 1.45),
      new THREE.Vector2(side * 1.63, wheelCenter.y - 2.55),
      new THREE.Vector2(side * beatPinWorldX, beatPinWorldY),
    ];
    // One flat arm plate in the pallet plane (bow, inward branch, tail, lift
    // pad and arc bar), and a stop block reaching into the leg slab. Both
    // are shaped by the swept wheel parts.
    const sideKey = side > 0 ? 'right' : 'left';
    const stopLetter = side > 0 ? 'E' : 'D';
    const armHalfDepth = 0.07;
    const hornReach = (133 - 67) * sourceScale - palletPivotX;
    const hornRise = 5 * sourceScale;
    const toLocal = (point) => palletLocalPoint(side, point,
      cockedMagnitude);
    const outerBowPoints = referenceWorldPoints.map(toLocal);
    const smoothBowPoints = new THREE.CatmullRomCurve3(
      outerBowPoints.map((point) => new THREE.Vector3(point.x, point.y, 0)),
      false,
      'centripetal',
    ).getSpacedPoints(36).map((point) => new THREE.Vector2(point.x, point.y));
    const liftFacePoints = Array.from({ length: 49 }, (_, index) => (
      liftFaceLocalPointAt(side, smootherStep(index / 48))
    ));
    // Raising the arm moves it along +side*perp(p) about its pivot, so the
    // lift face backs onto that side of the pin-centre locus.
    const padPath = liftFacePoints.filter((_, index) => index % 3 === 0);
    const padNormals = padPath.map((point, index) => {
      const next = padPath[Math.min(index + 1, padPath.length - 1)];
      const previous = padPath[Math.max(index - 1, 0)];
      const tangent = next.clone().sub(previous).normalize();
      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      const raise = new THREE.Vector2(-point.y, point.x).multiplyScalar(side);
      return normal.dot(raise) < 0 ? normal.negate() : normal;
    });
    const liftPad = platePolygon([
      ...padPath.map((point, index) => point.clone()
        .addScaledVector(padNormals[index], 0.22)),
      ...padPath.map((point, index) => point.clone()
        .addScaledVector(padNormals[index], -0.06)).reverse(),
    ]);
    const jawAnchorLocal = toLocal(new THREE.Vector2(side * 1.50,
      wheelCenter.y + 0.18));
    const jawEnd = liftFacePoints[Math.floor(liftFacePoints.length / 2)];
    const jawEndBack = jawEnd.clone().addScaledVector(
      padNormals[Math.floor(padNormals.length / 2)], 0.14);
    const jawPoints = [
      jawAnchorLocal,
      new THREE.Vector2(
        side * Math.max(Math.abs(jawEnd.x) + 0.40, 0.72),
        jawEnd.y + 0.30,
      ),
      jawEndBack,
    ];
    const tailPoints = [
      liftFacePoints[0].clone().addScaledVector(padNormals[0], 0.12),
      liftFacePoints[0].clone().add(
        new THREE.Vector2(side * 0.02, -0.48),
      ),
      liftFacePoints[0].clone().add(
        new THREE.Vector2(side * 0.13, -1.02),
      ),
    ];
    const lockFacePoints = Array.from({ length: 21 }, (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        cockedMagnitude,
        releaseMagnitude,
        index / 20,
      );
      return lockFaceLocalPointAt(side, magnitude);
    });
    const lockAngle = lockAngleForSide(side);
    const lockBackLocal = toLocal(wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(lockAngle + THREE.MathUtils.degToRad(5)),
      Math.sin(lockAngle + THREE.MathUtils.degToRad(5)),
    ).multiplyScalar(lockingLegRadius + 0.16)));
    const outerBow = plateRegistry.add({
      key: `${sideKey}-arm`,
      material: palletMaterial,
      owner: group,
      primitives: [
        ...plateStroke(smoothBowPoints, 0.20),
        ...plateStroke(jawPoints, 0.17),
        ...plateStroke(tailPoints, 0.15),
        liftPad,
        // Brown's horn: the leg's top runs out from its pivot as a flat
        // bar, rising slightly and tapering to a round end at raster x 67
        // (1.42 from the centre line).
        platePolygon([
          new THREE.Vector2(0, -0.095),
          new THREE.Vector2(side * hornReach, hornRise - 0.075),
          new THREE.Vector2(side * hornReach, hornRise + 0.075),
          new THREE.Vector2(0, 0.095),
        ]),
        plateDisc(new THREE.Vector2(side * hornReach, hornRise), 0.075),
        plateDisc(new THREE.Vector2(0, 0), 0.16),
        // Brown's bow ends in a round eye carrying the beat pin: the bow's
        // own width runs on from its end to an eye concentric with the pin
        // (1.5 x its radius), as 309's fork eyes.
        plateDisc(outerBowPoints.at(-1), 0.10),
        plateBand(outerBowPoints.at(-1), beatPinLocalPoint(side), 0.20),
        plateDisc(beatPinLocalPoint(side), beatPinEyeRadius),
        plateDisc(lockBackLocal, 0.15),
      ],
      role: `${sideName}-long-inverted-gravity-arm-bow-with-inner-lifting-face-${
        side > 0 ? 'A' : 'B'}`,
      z0: -armHalfDepth,
      z1: armHalfDepth,
    });
    const liftFace = outerBow;
    const innerJaw = outerBow;
    const innerTail = outerBow;
    const adjustmentBar = outerBow;

    const stopInnerZ = -side * palletPlaneOffset;
    const stopOuterZ = -side * armHalfDepth;
    const stopSector = plateSector(wheelCenter, lockingLegRadius - 0.15,
      lockingLegRadius + 0.26, lockAngle - THREE.MathUtils.degToRad(3),
      lockAngle + THREE.MathUtils.degToRad(10), 10);
    const lockFace = plateRegistry.add({
      key: `${sideKey}-stop-${stopLetter}`,
      material: palletMaterial,
      owner: group,
      primitives: [
        platePolygon(stopSector.points.map(([x, y]) => toLocal(
          new THREE.Vector2(x, y),
        ))),
        plateDisc(lockBackLocal, 0.12),
      ],
      role: `${sideName}-outer-locking-stop-${stopLetter}-face`,
      z0: Math.min(stopInnerZ, stopOuterZ),
      z1: Math.max(stopInnerZ, stopOuterZ),
    });
    // The legs sweep almost all of the stop's slab, leaving only the lock
    // face. Brown's stop is a block on the leg's outer edge, so a bracket
    // in the arm's own plane, clear of the legs, carries that face.
    const bowAnchorLocal = smoothBowPoints.reduce((best, point) => (
      point.distanceTo(lockBackLocal) < best.distanceTo(lockBackLocal)
        ? point : best
    ));
    const lockBracket = plateRegistry.add({
      key: `${sideKey}-bracket-${stopLetter}`,
      material: palletMaterial,
      owner: group,
      primitives: [
        platePolygon(stopSector.points.map(([x, y]) => toLocal(
          new THREE.Vector2(x, y),
        ))),
        plateBand(lockBackLocal, bowAnchorLocal, 0.16),
        plateDisc(lockBackLocal, 0.12),
      ],
      role: `${sideName}-stop-${stopLetter}-bracket-on-leg`,
      z0: -armHalfDepth,
      z1: armHalfDepth,
    });
    const lockBacking = lockBracket;
    // Brown draws no screw on the horn; the block's two screws are fixed.
    const adjustmentScrew = null;

    const beatPoint = beatPinLocalPoint(side);
    const targetLocalZ = pendulumPlaneZ - side * palletPlaneOffset;
    // The pin is set into the arm's eye (ending inside its far face) and
    // reaches just past the collar's far face.
    const beatReach = Math.sign(targetLocalZ);
    const beatPinNearZ = -beatReach * (armHalfDepth - 0.02);
    const beatPinFarZ = targetLocalZ + beatReach * 0.12;
    const beatPin = cylinderAlongZ(
      beatPinRadius,
      Math.abs(beatPinFarZ - beatPinNearZ),
      darkMaterial,
      24,
    );
    beatPin.position.set(
      beatPoint.x,
      beatPoint.y,
      (beatPinNearZ + beatPinFarZ) / 2,
    );
    beatPin.userData.label = side > 0 ? 'right beat pin' : 'left beat pin';
    beatPin.userData.role = `${sideName}-pendulum-beat-pin`;
    group.add(beatPin);
    const beatPinWitness = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 14, 10),
      markerMaterial,
    );
    beatPinWitness.position.set(
      beatPoint.x,
      beatPoint.y,
      targetLocalZ,
    );
    beatPinWitness.userData.role = `${sideName}-beat-pin-tip-witness`;
    group.add(beatPinWitness);

    const pivotEye = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.047, 10, 32),
      palletMaterial,
    );
    pivotEye.position.z = 0.02;
    pivotEye.userData.role = `${sideName}-separate-pallet-arbor-eye`;
    group.add(pivotEye);
    const arborRearZ = backFrameZ - 0.10 - side * palletPlaneOffset;
    const arborFrontZ = armHalfDepth + 0.02;
    const arborHub = cylinderAlongZ(0.073, arborFrontZ - arborRearZ,
      darkMaterial, 24);
    arborHub.position.z = (arborFrontZ + arborRearZ) / 2;
    arborHub.userData.role = `${sideName}-pallet-arbor`;
    group.add(arborHub);

    return {
      adjustmentBar,
      adjustmentScrew,
      arborHub,
      beatPin,
      beatPinWitness,
      group,
      innerJaw,
      innerTail,
      liftFace,
      liftFacePoints,
      lockBacking,
      lockFace,
      lockFacePoints,
      outerBow,
      outerBowPoints,
      pivotEye,
    };
  };
  const leftGravityArm = makeGravityArm(-1);
  const rightGravityArm = makeGravityArm(1);

  const pendulumAssembly = new THREE.Group();
  pendulumAssembly.position.set(
    pendulumPivot.x,
    pendulumPivot.y,
    pendulumPlaneZ,
  );
  pendulumAssembly.userData.axis = Z_AXIS.clone();
  pendulumAssembly.userData.role =
    'free-pendulum-behind-three-legged-wheel';
  root.add(pendulumAssembly);
  const pendulumLength = pendulumPivot.y - beatPinWorldY + 1.18;
  const pendulumRod = beamBetween(
    new THREE.Vector3(0, -0.16, 0),
    new THREE.Vector3(0, -pendulumLength, 0),
    pendulumRodRadius * 2,
    0.16,
    pendulumMaterial,
  );
  pendulumRod.userData.role = 'pendulum-rod-between-alternating-beat-pins';
  pendulumAssembly.add(pendulumRod);
  // Brown dashes this rod as a centre line; the model shows the real rod.
  const pendulumPivotEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.057, 10, 36),
    pendulumMaterial,
  );
  pendulumPivotEye.position.z = 0.02;
  pendulumPivotEye.userData.role = 'pendulum-suspension-eye';
  pendulumAssembly.add(pendulumPivotEye);
  const pendulumBob = cylinderAlongZ(0.47, 0.23,
    pendulumMaterial, 44);
  pendulumBob.position.set(0, -pendulumLength + 0.20, 0);
  pendulumBob.scale.y = 1.16;
  pendulumBob.userData.role = 'pendulum-bob';
  pendulumAssembly.add(pendulumBob);
  // Brown's bottom fitting: a collar with a pointed head clamped on the rod
  // where both legs end, with a clamping screw through it. The beat pins
  // bear on its parallel flanks.
  const beatCollarY = beatPinWorldY - pendulumPivot.y;
  // The extrusion bevel grows the outline by its size, so the drawn flank
  // lands exactly on the contact half-width.
  const beatCollarBevel = 0.004;
  const beatCollarFlank = beatCollarHalfWidth - beatCollarBevel;
  const beatCollarShape = new THREE.Shape([
    new THREE.Vector2(-beatCollarFlank, -0.30),
    new THREE.Vector2(beatCollarFlank, -0.30),
    new THREE.Vector2(beatCollarFlank, 0.34),
    new THREE.Vector2(0, 0.58),
    new THREE.Vector2(-beatCollarFlank, 0.34),
  ]);
  const beatCollar = new THREE.Mesh(
    centeredExtrusion(beatCollarShape, 0.22, beatCollarBevel),
    pendulumMaterial,
  );
  beatCollar.position.set(0, beatCollarY, 0);
  beatCollar.userData.role = 'pendulum-beat-collar-where-both-legs-end';
  pendulumAssembly.add(beatCollar);
  const beatCollarScrew = cylinderAlongZ(0.055, 0.30, darkMaterial, 20);
  beatCollarScrew.position.set(0, beatCollarY - 0.12, 0);
  beatCollarScrew.userData.role = 'pendulum-beat-collar-clamping-screw';
  pendulumAssembly.add(beatCollarScrew);

  const beatContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.064, 16, 12),
    markerMaterial,
  );
  beatContactMarker.userData.role =
    'live-weighted-arm-to-pendulum-contact';
  root.add(beatContactMarker);
  const wheelLiftMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.060, 16, 12),
    markerMaterial,
  );
  wheelLiftMarker.userData.role =
    'live-central-pin-to-opposite-arm-cocking-contact';
  root.add(wheelLiftMarker);
  const lockMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.061, 16, 12),
    markerMaterial,
  );
  lockMarker.userData.role = 'live-leg-to-stop-D-or-E-contact';
  root.add(lockMarker);
  // Contact loci sit inside the working parts; they stay positioned for
  // diagnostics but never render.
  for (const marker of [beatContactMarker, wheelLiftMarker, lockMarker]) {
    marker.visible = false;
    marker.userData.diagnosticOnly = true;
  }

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.wheelAngle;
    flyRotor.rotation.z = state.flyAngle;
    leftGravityArm.group.rotation.z = state.leftPalletAngle;
    rightGravityArm.group.rotation.z = state.rightPalletAngle;
    pendulumAssembly.rotation.z = state.pendulumAngle;

    beatContactMarker.position.set(
      state.beatContactPoint.x,
      state.beatContactPoint.y,
      pendulumPlaneZ + 0.10,
    );
    beatContactMarker.userData.active = true;
    beatContactMarker.userData.contactError = state.beatContactError;
    beatContactMarker.userData.contactSide = state.beatContactSide;
    beatContactMarker.userData.gravityImpulseActive =
      state.effectiveGravityImpulseActive;

    wheelLiftMarker.userData.active = state.wheelStepActive;
    if (state.activeLiftPoint) {
      const side = state.activeLiftSide === 'right' ? 1 : -1;
      wheelLiftMarker.position.set(
        state.activeLiftPoint.x,
        state.activeLiftPoint.y,
        side * palletPlaneOffset,
      );
    }
    wheelLiftMarker.userData.contactError = state.liftContactError;
    wheelLiftMarker.userData.contactSide = state.activeLiftSide;
    wheelLiftMarker.userData.pinIndex = state.activeLiftPinIndex;

    lockMarker.userData.active = state.wheelLocked;
    if (state.activeLockPoint) {
      const side = state.activeLockSide === 'right' ? 1 : -1;
      lockMarker.position.set(
        state.activeLockPoint.x,
        state.activeLockPoint.y,
        side * lockingWheelDepth / 4,
      );
    }
    lockMarker.userData.contactError = state.lockContactError;
    lockMarker.userData.contactSide = state.activeLockSide;
    lockMarker.userData.legIndex = state.activeLockLegIndex;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    beatContactMarker,
    escapeWheel,
    fixedFrame,
    flyBar,
    flyPhaseWitness,
    flyRotor,
    flyVanes,
    frameBearings,
    leftGravityArm,
    liftingPinMeshes,
    lockingLegMeshes,
    lockingLegTipMeshes,
    lockMarker,
    pendulumAssembly,
    pendulumBob,
    pendulumPivotEye,
    pendulumRod,
    rightGravityArm,
    suspensionBracket,
    topCrossbar,
    wheelBearingBracket,
    wheelHub,
    wheelLiftMarker,
    wheelPhaseWitness,
    wheelRotor,
    wheelShaft,
  };
  root.userData.sweptPlates = plateRegistry.plates;
  root.userData.sweptPlateInputHash = plateRegistry.bakeInputHash;
  root.userData.engagementContacts = (state) => {
    const lockSide = state.activeLockSide === 'right' ? 1 : -1;
    return {
      advanceSign: 1,
      contacts: {
        lock: state.wheelLocked ? {
          point: state.activeLockPoint,
          radius: 0.080 - 0.025,
          z: lockSide > 0
            ? [0, lockingWheelDepth / 2]
            : [-lockingWheelDepth / 2, 0],
        } : null,
        lift: state.wheelStepActive ? {
          point: state.activeLiftPoint,
          radius: 0.074,
          z: state.activeLiftSide === 'right'
            ? [palletPlaneOffset - 0.05, palletPlaneOffset + 0.05]
            : [-palletPlaneOffset - 0.05, -palletPlaneOffset + 0.05],
        } : null,
      },
    };
  };
  // Brown's elevation ends just below the beat pins; the pendulum bob hangs
  // below that crop. A narrow lens keeps the view near-orthographic.
  root.userData.cameraDistanceScale = 1.17;
  root.userData.cameraFov = 12;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.55, -4.0, -0.98),
    new THREE.Vector3(2.55, pendulumPivot.y + 0.75, 1.18),
  );
  root.userData.effectiveCenterOfMassAt = effectiveCenterOfMassAt;
  root.userData.fidelity = 'authored';
  root.userData.fixedLockPointForSide = fixedLockPointForSide;
  root.userData.geometry = {
    beatCollarHalfWidth,
    beatContactClearance,
    beatPinLocalX,
    beatPinLocalY,
    beatPinRadius,
    beatPinWorldX,
    beatPinWorldY,
    cockedMagnitude,
    fallenMagnitude,
    firstWheelStepEndPhase,
    leftEffectiveImpulseStartPhase,
    leftLockAngle,
    leftPickupPhase,
    leftUnlockPhase,
    liftingPinPhaseOffset,
    liftingPinRadius,
    lockingLegPitch,
    lockingLegRadius,
    lockingWheelDepth,
    mappedLeftBeatPin,
    mappedLeftLiftFaceB,
    mappedLeftPalletArbor,
    mappedLeftStopD,
    mappedLiftingPins,
    mappedPendulumSuspension,
    mappedRightBeatPin,
    mappedRightLiftFaceA,
    mappedRightPalletArbor,
    mappedRightStopE,
    maximumLiftMagnitude,
    meanSourceLockingRadius,
    meanSourceLiftingPinRadius,
    netGravityPotentialDrop,
    palletPivotX,
    palletPivotY,
    palletPlaneOffset,
    pendulumAmplitude,
    pendulumPeriod,
    pendulumPivot: pendulumPivot.clone(),
    pendulumRodRadius,
    pickupAngle,
    releaseMagnitude,
    rightEffectiveImpulseStartPhase,
    rightLockAngle,
    rightPickupPhase,
    rightUnlockPhase,
    secondWheelStepEndPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    standardGravity,
    unlockAngle,
    weightedArmMass,
    wheelAdvancePerBeat,
    wheelAdvancePerCycle,
    wheelCenter: wheelCenter.clone(),
  };
  root.userData.gravityPotentialAt = gravityPotentialAt;
  root.userData.liftFaceLocalPointAt = liftFaceLocalPointAt;
  root.userData.liftingPinAt = liftingPinAt;
  root.userData.lockFaceLocalPointAt = lockFaceLocalPointAt;
  root.userData.lockingLegTipAt = lockingLegTipAt;
  root.userData.mechanism = 'Denison’s single three-legged gravity escapement: one wheel carries three long locking legs and one shared set of three central lifting pins. The pendulum alternately releases stop D or E on two independent weighted arms; each 120-degree counterclockwise step uses one inner pin to cock the opposite arm, whose fixed gravitational fall then impulses the pendulum.';
  root.userData.palletMagnitudeAt = palletMagnitudeAt;
  root.userData.palletWorldPoint = palletWorldPoint;
  root.userData.presentation = 'front-oblique reconstruction of Brown’s single-wheel elevation, with the left B/D arm behind the wheel, right A/E arm in front, axial lifting pins spanning both planes, long lower bows ending at the pendulum beat pins, and a visibly indexed fly on the escape arbor';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 310 page marks Animated unavailable, so the contact sequence is reconstructed from Brown’s plate and contemporary descriptions of Denison’s escapement.',
    referenceScope: 'Brown fixes one three-legged wheel, three near-center lifting pins, separate A/B gravity arms and their D/E stops. The 1853 Cambridge report fixes the three long locking teeth, the fan-fly on the same arbor and the separation of lifting from locking; the 1979 AWCI account explicitly fixes the single wheel’s 120-degree release and explains that adding the second wheel in Movement 311 halves it to 60 degrees.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    awciOperatingReference: {
      article: 'The Fly in the Grimthorpe Gravity Escapement',
      operatingEvidence: 'The pendulum alternately releases a locking arm; the freed three-leg wheel turns while a central pin raises the opposite gravity arm, and the returning weighted arm supplies the pendulum impulse. The single design turns 120 degrees; adding a second three-legged member changes the release to 60 degrees. The fly limits the released wheel speed.',
      publication: 'Horological Times',
      publicationYear: 1979,
      url: 'https://www.awci.com/wp-content/uploads/ht/1979/1979-05-web.pdf',
    },
    bensonFrontElevation: {
      figureTitle: 'Three-Legg’d Gravity Escapement',
      operatingEvidence: 'The matched regulator front elevation identifies three central lifting pins and horizontal arc-adjustment pieces at the tops of the pallets.',
      page: 151,
      publication: 'Time and Time-Tellers',
      publicationYear: 1875,
      url: 'https://www.gutenberg.org/files/45883/45883-h/45883-h.htm',
    },
    contemporaryDenisonReport: {
      meetingDate: '1853-02-07',
      operatingEvidence: 'The escape wheel has three pins near its center to lift the gravity arms and three long teeth locked by stops on those arms. A fan-fly on the escape-wheel axis moderates the free step and prevents tripping.',
      publication: 'Proceedings of the Cambridge Philosophical Society',
      publicationYear: 1853,
      url: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Proceedings_-_Cambridge_Philosophical_Society_%28IA_proceedingscambr01camb%29.pdf',
    },
    officialDescription: movement.description,
    plate310: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one three-legged locking wheel with one shared set of three inner lifting pins; two independent long gravity arms pivot near the pendulum suspension and carry inner faces A/B, outer stops D/E, and lower pendulum beat pins',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterLeftBeatPin: sourceRasterLeftBeatPin.clone(),
      rasterLeftLiftFaceB: sourceRasterLeftLiftFaceB.clone(),
      rasterLeftPalletArbor: sourceRasterLeftPalletArbor.clone(),
      rasterLeftStopD: sourceRasterLeftStopD.clone(),
      rasterLiftingPins: sourceRasterLiftingPins.map((point) => point.clone()),
      rasterPendulumSuspension: sourceRasterPendulumSuspension.clone(),
      rasterRightBeatPin: sourceRasterRightBeatPin.clone(),
      rasterRightLiftFaceA: sourceRasterRightLiftFaceA.clone(),
      rasterRightPalletArbor: sourceRasterRightPalletArbor.clone(),
      rasterRightStopE: sourceRasterRightStopE.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      singleWheelEvidence: 'Brown 311 explicitly introduces two locking wheels; Brown 310 depicts and describes only one escape wheel, so no second locking rotor belongs in this movement.',
      symmetryReconstruction: 'paired arbor and lower beat-pin landmarks are averaged to recover the intended equal left/right gravity-arm geometry',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'right-weighted-arm-falls-with-pendulum',
      'pendulum-lifts-left-arm-and-releases-stop-D',
      'wheel-turns-120-degrees-and-central-pin-cocks-right-A',
      'right-stop-E-locks-the-single-wheel',
      'left-weighted-arm-falls-with-pendulum',
      'pendulum-lifts-right-arm-and-releases-stop-E',
      'wheel-turns-120-degrees-and-central-pin-cocks-left-B',
      'left-stop-D-locks-the-single-wheel',
    ],
  };
  root.userData.transmission = {
    direction: 'counterclockwise in Brown’s reconstructed front elevation',
    effectiveImpulseArc: 'each weighted arm supplies its net gravity impulse while the pendulum traverses from 1.2 degrees on one side to 1.2 degrees on the other',
    equalImpulseEnergyPerSide: netGravityPotentialDrop,
    flyCoupling: 'the friction-spring fan-fly shares the escape-wheel arbor and therefore the same normal-operation angle and angular speed',
    gravityIsolation: 'the train only lifts the opposite gravity arm; the pendulum impulse comes from a fixed arm mass falling through a fixed angle',
    impulsesPerPendulumCycle: 2,
    impulsesPerVibration: [1, 1],
    innerToOuterRadiusRatio: liftingPinRadius / lockingLegRadius,
    lifting: 'one of three shared axial pins near the center cocks the opposite A or B arm during each released wheel step',
    locking: 'one of three long leg tips rests alternately against outer stop D or E with no wheel recoil until that arm is lifted clear',
    lockingWheels: 1,
    mechanismClosurePendulumCycles: 3,
    stepsPerPendulumCycle: 2,
    wheelAdvancePerBeatDegrees: 120,
    wheelAdvancePerBeatRadians: wheelAdvancePerBeat,
    wheelAdvancePerCycleRadians: wheelAdvancePerCycle,
    wheelCyclesPerRevolution: 1.5,
    wheelRevolutionsPerMechanismClosure: 2,
  };
  root.userData.wheelAngleAtCycleStart = wheelAngleAtCycleStart;

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
  for (const object of [
    beatContactMarker,
    flyPhaseWitness,
    lockMarker,
    wheelLiftMarker,
    wheelPhaseWitness,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(0.6, 0.35, 15.6),
    root,
    update,
  };
}

function doubleThreeLeggedGravityEscapement(movement) {
  const root = new THREE.Group();

  const sourceImageWidth = 263;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(128, 270);
  const sourceRasterLeftPalletArbor = new THREE.Vector2(118, 31);
  const sourceRasterRightPalletArbor = new THREE.Vector2(140, 32);
  const sourceRasterPendulumSuspension = new THREE.Vector2(129, 10);
  const sourceRasterLeftStopE = new THREE.Vector2(28, 228);
  const sourceRasterRightStopD = new THREE.Vector2(230, 219);
  const sourceRasterLeftBeatPin = new THREE.Vector2(115, 489);
  const sourceRasterRightBeatPin = new THREE.Vector2(140, 488);
  const sourceRasterFlyUpperEnd = new THREE.Vector2(205, 20);
  const sourceRasterFlyLowerEnd = new THREE.Vector2(62, 474);
  const sourceRasterLiftingPins = [
    new THREE.Vector2(123, 267),
    new THREE.Vector2(129, 265),
    new THREE.Vector2(130, 272),
  ];
  const sourceRasterFrontLegTipsABC = [
    new THREE.Vector2(221, 215),
    new THREE.Vector2(128, 377),
    new THREE.Vector2(42, 229),
  ];
  const sourceRasterRearLegTipsabc = [
    new THREE.Vector2(127, 164),
    new THREE.Vector2(183, 329),
    new THREE.Vector2(35, 337),
  ];

  const wheelCenter = new THREE.Vector2(0, 0.20);
  const lockingLegRadius = 2.05;
  const measuredLeftStopRadius = sourceRasterWheelCenter.distanceTo(
    sourceRasterLeftStopE,
  );
  const measuredRightStopRadius = sourceRasterWheelCenter.distanceTo(
    sourceRasterRightStopD,
  );
  const meanSourceLockingRadius = (
    measuredLeftStopRadius + measuredRightStopRadius
  ) / 2;
  const sourceScale = lockingLegRadius / meanSourceLockingRadius;
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    wheelCenter.x + (x - sourceRasterWheelCenter.x) * sourceScale,
    wheelCenter.y + (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const mappedLeftPalletArbor = sourcePointToModel(
    sourceRasterLeftPalletArbor,
  );
  const mappedRightPalletArbor = sourcePointToModel(
    sourceRasterRightPalletArbor,
  );
  const mappedPendulumSuspension = sourcePointToModel(
    sourceRasterPendulumSuspension,
  );
  const mappedLeftStopE = sourcePointToModel(sourceRasterLeftStopE);
  const mappedRightStopD = sourcePointToModel(sourceRasterRightStopD);
  const mappedLeftBeatPin = sourcePointToModel(sourceRasterLeftBeatPin);
  const mappedRightBeatPin = sourcePointToModel(sourceRasterRightBeatPin);
  const mappedFlyUpperEnd = sourcePointToModel(sourceRasterFlyUpperEnd);
  const mappedFlyLowerEnd = sourcePointToModel(sourceRasterFlyLowerEnd);
  // Brown's fly line, upper right to lower left through the arbor.
  const flyPlateAngle = Math.atan2(
    mappedFlyUpperEnd.y - mappedFlyLowerEnd.y,
    mappedFlyUpperEnd.x - mappedFlyLowerEnd.x,
  );
  const mappedLiftingPins = sourceRasterLiftingPins.map(sourcePointToModel);
  const mappedFrontLegTipsABC = sourceRasterFrontLegTipsABC.map(
    sourcePointToModel,
  );
  const mappedRearLegTipsabc = sourceRasterRearLegTipsabc.map(
    sourcePointToModel,
  );

  const palletPivotX = (
    Math.abs(mappedLeftPalletArbor.x)
      + Math.abs(mappedRightPalletArbor.x)
  ) / 2;
  const palletPivotY = (
    mappedLeftPalletArbor.y + mappedRightPalletArbor.y
  ) / 2;
  const palletPivot = (side) => new THREE.Vector2(
    side * palletPivotX,
    palletPivotY,
  );
  const beatPinWorldX = (
    Math.abs(mappedLeftBeatPin.x) + Math.abs(mappedRightBeatPin.x)
  ) / 2;
  const beatPinWorldY = (
    mappedLeftBeatPin.y + mappedRightBeatPin.y
  ) / 2;
  const beatPinLocalX = beatPinWorldX - palletPivotX;
  const beatPinLocalY = beatPinWorldY - palletPivotY;
  const beatPinLocalPoint = (side) => new THREE.Vector2(
    side * beatPinLocalX,
    beatPinLocalY,
  );
  const pendulumPivot = new THREE.Vector2(
    0,
    mappedPendulumSuspension.y,
  );

  const pendulumPeriod = 4;
  const pendulumAmplitude = THREE.MathUtils.degToRad(3);
  const pickupAngle = THREE.MathUtils.degToRad(1.2);
  // Brown gives no unlocking arc. 1.8 degrees leaves a visible radial stop
  // engagement of about 0.03 after the swept running clearance.
  const unlockAngle = THREE.MathUtils.degToRad(1.8);
  const pendulumRodRadius = 0.068;
  const beatPinRadius = 0.098;
  const beatContactClearance = pendulumRodRadius + beatPinRadius;
  const rearWheelPlaneZ = -0.54;
  const frontWheelPlaneZ = 0.54;
  const leftPalletPlaneZ = -0.11;
  const rightPalletPlaneZ = 0.11;
  // The rod must pass the common arbor at the wheel centre, and behind the
  // wheels the long fly (half-span larger than the beat pins' distance from
  // the arbor) sweeps the beat pins' path, so the rod hangs just in front of
  // the arbor's front end.
  const pendulumPlaneZ = 0.80;
  const lockingWheelDepth = 0.20;
  const lockingLegPitch = FULL_TURN / 3;
  const rearWheelPhaseOffset = FULL_TURN / 6;
  const wheelAdvancePerBeat = FULL_TURN / 6;
  const wheelAdvancePerCycle = FULL_TURN / 3;
  const leftLockAngle = 5 * Math.PI / 6;
  const rightLockAngle = Math.PI / 6;
  const liftingPinPhaseOffset = 4 * Math.PI / 3;
  const measuredLiftingPinRadius = mappedLiftingPins.reduce(
    (sum, point) => sum + point.distanceTo(wheelCenter),
    0,
  ) / mappedLiftingPins.length;
  const liftingPinRadius = Math.max(
    measuredLiftingPinRadius,
    lockingLegRadius / 15,
  );

  const pendulumMotionAtPhase = (cyclePhase) => {
    const argument = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / pendulumPeriod;
    return {
      acceleration: -pendulumAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angle: pendulumAmplitude * Math.cos(argument),
      speed: -pendulumAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };
  const beatPinCenterAt = (side, magnitude) => palletPivot(side).add(
    rotate2(beatPinLocalPoint(side), side * magnitude),
  );
  const signedBeatClearance = (outwardPendulumAngle, magnitude) => {
    const beatPinCenter = beatPinCenterAt(1, magnitude);
    const pendulumNormal = new THREE.Vector2(
      Math.cos(outwardPendulumAngle),
      Math.sin(outwardPendulumAngle),
    );
    return pendulumNormal.dot(
      beatPinCenter.clone().sub(pendulumPivot),
    );
  };
  const palletMagnitudeAt = (outwardPendulumAngle) => {
    let lower = THREE.MathUtils.degToRad(-16);
    let upper = THREE.MathUtils.degToRad(10);
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (signedBeatClearance(outwardPendulumAngle, middle)
          > beatContactClearance) {
        upper = middle;
      } else {
        lower = middle;
      }
    }
    return (lower + upper) / 2;
  };
  const cockedMagnitude = palletMagnitudeAt(pickupAngle);
  const releaseMagnitude = palletMagnitudeAt(unlockAngle);
  const fallenMagnitude = palletMagnitudeAt(-pickupAngle);
  const maximumLiftMagnitude = palletMagnitudeAt(pendulumAmplitude);
  const rightEffectiveImpulseStartPhase = Math.acos(
    pickupAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const leftPickupPhase = Math.acos(
    -pickupAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const leftUnlockPhase = Math.acos(
    -unlockAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const firstWheelStepEndPhase = 0.42;
  const leftEffectiveImpulseStartPhase = 0.5
    + rightEffectiveImpulseStartPhase;
  const rightPickupPhase = 1 - rightEffectiveImpulseStartPhase;
  const rightUnlockPhase = 1 - Math.acos(
    unlockAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const secondWheelStepEndPhase = 0.92;
  const phaseBoundaryEpsilon = 1e-12;

  const palletLocalPoint = (side, worldPoint, magnitude) => rotate2(
    worldPoint.clone().sub(palletPivot(side)),
    -side * magnitude,
  );
  const palletWorldPoint = (side, localPoint, magnitude) => palletPivot(side)
    .add(rotate2(localPoint, side * magnitude));
  const lockAngleForSide = (side) => (
    side > 0 ? rightLockAngle : leftLockAngle
  );
  const wheelForSide = (side) => (
    side > 0 ? 'front-ABC' : 'rear-abc'
  );
  const wheelPhaseForName = (wheelName) => (
    wheelName === 'rear-abc' ? rearWheelPhaseOffset : 0
  );
  const fixedLockPointForSide = (side) => {
    const angle = lockAngleForSide(side);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * lockingLegRadius,
      Math.sin(angle) * lockingLegRadius,
    ));
  };
  const lockingLegTipAt = (wheelAngle, wheelName, legIndex) => {
    const angle = wheelAngle
      + wheelPhaseForName(wheelName)
      + legIndex * lockingLegPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * lockingLegRadius,
      Math.sin(angle) * lockingLegRadius,
    ));
  };
  const liftingPinAt = (wheelAngle, pinIndex) => {
    const angle = wheelAngle
      + liftingPinPhaseOffset
      + pinIndex * lockingLegPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * liftingPinRadius,
      Math.sin(angle) * liftingPinRadius,
    ));
  };
  const liftFaceLocalPointAt = (side, progress) => {
    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const pinStartAngle = side > 0 ? -Math.PI / 6 : 5 * Math.PI / 6;
    const pinAngle = pinStartAngle
      + wheelAdvancePerBeat * clampedProgress;
    const pinPoint = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(pinAngle) * liftingPinRadius,
      Math.sin(pinAngle) * liftingPinRadius,
    ));
    const magnitude = THREE.MathUtils.lerp(
      fallenMagnitude,
      cockedMagnitude,
      clampedProgress,
    );
    return palletLocalPoint(side, pinPoint, magnitude);
  };
  const lockFaceLocalPointAt = (side, magnitude) => palletLocalPoint(
    side,
    fixedLockPointForSide(side),
    magnitude,
  );

  const effectiveCenterOfMassLocal = (side) => new THREE.Vector2(
    side * 0.92,
    -3.62,
  );
  const weightedArmMass = 1;
  const standardGravity = 9.80665;
  const effectiveCenterOfMassAt = (side, magnitude) => palletWorldPoint(
    side,
    effectiveCenterOfMassLocal(side),
    magnitude,
  );
  const gravityPotentialAt = (side, magnitude) => weightedArmMass
    * standardGravity * effectiveCenterOfMassAt(side, magnitude).y;
  const netGravityPotentialDrop = gravityPotentialAt(1, cockedMagnitude)
    - gravityPotentialAt(1, fallenMagnitude);

  const wheelAngleAtCycleStart = (cycleIndex) => Math.PI / 2
    + cycleIndex * wheelAdvancePerCycle;
  const rawStateAtTime = (time) => {
    const cycleCoordinate = time / pendulumPeriod;
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const pendulum = pendulumMotionAtPhase(cyclePhase);
    const startingLeftLegIndex = positiveModulo(-cycleIndex, 3);
    const rightLandingLegIndex = positiveModulo(2 - cycleIndex, 3);
    const landingLeftLegIndex = rightLandingLegIndex;
    const firstLiftPinIndex = startingLeftLegIndex;
    const secondLiftPinIndex = positiveModulo(1 - cycleIndex, 3);
    let activeLiftPinIndex = null;
    let activeLiftSide = null;
    let activeLockLegIndex = null;
    let activeLockSide = null;
    let activeLockWheel = null;
    let effectiveGravityImpulseActive = false;
    let beatContactSide = null;
    let gravityDescentSide = null;
    let leftMagnitude = cockedMagnitude;
    let liftProgress = null;
    let mode = 'right-gravity-arm-recovery';
    let pendulumRaisedPalletSide = null;
    let rightMagnitude = cockedMagnitude;
    let trainCoupledToPendulum = false;
    let wheelAdvance = 0;

    if (cyclePhase < leftPickupPhase - phaseBoundaryEpsilon) {
      rightMagnitude = palletMagnitudeAt(pendulum.angle);
      activeLockSide = 'left';
      activeLockWheel = 'rear-abc';
      activeLockLegIndex = startingLeftLegIndex;
      beatContactSide = 'right';
      gravityDescentSide = 'right';
      if (cyclePhase >= rightEffectiveImpulseStartPhase) {
        effectiveGravityImpulseActive = true;
        mode = 'right-gravity-arm-impulses-pendulum';
      }
    } else if (cyclePhase < leftUnlockPhase - phaseBoundaryEpsilon) {
      leftMagnitude = palletMagnitudeAt(-pendulum.angle);
      rightMagnitude = fallenMagnitude;
      activeLockSide = 'left';
      activeLockWheel = 'rear-abc';
      activeLockLegIndex = startingLeftLegIndex;
      beatContactSide = 'left';
      mode = 'pendulum-lifts-left-arm-and-releases-rear-wheel-at-E';
      pendulumRaisedPalletSide = 'left';
      trainCoupledToPendulum = true;
    } else if (cyclePhase <= firstWheelStepEndPhase
      + phaseBoundaryEpsilon) {
      const linearProgress = (
        cyclePhase - leftUnlockPhase
      ) / (firstWheelStepEndPhase - leftUnlockPhase);
      liftProgress = smootherStep(linearProgress);
      leftMagnitude = palletMagnitudeAt(-pendulum.angle);
      rightMagnitude = THREE.MathUtils.lerp(
        fallenMagnitude,
        cockedMagnitude,
        liftProgress,
      );
      activeLiftSide = 'right';
      activeLiftPinIndex = firstLiftPinIndex;
      beatContactSide = 'left';
      mode = 'shared-pin-cocks-right-arm-between-wheels';
      pendulumRaisedPalletSide = 'left';
      wheelAdvance = wheelAdvancePerBeat * liftProgress;
    } else if (cyclePhase < 0.5 - phaseBoundaryEpsilon) {
      leftMagnitude = palletMagnitudeAt(-pendulum.angle);
      rightMagnitude = cockedMagnitude;
      activeLockSide = 'right';
      activeLockWheel = 'front-ABC';
      activeLockLegIndex = rightLandingLegIndex;
      beatContactSide = 'left';
      mode = 'front-wheel-ABC-locked-by-right-stop-D';
      pendulumRaisedPalletSide = 'left';
      wheelAdvance = wheelAdvancePerBeat;
    } else if (cyclePhase < rightPickupPhase - phaseBoundaryEpsilon) {
      leftMagnitude = palletMagnitudeAt(-pendulum.angle);
      rightMagnitude = cockedMagnitude;
      activeLockSide = 'right';
      activeLockWheel = 'front-ABC';
      activeLockLegIndex = rightLandingLegIndex;
      beatContactSide = 'left';
      gravityDescentSide = 'left';
      mode = 'left-gravity-arm-recovery';
      wheelAdvance = wheelAdvancePerBeat;
      if (cyclePhase >= leftEffectiveImpulseStartPhase) {
        effectiveGravityImpulseActive = true;
        mode = 'left-gravity-arm-impulses-pendulum';
      }
    } else if (cyclePhase < rightUnlockPhase - phaseBoundaryEpsilon) {
      leftMagnitude = fallenMagnitude;
      rightMagnitude = palletMagnitudeAt(pendulum.angle);
      activeLockSide = 'right';
      activeLockWheel = 'front-ABC';
      activeLockLegIndex = rightLandingLegIndex;
      beatContactSide = 'right';
      mode = 'pendulum-lifts-right-arm-and-releases-front-wheel-at-D';
      pendulumRaisedPalletSide = 'right';
      trainCoupledToPendulum = true;
      wheelAdvance = wheelAdvancePerBeat;
    } else if (cyclePhase <= secondWheelStepEndPhase
      + phaseBoundaryEpsilon) {
      const linearProgress = (
        cyclePhase - rightUnlockPhase
      ) / (secondWheelStepEndPhase - rightUnlockPhase);
      liftProgress = smootherStep(linearProgress);
      leftMagnitude = THREE.MathUtils.lerp(
        fallenMagnitude,
        cockedMagnitude,
        liftProgress,
      );
      rightMagnitude = palletMagnitudeAt(pendulum.angle);
      activeLiftSide = 'left';
      activeLiftPinIndex = secondLiftPinIndex;
      beatContactSide = 'right';
      mode = 'shared-pin-cocks-left-arm-between-wheels';
      pendulumRaisedPalletSide = 'right';
      wheelAdvance = wheelAdvancePerBeat * (1 + liftProgress);
    } else {
      leftMagnitude = cockedMagnitude;
      rightMagnitude = palletMagnitudeAt(pendulum.angle);
      activeLockSide = 'left';
      activeLockWheel = 'rear-abc';
      activeLockLegIndex = landingLeftLegIndex;
      beatContactSide = 'right';
      mode = 'rear-wheel-abc-locked-by-left-stop-E';
      pendulumRaisedPalletSide = 'right';
      wheelAdvance = wheelAdvancePerCycle;
    }

    const wheelAngle = wheelAngleAtCycleStart(cycleIndex) + wheelAdvance;
    // The blade lies along Brown's FLY line at t = 0 (wheel at pi/2).
    const flyPhaseOffset = flyPlateAngle - wheelAngleAtCycleStart(0);
    const flyAngle = wheelAngle + flyPhaseOffset;
    const leftPalletAngle = -leftMagnitude;
    const rightPalletAngle = rightMagnitude;
    const beatSideSign = beatContactSide === 'right' ? 1 : -1;
    const beatMagnitude = beatContactSide === 'right'
      ? rightMagnitude
      : leftMagnitude;
    const activeBeatPinCenter = beatPinCenterAt(
      beatSideSign,
      beatMagnitude,
    );
    const pendulumDirection = new THREE.Vector2(
      Math.sin(pendulum.angle),
      -Math.cos(pendulum.angle),
    );
    const pendulumNormal = new THREE.Vector2(
      Math.cos(pendulum.angle),
      Math.sin(pendulum.angle),
    );
    const beatProjection = activeBeatPinCenter.clone().sub(pendulumPivot)
      .dot(pendulumDirection);
    const pendulumRodCenterPoint = pendulumPivot.clone().add(
      pendulumDirection.clone().multiplyScalar(beatProjection),
    );
    const pendulumSurfacePoint = pendulumRodCenterPoint.clone().add(
      pendulumNormal.clone().multiplyScalar(
        beatSideSign * pendulumRodRadius,
      ),
    );
    const beatPinSurfacePoint = activeBeatPinCenter.clone().add(
      pendulumNormal.clone().multiplyScalar(
        -beatSideSign * beatPinRadius,
      ),
    );
    const beatContactPoint = pendulumSurfacePoint.clone().add(
      beatPinSurfacePoint,
    ).multiplyScalar(0.5);

    const activeLiftPoint = activeLiftPinIndex === null
      ? null
      : liftingPinAt(wheelAngle, activeLiftPinIndex);
    const liftSideSign = activeLiftSide === 'right' ? 1 : -1;
    const liftMagnitude = activeLiftSide === 'right'
      ? rightMagnitude
      : leftMagnitude;
    const activeLiftFaceLocalPoint = activeLiftSide === null
      ? null
      : liftFaceLocalPointAt(liftSideSign, liftProgress);
    const activeLiftFacePoint = activeLiftSide === null
      ? null
      : palletWorldPoint(
        liftSideSign,
        activeLiftFaceLocalPoint,
        liftMagnitude,
      );
    const lockSideSign = activeLockSide === 'right' ? 1 : -1;
    const lockMagnitude = activeLockSide === 'right'
      ? rightMagnitude
      : leftMagnitude;
    const activeLockPoint = activeLockLegIndex === null
      ? null
      : lockingLegTipAt(
        wheelAngle,
        activeLockWheel,
        activeLockLegIndex,
      );
    const activeLockFaceLocalPoint = activeLockSide === null
      ? null
      : lockFaceLocalPointAt(lockSideSign, lockMagnitude);
    const activeLockFacePoint = activeLockSide === null
      ? null
      : palletWorldPoint(
        lockSideSign,
        activeLockFaceLocalPoint,
        lockMagnitude,
      );

    return {
      activeBeatPinCenter,
      activeLiftFaceLocalPoint,
      activeLiftFacePoint,
      activeLiftPinIndex,
      activeLiftPoint,
      activeLiftSide,
      activeLockFaceLocalPoint,
      activeLockFacePoint,
      activeLockLegIndex,
      activeLockPoint,
      activeLockSide,
      activeLockWheel,
      beatContactError: Math.abs(
        activeBeatPinCenter.distanceTo(pendulumRodCenterPoint)
          - beatContactClearance
      ),
      beatContactPoint,
      beatContactSide,
      cycleIndex,
      cyclePhase,
      effectiveGravityImpulseActive,
      firstLiftPinIndex,
      flyAngle,
      gravityDescentSide,
      gravityImpulseIsolatedFromTrain:
        effectiveGravityImpulseActive && !trainCoupledToPendulum,
      impulseDirection: effectiveGravityImpulseActive
        ? gravityDescentSide === 'right' ? 'leftward' : 'rightward'
        : null,
      landingLeftLegIndex,
      leftPalletAngle,
      leftPalletMagnitude: leftMagnitude,
      liftContactError: activeLiftPoint === null
        ? null
        : activeLiftPoint.distanceTo(activeLiftFacePoint),
      liftProgress,
      lockContactError: activeLockPoint === null
        ? null
        : activeLockPoint.distanceTo(activeLockFacePoint),
      mode,
      palletPotentialEnergy: {
        left: gravityPotentialAt(-1, leftMagnitude),
        right: gravityPotentialAt(1, rightMagnitude),
      },
      pendulumAngle: pendulum.angle,
      pendulumAngularAcceleration: pendulum.acceleration,
      pendulumAngularSpeed: pendulum.speed,
      pendulumRaisedPalletSide,
      rightLandingLegIndex,
      rightPalletAngle,
      rightPalletMagnitude: rightMagnitude,
      secondLiftPinIndex,
      startingLeftLegIndex,
      trainCoupledToPendulum,
      trainRaisingPalletSide: activeLiftSide,
      wheelAdvance,
      wheelAngle,
      wheelLocked: activeLockSide !== null,
      wheelStepActive: activeLiftSide !== null,
    };
  };
  const derivativeStep = 1e-5;
  const stateAtTime = (time) => {
    const state = rawStateAtTime(time);
    const before = rawStateAtTime(time - derivativeStep);
    const after = rawStateAtTime(time + derivativeStep);
    const wheelAngularSpeed = (
      after.wheelAngle - before.wheelAngle
    ) / (2 * derivativeStep);
    return {
      ...state,
      flyAngularSpeed: wheelAngularSpeed,
      leftPalletAngularSpeed: (
        after.leftPalletAngle - before.leftPalletAngle
      ) / (2 * derivativeStep),
      rightPalletAngularSpeed: (
        after.rightPalletAngle - before.rightPalletAngle
      ) / (2 * derivativeStep),
      wheelAngularAcceleration: (
        after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle
      ) / derivativeStep ** 2,
      wheelAngularSpeed,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.43,
    roughness: 0.36,
  });
  const frontSystemMaterial = matte(PALETTE.driver, {
    metalness: 0.25,
    roughness: 0.45,
  });
  const rearSystemMaterial = matte(PALETTE.driven, {
    metalness: 0.29,
    roughness: 0.47,
  });
  const pinMaterial = matte(PALETTE.ink, {
    metalness: 0.52,
    roughness: 0.30,
  });
  const pendulumMaterial = matte(PALETTE.brass, {
    metalness: 0.43,
    roughness: 0.35,
  });
  const markerMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.25,
  });
  const stopFaceMaterial = matte(PALETTE.muted, {
    metalness: 0.2,
    roughness: 0.4,
  });

  const plateRegistry = createSweptPlateRegistry(movement.id);
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-double-three-legged-frame';
  root.add(fixedFrame);
  // All journals are bored rings on the back frame plane, behind the rear
  // wheel; the rotating arbors run through them.
  const backFrameZ = -0.92;
  // Brown's hatched suspension block: about 70 px wide and 10 px tall,
  // centred on the pendulum's suspension. It is one solid cock reaching from
  // the back frame to just behind the pendulum's eye, so the suspension stud
  // is only a short pin through the eye (it was a 1.74-long pin).
  const suspensionBlockHalfWidth = 35 * sourceScale;
  const suspensionBlockHalfHeight = 0.10;
  const suspensionBlockFrontZ = pendulumPlaneZ - 0.08 - 0.03;
  const suspensionBlockRearZ = backFrameZ - 0.09;
  const suspensionBlockShape = new THREE.Shape();
  {
    const x0 = -suspensionBlockHalfWidth, x1 = suspensionBlockHalfWidth;
    const y0 = pendulumPivot.y - suspensionBlockHalfHeight;
    const y1 = pendulumPivot.y + suspensionBlockHalfHeight;
    const r = 0.04;
    suspensionBlockShape.moveTo(x0 + r, y0);
    suspensionBlockShape.lineTo(x1 - r, y0);
    suspensionBlockShape.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
    suspensionBlockShape.lineTo(x1, y1 - r);
    suspensionBlockShape.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
    suspensionBlockShape.lineTo(x0 + r, y1);
    suspensionBlockShape.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI,
      false);
    suspensionBlockShape.lineTo(x0, y0 + r);
    suspensionBlockShape.absarc(x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI,
      false);
  }
  const topCrossbar = new THREE.Mesh(
    centeredExtrusion(suspensionBlockShape,
      suspensionBlockFrontZ - suspensionBlockRearZ, 0.006),
    frameMaterial,
  );
  topCrossbar.position.z = (suspensionBlockFrontZ + suspensionBlockRearZ) / 2;
  topCrossbar.userData.role = 'fixed-suspension-block';
  fixedFrame.add(topCrossbar);
  const wheelBearingBracket = beamBetween(
    new THREE.Vector3(-2.42, wheelCenter.y, backFrameZ),
    new THREE.Vector3(wheelCenter.x - 0.17, wheelCenter.y, backFrameZ),
    0.12,
    0.16,
    frameMaterial,
  );
  wheelBearingBracket.userData.role = 'double-wheel-bearing-bracket';
  fixedFrame.add(wheelBearingBracket);
  const palletHangers = [-1, 1].map((side) => {
    const hanger = beamBetween(
      new THREE.Vector3(side * palletPivotX,
        pendulumPivot.y - suspensionBlockHalfHeight + 0.02, backFrameZ),
      new THREE.Vector3(side * palletPivotX, palletPivotY + 0.14,
        backFrameZ),
      0.11,
      0.15,
      frameMaterial,
    );
    hanger.userData.role = 'pallet-arbor-hanger';
    fixedFrame.add(hanger);
    return hanger;
  });
  const frameBearings = [
    [wheelCenter, 'common-double-wheel-bearing', 0.17, 0.063],
    [palletPivot(-1), 'left-between-wheels-pallet-bearing', 0.15, 0.078],
    [palletPivot(1), 'right-between-wheels-pallet-bearing', 0.15, 0.078],
  ].map(([point, role, outerRadius, boreRadius]) => {
    const bearing = boredBearing(outerRadius, boreRadius, 0.16,
      darkMaterial);
    bearing.position.set(point.x, point.y, backFrameZ);
    bearing.userData.role = role;
    fixedFrame.add(bearing);
    return bearing;
  });
  const suspensionStudRearZ = suspensionBlockFrontZ - 0.04;
  const suspensionStudFrontZ = pendulumPlaneZ + 0.08 + 0.04;
  const suspensionStud = cylinderAlongZ(0.13,
    suspensionStudFrontZ - suspensionStudRearZ, darkMaterial, 30);
  suspensionStud.position.set(pendulumPivot.x, pendulumPivot.y,
    (suspensionStudFrontZ + suspensionStudRearZ) / 2);
  suspensionStud.userData.role = 'pendulum-suspension-bearing';
  fixedFrame.add(suspensionStud);
  frameBearings.push(suspensionStud);

  const escapeWheelAssembly = new THREE.Group();
  escapeWheelAssembly.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheelAssembly.userData.axis = Z_AXIS.clone();
  escapeWheelAssembly.userData.role =
    'counterclockwise-double-three-legged-escape-wheel-assembly';
  root.add(escapeWheelAssembly);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'rigid-two-wheel-six-lock-position-rotor';
  escapeWheelAssembly.add(wheelRotor);

  const makeThreeLeggedWheel = ({
    material,
    name,
    phaseOffset,
    planeZ,
    symbols,
  }) => {
    const group = new THREE.Group();
    group.position.z = planeZ;
    group.rotation.z = phaseOffset;
    group.userData.phaseOffset = phaseOffset;
    group.userData.role = `${name}-three-legged-locking-wheel`;
    wheelRotor.add(group);
    const legs = [];
    const tips = [];
    for (let legIndex = 0; legIndex < 3; legIndex += 1) {
      const angle = legIndex * lockingLegPitch;
      // One straight taper ending in the round locking tip (the old
      // separate hardened tip, r 0.075 about R - 0.022, is now the leg's
      // own end), with flat faces and no lengthwise ridge.
      const legShape = taperedRoundTipLegShape(0.20, 0.105,
        lockingLegRadius - 0.022, 0.075);
      const leg = new THREE.Mesh(
        centeredExtrusion(legShape, lockingWheelDepth, 0.006),
        material,
      );
      leg.rotation.z = angle;
      leg.userData.index = legIndex;
      leg.userData.label = symbols[legIndex];
      leg.userData.role = `${name}-locking-leg-${symbols[legIndex]}`;
      group.add(leg);
      legs.push(leg);
      tips.push(leg);
    }
    const hub = cylinderAlongZ(0.235, lockingWheelDepth + 0.06,
      material, 34);
    hub.userData.role = `${name}-wheel-hub`;
    group.add(hub);
    const phaseWitness = new THREE.Mesh(
      new THREE.SphereGeometry(0.063, 14, 10),
      markerMaterial,
    );
    phaseWitness.position.set(lockingLegRadius * 0.66, 0, 0.14);
    phaseWitness.userData.role = `${name}-white-phase-witness`;
    group.add(phaseWitness);
    return {
      group,
      hub,
      legs,
      phaseWitness,
      tips,
    };
  };
  const frontWheelABC = makeThreeLeggedWheel({
    material: frontSystemMaterial,
    name: 'front-ABC',
    phaseOffset: 0,
    planeZ: frontWheelPlaneZ,
    symbols: ['A', 'B', 'C'],
  });
  const rearWheelabc = makeThreeLeggedWheel({
    material: rearSystemMaterial,
    name: 'rear-abc',
    phaseOffset: rearWheelPhaseOffset,
    planeZ: rearWheelPlaneZ,
    symbols: ['a', 'b', 'c'],
  });
  // Slender enough that each fallen pallet's late lift face swings clear
  // of it between the wheels.
  const wheelShaftFrontZ = frontWheelPlaneZ + lockingWheelDepth / 2 + 0.05;
  const wheelShaftRearZ = -1.36;
  const wheelShaft = cylinderAlongZ(0.055,
    wheelShaftFrontZ - wheelShaftRearZ, darkMaterial, 28);
  wheelShaft.position.z = (wheelShaftFrontZ + wheelShaftRearZ) / 2;
  wheelShaft.userData.role = 'common-double-wheel-escape-arbor';
  wheelRotor.add(wheelShaft);
  const liftingPinMeshes = [];
  for (let pinIndex = 0; pinIndex < 3; pinIndex += 1) {
    const angle = liftingPinPhaseOffset + pinIndex * lockingLegPitch;
    const pin = cylinderAlongZ(
      0.071,
      frontWheelPlaneZ - rearWheelPlaneZ + 0.18,
      pinMaterial,
      24,
    );
    pin.position.set(
      Math.cos(angle) * liftingPinRadius,
      Math.sin(angle) * liftingPinRadius,
      0,
    );
    pin.userData.index = pinIndex;
    pin.userData.role = `one-shared-lifting-pin-${pinIndex + 1}-of-3`;
    wheelRotor.add(pin);
    liftingPinMeshes.push(pin);
  }

  const flyRotor = new THREE.Group();
  flyRotor.position.z = backFrameZ - 0.34;
  flyRotor.userData.axis = Z_AXIS.clone();
  flyRotor.userData.role = 'large-friction-spring-fly-on-common-arbor';
  escapeWheelAssembly.add(flyRotor);
  // Brown draws the FLY as one long plain blade seen edge-on, through the
  // arbor from upper right to lower left (raster 205,20 to 62,474). It is
  // one flat blade, its broad faces containing the arbor axis (so it reads
  // as a line from the front, as he draws it), of his mean half-span.
  const flyUpperReach = mappedFlyUpperEnd.distanceTo(wheelCenter);
  const flyLowerReach = mappedFlyLowerEnd.distanceTo(wheelCenter);
  const flyRadius = (flyUpperReach + flyLowerReach) / 2;
  const flyBladeThickness = 0.07;
  const flyBladeDepth = 0.42;
  const flyBar = new THREE.Mesh(
    plate(polygonClipping.union(
      poly([[-flyRadius, -flyBladeThickness / 2], [flyRadius, -flyBladeThickness / 2],
        [flyRadius, flyBladeThickness / 2], [-flyRadius, flyBladeThickness / 2]]),
      poly(circle([0, 0], 0.13, 48)),
    ), -flyBladeDepth / 2, flyBladeDepth / 2),
    frameMaterial,
  );
  flyBar.userData.role = 'long-plain-fly-blade-edge-on';
  flyRotor.add(flyBar);
  const flyVanes = [];
  const flyPhaseWitness = new THREE.Object3D();
  flyPhaseWitness.position.set(flyRadius, 0, 0);
  flyPhaseWitness.userData.role = 'fly-blade-tip-locus';
  flyRotor.add(flyPhaseWitness);

  const makeGravityArm = (side) => {
    const isRight = side > 0;
    const sideName = isRight ? 'right-D-front-ABC' : 'left-E-rear-abc';
    const material = isRight ? frontSystemMaterial : rearSystemMaterial;
    const group = new THREE.Group();
    const pivot = palletPivot(side);
    const planeZ = isRight ? rightPalletPlaneZ : leftPalletPlaneZ;
    group.position.set(pivot.x, pivot.y, planeZ);
    group.userData.axis = Z_AXIS.clone();
    group.userData.lockingWheel = wheelForSide(side);
    group.userData.side = side;
    group.userData.role = `${sideName}-between-wheels-gravity-arm`;
    root.add(group);

    // Brown's plate: each pallet is one flat piece of straight arms, pivot
    // to its corner stop and on to its lower pendulum pin, with an inner
    // arm from the corner to the lifting pins. All are laid out at the
    // cocked pose; the swept cut then shapes the pin face and the stop.
    const stopLetter = isRight ? 'D' : 'E';
    const lockAngle = lockAngleForSide(side);
    const toLocal = (point) => palletLocalPoint(side, point,
      cockedMagnitude);
    const cornerWorld = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(lockAngle) * palletCornerRadius,
      Math.sin(lockAngle) * palletCornerRadius,
    ));
    const pivotLocal = new THREE.Vector2(0, 0);
    const cornerLocal = toLocal(cornerWorld);
    const beatLocal = beatPinLocalPoint(side);
    const padInnerWorld = new THREE.Vector2(side * 0.02,
      wheelCenter.y);
    const padOuterWorld = new THREE.Vector2(side * 0.52,
      wheelCenter.y);
    const padHalfHeight = 0.24;
    const liftPadLocal = [
      new THREE.Vector2(padInnerWorld.x, wheelCenter.y - padHalfHeight),
      new THREE.Vector2(padOuterWorld.x, wheelCenter.y - padHalfHeight),
      new THREE.Vector2(padOuterWorld.x, wheelCenter.y + padHalfHeight),
      new THREE.Vector2(padInnerWorld.x, wheelCenter.y + padHalfHeight),
    ].map(toLocal);
    const innerArmEndLocal = toLocal(new THREE.Vector2(side * 0.44,
      wheelCenter.y + 0.08));
    const palletPlateHalfDepth = 0.06;
    const palletPlate = plateRegistry.add({
      key: `${isRight ? 'right' : 'left'}-diamond-pallet`,
      material,
      owner: group,
      primitives: [
        plateBand(pivotLocal, cornerLocal, 0.15),
        plateBand(cornerLocal, beatLocal, 0.15),
        plateBand(cornerLocal, innerArmEndLocal, 0.13),
        plateDisc(pivotLocal, 0.165),
        plateDisc(cornerLocal, 0.13),
        plateDisc(beatLocal, 0.14),
        platePolygon(liftPadLocal),
      ],
      role: `${sideName}-planar-diamond-pallet`,
      z0: -palletPlateHalfDepth,
      z1: palletPlateHalfDepth,
    });

    const lockingWheelPlaneZ = isRight ? frontWheelPlaneZ : rearWheelPlaneZ;
    const stopInnerZ = lockingWheelPlaneZ - side * lockingWheelDepth / 2
      - side * 0.04 - planeZ;
    const stopOuterZ = lockingWheelPlaneZ + side * lockingWheelDepth / 2
      - planeZ;
    const sectorLocal = (innerRadius, outerRadius, startAngle, endAngle) => {
      const polygon = plateSector(wheelCenter, innerRadius, outerRadius,
        startAngle, endAngle);
      return platePolygon(polygon.points.map(([x, y]) => toLocal(
        new THREE.Vector2(x, y),
      )));
    };
    const stopStartAngle = lockAngle - THREE.MathUtils.degToRad(3);
    const stopEndAngle = lockAngle + THREE.MathUtils.degToRad(9);
    const stopStemPlate = plateRegistry.add({
      key: `${isRight ? 'right' : 'left'}-stop-${stopLetter}-stem`,
      material: darkMaterial,
      owner: group,
      primitives: [
        sectorLocal(lockingLegRadius + 0.10, lockingLegRadius + 0.30,
          stopStartAngle, stopEndAngle),
        plateDisc(cornerLocal, 0.10),
      ],
      role: `${sideName}-axial-stop-${stopLetter}-stem`,
      z0: Math.min(side * palletPlateHalfDepth, stopInnerZ),
      z1: Math.max(side * palletPlateHalfDepth, stopInnerZ),
    });
    const stopStem = plateRegistry.add({
      key: `${isRight ? 'right' : 'left'}-stop-${stopLetter}`,
      // Steel: a white stop face would read as a hole on the cream page.
      material: stopFaceMaterial,
      owner: group,
      primitives: [
        sectorLocal(lockingLegRadius - 0.12, lockingLegRadius + 0.30,
          stopStartAngle, stopEndAngle),
      ],
      role: `${sideName}-exclusive-locking-stop-${stopLetter}-face`,
      z0: Math.min(stopInnerZ, stopOuterZ),
      z1: Math.max(stopInnerZ, stopOuterZ),
    });

    const liftFacePoints = Array.from({ length: 49 }, (_, index) => (
      liftFaceLocalPointAt(side, smootherStep(index / 48))
    ));
    const lockFacePoints = Array.from({ length: 21 }, (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        cockedMagnitude,
        releaseMagnitude,
        index / 20,
      );
      return lockFaceLocalPointAt(side, magnitude);
    });

    const beatPoint = beatPinLocalPoint(side);
    const beatTargetLocalZ = pendulumPlaneZ - planeZ;
    // Set into the arm (ending inside its back face) and reaching just past
    // the rod's front face.
    const beatPinNearZ = -(palletPlateHalfDepth - 0.02);
    const beatPinFarZ = beatTargetLocalZ + 0.11;
    const beatPin = cylinderAlongZ(
      beatPinRadius,
      beatPinFarZ - beatPinNearZ,
      darkMaterial,
      24,
    );
    beatPin.position.set(
      beatPoint.x,
      beatPoint.y,
      (beatPinNearZ + beatPinFarZ) / 2,
    );
    beatPin.userData.role = `${sideName}-pendulum-impulse-pin`;
    group.add(beatPin);
    const beatPinWitness = new THREE.Mesh(
      new THREE.SphereGeometry(0.050, 14, 10),
      markerMaterial,
    );
    beatPinWitness.position.set(
      beatPoint.x,
      beatPoint.y,
      beatTargetLocalZ + 0.08,
    );
    beatPinWitness.userData.role = `${sideName}-beat-pin-tip-witness`;
    group.add(beatPinWitness);

    const arborRearZ = backFrameZ - 0.10 - planeZ;
    const arborHub = cylinderAlongZ(0.070,
      palletPlateHalfDepth + 0.02 - arborRearZ, darkMaterial, 24);
    arborHub.position.z = (palletPlateHalfDepth + 0.02 + arborRearZ) / 2;
    arborHub.userData.role = `${sideName}-pallet-arbor`;
    group.add(arborHub);

    return {
      arborHub,
      beatPin,
      beatPinWitness,
      cornerLocal,
      group,
      liftFacePoints,
      lockFacePoints,
      palletPlate,
      stopStem,
      stopStemPlate,
    };
  };
  const palletCornerRadius = lockingLegRadius + 0.15;
  const leftGravityArm = makeGravityArm(-1);
  const rightGravityArm = makeGravityArm(1);

  const pendulumAssembly = new THREE.Group();
  pendulumAssembly.position.set(
    pendulumPivot.x,
    pendulumPivot.y,
    pendulumPlaneZ,
  );
  pendulumAssembly.userData.axis = Z_AXIS.clone();
  pendulumAssembly.userData.role =
    'pendulum-in-front-of-both-wheels-and-both-gravity-arms';
  root.add(pendulumAssembly);
  const pendulumLength = pendulumPivot.y - beatPinWorldY + 1.10;
  // The rod and its eye are one flat plate: a round boss bored for the
  // suspension stud, with the rod leaving it tangentially downward (the
  // rod's square end used to poke into a separate ring).
  const pendulumBossRadius = 0.25;
  const bossJoinAngle = Math.asin(pendulumRodRadius / pendulumBossRadius);
  const pendulumTopShape = new THREE.Shape();
  pendulumTopShape.moveTo(pendulumRodRadius, -pendulumLength);
  pendulumTopShape.lineTo(pendulumRodRadius,
    -pendulumBossRadius * Math.cos(bossJoinAngle));
  pendulumTopShape.absarc(0, 0, pendulumBossRadius,
    -Math.PI / 2 + bossJoinAngle, 3 * Math.PI / 2 - bossJoinAngle, false);
  pendulumTopShape.lineTo(-pendulumRodRadius, -pendulumLength);
  pendulumTopShape.lineTo(pendulumRodRadius, -pendulumLength);
  const pendulumBore = new THREE.Path();
  pendulumBore.absarc(0, 0, 0.138, 0, FULL_TURN, true);
  pendulumTopShape.holes.push(pendulumBore);
  const pendulumRodGeometry = new THREE.ExtrudeGeometry(pendulumTopShape, {
    bevelEnabled: false,
    curveSegments: 40,
    depth: 0.16,
    steps: 1,
  });
  pendulumRodGeometry.translate(0, 0, -0.08);
  const pendulumRod = new THREE.Mesh(pendulumRodGeometry, pendulumMaterial);
  pendulumRod.userData.role = 'double-gravity-escapement-pendulum-rod';
  pendulumAssembly.add(pendulumRod);
  const pendulumPivotEye = pendulumRod;
  const pendulumBob = cylinderAlongZ(0.46, 0.23,
    pendulumMaterial, 44);
  pendulumBob.position.set(0, -pendulumLength + 0.18, 0);
  pendulumBob.scale.y = 1.16;
  pendulumBob.userData.role = 'pendulum-bob';
  pendulumAssembly.add(pendulumBob);

  const beatContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.062, 16, 12),
    markerMaterial,
  );
  beatContactMarker.userData.role =
    'live-gravity-arm-to-pendulum-contact';
  root.add(beatContactMarker);
  const wheelLiftMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 16, 12),
    markerMaterial,
  );
  wheelLiftMarker.userData.role =
    'live-shared-pin-to-between-wheels-arm-contact';
  root.add(wheelLiftMarker);
  const lockMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.060, 16, 12),
    markerMaterial,
  );
  lockMarker.userData.role =
    'live-front-D-or-rear-E-exclusive-lock-contact';
  root.add(lockMarker);
  // Contact loci sit inside the working parts; they stay positioned for
  // diagnostics but never render.
  for (const marker of [beatContactMarker, wheelLiftMarker, lockMarker]) {
    marker.visible = false;
    marker.userData.diagnosticOnly = true;
  }

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.wheelAngle;
    flyRotor.rotation.z = state.flyAngle;
    leftGravityArm.group.rotation.z = state.leftPalletAngle;
    rightGravityArm.group.rotation.z = state.rightPalletAngle;
    pendulumAssembly.rotation.z = state.pendulumAngle;

    beatContactMarker.position.set(
      state.beatContactPoint.x,
      state.beatContactPoint.y,
      pendulumPlaneZ + 0.10,
    );
    beatContactMarker.userData.active = true;
    beatContactMarker.userData.contactError = state.beatContactError;
    beatContactMarker.userData.contactSide = state.beatContactSide;
    beatContactMarker.userData.gravityImpulseActive =
      state.effectiveGravityImpulseActive;

    wheelLiftMarker.userData.active = state.wheelStepActive;
    if (state.activeLiftPoint) {
      wheelLiftMarker.position.set(
        state.activeLiftPoint.x,
        state.activeLiftPoint.y,
        state.activeLiftSide === 'right'
          ? rightPalletPlaneZ
          : leftPalletPlaneZ,
      );
    }
    wheelLiftMarker.userData.contactError = state.liftContactError;
    wheelLiftMarker.userData.contactSide = state.activeLiftSide;
    wheelLiftMarker.userData.pinIndex = state.activeLiftPinIndex;

    lockMarker.userData.active = state.wheelLocked;
    if (state.activeLockPoint) {
      lockMarker.position.set(
        state.activeLockPoint.x,
        state.activeLockPoint.y,
        state.activeLockWheel === 'front-ABC'
          ? frontWheelPlaneZ
          : rearWheelPlaneZ,
      );
    }
    lockMarker.userData.contactError = state.lockContactError;
    lockMarker.userData.contactSide = state.activeLockSide;
    lockMarker.userData.legIndex = state.activeLockLegIndex;
    lockMarker.userData.lockingWheel = state.activeLockWheel;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    beatContactMarker,
    escapeWheelAssembly,
    fixedFrame,
    flyBar,
    flyPhaseWitness,
    flyRotor,
    flyVanes,
    frameBearings,
    frontWheelABC,
    leftGravityArm,
    liftingPinMeshes,
    lockMarker,
    palletHangers,
    pendulumAssembly,
    pendulumBob,
    pendulumPivotEye,
    pendulumRod,
    rearWheelabc,
    rightGravityArm,
    topCrossbar,
    wheelBearingBracket,
    wheelLiftMarker,
    wheelRotor,
    wheelShaft,
  };
  root.userData.sweptPlates = plateRegistry.plates;
  root.userData.sweptPlateInputHash = plateRegistry.bakeInputHash;
  root.userData.engagementContacts = (state) => {
    const lockWheelZ = state.activeLockWheel === 'front-ABC'
      ? frontWheelPlaneZ
      : rearWheelPlaneZ;
    return {
      advanceSign: 1,
      contacts: {
        lock: state.wheelLocked ? {
          point: state.activeLockPoint,
          radius: 0.075 - 0.022,
          z: [lockWheelZ - lockingWheelDepth / 2,
            lockWheelZ + lockingWheelDepth / 2],
        } : null,
        lift: state.wheelStepActive ? {
          point: state.activeLiftPoint,
          radius: 0.071,
          z: [rearWheelPlaneZ, frontWheelPlaneZ],
        } : null,
      },
    };
  };
  // Brown's elevation ends just below the impulse pins; the pendulum bob
  // hangs below that crop. A narrow lens keeps the view near-orthographic.
  root.userData.cameraDistanceScale = 1.18;
  root.userData.cameraFov = 12;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.8, -4.15, -1.18),
    new THREE.Vector3(2.8, pendulumPivot.y + 0.62, 1.30),
  );
  root.userData.effectiveCenterOfMassAt = effectiveCenterOfMassAt;
  root.userData.fidelity = 'authored';
  root.userData.fixedLockPointForSide = fixedLockPointForSide;
  root.userData.geometry = {
    beatContactClearance,
    beatPinLocalX,
    beatPinLocalY,
    beatPinRadius,
    beatPinWorldX,
    beatPinWorldY,
    cockedMagnitude,
    fallenMagnitude,
    firstWheelStepEndPhase,
    frontWheelPlaneZ,
    leftEffectiveImpulseStartPhase,
    leftLockAngle,
    leftPalletPlaneZ,
    leftPickupPhase,
    leftUnlockPhase,
    liftingPinPhaseOffset,
    liftingPinRadius,
    lockingLegPitch,
    lockingLegRadius,
    lockingWheelDepth,
    mappedFlyLowerEnd,
    mappedFlyUpperEnd,
    mappedFrontLegTipsABC,
    mappedLeftBeatPin,
    mappedLeftPalletArbor,
    mappedLeftStopE,
    mappedLiftingPins,
    mappedPendulumSuspension,
    mappedRearLegTipsabc,
    mappedRightBeatPin,
    mappedRightPalletArbor,
    mappedRightStopD,
    maximumLiftMagnitude,
    meanSourceLockingRadius,
    measuredLiftingPinRadius,
    netGravityPotentialDrop,
    palletPivotX,
    palletPivotY,
    pendulumAmplitude,
    pendulumPeriod,
    pendulumPivot: pendulumPivot.clone(),
    pendulumPlaneZ,
    pendulumRodRadius,
    pickupAngle,
    rearWheelPhaseOffset,
    rearWheelPlaneZ,
    releaseMagnitude,
    rightEffectiveImpulseStartPhase,
    rightLockAngle,
    rightPalletPlaneZ,
    rightPickupPhase,
    rightUnlockPhase,
    secondWheelStepEndPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    standardGravity,
    unlockAngle,
    weightedArmMass,
    wheelAdvancePerBeat,
    wheelAdvancePerCycle,
    wheelCenter: wheelCenter.clone(),
  };
  root.userData.gravityPotentialAt = gravityPotentialAt;
  root.userData.liftFaceLocalPointAt = liftFaceLocalPointAt;
  root.userData.liftingPinAt = liftingPinAt;
  root.userData.lockFaceLocalPointAt = lockFaceLocalPointAt;
  root.userData.lockingLegTipAt = lockingLegTipAt;
  root.userData.mechanism = 'Denison’s double three-legged gravity escapement: rigid front wheel ABC and rear wheel abc each carry three long locking legs and are offset by 60 degrees. Two gravity arms lie between them; right stop D can lock only front ABC, left stop E can lock only rear abc, while one shared set of three axial pins alternately cocks the opposite arm before its fixed gravity fall impulses the pendulum.';
  root.userData.palletMagnitudeAt = palletMagnitudeAt;
  root.userData.palletWorldPoint = palletWorldPoint;
  root.userData.presentation = 'front-oblique reconstruction of Brown’s six interleaved locking legs, visibly separated front ABC and rear abc wheel planes, two planar straight-armed diamond pallets between those planes, three shared lifting pins, the pendulum in front, and the long friction fly behind';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 311 page marks Animated unavailable; the complete operating sequence is reconstructed from Brown’s plate and published descriptions of Denison’s double three-legged escapement.',
    referenceScope: 'Brown fixes two named locking wheels ABC/abc, one lifting-pin set between them, pallets between the wheel planes, and exclusive D/E stops. Beckett and the Encyclopaedia Britannica fix the 60-degree wheel offset and step, common arbor, alternating exclusive locks, gravity fall, and friction fly.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    awciSingleDoubleComparison: {
      article: 'A Gravity Escapement',
      operatingEvidence: 'Adding the second three-legged member behind the first while retaining the same three lifting pins changes the released angle from 120 degrees to 60 degrees and adds back-side stopping blocks.',
      publication: 'Horological Times',
      publicationYear: 1979,
      url: 'https://www.awci.com/wp-content/uploads/ht/1979/1979-05-web.pdf',
    },
    britannicaConstructionReference: {
      figure: 20,
      operatingEvidence: 'Two wheels ABC and abc surround three lifting pins and the two pallets like a lantern pinion. One stop points forward and the other backward; the wheels are normally intermediately set 60 degrees apart.',
      page: 545,
      publication: 'Encyclopaedia Britannica, Volume 6',
      publicationEdition: 11,
      publicationYear: 1911,
      url: 'https://www.gutenberg.org/files/31793/31793-h/31793-h.htm',
    },
    goodrichLayoutReference: {
      figures: [47, 48],
      layoutEvidence: 'The two pallets act between the wheels, the three-leaved lifting member lies between the three-armed wheel sides, and the two stop radii are laid out 120 degrees apart.',
      page: 153,
      publication: 'The Modern Clock',
      publicationYear: 1905,
      url: 'https://www.gutenberg.org/files/61494/61494-h/61494-h.htm',
    },
    officialDescription: movement.description,
    plate311: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'two coaxial three-legged wheels offset by one 60-degree half-pitch; one set of three axial lifting pins and both independent triangular gravity arms lie between the wheel planes; D reaches only ABC and E reaches only abc',
      measurementUncertaintyPixels: 8,
      officialAnimationAvailable: false,
      rasterFlyLowerEnd: sourceRasterFlyLowerEnd.clone(),
      rasterFlyUpperEnd: sourceRasterFlyUpperEnd.clone(),
      rasterFrontLegTipsABC: sourceRasterFrontLegTipsABC.map(
        (point) => point.clone(),
      ),
      rasterLeftBeatPin: sourceRasterLeftBeatPin.clone(),
      rasterLeftPalletArbor: sourceRasterLeftPalletArbor.clone(),
      rasterLeftStopE: sourceRasterLeftStopE.clone(),
      rasterLiftingPins: sourceRasterLiftingPins.map((point) => point.clone()),
      rasterPendulumSuspension: sourceRasterPendulumSuspension.clone(),
      rasterRearLegTipsabc: sourceRasterRearLegTipsabc.map(
        (point) => point.clone(),
      ),
      rasterRightBeatPin: sourceRasterRightBeatPin.clone(),
      rasterRightPalletArbor: sourceRasterRightPalletArbor.clone(),
      rasterRightStopD: sourceRasterRightStopD.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      symmetryReconstruction: 'paired pallet arbors and lower beat pins are averaged, while the measured front/rear wheel separation is represented axially rather than flattened as in the engraving',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
    trinityOperatingReference: {
      operatingEvidence: 'Each colored wheel can strike only the matching arm’s locking block. Three black lifting pins raise the gravity arms, whose equal fixed descents deliver the pendulum impulse; excess train energy is dissipated by the fly.',
      institution: 'Trinity College Cambridge',
      url: 'https://clock.trin.cam.ac.uk/main.php?menu_option=escapement',
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'right-gravity-arm-falls-with-pendulum',
      'left-arm-lifts-and-releases-rear-abc-at-E',
      'assembly-turns-60-degrees-and-shared-pin-cocks-right-arm',
      'front-ABC-locks-exclusively-at-right-D',
      'left-gravity-arm-falls-with-pendulum',
      'right-arm-lifts-and-releases-front-ABC-at-D',
      'assembly-turns-60-degrees-and-shared-pin-cocks-left-arm',
      'rear-abc-locks-exclusively-at-left-E',
    ],
  };
  root.userData.transmission = {
    direction: 'counterclockwise in Brown’s front elevation',
    effectiveCombinedLockingPitchRadians: FULL_TURN / 6,
    effectiveImpulseArc: 'each weighted arm supplies its net gravity impulse while the pendulum traverses from 1.2 degrees on one side to 1.2 degrees on the other',
    equalImpulseEnergyPerSide: netGravityPotentialDrop,
    flyCoupling: 'the friction-spring fly shares the common escape arbor and follows both rigid locking wheels at the same angular rate',
    gravityIsolation: 'the train raises alternate arms through the three shared inner pins; each pendulum impulse comes from one fixed arm mass and fall',
    impulsesPerPendulumCycle: 2,
    impulsesPerVibration: [1, 1],
    liftingPinSets: 1,
    liftingPins: 3,
    locking: {
      leftE: 'rear wheel abc only',
      rightD: 'front wheel ABC only',
    },
    lockingWheels: 2,
    stepsPerPendulumCycle: 2,
    wheelAdvancePerBeatDegrees: 60,
    wheelAdvancePerBeatRadians: wheelAdvancePerBeat,
    wheelAdvancePerCycleRadians: wheelAdvancePerCycle,
    wheelCyclesPerRevolution: 3,
    wheelPhaseOffsetDegrees: 60,
    wheelPhaseOffsetRadians: rearWheelPhaseOffset,
  };
  root.userData.wheelAngleAtCycleStart = wheelAngleAtCycleStart;
  root.userData.wheelForSide = wheelForSide;

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
  for (const object of [
    beatContactMarker,
    flyPhaseWitness,
    frontWheelABC.phaseWitness,
    lockMarker,
    rearWheelabc.phaseWitness,
    wheelLiftMarker,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(0.6, 0.35, 13.2),
    root,
    update,
  };
}

function bloxamGravityEscapement(movement) {
  const root = new THREE.Group();

  // Brown's plate is a schematic front elevation.  The working proportions
  // below come from Bloxam's own full-size dimensions (Memoirs RAS XXII,
  // pp. 143-145): the arm and wheel axes are 3 in apart, the escape-wheel
  // diameter is 2.05 in, and the pallet-wheel primitive diameter is 0.2 in.
  // A scale of two model units per inch keeps the historically tiny inner
  // wheel visible without changing either radius ratio.
  const modelUnitsPerInch = 2;
  const armAxisDistanceInches = 3;
  const escapeWheelDiameterInches = 2.05;
  const palletWheelPrimitiveDiameterInches = 0.2;
  const detentArmLengthInches = 2.82;
  const wheelCenter = new THREE.Vector2(0, 0.15);
  const armAxisDistance = armAxisDistanceInches * modelUnitsPerInch;
  const armPivot = new THREE.Vector2(
    wheelCenter.x,
    wheelCenter.y + armAxisDistance,
  );
  const historicalEscapeWheelRadius = escapeWheelDiameterInches
    * modelUnitsPerInch / 2;
  const palletWheelPrimitiveRadius = palletWheelPrimitiveDiameterInches
    * modelUnitsPerInch / 2;

  // Nine outer teeth alternate between A and B, so a 20-degree half-pitch
  // separates successive locks.  Choosing the locking radius from the exact
  // 20-degree tangent construction gives a 2.819 in detent arm, which rounds
  // to Bloxam's published 2.82 in while retaining his published 2.05 in
  // wheel diameter for the wheel body.
  const toothCount = 9;
  const toothPitch = FULL_TURN / toothCount;
  const wheelAdvancePerBeat = toothPitch / 2;
  const wheelAdvancePerCycle = toothPitch;
  const rightLockAngle = wheelAdvancePerBeat;
  const leftLockAngle = Math.PI - wheelAdvancePerBeat;
  const lockingRadius = armAxisDistance * Math.sin(rightLockAngle);
  const constructedDetentArmLength = armAxisDistance
    * Math.cos(rightLockAngle);
  const publishedDetentArmLength = detentArmLengthInches
    * modelUnitsPerInch;
  const tangentLengthRoundingError = publishedDetentArmLength
    - constructedDetentArmLength;
  const outerToothFaceSlope = THREE.MathUtils.degToRad(2);
  const detentFaceSlope = THREE.MathUtils.degToRad(8);
  // Brown's arrow (above the arbor, pointing right) turns both wheels
  // clockwise, so every wheel angle below advances by wheelSpin = -1. The
  // left arm A is therefore lifted from the bottom of the small wheel (under
  // the arbor, where Brown's band runs) and the right arm B from its top
  // (where B's hook returns); each is still pushed outward, away from the
  // pendulum.
  const wheelSpin = -1;
  // The small wheel's acting faces trail its large teeth by 10 degrees.
  const palletWheelFacePhaseOffset = -wheelSpin * THREE.MathUtils.degToRad(10);

  const pendulumPeriod = 4;
  const arcMinute = THREE.MathUtils.degToRad(1 / 60);
  const pendulumAmplitude = 100 * arcMinute;
  const pickupAngle = 20 * arcMinute;
  const unlockAngle = 40 * arcMinute;
  const maximumDocumentedUnlockAngle = 45 * arcMinute;
  const rightCockedAngle = pickupAngle;
  const rightFallenAngle = -pickupAngle;
  const leftCockedAngle = -pickupAngle;
  const leftFallenAngle = pickupAngle;
  const nominalArmLift = 40 * arcMinute;
  const pendulumRodRadius = 0.060;
  const forkPinRadius = 0.085;
  const forkContactClearance = pendulumRodRadius + forkPinRadius;
  // Brown's fork pins: E on the left band just under the arbor, F on the
  // right arm's returned hook just above it. Both still face the pendulum
  // rod from either side; the rod and the arms share the axis C, so the pin
  // heights along the rod do not change the beat timing.
  const forkPinLengthE = armAxisDistance + 0.45;
  const forkPinLengthF = armAxisDistance - 0.50;
  const forkPinLength = forkPinLengthE;
  const forkPinLengthForSide = (side) => (side > 0 ? forkPinLengthF : forkPinLengthE);
  const outerWheelPlaneZ = -0.30;
  const palletWheelPlaneZ = 0.28;
  const leftArmPlaneZ = -0.055;
  const rightArmPlaneZ = 0.055;
  // Brown dashes the pendulum behind the wheels, but fork pieces E and F sit
  // 0.48 and 0.59 from the arbor, inside the large wheel's spokes (0.19 to
  // 1.62), so anything reaching a pendulum behind that wheel would cross its
  // turning spokes. Between the wheels the rod would cross the common arbor
  // (the rod swings at most 0.18 either side of it). The rod therefore hangs
  // just in front of the arbor's front end and is drawn see-through, so the
  // small wheel and pallets read through it as they do on the plate.
  const outerWheelDepth = 0.20;
  const palletWheelDepth = 0.18;
  const pendulumRodHalfDepth = 0.07;
  const pendulumPlaneZ = palletWheelPlaneZ + palletWheelDepth / 2 + 0.05
    + 0.02 + pendulumRodHalfDepth;

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(260, 378);
  const sourceRasterWheelBottom = new THREE.Vector2(260, 520);
  const sourceRasterArmPivotC = new THREE.Vector2(258, 23);
  const sourceRasterLeftStopA = new THREE.Vector2(132, 320);
  const sourceRasterRightStopB = new THREE.Vector2(399, 357);
  const sourceRasterLeftForkPinE = new THREE.Vector2(215, 428);
  const sourceRasterRightForkPinF = new THREE.Vector2(278, 352);
  const sourceWheelRadius = sourceRasterWheelCenter.distanceTo(
    sourceRasterWheelBottom,
  );
  const sourceScale = historicalEscapeWheelRadius / sourceWheelRadius;
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    wheelCenter.x + (x - sourceRasterWheelCenter.x) * sourceScale,
    wheelCenter.y + (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const mappedArmPivotC = sourcePointToModel(sourceRasterArmPivotC);
  const mappedLeftStopA = sourcePointToModel(sourceRasterLeftStopA);
  const mappedRightStopB = sourcePointToModel(sourceRasterRightStopB);
  const mappedLeftForkPinE = sourcePointToModel(sourceRasterLeftForkPinE);
  const mappedRightForkPinF = sourcePointToModel(sourceRasterRightForkPinF);

  const pendulumMotionAtPhase = (cyclePhase) => {
    const argument = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / pendulumPeriod;
    return {
      acceleration: -pendulumAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angle: pendulumAmplitude * Math.cos(argument),
      speed: -pendulumAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };
  const rightEffectiveImpulseStartPhase = Math.acos(
    pickupAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const leftPickupPhase = Math.acos(
    -pickupAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const leftUnlockPhase = Math.acos(
    -unlockAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const firstWheelStepEndPhase = 0.42;
  const leftEffectiveImpulseStartPhase = 1 - leftPickupPhase;
  const rightPickupPhase = 1 - rightEffectiveImpulseStartPhase;
  const rightUnlockPhase = 1 - Math.acos(
    unlockAngle / pendulumAmplitude,
  ) / FULL_TURN;
  const secondWheelStepEndPhase = 0.92;
  const phaseBoundaryEpsilon = 1e-12;

  const armAngleAtLiftProgress = (side, progress) => (
    side > 0
      ? THREE.MathUtils.lerp(
        rightFallenAngle,
        rightCockedAngle,
        progress,
      )
      : THREE.MathUtils.lerp(
        leftFallenAngle,
        leftCockedAngle,
        progress,
      )
  );
  const palletFaceLocalAngle = (side) => -Math.PI / 2
    - (side > 0 ? rightFallenAngle : leftFallenAngle);
  const cross2 = (first, second) => first.x * second.y
    - first.y * second.x;
  const canonicalPalletToothAngle = (side, progress) => wheelSpin * ((
    side > 0 ? -Math.PI / 2 : Math.PI / 2
  ) + wheelAdvancePerBeat * progress);

  // Bloxam specifies plane pallet faces radiating from the arm axes and
  // curved portions on the nine small teeth.  Intersecting those two rays
  // gives the actual rolling contact.  The small radial variation is the
  // curved tooth flank; it also lets both arms receive the nominal 40-minute
  // lift despite the top/bottom asymmetry that Bloxam describes.
  const palletContactAt = (side, progress) => {
    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const calculationProgress = Math.max(clampedProgress, 1e-7);
    const calculationToothAngle = canonicalPalletToothAngle(
      side,
      calculationProgress,
    );
    const calculationArmAngle = armAngleAtLiftProgress(
      side,
      calculationProgress,
    );
    const faceAngle = palletFaceLocalAngle(side) + calculationArmAngle;
    const toothDirection = new THREE.Vector2(
      Math.cos(calculationToothAngle),
      Math.sin(calculationToothAngle),
    );
    const faceDirection = new THREE.Vector2(
      Math.cos(faceAngle),
      Math.sin(faceAngle),
    );
    const pivotFromWheel = armPivot.clone().sub(wheelCenter);
    const denominator = cross2(toothDirection, faceDirection);
    const contactRadius = cross2(pivotFromWheel, faceDirection)
      / denominator;
    const toothAngle = canonicalPalletToothAngle(side, clampedProgress);
    const point = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(toothAngle) * contactRadius,
      Math.sin(toothAngle) * contactRadius,
    ));
    return {
      armAngle: armAngleAtLiftProgress(side, clampedProgress),
      contactRadius,
      point,
      progress: clampedProgress,
      toothAngle,
    };
  };
  const primitivePointAt = (side, progress) => {
    const angle = canonicalPalletToothAngle(side, progress);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * palletWheelPrimitiveRadius,
      Math.sin(angle) * palletWheelPrimitiveRadius,
    ));
  };
  const primitiveLiftForSide = (side) => {
    const start = primitivePointAt(side, 0).sub(armPivot);
    const finish = primitivePointAt(side, 1).sub(armPivot);
    let delta = Math.atan2(finish.y, finish.x)
      - Math.atan2(start.y, start.x);
    while (delta > Math.PI) delta -= FULL_TURN;
    while (delta < -Math.PI) delta += FULL_TURN;
    return delta;
  };
  const primitiveRightLift = primitiveLiftForSide(1);
  const primitiveLeftLift = primitiveLiftForSide(-1);

  const armLocalPoint = (worldPoint, armAngle) => rotate2(
    worldPoint.clone().sub(armPivot),
    -armAngle,
  );
  const armWorldPoint = (localPoint, armAngle) => armPivot.clone().add(
    rotate2(localPoint, armAngle),
  );
  const palletFaceLocalPointAt = (side, progress) => {
    const contact = palletContactAt(side, progress);
    return armLocalPoint(contact.point, contact.armAngle);
  };
  const forkPinLocalPoint = (side) => new THREE.Vector2(
    side * forkContactClearance,
    -forkPinLengthForSide(side),
  );
  const forkPinCenterAt = (side, armAngle) => armWorldPoint(
    forkPinLocalPoint(side),
    armAngle,
  );
  const fixedLockPointForSide = (side) => {
    const angle = side > 0 ? rightLockAngle : leftLockAngle;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * lockingRadius,
      Math.sin(angle) * lockingRadius,
    ));
  };
  const outerToothTipAt = (wheelAngle, toothIndex) => {
    const angle = wheelAngle + toothIndex * toothPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * lockingRadius,
      Math.sin(angle) * lockingRadius,
    ));
  };
  const palletWheelToothPointAt = (
    wheelAngle,
    toothIndex,
    contactRadius,
  ) => {
    const angle = wheelAngle + palletWheelFacePhaseOffset
      + toothIndex * toothPitch;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * contactRadius,
      Math.sin(angle) * contactRadius,
    ));
  };
  const lockFaceLocalPointAt = (side, armAngle) => armLocalPoint(
    fixedLockPointForSide(side),
    armAngle,
  );

  const effectiveCenterOfMassLocal = (side) => new THREE.Vector2(
    side * 0.92,
    -4.98,
  );
  const gravityArmMass = 1;
  const standardGravity = 9.80665;
  const gravityPotentialAt = (side, armAngle) => gravityArmMass
    * standardGravity
    * armWorldPoint(effectiveCenterOfMassLocal(side), armAngle).y;
  const rightGravityPotentialDrop = gravityPotentialAt(
    1,
    rightCockedAngle,
  ) - gravityPotentialAt(1, rightFallenAngle);
  const leftGravityPotentialDrop = gravityPotentialAt(
    -1,
    leftCockedAngle,
  ) - gravityPotentialAt(-1, leftFallenAngle);

  const wheelAngleAtCycleStart = (cycleIndex) => (
    wheelSpin * cycleIndex * wheelAdvancePerCycle
  );
  // The tooth whose angle, with the wheel at wheelAngle, is targetAngle.
  const toothIndexAt = (targetAngle, wheelAngle, faceOffset = 0) => (
    positiveModulo(Math.round(
      (targetAngle - wheelAngle - faceOffset) / toothPitch,
    ), toothCount)
  );
  const rawStateAtTime = (time) => {
    const cycleCoordinate = time / pendulumPeriod;
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const pendulum = pendulumMotionAtPhase(cyclePhase);
    const cycleStartAngle = wheelAngleAtCycleStart(cycleIndex);
    const halfStepAngle = cycleStartAngle + wheelSpin * wheelAdvancePerBeat;
    const fullStepAngle = cycleStartAngle + wheelSpin * wheelAdvancePerCycle;
    const startingLeftOuterToothIndex = toothIndexAt(
      leftLockAngle,
      cycleStartAngle,
    );
    const rightLandingOuterToothIndex = toothIndexAt(
      rightLockAngle,
      halfStepAngle,
    );
    const leftLandingOuterToothIndex = toothIndexAt(
      leftLockAngle,
      fullStepAngle,
    );
    const startingLeftInnerToothIndex = toothIndexAt(
      canonicalPalletToothAngle(-1, 1),
      cycleStartAngle,
      palletWheelFacePhaseOffset,
    );
    const rightLiftInnerToothIndex = toothIndexAt(
      canonicalPalletToothAngle(1, 0),
      cycleStartAngle,
      palletWheelFacePhaseOffset,
    );
    const leftLiftInnerToothIndex = toothIndexAt(
      canonicalPalletToothAngle(-1, 0),
      halfStepAngle,
      palletWheelFacePhaseOffset,
    );

    let activeInnerContactSide = 'left';
    let activeInnerToothIndex = startingLeftInnerToothIndex;
    let activeLockSide = 'left';
    let activeLockToothIndex = startingLeftOuterToothIndex;
    let beatContactSide = 'right';
    let effectiveGravityImpulseActive = false;
    let gravityDescentSide = 'right';
    let innerContactMode = 'left-A-rests-on-pallet-wheel';
    let innerContactProgress = 1;
    let leftArmAngle = leftCockedAngle;
    let mode = 'left-A-outer-stop-and-inner-pallet-hold-both-wheels';
    let pendulumRaisedArmSide = null;
    let rightArmAngle = pendulum.angle;
    let trainCoupledToPendulum = false;
    let trainRaisingArmSide = null;
    let wheelAdvance = 0;
    let wheelStepActive = false;

    if (cyclePhase < leftPickupPhase - phaseBoundaryEpsilon) {
      if (cyclePhase >= rightEffectiveImpulseStartPhase) {
        effectiveGravityImpulseActive = true;
        mode = 'right-B-gravity-arm-impulses-pendulum';
      }
    } else if (cyclePhase < leftUnlockPhase - phaseBoundaryEpsilon) {
      activeInnerContactSide = 'right';
      activeInnerToothIndex = rightLiftInnerToothIndex;
      beatContactSide = 'left';
      gravityDescentSide = null;
      innerContactMode = 'right-B-deposited-on-upper-pallet-wheel-tooth';
      innerContactProgress = 0;
      leftArmAngle = pendulum.angle;
      mode = 'pendulum-lifts-left-A-from-20-to-40-arcminutes';
      pendulumRaisedArmSide = 'left';
      rightArmAngle = rightFallenAngle;
      trainCoupledToPendulum = true;
    } else if (cyclePhase <= firstWheelStepEndPhase
      + phaseBoundaryEpsilon) {
      const linearProgress = (
        cyclePhase - leftUnlockPhase
      ) / (firstWheelStepEndPhase - leftUnlockPhase);
      const liftProgress = smootherStep(linearProgress);
      activeInnerContactSide = 'right';
      activeInnerToothIndex = rightLiftInnerToothIndex;
      activeLockSide = null;
      activeLockToothIndex = null;
      beatContactSide = 'left';
      gravityDescentSide = null;
      innerContactMode = 'small-wheel-curved-tooth-raises-right-B';
      innerContactProgress = liftProgress;
      leftArmAngle = pendulum.angle;
      mode = 'both-rigid-wheels-advance-20-degrees-and-cock-right-B';
      pendulumRaisedArmSide = 'left';
      rightArmAngle = armAngleAtLiftProgress(1, liftProgress);
      trainRaisingArmSide = 'right';
      wheelAdvance = wheelAdvancePerBeat * liftProgress;
      wheelStepActive = true;
    } else if (cyclePhase < rightPickupPhase - phaseBoundaryEpsilon) {
      activeInnerContactSide = 'right';
      activeInnerToothIndex = rightLiftInnerToothIndex;
      activeLockSide = 'right';
      activeLockToothIndex = rightLandingOuterToothIndex;
      beatContactSide = 'left';
      gravityDescentSide = 'left';
      innerContactMode = 'right-B-rests-on-raised-pallet-wheel-tooth';
      innerContactProgress = 1;
      leftArmAngle = pendulum.angle;
      mode = 'right-B-stop-locks-larger-wheel';
      rightArmAngle = rightCockedAngle;
      wheelAdvance = wheelAdvancePerBeat;
      if (cyclePhase >= leftEffectiveImpulseStartPhase) {
        effectiveGravityImpulseActive = true;
        mode = 'left-A-gravity-arm-impulses-pendulum';
      }
    } else if (cyclePhase < rightUnlockPhase - phaseBoundaryEpsilon) {
      activeInnerContactSide = 'left';
      activeInnerToothIndex = leftLiftInnerToothIndex;
      activeLockSide = 'right';
      activeLockToothIndex = rightLandingOuterToothIndex;
      beatContactSide = 'right';
      gravityDescentSide = null;
      innerContactMode = 'left-A-deposited-on-lowest-pallet-wheel-tooth';
      innerContactProgress = 0;
      leftArmAngle = leftFallenAngle;
      mode = 'pendulum-lifts-right-B-from-20-to-40-arcminutes';
      pendulumRaisedArmSide = 'right';
      rightArmAngle = pendulum.angle;
      trainCoupledToPendulum = true;
      wheelAdvance = wheelAdvancePerBeat;
    } else if (cyclePhase <= secondWheelStepEndPhase
      + phaseBoundaryEpsilon) {
      const linearProgress = (
        cyclePhase - rightUnlockPhase
      ) / (secondWheelStepEndPhase - rightUnlockPhase);
      const liftProgress = smootherStep(linearProgress);
      activeInnerContactSide = 'left';
      activeInnerToothIndex = leftLiftInnerToothIndex;
      activeLockSide = null;
      activeLockToothIndex = null;
      beatContactSide = 'right';
      gravityDescentSide = null;
      innerContactMode = 'small-wheel-curved-tooth-raises-left-A';
      innerContactProgress = liftProgress;
      leftArmAngle = armAngleAtLiftProgress(-1, liftProgress);
      mode = 'both-rigid-wheels-advance-20-degrees-and-cock-left-A';
      pendulumRaisedArmSide = 'right';
      rightArmAngle = pendulum.angle;
      trainRaisingArmSide = 'left';
      wheelAdvance = wheelAdvancePerBeat * (1 + liftProgress);
      wheelStepActive = true;
    } else {
      activeInnerContactSide = 'left';
      activeInnerToothIndex = leftLiftInnerToothIndex;
      activeLockSide = 'left';
      activeLockToothIndex = leftLandingOuterToothIndex;
      beatContactSide = 'right';
      gravityDescentSide = 'right';
      innerContactMode = 'left-A-rests-on-raised-pallet-wheel-tooth';
      innerContactProgress = 1;
      leftArmAngle = leftCockedAngle;
      mode = 'left-A-stop-locks-larger-wheel';
      rightArmAngle = pendulum.angle;
      wheelAdvance = wheelAdvancePerCycle;
    }

    const wheelAngle = wheelAngleAtCycleStart(cycleIndex)
      + wheelSpin * wheelAdvance;
    const contactSideSign = activeInnerContactSide === 'right' ? 1 : -1;
    const innerContact = palletContactAt(
      contactSideSign,
      innerContactProgress,
    );
    const activeInnerPoint = palletWheelToothPointAt(
      wheelAngle,
      activeInnerToothIndex,
      innerContact.contactRadius,
    );
    const activeInnerArmAngle = activeInnerContactSide === 'right'
      ? rightArmAngle
      : leftArmAngle;
    const activePalletFaceLocalPoint = palletFaceLocalPointAt(
      contactSideSign,
      innerContactProgress,
    );
    const activePalletFacePoint = armWorldPoint(
      activePalletFaceLocalPoint,
      activeInnerArmAngle,
    );

    const lockSideSign = activeLockSide === 'right' ? 1 : -1;
    const activeLockArmAngle = activeLockSide === 'right'
      ? rightArmAngle
      : leftArmAngle;
    const activeLockPoint = activeLockSide === null
      ? null
      : outerToothTipAt(wheelAngle, activeLockToothIndex);
    const activeLockFaceLocalPoint = activeLockSide === null
      ? null
      : lockFaceLocalPointAt(lockSideSign, activeLockArmAngle);
    const activeLockFacePoint = activeLockSide === null
      ? null
      : armWorldPoint(
        activeLockFaceLocalPoint,
        activeLockArmAngle,
      );

    const beatSideSign = beatContactSide === 'right' ? 1 : -1;
    const activeBeatArmAngle = beatContactSide === 'right'
      ? rightArmAngle
      : leftArmAngle;
    const activeForkPinCenter = forkPinCenterAt(
      beatSideSign,
      activeBeatArmAngle,
    );
    const pendulumDirection = new THREE.Vector2(
      Math.sin(pendulum.angle),
      -Math.cos(pendulum.angle),
    );
    const pendulumNormal = new THREE.Vector2(
      Math.cos(pendulum.angle),
      Math.sin(pendulum.angle),
    );
    const beatProjection = activeForkPinCenter.clone().sub(armPivot)
      .dot(pendulumDirection);
    const pendulumRodCenterPoint = armPivot.clone().add(
      pendulumDirection.clone().multiplyScalar(beatProjection),
    );
    const pendulumSurfacePoint = pendulumRodCenterPoint.clone().add(
      pendulumNormal.clone().multiplyScalar(
        beatSideSign * pendulumRodRadius,
      ),
    );
    const forkPinSurfacePoint = activeForkPinCenter.clone().add(
      pendulumNormal.clone().multiplyScalar(
        -beatSideSign * forkPinRadius,
      ),
    );
    const beatContactPoint = pendulumSurfacePoint.clone().add(
      forkPinSurfacePoint,
    ).multiplyScalar(0.5);

    return {
      activeForkPinCenter,
      activeInnerContactSide,
      activeInnerPoint,
      activeInnerToothIndex,
      activeLockFaceLocalPoint,
      activeLockFacePoint,
      activeLockPoint,
      activeLockSide,
      activeLockToothIndex,
      activePalletFaceLocalPoint,
      activePalletFacePoint,
      beatContactError: Math.abs(
        activeForkPinCenter.distanceTo(pendulumRodCenterPoint)
          - forkContactClearance
      ),
      beatContactPoint,
      beatContactSide,
      cycleIndex,
      cyclePhase,
      effectiveGravityImpulseActive,
      gravityDescentSide,
      gravityImpulseIsolatedFromTrain:
        effectiveGravityImpulseActive && !trainCoupledToPendulum,
      innerContactError: activeInnerPoint.distanceTo(
        activePalletFacePoint,
      ),
      innerContactMode,
      innerContactProgress,
      innerContactRadius: innerContact.contactRadius,
      leftArmAngle,
      leftLandingOuterToothIndex,
      leftLiftInnerToothIndex,
      lockContactError: activeLockPoint === null
        ? null
        : activeLockPoint.distanceTo(activeLockFacePoint),
      mode,
      outerWheelAngle: wheelAngle,
      palletWheelAngle: wheelAngle + palletWheelFacePhaseOffset,
      palletWheelRigidPhaseError: palletWheelFacePhaseOffset,
      pendulumAngle: pendulum.angle,
      pendulumAngularAcceleration: pendulum.acceleration,
      pendulumAngularSpeed: pendulum.speed,
      pendulumRaisedArmSide,
      rightArmAngle,
      rightLandingOuterToothIndex,
      rightLiftInnerToothIndex,
      startingLeftInnerToothIndex,
      startingLeftOuterToothIndex,
      trainCoupledToPendulum,
      trainRaisingArmSide,
      wheelAdvance,
      wheelAngle,
      wheelLocked: activeLockSide !== null,
      wheelStepActive,
    };
  };
  const derivativeStep = 1e-5;
  const stateAtTime = (time) => {
    const state = rawStateAtTime(time);
    const before = rawStateAtTime(time - derivativeStep);
    const after = rawStateAtTime(time + derivativeStep);
    const wheelAngularSpeed = (
      after.wheelAngle - before.wheelAngle
    ) / (2 * derivativeStep);
    return {
      ...state,
      leftArmAngularSpeed: (
        after.leftArmAngle - before.leftArmAngle
      ) / (2 * derivativeStep),
      outerWheelAngularSpeed: wheelAngularSpeed,
      palletWheelAngularSpeed: wheelAngularSpeed,
      rightArmAngularSpeed: (
        after.rightArmAngle - before.rightArmAngle
      ) / (2 * derivativeStep),
      wheelAngularAcceleration: (
        after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle
      ) / derivativeStep ** 2,
      wheelAngularSpeed,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.32,
    roughness: 0.53,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.46,
    roughness: 0.34,
  });
  const escapeWheelMaterial = matte(PALETTE.driver, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const palletWheelMaterial = matte(PALETTE.accent, {
    metalness: 0.43,
    roughness: 0.34,
  });
  const leftArmMaterial = matte(PALETTE.driven, {
    metalness: 0.31,
    roughness: 0.43,
  });
  const rightArmMaterial = matte(PALETTE.brass, {
    metalness: 0.39,
    roughness: 0.38,
  });
  const pendulumMaterial = matte(PALETTE.ink, {
    metalness: 0.42,
    roughness: 0.37,
  });
  const markerMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.24,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-bloxam-support-frame';
  root.add(fixedFrame);
  const upperCrossbar = beamBetween(
    new THREE.Vector3(-1.10, armPivot.y + 0.28, -0.92),
    new THREE.Vector3(1.10, armPivot.y + 0.28, -0.92),
    0.17,
    0.18,
    frameMaterial,
  );
  upperCrossbar.userData.role = 'upper-common-arm-pivot-crossbar';
  fixedFrame.add(upperCrossbar);
  const leftFrameLeg = beamBetween(
    new THREE.Vector3(-1.02, armPivot.y + 0.22, -0.92),
    new THREE.Vector3(-2.48, wheelCenter.y - 2.48, -0.92),
    0.14,
    0.18,
    frameMaterial,
  );
  leftFrameLeg.userData.role = 'left-bloxam-frame-leg';
  fixedFrame.add(leftFrameLeg);
  const rightFrameLeg = beamBetween(
    new THREE.Vector3(1.02, armPivot.y + 0.22, -0.92),
    new THREE.Vector3(2.48, wheelCenter.y - 2.48, -0.92),
    0.14,
    0.18,
    frameMaterial,
  );
  rightFrameLeg.userData.role = 'right-bloxam-frame-leg';
  fixedFrame.add(rightFrameLeg);
  const lowerCrossbar = beamBetween(
    new THREE.Vector3(-2.48, wheelCenter.y - 2.48, -0.92),
    new THREE.Vector3(2.48, wheelCenter.y - 2.48, -0.92),
    0.14,
    0.18,
    frameMaterial,
  );
  lowerCrossbar.userData.role = 'lower-bloxam-frame-crossbar';
  fixedFrame.add(lowerCrossbar);
  const plateRegistry = createSweptPlateRegistry(movement.id);
  // The common arbor runs in a bored ring on the back frame plane. Both arms
  // and the pendulum turn on one slender fixed stud through bored sleeves.
  const backFrameZ = -0.92;
  const wheelBearing = boredBearing(0.19, 0.084, 0.16, darkMaterial);
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, backFrameZ);
  wheelBearing.userData.role = 'common-two-wheel-arbor-bearing';
  fixedFrame.add(wheelBearing);
  const wheelBearingBracket = beamBetween(
    new THREE.Vector3(-2.0, wheelCenter.y, backFrameZ),
    new THREE.Vector3(wheelCenter.x - 0.15, wheelCenter.y, backFrameZ),
    0.12,
    0.16,
    frameMaterial,
  );
  wheelBearingBracket.userData.role = 'common-arbor-bearing-bracket';
  fixedFrame.add(wheelBearingBracket);
  // One fixed stud at C carries both arm eyes and the pendulum's boss. Brown
  // draws only its end (the small circle at C), so it stands alone, from just
  // behind arm A's eye to just in front of the pendulum boss.
  const armPivotStudRadius = 0.06;
  const armPivotStudRearZ = leftArmPlaneZ - 0.05 - 0.03;
  const armPivotStudFrontZ = pendulumPlaneZ + 0.07 + 0.03;
  const armPivotStud = cylinderAlongZ(armPivotStudRadius,
    armPivotStudFrontZ - armPivotStudRearZ, darkMaterial, 24);
  armPivotStud.position.set(armPivot.x, armPivot.y,
    (armPivotStudFrontZ + armPivotStudRearZ) / 2);
  armPivotStud.userData.role = 'fixed-stud-C-carrying-both-arms-and-pendulum';
  root.add(armPivotStud);
  const armPivotHanger = beamBetween(
    new THREE.Vector3(armPivot.x, armPivot.y, backFrameZ),
    new THREE.Vector3(armPivot.x, armPivot.y + 0.28, backFrameZ),
    0.16,
    0.16,
    frameMaterial,
  );
  armPivotHanger.userData.role = 'arm-pivot-stud-hanger';
  fixedFrame.add(armPivotHanger);
  const frameBearings = [wheelBearing, armPivotStud];

  const escapeWheelAssembly = new THREE.Group();
  escapeWheelAssembly.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheelAssembly.userData.axis = Z_AXIS.clone();
  escapeWheelAssembly.userData.role =
    'one-common-arbor-for-bloxam-escape-and-pallet-wheels';
  root.add(escapeWheelAssembly);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.axis = Z_AXIS.clone();
  wheelRotor.userData.role =
    'rigid-nine-tooth-two-wheel-bloxam-rotor';
  escapeWheelAssembly.add(wheelRotor);

  const outerEscapeWheel = new THREE.Group();
  outerEscapeWheel.position.z = outerWheelPlaneZ;
  outerEscapeWheel.userData.role = 'larger-nine-tooth-outer-locking-wheel';
  wheelRotor.add(outerEscapeWheel);
  // Brown draws this rim as straight chords from spoke to spoke: a flat
  // nine-sided frame rather than a round hoop.
  const polygonRimShape = new THREE.Shape();
  const polygonRimHole = new THREE.Path();
  for (let corner = 0; corner <= toothCount; corner += 1) {
    const angle = corner * FULL_TURN / toothCount;
    const outerPoint = [Math.cos(angle) * 1.67, Math.sin(angle) * 1.67];
    const innerPoint = [Math.cos(-angle) * 1.55, Math.sin(-angle) * 1.55];
    if (corner === 0) {
      polygonRimShape.moveTo(...outerPoint);
      polygonRimHole.moveTo(...innerPoint);
    } else {
      polygonRimShape.lineTo(...outerPoint);
      polygonRimHole.lineTo(...innerPoint);
    }
  }
  polygonRimShape.holes.push(polygonRimHole);
  const outerRim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(polygonRimShape, {
      bevelEnabled: false,
      depth: 0.14,
    }).translate(0, 0, -0.07),
    escapeWheelMaterial,
  );
  outerRim.userData.role = 'large-escape-wheel-open-rim';
  outerEscapeWheel.add(outerRim);
  const outerHub = cylinderAlongZ(
    0.23,
    outerWheelDepth + 0.06,
    escapeWheelMaterial,
    34,
  );
  outerHub.userData.role = 'large-escape-wheel-hub';
  outerEscapeWheel.add(outerHub);
  const outerTeeth = [];
  const outerSpokes = [];
  const outerActingFaces = [];
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const angle = toothIndex * toothPitch;
    const spoke = beamBetween(
      new THREE.Vector3(
        Math.cos(angle) * 0.19,
        Math.sin(angle) * 0.19,
        0,
      ),
      new THREE.Vector3(
        Math.cos(angle) * 1.62,
        Math.sin(angle) * 1.62,
        0,
      ),
      0.105,
      outerWheelDepth,
      escapeWheelMaterial,
    );
    spoke.userData.index = toothIndex;
    spoke.userData.role = `large-wheel-spoke-${toothIndex + 1}-of-9`;
    outerEscapeWheel.add(spoke);
    outerSpokes.push(spoke);

    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(
        lockingRadius - 1.54,
        0.15,
        outerWheelDepth,
      ),
      escapeWheelMaterial,
    );
    tooth.position.set(
      Math.cos(angle) * ((lockingRadius + 1.54) / 2),
      Math.sin(angle) * ((lockingRadius + 1.54) / 2),
      0,
    );
    tooth.rotation.z = angle;
    tooth.userData.index = toothIndex;
    tooth.userData.role = `outer-locking-tooth-${toothIndex + 1}-of-9`;
    outerEscapeWheel.add(tooth);
    outerTeeth.push(tooth);

    const actingFace = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.23, outerWheelDepth + 0.035),
      darkMaterial,
    );
    actingFace.position.set(
      Math.cos(angle) * lockingRadius,
      Math.sin(angle) * lockingRadius,
      0,
    );
    actingFace.rotation.z = angle + wheelSpin * outerToothFaceSlope;
    actingFace.userData.faceSlopeRadians = outerToothFaceSlope;
    actingFace.userData.index = toothIndex;
    actingFace.userData.role =
      `two-degree-outer-acting-face-${toothIndex + 1}-of-9`;
    outerEscapeWheel.add(actingFace);
    outerActingFaces.push(actingFace);
  }
  const outerPhaseWitness = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 16, 12),
    markerMaterial,
  );
  outerPhaseWitness.position.set(1.47, 0, outerWheelDepth / 2 + 0.07);
  outerPhaseWitness.userData.role = 'white-large-wheel-phase-witness';
  outerEscapeWheel.add(outerPhaseWitness);

  const palletWheel = new THREE.Group();
  palletWheel.position.z = palletWheelPlaneZ;
  palletWheel.rotation.z = palletWheelFacePhaseOffset;
  palletWheel.userData.facePhaseOffset = palletWheelFacePhaseOffset;
  palletWheel.userData.role =
    'smaller-nine-tooth-inner-arm-lifting-wheel';
  wheelRotor.add(palletWheel);
  const palletWheelHub = cylinderAlongZ(
    0.105,
    palletWheelDepth + 0.08,
    palletWheelMaterial,
    30,
  );
  palletWheelHub.userData.role = 'small-pallet-wheel-hub';
  palletWheel.add(palletWheelHub);
  const palletWheelPrimitiveRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      palletWheelPrimitiveRadius,
      0.025,
      8,
      54,
    ),
    palletWheelMaterial,
  );
  palletWheelPrimitiveRing.userData.role =
    'documented-point-two-inch-primitive-diameter-ring';
  palletWheel.add(palletWheelPrimitiveRing);
  const palletWheelTeeth = [];
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, 0.060, palletWheelDepth),
      palletWheelMaterial,
    );
    const angle = toothIndex * toothPitch;
    tooth.position.set(Math.cos(angle) * 0.175, Math.sin(angle) * 0.175, 0);
    tooth.rotation.z = angle;
    tooth.userData.curvedActingFlanks = true;
    tooth.userData.index = toothIndex;
    tooth.userData.role = `curved-pallet-wheel-tooth-${toothIndex + 1}-of-9`;
    palletWheel.add(tooth);
    palletWheelTeeth.push(tooth);
  }
  const palletWheelPhaseWitness = new THREE.Mesh(
    new THREE.SphereGeometry(0.041, 14, 10),
    markerMaterial,
  );
  palletWheelPhaseWitness.position.set(0.245, 0, palletWheelDepth / 2 + 0.05);
  palletWheelPhaseWitness.userData.role = 'white-small-wheel-phase-witness';
  palletWheel.add(palletWheelPhaseWitness);
  const commonShaftFrontZ = palletWheelPlaneZ + palletWheelDepth / 2 + 0.05;
  // Brown draws no frame (the presentation removes it), so the arbor ends
  // just behind the large wheel's hub instead of running on to a bearing.
  const commonShaftRearZ = outerWheelPlaneZ - (outerWheelDepth + 0.06) / 2
    - 0.05;
  const commonWheelShaft = cylinderAlongZ(0.074,
    commonShaftFrontZ - commonShaftRearZ, darkMaterial, 28);
  commonWheelShaft.position.z = (commonShaftFrontZ + commonShaftRearZ) / 2;
  commonWheelShaft.userData.role =
    'common-arbor-rigidly-fixing-both-nine-tooth-wheels';
  wheelRotor.add(commonWheelShaft);

  const makeGravityArm = (side) => {
    const isRight = side > 0;
    const letter = isRight ? 'B' : 'A';
    const forkLetter = isRight ? 'F' : 'E';
    const sideName = isRight ? 'right-B-F' : 'left-A-E';
    const material = isRight ? rightArmMaterial : leftArmMaterial;
    const cockedAngle = isRight ? rightCockedAngle : leftCockedAngle;
    const releaseAngle = isRight ? unlockAngle : -unlockAngle;
    const planeZ = isRight ? rightArmPlaneZ : leftArmPlaneZ;
    const group = new THREE.Group();
    group.position.set(armPivot.x, armPivot.y, planeZ);
    group.userData.axis = Z_AXIS.clone();
    group.userData.letter = letter;
    group.userData.role = `${sideName}-independent-gravity-arm`;
    group.userData.side = side;
    root.add(group);

    const lockWorld = fixedLockPointForSide(side);
    // Brown draws each arm straight from C to its stop A or B.
    const mainRailPoints = [
      armPivot,
      lockWorld,
    ].map((point) => armLocalPoint(point, cockedAngle));
    // Each arm is one flat plate in its own thin slab (the two slabs are
    // separated in z at the shared pivot). The pallet face and the outer
    // detent are separate plates in the small- and large-wheel slabs, all
    // shaped by the swept wheels.
    const sideKey = isRight ? 'right' : 'left';
    const armHalfDepth = 0.05;
    const toLocal = (point) => armLocalPoint(point, cockedAngle);
    const palletFaceSamples = Array.from({ length: 41 }, (_, index) => (
      palletFaceLocalPointAt(side, index / 40)
    ));
    const palletFaceDistances = palletFaceSamples.map((point) => (
      point.length()
    ));
    const faceMinimumDistance = Math.min(...palletFaceDistances) - 0.12;
    const faceMaximumDistance = Math.max(...palletFaceDistances) + 0.12;
    const faceDirection = new THREE.Vector2(
      Math.cos(palletFaceLocalAngle(side)),
      Math.sin(palletFaceLocalAngle(side)),
    );
    const localWheelCenter = toLocal(wheelCenter);
    const faceMid = palletFaceSamples[Math.floor(palletFaceSamples.length / 2)];
    const faceNormal = new THREE.Vector2(-faceDirection.y, faceDirection.x);
    // The pallet body lies on the side the lifting tooth pushes toward:
    // outward, away from the pendulum.
    if (faceNormal.x * side < 0) faceNormal.negate();
    const faceStart = faceDirection.clone().multiplyScalar(faceMinimumDistance);
    const faceEnd = faceDirection.clone().multiplyScalar(faceMaximumDistance);
    const faceBack = faceMid.clone().addScaledVector(faceNormal, 0.16);

    const forkLocal = forkPinLocalPoint(side);
    // Below its stop each arm carries on in Brown's band, leaving the
    // straight arm tangentially on one circular arc and ending in a short
    // straight run to its fork pin. The left band is a J: it curves in
    // under the wheel centre, bottoming out level with pin E just under the
    // arbor. The right arm turns back on itself in a tight hook below B and
    // returns leftward, above the arbor, to pin F. A short straight finger
    // then runs from each fork pin to its pallet-face stem.
    const lowerBranch = (() => {
      const stop = lockWorld.clone();
      const along = stop.clone().sub(armPivot).normalize();
      const pin = forkPinCenterAt(side, cockedAngle);
      let center, radius, startAngle, sweep, turn;
      if (side < 0) {
        const normal = new THREE.Vector2(-along.y, along.x);
        radius = (stop.y - pin.y) / (1 - normal.y);
        center = stop.clone().addScaledVector(normal, radius);
        startAngle = Math.atan2(stop.y - center.y, stop.x - center.x);
        turn = 1;
        sweep = positiveModulo(-Math.PI / 2 - startAngle, FULL_TURN);
      } else {
        const normal = new THREE.Vector2(along.y, -along.x);
        radius = 0.32;
        center = stop.clone().addScaledVector(normal, radius);
        startAngle = Math.atan2(stop.y - center.y, stop.x - center.x);
        turn = -1;
        const toPin = pin.clone().sub(center);
        const alpha = Math.atan2(toPin.y, toPin.x);
        const offset = Math.acos(radius / toPin.length());
        sweep = Math.min(...[alpha + offset, alpha - offset].map((angle) => (
          positiveModulo(startAngle - angle, FULL_TURN))));
      }
      const segments = 32;
      const arc = Array.from({ length: segments + 1 }, (_, index) => {
        const angle = startAngle + turn * sweep * index / segments;
        return toLocal(center.clone().add(new THREE.Vector2(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        )));
      });
      return { arc, radius, points: [...arc, forkLocal.clone()] };
    })();
    const lowerArcPoints = lowerBranch.points;
    const lowerCrosspiecePoints = [...lowerArcPoints, faceBack];
    const mainRail = plateRegistry.add({
      key: `${sideKey}-arm`,
      material,
      owner: group,
      primitives: [
        ...plateStroke(mainRailPoints, 0.15),
        ...plateStroke(lowerCrosspiecePoints, 0.19),
        plateDisc(new THREE.Vector2(0, 0), 0.15),
        plateDisc(forkLocal, 0.13),
        // A round pad ends the crosspiece under the whole pallet-face stem,
        // so the stem stands on (and is sunk into) the arm, not its corner.
        plateDisc(faceBack, 0.19 / 2),
      ],
      role: `${sideName}-thin-tubular-main-arm`,
      z0: -armHalfDepth,
      z1: armHalfDepth,
    });
    const heavyLowerCrosspiece = mainRail;

    const palletSlabZ0 = palletWheelPlaneZ - palletWheelDepth / 2 - planeZ;
    const palletSlabZ1 = palletWheelPlaneZ + palletWheelDepth / 2 - planeZ;
    const palletFace = plateRegistry.add({
      key: `${sideKey}-pallet-face`,
      material: darkMaterial,
      owner: group,
      primitives: [platePolygon([
        faceStart.clone().addScaledVector(faceNormal, -0.05),
        faceEnd.clone().addScaledVector(faceNormal, -0.05),
        faceEnd.clone().addScaledVector(faceNormal, 0.22),
        faceStart.clone().addScaledVector(faceNormal, 0.22),
      ])],
      role: `${sideName}-plane-radial-inner-pallet-face`,
      z0: palletSlabZ0,
      z1: palletSlabZ1,
    });
    palletFace.userData.planeRadiatesFromArmAxis = true;
    plateRegistry.add({
      key: `${sideKey}-pallet-face-stem`,
      material,
      owner: group,
      // As wide as the crosspiece's round end, in the arm's own metal, so
      // the arm reads as running on to its pallet face, not a wire hook.
      primitives: [plateDisc(faceBack, 0.19 / 2 - 0.015)],
      role: `${sideName}-pallet-face-stem`,
      // Sunk to the arm's mid-plane: the stem is set into the arm.
      z0: 0,
      z1: palletSlabZ0,
    });

    const reinforcementStartWorld = new THREE.Vector2(
      side * 0.52,
      armPivot.y - 2.28,
    );
    const reinforcementEndWorld = new THREE.Vector2(
      side * 1.35,
      wheelCenter.y + 0.28,
    );
    const reinforcementWire = beamBetween(
      new THREE.Vector3(
        ...armLocalPoint(reinforcementStartWorld, cockedAngle).toArray(),
        0.01,
      ),
      new THREE.Vector3(
        ...armLocalPoint(reinforcementEndWorld, cockedAngle).toArray(),
        0.01,
      ),
      0.035,
      0.045,
      darkMaterial,
    );
    reinforcementWire.userData.role =
      `${sideName}-anti-double-impulse-reinforcement-wire`;
    group.add(reinforcementWire);

    const lockFacePoints = Array.from({ length: 25 }, (_, index) => {
      const angle = THREE.MathUtils.lerp(
        cockedAngle,
        releaseAngle,
        index / 24,
      );
      return lockFaceLocalPointAt(side, angle);
    });
    // The detent block starts just behind the locked tooth head and reaches
    // ahead of it along the wheel's advance, so the swept teeth leave a
    // hooked stop whose leading face catches the next T-head.
    const lockWorldAngle = Math.atan2(
      lockWorld.y - wheelCenter.y,
      lockWorld.x - wheelCenter.x,
    );
    const lockRadius = lockWorld.distanceTo(wheelCenter);
    const stopBehind = lockWorldAngle - wheelSpin * THREE.MathUtils.degToRad(2);
    const stopAhead = lockWorldAngle + wheelSpin * THREE.MathUtils.degToRad(10);
    const stopSector = plateSector(wheelCenter, lockRadius - 0.14,
      lockRadius + 0.24, Math.min(stopBehind, stopAhead),
      Math.max(stopBehind, stopAhead));
    const stopPrimitive = platePolygon(stopSector.points.map(([x, y]) => (
      toLocal(new THREE.Vector2(x, y))
    )));
    const outerSlabZ0 = outerWheelPlaneZ - outerWheelDepth / 2 - 0.02 - planeZ;
    const outerSlabZ1 = outerWheelPlaneZ + outerWheelDepth / 2 - planeZ;
    const lockingDetentEdge = plateRegistry.add({
      key: `${sideKey}-detent-${letter}`,
      material: darkMaterial,
      owner: group,
      primitives: [stopPrimitive],
      role: `${sideName}-eight-degree-outer-locking-detent-${letter}`,
      z0: outerSlabZ0,
      z1: outerSlabZ1,
    });
    lockingDetentEdge.userData.faceSlopeRadians = detentFaceSlope;
    const stopStem = plateRegistry.add({
      key: `${sideKey}-stop-${letter}`,
      material: darkMaterial,
      owner: group,
      primitives: [
        stopPrimitive,
        plateDisc(toLocal(lockWorld), 0.09),
      ],
      role: `${sideName}-axial-outer-stop-${letter}`,
      z0: outerSlabZ1,
      z1: -armHalfDepth,
    });

    // Brown draws E and F as small oblong slots on the arms: each is a flat
    // tab of the arm's own metal, seen end-on, standing from inside the arm
    // to just past the pendulum rod's front face. Its rounded ends reach
    // forkPinRadius either side of the old pin centre, so the face bearing
    // on the rod is exactly where the round pin's was.
    const forkTargetLocalZ = pendulumPlaneZ - planeZ;
    const forkPinRearZ = -armHalfDepth + 0.02;
    const forkPinFrontZ = forkTargetLocalZ + pendulumRodHalfDepth + 0.03;
    const forkTabHalfHeight = 0.045;
    const forkTabShape = new THREE.Shape();
    const forkTabCentreReach = forkPinRadius - forkTabHalfHeight;
    forkTabShape.absarc(forkTabCentreReach, 0, forkTabHalfHeight,
      -Math.PI / 2, Math.PI / 2, false);
    forkTabShape.absarc(-forkTabCentreReach, 0, forkTabHalfHeight,
      Math.PI / 2, 3 * Math.PI / 2, false);
    const forkTabGeometry = new THREE.ExtrudeGeometry(forkTabShape, {
      bevelEnabled: false,
      curveSegments: 16,
      depth: forkPinFrontZ - forkPinRearZ,
      steps: 1,
    });
    forkTabGeometry.translate(0, 0, -(forkPinFrontZ - forkPinRearZ) / 2);
    const forkPin = new THREE.Mesh(forkTabGeometry, material);
    forkPin.position.set(forkLocal.x, forkLocal.y,
      (forkPinFrontZ + forkPinRearZ) / 2);
    forkPin.userData.letter = forkLetter;
    forkPin.userData.role = `${sideName}-adjustable-fork-pin-${forkLetter}`;
    group.add(forkPin);
    const forkPinWitness = new THREE.Mesh(
      new THREE.SphereGeometry(0.047, 14, 10),
      markerMaterial,
    );
    forkPinWitness.position.set(
      forkLocal.x,
      forkLocal.y,
      forkTargetLocalZ + 0.075,
    );
    forkPinWitness.userData.role =
      `${sideName}-white-fork-pin-${forkLetter}-witness`;
    group.add(forkPinWitness);

    const pivotEye = new THREE.Mesh(
      new THREE.TorusGeometry(0.150, 0.043, 10, 34),
      material,
    );
    pivotEye.position.z = 0.01;
    pivotEye.userData.role = `${sideName}-separate-coaxial-pivot-eye`;
    group.add(pivotEye);
    const crankedArbor = boredBearing(0.10, armPivotStudRadius + 0.008,
      2 * armHalfDepth - 0.006, darkMaterial, 28);
    crankedArbor.userData.role =
      `${sideName}-cranked-arbor-coincident-with-pendulum-axis`;
    group.add(crankedArbor);

    return {
      crankedArbor,
      forkPin,
      forkPinWitness,
      group,
      heavyLowerCrosspiece,
      lockingDetentEdge,
      lockFacePoints,
      lowerArcPoints,
      lowerBranchArc: lowerBranch.arc,
      mainRail,
      mainRailPoints,
      palletFace,
      palletFaceSamples,
      pivotEye,
      reinforcementWire,
      stopStem,
    };
  };
  const leftGravityArm = makeGravityArm(-1);
  const rightGravityArm = makeGravityArm(1);

  const pendulumAssembly = new THREE.Group();
  pendulumAssembly.position.set(armPivot.x, armPivot.y, pendulumPlaneZ);
  pendulumAssembly.userData.axis = Z_AXIS.clone();
  pendulumAssembly.userData.role =
    'pendulum-between-adjustable-fork-pins-E-and-F';
  root.add(pendulumAssembly);
  const pendulumLength = armAxisDistance + 0.62 + 1.12;
  // The rod and its suspension boss are one flat plate: a round boss bored
  // for stud C, with the rod leaving it tangentially downward.
  const pendulumBossRadius = 0.2;
  const pendulumTopShape = new THREE.Shape();
  const rodHalfWidth = pendulumRodRadius;
  const bossJoinAngle = Math.asin(rodHalfWidth / pendulumBossRadius);
  pendulumTopShape.moveTo(rodHalfWidth, -pendulumLength);
  pendulumTopShape.lineTo(rodHalfWidth,
    -pendulumBossRadius * Math.cos(bossJoinAngle));
  pendulumTopShape.absarc(0, 0, pendulumBossRadius,
    -Math.PI / 2 + bossJoinAngle, 3 * Math.PI / 2 - bossJoinAngle, false);
  pendulumTopShape.lineTo(-rodHalfWidth, -pendulumLength);
  pendulumTopShape.lineTo(rodHalfWidth, -pendulumLength);
  const pendulumBore = new THREE.Path();
  pendulumBore.absarc(0, 0, armPivotStudRadius + 0.008, 0, FULL_TURN, true);
  pendulumTopShape.holes.push(pendulumBore);
  const pendulumRodGeometry = new THREE.ExtrudeGeometry(pendulumTopShape, {
    bevelEnabled: false,
    curveSegments: 40,
    depth: 2 * pendulumRodHalfDepth,
    steps: 1,
  });
  pendulumRodGeometry.translate(0, 0, -pendulumRodHalfDepth);
  const pendulumRod = new THREE.Mesh(pendulumRodGeometry, pendulumMaterial);
  pendulumRod.userData.role = 'bloxam-pendulum-rod';
  pendulumAssembly.add(pendulumRod);
  // The boss is part of the rod plate; this alias keeps the named block.
  const pendulumPivotEye = pendulumRod;
  const pendulumBob = cylinderAlongZ(0.43, 0.22, pendulumMaterial, 44);
  pendulumBob.position.set(0, -pendulumLength + 0.20, 0);
  pendulumBob.scale.y = 1.13;
  pendulumBob.userData.role = 'bloxam-pendulum-bob';
  pendulumAssembly.add(pendulumBob);

  const beatContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.057, 16, 12),
    markerMaterial,
  );
  beatContactMarker.userData.role =
    'live-E-or-F-fork-pin-to-pendulum-contact';
  root.add(beatContactMarker);
  const innerContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 16, 12),
    markerMaterial,
  );
  innerContactMarker.userData.role =
    'live-small-wheel-to-plane-pallet-contact';
  root.add(innerContactMarker);
  const outerLockMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 16, 12),
    markerMaterial,
  );
  outerLockMarker.userData.role =
    'live-large-wheel-to-stop-A-or-B-contact';
  root.add(outerLockMarker);
  for (const marker of [beatContactMarker, innerContactMarker,
    outerLockMarker]) {
    marker.visible = false;
    marker.userData.diagnosticOnly = true;
  }

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.wheelAngle;
    leftGravityArm.group.rotation.z = state.leftArmAngle;
    rightGravityArm.group.rotation.z = state.rightArmAngle;
    pendulumAssembly.rotation.z = state.pendulumAngle;

    beatContactMarker.position.set(
      state.beatContactPoint.x,
      state.beatContactPoint.y,
      pendulumPlaneZ + 0.095,
    );
    beatContactMarker.userData.contactError = state.beatContactError;
    beatContactMarker.userData.contactSide = state.beatContactSide;
    beatContactMarker.userData.gravityImpulseActive =
      state.effectiveGravityImpulseActive;

    innerContactMarker.position.set(
      state.activeInnerPoint.x,
      state.activeInnerPoint.y,
      palletWheelPlaneZ + palletWheelDepth / 2 + 0.075,
    );
    innerContactMarker.userData.contactError = state.innerContactError;
    innerContactMarker.userData.contactMode = state.innerContactMode;
    innerContactMarker.userData.contactSide = state.activeInnerContactSide;
    innerContactMarker.userData.toothIndex = state.activeInnerToothIndex;

    beatContactMarker.userData.active = true;
    innerContactMarker.userData.active = true;
    outerLockMarker.userData.active = state.wheelLocked;
    if (state.activeLockPoint) {
      outerLockMarker.position.set(
        state.activeLockPoint.x,
        state.activeLockPoint.y,
        outerWheelPlaneZ + outerWheelDepth / 2 + 0.075,
      );
    }
    outerLockMarker.userData.contactError = state.lockContactError;
    outerLockMarker.userData.contactSide = state.activeLockSide;
    outerLockMarker.userData.toothIndex = state.activeLockToothIndex;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    beatContactMarker,
    commonWheelShaft,
    escapeWheelAssembly,
    fixedFrame,
    frameBearings,
    innerContactMarker,
    leftFrameLeg,
    leftGravityArm,
    lowerCrossbar,
    outerActingFaces,
    outerEscapeWheel,
    outerHub,
    outerLockMarker,
    outerPhaseWitness,
    outerRim,
    outerSpokes,
    outerTeeth,
    palletWheel,
    palletWheelHub,
    palletWheelPhaseWitness,
    palletWheelPrimitiveRing,
    palletWheelTeeth,
    pendulumAssembly,
    pendulumBob,
    pendulumPivotEye,
    pendulumRod,
    rightFrameLeg,
    rightGravityArm,
    upperCrossbar,
    armPivotHanger,
    armPivotStud,
    wheelBearingBracket,
    wheelRotor,
  };
  root.userData.sweptPlates = plateRegistry.plates;
  root.userData.sweptPlateInputHash = plateRegistry.bakeInputHash;
  root.userData.engagementContacts = (state) => {
    // The outer lock is carried by the leading end of the T-head, and the
    // straight small-wheel tooth lifts its arm with its leading tip corner.
    const headLead = state.activeLockPoint
      ? state.activeLockPoint.clone().sub(wheelCenter)
        .rotateAround(new THREE.Vector2(),
          wheelSpin * (0.115 - 0.035 / 2) / lockingRadius)
        .add(wheelCenter)
      : null;
    const liftRadial = state.activeInnerPoint.clone().sub(wheelCenter)
      .normalize();
    const liftTip = wheelCenter.clone()
      .addScaledVector(liftRadial, 0.175 + 0.23 / 2)
      .add(new THREE.Vector2(-liftRadial.y, liftRadial.x)
        .multiplyScalar(wheelSpin * 0.03));
    return {
      advanceSign: wheelSpin,
      contacts: {
        lock: state.wheelLocked ? {
          point: headLead,
          radius: 0.035 / 2,
          z: [outerWheelPlaneZ - outerWheelDepth / 2,
            outerWheelPlaneZ + outerWheelDepth / 2],
        } : null,
        lift: state.wheelStepActive ? {
          point: liftTip,
          radius: 0,
          z: [palletWheelPlaneZ - palletWheelDepth / 2,
            palletWheelPlaneZ + palletWheelDepth / 2],
        } : null,
      },
    };
  };
  // Brown's elevation ends at the lowest wheel teeth; he dashes the pendulum
  // and draws no bob (source presentation removes it). A narrow lens keeps the
  // view near-orthographic.
  root.userData.cameraDistanceScale = 1.12;
  root.userData.cameraFov = 12;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.7, wheelCenter.y - 2.1, -1.10),
    new THREE.Vector3(2.7, armPivot.y + 0.55, 1.18),
  );
  root.userData.fidelity = 'authored';
  root.userData.fixedLockPointForSide = fixedLockPointForSide;
  root.userData.forkPinCenterAt = forkPinCenterAt;
  root.userData.geometry = {
    armAxisDistance,
    armAxisDistanceInches,
    armPivot: armPivot.clone(),
    constructedDetentArmLength,
    detentArmLengthInches,
    detentFaceSlope,
    escapeWheelDiameterInches,
    firstWheelStepEndPhase,
    forkContactClearance,
    forkPinLength,
    forkPinLengthE,
    forkPinLengthF,
    forkPinRadius,
    gravityArmMass,
    historicalEscapeWheelRadius,
    leftArmPlaneZ,
    leftCockedAngle,
    leftEffectiveImpulseStartPhase,
    leftFallenAngle,
    leftGravityPotentialDrop,
    leftLockAngle,
    leftPickupPhase,
    leftUnlockPhase,
    lockingRadius,
    mappedArmPivotC,
    mappedLeftForkPinE,
    mappedLeftStopA,
    mappedRightForkPinF,
    mappedRightStopB,
    maximumDocumentedUnlockAngle,
    modelUnitsPerInch,
    nominalArmLift,
    outerToothFaceSlope,
    outerWheelDepth,
    outerWheelPlaneZ,
    palletWheelDepth,
    palletWheelFacePhaseOffset,
    palletWheelPlaneZ,
    palletWheelPrimitiveDiameterInches,
    palletWheelPrimitiveRadius,
    pendulumAmplitude,
    pendulumPeriod,
    pendulumPlaneZ,
    pendulumRodRadius,
    pickupAngle,
    primitiveLeftLift,
    primitiveRightLift,
    publishedDetentArmLength,
    rightArmPlaneZ,
    rightCockedAngle,
    rightEffectiveImpulseStartPhase,
    rightFallenAngle,
    rightGravityPotentialDrop,
    rightLockAngle,
    rightPickupPhase,
    rightUnlockPhase,
    secondWheelStepEndPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    standardGravity,
    tangentLengthRoundingError,
    toothCount,
    toothPitch,
    unlockAngle,
    wheelAdvancePerBeat,
    wheelAdvancePerCycle,
    wheelCenter: wheelCenter.clone(),
    wheelSpin,
  };
  root.userData.gravityPotentialAt = gravityPotentialAt;
  root.userData.lockFaceLocalPointAt = lockFaceLocalPointAt;
  root.userData.mechanism = "Bloxam's gravity escapement: one rigid arbor carries a larger nine-tooth escape wheel and a smaller nine-tooth pallet wheel whose acting faces trail by 10 degrees. The small wheel alternately lifts independent gravity arms A and B through about 40 arcminutes; their outer detents stop the large wheel, while adjustable fork pins E and F embrace and impulse the pendulum.";
  root.userData.outerToothTipAt = outerToothTipAt;
  root.userData.palletContactAt = palletContactAt;
  root.userData.palletFaceLocalPointAt = palletFaceLocalPointAt;
  root.userData.palletWheelToothPointAt = palletWheelToothPointAt;
  root.userData.presentation = 'front-oblique reconstruction exposing the two axially separated but rigid concentric nine-tooth wheels, the tiny inner lifting wheel, separate tubular gravity arms and cranked coaxial pivots, outer stops A and B, adjustable fork pins E and F, and no fly';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 312 page provides Brown’s plate but no working canvas animation; operation and dimensions are reconstructed from Bloxam’s 1853 primary paper and later horological descriptions.',
    referenceScope: 'Bloxam fixes two rigid concentric wheels, nine-tooth-compatible action, 20-degree wheel steps, 40-arcminute gravity-arm lift, 20/40-arcminute pendulum events, plane radial pallets, 2/8-degree locking slopes, and the 10-degree inner-face lag. Brown fixes labels A, B, E, and F.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    britannicaReference: {
      constructionEvidence: 'The small wheel near the arbor lifts the pallets while the long outer teeth lock against their stops; cranked pallet arbors coincide effectively with the pendulum axis.',
      edition: 11,
      publication: 'Encyclopaedia Britannica, Volume 6',
      publicationYear: 1911,
      url: 'https://www.gutenberg.org/files/31793/31793-h/31793-h.htm',
    },
    brownPlate312: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      measurementUncertaintyPixels: 8,
      officialAnimationAvailable: false,
      rasterArmPivotC: sourceRasterArmPivotC.clone(),
      rasterLeftForkPinE: sourceRasterLeftForkPinE.clone(),
      rasterLeftStopA: sourceRasterLeftStopA.clone(),
      rasterRightForkPinF: sourceRasterRightForkPinF.clone(),
      rasterRightStopB: sourceRasterRightStopB.clone(),
      rasterWheelBottom: sourceRasterWheelBottom.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      schematicScaleNotice: 'Brown’s compact engraving is used for topology and named landmarks; Bloxam’s full-size measurements govern the simulated proportions.',
    },
    grimthorpeReference: {
      constructionEvidence: 'The pallet wheel has nine teeth; the long teeth perform the stopping, A and B are the stops, E and F are fork pins, and the cranked arm arbors coincide with the pendulum axis.',
      publication: 'A Rudimentary Treatise on Clocks, Watches and Bells',
      url: 'https://whitingsociety.org.uk/old-ringing-books/grimthorpe-treatise-clocks-watches-bells-01.pdf',
    },
    officialDescription: movement.description,
    originalBloxamPaper: {
      actingFacePhaseLagDegrees: 10,
      armAxisDistanceInches,
      detentArmLengthInches,
      detentFaceSlopeDegrees: 8,
      escapeWheelDiameterInches,
      googleBooksVolumeId: '5PxDAQAAMAAJ',
      innerWheelTeeth: 9,
      nominalArmLiftArcMinutes: 40,
      outerToothFaceSlopeDegrees: 2,
      pages: [143, 144, 145],
      palletWheelPrimitiveDiameterInches,
      pendulumPickupArcMinutes: 20,
      pendulumUnlockArcMinutes: 40,
      publication: 'Memoirs of the Royal Astronomical Society, Volume XXII',
      publicationYear: 1853,
      title: 'On the Mathematical Theory and Practical Defects of Clock Escapements, with a Description of a New Escapement',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'right-B-descends-with-pendulum-while-left-A-locks',
      'right-B-is-deposited-on-upper-inner-wheel-tooth',
      'pendulum-lifts-left-A-from-20-to-40-arcminutes-and-unlocks',
      'both-rigid-wheels-advance-20-degrees-while-inner-wheel-cocks-right-B',
      'right-B-outer-stop-locks-the-larger-wheel',
      'left-A-descends-with-pendulum-and-is-deposited-on-lowest-tooth',
      'pendulum-lifts-right-B-from-20-to-40-arcminutes-and-unlocks',
      'both-rigid-wheels-advance-20-degrees-while-inner-wheel-cocks-left-A',
      'left-A-outer-stop-locks-the-larger-wheel',
    ],
  };
  root.userData.transmission = {
    direction: 'clockwise in Brown’s front elevation, as his arrow above the arbor shows',
    escapeAndPalletWheelAngularSpeedRatio: 1,
    fly: 'none: Bloxam’s nine-tooth wheel advances only 20 degrees per vibration and the published construction has no fly',
    gravityIsolation: 'the train raises the resting opposite arm through the small pallet wheel; the pendulum receives its impulse from the fixed gravitational fall of that arm',
    impulsesPerPendulumCycle: 2,
    innerToOuterPrimitiveRadiusRatio: palletWheelPrimitiveRadius
      / historicalEscapeWheelRadius,
    locking: {
      innerWheel: 'alternately supports and lifts A and B near the arbor',
      outerWheel: 'alternately stopped by A and B at the large radius',
    },
    mechanismClosurePendulumCycles: 9,
    nominalArmLiftArcMinutes: nominalArmLift / arcMinute,
    palletWheelActingFaceLagDegrees: 10,
    stepsPerPendulumCycle: 2,
    wheelAdvancePerBeatDegrees: 20,
    wheelAdvancePerBeatRadians: wheelAdvancePerBeat,
    wheelAdvancePerCycleDegrees: 40,
    wheelAdvancePerCycleRadians: wheelAdvancePerCycle,
    wheelsFixedOnSameArbor: true,
  };
  root.userData.wheelAngleAtCycleStart = wheelAngleAtCycleStart;

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
  // Brown dashes the pendulum (it hangs behind the wheels on the plate); it
  // stands in front here, so it takes the shared see-through style.
  makeSeeThrough(pendulumRod);
  for (const object of [
    beatContactMarker,
    innerContactMarker,
    outerLockMarker,
    outerPhaseWitness,
    palletWheelPhaseWitness,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(0.6, 0.35, 14.2),
    root,
    update,
  };
}

const GRAVITY_ESCAPEMENT_BUILDERS = {
  309: mudgeGravityEscapement,
  310: singleThreeLeggedGravityEscapement,
  311: doubleThreeLeggedGravityEscapement,
  312: bloxamGravityEscapement,
};

export function createAuthoredGravityEscapementMovement(movement) {
  const build = GRAVITY_ESCAPEMENT_BUILDERS[movement.id];
  if (!build) return null;
  const model = build(movement);
  // Brown draws all four as front elevations without a ground line.
  model.root.userData.hideGround = true;
  return model;
}
