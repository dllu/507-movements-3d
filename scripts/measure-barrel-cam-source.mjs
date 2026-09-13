import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {makeBarrelCamGeometry} from '../src/simulation/mujoco-barrel-cam/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {poly,polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/106-source';
const sources=freezeStudySources(['scripts/measure-barrel-cam-source.mjs','scripts/lib/study-report-io.mjs',
  ...fs.readdirSync('src/simulation/mujoco-barrel-cam').filter(n=>n.endsWith('.js')).map(n=>'src/simulation/mujoco-barrel-cam/'+n),
  'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js',
  'src/simulation/dispose-model.js','public/engravings/mm_106.png','package-lock.json'],prefix);
const file='public/engravings/mm_106.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
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
for(const [name,seed,n,ranges] of [
  ['ceilingBottom',[265,138],[0,1],[[110,425]]],
  ['barrelLeft',[239,333],[1,0],[[264,410]]],['barrelRight',[321,333],[1,0],[[264,414]]],
  ['barrelTop',[280,238],[0,1],[[240,255],[277,317]]],['barrelBottom',[280,429],[0,1],[[242,275],[306,318]]],
  ['shaftTop',[210,320],[0,1],[[183,234],[325,364]]],['shaftBottom',[210,348],[0,1],[[183,234],[325,366]]],
  ['rodTop',[210,194],[0,1],[[125,160],[188,246],[279,347],[376,388]]],
  ['rodBottom',[210,207],[0,1],[[125,160],[188,246],[279,347],[376,388]]],
  ['leftGuideLeft',[165,180],[1,0],[[142,190],[211,220]]],['leftGuideRight',[185,180],[1,0],[[142,190],[211,220]]],
  ['rightGuideLeft',[350,180],[1,0],[[142,190],[211,220]]],['rightGuideRight',[373,180],[1,0],[[142,190],[211,220]]],
  ['leftGuideBottom',[175,223],[0,1],[[166,182]]],['rightGuideBottom',[361,220],[0,1],[[352,369]]],
  ['headLeft',[251,200],[1,0],[[188,209]]],['headRight',[275,200],[1,0],[[188,209]]],['headTop',[263,186],[0,1],[[253,272]]],
]) {
  const points=[];
  for(const [low,high] of ranges)for(let j=low;j<=high;j+=2){const p=n[0]?[seed[0],j]:[j,seed[1]],d=runs(p,n).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push(p.map((v,i)=>v+d*n[i]));}
  edges[name]=fit(points,points.map(()=>[1]),points.map(p=>p[n[0]?0:1]));
}
const manual={ceiling:[104,430,92,138],rodEnds:[123,391],shaftEnds:[168,375],
  follower:[[251,186],[274,185],[275,210],[270,217],[268,227],[269,237],[272,244],[267,253],[259,245],[263,235],[264,222],[258,215],[251,210]],
  grooveLeft:[[248,240],[264,260],[272,290],[274,333],[272,373],[272,398],[280,423]],
  grooveRight:[[269,250],[287,274],[293,300],[294,329],[291,368],[292,394],[302,423]]};
const groove={};
for(const side of ['Left','Right']) {
  const path=manual['groove'+side],points=[];
  for(let i=0;i<path.length-1;i++) {
    const a=path[i],b=path[i+1];
    for(let y=a[1];y<b[1];y+=2){const x=a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]),d=runs([x,y],[1,0],-6,6).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push([x+d,y]);}
  }
  groove[side.toLowerCase()]=points;
}
const eye=[];
for(let degrees=0;degrees<360;degrees+=5){const a=degrees*Math.PI/180,n=[Math.cos(a),Math.sin(a)],p=[263.5+4.8*n[0],201+4.8*n[1]],d=runs(p,n,-3,3).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)eye.push(p.map((v,i)=>v+d*n[i]));}
const eyeFit=fit(eye,eye.map(([x,y])=>[2*x,2*y,1]),eye.map(([x,y])=>x*x+y*y));
const [cx,cy,k]=eyeFit.parameters;const pin={center:[cx,cy],radius:Math.sqrt(k+cx*cx+cy*cy),points:eye};
const result={file,sha256:hashStudyFile(file),edges,manual,groove,pin,
  qualification:'Independent complete ink-run midpoints selected along visible edges. Groove measurements are source observations, not a prescribed motion law. Depth, groove section, hidden supports and follower attachment need reconstruction.'};
const radius=(edges.barrelBottom.parameters[0]-edges.barrelTop.parameters[0])/2,axisY=(edges.barrelBottom.parameters[0]+edges.barrelTop.parameters[0])/2;
const samples=Object.entries(groove).flatMap(([side,points])=>points.map(([x,y])=>({x,y,side:side==='left'?0:1,angle:Math.acos(Math.max(-1,Math.min(1,(axisY-y)/radius)))})));
let uniform;
for(let degrees=0;degrees<=180;degrees++) {
  const phase=degrees*Math.PI/180,rows=samples.map(p=>{
    const a=((p.angle+phase)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);return[1,Math.min(a,2*Math.PI-a),p.side];
  });
  const candidate=fit(samples,rows,samples.map(p=>p.x));
  if(!uniform||candidate.rms<uniform.rms)uniform={...candidate,phase,degrees};
}
const [intercept,slope,width]=uniform.parameters;
result.uniformFit={minimum:intercept+width/2,stroke:slope*Math.PI,width,phase:uniform.phase,rms:uniform.rms,maximum:uniform.maximum,
  qualification:'Positive-slope piecewise-linear pitch law, searched at one-degree assembly phases. The source groove is irregular; the reconstruction preserves a uniform working stroke.'};
const stats=values=>({rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),maximum:Math.max(...values.map(Math.abs)),count:values.length,residuals:values});
const nearest=(point,contour)=>Math.min(...contour.map((a,i)=>{
  const b=contour[(i+1)%contour.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
  const t=l2?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/l2)):0;
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}));
const visual=makeBarrelCamGeometry(),u=visual.root.userData,f=u.profile;
try {
  assert.equal(result.sha256,u.source.sha256);
  for(const [key,value] of Object.entries(u.source.uniformFit))assert.ok(Math.abs(result.uniformFit[key]-value)<1e-8,key);
  const registered={};
  for(const [name,part,axis,which] of [['barrelLeft','leftLand','x','min'],['barrelRight','rightLand','x','max'],['barrelTop','leftLand','y','max'],['barrelBottom','leftLand','y','min'],
    ['ceilingBottom','header','y','min'],['shaftTop','shaft','y','max'],['shaftBottom','shaft','y','min'],['rodTop','rod','y','max'],['rodBottom','rod','y','min'],
    ['leftGuideLeft','leftGuide','x','min'],['leftGuideRight','leftGuide','x','max'],['rightGuideLeft','rightGuide','x','min'],['rightGuideRight','rightGuide','x','max'],
    ['leftGuideBottom','leftGuide','y','min'],['rightGuideBottom','rightGuide','y','min'],['headLeft','head','x','min'],['headRight','head','x','max'],['headTop','head','y','max']]) {
    const g=u.parts[part].geometry;g.computeBoundingBox();const v=g.boundingBox[which][axis],predicted=axis==='x'?f.axis[0]+100*v:f.axis[1]-100*v;
    registered[name]={predicted,...stats(edges[name].points.map(p=>predicted-p[axis==='x'?0:1]))};
  }
  const faces=[];
  for(const [side,name,sign] of [['left','leftLand',1],['right','rightLand',-1]]) {
    const g=u.parts[name].geometry,p=g.attributes.position,n=g.attributes.normal,creases=[];
    for(let i=0;i<p.count;i+=3) {
      if(sign*n.getX(i)<.5)continue;
      for(let j=0;j<3;j++) {
        const a=i+j,b=i+(j+1)%3;
        if([a,b].every(k=>p.getZ(k)>=-1e-7&&Math.abs(Math.hypot(p.getY(k),p.getZ(k))-f.radius)<1e-7))creases.push([[p.getX(a),p.getY(a)],[p.getX(b),p.getY(b)]]);
      }
    }
    for(const point of groove[side]) {
      const target=f.y(point[1]);let error=Infinity,predicted;
      for(const [a,b] of creases){const t=(target-a[1])/(b[1]-a[1]);if(t<0||t>1||!Number.isFinite(t))continue;const x=f.axis[0]+100*(a[0]+t*(b[0]-a[0]));if(Math.abs(x-point[0])<Math.abs(error)){predicted=x;error=x-point[0];}}
      faces.push({side,point,predicted,error});
    }
  }
  const p=u.parts.shoe.geometry.attributes.position,center=[f.initialTip,(f.pinLow+f.pinHigh)/2],points=[];
  for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i))<1e-7)points.push([p.getX(i),p.getY(i)]);
  const shoe=[...new Map(points.map(p=>[p.map(v=>v.toFixed(8)).join(','),p])).values()]
    .sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
  const silhouette=clip.union(poly(u.headContour),poly(shoe))[0][0].slice(0,-1).map(([x,y])=>[f.axis[0]+100*x,f.axis[1]-100*y]),follower=[];
  for(let i=0;i<manual.follower.length;i++) {
    const a=manual.follower[i],b=manual.follower[(i+1)%manual.follower.length],d=b.map((v,k)=>v-a[k]),length=Math.hypot(...d),n=[-d[1]/length,d[0]/length],count=Math.ceil(length/2);
    for(let j=0;j<=count;j++){const seed=a.map((v,k)=>v+d[k]*j/count),r=runs(seed,n,-5,5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(r===undefined)continue;const point=seed.map((v,k)=>v+r*n[k]);follower.push({point,distance:nearest(point,silhouette)});}
  }
  result.reconstruction={registered,groove:{...stats(faces.map(p=>p.error)),points:faces},follower:{...stats(follower.map(p=>p.distance)),points:follower},
    note:'The cam uses a regular piecewise-linear pitch law with short C2 reversals. The corrected groove and rounded working pin differ from the drawn outlines. The upper rod is reconstructed as the guided output, rigidly attached to the follower head.'};
  console.log({uniformFit:result.uniformFit,groove:stats(faces.map(p=>p.error)),follower:stats(follower.map(p=>p.distance))});
}finally{disposeObject3D(visual.root);}
verifyStudySources(sources);result.sources=sources;
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({edges:Object.fromEntries(Object.entries(edges).map(([name,e])=>[name,{value:e.parameters[0],rms:e.rms,count:e.points.length}])),pin:{center:pin.center,radius:pin.radius},groove:Object.fromEntries(Object.entries(groove).map(([name,points])=>[name,points.filter((p,i)=>i%10===0)]))});
