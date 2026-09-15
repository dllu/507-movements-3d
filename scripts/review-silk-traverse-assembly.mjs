import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {gunzipSync} from 'node:zlib';import {makeSilkTraverseAssembly} from '../src/simulation/mujoco-silk-tappet/assembly.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const m=makeSilkTraverseAssembly(JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/173-tappet.json.gz')))),{parts:meshes,families}=m.root.userData;
const names=Object.keys(meshes),parts=Object.fromEntries(names.map(n=>[n,{surface:solidSurface(meshes[n].geometry),points:surfacePoints(meshes[n].geometry)}]));
const pairs=[];for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)if(families[names[i]]!==families[names[j]])pairs.push([names[i],names[j]]);
let queries=0;const intersections={};
try {for(let i=0;i<=128;i++){m.update(m.root.userData.geometry.duration*i/128);m.root.updateMatrixWorld(true);
 for(const mesh of Object.values(meshes))assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
 for(const [a,b]of pairs)for(const[from,to]of[[a,b],[b,a]]){
  if(!new THREE.Box3().setFromObject(meshes[from]).intersectsBox(new THREE.Box3().setFromObject(meshes[to])))continue;
  const matrix=meshes[to].matrixWorld.clone().invert().multiply(meshes[from].matrixWorld);
  for(const p of parts[from].points){queries++;const q=p.clone().applyMatrix4(matrix);if(!parts[to].surface.inside(q))continue;const depth=parts[to].surface.distance(q);if(depth>1e-6)intersections[a+'/'+b]=Math.max(intersections[a+'/'+b]??0,depth);}
 }}
 const report={movement:173,poses:129,meshes:names.length,pairs,queries,intersections,method:'Every cross-rigid-family pair; finite mesh vertices, edge midpoints and face centers. All physical meshes classified; standalone contact has a separate dense audit. Sampled clearance only.',sources:['scripts/review-silk-traverse-assembly.mjs','src/simulation/mujoco-silk-tappet/assembly.js','src/simulation/mujoco-silk-tappet/solids.js','src/simulation/mujoco-silk-tappet/playback.js','src/simulation/baked/assets/173-tappet.json.gz','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/173-assembly-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.ok(queries>0);assert.equal(Object.keys(intersections).length,0);
}finally{disposeObject3D(m.root);}
