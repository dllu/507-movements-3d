import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {governorGeometry,governorEquilibrium,capsuleMoments} from '../src/simulation/mujoco-ball-governor/equilibrium.js';
import {makeBallGovernorPhysics} from '../src/simulation/mujoco-ball-governor/physics.js';
const m=await loadMujoco();
test('161 full-linkage equilibrium reduces to the point-ball formula without link and sleeve mass',()=>{
 const g={...governorGeometry(),upperMass:0,lowerMass:0,sleeveMass:0};for(let i=1;i<=20;i++){const theta=.1+i*.025;assert.ok(Math.abs(governorEquilibrium(theta,g).speed-Math.sqrt(g.gravity*Math.tan(theta)/(g.pivotRadius+g.ballArm*Math.sin(theta))))<1e-12);}
});
test('161 capsule moments and equilibrium virtual work agree with compiled native bodies',()=>{
 const p=makeBallGovernorPhysics(m);try{
  const g=p.geometry,id=p.id('mjOBJ_BODY','left-link'),expected=capsuleMoments(g.lowerMass,g.lowerLink,g.lowerRadius),compiled=Array.from(p.model.body_inertia.slice(3*id,3*id+3)).sort((a,b)=>a-b),moments=[expected.axial,expected.transverse,expected.transverse].sort((a,b)=>a-b);compiled.forEach((x,i)=>assert.ok(Math.abs(x-moments[i])<1e-12));
  const initial=governorEquilibrium(g.initialSpread,g),h=1e-6;
  for(let i=0;i<12;i++){
   const theta=.25+.035*i,e=governorEquilibrium(theta,g),a=governorEquilibrium(theta+h,g),b=governorEquilibrium(theta-h,g),offset=theta-g.initialSpread,link=e.lowerAngle-initial.lowerAngle-offset;
   p.data.qpos.set([0,offset,link,offset,link,e.sleeveY-initial.sleeveY]);p.data.qvel.fill(0);p.data.qvel[0]=e.speed;m.mj_forward(p.model,p.data);
   const dl=(a.lowerAngle-b.lowerAngle)/(2*h)-1,dy=(a.sleeveY-b.sleeveY)/(2*h),gradient=[0,1,dl,1,dl,dy],residual=gradient.reduce((sum,x,j)=>sum+x*p.data.qfrc_bias[j],0);
   assert.ok(Math.abs(residual)<1e-6,`spread ${theta}, residual ${residual}`);
  }
 }finally{p.dispose();}
});
test('161 calibrated constant speed holds the engraved spread without actuating the arms',()=>{
 const p=makeBallGovernorPhysics(m,{variableSpeed:false});try{for(let i=0;i<64000;i++)p.step();assert.ok(Math.abs(p.state().leftSpread-p.geometry.initialSpread)<1e-7);assert.equal(p.model.nu,1);}finally{p.dispose();}
});
