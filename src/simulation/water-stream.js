import * as THREE from 'three';
import { PALETTE } from './primitives.js';

// Cheap, continuous moving water: one swept mesh per stream plus an optional
// small instanced spray. Replaces bundles of streamline tubes, droplet beads
// and separately jointed jet segments. A true fluid simulation (see
// demos/fluid-463) was far too slow for weak devices and not more convincing.
//
// API (all sizes in the caller's scene units):
//
//   Paths — arrays of samples built once, allocation only at build time:
//     ballisticPath({origin, velocity, gravity?, duration?, endY?, stop?, samples?})
//         Projectile path p(t) = origin + velocity t + g t^2 / 2. Ends at
//         `duration`, where y falls to `endY`, or where `stop(point)` first
//         returns true (bisected). Each sample carries its speed |v(t)| and
//         time of flight t.
//     guidedPath(curve | points, {speed? | speedAt?(u), samples?})
//         Water led along a channel or guide (a THREE.Curve or point list),
//         sampled by arc length, at a constant or prescribed speed.
//     joinPaths(...paths)
//         One path from consecutive pieces (e.g. a flume floor then its
//         ballistic fall); times continue, a shared joint point is dropped.
//     solveBallisticSpeed({origin, direction, target, gravity?})
//         Launch speed along `direction` whose parabola passes through
//         `target` (target must lie in the vertical plane of `direction`).
//
//   WaterStream(path, options) — a THREE.Mesh, one continuous swept body:
//     width, thickness     half-width / half-thickness at the first sample
//                          at unit flow (a round jet: equal; a sheet: wider)
//     widthAxis            Vector3 (or (i, point) => Vector3) giving the
//                          across direction, projected normal to the path;
//                          'horizontal' = level and square to the path (a
//                          sheet lying in a channel or passage)
//     widthExponent        continuity split: the section area goes as
//                          flow * v0 / v; width takes the power a of that
//                          factor and thickness 1 - a (0 = sheet thins,
//                          0.5 = round jet contracts evenly)
//     flow                 relative flow rate (setFlow(q) rebuilds in place)
//     spread               {start, width, thickness}: past fraction `start`
//                          the section flares (a sheet breaking up)
//     fadeIn, fadeOut      path fractions over which alpha ramps
//     foam                 {start, amount}: whitening toward the end (strike)
//     radialSegments       section vertices (default 12)
//     section              optional (i, u, [a, b]) => [a, b]: final say on
//                          the half-width / half-thickness at sample i (a
//                          curtain bounded by a wheel rim, say); opt-in
//     cyclePeriod          playback loop period: the texture scroll rate is
//                          rounded so the flow detail loops seamlessly
//     streakRate           texture tiles per second of flight (default 2)
//     color, opacity       tint and base opacity (opacity < 0.6 keeps the
//                          body classed as fluid by the solid screens)
//     stream.update(time)  scrolls the flow texture; no geometry work
//     stream.setFlow(q)    recomputes the swept section, reusing buffers
//     stream.setPath(path) new path with the same sample count, in place
//
//   WaterSpray(options) — a capped THREE.InstancedMesh of droplets thrown
//     from `origin` with mean `velocity`, random `spread`, `count` (<= 64),
//     `lifetime`, `radius`, `gravity`, `cyclePeriod`, `originSpread` (a
//     vector: drops start anywhere along ±it); update(time) moves them
//     deterministically (seamless over the loop), no per-frame allocation.
//
//   waterStreamMaterial(options) — the shared look: translucent fluid blue,
//     fresnel brightening at grazing angles, procedural streak map and
//     matching normal detail scrolled along the flow. Consistent with
//     water-volume.js (same palette, depthWrite off, no fog).
//
// Flow is conveyed by the scrolling texture: its v coordinate is the time of
// flight, so streaks move at the local water speed and stretch as a falling
// jet accelerates. Geometry is written only on construction, setFlow and
// setPath, never per frame.

export const STREAM_GRAVITY = 9.81;

// Seeded PRNG so every build (and every review capture) is identical.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Procedural streak textures, built once per process from typed arrays (no
// canvas, so the same code runs offline). Streaks are long along v (the
// flow) and narrow across u.
let sharedTextures = null;
function streakTextures() {
  if (sharedTextures) return sharedTextures;
  const W = 64, H = 128;
  const random = mulberry32(507);
  const height = new Float32Array(W * H);
  // Each column is a sum of a few periodic bumps along v (whole numbers of
  // cycles so the tile wraps), with column-to-column phase variation.
  const columns = [];
  for (let x = 0; x < W; x += 1) {
    columns.push(Array.from({length: 3}, (_, k) => ({
      k: k + 1 + Math.floor(random() * 2),
      phase: random() * Math.PI * 2,
      amp: (0.5 + random() * 0.5) / (k + 1),
    })));
  }
  for (let x = 0; x < W; x += 1) {
    for (let y = 0; y < H; y += 1) {
      let h = 0;
      for (const c of columns[x]) h += c.amp * Math.sin(c.k * Math.PI * 2 * y / H + c.phase);
      height[y * W + x] = h;
    }
  }
  // Soften across u (wrapping) so streaks are a few texels wide.
  const soft = new Float32Array(W * H);
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const h = 0.25 * height[y * W + ((x + W - 1) % W)] + 0.5 * height[y * W + x]
        + 0.25 * height[y * W + ((x + 1) % W)];
      soft[y * W + x] = h;
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
  }
  const colorData = new Uint8Array(W * H * 4);
  const normalData = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const h = (soft[i] - min) / (max - min);
      // Brightness 0.78..1 with sparse bright glints; alpha 0.7..1.
      const glint = h > 0.86 ? (h - 0.86) / 0.14 : 0;
      const value = 0.86 + 0.14 * h;
      colorData[i * 4] = Math.round(255 * Math.min(1, value + 0.1 * glint));
      colorData[i * 4 + 1] = Math.round(255 * Math.min(1, value + 0.1 * glint));
      colorData[i * 4 + 2] = Math.round(255 * Math.min(1, value + 0.06 * glint));
      colorData[i * 4 + 3] = Math.round(255 * (0.72 + 0.28 * h));
      const dx = (soft[y * W + ((x + 1) % W)] - soft[y * W + ((x + W - 1) % W)]) / (max - min);
      const dy = (soft[((y + 1) % H) * W + x] - soft[((y + H - 1) % H) * W + x]) / (max - min);
      const n = new THREE.Vector3(-dx * 1.6, -dy * 0.4, 1).normalize();
      normalData[i * 4] = Math.round(127.5 + 127.5 * n.x);
      normalData[i * 4 + 1] = Math.round(127.5 + 127.5 * n.y);
      normalData[i * 4 + 2] = Math.round(127.5 + 127.5 * n.z);
      normalData[i * 4 + 3] = 255;
    }
  }
  const make = (data, colorSpace) => {
    const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    if (colorSpace) texture.colorSpace = colorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  sharedTextures = {map: make(colorData, THREE.SRGBColorSpace), normal: make(normalData, null)};
  return sharedTextures;
}

// The streaming-water look. Each stream owns its material (so it can scroll
// its own texture clones), but all share one shader program and one texture
// upload.
export function waterStreamMaterial({
  color = PALETTE.fluid,
  opacity = 0.5,
  normalScale = 0.3,
} = {}) {
  const base = streakTextures();
  const map = base.map.clone();
  const normalMap = base.normal.clone();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    map,
    normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    metalness: 0.02,
    roughness: 0.16,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.fog = false;
  material.userData.waterStream = true;
  material.userData.tint = new THREE.Color(color);
  // Fresnel: grazing views of the sheet read denser and paler, as real water
  // does, so a thin stream still reads as a body rather than a tinted slab.
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      {
        float facing = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 2.0);
        diffuseColor.a = min(1.0, diffuseColor.a * (0.8 + 0.9 * fresnel));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.96, 1.0), 0.3 * fresnel);
      }`,
    );
  };
  material.customProgramCacheKey = () => 'water-stream-v1';
  return material;
}

// ---------------------------------------------------------------- paths

function makePath(points, speeds, times) {
  return {points, speeds, times};
}

export function ballisticPath({
  origin,
  velocity,
  gravity = STREAM_GRAVITY,
  duration = null,
  endY = null,
  stop = null,
  samples = 40,
  maxDuration = 5,
}) {
  const at = (t, target = new THREE.Vector3()) => target.copy(origin)
    .addScaledVector(velocity, t).add(new THREE.Vector3(0, -0.5 * gravity * t * t, 0));
  const ends = (t) => {
    const p = at(t);
    if (endY != null && p.y <= endY) return true;
    return stop ? stop(p) : false;
  };
  let tEnd = duration;
  if (tEnd == null) {
    // March, then bisect the first crossing.
    const dt = maxDuration / 400;
    let t = dt;
    while (t < maxDuration && !ends(t)) t += dt;
    let lo = Math.max(0, t - dt), hi = Math.min(t, maxDuration);
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (ends(mid)) hi = mid; else lo = mid;
    }
    tEnd = (lo + hi) / 2;
  }
  const points = [], speeds = [], times = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = tEnd * i / samples;
    points.push(at(t));
    speeds.push(Math.hypot(velocity.x, velocity.y - gravity * t, velocity.z));
    times.push(t);
  }
  return makePath(points, speeds, times);
}

export function guidedPath(curveOrPoints, {speed = 1, speedAt = null, samples = 24} = {}) {
  const curve = Array.isArray(curveOrPoints)
    ? (curveOrPoints.length === 2
      ? new THREE.LineCurve3(curveOrPoints[0], curveOrPoints[1])
      : new THREE.CatmullRomCurve3(curveOrPoints, false, 'centripetal'))
    : curveOrPoints;
  const length = curve.getLength();
  const points = [], speeds = [], times = [];
  let time = 0;
  for (let i = 0; i <= samples; i += 1) {
    const u = i / samples;
    const v = speedAt ? speedAt(u) : speed;
    if (i > 0) {
      const previous = speeds[i - 1];
      time += (length / samples) * 2 / (previous + v);
    }
    points.push(curve.getPointAt(u));
    speeds.push(v);
    times.push(time);
  }
  return makePath(points, speeds, times);
}

export function joinPaths(...paths) {
  const points = [], speeds = [], times = [];
  let timeOffset = 0;
  for (const path of paths) {
    let start = 0;
    if (points.length && path.points[0].distanceTo(points.at(-1)) < 1e-6) start = 1;
    const shift = timeOffset - path.times[0];
    for (let i = start; i < path.points.length; i += 1) {
      points.push(path.points[i].clone());
      speeds.push(path.speeds[i]);
      times.push(path.times[i] + shift);
    }
    timeOffset = times.at(-1);
  }
  return makePath(points, speeds, times);
}

export function solveBallisticSpeed({origin, direction, target, gravity = STREAM_GRAVITY}) {
  const d = direction.clone().normalize();
  const horizontal = Math.hypot(d.x, d.z);
  const delta = target.clone().sub(origin);
  const reach = Math.hypot(delta.x, delta.z);
  // reach = s t h ; dy = s t d.y - g t^2 / 2  =>  t^2 = 2 (reach d.y / h - dy) / g
  const t2 = 2 * (reach * d.y / horizontal - delta.y) / gravity;
  if (!(t2 > 0) || horizontal < 1e-6) return null;
  return reach / (horizontal * Math.sqrt(t2));
}

// ---------------------------------------------------------------- stream

const scratch = {
  tangent: new THREE.Vector3(),
  across: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  point: new THREE.Vector3(),
  n: new THREE.Vector3(),
  color: new THREE.Color(),
  white: new THREE.Color(0xf2f8fb),
};

const smooth01 = (s) => {
  const x = Math.min(1, Math.max(0, s));
  return x * x * (3 - 2 * x);
};

export class WaterStream extends THREE.Mesh {
  constructor(path, {
    width = 0.1,
    thickness = width,
    widthAxis = new THREE.Vector3(0, 0, 1),
    widthExponent = 0.5,
    flow = 1,
    spread = null,
    fadeIn = 0,
    fadeOut = 0,
    foam = null,
    radialSegments = 12,
    cyclePeriod = null,
    streakRate = 2,
    streakAcross = 2,
    color = PALETTE.fluid,
    opacity = 0.5,
    material = null,
    minThickness = 0.006,
    section = null,
  } = {}) {
    const n = path.points.length;
    const ring = radialSegments + 1;
    const capVertices = 2 * (ring + 1);
    const count = n * ring + capVertices;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 4), 4));
    const indices = [];
    for (let i = 0; i < n - 1; i += 1) {
      for (let j = 0; j < radialSegments; j += 1) {
        const a = i * ring + j, b = a + ring;
        // Wound so the front face is the outside (matches the normals).
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    for (const [cap, sign] of [[0, -1], [1, 1]]) {
      const centre = n * ring + cap * (ring + 1);
      for (let j = 0; j < radialSegments; j += 1) {
        const a = centre + 1 + j;
        if (sign < 0) indices.push(centre, a + 1, a); else indices.push(centre, a, a + 1);
      }
    }
    geometry.setIndex(indices);
    super(geometry, material ?? waterStreamMaterial({color, opacity}));
    this.renderOrder = 2;
    this.userData.waterStream = true;
    this.options = {width, thickness, widthAxis, widthExponent, spread, fadeIn, fadeOut, foam,
      radialSegments, minThickness, streakAcross, section};
    this.flow = flow;
    this.path = path;
    const rate = cyclePeriod ? Math.max(1, Math.round(streakRate * cyclePeriod)) / cyclePeriod : streakRate;
    this.streakRate = rate;
    this.tint = new THREE.Color(color);
    this.#write();
  }

  // Moving water neither casts nor takes shadows (a translucent sheet's
  // shadow would read as a dark stain); fixed here so a later markShadows
  // pass over the model cannot switch them on.
  get castShadow() { return false; }
  set castShadow(value) {}
  get receiveShadow() { return false; }
  set receiveShadow(value) {}

  setFlow(flow) {
    if (flow === this.flow) return;
    this.flow = flow;
    this.#write();
  }

  setPath(path) {
    if (path.points.length !== this.path.points.length) throw new Error('WaterStream.setPath needs the same sample count');
    this.path = path;
    this.#write();
  }

  update(time) {
    const offset = -THREE.MathUtils.euclideanModulo(time * this.streakRate, 1);
    const material = this.material;
    if (material.map) material.map.offset.y = offset;
    if (material.normalMap) material.normalMap.offset.y = offset;
  }

  // Section half-extents at sample i for the current flow.
  sectionAt(i) {
    const {width, thickness, widthExponent, spread, minThickness} = this.options;
    const {speeds} = this.path;
    const factor = Math.max(1e-6, this.flow) * speeds[0] / Math.max(1e-6, speeds[i]);
    let a = width * factor ** widthExponent;
    let b = Math.max(minThickness, thickness * factor ** (1 - widthExponent));
    if (spread) {
      const u = i / (speeds.length - 1);
      const s = spread.start >= 1 ? 0 : smooth01((u - spread.start) / (1 - spread.start));
      a *= 1 + ((spread.width ?? 1) - 1) * s;
      b *= 1 + ((spread.thickness ?? 1) - 1) * s;
    }
    if (this.options.section) return this.options.section(i, i / (speeds.length - 1), [a, b]);
    return [a, b];
  }

  #write() {
    const {radialSegments, widthAxis, fadeIn, fadeOut, foam, streakAcross} = this.options;
    const {points, times} = this.path;
    const n = points.length;
    const ring = radialSegments + 1;
    const g = this.geometry;
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    const UV = g.attributes.uv.array, C = g.attributes.color.array;
    const {tangent, across, normal, point, n: nn, color, white} = scratch;
    const tint = this.tint;
    const rate = this.streakRate;
    const writeRing = (i, target, capSign) => {
      const u = i / (n - 1);
      const p = points[i];
      if (i === 0) tangent.subVectors(points[1], points[0]);
      else if (i === n - 1) tangent.subVectors(points[i], points[i - 1]);
      else tangent.subVectors(points[i + 1], points[i - 1]);
      tangent.normalize();
      if (widthAxis === 'horizontal') {
        across.set(tangent.z, 0, -tangent.x);
      } else {
        const axis = typeof widthAxis === 'function' ? widthAxis(i, p) : widthAxis;
        across.copy(axis).addScaledVector(tangent, -axis.dot(tangent));
      }
      if (across.lengthSq() < 1e-10) across.set(0, 1, 0).addScaledVector(tangent, -tangent.y);
      across.normalize();
      normal.crossVectors(tangent, across).normalize();
      const [a, b] = this.sectionAt(i);
      let alpha = 1;
      if (fadeIn > 0) alpha *= smooth01(u / fadeIn);
      if (fadeOut > 0) alpha *= smooth01((1 - u) / fadeOut);
      let whiten = 0;
      if (foam) whiten = (foam.amount ?? 0.6) * smooth01((u - foam.start) / Math.max(1e-6, 1 - foam.start));
      color.copy(tint).lerp(white, whiten);
      for (let j = 0; j <= radialSegments; j += 1) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const c = Math.cos(theta), s = Math.sin(theta);
        point.copy(p).addScaledVector(across, a * c).addScaledVector(normal, b * s);
        const k = target + j;
        P[k * 3] = point.x; P[k * 3 + 1] = point.y; P[k * 3 + 2] = point.z;
        if (capSign) nn.copy(tangent).multiplyScalar(capSign);
        else nn.copy(across).multiplyScalar(c * b).addScaledVector(normal, s * a).normalize();
        N[k * 3] = nn.x; N[k * 3 + 1] = nn.y; N[k * 3 + 2] = nn.z;
        UV[k * 2] = (j / radialSegments) * streakAcross;
        UV[k * 2 + 1] = times[i] * rate;
        C[k * 4] = color.r; C[k * 4 + 1] = color.g; C[k * 4 + 2] = color.b; C[k * 4 + 3] = alpha;
      }
      return alpha;
    };
    for (let i = 0; i < n; i += 1) writeRing(i, i * ring, 0);
    // End caps: a centre vertex and a copy of the end ring facing along the path.
    for (const [cap, i, sign] of [[0, 0, -1], [1, n - 1, 1]]) {
      const centre = n * ring + cap * (ring + 1);
      const alpha = writeRing(i, centre + 1, sign);
      const p = points[i];
      P[centre * 3] = p.x; P[centre * 3 + 1] = p.y; P[centre * 3 + 2] = p.z;
      N[centre * 3] = tangent.x * sign; N[centre * 3 + 1] = tangent.y * sign; N[centre * 3 + 2] = tangent.z * sign;
      UV[centre * 2] = 0; UV[centre * 2 + 1] = times[i] * rate;
      C[centre * 4] = color.r; C[centre * 4 + 1] = color.g; C[centre * 4 + 2] = color.b; C[centre * 4 + 3] = alpha;
    }
    for (const name of ['position', 'normal', 'uv', 'color']) g.attributes[name].needsUpdate = true;
    g.computeBoundingSphere();
    g.computeBoundingBox();
  }
}

// ---------------------------------------------------------------- spray

let sprayGeometry = null;
export class WaterSpray extends THREE.InstancedMesh {
  constructor({
    origin,
    velocity = new THREE.Vector3(0, 1, 0),
    spread = 0.6,
    gravity = STREAM_GRAVITY,
    count = 24,
    lifetime = 0.5,
    radius = 0.03,
    cyclePeriod = null,
    color = 0xe8f3f7,
    opacity = 0.55,
    seed = 1,
    originSpread = null,
  } = {}) {
    sprayGeometry ??= new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({
      color, metalness: 0, roughness: 0.3, transparent: true, opacity, depthWrite: false,
    });
    material.fog = false;
    const capped = Math.min(64, count);
    super(sprayGeometry, material, capped);
    this.renderOrder = 3;
    this.userData.waterSpray = true;
    this.frustumCulled = false;
    const random = mulberry32(seed * 7919 + 13);
    // Each droplet relaunches every `life` seconds; the life is rounded so a
    // whole number of relaunches fits the playback loop.
    const life = cyclePeriod ? cyclePeriod / Math.max(1, Math.round(cyclePeriod / lifetime)) : lifetime;
    this.life = life;
    this.origin = origin.clone();
    this.gravity = gravity;
    this.radius = radius;
    this.drops = Array.from({length: capped}, () => {
      const v = velocity.clone().add(new THREE.Vector3(
        (random() - 0.5) * 2 * spread, (random() - 0.5) * 2 * spread * 0.6, (random() - 0.5) * 2 * spread));
      const jitter = new THREE.Vector3((random() - 0.5) * radius * 4, 0, (random() - 0.5) * radius * 4);
      if (originSpread) jitter.addScaledVector(originSpread, (random() - 0.5) * 2);
      return {v, phase: random(), size: 0.6 + 0.8 * random(), jitter};
    });
    this.matrix4 = new THREE.Matrix4();
    this.update(0);
  }

  get castShadow() { return false; }
  set castShadow(value) {}
  get receiveShadow() { return false; }
  set receiveShadow(value) {}

  update(time) {
    const m = this.matrix4, e = m.elements;
    for (let i = 0; i < this.drops.length; i += 1) {
      const d = this.drops[i];
      const age = THREE.MathUtils.euclideanModulo(time / this.life + d.phase, 1);
      const t = age * this.life;
      const scale = this.radius * d.size * Math.sin(Math.PI * Math.min(1, age * 1.15));
      const x = this.origin.x + d.jitter.x + d.v.x * t;
      const y = this.origin.y + d.jitter.y + d.v.y * t - 0.5 * this.gravity * t * t;
      const z = this.origin.z + d.jitter.z + d.v.z * t;
      m.identity();
      e[0] = scale; e[5] = scale * 1.4; e[10] = scale;
      e[12] = x; e[13] = y; e[14] = z;
      this.setMatrixAt(i, m);
    }
    this.instanceMatrix.needsUpdate = true;
  }
}

// Convenience: update every stream and spray under `root`.
export function collectWaterStreams(root) {
  const items = [];
  root.traverse((object) => { if (object.userData.waterStream || object.userData.waterSpray) items.push(object); });
  return (time) => { for (const item of items) item.update(time); };
}
