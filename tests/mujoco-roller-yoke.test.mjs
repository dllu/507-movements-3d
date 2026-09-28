import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeRollerYokeGeometry} from '../src/simulation/mujoco-roller-yoke/geometry.js';
import {makeMujocoRollerYoke} from '../src/simulation/mujoco-roller-yoke/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();

test('117 closed hardware retains a conjugate, regular cam and a stem long enough for the complete stroke',()=>{
 const v=makeRollerYokeGeometry(),u=v.root.userData,p=u.profile,s=u.source;
 try{
  assert.equal(Object.keys(u.parts).length,41);
  // p96: each roller is carried by a cheek on both faces, both seated on the
  // crossbar, which runs back through the roller's depth; the pin spans both.
  const box=n=>new THREE.Box3().setFromBufferAttribute(u.parts[n].geometry.attributes.position);
  for(const [n,bar]of [['upper','upperBar'],['lower','lowerBar']]){
   const roller=box(n+'Roller'),front=box(n+'Fork'),rear=box(n+'RearFork'),b=box(bar),pin=box(n+'Pin');
   assert(front.min.z>roller.max.z&&rear.max.z<roller.min.z,n+' cheeks lie on both faces of the roller');
   assert(Math.abs(rear.min.z+front.max.z)<1e-9&&Math.abs(rear.max.z+front.min.z)<1e-9,n+' cheeks are symmetric about the roller');
   assert(b.min.z<=rear.min.z+1e-9&&b.max.z>=front.max.z,n+' crossbar spans both cheeks');
   const seat=n==='upper'?[front.max.y,b.min.y]:[front.min.y,b.max.y];assert(Math.abs(seat[0]-seat[1])<1e-6,n+' cheeks meet the crossbar');
   assert(pin.min.z<=rear.min.z+1e-9&&pin.max.z>=front.max.z-1e-9,n+' pin passes through both cheeks');
  }
  // p97: the yoke, stems and guide are centred on the cam's mid-plane.
  v.root.updateMatrixWorld(true);const world=n=>new THREE.Box3().setFromObject(u.parts[n]);
  for(const n of ['upperStem','lowerStem','lowerCollar','lowerBoss','guide','upperBar','lowerBar']){const b=world(n);assert(Math.abs(b.min.z+b.max.z)<1e-9,n+' centred on z = 0');}
  const all=new THREE.Box3().setFromObject(v.root);assert(Math.abs(all.min.z+all.max.z)<1e-9,'no part stands proud on one face');
  for(const n of Object.keys(u.parts).filter(n=>/Rear/.test(n))){const f=world(n.replace('Rear','')),r=world(n);assert(Math.abs(f.min.z+r.max.z)<1e-9&&Math.abs(f.max.z+r.min.z)<1e-9,n+' mirrors its front part');}
  for(const [n,m]of Object.entries(u.parts)){const a=inspectWeightedClutchSolid(m.geometry);assert(a.volume>0,n);assert.equal(a.components,1,n);assert.equal(a.unmatchedEdges+a.degenerate+a.nonfinite+a.wrongNormals,0,n);}
  for(let i=0;i<2048;i++){const phi=2*Math.PI*i/2048,a=p.at(phi),b=p.at(phi+Math.PI);assert(Math.abs(a.radius+b.radius-2*s.meanPitchRadius)<2e-15);assert(Math.abs(Math.hypot(a.point[0]-a.radius*Math.cos(phi),a.point[1]-a.radius*Math.sin(phi))-s.rollerRadius)<2e-15);assert(1-s.rollerRadius*a.curvature>.34);assert(Math.abs(a.second)<.5,'the smoothed cam must not jerk the yoke');}
  const g=u.geometry;assert(g.stemEnd+p.maximum<g.guideCenter-g.guideHalf-.1);assert(g.stemLowerTop+p.minimum>g.guideCenter+g.guideHalf+.2);assert(u.hideGround);
 }finally{disposeObject3D(v.root);}
});

test('117 uses four native coordinates and one cam actuator; compiled cam cells match visible vertices',t=>{
 const v=makeMujocoRollerYoke(mujoco),p=v.physics,u=v.root.userData;let error=0,count=0;
 try{
  assert.equal(p.model.nq,4);assert.equal(p.model.neq,0);assert.equal(p.model.nu,1);assert.equal(p.model.ntendon,0);
  for(const [i,cell]of u.collision.cells.entries()){
   const id=p.id('mjOBJ_GEOM','cam'+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],n=p.model.mesh_vertnum[mesh];
   const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
   const vertices=[u.collision.low,u.collision.high].flatMap(z=>cell.map(q=>new THREE.Vector3(...q,z)));
   for(let j=0;j<n;j++){const q=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...vertices.map(v=>q.distanceTo(v))));count++;}
  }
  assert(error<2e-6);assert(u.source.rollerRadius+.002<=u.geometry.rollerZHalf);assert(u.source.rollerRadius*(1-Math.cos(Math.PI/192))<.00003);t.diagnostic(JSON.stringify({vertices:count,errorPixels:error*100,cells:u.collision.cells.length}));
 }finally{v.dispose();}
});

// With the smoothed cam the yoke never accelerates downward faster than
// gravity, so the weight stays on the upper roller: the lower roller follows
// in light contact and turns only slowly. Test 5 checks that it drives the
// yoke whenever it carries the load.
test('117 native contacts drive the yoke and turn both rollers over two cam cycles',t=>{
 const v=makeMujocoRollerYoke(mujoco),p=v.physics,u=v.root.userData;let error=0,penetration=0,lo=Infinity,hi=-Infinity;
 try{
  for(let i=0;i<10/p.timestep;i++){p.step();const d=p.data,q=n=>d.qpos[p.joints[n].q];assert([...d.qpos,...d.qvel].every(Number.isFinite));assert(Math.abs(d.time-(i+1)*p.timestep)<1e-8);const expected=u.profile.at(Math.PI/2-q('input')).radius-u.source.meanPitchRadius;error=Math.max(error,Math.abs(q('yoke')-expected));lo=Math.min(lo,q('yoke'));hi=Math.max(hi,q('yoke'));for(const n of ['yoke','upper','lower'])assert.equal(d.qfrc_actuator[p.joints[n].v],0);
   const cs=d.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{cs.delete();}
  }
  assert(error<.00015);assert(penetration<.00015);assert(lo<-.22&&hi>.22);assert(p.data.qpos[p.joints.upper.q]>30);assert(p.data.qpos[p.joints.lower.q]>2);t.diagnostic(JSON.stringify({motionErrorPixels:error*100,penetrationPixels:penetration*100,range:[lo,hi]}));
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});

test('117 contact removal lets the yoke fall under gravity while the driven cam continues',()=>{
 const v=makeMujocoRollerYoke(mujoco),p=v.physics;
 try{p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);v.update(.4);assert(p.data.qpos[p.joints.yoke.q]<-.8);assert(p.data.qpos[p.joints.input.q]<-.25);assert(Math.abs(p.data.qpos[p.joints.upper.q])<1e-10);assert(Math.abs(p.data.qpos[p.joints.lower.q])<1e-10);}
 finally{v.dispose();}
});

test('117 either roller transfers cam motion when gravity presses it onto the working surface',t=>{
 for(const disabled of ['upper','lower']){
  const v=makeMujocoRollerYoke(mujoco),p=v.physics,u=v.root.userData;let error=0;
  try{
   const id=p.id('mjOBJ_GEOM',disabled);p.model.geom_contype[id]=p.model.geom_conaffinity[id]=0;
   // Reverse the load for the lower-only diagnostic. This checks the actual
   // opposite cam flank without adding a kinematic follower constraint.
   if(disabled==='upper')p.model.opt.gravity[1]=9.81;
   for(let i=0;i<5/p.timestep;i++){p.step();const q=p.data.qpos,expected=u.profile.at(Math.PI/2-q[p.joints.input.q]).radius-u.source.meanPitchRadius;error=Math.max(error,Math.abs(q[p.joints.yoke.q]-expected));}
   assert(error<.0002);const enabled=disabled==='upper'?'lower':'upper';assert(p.data.qpos[p.joints[enabled].q]>15);assert(Math.abs(p.data.qpos[p.joints[disabled].q])<1e-10);t.diagnostic(JSON.stringify({disabled,motionErrorPixels:error*100}));
  }finally{v.dispose();}
 }
});

test('117 restart, seeking and frame partitioning reproduce the complete native state',()=>{
 const v=makeMujocoRollerYoke(mujoco),p=v.physics;
 try{v.update(2);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);}
 finally{v.dispose();}
});
