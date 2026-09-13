import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoScotchYoke} from '../src/simulation/mujoco-scotch-yoke/visual.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';

const mujoco=await loadMujoco();

test('093 contact faces match the finite slot, and guides contain the complete stroke',()=>{
  const v=makeMujocoScotchYoke(mujoco),p=v.physics,u=v.root.userData,g=u.geometry;
  try {
    assert.equal(p.model.ngeom,3);assert.equal(p.model.neq,0);
    // The pin center never reaches either semicircular end. Its complete
    // horizontal sweep lies between the two ends of the straight faces.
    assert.ok(g.slotEnds[0]<-g.crankRadius-.1);assert.ok(g.slotEnds[1]>g.crankRadius+.1);
    const surface=solidSurface(u.parts.yoke.geometry),point=new THREE.Vector3();
    for(const [i,sign] of [1,-1].entries()) {
      const geom=p.id('mjOBJ_GEOM','face'+i),offset=geom*3;
      const workingY=p.model.geom_pos[offset+1]-sign*p.model.geom_size[offset+1];
      assert.ok(Math.abs(workingY-sign*g.slotRadius)<1e-10);
      for(let j=0;j<=100;j++) {
        const x=g.slotEnds[0]+(g.slotEnds[1]-g.slotEnds[0])*j/100;
        point.set(x,workingY,.36);assert.ok(surface.distance(point)<1e-6);
        point.y=(workingY+g.roots[i])/2;assert.ok(surface.inside(point),'collider must be inside visible yoke');
      }
    }
    // Include running clearance and a soft-contact allowance in this
    // continuous envelope, rather than relying on selected animation poses.
    const travel=g.crankRadius+g.clearance+.001;
    assert.ok(g.guideCenter-g.guideHalfLength-(g.roots[0]+travel)>.06);
    assert.ok(g.roots[1]-travel-(-g.guideCenter+g.guideHalfLength)>.06);
    assert.ok(g.stemEnd-travel-(g.guideCenter+g.guideHalfLength)>.03);
  } finally {v.dispose();}
});

test('093 is passive, responds to either slot face and restarts deterministically',()=>{
  const v=makeMujocoScotchYoke(mujoco),p=v.physics;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);
    assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','input'));
    v.update(2);const expected=[...p.data.qpos,...p.data.qvel];v.reset();
    for(let i=1;i<=120;i++)v.update(i/60);
    assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
    v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);

    // Reversing the applied load transfers contact to the lower face. This
    // is a response to dynamics, not a phase-selected output trajectory.
    v.reset();p.model.opt.gravity[1]=9.81;let lowerSteps=0;
    for(let tick=1;tick<=500;tick++) {
      v.update(tick*.001);const contacts=p.data.contact;let lower=false;
      for(let i=0;i<contacts.size();i++) {
        const c=contacts.get(i);lower||=[...c.geom].includes(p.id('mjOBJ_GEOM','face1'));c.delete();
      }
      contacts.delete();if(lower)lowerSteps++;
    }
    const g=v.root.userData.geometry;
    assert.ok(p.data.qpos[1]-g.crankRadius*Math.sin(p.data.qpos[0])>.0009);
    assert.ok(lowerSteps>100,'reversed load must press the lower working face');

    p.model.opt.gravity[1]=-9.81;v.reset();
    const wrist=p.id('mjOBJ_GEOM','wrist');p.model.geom_contype[wrist]=0;p.model.geom_conaffinity[wrist]=0;
    p.data.qvel[1]=0;const initial=p.data.qpos[1];v.update(.25);
    assert.ok(p.data.qpos[1]<initial-.2,'removing contact must let the passive yoke fall');
    assert.ok(Math.abs(p.data.qpos[1]-g.crankRadius*Math.sin(p.data.qpos[0]))>.05);
  } finally {v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
});

test('093 ten turns maintain pin engagement, finite solid clearance and camera bounds',t=>{
  const v=makeMujocoScotchYoke(mujoco),p=v.physics,u=v.root.userData,g=u.geometry;
  let positionError=0,penetration=0,solidPenetration=0,checks=0,poses=0,contactSteps=0;
  let separation=0,flightSteps=0,maximumFlightSteps=0;
  try {
    for(let i=0;i<=40000;i++) {
      if(i)p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      const [theta,y]=p.data.qpos;
      positionError=Math.max(positionError,Math.abs(y-g.crankRadius*Math.sin(theta)));
      mujoco.mj_forward(p.model,p.data);
      if(p.data.ncon) {
        contactSteps++;flightSteps=0;const contacts=p.data.contact;
        for(let j=0;j<contacts.size();j++){const c=contacts.get(j);penetration=Math.max(penetration,-c.dist);c.delete();}
        contacts.delete();
      } else {
        maximumFlightSteps=Math.max(maximumFlightSteps,++flightSteps);
        separation=Math.max(separation,g.clearance-Math.abs(y-g.crankRadius*Math.sin(theta)));
      }
      if(i<=4000&&i%125===0) {
        v.sync();const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;
        assert.deepEqual(a.topologyIssues,[]);
        for(const issue of a.issues) {
          assert.ok([issue.from,issue.to].every(n=>['wrist','yoke'].includes(n)),JSON.stringify(issue));
          solidPenetration=Math.max(solidPenetration,-issue.gap);
        }
        for(const mesh of Object.values(u.parts)) {
          const pos=mesh.geometry.attributes.position;
          for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);
        }
      }
    }
    // Soft contact can briefly release by a fraction of an ink pixel. Bound
    // both its separation and duration instead of requiring contact every tick.
    assert.ok(contactSteps>10000);assert.ok(positionError*100<.2);
    assert.ok(separation*100<.05);assert.ok(maximumFlightSteps*p.model.opt.timestep<.025);
    assert.ok(penetration*100<.1);assert.ok(solidPenetration*100<.1);
    assert.equal(u.hideGround,true);assert.equal(u.animationTiming.displayCycleDuration,4);
    t.diagnostic(JSON.stringify({maximumPinVerticalDifferencePixels:positionError*100,maximumNativePenetrationPixels:penetration*100,
      maximumSampledPenetrationPixels:solidPenetration*100,maximumSeparationPixels:separation*100,
      maximumContactReleaseSeconds:maximumFlightSteps*p.model.opt.timestep,contactSteps,poses,surfaceChecks:checks}));
  } finally {v.dispose();}
});

test('093 ten-turn timestep refinement agrees within a tenth source pixel',t=>{
  const coarse=makeMujocoScotchYoke(mujoco),fine=makeMujocoScotchYoke(mujoco,{timestep:.0005}),finer=makeMujocoScotchYoke(mujoco,{timestep:.00025});
  let difference=0,refined=0;
  try {
    for(let i=0;i<40000;i++) {
      coarse.physics.step();for(let j=0;j<2;j++)fine.physics.step();for(let j=0;j<4;j++)finer.physics.step();
      difference=Math.max(difference,Math.abs(coarse.physics.data.qpos[1]-fine.physics.data.qpos[1]));
      refined=Math.max(refined,Math.abs(fine.physics.data.qpos[1]-finer.physics.data.qpos[1]));
    }
    assert.ok(difference*100<.1);assert.ok(refined<difference);
    t.diagnostic(JSON.stringify({maximumTimestepDifferencePixels:difference*100,maximumRefinedDifferencePixels:refined*100}));
  } finally {coarse.dispose();fine.dispose();finer.dispose();}
});
