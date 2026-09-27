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
if(id===481){for(const o of[b.centralInletPipeA,...b.flowMarkers])for(const f of[b.journal,b.axle,b.rearCaseHead,...b.drumHeads,...b.partitions.flatMap(meshes)])pairs.push([o,f]);for(const o of[...b.partitions.flatMap(meshes),...b.drumHeads])for(const f of[b.caseShell,b.rearCaseHead])pairs.push([o,f]);}
if(id===482){for(const o of[...b.cupHSkirts,...b.cupCrossSkirts])for(const f of[b.outerMercuryChannels[0].trough,b.innerTroughWalls,b.innerMercuryChannel.children.find(o=>o.userData.role==='fixed-base-of-valve-D-mercury-seat')])pairs.push([o,f]);for(const o of[...b.valveCornerPosts,...b.valveSkirtFaces])for(const f of[b.innerTroughWalls,b.outerMercuryChannels[0].trough,b.innerMercuryChannel.children.find(o=>o.userData.role==='fixed-base-of-valve-D-mercury-seat')])pairs.push([o,f]);pairs.push([b.cupHGuideRod,b.guideBushing],[b.cupHGuideRod,b.housingRoof],[b.leverBar,b.leverFulcrum],[b.leverBar,b.leverStand]);for(let i=0;i<2;i++)pairs.push([[b.cupLeverPin,b.valveLeverPin][i],b.sliderSeats[i]]);}
// Pass 74: Brown's elevation rebuilt — D-cup valve B on its spindle under the C
// bracket, flag rods with arms, links, eccentric and crank, four ducts.
if(id===483){pairs.push([b.valveB,b.shelf],[b.valveB,b.cBracket],[b.spindleShaft,b.cBracket],[b.crankDisc,b.cBracket],[b.sheave,b.cBracket],[b.crankLinkA,b.crankDisc],[b.crankLinkA,b.cBracket],[b.crankLinkAPrime,b.crankDisc],[b.crankLinkAPrime,b.dialCase],[b.crankLinkA,b.crankPins[0]],[b.rodA.shaft,b.shelf],[b.outletColumn,b.roof],[b.outletColumn,b.shelf]);for(const rod of[b.rodA,b.rodAPrime])for(const f of[b.floor,b.roof,b.dialCase,...b.fixedBoards])pairs.push([rod.shaft,f],[rod.topArm,f]);for(const[links,plate]of[[b.flagLinksA,b.movingA],[b.flagLinksAPrime,b.movingAPrime]])for(const link of links)pairs.push([link,plate.board],[link,plate.pins[0]],[link,plate.pins[1]]);for(const r of b.ductRuns){for(const f of[b.shelf,b.backPanel,b.partition,...b.fixedBoards,b.movingAPrime.pins[0],b.movingAPrime.board,b.rodA.shaft])pairs.push([r.mesh,f]);for(const q of b.ductRuns)if(q!==r)pairs.push([r.mesh,q.mesh]);}}
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
  const journal=solidSurface(b.journal.geometry);assert.equal(journal.inside(new T.Vector3(0,-.58,0)),false);assert.equal(journal.inside(new T.Vector3(.2,-.58,0)),true);// Pass 74: the front journal lies in front of the section and is cut away.
  // Pass 55: the section plane z = .48 removes the front head entirely.
  // Pass 74: gas enters through the hooked chamber mouths round pipe a and
  // leaves through the gaps in the shell, so the rear head is whole apart
  // from its journal bore.
  assert.equal(b.drumHeads[1].parent,null,'front drum head lies wholly in front of the section');
  {const surface=solidSurface(b.drumHeads[0].geometry);for(const p of[...b.chamberMouths,...b.peripheralOutletSlots])assert.equal(surface.inside(new T.Vector3(p.position.x*.97,p.position.y*.97,-.52)),true);assert.equal(surface.inside(new T.Vector3(1.2,0,-.52)),true);assert.equal(surface.inside(new T.Vector3(0,0,-.52)),false);}
  const outlet=d.flowPaths.centralInletCurve.getPoint(1);assert.ok(outlet.y-.040>d.geometry.waterSurfaceY,'complete inlet bore emerges above the water');
 }finally{disposeObject3D(m.root);}
});
// Pass 82: pipe a is continuous from outside the rear case head, through the
// head's bore and the rear hollow journal, along the axis to its turned-up
// mouth in the central well, so the gas has a way in.
test('481 pipe a runs from behind the case head through the rear journal to its turned-up mouth',()=>{
 const m=a({id:481}),d=m.root.userData,b=d.blocks,curve=d.flowPaths.centralInletCurve;
 try{
  m.root.updateMatrixWorld(true);
  const headZ=new T.Vector3().setFromMatrixPosition(b.rearCaseHead.matrixWorld).z,start=curve.getPoint(0),end=curve.getPoint(1);
  assert.ok(start.z<headZ-.1&&Math.hypot(start.x,start.y)<1e-6,'pipe a starts on the axis outside the rear case head');
  assert.ok(end.y>d.geometry.waterSurfaceY&&end.z<.48,'mouth above the water, behind the section');
  const journal=new T.Box3().setFromObject(b.journal);assert.ok(journal.min.z<-.6&&start.z<journal.min.z,'rear journal lies on the pipe run');
  for(let i=0;i<=200;i++){const p=curve.getPoint(i/200);if(p.z<-.25)assert.ok(Math.hypot(p.x,p.y)<1e-3,`axial run on the axis at ${p.z}`);}
  const head=solidSurface(b.rearCaseHead.geometry);assert.equal(head.inside(new T.Vector3(.10,0,0)),false,'head bored for the pipe');assert.equal(head.inside(new T.Vector3(.2,0,0)),true);
 }finally{disposeObject3D(m.root);}
});
// Pass 82: the port ducts run in passages cored inside the thick back wall;
// nothing of them lies outside the case.
test('483 port ducts stay inside the case and its back wall',()=>{
 const m=e({id:483}),d=m.root.userData,b=d.blocks;
 try{m.root.updateMatrixWorld(true);const wall=new T.Box3().setFromObject(b.backPanel);
  for(const r of b.ductRuns){const box=new T.Box3().setFromObject(r.mesh);assert.ok(box.min.z>wall.min.z+.04,`${r.mesh.userData.role} inside the back wall`);}
 }finally{disposeObject3D(m.root);}
});
test('483 turning valve B exhausts each port through its cavity and admits it outside the cup', () => {
 const m=e({id:483}),d=m.root.userData,b=d.blocks,g=d.geometry;
 try{
  // The outlet column stands on the shelf at the left and rises through the roof.
  {m.root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(b.outletColumn);assert.ok(box.max.x<-2.2&&box.min.y>3.5&&box.max.y>6,'outlet column at the left, through the roof');}
  const seat=solidSurface(b.shelf.geometry);const top=g.layout.shelfTopY-.02;
  for(const s of g.spaces)assert.equal(seat.inside(new T.Vector3(s.port[0],top,s.port[1])),false,`${s.key} port bored through the seat`);
  assert.equal(seat.inside(new T.Vector3(g.layout.crankCenter[0],top,g.layout.crankCenter[1])),false,'central exhaust port');
  assert.equal(seat.inside(new T.Vector3(-1.2,top,1.2)),true,'shelf solid elsewhere');
  const valve=solidSurface(b.valveB.geometry);
  for(let i=0;i<64;i++){const t=g.cycleDuration*i/64;m.update(t);m.root.updateMatrixWorld(true);const st=d.stateAtTime(t);
   const inv=b.valveB.matrixWorld.clone().invert();
   for(const p of st.ports){const s=g.spaces.find(x=>x.key===p.key);const q=new T.Vector3(s.port[0],g.layout.shelfTopY+.05,s.port[1]).applyMatrix4(inv);
    if(p.state==='exhaust')assert.ok(Math.hypot(q.x,q.z)<.58-.085+1e-6&&!valve.inside(q),`${p.key} under the cavity at ${t}`);
    if(p.state==='admit')assert.equal(valve.inside(q),false,`${p.key} open to the case at ${t}`);}
  }
 }finally{disposeObject3D(m.root);}
});
