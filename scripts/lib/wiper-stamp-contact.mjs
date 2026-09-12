// Vertical support envelope of the actual Float32 cam cap boundary. No
// prescribed lift curve or point/sphere follower is used in this study.
export function makeWiperStampContact(model) {
  const u = model.root.userData, geometry = u.parts.twoWipers.geometry, positions = geometry.attributes.position, edges = new Map();
  const key = p => p.join(',');
  for (let i = 0; i < positions.count; i += 3) {
    const triangle = [0, 1, 2].map(j => [positions.getX(i+j), positions.getY(i+j), positions.getZ(i+j)]);
    if (!triangle.every(p => p[2] === 0)) continue;
    for (let j = 0; j < 3; j++) {
      const a = triangle[j].slice(0, 2), b = triangle[(j+1)%3].slice(0, 2), id = [key(a), key(b)].sort().join('/');
      const edge = edges.get(id) ?? {a, b, count: 0}; edge.count++; edges.set(id, edge);
    }
  }
  const boundary = [...edges.values()].filter(e => e.count === 1).map(({a,b}, index) => ({a,b,index}));
  if (!boundary.length) throw Error('Missing finite cam boundary');
  const pad = u.geometry.projection;
  const support = angle => {
    const c = Math.cos(angle), s = Math.sin(angle), rotate = p => [c*p[0]-s*p[1], s*p[0]+c*p[1]];
    let best = null;
    for (const edge of boundary) {
      const a = rotate(edge.a), b = rotate(edge.b), dx = b[0]-a[0], dy = b[1]-a[1], length = Math.hypot(dx,dy);
      // The downward-facing cap has clockwise outer edges: the left normal
      // points out of the metal. Downward-facing edges cannot support B.
      const normal = [-dy/length, dx/length]; if (normal[1] <= 1e-10) continue;
      let low = 0, high = 1;
      if (Math.abs(dx) < 1e-14) {if (a[0] < pad.left || a[0] > pad.right) continue;}
      else {
        const t0 = (pad.left-a[0])/dx, t1 = (pad.right-a[0])/dx;
        low = Math.max(low, Math.min(t0,t1)); high = Math.min(high, Math.max(t0,t1));
        if (low > high) continue;
      }
      const parameter = dy > 0 ? high : low, point = [a[0]+parameter*dx,a[1]+parameter*dy], height = point[1]-pad.bottom;
      if (!best || height > best.height + 1e-12 || (Math.abs(height-best.height)<1e-12 && normal[1]>best.normal[1]))
        best = {height, point, normal, edge: edge.index, parameter};
    }
    // Inside B's span its flat bottom admits a vertical normal only. At a
    // cam tip this lies in the cone of the two neighboring cam-face normals.
    // At a corner of B, the sloping cam face supplies the shared normal.
    if (best && best.point[0] > pad.left + 1e-10 && best.point[0] < pad.right - 1e-10) best.normal = [0, 1];
    return best;
  };
  return {boundary, support};
}
