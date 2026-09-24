import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoSerpentineCam} from '../src/simulation/mujoco-serpentine-cam/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();
const error=v=>{const p=v.physics,f=v.root.userData.profile;return p.data.qpos[1]-(f.law(-p.data.qpos[0]).x-f.initialTip);};

test('107 closed solids and compiled convex prisms preserve the actual groove walls',t=>{
  const v=makeMujocoSerpentineCam(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  let vertices=0;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.jnt_stiffness[1],0);
    assert.equal(Object.keys(u.parts).length,11);assert.equal(p.model.nmesh,4*f.segments/f.repetitions);
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
    let curvature=0;
    for(let i=0;i<4096;i++){const a=2*Math.PI/f.repetitions*i/4096,dx=f.law(a).derivative,ddx=(f.law(a+1e-7).derivative-f.law(a-1e-7).derivative)/2e-7,r=f.pinLow;curvature=Math.max(curvature,r*Math.sqrt(r*r+dx*dx+ddx*ddx)/(r*r+dx*dx)**1.5);}
    assert.ok(f.cutterRadius*curvature<.9,'working pin undercuts the tight pitch-curve turns');
    const shoe=p.id('mjOBJ_GEOM','shoe');assert.equal(p.model.geom_type[shoe],mujoco.mjtGeom.mjGEOM_CAPSULE.value);
    assert.ok(Math.abs(p.model.geom_size[3*shoe]-f.pinRadius)<1e-12);
    assert.ok(f.pinLow-f.pinRadius-f.floor>.01,'rounded end does not clear the floor');
    // Brown's snaking groove: a saturated sine with broad round U ends.
    assert.equal(f.repetitions,8);
    for(let a=0;a<2*Math.PI/f.repetitions;a+=.005) {
      const n=f.repetitions,c=f.sharpness,u=n*a-Math.PI/2,law=f.law(a-f.phase),t=Math.tanh(c*Math.sin(u));
      assert.ok(Math.abs(law.x-(f.minimum+f.amplitude*(1+t/Math.tanh(c))))<1e-12);
      assert.ok(Math.abs(law.derivative-f.amplitude*n*c*Math.cos(u)*(1-t*t)/Math.tanh(c))<1e-12);
      assert.ok(Math.abs(law.derivative)<=f.peakSlope+1e-12);
    }
    assert.ok(100/curvature>9,'the U-shaped reversals must stay broad');
    t.diagnostic(JSON.stringify({minimumPitchRadiusPixels:100/curvature,compiledVertices:vertices,solids:11,contactGeometries:p.model.ngeom}));
  }finally{v.dispose();}
});

test('107 ten turns drive snaking strokes through both walls without losing the guides',t=>{
  const v=makeMujocoSerpentineCam(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  const names=new Map();for(const [name,cells] of Object.entries(u.collision))for(let i=0;i<cells.length;i++)names.set(p.id('mjOBJ_GEOM',name+i),name);
  const contacts={leftLand:0,rightLand:0};let deviation=0,penetration=0,visiblePenetration=0,retention=Infinity,checks=0,poses=0,speedError=0,previous;
  const halfAngle=Math.PI/f.repetitions,turn=2*halfAngle;let strokes=0,lastSign=0;
  const cycle=Math.round(p.description.options.period/p.timestep),window=Math.round(.1/p.timestep);
  try {
    for(let i=0;i<=10*cycle;i++) {
      if(i)p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      deviation=Math.max(deviation,Math.abs(error(v)));
      const q=p.data.qpos[1],a=((f.phase-p.data.qpos[0])%turn+turn)%turn,sign=a<halfAngle?1:-1;
      if(lastSign&&sign!==lastSign)strokes++;lastSign=sign;
      for(const side of ['left','right'])retention=Math.min(retention,Math.min(f.x(u.source.rodEnds[1])+q,f.x(u.source.edges[side+'GuideRight']))-Math.max(f.x(u.source.rodEnds[0])+q,f.x(u.source.edges[side+'GuideLeft'])));
      if(i%window===0) {
        // Mean follower speed over each window against the groove law's
        // displacement, normalized by the harmonic peak speed.
        const law=f.law(-p.data.qpos[0]).x;
        if(previous)speedError=Math.max(speedError,Math.abs((q-previous.x)/.1-(law-previous.law)/.1)/Math.abs(p.description.omega*f.peakSlope));
        previous={x:q,law};
      }
      const cs=p.data.contact;
      for(let j=0;j<cs.size();j++){const c=cs.get(j),name=names.get(c.geom1)??names.get(c.geom2);assert.ok(name);contacts[name]++;penetration=Math.max(penetration,-c.dist);c.delete();}cs.delete();
      if(i<=cycle/f.repetitions&&i%Math.round(cycle/f.repetitions/32)===0||i<=cycle&&i%Math.round(cycle/f.repetitions)===0) {
        v.sync();const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;assert.deepEqual(a.topologyIssues,[]);
        for(const issue of a.issues){assert.ok([issue.from,issue.to].includes('shoe')&&[issue.from,issue.to].some(n=>['leftLand','rightLand'].includes(n)),JSON.stringify(issue));visiblePenetration=Math.max(visiblePenetration,-issue.gap);}
        for(const mesh of Object.values(u.parts)){const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);}
      }
      if(i&&i%cycle===0){assert.ok(p.data.qpos[0]<-i/cycle*2*Math.PI+.01,'input stalled');assert.ok(Math.abs(q)<.002,'follower did not complete a cycle');}
    }
    t.diagnostic(JSON.stringify({halfStrokes:strokes,errorPixels:100*deviation,speedErrorPercent:100*speedError,nativePenetrationPixels:100*penetration,
      visiblePenetrationPixels:100*visiblePenetration,guideRetentionPixels:100*retention,contacts,checks,poses}));
    assert.ok(deviation*100<.15);assert.ok(speedError<.05);assert.ok(penetration*100<.03);assert.ok(visiblePenetration*100<.02);
    assert.ok(retention>.07);assert.ok(contacts.leftLand>1000&&contacts.rightLand>1000);assert.equal(strokes,20*f.repetitions);
  }finally{v.dispose();}
});

test('107 follower is passive under either load and playback reset is deterministic',()=>{
  const v=makeMujocoSerpentineCam(mujoco),p=v.physics;
  try {
    v.update(2);const state=[...p.data.qpos,...p.data.qvel];
    v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.reset();p.model.opt.gravity.fill(0);p.data.qvel[1]=0;const shoe=p.id('mjOBJ_GEOM','shoe');p.model.geom_contype[shoe]=0;p.model.geom_conaffinity[shoe]=0;
    v.update(4);assert.ok(Math.abs(p.data.qpos[1])<1e-10);assert.ok(p.data.qpos[0]<-1);
  }finally{v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  for(const load of [-1,1]) {
    const v=makeMujocoSerpentineCam(mujoco,{load});try{for(let i=1;i<=160;i++){v.update(i/20);assert.ok(Math.abs(error(v))*100<.3);}}finally{v.dispose();}
  }
});

test('107 two output cycles retain the stroke under timestep and groove refinement',t=>{
  const variants=[{}, {timestep:.00025}, {timestep:.000125}, {resolution:48}].map(o=>makeMujocoSerpentineCam(mujoco,o));
  let first=0,second=0,mesh=0;
  try {
    // Exact mesh repetition makes two output cycles cover the complete local
    // contact sequence; the ten-revolution test separately checks long playback.
    const steps=Math.round(2*variants[0].physics.description.options.period/variants[0].root.userData.profile.repetitions/variants[0].physics.timestep);
    for(let i=0;i<steps;i++) {
      variants[0].physics.step();for(let j=0;j<2;j++)variants[1].physics.step();for(let j=0;j<4;j++)variants[2].physics.step();variants[3].physics.step();
      const [a,b,c,d]=variants.map(v=>v.physics.data.qpos[1]);first=Math.max(first,Math.abs(a-b));second=Math.max(second,Math.abs(b-c));mesh=Math.max(mesh,Math.abs(a-d));
    }
    t.diagnostic(JSON.stringify({timestepDifferencePixels:100*first,refinedDifferencePixels:100*second,meshDifferencePixels:100*mesh}));
    assert.ok(first*100<.2);assert.ok(second<first);assert.ok(mesh*100<.2);
  }finally{for(const v of variants)v.dispose();}
});
