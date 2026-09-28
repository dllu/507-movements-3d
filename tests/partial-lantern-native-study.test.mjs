import assert from 'node:assert/strict';
import test from 'node:test';
import loadMujoco from '@mujoco/mujoco';
import profile from '../src/simulation/baked/partial-lantern-rack.js';
import {lantern199ConvexCells,partialLantern199Pins,makePartialLantern199Study} from '../src/simulation/mujoco-partial-lantern/physics.js';
import {createAuthoredGearMovement as create} from '../src/simulation/authored-gears.js';
import {partialLanternContacts} from '../src/simulation/partial-lantern-rack-parts.js';
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;

test('199 native convex prisms retain the full finite rack tooth area and original pins',()=>{
 let count=0;
 for(const tooth of profile.teeth){
  const cells=lantern199ConvexCells(tooth.outline);count+=cells.length;
  assert.ok(Math.abs(cells.reduce((sum,p)=>sum+area(p),0)-area(tooth.outline))<1e-12);
  for(const cell of cells){assert.ok(area(cell)>0);let sign=0;
   for(let i=0;i<cell.length;i++){const a=cell[i],b=cell[(i+1)%cell.length],c=cell[(i+2)%cell.length],z=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(z)<1e-12)continue;if(sign)assert.ok(sign*z>0);sign=Math.sign(z);}
   for(const p of cell)assert.ok(tooth.outline.includes(p),'cell vertex belongs to the visible outline');
  }
 }
 assert.equal(count,1782);assert.equal(partialLantern199Pins.length,4);
 const d=create({id:199}).root.userData,s=d.stateAtInputTravel(0);
 s.lanternPinCenters.forEach((p,i)=>assert.ok(p.distanceTo({x:partialLantern199Pins[i][0],y:partialLantern199Pins[i][1]})<1e-12));
 assert.equal(profile.pinRadius,d.geometry.lanternPinRadius);
});

test('199 native rack is unactuated, guided by one slide, and initially outside the contact margin',async()=>{
 const mj=await loadMujoco(),p=makePartialLantern199Study(mj);
 try{
  assert.equal(p.model.nv,2);assert.equal(p.model.nu,1);
  assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','input'));
  assert.equal(p.data.qpos[0],-2.4);assert.equal(p.data.qvel[1],-.9);
  const d=create({id:199}).root.userData,c=partialLanternContacts(d.stateAtInputTravel(0));
  assert.ok(c.minimum>2*p.description.options.margin,'do not preload opposing narrow flanks');
  assert.match(p.description.xml,/type="slide" axis="1 0 0"/);
 }finally{p.dispose();}
});

test('199 contact-disabled rack obeys damped free coasting rather than a hidden position drive',async()=>{
 const mj=await loadMujoco(),p=makePartialLantern199Study(mj,{contact:false});
 try{
  for(let i=0;i<800;i++)p.step();
  const s=p.state(),o=p.description.options,expected=o.initialX+o.initialVelocity*(1-Math.exp(-o.rackDamping*s.time))/o.rackDamping;
  assert.ok(Math.abs(s.x-expected)<2e-7);assert.ok(s.velocity>0);
  assert.equal(p.data.ncon,0);assert.ok(Math.abs(s.input-o.speed*s.time)<1e-10);
 }finally{p.dispose();}
});

test('199 bake qualification rejects malformed coverage and missing or reversing disabled controls',async()=>{
 const {comparePartialLanternRuns}=await import('../scripts/compare-partial-lantern-native.mjs');
 const enabled=()=>({summary:{minGap:0,maxInputError:0},samples:Array.from({length:17},(_,i)=>({time:i,input:i*Math.PI/4,inputSpeed:1,x:Math.cos(i*Math.PI/4),velocity:-Math.sin(i*Math.PI/4)}))});
 const disabled=()=>({summary:{options:{contact:false},maxContactCount:0},samples:Array.from({length:17},(_,i)=>({time:i,input:i*Math.PI/4,inputSpeed:1,x:i,velocity:1,contacts:0}))});
 const good=()=>[enabled(),enabled(),disabled()];assert.equal(comparePartialLanternRuns(good()).qualifiedForBake,true);
 for(const mutate of[
  r=>{r[0].samples[2].x=NaN;},
  r=>{r[1].samples=r[1].samples.slice(0,8);},
  r=>{r[0].samples[4].input=r[0].samples[3].input;},
  r=>{delete r[2].summary.maxContactCount;},
  r=>{r[2].samples[4].velocity=-1;},
  r=>{r[2].samples[4].contacts=1;},
 ]){const runs=good();mutate(runs);assert.equal(comparePartialLanternRuns(runs).qualifiedForBake,false);}
});
