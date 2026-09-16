import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredDrawingInstrumentMovement as create} from '../src/simulation/authored-drawing-instruments.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';

function audit() {
  const points=new Map(),solids=new Map(),minima={};let queries=0;
  const check=(a,b,label)=>{
    if(!points.has(a.geometry))points.set(a.geometry,surfacePoints(a.geometry));
    if(!solids.has(b.geometry))solids.set(b.geometry,solidSurface(b.geometry));
    const field=solids.get(b.geometry),matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);
    for(const p of points.get(a.geometry)){
      const gap=field.signedDistance(p.clone().applyMatrix4(matrix),.1);queries++;
      assert.ok(Number.isFinite(gap)&&gap>=-2e-6,`${label}: ${gap}`);
      minima[label]=Math.min(minima[label]??.1,gap);
    }
  };
  return{check,both:(a,b,l)=>{check(a,b,l);check(b,a,l);},report:()=>({queries,minima})};
}

test('246 actual bored bars and slide passages clear their captured pins through a complete trace',()=>{
  const m=create({id:246}),d=m.root.userData,b=d.blocks,w=d.workingParts,g=d.geometry,auditParts=audit();
  const pins=Object.values(b.jointPins).map(p=>p.children[0]);
  const small=[...pins,w.fixedPost,b.pencilShaft,b.tracerShaft];
  for(let i=0;i<=32;i++){
    m.update(g.cyclePeriod*i/32);m.root.updateMatrixWorld(true);
    for(const bar of w.bars){
      for(const pin of small)auditParts.both(bar,pin,'bar/pin');
      for(const slide of [...w.fixedSlide,...w.pencilSlide])auditParts.both(bar,slide,'bar/slide');
      for(const joint of Object.values(b.jointPins))for(const washer of joint.children.slice(1))auditParts.both(bar,washer,'bar/retainer');
      for(const fixed of [w.fixedCap,w.fixedRing])auditParts.both(bar,fixed,'bar/fixed-retainer');
    }
    for(let j=0;j<w.bars.length;j++)for(let k=j+1;k<w.bars.length;k++)auditParts.both(w.bars[j],w.bars[k],'bar/bar');
    for(const slide of w.fixedSlide)auditParts.both(slide,w.fixedPost,'fixed-slide/post');
    for(const slide of w.pencilSlide)auditParts.both(slide,b.pencilShaft,'pencil-slide/shaft');
    auditParts.both(pins[0],b.tracerShaft,'compound-pin/tracer');
    auditParts.both(pins[0],b.tracerKnob,'compound-pin/knob');
  }
  console.log({id:246,...auditParts.report()});
});

test('246 finite bore stations stay centered on pins with axial capture and close running clearance',()=>{
  const m=create({id:246}),d=m.root.userData,b=d.blocks,w=d.workingParts,g=d.geometry;
  const pinMap=[[w.fixedPost,b.jointPins.L.children[0],b.jointPins.R.children[0]],
    [b.pencilShaft,b.jointPins.U.children[0],b.jointPins.R.children[0]],
    [b.jointPins.B.children[0],b.jointPins.U.children[0]],
    [b.jointPins.B.children[0],b.jointPins.L.children[0]]];
  for(let i=0;i<=64;i++){
    m.update(g.cyclePeriod*i/64);m.root.updateMatrixWorld(true);
    for(let j=0;j<4;j++){
      const bar=w.bars[j];
      for(let k=0;k<bar.userData.holes.length;k++){
        const h=bar.userData.holes[k],pin=pinMap[j][k],p=bar.localToWorld(new THREE.Vector3(h.station,0,0)),q=pin.getWorldPosition(new THREE.Vector3());
        assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<1e-12);
        pin.geometry.computeBoundingBox();const box=pin.geometry.boundingBox.clone().applyMatrix4(pin.matrixWorld);
        assert.ok(box.min.y<p.y-g.barThickness/2&&box.max.y>p.y+g.barThickness/2);
        const radius=pin.geometry.parameters?.radiusTop??.105;
        assert.ok(h.radius-radius>.0029&&h.radius-radius<.0041);
      }
    }
  }
});

test('246 pencil apex and spherical tracer meet the paper without finite penetration',()=>{
  const m=create({id:246}),d=m.root.userData,b=d.blocks,g=d.geometry;
  for(let i=0;i<=32;i++){
    m.update(g.cyclePeriod*i/32);m.root.updateMatrixWorld(true);
    for(const tip of [b.pencilTip,b.tracerTip]){
      const points=surfacePoints(tip.geometry).map(p=>tip.localToWorld(p));
      const gap=Math.min(...points.map(p=>p.y))-g.paperTopY;
      assert.ok(gap>=-1e-8&&gap<1e-7,`tip/paper ${gap}`);
      const state=d.contacts[tip===b.pencilTip?'pencilAToPaper':'tracerBToPaper'];
      assert.ok(points.some(p=>p.distanceTo(state.point)<1e-7));
    }
    for(const shaft of [b.pencilShaft,b.tracerShaft])assert.ok(new THREE.Box3().setFromObject(shaft).min.y>g.paperTopY);
  }
});

test('246 reuses finite geometry and keeps the six-second analytic trace and rendering qualification',()=>{
  const m=create({id:246}),d=m.root.userData,geometries=[];
  m.root.traverse(o=>{if(o.geometry)geometries.push(o.geometry);});
  for(let i=0;i<100;i++)m.update(i*.137);
  const after=[];m.root.traverse(o=>{if(o.geometry)after.push(o.geometry);for(const mat of[].concat(o.material??[]))assert.equal(mat.fog,false);});
  assert.deepEqual(after,geometries);assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,6);
  assert.match(d.reconstructionNote,/prescribed/);assert.match(d.reconstructionNote,/2:1/);
});
