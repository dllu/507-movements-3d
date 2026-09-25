import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredBeltMovement as create} from '../src/simulation/authored-belts.js';
import {surfacePoints,surfaceTriangles,solidSurface} from './helpers/solid-surface.mjs';

for(const id of [227,228,229])test(`${id}: finite wheel/link, neighboring articulation and actual shaft passages clear over a turn`,()=>{
 const m=create({id}),d=m.root.userData,b=d.blocks,points=new Map(),solids=new Map(),triangles=new Map(),stats={};let queries=0;
 const check=(source,target,label)=>{
  if(!points.has(source.geometry))points.set(source.geometry,surfacePoints(source.geometry));
  if(!solids.has(target.geometry))solids.set(target.geometry,solidSurface(target.geometry));
  const matrix=target.matrixWorld.clone().invert().multiply(source.matrixWorld),solid=solids.get(target.geometry),point=new THREE.Vector3();
  const verify=point=>{
   const gap=solid.signedDistance(point,.02);queries++;
   stats[label]=Math.min(stats[label]??.02,gap);
   assert.ok(gap>=-1e-5,`${id} ${label} penetration ${-gap}`);
  };
  for(const p of points.get(source.geometry))verify(point.copy(p).applyMatrix4(matrix));
  // Long cylinders need samples where they cross a thin eye, not just their
  // distant end caps and face centroids. Intersect actual triangle edges.
  if(/shaft|bore|eye/.test(label)){
   if(!triangles.has(source.geometry))triangles.set(source.geometry,surfaceTriangles(source.geometry));
   for(const triangle of triangles.get(source.geometry)){
    const vertices=[triangle.a,triangle.b,triangle.c].map(p=>p.clone().applyMatrix4(matrix));
    for(const z of[solid.box.min.z+1e-6,(solid.box.min.z+solid.box.max.z)/2,solid.box.max.z-1e-6])for(let j=0;j<3;j++){
     const a=vertices[j],b=vertices[(j+1)%3],t=(z-a.z)/(b.z-a.z);if(t>=0&&t<=1)verify(point.copy(a).lerp(b,t));
    }
   }
  }
 };
 const shaft=[];b.shaft.traverse(o=>{if(o.isMesh)shaft.push(o);});
 for(let pose=0;pose<=64;pose++){
  m.update(d.geometry.cyclePeriod*pose/64);m.root.updateMatrixWorld(true);
  const links=(b.links??b.sections).filter(o=>o.visible).sort((a,b)=>a.userData.stateIndex-b.userData.stateIndex);
  for(const mesh of shaft)check(mesh,b.hub,'shaft/hub');
  if(id===228)for(const mesh of shaft)check(mesh,b.disk,'shaft/disk');
  for(let j=0;j<links.length;j++){
   const o=links[j],next=links[j+1];
   if(id===227){check(o,b.sprocket,'link/wheel');if(next)check(o,next,'neighboring links');}
   if(id===228){
    check(o.userData.rung,b.disk,'rung/disk');for(const tooth of b.teeth)check(o.userData.rung,tooth,'rung/tooth');
    for(const side of o.userData.sideLinks){check(side,b.disk,'side/disk');check(o.userData.rung,side,'rung/start eye');if(next){check(side,next.userData.sideLinks.find(s=>s.userData.side===side.userData.side),'neighboring links');check(next.userData.rung,side,'rung/end eye');}}
   }
   if(id===229){check(o.userData.plate,b.wheel,'plate/wheel');check(o.userData.pivotPin,o.userData.plate,'start bore');if(next){check(next.userData.pivotPin,o.userData.plate,'end bore');check(o.userData.plate,next.userData.plate,'neighboring plates');}}
  }
 }
 console.log({id,queries,minimumGaps:stats});
});

for(const id of [227,228,229])test(`${id}: an engaged finite flank stays close and can do positive work on the chain`,()=>{
 const m=create({id}),d=m.root.userData,b=d.blocks,points=new Map(),targets=id===227?[b.sprocket]:id===228?b.teeth:[b.wheel];let maxGap=0,worstReaction=1;
 const profiles=targets.map(target=>{const {polygons,low,high}=target.geometry.userData.plate,edges=[];for(const polygon of polygons)for(const ring of polygon)for(let i=0;i<ring.length-1;i++){const a=new THREE.Vector2(...ring[i]),v=new THREE.Vector2(...ring[i+1]).sub(a),normal=new THREE.Vector2(v.y,-v.x).normalize();edges.push({a,v,normal,length:v.lengthSq()});}return{target,edges,low,high};});
 for(let i=0;i<=64;i++){
  m.update(4*i/64);m.root.updateMatrixWorld(true);let closest=.2,bestReaction=0;
  // 227: as Brown draws it, each tooth stands through an edge-on link and
  // drives the end loops of the two flat links on either side of it.
  const engaged=new Set(d.kinematics.engagements.flatMap(e=>id===227?[e.linkMaterialIndex-1,e.linkMaterialIndex+1]:[e.linkMaterialIndex??e.rungMaterialIndex]));
  const links=(b.links??b.sections).filter(o=>o.visible&&engaged.has(o.userData.materialIndex));
  for(const link of links){const source=id===227?link:id===228?link.userData.rung:link.userData.plate;if(!points.has(source.geometry))points.set(source.geometry,surfacePoints(source.geometry));
   for(const {target,edges,low,high}of profiles){const matrix=target.matrixWorld.clone().invert().multiply(source.matrixWorld);for(const p0 of points.get(source.geometry)){const p=p0.clone().applyMatrix4(matrix);if(p.z<low||p.z>high)continue;
    for(const {a,v,normal,length}of edges){const t=Math.max(0,Math.min(1,((p.x-a.x)*v.x+(p.y-a.y)*v.y)/length)),x=a.x+t*v.x,y=a.y+t*v.y,dist=Math.hypot(p.x-x,p.y-y);if(dist>=closest)continue;
     // Wheel outward normal, in the wheel frame. On a wrapped link the
     // prescribed chain velocity equals the clockwise wheel velocity.
     const angle=target.rotation.z,xx=x*Math.cos(angle)-y*Math.sin(angle),yy=x*Math.sin(angle)+y*Math.cos(angle),nx=normal.x*Math.cos(angle)-normal.y*Math.sin(angle),ny=normal.x*Math.sin(angle)+normal.y*Math.cos(angle),reaction=(nx*yy-ny*xx)/Math.hypot(xx,yy);
     if(reaction>.2){closest=dist;bestReaction=reaction;}
    }
   }}
  }
  assert.ok(closest<.0015,`${id}: no nearby driving face at pose ${i}: ${closest}`);
  maxGap=Math.max(maxGap,closest);worstReaction=Math.min(worstReaction,bestReaction);
 }
 console.log({id,maxDrivingGap:maxGap,minimumWorkComponent:worstReaction});
});

for(const id of [227,228,229])test(`${id}: stable buffers, readable timing, complete bounds and finite outward solids`,()=>{
 const m=create({id}),d=m.root.userData,saved=[];let triangles=0;
 m.root.traverse(o=>{if(o.geometry){saved.push([o,o.geometry,o.geometry.attributes.position.array]);}for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});
 for(let i=0;i<=16;i++){
  m.update(4*i/16);m.root.updateMatrixWorld(true);m.root.traverseVisible(o=>{const position=o.geometry?.attributes.position;if(!position)return;
   // 229 cuts its chain legs with fixed clipping planes; clipped vertices are not drawn.
   const cuts=[].concat(o.material??[]).flatMap(material=>material.clippingPlanes??[]);
   // The legs run on below the plate into navel pipes in a deck; the pipes,
   // deck and link material inside them lie beyond the framed plate.
   if(o.parent?.userData.role==='chain-navel-pipes-and-deck-beyond-plate-crop')return;
   for(let j=0;j<position.count;j++){const point=new THREE.Vector3().fromBufferAttribute(position,j).applyMatrix4(o.matrixWorld);if(cuts.some(plane=>plane.distanceToPoint(point)<0))continue;if(point.y<d.cameraFitBounds.min.y&&point.y>d.chainNavelPipes.deckY-d.chainNavelPipes.pipeLength)continue;if(id===229&&point.y<d.geometry.wheelCenter.y&&point.y>d.chainNavelPipes.deckY-d.chainNavelPipes.pipeLength&&(o.userData.chainLink||o.parent?.userData.chainLink))continue;assert.ok(d.cameraFitBounds.containsPoint(point),`${id} frame misses a vertex`);}});
 }
 let count=0;m.root.traverse(o=>{if(o.geometry)count++;});assert.equal(count,saved.length);
 for(const[o,g,a]of saved){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
 m.root.traverseVisible(o=>{if(o.geometry)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
 // 228's longer legs (ten tail sections each) run down into the navel pipes.
 assert.ok(triangles<(id===228?60000:50000));assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,4);assert.match(d.reconstructionNote,/prescribed/);assert.match(d.reconstructionNote,/not solved/);
 for(const geometry of new Set(saved.map(row=>row[1]).filter(g=>g.userData.plate))){let volume=0;const p=geometry.attributes.position;for(let i=0;i<p.count;i+=3){const[a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j));volume+=a.dot(b.cross(c))/6;}assert.ok(volume>0,'inverted plate winding');}
});
