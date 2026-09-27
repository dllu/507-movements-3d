import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import{createAuthoredWetGasMeterMovement as a}from'../src/simulation/authored-wet-gas-meters.js';
import{createAuthoredMercuryGasRegulatorMovement as c}from'../src/simulation/authored-mercury-gas-regulators.js';
import{createAuthoredDryGasMeterMovement as e}from'../src/simulation/authored-dry-gas-meters.js';
import{solidSurface,surfacePoints}from'./helpers/solid-surface.mjs';
for(const[id,create]of[[481,a],[482,c],[483,e]])test(`${id} selected finite passages, guides and neighboring moving interfaces clear through the cycle`,()=>{
const m=create({id}),d=m.root.userData,b=d.blocks,pairs=[];
const meshes=o=>{const list=[];o.traverseVisible(p=>{if(p.geometry)list.push(p);});return list;};
if(id===481){for(const o of[b.centralInletPipeA,...b.flowMarkers])for(const f of[b.journal,b.axle,...b.drumHeads,...b.partitions.flatMap(meshes)])pairs.push([o,f]);for(const o of[b.drumShell,...b.drumHeads])for(const f of[b.caseShell,b.rearCaseHead])pairs.push([o,f]);}
if(id===482){for(const o of[...b.cupHSkirts,...b.cupCrossSkirts])for(const f of[b.outerMercuryChannels[0].trough,b.innerTroughWalls,b.innerMercuryChannel.children.find(o=>o.userData.role==='fixed-base-of-valve-D-mercury-seat')])pairs.push([o,f]);for(const o of[...b.valveCornerPosts,...b.valveSkirtFaces])for(const f of[b.innerTroughWalls,b.outerMercuryChannels[0].trough,b.innerMercuryChannel.children.find(o=>o.userData.role==='fixed-base-of-valve-D-mercury-seat')])pairs.push([o,f]);pairs.push([b.cupHGuideRod,b.guideBushing],[b.cupHGuideRod,b.housingRoof],[b.leverBar,b.leverFulcrum],[b.leverBar,b.leverStand]);for(let i=0;i<2;i++)pairs.push([[b.cupLeverPin,b.valveLeverPin][i],b.sliderSeats[i]]);}
if(id===483){for(const o of[b.valveBTop,...b.valveBSkirts,...b.valveCrossSkirts,b.valveBStem,b.stemSlot])for(const f of[b.valvePortPlate,b.valveChest,...b.valvePorts,...b.valveGuides])pairs.push([o,f]);for(const o of[b.crossheadBar,b.movingA.flagRod,b.movingAPrime.flagRod])pairs.push([o,b.galleryFloor]);pairs.push([b.rockerArm,b.rockerFulcrum],[b.rockerPin,b.stemSlot]);for(const tube of[b.leftBranchTube,b.rightBranchTube])for(const f of[b.galleryFloor,b.leftFixedPlate,b.rightFixedPlate])pairs.push([tube.mesh,f]);}
if(id===483)pairs.push([b.inletTube.mesh,b.roof],[b.inletTube.mesh,b.valveChest],[b.outletTube.mesh,b.roof],[b.outletTube.mesh,b.valvePortPlate],[b.crossheadBar,b.valvePortPlate],[b.movingA.flagRod,b.valvePortPlate],[b.movingAPrime.flagRod,b.valvePortPlate]);
// Pass 70: the outlet column rises from the seat board through the roof, and
// the stem, slot plate and rocker stand in separate planes.
if(id===483)for(const o of[b.rockerArm,b.rockerPin])for(const f of[b.valveBStem,b.stemSlotTie,...b.valveGuides,b.valveChest])pairs.push([o,f]);
const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{o,p:surfacePoints(o.geometry),s:solidSurface(o.geometry)});return cache.get(o);};let bad={};
const count=64;
for(let i=0;i<=count;i++){m.update(d.geometry.cycleDuration*i/count);m.root.updateMatrixWorld(true);for(const [aa,cc]of pairs){const a=get(aa),c=get(cc);if(a.o.scale.x===0||c.o.scale.x===0)continue;if(!new T.Box3().setFromObject(a.o).intersectsBox(new T.Box3().setFromObject(c.o)))continue;for(const [v,f]of[[a,c],[c,a]]){const tr=f.o.matrixWorld.clone().invert().multiply(v.o.matrixWorld);for(const p of v.p){const q=p.clone().applyMatrix4(tr);if(f.s.box.distanceToPoint(q)>.001)continue;const gap=f.s.signedDistance(q,.02),key=`${v.o.userData.role||v.o.id} / ${f.o.userData.role||f.o.id}`;if(gap<-.000002&&gap<(bad[key]?.gap||0))bad[key]={i,gap,p:q.toArray()};}}}}
disposeObject3D(m.root);assert.deepEqual(bad,{});});

for(const[id,create]of[[481,a],[482,c],[483,e]])test(`${id} retains scene and GPU geometry with readable playback`,()=>{
 const m=create({id}),d=m.root.userData;
 try{const snapshot=()=>{const out=[];m.root.traverse(o=>out.push([o,o.geometry]));return out;},before=snapshot();for(let i=0;i<129;i++)m.update(i*d.geometry.cycleDuration/128);assert.deepEqual(snapshot(),before);assert.equal(d.minimumDisplayCycleSeconds,8);assert.equal(d.hideGround,true);assert.match(d.workingPartsReview.residual,/not solved/);}finally{disposeObject3D(m.root);}
});
test('481 hollow journal and actual end-plate apertures retain material around the inlet clearance',()=>{
 const m=a({id:481}),d=m.root.userData,b=d.blocks;
 try{
  const journal=solidSurface(b.journal.geometry);assert.equal(journal.inside(new T.Vector3(0,.58,0)),false);assert.equal(journal.inside(new T.Vector3(.2,.58,0)),true);
  // Pass 55: the section plane z = .48 removes the front head (and its
  // outlet slots) entirely. Pass 59: gas enters through the hooked chamber
  // mouths round pipe a, so the rear head is whole apart from its journal bore.
  assert.equal(b.drumHeads[1].parent,null,'front drum head lies wholly in front of the section');
  {const surface=solidSurface(b.drumHeads[0].geometry);for(const p of b.rearInletSlots)assert.equal(surface.inside(new T.Vector3(p.position.x,p.position.y,-.52)),true);assert.equal(surface.inside(new T.Vector3(1.2,0,-.52)),true);assert.equal(surface.inside(new T.Vector3(0,0,-.52)),false);}
  const outlet=d.flowPaths.centralInletCurve.getPoint(1);assert.ok(outlet.y-.040>d.geometry.waterSurfaceY,'complete inlet bore emerges above the water');
 }finally{disposeObject3D(m.root);}
});
test('483 real slide-valve ports lie inside the exhaust hood in both fully switched positions',()=>{
 const m=e({id:483}),d=m.root.userData,b=d.blocks;
 try{
  // Pass 70: the common outlet no longer leaves the open case front; it is
  // Brown's left column, rising from the seat board through the roof.
  {m.root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(b.outletTube.mesh);assert.ok(box.max.z<0&&box.max.x<-2&&box.max.y>3.15&&box.min.y>1.1,'outlet column stands behind the valve plane on the left');assert.equal(b.outletFlange.visible,false);}
  const seat=solidSurface(b.valvePortPlate.geometry);for(const x of[-.76,0,.76])assert.equal(seat.inside(new T.Vector3(x,0,0)),false);assert.equal(seat.inside(new T.Vector3(.3,0,0)),true);
  for(const time of[0,4]){m.update(time);m.root.updateMatrixWorld(true);const shift=b.valveB.position.x,selected=shift<0?-.76:.76;for(const x of[selected,0]){assert.ok(Math.abs(x-shift)+.13<.54,'open port fits within actual D-valve cavity');}}
 }finally{disposeObject3D(m.root);}
});
