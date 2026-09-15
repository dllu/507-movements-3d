import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const source='public/engravings/mm_143.png',pixels=execFileSync('convert',[source,'-colorspace','Gray','-depth','8','gray:-']);
if(pixels.length!==525*525)throw new Error('Unexpected source image dimensions');
const center=[270,339],rows=[];
// Use only the exposed lower arc, away from the worm, frame and rod.
for(let degrees=35;degrees<145;degrees+=.25){
 const a=degrees*Math.PI/180;let radius=0;
 for(let r=42;r<59;r+=.1){const x=Math.round(center[0]+r*Math.cos(a)),y=Math.round(center[1]+r*Math.sin(a));if(pixels[y*525+x]<100)radius=r;}
 rows.push({degrees,radius});
}
const mean=rows.reduce((s,r)=>s+r.radius,0)/rows.length;
const harmonics=Array.from({length:9},(_,i)=>{
 const teeth=i+16;let cosine=0,sine=0;
 for(const r of rows){const a=r.degrees*Math.PI/180;cosine+=(r.radius-mean)*Math.cos(teeth*a);sine+=(r.radius-mean)*Math.sin(teeth*a);}
 return {teeth,amplitude:Math.hypot(cosine,sine)/rows.length};
});
const bands=[];let start=null;
for(let i=0;i<rows.length;i++){
 if(rows[i].radius>53&&start===null)start=i;
 if((rows[i].radius<=53||i===rows.length-1)&&start!==null){bands.push({from:rows[start].degrees,to:rows[i].degrees,outerInkRadius:Math.max(...rows.slice(start,i+1).map(r=>r.radius))});start=null;}
}
const report={movement:143,source,sha256:createHash('sha256').update(readFileSync(source)).digest('hex'),center,angularRange:[35,145],threshold:100,radialSearch:[42,59],harmonics,bands,rows,interpretation:'The lower arc favors 22 teeth among integer counts 16–24, with 21 a close second. The irregular ink outline reaches roughly 56–58 px. A regularized 56 px outside radius is a reconstruction choice, not a measured pitch radius. Whole-wheel overlay and mechanical checks remain required.'};
writeFileSync('docs/validation/143-wheel-measurement.json',JSON.stringify(report,null,2)+'\n');
const png=readFileSync(source).toString('base64');
const rings=[[56,'#ef6548'],[.77/.015,'#2572ce']].map(([r,color])=>`<circle cx="269.5" cy="338.75" r="${r}" stroke="${color}" stroke-width=".7" fill="none"/>`).join('');
writeFileSync('docs/validation/143-wheel-overlay.svg',`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 525 555"><image width="525" height="525" xlink:href="data:image/png;base64,${png}"/>${rings}<text x="14" y="543" font-size="10">Candidate: red outside radius 56 px; blue pitch radius 51.33 px.</text></svg>`);
console.log({harmonics,bands});
