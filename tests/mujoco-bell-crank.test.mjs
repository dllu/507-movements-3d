import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeBellCrankGeometry} from '../src/simulation/mujoco-bell-crank/geometry.js';
import {makeMujocoBellCrank} from '../src/simulation/mujoco-bell-crank/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {LAID_ROPE} from '../src/simulation/laid-rope.js';
const mujoco=await loadMujoco();

test('126 retains measured pins and constructs closed curved lever and pulley hardware',()=>{
 const v=makeBellCrankGeometry(),u=v.root.userData;
 try{
  assert.equal(Object.keys(u.parts).length,17);assert(u.hideGround);
  for(const name of ['input','output']){
   const p=u.profile[name+'Pin'],s=u.source.circles[name+'Pin'].center;
   assert(Math.hypot(p[0]-(s[0]-u.source.axis[0])/100,p[1]-(u.source.axis[1]-s[1])/100)<1e-12);
  }
  for(const[n,m]of Object.entries(u.parts)){const r=inspectWeightedClutchSolid(m.geometry);assert(r.volume>0,n);assert.equal(r.components,m.geometry.type==='LaidRopeGeometry'?LAID_ROPE.strands:1,n);assert.equal(r.unmatchedEdges+r.degenerate+r.wrongNormals+r.nonfinite,0,n);}
  assert(Math.abs(u.source.arms.input.length/u.source.arms.output.length-1.189)<.001);
  u.setSectionView(true);assert(!u.parts.frontFlange.visible&&u.parts.drum.visible&&u.parts.inputCord.visible);
 }finally{disposeObject3D(v.root);}
});

// Pass 97: every eye and boss is concentric with its pin (the traced eye
// circles sat up to 2.4 px off their pins).
test('126 eyes and the pivot boss are concentric with their pins',()=>{
 const v=makeBellCrankGeometry(),u=v.root.userData;
 try{
  for(const[part,pin]of [['inputEye','inputPin'],['outputEye','outputPin'],['pivotBoss','pivotPin']]){
   const g=u.parts[part].geometry;g.computeBoundingBox();
   const c=[(g.boundingBox.min.x+g.boundingBox.max.x)/2,(g.boundingBox.min.y+g.boundingBox.max.y)/2];
   const s=u.source.circles[pin].center,p=[(s[0]-u.source.axis[0])/100,(u.source.axis[1]-s[1])/100];
   assert(Math.hypot(c[0]-p[0],c[1]-p[1])<2e-4,`${part} off its pin by ${Math.hypot(c[0]-p[0],c[1]-p[1])}`);
   // The bore/inset is centred on the same pin: the ring is uniformly wide.
   const pos=g.attributes.position,radii=[];
   for(let i=0;i<pos.count;i++){const r=Math.hypot(pos.getX(i)-p[0],pos.getY(i)-p[1]);radii.push(r);}
   const inner=Math.min(...radii),outer=Math.max(...radii);
   const expectOuter=u.source.circles[part==='pivotBoss'?'pivotEye':part].radius/100;
   assert(Math.abs(outer-expectOuter)<1e-3,part);
   assert(inner>.07,part);
  }
 }finally{disposeObject3D(v.root);}
});

test('126 initializes both finite cords at their actual visible endpoints with one input actuator',()=>{
 const v=makeMujocoBellCrank(mujoco),p=v.physics,u=v.root.userData;
 try{
  assert.equal(p.model.nu,1);assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','drive'));
  for(const name of ['input','output']){
   const expected=name==='input'?u.profile.inputPath.points:u.profile.outputPoints,actual=p.getCordPoints(name);
   assert.equal(actual.length,expected.length);
   for(let i=0;i<actual.length;i++)assert(Math.hypot(...actual[i].map((v,k)=>v-expected[i][k]))<1e-10);
  }
  for(const[a,b]of p.connections)assert(Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*a+k]-p.data.site_xpos[3*b+k]))<1e-10);
  assert.equal(p.model.nv,6+6*(u.profile.cordSegments+u.profile.outputSegments));
  assert.equal(p.model.neq,u.profile.cordSegments+u.profile.outputSegments+2);
  for(const name of ['input','output']){
   const grip=p.id('mjOBJ_BODY',name+'Grip'),pin=p.id('mjOBJ_SITE',name+'Pin');
   assert.equal(p.model.body_parentid[grip],p.bodies.bell);
   assert(Math.hypot(...[0,1,2].map(k=>p.data.xpos[3*grip+k]-p.data.site_xpos[3*pin+k]))<1e-10);
   const g=u.profile.grips[name],end=name==='input'?p.getCordPoints(name).at(-1):p.getCordPoints(name)[0];
   assert(Math.abs(Math.hypot(...end.map((v,k)=>v-g.pin[k]))-g.offset)<1e-10);
   assert(g.offset>u.source.circles[name+'Pin'].radius/100);
   assert.equal(p.model.eq_type[p.id('mjOBJ_EQUALITY',name+'Clamp')],mujoco.mjtEq.mjEQ_WELD.value);
  }
 }finally{v.dispose();}
});

test('126 cord force redirects through the passive lever and pulley torque requires friction',t=>{
 const observed=[];
 for(const friction of [.8,0]){
  const v=makeMujocoBellCrank(mujoco,{friction}),p=v.physics;
  try{
   let maximumConnection=0;
   for(let i=0;i<1.25/p.timestep;i++){
    p.step();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-9);
    for(const[n,j]of Object.entries(p.joints))if(n!=='drive')assert.equal(p.data.qfrc_actuator[j.v],0);
    for(const[a,b]of p.connections)maximumConnection=Math.max(maximumConnection,100*Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*a+k]-p.data.site_xpos[3*b+k])));
   }
   const q=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qpos[j.q]]));
   assert(q.drive>.4);assert(q.bell<-.2);assert(q.output<-.25);
   assert(Math.abs(q.inputGrip)>.1);assert(Math.abs(q.outputGrip)>.1);
   if(friction)assert(q.spin>.5);else assert(Math.abs(q.spin)<.02);
   assert(maximumConnection<.2);observed.push({friction,q,maximumConnectionPixels:maximumConnection});
  }finally{v.dispose();}
 }
 t.diagnostic(JSON.stringify(observed));
});

test('126 playback reset and seeking retain the complete cord state and release allocations',()=>{
 const v=makeMujocoBellCrank(mujoco),p=v.physics;
 try{v.update(.3);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=18;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.1);v.update(.3);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);}
 finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});
