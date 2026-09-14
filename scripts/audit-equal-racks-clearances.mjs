import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoEqualRacks} from '../src/simulation/mujoco-equal-racks/visual.js';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {equalRacksStudySources} from './lib/equal-racks-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/115-clearances',sources=freezeStudySources([...equalRacksStudySources('scripts/audit-equal-racks-clearances.mjs'),'scripts/lib/weighted-clutch-solid-audit.mjs','tests/helpers/solid-surface.mjs'],prefix);
const options=JSON.parse(process.env.SIM_OPTIONS??'{}'),times=process.env.TIMES?JSON.parse(process.env.TIMES):Array.from({length:25},(_,i)=>i/4);
assert(Array.isArray(times)&&times.length&&times.every(t=>Number.isFinite(t)&&t>=0),'Invalid sample times');times.sort((a,b)=>a-b);
const v=makeMujocoEqualRacks(await loadMujoco(),options),u=v.root.userData,rows=[],closest=new Map(),bounds=new THREE.Box3();let checks=0,penetration=0,unintendedPenetration=0;
try {
 const entries=Object.entries(u.parts),prepared=new Map(entries.map(([name,m])=>{
  const topology=inspectWeightedClutchSolid(m.geometry);assert.equal(topology.unmatchedEdges+topology.degenerate+topology.nonfinite+topology.wrongNormals,0,name);return [name,{topology,surface:solidSurface(m.geometry),points:surfacePoints(m.geometry)}];
 }));
 for(const time of times) {
  v.update(time);const boxes=new Map(),issues=[];
  for(const [name,m]of entries) {
   boxes.set(name,new THREE.Box3().setFromObject(m,true));bounds.union(boxes.get(name));
   const p=m.geometry.attributes.position;for(let j=0;j<p.count;j++)assert(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(m.matrixWorld)),name+' outside camera bounds');
  }
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++) {
   const [an,a]=entries[i],[bn,b]=entries[j];if(u.families[an]===u.families[bn]||!boxes.get(an).intersectsBox(boxes.get(bn)))continue;
   const intended=['upper','lower','frame'].includes(an)&&['upper','lower','frame'].includes(bn);
   for(const [fromName,from,toName,to]of [[an,a,bn,b],[bn,b,an,a]]) {
    const src=prepared.get(fromName),dst=prepared.get(toName),transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),point=new THREE.Vector3();let gap=.01,inside=0,witness;
    for(const q of src.points) {
     checks++;point.copy(q).applyMatrix4(transform);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;
     const signed=dst.surface.signedDistance(point,.01),d=signed<0?-dst.surface.distance(point):signed;
     const f=u.profile;
     const toothPoint=(name,p)=>{
      if(name==='frame'){
       const side=p.y>0?'upper':'lower',half=f.pitch/4+.95*f.module*Math.tan(f.pressureAngle);
       return Math.abs(p.y)>=f.rackTipY-.002&&Math.abs(p.y)<=f.rootY+.002&&p.x>=f.origins[side]-half-.002&&p.x<=f.origins[side]+(f.counts[side]-1)*f.pitch+half+.002;
      }
      return ['upper','lower'].includes(name)&&Math.hypot(p.x,p.y)>=u.parts[name].geometry.userData.rootRadius-.002;
     };
     const onTeeth=intended&&toothPoint(fromName,q)&&toothPoint(toName,point);
     if(!onTeeth)unintendedPenetration=Math.max(unintendedPenetration,-d);
     if(d<-(onTeeth?.0015:1e-6))inside++;if(d<gap){gap=d;witness=point.clone().applyMatrix4(to.matrixWorld).toArray();}
    }
    const row={from:fromName,to:toName,gap,inside,witness,time,intended};const key=fromName+'/'+toName;
    if(!closest.has(key)||closest.get(key).gap>gap)closest.set(key,row);penetration=Math.max(penetration,-gap);if(inside)issues.push(row);
   }
  }
  rows.push({time,state:u.state,issues});console.log({time,checks,issues:issues.map(r=>({from:r.from,to:r.to,penetrationPixels:-100*r.gap}))});
 }
 const report={sources,options,rows,checks,maximumPenetrationPixels:100*penetration,maximumUnintendedPenetrationPixels:100*unintendedPenetration,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},closest:[...closest.values()],qualification:'Independent surface vertices, edge midpoints and triangle centroids at sampled native poses. Same-family attachments are excluded. Only gear/rack and gear/gear points in their bounded tooth regions permit 0.15 source pixel of soft penetration; frame end walls, shafts, end stubs and all other cross-family points permit only a 1e-6 numerical tolerance. This independently checks all hardware, including the shafts and the shallow end stubs. Sampled clearance only, not continuous interference or force convergence.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,rows:rows.length,closest:undefined});assert(rows.every(r=>!r.issues.length),'sampled hardware interference');
}finally{v.dispose();}
