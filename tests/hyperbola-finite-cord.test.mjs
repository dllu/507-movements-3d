import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredHyperbolaDrawingMovement} from '../src/simulation/authored-hyperbola-drawing.js';
import {hyperbolaCordPath} from '../src/simulation/hyperbola-finite-cord.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements;
const create=()=>createAuthoredHyperbolaDrawingMovement(catalog[404]);
function segmentGap(a,b,c,d){const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),A=u.dot(u),B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(w),det=A*C-B*B;let s=Math.max(0,Math.min(1,(B*E-C*D)/det)),t=Math.max(0,Math.min(1,(A*E-B*D)/det));for(let i=0;i<3;i++){s=Math.max(0,Math.min(1,(B*t-D)/A));t=Math.max(0,Math.min(1,(B*s+E)/C));}return a.clone().addScaledVector(u,s).distanceTo(c.clone().addScaledVector(v,t));}
test('405 finite cord has continuous tangent joins and separated crossing strands',()=>{
 const m=create(),u=m.root.userData;let previous=null,min=Infinity,low=Infinity,high=-Infinity;
 for(let i=0;i<=2048;i++){
  const s=u.stateAtTime(8*i/2048),p=hyperbolaCordPath(s);
  for(const [leg,center]of[[p.first,s.lowerFocus],[p.second,s.pencilPoint]]){const direction=leg.end.clone().sub(leg.start).normalize();assert.ok(Math.abs(direction.dot(leg.normal))<1e-12);assert.ok(leg.start.distanceTo(center)>.07);}
  assert.ok(p.sweep<0&&p.sweep>-2*Math.PI);assert.ok(p.start.z<p.entry.z&&p.entry.z<p.exit.z&&p.exit.z<p.end.z);
  min=Math.min(min,segmentGap(p.start,p.entry,p.exit,p.end)-.024);low=Math.min(low,p.visibleLength-u.geometry.threadLength);high=Math.max(high,p.visibleLength-u.geometry.threadLength);
  if(previous)assert.ok(Math.abs(p.visibleLength-previous)<.01);previous=p.visibleLength;
 }
 assert.ok(min>.014);assert.ok(low>.078&&low<.079);assert.ok(high>.550&&high<.551);assert.ok(Math.abs(u.finiteCordLengthRange.maximumVariation-(high-low))<1e-12);disposeObject3D(m.root);
});
test('405 rendered cord surfaces clear its pencil, lower pin and raised rule over the sweep',()=>{
 const m=create(),b=m.root.userData.blocks,targets=[b.pencilBarrel,b.lowerFocusPin.axle,b.ruleBody],surfaces=targets.map(t=>solidSurface(t.geometry));
 let queries=0;
 for(let i=0;i<=32;i++){
  m.update(8*i/32);m.root.updateMatrixWorld(true);
  for(const from of[b.focusCord,b.ruleCord,b.pencilWrap])for(let t=0;t<targets.length;t++){
   const matrix=targets[t].matrixWorld.clone().invert().multiply(from.matrixWorld),surface=surfaces[t];
   for(const sample of surfacePoints(from.geometry)){const p=sample.clone().applyMatrix4(matrix);if(surface.box.distanceToPoint(p)>.001)continue;queries++;assert.ok(!surface.inside(p)||surface.distance(p)<1e-6,`cord into ${targets[t].userData.role}, pose ${i}`);}
  }
  const geometry=b.pencilWrap.geometry,position=geometry.attributes.position,index=geometry.index,normals=geometry.attributes.normal;
  for(let j=0;j<index.count;j+=111){const ids=[0,1,2].map(k=>index.getX(j+k)),p=ids.map(k=>new THREE.Vector3().fromBufferAttribute(position,k)),normal=new THREE.Vector3().fromBufferAttribute(normals,ids[0]),face=new THREE.Vector3().crossVectors(p[1].sub(p[0]),p[2].sub(p[0]));assert.ok(face.dot(normal)>0,'wrap faces wind outward');}
  const local=b.rule.worldToLocal(b.pencil.getWorldPosition(new THREE.Vector3()));assert.ok(Math.abs(local.x)<1e-12);assert.ok(Math.abs(b.ruleBody.position.x+.11+.085)<1e-12);
 }
 assert.ok(queries>1000);disposeObject3D(m.root);
});
test('405 pivot eye and depth layers remain physically open and graphite meets the trace',()=>{
 const m=create(),b=m.root.userData.blocks;m.root.updateMatrixWorld(true);
 const eye=solidSurface(b.ruleEye.geometry);assert.equal(eye.inside(new THREE.Vector3(0,0,0)),false);
 const transform=b.ruleEye.matrixWorld.clone().invert().multiply(b.upperFocusPin.axle.matrixWorld);for(const p of surfacePoints(b.upperFocusPin.axle.geometry))assert.equal(eye.inside(p.clone().applyMatrix4(transform)),false,'upper axle clears bored pivot eye');
 const rule=new THREE.Box3().setFromObject(b.ruleBody),pin=new THREE.Box3().setFromObject(b.lowerFocusPin.group);assert.ok(pin.max.z<rule.min.z);
 const point=b.pencilPoint.getWorldPosition(new THREE.Vector3());assert.equal(point.z,-.145);
 assert.equal(b.board.visible,false);assert.equal(b.boardFrame.visible,false);assert.equal(b.lowerThreadLoop.visible,false);assert.deepEqual(m.cameraDirection.toArray(),[0,0,1]);assert.equal(m.root.userData.cameraFov,8);assert.equal(m.root.userData.hideGround,true);
 m.root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)assert.equal(material.fog,false);});disposeObject3D(m.root);
});
