import fs from 'node:fs';
import assert from 'node:assert/strict';
import source from './lib/weighted-clutch-source.mjs';
import {weightedClutchFitPoints} from './lib/weighted-clutch-source-fit.mjs';
import {makeWeightedClutchDistributedCandidate,THREE} from './lib/weighted-clutch-distributed-candidate.mjs';
import {distributedClutchSources} from './lib/weighted-clutch-distributed-sources.mjs';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {makeWeightedClutchNativeCouplings} from './lib/weighted-clutch-native-couplings.mjs';
import {makeWeightedClutchFastStud} from './lib/weighted-clutch-fast-stud.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-distributed-geometry',
  input='artifacts/review/087-first-distributed-source-fit.json',fit=readStudyReport(input),
  sources=freezeStudySources([...distributedClutchSources,input,'scripts/probe-weighted-clutch-distributed-geometry.mjs',
    'scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/weighted-clutch-native-couplings.mjs',
    'scripts/lib/weighted-clutch-native-contours.mjs','scripts/lib/weighted-clutch-fast-stud.mjs',
    'scripts/lib/weighted-clutch-native-stud.mjs','tests/helpers/solid-surface.mjs'],prefix),
  options={shifts:fit.selected.shifts,freeAngle:fit.freeAngle},model=makeWeightedClutchDistributedCandidate(options),
  u=model.root.userData,entries=Object.entries(u.parts),cache=new Map(),topologyCache=new Map(),topology=[],pairs=[],issues=[],
  family=name=>['shaft','pinion'].includes(u.families[name])?'output':u.families[name];
verifyStudySources(fit.sources);
const points={F:u.blocks.lever.getWorldPosition(new THREE.Vector3()),G:u.blocks.bell.getWorldPosition(new THREE.Vector3()),
  A:u.parts.leverRodPin.getWorldPosition(new THREE.Vector3()),B:u.parts.bellRodPin.getWorldPosition(new THREE.Vector3()),
  upper:u.blocks.bell.localToWorld(new THREE.Vector3(...u.linkage.parameters.upper0,0)),
  E:u.gears.E.getWorldPosition(new THREE.Vector3()),stud:u.parts.reversingStud.getWorldPosition(new THREE.Vector3())};
const projection=Object.entries(points).map(([name,p])=>{
  const pixel=[p.x*source.scale+source.origin[0],source.origin[1]-p.y*source.scale],
    delta=pixel.map((v,i)=>v-weightedClutchFitPoints[name][i]);
  return {name,original:weightedClutchFitPoints[name],pixel,delta,distance:Math.hypot(...delta)};
});
const maximumProjectedDisplacement=Math.max(...projection.map(r=>r.distance));
assert(maximumProjectedDisplacement<27);
assert.equal(u.gears.pinion.position.y,u.blocks.shaft.position.y);
assert.equal(u.gears.E.position.y,u.blocks.shaft.position.y);
for(const[name,mesh]of entries){
  if(!topologyCache.has(mesh.geometry))topologyCache.set(mesh.geometry,inspectWeightedClutchSolid(mesh.geometry));
  topology.push({name,...topologyCache.get(mesh.geometry)});
}
const topologyIssues=topology.filter(r=>r.components!==1||r.volume<=0||r.degenerate||r.wrongNormals||r.nonfinite||r.unmatchedEdges),
  boxes=new Map(entries.map(([name,m])=>{m.geometry.computeBoundingBox();return[name,m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)];}));
let independentPairs=0,separated=0,checks=0;
const prepare=mesh=>{
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  return cache.get(mesh.geometry);
};
for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const[an,a]=entries[i],[bn,b]=entries[j];if(family(an)===family(bn))continue;independentPairs++;
  if(!boxes.get(an).intersectsBox(boxes.get(bn))){separated++;continue;}
  for(const[fromName,from,toName,to]of [[an,a,bn,b],[bn,b,an,a]]){
    const src=prepare(from),dst=prepare(to),transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),point=new THREE.Vector3();
    let gap=.01,inside=0,witness=null;
    for(const p of src.points){
      checks++;point.copy(p).applyMatrix4(transform);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;
      const d=dst.surface.signedDistance(point,.01);if(d< -1e-6)inside++;
      if(d<gap){gap=d;witness=point.clone().applyMatrix4(to.matrixWorld).toArray();}
    }
    const row={from:fromName,to:toName,gap,inside,checks:src.points.length,witness};pairs.push(row);
    if(inside){issues.push(row);console.log(row);}
  }
}
const coupling=makeWeightedClutchNativeCouplings(model),stud=makeWeightedClutchFastStud(model),
  q=[0,u.lostMotion.parameters.shifterRight,0,0,0],couplings=coupling.query(q),initialStud=stud.evaluate(0,0);
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options,state:u.state,sourceAdjustments:u.sourceAdjustments,projection,maximumProjectedDisplacement,
  pinionCoaxialWithOutput:true,topology,topologyIssues,independentPairs,separated,checks,pairs,issues,couplings,initialStud,
  qualification:'One source-pose screen of the distributed candidate, including actual rendered point projections, closed-solid topology, native slot/fork/stud gaps and bidirectional hardware samples. The pinion axis is now exactly coaxial with the long output shaft. Initial analytic stud contact leaves a small positive native polygon gap. No full-motion clearance or transfer of the older dynamics is claimed.'},null,2)+'\n',{flag:'wx'});
console.log({solids:topology.length,topologyIssues,independentPairs,separated,checks,issues:issues.length,maximumProjectedDisplacement,
  minimumCouplingGap:Math.min(...couplings.map(c=>c.gap)),initialStudGap:initialStud.gap});
assert(!topologyIssues.length&&!issues.length&&couplings.every(c=>c.gap> -1e-9)&&initialStud.gap>=0);
