import * as THREE from 'three';
import {disposeObject3D} from '../dispose-model.js';
import {decodeArray, decodeUserValue, resolveObjectKeys} from './mujoco-bake-format.js';
import {loadBakedBundle} from './playback.js';
import {bakedMujocoRoutes} from './mujoco-baked-routes.js';

// Seamless playback of a baked MuJoCo loop (see scripts/bake-mujoco-movement.mjs
// and docs/p60-bake-tool-review.md). The visible parts are built by the
// movement's own current geometry code; the bundle supplies only what the live
// simulation changes: recorded part transforms, deforming vertex data (cords,
// springs), visibility, the few parts and colours the live factory adds, and
// the live model's presentation settings. The recorded interval is a closed
// loop, so playback repeats forever without a restart. A part that turns on
// by a fixed angle per loop (a ratchet wheel) carries that turn forward.

const wrapQuaternion = new THREE.Quaternion();

function makeTransformTrack(object, track, samples) {
  const decode = value => (Array.isArray(value) ? Float32Array.from(value) : decodeArray(value));
  const position = decode(track.position), quaternion = decode(track.quaternion);
  const animatedPosition = position.length > 3, animatedQuaternion = quaternion.length > 4;
  if (animatedPosition && position.length !== 3 * (samples + 1)) throw new RangeError('Corrupt baked position track ' + track.key);
  if (animatedQuaternion && quaternion.length !== 4 * (samples + 1)) throw new RangeError('Corrupt baked rotation track ' + track.key);
  const wrap = track.wrap && {axis: new THREE.Vector3(...track.wrap.axis).normalize(), angle: track.wrap.angle};
  const a = new THREE.Quaternion(), b = new THREE.Quaternion();
  const apply = (i, t, loops) => {
    if (animatedPosition) {
      const j = 3 * i;
      object.position.set(position[j] + t * (position[j + 3] - position[j]), position[j + 1] + t * (position[j + 4] - position[j + 1]),
        position[j + 2] + t * (position[j + 5] - position[j + 2]));
    } else object.position.set(position[0], position[1], position[2]);
    if (animatedQuaternion) {
      a.fromArray(quaternion, 4 * i); b.fromArray(quaternion, 4 * i + 4);
      object.quaternion.slerpQuaternions(a, b, t);
    } else object.quaternion.fromArray(quaternion, 0);
    if (wrap && loops) {
      // Whole loops of a steadily turning part: turn it about its own spin axis.
      wrapQuaternion.setFromAxisAngle(wrap.axis, (wrap.angle * loops) % (2 * Math.PI));
      object.quaternion.multiply(wrapQuaternion);
    }
    if (track.scale) object.scale.fromArray(track.scale);
  };
  return {animated: animatedPosition || animatedQuaternion || Boolean(wrap), apply};
}

// Recorded vertex frames: a mean plus basis with per-frame coefficients
// ('principal'), or quantized frames. fill() interpolates between samples.
function frameSource(stored, length) {
  if (stored.encoding === 'principal') {
    const mean = decodeArray(stored.mean), basis = decodeArray(stored.basis), coefficients = decodeArray(stored.coefficients), k = stored.components;
    if (mean.length !== length || basis.length !== k * length || coefficients.length !== stored.frames * k) throw new RangeError('Corrupt baked vertex basis');
    const c = new Float32Array(k);
    return {frames: stored.frames, fill(out, f0, f1, t) {
      for (let j = 0; j < k; j++) c[j] = coefficients[f0 * k + j] + t * (coefficients[f1 * k + j] - coefficients[f0 * k + j]);
      out.set(mean);
      for (let j = 0; j < k; j++) {const w = c[j], o = j * length;if (w) for (let d = 0; d < length; d++) out[d] += w * basis[o + d];}
    }};
  }
  const data = decodeArray(stored.data), {min, scale} = stored;
  if (data.length !== stored.frames * length) throw new RangeError('Corrupt baked vertex frames');
  return {frames: stored.frames, fill(out, f0, f1, t) {
    const o0 = f0 * length, o1 = f1 * length;
    for (let d = 0; d < length; d++) {const c = d % 3, v0 = data[o0 + d], v1 = data[o1 + d];out[d] = min[c] + (v0 + t * (v1 - v0)) * scale[c];}
  }};
}

function makeVertexTrack(mesh, track, samples) {
  const count = track.count, positions = frameSource(track.positions, count * 3), normals = track.normals && frameSource(track.normals, count * 3);
  const frames = positions.frames;
  if (frames !== 1 && frames !== samples + 1) throw new RangeError('Corrupt baked vertex frame count ' + track.key);
  // Replace the mesh's buffers with the recorded topology.
  const geometry = new THREE.BufferGeometry(), position = new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3);
  position.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position', position);
  let normal;
  if (normals) {normal = new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3);normal.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('normal', normal);}
  if (track.index) geometry.setIndex(new THREE.BufferAttribute(decodeArray(track.index), 1));
  else if (track.reuseIndex) geometry.setIndex(mesh.geometry.index);
  if (track.groups) for (const g of track.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  mesh.geometry.dispose();mesh.geometry = geometry;
  // The engine fits bounds from actual vertices; skip per-frame culling bounds.
  mesh.frustumCulled = false;
  const drawRange = track.drawRange && decodeArray(track.drawRange);
  const apply = (i, t) => {
    const f0 = frames === 1 ? 0 : i, f1 = frames === 1 ? 0 : i + 1;
    positions.fill(position.array, f0, f1, t);position.needsUpdate = true;
    if (normal) {normals.fill(normal.array, f0, f1, t);normal.needsUpdate = true;}
    if (drawRange) geometry.setDrawRange(0, drawRange[frames === 1 ? 0 : (t < .5 ? f0 : f1)]);
  };
  return {animated: frames > 1, apply};
}

function makeVisibilityTrack(object, track) {
  const runs = track.runs;
  return {animated: runs.length > 1, apply: i => {
    let lo = 0, hi = runs.length - 1;
    while (lo < hi) {const mid = (lo + hi + 1) >> 1;if (runs[mid][0] <= i) lo = mid;else hi = mid - 1;}
    object.visible = Boolean(runs[lo][1]);
  }};
}

/**
 * Apply a baked bundle to a freshly built geometry-only visual (the
 * movement's current geometry code), returning a movement model.
 */
export function makeBakedMujocoModel(bundle, visual, {sync} = {}) {
  if (bundle.format !== 'mujoco-loop' || bundle.version !== 1) throw new Error('Unsupported baked MuJoCo bundle');
  const root = visual.root, u = root.userData, loader = new THREE.ObjectLoader();
  let byKey = resolveObjectKeys(root);
  const find = key => {
    const object = byKey.get(key);
    if (!object) throw new Error(`Baked movement ${bundle.id}: no part at ${key}; rebake after changing moving parts`);
    return object;
  };
  for (const object of (bundle.removed ?? []).map(find)) object.removeFromParent();
  for (const extra of bundle.extras ?? []) (extra.parent === null ? root : find(extra.parent)).add(loader.parse(extra.object));
  byKey = resolveObjectKeys(root);
  for (const patch of bundle.materialPatches ?? []) {
    const mesh = find(patch.key), material = [mesh.material].flat()[patch.index ?? 0];
    for (const [name, value] of Object.entries(patch.props)) {
      if (material[name]?.isColor) material[name].setHex(value);
      else material[name] = value;
    }
    material.needsUpdate = true;
  }
  for (const patch of bundle.objectPatches ?? []) Object.assign(find(patch.key), patch.props);
  for (const [name, value] of Object.entries(bundle.rootUserData ?? {})) u[name] = decodeUserValue(value);
  let disposed = false, variant, tracks;
  // Each configuration may record only the parts it moves (104's worm input
  // records the worm and wheel, its wheel input the wheel and carriage). Keep
  // every recorded part's built pose and visibility so switching configuration
  // restores the parts the new one does not record, instead of leaving them
  // wherever the previous configuration stopped.
  const initialPoses = new Map();
  for (const other of Object.values(bundle.variants)) {
    for (const t of [...other.transforms, ...(other.visibility ?? [])]) {
      const object = find(t.key);
      if (!initialPoses.has(object)) initialPoses.set(object, {position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), visible: object.visible});
    }
  }
  const activate = name => {
    variant = bundle.variants[name];
    if (!variant) throw new RangeError('Unknown baked configuration ' + name);
    const samples = variant.loop.samples;
    for (const [object, pose] of initialPoses) {
      object.position.copy(pose.position);object.quaternion.copy(pose.quaternion);object.scale.copy(pose.scale);object.visible = pose.visible;
    }
    tracks = [
      ...variant.transforms.map(t => makeTransformTrack(find(t.key), t, samples)),
      ...(variant.vertices ?? []).map(t => makeVertexTrack(find(t.key), t, samples)),
      ...(variant.visibility ?? []).map(t => makeVisibilityTrack(find(t.key), t)),
    ];
    for (const track of tracks) track.apply(0, 0, 0);
    variant.qposValues = variant.qpos && decodeArray(variant.qpos.data);
    // Recorded cord centrelines (see record's curves), rebuilt by the route's sync.
    variant.curveValues = (variant.curves ?? []).map(c => ({key: c.key, width: c.width, source: frameSource(c.points, c.width), buffer: new Float32Array(c.width)}));
    if (variant.curveValues.some(c => c.source.frames !== samples + 1)) throw new RangeError('Corrupt baked curve track');
    u.configuration = name;
  };
  const update = time => {
    if (disposed) throw new Error('Movement has been disposed');
    if (!Number.isFinite(time) || time < 0) throw new RangeError('Invalid playback time');
    const {duration, samples} = variant.loop;
    const loops = Math.floor(time / duration), phase = (time - loops * duration) / duration * samples;
    const i = Math.min(samples - 1, Math.floor(phase)), t = Math.min(1, phase - i);
    for (const track of tracks) if (track.animated) track.apply(i, t, loops);
    root.updateMatrixWorld(true);
    let qpos;
    if (variant.qposValues) {
      const w = variant.qpos.width, q0 = variant.qposValues.subarray(i * w, i * w + w), q1 = variant.qposValues.subarray(i * w + w, i * w + 2 * w);
      qpos = Array.from(q0, (v, k) => v + t * (q1[k] - v));
    }
    u.state = {time, loopPhase: (i + t) / samples, loops, qpos};
    let curves;
    if (variant.curveValues.length) {
      curves = {};
      for (const {key, width, source, buffer} of variant.curveValues) {
        source.fill(buffer, i, i + 1, t);
        const points = [];
        for (let k = 0; k < width; k += 3) points.push([buffer[k], buffer[k + 1], buffer[k + 2]]);
        curves[key] = points;
      }
    }
    // Movement-specific presentation the live sync also refreshes from qpos
    // (102's section cap follows the nut) or from recorded cord centrelines.
    if (sync && (qpos || curves)) {sync(u, qpos, curves);if (curves) root.updateMatrixWorld(true);}
    return u.state;
  };
  activate(bundle.defaultVariant);
  const configurations = Object.keys(bundle.variants);
  Object.assign(u, {
    simulationBackend: 'baked-mujoco', bakedLoop: true,
    // The loop never ends, so no restart is offered.
    supportsRestart: false,
    bakedProvenance: {id: bundle.id, generator: bundle.generator, variants: Object.fromEntries(configurations.map(n => [n, bundle.variants[n].loop]))},
    animationTiming: {authoredCyclePeriod: variant.loop.duration, displayCycleDuration: variant.loop.duration, playbackTimeScale: bundle.playbackTimeScale ?? 1},
  });
  if (configurations.length > 1) u.setConfiguration = name => {activate(name);update(0);};
  update(0);
  const focus = bundle.focus ? new THREE.Vector3(...bundle.focus) : visual.focus;
  const cameraDirection = bundle.cameraDirection ? new THREE.Vector3(...bundle.cameraDirection) : visual.cameraDirection;
  return {
    root, focus, cameraDirection, update, reset: () => update(0),
    dispose: () => {if (disposed) return;disposed = true;disposeObject3D(root);},
  };
}

/** Load a baked loop and the movement's current geometry in parallel. */
export async function loadBakedMujocoMovement(id) {
  const route = bakedMujocoRoutes[id];
  if (!route) throw new RangeError('No baked MuJoCo loop for movement ' + id);
  const [bundle, visual] = await Promise.all([loadBakedBundle(route.asset()), route.geometry()]);
  try {
    return makeBakedMujocoModel(bundle, visual, route);
  } catch (error) {
    disposeObject3D(visual.root);
    throw error;
  }
}
