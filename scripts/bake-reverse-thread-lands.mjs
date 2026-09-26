// Bake movement 108's visible groove lands (the slow part of its geometry)
// into src/simulation/baked/assets/reverse-thread-108-lands.json.gz.
// Usage: node scripts/bake-reverse-thread-lands.mjs
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {makeReverseThreadProfile} from '../src/simulation/mujoco-reverse-thread/profile.js';
import {reverseThreadLands} from '../src/simulation/mujoco-reverse-thread/groove.js';
import {encodeArray} from '../src/simulation/baked/mujoco-bake-format.js';
import {REVERSE_THREAD_LANDS_SOURCES} from '../src/simulation/baked/reverse-thread-lands.js';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function indexLands(geometry) {
  // Deduplicate exact (position, normal) float32 bit patterns; the triangle
  // list is kept in its original order.
  const p = geometry.attributes.position.array, n = geometry.attributes.normal.array;
  const bits = new Uint32Array(new Float32Array([...p, ...n]).buffer);
  const count = p.length / 3, keys = new Map(), position = [], normal = [], index = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) {
    const key = [0, 1, 2].map((k) => bits[3 * i + k]).concat([0, 1, 2].map((k) => bits[p.length + 3 * i + k])).join(',');
    let id = keys.get(key);
    if (id === undefined) {
      id = keys.size;
      keys.set(key, id);
      position.push(p[3 * i], p[3 * i + 1], p[3 * i + 2]);
      normal.push(n[3 * i], n[3 * i + 1], n[3 * i + 2]);
    }
    index[i] = id;
  }
  return {position: Float32Array.from(position), normal: Float32Array.from(normal), index};
}

export function landsFingerprint(geometry) {
  // Order-sensitive hash of the non-indexed triangles' float32 positions and
  // normals, so baked and live meshes compare exactly.
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = new Float32Array(g.attributes.position.array), n = new Float32Array(g.attributes.normal.array);
  return sha256(Buffer.concat([Buffer.from(p.buffer), Buffer.from(n.buffer)]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const started = Date.now();
  const lands = reverseThreadLands(makeReverseThreadProfile());
  const {position, normal, index} = indexLands(lands.geometry);
  const bundle = {
    format: 'reverse-thread-lands',
    version: 1,
    generator: 'scripts/bake-reverse-thread-lands.mjs',
    sources: Object.fromEntries(REVERSE_THREAD_LANDS_SOURCES.map((file) => [file, sha256(fs.readFileSync(path.join(repository, file)))])),
    fingerprint: landsFingerprint(lands.geometry),
    triangles: lands.geometry.attributes.position.count / 3,
    position: encodeArray('f32', position),
    normal: encodeArray('f32', normal),
    index: encodeArray('u32', index),
  };
  const out = path.join(repository, 'src/simulation/baked/assets/reverse-thread-108-lands.json.gz');
  const bytes = gzipSync(JSON.stringify(bundle), {level: 9});
  fs.writeFileSync(out, bytes);
  console.log(`wrote ${path.relative(repository, out)}: ${bytes.length} bytes, ${bundle.triangles} triangles, ${position.length / 3} vertices, ${Date.now() - started} ms`);
}
