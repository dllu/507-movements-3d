import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {surfaceTriangles,surfacePoints,solidSurface} from '../tests/helpers/solid-surface.mjs';
import {familyMass} from '../src/simulation/finite-plate-geometry.js';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-complete-surfaces',input=process.env.PROBE_INPUT??'artifacts/review/086-heel-eighth-ms-retry.json.gz',
  data=readStudyReport(input),frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
verifyStudySources(data.sources);
const verify=()=>{for(const [file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const sources=freezeStudySources([input,'scripts/probe-pump-catch-complete.mjs',...pumpCatchCompleteSources,'tests/helpers/solid-surface.mjs'],prefix),model=makePumpCatchCompleteCandidate(),u=model.root.userData,
  completeMotion=Boolean(data.parameters.completeHardware);
if(completeMotion)assert.deepEqual(familyMass(u.parts,u.families,'wheel'),data.parameters.wheel);
function topology(geometry){
  const edges=new Map();let volume=0,degenerate=0;
  for(const t of surfaceTriangles(geometry)){volume+=t.a.dot(t.b.clone().cross(t.c))/6;if(t.getArea()<1e-14)degenerate++;
    const keys=[t.a,t.b,t.c].map(p=>p.toArray().join(','));for(let i=0;i<3;i++){const a=keys[i],b=keys[(i+1)%3],key=[a,b].sort().join('/'),e=edges.get(key)??{count:0,sign:0};e.count++;e.sign+=a<b?1:-1;edges.set(key,e);}}
  const unmatchedEdges=[...edges.values()].filter(e=>e.count!==2||e.sign!==0).length;
  return{volume,degenerate,unmatchedEdges,closed:volume>0&&!degenerate&&!unmatchedEdges};
}
const parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,family:u.families[name],topology:topology(mesh.geometry),solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)})),
  pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family||['wheel','pump','catch'].includes(a.family)).map(b=>({a,b,checks:0,intrusions:0,maximumDepth:0,worst:null}))),
  times=process.env.PROBE_TIMES?process.env.PROBE_TIMES.split(',').map(Number):[0,.08,.5,2,2.5,2.69,3.5,5,6.49,6.94,7.5,8.07,10.69,14.94,16],
  poses=times.map(time=>{const r=data.rows.reduce((a,b)=>Math.abs(a.time-time)<Math.abs(b.time-time)?a:b);return{time:r.time,wheelAngle:r.q[0],catchAngle:r.q[1]-r.q[0],pumpHeight:r.q[2],camAngle:data.angularSpeed*r.time};}),ropeStates=[];
for(const key of [0,1,2])for(const sign of [-1,1]){
  const r=data.rows.reduce((a,b)=>sign*a.q[key]>sign*b.q[key]?a:b);
  if(!poses.some(p=>p.time===r.time))poses.push({time:r.time,wheelAngle:r.q[0],catchAngle:r.q[1]-r.q[0],pumpHeight:r.q[2],camAngle:data.angularSpeed*r.time});
}
for(const state of poses){
  model.setState(state);const rope=parts.find(p=>p.name==='pumpRope');rope.topology=topology(rope.mesh.geometry);rope.solid=solidSurface(rope.mesh.geometry);rope.points=surfacePoints(rope.mesh.geometry);
  ropeStates.push({time:state.time,...rope.topology,length:u.ropeCenterline.length,amplitude:u.ropeCenterline.amplitude});
  for(const p of parts)p.box=p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld);
  for(const pair of pairs){if(!pair.a.box.intersectsBox(pair.b.box))continue;
    for(const[a,b]of [[pair.a,pair.b],[pair.b,pair.a]]){if(!b.topology.closed)continue;const transform=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for(const p of a.points){pair.checks++;const q=p.clone().applyMatrix4(transform);if(!b.solid.inside(q))continue;const depth=b.solid.distance(q);if(depth<=1e-6)continue;
        pair.intrusions++;if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.worst={state,sampleOn:a.name,inside:b.name,local:q.toArray()};}}
    }
  }
  console.log({time:state.time,intrusions:pairs.reduce((n,p)=>n+p.intrusions,0),rope:rope.topology});
}
verify();verifyStudySources(sources);const result=pairs.map(({a,b,...p})=>({a:a.name,b:b.name,...p})),report={movement:86,status:completeMotion?'complete-hardware-solved-trajectory-screen':'complete-hardware-prescribed-trajectory-screen',input,completeMotion,
  passed:parts.every(p=>p.topology.closed)&&ropeStates.every(p=>p.closed)&&result.every(p=>!p.intrusions),mechanicsPassed:false,productionChanged:false,candidateIntegrated:false,
  topology:parts.map(p=>({name:p.name,family:p.family,...p.topology})),ropeStates,poses,pairs:result,checks:result.reduce((n,p)=>n+p.checks,0),intrusions:result.reduce((n,p)=>n+p.intrusions,0),
  wheelMass:familyMass(u.parts,u.families,'wheel'),hardware:u.completeHardware,sources,
  qualification:'All independent families plus internal wheel, catch and pump pairs are sampled, including coordinate extrema. '+(completeMotion?'The retained trajectory includes the actual winding rim and clamp mass. ':'The earlier core trajectory prescribes hardware poses; its wheel mass omits the winding rim. ')+
    'Closed topology and finite surface samples do not establish continuous clearance.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,poses:poses.length,pairs:result.filter(p=>p.intrusions)});if(!report.passed)process.exitCode=1;
