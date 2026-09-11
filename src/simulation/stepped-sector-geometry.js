import * as THREE from 'three';
import { steppedSectorCut as savedCut } from '../data/contact-profiles.js';
import { rackGeneratedOutline } from './noncircular-gear-geometry.js';

const turn = 2 * Math.PI;
const cache = new Map();

/** The official 038 construction indexes output at 0, -pi/2, -11pi/6 and
 * -2pi after input fractions 0, 1/12, 3/4 and 1. Its speeds change abruptly.
 */
export function steppedSectorMotion(input) {
  let cycles = Math.floor(input / turn);
  let phase = input - cycles * turn;
  if (turn - phase < 1e-12) { cycles += 1; phase = 0; }
  if (phase < Math.PI / 6) return { output: cycles * turn + 3 * phase, ratio: 3, sector: 0 };
  if (phase < 3 * Math.PI / 2) return { output: cycles * turn + phase + Math.PI / 3, ratio: 1, sector: 1 };
  return { output: cycles * turn + phase / 3 + 4 * Math.PI / 3, ratio: 1 / 3, sector: 2 };
}

export function steppedSectorOutline(centerDistance, role) {
  const sectors = role === 'driver'
    ? [[0, Math.PI / 2, 5, 12], [Math.PI / 2, 11 * Math.PI / 6, 10, 24], [11 * Math.PI / 6, turn, 15, 36]]
    : [[0, 5 * Math.PI / 6, 10, 24], [5 * Math.PI / 6, Math.PI, 15, 36],
      [Math.PI, 3 * Math.PI / 2, 5, 12], [3 * Math.PI / 2, turn, 10, 24]];
  const points = [];
  for (const [start, end, radius, teeth] of sectors) {
    const cut = rackGeneratedOutline({
      pitchPoints: Array.from({ length: 720 }, (_, index) => {
        const angle = turn * index / 720;
        return new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(radius * centerDistance / 20);
      }), teeth, contactPointIndex: 0, toothAtContact: role === 'driven',
    });
    const first = Math.round(start / turn * cut.points.length);
    const last = Math.round(end / turn * cut.points.length);
    for (let index = first; index <= last; index += 1) points.push(cut.points[index % cut.points.length].clone());
  }
  return points;
}

function radiusQuery(points) {
  const angles = points.map((p) => THREE.MathUtils.euclideanModulo(Math.atan2(p.y, p.x), turn));
  angles[angles.length - 1] = turn;
  return (angle) => {
    let low = 0, high = points.length - 2;
    while (low < high) {
      const middle = Math.floor((low + high + 1) / 2);
      if (angles[middle] <= angle + 1e-12) low = middle;
      else high = middle - 1;
    }
    const a = points[low], b = points[low + 1];
    return (a.x * b.y - a.y * b.x)
      / (Math.cos(angle) * (b.y - a.y) - Math.sin(angle) * (b.x - a.x));
  };
}

/** Relieve the driven sector boundaries against the actual rotating driver.
 * Merely joining three involute arcs with radial lines causes tooth tips to
 * hit the radial faces around a change of ratio.
 */
export function steppedSectorCut(centerDistance, { regenerate = false } = {}) {
  const columns = 9216, poses = 9216, clearance = 0.0006;
  const profileKey = JSON.stringify({ centerDistance, columns, poses, clearance, version: 1 });
  if (!regenerate && cache.has(profileKey)) return cache.get(profileKey);
  const driver = steppedSectorOutline(centerDistance, 'driver');
  const blank = steppedSectorOutline(centerDistance, 'driven');
  const radiusAt = radiusQuery(blank);
  const rays = Array.from({ length: columns }, (_, index) => {
    const angle = turn * index / columns;
    return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  });
  if (!regenerate && savedCut?.key === profileKey) {
    const radii = savedCut.radii;
    const points = rays.map((ray, index) => ray.clone().multiplyScalar(radii[index]));
    const cut = { driver, points, radii, columns, poses, clearance, profileKey };
    cache.set(profileKey, cut);
    return cut;
  }
  const radii = rays.map((_, index) => radiusAt(turn * index / columns));
  const transformed = driver.map(() => new THREE.Vector2());
  for (let pose = 0; pose < poses; pose += 1) {
    const input = turn * pose / poses, output = steppedSectorMotion(input).output;
    const angle = input + output, cosine = Math.cos(angle), sine = Math.sin(angle);
    const ox = -centerDistance * Math.cos(output), oy = -centerDistance * Math.sin(output);
    for (const [index, p] of driver.entries()) {
      transformed[index].set(p.x * cosine - p.y * sine + ox, p.x * sine + p.y * cosine + oy);
    }
    for (let edge = 0; edge < transformed.length; edge += 1) {
      const a = transformed[edge], b = transformed[(edge + 1) % transformed.length];
      const ex = b.x - a.x, ey = b.y - a.y;
      const alpha = Math.atan2(a.y, a.x);
      const beta = alpha + THREE.MathUtils.euclideanModulo(Math.atan2(b.y, b.x) - alpha + Math.PI, turn) - Math.PI;
      const first = Math.ceil(Math.min(alpha, beta) / turn * columns - 1e-10);
      const last = Math.floor(Math.max(alpha, beta) / turn * columns + 1e-10);
      const cross = a.x * b.y - a.y * b.x;
      for (let sample = first; sample <= last; sample += 1) {
        const column = THREE.MathUtils.euclideanModulo(sample, columns);
        const ray = rays[column];
        const denominator = ray.x * ey - ray.y * ex;
        if (Math.abs(denominator) < 1e-12) continue;
        const radius = cross / denominator;
        if (radius > 0 && radius < radii[column]) radii[column] = radius - clearance;
      }
    }
  }
  const points = rays.map((ray, index) => ray.clone().multiplyScalar(radii[index]));
  const cut = { driver, points, radii, columns, poses, clearance, profileKey };
  cache.set(profileKey, cut);
  return cut;
}
