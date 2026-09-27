import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {createAuthoredDoubleActingPumpMovement as a} from '../src/simulation/authored-double-acting-pumps.js';
import {createAuthoredLanternBellowsPumpMovement as b} from '../src/simulation/authored-lantern-bellows-pumps.js';
import {createAuthoredDiaphragmPumpMovement as c} from '../src/simulation/authored-diaphragm-pumps.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
for(const[id,create]of[[452,a],[453,b],[454,c]])test(`${id}: finite moving rods and valves clear actual fixed walls and seats`,()=>{
const m=create({id}),u=m.root.userData,b=u.blocks,moving=[],fixed=[];
const movers=id===452?[b.piston,b.pistonRod,b.rodTopMarker,...['upperSuctionValve1','lowerSuctionValve2','lowerDischargeValve3','upperDischargeValve4'].map(k=>b[k].userData.disk)]:id===453?[b.beam,b.leftConnectingRod,b.rightConnectingRod,b.leftTopPlate,b.rightTopPlate,...['leftSuctionValve','rightSuctionValve','leftDeliveryValve','rightDeliveryValve'].map(k=>b[k].userData.disk)]:[b.lever,b.connectingRod,b.centerClamp,b.suctionValve,b.deliveryValve];
for(const parent of movers)parent.traverse(o=>{if(o.isMesh){const p=surfacePoints(o.geometry);moving.push({o,p:p.filter((_,i)=>i%Math.max(1,Math.floor(p.length/700))===0)});}});
const targets=id===452?[b.barrel,b.upperCover,b.lowerCover,b.stuffingBox,b.suctionManifold,b.dischargeManifold,b.backPlate,...['upperSuctionValve1','lowerSuctionValve2','lowerDischargeValve3','upperDischargeValve4'].flatMap(k=>b[k].children.slice(0,2))]:id===453?[b.pivotAxle,b.standard,b.valveChest,b.chestBottom,b.chestPartitions,b.suctionChannel,...['commonDischarge','commonSuction'].map(k=>b[k].shell),...['leftSuctionValve','rightSuctionValve','leftDeliveryValve','rightDeliveryValve'].flatMap(k=>[b[k].userData.pin,b[k].userData.journals])]:[b.pivotAxle,b.pivotStandard,b.chamberRim,b.chamberBottom,b.chamberShell,...['suctionPipe','deliveryBranch','deliveryRiser'].map(k=>b[k].shell),...['suctionValve','deliveryValve'].flatMap(k=>[b[k].userData.body,b[k].userData.seat])];
for(const parent of targets)parent.traverse(o=>{if(o.isMesh)fixed.push({o,s:solidSurface(o.geometry)})});
try{for(let i=0;i<65;i++){m.update(i*u.geometry.cycleDuration/64);m.root.updateMatrixWorld(true);for(const{o,p}of moving)for(const{o:t,s}of fixed){const key=(o.userData.role??o.parent.userData.role)+' / '+(t.userData.role??t.parent.userData.role);if(!new THREE.Box3().setFromObject(o).intersectsBox(new THREE.Box3().setFromObject(t)))continue;const matrix=t.matrixWorld.clone().invert().multiply(o.matrixWorld);for(const q of p){const v=q.clone().applyMatrix4(matrix);if(s.inside(v))assert.ok(s.distance(v)<3e-7,`${key}, frame ${i}, depth ${s.distance(v)}`);}}}}finally{disposeObject3D(m.root);}});

for (const [id, create] of [[452,a],[453,b],[454,c]]) {
  test(`${id}: state queries and playback preserve every scene object and geometry`, () => {
    const model=create({id});
    try {
      const snapshot=()=>{const entries=[];model.root.traverse(o=>entries.push([o,o.geometry]));return entries;};
      const before=snapshot(),u=model.root.userData;
      for(let i=0;i<300;i++){u.stateAtInputAngle(i*.09);u.stateAtTime(i*.07);model.update(i*.07);}
      assert.deepEqual(snapshot(),before);
      assert.equal(u.minimumDisplayCycleSeconds,u.geometry.cycleDuration);
      assert.equal(u.hideGround,true);
    } finally {disposeObject3D(model.root);}
  });
}

for (const [id,create] of [[453,b],[454,c]]) {
  test(`${id}: finite link eyes remain coaxial with both connecting pins`,()=>{
    const model=create({id}),u=model.root.userData,parts=u.blocks;
    try {
      const links=id===453?[[parts.leftConnectingRod,parts.leftTopPlate,-u.geometry.beamPinHalfSpan],[parts.rightConnectingRod,parts.rightTopPlate,u.geometry.beamPinHalfSpan]]:[[parts.connectingRod,parts.centerClamp,u.geometry.leverPinRadius]];
      for(let i=0;i<=128;i++){
        model.update(i*u.geometry.cycleDuration/128);model.root.updateMatrixWorld(true);
        for(const[rod,plate,x]of links){
          const low=new THREE.Vector3(0,-.5,0).applyMatrix4(rod.matrixWorld),high=new THREE.Vector3(0,.5,0).applyMatrix4(rod.matrixWorld);
          const lowPin=new THREE.Vector3(0,u.geometry.linkEyeHeight,.34).applyMatrix4(plate.matrixWorld);
          const highPin=new THREE.Vector3(x,0,.34).applyMatrix4((parts.beam??parts.lever).matrixWorld);
          assert.ok(low.distanceTo(lowPin)<1e-7,'lower link eye follows the raised plate pin');
          assert.ok(high.distanceTo(highPin)<1e-7,'upper link eye follows the beam pin');
          for(const target of [plate,parts.beam??parts.lever])target.traverse(mesh=>{
            if(!mesh.isMesh)return;
            const surface=solidSurface(mesh.geometry),matrix=mesh.matrixWorld.clone().invert().multiply(rod.matrixWorld);
            const points=surfacePoints(rod.geometry);
            for(let j=0;j<points.length;j+=7){const p=points[j].clone().applyMatrix4(matrix);if(surface.inside(p))assert.ok(surface.distance(p)<3e-7,`${id}: link enters ${mesh.userData.role??'joint body'}`);}
          });
        }
      }
    } finally {disposeObject3D(model.root);}
  });
}

test('452: stuffing box and upper cover leave a real continuous rod bore',()=>{
  const model=a({id:452}),parts=model.root.userData.blocks;
  try {
    for(const mesh of [parts.upperCover,...parts.stuffingBox.children]){
      const surface=solidSurface(mesh.geometry),box=new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
      for(let i=0;i<=16;i++)assert.equal(surface.inside(new THREE.Vector3(0,THREE.MathUtils.lerp(box.min.y,box.max.y,i/16),0)),false);
    }
  } finally {disposeObject3D(model.root);}
});
