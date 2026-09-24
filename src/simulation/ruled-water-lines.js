import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { matte } from './primitives.js';

// Ink-blue for ruled water strokes (fog off, as the plates have none). The
// strokes are marked slightly translucent, the convention the solid-clearance
// checks use to tell water from working parts.
export function ruledWaterMaterial() {
  const material = matte(0x2f7f93, { roughness: 0.5, transparent: true, opacity: 0.92 });
  material.fog = false;
  return material;
}

// Brown rules open water as broken horizontal strokes rather than a solid
// body. This builds those strokes as thin bars in the local x-y plane (lines
// run along x, rows step down in y), all at local z = 0 unless `depth` is
// given, deterministic for a given seed. With `bottomUp` the rows are merged
// from the lowest upward and geometry.userData.rowTops lists, per row, its
// y and the vertex count up to and including it, so a caller can show only
// the rows below a varying water level with setDrawRange.
export function ruledWaterLines({
  xMin,
  xMax,
  surfaceY,
  rows = 8,
  spacing = 0.18,
  thickness = 0.035,
  depth = 0.02,
  dash = [0.55, 1.5],
  gap = [0.12, 0.45],
  seed = 1,
  bottomUp = false,
}) {
  let state = seed >>> 0 || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const parts = [];
  const rowTops = [];
  let vertexCount = 0;
  for (let index = 0; index < rows; index += 1) {
    const row = bottomUp ? rows - 1 - index : index;
    const y = surfaceY - row * spacing;
    // The surface stroke is nearly continuous; lower rows break up more.
    const rowGap = row === 0 ? [gap[0] * 0.5, gap[0]] : gap;
    let x = xMin + (row === 0 ? 0 : random() * (dash[0] + rowGap[1]));
    while (x < xMax) {
      const length = Math.min(xMax - x, dash[0] + random() * (dash[1] - dash[0]));
      if (length > 0.05) {
        const bar = new THREE.BoxGeometry(length, thickness, depth);
        bar.translate(x + length / 2, y, 0);
        const flat = bar.toNonIndexed();
        parts.push(flat);
        vertexCount += flat.attributes.position.count;
        bar.dispose();
      }
      x += length + rowGap[0] + random() * (rowGap[1] - rowGap[0]);
    }
    rowTops.push({ y, vertexCount });
  }
  const merged = mergeGeometries(parts);
  merged.userData.rowTops = rowTops;
  for (const part of parts) part.dispose();
  return merged;
}
