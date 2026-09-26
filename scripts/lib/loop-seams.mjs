// Loop-seam measurement for production movement models.
//
// The viewer never wraps its clock: MovementEngine passes an ever-growing
// elapsed time to model.update. A visible "loop seam" therefore comes from the
// model itself: an internal `time % period` (or a baked recording's loop
// wrap) whose end pose or velocity does not meet its start, a finite
// playbackDuration that stops the run and asks for Replay, or a motion law
// that clamps time and holds its final state.
//
// The measurement samples world positions of up to POINTS_PER_OBJECT
// vertices of every visible mesh, line and instanced mesh (so rigid
// transforms, deforming ropes/belts and visibility changes are all seen) and:
//  1. sweeps t sequentially from 0 over several declared periods, exactly as
//     the engine would, recording per-step displacement and second
//     differences;
//  2. bisects every abrupt step (for stateless models) down to a vanishing
//     interval, so real position discontinuities are separated from fast but
//     continuous motion (escapement snaps, index strokes);
//  3. compares the pose at 0+eps with the pose at P-eps for the declared
//     period P (periodicity), and measures position and velocity continuity
//     across each k*P;
//  4. reports runs that end (finite playbackDuration) or hold still after a
//     while (time clamped, stateful runs that settle).
// Distances are divided by the model size (diagonal of the sampled points'
// bounds at t = 0); velocity changes are divided by the peak point speed.
import * as THREE from 'three';

export const POINTS_PER_OBJECT = 24;
export const DEFAULT_STEPS_PER_PERIOD = 240;
export const DEFAULT_PERIODS = 3;
// A position jump above this fraction of the model size is a visible seam
// (about 2-3 px at the default framing).
export const JUMP_TOLERANCE = 0.003;
// A change of velocity at a loop point above this fraction of the peak
// point speed is a sudden stop, start or reversal.
export const KINK_TOLERANCE = 0.35;

const scratch = new THREE.Vector3();
const instanceMatrix = new THREE.Matrix4();
const worldInstance = new THREE.Matrix4();

function effectivelyVisible(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

function nameOf(object) {
  const names = [];
  for (let node = object; node && names.length < 3; node = node.parent) {
    const label = node.userData?.role || node.name;
    if (label) names.push(label);
  }
  return names.join(' < ') || object.type;
}

// Vertices actually drawn: water cells and similar rebuilt meshes keep a
// fixed buffer and draw only its first part.
function drawnRange(geometry) {
  const count = geometry.attributes.position.count;
  if (geometry.index) return [0, count];
  const start = Math.min(count, geometry.drawRange.start);
  return [start, Math.max(0, Math.min(count, start + geometry.drawRange.count) - start)];
}

export function collectTracked(root) {
  const tracked = [];
  root.traverse(object => {
    if (!(object.isMesh || object.isLine || object.isPoints)) return;
    if (!object.geometry?.attributes?.position) return;
    const instances = object.isInstancedMesh ? Math.min(object.count, 12) : 1;
    const perInstance = object.isInstancedMesh ? Math.max(4, Math.floor(POINTS_PER_OBJECT / instances)) : POINTS_PER_OBJECT;
    const position = object.geometry.attributes.position;
    object.geometry.computeBoundingBox?.();
    const box = object.geometry.boundingBox;
    const scale = object.matrixWorld.getMaxScaleOnAxis?.() ?? 1;
    const extent = box && Number.isFinite(box.min.x) ? box.getSize(new THREE.Vector3()).length() * scale : 0;
    tracked.push({object, instances, perInstance, count: instances * perInstance, name: nameOf(object),
      extent, initialPosition: position, initialCount: drawnRange(object.geometry)[1], initialVersion: position.version, dynamic: false});
  });
  let offset = 0;
  for (const entry of tracked) { entry.offset = offset; offset += entry.count; }
  return {tracked, pointCount: offset};
}

export function snapshot(model, set) {
  model.root.updateMatrixWorld(true);
  const points = new Float64Array(set.pointCount * 3);
  const visible = new Uint8Array(set.tracked.length);
  const counts = new Uint32Array(set.tracked.length);
  const opacity = new Float32Array(set.tracked.length);
  const bounds = new Map();
  set.tracked.forEach((entry, index) => {
    const {object, instances, perInstance, offset} = entry;
    const shown = effectivelyVisible(object);
    visible[index] = shown ? 1 : 0;
    const materials = [object.material].flat().filter(Boolean);
    opacity[index] = materials.length ? Math.max(...materials.map(m => (m.transparent ? m.opacity : 1) * (m.visible === false ? 0 : 1))) : 1;
    const position = object.geometry.attributes.position;
    const [first, n] = drawnRange(object.geometry);
    counts[index] = n;
    // Geometry rebuilt with a different vertex count (water levels, ropes)
    // cannot be compared vertex by vertex; compare world bounds instead.
    if (position !== entry.initialPosition || n !== entry.initialCount || position.version !== entry.initialVersion) entry.dynamic = true;
    if (entry.dynamic && shown && n > 0) {
      const stride = Math.max(1, Math.floor(n / 4000));
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let v = 0; v < n; v += stride) {
        scratch.fromBufferAttribute(position, first + v).applyMatrix4(object.matrixWorld);
        lo[0] = Math.min(lo[0], scratch.x); lo[1] = Math.min(lo[1], scratch.y); lo[2] = Math.min(lo[2], scratch.z);
        hi[0] = Math.max(hi[0], scratch.x); hi[1] = Math.max(hi[1], scratch.y); hi[2] = Math.max(hi[2], scratch.z);
      }
      bounds.set(index, [...lo, ...hi]);
      // Rebuilt geometry may reorder its vertices (a water cell regenerated
      // for a new angle), so its samples are its world bounds' corners.
      for (let j = 0; j < entry.count; j += 1) {
        const corner = j % 2 ? hi : lo, o = 3 * (offset + j);
        points[o] = corner[0]; points[o + 1] = corner[1]; points[o + 2] = corner[2];
      }
      return;
    }
    let k = offset;
    for (let instance = 0; instance < instances; instance += 1) {
      let matrix = object.matrixWorld;
      if (object.isInstancedMesh) {
        const which = instances > 1 ? Math.floor(instance * (object.count - 1) / (instances - 1)) : 0;
        object.getMatrixAt(which, instanceMatrix);
        matrix = worldInstance.multiplyMatrices(object.matrixWorld, instanceMatrix);
      }
      for (let j = 0; j < perInstance; j += 1, k += 1) {
        if (!shown || n === 0) { points[3 * k] = NaN; continue; }
        const vertex = perInstance > 1 ? Math.floor(j * (n - 1) / (perInstance - 1)) : 0;
        scratch.fromBufferAttribute(position, first + vertex).applyMatrix4(matrix);
        points[3 * k] = scratch.x; points[3 * k + 1] = scratch.y; points[3 * k + 2] = scratch.z;
      }
    }
  });
  return {points, visible, counts, bounds, opacity};
}

export function sizeOf(pose) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pose.points.length; i += 3) {
    if (Number.isNaN(pose.points[i])) continue;
    for (let c = 0; c < 3; c += 1) {
      min[c] = Math.min(min[c], pose.points[i + c]);
      max[c] = Math.max(max[c], pose.points[i + c]);
    }
  }
  return Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
}

function objectSizes(set) {
  return set.tracked.map(entry => entry.extent);
}

// Per-part displacement between two poses; a part that appears or
// disappears counts as moving by its own size.
function partDisplacements(set, a, b, sizes) {
  return set.tracked.map((entry, index) => {
    let d = 0, kind = 'motion';
    if (a.visible[index] !== b.visible[index]) {
      // A part appearing or vanishing jumps by its current size (a water
      // body switched on while still empty is no jump); a faint translucent
      // part is weighted by its opacity.
      const shownPose = a.visible[index] ? a : b, shownBounds = shownPose.bounds.get(index);
      // Size is measured as the bounds' volume-equivalent diagonal, so a
      // hairline stream or an empty sheet appearing counts as small.
      const bulk = (lo, hi) => Math.sqrt(3) * Math.cbrt(Math.max(0, hi[0] - lo[0]) * Math.max(0, hi[1] - lo[1]) * Math.max(0, hi[2] - lo[2]));
      let extent = 0;
      if (shownBounds) extent = bulk(shownBounds.slice(0, 3), shownBounds.slice(3));
      else {
        // Current size from the sampled vertices (the part may be scaled).
        const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        for (let k = entry.offset; k < entry.offset + entry.count; k += 1) for (let c = 0; c < 3; c += 1) {
          lo[c] = Math.min(lo[c], shownPose.points[3 * k + c]); hi[c] = Math.max(hi[c], shownPose.points[3 * k + c]);
        }
        extent = Number.isFinite(lo[0]) ? bulk(lo, hi) : sizes[index] ?? 0;
      }
      d = extent * Math.min(1, shownPose.opacity[index]);
      kind = 'visibility';
    } else if (a.visible[index] && (a.counts[index] === b.counts[index] || (a.bounds.has(index) && b.bounds.has(index)))) {
      if (a.bounds.has(index)) kind = 'reshape';
      for (let k = entry.offset; k < entry.offset + entry.count; k += 1) {
        const i = 3 * k;
        const dd = Math.hypot(a.points[i] - b.points[i], a.points[i + 1] - b.points[i + 1], a.points[i + 2] - b.points[i + 2]);
        if (dd > d) d = dd;
      }
    }
    return {index, distance: d, kind};
  });
}

// Largest point displacement between two poses.
export function displacement(set, a, b, sizes) {
  let worst = {index: -1, distance: 0, kind: 'motion'};
  for (const entry of partDisplacements(set, a, b, sizes)) if (entry.distance > worst.distance) worst = entry;
  return {distance: worst.distance, part: worst.index >= 0 ? set.tracked[worst.index].name : '', kind: worst.kind};
}

// World positions of the drawn vertices of one part.
function vertexCloud(object, limit) {
  object.updateWorldMatrix(true, false);
  const position = object.geometry.attributes.position;
  const [first, n] = drawnRange(object.geometry);
  const stride = Math.max(1, Math.ceil(n / limit)), cloud = [];
  for (let v = 0; v < n; v += stride) {
    scratch.fromBufferAttribute(position, first + v).applyMatrix4(object.matrixWorld);
    cloud.push(scratch.x, scratch.y, scratch.z);
  }
  return cloud;
}

function directedHausdorff(from, to) {
  let worst = 0;
  for (let i = 0; i < from.length; i += 3) {
    let best = Infinity;
    for (let j = 0; j < to.length && best > worst; j += 3) {
      const d = (from[i] - to[j]) ** 2 + (from[i + 1] - to[j + 1]) ** 2 + (from[i + 2] - to[j + 2]) ** 2;
      if (d < best) best = d;
    }
    worst = Math.max(worst, best);
  }
  return Math.sqrt(worst);
}

// Largest change of point velocity: (c - b)/h2 - (b - a)/h1.
function velocityChange(set, a, b, c, h1, h2) {
  let worst = 0, worstIndex = -1;
  set.tracked.forEach((entry, index) => {
    if (!(a.visible[index] && b.visible[index] && c.visible[index])) return;
    const rebuilt = a.bounds.has(index) && b.bounds.has(index) && c.bounds.has(index);
    if (!rebuilt && (a.counts[index] !== b.counts[index] || b.counts[index] !== c.counts[index])) return;
    for (let k = entry.offset; k < entry.offset + entry.count; k += 1) {
      const i = 3 * k;
      let s = 0;
      for (let q = 0; q < 3; q += 1) {
        const dv = (c.points[i + q] - b.points[i + q]) / h2 - (b.points[i + q] - a.points[i + q]) / h1;
        s += dv * dv;
      }
      s = Math.sqrt(s);
      if (s > worst) { worst = s; worstIndex = index; }
    }
  });
  return {change: worst, part: worstIndex >= 0 ? set.tracked[worstIndex].name : ''};
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((x, y) => x - y);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

/**
 * Measure one loaded model. The model must be freshly loaded (time 0).
 * Returns plain JSON-serialisable data.
 */
export function measureLoopSeams(model, options = {}) {
  const data = model.root.userData;
  const timing = data.animationTiming ?? {};
  const period = timing.authoredCyclePeriod;
  const playbackDuration = Number.isFinite(data.playbackDuration) && data.playbackDuration > 0 ? data.playbackDuration : null;
  const stepsPerPeriod = options.stepsPerPeriod ?? DEFAULT_STEPS_PER_PERIOD;
  const periods = options.periods ?? DEFAULT_PERIODS;
  const result = {
    period, displayCycleDuration: timing.displayCycleDuration, playbackTimeScale: timing.playbackTimeScale,
    supportsRestart: Boolean(data.supportsRestart), playbackDuration, simulationBackend: data.simulationBackend ?? null,
    configuration: data.configuration ?? null,
  };
  if (!(period > 0)) return {...result, error: 'no positive authoredCyclePeriod'};
  const h = period / stepsPerPeriod;
  const totalSteps = stepsPerPeriod * periods;
  const evaluate = (time, delta = 0) => { model.update?.(time, delta); return snapshot(model, set); };
  // A symmetric part turned about its own axis (a rod re-aimed with a
  // flipped twist, a plain disc re-indexed) looks the same: for the largest
  // movers compare the vertex clouds before and after, not corresponding
  // vertices. Stateless models only.
  const visibleJump = (a, b, pa, pb) => {
    const moved = partDisplacements(set, pa, pb, sizes).filter(entry => entry.distance > 1e-4 * size)
      .sort((x, y) => y.distance - x.distance).slice(0, 6);
    let worst = {distance: 0, index: -1, kind: 'motion'};
    for (const entry of moved) {
      let distance = entry.distance;
      if (entry.kind === 'motion' && distance > 1e-3 * size) {
        const object = set.tracked[entry.index].object;
        model.update?.(a, 0); const before = vertexCloud(object, 1500), beforeAll = vertexCloud(object, 8000);
        model.update?.(b, 0); const after = vertexCloud(object, 1500), afterAll = vertexCloud(object, 8000);
        distance = Math.min(distance, Math.max(directedHausdorff(before, afterAll), directedHausdorff(after, beforeAll)));
      }
      if (distance > worst.distance) worst = {...entry, distance};
    }
    return worst;
  };

  model.update?.(0, 0);
  const set = collectTracked(model.root);
  // Pre-pass: find geometry that is rebuilt as the model moves.
  for (let i = 1; i <= 48; i += 1) { model.update?.(i * period / 48, period / 48); snapshot(model, set); }
  if (model.reset) model.reset(); else model.update?.(0, 0);
  const pose0 = snapshot(model, set);
  const size = sizeOf(pose0);
  const sizes = objectSizes(set);
  result.modelSize = size;
  result.trackedObjects = set.tracked.length;

  // 1. Sequential sweep.
  const steps = new Float64Array(totalSteps + 1);
  const bends = new Float64Array(totalSteps + 1);
  const stepParts = new Array(totalSteps + 1).fill('');
  const checkpoints = new Map();
  const checkpointSteps = new Set([Math.round(stepsPerPeriod / 3), stepsPerPeriod + Math.round(stepsPerPeriod / 7)]);
  let before = null, previous = pose0;
  for (let i = 1; i <= totalSteps; i += 1) {
    const time = i * h;
    const pose = evaluate(time, h);
    const {distance, part} = displacement(set, previous, pose, sizes);
    steps[i] = distance;
    stepParts[i] = part;
    if (before) bends[i - 1] = velocityChange(set, before, previous, pose, h, h).change;
    if (checkpointSteps.has(i)) checkpoints.set(i, pose);
    before = previous;
    previous = pose;
  }
  const peakStep = Math.max(...steps);
  const peakSpeed = peakStep / h; // model units per authored second
  result.peakSpeedPerSize = peakSpeed * period / size;

  // Stateless models return the same pose whenever the same time is asked.
  let stateless = true;
  for (const [i, pose] of checkpoints) {
    const again = evaluate(i * h, 0);
    if (displacement(set, pose, again, sizes).distance > 1e-7 * size) stateless = false;
  }
  result.stateless = stateless;

  // 2. Abrupt steps: bisect to separate jumps from fast continuous motion.
  const candidates = [];
  for (let i = 1; i <= totalSteps; i += 1) {
    const neighbours = [];
    for (let j = i - 3; j <= i + 3; j += 1) if (j !== i && j >= 1 && j <= totalSteps) neighbours.push(steps[j]);
    const typical = median(neighbours);
    if (steps[i] > 5e-4 * size && steps[i] > 2.5 * typical) candidates.push({i, typical});
  }
  candidates.sort((x, y) => steps[y.i] - steps[x.i]);
  const jumps = [];
  for (const {i, typical} of candidates.slice(0, 16)) {
    let a = (i - 1) * h, b = i * h;
    if (stateless) {
      let pa = evaluate(a), pb = evaluate(b);
      for (let iteration = 0; iteration < 48 && b - a > 1e-12 * period; iteration += 1) {
        const m = (a + b) / 2, pm = evaluate(m);
        const left = displacement(set, pa, pm, sizes).distance, right = displacement(set, pm, pb, sizes).distance;
        if (left >= right) { b = m; pb = pm; } else { a = m; pa = pm; }
      }
      const worst = visibleJump(a, b, pa, pb);
      if (worst.distance > 1e-4 * size) jumps.push({time: (a + b) / 2, phase: ((a + b) / 2) / period, jump: worst.distance / size, part: set.tracked[worst.index].name, kind: worst.kind});
    } else {
      // Stateful: the excess over neighbouring steps estimates the jump.
      const excess = steps[i] - typical;
      if (excess > 1e-3 * size) jumps.push({time: i * h, phase: i * h / period, jump: excess / size, part: stepParts[i], estimated: true});
    }
  }
  // Merge duplicates found from adjacent steps.
  jumps.sort((x, y) => x.time - y.time);
  const merged = [];
  for (const jump of jumps) {
    const last = merged.at(-1);
    if (last && Math.abs(jump.time - last.time) < 1.5 * h) { if (jump.jump > last.jump) merged[merged.length - 1] = jump; }
    else merged.push(jump);
  }
  result.jumps = merged;
  result.maxJump = merged.reduce((m, jump) => Math.max(m, jump.jump), 0);

  // 3. Periodicity and velocity continuity at each k*P.
  const epsilon = 1e-6 * period;
  // Short enough that the fastest point moves 0.1% of the model size, so
  // steady rotation does not read as a velocity change.
  const delta = Math.min(period / 2000, peakSpeed > 0 ? 1e-3 * size / peakSpeed : Infinity);
  // Change of one-sided point velocity at t (stateless models), divided by
  // the peak point speed.
  const preciseKink = (t, gap = epsilon, width = delta) => {
    const l2 = evaluate(t - gap - width), l1 = evaluate(t - gap), r1 = evaluate(t + gap), r2 = evaluate(t + gap + width);
    let worst = 0;
    set.tracked.forEach((entry, index) => {
      if (!(l2.visible[index] && l1.visible[index] && r1.visible[index] && r2.visible[index])) return;
      if (![l2, l1, r1, r2].every(q => q.bounds.has(index)) && new Set([l2.counts[index], l1.counts[index], r1.counts[index], r2.counts[index]]).size > 1) return;
      for (let p = entry.offset; p < entry.offset + entry.count; p += 1) {
        const o = 3 * p;
        let s2 = 0;
        for (let c = 0; c < 3; c += 1) {
          const dv = (r2.points[o + c] - r1.points[o + c]) / width - (l1.points[o + c] - l2.points[o + c]) / width;
          s2 += dv * dv;
        }
        worst = Math.max(worst, Math.sqrt(s2));
      }
    });
    return peakSpeed > 0 ? worst / peakSpeed : 0;
  };
  if (stateless) {
    const start = evaluate(epsilon), end = evaluate(period - epsilon);
    const mismatch = displacement(set, start, end, sizes);
    result.periodMismatch = mismatch.distance / size;
    result.periodMismatchPart = mismatch.part;
    const seams = [];
    for (let k = 1; k <= periods; k += 1) {
      const t = k * period;
      const l2 = evaluate(t - epsilon - delta), l1 = evaluate(t - epsilon), r1 = evaluate(t + epsilon), r2 = evaluate(t + epsilon + delta);
      const seamJump = visibleJump(t - epsilon, t + epsilon, l1, r1);
      const jump = {distance: seamJump.distance, part: seamJump.index >= 0 ? set.tracked[seamJump.index].name : ''};
      // One-sided velocities on [l2,l1] and [r1,r2], ignoring any jump,
      // divided by the peak point speed.
      let worst = 0, part = '';
      set.tracked.forEach((entry, index) => {
        if (!(l2.visible[index] && l1.visible[index] && r1.visible[index] && r2.visible[index])) return;
        if (![l2, l1, r1, r2].every(q => q.bounds.has(index)) && new Set([l2.counts[index], l1.counts[index], r1.counts[index], r2.counts[index]]).size > 1) return;
        for (let p = entry.offset; p < entry.offset + entry.count; p += 1) {
          const o = 3 * p;
          let s = 0;
          for (let c = 0; c < 3; c += 1) {
            const dv = (r2.points[o + c] - r1.points[o + c]) / delta - (l1.points[o + c] - l2.points[o + c]) / delta;
            s += dv * dv;
          }
          s = Math.sqrt(s);
          if (s > worst) { worst = s; part = entry.name; }
        }
      });
      seams.push({k, time: t, jump: jump.distance / size, jumpPart: jump.part, kink: peakSpeed > 0 ? worst / peakSpeed : 0, kinkPart: part});
    }
    result.seams = seams;
    result.maxSeamKink = Math.max(...seams.map(s => s.kink));
    result.maxSeamJump = Math.max(...seams.map(s => s.jump));
    // Velocity kinks at detected internal wraps (not at k*P).
    for (const jump of merged) {
      const t = jump.time, w = delta;
      if (t - 2 * w < 0) continue;
      const l2 = evaluate(t - 2 * w), l1 = evaluate(t - w), r1 = evaluate(t + w), r2 = evaluate(t + 2 * w);
      let worst = 0;
      set.tracked.forEach((entry, index) => {
        if (!(l2.visible[index] && l1.visible[index] && r1.visible[index] && r2.visible[index])) return;
        if (![l2, l1, r1, r2].every(q => q.bounds.has(index)) && new Set([l2.counts[index], l1.counts[index], r1.counts[index], r2.counts[index]]).size > 1) return;
        for (let p = entry.offset; p < entry.offset + entry.count; p += 1) {
          const o = 3 * p;
          let s = 0;
          for (let c = 0; c < 3; c += 1) { const dv = (r2.points[o + c] - r1.points[o + c]) / w - (l1.points[o + c] - l2.points[o + c]) / w; s += dv * dv; }
          worst = Math.max(worst, Math.sqrt(s));
        }
      });
      jump.kink = peakSpeed > 0 ? worst / peakSpeed : 0;
    }
  } else {
    // Stateful: use the sweep's own samples around each k*P.
    const seams = [];
    for (let k = 1; k <= periods; k += 1) {
      const i = k * stepsPerPeriod;
      const neighbours = [steps[i - 2], steps[i - 1], steps[i + 2], steps[i + 3]].filter(Number.isFinite);
      const excess = Math.max(steps[i] ?? 0, steps[i + 1] ?? 0) - median(neighbours);
      seams.push({k, time: k * period, jump: Math.max(0, excess) / size, kink: peakSpeed > 0 ? Math.max(bends[i - 1] ?? 0, bends[i] ?? 0, bends[i + 1] ?? 0) / peakSpeed : 0, estimated: true});
    }
    result.seams = seams;
    result.maxSeamKink = Math.max(...seams.map(s => s.kink));
    result.maxSeamJump = Math.max(...seams.map(s => s.jump));
  }

  // Interior hard kinks from the sweep (informational: ratchet drops,
  // escapement impulses and dwell ends are genuine mechanical events).
  const hardKinks = [];
  for (let i = 1; i < totalSteps; i += 1) {
    const ratio = peakSpeed > 0 ? bends[i] / peakSpeed : 0;
    if (ratio > 0.5) hardKinks.push({time: i * h, phase: (i * h / period) % 1, ratio});
  }
  result.hardKinkCount = hardKinks.length;
  // Is the sharpest velocity change at the loop point also found mid-cycle?
  // Then it is a mechanical event of the movement (a pin strike, a rack
  // reversal), not a loop seam. Coarse sweep values are compared with each
  // other.
  let seamBend = 0, interiorBend = 0;
  for (let i = 1; i < totalSteps; i += 1) {
    const offset = i % stepsPerPeriod, nearSeam = offset <= 2 || offset >= stepsPerPeriod - 2;
    if (nearSeam) seamBend = Math.max(seamBend, bends[i]); else interiorBend = Math.max(interiorBend, bends[i]);
  }
  result.seamBendRatio = peakSpeed > 0 ? seamBend / peakSpeed : 0;
  result.interiorBendRatio = peakSpeed > 0 ? interiorBend / peakSpeed : 0;
  result.seamKinkAlsoMidCycle = interiorBend >= 0.7 * seamBend;
  if (stateless && (result.maxSeamKink ?? 0) > KINK_TOLERANCE && !result.seamKinkAlsoMidCycle) {
    // The sweep can miss a short mid-cycle event; measure the sharpest few
    // mid-cycle bends precisely across their steps.
    const interior = [];
    for (let i = 1; i < stepsPerPeriod * periods; i += 1) {
      const offset = i % stepsPerPeriod;
      if (offset > 2 && offset < stepsPerPeriod - 2) interior.push(i);
    }
    interior.sort((a, b) => bends[b] - bends[a]);
    let precise = 0;
    // Windows straddling the scanned point by a sixteenth of a step catch a
    // velocity step anywhere within the sharpest bends' steps.
    const w = h / 16;
    for (const i of interior.slice(0, 4)) for (let j = 0; j <= 48; j += 1) precise = Math.max(precise, preciseKink((i - 2) * h + j * w, w, Math.min(w, delta * 4)));
    result.interiorPreciseKink = precise;
    result.seamKinkAlsoMidCycle = precise >= 0.7 * result.maxSeamKink;
  }

  // 4. Runs that stop moving.
  const windowMotion = [];
  for (let k = 0; k < periods; k += 1) {
    let m = 0;
    for (let i = k * stepsPerPeriod + 1; i <= (k + 1) * stepsPerPeriod; i += 1) m = Math.max(m, steps[i]);
    windowMotion.push(m / size);
  }
  result.windowMotion = windowMotion;
  result.stalls = windowMotion[0] > 1e-5 && windowMotion.at(-1) < 1e-6;
  if (stateless && !result.stalls && windowMotion[0] > 1e-5) {
    // A late probe catches time clamps beyond the sweep.
    const late = 50 * period;
    const a = evaluate(late), b = evaluate(late + period / 3), c = evaluate(late + 2 * period / 3);
    const motion = Math.max(displacement(set, a, b, sizes).distance, displacement(set, b, c, sizes).distance) / size;
    result.lateMotion = motion;
    if (motion < 1e-6) result.stalls = true;
    // Is the model eventually periodic at a whole number of declared periods?
    result.latePeriodMismatch = displacement(set, evaluate(late + period / 5), evaluate(late + period + period / 5), sizes).distance / size;
  }
  result.static = windowMotion.every(m => m < 1e-6);
  result.finiteRun = playbackDuration !== null;

  // Classify. A discontinuity at a whole number of declared periods (or any
  // rigid/vertex teleport) is a seam; a part that appears, vanishes or is
  // rebuilt in a different shape mid-cycle (a water stream switching on) is
  // an intra-cycle pop, reported separately.
  // Bisected jumps are located precisely; sweep estimates only to a step.
  const nearLoop = jump => Math.abs(jump.phase - Math.round(jump.phase)) < (jump.estimated ? 1.5 / stepsPerPeriod : 1e-3)
    && Math.round(jump.phase) >= 1;
  for (const jump of merged) jump.atLoop = nearLoop(jump);
  const seamJumps = merged.filter(jump => jump.atLoop || jump.kind === 'motion');
  const pops = merged.filter(jump => !seamJumps.includes(jump));
  result.pops = pops;
  result.maxPop = pops.reduce((m, jump) => Math.max(m, jump.jump), 0);
  result.maxSeamJumpAny = Math.max(result.maxSeamJump ?? 0, ...seamJumps.map(jump => jump.jump));
  const jumpScore = result.maxSeamJumpAny / JUMP_TOLERANCE;
  const kinkScore = result.seamKinkAlsoMidCycle ? 0 : (result.maxSeamKink ?? 0) / KINK_TOLERANCE;
  result.mechanicalKinkScore = result.seamKinkAlsoMidCycle ? (result.maxSeamKink ?? 0) / KINK_TOLERANCE : 0;
  const internalKinkScore = Math.max(0, ...seamJumps.filter(j => j.atLoop).map(j => j.kink ?? 0)) / KINK_TOLERANCE;
  result.popScore = result.maxPop / JUMP_TOLERANCE;
  result.score = Math.max(jumpScore, kinkScore, internalKinkScore, result.finiteRun ? 100 : 0, result.stalls ? 50 : 0);
  result.issues = [];
  if (result.finiteRun) result.issues.push(`finite run ${playbackDuration}s then stops`);
  if (result.stalls) result.issues.push('stops moving and holds');
  if (jumpScore > 1) {
    const worst = [...seamJumps, ...(result.seams ?? []).map(seam => ({...seam, part: seam.jumpPart, atLoop: true}))]
      .sort((x, y) => (y.jump ?? 0) - (x.jump ?? 0))[0];
    result.issues.push(`${worst.atLoop ? 'loop' : 'mid-cycle'} ${worst.kind ?? 'position'} jump ${(worst.jump * 100).toFixed(2)}% at t=${worst.time.toFixed(3)} (${worst.part ?? ''})`);
  }
  if (kinkScore > 1) {
    const worst = result.seams.slice().sort((x, y) => y.kink - x.kink)[0];
    result.issues.push(`velocity kink ${worst.kink.toFixed(2)} at k*P=${worst.time.toFixed(3)} (${worst.kinkPart ?? ''})`);
  }
  if (internalKinkScore > 1 && jumpScore <= 1) result.issues.push('velocity kink at loop wrap');
  if (result.mechanicalKinkScore > 1) result.issues.push(`[mechanical] velocity change ${result.maxSeamKink.toFixed(2)} at loop point matches mid-cycle events`);
  if (result.popScore > 1) {
    const worst = pops.slice().sort((x, y) => y.jump - x.jump)[0];
    result.issues.push(`[pop] ${worst.kind} ${(worst.jump * 100).toFixed(2)}% at phase ${(worst.phase % 1).toFixed(3)} (${worst.part})`);
  }
  return result;
}
