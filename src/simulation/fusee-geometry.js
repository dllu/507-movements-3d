import * as THREE from 'three';
import { fuseeClampedTread, fuseeRiserRadius, fuseeSurfaceHeight } from './fusee-motion.js';

// Brown's fusee as one closed solid: a single helical ledge wound on a
// cone. In every radial section the profile is a staircase (flat tread,
// vertical riser), and going round the axis the treads and risers sweep on
// continuously: there is no step face anywhere round the circumference.
// From above the risers form one Archimedean spiral. The ledge runs out onto
// the flat top (riser height growing from nothing over the turn above the
// chain's free end) and onto the base flange (riser height falling back to
// nothing over the turn below the chain's anchored end).
//
// All surfaces share one grid of unwrapped angles theta_j = -2 pi + j dtheta
// (dtheta = 2 pi / segmentsPerTurn): riser j stands at R(theta_j) between the
// tread of theta_j (outside, below) and that of theta_j - 2 pi (inside,
// above); tread j runs radially from riser j out to riser j + N.
export function steppedFuseeGeometry(parameters, { segmentsPerTurn = 720 } = {}) {
  const p = parameters;
  const turn = 2 * Math.PI, N = segmentsPerTurn, dTheta = turn / N;
  const grooveSteps = Math.round(p.grooveTurns * N);
  const first = -turn, riserCount = grooveSteps + 2 * N; // risers theta in [-2pi, W + 2pi]
  const thetaAt = (j) => first + j * dTheta;
  const tread = (j) => fuseeClampedTread(p, thetaAt(j));
  const riserPoint = (j) => {
    const theta = thetaAt(j), radius = fuseeRiserRadius(p, theta);
    return new THREE.Vector2(radius * Math.cos(theta), radius * Math.sin(theta));
  };
  const points = Array.from({ length: riserCount + 1 }, (_, j) => riserPoint(j));
  // Riser top: the tread of the turn inside (flat top for the first turn).
  const riserTop = (j) => (j < N ? p.bodyTop : tread(j - N));

  const positions = [], normals = [];
  const emit = (a, b, c, na, nb, nc) => {
    for (const v of [a, b, c]) v.set(Math.fround(v.x), Math.fround(v.y), Math.fround(v.z));
    const cross = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (cross.lengthSq() < 1e-24) return;
    if (cross.dot(na.clone().add(nb).add(nc)) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    for (const v of [a, b, c]) positions.push(v.x, v.y, v.z);
    for (const n of [na, nb, nc]) normals.push(n.x, n.y, n.z);
  };
  const at = (xy, z) => new THREE.Vector3(xy.x, xy.y, z);
  const up = new THREE.Vector3(0, 0, 1), down = new THREE.Vector3(0, 0, -1);
  const slope = p.leadPerTurn / turn;
  // Tread normal: the tread is swept by horizontal radial lines, so it is
  // tilted along the circumference by the lead (flat where clamped).
  const treadNormal = (j, radius) => {
    const theta = thetaAt(j);
    const clamped = tread(j) !== p.topTread - slope * theta;
    const dz = clamped ? 0 : -slope;
    return new THREE.Vector3(Math.sin(theta) * dz, -Math.cos(theta) * dz, radius).normalize();
  };
  const riserNormal = (j) => {
    const theta = thetaAt(j), radius = fuseeRiserRadius(p, theta), dr = p.radialPitch / turn;
    return new THREE.Vector3(radius * Math.cos(theta) + dr * Math.sin(theta),
      radius * Math.sin(theta) - dr * Math.cos(theta), 0).normalize();
  };

  // Risers: one continuous spiral wall, smooth shaded along it.
  for (let j = 0; j < riserCount; j += 1) {
    const a = points[j], b = points[j + 1], na = riserNormal(j), nb = riserNormal(j + 1);
    emit(at(a, tread(j)), at(b, tread(j + 1)), at(b, riserTop(j + 1)), na, nb, nb);
    emit(at(a, tread(j)), at(b, riserTop(j + 1)), at(a, riserTop(j)), na, nb, na);
  }
  // Treads: helicoidal bands from riser j out to riser j + N.
  for (let j = 0; j < grooveSteps + N; j += 1) {
    const ai = points[j], bi = points[j + 1], ao = points[j + N], bo = points[j + N + 1];
    const za = tread(j), zb = tread(j + 1);
    const nai = treadNormal(j, ai.length()), nbi = treadNormal(j + 1, bi.length());
    const nao = treadNormal(j, ao.length()), nbo = treadNormal(j + 1, bo.length());
    emit(at(ai, za), at(ao, za), at(bo, zb), nai, nao, nbo);
    emit(at(ai, za), at(bo, zb), at(bi, zb), nai, nbo, nbi);
  }
  // Flat top inside the first riser turn: a fan from the axis. Its last
  // wedge is split at the first riser point, which lies on the closing
  // radius between riser N and the axis.
  {
    const center = new THREE.Vector3(0, 0, p.bodyTop);
    for (let j = 0; j + 1 < N; j += 1) emit(center.clone(), at(points[j], p.bodyTop), at(points[j + 1], p.bodyTop), up, up, up);
    emit(center.clone(), at(points[N - 1], p.bodyTop), at(points[0], p.bodyTop), up, up, up);
    emit(at(points[0], p.bodyTop), at(points[N - 1], p.bodyTop), at(points[N], p.bodyTop), up, up, up);
  }
  // Base flange top: from the last riser turn out to the base circle. Its
  // first wedge also carries the last tread's closing edge.
  const last = grooveSteps + N; // riser index at the anchored end
  const circle = (k) => {
    const theta = thetaAt(last + k);
    return new THREE.Vector2(p.baseRadius * Math.cos(theta), p.baseRadius * Math.sin(theta));
  };
  {
    const z = p.flangeTop, end = points[last + N];
    const q = points[last + 1];
    emit(at(q, z), at(points[last], z), at(end, z), up, up, up);
    emit(at(q, z), at(end, z), at(circle(0), z), up, up, up);
    emit(at(q, z), at(circle(0), z), at(circle(1), z), up, up, up);
    for (let k = 1; k < N; k += 1) {
      emit(at(points[last + k], z), at(circle(k), z), at(circle(k + 1), z), up, up, up);
      emit(at(points[last + k], z), at(circle(k + 1), z), at(points[last + k + 1], z), up, up, up);
    }
  }
  // Base rim and underside.
  for (let k = 0; k < N; k += 1) {
    const a = circle(k), b = circle(k + 1);
    const na = new THREE.Vector3(a.x, a.y, 0).normalize(), nb = new THREE.Vector3(b.x, b.y, 0).normalize();
    emit(at(a, p.baseBottom), at(b, p.baseBottom), at(b, p.flangeTop), na, nb, nb);
    emit(at(a, p.baseBottom), at(b, p.flangeTop), at(a, p.flangeTop), na, nb, na);
    const center = new THREE.Vector3(0, 0, p.baseBottom);
    emit(center, at(a, p.baseBottom), at(b, p.baseBottom), down, down, down);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = { segmentsPerTurn, helicalLedge: true, archimedeanRisers: true,
    bodyTop: p.bodyTop, bodyBottom: p.baseBottom, baseRadius: p.baseRadius,
    riserRadiusAt: (theta) => fuseeRiserRadius(p, theta),
    surfaceHeightAt: (radius, phi) => fuseeSurfaceHeight(p, radius, phi) };
  return geometry;
}
