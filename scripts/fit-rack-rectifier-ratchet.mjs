import fs from 'node:fs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/116-ratchet-fit',input=process.env.SOURCE_REPORT??'/dev/shm/116-source-a.json',s=JSON.parse(fs.readFileSync(input)),sources=freezeStudySources([input,'scripts/fit-rack-rectifier-ratchet.mjs','scripts/lib/study-report-io.mjs'],prefix),candidates=[];
for(let teeth=3;teeth<=10;teeth++)for(const direction of [-1,1])for(const faceFraction of [.02,.04,.06,.08]){
 const pitch=2*Math.PI/teeth;let best;
 for(let i=0;i<1024;i++){
  const phase=i*pitch/1024,rows=s.ratchet.map(p=>{const a=(((direction*(p.angle-phase)/pitch)%1)+1)%1,x=a<1-faceFraction?a/(1-faceFraction):(1-a)/faceFraction;return{x,y:p.radius};}),mx=rows.reduce((a,p)=>a+p.x/rows.length,0),my=rows.reduce((a,p)=>a+p.y/rows.length,0),height=rows.reduce((a,p)=>a+(p.x-mx)*(p.y-my),0)/rows.reduce((a,p)=>a+(p.x-mx)**2,0),root=my-height*mx,tip=root+height;
  if(root<22||root>29||tip<32||tip>40)continue;
  const residuals=rows.map(p=>p.y-root-height*p.x),rms=Math.sqrt(residuals.reduce((a,e)=>a+e*e,0)/rows.length);if(!best||rms<best.rms)best={teeth,direction,faceFraction,phase,root,tip,rms,maximum:Math.max(...residuals.map(Math.abs)),residuals};
 }if(best)candidates.push(best);
}
candidates.sort((a,b)=>a.rms-b.rms);verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,candidates,qualification:'Diagnostic linear-radius long flank and short return flank fitted to measured ink rays. Pawl-obscured angles are omitted. This selects count, handedness and dimensions; an actual contact-compatible finite ratchet/pawl pair is still required.'},null,2)+'\n',{flag:'wx'});console.log(candidates.slice(0,8).map(({residuals,...r})=>r));
