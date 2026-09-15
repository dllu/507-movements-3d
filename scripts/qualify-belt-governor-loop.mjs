import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeBeltGovernorPhysics} from '../src/simulation/mujoco-belt-governor/physics.js';
const m=await loadMujoco(),calibration=makeBeltGovernorPhysics(m),period=16*Math.PI/calibration.description.nominalSpeed;calibration.dispose();
const steps=65536,stride=64,cycles=128,p=makeBeltGovernorPhysics(m,{period,timestep:period/steps,speedAmplitude:.25}),samples=[];
try{
 for(let tick=0;tick<=cycles*steps;tick++){
  if(tick>=(cycles-2)*steps&&tick%stride===0)samples.push(p.state());
  if(tick<cycles*steps)p.step();
 }
 const n=steps/stride,rows=[];
 for(let i=0;i<n;i++){
  const a=samples[i],b=samples[i+n],advance=a.qpos.map((x,j)=>j===0?16*Math.PI:j>=11?b.qpos[j]-x:0),residual=a.qpos.map((x,j)=>b.qpos[j]-x-advance[j]),velocityResidual=a.qvel.map((x,j)=>b.qvel[j]-x);
  rows.push({index:i,phase:i*stride*p.timestep,sourceTime:a.time,advance,residual,velocityResidual,maximumPositionError:Math.max(...residual.map(Math.abs)),maximumVelocityError:Math.max(...velocityResidual.map(Math.abs)),sourceSpreadError:Math.abs(a.leftSpread-p.geometry.initialSpread)});
 }
 const qualified=rows.filter(r=>r.maximumPositionError<1e-5&&r.maximumVelocityError<1e-4).sort((a,b)=>a.sourceSpreadError-b.sourceSpreadError),best=qualified[0]??[...rows].sort((a,b)=>Math.max(a.maximumPositionError/1e-5,a.maximumVelocityError/1e-4)-Math.max(b.maximumPositionError/1e-5,b.maximumVelocityError/1e-4))[0];
 const report={movement:163,status:qualified.length?'native-loop-qualified':'native-loop-unqualified',period,timestep:p.timestep,cycles,stride,parameters:p.description,maximumCyclePositionError:Math.max(...rows.map(r=>r.maximumPositionError)),maximumCycleVelocityError:Math.max(...rows.map(r=>r.maximumVelocityError)),best,initialState:samples[0],method:'Compare corresponding states throughout the final two of 128 native cycles. Spindle advances eight complete turns. Loose-pulley angle is an axisymmetric free phase; belt travel is an unconstrained translation. Preserve their measured advances, not rounded or balanced travel. Choose a qualified seam near the engraved neutral spread.',sources:['scripts/qualify-belt-governor-loop.mjs','src/simulation/mujoco-belt-governor/physics.js','src/simulation/mujoco-belt-governor/geometry.js','src/simulation/mujoco-belt-governor/belt-contact.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('/dev/shm/163-loop-candidate.json',JSON.stringify({report,geometry:p.geometry,samples}));fs.writeFileSync('docs/validation/163-loop-qualification.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.ok(qualified.length,'No repeat seam within tolerances');
}finally{p.dispose();}
