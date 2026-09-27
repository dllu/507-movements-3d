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

const PAIRS=[['head','inputBevel','outputBevel','transferCenter'],['hub','shaftHubBevel','wheelBevel','wheelCenter']];

test('469 both finite mitre pairs share their apexes and match outer pitch generators',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),d=m.root.userData,b=d.blocks,g=d.geometry;
  for(const phase of [0,.15,.35,.55,.82]){
    m.update(phase*g.cycleDuration);m.root.updateMatrixWorld(true);
    for(const[name,first,second,apex]of PAIRS){
      const a=b[first].getWorldPosition(new THREE.Vector3()),z=b[second].getWorldPosition(new THREE.Vector3());
      assert.ok(a.distanceTo(z)<1e-12,name);assert.ok(a.distanceTo(g[apex])<1e-12,name);
      const axisA=new THREE.Vector3(0,0,1).transformDirection(b[first].matrixWorld),axisB=new THREE.Vector3(0,0,1).transformDirection(b[second].matrixWorld);
      assert.ok(Math.abs(axisA.dot(axisB))<1e-12,name);
      const point=a.clone().addScaledVector(axisA,.32).addScaledVector(axisB,.32);
      for(const gear of [b[first],b[second]]){
        const p=point.clone().applyMatrix4(gear.matrixWorld.clone().invert());
        assert.ok(Math.abs(p.z-.32)<1e-12);assert.ok(Math.abs(Math.hypot(p.x,p.y)-.32)<1e-12);
        assert.equal(gear.userData.toothMeshes.length,24);assert.equal(gear.userData.toothProfile,'back-cone-involute-approximation');
      }
    }
  }
});

test('469 pitch points of both mitre pairs move together in the rendered train',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),d=m.root.userData,b=d.blocks,g=d.geometry,dt=1e-5;
  for(const phase of [.1,.3,.5]){
    for(const[name,first,second,apex]of PAIRS){
      const contact=name==='head'?g.bevelLayout.headContact:g.bevelLayout.hubContact,P=g[apex].clone().addScaledVector(contact,.32*Math.SQRT2);
      m.update(phase*g.cycleDuration);m.root.updateMatrixWorld(true);
      const la=b[first].worldToLocal(P.clone()),lb=b[second].worldToLocal(P.clone());
      m.update(phase*g.cycleDuration+dt);m.root.updateMatrixWorld(true);
      const va=b[first].localToWorld(la).sub(P),vb=b[second].localToWorld(lb).sub(P);
      assert.ok(va.length()>1e-6,`${name} moves at ${phase}`);assert.ok(va.distanceTo(vb)<1e-3*va.length(),`${name} pitch velocities agree at ${phase}`);
    }
  }
});

test('469 actual bevel teeth, bodies and hubs clear with sustained close engagement',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),b=m.root.userData.blocks;
  const gears=Object.fromEntries(['inputBevel','outputBevel','shaftHubBevel','wheelBevel'].map(k=>[k,[packed(b[k]),packed(b[k],true)]]));
  for(let i=0;i<=48;i++){
    const angle=i*2*Math.PI/24/48;
    b.screwRotor.rotation.y=angle;b.transferShaftRotor.rotation.z=angle;b.waterWheelRotor.rotation.z=-angle;m.root.updateMatrixWorld(true);
    for(const[name,first,second]of PAIRS){
      const[a,aTeeth]=gears[first],[z,zTeeth]=gears[second];
      const distance=Math.min(separation(a,z,.01),separation(z,a,.01));
      assert.ok(distance>=0,`${name} finite bevel intersection at sample ${i}: ${distance}`);
      const flankDistance=Math.min(separation(aTeeth,zTeeth,.01),separation(zTeeth,aTeeth,.01));
      assert.ok(flankDistance<.0012,`${name} tooth flanks too far apart at sample ${i}: ${flankDistance}`);
    }
  }
});

test('469 finite shaft ends and bevel bores clear adjacent parts',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),b=m.root.userData.blocks;
  m.update(.3*m.root.userData.geometry.cycleDuration);m.root.updateMatrixWorld(true);
  for(const gear of [b.inputBevel,b.outputBevel,b.shaftHubBevel,b.wheelBevel])for(const mesh of [gear.userData.body,gear.userData.hub]){
    const surface=solidSurface(mesh.geometry);
    for(const z of [.22,.26,.30,.33])for(let i=0;i<32;i++){
      const p=new THREE.Vector3(.065*Math.cos(i*Math.PI/16),.065*Math.sin(i*Math.PI/16),z);
      assert.ok(surface.signedDistance(p)>.0018,'actual shaft fits bored bevel body/hub');
    }
  }
  const meshPart=mesh=>({root:mesh,points:surfacePoints(mesh.geometry),surface:solidSurface(mesh.geometry)});
  assert.ok(separation(meshPart(b.screwShaft),meshPart(b.transferShaft))>.05,'finite perpendicular shaft ends do not cross');
  const input=packed(b.inputBevel),barrel=meshPart(b.screwBarrel);
  assert.ok(Math.min(separation(input,barrel),separation(barrel,input))>.1-1e-8,'input bevel is above the barrel mouth');
  const hub=packed(b.shaftHubBevel),axle=meshPart(b.fixedWheelAxle);
  assert.ok(Math.min(separation(hub,axle),separation(axle,hub))>.02,'shaft S bevel clears the wheel stub axle');
});
