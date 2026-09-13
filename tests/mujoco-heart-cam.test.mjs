import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoHeartCam} from '../src/simulation/mujoco-heart-cam/visual.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();

test('096 finite roller envelope preserves uniform flanks, smooth reversals and complete guides',()=>{
  const v=makeMujocoHeartCam(mujoco),p=v.physics,u=v.root.userData,g=u.geometry,f=u.profile;
  try {
    assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);
    assert.ok(p.description.collision.cells.length>1);assert.equal(p.description.collision.maximumBoundaryError,0);
    const surface=solidSurface(u.parts.cam.geometry),inverse=u.parts.cam.matrixWorld.clone().invert();
    // Inspect compiled native vertices, including MuJoCo's mesh recentering.
    for(let i=0;i<p.description.collision.cells.length;i++) {
      const geom=p.id('mjOBJ_GEOM','cam'+i),mesh=p.model.geom_dataid[geom],start=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh];
      const matrix=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,geom*9).transpose());
      matrix.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,geom*3));
      for(let j=0;j<count;j++) {
        const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(start+j)*3).applyMatrix4(matrix).applyMatrix4(inverse);
        assert.ok(surface.distance(point)<2e-6,'compiled cam vertex misses the visible plate');
        assert.ok(Math.abs(Math.abs(point.z)-g.depth/2)<2e-6);
      }
    }
    const roller=p.id('mjOBJ_GEOM','roller'),r=p.model.geom_size[3*roller],h=p.model.geom_size[3*roller+1],z=p.model.geom_pos[3*roller+2];
    assert.equal(p.model.geom_type[roller],mujoco.mjtGeom.mjGEOM_CAPSULE.value);assert.ok(Math.abs(r-g.rollerRadius)<1e-12);
    u.parts.roller.geometry.computeBoundingBox();const box=u.parts.roller.geometry.boundingBox;
    assert.ok(z-h-r>box.min.z);assert.ok(z+h+r<box.max.z);
    for(const a of [0,Math.PI]) {assert.ok(Math.abs(f.law(a).derivative)<1e-12);assert.ok(Math.abs(f.law(a).secondDerivative)<1e-10);}
    for(let a=.08;a<=Math.PI-.08;a+=.01)assert.ok(Math.abs(f.law(a).derivative-f.slope)<1e-12);
    // Search the complete polygon independently for intrusion into a roller
    // placed at each desired pitch point, including the concave reversal.
    let maxError=0;
    for(let i=0;i<720;i++){
      const a=i*2*Math.PI/720,r=f.law(a).r,center=[r*Math.cos(a),r*Math.sin(a)];let nearest=Infinity;
      for(let j=0;j<f.points.length;j++){
        const x=f.points[j],y=f.points[(j+1)%f.points.length],dx=y[0]-x[0],dy=y[1]-x[1],t=Math.max(0,Math.min(1,((center[0]-x[0])*dx+(center[1]-x[1])*dy)/(dx*dx+dy*dy)));
        nearest=Math.min(nearest,Math.hypot(center[0]-x[0]-t*dx,center[1]-x[1]-t*dy));
      }
      maxError=Math.max(maxError,Math.abs(nearest-g.rollerRadius));
    }
    assert.ok(maxError*100<.03);
    assert.ok(f.minimum-g.rollerRadius>g.hubRadius+.003);
    assert.ok(f.minimum+g.barEnd>g.guideCenters.at(-1)+g.guideHalfLength+.02);
    assert.ok(f.maximum+g.collar+g.collarDepth<g.guideCenters[0]-g.guideHalfLength-.3);
    for(const x of [f.minimum,f.maximum]){u.updateSpring(x);const c=u.parts.spring.geometry.userData.coil;assert.ok(Math.abs(c.currentLength-c.referenceLength)<1e-10);assert.ok(c.radius-c.wireRadius>g.barRadius+.02);assert.ok(c.radius+c.wireRadius<.21);}
  } finally {v.dispose();}
});

test('096 native contact drives the two passive coordinates and restart is frame independent',()=>{
  const v=makeMujocoHeartCam(mujoco),p=v.physics;
  try {
    v.update(2);assert.ok(p.data.qpos[1]>1.68);assert.ok(p.data.qpos[2]>15);
    const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=120;i++)v.update(i/60);
    assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.reset();const initial=p.data.qpos[1],roller=p.id('mjOBJ_GEOM','roller');p.model.geom_contype[roller]=0;p.model.geom_conaffinity[roller]=0;
    p.data.qvel[1]=0;p.data.qvel[2]=0;v.update(.1);assert.ok(p.data.qpos[1]<initial-.1);assert.ok(Math.abs(p.data.qvel[2])<1e-8);
  } finally {v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  const rest=makeMujocoHeartCam(mujoco);try{rest.physics.data.qvel[2]=0;rest.update(.2);assert.ok(rest.physics.data.qvel[2]>3);}finally{rest.dispose();}
});

test('096 ten turns preserve spring clearance, passive traverse and complete camera bounds',t=>{
  const v=makeMujocoHeartCam(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  let error=0,penetration=0,solidPenetration=0,checks=0,poses=0,contacts=0,uniformSpeedError=0;
  const history=[];
  try {
    for(let i=0;i<=80000;i++) {
      if(i)p.step();mujoco.mj_forward(p.model,p.data);assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      error=Math.max(error,Math.abs(p.data.qpos[1]-f.law(-p.data.qpos[0]).r));
      const cs=p.data.contact;contacts+=cs.size();for(let j=0;j<cs.size();j++){const c=cs.get(j);penetration=Math.max(penetration,-c.dist);c.delete();}cs.delete();
      history.push([p.data.qpos[0],p.data.qpos[1]]);if(history.length>101)history.shift();
      if(history.length===101){const first=history[0],last=history.at(-1),mid=-.5*(first[0]+last[0]),a=((mid%(2*Math.PI))+2*Math.PI)%(2*Math.PI),distance=Math.min(a,2*Math.PI-a);
        if(distance>.16&&distance<Math.PI-.16)uniformSpeedError=Math.max(uniformSpeedError,Math.abs((last[1]-first[1])/.05-f.law(mid).derivative*(-last[0]+first[0])/.05));}
      if(i<=8000&&i%250===0){v.sync();const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;assert.deepEqual(a.topologyIssues,[]);
        for(const issue of a.issues){assert.ok([issue.from,issue.to].every(n=>['cam','roller'].includes(n)),JSON.stringify(issue));solidPenetration=Math.max(solidPenetration,-issue.gap);}
        for(const mesh of Object.values(u.parts)){const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);}
      }
    }
    t.diagnostic(JSON.stringify({maximumTraverseErrorPixels:error*100,maximumNativePenetrationPixels:penetration*100,maximumSampledPenetrationPixels:solidPenetration*100,uniformSpeedErrorOver50ms:uniformSpeedError,contacts,poses,surfaceChecks:checks}));
    assert.ok(error*100<.05);assert.ok(penetration*100<.05);assert.ok(solidPenetration*100<.05);assert.ok(uniformSpeedError<.01);assert.ok(contacts>60000);
  } finally {v.dispose();}
});

test('096 timestep and cam-mesh refinement converge over ten turns',t=>{
  const a=makeMujocoHeartCam(mujoco),b=makeMujocoHeartCam(mujoco,{timestep:.00025}),c=makeMujocoHeartCam(mujoco,{timestep:.000125}),d=makeMujocoHeartCam(mujoco,{segments:1536});
  let first=0,second=0,mesh=0,s1=0,s2=0,sm=0;
  try{
    for(let i=0;i<80000;i++){a.physics.step();for(let j=0;j<2;j++)b.physics.step();for(let j=0;j<4;j++)c.physics.step();d.physics.step();
      const [x,y,z,w]=[a,b,c,d].map(v=>v.physics.data.qpos);first=Math.max(first,Math.abs(x[1]-y[1]));second=Math.max(second,Math.abs(y[1]-z[1]));mesh=Math.max(mesh,Math.abs(x[1]-w[1]));s1=Math.max(s1,Math.abs(x[2]-y[2]));s2=Math.max(s2,Math.abs(y[2]-z[2]));sm=Math.max(sm,Math.abs(x[2]-w[2]));}
    const r=a.root.userData.geometry.rollerRadius*100;
    t.diagnostic(JSON.stringify({maximumTimestepDifferencePixels:first*100,maximumRefinedDifferencePixels:second*100,maximumMeshDifferencePixels:mesh*100,rollerRimDifferencesPixels:[s1*r,s2*r,sm*r]}));
    assert.ok(first*100<.1);assert.ok(second<first);assert.ok(mesh*100<.1);assert.ok(s1*r<.5);assert.ok(s2<s1);assert.ok(sm*r<.5);
  }finally{a.dispose();b.dispose();c.dispose();d.dispose();}
});
