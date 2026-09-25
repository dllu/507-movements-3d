import * as THREE from 'three';

// Brown draws ropes and cords as laid rope: a hatched twist along the line.
// This is the three-strand rope first built for 270, generalised to any
// centreline. Each strand is a round tube of radius r / (1 + 1/sin 60 deg),
// laid on a helix of radius r minus that, so the three strands touch each
// other and fill a rope of overall radius r. One strand makes a full turn
// about the axis every LAY_PER_DIAMETER rope diameters (270: 0.39 per 0.16).
export const LAID_ROPE = Object.freeze({
  strands: 3,
  strandRatio: 1 / (1 + 1 / Math.sin(Math.PI / 3)),
  layPerDiameter: 0.39 / 0.16,
  samplesPerLay: 12,
  maxSamples: 3600,
});

export function laidRopeDimensions(radius, length = 0, closed = false, lay) {
  const strandRadius = radius * LAID_ROPE.strandRatio;
  const layRadius = radius - strandRadius;
  let fullLay = lay ?? LAID_ROPE.layPerDiameter * 2 * radius;
  // A closed rope repeats its strand pattern (every third of a lay) a whole
  // number of times, so the seam cannot be seen.
  if (closed && length > 0) {
    const period = fullLay / LAID_ROPE.strands;
    fullLay = LAID_ROPE.strands * length / Math.max(1, Math.round(length / period));
  }
  return { radius, strandRadius, layRadius, lay: fullLay };
}

function curveFrom(path, closed) {
  if (typeof path?.getPoint === 'function') return path;
  if (Array.isArray(path)) {
    const points = path.map((point) => point.clone());
    return new THREE.CatmullRomCurve3(points, closed, 'centripetal', 0.35);
  }
  throw new TypeError('A laid rope requires a Three.js curve or an array of points.');
}

/**
 * Drop-in replacement for THREE.TubeGeometry that draws a three-strand laid
 * rope. `travel` moves the lay along the rope (material distance), so a rope
 * running over a pulley shows its motion without any painted markers.
 */
export class LaidRopeGeometry extends THREE.BufferGeometry {
  constructor(path, tubularSegments = 64, radius = 0.05, radialSegments = 8, closed = false, {
    travel = 0,
    lay,
    samplesPerLay = LAID_ROPE.samplesPerLay,
    samples,
  } = {}) {
    super();
    this.type = 'LaidRopeGeometry';
    const curve = curveFrom(path, closed);
    const length = Math.max(curve.getLength(), 1e-6);
    const dims = laidRopeDimensions(radius, length, closed, lay);
    // Round the sample count up to a multiple of 64 so a rope whose length
    // changes a little each frame keeps its buffer size.
    const along = Number.isInteger(samples) && samples >= 2 ? samples : Math.min(LAID_ROPE.maxSamples, Math.max(
      tubularSegments,
      64 * Math.ceil(length / dims.lay * samplesPerLay / 64),
      2,
    ));
    // Each strand is thin; six facets suffice below a 0.05 rope radius.
    const around = radius < 0.05 ? 6 : Math.max(6, Math.min(8, radialSegments));
    const frames = curve.computeFrenetFrames(along, closed);
    const centers = [];
    for (let i = 0; i <= along; i += 1) centers.push(curve.getPointAt(i / along));
    if (closed) {
      centers[along] = centers[0].clone();
      frames.normals[along] = frames.normals[0].clone();
      frames.binormals[along] = frames.binormals[0].clone();
      frames.tangents[along] = frames.tangents[0].clone();
    }
    this.parameters = { path: curve, tubularSegments: along, radius, radialSegments: around, closed };
    this.userData.crossSection = 'laid-rope';
    this.userData.ropeLay = { ...dims, strands: LAID_ROPE.strands, length };
    this._laid = { centers, frames, along, around, length, dims, closed };

    const strands = LAID_ROPE.strands;
    const perStrand = (along + 1) * around + (closed ? 0 : 2);
    const count = strands * perStrand;
    this.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const uv = new Float32Array(count * 2);
    const index = [];
    for (let k = 0; k < strands; k += 1) {
      const base = k * perStrand;
      for (let i = 0; i <= along; i += 1) {
        for (let j = 0; j < around; j += 1) {
          const n = base + i * around + j;
          uv[2 * n] = i / along;
          uv[2 * n + 1] = j / around;
          if (i < along) {
            const a = n;
            const a1 = base + i * around + (j + 1) % around;
            index.push(a, a1, a + around, a1, a1 + around, a + around);
          }
        }
      }
      if (!closed) {
        const startCap = base + (along + 1) * around;
        const endCap = startCap + 1;
        const lastRing = base + along * around;
        for (let j = 0; j < around; j += 1) {
          const next = (j + 1) % around;
          index.push(startCap, base + next, base + j);
          index.push(endCap, lastRing + j, lastRing + next);
        }
      }
    }
    this.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.setIndex(index);
    this.setTravel(travel);
  }

  // Serialise as a plain buffer geometry (ObjectLoader knows no rope type,
  // and the curve in `parameters` is not serialisable).
  toJSON(meta) {
    const { parameters, type } = this;
    delete this.parameters;
    this.type = 'BufferGeometry';
    try {
      return super.toJSON(meta);
    } finally {
      this.parameters = parameters;
      this.type = type;
    }
  }

  setTravel(travel = 0) {
    const { centers, frames, along, around, length, dims, closed } = this._laid;
    const positions = this.attributes.position.array;
    const normals = this.attributes.normal.array;
    const strands = LAID_ROPE.strands;
    const perStrand = (along + 1) * around + (closed ? 0 : 2);
    const { layRadius, strandRadius, lay } = dims;
    const cosAround = [];
    const sinAround = [];
    for (let j = 0; j < around; j += 1) {
      cosAround.push(Math.cos(2 * Math.PI * j / around));
      sinAround.push(Math.sin(2 * Math.PI * j / around));
    }
    for (let k = 0; k < strands; k += 1) {
      const base = k * perStrand;
      for (let i = 0; i <= along; i += 1) {
        const s = length * i / along;
        const phase = 2 * Math.PI * ((s - travel) / lay + k / strands);
        const c = centers[i];
        const N = frames.normals[i];
        const B = frames.binormals[i];
        const cn = layRadius * Math.cos(phase);
        const cb = layRadius * Math.sin(phase);
        const sx = c.x + N.x * cn + B.x * cb;
        const sy = c.y + N.y * cn + B.y * cb;
        const sz = c.z + N.z * cn + B.z * cb;
        for (let j = 0; j < around; j += 1) {
          const on = cosAround[j];
          const ob = sinAround[j];
          const nx = N.x * on + B.x * ob;
          const ny = N.y * on + B.y * ob;
          const nz = N.z * on + B.z * ob;
          const p = 3 * (base + i * around + j);
          positions[p] = sx + strandRadius * nx;
          positions[p + 1] = sy + strandRadius * ny;
          positions[p + 2] = sz + strandRadius * nz;
          normals[p] = nx;
          normals[p + 1] = ny;
          normals[p + 2] = nz;
        }
        if (!closed && (i === 0 || i === along)) {
          const cap = 3 * (base + (along + 1) * around + (i === 0 ? 0 : 1));
          const T = frames.tangents[i];
          const sign = i === 0 ? -1 : 1;
          positions[cap] = sx;
          positions[cap + 1] = sy;
          positions[cap + 2] = sz;
          normals[cap] = sign * T.x;
          normals[cap + 1] = sign * T.y;
          normals[cap + 2] = sign * T.z;
        }
      }
    }
    this.attributes.position.needsUpdate = true;
    this.attributes.normal.needsUpdate = true;
    this.userData.travel = travel;
    this.computeBoundingBox();
    this.computeBoundingSphere();
    return this;
  }
}

/**
 * A mesh holding a laid rope that can follow a changing centreline.
 * `mesh.userData.setCurve(curve, travel)` rebuilds it; `setTravel(travel)`
 * only moves the lay along a fixed centreline.
 */
export function makeLaidRopeMesh(path, material, {
  radius = 0.05,
  closed = false,
  travel = 0,
  tubularSegments = 64,
  radialSegments = 8,
  lay,
} = {}) {
  const build = (curve, nextTravel) => new LaidRopeGeometry(
    curve, tubularSegments, radius, radialSegments, closed, { travel: nextTravel, lay },
  );
  const mesh = new THREE.Mesh(build(path, travel), material);
  mesh.castShadow = true;
  mesh.userData.setCurve = (curve, nextTravel = mesh.geometry.userData.travel ?? 0) => {
    replaceWithLaidRope(mesh, curve, { radius, closed, travel: nextTravel, tubularSegments, radialSegments, lay });
  };
  mesh.userData.setTravel = (nextTravel) => mesh.geometry.setTravel?.(nextTravel);
  return mesh;
}

/**
 * Replace a mesh's geometry by a laid rope along `path`, reusing its buffers
 * when the sample counts match (the usual case for a rope of fixed length).
 */
export function replaceWithLaidRope(mesh, path, {
  radius = 0.05,
  closed = false,
  travel = 0,
  tubularSegments = 64,
  radialSegments = 8,
  lay,
} = {}) {
  const current = mesh.geometry;
  // Keep the sample count of a rope whose length changes by moderate amounts,
  // so its buffers stay the same objects from frame to frame.
  let samples;
  const previous = current?.type === 'LaidRopeGeometry' ? current._laid : null;
  if (previous && previous.closed === closed && current.parameters?.radius === radius) {
    const curve = curveFrom(path, closed);
    const dims = laidRopeDimensions(radius, curve.getLength(), closed, lay);
    const wanted = Math.max(tubularSegments, curve.getLength() / dims.lay * LAID_ROPE.samplesPerLay);
    if (wanted <= previous.along * 1.5 && previous.along >= tubularSegments) samples = previous.along;
  }
  const next = new LaidRopeGeometry(path, tubularSegments, radius, radialSegments, closed, { travel, lay, samples });
  if (current?.type === 'LaidRopeGeometry'
    && current.attributes.position.count === next.attributes.position.count
    && current.index?.count === next.index?.count) {
    current.attributes.position.array.set(next.attributes.position.array);
    current.attributes.normal.array.set(next.attributes.normal.array);
    current.attributes.position.needsUpdate = true;
    current.attributes.normal.needsUpdate = true;
    current._laid = next._laid;
    current.parameters = next.parameters;
    current.userData = next.userData;
    current.computeBoundingBox();
    current.computeBoundingSphere();
    next.dispose();
    return current;
  }
  mesh.geometry = next;
  current?.dispose?.();
  return next;
}
