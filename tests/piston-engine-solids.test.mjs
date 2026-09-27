import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredSquarePistonEngineMovement} from '../src/simulation/authored-square-piston-engines.js';
import {createAuthoredEccentricRotaryEngineMovement} from '../src/simulation/authored-eccentric-rotary-engines.js';
import {createAuthoredRadialPistonRotaryEngineMovement} from '../src/simulation/authored-radial-piston-rotary-engines.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {pointInMulti} from '../src/simulation/steam-section-kit.js';

function clearCycle(model,pairs) {
  const surfaces=new Map(),points=new Map();
  const query=mesh=>{if(!surfaces.has(mesh))surfaces.set(mesh,solidSurface(mesh.geometry));return surfaces.get(mesh);};
  const samples=mesh=>{if(!points.has(mesh)){const all=surfacePoints(mesh.geometry),stride=Math.max(1,Math.floor(all.length/2000));points.set(mesh,all.filter((_,i)=>i%stride===0));}return points.get(mesh);};
  const checks=pairs.flatMap(([a,b])=>[[a,b],[b,a]]).map(([from,to])=>({from,to,surface:query(to),points:samples(from)}));
  for(let frame=0;frame<=64;frame++){
    model.update(frame*model.root.userData.geometry.cycleDuration/64);model.root.updateMatrixWorld(true);
    for(const {from,to,surface,points}of checks){
      if(!new THREE.Box3().setFromObject(from).intersectsBox(new THREE.Box3().setFromObject(to)))continue;
      const matrix=to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      for(const point of points){const p=point.clone().applyMatrix4(matrix);
        if(surface.inside(p)){const depth=surface.distance(p);assert.ok(depth<3e-7,
          `${from.userData.role} enters ${to.userData.role}: frame ${frame}, depth ${depth}`);}
      }
    }
  }
}
const factories=[[424,createAuthoredSquarePistonEngineMovement],[425,createAuthoredEccentricRotaryEngineMovement],[426,createAuthoredRadialPistonRotaryEngineMovement]];
for(const[id,create]of factories)test(`${id}: actual working piston, chamber and guide solids clear through one revolution`,()=>{
  const model=create({id}),u=model.root.userData,b=u.blocks;try{
    const pairs=[];
    if(id===424){
      // pass 71: B slides in A, C in B; the crank works in the pocket behind C
      for(const part of[b.bFront,b.bBack])pairs.push([part,b.cylinderA],[part,b.back],[part,b.cFront],[part,b.cBack]);
      for(const part of[b.cFront,b.cBack,b.wristA])pairs.push([part,b.cylinderA],[part,b.back]);
      for(const part of[b.crankArm,b.shaftB])pairs.push([part,b.cFront],[part,b.cBack],[part,b.back],[part,b.boss]);
      pairs.push([b.crankArm,b.wristA]);
    }else if(id===425){
      // pass 71: eccentric C on B, abutment D riding on C in its guide
      for(const moving of[b.pistonC,b.packing,b.abutmentD,b.shaftB])pairs.push([moving,b.casing],[moving,b.back]);
      pairs.push([b.abutmentD,b.pistonC],[b.abutmentD,b.packing]);
    }else{
      // 426 (pass 69): the pistons slide in the grooves of C and follow the
      // cylinder wall between the two abutments.
      for(const piston of b.pistons)pairs.push([piston,b.casing],[piston,b.hubC],[piston,b.back],[piston,b.shaftB]);
      pairs.push([b.pistons[0],b.pistons[1]],[b.hubC,b.casing]);
      const hub=solidSurface(b.hubC.geometry);
      assert.ok(!hub.inside(new THREE.Vector3(2,0,-.8)),'radial groove is cut into the hub');
      assert.ok(hub.inside(new THREE.Vector3(0,2,-.8)),'hub is solid between the grooves');
    }
    assert.equal(u.hideGround,true);model.root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])assert.equal(material.fog,false);});
    clearCycle(model,pairs);
  }finally{disposeObject3D(model.root);}
});

test('426: corrected finite working surfaces retain near contact across the entire cycle',()=>{
  for(const[id,create]of factories.slice(2)){
    const model=create({id}),u=model.root.userData,b=u.blocks;
    try{
      {
        // 426: each piston's round end runs just clear of the cylinder wall
        // everywhere outside the port mouths.
        const wall=solidSurface(b.casing.geometry);
        for(let frame=0;frame<=64;frame++){
          const time=frame*u.geometry.cycleDuration/64;model.update(time);model.root.updateMatrixWorld(true);
          const state=u.stateAtTime(time);
          for(const p of state.pistons){
            const center=new THREE.Vector3(p.tipCenterRadius*Math.cos(p.angle),p.tipCenterRadius*Math.sin(p.angle),-.8);
            const local=center; // casing sits unscaled in the model root
            const gap=wall.distance(local)-u.geometry.pistonHalfWidth;
            const atMouth=[.05,.2,.4,.6].some(extra=>Object.values(u.geometry.channels).some(channel=>pointInMulti(
              [(p.outerRadius+extra)*Math.cos(p.angle),(p.outerRadius+extra)*Math.sin(p.angle)],channel)));
            if(!atMouth)assert.ok(gap>0&&gap<.04,`round end of A runs just clear of the wall (${gap})`);
          }
        }
      }
    }finally{disposeObject3D(model.root);}
  }
});
