import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeEccentricTwoStopCandidate} from './lib/eccentric-two-stop-candidate.mjs';
import {makeEccentricTwoStopFeatureContact} from './lib/eccentric-two-stop-feature-contact.mjs';
import {freezeStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const footInner=Number(process.env.PROBE_FOOT_INNER??121),h=Number(process.env.PROBE_STEP??.002),omega=-.5,
  prefix=process.env.PROBE_PREFIX??'artifacts/review/088-source-feature-motion',duration=Number(process.env.PROBE_DURATION??4*Math.PI/Math.abs(omega)),
  brakeAcceleration=Number(process.env.PROBE_BRAKE??2),model=makeEccentricTwoStopCandidate({footInner}),contact=makeEccentricTwoStopFeatureContact(model),
  sources=freezeStudySources(['scripts/study-eccentric-two-stop-feature-motion.mjs','scripts/lib/eccentric-two-stop-candidate.mjs',
    'scripts/lib/eccentric-two-stop-feature-contact.mjs','scripts/lib/weighted-clutch-native-contours.mjs',
    'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','public/engravings/mm_088.png'],prefix),
  rows=[{time:0,input:0,output:0,speed:0,gap:contact.query(0,0)[0]?.gap??Infinity}],events=[];
let output=0,speed=0,previousActive='',minimumGap=Infinity,error;
try {
  for(let time=h;time<=duration+h/2;time+=h) {
    const input=omega*time,free=Math.sign(speed)*Math.max(0,Math.abs(speed)-brakeAcceleration*h);let q=output+h*free,iterations=0;
    const penetration=contact.query(input,q)[0];
    if(penetration?.gap<0){
      let high=q,low=q; const direction=Math.sign(penetration.outputGradient);
      if(direction!==-1)throw Error('Unexpected reverse push at '+time);
      for(;iterations<30;iterations++) {low-=.002;const c=contact.query(input,low)[0];if(!c||c.gap>=0)break;}
      if(iterations===30)throw Error('Position contact could not be bracketed at '+time);
      for(let i=0;i<32;i++){const mid=(low+high)/2,c=contact.query(input,mid)[0];if(c&&c.gap<0)high=mid;else low=mid;}
      q=low;
    }
    const contacts=contact.query(input,q),active=contacts.filter(c=>c.gap<=2e-9);
    let lower=-Infinity,upper=Infinity;
    for(const c of active){const target=-c.inputGradient*omega/c.outputGradient;if(c.outputGradient>0)lower=Math.max(lower,target);else upper=Math.min(upper,target);}
    if(lower>upper+1e-6)throw Error('Conflicting contacts at '+time+': '+lower+' > '+upper);
    speed=Math.max(lower,Math.min(upper,free));output=q;
    const gap=contacts[0]?.gap??null;minimumGap=Math.min(minimumGap,gap??Infinity);
    const labels=[...new Set(active.map(c=>c.label))].join(',');
    if(labels!==previousActive){events.push({time,input,output,speed,from:previousActive,to:labels});previousActive=labels;}
    rows.push({time,input,output,speed,gap,active:labels,iterations});
  }
}catch(e){error=e.message;}
const result={movement:88,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,
  options:{footInner},parameters:{h,omega,brakeAcceleration,duration},rows,events,minimumGap,error,
  qualification:'Bounded dry-bearing-brake hypothesis with prescribed input speed and unilateral native planar contact. Inelastic contact impulses set output velocity. Trajectory convergence, exact work/impulse balance, full solid clearance and final playback remain unqualified.'};
await writeGzipStudyReport(prefix+'.json.gz',result);
fs.writeFileSync(prefix+'-summary.json',JSON.stringify({...result,rows:rows.length,events:events.filter((e,i)=>!i||e.time-events[i-1].time>.02)},null,2)+'\n',{flag:'wx'});
console.log({rows:rows.length,error,minimumGap,end:rows.at(-1),events:result.events.length});assert(!error);
