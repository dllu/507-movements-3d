import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAuthoredDualBandRatchetMovement as create390 } from '../src/simulation/authored-dual-band-ratchets.js';
import { createAuthoredAlternatingWeightedRackMovement as create391 } from '../src/simulation/authored-alternating-weighted-racks.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';
const models=[create390({id:390}),create391({id:391})];
const gap=(a,b,points=surfacePoints(a.geometry))=>{
  const field=solidSurface(b.geometry),transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld);
  return Math.min(...points.map(p=>field.signedDistance(p.clone().applyMatrix4(transform))));
};
test('390 flat bands fit inside the actual concave loose-pulley grooves',()=>{
  const bands=[models[0].root.userData.blocks.openBand,models[0].root.userData.blocks.crossedBand];
  for(const band of bands){assert.equal(band.userData.crossSection,'flat');}
  const {width,thickness}=bands[0].userData;
  for(const carrier of[models[0].root.userData.blocks.openCarrier,models[0].root.userData.blocks.crossedCarrier]){
    const field=solidSurface(carrier.userData.pulley.geometry);let minimum=Infinity;
    // Sample the band's rectangular section perimeter all round the wrap.
    for(let i=0;i<48;i++)for(let j=0;j<=16;j++)for(const [dr,dz] of [[-thickness/2,width*(j/16-.5)],[thickness*(j/16-.5),-width/2],[thickness*(j/16-.5),width/2]]){
      const a=i*Math.PI/24,r=.5+dr;
      minimum=Math.min(minimum,field.signedDistance(new THREE.Vector3(r*Math.cos(a),dz,r*Math.sin(a))));
    }
    assert.ok(minimum>.004,`finite band/pulley clearance ${minimum}`);
  }
});
test('390 shaft clears both loose hubs and the fixed bearing journal',()=>{
  const m=models[0],b=m.root.userData.blocks;m.update(.7);m.root.updateMatrixWorld(true);
  const post=b.frame.children.find(o=>o.userData.role==='fixed-flywheel-shaft-bearing-post');
  for(const part of[b.openCarrier.userData.hub,b.crossedCarrier.userData.hub,post])assert.ok(gap(b.shaft,part)>.0025);
});
test('391 finite guide slots clear their actual moving pins throughout the cycle',()=>{
  const m=models[1],b=m.root.userData.blocks;
  for(const[rack,guide]of[[b.leftRack,b.leftGuide],[b.rightRack,b.rightGuide]]){
    const pin=rack.userData.guidePin,points=surfacePoints(pin.geometry),target=guide.userData.casting,field=solidSurface(target.geometry);let minimum=Infinity;
    for(let i=0;i<=64;i++){m.update(i/8);m.root.updateMatrixWorld(true);const tr=target.matrixWorld.clone().invert().multiply(pin.matrixWorld);for(const p of points)minimum=Math.min(minimum,field.signedDistance(p.clone().applyMatrix4(tr)));}
    assert.ok(minimum>.007,`finite guide clearance ${minimum}`);
  }
});
test('391 active involute rack clears the pinion; queued inactive interference remains bounded',()=>{
  const m=models[1],d=m.root.userData,b=d.blocks,field=solidSurface(b.outputGear.userData.wheel.geometry),points=new Map([b.leftRack,b.rightRack].flatMap(r=>r.userData.teeth.map(t=>[t,surfacePoints(t.geometry)])));
  let activeMinimum=Infinity,overallMinimum=Infinity,closestWorking=0;
  for(let i=0;i<=64;i++){
    const t=i/8;m.update(t);m.root.updateMatrixWorld(true);const state=d.stateAtTime(t);let poseMinimum=Infinity;
    for(const rack of[b.leftRack,b.rightRack])for(const tooth of rack.userData.teeth){
      const tr=b.outputGear.userData.wheel.matrixWorld.clone().invert().multiply(tooth.matrixWorld);
      for(const p of points.get(tooth)){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.02)continue;const distance=field.signedDistance(q);overallMinimum=Math.min(overallMinimum,distance);
        const active=(rack.userData.side<0&&state.activeDrive==='left-rack-A-working-upstroke')||(rack.userData.side>0&&state.activeDrive==='right-rack-A1-working-downstroke');
        if(active){activeMinimum=Math.min(activeMinimum,distance);poseMinimum=Math.min(poseMinimum,distance);}
      }
    }
    if(Number.isFinite(poseMinimum))closestWorking=Math.max(closestWorking,poseMinimum);
  }
  assert.ok(activeMinimum>.0008,`active tooth gap ${activeMinimum}`);
  assert.ok(closestWorking<.004,`active teeth remain near contact ${closestWorking}`);
  // Improvement is welcome: do not require the known residual to remain negative.
  assert.ok(overallMinimum>-.060,`queued inactive-rack depth ${overallMinimum}`);
});
test('390/391 state queries and updates preserve scene and geometry identities',()=>{
  for(const m of models){const before=[];m.root.traverse(o=>before.push([o,o.geometry]));for(let i=0;i<32;i++){m.root.userData.stateAtTime(i*.271);m.update(i*.271);}const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);assert.equal(m.root.userData.minimumDisplayCycleSeconds,8);assert.equal(m.root.userData.hideGround,true);m.root.traverse(o=>{for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});}
});
