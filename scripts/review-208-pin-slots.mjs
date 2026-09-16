import fs from 'node:fs';import * as THREE from 'three';import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const model=createAuthoredGearMovement(JSON.parse(fs.readFileSync('src/data/movements.json')).movements[207]),u=model.root.userData,b=u.blocks,cache=new Map();
const data=mesh=>{if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return cache.get(mesh.geometry);};
let tested=0,inside=0,maxPenetration=0,maxGap=0,maxWorkingGap=0;
const samples=[];
for(let ring=0;ring<3;ring++)for(let i=0;i<33;i++)samples.push({state:u.selectedStateAtWheelTravel((i+.37)/33*2*Math.PI/u.transmission.ringPinCounts[ring],ring)});
for(let stage=0;stage<4;stage++)for(let i=0;i<=16;i++)samples.push({time:stage*u.selector.stageDuration+u.selector.dwellDuration+i/16*u.selector.shiftDuration});
for(const sample of samples){
 if(sample.state){const state=sample.state;b.pinWheel.userData.rotor.rotation.z=state.wheelAngle;b.slottedPinion.userData.rotor.rotation.z=state.pinionAngle;b.slottedPinion.position.x=state.selectorX;}else model.update(sample.time);model.root.updateMatrixWorld(true);
 let gap=Infinity;
 for(const group of b.pinRings)for(const pin of group.children.filter(p=>p.userData.pinWheelPin)){
  const bounds=new THREE.Box3().setFromObject(pin);
  for(const tooth of[b.pinionWeb,...b.pinionTeeth].filter(o=>o.visible)){const targetBounds=new THREE.Box3().setFromObject(tooth);if(bounds.distanceToPoint(targetBounds.getCenter(new THREE.Vector3()))>1.4)continue;
   const transform=tooth.matrixWorld.clone().invert().multiply(pin.matrixWorld),d=data(tooth);for(const point of data(pin).points){const p=point.clone().applyMatrix4(transform);const distance=d.surface.distance(p);gap=Math.min(gap,distance);tested++;if(distance>1e-6&&d.surface.inside(p)){inside++;maxPenetration=Math.max(maxPenetration,distance);}}
  }
 }
 maxGap=Math.max(maxGap,gap);if(sample.state)maxWorkingGap=Math.max(maxWorkingGap,gap);
}
const report={poses:samples.length,tested,inside,maxPenetration,maxGap,maxWorkingGap};console.log(report);fs.writeFileSync('/dev/shm/208-pin-slot-report.json',JSON.stringify(report));
