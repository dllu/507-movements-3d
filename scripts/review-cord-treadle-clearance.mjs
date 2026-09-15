import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cordTreadleSource as source,cordTreadleParameters,cordTreadleState} from '../src/simulation/cord-treadle-motion.js';
import {createAuthoredCrankMovement} from '../src/simulation/authored-cranks.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const g=cordTreadleParameters(),v=createAuthoredCrankMovement({id:159});
try{
 let low=Infinity,angle=0,phase=0,below=0,maxLegacyError=0,maxLengthError=0;
 for(let i=0;i<=2048;i++){const s=cordTreadleState(g.period*i/2048,g),old=v.root.userData.stateAtTime(g.period*i/2048);maxLegacyError=Math.max(maxLegacyError,Math.abs(s.treadleAngle-old.treadleAngle));maxLengthError=Math.max(maxLengthError,Math.abs(s.length-g.cordLength));if(s.foot[1]<low){low=s.foot[1];angle=s.treadleAngle;phase=i/2048;}if(s.foot[1]<g.groundY)below++;}
 // Sensitivity only: shorten crank radius along its drawn ray, keeping the
 // original initial treadle pose and retie the cord. Do not ship this change.
 const radiusStudies=[];for(const radius of [75,60,45,30,20]){const measured=Math.hypot(source.pin[0]-source.diskCenter[0],source.pin[1]-source.diskCenter[1]),candidate={...source,pin:source.pin.map((x,i)=>source.diskCenter[i]+(x-source.diskCenter[i])*radius/measured)},p=cordTreadleParameters(candidate);let y=Infinity;for(let i=0;i<=512;i++)y=Math.min(y,cordTreadleState(p.period*i/512,p).foot[1]);radiusStudies.push({radiusPixels:radius,pinShiftPixels:Math.abs(measured-radius),lowestFootPixels:source.diskCenter[1]-y/source.scale,centerClearancePixels:(y-p.groundY)/source.scale});}
 const report={movement:159,method:'Exact tangent-span plus upper clockwise arc length, solved on the existing taut branch. 2049 full-cycle poses compare with production; 513 poses for each one-parameter crank-radius sensitivity case. Foot center clearance only, not a visible-solid audit.',source,maximumLegacyAngleError:maxLegacyError,maximumCordLengthError:maxLengthError,lowestFootPixels:source.diskCenter[1]-low/source.scale,groundPixels:source.ground,maximumCenterFloorPenetrationPixels:(g.groundY-low)/source.scale,lowestPhase:phase,lowestTreadleAngle:angle,belowFloorSamples:below,samples:2049,radiusStudies,sources:['scripts/review-cord-treadle-clearance.mjs','src/simulation/cord-treadle-motion.js','src/simulation/authored-cranks.js','public/engravings/mm_159.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/159-source-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.ok(maxLegacyError<1e-12);assert.ok(report.maximumCenterFloorPenetrationPixels>100);
}finally{disposeObject3D(v.root);}
