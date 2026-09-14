import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoVariableTraverse} from '../src/simulation/mujoco-variable-traverse/visual.js';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {variableTraverseStudySources} from './lib/variable-traverse-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/122-clearances',sources=freezeStudySources([...variableTraverseStudySources('scripts/audit-variable-traverse-clearances.mjs'),'scripts/lib/weighted-clutch-solid-audit.mjs','tests/helpers/solid-surface.mjs'],prefix),options=JSON.parse(process.env.SIM_OPTIONS??'{}'),times=process.env.TIMES?JSON.parse(process.env.TIMES):Array.from({length:466},(_,i)=>i/4);
assert(Array.isArray(times)&&times.length&&times.every(t=>Number.isFinite(t)&&t>=0));times.sort((a,b)=>a-b);
const v=makeMujocoVariableTraverse(await loadMujoco(),options),u=v.root.userData,entries=Object.entries(u.parts),prepared=new Map(),rows=[],closest=new Map();let checks=0,maximumPenetrationPixels=0,maximumUnintendedPenetrationPixels=0;
const region=(name,p)=>['upperGear','lowerGear'].includes(name)&&Math.hypot(p.x,p.y)>u.parts[name].geometry.userData.rootRadius-.005?name:undefined;
try{
 for(const[name,m]of entries){const topology=inspectWeightedClutchSolid(m.geometry);assert.equal(topology.components,1,name);assert(topology.volume>0,name);assert.equal(topology.unmatchedEdges+topology.degenerate+topology.nonfinite+topology.wrongNormals,0,name);prepared.set(name,{topology,surface:solidSurface(m.geometry),points:surfacePoints(m.geometry)});}
 for(const time of times){
  v.update(time);const boxes=new Map(),issues=[];
  for(const[name,m]of entries){boxes.set(name,new THREE.Box3().setFromObject(m,true));const p=m.geometry.attributes.position;for(let j=0;j<p.count;j++)assert(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(m.matrixWorld)),name+' outside camera bounds');}
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const[an,a]=entries[i],[bn,b]=entries[j];if(u.families[an]===u.families[bn]||!boxes.get(an).intersectsBox(boxes.get(bn)))continue;
   for(const[fromName,from,toName,to]of [[an,a,bn,b],[bn,b,an,a]]){
    const src=prepared.get(fromName),dst=prepared.get(toName),transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),point=new THREE.Vector3();let gap=.01,inside=0,witness,intended=false;
    for(const q of src.points){checks++;point.copy(q).applyMatrix4(transform);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;
     const signed=dst.surface.signedDistance(point,.01),d=signed<0?-dst.surface.distance(point):signed,pair=[region(fromName,q),region(toName,point)].sort().join('/'),working=['lowerGear/upperGear'].includes(pair);
     if(!working)maximumUnintendedPenetrationPixels=Math.max(maximumUnintendedPenetrationPixels,-100*d);if(d<-(working?.001:1e-6))inside++;
     if(d<gap){gap=d;witness=point.clone().applyMatrix4(to.matrixWorld).toArray();intended=working;}
    }
    const row={from:fromName,to:toName,gap,inside,witness,time,intended},key=fromName+'/'+toName;if(!closest.has(key)||closest.get(key).gap>gap)closest.set(key,row);maximumPenetrationPixels=Math.max(maximumPenetrationPixels,-100*gap);if(inside)issues.push(row);
   }
  }rows.push({time,state:u.state,issues});console.log({time,checks,issues:issues.map(r=>({from:r.from,to:r.to,penetrationPixels:-100*r.gap}))});
 }
 const report={sources,options,rows,checks,maximumPenetrationPixels,maximumUnintendedPenetrationPixels,closest:[...closest.values()],qualification:'Independent actual surface queries across all reconstructed hardware. Same-family attachments are excluded. Only the two working gear tooth regions permit 0.1 source pixel of soft penetration; all other pairs permit only 1e-6 world numerical tolerance. Sampled poses do not certify continuous clearance or force convergence.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:sources.length,rows:rows.length,closest:undefined});assert(rows.every(r=>!r.issues.length),'sampled hardware interference');
}finally{v.dispose();}
