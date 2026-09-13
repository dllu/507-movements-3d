import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {hashStudyFile} from './lib/study-report-io.mjs';
const file='public/engravings/mm_095.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runs(coordinate,range,vertical) {
  const result=[];let run=[];
  for(let q=range[0];q<=range[1];q+=.2) {
    if(pixel(...(vertical?[coordinate,q]:[q,coordinate]))<120)run.push(q);
    else if(run.length){result.push(run);run=[];}
  }
  if(run.length)result.push(run);
  return result.filter(r=>r[0]>range[0]&&r.at(-1)<range[1]-.1).map(r=>({mid:(r[0]+r.at(-1))/2,width:r.length*.2}));
}
function fit(points) {
  const n=points.length,mx=points.reduce((s,p)=>s+p[0],0)/n,my=points.reduce((s,p)=>s+p[1],0)/n;
  const slope=points.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/points.reduce((s,p)=>s+(p[0]-mx)**2,0),intercept=my-slope*mx;
  const residuals=points.map(p=>p[1]-slope*p[0]-intercept);
  return {slope,intercept,rms:Math.sqrt(residuals.reduce((s,r)=>s+r*r,0)/n),points,residuals};
}
const diskFaces=[[],[]];
for(let x=72;x<=320;x+=4) {
  const expected=275-.23*x,ink=runs(x,[expected-7,expected+25],true).filter(r=>r.width<8);
  const top=ink.filter(r=>Math.abs(r.mid-expected)<5).sort((a,b)=>Math.abs(a.mid-expected)-Math.abs(b.mid-expected))[0];
  const bottom=ink.filter(r=>Math.abs(r.mid-(expected+15))<5).sort((a,b)=>Math.abs(a.mid-expected-15)-Math.abs(b.mid-expected-15))[0];
  if(top&&bottom){diskFaces[0].push([x,top.mid]);diskFaces[1].push([x,bottom.mid]);}
}
const verticals={};
for(const [name,range,ys] of [['shaft',[165,215],[392,458]],['rod',[290,311],[82,154]]]) {
  const left=[],right=[];
  for(let y=ys[0];y<=ys[1];y+=3){const ink=runs(y,range,false);if(ink.length===2){left.push([y,ink[0].mid]);right.push([y,ink[1].mid]);}}
  verticals[name]={left:fit(left),right:fit(right),center:([...left,...right].reduce((s,p)=>s+p[1],0)/(left.length+right.length)),radius:(right.reduce((s,p)=>s+p[1],0)/right.length-left.reduce((s,p)=>s+p[1],0)/left.length)/2};
}
const faces=diskFaces.map(fit),slope=(faces[0].slope+faces[1].slope)/2,tilt=Math.atan(-slope),axis=verticals.shaft.center;
const centerY=faces.reduce((s,f)=>s+f.slope*axis+f.intercept,0)/2,thickness=(faces[1].intercept-faces[0].intercept+(faces[1].slope-faces[0].slope)*axis)*Math.cos(tilt);
const result={file,sha256:hashStudyFile(file),faces,verticals,derived:{axis,centerY,tilt,thickness},manual:{diskRight:328,rollerCenter:[301,186.5],rollerRadius:13.5,rollerHalfWidth:4.2,rodTop:73,rodBottom:164,shaftBottom:470,bearingBounds:[164,319,274,373],wallBounds:[282,286,477,510]},qualification:'Complete raster ink runs fit the two disk faces and upright outlines. A common slope and vertical axes regularize drawing variation. Right disk extent, roller/fork features, and support bounds are manual readings; hidden depth is unspecified.'};
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/095-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({faces:faces.map(f=>({slope:f.slope,intercept:f.intercept,rms:f.rms,count:f.points.length})),verticals:Object.fromEntries(Object.entries(verticals).map(([n,v])=>[n,{center:v.center,radius:v.radius,leftRms:v.left.rms,rightRms:v.right.rms,count:v.left.points.length}])),derived:result.derived});
