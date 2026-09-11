import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeJointedTappetCounter} from '../src/simulation/jointed-tappet.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const c=makeJointedTappetCounter(),u=c.root.userData,table=u.profile.first,selected=new Set([0,.53,3.26525]);
for(let i=0;i<table.length-1;i+=149)selected.add((table[i][0]+table[i+1][0])/4);
for(let k=1;k<5;k++)for(const sign of [-1,1]){let best=0;for(let i=1;i<table.length;i++)if(sign*table[i][k]>sign*table[best][k])best=i;selected.add(table[best][0]/2);}
for(let i=0;i<25;i++)selected.add(3.6+8.4*i/24);
for(let tooth=1;tooth<20;tooth++)for(const time of [.53,3,3.26525,4])selected.add(tooth*12+time);
const times=[...selected].sort((a,b)=>a-b),parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,family:u.families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)})),pairs=[];
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family)pairs.push({a:parts[i],b:parts[j],checks:0,inside:0,maximumDepth:0});
const readings=[];
for(let i=0;i<times.length;i++){
 const time=times[i];c.update(time);let checks=0,inside=0;
 for(const pair of pairs)for(const[a,b]of[[pair.a,pair.b],[pair.b,pair.a]]){
  const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
  for(const sample of a.points){
   pair.checks++;checks++;const point=sample.clone().applyMatrix4(matrix);if(!b.solid.inside(point))continue;const depth=b.solid.distance(point);if(!Number.isFinite(depth))throw new Error('Nonfinite distance');
   if(depth<=1e-6)continue;pair.inside++;inside++;if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.witness={pose:i,time,from:a.name,to:b.name,point:point.toArray(),depth};}
  }
 }
 readings.push({pose:i,time,checks,inside});if(i%25===0)console.log({pose:i,total:times.length,checks,inside});
}
const sources=[];for(const file of ['scripts/probe-jointed-tappet-production-surfaces.mjs','src/simulation/jointed-tappet.js','src/simulation/jointed-tappet-motion.js','src/simulation/finite-plate-geometry.js','src/simulation/jointed-tappet-contact.js','src/data/jointed-tappet-profile.js','tests/helpers/solid-surface.mjs'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const rows=pairs.map(({a,b,...p})=>({a:a.name,b:b.name,...p})),report={movement:76,status:'production-cached-motion-independent-surface-screen',passed:rows.every(r=>!r.inside),poses:times.length,partCount:parts.length,pairCount:rows.length,pairs:rows,readings,sources,checks:rows.reduce((s,r)=>s+r.checks,0),inside:rows.reduce((s,r)=>s+r.inside,0),qualification:'Actual Float32 vertices, edge midpoints and triangle centers from all independent rigid-family pairs, both directions with broad-phase boxes. Selected cached segment interiors, angular extrema, remainder of the driver turn and four critical poses on every tooth orientation. This sampled all-pair screen complements the continuous primary-contact certificate; it is not an all-pair continuous clearance proof.'};
await writeFile('artifacts/review/076-production-surfaces.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,poses:report.poses,pairCount:report.pairCount,checks:report.checks,inside:report.inside,failures:rows.filter(r=>r.inside)});process.exitCode=report.passed?0:1;
