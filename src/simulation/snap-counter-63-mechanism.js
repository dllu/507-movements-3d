// Movement 63's planar mechanism, following Brown's plate and Sam
// Gallagher's reconstruction (engineering.stackexchange.com/q/52770):
// the drop is carried by the leaf spring at the left and swings about the
// spring's virtual hinge; the broad hooked pawl hangs from the screw on the
// drop, free to fall but stopped from rising by the drop's striker pin; the
// driver pins lift the pawl's lobe and the drop's hidden leg, escape the
// pawl first so its nose falls into the next star space, then escape the
// drop, which the spring throws down so the striker drives the pawl and the
// pawl's nose turns the star one point.
//
// Outlines are traced in Brown's enlargement (source pixels, y down) and
// converted to plate coordinates (y up). The motion is a quasi-static
// contact solution: the pins push, the spring and gravity lower the drop
// and pawl at finite rates, the star turns only when the pawl drives it.

export const SOURCE_SCALE = 0.004;
const image = ([x, y]) => [x, -y];

export const layout = {
  // Hinge of the drop: two thirds of the spring's length back from its free
  // end, where an end-loaded cantilever's tip appears to pivot.
  springClamp: image([45, 466]),
  springEnd: image([345, 452]),
  dropHinge: null,
  pawlPivot: image([433, 283]),
  striker: image([575, 340]),
  strikerRadius: 21,
  stopPin: image([268, 548]),
  stopPinRadius: 27,
  screwRadius: 60,
  bossRadius: 96,
  starCenter: image([568, 855]),
  starOuterRadius: 292,
  starRootRadius: 192,
  starTeeth: 10,
  driverCenter: image([1005, 713]),
  driverRadius: 261,
  pinOrbitRadius: 192,
  pinRadius: 19,
  pinCount: 3,
  screwShankRadius: 34,
};
{
  const [cx, cy] = layout.springClamp;
  const [ex, ey] = layout.springEnd;
  layout.dropHinge = [ex + (cx - ex) * 2 / 3, ey + (cy - ey) * 2 / 3];
}

const rotateAbout = ([x, y], [cx, cy], angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
};
const arc = (center, radius, from, to, steps) => Array.from({ length: steps + 1 }, (_, index) => {
  const angle = from + (to - from) * index / steps;
  return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
});

// Centripetal Catmull-Rom through an open run of traced points, so the
// hand-traced outlines read as Brown's smooth curves.
function smoothRun(points, perSegment = 4) {
  const result = [];
  const at = (index) => points[Math.max(0, Math.min(points.length - 1, index))];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = at(index - 1);
    const p1 = at(index);
    const p2 = at(index + 1);
    const p3 = at(index + 2);
    const knot = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-6;
    const t1 = knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    for (let step = 0; step < perSegment; step += 1) {
      const t = t1 + (t2 - t1) * step / perSegment;
      const lerp = (a, b, ta, tb) => [
        a[0] + (b[0] - a[0]) * (t - ta) / (tb - ta),
        a[1] + (b[1] - a[1]) * (t - ta) / (tb - ta),
      ];
      const a1 = lerp(p0, p1, 0, t1);
      const a2 = lerp(p1, p2, t1, t2);
      const a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, 0, t2);
      const b2 = lerp(a2, a3, t1, t3);
      result.push(lerp(b1, b2, t1, t2));
    }
  }
  result.push(points.at(-1));
  return result;
}

// Brown's pointed nose at the foot of the lobe's straight inner edge.
const NOSE_TIP = [705, 713];

// The broad hooked pawl as one plate with Brown's simple smooth outline: the
// ring round the screw, a broad arm whose upper edge passes under the
// striker, and the lobe whose straight inner edge ends in the pointed nose,
// its lower boundary sweeping in one curve back up over the shoulder.
export function pawlOutline() {
  const [px, py] = layout.pawlPivot;
  const r = layout.bossRadius;
  // Boss arc from the lower right (where the arm's upper edge leaves) over
  // the top to the lower left (where the arm's lower edge leaves).
  const upperLeave = Math.atan2(-352 - py, 517 - px);
  const lowerLeave = Math.atan2(-340 - py, 346 - px);
  const bossArc = arc(layout.pawlPivot, r, upperLeave, lowerLeave + (lowerLeave < upperLeave ? Math.PI * 2 : 0), 28);
  return [
    ...bossArc,
    ...[
      // arm's lower edge, leaving the ring tangentially
      ...smoothRun([[346, 340], [388, 372], [440, 400], [520, 428], [620, 446], [714, 462]]).slice(1),
      // lobe's straight inner edge down to the pointed nose
      [712, 560], [709, 640],
      // curved lower boundary from the nose back up over the lobe's shoulder
      ...smoothRun([NOSE_TIP, [765, 692], [820, 655], [866, 604], [903, 545], [926, 482],
        [930, 425], [908, 382], [864, 360], [812, 353], [764, 356]]),
      // arm's upper edge, falling gently to the ring under the striker
      ...smoothRun([[764, 356], [700, 360], [620, 358], [560, 355], [517, 352]]).slice(1, -1),
    ].map(image),
  ];
}

// The rear drop: the tail over the spring, the boss behind the ring, the
// arch over the star, and the hidden leg (dashed by Brown) that the pins lift.
export function dropOutline(leg = defaultLeg) {
  return [
    [140, 433],
    ...smoothRun([[140, 433], [165, 405], [205, 390], [262, 377], [288, 345], [305, 292],
      [330, 215], [372, 165], [440, 147], [505, 163], [546, 204], [575, 262],
      [596, 292], [650, 318], [700, 337], [748, 354], [800, 372], [852, 392], leg[0]]).slice(1, -1),
    ...leg,
    // the arch over the star
    ...smoothRun([[650, 500], [606, 452], [560, 432], [505, 428], [450, 442], [405, 478],
      [372, 528], [352, 540]]),
    ...smoothRun([[352, 540], [300, 520], [240, 492], [200, 478], [160, 462], [140, 433]]).slice(1, -1),
  ].map(image);
}

// The leg's working edge is synthesised as the envelope of the pin for a
// chosen lift law (cosine ease from startLift to maxLift between the pin
// angles, measured clockwise in the source image from its right), so the
// pin rides it without gaps or jumps and escapes past its tip.
export function synthesizeLeg({
  startAngle = 208,
  endAngle = 252,
  startLift = 4,
  maxLift = 20,
  samples = 32,
  tipClearance = 8,
  rightEdgeTop = [878, 402],
  joinPoints = [[800, 560], [700, 540]],
} = {}) {
  const hinge = layout.dropHinge;
  const [dx, dy] = layout.driverCenter;
  const radians = Math.PI / 180;
  const path = Array.from({ length: samples + 1 }, (_, index) => {
    const u = index / samples;
    const a = (startAngle + (endAngle - startAngle) * u) * radians;
    const lift = (startLift + (maxLift - startLift) * (1 - Math.cos(Math.PI * u)) / 2) * radians;
    const pin = [dx + Math.cos(-a) * layout.pinOrbitRadius, dy + Math.sin(-a) * layout.pinOrbitRadius];
    const back = rotateAbout(pin, hinge, -lift);
    return [back[0], -back[1]];
  });
  const edge = path.map((point, index) => {
    const before = path[Math.max(0, index - 1)];
    const after = path[Math.min(path.length - 1, index + 1)];
    const tx = after[0] - before[0];
    const ty = after[1] - before[1];
    const length = Math.hypot(tx, ty);
    return [point[0] + ty / length * layout.pinRadius, point[1] - tx / length * layout.pinRadius];
  });
  // Near the end of the lift the envelope folds back on itself; the leg's
  // tip is its lowest point.
  let lowest = 0;
  edge.forEach((point, index) => { if (point[1] >= edge[lowest][1]) lowest = index; });
  edge.length = lowest + 1;
  // Keep the resting tip inside the circle the next pin sweeps, so that pin
  // meets the pawl's lobe before it touches the leg.
  const earlyPins = Array.from({ length: 61 }, (_, index) => {
    const a = (125 + index) * radians;
    return [dx + Math.cos(a) * layout.pinOrbitRadius, -dy + Math.sin(a) * layout.pinOrbitRadius];
  });
  const nearEarlyPin = ([x, y]) => earlyPins.some(([px, py]) => (
    Math.hypot(x - px, y - py) < layout.pinRadius + tipClearance));
  while (edge.length > 2 && nearEarlyPin(edge.at(-1))) edge.pop();
  const tip = edge.at(-1);
  // Walking up from the tip the edge must rise steadily.
  const rising = [tip];
  for (const point of edge.slice(0, -1).reverse()) {
    if (point[1] < rising.at(-1)[1] - 0.5) rising.push(point);
  }
  return [
    rightEdgeTop,
    [tip[0] + 6, (rightEdgeTop[1] + tip[1]) / 2],
    [tip[0] + 4, tip[1] - 4],
    ...rising,
    ...joinPoints,
  ];
}

export const defaultLeg = synthesizeLeg();

export function starOutline() {
  const { starCenter, starOuterRadius, starRootRadius, starTeeth } = layout;
  return Array.from({ length: starTeeth * 2 }, (_, index) => {
    const angle = index * Math.PI / starTeeth;
    const radius = index % 2 === 0 ? starOuterRadius : starRootRadius;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

const place = (ring, pivot, angle) => ring.map((point) => rotateAbout(point, pivot, angle));

const segmentDistance = (point, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length > 0
    ? Math.min(1, Math.max(0, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length))
    : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
};
const inside = (point, ring) => {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
};
export const ringPointGap = (ring, point) => {
  let distance = Infinity;
  for (let i = 0; i < ring.length; i += 1) {
    distance = Math.min(distance, segmentDistance(point, ring[i], ring[(i + 1) % ring.length]));
  }
  return inside(point, ring) ? -distance : distance;
};
const crosses = (a, b, c, d) => {
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};
// Signed clearance between two rings (negative when they overlap).
export const ringGap = (a, b) => {
  let overlap = false;
  for (let i = 0; i < a.length && !overlap; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      if (crosses(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) { overlap = true; break; }
    }
  }
  if (!overlap) overlap = inside(a[0], b) || inside(b[0], a);
  let gap = Infinity;
  for (const point of a) gap = Math.min(gap, Math.abs(ringPointGap(b, point)));
  for (const point of b) gap = Math.min(gap, Math.abs(ringPointGap(a, point)));
  return overlap ? -gap : gap;
};

export function makeSnapCounterMechanism({
  clearance = 2,
  leg = defaultLeg,
  pinPhase = (137.5 * Math.PI) / 180,
  starPhase = null,
  stepsPerEvent = 360,
  // Finite fall speeds, in radians per event: the spring throws the drop
  // down in about a twentieth of an event; the pawl falls more slowly.
  dropFallPerEvent = 6.5,
  pawlFallPerEvent = 3,
} = {}) {
  const dropFallRate = dropFallPerEvent / stepsPerEvent;
  const pawlFallRate = pawlFallPerEvent / stepsPerEvent;
  // The pawl is one plate thick enough to reach from the pins' plane into
  // the star's, so its whole outline works against the star.
  const pawl = pawlOutline();
  const drop = dropOutline(leg);
  const star = starOutline();
  const pinPitch = (Math.PI * 2) / layout.pinCount;
  const starPitch = (Math.PI * 2) / layout.starTeeth;
  const hinge = layout.dropHinge;
  const pivot0 = layout.pawlPivot;
  // Brown's pose puts the nose at the bottom of a space.
  const noseTip = image([706, 715]);
  const restStar = starPhase ?? Math.atan2(noseTip[1] - layout.starCenter[1], noseTip[0] - layout.starCenter[0]) - starPitch / 2;

  const dropAt = (delta) => place(drop, hinge, delta);
  const pawlAt = (delta, rho) => place(place(pawl, pivot0, rho), hinge, delta);
  const noseAt = pawlAt;
  const starAt = (sigma) => star.map(([x, y]) => {
    const c = Math.cos(sigma);
    const s = Math.sin(sigma);
    return [layout.starCenter[0] + x * c - y * s, layout.starCenter[1] + x * s + y * c];
  });
  // The pins turn clockwise, as in Gallagher's animation.
  const pinsAt = (driverAngle) => Array.from({ length: layout.pinCount }, (_, index) => {
    const angle = -pinPhase - index * pinPitch + driverAngle;
    return [
      layout.driverCenter[0] + Math.cos(angle) * layout.pinOrbitRadius,
      layout.driverCenter[1] + Math.sin(angle) * layout.pinOrbitRadius,
    ];
  });
  const pinGap = (ring, pins) => Math.min(...pins.map((pin) => ringPointGap(ring, pin) - layout.pinRadius));
  // Seat the striker on the arm's upper edge and the stop pin under the
  // tail, each with a hair of clearance, at Brown's x positions.
  const seatBelow = (point, radius, ring, gap) => {
    let low = point[1] - 80;
    let high = point[1] + 80;
    // highest centre (least y) that still leaves the gap below the ring
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (low + high) / 2;
      if (ringPointGap(ring, [point[0], middle]) - radius >= gap) low = middle;
      else high = middle;
    }
    return [point[0], low];
  };
  const seatAbove = (point, radius, ring, gap) => {
    let low = point[1] - 80;
    let high = point[1] + 80;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (low + high) / 2;
      if (ringPointGap(ring, [point[0], middle]) - radius >= gap) high = middle;
      else low = middle;
    }
    return [point[0], high];
  };
  const seatGap = 0.6;
  const striker = seatAbove(layout.striker, layout.strikerRadius, pawl, seatGap);
  const stopPin = seatBelow(layout.stopPin, layout.stopPinRadius, drop, seatGap);
  const strikerGap = (delta, rho) => ringPointGap(pawlAt(delta, rho), rotateAbout(striker, hinge, delta)) - layout.strikerRadius;

  const lowestClear = (low, high, clear) => {
    // Smallest value in [low, high] from which every value up to high is
    // clear, assuming high is clear.
    if (clear(low)) return low;
    for (let iteration = 0; iteration < 40; iteration += 1) {
      const middle = (low + high) / 2;
      if (clear(middle)) high = middle;
      else low = middle;
    }
    return high;
  };

  const solveStep = (state, driverAngle) => {
    const pins = pinsAt(driverAngle);
    let { delta, rho, sigma } = state;
    const pawlClear = (d, r) => pinGap(pawlAt(d, r), pins) >= clearance;
    const dropClear = (d) => pinGap(dropAt(d), pins) >= clearance;
    const noseClear = (d, r, s) => ringGap(noseAt(d, r), starAt(s)) >= clearance;
    // Pins push: raise the pawl up to the striker, then the drop.
    if (!pawlClear(delta, rho)) {
      let high = rho;
      while (high < 0 && !pawlClear(delta, high)) high = Math.min(0, high + 0.01);
      if (pawlClear(delta, high)) {
        rho = high > rho ? lowestClear(Math.max(rho, high - 0.01), high, (r) => pawlClear(delta, r)) : high;
      } else {
        rho = 0;
      }
    }
    if (!pawlClear(delta, rho) || !dropClear(delta)) {
      let high = delta;
      while (!(pawlClear(high, rho) && dropClear(high))) high += 0.004;
      delta = lowestClear(Math.max(state.delta, high - 0.004), high, (d) => pawlClear(d, rho) && dropClear(d));
    }
    // Spring lowers the drop at a finite rate; the pawl rises against the
    // star, then the striker drives the pawl and the pawl drives the star.
    const dropTarget = Math.max(0, delta - dropFallRate);
    const subSteps = 12;
    for (let index = 1; index <= subSteps; index += 1) {
      const d = delta + (dropTarget - delta) * index / subSteps;
      if (!dropClear(d)) break;
      let r = rho;
      let s = sigma;
      if (!noseClear(d, r, s)) {
        // The seated nose drives the star forward (clockwise) ...
        let turn = 0;
        while (turn < starPitch / 2 && !noseClear(d, r, sigma - turn)) turn += 0.002;
        if (turn < starPitch / 2) {
          let lowTurn = Math.max(0, turn - 0.002);
          let highTurn = turn;
          for (let iteration = 0; iteration < 30; iteration += 1) {
            const middle = (lowTurn + highTurn) / 2;
            if (noseClear(d, r, sigma - middle)) highTurn = middle;
            else lowTurn = middle;
          }
          s = sigma - highTurn;
        } else {
          // ... unless it can only ride up and out of the space.
          r = lowestClear(r, 0, (candidate) => noseClear(d, candidate, sigma));
          if (!noseClear(d, r, sigma)) break;
        }
      }
      if (!pawlClear(d, r)) break;
      delta = d;
      rho = r;
      sigma = s;
    }
    // Gravity lowers the pawl at a finite rate until the star or a pin
    // stops it.
    const pawlTarget = rho - pawlFallRate;
    for (let index = 1; index <= subSteps; index += 1) {
      const r = rho + (pawlTarget - rho) * index / subSteps;
      if (!noseClear(delta, r, sigma) || !pawlClear(delta, r)) break;
      rho = r;
    }
    return { delta, rho, sigma };
  };

  const simulate = (events) => {
    const steps = events * stepsPerEvent;
    let state = { delta: 0, rho: 0, sigma: restStar };
    const table = [];
    for (let step = 0; step <= steps; step += 1) {
      const driverAngle = -(step / stepsPerEvent) * pinPitch;
      state = solveStep(state, driverAngle);
      table.push({ driverAngle, ...state });
    }
    return table;
  };

  // One steady event: after a settling event, the drop, pawl and star
  // state at each step of the next, the star relative to its start.
  const periodicEvent = (settleEvents = 3) => {
    const table = simulate(settleEvents + 2);
    const first = table.slice(settleEvents * stepsPerEvent, (settleEvents + 1) * stepsPerEvent + 1);
    const second = table.slice((settleEvents + 1) * stepsPerEvent, (settleEvents + 2) * stepsPerEvent + 1);
    let repeatError = 0;
    first.forEach((state, index) => {
      const next = second[index];
      repeatError = Math.max(
        repeatError,
        Math.abs(state.delta - next.delta),
        Math.abs(state.rho - next.rho),
        Math.abs(state.sigma - first[0].sigma - next.sigma + second[0].sigma),
      );
    });
    const advance = first.at(-1).sigma - first[0].sigma;
    // Start the event where the star has come to rest after its snap, so
    // phase zero shows the drop down as Brown draws it.
    const turned = first.map((state) => state.sigma - first[0].sigma);
    const stillAt = (index) => Array.from({ length: 6 }, (_, offset) => (index + offset) % stepsPerEvent)
      .every((i) => first[i].delta < 0.02
        && Math.abs(first[i + 1].delta - first[i].delta) < 1e-9
        && Math.abs(first[i + 1].sigma - first[i].sigma) < 1e-12);
    let settled = 0;
    while (settled < stepsPerEvent && !(stillAt(settled) && !stillAt((settled + stepsPerEvent - 1) % stepsPerEvent))) settled += 1;
    const start = settled % stepsPerEvent;
    const order = Array.from({ length: stepsPerEvent + 1 }, (_, index) => {
      const source = start + index;
      return source <= stepsPerEvent
        ? { state: first[source], turn: turned[source] }
        : { state: first[source - stepsPerEvent], turn: turned[source - stepsPerEvent] + advance };
    });
    const base = order[0].turn;
    // Remove the sub-pixel residue of the clearance search so each event
    // turns the star exactly one point.
    const scale = -starPitch / advance;
    return {
      advance,
      delta: order.map(({ state }) => state.delta),
      phaseOffset: start / stepsPerEvent,
      repeatError,
      rho: order.map(({ state }) => state.rho),
      sigma: order.map(({ turn }) => (turn - base) * scale),
      startSigma: first[start].sigma,
      stepsPerEvent,
    };
  };

  return {
    dropOutline: drop,
    pawlPlateOutline: pawl,
    pinPhase,
    rotateAboutHinge: (point, delta) => rotateAbout(point, hinge, delta),
    periodicEvent,
    stopPin,
    striker,
    dropAt,
    layout,
    noseAt,
    pawlAt,
    pinPitch,
    pinsAt,
    restStar,
    simulate,
    starAt,
    starPitch,
    strikerGap,
    solveStep,
  };
}

// Everything the baked motion depends on, for its fingerprint.
export function snapCounterMotionFingerprint(options = {}) {
  const text = JSON.stringify({
    drop: dropOutline(options.leg ?? defaultLeg),
    layout,
    options,
    pawl: pawlOutline(),
    solver: 6,
  }, (key, value) => (typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
