import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
import {faceWorm195Geometry} from '../src/simulation/feed-worm-assembly-parts.js';
import data from '../src/data/face-worm-195.js';
function verifySources(report){for(const x of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(x.file)).digest('hex'),x.sha256,x.file);const x=report.factorySource,s=fs.readFileSync(x.file,'utf8'),a=s.indexOf('function '+x.name+'('),b=s.indexOf('\nfunction ',a+1);assert.equal(createHash('sha256').update(s.slice(a,b)).digest('hex'),x.sha256,x.name);}
for(const id of[195,207]){
 test(`${id} actual shaft surfaces clear every exposed hub and solid worm bore`,()=>{
  const m=createAuthoredGearMovement({id}),d=m.root.userData,b=d.blocks,pairs=d.journalReview.map(j=>[j.shaft.userData.rotor.children[0],j.part]);
  if(id===195){for(const side of['upper','lower']){pairs.push([b[side+'WheelShaft'].userData.rotor.children[0],b[side+'BoredCenter']]);pairs.push([b[side+'WheelShaft'].userData.rotor.children[0],b[side+'SmoothBack']]);}pairs.push([b.wormShaft.userData.rotor.children[0],b.worm.userData.thread]);}
  else for(const side of['left','right'])pairs.push([b.inputShaft.userData.rotor.children[0],b[side+'Worm'].userData.thread]);
  const prepared=pairs.map(([shaft,part])=>({shaft,part,points:surfacePoints(shaft.geometry),solid:solidSurface(part.geometry)}));let count=0,min=Infinity;
  for(let pose=0;pose<17;pose++){m.update(d.transmission.inputPeriod*pose/16);m.root.updateMatrixWorld(true);for(const{shaft,part,points,solid}of prepared){const transform=part.matrixWorld.clone().invert().multiply(shaft.matrixWorld);for(const p of points){const q=p.clone().applyMatrix4(transform);if(solid.box.distanceToPoint(q)>.005)continue;const gap=solid.signedDistance(q,.005);assert.ok(gap>-.000001,`${id} bore penetration ${gap}`);min=Math.min(min,gap);count++;}}}
  assert.ok(count>100);assert.ok(min>.0007,`minimum bore clearance ${min}`);disposeObject3D(m.root);
 });
 test(`${id} source framing fits actual visible vertices through a complete wheel turn`,()=>{
  const m=createAuthoredGearMovement({id}),d=m.root.userData;assert.equal(d.hideGround,true);assert.ok(m.cameraDirection.z>50*m.cameraDirection.x);const points=[];
  m.root.traverseVisible(o=>{if(!o.isMesh)return;for(const mat of(Array.isArray(o.material)?o.material:[o.material]))assert.equal(mat.fog,false);points.push([o,o.geometry.attributes.position]);assert.equal(o.castShadow,true);});
  const box=d.cameraFitBounds.clone().expandByScalar(1e-5),v=new THREE.Vector3(),world=new THREE.Matrix4();
  for(let pose=0;pose<17;pose++){m.update(d.transmission.inputPeriod*24*pose/16);m.root.updateMatrixWorld(true);for(const[o,p]of points){for(let j=0;j<(o.isInstancedMesh?o.count:1);j++){if(o.isInstancedMesh){o.getMatrixAt(j,world);world.premultiply(o.matrixWorld);}else world.copy(o.matrixWorld);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(world);assert.ok(box.containsPoint(v),`${id} bounds miss ${v.toArray()}`);}}}}
  disposeObject3D(m.root);
 });
 test(`${id} update preserves geometry buffers and indexes are seated inside hub-free face stock`,()=>{
  const m=createAuthoredGearMovement({id}),b=m.root.userData.blocks,seen=new Map();m.root.traverse(o=>{if(o.geometry)seen.set(o,[o.geometry,o.geometry.attributes.position.array]);});
  for(let i=0;i<50;i++)m.update(i*.37);for(const[o,[g,a]]of seen){assert.equal(o.geometry,g);assert.equal(g.attributes.position.array,a);}
  for(const side of(id===195?['upper','lower']:['left','right'])){const index=b[side+(id===195?'Index':'WheelIndex')],hub=b[side+(id===195?'WheelHub':'WheelHub')],r=Math.hypot(index.position.x,index.position.y);assert.ok(r-index.geometry.parameters.width/2>hub.geometry.userData.outerProfile[0].radial);assert.equal(index.geometry.parameters.depth,.003);}
  disposeObject3D(m.root);
 });
 test(`${id} sampled actual working faces retain opposed normals and useful torque in all poses`,()=>{
  const report=JSON.parse(fs.readFileSync(`docs/validation/feed-worm-${id}-working-faces.json`));verifySources(report);assert.equal(report.results.length,2);
  for(const side of report.results){assert.equal(side.poses.length,17);assert.equal(side.missing,0);assert.ok(side.maximumWorkingGap<.015);for(const p of side.poses){assert.ok(p.best.inputMoment<-.005);assert.ok(Math.abs(p.best.outputMoment)>.05);assert.ok(p.best.normalOpposition<-.8);}}
 });
}
test('195 face teeth have real valleys, a closed backing, and consistently outward volume',()=>{
 assert.ok(Math.min(...data.heights)<-.20);assert.ok(Math.max(...data.heights)===0);assert.ok(data.heights.every(h=>h>data.back+.02));
 for(let r=0;r<=data.radialSteps;r++)assert.equal(data.heights[r*(data.angularSteps+1)],data.heights[r*(data.angularSteps+1)+data.angularSteps]);
 const g=faceWorm195Geometry(),triangles=surfaceTriangles(g);let volume=0;for(const t of triangles)volume+=t.a.dot(t.b.clone().cross(t.c))/6;assert.ok(volume>.015&&volume<.05,`signed volume ${volume}`);g.dispose();
});
test('195 full opposed finite-solid sweep has no sampled penetration',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/feed-worm-195-solids.json'));verifySources(report);assert.equal(report.poses,17);assert.equal(report.status,'sampled-flanks-clear');for(const r of report.results){assert.equal(r.penetrations,0);assert.ok(r.queries>200000);assert.ok(r.minimumGap>.002);}
});
