import * as THREE from 'three';

export const tumblerSource = {
  anchor: [690, 725], scale: 280 / 1.375, start: [193, 704],
  curves: [
    [[206, 471], [420, 240], [661, 238]],
    [[935, 222], [1187, 435], [1182, 727]],
    [[1181, 798], [1160, 877], [1136, 928]],
    [[1083, 929], [1055, 891], [1044, 848]],
    [[1027, 782], [985, 721], [930, 727]],
    [[853, 722], [814, 749], [773, 795]],
    [[735, 839], [711, 853], [671, 850]],
    [[613, 852], [578, 820], [555, 758]],
    [[523, 670], [490, 622], [435, 625]],
    [[369, 624], [333, 650], [316, 673]],
    [[284, 700], [228, 706], [193, 704]],
  ],
};

// Green's theorem on the same sampled boundary used by the extrusion.
// Normalize each contour's orientation: holes subtract area and moments.
function polygonMoments(points, sign) {
  let area = 0, firstX = 0, firstY = 0, polar = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross / 2;
    firstX += (a.x + b.x) * cross / 6;
    firstY += (a.y + b.y) * cross / 6;
    polar += (a.x * a.x + a.x * b.x + b.x * b.x
      + a.y * a.y + a.y * b.y + b.y * b.y) * cross / 12;
  }
  const orientation = sign * Math.sign(area);
  return [area, firstX, firstY, polar].map(value => value * orientation);
}

// Brown draws E symmetric about a line through the shaft centre, turned
// 13.5 degrees clockwise from vertical in the plate's pose: the two horn tips
// sit at the same radius (2.44, 2.41) either side of it, and the scalloped
// inner edge has one central hollow flanked by matching lobes. The freehand
// trace is not quite symmetric, so the outline is its mirror average about
// that axis (the best-fitting mirror line of the trace, 76.5 degrees from +X).
export const TUMBLER_SYMMETRY_AXIS = 76.5 * Math.PI / 180;

function sampledTrace(samplesPerCurve) {
  const { anchor, scale, start, curves } = tumblerSource;
  const point = ([x, y]) => new THREE.Vector2((x - anchor[0]) / scale, (anchor[1] - y) / scale);
  const points = [point(start)], corners = [0];
  let previous = points[0];
  for (const controls of curves) {
    const [a, b, c] = controls.map(point);
    points.push(...new THREE.CubicBezierCurve(previous, a, b, c).getSpacedPoints(samplesPerCurve).slice(1));
    corners.push(points.length - 1); previous = c;
  }
  points.pop(); // the closing point repeats the left horn tip
  return { points, rightTip: corners[3] };
}

// Resample a polyline to n points evenly spaced in arc length.
function resample(points, n) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = lengths.at(-1), out = [];
  for (let k = 0, j = 1; k < n; k++) {
    const target = total * k / (n - 1);
    while (j < points.length - 1 && lengths[j] < target) j++;
    const t = (target - lengths[j - 1]) / Math.max(1e-12, lengths[j] - lengths[j - 1]);
    out.push(points[j - 1].clone().lerp(points[j], THREE.MathUtils.clamp(t, 0, 1)));
  }
  return out;
}

// The symmetric outline: from the back's crossing of the axis over the right
// horn and along the scalloped edge to the central hollow, then the mirror
// image of that half back to the start.
export function symmetricTumblerOutline(samples = 256) {
  const { points, rightTip } = sampledTrace(400);
  const axis = new THREE.Vector2(Math.cos(TUMBLER_SYMMETRY_AXIS), Math.sin(TUMBLER_SYMMETRY_AXIS));
  const mirror = (q) => axis.clone().multiplyScalar(2 * q.dot(axis)).sub(q);
  const side = (q) => axis.x * q.y - axis.y * q.x; // > 0 left of the axis
  // Where the back and the scalloped edge cross the axis.
  const crossing = (from, to) => {
    for (let i = from; i < to; i++) if (side(points[i]) >= 0 && side(points[i + 1]) < 0) return i + 1;
    throw new Error('tumbler outline does not cross its axis');
  };
  const top = crossing(0, rightTip);
  let dip = -1;
  for (let i = rightTip; i < points.length - 1; i++) if (side(points[i]) <= 0 && side(points[i + 1]) > 0) { dip = i + 1; break; }
  if (dip < 0) throw new Error('tumbler inner edge does not cross its axis');
  const leftBack = resample(points.slice(0, top + 1), samples).reverse();
  const rightBack = resample(points.slice(top, rightTip + 1), samples);
  const rightEdge = resample(points.slice(rightTip, dip + 1), samples);
  const leftEdge = resample([...points.slice(dip), points[0]], samples).reverse();
  // Right half: average of the right trace and the mirrored left trace.
  const back = rightBack.map((q, i) => q.clone().add(mirror(leftBack[i])).multiplyScalar(0.5));
  const edge = rightEdge.map((q, i) => q.clone().add(mirror(leftEdge[i])).multiplyScalar(0.5));
  // Both halves meet the axis exactly.
  for (const q of [back[0], edge.at(-1)]) q.copy(axis.clone().multiplyScalar(q.dot(axis)));
  const right = [...back, ...edge.slice(1)];
  const left = right.slice(1, -1).reverse().map(mirror);
  return [...right, ...left];
}

export function gravityTumblerPlateProfile({ bore = 0.425, curveSegments = 256 } = {}) {
  const shape = new THREE.Shape(symmetricTumblerOutline(curveSegments));
  shape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, bore, 0, 2 * Math.PI, false);
  shape.holes.push(hole);
  const contours = shape.extractPoints(curveSegments);
  const totals = polygonMoments(contours.shape, 1);
  for (const path of contours.holes) {
    const moments = polygonMoments(path, -1);
    for (let i = 0; i < totals.length; i++) totals[i] += moments[i];
  }
  const [area, firstX, firstY, polar] = totals;
  if (!(area > 0 && polar > 0)) throw new Error('Invalid tumbler plate mass properties');
  return {
    shape, contours, area, centroid: [firstX / area, firstY / area], polarInertiaPerMass: polar / area,
  };
}

export function makeGravityTumblerPlate(options = {}) {
  const profile = gravityTumblerPlateProfile(options);
  const { depth = 0.22, curveSegments = 256 } = options;
  return { ...profile, geometry: new THREE.ExtrudeGeometry(profile.shape, { depth, bevelEnabled: false, curveSegments }) };
}
