import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import {
  capsule,
  circle,
  plate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';
import { PALETTE, markShadows, matte } from './primitives.js';

const FULL_TURN = Math.PI * 2;
let solvedColtCycle = null;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevel = 0.014) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 1,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function cylinderAlongX(radius, length, material, segments = 48) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusAroundX(radius, tube, material, segments = 52) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 9, segments),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
}

function quinticWindow(value, start, end) {
  if (value <= start) return 0;
  if (value >= end) return 1;
  const parameter = (value - start) / (end - start);
  return parameter ** 3 * (10 - 15 * parameter + 6 * parameter ** 2);
}

// One closed annular face ratchet. `height(phase)` is the axial tooth height
// above the cylinder's rear face; `faces` are the radial driving-face phases
// where the height drops from `high` to `low`. Local X is the axial direction,
// and a phase is measured from local +Y toward local +Z. Vertices on every
// radial face are shared with both neighbouring wall columns, so the solid is
// watertight without T-junctions.
function faceRatchetGeometry({
  faces,
  height,
  high,
  innerRadius,
  low,
  outerRadius,
  samplesPerTooth,
}) {
  const positions = [];
  const indices = [];
  const vertex = (radius, phase, axial) => {
    positions.push(axial, radius * Math.cos(phase), radius * Math.sin(phase));
    return positions.length / 3 - 1;
  };
  // Columns between consecutive sample phases; each face phase is a column
  // boundary carrying both the low and high top vertices.
  const pitch = FULL_TURN / faces.length;
  const stations = [];
  faces.forEach((face) => {
    for (let index = 0; index < samplesPerTooth; index += 1) {
      stations.push(face + pitch * index / samplesPerTooth);
    }
  });
  const count = stations.length;
  const station = stations.map((phase, index) => {
    const isFace = index % samplesPerTooth === 0;
    const tops = isFace ? [low, high] : [height(phase)];
    return {
      bottomInner: vertex(innerRadius, phase, 0),
      bottomOuter: vertex(outerRadius, phase, 0),
      isFace,
      phase,
      topInner: tops.map((axial) => vertex(innerRadius, phase, axial)),
      topOuter: tops.map((axial) => vertex(outerRadius, phase, axial)),
    };
  });
  const push = (a, b, c) => indices.push(a, b, c);
  for (let index = 0; index < count; index += 1) {
    const left = station[index];
    const right = station[(index + 1) % count];
    // The column starts at the low top of a face station and ends at the high
    // top of the next face station (or the only top of a plain station).
    const leftTop = 0;
    const rightTop = right.isFace ? 1 : 0;
    const li = left.topInner[leftTop];
    const lo = left.topOuter[leftTop];
    const ri = right.topInner[rightTop];
    const ro = right.topOuter[rightTop];
    // Top surface (normal +X).
    push(li, lo, ro);
    push(li, ro, ri);
    // Bottom (normal -X).
    push(left.bottomInner, right.bottomOuter, left.bottomOuter);
    push(left.bottomInner, right.bottomInner, right.bottomOuter);
    // Outer wall (normal outward). Its right edge passes through the low
    // face vertex when the next station is a face.
    const outerRight = right.isFace
      ? [right.bottomOuter, right.topOuter[0], right.topOuter[1]]
      : [right.bottomOuter, right.topOuter[0]];
    push(lo, left.bottomOuter, outerRight[0]);
    for (let k = 0; k < outerRight.length - 1; k += 1) {
      push(lo, outerRight[k], outerRight[k + 1]);
    }
    const innerRight = right.isFace
      ? [right.bottomInner, right.topInner[0], right.topInner[1]]
      : [right.bottomInner, right.topInner[0]];
    push(li, innerRight[0], left.bottomInner);
    for (let k = 0; k < innerRight.length - 1; k += 1) {
      push(li, innerRight[k + 1], innerRight[k]);
    }
    if (right.isFace) {
      // Radial driving face from the high end of this tooth down to the low
      // land of the next one.
      push(right.topInner[0], right.topOuter[1], right.topOuter[0]);
      push(right.topInner[0], right.topInner[1], right.topOuter[1]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function coltCylinderRatchet(movement) {
  const root = new THREE.Group();

  // Source measurements use the hammer pivot as the 2D origin (model units
  // per raster pixel = sourceScale; raster y is downward).
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.011;
  const sourceRasterHammerPivot = new THREE.Vector2(301, 394);
  const sourceRasterDogPivot = new THREE.Vector2(212, 389);
  const sourceRasterCylinderFrontTop = new THREE.Vector2(7, 98);
  const sourceRasterCylinderRearTop = new THREE.Vector2(112, 98);
  const sourceRasterCylinderFrontBottom = new THREE.Vector2(7, 469);
  const sourceRasterCylinderRearBottom = new THREE.Vector2(112, 469);
  const sourceRasterSpringRoot = new THREE.Vector2(168, 217);
  const sourceRasterSpringTip = new THREE.Vector2(183, 318);
  const sourceRasterSpringBlock = [
    [142, 131], [158, 134], [172, 142], [184, 155], [192, 171],
    [197, 190], [198, 209], [197, 222], [152, 209], [146, 205],
  ];

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterHammerPivot.x) * sourceScale,
    (sourceRasterHammerPivot.y - y) * sourceScale,
  );
  const rasterToModel = ([x, y]) => sourcePointToModel({ x, y }).toArray();

  const cylinderFrontX = sourcePointToModel(sourceRasterCylinderFrontTop).x;
  const cylinderRearX = sourcePointToModel(sourceRasterCylinderRearTop).x;
  const cylinderLength = cylinderRearX - cylinderFrontX;
  const cylinderCenterX = (cylinderFrontX + cylinderRearX) / 2;
  const cylinderTopY = sourcePointToModel(sourceRasterCylinderRearTop).y;
  const cylinderBottomY = sourcePointToModel(
    sourceRasterCylinderRearBottom,
  ).y;
  const cylinderCenterY = (cylinderTopY + cylinderBottomY) / 2;
  const cylinderRadius = (cylinderTopY - cylinderBottomY) / 2;
  const dogPivotRest = sourcePointToModel(sourceRasterDogPivot);

  // Ratchet b: six sawtooth teeth standing on the cylinder's rear face.
  // Each tooth has a radial driving face, a short flat land behind it and a
  // back that ramps axially up to the next face, so the dog can ride back
  // over it when the hammer falls.
  const ratchetTeeth = 6;
  const ratchetPitch = FULL_TURN / ratchetTeeth;
  const ratchetBase = 0.07;
  const ratchetToothDepth = 0.1;
  const ratchetLand = 0.7;
  const ratchetInnerRadius = 0.03;
  const ratchetOuterRadius = 0.8;
  const ratchetLandX = cylinderRearX + ratchetBase;
  const ratchetCrestX = ratchetLandX + ratchetToothDepth;
  const toothHeight = (relative) => {
    const fraction = relative / ratchetPitch;
    if (fraction <= ratchetLand) return ratchetBase;
    return ratchetBase + ratchetToothDepth
      * (fraction - ratchetLand) / (1 - ratchetLand);
  };

  // Planar layout across the page (z toward the viewer). The dog works on
  // the ratchet beside the cylinder axis, where its lift turns the teeth;
  // the tumbler lies behind the dog.
  const dogPlaneZ = 0.17;
  const dogThickness = 0.06;
  const dogLow = dogPlaneZ - dogThickness / 2;
  const dogHigh = dogPlaneZ + dogThickness / 2;
  const hammerHalfDepth = 0.26;
  const hammerBevel = 0.02;
  const hammerZ = dogLow - 0.02 - hammerHalfDepth - hammerBevel;
  const pinRadius = 0.055;
  const boreRadius = 0.064;
  const clearance = 0.005;

  // Hammer motion law: rest, cock, hold at full cock, fall, rest.
  // Full cock: the 42.3-degree stroke of the earlier closed-hand
  // reconstruction (a Colt hammer comes back about 40-45 degrees); 30 was short.
  const hammerStroke = THREE.MathUtils.degToRad(42.3);
  const inputCyclePeriod = 4;
  const fullCylinderPeriod = ratchetTeeth * inputCyclePeriod;
  const cockStart = 0.16;
  const cockEnd = 0.52;
  const fallStart = 0.62;
  const fallEnd = 0.90;
  const hammerAngleAt = (normalized) => (normalized < fallStart
    ? -hammerStroke * quinticWindow(normalized, cockStart, cockEnd)
    : -hammerStroke * (1 - quinticWindow(normalized, fallStart, fallEnd)));

  // Dog a outline, drawn in the rest pose (world XY) and then expressed
  // relative to its pivot on the tumbler.
  const hookTop = [ratchetLandX + clearance, cylinderCenterY - 0.17];
  const hookUnder = [ratchetCrestX + 0.03, hookTop[1] - 0.065];
  // The hook's short top face ends just clear of the tooth crests; above it
  // the dog's upper arm rises beside the ratchet as in Brown's plate, set
  // back far enough that the arm never reaches the teeth when the dog leans
  // over at full cock.
  const hookShoulder = [ratchetCrestX + 0.035, hookTop[1]];
  const eyeRadius = 0.19;
  const pivot = [dogPivotRest.x, dogPivotRest.y];
  const dogRasterRightEdge = [[149, 238], [156, 268], [186, 334], [224, 373]];
  const dogRightEdge = dogRasterRightEdge.map(rasterToModel);
  const dogRasterUpperLeft = [143, 240];
  const dogRasterLeftEdge = [[198, 383], [160, 349]];
  const dogWorldOutline = polygonClipping.union(
    poly([
      [hookTop[0], hookTop[1] - 0.02],
      hookTop,
      hookShoulder,
      rasterToModel(dogRasterUpperLeft),
      ...dogRightEdge,
      [pivot[0], pivot[1]],
      ...dogRasterLeftEdge.map(rasterToModel),
      hookUnder,
    ]),
    [[circle(pivot, eyeRadius, 96)]],
  );
  const toLocal = ([x, y]) => [x - pivot[0], y - pivot[1]];
  const dogLocalPolygons = polygonClipping.difference(
    dogWorldOutline.map((polygon) => polygon.map((ring) => ring.map(toLocal))),
    [[circle([0, 0], boreRadius, 96)]],
  );
  const dogOuterRing = dogLocalPolygons[0][0].slice(0, -1);
  const densify = (ring, spacing) => {
    const points = [];
    ring.forEach((point, index) => {
      const next = ring[(index + 1) % ring.length];
      const steps = Math.max(1, Math.ceil(Math.hypot(
        next[0] - point[0],
        next[1] - point[1],
      ) / spacing));
      for (let step = 0; step < steps; step += 1) {
        points.push([
          point[0] + (next[0] - point[0]) * step / steps,
          point[1] + (next[1] - point[1]) * step / steps,
        ]);
      }
    });
    return points;
  };
  // Only the hook end can reach the ratchet.
  const dogBoundary = densify(dogOuterRing, 0.01).filter(([x, y]) => (
    x + pivot[0] < ratchetCrestX + 0.25 && y + pivot[1] > hookTop[1] - 0.45
  ));
  const dogZs = [dogLow, dogHigh];

  const dogWorldPoint = (local, hammerAngle, dogAngle) => {
    const ch = Math.cos(hammerAngle);
    const sh = Math.sin(hammerAngle);
    const px = ch * pivot[0] - sh * pivot[1];
    const py = sh * pivot[0] + ch * pivot[1];
    const angle = hammerAngle + dogAngle;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [px + c * local[0] - s * local[1], py + s * local[0] + c * local[1]];
  };

  // Signed clearance of one world point from the ratchet solid, using the
  // tooth height field and the radial faces. Positive is clear.
  const ratchetClearance = (x, y, z, cylinderAngle, faceZero) => {
    const dy = y - cylinderCenterY;
    const radius = Math.hypot(dy, z);
    const radialOut = Math.max(
      radius - ratchetOuterRadius,
      ratchetInnerRadius - radius,
    );
    if (radialOut > 0.05) return x - cylinderRearX;
    const phase = Math.atan2(z, dy) - cylinderAngle - faceZero;
    const relative = THREE.MathUtils.euclideanModulo(phase, ratchetPitch);
    const vertical = x - (cylinderRearX + toothHeight(relative));
    const behindFace = Math.max(
      radius * Math.sin(Math.min(relative, Math.PI / 2)),
      x - ratchetCrestX,
    );
    return Math.max(Math.min(vertical, behindFace), radialOut);
  };
  const dogRatchetClearance = (hammerAngle, dogAngle, cylinderAngle, faceZero) => {
    const ch = Math.cos(hammerAngle);
    const sh = Math.sin(hammerAngle);
    const px = ch * pivot[0] - sh * pivot[1];
    const py = sh * pivot[0] + ch * pivot[1];
    const c = Math.cos(hammerAngle + dogAngle);
    const s = Math.sin(hammerAngle + dogAngle);
    let minimum = Infinity;
    for (const [lx, ly] of dogBoundary) {
      const x = px + c * lx - s * ly;
      if (x > ratchetCrestX + 0.05) continue;
      const y = py + s * lx + c * ly;
      for (const z of dogZs) {
        minimum = Math.min(
          minimum,
          ratchetClearance(x, y, z, cylinderAngle, faceZero),
        );
      }
    }
    return minimum;
  };

  // Spring c: a stiff leaf hanging from the hatched block. It is carried as
  // a rigid leaf turning a little about its root (the root is a round end,
  // so the turn never moves it into the block) and always bears on the dog's
  // right edge.
  const springRoot = rasterToModel([
    sourceRasterSpringRoot.x,
    sourceRasterSpringRoot.y,
  ]);
  const springTipRest = rasterToModel([
    sourceRasterSpringTip.x,
    sourceRasterSpringTip.y,
  ]);
  const springRadius = 0.032;
  const springTipRadius = 0.026;
  const springLength = Math.hypot(
    springTipRest[0] - springRoot[0],
    springTipRest[1] - springRoot[1],
  );
  const springRestAngle = Math.atan2(
    springTipRest[1] - springRoot[1],
    springTipRest[0] - springRoot[0],
  );
  // Leaf centreline in its own frame (root at origin, along +X), bowed a
  // little like Brown's leaf.
  const springCenterline = Array.from({ length: 9 }, (_, index) => {
    const u = index / 8;
    return [springLength * u, -0.05 * Math.sin(Math.PI * u)];
  });
  const springLocalPolygons = springCenterline.slice(0, -1).reduce(
    (shape, point, index) => polygonClipping.union(
      shape,
      capsule(
        point,
        springCenterline[index + 1],
        springRadius + (springTipRadius - springRadius) * (index + 1) / 8,
        24,
      ),
    ),
    [[circle([0, 0], springRadius, 48)]],
  );
  // Signed 2D clearance of the spring leaf from the dog's right edge (the
  // only part of the dog the leaf can reach), both in the same plane.
  const dogEdgeLocal = [
    rasterToModel(dogRasterUpperLeft),
    ...dogRightEdge,
  ].map(toLocal);
  const springSamples = Array.from({ length: 25 }, (_, index) => {
    const u = index / 24;
    return {
      point: [springLength * u, -0.05 * Math.sin(Math.PI * u)],
      radius: springRadius + (springTipRadius - springRadius) * u,
    };
  });
  const springDogClearance = (hammerAngle, dogAngle, springAngle) => {
    const edge = dogEdgeLocal.map((local) => (
      dogWorldPoint(local, hammerAngle, dogAngle)
    ));
    const region = [
      ...edge,
      [edge.at(-1)[0] - 3, edge.at(-1)[1]],
      [edge[0][0] - 3, edge[0][1]],
    ];
    const c = Math.cos(springAngle);
    const s = Math.sin(springAngle);
    let minimum = Infinity;
    for (const { point: [lx, ly], radius } of springSamples) {
      const px = springRoot[0] + c * lx - s * ly;
      const py = springRoot[1] + s * lx + c * ly;
      // Distance to the dog's upper and right edges; the sign comes from a
      // region bounded by those edges and closed far to the left, which
      // contains the whole dog near the leaf.
      let nearest = Infinity;
      for (let k = 0; k < edge.length - 1; k += 1) {
        const [ax, ay] = edge[k];
        const [bx, by] = edge[k + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const t = THREE.MathUtils.clamp(
          ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy),
          0,
          1,
        );
        nearest = Math.min(
          nearest,
          Math.hypot(px - ax - t * dx, py - ay - t * dy),
        );
      }
      let inside = false;
      for (let a = 0, b = region.length - 1; a < region.length; b = a, a += 1) {
        const [xa, ya] = region[a];
        const [xb, yb] = region[b];
        if ((ya > py) !== (yb > py)
          && px < (xb - xa) * (py - ya) / (yb - ya) + xa) inside = !inside;
      }
      const signed = inside ? -nearest : nearest;
      minimum = Math.min(minimum, signed - radius);
    }
    return minimum;
  };

  // Projection helpers: move a coordinate from `value` toward `target` in
  // steps no larger than `step`, stopping at the last pose whose clearance is
  // at least `required`; if the start already violates, back off away from
  // the target until clear.
  const project = (value, target, step, clearanceAt, required) => {
    const direction = Math.sign(target - value) || 1;
    if (clearanceAt(value) < required) {
      // Nearest clear pose on either side.
      let good = value;
      const bad = value;
      for (let offset = 1e-7; offset < 2; offset *= 1.5) {
        if (clearanceAt(value - direction * offset) >= required) {
          good = value - direction * offset;
          break;
        }
        if (clearanceAt(value + direction * offset) >= required) {
          good = value + direction * offset;
          break;
        }
      }
      let badSide = bad;
      for (let k = 0; k < 22; k += 1) {
        const middle = (good + badSide) / 2;
        if (clearanceAt(middle) >= required) good = middle;
        else badSide = middle;
      }
      return good;
    }
    const limit = direction > 0
      ? Math.min(target, value + step)
      : Math.max(target, value - step);
    if (clearanceAt(limit) >= required) return limit;
    let good = value;
    let bad = limit;
    for (let k = 0; k < 22; k += 1) {
      const middle = (good + bad) / 2;
      if (clearanceAt(middle) >= required) good = middle;
      else bad = middle;
    }
    return good;
  };

  // Precompute one periodic cycle. The dog is pressed toward the ratchet
  // (positive dog angle) by spring c; while cocking, the hammer lifts the dog
  // and its hook pushes the radial face of the tooth above it, turning the
  // cylinder only as far as needed to keep clearance. During the fall the
  // cylinder is held, the hook's sloped underside rides up the next tooth's
  // back and the dog snaps back onto the land behind that tooth.
  // Dense enough that interpolating the table keeps the hook clear at the
  // faster 42.3-degree stroke.
  const cycleSamples = 1000;
  const dogSpringTarget = 1.5;
  const dogReturnStep = 0.004;
  const springTarget = springRestAngle - 0.4;
  const solveCycle = (start, faceZero) => {
    let { cylinder, dog } = start;
    const table = [];
    for (let index = 0; index <= cycleSamples; index += 1) {
      const normalized = index / cycleSamples;
      const hammer = hammerAngleAt(normalized);
      // The hook can only ever push a face forward; the cylinder never
      // turns back.
      const pushCylinder = () => {
        // The hook drives only while the hammer is drawn back or held; on the
        // fall the cylinder is held and never dragged along.
        if (!(normalized > cockStart && normalized < fallStart)) return;
        const clearAt = (angle) => dogRatchetClearance(
          hammer,
          dog,
          angle,
          faceZero,
        );
        if (clearAt(cylinder) >= clearance) return;
        // Only a hook resting against a face can be cleared by a small turn;
        // any other overlap is resolved by the dog.
        let good = cylinder - 0.005;
        while (clearAt(good) < clearance) {
          good -= 0.005;
          if (good < cylinder - 0.04) return;
        }
        let bad = cylinder;
        for (let k = 0; k < 26; k += 1) {
          const middle = (good + bad) / 2;
          if (clearAt(middle) >= clearance) good = middle;
          else bad = middle;
        }
        cylinder = good;
      };
      for (let pass = 0; pass < 2; pass += 1) {
        pushCylinder();
        dog = project(
          dog,
          dogSpringTarget,
          dogReturnStep,
          (angle) => dogRatchetClearance(hammer, angle, cylinder, faceZero),
          clearance,
        );
      }
      pushCylinder();
      table.push({ cylinder, dog, hammer });
    }
    return table;
  };
  const solveTables = () => {
    // Cycle one starts from an arbitrary tooth phase; its end state is the
    // periodic fixed point (the hook always comes to rest the same distance
    // behind the next face), so cycle two is the periodic table.
    const firstFaceZero = Math.atan2(dogPlaneZ, hookTop[1] - cylinderCenterY)
      - 0.12;
    const warmup = solveCycle({ cylinder: 0, dog: 0 }, firstFaceZero);
    const periodic = solveCycle(warmup.at(-1), firstFaceZero);
    // Spring c only follows the dog, so it is solved once over the
    // periodic cycle; it starts and ends bearing on the same rest pose.
    let spring = springRestAngle;
    periodic.forEach((entry) => {
      spring = project(
        spring,
        springTarget,
        0.02,
        (angle) => springDogClearance(entry.hammer, entry.dog, angle),
        clearance,
      );
      entry.spring = spring;
    });
    const cylinderOrigin = periodic[0].cylinder;
    const cycleStepError = periodic.at(-1).cylinder - cylinderOrigin
      + ratchetPitch;
    const cylinderTable = Float64Array.from(periodic, (entry, index) => {
      // Remove the bisection residual from the driven interval only, so
      // one cock advances exactly one pitch.
      const driveFraction = THREE.MathUtils.clamp(
        (index / cycleSamples - cockStart) / (cockEnd - cockStart),
        0,
        1,
      );
      return entry.cylinder - cylinderOrigin - cycleStepError * driveFraction;
    });
    const dogTable = Float64Array.from(periodic, (entry) => entry.dog);
    const springTable = Float64Array.from(periodic, (entry) => entry.spring);
    const cycleClosureErrors = {
      cylinderStep: cycleStepError,
      dog: dogTable[cycleSamples] - dogTable[0],
      spring: springTable[cycleSamples] - springTable[0],
    };
    dogTable[cycleSamples] = dogTable[0];
    springTable[cycleSamples] = springTable[0];
    return {
      cycleClosureErrors,
      ratchetFaceZero: firstFaceZero + cylinderOrigin,
      tables: { cylinder: cylinderTable, dog: dogTable, spring: springTable },
    };
  };
  // The solved cycle depends only on the fixed geometry, so it is computed
  // once per session.
  const solved = solvedColtCycle ??= solveTables();
  const { cycleClosureErrors, ratchetFaceZero, tables } = solved;

  const sample = (array, normalized) => {
    const position = normalized * cycleSamples;
    const index = Math.min(Math.floor(position), cycleSamples - 1);
    const fraction = position - index;
    return array[index] + (array[index + 1] - array[index]) * fraction;
  };

  const stateAtNormalizedCycle = (normalizedCycle, indexNumber) => {
    const hammerAngle = hammerAngleAt(normalizedCycle);
    const cylinderIncrement = -sample(tables.cylinder, normalizedCycle);
    const cylinderAngle = -(indexNumber * ratchetPitch + cylinderIncrement);
    const dogAngle = sample(tables.dog, normalizedCycle);
    const springAngle = sample(tables.spring, normalizedCycle);
    const hammerCos = Math.cos(hammerAngle);
    const hammerSin = Math.sin(hammerAngle);
    const dogBase = new THREE.Vector3(
      hammerCos * pivot[0] - hammerSin * pivot[1],
      hammerSin * pivot[0] + hammerCos * pivot[1],
      dogPlaneZ,
    );
    const [tipX, tipY] = dogWorldPoint(
      toLocal(hookTop),
      hammerAngle,
      dogAngle,
    );
    let stage;
    if (normalizedCycle <= cockStart) stage = 'rest-dog-behind-ratchet-tooth';
    else if (normalizedCycle <= cockEnd) {
      stage = 'hammer-cocking-dog-driving-one-ratchet-step';
    } else if (normalizedCycle < fallStart) stage = 'full-cock-cylinder-indexed';
    else if (normalizedCycle <= fallEnd) {
      stage = 'hammer-falling-dog-riding-over-next-tooth';
    } else stage = 'rest-dog-behind-ratchet-tooth';
    return {
      cylinderAngle,
      cylinderIncrement,
      dogAngle,
      dogBase,
      dogTip: new THREE.Vector3(tipX, tipY, dogPlaneZ),
      driving: normalizedCycle > cockStart && normalizedCycle <= cockEnd,
      hammerAngle,
      indexNumber,
      normalizedCycle,
      resetting: normalizedCycle >= fallStart && normalizedCycle <= fallEnd,
      springAngle,
      stage,
    };
  };
  const stateAtTime = (time) => {
    const indexNumber = Math.floor(time / inputCyclePeriod);
    const normalizedCycle = THREE.MathUtils.euclideanModulo(
      time,
      inputCyclePeriod,
    ) / inputCyclePeriod;
    return stateAtNormalizedCycle(normalizedCycle, indexNumber);
  };
  const stateAtInputPhase = (phase) => stateAtTime(
    phase / FULL_TURN * inputCyclePeriod,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.59,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const dogMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const springMaterial = matte(PALETTE.brass, {
    metalness: 0.3,
    roughness: 0.45,
  });

  const cylinderArborRadius = 0.09;
  const cylinderBoreRadius = 0.102;
  const cylinder = new THREE.Group();
  cylinder.position.set(cylinderCenterX, cylinderCenterY, 0);
  cylinder.userData.axis = X_AXIS.clone();
  cylinder.userData.role = 'fixed-axis-six-chamber-revolver-cylinder';
  const cylinderRotor = new THREE.Group();
  cylinderRotor.userData.axis = X_AXIS.clone();
  cylinderRotor.userData.role = 'six-step-indexed-cylinder-rotor';
  cylinder.add(cylinderRotor);
  root.add(cylinder);

  const cylinderBody = new THREE.Mesh(
    boredLatheGeometry([
      { axial: -cylinderLength / 2, radial: cylinderRadius },
      { axial: cylinderLength / 2, radial: cylinderRadius },
    ], cylinderBoreRadius, 72),
    drivenMaterial,
  );
  cylinderBody.rotation.z = Math.PI / 2;
  cylinderBody.userData.role = 'six-chamber-cylinder-body';
  cylinderRotor.add(cylinderBody);
  const cylinderEndRings = [-1, 1].map((side) => {
    const ring = torusAroundX(cylinderRadius * 0.985, 0.055, darkMaterial, 64);
    ring.position.x = side * cylinderLength / 2;
    ring.userData.role = side > 0
      ? 'rear-cylinder-edge-ring'
      : 'front-cylinder-edge-ring';
    cylinderRotor.add(ring);
    return ring;
  });
  const chamberStrips = Array.from({ length: ratchetTeeth }, (_, index) => {
    const phase = index * ratchetPitch;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(cylinderLength * 0.91, 0.045, 0.13),
      darkMaterial,
    );
    strip.position.set(
      0,
      cylinderRadius * 0.96 * Math.cos(phase),
      cylinderRadius * 0.96 * Math.sin(phase),
    );
    strip.rotation.x = phase;
    strip.userData.role = `cylinder-longitudinal-index-strip-${index + 1}`;
    cylinderRotor.add(strip);
    return strip;
  });

  const ratchetFaces = Array.from(
    { length: ratchetTeeth },
    (_, index) => ratchetFaceZero + index * ratchetPitch,
  );
  const ratchet = new THREE.Mesh(
    faceRatchetGeometry({
      faces: ratchetFaces,
      height: (phase) => toothHeight(THREE.MathUtils.euclideanModulo(
        phase - ratchetFaceZero,
        ratchetPitch,
      )),
      high: ratchetBase + ratchetToothDepth,
      innerRadius: ratchetInnerRadius,
      low: ratchetBase,
      outerRadius: ratchetOuterRadius,
      samplesPerTooth: 48,
    }),
    drivenMaterial,
  );
  ratchet.position.x = cylinderLength / 2;
  ratchet.userData.role = 'six-tooth-face-ratchet-b';
  cylinderRotor.add(ratchet);

  const hammer = new THREE.Group();
  hammer.position.z = hammerZ;
  hammer.userData.axis = Z_AXIS.clone();
  hammer.userData.role = 'fixed-pivot-hammer-and-tumbler';
  const hammerRotor = new THREE.Group();
  hammerRotor.userData.axis = Z_AXIS.clone();
  hammerRotor.userData.role = 'cocked-and-released-hammer-rotor';
  hammer.add(hammerRotor);
  root.add(hammer);

  const hammerRasterOutline = [
    [242, 66], [302, 48], [352, 64], [392, 76], [425, 62],
    [462, 43], [500, 32], [515, 42], [507, 61], [487, 92],
    [471, 126], [454, 157], [429, 179], [424, 215], [408, 251],
    [386, 287], [365, 322], [383, 347], [405, 374], [419, 407],
    // Lower belly retraced pass 51: Brown's round bottom reaches y 477 and
    // passes behind dog a's eye to the tumbler notch at x 196.
    [419, 436], [415, 443], [405, 454], [385, 465], [365, 472],
    [345, 477], [305, 476], [285, 472], [265, 467], [245, 457],
    [225, 443], [210, 432], [199, 418], [197, 400], [199, 378],
    [205, 352], [211, 330], [224, 303], [240, 280], [260, 269], [286, 264],
    [307, 247], [320, 218], [329, 185], [330, 154], [320, 124],
    [302, 101], [275, 85], [243, 78],
  ];
  const hammerShape = new THREE.Shape();
  const hammerOutlinePoints = [];
  hammerRasterOutline.forEach(([x, y], index) => {
    const point = sourcePointToModel({ x, y });
    if (index === 0) hammerShape.moveTo(point.x, point.y);
    else hammerShape.lineTo(point.x, point.y);
    hammerOutlinePoints.push(new THREE.Vector3(
      point.x,
      point.y,
      hammerHalfDepth + hammerBevel + 0.001,
    ));
  });
  hammerShape.closePath();
  const hammerBody = new THREE.Mesh(
    centeredExtrusion(hammerShape, hammerHalfDepth * 2, hammerBevel),
    driverMaterial,
  );
  hammerBody.userData.role = 'source-profiled-hammer-tumbler-body';
  hammerRotor.add(hammerBody);
  const hammerOutline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(hammerOutlinePoints),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  hammerOutline.userData.role = 'dark-hammer-profile-outline';
  hammerRotor.add(hammerOutline);
  const hammerShaft = cylinderAlongZ(0.23, 0.62, darkMaterial, 36);
  hammerShaft.userData.role = 'hammer-pivot-shaft';
  hammerRotor.add(hammerShaft);

  // The dog pin is fixed in the tumbler and carries a small retaining head
  // in front of the dog's eye.
  const pinFront = dogHigh + 0.012;
  const pinBack = hammerZ + hammerHalfDepth - 0.1;
  const dogPivotPin = cylinderAlongZ(
    pinRadius,
    pinFront - pinBack,
    darkMaterial,
    40,
  );
  dogPivotPin.position.set(
    pivot[0],
    pivot[1],
    (pinFront + pinBack) / 2 - hammerZ,
  );
  dogPivotPin.userData.role = 'dog-a-pivot-pin-on-hammer-tumbler';
  hammerRotor.add(dogPivotPin);
  const dogPinHead = cylinderAlongZ(0.1, 0.03, darkMaterial, 40);
  dogPinHead.position.set(pivot[0], pivot[1], pinFront + 0.015 - hammerZ);
  dogPinHead.userData.role = 'dog-a-pivot-pin-head';
  hammerRotor.add(dogPinHead);

  const dog = new THREE.Group();
  dog.userData.axis = Z_AXIS.clone();
  dog.userData.role = 'pivoted-rigid-indexing-dog-a';
  const dogBody = new THREE.Mesh(
    plate(dogLocalPolygons, dogLow, dogHigh),
    dogMaterial,
  );
  dogBody.userData.role = 'bored-planar-dog-a-lever';
  dog.add(dogBody);
  dog.userData.boreRadius = boreRadius;
  dog.userData.pinRadius = pinRadius;
  root.add(dog);

  const springBlockOutline = sourceRasterSpringBlock.map(rasterToModel);
  const springAnchorBlock = new THREE.Mesh(
    plate(poly(springBlockOutline), dogLow - 0.06, dogHigh + 0.06),
    frameMaterial,
  );
  springAnchorBlock.userData.role = 'fixed-hatched-spring-c-block';
  root.add(springAnchorBlock);
  const springPivot = new THREE.Group();
  springPivot.position.set(springRoot[0], springRoot[1], 0);
  springPivot.userData.axis = Z_AXIS.clone();
  springPivot.userData.role = 'spring-c-root-in-block';
  const spring = new THREE.Mesh(
    plate(springLocalPolygons, dogLow + 0.012, dogHigh - 0.012),
    springMaterial,
  );
  spring.userData.role = 'leaf-spring-c-holding-dog-to-ratchet';
  springPivot.add(spring);
  root.add(springPivot);

  // The arbor stops inside the cylinder; the ratchet closes the bore behind.
  const cylinderShaft = cylinderAlongX(
    cylinderArborRadius,
    cylinderRearX - cylinderFrontX - 0.01,
    darkMaterial,
    30,
  );
  cylinderShaft.position.set(
    (cylinderRearX - 0.01 + cylinderFrontX) / 2,
    cylinderCenterY,
    0,
  );
  cylinderShaft.userData.role = 'fixed-cylinder-arbor';
  root.add(cylinderShaft);

  const sourceState = stateAtTime(0);
  const sourceIdealizationPixelErrors = {
    cylinderFrontBottom: new THREE.Vector2(cylinderFrontX, cylinderBottomY)
      .distanceTo(sourcePointToModel(sourceRasterCylinderFrontBottom))
      / sourceScale,
    cylinderFrontTop: new THREE.Vector2(cylinderFrontX, cylinderTopY)
      .distanceTo(sourcePointToModel(sourceRasterCylinderFrontTop))
      / sourceScale,
    cylinderRearBottom: new THREE.Vector2(cylinderRearX, cylinderBottomY)
      .distanceTo(sourcePointToModel(sourceRasterCylinderRearBottom))
      / sourceScale,
    cylinderRearTop: new THREE.Vector2(cylinderRearX, cylinderTopY)
      .distanceTo(sourcePointToModel(sourceRasterCylinderRearTop))
      / sourceScale,
    dogPivot: new THREE.Vector2(sourceState.dogBase.x, sourceState.dogBase.y)
      .distanceTo(sourcePointToModel(sourceRasterDogPivot)) / sourceScale,
    hammerPivot: new THREE.Vector2(0, 0).distanceTo(
      sourcePointToModel(sourceRasterHammerPivot),
    ) / sourceScale,
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    chamberStrips,
    cylinder,
    cylinderBody,
    cylinderEndRings,
    cylinderRotor,
    cylinderShaft,
    dog,
    dogBody,
    dogPinHead,
    dogPivotPin,
    hammer,
    hammerBody,
    hammerOutline,
    hammerRotor,
    hammerShaft,
    ratchet,
    spring,
    springAnchorBlock,
    springPivot,
  };
  // Brown draws the parts floating on white: no ground shadow.
  root.userData.hideGround = true;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.78, -1.55, -2.28),
    // The hammer sweeps farther right when fully cocked than in Brown's rest
    // pose; include that whole envelope.
    new THREE.Vector3(4.56, 4.08, 2.26),
  );
  root.userData.geometry = {
    boreRadius,
    clearance,
    cockEnd,
    cockStart,
    cycleClosureErrors,
    cycleSamples,
    cylinderBottomY,
    cylinderCenterX,
    cylinderCenterY,
    cylinderFrontX,
    cylinderLength,
    cylinderRadius,
    cylinderRearX,
    cylinderTopY,
    dogPivotRest: dogPivotRest.clone(),
    dogPlaneZ,
    dogThickness,
    fallEnd,
    fallStart,
    fullCylinderPeriod,
    hammerStroke,
    hammerZ,
    inputCyclePeriod,
    pinRadius,
    ratchetBase,
    ratchetCrestX,
    ratchetFaceZero,
    ratchetInnerRadius,
    ratchetLand,
    ratchetLandX,
    ratchetOuterRadius,
    ratchetPitch,
    ratchetTeeth,
    ratchetToothDepth,
    sourceScale,
    springRoot,
  };
  root.userData.mechanism =
    'one pivoted hammer and tumbler carries one rigid bored dog a on a pin; spring c presses that dog into one six-tooth face ratchet b on the back of the cylinder, each cocking stroke pushes one radial tooth face through exactly one chamber, and on the hammer fall the dog rides back over the next tooth and drops behind it';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 277 page marks its animation unavailable. The one-step cocking drive and the dog’s return over the next tooth were reconstructed independently from Brown’s public-domain plate and Colt patent USX9430.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate277: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one hammer/tumbler, one pivoted dog a, one leaf spring c in its hatched block, and one six-tooth face ratchet b fixed to the cylinder; no cylinder lock is drawn, so the cylinder is taken as held by friction/an undrawn detent while the dog resets',
      measurementUncertaintyPixels: 5,
      rasterCylinderFrontBottom: {
        x: sourceRasterCylinderFrontBottom.x,
        y: sourceRasterCylinderFrontBottom.y,
      },
      rasterCylinderFrontTop: {
        x: sourceRasterCylinderFrontTop.x,
        y: sourceRasterCylinderFrontTop.y,
      },
      rasterCylinderRearBottom: {
        x: sourceRasterCylinderRearBottom.x,
        y: sourceRasterCylinderRearBottom.y,
      },
      rasterCylinderRearTop: {
        x: sourceRasterCylinderRearTop.x,
        y: sourceRasterCylinderRearTop.y,
      },
      rasterDogPivot: { x: sourceRasterDogPivot.x, y: sourceRasterDogPivot.y },
      rasterHammerPivot: {
        x: sourceRasterHammerPivot.x,
        y: sourceRasterHammerPivot.y,
      },
      rasterSpringRoot: {
        x: sourceRasterSpringRoot.x,
        y: sourceRasterSpringRoot.y,
      },
      sourceIdealizationPixelErrors,
    },
    primaryPatent: {
      evidence:
        'The patent states that drawing back the hammer makes the lifter act on a ratchet tooth until the next chamber aligns; on the hammer fall the lifter passes back over the next tooth while the cylinder key holds the new index.',
      patentDate: '1836-02-25',
      patentNumber: 'USX9430',
      title: 'Revolving Gun',
      url: 'https://patents.google.com/patent/USX9430/en',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 71,
      edition: 21,
      illustrationPage: 70,
      publicationYear: 1908,
    },
    reconstruction:
      'Brown draws the hook high on the ratchet; a dog pivoted on the tumbler can only turn a face ratchet a full sixth when it works near the cylinder axis, so the hook sits lower and a little beside the axis. The cylinder is held during the dog reset by an undrawn detent, not modelled.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtInputPhase = stateAtInputPhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    fullCylinderPeriod,
    hammerCyclesPerCylinderTurn: ratchetTeeth,
    inputCyclePeriod,
    sourceTime: 0,
  };
  root.userData.transmission = {
    clearanceFunctions: {
      dogRatchet: (state) => dogRatchetClearance(
        state.hammerAngle,
        state.dogAngle,
        state.cylinderAngle,
        ratchetFaceZero,
      ),
      springDog: (state) => springDogClearance(
        state.hammerAngle,
        state.dogAngle,
        state.springAngle,
      ),
    },
    cylinderStepPerCock: ratchetPitch,
    fullCylinderPeriod,
    hammerStroke,
    inputCyclePeriod,
    ratchetTeeth,
    resetLaw:
      'the rigid dog rides up the next tooth back against spring c while the cylinder is held, then drops onto the land behind that tooth',
    stateAtInputPhase,
    stateAtTime,
    stepLaw:
      'the hook pushes one radial tooth face while the hammer is drawn back; the cylinder turns only as far as the finite clearance requires, exactly one sixth per cock',
  };

  const update = (time) => {
    const state = stateAtTime(time);
    hammerRotor.rotation.z = state.hammerAngle;
    cylinderRotor.rotation.x = state.cylinderAngle;
    dog.position.copy(state.dogBase).setZ(0);
    dog.rotation.z = state.hammerAngle + state.dogAngle;
    springPivot.rotation.z = state.springAngle;
    root.userData.contacts = {
      dogRatchet: {
        active: state.driving,
        contactPoint: state.dogTip.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(7.0, 4.3, 9.4),
  };
}

export function createAuthoredColtRatchetMovement(movement) {
  if (movement.id !== 277) return null;
  const result = coltCylinderRatchet(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
