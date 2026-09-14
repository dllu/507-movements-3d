import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoBowDrill} from '../src/simulation/mujoco-bow-drill/visual.js';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/124-clearances';
const options=JSON.parse(process.env.SIM_OPTIONS??'{}'),times=process.env.TIMES?JSON.parse(process.env.TIMES):Array.from({length:51},(_,i)=>i/4);
assert(Array.isArray(times)&&times.length&&times.every(t=>Number.isFinite(t)&&t>=0));times.sort((a,b)=>a-b);
const sources=freezeStudySources(['scripts/audit-bow-drill-clearances.mjs',
  ...fs.readdirSync('src/simulation/mujoco-bow-drill').filter(n=>n.endsWith('.js')).map(n=>'src/simulation/mujoco-bow-drill/'+n),
  'scripts/lib/weighted-clutch-solid-audit.mjs','tests/helpers/solid-surface.mjs','scripts/lib/study-report-io.mjs',
  'src/simulation/mujoco/mass.js','src/simulation/mujoco/simulation.js','src/simulation/finite-plate-geometry.js',
  'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','src/simulation/dispose-model.js','package-lock.json'],prefix);
const v=makeMujocoBowDrill(await loadMujoco(),options),u=v.root.userData,entries=Object.entries(u.parts),prepared=new Map(),rows=[],closest=new Map(),motionBounds=new THREE.Box3();
const working=new Set(['drum/initialCord','backFlange/initialCord','frontFlange/initialCord','lowerBinding/stock','stock/upperBinding']);
let queries=0,maximumUnintendedPenetration=0,maximumWorkingPenetration=0,maximumJointOverlap=0;
const jointCenter=(pair)=>{
  const f=u.profile;
  if(pair==='initialCord/lowerBindingLead')return u.parts.lowerBindingLead.localToWorld(new THREE.Vector3(...f.lower));
  if(pair==='initialCord/upperBindingLead')return u.parts.upperBindingLead.localToWorld(new THREE.Vector3(...f.upper));
  for(const name of ['lowerBinding','upperBinding'])if(pair===name+'/'+name+'Lead')return u.parts[name].localToWorld(new THREE.Vector3(...f.bindingPoints[name][0]));
};
try {
  for(const[name,m]of entries) {
    const topology=inspectWeightedClutchSolid(m.geometry);assert.equal(topology.components,1,name);assert(topology.volume>0,name);
    assert.equal(topology.unmatchedEdges+topology.degenerate+topology.nonfinite+topology.wrongNormals,0,name);
    prepared.set(name,{topology,surface:solidSurface(m.geometry),points:surfacePoints(m.geometry)});
  }
  for(const time of times) {
    v.update(time);const boxes=new Map(),issues=[];
    for(const[name,m]of entries) {
      if(name==='stock'||name==='initialCord')prepared.set(name,{surface:solidSurface(m.geometry),points:surfacePoints(m.geometry)});
      const box=new THREE.Box3().setFromObject(m,true);boxes.set(name,box);motionBounds.union(box);
      assert(u.cameraFitBounds.containsBox(box),name+' outside camera bounds');
    }
    for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++) {
      const[an,a]=entries[i],[bn,b]=entries[j],pair=[an,bn].sort().join('/');
      if(u.families[an]==='spindle'&&u.families[bn]==='spindle')continue;
      if(!boxes.get(an).intersectsBox(boxes.get(bn)))continue;
      const join=jointCenter(pair),tolerance=working.has(pair)?.001:1e-6;
      for(const[fromName,from,toName,to]of [[an,a,bn,b],[bn,b,an,a]]) {
        const src=prepared.get(fromName),dst=prepared.get(toName),transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),point=new THREE.Vector3();
        let gap=.005,inside=0,witness,kind;
        for(const q of src.points) {
          point.copy(q).applyMatrix4(transform);if(dst.surface.box.distanceToPoint(point)>.005)continue;
          queries++;const signed=dst.surface.signedDistance(point,.005),d=signed<0?-dst.surface.distance(point):signed;
          const world=point.clone().applyMatrix4(to.matrixWorld),joint=join&&join.distanceTo(world)<2.5*u.profile.cordRadius;
          if(joint)maximumJointOverlap=Math.max(maximumJointOverlap,-d);
          else if(working.has(pair))maximumWorkingPenetration=Math.max(maximumWorkingPenetration,-d);
          else maximumUnintendedPenetration=Math.max(maximumUnintendedPenetration,-d);
          if(!joint&&d< -tolerance)inside++;
          if(d<gap){gap=d;witness=world.toArray();kind=joint?'attachment join':working.has(pair)?'working contact':'unintended';}
        }
        const row={from:fromName,to:toName,gap,inside,witness,time,kind},key=fromName+'/'+toName;
        if(!closest.has(key)||closest.get(key).gap>gap)closest.set(key,row);
        if(inside)issues.push(row);
      }
    }
    rows.push({time,state:u.state,issues});console.log({time,queries,issues:issues.map(r=>({from:r.from,to:r.to,penetrationPixels:-100*r.gap,inside:r.inside}))});
  }
  const report={sources,options,rows,queries,maximumUnintendedPenetrationPixels:100*maximumUnintendedPenetration,
    maximumWorkingPenetrationPixels:100*maximumWorkingPenetration,maximumJointOverlapPixels:100*maximumJointOverlap,
    motionBounds:{min:motionBounds.min.toArray(),max:motionBounds.max.toArray()},cameraBounds:{min:u.cameraFitBounds.min.toArray(),max:u.cameraFitBounds.max.toArray()},
    closest:[...closest.values()],qualification:'Actual rendered triangle surfaces, including bound cord against stock and free cord against all hardware. Rigid spindle assembly attachments excluded. Only the named working contacts permit 0.1 source pixel soft penetration. Four geometric end-cap joins are classified only within 2.5 cord radii of their attachment centers. All other intersections permit 1e-6 world numerical tolerance. This sampled surface/pose audit does not prove continuous-time clearance or cord self-clearance.'};
  verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log({...report,sources:sources.length,rows:rows.length,closest:undefined});assert(rows.every(r=>!r.issues.length),'sampled hardware interference');
}finally{v.dispose();}
