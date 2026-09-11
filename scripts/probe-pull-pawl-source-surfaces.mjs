import fs from 'node:fs';
import crypto from 'node:crypto';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const candidate=makePullPawlCandidate(),u=candidate.root.userData,cache=new WeakMap(),
 parts=Object.entries(u.parts).map(([name,mesh])=>{
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  return{name,mesh,family:u.families[name],...cache.get(mesh.geometry)};
 }),pairs=[];
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family)pairs.push({a:parts[i],b:parts[j],checks:0,inside:0,maximumDepth:0});
u.setState(JSON.parse(process.env.SOURCE_STATE??'{}'));
for(const pair of pairs)for(const[a,b]of[[pair.a,pair.b],[pair.b,pair.a]]){
 const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
 if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
 for(const sample of a.points){
  pair.checks++;const point=sample.clone().applyMatrix4(matrix);if(!b.solid.inside(point))continue;
  const depth=b.solid.distance(point);if(!Number.isFinite(depth))throw Error('Nonfinite mesh distance');if(depth<=1e-6)continue;
  pair.inside++;if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.witness={from:a.name,to:b.name,point:point.toArray(),depth};}
 }
}
const rows=pairs.map(({a,b,...r})=>({a:a.name,b:b.name,...r})),
 files=['scripts/probe-pull-pawl-source-surfaces.mjs','scripts/lib/pull-pawl-candidate.mjs','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'],
 report={movement:78,status:'source-pose-actual-surface-screen',passed:rows.every(r=>!r.inside),productionChanged:false,mechanicsPassed:false,
  state:u.kinematics,partCount:parts.length,pairCount:pairs.length,poses:1,checks:rows.reduce((s,r)=>s+r.checks,0),inside:rows.reduce((s,r)=>s+r.inside,0),pairs:rows,
  qualification:'Actual Float32 vertices, edge midpoints and triangle centers from each pair of independent rigid families, both directions with mesh boxes. One static pose only; passing samples cannot certify full contact or clearance.',
  sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
const output=process.env.PROBE_OUTPUT??'artifacts/review/078-initial-candidate-surfaces.json';
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({output,passed:report.passed,pairs:pairs.length,checks:report.checks,inside:report.inside,failures:rows.filter(r=>r.inside)});if(!report.passed)process.exitCode=1;
