import fs from 'node:fs';
import crypto from 'node:crypto';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {makePullPawlDynamics,advancePullPawlStep} from './lib/pull-pawl-dynamics-study.mjs';
const geometry=JSON.parse(process.env.GEOMETRY_OPTIONS??'{}'),options=JSON.parse(process.env.PHYSICS_OPTIONS??'{}'),
 candidate=makePullPawlCandidate(geometry),physics=makePullPawlDynamics(candidate,options),dt=Number(process.env.PROBE_DT??.002),
 duration=Number(process.env.PROBE_DURATION??16),steps=Math.round(duration/dt),rows=[],failures=[];
let state=physics.initial,minimumGap=Infinity,maximumResidual=0,maximumIterations=0;
rows.push({...state,q:physics.input(0).q});
for(let i=0;i<steps;i++){
 const result=advancePullPawlStep(physics,state,dt);
 if(!result.okay){failures.push(result);break;}
 state=result.state;const d=result.diagnostic;minimumGap=Math.min(minimumGap,d.minimumGap);
 maximumResidual=Math.max(maximumResidual,d.residual);maximumIterations=Math.max(maximumIterations,d.iterations);
 rows.push({...state,q:physics.input(state.time).q,...d});
 if((i+1)%500===0)console.log({step:i+1,time:state.time,teeth:(state.x[0]-physics.initial.x[0])/candidate.root.userData.geometry.pitch,minimumGap,maximumIterations});
}
const files=['scripts/study-pull-pawl-dynamics.mjs','scripts/lib/pull-pawl-dynamics-study.mjs','scripts/lib/pull-pawl-contact-study.mjs',
 'scripts/lib/pull-pawl-candidate.mjs','scripts/lib/alternating-peg-dynamics-study.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs'],
 output=process.env.PROBE_OUTPUT??'artifacts/review/078-initial-dynamics.json',
 report={movement:78,status:failures.length?'finite-dynamics-study-failed':'finite-dynamics-study-ran',productionChanged:false,mechanicsPassed:false,
  geometry,parameters:physics.parameters,dt,duration,minimumGap,maximumResidual,maximumIterations,rows,failures,
  qualification:'Exploratory three-angle dynamics with prescribed rocker input, actual finite profile vertex/edge constraints, common-density masses, gravity, moving-pivot inertia, bilateral dry friction and absolute angular damping. Edge crossings, formula checks, energy, convergence, full 3D clearance and stable counting remain unverified.',
  sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({output,rows:rows.length,failures:failures.map(f=>({reason:f.reason,time:f.time})),finalTeeth:(state.x[0]-physics.initial.x[0])/candidate.root.userData.geometry.pitch});
if(failures.length)process.exitCode=1;
