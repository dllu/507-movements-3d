import { CatmullRomCurve3, Vector3 } from 'three';

const turn = 2 * Math.PI, mod = (a, b) => ((a % b) + b) % b;
const rotate = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

export const springRatchetSource = {
  center: [711.0938786026236, 589.3988765107598], scale: 267.22413244806916,
  driverRadius: 407.1636004104752, toothCount: 10,
  meanTipPhase: 107.18198988198543 * Math.PI / 180,
  flankCenter: [641.6912791189311, 522.1771458539845], flankRadius: 193.25023699018465,
  catchCenterline: [[728,251],[813,270],[900,312],[976,380],[1022,451],[1059,540]],
  strongCenterline: [[303,1140],[290,1100],[278.25,1020],[273,940],[279.25,860],
    [295.25,780],[336,680],[372,620],[416.5,560],[474.5,500],[515,465]],
  // The fixed leaf tapers in the source. Thirty pixels is an initial effective
  // width for the contact study; a finished model must retain the measured taper.
  catchWidth: 20, strongWidth: 30,
};
export const sourcePoint = point => [(point[0] - springRatchetSource.center[0]) / springRatchetSource.scale,
  (springRatchetSource.center[1] - point[1]) / springRatchetSource.scale];

export function makeSourceSpring(kind, segments = 32) {
  const readings = springRatchetSource[kind + 'Centerline'];
  if (!readings) throw new Error('Unknown source spring: ' + kind);
  const curve = new CatmullRomCurve3(readings.map(point => new Vector3(...sourcePoint(point), 0)), false, 'centripetal');
  const points = curve.getSpacedPoints(segments).map(p => [p.x, p.y]);
  const lengths = [], angles = [];
  for (let i = 1; i < points.length; i++) {
    const delta = sub(points[i], points[i-1]); lengths.push(Math.hypot(...delta)); angles.push(Math.atan2(delta[1], delta[0]));
  }
  return { kind, points, lengths, angles, width: springRatchetSource[kind + 'Width'] / springRatchetSource.scale,
    length: lengths.reduce((a, b) => a + b, 0) };
}

// A regular ten-tooth wheel uses the measured circular flank. The source tips
// have slightly uneven spacing; this rotates that flank to their mean phase.
// A two-degree interval is reserved for the short, steep tooth face.
export function makeSourceRatchet({ samples = 128, faceInterval = 2 * Math.PI / 180 } = {}) {
  const source = springRatchetSource, pitch = turn / source.toothCount, radius = source.flankRadius / source.scale;
  const measuredCenter = sourcePoint(source.flankCenter), length = Math.hypot(...measuredCenter);
  const centerAngle = Math.atan2(measuredCenter[1], measuredCenter[0]);
  const intersectionAngle = centerAngle - Math.acos((1 + length * length - radius * radius) / (2 * length));
  const adjustment = source.meanTipPhase - intersectionAngle, center = rotate(measuredCenter, adjustment);
  const tipAngle = source.meanTipPhase, rootAngle = tipAngle - pitch + faceInterval;
  const radiusOnArc = angle => {
    const projection = center[0] * Math.cos(angle) + center[1] * Math.sin(angle);
    return projection + Math.sqrt(radius * radius - length * length + projection * projection);
  };
  const tip = [Math.cos(tipAngle), Math.sin(tipAngle)];
  const rootRadius = radiusOnArc(rootAngle), root = [rootRadius * Math.cos(rootAngle), rootRadius * Math.sin(rootAngle)];
  const nextTip = rotate(tip, -pitch), arcStart = Math.atan2(tip[1] - center[1], tip[0] - center[0]);
  const arcEnd = Math.atan2(root[1] - center[1], root[0] - center[0]);
  const arcSpan = mod(arcStart - arcEnd, turn), points = [], features = [];
  for (let tooth = 0; tooth < source.toothCount; tooth++) {
    const angle = -tooth * pitch;
    const c = rotate(center, angle), a = rotate(tip, angle), b = rotate(root, angle), next = rotate(nextTip, angle);
    features.push({ tooth, type: 'arc', center: c, radius, start: arcStart + angle, span: arcSpan, a, b });
    features.push({ tooth, type: 'face', a: b, b: next });
    for (let i = 0; i <= samples; i++) {
      const alpha = arcStart + angle - arcSpan * i / samples;
      points.push([c[0] + radius * Math.cos(alpha), c[1] + radius * Math.sin(alpha)]);
    }
  }
  const radiusAt = angle => {
    const travel = mod(tipAngle - angle, pitch), localAngle = tipAngle - travel;
    if (travel <= pitch - faceInterval) return radiusOnArc(localAngle);
    const unit = [Math.cos(localAngle), Math.sin(localAngle)], edge = sub(nextTip, root);
    return cross(root, edge) / cross(unit, edge);
  };
  const closest = point => {
    let best = Infinity, result;
    for (const feature of features) {
      let candidate;
      if (feature.type === 'face') {
        const edge = sub(feature.b, feature.a), v = sub(point, feature.a);
        const fraction = Math.max(0, Math.min(1, (v[0] * edge[0] + v[1] * edge[1]) / (edge[0]**2 + edge[1]**2)));
        candidate = [feature.a[0] + edge[0] * fraction, feature.a[1] + edge[1] * fraction];
      } else {
        const angle = Math.atan2(point[1] - feature.center[1], point[0] - feature.center[0]);
        if (mod(feature.start - angle, turn) <= feature.span) {
          candidate = [feature.center[0] + radius * Math.cos(angle), feature.center[1] + radius * Math.sin(angle)];
        } else candidate = Math.hypot(...sub(point, feature.a)) < Math.hypot(...sub(point, feature.b)) ? feature.a : feature.b;
      }
      const delta = sub(point, candidate), distance = Math.hypot(...delta);
      if (distance < best) { best = distance; result = { point: candidate, feature: feature.type, tooth: feature.tooth, delta }; }
    }
    const inside = Math.hypot(...point) < radiusAt(Math.atan2(point[1], point[0]));
    const sign = inside ? -1 : 1;
    return { ...result, distance: best, signedDistance: sign * best,
      normal: best > 1e-12 ? result.delta.map(x => sign * x / best) : null };
  };
  return { points, features, pitch, radius, center, rootRadius, tipAngle, faceInterval, adjustment, radiusAt, closest };
}
