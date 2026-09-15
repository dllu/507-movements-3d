import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {diagonalCatchProfile} from '../src/simulation/mujoco-diagonal-catch/catch-profile.js';

// Hand-selected corresponding outline points, not a whole-contour fit score.
// The engraving centers differ, so register each drawing at its catch pivot.
const plates=[
 {id:181,pivot:[271,234],time:0,head:{lip:[193,113],leftShoulder:[169,113]}},
 {id:182,pivot:[270,236],time:9,head:{lip:[210,128],leftShoulder:[189,124]}},
];
const previous={lip:[193,113],leftShoulder:[169,113]};
const profile=diagonalCatchProfile();
const motionFile='/dev/shm/181-contact-motion.json',motion=JSON.parse(fs.readFileSync(motionFile));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const point=([x,y],angle,pivot)=>{
 const dx=x-271,dy=y-234,c=Math.cos(angle),s=Math.sin(angle);
 return [pivot[0]+dx*c+dy*s,pivot[1]-dx*s+dy*c];
};
const panels=[],measurements=[];
for(const plate of plates){
 const key=motion.keys.reduce((a,b)=>Math.abs(a[0]-plate.time)<Math.abs(b[0]-plate.time)?a:b),angle=key[3];
 const landmarks=Object.entries(plate.head).map(([name,measured])=>{
  const modeled=point(profile.headLandmarks[name],angle,plate.pivot),old=point(previous[name],angle,plate.pivot);
  return {name,measured,modeled,errorPixels:Math.hypot(...modeled.map((v,i)=>v-measured[i])),
   previousModeled:old,previousErrorPixels:Math.hypot(...old.map((v,i)=>v-measured[i]))};
 });
 measurements.push({movement:plate.id,catchAngle:angle,pivot:plate.pivot,landmarks});
 const source=fs.readFileSync(`public/engravings/mm_${plate.id}.png`).toString('base64');
 const outline=profile.raster.map(p=>point(p,angle,plate.pivot).join(',')).join(' ');
 const markers=landmarks.map(l=>`<circle cx="${l.measured[0]}" cy="${l.measured[1]}" r="3" fill="#15803d"/><circle cx="${l.modeled[0]}" cy="${l.modeled[1]}" r="3" fill="#dc2626"/>`).join('');
 panels.push(`<section><h2>${plate.id}</h2><svg viewBox="0 0 525 525" width="630" height="630"><image width="525" height="525" href="data:image/png;base64,${source}"/><polygon points="${outline}" fill="#ef923c" fill-opacity=".18" stroke="#c2410c" stroke-width="1.2"/>${markers}</svg></section>`);
}
const rows=measurements.flatMap(m=>m.landmarks),rms=key=>Math.sqrt(rows.reduce((sum,r)=>sum+r[key]**2,0)/rows.length);
const radialDiscrepancies=Object.keys(previous).map(name=>{
 const radii=plates.map(p=>Math.hypot(...p.head[name].map((v,i)=>v-p.pivot[i])));
 return {name,radiiPixels:radii,differencePixels:Math.abs(radii[0]-radii[1]),
  minimumPossibleMaximumErrorPixels:Math.abs(radii[0]-radii[1])/2};
});
const report={movements:[181,182],scope:'Two manually selected rounded-head landmarks per plate; not whole-contour or complete-assembly qualification.',
 method:'Register at the catch pivot and evaluate both outlines at the same current baked angles. The radial lower bound allows arbitrary rotation but fixes each landmark on a rigid body; it depends on the hand-selected correspondences.',radialDiscrepancies,
 baselineCommit:'1fc48f9c2b3f60b2af6c5a7969bfa91864fb52d7',previousHeadLandmarks:previous,
 currentHeadLandmarks:profile.headLandmarks,measurements,rmsErrorPixels:rms('errorPixels'),previousRmsErrorPixels:rms('previousErrorPixels'),
 maximumErrorPixels:Math.max(...rows.map(r=>r.errorPixels)),previousMaximumErrorPixels:Math.max(...rows.map(r=>r.previousErrorPixels)),
 motionHash:hash(motionFile),sources:['scripts/review-diagonal-catch-source.mjs','src/simulation/mujoco-diagonal-catch/catch-profile.js',
 'docs/validation/181-projected-contact-motion.json','public/engravings/mm_181.png','public/engravings/mm_182.png'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync('docs/validation/181-source-head.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync('/dev/shm/181-source-head.html',`<!doctype html><meta charset="utf-8"><title>181–182 catch overlay</title><style>body{font:16px sans-serif;margin:12px;background:#fff}main{display:flex}h2{margin:8px}p{margin:8px}</style><p>Orange: finite catch outline. Green: measured source landmark. Red: model landmark. Pivot-registered; no per-stage scaling.</p><main>${panels.join('')}</main>`);
console.log({rmsErrorPixels:report.rmsErrorPixels,previousRmsErrorPixels:report.previousRmsErrorPixels,maximumErrorPixels:report.maximumErrorPixels});
