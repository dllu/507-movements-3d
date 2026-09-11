import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{makeJointedTappetCandidate}from'./lib/jointed-tappet-candidate.mjs';import{makeJointedTappetDynamics}from'./lib/jointed-tappet-dynamics-study.mjs';
const file='artifacts/review/076-playback-candidate.json',profile=JSON.parse(await readFile(file,'utf8')),candidate=makeJointedTappetCandidate(),p=candidate.root.userData.geometry,physics=makeJointedTappetDynamics(candidate,profile.physics),tolerance=1e-6,
  length=v=>Math.hypot(...v),subtract=(a,b)=>a.map((v,i)=>v-b[i]),radii={B:p.noseRadius,H:p.noseRadius,dogStop:p.dogStopRadius,restStop:p.CstopRadius,stud:p.barRadius+p.studRadius},
  rows=[],failures=[];let queries=0,certified=0,subdivisions=0,minimumEndpointGap=Infinity,minimumLowerBound=Infinity,maximumDepth=0;
for(const source of profile.sources.filter(s=>s.file.startsWith('scripts/lib/')))if(createHash('sha256').update(await readFile(source.file)).digest('hex')!==source.sha256)throw new Error('Candidate sources changed');
const bounds=(a,b)=>{
 const[dq,da,dt,db]=subtract(b.x,a.x),dphi=-physics.parameters.omega*(b.time-a.time),term=(pairs)=>({V:pairs.reduce((s,[v,k])=>s+length(v)*Math.abs(k),0),A:pairs.reduce((s,[v,k])=>s+length(v)*k*k,0)});
 return{B:term([[p.C,-dt],[p.B,dq-dt],[p.V,dq+da-dt]]),H:term([[p.PH,-dt],[p.holdingNose,db-dt]]),dogStop:term([[subtract(p.dogStop,p.B),-da]]),restStop:term([[subtract(p.Cstop,p.C),-dq]]),stud:term([[p.studVector,dphi-dq],[p.C,-dq]])};
};
const evaluate=(time,x)=>{queries++;const g=physics.constraints(x,time).gaps;minimumEndpointGap=Math.min(minimumEndpointGap,...Object.values(g));return{time,x,g};};
function certify(a,b,depth,label){
 maximumDepth=Math.max(maximumDepth,depth);const terms=bounds(a,b),lower={};let okay=true;
 for(const[kind,radius]of Object.entries(radii)){
  const minimum=Math.min(a.g[kind],b.g[kind]),{V,A}=terms[kind],distanceLower=radius+minimum-V/2;
  lower[kind]=distanceLower>0?minimum-(A+V*V/distanceLower)/8:-Infinity;
  if(minimum< -tolerance){failures.push({reason:'endpoint-penetration',label,kind,a,b});return false;}
  if(lower[kind]< -tolerance)okay=false;
 }
 if(okay){certified++;minimumLowerBound=Math.min(minimumLowerBound,...Object.values(lower));return true;}
 if(depth>=24){failures.push({reason:'unresolved-interval',label,depth,a,b,lower});return false;}
 subdivisions++;const middle=evaluate((a.time+b.time)/2,a.x.map((v,i)=>(v+b.x[i])/2));
 return certify(a,middle,depth+1,label)&&certify(middle,b,depth+1,label);
}
for(const[label,table,tooth]of [['initial',profile.first,0],...Array.from({length:20},(_,i)=>['periodic',profile.steady,i])]){
 const before={queries,certified,subdivisions},offset=tooth*p.pitch,timeOffset=tooth*24;let previous=null,okay=true;
 for(let i=0;i<table.length;i++){
  const row=table[i],x=row.slice(1);x[2]+=offset;const current=evaluate(row[0]+timeOffset,x);
  if(previous&&!certify(previous,current,0,{table:label,tooth,segment:i-1})){okay=false;break;}previous=current;
 }
 const record={table:label,tooth,okay,queries:queries-before.queries,certified:certified-before.certified,subdivisions:subdivisions-before.subdivisions};rows.push(record);console.log(record);if(!okay)break;
}
const sources=[];for(const path of ['scripts/check-jointed-tappet-playback-contacts.mjs','scripts/lib/jointed-tappet-candidate.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs',file])sources.push({file:path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
const report={movement:76,status:'continuous-playback-primary-contact-bounds',productionChanged:false,mechanicsPassed:false,passed:failures.length===0&&rows.length===21,tolerance,rows,queries,certified,subdivisions,minimumEndpointGap,minimumLowerBound,maximumDepth,failures,sources,
 method:'Within each linear angle segment, express every circle center in the fixed opposing profile frame as a sum of rotated vectors. V bounds its displacement rate and A its acceleration over normalized interval [0,1]. Every point-to-edge distance stays at least radius + min(endpoint gaps) - V/2. Its second derivative is at most A + V²/distanceLower, so each distance is bounded below by its endpoint minimum minus one eighth of that expression. Subdivide uncertain intervals. Positive center-to-boundary distance preserves outside orientation. Circle-to-segment and circle-to-polygon edge distances share this bound.',
 qualification:'Primary working contacts and finite stop sectors only, on all twenty actual Float32 tooth orientations. The bar capsule and circular noses are ideal enclosing surfaces of their inscribed meshes. Other independent solid pairs require separate rendered-surface checks. This is a geometric interpolation certificate for the chosen trajectory, not a dynamic-force certificate.'};
await writeFile('artifacts/review/076-playback-contact-bounds.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,sources:undefined,method:undefined});process.exitCode=report.passed?0:1;
