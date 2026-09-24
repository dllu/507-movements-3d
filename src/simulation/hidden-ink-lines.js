// Brown's hidden-line notation: parts behind a nearer part are drawn as thin,
// dark, evenly dashed outlines with no fill. WebGL lines are one pixel wide,
// so each line is drawn as several parallel one-pixel strands (closer than a
// device pixel at the viewer's pixel ratio of 2) that share the
// centre line's dash distances; the strands stay in step on curves and read
// as one ink stroke about two pixels wide.
import * as THREE from 'three';
import { PALETTE } from './primitives.js';

export function hiddenInkLineMaterial({
  color = PALETTE.ink,
  dashSize = 0.07,
  gapSize = 0.045,
} = {}) {
  return new THREE.LineDashedMaterial({
    color,
    dashSize,
    fog: false,
    gapSize,
    // Exact ink, not lifted by the scene's filmic tone mapping.
    toneMapped: false,
  });
}

// A dashed ink line through planar points [x, y] at depth z. `closed` joins
// the last point to the first. The dash period is stretched slightly so a
// closed loop holds a whole number of dashes and an open run starts and ends
// on a dash. `anchor: 'end'` counts the dashes from the last point instead,
// so a line whose far end moves keeps its dashes steady at the near end;
// give such a line `fitDashes: false` so its dash length never jumps.
// Call `line.userData.setPoints(points)` to move it (same point count).
export function makeHiddenInkLine(points, {
  anchor = 'start',
  closed = false,
  dashSize = 0.07,
  fitDashes = true,
  gapSize = 0.045,
  material = null,
  role = 'dashed-hidden-ink-line',
  strands = 6,
  width = 0.012,
  z = 0,
} = {}) {
  const count = points.length;
  const segmentCount = closed ? count : count - 1;
  const perStrand = segmentCount * 2;
  const positions = new Float32Array(perStrand * strands * 3);
  const distances = new Float32Array(perStrand * strands);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineDistance', new THREE.BufferAttribute(distances, 1));
  const line = new THREE.LineSegments(
    geometry,
    material ?? hiddenInkLineMaterial({ dashSize, gapSize }),
  );
  const period = dashSize + gapSize;
  const setPoints = (next) => {
    if (next.length !== count) throw new RangeError('hidden ink line point count changed');
    const at = (index) => next[(index + count) % count];
    const along = [0];
    for (let index = 1; index <= segmentCount; index += 1) {
      const a = at(index - 1);
      const b = at(index);
      along.push(along[index - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const length = along[segmentCount];
    // Whole dashes: a loop holds n periods; an open run n periods plus a dash.
    const span = closed ? length : length - dashSize;
    const repeats = Math.max(1, Math.round(span / period));
    const scale = fitDashes && length > 0 ? period * repeats / Math.max(span, 1e-9) : 1;
    const distanceAt = (index) => (anchor === 'end' ? length - along[index] : along[index]) * scale;
    // Unit normals at each point (averaged at corners).
    const normals = Array.from({ length: count }, (_, index) => {
      const before = !closed && index === 0 ? at(0) : at(index - 1);
      const after = !closed && index === count - 1 ? at(count - 1) : at(index + 1);
      const tx = after[0] - before[0];
      const ty = after[1] - before[1];
      const size = Math.hypot(tx, ty) || 1;
      return [-ty / size, tx / size];
    });
    let cursor = 0;
    for (let strand = 0; strand < strands; strand += 1) {
      const offset = strands > 1 ? width * (strand / (strands - 1) - 0.5) : 0;
      for (let index = 0; index < segmentCount; index += 1) {
        for (const end of [index, index + 1]) {
          const point = at(end);
          const normal = normals[end % count];
          positions[cursor * 3] = point[0] + normal[0] * offset;
          positions[cursor * 3 + 1] = point[1] + normal[1] * offset;
          positions[cursor * 3 + 2] = z;
          distances[cursor] = distanceAt(end);
          cursor += 1;
        }
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.lineDistance.needsUpdate = true;
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
  };
  setPoints(points);
  line.renderOrder = 2;
  line.userData.role = role;
  line.userData.hiddenInkLine = true;
  line.userData.setPoints = setPoints;
  return line;
}
