import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoVariableCrank} from '../src/simulation/mujoco-variable-crank/visual.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';

const mujoco=await loadMujoco();

test('094 working strips coincide with the finite spiral and the bolt stays within its radial slot',()=>{
  const v=makeMujocoVariableCrank(mujoco),p=v.physics,u=v.root.userData,g=u.geometry;
  try {
    assert.equal(p.model.ngeom,2*g.wallSegmentCount+1);assert.equal(p.model.neq,0);
    const bolt=p.id('mjOBJ_GEOM','bolt'),radius=p.model.geom_size[3*bolt],halfLength=p.model.geom_size[3*bolt+1],z=p.model.geom_pos[3*bolt+2];
    assert.equal(p.model.geom_type[bolt],mujoco.mjtGeom.mjGEOM_CAPSULE.value);
    assert.ok(Math.abs(radius-g.neckRadius)<1e-12);assert.ok(g.neckRadius<g.boltRadius);
    const boltBounds=new THREE.Box3();
    for(const name of ['bolt','boltNeck']){u.parts[name].geometry.computeBoundingBox();boltBounds.union(u.parts[name].geometry.boundingBox);}
    assert.ok(z-halfLength-radius>boltBounds.min.z);assert.ok(z+halfLength+radius<boltBounds.max.z);
    const surface=solidSurface(u.parts.spiralPlate.geometry),point=new THREE.Vector3();
    for(let i=0;i<u.wallPieces.length;i++) {
      const [a,b,c,d]=u.wallPieces[i];
      point.set((a[0]+b[0])/2,(a[1]+b[1])/2,-.09);
      assert.ok(surface.distance(point)<1e-6,'a collider face differs from the visible groove');
      point.set((a[0]+b[0]+c[0]+d[0])/4,(a[1]+b[1]+c[1]+d[1])/4,-.09);
      assert.ok(surface.inside(point),'a collision strip protrudes into an opening');
    }
    // Bound the derivative between samples by its global Lipschitz constant.
    // This proves monotone travel across the selected adjustment range.
    const [lo,hi]=p.description.range,[,,c,d,e]=u.source.spiral.map(x=>x/100);
    const derivativeLipschitz=2*Math.abs(c)+Math.abs(d)+Math.abs(e),step=.01;
    for(let t=lo;t<=hi;t+=step)assert.ok(u.derivative(t)+derivativeLipschitz*step<0);
    const slot=g.slots[u.source.selectedSlot],allowance=.002;
    assert.ok(u.radius(hi)-allowance>slot.ends[0]+.02);
    assert.ok(u.radius(lo)+allowance<slot.ends[1]-.02);
    assert.ok(u.radius(hi)-allowance-u.source.boltHeadRadius/100>g.hubRadius+.1);
    assert.ok(lo-u.source.spiralEnds[0]>1);assert.ok(u.source.spiralEnds[1]-hi>.9);
  } finally {v.dispose();}
});

test('094 moves a passive bolt through contact and restarts independently of render frames',()=>{
  const v=makeMujocoVariableCrank(mujoco),p=v.physics,u=v.root.userData,g=u.geometry;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);
    assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','input'));
    v.update(3);assert.ok(p.data.qpos[1]<.8);
    const expected=[...p.data.qpos,...p.data.qvel];v.reset();
    for(let i=1;i<=180;i++)v.update(i/60);
    assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
    v.update(.5);v.update(3);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);

    // With the only collision pair removed, gravity pulls the passive bolt
    // outward, rather than continuing the programmed inward adjustment.
    v.reset();const bolt=p.id('mjOBJ_GEOM','bolt');p.model.geom_contype[bolt]=0;p.model.geom_conaffinity[bolt]=0;
    p.data.qvel[1]=0;const initial=p.data.qpos[1];v.update(.25);
    assert.ok(p.data.qpos[1]>initial+.15);
    assert.ok(Math.abs(p.data.qpos[1]-u.radius(g.pinAngle-p.data.qpos[0]))>.2);
  } finally {v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
});

test('094 ten adjustments preserve finite bolt engagement, hardware clearance and camera bounds',t=>{
  const v=makeMujocoVariableCrank(mujoco),p=v.physics,u=v.root.userData,g=u.geometry;
  let error=0,penetration=0,solidPenetration=0,checks=0,poses=0,contactSteps=0;
  const contactSides=new Set();
  try {
    for(let i=0;i<=80000;i++) {
      if(i)p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      error=Math.max(error,Math.abs(p.data.qpos[1]-u.radius(g.pinAngle-p.data.qpos[0])));
      mujoco.mj_forward(p.model,p.data);
      if(p.data.ncon) {
        contactSteps++;const contacts=p.data.contact;
        for(let j=0;j<contacts.size();j++) {
          const c=contacts.get(j);penetration=Math.max(penetration,-c.dist);
          const wall=Math.min(...c.geom);contactSides.add(wall<g.wallSegmentCount?'inner':'outer');c.delete();
        }
        contacts.delete();
      }
      if(i<=8000&&i%250===0) {
        v.sync();const audit=auditClutchSourceSolids(v);checks+=audit.checks;poses++;
        assert.deepEqual(audit.topologyIssues,[]);
        for(const issue of audit.issues) {
          assert.ok([issue.from,issue.to].every(n=>['boltNeck','spiralPlate'].includes(n)),JSON.stringify(issue));
          solidPenetration=Math.max(solidPenetration,-issue.gap);
        }
        for(const mesh of Object.values(u.parts)) {
          const pos=mesh.geometry.attributes.position;
          for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);
        }
      }
    }
    t.diagnostic(JSON.stringify({maximumRadiusErrorPixels:error*100,maximumNativePenetrationPixels:penetration*100,
      maximumSampledPenetrationPixels:solidPenetration*100,contactSteps,contactSides:[...contactSides],poses,surfaceChecks:checks}));
    assert.ok(contactSteps>10000);assert.deepEqual([...contactSides].sort(),['inner','outer']);
    assert.ok(error*100<.1);assert.ok(penetration*100<.1);assert.ok(solidPenetration*100<.1);
    assert.equal(u.hideGround,true);assert.equal(u.animationTiming.displayCycleDuration,8);
  } finally {v.dispose();}
});

test('094 timestep and spiral chord refinement stay within a tenth source pixel over ten adjustments',t=>{
  const coarse=makeMujocoVariableCrank(mujoco),fine=makeMujocoVariableCrank(mujoco,{timestep:.0005}),
    finer=makeMujocoVariableCrank(mujoco,{timestep:.00025}),denser=makeMujocoVariableCrank(mujoco,{segments:768});
  let difference=0,refined=0,chord=0;
  try {
    for(let i=0;i<80000;i++) {
      coarse.physics.step();for(let j=0;j<2;j++)fine.physics.step();for(let j=0;j<4;j++)finer.physics.step();denser.physics.step();
      difference=Math.max(difference,Math.abs(coarse.physics.data.qpos[1]-fine.physics.data.qpos[1]));
      refined=Math.max(refined,Math.abs(fine.physics.data.qpos[1]-finer.physics.data.qpos[1]));
      chord=Math.max(chord,Math.abs(coarse.physics.data.qpos[1]-denser.physics.data.qpos[1]));
    }
    t.diagnostic(JSON.stringify({maximumTimestepDifferencePixels:difference*100,maximumRefinedDifferencePixels:refined*100,maximumChordDifferencePixels:chord*100}));
    assert.ok(difference*100<.1);assert.ok(refined<difference);assert.ok(chord*100<.1);
  } finally {coarse.dispose();fine.dispose();finer.dispose();denser.dispose();}
});
