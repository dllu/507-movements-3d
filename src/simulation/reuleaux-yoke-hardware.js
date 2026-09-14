import * as THREE from 'three';

export function bowedValveYoke({innerHalfWidth, innerHalfHeight, outerHalfWidth, outerHalfHeight}) {
  const shape = new THREE.Shape();
  shape.moveTo(-outerHalfWidth, outerHalfHeight);
  shape.lineTo(outerHalfWidth, outerHalfHeight);
  shape.quadraticCurveTo(outerHalfWidth + .60, 0, outerHalfWidth, -outerHalfHeight);
  shape.lineTo(-outerHalfWidth, -outerHalfHeight);
  shape.quadraticCurveTo(-outerHalfWidth - .60, 0, -outerHalfWidth, outerHalfHeight);
  const hole = new THREE.Path();
  hole.moveTo(-innerHalfWidth, innerHalfHeight);
  hole.quadraticCurveTo(-innerHalfWidth - .32, 0, -innerHalfWidth, -innerHalfHeight);
  hole.lineTo(innerHalfWidth, -innerHalfHeight);
  hole.quadraticCurveTo(innerHalfWidth + .32, 0, innerHalfWidth, innerHalfHeight);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

export function rectangularGuideShoe() {
  const shape = new THREE.Shape([
    new THREE.Vector2(-.14, -.16), new THREE.Vector2(.14, -.16),
    new THREE.Vector2(.14, .16), new THREE.Vector2(-.14, .16),
  ]);
  const hole = new THREE.Path([
    new THREE.Vector2(-.075, -.105), new THREE.Vector2(-.075, .105),
    new THREE.Vector2(.075, .105), new THREE.Vector2(.075, -.105),
  ]);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: .62, bevelEnabled: false});
  geometry.translate(0, 0, -.31);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
