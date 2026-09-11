import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const imageFile='artifacts/reference/brown-079-detail.png',width=1430,height=1380,
 bytes=execFileSync('convert',[imageFile,'-colorspace','Gray','-depth','8','gray:-'],{maxBuffer:4*1024*1024}),
 pixel=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&x<width&&y>=0&&y<height?bytes[y*width+x]:255;};
const fit=points=>{
 const A=Array.from({length:3},()=>[0,0,0,0]);
 for(const [x,y]of points){const row=[2*x,2*y,1],b=x*x+y*y;for(let i=0;i<3;i++){for(let j=0;j<3;j++)A[i][j]+=row[i]*row[j];A[i][3]+=row[i]*b;}}
 for(let i=0;i<3;i++){let best=i;for(let j=i+1;j<3;j++)if(Math.abs(A[j][i])>Math.abs(A[best][i]))best=j;
  [A[i],A[best]]=[A[best],A[i]];const d=A[i][i];for(let k=i;k<4;k++)A[i][k]/=d;
  for(let j=0;j<3;j++)if(j!==i){const s=A[j][i];for(let k=i;k<4;k++)A[j][k]-=s*A[i][k];}}
 const center=[A[0][3],A[1][3]],radius=Math.sqrt(A[2][3]+center[0]**2+center[1]**2),
  errors=points.map(p=>Math.hypot(p[0]-center[0],p[1]-center[1])-radius);
 return{center,radius,rms:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length),maximum:Math.max(...errors.map(Math.abs)),errors};
};
const traces={};
for(const [name,lo,hi,nominal]of [['outer',388,419,402],['inner',322,360,344]]){
 const readings=[],excluded=[];
 for(let degrees=-180;degrees<180;degrees+=4){
  if((degrees>=32&&degrees<=62)||(degrees>=-62&&degrees<=-30)||Math.abs(degrees)>=160){excluded.push(degrees);continue;}
  let reading;
  // A radial division joins the circular ink stroke. Try explicit neighboring
  // rays until both edges of the circular stroke are visible; retain the shift.
  for(const shift of [0,.5,-.5,1,-1,1.5,-1.5,2,-2]){
   const actualDegrees=degrees+shift,a=actualDegrees*Math.PI/180,runs=[];let current=[];
   for(let radius=lo;radius<=hi;radius+=.25){
    if(pixel(405+radius*Math.cos(a),779-radius*Math.sin(a))<65)current.push(radius);
    else if(current.length){runs.push(current);current=[];}
   }
   if(current.length)runs.push(current);
   const selected=name==='inner'?runs[0]:runs.at(-1);
   if(!selected||selected[0]<=lo||selected.at(-1)>=hi||selected.at(-1)-selected[0]>18||selected.at(-1)-selected[0]<3)continue;
   const radius=(selected[0]+selected.at(-1))/2,point=[405+radius*Math.cos(a),779-radius*Math.sin(a)];
   reading={requestedDegrees:degrees,degrees:actualDegrees,shift,radius,stroke:[selected[0],selected.at(-1)],point};break;
  }
  if(!reading)throw Error('Missing bounded stroke at '+name+' '+degrees);
  readings.push(reading);
 }
 traces[name]={...fit(readings.map(r=>r.point)),readings,excluded};
}
// Ordered division labels. Two slots are hidden by the arms; their
// angular values below only place the orange labels and do not enter the fit.
const degrees=[-.05,9.85,21.05,32,43,53.9,65.3,75.6,86.55,97.45,109.6,120.75,132.95,146.45,158.2,170.6,
 183.3,193.55,204.2,214.7,224.7,235.25,245.15,255.8,264.65,274.15,284.65,295.15,303.8,317,328.7,339.65,350.35],
 hidden=new Set([4,29]),center=traces.outer.center,radius=traces.outer.radius,partial={3:[729,560],28:[616,1096]},
 divisions=degrees.map((angle,index)=>{
  const point=partial[index]??[center[0]+373*Math.cos(angle*Math.PI/180),center[1]-373*Math.sin(angle*Math.PI/180)];
  if(partial[index])angle=(Math.atan2(center[1]-point[1],point[0]-center[0])*180/Math.PI+360)%360;
  return{index,degrees:angle,visible:!hidden.has(index),partial:!!partial[index],point};
 });
const fits=[32,33,34,36].map(teeth=>{
 const visible=divisions.filter(d=>d.visible),offsets=visible.map(d=>d.degrees*Math.PI/180-d.index*2*Math.PI/teeth),phase=offsets.reduce((a,b)=>a+b,0)/offsets.length,
  errors=offsets.map(a=>2*radius*Math.sin((a-phase)/2));
 return{teeth,phase,rmsPixels:Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length),maximumPixels:Math.max(...errors.map(Math.abs))};
});
const bores=JSON.parse(fs.readFileSync('artifacts/review/079-source-bore-readings.json')).readings,
 report={movement:79,status:'source-centerline-and-division-review',productionChanged:false,mechanicsPassed:false,inspected:false,adopted:false,
  traces,divisions,fits,bores,qualification:'Stroke midpoint circle fits with explicit arm and divider masks. Boundary rays follow the first inner or last outer dark run; explicit shifts avoid joined radial marks. The 33-slot ordered interpretation includes two occluded slots inferred from neighboring spacing; those slots do not enter the angular fit. Two partially visible divisions are manually located in the magnified source. The plotted labels require visual review. Shape and spring details behind the engraving remain reconstruction assumptions.'};
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1430" height="1380" viewBox="0 0 1430 1380">';
for(const [name,color]of [['outer','#00ffff'],['inner','#ff44ff']]){
 const t=traces[name];svg+=`<circle cx="${t.center[0]}" cy="${t.center[1]}" r="${t.radius}" fill="none" stroke="${color}" stroke-width="2"/>`;
 for(const r of t.readings)svg+=`<circle cx="${r.point[0]}" cy="${r.point[1]}" r="3" fill="${color}"/>`;
}
for(const d of divisions){const a=d.degrees*Math.PI/180,r=d.index>=13&&d.index<=18?(d.index%2?295:320):(d.index%2?450:475),label=[center[0]+r*Math.cos(a),center[1]-r*Math.sin(a)],color=d.visible?'#00ffff':'#ff8a00';
 svg+=`<line x1="${d.point[0]}" y1="${d.point[1]}" x2="${label[0]}" y2="${label[1]}" stroke="${color}" stroke-width="1.5"/><circle cx="${d.point[0]}" cy="${d.point[1]}" r="5" fill="none" stroke="${color}" stroke-width="2"/><text x="${label[0]}" y="${label[1]}" fill="${color}" stroke="#222" stroke-width=".5" font-family="DejaVu Sans" font-size="18" text-anchor="middle">${d.index}${d.visible?'':'?'}</text>`;
}
for(const b of bores)svg+=`<circle cx="${b.center[0]}" cy="${b.center[1]}" r="7" fill="none" stroke="#44ff66" stroke-width="3"/>`;
svg+='</svg>';
const prefix=process.env.PROBE_OUTPUT_PREFIX??'artifacts/review/079-source-centerlines';fs.writeFileSync(prefix+'.svg',svg,{flag:'wx'});
execFileSync('convert',['-background','none',prefix+'.svg',prefix+'-marks.png']);
execFileSync('convert',[imageFile,prefix+'-marks.png','-compose','Over','-composite',prefix+'.png']);
report.sources=['scripts/measure-opposed-arm-source.mjs',imageFile,'artifacts/review/079-source-bore-readings.json'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({traces:Object.fromEntries(Object.entries(traces).map(([k,v])=>[k,{center:v.center,radius:v.radius,rms:v.rms,maximum:v.maximum,readings:v.readings.length}])),fits});
