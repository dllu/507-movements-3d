import fs from 'node:fs';
import crypto from 'node:crypto';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {makePullPawlTriangleBounds} from './lib/pull-pawl-triangle-bounds.mjs';
const file=process.env.PLAYBACK_FILE??'artifacts/review/078-playback-candidate.json',cache=JSON.parse(fs.readFileSync(file)),candidate=makePullPawlCandidate(cache.geometry),
 tolerance=1e-6,roundoff=1e-12,bounds=makePullPawlTriangleBounds(candidate,{tolerance,roundoff}),rows=[],failures=[];
for(const source of cache.sources.filter(s=>s.file.startsWith('scripts/lib/')))if(crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex')!==source.sha256)throw Error('Cache geometry changed');
let certified=0,subdivisions=0,maximumDepth=0;
const certify=(a,b,depth,label)=>{
 maximumDepth=Math.max(maximumDepth,depth);const result=bounds.check(a,b);
 if(result.okay){certified++;return true;}
 if(result.witness.midpointSeparation< -tolerance-roundoff){failures.push({reason:'midpoint-overlap',label,depth,a:a.row,b:b.row,...result.witness});return false;}
 if(depth>=20){failures.push({reason:'unresolved-interval',label,depth,a:a.row,b:b.row,...result.witness});return false;}
 subdivisions++;return certify(a,result.middle,depth+1,label)&&certify(result.middle,b,depth+1,label);
};
const turns=Number(process.env.CHECK_TURNS??26),tables=[['initial',0,cache.first],...Array.from({length:turns},(_,turn)=>['periodic',turn,cache.steady])];
for(const [label,turn,table]of tables){
 const before={...bounds.stats,certified,subdivisions};let previous=null,okay=true;
 for(let i=0;i<table.length;i++){
  const row=[...table[i]];row[2]+=turn*cache.pitch;const current=bounds.evaluate(row);
  if(previous&&!certify(previous,current,0,{table:label,turn,segment:i-1})){okay=false;break;}previous=current;
 }
 rows.push({table:label,turn,knots:table.length,okay,certified:certified-before.certified,subdivisions:subdivisions-before.subdivisions,
  trianglePairs:bounds.stats.trianglePairs-before.trianglePairs});console.log(rows.at(-1));if(!okay)break;
}
const files=[file,'scripts/check-pull-pawl-playback-contacts.mjs','scripts/lib/pull-pawl-triangle-bounds.mjs','scripts/lib/pull-pawl-candidate.mjs','scripts/lib/pull-pawl-contact-study.mjs'],
 report={movement:78,status:'continuous-convex-face-playback-bounds',productionChanged:false,mechanicsPassed:false,passed:!failures.length&&rows.length===tables.length,
 tolerance,roundoff,turns,rows,certified,subdivisions,maximumDepth,...bounds.stats,failures,triangulations:Object.fromEntries(Object.entries(bounds.profiles).map(([k,p])=>[k,p.validation])),
 method:'Triangulate each actual Float32 hook outline and the filled wheel outline, checking oriented edge cancellation and area. The filled wheel conservatively includes its spoke openings. In wheel coordinates every hook vertex follows R(-theta) A + R(q-theta) arm + R(alpha-theta) vertex. For linear angle interpolation, each coordinate and each unit-axis projection differs from its endpoint chord by at most (|A| dtheta² + |arm| (dq-dtheta)² + |vertex| (dalpha-dtheta)²)/8. Expanded endpoint boxes select triangle pairs. Fixed unit axes from both triangles at the midpoint then bound all triangle-vertex projections throughout the interval. A separating axis within tolerance proves the entire pair stays clear, including edge crossings. Uncertain intervals are subdivided without changing the playback path. Every one of the 26 periodic wheel orientations is checked explicitly when turns=26.',
 qualification:'This bounds continuous playback geometry for the full overlapping hook/wheel profiles, within the stated tolerance. It does not certify the continuous-time dynamics or clearances involving other bodies. A partial orientation run is identified by turns and is not evidence for all repeats.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(process.env.PROBE_OUTPUT??'artifacts/review/078-playback-contact-bounds.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed:report.passed,turns,certified,subdivisions,maximumDepth,stats:bounds.stats,failures});if(!report.passed)process.exitCode=1;
