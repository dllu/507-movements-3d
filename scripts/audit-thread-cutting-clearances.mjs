import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoThreadCutting} from '../src/simulation/mujoco-thread-cutting/visual.js';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {threadCuttingStudySources} from './lib/thread-cutting-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/109-clearances',sources=freezeStudySources([...threadCuttingStudySources('scripts/audit-thread-cutting-clearances.mjs'),'scripts/lib/weighted-clutch-solid-audit.mjs','tests/helpers/solid-surface.mjs'],prefix);
const options=JSON.parse(process.env.SIM_OPTIONS??'{}'),mujoco=await loadMujoco(),v=makeMujocoThreadCutting(mujoco,options),u=v.root.userData,p=v.physics,f=u.profile;
const rows=[],closest=new Map(),cache=new WeakMap(),bounds=new THREE.Box3();let checks=0,penetration=0,retention=Infinity,threadEngagement=Infinity;
const prepare=g=>{if(!cache.has(g))cache.set(g,{surface:solidSurface(g),points:surfacePoints(g),topology:inspectWeightedClutchSolid(g)});return cache.get(g);};
try {
 const times=[...Array.from({length:25},(_,i)=>i/1000),...Array.from({length:49},(_,i)=>i/2)].sort((a,b)=>a-b).filter((x,i,a)=>!i||x!==a[i-1]);
 for(const time of times) {
  v.update(time);const entries=Object.entries(u.parts).filter(([,m])=>m.geometry.attributes.position.count),boxes=new Map();
  const topology=[];for(const [name,m]of entries){const s=prepare(m.geometry);topology.push({name,...s.topology});assert.equal(s.topology.unmatchedEdges+s.topology.degenerate+s.topology.nonfinite+s.topology.wrongNormals,0,name);m.geometry.computeBoundingBox();boxes.set(name,m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
   const ps=m.geometry.attributes.position,point=new THREE.Vector3();for(let j=0;j<ps.count;j++){point.fromBufferAttribute(ps,j).applyMatrix4(m.matrixWorld);bounds.expandByPoint(point);assert(u.cameraFitBounds.containsPoint(point),name+' outside camera bounds');}
  }
  const issues=[];
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++) {
   const [an,a]=entries[i],[bn,b]=entries[j];if(u.families[an]===u.families[bn]||!boxes.get(an).intersectsBox(boxes.get(bn)))continue;
   for(const [fromName,from,toName,to]of [[an,a,bn,b],[bn,b,an,a]]) {
    const src=prepare(from.geometry),dst=prepare(to.geometry),transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),point=new THREE.Vector3();let gap=.01,inside=0,witness;
    for(const q of src.points){checks++;point.copy(q).applyMatrix4(transform);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;const signed=dst.surface.signedDistance(point,.01),d=signed<0?-dst.surface.distance(point):signed;if(d< -1e-6)inside++;if(d<gap){gap=d;witness=point.clone().applyMatrix4(to.matrixWorld).toArray();}}
    const row={from:fromName,to:toName,gap,inside,witness,time};const key=fromName+'/'+toName;if(!closest.has(key)||closest.get(key).gap>gap)closest.set(key,row);penetration=Math.max(penetration,-gap);if(inside)issues.push(row);
   }
  }
  const q=p.data.qpos[2];retention=Math.min(retention,Math.min(f.y(u.source.edges.topBottom),f.internal.high-.035+q)-Math.max(f.y(u.source.edges.bottomTop),f.internal.low+.035+q));
  threadEngagement=Math.min(threadEngagement,Math.min(f.external.high,f.internal.high+q)-Math.max(f.external.low,f.internal.low+q));
  rows.push({time,state:u.state,issues,workpieceVolume:prepare(u.parts.workpiece.geometry).topology.volume});
  console.log({time,checks,issues:issues.map(r=>({from:r.from,to:r.to,penetrationPixels:-100*r.gap}))});
 }
 verifyStudySources(sources);
 const result={sources,options,rows,checks,maximumPenetrationPixels:100*penetration,guideEngagementPixels:100*retention,threadEngagementPixels:100*threadEngagement,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},closest:[...closest.values()],qualification:'Independent surface vertices, triangle centroids and edge midpoints at 73 native poses. Rigidly attached parts are excluded. Sampled clearance, not a continuous interference proof; no native cutting/contact-force claim.'};
 fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log({...result,sources:undefined,rows:rows.length,closest:undefined});
 assert(rows.every(row=>!row.issues.length),'sampled hardware interference');
 assert(retention>0&&threadEngagement>f.pitch,'guide or complete thread engagement lost');
}finally{v.dispose();}
