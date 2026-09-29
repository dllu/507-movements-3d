import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
import {FACE_SLOT_WORM_195 as slotted,crestGridKey195} from '../src/simulation/face-slot-worm-195.js';
import crest from '../src/data/worm-crest-195.js';
function verifySources(report){for(const x of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(x.file)).digest('hex'),x.sha256,x.file);const x=report.factorySource,s=fs.readFileSync(x.file,'utf8'),a=s.indexOf('function '+x.name+'('),b=s.indexOf('\nfunction ',a+1);assert.equal(createHash('sha256').update(s.slice(a,b)).digest('hex'),x.sha256,x.name);}
for(const id of[195,207]){
 test(`${id} actual shaft surfaces clear every exposed hub and solid worm bore`,()=>{
  const m=createAuthoredGearMovement({id}),d=m.root.userData,b=d.blocks,pairs=d.journalReview.map(j=>[j.shaft.userData.rotor.children[0],j.part]);
  if(id===195){for(const side of['upper','lower']){pairs.push([b[side+'WheelShaft'].userData.rotor.children[0],b[side+'GeneratedFace']]);pairs.push([b[side+'WheelShaft'].userData.rotor.children[0],b[side+'SmoothBack']]);}pairs.push([b.wormShaft.userData.rotor.children[0],b.worm.userData.thread]);}
  else for(const side of['left','right'])pairs.push([b.inputShaft.userData.rotor.children[0],b[side+'Worm'].userData.thread]);
  const prepared=pairs.map(([shaft,part])=>({shaft,part,points:surfacePoints(shaft.geometry),solid:solidSurface(part.geometry)}));let count=0,min=Infinity;
  for(let pose=0;pose<17;pose++){m.update(d.transmission.inputPeriod*pose/16);m.root.updateMatrixWorld(true);for(const{shaft,part,points,solid}of prepared){const transform=part.matrixWorld.clone().invert().multiply(shaft.matrixWorld);for(const p of points){const q=p.clone().applyMatrix4(transform);if(solid.box.distanceToPoint(q)>.005)continue;const gap=solid.signedDistance(q,.005);assert.ok(gap>-.000001,`${id} bore penetration ${gap}`);min=Math.min(min,gap);count++;}}}
  assert.ok(count>100);assert.ok(min>.0007,`minimum bore clearance ${min}`);disposeObject3D(m.root);
 });
 test(`${id} source framing fits actual visible vertices through a complete wheel turn`,()=>{
  const m=createAuthoredGearMovement({id}),d=m.root.userData;assert.equal(d.hideGround,true);assert.ok(m.cameraDirection.z>50*m.cameraDirection.x);const points=[];
  m.root.traverseVisible(o=>{if(!o.isMesh)return;for(const mat of(Array.isArray(o.material)?o.material:[o.material]))assert.equal(mat.fog,false);points.push([o,o.geometry.attributes.position]);assert.equal(o.castShadow,!o.userData.noShadow);});
  // p101: only 195's short wheel-shaft stubs are tagged noShadow (their claw shadow hid the hubs).
  if(id===195){const tagged=[];m.root.traverse(o=>{if(o.isMesh&&o.userData.noShadow)tagged.push(o);});assert.ok(tagged.length>0);for(const o of tagged)assert.ok(['upper','lower'].some(side=>{let p=o;while(p){if(p===d.blocks[side+'WheelShaft'])return true;p=p.parent;}return false;}));}
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
// Closed and outward: every directed edge is matched by its reverse.
function closedVolume(g){
 const p=g.attributes.position,key=k=>[p.getX(k),p.getY(k),p.getZ(k)].map(v=>Math.round(v*1e6)).join(),edges=new Map();let volume=0;
 for(const t of surfaceTriangles(g))volume+=t.a.dot(t.b.clone().cross(t.c))/6;
 for(let f=0;f<p.count;f+=3)for(let e=0;e<3;e++){const a=key(f+e),c=key(f+(e+1)%3);if(a!==c)edges.set(a+'|'+c,(edges.get(a+'|'+c)??0)+1);}
 let open=0;for(const[k,c]of edges){const[a,d]=k.split('|');if((edges.get(d+'|'+a)??0)!==c)open++;}
 return{volume,open};
}
test('195 wheels carry Brown\'s rectangular rim-open face slots as one closed solid each (p99)',()=>{
 const m=createAuthoredGearMovement({id:195}),b=m.root.userData.blocks;
 for(const side of['upper','lower']){
  const w=b[side+'GeneratedFace'],g=w.geometry;assert.ok(!w.isInstancedMesh);
  const{volume,open}=closedVolume(g);assert.equal(open,0);
  // Disc less 24 slots and the bore.
  const slotArea=slotted.slotWidth*(Math.sqrt(slotted.wheelOuterRadius**2-(slotted.slotWidth/2)**2)-slotted.slotInnerRadius);
  const expected=Math.PI*(slotted.wheelOuterRadius**2-slotted.boreRadius**2)*slotted.wheelDepth-24*slotArea*slotted.slotDepth;
  assert.ok(Math.abs(volume-expected)<2e-3*expected,`${side} volume ${volume} vs ${expected}`);
  // The slot walls are straight and parallel: every wall vertex lies at
  // tangential offset +-w/2 from its slot's centre line.
  const p=g.attributes.position,n=g.attributes.normal,pitch=2*Math.PI/24;let walls=0;
  for(let k=0;k<p.count;k++){const z=side==='upper'?p.getZ(k):-p.getZ(k);if(z>1e-9||z<-slotted.slotDepth-1e-9)continue;
   const x=p.getX(k),y=side==='upper'?p.getY(k):-p.getY(k),r=Math.hypot(x,y);if(r>slotted.wheelOuterRadius-1e-6)continue;
   const a=Math.atan2(y,x),d=a-Math.round(a/pitch)*pitch,t=r*Math.sin(d);
   if(Math.abs(n.getZ(k))<1e-6&&Math.abs(Math.abs(t)-slotted.slotWidth/2)<2e-6)walls++;}
  assert.ok(walls>=24*2*6,`${side} straight wall vertices ${walls}`);
 }
 disposeObject3D(m.root);
});
test('195 worm is one closed square-threaded solid whose crest the slots cut (p99)',()=>{
 const m=createAuthoredGearMovement({id:195}),worm=m.root.userData.blocks.worm,g=worm.userData.thread.geometry;
 assert.equal(g.userData.trimmed,true);assert.equal(crest.grid,crestGridKey195());
 const{volume,open}=closedVolume(g);assert.equal(open,0);assert.ok(volume>.1&&volume<.2,`worm volume ${volume}`);
 // Both wheels cut the same crest (the pair is symmetric about the worm).
 assert.ok(crest.sideDifference<1e-4,`side difference ${crest.sideDifference}`);
 // Only the crest is cut, never below the face level less the clearance.
 assert.ok(crest.minimumCrestRadius>=slotted.faceOffset-slotted.clearance-slotted.crestAllowance-1e-7);
 assert.ok(crest.entries.length>1000);
 for(const[,,r]of crest.entries)assert.ok(r<slotted.wormTipRadius&&r>slotted.wormRootRadius);
 // The root stands clear of both wheel faces.
 assert.ok(slotted.wormRootRadius<slotted.faceOffset-.1);
 disposeObject3D(m.root);
});
test('195 full opposed finite-solid sweep has no sampled penetration',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/feed-worm-195-solids.json'));verifySources(report);assert.equal(report.poses,17);assert.equal(report.status,'sampled-flanks-clear');for(const r of report.results){assert.equal(r.penetrations,0);assert.ok(r.queries>200000);assert.ok(r.minimumGap>.002);}
});
