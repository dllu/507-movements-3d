import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/112-source',file='public/engravings/mm_112.png';
const sources=freezeStudySources([file,'scripts/measure-persian-drill-source.mjs','scripts/lib/study-report-io.mjs'],prefix);
const pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(pixels.length,525*525);
const black=(x,y)=>pixels[Math.round(y)*525+Math.round(x)]<110;
const stats=a=>({count:a.length,rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),maximum:Math.max(...a.map(Math.abs))});
const runs=(x,y,axis,span)=>{let first;const values=[];for(let d=-span;d<=span+.01;d+=.25){if(black(x+(axis===0?d:0),y+(axis===1?d:0)))first??=d;else if(first!==undefined){if(first>-span&&d-first<8)values.push((first+d-.25)/2);first=undefined;}}return values;};
const edges={};
for(const [name,seed,axis,ranges]of [
 ['stockLeft',245,0,[[150,239],[305,404]]],['stockRight',269,0,[[150,239],[305,404]]],
 ['stockTop',147,1,[[247,265]]],['stockBottom',411,1,[[246,269]]],
 ['headTop',88,1,[[250,267]]],['headBottom',146,1,[[235,280]]],
 ['gripTop',247,1,[[224,290]]],['gripBottom',298,1,[[216,301]]],
 ['chuckTop',411,1,[[240,272]]],['chuckBottom',441,1,[[240,270]]],
 ['bitLeft',248,0,[[445,475]]],['bitRight',262,0,[[445,475]]],
]) {
 const points=[];for(const [lo,hi]of ranges)for(let t=lo;t<=hi;t++){const p=axis===0?[seed,t]:[t,seed],d=runs(...p,axis,4).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push([p[0]+(axis===0?d:0),p[1]+(axis===1?d:0)]);}
 assert(points.length,name);const value=points.reduce((s,p)=>s+p[axis],0)/points.length;edges[name]={value,axis,points,...stats(points.map(p=>p[axis]-value))};
}
const axis=(edges.stockLeft.value+edges.stockRight.value)/2,radius=(edges.stockRight.value-edges.stockLeft.value)/2,profiles={},omittedProfileRows=[];
for(const [name,y0,y1,x0,x1]of [['head',89,145,198,312],['grip',248,297,207,310],['chuck',414,438,232,281],['bit',442,495,242,269]]) {
 const rows=[];for(let y=y0;y<=y1;y++) {
  const bands=[];let start;for(let x=x0;x<=x1+1;x++){if(x<=x1&&black(x,y))start??=x;else if(start!==undefined){bands.push([start,x-1]);start=undefined;}}
  if(!bands.length)continue;const first=bands[0],last=bands.at(-1),left=first[1]-first[0]<8?(first[0]+first[1])/2:first[0]+1,right=last[1]-last[0]<8?(last[0]+last[1])/2:last[1]-1;
  if(left>=axis||right<=axis){omittedProfileRows.push({name,y,left,right,reason:'Thresholded bands do not supply an edge on both sides of the shaft axis.'});continue;}
  rows.push({y,left,right,radius:(right-left)/2,center:(left+right)/2});
 }profiles[name]=rows;
}
const points=[];
for(const [region,seed,pitch,offset,first,last]of [['upper',171.5,12.85,0,-1,5],['lower',334.5,12.15,13,-2,5]])for(let local=first;local<=last;local++)for(let x=248;x<=264;x+=2) {
 const y=seed+pitch*local-1.13*(x-254);if(!((y>152&&y<240)||(y>307&&y<403)))continue;
 const d=runs(x,y,1,4).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push({region,x,y:y+d,turn:offset+local});
}
// Fit a continuous cylindrical helix to fixed, assigned source bands. For an
// n-start thread y = intercept + pitch * (turn - n * asin(x/r) / (2*pi)).
const candidates=[];
for(let starts=1;starts<=10;starts++) {
 const coords=points.map(p=>p.turn-starts*Math.asin((p.x-axis)/radius)/(2*Math.PI)),meanX=coords.reduce((a,b)=>a+b,0)/coords.length,meanY=points.reduce((s,p)=>s+p.y,0)/points.length;
 const pitch=coords.reduce((s,x,i)=>s+(x-meanX)*(points[i].y-meanY),0)/coords.reduce((s,x)=>s+(x-meanX)**2,0),intercept=meanY-pitch*meanX;
 const residuals=points.map((p,i)=>intercept+pitch*coords[i]-p.y);candidates.push({starts,pitch,intercept,residuals,...stats(residuals)});
}
candidates.sort((a,b)=>a.rms-b.rms);const chosen=candidates[0];
const report={sources,file,sha256:hashStudyFile(file),axis,radius,edges,profiles,omittedProfileRows,thread:{points,candidates,chosen},qualification:'Manual edge windows and assigned diagonal bands; thresholded ink midlines. An integer multi-start helix is inferred by least-squares residual among one to ten starts. Brown specifies no start count or hidden thread form.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({axis,radius,edges:Object.fromEntries(Object.entries(edges).map(([k,v])=>[k,v.value])),thread:candidates.map(({starts,pitch,intercept,count,rms,maximum})=>({starts,pitch,intercept,count,rms,maximum})),profiles:Object.fromEntries(Object.entries(profiles).map(([k,v])=>[k,v.filter((r,i)=>i%5===0)]))});
