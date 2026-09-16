import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredPersianIrrigationWheelMovement as create} from '../src/simulation/authored-persian-irrigation-wheels.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

function fixture(run) {const model=create({id:441});try{run(model,model.root.userData);}finally{disposeObject3D(model.root);}}

test('441 trip shoe touches the finite pin, blocks an upright bucket, and returns continuously without penetrating it',()=>fixture((model,d)=>{
  const g=d.geometry,t=g.trip;
  const gap=(a,phi)=>{
    const qx=t.pin.x-g.bucketPivotRadius*Math.cos(a),qy=t.pin.y-g.wheelCenter.y-g.bucketPivotRadius*Math.sin(a);
    const x=qx*Math.cos(phi)+qy*Math.sin(phi),y=-qx*Math.sin(phi)+qy*Math.cos(phi);
    return Math.hypot(x-t.shoeX,y-THREE.MathUtils.clamp(y,t.shoeBottom,t.shoeTop))-t.shoeRadius-t.pinRadius;
  };
  assert.ok(gap(t.start+.025,0)<-.02,'unrotated shoe is actually blocked by the pin');
  for(let i=0;i<=10000;i++) {
    const a=i*2*Math.PI/10000,phi=t.angleAt(a);
    assert.ok(gap(a,phi)>-1e-10,`penetration at ${a}`);
    if(a>t.start&&a<t.peak)assert.ok(Math.abs(gap(a,phi))<1e-10,'rising branch is contact, not merely clearance');
  }
  for(const a of [t.start,t.peak,t.end,2*Math.PI])assert.ok(Math.abs(t.angleAt(a-1e-8)-t.angleAt(a+1e-8))<1e-6,'no angular teleport');
  assert.ok(t.maximum>80*Math.PI/180);
  assert.match(d.solidReview.residual,/passive swing.*prescribed/);
}));

test('441 actual bucket, float and trip meshes clear the receiver and fixed supports through a cycle',()=>fixture((model,d)=>{
  const b=d.blocks,moving=[],fixed=[];
  b.wheel.traverse(o=>{if(o.geometry&&!o.material.transparent)moving.push({o,p:surfacePoints(o.geometry),s:solidSurface(o.geometry)});});
  for(const target of [b.stationaryTripPin,b.tripPinBracket,b.tripPinPost,b.deliveryTrough,b.receiverPost,b.receiverBridge,...b.supports,...b.bearingRings])target.traverse(o=>{if(o.geometry)fixed.push({o,p:surfacePoints(o.geometry),s:solidSurface(o.geometry)});});
  const check=(a,c)=>{
    const tr=c.o.matrixWorld.clone().invert().multiply(a.o.matrixWorld);
    for(const p of a.p){const q=p.clone().applyMatrix4(tr);if(c.s.box.distanceToPoint(q)>.001)continue;
      assert.ok(c.s.signedDistance(q,.01)>-2e-6,`${a.o.userData.role||a.o.id} / ${c.o.userData.role||c.o.id}`);
    }
  };
  for(let i=0;i<=96;i++) {
    model.update(d.geometry.cycleDuration*i/96);model.root.updateMatrixWorld(true);
    for(const a of moving)for(const c of fixed){if(!new THREE.Box3().setFromObject(a.o).intersectsBox(new THREE.Box3().setFromObject(c.o)))continue;check(a,c);check(c,a);}
  }
}));

test('441 discharge columns start at the tilted mouth and land inside the receiving trough',()=>fixture((model,d)=>{
  const b=d.blocks,g=d.geometry;
  for(let i=0;i<=512;i++) {
    model.update(g.cycleDuration*i/512);model.root.updateMatrixWorld(true);
    for(let j=0;j<b.bucketSpills.length;j++) {
      const spill=b.bucketSpills[j];if(!spill.visible)continue;
      const lip=new THREE.Vector3(-.27,-.14,0).applyMatrix4(b.buckets[j].matrixWorld);
      assert.ok(Math.abs(spill.position.x-lip.x)<1e-10);
      assert.ok(Math.abs(spill.position.y+spill.scale.y/2-lip.y)<1e-10);
      const bottom=new THREE.Vector3(spill.position.x,spill.position.y-spill.scale.y/2,spill.position.z);
      b.deliveryTrough.worldToLocal(bottom);
      assert.ok(Math.abs(bottom.x)+.085*spill.scale.x<1.85/2);
      assert.ok(Math.abs(bottom.z)+.085*spill.scale.z<.28);
      assert.ok(Math.abs(bottom.y-.065)<1e-10);
    }
  }
}));
