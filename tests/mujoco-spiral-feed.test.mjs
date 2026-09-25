import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoSpiralFeed} from '../src/simulation/mujoco-spiral-feed/visual.js';
import {rigidFamilyInertia} from '../src/simulation/mujoco/mass.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();

test('099 native spiral follows the complete finite strip and retains its free roller',t=>{
  const v=makeMujocoSpiralFeed(mujoco),p=v.physics,u=v.root.userData,f=u.profile,g=u.geometry;
  try {
    assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.jnt_stiffness[1],0);
    const c=p.description.collision,surface=solidSurface(u.parts.rail.geometry),inverse=u.blocks.input.matrixWorld.clone().invert();
    const volume=c.cells.reduce((s,cell)=>s+THREE.ShapeUtils.area(cell.map(p=>new THREE.Vector2(...p)))*(c.high-c.low),0);
    const visible=rigidFamilyInertia({rail:u.parts.rail},{rail:'single'},'single').volume;
    assert.ok(Math.abs(volume-visible)<1e-10,'decomposition changed the rail volume');
    for(let i=0;i<c.cells.length;i++) {
      const geom=p.id('mjOBJ_GEOM','rail'+i),mesh=p.model.geom_dataid[geom],start=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh];
      const matrix=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,geom*9).transpose());
      matrix.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,geom*3));
      for(let j=0;j<count;j++) {
        const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(start+j)*3).applyMatrix4(matrix).applyMatrix4(inverse);
        assert.ok(surface.distance(point)<2e-6,'compiled rail vertex misses its rendered surface');
      }
    }
    const roller=p.id('mjOBJ_GEOM','roller'),r=p.model.geom_size[3*roller],z=p.model.geom_pos[3*roller+2];
    assert.equal(p.model.geom_type[roller],mujoco.mjtGeom.mjGEOM_SPHERE.value);assert.ok(Math.abs(r-f.rollerRadius)<1e-12);
    u.parts.roller.geometry.computeBoundingBox();const box=u.parts.roller.geometry.boundingBox;
    assert.ok(z-r>box.min.z&&z+r<box.max.z);assert.ok(box.min.z>-.08&&box.max.z<.28);
    let minimumPlay=Infinity,maximumPlay=0,minimumEndMargin=Infinity;
    for(let i=0;i<=2880;i++) {
      const a=f.range[0]+(f.range[1]-f.range[0])*i/2880,e=f.envelope(a),play=e.outer.r-e.inner.r;
      minimumPlay=Math.min(minimumPlay,play);maximumPlay=Math.max(maximumPlay,play);
      minimumEndMargin=Math.min(minimumEndMargin,e.inner.t,f.sweep-e.outer.t);
      assert.ok(e.inner.r-f.rollerRadius>g.hubRadius+.01,'roller hits the shaft hub');
      assert.ok(-e.inner.r-g.barEnd<g.guideCenter[1]-g.guideHalfLength-.05,'rod leaves its bored guide');
      assert.ok(-e.outer.r-g.barStart>g.guideCenter[1]+g.guideHalfLength+.01,'neck hits the guide');
    }
    t.diagnostic(JSON.stringify({minimumRadialPlayPixels:minimumPlay*100,maximumRadialPlayPixels:maximumPlay*100,minimumEndParameterMargin:minimumEndMargin,rollerRadiusPixels:f.rollerRadius*100}));
    assert.ok(minimumPlay>2*f.clearance-.00001);assert.ok(maximumPlay*100<.3);assert.ok(minimumEndMargin>.002);
    const state=[...p.data.qpos,...p.data.qvel];u.setSectionView(true);assert.ok(!u.parts.eye.visible&&!u.parts.head.visible);
    assert.ok(Object.values(u.sectionMeshes).every(m=>m.visible));u.setSectionView(false);
    assert.ok(u.parts.eye.visible&&u.parts.head.visible);assert.ok(Object.values(u.sectionMeshes).every(m=>!m.visible));assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
  }finally{v.dispose();}
});

test('099 feed and roller are passive and playback is deterministic',()=>{
  const v=makeMujocoSpiralFeed(mujoco),p=v.physics;
  try {
    v.update(2);const state=[...p.data.qpos,...p.data.qvel];
    v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.reset();const initial=p.data.qpos[1],roller=p.id('mjOBJ_GEOM','roller');
    p.model.geom_contype[roller]=0;p.model.geom_conaffinity[roller]=0;p.data.qvel[1]=0;p.data.qvel[2]=0;p.model.opt.gravity.fill(0);
    v.update(2);assert.ok(Math.abs(p.data.qpos[1]-initial)<1e-10);assert.ok(p.data.qpos[0]>1);
  }finally{v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  const frictionless=makeMujocoSpiralFeed(mujoco,{friction:0});
  try {
    frictionless.physics.data.qvel[2]=0;const angle=frictionless.physics.data.qpos[2];frictionless.update(2);
    assert.ok(Math.abs(frictionless.physics.data.qpos[2]-angle)<1e-8,'roller spin was supplied independently of friction');
  }finally{frictionless.dispose();}
  for(const load of [-1,1]) {
    const v=makeMujocoSpiralFeed(mujoco,{load}),p=v.physics,f=v.root.userData.profile;let inner=0,outer=0;
    try {
      for(let i=1;i<=48;i++) {
        v.update(i/4);const e=f.envelope(p.data.qpos[0]),r=-p.data.qpos[1];assert.ok(r>e.inner.r-.001&&r<e.outer.r+.001);
        const cs=p.data.contact;for(let j=0;j<cs.size();j++){const c=cs.get(j);if(Math.hypot(c.pos[0],c.pos[1])<r)inner++;else outer++;c.delete();}cs.delete();
      }
      assert.ok(load>0?inner>20:outer>20,'opposite load did not reach the corresponding winding');
    }finally{v.dispose();}
  }
});

test('099 ten feed cycles retain contact and separate all other finite hardware',t=>{
  const v=makeMujocoSpiralFeed(mujoco),p=v.physics,u=v.root.userData,f=u.profile,surface=solidSurface(u.parts.rail.geometry);
  let error=0,penetration=0,solidPenetration=0,checks=0,poses=0,contactSurfaceError=0,minimumRadius=Infinity,maximumRadius=0,maximumRollerSpeed=0;
  const contacts={inner:0,outer:0};
  try {
    for(let i=0;i<=240000;i++) {
      if(i)p.step();mujoco.mj_forward(p.model,p.data);assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      const [a,y]=p.data.qpos,e=f.envelope(a),r=-y;error=Math.max(error,e.inner.r-r,r-e.outer.r);
      minimumRadius=Math.min(minimumRadius,r);maximumRadius=Math.max(maximumRadius,r);maximumRollerSpeed=Math.max(maximumRollerSpeed,Math.abs(p.data.qvel[2]));
      const cs=p.data.contact;
      for(let j=0;j<cs.size();j++) {
        const c=cs.get(j);penetration=Math.max(penetration,-c.dist);contacts[Math.hypot(c.pos[0],c.pos[1])<r?'inner':'outer']++;
        if(i%20===0) {
          const point=new THREE.Vector3().fromArray(c.pos).applyAxisAngle(new THREE.Vector3(0,0,1),-a);
          contactSurfaceError=Math.max(contactSurfaceError,surface.distance(point));
        }
        c.delete();
      }
      cs.delete();
      if(i<=24000&&i%750===0) {
        v.sync();const audit=auditClutchSourceSolids(v);checks+=audit.checks;poses++;assert.deepEqual(audit.topologyIssues,[]);
        for(const issue of audit.issues){assert.ok([issue.from,issue.to].includes('roller')&&[issue.from,issue.to].includes('rail'),JSON.stringify(issue));solidPenetration=Math.max(solidPenetration,-issue.gap);}
        for(const mesh of Object.values(u.parts)){if(mesh.userData.beyondPlateCrop)continue;const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);}
      }
    }
    t.diagnostic(JSON.stringify({maximumEnvelopeErrorPixels:error*100,maximumNativePenetrationPixels:penetration*100,maximumSampledPenetrationPixels:solidPenetration*100,contactSurfaceErrorPixels:contactSurfaceError*100,
      radiusRangePixels:[minimumRadius,maximumRadius].map(r=>r*100),maximumRollerSpeed,contacts,poses,surfaceChecks:checks}));
    assert.ok(error*100<.05);assert.ok(penetration*100<.05);assert.ok(solidPenetration*100<.05);assert.ok(contactSurfaceError*100<.05);
    assert.ok(contacts.outer>10000);assert.ok(maximumRollerSpeed>20);
  }finally{v.dispose();}
});

test('099 timestep and complete rail refinement bound feed and roller motion',t=>{
  const a=makeMujocoSpiralFeed(mujoco),b=makeMujocoSpiralFeed(mujoco,{timestep:.00025}),c=makeMujocoSpiralFeed(mujoco,{timestep:.000125}),d=makeMujocoSpiralFeed(mujoco,{segments:6144});
  const maxima=Array.from({length:3},()=>({feed:0,rim:0}));
  try {
    for(let i=0;i<240000;i++) {
      a.physics.step();for(let j=0;j<2;j++)b.physics.step();for(let j=0;j<4;j++)c.physics.step();d.physics.step();
      for(const [j,[u,v]] of [[a,b],[b,c],[a,d]].entries()) {
        maxima[j].feed=Math.max(maxima[j].feed,Math.abs(u.physics.data.qpos[1]-v.physics.data.qpos[1])*100);
        maxima[j].rim=Math.max(maxima[j].rim,Math.abs(u.physics.data.qpos[2]-v.physics.data.qpos[2])*100*u.root.userData.profile.rollerRadius);
      }
    }
    t.diagnostic(JSON.stringify({timestep:maxima[0],refinedTimestep:maxima[1],mesh:maxima[2]}));
    for(const m of maxima){assert.ok(m.feed<.3);assert.ok(m.rim<1);}
    assert.ok(maxima[1].feed<maxima[0].feed);
  }finally{a.dispose();b.dispose();c.dispose();d.dispose();}
});
