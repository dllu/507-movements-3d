import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {triangularEccentricProfile} from '../src/simulation/triangular-eccentric-profile.js';
import {makeMujocoTriangularEccentric} from '../src/simulation/mujoco-triangular-eccentric/visual.js';
import {triangularEccentricEnvelope} from '../src/simulation/mujoco-triangular-eccentric/envelope.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';

const mujoco=await loadMujoco();

test('091 four-arc cam has constant width, convex chords and two concentric dwells',()=>{
  const p=triangularEccentricProfile({width:1.44,smallRadius:.21}),tolerance=.00001,points=p.outline(tolerance);
  for(let i=0;i<points.length;i++){
    const [a,b,c]=[0,1,2].map(k=>points[(i+k)%points.length]);
    assert.ok((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>0);
  }
  for(let i=0;i<1440;i++) {
    const angle=i*2*Math.PI/1440,upper=p.extreme(angle).value,lower=p.extreme(angle,-1).value;
    assert.ok(Math.abs(upper-lower-p.width)<1e-12);
    const heights=points.map(([x,y])=>x*Math.sin(angle)+y*Math.cos(angle));
    assert.ok(upper-Math.max(...heights)<tolerance+1e-12);
    assert.ok(Math.min(...heights)-lower<tolerance+1e-12);
  }
  for(const offset of [-.9,-.5,0,.5,.9].map(x=>x*p.dwellHalfAngle)) {
    assert.ok(Math.abs((p.extreme(offset).value+p.extreme(offset,-1).value)/2-p.amplitude)<1e-12);
    assert.ok(Math.abs((p.extreme(Math.PI+offset).value+p.extreme(Math.PI+offset,-1).value)/2+p.amplitude)<1e-12);
  }
  assert.throws(()=>triangularEccentricProfile({width:1,smallRadius:.6}),RangeError);
});

test('091 passive output depends on contact and has deterministic playback and restart',()=>{
  const v=makeMujocoTriangularEccentric(mujoco),p=v.physics;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.ngeom,3);
    assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','input'));
    assert.ok(Math.abs(p.data.qvel[p.joints.yoke.v])<1e-7,'initial gravity settling must finish');
    v.update(2);assert.ok(p.data.qpos[1]<-.50);
    const expected=[...p.data.qpos,...p.data.qvel];v.reset();
    for(let i=1;i<=120;i++)v.update(i/60);
    assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
    v.update(.2);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
    v.reset();p.model.geom_contype[0]=0;p.model.geom_conaffinity[0]=0;
    const initial=p.data.qpos[1];v.update(.25);
    assert.ok(p.data.qpos[1]<initial-.2,'without cam contact the unsupported yoke must fall under gravity');
  } finally {v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
});

test('091 clearance envelope contains exact cam arcs between its construction samples',()=>{
  const profile=triangularEccentricProfile({width:1.436137580871582,smallRadius:.2090864372253418});
  const envelope=triangularEccentricEnvelope(profile),p=envelope.boundary;
  const planes=p.map((a,i)=>{
    const b=p[(i+1)%p.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const nx=(b[1]-a[1])/length,ny=(a[0]-b[0])/length;
    return {ny,angle:Math.atan2(ny,nx),limit:nx*a[0]+ny*a[1]};
  });
  for(let i=0;i<512;i++) {
    const angle=(i+1/3)*2*Math.PI/512,center=(profile.extreme(angle).value+profile.extreme(angle,-1).value)/2;
    for(const plane of planes) {
      const support=profile.extreme(angle+Math.PI/2-plane.angle).value-center*plane.ny;
      assert.ok(plane.limit-support>=envelope.runningAllowance-1e-9);
    }
  }
});

test('091 native contact preserves stroke, dwell and clearances for ten turns',t=>{
  const v=makeMujocoTriangularEccentric(mujoco),u=v.root.userData,p=v.physics,g=u.geometry;
  let error=0,penetration=0,checks=0,solidPenetration=0,maximumDwellSpan=0;
  const dwells=new Map();
  try {
    for(let i=0;i<=40000;i++) {
      if(i)p.step();const [angle,y]=p.data.qpos;
      assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      const upper=u.profile.extreme(angle).value,lower=u.profile.extreme(angle,-1).value;
      error=Math.max(error,Math.abs(y-(upper+lower)/2));
      const halfTurn=Math.round(angle/Math.PI),dwellAngle=angle-halfTurn*Math.PI;
      if(Math.abs(dwellAngle)<u.profile.dwellHalfAngle-.08) {
        const values=dwells.get(halfTurn)??[Infinity,-Infinity];
        values[0]=Math.min(values[0],y);values[1]=Math.max(values[1],y);dwells.set(halfTurn,values);
      }
      const contacts=p.data.contact;
      for(let j=0;j<contacts.size();j++){const c=contacts.get(j);penetration=Math.max(penetration,-c.dist);c.delete();}
      contacts.delete();
      if(i%250===0) {
        assert.ok(y+g.rodRoots[0]<g.guideCenter-g.guideHalfLength-.06);
        assert.ok(y+g.rodRoots[1]>-g.guideCenter+g.guideHalfLength+.06);
        // Each rod end stays at least half-way into its guide bore.
        assert.ok(y+g.rodEnd>g.guideCenter-1e-3);
        assert.ok(y-g.rodEnd<-g.guideCenter+1e-3);
      }
      if(i<=4000&&i%250===0) {
        v.sync();const audit=auditClutchSourceSolids(v);assert.deepEqual(audit.topologyIssues,[]);checks+=audit.checks;
        for(const issue of audit.issues){assert.ok([issue.from,issue.to].every(n=>['cam','liner0','liner1'].includes(n)),JSON.stringify(issue));solidPenetration=Math.max(solidPenetration,-issue.gap);}
        // Rod runs and guides past Brown's crop are deliberately outside the fit.
        for(const mesh of Object.values(u.parts).filter(m=>!m.userData.beyondPlateCrop)) {
          const pos=mesh.geometry.attributes.position;
          for(let k=0;k<pos.count;k++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,k).applyMatrix4(mesh.matrixWorld)),mesh.name+' leaves bounds');
        }
      }
    }
    for(const [low,high] of dwells.values())maximumDwellSpan=Math.max(maximumDwellSpan,high-low);
    t.diagnostic(JSON.stringify({maximumSupportDifferencePixels:error*100,maximumNativePenetrationPixels:penetration*100,
      surfaceChecks:checks,maximumSolidPenetrationPixels:solidPenetration*100,maximumDwellSpanPixels:maximumDwellSpan*100}));
    assert.ok(error*100<.2);assert.ok(penetration*100<.1);assert.ok(solidPenetration*100<.1);
    assert.ok(maximumDwellSpan*100<.05);assert.ok(dwells.size>=20);
  } finally {v.dispose();}
});

test('091 motion stays within a tenth source pixel under timestep and cam chord refinement',t=>{
  const coarse=makeMujocoTriangularEccentric(mujoco),fine=makeMujocoTriangularEccentric(mujoco,{timestep:.0005});
  const geometry=makeMujocoTriangularEccentric(mujoco,{chordTolerance:.0000025});
  let timeDifference=0,geometryDifference=0;
  try {
    for(let i=0;i<40000;i++) {
      coarse.physics.step();fine.physics.step();fine.physics.step();geometry.physics.step();
      timeDifference=Math.max(timeDifference,Math.abs(coarse.physics.data.qpos[1]-fine.physics.data.qpos[1]));
      geometryDifference=Math.max(geometryDifference,Math.abs(coarse.physics.data.qpos[1]-geometry.physics.data.qpos[1]));
    }
    t.diagnostic(JSON.stringify({maximumTimestepDifferencePixels:timeDifference*100,maximumGeometryDifferencePixels:geometryDifference*100}));
    assert.ok(timeDifference*100<.1);assert.ok(geometryDifference*100<.1);
  } finally {coarse.dispose();fine.dispose();geometry.dispose();}
});
