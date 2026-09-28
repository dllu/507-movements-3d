import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {eggAtAngle,eggAtTime,eggGeometry as g,eggSource as source} from '../src/simulation/egg-curve-motion.js';
import {createAuthoredCurveGeneratorMovement} from '../src/simulation/authored-curve-generators.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
test('172 closes its finite offset slider-crank and keeps the tracer on the rod',()=>{
 for(let i=0;i<=720;i++) {const s=eggAtAngle(i*Math.PI/360);
  assert.ok(Math.abs(Math.hypot(...s.crank)-g.radius)<1e-12);
  assert.ok(Math.abs(Math.hypot(...s.wrist.map((v,j)=>v-s.crank[j]))-g.length)<1e-12);
  assert.equal(s.wrist[1],g.guideY);
  assert.ok(Math.abs(Math.hypot(...s.tracer.map((v,j)=>v-s.crank[j]))-g.fraction*g.length)<1e-12);
 }
});
test('172 fits the engraving joints with the projected tracer within three pixels',()=>{
 const s=eggAtTime(0);for(const name of ['crank','wrist','tracer']){
  const projected=[source.shaft[0]+s[name][0]/source.scale,source.shaft[1]-s[name][1]/source.scale];
  assert.ok(Math.hypot(...projected.map((v,i)=>v-source[name][i]))<(name==='tracer'?3:1e-9));
 }
});
test('172 renders the solved tracer, repeats and restarts without fog or ground',()=>{
 const m=createAuthoredCurveGeneratorMovement({id:172});
 try {for(const t of [0,.7,2,3.6,4]){m.update(t);m.root.updateMatrixWorld(true);const s=eggAtTime(t);
  const p=m.root.userData.parts.tracer.getWorldPosition(new THREE.Vector3());assert.ok(Math.hypot(p.x-s.tracer[0],p.y-s.tracer[1])<1e-12);
  m.root.traverse(o=>{if(o.isMesh){assert.ok(o.matrixWorld.elements.every(Number.isFinite));assert.equal(o.material.fog,false);}});
 }
 const a=eggAtTime(0),b=eggAtTime(4);assert.ok(Math.hypot(...a.tracer.map((v,i)=>v-b.tracer[i]))<1e-12);
 m.reset();assert.deepEqual(m.root.userData.kinematics,a);assert.equal(m.root.userData.hideGround,true);
 }finally{disposeObject3D(m.root);}
});
test('172 (pass 90): the wrist is Brown\'s large eye on a crosshead bar sliding along the guide line; no undrawn frame is built',()=>{
 const m=createAuthoredCurveGeneratorMovement({id:172});
 try {const {parts}=m.root.userData;
  assert.ok(parts.crossheadEye);for(const n of ['guideFrame','backBar','shaftBearingFlange','guideFrameFlange','slider'])assert.equal(parts[n],undefined,n);
  const box=new THREE.Box3().setFromBufferAttribute(parts.crossheadEye.geometry.attributes.position);
  assert.ok(Math.abs(box.min.x+.30)<1e-3&&Math.abs(box.max.y-.30)<1e-3,'eye radius matches the crank bosses');
  for(const t of [0,1,2,3]){m.update(t);m.root.updateMatrixWorld(true);const p=parts.crossheadEye.getWorldPosition(new THREE.Vector3());
   assert.ok(Math.abs(p.y-g.guideY)<1e-12);assert.ok(Math.abs(p.x-eggAtTime(t).wrist[0])<1e-12);}
 }finally{disposeObject3D(m.root);}
});
test('172 (pass 93): the tracing point reads as a ring eye on the rod, concentric with its pin',()=>{
 const m=createAuthoredCurveGeneratorMovement({id:172});
 try {const {tracer,tracerEye,rod}=m.root.userData.parts;
  for(const o of [tracer,tracerEye,rod])o.geometry.computeBoundingBox();
  const eye=tracerEye.geometry.boundingBox,r=rod.geometry.boundingBox;
  assert.ok(eye.max.x-eye.min.x>.19,'eye nearly the rod width');
  assert.ok(Math.abs(eye.min.z-r.max.z)<1e-9,'eye seated on the rod face');
  assert.equal(tracer.position.x,tracerEye.position.x);
 }finally{disposeObject3D(m.root);}
});
