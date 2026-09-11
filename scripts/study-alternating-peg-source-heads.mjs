import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
import {add,rotate} from './lib/alternating-peg-contact-study.mjs';
const sourceFile='artifacts/reference/brown-077-detail.png',image=fs.readFileSync(sourceFile).toString('base64'),
 variants=[{name:'Initial full lip; all-pin phase',options:{}},
  {name:'Working short lip; all-pin phase',options:{upperFace:Math.PI/6,lowerMouthAngle:-50*Math.PI/180}},
  {name:'Thin long lip; contact-pin phase',options:{upperFace:Math.PI/6,lowerMouthAngle:-95*Math.PI/180,lowerHeadRadius:.08,mouthRadius:.065,seatPhase:.9779706909646433}}],records=[];
const panels=variants.map((variant,i)=>{
 const {root}=makeAlternatingPegCandidate(variant.options),p=root.userData.geometry,to=P=>[p.center[0]+p.scale*P[0],p.center[1]-p.scale*P[1]],
  polygon=key=>root.userData.profiles[key].map(point=>to(add(p.pivots[key],rotate(point,p.initialAngles[key])))).map(P=>P.join(',')).join(' '),
  marks=['upper','lower'].map(key=>{const P=to(p.seats[key]);return`<polygon points="${polygon(key)}" fill="#00aafc" fill-opacity=".18" stroke="#007dc5" stroke-width="2"/><circle cx="${P[0]}" cy="${P[1]}" r="${p.pinRadius*p.scale}" fill="none" stroke="#e82951" stroke-width="2"/>`;}).join('');
 records.push({name:variant.name,options:variant.options,modeledPinCenters:Object.fromEntries(['upper','lower'].map(key=>[key,to(p.seats[key])])),stroke:p.stroke,lengths:p.lengths});
 return`<text x="${i*520+12}" y="25" font-size="17">${variant.name}</text><defs><clipPath id="panel${i}"><rect x="${i*520}" y="50" width="520" height="344"/></clipPath></defs><g clip-path="url(#panel${i})"><g transform="translate(${i*520},50) scale(.8) translate(-590,-440)"><image width="1300" height="1300" xlink:href="data:image/png;base64,${image}"/>${marks}</g></g>`;
}).join(''),prefix=process.env.PROBE_OUTPUT||'artifacts/review/077-source-head-contours-clipped';
fs.writeFileSync(prefix+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1560" height="430" font-family="DejaVu Sans"><rect width="100%" height="100%" fill="white"/>${panels}<text x="12" y="418" font-size="15">Blue: actual pawl outline in source coordinates. Red: modeled peg section. Contact contours remain provisional.</text></svg>`);
const converted=spawnSync('convert',[prefix+'.svg',prefix+'.png']);if(converted.status)throw Error(String(converted.stderr));
const sources=['scripts/study-alternating-peg-source-heads.mjs','scripts/lib/alternating-peg-candidate.mjs','scripts/lib/alternating-peg-contact-study.mjs',sourceFile];
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:77,productionChanged:false,mechanicsPassed:false,variants:records,
 plot:{file:prefix+'.png',sha256:crypto.createHash('sha256').update(fs.readFileSync(prefix+'.png')).digest('hex'),inspected:false},
 sources:sources.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))},null,2)+'\n');console.log(prefix);
