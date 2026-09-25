import * as THREE from 'three';

// Brown draws ground, ceilings and walls as an ink line with 45-degree
// hatching: engraving notation for a cut solid. A flat sheet of stroke boxes
// reads as a comb once the view rotates, so render the cut solid itself: a
// plain block whose side faces carry a faint procedural hatch texture (the
// top/bottom faces stay plain). The texture is a DataTexture so offline
// Node reviews and the browser build the same material.

const GROUND_COLOR = 0xe2ddd1;
const HATCH_COLOR = 0xaaa497;
let hatchTexture = null;

function makeHatchTexture() {
  const size = 64, width = 7, data = new Uint8Array(size * size * 4);
  const base = new THREE.Color(GROUND_COLOR), ink = new THREE.Color(HATCH_COLOR);
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      // Distance (in texels) to the nearest "\" diagonal i + j = 0 mod size.
      const k = (i + j + 0.5) % size, d = Math.min(k, size - k) / Math.SQRT2;
      const t = THREE.MathUtils.clamp(width / 2 - d + 0.5, 0, 1);
      const c = base.clone().lerp(ink, t), o = 4 * (j * size + i);
      data[o] = Math.round(c.r * 255); data[o + 1] = Math.round(c.g * 255);
      data[o + 2] = Math.round(c.b * 255); data[o + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function groundBlockMaterials() {
  hatchTexture ??= makeHatchTexture();
  const side = new THREE.MeshStandardMaterial({color: 0xffffff, map: hatchTexture, roughness: 0.92, metalness: 0.02});
  const plain = new THREE.MeshStandardMaterial({color: GROUND_COLOR, roughness: 0.92, metalness: 0.02});
  side.fog = plain.fog = false;
  return {side, plain};
}

// Box of the given size centred at the origin. `spacing` is the world
// distance between hatch lines. Box-projected UVs keep the 45-degree hatch
// and its spacing identical on every side face regardless of block size.
export function groundBlock(width, height, depth, {spacing = 0.16, name = 'ground-block', materials = groundBlockMaterials()} = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const nx = normal.getX(i), nz = normal.getZ(i);
    const u = Math.abs(nx) > 0.5 ? -z * Math.sign(nx) : Math.abs(nz) > 0.5 ? x * Math.sign(nz) : x;
    uv.setXY(i, u / spacing, (Math.abs(normal.getY(i)) > 0.5 ? z : y) / spacing);
  }
  uv.needsUpdate = true;
  const {side, plain} = materials;
  const mesh = new THREE.Mesh(geometry, [side, side, plain, plain, side, side]);
  mesh.name = name;
  mesh.userData.role = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}
