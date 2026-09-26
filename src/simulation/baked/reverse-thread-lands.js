import * as THREE from 'three';
import {decodeArray} from './mujoco-bake-format.js';

// Movement 108's visible double-start groove lands, baked offline by
// scripts/bake-reverse-thread-lands.mjs from the live construction
// (mujoco-reverse-thread/groove.js reverseThreadLands). Building them in the
// browser takes seconds; the baked mesh is the same triangles, positions and
// normals (float32, indexed). Live MuJoCo (?live) still builds them, with
// their collision cells, from the profile.
export const REVERSE_THREAD_LANDS_ASSET = new URL('./assets/reverse-thread-108-lands.json.gz', import.meta.url);
// Files whose change invalidates the bake (tests/reverse-thread-lands-bake.test.mjs).
export const REVERSE_THREAD_LANDS_SOURCES = [
  'src/simulation/mujoco-reverse-thread/groove.js',
  'src/simulation/mujoco-reverse-thread/normals.js',
  'src/simulation/mujoco-reverse-thread/profile.js',
  'src/simulation/mujoco-reverse-thread/source.js',
];

async function readBytes(url) {
  if (url.protocol === 'file:') {
    // Node (tests, offline scripts): read the file directly.
    const fsName = 'node:fs/promises';
    const {readFile} = await import(/* @vite-ignore */ fsName);
    return new Uint8Array(await readFile(url));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load 108 groove lands: ' + response.status);
  return new Uint8Array(await response.arrayBuffer());
}

async function inflate(bytes) {
  if (!(bytes[0] === 0x1f && bytes[1] === 0x8b)) return bytes;
  const body = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(body).arrayBuffer());
}

export function decodeReverseThreadLands(bundle) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(decodeArray(bundle.position), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(decodeArray(bundle.normal), 3));
  geometry.setIndex(new THREE.BufferAttribute(decodeArray(bundle.index), 1));
  geometry.computeBoundingSphere();
  geometry.userData.bakedReverseThreadLands = {version: bundle.version, sources: bundle.sources};
  return geometry;
}

export async function loadReverseThreadLands(url = REVERSE_THREAD_LANDS_ASSET) {
  const bytes = await inflate(await readBytes(url));
  return decodeReverseThreadLands(JSON.parse(new TextDecoder().decode(bytes)));
}
