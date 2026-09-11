import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const source='artifacts/reference/brown-078-detail.png',bytes=execFileSync('convert',[source,'-colorspace','Gray','-depth','8','gray:-'],{maxBuffer:4*1024*1024}),
 center=[590.1847816329412,748.5887383490219],rows=[];
for(let degrees=156;degrees<=177;degrees+=.25){
 const a=degrees*Math.PI/180,runs=[];let current=null;
 for(let r=325;r<=401;r+=.25){
  const point=[center[0]+r*Math.cos(a),center[1]-r*Math.sin(a)],pixel=point.map(Math.round),dark=bytes[pixel[1]*1270+pixel[0]]<70;
  if(dark){if(current)current.end=r;else{current={start:r,end:r};runs.push(current);}}else current=null;
 }
 rows.push({degrees,runs});
}
const report={movement:78,status:'source-undercut-radial-readings',productionChanged:false,mechanicsPassed:false,
 method:'Read the unmodified Brown crop as 8-bit grayscale. Nearest-pixel ray samples every 0.25 source pixels, r=325..401, angles 156..177 degrees about the measured outer-circle center. Save all contiguous ink runs below grayscale 70; no residual rejection.',
 center,rows,interpretation:'Multiple distinct ink runs on the same ray, followed by a sharp outer-radius drop after a tooth tip, support an undercut rather than a monotone radial sawtooth face. This local observation does not by itself fix every tooth root or prove the mechanism.',
 source:{file:source,sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')},
 script:{file:'scripts/read-pull-pawl-tooth-rays.mjs',sha256:crypto.createHash('sha256').update(fs.readFileSync('scripts/read-pull-pawl-tooth-rays.mjs')).digest('hex')},inspected:false};
fs.writeFileSync('artifacts/review/078-source-undercut-rays.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const selected=[156,160,161,169,172,174],colors=['#0055ff','#e000ff','#00bbff','#d40000','#00aa44','#ff8800'],
 path=(degrees,r)=>[center[0]+r*Math.cos(degrees*Math.PI/180),center[1]-r*Math.sin(degrees*Math.PI/180)],svg=
 '<svg xmlns="http://www.w3.org/2000/svg" width="1270" height="1300">'+selected.map((d,i)=>{
  const row=rows.find(r=>r.degrees===d),a=path(d,325),b=path(d,405);
  return `<path d="M${a}L${b}" stroke="${colors[i]}" stroke-width="1"/>`+row.runs.map(r=>`<path d="M${path(d,r.start)}L${path(d,r.end)}" stroke="${colors[i]}" stroke-width="4"/>`).join('')+`<text x="${b[0]-48}" y="${b[1]}" fill="${colors[i]}" font-size="17">${d}°</text>`;
 }).join('')+'</svg>';
fs.writeFileSync('artifacts/review/078-source-undercut-rays.svg',svg,{flag:'wx'});
console.log(rows.filter(r=>selected.includes(r.degrees)));
