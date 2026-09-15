import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {integrateSolidGeometry,cordTreadleRigidProperties} from '../src/simulation/mujoco-cord-treadle/inertia.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('closed mesh integration matches translated box volume and second moments',()=>{
 const geometry=new THREE.BoxGeometry(2,4,6),matrix=new THREE.Matrix4().makeTranslation(3,-2,5);
 const p=integrateSolidGeometry(geometry,matrix);near(p.volume,48);
 [3,-2,5].forEach((v,i)=>near(p.first[i]/48,v));
 [9+4/12,4+16/12,25+36/12,-6,15,-10].forEach((v,i)=>near(p.second[i]/48,v));geometry.dispose();
});
test('rigid core scale has correct mass and physical inertia scaling',()=>{
 const a=cordTreadleRigidProperties(),b=cordTreadleRigidProperties({metresPerUnit:.2});
 near(a.gravity,98.1);near(b.gravity,a.gravity/2);
 for(const name of ['disk','treadle','pulley']){
  assert.ok(a.bodies[name].mass>0);near(b.bodies[name].mass/a.bodies[name].mass,8);
  for(let i=0;i<3;i++){assert.ok(a.bodies[name].fullinertia[i]>0);near(b.bodies[name].fullinertia[i]/a.bodies[name].fullinertia[i],8);}
 }
 // Independent thin-annulus inertia check, with the smaller hub included.
 const r=1.6,h=.34,ri=.144,rh=.22,hh=.11,rho=7.2;
 const expected=rho*Math.PI/2*(h*(r**4-ri**4)+hh*(rh**4-ri**4));
 assert.ok(Math.abs(a.bodies.disk.fullinertia[2]/expected-1)<.001);
});
test('native model uses the authored masses, centers and scaled gravity',async()=>{
 const {default:loadMujoco}=await import('@mujoco/mujoco');
 const {makeFiniteCordTreadlePhysics}=await import('../src/simulation/mujoco-cord-treadle/rope-physics.js');
 const mujoco=await loadMujoco(),rigidProperties=cordTreadleRigidProperties();
 const p=makeFiniteCordTreadlePhysics(mujoco,{segments:32,rigidProperties});
 try{
  near(p.model.opt.gravity[1],-98.1);
  for(const name of ['disk','treadle','pulley']){
   const id=p.id('mjOBJ_BODY',name),expected=rigidProperties.bodies[name];near(p.model.body_mass[id],expected.mass);
   expected.center.forEach((v,i)=>near(p.model.body_ipos[id*3+i],v-(name==='pulley'&&i===2?.64:0)));
   // Trace is invariant under MuJoCo's principal-axis diagonalization.
   near(Array.from(p.model.body_inertia.slice(id*3,id*3+3)).reduce((a,b)=>a+b),expected.fullinertia.slice(0,3).reduce((a,b)=>a+b));
  }
  for(let i=0;i<20;i++)p.step();
  near(p.data.time,20*p.timestep);assert.ok(p.state().points.flat().every(Number.isFinite));
 }finally{p.dispose();}
});
