import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {diagonalCatchProfile,diagonalLatchFinger} from '../src/simulation/mujoco-diagonal-catch/catch-profile.js';
const project=(rings,pivot,angle,origin)=>rings.map(r=>'M'+r.map(([x,y])=>{
 const c=Math.cos(angle),s=Math.sin(angle);
 return [origin[0]+80*(pivot[0]+c*x-s*y),origin[1]-80*(pivot[1]+s*x+c*y)].join(',');
}).join('L')+'Z').join('');
let html='<body style="margin:0;background:white;display:flex">';
for(const id of [181,182]){
 const origin=id===181?[271,234]:[270,236];
 html+='<svg width="525" height="555" viewBox="0 0 525 555">';
 html+=`<image width="525" height="525" href="data:image/png;base64,${fs.readFileSync('public/engravings/mm_'+id+'.png').toString('base64')}"/>`;
 html+=`<path fill="#d23b45" fill-opacity=".35" stroke="#b21e30" stroke-width="1" fill-rule="evenodd" d="${project(diagonalCatchProfile().polygons.flat(),[0,0],id===181?0:.032,origin)}"/>`;
 for(const side of ['upper','lower']){
  const f=diagonalLatchFinger(side);
  html+=`<path fill="#0066cc" fill-opacity=".5" stroke="#0050aa" stroke-width="1" d="${project(f.polygons.flat(),f.fit.pivot,id===181?0:f.fit.angle,origin)}"/>`;
 }
 html+=`<text x="12" y="547" font-family="sans-serif" font-size="16">${id}: candidate catch (red), contact fingers (blue)</text></svg>`;
}
fs.writeFileSync('/dev/shm/181-candidate-profiles.html',html);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1050,height:555}});
 await page.setContent(html);await page.screenshot({path:'/dev/shm/181-candidate-profiles.png'});
}finally{await browser.close();}
console.log('/dev/shm/181-candidate-profiles.html\n/dev/shm/181-candidate-profiles.png');
