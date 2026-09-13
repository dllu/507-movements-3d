import fs from 'node:fs';
import {makeSerpentineCamGeometry} from '../src/simulation/mujoco-serpentine-cam/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {poly,polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/107-source';
const sources=freezeStudySources([
  ...['src/simulation/mujoco-serpentine-cam','src/simulation/mujoco-barrel-cam'].flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n)),'scripts/measure-serpentine-cam-source.mjs','scripts/lib/study-report-io.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js',
  'src/simulation/dispose-model.js','public/engravings/mm_107.png','package-lock.json'],prefix);
const file='public/engravings/mm_107.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
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
 ['ceilingBottom',[265,138],[0,1],[[101,393]]],
 ['barrelLeft',[228,333],[1,0],[[252,423]]],['barrelRight',[306,333],[1,0],[[246,427]]],
 ['barrelTop',[280,240],[0,1],[[230,241],[279,303]]],['barrelBottom',[280,430],[0,1],[[231,303]]],
 ['shaftTop',[210,320],[0,1],[[172,224],[310,347]]],['shaftBottom',[210,348],[0,1],[[172,224],[310,351]]],
 ['rodTop',[210,198],[0,1],[[193,208],[233,251],[285,300],[324,336]]],
 ['rodBottom',[210,210],[0,1],[[193,208],[233,251],[285,300],[324,336]]],
 ['leftGuideLeft',[212,180],[1,0],[[143,193],[213,222]]],['leftGuideRight',[229,180],[1,0],[[143,193],[213,222]]],
 ['rightGuideLeft',[304,180],[1,0],[[142,193],[214,220]]],['rightGuideRight',[318,180],[1,0],[[142,193],[214,220]]],
 ['leftGuideBottom',[219,226],[0,1],[[214,226]]],['rightGuideBottom',[311,224],[0,1],[[306,317]]],
 ['headLeft',[257,200],[1,0],[[194,211]]],['headRight',[283,200],[1,0],[[194,211]]],['headTop',[270,192],[0,1],[[259,280]]],
 ['stemLeft',[266,232],[1,0],[[221,247]]],['stemRight',[273,232],[1,0],[[221,247]]],
]) {
 const points=[];
 for(const [low,high] of ranges)for(let j=low;j<=high;j+=2){const p=n[0]?[seed[0],j]:[j,seed[1]],d=runs(p,n).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push(p.map((v,i)=>v+d*n[i]));}
 edges[name]=fit(points,points.map(()=>[1]),points.map(p=>p[n[0]?0:1]));
}
// Independently traced centers between the two groove ink outlines. These
// seeds identify the source feature; all accepted readings use raster pixels.
const path=[[246,240],[249,248],[261,252],[280,256],[287,261],[284,267],[267,272],
 [250,279],[245,284],[247,290],[259,296],[279,300],[287,305],[285,311],[270,316],
 [251,322],[245,327],[244,334],[248,340],[261,346],[281,351],[288,356],[287,362],[276,367],
 [259,372],[248,378],[246,383],[250,388],[266,393],[284,396],[289,400],[282,406],
 [265,411],[252,413],[249,417],[257,421],[278,424]];
const groove=[];
for(let i=1;i<path.length-1;i++) {
 const a=path[i-1],b0=path[i],c=path[i+1],dx=c[0]-a[0],dy=c[1]-a[1],l=Math.hypot(dx,dy),n=[dy/l,-dx/l];
 for(let t=0;t<1;t+=2/Math.hypot(c[0]-b0[0],c[1]-b0[1])) {
 const b=b0.map((v,j)=>v+(c[j]-v)*t);
 const ink=runs(b,n,-8,8).sort((a,b)=>a-b);
 const candidates=[];
 for(let j=0;j<ink.length-1;j++){const low=ink[j],high=ink[j+1],width=high-low;if(width>=2.2&&width<=9&&Math.abs((low+high)/2)<3)candidates.push({low,high,width,offset:(low+high)/2});}
 const best=candidates.sort((a,b)=>Math.abs(a.offset)-Math.abs(b.offset))[0];
 if(best)groove.push({seed:b,normal:n,point:b.map((v,j)=>v+best.offset*n[j]),...best});
 }
}
const axisY=(edges.barrelTop.parameters[0]+edges.barrelBottom.parameters[0])/2,radius=(edges.barrelBottom.parameters[0]-edges.barrelTop.parameters[0])/2;
const fits=[];
for(let count=6;count<=14;count++) {
 let best;
 for(const blend of [.08,.16,.24,.32])for(let degrees=0;degrees<360;degrees++) {
  const phase=degrees*Math.PI/180/count;
  const rows=groove.map(({point:[x,y]})=>{const phi=Math.acos(Math.max(-1,Math.min(1,(axisY-y)/radius))),a=((phi+phase)*count)%(2*Math.PI);const b=Math.min(a,2*Math.PI-a),k=1/(Math.PI-blend);let value;if(b<blend){const t=b/blend;value=k*blend*(t**3-t**4/2);}else if(b>Math.PI-blend){const t=(Math.PI-b)/blend;value=1-k*blend*(t**3-t**4/2);}else value=k*(b-blend/2);return[1,value];});
  const f=fit(groove,rows,groove.map(p=>p.point[0]));if(f.parameters[1]>0&&(!best||f.rms<best.rms))best={...f,count,degrees,phase,blend};
 }
 fits.push(best);
}
const eye=[];
for(let degrees=0;degrees<360;degrees+=5){const a=degrees*Math.PI/180,n=[Math.cos(a),Math.sin(a)],p=[270+3*n[0],202.5+3*n[1]],d=runs(p,n,-2,2).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)eye.push(p.map((v,i)=>v+d*n[i]));}
const eyeFit=fit(eye,eye.map(([x,y])=>[2*x,2*y,1]),eye.map(([x,y])=>x*x+y*y)),[cx,cy,k]=eyeFit.parameters;
const result={file,sha256:hashStudyFile(file),edges,path,groove,axisY,radius,fits,pin:{center:[cx,cy],radius:Math.sqrt(k+cx*cx+cy*cy),points:eye},
 manual:{follower:[[257,192],[282,192],[282,212],[274,217],[274,253],[266,253],[266,217],[257,214]],header:[[99,138],[132,98],[378,98],[394,138]],rodEnds:[189,339],shaftEnds:[156,357],tip:[270,253]},sources};
const stats=values=>({rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),maximum:Math.max(...values.map(Math.abs)),count:values.length});
const nearest=(point,segments)=>Math.min(...segments.map(([a,b])=>{
 const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/l2)):0;
 return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}));
const visual=makeSerpentineCamGeometry(),u=visual.root.userData,f=u.profile;
try {
 assert.equal(result.sha256,u.source.sha256);
 const fit=result.fits.find(v=>v.count===u.source.uniformFit.repetitions);
 assert.ok(Math.abs(fit.parameters[0]-u.source.uniformFit.minimum)<1e-8);
 assert.ok(Math.abs(fit.parameters[1]-u.source.uniformFit.stroke)<1e-8);
 assert.equal(fit.phase,u.source.uniformFit.phase);assert.equal(fit.blend,u.source.uniformFit.blend);
 const registered={};
 for(const [name,part,axis,which] of [['barrelLeft','leftLand','x','min'],['barrelRight','rightLand','x','max'],['barrelTop','leftLand','y','max'],['barrelBottom','leftLand','y','min'],
  ['ceilingBottom','header','y','min'],['shaftTop','shaft','y','max'],['shaftBottom','shaft','y','min'],['rodTop','rod','y','max'],['rodBottom','rod','y','min'],
  ['leftGuideLeft','leftGuide','x','min'],['leftGuideRight','leftGuide','x','max'],['rightGuideLeft','rightGuide','x','min'],['rightGuideRight','rightGuide','x','max'],
  ['leftGuideBottom','leftGuide','y','min'],['rightGuideBottom','rightGuide','y','min'],['headLeft','head','x','min'],['headRight','head','x','max'],['headTop','head','y','max']]) {
  const g=u.parts[part].geometry;g.computeBoundingBox();const v=g.boundingBox[which][axis],predicted=axis==='x'?f.axis[0]+100*v:f.axis[1]-100*v;
  registered[name]={predicted,...stats(edges[name].points.map(p=>predicted-p[axis==='x'?0:1]))};
 }
 const crease={};
 for(const [side,name,sign] of [['left','leftLand',1],['right','rightLand',-1]]) {
  const g=u.parts[name].geometry,p=g.attributes.position,n=g.attributes.normal;crease[side]=[];
  for(let i=0;i<p.count;i+=3) {
   if(sign*n.getX(i)<.01)continue;
   for(let j=0;j<3;j++) {
    const a=i+j,b=i+(j+1)%3;
    if([a,b].every(k=>p.getZ(k)>=-1e-7&&Math.abs(Math.hypot(p.getY(k),p.getZ(k))-f.radius)<1e-7))crease[side].push([a,b].map(k=>[f.axis[0]+100*p.getX(k),f.axis[1]-100*p.getY(k)]));
   }
  }
 }
 const observed=groove.map(reading=>{
  const {point,seed,normal,low,high}=reading,intersections={};
  for(const side of ['left','right']) {
   const values=crease[side].flatMap(([a,b])=>{const t=(point[1]-a[1])/(b[1]-a[1]);return t>=0&&t<=1?[a[0]+t*(b[0]-a[0])]:[];});assert.ok(values.length);intersections[side]=values[0];
  }
  const left=seed.map((v,i)=>v+normal[i]*low),right=seed.map((v,i)=>v+normal[i]*high);
  return{point,left,right,predicted:(intersections.left+intersections.right)/2,centerError:(intersections.left+intersections.right)/2-point[0],leftDistance:nearest(left,crease.left),rightDistance:nearest(right,crease.right)};
 });
 const p=u.parts.shoe.geometry.attributes.position,center=[f.initialTip,(f.pinLow+f.pinHigh)/2],points=[];
 for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i))<1e-7)points.push([p.getX(i),p.getY(i)]);
 const shoe=[...new Map(points.map(p=>[p.map(v=>v.toFixed(8)).join(','),p])).values()].sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
 const silhouette=clip.union(poly(u.headContour),poly(shoe)).flatMap(p=>p.map(r=>r.slice(0,-1).map(([x,y])=>[f.axis[0]+100*x,f.axis[1]-100*y])));
 const silhouetteSegments=silhouette.flatMap(c=>c.map((p,i)=>[p,c[(i+1)%c.length]])),follower=[];
 for(let i=0;i<result.manual.follower.length;i++) {
  const a=result.manual.follower[i],b=result.manual.follower[(i+1)%result.manual.follower.length],d=b.map((v,k)=>v-a[k]),length=Math.hypot(...d),n=[-d[1]/length,d[0]/length],count=Math.ceil(length/2);
  for(let j=0;j<=count;j++){const seed=a.map((v,k)=>v+d[k]*j/count),r=runs(seed,n,-5,5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(r===undefined)continue;const point=seed.map((v,k)=>v+r*n[k]);follower.push({point,distance:nearest(point,silhouetteSegments)});}
 }
 result.reconstruction={registered,grooveCenter:stats(observed.map(p=>p.centerError)),grooveOutlines:stats(observed.flatMap(p=>[p.leftDistance,p.rightDistance])),grooveReadings:observed,
  follower:{...stats(follower.map(p=>p.distance)),points:follower},note:u.source.qualification};
 console.log({grooveCenter:result.reconstruction.grooveCenter,grooveOutlines:result.reconstruction.grooveOutlines,follower:stats(follower.map(p=>p.distance))});
}finally{disposeObject3D(visual.root);}

verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({edges:Object.fromEntries(Object.entries(edges).map(([n,f])=>[n,{value:f.parameters[0],rms:f.rms,count:f.points.length}])),groove:groove.length,fits:fits.map(f=>({count:f.count,blend:f.blend,rms:f.rms,max:f.maximum,phase:f.phase,stroke:f.parameters[1],minimum:f.parameters[0]})),pin:result.pin.center});
