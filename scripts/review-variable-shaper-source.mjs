import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredVariableCrankMovement} from '../src/simulation/authored-variable-cranks.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const m=createAuthoredVariableCrankMovement({id:178}),u=m.root.userData,g=u.geometry,b=u.blocks;
try{
 m.update(0);m.root.updateMatrixWorld(true);
 const project=p=>u.modelPointToSourceRaster(new THREE.Vector2(p.x,p.y));
 const shaft=project(b.inputCrank.getWorldPosition(new THREE.Vector3()));
 const slider=project(b.sliderAssembly.getWorldPosition(new THREE.Vector3()));
 const output=project(b.outputSlide.getWorldPosition(new THREE.Vector3()));
 const cropX=g.sourceRasterConnectingRodCropPoint.x;
 const rodAtCrop=new THREE.Vector2(cropX,slider.y+(output.y-slider.y)*(cropX-slider.x)/(output.x-slider.x));
 const tip=project(b.inputCrank.localToWorld(new THREE.Vector3(g.crankReach+g.crankBodyHalfWidth,0,0)));
 const samples=[['shaft center',shaft,g.sourceRasterShaftCenter],['slider center',slider,g.sourceRasterSliderCenter],['rod at engraved crop',rodAtCrop,g.sourceRasterConnectingRodCropPoint],['crank upper tip',tip,new THREE.Vector2(295,7)]]
  .map(([name,actual,expected])=>({name,actual:actual.toArray(),expected:expected.toArray(),errorPixels:actual.distanceTo(expected)}));
 const sources=['scripts/review-variable-shaper-source.mjs','src/simulation/authored-variable-cranks.js','public/engravings/mm_178.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const report={movement:178,status:'source-registration-open',source:'https://507movements.com/mm_178.html',method:'Initial-pose landmarks under the existing disk-center/radius raster registration. These are diagnostic measurements, not a full contour fit.',samples,maximumErrorPixels:Math.max(...samples.map(s=>s.errorPixels)),sources};
 fs.writeFileSync('docs/validation/178-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(m.root);}
