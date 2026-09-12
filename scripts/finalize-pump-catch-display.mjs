import fs from 'node:fs';
import assert from 'node:assert/strict';
import profile from '../src/data/pump-catch-profile.js';
import {readStudyReport,hashStudyFile,freezeStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/086-production-display',file='src/data/display-profiles.json',data=readStudyReport(file),
  before=readStudyReport('artifacts/review/086-production-export-source-24.txt'),raw=data.profiles[86];
for(const [id,value]of Object.entries(before.profiles))if(id!=='86')assert.deepEqual(data.profiles[id],value);
fs.writeFileSync(prefix+'-sampled.json',JSON.stringify(raw,null,2)+'\n',{flag:'wx'});
const rate=profile.repeat.period/profile.displayPeriod,intervals=profile.rows.slice(1).map((b,i)=>{
 const a=profile.rows[i],duration=b.time-a.time;
 // World orientations are theta for the loose wheel, absolute phi for the
 // catch and omega*t for both input pulleys. All other rigid bodies translate.
 return{duration,speed:rate*Math.max(Math.abs(profile.angularSpeed),Math.abs(b.q[0]-a.q[0])/duration,Math.abs(b.q[1]-a.q[1])/duration)};
}),peak=Math.max(...intervals.map(r=>r.speed));let elapsed=0,sustained;
for(const r of [...intervals].sort((a,b)=>a.speed-b.speed)){
 elapsed+=r.duration;if(elapsed>=profile.rows.at(-1).time*.75){sustained=r.speed;break;}
}
assert(peak<6*Math.PI&&sustained<2*Math.PI);
Object.assign(raw,{peakAngularSpeed:peak,peakVisibleAngularSpeed:peak,sustainedVisibleAngularSpeed:sustained,
 fastestPart:'hookedCatchB',floorY:profile.motionBounds.min[1],motionBounds:profile.motionBounds,
 motionBoundsMethod:'Union of continuous bounds for all 41 rigid bodies and 130 rope regions, padded by 1e-6. The completed rear input and guided output are included.',
 speedMethod:'Maximum world angular speed on every compressed interval, with duration-weighted 75th percentile over the complete retained trajectory. No small-part visibility discount.'});
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
fs.writeFileSync('src/data/display-profiles.js','// Generated display measurements; 086 complete bounds from scripts/finalize-pump-catch-display.mjs.\nexport default '+JSON.stringify(data)+';\n');
const sources=freezeStudySources(['scripts/finalize-pump-catch-display.mjs','src/data/pump-catch-profile.js',file,'src/data/display-profiles.js',
 'artifacts/review/086-production-export-source-24.txt',prefix+'-sampled.json'],prefix),report={movement:86,passed:true,otherProfilesUnchanged:506,
 intervals:intervals.length,profile:raw,sources,measuredLog:{file:'artifacts/review/086-production-display-measure.log',sha256:hashStudyFile('artifacts/review/086-production-display-measure.log')}};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
