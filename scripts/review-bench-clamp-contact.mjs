import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {gunzipSync} from 'node:zlib';import {makeBakedBenchClampModel} from '../src/simulation/baked/bench-clamp.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const m=makeBakedBenchClampModel(JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/174.json.gz')))),{parts:meshes,families}=m.root.userData;
const names=Object.keys(meshes),parts=Object.fromEntries(names.map(n=>[n,{surface:solidSurface(meshes[n].geometry),points:surfacePoints(meshes[n].geometry)}]));
const pairs=[['jaw0','board'],['jaw1','board']];
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/174.json.gz'))),times=[];
for(let k=1;k<bundle.motion.length;k++)for(let j=0;j<4;j++)times.push(bundle.motion[k-1][0]+(bundle.motion[k][0]-bundle.motion[k-1][0])*j/4);times.push(6);
let queries=0;const intersections={};
try {for(const time of times){m.update(time);m.root.updateMatrixWorld(true);
 for(const mesh of Object.values(meshes))assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
 for(const [a,b]of pairs)for(const[from,to]of[[a,b],[b,a]]){
  if(!new THREE.Box3().setFromObject(meshes[from]).intersectsBox(new THREE.Box3().setFromObject(meshes[to])))continue;
  const matrix=meshes[to].matrixWorld.clone().invert().multiply(meshes[from].matrixWorld);
  for(const p of parts[from].points){queries++;const q=p.clone().applyMatrix4(matrix);if(!parts[to].surface.inside(q))continue;const depth=parts[to].surface.distance(q);if(depth>1e-6)intersections[a+'/'+b]=Math.max(intersections[a+'/'+b]??0,depth);}
 }}
 const report={movement:174,poses:times.length,meshes:names.length,pairs,queries,intersections,method:'Both jaw-board pairs at four subinterval samples per adaptive motion interval; finite mesh vertices, edge midpoints and face centers. All 16 meshes are physical. Sampled clearance only.',sources:['scripts/review-bench-clamp-contact.mjs','src/simulation/baked/bench-clamp.js','src/simulation/mujoco-bench-clamp/update-solids.js','src/simulation/baked/assets/174.json.gz','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/174-dense-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.ok(queries>0);assert.equal(Object.keys(intersections).length,0);
}finally{disposeObject3D(m.root);}
