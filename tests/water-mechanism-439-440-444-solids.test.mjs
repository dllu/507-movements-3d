import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredWaterBucketReciprocatorMovement as wheel} from '../src/simulation/authored-water-bucket-reciprocators.js';
import {createAuthoredTippingWaterMeterMovement as outward} from '../src/simulation/authored-tipping-water-meters.js';
import {createAuthoredHydraulicRamMovement as inward} from '../src/simulation/authored-hydraulic-rams.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

for(const[id,create]of[[439,wheel],[440,outward],[444,inward]])test(`${id}: actual moving walls and shafts clear stationary guides, supports and bores`,()=>{
  const model=create({id}),u=model.root.userData,b=u.blocks;
  try{
    const fixed=id===439?[b.ground,b.strikeAnvil,b.hanger,b.frameBeam,b.framePost,b.flume,b.pulleyShaft]:id===440?[b.axle,...b.bearingRings,...b.supportPosts,...b.braces,b.leftStop,b.rightStop,b.base]:[b.deliverySeat,b.wasteSeat,b.chamberNeck,b.wasteBody,b.drivePipe,b.wasteOutlet];
    const targets=[];for(const group of fixed)group.traverse(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)targets.push({mesh,surface:solidSurface(mesh.geometry)});});
    const moving=[];(id===439?b.bucket:id===440?b.trough:b.wasteValve).traverse(mesh=>{if(mesh.isMesh&&!mesh.material.transparent&&mesh!==b.wasteSeat){const all=surfacePoints(mesh.geometry);moving.push({mesh,points:all.filter((_,i)=>i%Math.max(1,Math.floor(all.length/900))===0)});}});
    if(id===439)for(const group of[b.pulley,b.counterweight])group.traverse(mesh=>{if(mesh.isMesh)moving.push({mesh,points:surfacePoints(mesh.geometry)});});
    if(id===444)for(const mesh of[b.deliveryDisk,b.leverWeight,b.leverBar])moving.push({mesh,points:surfacePoints(mesh.geometry)});
    for(let frame=0;frame<=64;frame++){
      model.update(frame*u.geometry.cycleDuration/64);model.root.updateMatrixWorld(true);
      for(const{mesh,points}of moving)for(const{mesh:target,surface}of targets){
        if(!new THREE.Box3().setFromObject(mesh).intersectsBox(new THREE.Box3().setFromObject(target)))continue;
        const transform=target.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
        for(const point of points){const p=point.clone().applyMatrix4(transform);if(surface.inside(p)){const depth=surface.distance(p);assert.ok(depth<3e-7,`${id} ${mesh.userData.role} enters ${target.userData.role}, frame${frame}, depth${depth}`);}}
      }
    }
    assert.equal(u.hideGround,true);assert.equal(u.animationTiming.targetCycleDuration,u.geometry.cycleDuration);

  }finally{disposeObject3D(model.root);}
});

for (const [id, create] of [[439, wheel], [440, outward], [444, inward]]) {
  test(`${id}: repeated state queries and playback preserve scene and geometry identities`, () => {
    const model = create({ id });
    try {
      const snapshot = () => {
        const objects = [];
        model.root.traverse(object => objects.push({ object, geometry: object.geometry }));
        return objects;
      };
      const initial = snapshot();
      for (let sample = 0; sample < 300; sample += 1) {
        const time = sample * 0.073;
        model.root.userData.stateAtInputAngle(time);
        model.root.userData.stateAtTime(time);
        model.update(time);
      }
      const after = snapshot();
      assert.equal(after.length, initial.length, 'playback must not grow the scene');
      after.forEach((entry, index) => {
        assert.equal(entry.object, initial[index].object, 'scene object identity remains stable');
        assert.equal(entry.geometry, initial[index].geometry, 'geometry is built once');
      });

    } finally {
      disposeObject3D(model.root);
    }
  });
}


test('439: rendered valve stem meets the anvil continuously and inlet water ends inside the bucket', () => {
  const model = wheel({ id: 439 });
  try {
    const { blocks: b, geometry: g, stateAtTime } = model.root.userData;
    b.valveStem.geometry.computeBoundingBox();
    let engaged = 0;
    for (let sample = 0; sample <= 256; sample++) {
      const time = sample * g.cycleDuration / 256;
      const state = stateAtTime(time);
      model.update(time);
      model.root.updateMatrixWorld(true);
      const tip = new THREE.Vector3(0, b.valveStem.geometry.boundingBox.min.y, 0).applyMatrix4(b.valveStem.matrixWorld);
      const anvilTop = new THREE.Box3().setFromObject(b.strikeAnvil).max.y;
      assert.ok(tip.y >= anvilTop - 1e-7, 'stem cannot penetrate its contact anvil');
      if (state.valveLift > 0) {
        engaged++;
        assert.ok(Math.abs(tip.y - anvilTop) < 1e-7, 'finite stem tip maintains opening contact');
      }
      const water = new THREE.Box3().setFromObject(b.fallingWater);
      const bottom = new THREE.Box3().setFromObject(b.bucketBottom);
      assert.ok(water.min.y > bottom.max.y, 'inlet stream does not continue through closed bucket floor');
    }
    assert.ok(engaged > 20);
  } finally { disposeObject3D(model.root); }
});

test('440: rendered water stays inside each finite compartment throughout tipping', () => {
  const model = outward({ id: 440 });
  try {
    const { blocks: b, geometry: g } = model.root.userData;
    for (let sample = 0; sample <= 128; sample++) {
      model.update(sample * g.cycleDuration / 128);
      model.root.updateMatrixWorld(true);
      for (const [water, sign] of [[b.leftWater, -1], [b.rightWater, 1]]) {
        const matrix = b.trough.matrixWorld.clone().invert().multiply(water.matrixWorld);
        const positions = water.geometry.attributes.position;
        for (let index = 0; index < water.geometry.drawRange.count; index++) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(matrix);
          assert.ok(p.y >= g.floorTopLocalY - 1e-6, 'water stays above floor');
          assert.ok(sign * p.x >= .074, 'water stays on its side of divider');
          assert.ok(Math.abs(p.z) < g.troughWidth / 2 - .12, 'water clears side walls');
          assert.ok(Math.abs(p.x) < g.troughHalfLength, 'water stays between outlet ends');
        }
      }
    }
  } finally { disposeObject3D(model.root); }
});
