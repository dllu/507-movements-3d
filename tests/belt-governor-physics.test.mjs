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

test('163 finite belt width reaches both fast pulleys without simultaneous opposite selection',async()=>{
 const {beltPulleyOverlap}=await import('../src/simulation/mujoco-belt-governor/belt-contact.js'),g=beltGovernorGeometry();
 const neutral=beltPulleyOverlap(g.middlePulleyY,g);assert.equal(neutral.upper,0);assert.equal(neutral.lower,0);
 const r=sample({speedAmplitude:.25},20);let upper=0,lower=0,maximumSpeed=0;
 for(const s of r.states){const o=s.beltForces.overlap;upper=Math.max(upper,o.upper);lower=Math.max(lower,o.lower);assert.ok(o.upper===0||o.lower===0);maximumSpeed=Math.max(maximumSpeed,s.beltSpeed);
  const fastSlip=g.pulleyRadius*s.speed-s.beltSpeed,looseSlip=g.pulleyRadius*s.looseSpeed-s.beltSpeed;
  assert.ok(s.beltForces.fast*fastSlip+s.beltForces.loose*looseSlip>=-1e-12,'traction dissipates relative motion');
 }
 assert.ok(upper>.1&&lower>.25,'finite contact bands reach both source fast faces');assert.ok(maximumSpeed>3,'passive belt is driven by fast-pulley traction');
});
test('163 removing belt friction eliminates transport while the governor still shifts',()=>{
 const r=sample({speedAmplitude:.25,beltFriction:0},20);assert.ok(r.states.every(s=>s.beltSpeed===0&&s.beltDistance===0&&s.looseSpeed===0));
 assert.ok(Math.max(...r.states.map(s=>s.forkY))-Math.min(...r.states.map(s=>s.forkY))>.5);
});
