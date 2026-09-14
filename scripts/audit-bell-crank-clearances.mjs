import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoBellCrank} from '../src/simulation/mujoco-bell-crank/visual.js';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {bellCrankStudySources} from './lib/bell-crank-study-sources.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/126-clearances',options=JSON.parse(process.env.SIM_OPTIONS??'{}');
const times=process.env.TIMES?JSON.parse(process.env.TIMES):Array.from({length:65},(_,i)=>i/8);
assert(Array.isArray(times)&&times.length&&times.every(t=>Number.isFinite(t)&&t>=0));times.sort((a,b)=>a-b);
const sources=freezeStudySources([...bellCrankStudySources('scripts/audit-bell-crank-clearances.mjs'),'scripts/lib/weighted-clutch-solid-audit.mjs','tests/helpers/solid-surface.mjs'],prefix);
const v=makeMujocoBellCrank(await loadMujoco(),options),u=v.root.userData,entries=Object.entries(u.parts),prepared=new Map(),rows=[],closest=new Map(),motionBounds=new THREE.Box3();
const working=new Set(['drum/inputCord','backFlange/inputCord','frontFlange/inputCord']);
const clampPairs=new Set(['inputCord/inputGrip','outputCord/outputGrip']);
let queries=0,maximumUnintendedPenetration=0,maximumWorkingPenetration=0,maximumClampPenetration=0;
try{
 for(const[name,m]of entries){
  const topology=inspectWeightedClutchSolid(m.geometry);assert.equal(topology.components,1,name);assert(topology.volume>0,name);
  assert.equal(topology.unmatchedEdges+topology.degenerate+topology.nonfinite+topology.wrongNormals,0,name);
  prepared.set(name,{topology,surface:solidSurface(m.geometry),points:surfacePoints(m.geometry)});
 }
 for(const time of times){
  v.update(time);assert(Math.abs(v.physics.data.time-time)<v.physics.timestep+1e-9,'Native state did not reach requested pose');
  const boxes=new Map(),issues=[];
  for(const[name,m]of entries){
   if(name.endsWith('Cord'))prepared.set(name,{surface:solidSurface(m.geometry),points:surfacePoints(m.geometry)});
   const box=new THREE.Box3().setFromObject(m,true);boxes.set(name,box);motionBounds.union(box);
   assert(u.cameraFitBounds.containsBox(box),name+' outside camera bounds');
  }
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const[an,a]=entries[i],[bn,b]=entries[j],pair=[an,bn].sort().join('/');
   if(u.families[an]===u.families[bn]&&u.families[an]!=='cord')continue;
   if(!boxes.get(an).intersectsBox(boxes.get(bn)))continue;
   const isWorking=working.has(pair),isClamp=clampPairs.has(pair),tolerance=(isWorking||isClamp)? .001 : 1e-6;
   for(const[fromName,from,toName,to]of [[an,a,bn,b],[bn,b,an,a]]){
    const src=prepared.get(fromName),dst=prepared.get(toName),transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),point=new THREE.Vector3();
    let gap=.005,inside=0,witness;
    for(const q of src.points){
     point.copy(q).applyMatrix4(transform);if(dst.surface.box.distanceToPoint(point)>.005)continue;
     queries++;const signed=dst.surface.signedDistance(point,.005),d=signed<0?-dst.surface.distance(point):signed;
     if(isWorking)maximumWorkingPenetration=Math.max(maximumWorkingPenetration,-d);
     else if(isClamp)maximumClampPenetration=Math.max(maximumClampPenetration,-d);
     else maximumUnintendedPenetration=Math.max(maximumUnintendedPenetration,-d);
     if(d< -tolerance)inside++;
     if(d<gap){gap=d;witness=point.clone().applyMatrix4(to.matrixWorld).toArray();}
    }
    const row={from:fromName,to:toName,gap,inside,witness,time,kind:isWorking?'pulley contact':isClamp?'cord grip':'unintended'},key=fromName+'/'+toName;
    if(!closest.has(key)||closest.get(key).gap>gap)closest.set(key,row);
    if(inside)issues.push(row);
   }
  }
  rows.push({time,state:u.state,issues});console.log({time,queries,issues:issues.map(r=>({from:r.from,to:r.to,penetrationPixels:-100*r.gap,inside:r.inside}))});
 }
 const report={sources,options,rows,queries,maximumUnintendedPenetrationPixels:100*maximumUnintendedPenetration,maximumWorkingPenetrationPixels:100*maximumWorkingPenetration,maximumClampPenetrationPixels:100*maximumClampPenetration,motionBounds:{min:motionBounds.min.toArray(),max:motionBounds.max.toArray()},cameraBounds:{min:u.cameraFitBounds.min.toArray(),max:u.cameraFitBounds.max.toArray()},closest:[...closest.values()],qualification:'Actual rendered triangle vertices, edge midpoints and face centroids against the opposing solid surfaces, in both directions. Rigid assembly interfaces excluded by family; input and output cords remain separate. Only the three named pulley/cord pairs and two cord/grip pairs permit 0.1 source pixel of solver compliance. Pin bores have no special overlap allowance. Full native cord state advances between sampled poses. This finite surface/pose sampling does not prove continuous-time clearance or individual cord self-clearance.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log({...report,sources:sources.length,rows:rows.length,closest:undefined});assert(rows.every(r=>!r.issues.length),'Sampled hardware interference');
}finally{v.dispose();}
