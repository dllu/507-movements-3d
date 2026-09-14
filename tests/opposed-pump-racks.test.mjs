import test from 'node:test';
import assert from 'node:assert/strict';
import clip from 'polygon-clipping';
import * as THREE from 'three';
import {makeOpposedPumpRacks} from '../src/simulation/opposed-pump-racks.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

test('127 keeps the engraved proportions and equal opposite rack travel through a full stroke',()=>{
 const v=makeOpposedPumpRacks(),u=v.root.userData,d=u.geometry;
 try{
  // Independent raster measurements: wheel diameter ~190, rack length ~356,
  // shaft at (252,263), and handle separation (470,211), in source pixels.
  assert(Math.abs(2*u.blocks.pinion.userData.outerRadius*100-190)<1);
  assert.equal(d.rackLength*100,356);
  assert.equal(d.rightRackLength*100,372);
  assert(Math.abs(d.leverHalfLength*200-Math.hypot(470,211))<1);
  assert.equal(u.blocks.body.geometry.parameters.shapes.holes.length,4);
  let min=Infinity,max=-Infinity;
  for(let i=0;i<=720;i++){
   v.update(i*d.period/720);v.root.updateMatrixWorld(true);
   const {angle,leftY,rightY}=u.state;
   assert(Math.abs(leftY+rightY-d.leftY-d.rightY)<1e-12);
   assert(Math.abs((rightY-d.rightY)-d.radius*angle)<1e-12);
   min=Math.min(min,rightY);max=Math.max(max,rightY);
   // All rack solids fit inside the explicit full-cycle camera bounds.
   for(const rack of u.blocks.racks){const box=new THREE.Box3().setFromObject(rack);assert(u.cameraFitBounds.containsBox(box));}
  }
  assert(Math.abs(max-min-2*d.radius*Math.PI/3)<1e-10);
  assert.equal(u.hideGround,true);assert.equal(u.simulationBackend,'analytical');
 }finally{disposeObject3D(v.root);}
});

test('127 finite tooth profiles do not overlap across 721 poses, and detect a wrong mesh phase',()=>{
 const v=makeOpposedPumpRacks(),u=v.root.userData,d=u.geometry;
 const outline=u.blocks.body.geometry.parameters.shapes.getPoints(24).map(p=>[p.x,p.y]);
 const distance=(p,a,b)=>{
  const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y)));
  return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);
 };
 const area=multi=>multi.reduce((sum,poly)=>sum+poly.reduce((s,r,i)=>s+(i?-1:1)*Math.abs(r.reduce((a,p,j)=>{const q=r[(j+1)%r.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2),0),0);
 const overlap=(time,phase=0)=>{
  const s=u.stateAtTime(time),c=Math.cos(s.angle+phase),sn=Math.sin(s.angle+phase);
  const gear=[outline.map(([x,y])=>[c*x-sn*y,sn*x+c*y])];
  return d.rackProfiles.map((profile,i)=>area(clip.intersection(gear,[profile.map(([x,y])=>[x,y+(i?s.rightY:s.leftY)])])));
 };
 try{
  for(let i=0;i<=720;i++)assert(Math.max(...overlap(i*d.period/720))<1e-12);
  for(let i=0;i<=120;i++){
   const s=u.stateAtTime(i*d.period/120),c=Math.cos(s.angle),sn=Math.sin(s.angle);
   const gear=outline.map(([x,y])=>[c*x-sn*y,sn*x+c*y]);
   for(let side=0;side<2;side++){
    const rack=d.rackProfiles[side].map(([x,y])=>[x,y+(side?s.rightY:s.leftY)]);
    let gap=Infinity;
    for(const p of gear)for(let j=0;j<rack.length;j++)gap=Math.min(gap,distance(p,rack[j],rack[(j+1)%rack.length]));
    assert(gap*100<.3,`rack must stay within 0.3 pixels of a working flank, got ${gap*100}`);
   }
  }
  assert(Math.max(...overlap(0,Math.PI/d.teeth))>.001,'half-tooth wrong phase must fail');
  // Lever front lies behind both rack and gear rear faces, including its knobs.
  const leverBox=new THREE.Box3().setFromObject(u.blocks.leverGroup);
  assert(leverBox.max.z < -d.depth/2);
 }finally{disposeObject3D(v.root);}
});
