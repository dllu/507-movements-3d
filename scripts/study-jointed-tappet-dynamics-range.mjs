import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{makeJointedTappetCandidate}from'./lib/jointed-tappet-candidate.mjs';
import{makeJointedTappetDynamics,advanceJointedTappetStep}from'./lib/jointed-tappet-dynamics-study.mjs';
const output=process.env.PROBE_OUTPUT??'artifacts/review/076-dynamics-nose-range.json',rows=[];
const cases=JSON.parse(process.env.CASES??'null')??[...[[.87,.05],[.89,.0375],[.9,.025]].flatMap(([rootRadius,faceAngle])=>[[790,700],[800,711],[805,711]].flatMap(nosePixels=>[12,60].map(period=>({rootRadius,faceAngle,nosePixels,period}))))];
const sources=[];for(const file of ['scripts/study-jointed-tappet-dynamics-range.mjs','scripts/lib/jointed-tappet-candidate.mjs','scripts/lib/finite-plate-study.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
for(const parameters of cases){
 const {period,load=3,damping=[.08,.008,1,.003],...motionParameters}=parameters,c=makeJointedTappetCandidate({motionParameters}),p=c.root.userData.geometry,physics=makeJointedTappetDynamics(c,{period,load,damping}),baseStep=Number(process.env.STEP??.001),duration=period*Number(process.env.DURATION_RATIO??.3);
 let state=physics.initial,steps=0,reductions=0,minimumGap=Infinity,maximumImpulse=0,minTeeth=0,maxTeeth=0,maxQ=0,minQ=0,maxAlpha=0,minAlpha=0,minBeta=0,maxBeta=0,inputWork=0,energyDefect=0,positiveEnergyDefect=0,nextSample=0,stop=null;
 const samples=[],initialGaps=physics.constraints(state.x,0).gaps;
 if(Math.min(...Object.values(initialGaps))< -1e-6)stop={reason:'initial-penetration',initialGaps};
 while(!stop&&state.time<duration-1e-12){
  let dt=Math.min(baseStep,duration-state.time),result=advanceJointedTappetStep(physics,state,dt),halvings=0;
  while(!result.okay&&halvings<8){dt/=2;halvings++;result=advanceJointedTappetStep(physics,state,dt);}
  if(!result.okay){stop={reason:result.reason,time:state.time,dt};break;}
  reductions+=halvings;state=result.state;steps++;const d=result.diagnostic,teeth=(state.x[2]-p.wheelStart)/p.pitch;
  minimumGap=Math.min(minimumGap,d.minimumGap);maximumImpulse=Math.max(maximumImpulse,d.normalImpulse);minTeeth=Math.min(minTeeth,teeth);maxTeeth=Math.max(maxTeeth,teeth);
  minQ=Math.min(minQ,state.x[0]);maxQ=Math.max(maxQ,state.x[0]);minAlpha=Math.min(minAlpha,state.x[1]);maxAlpha=Math.max(maxAlpha,state.x[1]);minBeta=Math.min(minBeta,state.x[3]);maxBeta=Math.max(maxBeta,state.x[3]);
  inputWork+=d.inputWork;energyDefect+=d.energyDefect;positiveEnergyDefect+=Math.max(0,d.energyDefect);
  if(state.time>=nextSample){samples.push({...state,contacts:d.contacts});nextSample+=period/1200;}
  if(Math.abs(teeth)>4||Math.abs(state.x[3])>1.5){stop={reason:'diagnostic-range-exceeded',time:state.time,teeth,beta:state.x[3]};break;}
 }
 const result={parameters,geometry:p,physics:physics.parameters,initialGaps,steps,reductions,stop,final:state,minimumGap,maximumImpulse,minTeeth,maxTeeth,finalTeeth:(state.x[2]-p.wheelStart)/p.pitch,minQ,maxQ,minAlpha,maxAlpha,minBeta,maxBeta,inputWork,energyDefect,positiveEnergyDefect,samples};rows.push(result);
 console.log(JSON.stringify({...result,samples:undefined,final:undefined}));
 c.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
}
await writeFile(output,JSON.stringify({movement:76,status:'finite-mass-dynamics-range',mechanicsPassed:false,productionChanged:false,sources,rows,qualification:'Exploratory nose/tooth/speed range using independently checked formulas. Initial overlap and excessive motion stop individual cases. No full-body clearance or repeated-cycle validation yet.'},null,2)+'\n',{flag:'wx'});
