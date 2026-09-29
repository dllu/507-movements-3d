import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredCapstanWheelworkMovement} from '../src/simulation/authored-capstan-wheelwork.js';
import {createAuthoredEntwistleGearingMovement} from '../src/simulation/authored-entwistle-gearing.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface} from './helpers/solid-surface.mjs';
const make=id=>(id===412?createAuthoredCapstanWheelworkMovement:createAuthoredEntwistleGearingMovement)({id});
function shaftFits(mesh,radius,axis='z',center=[0,0]){
 const surface=solidSurface(mesh.geometry),p=new THREE.Vector3(),others=['x','y','z'].filter(a=>a!==axis);
 for(let j=1;j<5;j++)for(let i=0;i<24;i++){
  p[axis]=THREE.MathUtils.lerp(surface.box.min[axis],surface.box.max[axis],j/5);
  p[others[0]]=center[0]+radius*Math.cos(i*Math.PI/12);p[others[1]]=center[1]+radius*Math.sin(i*Math.PI/12);
  assert.equal(surface.inside(p),false,`${mesh.userData.role??mesh.type}: actual journal intersects shaft`);
 }
}
test('412 exposes the base wheel-work and retains a supported bored carrier',()=>{
 const m=make(412),b=m.root.userData.blocks;
 assert.equal(b.drumhead.visible,false);assert.equal(b.barrel.visible,false);assert.equal(b.directClutch.visible,false);assert.equal(b.fixedFrame.visible,false);
 assert.equal(b.carrierArms[0].userData.role,'three-lobed-bored-common-planet-carrier');
 shaftFits(b.carrierArms[0],.23,'y');shaftFits(b.sunGear.userData.rotor.children[0],.23);shaftFits(b.sunGear.userData.rotor.children[1],.23,'y');
 for(const planet of b.planets){shaftFits(planet.userData.rotor.children[0],.11);shaftFits(planet.userData.rotor.children[1],.11,'y');shaftFits(b.carrierArms[0],.11,'y',[planet.position.x,planet.position.z]);}
 assert.equal(b.planetStuds.length,3);assert.ok(m.cameraDirection.y>10);
 disposeObject3D(m.root);
});
test('412 matching involutes have common base pitch and contact ratio above one',()=>{
 const m=make(412),b=m.root.userData.blocks,g=m.root.userData.geometry,alpha=25*Math.PI/180,basePitch=Math.PI*g.module*Math.cos(alpha);
 for(const gear of[b.sunGear,...b.planets,b.annulusGear])assert.ok(Math.abs(gear.userData.pressureAngle-alpha)<1e-12);
 const external=(2*Math.sqrt((.9+.12)**2-(.9*Math.cos(alpha))**2)-1.8*Math.sin(alpha))/basePitch;
 const internal=(Math.sqrt((.9+.12)**2-(.9*Math.cos(alpha))**2)-Math.sqrt((2.7-.12)**2-(2.7*Math.cos(alpha))**2)+1.8*Math.sin(alpha))/basePitch;
 assert.ok(external>1.3&&external<1.5);assert.ok(internal>1.5&&internal<1.8);
 disposeObject3D(m.root);
});
test('495 corrects the output tooth phase and clears every independent shaft journal',()=>{
 const m=make(495),b=m.root.userData.blocks;
 assert.equal(m.root.userData.geometry.outputMountPhase,0);
 const g=m.root.userData.geometry,virtualRadius=g.outerDistance/Math.cos(Math.PI/4),base=virtualRadius*Math.cos(Math.PI/9),module=2*g.outerDistance/g.teeth;
 const ratio=(2*Math.sqrt((virtualRadius+.45*g.toothHeight)**2-base**2)-2*virtualRadius*Math.sin(Math.PI/9))/(Math.PI*module*Math.cos(Math.PI/9));
 assert.ok(ratio>1.3&&ratio<1.4);
 for(const gear of b.gears){const shaft=gear===b.planetGearB?.072:.085;shaftFits(gear.userData.rotor.children[0],shaft);const hub=gear.userData.rotor.children.at(-3);shaftFits(hub,shaft);}
 shaftFits(b.carrierCollar,.085,'y');
 b.carrierCollar.geometry.computeBoundingBox();
 const collarHalfLength=b.carrierCollar.geometry.boundingBox.max.y;
 for(const gear of[b.fixedGearA,b.outputGearC]){const hub=gear.userData.rotor.children.at(-3);hub.geometry.computeBoundingBox();assert.ok(hub.position.z+hub.geometry.boundingBox.min.z>collarHalfLength+.02);}
 const planetHub=b.planetGearB.userData.rotor.children.at(-3);planetHub.geometry.computeBoundingBox();assert.ok(planetHub.position.z+planetHub.geometry.boundingBox.min.z>.30);
 // Brown's cast standards carry shaft D in true bores; the invented posts, brace and indices are gone.
 assert.equal(b.castStandards.length,2);
 for(const standard of b.castStandards){assert.equal(standard.parent,m.root);shaftFits(standard,.085,'x',[g.apex.y,0]);}
 assert.equal(b.standardBearings.length,0);
 assert.deepEqual(b.bearings,[]);assert.deepEqual(b.bearingPosts,[]);assert.equal(b.outputIndex,undefined);assert.equal(b.carrierIndex,undefined);assert.equal(b.fixedGearBrace,undefined);
 shaftFits(b.outputSleeve,.085);shaftFits(b.outputDrum,.085);shaftFits(b.drivingPulley,.085,'y');
 const floorTop=b.base.position.y+b.base.geometry.parameters.height/2;
 for(const standard of b.castStandards){const box=new THREE.Box3().setFromObject(standard);assert.ok(Math.abs(box.min.y-floorTop)<1e-6);assert.ok(box.max.z<=b.base.geometry.parameters.depth/2);}
 assert.ok(Math.abs(b.rightStandard.userData.foot.y-floorTop)<1e-12);
 disposeObject3D(m.root);
});
for(const id of[412,495])test(`${id} disables ground and actual material fog`,()=>{const m=make(id);assert.equal(m.root.userData.hideGround,true);m.root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)assert.equal(material.fog,false);});disposeObject3D(m.root);});
test('finite working surfaces stay close and clear with current source hashes',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/412-495-gear-solids.json'));
 for(const source of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,source.file);
 // Pass 90: 495's bevels are short-faced (teeth on the outer third only), so
 // the closest approach is the flank backlash (tooth thickness factor 0.96),
 // no longer the tiny teeth near the apex.
 for(const row of report.results){assert.ok(row.poses>=33);assert.equal(row.penetrations,0);assert.ok(row.queries>100000);for(const pair of row.pairs)assert.ok(pair.maximumSampledGap<(row.id===495?.006:.004));}
});
