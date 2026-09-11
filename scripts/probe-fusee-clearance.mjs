import * as THREE from 'three';
import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const model = createMovementModel(catalog.movements[45]);
const { chain, fusee, springBox, spring } = model.root.userData.blocks;
const g = model.root.userData.geometry;
const motion = model.root.userData.motion;
const height = g.fuseeZTop - g.fuseeZBottom;
const groove = fusee.userData.body.geometry.userData;
const grooveAngle = 2 * Math.PI * g.grooveTurns;
const uTop = (g.fuseeZTop - groove.bodyTop) / height;
const uBottom = (g.fuseeZTop - groove.bodyBottom) / height;
const ceilingSlope = (groove.bottomRadius - groove.topRadius) / (uBottom - uTop);
const cloudFor = (geometry) => {
  const p = geometry.attributes.position, index = geometry.index;
  const points = [], keys = new Set();
  const add = (point) => {
    const key = point.toArray().map((v) => Math.round(v * 1e8)).join(',');
    if (!keys.has(key)) { keys.add(key); points.push(point.clone()); }
  };
  for (let i = 0; i < p.count; i += 1) add(new THREE.Vector3().fromBufferAttribute(p, i));
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const vertices = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j));
    add(vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1 / 3));
    for (let j = 0; j < 3; j += 1) add(vertices[j].clone().add(vertices[(j + 1) % 3]).multiplyScalar(0.5));
  }
  return points;
};
const meshes = [chain.userData.evenPlates, chain.userData.oddPlates, chain.userData.pins];
const clouds = meshes.map((mesh) => cloudFor(mesh.geometry));
const point = new THREE.Vector3(), local = new THREE.Vector3(), matrix = new THREE.Matrix4();
let checked = 0, minBarrel = Infinity, minFusee = Infinity, minSpringGap = Infinity;
let maxHingeAngle = 0, maxLinkError = 0, maxClosure = 0, maxSpringLengthError = 0, worst;
const steps = Number(process.env.FUSEE_CLEARANCE_STEPS ?? 128);
if (!Number.isInteger(steps) || steps < 1) throw new Error('FUSEE_CLEARANCE_STEPS must be a positive integer');
for (let pose = 0; pose <= steps; pose += 1) {
  const progress = pose / steps;
  const state = motion.stateAtProgress(progress);
  chain.userData.setState(state);
  spring.geometry.userData.setBarrelAngle(state.barrelAngle);
  const cosine = Math.cos(state.fuseeAngle), sine = Math.sin(state.fuseeAngle);
  const fuseeRadiusAt = (point) => {
    if (point.y < g.bodyBottom || point.y > g.bodyTop) return 0;
    if (point.y >= groove.bodyTop) return groove.topRadius;
    if (point.y <= groove.bodyBottom) return groove.bottomRadius;
    const x = point.x - g.fuseeCenterX, y = -point.z;
    const theta = Math.atan2(y * cosine - x * sine, x * cosine + y * sine);
    const u = (g.fuseeZTop - point.y) / height;
    const phase = theta / grooveAngle;
    const center = phase + Math.ceil((u - phase - groove.grooveHalfWidth / height) * g.grooveTurns) / g.grooveTurns;
    return Math.min(g.fuseeTopRadius + (g.fuseeBottomRadius - g.fuseeTopRadius) * center + groove.floorOffset,
      groove.topRadius + ceilingSlope * (u - uTop));
  };
  for (let side = 0; side < meshes.length; side += 1) {
    const mesh = meshes[side];
    for (let instance = 0; instance < mesh.count; instance += 1) {
      mesh.getMatrixAt(instance, matrix);
      for (const p of clouds[side]) {
        point.copy(p).applyMatrix4(matrix);
        if (point.y >= g.bodyBottom && point.y <= g.bodyTop) {
          const barrelClearance = Math.hypot(point.x - g.barrelCenterX, point.z) - springBox.userData.barrelOuterRadius;
          minBarrel = Math.min(minBarrel, barrelClearance);
        }
        const fuseeClearance = Math.hypot(point.x - g.fuseeCenterX, point.z) - fuseeRadiusAt(point);
        if (fuseeClearance < minFusee) { minFusee = fuseeClearance; worst = { progress, side, instance, point: point.toArray(), fuseeClearance }; }
        checked += 1;
      }
    }
  }
  for (let i = 0; i < state.linkCount; i += 1) {
    maxLinkError = Math.max(maxLinkError, Math.abs(state.pins[i].distanceTo(state.pins[i + 1]) - state.linkPitch));
    if (i > 0) maxHingeAngle = Math.max(maxHingeAngle, chain.userData.links[i].hinge.angleTo(chain.userData.links[i - 1].hinge));
  }
  maxClosure = Math.max(maxClosure, Math.abs(state.residual));
  const ribbon = spring.geometry.userData;
  maxSpringLengthError = Math.max(maxSpringLengthError, Math.abs(ribbon.currentNeutralLength - ribbon.neutralLength));
  // Separation of neighboring turns at matching polar angles. The ribbon
  // is monotone in radius, so this also detects coils crossing one another.
  const offset = 2 * Math.PI / ribbon.angle * ribbon.segments;
  for (let i = 0; i + offset < ribbon.centers.length - 1; i += 1) {
    const j = i + offset, a = Math.floor(j);
    local.copy(ribbon.centers[a]).lerp(ribbon.centers[a + 1], j - a);
    minSpringGap = Math.min(minSpringGap, local.length() - ribbon.centers[i].length() - ribbon.thickness);
  }
}
const result = { poses: steps + 1, checked, minBarrel, minFusee, worst, maxHingeAngle, maxLinkError, maxClosure,
  minSpringGap, maxSpringLengthError };
await writeFile(new URL('../artifacts/review/046-chain-clearance.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(result);
if (minBarrel < -2e-7 || minFusee < -2e-7 || minSpringGap <= 0 || maxLinkError > 1e-10 || maxClosure > 1e-8) process.exitCode = 1;
