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
 // Independent rendered boundaries, beyond the fitted joint-center constraints.
 const extent=mesh=>{
  const result=[Infinity,Infinity,-Infinity,-Infinity],pos=mesh.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
   const v=project(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(pos,i)));
   result[0]=Math.min(result[0],v.x);result[1]=Math.min(result[1],v.y);
   result[2]=Math.max(result[2],v.x);result[3]=Math.max(result[3],v.y);
  }
  return result;
 };
 const boundaries=[['crank',b.crankBody,[270,7,320,346]],
  ['outer disk outline',b.outerDiskOutline,[93,40,500,449]],
  ['inner boss outer outline',b.innerBossOuterOutline,[183,134,407,357]],
  ['inner boss inner outline',b.innerBossInnerOutline,[193,143,397,348]]]
  .map(([name,mesh,expected])=>{const actual=extent(mesh);return{name,actual,expected,maximumErrorPixels:Math.max(...actual.map((v,i)=>Math.abs(v-expected[i])))};});
 const sources=['scripts/review-variable-shaper-source.mjs','src/simulation/authored-variable-cranks.js','public/engravings/mm_178.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const report={movement:178,status:'selected-source-features-checked',source:'https://507movements.com/mm_178.html',method:'Initial-pose landmarks under the existing disk-center/radius raster registration. These are diagnostic measurements, not a full contour fit.',samples,boundaries,maximumBoundaryErrorPixels:Math.max(...boundaries.map(b=>b.maximumErrorPixels)),maximumErrorPixels:Math.max(...samples.map(s=>s.errorPixels)),sources};
 fs.writeFileSync('docs/validation/178-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(m.root);}
