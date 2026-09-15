import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createAuthoredGearLinkageMovement} from '../src/simulation/authored-gear-linkages.js';
import {makeGearedCrank} from '../src/simulation/geared-crank.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const full=process.env.FULL_ASSEMBLY==='1',model=full?makeGearedCrank():createAuthoredGearLinkageMovement({id:148});
try{
 const {blocks:b,parts}=model.root.userData,g=model.root.userData.geometry??{cyclePeriod:8},gears=full?[parts['involute-pinion'],parts['large-involute-rim']]:[b.pinion,b.largeGear];
 const outline=gear=>{
  if(full){const points=gear.geometry.parameters.shapes.getPoints().map(p=>new Vector3(p.x,p.y,-.2).applyMatrix4(gear.matrixWorld)).map(p=>[p.x,p.y].map(v=>Math.round(v*1e9)/1e9));return [[points]];}
  const mesh=gear.userData.rotor.children[0],angle=gear.userData.rotor.rotation.z;
  const points=mesh.geometry.parameters.shapes.getPoints().map(p=>[gear.position.x+p.x*Math.cos(angle)-p.y*Math.sin(angle),gear.position.y+p.x*Math.sin(angle)+p.y*Math.cos(angle)]);
  return [[points.map(p=>p.map(v=>Math.round(v*1e9)/1e9))]];
 };
 let maximumOverlapArea=0;
 for(let i=0;i<=256;i++){
  model.update(g.cyclePeriod*i/256);
  const intersection=clip.intersection(...gears.map(outline));
  let area=0;
  for(const polygon of intersection)for(const ring of polygon){let a=0;for(let j=0;j<ring.length-1;j++)a+=ring[j][0]*ring[j+1][1]-ring[j+1][0]*ring[j][1];area+=Math.abs(a)/2;}
  maximumOverlapArea=Math.max(maximumOverlapArea,area);
 }
 const report={movement:148,method:'Intersection of actual central tooth outlines through one full large-gear revolution (four pinion turns). Inset chamfers cannot extend beyond these outlines. Gear teeth only; hub, bearing and linkage clearance are not covered.',summary:{poses:257,maximumOverlapArea,period:g.cyclePeriod},
  sources:['scripts/review-geared-crank-teeth.mjs',...(full?['src/simulation/geared-crank.js','src/simulation/geared-crank-source.js','src/simulation/geared-crank-frame.js']:['src/simulation/authored-gear-linkages.js']),'src/simulation/primitives.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync(full?'docs/validation/148-complete-teeth.json':'docs/validation/148-teeth.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
 assert.ok(maximumOverlapArea<1e-8);
}finally{disposeObject3D(model.root);}
