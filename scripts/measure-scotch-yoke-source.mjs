import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';

const file='public/engravings/mm_093.png';
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
const circles={};
for(const [name,center,range,nominal] of [
  ['disk',[266,301],[132,144],138],['hub',[266,301],[28,36],32],
  ['shaft',[266,301],[15,23],19],['wrist',[357,240],[17,24],20],
]) {
  const points=[];
  for(let degrees=0;degrees<360;degrees+=3) {
    const angle=degrees*Math.PI/180;
    if(name==='disk') {
      const x=center[0]+nominal*Math.cos(angle),y=center[1]+nominal*Math.sin(angle);
      if(Math.abs(x-267)<20||y>199&&y<280)continue;
    }
    const runs=[];let run=[];
    for(let r=range[0];r<=range[1];r+=.2) {
      if(pixel(center[0]+r*Math.cos(angle),center[1]+r*Math.sin(angle))<110)run.push(r);
      else if(run.length){runs.push(run);run=[];}
    }
    if(run.length)runs.push(run);
    const choices=runs.filter(r=>r[0]>range[0]&&r.at(-1)<range[1]-.1)
      .sort((a,b)=>Math.abs((a[0]+a.at(-1))/2-nominal)-Math.abs((b[0]+b.at(-1))/2-nominal));
    if(!choices.length)continue;
    const r=(choices[0][0]+choices[0].at(-1))/2;
    points.push([center[0]+r*Math.cos(angle),center[1]+r*Math.sin(angle)]);
  }
  circles[name]=circleFit(points);
}
const faces={};
for(const [name,range] of [['outerTop',[195,209]],['slotTop',[214,225]],['slotBottom',[252,264]],['outerBottom',[270,283]]]) {
  const points=[];
  for(let x=145;x<=387;x+=8) {
    if(x>333&&x<380)continue;
    const runs=[];let run=[];
    for(let y=range[0];y<=range[1];y++) {
      if(pixel(x,y)<110)run.push(y);
      else if(run.length){runs.push(run);run=[];}
    }
    if(run.length)runs.push(run);
    const complete=runs.filter(r=>r[0]>range[0]&&r.at(-1)<range[1]);
    if(complete.length!==1)continue;
    points.push([x,(complete[0][0]+complete[0].at(-1))/2]);
  }
  const values=points.map(p=>p[1]).sort((a,b)=>a-b),middle=(values.length-1)/2;
  faces[name]={points,median:(values[Math.floor(middle)]+values[Math.ceil(middle)])/2,min:values[0],max:values.at(-1)};
}
const result={file,sha256:hashStudyFile(file),circles,faces,
  qualification:'Fits to complete ink runs. Disk measurements exclude the overlaid yoke and stems; hub and shaft remain partly occluded. Straight yoke faces use scanline midlines, excluding the wrist. Capsule ends and concentric axes remain reconstruction assumptions.'};
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/093-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])));
console.log(Object.fromEntries(Object.entries(faces).map(([name,f])=>[name,{median:f.median,min:f.min,max:f.max,count:f.points.length}])));
