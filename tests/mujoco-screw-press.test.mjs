import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoScrewPress} from '../src/simulation/mujoco-screw-press/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
const mujoco=await loadMujoco();
const error=v=>v.physics.data.qpos[0]-v.root.userData.profile.lead*v.physics.data.qpos[1];

test('105 closed solids retain open bores, a captured swivel and native working faces',()=>{
  const v=makeMujocoScrewPress(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  try {
    assert.equal(Object.keys(u.parts).length,18);
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.neq,1);assert.equal(p.model.ngeom,2);
    assert.equal(p.model.body_parentid[p.bodies.screw],p.bodies.ram);
    assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','screw'));
    for(const part of Object.values(u.parts)) {
      const a=inspectWeightedClutchSolid(part.geometry);
      assert.equal(a.components,1);assert.ok(a.volume>0);
      for(const key of ['degenerate','wrongNormals','nonfinite','unmatchedEdges'])assert.equal(a[key],0,part.name+' '+key);
    }
    for(const name of ['ram','screw']) {
      const id=p.bodies[name],m=p.description.mass[name];
      assert.ok(Math.abs(p.model.body_mass[id]-m.volume*p.description.density)<1e-10);
      for(let k=0;k<3;k++)assert.ok(Math.abs(p.model.body_ipos[id*3+k]-m.centroid[k])<1e-10);
      assert.ok(p.model.body_inertia.slice(id*3,id*3+3).every(x=>x>0));
    }
    for(const name of ['ram','blank']) {
      const id=p.id('mjOBJ_GEOM',name),g=u.parts[name].geometry;g.computeBoundingBox();const box=g.boundingBox;
      assert.equal(p.model.geom_type[id],mujoco.mjtGeom.mjGEOM_CYLINDER.value);
      // Rendered positions are float32; allow one ULP at the blank's height.
      assert.ok(Math.abs(p.model.geom_size[3*id]-box.max.x)<3e-7);
      assert.ok(Math.abs(p.model.geom_pos[3*id+1]-p.model.geom_size[3*id+1]-box.min.y)<3e-7);
      assert.ok(Math.abs(p.model.geom_pos[3*id+1]+p.model.geom_size[3*id+1]-box.max.y)<3e-7);
    }
    assert.ok(f.lead>0,'thread handedness must match the engraving');
    assert.ok(Math.abs(f.internal.width+f.external.width+2*f.clearance-f.pitch)<1e-12);
    assert.ok(f.bearing.radius>f.bearing.neck+.003,'the screw flange must be retained below the cap bore');
    assert.ok(f.bearing.top<f.capBottom&&f.bearing.bottom>f.bearing.floor);
    // Brown's window ends at the raised ram; the blank, now wider than the ram
    // face, lies below it and stays visible when struck.
    assert.ok(u.cameraFitBounds.min.y>f.workTop&&u.cameraFitBounds.max.y<f.barY+.5);
    assert.ok(f.blankRadius>f.ramRadius);
    const state=[...p.data.qpos,...p.data.qvel];u.setSectionView(true);
    assert.ok(u.section.caps.every(c=>c.visible));u.setSectionView(false);
    assert.ok(u.section.caps.every(c=>!c.visible));assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
  }finally{v.dispose();}
});

test('105 ten strokes retain the guides and threads and contact the blank without other intersections',t=>{
  const v=makeMujocoScrewPress(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  let phase=0,penetration=0,visiblePenetration=0,checks=0,poses=0,retention=Infinity,threadReserve=Infinity,handleGap=Infinity;
  const contacts=Array(10).fill(0),cycle=Math.round(p.description.options.period/p.timestep);
  try {
    for(let i=0;i<=10*cycle;i++) {
      if(i)p.step();const [slide,angle]=p.data.qpos;
      assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      assert.ok(Math.abs(p.data.actuator_force[0])<=3+1e-10);
      phase=Math.max(phase,Math.abs(error(v)));
      retention=Math.min(retention,f.ramTop-.03+slide-f.y(u.source.edges.guideBottom));
      threadReserve=Math.min(threadReserve,f.external.high+slide-f.internal.high,f.internal.low-f.external.low-slide);
      handleGap=Math.min(handleGap,f.barY+slide-u.source.weights.right.radii[1]/100-f.internal.high);
      const cs=p.data.contact;
      for(let j=0;j<cs.size();j++) {
        const c=cs.get(j);assert.deepEqual([c.geom1,c.geom2].sort(),[0,1]);
        contacts[Math.min(9,Math.floor(i/cycle))]++;penetration=Math.max(penetration,-c.dist);c.delete();
      }cs.delete();
      if(i<=cycle&&i%(cycle/16)===0) {
        v.sync();const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;
        assert.deepEqual(a.topologyIssues,[]);
        for(const issue of a.issues){assert.deepEqual([issue.from,issue.to].sort(),['blank','ram'],JSON.stringify(issue));visiblePenetration=Math.max(visiblePenetration,-issue.gap);}
        // Every part stays in the sampled motion bounds; the default view
        // (cameraFitBounds) is Brown's narrower window and crops the lower jaw.
        const motionBounds=new THREE.Box3(new THREE.Vector3(...u.sampledMotionBounds.min),new THREE.Vector3(...u.sampledMotionBounds.max));
        for(const mesh of Object.values(u.parts)) {
          const positions=mesh.geometry.attributes.position;
          for(let j=0;j<positions.count;j++)assert.ok(motionBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld)),mesh.name);
        }
      }
      if(i%cycle===cycle/2)assert.ok(Math.abs(slide+f.pitch)<.001,'ram did not reach the blank');
      if(i&&i%cycle===0)assert.ok(Math.abs(slide)<.001,'ram did not return');
      assert.ok(angle> -2*Math.PI-.04&&angle<.01);
    }
    assert.ok(contacts.every(n=>n>100));assert.ok(phase*100<.001);assert.ok(penetration*100<.01);assert.ok(visiblePenetration*100<.01);
    assert.ok(retention>.1);assert.ok(threadReserve>.29);assert.ok(handleGap>.09);
    t.diagnostic(JSON.stringify({phaseErrorPixels:phase*100,nativePenetrationPixels:penetration*100,visiblePenetrationPixels:visiblePenetration*100,
      keyRetentionPixels:retention*100,threadReservePixels:threadReserve*100,handleFrameGapPixels:handleGap*100,contacts,checks,poses}));
  }finally{v.dispose();}
});

test('105 output depends on the screw coupling and transmits either axial load to the input',t=>{
  const v=makeMujocoScrewPress(mujoco),p=v.physics;
  try {
    p.model.opt.gravity.fill(0);mujoco.mj_setState(p.model,p.data,[0],mujoco.mjtState.mjSTATE_EQ_ACTIVE.value);
    v.update(2);assert.ok(Math.abs(p.data.qpos[0])<1e-10);assert.ok(p.data.qpos[1]<-3);
  }finally{v.dispose();}
  const loads=[];
  for(const force of [-2,2]) {
    const v=makeMujocoScrewPress(mujoco,{period:1e9}),p=v.physics;
    try {
      p.model.opt.gravity.fill(0);p.data.qfrc_applied[0]=force;v.update(2);
      const expected=-force*v.root.userData.profile.lead,actual=p.data.actuator_force[0];
      assert.ok(Math.abs(actual-expected)<1e-5);assert.ok(Math.abs(error(v))<.00001);loads.push({force,expected,actual});
    }finally{v.dispose();}
  }
  t.diagnostic(JSON.stringify({loads}));
});

test('105 fixed steps reproduce seeking and restart, release allocations and bound timestep sensitivity',t=>{
  const v=makeMujocoScrewPress(mujoco),p=v.physics;
  try {
    v.update(4);const state=[...p.data.qpos,...p.data.qvel];
    v.reset();for(let i=1;i<=240;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.update(1);v.update(4);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
  }finally{v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  const variants=[.002,.001,.0005].map(timestep=>makeMujocoScrewPress(mujoco,{timestep}));
  let first=0,second=0;
  try {
    for(let i=0;i<8000;i++) {
      variants[0].physics.step();for(let j=0;j<2;j++)variants[1].physics.step();for(let j=0;j<4;j++)variants[2].physics.step();
      const [a,b,c]=variants.map(v=>v.physics.data.qpos[0]);first=Math.max(first,Math.abs(a-b));second=Math.max(second,Math.abs(b-c));
    }
    t.diagnostic(JSON.stringify({timestepDifferencePixels:100*first,refinedDifferencePixels:100*second}));
    assert.ok(first*100<.03);assert.ok(second<first);
  }finally{for(const v of variants)v.dispose();}
});
