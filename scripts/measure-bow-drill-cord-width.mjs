import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/124-cord-width';
const file='public/engravings/mm_124.png',input=process.env.SOURCE_REPORT??'/dev/shm/124-source-c.json';
const sources=freezeStudySources([file,input,'scripts/measure-bow-drill-cord-width.mjs','scripts/lib/study-report-io.mjs'],prefix);
const source=JSON.parse(fs.readFileSync(input)),pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const readings=[];
for(const p of source.string){
  const slope=p[1]<248?-.878482142857143:-.9127080463495663;
  const normal=[1/Math.hypot(1,slope),-slope/Math.hypot(1,slope)];
  const bands=[];let start;
  for(let i=0;i<=160;i++){
    const t=-8+i/10,x=Math.round(p[0]+normal[0]*t),y=Math.round(p[1]+normal[1]*t);
    if(pixels[y*525+x]<110)start??=t;
    else if(start!==undefined){bands.push({lo:start,hi:t-.1,mid:(start+t-.1)/2});start=undefined;}
  }
  if(bands.length!==2)continue;
  const centers=[bands[0].mid,bands[1].mid];
  readings.push({point:p,bands,contours:centers.map(t=>p.map((v,i)=>v+normal[i]*t)),width:centers[1]-centers[0]});
}
const widths=readings.map(r=>r.width).sort((a,b)=>a-b),median=widths[Math.floor(widths.length/2)],mean=widths.reduce((s,x)=>s+x,0)/widths.length;
const report={sources,readings,medianWidthPixels:median,meanWidthPixels:mean,range:[widths[0],widths.at(-1)],qualification:'Distance between the centers of two distinct engraved outline bands, sampled normal to independently fitted free-cord directions. Stations with merged/ambiguous ink bands are excluded; these are source drawing measurements, not physical material calibration.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+readings.flatMap(r=>r.contours.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".6" fill="magenta"/>`)).join('')+'</svg>';
fs.writeFileSync(prefix+'.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'.svg',prefix+'.png']);
console.log({readings:readings.length,medianWidthPixels:median,meanWidthPixels:mean,range:report.range,examples:readings.filter((r,i)=>i%10===0)});
