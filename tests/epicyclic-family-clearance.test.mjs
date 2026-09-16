import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createAuthoredEpicyclicTrainMovement} from '../src/simulation/authored-epicyclic-trains.js';
import {solidSurface} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
for(const id of [502,503,504,505])test(`${id} working gear and hub bores leave the actual journal cylinders clear`,()=>{
 const m=createAuthoredEpicyclicTrainMovement(catalog[id-1]),b=m.root.userData.blocks;
 const parts=id===502?[[b.fixedSunA,.13],[b.outputD,.13],[b.compoundF,.16],[b.compoundE,.16],[b.outputB,.09]]:id===503?[[b.lowerC,.115],[b.upperD,.115],[b.planetB,.105]]:id===504?[[b.fixedA,.12],...b.intermediateRows.map(g=>[g,.15]),...Object.values(b.outputs).map(g=>[g,.13])]:[[b.sunA,.16],[b.planetB,.09]];
 for(const [gear,radius]of parts){const rotor=gear.userData.rotor;
  for(const mesh of rotor.children.filter(c=>c.userData.boreRadius)){
   mesh.updateMatrix();const inverse=mesh.matrix.clone().invert(),surface=solidSurface(mesh.geometry);
   const journalRadius=mesh===b.sunOutputShaft?.13:radius;
   for(let i=0;i<64;i++)for(const z of [-.5,-.3,-.15,0,.15,.3,.5]){
    const a=2*Math.PI*i/64,q=new THREE.Vector3(journalRadius*Math.cos(a),journalRadius*Math.sin(a),z).applyMatrix4(inverse);
    assert.equal(surface.inside(q),false,`${id} ${gear.userData.role} journal at ${a}/${z}`);
   }
  }
  // Face indicators may not bridge the bore opening.
  for(const mesh of rotor.children.filter(c=>c.geometry?.type==='BoxGeometry')){
   mesh.updateMatrix();const q=new THREE.Vector3(0,0,mesh.position.z).applyMatrix4(mesh.matrix.clone().invert());
   assert.equal(solidSurface(mesh.geometry).inside(q),false,'index leaves axis open');
  }
 }
 assert.equal(m.root.userData.hideGround,true);assert.ok(b.contactMarkers.every(x=>!x.visible));
 m.root.traverse(o=>{for(const mat of(Array.isArray(o.material)?o.material:[o.material]))if(mat)assert.equal(mat.fog,false);});
 if(id===504)assert.ok(b.carrierBar.position.y<Math.min(...Object.values(m.root.userData.geometry.layerY)));
 disposeObject3D(m.root);
});

test('505 generated working flanks have equal base pitch and contact ratios above one',()=>{
 const m=createAuthoredEpicyclicTrainMovement(catalog[504]),b=m.root.userData.blocks,p=m.root.userData.generatedGearParameters;
 const sun=b.sunA.userData,planet=b.planetB.userData,ring=b.fixedRingC.userData,alpha=p.pressureAngle;
 const basePitch=Math.PI*p.module*Math.cos(alpha);
 const reach=g=>Math.sqrt(g.outerRadius**2-(g.pitchRadius*Math.cos(alpha))**2);
 const external=(reach(sun)+reach(planet)-(sun.pitchRadius+planet.pitchRadius)*Math.sin(alpha))/basePitch;
 const internal=(reach(planet)-Math.sqrt(ring.tipRadius**2-ring.baseRadius**2)+(ring.pitchRadius-planet.pitchRadius)*Math.sin(alpha))/basePitch;
 assert.ok(external>1.05&&internal>1.05,`contact ratios ${external}, ${internal}`);
 for(const gear of[sun,planet,ring])assert.ok(Math.abs(2*Math.PI*gear.pitchRadius*Math.cos(gear.pressureAngle)/gear.teeth-basePitch)<1e-12);
 assert.equal(sun.toothProfile,'offline-rounded-rack-generated-involute');assert.equal(planet.toothProfile,sun.toothProfile);
 disposeObject3D(m.root);
});
