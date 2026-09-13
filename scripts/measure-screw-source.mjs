import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hashStudyFile} from './lib/study-report-io.mjs';
import source from '../src/simulation/mujoco-screw/source.js';
import {makeScrewGeometry} from '../src/simulation/mujoco-screw/geometry.js';
import {threadStations} from '../src/simulation/mujoco-screw/thread-geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

const file='public/engravings/mm_102.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runs(p,n,low=-6,high=6) {
  const values=[];let start;
  for(let r=low;r<=high+.01;r+=.2) {
    const ink=pixel(p[0]+r*n[0],p[1]+r*n[1])<110;
    if(ink&&start===undefined)start=r;
    if(!ink&&start!==undefined){if(start>low+.01&&r-start<=8)values.push((start+r-.2)/2);start=undefined;}
  }
  return values;
}
function solve(a) {
  for(let i=0;i<a.length;i++) {
    let pivot=i;for(let j=i+1;j<a.length;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];for(let j=i;j<=a.length;j++)a[i][j]/=d;
    for(let j=0;j<a.length;j++)if(i!==j){const f=a[j][i];for(let k=i;k<=a.length;k++)a[j][k]-=f*a[i][k];}
  }
  return a.map(r=>r.at(-1));
}
const stats=values=>({rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),maximum:Math.max(...values.map(Math.abs)),residuals:values});
function fit(points,rows,values) {
  const n=rows[0].length,a=Array.from({length:n},()=>Array(n+1).fill(0));
  rows.forEach((r,k)=>{for(let i=0;i<n;i++){for(let j=0;j<n;j++)a[i][j]+=r[i]*r[j];a[i][n]+=r[i]*values[k];}});
  const parameters=solve(a),errors=values.map((v,k)=>v-rows[k].reduce((s,x,i)=>s+x*parameters[i],0));return {parameters,points,...stats(errors)};
}
const edges={};
for(const [name,seed,n,range] of [
  ['headLeft',[164,160],[1,0],[144,181]],['headRight',[291,160],[1,0],[144,181]],
  ['headFrontLeft',[196,160],[1,0],[144,181]],['headFrontRight',[263,160],[1,0],[144,181]],
  ['headTop',[227,130],[0,1],[202,257]],['headBottom',[227,188],[0,1],[202,257]],
  ['nutLeft',[164,439],[1,0],[424,453]],['nutRight',[289,439],[1,0],[424,453]],
  ['nutFrontLeft',[195,439],[1,0],[424,453]],['nutFrontRight',[262,439],[1,0],[424,453]],
  ['nutTop',[227,409],[0,1],[205,251]],['nutBottom',[227,466],[0,1],[205,251]],
  ['crestLeft',[188,300],[1,0],[197,404]],['crestRight',[267,300],[1,0],[197,404]],
]) {
  const points=[];
  for(let j=range[0];j<=range[1];j+=2) {
    const p=n[0]?[seed[0],j]:[j,seed[1]],r=runs(p,n,-5,5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
    if(r!==undefined)points.push(p.map((v,i)=>v+r*n[i]));
  }
  const axis=n[0]?0:1;edges[name]=fit(points,points.map(()=>[1]),points.map(p=>p[axis]));
}
const points=[],rows=[],values=[];
for(let turn=0;turn<=6;turn++)for(const face of [0,1])for(let x=205;x<=251;x+=2) {
  if(turn===6&&face===1)continue; // last lower edge is hidden behind the nut
  const seed=219.5+turn*30+(x-227)*.5+face*12;
  if(seed>=404)continue;
  const d=runs([x,seed],[0,1]).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
  if(d!==undefined){points.push({point:[x,seed+d],turn,face});rows.push([1,x-227,turn,face]);values.push(seed+d);}
}
const thread=fit(points,rows,values);
const hexagons={};
for(const name of ['head','nut']) {
  const labels=['Left','FrontLeft','FrontRight','Right'],rows=[[1,-1,0],[1,-.5,Math.sqrt(3)/2],[1,.5,Math.sqrt(3)/2],[1,1,0]];
  const points=labels.flatMap(s=>edges[name+s].points),r=fit(points,labels.flatMap((s,i)=>edges[name+s].points.map(()=>rows[i])),points.map(p=>p[0]));
  const [center,a,b]=r.parameters;hexagons[name]={...r,center,radius:Math.hypot(a,b),phase:Math.atan2(b,a)};
}
const result={file,sha256:hashStudyFile(file),edges,thread,hexagons,
  manual:{coreEdges:[199,254],tip:[227,479],headChamfer:10,nutChamfer:10},
  qualification:'Independent complete ink-run midpoints fit the head, nut, thread crest width and repeated drawn flank edges. The final partial thread is masked where the nut hides it. The engraving draws near-straight diagonal flanks; a physical helix must also be checked against those readings, rather than treating this planar fit as a thread model.'};
// Compare corresponding edges, not the nearest neighboring turn: the latter
// would conceal the engraving's exaggerated diagonal slope.
const visual=makeScrewGeometry(),u=visual.root.userData,f=u.profile;
try {
  for(let i=0;i<4;i++)assert.ok(Math.abs(source.thread[i]-thread.parameters[i])<1e-10);
  for(const name of ['head','nut'])for(const key of ['radius','phase'])assert.ok(Math.abs(source[name][key]-hexagons[name][key])<1e-10);
  const stations=threadStations(f.external,u.geometry.screwAngles);
  const helix=thread.points.map(({point:[x,y],turn,face})=>{
    const angle=-Math.acos((x-source.axis[0])/(100*f.crestRadius))+turn*2*Math.PI;
    const i=stations.findIndex(s=>s.angle>=angle),a=stations[i-1],b=stations[i],edge=face?'low':'high';
    assert.ok(a&&b);
    const A=[Math.fround(f.crestRadius*Math.cos(a.angle)),Math.fround(a[edge])],B=[Math.fround(f.crestRadius*Math.cos(b.angle)),Math.fround(b[edge])];
    const t=((x-source.axis[0])/100-A[0])/(B[0]-A[0]),predicted=source.axis[1]-100*(A[1]+t*(B[1]-A[1]));
    return {point:[x,y],turn,face,predicted,error:predicted-y};
  });
  const hexFits={};
  for(const name of ['head','nut']) {
    const p=f[name],a=100*p.radius*Math.cos(p.phase),b=100*p.radius*Math.sin(p.phase),predicted=[-a,-a/2+Math.sqrt(3)*b/2,a/2+Math.sqrt(3)*b/2,a].map(x=>x+source.axis[0]);
    hexFits[name]=stats(['Left','FrontLeft','FrontRight','Right'].flatMap((s,i)=>edges[name+s].points.map(p=>predicted[i]-p[0])));
    assert.ok(hexFits[name].maximum<3);
  }
  result.reconstruction={hexFits,helix:{...stats(helix.map(p=>p.error)),points:helix},nutAxisCorrectionPixels:source.axis[0]-hexagons.nut.center,
    pitchPixels:100*f.pitch,threadWidthPixels:100*f.external.width,radialClearancePixels:100*f.clearance,
    note:'The single-start left-handed helix retains the drawn direction, pitch and diameter. Its physical front projection is shallower than the exaggerated straight diagonal engraving. The nut is recentered on the head axis.'};
  assert.ok(result.reconstruction.helix.maximum<12);
  console.log({reconstructedHex:hexFits,helixRms:result.reconstruction.helix.rms,helixMaximum:result.reconstruction.helix.maximum});
}finally{disposeObject3D(visual.root);}
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/102-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(edges).map(([n,r])=>[n,{value:r.parameters[0],rms:r.rms,count:r.points.length}])));
console.log({thread:thread.parameters,rms:thread.rms,maximum:thread.maximum,count:thread.points.length});
console.log(Object.fromEntries(Object.entries(hexagons).map(([n,h])=>[n,{center:h.center,radius:h.radius,phase:h.phase,rms:h.rms,maximum:h.maximum}])));
