import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredHorizontalOvershotWaterWheelMovement as wheel} from '../src/simulation/authored-horizontal-overshot-water-wheels.js';
import {createAuthoredFourneyronTurbineMovement as outward} from '../src/simulation/authored-fourneyron-turbines.js';
import {createAuthoredWarrenCentralDischargeTurbineMovement as inward} from '../src/simulation/authored-warren-central-discharge-turbines.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

for(const[id,create]of[[433,wheel],[434,outward],[435,inward]])test(`${id}: actual moving walls and shafts clear stationary guides, supports and bores`,()=>{
  const model=create({id}),u=model.root.userData,b=u.blocks;
  try{
    const fixed=id===433?[b.lowerBearing,b.upperBearing,b.bearingCone,b.overheadBeam,b.lowerPedestal,b.foundation]:[b.fixedGuideAssembly,b.casingFloor,b.shaftBearing,...(b.bearingBridge?[b.bearingBridge]:[])];
    const targets=[];for(const group of fixed)group.traverse(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)targets.push({mesh,surface:solidSurface(mesh.geometry)});});
    const moving=[];(b.rotor??b.runner).traverse(mesh=>{if(mesh.isMesh){const all=surfacePoints(mesh.geometry);moving.push({mesh,points:all.filter((_,i)=>i%Math.max(1,Math.floor(all.length/900))===0)});}});
    for(let frame=0;frame<=64;frame++){
      model.update(frame*u.geometry.cycleDuration/64);model.root.updateMatrixWorld(true);
      for(const{mesh,points}of moving)for(const{mesh:target,surface}of targets){
        if(!new THREE.Box3().setFromObject(mesh).intersectsBox(new THREE.Box3().setFromObject(target)))continue;
        const transform=target.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
        for(const point of points){const p=point.clone().applyMatrix4(transform);if(surface.inside(p)){const depth=surface.distance(p);assert.ok(depth<3e-7,`${id} ${mesh.userData.role} enters ${target.userData.role}, frame${frame}, depth${depth}`);}}
      }
    }
    assert.equal(u.hideGround,true);assert.equal(u.animationTiming.targetCycleDuration,u.geometry.cycleDuration);
    const walls=id===433?b.bladeGroups.flatMap(g=>g.children.filter(m=>m.userData.role.startsWith('radial-floor'))):[...b.fixedGuideVanes,...b.runnerBuckets];
    for(const wall of walls){wall.geometry.computeBoundingBox();assert.ok(wall.geometry.boundingBox.max.y-wall.geometry.boundingBox.min.y>.49,'working vanes have finite vertical walls');}
  }finally{disposeObject3D(model.root);}
});

test('435: central water discharge uses the annular opening around the hub and clears the foundation',()=>{
  const model=inward({id:435}),b=model.root.userData.blocks;
  try{
    model.root.updateMatrixWorld(true);const water=surfacePoints(b.centralDischarge.geometry);
    for(const target of[b.runnerDisk,b.runnerHub,b.runnerShaft,b.casingFloor]){
      const surface=solidSurface(target.geometry),transform=target.matrixWorld.clone().invert().multiply(b.centralDischarge.matrixWorld);
      for(const p of water)assert.ok(!surface.inside(p.clone().applyMatrix4(transform)),`water enters ${target.userData.role}`);
    }
    assert.ok(model.root.userData.geometry.runnerInnerRadius/model.root.userData.geometry.runnerOuterRadius>.65,'open center matches source annular runner proportions');
  }finally{disposeObject3D(model.root);}
});

for (const [id, create] of [[433, wheel], [434, outward], [435, inward]]) {
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
      if (id !== 433) {
        assert.equal(initial.filter(({ object }) => object.userData.role ===
          'annular-runner-backplate-joining-working-vanes').length, 1);
      }
    } finally {
      disposeObject3D(model.root);
    }
  });
}
