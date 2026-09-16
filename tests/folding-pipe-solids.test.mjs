import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {surfacePoints, solidSurface} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
const meshes=(root,predicate)=>{const list=[];root.traverse(o=>{if(o.geometry&&predicate(o))list.push(o);});return list;};
function clear(a,points,b,surface){const transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld);
 for(const p of points){const q=p.clone().applyMatrix4(transform);if(surface.box.distanceToPoint(q)>.005)continue;
 const d=surface.signedDistance(q,.005);assert.ok(d>=-1e-6,`${a.userData.role} into ${b.userData.role}: ${d}`);}}
test('386 actual rounds, axles and internal bored clevises clear through the complete fold',()=>{
 const m=createMovementModel(catalog[385]),b=m.root.userData.blocks;
 const targets=[b.leftShell,b.rightShell,b.leftEndFillShell,b.rightEndFillShell,...meshes(m.root,o=>o.userData.role==='bored-internal-round-pivot-cheek')].map(o=>[o,solidSurface(o.geometry)]);
 const moving=[...b.rounds.map(r=>r.userData.body),...b.leftPivotPins,...b.rightPivotPins].map(o=>[o,surfacePoints(o.geometry)]);
 for(let i=0;i<=64;i++){m.update(10*i/64);m.root.updateMatrixWorld(true);for(const[a,p]of moving)for(const[b,s]of targets)clear(a,p,b,s);}
 m.update(4);m.root.updateMatrixWorld(true);
 for(const a of [b.leftShell,b.leftEndFillShell])for(const target of [b.rightShell,b.rightEndFillShell])
  clear(a,surfacePoints(a.geometry),target,solidSurface(target.geometry));
 assert.equal(m.root.userData.hideGround,true);
});
test('387 rendered axles run in bored rails and separated suspension rods through the tide cycle',()=>{
 const m=createMovementModel(catalog[386]),b=m.root.userData.blocks;
 const moving=meshes(m.root,o=>/pivot-axle|suspension-axle|suspension-pivot-pin/.test(o.userData.role??'')).map(o=>[o,surfacePoints(o.geometry)]);
 const targets=meshes(m.root,o=>/bored-constant-length-shank/.test(o.userData.role??'')).map(o=>[o,solidSurface(o.geometry)]);
 for(let i=0;i<=32;i++){m.update(10*i/32);m.root.updateMatrixWorld(true);for(const[a,p]of moving)for(const[b,s]of targets)clear(a,p,b,s);}
 assert.equal(m.root.userData.hideGround,true);
});
test('468 finite hollow balls and upstream necks clear their sockets throughout deployment',()=>{
 const m=createMovementModel(catalog[467]);
 const moving=m.root.userData.blocks.ballJoints.map(o=>[o,surfacePoints(o.geometry).filter((_,i)=>i%3===0)]);
 const targets=m.root.userData.blocks.socketJoints.map(o=>[o,solidSurface(o.geometry)]);
 for(let i=0;i<=64;i++){m.update(13.2*i/64);m.root.updateMatrixWorld(true);for(let j=0;j<moving.length;j++){
   clear(...moving[j],...targets[j]);
   const ball=moving[j][0], pipe=ball.parent.children.find(o=>/inch-pipe-shell/.test(o.userData.role??''));
   clear(pipe,surfacePoints(pipe.geometry).filter((_,k)=>k%5===0),...targets[j]);
  }}
 for(const [ball]of moving){const s=solidSurface(ball.geometry);assert.equal(s.inside(new THREE.Vector3()),false);assert.ok(s.distance(new THREE.Vector3())>.27);}
 const stubs=meshes(m.root,o=>o.userData.role==='outboard-water-main-hinge-stub');
 assert.equal(stubs.length,12);
 for(const stub of stubs){stub.updateMatrix();const box=new THREE.Box3().setFromBufferAttribute(stub.geometry.attributes.position).applyMatrix4(stub.matrix);assert.ok(Math.min(Math.abs(box.min.y),Math.abs(box.max.y))>=.389);}
 assert.equal(m.root.userData.hideGround,true);
});

test('468 outboard axle stubs clear actual bored barrels and the trimmed hinge arms',()=>{
 const m=createMovementModel(catalog[467]);
 const moving=meshes(m.root,o=>o.userData.role==='outboard-water-main-hinge-stub').map(o=>[o,surfacePoints(o.geometry)]);
 const targets=meshes(m.root,o=>/bored-hinge-barrel|stream-hinge-arm/.test(o.userData.role??'')).map(o=>[o,solidSurface(o.geometry)]);
 for(let i=0;i<=32;i++){m.update(13.2*i/32);m.root.updateMatrixWorld(true);for(const[a,p]of moving)for(const[b,s]of targets)clear(a,p,b,s);}
});
