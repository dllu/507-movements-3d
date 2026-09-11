import { readFile, writeFile } from 'node:fs/promises';
import { sourceLayout as p, traces, outlinePoints } from '../artifacts/review/063-provisional-source-layout.mjs';

const source = (await readFile('artifacts/reference/brown-063-detail.png')).toString('base64');
const pinVector = p.pinCenters.reduce((sum, [x, y], index) => {
  const angle = index * 2 * Math.PI / 3, dx = x - p.driverCenter[0], dy = p.driverCenter[1] - y;
  return [sum[0] + (dx * Math.cos(angle) - dy * Math.sin(angle)) / 3,
    sum[1] + (dx * Math.sin(angle) + dy * Math.cos(angle)) / 3];
}, [0, 0]);
const pinOrbitRadius = Math.hypot(...pinVector), pinMountPhase = Math.atan2(pinVector[1], pinVector[0]);
const fittedPins = p.pinCenters.map(([x, y], index) => {
  const angle = pinMountPhase - index * 2 * Math.PI / 3;
  const fitted = [p.driverCenter[0] + pinOrbitRadius * Math.cos(angle), p.driverCenter[1] - pinOrbitRadius * Math.sin(angle)];
  return { source: [x, y], fitted, residual: Math.hypot(fitted[0] - x, fitted[1] - y) };
});
const result = { ...p, traces, pinOrbitRadius, pinMountPhase, fittedPins,
  maximumPinCenterResidual: Math.max(...fittedPins.map(row => row.residual)),
  outlineSamples: Object.fromEntries(Object.entries(outlinePoints).map(([name, points]) => [name, points.length])),
};
await writeFile('artifacts/review/063-source-tracing.json', JSON.stringify(result, null, 2) + '\n');
const circle = (center, radius, color, dash = '') => `<circle cx="${center[0]}" cy="${center[1]}" r="${radius}" fill="none" stroke="${color}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
const paths = Object.entries(traces).map(([name, commands]) => `<path id="${name}" d="${commands.map(row => row.join(' ')).join(' ')}" fill="${name === 'drop' ? '#e65b35' : '#1684cc'}" fill-opacity=".25" stroke="${name === 'drop' ? '#bd3512' : '#0069a8'}" stroke-width="4"/>`).join('\n');
const html = `<!doctype html><meta charset="utf-8"><title>063 · provisional source tracing</title>
<style>body{margin:0;background:#faf8f2;color:#232323;font:16px system-ui}header{padding:20px;max-width:1000px}h1{font-size:24px;margin:0 0 10px}label{margin-right:24px}svg{display:block;width:min(100%,1000px);height:auto}p{line-height:1.5}input{vertical-align:middle}</style>
<header><h1>063 · provisional common-pivot interpretation</h1><p>The unchanged enlargement remains underneath. Orange traces the rear drop, including its hidden edge; blue traces the broad front pawl. Both rings appear centered on the same large upper pivot. The small circle at its right is a candidate striker on the drop. These traces are a study, not a verified reconstruction.</p>
<label><input id="show-drop" type="checkbox" checked>Rear drop</label><label><input id="show-pawl" type="checkbox" checked>Front pawl</label><label>Overlay opacity <input id="opacity" type="range" min="0" max="1" step=".01" value=".65"></label>
<p>Equal three-pin spacing fitted to the marked centers: radius ${pinOrbitRadius.toFixed(3)} px; maximum center residual ${result.maximumPinCenterResidual.toFixed(3)} px. Hidden pivot bores, exact contact profiles, release order and one-tooth indexing still need independent checks.</p></header>
<svg viewBox="0 0 1360 1320" xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${source}" width="1360" height="1320"/><g id="overlay" opacity=".65">${paths}
${circle(p.pivot, 66, '#6a22a0')}${circle(p.striker, p.strikerRadius, '#bd3512')}
${circle(p.driverCenter, p.driverRadius, '#16852b')}${circle(p.driverCenter, pinOrbitRadius, '#16852b', '9 9')}
${circle(p.starCenter, p.starRadius, '#6a22a0', '9 9')}${fittedPins.map(row => circle(row.fitted, p.pinRadius, '#16852b')).join('')}
<g stroke="#6a22a0" stroke-width="4"><path d="M420 290h30M435 275v30M553 855h30M568 840v30M990 713h30M1005 698v30"/></g></g></svg>
<script>for(const name of ['drop','pawl'])document.getElementById('show-'+name).onchange=e=>document.getElementById(name).style.display=e.target.checked?'':'none';document.getElementById('opacity').oninput=e=>document.getElementById('overlay').setAttribute('opacity',e.target.value);</script>`;
await writeFile('artifacts/review/063-source-tracing.html', html);
console.log(JSON.stringify({ pinOrbitRadius, pinMountPhase, fittedPins, maximumPinCenterResidual: result.maximumPinCenterResidual }, null, 2));
