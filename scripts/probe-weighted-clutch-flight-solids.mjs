import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate,THREE} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {weightedClutchFlightState,selectWeightedClutchFlightPoses} from './lib/weighted-clutch-flight-poses.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-flight-solids',
 inputs=['CCW','CW'].map(d=>'artifacts/review/087-sixteenth-step-flight-'+d+'.json.gz'),reports=inputs.map(readStudyReport),
 samples=reports.flatMap(selectWeightedClutchFlightPoses),
 baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
 verify=()=>{for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);},
 sources=freezeStudySources([...reports[0].sources.map(s=>s.file),'scripts/probe-weighted-clutch-flight-solids.mjs',
  'scripts/lib/weighted-clutch-flight-poses.mjs',...inputs],prefix),
 model=makeWeightedClutchLostMotionCandidate(),u=model.root.userData,native=makeWeightedClutchNativeStud(model),
 entries=Object.entries(u.parts),topologyCache=new Map(),cache=new Map(),pairCache=new Map(),topology=[],poses=[],pairs=[],issues=[],
 family=name=>['shaft','pinion'].includes(u.families[name])?'output':u.families[name];
verify();for(const r of reports)verifyStudySources(r.sources);
for(const[name,mesh]of entries){
 if(!topologyCache.has(mesh.geometry))topologyCache.set(mesh.geometry,inspectWeightedClutchSolid(mesh.geometry));
 topology.push({name,...topologyCache.get(mesh.geometry)});
}
const topologyIssues=topology.filter(r=>r.components!==1||r.volume<=0||r.degenerate||r.wrongNormals||r.nonfinite||r.unmatchedEdges),
 prepare=mesh=>{
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  return cache.get(mesh.geometry);
 };
let checks=0,minimumStudGap=Infinity,maximumShifterError=0;
for(const sample of samples){
 const state=weightedClutchFlightState(model,sample.row,sample.direction),pose=poses.length,
  boxes=new Map(entries.map(([name,m])=>{m.geometry.computeBoundingBox();return[name,m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)];})),
  exact=native.evaluate(sample.row.q,sample.row.e),expectedShifter=reports.find(r=>r.direction===sample.direction).parameters.shifterAngle;
 minimumStudGap=Math.min(minimumStudGap,exact.gap);maximumShifterError=Math.max(maximumShifterError,Math.abs(state.shifterAngle-expectedShifter));
 let independentPairs=0,separated=0,reused=0,sampled=0,poseIssues=0;
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const[an,a]=entries[i],[bn,b]=entries[j];if(family(an)===family(bn))continue;independentPairs++;
  if(!boxes.get(an).intersectsBox(boxes.get(bn))){separated++;continue;}
  const transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld),key=[an,bn,...transform.elements].join(',');
  if(pairCache.has(key)){
   reused++;for(const issue of pairCache.get(key).filter(r=>r.inside)){issues.push({...issue,pose,reused:true});poseIssues++;}continue;
  }
  const pair=[];
  for(const[fromName,from,toName,to,t]of [[an,a,bn,b,transform],[bn,b,an,a,transform.clone().invert()]]){
   const src=prepare(from),dst=prepare(to),point=new THREE.Vector3();let gap=.01,inside=0,witness=null;
   for(const p of src.points){
    checks++;point.copy(p).applyMatrix4(t);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;
    const d=dst.surface.signedDistance(point,.01);if(d< -1e-6)inside++;
    if(d<gap){gap=d;witness={local:point.toArray(),world:point.clone().applyMatrix4(to.matrixWorld).toArray()};}
   }
   const row={pose,from:fromName,to:toName,gap,inside,checks:src.points.length,witness};pair.push(row);pairs.push(row);
   if(inside){issues.push(row);poseIssues++;console.log(JSON.stringify(row));}
  }
  pairCache.set(key,pair);sampled++;
 }
 const row={pose,name:sample.name,direction:sample.direction,time:sample.row.time,q:sample.row.q,v:sample.row.v,e:sample.row.e,
  state,contact:exact,independentPairs,separated,reused,sampled,issues:poseIssues};poses.push(row);
 console.log({pose,name:sample.name,direction:sample.direction,time:sample.row.time,issues:poseIssues,checks});
}
verify();verifyStudySources(sources);
const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
 inputs:inputs.map(file=>({file,sha256:hashStudyFile(file)})),sources,topology,topologyIssues,minimumStudGap,maximumShifterError,checks,poses,pairs,issues,
 qualification:'Sixteen poses from the timed unilateral lifting/free-flight subsystem. Motor phase preserves the engaged clutch; the shifter is fixed until arrival just before the opposite slot end. All independent hardware pairs use native bounds or bidirectional surface samples; these can miss narrow edge intersections and do not establish continuous clearance. Stud/G additionally uses exact native polygon separation.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({solids:topology.length,poses:poses.length,checks,issues:issues.length,topologyIssues,minimumStudGap,maximumShifterError});
assert(!topologyIssues.length&&!issues.length&&minimumStudGap> -2e-9&&maximumShifterError<1e-12);
