import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Vector3,Box3} from 'three';
import {createAuthoredCrankMovement} from '../src/simulation/authored-cranks.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const v=createAuthoredCrankMovement({id:160}),u=v.root.userData,g=u.geometry;
try{
 const samples=257,rows=[];let minFootClearance=Infinity,maxLengthError=0,minWrap=Infinity,maxWrap=-Infinity,minSeamClearance=Infinity,overlappingPoses=0,exactRepeatedArcPoses=0,minLeafLength=Infinity,maxLeafLength=-Infinity;
 for(let i=0;i<samples;i++){
  const time=g.cyclePeriod*i/(samples-1);v.update(time);v.root.updateMatrixWorld(true);const s=u.kinematics;
  // Entry and the point one circumference farther along are different material
  // points. If the arc ends just before one turn, compare its two ends instead.
  const arc=s.bandCurve.curves[1],sweep=Math.abs(s.pulleyWrapSweep),a=arc.getPoint(0),b=arc.getPoint(Math.min(1,2*Math.PI/sweep));
  const clearance=a.distanceTo(b)-2*g.bandRadius;
  minSeamClearance=Math.min(minSeamClearance,clearance);if(clearance<0)overlappingPoses++;if(sweep>=2*Math.PI)exactRepeatedArcPoses++;
  minWrap=Math.min(minWrap,sweep);maxWrap=Math.max(maxWrap,sweep);maxLengthError=Math.max(maxLengthError,Math.abs(s.bandLengthError));
  const footBounds=new Box3().setFromObject(u.blocks.treadleFootPlate,true);minFootClearance=Math.min(minFootClearance,footBounds.min.y-g.baseY);
  const p=u.blocks.leafSpring.geometry.attributes.position;let length=0,previous;
  // Each cross-section has four corners. Their centroid is the visible
  // spring's neutral centerline, independent of its thickness/depth offsets.
  for(let j=0;j<p.count;j+=4){const center=new Vector3();for(let k=0;k<4;k++)center.add(new Vector3().fromBufferAttribute(p,j+k));center.multiplyScalar(.25);if(previous)length+=center.distanceTo(previous);previous=center;}
  minLeafLength=Math.min(minLeafLength,length);maxLeafLength=Math.max(maxLeafLength,length);
  if(i%32===0)rows.push({time,wrapRadians:sweep,nonlocalBandClearance:clearance,springCenterlineLength:length,springDeflection:s.springDeflection,treadleOffset:s.treadleOffset});
 }
 const sources=['scripts/review-spring-return-treadle.mjs','src/simulation/authored-cranks.js','public/engravings/mm_160.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const report={movement:160,status:'open',source:'https://507movements.com/mm_160.html',sourceAnimationAvailable:false,samples,method:'Review of current authored model. Analytic nonlocal full-wrap centerline witness plus actual rendered foot bounds and 72-section spring centerline lengths. This is not a full solid collision audit.',bandRadius:g.bandRadius,minWrapRadians:minWrap,maxWrapRadians:maxWrap,minimumNonlocalBandClearance:minSeamClearance,minimumNonlocalBandClearancePixels:minSeamClearance/g.sourceUnitsPerPixel,overlappingPoses,exactRepeatedArcPoses,maximumBandLengthError:maxLengthError,minimumFootFloorClearance:minFootClearance,springCenterlineLengthRange:[minLeafLength,maxLeafLength],springLengthChangePercent:100*(maxLeafLength/minLeafLength-1),springForceDrivesMotion:false,cyclePeriod:g.cyclePeriod,rows,sources};
 assert.ok(overlappingPoses>0,'Expected to reproduce the uncorrected full-wrap overlap');assert.ok(maxLengthError<1e-10,'Band length closure does not prove physical clearance');
 fs.writeFileSync('docs/validation/160-authored-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined,sources:undefined},null,2));
}finally{disposeObject3D(v.root);}
