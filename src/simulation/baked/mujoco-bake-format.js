import * as THREE from 'three';

// Shared encoding and object addressing for baked MuJoCo loops. Used by the
// offline bake (scripts/bake-mujoco-movement.mjs) and by browser playback
// (mujoco-playback.js), so both address the same objects the same way.

const ARRAYS = {f32: Float32Array, i16: Int16Array, i8: Int8Array, u8: Uint8Array, u32: Uint32Array};

function toBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

function fromBase64(text) {
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(text, 'base64');
    // Copy into an aligned buffer for typed-array views.
    return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  }
  const binary = atob(text), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encode a typed array as {type, data: base64}. */
export function encodeArray(type, values) {
  const Type = ARRAYS[type];
  if (!Type) throw new TypeError('Unknown array type ' + type);
  const array = values instanceof Type ? values : Type.from(values);
  return {type, length: array.length, data: toBase64(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))};
}

/**
 * Encode a smooth interleaved track (width values per sample, such as
 * positions or quaternions) as {type: 'd2'}: values rounded to a fixed
 * quantum, then second differences along the track stored as int16 with
 * their low and high bytes in separate planes, which gzip compresses about
 * three times better than float32. The rounding error is at most quantum/2
 * and does not accumulate. Falls back to float32 if a difference overflows.
 */
export function encodeSmoothArray(values, width, quantum) {
  const q = Array.from(values, v => Math.round(v / quantum)), n = q.length;
  const head = q.slice(0, 2 * width), differences = new Int16Array(Math.max(0, n - 2 * width));
  for (let i = 2 * width; i < n; i++) {
    const d = q[i] - 2 * q[i - width] + q[i - 2 * width];
    if (Math.abs(d) > 32767) return encodeArray('f32', values);
    differences[i - 2 * width] = d;
  }
  const bytes = new Uint8Array(differences.buffer), planes = new Uint8Array(bytes.length), m = differences.length;
  for (let i = 0; i < m; i++) {planes[i] = bytes[2 * i];planes[m + i] = bytes[2 * i + 1];}
  return {type: 'd2', length: n, width, quantum, head, data: toBase64(planes)};
}

function decodeSmoothArray(encoded) {
  const {length: n, width, quantum, head} = encoded, planes = fromBase64(encoded.data), m = planes.length / 2;
  if (m !== Math.max(0, n - 2 * width) || head.length !== Math.min(n, 2 * width)) throw new RangeError('Corrupt baked array');
  const q = new Float64Array(n), out = new Float32Array(n);
  for (let i = 0; i < head.length; i++) q[i] = head[i];
  for (let i = 2 * width; i < n; i++) {
    const j = i - 2 * width, d = (planes[j] | planes[m + j] << 8) << 16 >> 16;
    q[i] = d + 2 * q[i - width] - q[i - 2 * width];
  }
  for (let i = 0; i < n; i++) out[i] = q[i] * quantum;
  return out;
}

export function decodeArray(encoded) {
  if (encoded.type === 'd2') return decodeSmoothArray(encoded);
  const Type = ARRAYS[encoded.type];
  if (!Type) throw new TypeError('Unknown array type ' + encoded.type);
  const bytes = fromBase64(encoded.data), array = new Type(bytes.buffer, 0, bytes.byteLength / Type.BYTES_PER_ELEMENT);
  if (array.length !== encoded.length) throw new RangeError('Corrupt baked array');
  return array;
}

// Objects are addressed from the nearest ancestor listed in the model's
// userData.blocks or userData.parts maps, then by name and occurrence among
// equally named siblings. Adding a differently named static part (a support,
// a bracket) therefore does not disturb the addresses of recorded parts.
function anchors(root) {
  const map = new Map([[root, '']]);
  for (const group of ['blocks', 'parts']) {
    for (const [name, object] of Object.entries(root.userData?.[group] ?? {})) {
      if (object?.isObject3D && !map.has(object) && isDescendant(root, object)) map.set(object, `${group}.${name}`);
    }
  }
  return map;
}

function isDescendant(root, object) {
  for (let node = object; node; node = node.parent) if (node === root) return true;
  return false;
}

function segment(object) {
  const name = object.name || '';
  let occurrence = 0;
  for (const sibling of object.parent.children) {
    if (sibling === object) break;
    if ((sibling.name || '') === name) occurrence++;
  }
  return `${name}#${occurrence}`;
}

/** Map every descendant of root (excluding root) to its address. */
export function objectKeys(root) {
  const anchored = anchors(root), keys = new Map();
  const visit = (object, base) => {
    for (const child of object.children) {
      const key = anchored.has(child) ? anchored.get(child) : `${base}/${segment(child)}`;
      keys.set(child, key);
      visit(child, key);
    }
  };
  visit(root, '');
  // Anchors reached through another anchor keep their own short address.
  return keys;
}

/** Resolve addresses produced by objectKeys against another build. */
export function resolveObjectKeys(root) {
  const byKey = new Map();
  for (const [object, key] of objectKeys(root)) byKey.set(key, object);
  return byKey;
}

export const ROOT_USER_DATA_KEYS = [
  'mechanism', 'fidelity', 'reconstructionStatus', 'reconstructionNote', 'qualification', 'hideGround',
  'cameraFitBounds', 'sampledMotionBounds', 'cameraFov', 'cameraDistanceScale', 'cameraMaxDistance',
  'shadowCameraHalfExtent', 'shadowBias', 'shadowNormalBias', 'localClippingEnabled', 'fullCameraDirection',
  'groundFloorY', 'sampledFloorY', 'configurationLabel', 'configurations', 'configuration',
];

/** JSON-safe copy of a root userData value; Box3 and Vector3 are tagged. */
export function encodeUserValue(value) {
  if (value?.isBox3) return {$box3: [value.min.toArray(), value.max.toArray()]};
  if (value?.isVector3) return {$vector3: value.toArray()};
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map(encodeUserValue);
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v !== 'function').map(([k, v]) => [k, encodeUserValue(v)]));
  }
  throw new TypeError('Unsupported baked userData value');
}

export function decodeUserValue(value) {
  if (value?.$box3) return new THREE.Box3(new THREE.Vector3(...value.$box3[0]), new THREE.Vector3(...value.$box3[1]));
  if (value?.$vector3) return new THREE.Vector3(...value.$vector3);
  if (Array.isArray(value)) return value.map(decodeUserValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeUserValue(v)]));
  return value;
}
