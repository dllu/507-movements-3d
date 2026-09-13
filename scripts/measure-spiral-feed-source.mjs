import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';
import assert from 'node:assert/strict';
import source from '../src/simulation/mujoco-spiral-feed/source.js';
import {makeSpiralFeedGeometry} from '../src/simulation/mujoco-spiral-feed/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

const file='public/engravings/mm_099.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runs(center,angle,low,high) {
  const points=[];let start;
  for(let r=low;r<high;r+=.2) {
    const ink=pixel(center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle))<110;
    if(ink&&start===undefined)start=r;
    if(!ink&&start!==undefined){if(start>low+.01)points.push({r:(start+r-.2)/2,width:r-start});start=undefined;}
  }
  return points;
}
const circles={};
for(const [name,center,range,nominal] of [
  ['disk',[258,225],[197,212],205],['hub',[258,225],[43,52],48],['shaft',[258,225],[24,31],28],
  ['eye',[259,357],[29,37],33],['head',[259,357],[15,23],19],
]) {
  const points=[];
  for(let deg=0;deg<360;deg+=3) {
    if(name==='disk'&&deg>260&&deg<281)continue;
    if(name==='hub'&&deg>157&&deg<210)continue;
    if(name==='eye'&&deg>230&&deg<310)continue;
    const a=deg*Math.PI/180,readings=runs(center,a,...range).filter(r=>r.width<7).sort((a,b)=>Math.abs(a.r-nominal)-Math.abs(b.r-nominal));
    if(readings.length)points.push([center[0]+readings[0].r*Math.cos(a),center[1]-readings[0].r*Math.sin(a)]);
  }
  circles[name]=circleFit(points);
}
const axis=circles.shaft.center,points=[],excluded=[],sweep=9*Math.PI;
for(let deg=0;deg<360;deg+=3) {
  const angle=deg*Math.PI/180,phase=((-Math.PI/2-angle)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
  const readings=runs(axis,angle,49,198).filter(r=>r.width<7);
  for(let turn=0;turn<5;turn++) {
    const t=phase+turn*2*Math.PI;if(t>sweep)continue;
    const seed=49+5.1*t;if(seed<56)continue;
    const p=[axis[0]+seed*Math.cos(angle),axis[1]-seed*Math.sin(angle)];
    if(Math.hypot(p[0]-259,p[1]-357)<39||p[1]>383&&p[0]>233&&p[0]<281)continue;
    const near=readings.filter(r=>Math.abs(r.r-seed)<12).sort((a,b)=>Math.abs(a.r-seed)-Math.abs(b.r-seed));
    if(near.length)points.push({t,angle,r:near[0].r,width:near[0].width,p:[axis[0]+near[0].r*Math.cos(angle),axis[1]-near[0].r*Math.sin(angle)]});
    else excluded.push({deg,turn,seed});
  }
}
const mx=points.reduce((s,p)=>s+p.t/points.length,0),my=points.reduce((s,p)=>s+p.r/points.length,0);
const pitch=points.reduce((s,p)=>s+(p.t-mx)*(p.r-my),0)/points.reduce((s,p)=>s+(p.t-mx)**2,0),start=my-pitch*mx;
const residuals=points.map(p=>p.r-start-pitch*p.t),widths=points.map(p=>p.width).sort((a,b)=>a-b);
const spiral={start,pitch,sweep,width:widths[Math.floor(widths.length/2)],points,excluded,residuals,rms:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/points.length),maximum:Math.max(...residuals.map(Math.abs))};
const basis=t=>[1,t,Math.cos(t),Math.sin(t)],matrix=Array.from({length:4},()=>Array(5).fill(0));
for(const p of points){const row=basis(p.t);for(let i=0;i<4;i++){for(let j=0;j<4;j++)matrix[i][j]+=row[i]*row[j];matrix[i][4]+=row[i]*p.r;}}
for(let i=0;i<4;i++){const d=matrix[i][i];for(let j=i;j<5;j++)matrix[i][j]/=d;for(let j=0;j<4;j++)if(i!==j){const f=matrix[j][i];for(let k=i;k<5;k++)matrix[j][k]-=f*matrix[i][k];}}
const coefficients=matrix.map(row=>row[4]),harmonicResiduals=points.map(p=>p.r-basis(p.t).reduce((s,v,i)=>s+v*coefficients[i],0));
spiral.regularized={coefficients,rms:Math.sqrt(harmonicResiduals.reduce((s,v)=>s+v*v,0)/points.length),maximum:Math.max(...harmonicResiduals.map(Math.abs))};
const result={file,sha256:hashStudyFile(file),circles,spiral,
  manual:{spiralEnd:[249,39],eyeNeck:[[238,384],[278,384],[278,412],[238,412]],barLeft:244,barRight:269,barEnd:518,guide:[212,454,302,499],rails:[195,318],railTop:425,railEnd:518},
  qualification:'Radial ink-run midpoints fit the separate circular features and 4.5-turn spiral. The hub, eye, neck and open outer endpoint are excluded from the spiral samples. A linear fit plus one periodic harmonic regularizes the radial pitch while retaining the small angular asymmetry. Finite width, depth and follower construction remain reconstruction choices.'};
assert.deepEqual(source.axis,circles.shaft.center);assert.deepEqual(source.eye,circles.eye.center);assert.deepEqual(source.spiral,coefficients);
for(const [name,key] of [['disk','diskRadius'],['hub','hubRadius'],['shaft','shaftRadius'],['eye','eyeRadius'],['head','headRadius']])assert.equal(source[key],circles[name].radius);
assert.ok(Math.abs(source.railWidth-spiral.width)<1e-10);
const visual=makeSpiralFeedGeometry(),u=visual.root.userData,f=u.profile,line=f.parameters.map(t=>f.at(t).map((v,i)=>i===0?source.axis[0]+100*v:source.axis[1]-100*v));
const distances=points.map(({p})=>Math.min(...line.slice(1).map((b,i)=>{
  const a=line[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
})));
result.reconstruction={centerlineRmsPixels:Math.sqrt(distances.reduce((s,d)=>s+d*d,0)/distances.length),centerlineMaximumPixels:Math.max(...distances),distances,
  endpointCorrectionPixels:Math.hypot(...line.at(-1).map((v,i)=>v-source.end[i])),diskRecenteringPixels:Math.hypot(...source.axis.map((v,i)=>v-source.diskCenter[i])),
  nominalEyeShiftUpPixels:source.eye[1]-source.axis[1]-100*f.envelope(0).outer.r,eyeHorizontalShiftPixels:source.axis[0]-source.eye[0],
  guideShiftDownPixels:(source.axis[1]-100*u.geometry.guideCenter[1])-(source.guide[1]+source.guide[3])/2,
  rodExtensionPixels:100*(f.envelope(0).outer.r+u.geometry.barEnd)+source.axis[1]-source.barEnd,
  radialPitchPixels:2*Math.PI*source.spiral[1],rollerRadiusPixels:100*f.rollerRadius};
disposeObject3D(visual.root);
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/099-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])));
console.log({...spiral,points:points.length,excluded:excluded.length,residuals:undefined});
console.log({...result.reconstruction,distances:undefined});
