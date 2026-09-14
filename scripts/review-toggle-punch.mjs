import fs from 'node:fs';
import crypto from 'node:crypto';
import {createAuthoredCrankMovement} from '../src/simulation/authored-cranks.js';
import {togglePunchDimensions as source} from '../src/data/toggle-punch-dimensions.js';
import {togglePunchGeometry as g,togglePunchAtAngle} from '../src/simulation/toggle-punch-kinematics.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const legacy=createAuthoredCrankMovement({id:140}),old=legacy.root.userData.geometry,state=legacy.root.userData.stateAtTime(0);
// Register both fixed pivots exactly with a planar similarity transform.
const a=[old.topPivot.x,-old.topPivot.y],b=source.topPivot.map((v,i)=>v-source.leverPivot[i]);
const denominator=a[0]**2+a[1]**2,c=(a[0]*b[0]+a[1]*b[1])/denominator,s=(a[0]*b[1]-a[1]*b[0])/denominator;
const pixel=p=>[source.leverPivot[0]+c*p.x+s*p.y,source.leverPivot[1]+s*p.x-c*p.y];
const oldPoints={topPivot:old.topPivot,knee:state.kneePosition,ramPin:state.sliderPinPosition,leverPin:state.leverPinPosition,handleEnd:old.handleLocalEnd,ramTip:state.punchTipPosition};
const legacyLandmarks=Object.entries(oldPoints).map(([key,p])=>{const predicted=pixel(p),measured=source[key];return {key,predicted,measured,errorPixels:Math.hypot(...predicted.map((v,i)=>v-measured[i]))};});
let maximumClosureError=0,minimumRamY=Infinity,maximumRamY=-Infinity,maximumRamReversal=0,lastY=Infinity;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
for(let i=0;i<=2000;i++){
 const p=togglePunchAtAngle(g.closedAngle*i/2000);
 maximumClosureError=Math.max(maximumClosureError,Math.abs(distance(g.top,p.knee)-g.upperLength),Math.abs(distance(p.knee,p.ram)-g.lowerLength),Math.abs(distance(p.pin,p.knee)-g.connectorLength));
 minimumRamY=Math.min(minimumRamY,p.ram[1]);maximumRamY=Math.max(maximumRamY,p.ram[1]);maximumRamReversal=Math.max(maximumRamReversal,p.ram[1]-lastY);lastY=p.ram[1];
}
const report={legacyLandmarks,legacyHandleLengthPixels:old.handleLength*Math.hypot(c,s),measuredHandleLengthPixels:distance(source.handleEnd,source.leverPivot),fitted:{upperLinkPixels:100*g.upperLength,lowerLinkPixels:100*g.lowerLength,connectorPixels:100*g.connectorLength,leverSwingDegrees:-g.closedAngle*180/Math.PI,ramStrokePixels:100*(maximumRamY-minimumRamY),maximumClosureError,maximumRamReversal},caveat:'Engraving-fitted unequal links close analytically but require a larger lever swing than the source animation. No force or material-cutting simulation is claimed. This dimensional report does not test rendered hardware; see the separate clearance report.',sources:['src/data/toggle-punch-dimensions.js','src/simulation/toggle-punch-kinematics.js','src/simulation/authored-cranks.js','scripts/review-toggle-punch.mjs'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync('docs/validation/140-dimensions.json',JSON.stringify(report,null,2)+'\n');
console.log(report);disposeObject3D(legacy.root);
