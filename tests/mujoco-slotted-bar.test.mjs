import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoSlottedBar} from '../src/simulation/mujoco-slotted-bar/visual.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';
import {solidSurface} from './helpers/solid-surface.mjs';
const mujoco=await loadMujoco();
const localPin=(p,f)=>{const [a,x]=p.data.qpos;return [x*Math.cos(a)+f.barY*Math.sin(a),-x*Math.sin(a)+f.barY*Math.cos(a)];};

test('101 finite working planes and cylindrical wrist agree, with continuous slot-end clearance',t=>{
  const v=makeMujocoSlottedBar(mujoco),p=v.physics,u=v.root.userData,f=u.profile;
  try {
    assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.ngeom,3);assert.equal(p.model.jnt_stiffness[1],0);
    const surface=solidSurface(u.parts.lever.geometry);
    for(const strip of p.description.strips) {
      const id=p.id('mjOBJ_GEOM',strip.name),center=Array.from(p.model.geom_pos.slice(3*id,3*id+3)),size=Array.from(p.model.geom_size.slice(3*id,3*id+3)),side=strip.name==='lower'?1:-1;
      for(let i=0;i<=64;i++)for(let j=0;j<=8;j++) {
        const point=new THREE.Vector3(center[0]+size[0]*(2*i/64-1),center[1]+side*size[1],center[2]+size[2]*(2*j/8-1));
        assert.ok(surface.distance(point)<2e-6,'native working face misses visible slot');
      }
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) {
        const point=new THREE.Vector3(...center.map((v,i)=>v+size[i]*[x,y,z][i]));
        assert.ok(surface.inside(point)||surface.distance(point)<2e-6,'collision box protrudes from the plate');
      }
    }
    const pin=p.id('mjOBJ_GEOM','pin'),r=p.model.geom_size[3*pin],z=p.model.geom_pos[3*pin+2];u.parts.pin.geometry.computeBoundingBox();
    assert.equal(r,f.pinRadius);assert.ok(z-r>u.parts.pin.geometry.boundingBox.min.z&&z+r<u.parts.pin.geometry.boundingBox.max.z);
    const yMax=Math.abs(f.center[1])+f.clearance+.001,minimum=-f.barY-yMax,maximum=(-f.barY+yMax)/Math.cos(f.amplitude+.005);
    const endMargin=Math.min(minimum-r-f.ends[0][0],f.ends[1][0]-maximum-r);
    assert.ok(endMargin>.1);
    t.diagnostic(JSON.stringify({continuousEndMarginPixels:100*endMargin,slotWideningPixels:f.slotWideningPixels,rightExtensionPixels:f.rightExtensionPixels,initialPinShiftPixels:f.initialPinShiftPixels}));
  }finally{v.dispose();}
});

test('101 bar is passive, either applied load reaches its wall, and playback restarts deterministically',()=>{
  const v=makeMujocoSlottedBar(mujoco),p=v.physics;
  try {
    v.update(3);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=180;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.update(.5);v.update(3);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);
    v.reset();const initial=p.data.qpos[1],pin=p.id('mjOBJ_GEOM','pin');p.model.geom_contype[pin]=0;p.model.geom_conaffinity[pin]=0;
    v.update(1.5);assert.ok(Math.abs(p.data.qpos[1]-initial)<1e-10);assert.ok(p.data.qpos[0]<-2);
  }finally{v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
  for(const load of [-2,2]) {
    const v=makeMujocoSlottedBar(mujoco,{load,period:1e6}),p=v.physics,f=v.root.userData.profile;let selected=0;
    try {
      const wall=p.id('mjOBJ_GEOM',load>0?'upper':'lower');
      for(let i=1;i<=60;i++) {
        v.update(i/20);assert.ok(Math.abs(localPin(p,f)[1]-f.center[1])<f.clearance+.001);
        const cs=p.data.contact;for(let j=0;j<cs.size();j++){const c=cs.get(j);if(c.geom1===wall||c.geom2===wall)selected++;c.delete();}cs.delete();
      }
      assert.ok(selected>20,'applied load did not reach its working wall');
    }finally{v.dispose();}
  }
});

test('101 ten complete swings retain both guides and separate the finite hardware',t=>{
  const v=makeMujocoSlottedBar(mujoco),p=v.physics,u=v.root.userData,f=u.profile,surface=solidSurface(u.parts.lever.geometry),trajectory=[];
  const names=new Map(['lower','upper'].map(n=>[p.id('mjOBJ_GEOM',n),n])),contacts={lower:0,upper:0};
  let envelope=0,penetration=0,visiblePenetration=0,contactError=0,tracking=0,minimum=Infinity,maximum=-Infinity,retention=Infinity,checks=0,poses=0;
  try {
    for(let i=0;i<=60000;i++) {
      if(i)p.step();mujoco.mj_forward(p.model,p.data);assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      const [angle,x]=p.data.qpos,y=localPin(p,f)[1];trajectory.push(x);envelope=Math.max(envelope,Math.abs(y-f.center[1])-f.clearance);
      tracking=Math.max(tracking,Math.abs(angle-p.description.input(p.data.time).angle));assert.ok(Math.abs(angle+Math.PI/2)<f.amplitude+.005);
      minimum=Math.min(minimum,x);maximum=Math.max(maximum,x);
      retention=Math.min(retention,f.world([u.source.guides[0][0],0])[0]-x-f.barLeft,x+f.barRight-f.world([u.source.guides[1][1],0])[0]);
      const cs=p.data.contact;
      for(let j=0;j<cs.size();j++) {
        const c=cs.get(j),name=names.get(c.geom1)??names.get(c.geom2);assert.ok(name);contacts[name]++;penetration=Math.max(penetration,-c.dist);
        if(i%20===0){const point=new THREE.Vector3().fromArray(c.pos).applyAxisAngle(new THREE.Vector3(0,0,1),-angle);contactError=Math.max(contactError,surface.distance(point));}c.delete();
      }
      cs.delete();
      if(i<=6000&&i%200===0) {
        v.sync();const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;assert.deepEqual(a.topologyIssues,[]);
        for(const issue of a.issues){assert.ok([issue.from,issue.to].includes('pin')&&[issue.from,issue.to].includes('lever'),JSON.stringify(issue));visiblePenetration=Math.max(visiblePenetration,-issue.gap);}
        for(const mesh of Object.values(u.parts)){const pos=mesh.geometry.attributes.position;for(let j=0;j<pos.count;j++)assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld)),mesh.name);}
      }
    }
    // Native position extrema define complete strokes; independently bound
    // reverse travel inside each stroke to catch jitter or extra reversals.
    const extrema=[];
    for(let k=1;k<20;k++) {
      const center=k*3000,sign=k%2?-1:1;let index=center-300;
      for(let j=center-300;j<=center+300;j++)if(sign*trajectory[j]>sign*trajectory[index])index=j;
      extrema.push({index,sign});
    }
    let reverse=0;
    for(let i=0;i+1<extrema.length;i++) {
      const start=extrema[i],end=extrema[i+1],sign=-start.sign;let furthest=sign*trajectory[start.index];
      for(let j=start.index;j<=end.index;j++){const x=sign*trajectory[j];reverse=Math.max(reverse,furthest-x);furthest=Math.max(furthest,x);}
    }
    t.diagnostic(JSON.stringify({envelopePixels:100*envelope,nativePenetrationPixels:100*penetration,visiblePenetrationPixels:100*visiblePenetration,
      contactSurfaceErrorPixels:100*contactError,trackingDegrees:tracking*180/Math.PI,strokePixels:100*(maximum-minimum),retentionPixels:100*retention,
      maximumReversePixels:100*reverse,contacts,poses,checks,extrema:extrema.map(e=>({time:e.index*p.timestep,x:trajectory[e.index]}))}));
    assert.ok(envelope*100<.02);assert.ok(penetration*100<.02);assert.ok(visiblePenetration*100<.02);assert.ok(contactError*100<.02);
    assert.ok(retention>.06);assert.ok(maximum-minimum>1.47);assert.ok(reverse*100<.01);assert.ok(contacts.lower>10000&&contacts.upper>10000);
  }finally{v.dispose();}
});

test('101 timestep refinement bounds the complete horizontal strokes',t=>{
  const a=makeMujocoSlottedBar(mujoco),b=makeMujocoSlottedBar(mujoco,{timestep:.00025}),c=makeMujocoSlottedBar(mujoco,{timestep:.000125});let first=0,second=0;
  try {
    for(let i=0;i<60000;i++){a.physics.step();for(let j=0;j<2;j++)b.physics.step();for(let j=0;j<4;j++)c.physics.step();first=Math.max(first,Math.abs(a.physics.data.qpos[1]-b.physics.data.qpos[1]));second=Math.max(second,Math.abs(b.physics.data.qpos[1]-c.physics.data.qpos[1]));}
    t.diagnostic(JSON.stringify({timestepPixels:first*100,refinedTimestepPixels:second*100}));assert.ok(first*100<.1);assert.ok(second<first);
  }finally{a.dispose();b.dispose();c.dispose();}
});
