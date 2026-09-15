import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredSelectableCamMovement} from '../src/simulation/authored-selectable-cams.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=createAuthoredSelectableCamMovement({id:150});
try{
 const b=v.root.userData.blocks,items=new Map();
 const add=(name,mesh)=>{const part={name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)};items.set(name,part);return part;};
 const shaft=[add('shaft',b.rotatingShaft),add('key',b.shaftKeyIndex)];
 const carrier=[add('hub',b.carrierHub),add('sleeve',b.commonBaseSleeve),...b.carrierEndCollars.map((m,i)=>add('collar'+i,m)),...b.camRecords.flatMap((r,i)=>['plate','outline','lobeIndex'].map(n=>add('cam'+i+'-'+n,r[n])).concat(r.throwTicks.map((m,j)=>add('cam'+i+'-tick'+j,m))))];
 const fixed=[...b.camBearingRings.map((m,i)=>add('bearing'+i,m)),...b.camBearingPosts.map((m,i)=>add('post'+i,m))];
 const pairs=[...shaft.flatMap(a=>[...carrier,...fixed].map(c=>[a,c])),...carrier.flatMap(a=>fixed.map(c=>[a,c]))];
 let checks=0;const failures={};
 for(let pose=0;pose<=96;pose++){
  v.update(v.root.userData.geometry.demonstrationPeriod*pose/96);v.root.updateMatrixWorld(true);
  for(const part of items.values()){part.box=new THREE.Box3().setFromObject(part.mesh);part.inverse=part.mesh.matrixWorld.clone().invert();}
  for(const [a,b] of pairs){if(!a.box.intersectsBox(b.box))continue;const name=a.name+'/'+b.name;
   for(const [from,to] of [[a,b],[b,a]]){
    const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;
     const e=failures[name]??{firstPose:pose,points:0,maximumDepth:0};e.points++;e.maximumDepth=Math.max(e.maximumDepth,depth);failures[name]=e;
    }
   }
  }
 }
 const report={movement:150,method:'Shaft and key versus carrier and bearings/posts; carrier versus bearings/posts. Actual vertices, edge midpoints and face centers in both directions at 97 poses. Rigid carrier internal interfaces and other mechanism parts excluded. Sampled clearance, not continuous collision proof.',summary:{poses:97,pairs:pairs.length,checks,failingPairs:Object.keys(failures).length,shaftRadiusPixels:b.rotatingShaft.geometry.parameters.radiusTop/v.root.userData.geometry.sourceScale},failures,sources:['scripts/review-selectable-cam-shaft.mjs','src/simulation/authored-selectable-cams.js','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/150-shaft-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary,failures);assert.equal(Object.keys(failures).length,0);
}finally{disposeObject3D(v.root);}
