import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/movements.json',import.meta.url)));
const v=createMovementModel(catalog.movements[128]),u=v.root.userData,d=u.geometry;
const length=(curve,steps)=>{
 let p=curve.getPoint(0),total=0;
 for(let i=1;i<=steps;i++){const q=curve.getPoint(i/steps);total+=p.distanceTo(q);p=q;}
 return total;
};
try{
 const results=[10000,20000].map(steps=>{
  let sourceLength,min=Infinity,max=-Infinity;
  for(let i=0;i<=60;i++){
   const angle=-d.shaftAngleAmplitude+2*d.shaftAngleAmplitude*i/60,s=u.ropeGeometryAtShaftAngle(angle);
   const total=length(s.largeHelix,steps)+length(s.smallHelix,steps)+s.leftLegLength+s.rightLegLength+Math.PI*d.lowerPulleyPitchRadius;
   if(i===30)sourceLength=total;min=Math.min(min,total);max=Math.max(max,total);
  }
  return {steps,sourceLength,min,max,variationPixels:(max-min)/d.sourceScale,
   maximumLiftCorrectionPixels:Math.max(max-sourceLength,sourceLength-min)/2/d.sourceScale};
 });
 const report={results,qualification:'Polyline arc-length audit of both visible windings over 61 shaft poses. The ideal differential lift law omits this small helix-length correction; this is not a dynamic rope simulation.'};
 if(process.env.PROBE_REPORT)fs.writeFileSync(process.env.PROBE_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 assert(Math.abs(results[0].maximumLiftCorrectionPixels-results[1].maximumLiftCorrectionPixels)<.0001);
 assert(results[1].maximumLiftCorrectionPixels<.05);
}finally{disposeObject3D(v.root);}
