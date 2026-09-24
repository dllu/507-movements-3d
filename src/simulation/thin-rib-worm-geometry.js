import * as THREE from 'three';
import { cylindricalWormGeometry } from './worm-gear-geometry.js';

const turn = 2 * Math.PI;

/** Movement 31's worm: Brown draws three thin, parallel-sided ribs on a slim
 * core, not a full trapezoid thread. The loaded flank keeps the Type-I
 * straight flank (same pressure angle and pitch-line position as the hob
 * that cut the baked wheel), so the working contact is unchanged; the idle
 * flank is moved towards it and made nearly radial, thinning the rib.
 * `loadedSide` (+1/-1) selects which axial side of the section is loaded.
 */
export function thinRibWormGeometry({ pitchRadius, module, length, pressureAngle, angularSteps = 160,
  loadedSide = 1, tipWidth = 0.34 * module, idleFlankLean = 0.12 * module }) {
  // Reuse the reference hob's section numbers so the loaded flank coincides.
  const reference = cylindricalWormGeometry({ pitchRadius, module, length: Math.PI * module, pressureAngle, angularSteps: 3 });
  const { pitch, rootRadius, tipRadius, rootHalfWidth, tipHalfWidth } = reference.userData;
  reference.dispose();
  const s = loadedSide;
  // Section in the local axial coordinate u (loaded side positive after the
  // sign flip below): loaded flank from (rootHalfWidth, root) to
  // (tipHalfWidth, tip); idle flank from (idleTip - lean, root) to (idleTip, tip).
  const idleTip = tipHalfWidth - tipWidth;
  const idleRoot = idleTip - idleFlankLean;
  const local = [
    [-pitch / 2, rootRadius], [idleRoot, rootRadius], [idleTip, tipRadius],
    [tipHalfWidth, tipRadius], [rootHalfWidth, rootRadius], [pitch / 2, rootRadius],
  ];
  const section = s > 0 ? local : local.map(([u, r]) => [-u, r]).reverse();
  const leadPerRadian = pitch / turn;
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
      for (let k = 0; k < section.length - 1; k += 1) {
        const [z0, r0] = section[k];
        const [z1, r1] = section[k + 1];
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
    rootHalfWidth, tipHalfWidth, idleTip, idleRoot, loadedSide: s, tipWidth, angularSteps, phase: 0,
    section, profile: 'thin-rib-loaded-flank-worm' };
  return geometry;
}
