import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchCandidate,THREE} from './lib/weighted-clutch-candidate.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-static-clearance',
  frozen=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
  verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};
verify();
const sources=freezeStudySources(['scripts/probe-weighted-clutch-static-clearance.mjs','scripts/lib/weighted-clutch-candidate.mjs',
  'scripts/lib/weighted-clutch-source.mjs','scripts/lib/weighted-clutch-linkage.mjs','scripts/lib/study-report-io.mjs',
  'tests/helpers/solid-surface.mjs','src/simulation/bevel-geometry.js','src/simulation/jaw-clutch-geometry.js',
  'src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js',
  'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js'],prefix),
  model=makeWeightedClutchCandidate(),u=model.root.userData,entries=Object.entries(u.parts),cache=new Map(),rows=[],issues=[],boxRows=[];
model.setState();
const boxes=new Map(entries.map(([name,mesh])=>{
  mesh.geometry.computeBoundingBox();return[name,mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)];
}));
const rigidFamily=name=>['shaft','pinion'].includes(u.families[name])?'output':u.families[name];
// D is engaged with C in the source pose, but they remain independent here:
// their finite jaw boundary must be tested. The sliding sleeve and shaft
// are also independent because their key and bore permit axial motion.
function prepare(mesh){
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  return cache.get(mesh.geometry);
}
let independentPairs=0,boxSeparated=0,sameFamily=0,checks=0;
for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const[aName,a]=entries[i],[bName,b]=entries[j];
  if(rigidFamily(aName)===rigidFamily(bName)){sameFamily++;continue;}
  independentPairs++;
  if(!boxes.get(aName).intersectsBox(boxes.get(bName))){boxSeparated++;boxRows.push([aName,bName]);continue;}
  for(const[fromName,from,toName,to]of [[aName,a,bName,b],[bName,b,aName,a]]){
    const source=prepare(from),target=prepare(to),transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),point=new THREE.Vector3();
    let gap=.01,inside=0,localChecks=0,witness=null;
    for(const p of source.points){
      point.copy(p).applyMatrix4(transform);localChecks++;
      if(target.surface.box.distanceToPoint(point)>=gap&&gap>0)continue;
      const distance=target.surface.signedDistance(point,.01);
      if(distance<-1e-6)inside++;
      if(distance<gap){gap=distance;witness={point:point.toArray(),worldPoint:point.clone().applyMatrix4(to.matrixWorld).toArray()};}
    }
    const row={from:fromName,to:toName,gap,inside,checks:localChecks,witness};rows.push(row);checks+=localChecks;
    if(inside){issues.push(row);console.log(JSON.stringify(row));}
  }
}
verify();verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  independentPairs,boxSeparated,sameFamily,checks,rows,issues,boxRows,sources,
  qualification:'One measured source pose only. Each independent pair is either separated by transformed mesh bounds or screened bidirectionally at actual triangle vertices, edge midpoints and centroids. Same-family attachments are excluded; only the fixed output shaft/pinion attachment shares one family. No continuous or reversal clearance is established.'},null,2)+'\n',{flag:'wx'});
console.log({independentPairs,boxSeparated,sameFamily,sampledDirections:rows.length,checks,issues:issues.length});if(issues.length)process.exitCode=1;
