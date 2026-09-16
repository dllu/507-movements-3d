// Finite cutter + retained clockwise contact branch; no dynamic force claim.
import * as THREE from 'three';
import {readFile,writeFile} from 'node:fs/promises';
import {createAuthoredIntermittentMovement as create} from '../src/simulation/authored-intermittent.js';
import {nearest390Outline} from '../src/simulation/dual-band-pawl-contact.js';
const model=create({id:213}),g=model.root.userData.geometry,TAU=2*Math.PI;
// Inputs are source dimensions. Keep the reference phase independent of a
// regenerated output so --check never depends on the previous bake.
const referenceInitial=(2+g.sourceIndexProgress)*g.stopPitchAngle;
const mid=(g.freeApproachInputAngle+TAU)/2,width=.75,n=1024,steps=4096,allowance=.0002;
const pin=u=>[Math.cos(g.facePinMountPhase+u)*g.facePinOrbitRadius,Math.sin(g.facePinMountPhase+u)*g.facePinOrbitRadius-g.centerDistance];
const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const trial=u=>{const t=Math.max(0,Math.min(1,(u-mid+width/2)/width));return referenceInitial-g.stopPitchAngle*t*t*t*(10+t*(-15+6*t));};
const centers=Array.from({length:1025},(_,i)=>rotate(pin(g.freeApproachInputAngle+g.activeIndexInputAngle*i/1024),-trial(g.freeApproachInputAngle+g.activeIndexInputAngle*i/1024)));
const radii=Array.from({length:n},(_,i)=>{
 const angle=g.stopSectorCenterAngle+g.stopPitchAngle*i/n;let r=g.stopOuterRadius;
 for(const p of centers){const pa=Math.atan2(p[1],p[0]),pr=Math.hypot(...p),delta=((angle-pa+g.stopPitchAngle/2)%g.stopPitchAngle+g.stopPitchAngle)%g.stopPitchAngle-g.stopPitchAngle/2,projection=pr*Math.cos(delta),side=pr*Math.sin(delta);
  if(Math.abs(side)<g.facePinRadius)r=Math.min(r,projection-Math.sqrt(g.facePinRadius**2-side**2));}
 return r-allowance;
});
const periodicOutline=Array.from({length:3*n},(_,i)=>{const a=g.stopSectorCenterAngle+(i/n-1)*g.stopPitchAngle,r=radii[i%n];return[r*Math.cos(a),r*Math.sin(a)];});periodicOutline.push([0,0]);
function gap(u,q){const p=pin(u),rho=Math.hypot(...p),phi=Math.atan2(p[1],p[0])-q,a=g.stopSectorCenterAngle+((phi-g.stopSectorCenterAngle)%g.stopPitchAngle+g.stopPitchAngle)%g.stopPitchAngle;return nearest390Outline([rho*Math.cos(a),rho*Math.sin(a)],periodicOutline).distance-g.facePinRadius;}
function solveTurn(initial){let q=initial;const angles=[];for(let i=0;i<=steps;i++){
 const u=TAU*i/steps;
 if(gap(u,q)<0){let low=q,found=false;for(let j=1;j<=400;j++){low=q-j*.00005;if(gap(u,low)>=0){found=true;break;}}if(!found)throw Error(`213 disconnected branch at ${u}`);
  let high=q;for(let j=0;j<36;j++){const a=(low+high)/2;if(gap(u,a)>=0)low=a;else high=a;}if(q-low>.02)throw Error('213 branch jump');q=low;}
 angles.push(q);
 }return angles;}
let angles=solveTurn(referenceInitial);const initialAngle=angles.at(-1)+g.stopPitchAngle;angles=solveTurn(initialAngle);
if(Math.abs(initialAngle-angles.at(-1)-g.stopPitchAngle)>1e-9)throw Error('213 contact branch does not index one pitch');
function solveReverse(initial){let q=initial;const result=Array(steps+1);for(let i=steps;i>=0;i--){
 const u=TAU*i/steps;
 if(gap(u,q)<0){let high=q,found=false;for(let j=1;j<=400;j++){high=q+j*.00005;if(gap(u,high)>=0){found=true;break;}}if(!found)throw Error(`213 reverse disconnected at ${u}`);
 let low=q;for(let j=0;j<36;j++){const a=(low+high)/2;if(gap(u,a)>=0)high=a;else low=a;}if(high-q>.02)throw Error('213 reverse branch jump');q=high;}
 result[i]=q;
 }return result;}
const reverseAngles=solveReverse(initialAngle-g.stopPitchAngle);
const firstAngles=solveTurn(reverseAngles[0]);
const repeatReverseAngles=solveReverse(reverseAngles[0]-g.stopPitchAngle);
// Full five-index sweep rounds the two terminal shoulders, but keeps the
// uncut rim and split. Taper allowance at hard stops preserves those faces.
const allCenters=[];
for(let i=0;i<=Math.ceil(g.forwardInputLimit/TAU*steps);i++){
 const u=Math.min(g.forwardInputLimit,TAU*i/steps),turn=Math.min(5,Math.floor(u/TAU)),phase=u-turn*TAU;
 const index=Math.min(steps,Math.round(phase/TAU*steps));
 const forward=turn===5?initialAngle-5*g.stopPitchAngle:(turn===0?firstAngles:angles)[index]-turn*g.stopPitchAngle;
 const reverse=turn===5?initialAngle-5*g.stopPitchAngle:(turn===4?reverseAngles:repeatReverseAngles)[index]-turn*g.stopPitchAngle;
 for(const q of [forward,reverse]){const p=rotate(pin(u),-q),rho=Math.hypot(...p);if(rho<g.stopOuterRadius+g.facePinRadius+.001)allCenters.push({p,rho,angle:Math.atan2(p[1],p[0]),radius:g.facePinRadius+allowance*Math.min(1,u/.01,(g.forwardInputLimit-u)/.01)**2});}
}
const start=Math.PI/2+g.splitHalfAngle,end=Math.PI/2+TAU-g.splitHalfAngle;
const radialBase=angle=>{if(angle<g.stopSectorStartAngle+TAU||angle>g.stopSectorEndAngle+TAU)return g.stopOuterRadius;const x=(((angle-g.stopSectorCenterAngle)%g.stopPitchAngle)+g.stopPitchAngle)%g.stopPitchAngle/g.stopPitchAngle*n,i=Math.floor(x),t=x-i;return radii[i%n]*(1-t)+radii[(i+1)%n]*t;};
const outer=Array.from({length:4097},(_,i)=>{
 const angle=start+(end-start)*i/4096;let r=radialBase(angle);
 for(const c of allCenters){const delta=angle-c.angle,side=c.rho*Math.sin(delta),projection=c.rho*Math.cos(delta);if(projection>0&&Math.abs(side)<c.radius)r=Math.min(r,projection-Math.sqrt(c.radius*c.radius-side*side));}
 return[r*Math.cos(angle),r*Math.sin(angle)];
});
const outline=[...outer,...Array.from({length:151},(_,i)=>{const a=end-(end-start)*i/150;return[g.stopInnerRadius*Math.cos(a),g.stopInnerRadius*Math.sin(a)];})];
const data={initialAngle,angles,firstAngles,reverseAngles,repeatReverseAngles,outline,outer,regularRadiusRange:[Math.min(...radii),Math.max(...radii)],allowance,steps,trialWidth:width};
const output='// Generated by scripts/generate-split-rim-213-contact.mjs.\nexport const splitRim213Contact = '+JSON.stringify(data)+';\n';
const target=new URL('../src/simulation/baked/split-rim-213-contact.js',import.meta.url);
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==output)throw Error('213 bake differs');console.log('213 bake is byte-identical');}else{await writeFile(target,output);console.log({initialAngle,advance:initialAngle-angles.at(-1),regularRadiusRange:data.regularRadiusRange,points:outline.length});}
