import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/124-source',file='public/engravings/mm_124.png';
const sources=freezeStudySources([file,'scripts/measure-bow-drill-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(pixels.length,525*525);
const ink=(x,y,threshold)=>x>=0&&y>=0&&x<525&&y<525&&pixels[Math.round(y)*525+Math.round(x)]<threshold;
function runs(p,v,lo,hi,maxWidth=10,threshold=110){const result=[];let start;for(let t=lo;t<=hi+.01;t+=.25){if(ink(p[0]+t*v[0],p[1]+t*v[1],threshold))start??=t;else if(start!==undefined){if(start>lo&&t-start<maxWidth)result.push((start+t-.25)/2);start=undefined;}}return result;}
const circles={};for(const[name,center,radius,span]of [['outer',[306,307],44,5],['rim',[306,307],39,4],['hub',[306,307],28,4],['shaft',[305,304],16,4]]){const points=[];for(let deg=0;deg<360;deg+=2){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=runs(center,v,radius-span,radius+span).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius))[0];if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}assert(points.length>30,name);circles[name]=circleFit(points);}
// The first two narrow ink bands at each unoccluded bow station bound its stock.
const bowSeeds=[[130,340],[150,300],[172,267],[200,229],[220,210],[250,181],[280,160],[310,139],[340,123],[370,112],[400,104],[420,101],[440,101]];
const bow=[];for(let y=130;y<=440;y+=2){const i=Math.min(bowSeeds.length-2,bowSeeds.findIndex((p,j)=>bowSeeds[j+1]?.[0]>=y)),a=bowSeeds[i],b=bowSeeds[i+1],x=a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0]),xs=runs([0,y],[1,0],x-25,x+25,30,220);if(xs.length>=2&&xs[1]-xs[0]<60)bow.push({y,outer:[xs[0],y],inner:[xs[1],y],midpoint:[(xs[0]+xs[1])/2,y]});}
// Sample the free string span independently, away from knots and the pulley.
const string=[];for(let y=150;y<=425;y+=2){if(y>248&&y<340)continue;const expected=y<248?392-(y-150)*.885:207-(y-354)*.905,xs=runs([0,y],[1,0],expected-12,expected+12,20);if(xs.length)string.push([(xs[0]+xs.at(-1))/2,y]);}
const anchors={lower:[98,469],upper:[404,112],lowerString:[106,469],upperString:[416,121]},tipContour={lower:[[91,476],[94,492],[101,491],[105,470]],upper:[[413,105],[441,105],[446,109],[443,113],[414,115]]};
const report={sources,file,sha256:hashStudyFile(file),circles,bow,string,bowSeeds,anchors,tipContour,qualification:'Independent bounded ink readings. Bow end bindings and tips are manual measurements. Pulley depths, cord wrap and hand/shaft constraints require reconstruction.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const points=[...Object.values(circles).flatMap(c=>c.points.map(p=>[p,'cyan'])),...bow.flatMap(b=>[[b.outer,'red'],[b.inner,'red'],[b.midpoint,'green']]),...string.map(p=>[p,'magenta'])];
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+points.map(([p,c])=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r=".7" fill="'+c+'"/>').join('')+'</svg>';fs.writeFileSync(prefix+'-points.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'-points.svg',prefix+'-points.png']);
console.log({circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,n:c.points.length}])),bow:bow.length,string:string.length});
