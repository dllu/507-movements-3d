import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,create=id=>createAuthoredGearMovement(catalog[id-1]);
const clear=(a,b)=>{const surface=solidSurface(b.geometry),matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const p of surfacePoints(a.geometry)){const q=p.clone().applyMatrix4(matrix);assert.ok(!surface.inside(q)||surface.distance(q)<1e-6,`${a.userData.role} into ${b.userData.role}`);}};
test('191 and196 render the baked mating contours and disable obsolete tooth overlays',()=>{
 {const b=create(196).root.userData.blocks;assert.equal(b.wheelBody.geometry.userData.toothProfile,'offline-swept-mating-gear-envelope');assert.ok(b.wheelBody.geometry.userData.outline.length>1000);assert.ok(b.wheelToothMeshes.every(mesh=>!mesh.visible));}
 // 191: both scrolls are hobbed by one rack, so both render baked contours.
 const b=create(191).root.userData.blocks;
 for(const [body,teeth] of[[b.drivenBody,b.drivenTeeth],[b.driverBody,b.driverTeeth]]){assert.equal(body.geometry.userData.toothProfile,'offline-rack-hobbed-conjugate-scroll');assert.ok(body.geometry.userData.outline.length>1000);assert.ok(teeth.every(mesh=>!mesh.visible));}
});
test('201 involutes have equal base pitch, continuous transverse engagement and valid eccentric bore',()=>{
 const m=create(201),g=m.root.userData.geometry,b=m.root.userData.blocks,a=b.eccentricGear.userData.rotor.children[0].geometry.userData,c=b.pinion.userData.rotor.children[0].geometry.userData;
 assert.ok(Math.abs(a.basePitch-c.basePitch)<1e-12);const alpha=Math.PI/6,ratio=(Math.sqrt(a.tipRadius**2-a.baseRadius**2)+Math.sqrt(c.tipRadius**2-c.baseRadius**2)-g.pitchCenterDistance*Math.sin(alpha))/a.basePitch;
 assert.ok(ratio>1.05);assert.ok(Math.sqrt(a.tipRadius**2-a.baseRadius**2)<g.pitchCenterDistance*Math.sin(alpha));assert.ok(a.rootRadius-g.driverEccentricOffset.length()>.13);
});
test('201 finite follower fits its slot at every sampled input pose',()=>{
 const m=create(201),b=m.root.userData.blocks,period=m.root.userData.transmission.inputCyclePeriod;
 for(let i=0;i<=16;i++){m.update(period*i/16);m.root.updateMatrixWorld(true);for(const rail of b.slotRails)clear(b.slotFollower,rail.children[0]);}
 assert.equal(b.slotFollower.geometry.parameters.radiusTop,.125);assert.ok(.17-.085/2-.125>.002);
});
test('196 carrier eye and fixed bearing clear their actual shafts and each other',()=>{
 const m=create(196),b=m.root.userData.blocks;
 for(let i=0;i<=16;i++){m.update(m.root.userData.transmission.cyclePeriod*i/16);m.root.updateMatrixWorld(true);clear(b.carrierPivotPin,b.boredCarrierLink);clear(b.carrierPivotPin,b.carrierBearing);clear(b.wheelShaft.userData.rotor.children[0],b.boredCarrierLink);clear(b.boredCarrierLink,b.carrierBearing);}
});
test('all three models expose the reconstruction limits and hide ground/fog',()=>{
 for(const id of[191,196,201]){const m=create(id);assert.equal(m.root.userData.hideGround,true);assert.ok(m.root.userData.minimumDisplayCycleSeconds>=10);assert.ok(m.root.userData.reconstructionNote.length>100);m.root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)assert.equal(material.fog,false);});}
 assert.match(create(191).root.userData.reconstructionNote,/disengagement.*sudden speed reset/);
});
test('saved audit checks actual rendered finite planar solids at interleaved full-cycle poses',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/191-196-201-contact.json'));for(const source of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,source.file);
 for(const row of report.results){assert.equal(row.poses,513);assert.equal(row.penetratingPoses,0);assert.ok(row.maximumOverlapArea<1e-10);assert.ok(row.maximumGap<(row.id===191?.0105:.0021));assert.ok(row.minimumGap>0);}
});
