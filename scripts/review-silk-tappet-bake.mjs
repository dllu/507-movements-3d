import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeSilkTappetSolids} from '../src/simulation/mujoco-silk-tappet/solids.js';
import {sampleSilkTappetMotion} from '../src/simulation/mujoco-silk-tappet/playback.js';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
const asset='src/simulation/baked/assets/173-tappet.json.gz';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(asset))),v=makeSilkTappetSolids(bundle.parameters);
const surfaces=Object.entries(v.parts).filter(([name])=>name!=='tappet').map(([name,mesh])=>({name,mesh,surface:solidSurface(mesh.geometry)}));
const pinRadius=v.parts.tappet.geometry.parameters.radius;
let minimumGap=Infinity,worstTime=0,poses=0,queries=0;
try {
 for(let k=1;k<bundle.motion.length;k++)for(let j=0;j<8;j++) {
  const a=bundle.motion[k-1][0],b=bundle.motion[k][0],time=a+(b-a)*j/8;
  v.update(sampleSilkTappetMotion(bundle,time));poses++;
  const center=v.parts.tappet.getWorldPosition(new THREE.Vector3());
  for(const {mesh,surface} of surfaces){
   const p=mesh.worldToLocal(center.clone());
   // AABB lower bound skips separated meshes; exact triangles resolve proximity.
   if(surface.box.distanceToPoint(p)>pinRadius+.005)continue;
   queries++;const gap=surface.signedDistance(p)-pinRadius;
   if(gap<minimumGap){minimumGap=gap;worstTime=time;}
  }
 }
 const sources=['scripts/review-silk-tappet-bake.mjs','src/simulation/mujoco-silk-tappet/solids.js','src/simulation/mujoco-silk-tappet/playback.js',asset].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const report={movement:173,status:'standalone-baked-contact-clearance',poses,queries,minimumGap,worstTime,
 method:'Eight subinterval samples per adaptive key interval across 18 turns. Exact finite wheel mesh triangles versus the circumscribing sphere of the visible tappet; conservative for its tessellated surface. AABB rejection beyond the pin radius plus 0.005 model units. All 19 wheel meshes tested against the pin; whole silk assembly excluded.',sources};
 fs.writeFileSync('docs/validation/173-tappet-baked-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);
 assert.ok(queries>0);assert.ok(minimumGap>=0,'Interpolated tappet intersects a tooth');
 assert.deepEqual(sampleSilkTappetMotion(bundle,72),sampleSilkTappetMotion(bundle,100));
}finally{v.dispose();}
