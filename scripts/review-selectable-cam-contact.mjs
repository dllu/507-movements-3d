import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredSelectableCamMovement} from '../src/simulation/authored-selectable-cams.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const start=performance.now(),v=createAuthoredSelectableCamMovement({id:150}),constructionMilliseconds=performance.now()-start;
try{
 const {camRecords,followerRoller,commonBaseSleeve}=v.root.userData.blocks;
 const add=mesh=>({mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}),roller=add(followerRoller.tread);
 const cams=camRecords.flatMap((c,i)=>['plate','outline'].map(n=>({name:'cam'+i+'-'+n,...add(c[n])})));cams.push({name:'common-heel',...add(commonBaseSleeve)});
 let checks=0;const failures={};
 for(let pose=0;pose<=96;pose++){
  v.update(v.root.userData.geometry.demonstrationPeriod*pose/96);v.root.updateMatrixWorld(true);
  const rb=new THREE.Box3().setFromObject(roller.mesh);
  for(const c of cams){
   if(!new THREE.Box3().setFromObject(c.mesh).intersectsBox(rb))continue;
   for(const [from,to] of [[c,roller],[roller,c]]){
    const transform=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
    for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;
     const e=failures[c.name]??{firstPose:pose,points:0,maximumDepth:0};e.points++;e.maximumDepth=Math.max(e.maximumDepth,depth);failures[c.name]=e;
    }
   }
  }
 }
 const report={movement:150,method:'Actual roller tread versus all four plates, outline tubes and common sleeve. Bidirectional vertices, edge midpoints and triangle centers at 97 poses through the full selection demonstration. Working pairs only; not whole assembly or continuous collision proof.',summary:{constructionMilliseconds,period:v.root.userData.geometry.demonstrationPeriod,poses:97,checks,failingPairs:Object.keys(failures).length},failures,sources:['scripts/review-selectable-cam-contact.mjs','src/simulation/authored-selectable-cams.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync(process.env.REPORT??'docs/validation/150-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary,failures);
 if(process.env.REQUIRE_CLEAR==='1')assert.equal(Object.keys(failures).length,0);
}finally{disposeObject3D(v.root);}
