import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from '../node_modules/playwright-core/lib/utilsBundle.js';

// Outer ink on the unobscured left/lower wheel, measured directly in the source PNG.
const source='public/engravings/mm_155.png',png=PNG.sync.read(fs.readFileSync(source));
const center=[226,300],rows=[];
for(let tick=0;tick<=2300;tick++){
 const degrees=115+tick*.1,a=degrees*Math.PI/180;let radius=null;
 for(let r=222;r>=175;r-=.25){const x=Math.round(center[0]+r*Math.cos(a)),y=Math.round(center[1]-r*Math.sin(a));if(png.data[4*(y*png.width+x)]<100){radius=r;break;}}
 rows.push({degrees,radius});
}
let run=null;const runs=[];
for(const row of rows){if(row.radius>201){run??={start:row.degrees};run.end=row.degrees;}else if(run){runs.push(run);run=null;}}
if(run)runs.push(run);
const tips=runs.filter(r=>r.end-r.start>1&&r.start>115&&r.end<345).map(r=>({...r,center:(r.start+r.end)/2}));
const candidates=Array.from({length:7},(_,i)=>20+i).map(teeth=>{
 const pitch=360/teeth,phase=tips.reduce((s,t,i)=>s+t.center-i*pitch,0)/tips.length;
 const errors=tips.map((t,i)=>t.center-phase-i*pitch);
 return {teeth,pitchDegrees:pitch,phaseDegrees:phase,rmsDegrees:Math.hypot(...errors)/Math.sqrt(errors.length),maximumDegrees:Math.max(...errors.map(Math.abs))};
}).sort((a,b)=>a.rmsDegrees-b.rmsDegrees);
const values=rows.map(r=>r.radius).filter(r=>r!==null).sort((a,b)=>a-b),quantile=f=>values[Math.floor(f*(values.length-1))];
const report={movement:155,method:'Outermost dark pixel sampled every .1 degree and .25px radius over 115–345 degrees, excluding the obscured upper/right sector. Complete runs above radius 201px identify 14 visible tooth tips. Fit consecutive tip centers to candidate integer counts; the hidden tooth count is inferred, not observed. Nearest-pixel and ink-thickness uncertainty are approximately 2px.',center,radialQuantiles:{p10:quantile(.1),p25:quantile(.25),median:quantile(.5),p75:quantile(.75),p90:quantile(.9)},tipRuns:tips,candidates,conclusion:'The production 20-tooth model with 154px root radius is inconsistent with the visible silhouette. The 154px circle is internal decoration; exposed tooth roots are near 182–184px. A regular 23-tooth reconstruction fits the visible spacing better than 20 or 22, but the drawing is not exactly periodic and hidden teeth cannot establish the count.',sources:[source,'scripts/measure-elbow-pawl-source.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/155-source-teeth.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync('/dev/shm/155-radial-ink.json',JSON.stringify(rows));
const dots=tips.map(t=>{const a=t.center*Math.PI/180;return `<circle cx="${226+211*Math.cos(a)}" cy="${300-211*Math.sin(a)}" r="3" fill="#00966c"/>`;}).join('');
const profile=(n,phase,root,tip)=>Array.from({length:n},(_,i)=>[-.25,-.25,.25,.25].map((offset,j)=>{const a=(phase+(i+offset)*360/n)*Math.PI/180,r=j===0||j===3?root:tip;return `${226+r*Math.cos(a)},${300-r*Math.sin(a)}`;})).flat().join(' ');
const best=candidates[0];
fs.writeFileSync('docs/validation/155-source-teeth.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="565" viewBox="0 0 1050 565"><rect width="1050" height="565" fill="white"/><image href="../../public/engravings/mm_155.png" width="525" height="525"/><g fill="none" stroke-width="1.4"><circle cx="226" cy="300" r="154" stroke="#e63946"/><circle cx="226" cy="300" r="183" stroke="#00966c" stroke-dasharray="4 3"/></g>${dots}<text x="12" y="545" font-size="14">Red: old tooth roots. Green: measured root region and visible tips.</text><g transform="translate(525 0)"><image href="../../public/engravings/mm_155.png" width="525" height="525"/><polygon points="${profile(best.teeth,best.phaseDegrees,183,210)}" fill="none" stroke="#0077b6" stroke-width="1.2"/><text x="12" y="545" font-size="14">Candidate ${best.teeth} teeth; hidden count remains inferred.</text></g></svg>\n`);
console.log({radialQuantiles:report.radialQuantiles,candidates});
