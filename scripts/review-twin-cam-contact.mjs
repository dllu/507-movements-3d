import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredCamArrayMovement} from '../src/simulation/authored-cam-arrays.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const start=performance.now(),model=createAuthoredCamArrayMovement({id:149}),constructionMilliseconds=performance.now()-start;
try{
 const {camRecords,leverRecords}=model.root.userData.blocks,parts=new Map(),pairs=[];
 const add=mesh=>{if(!parts.has(mesh))parts.set(mesh,{mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return parts.get(mesh);};
 for(let i=0;i<2;i++)for(const name of ['plate','outline'])pairs.push({name:leverRecords[i].config.name+'-'+name,a:add(camRecords[i][name]),b:add(leverRecords[i].roller.body)});
 const failures={};let checks=0,minimumRadialGap=Infinity,maximumRadialGap=-Infinity;
 for(let pose=0;pose<=64;pose++){
  model.update(model.root.userData.geometry.cyclePeriod*pose/64);model.root.updateMatrixWorld(true);
  for(let i=0;i<2;i++){
   const plate=camRecords[i].plate,roller=leverRecords[i].roller.body,point=roller.getWorldPosition(new THREE.Vector3()).applyMatrix4(plate.matrixWorld.clone().invert());
   const gap=parts.get(plate).solid.distance(point)-leverRecords[i].config.rollerRadius;
   minimumRadialGap=Math.min(minimumRadialGap,gap);maximumRadialGap=Math.max(maximumRadialGap,gap);
  }
  for(const {name,a,b} of pairs)for(const [from,to] of [[a,b],[b,a]]){
   const transform=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
   for(const p of from.points){const q=p.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;
    const depth=to.solid.distance(q);if(depth<1e-6)continue;
    const entry=failures[name]??{firstPose:pose,points:0,maximumDepth:0};entry.points++;entry.maximumDepth=Math.max(entry.maximumDepth,depth);failures[name]=entry;
   }
  }
 }
 const report={movement:149,method:'Actual tread vertices, edge midpoints and triangle centers against cam plates and decorative outline tubes, in both directions, at 65 poses. Separately compare roller-center distance to the plate with roller radius. Working pairs only, not whole assembly.',
  summary:{poses:65,pairs:pairs.length,checks,failingPairs:Object.keys(failures).length,minimumRadialGap,maximumRadialGap,constructionMilliseconds},failures,
  sources:['scripts/review-twin-cam-contact.mjs','src/simulation/authored-cam-arrays.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync(process.env.REPORT??'docs/validation/149-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary,failures);
 if(process.env.REQUIRE_CLEAR==='1'){
  assert.equal(Object.keys(failures).length,0);
  assert.ok(minimumRadialGap>-.0000001&&maximumRadialGap<.0003);
 }
}finally{disposeObject3D(model.root);}
