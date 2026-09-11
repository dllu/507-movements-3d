import * as THREE from 'three';
import { roundedRackGear } from './coaxial-gear-geometry.js';

export function selectorGearGeometry({ teeth, module, depth, boreRadius, backlash, pressureAngle }) {
  const generated = roundedRackGear({ teeth, module, depth, boreRadius, backlash, pressureAngle });
  // Triangulate exactly the Float32 contour that will reach the renderer.
  const clean = values => {
    const points = values.map(v => new THREE.Vector2(Math.fround(v.x), Math.fround(v.y)));
    if (points[0].equals(points.at(-1))) points.pop();
    for (let i = points.length - 1; i >= 0 && points.length > 3; i -= 1) {
      const a = points[(i + points.length - 1) % points.length], b = points[i], c = points[(i + 1) % points.length];
      if ((b.x - a.x) * (c.y - b.y) === (b.y - a.y) * (c.x - b.x)) points.splice(i, 1);
    }
    return points;
  };
  const outline = clean(generated.userData.outline);
  if (!THREE.ShapeUtils.isClockWise(outline)) outline.reverse();
  const shape = new THREE.Shape(outline);
  const bore = clean(Array.from({ length: 512 }, (_, i) => new THREE.Vector2(boreRadius * Math.cos(2 * Math.PI * i / 512), boreRadius * Math.sin(2 * Math.PI * i / 512))));
  if (THREE.ShapeUtils.isClockWise(bore)) bore.reverse();
  shape.holes.push(new THREE.Path(bore));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
  geometry.userData = generated.userData; generated.dispose(); return geometry;
}
