import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {surfaceTriangles,surfacePoints,solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-finite-rope-dynamics.json.gz',data=readStudyReport(input);verifyStudySources(data.sources);
const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-finite-rope-surfaces',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
const verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const model=makePumpCatchCandidate(),u=model.root.userData,parts=Object.entries(u.parts).map(([name,mesh])=>{
  const edges=new Map();let volume=0,degenerate=0;
  for(const t of surfaceTriangles(mesh.geometry)){volume+=t.a.dot(t.b.clone().cross(t.c))/6;if(t.getArea()<1e-14)degenerate++;
    const keys=[t.a,t.b,t.c].map(p=>p.toArray().join(','));for(let i=0;i<3;i++){const a=keys[i],b=keys[(i+1)%3],key=[a,b].sort().join('/'),e=edges.get(key)??{count:0,sign:0};e.count++;e.sign+=a<b?1:-1;edges.set(key,e);}}
  const unmatchedEdges=[...edges.values()].filter(e=>e.count!==2||e.sign!==0).length;
  return{name,mesh,family:u.families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry),topology:{volume,degenerate,unmatchedEdges,closed:volume>0&&!degenerate&&!unmatchedEdges}};
});
const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family).map(b=>({a,b,checks:0,intrusions:0,maximumDepth:0,worst:null})));
const poses=Array.from({length:101},(_,i)=>{const r=data.rows[Math.round((data.rows.length-1)*i/100)];return{name:'loaded-'+i,time:r.time,wheelAngle:r.q[0],camAngle:data.angularSpeed*r.time,catchAngle:r.q[1]-r.q[0]};});
const sourceIntrusions=[];
for(const state of poses){model.setState(state);for(const p of parts)p.box=p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld);
  for(const pair of pairs){if(!pair.a.box.intersectsBox(pair.b.box))continue;
    for(const[a,b]of [[pair.a,pair.b],[pair.b,pair.a]]){
      if(!b.topology.closed)continue;const transform=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for(const p of a.points){pair.checks++;const q=p.clone().applyMatrix4(transform);if(!b.solid.inside(q))continue;const depth=b.solid.distance(q);if(depth<=1e-6)continue;
        pair.intrusions++;if(state.name==='source'&&sourceIntrusions.length<30)sourceIntrusions.push({a:a.name,b:b.name,depth,local:q.toArray()});
        if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.worst={state,sampleOn:a.name,inside:b.name,local:q.toArray()};}}
    }
  }
}
verify();verifyStudySources(data.sources);const sources=freezeStudySources([input,...data.sources.map(s=>s.file),'scripts/probe-pump-catch-loaded.mjs','scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js',
  'tests/helpers/solid-surface.mjs','scripts/lib/study-report-io.mjs'],prefix),result=pairs.map(({a,b,...p})=>({a:a.name,b:b.name,...p}));
const report={movement:86,status:'solved-finite-rope-core-surface-diagnostic',input,passed:parts.every(p=>p.topology.closed)&&result.every(p=>!p.intrusions),productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,
  topology:parts.map(p=>({name:p.name,family:p.family,...p.topology})),pairs:result,poses:poses.length,pairCount:pairs.length,sourceIntrusions,
  checks:result.reduce((s,p)=>s+p.checks,0),intrusions:result.reduce((s,p)=>s+p.intrusions,0),sources,
  qualification:'All independent core pairs sampled at 101 solved motion knots. Rope, load and rear input hardware meshes are still absent. This is a finite surface-sample diagnostic, not continuous clearance or complete assembly qualification.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,topology:report.topology,pairs:result.filter(p=>p.intrusions),sourceIntrusions:sourceIntrusions.slice(0,4),sources:undefined});

if(!report.passed)process.exitCode=1;
