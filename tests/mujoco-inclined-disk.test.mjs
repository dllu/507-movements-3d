import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoInclinedDisk} from '../src/simulation/mujoco-inclined-disk/visual.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();

test('095 finite contact face, radial axle and guide contain the complete working envelope',()=>{
  const v=makeMujocoInclinedDisk(mujoco),p=v.physics,u=v.root.userData,g=u.geometry;
  try {
    assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.ngeom,2);
    assert.equal(p.model.geom_type[p.id('mjOBJ_GEOM','disk')],mujoco.mjtGeom.mjGEOM_MESH.value);
    const roller=p.id('mjOBJ_GEOM','roller');assert.equal(p.model.geom_type[roller],mujoco.mjtGeom.mjGEOM_CYLINDER.value);
    assert.ok(Math.abs(p.model.geom_size[3*roller]-g.rollerRadius)<1e-12);
    assert.ok(Math.abs(p.model.geom_size[3*roller+1]-g.rollerHalfWidth)<1e-12);
    const surface=solidSurface(u.parts.disk.geometry),half=g.depth/2;
    const nativeDisk=p.id('mjOBJ_GEOM','disk'),meshId=p.model.geom_dataid[nativeDisk],start=p.model.mesh_vertadr[meshId],count=p.model.mesh_vertnum[meshId];
    const matrix=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,nativeDisk*9).transpose());
    matrix.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,nativeDisk*3));
    const inverse=u.parts.disk.matrixWorld.clone().invert(),points=[];
    for(let i=0;i<count;i++){
      const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(start+i)*3).applyMatrix4(matrix).applyMatrix4(inverse);
      assert.ok(surface.distance(point)<2e-6,'native prism vertex does not meet the rendered plate');
      assert.ok(Math.abs(Math.abs(point.z)-half)<2e-6);points.push(point);
    }
    assert.equal(points.length,16);
    for(let i=0;i<100;i++){
      const a=2*Math.PI*i/100,r=g.radius*.85,point=new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),half);
      assert.ok(surface.distance(point)<1e-7);
    }
    // Every possible roller surface point lies inside the octagonal proxy's
    // incircle, including its remote edge. Thus contacts cannot reach omitted
    // disk-rim regions. The vertical allowance exceeds the measured soft error.
    const maxY=half/Math.cos(g.tilt)+(g.followerX+g.rollerHalfWidth)*Math.tan(g.tilt)+g.rollerRadius/Math.cos(g.tilt)+.001;
    const envelope=Math.hypot(g.followerX+g.rollerHalfWidth,maxY+g.rollerRadius,g.rollerRadius);
    assert.ok(envelope<g.radius*Math.cos(Math.PI/8));
    const maxHeight=u.expectedHeight(0),minHeight=u.expectedHeight(Math.PI);
    assert.ok(maxHeight+.225<g.guideY-g.guideHalfLength);
    assert.ok(minHeight+(u.source.rollerCenter[1]-u.source.rodTop)/100>g.guideY+g.guideHalfLength);
    assert.ok(g.rollerHalfWidth<.0625);assert.ok(g.pinRadius+.001<g.rollerRadius);
  } finally {v.dispose();}
});

test('095 contact drives both passive coordinates and restart is independent of render frames',()=>{
  const v=makeMujocoInclinedDisk(mujoco),p=v.physics;
  try {
    v.update(2);assert.ok(p.data.qpos[1]<0);assert.ok(p.data.qpos[2]<-20);
    const expected=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=120;i++)v.update(i/60);
    assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
    v.reset();const initial=p.data.qpos[1];const roller=p.id('mjOBJ_GEOM','roller');p.model.geom_contype[roller]=0;p.model.geom_conaffinity[roller]=0;
    p.data.qvel[1]=0;p.data.qvel[2]=0;v.update(.2);
    assert.ok(p.data.qpos[1]<initial-.15);assert.ok(Math.abs(p.data.qvel[2])<1e-8);
  } finally {v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  // Starting the roller at rest still spins it through tangential contact.
  const rest=makeMujocoInclinedDisk(mujoco);try{rest.physics.data.qvel[2]=0;rest.update(.25);assert.ok(rest.physics.data.qvel[2]<-5);}finally{rest.dispose();}
});

test('095 ten turns keep the roller, fork and complete support hardware clear',t=>{
  const v=makeMujocoInclinedDisk(mujoco),p=v.physics,u=v.root.userData;
  let error=0,penetration=0,solidPenetration=0,checks=0,poses=0,contacts=0,minSpin=Infinity,maxSpin=-Infinity;
  try {
    for(let i=0;i<=40000;i++) {
      if(i)p.step();mujoco.mj_forward(p.model,p.data);assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      error=Math.max(error,Math.abs(p.data.qpos[1]-u.expectedHeight(p.data.qpos[0])));
      minSpin=Math.min(minSpin,p.data.qvel[2]);maxSpin=Math.max(maxSpin,p.data.qvel[2]);
      const cs=p.data.contact;contacts+=cs.size();for(let j=0;j<cs.size();j++){const c=cs.get(j);penetration=Math.max(penetration,-c.dist);c.delete();}cs.delete();
      if(i<=4000&&i%125===0){v.sync();const audit=auditClutchSourceSolids(v);checks+=audit.checks;poses++;
        assert.deepEqual(audit.topologyIssues,[]);
        for(const issue of audit.issues){assert.ok([issue.from,issue.to].every(n=>['roller','disk'].includes(n)),JSON.stringify(issue));solidPenetration=Math.max(solidPenetration,-issue.gap);}
        for(const mesh of Object.values(u.parts)) {const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);}
      }
    }
    t.diagnostic(JSON.stringify({maximumHeightErrorPixels:error*100,maximumNativePenetrationPixels:penetration*100,maximumSampledPenetrationPixels:solidPenetration*100,contacts,minSpin,maxSpin,poses,surfaceChecks:checks}));
    assert.ok(error*100<.02);assert.ok(penetration*100<.02);assert.ok(solidPenetration*100<.02);assert.ok(contacts>20000);assert.ok(maxSpin<0);
  } finally {v.dispose();}
});

test('095 timestep and visible-mesh refinement converge over ten turns',t=>{
  const a=makeMujocoInclinedDisk(mujoco),b=makeMujocoInclinedDisk(mujoco,{timestep:.0005}),c=makeMujocoInclinedDisk(mujoco,{timestep:.00025}),d=makeMujocoInclinedDisk(mujoco,{segments:384,contactSides:16});
  let first=0,second=0,mesh=0,spinFirst=0,spinSecond=0,spinMesh=0;
  try{
    for(let i=0;i<40000;i++) {a.physics.step();for(let j=0;j<2;j++)b.physics.step();for(let j=0;j<4;j++)c.physics.step();d.physics.step();
      const [x,y,z,w]=[a,b,c,d].map(v=>v.physics.data.qpos);
      first=Math.max(first,Math.abs(x[1]-y[1]));second=Math.max(second,Math.abs(y[1]-z[1]));mesh=Math.max(mesh,Math.abs(x[1]-w[1]));
      spinFirst=Math.max(spinFirst,Math.abs(x[2]-y[2]));spinSecond=Math.max(spinSecond,Math.abs(y[2]-z[2]));spinMesh=Math.max(spinMesh,Math.abs(x[2]-w[2]));
    }
    const r=a.root.userData.geometry.rollerRadius*100;
    t.diagnostic(JSON.stringify({maximumTimestepDifferencePixels:first*100,maximumRefinedDifferencePixels:second*100,maximumMeshDifferencePixels:mesh*100,rollerRimDifferencesPixels:[spinFirst*r,spinSecond*r,spinMesh*r]}));
    assert.ok(first*100<.1);assert.ok(second<first);assert.ok(mesh*100<.1);
    assert.ok(spinFirst*r<.5);assert.ok(spinSecond<spinFirst);assert.ok(spinMesh*r<.5);
  }finally{a.dispose();b.dispose();c.dispose();d.dispose();}
});
