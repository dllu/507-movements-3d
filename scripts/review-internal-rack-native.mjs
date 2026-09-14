import fs from 'node:fs';
import crypto from 'node:crypto';
import {internalRackPitchDimensions,internalRackPitchPose} from '../src/simulation/mujoco-internal-rack/profile.js';
const f=internalRackPitchDimensions(),runs=[];
for(const file of process.argv.slice(2)){
 const bytes=fs.readFileSync(file),r=JSON.parse(bytes);let worst={error:0},closure=0;
 for(const row of r.rows){
  const p=internalRackPitchPose(f.sourcePhase+(row[1]+Math.PI/2)/f.rotationPerCycle);
  const actual=[row[2]-.05,row[3]+f.orbit],error=Math.hypot(actual[0]-p.x,actual[1]-p.y);
  if(error>worst.error)worst={error,time:row[0],expected:[p.x,p.y],actual};
  const a=row[4],b=a+row[5];
  const x=-1.6+.37*Math.cos(a)-.24*Math.sin(a)+.01*Math.cos(b)+.575*Math.sin(b);
  const y=1.01+.37*Math.sin(a)+.24*Math.cos(a)+.01*Math.sin(b)-.575*Math.cos(b);
  closure=Math.max(closure,Math.hypot(x+1.22,y-row[3]-.675));
 }
 runs.push({counterMass:r.counterMass,timestep:r.timestep,contactTime:r.contactTime??.002,period:r.period,cells:r.cells,resets:r.resets,duration:r.rows.at(-1)[0],maximumPenetrationPixels:r.penetration*100,maximumSampledRodClosureErrorPixels:closure*100,maximumPitchPathErrorPixels:worst.error*100,worst,recordingSha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
const sources=['src/data/internal-rack-dimensions.js','src/simulation/mujoco-internal-rack/profile.js','src/simulation/mujoco-internal-rack/suspension.js','scripts/probe-internal-rack.mjs','scripts/review-internal-rack-native.mjs','src/simulation/mujoco/simulation.js','package-lock.json'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={sources,runs,caveat:'Diagnostic runs, not accepted playback. The coupler mass is an inferred trial parameter; neither initial branch retention nor refined contact stability is established merely by a reset-free run.'};
fs.writeFileSync('docs/validation/139-native-review.json',JSON.stringify(report,null,2)+'\n');console.log(runs);
