import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredPersianIrrigationWheelMovement as persian} from '../src/simulation/authored-persian-irrigation-wheels.js';
import {createAuthoredEisachPotWheelMovement as pots} from '../src/simulation/authored-eisach-pot-wheels.js';
import {createAuthoredStreamDrivenArchimedesScrewMovement as screw} from '../src/simulation/authored-stream-driven-archimedes-screws.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

const factories = [[441,persian],[442,pots],[443,screw]];
for (const [id,create] of factories) {
  test(`${id}: repeated queries preserve object and geometry identities`, () => {
    const model = create({id});
    try {
      const snapshot = () => { const entries=[];model.root.traverse(o=>entries.push([o,o.geometry]));return entries; };
      const before=snapshot(),u=model.root.userData;
      for(let i=0;i<300;i++){u.stateAtInputAngle(i*.13);u.stateAtTime(i*.17);model.update(i*.17);}
      assert.deepEqual(snapshot(),before);
      assert.equal(u.hideGround,true);
      assert.ok(u.minimumDisplayCycleSeconds>=11);
    } finally {disposeObject3D(model.root);}
  });

  test(`${id}: finite rotating parts clear ${id===441?'bed and shaft supports (trip remains unqualified)':'fixed apparatus'}`, () => {
    const model=create({id}),u=model.root.userData,b=u.blocks;
    try {
      const rotor=b.wheel??b.rotor,moving=[],fixed=[];
      rotor.traverse(mesh=>{if(mesh.isMesh&&!mesh.material.transparent){const points=surfacePoints(mesh.geometry);moving.push({mesh,points:points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/900))===0)});}});
      const targets=id===441?[b.base,b.streamBed,...b.supports,...b.bearingRings]:model.root.children.filter(o=>o!==rotor&&o!==b.screwAssembly);
      for(const target of targets)target.traverse(mesh=>{if(mesh.isMesh&&!mesh.material.transparent)fixed.push({mesh,surface:solidSurface(mesh.geometry)});});
      for(let frame=0;frame<=64;frame++){
        model.update(frame*(u.geometry.cycleDuration??u.geometry.transportCycleDuration)/64);model.root.updateMatrixWorld(true);
        for(const{mesh,points}of moving)for(const{mesh:target,surface}of fixed){
          if(!new THREE.Box3().setFromObject(mesh).intersectsBox(new THREE.Box3().setFromObject(target)))continue;
          const matrix=target.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
          for(const point of points){const p=point.clone().applyMatrix4(matrix);if(surface.inside(p))assert.ok(surface.distance(p)<3e-7,`${id}: ${mesh.userData.role} enters ${target.userData.role}, frame ${frame}, depth ${surface.distance(p)}`);}
        }
      }
    }finally{disposeObject3D(model.root);}
  });
}

test('442: water vertices stay inside finite pot walls through the cycle',()=>{
  const model=pots({id:442}),{blocks:b,geometry:g}=model.root.userData;
  try{
    for(let frame=0;frame<=128;frame++){
      model.update(frame*g.cycleDuration/128);model.root.updateMatrixWorld(true);
      b.potWaters.forEach((water,index)=>{
        const matrix=b.pots[index].matrixWorld.clone().invert().multiply(water.matrixWorld);
        const position=water.geometry.attributes.position;
        for(let vertex=0;vertex<water.geometry.drawRange.count;vertex++){
          const p=new THREE.Vector3().fromBufferAttribute(position,vertex).applyMatrix4(matrix);
          assert.ok(p.y>=-g.potRadialDepth+.04-1e-6);
          assert.ok(Math.abs(p.x)<g.potTangentialWidth/2-.08+1e-6);
          assert.ok(Math.abs(p.z)<g.potAxialWidth/2-.08+1e-6);
        }
      });
    }
  }finally{disposeObject3D(model.root);}
});

test('443: solid helical flight reaches shaft and finite casing without a radial bypass',()=>{
  const model=screw({id:443}),{blocks:b,geometry:g}=model.root.userData;
  try{
    const profile=b.helicalFlight.geometry.userData.thread;
    assert.equal(profile.inner,g.centralShaftRadius);
    assert.equal(profile.outer,g.casingRadius-.04);
    assert.ok(profile.width>0);
    const p=b.casing.geometry.attributes.position;
    const radii=Array.from({length:p.count},(_,i)=>Math.hypot(p.getX(i),p.getZ(i)));
    assert.ok(Math.abs(Math.min(...radii)-profile.outer)<1e-6);
    assert.ok(Math.abs(Math.max(...radii)-g.casingRadius)<1e-6);
  }finally{disposeObject3D(model.root);}
});

test('441: each curved channel opens through the hollow hub while retaining a finite floor',()=>{
  const model=persian({id:441}),{blocks:b,geometry:g}=model.root.userData;
  try{
    const shaft=solidSurface(b.hollowShaft.geometry);
    const curve=b.floatWaters[0].geometry.parameters.path;
    b.arms.forEach((arm,index)=>{
      const blade=arm.children.find(o=>o.userData.role===`curved-stream-driven-float-blade-${index+1}`);
      const surface=solidSurface(blade.geometry);
      let ports=0;
      for(let i=0;i<=128;i++){
        const point=curve.getPoint(i/128);
        assert.equal(surface.inside(point),false,'channel center is open');
        const radius=Math.hypot(point.x,point.y);
        if(radius>g.hollowShaftInnerRadius+.01&&radius<g.hollowShaftOuterRadius-.01){
          point.applyAxisAngle(new THREE.Vector3(0,0,1),arm.rotation.z);
          assert.equal(shaft.inside(point),false,'channel enters a real hub port');
          ports++;
        }
      }
      const floor=curve.getPoint(.5);floor.z=-g.floatDepth/2+.0175;
      assert.equal(surface.inside(floor),true,'finite channel floor remains');
      assert.ok(ports>5);
    });
    assert.equal(model.root.userData.solidReview.status,'partial');
  }finally{disposeObject3D(model.root);}
});
