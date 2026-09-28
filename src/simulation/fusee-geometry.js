import * as THREE from 'three';
import { fuseeRiserRadius } from './fusee-motion.js';

// Brown's stepped fusee as one closed turned solid: flat tiers over a base
// flange. Seen from above, the tier risers together trace ONE Archimedean
// spiral (radius growing linearly with angle, one tier per turn), with
// every tier's radial step on the same radius. Tier k spans the spiral turn
// from its step at body angle phiStep round to the step again, so its outline
// starts at r_k(phiStep) and ends a radial pitch further out. Each shelf (the
// top of the tier below, or the base flange) is a spiral band of constant
// width between two neighbouring outlines; the chain lies on it against the
// riser above.
export function steppedFuseeGeometry(parameters, { angularSegments = 1440 } = {}) {
  const p = parameters;
  const tierCount = p.tierCount;
  const fullTurn = 2 * Math.PI;
  const phiStep = THREE.MathUtils.euclideanModulo(p.stepAngle, fullTurn);
  // One shared angle list from the step round to the step again (inclusive),
  // so shelves are simple strips between neighbouring outlines.
  const angles = Array.from({ length: angularSegments + 1 }, (_, i) => phiStep + fullTurn * i / angularSegments);
  const riser = (k, i) => {
    // Unwrapped spiral: sample 0 is the tier's start, sample N its end.
    const theta = p.stepAngle + fullTurn * (k - 1) + fullTurn * i / angularSegments;
    return p.chainRadiusStart + p.radialPitch * theta / fullTurn - p.riserGap;
  };
  const outlines = [];
  for (let k = 0; k <= tierCount; k += 1) {
    outlines.push(angles.map((phi, i) => {
      const radius = k < tierCount ? riser(k, i) : p.baseRadius;
      return { phi, radius, xy: new THREE.Vector2(radius * Math.cos(phi), radius * Math.sin(phi)) };
    }));
  }
  const tops = [p.tierTop, ...p.tierShelves];
  const bottoms = [...p.tierShelves, p.baseBottom];

  const positions = [], normals = [];
  const emit = (a, b, c, na, nb, nc) => {
    // Orient by the stored (single-precision) coordinates, so near-straight
    // slivers keep the winding their normals claim after rounding.
    for (const v of [a, b, c]) v.set(Math.fround(v.x), Math.fround(v.y), Math.fround(v.z));
    const cross = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (cross.lengthSq() < 1e-24) return;
    if (cross.dot(na.clone().add(nb).add(nc)) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    for (const v of [a, b, c]) positions.push(v.x, v.y, v.z);
    for (const n of [na, nb, nc]) normals.push(n.x, n.y, n.z);
  };
  const at = (point, z) => new THREE.Vector3(point.xy.x, point.xy.y, z);
  const up = new THREE.Vector3(0, 0, 1), down = new THREE.Vector3(0, 0, -1);
  const count = angularSegments;

  // Side walls: smooth shading along each spiral (or the base circle).
  outlines.forEach((outline, k) => {
    const closed = k === tierCount;
    const edgeNormal = (i) => {
      const a = outline[i].xy, b = outline[i + 1].xy;
      return new THREE.Vector3(b.y - a.y, a.x - b.x, 0).normalize();
    };
    const vertexNormal = (i) => {
      if (i === 0) return closed ? edgeNormal(count - 1).add(edgeNormal(0)).normalize() : edgeNormal(0);
      if (i === count) return closed ? vertexNormal(0) : edgeNormal(count - 1);
      return edgeNormal(i - 1).add(edgeNormal(i)).normalize();
    };
    for (let i = 0; i < count; i += 1) {
      const a = outline[i], b = outline[i + 1];
      const na = vertexNormal(i), nb = vertexNormal(i + 1);
      emit(at(a, bottoms[k]), at(b, bottoms[k]), at(b, tops[k]), na, nb, nb);
      emit(at(a, bottoms[k]), at(b, tops[k]), at(a, tops[k]), na, nb, na);
    }
  });
  // Radial step faces, flat, facing along the direction of increasing angle
  // at the step (the outer, later end of the spiral turn faces forward).
  const stepNormal = new THREE.Vector3(-Math.sin(phiStep), Math.cos(phiStep), 0);
  for (let k = 0; k < tierCount; k += 1) {
    const inner = outlines[k][0], outer = outlines[k][count];
    emit(at(inner, bottoms[k]), at(outer, bottoms[k]), at(outer, tops[k]), stepNormal, stepNormal, stepNormal);
    emit(at(inner, bottoms[k]), at(outer, tops[k]), at(inner, tops[k]), stepNormal, stepNormal, stepNormal);
  }
  // Top of tier 0: a fan from the axis. The last wedge is split at the
  // step's inner end so no vertex lies inside another triangle's edge.
  {
    const outline = outlines[0], z = tops[0], center = new THREE.Vector3(0, 0, z);
    for (let i = 0; i + 1 < count; i += 1) emit(center.clone(), at(outline[i], z), at(outline[i + 1], z), up, up, up);
    emit(center.clone(), at(outline[count - 1], z), at(outline[0], z), up, up, up);
    emit(at(outline[0], z), at(outline[count - 1], z), at(outline[count], z), up, up, up);
  }
  // Shelves: spiral bands between tier k (inside) and tier k + 1 (outside).
  // The band's start edge carries tier k's step foot and its end edge tier
  // k + 1's step top; outline k's end point is outline k + 1's start point.
  for (let k = 0; k + 1 < tierCount; k += 1) {
    const inner = outlines[k], outer = outlines[k + 1], z = tops[k + 1];
    for (let i = 0; i < count; i += 1) {
      emit(at(inner[i], z), at(outer[i], z), at(outer[i + 1], z), up, up, up);
      emit(at(inner[i], z), at(outer[i + 1], z), at(inner[i + 1], z), up, up, up);
    }
  }
  // Base flange top: the band between the last tier and the base circle.
  // The circle closes on itself, so the first wedge is split at the last
  // tier's outer step end (which lies on the same radius).
  {
    const inner = outlines[tierCount - 1], outer = outlines[tierCount], z = tops[tierCount];
    const stepEnd = inner[count];
    emit(at(stepEnd, z), at(outer[0], z), at(outer[1], z), up, up, up);
    emit(at(stepEnd, z), at(outer[1], z), at(inner[1], z), up, up, up);
    emit(at(stepEnd, z), at(inner[1], z), at(inner[0], z), up, up, up);
    for (let i = 1; i < count; i += 1) {
      emit(at(inner[i], z), at(outer[i], z), at(outer[i + 1], z), up, up, up);
      emit(at(inner[i], z), at(outer[i + 1], z), at(inner[i + 1], z), up, up, up);
    }
  }
  // Underside of the base flange.
  {
    const outline = outlines[tierCount], z = bottoms[tierCount], center = new THREE.Vector3(0, 0, z);
    for (let i = 0; i < count; i += 1) emit(center.clone(), at(outline[i], z), at(outline[i + 1], z), down, down, down);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = { angularSegments, steppedTiers: true, archimedeanRisers: true, tierCount, phiStep,
    tops, bottoms, bodyTop: tops[0], bodyBottom: bottoms[tierCount], baseRadius: p.baseRadius,
    outlineRadiusAt: (k, phi) => (k < tierCount ? fuseeRiserRadius(p, k, phi) : p.baseRadius) };
  return geometry;
}
