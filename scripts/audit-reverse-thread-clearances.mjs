import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoReverseThread} from '../src/simulation/mujoco-reverse-thread/visual.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/108-clearances';
const reportFile=process.env.DYNAMICS_REPORT??'/dev/shm/108-round-long.json';
const dynamics=JSON.parse(fs.readFileSync(reportFile));verifyStudySources(dynamics.sources);
const sources=freezeStudySources([...dynamics.sources.map(s=>s.file),reportFile,
 'scripts/audit-reverse-thread-clearances.mjs','tests/helpers/solid-surface.mjs',
 'scripts/lib/weighted-clutch-solid-audit.mjs'],prefix);
const v=makeMujocoReverseThread(await loadMujoco(),dynamics.options),u=v.root.userData,p=v.physics;
try {
 const entries=Object.entries(u.parts),cache=new Map(),topology=entries.map(([name,m])=>({name,...inspectWeightedClutchSolid(m.geometry)}));
 for(const a of topology){assert.ok(a.volume>0);assert.equal(a.components,a.name==='lands'?11:1);for(const k of ['degenerate','wrongNormals','nonfinite','unmatchedEdges'])assert.equal(a[k],0,a.name+' '+k);}
 const prepare=m=>{if(!cache.has(m.geometry))cache.set(m.geometry,{surface:solidSurface(m.geometry),points:surfacePoints(m.geometry)});return cache.get(m.geometry);};
 const samples=dynamics.rows.map(row=>({time:row.time,qpos:row.qpos,kind:'trajectory'}));
 for(const name of ['maximumError','maximumPenetration'])if(dynamics[name])samples.push({...dynamics[name],kind:name});
 if(dynamics.maximumSpeedWindow){const w=dynamics.maximumSpeedWindow;samples.push({time:w.start,qpos:w.startPose,kind:'speed-window-start'},{time:w.end,qpos:w.endPose,kind:'speed-window-end'});}
 let checks=0,penetration=0,guideRetention=Infinity,minimumRailGap=Infinity,minimumSocketRetention=Infinity;
 const rows=[],closest=new Map(),motionBounds=new THREE.Box3();
 for(const sample of samples) {
  // Replay recorded passive states. The independent surface queries do not
  // use native contact distances or the analytical machining/travel law.
  p.data.qpos.set(sample.qpos);p.data.qvel.fill(0);v.sync();
  const boxes=new Map(entries.map(([name,m])=>{m.geometry.computeBoundingBox();return[name,m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)];}));
  for(const [name,m]of entries){const a=m.geometry.attributes.position,point=new THREE.Vector3();for(let i=0;i<a.count;i++){point.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);motionBounds.expandByPoint(point);assert.ok(u.cameraFitBounds.containsPoint(point),name+' escapes camera bounds');}}
  const slider=boxes.get('slider'),guide=boxes.get('guide'),socket=boxes.get('socket'),spindle=boxes.get('spindle');
  guideRetention=Math.min(guideRetention,Math.min(slider.max.y,guide.max.y)-Math.max(slider.min.y,guide.min.y));
  minimumRailGap=Math.min(minimumRailGap,boxes.get('upperRail').min.y-slider.max.y,slider.min.y-boxes.get('lowerRail').max.y);
  minimumSocketRetention=Math.min(minimumSocketRetention,Math.min(socket.max.x,spindle.max.x)-Math.max(socket.min.x,spindle.min.x));
  const issues=[];
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++) {
   const [an,a]=entries[i],[bn,b]=entries[j];
   if(u.families[an]===u.families[bn]||!boxes.get(an).intersectsBox(boxes.get(bn)))continue;
   for(const [fromName,from,toName,to]of [[an,a,bn,b],[bn,b,an,a]]) {
    const src=prepare(from),dst=prepare(to),transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld),point=new THREE.Vector3();
    let gap=.01,inside=0,witness;
    for(const q of src.points){checks++;point.copy(q).applyMatrix4(transform);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;
     const d=dst.surface.signedDistance(point,.01);if(d< -1e-6)inside++;if(d<gap){gap=d;witness=point.clone().applyMatrix4(to.matrixWorld).toArray();}}
    const row={from:fromName,to:toName,gap,inside,witness,time:sample.time,kind:sample.kind},key=fromName+'/'+toName;
    if(!closest.has(key)||gap<closest.get(key).gap)closest.set(key,row);
    if(inside)issues.push(row);penetration=Math.max(penetration,-gap);
   }
  }
  rows.push({...sample,issues});
 }
 const result={sources,options:dynamics.options,
  qualification:'Surface vertices, triangle centroids and edge midpoints at recorded passive poses, including recorded travel/contact/speed peaks. This is sampled interference evidence, not a continuous clearance proof; parts fixed to the same rigid body are excluded.',
  poses:rows.length,checks,topology,penetrationPixels:100*penetration,guideRetentionPixels:100*guideRetention,
  minimumRailGapPixels:100*minimumRailGap,minimumSocketRetentionPixels:100*minimumSocketRetention,
  motionBounds:{min:motionBounds.min.toArray(),max:motionBounds.max.toArray()},closest:[...closest.values()],rows};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log({...result,sources:undefined,rows:undefined,topology:undefined});
}finally{v.dispose();}
