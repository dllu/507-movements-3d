import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/123-source',file='public/engravings/mm_123.png';
const sources=freezeStudySources([file,'scripts/measure-sector-handoff-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(pixels.length,525*525);
const ink=(x,y)=>x>=0&&y>=0&&x<525&&y<525&&pixels[Math.round(y)*525+Math.round(x)]<110;
function runs(p,v,lo,hi,maxWidth=9){const result=[];let start;for(let t=lo;t<=hi+.01;t+=.25){if(ink(p[0]+t*v[0],p[1]+t*v[1]))start??=t;else if(start!==undefined){if(start>lo&&t-start<maxWidth)result.push((start+t-.25)/2);start=undefined;}}return result;}
const circles={};
for(const[name,center,radius,span,degrees]of [
 ['leftHub',[97,257],24,5,[-180,180]],['rightHub',[388,255],26,5,[-180,180]],
 ['leftShaft',[97,257],18,4,[-180,180]],['rightShaft',[388,255],18,4,[-180,180]],
 ['camInner',[279,256],13,5,[-80,80]],['camOuter',[279,256],21,5,[-80,80]],
]){const points=[];for(let deg=degrees[0];deg<degrees[1];deg+=2){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=runs(center,v,radius-span,radius+span).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius))[0];if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}assert(points.length>15,name);circles[name]=circleFit(points);}
const gears={};
for(const[name,center,lo,hi,degrees]of [
 ['leftSector',circles.leftHub.center,103,141,[-78,75]],['rightSector',circles.rightHub.center,106,145,[-78,77]],
 ['leftSpur',circles.leftHub.center,47,80,[106,256]],['rightSpur',circles.rightHub.center,59,94,[108,248]],
 ['centerSpur',[245,256],54,90,[-64,69]],
]){const points=[];for(let deg=degrees[0];deg<degrees[1];deg+=.3){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=runs(center,v,lo,hi)[0];if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}gears[name]={center,points};}
const rack={left:[],right:[]};for(let y=112;y<=427;y+=.4){for(const[name,lo,hi]of [['left',202,233],['right',257,290]]){const x=runs([0,y],[1,0],lo,hi)[0];if(x!==undefined)rack[name].push([x,y]);}}
// Dotted stops give a diamond envelope rather than a unique circular pin.
const stops={upper:{center:[244,126],corners:[[244,116],[254,126],[244,136],[234,126]]},lower:{center:[243,401],corners:[[243,390],[253,401],[243,412],[233,401]]}};
const report={sources,file,sha256:hashStudyFile(file),circles,gears,rack,stops,qualification:'Independent bounded ink-midpoint circle, gear and rack samples. Dotted stop envelopes are manually read diamonds. Conjugate geometry, repeated handoff motion and hidden depth require separate reconstruction.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const groups={...circles,...gears,...Object.fromEntries(Object.entries(rack).map(([n,points])=>[n,{points}]))};
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+Object.entries(groups).flatMap(([n,g])=>g.points.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r=".6" fill="'+(n.endsWith('Sector')||n.endsWith('Spur')?'red':n==='left'||n==='right'?'green':'cyan')+'"/>')).join('')+Object.values(stops).map(s=>'<polygon points="'+s.corners.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="magenta" stroke-width=".7"/>').join('')+'</svg>';
fs.writeFileSync(prefix+'-points.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'-points.svg',prefix+'-points.png']);
console.log({circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,n:c.points.length}])),gears:Object.fromEntries(Object.entries(gears).map(([n,g])=>[n,g.points.length])),rack:Object.fromEntries(Object.entries(rack).map(([n,p])=>[n,p.length]))});
