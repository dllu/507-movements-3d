import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeJointedTappetCandidate}from'./lib/jointed-tappet-candidate.mjs';
import{makeJointedTappetDynamics,advanceJointedTappetStep}from'./lib/jointed-tappet-dynamics-study.mjs';

const candidate=makeJointedTappetCandidate({motionParameters:JSON.parse(process.env.MOTION_PARAMETERS??'{}')}),period=Number(process.env.PERIOD??12),load=Number(process.env.LOAD??3),
  physics=makeJointedTappetDynamics(candidate,{period,load,damping:JSON.parse(process.env.DAMPING??'[0.08,0.008,1,0.003]')}),duration=Number(process.env.DURATION??2.5),baseStep=Number(process.env.STEP??.0005),
  output=process.env.PROBE_OUTPUT??'artifacts/review/076-initial-dynamics-study.json',rows=[],failures=[],reductions=[];
let state=physics.initial,nextSample=0,steps=0,minimumGap=Infinity,maximumIterations=0,maximumResidual=0,maximumImpulse=0,
  inputWork=0,loadWork=0,dampingWork=0,energyDefect=0,positiveEnergyDefect=0;
while(state.time<duration-1e-12){
  let dt=Math.min(baseStep,duration-state.time),result=advanceJointedTappetStep(physics,state,dt),halvings=0;
  while(!result.okay&&halvings<8){dt/=2;halvings++;result=advanceJointedTappetStep(physics,state,dt);}
  if(!result.okay){failures.push(result);break;}
  if(halvings)reductions.push({time:state.time,dt,halvings});state=result.state;steps++;
  const d=result.diagnostic;minimumGap=Math.min(minimumGap,d.minimumGap);maximumIterations=Math.max(maximumIterations,d.iterations);
  maximumResidual=Math.max(maximumResidual,d.projectionResidual);maximumImpulse=Math.max(maximumImpulse,d.normalImpulse);
  inputWork+=d.inputWork;loadWork+=d.loadWork;dampingWork+=d.dampingWork;energyDefect+=d.energyDefect;positiveEnergyDefect+=Math.max(0,d.energyDefect);
  if(state.time>=nextSample||state.time>=duration-1e-12){
    rows.push({...state,diagnostic:d});nextSample+=.005;
  }
  if(steps>2e6)throw new Error('Unexpected integration step count');
}
const sourceFiles=['scripts/lib/jointed-tappet-candidate.mjs','scripts/lib/finite-plate-study.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs','scripts/study-jointed-tappet-dynamics.mjs'],sources=[];
for(const file of sourceFiles)sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const report={movement:76,status:'finite-mass-contact-dynamics-diagnostic',productionChanged:false,mechanicsPassed:false,
  parameters:{...physics.parameters,duration,baseStep,geometry:candidate.root.userData.geometry},steps,rows,failures,reductions,
  final:state,minimumGap,maximumIterations,maximumResidual,maximumImpulse,
  energy:{inputWork,loadWork,dampingWork,energyDefect,positiveEnergyDefect},
  maximumTeeth:Math.max(...rows.map(r=>(r.x[2]-physics.initial.x[2])/candidate.root.userData.geometry.pitch)),
  finalTeeth:(state.x[2]-physics.initial.x[2])/candidate.root.userData.geometry.pitch,sources,
  method:{reference:'https://www.cse.lehigh.edu/~trink/Papers/STicra00.pdf',
    description:'Frictionless impulse-momentum stepping with implicit geometry iteration, measured rigid-body mass matrix, gravity, opposing output torque, viscous bearing damping and inelastic contact. A four-variable convex contact projection is solved by an active-basis search. This is a new implementation requiring independent numerical and geometric validation.'},
  qualification:'Only the two finite circular pawl noses, source capsule/stud contact and two actual finite rear stop sectors enter dynamics. Whole-body interference, mesh/mass formulas, step convergence, force and energy consistency, and correct repeated counting are not yet accepted. Diagnostic code zero means the study ran, not that the mechanism passed.'};
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({steps,finalTime:state.time,minimumGap,maximumIterations,maximumResidual,maximumImpulse,final:state,
  maximumTeeth:report.maximumTeeth,finalTeeth:report.finalTeeth,reductions:reductions.length,failures:failures.map(f=>({reason:f.reason,time:f.time,dt:f.dt,minimumGap:f.minimumGap})),energy:report.energy});
