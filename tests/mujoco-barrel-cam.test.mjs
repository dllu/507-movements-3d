import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoBarrelCam} from '../src/simulation/mujoco-barrel-cam/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();
const error=v=>{const p=v.physics,f=v.root.userData.profile;return p.data.qpos[1]-(f.law(-p.data.qpos[0]).x-f.initialTip);};

test('106 closed solids and compiled convex prisms preserve the actual groove walls',t=>{
  const v=makeMujocoBarrelCam(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  let vertices=0;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.jnt_stiffness[1],0);
    assert.equal(Object.keys(u.parts).length,12);
    for(const part of Object.values(u.parts)) {
      const a=inspectWeightedClutchSolid(part.geometry);assert.equal(a.components,1);assert.ok(a.volume>0);
      for(const key of ['degenerate','wrongNormals','nonfinite','unmatchedEdges'])assert.equal(a[key],0,part.name+' '+key);
    }
    for(const [part,cells] of Object.entries(u.collision)) {
      const surface=solidSurface(u.parts[part].geometry);let volume=0;
      for(let i=0;i<cells.length;i++) {
        const c=cells[i],a=c[0],b=c[1],d=c[2],area=Math.abs((b[1]-a[1])*(d[2]-a[2])-(b[2]-a[2])*(d[1]-a[1]))/2;
        volume+=area*(Math.abs(c[0][0]-c[3][0])+Math.abs(c[1][0]-c[4][0])+Math.abs(c[2][0]-c[5][0]))/3;
        const geom=p.id('mjOBJ_GEOM',part+i),mesh=p.model.geom_dataid[geom],start=p.model.mesh_vertadr[mesh],count=p.model.mesh_vertnum[mesh];
        const matrix=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,geom*9).transpose());
        matrix.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,geom*3));
        for(let j=0;j<count;j++) {
          const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(start+j)*3).applyMatrix4(matrix);
          assert.ok(surface.distance(point)<3e-7,'compiled contact vertex misses the visible land');vertices++;
        }
      }
      const actual=inspectWeightedClutchSolid(u.parts[part].geometry).volume;
      assert.ok(Math.abs(volume-actual)<2e-7,'convex cells filled or removed part of the groove');
    }
    const shoe=p.id('mjOBJ_GEOM','shoe');assert.equal(p.model.geom_type[shoe],mujoco.mjtGeom.mjGEOM_CAPSULE.value);
    assert.ok(Math.abs(p.model.geom_size[3*shoe]-f.pinRadius)<1e-12);
    assert.ok(f.pinLow-f.pinRadius-f.floor>.01,'rounded end does not clear the floor');
    for(let a=.2;a<Math.PI-.2;a+=.01) {
      assert.ok(Math.abs(f.law(a-f.phase).derivative-f.slope)<1e-12);
      assert.ok(Math.abs(f.law(2*Math.PI-a-f.phase).derivative+f.slope)<1e-12);
    }
    t.diagnostic(JSON.stringify({compiledVertices:vertices,solids:12,contactGeometries:p.model.ngeom}));
  }finally{v.dispose();}
});

test('106 ten turns drive uniform strokes through both walls without losing the guides',t=>{
  const v=makeMujocoBarrelCam(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  const names=new Map();for(const [name,cells] of Object.entries(u.collision))for(let i=0;i<cells.length;i++)names.set(p.id('mjOBJ_GEOM',name+i),name);
  const contacts={leftLand:0,rightLand:0};let deviation=0,penetration=0,visiblePenetration=0,retention=Infinity,checks=0,poses=0,speedError=0,previous;
  const cycle=Math.round(p.description.options.period/p.timestep),window=Math.round(.1/p.timestep);
  try {
    for(let i=0;i<=10*cycle;i++) {
      if(i)p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      deviation=Math.max(deviation,Math.abs(error(v)));
      const q=p.data.qpos[1],a=((f.phase-p.data.qpos[0])%(2*Math.PI)+2*Math.PI)%(2*Math.PI),sign=a<Math.PI?1:-1;
      retention=Math.min(retention,f.x(u.source.rodEnds[1])+q-f.x(u.source.edges.rightGuideRight),f.x(u.source.edges.leftGuideLeft)-f.x(u.source.rodEnds[0])-q);
      if(i%window===0) {
        const onFlank=a>.3&&a<Math.PI-.3||a>Math.PI+.3&&a<2*Math.PI-.3;
        if(onFlank&&previous?.sign===sign) {
          const expected=-p.description.omega*sign*f.slope;
          speedError=Math.max(speedError,Math.abs((q-previous.x)/.1-expected)/Math.abs(expected));
        }
        previous=onFlank?{x:q,sign}:undefined;
      }
      const cs=p.data.contact;
      for(let j=0;j<cs.size();j++){const c=cs.get(j),name=names.get(c.geom1)??names.get(c.geom2);assert.ok(name);contacts[name]++;penetration=Math.max(penetration,-c.dist);c.delete();}cs.delete();
      if(i<=cycle&&i%(cycle/32)===0) {
        v.sync();const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;assert.deepEqual(a.topologyIssues,[]);
        for(const issue of a.issues){assert.ok([issue.from,issue.to].includes('shoe')&&[issue.from,issue.to].some(n=>['leftLand','rightLand'].includes(n)),JSON.stringify(issue));visiblePenetration=Math.max(visiblePenetration,-issue.gap);}
        for(const mesh of Object.values(u.parts)){const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);}
      }
      if(i&&i%cycle===0){assert.ok(p.data.qpos[0]<-i/cycle*2*Math.PI+.01,'input stalled');assert.ok(Math.abs(q)<.001,'follower did not complete a cycle');}
    }
    t.diagnostic(JSON.stringify({errorPixels:100*deviation,speedErrorPercent:100*speedError,nativePenetrationPixels:100*penetration,
      visiblePenetrationPixels:100*visiblePenetration,guideRetentionPixels:100*retention,contacts,checks,poses}));
    assert.ok(deviation*100<.04);assert.ok(speedError<.02);assert.ok(penetration*100<.02);assert.ok(visiblePenetration*100<.02);
    assert.ok(retention>.045);assert.ok(contacts.leftLand>1000&&contacts.rightLand>1000);
  }finally{v.dispose();}
});

test('106 follower is passive under either load and playback reset is deterministic',()=>{
  const v=makeMujocoBarrelCam(mujoco),p=v.physics;
  try {
    v.update(2);const state=[...p.data.qpos,...p.data.qvel];
    v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.reset();p.model.opt.gravity.fill(0);p.data.qvel[1]=0;const shoe=p.id('mjOBJ_GEOM','shoe');p.model.geom_contype[shoe]=0;p.model.geom_conaffinity[shoe]=0;
    v.update(4);assert.ok(Math.abs(p.data.qpos[1])<1e-10);assert.ok(p.data.qpos[0]<-6);
  }finally{v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  for(const load of [-1,1]) {
    const v=makeMujocoBarrelCam(mujoco,{load});try{for(let i=1;i<=160;i++){v.update(i/20);assert.ok(Math.abs(error(v))*100<.15);}}finally{v.dispose();}
  }
});

test('106 timestep and groove refinement retain the complete stroke',t=>{
  const variants=[{}, {timestep:.00025}, {timestep:.000125}, {segments:768}].map(o=>makeMujocoBarrelCam(mujoco,o));
  let first=0,second=0,mesh=0;
  try {
    for(let i=0;i<80000;i++) {
      variants[0].physics.step();for(let j=0;j<2;j++)variants[1].physics.step();for(let j=0;j<4;j++)variants[2].physics.step();variants[3].physics.step();
      const [a,b,c,d]=variants.map(v=>v.physics.data.qpos[1]);first=Math.max(first,Math.abs(a-b));second=Math.max(second,Math.abs(b-c));mesh=Math.max(mesh,Math.abs(a-d));
    }
    t.diagnostic(JSON.stringify({timestepDifferencePixels:100*first,refinedDifferencePixels:100*second,meshDifferencePixels:100*mesh}));
    assert.ok(first*100<.1);assert.ok(second<first);assert.ok(mesh*100<.1);
  }finally{for(const v of variants)v.dispose();}
});

test('106 stem is buried in the collar and the ball, symmetric about the ball axis',()=>{
  const v=makeMujocoBarrelCam(mujoco),u=v.root.userData,f=u.profile;
  try {
    const box=name=>{const g=u.parts[name].geometry;g.computeBoundingBox();return g.boundingBox;};
    const stem=box('stem'),head=box('head'),shoe=box('shoe'),x=f.initialTip;
    for(const b of [stem,head,shoe]){assert.ok(Math.abs((b.min.x+b.max.x)/2-x)<1e-6);assert.ok(Math.abs(b.min.z+b.max.z)<1e-6);}
    assert.ok(stem.min.y<=(f.pinLow+f.pinHigh)/2+1e-6,'stem reaches the ball centre');
    assert.ok(stem.max.y>head.min.y+.01,'stem enters the collar');
    assert.ok(head.max.z>f.rodHalfDepth&&head.min.z<-f.rodHalfDepth,'collar wraps the rod');
  }finally{v.dispose();}
});
