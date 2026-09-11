import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';

const file='artifacts/reference/brown-082-detail.png',width=1350,height=1250,
 bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-'],{maxBuffer:width*height+1000}),
 pixel=(x,y)=>bytes[Math.round(y)*width+Math.round(x)]??255,
 hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const circles={};
for(const [name,cx,cy,low,high,nominal,exclude] of [
 ['wheelFace',491,522,205,253,232,a=>a>-38&&a<32],
 ['wheelHub',493,525,48,73,61,a=>a>-35&&a<27],
 ['treadleFulcrum',304,990,22,40,31,()=>false],
 ['upperPawlPivot',812,421,20,37,29,a=>a>100&&a<200],
 ['lowerPawlPivot',778,649,15,32,23,a=>a>20&&a<100],
 ['upperRodTop',877,405,18,37,27,a=>a>225&&a<300],
 ['lowerRodTop',816,670,16,33,24,a=>a>225&&a<300],
]){
 const readings=[],missing=[];
 for(let degrees=0;degrees<360;degrees+=5){
  const signed=degrees>180?degrees-360:degrees;if(exclude(name==='wheelFace'||name==='wheelHub'?signed:degrees))continue;
  const angle=degrees*Math.PI/180,runs=[];let run=[];
  for(let r=low;r<=high;r+=.25){
   if(pixel(cx+r*Math.cos(angle),cy-r*Math.sin(angle))<65)run.push(r);
   else if(run.length){runs.push(run);run=[];}
  }
  if(run.length)runs.push(run);
  const choices=runs.filter(r=>r[0]>low&&r.at(-1)<high&&r.at(-1)-r[0]>=2)
   .sort((a,b)=>Math.abs((a[0]+a.at(-1))/2-nominal)-Math.abs((b[0]+b.at(-1))/2-nominal));
  if(!choices.length){missing.push(degrees);continue;}
  const stroke=[choices[0][0],choices[0].at(-1)],r=(stroke[0]+stroke[1])/2;
  readings.push({degrees,stroke,point:[cx+r*Math.cos(angle),cy-r*Math.sin(angle)]});
 }
 circles[name]={...circleFit(readings.map(r=>r.point)),readings,missing};
}
const center=circles.wheelFace.center,outer=[];
for(let i=0;i<1440;i++){
 const degrees=i/4,angle=degrees*Math.PI/180;let outermost=null;
 for(let r=235;r<315;r+=.25)if(pixel(center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle))<65)outermost=r;
 outer.push({degrees,r:outermost});
}
const smooth=i=>{const vals=Array.from({length:5},(_,j)=>outer[(i+j-2+1440)%1440].r).filter(v=>v!==null);return vals.reduce((a,b)=>a+b,0)/vals.length;},peaks=[];
for(let i=160;i<1320;i++){
 const r=smooth(i);if(!(r>260&&r>=smooth(i-1)&&r>smooth(i+1)))continue;
 if(peaks.length&&i-peaks.at(-1).index<28){if(r>peaks.at(-1).radius)peaks.pop();else continue;}
 const angle=i/4*Math.PI/180;peaks.push({index:i,degrees:i/4,radius:r,point:[center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle)]});
}
// Joint and frame readings are manually selected stroke centers. The
// automatic overlay must be inspected before any dimensions are adopted.
const landmarks={
 upperRodBottom:[937,887],lowerRodBottom:[836,989],
 upperStrapPin:[1035,929],lowerStrapPin:[1035,1020],
 pulley:{axisX:1035,top:610,bottom:710,axialEdges:[1000,1060],postEdges:[944,977,1083,1117]},
 treadles:{upperToe:[1245,923],lowerToe:[1263,1045],pedestalBottom:1100},
 upperPawl:{outer:[[697,352],[732,357],[762,371],[790,389],[812,411]],
  inner:[[684,369],[727,372],[764,394],[794,416],[810,435]]},
 lowerPawl:{outer:[[742,540],[774,570],[790,605],[795,641]],
  inner:[[742,544],[756,573],[767,603],[769,627]]},
};
const fits=Array.from({length:7},(_,k)=>24+k).map(teeth=>{
 const pitch=360/teeth,phase=peaks.reduce((s,p,i)=>s+(p.degrees-i*pitch)/peaks.length,0),
 residuals=peaks.map((p,i)=>(p.degrees-phase-i*pitch)*Math.PI/180*p.radius);
 return{teeth,phase,pitch,rmsPixels:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/residuals.length),maximumPixels:Math.max(...residuals.map(Math.abs))};
});
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
for(const [name,c] of Object.entries(circles)){
 svg+=`<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="#00ffff" stroke-width="2"/><text x="${c.center[0]+c.radius+4}" y="${c.center[1]}" fill="#00ffff" font-size="15">${name}</text>`;
}
for(const [i,p] of peaks.entries())svg+=`<circle cx="${p.point[0]}" cy="${p.point[1]}" r="4" fill="#ff00ee"/><text x="${p.point[0]+5}" y="${p.point[1]}" fill="#ff00ee" font-size="16">${i}</text>`;
for(const [name,p] of Object.entries(landmarks))if(Array.isArray(p))svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#66ff33"/><text x="${p[0]+7}" y="${p[1]}" fill="#66ff33" font-size="16">${name}</text>`;
svg+=`<rect x="1000" y="610" width="60" height="100" fill="none" stroke="#ff9933" stroke-width="2"/>`;
for(const [name,color] of [['upperPawl','#ffdd00'],['lowerPawl','#ffdd00']])for(const side of ['outer','inner'])svg+=`<polyline points="${landmarks[name][side].map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;
svg+='</svg>';
const base='artifacts/review/082-source-measurements';fs.writeFileSync(base+'.svg',svg);
execFileSync('convert',['-background','none',base+'.svg',base+'-overlay.png']);
execFileSync('convert',[file,base+'-overlay.png','-composite',base+'.png']);
const report={movement:82,status:'preliminary-source-measurements',source:{file,sha256:hash(file),page:'PDF page 28 / printed page 24',crop:[3070,2510,1350,1250]},circles,outer,peaks,fits,landmarks,
 qualification:'Automatic stroke and tip readings plus manually located joints and pawl contours; all require overlay review. Perspective, depth and mechanisms are not inferred by this measurement pass.'};
fs.writeFileSync(base+'.json',JSON.stringify(report,null,2)+'\n');console.log({circles:Object.fromEntries(Object.entries(circles).map(([k,c])=>[k,{center:c.center,radius:c.radius,rms:c.rmsResidual,missing:c.missing.length}])),peaks:peaks.map(p=>p.degrees),fits});
