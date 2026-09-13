import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {makeScrewPressGeometry} from '../src/simulation/mujoco-screw-press/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/105-source';
const sources=freezeStudySources(['scripts/measure-screw-press-source.mjs','scripts/lib/study-report-io.mjs',
  ...fs.readdirSync('src/simulation/mujoco-screw-press').filter(n=>n.endsWith('.js')).map(n=>'src/simulation/mujoco-screw-press/'+n),
  'src/simulation/mujoco-screw/thread-geometry.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/primitives.js','src/simulation/dispose-model.js','public/engravings/mm_105.png','package-lock.json'],prefix);
const file='public/engravings/mm_105.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
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
  ['hubLeft',[202,145],[1,0],[133,161]],['hubRight',[249,145],[1,0],[133,161]],
  ['hubTop',[226,132],[0,1],[207,246]],['hubBottom',[226,164],[0,1],[207,247]],
  ['nutLeft',[198,260],[1,0],[241,280]],['nutRight',[250,260],[1,0],[241,280]],
  ['flangeLeft',[193,228],[1,0],[225,233]],['flangeRight',[255,229],[1,0],[225,233]],
  ['nutTop',[226,224],[0,1],[200,253]],['upperFlangeBottom',[226,236],[0,1],[199,253]],
  ['lowerFlangeTop',[226,286],[0,1],[198,251]],['nutBottom',[226,299],[0,1],[197,253]],
  ['ramLeft',[199,410],[1,0],[395,430]],['ramRight',[250,410],[1,0],[395,427]],
  ['ramTop',[226,348],[0,1],[206,240]],
  ['guideLeft',[191,375],[1,0],[360,387]],['guideRight',[289,375],[1,0],[360,387]],
  ['guideTop',[267,357],[0,1],[258,283]],['guideBottom',[265,390],[0,1],[194,282]],
  ['frameInner',[290,399],[1,0],[331,437]],['frameOuter',[349,399],[1,0],[290,433]],
  ['crestLeft',[208,325],[1,0],[302,339]],['crestRight',[246,325],[1,0],[302,339]],
]) {
  const points=[];
  for(let j=range[0];j<=range[1];j+=2){const p=n[0]?[seed[0],j]:[j,seed[1]],r=runs(p,n).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(r!==undefined)points.push(p.map((v,i)=>v+r*n[i]));}
  const axis=n[0]?0:1;edges[name]=fit(points,points.map(()=>[1]),points.map(p=>p[axis]));
}
const points=[],rows=[],values=[];
for(let turn=0;turn<=5;turn++)for(const face of [0,1])for(let x=213;x<=241;x+=2){
  const seed=175+turn*28.8-(x-226)*.61+face*10;
  if(seed<167||seed>344||seed>219&&seed<302)continue;
  const r=runs([x,seed],[0,1],-5,5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
  if(r!==undefined){points.push({point:[x,seed+r],turn,face});rows.push([1,x-226,turn,face]);values.push(seed+r);}
}
const thread=fit(points,rows,values),barPoints=[],barRows=[],barValues=[];
for(const face of [0,1])for(let x=100;x<=359;x+=3){
  if(x>=195&&x<=264)continue;const seed=145+face*10-.005*(x-226),r=runs([x,seed],[0,1],-5,5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
  if(r!==undefined){barPoints.push({point:[x,seed+r],face});barRows.push([1,x-226,face]);barValues.push(seed+r);}
}
const bar=fit(barPoints,barRows,barValues),weights={};
for(const [name,c,r] of [['left',[73,151],[17,31]],['right',[386,142],[19,33]]]){
  const points=[];
  for(let degrees=0;degrees<360;degrees+=3){const a=degrees*Math.PI/180,dir=[Math.cos(a),Math.sin(a)],n=[dir[0]/r[0],dir[1]/r[1]],length=Math.hypot(...n);n[0]/=length;n[1]/=length;
    // The handle obscures the ellipse near its horizontal ends.
    if(Math.abs(Math.sin(a))<.25)continue;
    const seed=c.map((v,i)=>v+r[i]*dir[i]),d=runs(seed,n,-5,5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push(seed.map((v,i)=>v+d*n[i]));}
  const f=fit(points,points.map(p=>[(p[0]-c[0])**2,p[0]-c[0],(p[1]-c[1])**2,p[1]-c[1]]),points.map(()=>1));
  const [A,B,C,D]=f.parameters,center=[c[0]-B/(2*A),c[1]-D/(2*C)],k=1+B*B/(4*A)+D*D/(4*C);
  weights[name]={...f,center,radii:[Math.sqrt(k/A),Math.sqrt(k/C)]};
}
const manual={barEnds:[49,417],coreEdges:[215,240],threadRange:[166,343],ramBottom:442,
  frameOuter:[[254,223],[286,223],[311,227],[333,237],[344,254],[349,279],[349,443]],
  frameInner:[[254,298],[270,298],[282,305],[289,323],[290,452]],
  ramCap:[198,251,348,356],topCap:[216,237,118,132]};
const result={file,sha256:hashStudyFile(file),edges,thread,bar,weights,manual,
  qualification:'Independent complete ink-run midpoints on manually selected visible edges. Drawn frame depth, ellipse perspective, hidden threaded bore, swivel, lower frame and anvil require reconstruction.'};
const stats=values=>({rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),maximum:Math.max(...values.map(Math.abs)),count:values.length,residuals:values});
const nearest=(point,contour)=>Math.min(...contour.map((a,i)=>{
  const b=contour[(i+1)%contour.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
  const t=l2?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/l2)):0;
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}));
const visual=makeScrewPressGeometry(),u=visual.root.userData,f=u.profile;
try {
  assert.equal(result.sha256,u.source.sha256);
  for(const [name,edge] of Object.entries(edges))assert.ok(Math.abs(edge.parameters[0]-u.source.edges[name])<1e-10);
  assert.ok(Math.abs(100*f.pitch-thread.parameters[2])<1e-10);
  const registered={};
  for(const [name,part,axis,which] of [['hubLeft','head','x','min'],['hubRight','head','x','max'],['hubTop','head','y','max'],['hubBottom','head','y','min'],
    ['flangeLeft','nutHousing','x','min'],['flangeRight','nutHousing','x','max'],['nutTop','nutHousing','y','max'],['nutBottom','nutHousing','y','min'],
    ['ramLeft','ram','x','min'],['ramRight','ram','x','max'],['ramTop','ramCap','y','max'],
    ['guideLeft','guide','x','min'],['guideRight','guide','x','max'],['guideTop','guide','y','max'],['guideBottom','guide','y','min'],
    ['frameOuter','frame','x','max'],['crestLeft','externalThread','x','min'],['crestRight','externalThread','x','max']]) {
    const g=u.parts[part].geometry;g.computeBoundingBox();const value=g.boundingBox[which][axis];
    const predicted=axis==='x'?f.axis[0]+100*value:f.axis[1]-100*value;
    registered[name]={predicted,...stats(edges[name].points.map(p=>predicted-p[axis==='x'?0:1]))};
  }
  // Read real crest boundaries from flank triangles, excluding diagonals on
  // the cylindrical crest faces. Intersect those polylines at each ink column.
  const geometry=u.parts.externalThread.geometry,p=geometry.attributes.position,n=geometry.attributes.normal,crestEdges=[];
  for(let i=0;i<p.count;i+=3) {
    if(Math.abs(n.getY(i))+Math.abs(n.getY(i+1))+Math.abs(n.getY(i+2))<.1)continue;
    for(let j=0;j<3;j++) {
      const a=i+j,b=i+(j+1)%3;
      if([a,b].every(k=>p.getZ(k)>=-1e-7&&Math.abs(Math.hypot(p.getX(k),p.getZ(k))-f.crestRadius)<1e-7))
        crestEdges.push([[p.getX(a),p.getY(a)],[p.getX(b),p.getY(b)]]);
    }
  }
  const helix=thread.points.map(sample=>{
    const [x,y]=sample.point,targetX=f.x(x);let error=Infinity,predicted;
    for(const [a,b] of crestEdges) {
      const t=(targetX-a[0])/(b[0]-a[0]);if(t<0||t>1||!Number.isFinite(t))continue;
      const candidate=f.axis[1]-100*(a[1]+t*(b[1]-a[1]));
      if(Math.abs(candidate-y)<Math.abs(error)){error=candidate-y;predicted=candidate;}
    }
    return{...sample,predicted,error};
  });
  const outline=u.frameContour.map(([x,y])=>[f.axis[0]+100*x,f.axis[1]-100*y]),frame=[];
  for(const path of [manual.frameInner,manual.frameOuter])for(let i=0;i<path.length-1;i++) {
    const a=path[i],b=path[i+1],d=b.map((v,k)=>v-a[k]),length=Math.hypot(...d),normal=[-d[1]/length,d[0]/length];
    const count=Math.ceil(length/3);
    for(let j=0;j<=count;j++) {
      const seed=a.map((v,k)=>v+d[k]*j/count),r=runs(seed,normal,-6,6).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
      if(r===undefined)continue;const point=seed.map((v,k)=>v+r*normal[k]);frame.push({point,distance:nearest(point,outline)});
    }
  }
  const weightFits={};
  for(const [name,w] of Object.entries(weights)) {
    const p=u.parts[name+'Weight'].geometry.attributes.position,cx=f.x(w.center[0]),points=[];
    for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i))<1e-7)points.push([p.getX(i),p.getY(i)]);
    const contour=[...new Map(points.map(p=>[p.map(x=>x.toFixed(8)).join(','),p])).values()]
      .sort((a,b)=>Math.atan2(a[1]-f.barY,a[0]-cx)-Math.atan2(b[1]-f.barY,b[0]-cx))
      .map(([x,y])=>[f.axis[0]+100*x,f.axis[1]-100*y]);
    weightFits[name]={centerShiftY:f.axis[1]-100*f.barY-w.center[1],...stats(w.points.map(p=>nearest(p,contour)))};
  }
  result.reconstruction={registered,helix:{...stats(helix.map(p=>p.error)),points:helix},frame:{...stats(frame.map(p=>p.distance)),points:frame},
    weights:weightFits,pitchPixels:100*f.pitch,strokePixels:100*(f.ramBottom-f.workTop),
    note:'Flat orthographic registration. The head, nut and ram are made coaxial; the weights are centered on one straight handle. True helices replace drawn diagonals. The drawn perspective, hidden bearings, key, depths, lower frame, anvil and blank are reconstructed.'};
  console.log({helix:stats(helix.map(p=>p.error)),frame:stats(frame.map(p=>p.distance)),weights:weightFits});
}finally{disposeObject3D(visual.root);}
verifyStudySources(sources);result.sources=sources;
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({edges:Object.fromEntries(Object.entries(edges).map(([n,e])=>[n,{value:e.parameters[0],rms:e.rms,count:e.points.length}])),thread:{parameters:thread.parameters,rms:thread.rms,maximum:thread.maximum,count:thread.points.length},
  bar:{parameters:bar.parameters,rms:bar.rms},weights:Object.fromEntries(Object.entries(weights).map(([n,w])=>[n,{center:w.center,radii:w.radii,count:w.points.length}]))});
