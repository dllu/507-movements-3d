import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredMarineValveGearMovement} from '../src/simulation/authored-marine-valve-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

const model = createAuthoredMarineValveGearMovement({id:171});
const {blocks:b, geometry:g} = model.root.userData;
const project = point => [g.sourceRasterShaftCenter.x + point.x/g.sourceUnitsPerPixel,
  g.sourceRasterShaftCenter.y + (g.shaftCenter.y-point.y)/g.sourceUnitsPerPixel];
const points=[];
const add = (name,world,source) => {
  const projected=project(world);
  points.push({name,source,projected,error:Math.hypot(projected[0]-source[0],projected[1]-source[1])});
};
try {
  model.update(0);model.root.updateMatrixWorld(true);
  const tailBounds=new THREE.Box3().setFromObject(b.outputRadiusRod);
  add('central tail tip',new THREE.Vector3(0,tailBounds.max.y,0),[134,117]);
  const upperGuideBounds=new THREE.Box3().setFromObject(b.dieGuide);
  add('upper guide center',upperGuideBounds.getCenter(new THREE.Vector3()),[134,146]);
  add('reversing lug',b.reachLug.getWorldPosition(new THREE.Vector3()),[60,298]);
  const reachBounds=new THREE.Box3().setFromObject(b.reversingReachRod);
  add('reversing rod end',new THREE.Vector3(reachBounds.min.x,reachBounds.getCenter(new THREE.Vector3()).y,0),[6,298]);
  add('slide eye',b.slideEye.getWorldPosition(new THREE.Vector3()),[134,361]);
  add('slot follower',b.followerPin.getWorldPosition(new THREE.Vector3()),[134,382]);
  for(const [i,x] of [[0,47],[1,222]]) {
    const bounds=new THREE.Box3().setFromObject(b.slideGuidePosts[i]);
    const center=bounds.getCenter(new THREE.Vector3());
    add(`guide ${i} top`,new THREE.Vector3(center.x,bounds.max.y,center.z),[x,349]);
    add(`guide ${i} bottom`,new THREE.Vector3(center.x,bounds.min.y,center.z),[x,507]);
  }
  for(const [i,source] of [[0,[35,406,64,457]],[1,[207,404,234,455]]]) {
    const bounds=new THREE.Box3().setFromObject(b.slideBlocks[i]);
    add(`block ${i} top left`,new THREE.Vector3(bounds.min.x,bounds.max.y,0),source.slice(0,2));
    add(`block ${i} bottom right`,new THREE.Vector3(bounds.max.x,bounds.min.y,0),source.slice(2));
  }
  const outer=new THREE.Box3().setFromObject(b.lowerOuterRail);
  add('outer arc apex',new THREE.Vector3(0,outer.max.y,0),[134,374]);
  const vertices=b.lowerInnerRail.geometry.attributes.position;
  let innerEdge=Infinity;
  for(let i=0;i<vertices.count;i++) {
    const point=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(b.lowerInnerRail.matrixWorld);
    if(Math.abs(point.x)<1e-6)innerEdge=Math.min(innerEdge,point.y);
  }
  assert.ok(Number.isFinite(innerEdge));
  add('inner arc apex',new THREE.Vector3(0,innerEdge,0),[134,390]);
  const maximumError=Math.max(...points.map(p=>p.error));
  const report={movement:171,points,maximumError,scope:'Initial orthographic lower-slide and central/reversing-rod landmarks measured from the 263x525 engraving. Approximate raster line centers and rectangular bounds; not whole-contour, perspective-camera or mechanical qualification.',sources:['scripts/review-marine-valve-source-fit.mjs','src/simulation/authored-marine-valve-gears.js','public/engravings/mm_171.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
  fs.writeFileSync('docs/validation/171-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  assert.ok(maximumError<4,'selected source contours must fit within four source pixels');
} finally {disposeObject3D(model.root);}
