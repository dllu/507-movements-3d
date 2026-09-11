import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const input=process.env.PROBE_INPUT??'artifacts/review/079-contact-compressed-finest-candidate.json',prefix=process.env.PROBE_PREFIX??'079-loop-preview',sources=[];
const profile=JSON.parse(await readFile(input,'utf8'));if(!profile.passed)throw Error('Incomplete playback artifact');
for(const file of ['scripts/prepare-opposed-arm-loop-preview.mjs','scripts/lib/opposed-arm-loop-preview.mjs','scripts/lib/opposed-arm-playback.mjs',
 'scripts/lib/opposed-arm-view-bounds.mjs','scripts/lib/opposed-arm-candidate.mjs',input]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-prepare-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>079 · two-pawl face ratchet</title>
<style>*{box-sizing:border-box}body{margin:20px;background:#faf8f2;color:#26302e;font:16px system-ui}h1{font-size:23px;margin:0 0 7px}p{margin:0 0 16px;max-width:88ch}button,select,input{font:inherit}button,select{padding:7px 12px}nav{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}input{flex:1;min-width:160px}.views{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;height:680px}#stage{position:relative;min-width:0;min-height:0;overflow:hidden;background:#f1efe8}.simulation-canvas{display:block;width:100%;height:100%;touch-action:none}.views img{display:block;width:100%;height:100%;min-width:0;min-height:0;object-fit:contain}#clock{font-variant-numeric:tabular-nums;min-width:160px}small{display:block;margin-top:10px;color:#58625e}@media(max-width:800px){body{margin:12px}.views{height:auto;grid-template-columns:minmax(0,1fr)}#stage{height:420px}.views img{height:auto;max-height:500px}input{flex-basis:100%}}</style>
<h1>079 · two-pawl face ratchet</h1><p>Two oscillating arms drive the same wheel. Study preview; the reconstruction remains under review.</p>
<nav><button id="play">Play</button><button id="restart">Restart</button><label>Cycle <select id="period"><option value="2">2 s</option><option value="4" selected>4 s</option><option value="8">8 s</option></select></label><select id="view"><option value="front">Front</option><option value="oblique">Oblique</option><option value="rear">Rear</option></select><input id="time" type="range" min="0" max="16" value="0" step="0.001"><output id="clock">Loading…</output></nav>
<div class="views"><div id="stage"></div><img id="source" src="/artifacts/reference/brown-079-detail.png" alt="Brown’s engraving of movement 079"></div>
<small>The wheel advances four teeth per cycle after startup. Drag to inspect the mechanism.</small>
<script type="module">import {mountOpposedArmLoopPreview} from '/scripts/lib/opposed-arm-loop-preview.mjs';mountOpposedArmLoopPreview('/${input}');</script></html>`;
await writeFile(`artifacts/review/${prefix}.html`,html,{flag:'wx'});await writeFile(`artifacts/review/${prefix}-preparation.json`,JSON.stringify({movement:79,status:'loop-preview-prepared',productionChanged:false,mechanicsPassed:false,input,html:`artifacts/review/${prefix}.html`,sources},null,2)+'\n',{flag:'wx'});
console.log({prefix,input});
