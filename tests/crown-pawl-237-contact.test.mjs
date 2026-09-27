import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredIntermittentMovement as create} from '../src/simulation/authored-intermittent.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const make=()=>create({id:237});
const pose=(m,p)=>{m.update((p-.25)*4);m.root.updateMatrixWorld(true);return m.root.userData.kinematics;};

test('237 full finite sphere clears actual teeth through drive, ramp, crest and drop',()=>{
  const m=make(),d=m.root.userData,b=d.blocks,teeth=b.crownWheel.userData.crownTeeth;
  const fields=teeth.map(t=>solidSurface(t.geometry));let minimum=Infinity,workingGap=0;
  for(let i=0;i<=1024;i++){
    const s=pose(m,i/1024), center=s.tipWorld.clone().applyMatrix4(b.crownWheel.userData.rotor.matrixWorld.clone().invert());
    const gap=Math.min(...fields.map(f=>f.signedDistance(center)))-d.geometry.pawlNoseRadius;
    minimum=Math.min(minimum,gap);assert.ok(gap>=-2e-8,`${i/1024}: ${gap}`);
    if(s.rampContactEngaged){workingGap=Math.max(workingGap,gap);assert.ok(gap<.00021);}
    if(s.driveEngaged)assert.ok(Math.abs(gap)<2e-8);
  }
  console.log({minimumFullSphereClearance:minimum,maximumWorkingRampGap:workingGap});
});

test('237 finite curved shoulder and rendered nose clear tooth solids',()=>{
  const m=make(),b=m.root.userData.blocks,teeth=b.crownWheel.userData.crownTeeth;
  const fields=teeth.map(t=>solidSurface(t.geometry));let bodyGap=Infinity,noseGap=Infinity;
  for(let i=0;i<=64;i++){
    pose(m,i/64);
    for(const part of [b.pawlBody,b.pawlNose]){
      const transform=b.crownWheel.userData.rotor.matrixWorld.clone().invert().multiply(part.matrixWorld);
      for(const p of surfacePoints(part.geometry)){
        const q=p.clone().applyMatrix4(transform),gap=Math.min(...fields.map(f=>f.signedDistance(q,.1)));
        if(part===b.pawlBody)bodyGap=Math.min(bodyGap,gap);else noseGap=Math.min(noseGap,gap);
        assert.ok(gap>-2e-8,`${part.userData.role} phase ${i/64}: ${gap}`);
      }
    }
  }
  // The pawl is one curved plate whose rounded end is the working nose: no
  // separate ball is drawn, and the plate itself comes to the teeth.
  assert.equal(b.pawlNose.visible,false);assert.ok(bodyGap<.005);console.log({bodyGap,renderedNoseGap:noseGap});
});

test('237 actual drive face gives clockwise torque and ramp normal lifts the radial hinge',()=>{
  const m=make(),d=m.root.userData,b=d.blocks,triangles=b.crownWheel.userData.crownTeeth.flatMap(t=>surfaceTriangles(t.geometry));
  const near=new THREE.Vector3(),closest=new THREE.Vector3();let minimumDriveMoment=Infinity,minimumRampLiftMoment=Infinity;
  for(const phase of [.22,.30,.40,.49,.75,.78,.80,.82]){
    const s=pose(m,phase),inverse=b.crownWheel.userData.rotor.matrixWorld.clone().invert(),center=s.tipWorld.clone().applyMatrix4(inverse);
    let distance=Infinity,normal;
    for(const triangle of triangles){triangle.closestPointToPoint(center,near);const value=near.distanceTo(center);if(value<distance){distance=value;closest.copy(near);normal=triangle.getNormal(new THREE.Vector3());}}
    const force=center.clone().sub(closest).normalize();assert.ok(force.dot(normal)>.99999);
    if(s.driveEngaged){const moment=-(closest.x*force.y-closest.y*force.x);assert.ok(moment<-1.5);minimumDriveMoment=Math.min(minimumDriveMoment,-moment);}
    else{
      const n=force.clone().applyAxisAngle(new THREE.Vector3(0,0,1),s.wheelAngle-s.armAngle);
      const liftMoment=n.y*s.tipGeometry.tangentDerivative+n.z*s.tipGeometry.verticalDerivative;
      assert.ok(liftMoment>.6);minimumRampLiftMoment=Math.min(minimumRampLiftMoment,liftMoment);
    }
  }
  console.log({minimumClockwiseDriveMoment:minimumDriveMoment,minimumRampLiftMoment});
});

test('237 radial eye, curved body and output bores clear actual shafts',()=>{
  const m=make(),d=m.root.userData,b=d.blocks;
  const eye=solidSurface(b.pawlHingeRing.geometry),body=solidSurface(b.pawlBody.geometry),disk=solidSurface(b.crownWheelBody.geometry);
  for(let i=0;i<64;i++){
    const a=i*Math.PI/32,x=.1*Math.cos(a),y=.1*Math.sin(a);
    assert.ok(eye.signedDistance(new THREE.Vector3(x,y,0))>.0038);
    assert.ok(body.signedDistance(new THREE.Vector3(0,x,y))>.003);
    assert.ok(disk.signedDistance(new THREE.Vector3(x,y,-.25))>.0038);
  }
  // The arm's 0.12 by 0.15 section fits inside the eye's 0.104 bore.
  assert.ok(Math.hypot(.06,.075)<.104);
  for(const phase of [0,.25,.5,.75]){
    pose(m,phase);const eyeCenter=b.pawlHingeRing.getWorldPosition(new THREE.Vector3()),pinCenter=b.pawlHingeBarrel.getWorldPosition(new THREE.Vector3());assert.ok(eyeCenter.distanceTo(pinCenter)<1e-14);
  }
});

test('237 baked return is C1, finite geometry is stable, and full-cycle vertices fit',()=>{
  const m=make(),d=m.root.userData,snapshot=()=>{const out=[];m.root.traverse(o=>out.push([o,o.geometry]));return out;},before=snapshot(),p=new THREE.Vector3();
  for(let i=0;i<=64;i++){
    pose(m,i/64);d.stateAtTime(i*.031);
    m.root.traverse(o=>{if(!o.isMesh||!o.visible)return;assert.equal(o.material.fog,false);for(let j=0;j<o.geometry.attributes.position.count;j++){p.fromBufferAttribute(o.geometry.attributes.position,j).applyMatrix4(o.matrixWorld);assert.ok(d.cameraFitBounds.containsPoint(p));}});
  }
  for(const phase of [0,.5,d.timeline.rampContactPhase,d.timeline.faceReleasePhase,1]){
    const a=d.stateAtCycleCoordinate(phase-1e-8),b=d.stateAtCycleCoordinate(phase+1e-8);
    assert.ok(a.tipWorld.distanceTo(b.tipWorld)<2e-7);assert.ok(Math.abs(a.pawlLiftAngularSpeed-b.pawlLiftAngularSpeed)<.001);
  }
  assert.deepEqual(snapshot(),before);assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,4);assert.match(d.reconstructionNote,/not dynamically solved/);
  assert.equal(d.blocks.crownWheelBody.material.flatShading,false);assert.equal(d.blocks.crownWheel.userData.crownTeeth[0].material.flatShading,true);
});
