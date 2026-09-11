import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeThreeSpeedSelectorCandidate } from '../artifacts/review/058-candidate-model.mjs';

const model = makeThreeSpeedSelectorCandidate(), { parts, geometry: p } = model.root.userData;
model.update(0); model.root.updateMatrixWorld(true);
const bounds = {};
for (const [name, mesh] of Object.entries(parts)) {
  const attr = mesh.geometry.attributes.position, pixels = new THREE.Box2();
  for (let i = 0; i < attr.count; i += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld);
    pixels.expandByPoint(new THREE.Vector2(p.sourceOrigin[0] + p.sourceScale * point.z,
      p.sourceOrigin[1] - p.sourceScale * point.y));
  }
  bounds[name] = { left: pixels.min.x, right: pixels.max.x, top: pixels.min.y, bottom: pixels.max.y };
}
const measurements = JSON.parse(await readFile('artifacts/review/058-source-envelope-measurement.json', 'utf8'));
const rows = [];
for (let i = 0; i < 3; i += 1) {
  const input = bounds[`inputGear${i}`], output = bounds[`outputGear${i}`];
  rows.push({ name: `gear-stack-${i}`, top: Math.min(input.top, output.top), bottom: Math.max(input.bottom, output.bottom) });
}
for (const [name, part] of [['main-input-shaft', 'inputShaft0'], ['first-input-sleeve', 'inputShaft1'],
  ['second-input-sleeve', 'inputShaft2'], ['output-shaft-0', 'outputShaft'], ['output-shaft-1', 'outputShaft'],
  ['driver-shaft', 'driverShaft'], ['driver-drum', 'driverDrum'],
  ['lower-pulley-0', 'inputPulley2'], ['lower-pulley-1', 'inputPulley1'], ['lower-pulley-2', 'inputPulley0']]) {
  rows.push({ name, top: bounds[part].top, bottom: bounds[part].bottom });
}
const sourceRows = measurements.rows ?? measurements.measurements;
for (const row of rows) {
  const measured = sourceRows.find(value => value.name === row.name);
  row.source = measured;
  row.topResidual = row.top - measured.top;
  row.bottomResidual = row.bottom - measured.bottom;
}
const layers = [], add = (name, color) => {
  const b = bounds[name];
  layers.push(`<rect data-part="${name}" x="${b.left}" y="${b.top}" width="${b.right - b.left}" height="${b.bottom - b.top}" stroke="${color}"/>`);
};
for (const name of ['inputShaft0', 'inputShaft1', 'inputShaft2', 'outputShaft', 'driverShaft']) add(name, '#53615a');
for (const [i, color] of ['#aa780d', '#b0901e', '#b36c44'].entries()) {
  add(`inputGear${i}`, color); add(`outputGear${i}`, '#12799b'); add(`inputPulley${i}`, color);
}
add('loosePulley', '#53615a'); add('driverDrum', '#c74f31'); add('belt', '#65705a');
const source = (await readFile('artifacts/reference/brown-058-detail.png')).toString('base64');
await writeFile('artifacts/review/058-source-alignment.html', `<!doctype html><meta charset="utf-8"><title>058 · Source alignment</title>
<style>body{font:16px system-ui;background:#f8f5ed;margin:24px;color:#252a2d}main{max-width:1100px;margin:auto}h1{font-size:24px}svg{width:100%;max-height:77vh;display:block}rect{fill:white;stroke-width:2.5;stroke-linejoin:round}label{display:inline-flex;gap:10px;align-items:center;margin:0 24px 14px 0}p{line-height:1.45}table{border-collapse:collapse}td,th{padding:5px 14px;text-align:right;border-bottom:1px solid #ddd}td:first-child,th:first-child{text-align:left}</style>
<main><h1>058 · Source alignment</h1><p>The scan is unchanged. These side-elevation silhouette envelopes come from the actual model vertices projected along negative x, at 200 pixels per unit with fixed input origin (910,761). Their rectangular outlines show the visible extents of the turned and extruded solids; internal tooth lines and hidden bores are not depicted.</p>
<label>Model opacity <input id="opacity" type="range" min="0" max="1" step=".05" value=".5"></label><label><input id="xray" type="checkbox"> Show hidden envelopes</label>
<svg viewBox="0 0 1300 1360" xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${source}" width="1300" height="1360"/><g id="model" opacity=".5">${layers.join('\n')}</g></svg>
<p>The drawing's shaft and pulley centers disagree by several pixels. The model keeps parallel concentric shafts and records those residuals. The 17/39, 26/30 and 40/16 gear counts are compatible proportion estimates; the hatching cannot establish tooth counts. A continuous flat belt fills Brown's schematic interruption.</p>
<table><tr><th>Measured envelope</th><th>Top residual, px</th><th>Bottom residual, px</th></tr>${rows.map(row => `<tr><td>${row.name}</td><td>${row.topResidual.toFixed(2)}</td><td>${row.bottomResidual.toFixed(2)}</td></tr>`).join('')}</table></main>
<script>document.querySelector('#opacity').oninput=e=>document.querySelector('#model').setAttribute('opacity',e.target.value);document.querySelector('#xray').oninput=e=>document.querySelectorAll('#model rect').forEach(p=>p.style.fill=e.target.checked?'none':'white');</script>`);
await writeFile('artifacts/review/058-source-alignment.json', JSON.stringify({ projection: { scale: p.sourceScale, origin: p.sourceOrigin, direction: [-1, 0, 0] }, bounds, rows }, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ name, topResidual, bottomResidual }) => ({ name, topResidual, bottomResidual })), null, 2));
