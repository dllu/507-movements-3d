import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredHelicalCurrentRotorMovement } from '../src/simulation/authored-helical-current-rotors.js';
import { createAuthoredCommonWindmillMovement } from '../src/simulation/authored-common-windmills.js';
import { createAuthoredPivotedSailWindmillMovement } from '../src/simulation/authored-pivoted-sail-windmills.js';
import { surfacePoints, surfaceTriangles, solidSurface } from './helpers/solid-surface.mjs';
const factories={484:createAuthoredHelicalCurrentRotorMovement,485:createAuthoredCommonWindmillMovement,486:createAuthoredPivotedSailWindmillMovement};
const make=id=>factories[id]({id});
for(const id of[484,485,486]){
 test(`${id}: working solids clear journals, supports and moving sail interfaces`,()=>{
  const model=make(id),b=model.root.userData.blocks,p=model.root.userData.windRotorWorkingParts,pairs=[];
  if(id===484){
   // Brown's plank standards carry the shaft directly; there are no bearing rings or shoulders.
   for(const fixed of b.supports.map(s=>s.upright)){
    for(const moving of[b.shaft,b.helicalBlade,...b.endCollars,b.loadWheel.children[0]])pairs.push([moving,fixed]);
   }
  }else if(id===485){
   for(const fixed of[...b.bearings,...p.bearingSupports,b.dome,b.tower])pairs.push([b.windshaft,fixed]);
   for(const {panel,stock,perimeter}of b.sails)for(const fixed of[b.dome,b.tower,...b.bearings])for(const moving of[panel,stock,...perimeter])pairs.push([moving,fixed]);
  }else{
   for(const fixed of[b.lowerBearing,...b.supportCross])for(const moving of[b.verticalShaft,b.loadFlywheel])pairs.push([moving,fixed]);
   b.armAssemblies.forEach((a,i)=>{
    pairs.push([a.hingePin,p.sleeves[i]],[a.hingePin,a.panel],[a.arm,p.sleeves[i]],[a.arm,a.panel],
      [a.arm,a.topRail],[a.arm,a.bottomRail]);
    const next=b.armAssemblies[(i+1)%6];pairs.push([a.panel,next.panel],[a.panel,next.hingePin]);
   });
  }
  const points=new Map(),solids=new Map();for(const[a,b]of pairs){if(!points.has(a))points.set(a,surfacePoints(a.geometry));if(!solids.has(b))solids.set(b,solidSurface(b.geometry));}
  // Thin housings can sit between the original shaft triangles' sample points.
  const shaft=b.shaft??b.windshaft??b.verticalShaft,triangles=surfaceTriangles(shaft.geometry);shaft.geometry.computeBoundingBox();const box=shaft.geometry.boundingBox;
  for(let i=1;i<80;i++)for(const tri of triangles)for(const[a,c]of[[tri.a,tri.b],[tri.b,tri.c],[tri.c,tri.a]]){
   const y=THREE.MathUtils.lerp(box.min.y,box.max.y,i/80);if(a.y===c.y||(y-a.y)*(y-c.y)>0)continue;
   points.get(shaft).push(a.clone().lerp(c,(y-a.y)/(c.y-a.y)));
  }
  let checks=0,min=.005;const point=new THREE.Vector3();
  for(let pose=0;pose<=32;pose++){
   model.update(model.root.userData.geometry.cycleDuration*pose/32);model.root.updateMatrixWorld(true);
   for(const[a,b]of pairs){const transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld),solid=solids.get(b);
    for(const q of points.get(a)){point.copy(q).applyMatrix4(transform);const d=solid.signedDistance(point,.005);min=Math.min(min,d);checks++;assert.ok(d>=-1e-5,`${id} pose${pose} ${a.userData.role} cuts ${b.userData.role} by ${-d} at ${point.toArray()}`);}
   }
  }
  console.log(JSON.stringify({id,checks,minimumCappedGap:min}));
 });
 test(`${id}: finite shell normals, stable update geometry and readable timing`,()=>{
  const model=make(id),b=model.root.userData.blocks,meshes=id===484?[b.helicalBlade]:id===485?[b.dome,...b.sails.map(s=>s.panel)]:model.root.userData.windRotorWorkingParts.sleeves;
  for(const mesh of meshes){let volume=0;for(const tri of surfaceTriangles(mesh.geometry))volume+=tri.a.dot(new THREE.Vector3().crossVectors(tri.b,tri.c))/6;assert.ok(volume>1e-4,`${mesh.userData.role}: signed volume ${volume}`);}
  const before=[];model.root.traverse(o=>{if(o.geometry)before.push([o,o.geometry,o.geometry.attributes.position.array]);for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});
  for(let i=0;i<=32;i++)model.update(model.root.userData.geometry.cycleDuration*i/32);
  const after=[];model.root.traverse(o=>{if(o.geometry)after.push(o);});assert.equal(after.length,before.length);for(const[o,g,a]of before){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
  if(id===486)assert.equal(b.sweepRing.geometry.parameters.radius,model.root.userData.geometry.rotorRadiusSceneUnit);
  assert.equal(model.root.userData.hideGround,true);assert.ok(model.root.userData.minimumDisplayCycleSeconds>=3);assert.match(model.root.userData.reconstructionNote,/prescribed/);
 });
}
test('486: boss and lower bearing seat on hub and supports without sharing their bores',()=>{
 const model=make(486),b=model.root.userData.blocks;model.root.updateMatrixWorld(true);
 const box=o=>new THREE.Box3().setFromObject(o);
 assert.ok(Math.abs(box(b.squareShaftBoss).min.y-box(b.hub).max.y)<1e-6);
 for(const support of b.supportCross)assert.ok(Math.abs(box(b.lowerBearing).min.y-box(support).max.y)<1e-6);
});
