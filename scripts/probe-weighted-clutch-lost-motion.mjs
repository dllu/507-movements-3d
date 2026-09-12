import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate,THREE} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-lost-motion-solids',
 pinAdjustmentPixels=Number(process.env.PIN_ADJUSTMENT??75),steps=Number(process.env.PROBE_STEPS??12),
 frozen=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
 verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};
verify();assert(Number.isInteger(steps)&&steps>=2);
const sources=freezeStudySources(['scripts/probe-weighted-clutch-lost-motion.mjs','scripts/lib/weighted-clutch-lost-motion-candidate.mjs',
 'scripts/lib/weighted-clutch-lost-motion.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/weighted-clutch-candidate.mjs',
 'scripts/lib/weighted-clutch-source.mjs','scripts/lib/weighted-clutch-linkage.mjs','scripts/lib/study-report-io.mjs',
 'tests/helpers/solid-surface.mjs','src/simulation/bevel-geometry.js','src/simulation/jaw-clutch-geometry.js',
 'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js',
 'src/simulation/primitives.js'],prefix),model=makeWeightedClutchLostMotionCandidate({pinAdjustmentPixels}),u=model.root.userData,
 entries=Object.entries(u.parts),topologyCache=new Map(),topology=[];
for(const[name,mesh]of entries){
 if(!topologyCache.has(mesh.geometry))topologyCache.set(mesh.geometry,inspectWeightedClutchSolid(mesh.geometry));
 topology.push({name,...topologyCache.get(mesh.geometry)});
}
const topologyIssues=topology.filter(r=>r.components!==1||r.volume<=0||r.degenerate||r.wrongNormals||r.nonfinite||r.unmatchedEdges),
 cache=new Map(),pairCache=new Map(),poses=[],pairs=[],issues=[],family=name=>['shaft','pinion'].includes(u.families[name])?'output':u.families[name];
const prepare=mesh=>{
 if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
 return cache.get(mesh.geometry);
};
let checks=0,minimumSlotClearance=Infinity,maximumRodError=0;
for(const direction of ['leftward','rightward'])for(let step=0;step<=steps;step++){
 const fraction=step/steps,leverAngle=u.lostMotion.parameters.leverLeft*(direction==='leftward'?fraction:1-fraction),
  state=model.setState({leverAngle,direction}),pose=poses.length,boxes=new Map(entries.map(([name,m])=>{
   m.geometry.computeBoundingBox();return[name,m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)];
  }));
 let independentPairs=0,separated=0,reused=0,sampled=0,poseIssues=0;
 minimumSlotClearance=Math.min(minimumSlotClearance,state.slotClearance);
 const a=new THREE.Vector3(...u.linkage.parameters.armF,0).applyMatrix4(u.blocks.lever.matrixWorld),
  b=new THREE.Vector3(...u.linkage.parameters.armG,0).applyMatrix4(u.blocks.bell.matrixWorld);
 maximumRodError=Math.max(maximumRodError,Math.abs(a.distanceTo(b)-u.linkage.parameters.rodLength));
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const[an,a]=entries[i],[bn,b]=entries[j];if(family(an)===family(bn))continue;independentPairs++;
  if(!boxes.get(an).intersectsBox(boxes.get(bn))){separated++;continue;}
  const transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld),key=[an,bn,...transform.elements].join(',');
  if(pairCache.has(key)){
   reused++;const cached=pairCache.get(key);for(const issue of cached.filter(r=>r.inside)){issues.push({...issue,pose,reused:true});poseIssues++;}continue;
  }
  const pair=[];
  for(const[fromName,from,toName,to,t]of [[an,a,bn,b,transform],[bn,b,an,a,transform.clone().invert()]]){
   const src=prepare(from),dst=prepare(to),point=new THREE.Vector3();let gap=.01,inside=0,witness=null;
   for(const p of src.points){
    checks++;point.copy(p).applyMatrix4(t);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;
    const d=dst.surface.signedDistance(point,.01);if(d<-1e-6)inside++;
    if(d<gap){gap=d;witness={local:point.toArray(),world:point.clone().applyMatrix4(to.matrixWorld).toArray()};}
   }
   const row={pose,from:fromName,to:toName,gap,inside,checks:src.points.length,witness};pair.push(row);pairs.push(row);
   if(inside){issues.push(row);poseIssues++;console.log(JSON.stringify(row));}
  }
  pairCache.set(key,pair);sampled++;
 }
 const row={pose,leverAngle,direction,state,independentPairs,separated,reused,sampled,issues:poseIssues};poses.push(row);
 console.log(JSON.stringify({pose,direction,degrees:leverAngle*180/Math.PI,independentPairs,separated,reused,sampled,issues:poseIssues}));
}
verify();verifyStudySources(sources);
const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,pinAdjustmentPixels,steps,sources,
 topology,topologyIssues,minimumSlotClearance,maximumRodError,checks,poses,pairs,issues,
 qualification:'Closed-solid audit and sampled diagnostic forward/return poses of the slot-coupled hypothesis. Unchanged relative mesh transforms reuse their exact source-pose sample results. Motor/output angles are held at zero. These poses are not a time trajectory, and this screen does not establish gravity, useful stud forces, loaded clutch engagement or continuous motion clearance.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({solids:topology.length,topologyIssues,poses:poses.length,checks,issues:issues.length,minimumSlotClearance,maximumRodError});
if(topologyIssues.length||issues.length||minimumSlotClearance<0||maximumRodError>1e-12)process.exitCode=1;
