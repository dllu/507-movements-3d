import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBowDrillGeometry} from '../src/simulation/mujoco-bow-drill/geometry.js';
import {makeMujocoBowDrill} from '../src/simulation/mujoco-bow-drill/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const mujoco=await loadMujoco();

test('124 candidate has closed finite parts, a separated full wrap and attached bindings',()=>{
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
    for(const [name,anchor] of [['lowerBindingLead',f.lower],['upperBindingLead',f.upper]]) {
      u.parts[name].geometry.computeBoundingBox();assert(u.parts[name].geometry.boundingBox.containsPoint(new THREE.Vector3(...anchor)),name);
    }
    assert(Math.abs(f.pitchRadius-.3792138517)<1e-8);
  }finally{disposeObject3D(v.root);}
});

test('124 uses only a bow actuator and native finite flex contact for the spindle',()=>{
  const v=makeMujocoBowDrill(mujoco),p=v.physics;
  try {
    assert.equal(p.model.nu,1);assert.equal(p.model.nflex,1);assert.equal(p.model.neq,1);assert.equal(p.model.ntendon,0);
    assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','drive'));
    assert.equal(p.model.flex_dim[0],1);assert.equal(p.model.flex_edgenum[0],96);
    assert.equal(p.description.cordDensity,p.description.density);
    assert(Math.abs(p.model.body_mass[p.bodies.spindle]-p.description.masses.spindle.volume*p.description.density)<1e-10);
    assert.equal(v.root.userData.reconstructionStatus,'under-review');
  }finally{v.dispose();}
});

test('124 maintains alternating friction-driven spindle motion for three native cycles',t=>{
  const v=makeMujocoBowDrill(mujoco),p=v.physics,j=p.joints;let penetration=0,strain=0,inputError=0;
  const reversals=[];
  try {
    for(let i=0;i<6125;i++) {
      p.step();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-8);assert.equal(p.data.qfrc_actuator[j.spin.v],0);
      inputError=Math.max(inputError,Math.abs(p.data.qpos[j.drive.q]-p.description.input(p.data.time).position));
      for(let k=0;k<p.description.lengths.length;k++)strain=Math.max(strain,Math.abs(p.data.flexedge_length[k]/p.description.lengths[k]-1));
      const cs=p.data.contact;try{for(let k=0;k<cs.size();k++){const c=cs.get(k);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{cs.delete();}
      if((i+1)%500===0&&(i+1)%1000!==0)reversals.push(p.data.qpos[j.spin.q]);
    }
    assert.equal(reversals.length,6);reversals.forEach((q,i)=>assert(i%2?q>2.2:q< -2.2));
    assert(penetration<.0011);assert(strain<.002);assert(inputError<.006);
    t.diagnostic(JSON.stringify({reversals,penetrationPixels:100*penetration,maximumEdgeStrain:strain,inputErrorPixels:100*inputError}));
  }finally{v.dispose();}
});

test('124 removing cord friction removes spindle transmission',()=>{
  const v=makeMujocoBowDrill(mujoco,{friction:0}),p=v.physics;
  try {
    v.update(1);assert(Math.abs(p.data.qpos[p.joints.drive.q])>.85);
    // Convex collision normals leave a small residual torque on the cylinder.
    // At the tightened CCD tolerance it is below 0.001% of driven rotation.
    assert(Math.abs(p.data.qpos[p.joints.spin.q])<1e-5);
  }finally{v.dispose();}
});

test('124 visible cord endpoints follow native tip compliance, seeking and restart',()=>{
  const v=makeMujocoBowDrill(mujoco),u=v.root.userData,p=v.physics;
  try {
    const initial=Array.from(p.data.qpos);
    for(const time of [1,3,8]) {
      v.update(time);
      for(const [name,anchor,id] of [['lowerBindingLead',u.profile.lower,0],['upperBindingLead',u.profile.upper,u.profile.cordSegments]]) {
        const a=u.parts[name].localToWorld(new THREE.Vector3(...anchor)),b=new THREE.Vector3().fromArray(p.data.flexvert_xpos,3*id);
        assert(a.distanceTo(b)<1e-9,name);
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

test('124 rejects a cord mesh whose nonadjacent finite elements start overlapped',()=>{
  assert.throws(()=>makeMujocoBowDrill(mujoco,{cordSegments:144}),/too short/);
});
