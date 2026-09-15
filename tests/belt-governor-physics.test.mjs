import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeBeltGovernorPhysics} from '../src/simulation/mujoco-belt-governor/physics.js';
import {beltGovernorGeometry,beltGovernorLinkage} from '../src/simulation/mujoco-belt-governor/geometry.js';
const m=await loadMujoco();
function sample(options={},duration=10){
 const p=makeBeltGovernorPhysics(m,options),states=[];let closure=0;
 try{
  assert.equal(p.model.nu,options.spindleDrive===false?0:1);
  const steps=Math.round(duration/p.timestep),stride=Math.round(.01/p.timestep);
  for(let tick=0;tick<=steps;tick++){
   if(tick%stride===0){const s=p.state();assert.ok(Math.abs(s.time-tick*p.timestep)<1e-7);states.push(s);closure=Math.max(closure,...s.connectionErrors);}
   if(tick<steps)p.step();
  }
  return{states,closure,description:p.description};
 }finally{p.dispose();}
}
test('163 source neutral geometry closes the sleeve, crank and belt rod',()=>{
 const g=beltGovernorGeometry(),s=beltGovernorLinkage(g.sleeveY,g);
 assert.ok(Math.abs(s.bellAngle)<1e-14);assert.ok(Math.abs(s.forkY-g.middlePulleyY)<1e-14);
 assert.ok(Math.abs(g.ballRadius/.018-33)<1e-12);
 assert.ok(beltGovernorLinkage(g.sleeveY+.1,g).forkY<s.forkY);
 assert.ok(beltGovernorLinkage(g.sleeveY-.1,g).forkY>s.forkY);
});
test('163 native passive lever follows the annular groove and fixed-length rod',()=>{
 const {states,closure}=sample(),g=beltGovernorGeometry();assert.ok(closure<1e-6);
 for(const s of states){const expected=beltGovernorLinkage(s.sleeveY,g);assert.ok(Math.abs(s.bellAngle-expected.bellAngle)<1e-6);assert.ok(Math.abs(s.forkY-expected.forkY)<1e-6);assert.ok(Math.abs(s.followerX-expected.followerX)<1e-6);assert.ok(Math.abs(s.collarError)<1e-6);}
 assert.ok(Math.min(...states.map(s=>s.forkY))<g.middlePulleyY-.15);assert.ok(Math.max(...states.map(s=>s.forkY))>g.middlePulleyY+.10);
});
test('163 full-linkage gravity calibration holds the neutral source pose',()=>{
 const {states}=sample({speedAmplitude:0});assert.ok(Math.max(...states.map(s=>Math.abs(s.leftSpread-states[0].leftSpread)))<1e-6);
 assert.ok(Math.max(...states.map(s=>Math.abs(s.forkY-states[0].forkY)))<1e-6);
 const loaded=sample({loadScale:4,speedAmplitude:0});assert.ok(loaded.description.nominalSpeed<sample({linkage:false,speedAmplitude:0}).description.nominalSpeed);
 assert.ok(Math.max(...loaded.states.map(s=>Math.abs(s.leftSpread-loaded.states[0].leftSpread)))<1e-6);
});
test('163 removing spindle actuation permits gravitational collapse',()=>{
 const {states}=sample({spindleDrive:false},3);assert.ok(Math.max(...states.map(s=>Math.abs(s.leftSpread-states[0].leftSpread)))>.08);
});
test('163 timestep refinement preserves the passive fork trajectory',()=>{
 const a=sample(),b=sample({timestep:.00025});assert.equal(a.states.length,b.states.length);
 assert.ok(Math.max(...a.states.map((s,i)=>Math.abs(s.forkY-b.states[i].forkY)))<.0002);
});
