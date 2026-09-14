import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const url='https://507movements.com/mm_131.html';
const html=process.env.SOURCE_HTML?fs.readFileSync(process.env.SOURCE_HTML,'utf8'):await(await fetch(url)).text();
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('add_model("mm_131")'));
assert(script,'source animation definition missing');
const calls=[],model=new Proxy({},{get:(_,name)=>(...args)=>{const id=calls.length;calls.push({name,args});return id;}});
vm.runInNewContext(script,{window:{},ae:{add_model:()=>model,geom:{ang_to:(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0])}}},{timeout:1000});
const stat=calls.find(c=>c.name==='add_stat'),rot=calls.find(c=>c.name==='add_rot'),rack=calls.find(c=>c.name==='add_pos_interp');
const v=createMovementModel(JSON.parse(fs.readFileSync('src/data/movements.json')).movements[130]);
try{
 let maximumRackError=0,maximumPinError=0;
 for(let i=0;i<=720;i++){
  const angle=-2*Math.PI*i/720,state=v.root.userData.configurationAtInputAngle(angle),imp=[];
  imp[calls.indexOf(stat)]=stat.args[1];
  const pin=rot.args[1].crank_pin,c=Math.cos(angle),s=Math.sin(angle);
  imp[calls.indexOf(rot)]={crank_pin:[pin[0]*c-pin[1]*s,pin[0]*s+pin[1]*c]};
  const u=rack.args[6]({imp}),ends=rack.args[7]({imp});
  // Both source breakpoints are zero: an interior parameter interpolates
  // from the last endpoint to the first (anilib.add_pos_interp semantics).
  const x=ends[1][0][0]+u*(ends[0][0][0]-ends[1][0][0]);
  maximumRackError=Math.max(maximumRackError,Math.abs(x*.5-state.rackX));
  const p=imp[calls.indexOf(rot)].crank_pin;
  maximumPinError=Math.max(maximumPinError,Math.hypot(p[0]*.5-state.pinPoint.x,(p[1]+6.5)*.5-state.pinPoint.y));
 }
 assert(maximumRackError<.00001);assert(maximumPinError<1e-12);
 const report={url,htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),samples:721,maximumRackError,maximumPinError,qualification:'Compares source animation coordinates at equal crank phases, not wall-clock timing or engraving contour alignment. Source rounded interpolation constants produce a small residual.'};
 fs.writeFileSync(process.env.PROBE_REPORT??'/dev/shm/131-source-comparison.json',JSON.stringify(report,null,2));console.log(report);
}finally{disposeObject3D(v.root);}
