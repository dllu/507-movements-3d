import * as THREE from 'three';
import {createAuthoredClampMovement} from '../authored-clamps.js';
import {disposeObject3D} from '../dispose-model.js';
export function singleClampProfile(){
 const original=createAuthoredClampMovement({id:180}),g=original.root.userData.geometry;
 try{
  const raster=g.sourceJawOutline.map(p=>p.toArray());
  // Upper outer edge, measured from black-pixel bands in the engraving. The
  // old trace bowed inward by up to eleven pixels near the narrow tip.
  [[225,51],[239,56.5],[250,62],[272,75.5],[294,91.5],[316,111],[337,134],[357,158]]
   .forEach((point,i)=>{raster[i]=point;});
  const curve=new THREE.CatmullRomCurve3(raster.map(([x,y])=>new THREE.Vector3((x-354)*.012,(300-y)*.012,0)),true,'centripetal');
  return {points:curve.getSpacedPoints(192).slice(0,-1).map(p=>new THREE.Vector2(p.x,p.y)),pivot:g.jawPivot.toArray(),fixedSide:g.sourceFixedSideOutline.map(p=>p.toArray()),board:g.sourceWorkpieceOutline.map(p=>p.toArray())};
 }finally{disposeObject3D(original.root);}
}
export const singleClampSource=(x,y)=>[(x-280)*.012,(452-y)*.012];
