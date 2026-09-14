import fs from 'node:fs';
import {endlessRackProfile} from '../src/simulation/mujoco-endless-rack/profile.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/119-assembly-fit',input=process.env.SOURCE_REPORT??'/dev/shm/119-source-b.json';
const sources=freezeStudySources(['scripts/fit-endless-rack-assembly.mjs','src/simulation/mujoco-endless-rack/profile.js','src/simulation/mujoco-endless-rack/source.js','src/simulation/coaxial-gear-geometry.js','src/simulation/finite-plate-geometry.js','scripts/lib/study-report-io.mjs',input],prefix),s=JSON.parse(fs.readFileSync(input));
const edges=points=>points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1];return[a[0],a[1],dx,dy,1/(dx*dx+dy*dy)];}).filter(e=>Number.isFinite(e[4]));
function distance(x,y,lines){let best=Infinity;for(const [a,b,dx,dy,inv]of lines){const px=x-a,py=y-b,t=Math.max(0,Math.min(1,(px*dx+py*dy)*inv)),ex=px-t*dx,ey=py-t*dy;best=Math.min(best,ex*ex+ey*ey);}return Math.sqrt(best);}
const axisX=(s.verticals.slotLeft.x+s.verticals.slotRight.x)/2,axisY=319,groups=Object.fromEntries(Object.entries(s.contours).map(([n,v])=>[n,v.points])),rackPoints=Object.entries(groups).filter(([n])=>n!=='pinion').flatMap(([,v])=>v),candidates=[];
for(const straightTeeth of [7,8])for(const endTeeth of [6,7])for(const offset of [0,.5]){
 const f=endlessRackProfile({module:1,straightTeeth,endTeeth,offset}),gear=edges(f.gear.userData.outline.map(p=>p.toArray())),rack=edges(f.body[0][0]);f.gear.dispose();let best;
 for(let mi=0;mi<=20;mi++){const module=8+mi*.08;for(let cx=262;cx<=274;cx+=1){
  const phase=(.5-offset)*f.pitch/f.R+(cx-axisX)/(module*f.R),c=Math.cos(phase),q=Math.sin(phase),cy=axisY-module*f.H;
  const gearResiduals=groups.pinion.map(p=>{const x=p[0]-axisX,y=cy-p[1];return module*distance((x*c+y*q)/module,(-x*q+y*c)/module,gear);});
  const rackResiduals=rackPoints.map(p=>module*distance((p[0]-cx)/module,(axisY-p[1])/module,rack));
  const mse=a=>a.reduce((s,r)=>s+r*r,0)/a.length,score=mse(gearResiduals)+mse(rackResiduals);
  if(!best||score<best.score)best={straightTeeth,endTeeth,offset,module,center:[cx,axisY],pinionCenter:[axisX,cy],phase,score,gearRms:Math.sqrt(mse(gearResiduals)),rackRms:Math.sqrt(mse(rackResiduals)),gearMaximum:Math.max(...gearResiduals),rackMaximum:Math.max(...rackResiduals)};
 }}candidates.push(best);console.log(best);
}
candidates.sort((a,b)=>a.score-b.score);verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,candidates,qualification:'Joint pinion and complete outer-rack edge fit with a common module. Tooth counts and the phase at the straight/end junction are explicit discrete candidates. This fit does not qualify cap transfer or hidden guide support.'},null,2)+'\n',{flag:'wx'});
