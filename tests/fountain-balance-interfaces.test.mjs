import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Matrix4} from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
function clear(moving,fixed,label){
 const surface=solidSurface(fixed.geometry), transform=new Matrix4().copy(fixed.matrixWorld).invert().multiply(moving.matrixWorld);
 let minimum=Infinity;
 for(const p of surfacePoints(moving.geometry))minimum=Math.min(minimum,surface.signedDistance(p.applyMatrix4(transform),.1));
 assert.ok(minimum>=-2e-6,`${label}: penetration ${minimum}`);
}
for(const id of [464,465])test(`${id} finite working interfaces clear through a cycle`,()=>{
 const model=createMovementModel(catalog[id-1]),d=model.root.userData,b=d.blocks;
 for(let i=0;i<=32;i++){
  model.update(d.geometry.cycleDuration*(i+.137)/33);model.root.updateMatrixWorld(true);
  if(id===464){
   for(const wall of[b.bowl,...b.intermediateVessel.children.filter(o=>o.userData.role==='closed-bowl-end-wall')])clear(b.intermediateWater,wall,`464 water/bowl ${i}`);
   for(const [water,pipe]of[[b.rightDrainWater,b.rightDrainOuter],[b.centralRiserWater,b.centralRiser],[b.centralRiserWater,b.nozzle],[b.airCore,b.leftAirPipe]])clear(water,pipe,`464 pipe core ${i}`);
   for(const pipe of[b.rightDrainOuter,b.centralRiser])clear(pipe,b.basinFloor,`464 basin bore ${i}`);
  }else{
   clear(b.beamBar,b.platform,`465 beam/deck ${i}`);clear(b.beamAxle,b.beamBar,`465 fulcrum ${i}`);
   for(const a of b.pumpAssemblies){
    for(const moving of[a.piston,a.pistonRod,a.pitman,a.crosshead])for(const fixed of[a.cylinder,a.cover,b.platform])clear(moving,fixed,`465 ${moving.userData.role}/${fixed.userData.role} ${i}`);
    for(const [moving,fixed]of[[a.jointPin,a.pitman],[a.jointPin,a.crosshead],[a.inletValve,a.inletSeat],[a.inletValve,a.inletPipe],[a.deliveryValve,a.deliverySeat],[a.deliveryValve,a.deliveryBody],[a.inletPipe,b.foundation]])clear(moving,fixed,`465 valve/joint ${i}`);
   }
  }
 }
});
test('fountain and balance pumps retain geometry buffers during playback',()=>{
 for(const id of[464,465]){
  const model=createMovementModel(catalog[id-1]),objects=[];model.root.traverse(o=>{if(o.geometry)objects.push([o,o.geometry,o.geometry.attributes.position.array]);});
  for(let i=0;i<30;i++)model.update(i*.53);
  for(const[o,g,a]of objects){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
 }
});
