import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredBeltMovement} from '../src/simulation/authored-belts.js';
import {createAuthoredPickeringGovernorMovement} from '../src/simulation/authored-pickering-governors.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const create=id=>(id===244?createAuthoredBeltMovement:createAuthoredPickeringGovernorMovement)({id});

for(const id of [244,287]) test(`${id} actual clamp and shaft surfaces clear through a complete cycle`,()=>{
  const model=create(id),{blocks:b,geometry:g}=model.root.userData,cache=new Map();
  const get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),surface:solidSurface(o.geometry)});return cache.get(o);};
  try {
    const pairs=id===244?[b.upperShoe,b.lowerBandBacking,...b.lowerStraps,...b.strapPins.flatMap(p=>p.children.filter(c=>c.geometry))].map(p=>[b.drumBody,p]):
      [b.lowerFlange,b.lowerKeeper,b.sleeveBody,b.lowerSleeveNeck,b.thrustRingUpper,b.thrustRingLower,b.bearingHousing].flatMap(p=>[[p,b.spindle],...(p===b.bearingHousing?[]:[[p,b.featherKey]])]);
    let worst=0,where='';
    for(let i=0;i<=24;i++) {
      model.update((g.responseCyclePeriod??g.cyclePeriod)*i/24);model.root.updateMatrixWorld(true);
      if(id===287)for(const a of b.springAssemblies)cache.delete(a.spring);
      const current=id===287?[...pairs,...b.springAssemblies.map(a=>[a.spring,a.ball])]:pairs;
      for(const pair of current)for(const[a,c]of[pair,[...pair].reverse()]) {
        const target=get(c).surface,transform=c.matrixWorld.clone().invert().multiply(a.matrixWorld);
        for(const p0 of get(a).points) {
          const p=p0.clone().applyMatrix4(transform);if(target.box.distanceToPoint(p)>1e-6)continue;
          const gap=target.signedDistance(p,.05);
          if(gap<worst){worst=gap;where=`pose ${i}: ${a.userData.role} / ${c.userData.role}`;}
        }
      }
    }
    assert.ok(worst>-2e-6,`${where}: ${worst}`);
  }finally{disposeObject3D(model.root);}
});

test('244 friction liners meet the rotating drum surface, with finite running clearance only',()=>{
  const model=create(244),{blocks:b,geometry:g}=model.root.userData;
  try {
    model.root.updateMatrixWorld(true);
    for(const part of [b.upperShoe,b.lowerBandBacking]) {
      const p=part.userData,target=solidSurface(part.geometry);
      for(let i=1;i<24;i++) {
        const angle=p.startAngle+(p.endAngle-p.startAngle)*i/24;
        const local=new THREE.Vector3(g.drumRadius*Math.cos(angle),g.drumRadius*Math.sin(angle),0)
          .applyMatrix4(b.drumBody.parent.matrixWorld).applyMatrix4(part.matrixWorld.clone().invert());
        assert.ok(target.distance(local,.005)<.00005);
      }
    }
    assert.match(model.root.userData.workingClampReview.residual,/already balanced steady/);
  }finally{disposeObject3D(model.root);}
});

test('244 wooden block fills lever to pulley, strap bolts run straight, and no undrawn stop standard shows',()=>{
  const model=create(244),{blocks:b,geometry:g}=model.root.userData;
  try {
    model.root.updateMatrixWorld(true);
    assert.equal(b.upperShoe.userData.role,'upper-wooden-brake-block-under-lever-D');
    const block=new THREE.Box3().setFromObject(b.upperShoe);
    // p93-fc: lever D was moved back into the pulley's mid-plane and rests on
    // the block's flat top, so the block now meets D's underside rather than
    // rising beside it, and D lies within the block's depth.
    const lever=new THREE.Box3().setFromObject(b.lever);
    assert.ok(Math.abs(block.max.y-lever.min.y)<2e-3,`block reaches up under the lever (${block.max.y} vs ${lever.min.y})`);
    assert.ok(lever.min.z>=block.min.z-1e-6&&lever.max.z<=block.max.z+1e-6,'and D bears on it within its depth');
    for(const {bolt,eye} of b.endBolts){
      assert.equal(bolt.rotation.x,0);assert.equal(bolt.rotation.z,0);
      assert.ok(Math.abs(bolt.position.x-eye.position.x)<1e-12,'bolt is straight above its eye');
    }
    for(const hidden of [b.stopPost,...b.stopBridges,b.leftBandLink,b.rightBandLink,...b.shoeHangers]){
      let shown=false;hidden.traverse(o=>{if(o.isMesh&&o.visible)shown=true;});assert.equal(shown,false);
    }
    assert.ok(b.upperStop.visible&&b.lowerStop.visible,'stop blocks C and C\u2032 remain');
  }finally{disposeObject3D(model.root);}
});

test('287 fixed feather remains captured by the sliding keyed sleeve, with visible shoulders attached',()=>{
  const model=create(287),{blocks:b,geometry:g}=model.root.userData;
  try {
    assert.equal(b.featherKey.parent,b.governorRotor);
    const keyY=b.featherKey.position.y;
    for(let i=0;i<=16;i++) {
      model.update(g.responseCyclePeriod*i/16);model.root.updateMatrixWorld(true);
      assert.equal(b.featherKey.position.y,keyY);
      // Check the actual key center in sleeve coordinates, not just nominal radii.
      const keyCenter=b.featherKey.position.clone();keyCenter.y=b.slidingSleeve.position.y-.62;
      const local=b.sleeveBody.worldToLocal(b.governorRotor.localToWorld(keyCenter));
      assert.equal(solidSurface(b.sleeveBody.geometry).inside(local),false);
      assert.ok(new THREE.Box3().setFromObject(b.lowerSleeveNeck).intersectsBox(new THREE.Box3().setFromObject(b.lowerFlange)));
      assert.ok(new THREE.Box3().setFromObject(b.lowerSleeveNeck).intersectsBox(new THREE.Box3().setFromObject(b.sleeveBody)));
    }
    assert.ok(model.root.userData.minimumDisplayCycleSeconds>=16);
    assert.match(model.root.userData.workingClampReview.residual,/quasi-static/);
  }finally{disposeObject3D(model.root);}
});
