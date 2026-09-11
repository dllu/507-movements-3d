import { writeFile } from 'node:fs/promises';
import { makeElasticRatchetStudy } from './lib/spring-pressed-ratchet-elastic.mjs';
import { minimizeElasticEnergy } from './lib/elastic-ratchet-minimizer.mjs';

const study=makeElasticRatchetStudy({segments:20}), gradients=[];
for(const input of [0,-2.4,-2.7]){
  const x=study.initial.map((v,i)=>v+.0007*Math.sin(i*1.317+.2));
  let state;
  try{state=study.evaluate(x,input,{details:true});}catch(error){gradients.push({input,error:error.message});continue;}
  let maximumError=0,maximumRelativeError=0,worst;
  for(let i=0;i<x.length;i++){
    const before=[...x],after=[...x],h=1e-7;before[i]-=h;after[i]+=h;
    const numerical=(study.evaluate(after,input).energy-study.evaluate(before,input).energy)/(2*h);
    const error=Math.abs(numerical-state.gradient[i]),relative=error/Math.max(1,Math.abs(numerical),Math.abs(state.gradient[i]));
    if(error>maximumError){maximumError=error;worst={index:i,numerical,analytic:state.gradient[i]};}
    maximumRelativeError=Math.max(maximumRelativeError,relative);
  }
  gradients.push({input,maximumError,maximumRelativeError,worst,contacts:state.contacts.reduce((counts,r)=>(counts[r.kind]=(counts[r.kind]??0)+1,counts),{})});
}
let x=[...study.initial],rounds=[];
for(let round=0;round<12;round++){
  const result=minimizeElasticEnergy(x=>study.evaluate(x,0),x,{iterations:800,tolerance:1e-7});x=result.x;
  rounds.push({round,energy:result.energy,q:x[study.qIndex],maximumGradient:result.maximumGradient,
    maximumPenetration:result.maximumPenetration,iterations:result.iterations,converged:result.converged,reason:result.reason});
  study.updateMultipliers(result);
  if(result.maximumGradient<1e-7&&result.maximumPenetration<1e-7)break;
}
const state=study.evaluate(x,0,{details:true});
const report={movement:73,status:'isolated-elastic-gradient-and-static-study',productionChanged:false,parameters:study.parameters,
  gradients,rounds,state,x,qualification:'Offline planar discrete elastic leaves, prescribed input angle, resisting output torque and unilateral contact. A static result does not establish motion, rendered clearance or source fidelity. The augmented-Lagrange residuals and discretization still require convergence assessment.'};
await writeFile('artifacts/review/073-elastic-static-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({gradients,rounds,contacts:state.contacts.map(({point,normal,...r})=>r)});
if(gradients.some(r=>r.maximumRelativeError>1e-5))process.exitCode=1;
