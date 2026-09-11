import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
import {pegPawlProfile,rotate,sub} from './lib/alternating-peg-contact-study.mjs';

const file=process.env.PLAYBACK_INPUT||'artifacts/review/077-playback-candidate.json',cache=JSON.parse(fs.readFileSync(file));
const candidate=makeAlternatingPegCandidate(cache.geometry),u=candidate.root.userData,p=u.geometry;
const profiles=Object.fromEntries(['upper','lower'].map(key=>[key,pegPawlProfile(u.profiles[key])]));
const tolerance=1e-6,failures=[],rows=[];
let queries=0,certified=0,subdivisions=0,maximumDepth=0,minimumEndpointGap=Infinity,minimumLowerBound=Infinity,nearestQueries=0,broadPhaseQueries=0;
for(const source of cache.sources.filter(s=>s.file.startsWith('scripts/lib/')))if(crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex')!==source.sha256)throw Error('Cache geometry changed');
const positions=u.parts.wheelPin0.geometry.getAttribute('position');let radius=0;
for(let i=0;i<positions.count;i++)radius=Math.max(radius,Math.hypot(positions.getX(i),positions.getY(i)));
let permutationError=0;
for(let cycle=0;cycle<24;cycle++)for(let i=0;i<24;i++)permutationError=Math.max(permutationError,Math.hypot(...sub(rotate(p.pinCenters[i],cycle*p.pitch),p.pinCenters[(i+cycle)%24])));
const roundoffMargin=1e-12+permutationError;
function evaluate(row){
 queries++;const [time,q,theta,...angles]=row,gaps={};
 const pins=p.pinCenters.map(center=>rotate(center,theta));
 for(const [index,key]of ['upper','lower'].entries()){
  const profile=profiles[key],pivot=u.motion.anchorAt(key,q);let minimum=Infinity;
  for(const pin of pins){
   const delta=sub(pin,pivot),radialLower=Math.hypot(...delta)-profile.maximumRadius-radius;
   if(radialLower>.01){minimum=Math.min(minimum,radialLower);broadPhaseQueries++;continue;}
   const gap=profile.closest(rotate(delta,-angles[index])).signedDistance-radius;
   minimum=Math.min(minimum,gap);nearestQueries++;
  }
  gaps[key]=minimum-roundoffMargin;
 }
 minimumEndpointGap=Math.min(minimumEndpointGap,...Object.values(gaps));return{row,gaps};
}
function certify(a,b,depth,label){
 maximumDepth=Math.max(maximumDepth,depth);
 const delta=b.row.map((v,k)=>v-a.row[k]),dq=delta[1],dtheta=delta[2],lower={};let okay=true;
 for(const [index,key]of ['upper','lower'].entries()){
  const da=delta[index+3],terms=[[p.orbit,dtheta-da],[Math.hypot(...p.A),-da],[Math.hypot(...p.arms[key]),dq-da]],
   V=terms.reduce((sum,[length,angle])=>sum+length*Math.abs(angle),0),
   A=terms.reduce((sum,[length,angle])=>sum+length*angle*angle,0),
   minimum=Math.min(a.gaps[key],b.gaps[key]),distanceLower=radius+minimum-V/2;
  lower[key]=distanceLower>0?minimum-(A+V*V/distanceLower)/8:-Infinity;
  if(minimum< -tolerance){failures.push({reason:'endpoint-penetration',label,key,a,b});return false;}
  if(lower[key]< -tolerance)okay=false;
 }
 if(okay){certified++;minimumLowerBound=Math.min(minimumLowerBound,...Object.values(lower));return true;}
 if(depth>=24){failures.push({reason:'unresolved-interval',label,depth,a,b,lower});return false;}
 subdivisions++;const middle=evaluate(a.row.map((v,k)=>(v+b.row[k])/2));
 return certify(a,middle,depth+1,label)&&certify(middle,b,depth+1,label);
}
for(const [label,table]of [['initial',cache.first],['periodic',cache.steady]]){
 const before={queries,certified,subdivisions};let previous=null,okay=true;
 for(let i=0;i<table.length;i++){
  const current=evaluate(table[i]);if(previous&&!certify(previous,current,0,{table:label,segment:i-1})){okay=false;break;}previous=current;
 }
 rows.push({table:label,knots:table.length,okay,queries:queries-before.queries,certified:certified-before.certified,subdivisions:subdivisions-before.subdivisions});console.log(rows.at(-1));if(!okay)break;
}
const sources=[file,'scripts/check-alternating-peg-playback-contacts.mjs','scripts/lib/alternating-peg-candidate.mjs','scripts/lib/alternating-peg-contact-study.mjs','src/simulation/jointed-tappet-contact.js'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={movement:77,status:'continuous-playback-primary-contact-bounds',productionChanged:false,mechanicsPassed:false,passed:!failures.length&&rows.length===2,tolerance,radius,permutationError,roundoffMargin,rows,queries,nearestQueries,broadPhaseQueries,certified,subdivisions,minimumEndpointGap,minimumLowerBound,maximumDepth,failures,sources,
 method:'In the fixed pawl frame each pin center is R(theta-alpha)*pin - R(-alpha)*A - R(q-alpha)*arm. Bounds V=sum(length*absolute angle change) and A=sum(length*angle change squared) apply over each linear-angle interval. Every edge distance is bounded below by the minimum of its endpoint distances minus (A+V^2/distanceLower)/8, with distanceLower=radius+minimum endpoint gap-V/2. The minimum across all 24 pins and all polygon edges shares this bound. Uncertain intervals are bisected along the same interpolated path. Radial broad-phase values conservatively underestimate boundary distance. Positive distance to the boundary preserves the outside orientation. The enclosing pin circle covers all actual Float32 pin vertices, and a measured 24-way pin-center permutation error plus roundoff margin extends the bound to every subsequent cycle.',
 qualification:'Continuous geometry bound for both finite pawl outlines versus all wheel pins. Pawl bores are filled in these conservative profiles. Other independent solids, caps, bearings and lever require separate surface and axial-clearance checks. This certifies interpolation geometry within tolerance, not the continuous-time dynamics.'};
fs.writeFileSync(process.env.PROBE_OUTPUT||'artifacts/review/077-playback-contact-bounds.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,failures:report.failures.map(f=>({reason:f.reason,label:f.label,key:f.key})),sources:undefined,method:undefined});process.exitCode=report.passed?0:1;
