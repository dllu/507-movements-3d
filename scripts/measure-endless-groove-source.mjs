import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';
import assert from 'node:assert/strict';
import source from '../src/simulation/mujoco-endless-groove/source.js';
import {makeEndlessGrooveProfile} from '../src/simulation/mujoco-endless-groove/profile.js';

const file='public/engravings/mm_098.png';
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function inkRuns(point,normal,low,high) {
  const runs=[];let start;
  for(let r=low;r<=high+.01;r+=.2) {
    const ink=pixel(point[0]+r*normal[0],point[1]+r*normal[1])<110;
    if(ink&&start===undefined)start=r;
    if(!ink&&start!==undefined){if(start>low+.01)runs.push({r:(start+r-.2)/2,width:r-start});start=undefined;}
  }
  return runs;
}
const circles={};
for(const [name,center,range,nominal] of [
  ['disk',[190,320],[155,171],163],['hub',[192,322],[25,34],30],
  ['shaft',[192,322],[10,20],15],['pivot',[444,317],[29,38],33],
  ['pivotShaft',[445,317],[18,26],22],['pin',[207,419],[3,8],5],
]) {
  const points=[];
  for(let deg=0;deg<360;deg+=3) {
    // Disk covered by the arm; masked hub crossings and neck intersections.
    if(name==='disk'&&!(deg>=182&&deg<=352||deg>=43&&deg<=109))continue;
    if(name==='hub'&&(deg>203&&deg<227||deg>269&&deg<302))continue;
    if(name==='pivot'&&(deg<12||deg>340||deg>153&&deg<195))continue;
    const a=deg*Math.PI/180,n=[Math.cos(a),Math.sin(a)];
    const runs=inkRuns(center,n,...range).filter(r=>r.width<7).sort((a,b)=>Math.abs(a.r-nominal)-Math.abs(b.r-nominal));
    if(runs.length)points.push(center.map((v,i)=>v+runs[0].r*n[i]));
  }
  circles[name]=circleFit(points);
}
const seed=[197,361,-.17,68,45,65],points=[];
function sample(point,normal,face,range=9) {
  if(face<2&&Math.hypot(point[0]-192,point[1]-322)<36)return;
  if(face<2&&Math.hypot(point[0]-207,point[1]-419)<10)return;
  const runs=inkRuns(point,normal,-range,range).filter(r=>r.width<6).sort((a,b)=>Math.abs(a.r)-Math.abs(b.r));
  if(runs.length)points.push({face,p:point.map((v,i)=>v+runs[0].r*normal[i])});
}
for(let face=0;face<3;face++) {
  const r=[45,65,85][face],c=Math.cos(seed[2]),s=Math.sin(seed[2]);
  const world=p=>[seed[0]+c*p[0]-s*p[1],seed[1]+s*p[0]+c*p[1]];
  for(let deg=0;deg<360;deg+=3) {
    if(face===2&&(deg<23||deg>337))continue;
    const a=deg*Math.PI/180,n=[Math.cos(a),Math.sin(a)];
    sample(world([Math.sign(n[0])*seed[3]+r*n[0],r*n[1]]),[c*n[0]-s*n[1],s*n[0]+c*n[1]],face);
  }
  for(const sign of [-1,1])for(let x=-seed[3]+3;x<seed[3];x+=3)sample(world([x,sign*r]),[-sign*s,sign*c],face);
}
function solve(a) {
  const n=a.length;
  for(let i=0;i<n;i++) {
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];for(let j=i;j<=n;j++)a[i][j]/=d;
    for(let j=0;j<n;j++)if(i!==j){const f=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=f*a[i][k];}
  }
  return a.map(r=>r[n]);
}
function fit(samples,initial) {
  let q=[...initial];
  const residual=(q,{p,face})=>{
    const dx=p[0]-q[0],dy=p[1]-q[1],c=Math.cos(q[2]),s=Math.sin(q[2]);
    return Math.hypot(Math.max(0,Math.abs(c*dx+s*dy)-q[3]),-s*dx+c*dy)-q[4+face];
  };
  for(let iteration=0;iteration<15;iteration++) {
    const n=q.length,a=Array.from({length:n},()=>Array(n+1).fill(0));
    for(const point of samples) {
      const r=residual(q,point),row=q.map((_,i)=>{const shifted=[...q];shifted[i]+=.00001;return (residual(shifted,point)-r)/.00001;});
      for(let i=0;i<n;i++){for(let j=0;j<n;j++)a[i][j]+=row[i]*row[j];a[i][n]-=row[i]*r;}
    }
    const step=solve(a);q=q.map((v,i)=>v+step[i]);
  }
  const residuals=samples.map(p=>residual(q,p));
  return {center:q.slice(0,2),angle:q[2],halfLength:q[3],radii:q.slice(4),points:samples,residuals,
    rms:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/samples.length),maximum:Math.max(...residuals.map(Math.abs))};
}
const groove=fit(points.filter(p=>p.face<2),seed);
const body=fit(points.filter(p=>p.face===2).map(p=>({...p,face:0})),[...seed.slice(0,4),85]);
const result={file,sha256:hashStudyFile(file),circles,groove,body,
  manual:{neck:[[340,314],[370,315],[411,307],[414,332],[371,340],[345,352]],shaftEnd:509},
  qualification:'Ink-run midpoints near independent sampling stations fit the visible disk, hubs and pin, both dashed groove faces, and the arm outline. Masks exclude occlusions, the neck, and hub/pin crossings. Capsule regularization, depths and fits are reconstructed.'};
assert.deepEqual(source.axis,circles.hub.center);assert.deepEqual(source.pivot,circles.pivot.center);assert.deepEqual(source.pin,circles.pin.center);
assert.deepEqual(source.groove,{center:groove.center,angle:groove.angle,halfLength:groove.halfLength,radii:groove.radii});
assert.deepEqual(source.body,{center:body.center,angle:body.angle,halfLength:body.halfLength,radius:body.radii[0]});
const f=makeEndlessGrooveProfile(),angle=f.initialAngle,c=Math.cos(angle),s=Math.sin(angle);
const faceDistances=groove.points.map(({p,face})=>{
  const [x,y]=f.world(p).map((v,i)=>v-f.pivot[i]);
  return Math.abs(f.distance([c*x+s*y,-s*x+c*y])*100-groove.radii[face]);
});
result.reconstruction={grooveFaceRmsPixels:Math.sqrt(faceDistances.reduce((s,d)=>s+d*d,0)/faceDistances.length),
  grooveFaceMaximumPixels:Math.max(...faceDistances),faceDistances,
  initialAngleAdjustmentDegrees:(angle-f.sourceAngle)*180/Math.PI,
  diskRecenteringPixels:Math.hypot(...source.axis.map((v,i)=>v-source.diskCenter[i])),
  inputAxisCorrectionPixels:f.inputCenter.map((v,i)=>100*v*(i===1?-1:1)),
  drawnCrankRadiusPixels:Math.hypot(...source.pin.map((v,i)=>v-source.axis[i])),
  initialPinCorrectionPixels:f.initialPin.map((v,i)=>source.axis[i]+100*v*(i===1?-1:1)-source.pin[i]),
  grooveRadialExtremaPixels:[f.minimumRadius,f.maximumRadius].map(v=>100*v),
  crankRadiusPixels:f.crankRadius*100,workingPinRadiusPixels:f.pinRadius*100,halfWidthPixels:f.halfWidth*100};
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/098-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])));
for(const [name,f] of Object.entries({groove,body}))console.log(name,{...f,points:f.points.length,residuals:undefined});
console.log({...result.reconstruction,faceDistances:undefined});
