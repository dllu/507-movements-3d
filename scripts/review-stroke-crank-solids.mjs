import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {createAuthoredStrokeCrankMovement} from '../src/simulation/authored-stroke-cranks.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const m=createAuthoredStrokeCrankMovement({id:175}),b=m.root.userData.blocks,meshes={},families={};
const groups=[[b.fixedFrame,'fixed'],[b.fixedShaft,'fixed'],[b.rearShaftCollar,'fixed'],[b.crank,'crank'],[b.crankPinShaft,'crank'],[b.slider,'slider'],[b.sliderPinShaft,'slider'],[b.rod,'rod']];
for(const [group,family]of groups)group.traverse(o=>{if(o.isMesh){const name=o.userData.role;assert.ok(name&&!meshes[name]);meshes[name]=o;families[name]=family;}});
const names=Object.keys(meshes),parts=Object.fromEntries(names.map(n=>[n,{surface:solidSurface(meshes[n].geometry),points:surfacePoints(meshes[n].geometry)}]));
const pairs=[];for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++)if(families[names[i]]!==families[names[j]])pairs.push([names[i],names[j]]);
let queries=0;const intersections={};
try{for(let i=0;i<=128;i++){m.update(8*i/128);m.root.updateMatrixWorld(true);
 for(const [a,b]of pairs)for(const [from,to]of[[a,b],[b,a]]){
  if(!new THREE.Box3().setFromObject(meshes[from]).intersectsBox(new THREE.Box3().setFromObject(meshes[to])))continue;
  const matrix=meshes[to].matrixWorld.clone().invert().multiply(meshes[from].matrixWorld);
  for(const p of parts[from].points){queries++;const q=p.clone().applyMatrix4(matrix);if(!parts[to].surface.inside(q))continue;const depth=parts[to].surface.distance(q);if(depth>1e-6)intersections[a+'/'+b]=Math.max(intersections[a+'/'+b]??0,depth);}
 }}
 const report={movement:175,status:'existing-assembly-baseline',poses:129,meshes:names.length,pairs,queries,intersections,method:'All cross-rigid-family pairs at 129 poses; finite mesh vertices, edge midpoints and face centers. Includes decorative bore and eye rims; excludes the explicitly nonphysical orbit witness. Sampled diagnostic, not a passing clearance certification.',sources:['scripts/review-stroke-crank-solids.mjs','src/simulation/authored-stroke-cranks.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/175-existing-solids.json',JSON.stringify(report,null,2)+'\n');console.log({meshes:names.length,queries,intersections});
}finally{disposeObject3D(m.root);}
