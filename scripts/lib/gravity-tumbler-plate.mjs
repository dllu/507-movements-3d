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

export function makeGravityTumblerPlate({ bore = 0.425, depth = 0.22, curveSegments = 256 } = {}) {
  const { anchor, scale, start, curves } = tumblerSource;
  const point = ([x, y]) => [(x - anchor[0]) / scale, (anchor[1] - y) / scale];
  const shape = new THREE.Shape(); shape.moveTo(...point(start));
  for (const controls of curves) shape.bezierCurveTo(...controls.flatMap(point));
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
    geometry: new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments }),
    contours, area, centroid: [firstX / area, firstY / area], polarInertiaPerMass: polar / area,
  };
}
