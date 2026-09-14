import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/116-fit',input=process.env.SOURCE_REPORT??'/dev/shm/116-source-a.json',s=JSON.parse(fs.readFileSync(input)),sources=freezeStudySources([input,'scripts/fit-rack-rectifier-source.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix),candidates=[],rows={},shifted=process.env.SHIFTED==='1';
for(const side of ['upper','lower']){
 const ps=s.teeth.filter(p=>p.side===side),mx=ps.reduce((a,p)=>a+p.index/ps.length,0),my=ps.reduce((a,p)=>a+p.center/ps.length,0),pitch=ps.reduce((a,p)=>a+(p.index-mx)*(p.center-my),0)/ps.reduce((a,p)=>a+(p.index-mx)**2,0),origin=my-mx*pitch;rows[side]={pitch,origin,rms:Math.sqrt(ps.reduce((a,p)=>a+(p.center-origin-pitch*p.index)**2,0)/ps.length)};
}
for(let teeth=10;teeth<=18;teeth++)for(let j=0;j<=(shifted?12:28);j++)for(const cutterRadius of shifted?[54,54.5,55,55.5,56,56.5,57]:[null]){
 const module=(shifted?7:6.8)+j*.1,radius=teeth*module/2;if(radius<36||radius>62)continue;
 const profileShift=shifted?(cutterRadius-radius)/module:0;
 const g=roundedRackGear({teeth,module,depth:1,boreRadius:20,addendum:.8,dedendum:1.25,profileShift,tipRadius:.12*module,samples:128,cutterSteps:2048}),rs=g.userData.outline.slice(0,128).map(p=>p.length()),angularPitch=2*Math.PI/teeth,pitch=Math.PI*module;
 const radial=a=>{const t=(((a/angularPitch+.5)%1+1)%1)*128,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%128]*f;};let best;
 for(let i=0;i<512;i++){
  const phase=i*angularPitch/512,errors=s.gear.map(p=>radial(p.angle-phase)-p.radius),gearScore=errors.reduce((a,e)=>a+e*e,0)/errors.length,origins={};
  for(const side of ['upper','lower']){const base=radius*(Math.PI/2+(side==='upper'?-phase:phase))+pitch/2,mean=s.teeth.filter(p=>p.side===side).reduce((a,p,_,ps)=>a+(p.center-s.axis[0]-pitch*p.index)/ps.length,0);origins[side]=base+Math.round((mean-base)/pitch)*pitch;}
  const rackErrors=s.teeth.map(p=>s.axis[0]+origins[p.side]+pitch*p.index-p.center),rackScore=rackErrors.reduce((a,e)=>a+e*e,0)/rackErrors.length,score=gearScore+rackScore;
  if(!best||score<best.score)best={teeth,modulePixels:module,radius,profileShift,cutterRadius:radius+profileShift*module,phase,origins,pitch,gearRms:Math.sqrt(gearScore),rackRms:Math.sqrt(rackScore),score,gearErrors:errors,rackErrors};
 }candidates.push(best);g.dispose();
}
candidates.sort((a,b)=>a.score-b.score);const report={sources,shifted,rows,candidates,qualification:'Diagnostic equal-phase pinion count/module fit. One pitch and two rack origins keep the front and rear pinions superimposed at the source pose. Gear radial errors and rack center errors have equal mean-square weight. Final solid geometry and native contact require separate qualification.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({rows,candidates:candidates.slice(0,10).map(({gearErrors,rackErrors,...r})=>r)});
