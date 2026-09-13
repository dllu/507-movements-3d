import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoGroovedHeart} from '../src/simulation/mujoco-grooved-heart/visual.js';
import {rigidFamilyInertia} from '../src/simulation/mujoco/mass.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();

test('097 compiled cam preserves the complete groove and both finite working faces',t=>{
  const v=makeMujocoGroovedHeart(mujoco),p=v.physics,u=v.root.userData,g=u.geometry,f=u.profile;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.jnt_stiffness[1],0);
    const inverse=u.parts.inner.matrixWorld.clone().invert();
    for(const [part,c] of Object.entries(p.description.collision)) {
      const surface=solidSurface(u.parts[part].geometry);
      const volume=c.cells.reduce((s,cell)=>s+THREE.ShapeUtils.area(cell.map(p=>new THREE.Vector2(...p)))*(c.high-c.low),0);
      const visible=rigidFamilyInertia({[part]:u.parts[part]},{[part]:'single'},'single').volume;
      assert.ok(Math.abs(volume-visible)<1e-10,'decomposition changed plate volume or filled a hole');
      for(let i=0;i<c.cells.length;i++) {
        const geom=p.id('mjOBJ_GEOM',part+i),mesh=p.model.geom_dataid[geom],start=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh];
        const matrix=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,geom*9).transpose());
        matrix.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,geom*3));
        for(let j=0;j<count;j++) {
          const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(start+j)*3).applyMatrix4(matrix).applyMatrix4(inverse);
          assert.ok(surface.distance(point)<2e-6,'compiled cam vertex misses the rendered plate');
          assert.ok(Math.min(Math.abs(point.z-c.low),Math.abs(point.z-c.high))<2e-6);
        }
      }
    }
    const pin=p.id('mjOBJ_GEOM','pin'),r=p.model.geom_size[3*pin],h=p.model.geom_size[3*pin+1],z=p.model.geom_pos[3*pin+2];
    assert.equal(p.model.geom_type[pin],mujoco.mjtGeom.mjGEOM_CAPSULE.value);assert.ok(Math.abs(r-f.pinRadius)<1e-12);
    u.parts.pin.geometry.computeBoundingBox();const box=u.parts.pin.geometry.boundingBox;
    assert.ok(z-h-r>box.min.z&&z+h+r<box.max.z);assert.ok(box.min.z>-.18);
    let maxCurvature=0,minGap=Infinity,maxGap=0;
    for(let i=0;i<720;i++) {
      const a=i*2*Math.PI/720,{r,derivative:d,secondDerivative:dd}=f.law(a),center=f.at(a);
      maxCurvature=Math.max(maxCurvature,Math.abs((r*r+2*d*d-r*dd)/(r*r+d*d)**1.5));
      for(const points of [f.inner,f.outer]) {
        let nearest=Infinity;
        for(let j=0;j<points.length;j++) {
          const x=points[j],y=points[(j+1)%points.length],dx=y[0]-x[0],dy=y[1]-x[1],t=Math.max(0,Math.min(1,((center[0]-x[0])*dx+(center[1]-x[1])*dy)/(dx*dx+dy*dy)));
          nearest=Math.min(nearest,Math.hypot(center[0]-x[0]-t*dx,center[1]-x[1]-t*dy));
        }
        minGap=Math.min(minGap,nearest-f.pinRadius);maxGap=Math.max(maxGap,nearest-f.pinRadius);
      }
    }
    assert.ok(maxCurvature*f.halfWidth<.9,'offset groove would undercut itself');
    t.diagnostic(JSON.stringify({minimumNominalGapPixels:minGap*100,maximumNominalGapPixels:maxGap*100,curvatureTimesHalfWidth:maxCurvature*f.halfWidth}));
    assert.ok(minGap>0);assert.ok(minGap>f.clearance-.0001&&maxGap<f.clearance+.0001,'faceting exceeds 0.01 source pixel');
    for(const a of [0,Math.PI])assert.ok(Math.abs(f.law(a).derivative)<1e-12);
    for(let i=0;i<=1000;i++)assert.ok(f.law(i*Math.PI/1000).derivative>=-1e-10,'fitted groove reverses before the stroke endpoint');
    assert.ok(f.minimum-f.halfWidth>g.hubRadius+.01);
    assert.ok(f.maximum+f.halfWidth<g.diskRadius-.02);
    assert.ok(f.minimum+g.barEnd>g.guideCenters.at(-1)+g.guideHalfLength+.04);
  } finally {v.dispose();}
});

test('097 output is passive, drives against either load and restarts independently of render frames',()=>{
  const v=makeMujocoGroovedHeart(mujoco),p=v.physics;
  try {
    v.update(2);assert.ok(p.data.qpos[1]>1.74);const state=[...p.data.qpos,...p.data.qvel];
    v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.reset();const initial=p.data.qpos[1],pin=p.id('mjOBJ_GEOM','pin');p.model.geom_contype[pin]=0;p.model.geom_conaffinity[pin]=0;p.data.qvel[1]=0;
    v.update(2);assert.ok(Math.abs(p.data.qpos[1]-initial)<1e-10);assert.ok(p.data.qpos[0]<-3);
  }finally{v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  for(const load of [-1,1]) {
    const v=makeMujocoGroovedHeart(mujoco,{load});try {
      for(const t of [1,2,3,4]){v.update(t);const p=v.physics;assert.ok(Math.abs(p.data.qpos[1]-v.root.userData.profile.law(-p.data.qpos[0]).r)*100<.15);}
    }finally{v.dispose();}
  }
});

test('097 ten turns use both groove faces and keep all hardware within the camera',t=>{
  const v=makeMujocoGroovedHeart(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  const names=new Map();for(const [name,c] of Object.entries(p.description.collision))for(let i=0;i<c.cells.length;i++)names.set(p.id('mjOBJ_GEOM',name+i),name);
  const surfaces=Object.fromEntries(['inner','outer'].map(n=>[n,solidSurface(u.parts[n].geometry)]));
  let error=0,penetration=0,solidPenetration=0,checks=0,poses=0,contactSurfaceError=0;const contacts={inner:0,outer:0};
  try {
    for(let i=0;i<=80000;i++) {
      if(i)p.step();mujoco.mj_forward(p.model,p.data);assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      error=Math.max(error,Math.abs(p.data.qpos[1]-f.law(-p.data.qpos[0]).r));
      const cs=p.data.contact;
      for(let j=0;j<cs.size();j++) {
        const c=cs.get(j),part=names.get(c.geom1)??names.get(c.geom2);assert.ok(part);contacts[part]++;penetration=Math.max(penetration,-c.dist);
        if(i%20===0) {
          const point=new THREE.Vector3().fromArray(c.pos).applyAxisAngle(new THREE.Vector3(0,0,1),-p.data.qpos[0]);
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
    t.diagnostic(JSON.stringify({maximumTraverseErrorPixels:error*100,maximumNativePenetrationPixels:penetration*100,maximumSampledPenetrationPixels:solidPenetration*100,contactSurfaceErrorPixels:contactSurfaceError*100,contacts,poses,surfaceChecks:checks}));
    assert.ok(error*100<.1);assert.ok(penetration*100<.05);assert.ok(solidPenetration*100<.05);assert.ok(contactSurfaceError*100<.05);assert.ok(contacts.inner>1000&&contacts.outer>1000);
  }finally{v.dispose();}
});

test('097 timestep and complete groove-mesh refinement stay within the running-fit scale',t=>{
  const a=makeMujocoGroovedHeart(mujoco),b=makeMujocoGroovedHeart(mujoco,{timestep:.00025}),c=makeMujocoGroovedHeart(mujoco,{timestep:.000125}),d=makeMujocoGroovedHeart(mujoco,{segments:1536});
  let first=0,second=0,mesh=0;
  try {
    for(let i=0;i<80000;i++){a.physics.step();for(let j=0;j<2;j++)b.physics.step();for(let j=0;j<4;j++)c.physics.step();d.physics.step();const [x,y,z,w]=[a,b,c,d].map(v=>v.physics.data.qpos[1]);first=Math.max(first,Math.abs(x-y));second=Math.max(second,Math.abs(y-z));mesh=Math.max(mesh,Math.abs(x-w));}
    t.diagnostic(JSON.stringify({maximumTimestepDifferencePixels:first*100,maximumRefinedDifferencePixels:second*100,maximumMeshDifferencePixels:mesh*100}));
    assert.ok(first*100<.15);assert.ok(second<first);assert.ok(mesh*100<.15);
  }finally{a.dispose();b.dispose();c.dispose();d.dispose();}
});
