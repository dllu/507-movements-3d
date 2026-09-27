import * as THREE from 'three';
import { plate, poly, circle, capsule, polygonClipping as clip } from './finite-plate-geometry.js';
import { waterVolumeMaterial } from './water-volume.js';
import { STREAM_GRAVITY, waterStreamMaterial } from './water-stream.js';
import { PALETTE, markShadows, matte } from './primitives.js';

// Movement 461: Brown's pendulous swinging gutters. The plate draws one rigid
// lattice hung on a central axis: six horizontal pipes, each with a square box
// at its right end and (below all but the top one) a tilted box at its left
// end, and six parallel diagonal pipes, each rising from a left box (or, for
// the lowest, from the water) to the right box two rows up, passing behind
// the horizontal between. The pipes therefore form two interleaved
// serpentines. The first rises from an open pipe end under water through the
// odd rows and pours from the open left end of the top pipe (Brown's jet);
// the second starts at the scoop box on the right of the lowest row, climbs
// the even rows and joins the top pipe through a port where the highest
// diagonal passes behind it, so it too pours from Brown's one jet (the
// diagonal's stub above the port is an open vent). Every box holds a one-way
// flap across the pipe that enters it.

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return THREE.MathUtils.clamp(x ** 3 * (10 + x * (-15 + 6 * x)), 0, 1);
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

// A transfer half-swing runs over u in [0, 1]. Each flap of the active set
// lifts early, stays open while its parcel passes and reseats before the half
// ends; each parcel starts after its flap has begun to lift and comes to rest
// (zero speed and acceleration) before the next half begins.
const FLAP_RISE = 0.2;
const FLAP_FALL_START = 0.62;
const FLAP_FALL_SPAN = 0.3;
const PARCEL_START = 0.06;
const PARCEL_SPAN = 0.88;

function flapProfile(u) {
  const x = u / FLAP_RISE;
  const y = (u - FLAP_FALL_START) / FLAP_FALL_SPAN;
  const a = smootherStep(x);
  const a1 = smootherStepDerivative(x) / FLAP_RISE;
  const a2 = smootherStepSecondDerivative(x) / FLAP_RISE ** 2;
  const b = 1 - smootherStep(y);
  const b1 = -smootherStepDerivative(y) / FLAP_FALL_SPAN;
  const b2 = -smootherStepSecondDerivative(y) / FLAP_FALL_SPAN ** 2;
  const value = a * b;
  return {
    d1: a1 * b + a * b1,
    d2: a2 * b + 2 * a1 * b1 + a * b2,
    value: Math.abs(value) < 1e-15 ? 0 : value,
  };
}

function parcelProfile(u, start = PARCEL_START, span = PARCEL_SPAN) {
  const x = (u - start) / span;
  return { d1: smootherStepDerivative(x) / span, value: smootherStep(x) };
}

function inverseParcelProfile(fraction) {
  let low = PARCEL_START, high = PARCEL_START + PARCEL_SPAN;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (parcelProfile(mid).value < fraction) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

function rotateLocal(local, angle) {
  return local.clone().applyAxisAngle(Z_AXIS, angle);
}

const v2 = (x, y) => new THREE.Vector3(x, y, 0);
const xy = (p) => [p.x, p.y];

// One water parcel: a closed body filling the pipe bore between two
// arc-length stations of a serpentine's centre line. Through each box its
// section turns about the corner as a U-bend and shifts between the two pipe
// layers; it is clipped at the scoop mouth and at the open top end.
const PARCEL_STATIONS = 56;
function parcelGeometry() {
  const geometry = new THREE.BufferGeometry();
  const count = PARCEL_STATIONS * 8 + 8;
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const index = [];
  for (let k = 0; k < PARCEL_STATIONS - 1; k += 1) {
    for (let side = 0; side < 4; side += 1) {
      const a0 = k * 8 + side * 2, a1 = a0 + 8;
      index.push(a0, a1, a0 + 1, a0 + 1, a1, a1 + 1);
    }
  }
  const cap = PARCEL_STATIONS * 8;
  index.push(cap, cap + 2, cap + 1, cap, cap + 3, cap + 2);
  index.push(cap + 4, cap + 5, cap + 6, cap + 4, cap + 6, cap + 7);
  geometry.setIndex(index);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
  return geometry;
}

// A poured stream: every particle leaving an open end is followed on its own
// parabola, so the stream has a real head when a parcel starts to pour, thins
// as it accelerates, and ends in a tail that falls away after the last water
// has left. Buffers are allocated once and rewritten in place.
const JET_STATIONS = 40;
const JET_SIDES = 12;
function jetGeometry() {
  const geometry = new THREE.BufferGeometry();
  const ring = JET_SIDES + 1;
  const count = JET_STATIONS * ring + 2 * (ring + 1);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 4), 4));
  const index = [];
  for (let i = 0; i < JET_STATIONS - 1; i += 1) {
    for (let j = 0; j < JET_SIDES; j += 1) {
      const a = i * ring + j, b = a + ring;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  for (const [capIndex, sign] of [[0, -1], [1, 1]]) {
    const centre = JET_STATIONS * ring + capIndex * (ring + 1);
    for (let j = 0; j < JET_SIDES; j += 1) {
      const a = centre + 1 + j;
      if (sign < 0) index.push(centre, a + 1, a); else index.push(centre, a, a + 1);
    }
  }
  geometry.setIndex(index);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  return geometry;
}

function swingingGutterPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.8;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const swingAmplitude = THREE.MathUtils.degToRad(12);
  const gutterPivot = new THREE.Vector3(0, 0.90, 0);

  // Lattice, in the pendulum frame (origin on the axis). Measured on the
  // plate at 58 px per unit about the axis circle at (237, 253): rows 0.9
  // apart, box columns leaning 0.32 left per unit of rise, diagonals parallel
  // at 35.6 degrees from each left box to the right box two rows up.
  const rowLevels = Object.freeze([-2.30, -1.40, -0.50, 0.40, 1.30, 2.20]);
  const stackLean = 0.32;
  const rightBoxX0 = 2.72;
  const diagonal = v2(2.98, 2.13);
  const rightBoxAt = (y) => v2(rightBoxX0 - stackLean * (y - rowLevels[0]), y);
  const rightBoxes = rowLevels.map(rightBoxAt);
  const leftBoxes = rowLevels.slice(0, 5).map((y) => rightBoxAt(y + 1.8).sub(diagonal));
  const elbows = leftBoxes.map((box, k) => v2(box.x, rowLevels[k]));
  const topOutlet = v2(-2.30, rowLevels[5]);
  const freeTop = leftBoxes[4].clone().addScaledVector(diagonal, 0.95);
  // Pass 70: the highest diagonal passes behind the top pipe; at the crossing
  // a port joins it to the top pipe, so the even serpentine too delivers
  // through Brown's one jet at the top pipe's open left end. The diagonal's
  // stub above the crossing stays open at its top (a vent, as drawn).
  const topJunction = leftBoxes[4].clone().addScaledVector(diagonal, (rowLevels[5] - leftBoxes[4].y) / diagonal.y);
  const lowerMouth = rightBoxes[1].clone().sub(diagonal);
  const rightBoxHalf = [0.23, 0.25];
  const leftBoxHalf = 0.22;
  const diagonalAngle = Math.atan2(diagonal.y, diagonal.x);
  // The scoop box takes water through a slot in its outer (right) wall,
  // which dips under the pool when the right side swings down.
  const scoopMouth = rightBoxes[0].clone().add(v2(rightBoxHalf[0], 0));

  // Pipe section. Horizontals lie in a front layer, diagonals in a back
  // layer (they pass behind the horizontals, as Brown draws); the boxes span
  // both. Each pipe is cut open along its front wall.
  const boreHalfWidth = 0.065;
  const wallThickness = 0.03;
  const layers = Object.freeze({
    back: Object.freeze({ z0: -0.40, z1: -0.10, plate: [-0.44, -0.40] }),
    front: Object.freeze({ z0: 0.0, z1: 0.30, plate: [-0.04, 0.0] }),
  });

  // The two serpentines as centre-line polylines with each segment's layer.
  const makePath = (points, segmentLayers) => {
    const lengths = points.slice(0, -1).map((p, i) => p.distanceTo(points[i + 1]));
    const stations = [0];
    for (const length of lengths) stations.push(stations.at(-1) + length);
    const angles = lengths.map((_, i) => Math.atan2(points[i + 1].y - points[i].y, points[i + 1].x - points[i].x));
    const corners = [];
    for (let i = 1; i < points.length - 1; i += 1) {
      corners.push({ index: i, layerChange: segmentLayers[i - 1] !== segmentLayers[i], station: stations[i] });
    }
    return { angles, corners, layers: segmentLayers, lengths, points, stations, total: stations.at(-1) };
  };
  const oddPoints = [lowerMouth, rightBoxes[1]];
  const oddLayers = ['back'];
  for (const k of [1, 3]) {
    oddPoints.push(elbows[k], leftBoxes[k], rightBoxes[k + 2]);
    oddLayers.push('front', 'front', 'back');
  }
  oddPoints.push(topOutlet);
  oddLayers.push('front');
  const evenPoints = [scoopMouth, rightBoxes[0]];
  const evenLayers = ['front'];
  for (const k of [0, 2, 4]) {
    evenPoints.push(elbows[k], leftBoxes[k], k < 4 ? rightBoxes[k + 2] : topJunction);
    evenLayers.push('front', 'front', 'back');
  }
  evenPoints.push(topOutlet);
  evenLayers.push('front');
  const paths = [makePath(oddPoints, oddLayers), makePath(evenPoints, evenLayers)];

  // Flaps: one per box that a pipe enters, hinged on the upper wall of the
  // entering pipe just short of the box, closing the whole bore against a
  // seat rib on the lower wall and against the layer's back plate, and
  // swinging open toward the box. A right box is entered by a diagonal, a
  // left box by its horizontal just before the elbow.
  const flapThickness = 0.024;
  const flapClearance = 0.003;
  const makeFlap = (path, pathIndex, cornerIndex, inset, boxRole) => {
    const segment = cornerIndex - 1;
    const direction = path.points[cornerIndex].clone().sub(path.points[segment]).normalize();
    let up = v2(-direction.y, direction.x);
    const sense = up.y >= 0 ? 1 : -1;
    up = up.multiplyScalar(sense);
    const seatCentre = path.points[cornerIndex].clone().addScaledVector(direction, -inset);
    return {
      angle: Math.atan2(direction.y, direction.x),
      boxRole,
      direction,
      hinge: seatCentre.clone().addScaledVector(up, boreHalfWidth),
      layer: path.layers[segment],
      path: pathIndex,
      seatCentre,
      sense,
      inset,
      station: path.stations[cornerIndex] - inset,
      up,
    };
  };
  // Odd serpentine corners: 1 right1, 2 elbow1, 3 left1, 4 right3, 5 elbow3,
  // 6 left3, 7 right5. Even: 1 right0, 2 elbow0, 3 left0, 4 right2, 5 elbow2,
  // 6 left2, 7 right4, 8 elbow4, 9 left4.
  const diagonalInset = 0.40;
  const horizontalInset = 0.22;
  const flapFrames = [
    makeFlap(paths[0], 0, 1, diagonalInset, 'right-box-1'),
    makeFlap(paths[0], 0, 2, horizontalInset, 'left-box-1'),
    makeFlap(paths[0], 0, 4, diagonalInset, 'right-box-3'),
    makeFlap(paths[0], 0, 5, horizontalInset, 'left-box-3'),
    makeFlap(paths[0], 0, 7, diagonalInset, 'right-box-5'),
    makeFlap(paths[1], 1, 2, horizontalInset, 'left-box-0'),
    makeFlap(paths[1], 1, 4, diagonalInset, 'right-box-2'),
    makeFlap(paths[1], 1, 5, horizontalInset, 'left-box-2'),
    makeFlap(paths[1], 1, 7, diagonalInset, 'right-box-4'),
    makeFlap(paths[1], 1, 8, horizontalInset, 'left-box-4'),
  ];
  const valveCount = flapFrames.length;
  const maximumFlapAngle = THREE.MathUtils.degToRad(62);
  const reservoirSurfaceLocalY = -2.645;
  const reservoirSurfaceY = gutterPivot.y + reservoirSurfaceLocalY;
  const bedY = -2.85;

  // Conserved water: each serpentine is a two-phase shift register of three
  // equal parcels (bore section x parcelLength) in alternate compartments
  // between closed flaps. On its exchange half-swing (the odd serpentine
  // when the left side goes down, sin > 0; the even one when the right side
  // goes down) the odd-numbered flaps of that serpentine open: the top parcel
  // pours out of the open end, the middle parcel advances one compartment
  // and the dipping scoop takes one parcel in. On the other half the
  // even-numbered flaps open, the other parcels advance and the scooped
  // parcel runs up to the first flap. So every horizontal is traversed while
  // it slopes down toward its left box, and what each serpentine pours per
  // cycle is exactly what its scoop took in.
  const parcelLength = 0.7;
  const parcelGap = 0.002;
  const exitSpeedFractions = [0.8, 0.8];
  // Pass 70: the even serpentine delivers into the top pipe. On its exchange
  // half its top parcel climbs the highest diagonal and through the port into
  // the top pipe, where it waits just past the junction; on the other half
  // (the left-down swing, when the top pipe slopes to its open end) it runs
  // out of Brown's jet ahead of the odd serpentine's parcel. So both pour on
  // the left-down swing, one jet, and every horizontal run is still made
  // while it slopes toward its left end.
  const junctionStation = paths[1].stations.at(-2);
  const registers = paths.map((path, pathIndex) => {
    const flaps = flapFrames.filter((frame) => frame.path === pathIndex);
    const rest = flaps.map((frame) => frame.station - flapThickness / 2 - parcelGap);
    const scoopRest = parcelLength + 0.05;
    const outEnd = path.total + parcelLength;
    const wait = pathIndex === 1 ? junctionStation + parcelLength + 0.05 : null;
    const from = pathIndex === 1 ? wait : rest[4];
    const dest = from + (outEnd - from) / exitSpeedFractions[pathIndex];
    // The right scoop's slot is under the pool only while the swing is past
    // seven degrees, so its intake is confined to that part of the half.
    const intake = pathIndex === 0 ? [PARCEL_START, PARCEL_SPAN] : [0.22, 0.56];
    const exchange = [
      [rest[0], rest[1]], [rest[2], rest[3]], pathIndex === 1 ? [rest[4], wait] : [from, dest], [0, scoopRest, ...intake],
    ];
    const transfer = [[rest[1], rest[2]], [rest[3], rest[4]], [scoopRest, rest[0]]];
    if (pathIndex === 1) transfer.push([wait, dest]);
    const exchangeHalf = pathIndex === 0 ? 0 : 1;
    // Both serpentines pour on the left-down swing (half 0): the odd one on
    // its exchange move 2, the even one on its transfer move 3.
    const pourHalf = 0;
    const pourMove = pathIndex === 0 ? 2 : 3;
    const window = [
      inverseParcelProfile((path.total - from) / (dest - from)),
      inverseParcelProfile(exitSpeedFractions[pathIndex]),
    ].map((u) => (pourHalf + u) * cycleDuration / 2);
    return { dest, exchange, exchangeHalf, from, pourHalf, pourMove, rest, scoopRest, transfer, wait, window };
  });
  flapFrames.forEach((frame) => {
    const order = flapFrames.filter((other) => other.path === frame.path).indexOf(frame);
    const exchangeHalf = registers[frame.path].exchangeHalf;
    frame.openHalf = order % 2 === 0 ? exchangeHalf : 1 - exchangeHalf;
  });
  const boreArea = 2 * boreHalfWidth * (layers.front.z1 - layers.front.z0);

  const stateAtInputAngle = (inputAngle, inputSpeed = inputAngularSpeed, inputAcceleration = 0) => {
    const rawCycleAngle = THREE.MathUtils.euclideanModulo(inputAngle, FULL_TURN);
    const cycleAngle = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].find(
      (boundary) => Math.abs(rawCycleAngle - boundary) < 1e-12,
    ) ?? rawCycleAngle;
    const phase = cycleAngle / FULL_TURN;
    const swingAngle = swingAmplitude * Math.sin(cycleAngle);
    const swingAngularSpeed = swingAmplitude * Math.cos(cycleAngle) * inputSpeed;
    const swingAngularAcceleration = swingAmplitude * (
      -Math.sin(cycleAngle) * inputSpeed ** 2 + Math.cos(cycleAngle) * inputAcceleration);
    const half = cycleAngle < Math.PI ? 0 : 1;
    const u = (cycleAngle - half * Math.PI) / Math.PI;
    const uRate = inputSpeed / Math.PI;
    const active = flapProfile(u);
    const opening = {
      acceleration: active.d2 * uRate ** 2 + active.d1 * inputAcceleration / Math.PI,
      rate: active.d1 * uRate,
      value: active.value,
    };
    const closed = { acceleration: 0, rate: 0, value: 0 };
    const profiles = flapFrames.map((frame) => (frame.openHalf === half ? opening : closed));
    const valveOpenAmounts = profiles.map((profile) => profile.value);
    const valveOpenRates = profiles.map((profile) => profile.rate);
    const valveOpenAccelerations = profiles.map((profile) => profile.acceleration);
    const flapAngles = valveOpenAmounts.map((amount) => maximumFlapAngle * amount);
    const parcels = [];
    const serpentines = registers.map((register, pathIndex) => {
      const total = paths[pathIndex].total;
      const exchanging = register.exchangeHalf === half;
      const moves = exchanging ? register.exchange : register.transfer;
      const own = moves.map(([from, to, start, span]) => {
        const travel = parcelProfile(u, start, span);
        const head = from + (to - from) * travel.value;
        const parcel = { from, head, path: pathIndex, speed: (to - from) * travel.d1 * uRate, tail: head - parcelLength, to };
        parcels.push(parcel);
        return parcel;
      });
      let conduitLength = 0;
      for (const parcel of own) {
        conduitLength += Math.max(0, Math.min(total, parcel.head) - Math.max(0, parcel.tail));
      }
      const pouring = register.pourHalf === half ? own[register.pourMove] : null;
      const scooping = exchanging ? own[3] : null;
      return {
        conduitLength,
        exchanging,
        poured: pouring ? THREE.MathUtils.clamp(pouring.head - total, 0, parcelLength) : 0,
        pourSpeed: pouring && pouring.head > total && pouring.tail < total ? pouring.speed : 0,
        scooped: scooping ? THREE.MathUtils.clamp(scooping.head, 0, parcelLength) : 0,
      };
    });
    const toWorld = (point) => rotateLocal(point, swingAngle).add(gutterPivot);
    const velocityOf = (point) => {
      const radius = rotateLocal(point, swingAngle);
      return v2(-radius.y, radius.x).multiplyScalar(swingAngularSpeed);
    };
    let activeValveSet = 'all-flaps-seated-at-neutral-crossing';
    if (active.value > 1e-12) {
      activeValveSet = half === 0
        ? 'right-box-flaps-open-left-side-down'
        : 'left-box-flaps-open-right-side-down';
    }
    return {
      activeValveSet,
      flapAngles,
      half,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      lowerMouth: toWorld(lowerMouth),
      lowerMouthImmersion: reservoirSurfaceY - toWorld(lowerMouth).y,
      outlet: toWorld(topOutlet),
      outletVelocity: velocityOf(topOutlet),
      parcels,
      phase,
      scoopImmersion: reservoirSurfaceY - toWorld(scoopMouth).y,
      scoopMouth: toWorld(scoopMouth),
      serpentines,
      swingAngle,
      swingAngularAcceleration,
      swingAngularSpeed,
      topFreeEnd: toWorld(freeTop),
      transferFraction: u,
      valveOpenAccelerations,
      valveOpenAmounts,
      valveOpenRates,
    };
  };
  const stateAtTime = (time) => stateAtInputAngle(inputAngularSpeed * time, inputAngularSpeed, 0);

  // Centre line, section direction and layer depth at arc length s. Within
  // cornerBlend of a corner the section turns smoothly from the incoming to
  // the outgoing direction, and in a box it moves between the layers.
  const cornerBlend = 0.12;
  const layerBlend = 0.2;
  const pathAt = (path, s, target) => {
    const station = THREE.MathUtils.clamp(s, 0, path.total);
    let segment = 0;
    while (segment < path.lengths.length - 1 && station > path.stations[segment + 1]) segment += 1;
    const t = (station - path.stations[segment]) / path.lengths[segment];
    target.point.copy(path.points[segment]).lerp(path.points[segment + 1], t);
    let angle = path.angles[segment];
    let z0 = layers[path.layers[segment]].z0, z1 = layers[path.layers[segment]].z1;
    for (const corner of path.corners) {
      const offset = station - corner.station;
      if (Math.abs(offset) < cornerBlend) {
        const before = path.angles[corner.index - 1];
        const turn = Math.atan2(Math.sin(path.angles[corner.index] - before), Math.cos(path.angles[corner.index] - before));
        const x = (offset + cornerBlend) / (2 * cornerBlend);
        angle = before + turn * x * x * (3 - 2 * x);
      }
      if (corner.layerChange && Math.abs(offset) < layerBlend) {
        const a = layers[path.layers[corner.index - 1]], b = layers[path.layers[corner.index]];
        const x = (offset + layerBlend) / (2 * layerBlend);
        const w = x * x * (3 - 2 * x);
        z0 = a.z0 + (b.z0 - a.z0) * w;
        z1 = a.z1 + (b.z1 - a.z1) * w;
      }
    }
    target.normal.set(-Math.sin(angle), Math.cos(angle), 0);
    target.tangent.set(Math.cos(angle), Math.sin(angle), 0);
    target.z0 = z0;
    target.z1 = z1;
    return target;
  };

  const timberMaterial = matte(PALETTE.brass, { metalness: 0.14, roughness: 0.56 });
  const wallMaterial = timberMaterial.clone();
  wallMaterial.color.multiplyScalar(0.82);
  const frameMaterial = matte(PALETTE.frame, { metalness: 0.18, roughness: 0.66 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.18, roughness: 0.52 });
  const flapMaterial = matte(PALETTE.accent, { metalness: 0.10, roughness: 0.58 });
  const pinMaterial = matte(PALETTE.ink, { metalness: 0.3, roughness: 0.45 });

  // The pool, ruled across the whole plate, from its surface to the bed.
  const reservoir = addRole(new THREE.Mesh(new THREE.BoxGeometry(8.1, reservoirSurfaceY - bedY, 2.4), waterVolumeMaterial()),
    'lower-reservoir-entered-by-both-scoops');
  reservoir.position.set(0.15, (reservoirSurfaceY + bedY) / 2, -0.2);
  reservoir.renderOrder = 1;
  root.add(reservoir);

  // Fixed axis: Brown dots two upright posts behind the lattice from the axis
  // down into the water; a short cross-head between them carries the axle.
  const support = addRole(new THREE.Group(), 'fixed-posts-carrying-central-pendulum-axis');
  root.add(support);
  const postZ = -0.66;
  const posts = [-0.44, 0.14].map((x) => {
    const height = gutterPivot.y + 0.14 - bedY;
    const post = addRole(new THREE.Mesh(new THREE.BoxGeometry(0.1, height, 0.1), frameMaterial), 'fixed-post-dotted-behind-lattice');
    post.position.set(x, bedY + height / 2, postZ);
    support.add(post);
    return post;
  });
  const crossHead = addRole(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.18, 0.12), frameMaterial), 'fixed-cross-head-carrying-axle');
  crossHead.position.set(-0.15, gutterPivot.y, postZ);
  support.add(crossHead);
  const pivotAxle = addRole(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.10, 40), darkMaterial),
    'fixed-central-pendulum-pivot-axle');
  pivotAxle.rotation.x = Math.PI / 2;
  pivotAxle.position.set(gutterPivot.x, gutterPivot.y, -0.55);
  root.add(pivotAxle);

  const swingingGutter = addRole(new THREE.Group(), 'one-rigid-lattice-of-two-interleaved-swinging-gutters');
  swingingGutter.position.copy(gutterPivot);
  root.add(swingingGutter);

  // The X of braces behind the pipes, bored on the axle.
  const braceShape = clip.difference(
    clip.union(
      capsule([-0.64, 0.88], [0.79, -1.03], 0.045, 16),
      capsule([0.64, 0.88], [-0.79, -1.03], 0.045, 16),
      poly(circle([0, 0], 0.13, 64)),
    ),
    poly(circle([0, 0], 0.073, 64)),
  );
  const braces = addRole(new THREE.Mesh(plate(braceShape, -0.52, -0.44), frameMaterial), 'crossed-lattice-braces-hung-on-the-axle');
  swingingGutter.add(braces);

  // Pipe and box walls (2D profiles extruded through each layer).
  const ventStub = { a: topJunction, b: freeTop, layer: 'back' };
  const bands = (layer, radius) => {
    const shapes = [];
    if (ventStub.layer === layer) shapes.push(capsule(xy(ventStub.a), xy(ventStub.b), radius, 12));
    for (const path of paths) {
      path.lengths.forEach((_, i) => {
        if (path.layers[i] === layer) shapes.push(capsule(xy(path.points[i]), xy(path.points[i + 1]), radius, 12));
      });
    }
    return clip.union(...shapes);
  };
  const rotatedSquare = (centre, half, angle) => poly([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [
    centre.x + half * (a * Math.cos(angle) - b * Math.sin(angle)),
    centre.y + half * (a * Math.sin(angle) + b * Math.cos(angle)),
  ]));
  const rectangleAt = (centre, hx, hy) => poly([[centre.x - hx, centre.y - hy], [centre.x + hx, centre.y - hy], [centre.x + hx, centre.y + hy], [centre.x - hx, centre.y + hy]]);
  const boxOutlines = clip.union(
    ...rightBoxes.map((c) => rectangleAt(c, rightBoxHalf[0], rightBoxHalf[1])),
    ...leftBoxes.map((c) => rotatedSquare(c, leftBoxHalf, diagonalAngle)),
  );
  const boxInteriors = clip.union(
    ...rightBoxes.map((c) => rectangleAt(c, rightBoxHalf[0] - wallThickness, rightBoxHalf[1] - wallThickness)),
    ...leftBoxes.map((c) => rotatedSquare(c, leftBoxHalf - wallThickness, diagonalAngle)),
  );
  // Open ends: cut square past the lower mouth, the top outlet, the free
  // top and the scoop slot in the outer wall of the right scoop box.
  const endCutter = (point, direction) => {
    const d = direction.clone().normalize(), n = v2(-d.y, d.x);
    const at = (a, b) => [point.x + d.x * a + n.x * b, point.y + d.y * a + n.y * b];
    return poly([at(0, -0.3), at(0.4, -0.3), at(0.4, 0.3), at(0, 0.3)]);
  };
  const openEnds = [
    endCutter(lowerMouth, lowerMouth.clone().sub(rightBoxes[1])),
    endCutter(topOutlet, v2(-1, 0)),
    endCutter(freeTop, diagonal),
    endCutter(scoopMouth, v2(1, 0)),
  ];
  const scoopOpening = rectangleAt(scoopMouth, wallThickness * 1.5, boreHalfWidth);
  const knuckles = { back: [], front: [] }, pockets = { back: [], front: [] }, ribs = { back: [], front: [] };
  for (const frame of flapFrames) {
    knuckles[frame.layer].push(poly(circle(xy(frame.hinge), 0.05, 40)));
    pockets[frame.layer].push(poly(circle(xy(frame.hinge), 0.031, 40)));
    const at = (along, across) => {
      const p = frame.seatCentre.clone().addScaledVector(frame.direction, along).addScaledVector(frame.up, across);
      return [p.x, p.y];
    };
    const x0 = -flapThickness / 2 - 0.03, x1 = -flapThickness / 2 - 0.0008;
    const y0 = -boreHalfWidth - wallThickness / 2, y1 = -boreHalfWidth + 0.022;
    ribs[frame.layer].push(poly([at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)]));
  }
  const conduit = {};
  const mouths = {};
  for (const layer of ['front', 'back']) {
    const outline = clip.union(bands(layer, boreHalfWidth + wallThickness), ...knuckles[layer]);
    const inside = bands(layer, boreHalfWidth);
    mouths[layer] = inside;
    const walls = clip.difference(
      clip.union(clip.difference(outline, inside, boxOutlines, ...openEnds), ...ribs[layer]),
      ...pockets[layer],
    );
    const { z0, z1, plate: [p0, p1] } = layers[layer];
    conduit[`${layer}Walls`] = addRole(new THREE.Mesh(plate(walls, z0, z1), wallMaterial), `finite-${layer}-layer-pipe-walls-with-flap-seats`);
    const backShape = layer === 'front'
      ? clip.difference(outline, boxOutlines, ...openEnds, poly(circle(xy(topJunction), boreHalfWidth, 40)))
      : clip.union(clip.difference(outline, ...openEnds), boxOutlines);
    conduit[`${layer}Back`] = addRole(new THREE.Mesh(plate(backShape, p0, p1), timberMaterial), `finite-${layer}-layer-pipe-back-plate`);
  }
  const boxRing = clip.difference(boxOutlines, boxInteriors);
  // The port's short collar bridging the gap between the two layers at the
  // top junction (hidden behind the top pipe in Brown's view).
  conduit.junctionCollar = addRole(new THREE.Mesh(
    plate(clip.difference(poly(circle(xy(topJunction), boreHalfWidth + wallThickness, 40)), poly(circle(xy(topJunction), boreHalfWidth, 40))),
      layers.back.z1, layers.front.plate[0]), wallMaterial),
  'port-collar-joining-top-diagonal-to-top-pipe');
  conduit.boxBackWalls = addRole(new THREE.Mesh(
    plate(clip.difference(boxRing, mouths.back, scoopOpening), layers.back.z0, layers.back.z1), wallMaterial),
  'box-walls-ported-for-diagonals');
  conduit.boxMiddleWalls = addRole(new THREE.Mesh(
    plate(clip.difference(boxRing, scoopOpening), layers.back.z1, layers.front.z0), wallMaterial),
  'box-walls-between-pipe-layers');
  conduit.boxFrontWalls = addRole(new THREE.Mesh(
    plate(clip.difference(boxRing, mouths.front, scoopOpening), layers.front.z0, layers.front.z1), wallMaterial),
  'box-walls-ported-for-horizontals');
  for (const mesh of Object.values(conduit)) swingingGutter.add(mesh);

  const flaps = [];
  const flapBossRadius = 0.026;
  const flapBoreRadius = 0.014;
  const flapReach = 2 * boreHalfWidth - flapClearance;
  flapFrames.forEach((frame, index) => {
    const mount = new THREE.Group();
    mount.position.copy(frame.hinge);
    mount.rotation.z = frame.angle;
    swingingGutter.add(mount);
    const s = frame.sense;
    const halfT = flapThickness / 2;
    const face = clip.difference(
      clip.union(
        poly([[-halfT, 0], [halfT, 0], [halfT, -s * flapReach], [-halfT, -s * flapReach]]),
        poly(circle([0, 0], flapBossRadius, 40)),
      ),
      poly(circle([0, 0], flapBoreRadius, 40)),
    );
    const { z0, z1 } = layers[frame.layer];
    const flap = addRole(new THREE.Mesh(plate(face, z0 + 0.002, z1 - 0.002), flapMaterial),
      `one-way-flap-valve-${index + 1}-at-${frame.boxRole}`);
    mount.add(flap);
    const pin = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(flapBoreRadius - 0.002, flapBoreRadius - 0.002, z1 - z0 - 0.002, 24), pinMaterial),
    'fixed-elbow-flap-hinge');
    pin.rotation.x = Math.PI / 2;
    pin.position.z = (z0 + z1 - 0.002) / 2;
    mount.add(pin);
    flaps.push({ flap, mount, pin, sense: s });
  });

  // Water is drawn per compartment: each mesh shows the water inside one
  // fixed stretch of a serpentine (scoop end, the compartments between
  // flaps, the top run), so every mesh changes continuously as parcels
  // cross the flaps and the picture repeats exactly every swing cycle.
  const parcelMaterial = waterVolumeMaterial({ opacity: 0.55 });
  parcelMaterial.side = THREE.DoubleSide;
  // A boundary at a flap on a diagonal is moved on to the start of the
  // horizontal beyond that flap's box, so water crosses every boundary
  // square to the pipe (a compartment still holds one parcel at most).
  const compartments = paths.flatMap((path, pathIndex) => {
    const register = registers[pathIndex];
    const flapBoundaries = flapFrames.filter((frame) => frame.path === pathIndex).map((frame) => (
      frame.layer === 'back' ? frame.station + frame.inset + 0.35 : frame.station));
    const boundaries = [0, (register.scoopRest + register.rest[0] - parcelLength) / 2, ...flapBoundaries, path.total];
    return boundaries.slice(0, -1).map((low, index) => ({
      high: boundaries[index + 1],
      // The two open ends that meet the pipe obliquely (the lower mouth in
      // the pool and the free top) fade their last sliver of water in or
      // out with its length, instead of switching on a slanting face.
      fadeEnd: pathIndex === 0 && index === 0 ? 'low' : null,
      low,
      path: pathIndex,
    }));
  });
  const waterSlugs = compartments.map((compartment, index) => {
    const water = addRole(new THREE.Mesh(parcelGeometry(), parcelMaterial.clone()),
      `conserved-water-in-serpentine-${compartment.path + 1}-compartment-${index + 1}`);
    water.renderOrder = 1;
    water.frustumCulled = false;
    swingingGutter.add(water);
    return water;
  });

  const sample = { normal: new THREE.Vector3(), point: new THREE.Vector3(), tangent: new THREE.Vector3(), z0: 0, z1: 0 };
  const writeParcel = (mesh, path, tail, head, low = 0, high = path.total) => {
    const a = THREE.MathUtils.clamp(tail, low, high), b = THREE.MathUtils.clamp(head, low, high);
    mesh.visible = b - a > 1e-5;
    if (!mesh.visible) return;
    // Only the parcel's own ends are capped; where the compartment boundary
    // cuts it the water runs on into the next mesh.
    const capped = [tail > low - 1e-9, head < high + 1e-9];
    const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array;
    const halfWidth = boreHalfWidth - 0.004;
    let v = 0;
    const put = (x, y, z, nx, ny, nz) => {
      P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
      N[v * 3] = nx; N[v * 3 + 1] = ny; N[v * 3 + 2] = nz;
      v += 1;
    };
    let first = null, last = null;
    for (let k = 0; k < PARCEL_STATIONS; k += 1) {
      pathAt(path, a + (b - a) * k / (PARCEL_STATIONS - 1), sample);
      const { point: p, normal: n } = sample;
      const lo = [p.x - halfWidth * n.x, p.y - halfWidth * n.y], hi = [p.x + halfWidth * n.x, p.y + halfWidth * n.y];
      const z0 = sample.z0 + 0.004, z1 = sample.z1 - 0.004;
      put(hi[0], hi[1], z1, n.x, n.y, 0); put(hi[0], hi[1], z0, n.x, n.y, 0);
      put(lo[0], lo[1], z0, -n.x, -n.y, 0); put(lo[0], lo[1], z1, -n.x, -n.y, 0);
      put(lo[0], lo[1], z1, 0, 0, 1); put(hi[0], hi[1], z1, 0, 0, 1);
      put(hi[0], hi[1], z0, 0, 0, -1); put(lo[0], lo[1], z0, 0, 0, -1);
      if (k === 0) first = { hi, lo, t: sample.tangent.clone(), z0, z1 };
      if (k === PARCEL_STATIONS - 1) last = { hi, lo, t: sample.tangent.clone(), z0, z1 };
    }
    for (const [end, sign, cap] of [[first, -1, capped[0]], [last, 1, capped[1]]]) {
      const t = end.t.multiplyScalar(sign);
      if (!cap) {
        for (let i = 0; i < 4; i += 1) put(end.lo[0], end.lo[1], end.z0, t.x, t.y, 0);
        continue;
      }
      put(end.lo[0], end.lo[1], end.z0, t.x, t.y, 0);
      put(end.hi[0], end.hi[1], end.z0, t.x, t.y, 0);
      put(end.hi[0], end.hi[1], end.z1, t.x, t.y, 0);
      put(end.lo[0], end.lo[1], end.z1, t.x, t.y, 0);
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.attributes.normal.needsUpdate = true;
  };

  // Poured streams. Brown's rows are about a foot apart (0.9 units), so a
  // unit is about a third of a metre and gravity about three times the
  // helper's unit-metre value. The top jet breaks into the spray Brown draws
  // and is spent within the plate. Both serpentines pour through it, on
  // alternate half-swings (pass 70; the even one used to throw its water from
  // the free diagonal back over the right boxes into the pool).
  const gravity = v2(0, -3 * STREAM_GRAVITY);
  const outlets = [
    { direction: v2(-1, 0), point: topOutlet, sprayLife: 0.3, zCentre: (layers.front.z0 + layers.front.z1) / 2 },
    { direction: v2(-1, 0), point: topOutlet, sprayLife: 0.3, zCentre: (layers.front.z0 + layers.front.z1) / 2 },
  ];
  const jetMaterial = waterStreamMaterial({ opacity: 0.55 });
  const dischargeJets = outlets.map((_, index) => {
    const jet = addRole(new THREE.Mesh(jetGeometry(), jetMaterial), `poured-stream-from-serpentine-${index + 1}`);
    jet.renderOrder = 2;
    jet.frustumCulled = false;
    jet.userData.waterStream = true;
    root.add(jet);
    return jet;
  });
  const emissionState = { origin: new THREE.Vector3(), outflow: 0, velocity: new THREE.Vector3() };
  const emission = (pathIndex, tau, target) => {
    const register = registers[pathIndex], outlet = outlets[pathIndex];
    const angle = inputAngularSpeed * tau;
    const theta = swingAmplitude * Math.sin(angle);
    const omega = swingAmplitude * Math.cos(angle) * inputAngularSpeed;
    const radius = rotateLocal(outlet.point, theta);
    target.origin.copy(radius).add(gutterPivot);
    target.origin.z = outlet.zCentre;
    const u = THREE.MathUtils.clamp(angle / Math.PI - register.pourHalf, 0, 1);
    const outflow = (register.dest - register.from) * parcelProfile(u).d1 * inputAngularSpeed / Math.PI;
    target.velocity.set(-radius.y * omega, radius.x * omega, 0)
      .addScaledVector(rotateLocal(outlet.direction, theta), outflow);
    target.outflow = outflow;
    return target;
  };
  const particleAt = (pathIndex, tau, now, target) => {
    emission(pathIndex, tau, emissionState);
    const age = THREE.MathUtils.euclideanModulo(now - tau, cycleDuration);
    target.copy(emissionState.origin).addScaledVector(emissionState.velocity, age)
      .addScaledVector(gravity, 0.5 * age * age);
    return age;
  };
  const probe = new THREE.Vector3();
  const alive = (pathIndex, tau, now) => {
    const age = particleAt(pathIndex, tau, now, probe);
    return probe.y > reservoirSurfaceY && age < outlets[pathIndex].sprayLife;
  };
  const jetPoints = Array.from({ length: JET_STATIONS }, () => new THREE.Vector3());
  const jetTaus = new Float64Array(JET_STATIONS);
  const jetTangent = new THREE.Vector3(), jetAcross = new THREE.Vector3(), jetNormal = new THREE.Vector3();
  const jetColor = new THREE.Color(PALETTE.fluid);
  const writeJet = (pathIndex, time) => {
    const jet = dischargeJets[pathIndex];
    const now = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const [start, end] = registers[pathIndex].window;
    const upper = now >= start && now <= end ? now : end;
    if (!(upper > start) || !alive(pathIndex, upper, now)) { jet.visible = false; return; }
    let lower = start;
    if (!alive(pathIndex, lower, now)) {
      let dead = lower, live = upper;
      for (let i = 0; i < 40; i += 1) {
        const mid = (dead + live) / 2;
        if (alive(pathIndex, mid, now)) live = mid; else dead = mid;
      }
      lower = live;
    }
    if (upper - lower < 1e-4) { jet.visible = false; return; }
    jet.visible = true;
    for (let i = 0; i < JET_STATIONS; i += 1) {
      const tau = upper - (upper - lower) * i / (JET_STATIONS - 1);
      jetTaus[i] = tau;
      particleAt(pathIndex, tau, now, jetPoints[i]);
    }
    const g = jet.geometry;
    const P = g.attributes.position.array, Nn = g.attributes.normal.array;
    const UV = g.attributes.uv.array, C = g.attributes.color.array;
    const ring = JET_SIDES + 1;
    const halfDepth = (layers.front.z1 - layers.front.z0) / 2 - 0.01;
    const halfWidth = boreHalfWidth - 0.006;
    const life = outlets[pathIndex].sprayLife;
    const writeRing = (i, base, capSign) => {
      const p = jetPoints[i];
      const j0 = Math.max(0, i - 1), j1 = Math.min(JET_STATIONS - 1, i + 1);
      jetTangent.subVectors(jetPoints[j0], jetPoints[j1]);
      const separation = jetTangent.length() / Math.max(1e-9, Math.abs(jetTaus[j0] - jetTaus[j1]));
      if (jetTangent.lengthSq() < 1e-14) jetTangent.copy(outlets[pathIndex].direction);
      jetTangent.normalize();
      emission(pathIndex, jetTaus[i], emissionState);
      // Continuity: the section carries its instant's outflow (bore area x
      // parcel speed) spread over the rate at which successive water
      // separates along the stream; the thinning stream flattens across the
      // plane and opens as it breaks up.
      const factor = THREE.MathUtils.clamp(Math.max(0, emissionState.outflow) / Math.max(1e-6, separation), 0, 1.05);
      const age = THREE.MathUtils.euclideanModulo(now - jetTaus[i], cycleDuration);
      const open = 1 + 1.2 * THREE.MathUtils.smoothstep(age, 0.05, Math.min(life, 0.5));
      jetAcross.set(0, 0, 1).addScaledVector(jetTangent, -jetTangent.z).normalize();
      jetNormal.crossVectors(jetTangent, jetAcross).normalize();
      const a = Math.max(0.004, halfDepth * factor ** 0.7 / open);
      const b = Math.max(0.004, halfWidth * factor ** 0.3 * open);
      const fade = THREE.MathUtils.smoothstep(p.y - reservoirSurfaceY, 0, 0.2)
        * (1 - THREE.MathUtils.smoothstep(age, 0.5 * life, life));
      for (let j = 0; j <= JET_SIDES; j += 1) {
        const angle = (j / JET_SIDES) * FULL_TURN;
        const c = Math.cos(angle), s = Math.sin(angle);
        const k = base + j;
        P[k * 3] = p.x + jetAcross.x * a * c + jetNormal.x * b * s;
        P[k * 3 + 1] = p.y + jetAcross.y * a * c + jetNormal.y * b * s;
        P[k * 3 + 2] = p.z + jetAcross.z * a * c + jetNormal.z * b * s;
        let nx, ny, nz;
        if (capSign) { nx = jetTangent.x * capSign; ny = jetTangent.y * capSign; nz = jetTangent.z * capSign; } else {
          nx = jetAcross.x * c * b + jetNormal.x * s * a;
          ny = jetAcross.y * c * b + jetNormal.y * s * a;
          nz = jetAcross.z * c * b + jetNormal.z * s * a;
          const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        }
        Nn[k * 3] = nx; Nn[k * 3 + 1] = ny; Nn[k * 3 + 2] = nz;
        UV[k * 2] = (j / JET_SIDES) * 2;
        UV[k * 2 + 1] = jetTaus[i] * 3;
        C[k * 4] = jetColor.r; C[k * 4 + 1] = jetColor.g; C[k * 4 + 2] = jetColor.b; C[k * 4 + 3] = fade;
      }
    };
    for (let i = 0; i < JET_STATIONS; i += 1) writeRing(i, i * ring, 0);
    for (const [capIndex, i, sign] of [[0, 0, 1], [1, JET_STATIONS - 1, -1]]) {
      const centre = JET_STATIONS * ring + capIndex * (ring + 1);
      writeRing(i, centre + 1, sign);
      const p = jetPoints[i];
      P[centre * 3] = p.x; P[centre * 3 + 1] = p.y; P[centre * 3 + 2] = p.z;
      for (let c = 0; c < 3; c += 1) Nn[centre * 3 + c] = Nn[(centre + 1) * 3 + c];
      UV[centre * 2] = 0; UV[centre * 2 + 1] = jetTaus[i] * 3;
      for (let c = 0; c < 4; c += 1) C[centre * 4 + c] = C[(centre + 1) * 4 + c];
    }
    for (const name of ['position', 'normal', 'uv', 'color']) g.attributes[name].needsUpdate = true;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    swingingGutter.rotation.z = state.swingAngle;
    compartments.forEach((compartment, index) => {
      const parcel = state.parcels.find((candidate) => candidate.path === compartment.path
        && candidate.head > compartment.low + 1e-9 && candidate.tail < compartment.high - 1e-9);
      if (parcel) writeParcel(waterSlugs[index], paths[compartment.path], parcel.tail, parcel.head, compartment.low, compartment.high);
      else waterSlugs[index].visible = false;
      if (parcel) {
        // A sliver just across a boundary is drawn faint over its first few
        // hundredths, so no slanted face switches on at full strength.
        const length = Math.min(parcel.head, compartment.high) - Math.max(parcel.tail, compartment.low);
        waterSlugs[index].material.opacity = parcelMaterial.opacity
          * THREE.MathUtils.smoothstep(length, 0, compartment.fadeEnd ? 0.35 : 0.06);
      }
    });
    for (let index = 0; index < flaps.length; index += 1) {
      flaps[index].flap.rotation.z = flaps[index].sense * state.flapAngles[index];
    }
    writeJet(0, time);
    writeJet(1, time);
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    boreHalfWidth,
    compartments,
    cycleDuration,
    diagonal,
    dischargeWindows: registers.map((register) => register.window),
    flapClearance,
    flapFrames,
    flapThickness,
    freeTop,
    gutterPivot,
    topJunction,
    inputAngularSpeed,
    layers,
    leftBoxes,
    lowerMouth,
    maximumFlapAngle,
    parcelLength,
    parcelVolume: boreArea * parcelLength,
    paths,
    registers,
    reservoirSurfaceY,
    rightBoxes,
    rowLevels,
    scoopMouth,
    stackLean,
    swingAmplitude,
    topOutlet,
    valveCount,
  };
  root.userData = {
    archetype: 'rigid-serpentine-swinging-gutter-with-bottom-scoop-top-outlet-and-one-way-flap-boxes',
    blocks: {
      braces,
      conduit,
      crossHead,
      dischargeJets,
      flaps,
      pivotAxle,
      posts,
      reservoir,
      support,
      swingingGutter,
      waterSlugs,
    },
    degreesOfFreedom: {
      branchMotionIndependent: false,
      flapOpeningIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      swingingAssemblyIsRigid: true,
    },
    dynamics: {
      fullFluidMomentumFreeSurfaceLossesValveImpactLeakagePendulumDriveTorqueAndStructuralFlexureModeled: false,
      flowModel:
        'Each serpentine is a two-phase shift register of three equal water parcels (bore section x parcel length) in alternate compartments between closed flaps. On its exchange half-swing its top parcel pours out of the open end, its middle parcel advances and its dipping scoop takes one parcel in; on the other half its other parcels advance and the scooped parcel runs up to the first flap. Water in the pipes plus water poured minus water scooped is constant. Parcel motion is prescribed (quintic, at rest at each reversal); inertial driving, pressures and leakage are not solved.',
      swingModel:
        'The whole lattice is one rigid pendulum with a sinusoidal 12-degree swing. Each flap of the active set lifts over the first fifth of its half-swing and reseats on its seat rib before the half ends, with quintic smoothing so it seats with zero velocity and acceleration.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One rigid lattice swings on a fixed central axis carried by two posts. Six horizontal pipes (front layer) and six parallel diagonal pipes (back layer) meet in eleven boxes and form two interleaved serpentines. The first rises from an open pipe end under water through the odd rows and pours from the open left end of the top pipe; the second starts at the scoop box on the right of the lowest row, climbs the even rows and pours from the free top of the last diagonal. Every box has a one-way flap hinged on the upper wall of the pipe that enters it, closing the whole bore against a seat rib; alternate half-swings open alternate flap sets so the water advances one compartment per half-swing.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType: 'sinusoidal-rigid-pendulum-with-alternating-one-way-valve-transfer',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      activeValveSet: sourceState.activeValveSet,
      outlet: sourceState.outlet.clone(),
      swingAngle: sourceState.swingAngle,
    },
    sourceReference: {
      brownPlate461: {
        approximateAxisCirclePixels: [237, 253],
        approximateFreeTopPixels: [273, 70],
        approximateLowerMouthPixels: [202, 455],
        approximateTopOutletPixels: [103, 123],
        diagonalBranchCount: 6,
        horizontalBranchCount: 6,
        imageHeight: 525,
        imageWidth: 525,
        leftBoxCount: 5,
        measurementUncertaintyPixels: 6,
        pixelsPerUnit: 58.1,
        rightBoxCount: 6,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'pendulums or swinging gutters raise water by pendulous motion',
          'the bottom terminations are scoops',
          'the top terminations are open pipes',
          'intermediate angles are boxes containing a flap valve',
          'each intermediate box joins two pipe branches',
        ],
        engravingEvidence:
          'Brown shows six horizontal pipes with square boxes at their right ends and tilted boxes below their left ends, six parallel diagonal pipes each rising from a left box (the lowest from under water) behind the next horizontal to the right box two rows up, a free open top on the highest diagonal, the jet from the open left end of the top pipe, a small axis circle with crossed braces, and two dotted posts below the axis into the water.',
        reconstructionDisclosure:
          'Brown gives no dimensions, valve hinge orientation, swing amplitude, period, fluid volume, head, pressure or drive. The two-serpentine routing follows the drawn pipe joins; pipe layers, bore, box sizes, flap seats, parcel volume and schedule, colours and the 5.8-second cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 461',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      flowPath:
        'Each serpentine is one continuous centre line from its scoop to its open top; a water parcel is a fixed length of full bore between two arc-length stations, clipped only at the scoop mouth and the open top, and each poured stream follows every particle on its own parabola.',
      rigidBody:
        'Every lattice point is transformed by the same Rz(theta) about the central axis, preserving all pipe lengths and box angles exactly.',
      valveRectification:
        'Flaps at the right boxes open only while the left side goes down (sin(phi) > 0) and flaps at the left boxes only while the right side goes down; each flap opens only toward its box and never reverses through its seat.',
    },
    update,
  };
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  root.traverse((object) => {
    for (const material of [].concat(object.material ?? [])) material.fog = false;
  });
  // Framed on Brown's plate: the spray at the left, the free top, the posts
  // and the pool edge to edge.
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-3.95, -2.85, -1.0), new THREE.Vector3(4.2, 4.25, 1.0));
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(2.1, 1.8, 14);
  root.userData.cameraFov = 10;
  root.userData.groundFloorY = bedY;
  root.userData.solidReview = {
    status: 'qualified-geometry',
    residual: 'Finite two-layer pipes and boxes with seated flaps on hinge pockets; swing, flap opening and parcel transport remain prescribed, without valve-force or hydraulic validation.',
  };
  markShadows(root);
  for (const mesh of [reservoir, ...waterSlugs, ...dischargeJets]) { mesh.castShadow = false; mesh.receiveShadow = false; }
  update(0);
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

export function createAuthoredSwingingGutterPumpMovement(movement) {
  if (movement.id !== 461) return null;
  return swingingGutterPump(movement);
}
