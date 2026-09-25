import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredVariableCrankMovement} from '../src/simulation/authored-variable-cranks.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
test('178 fitted assembly closes the circle, radial slot and output rod over a full turn',()=>{
 const m=createAuthoredVariableCrankMovement({id:178}),u=m.root.userData,b=u.blocks;
 try{
  const shaft=b.inputCrank.position,center=b.fixedDiskCenterAnchor.position;
  let minimum=Infinity,maximum=0;
  for(let i=0;i<=720;i++){
   m.update(u.geometry.cyclePeriod*i/720);m.root.updateMatrixWorld(true);
   const pin=b.sliderAssembly.position,output=b.outputSlide.position;
   const dx=pin.x-shaft.x,dy=pin.y-shaft.y,r=Math.hypot(dx,dy);
   minimum=Math.min(minimum,r);maximum=Math.max(maximum,r);
   assert.ok(Math.abs(Math.hypot(pin.x-center.x,pin.y-center.y)-168*.62/32.8)<1e-10);
   assert.ok(Math.abs(dx*Math.sin(b.inputCrank.rotation.z)-dy*Math.cos(b.inputCrank.rotation.z))<1e-10);
   assert.ok(Math.abs(Math.hypot(pin.x-output.x,pin.y-output.y)-u.geometry.connectingRodLength)<1e-10);
   assert.ok(Math.abs(output.y-center.y)<1e-12);
   // The rod runs on past Brown's break to the tool slide and its guide,
   // beyond the framed drawing; everything drawn stays in frame.
   const beyond=new Set([b.connectingRodBeam,b.connectingRodOutputEye,b.outputSlide,...b.outputGuideRails,...b.outputGuideEndStops]),drawn=new THREE.Box3();
   m.root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(beyond.has(p))return;drawn.union(new THREE.Box3().setFromObject(o,true));});
   assert.ok(u.cameraFitBounds.containsBox(drawn),'drawn mechanism fits during motion');
  }
  assert.ok(Math.abs(minimum-92*.62/32.8)<1e-10);
  assert.ok(Math.abs(maximum-244*.62/32.8)<1e-10);
  m.reset();const source=u.modelPointToSourceRaster(new THREE.Vector2(b.sliderAssembly.position.x,b.sliderAssembly.position.y));
  assert.ok(source.distanceTo(new THREE.Vector2(295,77))<1e-10);
 }finally{disposeObject3D(m.root);}
});
