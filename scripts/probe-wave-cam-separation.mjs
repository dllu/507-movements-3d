import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {waveCamSampledGap} from '../src/simulation/mujoco-wave-cam/clearance.js';
const gapAt=(s,samples)=>waveCamSampledGap(s,{samples});
const trajectories=JSON.parse(fs.readFileSync('/dev/shm/165-native-trajectories.json'));
let worstIndex=0,difference=0;
for(let i=0;i<trajectories.baseline.length;i++){
 const d=Math.abs(trajectories.baseline[i].outputY-trajectories['refined-mesh'][i].outputY);
 if(d>difference){difference=d;worstIndex=i;}
}
const runs=['baseline','refined-mesh'].map(name=>{
 const rows=trajectories[name];let minimumGap=Infinity,maximumGap=-Infinity,separatedSamples=0,minimumPose;
 for(const s of rows){const {gap}=gapAt(s,128);if(gap<minimumGap){minimumGap=gap;minimumPose={state:s,...gapAt(s,1024)};}maximumGap=Math.max(maximumGap,gap);if(gap>.005)separatedSamples++;}
 const state=rows[worstIndex];return{name,minimumSampledGap:minimumGap,minimumPose,maximumSampledGap:maximumGap,separatedSamples,samples:rows.length,worstDifferencePose:{state,coarse:gapAt(state,256),fine:gapAt(state,1024)}};
});
const sources=['scripts/probe-wave-cam-separation.mjs','src/simulation/mujoco-wave-cam/profile.js','src/simulation/mujoco-wave-cam/clearance.js','docs/validation/165-native-study.json'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={movement:165,status:'separation-diagnostic-not-clearance-qualification',method:'Independent sampled continuous-face gap over finite cylindrical roller at native trajectory poses. Positive gap means separation. Grid minima provide evidence of separation but do not prove global clearance. 10 ms samples, exact axial-edge annulus boundary included.',maximumOutputDifference:difference,runs,sources};fs.writeFileSync('docs/validation/165-separation.json',JSON.stringify(report,null,2)+'\n');console.log(report);
