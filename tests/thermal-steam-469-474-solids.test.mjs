import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredTemperatureAirMachineMovement as airMachine} from '../src/simulation/authored-temperature-air-machines.js';
import {createAuthoredAeolipileMovement as aeolipile} from '../src/simulation/authored-aeolipiles.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

function separation(model,a,b,steps=96){
  const surface=solidSurface(b.geometry),points=surfacePoints(a.geometry),matrix=new THREE.Matrix4();let minimum=Infinity;
  for(let i=0;i<=steps;i++){
    model.update(model.root.userData.geometry.cycleDuration*i/steps);model.root.updateMatrixWorld(true);matrix.copy(b.matrixWorld).invert().multiply(a.matrixWorld);
    for(let j=0;j<points.length;j+=5)minimum=Math.min(minimum,surface.signedDistance(points[j].clone().applyMatrix4(matrix),.1));
  }
  return minimum;
}
for(const [id,factory]of [[469,airMachine],[474,aeolipile]])test(`${id}: pure state/update preserves scene and readable minimum timing`,()=>{
  const model=factory({id}),objects=[];model.root.traverse(o=>objects.push([o,o.geometry]));
  for(let i=0;i<100;i++){model.root.userData.stateAtTime(i*.037);model.update(i*.037);}
  const after=[];model.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,objects);
  assert.equal(model.root.userData.hideGround,true);assert.ok(model.root.userData.minimumDisplayCycleSeconds>=6);
  model.root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])assert.equal(m.fog,false);});
});

test('469: solid flight, casing fitted through the air vessel wall, bored wheel hub and open air tube',()=>{
  const m=airMachine({id:469}),d=m.root.userData,b=d.blocks,g=d.geometry;
  assert.equal(b.screwFlight.geometry.userData.thread.inner,.065);assert.equal(b.screwFlight.geometry.userData.thread.outer,.30);
  assert.equal(b.wheelSpokes.length,6);
  for(const [name,a,z]of [['casing through vessel wall',b.screwBarrel,b.receiver],['wheel bore',b.fixedWheelAxle,b.wheelHub],['wheel bevel bore',b.fixedWheelAxle,b.wheelBevel.userData.body]])assert.ok(separation(m,a,z,24)>-2e-6,name);
  const conduit=solidSurface(b.airConduit.geometry),vessel=solidSurface(b.receiver.geometry);
  for(let i=1;i<100;i++)assert.equal(conduit.inside(d.pressurePipeCurve.getPointAt(i/100)),false,'open air pipe');
  // The tube's mouth opens into the vessel: its bore is not closed by the roof.
  assert.equal(vessel.inside(d.pressurePipeCurve.getPointAt(0).clone().add(new THREE.Vector3(0,-.025,0))),false,'roof bored for the air tube');
  // The screw casing runs clear of both cistern walls (it no longer passes through them).
  const walls=[b.coldTank,b.warmTank].flatMap(t=>t.children.filter(o=>/end-wall-(left|right)$/.test(o.userData.role)));
  for(const wall of walls)assert.ok(separation(m,b.screwBarrel,wall,8)>.02,wall.userData.role);
  assert.ok(d.geometry.bubbleBaseRadius<.074);
});

test('474: hollow sphere has all six real ports and nozzle centerlines clear its shell and band',()=>{
  const m=aeolipile({id:474}),d=m.root.userData,b=d.blocks,shell=solidSurface(b.globe.geometry),band=solidSurface(b.rotationBand.geometry);
  assert.equal(shell.inside(new THREE.Vector3()),false);
  for(const dir of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),...Array.from({length:4},(_,i)=>new THREE.Vector3(0,Math.cos(d.solidReview.nozzlePortOffset+i*Math.PI/2),Math.sin(d.solidReview.nozzlePortOffset+i*Math.PI/2)))])for(const radius of [1.15,1.18,1.22])assert.equal(shell.inside(dir.clone().multiplyScalar(radius)),false,'open spherical port');
  assert.equal(shell.inside(new THREE.Vector3(.2,1.17,.1)),true,'finite spherical wall');
  for(let i=0;i<4;i++){
    const a=d.geometry.sourcePoseNozzleOffset+i*Math.PI/2,n=new THREE.Vector3(0,Math.cos(a),Math.sin(a)),t=new THREE.Vector3(0,-Math.sin(a),Math.cos(a));
    for(let k=0;k<=20;k++)for(let j=0;j<12;j++){
      const p=n.clone().multiplyScalar(1.09+k*.008).addScaledVector(t,-.30+.065*Math.sin(j*Math.PI/6));p.x=.065*Math.cos(j*Math.PI/6);
      assert.ok(shell.signedDistance(p)>.005,'finite nozzle bore section clears the spherical port');
    }
  }
  b.rotationBand.updateMatrix();const inverse=b.rotationBand.matrix.clone().invert();
  for(const pipe of b.nozzlePipes){const wall=solidSurface(pipe.geometry);for(let i=1;i<100;i++){
    const p=pipe.userData.flowCurve.getPointAt(i/100);assert.equal(shell.inside(p),false,'nozzle path through globe');assert.equal(wall.inside(p),false,'open nozzle bore');assert.equal(band.inside(p.clone().applyMatrix4(inverse)),false,'band does not plug nozzle');
  }}
});

test('474: fixed steam necks and rotary trunnions clear bored stationary collars',()=>{
  const m=aeolipile({id:474}),b=m.root.userData.blocks;
  for(let i=0;i<2;i++){
    assert.ok(separation(m,b.fixedFeedPipes[i],b.rotatingTrunnions[i],24)>.005);
    assert.ok(separation(m,b.rotatingTrunnions[i],b.stationaryBearingCollars[i],24)>.003);
  }
  const lid=solidSurface(b.boilerLid.geometry);b.boilerLid.updateMatrix();const inverse=b.boilerLid.matrix.clone().invert();
  const portX=m.root.userData.geometry.riserLidPortCenterX;for(const x of [-portX,portX])for(const y of [.35,.42,.49])assert.equal(lid.inside(new THREE.Vector3(x,y,0).applyMatrix4(inverse)),false,'open boiler feed port');
});
