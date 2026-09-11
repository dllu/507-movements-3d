import { writeFile } from 'node:fs/promises';
import { makeElasticRatchetStudy } from './lib/spring-pressed-ratchet-elastic.mjs';
import { minimizeElasticEnergy } from './lib/elastic-ratchet-minimizer.mjs';

const study=makeElasticRatchetStudy({segments:Number(process.env.SPRING_SEGMENTS??20),
  strongStiffness:Number(process.env.STRONG_STIFFNESS??6),load:Number(process.env.OUTPUT_LOAD??.002),
  strongRootPixels:Number(process.env.STRONG_ROOT_PIXELS??32),strongTipPixels:Number(process.env.STRONG_TIP_PIXELS??24),
  strongClampY:process.env.STRONG_CLAMP_Y==='none'?null:Number(process.env.STRONG_CLAMP_Y??890),
  penalty:Number(process.env.CONTACT_PENALTY??1000),wheelContactMode:process.env.WHEEL_CONTACT??'full-leaf',
  wheelFeatureMode:process.env.WHEEL_FEATURES??'nearest',springContactMode:process.env.SPRING_CONTACT??'endpoints'}),gradientChecks=[];
for(const input of [-3.06,-3.12]){
  const x=study.initial.map((v,i)=>v+.0001*Math.sin(i*1.317+.2)),state=study.evaluate(x,input,{details:true});
  let maximumError=0,maximumRelativeError=0,worst;
  for(let i=0;i<x.length;i++){
    const a=[...x],b=[...x],h=1e-7;a[i]-=h;b[i]+=h;
    const numerical=(study.evaluate(b,input).energy-study.evaluate(a,input).energy)/(2*h),error=Math.abs(numerical-state.gradient[i]);
    const relative=error/Math.max(1,Math.abs(numerical),Math.abs(state.gradient[i]));
    if(error>maximumError){maximumError=error;worst={i,numerical,analytic:state.gradient[i]};}maximumRelativeError=Math.max(maximumRelativeError,relative);
  }
  gradientChecks.push({input,maximumError,maximumRelativeError,worst,contacts:state.contacts.map(r=>r.kind)});
}
if(gradientChecks.some(r=>r.maximumRelativeError>1e-5))throw new Error('Active contact gradient failed: '+JSON.stringify(gradientChecks));
let x=[...study.initial],rows=[],snapshots=[],failure=null;
const steps=Number(process.env.SPRING_STEPS??240),maxRounds=Number(process.env.SPRING_ROUNDS??12);
for(let step=0;step<=steps;step++){
  const input=-2*Math.PI*step/steps,rounds=[];let result,history=[];
  const previousQ=x[study.qIndex],evaluate=state=>{
    if(Math.abs(state[study.qIndex]-previousQ)>study.ratchet.pitch/2)
      return{energy:Infinity,gradient:Array(study.size).fill(NaN)};
    try{return study.evaluate(state,input);}catch(error){
      if(['Spring centerlines crossed','Spring tip center entered wheel'].includes(error.message))return{energy:Infinity,gradient:Array(study.size).fill(NaN)};
      throw error;
    }
  };
  try{
    for(let round=0;round<maxRounds;round++){
      result=minimizeElasticEnergy(evaluate,x,{iterations:800,tolerance:2e-7,initialHistory:history});x=result.x;history=result.history;
      rounds.push({round,iterations:result.iterations,gradient:result.maximumGradient,penetration:result.maximumPenetration,reason:result.reason});
      study.updateMultipliers(result);
      const refreshed=study.evaluate(x,input);
      rounds.at(-1).updatedGradient=Math.max(...refreshed.gradient.map(Math.abs));
      if(result.maximumGradient<2e-7&&refreshed.maximumPenetration<2e-7&&rounds.at(-1).updatedGradient<2e-7)break;
    }
    const state=study.evaluate(x,input,{details:true});
    rows.push({step,input,q:x[study.qIndex],teethAdvanced:-x[study.qIndex]/study.ratchet.pitch,bendingEnergy:state.bendingEnergy,
      maximumPenetration:state.maximumPenetration,maximumGradient:Math.max(...state.gradient.map(Math.abs)),rounds,
      contactKinds:state.contacts.reduce((counts,r)=>(counts[r.kind]=(counts[r.kind]??0)+1,counts),{})});
    if(step%12===0||state.contacts.some(r=>r.kind==='B-C'))snapshots.push({step,x:[...x],...state,
      multipliers:[...study.multipliers],gaps:undefined,gradient:undefined});
    if(step%24===0)console.log(rows.at(-1));
    if(state.maximumPenetration>1e-5||Math.max(...state.gradient.map(Math.abs))>2e-4||Math.abs(x[study.qIndex]-previousQ)>study.ratchet.pitch*.49){failure={step,input,reason:'Equilibrium, penetration or angular-travel residual exceeds the diagnostic continuation limit. The half-tooth travel bound only stops an escaping trial; it is not a physical stop or accepted contact force.',row:rows.at(-1)};break;}
  }catch(error){failure={step,input,reason:error.message};break;}
}
const report={movement:73,status:'isolated-elastic-driven-study',productionChanged:false,parameters:study.parameters,steps,gradientChecks,rows,snapshots,failure,
  qualification:'Planar quasistatic contact study with inextensible discrete leaves and an opposing output load. Contact is enforced by an augmented Lagrangian. Nodal/midpoint tooth contact and segment spring contact are a discretization; this is not a rendered-hardware audit. Nonconvergence stops continuation and is not mechanical acceptance.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/073-elastic-driven-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,steps,gradientChecks,failure,final:rows.at(-1)});
