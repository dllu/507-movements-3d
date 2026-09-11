import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeDualInputDifferentialCandidate } from '../artifacts/review/062-candidate-model.mjs';
const model = makeDualInputDifferentialCandidate(), { parts, geometry: p } = model.root.userData;
model.update(0); model.root.updateMatrixWorld(true);
const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const hull = points => {
  const unique = [...new Map(points.map(point => [`${point.x.toFixed(6)},${point.y.toFixed(6)}`, point])).values()]
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const half = values => { const out = []; for (const point of values) {
    while (out.length > 1 && cross(out.at(-2), out.at(-1), point) <= 0) out.pop(); out.push(point);
  } return out; };
  return [...half(unique).slice(0, -1), ...half([...unique].reverse()).slice(0, -1)];
};
const bounds = {}, outlines = {};
for (const [name, mesh] of Object.entries(parts)) {
  const attr = mesh.geometry.attributes.position, pixels = new THREE.Box2(), points = [];
  for (let i = 0; i < attr.count; i += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld);
    const q = new THREE.Vector2(p.sourceOrigin[0] + p.sourceScale * point.z, p.sourceOrigin[1] - p.sourceScale * point.y);
    points.push(q); pixels.expandByPoint(q);
  }
  bounds[name] = { left: pixels.min.x, right: pixels.max.x, top: pixels.min.y, bottom: pixels.max.y };
  outlines[name] = hull(points);
}
const measurements = JSON.parse(await readFile('artifacts/review/062-source-envelope-measurement.json', 'utf8'));
const rows = [['driver-drum-left', 'driverDrum'], ['driver-drum-right', 'driverDrum'],
  ['small-driver-left', 'sideDriverDrum'], ['small-driver-right', 'sideDriverDrum'],
  ['driver-shaft-left', 'driverShaft'], ['driver-shaft-right', 'driverShaft'],
  ['neutral-pulley-left', 'loosePulley'], ['direct-pulley', 'directPulley'], ['carrier-pulley', 'carrierPulley'],
  ['side-input-pulley-right', 'sidePulley'], ['output-shaft-left', 'outputShaft'], ['output-shaft-right', 'outputShaft']]
  .map(([name, part]) => { const source = measurements.rows.find(row => row.name === name), b = bounds[part];
    return { name, top: b.top, bottom: b.bottom, source, topResidual: b.top - source.top, bottomResidual: b.bottom - source.bottom }; });
const colors = { driver: '#c74f31', output: '#12799b', carrier: '#b58b36', planet: '#b58b36', side: '#53615a', sideBelt: '#65705a', loose: '#53615a', belt: '#65705a' };
const order = ['driverShaft', 'outputShaft', 'outputGearBody', 'outputGearTeeth', 'sideGearBody', 'sideGearTeeth',
  'planetBody', 'planetTeeth', 'planetSpindle', 'innerSpindleCollar', 'outerSpindleCollar',
  'driverDrum', 'sideDriverDrum', 'loosePulley', 'directPulley', 'carrierPulley', 'sidePulley', 'belt', 'sideBelt'];
const layers = order.map(name => `<polygon data-part="${name}" points="${outlines[name].map(q => `${q.x},${q.y}`).join(' ')}" stroke="${colors[model.root.userData.families[name]]}"/>`);
const source = (await readFile('artifacts/reference/brown-062-detail.png')).toString('base64');
await writeFile('artifacts/review/062-source-alignment.html', `<!doctype html><meta charset="utf-8"><title>062 · Source alignment</title>
<style>body{font:16px system-ui;background:#f8f5ed;margin:24px;color:#252a2d}main{max-width:1200px;margin:auto}h1{font-size:24px}svg{width:100%;display:block}polygon{fill:white;stroke-width:2.5;stroke-linejoin:round}label{display:inline-flex;gap:10px;align-items:center;margin:0 24px 14px 0}p{line-height:1.45}table{border-collapse:collapse}td,th{padding:5px 14px;text-align:right;border-bottom:1px solid #ddd}td:first-child,th:first-child{text-align:left}</style>
<main><h1>062 · Source alignment</h1><p>The unchanged scan is overlaid with convex side envelopes of the actual Float32 mesh vertices, projected along negative x at ${p.sourceScale} pixels/unit and fixed origin (${p.sourceOrigin.join(',')}). These envelopes show exterior dimensions; hidden bores, tooth spaces and band-loop interiors are not represented.</p>
<label>Model opacity <input id="opacity" type="range" min="0" max="1" step=".05" value=".5"></label><label><input id="xray" type="checkbox"> Show hidden envelopes</label>
<svg viewBox="0 0 1200 1460" xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${source}" width="1200" height="1460"/><g id="model" opacity=".5">${layers.join('\n')}</g></svg>
<p>Brown's shaft and pulley centers differ slightly; the reconstruction keeps concentric shafts and records those residuals. The hidden bevel train is fitted inside the pulley envelope. Both bands are continuous. The open auxiliary belt follows the engraving; a separate crossed configuration demonstrates the additive speed relation. Tooth counts, concealed bearings and stopped input in neutral or during shifts are reconstruction choices.</p>
<table><tr><th>Measured envelope</th><th>Top residual, px</th><th>Bottom residual, px</th></tr>${rows.map(row => `<tr><td>${row.name}</td><td>${row.topResidual.toFixed(2)}</td><td>${row.bottomResidual.toFixed(2)}</td></tr>`).join('')}</table></main>
<script>document.querySelector('#opacity').oninput=e=>document.querySelector('#model').setAttribute('opacity',e.target.value);document.querySelector('#xray').oninput=e=>document.querySelectorAll('#model polygon').forEach(p=>p.style.fill=e.target.checked?'none':'white');</script>`);
await writeFile('artifacts/review/062-source-alignment.json', JSON.stringify({ projection: { scale: p.sourceScale, origin: p.sourceOrigin, direction: [-1, 0, 0] }, bounds, rows }, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ name, topResidual, bottomResidual }) => ({ name, topResidual, bottomResidual })), null, 2));
