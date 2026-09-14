import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBowDrillGeometry} from '../src/simulation/mujoco-bow-drill/geometry.js';
import {makeMujocoBowDrill} from '../src/simulation/mujoco-bow-drill/visual.js';
import {makeBowDrillContactAudit} from '../scripts/lib/bow-drill-contact-audit.mjs';
import {cordSegmentDistance,cordSelfClearance} from '../scripts/lib/bow-drill-cord-distance.mjs';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const mujoco=await loadMujoco();

test('124 has closed finite parts, a clear full wrap and attached bindings',()=>{
  const v=makeBowDrillGeometry(),u=v.root.userData,f=u.profile;
  try {
    assert.equal(Object.keys(u.parts).length,13);assert(u.hideGround);
    for(const [name,part] of Object.entries(u.parts)) {
      const r=inspectWeightedClutchSolid(part.geometry);
      assert(r.volume>0,name);assert.equal(r.components,1,name);
      assert.equal(r.unmatchedEdges+r.degenerate+r.wrongNormals+r.nonfinite,0,name);
    }
    assert(f.cordPath.sweep>6&&f.cordPath.sweep<6.5);
    assert(Math.abs(f.cordPath.exit[2]-f.cordPath.entry[2])>2*f.cordRadius);
    // Test the actual straight section chords, including those around the drum.
    for(let i=1;i<f.cordPath.points.length;i++) {
      const a=f.cordPath.points[i-1],b=f.cordPath.points[i],dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy)));
      assert(Math.hypot(a[0]+t*dx,a[1]+t*dy)-f.cordRadius>=f.drumRadius-1e-10);
    }
    for(const [name,anchor] of [['lowerBindingLead',f.lower],['upperBindingLead',f.upper]]) {
      u.parts[name].geometry.computeBoundingBox();assert(u.parts[name].geometry.boundingBox.containsPoint(new THREE.Vector3(...anchor)),name);
    }
    assert(Math.abs(f.pitchRadius-.3792138517)<1e-8);
    assert.equal(200*f.cordRadius,4.3);
    for(const points of Object.values(f.bindingPoints)) {
      const clearance=cordSelfClearance(points.slice(1).map((p,i)=>[points[i],p]),f.cordRadius,{excludedArc:.07});
      assert(clearance.gap>.01,'separate binding turns and loose ends');
    }
  }finally{disposeObject3D(v.root);}
});

test('124 uses native rotating cord sections and only a bow actuator',()=>{
  const v=makeMujocoBowDrill(mujoco),p=v.physics;
  try {
    assert.equal(p.model.nu,1);assert.equal(p.model.nflex,0);assert.equal(p.model.neq,97);assert.equal(p.model.ntendon,0);
    assert.equal(p.model.nv,579);assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','drive'));
    assert.equal(p.description.cordDensity,p.description.density);
    assert(Math.abs(p.model.body_mass[p.bodies.spindle]-p.description.masses.spindle.volume*p.description.density)<1e-10);
    assert.equal(v.root.userData.reconstructionStatus,'verified');
  }finally{v.dispose();}
});

test('124 transmits three cycles at the cord pitch radius through native friction',t=>{
  const v=makeMujocoBowDrill(mujoco),p=v.physics,j=p.joints,audit=makeBowDrillContactAudit(p);
  let penetration=0,closure=0,pinError=0,inputError=0,force=0,slip=0,centerSlip=0,torqueResidual=0,selfGap=Infinity;
  const reversals=[];
  try {
    const steps=Math.round(12.25/p.timestep),second=Math.round(1/p.timestep);
    for(let i=1;i<=steps;i++) {
      p.step();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      assert(Math.abs(p.data.time-i*p.timestep)<1e-8);assert.equal(p.data.qfrc_actuator[j.spin.v],0);
      inputError=Math.max(inputError,Math.abs(p.data.qpos[j.drive.q]-p.description.input(p.data.time).position));
      if(i%10===0) {
        mujoco.mj_forward(p.model,p.data);const a=audit.sample();
        penetration=Math.max(penetration,a.penetration);closure=Math.max(closure,a.closure);pinError=Math.max(pinError,a.pinError);
        torqueResidual=Math.max(torqueResidual,Math.abs(a.torqueResidual));
        selfGap=Math.min(selfGap,a.self.gap);
        if(i>=second){force+=a.normalForce;slip+=a.slipSquared;centerSlip+=a.centerSlipSquared;}
      }
      if(i%second===0&&(i/second)%2===1)reversals.push(p.data.qpos[j.spin.q]);
    }
    assert.equal(reversals.length,6);reversals.forEach((q,i)=>assert(i%2?q>2.2:q< -2.2));
    const expectedTravel=2*v.root.userData.profile.amplitude/v.root.userData.profile.pitchRadius;
    for(let i=1;i<reversals.length;i++)assert(Math.abs(Math.abs(reversals[i]-reversals[i-1])/expectedTravel-1)<.01);
    assert(penetration<.0008);assert(closure<.0001);assert(pinError<.0001);assert(inputError<.005);assert(selfGap>.005);
    const surfaceSlip=Math.sqrt(slip/force),translationOnlySlip=Math.sqrt(centerSlip/force);
    assert(surfaceSlip<.01);assert(translationOnlySlip>3*surfaceSlip);assert(torqueResidual<1e-10);
    t.diagnostic(JSON.stringify({reversals,penetrationPixels:100*penetration,closurePixels:100*closure,
      pinErrorPixels:100*pinError,inputErrorPixels:100*inputError,selfGapPixels:100*selfGap,surfaceSlip,translationOnlySlip,torqueResidual}));
  }finally{audit.dispose();v.dispose();}
});

test('124 removing cord friction removes spindle transmission',()=>{
  const v=makeMujocoBowDrill(mujoco,{friction:0}),p=v.physics;
  try {
    v.update(1);assert(Math.abs(p.data.qpos[p.joints.drive.q])>.85);
    // Tight CCD leaves a small numerical normal-force torque on the cylinder.
    assert(Math.abs(p.data.qpos[p.joints.spin.q])<1e-5);
  }finally{v.dispose();}
});

test('124 visible cord attachments follow native pins, seeking and restart',()=>{
  const v=makeMujocoBowDrill(mujoco),u=v.root.userData,p=v.physics;
  try {
    const initial=Array.from(p.data.qpos);
    for(const time of [1,3,8]) {
      v.update(time);const points=p.getCordPoints();
      for(const [name,anchor,id] of [['lowerBindingLead',u.profile.lower,0],['upperBindingLead',u.profile.upper,u.profile.cordSegments]]) {
        const a=u.parts[name].localToWorld(new THREE.Vector3(...anchor)),b=new THREE.Vector3(...points[id]);
        assert(a.distanceTo(b)<.0001,name);
      }
      const audit=inspectWeightedClutchSolid(u.parts.initialCord.geometry);
      assert.equal(audit.unmatchedEdges+audit.degenerate+audit.wrongNormals+audit.nonfinite,0);
    }
    v.update(1);const first=Array.from(p.data.qpos);v.reset();assert.deepEqual(Array.from(p.data.qpos),initial);
    for(let i=1;i<=10;i++)v.update(i/10);assert.deepEqual(Array.from(p.data.qpos),first);
    u.setSectionView(true);assert.equal(u.parts.frontFlange.visible,false);u.setSectionView(false);assert.equal(u.parts.frontFlange.visible,true);
  }finally{v.dispose();v.dispose();}
  assert(p.disposed);
});

test('124 rejects a cord mesh whose nonadjacent finite sections start overlapped',()=>{
  assert.throws(()=>makeMujocoBowDrill(mujoco,{cordSegments:256}),/too short/);
});

test('124 native dry resistance dissipates work while the cord still reverses the spindle',t=>{
  const v=makeMujocoBowDrill(mujoco,{resistance:.25}),p=v.physics,audit=makeBowDrillContactAudit(p);
  let work=0,minimum=0,maximum=0,residual=0;
  try {
    assert.equal(p.model.dof_frictionloss[p.joints.spin.v],.25);
    for(let i=1;i<=4250;i++) {
      p.step();assert(Math.abs(p.data.time-i*p.timestep)<1e-8);
      const q=p.data.qpos[p.joints.spin.q];minimum=Math.min(minimum,q);maximum=Math.max(maximum,q);
      if(i%10===0){mujoco.mj_forward(p.model,p.data);const a=audit.sample();
        assert(Math.abs(a.resistanceTorque)<=.25+1e-10);residual=Math.max(residual,Math.abs(a.torqueResidual));
        work+=a.resistanceTorque*p.data.qvel[p.joints.spin.v]*.01;
      }
    }
    assert(minimum< -2.2&&maximum>2.2);assert(work< -2);assert(residual<1e-10);
    t.diagnostic(JSON.stringify({minimum,maximum,sampledResistanceWork:work,torqueResidual:residual}));
  }finally{audit.dispose();v.dispose();}
});

test('124 clearance audit resolves crossing, skew, parallel and degenerate segments',()=>{
  assert.equal(cordSegmentDistance([0,0,0],[1,0,0],[.5,-1,0],[.5,1,0]),0);
  assert.equal(cordSegmentDistance([0,0,0],[1,0,0],[.5,-1,1],[.5,1,1]),1);
  assert.equal(cordSegmentDistance([0,0,0],[1,0,0],[0,1,0],[1,1,0]),1);
  assert.equal(cordSegmentDistance([0,0,0],[1,0,0],[2,0,0],[3,0,0]),1);
  assert.equal(cordSegmentDistance([0,0,0],[0,0,0],[1,-1,0],[1,1,0]),1);
  assert.equal(cordSegmentDistance([0,0,0],[0,0,0],[1,0,0],[1,0,0]),1);
});
