import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {makeCrossedRackDynamics,advanceCrossedRackStep} from './lib/crossed-rack-dynamics-study.mjs';
const geometry=JSON.parse(process.env.GEOMETRY_OPTIONS??'{}'),options=JSON.parse(process.env.PHYSICS_OPTIONS??'{}'),
 candidate=makeCrossedRackCandidate(geometry),physics=makeCrossedRackDynamics(candidate,options),dt=Number(process.env.PROBE_DT??.002),
 duration=Number(process.env.PROBE_DURATION??20),steps=Math.round(duration/dt),rows=[],failures=[],
 output=process.env.PROBE_OUTPUT??'artifacts/review/080-initial-dynamics.json';
if(!(dt>0&&duration>0))throw Error('Invalid study duration or step');
const files=['scripts/study-crossed-rack-dynamics.mjs','scripts/lib/crossed-rack-dynamics-study.mjs','scripts/lib/crossed-rack-contact-study.mjs',
 'scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs','scripts/lib/pull-pawl-contact-study.mjs',
 'scripts/lib/alternating-peg-dynamics-study.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs','src/simulation/finite-plate-geometry.js'],
 sources=files.map((file,i)=>{const archive=output.replace(/\.json$/,'')+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
  return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};});
let state=physics.initial,minimumGap=Infinity,maximumResidual=0,maximumIterations=0;
rows.push({...state,q:physics.input(0).q});
for(let i=0;i<steps;i++){
 const result=advanceCrossedRackStep(physics,state,dt);
 if(!result.okay){failures.push(result);break;}
 state=result.state;const d=result.diagnostic;minimumGap=Math.min(minimumGap,d.minimumGap);
 maximumResidual=Math.max(maximumResidual,d.residual);maximumIterations=Math.max(maximumIterations,d.iterations);
 rows.push({...state,q:physics.input(state.time).q,...d});
 if((i+1)%500===0)console.log({step:i+1,time:state.time,pitches:state.x[0]/candidate.root.userData.geometry.pitch,minimumGap,maximumIterations});
}
const report={movement:80,status:failures.length?'finite-dynamics-study-failed':'finite-dynamics-study-ran',productionChanged:false,mechanicsPassed:false,
 geometry,parameters:physics.parameters,dt,duration,minimumGap,maximumResidual,maximumIterations,rows,failures,sources,
 qualification:'Exploratory rack translation and two free pawl angles under a prescribed lever, common-density gravity, moving-pivot inertia and damping. Finite outer profile vertex/edge constraints determine contact. Slot/fulcrum and other 3D clearance, edge crossings, formulas, energy, convergence and stable finite travel remain unverified.'};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({output,rows:rows.length,failures:failures.map(f=>({reason:f.reason,time:f.time})),finalPitches:state.x[0]/candidate.root.userData.geometry.pitch});
if(failures.length)process.exitCode=1;
