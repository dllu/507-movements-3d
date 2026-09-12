import fs from 'node:fs';
import {makePumpCatchWeightedCandidate} from './lib/pump-catch-weighted-candidate.mjs';
import {makePumpCatchSlackDynamics} from './lib/pump-catch-slack-dynamics.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-relative-loss-controls',model=makePumpCatchWeightedCandidate({headBackDepth:.1}),parameters={hubDrag:1.5,hingeDrag:.02,pumpDrag:12,inputAngularSpeed:-Math.PI/4},
  free=makePumpCatchSlackDynamics(model),loaded=makePumpCatchSlackDynamics(model,parameters),errors={power:0,force:0},rows=[];
const sources=freezeStudySources(['scripts/check-pump-catch-losses.mjs','scripts/lib/pump-catch-weighted-candidate.mjs','scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs',
  'scripts/lib/pump-catch-slack-dynamics.mjs','scripts/lib/pump-catch-dynamics.mjs','scripts/lib/pump-catch-contact.mjs','scripts/lib/pump-catch-rope.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','scripts/lib/study-report-io.mjs'],prefix);
for(let i=0;i<101;i++){
  const q=[Math.sin(i),Math.cos(i*.3),1+Math.sin(i*.7)],v=[3*Math.cos(i*.2),4*Math.sin(i*.9),2*Math.cos(i*.4)],a=free.at(q,v),b=loaded.at(q,v),f=b.force.map((x,k)=>x-a.force[k]),
    hub=parameters.hubDrag*(parameters.inputAngularSpeed-v[0]),hinge=parameters.hingeDrag*(v[1]-v[0]),pump=-parameters.pumpDrag*v[2],expected=[hub+hinge,-hinge,pump],
    shaftPower=hub*parameters.inputAngularSpeed,bodyPower=f.reduce((s,x,k)=>s+x*v[k],0),dissipation=parameters.hubDrag*(v[0]-parameters.inputAngularSpeed)**2+parameters.hingeDrag*(v[1]-v[0])**2+parameters.pumpDrag*v[2]**2;
  errors.power=Math.max(errors.power,Math.abs(bodyPower-shaftPower+dissipation));for(let k=0;k<3;k++)errors.force=Math.max(errors.force,Math.abs(f[k]-expected[k]));
  rows.push({q,v,shaftPower,bodyPower,dissipation});
}
verifyStudySources(sources);const report={movement:86,status:'relative-bearing-and-pump-loss-controls',passed:errors.power<1e-10&&errors.force<1e-12,mechanicsPassed:false,candidateIntegrated:false,parameters,errors,poses:rows.length,rows,sources,
  qualification:'Hub friction exchanges work with the rotating input shaft and dissipates relative motion. Hinge friction supplies equal/opposite generalized torques; vertical pump drag opposes travel. All three loss terms have nonnegative dissipation. Coefficients and omitted pump hardware remain explicit reconstruction assumptions.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,sources:undefined});if(!report.passed)process.exitCode=1;
