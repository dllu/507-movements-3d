import clip from 'polygon-clipping';

// Swept cuts for movement 63's pawl and the relieved back of its drop. The
// inputs are the factory's `root.userData.sweptCut.inputs`, so the baked
// rings follow the factory geometry and scheduled motion exactly.

// Clipping runs on an integer grid of 1e-5 units, where polygon-clipping's
// comparisons are exact.
const SCALE = 1e5;
const snapRing = (ring) => ring.map(([x, y]) => [Math.round(x * SCALE), Math.round(y * SCALE)]);
const rotate = ([x, y], angle) => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
];
const add = ([ax, ay], [bx, by]) => [ax + bx, ay + by];
const sub = ([ax, ay], [bx, by]) => [ax - bx, ay - by];

function circle(center, radius, segments = 32) {
  // Circumscribed so the polygon covers the true circle.
  const outer = radius / Math.cos(Math.PI / segments);
  return Array.from({ length: segments }, (_, index) => {
    const angle = index * Math.PI * 2 / segments;
    return [center[0] + Math.cos(angle) * outer, center[1] + Math.sin(angle) * outer];
  });
}

function signedArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [ax, ay] = ring[index];
    const [bx, by] = ring[(index + 1) % ring.length];
    area += ax * by - bx * ay;
  }
  return area / 2;
}

// Outward mitred offset, matching how ExtrudeGeometry's bevel moves vertices.
export function mitredOffset(ring, distance) {
  const ccw = signedArea(ring) > 0 ? ring : [...ring].reverse();
  return ccw.map((point, index) => {
    const previous = ccw[(index + ccw.length - 1) % ccw.length];
    const next = ccw[(index + 1) % ccw.length];
    const normal = ([x, y]) => {
      const length = Math.hypot(x, y);
      return [y / length, -x / length];
    };
    const n1 = normal(sub(point, previous));
    const n2 = normal(sub(next, point));
    const scale = distance / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [point[0] + (n1[0] + n2[0]) * scale, point[1] + (n1[1] + n2[1]) * scale];
  });
}

function bounds(rings) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

const overlaps = (a, b) => a.minX <= b.maxX && b.minX <= a.maxX
  && a.minY <= b.maxY && b.minY <= a.maxY;

// Intermediate results are re-snapped, which keeps polygon-clipping's sweep
// line robust across the union levels.
function snapMultiPolygon(multiPolygon) {
  return multiPolygon.map((polygon) => polygon.map((ring) => ring
    .map(([x, y]) => [Math.round(x), Math.round(y)])
    .filter((point, index, points) => {
      const previous = points[(index + points.length - 1) % points.length];
      return point[0] !== previous[0] || point[1] !== previous[1];
    })).filter((ring) => ring.length >= 3)).filter((polygon) => polygon.length);
}

function unionInChunks(polygons, chunkSize = 48) {
  let layer = polygons.map((ring) => [snapRing(ring)]);
  if (!layer.length) return [];
  while (layer.length > 1) {
    const next = [];
    for (let index = 0; index < layer.length; index += chunkSize) {
      next.push(snapMultiPolygon(clip.union(...layer.slice(index, index + chunkSize))));
    }
    layer = next;
  }
  return layer[0];
}

// Keeps the piece that carries the bore; detached fragments are not part of it.
function keepPieceContaining(multiPolygon, point) {
  const inside = (ring) => {
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > point[1]) !== (yj > point[1])
        && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) result = !result;
    }
    return result;
  };
  return multiPolygon.filter(([outer]) => inside(outer));
}

function dropOriginRing(ring) {
  const rounded = ring.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const first = rounded[0];
  const last = rounded.at(-1);
  return first[0] === last[0] && first[1] === last[1] ? rounded.slice(0, -1) : rounded;
}

function simplifyChain(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points.at(-1);
  const length = Math.hypot(bx - ax, by - ay);
  let worst = 0;
  let worstIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [px, py] = points[index];
    const distance = length < 1e-12
      ? Math.hypot(px - ax, py - ay)
      : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
    if (distance > worst) {
      worst = distance;
      worstIndex = index;
    }
  }
  if (worst <= tolerance) return [points[0], points.at(-1)];
  const left = simplifyChain(points.slice(0, worstIndex + 1), tolerance);
  const right = simplifyChain(points.slice(worstIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

// Ramer-Douglas-Peucker on a closed ring; the boundary moves at most
// `tolerance`, which the clearance absorbs.
function simplifyRing(ring, tolerance) {
  const [origin] = ring;
  let farthest = 0;
  for (let index = 1; index < ring.length; index += 1) {
    if (Math.hypot(ring[index][0] - origin[0], ring[index][1] - origin[1])
      > Math.hypot(ring[farthest][0] - origin[0], ring[farthest][1] - origin[1])) farthest = index;
  }
  const first = simplifyChain(ring.slice(0, farthest + 1), tolerance);
  const second = simplifyChain([...ring.slice(farthest), origin], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

export const SIMPLIFY_TOLERANCE = 0.0015;

function roundMultiPolygon(multiPolygon) {
  return multiPolygon.map((polygon) => polygon.map((ring) => simplifyRing(
    dropOriginRing(ring),
    SIMPLIFY_TOLERANCE * SCALE,
  ).map(([x, y]) => [x / SCALE + 0, y / SCALE + 0])));
}

export function computeSnapCounterCuts(inputs, stateAtTime, {
  sampleCount = 6000,
  maximumStep = 0.004,
} = {}) {
  const {
    clearance,
    dropBoreRing,
    dropOutline,
    dropPivot,
    dropPivotShaftRadius,
    driverCenter,
    eventPeriod,
    pawlBoreRing,
    pawlNoseOutline,
    pawlOutline,
    pinMountPhase,
    pinOrbitRadius,
    pinPitch,
    pinRadius,
    starBevel,
    starCenter,
    starGapRadius,
    starHubRadius,
    starMountPhase,
    starOuterRadius,
    starTeeth,
    strikerLocal,
    strikerRadius,
  } = inputs;
  const starLocal = Array.from({ length: starTeeth * 2 }, (_, index) => {
    const angle = starMountPhase + index * Math.PI / starTeeth;
    const radius = index % 2 === 0 ? starOuterRadius : starGapRadius;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  const starSwept = mitredOffset(starLocal, starBevel + clearance);
  const pinCount = Math.round(Math.PI * 2 / pinPitch);
  const pawlBlank = [[snapRing(pawlOutline), snapRing(pawlBoreRing)]];
  const noseBlank = [[snapRing(pawlNoseOutline)]];
  const pawlBounds = bounds([pawlOutline, pawlNoseOutline]);
  pawlBounds.minX -= 0.05; pawlBounds.minY -= 0.05;
  pawlBounds.maxX += 0.05; pawlBounds.maxY += 0.05;

  const obstaclesInPawlFrame = (state) => {
    const pivot = [state.pawlPivotPosition.x, state.pawlPivotPosition.y];
    const toPawl = (world) => rotate(sub(world, pivot), -state.pawlAngle);
    const star = starSwept.map((point) => toPawl(add(starCenter, rotate(point, state.starAngle))));
    const circles = [
      [add(starCenter, [0, 0]), starHubRadius + clearance],
      [add(dropPivot, rotate(strikerLocal, state.dropAngle)), strikerRadius + clearance],
      [dropPivot, dropPivotShaftRadius + clearance],
      ...Array.from({ length: pinCount }, (_, index) => {
        const angle = pinMountPhase - index * pinPitch + state.driverAngle;
        return [
          add(driverCenter, [Math.cos(angle) * pinOrbitRadius, Math.sin(angle) * pinOrbitRadius]),
          pinRadius + clearance,
        ];
      }),
    ].map(([center, radius]) => circle(toPawl(center), radius));
    return { circles, star };
  };

  const times = Array.from({ length: sampleCount + 1 }, (_, index) => eventPeriod * index / sampleCount);
  const selectSamples = (probe) => {
    const selected = [];
    let last = null;
    for (const [index, time] of times.entries()) {
      const points = probe(time);
      const moved = last
        ? Math.max(...points.map((point, k) => Math.hypot(point[0] - last[k][0], point[1] - last[k][1])))
        : Infinity;
      if (moved > maximumStep || index === times.length - 1) {
        selected.push(time);
        last = points;
      }
    }
    return selected;
  };

  const pawlSamples = selectSamples((time) => {
    const { circles, star } = obstaclesInPawlFrame(stateAtTime(time));
    return [star, ...circles].flat();
  });
  // The shank lies in front of the star, so only the studs, pins and hub cross
  // it; the nose block works in the star plane and meets all of them.
  const shankObstacles = [];
  const noseObstacles = [];
  for (const time of pawlSamples) {
    const { circles, star } = obstaclesInPawlFrame(stateAtTime(time));
    for (const ring of circles) {
      if (overlaps(bounds([ring]), pawlBounds)) {
        shankObstacles.push(ring);
        noseObstacles.push(ring);
      }
    }
    if (overlaps(bounds([star]), pawlBounds)) noseObstacles.push(star);
  }
  const pawl = keepPieceContaining(
    clip.difference(pawlBlank, unionInChunks(shankObstacles)),
    [0, 0],
  );
  // The nose block hangs from the shank, so only a piece touching it is kept.
  const pawlNose = clip.difference(noseBlank, unionInChunks(noseObstacles))
    .map((polygon) => ({ area: Math.abs(signedArea(polygon[0])), polygon }))
    .filter(({ polygon }) => clip.intersection([polygon], pawl).length > 0)
    .sort((left, right) => right.area - left.area)
    .slice(0, 1)
    .map(({ polygon }) => polygon);

  // In the drop's frame the pawl only turns about its pivot, so the shank
  // blank sweeps a polar fan: at each radius, its angular extent widened by
  // the range of relative angles. The blank contains the cut shank.
  const relativeAngles = times.map((time) => {
    const state = stateAtTime(time);
    return state.pawlAngle - state.dropAngle;
  });
  const relativeMin = Math.min(...relativeAngles);
  const relativeMax = Math.max(...relativeAngles);
  const referenceState = stateAtTime(0);
  const pivotInDrop = rotate(
    sub([referenceState.pawlPivotPosition.x, referenceState.pawlPivotPosition.y], dropPivot),
    -referenceState.dropAngle,
  );
  const clearanceBody = mitredOffset(pawlOutline, clearance);
  const densePoints = clearanceBody.flatMap((point, index) => {
    const next = clearanceBody[(index + 1) % clearanceBody.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(next[0] - point[0], next[1] - point[1]) / 0.002));
    return Array.from({ length: steps }, (_, k) => [
      point[0] + (next[0] - point[0]) * k / steps,
      point[1] + (next[1] - point[1]) * k / steps,
    ]);
  });
  const polar = densePoints.map(([x, y]) => [Math.hypot(x, y), Math.atan2(y, x)]);
  const outerRadius = Math.max(...polar.map(([radius]) => radius));
  const hubRadius = Math.min(...polar.map(([radius]) => radius));
  const radialStep = 0.01;
  const lower = [];
  const upper = [];
  for (let radius = hubRadius; radius <= outerRadius + radialStep; radius += radialStep) {
    const band = polar.filter(([r]) => Math.abs(r - radius) <= radialStep);
    if (!band.length) continue;
    // Chord sag between samples at this radius is covered by the band width.
    const pad = radialStep / Math.max(radius, 0.05);
    lower.push([radius, Math.min(...band.map(([, angle]) => angle)) + relativeMin - pad]);
    upper.push([radius, Math.max(...band.map(([, angle]) => angle)) + relativeMax + pad]);
  }
  const fanPoint = ([radius, angle]) => add(pivotInDrop, [Math.cos(angle) * radius, Math.sin(angle) * radius]);
  const arcSteps = 48;
  const outerArc = Array.from({ length: arcSteps + 1 }, (_, k) => {
    const start = lower.at(-1)[1];
    const end = upper.at(-1)[1];
    return [outerRadius + radialStep, start + (end - start) * k / arcSteps];
  });
  const fan = [
    ...lower.map(fanPoint),
    ...outerArc.map(fanPoint),
    ...[...upper].reverse().map(fanPoint),
  ];
  const dropSwept = clip.union(
    [snapRing(fan)],
    [snapRing(circle(pivotInDrop, hubRadius + radialStep, 48))],
  );
  const dropRear = clip.difference(
    [[snapRing(dropOutline), snapRing(dropBoreRing)]],
    dropSwept,
  ).filter(([outer]) => Math.abs(signedArea(outer)) > 1e-3 * SCALE ** 2);

  return {
    dropRear: roundMultiPolygon(dropRear),
    dropRelativeAngleRange: [relativeMin, relativeMax],
    pawl: roundMultiPolygon(pawl),
    pawlNose: roundMultiPolygon(pawlNose),
    pawlSampleCount: pawlSamples.length,
  };
}