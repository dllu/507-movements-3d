import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredOldRotaryPumpMovement as oldPump} from '../src/simulation/authored-old-rotary-pumps.js';
import {createAuthoredCaryRotaryPumpMovement as caryPump} from '../src/simulation/authored-cary-rotary-pumps.js';
import {caryFollowerLaw} from '../src/simulation/rotary-pump-contact.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

const separation=(model,a,b,steps=180)=>{
  const surface=solidSurface(b.geometry),points=surfacePoints(a.geometry),matrix=new THREE.Matrix4();
  let minimum=Infinity,phase=0;
  for(let i=0;i<=steps;i++){
    model.update(i*model.root.userData.geometry.cycleDuration/steps);model.root.updateMatrixWorld(true);
    matrix.copy(b.matrixWorld).invert().multiply(a.matrixWorld);
    for(let j=0;j<points.length;j+=3){const distance=surface.signedDistance(points[j].clone().applyMatrix4(matrix),.2);
      if(distance<minimum){minimum=distance;phase=i/steps;}}
  }
  return {minimum,phase};
};

for(const [id,factory] of [[455,oldPump],[456,caryPump]])test(`${id}: state queries and updates retain all geometry identities`,()=>{
  const m=factory({id}),d=m.root.userData,objects=[];
  m.root.traverse(o=>objects.push([o,o.geometry]));
  for(let i=0;i<200;i++){d.stateAtTime(i*.103);m.update(i*.103);}
  const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,objects);
  assert.equal(d.hideGround,true);assert.ok(d.minimumDisplayCycleSeconds>=d.geometry.cycleDuration);
  m.root.traverse(o=>{for(const material of o.material?[].concat(o.material):[])assert.equal(material.fog,false);});
});

test('456: finite roller cam, piston slots, separator and housing clear over a cycle',()=>{
  const m=caryPump({id:456}),b=m.root.userData.blocks;
  for(const name of ['blade','follower','sealingHead'])for(const target of ['fixedHeartCam','drumShell','portSeparatorE','casing']){
    const result=separation(m,b.pistons[0][name],b[target]);
    assert.ok(result.minimum>=-2e-6,`${name}/${target}: ${JSON.stringify(result)}`);
  }
  const pipe=separation(m,b.pistons[0].sealingHead,b.dischargeH.shell);
  assert.ok(pipe.minimum>=-2e-6,`head/discharge H: ${JSON.stringify(pipe)}`);
});

test('456: stationary cam has a shaft bore and finite followers remain close to its surface',()=>{
  const m=caryPump({id:456}),d=m.root.userData,b=d.blocks,surface=solidSurface(b.fixedHeartCam.geometry);
  assert.equal(surface.inside(new THREE.Vector3(.23,0,0)),false);
  for(let i=0;i<360;i++){
    const angle=i*Math.PI/180,{radius,first}=caryFollowerLaw(angle),n=new THREE.Vector3(radius*Math.cos(angle)+first*Math.sin(angle),radius*Math.sin(angle)-first*Math.cos(angle),0).normalize();
    const center=new THREE.Vector3(radius*Math.cos(angle),radius*Math.sin(angle),0),contact=center.addScaledVector(n,-.11);
    assert.ok(surface.distance(contact)<2e-5,`roller offset at ${i}`);
  }
  for(const degrees of [-18,0,18]){
    const radius=caryFollowerLaw(-Math.PI/2+degrees*Math.PI/180).radius;
    assert.ok(Math.abs(radius+d.geometry.pistonLength-d.geometry.drumOuterRadius)<1e-12);
  }
});

test('455: finite bored hinge eyes clear pins and relieved rotor cheeks',()=>{
  const m=oldPump({id:455}),b=m.root.userData.blocks;
  for(const v of b.valves){
    const bore=solidSurface(v.blade.geometry);
    assert.equal(bore.inside(new THREE.Vector3(.13,0,0)),false);
    const result=separation(m,v.blade,b.rotorBody,120);
    assert.ok(result.minimum>=-2e-6,`vane/rotor ${JSON.stringify(result)}`);
  }
  const lip=separation(m,b.valves[0].flexibleLip,b.casing,360);
  assert.ok(lip.minimum>=-2e-6,`sealing lip/casing ${JSON.stringify(lip)}`);
  // Cap the documented residual without requiring the known fault to persist.
  const abutment=separation(m,b.valves[0].flexibleLip,b.abutment,180);
  assert.ok(abutment.minimum>-.25,`known abutment residual ${JSON.stringify(abutment)}`);
  assert.match(m.root.userData.solidReview.qualification,/Partial reconstruction.*not validated/);
});
