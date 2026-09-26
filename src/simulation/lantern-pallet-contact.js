// Finite planar reconstruction for Brown 297. The native collision spheres have
// the same XY support as the visible axial cylinders; neither body has a Z DOF.
export const lanternContact297 = {
  period: 4, amplitude: Math.PI / 10, pitch: Math.PI / 4,
  pivot: [113 * 3 / 190, 239 * 3 / 190],
  orbit: 151 * 3 / 190, pinRadius: 22 * 3 / 190,
  depth: .28, palletZ: 1.00, armZ: 1.49,
  bars: [
    { name: 'B', center: [20 * 3 / 190 + .25 * Math.cos(46 * Math.PI / 180),
      -127 * 3 / 190 + .25 * Math.sin(46 * Math.PI / 180)], angle: 46 * Math.PI / 180, length: 1.5, width: .18 },
    { name: 'C', center: [-30 * 3 / 190, -194 * 3 / 190], angle: -28 * Math.PI / 180, length: 1.28, width: .18 },
  ],
};
export const rotate297 = ([x, y], a) => [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];
export function armState297(time) {
  const w = 2 * Math.PI / lanternContact297.period, a = lanternContact297.amplitude;
  return { angle: -a * Math.cos(w * time), speed: a * w * Math.sin(w * time), acceleration: a * w * w * Math.cos(w * time) };
}
export function finiteContacts297(wheelAngle, armAngle) {
  const c = lanternContact297, hits = [];
  for (let pin = 0; pin < 8; pin++) {
    const a = wheelAngle + pin * c.pitch, p = [c.orbit * Math.cos(a), c.orbit * Math.sin(a)];
    const armPoint = rotate297([p[0] - c.pivot[0], p[1] - c.pivot[1]], -armAngle);
    for (const bar of c.bars) {
      const q = rotate297([armPoint[0] - bar.center[0], armPoint[1] - bar.center[1]], -bar.angle);
      const closest = [Math.max(-bar.length / 2, Math.min(bar.length / 2, q[0])), Math.max(-bar.width / 2, Math.min(bar.width / 2, q[1]))];
      const dx = q[0] - closest[0], dy = q[1] - closest[1], distance = Math.hypot(dx, dy);
      const normal = rotate297(distance ? [dx / distance, dy / distance] : [0, 1], bar.angle + armAngle);
      const point = [p[0] - normal[0] * distance, p[1] - normal[1] * distance];
      hits.push({ pin, bar: bar.name, q, closest, gap: distance - c.pinRadius, normal, point,
        moment: p[0] * normal[1] - p[1] * normal[0],
        end: Math.abs(q[0]) >= bar.length / 2 - 1e-8 });
    }
  }
  return hits.sort((a, b) => a.gap - b.gap);
}
// Remove only the native solver's small soft-contact overlap, offline. This is
// a configuration projection onto the actual finite bars, not a new drive law.
export function projectLanternPose297(wheelAngle, armAngle, clearance = .00012) {
  let angle = wheelAngle;
  for (let i = 0; i < 12; i++) {
    const h = finiteContacts297(angle, armAngle)[0];
    if (h.gap >= clearance - 1e-11) return angle;
    if (Math.abs(h.moment) < .02) throw new Error('297 projection near a singular contact');
    angle += (clearance - h.gap) / h.moment;
  }
  throw new Error('297 finite contact projection did not converge');
}
