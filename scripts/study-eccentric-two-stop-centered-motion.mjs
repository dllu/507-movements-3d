import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeEccentricTwoStopCenteredCandidate} from './lib/eccentric-two-stop-centered-candidate.mjs';
import {makeEccentricTwoStopDynamics} from './lib/eccentric-two-stop-dynamics.mjs';
import {freezeStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/088-gravity-motion',stepsPerTurn=Number(process.env.PROBE_STEPS??8192),
  turns=Number(process.env.PROBE_TURNS??4),options={footInner:Number(process.env.PROBE_FOOT_INNER??121)},
  model=makeEccentricTwoStopCenteredCandidate(options),d=makeEccentricTwoStopDynamics(model),turnPeriod=2*Math.PI/Math.abs(d.parameters.omega),
  h=turnPeriod/stepsPerTurn,sources=freezeStudySources([
    'scripts/study-eccentric-two-stop-centered-motion.mjs','scripts/lib/eccentric-two-stop-candidate.mjs',
    'scripts/lib/eccentric-two-stop-complete-candidate.mjs','scripts/lib/eccentric-two-stop-centered-candidate.mjs','scripts/lib/eccentric-two-stop-dynamics.mjs',
    'scripts/lib/eccentric-two-stop-feature-contact.mjs','scripts/lib/weighted-clutch-native-contours.mjs',
    'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','public/engravings/mm_088.png'],prefix),
  rows=[d.initial()],events=[];
let minimumGap=Infinity,maximumImpulseEnergyResidual=0,error;
try {
  for(let i=1;i<=stepsPerTurn*turns;i++) {
    const before=rows.at(-1),row=d.step(before,i*h); rows.push(row);
    minimumGap=Math.min(minimumGap,row.gap??Infinity); maximumImpulseEnergyResidual=Math.max(maximumImpulseEnergyResidual,Math.abs(row.impulseEnergyResidual));
    if(row.active!==before.active)events.push({kind:row.active?'contact':'release',time:row.time,output:row.output,speed:row.speed,from:before.active,to:row.active});
    if(row.speed===0&&before.speed!==0)events.push({kind:'rest',time:row.time,output:row.output});
  }
}catch(e){error=e.message;}
const startIndex=Math.round(.4*stepsPerTurn),endIndex=startIndex+2*stepsPerTurn,
  closure=rows.length>endIndex?{start:rows[startIndex],end:rows[endIndex],period:2*turnPeriod,
    outputError:rows[endIndex].output-rows[startIndex].output+2*Math.PI,speedError:rows[endIndex].speed-rows[startIndex].speed}:null;
const report={movement:88,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,options,
  parameters:{...d.parameters,stepsPerTurn,turnPeriod,h,turns},rows,events,minimumGap,maximumImpulseEnergyResidual,closure,error,
  qualification:'Native finite planar contact with an inelastic motor-driven impact, gravity from the centered wheel-family volume and centroid, and a finite dry bearing brake. Exact input phase steps allow repeated-state and step-halving comparisons. Continuous solid clearance, source-axis and shifted rim acceptance and final playback remain separate.'};
await writeGzipStudyReport(prefix+'.json.gz',report);
fs.writeFileSync(prefix+'-summary.json',JSON.stringify({...report,rows:rows.length},null,2)+'\n',{flag:'wx'});
console.log({rows:rows.length,minimumGap,maximumImpulseEnergyResidual,closure:closure&&{outputError:closure.outputError,speedError:closure.speedError},events,error});assert(!error);
