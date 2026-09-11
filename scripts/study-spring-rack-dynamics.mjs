import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackDynamics} from './lib/spring-rack-dynamics-study.mjs';
const prefix=process.env.PROBE_OUTPUT_PREFIX??'artifacts/review/081-first-dynamics',
 geometry={...JSON.parse(fs.readFileSync('artifacts/review/081-fitted-source-pose.json')).options,...JSON.parse(process.env.CANDIDATE_OPTIONS??'{}')},
 parameters=JSON.parse(process.env.PHYSICS_OPTIONS??'{}'),model=makeSpringRackCandidate(geometry),physics=makeSpringRackDynamics(model,parameters),
 dt=Number(process.env.PROBE_DT??.001),duration=Number(process.env.PROBE_DURATION??6),steps=Math.round(duration/dt),rows=[],failures=[];
let state=physics.initial,maximumIterations=0,minimumGap=Infinity;
const save=diagnostic=>rows.push({...state,q:physics.input(state.time).q,energy:physics.energy(state.x,state.v),diagnostic});save(null);
for(let i=0;i<steps;i++){
 const result=physics.advance(physics,state,dt);if(!result.okay){failures.push(result);break;}
 state=result.state;state.time=(i+1)*dt;maximumIterations=Math.max(maximumIterations,result.diagnostic.iterations);minimumGap=Math.min(minimumGap,result.diagnostic.minimumGap);save(result.diagnostic);
}
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sources=[];
for(const file of ['scripts/study-spring-rack-dynamics.mjs','scripts/lib/spring-rack-dynamics-study.mjs','scripts/lib/spring-rack-contact-study.mjs',
 'scripts/lib/spring-rack-candidate.mjs','scripts/lib/spring-rack-coil.mjs','scripts/lib/spring-rack-source.mjs','scripts/lib/alternating-peg-dynamics-study.mjs',
 'scripts/lib/jointed-tappet-dynamics-study.mjs','artifacts/review/081-fitted-source-pose.json']){
 const archive=prefix+'-source-'+sources.length+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hash(file)});
}
const report={movement:81,status:'isolated-spring-rack-dynamics',productionChanged:false,mechanicsPassed:false,geometry,parameters:physics.parameters,dt,duration,
 rows,failures,maximumIterations,minimumGap,sources,qualification:'Exploratory backward-Euler dynamics of one free rack coordinate projected onto exact finite-profile vertical clearance intervals, with gravity, a massless Hookean compression spring, viscous guide drag and actual rear-slot travel stops. Only wheel rotation is prescribed. Global branch projection still requires contact, continuity, energy, refinement and actual-surface validation; this is not yet qualified playback.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({rows:rows.length,failures:failures.map(f=>({reason:f.reason,time:f.time,x:f.x,minimumGap:f.minimumGap,gaps:f.contact?.gaps})),maximumIterations,minimumGap,range:[Math.min(...rows.map(r=>r.x[0])),Math.max(...rows.map(r=>r.x[0]))],
 cycles:Array.from({length:Math.floor(duration/physics.parameters.period)+1},(_,i)=>rows[Math.round(i*physics.parameters.period/dt)]).filter(Boolean).map(r=>({time:r.time,y:r.x[0],v:r.v[0]}))});
if(failures.length)process.exitCode=1;
