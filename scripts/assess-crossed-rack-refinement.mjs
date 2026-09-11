import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
const names=JSON.parse(process.env.PROBE_INPUTS??'["080-amplitude016-dynamics","080-amplitude016-fine-dynamics","080-amplitude016-finer-dynamics","080-amplitude016-finest-dynamics"]'),
 files=names.map(n=>'artifacts/review/'+n+'.json'),data=files.map(file=>JSON.parse(fs.readFileSync(file))),
 u=makeCrossedRackCandidate(data[0].geometry).root.userData,radii=[1,0,0];
for(const [name,mesh]of Object.entries(u.parts)){
 const index=['rack','left','right'].indexOf(u.families[name]);if(index<1)continue;
 const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)radii[index]=Math.max(radii[index],Math.hypot(p.getX(i),p.getY(i)));
}
const comparisons=[];
for(let k=0;k+1<data.length;k++){
 const a=data[k],b=data[k+1];assert.deepEqual(a.geometry,b.geometry);assert.deepEqual(a.parameters,b.parameters);
 for(const d of [a,b]){assert.equal(d.failures.length,0);assert.equal(d.rows.length,Math.round(d.duration/d.dt)+1);}
 const start=Math.max(a.rows[0].time,b.rows[0].time),end=Math.min(a.rows.at(-1).time,b.rows.at(-1).time),
  times=Array.from(new Set([...a.rows.map(r=>r.time),...b.rows.map(r=>r.time)].filter(t=>t>=start&&t<=end))).sort((x,y)=>x-y),
  indices=[0,0],sample=(d,i,time)=>{
   while(indices[i]+1<d.rows.length&&d.rows[indices[i]+1].time<time)indices[i]++;
   const low=d.rows[indices[i]],high=d.rows[Math.min(indices[i]+1,d.rows.length-1)],f=low.time===high.time?0:(time-low.time)/(high.time-low.time);
   return low.x.map((v,j)=>v+f*(high.x[j]-v));
  },maximum=[0,1,2].map(()=>({pixels:0,time:0})),operating=[0,1,2].map(()=>({pixels:0,time:0}));
 for(const time of times){
  const x=sample(a,0,time),y=sample(b,1,time);
  for(let i=0;i<3;i++){
   const difference=Math.abs(x[i]-y[i]),pixels=difference*radii[i]*u.geometry.scale,row={pixels,time,difference,a:x[i],b:y[i]};
   if(pixels>maximum[i].pixels)maximum[i]=row;if(time>=4&&pixels>operating[i].pixels)operating[i]=row;
  }
 }
 const maximumPixels=Math.max(...maximum.map(r=>r.pixels));
 comparisons.push({coarse:files[k],fine:files[k+1],dt:[a.dt,b.dt],start,end,unionKnots:times.length,
  maximum,maximumPixels,maximumOperatingPixels:Math.max(...operating.map(r=>r.pixels)),operating,withinQuarterPixel:maximumPixels<=.25});
}
const prefix=process.env.PROBE_PREFIX??'artifacts/review/080-first-refinement',sources=[
 'scripts/assess-crossed-rack-refinement.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',...files
].map((file,i)=>{const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};});
const report={movement:80,status:'loaded-spatial-refinement-study',productionChanged:false,mechanicsPassed:false,
 passed:comparisons.at(-1).withinQuarterPixel,radii,sourceScale:u.geometry.scale,comparisons,sources,
 qualification:'Union knots bound differences of the complete piecewise-linear free coordinates. The identical analytic driver cancels between runs; actual pawl rotation radii turn angular differences into mesh displacement bounds. The quarter-source-pixel criterion applies to the latest comparison. This measures observed agreement and is not a formal continuum-error estimate.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({comparisons:comparisons.map(r=>({dt:r.dt,maximumPixels:r.maximumPixels,maximumOperatingPixels:r.maximumOperatingPixels})),passed:report.passed});
if(!report.passed)process.exitCode=1;
