import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeWaterGovernorPhysics,waterGovernorGeometry} from '../src/simulation/mujoco-water-governor/physics.js';
import {governorEquilibrium} from '../src/simulation/mujoco-ball-governor/equilibrium.js';
const g=waterGovernorGeometry(),period=14*Math.PI/governorEquilibrium(g.initialSpread,g).speed,steps=65536,stride=32;
const p=makeWaterGovernorPhysics(await loadMujoco(),{period,timestep:period/steps}),samples=[];
const visibleBound=d=>(g.pivotRadius+g.ballArm+g.ballRadius)*Math.abs(d[0])+(g.ballArm+g.ballRadius)*Math.max(Math.abs(d[1]),Math.abs(d[3]))+(g.lowerLink+.13)*Math.max(Math.abs(d[2]),Math.abs(d[4]))+Math.abs(d[5])+.666*Math.max(...d.slice(6).map(Math.abs));
try{
 if(process.argv.includes('--reuse-native')){
  const saved=JSON.parse(fs.readFileSync('/dev/shm/162-loop-candidate.json'));
  for(const source of saved.report.sources.filter(s=>s.file!=='scripts/qualify-water-governor-loop.mjs'))assert.equal(createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,'stale native sample source');
  assert.equal(saved.report.period,period);assert.equal(saved.report.timestep,p.timestep);assert.deepEqual(saved.geometry,g);assert.equal(saved.samples.length,4097);samples.push(...saved.samples);
 }else for(let tick=0;tick<=64*steps;tick++){
  if(tick%steps===0)assert.ok(Math.abs(p.data.time-tick*p.timestep)<1e-6,'native clock reset');
  if(tick>=62*steps&&tick%stride===0)samples.push(p.state());
  if(tick<64*steps)p.step();
 }
 const n=steps/stride,candidates=[];
 for(let i=0;i<n;i++){
  const a=samples[i],b=samples[i+n];if(a.contacts.length===0||b.contacts.length===0||Math.abs(a.outputSpeed)<1||Math.abs(b.outputSpeed)<1)continue;
  const turns=a.qpos.map((x,j)=>[0,6,7,8].includes(j)?2*Math.PI*Math.round((b.qpos[j]-x)/(2*Math.PI)):0);
  const residual=a.qpos.map((x,j)=>b.qpos[j]-x-turns[j]),velocityResidual=a.qvel.map((x,j)=>b.qvel[j]-x),positionBound=visibleBound(residual),velocityBound=visibleBound(velocityResidual);
  candidates.push({index:i,phase:i*stride*p.timestep,sourceTime:a.time,turns,positionBound,velocityBound,residual,velocityResidual,score:Math.max(positionBound/.0001,velocityBound/.001)});
 }
 candidates.sort((a,b)=>a.score-b.score);assert.ok(candidates.length>0);const best=candidates[0];
 const report={movement:162,status:best.score<1?'loop-candidate-within-numerical-tolerance':'loop-unqualified',period,timestep:p.timestep,stride,samplesPerCycle:n,positionTolerance:.0001,velocityTolerance:.001,method:'Two final cycles after 62 warmup cycles. Compare all coordinates and velocities at corresponding phases; choose a driving-contact seam by conservative visible-displacement bounds. Angular advances are measured integer turns, never forced equal forward/reverse travel.',best,initialState:samples[0],sources:['scripts/qualify-water-governor-loop.mjs','src/simulation/mujoco-water-governor/physics.js','src/simulation/mujoco-water-governor/backing-contact.js','src/simulation/mujoco-water-governor/bevel-train.js','src/simulation/bevel-geometry.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('/dev/shm/162-loop-candidate.json',JSON.stringify({report,geometry:g,samples}));fs.writeFileSync('docs/validation/162-loop-qualification.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{p.dispose();}
