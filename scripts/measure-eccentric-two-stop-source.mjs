import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredIntermittentMovement} from '../src/simulation/authored-intermittent.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/088-production-source-fit',sources=freezeStudySources([
  'scripts/measure-eccentric-two-stop-source.mjs','src/simulation/authored-intermittent.js','public/engravings/mm_088.png'],prefix),
  // Hand-picked centerlines from the opened 525 by 525 local engraving.
  // The stated uncertainty covers stroke thickness and manual selection.
  uncertaintyPixels=3,
  rim=[[276,66],[429,130],[492,278],[429,430],[276,495],[122,430],[58,280],[121,129]],
  cam=[[149,298],[150,276],[158,238],[177,206],[209,178],[243,162],[275,158],[316,164],[354,183],
    [385,213],[405,249],[413,285],[409,329],[391,371],[361,405],[319,430],[278,440],[242,438],[203,425],
    [168,405],[141,376],[121,345],[107,302]],
  landmarks={inputAxis:[277,282],stopC:[120,275],stopD:[449,275]},
  model=createAuthoredIntermittentMovement({id:88}),u=model.root.userData,p=u.geometry;
// Fit x*x+y*y+A*x+B*y+C=0 to the disk outline. This provides one
// common translation and uniform scale; the cam is not fitted separately.
const matrix=Array.from({length:3},()=>[0,0,0,0]);
for(const[x,y]of rim){const row=[x,y,1],b=-x*x-y*y;for(let i=0;i<3;i++){for(let j=0;j<3;j++)matrix[i][j]+=row[i]*row[j];matrix[i][3]+=row[i]*b;}}
for(let k=0;k<3;k++){
  let pivot=k;for(let i=k+1;i<3;i++)if(Math.abs(matrix[i][k])>Math.abs(matrix[pivot][k]))pivot=i;
  [matrix[k],matrix[pivot]]=[matrix[pivot],matrix[k]];assert(Math.abs(matrix[k][k])>1e-12);
  const divisor=matrix[k][k];for(let j=k;j<4;j++)matrix[k][j]/=divisor;
  for(let i=0;i<3;i++)if(i!==k){const factor=matrix[i][k];for(let j=k;j<4;j++)matrix[i][j]-=factor*matrix[k][j];}
}
const center=[-matrix[0][3]/2,-matrix[1][3]/2],radius=Math.sqrt(center[0]**2+center[1]**2-matrix[2][3]),scale=radius/p.wheelRadius,
  project=v=>[center[0]+scale*(v.x-p.eccentricity),center[1]-scale*v.y],
  residuals=rim.map(([x,y])=>Math.hypot(x-center[0],y-center[1])-radius);
model.update(0);model.root.updateMatrixWorld(true);
const mesh=u.blocks.camBody,outline=mesh.userData.profilePoints.map(v=>project(new THREE.Vector3(v.x,v.y,0).applyMatrix4(mesh.matrixWorld)));
function closest(point,polyline){
  let best={distance:Infinity};
  for(let i=0;i<polyline.length;i++){
    const a=polyline[i],b=polyline[(i+1)%polyline.length],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
    const t=length2?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length2)):0,
      q=[a[0]+t*dx,a[1]+t*dy],distance=Math.hypot(point[0]-q[0],point[1]-q[1]);
    if(distance<best.distance)best={distance,point:q,segment:i};
  }
  return best;
}
const samples=cam.map(point=>({point,...closest(point,outline)})),actual={inputAxis:project(new THREE.Vector3())};
for(const label of ['C','D'])actual['stop'+label]=project(u.blocks['stop'+label+'Body'].getWorldPosition(new THREE.Vector3()));
const landmarkErrors=Object.entries(landmarks).map(([name,point])=>({name,point,actual:actual[name],distance:Math.hypot(...point.map((v,i)=>v-actual[name][i]))})),
  summary={meanContourDistance:samples.reduce((n,s)=>n+s.distance,0)/samples.length,
    rmsContourDistance:Math.sqrt(samples.reduce((n,s)=>n+s.distance**2,0)/samples.length),maximumContourDistance:Math.max(...samples.map(s=>s.distance)),
    maximumRimResidual:Math.max(...residuals.map(Math.abs)),landmarkErrors};
const path=points=>points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ')+'Z',svg=prefix+'.svg';
fs.writeFileSync(svg,`<svg xmlns="http://www.w3.org/2000/svg" width="780" height="590" viewBox="0 0 780 590"><rect width="780" height="590" fill="#faf8f2"/><image href="../../public/engravings/mm_088.png" width="525" height="525"/><path d="${path(outline)}" fill="none" stroke="#dc6534" stroke-width="2"/><path d="${path(cam)}" fill="none" stroke="#16899a" stroke-width="1.5" stroke-dasharray="4 3"/>${landmarkErrors.map(s=>`<path d="M${s.point.join(',')}L${s.actual.join(',')}" stroke="#993cb0" stroke-width="2"/><circle cx="${s.actual[0]}" cy="${s.actual[1]}" r="4" fill="#993cb0"/>`).join('')}<g font-family="system-ui" font-size="15"><text x="540" y="70">088 source comparison</text><text x="540" y="105" fill="#dc6534">Production cam outline</text><text x="540" y="135" fill="#16899a">Manual engraving trace</text><text x="540" y="165" fill="#993cb0">Landmark displacement</text><text x="20" y="555">One disk-based registration; manual point uncertainty ±3 px. Diagnostic, not a replacement fit.</text></g></svg>\n`,{flag:'wx'});
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:88,productionChanged:false,mechanicsPassed:false,sources,uncertaintyPixels,
  registration:{center,radius,scale,rotation:0,residuals},rim,cam,outline,landmarks,samples,summary,svg,
  qualification:'Manual centerline measurements in the opened local engraving. A least-squares outer-disk circle supplies one translation and uniform scale for the whole mechanism at time zero. Source asymmetry, scan distortion and stroke width limit precision. Distances are to the generated planar cam profile, excluding its 0.008 bevel. These measurements diagnose existing source mismatch; they do not establish a corrected cam or qualify contact dynamics.'},null,2)+'\n',{flag:'wx'});
console.log(summary);
