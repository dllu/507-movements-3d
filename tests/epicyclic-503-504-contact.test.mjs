import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredEpicyclicTrainMovement} from '../src/simulation/authored-epicyclic-trains.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,create=id=>createAuthoredEpicyclicTrainMovement(catalog[id-1]);
const clear=(a,b)=>{const surface=solidSurface(b.geometry),matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const p of surfacePoints(a.geometry)){const q=p.clone().applyMatrix4(matrix);assert.ok(!surface.inside(q)||surface.distance(q)<1e-6,`${a.userData.role} into ${b.userData.role}`);}};
test('503 loose hubs and gear faces clear the rigid carrier sleeve and outer head',()=>{
 const m=create(503),b=m.root.userData.blocks;
 for(let i=0;i<=16;i++){m.update(m.root.userData.transmission.nominalCarrierPeriod*i/16);m.root.updateMatrixWorld(true);for(const gear of[b.lowerC,b.upperD,b.planetB]){const hub=gear.userData.rotor.children.find(o=>o.userData.boreRadius&&!o.userData.bevelGearBody);clear(hub,b.carrierSleeve);clear(b.carrierSleeve,hub);clear(hub,b.outerCarrierHead);}}
 assert.ok(b.planetAxle.position.x+b.planetAxle.geometry.parameters.height/2>b.outerCarrierHead.position.x);disposeObject3D(m.root);
});
test('503 common-apex back-cone involutes have working contact ratio above one',()=>{
 const m=create(503),b=m.root.userData.blocks,g=m.root.userData.geometry;
 for(const[gear,offset,angle]of[[b.lowerC,g.pitchApexOffset,g.pitchConeHalfAngle],[b.upperD,g.pitchApexOffset,g.pitchConeHalfAngle],[b.planetB,g.planetApexOffset,g.planetPitchConeHalfAngle]]){const apex=new THREE.Vector3(0,0,offset).applyQuaternion(gear.quaternion).add(gear.position);assert.ok(apex.length()<1e-12);assert.ok(Math.abs(gear.userData.pitchConeAngle-angle)<1e-14);}
 // Tredgold virtual spur pair on the common back cone: unequal virtual radii.
 const alpha=Math.PI/9,module=2*g.bevelPitchRadius/g.sideTeeth,side=b.lowerC.userData.toothMeshes[0].geometry.userData,planet=b.planetB.userData.toothMeshes[0].geometry.userData;
 assert.ok(Math.abs(2*g.planetPitchRadius/g.planetTeeth-module)<1e-15);
 const r1=g.bevelPitchRadius/Math.cos(g.pitchConeHalfAngle),r2=g.planetPitchRadius/Math.cos(g.planetPitchConeHalfAngle),approach=Math.sqrt((r1+.45*side.height)**2-(r1*Math.cos(alpha))**2)+Math.sqrt((r2+.45*planet.height)**2-(r2*Math.cos(alpha))**2)-(r1+r2)*Math.sin(alpha);
 assert.ok(Math.abs(side.height-planet.height)<1e-12);assert.ok(approach/(Math.PI*module*Math.cos(alpha))>1.5);disposeObject3D(m.root);
});
test('504 uses one continuous visible B with equal base pitch at all three working pressure angles',()=>{
 const m=create(504),u=m.root.userData,b=u.blocks,p=u.workingProfiles;
 assert.equal(b.intermediateRows.filter(row=>row.visible).length,1);assert.ok(b.inputRowB.visible);
 const body=b.inputRowB.userData.rotor.children[0],geometry=body.geometry.userData;assert.equal(geometry.depth,.83);assert.equal(geometry.teeth,20);
 for(const[label,gear]of Object.entries(b.outputs)){const branch=p.branches[label],q=gear.userData.rotor.children[0].geometry.userData;assert.ok(Math.abs(q.basePitch-geometry.basePitch)<1e-12);assert.ok(branch.contactRatio>1.15);const tangentDistance=u.geometry.carrierPinSpacing*Math.sin(branch.workingPressureAngle);assert.ok(Math.sqrt(p.tipRadius**2-p.base20**2)<tangentDistance);assert.ok(Math.sqrt(p.tipRadius**2-q.baseRadius**2)<tangentDistance);assert.ok(Math.abs(gear.position.y)+u.geometry.gearDepth/2<=geometry.depth/2+1e-12);}
 assert.ok(b.outputs.E.position.y>b.outputs.F.position.y&&b.outputs.F.position.y>b.outputs.G.position.y);assert.equal(b.fixedA.position.y,b.outputs.F.position.y);
 for(const gear of Object.values(b.outputs)){const body=gear.userData.rotor.children[0];assert.equal(body.material.length,2);assert.ok(body.geometry.groups.some(group=>group.materialIndex===1&&group.count>0));}
 m.root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)assert.equal(material.fog,false);});
 for(const g of[b.fixedA,b.inputRowB,...Object.values(b.outputs)])assert.equal(g.userData.toothProfile,'common-base-pitch-profile-shifted-involute');
 disposeObject3D(m.root);
});
test('504 carrier hub clears its fixed pedestal and its output journal remains physically seated',()=>{
 const m=create(504),b=m.root.userData.blocks;
 for(let i=0;i<=8;i++){m.update(m.root.userData.transmission.nominalCarrierPeriod*i/8);m.root.updateMatrixWorld(true);clear(b.carrierPivots[0],b.supportPedestal);clear(b.supportPedestal,b.carrierPivots[0]);}
 const low=b.outputPin.position.y-b.outputPin.geometry.parameters.height/2,high=b.outputPin.position.y+b.outputPin.geometry.parameters.height/2;assert.ok(low<b.carrierBar.position.y+.085);assert.ok(high>b.outputs.E.position.y+.13);
 const fixedHigh=b.stationaryStud.position.y+b.stationaryStud.geometry.parameters.height/2;assert.ok(fixedHigh>=.128);
 disposeObject3D(m.root);
});
test('saved 503/504 contact audit matches production and qualifies proximity as well as nonpenetration',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/503-504-contact-solids.json'));for(const s of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 for(const row of report.results){assert.equal(row.poses,33);assert.equal(row.penetrations,0);assert.ok(row.queries>300000);for(const p of row.pairs)assert.ok(p.maximumSampledGap<(row.id===503?.0031:.00065));}
});
