import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeAlternatingPegPawlDrive} from '../src/simulation/alternating-peg-pawl.js';
import {sampleAlternatingPegPlayback} from './lib/alternating-peg-playback-study.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';

const file='artifacts/review/077-playback-candidate.json',data=JSON.parse(fs.readFileSync(file));
const candidate=makeAlternatingPegPawlDrive(),u=candidate.root.userData,selected=new Set([0]);
for(let i=0;i<=96;i++)selected.add(2*data.playbackPeriod*i/96);
for(const [cycle,table]of [data.first,data.steady].entries()){
 for(let k=1;k<=4;k++)for(const sign of [-1,1]){
  let best=0;for(let i=1;i<table.length;i++)if(sign*table[i][k]>sign*table[best][k])best=i;
  selected.add((cycle*data.physicsPeriod+table[best][0])*data.playbackPeriod/data.physicsPeriod);
 }
 // Midpoints surrounding the largest changes in each body's segment velocity
 // include catches and releases without relying on the original solver labels.
 for(let k=1;k<=4;k++){
  const jumps=[];
  for(let i=1;i<table.length-1;i++){
   const a=table[i-1],b=table[i],c=table[i+1],jump=Math.abs((c[k]-b[k])/(c[0]-b[0])-(b[k]-a[k])/(b[0]-a[0]));
   jumps.push({i,jump});
  }
  jumps.sort((a,b)=>b.jump-a.jump);
  for(const {i}of jumps.slice(0,6))for(const time of [(table[i-1][0]+table[i][0])/2,(table[i][0]+table[i+1][0])/2])selected.add((cycle*data.physicsPeriod+time)*data.playbackPeriod/data.physicsPeriod);
 }
}
const poses=[...selected].sort((a,b)=>a-b).map(time=>({time,turn:0}));
for(let turn=1;turn<24;turn++)for(const time of [0,1,2,3])poses.push({time,turn});
const cache=new WeakMap(),parts=Object.entries(u.parts).map(([name,mesh])=>{
 if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
 return{name,mesh,family:u.families[name],...cache.get(mesh.geometry)};
}),pairs=[];
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family)pairs.push({a:parts[i],b:parts[j],checks:0,inside:0,maximumDepth:0});
const readings=[];
for(let i=0;i<poses.length;i++){
 const pose=poses[i],state=sampleAlternatingPegPlayback(data,pose.time);state.theta+=pose.turn*data.pitch;u.setState(state);let checks=0,inside=0;
 for(const pair of pairs)for(const [a,b]of [[pair.a,pair.b],[pair.b,pair.a]]){
  const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
  for(const sample of a.points){
   pair.checks++;checks++;const point=sample.clone().applyMatrix4(matrix);if(!b.solid.inside(point))continue;
   const depth=b.solid.distance(point);if(!Number.isFinite(depth))throw Error('Nonfinite mesh distance');if(depth<=1e-6)continue;
   pair.inside++;inside++;if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.witness={pose:i,...pose,from:a.name,to:b.name,point:point.toArray(),depth};}
  }
 }
 readings.push({pose:i,...pose,checks,inside});if(i%30===0)console.log({pose:i,total:poses.length,checks,inside});
}
const rows=pairs.map(({a,b,...r})=>({a:a.name,b:b.name,...r})),files=[file,'scripts/probe-alternating-peg-production-surfaces.mjs','scripts/lib/alternating-peg-playback-study.mjs','src/simulation/alternating-peg-pawl.js','src/simulation/alternating-peg-geometry.js','src/simulation/alternating-peg-motion.js','src/data/alternating-peg-profile.js','scripts/lib/alternating-peg-contact-study.mjs','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'];
const report={movement:77,status:'playback-actual-solid-surface-screen',passed:rows.every(r=>!r.inside),productionChanged:true,mechanicsPassed:false,partCount:parts.length,pairCount:pairs.length,poses:poses.length,
 checks:rows.reduce((s,r)=>s+r.checks,0),inside:rows.reduce((s,r)=>s+r.inside,0),pairs:rows,readings,
 qualification:'All independent rigid-family pairs sampled in both directions using actual Float32 vertices, edge midpoints and triangle centers. Includes uniform poses, angular extrema, midpoints near sharp velocity changes, and four phases at every pin orientation. This is a sampled all-pair screen; primary pin-pawl contacts have a separate continuous interpolation certificate.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('artifacts/review/077-production-surfaces.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,poses:poses.length,checks:report.checks,inside:report.inside,failures:rows.filter(r=>r.inside)});process.exitCode=report.passed?0:1;
