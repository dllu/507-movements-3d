import fs from 'node:fs';
import {internalRackDimensions as source} from '../src/data/internal-rack-dimensions.js';
import {internalRackPitchDimensions,internalRackPitchPose} from '../src/simulation/mujoco-internal-rack/profile.js';
import {internalRackSuspension} from '../src/simulation/mujoco-internal-rack/suspension.js';
const d=internalRackPitchDimensions(),pose=internalRackPitchPose(d.sourcePhase),s=internalRackSuspension(pose.y);
const pixel=([x,y])=>[258+100*(x+pose.x),276-100*y];
const landmarks=[];
for(const side of ['left','right'])for(const key of ['pivot','rackPin','wrist','top']){
 const rendered=pixel(s[side][key]),engraved=source.suspension[side][key];
 landmarks.push({side,key,engraved,rendered,errorPixels:Math.hypot(rendered[0]-engraved[0],rendered[1]-engraved[1])});
}
let maximumRodLengthError=0,maximumCouplerLengthError=0,minAngle=Infinity,maxAngle=-Infinity;
for(let i=0;i<=1000;i++){
 const p=internalRackPitchPose(i/1000),v=internalRackSuspension(p.y);
 for(const side of ['left','right']){const a=v[side].rackPin,b=v[side].wrist;maximumRodLengthError=Math.max(maximumRodLengthError,Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-v.rodLength));}
 maximumCouplerLengthError=Math.max(maximumCouplerLengthError,Math.abs(Math.hypot(v.left.top[0]-v.right.top[0],v.left.top[1]-v.right.top[1])-v.couplerLength));
 minAngle=Math.min(minAngle,v.angle);maxAngle=Math.max(maxAngle,v.angle);
}
const openingRadius=d.endRadius+d.module;
const predictedRootBounds={left:258+100*(pose.x-d.halfSpan-openingRadius),right:258+100*(pose.x+d.halfSpan+openingRadius),top:276-100*(pose.y+openingRadius),bottom:276-100*(pose.y-openingRadius)};
const report={dimensions:d,sourcePose:pose,pinionOuterRadiusPixels:100*(d.radius+d.module),measuredPinionOuterRadiusPixels:source.pinionOuterRadius,predictedRootBounds,measuredRootBounds:source.rackRootBounds,landmarks,maximumLandmarkErrorPixels:Math.max(...landmarks.map(p=>p.errorPixels)),maximumRodLengthError,maximumCouplerLengthError,angleRange:[minAngle,maxAngle],caveat:'The opening is shifted upward to obtain conjugate engagement. Parallel suspension arms reconcile left/right drawing discrepancies. Physical preload/contact dynamics are not yet validated.'};
fs.writeFileSync('docs/validation/139-dimensions.json',JSON.stringify(report,null,2)+'\n');
const png=fs.readFileSync('public/engravings/mm_139.png').toString('base64');
const profile=JSON.parse(fs.readFileSync('/dev/shm/139-generated-profile.json'));
const paths=profile.opening.flat().map(r=>'M'+r.map(([x,y])=>[258+100*(x+pose.x),276-100*(y+pose.y)].join(',')).join('L')+'Z').join('');
const pinion=profile.pinion.map(([x,y])=>{const c=Math.cos(pose.angle),s=Math.sin(pose.angle);return[258+100*(c*x-s*y),276-100*(s*x+c*y)];});
const lines=[];for(const side of ['left','right'])for(const [a,b]of [['top','pivot'],['pivot','wrist'],['wrist','rackPin']])lines.push([pixel(s[side][a]),pixel(s[side][b])]);lines.push([pixel(s.left.top),pixel(s.right.top)]);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="525" height="555"><rect width="525" height="555" fill="white"/><image href="data:image/png;base64,${png}" width="525" height="525"/><path d="${paths}" stroke="#e34b35" stroke-width=".8" fill="none"/><polygon points="${pinion.map(p=>p.join(',')).join(' ')}" stroke="#e34b35" stroke-width=".8" fill="none"/>${lines.map(([a,b])=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#008b66" stroke-width="1.2"/>`).join('')}<text x="10" y="543" font-size="12">139: conjugate teeth (red), fitted suspension centres (green)</text></svg>`;
fs.writeFileSync('docs/validation/139-dimensions.svg',svg);console.log(report);
