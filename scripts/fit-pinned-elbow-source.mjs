import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pinnedElbowSource as source,pinnedElbowParameters,pinnedElbowState} from '../src/simulation/pinned-elbow-motion.js';
// Keep the disk and output point fixed. Adjust three measured centers equally.
// The positive full-turn margin avoids an exact change-point mechanism.
const margin=10,origin=[...source.crankPin,...source.input,...source.pivot];
const lengths=x=>{const [px,py,bx,by,ox,oy]=x,[cx,cy]=source.diskCenter;return{r:Math.hypot(px-cx,py-cy),d:Math.hypot(ox-cx,oy-cy),l:Math.hypot(bx-px,by-py),a:Math.hypot(bx-ox,by-oy)};};
const slack=x=>{const {r,d,l,a}=lengths(x);return d-r-l+a;};
const gradient=x=>{const [px,py,bx,by,ox,oy]=x,[cx,cy]=source.diskCenter,{r,d,l,a}=lengths(x);return[-(px-cx)/r+(bx-px)/l,-(py-cy)/r+(by-py)/l,-(bx-px)/l+(bx-ox)/a,-(by-py)/l+(by-oy)/a,(ox-cx)/d+(ox-bx)/a,(oy-cy)/d+(oy-by)/a];};
let x=origin.slice(),iterations=0;
for(;iterations<1000;iterations++){
 const grad=gradient(x),lambda=(margin-slack(x)+grad.reduce((s,g,i)=>s+g*(x[i]-origin[i]),0))/grad.reduce((s,g)=>s+g*g,0);
 const next=origin.map((v,i)=>v+lambda*grad[i]);const change=Math.hypot(...next.map((v,i)=>v-x[i]));x=next;if(change<1e-11)break;
}
assert.ok(iterations<1000);assert.ok(Math.abs(slack(x)-margin)<1e-8);
const fitted={...source,crankPin:x.slice(0,2),input:x.slice(2,4),pivot:x.slice(4,6)},g=pinnedElbowParameters(fitted),raw=pinnedElbowParameters(source);
const invalid=[];let minHeight=Infinity;for(let i=0;i<=4096;i++){
 const t=g.period*i/4096;try{pinnedElbowState(t,raw);}catch{invalid.push(i/4096);}
 const s=pinnedElbowState(t,g);const dx=g.pivot[0]-s.pin[0],dy=g.pivot[1]-s.pin[1];minHeight=Math.min(minHeight,Math.abs(dx*(s.input[1]-s.pin[1])-dy*(s.input[0]-s.pin[0]))/Math.hypot(dx,dy));
}
assert.ok(invalid.length>0);
const report={movement:157,method:'Read engraving centers; ideal rigid four-bar reach inequality. Local constrained least-squares correction of crank pin, upper bell joint and fixed bell pivot, with equal weights, disk and output centers fixed, and 10px inner full-turn reach margin. Not a claim of uniquely intended hidden geometry.',rawLengthsPixels:lengths(origin),rawInnerReachMarginPixels:slack(origin),invalidSampleCount:invalid.length,totalSamples:4097,firstInvalidPhase:invalid[0],lastInvalidPhase:invalid.at(-1),fittedLengthsPixels:lengths(x),fittedInnerReachMarginPixels:slack(x),minimumIntersectionHeightWorld:minHeight,iterations,adjustments:['crankPin','input','pivot'].map((name,i)=>({name,measured:origin.slice(i*2,i*2+2),fitted:x.slice(i*2,i*2+2),distancePixels:Math.hypot(x[i*2]-origin[i*2],x[i*2+1]-origin[i*2+1])})),fittedSource:fitted,sources:['scripts/fit-pinned-elbow-source.mjs','src/simulation/pinned-elbow-motion.js','public/engravings/mm_157.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('src/simulation/pinned-elbow-fit.js',`// Reproduced by scripts/fit-pinned-elbow-source.mjs; see docs/movement-157.md.\nexport const pinnedElbowFittedSource=${JSON.stringify(fitted)};\n`);
fs.writeFileSync('docs/validation/157-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(report);
