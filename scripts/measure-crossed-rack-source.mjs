import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import {circleFit} from './lib/source-circle-fit.mjs';
const source='artifacts/reference/brown-080-detail.png',width=1320,height=1290,prefix='artifacts/review/080-source-measurements',
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 bytes=execFileSync('convert',[source,'-colorspace','Gray','-depth','8','gray:-'],{maxBuffer:3000000}),
 pixel=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&x<width&&y>=0&&y<height?bytes[y*width+x]:255;};
const circles={};
for(const [name,cx,cy,lo,hi,nominal,mask]of [
 ['leftWeight',220,291,40,73,55,a=>Math.abs(a)<35],
 ['rightWeight',1050,298,40,76,57,a=>Math.abs(a)>145],
 ['leftPawlBore',451,287,5,23,12,a=>a>-90&&a<15],
 ['rightPawlBore',805,297,5,23,12,()=>false]
]){
 const readings=[],excluded=[];
 for(let degrees=-180;degrees<180;degrees+=10){
  if(mask(degrees)){excluded.push(degrees);continue;}
  const angle=degrees*Math.PI/180,runs=[];let current=[];
  for(let r=lo;r<=hi;r+=.25){
   if(pixel(cx+r*Math.cos(angle),cy+r*Math.sin(angle))<65)current.push(r);
   else if(current.length){runs.push(current);current=[];}
  }
  if(current.length)runs.push(current);
  const choices=runs.filter(r=>r[0]>lo&&r.at(-1)<hi&&r.at(-1)-r[0]>1&&r.at(-1)-r[0]<15)
   .sort((a,b)=>Math.abs((a[0]+a.at(-1))/2-nominal)-Math.abs((b[0]+b.at(-1))/2-nominal));
  if(!choices.length)throw Error('No bounded stroke: '+name+' '+degrees);
  const stroke=[choices[0][0],choices[0].at(-1)],radius=(stroke[0]+stroke[1])/2;
  readings.push({degrees,stroke,point:[cx+radius*Math.cos(angle),cy+radius*Math.sin(angle)]});
 }
 circles[name]={...circleFit(readings.map(r=>r.point)),readings,excluded,method:'Bounded dark-stroke midpoint rays; explicit masks exclude the connected lever or open bore mark.'};
}
// The fulcrum's outer ink joins the slot. Fit its enclosed light opening,
// keeping the different boundary convention explicit instead of treating it
// as another fully visible ring stroke.
const stack=[[617,288]],seen=new Set(),points=[];
while(stack.length){
 const [x,y]=stack.pop(),key=y*width+x;
 if(seen.has(key)||x<589||x>646||y<260||y>318||pixel(x,y)<65)continue;
 seen.add(key);points.push([x,y]);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])stack.push([x+dx,y+dy]);
}
const boundary=points.filter(([x,y])=>[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy])=>!seen.has((y+dy)*width+x+dx)));
circles.fulcrum={...circleFit(boundary),areaPixels:points.length,
 centroid:points.reduce((s,p)=>s.map((v,i)=>v+p[i]/points.length),[0,0]),
 method:'Inner boundary of the enclosed light fulcrum opening. The surrounding ink merges into the slot; radius does not measure the outer pin head.'};
const windows={left:[[0,410,416],[1,442,453],[2,480,489],[3,517,526],[4,552,564],[8,693,703],[9,730,741],
 [10,765,776],[11,800,815],[12,839,853],[13,875,886],[14,910,920],[15,939,948]],
 right:[[1,440,452],[2,473,486],[3,509,523],[4,545,558],[8,691,709],[9,730,744],[10,767,779],
 [11,800,812],[12,835,849],[13,870,880],[14,910,924],[15,936,946]]},teeth={};
for(const [key,ranges]of Object.entries(windows)){
 const x0=key==='left'?520:694,x1=key==='left'?546:714,readings=[];
 for(const [index,low,high]of ranges){
  const scores=[];for(let y=low;y<=high;y++){let dark=0;for(let x=x0;x<=x1;x++)if(pixel(x,y)<65)dark++;scores.push({y,dark});}
  const maximum=Math.max(...scores.map(r=>r.dark)),best=scores.filter(r=>r.dark===maximum),y=best.reduce((s,r)=>s+r.y/best.length,0);
  readings.push({index,window:[low,high],xRange:[x0,x1],point:[(x0+x1)/2,y],scores});
 }
 const meanIndex=readings.reduce((s,r)=>s+r.index/readings.length,0),meanY=readings.reduce((s,r)=>s+r.point[1]/readings.length,0),
  denominator=readings.reduce((s,r)=>s+(r.index-meanIndex)**2,0),numerator=readings.reduce((s,r)=>s+(r.index-meanIndex)*(r.point[1]-meanY),0),
  pitch=numerator/denominator,origin=meanY-pitch*meanIndex,residuals=readings.map(r=>r.point[1]-origin-pitch*r.index);
 teeth[key]={count:16,readings,hidden:Array.from({length:16},(_,i)=>i).filter(i=>!readings.some(r=>r.index===i)),
  pitch,origin,rms:Math.sqrt(residuals.reduce((s,e)=>s+e*e,0)/readings.length),maximum:Math.max(...residuals.map(Math.abs)),
  residuals,meanIndex,meanY,denominator,numerator};
}
const commonPitch=(teeth.left.numerator+teeth.right.numerator)/(teeth.left.denominator+teeth.right.denominator);
for(const side of Object.values(teeth)){
 side.commonPitchOrigin=side.meanY-commonPitch*side.meanIndex;
 const errors=side.readings.map(r=>r.point[1]-side.commonPitchOrigin-r.index*commonPitch);
 side.commonPitchRms=Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length);side.commonPitchMaximum=Math.max(...errors.map(Math.abs));
}
const slotRows=[250,260,325,335,365,380,405,700,725,750,775,800,825,850],slotReadings=[];
for(const y of slotRows){
 const strokes=[];
 for(const [lo,hi]of [[589,615],[625,649]]){
  const dark=[];for(let x=lo;x<=hi;x++)if(pixel(x,y)<65)dark.push(x);
  if(!dark.length||dark[0]===lo||dark.at(-1)===hi)throw Error('Unbounded slot stroke at '+y);
  strokes.push({range:[dark[0],dark.at(-1)],center:(dark[0]+dark.at(-1))/2});
 }
 slotReadings.push({y,left:strokes[0],right:strokes[1]});
}
const slot={readings:slotReadings,left:slotReadings.reduce((s,r)=>s+r.left.center/slotReadings.length,0),
 right:slotReadings.reduce((s,r)=>s+r.right.center/slotReadings.length,0),
 top:224,bottom:882,endConvention:'Top and bottom are manually located ink centerlines. The capsule regularizes the hand-drawn asymmetric end curves.'};
slot.center=(slot.left+slot.right)/2;slot.halfWidth=(slot.right-slot.left)/2;
slot.maximumSideResidual=Math.max(...slotReadings.flatMap(r=>[Math.abs(r.left.center-slot.left),Math.abs(r.right.center-slot.right)]));
const scale=(circles.rightPawlBore.center[0]-circles.leftPawlBore.center[0])/2;
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="1290" viewBox="0 0 1320 1290">';
for(const [name,c]of Object.entries(circles)){
 const color=name==='fulcrum'?'#ff44ff':'#00ffff';
 svg+=`<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="${color}" stroke-width="2"/>`;
 svg+=`<circle cx="${c.center[0]}" cy="${c.center[1]}" r="3" fill="${color}"/>`;
 for(const p of c.points)svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="1.5" fill="${color}"/>`;
 svg+=`<text x="${c.center[0]}" y="${c.center[1]-c.radius-15}" text-anchor="middle" fill="${color}" stroke="#222" stroke-width=".35" font-family="DejaVu Sans" font-size="17">${name}</text>`;
}
const radius=slot.halfWidth;
svg+=`<rect x="${slot.left}" y="${slot.top}" width="${2*radius}" height="${slot.bottom-slot.top}" rx="${radius}" fill="none" stroke="#66ff66" stroke-width="2"/>`;
for(const [key,t]of Object.entries(teeth))for(let index=0;index<16;index++){
 const reading=t.readings.find(r=>r.index===index),y=reading?.point[1]??t.commonPitchOrigin+commonPitch*index,
  color=reading?'#00ffff':'#ff9900',x=key==='left'?516:722,labelX=key==='left'?445:802,
  fitY=t.commonPitchOrigin+index*commonPitch;
 svg+=`<line x1="${x}" x2="${labelX}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`+
  `<line x1="${x-10}" x2="${x+10}" y1="${fitY}" y2="${fitY}" stroke="#ff44ff" stroke-width="2"/>`+
  `<text x="${labelX}" y="${y-3}" text-anchor="middle" font-family="DejaVu Sans" font-size="16" fill="${color}" stroke="#222" stroke-width=".4">${index+1}${reading?'':'?'}</text>`;
}
svg+='</svg>';fs.writeFileSync(prefix+'.svg',svg,{flag:'wx'});
execFileSync('convert',['-background','none',prefix+'.svg',prefix+'-marks.png']);
execFileSync('convert',[source,prefix+'-marks.png','-compose','Over','-composite',prefix+'.png']);
const sources=[source,'scripts/measure-crossed-rack-source.mjs','scripts/lib/source-circle-fit.mjs'].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};
});
const report={movement:80,status:'source-measurements-awaiting-visual-review',productionChanged:false,mechanicsPassed:false,
 inspected:false,adopted:false,sourceCenter:circles.fulcrum.center,sourceScale:scale,circles,teeth,commonPitch,slot,sources,
 image:{file:prefix+'.png',sha256:hash(prefix+'.png')},
 qualification:'The ordered 16-tooth interpretation uses 25 visible or partly visible driving strokes. Seven occluded stroke positions are inferred and excluded from the pitch fit. Magenta ticks show the common pitch with separate left/right phases; orange labels are inferred teeth. Source asymmetry, stroke thickness and partial occlusion limit precision. Tooth flanks, pawl contours and hidden axial construction still require geometry review.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({circles:Object.fromEntries(Object.entries(circles).map(([k,c])=>[k,{center:c.center,radius:c.radius,rms:c.rmsResidual}])),
 sourceScale:scale,commonPitch,teeth:Object.fromEntries(Object.entries(teeth).map(([k,t])=>[k,{visible:t.readings.length,hidden:t.hidden,rms:t.commonPitchRms,maximum:t.commonPitchMaximum}])),slot:{left:slot.left,right:slot.right,maximumResidual:slot.maximumSideResidual}});
