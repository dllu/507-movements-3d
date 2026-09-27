import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoQuickReturn} from '../src/simulation/mujoco-quick-return/visual.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();
const localPin=(p,f)=>{
  const [a,b]=p.data.qpos,x=f.crankRadius*Math.cos(a)-f.pivot[0],y=f.crankRadius*Math.sin(a)-f.pivot[1];
  return [x*Math.cos(b)+y*Math.sin(b),-x*Math.sin(b)+y*Math.cos(b)];
};

test('100 native planes match the finite slot and its complete wrist sweep clears both end caps',t=>{
  const v=makeMujocoQuickReturn(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.ngeom,3);assert.equal(p.model.jnt_stiffness[1],0);
    const surface=solidSurface(u.parts.lever.geometry);
    for(const strip of p.description.strips) {
      const id=p.id('mjOBJ_GEOM',strip.name),center=Array.from(p.model.geom_pos.slice(3*id,3*id+3)),size=Array.from(p.model.geom_size.slice(3*id,3*id+3));
      const side=strip.name==='lower'?1:-1;
      for(let i=0;i<=64;i++)for(let j=0;j<=8;j++) {
        const point=new THREE.Vector3(center[0]+size[0]*(2*i/64-1),center[1]+side*size[1],center[2]+size[2]*(2*j/8-1));
        assert.ok(surface.distance(point)<2e-6,'native working face misses visible slot');
      }
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) {
        const point=new THREE.Vector3(...center.map((v,i)=>v+size[i]*[x,y,z][i]));
        assert.ok(surface.inside(point)||surface.distance(point)<2e-6,'collision box protrudes from its visible plate');
      }
    }
    const pin=p.id('mjOBJ_GEOM','pin'),r=p.model.geom_size[3*pin],z=p.model.geom_pos[3*pin+2];u.parts.pin.geometry.computeBoundingBox();const box=u.parts.pin.geometry.boundingBox;
    assert.equal(p.model.geom_type[pin],mujoco.mjtGeom.mjGEOM_SPHERE.value);assert.equal(r,f.pinRadius);assert.ok(z-r>box.min.z&&z+r<box.max.z);
    const y=Math.abs(f.center[1])+f.clearance+.001,minX=-(f.pivotDistance+f.crankRadius),maxX=-Math.sqrt((f.pivotDistance-f.crankRadius)**2-y*y);
    const margin=Math.min(minX-r-f.ends[0][0],f.ends[1][0]-maxX-r);
    assert.ok(margin>.04,'finite wrist reaches the end caps');
    t.diagnostic(JSON.stringify({continuousEndMarginPixels:margin*100,radialClearancePixels:f.clearance*100,idealQuickReturnRatio:f.quickReturnRatio,
      initialArmAdjustmentDegrees:(p.data.qpos[1]-f.sourceAngle)*180/Math.PI}));
  }finally{v.dispose();}
});

test('100 lever is passive, accepts either applied torque and restarts independently of render frames',()=>{
  const v=makeMujocoQuickReturn(mujoco),p=v.physics;
  try {
    v.update(4);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=240;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.update(.5);v.update(4);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.reset();const initial=p.data.qpos[1],pin=p.id('mjOBJ_GEOM','pin');p.model.geom_contype[pin]=0;p.model.geom_conaffinity[pin]=0;p.data.qvel[1]=0;p.model.opt.gravity.fill(0);
    v.update(2);assert.ok(Math.abs(p.data.qpos[1]-initial)<1e-10);assert.ok(p.data.qpos[0]<-1);
  }finally{v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  for(const load of [-1,1]) {
    // Hold the input almost still to isolate each applied load from inertia.
    const v=makeMujocoQuickReturn(mujoco,{load,period:1e6}),p=v.physics,f=v.root.userData.profile;p.model.opt.gravity.fill(0);let selected=0;
    try {
      const wall=p.id('mjOBJ_GEOM',load>0?'upper':'lower');
      for(let i=1;i<=80;i++) {
        v.update(i/20);assert.ok(Math.abs(localPin(p,f)[1]-f.center[1])<f.clearance+.001);
        const cs=p.data.contact;for(let j=0;j<cs.size();j++){const c=cs.get(j);if(c.geom1===wall||c.geom2===wall)selected++;c.delete();}cs.delete();
      }
      assert.ok(selected>20,'applied torque did not load its working face');
    }finally{v.dispose();}
  }
});

test('100 ten quick-return cycles retain wrist contact and separate all other finite hardware',t=>{
  const v=makeMujocoQuickReturn(mujoco),p=v.physics,u=v.root.userData,f=u.profile,surface=solidSurface(u.parts.lever.geometry);
  const names=new Map(['lower','upper'].map(n=>[p.id('mjOBJ_GEOM',n),n])),contacts={lower:0,upper:0},trajectory=[];
  let error=0,penetration=0,solidPenetration=0,contactSurfaceError=0,checks=0,poses=0,minimumAngle=Infinity,maximumAngle=-Infinity;
  try {
    for(let i=0;i<=80000;i++) {
      if(i)p.step();mujoco.mj_forward(p.model,p.data);assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      const point=localPin(p,f),b=p.data.qpos[1];error=Math.max(error,Math.abs(point[1]-f.center[1])-f.clearance);
      minimumAngle=Math.min(minimumAngle,b);maximumAngle=Math.max(maximumAngle,b);
      trajectory.push(b);const cs=p.data.contact;
      for(let j=0;j<cs.size();j++) {
        const c=cs.get(j),name=names.get(c.geom1)??names.get(c.geom2);assert.ok(name);contacts[name]++;penetration=Math.max(penetration,-c.dist);
        if(i%20===0){const point=new THREE.Vector3().fromArray(c.pos).sub(new THREE.Vector3(...f.pivot,0)).applyAxisAngle(new THREE.Vector3(0,0,1),-b);contactSurfaceError=Math.max(contactSurfaceError,surface.distance(point));}c.delete();
      }
      cs.delete();
      if(i<=8000&&i%250===0) {
        v.sync();const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;assert.deepEqual(a.topologyIssues,[]);
        for(const issue of a.issues){assert.ok([issue.from,issue.to].includes('pin')&&[issue.from,issue.to].includes('lever'),JSON.stringify(issue));solidPenetration=Math.max(solidPenetration,-issue.gap);}
        for(const mesh of Object.values(u.parts)){const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);}
      }
    }
    // Measure complete strokes from native positions. Tiny velocity zero
    // crossings at a soft-contact reversal are not additional machine strokes.
    // Independently bound all reverse excursions between the global extrema.
    const extrema=[];
    for(let cycle=0;cycle<10;cycle++) {
      let minimum=cycle*8000,maximum=minimum;
      for(let i=minimum;i<(cycle+1)*8000;i++) {
        if(trajectory[i]<trajectory[minimum])minimum=i;
        if(trajectory[i]>trajectory[maximum])maximum=i;
      }
      assert.ok(minimum<maximum);
      extrema.push({index:minimum,kind:'minimum'},{index:maximum,kind:'maximum'});
    }
    let reverseExcursion=0;const ratios=[];
    for(let i=0;i+1<extrema.length;i++) {
      const start=extrema[i],end=extrema[i+1],sign=start.kind==='minimum'?1:-1;let furthest=sign*trajectory[start.index];
      for(let j=start.index;j<=end.index;j++){const q=sign*trajectory[j];reverseExcursion=Math.max(reverseExcursion,furthest-q);furthest=Math.max(furthest,q);}
      if(i%2===0&&i+2<extrema.length)ratios.push((extrema[i+2].index-end.index)/(end.index-start.index));
    }
    t.diagnostic(JSON.stringify({maximumEnvelopeErrorPixels:error*100,maximumNativePenetrationPixels:penetration*100,maximumSampledPenetrationPixels:solidPenetration*100,
      contactSurfaceErrorPixels:contactSurfaceError*100,angleRangeDegrees:[minimumAngle,maximumAngle].map(a=>a*180/Math.PI),contacts,poses,surfaceChecks:checks,
      extrema:extrema.map(e=>({time:e.index*p.timestep,kind:e.kind,angle:trajectory[e.index]})),ratios,maximumReverseExcursionDegrees:reverseExcursion*180/Math.PI}));
    // Soft contact stays below 0.06 source pixel, under 1/30 of the measured
    // clearance on either side of the wrist; visible hardware is tighter still.
    assert.ok(error*100<.06);assert.ok(penetration*100<.06);assert.ok(solidPenetration*100<.05);assert.ok(contactSurfaceError*100<.05);
    assert.ok(ratios.every(r=>Math.abs(r/f.quickReturnRatio-1)<.01));assert.ok(reverseExcursion*180/Math.PI<.001);assert.ok(contacts.upper>10000);
  }finally{v.dispose();}
});

test('100 timestep refinement bounds the fast return and the slow stroke',t=>{
  const a=makeMujocoQuickReturn(mujoco),b=makeMujocoQuickReturn(mujoco,{timestep:.00025}),c=makeMujocoQuickReturn(mujoco,{timestep:.000125});let first=0,second=0;
  try {
    for(let i=0;i<80000;i++){a.physics.step();for(let j=0;j<2;j++)b.physics.step();for(let j=0;j<4;j++)c.physics.step();first=Math.max(first,Math.abs(a.physics.data.qpos[1]-b.physics.data.qpos[1]));second=Math.max(second,Math.abs(b.physics.data.qpos[1]-c.physics.data.qpos[1]));}
    t.diagnostic(JSON.stringify({timestepDegrees:first*180/Math.PI,refinedTimestepDegrees:second*180/Math.PI}));assert.ok(first*180/Math.PI<.05);assert.ok(second<first);
  }finally{a.dispose();b.dispose();c.dispose();}
});

test('100 tail rod runs into the pivot hub with no overhang',()=>{
  const v=makeMujocoQuickReturn(mujoco),u=v.root.userData;
  try {
    const box=name=>{const g=u.parts[name].geometry;g.computeBoundingBox();return g.boundingBox.clone().translate(u.parts[name].position);};
    const rod=box('tailRod'),hub=box('pivotBoss'),hubRadius=u.source.pivotRadius/100,r=(rod.max.z-rod.min.z)/2;
    assert.ok(hub.min.z<rod.min.z-.01&&hub.max.z>rod.max.z+.01,'hub is deeper than the rod');
    // The rod's flat end face (nearest the pivot) lies inside the hub and clear of the bore.
    const pos=u.parts.tailRod.geometry.attributes.position;
    const start=Math.min(...Array.from({length:pos.count},(_,i)=>Math.hypot(pos.getX(i),pos.getY(i))));
    assert.ok(start>u.geometry.pivotShaftRadius+.01,'rod end clears the bore');
    assert.ok(Math.hypot(start,r)<hubRadius-.01,'rod end face corners inside the hub');
  }finally{v.dispose();}
});
