import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements;
function clear(moving,points,target,surface,tolerance=1e-6){
 const transform=target.matrixWorld.clone().invert().multiply(moving.matrixWorld);
 for(const point of points){const p=point.clone().applyMatrix4(transform);if(surface.box.distanceToPoint(p)>.01)continue;
  const gap=surface.signedDistance(p,.01);assert.ok(gap>=-tolerance,`${moving.userData.role} into ${target.userData.role}: ${gap} at ${p.toArray()}`);
 }
}
function checks(pairs){return pairs.map(([moving,targets])=>[moving,surfacePoints(moving.geometry),targets.map(o=>[o,solidSurface(o.geometry)])]);}
function sweep(model,checks,period,poses=65,tolerance=1e-6){for(let i=0;i<poses;i++){
 model.update(period*i/(poses-1));model.root.updateMatrixWorld(true);
 for(const [moving,points,targets]of checks)for(const [target,surface]of targets)clear(moving,points,target,surface,tolerance);
}}
test('493 rendered wedge and packing faces fit the bore without bevel or pad intrusion through the official lift cycle',()=>{
 const model=createMovementModel(catalog[492]),b=model.root.userData.blocks;
 sweep(model,checks([
  [b.centerTaper,[b.leftPacking.body,b.rightPacking.body,b.stoneBody,b.boreBottom,...b.boreWalls]],
  [b.leftPacking.body,[b.centerTaper,b.stoneBody,b.boreBottom,...b.boreWalls]],
  [b.rightPacking.body,[b.centerTaper,b.stoneBody,b.boreBottom,...b.boreWalls]],
  [b.leftPacking.wallPad,[b.stoneBody,...b.boreWalls]],
  [b.rightPacking.wallPad,[b.stoneBody,...b.boreWalls]],
  [b.shacklePin,[b.centerHead,...b.shackleArms.map(o=>o.children.find(c=>c.geometry))]],
 ]),4,65,2e-6);
 assert.equal(model.root.userData.hideGround,true);
});
test('494 actual pointed jaws clear the stone until contact and all crossed-joint pins pass through bored members',()=>{
 const model=createMovementModel(catalog[493]),b=model.root.userData.blocks;
 const mesh=o=>o.children.find(c=>c.geometry);
 sweep(model,checks([
  // Each tong is one plate: arm, fulcrum eye, curved jaw and pointed nib.
  [b.leftJawParts.tongBody,[b.stoneBody,b.rightJawParts.tongBody,mesh(b.leftUpperLink),mesh(b.rightUpperLink)]],
  [b.rightJawParts.tongBody,[b.stoneBody,mesh(b.leftUpperLink),mesh(b.rightUpperLink)]],
  [mesh(b.leftUpperLink),[mesh(b.rightUpperLink),b.shackleStem]], [mesh(b.rightUpperLink),[b.shackleStem]],
  [b.jawPivotPin,[b.leftJawParts.tongBody,b.rightJawParts.tongBody]],
  [b.sidePivotPins[0],[b.leftJawParts.tongBody,mesh(b.leftUpperLink)]],
  [b.sidePivotPins[1],[b.rightJawParts.tongBody,mesh(b.rightUpperLink)]],
  [b.shacklePivotPin,[mesh(b.leftUpperLink),mesh(b.rightUpperLink),b.shackleStem]],
 ]),4);
 assert.equal(model.root.userData.hideGround,true);
});
