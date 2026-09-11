import{readFile,writeFile}from'node:fs/promises';
import{makeMutilatedBevelCandidate}from'./lib/mutilated-bevel-candidate.mjs';
import{applySectorRelief}from'./lib/mutilated-bevel-tooth-relief.mjs';
import{prepareBevelAngularOverlap}from'./lib/bevel-angular-overlap.mjs';
import{setSpin}from'../src/simulation/primitives.js';

const file='artifacts/review/074-continuous-relief-study.json',relief=JSON.parse(await readFile(file,'utf8')),model=makeMutilatedBevelCandidate(relief.parameters);
applySectorRelief(model,relief);const{blocks:b,geometry:p}=model.root.userData,overlap=prepareBevelAngularOverlap(b.gearA,b.driverC),rows=[];
const start=.5-p.shiftTeeth/p.driverTeeth,end=1-p.shiftTeeth/p.driverTeeth;
for(const coordinate of [start,start+1e-5,start+.002,start+.00625,start+.0125,start+.025,.7,end-.025,end-.0125,end-.00625,end-.002,end-1e-5,end]){
  model.update((coordinate-p.initialCyclePhase)*p.period);model.root.updateMatrixWorld(true);
  const nominal=model.root.userData.kinematics.angleA;
  const evaluate=delta=>{setSpin(b.gearA,nominal-delta);model.root.updateMatrixWorld(true);return overlap();};
  let low=0,high=1e-5;
  const initial=evaluate(0);if(initial.maximumArea>1e-13)throw new Error('Nominal pose already intersects');
  while(high<Math.PI/p.outputTeeth&&evaluate(high).maximumArea<1e-13)high*=2;
  if(high>=Math.PI/p.outputTeeth){rows.push({coordinate,nominal,reason:'No tooth obstruction within half a pitch'});continue;}
  for(let i=0;i<42;i++){const middle=(low+high)/2;if(evaluate(middle).maximumArea>1e-13)high=middle;else low=middle;}
  rows.push({coordinate,nominal,delta:(low+high)/2,loadedAngle:nominal-(low+high)/2,bracket:[low,high],
    lower:evaluate(low),upper:evaluate(high)});
}
const report={movement:74,status:'isolated-loaded-phase-study',relief:file,parameters:p,rows,
  qualification:'Diagnostic branch search: decrease output angle from its prescribed pose until angular tooth footprints first overlap. An opposing torque would take up clearance in this direction only if the encountered normal supplies positive drive torque. Footprint contact, common radial material, force direction, continuity and actual triangle contact still require verification; this is not an accepted motion law.'};
await writeFile('artifacts/review/074-loaded-phase-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(rows);
