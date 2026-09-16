// Maximum X of a triangular face offset by a sphere, on a fixed Y/Z line.
// Face-interior and edge extrema are both included; finite pad footprint and
// triangle boundaries therefore participate in the contact solution.
export function sphereFaceSupport(triangles, radius) {
  const r2 = radius * radius;
  const faces = triangles.map(([a, b, c]) => {
    const by = b[1] - a[1], bz = b[2] - a[2], cy = c[1] - a[1], cz = c[2] - a[2];
    const determinant = by * cz - bz * cy;
    const gy = ((b[0] - a[0]) * cz - (c[0] - a[0]) * bz) / determinant;
    const gz = (by * (c[0] - a[0]) - cy * (b[0] - a[0])) / determinant;
    return {a, b, c, by, bz, cy, cz, determinant, gy, gz,
      norm: Math.hypot(1, gy, gz),
      minY: Math.min(a[1], b[1], c[1]), maxY: Math.max(a[1], b[1], c[1]),
      minZ: Math.min(a[2], b[2], c[2]), maxZ: Math.max(a[2], b[2], c[2])};
  });
  return (y, z) => {
    let maximum = -Infinity, point, normal;
    const accept = (x, qx, qy, qz) => {
      if (x > maximum) {maximum = x;point = [qx, qy, qz];normal = [(x - qx) / radius, (y - qy) / radius, (z - qz) / radius];}
    };
    for (const f of faces) {
      const dy = Math.max(f.minY - y, 0, y - f.maxY), dz = Math.max(f.minZ - z, 0, z - f.maxZ);
      if (dy * dy + dz * dz > r2) continue;
      const {a, b, c, gy, gz, norm} = f;
      if (Math.abs(f.determinant) > 1e-15) {
        const qy = y + radius * gy / norm, qz = z + radius * gz / norm;
        const u = ((qy - a[1]) * f.cz - (qz - a[2]) * f.cy) / f.determinant;
        const v = (f.by * (qz - a[2]) - f.bz * (qy - a[1])) / f.determinant;
        if (u >= 0 && v >= 0 && u + v <= 1) {
          const qx = a[0] + gy * (qy - a[1]) + gz * (qz - a[2]);
          accept(qx + radius / norm, qx, qy, qz);
        }
      }
      for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        const ey = q[1] - p[1], ez = q[2] - p[2], ex = q[0] - p[0], length2 = ey * ey + ez * ez;
        if (length2 < 1e-18) continue;
        const t0 = ((y - p[1]) * ey + (z - p[2]) * ez) / length2;
        const dy0 = y - p[1] - t0 * ey, dz0 = z - p[2] - t0 * ez;
        const s = r2 - dy0 * dy0 - dz0 * dz0;
        if (s < 0) continue;
        const extent = Math.sqrt(s / length2), lo = Math.max(0, t0 - extent), hi = Math.min(1, t0 + extent);
        if (lo > hi) continue;
        const unconstrained = t0 + ex * Math.sqrt(s) / Math.sqrt(length2 * (length2 + ex * ex));
        const t = Math.max(lo, Math.min(hi, unconstrained));
        const qx = p[0] + t * ex, qy = p[1] + t * ey, qz = p[2] + t * ez;
        accept(qx + Math.sqrt(Math.max(0, r2 - (y - qy) ** 2 - (z - qz) ** 2)), qx, qy, qz);
      }
    }
    if (!Number.isFinite(maximum)) throw new Error('Follower misses finite cam face');
    return {x: maximum, point, normal};
  };
}
