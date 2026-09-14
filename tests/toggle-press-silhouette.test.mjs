import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[131];
test('132 bell and neck match source end dimensions and join the upper disk',()=>{
 const v=createMovementModel(movement),u=v.root.userData,b=u.blocks,d=u.geometry;
 try{
  v.update(0);v.root.updateMatrixWorld(true);
  const bell=new THREE.Box3().setFromObject(b.upperBell,true),neck=new THREE.Box3().setFromObject(b.upperNeck,true),disk=new THREE.Box3().setFromObject(b.upperDisk,true);
  const rasterY=y=>235-(y-d.upperLinkY)/.016;
  assert(Math.abs(rasterY(bell.min.y)-208)<1.51);assert(Math.abs(rasterY(bell.max.y)-157)<.01);
  assert(Math.abs(rasterY(neck.min.y)-157)<.01);assert(Math.abs(rasterY(neck.max.y)-115)<.01);
  assert(Math.abs(b.upperNeck.geometry.parameters.radiusTop/.016-41)<.01);
  assert(bell.min.y<=disk.max.y);assert(neck.min.y<=bell.max.y+1e-7);
  assert.equal(b.upperBell.geometry.type,'LatheGeometry');
  const points=b.upperBell.geometry.parameters.points,curve=points.slice(1,-1),first=curve[0],last=curve.at(-1),middle=curve[Math.floor(curve.length/2)];
  const straight=first.x+(last.x-first.x)*(middle.y-first.y)/(last.y-first.y);
  assert(straight-middle.x>.07,'the flare should be curved inward, not a straight cone');
  for(const part of [b.workpiece,b.platenFrontBand,b.upperBellRim,...b.upperDiskRims,...b.lowerDiskRims])assert(!part.visible);
 }finally{disposeObject3D(v.root);}
});
