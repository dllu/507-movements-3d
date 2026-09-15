import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeSelectableCamPhysics} from '../src/simulation/mujoco-selectable-cam/physics.js';
const mujoco=await loadMujoco(),p=makeSelectableCamPhysics(mujoco,{ticksPerPeriod:Number(process.env.TICKS??60000),multiContact:process.env.MULTI_CONTACT==='1',nativeCCD:process.env.NATIVE_CCD==='1'});
try{
 const ticks=p.description.ticksPerPeriod,stride=ticks/1200,samples=[],start=2*ticks;
 const g=p.description.geometry,roller=p.id('mjOBJ_GEOM','roller');
 const contours=g.configs.map(c=>Array.from({length:192},(_,i)=>{const a=i*2*Math.PI/192,r=c.baseRadius+c.lift*(1+Math.cos(a))/2;return [r*Math.cos(a+c.phaseOffset),r*Math.sin(a+c.phaseOffset)];}));
 const pins=['rod-tip','slider-pin'].map(n=>p.id('mjOBJ_SITE',n));
 let maxPinError=0,maxPenetration=0,missingContact=0,maxLeverError=0,maxSliderError=0,maxShaftError=0,maxSelectorError=0,minProfileGap=Infinity,maxProfileGap=-Infinity;
 for(let tick=0;tick<=3*ticks;tick++){
  if(tick%stride===0){
   mujoco.mj_forward(p.model,p.data);const s=p.state();samples.push(s);
   if(tick>=start){
    const reference=p.drive(s.time);
    const x=p.data.geom_xpos[3*roller],y=p.data.geom_xpos[3*roller+1],q=[x*Math.cos(s.shaft)+y*Math.sin(s.shaft),-x*Math.sin(s.shaft)+y*Math.cos(s.shaft)];
    let gap=Math.hypot(x,y)-g.baseRadius-g.rollerRadius;
    for(let k=0;k<contours.length;k++)if(Math.abs(s.carrier+g.localCamPlanes[k]-g.workingCamPlaneZ)<(g.camDepth+g.rollerWidth)/2){
     let distance=Infinity;const points=contours[k];
     for(let j=0;j<points.length;j++){const a=points[j],b=points[(j+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy)));distance=Math.min(distance,Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy));}
     gap=Math.min(gap,distance-g.rollerRadius);
    }
    minProfileGap=Math.min(minProfileGap,gap);maxProfileGap=Math.max(maxProfileGap,gap);
    maxLeverError=Math.max(maxLeverError,Math.abs(s.lever-reference.follower.leverAngle));
    maxSliderError=Math.max(maxSliderError,Math.abs(s.slider+p.description.initial.valve.bottom.y-reference.valve.bottom.y));
    maxShaftError=Math.max(maxShaftError,Math.abs(s.shaft-reference.driveAngle));maxSelectorError=Math.max(maxSelectorError,Math.abs(s.carrier-reference.carrierTranslationZ));
    maxPinError=Math.max(maxPinError,Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*pins[0]+k]-p.data.site_xpos[3*pins[1]+k])));
    const contacts=p.data.contact;
    try{if(!contacts.size())missingContact++;for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{maxPenetration=Math.max(maxPenetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
   }
  }
  if(tick<3*ticks)p.step();
 }
 const steady=samples.slice(2400),first=steady[0],last=steady.at(-1);
 const closure=Object.fromEntries(['carrier','lever','rod','slider'].map(n=>[n,last[n]-first[n]]));
 const report={movement:150,status:'passive-selectable-cam-prototype',assumptions:p.description.assumptions,options:{multiContact:p.description.multiContact,nativeCCD:p.description.nativeCCD,period:p.description.period,ticksPerPeriod:ticks,timestep:p.timestep,cycles:3},summary:{samples:steady.length,minProfileGap,maxProfileGap,maxPinError,maxPenetration,missingContact,maxLeverError,maxSliderError,maxShaftError,maxSelectorError,closure,velocityClosure:last.velocity.map((x,i)=>x-first.velocity[i])},sources:['scripts/probe-selectable-cam-physics.mjs','src/simulation/mujoco-selectable-cam/physics.js','src/simulation/selectable-cam-valve.js','src/simulation/authored-selectable-cams.js','src/simulation/mujoco/mass.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('/dev/shm/150-passive-samples.json',JSON.stringify(samples));fs.writeFileSync(process.env.REPORT??'docs/validation/150-passive-prototype.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
}finally{p.dispose();}
