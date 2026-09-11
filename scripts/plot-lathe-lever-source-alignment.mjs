import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { extrudedLoops } from './lib/lathe-lever-boundary.mjs';
import { makeLatheLeverCandidate } from '../artifacts/review/056-candidate-model.mjs';

const model = makeLatheLeverCandidate(), { parts, geometry: p } = model.root.userData;
model.root.updateMatrixWorld(true);
const direction = new THREE.Vector3(...p.sourceProjection.camera).normalize();
const right = new THREE.Vector3(direction.z, 0, -direction.x).normalize(), up = direction.clone().cross(right);
const project = v => {
  const q = v.clone().sub(new THREE.Vector3(0, 0, p.sourceProjection.datumZ));
  return [420 + 190 * q.dot(right), 667 - 190 * q.dot(up)];
};
const path = (points, matrix) => points.map((v, i) => `${i ? 'L' : 'M'}${project(v.clone().applyMatrix4(matrix)).map(x => x.toFixed(3)).join(',')}`).join(' ') + 'Z';
const topLoops = mesh => extrudedLoops(mesh).map(points => path(points, mesh.matrixWorld)).join(' ');

const layers = [];
const add = (name, d, color) => layers.push(`<path data-part="${name}" d="${d}" stroke="${color}"/>`);
const ring = (mesh, z, color) => {
  const attr = mesh.geometry.attributes.position, unique = new Map();
  for (let i = 0; i < attr.count; i += 1) if (Math.abs(attr.getZ(i) - z) < 1e-6) {
    const v = new THREE.Vector3().fromBufferAttribute(attr, i), r = Math.hypot(v.x, v.y);
    if (r > 0.15) unique.set(`${v.x},${v.y}`, v);
  }
  const values = [...unique.values()], maxRadius = Math.max(...values.map(v => Math.hypot(v.x, v.y)));
  const outside = values.filter(v => Math.hypot(v.x, v.y) > maxRadius - 1e-5).sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  add(mesh.name, path(outside, mesh.matrixWorld), color);
};
for (const z of [-1.295, -0.995, -0.695]) ring(parts.pulley, z, '#ad7215');
for (const name of ['largeGear', 'pinion', 'frontWeb', 'frame', 'slider', 'bearingCap', 'foot', 'topLip', 'footBand', 'leverPlate']) {
  add(name, topLoops(parts[name]), name === 'largeGear' || name === 'frontWeb' ? '#007ab0' : name === 'pinion' ? '#df4432' : name === 'leverPlate' ? '#b64ba1' : '#148057');
}
for (const name of ['outputShaft', 'inputShaft', 'pivotShaft', 'pivotCap']) {
  const mesh = parts[name], attr = mesh.geometry.attributes.position, local = [];
  mesh.geometry.computeBoundingBox(); const y = mesh.geometry.boundingBox.max.y;
  for (let i = 0; i < attr.count; i += 1) if (attr.getY(i) === y && Math.hypot(attr.getX(i), attr.getZ(i)) > 0.01) local.push(new THREE.Vector3().fromBufferAttribute(attr, i));
  const unique = [...new Map(local.map(v => [`${v.x},${v.z}`, v])).values()].sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  add(name, path(unique, mesh.matrixWorld), '#252a2d');
}
const source = (await readFile('artifacts/reference/brown-056-detail.png')).toString('base64');
await writeFile('artifacts/review/056-source-alignment.html', `<!doctype html><meta charset="utf-8"><title>056 · Source alignment</title>
<style>body{font:16px system-ui;background:#f8f5ed;margin:24px;color:#252a2d}main{max-width:1100px;margin:auto}h1{font-size:24px}svg{width:100%;max-height:80vh;display:block}path{fill:white;fill-rule:evenodd;stroke-width:2.5;stroke-linejoin:round}label{display:inline-flex;gap:10px;align-items:center;margin:0 24px 14px 0}p{line-height:1.45}</style>
<main><h1>056 · Source alignment</h1><p>The original scan is unchanged. Projected front boundaries come from the candidate's actual mesh vertices. The fixed scale is 190 pixels per unit; the view direction is (${p.sourceProjection.camera.join(', ')}).</p>
<label>Model opacity <input id="opacity" type="range" min="0" max="1" step=".05" value=".55"></label>
<label><input id="xray" type="checkbox"> Show hidden boundaries</label>
<svg viewBox="0 0 1400 1320" xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${source}" width="1400" height="1320"/><g id="model" opacity=".55">${layers.join('\n')}</g></svg>
<p>38/12 teeth are reconstruction estimates. The standard common-module involutes have shorter tips than Brown's schematic teeth. Their large-wheel radius is about 20 pixels smaller; the common shaft projection also leaves a small center offset. A longer-tip trial lost consistent working contact. The curved frame and lever retain the traced contours; pulley steps and bearings are inferred solid sections.</p></main>
<script>document.querySelector('#opacity').oninput=e=>document.querySelector('#model').setAttribute('opacity',e.target.value);document.querySelector('#xray').oninput=e=>document.querySelectorAll('#model path').forEach(p=>p.style.fill=e.target.checked?'none':'white');</script>`);
console.log('Wrote artifacts/review/056-source-alignment.html');
