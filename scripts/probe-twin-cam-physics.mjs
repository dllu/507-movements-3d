import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeTwinCamPhysics} from '../src/simulation/mujoco-twin-cam/physics.js';
import {twinCamSource as source} from '../src/simulation/mujoco-twin-cam/source.js';
const mujoco=await loadMujoco(),p=makeTwinCamPhysics(mujoco,{timestep:Number(process.env.TIMESTEP??.0005)});
try{
 const duration=Number(process.env.DURATION??18),steadyStart=duration-p.description.options.period;
 const samples=[],steps=Math.round(duration/p.timestep),stride=Math.round(.02/p.timestep);let maximumPenetration=0,missingUpper=0,missingLower=0,minimumProfileGap=Infinity,maximumProfileGap=-Infinity;
 const ids=[0,1].map(i=>p.id('mjOBJ_GEOM','roller'+i));
 for(let i=0;i<=steps;i++){
  if(i%stride===0){
   mujoco.mj_forward(p.model,p.data);samples.push(p.state());const seen=[false,false],contacts=p.data.contact;
   try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{
    if(i*p.timestep>=steadyStart){maximumPenetration=Math.max(maximumPenetration,-c.dist);ids.forEach((id,k)=>{if(c.geom1===id||c.geom2===id)seen[k]=true;});}
   }finally{c.delete();}}}finally{contacts.delete();}
   if(i*p.timestep>=steadyStart){if(!seen[0])missingUpper++;if(!seen[1])missingLower++;}
   if(i*p.timestep>=steadyStart)for(let k=0;k<2;k++){
    const x=p.data.geom_xpos[3*ids[k]]-(source.shaft[0]-source.pivot[0])*source.scale,y=p.data.geom_xpos[3*ids[k]+1]-(source.pivot[1]-source.shaft[1])*source.scale;
    const angle=p.data.qpos[0],q=[x*Math.cos(angle)+y*Math.sin(angle),-x*Math.sin(angle)+y*Math.cos(angle)],contour=p.description.contours[k];
    let distance=Infinity;
    for(let j=0;j<contour.length;j++){
     const a=contour[j],b=contour[(j+1)%contour.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy)));
     distance=Math.min(distance,Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy));
    }
    const gap=distance-p.description.levers[k].radius;minimumProfileGap=Math.min(minimumProfileGap,gap);maximumProfileGap=Math.max(maximumProfileGap,gap);
   }
  }
  if(i<steps)p.step();
 }
 const steady=samples.filter(s=>s.time>steadyStart-1e-6),closure=Object.fromEntries(['upper','lower','upperRod','lowerRod'].map(k=>[k,steady.at(-1)[k]-steady[0][k]]));
 const summary={samples:steady.length,maximumPenetration,missingUpper,missingLower,minimumProfileGap,maximumProfileGap,closure,
  angleRanges:Object.fromEntries(['upper','lower'].map(k=>[k,[Math.min(...steady.map(s=>s[k])),Math.max(...steady.map(s=>s[k]))]]))};
 summary.rodTilt=Object.fromEntries(['upper','lower'].map(k=>[k,Math.max(...steady.map(s=>Math.abs(s[k]+s[k+'Rod'])))]));
 const report={movement:149,status:'traced-profile-pinned-output-rods',assumptions:p.description.assumptions,options:{...p.description.options,duration},summary,
  sources:['scripts/probe-twin-cam-physics.mjs','src/simulation/mujoco-twin-cam/source.js','src/simulation/mujoco-twin-cam/physics.js','src/simulation/mujoco-twin-cam/geometry.js','src/simulation/mujoco/mass.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('/dev/shm/149-gravity-samples.json',JSON.stringify(samples));
 fs.writeFileSync(process.env.REPORT??'docs/validation/149-gravity-prototype.json',JSON.stringify(report,null,2)+'\n');console.log(summary);
}finally{p.dispose();}
