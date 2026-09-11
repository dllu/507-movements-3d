import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {sampleOpposedArmPlayback,attachOpposedArmPlayback} from './lib/opposed-arm-playback.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/079-playback-finer-prototype-candidate.json',prefix=process.env.PROBE_PREFIX??'079-finer-sampler',
 profile=JSON.parse(await readFile(input,'utf8')),model=attachOpposedArmPlayback(makeOpposedArmCandidate(profile.geometry),profile),u=model.root.userData,issues=[],sources=[],
 maxima={knotError:0,periodError:0,cycleTranslationError:0,closureError:0,seamJump:0};let knotChecks=0,phaseChecks=0;
const angles=s=>[s.theta,s.upperBeta,s.lowerBeta];
for(const period of [2,4,8])for(const [index,table]of [profile.first,profile.steady].entries())for(const row of table){
 const state=sampleOpposedArmPlayback(profile,(row[0]+index*profile.physicsPeriod)*period/profile.physicsPeriod,{period});
 for(let k=0;k<3;k++){const error=Math.abs(angles(state)[k]-row[k+1]);maxima.knotError=Math.max(maxima.knotError,error);if(error>5e-12)issues.push({reason:'knot-mismatch',period,index,row,coordinate:k,error});}knotChecks++;
}
for(let cycle=1;cycle<=34;cycle++)for(let i=0;i<=100;i++){
 const phase=i/101,physical=(cycle+phase)*profile.physicsPeriod,base=sampleOpposedArmPlayback(profile,(1+phase)*profile.playbackPeriod),
  current=sampleOpposedArmPlayback(profile,(cycle+phase)*profile.playbackPeriod),expected=[base.theta-(cycle-1)*profile.teethPerCycle*profile.pitch,base.upperBeta,base.lowerBeta];
 for(let k=0;k<3;k++)maxima.cycleTranslationError=Math.max(maxima.cycleTranslationError,Math.abs(angles(current)[k]-expected[k]));
 for(const period of [2,4,8]){
  const scaled=sampleOpposedArmPlayback(profile,physical*period/profile.physicsPeriod,{period});
  for(let k=0;k<3;k++)maxima.periodError=Math.max(maxima.periodError,Math.abs(angles(scaled)[k]-angles(current)[k]));
 }
 const kinematics=model.update((cycle+phase)*profile.playbackPeriod);
 for(const key of ['upper','lower'])maxima.closureError=Math.max(maxima.closureError,kinematics.arms[key].closureError);
 phaseChecks++;
}
for(let cycle=1;cycle<=34;cycle++){
 const time=cycle*profile.playbackPeriod,left=sampleOpposedArmPlayback(profile,time-1e-9),right=sampleOpposedArmPlayback(profile,time+1e-9);
 for(let k=0;k<3;k++)maxima.seamJump=Math.max(maxima.seamJump,Math.abs(angles(left)[k]-angles(right)[k]));
}
if(maxima.cycleTranslationError>5e-12||maxima.periodError>5e-12||maxima.closureError>1e-12||maxima.seamJump>1e-7)issues.push({reason:'sampling-invariant-failed',maxima});
for(const bad of [NaN,Infinity,-Infinity]){
 let rejected=false;try{sampleOpposedArmPlayback(profile,bad);}catch{rejected=true;}if(!rejected)issues.push({reason:'accepted-nonfinite-time',bad:String(bad)});
}
for(const period of [0,-1,NaN,Infinity]){
 let rejected=false;try{sampleOpposedArmPlayback(profile,0,{period});}catch{rejected=true;}if(!rejected)issues.push({reason:'accepted-invalid-period',period:String(period)});
}
for(const file of ['scripts/check-opposed-arm-playback-sampling.mjs','scripts/lib/opposed-arm-playback.mjs','scripts/lib/opposed-arm-candidate.mjs',input]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-sampler-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const passed=issues.length===0,report={movement:79,status:'playback-sampling-check',productionChanged:false,mechanicsPassed:false,passed,input,knotChecks,phaseChecks,maxima,issues,sources,
 qualification:'Every knot at three display periods and 34 periodic orientations is checked for angle parity, exact four-tooth translations, fixed rod closure and continuous cycle seams. This verifies the sampler, not the physical clearance of its input interpolation.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,knotChecks,phaseChecks,maxima,issues:issues.slice(0,3)});if(!passed)process.exitCode=1;
