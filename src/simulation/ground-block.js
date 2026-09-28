import * as THREE from 'three';

// Brown draws ground, ceilings and walls as an ink line with 45-degree
// hatching: engraving notation for a cut solid. The model shows the solid
// itself: a plain block, its side faces a slightly darker shade of the same
// ground colour so the edges read under any light. No hatch strokes or
// hatch textures are drawn on any face.

// A warm stone, darker than the cream page (#f3f0e9) so the ground reads as a
// solid rather than as blank paper or a hole.
const GROUND_COLOR = 0xbfb6a0;
const SIDE_COLOR = 0xa99f88;

export function groundBlockMaterials() {
  const side = new THREE.MeshStandardMaterial({color: SIDE_COLOR, roughness: 0.92, metalness: 0.02});
  const plain = new THREE.MeshStandardMaterial({color: GROUND_COLOR, roughness: 0.92, metalness: 0.02});
  side.fog = plain.fog = false;
  return {side, plain};
}

// Box of the given size centred at the origin. `spacing` is accepted for
// compatibility with callers written for the old hatch texture and ignored.
export function groundBlock(width, height, depth, {name = 'ground-block', materials = groundBlockMaterials()} = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const {side, plain} = materials;
  const mesh = new THREE.Mesh(geometry, [side, side, plain, plain, side, side]);
  mesh.name = name;
  mesh.userData.role = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}
