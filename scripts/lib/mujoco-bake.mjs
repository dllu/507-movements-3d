// Generic offline bake of a live MuJoCo movement into a seamless loop.
// See docs/p60-bake-tool-review.md for the method. Node only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {encodeArray, encodeSmoothArray, encodeUserValue, objectKeys, resolveObjectKeys, ROOT_USER_DATA_KEYS} from '../../src/simulation/baked/mujoco-bake-format.js';
import {makeBakedMujocoModel} from '../../src/simulation/baked/mujoco-playback.js';
import {creaseNormalsIn} from '../../src/simulation/crease-normals.js';
import {disposeObject3D} from '../../src/simulation/dispose-model.js';

export const repository = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const PIXEL = .01; // world units per engraving pixel in these reconstructions

export const BAKE_DEFAULTS = {
  sampleRate: 60, // target samples per second of simulated time
  warmupPeriods: 2, // start-up transient discarded before any loop start
  maxLoopPeriods: 6, // longest loop considered, in drive periods
  searchPeriods: 6, // extra loop-start candidates after the warm-up
  tolerancePixels: .25, // largest raw seam error accepted before smoothing
  velocitySamples: 2, // seam also compared this many samples later
  minLoopSeconds: 0,
  cycle: 'periodic', // or 'palindrome' (forward then time-reversed)
};

/** Source files whose change invalidates recorded motion (geometry.js and section.js are visual-only unless the compiled MJCF changes). */
// A movement whose live factory also uses another movement's physics (107
// uses 106's) lists both folders: directory: [own, shared].
export function motionSources(liveDirectory) {
  const own = [liveDirectory].flat().flatMap(directory => fs.readdirSync(path.join(repository, directory))
    .filter(f => f.endsWith('.js') && !['geometry.js', 'section.js'].includes(f)).sort().map(f => path.join(directory, f)));
  return [...own, 'src/simulation/mujoco/simulation.js'];
}
export function visualSources(liveDirectory) {
  return [liveDirectory].flat().flatMap(directory => fs.readdirSync(path.join(repository, directory))
    .filter(f => ['geometry.js', 'section.js'].includes(f)).sort().map(f => path.join(directory, f)));
}
/**
 * Fingerprint of a compiled model's joints, contacts and drive, excluding
 * <inertial> elements: a support or shaft stub added to a moving part's
 * visible geometry changes its computed mass slightly but not the recorded
 * motion enough to matter, so it does not force a rebake. Collision cells,
 * joints and actuators do.
 */
export const physicsFingerprint = xml => sha256(xml.replace(/<inertial\b[^>]*\/>/g, '<inertial/>'));
export const hashFiles = files => Object.fromEntries(files.map(f => [f, sha256(fs.readFileSync(path.join(repository, f)))]));

function stepsPerSample(period, timestep, rate) {
  const steps = Math.round(period / timestep);
  if (Math.abs(steps * timestep - period) > 1e-9 * Math.max(1, period)) throw new RangeError(`Drive period ${period} is not a whole number of ${timestep} s steps`);
  // Samples per period must divide the steps per period; take the divisor
  // nearest the target rate, not below it.
  let best;
  for (let n = 1; n <= steps; n++) if (steps % n === 0 && n >= period * rate * .98 && (!best || n < best)) best = n;
  return {samplesPerPeriod: best ?? steps, stepsPerPeriod: steps};
}

const attributeIds = new WeakMap();let nextAttributeId = 1;
const attributeId = a => {if (!a) return 0;if (!attributeIds.has(a)) attributeIds.set(a, nextAttributeId++);return attributeIds.get(a);};
function geometrySignature(g) {
  const p = g.attributes.position, n = g.attributes.normal;
  return [g.uuid, attributeId(p), p?.version, attributeId(n), n?.version, attributeId(g.index), g.index?.version, g.drawRange.start, g.drawRange.count].join(':');
}
function snapshotGeometry(g) {
  const p = g.attributes.position;
  return {position: p ? Float32Array.from(p.array.subarray(0, p.count * 3)) : new Float32Array(), normal: g.attributes.normal ? Float32Array.from(g.attributes.normal.array.subarray(0, p.count * 3)) : null,
    index: g.index ? Uint32Array.from(g.index.array) : null, drawCount: g.drawRange.count, groups: g.groups.map(x => ({...x}))};
}

/**
 * Run the live model from t=0 and record every object's local pose, visibility and deforming geometry.
 * curves: {meshKey: live => points} for rebuilt ropes and cords whose surface
 * (a laid rope's strands) is too detailed to store per frame; their centreline
 * points are recorded instead and the route's sync rebuilds the mesh.
 * derivedMeshes: keys of meshes the route's sync rebuilds from those curves
 * (a rope lead beyond the crop), whose vertices are not recorded either.
 */
export function record(live, {period, sampleRate, totalPeriods, curves = {}, derivedMeshes = []}) {
  const timestep = live.physics?.timestep;
  if (!(timestep > 0)) throw new Error('Live model exposes no physics timestep');
  const {samplesPerPeriod} = stepsPerSample(period, timestep, sampleRate), dt = period / samplesPerPeriod;
  const total = samplesPerPeriod * totalPeriods + 1, root = live.root;
  const keys = objectKeys(root), objects = [...keys.keys()], index = new Map(objects.map((o, i) => [o, i]));
  const poses = objects.map(() => new Float64Array(total * 7)), visible = objects.map(() => new Uint8Array(total)), scale = objects.map(o => o.scale.toArray());
  const curveKeys = new Set(Object.keys(curves)), curveTracks = new Map(Object.keys(curves).map(key => [key, []]));
  for (const key of curveKeys) if (![...keys.values()].includes(key)) throw new Error('No curve mesh at ' + key);
  const unrecorded = new Set([...curveKeys, ...derivedMeshes]);
  for (const key of derivedMeshes) if (![...keys.values()].includes(key)) throw new Error('No derived mesh at ' + key);
  const meshes = objects.filter(o => o.geometry && !unrecorded.has(keys.get(o))), signatures = new Map(), frames = new Map(meshes.map(m => [m, []]));
  const nq = live.physics.model?.nq ?? 0, qpos = new Float32Array(total * nq);
  const geometries = new Map();
  for (let s = 0; s < total; s++) {
    live.update(s * dt);
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      if (o.parent === null || !keys.has(o)) throw new Error('A recorded part was removed during the simulation');
      o.position.toArray(poses[i], 7 * s);o.quaternion.toArray(poses[i], 7 * s + 3);visible[i][s] = o.visible ? 1 : 0;
      if (s > 0) {
        const q = poses[i], k = 7 * s;
        // Keep quaternion signs continuous for interpolation.
        if (q[k + 3] * q[k - 4] + q[k + 4] * q[k - 3] + q[k + 5] * q[k - 2] + q[k + 6] * q[k - 1] < 0) for (let c = 3; c < 7; c++) q[k + c] = -q[k + c];
      }
      if (!o.scale.equals(new THREE.Vector3(...scale[i]))) throw new Error('Scale animation is not supported by the bake');
    }
    let added = 0;root.traverse(() => added++);
    if (added !== objects.length + 1) throw new Error('Parts were added or removed during the simulation');
    for (const m of meshes) {
      const signature = geometrySignature(m.geometry);
      if (signatures.get(m) !== signature) {signatures.set(m, signature);frames.get(m).push([s, snapshotGeometry(m.geometry)]);}
      geometries.set(m, m.geometry);
    }
    if (nq) qpos.set(live.physics.data.qpos.subarray ? live.physics.data.qpos.subarray(0, nq) : Array.from(live.physics.data.qpos).slice(0, nq), s * nq);
    for (const [key, list] of curveTracks) {
      const points = Float64Array.from(curves[key](live).flat());
      if (list.length && points.length !== list[0].length) throw new Error(`Point count of curve ${key} changes during the simulation`);
      list.push(points);
    }
  }
  return {objects, keys, index, poses, visible, scale, frames, qpos, nq, dt, total, samplesPerPeriod, period, timestep, curves: curveTracks};
}

const frameAt = (list, s) => {let f = list[0][1];for (const [t, g] of list) {if (t <= s) f = g;else break;}return f;};
const quat = (pose, s) => new THREE.Quaternion().fromArray(pose, 7 * s + 3);
const vec = (pose, s) => new THREE.Vector3().fromArray(pose, 7 * s);

// Rotation increments are taken in each part's own frame, where a hinged
// part's spin axis is fixed even while the part is carried about (a roller on
// a sliding follower).
const localStep = (pose, s) => quat(pose, s - 1).invert().multiply(quat(pose, s));
function signedAngle(d, axis) {
  const angle = 2 * Math.acos(Math.min(1, Math.abs(d.w)));
  if (angle < 1e-12) return 0;
  return angle * Math.sign(new THREE.Vector3(d.x, d.y, d.z).multiplyScalar(Math.sign(d.w) || 1).dot(axis));
}

/** Parts that turn steadily (net rotation beyond half a turn over the record). */
function findRotators(rec, fromSample, overrides = {}) {
  const rotators = new Map();
  rec.objects.forEach((o, i) => {
    const key = rec.keys.get(o), override = overrides[key];
    if (override === false) return;
    const pose = rec.poses[i];let axis = null, cumulative = 0, peak = 0, offAxis = 0;
    for (let s = fromSample + 1; s < rec.total; s++) {
      // atan2 of the vector part: a step that is the identity to within
      // rounding (w = 1 - 1e-16, zero vector) has no axis and is skipped.
      const d = localStep(pose, s), angle = 2 * Math.atan2(Math.hypot(d.x, d.y, d.z), Math.abs(d.w));
      if (angle < 1e-9) continue;
      const a = new THREE.Vector3(d.x, d.y, d.z).normalize().multiplyScalar(Math.sign(d.w) || 1);
      axis ??= a.clone();
      offAxis = Math.max(offAxis, 1 - Math.abs(a.dot(axis)));
      cumulative += signedAngle(d, axis);peak = Math.max(peak, Math.abs(cumulative));
    }
    if (!axis || !(override || peak > Math.PI)) return;
    if (offAxis > 1e-4) throw new Error(`Turning part ${key} has no fixed spin axis; its loop wrap is not supported`);
    rotators.set(i, {axis, symmetry: override?.symmetry});
  });
  return rotators;
}

/** Turn about a part's own spin axis that carries its loop-start pose to its loop-end pose. */
function wrapFor(rec, i, rotator, a, b) {
  const pose = rec.poses[i];let angle = 0;
  for (let s = a + 1; s <= b; s++) angle += signedAngle(localStep(pose, s), rotator.axis);
  const raw = angle;
  if (rotator.symmetry) angle = Math.round(angle / rotator.symmetry) * rotator.symmetry;
  return {axis: rotator.axis.clone(), angle, raw};
}

function applyWrap(position, quaternion, wrap) {
  quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(wrap.axis, wrap.angle));
}

/** World-space seam error (pixels) between sample a (carried by wraps) and sample b. */
function seamError(rec, a, b, wraps, boxes) {
  const worldA = new Map(), worldB = new Map(), m = new THREE.Matrix4();
  const world = (map, o, s, wrap) => {
    if (map.has(o)) return map.get(o);
    const i = rec.index.get(o), p = vec(rec.poses[i], s), q = quat(rec.poses[i], s);
    if (wrap && wraps.has(i)) applyWrap(p, q, wraps.get(i));
    const local = new THREE.Matrix4().compose(p, q, new THREE.Vector3(...rec.scale[i]));
    const parent = rec.index.has(o.parent) ? world(map, o.parent, s, wrap) : new THREE.Matrix4();
    const result = parent.clone().multiply(local);map.set(o, result);return result;
  };
  let error = 0, worst = null;const corner = new THREE.Vector3(), other = new THREE.Vector3();
  for (const [o, box] of boxes) {
    const before = error;
    const i = rec.index.get(o);
    if (rec.visible[i][a] !== rec.visible[i][b]) return Infinity;
    const A = world(worldA, o, a, true), B = world(worldB, o, b, false);
    for (let c = 0; c < 8; c++) {
      corner.set(c & 1 ? box.max.x : box.min.x, c & 2 ? box.max.y : box.min.y, c & 4 ? box.max.z : box.min.z);
      error = Math.max(error, other.copy(corner).applyMatrix4(A).distanceTo(corner.applyMatrix4(B)));
    }
    const list = rec.frames.get(o);
    if (list?.length > 1) {
      const fa = frameAt(list, a), fb = frameAt(list, b);
      if (fa.position.length !== fb.position.length) return Infinity;
      for (let k = 0; k < fa.position.length; k += 3) error = Math.max(error, Math.hypot(fa.position[k] - fb.position[k], fa.position[k + 1] - fb.position[k + 1], fa.position[k + 2] - fb.position[k + 2]));
      if (fa.drawCount !== fb.drawCount) return Infinity;
    }
    if (error > before) worst = rec.keys.get(o);
  }
  for (const [key, list] of rec.curves ?? []) {
    const before = error, pa = list[a], pb = list[b];
    for (let k = 0; k < pa.length; k += 3) error = Math.max(error, Math.hypot(pa[k] - pb[k], pa[k + 1] - pb[k + 1], pa[k + 2] - pb[k + 2]));
    if (error > before) worst = key;
  }
  seamError.worst = worst;
  return error / PIXEL;
}

/** Choose the loop: whole drive periods, after the warm-up, whose seam closes. */
export function chooseLoop(rec, config) {
  const spp = rec.samplesPerPeriod, periods = Math.floor((rec.total - 1) / spp);
  const rotators = findRotators(rec, config.warmupPeriods * spp, config.wrap);
  const boxes = new Map();
  for (const o of rec.objects) if (o.geometry && rec.frames.has(o)) {
    const f = rec.frames.get(o)[0][1], box = new THREE.Box3();
    for (let k = 0; k < f.position.length; k += 3) box.expandByPoint(new THREE.Vector3(f.position[k], f.position[k + 1], f.position[k + 2]));
    if (!box.isEmpty()) boxes.set(o, box);
  }
  const candidates = [];
  for (let n = 1; n <= config.maxLoopPeriods; n++) {
    if (n * rec.period < config.minLoopSeconds - 1e-9) continue;
    for (let k = config.warmupPeriods; k + n <= periods; k++) {
      const a = k * spp, b = (k + n) * spp;
      if (b + config.velocitySamples >= rec.total) continue;
      const wraps = new Map([...rotators].map(([i, r]) => [i, wrapFor(rec, i, r, a, b)]));
      let error = 0;
      let worst;
      for (let j = 0; j <= config.velocitySamples && error < Infinity; j++) {const e = seamError(rec, a + j, b + j, wraps, boxes);if (e > error) {error = e;worst = seamError.worst;}}
      candidates.push({k, n, a, b, error, wraps, worst});
    }
    const closed = candidates.filter(c => c.n === n && c.error <= config.tolerancePixels);
    if (closed.length) return {...closed.sort((x, y) => x.error - y.error)[0], rotators, candidates};
  }
  const best = candidates.sort((x, y) => x.error - y.error)[0];
  const summary = candidates.slice(0, 8).map(c => `start ${c.k}P, ${c.n}P: ${c.error.toFixed(3)} px at ${c.worst}`).join('; ');
  throw new Error(`No loop closes within ${config.tolerancePixels} px (best ${best?.error.toFixed(3)} px). Candidates: ${summary}. Consider more warm-up, a longer record, wrap symmetry, or a palindrome/reversing cycle.`);
}

const quantize = (frames, count) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of frames) for (let k = 0; k < count * 3; k++) {min[k % 3] = Math.min(min[k % 3], f[k]);max[k % 3] = Math.max(max[k % 3], f[k]);}
  const center = min.map((v, c) => (v + max[c]) / 2), scale = min.map((v, c) => Math.max((max[c] - v) / 65534, 1e-9));
  const data = new Int16Array(frames.length * count * 3);
  frames.forEach((f, i) => {for (let k = 0; k < count * 3; k++) data[i * count * 3 + k] = Math.round((f[k] - center[k % 3]) / scale[k % 3]);});
  return {encoding: 'quantized', frames: frames.length, min: center, scale, data: encodeArray('i16', data)};
};

// Deforming parts (cords, springs) move with few degrees of freedom, so their
// vertex frames are stored as a mean plus a small orthonormal basis found by
// subspace iteration, with per-frame coefficients. The basis grows until the
// largest reconstruction error is within tolerance; otherwise frames are
// stored quantized.
function principalFrames(frames, tolerance, maximumComponents = 64) {
  const F = frames.length, D = frames[0].length, mean = new Float64Array(D);
  for (const f of frames) for (let d = 0; d < D; d++) mean[d] += f[d] / F;
  const X = frames.map(f => Float64Array.from(f, (v, d) => v - mean[d]));
  let seed = 1;const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - .5;
  const limit = Math.min(maximumComponents, F, D);
  for (const k of [...new Set([1, 2, 4, 8, 16, 32, 64].map(k => Math.min(k, limit)))]) {
    let Q = Array.from({length: k}, () => Float64Array.from({length: D}, random));
    const orthonormalize = vectors => {
      const out = [];
      for (const v of vectors) {
        let before = 0;for (let d = 0; d < D; d++) before += v[d] * v[d];before = Math.sqrt(before);
        // Two Gram-Schmidt passes: when the data have fewer independent
        // modes than the basis (a one-parameter spring), the extra vectors
        // are nearly dependent and one pass leaves them far from orthogonal.
        for (let pass = 0; pass < 2; pass++) for (const u of out) {let dot = 0;for (let d = 0; d < D; d++) dot += u[d] * v[d];for (let d = 0; d < D; d++) v[d] -= dot * u[d];}
        let norm = 0;for (let d = 0; d < D; d++) norm += v[d] * v[d];norm = Math.sqrt(norm);
        if (norm > 1e-12 && norm > 1e-10 * before) {for (let d = 0; d < D; d++) v[d] /= norm;out.push(v);}
      }
      return out;
    };
    Q = orthonormalize(Q);
    const project = basis => X.map(x => basis.map(u => {let dot = 0;for (let d = 0; d < D; d++) dot += u[d] * x[d];return dot;}));
    for (let iteration = 0; iteration < 10; iteration++) {
      const Z = project(Q), W = Q.map(() => new Float64Array(D));
      for (let f = 0; f < F; f++) for (let j = 0; j < Q.length; j++) {const z = Z[f][j], x = X[f], w = W[j];for (let d = 0; d < D; d++) w[d] += z * x[d];}
      Q = orthonormalize(W);
    }
    const C = project(Q);let error = 0;
    for (let f = 0; f < F; f++) for (let d = 0; d < D; d++) {
      let v = X[f][d];for (let j = 0; j < Q.length; j++) v -= C[f][j] * Q[j][d];
      error = Math.max(error, Math.abs(v));
    }
    if (error <= tolerance) {
      return {encoding: 'principal', frames: F, components: Q.length, maximumError: error, mean: encodeArray('f32', mean),
        basis: encodeArray('f32', Q.flatMap(u => Array.from(u))), coefficients: encodeArray('f32', C.flat())};
    }
  }
  return null;
}

function storeFrames(frames, count, tolerance) {
  if (frames.length > 2) {const principal = principalFrames(frames, tolerance);if (principal) return principal;}
  return quantize(frames, count);
}

/** Build one variant's tracks from the chosen window, smoothing any residual seam error across the loop. */
export function buildVariant(rec, loop, refKeys, config) {
  const {a} = loop;let {b} = loop;
  let order = [];for (let s = a; s <= b; s++) order.push(s);
  if (config.cycle === 'palindrome') {order = [...order, ...order.slice(0, -1).reverse()];b = a;}
  const N = order.length - 1, wraps = config.cycle === 'palindrome' ? new Map() : loop.wraps;
  const transforms = [], visibility = [], vertices = [];let maximumCorrection = 0, maximumRotation = 0;
  const same = (x, y, eps = 1e-7) => x.every((v, i) => Math.abs(v - y[i]) <= eps);
  rec.objects.forEach((o, i) => {
    const key = rec.keys.get(o), ref = refKeys.get(key), pose = rec.poses[i];
    const P = order.map(s => vec(pose, s)), Q = order.map(s => quat(pose, s));
    const wrap = wraps.get(i);
    // Residual between the loop end and the (wrapped) loop start, removed linearly.
    const targetP = P[0].clone(), targetQ = Q[0].clone();
    if (wrap) applyWrap(targetP, targetQ, wrap);
    const dP = P[N].clone().sub(targetP), dQ = targetQ.clone().multiply(Q[N].clone().invert());
    maximumCorrection = Math.max(maximumCorrection, dP.length() / PIXEL);maximumRotation = Math.max(maximumRotation, 2 * Math.acos(Math.min(1, Math.abs(dQ.w))));
    for (let s = 0; s <= N; s++) {
      const w = s / N;P[s].addScaledVector(dP, -w);
      Q[s].premultiply(new THREE.Quaternion().slerp(dQ, w));
      if (s && Q[s].dot(Q[s - 1]) < 0) Q[s].set(-Q[s].x, -Q[s].y, -Q[s].z, -Q[s].w);
    }
    const flatP = P.flatMap(p => p.toArray()), flatQ = Q.flatMap(q => q.toArray());
    const movesP = P.some(p => p.distanceTo(P[0]) > 1e-7), movesQ = Q.some(q => 1 - Math.abs(q.dot(Q[0])) > 1e-12);
    const differs = !ref || !same(P[0].toArray(), ref.position.toArray()) || !same(Q[0].toArray(), ref.quaternion.toArray(), 1e-7) && !same(Q[0].toArray().map(v => -v), ref.quaternion.toArray(), 1e-7) || !same(rec.scale[i], ref.scale.toArray());

    if (movesP || movesQ || wrap || differs) {
      // Smooth tracks: 1e-4 units (0.01 px) and 1e-5 per quaternion component
      // (under 0.01 px at three units from the part origin).
      transforms.push({key, position: movesP ? encodeSmoothArray(flatP, 3, 1e-4) : P[0].toArray(), quaternion: movesQ ? encodeSmoothArray(flatQ, 4, 1e-5) : Q[0].toArray(),
        ...(same(rec.scale[i], [1, 1, 1]) ? {} : {scale: rec.scale[i]}),
        ...(wrap ? {wrap: {axis: wrap.axis.toArray(), angle: wrap.angle}} : {})});
    }
    const vis = order.map(s => rec.visible[i][s]), runs = [];
    vis.forEach((v, s) => {if (!runs.length || runs.at(-1)[1] !== v) runs.push([s, v]);});
    if (runs.length > 1 || !ref || Boolean(vis[0]) !== ref.visible) visibility.push({key, runs});
    if (o.geometry && rec.frames.has(o)) {
      const list = rec.frames.get(o), start = frameAt(list, order[0]);
      const changes = list.some(([t]) => t > order[0] && t <= loop.b), refGeometry = ref?.geometry;
      const refPosition = refGeometry?.attributes.position;
      const differsGeometry = !refGeometry || !refPosition || refPosition.count * 3 !== start.position.length
        || !same(Array.from(refPosition.array.subarray(0, start.position.length)), Array.from(start.position), 1e-6)
        || (refGeometry.index?.count ?? -1) !== (start.index?.length ?? -1) || refGeometry.drawRange.count !== start.drawCount;
      if (changes || (differsGeometry && ref)) {
        const count = start.position.length / 3, fs = changes ? order.map(s => frameAt(list, s)) : [start];
        if (fs.some(f => f.position.length !== count * 3)) throw new Error(`Vertex count of ${key} changes during the loop`);
        if (fs.some(f => (f.index?.length ?? -1) !== (start.index?.length ?? -1))) throw new Error(`Topology of ${key} changes during the loop`);
        const positions = fs.map(f => Float32Array.from(f.position));
        if (changes && config.cycle !== 'palindrome') {
          const last = positions.at(-1), first = positions[0], M = positions.length - 1;
          const residual = last.map((v, k) => v - first[k]);
          positions.forEach((f, s) => {for (let k = 0; k < f.length; k++) f[k] -= residual[k] * s / M;});
          for (let k = 0; k < residual.length; k += 3) maximumCorrection = Math.max(maximumCorrection, Math.hypot(residual[k], residual[k + 1], residual[k + 2]) / PIXEL);
        }
        const normals = start.normal ? storeFrames(fs.map(f => f.normal), count, .01) : null;
        const draw = fs.map(f => f.drawCount);
        vertices.push({key, count, positions: storeFrames(positions, count, .02 * PIXEL), ...(normals ? {normals} : {}),
          // An unchanged index is taken from the current geometry, not stored.
          ...(start.index ? (refGeometry?.index?.count === start.index.length && start.index.every((v, k) => v === refGeometry.index.array[k])
            ? {reuseIndex: true} : {index: encodeArray('u32', start.index)}) : {}), ...(start.groups.length ? {groups: start.groups} : {}),
          ...(draw.some(d => d !== draw[0]) || draw[0] !== Infinity ? {drawRange: encodeArray('f32', draw.map(d => (Number.isFinite(d) ? d : 3e38)))} : {})});
      }
    }
  });
  // qpos: false omits the joint coordinates (a many-section cord's are large
  // and nothing in playback reads them).
  const qpos = rec.nq && config.qpos !== false ? {width: rec.nq, data: encodeArray('f32', order.flatMap(s => Array.from(rec.qpos.subarray(s * rec.nq, s * rec.nq + rec.nq))))} : undefined;
  // Curve centrelines, with any seam residual spread over the loop like vertices.
  const curves = [...(rec.curves ?? [])].map(([key, list]) => {
    const frames = order.map(s => Float64Array.from(list[s])), width = frames[0].length;
    if (config.cycle !== 'palindrome') {
      const residual = frames[N].map((v, k) => v - frames[0][k]);
      frames.forEach((f, s) => {for (let k = 0; k < width; k++) f[k] -= residual[k] * s / N;});
      for (let k = 0; k < width; k += 3) maximumCorrection = Math.max(maximumCorrection, Math.hypot(residual[k], residual[k + 1], residual[k + 2]) / PIXEL);
    }
    return {key, width, points: storeFrames(frames.map(f => Float32Array.from(f)), width / 3, .02 * PIXEL)};
  });
  return {
    loop: {mode: config.cycle, duration: N * rec.dt, samples: N, dt: rec.dt, startTime: loop.a * rec.dt, periods: loop.n * (config.cycle === 'palindrome' ? 2 : 1), drivePeriod: rec.period},
    closure: {rawSeamPixels: loop.error, maximumCorrectionPixels: maximumCorrection, maximumRotationCorrection: maximumRotation, wraps: [...wraps].map(([i, w]) => ({key: rec.keys.get(rec.objects[i]), angle: w.angle, rawAngle: w.raw}))},
    transforms, visibility, vertices, qpos, ...(curves.length ? {curves} : {}),
  };
}

function jsonUserData(value) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) {const items = value.map(jsonUserData);return items.includes(undefined) ? undefined : items;}
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value).map(([k, v]) => [k, jsonUserData(v)]).filter(([, v]) => v !== undefined);
    return Object.fromEntries(entries);
  }
  return undefined;
}

/** Serialize a live-only part (added by visual.js) with plain buffer geometry. */
function serializeExtra(object) {
  const copy = object.clone(true);
  copy.traverse(o => {
    o.userData = jsonUserData(o.userData) ?? {};
    if (o.geometry) {
      // A plain copy: subclasses such as LaidRopeGeometry cannot clone()
      // without their construction curve.
      const g = new THREE.BufferGeometry().copy(o.geometry);
      const holder = new THREE.Group();holder.add(new THREE.Mesh(g));creaseNormalsIn(holder);
      const plain = new THREE.BufferGeometry().copy(g);plain.userData = {};g.dispose();o.geometry = plain;
    }
  });
  const json = copy.toJSON();
  copy.traverse(o => o.geometry?.dispose());
  return json;
}

const MATERIAL_PROPS = ['color', 'emissive', 'opacity', 'transparent', 'metalness', 'roughness', 'side', 'depthWrite', 'visible', 'wireframe', 'flatShading'];
const OBJECT_PROPS = ['castShadow', 'receiveShadow', 'renderOrder', 'frustumCulled'];

/** Differences between the live model and the geometry-only build that playback must reproduce. */
export function structuralDiff(live, ref) {
  const liveKeys = objectKeys(live.root), refKeys = resolveObjectKeys(ref.root), liveByKey = resolveObjectKeys(live.root);
  const extras = [], removed = [], materialPatches = [], objectPatches = [];
  for (const [o, key] of liveKeys) {
    const r = refKeys.get(key);
    if (!r) {
      if (o.parent === live.root || refKeys.has(liveKeys.get(o.parent))) extras.push({parent: o.parent === live.root ? null : liveKeys.get(o.parent), key, object: serializeExtra(o)});
      continue;
    }
    const props = Object.fromEntries(OBJECT_PROPS.filter(p => o[p] !== r[p]).map(p => [p, o[p]]));
    if (Object.keys(props).length) objectPatches.push({key, props});
    if (o.material) {
      const lm = [o.material].flat(), rm = [r.material].flat();
      lm.forEach((m, index) => {
        const q = rm[index];if (!q) throw new Error('Material count differs at ' + key);
        const props = {};
        for (const p of MATERIAL_PROPS) {
          if (m[p]?.isColor) {if (!m[p].equals(q[p])) props[p] = m[p].getHex();}
          else if (m[p] !== q[p]) props[p] = m[p];
        }
        if (m.type !== q.type) throw new Error('Material type differs at ' + key);
        if (m.clippingPlanes?.length || q.clippingPlanes?.length) {
          const planes = x => JSON.stringify((x.clippingPlanes ?? []).map(pl => [...pl.normal.toArray(), pl.constant]));
          if (planes(m) !== planes(q)) throw new Error('Clipping planes differ at ' + key + '; bake this section state explicitly');
        }
        if (Object.keys(props).length) materialPatches.push({key, index, props});
      });
    }
  }
  const refObjectKeys = objectKeys(ref.root);
  for (const [key, r] of refKeys) {
    if (!liveByKey.has(key) && (r.parent === ref.root || liveByKey.has(refObjectKeys.get(r.parent)))) removed.push(key);
  }
  return {extras, removed, materialPatches, objectPatches};
}

export function rootUserData(live) {
  const u = live.root.userData, out = {};
  for (const key of ROOT_USER_DATA_KEYS) if (u[key] !== undefined) out[key] = encodeUserValue(u[key]);
  return out;
}

/** Compare baked playback with the live model at recorded samples (pixels). */
export function roundTripError(live, baked, times) {
  const liveKeys = resolveObjectKeys(live.root), bakedKeys = resolveObjectKeys(baked.root);
  let error = 0, compared = 0, worst = null;const corner = new THREE.Vector3(), other = new THREE.Vector3();
  for (const [liveTime, bakedTime] of times) {
    live.update(liveTime);baked.update(bakedTime);
    for (const [key, o] of liveKeys) {
      if (!o.geometry || !o.visible) continue;
      const b = bakedKeys.get(key);
      if (!b) throw new Error('Baked model lacks ' + key);
      const lp = o.geometry.attributes.position, bp = b.geometry.attributes.position;
      if (!lp) continue;
      if (lp.count !== bp.count) throw new Error(`Vertex count differs at ${key}: live ${lp.count}, baked ${bp.count}`);
      if (b.visible !== o.visible) throw new Error('Visibility differs at ' + key);
      // Sample up to 64 vertices of each part in world space.
      const stride = Math.max(1, Math.floor(lp.count / 64));
      for (let k = 0; k < lp.count; k += stride) {
        corner.fromBufferAttribute(lp, k).applyMatrix4(o.matrixWorld);other.fromBufferAttribute(bp, k).applyMatrix4(b.matrixWorld);
        const d = corner.distanceTo(other);
        if (d > error) {error = d;worst = {key, liveTime, bakedTime};}
      }
      compared++;
    }
  }
  return {pixels: error / PIXEL, compared, worst};
}

/**
 * Continuity of baked playback across its own seam: the per-sample step and
 * the second difference (sudden change of speed) there, against the largest
 * of each anywhere inside the loop. Pixels.
 */
export function seamContinuity(baked, duration, samples) {
  const dt = duration / samples, meshes = [];
  baked.root.traverse(o => {if (o.isMesh && o.geometry.attributes.position) meshes.push(o);});
  const snapshot = time => {
    baked.update(time);const out = [];const v = new THREE.Vector3();
    for (const m of meshes) {const p = m.geometry.attributes.position, stride = Math.max(1, Math.floor(p.count / 32));for (let k = 0; k < p.count; k += stride) out.push(v.fromBufferAttribute(p, k).applyMatrix4(m.matrixWorld).toArray());}
    return out;
  };
  const step = (a, b) => Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1], p[2] - b[i][2])));
  const second = (a, b, c) => Math.max(...a.map((p, i) => Math.hypot(p[0] - 2 * b[i][0] + c[i][0], p[1] - 2 * b[i][1] + c[i][1], p[2] - 2 * b[i][2] + c[i][2])));
  let interiorStep = 0, interiorSecond = 0, previous = snapshot(0), before = null;
  for (let s = 1; s <= samples; s++) {
    const current = snapshot(s * dt);
    interiorStep = Math.max(interiorStep, step(previous, current));
    if (before) interiorSecond = Math.max(interiorSecond, second(before, previous, current));
    before = previous;previous = current;
  }
  const around = [-2, -1, 0, 1, 2].map(j => snapshot(duration + j * dt));
  const seamStep = Math.max(...[0, 1, 2, 3].map(j => step(around[j], around[j + 1])));
  const seamSecond = Math.max(...[0, 1, 2].map(j => second(around[j], around[j + 1], around[j + 2])));
  return {seamStepPixels: seamStep / PIXEL, interiorStepPixels: interiorStep / PIXEL, seamSecondPixels: seamSecond / PIXEL, interiorSecondPixels: interiorSecond / PIXEL};
}

export {disposeObject3D};
