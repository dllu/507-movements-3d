import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const input=process.env.PROBE_INPUT??'artifacts/review/079-projected-finest-candidate.json',prefix=process.env.PROBE_PREFIX??'079-projected-fidelity',
 rawFile='artifacts/review/079-load6-finest.json',refinementFile='artifacts/review/079-final-refinement.json',
 profile=JSON.parse(await readFile(input,'utf8')),raw=JSON.parse(await readFile(rawFile,'utf8')),refinement=JSON.parse(await readFile(refinementFile,'utf8')),
 a=raw.rows.map(r=>[r.time,...r.x]),b=[...profile.first,...profile.steady.slice(1).map(r=>[r[0]+profile.physicsPeriod,...r.slice(1)])],
 radii=refinement.radii,scale=400.22693572590316,maximum={wheel:{pixels:0},upper:{pixels:0},lower:{pixels:0}},sources=[];
if(!profile.passed||raw.failures.length||!refinement.passed)throw Error('Incomplete input');
const at=(table,time)=>{
 let lo=0,hi=table.length-1;while(hi-lo>1){const middle=(lo+hi)>>1;if(table[middle][0]<=time)lo=middle;else hi=middle;}
 const a=table[lo],b=table[hi],s=Math.max(0,Math.min(1,(time-a[0])/(b[0]-a[0])));return a.slice(1).map((v,k)=>v+s*(b[k+1]-v));
};
const times=[...new Set([...a,...b].map(r=>r[0]))].sort((a,b)=>a-b);
for(const time of times){
 const x=at(a,time),y=at(b,time);
 for(const [i,key]of ['wheel','upper','lower'].entries()){
  const angle=Math.abs(x[i]-y[i]),pixels=2*radii[key]*Math.sin(angle/2)*scale;
  if(pixels>maximum[key].pixels)maximum[key]={time,angle,pixels,a:x[i],b:y[i]};
 }
}
const playbackError=Math.max(...Object.values(maximum).map(r=>r.pixels)),combinedBound=playbackError+refinement.comparisons.at(-1).maximumPixels,
 passed=combinedBound<=.25;
for(const file of ['scripts/check-opposed-arm-playback-fidelity.mjs',input,rawFile,refinementFile]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});
 sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const report={movement:79,status:'playback-fidelity-comparison',productionChanged:false,mechanicsPassed:false,passed,knots:times.length,maximum,playbackError,
 previousRefinement:refinement.comparisons.at(-1).maximumPixels,combinedBound,sources,
 qualification:'The union of raw-dynamics and final-playback knots bounds the difference of their piecewise-linear free angles throughout both complete cycles. The actual rotation radii convert this to a mesh-vertex displacement bound. Adding the previous time-step comparison uses the triangle inequality; this is observed numerical agreement, not a formal continuum error bound.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,knots:times.length,maximum,playbackError,combinedBound});if(!passed)process.exitCode=1;
