import assert from 'node:assert/strict';
import test from 'node:test';
import loadMujoco from '@mujoco/mujoco';
import {makeWaterGovernorPhysics} from '../src/simulation/mujoco-water-governor/physics.js';
const m=await loadMujoco();
function run(options){
 const p=makeWaterGovernorPhysics(m,options);
 try{
  const result={firstForward:null,firstReverse:null,minimumSpeed:0,maximumSpeed:0,maximumClosure:0,maximumPenetration:0,maximumSpreadDrift:0,finalOutput:0,maximumSelector:-Infinity,minimumSelector:Infinity};
  assert.equal(p.model.nu,1,'only the spindle has an actuator');
  for(let tick=0;tick<=16000;tick++){
   const s=p.state();
   assert.ok(Math.abs(s.time-tick*p.timestep)<1e-7,'native clock must not reset');
   const selector=s.selectorY-p.description.apex;
   result.maximumSelector=Math.max(result.maximumSelector,selector);
   result.minimumSelector=Math.min(result.minimumSelector,selector);
   if(result.firstForward===null&&s.outputSpeed>.1)result.firstForward=s.time;
   if(result.firstReverse===null&&s.outputSpeed<-.1)result.firstReverse=s.time;
   result.minimumSpeed=Math.min(result.minimumSpeed,s.outputSpeed);
   result.maximumSpeed=Math.max(result.maximumSpeed,s.outputSpeed);
   result.maximumClosure=Math.max(result.maximumClosure,...s.connectionErrors);
   result.maximumPenetration=Math.max(result.maximumPenetration,...s.contacts.map(c=>-c.distance));
   result.maximumSpreadDrift=Math.max(result.maximumSpreadDrift,Math.abs(s.leftSpread-p.geometry.initialSpread));
   result.finalOutput=s.output;
   if(tick<16000)p.step();
  }
  return result;
 }finally{p.dispose();}
}
test('162 passive dog contacts drive both directions without prescribed gear motion',()=>{
 const r=run({});assert.ok(r.maximumSpeed>4&&r.minimumSpeed< -4);
 assert.ok(r.firstForward>0&&r.firstReverse>r.firstForward);
 assert.ok(r.maximumClosure<1e-6);
 assert.ok(r.maximumPenetration<.002,'bounded diagnostic contact compliance');
 assert.ok(Math.abs(r.finalOutput)>1,'do not force equal travel to manufacture a loop');
});
test('162 removing contact eliminates output motion, and stud phase changes pickup time',()=>{
 const free=run({contact:false});assert.equal(free.finalOutput,0);assert.equal(free.firstForward,null);assert.equal(free.firstReverse,null);
 const a=run({}),b=run({studPhase:1});assert.ok(b.firstForward-a.firstForward>.1,'pickup waits for the actual stud azimuth');
});
test('162 nominal spindle speed holds the neutral governor with loose gears at rest',()=>{
 const r=run({speedAmplitude:0});assert.equal(r.finalOutput,0);assert.equal(r.maximumPenetration,0);assert.ok(r.maximumSpreadDrift<1e-7);
});

test('162 gear backing prevents an over-speed pin from passing through the stud roots',()=>{
 const backed=run({speedAmplitude:.5}),open=run({speedAmplitude:.5,backingContact:false,toothContact:false});
 assert.ok(backed.maximumSelector<.425,'pin top stays below the upper backing face');
 assert.ok(backed.minimumSelector>-.335,'pin bottom stays above the lower backing face');
 assert.ok(open.maximumSelector>.50,'removed backing exposes the former pass-through defect');
});

test('162 ball contact prevents the lower link stem entering its own ball',()=>{
 const minimumGap=ballContact=>{
  const p=makeWaterGovernorPhysics(m,{speedAmplitude:.5,contact:false,ballContact});let gap=Infinity;
  try{
   const ball=p.id('mjOBJ_GEOM','left-ball'),link=p.id('mjOBJ_GEOM','left-link-collision');
   for(let tick=0;tick<=16000;tick++){
    if(tick%20===0){
     p.state();const d=[0,1,2].map(i=>p.data.geom_xpos[3*ball+i]-p.data.geom_xpos[3*link+i]);
     const excess=[0,1,2].map(i=>Math.max(0,Math.abs(d.reduce((sum,x,j)=>sum+x*p.data.geom_xmat[9*link+3*j+i],0))-p.model.geom_size[3*link+i]));
     gap=Math.min(gap,Math.hypot(...excess)-p.geometry.ballRadius);
    }
    if(tick<16000)p.step();
   }
   return gap;
  }finally{p.dispose();}
 };
 assert.ok(minimumGap(true)>-.001,'sphere and visible-width stem remain separated within contact compliance');
 assert.ok(minimumGap(false)<-.005,'removed contact reproduces the missing-collision defect');
});
