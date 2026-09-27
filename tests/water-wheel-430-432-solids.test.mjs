import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredOvershotWaterWheelMovement as overshot} from '../src/simulation/authored-overshot-water-wheels.js';
import {createAuthoredUndershotWaterWheelMovement as undershot} from '../src/simulation/authored-undershot-water-wheels.js';
import {createAuthoredBreastWaterWheelMovement as breast} from '../src/simulation/authored-breast-water-wheels.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

for(const[id,create]of[[430,overshot],[431,undershot],[432,breast]])test(`${id}: rotating solids clear actual bearing supports and working channel through a cycle`,()=>{
  const model=create({id}),u=model.root.userData,b=u.blocks;
  try{
    const fixed=[...b.bearings,...b.bearingPedestals];
    if(id===430)fixed.push(b.flume,b.masonryRace);
    if(id===431)fixed.push(b.channelBed,b.gateTower,b.gateLeaf);
    if(id===432)fixed.push(b.breastFloor,...b.breastChannelRails,...b.innerCheeks,b.gateLeaf);
    const queries=fixed.map(mesh=>({mesh,surface:solidSurface(mesh.geometry)})),moving=[];
    b.rotor.traverse(mesh=>{if(!mesh.isMesh||mesh.userData.role.includes('water'))return;const all=surfacePoints(mesh.geometry);moving.push({mesh,points:all.filter((_,i)=>i%Math.max(1,Math.floor(all.length/800))===0)});});
    for(let frame=0;frame<=64;frame++){
      model.update(frame*6/64);model.root.updateMatrixWorld(true);
      for(const{mesh,points}of moving)for(const{mesh:target,surface}of queries){
        if(!new THREE.Box3().setFromObject(mesh).intersectsBox(new THREE.Box3().setFromObject(target)))continue;
        const transform=target.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
        for(const point of points){const p=point.clone().applyMatrix4(transform);if(surface.inside(p)){const depth=surface.distance(p);assert.ok(depth<3e-7,`${id} ${mesh.userData.role} enters ${target.userData.role}, frame${frame}, depth${depth}`);}}
      }
    }
    for(const {mesh} of moving)if(mesh.userData.role.includes('spoke')){
      mesh.updateMatrix();const p=mesh.geometry.attributes.position;
      for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrix);assert.ok(Math.hypot(v.x,v.y)<({430:1.963,431:2.262,432:1.803}[id]),'spokes stop at their supporting inner drum/rim');}
    }
    assert.equal(u.hideGround,true);assert.equal(u.animationTiming.targetCycleDuration,6);
    for(const bearing of b.bearings)assert.ok(!solidSurface(bearing.geometry).inside(new THREE.Vector3(0,0,bearing.geometry.userData?.plate?.low??.94)));
  }finally{disposeObject3D(model.root);}
});

for(const[id,create]of[[430,overshot],[432,breast]])test(`${id}: finite water stays between float boards, lips, inner drum and axial cheeks`,()=>{
  const model=create({id}),u=model.root.userData,b=u.blocks;
  try{
    const solids=[b.innerDrum,...(b.bucketGroups??b.floatBoards),...(b.bucketCheeks??[]),...(b.innerCheeks??[]),...(b.breastFloor?[b.breastFloor]:[])].flatMap(o=>{const meshes=[];o.traverse(m=>{if(m.isMesh)meshes.push(m);});return meshes;});
    const queries=solids.map(mesh=>({mesh,surface:solidSurface(mesh.geometry)}));
    for(let frame=0;frame<=96;frame++){
      model.update(frame*6/96);model.root.updateMatrixWorld(true);
      for(const water of b.bucketWaterBodies){if(!water.visible)continue;const p=water.geometry.attributes.position;
        for(let i=0;i<water.geometry.drawRange.count;i++){
          const world=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(water.matrixWorld);
          for(const{mesh,surface}of queries){const point=world.clone().applyMatrix4(mesh.matrixWorld.clone().invert());if(surface.inside(point)){const depth=surface.distance(point);assert.ok(depth<3e-7,`${id} water enters ${mesh.userData.role} at frame${frame}, depth${depth}`);}}
        }
      }
    }
  }finally{disposeObject3D(model.root);}
});
