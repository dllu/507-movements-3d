import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const input=process.env.PROBE_INPUT??'artifacts/review/079-load6-finer.json',prefix=process.env.PROBE_PREFIX??'079-finer-preview-sized',r=JSON.parse(await readFile(input,'utf8')),sources=[];
if(r.failures.length)throw Error('Cannot preview an incomplete trajectory');
for(const file of ['scripts/prepare-opposed-arm-preview.mjs','scripts/lib/opposed-arm-preview.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs',input]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const payload={movement:79,status:'isolated-playback-preview',productionChanged:false,mechanicsPassed:false,geometry:r.geometry,physics:r.parameters,
 displayPeriod:4,samples:r.rows.map(row=>[row.time,...row.x]),sources,qualification:'Unintegrated trajectory preview. Linear free-angle interpolation is provisional until its continuous clearance and complete hardware checks pass.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(payload)+'\n',{flag:'wx'});
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>079 · face-ratchet preview</title>
<style>body{margin:20px;background:#faf8f2;color:#26302e;font:16px system-ui}h1{font-size:23px;margin:0 0 7px}p{margin:0 0 16px;max-width:90ch}button,select,input{font:inherit}button,select{padding:7px 12px}nav{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}input{flex:1;min-width:160px}.views{display:grid;grid-template-columns:1fr 1fr;gap:16px;height:680px}#stage{position:relative;min-width:0;background:#f1efe8}.views img{width:100%;height:100%;object-fit:contain;min-width:0}#clock{font-variant-numeric:tabular-nums;min-width:140px}small{display:block;margin-top:10px;color:#58625e}@media(max-width:800px){.views{height:auto;grid-template-columns:1fr}#stage{height:500px}.views img{height:500px}}</style>
<style>.views{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}#stage{min-height:0;overflow:hidden}.simulation-canvas{display:block;width:100%;height:100%;touch-action:none}@media(max-width:800px){.views{grid-template-columns:minmax(0,1fr)}}</style>
<h1>079 · face-ratchet candidate</h1><p>The wheel and both pawls follow an independently simulated trajectory. This preview remains under review.</p>
<nav><button id="play">Play</button><button id="restart">Restart</button><select id="view"><option value="front">Front</option><option value="oblique">Oblique</option><option value="rear">Rear</option><option value="upper">Upper pawl</option><option value="lower">Lower pawl</option></select><input id="time" type="range" min="0" max="16" value="0" step="0.0005"><output id="clock">Loading…</output></nav>
<div class="views"><div id="stage"></div><img id="source" src="/artifacts/reference/brown-079-detail.png" alt="Brown’s engraving of movement 079"></div>
<small>Four seconds per displayed input cycle. Pauses at the end of the recorded run. Production 079 is unchanged.</small>
<script type="module">import {mountOpposedArmPreview} from '/scripts/lib/opposed-arm-preview.mjs';mountOpposedArmPreview('/artifacts/review/${prefix}.json');</script></html>`;
await writeFile(`artifacts/review/${prefix}.html`,html,{flag:'wx'});console.log({prefix,samples:payload.samples.length,displayPeriod:payload.displayPeriod});
