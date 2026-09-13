import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hashStudyFile} from './lib/study-report-io.mjs';
import source from '../src/simulation/mujoco-leadscrew-slide/source.js';
import {makeLeadscrewSlideGeometry} from '../src/simulation/mujoco-leadscrew-slide/geometry.js';
import {threadStations} from '../src/simulation/mujoco-screw/thread-geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const file='public/engravings/mm_103.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runs(p,n,low=-5,high=5) {
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
  ['headLeft',[57,300],[1,0],[270,386]],['headRight',[112,300],[1,0],[270,363]],
  ['headTop',[84,182],[0,1],[62,108]],['baseTop',[225,369],[0,1],[136,368]],['baseBottom',[225,395],[0,1],[65,368]],
  ['railBackTop',[180,293],[0,1],[127,209]],['railBottom',[240,319],[0,1],[136,362]],
  ['neckLeft',[255,230],[1,0],[201,265]],['neckRight',[280,230],[1,0],[201,265]],['neckTop',[268,195],[0,1],[258,276]],
  ['footLeft',[216,293],[1,0],[285,300]],['footRight',[315,293],[1,0],[285,300]],['footBottom',[270,304],[0,1],[222,309]],
  ['crestTop',[230,209],[0,1],[134,370]],['crestBottom',[230,254],[0,1],[134,370]],
  ['coreTop',[230,219],[0,1],[142,370]],['coreBottom',[230,244],[0,1],[142,370]],
]) {
  const points=[];
  for(let j=range[0];j<=range[1];j+=2) {
    if(['crestTop','crestBottom','coreTop','coreBottom'].includes(name)&&j>=248&&j<=289)continue;
    const p=n[0]?[seed[0],j]:[j,seed[1]],r=runs(p,n).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
    if(r!==undefined)points.push(p.map((v,i)=>v+r*n[i]));
  }
  const axis=n[0]?0:1;edges[name]=fit(points,points.map(()=>[1]),points.map(p=>p[axis]));
}
const points=[],rows=[],values=[];
for(let turn=0;turn<=7;turn++)for(const face of [0,1])for(let y=216;y<=249;y+=2) {
  const seed=132+turn*29.8+(y-209)*.46+face*8;
  if(seed>=247&&seed<=291||seed>377)continue;
  const d=runs([seed,y],[1,0],-4,4).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
  if(d!==undefined){points.push({point:[seed+d,y],turn,face});rows.push([1,y-231,turn,face]);values.push(seed+d);}
}
const thread=fit(points,rows,values);
const result={file,sha256:hashStudyFile(file),edges,thread,
  manual:{leftCollar:[46,57,206,261],rightCollar:[116,128,209,260],input:[29,46,218,249],threadRange:[128,383],bedEnd:398,
    haunch:[[216,282],[236,281],[252,278],[255,267],[280,267],[283,279],[298,281],[315,281]],footTop:282},
  qualification:'Independent complete ink-run midpoints. Thread scans follow corresponding front-flank edges; visible crest and core intervals omit the crossing nut. Frame and carriage depth, guide cross-section and cropped right ends require reconstruction.'};
const visual=makeLeadscrewSlideGeometry(),u=visual.root.userData,f=u.profile;
try {
  for(const [n,e] of Object.entries(edges))assert.ok(Math.abs(e.parameters[0]-source.edges[n])<1e-10,n);
  for(let i=0;i<4;i++)assert.ok(Math.abs(thread.parameters[i]-source.thread[i])<1e-10);
  const stations=threadStations(f.external,u.geometry.screwAngles),helix=thread.points.map(({point:[x,y],turn,face})=>{
    const angle=Math.PI-Math.asin((source.axis[1]-y)/(100*f.crestRadius))+turn*2*Math.PI;
    const i=stations.findIndex(s=>s.angle>=angle),a=stations[i-1],b=stations[i],edge=face?'high':'low';assert.ok(a&&b);
    const A=[Math.fround(a[edge]),Math.fround(f.crestRadius*Math.sin(a.angle))],B=[Math.fround(b[edge]),Math.fround(f.crestRadius*Math.sin(b.angle))];
    const t=((source.axis[1]-y)/100-A[1])/(B[1]-A[1]),predicted=source.axis[0]+100*(A[0]+t*(B[0]-A[0]));
    return {point:[x,y],turn,face,predicted,error:predicted-x};
  });
  const registered={};
  for(const [name,part,axis,which] of [['headLeft','headstock','x','min'],['headRight','headstock','x','max'],['headTop','headstock','y','max'],
    ['baseTop','base','y','max'],['baseBottom','base','y','min'],['railBackTop','guide','y','max'],['railBottom','guide','y','min'],
    ['neckTop','carriageBody','y','max'],['footLeft','carriageBody','x','min'],['footRight','carriageBody','x','max'],['footBottom','carriageBody','y','min']]) {
    const mesh=u.parts[part];mesh.geometry.computeBoundingBox();const world=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)[which][axis];
    const predicted=axis==='x'?source.axis[0]+100*world:source.axis[1]-100*world;
    registered[name]={predicted,...stats(edges[name].points.map(p=>predicted-p[axis==='x'?0:1]))};assert.ok(registered[name].maximum<3,name);
  }
  // Independent ink scans from the manually recorded haunch segments. Their
  // distances are measured against the actual finite front silhouette.
  const manual=result.manual.haunch,outline=u.geometry.outline.map(p=>[source.axis[0]+100*(p[0]+f.carriageBase),source.axis[1]-100*p[1]]),haunch=[];
  for(const [start,end] of [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7]]) {
    const a=manual[start],b=manual[end],d=b.map((x,i)=>x-a[i]),length=Math.hypot(...d),n=[-d[1]/length,d[0]/length];
    for(let j=0;j<=10;j++) {
      const seed=a.map((x,i)=>x+d[i]*j/10),r=runs(seed,n,-6,6).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(r===undefined)continue;
      const point=seed.map((x,i)=>x+r*n[i]);let distance=Infinity;
      for(let k=0;k<outline.length;k++){const A=outline[k],B=outline[(k+1)%outline.length],dx=B[0]-A[0],dy=B[1]-A[1],t=Math.max(0,Math.min(1,((point[0]-A[0])*dx+(point[1]-A[1])*dy)/(dx*dx+dy*dy)));distance=Math.min(distance,Math.hypot(point[0]-A[0]-t*dx,point[1]-A[1]-t*dy));}
      haunch.push({point,distance});
    }
  }
  result.reconstruction={registered,helix:{...stats(helix.map(p=>p.error)),points:helix},haunch:{...stats(haunch.map(p=>p.distance)),points:haunch},
    pitchPixels:100*f.pitch,radialClearancePixels:100*f.clearance,
    note:'The right-handed single-start helicoid retains pitch, diameter and thread width; its true front projection replaces the engraving’s straight diagonal exaggeration. Guide depth and cropped ends are reconstructed.'};
  console.log({helix:{rms:result.reconstruction.helix.rms,maximum:result.reconstruction.helix.maximum},haunch:{rms:result.reconstruction.haunch.rms,maximum:result.reconstruction.haunch.maximum,count:haunch.length}});
  assert.ok(result.reconstruction.helix.maximum<6);assert.ok(result.reconstruction.haunch.maximum<4);
}finally{disposeObject3D(visual.root);}
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/103-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(edges).map(([n,r])=>[n,{value:r.parameters[0],rms:r.rms,count:r.points.length}])));console.log({thread:thread.parameters,rms:thread.rms,maximum:thread.maximum,count:thread.points.length});
