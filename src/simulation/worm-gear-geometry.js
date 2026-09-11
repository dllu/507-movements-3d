import * as THREE from 'three';
import { wormCut } from '../data/contact-profiles.js';
import { generateWormWheelProfile } from './worm-wheel-profile.js';

const cache = new Map();
const turn = 2 * Math.PI;

/** A Type-I worm has straight flanks in an axial section, swept helically.
 * The section is integral with the root cylinder, not a round wire coil.
 * See KHK's technical reference, Calculation of Gear Dimensions, section 4.6.
 */
export function cylindricalWormGeometry({ pitchRadius, module, length, pressureAngle, angularSteps = 160 }) {
  const pitch = Math.PI * module;
  const leadPerRadian = pitch / turn;
  const rootRadius = pitchRadius - 1.25 * module;
  const tipRadius = pitchRadius + module;
  const tangent = Math.tan(pressureAngle);
  const rootHalfWidth = pitch / 4 + 1.25 * module * tangent;
  const tipHalfWidth = pitch / 4 - module * tangent;
  const section = [
    [-pitch / 2, rootRadius], [-rootHalfWidth, rootRadius],
    [-tipHalfWidth, tipRadius], [tipHalfWidth, tipRadius],
    [rootHalfWidth, rootRadius], [pitch / 2, rootRadius],
  ];
  const positions = [];
  const normals = [];
  const triangle = (vertices, normalOverride = null) => {
    for (const v of vertices) {
      positions.push(v.point.x, v.point.y, v.point.z);
      const normal = normalOverride ?? v.normal;
      normals.push(normal.x, normal.y, normal.z);
    }
  };
  const clip = (polygon, side) => {
    const result = [];
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      const da = length / 2 - side * a.point.z;
      const db = length / 2 - side * b.point.z;
      if (da >= 0) result.push(a);
      if ((da < 0) !== (db < 0)) {
        const t = da / (da - db);
        result.push({ point: a.point.clone().lerp(b.point, t), normal: a.normal.clone().lerp(b.normal, t).normalize() });
      }
    }
    return result;
  };
  const emit = (vertices) => {
    const polygon = clip(clip(vertices, -1), 1);
    for (let index = 1; index < polygon.length - 1; index += 1) {
      triangle([polygon[0], polygon[index], polygon[index + 1]]);
    }
    // Cap exactly the clipped boundary; independent analytic cap sampling
    // would leave cracks between its curve and the helical mesh chords.
    for (const side of [-1, 1]) {
      for (let index = 0; index < polygon.length; index += 1) {
        const a = polygon[index];
        const b = polygon[(index + 1) % polygon.length];
        if (Math.abs(a.point.z - side * length / 2) > 1e-10
          || Math.abs(b.point.z - side * length / 2) > 1e-10) continue;
        triangle([{ point: new THREE.Vector3(0, 0, side * length / 2) }, b, a], new THREE.Vector3(0, 0, side));
      }
    }
  };
  const copies = Math.ceil(length / (2 * pitch)) + 2;
  for (let copy = -copies; copy <= copies; copy += 1) {
    for (let angular = 0; angular < angularSteps; angular += 1) {
      const a = turn * angular / angularSteps;
      const b = turn * (angular + 1) / angularSteps;
      for (let s = 0; s < section.length - 1; s += 1) {
        const [z0, r0] = section[s];
        const [z1, r1] = section[s + 1];
        const slope = (r1 - r0) / (z1 - z0);
        const vertex = (angle, z, radius) => {
          const c = Math.cos(angle);
          const sn = Math.sin(angle);
          return {
            point: new THREE.Vector3(radius * c, radius * sn, copy * pitch + z + leadPerRadian * angle),
            normal: new THREE.Vector3(c - slope * leadPerRadian / radius * sn,
              sn + slope * leadPerRadian / radius * c, -slope).normalize(),
          };
        };
        const va = vertex(a, z0, r0);
        const vb = vertex(b, z0, r0);
        const vc = vertex(b, z1, r1);
        const vd = vertex(a, z1, r1);
        emit([va, vb, vc]);
        emit([va, vc, vd]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.userData = { pitchRadius, module, length, pressureAngle, pitch, rootRadius, tipRadius,
    rootHalfWidth, tipHalfWidth, angularSteps, profile: 'axial-straight-flanked-worm' };
  return geometry;
}

/** Generate a wheel by removing the synchronized cylindrical worm volume.
 * A radial field varies across the wheel width, reproducing the throat and
 * skewed working flanks. This is sampled generating geometry with clearance.
 */
export function wormWheelGeometry({ teeth, pitchRadius, wormPitchRadius, wormLength, depth, pressureAngle }, { regenerate = false, profile = null } = {}) {
  const key = JSON.stringify({ teeth, pitchRadius, wormPitchRadius, wormLength, depth, pressureAngle });
  const supplied = profile ?? (!regenerate && wormCut?.key === key ? wormCut : null);
  if (supplied && supplied.key !== key) throw new Error('Generated worm profile dimensions do not match the wheel');
  const cacheKey = key + ':' + (supplied?.id ?? (supplied ? 'legacy' : 'generated'));
  if (!regenerate && cache.has(cacheKey)) return cache.get(cacheKey).clone();
  const cut = supplied ?? generateWormWheelProfile({ teeth, pitchRadius, wormPitchRadius, wormLength, depth, pressureAngle });
  const module = 2 * pitchRadius / teeth;
  const pitch = turn / teeth;
  const outerRadius = pitchRadius + module;
  // Legacy baked data did not carry grid metadata. New generated profiles do.
  const axialSteps = cut.axialSteps ?? 24;
  const angularSteps = cut.angularSteps ?? 160;
  const clearance = cut.clearance ?? 0.0007;
  if (!Number.isInteger(axialSteps) || axialSteps < 1 || !Number.isInteger(angularSteps) || angularSteps < 3
    || cut.radii.length !== (axialSteps + 1) * (angularSteps + 1)
    || cut.radii.some(r => !Number.isFinite(r) || r <= 0 || r > outerRadius + 1e-8)) {
    throw new Error('Invalid generated worm radial field');
  }
  const radii = Float64Array.from(cut.radii);
  const positions = [];
  const indices = [];
  const circumferenceSteps = angularSteps * teeth;
  const stride = circumferenceSteps + 1;
  for (let axial = 0; axial <= axialSteps; axial += 1) {
    const z = -depth / 2 + depth * axial / axialSteps;
    for (let angular = 0; angular <= circumferenceSteps; angular += 1) {
      const angle = -pitch / 2 + pitch * angular / angularSteps;
      const radius = radii[axial * (angularSteps + 1) + angular % angularSteps];
      positions.push(radius * Math.cos(angle), radius * Math.sin(angle), z);
    }
  }
  for (let axial = 0; axial < axialSteps; axial += 1) {
    for (let angular = 0; angular < circumferenceSteps; angular += 1) {
      const a = axial * stride + angular;
      indices.push(a, a + 1, a + stride + 1, a, a + stride + 1, a + stride);
    }
  }
  // Duplicate the cap rim so its planar normals stay separate from flanks.
  for (const side of [-1, 1]) {
    const center = positions.length / 3;
    positions.push(0, 0, side * depth / 2);
    const axial = side < 0 ? 0 : axialSteps;
    for (let angular = 0; angular <= circumferenceSteps; angular += 1) {
      const source = (axial * stride + angular) * 3;
      positions.push(...positions.slice(source, source + 3));
      if (angular > 0) {
        if (side < 0) indices.push(center, center + angular + 1, center + angular);
        else indices.push(center, center + angular, center + angular + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = { profileKey: key, profileId: cut.id, phaseSteps: cut.phaseSteps, radialSteps: cut.radialSteps,
    radii: Array.from(radii), depth, axialSteps, angularSteps,
    circumferenceSteps, pitch, outerRadius, rootRadius: Math.min(...radii), clearance };
  cache.set(cacheKey, geometry);
  return geometry.clone();
}
