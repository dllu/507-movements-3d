import * as THREE from 'three';
import {surfaceBuilder} from './stock.js';

const tau = 2 * Math.PI;
const mod = a => {
  const r = ((a % tau) + tau) % tau;
  return r < 1e-12 || tau - r < 1e-12 ? 0 : r;
};
const unit = (x, y, z) => {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
};
const packet = mesh => ({
  positions: Float32Array.from(mesh.positions),
  normals: Float32Array.from(mesh.normals),
});

// One closed boundary for the core, ridge and remaining blank. The groove
// occupies material angles greater than the cutter's furthest reached angle.
// No buried thread flanks or coincident internal faces reach the renderer.
export function makeCutWorkpiece(p, angles) {
  if (!(p.lead > 0 && p.width > 0 && p.width < tau * p.lead)) {
    throw new RangeError('The cut groove requires a positive lead and distinct turns');
  }
  const pitch = tau * p.lead;
  const firstTurn = Math.floor((p.low - p.width / 2 - p.phase) / pitch) - 1;
  const lastTurn = Math.ceil((p.high + p.width / 2 - p.phase) / pitch) + 1;
  const clip = z => Math.max(p.low, Math.min(p.high, z));
  const caches = angles.slice(0, -1).map(() => new Map());

  function sector(a, b, cutTurn) {
    const mesh = surfaceBuilder();
    const ca = Math.cos(mod(a)), sa = Math.sin(mod(a));
    const cb = Math.cos(mod(b)), sb = Math.sin(mod(b));
    const pa = (r, z) => [r * ca, r * sa, z];
    const pb = (r, z) => [r * cb, r * sb, z];
    const wall = (radius, lowA, lowB, highA, highB) => {
      mesh.quad([pa(radius, lowA), pb(radius, lowB), pb(radius, highB), pa(radius, highA)],
        [[ca, sa, 0], [cb, sb, 0], [cb, sb, 0], [ca, sa, 0]]);
    };
    let previousA = p.low, previousB = p.low, openLow = false, openHigh = false;
    for (let turn = firstTurn; turn <= lastTurn; turn++) {
      const centerA = p.phase + p.lead * (a + tau * turn);
      const centerB = p.phase + p.lead * (b + tau * turn);
      const center = (centerA + centerB) / 2;
      if (center + p.width / 2 <= p.low || center - p.width / 2 >= p.high) continue;
      const lowA = clip(centerA - p.width / 2), lowB = clip(centerB - p.width / 2);
      const highA = clip(centerA + p.width / 2), highB = clip(centerB + p.width / 2);
      wall(p.outer, previousA, previousB, lowA, lowB);
      const cut = turn >= cutTurn;
      wall(cut ? p.inner : p.outer, lowA, lowB, highA, highB);
      if (cut) {
        openLow ||= center - p.width / 2 < p.low;
        openHigh ||= center + p.width / 2 > p.high;
        // Flanks face into the removed groove. An opening at an axial end
        // has no flank; its exposed end cap ends at the core radius instead.
        for (const [sign, za, zb] of [[1, lowA, lowB], [-1, highA, highB]]) {
          if (sign > 0 ? center - p.width / 2 <= p.low : center + p.width / 2 >= p.high) continue;
          const na = r => unit(sign * p.lead * sa, -sign * p.lead * ca, sign * r);
          const nb = r => unit(sign * p.lead * sb, -sign * p.lead * cb, sign * r);
          mesh.quad([pa(p.inner, za), pa(p.outer, za), pb(p.outer, zb), pb(p.inner, zb)],
            [na(p.inner), na(p.outer), nb(p.outer), nb(p.inner)]);
        }
      }
      previousA = highA;
      previousB = highB;
    }
    wall(p.outer, previousA, previousB, p.high, p.high);
    for (const [z, sign, open] of [[p.low, -1, openLow], [p.high, 1, openHigh]]) {
      const normal = Array(4).fill([0, 0, sign]);
      mesh.quad([[0, 0, z], pa(p.inner, z), pb(p.inner, z), [0, 0, z]], normal);
      if (!open) mesh.quad([pa(p.inner, z), pa(p.outer, z), pb(p.outer, z), pb(p.inner, z)], normal);
    }
    return packet(mesh);
  }

  function cuttingFace(cutAngle) {
    const mesh = surfaceBuilder(), a = mod(cutAngle), c = Math.cos(a), s = Math.sin(a);
    const low = clip(p.phase + p.lead * cutAngle - p.width / 2);
    const high = clip(p.phase + p.lead * cutAngle + p.width / 2);
    const point = (r, z) => [r * c, r * s, z];
    mesh.quad([point(p.inner, low), point(p.outer, low), point(p.outer, high), point(p.inner, high)],
      Array(4).fill([-s, c, 0]));
    return packet(mesh);
  }

  return {geometry(cutAngle) {
    const phase = Number.isFinite(cutAngle) ? mod(cutAngle) : -1;
    const packets = [], grid = [];
    const cutTurn = (a, b) => Math.max(firstTurn, Math.min(lastTurn + 1,
      Math.ceil((cutAngle - (a + b) / 2) / tau)));
    for (let i = 0; i + 1 < angles.length; i++) {
      const a = angles[i], b = angles[i + 1];
      grid.push(a);
      if (phase > a + 1e-10 && phase < b - 1e-10) {
        // Splitting this complete axial sector keeps every adjoining edge
        // conforming, including the lands, groove floor and end caps.
        packets.push(sector(a, phase, cutTurn(a, phase)), sector(phase, b, cutTurn(phase, b)));
        grid.push(phase);
      } else {
        const key = cutTurn(a, b), cache = caches[i];
        if (!cache.has(key)) cache.set(key, sector(a, b, key));
        packets.push(cache.get(key));
      }
    }
    grid.push(tau);
    if (phase >= 0) packets.push(cuttingFace(cutAngle));
    const count = packets.reduce((sum, p) => sum + p.positions.length, 0);
    const positions = new Float32Array(count), normals = new Float32Array(count);
    let offset = 0;
    for (const p of packets) {
      positions.set(p.positions, offset);
      normals.set(p.normals, offset);
      offset += p.positions.length;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.angles = grid;
    geometry.userData.cutAngle = cutAngle;
    return geometry;
  }};
}
