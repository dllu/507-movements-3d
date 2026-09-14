import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createAuthoredCamMovement} from '../src/simulation/authored-cams.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {variableCamProfile} from '../src/simulation/mujoco-variable-cam/profile.js';
const {points:tracedPoints}=variableCamProfile(256),model=createAuthoredCamMovement({id:138});
const points=model.root.userData.blocks.camPlate.geometry.parameters.shapes.extractPoints(256).shape.map(p=>[p.x,p.y]);
const pixelScale=123/2.4;
function envelope(angle,width,slope,outline=points){
 const c=Math.cos(angle),s=Math.sin(angle),p=outline.map(([x,y])=>[c*x-s*y,s*x+c*y]);let top=-Infinity;
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length];
  const candidates=[a,b];for(const x of [-width,0,width])if((x-a[0])*(x-b[0])<0){const f=(x-a[0])/(b[0]-a[0]);candidates.push([x,a[1]+f*(b[1]-a[1])]);}
  for(const [x,y]of candidates)if(Math.abs(x)<=width+1e-10)top=Math.max(top,y-slope*Math.abs(x));
 }
 return top;
}
try{
 let oldTipInterference=0,correctedTipDifference=0,maximumDownwardVelocityJump=0;
 const g=model.root.userData.geometry;
 for(let i=0;i<1440;i++){
  const t=i*g.cyclePeriod/1440,s=model.root.userData.stateAtTime(t);
  oldTipInterference=Math.max(oldTipInterference,envelope(s.driverAngle,.24,.5)-s.profile.radius);
  correctedTipDifference=Math.max(correctedTipDifference,Math.abs(envelope(s.driverAngle,.12,2)-s.profile.radius));
 }
 for(const corner of g.profileTransitions){
  const t=((corner.angle-Math.PI/2+2*Math.PI)%(2*Math.PI))/.5;
  const a=model.root.userData.stateAtTime(t-1e-7),b=model.root.userData.stateAtTime(t+1e-7);
  maximumDownwardVelocityJump=Math.max(maximumDownwardVelocityJump,a.outputVelocity.y-b.outputVelocity.y);
 }
 const runs=Object.fromEntries(['coarse','time-refined','mesh-refined','fine'].map(n=>[n,JSON.parse(fs.readFileSync(`/dev/shm/138-${n}.json`))]));
 const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 for(const r of Object.values(runs)){for(const s of r.sources)assert.equal(hash(s.file),s.sha256);assert.equal(r.resets,0);assert(r.penetration<.002);}
 const sensitivity={};
 for(const name of ['time-refined','mesh-refined','fine']){
  let difference=0;for(let i=4000;i<11999;i++)difference=Math.max(difference,Math.abs(runs.coarse.rows[i][2]-runs[name].rows[i][2]));
  sensitivity[name]=difference*pixelScale;
 }
 let minimumGap=Infinity,maximumLiftOff=0,maximumOracleDifference=0;
 for(let i=4000;i<runs.fine.rows.length;i+=5){
  const [,angle,y]=runs.fine.rows[i],gap=y-envelope(angle,.12,2,tracedPoints);
  minimumGap=Math.min(minimumGap,gap);maximumLiftOff=Math.max(maximumLiftOff,gap);
  const t=-angle/.5;maximumOracleDifference=Math.max(maximumOracleDifference,Math.abs(y-model.root.userData.stateAtTime(t).profile.radius));
 }
 const landmarks=[['outer-right-corner',[367,320]],['outer-left-point',[138,378]],['bottom-corner',[289,466]],['upper-left-corner',[257,333]]].map(([name,engraved])=>{
  const p=g.profileTransitions.find(p=>p.name===name).point,rendered=[259+p.x*pixelScale,381-p.y*pixelScale];
  return {name,engraved,rendered,errorPixels:Math.hypot(rendered[0]-engraved[0],rendered[1]-engraved[1])};
 });
 const report={sources:runs.fine.sources,metersPerWorldUnit:.05125,landmarks,oldTipInterferencePixels:oldTipInterference*pixelScale,correctedTipEnvelopeDifferencePixels:correctedTipDifference*pixelScale,maximumDownwardVelocityJumpAtLegacySpeed:maximumDownwardVelocityJump,sensitivityPixels:sensitivity,minimumGapPixels:minimumGap*pixelScale,maximumLiftOffPixels:maximumLiftOff*pixelScale,maximumIdealPointOracleDifferencePixels:maximumOracleDifference*pixelScale,runs:Object.fromEntries(Object.entries(runs).map(([n,r])=>[n,{...r,rows:undefined,sources:undefined}]))};
 fs.writeFileSync('docs/validation/138-physics-review.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(model.root);}
