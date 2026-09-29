import * as THREE from 'three';

const FULL_TURN = Math.PI * 2;

// Shared fine V-thread solid (moved from authored-cramp-drills.js in pass 104,
// where it was written for 379/380 in pass 96; 190 uses it too).
// Pass 96: Brown hatches both feed screws as fine V-threads. The screw is one
// closed solid of one material: a helical grid whose rows follow the thread,
// so the crest and root run exactly along rows (no stair-stepped crest), with
// analytic normals that break sharply at the crest, flank and root edges.
// A side is either a V-thread {root, crest} or a plain cylinder {radius};
// `inner` null closes the solid to the axis. Points are
// (r cos phi, y, r sin phi) with y = phase + u - lead * phi / 2pi: a
// right-hand helix about +Y, whose front crests rise to the right as Brown
// hatches them on both plates. Turned by Three's rotation.y = angle inside a
// fixed nut, it advances +lead * angle / 2pi.
// The V has a flat crest and root, each 1/8 of the lead, and 3/8 flanks;
// the profile is linear between its four breaks, so rows sit only there.
const V_THREAD_BREAKS = [0, 2 / 16, 8 / 16, 10 / 16];
const vThreadDepthFraction = (u) => {
  const s = ((u % 1) + 1) % 1;
  if (s <= 2 / 16) return 1;
  if (s <= 8 / 16) return 1 - (s - 2 / 16) / (6 / 16);
  if (s <= 10 / 16) return 0;
  return (s - 10 / 16) / (6 / 16);
};

export function threadedTubeGeometry({ low, high, lead, phase = 0, outer, inner = null, segments = 96, starts = 1 }) {
  const c = -lead / FULL_TURN;
  // A multi-start thread keeps the lead (the helix slope) but repeats the V
  // profile every lead / starts, so the visible pitch is finer.
  const pitch = lead / starts;
  const positions = [];
  const normals = [];
  const side = (spec) => spec.radius !== undefined
    ? { r: () => spec.radius, slope: () => 0 }
    : {
      r: (u) => spec.root + (spec.crest - spec.root) * vThreadDepthFraction((u - phase) / pitch),
      // Band slope dr/du between rows i and i+1 (the profile is linear there).
      slope: (u0, u1) => (spec.crest - spec.root)
        * (vThreadDepthFraction((u1 - phase) / pitch - 1e-9) - vThreadDepthFraction((u0 - phase) / pitch + 1e-9))
        / (u1 - u0),
    };
  const push = (p, n) => {
    const a = new THREE.Vector3(...p[0]);
    const cross = new THREE.Vector3(...p[1]).sub(a).cross(new THREE.Vector3(...p[2]).sub(a));
    if (cross.lengthSq() < 1e-16) return;
    const mean = new THREE.Vector3(...n[0]).add(new THREE.Vector3(...n[1])).add(new THREE.Vector3(...n[2]));
    if (cross.dot(mean) < 0) { [p[1], p[2]] = [p[2], p[1]]; [n[1], n[2]] = [n[2], n[1]]; }
    positions.push(...p.flat());
    normals.push(...n.flat());
  };
  const cosOf = (j) => (j % segments === 0 ? 1 : Math.cos(FULL_TURN * j / segments));
  const sinOf = (j) => (j % segments === 0 ? 0 : Math.sin(FULL_TURN * j / segments));
  // Rows u_i cover [low, high + lead] so every column spans [low, high];
  // a row outside that range clamps to the end plane (zero-area there).
  const uStart = Math.floor((low - phase) / pitch) * pitch + phase;
  const turns = Math.ceil((high + lead - uStart) / pitch - 1e-9);
  const rows = [];
  for (let turn = 0; turn < turns; turn += 1) {
    for (const fraction of V_THREAD_BREAKS) rows.push(uStart + (turn + fraction) * pitch);
  }
  rows.push(uStart + turns * pitch);
  const surface = (spec, sign) => {
    const s = side(spec);
    // A plain cylinder needs no helical rows: one quad per column.
    const bands = spec.radius !== undefined
      ? [[low, high + lead]]
      : rows.slice(0, -1).map((u, i) => [u, rows[i + 1]]);
    for (let j = 0; j < segments; j += 1) {
      for (const [u0, u1] of bands) {
        const slope = s.slope(u0, u1);
        const vertex = (jj, u) => {
          const phi = FULL_TURN * jj / segments;
          const y = THREE.MathUtils.clamp(u + c * phi, low, high);
          const uu = y - c * phi;
          const r = s.r(uu);
          const cs = cosOf(jj);
          const sn = sinOf(jj);
          const n = new THREE.Vector3(r * cs - c * slope * sn, -r * slope, c * slope * cs + r * sn)
            .normalize().multiplyScalar(sign);
          return [[r * cs, y, r * sn], n.toArray()];
        };
        const a = vertex(j, u0);
        const b = vertex(j + 1, u0);
        const d = vertex(j, u1);
        const e = vertex(j + 1, u1);
        push([a[0], b[0], e[0]], [a[1], b[1], e[1]]);
        push([a[0], e[0], d[0]], [a[1], e[1], d[1]]);
      }
    }
  };
  surface(outer, 1);
  if (inner) surface(inner, -1);
  const so = side(outer);
  const si = inner ? side(inner) : null;
  for (const [y, sign] of [[low, -1], [high, 1]]) {
    const n = [0, sign, 0];
    for (let j = 0; j < segments; j += 1) {
      const ring = (jj, s) => {
        if (!s) return [0, y, 0];
        const r = s.r(y - c * FULL_TURN * jj / segments);
        return [r * cosOf(jj), y, r * sinOf(jj)];
      };
      const o0 = ring(j, so);
      const o1 = ring(j + 1, so);
      const i0 = ring(j, si);
      const i1 = ring(j + 1, si);
      push([i0, o0, o1], [n, n, n]);
      push([i0, o1, i1], [n, n, n]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.vThread = { low, high, lead, phase, outer, inner, starts };
  return geometry;
}
