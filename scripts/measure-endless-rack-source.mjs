import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/119-source',file='public/engravings/mm_119.png';
const sources=freezeStudySources([file,'scripts/measure-endless-rack-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,525*525);
const black=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]<110;
function strokes(point,direction,lo,hi){let first;const runs=[];for(let t=lo;t<=hi+.01;t+=.25){if(black(point[0]+t*direction[0],point[1]+t*direction[1]))first??=t;else if(first!==undefined){if(first>lo&&t-first<9)runs.push((first+t-.25)/2);first=undefined;}}return runs;}
const circles={};for(const [name,center,radius]of [['hole0',[158,301],6],['hole1',[160,336],6],['hole2',[374,307],7],['hole3',[371,336],6],['hub',[270,232],13]]){
 const points=[];for(let deg=0;deg<360;deg+=5){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=strokes(center,v,radius-3.5,radius+3.5).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius))[0];if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}circles[name]=circleFit(points);
}
const lines={};for(const [name,a,b,span]of [['topBeamTop',[80,120],[450,119],3],['topBeamBottom',[80,168],[450,168],4],['bottomBeamTop',[88,441],[444,440],4],['bottomBeamBottom',[85,483],[444,482],4],['leftRodTop',[18,306],[105,306],3],['leftRodBottom',[20,335],[105,335],6],['rightRodTop',[437,306],[490,309],4],['rightRodBottom',[438,334],[489,336],4]]){
 const points=[];for(let x=a[0];x<=b[0];x+=2){const y=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]),r=strokes([x,y],[0,1],-span,span).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(r!==undefined)points.push([x,y+r]);}
 assert(points.length>10,name);const mx=points.reduce((s,p)=>s+p[0]/points.length,0),my=points.reduce((s,p)=>s+p[1]/points.length,0),slope=points.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/points.reduce((s,p)=>s+(p[0]-mx)**2,0),intercept=my-slope*mx;lines[name]={points,slope,intercept,rms:Math.sqrt(points.reduce((s,p)=>s+(p[1]-slope*p[0]-intercept)**2,0)/points.length)};
}
const verticals={};for(const [name,x,lo,hi]of [['guideLeft',242,280,430],['guideRight',298,280,432],['slotLeft',260,279,402],['slotRight',281,283,401]]){
 const points=[];for(let y=lo;y<=hi;y+=2){const r=strokes([x,y],[1,0],-4,4).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(r!==undefined)points.push([x+r,y]);}verticals[name]={points,x:points.reduce((s,p)=>s+p[0]/points.length,0)};
}
const contours={};for(const [name,center,range,angleRange]of [['pinion',[270,233],[24,44],[-180,18]],['rackLeft',[160,320],[38,65],[95,265]],['rackRight',[374,320],[38,65],[-85,85]]]){
 const points=[];for(let deg=angleRange[0];deg<=angleRange[1];deg+=2){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=strokes(center,v,...range).at(-1);if(r===undefined)continue;const p=center.map((x,i)=>x+r*v[i]);if(name==='pinion'&&(Math.abs(p[0]-242)<4||Math.abs(p[0]-298)<4))continue;points.push(p);}contours[name]={center,points};
}
for(const [name,y,lo,hi]of [['rackTop',268,158,389],['rackBottom',374,149,389]]){
 const points=[];for(let x=lo;x<=hi;x+=1.5){if(x>237&&x<303)continue;const rs=strokes([x,y],[0,1],-13,13);if(rs.length)points.push([x,y+(name==='rackTop'?rs[0]:rs.at(-1))]);}contours[name]={points};
}
const report={sources,file,sha256:hashStudyFile(file),circles,lines,verticals,contours,qualification:'Independent bounded ink midpoints. Eight pinion teeth, eight teeth per straight rack side and six per rounded end are counted manually. Guide/rack overlap is excluded where explicit windows permit; obscured geometry and hidden depths need reconstruction.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+Object.entries({circles,lines,verticals,contours}).flatMap(([group,entries])=>Object.values(entries).flatMap(e=>e.points.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r=".8" fill="'+({circles:'blue',lines:'green',verticals:'orange',contours:'red'}[group])+'"/>'))).join('')+'</svg>';
fs.writeFileSync(prefix+'-points.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'-points.svg',prefix+'-points.png']);
console.log({circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,n:c.points.length}])),verticals:Object.fromEntries(Object.entries(verticals).map(([n,c])=>[n,{x:c.x,n:c.points.length}])),lines:Object.fromEntries(Object.entries(lines).map(([n,c])=>[n,{slope:c.slope,intercept:c.intercept,rms:c.rms,n:c.points.length}])),contours:Object.fromEntries(Object.entries(contours).map(([n,c])=>[n,c.points.length]))});
