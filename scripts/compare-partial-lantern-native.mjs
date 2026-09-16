import fs from 'node:fs';
import crypto from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const TAU=2*Math.PI;
function at(samples,u){let lo=0,hi=samples.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(samples[m].input<u)lo=m;else hi=m;}const a=samples[lo],b=samples[hi],t=(u-a.input)/(b.input-a.input);return a.x+(b.x-a.x)*t;}
export function comparePartialLanternRuns(runs){
 const valid=r=>Array.isArray(r.samples)&&r.samples.length>=3&&r.samples.every(s=>['time','input','inputSpeed','x','velocity'].every(k=>Number.isFinite(s[k])));
 const validSamples=runs.length===3&&runs.every(valid);
 const monotoneInput=validSamples&&runs.every(r=>r.samples.every((s,i)=>i===0||(s.input>r.samples[i-1].input&&s.time>r.samples[i-1].time)));
 const twoCycleCoverage=validSamples&&runs.every(r=>r.samples.at(-1).input-r.samples[0].input>=2*TAU);
 const sameStart=validSamples&&Math.abs(runs[0].samples[0].input-runs[1].samples[0].input)<1e-12;
 const disabledControl=validSamples&&runs[2].summary?.options?.contact===false&&runs[2].summary.maxContactCount===0&&runs[2].samples.every(s=>s.contacts===0&&s.velocity>0)&&runs[2].samples.at(-1).x-runs[2].samples[0].x>2.4;
 const limits={positionDifference:.001,cycleDifference:.001,penetration:.0002,inputTrackingError:.01};
 let positionDifference=null,cycleDifference=null;
 if(monotoneInput&&twoCycleCoverage&&sameStart){
  cycleDifference=runs.slice(0,2).map(r=>{const s=r.samples,end=s.at(-1).input,start=end-TAU;let maximum=0;for(let i=0;i<=4096;i++){const u=start+TAU*i/4096;maximum=Math.max(maximum,Math.abs(at(s,u)-at(s,u-TAU)));}return maximum;});
  const end=Math.min(...runs.slice(0,2).map(r=>r.samples.at(-1).input)),start=end-TAU;positionDifference=0;
  for(let i=0;i<=4096;i++){const u=start+TAU*i/4096;positionDifference=Math.max(positionDifference,Math.abs(at(runs[0].samples,u)-at(runs[1].samples,u)));}
 }
 const numericalAgreement=positionDifference!==null&&positionDifference<limits.positionDifference&&Math.max(...cycleDifference)<limits.cycleDifference;
 const contactAndTracking=runs.slice(0,2).every(r=>Number.isFinite(r.summary?.minGap)&&r.summary.minGap>-limits.penetration&&Number.isFinite(r.summary?.maxInputError)&&r.summary.maxInputError<limits.inputTrackingError);
 const checks={validSamples,monotoneInput,twoCycleCoverage,sameStart,disabledControl,numericalAgreement,contactAndTracking};
 return{qualifiedForBake:Object.values(checks).every(Boolean),checks,limits,positionDifference,cycleDifference};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [basePath,halfPath,disabledPath,outputPath]=process.argv.slice(2);
 if(!basePath||!halfPath||!disabledPath)throw Error('Expected base.json half.json disabled.json [report.json]');
 const paths=[basePath,halfPath,disabledPath],runs=paths.map(p=>JSON.parse(fs.readFileSync(p)));
 const report={...comparePartialLanternRuns(runs),runs:runs.map((r,i)=>({label:['base','half-timestep','contact-disabled'][i],summary:r.summary,xmlSha256:crypto.createHash('sha256').update(fs.readFileSync(paths[i].replace(/\.json$/,'.xml'))).digest('hex')})),note:'Compare at equal measured input angles; a finite stroke alone does not qualify coasting, impact, or periodic playback.'};
 if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
