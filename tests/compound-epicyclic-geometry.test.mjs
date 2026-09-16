import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createAuthoredEpicyclicTrainMovement} from '../src/simulation/authored-epicyclic-trains.js';
import {solidSurface} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
for(const id of[506,507])test(`${id} ratio-derived cones share actual apices and complementary cone angles`,()=>{
 const m=createAuthoredEpicyclicTrainMovement(catalog[id-1]),b=m.root.userData.blocks;
 const pairs=id===506?[[b.gearA,b.gearB],[b.gearH,b.gearG],[b.gearC,b.gearD],[b.gearE,b.gearF]]:[[b.gearC,b.gearA],[b.gearC,b.gearD]];
 for(let i=0;i<=12;i++){m.update(i*.73);m.root.updateMatrixWorld(true);for(const[a,b]of pairs){
  assert.ok(Math.abs(a.userData.pitchConeAngle+b.userData.pitchConeAngle-Math.PI/2)<1e-12);
  assert.ok(a.localToWorld(a.userData.coneApexLocal.clone()).distanceTo(b.localToWorld(b.userData.coneApexLocal.clone()))<1e-12);
  assert.ok(Math.abs(Math.tan(a.userData.pitchConeAngle)-a.userData.teeth/b.userData.teeth)<1e-12);
 }}
 assert.equal(m.root.userData.hideGround,true);m.root.traverse(o=>{for(const mat of(Array.isArray(o.material)?o.material:[o.material]))if(mat)assert.equal(mat.fog,false);});disposeObject3D(m.root);
});
for(const id of[506,507])test(`${id} independent journals clear real bored gear bodies, hubs and sleeves`,()=>{
 const m=createAuthoredEpicyclicTrainMovement(catalog[id-1]),b=m.root.userData.blocks;
 const gears=id===506?[[b.gearA,.12],[b.gearB,.12],[b.gearC,.12],[b.gearD,.105],[b.gearE,.105],[b.gearF,.12],[b.gearG,.12],[b.gearH,.12]]:[[b.gearA,.135],[b.gearD,.105],[b.gearE,.105],[b.gearH,.135],[b.gearF,.105],[b.gearG,.105]];
 const check=(mesh,radius,axis)=>{mesh.updateMatrix();const inv=mesh.matrix.clone().invert(),surface=solidSurface(mesh.geometry);
  for(let j=0;j<32;j++)for(let k=0;k<=12;k++){const a=j*2*Math.PI/32,v=-.5+k/12,p=axis==='y'?new THREE.Vector3(radius*Math.cos(a),mesh.position.y+v,radius*Math.sin(a)):new THREE.Vector3(radius*Math.cos(a),radius*Math.sin(a),v);assert.equal(surface.inside(p.applyMatrix4(inv)),false,`${id} ${mesh.userData.role??'gear body'} journal`);}
 };
 for(const[g,r]of gears)for(const mesh of g.userData.rotor.children.filter(o=>o.userData.boreRadius))check(mesh,r,'z');
 if(id===507){for(const[mesh,r]of[[b.longSleeve,.105],[b.shortSleeve,.135],[b.planetSleeve,.105],[b.carrierHub,.105]])check(mesh,r,'y');}
 disposeObject3D(m.root);
});
test('507 spur flanks overlap engagement intervals and preserve the true very slow output',()=>{
 const m=createAuthoredEpicyclicTrainMovement(catalog[506]),b=m.root.userData.blocks;
 for(const[a,other]of[[b.gearE,b.gearF],[b.gearH,b.gearG]]){const p=a.userData,q=other.userData,alpha=p.pressureAngle,basePitch=Math.PI*p.module*Math.cos(alpha);assert.ok(Math.abs(basePitch-Math.PI*q.module*Math.cos(q.pressureAngle))<1e-12);
  const length=g=>Math.sqrt(g.outerRadius**2-(g.pitchRadius*Math.cos(alpha))**2);
  assert.ok((length(p)+length(q)-(p.pitchRadius+q.pitchRadius)*Math.sin(alpha))/basePitch>1.3);
 }
 const u=m.root.userData;m.update(u.transmission.nominalCarrierPeriod);assert.ok(Math.abs(u.kinematics.slowOutputAngle-2*Math.PI/25000)<1e-14);assert.match(u.reconstructionNote,/0\.0144°.*25,000:1/);disposeObject3D(m.root);
});
