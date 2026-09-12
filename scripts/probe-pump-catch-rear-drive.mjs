import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchRearDriveCandidate} from './lib/pump-catch-rear-drive.mjs';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {familyMass} from '../src/simulation/finite-plate-geometry.js';
import {surfaceTriangles,surfacePoints,solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-rear-drive-surfaces',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
const verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const core=makePumpCatchCandidate(),model=makePumpCatchRearDriveCandidate(),u=model.root.userData,parts=Object.entries(u.parts).map(([name,mesh])=>{
  const edges=new Map();let volume=0,degenerate=0;
  for(const t of surfaceTriangles(mesh.geometry)){volume+=t.a.dot(t.b.clone().cross(t.c))/6;if(t.getArea()<1e-14)degenerate++;
    const keys=[t.a,t.b,t.c].map(p=>p.toArray().join(','));for(let i=0;i<3;i++){const a=keys[i],b=keys[(i+1)%3],key=[a,b].sort().join('/'),e=edges.get(key)??{count:0,sign:0};e.count++;e.sign+=a<b?1:-1;edges.set(key,e);}}
  const unmatchedEdges=[...edges.values()].filter(e=>e.count!==2||e.sign!==0).length;
  return{name,mesh,family:u.families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry),topology:{volume,degenerate,unmatchedEdges,closed:volume>0&&!degenerate&&!unmatchedEdges}};
});
const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family).map(b=>({a,b,checks:0,intrusions:0,maximumDepth:0,worst:null})));
// Deliberately prescribed poses diagnose hardware only. They are not proposed
// playback: stop contact and free catch motion still need to be solved.
const poses=[{name:'source',wheelAngle:0,camAngle:0,catchAngle:0},...Array.from({length:33},(_,i)=>({name:'coupled-sweep-'+i,wheelAngle:-i*.055,camAngle:-i*.055,catchAngle:0}))];
const unchangedMasses={};
for(const family of ['wheel','catch']){const before=familyMass(core.root.userData.parts,core.root.userData.families,family),after=familyMass(u.parts,u.families,family);assert.deepEqual(after,before);unchangedMasses[family]=after;}
for(const name of u.rearDrive.corePartNames){const a=core.root.userData.parts[name].geometry,b=u.parts[name].geometry;for(const key of Object.keys(a.attributes))assert.deepEqual(b.attributes[key].array,a.attributes[key].array);}
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
verify();const sources=freezeStudySources(['scripts/probe-pump-catch-rear-drive.mjs','scripts/lib/pump-catch-rear-drive.mjs','scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js',
  'tests/helpers/solid-surface.mjs','scripts/lib/study-report-io.mjs'],prefix),result=pairs.map(({a,b,...p})=>({a:a.name,b:b.name,...p}));
const report={movement:86,status:'rear-input-assembly-and-coupled-sweep-diagnostic',passed:parts.every(p=>p.topology.closed)&&result.every(p=>!p.intrusions),unchangedMasses,rearDrive:u.rearDrive,productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,
  topology:parts.map(p=>({name:p.name,family:p.family,...p.topology})),pairs:result,poses:poses.length,pairCount:pairs.length,sourceIntrusions,
  checks:result.reduce((s,p)=>s+p.checks,0),intrusions:result.reduce((s,p)=>s+p.intrusions,0),sources,
  qualification:'Source pose and a prescribed coupled sweep screen the complete rear input assembly. The thirteen original meshes and wheel/catch masses are unchanged. The new band follows ideal no-slip motion; finite traction is not solved. Pump rope/load geometry and complete motion remain unresolved. Sampling is not continuous clearance qualification.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,topology:report.topology,pairs:result.filter(p=>p.intrusions),sourceIntrusions:sourceIntrusions.slice(0,4),sources:undefined});

if(!report.passed)process.exitCode=1;
