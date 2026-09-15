import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Box3} from 'three';
import {createAuthoredCamArrayMovement} from '../src/simulation/authored-cam-arrays.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const model=createAuthoredCamArrayMovement({id:149});
try{
 model.update(0);model.root.updateMatrixWorld(true);
 const {geometry:g,blocks:b}=model.root.userData,sourceEnds=[414,430];
 const rods=b.leverRecords.map((r,i)=>{
  const bounds=new Box3().setFromObject(r.slider.rod,true),bottomPixel=g.sourcePivot.y-bounds.min.y/g.sourceScale;
  return {name:r.config.name,sourceBottomPixel:sourceEnds[i],modelBottomPixel:bottomPixel,shortfallPixels:sourceEnds[i]-bottomPixel};
 });
 const report={movement:149,method:'Compare the actual rod mesh lower endpoints in the initial pose with approximate lower endpoints in the 525px source engraving. Uses the implementation source scale and pivot alignment.',rods,
  sources:['scripts/measure-twin-cam-rods.mjs','src/simulation/authored-cam-arrays.js','public/engravings/mm_149.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/149-rod-landmarks.json',JSON.stringify(report,null,2)+'\n');console.log(rods);
}finally{disposeObject3D(model.root);}
