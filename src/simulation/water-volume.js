import * as THREE from 'three';
import { PALETTE } from './primitives.js';

// Open water rendered as a real body: a translucent blue volume where the
// water physically is, instead of Brown's ruled strokes (engraving notation).
// depthWrite is off so the immersed parts inside stay visible through it, and
// opacity < 0.6 marks it as fluid for the solid-clearance screens.
export function waterVolumeMaterial({ color = PALETTE.fluid, opacity = 0.4 } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.02,
    roughness: 0.18,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  material.fog = false;
  return material;
}

// Axis-aligned water body from its free surface down to its bed, in the
// caller's local frame.
export function waterVolumeGeometry({ xMin, xMax, surfaceY, bottomY, zMin, zMax }) {
  const geometry = new THREE.BoxGeometry(xMax - xMin, surfaceY - bottomY, zMax - zMin);
  geometry.translate((xMin + xMax) / 2, (surfaceY + bottomY) / 2, (zMin + zMax) / 2);
  return geometry;
}

export function waterVolume(bounds, material = waterVolumeMaterial()) {
  const mesh = new THREE.Mesh(waterVolumeGeometry(bounds), material);
  mesh.renderOrder = 1;
  return mesh;
}


// Moving water in the open (jets, falling sheets, fountain crowns) as one
// translucent body that follows its trajectory, instead of bundles of thin
// streamline tubes or droplet spheres. Per-vertex alpha lets a jet thin out
// into modest spray at its end without separate particles.
export function waterJetMaterial({ color = PALETTE.fluid, opacity = 0.48 } = {}) {
  const material = waterVolumeMaterial({ color, opacity });
  material.vertexColors = true;
  material.side = THREE.DoubleSide;
  return material;
}

const smooth01 = s => {
  const x = Math.min(1, Math.max(0, s));
  return x * x * (3 - 2 * x);
};

// Elliptic-section water body swept along `curve`. `radius`/`endRadius` are
// half-thicknesses; `width`/`endWidth` are half-widths along `widthAxis`
// (a sheet or fan when wider than thick). Past `fadeStart` (curve fraction)
// the section flares by `flare` while its alpha falls to zero: the spray.
export function waterJetGeometry(curve, {
  radius = 0.05,
  endRadius = radius,
  width = null,
  endWidth = null,
  widthAxis = null,
  segments = 48,
  radialSegments = 18,
  fadeStart = 1,
  flare = 1,
  startAlpha = 1,
  thetaStart = 0,
  thetaLength = Math.PI * 2,
} = {}) {
  const sector = thetaLength < Math.PI * 2 - 1e-9;
  const halfWidth0 = width ?? radius;
  const halfWidth1 = endWidth ?? (width == null ? endRadius : width);
  const frames = curve.computeFrenetFrames(segments, false);
  const axis = widthAxis ? widthAxis.clone().normalize() : null;
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const centre = new THREE.Vector3();
  const w = new THREE.Vector3();
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const alphaAt = t => {
    if (t <= fadeStart || fadeStart >= 1) return startAlpha;
    return startAlpha * (1 - smooth01((t - fadeStart) / (1 - fadeStart)));
  };
  const flareAt = t => (t <= fadeStart || fadeStart >= 1)
    ? 1 : 1 + (flare - 1) * smooth01((t - fadeStart) / (1 - fadeStart));
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    curve.getPointAt(t, centre);
    const tangent = frames.tangents[i];
    if (axis) {
      w.copy(axis).addScaledVector(tangent, -axis.dot(tangent));
      if (w.lengthSq() < 1e-8) w.copy(frames.normals[i]);
      w.normalize();
    } else {
      w.copy(frames.normals[i]);
    }
    n.crossVectors(tangent, w).normalize();
    const f = flareAt(t);
    const a = (halfWidth0 + (halfWidth1 - halfWidth0) * t) * f;
    const b = (radius + (endRadius - radius) * t) * f;
    const alpha = alphaAt(t);
    for (let j = 0; j <= radialSegments; j += 1) {
      const theta = thetaStart + (j / radialSegments) * thetaLength;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      p.copy(centre).addScaledVector(w, a * c).addScaledVector(n, b * s);
      nn.copy(w).multiplyScalar(c * b).addScaledVector(n, s * a).normalize();
      positions.push(p.x, p.y, p.z);
      normals.push(nn.x, nn.y, nn.z);
      colors.push(1, 1, 1, alpha);
      uvs.push(t, j / radialSegments);
    }
  }
  const ring = radialSegments + 1;
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * ring + j;
      const b = a + ring;
      // Counter-clockwise seen from outside, so the faces agree with the
      // outward normals (DoubleSide would otherwise flip them and darken).
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // A sector (a jet cut on a section plane) is closed by flat cut faces from
  // its axis out to both cut edges.
  if (sector) {
    const axis = [];
    for (let i = 0; i <= segments; i += 1) {
      curve.getPointAt(i / segments, centre);
      axis.push(centre.clone());
    }
    for (const [j, sign] of [[0, -1], [radialSegments, 1]]) {
      const base = positions.length / 3;
      for (let i = 0; i <= segments; i += 1) {
        const edge = (i * ring + j) * 3;
        const t = frames.tangents[i];
        const e = new THREE.Vector3(positions[edge], positions[edge + 1], positions[edge + 2]);
        const faceNormal = new THREE.Vector3().subVectors(e, axis[i]).cross(t).normalize()
          .multiplyScalar(sign);
        const alpha = colors[(i * ring + j) * 4 + 3];
        for (const v of [axis[i], e]) {
          positions.push(v.x, v.y, v.z);
          normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
          colors.push(1, 1, 1, alpha);
          uvs.push(i / segments, j / radialSegments);
        }
      }
      for (let i = 0; i < segments; i += 1) {
        const a = base + i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  // Closed ends (a flat cap at the nozzle, and at the tail where visible).
  for (const [i, sign] of [[0, -1], [segments, 1]]) {
    curve.getPointAt(i / segments, centre);
    const tangent = frames.tangents[i];
    const alpha = alphaAt(i / segments);
    const centreIndex = positions.length / 3;
    positions.push(centre.x, centre.y, centre.z);
    normals.push(tangent.x * sign, tangent.y * sign, tangent.z * sign);
    colors.push(1, 1, 1, alpha);
    uvs.push(i / segments, 0.5);
    for (let j = 0; j <= radialSegments; j += 1) {
      const src = (i * ring + j) * 3;
      positions.push(positions[src], positions[src + 1], positions[src + 2]);
      normals.push(tangent.x * sign, tangent.y * sign, tangent.z * sign);
      colors.push(1, 1, 1, alpha);
      uvs.push(i / segments, j / radialSegments);
    }
    for (let j = 0; j < radialSegments; j += 1) {
      const a = centreIndex + 1 + j;
      if (sign < 0) indices.push(centreIndex, a + 1, a);
      else indices.push(centreIndex, a, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

// Fountain: a column rising from a nozzle to its apex, then a thin crown of
// falling water (a surface of revolution with parabolic fall) whose rim
// thins into spray. Local frame: nozzle on the y axis at `nozzleY`.
// `thetaStart`/`thetaLength` restrict the crown (and, with `cutColumn`, the
// column) to a sector: a plume cut on a section plane, or split between
// meshes (omit the column from all but one with `column: false`).
export function waterFountainGeometry({
  nozzleY,
  apexY,
  columnRadius,
  crownRadius,
  fallY,
  crownThickness = columnRadius * 0.35,
  radialSegments = 32,
  crownSegments = 28,
  fadeStart = 0.55,
  thetaStart = 0,
  thetaLength = Math.PI * 2,
  column: withColumn = true,
  crownAlpha = 0.55,
  cutColumn = true,
} = {}) {
  // The column's section angle runs the other way round y from the crown's.
  const column = waterJetGeometry(
    new THREE.LineCurve3(new THREE.Vector3(0, nozzleY, 0), new THREE.Vector3(0, apexY, 0)),
    { radius: columnRadius, endRadius: columnRadius * 0.72, segments: 8, radialSegments,
      widthAxis: new THREE.Vector3(1, 0, 0),
      ...(cutColumn ? { thetaStart: -(thetaStart + thetaLength), thetaLength } : {}) },
  );
  // Crown sheet: outer and inner skins joined at the apex, fading at the rim.
  const profile = [];
  for (let i = 0; i <= crownSegments; i += 1) {
    const s = i / crownSegments;
    // Ballistic sheet: radius grows linearly with time of flight while the
    // water falls quadratically.
    profile.push([columnRadius * 0.72 + (crownRadius - columnRadius * 0.72) * s,
      apexY + crownThickness - (apexY + crownThickness - fallY) * s * s, s]);
  }
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const ring = radialSegments + 1;
  const skins = [0, 1];
  for (const skin of skins) {
    const base = positions.length / 3;
    for (const [r0, y0, s] of profile) {
      const r = skin ? Math.max(0, r0 - crownThickness * (1 - s * 0.5)) : r0;
      const y = skin ? y0 - crownThickness : y0;
      // The crown is a thin sheet: fainter than the column, fading at the rim.
      const alpha = crownAlpha * (s <= fadeStart ? 1 : 1 - smooth01((s - fadeStart) / (1 - fadeStart)));
      for (let j = 0; j <= radialSegments; j += 1) {
        const theta = thetaStart + (j / radialSegments) * thetaLength;
        positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
        const slope = (2 * (apexY - fallY) * s) / Math.max(1e-6, crownRadius - columnRadius * 0.72);
        const nx = skin ? -slope : slope;
        const ny = skin ? -1 : 1;
        const len = Math.hypot(nx, ny) || 1;
        normals.push((nx / len) * Math.cos(theta), ny / len, (nx / len) * Math.sin(theta));
        colors.push(1, 1, 1, alpha);
        uvs.push(s, j / radialSegments);
      }
    }
    for (let i = 0; i < crownSegments; i += 1) {
      for (let j = 0; j < radialSegments; j += 1) {
        const a = base + i * ring + j;
        const b = a + ring;
        if (skin) indices.push(a, a + 1, b, b, a + 1, b + 1);
        else indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  crown.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  crown.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  crown.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  crown.setIndex(indices);
  if (!withColumn) {
    column.dispose();
    return crown;
  }
  const merged = mergeJetGeometries([column, crown]);
  column.dispose();
  crown.dispose();
  return merged;
}

export function mergeJetGeometries(geometries) {
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  let offset = 0;
  for (const g of geometries) {
    positions.push(...g.attributes.position.array);
    normals.push(...g.attributes.normal.array);
    colors.push(...g.attributes.color.array);
    uvs.push(...g.attributes.uv.array);
    for (const i of g.index.array) indices.push(i + offset);
    offset += g.attributes.position.count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

export function waterJet(curve, options = {}, material = waterJetMaterial()) {
  const mesh = new THREE.Mesh(waterJetGeometry(curve, options), material);
  mesh.renderOrder = 2;
  return mesh;
}
