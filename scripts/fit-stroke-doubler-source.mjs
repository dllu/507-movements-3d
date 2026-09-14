import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/118-fit',input=process.env.SOURCE_REPORT??'/dev/shm/118-source-a.json',s=JSON.parse(fs.readFileSync(input));
const sources=freezeStudySources([input,'scripts/fit-stroke-doubler-source.mjs','src/simulation/coaxial-gear-geometry.js','src/simulation/finite-plate-geometry.js','scripts/lib/study-report-io.mjs'],prefix);
const tilt=-Math.atan((s.lines.upperRoot.slope+s.lines.lowerUnderside.slope)/2),local=([x,y])=>[Math.cos(tilt)*(x-s.axis[0])+Math.sin(tilt)*(s.axis[1]-y),-Math.sin(tilt)*(x-s.axis[0])+Math.cos(tilt)*(s.axis[1]-y)];
const rows={};for(const side of ['upper','lower']){const ps=s.teeth.filter(p=>p.side===side),mx=ps.reduce((a,p)=>a+p.index/ps.length,0),my=ps.reduce((a,p)=>a+local([p.center,p.y])[0]/ps.length,0),pitch=ps.reduce((a,p)=>a+(p.index-mx)*(local([p.center,p.y])[0]-my),0)/ps.reduce((a,p)=>a+(p.index-mx)**2,0),origin=my-mx*pitch;rows[side]={pitch,origin,rms:Math.sqrt(ps.reduce((a,p)=>a+(local([p.center,p.y])[0]-origin-pitch*p.index)**2,0)/ps.length),count:ps.length};}
const candidates=[];
for(let teeth=12;teeth<=16;teeth++)for(let j=0;j<=12;j++){
 const module=6.2+j*.08,radius=teeth*module/2;
 const g=roundedRackGear({teeth,module,depth:1,boreRadius:5,addendum:.8,dedendum:1,tipRadius:.08*module,samples:96,cutterSteps:2048}),rs=g.userData.outline.slice(0,96).map(p=>p.length()),angularPitch=2*Math.PI/teeth,pitch=Math.PI*module;
 const radial=a=>{const t=(((a/angularPitch+.5)%1+1)%1)*96,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%96]*f;};let best;
 for(let i=0;i<512;i++){
  const phase=i*angularPitch/512,errors=s.gear.map(p=>radial(p.angle-tilt-phase)-p.radius),gearScore=errors.reduce((a,e)=>a+e*e,0)/errors.length,origins={};
  for(const side of ['upper','lower']){const base=radius*(Math.PI/2+(side==='upper'?-phase:phase))+pitch/2,mean=s.teeth.filter(p=>p.side===side).reduce((a,p,_,ps)=>a+(local([p.center,p.y])[0]-pitch*p.index)/ps.length,0);origins[side]=base+Math.round((mean-base)/pitch)*pitch;}
  const rackErrors=s.teeth.map(p=>origins[p.side]+pitch*p.index-local([p.center,p.y])[0]),rackScore=rackErrors.reduce((a,e)=>a+e*e,0)/rackErrors.length,score=gearScore+rackScore;
  if(!best||score<best.score)best={teeth,modulePixels:module,radius,phase,origins,pitch,gearRms:Math.sqrt(gearScore),rackRms:Math.sqrt(rackScore),score,gearErrors:errors,rackErrors};
 }candidates.push(best);g.dispose();
}
candidates.sort((a,b)=>a.score-b.score);const report={sources,tilt,rows,candidates,qualification:'Compatible generated involute system fitted to gear contours and rack centers with equal mean-square weight. Addendum 0.8, dedendum 1.0 and 20-degree pressure angle regularize the squared engraving teeth. Source tilt, module, count and phase are jointly respected; final native contact and actual-edge comparison remain necessary.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({tilt,rows,candidates:candidates.slice(0,8).map(({gearErrors,rackErrors,...r})=>r)});
