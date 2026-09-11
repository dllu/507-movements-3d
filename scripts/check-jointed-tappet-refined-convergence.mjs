import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{makeJointedTappetCandidate}from'./lib/jointed-tappet-candidate.mjs';import{makeJointedTappetDynamics,advanceJointedTappetStep}from'./lib/jointed-tappet-dynamics-study.mjs';
const candidate=makeJointedTappetCandidate(),physics=makeJointedTappetDynamics(candidate,{period:24,load:3,damping:[3,.008,100,.003]}),duration=7.2,runs=[],failures=[],sources=[];
for(const file of ['scripts/check-jointed-tappet-refined-convergence.mjs','scripts/lib/jointed-tappet-candidate.mjs','scripts/lib/finite-plate-study.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
for(const dt of [.000125,.0000625,.00003125]){
 let state=physics.initial,minimumGap=Infinity,inputWork=0,dampingWork=0,loadWork=0,energyDefect=0,positiveEnergyDefect=0,maxTeeth=0,maximumIterations=0;const samples=[{time:0,x:[...state.x],v:[...state.v]}],dense=dt===.00003125?[[0,...state.x,...state.v]]:null,steps=Math.round(duration/dt),stride=Math.round(.001/dt);
 for(let i=1;i<=steps;i++){
  const result=advanceJointedTappetStep(physics,state,dt);if(!result.okay){failures.push({dt,step:i,reason:result.reason});break;}
  state=result.state;state.time=i*dt;const d=result.diagnostic;minimumGap=Math.min(minimumGap,d.minimumGap);inputWork+=d.inputWork;dampingWork+=d.dampingWork;loadWork+=d.loadWork;energyDefect+=d.energyDefect;positiveEnergyDefect+=Math.max(0,d.energyDefect);maxTeeth=Math.max(maxTeeth,(state.x[2]-physics.initial.x[2])/candidate.root.userData.geometry.pitch);maximumIterations=Math.max(maximumIterations,d.iterations);
  if(i%stride===0)samples.push({time:state.time,x:[...state.x],v:[...state.v]});if(dense)dense.push([state.time,...state.x,...state.v]);
 }
 const run={dt,steps,samples,final:state,minimumGap,maximumIterations,maxTeeth,finalTeeth:(state.x[2]-physics.initial.x[2])/candidate.root.userData.geometry.pitch,energy:{inputWork,dampingWork,loadWork,energyDefect,positiveEnergyDefect}};runs.push(run);console.log({...run,samples:undefined});
 if(dense)await writeFile('artifacts/review/076-refined-dense-first-count.json',JSON.stringify({movement:76,status:'dense-implicit-first-count',productionChanged:false,mechanicsPassed:false,parameters:physics.parameters,geometry:candidate.root.userData.geometry,dt,sources,columns:['time','q','alpha','theta','beta','qDot','alphaDot','thetaDot','betaDot'],states:dense,qualification:'Raw finest-step contact trajectory. Not yet compressed or integrated into the browser model.'})+'\n',{flag:'wx'});
}
const comparisons=[];
for(let i=1;i<runs.length;i++){
 const coarse=runs[i-1],fine=runs[i],maximumAngleErrors=[0,0,0,0],witness=[];
 for(let j=0;j<Math.min(coarse.samples.length,fine.samples.length);j++)for(let k=0;k<4;k++){
  const error=Math.abs(coarse.samples[j].x[k]-fine.samples[j].x[k]);if(error>maximumAngleErrors[k]){maximumAngleErrors[k]=error;witness[k]={time:fine.samples[j].time,error};}
 }
 comparisons.push({coarseStep:coarse.dt,fineStep:fine.dt,maximumAngleErrors,witness,inputWorkDifference:Math.abs(coarse.energy.inputWork-fine.energy.inputWork),maxTeethDifference:Math.abs(coarse.maxTeeth-fine.maxTeeth)});
}
for(const run of runs)if(Math.abs(run.finalTeeth-1)>1e-6||Math.abs(run.final.x[0]-.3)>1e-6||Math.abs(run.final.x[1])>1e-6||run.minimumGap< -2e-9)failures.push({reason:'endpoint-or-clearance',dt:run.dt});
const last=comparisons.at(-1);if(last.maximumAngleErrors.some(v=>v>.0015))failures.push({reason:'finest-angle-difference',errors:last.maximumAngleErrors});
for(let i=1;i<comparisons.length;i++)if(comparisons[i].maximumAngleErrors.some((v,k)=>v>comparisons[i-1].maximumAngleErrors[k]*.85+1e-7))failures.push({reason:'angle-differences-not-reducing',comparison:i});
if(runs.at(-1).energy.positiveEnergyDefect>runs[0].energy.positiveEnergyDefect*.4)failures.push({reason:'positive-energy-defect-not-reducing'});
const report={movement:76,status:'implicit-step-convergence-check',productionChanged:false,mechanicsPassed:false,passed:failures.length===0,duration,sources,runs:runs.map(({samples,...r})=>r),comparisons,failures,qualification:'Equal physical-time samples at 1 ms from three finer fixed integration steps. All contacts retain actual finite-profile derivatives; impacts are inelastic. This checks convergence of the first count for the selected mass/load/damping assumptions. Rendering, cached interpolation and complete repeated-body clearance require separate validation.'};
await writeFile('artifacts/review/076-refined-step-convergence.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,comparisons,failures});process.exitCode=report.passed?0:1;
