import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredTemperatureAirMachineMovement} from '../src/simulation/authored-temperature-air-machines.js';
import {mergePassageParts} from '../src/simulation/finite-fluid-passages.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

function packed(gear,teethOnly=false){
  const u=gear.userData,geometry=mergePassageParts((teethOnly?u.toothMeshes:[u.body,u.hub,...u.toothMeshes]).map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);}));
  return{root:u.rotor,surface:solidSurface(geometry),points:surfacePoints(geometry).filter((_,i)=>i%4===0)};
}
function separation(a,z,limit=.1){
  const matrix=z.root.matrixWorld.clone().invert().multiply(a.root.matrixWorld);let minimum=Infinity;
  for(const q of a.points)minimum=Math.min(minimum,z.surface.signedDistance(q.clone().applyMatrix4(matrix),limit));
  return minimum;
}

test('469 finite miter gears share the shaft apex and match outer pitch generators',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),d=m.root.userData,b=d.blocks,g=d.geometry;
  for(const phase of [0,.15,.35,.55,.82]){
    m.update(phase*g.cycleDuration);m.root.updateMatrixWorld(true);
    const a=b.inputBevel.getWorldPosition(new THREE.Vector3()),z=b.outputBevel.getWorldPosition(new THREE.Vector3());
    assert.ok(a.distanceTo(z)<1e-12);assert.ok(a.distanceTo(g.bevelApex)<1e-12);
    const axisA=new THREE.Vector3(0,0,1).transformDirection(b.inputBevel.matrixWorld),axisB=new THREE.Vector3(0,0,1).transformDirection(b.outputBevel.matrixWorld);
    assert.ok(Math.abs(axisA.dot(axisB))<1e-12);
    const point=a.clone().addScaledVector(axisA,.32).addScaledVector(axisB,.32);
    for(const gear of [b.inputBevel,b.outputBevel]){
      const p=point.clone().applyMatrix4(gear.matrixWorld.clone().invert());
      assert.ok(Math.abs(p.z-.32)<1e-12);assert.ok(Math.abs(Math.hypot(p.x,p.y)-.32)<1e-12);
      assert.equal(gear.userData.toothMeshes.length,24);assert.equal(gear.userData.toothProfile,'back-cone-involute-approximation');
    }
  }
});

test('469 actual bevel teeth, bodies and hubs clear with sustained close engagement',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),b=m.root.userData.blocks,a=packed(b.inputBevel),z=packed(b.outputBevel),aTeeth=packed(b.inputBevel,true),zTeeth=packed(b.outputBevel,true);
  for(let i=0;i<=48;i++){
    b.screwRotor.rotation.y=i*2*Math.PI/24/48;b.outputShaftRotor.rotation.z=-b.screwRotor.rotation.y;m.root.updateMatrixWorld(true);
    const distance=Math.min(separation(a,z,.01),separation(z,a,.01));
    assert.ok(distance>=0,`finite bevel intersection at sample ${i}: ${distance}`);
    const flankDistance=Math.min(separation(aTeeth,zTeeth,.01),separation(zTeeth,aTeeth,.01));
    assert.ok(flankDistance<.0012,`tooth flanks too far apart at sample ${i}: ${flankDistance}`);
  }
});

test('469 finite shaft ends, bevel bores and rear spur layer clear adjacent parts',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),b=m.root.userData.blocks;
  m.update(.3*m.root.userData.geometry.cycleDuration);m.root.updateMatrixWorld(true);
  for(const gear of [b.inputBevel,b.outputBevel])for(const mesh of [gear.userData.body,gear.userData.hub]){
    const surface=solidSurface(mesh.geometry);
    for(const z of [.22,.26,.30,.33])for(let i=0;i<32;i++){
      const p=new THREE.Vector3(.065*Math.cos(i*Math.PI/16),.065*Math.sin(i*Math.PI/16),z);
      assert.ok(surface.signedDistance(p)>.0018,'actual shaft fits bored bevel body/hub');
    }
  }
  const meshPart=mesh=>({root:mesh,points:surfacePoints(mesh.geometry),surface:solidSurface(mesh.geometry)});
  assert.ok(separation(meshPart(b.screwShaft),meshPart(b.outputAxle))>.05,'finite perpendicular shaft ends do not cross');
  const output=packed(b.outputBevel),spur=meshPart(b.transferPinion.userData.rotor.children[0]);
  assert.ok(Math.min(separation(output,spur),separation(spur,output))>.03,'spur stage is behind the conical teeth');
  const input=packed(b.inputBevel),barrel=meshPart(b.screwBarrel);
  assert.ok(Math.min(separation(input,barrel),separation(barrel,input))>.1-1e-8,'input bevel is above the barrel mouth');
});
