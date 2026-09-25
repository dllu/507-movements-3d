import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoEccentricYoke} from '../src/simulation/mujoco-eccentric-yoke/visual.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {nativePlateContours,signedArea} from '../scripts/lib/weighted-clutch-native-contours.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';

const mujoco = await loadMujoco();

test('090 collider faces coincide with the solid, and the omitted opening clears the complete circular sweep', t => {
  const v=makeMujocoEccentricYoke(mujoco), u=v.root.userData, g=u.geometry;
  const distance=(p,a,b)=>{
    const dx=b[0]-a[0],dy=b[1]-a[1],denominator=dx*dx+dy*dy;
    const f=denominator?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/denominator)):0;
    return Math.hypot(p[0]-a[0]-f*dx,p[1]-a[1]-f*dy);
  };
  try {
    assert.equal(v.physics.model.ngeom,3);assert.equal(v.physics.model.nflex,0);
    const contours=nativePlateContours(u.parts.yoke.geometry).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));
    assert.equal(contours.length,2);
    const hole=contours[1],lower=[0,-g.eccentricity],upper=[0,g.eccentricity];
    let gap=Infinity;
    for(let i=0;i<hole.length;i++) {
      const a=hole[i],b=hole[(i+1)%hole.length];
      if(a[0]*b[0]<=0&&a[0]!==b[0]) {
        const y=a[1]-a[0]*(b[1]-a[1])/(b[0]-a[0]);
        assert.ok(Math.abs(y)>g.eccentricity,'a hole edge crosses the swept center segment');
      }
      gap=Math.min(gap,distance(a,lower,upper),distance(b,lower,upper),distance(lower,a,b),distance(upper,a,b));
    }
    // Segment-to-boundary distance verifies the whole swept circle, rather
    // than checking only selected angles or using the collider's own radius.
    assert.ok(gap-g.radius>.0009);
    const surface=solidSurface(u.parts.yoke.geometry),point=new THREE.Vector3();
    for(const sign of [-1,1])for(let i=0;i<=100;i++) {
      const y=(2*i/100-1)*g.workingHalfHeight;
      point.set(sign*(g.radius+g.clearance),y,0);
      assert.ok(surface.distance(point)<1e-6,'a collision plane differs from the visible face');
      point.x+=sign*v.physics.description.wallHalfThickness;
      assert.ok(surface.inside(point),'a contact box protrudes through the yoke');
    }
    t.diagnostic('Continuous swept-circle clearance in source pixels: '+(gap-g.radius)*100);
  } finally {v.dispose();}
});

test('090 is a passive contact-driven slider with deterministic restart and independent instances', () => {
  const v = makeMujocoEccentricYoke(mujoco), p = v.physics;
  const other = makeMujocoEccentricYoke(mujoco);
  try {
    assert.equal(p.model.nq,2); assert.equal(p.model.nu,1);
    assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','input'));
    v.update(2); assert.ok(p.data.qpos[1]<-.45,'contact must drive the return stroke');
    const expected = [...p.data.qpos,...p.data.qvel];
    v.reset(); for(let i=1;i<=120;i++)v.update(i/60);
    assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
    v.update(.2);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
    assert.equal(other.physics.data.time,0);

    // Removing the only collision pair must remove output motion. An imposed
    // cosine or equality coupling would fail this counterfactual check.
    v.reset(); p.model.geom_contype[0]=0;p.model.geom_conaffinity[0]=0;
    p.data.qpos[p.joints.yoke.q]=.2;p.data.qvel[p.joints.yoke.v]=0;
    v.update(2);
    assert.ok(Math.abs(p.data.qpos[1]-.2)<1e-12);
    assert.ok(p.data.qpos[0]<-3);
  } finally {v.dispose();v.dispose();other.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
});

test('090 finite solids, running clearances and complete camera envelope hold through a cycle', t => {
  const v = makeMujocoEccentricYoke(mujoco), u = v.root.userData, g = u.geometry;
  let penetration=0, checks=0;
  try {
    for(const time of [0,.5,1,1.5,2,2.5,3,3.5,4]) {
      v.update(time);
      const audit = auditClutchSourceSolids(v);
      assert.deepEqual(audit.topologyIssues,[]);
      for(const issue of audit.issues) {
        assert.ok([issue.from,issue.to].every(n=>['sheave','yoke'].includes(n)),JSON.stringify(issue));
        penetration=Math.max(penetration,-issue.gap);
      }
      checks+=audit.checks;
      const x = u.state.yokePosition;
      assert.ok(x+g.rodRoots[1]<g.guideCenter-g.guideHalfLength-.06);
      assert.ok(x+g.rodRoots[0]>-g.guideCenter+g.guideHalfLength+.06);
      assert.ok(x+g.rodEnd>g.guideCenter+g.guideHalfLength+.025);
      assert.ok(x-g.rodEnd<-g.guideCenter-g.guideHalfLength-.025);
      // Rod runs and guides past Brown's crop are deliberately outside the fit.
      for(const mesh of Object.values(u.parts).filter(m=>!m.userData.beyondPlateCrop)) {
        const p=mesh.geometry.attributes.position;
        for(let i=0;i<p.count;i++)assert.ok(u.cameraFitBounds.containsPoint(
          new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld)),mesh.name+' leaves camera bounds');
      }
    }
    t.diagnostic(JSON.stringify({surfaceChecks:checks,maximumSampledPenetrationPixels:penetration*100}));
    assert.ok(penetration*100<.1);
    assert.equal(u.hideGround,true);
    assert.equal(u.animationTiming.displayCycleDuration,4);
  } finally {v.dispose();}
});

test('090 native contact stays stable for ten turns within a quarter-pixel timestep tolerance', t => {
  const coarse = makeMujocoEccentricYoke(mujoco), fine = makeMujocoEccentricYoke(mujoco,{timestep:.0005});
  let difference=0, penetration=0, cosineError=0, active=0;
  try {
    for(let i=1;i<=40000;i++) {
      coarse.physics.step(); fine.physics.step();fine.physics.step();
      const p=coarse.physics, q=p.data.qpos, r=fine.physics.data.qpos, g=coarse.root.userData.geometry;
      assert.ok([...q,...r,...p.data.qvel,...fine.physics.data.qvel].every(Number.isFinite));
      difference=Math.max(difference,Math.abs(q[1]-r[1]));
      cosineError=Math.max(cosineError,Math.abs(q[1]-g.offset[0]*Math.cos(q[0])+g.offset[1]*Math.sin(q[0])));
      if(p.data.ncon) {
        active++;
        const contacts=p.data.contact;
        for(let j=0;j<contacts.size();j++){const c=contacts.get(j);penetration=Math.max(penetration,-c.dist);c.delete();}
        contacts.delete();
      }
    }
    t.diagnostic(JSON.stringify({maximumTimestepDifferencePixels:difference*100,maximumPenetrationPixels:penetration*100,
      maximumCosineDifferencePixels:cosineError*100,contactSteps:active}));
    assert.ok(active>100);
    // Brief contact timing varies under refinement. Bound visible positional
    // sensitivity below a quarter source pixel, not an exact impact trajectory.
    assert.ok(difference*100<.25);
    assert.ok(penetration*100<.1);
    assert.ok(cosineError*100<1);
  } finally {coarse.dispose();fine.dispose();}
});
