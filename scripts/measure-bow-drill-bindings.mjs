import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/124-bindings';
const file='public/engravings/mm_124.png',sources=freezeStudySources([file,'scripts/measure-bow-drill-bindings.mjs','scripts/lib/study-report-io.mjs'],prefix);
const pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(pixels.length,525*525);
const rays=[];
for(let y=456;y<=479;y++)rays.push({feature:'lowerLeft',part:'lowerBinding',origin:[80,y],direction:[1,0],length:25});
for(let x=396;x<=416;x++)rays.push({feature:'upperTop',part:'upperBinding',origin:[x,95],direction:[0,1],length:17});
for(let x=394;x<=408;x++)rays.push({feature:'upperBottom',part:'upperBinding',origin:[x,124],direction:[0,-1],length:16});
for(let y=439;y<=444;y++)rays.push({feature:'lowerLooseEnd',part:'lowerBinding',origin:[122,y],direction:[-1,0],length:14});
for(let y=126;y<=133;y++)rays.push({feature:'upperLooseEnd',part:'upperBinding',origin:[399,y],direction:[-1,0],length:15});
const readings=[],excluded=[];
for(const r of rays){let first,last;for(let t=0;t<=r.length;t++){const x=r.origin[0]+t*r.direction[0],y=r.origin[1]+t*r.direction[1],ink=pixels[525*y+x]<140;if(ink){first??=t;last=t;}else if(first!==undefined)break;}if(first===undefined||first===0||last===r.length||last-first+1>6){excluded.push(r);continue;}readings.push({...r,band:[first,last],point:r.origin.map((x,k)=>x+(first+last)/2*r.direction[k])});}
const features=Object.fromEntries([...new Set(rays.map(r=>r.feature))].map(name=>[name,readings.filter(r=>r.feature===name)]));for(const [n,rs]of Object.entries(features))assert(rs.length>=3,n);
const report={sources,readings,excluded,qualification:'Centers of the first narrow outer ink band on bounded rays through the binding silhouettes. Thick merged shading and incomplete bands are excluded. Upper/bow and lower/string overlaps prevent a complete independent knot contour; these retained readings do not assert exact hidden knot topology.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+readings.map(r=>`<circle cx="${r.point[0]}" cy="${r.point[1]}" r=".65" fill="magenta"/>`).join('')+'</svg>';fs.writeFileSync(prefix+'.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'.svg',prefix+'.png']);console.log({readings:readings.length,features:Object.fromEntries(Object.entries(features).map(([n,rs])=>[n,rs.length])),excluded:excluded.length});
