import { readFile, writeFile } from 'node:fs/promises';
import { makeCoaxialDifferentSpeeds } from '../src/simulation/coaxial-gears.js';
import { gearBoundary } from './lib/coaxial-planar-distance.mjs';

const model = makeCoaxialDifferentSpeeds(), { parts, geometry: p } = model.root.userData;
const source = (await readFile('artifacts/reference/brown-055-detail.png')).toString('base64');
const path = mesh => gearBoundary(mesh).map((v, i) => `${i ? 'L' : 'M'}${v.x.toFixed(6)},${v.y.toFixed(6)}`).join(' ') + 'Z';
const html = `<!doctype html><meta charset="utf-8"><title>055 · Source alignment</title>
<style>body{font:16px system-ui;margin:24px;background:#f8f5ed;color:#252a2d}main{max-width:950px;margin:auto}h1{font-size:24px}label{display:inline-flex;align-items:center;gap:8px;margin:0 22px 12px 0}svg{display:block;width:100%;max-height:80vh}p{line-height:1.5}path,circle{fill:none;stroke-width:.014;stroke-linejoin:round}</style>
<main><h1>055 · Source alignment</h1><p>Scale is fixed to the outer rim; the original scan is unchanged. Blue: A. Red: B. Magenta: C.</p>
<label>Model opacity <input id="opacity" type="range" min="0" max="1" step=".05" value=".9"></label>
<label>Input tooth phase <input id="phase" type="range" min="0" max="${2 * Math.PI / 10}" step=".001" value="0"></label>
<svg viewBox="190 285 835 805" xmlns="http://www.w3.org/2000/svg">
<image href="data:image/png;base64,${source}" width="1180" height="1320"/>
<g id="model" opacity=".9" transform="translate(612.5 682.5) scale(${355 / p.outerRadius} ${-355 / p.outerRadius}) rotate(${p.frameAngle * 180 / Math.PI})">
<g id="A" stroke="#247bce"><path d="${path(parts.gearAMesh)}"/><circle r="${p.outputShaftRadius}"/></g>
<g transform="translate(${-p.centerDistance} 0)"><g id="B" stroke="#ff4c3a"><path d="${path(parts.pinionMesh)}"/><circle r="${p.pinionShaftRadius}"/></g></g>
<g id="C" stroke="#d52299"><path d="${path(parts.ringMesh)}"/><circle r="${p.outerRadius}"/></g></g></svg>
<p>The 17/10/37 reconstruction preserves one common module and fixed centers. Its working involute flanks replace Brown’s schematic block teeth. The engraving does not dimension the hidden cup section or the external bearings.</p></main>
<script>const phase=document.querySelector('#phase');function update(){const u=Number(phase.value);for(const [id,angle] of [['A',${p.gearAPhase}-u*10/17],['B',${p.pinionPhase}+u],['C',${p.gearCPhase}+u*10/37]])document.querySelector('#'+id).setAttribute('transform','rotate('+(angle*180/Math.PI)+')')}phase.oninput=update;document.querySelector('#opacity').oninput=e=>document.querySelector('#model').setAttribute('opacity',e.target.value);update();</script>`;
await writeFile('artifacts/review/055-source-alignment.html', html);
console.log('Wrote artifacts/review/055-source-alignment.html');
