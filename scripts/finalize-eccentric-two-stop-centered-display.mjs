import fs from 'node:fs';
import assert from 'node:assert/strict';
import profile from '../src/data/eccentric-two-stop-profile.js';
import {makeEccentricTwoStop} from '../src/simulation/eccentric-two-stop.js';
import {readStudyReport,freezeStudySources} from './lib/study-report-io.mjs';

const model=makeEccentricTwoStop(),u=model.root.userData,rate=model.motion.rate,intervals=profile.samples.slice(1).map((b,i)=>{
  const a=profile.samples[i],duration=b[0]-a[0];return {duration,speed:rate*Math.max(Math.abs(profile.omega),Math.abs(b[1]-a[1])/duration)};
}),peak=Math.max(...intervals.map(p=>p.speed));let elapsed=0,sustained;
for(const p of [...intervals].sort((a,b)=>a.speed-b.speed)){elapsed+=p.duration;if(elapsed>=profile.repeat.end*.75){sustained=p.speed;break;}}
assert(peak<6*Math.PI&&sustained<2*Math.PI);
const file='src/data/display-profiles.json',data=readStudyReport(file),previous=data.profiles[88];
data.profiles[88]={peakAngularSpeed:peak,peakVisibleAngularSpeed:peak,sustainedVisibleAngularSpeed:sustained,
  floorY:u.cameraFitBounds.min.y,fastestPart:'eccentric cam driven stop',motionBounds:{min:u.cameraFitBounds.min.toArray(),max:u.cameraFitBounds.max.toArray()},
  motionBoundsMethod:'Full-rotation radial and axial envelope of every native rigid mesh about its actual shaft, including the finite stop blocks.',
  speedMethod:'Maximum angular speed on every retained playback interval; duration-weighted 75th percentile. No small-part visibility discount.'};
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
fs.writeFileSync('src/data/display-profiles.js','// Generated display measurements; 088 refined by scripts/finalize-eccentric-two-stop-centered-display.mjs.\nexport default '+JSON.stringify(data)+';\n');
const prefix='artifacts/review/088-centered-production-display',sources=freezeStudySources([file,'src/data/display-profiles.js',
  'src/simulation/eccentric-two-stop.js','src/data/eccentric-two-stop-profile.js','scripts/finalize-eccentric-two-stop-centered-display.mjs'],prefix);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:88,sources,previous,profile:data.profiles[88],passed:true},null,2)+'\n',{flag:'wx'});
console.log({peak,sustained,bounds:data.profiles[88].motionBounds});
