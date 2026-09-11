import fs from 'node:fs';import crypto from 'node:crypto';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
import {makeAlternatingPegDynamics,advanceAlternatingPegStep} from './lib/alternating-peg-dynamics-study.mjs';

const options=JSON.parse(process.env.PHYSICS_OPTIONS||'{}'),clockFile=process.env.INPUT_CLOCK;
if(clockFile)options.clock=JSON.parse(fs.readFileSync(clockFile));
const geometry=JSON.parse(process.env.GEOMETRY_OPTIONS||'{}'),candidate=makeAlternatingPegCandidate(geometry),
 physics=makeAlternatingPegDynamics(candidate,options),dt=Number(process.env.PROBE_DT||.002),duration=Number(process.env.PROBE_DURATION||36),
 output=process.env.PROBE_OUTPUT||'artifacts/review/077-initial-finite-dynamics.json',steps=Math.round(duration/dt),rows=[],failures=[];
let state=physics.initial,minimumGap=Infinity,maximumResidual=0,maximumIterations=0;
rows.push({...state,q:physics.input(0).q});
for(let i=0;i<steps;i++){
 const result=advanceAlternatingPegStep(physics,state,dt);
 if(!result.okay){failures.push(result);break;}
 state=result.state;const d=result.diagnostic;
 minimumGap=Math.min(minimumGap,d.minimumGap);maximumResidual=Math.max(maximumResidual,d.residual);maximumIterations=Math.max(maximumIterations,d.iterations);
 rows.push({...state,q:physics.input(state.time).q,...d});
 if((i+1)%500===0)console.log({step:i+1,time:state.time,x:state.x,teeth:state.x[0]/candidate.root.userData.geometry.pitch,minimumGap,maximumIterations});
}
const sources=[...(clockFile?[clockFile]:[]),'scripts/study-alternating-peg-dynamics.mjs','scripts/lib/alternating-peg-dynamics-study.mjs','scripts/lib/alternating-peg-contact-study.mjs','scripts/lib/alternating-peg-candidate.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs'],
 report={movement:77,status:failures.length?'finite-dynamics-study-failed':'finite-dynamics-study-ran',productionChanged:false,mechanicsPassed:false,dt,duration,geometry,parameters:physics.parameters,
 qualification:'New three-degree-of-freedom finite contact dynamics implementation; formula checks, convergence, energy accounting and whole-body clearance are outstanding. The lever is prescribed. Wheel and both pawls respond to gravity, resisting torque, bearing damping and unilateral frictionless inelastic contact. This run is exploratory.',
 minimumGap,maximumResidual,maximumIterations,failures,rows,sources:sources.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log({output,rows:rows.length,failures:failures.map(f=>({reason:f.reason,time:f.time})),finalTeeth:state.x[0]/candidate.root.userData.geometry.pitch});if(failures.length)process.exitCode=1;
