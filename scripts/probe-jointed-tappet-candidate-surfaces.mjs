import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';import * as THREE from'three';
import{makeJointedTappetCandidate}from'./lib/jointed-tappet-candidate.mjs';import{solidSurface,surfacePoints}from'../tests/helpers/solid-surface.mjs';
const c=makeJointedTappetCandidate(),u=c.root.userData,reportFile=process.env.TRAJECTORY??'artifacts/review/076-tappet-damping-range.json',trajectory=JSON.parse(await readFile(reportFile,'utf8')),
  run=trajectory.rows.find(r=>r.parameters?.period===24&&r.parameters?.damping?.[0]===3),motion=run.samples,pitch=u.geometry.pitch,
  geometrySource=trajectory.sources.find(s=>s.file==='scripts/lib/jointed-tappet-candidate.mjs');
if(createHash('sha256').update(await readFile(geometrySource.file)).digest('hex')!==geometrySource.sha256)throw new Error('Candidate source differs from trajectory');
const parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,family:u.families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)})),pairs=[];
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family)pairs.push({a:parts[i],b:parts[j],checks:0,inside:0,maximumDepth:0});
const selected=new Map();
for(let i=0;i<motion.length;i+=8)selected.set(i,motion[i]);
for(let k=0;k<4;k++)for(const sign of [-1,1]){let best=0;for(let i=1;i<motion.length;i++)if(sign*motion[i].x[k]>sign*motion[best].x[k])best=i;selected.set(best,motion[best]);}
const states=[{time:0,x:[0,0,u.geometry.wheelStart,0]},...selected.values()];
for(let i=0;i<25;i++)states.push({time:7.2+(24-7.2)*i/24,x:run.final.x});
const readings=[];
for(let i=0;i<states.length;i++){
 const s=states[i];u.setState({q:s.x[0],alpha:s.x[1],theta:s.x[2],holdingAngle:s.x[3],driverAngle:-2*Math.PI*s.time/24});
 let checks=0,inside=0;
 for(const pair of pairs)for(const[a,b]of[[pair.a,pair.b],[pair.b,pair.a]]){
  const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
  for(const sample of a.points){
   pair.checks++;checks++;const point=sample.clone().applyMatrix4(matrix);if(!b.solid.inside(point))continue;const depth=b.solid.distance(point);if(!Number.isFinite(depth))throw new Error('Nonfinite distance');
   if(depth<=1e-6)continue;pair.inside++;inside++;if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.witness={pose:i,time:s.time,x:s.x,from:a.name,to:b.name,point:point.toArray(),depth};}
  }
 }
 readings.push({pose:i,...s,checks,inside});if(i%10===0)console.log({pose:i,total:states.length,checks,inside});
}
const sources=[];for(const file of ['scripts/probe-jointed-tappet-candidate-surfaces.mjs','scripts/lib/jointed-tappet-candidate.mjs','scripts/lib/finite-plate-study.mjs','tests/helpers/solid-surface.mjs',reportFile])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const rows=pairs.map(({a,b,...p})=>({a:a.name,b:b.name,...p})),report={movement:76,status:'finite-candidate-independent-surface-screen',productionChanged:false,mechanicsPassed:false,passed:rows.every(r=>!r.inside),poses:states.length,partCount:parts.length,pairCount:rows.length,pairs:rows,readings,sources,checks:rows.reduce((s,r)=>s+r.checks,0),inside:rows.reduce((s,r)=>s+r.inside,0),qualification:'All independent rigid-family pairs, actual Float32 vertices, edge midpoints and triangle centers in both directions, with broad-phase boxes. Three-dimensional candidate on a sampled first-count trajectory plus the remainder of the full driver revolution. This is a sampled screen, not continuous clearance certification.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/076-directed-candidate-surfaces.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,poses:report.poses,pairCount:report.pairCount,checks:report.checks,inside:report.inside,failures:rows.filter(r=>r.inside)});process.exitCode=report.passed?0:1;
