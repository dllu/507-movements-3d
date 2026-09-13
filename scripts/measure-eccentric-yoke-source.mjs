import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {circleFit} from './lib/source-circle-fit.mjs';

const file='public/engravings/mm_090.png',width=525;
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*width+Math.round(x)]??255;
const circles={};
for (const [name,center,range,nominal] of [
  ['sheave',[277,275],[82,99],90],['collar',[232,275],[31,42],36],['shaft',[232,275],[23,31],26.5],
]) {
  const points=[],readings=[],missing=[];
  for(let degrees=0;degrees<360;degrees+=4) {
    const angle=degrees*Math.PI/180,runs=[];let run=[];
    for(let r=range[0];r<=range[1];r+=.25) {
      if(pixel(center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle))<80)run.push(r);
      else if(run.length){runs.push(run);run=[];}
    }
    if(run.length)runs.push(run);
    const choices=runs.filter(r=>r[0]>range[0]&&r.at(-1)<range[1]).sort((a,b)=>Math.abs((a[0]+a.at(-1))/2-nominal)-Math.abs((b[0]+b.at(-1))/2-nominal));
    if(!choices.length){missing.push(degrees);continue;}
    const chosen=choices[0],radius=(chosen[0]+chosen.at(-1))/2;
    const point=[center[0]+radius*Math.cos(angle),center[1]-radius*Math.sin(angle)];
    points.push(point);readings.push({degrees,point,stroke:[chosen[0],chosen.at(-1)]});
  }
  circles[name]={...circleFit(points),readings,missing};
}
const result={file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),circles,
  limits:'Circle fits to raster ink, with the shaft hatching and overlapping outlines capable of biasing readings. Depths, guides and rod extensions are not supplied by the engraving.'};
const prefix=process.env.PROBE_PREFIX??'/dev/shm/090-source';
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rms:c.rmsResidual,max:c.maximumResidual,points:c.points.length,missing:c.missing}])));
