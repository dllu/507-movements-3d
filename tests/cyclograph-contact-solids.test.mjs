import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const distance=(p,a,b)=>{const d=b.clone().sub(a);return p.distanceTo(a.clone().addScaledVector(d,THREE.MathUtils.clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1)));};

test('403 finite guide pins touch offset rule faces and clear the raised brace throughout a stroke',()=>{
 const {root,update}=createMovementModel(catalog[402]),{blocks:b,geometry:g}=root.userData;
 for(let i=0;i<=128;i++){
  update(g.cycleDuration*i/128);root.updateMatrixWorld(true);
  for(const [index,rule] of [b.leftRule,b.rightRule].entries()){
   const center=b.guidePins[index].pin.getWorldPosition(new THREE.Vector3());
   const local=rule.body.worldToLocal(center.clone()),p=rule.body.geometry.parameters;
   near(Math.abs(local.y)-p.height/2,g.guideRadius);
   assert.ok(Math.abs(local.x)<p.width/2);
   // Check every box in the carriage, not only its nominal guide edge.
   b.carriage.traverse(mesh=>{
    if(mesh.geometry?.type!=='BoxGeometry')return;
    const v=mesh.worldToLocal(center.clone()),s=mesh.geometry.parameters;
    const dz=Math.max(0,Math.abs(v.z)-s.depth/2);
    if(dz>.56/2)return;
    const gap=Math.hypot(Math.max(0,Math.abs(v.x)-s.width/2),Math.max(0,Math.abs(v.y)-s.height/2));
    assert.ok(gap>=g.guideRadius-1e-8,`${mesh.userData.role}: ${gap}`);
   });
  }
 }
 near(b.graphite.position.z,-.075);near(b.pencilTip.position.z-.205/2,-.075);
 assert.ok(b.apexFastener.geometry.userData.boreRadius>g.guideRadius);
 assert.equal(b.board.parent,null);assert.equal(root.userData.hideGround,true);
});

test('404 rendered bar clears finite fixed rollers and its rounded thrust pad over the adjustment',()=>{
 const {root,update}=createMovementModel(catalog[403]),d=root.userData,{blocks:b,geometry:g}=d;
 const initialCenters=b.rollerAssemblies.map(r=>r.roller.position.clone());
 for(let i=0;i<=128;i++){
  update(g.cycleDuration*i/128);root.updateMatrixWorld(true);
  const attr=b.elasticBar.geometry.attributes.position;
  const outer=[],inner=[];
  for(let j=0;j<attr.count;j+=4){outer.push(new THREE.Vector2(attr.getX(j),attr.getY(j)));inner.push(new THREE.Vector2(attr.getX(j+1),attr.getY(j+1)));}
  for(const [index,r] of b.rollerAssemblies.entries()){
   assert.ok(r.roller.position.equals(initialCenters[index]));
   const p=new THREE.Vector2(r.roller.position.x,r.roller.position.y);
   let gap=Infinity;for(let j=1;j<outer.length;j++)gap=Math.min(gap,distance(p,outer[j-1],outer[j]));
   near(gap,g.rollerRadius,2e-7);
   assert.ok(r.body.geometry.userData.boreRadius>.055);
  }
  const pad=b.padBody.getWorldPosition(new THREE.Vector3()),p=new THREE.Vector2(pad.x,pad.y);
  let gap=Infinity;for(let j=1;j<inner.length;j++)gap=Math.min(gap,distance(p,inner[j-1],inner[j]));
  assert.ok(gap>=.16-4e-5,`pad/bar ${gap}`);near(gap,.16,4e-5);
  const screwTop=b.screw.position.y+g.screwLength/2;
  near(screwTop,pad.y-.16);
 }
 const negativeCenter=new THREE.Vector2(g.supportHalfSpan,g.supportY+g.rollerRadius);
 const path=d.pathAtBend(1).outerPoints;
 const negativeGap=Math.min(...path.slice(1).map((p,i)=>distance(negativeCenter,path[i],p)));
 assert.ok(negativeGap<g.rollerRadius-.03,'old vertical-radius offset must fail');
 assert.equal(root.userData.hideGround,true);
});

test('404 actual screw threads clear the nut flanks and pass through the base',async()=>{
 const {solidSurface,surfacePoints}=await import('./helpers/solid-surface.mjs');
 const {root,update}=createMovementModel(catalog[403]),{blocks:b,geometry:g}=root.userData;
 const thread=b.screw.userData.thread;
 const nutSurface=solidSurface(b.nutThread.geometry),baseSurface=solidSurface(b.base.geometry);
 const points=surfacePoints(thread.geometry).filter((_,i)=>i%5===0);
 let queries=0,closest=Infinity;
 for(let i=0;i<=16;i++){
  update(g.cycleDuration*i/16);root.updateMatrixWorld(true);
  for(const [mesh,surface] of [[b.nutThread,nutSurface],[b.base,baseSurface]]){
   const transform=mesh.matrixWorld.clone().invert().multiply(thread.matrixWorld);
   for(const point of points){const p=point.clone().applyMatrix4(transform);
    if(!surface.box.clone().expandByScalar(.01).containsPoint(p))continue;
    const gap=surface.signedDistance(p,.01);assert.ok(gap>=-1e-6,`thread intrusion ${gap}`);queries++;
    if(mesh===b.nutThread)closest=Math.min(closest,gap);
   }
  }
 }
 assert.ok(queries>1000);assert.ok(closest<.004);
});

test('404 complete rendered strip clears the base, feet and roller standards during adjustment',()=>{
 const {root,update}=createMovementModel(catalog[403]),{blocks:b,geometry:g}=root.userData;
 const bounds=mesh=>new THREE.Box3().setFromObject(mesh,true);
 let minimumBaseGap=Infinity;
 for(let i=0;i<=256;i++){
  update(g.cycleDuration*i/256);root.updateMatrixWorld(true);
  // Precise bounds include every current ribbon vertex, including the free
  // overhangs. A separating plane then proves whole-triangle clearance.
  const strip=bounds(b.elasticBar),base=bounds(b.base);
  const baseGap=strip.min.y-base.max.y;
  assert.ok(baseGap>.03,`bar/base gap at ${i}/256: ${baseGap}`);
  minimumBaseGap=Math.min(minimumBaseGap,baseGap);
  for(const foot of b.baseFeet)assert.ok(strip.min.y>bounds(foot).max.y);
  for(const {standard} of b.rollerAssemblies){
   assert.ok(strip.min.z-bounds(standard).max.z>.09);
  }
 }
 assert.ok(minimumBaseGap<.2,'the former base height must fail this sweep');
 const base=bounds(b.base),nut=bounds(b.fixedNut);
 assert.ok(nut.min.y<base.max.y&&nut.max.y>base.max.y,'nut still joins lowered base');
});
