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
  // Parts with several materials (a horse leg and its hoof) list where each
  // later material's triangles start in the index.
  const starts = figureMeshes[name].groupStarts;
  if (starts?.length) {
    const bounds = [0, ...starts, index.length];
    for (let k = 0; k + 1 < bounds.length; k += 1) {
      geometry.addGroup(bounds[k], bounds[k + 1] - bounds[k], k);
    }
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// A limb modelled straight down -y from its root pivot (y = 0) bends at a
// knee pivot (0, -kneeDepth) about +z. Above the knee the surface stays put;
// below it the limb turns rigidly by the knee angle, exactly as a shin hung
// from the knee pivot would. Between, the rest mesh is carried round a
// circular fillet of radius `filletRadius` tangent to both straight parts,
// so the joint stays one continuous surface at any bend (the fillet must be
// wider than the limb's inner half-width at the knee). `setBend(angle)`
// rewrites the positions in place from the rest copy and recomputes normals.
export function bendingLimbGeometry(name, { kneeDepth, filletRadius, transform } = {}) {
  const geometry = figureGeometry(name, transform);
  const rest = geometry.attributes.position.array.slice();
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  let current = null;
  geometry.userData.restPositions = rest;
  geometry.userData.kneeDepth = kneeDepth;
  geometry.userData.setBend = (angle) => {
    if (angle === current) return;
    current = angle;
    const out = geometry.attributes.position.array;
    const sign = angle < 0 ? -1 : 1, theta = Math.abs(angle);
    const tangent = filletRadius * Math.tan(theta / 2);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // Fillet centre on the inside of the bend, level with the thigh-side tangent point.
    const centreX = sign * filletRadius, centreY = -kneeDepth + tangent;
    for (let i = 0; i < rest.length; i += 3) {
      const x = rest[i], y = rest[i + 1];
      const u = -y - kneeDepth;
      if (u <= -tangent || theta < 1e-9) {
        out[i] = x; out[i + 1] = y;
      } else if (u >= tangent) {
        // Rigid turn about the knee pivot.
        const dy = y + kneeDepth;
        out[i] = x * cos - dy * sin;
        out[i + 1] = -kneeDepth + x * sin + dy * cos;
      } else {
        const phi = angle * (u + tangent) / (2 * tangent);
        const c = Math.cos(phi), s = Math.sin(phi);
        // Centreline point: the tangent point turned about the fillet centre.
        const ax = -centreX, ay = 0;
        const px = centreX + ax * c - ay * s, py = centreY + ax * s + ay * c;
        out[i] = px + x * c;
        out[i + 1] = py + x * s;
      }
      out[i + 2] = rest[i + 2];
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  geometry.userData.setBend(0);
  return geometry;
}
