import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredThrostleSpinningMovement as spinning } from '../src/simulation/authored-throstle-spinning.js';
import { createAuthoredFanBlowerMovement as fan } from '../src/simulation/authored-fan-blowers.js';
import { surfacePoints, surfaceTriangles, solidSurface } from './helpers/solid-surface.mjs';
for(const[id,factory]of[[496,spinning],[497,fan]]){
 test(`${id}: selected finite moving interfaces over complete cycle`,()=>{
  const m=factory({id}),b=m.root.userData.blocks,p=m.root.userData.spinningFanWorkingParts,pairs=[],shafts=[];
  if(id===496){
   for(const roll of b.drawingRolls){const axle=roll.children.find(c=>c.userData.role?.endsWith('-axle')).userData.rotor.children[0];shafts.push(axle);for(const bearing of b.rollBearings)if(bearing.position.x===roll.position.x&&bearing.position.y===roll.position.y)pairs.push([axle,bearing]);}
   shafts.push(p.shaft);
   for(const bobbin of[b.bobbinBarrel,...b.bobbinFlanges,b.spindleBearing])pairs.push([p.shaft,bobbin]);
   for(const a of[b.backTopRoll,b.frontTopRoll]){const bottom=a===b.backTopRoll?b.backBottomRoll:b.frontBottomRoll;for(const upper of[a.userData.body,...a.userData.ribs])for(const lower of[bottom.userData.body,...bottom.userData.ribs])pairs.push([upper,lower]);}
   for(const fiber of[b.inputSliver,b.draftedFiber])for(const roll of b.drawingRolls)for(const part of[roll.userData.body,...roll.userData.ribs])pairs.push([fiber,part]);
   for(const yarn of b.liveYarn.children)for(const part of[p.shaft,p.neck,b.flyerTopEye,b.flyerArmEye,...b.flyerArms,b.bobbinBarrel,...b.bobbinFlanges,...b.drawingRolls.flatMap(r=>[r.userData.body,...r.userData.ribs])])pairs.push([yarn,part]);
  }else{
   for(const moving of[...b.blades,b.hub,b.hubIndex])for(const fixed of[p.wall,b.frontPlate,b.rearPlate,...b.inletRims,...p.spiders])pairs.push([moving,fixed]);
   const shaft=b.shaft.userData.rotor.children[0];shafts.push(shaft);for(const bearing of b.bearings)pairs.push([shaft,bearing]);
   for(const particle of b.airflowParticles)for(const fixed of[b.hub,p.wall,b.frontPlate,b.rearPlate,...b.inletRims,...p.spiders])pairs.push([particle,fixed]);
  }
  // makeDynamicCable moves/scales fixed cylinder meshes: local samples are
  // invariant, while each segment's actual world transform is refreshed below.
  const points=new Map(),solids=new Map();for(const[a,b]of pairs){if(!points.has(a.geometry))points.set(a.geometry,surfacePoints(a.geometry));if(!solids.has(b.geometry))solids.set(b.geometry,solidSurface(b.geometry));}
  // Dense sections of the actual shaft triangles catch thin journals lying
  // between the original long cylinder faces' vertices and midpoints.
  for(const shaft of shafts){shaft.geometry.computeBoundingBox();const box=shaft.geometry.boundingBox;
   for(let i=1;i<80;i++)for(const tri of surfaceTriangles(shaft.geometry))for(const[a,c]of[[tri.a,tri.b],[tri.b,tri.c],[tri.c,tri.a]]){
    const y=THREE.MathUtils.lerp(box.min.y,box.max.y,i/80);if(a.y===c.y||(y-a.y)*(y-c.y)>0)continue;
    points.get(shaft.geometry).push(a.clone().lerp(c,(y-a.y)/(c.y-a.y)));
   }
  }
  let checks=0,min=.005;const point=new THREE.Vector3();
  for(let pose=0;pose<=16;pose++){
   // Offset intermediate phases to avoid repeatedly sampling the same flute angle.
   m.update(m.root.userData.geometry.cycleDuration*(pose+.2*Math.sin(Math.PI*pose/16))/16);m.root.updateMatrixWorld(true);
   for(const[a,b]of pairs){const transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld),solid=solids.get(b.geometry);
    for(const q of points.get(a.geometry)){point.copy(q).applyMatrix4(transform);const d=solid.signedDistance(point,.005);checks++;min=Math.min(min,d);assert.ok(d>=-1e-5,`${id} pose${pose}: ${a.userData.role??a.parent.userData.role} cuts ${b.userData.role} by ${-d} at ${point.toArray()}`);}
   }
  }
  console.log(JSON.stringify({id,checks,minimumCappedGap:min}));
 });
 test(`${id}: no scene growth and explicit prescribed-motion limits`,()=>{
  const m=factory({id}),before=[];m.root.traverse(o=>{if(o.geometry)before.push([o,o.geometry,o.geometry.attributes.position.array]);for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});
  for(let i=0;i<=32;i++)m.update(m.root.userData.geometry.cycleDuration*i/32);let count=0;m.root.traverse(o=>{if(o.geometry)count++;});assert.equal(count,before.length);for(const[o,g,a]of before){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
  assert.equal(m.root.userData.hideGround,true);assert.ok(m.root.userData.minimumDisplayCycleSeconds>=4);assert.match(m.root.userData.reconstructionNote,/prescribed|illustrate/);
 });
}
