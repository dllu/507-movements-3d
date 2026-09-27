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
function near(a,b,t,msg){assert.ok(Math.abs(a-b)<=t,`${msg}: ${a} vs ${b}`);}
function separation(a,z,limit=.1){
  const matrix=z.root.matrixWorld.clone().invert().multiply(a.root.matrixWorld);let minimum=Infinity;
  for(const q of a.points)minimum=Math.min(minimum,z.surface.signedDistance(q.clone().applyMatrix4(matrix),limit));
  return minimum;
}

const PAIRS=[['head','inputBevel','outputBevel','transferCenter']];

test('469 the finite head mitre pair shares their apexes and match outer pitch generators',()=>{
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

test('469 pitch points of the head mitre pair move together in the rendered train',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),d=m.root.userData,b=d.blocks,g=d.geometry,dt=1e-5;
  for(const phase of [.1,.3,.5]){
    for(const[name,first,second,apex]of PAIRS){
      const contact=g.bevelLayout.headContact,P=g[apex].clone().addScaledVector(contact,.32*Math.SQRT2);
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
  const gears=Object.fromEntries(['inputBevel','outputBevel'].map(k=>[k,[packed(b[k]),packed(b[k],true)]]));
  for(let i=0;i<=48;i++){
    const angle=i*2*Math.PI/24/48;
    b.screwRotor.rotation.y=angle;b.transferShaftRotor.rotation.z=angle;b.waterWheelRotor.rotation.z=-angle*m.root.userData.geometry.faceGearRatio;m.root.updateMatrixWorld(true);
    for(const[name,first,second]of PAIRS){
      const[a,aTeeth]=gears[first],[z,zTeeth]=gears[second];
      const distance=Math.min(separation(a,z,.01),separation(z,a,.01));
      assert.ok(distance>=0,`${name} finite bevel intersection at sample ${i}: ${distance}`);
      const flankDistance=Math.min(separation(aTeeth,zTeeth,.01),separation(zTeeth,aTeeth,.01));
      // Pass 70: the pairs are enlarged about their apexes, so the backlash scales too.
      assert.ok(flankDistance<.0012*b[first].userData.scale,`${name} tooth flanks too far apart at sample ${i}: ${flankDistance}`);
    }
  }
});

test('469 finite shaft ends and bevel bores clear adjacent parts',()=>{
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
  assert.ok(separation(meshPart(b.screwShaft),meshPart(b.transferShaft))>.05,'finite perpendicular shaft ends do not cross');
  const input=packed(b.inputBevel),barrel=meshPart(b.screwBarrel);
  // Pass 70: Brown's larger head bevel comes closer to the barrel mouth.
  assert.ok(Math.min(separation(input,barrel),separation(barrel,input))>.04,'input bevel is above the barrel mouth');
  const shaft=meshPart(b.transferShaft),axle=meshPart(b.fixedWheelAxle);
  assert.ok(Math.min(separation(shaft,axle),separation(axle,shaft))>.02,'shaft S end clears the wheel stub axle');
});

// Pass 72: Brown's wheel carries a face gear turned by a pinion on S.
function packedParts(meshes,root){
  const geometry=mergePassageParts(meshes.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);}));
  return{root,surface:solidSurface(geometry),points:surfacePoints(geometry).filter((_,i)=>i%2===0)};
}

test('469 face gear is generated by its pinion: rendered teeth clear with close engagement over a tooth period',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),b=m.root.userData.blocks,g=m.root.userData.geometry;
  assert.equal(b.faceGear.userData.toothMeshes.length,48);assert.equal(g.facePinionTeeth,12);
  // The pinion axis lies on S, parallel to the wheel face, at one pinion
  // pitch radius in front of the face gear's pitch plane.
  near(g.faceGearRatio,12/48,1e-15,'ratio');near(g.faceGearPitchRadius/g.facePinionPitchRadius,4,1e-12,'pitch radii');
  assert.ok(g.faceGearInnerRadius<g.facePinionCenterRadius&&g.facePinionCenterRadius<g.faceGearOuterRadius);
  const pinion=packedParts([b.facePinion.userData.body],b.facePinion),teeth=packedParts(b.faceGear.userData.toothMeshes,b.faceGear),disk=packedParts([b.faceGear.userData.body],b.faceGear);
  for(let i=0;i<=24;i++){
    const angle=i*2*Math.PI/12/24;
    b.transferShaftRotor.rotation.z=angle;b.waterWheelRotor.rotation.z=-g.faceGearRatio*angle;m.root.updateMatrixWorld(true);
    const flank=Math.min(separation(pinion,teeth,.02),separation(teeth,pinion,.02));
    assert.ok(flank>=0,`face pair intersects at sample ${i}: ${flank}`);
    assert.ok(flank<.0025,`face pair disengages at sample ${i}: ${flank}`);
    assert.ok(Math.min(separation(pinion,disk,.05),separation(disk,pinion,.05))>.004,`pinion clears the face-gear disk at ${i}`);
  }
});

test('469 face-gear pitch points move together in the rendered train',()=>{
  const m=createAuthoredTemperatureAirMachineMovement({id:469}),b=m.root.userData.blocks,g=m.root.userData.geometry,dt=1e-5;
  const P=g.wheelCenter.clone().addScaledVector(g.transferShaftDirection,-g.faceGearPitchRadius).add(new THREE.Vector3(0,0,-g.facePinionPitchRadius));
  for(const phase of [.1,.3,.5]){
    m.update(phase*g.cycleDuration);m.root.updateMatrixWorld(true);
    const la=b.facePinion.worldToLocal(P.clone()),lb=b.faceGear.worldToLocal(P.clone());
    m.update(phase*g.cycleDuration+dt);m.root.updateMatrixWorld(true);
    const va=b.facePinion.localToWorld(la).sub(P),vb=b.faceGear.localToWorld(lb).sub(P);
    assert.ok(va.length()>1e-6,`moves at ${phase}`);assert.ok(va.distanceTo(vb)<1e-3*va.length(),`face pitch velocities agree at ${phase}`);
  }
});
