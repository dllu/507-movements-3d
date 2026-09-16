import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMovementModel} from '../src/simulation/registry.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
function merged(group){group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),parts=[];
 group.traverse(o=>{if(!o.geometry)return;let g=o.geometry.clone();if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}for(const name of Object.keys(g.attributes))if(name!=='position')g.deleteAttribute(name);g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));parts.push(g);});
 const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
}
function clear(moving,points,target,surface){
 const transform=target.matrixWorld.clone().invert().multiply(moving.matrixWorld);let gap=Infinity,count=0;
 for(const point of points){const p=point.clone().applyMatrix4(transform);if(surface.box.distanceToPoint(p)>.01)continue;const d=surface.signedDistance(p,.01);
 assert.ok(d>=-1e-6,`${moving.userData.role} into ${target.userData.role}: ${d}`);gap=Math.min(gap,d);count++;}return{gap,count};
}
test('245 finite pin, head and plug pass through the real L-slot for a complete release and insertion cycle',()=>{
 const m=createMovementModel(catalog[244]),b=m.root.userData.blocks,wall=solidSurface(b.socketWall.geometry);
 const moving=[b.lockingPin,b.pinHead,b.maleBody].map(o=>[o,surfacePoints(o.geometry)]);
 for(let i=0;i<=128;i++){m.update(8*i/128);m.root.updateMatrixWorld(true);for(const[o,p]of moving)clear(o,p,b.socketWall,wall);}
 assert.equal(m.root.userData.hideGround,true);
});
test('248 closed male/female threads stay complementary through three unscrewing turns and reassembly',()=>{
 const m=createMovementModel(catalog[247]),b=m.root.userData.blocks;
 const male=solidSurface(b.externalThread.geometry),female=solidSurface(b.internalThread.geometry),mp=surfacePoints(b.externalThread.geometry).filter((_,i)=>i%10===0),fp=surfacePoints(b.internalThread.geometry).filter((_,i)=>i%10===0);
 let queries=0;
 for(let i=0;i<=64;i++){m.update(12*i/64);m.root.updateMatrixWorld(true);queries+=clear(b.externalThread,mp,b.internalThread,female).count;queries+=clear(b.internalThread,fp,b.externalThread,male).count;}
 assert.ok(queries>1000);assert.equal(b.externalThread.geometry.type,'BufferGeometry');assert.equal(b.internalThread.geometry.type,'BufferGeometry');
});
test('248 actual flange, shoulder, flat seat and locating spigot remain clear through capture and withdrawal',()=>{
 const m=createMovementModel(catalog[247]),b=m.root.userData.blocks;
 const targets=[b.nutBody,b.pipeCBody,b.pipeCBoss,b.pipeCSeat].map(o=>[o,solidSurface(merged(o))]);
 const moving=[b.flange,b.spigot,b.pipeABody].map(o=>[o,surfacePoints(merged(o))]);
 for(let i=0;i<=64;i++){m.update(12*i/64);m.root.updateMatrixWorld(true);for(const[o,p]of moving)for(const[t,s]of targets)clear(o,p,t,s);}
 assert.equal(m.root.userData.hideGround,true);
});
test('249 hollow spherical chamber, neck and lower port clear the retained socket throughout circumduction',()=>{
 const m=createMovementModel(catalog[248]),b=m.root.userData.blocks;
 const targets=[b.upperSocketHalf,b.lowerSocketHalf,b.lowerTube].map(o=>[o,solidSurface(merged(o))]);
 const moving=[b.maleBall,b.upperTube].map(o=>[o,surfacePoints(merged(o)).filter((_,i)=>i%5===0)]);
 for(let i=0;i<=64;i++){m.update(10*i/64);m.root.updateMatrixWorld(true);for(const[o,p]of moving)for(const[t,s]of targets)clear(o,p,t,s);}
 m.update(0);m.root.updateMatrixWorld(true);
 const hits=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1)).intersectObject(b.maleBall,true);
 assert.ok(hits.length&&hits[0].distance>1.27&&hits[0].distance<1.29,'the ball has a spherical cavity, not a solid center around a narrow drilling');
 assert.equal(m.root.userData.hideGround,true);
});
test('249 clamp shanks pass through real ear and nut bores and both nut faces bear on the ears',()=>{
 const m=createMovementModel(catalog[248]),b=m.root.userData.blocks;m.root.updateMatrixWorld(true);
 for(let i=0;i<2;i++){
  const [shank,upper,lower]=b.clampBolts[i].children,points=surfacePoints(shank.geometry);
  for(const target of [b.upperClampEars[i],b.lowerClampEars[i],upper,lower])clear(shank,points,target,solidSurface(target.geometry));
  const a=new THREE.Box3().setFromObject(upper,true),c=new THREE.Box3().setFromObject(b.upperClampEars[i],true);
  assert.ok(Math.abs(a.min.y-c.max.y)<1e-7);
 }
});
