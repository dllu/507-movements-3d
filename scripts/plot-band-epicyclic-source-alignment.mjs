import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { extrudedLoops } from './lib/lathe-lever-boundary.mjs';
import { gearBoundary } from './lib/coaxial-planar-distance.mjs';
import { makeBandEpicyclicCandidate } from '../artifacts/review/057-candidate-model.mjs';

const model = makeBandEpicyclicCandidate(), { parts, geometry: p } = model.root.userData;
model.root.updateMatrixWorld(true);
const project = v => [p.sourceCenter[0] + p.sourceScale * v.x, p.sourceCenter[1] - p.sourceScale * v.y];
const path = (points, matrix, close = true) => points.map((v, i) => `${i ? 'L' : 'M'}${project(v.clone().applyMatrix4(matrix)).map(x => x.toFixed(3)).join(',')}`).join(' ') + (close ? 'Z' : '');
const loops = mesh => extrudedLoops(mesh).map(points => path(points, mesh.matrixWorld)).join(' ');
const circle = mesh => {
  const attr = mesh.geometry.attributes.position, center = mesh.getWorldPosition(new THREE.Vector3()), points = [];
  let radius = 0;
  for (let i = 0; i < attr.count; i += 1) {
    const v = new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld);
    const r = Math.hypot(v.x - center.x, v.y - center.y); radius = Math.max(radius, r); points.push({ v, r });
  }
  const unique = new Map();
  for (const { v, r } of points) if (radius - r < 1e-6) unique.set(`${Math.round(v.x * 1e7)},${Math.round(v.y * 1e7)}`, v);
  const sorted = [...unique.values()].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
  return path(sorted, new THREE.Matrix4());
};
const layers = [], add = (name, d, color, fill = true) => layers.push(`<path data-part="${name}" d="${d}" stroke="${color}" ${fill ? '' : 'class="cord"'}/>`);
for (const name of ['outerBelt', 'innerBelt']) {
  const mesh = parts[name], g = mesh.geometry, attr = g.attributes.position;
  const count = g.parameters.tubularSegments, radial = g.parameters.radialSegments, sides = [[], []];
  for (let i = 0; i <= count; i += 1) {
    const u = i / count, tangent = mesh.userData.curve.getTangentAt(u), direction = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const vertices = Array.from({ length: radial }, (_, j) => new THREE.Vector3().fromBufferAttribute(attr, i * (radial + 1) + j));
    vertices.sort((a, b) => a.dot(direction) - b.dot(direction)); sides[0].push(vertices[0]); sides[1].push(vertices.at(-1));
  }
  // Boundaries use actual rendered cross-section vertices. At the crossover
  // both depth-separated spans remain visible in this contour comparison.
  add(name, sides.map(side => path(side, mesh.matrixWorld)).join(' '), '#176568', false);
}
add('sunDrum', circle(parts.sunDrum), '#a13f24');
add('carrierArm', loops(parts.carrierArm), '#526453');
const ringTeeth = gearBoundary(parts.ring).map(v => new THREE.Vector3(v.x, v.y, 0.11));
add('ring', circle(parts.ringPulley) + ' ' + path(ringTeeth, parts.ring.matrixWorld), '#08739b');
for (const [name, color] of [['sun', '#d23d29'], ['planet', '#a46b07']]) add(name, loops(parts[name]), color);
for (const [name, color] of [['sunHub', '#d23d29'], ['sunShaft', '#38473c'], ['planetCap', '#38473c'],
  ['driverPulley', '#a46b07'], ['driverHub', '#a46b07']]) add(name, circle(parts[name]), color);
add('crankPlate', loops(parts.crankPlate), '#a46b07'); add('driverShaft', circle(parts.driverShaft), '#38473c');
const source = (await readFile('artifacts/reference/brown-057-detail.png')).toString('base64');
await writeFile('artifacts/review/057-source-alignment.html', `<!doctype html><meta charset="utf-8"><title>057 · Source alignment</title>
<style>body{font:16px system-ui;background:#f8f5ed;margin:24px;color:#252a2d}main{max-width:1100px;margin:auto}h1{font-size:24px}svg{width:100%;max-height:80vh;display:block}path{fill:white;fill-rule:evenodd;stroke-width:2.5;stroke-linejoin:round}path.cord{fill:none;stroke-width:1.7}label{display:inline-flex;gap:10px;align-items:center;margin:0 24px 14px 0}p{line-height:1.45}</style>
<main><h1>057 · Source alignment</h1><p>The original scan is unchanged. Model contours come from the candidate's actual mesh vertices, projected from the front at 160 pixels per unit. The fixed common center is (721, 870).</p>
<label>Model opacity <input id="opacity" type="range" min="0" max="1" step=".05" value=".55"></label>
<label><input id="xray" type="checkbox"> Show hidden boundaries</label>
<svg viewBox="0 0 1300 1330" xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${source}" width="1300" height="1330"/><g id="model" opacity=".55">${layers.join('\n')}</g></svg>
<p>18/10/34 teeth are reconstruction estimates supported by the visible outlines. Their common base pitch permits different operating pressure angles at the two meshes. The sun tips are about 11 pixels shorter than the schematic drawing to avoid interfering with the planet. Involute tooth flanks replace the engraving's square teeth. The crossed band passes behind the thin ring in the solid assembly; Brown shows it across the ring's front edge. Bearing construction and axial spacing are inferred.</p></main>
<script>document.querySelector('#opacity').oninput=e=>document.querySelector('#model').setAttribute('opacity',e.target.value);document.querySelector('#xray').oninput=e=>document.querySelectorAll('#model path:not(.cord)').forEach(p=>p.style.fill=e.target.checked?'none':'white');</script>`);
console.log('Wrote artifacts/review/057-source-alignment.html');
