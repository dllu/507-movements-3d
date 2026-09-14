import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/125-tips',input=process.env.SOURCE_REPORT??'/dev/shm/125-source-c.json',source=JSON.parse(fs.readFileSync(input));
const sources=freezeStudySources([input,source.file,'scripts/measure-cascaded-traverse-tooth-tips.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix),gears={};
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
for(const[name,g]of Object.entries(source.gears)){
 let center=g.center,caps,fit;const iterations=[];
 for(let iteration=0;iteration<4;iteration++){
  const polar=g.points.map(p=>({point:p,angle:Math.atan2(p[1]-center[1],p[0]-center[0]),radius:Math.hypot(p[0]-center[0],p[1]-center[1])}));
  caps=polar.filter(p=>p.radius>=Math.max(...polar.filter(q=>Math.abs(delta(p.angle,q.angle))<Math.PI/18).map(q=>q.radius))-1.2).map(p=>p.point);
  fit=circleFit(caps);iterations.push({center:fit.center,radius:fit.radius,rms:fit.rmsResidual,samples:caps.length});center=fit.center;
 }
 const angles=caps.map(p=>Math.atan2(center[1]-p[1],p[0]-center[0])).sort((a,b)=>a-b),groups=[];
 for(const a of angles){if(!groups.length||a-groups.at(-1).at(-1)>3*Math.PI/180)groups.push([]);groups.at(-1).push(a);}
 if(groups.length>1&&Math.abs(delta(groups[0][0],groups.at(-1).at(-1)))<3*Math.PI/180){groups[0].push(...groups.pop().map(a=>a-2*Math.PI));}
 const tips=groups.filter(g=>g.length>=2).map(g=>({angle:Math.atan2(g.reduce((s,a)=>s+Math.sin(a),0),g.reduce((s,a)=>s+Math.cos(a),0)),samples:g.length})),counts=[];
 for(let n=name==='left'?17:name==='middle'?20:25;n<=(name==='left'?24:name==='middle'?28:34);n++){
  const c=tips.reduce((s,p)=>s+Math.cos(n*p.angle),0),s=tips.reduce((s,p)=>s+Math.sin(n*p.angle),0),phase=Math.atan2(s,c)/n,errors=tips.map(p=>delta(n*p.angle,n*phase)/n);
  counts.push({teeth:n,concentration:Math.hypot(c,s)/tips.length,phase,rmsDegrees:Math.sqrt(errors.reduce((s,v)=>s+v*v,0)/errors.length)*180/Math.PI});
 }
 gears[name]={iterations,center,radius:fit.radius,caps,tips,counts:counts.sort((a,b)=>b.concentration-a.concentration)};
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,gears,qualification:'Local outer-envelope points lie within 1.2 source pixels of the maximum sampled radius over a ±10-degree window. Four circle refinements remove hub eccentricity; retained cap clusters are separated by three degrees. Integer tooth-count evidence uses only cap angles, independent of a generated flank shape. Broken strokes and irregular pitches remain limitations.'},null,2)+'\n',{flag:'wx'});
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(source.file).toString('base64')+'"/>'+Object.values(gears).map(g=>`<circle cx="${g.center[0]}" cy="${g.center[1]}" r="${g.radius}" fill="none" stroke="blue" stroke-width=".5"/>`+g.caps.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".7" fill="magenta"/>`).join('')).join('')+'</svg>';fs.writeFileSync(prefix+'.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'.svg',prefix+'.png']);
console.log(JSON.stringify(Object.fromEntries(Object.entries(gears).map(([n,g])=>[n,{center:g.center,radius:g.radius,tips:g.tips.length,counts:g.counts.slice(0,3)}])),null,2));
