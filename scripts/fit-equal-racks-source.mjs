import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/115-fit',input=process.env.SOURCE_REPORT??'/dev/shm/115-source-a.json',s=JSON.parse(fs.readFileSync(input)),sources=freezeStudySources([input,'scripts/fit-equal-racks-source.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix),candidates=[],rows={},shifted=process.env.SHIFTED==='1';
for(const side of ['upper','lower']){
 const ps=s.teeth.filter(p=>p.side===side),mx=ps.reduce((a,p)=>a+p.index/ps.length,0),my=ps.reduce((a,p)=>a+p.center/ps.length,0),pitch=ps.reduce((a,p)=>a+(p.index-mx)*(p.center-my),0)/ps.reduce((a,p)=>a+(p.index-mx)**2,0),origin=my-mx*pitch;
 rows[side]={pitch,origin,rms:Math.sqrt(ps.reduce((a,p)=>a+(p.center-origin-pitch*p.index)**2,0)/ps.length)};
}
for(let teeth=10;teeth<=16;teeth++)for(const module of shifted?Array.from({length:25},(_,i)=>8.4+.05*i):[2*s.pitchRadius/teeth]){
 const referenceRadius=teeth*module/2,alpha=Math.PI/9,cosine=referenceRadius*Math.cos(alpha)/s.pitchRadius;if(cosine>1)continue;
 const workingAngle=Math.acos(cosine),inv=a=>Math.tan(a)-a,profileShift=shifted?teeth*(inv(workingAngle)-inv(alpha))/(2*Math.tan(alpha)):0;
 const g=roundedRackGear({teeth,module,depth:1,boreRadius:20,addendum:.8,dedendum:1.05,profileShift,tipRadius:.12*module,samples:128,cutterSteps:2048}),rs=g.userData.outline.slice(0,128).map(p=>p.length()),angularPitch=2*Math.PI/teeth,pitch=Math.PI*module;
 const radial=a=>{const t=(((a/angularPitch+.5)%1+1)%1)*128,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%128]*f;};let best;
 for(let i=0;i<1024;i++){
  const phase=i*angularPitch/1024,lowerPhase=Math.PI/teeth-phase,errors=[];
  for(const [side,a]of [['upper',phase],['lower',lowerPhase]])for(const p of s.gear[side])errors.push(radial(p.angle-s.tilt-a)-p.radius);
  const gearScore=errors.reduce((a,e)=>a+e*e,0)/errors.length;
  const origins={};for(const [side,a]of [['upper',phase],['lower',lowerPhase]]){
   const base=referenceRadius*(side==='upper'?Math.PI/2-a:a+Math.PI/2)+pitch/2,mean=s.teeth.filter(p=>p.side===side).reduce((a,p,_,ps)=>a+((p.center-s.axis[0])*Math.cos(s.tilt)+(s.axis[1]-p.y)*Math.sin(s.tilt)-pitch*p.index)/ps.length,0);
   origins[side]=base+Math.round((mean-base)/pitch)*pitch;
  }
  const rackErrors=s.teeth.map(p=>{const x=origins[p.side]+p.index*pitch,y=(s.axis[1]-p.y-x*Math.sin(s.tilt))/Math.cos(s.tilt);return s.axis[0]+x*Math.cos(s.tilt)-y*Math.sin(s.tilt)-p.center;}),rackScore=rackErrors.reduce((a,e)=>a+e*e,0)/rackErrors.length,score=gearScore+rackScore;
  if(!best||score<best.score)best={teeth,modulePixels:module,profileShift,workingAngle,phase,lowerPhase,origins,pitch,gearRms:Math.sqrt(gearScore),rackRms:Math.sqrt(rackScore),score,gearErrors:errors,rackErrors};
 }candidates.push(best);g.dispose();
}
candidates.sort((a,b)=>a.score-b.score);const report={sources,shifted,rows,candidates,qualification:'Diagnostic coupled phase/tooth-count fit with equal shaft spacing. Shifted trials preserve twelve-position candidates while allowing a different reference and working pitch radius; addendum .8 and dedendum 1.05 are provisional. Radial contour errors and actual rack-center x errors have equal mean-square weight. Final generated surface comparison and native closed-loop contact are required.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({rows,candidates:candidates.slice(0,8).map(({teeth,modulePixels,profileShift,workingAngle,phase,lowerPhase,origins,gearRms,rackRms,score})=>({teeth,modulePixels,profileShift,workingAngle,phase,lowerPhase,origins,gearRms,rackRms,score}))});
