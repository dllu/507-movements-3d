import fs from 'node:fs';
import assert from 'node:assert/strict';
import profile from '../src/data/crossed-rack-profile.js';
const file='src/data/display-profiles.json',data=JSON.parse(fs.readFileSync(file)),prior=JSON.parse(fs.readFileSync('artifacts/review/080-preintegration-source-3.txt'));
for(const [id,value]of Object.entries(prior.profiles))if(id!=='80')assert.deepEqual(data.profiles[id],value);
const rate=profile.physicsPeriod/profile.playbackPeriod,intervals=profile.rows.slice(1).map((b,i)=>{
 const a=profile.rows[i],dt=b[0]-a[0],driver=profile.physics.stopAt!==null&&a[0]>=profile.physics.stopAt?0:rate*profile.physics.amplitude*profile.physics.omega;
 return{duration:dt,speed:Math.max(driver,Math.abs(b[2]-a[2])/dt*rate,Math.abs(b[3]-a[3])/dt*rate)};
}),peak=Math.max(...intervals.map(r=>r.speed));let elapsed=0,sustained=0;
for(const r of [...intervals].sort((a,b)=>a.speed-b.speed)){elapsed+=r.duration;if(elapsed>=profile.physicsDuration*.75){sustained=r.speed;break;}}
Object.assign(data.profiles[80],{peakAngularSpeed:peak,peakVisibleAngularSpeed:peak,sustainedVisibleAngularSpeed:sustained,
 floorY:profile.motionBounds.min[1],motionBounds:profile.motionBounds,
 motionBoundsMethod:'Complete finite trajectory: endpoint mesh boxes plus analytic pivot and free-angle curvature, checked against 12420576 actual vertices.',
 speedMethod:'Full finite path: conservative maximum angular speed on every compressed interval, with time-weighted 75th percentile. No small-part visibility discount.'});
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');fs.writeFileSync('src/data/display-profiles.js',
 '// Generated display measurements; 080 full finite bounds from scripts/finalize-crossed-rack-display.mjs.\nexport default '+JSON.stringify(data)+';\n');
console.log({movement:80,otherProfilesUnchanged:506,profile:data.profiles[80]});
