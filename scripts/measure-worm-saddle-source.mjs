import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {makeWormSaddleGeometry} from '../src/simulation/mujoco-worm-saddle/geometry.js';
import {saddleWheelCut} from '../src/simulation/mujoco-worm-saddle/wheel-data.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/104-source';
const sources=freezeStudySources(['scripts/measure-worm-saddle-source.mjs','public/engravings/mm_104.png',
  ...['profile.js','geometry.js','wheel-data.js'].map(n=>'src/simulation/mujoco-worm-saddle/'+n),
  'src/simulation/worm-gear-geometry.js','src/simulation/finite-plate-geometry.js'],prefix);

const file='public/engravings/mm_104.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
assert.equal(bytes.length,525*525);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runs(p,n,low=-5,high=5) {
  const values=[];let start;
  for(let r=low;r<=high+.01;r+=.2){const ink=pixel(p[0]+r*n[0],p[1]+r*n[1])<110;
    if(ink&&start===undefined)start=r;
    if(!ink&&start!==undefined){if(start>low+.01&&r-start<=8)values.push((start+r-.2)/2);start=undefined;}}
  return values;
}
function solve(a) {
  for(let i=0;i<a.length;i++) {
    let pivot=i;for(let j=i+1;j<a.length;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];assert.ok(Math.abs(d)>1e-9);
    for(let j=i;j<=a.length;j++)a[i][j]/=d;
    for(let j=0;j<a.length;j++)if(i!==j){const f=a[j][i];for(let k=i;k<=a.length;k++)a[j][k]-=f*a[i][k];}
  }return a.map(row=>row.at(-1));
}
function fit(points,rows,values) {
  const n=rows[0].length,a=Array.from({length:n},()=>Array(n+1).fill(0));
  rows.forEach((r,k)=>{for(let i=0;i<n;i++){for(let j=0;j<n;j++)a[i][j]+=r[i]*r[j];a[i][n]+=r[i]*values[k];}});
  const parameters=solve(a),residuals=values.map((v,k)=>v-rows[k].reduce((s,x,i)=>s+x*parameters[i],0));
  return {parameters,points,residuals,rms:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/residuals.length),maximum:Math.max(...residuals.map(Math.abs))};
}
const edges={};
for(const [name,seed,n,range] of [
  ['footLeft',[185,398],[1,0],[387,409]],['footRight',[313,398],[1,0],[387,409]],
  ['footTop',[250,383],[0,1],[189,308]],['footBottom',[250,413],[0,1],[189,308]],
  ['bedTop',[150,391],[0,1],[108,179]],['bedBottom',[245,425],[0,1],[108,370]],
  ['crestTop',[250,152],[0,1],[98,415]],['crestBottom',[250,207],[0,1],[100,431]],
  ['coreTop',[250,164],[0,1],[108,415]],['coreBottom',[250,195],[0,1],[110,429]],
]) {
  const points=[];
  for(let j=range[0];j<=range[1];j+=2){
    if(name==='footTop'&&j>204&&j<284||name==='crestBottom'&&j>180&&j<308)continue;
    const p=n[0]?[seed[0],j]:[j,seed[1]],r=runs(p,n).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
    if(r!==undefined)points.push(p.map((v,i)=>v+r*n[i]));
  }
  const axis=n[0]?0:1;edges[name]=fit(points,points.map(()=>[1]),points.map(p=>p[axis]));
}
const points=[],rows=[],values=[];
for(let turn=0;turn<=10;turn++)for(const face of [0,1])for(let y=165;y<=194;y+=2) {
  const seed=100+turn*30.5+(y-152)*.50+face*8;
  if(seed>432)continue;
  const r=runs([seed,y],[1,0],-5,5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
  if(r!==undefined){points.push({point:[seed+r,y],turn,face});rows.push([1,y-180,turn,face]);values.push(seed+r);}
}
const thread=fit(points,rows,values),circles={};
for(const [name,center,radius,arcs] of [
  ['wheelTip',[243.5,285.5],90,[[12,18],[32,37],[53,57],[134,140],[151,158],[168,175],[185,191],[201,207],[218,224],[313,319],[332,337],[351,357]]],
  ['wheelRoot',[243.5,285.5],75,[[1,6],[23,27],[43,47],[146,149],[162,164],[179,181],[195,197],[211,213],[227,229],[325,327],[342,345]]],
  ['bearing',[243,285],24,[[182,355]]],['shaft',[243,285],16,[[0,359]]],
]) {
  const samples=[];
  for(const [low,high] of arcs)for(let degrees=low;degrees<=high;degrees+=1.5){
    const a=degrees*Math.PI/180,n=[Math.cos(a),Math.sin(a)],p=center.map((v,i)=>v+radius*n[i]);
    const r=runs(p,n,-4,4).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(r!==undefined)samples.push(p.map((v,i)=>v+r*n[i]));
  }circles[name]=circleFit(samples);
}
const silhouette=[];
for(const [low,high] of [[0,58],[128,230],[311,359]])for(let degrees=low;degrees<=high;degrees+=.5){
  const a=degrees*Math.PI/180,n=[Math.cos(a),Math.sin(a)],center=circles.wheelTip.center;
  const offsets=runs(center,n,66,99);if(offsets.length)silhouette.push({degrees,point:center.map((v,i)=>v+offsets.at(-1)*n[i]),radius:offsets.at(-1)});
}
const result={file,sha256:hashStudyFile(file),edges,thread,circles,silhouette,
  manual:{threadRange:[80,442],bedRange:[90,387],pedestal:[[207,383],[216,361],[220,294],[221,275],[244,261],[265,275],[270,336],[276,372],[285,383]],rib:[[235,311],[235,365],[230,382],[256,382],[249,370],[248,312]]},
  qualification:'Complete ink-run midpoints from manually selected unoccluded intervals. The drawn wheel spacing is irregular; the hidden tooth count, pitch compatibility, depth and bearings require reconstruction. Silhouette samples are independent of any candidate gear profile.'};
const stats=values=>({rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),maximum:Math.max(...values.map(Math.abs)),residuals:values});
const visual=makeWormSaddleGeometry(saddleWheelCut),u=visual.root.userData,f=u.profile;
try {
  assert.ok(Math.abs(100*f.pitch-thread.parameters[2])<1e-10);
  const registered={};
  for(const [name,part,axis,which] of [['footLeft','foot','x','min'],['footRight','foot','x','max'],
    ['footTop','foot','y','max'],['footBottom','foot','y','min'],['bedTop','bed','y','max'],['bedBottom','bed','y','min'],
    ['crestTop','worm','y','max'],['crestBottom','worm','y','min'],['coreTop','leftJournal','y','max'],['coreBottom','leftJournal','y','min']]) {
    const mesh=u.parts[part];mesh.geometry.computeBoundingBox();const world=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)[which][axis];
    const predicted=axis==='x'?f.axis[0]+100*world:f.axis[1]-100*world;
    registered[name]={predicted,...stats(edges[name].points.map(p=>predicted-p[axis==='x'?0:1]))};
    assert.ok(Math.abs(predicted-edges[name].parameters[0])<.5,name);
  }
  // Intersect the actual triangulated, front-facing crest edges with each
  // measured raster row. Compare the closest repeated crest, not a fitted law.
  const p=u.parts.worm.geometry.attributes.position,crestEdges=[];
  for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
    const a=i+j,b=i+(j+1)%3;
    if([a,b].every(k=>p.getZ(k)>=-1e-7&&Math.abs(Math.hypot(p.getY(k),p.getZ(k))-f.wormTip)<1e-7))
      crestEdges.push([[p.getX(a),p.getY(a)],[p.getX(b),p.getY(b)]]);
  }
  const helix=thread.points.map(({point:[x,y],turn,face})=>{
    const targetY=(f.axis[1]-y)/100-f.distance;let error=Infinity,predicted;
    for(const [a,b] of crestEdges){const t=(targetY-a[1])/(b[1]-a[1]);if(t<0||t>1||!Number.isFinite(t))continue;
      const candidate=f.axis[0]+100*(a[0]+t*(b[0]-a[0]));if(Math.abs(candidate-x)<Math.abs(error)){error=candidate-x;predicted=candidate;}}
    return {point:[x,y],turn,face,predicted,error};
  });
  const outline=u.outline.map(([x,y])=>[f.axis[0]+100*x,f.axis[1]-100*y]);
  const nearest=(point,contour)=>Math.min(...contour.map((a,i)=>{const b=contour[(i+1)%contour.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
    const t=l2?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/l2)):0;return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);}));
  const pedestal=[];
  for(let i=0;i<result.manual.pedestal.length-1;i++){
    // The two chords across the rounded cap pass through the shaft ink.
    // Use the independent radial bearing samples for that cap instead.
    if(i===3||i===4)continue;
    const a=result.manual.pedestal[i],b=result.manual.pedestal[i+1],d=b.map((v,k)=>v-a[k]),length=Math.hypot(...d),n=[-d[1]/length,d[0]/length];
    for(let j=0;j<=10;j++){const seed=a.map((v,k)=>v+d[k]*j/10),r=runs(seed,n,-6,6).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(r===undefined)continue;
      const point=seed.map((v,k)=>v+r*n[k]);pedestal.push({point,distance:nearest(point,outline)});}
  }
  for(const point of circles.bearing.points)pedestal.push({point,distance:nearest(point,outline)});
  // The full front silhouette is the radial union of all finite axial rows.
  const wp=u.parts.wheel.geometry.attributes.position,n=saddleWheelCut.angularSteps*f.teeth,stride=n+1;
  const wheelContour=[];
  for(let i=0;i<n;i++){
    let radius=0;for(let j=0;j<=saddleWheelCut.axialSteps;j++)radius=Math.max(radius,Math.hypot(wp.getX(j*stride+i),wp.getY(j*stride+i)));
    const angle=Math.atan2(wp.getY(i),wp.getX(i));wheelContour.push([f.axis[0]+100*radius*Math.cos(angle),f.axis[1]-100*radius*Math.sin(angle)]);
  }
  const wheel=silhouette.map(sample=>{
    const a=-sample.degrees*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a);let radius=0;
    const theta=((a-u.wheelAngle+Math.PI/f.teeth)%(2*Math.PI)+2*Math.PI)%(2*Math.PI),i=Math.min(n-1,Math.floor(theta/(2*Math.PI)*n));
    for(let j=0;j<=saddleWheelCut.axialSteps;j++){
      const A=j*stride+i,B=A+1,ax=wp.getX(A),ay=wp.getY(A),bx=wp.getX(B),by=wp.getY(B);
      const r=(ax*by-ay*bx)/(dx*(by-ay)-dy*(bx-ax));radius=Math.max(radius,r);
    }
    return {...sample,predicted:100*radius,error:100*radius-sample.radius,contourDistance:nearest(sample.point,wheelContour)};
  });
  result.reconstruction={registered,helix:{...stats(helix.map(p=>p.error)),points:helix},pedestal:{...stats(pedestal.map(p=>p.distance)),points:pedestal},
    wheel:{...stats(wheel.map(p=>p.error)),points:wheel,nearestContour:stats(wheel.map(p=>p.contourDistance))},pitchPixels:100*f.pitch,teeth:f.teeth,
    note:'The 18-tooth compatible wheel corrects irregular drawn spacing. The helical crest replaces drawn straight diagonals. Root relief, 20-degree flanks, depths, complete ends, ideal bearings and guide are reconstructed.'};
  console.log(Object.fromEntries(['helix','pedestal','wheel'].map(n=>[n,{rms:result.reconstruction[n].rms,maximum:result.reconstruction[n].maximum,count:result.reconstruction[n].points.length}])));
  assert.ok(result.reconstruction.helix.maximum<7);
  assert.ok(result.reconstruction.pedestal.maximum<5);
}finally{disposeObject3D(visual.root);}
verifyStudySources(sources);result.sources=sources;
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({edges:Object.fromEntries(Object.entries(edges).map(([n,e])=>[n,{value:e.parameters[0],rms:e.rms,count:e.points.length}])),
  circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])),
  thread:{parameters:thread.parameters,rms:thread.rms,maximum:thread.maximum,count:thread.points.length},silhouette:silhouette.length});
