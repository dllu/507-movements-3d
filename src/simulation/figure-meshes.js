import * as THREE from 'three';
import { figureMeshes } from './baked/figure-meshes.js';

// Decodes the baked Blender figure parts (hands, horse, walker) into
// indexed BufferGeometry with smooth vertex normals. Decoded arrays are
// cached; each call returns an independent geometry.
const decoded = new Map();

function decodeBase64(text) {
  if (typeof atob === 'function') {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  return Uint8Array.from(Buffer.from(text, 'base64')).buffer;
}

function decode(name) {
  if (decoded.has(name)) return decoded.get(name);
  const part = figureMeshes[name];
  if (!part) throw new Error(`Unknown figure mesh ${name}`);
  const quantized = new Int16Array(decodeBase64(part.position));
  const position = new Float32Array(quantized.length);
  for (let i = 0; i < quantized.length; i += 1) {
    const axis = i % 3;
    position[i] = part.min[axis] + (quantized[i] + 32767) / 65534 * (part.max[axis] - part.min[axis]);
  }
  const index = new Uint16Array(decodeBase64(part.index));
  const entry = { position, index };
  decoded.set(name, entry);
  return entry;
}

export function figureMeshInfo(name) {
  const { position, index, min, max, ...extra } = figureMeshes[name];
  return extra;
}

// `transform(position)` may edit the Float32Array copy before normals are
// computed (for example to fit a grip to a particular rope).
export function figureGeometry(name, transform) {
  const { position, index } = decode(name);
  const geometry = new THREE.BufferGeometry();
  const copy = position.slice();
  if (transform) transform(copy);
  geometry.setAttribute('position', new THREE.BufferAttribute(copy, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
