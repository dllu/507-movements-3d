import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/081-first-candidate',
 trajectory=process.env.PROBE_INPUT?JSON.parse(fs.readFileSync(process.env.PROBE_INPUT)):null,
 optionsFile=process.env.CANDIDATE_OPTIONS_FILE,
 options={...(trajectory?.geometry??(optionsFile?JSON.parse(fs.readFileSync(optionsFile)).options:{})),...JSON.parse(process.env.CANDIDATE_OPTIONS??'{}')},
 model=makeSpringRackCandidate(options),u=model.root.userData,topology=[];
for(const [name,mesh]of Object.entries(u.parts)){
 const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,edges=new Map();let volume=0,degenerate=0,wrongNormals=0;
 for(let i=0;i<(g.index?.count??p.count);i+=3){
  const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j),v=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
   cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
  if(cross.lengthSq()<1e-22){degenerate++;continue;}volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
  if(cross.dot(ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()))<=0)wrongNormals++;
  const keys=v.map(p=>p.toArray().join(','));for(let j=0;j<3;j++){
   const a=keys[j],b=keys[(j+1)%3],id=a<b?a+'/'+b:b+'/'+a,e=edges.get(id)??{count:0,sign:0};e.count++;e.sign+=a<b?1:-1;edges.set(id,e);
  }
 }
 const unmatched=[...edges].filter(([,e])=>e.count!==2||e.sign!==0);
 topology.push({name,volume,degenerate,wrongNormals,unmatchedEdges:unmatched.length,examples:unmatched.slice(0,3)});
}
const parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)})),pairs=[];
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(u.families[parts[i].name]!==u.families[parts[j].name]){
 pairs.push({a:parts[i].name,b:parts[j].name,i,j,checks:0,penetrations:0,maximumDepth:0,witness:null});
}
const count=Number(process.env.PROBE_POSES??101),states=trajectory?Array.from(new Set(Array.from({length:count},(_,i)=>Math.round(i*(trajectory.rows.length-1)/(count-1)))))
 .map(i=>trajectory.rows[i]).map(r=>({time:r.time,q:r.q,rackY:r.x[0]})):[{q:0,rackY:0}];
for(const state of states){
 model.setState(state);
 // The coil deforms in local coordinates. Rebuild its surface acceleration
 // structure and samples for every pose; rigid mesh structures remain valid.
 for(const part of parts)if(u.families[part.name]==='spring'){
  part.solid=solidSurface(part.mesh.geometry);part.points=surfacePoints(part.mesh.geometry);
 }
 const boxes=parts.map(p=>p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld));
 for(const record of pairs){const a=parts[record.i],b=parts[record.j];
 if(boxes[record.i].intersectsBox(boxes[record.j])){
  for(const [from,to]of [[a,b],[b,a]]){
   const matrix=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
   for(const sample of from.points){const point=sample.clone().applyMatrix4(matrix);record.checks++;
    if(!to.solid.box.containsPoint(point)||!to.solid.inside(point))continue;const depth=to.solid.distance(point);if(depth<=1e-6)continue;
    record.penetrations++;if(depth>record.maximumDepth){record.maximumDepth=depth;record.witness={state,from:from.name,to:to.name,point:point.toArray(),depth};}
   }
  }
 }
 }
}
const topologyIssues=topology.filter(t=>t.volume<=0||t.degenerate||t.wrongNormals||t.unmatchedEdges),failedPairs=pairs.filter(p=>p.penetrations),
 sources=['scripts/probe-spring-rack-candidate.mjs','scripts/lib/spring-rack-candidate.mjs','scripts/lib/spring-rack-source.mjs','scripts/lib/spring-rack-coil.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','tests/helpers/solid-surface.mjs',...(process.env.PROBE_INPUT?[process.env.PROBE_INPUT]:[]),...(optionsFile?[optionsFile]:[])].map((file,i)=>{
   const archive=prefix+'-probe-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
   return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
  }),report={movement:81,status:'isolated-source-pose-geometry-screen',productionChanged:false,mechanicsPassed:false,
 options,topology,topologyIssues,pairs,failedPairs,poses:states.length,states,checks:pairs.reduce((s,p)=>s+p.checks,0),penetrations:pairs.reduce((s,p)=>s+p.penetrations,0),
 maximumDepth:Math.max(...pairs.map(p=>p.maximumDepth)),masses:u.masses,sources,
 qualification:trajectory?'Closed oriented triangle surfaces and bidirectional actual mesh samples at selected loaded trajectory poses. This is a sampled screen, not a continuous collision certificate. Same rigid-family overlaps are excluded.':
 'Closed oriented triangle surfaces and bidirectional actual surface samples at the traced source pose. This is a geometry diagnostic; no contact-consistent pose or trajectory is claimed. Same rigid-family overlaps are excluded.'};
report.geometryPassed=topologyIssues.length===0&&failedPairs.length===0;
fs.writeFileSync(prefix+'-geometry.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({parts:topology.length,topologyIssues,independentPairs:pairs.length,checks:report.checks,penetrations:report.penetrations,
 failedPairs,maximumDepth:report.maximumDepth});if(!report.geometryPassed)process.exitCode=1;
