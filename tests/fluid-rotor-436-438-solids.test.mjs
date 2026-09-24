import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredJonvalTurbineMovement as wheel} from '../src/simulation/authored-jonval-turbines.js';
import {createAuthoredVoluteWaterWheelMovement as outward} from '../src/simulation/authored-volute-water-wheels.js';
import {createAuthoredBarkerReactionMillMovement as inward} from '../src/simulation/authored-barker-reaction-mills.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

for(const[id,create]of[[436,wheel],[437,outward],[438,inward]])test(`${id}: actual moving walls and shafts clear stationary guides, supports and bores`,()=>{
  const model=create({id}),u=model.root.userData,b=u.blocks;
  try{
    const fixed=id===436?[b.fixedGuideAssembly,b.casing,...b.casingPosts,...b.casingRings,b.foundation,b.upperBeam,b.upperBearing,b.lowerBearing]:id===437?[b.innerScrollWall,b.outerScrollWall,b.scrollFloor,b.upperBearing,b.bearingBeam,...b.bearingPosts,b.casingFloor]:[b.upperBearing,b.lowerBearing,b.bearingBracket,b.inletHopper,b.wall];
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

  }finally{disposeObject3D(model.root);}
});

for (const [id, create] of [[436, wheel], [437, outward], [438, inward]]) {
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

for (const [id, create, angle, rim] of [[436, wheel, Math.PI / 4, 2.50], [437, outward, Math.PI / 8, 2.20]]) {
  test(`${id}: runner support plate has open axial escape passages and a finite rim`, () => {
    const model = create({ id });
    try {
      const solid = solidSurface(model.root.userData.blocks.runnerFloor.geometry);
      assert.ok(!solid.inside(new THREE.Vector3(1.5 * Math.cos(angle), 0, -1.5 * Math.sin(angle))));
      assert.ok(solid.inside(new THREE.Vector3(rim, 0, 0)));
    } finally { disposeObject3D(model.root); }
  });
}

test('438: shaft and bent arms have real connected bores and tangential nozzle collars', () => {
  const model = inward({ id: 438 }), u = model.root.userData, b = u.blocks;
  try {
    const shaft = solidSurface(b.shaft.geometry);
    assert.ok(!shaft.inside(new THREE.Vector3(0, 0, 0)));
    assert.ok(shaft.inside(new THREE.Vector3(.25, 0, 0)));
    const state = u.stateAtTime(0);
    for (let i = 0; i < 4; i++) {
      const angle = u.geometry.sourcePoseArmOffset + i * Math.PI / 2;
      assert.ok(!shaft.inside(new THREE.Vector3(.25 * Math.cos(angle), u.geometry.armHeight - u.geometry.shaftCenterY, -.25 * Math.sin(angle))), 'shaft side port is open');
      const arm = b.armPipes[i], p = arm.geometry.attributes.position, solid = solidSurface(arm.geometry);
      for (const section of [4, 16, 32, 48, 60]) {
        const a = new THREE.Vector3().fromBufferAttribute(p, section * 24);
        const opposite = new THREE.Vector3().fromBufferAttribute(p, section * 24 + 12);
        const center = a.clone().add(opposite).multiplyScalar(.5);
        assert.ok(!solid.inside(center), 'arm centerline is a void');
        const wall = center.clone().lerp(a, .82);
        assert.ok(solid.inside(wall), 'finite arm wall has outward winding');
      }
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(b.nozzleCollars[i].quaternion);
      assert.ok(normal.distanceTo(state.nozzles[i].relativeJetVelocity.clone().normalize()) < 1e-10, 'outlet plane is normal to the tangential jet');
    }
  } finally { disposeObject3D(model.root); }
});


test('436 inlet descends toward the wheel and 437 escape buckets have an axial pitch', () => {
  const jonval = wheel({ id: 436 }), volute = outward({ id: 437 });
  try {
    const flume = jonval.root.userData.blocks.inletFlume;
    const uphill = new THREE.Vector3(1, 0, 0).applyQuaternion(flume.quaternion);
    assert.ok(uphill.y > .3, 'external right end is above the inward left end');
    for (const group of volute.root.userData.blocks.lowerBuckets) for (const blade of group.children) {
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(blade.quaternion);
      assert.ok(Math.abs(normal.y) > .4, 'escape-bucket working face is inclined to axial flow');
    }
  } finally { disposeObject3D(jonval.root); disposeObject3D(volute.root); }
});
