import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAuthoredWaveCamMovement} from '../src/simulation/authored-wave-cams.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {waveCamSeatedRocker} from '../src/simulation/wave-cam-contact.js';
const v=createAuthoredWaveCamMovement({id:165}),old=v.root.userData,g=old.geometry,geometry={axisX:g.camAxisX,innerRadius:g.camSkirtInnerRadius,outerRadius:g.camOuterRadius,rollerZ:g.followerPlaneZ,rollerRadius:g.followerRadius,rollerDepth:g.followerDepth,waves:g.camWaveCount,meanY:g.meanLowerFaceY,amplitude:g.faceAmplitude,pivot:g.rockerPivot.toArray(),armLength:g.rightRockerLength},samples=[];
try{
 let maximumRefinementError=0,maximumPoseChange=0;
 for(let i=0;i<=48;i++){
  const angle=2*Math.PI/g.camWaveCount*i/48,a=waveCamSeatedRocker(angle,geometry),b=waveCamSeatedRocker(angle,geometry,{samples:256}),previous=old.closureAtDriverAngle(angle);
  maximumRefinementError=Math.max(maximumRefinementError,Math.abs(a.center[1]-b.center[1]));maximumPoseChange=Math.max(maximumPoseChange,Math.abs(a.center[1]-previous.followerCenter.y));
  assert.ok(Math.abs(a.residual)<1e-10);samples.push({phase:i/48,legacyCenter:previous.followerCenter.toArray(),seatedCenter:a.center,contact:a.support.point,rockerAngle:a.theta});
 }
 const report={movement:165,status:'unregistered-continuous-envelope-diagnostic',geometry,maximumRefinementError,maximumPoseChange,maximumPoseChangePixels:maximumPoseChange/g.sourceUnitsPerPixel,method:'Minimize over the finite cylindrical roller surface. The axial face minimum is exact for each lateral sample; bracket and refine lateral minima. Compare 128 and 256 brackets at 49 phases. Solve passive seated rocker height geometrically; no inertia or contact force is claimed. This diagnoses the legacy sinusoidal profile, not a source-qualified replacement.',samples,sources:['scripts/probe-wave-cam-envelope.mjs','src/simulation/wave-cam-contact.js','src/simulation/authored-wave-cams.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/165-envelope-diagnostic.json',JSON.stringify(report,null,2)+'\n');console.log({maximumRefinementError,maximumPoseChange,pixels:report.maximumPoseChangePixels,first:samples[0]});assert.ok(maximumRefinementError<1e-7);
}finally{disposeObject3D(v.root);}
