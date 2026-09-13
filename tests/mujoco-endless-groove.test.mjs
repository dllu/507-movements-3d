import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoEndlessGroove} from '../src/simulation/mujoco-endless-groove/visual.js';
import {rigidFamilyInertia} from '../src/simulation/mujoco/mass.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();
const localPin=(p,f)=>{
  const [a,b]=p.data.qpos,x=f.crankRadius*Math.cos(a)-f.pivot[0],y=f.crankRadius*Math.sin(a)-f.pivot[1];
  return [x*Math.cos(b)+y*Math.sin(b),-x*Math.sin(b)+y*Math.cos(b)];
};

test('098 compiled contacts preserve the complete rear groove and finite crank pin',t=>{
  const v=makeMujocoEndlessGroove(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.jnt_stiffness[1],0);
    const inverse=u.blocks.rocker.matrixWorld.clone().invert();
    for(const [part,c] of Object.entries(p.description.collision)) {
      const surface=solidSurface(u.parts[part].geometry);
      const volume=c.cells.reduce((s,cell)=>s+THREE.ShapeUtils.area(cell.map(p=>new THREE.Vector2(...p)))*(c.high-c.low),0);
      const visible=rigidFamilyInertia({[part]:u.parts[part]},{[part]:'single'},'single').volume;
      assert.ok(Math.abs(volume-visible)<1e-10,'decomposition changed volume or filled a hole');
      for(let i=0;i<c.cells.length;i++) {
        const geom=p.id('mjOBJ_GEOM',part+i),mesh=p.model.geom_dataid[geom],start=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh];
        const matrix=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,geom*9).transpose());
        matrix.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,geom*3));
        for(let j=0;j<count;j++) {
          const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(start+j)*3).applyMatrix4(matrix).applyMatrix4(inverse);
          assert.ok(surface.distance(point)<2e-6,'compiled vertex misses the rendered groove');
        }
      }
    }
    const pin=p.id('mjOBJ_GEOM','pin'),r=p.model.geom_size[3*pin],h=p.model.geom_size[3*pin+1],z=p.model.geom_pos[3*pin+2];
    assert.equal(p.model.geom_type[pin],mujoco.mjtGeom.mjGEOM_CAPSULE.value);assert.ok(Math.abs(r-f.pinRadius)<1e-12);
    u.parts.pin.geometry.computeBoundingBox();u.parts.cover.geometry.computeBoundingBox();const box=u.parts.pin.geometry.boundingBox;
    assert.ok(z-h-r>box.min.z&&z+h+r<box.max.z);assert.ok(box.max.z<u.parts.cover.geometry.boundingBox.min.z);
    assert.ok(Math.abs(p.model.geom_pos[3*pin]-f.crankRadius)<1e-12);
    let minimumEndMargin=Infinity,maximumFitError=0;
    for(let i=0;i<720;i++) {
      const a=2*Math.PI*i/720,b=f.reference(a),x=f.crankRadius*Math.cos(a)-f.pivot[0],y=f.crankRadius*Math.sin(a)-f.pivot[1];
      const point=[x*Math.cos(b)+y*Math.sin(b),-x*Math.sin(b)+y*Math.cos(b)];
      maximumFitError=Math.max(maximumFitError,Math.abs(f.distance(point)-f.radius));
      assert.ok(point[1]<f.center[1]-.01,'source-sized crank unexpectedly switches branches');
      const radius=Math.hypot(x,y),ends=f.ends.map(e=>Math.hypot(...e));
      minimumEndMargin=Math.min(minimumEndMargin,radius-(Math.min(...ends)-f.radius),Math.max(...ends)+f.radius-radius);
    }
    t.diagnostic(JSON.stringify({minimumRadialEndMarginPixels:minimumEndMargin*100,referenceClosureErrorPixels:maximumFitError*100,
      initialArmAdjustmentDegrees:(f.reference(f.phase)-f.sourceAngle)*180/Math.PI}));
    assert.ok(minimumEndMargin>.1);assert.ok(maximumFitError<1e-12);
    const state=[...p.data.qpos,...p.data.qvel];u.setSectionView(false);assert.ok(u.parts.cover.visible);u.setSectionView(true);
    assert.ok(!u.parts.cover.visible);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
  }finally{v.dispose();}
});

test('098 arm is passive, takes either load and restarts independently of render frames',()=>{
  const v=makeMujocoEndlessGroove(mujoco),p=v.physics;
  try {
    v.update(2);const state=[...p.data.qpos,...p.data.qvel];
    v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.reset();const initial=p.data.qpos[1],pin=p.id('mjOBJ_GEOM','pin');
    p.model.geom_contype[pin]=0;p.model.geom_conaffinity[pin]=0;p.data.qvel[1]=0;p.model.opt.gravity.fill(0);
    v.update(2);assert.ok(Math.abs(p.data.qpos[1]-initial)<1e-10);assert.ok(p.data.qpos[0]<-4);
  }finally{v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  for(const load of [-1,1]) {
    const v=makeMujocoEndlessGroove(mujoco,{load});try {
      for(let i=1;i<=32;i++){v.update(i/8);const p=v.physics,f=v.root.userData.profile;assert.ok(Math.abs(f.distance(localPin(p,f))-f.radius)*100<.1);}
    }finally{v.dispose();}
  }
});

test('098 ten turns preserve groove contact and separate all other finite parts',t=>{
  const v=makeMujocoEndlessGroove(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  const names=new Map();for(const [name,c] of Object.entries(p.description.collision))for(let i=0;i<c.cells.length;i++)names.set(p.id('mjOBJ_GEOM',name+i),name);
  const surfaces=Object.fromEntries(['inner','outer'].map(n=>[n,solidSurface(u.parts[n].geometry)]));
  let error=0,angleError=0,penetration=0,solidPenetration=0,checks=0,poses=0,contactSurfaceError=0,minAngle=Infinity,maxAngle=-Infinity;
  const contacts={inner:0,outer:0};
  try {
    for(let i=0;i<=80000;i++) {
      if(i)p.step();mujoco.mj_forward(p.model,p.data);assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      const point=localPin(p,f),b=p.data.qpos[1];error=Math.max(error,Math.abs(f.distance(point)-f.radius));
      angleError=Math.max(angleError,Math.abs(b-f.reference(p.data.qpos[0])));minAngle=Math.min(minAngle,b);maxAngle=Math.max(maxAngle,b);
      assert.ok(point[1]<f.center[1]-.01);
      const cs=p.data.contact;
      for(let j=0;j<cs.size();j++) {
        const c=cs.get(j),part=names.get(c.geom1)??names.get(c.geom2);assert.ok(part);contacts[part]++;penetration=Math.max(penetration,-c.dist);
        if(i%20===0) {
          const point=new THREE.Vector3().fromArray(c.pos).sub(new THREE.Vector3(...f.pivot,0)).applyAxisAngle(new THREE.Vector3(0,0,1),-b);
          contactSurfaceError=Math.max(contactSurfaceError,surfaces[part].distance(point));
        }
        c.delete();
      }
      cs.delete();
      if(i<=8000&&i%250===0) {
        v.sync();const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;assert.deepEqual(a.topologyIssues,[]);
        for(const issue of a.issues){assert.ok([issue.from,issue.to].includes('pin')&&[issue.from,issue.to].some(n=>['inner','outer'].includes(n)),JSON.stringify(issue));solidPenetration=Math.max(solidPenetration,-issue.gap);}
        for(const mesh of Object.values(u.parts)){const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);}
      }
    }
    t.diagnostic(JSON.stringify({maximumGrooveErrorPixels:error*100,maximumAngleErrorDegrees:angleError*180/Math.PI,
      maximumNativePenetrationPixels:penetration*100,maximumSampledPenetrationPixels:solidPenetration*100,contactSurfaceErrorPixels:contactSurfaceError*100,
      angleRangeDegrees:[minAngle,maxAngle].map(a=>a*180/Math.PI),contacts,poses,surfaceChecks:checks}));
    assert.ok(error*100<.1);assert.ok(angleError*180/Math.PI<.03);assert.ok(penetration*100<.05);assert.ok(solidPenetration*100<.05);
    assert.ok(contactSurfaceError*100<.05);assert.ok(contacts.inner>100&&contacts.outer>100);
  }finally{v.dispose();}
});

test('098 timestep and complete groove-mesh refinement stay within the running-fit scale',t=>{
  const a=makeMujocoEndlessGroove(mujoco),b=makeMujocoEndlessGroove(mujoco,{timestep:.00025}),c=makeMujocoEndlessGroove(mujoco,{timestep:.000125}),d=makeMujocoEndlessGroove(mujoco,{segments:512});
  let first=0,second=0,mesh=0;
  try {
    for(let i=0;i<80000;i++){a.physics.step();for(let j=0;j<2;j++)b.physics.step();for(let j=0;j<4;j++)c.physics.step();d.physics.step();const [x,y,z,w]=[a,b,c,d].map(v=>v.physics.data.qpos[1]);first=Math.max(first,Math.abs(x-y));second=Math.max(second,Math.abs(y-z));mesh=Math.max(mesh,Math.abs(x-w));}
    t.diagnostic(JSON.stringify({maximumTimestepDifferenceDegrees:first*180/Math.PI,maximumRefinedDifferenceDegrees:second*180/Math.PI,maximumMeshDifferenceDegrees:mesh*180/Math.PI}));
    assert.ok(first*180/Math.PI<.04);assert.ok(second<first);assert.ok(mesh*180/Math.PI<.04);
  }finally{a.dispose();b.dispose();c.dispose();d.dispose();}
});
