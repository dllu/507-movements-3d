import fs from 'node:fs';
import {makeReciprocatingPawlRatchet} from '../src/simulation/reciprocating-pawl.js';
import {makeReciprocatingPawlDynamics,advanceReciprocatingPawlStep} from './lib/reciprocating-pawl-dynamics.mjs';
const model=makeReciprocatingPawlRatchet(),physics=makeReciprocatingPawlDynamics(model,JSON.parse(process.env.PHYSICS_OPTIONS||'{}')),
 dt=Number(process.env.PROBE_DT||.0005),duration=Number(process.env.PROBE_DURATION||12),output=process.env.PROBE_OUTPUT||'artifacts/review/075-continuous-dynamics.json',rows=[],failures=[];
let state=physics.initial,minimumGap=Infinity;rows.push({...state,q:physics.input(0).q});
for(let i=0;i<Math.round(duration/dt);i++){
 let result=advanceReciprocatingPawlStep(physics,state,dt);
 // Refine actual time steps at impacts instead of moving a pawl to another branch.
 if(!result.okay){
  let fine=state,okay=true;
  for(let j=0;j<8;j++){const r=advanceReciprocatingPawlStep(physics,fine,dt/8);if(!r.okay){okay=false;break;}fine=r.state;result=r;}
  if(!okay){failures.push(result);break;}
 }
 state=result.state;minimumGap=Math.min(minimumGap,result.diagnostic.minimumGap);
 rows.push({...state,q:physics.input(state.time).q,...result.diagnostic});
 if((i+1)%1000===0)console.log({time:state.time,teeth:(state.x[0]-physics.initial.x[0])/model.root.userData.geometry.pitch,angles:state.x.slice(1),minimumGap});
}
fs.writeFileSync(output,JSON.stringify({dt,duration,parameters:physics.parameters,minimumGap,failures,rows}));
console.log({output,rows:rows.length,failures:failures.map(f=>({reason:f.reason,time:f.time}))});if(failures.length)process.exitCode=1;
