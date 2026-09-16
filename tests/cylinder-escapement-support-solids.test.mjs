import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredCylinderEscapementMovement as create} from '../src/simulation/authored-cylinder-escapements.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const m=create({id:294}),d=m.root.userData,b=d.blocks,cache=new Map();
function data(o){if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),solid:solidSurface(o.geometry)});return cache.get(o);}
function clearance(a,c){let min=Infinity;for(const[x,y]of[[a,c],[c,a]]){const tr=y.matrixWorld.clone().invert().multiply(x.matrixWorld),field=data(y).solid;for(const p of data(x).points){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.003)continue;min=Math.min(min,field.signedDistance(q,.10));}}return min;}
function insideWorld(o,p){return data(o).solid.inside(p.clone().applyMatrix4(o.matrixWorld.clone().invert()));}

test('294 finite teeth clear the actual split pivots and full tube ends over a cycle',()=>{
 for(let i=0;i<=128;i++){m.update(4*i/128);m.root.updateMatrixWorld(true);for(const head of b.palletHeads)for(const part of[b.balanceStaff,b.leftTube,b.rightTube])assert.ok(clearance(head,part)>-2e-6,`${i}: ${head.userData.index}/${part.userData.role}`);}
 const g=d.geometry,field=data(b.balanceStaff).solid;for(let i=0;i<=32;i++)assert.equal(field.inside(new T.Vector3(0,0,g.workingBandStartZ+(g.workingBandEndZ-g.workingBandStartZ)*i/32)),false,'hollow escape passage');
});
test('294 shafts pass through actual collar, collet, hub and fixed-bearing bores',()=>{
 const pairs=[[b.lowerCone,b.cylinderBearing],[b.lowerCone,b.rearStandard],[b.lowerCollar,b.cylinderBearing],[b.wheelShaft,b.wheelHub],[b.wheelShaft,b.wheelBearing],[b.wheelShaft,b.rearStandard],[b.balanceStaff,b.cylinderBearing],[b.balanceStaff,b.rearStandard],...[b.lowerCollar,b.upperCollar,b.lowerCone,b.upperCone,b.balanceHub].map(o=>[b.balanceStaff,o])];
 for(let i=0;i<=32;i++){m.update(i/8);m.root.updateMatrixWorld(true);for(const[a,c]of pairs)assert.ok(clearance(a,c)>-2e-6,`${a.userData.role}/${c.userData.role}`);}
});
test('294 raised pallet stems connect to wheel feet and the standard reaches its base',()=>{
 m.update(0);m.root.updateMatrixWorld(true);
 for(let i=0;i<15;i++){const assembly=b.palletAssemblies[i],foot=b.palletFeet[i];const center=d.cylinderContactBake.headCentroid,r=Math.hypot(...center);for(const[p,a,c]of[[new T.Vector3(center[0]*2.52/r,center[1]*2.52/r,d.geometry.wheelPlaneZ),foot,b.wheelRim],[new T.Vector3(...center,d.geometry.wheelPlaneZ+.05),foot,b.palletStems[i]]]){const world=assembly.localToWorld(p.clone());assert.ok(insideWorld(a,world)&&insideWorld(c,world),'welded overlap has finite volume');}}
 const baseTop=b.base.position.y+.12,p=new T.Vector3(0,baseTop-.04,b.rearStandard.position.z);assert.ok(insideWorld(b.base,p)&&insideWorld(b.rearStandard,p),'standard is seated in the base');
});
test('294/295 distinguish finite geometry qualification from passive dynamics',()=>{for(const id of[294,295]){const model=create({id}),info=model.root.userData;assert.match(info.finiteContactReview.qualification,/sampled geometry/);assert.equal(info.finiteContactReview.noPassiveForceValidation,true);assert.equal(info.minimumDisplayCycleSeconds,6);assert.equal(info.hideGround,true);model.update(1);assert.equal(info.blocks.contactMarker.visible,false);if(id===295)assert.equal(info.blocks.sectionStaff.parent,null);}});
test('294/295 retain their scene and geometry during cheap playback',()=>{
 for(const id of[294,295]){const model=create({id}),before=[];model.root.traverse(o=>before.push([o,o.geometry]));for(let i=0;i<65;i++)model.update(i/16);const after=[];model.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);}
});
