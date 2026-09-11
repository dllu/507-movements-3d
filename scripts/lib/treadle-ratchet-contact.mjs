import {add, sub, rotate} from '../../src/simulation/finite-plate-geometry.js';
import {finitePolygon, dot, cross, mul} from '../../src/simulation/finite-polygon-contact.js';

// These are the cleaned, float32 outlines used by the extruded meshes. Bore
// clearance is a separate hardware constraint; primary contact uses the rim.
export function makeTreadleRatchetContact(candidate) {
  const u = candidate.root.userData;
  const profiles = Object.fromEntries(['wheel', 'lower', 'upper'].map(key => {
    const mesh = u.parts[key === 'wheel' ? 'ratchetBody' : key + 'PawlBody'];
    const shapes = mesh.geometry.parameters.shapes;
    if (shapes.length !== 1) throw Error('Expected one connected contact body');
    const profile = finitePolygon(shapes[0].getPoints(1).map(p => [p.x, p.y]));
    profile.convex = profile.edges.map((edge, i, edges) =>
      cross(edges[(i + edges.length - 1) % edges.length].d, edge.d) >= 0);
    return [key, profile];
  }));

  function features(profile, point, nearest, padding) {
    const count = profile.points.length;
    for (const vertex of [nearest.index, (nearest.index + 1) % count]) {
      if (profile.convex[vertex]) continue;
      const previous = profile.edges[(vertex + count - 1) % count];
      const next = profile.edges[vertex];
      const radius = Math.min(padding, previous.length / 4, next.length / 4);
      if (Math.hypot(...sub(point, profile.points[vertex])) > radius) continue;
      return [previous, next].map(edge => {
        const gap = dot(sub(point, edge.a), edge.normal);
        return {id: 'V' + vertex + 'E' + edge.index, gap, normal: edge.normal,
          point: sub(point, mul(edge.normal, gap))};
      });
    }
    if (nearest.fraction > 0 && nearest.fraction < 1) {
      const normal = nearest.edge.normal;
      const gap = dot(sub(point, nearest.edge.a), normal);
      return [{id: 'E' + nearest.index, gap, normal, point: sub(point, mul(normal, gap))}];
    }
    return [{...nearest, id: 'E' + nearest.index}];
  }

  function pair(key, pivot, theta, alpha, padding = .003) {
    const wheel = profiles.wheel, pawl = profiles[key], rows = [];
    let minimumGap = Infinity;
    const keep = (id, feature, normal, W, H) => {
      minimumGap = Math.min(minimumGap, feature.gap);
      if (feature.gap > padding) return;
      rows.push({id: key + ':' + id, key, gap: feature.gap, normal,
        wheelPoint: W, pawlPoint: H,
        J: [-cross(W, normal), cross(sub(H, pivot), normal)]});
    };
    for (let i = 0; i < pawl.points.length; i++) {
      const H = add(pivot, rotate(pawl.points[i], alpha));
      const local = rotate(H, -theta), near = wheel.closest(local);
      minimumGap = Math.min(minimumGap, near.gap);
      if (!pawl.convex[i]) continue;
      for (const f of features(wheel, local, near, padding)) {
        keep('H' + i + 'W' + f.id, f, rotate(f.normal, theta), rotate(f.point, theta), H);
      }
    }
    const center = add(pivot, rotate(pawl.center, alpha));
    for (let i = 0; i < wheel.points.length; i++) {
      const W = rotate(wheel.points[i], theta);
      if (Math.hypot(...sub(W, center)) - pawl.radius > Math.max(padding, minimumGap)) continue;
      const local = rotate(sub(W, pivot), -alpha), near = pawl.closest(local);
      minimumGap = Math.min(minimumGap, near.gap);
      if (!wheel.convex[i]) continue;
      for (const f of features(pawl, local, near, padding)) {
        keep('W' + i + 'H' + f.id, f, mul(rotate(f.normal, alpha), -1), W, add(pivot, rotate(f.point, alpha)));
      }
    }
    return {rows, minimumGap};
  }

  // Seat once at startup, by approaching the first surface from outside.
  // The dynamic solver must carry the free angles thereafter.
  function seat(key, pivot, theta, {lower = -.7, upper = .35, steps = 100} = {}) {
    let previous = lower, gap = pair(key, pivot, theta, lower, 0).minimumGap;
    if (gap < 0) return {okay: false, reason: 'opening-bracket-penetrates', gap};
    for (let i = 1; i <= steps; i++) {
      const next = lower + (upper - lower) * i / steps;
      gap = pair(key, pivot, theta, next, 0).minimumGap;
      if (gap <= 0) {
        let lo = previous, hi = next;
        for (let j = 0; j < 40; j++) {
          const mid = (lo + hi) / 2;
          if (pair(key, pivot, theta, mid, 0).minimumGap > 0) lo = mid;
          else hi = mid;
        }
        const alpha = lo, result = pair(key, pivot, theta, alpha, 1e-7);
        const maximumDisplacement = Math.max(...profiles[key].points.map(v => Math.hypot(...sub(rotate(v, alpha), v))));
        return {okay: true, alpha, maximumDisplacement, ...result};
      }
      previous = next;
    }
    return {okay: false, reason: 'no-closing-contact', gap};
  }
  return {profiles, pair, seat};
}
