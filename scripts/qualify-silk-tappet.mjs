import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeSilkTappetPhysics} from '../src/simulation/mujoco-silk-tappet/physics.js';
const mujoco=await loadMujoco(), runs=[];
for(const options of [{},{timestep:.000025},{enabled:false}]) {
  const p=makeSilkTappetPhysics(mujoco,options), turns=[], samples=[];
  let minimumGap=0,contactSteps=0,maximumCarrierError=0,previousWheel=0, maximumWheel=0, maximumRollback=0;
  const perTurn=Math.round(4/p.timestep),stride=Math.round(.0005/p.timestep);
  try {
    for(let i=0;i<=18*perTurn;i++) {
      const s=p.state();maximumWheel=Math.max(maximumWheel,s.wheel);maximumRollback=Math.max(maximumRollback,maximumWheel-s.wheel);assert.ok(Object.values(s).every(Number.isFinite));
      maximumCarrierError=Math.max(maximumCarrierError,Math.abs(s.carrier-(p.parameters.start+p.parameters.speed*s.time)));
      if(i%stride===0)samples.push(s);
      if(i>0&&i%perTurn===0){turns.push({turn:i/perTurn,wheel:s.wheel,advance:s.wheel-previousWheel,dwellSpeed:s.wheelSpeed});previousWheel=s.wheel;}
      if(p.data.ncon){contactSteps++;for(let j=0;j<p.data.ncon;j++)minimumGap=Math.min(minimumGap,p.data.contact.get(j).dist);}
      if(i<18*perTurn)p.step();
    }
    runs.push({parameters:p.parameters,turns,minimumGap,contactSteps,maximumCarrierError,maximumRollback,samples});
  }finally{p.dispose();}
}
fs.writeFileSync('/dev/shm/173-native-tappet.json',JSON.stringify(runs));
let maximumTimestepAngleDifference=0;
runs[0].samples.forEach((s,i)=>maximumTimestepAngleDifference=Math.max(maximumTimestepAngleDifference,Math.abs(s.wheel-runs[1].samples[i].wheel)));
const report={movement:173,status:'passive-tappet-contact-qualified',duration:72,
  scope:'Standalone carrier, spherical tappet, hub and 18 straight box teeth. Only carrier has an actuator. Whole production assembly has separate visible-solid audits.',
  assumptions:'Tooth dimensions, pin height, phase, inertia and screw friction are inferred. A contact margin prevents penetration; native results are not a rendered-solid clearance certificate.',
  maximumTimestepAngleDifference,runs:runs.map(({samples,...run})=>run),
  sources:['scripts/qualify-silk-tappet.mjs','src/simulation/mujoco-silk-tappet/physics.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/173-native-tappet.json',JSON.stringify(report,null,2)+'\n');
for(const r of runs.slice(0,2)){
 assert.ok(r.contactSteps>0);assert.ok(r.minimumGap>-.0005);
 for(const t of r.turns){assert.ok(Math.abs(t.advance-r.parameters.pitch)<.003,JSON.stringify(t));assert.ok(Math.abs(t.dwellSpeed)<1e-5);}
 assert.ok(r.maximumCarrierError<.0001);assert.ok(r.maximumRollback<.001);
}
assert.equal(runs[2].contactSteps,0);assert.ok(Math.abs(runs[2].turns.at(-1).wheel)<1e-12);
assert.ok(maximumTimestepAngleDifference<.001);
console.log(JSON.stringify({maximumTimestepAngleDifference,runs:runs.map(r=>({timestep:r.parameters.timestep,enabled:r.parameters.enabled,minimumGap:r.minimumGap,maximumCarrierError:r.maximumCarrierError,advances:r.turns.map(t=>t.advance)}))},null,2));
