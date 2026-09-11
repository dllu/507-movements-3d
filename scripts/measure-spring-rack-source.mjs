import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import {circleFit} from './lib/source-circle-fit.mjs';
const source='artifacts/reference/brown-081-detail.png',width=1280,height=1300,
 prefix=process.env.PROBE_OUTPUT_PREFIX??'artifacts/review/081-source-measurements',
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 bytes=execFileSync('convert',[source,'-colorspace','Gray','-depth','8','gray:-'],{maxBuffer:3000000}),
 pixel=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&x<width&&y>=0&&y<height?bytes[y*width+x]:255;};
const circles={};
for(const [name,cx,cy,lo,hi,nominal,mask]of [
 ['wheelOuter',816,802,126,156,140,a=>Math.abs(a)>100],
 ['wheelInner',816,802,99,124,112,a=>a>=65&&a<=125],
 ['shaftOuter',816,802,30,46,38,a=>a>=60&&a<=115],
 ['shaftInner',816,802,8,34,23,()=>false]
]){
 const readings=[],excluded=[],missing=[];
 for(let degrees=-180;degrees<180;degrees+=5){
  if(mask(degrees)){excluded.push(degrees);continue;}
  const angle=degrees*Math.PI/180,runs=[];let current=[];
  for(let r=lo;r<=hi;r+=.25){if(pixel(cx+r*Math.cos(angle),cy-r*Math.sin(angle))<65)current.push(r);
   else if(current.length){runs.push(current);current=[];}}
  if(current.length)runs.push(current);
  const choices=runs.filter(r=>r[0]>lo&&r.at(-1)<hi&&r.at(-1)-r[0]>2&&r.at(-1)-r[0]<20)
   .sort((a,b)=>Math.abs((a[0]+a.at(-1))/2-nominal)-Math.abs((b[0]+b.at(-1))/2-nominal));
  if(!choices.length){missing.push({degrees,runs:runs.map(r=>[r[0],r.at(-1)])});continue;}
  const stroke=[choices[0][0],choices[0].at(-1)],radius=(stroke[0]+stroke[1])/2;
  readings.push({degrees,stroke,point:[cx+radius*Math.cos(angle),cy-radius*Math.sin(angle)]});
 }
 circles[name]={...circleFit(readings.map(r=>r.point)),readings,excluded,missing,
  method:'Midpoint of a bounded dark stroke along a ray; explicit masks exclude the tooth sector or the connected A label.'};
}
const toothWindows=[[0,660,676],[1,708,720],[2,754,768],[3,808,822],[4,875,889],[5,923,938],[6,971,985]],rackReadings=[];
for(const [index,low,high]of toothWindows){
 const x0=657,x1=676,scores=[];for(let y=low;y<=high;y++){let dark=0;for(let x=x0;x<=x1;x++)if(pixel(x,y)<65)dark++;scores.push({y,dark});}
 const maximum=Math.max(...scores.map(r=>r.dark)),best=scores.filter(r=>r.dark===maximum),y=best.reduce((s,r)=>s+r.y/best.length,0);
 rackReadings.push({index,point:[(x0+x1)/2,y],window:[low,high],xRange:[x0,x1],scores,
  qualification:index===3||index===4?'Partly occluded by the gear; plotted stroke requires visual review.':'Visible horizontal upper tooth stroke; plotted stroke requires visual review.'});
}
const linearFit=rows=>{
 const mi=rows.reduce((s,r)=>s+r.index/rows.length,0),my=rows.reduce((s,r)=>s+r.point[1]/rows.length,0),
  pitch=rows.reduce((s,r)=>s+(r.index-mi)*(r.point[1]-my),0)/rows.reduce((s,r)=>s+(r.index-mi)**2,0),origin=my-pitch*mi,
  residuals=rows.map(r=>r.point[1]-origin-r.index*pitch);
 return {pitch,origin,residuals,rms:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/rows.length),maximum:Math.max(...residuals.map(Math.abs))};
};
const rack={count:7,readings:rackReadings,allStrokeFit:linearFit(rackReadings),unoccludedFit:linearFit(rackReadings.filter(r=>r.index!==3&&r.index!==4))};
const center=circles.wheelOuter.center;
// Five actual outer tip strokes. The prior seven-tooth interpretation used
// inner-flank points and mistook a rack stroke for another hidden gear tooth.
// Only the fourth installed tip is hidden; its trial point is never fitted.
const gearReadings=[];
for(const [index,angles,low,high]of [[0,[116,118,120],145,168],[1,[138,140,142],145,165],
 [2,[160,162],146,164],[4,[204,206,208],155,176],[5,[228,230],155,174]]){
 const readings=[];for(const degrees of angles){const angle=degrees*Math.PI/180,runs=[];let current=[];
  for(let radius=low;radius<=high;radius+=.25){if(pixel(center[0]+radius*Math.cos(angle),center[1]-radius*Math.sin(angle))<65)current.push(radius);
   else if(current.length){runs.push(current);current=[];}}
  if(current.length)runs.push(current);
  const bounded=runs.filter(r=>r[0]>low&&r.at(-1)<high&&r.at(-1)-r[0]>=2).sort((a,b)=>b.length-a.length);
  if(!bounded.length)throw Error('No outer tip stroke at '+index+' '+degrees);
  const stroke=[bounded[0][0],bounded[0].at(-1)],radius=(stroke[0]+stroke[1])/2;
  readings.push({degrees,stroke,point:[center[0]+radius*Math.cos(angle),center[1]-radius*Math.sin(angle)]});
 }
 const point=readings.reduce((sum,r)=>sum.map((v,i)=>v+r.point[i]/readings.length),[0,0]);
 gearReadings.push({index,point,readings,partial:index===2||index===4,method:'Mean of bounded outer tip stroke midpoint rays; explicit ray windows avoid rack occlusion.'});
}
gearReadings.push({index:3,point:[center[0]+161*Math.cos(183.5*Math.PI/180),center[1]-161*Math.sin(183.5*Math.PI/180)],hidden:true});
gearReadings.sort((a,b)=>a.index-b.index);
for(const r of gearReadings)r.degrees=Math.atan2(center[1]-r.point[1],r.point[0]-center[0])*180/Math.PI;
for(const r of gearReadings)if(r.degrees<0)r.degrees+=360;
const fits=[14,15,16,17,18].map(teeth=>{
 const visible=gearReadings.filter(r=>!r.hidden),offsets=visible.map(r=>r.degrees*Math.PI/180-r.index*2*Math.PI/teeth),phase=offsets.reduce((a,b)=>a+b,0)/offsets.length,
  radialMean=visible.reduce((s,r)=>s+Math.hypot(r.point[0]-center[0],r.point[1]-center[1])/visible.length,0),
  errors=offsets.map(v=>2*radialMean*Math.sin((v-phase)/2));
 return {teeth,phase,radius:radialMean,rmsPixels:Math.sqrt(errors.reduce((s,v)=>s+v*v,0)/errors.length),maximumPixels:Math.max(...errors.map(Math.abs)),
  rackBasedPitchRadius:teeth*rack.unoccludedFit.pitch/(2*Math.PI)};
});
const gear={installedTeeth:6,readings:gearReadings,trialFits:fits,qualification:'Five visible or partly visible outer tip strokes; one covered tooth is inferred and excluded. The earlier seven-tooth interpretation is rejected: it mistook a rack stroke for another hidden gear tooth and sampled inner flanks. These corrected readings require visual review.'};
const rod={left:617,right:651,top:20,bottom:1257,upperSeat:{left:586,right:700,top:58,bottom:83},movingSeat:{left:558,right:716,top:487,bottom:507},lowerGuide:{left:565,right:712,top:1153,bottom:1180},
 spring:{left:593,right:687,top:90,bottom:485,visibleFrontSegments:8},
 qualification:'Preliminary manually located stroke centerlines. Guide openings, concealed geometry and spring end construction are not inferred by these readings.'};
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1300" viewBox="0 0 1280 1300">';
for(const [name,c]of Object.entries(circles)){
 const color=name==='wheelOuter'||name==='shaftInner'?'#00ffff':'#ff44ff';
 svg+=`<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="${color}" stroke-width="2"/>`;
 for(const p of c.points)svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="1.5" fill="${color}"/>`;
}
for(const r of rackReadings){const [x,y]=r.point;svg+=`<line x1="${x-15}" x2="520" y1="${y}" y2="${y}" stroke="#00ffff" stroke-width="2"/><text x="505" y="${y+5}" text-anchor="end" font-family="DejaVu Sans" font-size="20" fill="#00ffff">r${r.index+1}</text>`;}
for(const r of gearReadings){const [x,y]=r.point,color=r.hidden?'#ff9900':'#66ff66',a=r.degrees*Math.PI/180,
 label=[center[0]+205*Math.cos(a),center[1]-205*Math.sin(a)];
 svg+=`<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${color}" stroke-width="2"/><line x1="${x}" x2="${label[0]}" y1="${y}" y2="${label[1]}" stroke="${color}" stroke-width="1"/><text x="${label[0]}" y="${label[1]}" text-anchor="middle" font-family="DejaVu Sans" font-size="18" fill="${color}" stroke="#222" stroke-width=".35">g${r.index+1}${r.hidden?'?':''}</text>`;
}
for(const seat of [rod.upperSeat,rod.movingSeat,rod.lowerGuide])svg+=`<rect x="${seat.left}" y="${seat.top}" width="${seat.right-seat.left}" height="${seat.bottom-seat.top}" fill="none" stroke="#ff44ff" stroke-width="2"/>`;
svg+=`<rect x="${rod.spring.left}" y="${rod.spring.top}" width="${rod.spring.right-rod.spring.left}" height="${rod.spring.bottom-rod.spring.top}" fill="none" stroke="#00ffff" stroke-width="2"/>`;
svg+='</svg>';fs.writeFileSync(prefix+'.svg',svg,{flag:'wx'});execFileSync('convert',['-background','none',prefix+'.svg',prefix+'-marks.png']);
execFileSync('convert',[source,prefix+'-marks.png','-compose','Over','-composite',prefix+'.png']);
const sources=[source,'scripts/measure-spring-rack-source.mjs','scripts/lib/source-circle-fit.mjs'].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return {file,archive,sha256:hash(file)};
});
const report={movement:81,status:'source-measurements-awaiting-visual-review',productionChanged:false,mechanicsPassed:false,inspected:false,adopted:false,
 circles,rack,gear,rod,sources,image:{file:prefix+'.png',sha256:hash(prefix+'.png')},
 qualification:'Preliminary centerline measurements, not adopted geometry. Source tooth count, occluded tips, spring turns and the projection of the root disk require review before constructing a compatible gear/rack.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({circles:Object.fromEntries(Object.entries(circles).map(([k,c])=>[k,{center:c.center,radius:c.radius,rms:c.rmsResidual,missing:c.missing.length}])),rack:{all:rack.allStrokeFit,unoccluded:rack.unoccludedFit},gear:fits});
