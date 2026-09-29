import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import * as THREE from 'three';
import {makeSilkTraverseAssembly} from '../src/simulation/mujoco-silk-tappet/assembly.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/173-tappet.json.gz',import.meta.url))));
test('173 source wrist, wheel center and guide endpoint fit the measured engraving',()=>{
 const m=makeSilkTraverseAssembly(bundle);try{
 const {parts,geometry:g}=m.root.userData,project=p=>[g.center[0]+p.x/g.scale,g.center[1]-p.y/g.scale];
 const samples=[['wrist',parts.wrist.getWorldPosition(new THREE.Vector3()),[159,310],1.1],
 ['wheel',parts.hub.getWorldPosition(new THREE.Vector3()),[362,187],1e-8],
 ['rod end',parts.guideRod.localToWorld(new THREE.Vector3(340*g.scale,0,0)),[499,283],1.1]];
 for(const [name,p,expected,tolerance]of samples)assert.ok(Math.hypot(...project(p).map((x,i)=>x-expected[i]))<tolerance,name);
 }finally{m.dispose();}
});
test('173 baked assembly retains nut lead, horizontal guide and reset through its adjustment',()=>{
 const m=makeSilkTraverseAssembly(bundle);try{
 const {parts,geometry:g,stateAtTime}=m.root.userData,initial=stateAtTime(0);
 for(let i=0;i<=720;i++){
  const time=g.duration*i/720;m.update(time);const s=m.root.userData.kinematics;
  assert.ok(Math.abs(s.nutStation-g.nutInitial+(s.wheel-initial.wheel)*g.lead/(2*Math.PI))<1e-12);
  const pin=parts.wrist.getWorldPosition(new THREE.Vector3());assert.ok(Math.hypot(pin.x-s.wrist[0],pin.y-s.wrist[1])<1e-12);
  assert.ok(Math.abs(parts.guideRod.getWorldPosition(new THREE.Vector3()).y)<1e-12);
  for(const mesh of Object.values(parts)){assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));assert.equal(mesh.material.fog,false);}
 }
 for(const cycle of [1,2,10]){m.update(g.duration*cycle+.5);assert.ok(Math.abs(m.root.userData.kinematics.wheel-stateAtTime(.5).wheel)<1e-10);}
 m.update(g.duration+.01);const before=m.root.userData.kinematics.carrier;m.update(g.duration+.1);assert.ok(m.root.userData.kinematics.carrier>before);m.reset();assert.deepEqual(m.root.userData.kinematics,initial);
 assert.equal(Object.keys(parts).length,39);assert.equal(m.root.userData.hideGround,true);
 }finally{m.dispose();}
});
test('173 striker is one stout horizontal stud with nut and collar seated on a plain striker box',()=>{
 const m=makeSilkTraverseAssembly(bundle);try{
 const {parts}=m.root.userData,box=o=>new THREE.Box3().setFromObject(o);
 for(const gone of ['tappetStem','tappetArm','frameWeb'])assert.equal(parts[gone],undefined,gone);
 const axis=new THREE.Vector3(1,0,0).applyQuaternion(parts.tappet.getWorldQuaternion(new THREE.Quaternion()));
 assert.ok(Math.abs(axis.y)<1e-3&&Math.abs(axis.z)<1e-9,'stud lies horizontal in the source view');
 const wheel=2*(.435+.045)*bundle.parameters.radialScale;
 assert.ok(bundle.parameters.pinRadius>=.05,'stout shank');
 parts.studCollar.geometry.computeBoundingBox();assert.ok(2*parts.studCollar.geometry.boundingBox.max.y>=.24*wheel,'collar about a quarter of the star wheel');
 const stud=box(parts.tappet),nut=box(parts.studNut),collar=box(parts.studCollar),support=box(parts.tappetSupport);
 assert.ok(Math.abs(nut.min.x-stud.max.x+bundle.parameters.pinRadius)<1e-3,'nut on the shank end');
 assert.ok(Math.abs(collar.min.x-nut.max.x)<1e-4&&Math.abs(collar.max.x-support.min.x)<1e-4,'collar seats on the box face');
 const zc=(stud.min.z+stud.max.z)/2;assert.ok(support.min.z<zc-.15&&support.max.z>zc+.15,'box centred on the stud');
 assert.ok(support.min.y>1,'striker box is a plain block, not a C-frame');
 }finally{m.dispose();}
});
test('173 (p109): the disc is a clean face with no painted-mark shadows; every other part casts',async()=>{
 const {applyShadowPolicy}=await import('../src/simulation/shadow-policy.js');
 const m=makeSilkTraverseAssembly(bundle);try{
  applyShadowPolicy(m.root);const {parts}=m.root.userData;
  assert.equal(parts.disk.castShadow,false);assert.equal(parts.disk.receiveShadow,false);
  for(const name of ['yoke','guideRod','guideBearing','guideBracket','guideFoot','footNeck'])assert.equal(parts[name].castShadow,true,name);
 }finally{m.dispose();}
});
