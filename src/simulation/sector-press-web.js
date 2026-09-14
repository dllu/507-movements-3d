import * as THREE from 'three';
import clip from 'polygon-clipping';

// Opening coordinates traced from public/engravings/mm_133.png (525 × 525).
// Normalize the engraving's approximately 184 px root radius to the retained gear.
export function sectorPressWebShape({ radius, startAngle, endAngle, pinRadius, boreRadius = 0 }) {
  const scale = radius / 184;
  const upper = new THREE.Path();
  upper.moveTo(245, 322);
  upper.bezierCurveTo(245, 303, 254, 307, 267, 311);
  upper.bezierCurveTo(291, 317, 319, 332, 333, 344);
  upper.quadraticCurveTo(338, 350, 330, 358);
  upper.lineTo(259, 419);
  upper.quadraticCurveTo(245, 429, 244, 413);
  upper.closePath();
  const lower = new THREE.Path();
  lower.moveTo(293, 434);
  lower.lineTo(344, 381);
  lower.bezierCurveTo(355, 370, 362, 371, 370, 385);
  lower.bezierCurveTo(383, 404, 393, 438, 391, 453);
  lower.quadraticCurveTo(391, 463, 381, 463);
  lower.lineTo(302, 463);
  lower.quadraticCurveTo(284, 462, 293, 434);
  lower.closePath();
  const openings = [upper, lower].map(path => path.getPoints(32).map(p => [
    (p.x - 231) * scale, (466 - p.y) * scale,
  ]));
  const circle = (x, r) => Array.from({ length: 129 }, (_, i) => [
    x + r * Math.cos(i * Math.PI / 64), r * Math.sin(i * Math.PI / 64),
  ]);
  const outer = [[0, 0], ...Array.from({ length: 129 }, (_, i) => {
    const a = startAngle + (endAngle - startAngle) * i / 128;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  }), [0, 0]];
  const web = clip.union(
    clip.difference([outer], ...openings.map(ring => [ring])),
    [circle(0, .2625)],
    // The animation places this pin farther out than the engraving: preserve
    // its kinematics while giving it a continuous, finite mounting boss.
    [circle(pinRadius, .20)],
  );
  if (web.length !== 1) throw Error('Sector web must be one connected solid');
  const shape = new THREE.Shape(web[0][0].map(p => new THREE.Vector2(...p)));
  for (const ring of web[0].slice(1)) {
    shape.holes.push(new THREE.Path(ring.map(p => new THREE.Vector2(...p))));
  }
  if (boreRadius > 0) {
    const bore = new THREE.Path();
    bore.absarc(0, 0, boreRadius, 0, 2 * Math.PI, true);
    shape.holes.push(bore);
  }
  return shape;
}
