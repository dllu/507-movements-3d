// Read-only finite-pin feasibility witness. No production geometry is changed.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { nearest390Outline } from '../src/simulation/dual-band-pawl-contact.js';
import { solidSurface } from '../tests/helpers/solid-surface.mjs';
const model=create({id:213}),d=model.root.userData,g=d.geometry;
const rho=g.centerDistance-g.facePinOrbitRadius;
const halfGap=g.stopPitchAngle*(1-g.stopToothTopFraction)/2;
const maximumPinRadius=rho*Math.sin(halfGap);
const perpendicularFootRadius=rho*Math.cos(halfGap);
const gapBisector=g.stopSectorCenterAngle+g.stopPitchAngle/2;
const center=[rho*Math.cos(gapBisector),rho*Math.sin(gapBisector)];
const outline=g.stopRingOutline.map(p=>p.toArray());
const nearest=nearest390Outline(center,outline);
const gap=nearest.distance-g.facePinRadius;
const pinSegments=d.blocks.facePin.geometry.parameters.radialSegments;
const pinInradius=g.facePinRadius*Math.cos(Math.PI/pinSegments);
const field=solidSurface(d.blocks.stopWheelBody.geometry);
const points=Array.from({length:512},(_,i)=>{
 const a=i*2*Math.PI/512;
 return new THREE.Vector3(center[0]+g.facePinRadius*Math.cos(a),center[1]+g.facePinRadius*Math.sin(a),0);
});
let deepest={distance:Infinity};
for(const point of points){const distance=field.signedDistance(point);if(distance<deepest.distance)deepest={distance,point:point.toArray()};}
const thresholdTopFraction=1-2*Math.asin(g.facePinRadius/rho)/g.stopPitchAngle;
const candidateTopFraction=.28;
const candidateCapacity=rho*Math.sin(g.stopPitchAngle*(1-candidateTopFraction)/2);
assert.ok(perpendicularFootRadius>g.stopToothRootRadius&&perpendicularFootRadius<g.stopOuterRadius);
assert.ok(Math.abs(nearest.distance-maximumPinRadius)<1e-12);
assert.ok(gap<-.01&&pinInradius>maximumPinRadius);
assert.ok(deepest.distance<-.01);
function branchCheck() {
 let angle=g.initialStopWheelAngle;
 const contact=(u,a)=>{
  const x=Math.cos(g.facePinMountPhase+u)*g.facePinOrbitRadius,y=Math.sin(g.facePinMountPhase+u)*g.facePinOrbitRadius-g.centerDistance;
  return nearest390Outline([x*Math.cos(a)+y*Math.sin(a),-x*Math.sin(a)+y*Math.cos(a)],outline).distance-g.facePinRadius;
 };
 for(let i=0;i<=8192;i++){
  const input=g.forwardInputLimit*i/8192;
  if(contact(input,angle)>=-1e-7)continue;
  let low=angle,found=false;
  for(let j=1;j<=200;j++){low=angle-j*.002;if(contact(input,low)>=0){found=true;break;}}
  if(!found)return{status:'no feasible candidate in search interval',input,angle};
  let high=angle;
  for(let j=0;j<35;j++){const mid=(low+high)/2;if(contact(input,mid)>=0)low=mid;else high=mid;}
  if(angle-low>g.stopPitchAngle/2)return{status:'disconnected branch jump rejected',input,before:angle,proposedAfter:low,jumpPitches:(angle-low)/g.stopPitchAngle,continuousAdvancePitches:(g.initialStopWheelAngle-angle)/g.stopPitchAngle};
  angle=low;
 }
 return{status:'search completed',angle};
}
console.log(JSON.stringify({
 scope:'Necessary local feasibility only: closest pin approach centered in a regular tooth gap; no motion/contact certification',
 source:'https://507movements.com/mm_213.html',
 branchControl:process.argv.includes('--branch')?branchCheck():undefined,
 dimensions:{centerDistance:g.centerDistance,orbit:g.facePinOrbitRadius,pinRadius:g.facePinRadius,root:g.stopToothRootRadius,tip:g.stopOuterRadius,pitch:g.stopPitchAngle,topFraction:g.stopToothTopFraction},
 closestApproach:{rho,halfGap,maximumPinRadius,perpendicularFootRadius,pinClearanceAtBestRegularGap:gap,actual32SidedPinInradius:pinInradius,unavoidableRenderedPinOverlap:pinInradius-maximumPinRadius},
 actualMeshWitness:deepest,
 boundedProposal:{maximumTopFractionWithoutRunningClearance:thresholdTopFraction,candidateTopFraction,candidateCapacity,candidateLocalClearance:candidateCapacity-g.facePinRadius,qualification:'Only widens the regular passage. Terminal shoulders, tooth retention, one-pitch branch and reverse motion must be reconstructed together.'}
},null,2));
