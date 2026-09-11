import fs from 'node:fs';import crypto from 'node:crypto';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const trajectoryFile=process.env.PROBE_TRAJECTORY||'artifacts/review/077-long-lip-clock-slow.json',data=JSON.parse(fs.readFileSync(trajectoryFile)),
 candidate=makeAlternatingPegCandidate(data.geometry),u=candidate.root.userData,selected=new Set([0]);
for(let i=0;i<=64;i++)selected.add(Math.round(i*2*data.parameters.period/(64*data.dt)));
for(let cycle=0;cycle<2;cycle++)for(let coordinate=0;coordinate<4;coordinate++)for(const sign of [-1,1]){
 let best=Math.round(cycle*data.parameters.period/data.dt),end=Math.round((cycle+1)*data.parameters.period/data.dt),value=r=>coordinate===0?r.q:r.x[coordinate-1];
 for(let i=best+1;i<=end;i++)if(sign*value(data.rows[i])>sign*value(data.rows[best]))best=i;selected.add(best);
}
let previous='',lastEvent=-Infinity;
for(let i=0;i<data.rows.length&&data.rows[i].time<=2*data.parameters.period;i++){
 const r=data.rows[i],signature=[...new Set((r.contacts??[]).filter(c=>c.impulse>1e-6).map(c=>c.key+':'+c.pin))].sort().join(',');
 if(signature!==previous&&r.time-lastEvent>.04){selected.add(i);lastEvent=r.time;}previous=signature;
}
const poses=[...selected].sort((a,b)=>a-b).map(index=>({index,turn:0})),critical=[0,...[1,2].map(coordinate=>{let best=0;for(let i=1;i<data.rows.length;i++)if(data.rows[i].x[coordinate]<data.rows[best].x[coordinate])best=i;return best;})];
for(let turn=1;turn<24;turn++)for(const index of critical)poses.push({index,turn});
const cache=new WeakMap(),parts=Object.entries(u.parts).map(([name,mesh])=>{
 if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
 return{name,mesh,family:u.families[name],...cache.get(mesh.geometry)};
}),pairs=[];
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family)pairs.push({a:parts[i],b:parts[j],checks:0,inside:0,maximumDepth:0});
const readings=[];
for(let i=0;i<poses.length;i++){
 const {index,turn}=poses[i],state=data.rows[index],theta=state.x[0]+turn*u.geometry.pitch;
 u.setState({q:state.q,theta,upperAngle:state.x[1],lowerAngle:state.x[2]});let checks=0,inside=0;
 for(const pair of pairs)for(const[a,b]of[[pair.a,pair.b],[pair.b,pair.a]]){
  const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
  for(const sample of a.points){
   pair.checks++;checks++;const point=sample.clone().applyMatrix4(matrix);if(!b.solid.inside(point))continue;
   const depth=b.solid.distance(point);if(!Number.isFinite(depth))throw Error('Nonfinite mesh distance');if(depth<=1e-6)continue;
   pair.inside++;inside++;if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.witness={pose:i,index,time:state.time,turn,from:a.name,to:b.name,point:point.toArray(),depth};}
  }
 }
 readings.push({pose:i,index,time:state.time,turn,checks,inside});if(i%20===0)console.log({pose:i,total:poses.length,checks,inside});
}
const rows=pairs.map(({a,b,...r})=>({a:a.name,b:b.name,...r})),files=[trajectoryFile,'scripts/probe-alternating-peg-surfaces.mjs','scripts/lib/alternating-peg-candidate.mjs','scripts/lib/alternating-peg-contact-study.mjs','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'],
 report={movement:77,status:'actual-solid-surface-screen',passed:rows.every(r=>!r.inside),productionChanged:false,mechanicsPassed:false,partCount:parts.length,pairCount:pairs.length,poses:poses.length,
  checks:rows.reduce((s,r)=>s+r.checks,0),inside:rows.reduce((s,r)=>s+r.inside,0),pairs:rows,readings,
  qualification:'Actual Float32 vertices, edge midpoints and triangle centers from every pair of independent rigid families, both directions with mesh boxes. The first two cycles include uniform poses, angular extrema and pin-contact changes, plus three critical poses at all 24 wheel orientations. A sampled all-pair screen, not a continuous clearance certificate.',
  sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
const output=process.env.PROBE_OUTPUT||'artifacts/review/077-long-lip-surfaces.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log({output,passed:report.passed,poses:poses.length,checks:report.checks,inside:report.inside,failures:rows.filter(r=>r.inside)});if(!report.passed)process.exitCode=1;
