import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate,THREE} from './lib/weighted-clutch-independent-candidate.mjs';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {makeWeightedClutchNativeCouplings} from './lib/weighted-clutch-native-couplings.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-gravity-shift-solids',
 inputs=['CCW','CW'].map(d=>'artifacts/review/087-sixteenth-step-gravity-shift-'+d+'.json.gz'),reports=inputs.map(readStudyReport),
 sources=freezeStudySources([...reports[0].sources.map(s=>s.file),'scripts/probe-weighted-clutch-gravity-shift-solids.mjs',...inputs],prefix),
 model=makeWeightedClutchIndependentCandidate(),u=model.root.userData,jaws=makeWeightedClutchNativeJaws(model),coupling=makeWeightedClutchNativeCouplings(model),
 entries=Object.entries(u.parts),topologyCache=new Map(),cache=new Map(),pairCache=new Map(),topology=[],poses=[],pairs=[],issues=[],
 family=name=>['shaft','pinion'].includes(u.families[name])?'output':u.families[name];
for(const r of reports)verifyStudySources(r.sources);
for(const[name,mesh]of entries){if(!topologyCache.has(mesh.geometry))topologyCache.set(mesh.geometry,inspectWeightedClutchSolid(mesh.geometry));topology.push({name,...topologyCache.get(mesh.geometry)});}
const topologyIssues=topology.filter(r=>r.components!==1||r.volume<=0||r.degenerate||r.wrongNormals||r.nonfinite||r.unmatchedEdges),
 prepare=mesh=>{if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return cache.get(mesh.geometry);};
let checks=0,minimumJawGap=Infinity,minimumCouplingGap=Infinity;
for(const report of reports){
 const samples=[['slot-impact',report.start],['fork-impact',report.rows.find(r=>r.time>=report.events[0].time)],
  ...[.25,.5,.75].map(t=>['neutral-'+t,report.rows.reduce((a,b)=>Math.abs(a.time-report.end.time*t)<Math.abs(b.time-report.end.time*t)?a:b)]),['jaw-impact',report.end]];
 for(const[name,row]of samples){
  const state=model.setCoordinates(row.q,row.phase.input),pose=poses.length,
   boxes=new Map(entries.map(([name,m])=>{m.geometry.computeBoundingBox();return[name,m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)];})),
   nativeJaws=['left','right'].map(side=>jaws.evaluate(side,row.phase.output+(side==='left'?-1:1)*u.geometry.mainRatio*row.phase.input,row.q[2])),
   nativeCouplings=coupling.query(row.q);
  minimumJawGap=Math.min(minimumJawGap,...nativeJaws.map(j=>j.gap));minimumCouplingGap=Math.min(minimumCouplingGap,...nativeCouplings.map(c=>c.gap));
  let independentPairs=0,separated=0,reused=0,sampled=0,poseIssues=0;
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const[an,a]=entries[i],[bn,b]=entries[j];if(family(an)===family(bn))continue;independentPairs++;
   if(!boxes.get(an).intersectsBox(boxes.get(bn))){separated++;continue;}
   const transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld),key=[an,bn,...transform.elements].join(',');
   if(pairCache.has(key)){reused++;for(const issue of pairCache.get(key).filter(r=>r.inside)){issues.push({...issue,pose,reused:true});poseIssues++;}continue;}
   const pair=[];
   for(const[fromName,from,toName,to,t]of [[an,a,bn,b,transform],[bn,b,an,a,transform.clone().invert()]]){
    const src=prepare(from),dst=prepare(to),point=new THREE.Vector3();let gap=.01,inside=0,witness=null;
    for(const p of src.points){
     checks++;point.copy(p).applyMatrix4(t);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;
     const d=dst.surface.signedDistance(point,.01);if(d< -1e-6)inside++;
     if(d<gap){gap=d;witness={local:point.toArray(),world:point.clone().applyMatrix4(to.matrixWorld).toArray()};}
    }
    const result={pose,from:fromName,to:toName,gap,inside,checks:src.points.length,witness};pair.push(result);pairs.push(result);
    if(inside){issues.push(result);poseIssues++;console.log(result);}
   }
   pairCache.set(key,pair);sampled++;
  }
  poses.push({pose,name,direction:report.direction,time:row.time,q:row.q,v:row.v,phase:row.phase,state,nativeJaws,nativeCouplings,
   independentPairs,separated,reused,sampled,issues:poseIssues});console.log({pose,name,direction:report.direction,issues:poseIssues,checks});
 }
}
verifyStudySources(sources);const baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json');
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,
 inputs:inputs.map(file=>({file,sha256:hashStudyFile(file)})),topology,topologyIssues,poses,pairs,issues,checks,minimumJawGap,minimumCouplingGap,
 qualification:'Twelve independently posed slot/fork impact, neutral travel and first-jaw-contact states. Native slot/fork constraints and full projected-triangle jaw clearances supplement the surrounding hardware bounds and bidirectional surface samples. Other pairs remain subject to the known narrow-edge sampling limitation. No continuous clearance or post-jaw-impact trajectory is qualified.'},null,2)+'\n',{flag:'wx'});
console.log({solids:topology.length,poses:poses.length,checks,issues:issues.length,topologyIssues,minimumJawGap,minimumCouplingGap});
assert(!topologyIssues.length&&!issues.length&&minimumJawGap> -1e-9&&minimumCouplingGap> -1e-9);
