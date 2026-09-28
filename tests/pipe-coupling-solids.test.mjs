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
 // B's half-section thread is rebuilt in place (with a shifted helix phase)
 // as B turns under the fixed section plane, so its surface is taken per pose.
 const male=solidSurface(b.externalThread.geometry),mp=surfacePoints(b.externalThread.geometry).filter((_,i)=>i%10===0);
 let queries=0,female,fp,seen;
 for(let i=0;i<=64;i++){m.update(12*i/64);m.root.updateMatrixWorld(true);
  const phase=b.internalThread.geometry.userData.thread.phase;if(seen!==phase){seen=phase;const g=b.internalThread.geometry;female=solidSurface(g);fp=surfacePoints(g).filter((_,i)=>i%10===0);}
  queries+=clear(b.externalThread,mp,b.internalThread,female).count;queries+=clear(b.internalThread,fp,b.externalThread,male).count;}
 assert.ok(queries>1000);assert.equal(b.externalThread.geometry.type,'BufferGeometry');assert.equal(b.internalThread.geometry.type,'BufferGeometry');
});
function assertWatertightHalf(geometry,label){
 const p=geometry.attributes.position,n=geometry.attributes.normal,edges=new Map();let volume=0;
 const v=i=>new THREE.Vector3().fromBufferAttribute(p,i),key=x=>x.toArray().map(c=>Math.round(c*1e5)).join(',');
 for(let i=0;i<p.count;i+=3){const[a,b,c]=[v(i),v(i+1),v(i+2)],cross=b.clone().sub(a).cross(c.clone().sub(a));if(cross.lengthSq()<1e-18)continue;
  assert.ok(cross.dot(new THREE.Vector3().fromBufferAttribute(n,i))>-1e-9,label+': winding agrees with shading');
  volume+=a.dot(b.clone().cross(c))/6;
  for(const[x,y]of[[a,b],[b,c],[c,a]]){const k1=key(x),k2=key(y);if(k1===k2)continue;const k=k1<k2?k1+':'+k2:k2+':'+k1;edges.set(k,(edges.get(k)??0)+1);}}
 const open=[...edges.values()].filter(c=>c!==2).length;
 assert.equal(open,0,label+': every thread edge bounds two faces (no missing faces between turns or at the section)');
 assert.ok(volume>0,label+': closed and outward');
 geometry.computeBoundingBox();assert.ok(geometry.boundingBox.max.z<1e-6,label+': the thread lies wholly behind the section plane');
 assert.equal(geometry.groups.length,2,label+': turned surface and section faces');
}
test('248 p98: both threads are closed half-section solids at every nut angle, with no render-time clipping',()=>{
 const m=createMovementModel(catalog[247]),b=m.root.userData.blocks;
 for(const mesh of [b.externalThread,b.internalThread])for(const mat of [].concat(mesh.material))assert.ok(!mat.clippingPlanes?.length,'no open clipped thread');
 assertWatertightHalf(b.externalThread.geometry,'C thread');
 for(let i=0;i<=24;i++){m.update(12*i/24);m.root.updateMatrixWorld(true);
  const world=b.internalThread.geometry.clone().applyMatrix4(b.internalThread.matrixWorld);assertWatertightHalf(world,'B thread at '+i);}
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
